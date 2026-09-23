'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const G = require('../public/task-garden');
const M = require('../skins/tracer/model');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-garden-http-'));
process.env.DOCS_PORTAL_DATA_DIR = TMP;
process.env.DOCS_PORTAL_SKIN = 'tracer';
const { server } = require('../server');
let origin;
test.before(() => new Promise(resolve => server.listen(0, '127.0.0.1', () => { origin = 'http://127.0.0.1:' + server.address().port; resolve(); })));
test.after(() => new Promise(resolve => server.close(() => {
  const target = path.resolve(TMP); assert.equal(path.dirname(target), path.resolve(os.tmpdir())); assert.ok(path.basename(target).startsWith('tracer-garden-http-'));
  fs.rmSync(target, { recursive: true, force: true }); resolve();
})));
function request(method, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(origin + '/api/store/workspace', { method, headers: { Origin: origin, 'content-type': 'application/json' } }, res => {
      const parts = []; res.on('data', chunk => parts.push(chunk));
      res.on('end', () => { const text = Buffer.concat(parts).toString('utf8'); resolve({ status: res.statusCode, text, body: JSON.parse(text) }); });
    });
    req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
}
const clone = x => JSON.parse(JSON.stringify(x));
function newWindow(kind, ticket) {
  const ws = M.emptyWorkspace();
  ws.projects.push({ id: 'book', name: 'A collected world', color: '#4fbf82', status: 'active', createdAt: 100 });
  ws.tasks.push({ id: 'chapter', title: 'Finish a chapter', projectId: 'book', status: 'doing', createdAt: 100, updatedAt: 100, doneAt: null, order: 1000 });
  G.reconcile(ws, 100, limit => limit === 6 ? kind : ticket); return ws;
}

test('HTTP replies return authoritative seeds, and reloads retain harvest, cleared work and planet deletions', async () => {
  const firstWindow = newWindow(1, 4500), secondWindow = newWindow(4, 0);
  const first = await request('PUT', firstWindow); assert.equal(first.status, 200); assert.equal(first.body.workspace.taskGarden.seeds[0].plantKind, 'sunflower');
  const second = await request('PUT', secondWindow); assert.equal(second.status, 200);
  assert.equal(second.body.workspace.taskGarden.seeds[0].plantKind, 'sunflower'); assert.equal(second.body.workspace.taskGarden.seeds[0].ticket, 4500);
  assert.deepEqual((await request('GET')).body, second.body.workspace);

  const current = second.body.workspace; M.moveTask(current, 'chapter', 'done');
  const complete = await request('PUT', current); assert.equal(complete.body.workspace.taskGarden.seeds[0].state, 'mature');
  const harvested = complete.body.workspace; G.harvest(harvested, 'chapter');
  const harvest = await request('PUT', harvested); const harvestTime = harvest.body.workspace.taskGarden.seeds[0].harvestedAt; assert.ok(harvestTime);
  const oldWindow = await request('POST', secondWindow); assert.equal(oldWindow.status, 200); assert.equal(oldWindow.body.workspace.taskGarden.seeds[0].harvestedAt, harvestTime);
  // Re-completing the old task cannot award another flower, and clearing retains its first receipt.
  const clear = oldWindow.body.workspace; M.moveTask(clear, 'chapter', 'done'); assert.equal(M.clearCompletedTasks(clear).count, 1);
  const cleared = await request('PUT', clear); assert.equal(cleared.body.workspace.tasks.length, 0);
  assert.equal(G.collection(cleared.body.workspace).reduce((sum, row) => sum + row.total, 0), 1);
  const staleAgain = await request('PUT', harvested); assert.equal(staleAgain.body.workspace.tasks.length, 0, 'cleared planted task cannot be resurrected');

  const archived = staleAgain.body.workspace; const result = M.completeProject(archived, 'book'); assert.equal(result.ok, true); assert.equal(result.planet.flowers.length, 1); assert.equal(result.planet.taskCount, 1);
  const saved = await request('PUT', archived); assert.equal(saved.status, 200); assert.equal(saved.body.workspace.taskGarden.planets[0].flowers[0].plantKind, 'sunflower');
  const beforeDelete = clone(saved.body.workspace), removed = clone(saved.body.workspace); M.deletePlanet(removed, 'book');
  assert.equal((await request('PUT', removed)).status, 200);
  const replay = await request('POST', beforeDelete); assert.equal(replay.status, 200); assert.equal(replay.body.workspace.taskGarden.planets.length, 0);
  assert.equal(replay.body.workspace.taskGarden.deletedPlanets.length, 1);
  assert.equal(G.collection((await request('GET')).body)[1].total, 1);
});

test('HTTP rejects malformed flower data and changes to completed projects without changing disk or backup', async () => {
  const saved = (await request('GET')).body, file = path.join(TMP, 'workspace.json');
  const bytes = fs.readFileSync(file, 'utf8'), backup = fs.readFileSync(file + '.bak', 'utf8');
  const malformed = clone(saved); malformed.taskGarden.seeds[0].ticket = -1;
  assert.equal((await request('PUT', malformed)).status, 500);
  assert.equal(fs.readFileSync(file, 'utf8'), bytes); assert.equal(fs.readFileSync(file + '.bak', 'utf8'), backup);
  const stale = clone(saved); stale.tasks.push({ id: 'late', title: 'Old window new task', projectId: 'book', status: 'todo', createdAt: Date.now(), updatedAt: Date.now() });
  const rejected = await request('PUT', stale); assert.equal(rejected.status, 409); assert.equal(rejected.body.error, 'workspace-stale');
  assert.equal(fs.readFileSync(file, 'utf8'), bytes); assert.equal(fs.readFileSync(file + '.bak', 'utf8'), backup);
  assert.deepEqual((await request('GET')).body, saved);
});

test('HTTP cleanup preserves mature flowers across disk reloads and stale writes until manual harvest', async () => {
  let ws = (await request('GET')).body;
  const project = M.addProject(ws, { name: 'Keep mature flowers' });
  const task = M.addTask(ws, { title: 'A flower to keep', projectId: project.id, status: 'doing' });
  ws = (await request('PUT', ws)).body.workspace;
  M.moveTask(ws, task.id, 'done'); ws = (await request('PUT', ws)).body.workspace;
  const stale = clone(ws), seedBefore = G.active(ws).find(seed => seed.taskId === task.id);
  const harvestCount = G.collection(ws).reduce((sum, row) => sum + row.total, 0);
  assert.equal(M.clearCompletedTasks(ws, project.id).count, 1);
  const cleared = await request('PUT', ws); assert.equal(cleared.status, 200);
  function assertKept(current) {
    assert.equal(M.findTask(current, task.id), null);
    const seed = G.active(current).find(row => row.taskId === task.id);
    assert.ok(seed); assert.equal(seed.state, 'mature'); assert.ok(seed.clearedAt);
    assert.equal(seed.harvestedAt, null); assert.equal(seed.retiredAt, null);
    assert.deepEqual([seed.title, seed.plantKind, seed.ticket, seed.completedAt], [seedBefore.title, seedBefore.plantKind, seedBefore.ticket, seedBefore.completedAt]);
    assert.equal(G.collection(current).reduce((sum, row) => sum + row.total, 0), harvestCount);
  }
  assertKept(cleared.body.workspace); assertKept((await request('GET')).body);
  assertKept(JSON.parse(fs.readFileSync(path.join(TMP, 'workspace.json'), 'utf8')));
  M.updateTask(stale, task.id, { title: 'Old window edit', status: 'doing' });
  for (const method of ['PUT', 'POST']) {
    const replay = await request(method, stale); assert.equal(replay.status, 200); assertKept(replay.body.workspace);
  }
  ws = (await request('GET')).body; G.harvest(ws, task.id);
  const harvested = await request('PUT', ws); assert.equal(harvested.status, 200);
  const receipt = harvested.body.workspace.taskGarden.seeds.find(seed => seed.taskId === task.id);
  const replay = await request('PUT', cleared.body.workspace); assert.equal(replay.status, 200);
  const reloaded = (await request('GET')).body;
  assert.equal(G.active(reloaded).some(seed => seed.taskId === task.id), false);
  assert.equal(reloaded.taskGarden.seeds.find(seed => seed.taskId === task.id).harvestedAt, receipt.harvestedAt);
  assert.equal(G.collection(reloaded).reduce((sum, row) => sum + row.total, 0), harvestCount + 1);
});
