'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const I = require('../public/task-i18n');
const M = require('../skins/tracer/model');
test('desktop remembers language and changes labels without changing task content', () => {
  const storage = new Map(), elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', title: '', setAttribute() {} });
    return elements.get(id);
  };
  const workspace = M.emptyWorkspace();
  M.addTask(workspace, { title: '发布 API release', status: 'doing', priority: 'high' });
  const original = JSON.stringify(workspace);
  const window = { TaskI18n: I, Tracer: { store: { data: workspace }, redraw() {} } };
  const document = { documentElement: {}, getElementById: element, querySelectorAll: () => [] };
  vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/i18n'), 'utf8'), {
    window, document,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  });
  assert.equal(window.TracerLocale.language(), 'en');
  const picker = element('language-select');
  picker.value = 'zh'; picker.onchange();
  assert.equal(storage.get('tracer.language'), 'zh');
  assert.equal(document.documentElement.lang, 'zh-CN');
  assert.equal(window.TracerLocale.t('doing'), '进行中');
  picker.value = 'en'; picker.onchange();
  assert.equal(storage.get('tracer.language'), 'en');
  assert.equal(window.TracerLocale.t('doing'), 'In Progress');
  assert.equal(JSON.stringify(workspace), original);
});
test('local save errors and result counts are readable in either language', () => {
  assert.equal(I.message('en', '保存失败'), 'Save failed.');
  assert.equal(I.message('zh', 'Save failed.'), '保存失败');
  assert.equal(I.t('en', 'boardResults', { count: 3, total: 5 }), '3 of 5 tasks');
  assert.equal(I.t('zh', 'boardResults', { count: 3, total: 5 }), '显示 3 / 5 项任务');
});
