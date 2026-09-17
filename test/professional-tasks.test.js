'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../skins/tracer/model');
const S = require('../public/workspace-sync');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const store = require('../lib/store');

test('professional task fields survive local storage and subsequent edits', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracer-professional-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 4, retryDelay: 50 }));
  const ws = M.emptyWorkspace();
  const prerequisite = M.addTask(ws, { title: 'Review' });
  const task = M.addTask(ws, { title: 'Ship', type: 'feature', priority: 'urgent', assignee: 'Andy', labels: ['UI', '客户'], estimate: 2.5, spent: 0,
    acceptance: 'Keyboard and pointer work', checklist: [{ text: 'Smoke test', done: false }], links: ['https://example.com/spec'], dependsOn: [prerequisite.id] });
  await store.writeStore(dir, 'workspace', JSON.stringify(ws));
  let result = await store.readStore(dir, 'workspace');
  const saved = M.findTask(result, task.id);
  for (const key of ['type', 'priority', 'assignee', 'labels', 'estimate', 'spent', 'acceptance', 'checklist', 'links', 'dependsOn']) assert.deepEqual(saved[key], task[key], key);
  M.updateTask(result, task.id, { notes: 'Another edit' });
  await store.writeStore(dir, 'workspace', JSON.stringify(result));
  result = await store.readStore(dir, 'workspace');
  assert.equal(M.findTask(result, task.id).estimate, 2.5);
  assert.deepEqual(M.findTask(result, task.id).checklist, task.checklist);
});

test('dependency graph rejects cycles atomically and clears references on deletion', () => {
  const ws = M.emptyWorkspace(), a = M.addTask(ws, { title: 'A' }), b = M.addTask(ws, { title: 'B', dependsOn: [a.id] });
  const before = JSON.stringify(ws);
  assert.throws(() => M.updateTask(ws, a.id, { title: 'Must not change', dependsOn: [b.id] }), /dependency/);
  assert.equal(JSON.stringify(ws), before);
  assert.deepEqual(M.blockers(ws, b), [a]); M.updateTask(ws, a.id, { status: 'done' }); assert.deepEqual(M.blockers(ws, b), []);
  M.deleteTask(ws, a.id); assert.deepEqual(b.dependsOn, []); assert.doesNotThrow(() => S.validate(ws));
});

test('validation rejects unsafe links, malformed structured data and cycles', () => {
  const ws = M.emptyWorkspace(), a = M.addTask(ws, { title: 'A' }), b = M.addTask(ws, { title: 'B', dependsOn: [a.id] });
  for (const fields of [{ links: ['javascript:alert(1)'] }, { spent: -1 }, { estimate: 'abc' }]) assert.throws(() => M.updateTask(ws, a.id, fields));
  for (const fields of [{ links: ['data:text/html,bad'] }, { checklist: [{ id: 'step', text: 'x', done: 'yes' }] }, { labels: ['x'.repeat(101)] }, { priority: 'invalid' }, { dependsOn: [b.id] }]) {
    const copy = S.clone(ws); Object.assign(copy.tasks[0], fields); assert.throws(() => S.validate(copy));
  }
});

test('independent rich-field edits merge while checklist conflicts stay reviewable', () => {
  const base = M.emptyWorkspace(), task = M.addTask(base, { title: 'Ship', estimate: 2, checklist: [{ text: 'Test', done: false }] });
  const local = S.clone(base), remote = S.clone(base);
  M.updateTask(local, task.id, { estimate: 4 }); M.updateTask(remote, task.id, { assignee: 'Andy' });
  local.tasks[0].updatedAt = 100; remote.tasks[0].updatedAt = 200;
  let result = S.merge(base, local, remote); assert.equal(result.conflicts.length, 0); assert.equal(result.workspace.tasks[0].estimate, 4); assert.equal(result.workspace.tasks[0].assignee, 'Andy');
  local.tasks[0].checklist[0].text = 'First editor'; remote.tasks[0].checklist[0].text = 'Second editor';
  result = S.merge(base, local, remote); assert.equal(result.conflicts.length, 1); assert.equal(result.conflicts[0].field, 'checklist');
});

test('search finds owner, tags and acceptance criteria without altering tasks', () => {
  const ws = M.emptyWorkspace(), task = M.addTask(ws, { title: 'Ship', assignee: 'Andy', labels: ['UX'], acceptance: 'Keyboard passes' });
  const before = JSON.stringify(ws);
  for (const query of ['andy', 'ux', 'keyboard']) assert.deepEqual(M.filterTasks(ws, { query }), [task]);
  assert.equal(JSON.stringify(ws), before);
});
