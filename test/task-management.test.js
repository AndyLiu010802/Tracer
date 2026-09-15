'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../skins/tracer/model');

test('completion dates track create, complete, reorder and reopen', () => {
  const ws = M.emptyWorkspace();
  const task = M.addTask(ws, { title: 'Ship', status: 'done' });
  assert.ok(task.doneAt);
  assert.equal(M.weeklyCompletions(ws, 1)[0].count, 1);
  const completed = task.doneAt;
  M.updateTask(ws, task.id, { status: 'done', notes: 'Verified' });
  M.moveTask(ws, task.id, 'done', null);
  assert.equal(task.doneAt, completed);
  M.updateTask(ws, task.id, { status: 'doing' });
  assert.equal(task.doneAt, null);
  assert.equal(M.weeklyCompletions(ws, 1)[0].count, 0);
  M.updateTask(ws, task.id, { status: 'done' });
  assert.ok(task.doneAt);
  M.moveTask(ws, task.id, 'invalid', null);
  assert.equal(task.status, 'done');
});

test('search, project, priority and due filters combine without altering workspace', () => {
  const ws = M.emptyWorkspace();
  const a = M.addTask(ws, { title: 'Release', notes: 'Check API', projectId: 'p1', priority: 'high', due: '2026-09-14' });
  M.addTask(ws, { title: 'API review', projectId: 'p2', due: '2026-09-15' });
  M.addTask(ws, { title: 'Release done', status: 'done', due: '2026-09-14' });
  const before = JSON.stringify(ws);
  assert.deepEqual(M.filterTasks(ws, { query: ' api ', projectId: 'p1', priority: 'high', due: 'overdue', today: '2026-09-15' }), [a]);
  assert.deepEqual(M.filterTasks(ws, { query: a.seq.toLowerCase() }), [a]);
  assert.equal(M.filterTasks(ws, { due: 'today', today: '2026-09-15' }).length, 1);
  assert.equal(M.filterTasks(ws, { due: 'overdue', today: '2026-09-15' }).length, 1);
  assert.equal(JSON.stringify(ws), before);
});

test('planned and due dates can be saved and cleared for existing tasks', () => {
  const ws = M.emptyWorkspace();
  const task = M.addTask(ws, { title: 'Plan' });
  M.updateTask(ws, task.id, { scheduled: '2026-09-16', due: '2026-09-17' });
  assert.deepEqual(M.tasksOnDay(ws, '2026-09-16'), [task]);
  assert.equal(M.taskDueState(task, '2026-09-15'), 'upcoming');
  M.updateTask(ws, task.id, { scheduled: null, due: null });
  assert.deepEqual(M.unscheduledTasks(ws), [task]);
  assert.equal(M.taskDueState(task), '');
});
