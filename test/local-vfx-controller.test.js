'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { attachLocalVfx } = require('../desktop/local-vfx');

// These are isolated controller tests. The fakes record Electron calls; they do
// not claim to verify operating-system focus, compositing or mouse passthrough.
function fakeClock() {
  const timers = new Map();
  let now = 0;
  let serial = 0;
  return {
    timers,
    now: () => now,
    setTimeout(fn, delay) {
      const id = ++serial;
      timers.set(id, { fn, at: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        now = timer.at;
        timer.fn();
      }
      now = end;
    }
  };
}

function webContents(url) {
  const contents = new EventEmitter();
  contents.mainFrame = { url };
  contents.getURL = () => contents.mainFrame.url;
  contents.isDestroyed = () => !!contents.destroyed;
  contents.sent = [];
  contents.send = (...message) => contents.sent.push(message);
  contents.setWindowOpenHandler = handler => { contents.openHandler = handler; };
  return contents;
}

function fixture(t, overrides = {}) {
  const clock = fakeClock();
  const windows = [];
  const ipcMain = new EventEmitter();
  const handlers = new Map();
  ipcMain.handle = (channel, handler) => {
    assert(!handlers.has(channel), 'IPC handlers are registered only once');
    handlers.set(channel, handler);
  };
  ipcMain.removeHandler = channel => handlers.delete(channel);
  const main = new EventEmitter();
  const origin = 'http://127.0.0.1:18743';
  main.webContents = webContents(origin + '/');
  main.isDestroyed = () => !!main.destroyed;
  main.getBounds = () => ({ x: 40, y: 60, width: 1200, height: 800 });
  const powerMonitor = new EventEmitter();
  const unusedCalls = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-vfx-controller-test-'));
  if (Object.hasOwn(overrides, 'stored')) fs.writeFileSync(path.join(userData, 'local-vfx-settings.json'), overrides.stored);
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      if (overrides.throwAt === 'constructor') throw Error('fake constructor failure');
      this.options = options;
      this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
      this.webContents = webContents('about:blank');
      if (overrides.throwAt === 'setWindowOpenHandler') this.webContents.setWindowOpenHandler = () => { throw Error('fake policy failure'); };
      this.calls = [];
      this.visible = false;
      windows.push(this);
    }
    isDestroyed() { return !!this.destroyed; }
    setIgnoreMouseEvents(...args) {
      this.calls.push(['setIgnoreMouseEvents', ...args]);
      if (overrides.throwAt === 'setIgnoreMouseEvents') throw Error('fake setup failure');
    }
    setAlwaysOnTop(...args) {
      this.calls.push(['setAlwaysOnTop', ...args]);
      if (overrides.throwAt === 'setAlwaysOnTop') throw Error('fake setup failure');
    }
    setVisibleOnAllWorkspaces(...args) { this.calls.push(['setVisibleOnAllWorkspaces', ...args]); }
    setBounds(bounds) { this.bounds = { ...bounds }; }
    getBounds() { return { ...this.bounds }; }
    getContentBounds() { return { ...this.bounds }; }
    setMenu(menu) { this.calls.push(['setMenu', menu]); }
    setSkipTaskbar(value) { this.calls.push(['setSkipTaskbar', value]); }
    setFocusable(value) { this.calls.push(['setFocusable', value]); }
    showInactive() {
      this.calls.push(['showInactive']);
      if (overrides.throwAt === 'showInactive') throw Error('fake display failure');
      this.visible = true;
    }
    show() { unusedCalls.push('show'); }
    focus() { unusedCalls.push('focus'); }
    hide() { this.calls.push(['hide']); this.visible = false; }
    close() { this.destroy(); }
    destroy() {
      if (this.destroyed) return;
      this.calls.push(['destroy']);
      this.destroyed = true;
      this.visible = false;
      this.webContents.destroyed = true;
      this.emit('closed');
    }
    loadFile(file) {
      this.file = file;
      this.webContents.mainFrame.url = pathToFileURL(file).href;
      if (overrides.throwAt === 'loadFile') throw Error('fake load failure');
      return overrides.loadFile ? overrides.loadFile(this, file) : Promise.resolve();
    }
  }
  const display = { id: 7, scaleFactor:1, bounds: { x: -1920, y: -120, width: 1920, height: 1080 }, workArea: { x: -1920, y: -120, width: 1920, height: 1040 } };
  const screen = Object.assign(new EventEmitter(), {
    getCursorScreenPoint: () => { unusedCalls.push('getCursorScreenPoint'); throw Error('unexpected cursor fallback'); },
    screenToDipPoint: point => { unusedCalls.push(['screenToDipPoint', point]); return {x: point.x / 1.5, y: point.y / 1.5}; },
    getDisplayNearestPoint: () => display,
    getDisplayMatching: () => display,
    getPrimaryDisplay: () => display,
    getAllDisplays: () => [display]
  });
  const dependencies = {
    BrowserWindow, ipcMain, screen, powerMonitor,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, now: clock.now, placementShowWindows:false,
    globalShortcut: { register: () => unusedCalls.push('globalShortcut.register'), unregister: () => unusedCalls.push('globalShortcut.unregister') },
    uiohook: { on: () => unusedCalls.push('uiohook.on'), start: () => unusedCalls.push('uiohook.start') },
    ...overrides.dependencies
  };
  const app = Object.assign(new EventEmitter(), {isPackaged:false});
  const controller = attachLocalVfx(main, {
    app, profile: { channel: 'local' }, origin, userData,
    // Explicitly opt this isolated fixture into the reviewed texture renderer.
    visualsReady: true,
    getOrigin: () => Object.hasOwn(overrides, 'invocation') ? overrides.invocation : { ...(overrides.anchor || {x:-800,y:420}), coordinateSpace:'screen-dip' },
    showMain: () => unusedCalls.push('showMain'),
    ...overrides.options, dependencies
  });
  t.after(() => {
    controller.destroy();
    const target = path.resolve(userData);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert(path.basename(target).startsWith('tracer-vfx-controller-test-'));
    fs.rmSync(target, { recursive: true, force: true });
  });
  function mainEvent(changes = {}) {
    return { sender: main.webContents, senderFrame: main.webContents.mainFrame, ...changes };
  }
  function overlayEvent(win, changes = {}) {
    return { sender: win.webContents, senderFrame: win.webContents.mainFrame, ...changes };
  }
  function invoke(channel, payload, event = mainEvent()) {
    const handler = handlers.get(channel);
    assert(handler, 'controller exposes ' + channel);
    return handler(event, payload);
  }
  return { controller, clock, windows, handlers, ipcMain, main, powerMonitor, screen, app, display, userData, origin, unusedCalls, invoke, mainEvent, overlayEvent };
}

const channel = 'tracer-local-vfx';
const readyChannel = 'tracer-local-vfx-ready';
const doneChannel = 'tracer-local-vfx-done';
const enable = f => f.invoke(channel, { action: 'settings', settings: { enabled: true } });
const trustedPlay = f => {try{return {ok:true,...f.controller.play()};}catch(error){return {ok:false,error:['local-vfx-disabled','local-vfx-assets-pending','local-vfx-invoke-point-unavailable'].includes(error.message)?error.message:'local-vfx-unavailable'};}};
const start = async f => {
  assert.equal((await enable(f)).ok, true);
  const result = trustedPlay(f);
  assert.equal(result.ok, true);
  assert.equal(result.active, true);
  return f.windows.at(-1);
};
const readyPayload = Object.freeze({ok:true,effect:'haunt',renderer:'haunt-reference-texture-2',durationMs:7000});
const ready = (f, win) => f.ipcMain.emit(readyChannel, f.overlayEvent(win), readyPayload);
const done = (f, win, id = win.__localEffect.id) => f.ipcMain.emit(doneChannel, f.overlayEvent(win), id);
const starts = win => win.webContents.sent.filter(([name]) => name === 'tracer-local-vfx-start');

test('only explicitly unpackaged local releases attach VFX capabilities', t => {
  for (const options of [
    { app: undefined }, { app: {} }, { app: { isPackaged: true } }, { app: { isPackaged: 0 } },
    { profile: undefined }, { profile: {} }, { profile: { channel: 'commercial' } }, { profile: { channel: 'LOCAL' } }
  ]) {
    const f = fixture(t, { options });
    assert.deepEqual(f.controller.menuItems(), []);
    assert.equal(f.controller.cancel(), false);
    assert.equal(f.handlers.size, 0);
    assert.equal(f.ipcMain.eventNames().length, 0);
    assert.equal(f.main.webContents.listenerCount('before-input-event'), 0);
    assert.equal(f.windows.length, 0);
    assert.equal(f.clock.timers.size, 0);
  }
});

test('disabled effects never construct a window, including the release menu action', async t => {
  const f = fixture(t);
  const result = await f.invoke(channel, { action: 'play' });
  assert.deepEqual(result, { ok: false, error: 'local-vfx-disabled' });
  const releaseItem = f.controller.menuItems().at(-1).submenu[1];
  assert.equal(releaseItem.enabled, false);
  releaseItem.click();
  assert.equal(f.windows.length, 0);
  assert.equal(f.clock.timers.size, 0);
});

test('production defaults keep unreviewed visuals gated even after effects are enabled', async t => {
  for (const visualsReady of [undefined, false, 0, 1, 'true', {}]) {
    const f = fixture(t, { options: { visualsReady } });
    assert.equal(f.controller.status().assetsReady, false);
    assert.equal((await enable(f)).ok, true);
    assert.deepEqual(await f.invoke(channel, { action: 'play' }), { ok: false, error: 'local-vfx-assets-pending' });
    f.controller.menuItems().at(-1).submenu[1].click();
    assert.equal(f.windows.length, 0);
    assert.equal(f.clock.timers.size, 0);
    assert.equal(f.controller.status().active, false);
    assert.deepEqual(f.unusedCalls, ['showMain']);
  }
});

test('pending-asset configuration provides the notice without launching the development renderer', t => {
  const f = fixture(t, { options: { visualsReady: false } });
  const result = f.controller.configure('local-vfx-assets-pending');
  assert.equal(result.ok, true);
  assert.equal(result.notice, 'local-vfx-assets-pending');
  assert.equal(result.assetsReady, false);
  assert.equal(result.active, false);
  assert.deepEqual(f.unusedCalls, ['showMain']);
  assert(f.main.webContents.sent.some(([name]) => name === 'tracer-local-vfx-open'));
  assert.equal(f.windows.length, 0);
  assert.equal(f.clock.timers.size, 0);
});

test('requests require the exact main webContents, mainFrame identity and origin URL', async t => {
  const f = fixture(t);
  const badEvents = [
    f.mainEvent({ sender: webContents(f.origin + '/') }),
    f.mainEvent({ senderFrame: { url: f.origin + '/' } }),
    f.mainEvent({ senderFrame: undefined })
  ];
  for (const event of badEvents) {
    assert.deepEqual(await f.invoke(channel, { action: 'settings', settings: { enabled: true } }, event), { ok: false, error: 'local-vfx-forbidden' });
  }
  for (const url of [f.origin + '/?tab=vfx', f.origin + '/#vfx', f.origin + '/iframe.html', 'http://localhost:18743/', 'http://127.0.0.1:18744/', 'https://127.0.0.1:18743/', 'file:///index.html', 'about:blank']) {
    f.main.webContents.mainFrame.url = url;
    assert.deepEqual(await f.invoke(channel, { action: 'settings', settings: { enabled: true } }), { ok: false, error: 'local-vfx-forbidden' }, url);
  }
  f.main.webContents.mainFrame.url = f.origin + '/';
  assert.equal((await f.invoke(channel, { action: 'status' })).settings.enabled, false);
  assert.equal(fs.existsSync(path.join(f.userData, 'local-vfx-settings.json')), false);
  assert.equal(f.windows.length, 0);
});

test('invalid actions, unknown settings and out-of-range settings cannot change state or disk', async t => {
  const f = fixture(t);
  for (const payload of [undefined, null, false, [], 'play', {}, { action: 'launch' }, { action: 'constructor' }, { action: 'status', excess: 'x'.repeat(8193) }]) {
    assert.deepEqual(await f.invoke(channel, payload), { ok: false, error: 'local-vfx-invalid-request' });
  }
  for (const settings of [{ enabled: 'true' }, { strength: -0.001 }, { strength: 0.601 }, { size: 39 }, { size: 201 }, { effect: 'unknown' }, { motion: 'unknown' }, { atmosphere: 1 }, { unknown: true }]) {
    assert.deepEqual(await f.invoke(channel, { action: 'settings', settings }), { ok: false, error: 'local-vfx-invalid-settings' });
  }
  assert.equal(fs.existsSync(path.join(f.userData, 'local-vfx-settings.json')), false);
  assert.equal(f.controller.status().settings.enabled, false);
  assert.equal(f.windows.length, 0);
});

test('valid settings round-trip through an isolated directory and preserve unspecified fields', async t => {
  const f = fixture(t);
  const settings = { enabled: true, effect: 'leer', strength: 0.6, atmosphere: false, size: 200, motion: 'reduced' };
  assert.deepEqual((await f.invoke(channel, { action: 'settings', settings })).settings, settings);
  assert.deepEqual((await f.invoke(channel, { action: 'settings', settings: { size: 40 } })).settings, { ...settings, size: 40 });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.userData, 'local-vfx-settings.json'), 'utf8')), { ...settings, size: 40 });
  assert.deepEqual(fs.readdirSync(f.userData), ['local-vfx-settings.json']);
});

test('a failed preference save preserves current settings and removes the temporary write', async t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.userData, 'local-vfx-settings.json'));
  assert.deepEqual(await enable(f), { ok: false, error: 'local-vfx-storage-unavailable' });
  assert.equal(f.controller.status().settings.enabled, false);
  assert.deepEqual(fs.readdirSync(f.userData), ['local-vfx-settings.json']);
  assert.equal(f.windows.length, 0);
});

test('corrupt, oversized or invalid stored preferences keep playback disabled', async t => {
  for (const stored of ['{broken', ' '.repeat(8193), 'null', '[]', '{"enabled":"true"}', '{"enabled":true,"unexpected":1}']) {
    const f = fixture(t, { stored });
    assert.equal(f.controller.status().settings.enabled, false);
    assert.deepEqual(await f.invoke(channel, { action: 'play' }), { ok: false, error: 'local-vfx-disabled' });
    assert.equal(f.windows.length, 0);
  }
});

test('an overlay is sandboxed, mouse-ignoring, inactive and bounded to the selected display', async t => {
  const f = fixture(t, { anchor: { x: -1900, y: 930 } });
  const win = await start(f);
  assert.deepEqual(win.getBounds(), f.display.bounds);
  assert.equal(win.options.transparent, true);
  assert.equal(win.options.focusable, false);
  assert.equal(win.options.show, false);
  assert.equal(win.options.skipTaskbar, true);
  assert.equal(win.options.webPreferences.contextIsolation, true);
  assert.equal(win.options.webPreferences.sandbox, true);
  assert.equal(win.options.webPreferences.nodeIntegration, false);
  assert.deepEqual(win.calls.find(([name]) => name === 'setIgnoreMouseEvents'), ['setIgnoreMouseEvents', true, { forward: true }]);
  assert.deepEqual(win.webContents.openHandler({ url: 'https://example.test' }), { action: 'deny' });
  let prevented = 0;
  win.webContents.emit('will-navigate', { preventDefault() { prevented++; } }, 'https://example.test');
  assert.equal(prevented, 1);
  assert.equal(win.visible, false);
  ready(f, win);
  assert.equal(win.visible, true);
  assert.equal(starts(win).length, 1);
  assert.deepEqual(starts(win)[0][1].start, { x: 20, y: 1050 });
  assert.deepEqual(starts(win)[0][1].target, { x: 20, y: 1050 });
  assert.equal(win.calls.filter(([name]) => name === 'showInactive').length, 1);
  assert.deepEqual(f.unusedCalls, []);
});

test('overlay ready and done require exact window, frame, local file URL and run ID', async t => {
  const f = fixture(t);
  const win = await start(f);
  const expectedURL = win.webContents.mainFrame.url;
  for (const event of [f.mainEvent(), f.overlayEvent(win, { sender: webContents(expectedURL) }), f.overlayEvent(win, { senderFrame: { url: expectedURL } })]) {
    f.ipcMain.emit(readyChannel, event);
    f.ipcMain.emit(doneChannel, event, win.__localEffect.id);
    assert.equal(win.visible, false);
    assert.equal(win.isDestroyed(), false);
    assert.equal(starts(win).length, 0);
  }
  for (const url of [expectedURL + '?retry=1', expectedURL + '#fragment', 'https://example.test/local-vfx.html', pathToFileURL(path.join(path.dirname(win.file), 'other.html')).href]) {
    win.webContents.mainFrame.url = url;
    ready(f, win);
    done(f, win);
    assert.equal(win.isDestroyed(), false);
    assert.equal(starts(win).length, 0);
  }
  win.webContents.mainFrame.url = expectedURL;
  ready(f, win);
  done(f, win, 'wrong-run-id');
  assert.equal(win.isDestroyed(), false);
  done(f, win);
  assert.equal(win.isDestroyed(), true);
  assert.equal(f.clock.timers.size, 0);
});

test('replaying replaces the active overlay and stale ready/done cannot affect its successor', async t => {
  const f = fixture(t);
  const first = await start(f);
  const oldID = first.__localEffect.id;
  const result = trustedPlay(f);
  assert.equal(result.ok, true);
  const second = f.windows[1];
  assert.equal(first.isDestroyed(), true);
  assert.equal(f.windows.filter(win => !win.isDestroyed()).length, 1);
  assert.equal(f.clock.timers.size, 1);
  ready(f, first);
  done(f, first, oldID);
  assert.equal(second.isDestroyed(), false);
  assert.equal(second.visible, false);
  ready(f, second);
  done(f, second, oldID);
  assert.equal(second.isDestroyed(), false);
  assert.equal(starts(second).length, 1);
  done(f, second);
  assert.equal(f.clock.timers.size, 0);
});

test('duplicate readiness does not restart playback or extend its completion deadline', async t => {
  const f = fixture(t);
  const win = await start(f);
  ready(f, win);
  f.clock.advance(2000);
  ready(f, win);
  assert.equal(starts(win).length, 1);
  assert.equal(win.calls.filter(([name]) => name === 'showInactive').length, 1);
  f.clock.advance(5999);
  assert.equal(win.isDestroyed(), false);
  f.clock.advance(1);
  assert.equal(win.isDestroyed(), true);
  assert.equal(f.clock.timers.size, 0);
});

test('disabling or cancelling a pending playback prevents late readiness from showing it', async t => {
  for (const payload of [{ action: 'settings', settings: { enabled: false } }, { action: 'cancel' }]) {
    const f = fixture(t);
    const win = await start(f);
    assert.equal((await f.invoke(channel, payload)).ok, true);
    ready(f, win);
    done(f, win);
    assert.equal(win.isDestroyed(), true);
    assert.equal(win.visible, false);
    assert.equal(starts(win).length, 0);
    assert.equal(f.clock.timers.size, 0);
    assert.equal(f.controller.status().active, false);
  }
});

test('disabling an already shown effect releases its window and timeout immediately', async t => {
  const f = fixture(t);
  const win = await start(f);
  ready(f, win);
  assert.equal(win.visible, true);
  assert.equal((await f.invoke(channel, { action: 'settings', settings: { enabled: false } })).ok, true);
  assert.equal(win.isDestroyed(), true);
  assert.equal(f.controller.status().active, false);
  assert.equal(f.clock.timers.size, 0);
  ready(f, win);
  assert.equal(starts(win).length, 1);
});

test('pending loads and started animations expire and cleanup their only timeout', async t => {
  const pending = fixture(t);
  const pendingWindow = await start(pending);
  pending.clock.advance(9999);
  assert.equal(pendingWindow.isDestroyed(), false);
  pending.clock.advance(1);
  assert.equal(pendingWindow.isDestroyed(), true);
  assert.equal(pending.clock.timers.size, 0);
  for (const [effect, duration] of [['haunt', 7000]]) {
    const f = fixture(t);
    await f.invoke(channel, { action: 'settings', settings: { effect } });
    const win = await start(f);
    ready(f, win);
    f.clock.advance(duration + 999);
    assert.equal(win.isDestroyed(), false);
    f.clock.advance(1);
    assert.equal(win.isDestroyed(), true);
    assert.equal(f.clock.timers.size, 0);
  }
});

test('renderer crash, window closure and main closure release overlays and timers', async t => {
  for (const terminate of [
    (f, win) => win.webContents.emit('render-process-gone', {}, { reason: 'crashed' }),
    (f, win) => win.destroy(),
    f => { f.main.destroyed = true; f.main.emit('closed'); }
  ]) {
    const f = fixture(t);
    const win = await start(f);
    ready(f, win);
    terminate(f, win);
    assert.equal(win.isDestroyed(), true);
    assert.equal(f.controller.status().active, false);
    assert.equal(f.clock.timers.size, 0);
    ready(f, win);
    assert.equal(starts(win).length, 1);
  }
});

test('rejected loads cannot close a later run and leave no pending timeout', async t => {
  let rejectFirst;
  let loads = 0;
  const f = fixture(t, { loadFile: () => ++loads === 1 ? new Promise((resolve, reject) => { rejectFirst = reject; }) : Promise.resolve() });
  const first = await start(f);
  trustedPlay(f);
  const second = f.windows[1];
  rejectFirst(Error('synthetic load failure'));
  await Promise.resolve();
  assert.equal(first.isDestroyed(), true);
  assert.equal(second.isDestroyed(), false);
  assert.equal(f.clock.timers.size, 1);
  f.controller.cancel();
  assert.equal(f.clock.timers.size, 0);

  const rejected = fixture(t, { loadFile: () => Promise.reject(Error('synthetic load failure')) });
  await start(rejected);
  await Promise.resolve();
  assert.equal(rejected.windows[0].isDestroyed(), true);
  assert.equal(rejected.clock.timers.size, 0);
});

test('setup and rendering failures destroy partially created overlays', async t => {
  const failedConstructor = fixture(t, { throwAt: 'constructor' });
  await enable(failedConstructor);
  assert.deepEqual(trustedPlay(failedConstructor), { ok: false, error: 'local-vfx-unavailable' });
  assert.equal(failedConstructor.windows.length, 0);
  assert.equal(failedConstructor.controller.status().active, false);
  assert.equal(failedConstructor.clock.timers.size, 0);
  for (const throwAt of ['setIgnoreMouseEvents', 'setAlwaysOnTop', 'setWindowOpenHandler', 'loadFile']) {
    const f = fixture(t, { throwAt });
    await enable(f);
    assert.deepEqual(trustedPlay(f), { ok: false, error: 'local-vfx-unavailable' });
    assert.equal(f.windows[0].isDestroyed(), true, throwAt);
    assert.equal(f.controller.status().active, false, throwAt);
    assert.equal(f.clock.timers.size, 0, throwAt);
  }
  for (const throwAt of ['send', 'showInactive']) {
    const f = fixture(t, { throwAt });
    const win = await start(f);
    if (throwAt === 'send') win.webContents.send = () => { throw Error('synthetic IPC failure'); };
    assert.doesNotThrow(() => ready(f, win), throwAt);
    assert.equal(win.isDestroyed(), true, throwAt);
    assert.equal(f.controller.status().active, false, throwAt);
    assert.equal(f.clock.timers.size, 0, throwAt);
  }
});

test('native destruction or notification failures cannot prevent controller listener cleanup', async t => {
  for (const throwAt of ['destroy', 'notify']) {
    const f = fixture(t);
    const win = await start(f);
    ready(f, win);
    if (throwAt === 'destroy') {
      const destroyWindow = win.destroy.bind(win);
      win.destroy = () => { destroyWindow(); throw Error('synthetic native teardown failure'); };
    } else {
      f.main.webContents.send = () => { throw Error('synthetic notification failure'); };
    }
    assert.doesNotThrow(() => f.controller.destroy(), throwAt);
    assert.doesNotThrow(() => f.controller.destroy(), throwAt);
    assert.equal(f.controller.status().active, false, throwAt);
    assert.equal(f.clock.timers.size, 0, throwAt);
    assert.equal(f.handlers.size, 0, throwAt);
    assert.equal(f.ipcMain.eventNames().length, 0, throwAt);
    assert.equal(f.main.webContents.listenerCount('before-input-event'), 0, throwAt);
    assert.equal(f.main.listenerCount('closed'), 0, throwAt);
  }
});

test('local Escape cancellation and controller disposal are idempotent and remove listeners', async t => {
  const f = fixture(t);
  const win = await start(f);
  f.main.webContents.emit('before-input-event', {}, { type: 'keyUp', key: 'Escape' });
  assert.equal(win.isDestroyed(), false);
  f.main.webContents.emit('before-input-event', {}, { type: 'keyDown', key: 'Escape' });
  assert.equal(win.isDestroyed(), true);
  assert.equal(f.clock.timers.size, 0);
  trustedPlay(f);
  const second = f.windows[1];
  f.controller.destroy();
  f.controller.destroy();
  assert.equal(second.isDestroyed(), true);
  assert.equal(f.clock.timers.size, 0);
  assert.equal(f.handlers.size, 0);
  assert.equal(f.ipcMain.eventNames().length, 0);
  assert.equal(f.main.webContents.listenerCount('before-input-event'), 0);
  assert.equal(f.main.listenerCount('closed'), 0);
  assert.equal(f.powerMonitor.eventNames().length, 0);
  assert.deepEqual(await f.controller.request(f.mainEvent(), { action: 'play' }), { ok: false, error: 'local-vfx-forbidden' });
  assert.deepEqual(f.unusedCalls, []);
});

test('unknown or invalid invocation points never fall back to the current cursor or clamp to another location', async t => {
  for (const invocation of [null, undefined, {}, {x:1,y:2}, {x:-800,y:420,coordinateSpace:'unknown'}, {x:NaN,y:420,coordinateSpace:'screen-dip'}, {x:0,y:420,coordinateSpace:'screen-dip'}, {x:-800,y:420,coordinateSpace:'screen-dip',source:'claimed-shell'}]) {
    const f = fixture(t, {invocation});
    await enable(f);
    assert.deepEqual(trustedPlay(f), {ok:false,error:'local-vfx-invoke-point-unavailable'});
    assert.equal(f.windows.length, 0);
    assert.deepEqual(f.unusedCalls, []);
  }
});

test('physical screen coordinates are converted exactly once and a DIP point preserves the clicked ground anchor', async t => {
  const f = fixture(t, {invocation:{x:-1200,y:630,coordinateSpace:'screen-physical'}});
  const win = await start(f);
  ready(f,win);
  assert.deepEqual(win.__localEffect.start, {x:1120,y:540});
  assert.deepEqual(win.__localEffect.target, win.__localEffect.start);
  assert.deepEqual(f.unusedCalls, [['screenToDipPoint',{x:-1200,y:630}]]);
  const result = f.controller.playAt({x:-1000,y:520,coordinateSpace:'screen-dip'});
  assert.equal(result.active,true);
  assert.deepEqual(f.windows.at(-1).__localEffect.target,{x:920,y:640});
  assert.equal(f.unusedCalls.length,1);
});

test('renderer and command IPC cannot submit a claimed original invocation point', async t => {
  const f = fixture(t);
  await enable(f);
  for (const extra of [{target:{x:1,y:2}}, {origin:{x:1,y:2,coordinateSpace:'screen-dip'}}, {script:'x'}, {url:'file:///arbitrary'}]) {
    assert.deepEqual(await f.invoke(channel,{action:'play',...extra}),{ok:false,error:'local-vfx-invalid-request'});
  }
  assert.equal(f.windows.length,0);
});

test('only the exact texture-2 renderer contract starts an overlay, and failed decode stays invisible', async t => {
  for (const payload of [undefined, {}, {ok:false,error:'local-vfx-assets-failed'}, {...readyPayload,renderer:'haunt-reference-texture-1'}, {...readyPayload,durationMs:4400}, {...readyPayload,effect:'leer'}, {...readyPayload,extra:true}]) {
    const f = fixture(t), win = await start(f);
    f.ipcMain.emit(readyChannel,f.overlayEvent(win),payload);
    assert.equal(win.isDestroyed(),true);
    assert.equal(win.visible,false);
    assert.equal(starts(win).length,0);
    assert.equal(f.controller.status().notice,'local-vfx-assets-failed');
    assert.equal(f.clock.timers.size,0);
  }
});

test('unimplemented Leer never substitutes an old demo for the new Haunt renderer', async t => {
  const f = fixture(t);
  await f.invoke(channel,{action:'settings',settings:{enabled:true,effect:'leer'}});
  assert.equal(f.controller.status().assetsReady,false);
  assert.equal(f.controller.status().renderer,null);
  assert.deepEqual(await f.invoke(channel,{action:'play'}),{ok:false,error:'local-vfx-assets-pending'});
  assert.equal(f.windows.length,0);
});

test('display changes, suspension and preference changes clear their own active overlay', async t => {
  for (const terminate of [f=>f.screen.emit('display-added'),f=>f.screen.emit('display-removed'),f=>f.screen.emit('display-metrics-changed',{},f.display,['scaleFactor']),f=>f.powerMonitor.emit('suspend'),f=>f.invoke(channel,{action:'settings',settings:{strength:.5}})]) {
    const f = fixture(t), win = await start(f);
    ready(f,win);
    await terminate(f);
    assert.equal(win.isDestroyed(),true);
    assert.equal(f.clock.timers.size,0);
    f.controller.destroy();
    assert.equal(f.screen.eventNames().length,0);
    assert.equal(f.powerMonitor.eventNames().length,0);
    assert.equal(f.app.listenerCount('before-quit'),0);
  }
});

test('closing a native main window never accesses its already-destroyed webContents getter', async t => {
  for (const event of ['closed','will-quit']) {
    const f = fixture(t), win = await start(f);
    const contents = f.main.webContents;
    Object.defineProperty(f.main,'webContents',{get(){throw TypeError('Object has been destroyed');}});
    f.main.destroyed=true;
    assert.doesNotThrow(()=>event==='closed'?f.main.emit('closed'):f.app.emit('will-quit'));
    assert.equal(win.isDestroyed(),true);
    assert.equal(contents.listenerCount('before-input-event'),0);
    assert.equal(f.ipcMain.eventNames().length,0);
    assert.equal(f.handlers.size,0);
    assert.equal(f.clock.timers.size,0);
    assert.doesNotThrow(()=>f.controller.destroy());
  }
});

test('a vetoed quit cancels the effect while preserving working IPC for the still-open main window', async t => {
  const f=fixture(t), first=await start(f);
  ready(f,first);
  f.app.emit('before-quit',{preventDefault(){}});
  assert.equal(first.isDestroyed(),true);
  assert.equal(f.controller.status().allowed,true);
  assert.equal(f.handlers.size,1);
  assert.equal((await f.invoke(channel,{action:'play'})).ok,true);
  assert.equal(f.controller.status().placing,true);const picker=f.windows.at(-1),session=f.controller.status().placement.session;
  f.ipcMain.emit('tracer-local-vfx-placement-ready',f.overlayEvent(picker),{});f.clock.advance(300);
  f.ipcMain.emit('tracer-local-vfx-placement-point',f.overlayEvent(picker),{session,u:.5,v:.5});
  ready(f,f.windows.at(-1));
  assert.equal(f.windows.at(-1).visible,true);
  f.app.emit('will-quit');
  assert.equal(f.handlers.size,0);
  assert.equal(f.app.eventNames().length,0);
});

test('late IPC with a disposed or null sender frame is rejected without throwing', async t => {
  const f=fixture(t), win=await start(f);
  assert.deepEqual(await f.invoke(channel,{action:'status'},f.mainEvent({senderFrame:null})),{ok:false,error:'local-vfx-forbidden'});
  const badFrame={};
  Object.defineProperty(badFrame,'url',{get(){throw Error('disposed frame');}});
  win.webContents.mainFrame=badFrame;
  assert.doesNotThrow(()=>f.ipcMain.emit(readyChannel,f.overlayEvent(win),readyPayload));
  assert.doesNotThrow(()=>f.ipcMain.emit(doneChannel,f.overlayEvent(win,{senderFrame:null}),win.__localEffect.id));
  assert.equal(win.isDestroyed(),false);
  assert.equal(starts(win).length,0);
});


test('renderer Release creates only one picker and the subsequent armed normalized left click starts a fixed DIP effect', async t => {
 const f=fixture(t,{invocation:null});await enable(f);let result=await f.invoke(channel,{action:'play'});assert.equal(result.ok,true);assert.equal(result.placing,true);assert.equal(result.active,false);assert.equal(result.requiresInvocationPoint,false);
 const picker=f.windows[0],session=f.controller.status().placement.session;
 f.ipcMain.emit('tracer-local-vfx-placement-ready',f.overlayEvent(picker),{});
 await f.invoke(channel,{action:'play'});assert.equal(f.windows.length,1);assert.equal(f.controller.status().placement.session,session);
 const point={session,u:0.25,v:0.75};f.ipcMain.emit('tracer-local-vfx-placement-point',f.overlayEvent(picker),point);assert.equal(f.controller.status().placing,true);
 f.clock.advance(300);assert(picker.webContents.sent.some(m=>m[0]==='tracer-local-vfx-placement-armed'));
 f.ipcMain.emit('tracer-local-vfx-placement-point',f.overlayEvent(picker),point);assert.equal(picker.isDestroyed(),true);assert.equal(f.controller.status().placing,false);assert.equal(f.controller.status().active,true);
 const effect=f.windows[1];assert.deepEqual(effect.__localEffect.target,{x:480,y:810});assert.deepEqual(effect.__localEffect.start,effect.__localEffect.target);assert.deepEqual(effect.calls[0],['setIgnoreMouseEvents',true,{forward:true}]);
 assert.equal(f.ipcMain.listenerCount('tracer-local-vfx-placement-point'),0);assert.deepEqual(f.unusedCalls,[]);
});
test('selection Escape, timeout, suspend and display change clean pickers without starting an effect', async t => {
 for(const cause of ['escape','timeout','suspend','display']){const f=fixture(t);await enable(f);await f.invoke(channel,{action:'play'});const picker=f.windows[0];
  if(cause==='escape')picker.webContents.emit('before-input-event',{preventDefault(){}},{type:'keyDown',key:'Escape'});
  if(cause==='timeout')f.clock.advance(20000);if(cause==='suspend')f.powerMonitor.emit('suspend');if(cause==='display')f.screen.emit('display-metrics-changed');
  assert.equal(picker.isDestroyed(),true);assert.equal(f.controller.status().placing,false);assert.equal(f.controller.status().active,false);assert.equal(f.clock.timers.size,0);assert.equal(f.ipcMain.listenerCount('tracer-local-vfx-placement-point'),0);
  if(cause==='timeout')assert.equal(f.controller.status().notice,'local-vfx-placement-timeout');if(cause==='display')assert.equal(f.controller.status().notice,'local-vfx-display-changed');
 }
});
test('late picker points after cancel and settings changes never start an effect', async t => {
 const f=fixture(t);await enable(f);await f.invoke(channel,{action:'play'});const picker=f.windows[0],session=f.controller.status().placement.session;
 await f.invoke(channel,{action:'cancel'});f.ipcMain.emit('tracer-local-vfx-placement-point',f.overlayEvent(picker),{session,u:.5,v:.5});assert.equal(f.controller.status().active,false);
 await f.invoke(channel,{action:'play'});const second=f.windows[1];await f.invoke(channel,{action:'settings',settings:{enabled:false}});assert(second.isDestroyed());assert.equal(f.controller.status().placing,false);
});


test('placement creation failure survives menu fallback into configuration without a stale picker',async t=>{
 const f=fixture(t,{throwAt:'constructor'});assert.equal((await enable(f)).ok,true);
 const release=f.controller.menuItems().find(row=>row.submenu)?.submenu.find(row=>row.label.includes('Release:'));assert(release);release.click();
 assert.equal(f.controller.status().notice,'local-vfx-placement-unavailable');assert.equal(f.controller.status().placing,false);assert.equal(f.controller.status().active,false);
 assert(f.unusedCalls.includes('showMain'));assert.equal(f.clock.timers.size,0);assert.equal(f.windows.length,0);
});
