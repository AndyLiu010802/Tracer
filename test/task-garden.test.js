'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const store = require('../lib/store');
const G = require('../public/task-garden');
const S = require('../public/workspace-sync');
const M = require('../skins/tracer/model');
const H = require('../public/task-history');
const clone = value => JSON.parse(JSON.stringify(value));
function workspace() { return M.emptyWorkspace(); }
function started(ws, id = 'task_a', projectId = null, kind = 1, ticket = 2345) {
  const task = { id, title: 'A small step', projectId, status: 'doing', createdAt: 100, updatedAt: 100, doneAt: null, order: 1000 };
  ws.tasks.push(task); G.taskChanged(ws, task, 100, limit => limit === 6 ? kind : ticket); return task;
}
function change(ws, task, status, now) { task.status = status; task.updatedAt = now; task.doneAt = status === 'done' ? now : null; return G.taskChanged(ws, task); }

test('task garden browser mirror is the same implementation as server domain', () => {
  assert.equal(fs.readFileSync(require.resolve('../public/task-garden'), 'utf8'), fs.readFileSync(require.resolve('../skins/tracer/task-garden'), 'utf8'));
});
test('only starting work plants a secure random seed; existing done tasks do not gain retroactive plants', () => {
  const ws = workspace();
  M.addTask(ws, { title: 'Waiting' }); M.addTask(ws, { title: 'Old complete', status: 'done' });
  assert.equal(G.reconcile(ws), false); assert.equal(G.read(ws).seeds.length, 0);
  const task = M.addTask(ws, { title: 'Started', status: 'doing' });
  const seed = G.read(ws).seeds[0]; assert.equal(seed.taskId, task.id); assert.ok(G.KINDS.includes(seed.plantKind)); assert.equal(seed.state, 'growing');
  assert.equal(G.reconcile(ws), false);
});
test('species and rarity are independent, with exactly 1 shiny and 99 ordinary rare tickets', () => {
  const counts = { normal: 0, rare: 0, shiny: 0 };
  for (let i = 0; i < 10000; i++) counts[G.variant(i)]++;
  assert.deepEqual(counts, { normal: 9900, rare: 99, shiny: 1 });
  for (let kind = 0; kind < 6; kind++) {
    const ws = workspace(); started(ws, 't', null, kind, 0); assert.equal(G.read(ws).seeds[0].plantKind, G.KINDS[kind]);
    assert.equal(G.read(ws).seeds[0].variant, 'shiny');
  }
});
test('random draw rejects out-of-range values before modulo and never falls back to Math.random', () => {
  const values = [4294967295, 5]; let calls = 0;
  const ctx = vm.createContext({ crypto: { getRandomValues(buffer) { buffer[0] = values[calls++]; } } });
  vm.runInContext(fs.readFileSync(require.resolve('../public/task-garden'), 'utf8'), ctx);
  assert.equal(ctx.TaskGarden.draw(6), 5); assert.equal(calls, 2);
  const noCrypto = vm.createContext({}); vm.runInContext(fs.readFileSync(require.resolve('../public/task-garden'), 'utf8'), noCrypto);
  assert.throws(() => noCrypto.TaskGarden.draw(6), /Secure random seeds unavailable/);
});
test('withdrawal destroys the visible plant, warns only when destructive, and restarting cannot reroll', () => {
  const ws = workspace(), task = started(ws), original = clone(ws.taskGarden.seeds[0]);
  assert.equal(G.willDestroy(ws, task.id, { status: 'todo' }), true);
  assert.equal(G.willDestroy(ws, task.id, { status: 'review' }), false);
  assert.equal(G.willDestroy(ws, task.id, { delete: true }), true);
  change(ws, task, 'todo', 200); assert.equal(G.active(ws).length, 0); assert.equal(G.withdrawal(ws, task.id, 'todo'), false);
  for (let i = 0; i < 5; i++) { change(ws, task, 'doing', 300 + i * 2); change(ws, task, 'todo', 301 + i * 2); }
  change(ws, task, 'doing', 500);
  assert.equal(G.active(ws).length, 1); assert.equal(ws.taskGarden.seeds.length, 1);
  assert.equal(ws.taskGarden.seeds[0].plantKind, original.plantKind); assert.equal(ws.taskGarden.seeds[0].ticket, original.ticket);
});
test('completion matures and one harvest permanently consumes that task reward across status changes', () => {
  const ws = workspace(), task = started(ws, 't', null, 2, 77);
  assert.equal(G.harvest(ws, task.id, 150), null);
  change(ws, task, 'done', 200); assert.equal(G.active(ws)[0].state, 'mature');
  const first = clone(G.harvest(ws, task.id, 300));
  assert.deepEqual(G.harvest(ws, task.id, 400), first);
  change(ws, task, 'todo', 500); change(ws, task, 'doing', 600); change(ws, task, 'done', 700);
  assert.equal(G.active(ws).length, 0); assert.equal(G.harvest(ws, task.id, 800).harvestedAt, 300);
  assert.deepEqual(G.collection(ws)[2], { plantKind: 'lavender', total: 1, normal: 0, rare: 1, shiny: 0, unlocked: true });
});
test('model transitions hook planting, renaming, moving projects and deletion without mutating harvested snapshots', () => {
  const ws = workspace(), project = M.addProject(ws, { name: 'A' }), second = M.addProject(ws, { name: 'B' });
  const task = M.addTask(ws, { title: 'First', projectId: project.id });
  M.moveTask(ws, task.id, 'doing'); const identity = [ws.taskGarden.seeds[0].plantKind, ws.taskGarden.seeds[0].ticket];
  M.updateTask(ws, task.id, { title: 'Moved', projectId: second.id });
  assert.equal(ws.taskGarden.seeds[0].projectId, second.id); assert.equal(ws.taskGarden.seeds[0].title, 'Moved');
  assert.deepEqual([ws.taskGarden.seeds[0].plantKind, ws.taskGarden.seeds[0].ticket], identity);
  M.moveTask(ws, task.id, 'done'); G.harvest(ws, task.id);
  M.updateTask(ws, task.id, { title: 'Later', projectId: project.id });
  assert.equal(ws.taskGarden.seeds[0].projectId, second.id); assert.equal(ws.taskGarden.seeds[0].title, 'Moved');
});
test('deleted task IDs remain retired and cannot be reused to generate or harvest another plant', () => {
  const ws = workspace(), task = started(ws); M.deleteTask(ws, task.id);
  assert.equal(G.active(ws).length, 0); assert.ok(ws.taskGarden.seeds[0].retiredAt);
  const resurrected = { ...task, status: 'doing', updatedAt: Date.now() + 1000 }; ws.tasks.push(resurrected);
  G.reconcile(ws); assert.equal(G.active(ws).length, 0); assert.equal(G.read(ws).seeds.length, 1);
  M.moveTask(ws, task.id, 'done'); assert.equal(G.harvest(ws, task.id), null);
});
test('clear completed tasks keeps mature flowers growing in place until harvest or project archival', () => {
  const ws = workspace(), project = M.addProject(ws, { name: 'Book' });
  const a = M.addTask(ws, { title: 'Chapter 1', status: 'doing', projectId: project.id });
  const b = M.addTask(ws, { title: 'Chapter 2', projectId: project.id });
  M.moveTask(ws, a.id, 'done'); const result = M.clearCompletedTasks(ws, project.id);
  assert.deepEqual(result, { ok: true, count: 1 }); assert.equal(ws.tasks.length, 1); assert.equal(ws.tasks[0].id, b.id);
  assert.equal(H.completed(ws).length, 1); assert.equal(G.collection(ws).reduce((sum, row) => sum + row.total, 0), 0);
  const flower = G.active(ws).find(seed => seed.taskId === a.id);
  assert.equal(flower.state, 'mature'); assert.equal(flower.harvestedAt, null); assert.equal(flower.retiredAt, null); assert.ok(flower.clearedAt);
  const restored = S.validate(clone(ws)); G.reconcile(restored);
  assert.deepEqual(G.active(restored), G.active(ws));
  M.moveTask(ws, b.id, 'doing'); M.moveTask(ws, b.id, 'done');
  const archived = M.completeProject(ws, project.id); assert.equal(archived.ok, true);
  assert.equal(archived.planet.taskCount, 2); assert.equal(archived.planet.flowers.length, 2);
  assert.equal(M.clearCompletedTasks(ws).count, 0); assert.equal(ws.tasks.length, 1);
});
test('project archival blocks unfinished work and makes a stable collectible snapshot after completion', () => {
  const ws = workspace(), project = M.addProject(ws, { name: 'Spring' }), task = M.addTask(ws, { title: 'One', status: 'doing', projectId: project.id });
  assert.deepEqual(M.completeProject(ws, project.id), { ok: false, reason: 'unfinished' }); assert.equal(project.status, 'active');
  M.moveTask(ws, task.id, 'done'); const result = M.completeProject(ws, project.id); const snapshot = clone(result.planet);
  assert.equal(project.status, 'completed'); assert.equal(snapshot.flowers.length, 1); assert.equal(snapshot.flowers[0].state, 'harvested');
  assert.throws(() => M.updateTask(ws, task.id, { title: 'Renamed later' }), /project-archived/);
  M.updateProject(ws, project.id, { name: 'Different later' });
  assert.deepEqual(M.completeProject(ws, project.id).planet, snapshot);
  const normalized = S.validate(ws); assert.equal(normalized.projects[0].completedAt, snapshot.completedAt); assert.deepEqual(normalized.taskGarden.planets[0], snapshot);
});
test('archived projects reject new tasks and edits atomically before sequence numbers or histories change', () => {
  const ws = workspace(), p = M.addProject(ws, { name: 'Closed' }), t = M.addTask(ws, { title: 'Finished', status: 'doing', projectId: p.id });
  const loose = M.addTask(ws, { title: 'Elsewhere' }); M.moveTask(ws, t.id, 'done'); M.completeProject(ws, p.id);
  const before = JSON.stringify(ws);
  for (const action of [() => M.addTask(ws, { title: 'Late', projectId: p.id }), () => M.moveTask(ws, t.id, 'doing'),
    () => M.updateTask(ws, t.id, { title: 'Changed', projectId: null }), () => M.updateTask(ws, loose.id, { projectId: p.id, title: 'Moved in' })]) {
    assert.throws(action, error => error.code === 'project-archived'); assert.equal(JSON.stringify(ws), before);
  }
});
test('planet removal has a permanent tombstone and retains the plant collection', () => {
  const ws = workspace(), p = M.addProject(ws, { name: 'Keep petals' }), t = M.addTask(ws, { title: 'Done', status: 'doing', projectId: p.id });
  M.moveTask(ws, t.id, 'done'); M.completeProject(ws, p.id); const old = clone(ws);
  assert.equal(M.deletePlanet(ws, p.id), true); assert.equal(M.deletePlanet(ws, p.id), false);
  assert.equal(G.collection(ws).reduce((n, r) => n + r.total, 0), 1);
  assert.equal(S.merge(old, ws, old).workspace.taskGarden.planets.length, 0);
  const stale = clone(old); G.preserve(ws, stale); assert.equal(stale.taskGarden.planets.length, 0);
});
test('deleting an active project retires its plants without deleting independently harvested collection records', () => {
  const ws = workspace(), p = M.addProject(ws, { name: 'Project' });
  const a = M.addTask(ws, { title: 'Growing', status: 'doing', projectId: p.id });
  const b = M.addTask(ws, { title: 'Harvested', status: 'doing', projectId: p.id });
  M.moveTask(ws, b.id, 'done'); G.harvest(ws, b.id); M.deleteProject(ws, p.id);
  assert.equal(G.active(ws).length, 0); assert.ok(ws.taskGarden.seeds.find(s => s.taskId === a.id).retiredAt);
  assert.equal(G.collection(ws).reduce((n, r) => n + r.total, 0), 1);
});
test('deleting a collected project removes private seed content and its planet while retaining anonymous collection counts', () => {
  const ws = workspace(), p = M.addProject(ws, { name: 'Private project title' });
  const task = M.addTask(ws, { title: 'Private task title', status: 'doing', projectId: p.id });
  M.moveTask(ws, task.id, 'done'); M.completeProject(ws, p.id); const stale = clone(ws), totals = G.collection(ws);
  M.deleteProject(ws, p.id);
  function assertForgotten(current) {
    const seed = current.taskGarden.seeds.find(row => row.taskId === task.id);
    assert.equal(seed.title, ''); assert.equal(seed.projectId, null); assert.ok(seed.forgottenAt); assert.ok(seed.harvestedAt);
    assert.deepEqual(G.collection(current), totals); assert.equal(current.taskGarden.planets.length, 0);
    assert.ok(!JSON.stringify(current).includes('Private project title')); assert.ok(!JSON.stringify(current).includes('Private task title'));
  }
  assertForgotten(ws);
  // Even a stale seed with a later edit timestamp cannot restore erased content.
  stale.taskGarden.seeds[0].updatedAt = Date.now() + 100000;
  for (const [local, remote] of [[ws, stale], [stale, ws]]) assertForgotten(S.merge(stale, local, remote).workspace);
  const diskReplay = H.preserve(ws, clone(stale)); G.preserve(ws, diskReplay); assertForgotten(diskReplay);
  const directMerge = G.merge(undefined, ws.taskGarden, stale.taskGarden);
  assert.equal(directMerge.seeds[0].title, ''); assert.equal(directMerge.seeds[0].projectId, null);
});
test('clearing completed tasks keeps their titles for later planets, while deleting a former project preserves moved live tasks', () => {
  const ws = workspace(), a = M.addProject(ws, { name: 'Original' }), b = M.addProject(ws, { name: 'Destination' });
  const cleared = M.addTask(ws, { title: 'Keep this keepsake', status: 'doing', projectId: a.id });
  M.moveTask(ws, cleared.id, 'done'); M.clearCompletedTasks(ws, a.id);
  assert.equal(ws.taskGarden.seeds[0].title, 'Keep this keepsake'); assert.equal(ws.taskGarden.seeds[0].projectId, a.id); assert.equal(ws.taskGarden.seeds[0].forgottenAt, null);
  const moved = M.addTask(ws, { title: 'Moved task content', status: 'doing', projectId: a.id }); M.moveTask(ws, moved.id, 'done'); G.harvest(ws, moved.id);
  M.updateTask(ws, moved.id, { projectId: b.id }); M.deleteProject(ws, a.id);
  assert.equal(M.findTask(ws, moved.id).projectId, b.id); assert.equal(M.findTask(ws, moved.id).title, 'Moved task content');
  const oldKeepsake = ws.taskGarden.seeds.find(row => row.taskId === moved.id);
  assert.equal(oldKeepsake.title, ''); assert.equal(oldKeepsake.projectId, null); assert.ok(oldKeepsake.forgottenAt);
  assert.equal(G.collection(ws).reduce((sum, row) => sum + row.total, 0), 1);
  assert.equal(G.active(ws).length, 0, 'explicit project deletion still removes unharvested flowers');
});

test('cleared mature flowers survive stale edits and can be harvested and sold only once', () => {
  const base = workspace(), task = started(base, 'kept_flower', null, 2, 0);
  change(base, task, 'done', 200); H.record(base, task);
  const cleared = clone(base); M.clearCompletedTasks(cleared);
  assert.equal(G.active(cleared)[0].state, 'mature');
  const stale = clone(base); change(stale, stale.tasks[0], 'doing', Date.now() + 100000);
  stale.tasks[0].title = 'Stale rename'; G.taskChanged(stale, stale.tasks[0]);
  for (const [local, remote] of [[cleared, stale], [stale, cleared]]) {
    const merged = S.merge(base, local, remote).workspace;
    assert.equal(merged.tasks.length, 0, 'cleared task must not return');
    assert.equal(G.active(merged).length, 1);
    assert.equal(G.active(merged)[0].state, 'mature');
    assert.equal(G.active(merged)[0].title, task.title);
    assert.equal(G.active(merged)[0].variant, 'shiny');
  }
  const replay = clone(stale); G.preserve(cleared, replay); G.reconcile(replay);
  assert.equal(replay.tasks.length, 0); assert.equal(G.active(replay)[0].state, 'mature');
  const receipt = clone(G.harvest(replay, task.id));
  assert.deepEqual(G.harvest(replay, task.id), receipt);
  assert.equal(G.collection(replay).reduce((sum, row) => sum + row.total, 0), 1);
  assert.equal(G.active(replay).length, 0);
  assert.equal(G.sell(replay, receipt.plantKind, 1).ok, true);
  assert.equal(G.sell(replay, receipt.plantKind, 1).ok, false);
  const harvestedReplay = clone(cleared); G.preserve(replay, harvestedReplay);
  assert.equal(G.active(harvestedReplay).length, 0);
  assert.deepEqual(G.economy(harvestedReplay), G.economy(replay));
});

test('clearing one project leaves other mature flowers and unfinished dependencies intact', () => {
  const ws = workspace(), project = M.addProject(ws, { name: 'Clear this project' });
  const done = M.addTask(ws, { title: 'Done', status: 'doing', projectId: project.id });
  const waiting = M.addTask(ws, { title: 'Next', projectId: project.id, dependsOn: [done.id] });
  const outside = M.addTask(ws, { title: 'Elsewhere', status: 'doing' });
  M.moveTask(ws, done.id, 'done'); M.moveTask(ws, outside.id, 'done');
  const flowers = G.active(ws).map(seed => seed.taskId).sort();
  assert.equal(M.clearCompletedTasks(ws, project.id).count, 1);
  assert.ok(M.findTask(ws, outside.id)); assert.deepEqual(M.findTask(ws, waiting.id).dependsOn, []);
  assert.deepEqual(G.active(ws).map(seed => seed.taskId).sort(), flowers);
  assert.equal(M.clearCompletedTasks(ws, project.id).count, 0);
  const snapshot = JSON.stringify(ws); assert.equal(M.clearCompletedTasks(ws, project.id).count, 0); assert.equal(JSON.stringify(ws), snapshot);
});
test('three-way merge keeps identities and one harvest despite concurrent status edits', () => {
  const base = workspace(), task = started(base), local = clone(base), remote = clone(base);
  change(local, local.tasks[0], 'done', 200); G.harvest(local, task.id, 300);
  change(remote, remote.tasks[0], 'todo', 400);
  const merged = S.merge(base, local, remote).workspace;
  assert.equal(merged.taskGarden.seeds.length, 1); assert.equal(merged.taskGarden.seeds[0].state, 'harvested');
  assert.equal(G.collection(merged).reduce((n, r) => n + r.total, 0), 1); assert.doesNotThrow(() => S.validate(merged));
});
test('serialized preservation rejects a stale reroll and retains missing harvest data', () => {
  const saved = workspace(), task = started(saved, 't', null, 3, 8000), stale = clone(saved);
  change(saved, task, 'done', 200); G.harvest(saved, task.id, 300);
  stale.taskGarden.seeds[0].plantKind = 'wildflower'; stale.taskGarden.seeds[0].ticket = 0; stale.taskGarden.seeds[0].variant = 'shiny'; stale.taskGarden.seeds[0].updatedAt = 500;
  G.preserve(saved, stale); assert.equal(stale.taskGarden.seeds[0].plantKind, 'apple'); assert.equal(stale.taskGarden.seeds[0].ticket, 8000); assert.equal(stale.taskGarden.seeds[0].harvestedAt, 300);
  const oldClient = clone(saved); delete oldClient.taskGarden; G.preserve(saved, oldClient);
  assert.deepEqual(oldClient.taskGarden, saved.taskGarden);
});
test('server preservation does not let an old client reopen completed projects or revive deleted plants', () => {
  const saved = workspace(), p = M.addProject(saved, { name: 'Archived' }), t = M.addTask(saved, { title: 'Work', status: 'doing', projectId: p.id }), stale = clone(saved);
  M.moveTask(saved, t.id, 'done'); M.completeProject(saved, p.id); assert.throws(() => G.preserve(saved, stale), /workspace-stale/);
  const informed = clone(saved); informed.projects[0].status = 'active'; G.preserve(saved, informed);
  assert.equal(informed.projects[0].status, 'completed'); assert.equal(informed.taskGarden.planets.length, 1);
  const active = workspace(); started(active); const next = clone(active); next.tasks = []; delete next.taskGarden;
  G.preserve(active, next); assert.equal(G.active(next).length, 0); assert.ok(next.taskGarden.seeds[0].retiredAt);
});
test('stale archive recovery preserves draft edits and new tasks outside the frozen project with explicit result markers', () => {
  const base = workspace(), p = M.addProject(base, { name: 'Archive race' }), t = M.addTask(base, { title: 'Completed work', status: 'doing', projectId: p.id });
  const local = clone(base), remote = clone(base);
  M.updateTask(local, t.id, { notes: 'Important draft that must survive' }); const added = M.addTask(local, { title: 'Late new work', projectId: p.id, status: 'doing' });
  M.moveTask(remote, t.id, 'done'); M.completeProject(remote, p.id);
  const result = S.merge(base, local, remote);
  assert.equal(result.conflicts.length, 0); assert.equal(result.relocatedArchivedTasks.length, 1); assert.equal(result.recoveredArchivedTasks.length, 1);
  assert.equal(result.relocatedArchivedTasks[0].taskId, added.id); assert.equal(result.workspace.tasks.find(task => task.id === added.id).projectId, null);
  assert.deepEqual(result.workspace.tasks.find(task => task.id === t.id), remote.tasks.find(task => task.id === t.id));
  const recovered = result.workspace.tasks.find(task => task.id === result.recoveredArchivedTasks[0].taskId);
  assert.equal(recovered.notes, 'Important draft that must survive'); assert.equal(recovered.projectId, null); assert.equal(recovered.status, 'todo');
  assert.doesNotThrow(() => G.preserve(remote, clone(result.workspace)));
  const again = S.merge(base, local, remote); assert.equal(again.recoveredArchivedTasks[0].taskId, recovered.id);
  const resumed = S.merge(remote, result.workspace, remote); assert.equal(resumed.relocatedArchivedTasks.length, 0); assert.equal(resumed.recoveredArchivedTasks.length, 0);
  assert.equal(resumed.workspace.tasks.length, 3); assert.equal(G.collection(resumed.workspace).reduce((n, row) => n + row.total, 0), 1);
});
test('a concurrently planted flower in a deleted project is retired after workspace merge', () => {
  const base = workspace(), p = M.addProject(base, { name: 'Temporary' }), local = clone(base), remote = clone(base);
  M.deleteProject(local, p.id); M.addTask(remote, { title: 'Stale new work', projectId: p.id, status: 'doing' });
  for (const [a, b] of [[local, remote], [remote, local]]) {
    const merged = S.merge(base, a, b).workspace;
    assert.equal(merged.projects.length, 0); assert.equal(merged.tasks.length, 0); assert.equal(G.active(merged).length, 0);
    assert.equal(merged.taskGarden.seeds.length, 1); assert.ok(merged.taskGarden.seeds[0].retiredAt);
  }
});
test('concurrent seed assignments converge and planetary flowers use the accepted immutable identity', () => {
  const saved = workspace(), p = M.addProject(saved, { name: 'World' }); started(saved, 't', p.id, 3, 8000);
  const next = clone(saved); next.taskGarden.seeds = []; G.taskChanged(next, next.tasks[0], 100, limit => limit === 6 ? 0 : 0);
  change(next, next.tasks[0], 'done', 200); M.completeProject(next, p.id, 300);
  G.preserve(saved, next);
  assert.equal(next.taskGarden.seeds[0].plantKind, 'apple'); assert.equal(next.taskGarden.seeds[0].variant, 'normal');
  assert.equal(next.taskGarden.planets[0].flowers[0].plantKind, 'apple'); assert.equal(next.taskGarden.planets[0].flowers[0].variant, 'normal');
});
test('disk writes retain harvested receipts across stale saves and invalid data never replaces the last valid bytes', async t => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tracer-task-garden-'));
  t.after(async () => { const target = path.resolve(dir); assert.equal(path.dirname(target), path.resolve(os.tmpdir())); assert.ok(path.basename(target).startsWith('tracer-task-garden-')); await fsp.rm(target, { recursive: true, force: true }); });
  const ws = workspace(), task = started(ws), stale = clone(ws);
  const save = next => store.writeStore(dir, 'workspace', JSON.stringify(next), (previous, incoming) => G.preserve(previous, H.preserve(previous, incoming)));
  await save(ws); change(ws, task, 'done', 200); G.harvest(ws, task.id, 300);
  await Promise.all([save(ws), save(stale)]);
  const persisted = await store.readStore(dir, 'workspace'); assert.equal(persisted.taskGarden.seeds[0].harvestedAt, 300);
  const priorBytes = await fsp.readFile(path.join(dir, 'workspace.json'), 'utf8'); const bad = clone(persisted); bad.taskGarden.seeds[0].ticket = -1;
  await assert.rejects(save(bad), /Invalid task garden/); assert.equal(await fsp.readFile(path.join(dir, 'workspace.json'), 'utf8'), priorBytes);
});
test('legacy flower import is idempotent, keeps pending harvests and never creates tasks', () => {
  const ws = workspace(), records = [{ projectId: 'old', plantKind: 'cherry', maturedAt: 100, ticket: 0, harvestedAt: null }];
  assert.deepEqual(G.importLegacy(ws, records), { changed: true, imported: 1 });
  assert.deepEqual(G.importLegacy(ws, records), { changed: false, imported: 0 }); assert.equal(ws.tasks.length, 0);
  assert.equal(G.active(ws)[0].taskId, 'legacy-plot-old'); G.harvest(ws, 'legacy-plot-old', 200);
  assert.equal(G.collection(ws)[5].shiny, 1); assert.equal(G.importLegacy(ws, records).changed, false);
  assert.equal(records[0].harvestedAt, null);
});
test('validation rejects invalid rarity, duplicate IDs, bad timestamps and malformed planet snapshots', () => {
  const ws = workspace(); started(ws);
  for (const mutate of [g => g.seeds.push(clone(g.seeds[0])), g => g.seeds[0].ticket = 10000, g => g.seeds[0].variant = 'shiny', g => g.seeds[0].plantedAt = -1,
    g => g.seeds[0].state = 'harvested', g => g.seeds[0].clearedAt = 0, g => g.seeds[0].clearedAt = 200,
    g => { g.seeds[0].clearedAt = 150; g.seeds[0].completedAt = 200; g.seeds[0].state = 'mature'; },
    g => g.deletedPlanets.push({ projectId: 'bad', deletedAt: 0 }), g => g.version = 2]) {
    const bad = clone(ws.taskGarden); mutate(bad); assert.throws(() => G.validate(bad), /Invalid task garden/);
  }
  const raw = clone(ws); raw.taskGarden.seeds[0].ticket = -1; assert.throws(() => S.validate(raw), /Invalid task garden/);
});
