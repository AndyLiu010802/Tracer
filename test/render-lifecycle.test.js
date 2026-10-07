'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../skins/tracer/model');
const S = require('../public/workspace-sync');
const I = require('../public/task-i18n');

// Run the real router, renderers and action handlers. The small DOM records
// section replacement; all persistence and timers stay inside this fixture.
async function client() {
  const nodes = new Map(), storage = new Map(), timers = new Map(), errors = [];
  let timerId = 0, wellness = 0, T;
  function node(id) {
    if (nodes.has(id)) return nodes.get(id);
    const events = {}, classes = new Set();
    const el = { id, value: '', hidden: false, dataset: {}, childNodes: [], writes: 0,
      classList: { add: value => classes.add(value), contains: value => classes.has(value), toggle(value, on) { if (on) classes.add(value); else classes.delete(value); } },
      addEventListener(name, fn) { events[name] = fn; }, setAttribute() {},
      click() { if (events.click) events.click({ target: el }); else el.onclick?.(); },
      focus() {}, setSelectionRange() {}, setCustomValidity() {}, scrollIntoView() {},
      checkValidity: () => true, reportValidity: () => true,
      querySelector(selector) { return node(selector.startsWith('#') ? selector.slice(1) : id + '/' + selector); },
      querySelectorAll(selector) {
        if (id === 'proj-list' && selector === '.proj-item') return ['', ...T.store.data.projects.map(p => p.id)].map(projectId => {
          const button = node('project-button-' + projectId); button.dataset.id = projectId; return button;
        });
        return [];
      }
    };
    let html = '';
    Object.defineProperty(el, 'innerHTML', { get: () => html, set(value) { html = value; el.writes++; } });
    nodes.set(id, el); return el;
  }
  const initial = S.empty(), project = M.addProject(initial, { name: 'A synthetic project' });
  const task = M.addTask(initial, { title: 'Original task', projectId: project.id });
  const window = { WorkspaceSync: S, TracerModel: M, TaskI18n: I,
    TaskHistory: require('../public/task-history'), addEventListener() {}, dispatchEvent() {},
    TracerLocale: { t: key => I.t('en', key), message: text => I.message('en', text), language: () => 'en' } };
  const context = { window, Event, console: { error: (...values) => errors.push(values) },
    document: { hidden: false, activeElement: {}, documentElement: node('html'), body: node('body'),
      getElementById: node, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} },
    location: { search: '?sec=board' }, navigator: { sendBeacon: () => true },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id), setInterval() {},
    fetch: async (_url, input) => ({ ok: true, json: async () => input ? { ok: true } : S.clone(initial) }) };
  const load = file => vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/' + file), 'utf8'), context, { filename: file });
  load('app.js'); T = window.Tracer; await T.ready;
  T.refreshWellness = () => wellness++;
  T.ui.modal = callback => callback(node('editor'), () => {});
  T.ui.notice = () => {}; T.ui.dragList = () => {};
  T.confirmTaskGardenChange = (_ws, _id, _fields, callback) => callback();
  T.confirmTaskGardenDelete = (_ws, _id, callback) => callback();
  load('i18n.js'); load('projects.js'); load('board.js'); load('planner.js'); load('task-editor.js');
  await Promise.resolve();
  function reset() { nodes.forEach(el => { el.writes = 0; }); wellness = 0; assert.deepEqual(errors, []); }
  function counts() { assert.deepEqual(errors, []); return { board: node('sec-board').writes, planner: node('sec-planner').writes, wellness }; }
  function edit(after) {
    T.taskEditor(T.store.data, task.id, after);
    for (const key of ['title', 'notes', 'status', 'type', 'pri', 'proj', 'scheduled', 'due', 'assignee', 'labels', 'estimate', 'spent', 'acceptance', 'links']) node('f-' + key).value = '';
    node('f-title').value = 'Edited task'; node('f-status').value = 'todo'; node('f-type').value = 'task'; node('f-proj').value = project.id;
  }
  reset(); return { T, node, project, task, reset, counts, edit };
}

test('opening a project and clicking its sidebar entry each render the board once', async () => {
  const c = await client();
  assert.equal(c.T.openProject(c.project.id), true);
  assert.equal(c.T.projectFilter(), c.project.id);
  assert.equal(c.counts().board, 1);
  assert.match(c.node('sec-board').innerHTML, /A synthetic project/);
  c.T.show('planner'); c.reset(); c.node('project-button-' + c.project.id).click();
  assert.equal(c.T.currentSec(), 'board');
  assert.equal(c.counts().board, 1);
  assert.equal(c.counts().planner, 0);
});

for (const action of ['save', 'delete']) {
  test('task ' + action + ' updates an active board once and keeps the editor callback', async () => {
    const c = await client(); let callbacks = 0;
    c.edit(() => callbacks++); c.reset(); c.node(action === 'save' ? 'f-save' : 'f-del').onclick();
    assert.deepEqual(c.counts(), { board: 1, planner: 0, wellness: 1 });
    assert.equal(callbacks, 1);
    if (action === 'save') {
      assert.equal(M.findTask(c.T.store.data, c.task.id).title, 'Edited task');
      assert.match(c.node('sec-board').innerHTML, /Edited task/);
    } else {
      assert.equal(M.findTask(c.T.store.data, c.task.id), null);
      assert.doesNotMatch(c.node('sec-board').innerHTML, /Original task/);
    }
  });
  test('task ' + action + ' updates the active planner without rendering a hidden board', async () => {
    const c = await client(); let callbacks = 0;
    c.T.show('planner'); c.edit(() => callbacks++); c.reset(); c.node(action === 'save' ? 'f-save' : 'f-del').onclick();
    assert.deepEqual(c.counts(), { board: 0, planner: 1, wellness: 1 });
    assert.equal(callbacks, 1);
    if (action === 'save') assert.match(c.node('sec-planner').innerHTML, /Edited task/);
    else assert.doesNotMatch(c.node('sec-planner').innerHTML, /Original task/);
    c.reset(); c.T.show('board');
    assert.equal(c.counts().board, 1, 'returning to the board renders the latest task state');
    if (action === 'save') assert.match(c.node('sec-board').innerHTML, /Edited task/);
    else assert.doesNotMatch(c.node('sec-board').innerHTML, /Original task/);
  });
}

for (const section of ['board', 'planner']) {
  test('language changes update only the active ' + section + ' and refresh wellness once', async () => {
    const c = await client(); c.T.show(section); c.reset();
    c.node('language-select').value = 'zh'; c.node('language-select').onchange();
    assert.deepEqual(c.counts(), { board: section === 'board' ? 1 : 0, planner: section === 'planner' ? 1 : 0, wellness: 1 });
    assert.ok(c.node('sec-' + section).innerHTML.includes(I.t('zh', section)));
  });
}
