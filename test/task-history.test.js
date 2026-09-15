'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const H = require('../public/task-history');
const M = require('../skins/tracer/model');
const S = require('../public/workspace-sync');
const A = require('../skins/tracer/insights-model');
const store = require('../lib/store');

test('completion snapshots survive rename, reopening, re-completion and deletion', () => {
  const ws = M.emptyWorkspace(), t = M.addTask(ws, { title: 'Original', assignee: 'Alex' });
  M.updateTask(ws, t.id, { title: 'Ready', status: 'done', assignee: 'Sam' });
  const first = H.completed(ws)[0]; assert.equal(first.title, 'Ready'); assert.equal(first.assignee, 'Sam');
  M.updateTask(ws, t.id, { title: 'Renamed' }); M.moveTask(ws, t.id, 'doing');
  assert.equal(H.completed(ws).length, 1); assert.equal(H.completed(ws)[0].title, 'Ready');
  M.moveTask(ws, t.id, 'done'); assert.equal(H.completed(ws).length, 2);
  M.moveTask(ws, t.id, 'done'); assert.equal(H.completed(ws).length, 2);
  M.deleteTask(ws, t.id); assert.equal(H.completed(JSON.parse(JSON.stringify(ws))).length, 2);
});

test('legacy done dates backfill once and undated tasks never get fabricated dates', () => {
  const ws = M.emptyWorkspace(); ws.tasks = [{ id: 'old', seq: 'TRC-1', title: 'Old task', status: 'done', doneAt: 1750000000000 }, { id: 'missing', title: 'No date', status: 'done' }];
  assert.equal(H.ensure(ws), true); assert.equal(H.ensure(ws), false); assert.equal(H.completed(ws).length, 1);
  M.deleteTask(ws, 'old'); assert.equal(H.completed(ws).length, 1);
});

test('undo keeps an audit cancellation and excludes the accidental completion after merges', () => {
  const ws = M.emptyWorkspace(), t = M.addTask(ws, { title: 'Undo me' });
  M.moveTask(ws, t.id, 'done'); const stale = S.clone(ws);
  H.undo(ws, t.id, t.doneAt); t.status = 'todo'; t.doneAt = null;
  const merged = S.merge(stale, ws, stale).workspace;
  assert.equal(H.completed(merged).length, 0); assert.equal(merged.completionHistory.length, 2);
  M.moveTask(merged, t.id, 'done'); assert.equal(H.completed(merged).length, 1);
});

test('independent history entries merge and validation keeps snapshots for deleted tasks', () => {
  const base = M.emptyWorkspace(), a = S.clone(base), b = S.clone(base);
  M.addTask(a, { title: 'A', status: 'done' }); M.addTask(b, { title: 'B', status: 'done' });
  const merged = S.merge(base, a, b).workspace; merged.tasks = [];
  const validated = S.validate(merged); assert.equal(H.completed(validated).length, 2);
  assert.throws(() => H.validate([{ ...validated.completionHistory[0], id: 'fake' }]), /Invalid/);
});

test('serialized disk writes preserve history when an older client omits it or deletes tasks', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracer-history-')); t.after(() => fs.rm(dir, { force: true, recursive: true }));
  const ws = M.emptyWorkspace(); M.addTask(ws, { title: 'Durable', status: 'done' });
  await store.writeStore(dir, 'workspace', JSON.stringify(ws), H.preserve);
  await Promise.all([store.writeStore(dir, 'workspace', JSON.stringify(M.emptyWorkspace()), H.preserve), store.writeStore(dir, 'workspace', JSON.stringify(M.emptyWorkspace()), H.preserve)]);
  const saved = await store.readStore(dir, 'workspace'); assert.equal(saved.tasks.length, 0); assert.equal(H.completed(saved).length, 1);
});

test('date filters are inclusive local calendar dates and repeated events have a distinct task count', () => {
  const ws = M.emptyWorkspace(); ws.tasks = [{ id: 'x', title: 'Work', status: 'done', doneAt: new Date(2026, 8, 1, 23, 59).getTime() }]; H.ensure(ws);
  ws.tasks[0].doneAt = new Date(2026, 8, 2, 0, 0).getTime(); H.record(ws, ws.tasks[0]);
  const one = A.analyze(ws, { from: '2026-09-01', to: '2026-09-01', today: '2026-09-15' }); assert.equal(one.rows.length, 1);
  const both = A.analyze(ws, { from: '2026-09-01', to: '2026-09-02', today: '2026-09-15' }); assert.equal(both.rows.length, 2); assert.equal(both.unique, 1); assert.equal(both.buckets.reduce((n, b) => n + b.count, 0), 2);
  assert.equal(A.range(7, '2026-09-15').from, '2026-09-09');
});

test('CSV quotes cells, retains Unicode and prevents spreadsheet formula interpretation', () => {
  const text = A.csv([{ completedAt: 1700000000000, seq: 'TRC-1', title: '=SUM(1,2)', projectName: '中文"项目', assignee: 'A\nB' }], ['date', 'id', 'title', 'project', 'owner']);
  assert.ok(text.startsWith('\uFEFF')); assert.ok(text.includes('"\'=SUM(1,2)"')); assert.ok(text.includes('中文""项目')); assert.ok(text.includes('"A\nB"'));
});
