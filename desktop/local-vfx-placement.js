'use strict';

const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { performance } = require('node:perf_hooks');

const TIMEOUT_MS = 20000;
const ARM_DELAY_MS = 300;
const CHANNELS = Object.freeze({
  ready: 'tracer-local-vfx-placement-ready',
  init: 'tracer-local-vfx-placement-init',
  armed: 'tracer-local-vfx-placement-armed',
  point: 'tracer-local-vfx-placement-point',
  cancel: 'tracer-local-vfx-placement-cancel'
});

// Inspect data descriptors before reading values: unknown keys and accessors are
// rejected without executing a caller-provided getter.
function exactRecord(value, keys) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) return null;
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key))) return null;
    const data = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
      data[key] = descriptor.value;
    }
    return data;
  } catch (_) { return null; }
}

function bounds(value) {
  if (!value || !['x', 'y', 'width', 'height'].every(key => Number.isSafeInteger(value[key]))) return null;
  if (Math.abs(value.x) > 1000000 || Math.abs(value.y) > 1000000 || value.width < 1 || value.height < 1 || value.width > 32768 || value.height > 32768) return null;
  return Object.freeze({ x: value.x, y: value.y, width: value.width, height: value.height });
}
function sameBounds(a, b) {
  return !!a && !!b && ['x', 'y', 'width', 'height'].every(key => a[key] === b[key]);
}
function withinBounds(inner, outer) {
  return inner && outer && inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

function createPlacement(options) {
  if (!options || typeof options.BrowserWindow !== 'function' || !options.screen || !options.ipcMain ||
    typeof options.screen.getAllDisplays !== 'function' || typeof options.screen.on !== 'function' ||
    typeof options.screen.removeListener !== 'function' || typeof options.ipcMain.on !== 'function' ||
    typeof options.ipcMain.removeListener !== 'function' || typeof options.html !== 'string' ||
    typeof options.preload !== 'string' || typeof options.onSelect !== 'function') {
    throw new TypeError('local-vfx-placement-capability-required');
  }
  const schedule = options.schedule || setTimeout;
  const unschedule = options.unschedule || clearTimeout;
  const now = options.now || (() => performance.now());
  if (![schedule, unschedule, now].every(value => typeof value === 'function')) throw new TypeError('local-vfx-placement-clock-required');
  const html = resolve(options.html), preload = resolve(options.preload);
  const expectedURL = pathToFileURL(html).href;
  let active = null, dead = false, lastReason = null;

  function status() {
    return Object.freeze({ phase: active?.phase || 'idle', session: active?.session || null,
      displayCount: active?.records.length || 0, readyCount: active?.records.filter(record => record.ready).length || 0,
      armed: active?.phase === 'armed', reason: lastReason, destroyed: dead });
  }
  function listen(group, target, name, listener) {
    target.on(name, listener);
    group.removers.push(() => target.removeListener(name, listener));
  }
  function isCurrent(group) { return active === group && !group.closed && !dead; }
  function timer(group, callback, delay) {
    const entry = { handle: null, pending: true };
    group.timers.add(entry);
    entry.handle = schedule(() => {
      if (!entry.pending) return;
      entry.pending = false;
      group.timers.delete(entry);
      if (isCurrent(group)) callback();
    }, delay);
    // Also handle an injected scheduler that executes synchronously.
    if (group.closed && entry.pending) {
      entry.pending = false;
      group.timers.delete(entry);
      unschedule(entry.handle);
    }
  }
  function finish(group, phase, reason, point) {
    if (active !== group || group.closed) return;
    const session = group.session;
    group.closed = true;
    group.session = null;
    active = null;
    lastReason = reason;
    for (const entry of group.timers) {
      entry.pending = false;
      try { unschedule(entry.handle); } catch (_) {}
    }
    group.timers.clear();
    for (const remove of group.removers.splice(0)) { try { remove(); } catch (_) {} }
    // Revoke the complete group before any callback or native destruction.
    let cleanupFailed = false;
    for (const record of group.records) {
      try { delete record.window.__pickerSession; } catch (_) {}
      try { if (!record.window.isDestroyed()) record.window.destroy(); } catch (_) {}
      let destroyed = false;
      try { destroyed = record.window.isDestroyed(); } catch (_) {}
      if (!destroyed) {
        try { record.window.close?.(); } catch (_) {}
        try { destroyed = record.window.isDestroyed(); } catch (_) {}
      }
      if (!destroyed) {
        cleanupFailed = true;
        try { record.window.hide?.(); } catch (_) {}
        try { record.window.setIgnoreMouseEvents?.(true); } catch (_) {}
      }
    }
    if (cleanupFailed) {
      phase = 'error';
      reason = lastReason = 'picker-destroy-failed';
      point = null;
    }
    if (point) {
      try { options.onSelect(point); } catch (_) { phase = 'error'; reason = lastReason = 'selection-callback-failed'; }
    }
    try { options.onFinish?.(Object.freeze({ phase, reason, session })); } catch (_) {}
  }
  function fail(group, reason) { finish(group, 'error', reason); }
  function cancel(reason = 'explicit-cancel') {
    if (active) finish(active, 'cancel', typeof reason === 'string' && reason.length <= 128 ? reason : 'explicit-cancel');
    return status();
  }
  function currentDisplays() {
    const displays = options.screen.getAllDisplays();
    if (!Array.isArray(displays) || displays.length < 1 || displays.length > 16) throw new Error('display-unavailable');
    const seen = new Set();
    return displays.map(display => {
      const rectangle = bounds(display?.bounds);
      if (!rectangle || !Number.isSafeInteger(display.id) || seen.has(display.id) ||
        !Number.isFinite(display.scaleFactor) || display.scaleFactor <= 0 || display.scaleFactor > 8) throw new Error('display-unavailable');
      seen.add(display.id);
      return Object.freeze({ id: display.id, bounds: rectangle, scaleFactor: display.scaleFactor });
    });
  }
  function unchangedDisplay(group, record) {
    const current = currentDisplays();
    if (current.length !== group.displays.length) return false;
    if (!group.displays.every(original => {
      const display = current.find(item => item.id === original.id);
      return display && sameBounds(original.bounds, display.bounds) && original.scaleFactor === display.scaleFactor;
    })) return false;
    return current.find(display => display.id === record.display.id);
  }
  function sender(group, event) {
    if (!isCurrent(group) || !event) return null;
    const record = group.records.find(item => item.contents === event.sender);
    if (!record) return null;
    try {
      if (record.window.isDestroyed() || record.contents.isDestroyed() || !event.senderFrame ||
        event.senderFrame !== record.contents.mainFrame || event.senderFrame.url !== expectedURL ||
        record.contents.getURL() !== expectedURL) return null;
    } catch (_) { return null; }
    return record;
  }
  function readyAll(group) {
    if (!isCurrent(group) || group.creating || group.initialized || !group.records.every(record => record.ready)) return;
    group.initialized = true;
    try {
      for (const record of group.records) {
        const display = unchangedDisplay(group, record);
        const content = bounds(record.window.getContentBounds());
        if (!display || !withinBounds(content, display.bounds)) throw new Error();
        record.contentBounds = content;
      }
      for (const record of group.records) {
        record.contents.send(CHANNELS.init, Object.freeze({ session: group.session, armDelayMs: ARM_DELAY_MS }));
        if (!isCurrent(group)) return;
      }
      if (options.showWindows !== false) {
        for (const record of group.records) {
          record.window.showInactive();
          if (!isCurrent(group)) return;
        }
        let primaryId;
        try { primaryId = options.screen.getPrimaryDisplay?.().id; } catch (_) {}
        const primary = group.records.find(record => record.display.id === primaryId) || group.records[0];
        primary.window.focus();
        if (!isCurrent(group)) return;
      }
      group.armAt = now() + ARM_DELAY_MS;
      if (!Number.isFinite(group.armAt)) throw new Error();
      const arm = () => {
        try {
          const remaining = group.armAt - now();
          if (!Number.isFinite(remaining)) { fail(group, 'placement-clock-failed'); return; }
          if (remaining > 0) { timer(group, arm, remaining); return; }
          group.phase = 'armed';
          for (const record of group.records) {
            record.contents.send(CHANNELS.armed, Object.freeze({ session: group.session }));
            if (!isCurrent(group)) return;
          }
          // UI notification is advisory; it cannot break placement or cleanup.
          try { options.onState?.(status()); } catch (_) {}
        } catch (_) { fail(group, 'picker-arm-failed'); }
      };
      timer(group, arm, ARM_DELAY_MS);
    } catch (_) { fail(group, 'picker-prepare-failed'); }
  }
  function installIPC(group) {
    listen(group, options.ipcMain, CHANNELS.ready, (event, payload) => {
      const record = sender(group, event);
      if (!record || !exactRecord(payload, []) || record.ready) return;
      record.ready = true;
      readyAll(group);
    });
    listen(group, options.ipcMain, CHANNELS.point, (event, payload) => {
      const record = sender(group, event), data = exactRecord(payload, ['session', 'u', 'v']);
      if (!record || !data || data.session !== group.session || group.phase !== 'armed' ||
        ![data.u, data.v].every(value => Number.isFinite(value) && value >= 0 && value < 1)) return;
      try {
        if (!Number.isFinite(now()) || now() < group.armAt) return;
        const display = unchangedDisplay(group, record), content = bounds(record.window.getContentBounds());
        if (!display || !sameBounds(content, record.contentBounds) || !withinBounds(content, display.bounds)) {
          finish(group, 'cancel', 'display-changed'); return;
        }
        const point = Object.freeze({ x: content.x + data.u * content.width, y: content.y + data.v * content.height, coordinateSpace: 'screen-dip' });
        if (point.x < display.bounds.x || point.y < display.bounds.y || point.x >= display.bounds.x + display.bounds.width || point.y >= display.bounds.y + display.bounds.height) return;
        finish(group, 'selected', 'selected', point);
      } catch (_) { fail(group, 'picker-point-failed'); }
    });
    listen(group, options.ipcMain, CHANNELS.cancel, (event, payload) => {
      const data = exactRecord(payload, ['session']);
      if (sender(group, event) && data && data.session === group.session) finish(group, 'cancel', 'escape');
    });
  }
  function start() {
    if (dead || active) return status();
    const group = { session: randomUUID(), phase: 'preparing', closed: false, creating: true,
      initialized: false, records: [], displays: [], removers: [], timers: new Set(), armAt: Infinity };
    active = group;
    lastReason = null;
    try {
      timer(group, () => finish(group, 'timed-out', 'placement-timeout'), TIMEOUT_MS);
      if (!isCurrent(group)) return status();
      group.displays = currentDisplays();
      installIPC(group);
      for (const name of ['display-added', 'display-removed', 'display-metrics-changed']) {
        listen(group, options.screen, name, () => finish(group, 'cancel', 'display-changed'));
      }
      for (const display of group.displays) {
        const window = new options.BrowserWindow({ ...display.bounds, show: false, frame: false, transparent: true,
          backgroundColor: '#00000000', focusable: true, alwaysOnTop: true, skipTaskbar: true,
          resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
          hasShadow: false, roundedCorners: false,
          webPreferences: { preload, nodeIntegration: false, contextIsolation: true, sandbox: true,
            webSecurity: true, allowRunningInsecureContent: false, devTools: false } });
        // Store ownership before setup/load, which can fail synchronously.
        const record = { window, contents: null, display, ready: false, contentBounds: null };
        group.records.push(record);
        Object.defineProperty(window, '__pickerSession', { value: group.session, configurable: true });
        record.contents = window.webContents;
        const contents = record.contents;
        listen(group, window, 'closed', () => fail(group, 'picker-window-closed'));
        listen(group, contents, 'render-process-gone', () => fail(group, 'picker-renderer-gone'));
        listen(group, contents, 'destroyed', () => fail(group, 'picker-renderer-gone'));
        listen(group, contents, 'did-fail-load', (_event, _code, _description, _url, isMainFrame) => {
          if (isMainFrame !== false) fail(group, 'picker-load-failed');
        });
        for (const name of ['will-navigate', 'will-redirect']) {
          listen(group, contents, name, event => { event.preventDefault(); fail(group, 'picker-navigation-blocked'); });
        }
        listen(group, contents, 'before-input-event', (event, input) => {
          if (input?.type === 'keyDown' && input.key === 'Escape' && isCurrent(group)) {
            event.preventDefault(); finish(group, 'cancel', 'escape');
          }
        });
        contents.setWindowOpenHandler?.(() => ({ action: 'deny' }));
        listen(group, contents, 'will-attach-webview', event => { event.preventDefault(); });
        listen(group, contents, 'content-bounds-updated', event => { event.preventDefault(); });
        window.setMenuBarVisibility?.(false);
        window.setAlwaysOnTop?.(true, 'screen-saver');
        window.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: true });
        window.setIgnoreMouseEvents?.(false);
        const loaded = window.loadFile(html);
        Promise.resolve(loaded).catch(() => { if (isCurrent(group)) fail(group, 'picker-load-failed'); });
        if (!isCurrent(group)) return status();
      }
      group.creating = false;
      readyAll(group);
    } catch (_) { fail(group, 'picker-create-failed'); }
    return status();
  }
  function destroy() {
    if (dead) return;
    dead = true;
    if (active) finish(active, 'cancel', 'manager-destroyed');
  }
  return Object.freeze({ start, cancel, status, destroy });
}

module.exports = Object.freeze({ createPlacement, CHANNELS, TIMEOUT_MS, ARM_DELAY_MS });
