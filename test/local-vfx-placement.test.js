'use strict';

// These tests exercise the main-process contract with mocks. They do not
// establish physical pointer provenance or real Windows/DPI behavior.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createPlacement, CHANNELS, TIMEOUT_MS, ARM_DELAY_MS } = require('../desktop/local-vfx-placement');

const DEFAULT_DISPLAYS = [
  { id: 1, bounds: { x: 0, y: 0, width: 1600, height: 900 }, scaleFactor: 1.5 },
  { id: 2, bounds: { x: -1280, y: -80, width: 1280, height: 900 }, scaleFactor: 2 }
];
function harness(settings = {}) {
  let time = 0, sequence = 0;
  const scheduled = new Map(), allScheduled = [], windows = [], selected = [], finished = [];
  const ipcMain = new EventEmitter(), screen = new EventEmitter();
  let displays = structuredClone(settings.displays || DEFAULT_DISPLAYS);
  screen.getAllDisplays = () => displays;
  screen.getPrimaryDisplay = () => displays[0];
  const html = resolve(__dirname, '../desktop/local-vfx-placement.html');
  class Contents extends EventEmitter {
    constructor(window) {
      super(); this.window = window; this.destroyed = false; this.url = pathToFileURL(html).href;
      this.mainFrame = { url: this.url }; this.sent = [];
    }
    isDestroyed() { return this.destroyed; }
    getURL() { return this.url; }
    send(channel, payload) {
      if (settings.throwSend === this.window.index) throw new Error('send failed');
      if (settings.throwArmed === this.window.index && channel === CHANNELS.armed) throw new Error('armed send failed');
      this.sent.push({ channel, payload });
    }
    setWindowOpenHandler(handler) { this.openHandler = handler; }
  }
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super(); this.index = windows.length; this.options = options;
      if (settings.throwConstructor === this.index) throw new Error('constructor failed');
      this.destroyed = false; this.shown = 0; this.focused = 0;
      this.contentBounds = settings.contentBounds?.[this.index] || { x: options.x, y: options.y, width: options.width, height: options.height };
      this.webContents = new Contents(this); windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    getContentBounds() { return { ...this.contentBounds }; }
    setMenuBarVisibility() {}
    setAlwaysOnTop() {}
    setVisibleOnAllWorkspaces() {}
    setIgnoreMouseEvents(value) { this.ignoreMouseEvents = value; }
    hide() { this.hidden = true; }
    close() { if (settings.throwBeforeDestroy !== this.index) this.destroy(); }
    showInactive() { if (settings.throwShow === this.index) throw new Error('show failed'); this.shown++; }
    focus() { if (settings.throwFocus === this.index) throw new Error('focus failed'); this.focused++; }
    loadFile(file) {
      this.loadedFile = file;
      if (settings.throwLoad === this.index) throw new Error('load failed');
      if (settings.autoReady) ipcMain.emit(CHANNELS.ready, { sender: this.webContents, senderFrame: this.webContents.mainFrame }, {});
      if (settings.deferredLoads) return new Promise((_resolve, reject) => { this.rejectLoad = reject; });
      return Promise.resolve();
    }
    destroy() {
      if (settings.throwBeforeDestroy === this.index) throw new Error('destroy failed before destruction');
      this.destroyed = true; this.webContents.destroyed = true;
      this.webContents.emit('destroyed'); this.emit('closed');
      if (settings.throwDestroy === this.index) throw new Error('destroy failed');
    }
  }
  const options = { BrowserWindow, screen, ipcMain, html, preload: resolve(__dirname, '../desktop/local-vfx-placement-preload.js'),
    now: () => time, schedule: (callback, delay) => {
      const id = ++sequence, entry = { id, callback, at: time + delay };
      scheduled.set(id, entry); allScheduled.push(entry); return id;
    }, unschedule: id => scheduled.delete(id), showWindows: settings.showWindows,
    onSelect: point => { selected.push(point); settings.onSelect?.(point, { windows, scheduled, ipcMain, screen, manager }); },
    onState: value => settings.onState?.(value),
    onFinish: result => { finished.push(result); settings.onFinish?.(result); } };
  const manager = createPlacement(options);
  const event = (window = windows[0]) => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
  const ready = (window = windows[0], payload = {}) => ipcMain.emit(CHANNELS.ready, event(window), payload);
  const point = (window = windows[0], payload = { session: manager.status().session, u: 0.5, v: 0.5 }) => ipcMain.emit(CHANNELS.point, event(window), payload);
  const tick = milliseconds => {
    const until = time + milliseconds;
    for (;;) {
      const next = [...scheduled.values()].filter(entry => entry.at <= until).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!next) break;
      time = next.at; scheduled.delete(next.id); next.callback();
    }
    time = until;
  };
  const arm = () => { windows.forEach(window => ready(window)); tick(ARM_DELAY_MS); };
  const clean = () => {
    assert.equal(scheduled.size, 0);
    assert.equal(ipcMain.eventNames().length, 0);
    assert.equal(screen.eventNames().length, 0);
    for (const window of windows) {
      assert.equal(window.destroyed, true);
      assert.equal(window.eventNames().length, 0);
      assert.equal(window.webContents.eventNames().length, 0);
      assert.equal(Object.hasOwn(window, '__pickerSession'), false);
    }
  };
  return { manager, windows, selected, finished, screen, ipcMain, scheduled, allScheduled, event, ready, point, tick, arm, clean,
    setDisplays: value => { displays = value; } };
}

test('waits for every display, cooldown, then consumes one actual-content-bounds DIP point', () => {
  const h = harness({ contentBounds: [DEFAULT_DISPLAYS[0].bounds, { x: -1200, y: -20, width: 1000, height: 700 }],
    onSelect: (point, state) => {
      assert.equal(state.windows.every(window => window.destroyed), true);
      assert.equal(state.scheduled.size, 0);
      assert.equal(state.ipcMain.eventNames().length, 0);
      assert.equal(Object.isFrozen(point), true);
    } });
  const initial = h.manager.start(), session = initial.session;
  assert.equal(initial.phase, 'preparing'); assert.equal(initial.displayCount, 2);
  assert.match(session, /^[a-f0-9-]{36}$/);
  h.ready(h.windows[1]);
  assert.equal(h.windows.every(window => window.shown === 0), true);
  h.point(h.windows[1], { session, u: 0.25, v: 0.4 });
  assert.equal(h.selected.length, 0);
  h.ready(h.windows[0]);
  assert.deepEqual(h.windows.map(window => window.shown), [1, 1]);
  assert.deepEqual(h.windows.map(window => window.focused), [1, 0]);
  assert.deepEqual(h.windows[1].webContents.sent, [{ channel: CHANNELS.init, payload: { session, armDelayMs: ARM_DELAY_MS } }]);
  h.tick(299); h.point(h.windows[1], { session, u: 0.25, v: 0.4 });
  assert.equal(h.selected.length, 0);
  h.tick(1); assert.equal(h.manager.status().phase, 'armed');
  h.point(h.windows[1], { session, u: 0.25, v: 0.4 });
  assert.deepEqual(h.selected, [{ x: -950, y: 260, coordinateSpace: 'screen-dip' }]);
  h.point(h.windows[0], { session, u: 0.5, v: 0.5 });
  assert.equal(h.selected.length, 1); assert.equal(h.finished[0].phase, 'selected'); h.clean();
});

test('strict source, frame, URL and exact payload checks reject forged or malformed IPC', () => {
  const h = harness(); h.manager.start(); h.arm();
  const session = h.manager.status().session, window = h.windows[0], valid = { session, u: 0.25, v: 0.5 };
  for (const event of [{}, { sender: new EventEmitter(), senderFrame: window.webContents.mainFrame },
    { sender: window.webContents, senderFrame: { url: window.webContents.url } }, { sender: window.webContents, senderFrame: null }]) {
    h.ipcMain.emit(CHANNELS.point, event, valid);
  }
  window.webContents.mainFrame.url += '#other'; h.point(window, valid); window.webContents.mainFrame.url = window.webContents.url;
  window.webContents.url += '?other'; h.point(window, valid); window.webContents.url = window.webContents.mainFrame.url;
  let getterRan = false;
  const accessor = { session, v: 0.5 }; Object.defineProperty(accessor, 'u', { enumerable: true, get() { getterRan = true; return 0.5; } });
  for (const payload of [null, [], { ...valid, extra: true }, { ...valid, session: 'stale' }, { ...valid, u: NaN },
    { ...valid, u: Infinity }, { ...valid, u: 1 }, { ...valid, v: 1 }, { ...valid, u: -0.1 }, accessor,
    { ...valid, [Symbol('extra')]: true }, new Proxy({}, { ownKeys() { throw new Error(); } })]) h.point(window, payload);
  assert.equal(getterRan, false); assert.equal(h.selected.length, 0); assert.equal(h.manager.status().phase, 'armed');
  h.point(window, valid); assert.equal(h.selected.length, 1); h.clean();
});

test('ready accepts only an exact empty record and rejects stale/foreign frames', () => {
  const h = harness(); h.manager.start();
  h.ready(h.windows[0], { ready: true }); h.ready(h.windows[0], []);
  h.ipcMain.emit(CHANNELS.ready, { sender: h.windows[0].webContents, senderFrame: {} }, {});
  assert.equal(h.manager.status().readyCount, 0);
  h.ready(h.windows[0], Object.create(null)); assert.equal(h.manager.status().readyCount, 1);
  h.manager.cancel(); h.clean();
});

test('coalesces repeated start and repeated readiness without resetting cooldown or refocusing', () => {
  const h = harness(); const first = h.manager.start();
  assert.equal(h.manager.start().session, first.session); assert.equal(h.windows.length, 2);
  h.windows.forEach(window => h.ready(window)); h.tick(200);
  h.windows.forEach(window => h.ready(window)); h.tick(100);
  assert.equal(h.manager.status().phase, 'armed');
  assert.deepEqual(h.windows.map(window => window.focused), [1, 0]);
  assert.equal(h.windows[0].webContents.sent.length, 2);
  h.manager.cancel('effect-started'); assert.equal(h.finished[0].reason, 'effect-started'); h.clean();
});

test('timeout includes preparation and cannot be extended by late readiness', () => {
  const h = harness(); h.manager.start(); h.ready(h.windows[0]); h.tick(TIMEOUT_MS - 100);
  h.ready(h.windows[1]); h.tick(100);
  assert.equal(h.finished[0].phase, 'timed-out'); assert.equal(h.finished[0].reason, 'placement-timeout');
  assert.equal(h.selected.length, 0); h.clean();
  h.allScheduled.forEach(entry => entry.callback()); h.ready(h.windows[0]);
  assert.equal(h.windows.every(window => window.shown === 1), true); assert.equal(h.finished.length, 1);
});

test('late load failure, IPC and cancelled timers cannot affect a successor group', async () => {
  const h = harness({ deferredLoads: true }); const oldSession = h.manager.start().session;
  const oldWindows = h.windows.slice(), oldTimers = h.allScheduled.slice();
  h.manager.cancel('explicit-cancel'); const newSession = h.manager.start().session;
  assert.notEqual(newSession, oldSession);
  oldWindows.forEach(window => { h.ready(window); window.rejectLoad(new Error('late failure')); });
  oldTimers.forEach(entry => entry.callback());
  h.point(oldWindows[0], { session: oldSession, u: 0.5, v: 0.5 });
  await Promise.resolve();
  assert.equal(h.manager.status().session, newSession); assert.equal(h.finished.length, 1);
  assert.equal(h.windows.slice(2).every(window => window.shown === 0 && !window.destroyed), true);
  h.windows.slice(2).forEach(window => h.ready(window)); h.tick(ARM_DELAY_MS);
  h.point(h.windows[2]); assert.equal(h.selected.length, 1); h.clean();
});

test('selection callback may start a successor without reviving or duplicating old selection', () => {
  let starts = 0;
  const h = harness({ onSelect: (_point, state) => { starts++; assert.equal(state.manager.status().session, null); state.manager.start(); } });
  const oldSession = h.manager.start().session; h.arm(); h.point();
  assert.equal(starts, 1); assert.notEqual(h.manager.status().session, oldSession); assert.equal(h.windows.length, 4);
  h.point(h.windows[0], { session: oldSession, u: 0.5, v: 0.5 }); assert.equal(starts, 1);
  h.manager.cancel(); h.clean();
});

test('callback failure still consumes the session and leaves no owned resources', () => {
  const h = harness({ onSelect: () => { throw new Error('callback failed'); } }); h.manager.start(); h.arm(); h.point();
  assert.equal(h.finished[0].phase, 'error'); assert.equal(h.finished[0].reason, 'selection-callback-failed'); h.clean();
});

test('each construction, load, init, show and focus failure rolls back the complete group', () => {
  for (const settings of [{ throwConstructor: 1 }, { throwLoad: 1 }, { throwSend: 1 }, { throwShow: 1 }, { throwFocus: 0 }]) {
    const h = harness(settings); h.manager.start(); h.windows.forEach(window => h.ready(window));
    assert.equal(h.manager.status().phase, 'idle'); assert.equal(h.finished.length, 1); assert.equal(h.finished[0].phase, 'error'); h.clean();
  }
});

test('synchronous readiness cannot show a partially constructed display group', () => {
  const h = harness({ autoReady: true }); h.manager.start();
  assert.equal(h.windows.length, 2); assert.deepEqual(h.windows.map(window => window.shown), [1, 1]);
  h.tick(ARM_DELAY_MS); h.manager.cancel(); h.clean();
});

test('Escape keyDown cancels from an owned window; mouse input is not main-process point authority', () => {
  const h = harness(); h.manager.start(); let prevented = 0;
  const event = { preventDefault() { prevented++; } }, contents = h.windows[0].webContents;
  contents.emit('before-input-event', event, { type: 'mouseDown', button: 'left', x: 10, y: 20 });
  contents.emit('before-input-event', event, { type: 'keyUp', key: 'Escape' });
  assert.equal(h.selected.length, 0); assert.equal(h.finished.length, 0);
  contents.emit('before-input-event', event, { type: 'keyDown', key: 'Escape' });
  assert.equal(prevented, 1); assert.equal(h.finished[0].reason, 'escape'); h.clean();
});

test('cancel IPC needs the owned main frame and exact live session', () => {
  const h = harness(); const session = h.manager.start().session;
  h.ipcMain.emit(CHANNELS.cancel, h.event(), { session, reason: 'escape' });
  h.ipcMain.emit(CHANNELS.cancel, h.event(), { session: 'stale' });
  h.ipcMain.emit(CHANNELS.cancel, { sender: {}, senderFrame: {} }, { session });
  assert.equal(h.finished.length, 0);
  h.ipcMain.emit(CHANNELS.cancel, h.event(), { session }); assert.equal(h.finished[0].reason, 'escape'); h.clean();
});

test('window close, crash, load failure and display topology changes clean all resources', () => {
  for (const trigger of [h => h.windows[1].emit('closed'), h => h.windows[1].webContents.emit('render-process-gone', {}, { reason: 'crashed' }),
    h => h.windows[1].webContents.emit('did-fail-load', {}, -3, 'failed', 'file://bad', true),
    h => h.screen.emit('display-added'), h => h.screen.emit('display-removed'), h => h.screen.emit('display-metrics-changed')]) {
    const h = harness(); h.manager.start(); trigger(h); assert.equal(h.finished.length, 1); h.clean();
  }
});

test('rejects changed actual bounds or silently changed display scale at selection', () => {
  for (const change of [h => { h.windows[0].contentBounds.x++; }, h => { const displays = structuredClone(DEFAULT_DISPLAYS); displays[0].scaleFactor = 2; h.setDisplays(displays); }]) {
    const h = harness(); h.manager.start(); h.arm(); change(h); h.point();
    assert.equal(h.selected.length, 0); assert.equal(h.finished[0].reason, 'display-changed'); h.clean();
  }
});

test('bounds and display count are bounded before window creation', () => {
  for (const displays of [[], Array.from({ length: 17 }, (_, id) => ({ ...DEFAULT_DISPLAYS[0], id })),
    [{ ...DEFAULT_DISPLAYS[0], bounds: { x: 0, y: 0, width: Infinity, height: 100 } }],
    [{ ...DEFAULT_DISPLAYS[0], bounds: { x: 0, y: 0, width: 0, height: 100 } }]]) {
    const h = harness({ displays }); h.manager.start(); assert.equal(h.windows.length, 0); assert.equal(h.finished[0].phase, 'error'); h.clean();
  }
});

test('destroy is idempotent, disables restart, and survives a native destroy exception', () => {
  const h = harness({ throwDestroy: 0 }); h.manager.start(); h.manager.destroy(); h.manager.destroy();
  assert.equal(h.manager.start().destroyed, true); assert.equal(h.windows.length, 2); assert.equal(h.finished.length, 1); h.clean();
});

test('hidden test mode still arms and window preferences isolate the fixed picker', () => {
  const h = harness({ showWindows: false }); h.manager.start(); h.arm();
  assert.equal(h.windows.every(window => window.shown === 0 && window.focused === 0), true);
  for (const window of h.windows) {
    assert.equal(window.options.focusable, true); assert.equal(window.options.frame, false); assert.equal(window.options.transparent, true);
    assert.equal(window.options.webPreferences.sandbox, true); assert.equal(window.options.webPreferences.contextIsolation, true);
    assert.equal(window.options.webPreferences.nodeIntegration, false); assert.deepEqual(window.webContents.openHandler(), { action: 'deny' });
    let prevented = false; window.webContents.emit('content-bounds-updated', { preventDefault() { prevented = true; } }); assert.equal(prevented, true);
  }
  h.manager.cancel('suspend'); assert.equal(h.finished[0].reason, 'suspend'); h.clean();
});

test('main sends exact armed confirmation to every owned picker only after the cooldown', () => {
  const states = [];
  const h = harness({ onState: state => { states.push(state); throw new Error('advisory failure'); } });
  const session = h.manager.start().session;
  h.windows.forEach(window => h.ready(window)); h.tick(ARM_DELAY_MS - 1);
  assert.equal(h.windows.every(window => window.webContents.sent.length === 1), true);
  assert.equal(states.length, 0);
  h.tick(1);
  for (const window of h.windows) {
    assert.deepEqual(window.webContents.sent[1], { channel: CHANNELS.armed, payload: { session } });
    assert.equal(Object.isFrozen(window.webContents.sent[1].payload), true);
  }
  assert.equal(states.length, 1); assert.equal(states[0].phase, 'armed'); assert.equal(Object.isFrozen(states[0]), true);
  h.ready(h.windows[0]); h.tick(10); assert.equal(states.length, 1);
  h.point(); assert.equal(h.selected.length, 1); h.clean();
});

test('armed-confirmation send failure revokes and cleans the complete picker group', () => {
  const h = harness({ throwArmed: 1 }); h.manager.start(); h.windows.forEach(window => h.ready(window));
  assert.equal(h.finished.length, 0); h.tick(ARM_DELAY_MS);
  assert.equal(h.finished.length, 1); assert.equal(h.finished[0].phase, 'error'); assert.equal(h.finished[0].reason, 'picker-arm-failed');
  assert.equal(h.selected.length, 0); h.clean();
});

test('a picker surviving native destroy prevents selection and releases input best-effort', () => {
  const h = harness({ throwBeforeDestroy: 0 }); h.manager.start(); h.arm(); h.point();
  assert.equal(h.selected.length, 0); assert.equal(h.finished[0].phase, 'error'); assert.equal(h.finished[0].reason, 'picker-destroy-failed');
  assert.equal(h.windows[0].destroyed, false); assert.equal(h.windows[0].hidden, true); assert.equal(h.windows[0].ignoreMouseEvents, true);
  assert.equal(h.windows[1].destroyed, true);
  assert.equal(h.scheduled.size, 0); assert.equal(h.ipcMain.eventNames().length, 0); assert.equal(h.screen.eventNames().length, 0);
  for (const window of h.windows) {
    assert.equal(window.eventNames().length, 0); assert.equal(window.webContents.eventNames().length, 0);
    assert.equal(Object.hasOwn(window, '__pickerSession'), false);
  }
});
