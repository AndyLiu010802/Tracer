'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../skins/tracer/model');
const S = require('../public/workspace-sync');

test('task timeline uses schedule and deadline, including one-day and partial dates', () => {
  const span = { start: '2026-09-21', end: '2026-09-24' };
  assert.deepEqual(M.taskTimelineRange({ scheduled: span.start, due: span.end }), span);
  for (const fields of [{ scheduled: span.start }, { due: span.start }, { scheduled: span.start, due: span.start }]) {
    assert.deepEqual(M.taskTimelineRange(fields), { start: span.start, end: span.start });
  }
  assert.equal(M.taskTimelineRange({}), null);
  assert.equal(M.taskTimelineRange({ scheduled: '2026-02-30', due: 'invalid' }), null);
  assert.deepEqual(M.taskTimelineRange({ scheduled: span.end, due: span.start }), span);
});

test('completed tasks without a deadline use their local completion date, not creation time', () => {
  const task = { status: 'done', scheduled: '2026-09-21', doneAt: new Date(2026, 8, 24, 23, 30).getTime() };
  assert.deepEqual(M.taskTimelineRange(task), { start: '2026-09-21', end: '2026-09-24' });
  assert.equal(M.taskTimelineRange({ ...task, due: '2026-09-25' }).end, '2026-09-25');
  assert.equal(M.taskTimelineRange({ ...task, status: 'todo' }).end, '2026-09-21');
  assert.equal(M.taskTimelineRange({ createdAt: task.doneAt }), null);
});

test('automatic project dates track task edits, moves and deletions without changing stored records', () => {
  const ws = M.emptyWorkspace(), p = M.addProject(ws, { name: 'Reset' }), other = M.addProject(ws, { name: 'Other' });
  M.updateProject(ws, p.id, { start: '2026-01-01', end: '2026-12-31' });
  const a = M.addTask(ws, { title: 'Early task', projectId: p.id, scheduled: '2026-09-21', due: '2026-09-22' });
  const b = M.addTask(ws, { title: 'Late task', projectId: p.id, scheduled: '2026-09-23', due: '2026-09-27' });
  M.addTask(ws, { title: 'Undated', projectId: p.id });
  M.addTask(ws, { title: 'Unrelated', projectId: other.id, scheduled: '2027-01-01' });
  const before = JSON.stringify(ws);
  assert.deepEqual(M.projectTimelineRange(ws, p.id), { start: '2026-09-21', end: '2026-09-27', mode: 'auto' });
  assert.equal(JSON.stringify(ws), before);
  M.updateTask(ws, b.id, { due: '2026-10-02' });
  assert.equal(M.projectTimelineRange(ws, p.id).end, '2026-10-02');
  M.updateTask(ws, a.id, { projectId: other.id });
  assert.equal(M.projectTimelineRange(ws, p.id).start, '2026-09-23');
  M.deleteTask(ws, b.id);
  assert.deepEqual(M.projectTimelineRange(ws, p.id), { start: '2026-01-01', end: '2026-12-31', mode: 'manual' });
  M.updateProject(ws, p.id, { timelineMode: 'auto', start: null, end: null });
  assert.equal(M.projectTimelineRange(ws, p.id), null);
});

test('manual project dates persist through normalization and merge until auto is restored', () => {
  const base = M.emptyWorkspace(), p = M.addProject(base, { name: 'Reset' });
  const task = M.addTask(base, { title: 'Task', projectId: p.id, scheduled: '2026-09-21', due: '2026-09-25' });
  const local = S.clone(base), remote = S.clone(base);
  M.updateProject(local, p.id, { timelineMode: 'manual', start: '2026-09-20', end: '2026-09-22' });
  M.updateTask(remote, task.id, { due: '2026-10-02' });
  const merged = S.merge(base, local, remote);
  assert.equal(merged.conflicts.length, 0);
  const saved = S.validate(JSON.parse(JSON.stringify(merged.workspace)));
  assert.deepEqual(M.projectTimelineRange(saved, p.id), { start: '2026-09-20', end: '2026-09-22', mode: 'manual' });
  assert.equal(M.taskTimelineRange(saved.tasks[0]).end, '2026-10-02');
  M.updateProject(saved, p.id, { timelineMode: 'auto', start: null, end: null });
  assert.deepEqual(M.projectTimelineRange(S.validate(saved), p.id), { start: '2026-09-21', end: '2026-10-02', mode: 'auto' });
  saved.projects[0].timelineMode = 'invalid';
  assert.throws(() => S.validate(saved), /Invalid timeline mode/);
});

test('automatic mode handles leap days, DST boundaries and empty projects', () => {
  const ws = M.emptyWorkspace(), p = M.addProject(ws, { name: 'Dates' });
  assert.equal(M.projectTimelineRange(ws, p.id), null);
  assert.equal(M.projectTimelineRange(ws, 'missing'), null);
  const task = M.addTask(ws, { title: 'Task', projectId: p.id, scheduled: '2028-02-29', due: '2028-03-01' });
  assert.equal(M.daysBetween(M.taskTimelineRange(task).start, M.taskTimelineRange(task).end), 1);
  M.updateTask(ws, task.id, { scheduled: '2026-10-03', due: '2026-10-05' });
  assert.equal(M.daysBetween(M.taskTimelineRange(task).start, M.taskTimelineRange(task).end), 2);
});
