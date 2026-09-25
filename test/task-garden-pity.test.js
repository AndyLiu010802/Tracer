'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const G = require('../public/task-garden'), M = require('../skins/tracer/model');
const Store = require('../lib/store'), S = require('../public/workspace-sync');
const clone = value => structuredClone(value);
function plant(ws, index, ticket = 9999) {
  const at = 1000 + index * 10;
  const task = { id: 'pity_' + String(index).padStart(4, '0'), title: 'Step ' + index, projectId: null,
    status: 'doing', createdAt: at, updatedAt: at, doneAt: null, order: index };
  ws.tasks.push(task); G.taskChanged(ws, task, at, limit => limit === 10000 ? ticket : 0);
  return task;
}
function finish(ws, task, at = task.createdAt + 1) {
  task.status = 'done'; task.updatedAt = at; task.doneAt = at;
  return G.taskChanged(ws, task, at);
}
function series(count) {
  const ws = M.emptyWorkspace();
  for (let i = 1; i <= count; i++) finish(ws, plant(ws, i));
  return ws;
}

test('30th first completion guarantees a companion, 150th guarantees shiny, and both repeat after resetting', () => {
  const ws = M.emptyWorkspace();
  for (let i = 1; i <= 300; i++) {
    const task = plant(ws, i), before = G.pity(ws), seed = finish(ws, task);
    assert.equal(seed.variant, i % 150 === 0 ? 'shiny' : i % 30 === 0 ? 'rare' : 'normal', 'completion ' + i);
    assert.equal(G.pity(ws).companion, i % 30);
    assert.equal(G.pity(ws).shiny, i % 150);
    if (i % 30 === 0) assert.equal(before.companionRemaining, 1);
    assert.equal(seed.plantKind, 'wildflower');
  }
  assert.deepEqual(G.pity(S.validate(clone(ws))), { companion: 0, shiny: 0, companionRemaining: 30, shinyRemaining: 150 });
});

test('early random companions reset only their own guarantee, while a random shiny resets both', () => {
  const ws = series(16);
  assert.equal(finish(ws, plant(ws, 17, 50)).variant, 'rare');
  assert.deepEqual(G.pity(ws), { companion: 0, shiny: 17, companionRemaining: 30, shinyRemaining: 133 });
  for (let i = 18; i <= 40; i++) assert.equal(finish(ws, plant(ws, i)).variant, 'normal');
  assert.equal(finish(ws, plant(ws, 41, 0)).variant, 'shiny');
  assert.equal(G.pity(ws).shinyRemaining, 150);
  for (let i = 42; i <= 190; i++) assert.notEqual(finish(ws, plant(ws, i)).variant, 'shiny');
  assert.equal(finish(ws, plant(ws, 191)).variant, 'shiny');
});

test('only first completions count, in completion order, across projects and farms', () => {
  const ws = M.emptyWorkspace(), tasks = [];
  ws.taskGarden = G.empty();
  ws.taskGarden.market.testCredit = { id: 'test', amount: 1000, updatedAt: 1 };
  G.buyFarm(ws, 'cyber', 2);
  for (let i = 1; i <= 60; i++) {
    if (i === 31) G.equipFarm(ws, 'cyber', 3);
    const task = plant(ws, i); task.projectId = i % 2 ? 'project_a' : 'project_b'; tasks.push(task);
  }
  assert.equal(G.pity(ws).companion, 0, 'starting tasks does not consume progress');
  tasks.reverse().forEach((task, index) => {
    const seed = finish(ws, task, 10000 + index);
    assert.equal(seed.variant, (index + 1) % 30 === 0 ? 'rare' : 'normal');
  });
  const task = tasks[0], first = clone(ws.taskGarden.seeds.find(s => s.taskId === task.id)), progress = G.pity(ws);
  for (let i = 0; i < 3; i++) {
    task.status = 'doing'; task.updatedAt = 11000 + i * 2; G.taskChanged(ws, task);
    finish(ws, task, 11001 + i * 2);
  }
  assert.equal(ws.taskGarden.seeds.find(s => s.taskId === task.id).completedAt, first.completedAt);
  G.harvest(ws, task.id, 12000); G.harvest(ws, task.id, 12001);
  M.deleteTask(ws, task.id);
  assert.deepEqual(G.pity(ws), progress, 'harvesting and deleting do not erase or repeat progress');
});

test('a same-millisecond batch awards the thirtieth completed task, not an earlier task sorted by ID', () => {
  const ws = M.emptyWorkspace(), tasks = Array.from({length:30}, (_, i) => plant(ws, i + 1)).reverse();
  for (const [index, task] of tasks.entries()) assert.equal(finish(ws, task, 10000).variant, index === 29 ? 'rare' : 'normal');
  assert.equal(ws.taskGarden.seeds.filter(s => s.variant === 'rare')[0].taskId, tasks[29].id);
});

test('legacy completed tasks contribute progress without changing old rewards, imported project memories do not', () => {
  const ws = series(149);
  ws.taskGarden.seeds.forEach(seed => { delete seed.pityVersion; seed.ticket = 9999; seed.variant = 'normal'; });
  const old = clone(ws.taskGarden.seeds);
  assert.equal(G.pity(ws).shinyRemaining, 1);
  assert.deepEqual(ws.taskGarden.seeds, old, 'reading progress never awards retroactive rewards');
  assert.equal(finish(ws, plant(ws, 150)).variant, 'shiny');
  assert.deepEqual(ws.taskGarden.seeds.slice(0, 149), old);
  const imported = M.emptyWorkspace();
  G.importLegacy(imported, [{ projectId: 'old', plantKind: 'wildflower', maturedAt: 100, harvestedAt: 200, ticket: 9999 }]);
  assert.equal(imported.taskGarden.seeds.length, 1);
  assert.equal(G.pity(imported).companion, 0);
});

test('concurrent completions reconcile one shared guarantee, and stale writes cannot remove it or reroll accepted seeds', () => {
  const base = series(28), a = plant(base, 29), b = plant(base, 30);
  const local = clone(base), remote = clone(base);
  finish(local, local.tasks.find(t => t.id === a.id)); finish(remote, remote.tasks.find(t => t.id === b.id));
  assert.equal(G.pity(local).companion, 29); assert.equal(G.pity(remote).companion, 29);
  const merged = G.merge(base.taskGarden, local.taskGarden, remote.taskGarden);
  assert.deepEqual(G.merge(base.taskGarden, remote.taskGarden, local.taskGarden), merged);
  assert.equal(merged.seeds.find(s => s.taskId === b.id).variant, 'rare');
  const accepted = clone(base); accepted.taskGarden = merged;
  const stale = clone(local); G.preserve(accepted, stale);
  assert.equal(stale.taskGarden.seeds.find(s => s.taskId === b.id).variant, 'rare');
  assert.equal(G.pity(stale).companion, 0);
  const forged = clone(stale); forged.taskGarden.seeds[0].ticket = 0; forged.taskGarden.seeds[0].variant = 'shiny';
  G.preserve(stale, forged); assert.equal(forged.taskGarden.seeds[0].variant, 'normal');
});

test('serialized save and reload retain a completion guarantee and recover it for older clients', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracer-garden-pity-'));
  t.after(async () => { assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir())); await fs.rm(dir, {recursive:true,force:true}); });
  const save = value => Store.writeStore(dir, 'workspace', JSON.stringify(value), (old, next) => G.preserve(old, next));
  const ws = series(29), task = plant(ws, 30); await save(ws);
  const before = clone(ws);
  assert.equal(finish(ws, task).variant, 'rare'); await save(ws);
  let loaded = await Store.readStore(dir, 'workspace');
  assert.equal(loaded.taskGarden.seeds.at(-1).variant, 'rare');
  await save(before); loaded = await Store.readStore(dir, 'workspace');
  assert.equal(loaded.taskGarden.seeds.at(-1).variant, 'rare'); assert.equal(G.pity(loaded).companion, 0);
  const oldClient = clone(loaded); oldClient.taskGarden.seeds.forEach(s => delete s.pityVersion);
  await save(oldClient); loaded = await Store.readStore(dir, 'workspace');
  assert.equal(loaded.taskGarden.seeds.at(-1).pityVersion, 1);
});

test('invalid guarantee metadata cannot bypass garden validation', () => {
  const ws = series(1);
  for (const value of [0,2,'1',null]) {
    const raw = clone(ws.taskGarden); raw.seeds[0].pityVersion = value;
    assert.throws(() => G.validate(raw), /Invalid task garden/);
  }
  const growing = M.emptyWorkspace(); plant(growing, 1); growing.taskGarden.seeds[0].pityVersion = 1;
  assert.throws(() => G.validate(growing.taskGarden), /Invalid task garden/);
});
