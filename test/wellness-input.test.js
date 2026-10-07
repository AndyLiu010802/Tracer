'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const F = require('../skins/tracer/focus-model');
const D = require('../skins/tracer/daily-content');
const clone = value => JSON.parse(JSON.stringify(value));

function completionClient(initial, workspace) {
  const key = 'tracer.focus.v1', saved = new Map([[key, JSON.stringify(initial)]]), listeners = {}, elements = new Map();
  const writes = [], notifications = [], errors = [], lockQueue = [], lockNames = [];
  const control = { holdLocks: false, failWrites: false };
  const account = { locked: false, switching: false, storageName: name => 'test-account.' + name };
  const store = { data: clone(workspace), base: clone(workspace), dirty: false, inflight: false, lost: false, conflict: null };
  let ready;
  const element = name => {
    if (!elements.has(name)) elements.set(name, { dataset: {}, style: {}, setAttribute() {} });
    return elements.get(name);
  };
  const window = {
    Tracer: { store, ready: { then(callback) { ready = callback; } }, ui: { notice: message => errors.push(message) } },
    TracerAccount: account, TracerModel: require('../skins/tracer/model'), TracerFocus: F, TracerDaily: D,
    TracerLocale: { t: value => value, language: () => 'en' },
    addEventListener(name, callback) { listeners[name] = callback; },
    dispatchEvent(event) { notifications.push(event.type); listeners[event.type]?.(event); return true; }
  };
  const context = {
    window, Event, TracerAccount: account, location: { origin: 'http://127.0.0.1:18159' },
    navigator: { locks: { request(name, callback) {
      lockNames.push(name);
      return control.holdLocks ? new Promise((resolve, reject) => lockQueue.push(() => Promise.resolve().then(callback).then(resolve, reject))) : Promise.resolve().then(callback);
    } } },
    document: { hidden: false, title: 'Tracer', body: { dataset: {} }, getElementById: element, querySelector: element, querySelectorAll: () => [], addEventListener() {} },
    localStorage: { getItem: name => saved.get(name) ?? null, setItem(name, value) {
      if (name === key) { if (control.failWrites) throw new Error('storage-full'); writes.push(JSON.parse(value)); }
      saved.set(name, value);
    } },
    setInterval() {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../skins/tracer/wellness.js'), 'utf8'), context);
  return {
    T: window.Tracer, store, account, control, writes, notifications, errors, lockNames,
    read: () => JSON.parse(saved.get(key)), replace: value => saved.set(key, JSON.stringify(value)),
    emit: (name, value = {}) => listeners[name]?.(value), ready: () => ready(),
    release: () => { control.holdLocks = false; return lockQueue.shift()?.(); }
  };
}

function runningTask(id = 'current') {
  const focus = F.fresh(); focus.settings.focus = 17; F.reset(focus, 'focus');
  focus.task = { id, title: id };
  focus.history = [{ id: 'previous', endedAt: 1000, minutes: 10, task: { id: 'previous-task', title: 'Previous' } }];
  focus.totalMinutes = 35; focus.roundsDone = 3;
  F.start(focus, Date.now(), 'active-session'); return focus;
}

test('only accepted completion clears the bound timer; failed saves wait for the successful retry', async () => {
  const initial = runningTask(), workspace = { tasks: [{ id: 'current', status: 'doing' }], projectDeletions: [] };
  const c = completionClient(initial, workspace);
  c.store.data.tasks[0].status = 'done'; c.store.dirty = true;
  await c.emit('tracer-workspace-saved');
  assert.deepEqual(c.read(), initial); assert.equal(c.writes.length, 0); assert.equal(c.notifications.length, 0);
  c.store.base = clone(c.store.data); c.store.dirty = false;
  await c.emit('tracer-workspace-saved');
  const reset = c.read();
  assert.equal(reset.task, null); assert.equal(reset.running, false); assert.equal(reset.runId, ''); assert.equal(reset.endAt, null);
  assert.equal(reset.mode, 'focus'); assert.equal(reset.duration, 17 * 60000); assert.equal(reset.remaining, reset.duration);
  assert.equal(reset.completed, false); assert.equal(reset.alarm, null);
  for (const name of ['history', 'settings', 'totalMinutes', 'roundsDone']) assert.deepEqual(reset[name], initial[name]);
  assert.deepEqual(c.notifications, ['tracer-focus-change']); assert.equal(c.writes.length, 1);
  await c.emit('tracer-workspace-saved'); assert.equal(c.writes.length, 1, 'a repeated save does not reset again');
});

test('initial loading resets a saved Done association before an expired timer can manufacture a new round', async () => {
  const initial = runningTask(); initial.endAt = Date.now() - 1000;
  const c = completionClient(initial, { tasks: [{ id: 'current', status: 'done' }], projectDeletions: [] });
  await c.ready(); await new Promise(resolve => setImmediate(resolve));
  const reset = c.read();
  assert.equal(reset.task, null); assert.equal(reset.remaining, 17 * 60000); assert.equal(reset.running, false);
  assert.deepEqual(reset.history, initial.history); assert.equal(reset.totalMinutes, initial.totalMinutes); assert.equal(reset.roundsDone, initial.roundsDone);
});

test('a completion reset rechecks the newest timer and workspace under the account-scoped lock', async () => {
  const c = completionClient(runningTask(), { tasks: [{ id: 'current', status: 'done' }, { id: 'other', status: 'doing' }], projectDeletions: [] });
  c.control.holdLocks = true;
  const pending = c.emit('tracer-workspace-saved');
  const other = runningTask('other'); c.replace(other);
  await c.release(); await pending;
  assert.deepEqual(c.read(), other); assert.equal(c.writes.length, 0, 'completion of current must not stop the newer other task');
  assert.ok(c.lockNames.every(name => name === 'test-account.tracer-focus-state'));
  c.replace(runningTask()); c.control.holdLocks = true;
  const reopened = c.emit('tracer-workspace-saved'); c.store.data.tasks[0].status = 'doing';
  await c.release(); await reopened;
  assert.equal(c.read().running, true); assert.equal(c.writes.length, 0, 'an unsaved reopen is not overwritten by a stale completion callback');
});

test('locked and switching accounts cannot persist a reset or a timer control change', async () => {
  for (const flag of ['locked', 'switching']) {
    const initial = runningTask(), c = completionClient(initial, { tasks: [{ id: 'current', status: 'done' }], projectDeletions: [] });
    c.control.holdLocks = true;
    const pending = c.emit('tracer-workspace-saved'); c.account[flag] = true;
    await c.release(); await pending;
    await c.T.focus.toggle();
    assert.deepEqual(c.read(), initial); assert.equal(c.writes.length, 0); assert.equal(c.notifications.length, 0);
  }
});

test('a failed timer reset write leaves the running snapshot and reports a retryable storage error', async () => {
  const initial = runningTask(), c = completionClient(initial, { tasks: [{ id: 'current', status: 'done' }], projectDeletions: [] });
  c.control.failWrites = true;
  await c.emit('tracer-workspace-saved');
  assert.deepEqual(c.read(), initial); assert.deepEqual(clone(c.T.focus.read()), initial);
  assert.deepEqual(c.notifications, []); assert.deepEqual(c.errors, ['timerStorageError']);
  c.T.refreshWellness(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(c.read(), initial); assert.deepEqual(clone(c.T.focus.read()), initial, 'the save-triggered redraw must also wait for persistence');
  c.control.failWrites = false; await c.emit('tracer-workspace-saved');
  assert.equal(c.read().task, null); assert.equal(c.writes.length, 1);
});

test('focus keeps anonymous desktop and reader input after leisure rewards are removed', async () => {
  const key = 'tracer.focus.v1', state = F.fresh();
  F.start(state, Date.now(), 'input-regression');
  const saved = new Map([[key, JSON.stringify(state)]]), windowListeners = {}, documentListeners = {}, elements = new Map(), focusEvents = [];
  const reader = {}, origin = 'http://127.0.0.1:18159';
  let timer, gardenRefreshes = 0, rewardCalls = 0, storageReads = 0;
  const element = name => {
    if (!elements.has(name)) elements.set(name, { dataset: {}, style: {}, setAttribute() {} });
    return elements.get(name);
  };
  const window = {
    Tracer: { store: { data: { tasks: [], projectDeletions: [] } }, ready: { then() {} },
      garden: { refresh() { gardenRefreshes++; } }, ui: { notice(message) { assert.fail(message); } } },
    TracerModel: {}, TracerFocus: F, TracerDaily: D, TracerLocale: { t: value => value, language: () => 'en' },
    DBFarm: { syncFocus() { rewardCalls++; } },
    addEventListener(name, callback) { windowListeners[name] = callback; },
    dispatchEvent(event) {
      if (event.type === 'tracer-focus-change') focusEvents.push({ readable: JSON.parse(JSON.stringify(window.Tracer.focus.read())), persisted: F.read(JSON.parse(saved.get(key))) });
      windowListeners[event.type]?.(event); return true;
    }
  };
  const context = {
    window, Event, location: { origin }, navigator: {},
    document: { title: 'Tracer', body: { dataset: {} }, getElementById: element, querySelector: element,
      querySelectorAll: selector => selector === 'iframe' ? [{ contentWindow: reader }] : [],
      addEventListener(name, callback) { documentListeners[name] = callback; } },
    localStorage: { getItem: key => { storageReads++; return saved.get(key) ?? null; }, setItem: (key, value) => saved.set(key, value) },
    setInterval(callback) { timer = callback; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../skins/tracer/wellness.js'), 'utf8'), context);
  const pulse = (source, kind, extra = {}) => windowListeners.message({
    source, origin, data: { __aside: 1, type: 'farm', kind }, ...extra
  });
  const flush = async () => { timer(); await new Promise(resolve => setImmediate(resolve)); };
  const readsBeforeInput = storageReads;
  pulse(window, 'click'); pulse(window, 'key');
  pulse(reader, 'click'); pulse(reader, 'key');
  pulse({}, 'click');
  pulse(window, 'click', { origin: 'https://untrusted.example' });
  pulse(window, 'click', { data: { __aside: 0, type: 'farm', kind: 'click' } });
  pulse(window, 'click', { data: { __aside: 1, type: 'other', kind: 'click' } });
  for (const kind of [undefined, null, '', 'unknown', 'keypress', 1, {}]) pulse(window, kind);
  documentListeners.keydown({ code: 'KeyA' }); documentListeners.click();
  assert.equal(storageReads, readsBeforeInput, 'keystrokes and clicks do not repeatedly parse stored focus history');
  await flush();
  assert.deepEqual(JSON.parse(saved.get(key)).activity, { keys: { LMB: 3, a: 1 }, clicks: 3, unknown: 2 });
  assert.equal(focusEvents.length, 1, 'local persisted focus changes notify observers');
  assert.deepEqual(focusEvents[0].readable, focusEvents[0].persisted, 'observers see the state already written to storage');

  const active = JSON.parse(saved.get(key));
  await window.Tracer.focus.toggle();
  assert.equal(focusEvents.length, 2, 'pausing the local session also notifies observers');
  assert.equal(focusEvents[1].readable.running, false);
  assert.deepEqual(focusEvents[1].readable, focusEvents[1].persisted);
  for (const overrides of [
    { running: false, endAt: null },
    { mode: 'short' },
    { endAt: Date.now() - 1 }
  ]) {
    saved.set(key, JSON.stringify({ ...active, ...overrides }));
    const before = focusEvents.length;
    windowListeners.storage({ key });
    assert.equal(focusEvents.length, before + 1, 'a cross-window storage change notifies immediately after loading');
    assert.deepEqual(focusEvents.at(-1).readable, focusEvents.at(-1).persisted, 'cross-window observers never receive the previous focus snapshot');
    pulse(window, 'click'); pulse(reader, 'key');
    await flush();
    assert.deepEqual(JSON.parse(saved.get(key)).activity, active.activity, 'paused, break and expired rounds do not count input');
  }
  assert.ok(gardenRefreshes > 0, 'focus updates still refresh the project garden');
  assert.equal(rewardCalls, 0, 'focus updates never grant retired farm rewards');
});
