'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Guide = require('../skins/tracer/getting-started-model');
const M = require('../skins/tracer/model');
const Garden = require('../public/task-garden');
const Focus = require('../skins/tracer/focus-model');
const clone = value => JSON.parse(JSON.stringify(value));
const stateFor = task => ({ version: 1, mode: 'active', taskId: task.id, focused: false });

test('auto-guide is restricted to an unused workspace, including retained histories', () => {
  assert.equal(Guide.isNewWorkspace(null), false);
  assert.equal(Guide.isNewWorkspace(M.emptyWorkspace()), true);
  const variants = [
    { tasks: [{ id: 'task' }] }, { projects: [{ id: 'project' }] }, { notes: [{ id: 'note' }] }, { inbox: [{ id: 'inbox' }] },
    { meta: { seqCounter: 2, rev: 0 } }, { meta: { seqCounter: 0, rev: 3 } },
    { completionHistory: [{ taskId: 'removed' }] }, { projectDeletions: [{ id: 'removed' }] },
    { taskGarden: { seeds: [{ taskId: 'removed' }] } }, { taskGarden: { planets: [{ id: 'archived' }] } },
    { taskGarden: { deletedPlanets: ['removed'] } }
  ];
  for (const value of variants) assert.equal(Guide.isNewWorkspace({ ...M.emptyWorkspace(), ...value }), false, JSON.stringify(value));
});

test('unknown preferences do not activate a tour or adopt arbitrary properties', () => {
  assert.equal(Guide.read({ version: 2, mode: 'active' }), null);
  assert.equal(Guide.read({ version: 1, mode: 'something-else' }), null);
  assert.deepEqual(Guide.read({ version: 1, mode: 'dismissed', taskId: 5, focused: 'true', extra: 'ignore' }),
    { version: 1, mode: 'dismissed', taskId: '', focused: false });
});

test('creating or completing a task only advances saved progress after acceptance', () => {
  const ws = M.emptyWorkspace(), base = clone(ws);
  const task = M.addTask(ws, { title: 'Write the first paragraph', status: 'doing' });
  const state = stateFor(task);
  assert.equal(ws.taskGarden.seeds.length, 1);
  assert.equal(Guide.progress(ws, base, state).saved, false);
  const accepted = clone(ws);
  assert.equal(Guide.progress(ws, accepted, state).saved, true);
  M.updateTask(ws, task.id, { status: 'done' });
  assert.equal(Guide.progress(ws, accepted, state).complete, false, 'optimistic local completion is not a saved harvest');
  assert.equal(Guide.progress(ws, accepted, state).saved, false);
  assert.equal(Guide.progress(ws, clone(ws), state).complete, true);
  M.updateTask(ws, task.id, { status: 'doing' });
  assert.equal(Guide.progress(ws, accepted, state).complete, false, 'undo returns the guide to the active task');
});

test('opening a timer and working on another task do not count as this task focus', () => {
  const focus = Focus.fresh();
  focus.task = { id: 'first', title: 'First' };
  assert.equal(Guide.hasFocused(focus, 'first'), false);
  Focus.start(focus, 1000, 'session-first');
  assert.equal(Guide.hasFocused(focus, 'first'), true);
  assert.equal(Guide.hasFocused(focus, 'second'), false);
  Focus.pause(focus, 2000);
  assert.equal(Guide.hasFocused(focus, 'first'), true);
  Focus.start(focus, 3000, 'unused');
  Focus.settle(focus, 3000 + focus.duration);
  Focus.reset(focus, 'short');
  assert.equal(Guide.hasFocused(focus, 'first'), true, 'completed session still counts through history');
  assert.equal(Guide.hasFocused({ ...focus, history: [], runId: 'break', running: true }, 'first'), false, 'break is not focus');
});

test('cleared completed cards still lead to the saved flower without recreating tasks', () => {
  const ws = M.emptyWorkspace();
  const task = M.addTask(ws, { title: 'Finish the draft', status: 'doing' });
  M.updateTask(ws, task.id, { status: 'done' });
  const state = { ...stateFor(task), focused: true };
  ws.tasks = [];
  const result = Guide.progress(ws, clone(ws), state);
  assert.equal(result.task, null);
  assert.equal(result.complete, true);
  assert.equal(result.focused, true);
  assert.equal(ws.tasks.length, 0);
  Garden.harvest(ws, task.id);
  assert.equal(Guide.progress(ws, clone(ws), state).complete, true);
});

test('deleted tasks and destroyed plants do not keep a false completed guide', () => {
  const ws = M.emptyWorkspace();
  const task = M.addTask(ws, { title: 'A task', status: 'doing' });
  const state = { ...stateFor(task), focused: true };
  ws.tasks = [];
  const result = Guide.progress(ws, clone(ws), state);
  assert.equal(result.task, null);
  assert.equal(result.complete, false);
  assert.equal(result.focused, false);
  ws.taskGarden.seeds[0].state = 'destroyed';
  ws.taskGarden.seeds[0].completedAt = 1234;
  assert.equal(Guide.progress(ws, clone(ws), state).complete, false);
});

test('a project archived outside the guide becomes read-only for guide actions', () => {
  const ws = M.emptyWorkspace();
  ws.projects.push({ id: 'project', name: 'Project', status: 'active' });
  const task = M.addTask(ws, { title: 'A task', status: 'doing', projectId: 'project' });
  ws.projects[0].status = 'completed';
  assert.equal(Guide.progress(ws, clone(ws), stateFor(task)).archived, true);
});

test('the next-task transition requires the tracked flower harvest to be accepted', () => {
  const ws = M.emptyWorkspace();
  const first = M.addTask(ws, { title: 'First task', status: 'doing' });
  const other = M.addTask(ws, { title: 'Another task', status: 'doing' });
  M.updateTask(ws, first.id, { status: 'done' });
  M.updateTask(ws, other.id, { status: 'done' });
  const state = stateFor(first), beforeHarvest = clone(ws);
  assert.equal(Guide.progress(ws, beforeHarvest, state).harvested, false);
  Garden.harvest(ws, other.id);
  assert.equal(Guide.progress(ws, clone(ws), state).harvested, false, 'an unrelated flower cannot finish this guide');
  Garden.harvest(ws, first.id);
  assert.equal(Guide.progress(ws, beforeHarvest, state).harvested, false, 'an unsaved harvest must not reset the input flow');
  const accepted = clone(ws);
  assert.equal(Guide.progress(ws, accepted, state).harvested, true);
  ws.tasks = [];
  assert.equal(Guide.progress(ws, accepted, state).harvested, true, 'a retained flower still completes the flow after card cleanup');
  const next = M.addTask(ws, { title: 'Next task', status: 'doing' });
  assert.equal(Guide.progress(ws, accepted, stateFor(next)).harvested, false, 'the next task never inherits the previous harvest');
});
