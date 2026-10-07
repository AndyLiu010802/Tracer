'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { attachOverlayPointer } = require('./overlay-pointer');
const WINDOW_WIDTH = 304, WINDOW_HEIGHT = 208;

// The main application owns bait, catches and inventory. This window only
// forwards input: neither a renderer-supplied fish nor a catch reward is accepted.
function attachFishing(main, origin, userData, showMain, dependencies = require('electron')) {
  const { BrowserWindow, ipcMain, screen, Menu } = dependencies;
  let pointerGuard = null, menuOpen = false, gestureHeld = false;
  function setIgnored(value) { if (value !== passThrough) { passThrough = value; window.setIgnoreMouseEvents?.(value, { forward: true }); } }
  const file = path.join(userData, 'fishing-window.json');
  const actions = new Set(['cast-start', 'cast-release', 'hook', 'reel-start', 'reel-release', 'cancel', 'cast', 'hold', 'release', 'catch', 'open-home', 'open-tackle']);
  let saved = {}, window = null, snapshot = null, paused = false, drag = null, disposed = false, overlayReady = false;
  let nativeSessionId = randomUUID(), lastActionSequence = 0, passThrough = false;
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  saved.enabled = saved.enabled === true;
  saved.scale = Number.isFinite(saved.scale) ? Math.max(.5, Math.min(2.5, saved.scale)) : 1;

  function trusted(event, target, pathname) {
    if (!target || target.isDestroyed() || event.sender !== target.webContents || event.senderFrame !== target.webContents.mainFrame) return false;
    try { const url = new URL(event.senderFrame.url); return url.origin === origin && url.pathname === pathname; } catch { return false; }
  }
  function scope(value) {
    return [value?.accountScope || 'guest', value?.accountGeneration || 0, value?.accountRestoreId || ''];
  }
  function gameSession(value) { return value?.fishing?.sessionId || value?.sessionId || value?.session?.id || ''; }
  function sameScope(a, b) { return JSON.stringify(scope(a)) === JSON.stringify(scope(b)); }
  function rotateSession() { nativeSessionId = randomUUID(); lastActionSequence = 0; drag = null; gestureHeld = false; }
  function state() {
    return snapshot && { ...snapshot, nativeSessionId, desktopVisible: saved.enabled, desktopScale: saved.scale };
  }
  function sendSnapshot() {
    if (!paused && overlayReady && snapshot && window && !window.isDestroyed()) window.webContents.send('tracer-fishing-snapshot', state());
  }
  function persist() {
    if (window && !window.isDestroyed()) {
      const bounds = window.getBounds(); saved.x = bounds.x; saved.y = bounds.y;
    }
    try { fs.writeFileSync(file, JSON.stringify({ enabled: saved.enabled, x: saved.x, y: saved.y, scale: saved.scale })); } catch {}
  }
  function pauseAccount() {
    paused = true; snapshot = null; rotateSession();
    if (window && !window.isDestroyed()) window.hide();
  }
  function update(event, next) {
    if (!trusted(event, main, '/') || paused || !next || typeof next !== 'object' || Array.isArray(next)) return;
    // The overlay needs the current cast, not the growing collection ledger.
    // Bound this projection so a long-lived account can still fish on desktop.
    const projected = {};
    for (const key of ['accountScope', 'accountGeneration', 'accountRestoreId', 'language', 'lang', 'session', 'sessionId', 'rod', 'bait', 'spot', 'lastCatch', 'fish', 'disabled', 'recastRemaining', 'error', 'notice']) if (Object.hasOwn(next, key)) projected[key] = next[key];
    projected.fishing = { sessionId: gameSession(next) };
    if (next.desktopPond?.pond && Array.isArray(next.desktopPond.fish)) projected.desktopPond = {
      pond: { id: next.desktopPond.pond.id, style: next.desktopPond.pond.style, decorations: next.desktopPond.pond.decorations?.slice(0, 16) },
      fish: next.desktopPond.fish.slice(0, 5)
    };
    let serialized;
    try { serialized = JSON.stringify(projected); } catch { return; }
    if (serialized.length > 100000 || !Number.isSafeInteger(next.accountGeneration || 0) || (next.accountGeneration || 0) < 0) return;
    const scopeChanged = !snapshot || !sameScope(snapshot, next);
    if (scopeChanged || gameSession(snapshot) !== gameSession(next)) rotateSession();
    snapshot = projected;
    // The float can move under a stationary cursor. Restore native input from
    // the authoritative bite phase instead of waiting for a mouse-move event.
    if (projected.session?.phase === 'bite' && passThrough && window && !window.isDestroyed()) {
      passThrough = false; window.setIgnoreMouseEvents?.(false);
    }
    if (scopeChanged && window && !window.isDestroyed()) {
      overlayReady = false; window.hide(); window.webContents.reload();
    }
    sendSnapshot();
    if (saved.enabled && overlayReady && window && !window.isDestroyed() && !scopeChanged) window.showInactive();
  }
  function bounds() {
    const primary = screen.getPrimaryDisplay().workArea;
    const x = Number.isFinite(saved.x) ? Math.round(saved.x) : primary.x + primary.width - WINDOW_WIDTH - 20;
    const y = Number.isFinite(saved.y) ? Math.round(saved.y) : primary.y + primary.height - WINDOW_HEIGHT - 20;
    const area = screen.getDisplayNearestPoint({ x, y }).workArea;
    saved.scale = Math.min(saved.scale, area.width / WINDOW_WIDTH, area.height / WINDOW_HEIGHT);
    const width = Math.round(WINDOW_WIDTH * saved.scale), height = Math.round(WINDOW_HEIGHT * saved.scale);
    return { width, height, x: Math.max(area.x, Math.min(x, area.x + area.width - width)), y: Math.max(area.y, Math.min(y, area.y + area.height - height)) };
  }
  function show() {
    if (disposed) return;
    saved.enabled = true;
    if (!window || window.isDestroyed()) {
      window = new BrowserWindow({ ...bounds(), transparent: true, backgroundColor: '#00000000', frame: false, resizable: false,
        maximizable: false, fullscreenable: false, alwaysOnTop: true, skipTaskbar: true, show: false,
        title: 'Tracer Fishing', webPreferences: { preload: path.join(__dirname, 'fishing-preload.js'),
          contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
      const created = window;
      pointerGuard = attachOverlayPointer(created, screen, setIgnored, () => drag || menuOpen || gestureHeld || ['charging', 'bite', 'reeling'].includes(snapshot?.session?.phase)); overlayReady = false; passThrough = false;
      created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      created.webContents.on('will-navigate', (event, url) => { if ((event.url || url) !== origin + '/fishing-desktop.html') event.preventDefault(); });
      const ready = () => {
        if (created !== window || created.isDestroyed()) return;
        sendSnapshot();
        if (overlayReady && !paused && snapshot && saved.enabled) created.showInactive();
      };
      created.webContents.on('did-finish-load', () => {
        // A fresh renderer starts with input enabled; match that local state.
        if (passThrough) { passThrough = false; created.setIgnoreMouseEvents?.(false); }
        pointerGuard?.reset(); menuOpen = false; overlayReady = true; ready();
      });
      created.once('ready-to-show', ready);
      created.webContents.on('render-process-gone', () => { overlayReady = false; drag = null; rotateSession(); persist(); created.destroy(); });
      created.on('moved', () => { if (!drag) persist(); });
      created.on('closed', () => { if (window === created) { window = null; drag = null; } });
      created.loadURL(origin + '/fishing-desktop.html');
    } else if (overlayReady && !paused && snapshot) window.showInactive();
    persist(); sendSnapshot();
  }
  function forward(type, extra = {}) {
    if (!snapshot || paused || disposed || main.isDestroyed()) return;
    main.webContents.send('tracer-fishing-action', { type, ...extra,
      accountScope: scope(snapshot)[0], accountGeneration: scope(snapshot)[1], accountRestoreId: scope(snapshot)[2],
      sessionId: gameSession(snapshot), nativeSessionId });
  }
  function hide(cancel = true) {
    if (cancel) forward('cancel');
    drag = null; gestureHeld = false; saved.enabled = false;
    if (window && !window.isDestroyed()) window.hide();
    persist();
  }
  function authorized(message) {
    return overlayReady && !paused && snapshot && message && sameScope(message, snapshot)
      && message.sessionId === gameSession(snapshot) && message.nativeSessionId === nativeSessionId;
  }
  function action(event, message) {
    if (!trusted(event, window, '/fishing-desktop.html') || !window.isVisible() || !authorized(message)
        || !actions.has(message.type) || !Number.isSafeInteger(message.sequence)
        || message.sequence <= lastActionSequence || message.sequence > lastActionSequence + 1000) return;
    lastActionSequence = message.sequence;
    if (['cast-start', 'reel-start', 'hold'].includes(message.type)) { gestureHeld = true; setIgnored(false); }
    if (['cast-release', 'reel-release', 'release', 'cancel'].includes(message.type)) gestureHeld = false;
    if (message.type === 'open-home' || message.type === 'open-tackle') showMain();
    forward(message.type, { sequence: message.sequence, ...(message.type === 'cast-start' && message.entranceReady === true ? { entranceReady: true } : {}) });
  }
  function pointer(value) {
    if (!value || !Number.isFinite(value.screenX) || !Number.isFinite(value.screenY)
        || Math.abs(value.screenX) > 1000000 || Math.abs(value.screenY) > 1000000) return null;
    return { x: Math.round(value.screenX), y: Math.round(value.screenY) };
  }
  function move(value) {
    const cursor = pointer(value);
    if (!drag || !cursor || !window || window.isDestroyed()) return;
    const area = screen.getDisplayNearestPoint(cursor).workArea, current = window.getBounds();
    window.setPosition(Math.max(area.x, Math.min(drag.bounds.x + cursor.x - drag.cursor.x, area.x + Math.max(0, area.width - current.width))),
      Math.max(area.y, Math.min(drag.bounds.y + cursor.y - drag.cursor.y, area.y + Math.max(0, area.height - current.height))), false);
  }
  function command(event, message) {
    if (!message || typeof message !== 'object') return;
    if (trusted(event, main, '/')) {
      if (message.type === 'account-lock') pauseAccount();
      else if (message.type === 'account-unlock') paused = false;
      return;
    }
    if (!trusted(event, window, '/fishing-desktop.html')) return;
    if (message.type === 'ready') { sendSnapshot(); return; }
    if (!authorized(message)) return;
    if (message.type === 'input-regions') { pointerGuard?.update(message.value); return; }
    if (message.type === 'context-menu') {
      if (!window.isVisible() || !Menu || drag || menuOpen) return;
      const en=snapshot.language==='en', label=(zh,english)=>en?english:zh;
      const valid=()=>!disposed&&window&&!window.isDestroyed()&&window.isVisible()&&authorized(message);
      const item=(zh,english,run,enabled=true)=>({label:label(zh,english),enabled,click:()=>{if(valid())run();}});
      const local=type=>window.webContents.send('tracer-fishing-menu-action',{type,nativeSessionId});
      const idle=['idle','caught','escaped'].includes(snapshot.session?.phase||'idle')&&!snapshot.recastRemaining;
      menuOpen=true;passThrough=false;window.setIgnoreMouseEvents?.(false);
      Menu.buildFromTemplate([
        item('召唤鱼竿','Summon fishing rod',()=>local('summon-rod'),idle),
        item('收起鱼竿','Dismiss fishing rod',()=>local('dismiss-rod'),idle),
        {type:'separator'},item('移动水塘','Move pond',()=>local('move'),idle),
        item('放大水塘','Enlarge pond',()=>command(event,{...message,type:'resize',value:saved.scale*1.1})),
        item('缩小水塘','Shrink pond',()=>command(event,{...message,type:'resize',value:saved.scale/1.1})),
        item('恢复默认大小','Reset size',()=>command(event,{...message,type:'resize',value:1})),
        {type:'separator'},item('打开钓具盒','Open tackle box',()=>{showMain();forward('open-tackle');}),
        item('打开我的鱼塘','Open my ponds',()=>{showMain();forward('open-home');}),
        item('隐藏水塘','Hide pond',()=>hide())
      ]).popup({window, callback:()=>{menuOpen=false;pointerGuard?.poll();}});return;
    }
    if (message.type === 'hide') { hide(); return; }
    if (message.type === 'resize') {
      if (!window.isVisible() || drag || !Number.isFinite(message.value)) return;
      const current = window.getBounds(), center = { x: Math.round(current.x + current.width / 2), y: Math.round(current.y + current.height / 2) };
      const area = screen.getDisplayNearestPoint(center).workArea;
      saved.scale = Math.min(Math.max(.5, Math.min(2.5, message.value)), area.width / WINDOW_WIDTH, area.height / WINDOW_HEIGHT);
      const width = Math.round(WINDOW_WIDTH * saved.scale), height = Math.round(WINDOW_HEIGHT * saved.scale);
      window.setBounds({ width, height, x: Math.max(area.x, Math.min(Math.round(center.x - width / 2), area.x + area.width - width)), y: Math.max(area.y, Math.min(Math.round(center.y - height / 2), area.y + area.height - height)) }, false);
      persist(); sendSnapshot(); return;
    }
    if (message.type === 'pointer-pass-through') {
      if (typeof message.value !== 'boolean') return;
      const next = message.value && !drag && snapshot.session?.phase !== 'bite';
      if (!menuOpen) pointerGuard?.request(next);
      return;
    }
    if (message.type === 'drag-start') {
      if (!window.isVisible()) return;
      const cursor = pointer(message.value), current = window.getBounds();
      if (cursor && cursor.x >= current.x && cursor.x <= current.x + current.width && cursor.y >= current.y && cursor.y <= current.y + current.height) { passThrough = false; window.setIgnoreMouseEvents?.(false); drag = { cursor, bounds: current }; }
    } else if (message.type === 'drag-move') move(message.value);
    else if (message.type === 'drag-end') { move(message.value); drag = null; persist(); }
  }
  const showIPC = event => { if (trusted(event, main, '/')) show(); };
  const hideIPC = event => { if (trusted(event, main, '/')) hide(); };
  const startNavigation = (details, _url, inPlace, isMainFrame) => {
    if ((details.isMainFrame ?? isMainFrame) && !(details.isSameDocument ?? inPlace)) pauseAccount();
  };
  const finishNavigation = () => { paused = false; };
  // Page scripts may hydrate before the final image/load event. Resume after
  // the new main document commits so its first authoritative update is kept.
  const commitNavigation = (_event, _url, _code, _status, isMainFrame) => { if (isMainFrame) finishNavigation(); };
  main.webContents.on('did-start-navigation', startNavigation);
  main.webContents.on('did-frame-navigate', commitNavigation);
  main.webContents.on('did-finish-load', finishNavigation);
  ipcMain.on('tracer-fishing-update', update);
  ipcMain.on('tracer-fishing-show', showIPC);
  ipcMain.on('tracer-fishing-hide', hideIPC);
  ipcMain.on('tracer-fishing-action', action);
  ipcMain.on('tracer-fishing-command', command);
  function destroy() {
    if (disposed) return;
    disposed = true; snapshot = null; rotateSession();
    for (const [name, handler] of [['tracer-fishing-update', update], ['tracer-fishing-show', showIPC], ['tracer-fishing-hide', hideIPC], ['tracer-fishing-action', action], ['tracer-fishing-command', command]]) ipcMain.removeListener(name, handler);
    main.webContents.removeListener('did-start-navigation', startNavigation);
    main.webContents.removeListener('did-frame-navigate', commitNavigation);
    main.webContents.removeListener('did-finish-load', finishNavigation);
    if (window && !window.isDestroyed()) window.destroy();
  }
  main.once('closed', destroy);
  if (saved.enabled) show();
  return { show, hide, destroy };
}

module.exports = { attachFishing };
