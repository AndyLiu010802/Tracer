'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const G = require('../public/task-garden');
const S = require('../public/workspace-sync');
const M = require('../skins/tracer/model');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-garden-market-http-'));
process.env.DOCS_PORTAL_DATA_DIR = TMP;
process.env.DOCS_PORTAL_SKIN = 'tracer';
const { server } = require('../server');
const clone = value => JSON.parse(JSON.stringify(value));
let origin;
test.before(() => new Promise(resolve => server.listen(0, '127.0.0.1', () => { origin = 'http://127.0.0.1:' + server.address().port; resolve(); })));
test.after(() => new Promise(resolve => server.close(() => {
  const target = path.resolve(TMP);
  assert.equal(path.dirname(target), path.resolve(os.tmpdir())); assert.ok(path.basename(target).startsWith('tracer-garden-market-http-'));
  fs.rmSync(target, { recursive: true, force: true }); resolve();
})));
function request(method, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(origin + '/api/store/workspace', { method, headers: { Origin: origin, 'content-type': 'application/json' } }, res => {
      const parts = []; res.on('data', chunk => parts.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(parts).toString('utf8')) }));
    });
    req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
}
function harvest(workspace, id, kind = 4, ticket = 9999, now = 100) {
  const task = { id, title: id, projectId: null, status: 'doing', createdAt: now, updatedAt: now, order: now };
  workspace.tasks.push(task); G.taskChanged(workspace, task, now, limit => limit === 10000 ? ticket : kind);
  task.status = 'done'; task.doneAt = now + 10; task.updatedAt = now + 10;
  G.taskChanged(workspace, task); G.harvest(workspace, id, now + 20);
}

test('HTTP serialized writes deduplicate overlapping sales and simultaneous purchases, then reload one authoritative balance', async () => {
  const old = M.emptyWorkspace(); for (let i = 0; i < 10; i++) harvest(old, 'old_' + i);
  delete old.taskGarden.market; old.taskGarden.seeds.forEach(seed => { delete seed.farmId; });
  const initial = await request('PUT', old); assert.equal(initial.status, 200);
  const base = initial.body.workspace, first = clone(base), second = clone(base);
  assert.equal(G.sell(first, 'peach', 8, 300).earned, 240);
  assert.equal(G.sell(second, 'peach', 10, 400).earned, 300);
  const sales = await Promise.all([request('PUT', first), request('PUT', second)]);
  assert.ok(sales.every(r => r.status === 200));
  const saved = (await request('GET')).body;
  assert.equal(saved.taskGarden.market.sales.length, 10);
  assert.equal(G.economy(saved).balance, 300); assert.equal(G.inventory(saved).find(p => p.plantKind === 'peach').available, 0);
  const left = clone(saved), right = clone(saved);
  assert.equal(G.buyFarm(left, 'cyber', 500).ok, true); assert.equal(G.equipFarm(left, 'cyber', 600).ok, true);
  assert.equal(G.buyFarm(right, 'cyber', 550).ok, true); assert.equal(G.equipFarm(right, 'cyber', 650).ok, true);
  const purchases = await Promise.all([request('PUT', left), request('POST', right)]);
  assert.ok(purchases.every(r => r.status === 200));
  const reloaded = (await request('GET')).body;
  assert.deepEqual(G.economy(reloaded), { balance: 60, earned: 300, spent: 240, equippedFarmId: 'cyber', ownedFarmIds: ['meadow', 'cyber'] });
  assert.equal(reloaded.taskGarden.market.purchases.length, 1);
  const replay = await request('PUT', old); assert.equal(replay.status, 200);
  assert.deepEqual(G.economy(replay.body.workspace), G.economy(reloaded));
  assert.equal(replay.body.workspace.taskGarden.market.sales.length, 10);
  const oldNoGarden = clone(old); delete oldNoGarden.taskGarden;
  const stale = await request('POST', oldNoGarden); assert.equal(stale.status, 200);
  assert.deepEqual(G.economy(stale.body.workspace), G.economy(reloaded));
  assert.deepEqual(S.validate(stale.body.workspace).taskGarden, G.read(stale.body.workspace));
});

test('HTTP reload retains cyber task and planet identities and sold memory receipts', async () => {
  const current = (await request('GET')).body;
  current.projects.push({ id: 'cyber_world', name: 'City in the clouds', color: '#b183ed', status: 'active', createdAt: 700 });
  const task = { id: 'cyber_task', title: 'A crystal tree', projectId: 'cyber_world', status: 'doing', createdAt: 700, updatedAt: 700 };
  current.tasks.push(task);
  G.taskChanged(current, task, 700, limit => limit === 3 ? 2 : 0);
  task.status = 'done'; task.doneAt = 800; task.updatedAt = 800; G.taskChanged(current, task);
  G.archiveProject(current, 'cyber_world', 900);
  assert.equal(G.sell(current, 'crystal_tree', 1, 1000).earned, 40);
  const result = await request('PUT', current); assert.equal(result.status, 200);
  const loaded = (await request('GET')).body, flower = loaded.taskGarden.planets[0].flowers[0];
  assert.deepEqual([flower.plantKind, flower.farmId, flower.variant], ['crystal_tree', 'cyber', 'shiny']);
  assert.equal(G.inventory(loaded).find(p => p.plantKind === 'crystal_tree').available, 0);
  assert.equal(G.collection(loaded).find(p => p.plantKind === 'crystal_tree').shiny, 1);
  assert.equal(G.economy(loaded).balance, 100);
});

test('HTTP malformed market writes cannot change live data or backup, including duplicate and unfunded receipts', async () => {
  const saved = (await request('GET')).body, file = path.join(TMP, 'workspace.json');
  const bytes = fs.readFileSync(file, 'utf8'), backup = fs.readFileSync(file + '.bak', 'utf8');
  const mutations = [
    market => market.sales.push(clone(market.sales[0])),
    market => market.sales.push({ taskId: 'missing_harvest', soldAt: 1200 }),
    market => market.purchases.push(clone(market.purchases[0])),
    market => { market.sales = []; },
    market => { market.equipped.farmId = 'unknown_farm'; }
  ];
  for (const mutate of mutations) {
    const malformed = clone(saved); mutate(malformed.taskGarden.market);
    const rejected = await request('PUT', malformed); assert.equal(rejected.status, 500);
    assert.equal(fs.readFileSync(file, 'utf8'), bytes); assert.equal(fs.readFileSync(file + '.bak', 'utf8'), backup);
  }
  assert.deepEqual((await request('GET')).body, saved);
});
