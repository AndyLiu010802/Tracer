'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const F = require('../skins/tracer/focus-model');
const D = require('../skins/tracer/daily-content');

test('focus keeps anonymous desktop and reader input after leisure rewards are removed', async () => {
  const key = 'tracer.focus.v1', state = F.fresh();
  F.start(state, Date.now(), 'input-regression');
  const saved = new Map([[key, JSON.stringify(state)]]), windowListeners = {}, documentListeners = {}, elements = new Map();
  const reader = {}, origin = 'http://127.0.0.1:18159';
  let timer, gardenRefreshes = 0, rewardCalls = 0;
  const element = name => {
    if (!elements.has(name)) elements.set(name, { dataset: {}, style: {}, setAttribute() {} });
    return elements.get(name);
  };
  const window = {
    Tracer: { store: { data: { tasks: [], projectDeletions: [] } }, ready: { then() {} },
      garden: { refresh() { gardenRefreshes++; } }, ui: { notice(message) { assert.fail(message); } } },
    TracerModel: {}, TracerFocus: F, TracerDaily: D, TracerLocale: { t: value => value, language: () => 'en' },
    DBFarm: { syncFocus() { rewardCalls++; } },
    addEventListener(name, callback) { windowListeners[name] = callback; }
  };
  const context = {
    window, location: { origin }, navigator: {},
    document: { title: 'Tracer', body: { dataset: {} }, getElementById: element, querySelector: element,
      querySelectorAll: selector => selector === 'iframe' ? [{ contentWindow: reader }] : [],
      addEventListener(name, callback) { documentListeners[name] = callback; } },
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    setInterval(callback) { timer = callback; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../skins/tracer/wellness.js'), 'utf8'), context);
  const pulse = (source, kind, extra = {}) => windowListeners.message({
    source, origin, data: { __aside: 1, type: 'farm', kind }, ...extra
  });
  const flush = async () => { timer(); await new Promise(resolve => setImmediate(resolve)); };
  pulse(window, 'click'); pulse(window, 'key');
  pulse(reader, 'click'); pulse(reader, 'key');
  pulse({}, 'click');
  pulse(window, 'click', { origin: 'https://untrusted.example' });
  pulse(window, 'click', { data: { __aside: 0, type: 'farm', kind: 'click' } });
  pulse(window, 'click', { data: { __aside: 1, type: 'other', kind: 'click' } });
  for (const kind of [undefined, null, '', 'unknown', 'keypress', 1, {}]) pulse(window, kind);
  documentListeners.keydown({ code: 'KeyA' }); documentListeners.click();
  await flush();
  assert.deepEqual(JSON.parse(saved.get(key)).activity, { keys: { LMB: 3, a: 1 }, clicks: 3, unknown: 2 });

  const active = JSON.parse(saved.get(key));
  for (const overrides of [
    { running: false, endAt: null },
    { mode: 'short' },
    { endAt: Date.now() - 1 }
  ]) {
    saved.set(key, JSON.stringify({ ...active, ...overrides }));
    windowListeners.storage({ key });
    pulse(window, 'click'); pulse(reader, 'key');
    await flush();
    assert.deepEqual(JSON.parse(saved.get(key)).activity, active.activity, 'paused, break and expired rounds do not count input');
  }
  assert.ok(gardenRefreshes > 0, 'focus updates still refresh the project garden');
  assert.equal(rewardCalls, 0, 'focus updates never grant retired farm rewards');
});
