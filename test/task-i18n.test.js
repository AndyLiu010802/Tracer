'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const I = require('../public/task-i18n');
const M = require('../skins/tracer/model');
test('Mini Program remembers language, updates labels and keeps task content and filters', () => {
  const storage = new Map(), tabs = [], wx = { getStorageSync: k => storage.get(k), setStorageSync: (k, v) => storage.set(k, v), setTabBarItem: value => tabs.push(value), setNavigationBarTitle() {} };
  const iContext = { wx, module: { exports: {} }, require: () => I };
  vm.runInNewContext(fs.readFileSync(require.resolve('../wechat/miniprogram/lib/i18n'), 'utf8'), iContext);
  const locale = iContext.module.exports;
  assert.equal(locale.language(), 'en');
  locale.set('zh');
  assert.equal(locale.language(), 'zh');
  const ws = M.emptyWorkspace(); M.addTask(ws, { title: '发布 API release', status: 'doing', priority: 'high' });
  const original = JSON.stringify(ws);
  const store = { model: M, snapshot: () => ({ data: ws, demo: true, dirty: false }) };
  let page;
  vm.runInNewContext(fs.readFileSync(require.resolve('../wechat/miniprogram/pages/tasks/index'), 'utf8'), {
    wx, Page: p => { page = p; }, require: name => name.endsWith('store') ? store : locale,
  });
  page.setData = values => Object.assign(page.data, values);
  page.data.high = true; page.data.query = 'API'; page.translate();
  assert.equal(page.data.tasks[0].statusLabel, '进行中');
  page.language({ currentTarget: { dataset: { lang: 'en' } } });
  assert.equal(storage.get('tracer-language'), 'en');
  assert.equal(page.data.tasks[0].statusLabel, 'In Progress');
  assert.equal(page.data.L.saveTask, 'Save task');
  assert.equal(page.data.query, 'API'); assert.equal(page.data.high, true);
  assert.equal(page.data.tasks[0].title, '发布 API release'); assert.equal(JSON.stringify(ws), original);
  assert.equal(tabs[tabs.length - 1].text, 'Sync & Devices');
});
test('network and pairing errors are readable in either language', () => {
  assert.equal(I.message('en', '配对码无效或已过期'), 'The pairing code is invalid or expired.');
  assert.equal(I.message('zh', 'The pairing code is invalid or expired.'), '配对码无效或已过期');
  assert.equal(I.t('en', 'boardResults', { count: 3, total: 5 }), '3 of 5 tasks');
  assert.equal(I.t('zh', 'boardResults', { count: 3, total: 5 }), '显示 3 / 5 项任务');
});
