'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const S = require('../public/workspace-sync');
const M = require('../skins/tracer/model');
function client(initial, put) {
  const elements = new Map(), storage = new Map(), timers = new Map(); let seq = 0;
  const el = id => { if (!elements.has(id)) elements.set(id, { hidden: true, classList: { toggle() {} }, addEventListener() {}, setAttribute() {}, innerHTML: '', querySelector() { return null; } }); return elements.get(id); };
  const window = { WorkspaceSync: S, TracerModel: M, TaskHistory: require('../public/task-history'), addEventListener() {} };
  const context = { window, console, document: { hidden: false, activeElement: {}, documentElement: el('html'), getElementById: el, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    location: { search: '?sec=board' }, navigator: { sendBeacon() {} },
    setInterval() {}, setTimeout(fn) { timers.set(++seq, fn); return seq; }, clearTimeout(id) { timers.delete(id); },
    fetch: async (url, options) => options ? put(JSON.parse(options.body)) : { ok: true, json: async () => S.clone(initial) },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/app.js'), 'utf8'), context);
  return { T: window.Tracer, storage, timers };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('desktop saves preserve references retained by existing editors', async () => {
  const initial = S.empty(); M.addTask(initial, { title: 'first' });
  const { T } = client(initial, async () => ({ ok: true, json: async () => ({ ok: true }) })); await T.ready;
  const ws = T.store.data, task = ws.tasks[0];
  task.title = 'edit one'; T.touch(); T.saveNow(); await settle();
  assert.equal(T.store.data, ws); assert.equal(T.store.data.tasks[0], task);
  M.updateTask(ws, task.id, { title: 'edit two' }); T.touch(); T.saveNow(); await settle();
  assert.equal(T.store.data.tasks[0].title, 'edit two'); assert.equal(T.store.dirty, false);
});
test('in-flight desktop changes survive cloud acknowledgement and draft clears after final save', async () => {
  const initial = S.empty(); initial.meta.syncAccount = 'owner'; M.addTask(initial, { title: 'first' });
  let finish;
  const { T, storage } = client(initial, sent => new Promise(resolve => { finish = () => { sent.meta.syncVersion++; resolve({ ok: true, json: async () => ({ ok: true, workspace: sent }) }); }; }));
  await T.ready; T.store.data.tasks[0].title = 'saved'; T.touch(); T.saveNow();
  T.store.data.tasks[0].notes = 'typed during save'; T.touch(); finish(); await settle();
  assert.equal(T.store.data.tasks[0].notes, 'typed during save'); assert.equal(T.store.dirty, true);
  T.saveNow(); finish(); await settle();
  assert.equal(T.store.dirty, false); assert.equal(storage.has('tracer.cloudDraft'), false);
});
test('desktop same-field conflict remains pending until explicitly resolved', async () => {
  const initial = S.empty(); initial.meta.syncAccount = 'owner'; M.addTask(initial, { title: 'base' });
  const remote = S.clone(initial); remote.tasks[0].title = 'phone'; remote.meta.syncVersion = 1;
  const { T } = client(initial, async sent => sent.meta.syncVersion === 0 ? { ok: false, status: 409, json: async () => ({ workspace: remote }) } : { ok: true, json: async () => ({ ok: true, workspace: sent }) });
  await T.ready; T.store.data.tasks[0].title = 'desktop'; T.touch(); T.saveNow(); await settle();
  assert.ok(T.store.conflict); const c = S.merge(T.store.base, T.store.data, T.store.conflict).conflicts[0];
  assert.equal(T.resolveCloud({ [c.key]: 'remote' }), true); await settle();
  assert.equal(T.store.data.tasks[0].title, 'phone'); assert.equal(T.store.conflict, null);
});
