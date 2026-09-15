'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../skins/tracer/model');
const S = require('../public/workspace-sync');
const { createService } = require('../wechat/cloudfunctions/tracer/core');
const memoryRepository = require('./helpers/cloud-repository');
const fs = require('node:fs');
const vm = require('node:vm');

test('professional task fields survive cloud storage and subsequent phone edits', async () => {
  const service = createService(memoryRepository()), user = { openid: 'pro-user', appid: 'wx-test' };
  const ws = (await service({ action: 'read' }, user)).workspace;
  const prerequisite = M.addTask(ws, { title: 'Review' });
  const task = M.addTask(ws, { title: 'Ship', type: 'feature', priority: 'urgent', assignee: 'Andy', labels: ['UI', '客户'], estimate: 2.5, spent: 0,
    acceptance: 'Keyboard and pointer work', checklist: [{ text: 'Smoke test', done: false }], links: ['https://example.com/spec'], dependsOn: [prerequisite.id] });
  let result = await service({ action: 'write', version: 0, workspace: ws }, user);
  assert.equal(result.ok, true);
  const saved = M.findTask(result.workspace, task.id);
  for (const key of ['type', 'priority', 'assignee', 'labels', 'estimate', 'spent', 'acceptance', 'checklist', 'links', 'dependsOn']) assert.deepEqual(saved[key], task[key], key);
  M.updateTask(result.workspace, task.id, { notes: 'Phone edit' });
  result = await service({ action: 'write', version: result.workspace.meta.syncVersion, workspace: result.workspace }, user);
  assert.equal(M.findTask(result.workspace, task.id).estimate, 2.5);
  assert.deepEqual(M.findTask(result.workspace, task.id).checklist, task.checklist);
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
  local.tasks[0].checklist[0].text = 'Desktop'; remote.tasks[0].checklist[0].text = 'Phone';
  result = S.merge(base, local, remote); assert.equal(result.conflicts.length, 1); assert.equal(result.conflicts[0].field, 'checklist');
});

test('search finds owner, tags and acceptance criteria without altering tasks', () => {
  const ws = M.emptyWorkspace(), task = M.addTask(ws, { title: 'Ship', assignee: 'Andy', labels: ['UX'], acceptance: 'Keyboard passes' });
  const before = JSON.stringify(ws);
  for (const query of ['andy', 'ux', 'keyboard']) assert.deepEqual(M.filterTasks(ws, { query }), [task]);
  assert.equal(JSON.stringify(ws), before);
});

test('Mini Program editor loads and saves professional fields without reducing priority', async () => {
  const I = require('../public/task-i18n');
  const ws = M.emptyWorkspace(), task = M.addTask(ws, { title: 'Mobile', type: 'bug', priority: 'urgent', assignee: 'Andy', labels: ['UX'], estimate: 1.5, spent: 0,
    acceptance: 'Original criteria', checklist: [{ text: 'Keep this', done: true }], links: ['https://example.com'] });
  const store = { model: M, load: async () => {}, snapshot: () => ({ data: JSON.parse(JSON.stringify(ws)), demo: true }), mutate: async fn => fn(ws) };
  const locale = { t: (k, v) => I.t('en', k, v), strings: () => I.strings('en'), message: s => I.message('en', s) };
  let page, back = false;
  vm.runInNewContext(fs.readFileSync(require.resolve('../wechat/miniprogram/pages/edit/index'), 'utf8'), {
    require: name => name.endsWith('store') ? store : locale, Page: value => { page = value; }, wx: { setNavigationBarTitle() {}, showToast() {}, navigateBack() { back = true; } },
  });
  page.setData = values => Object.assign(page.data, values);
  await page.onLoad({ id: task.id });
  assert.equal(page.data.priorityIndex, M.PRIORITIES.indexOf('urgent'));
  page.data.acceptance = 'Mobile criteria'; page.data.checkNew = 'Added on phone'; await page.save();
  assert.equal(page.data.error, ''); assert.equal(back, true);
  assert.equal(task.acceptance, 'Mobile criteria'); assert.equal(task.priority, 'urgent'); assert.equal(task.estimate, 1.5);
  assert.equal(task.checklist.length, 2); assert.equal(task.checklist[0].done, true); assert.equal(task.checklist[1].text, 'Added on phone');
});
