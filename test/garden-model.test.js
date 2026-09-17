'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const G = require('../skins/tracer/garden-model');
const H = require('../skins/tracer/task-history');
const D = require('../skins/tracer/project-deletion');
const F = require('../skins/tracer/focus-model');
const now = new Date(2026, 8, 18, 12).getTime();
const clone = value => JSON.parse(JSON.stringify(value));
const error = code => value => value.code === code && value.message === code;
function workspace() {
  return { projects: [{ id: 'p1', name: 'Write the proposal', status: 'active' }, { id: 'p2', name: 'A second project', status: 'active' }],
    tasks: ['t1', 't2', 't3'].map(id => ({ id, title: 'Task ' + id, projectId: 'p1', status: 'todo', doneAt: null })), notes: [], inbox: [], meta: { rev: 0, seqCounter: 3 } };
}
function complete(ws, taskId, at = now) { const task = ws.tasks.find(task => task.id === taskId); task.status = 'done'; task.doneAt = at; H.record(ws, task); }
function session(id, taskId = 't1', projectId = 'p1', minutes = 25, endedAt = now) {
  return { id, task: taskId === null ? null : { id: taskId, title: 'Focus task', projectId }, minutes, endedAt };
}
function start(ws, focus = { history: [] }) { return G.reconcile(G.plant(G.fresh(), 'p1', 'wildflower', now), ws, focus, now).state; }

test('planting is immutable, accepts three plants, enforces six distinct projects and supports removal', () => {
  const original = G.fresh(); let state = original;
  for (let index = 0; index < 6; index++) state = G.plant(state, 'p' + index, G.plantKinds[index % 3], now);
  assert.deepEqual(original, { v: 1, plots: [] });
  assert.equal(state.plots.length, 6); assert.equal(state.plots[0].initialized, false);
  assert.throws(() => G.plant(state, 'p0', 'lavender', now), error('garden-project-exists'));
  assert.throws(() => G.plant(state, 'another', 'lavender', now), error('garden-full'));
  for (const args of [['../outside', 'wildflower', now], ['valid', 'unknown', now], ['valid', 'sunflower', Infinity]]) {
    assert.throws(() => G.plant(original, ...args), error('invalid-garden-argument'));
  }
  const removed = G.remove(state, 'p1'); assert.equal(removed.plots.length, 5); assert.equal(state.plots.length, 6);
  assert.deepEqual(G.remove(removed, 'absent'), removed);
  const restored = G.read(clone(state)); restored.plots[0].taskIds.push('changed'); assert.equal(state.plots[0].taskIds.length, 0);
});

test('corrupt saved gardens are rejected rather than normalized into an empty or different garden', () => {
  const valid = G.plant(G.fresh(), 'p1', 'lavender', now);
  const invalid = [null, undefined, {}, { v: 2, plots: [] }, { ...valid, unknown: true }, { v: 1, plots: new Array(1) },
    { v: 1, plots: [valid.plots[0], valid.plots[0]] }, { v: 1, plots: Array(7).fill(valid.plots[0]) }];
  for (const changes of [{ plantKind: 'rose' }, { projectId: '' }, { stage: 4 }, { commemoratedAt: now }, { initialized: 'yes' },
    { taskIds: ['t1'] }, { taskIds: ['t1', 't1'], initialized: true, stage: 1 }, { focusIds: ['f1'], initialized: true },
    { focusMinutes: 10 }, { stage: 3 }, { extra: 'do not silently remove me' }, { taskIds: new Array(1) }]) {
    invalid.push({ v: 1, plots: [{ ...valid.plots[0], ...changes }] });
  }
  const ws = workspace(); complete(ws, 't1'); const credited = start(ws);
  invalid.push({ v: 1, plots: [credited.plots[0], { ...credited.plots[0], projectId: 'p2' }] });
  for (const value of invalid) assert.throws(() => G.read(value), error('invalid-garden-state'));
});

test('first planting absorbs genuine existing work silently, then reloads and snapshots without new credit', () => {
  const ws = workspace(); complete(ws, 't1', now - 60000);
  const focus = { history: [session('first', 't1', 'p1', 25, now - 50000), session('second', 't2', 'p1', 25, now - 10000)] };
  const original = G.plant(G.fresh(), 'p1', 'sunflower', now), inputs = clone({ original, ws, focus });
  const result = G.reconcile(original, ws, focus, now);
  assert.equal(result.changed, true); assert.deepEqual(result.events, []);
  assert.equal(result.state.plots[0].stage, 2); assert.equal(result.state.plots[0].focusMinutes, 50);
  assert.deepEqual(result.state.plots[0].taskIds, ['t1']);
  assert.deepEqual({ original, ws, focus }, inputs);
  const restored = G.read(clone(result.state));
  assert.deepEqual(G.reconcile(restored, ws, focus, now), { state: restored, changed: false, events: [] });
  const snapshot = G.snapshot(restored, ws, focus, now);
  assert.equal(snapshot.plots[0].projectName, 'Write the proposal'); assert.equal(snapshot.plots[0].done, 1); assert.equal(snapshot.plots[0].total, 3);
  assert.equal(snapshot.plots[0].completedTasks, 1); assert.equal(snapshot.plots[0].focusMinutes, 50);
  complete(ws, 't2'); assert.equal(G.snapshot(restored, ws, focus, now).plots[0].completedTasks, 1, 'rendering never silently consumes a new event');
});

test('reopening, repeating and undoing one task do not farm growth or reverse previously earned progress', () => {
  const ws = workspace(); let state = start(ws);
  complete(ws, 't1', now + 1);
  let result = G.reconcile(state, ws, {}, now + 1); state = result.state;
  assert.deepEqual(result.events, [{ type: 'task', projectId: 'p1', taskId: 't1', title: 'Task t1', at: now + 1 }]);
  assert.equal(state.plots[0].stage, 1);
  ws.tasks[0].status = 'todo'; ws.tasks[0].doneAt = null;
  assert.equal(G.reconcile(state, ws, {}, now + 2).changed, false);
  complete(ws, 't1', now + 3);
  result = G.reconcile(state, ws, {}, now + 3); assert.deepEqual(result.events, []); assert.deepEqual(result.state.plots[0].taskIds, ['t1']);
  H.undo(ws, 't1', now + 1); H.undo(ws, 't1', now + 3);
  result = G.reconcile(state, ws, {}, now + 4); assert.equal(result.state.plots[0].stage, 1); assert.equal(result.state.plots[0].taskIds.length, 1);
  const freshPlot = start(ws); assert.equal(freshPlot.plots[0].taskIds.length, 0, 'voided history is not credited when first planting');
});

test('completed focus sessions count once while breaks, paused work, overdue dates and input activity give no reward', () => {
  const ws = workspace(); let state = start(ws);
  const focus = F.fresh(); focus.task = { id: 't1', title: 'Task t1', projectId: 'p1' };
  F.start(focus, now, 'focus-one'); F.pause(focus, now + 60000);
  focus.activity = { keys: { a: 100000 }, clicks: 100000, unknown: 100000 };
  assert.equal(G.reconcile(state, ws, focus, now + 60000).changed, false);
  F.start(focus, now + 120000, 'ignored-after-resume'); F.settle(focus, focus.endAt);
  const result = G.reconcile(state, ws, focus, now + 26 * 60000); state = result.state;
  assert.equal(state.plots[0].focusMinutes, 25); assert.equal(state.plots[0].stage, 1);
  assert.equal(result.events.length, 1); assert.equal(result.events[0].type, 'focus'); assert.equal(result.events[0].minutes, 25);
  focus.history.push(clone(focus.history[0]));
  assert.equal(G.reconcile(state, ws, focus, now + 30 * 60000).changed, false);
  F.reset(focus, 'short'); F.start(focus, now + 31 * 60000, 'break-one'); F.settle(focus, focus.endAt);
  ws.tasks[0].due = '2000-01-01';
  assert.equal(G.reconcile(state, ws, focus, now + 24 * 3600000).changed, false);
});

test('focus uses recorded project ownership, explicit unassigned null, and legacy task or completion fallback', () => {
  const ws = workspace(); complete(ws, 't1', now - 1000); ws.tasks[0].status = 'todo'; ws.tasks[0].doneAt = null;
  let state = G.plant(G.plant(G.fresh(), 'p1', 'wildflower', now), 'p2', 'lavender', now);
  state = G.reconcile(state, ws, {}, now).state;
  ws.tasks[0].projectId = 'p2';
  const legacy = session('legacy-current'); delete legacy.task.projectId;
  const deleted = session('legacy-deleted'); delete deleted.task.projectId;
  const focus = { history: [session('recorded-original'), session('explicit-unassigned', 't1', null), legacy] };
  let result = G.reconcile(state, ws, focus, now);
  assert.equal(result.state.plots[0].focusMinutes, 25); assert.equal(result.state.plots[1].focusMinutes, 25);
  assert.deepEqual(result.events.filter(event => event.type === 'focus').map(event => event.projectId), ['p1', 'p2']);
  state = result.state; ws.tasks = ws.tasks.filter(task => task.id !== 't1');
  focus.history = [session('recorded-original'), session('explicit-unassigned', 't1', null), deleted];
  result = G.reconcile(state, ws, focus, now);
  assert.equal(result.state.plots[0].focusMinutes, 50); assert.equal(result.state.plots[1].focusMinutes, 25);
  assert.equal(result.state.plots[0].focusIds.includes('explicit-unassigned'), false);
  assert.equal(result.state.plots[1].focusIds.includes('explicit-unassigned'), false);
});

test('a moved task or legacy focus session cannot be credited twice across two planted projects', () => {
  const ws = workspace();
  let state = G.plant(G.plant(G.fresh(), 'p1', 'wildflower', now), 'p2', 'lavender', now);
  state = G.reconcile(state, ws, {}, now).state;
  complete(ws, 't1', now + 1);
  const legacy = session('same-focus', 't1', 'p1', 25, now + 1); delete legacy.task.projectId;
  state = G.reconcile(state, ws, { history: [legacy] }, now + 1).state;
  ws.tasks[0].projectId = 'p2'; ws.tasks[0].status = 'todo'; ws.tasks[0].doneAt = null;
  complete(ws, 't1', now + 2);
  const result = G.reconcile(state, ws, { history: [legacy] }, now + 2);
  assert.equal(result.state.plots[0].taskIds.length, 1); assert.equal(result.state.plots[1].taskIds.length, 0);
  assert.equal(result.state.plots[0].focusMinutes, 25); assert.equal(result.state.plots[1].focusMinutes, 0);
  assert.equal(result.events.filter(event => event.type !== 'bloom').length, 0);
});

test('project completion blooms once and keeps its date when work is added, reopened or history is truncated', () => {
  const ws = workspace(); let state = start(ws);
  for (const task of ws.tasks) complete(ws, task.id, now + 1);
  const result = G.reconcile(state, ws, {}, now + 5); state = result.state;
  assert.equal(state.plots[0].stage, 4); assert.equal(state.plots[0].commemoratedAt, now + 5);
  assert.equal(result.events.filter(event => event.type === 'bloom').length, 1);
  ws.tasks[0].status = 'todo'; ws.tasks[0].doneAt = null; ws.completionHistory = [];
  ws.tasks.push({ id: 'later', title: 'Newly added work', projectId: 'p1', status: 'todo', doneAt: null });
  const later = G.reconcile(G.read(clone(state)), ws, { history: [] }, now + 1000);
  assert.deepEqual(later.state, state); assert.deepEqual(later.events, []);
  const visible = G.snapshot(later.state, ws, {}, now + 1000).plots[0];
  assert.equal(visible.done, 2); assert.equal(visible.total, 4); assert.equal(visible.stage, 4); assert.equal(visible.completedTasks, 3);
  const alreadyFinished = start({ ...workspace(), tasks: ws.tasks.filter(task => task.status === 'done') });
  assert.equal(alreadyFinished.plots[0].stage, 4);
});

test('an explicitly completed project can bloom with tasks, but an empty project never blooms', () => {
  const ws = workspace(); let state = start(ws);
  ws.projects[0].status = 'done';
  const finished = G.reconcile(state, ws, {}, now + 1);
  assert.equal(finished.state.plots[0].stage, 4); assert.equal(finished.events[0].type, 'bloom');
  ws.tasks = [];
  const empty = G.reconcile(G.plant(G.fresh(), 'p1', 'sunflower', now), ws, {}, now);
  assert.equal(empty.state.plots[0].stage, 0); assert.equal(empty.state.plots[0].commemoratedAt, null); assert.deepEqual(empty.events, []);
});

test('deleted projects and deletion markers remove plots without reviving stale content or touching other projects', () => {
  const ws = workspace(); let state = G.plant(G.plant(G.fresh(), 'p1', 'wildflower', now), 'p2', 'lavender', now);
  state = G.reconcile(state, ws, {}, now).state;
  const deleted = clone(ws); deleted.projectDeletions = [{ id: 'p1', taskIds: ['t1', 't2', 't3'] }];
  const before = clone({ state, deleted });
  const result = G.reconcile(state, deleted, { history: [session('stale-focus')] }, now);
  assert.deepEqual(result.state.plots.map(plot => plot.projectId), ['p2']); assert.equal(result.changed, true); assert.deepEqual(result.events, []);
  assert.deepEqual({ state, deleted }, before);
  assert.deepEqual(G.snapshot(state, deleted, {}, now).plots.map(plot => plot.projectId), ['p2']);
  assert.deepEqual(G.reconcile(result.state, ws, {}, now).state, result.state, 'a later stale snapshot never automatically replants a removed project');
  assert.deepEqual(G.reconcile(G.plant(result.state, 'p1', 'sunflower', now), deleted, {}, now).state, result.state, 'tombstones reject a stale replant');
  const missing = clone(ws); missing.projects = missing.projects.filter(project => project.id !== 'p1');
  assert.deepEqual(G.reconcile(state, missing, {}, now).state.plots.map(plot => plot.projectId), ['p2']);
});

test('growth survives truncated histories and advances through the effort stages independently of current task totals', () => {
  const ws = workspace(); let state = start(ws);
  for (let index = 1; index <= 6; index++) {
    const result = G.reconcile(state, ws, { history: [session('focus-' + index, 't1', 'p1', 25, now + index)] }, now + index);
    state = result.state;
    assert.equal(state.plots[0].stage, index >= 6 ? 3 : index >= 3 ? 2 : 1);
    assert.equal(state.plots[0].focusMinutes, index * 25);
  }
  const future = { history: [session('future-focus', 't1', 'p1', 25, now + 1000)] };
  complete(ws, 't1', now + 1000);
  assert.equal(G.reconcile(state, ws, future, now + 10).changed, false, 'future timestamps are not current accomplishments');
  assert.equal(G.reconcile(state, ws, { history: [] }, now + 10).state.plots[0].stage, 3);
});

test('today uses local calendar boundaries, counts unique tasks and includes unassigned focus without growing a plot', () => {
  const midnight = new Date(2026, 8, 18, 0).getTime(), ws = workspace();
  complete(ws, 't1', midnight - 1); complete(ws, 't1', midnight + 1); complete(ws, 't1', midnight + 2);
  complete(ws, 't2', midnight - 1);
  const unassigned = session('today-unassigned', null, null, 15, midnight + 1);
  const focus = { history: [session('yesterday', 't1', 'p1', 25, midnight - 1), unassigned, clone(unassigned), session('future', 't1', 'p1', 25, now + 1)] };
  const state = start(ws, focus), visible = G.snapshot(state, ws, focus, now);
  assert.deepEqual(visible.today, { completedTasks: 1, focusMinutes: 15 });
  assert.equal(state.plots[0].focusMinutes, 25);
});

test('malformed live context cannot erase a saved plot, and conflicting duplicate focus records are rejected', () => {
  const ws = workspace(), state = start(ws), before = clone(state);
  const invalid = [null, {}, { ...ws, tasks: null }, { ...ws, projects: [ws.projects[0], ws.projects[0]] },
    { ...ws, tasks: [ws.tasks[0], ws.tasks[0]] }, { ...ws, completionHistory: [{ taskId: 'bad' }] },
    { ...ws, projectDeletions: [{ id: 'p1', taskIds: ['../bad'] }] }];
  for (const context of invalid) assert.throws(() => G.reconcile(state, context, {}, now), error('invalid-garden-context'));
  for (const history of [[session('one', 't1', 'p1', 181)], [session('one'), session('one', 't1', 'p1', 20)],
    [session('one', 't1', 'p1'), session('one', 't1', 'p2')], [{ ...session('one'), task: { id: 't1', projectId: '' } }]]) {
    assert.throws(() => G.reconcile(state, ws, { history }, now), error('invalid-garden-context'));
  }
  assert.deepEqual(state, before);
});

test('receipt limits fail atomically instead of dropping old IDs and crediting them twice later', () => {
  const ws = workspace();
  for (const kind of ['task', 'focus']) {
    const state = start(ws), plot = state.plots[0];
    plot[kind + 'Ids'] = Array.from({ length: 10000 }, (_, index) => kind + '-old-' + index); plot.stage = 3;
    if (kind === 'focus') plot.focusMinutes = 10000;
    const before = clone(state), input = clone(ws);
    if (kind === 'task') complete(input, 't1');
    const focus = kind === 'focus' ? { history: [session('one-more')] } : {};
    assert.throws(() => G.reconcile(state, input, focus, now), error('garden-history-limit'));
    assert.deepEqual(state, before); assert.deepEqual(G.read(clone(state)), state);
    plot[kind + 'Ids'].push('excess'); assert.throws(() => G.read(state), error('invalid-garden-state'));
  }
});

test('browser UMD and Node share the same pure garden state and snapshot contract', () => {
  const context = vm.createContext({ TaskHistory: H, ProjectDeletion: D });
  vm.runInContext(fs.readFileSync(require.resolve('../skins/tracer/garden-model'), 'utf8'), context);
  const browser = context.TracerGardenModel, ws = workspace();
  const state = browser.plant(browser.fresh(), 'p1', 'lavender', now);
  const result = browser.reconcile(state, ws, {}, now);
  assert.deepEqual(clone(result.state), G.reconcile(G.plant(G.fresh(), 'p1', 'lavender', now), ws, {}, now).state);
  assert.deepEqual(clone(browser.snapshot(result.state, ws, {}, now)), G.snapshot(clone(result.state), ws, {}, now));
});
