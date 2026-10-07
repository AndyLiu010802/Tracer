'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const M = require('./local-vfx-model');
const { createPlacement } = require('./local-vfx-placement');

const RENDERER = 'haunt-reference-texture-2';
const DURATION = 7000;
const PUBLIC_ERRORS = new Set(['local-vfx-invalid-settings', 'local-vfx-storage-unavailable', 'local-vfx-disabled', 'local-vfx-assets-pending', 'local-vfx-assets-failed', 'local-vfx-invalid-request', 'local-vfx-invoke-point-unavailable', 'local-vfx-placement-unavailable']);
function record(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && keys.includes(key) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
}

function attachLocalVfx(main, { app, profile, origin, userData, getOrigin = () => null, showMain = () => {}, visualsReady = false, dependencies = require('electron') } = {}) {
  if (!M.allowed(app, profile)) return { menuItems: () => [], destroy() {}, cancel() { return false; } };
  const { BrowserWindow, screen, ipcMain, powerMonitor, setTimeout: schedule = setTimeout, clearTimeout: unschedule = clearTimeout } = dependencies;
  const file = path.join(userData, 'local-vfx-settings.json');
  const html = path.join(__dirname, 'local-vfx.html');
  const htmlURL = pathToFileURL(html).href;
  const mainContents = main.webContents;
  let settings = M.defaults, overlay = null, timer = null, token = null, dead = false, notice = '', placement = null;
  try {
    const stat = fs.lstatSync(file);
    if (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 8192) settings = M.normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {}
  const assetsReady = () => visualsReady === true && settings.effect === 'haunt';
  const status = () => ({ allowed: !dead, settings, effects: M.effects, active: !!overlay, placing: !!placement && placement.status().phase !== 'idle', placement: placement?.status() || {phase:'idle'}, assetsReady: assetsReady(), requiresInvocationPoint: false, renderer: assetsReady() ? RENDERER : null, notice });
  const notify = () => {
    try { if (!dead && !main.isDestroyed()) mainContents.send('tracer-local-vfx-state', status()); } catch {}
  };
  function save(next) {
    const temporary = path.join(userData, '.local-vfx-' + randomUUID() + '.tmp');
    let created = false;
    try {
      fs.mkdirSync(userData, { recursive: true });
      fs.writeFileSync(temporary, JSON.stringify(next), { flag: 'wx', mode: 0o600 });
      created = true;
      fs.renameSync(temporary, file);
    } catch {
      if (created) try { fs.unlinkSync(temporary); } catch {}
      throw Error('local-vfx-storage-unavailable');
    }
  }
  function stopEffect() {
    const win = overlay;
    overlay = null;
    token = null;
    if (timer !== null) unschedule(timer);
    timer = null;
    try { if (win && !win.isDestroyed()) win.destroy(); } catch { try { if (!win.isDestroyed()) win.close(); } catch {} }
    notify();
    return !!win;
  }
  function cancel() {
    const hadPicker = !!placement && placement.status().phase !== 'idle';
    placement?.cancel('explicit-cancel');
    return stopEffect() || hadPicker;
  }
  function beginPlacement() {
    if (dead || !settings.enabled) throw Error('local-vfx-disabled');
    if (!assetsReady()) throw Error('local-vfx-assets-pending');
    notice = ''; stopEffect(); placement.start(); notify();
    if (placement.status().phase === 'idle') throw Error('local-vfx-placement-unavailable');
    return status();
  }
  // Only trusted main-process adapters can call playAt. Neither renderer IPC
  // nor command-line arguments can supply their own claimed invocation point.
  function resolveOrigin(value) {
    if (!record(value, ['x', 'y', 'coordinateSpace']) || Reflect.ownKeys(value).length !== 3 || !Number.isFinite(value.x) || !Number.isFinite(value.y)) throw Error('local-vfx-invoke-point-unavailable');
    let point;
    if (value.coordinateSpace === 'screen-dip') point = { x: value.x, y: value.y };
    else if (value.coordinateSpace === 'screen-physical' && typeof screen.screenToDipPoint === 'function') point = screen.screenToDipPoint({ x: value.x, y: value.y });
    else throw Error('local-vfx-invoke-point-unavailable');
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) throw Error('local-vfx-invoke-point-unavailable');
    const display = screen.getDisplayNearestPoint(point), b = display?.bounds;
    if (!b || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(b[k])) || b.width <= 0 || b.height <= 0 || b.width > 32768 || b.height > 32768 || point.x < b.x || point.x >= b.x + b.width || point.y < b.y || point.y >= b.y + b.height) throw Error('local-vfx-invoke-point-unavailable');
    return { bounds: { x: b.x, y: b.y, width: b.width, height: b.height }, target: { x: point.x - b.x, y: point.y - b.y } };
  }
  function playAt(invocation) {
    if (dead || !settings.enabled) throw Error('local-vfx-disabled');
    if (!assetsReady()) throw Error('local-vfx-assets-pending');
    const { bounds: b, target } = resolveOrigin(invocation);
    notice = '';
    cancel();
    const packet = { ...settings, width: b.width, height: b.height, start: { ...target }, target, seed: Date.now() % 2147483647, id: randomUUID() };
    token = packet.id;
    try {
      const win = new BrowserWindow({ ...b, transparent: true, frame: false, focusable: false, resizable: false, movable: false, maximizable: false, minimizable: false, fullscreenable: false, hasShadow: false, alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: '#00000000', title: 'Tracer Local Visual Effect', webPreferences: { preload: path.join(__dirname, 'local-vfx-preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
      overlay = win;
      win.setIgnoreMouseEvents(true, { forward: true });
      win.setAlwaysOnTop(true, 'screen-saver');
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', (event, url) => { if (url !== htmlURL) event.preventDefault(); });
      const fail = () => { if (overlay === win) { notice = 'local-vfx-assets-failed'; cancel(); } };
      win.webContents.on('render-process-gone', fail);
      win.on('closed', () => {
        if (overlay === win) { overlay = null; token = null; if (timer !== null) unschedule(timer); timer = null; notify(); }
      });
      timer = schedule(fail, 10000);
      win.__localEffect = packet;
      win.loadFile(html).catch(fail);
      notify();
      return status();
    } catch (error) { cancel(); throw error; }
  }
  function play() { return playAt(getOrigin()); }
  placement = createPlacement({ BrowserWindow, screen, ipcMain, schedule, unschedule,
    now: dependencies.now, showWindows: dependencies.placementShowWindows,
    html: path.join(__dirname,'local-vfx-placement.html'), preload: path.join(__dirname,'local-vfx-placement-preload.js'),
    onSelect: point => playAt(point), onState: notify,
    onFinish: result => { if(result.phase==='timed-out') notice='local-vfx-placement-timeout';
      else if(result.phase==='error') notice='local-vfx-placement-unavailable';
      else if(result.reason==='display-changed') notice='local-vfx-display-changed';
      else if(result.phase==='cancel' && !dead && notice!=='local-vfx-display-changed') notice='local-vfx-placement-cancelled'; notify(); }
  });
  const trustedMain = event => { try { return !!event?.senderFrame && !main.isDestroyed() && event.sender === mainContents && event.senderFrame === mainContents.mainFrame && event.senderFrame.url === origin + '/'; } catch { return false; } };
  const trustedOverlay = event => { try { return !!event?.senderFrame && !!overlay && !overlay.isDestroyed() && event.sender === overlay.webContents && event.senderFrame === overlay.webContents.mainFrame && event.senderFrame.url === htmlURL; } catch { return false; } };
  async function request(event, value) {
    if (dead || !M.allowed(app, profile) || !trustedMain(event)) return { ok: false, error: 'local-vfx-forbidden' };
    if (!record(value, ['action', 'settings']) || !['status', 'settings', 'play', 'cancel', 'open'].includes(value.action) || (value.action !== 'settings' && Object.hasOwn(value, 'settings'))) return { ok: false, error: 'local-vfx-invalid-request' };
    try {
      if (JSON.stringify(value).length > 8192) throw Error('local-vfx-invalid-request');
      if (value.action === 'settings') {
        if (!record(value.settings, Object.keys(M.defaults))) throw Error('local-vfx-invalid-settings');
        const next = M.normalize(value.settings, settings);
        save(next); settings = next;
        // Every preference change ends the old effect; it cannot leave an old
        // atmosphere active while the selected effect/settings say otherwise.
        cancel(); notify();
      }
      if (value.action === 'play') beginPlacement();
      if (value.action === 'cancel') cancel();
      if (value.action === 'open') configure();
      return { ok: true, ...status() };
    } catch (error) { return { ok: false, error: PUBLIC_ERRORS.has(error?.message) ? error.message : 'local-vfx-unavailable' }; }
  }
  function configure(reason = '') {
    if (dead) return { ok: false, error: 'local-vfx-forbidden' };
    notice = ['local-vfx-assets-pending', 'local-vfx-disabled', 'local-vfx-assets-failed', 'local-vfx-invoke-point-unavailable', 'local-vfx-display-changed', 'local-vfx-placement-unavailable'].includes(reason) ? reason : '';
    showMain(); mainContents.send('tracer-local-vfx-open'); notify();
    return { ok: true, ...status() };
  }
  function ready(event, value) {
    if (!trustedOverlay(event) || overlay.__localEffectReady) return;
    const win = overlay;
    if (!record(value, ['ok', 'effect', 'renderer', 'durationMs']) || Reflect.ownKeys(value).length !== 4 || value.ok !== true || value.effect !== 'haunt' || value.renderer !== RENDERER || value.durationMs !== DURATION) {
      notice = 'local-vfx-assets-failed'; cancel(); return;
    }
    win.__localEffectReady = true;
    try {
      unschedule(timer);
      timer = schedule(() => { if (overlay === win) cancel(); }, DURATION + 1000);
      win.webContents.send('tracer-local-vfx-start', win.__localEffect);
      win.showInactive();
    } catch { if (overlay === win) cancel(); }
  }
  function done(event, id) { if (trustedOverlay(event) && id === token) cancel(); }
  function escape(_event, input) { if (input?.type === 'keyDown' && input.key === 'Escape') cancel(); }
  function topologyChanged() { if (overlay || placement.status().phase !== 'idle') { notice = 'local-vfx-display-changed'; cancel(); } }
  const owned = [];
  function listen(emitter, event, handler) { if (typeof emitter?.on === 'function') { emitter.on(event, handler); owned.push([emitter, event, handler]); } }
  ipcMain.handle('tracer-local-vfx', request);
  listen(ipcMain, 'tracer-local-vfx-ready', ready);
  listen(ipcMain, 'tracer-local-vfx-done', done);
  listen(mainContents, 'before-input-event', escape);
  listen(main, 'closed', destroy);
  // A renderer can veto before-quit to protect unsaved work. End the effect
  // immediately, but keep the capability alive until quit actually commits.
  listen(app, 'before-quit', cancel);
  listen(app, 'will-quit', destroy);
  listen(powerMonitor, 'suspend', cancel);
  for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) listen(screen, event, topologyChanged);
  function destroy() {
    if (dead) return;
    dead = true;
    placement.destroy();
    stopEffect();
    try { ipcMain.removeHandler('tracer-local-vfx'); } catch {}
    for (const [emitter, event, handler] of owned.splice(0)) try { emitter.removeListener(event, handler); } catch {}
  }
  return { request, status, play, playAt, beginPlacement, cancel, configure, destroy, menuItems: () => dead ? [] : [{ type: 'separator' }, { label: '本地特效 / Local effects', submenu: [{ label: '选择和设置 / Choose and configure', click: () => configure() }, { label: '释放 / Release: ' + M.effects.find(effect => effect.id === settings.effect).name, enabled: settings.enabled && assetsReady(), click: () => { try { beginPlacement(); } catch (error) { configure(error?.message); } } }, { label: '取消特效 / Cancel effect', enabled: !!overlay || placement.status().phase !== 'idle', click: cancel }] }] };
}
module.exports = { attachLocalVfx };
