'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { attachOverlayPointer } = require('./overlay-pointer');
const WIDTH = 210, HEIGHT = 170, PAGE = '/fishing-aquarium-desktop.html';
const PREFIX = 'tracer-fishing-aquarium-';
const normalizeYaw = value => Number.isFinite(value) ? ((value % 360 + 540) % 360 - 180) || 0 : 0;

// A read-only projection of the active account's collection. Native commands
// can position the display or open the main application, never alter inventory.
function attachFishingAquarium(main, origin, userData, showMain, dependencies = require('electron')) {
  const { BrowserWindow, ipcMain, screen, Menu } = dependencies;
  let pointerGuard = null, menuOpen = false;
  function setIgnored(value) { if (value !== passThrough) { passThrough = value; window.setIgnoreMouseEvents?.(value, { forward: true }); } }
  const file = path.join(userData, 'fishing-aquarium-window.json');
  let saved = {}, window = null, snapshot = null, paused = false, ready = false, disposed = false, drag = null, passThrough = false;
  let nativeSessionId = randomUUID(), lastSequence = 0;
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  saved.enabled = saved.enabled === true;
  saved.scale = Number.isFinite(saved.scale) ? Math.max(.75, Math.min(2.5, saved.scale)) : 1;
  saved.yaw = normalizeYaw(saved.yaw);
  function trusted(event, target, pathname) {
    if (!target || target.isDestroyed() || event.sender !== target.webContents || event.senderFrame !== target.webContents.mainFrame) return false;
    try { const url = new URL(event.senderFrame.url); return url.origin === origin && url.pathname === pathname; } catch { return false; }
  }
  const scope = value => [value?.accountScope || 'guest', value?.accountGeneration || 0, value?.accountRestoreId || ''];
  const sameScope = (a, b) => JSON.stringify(scope(a)) === JSON.stringify(scope(b));
  function rotateSession() { nativeSessionId = randomUUID(); lastSequence = 0; drag = null; }
  function live() { return window && !window.isDestroyed(); }
  function state() { return snapshot && { ...snapshot, nativeSessionId, desktopVisible: saved.enabled && !paused, desktopScale: saved.scale, desktopYaw: saved.yaw }; }
  function publish() { if (live() && ready && snapshot && !paused) window.webContents.send(PREFIX + 'snapshot', state()); }
  function visibility(visible, clear = false) { if (live() && ready) window.webContents.send(PREFIX + 'visibility', { visible, clear }); }
  function persist() {
    if (live()) { const bounds = window.getBounds(); saved.x = bounds.x; saved.y = bounds.y; }
    try { fs.writeFileSync(file, JSON.stringify({ enabled: saved.enabled, x: saved.x, y: saved.y, scale: saved.scale, yaw: saved.yaw })); } catch {}
  }
  function lockAccount() {
    visibility(false, true); paused = true; snapshot = null; rotateSession();
    if (live()) window.hide();
  }
  function update(event, next) {
    if (!trusted(event, main, '/') || disposed || paused || !next || typeof next !== 'object' || Array.isArray(next)) return;
    if (!next.showcase || typeof next.showcase !== 'object' || Array.isArray(next.showcase)) return;
    const [accountScope, accountGeneration, accountRestoreId] = scope(next);
    if (typeof accountScope !== 'string' || accountScope.length > 256 || typeof accountRestoreId !== 'string' || accountRestoreId.length > 256
        || !Number.isSafeInteger(accountGeneration) || accountGeneration < 0) return;
    if (snapshot && snapshot.accountScope === accountScope && snapshot.accountRestoreId === accountRestoreId && snapshot.accountGeneration > accountGeneration) return;
    const collection = next.showcase, stats = {};
    for (const key of ['catches', 'species', 'ponds']) stats[key] = Number.isSafeInteger(collection.stats?.[key]) && collection.stats[key] >= 0 ? collection.stats[key] : 0;
    const projection = { accountScope, accountGeneration, accountRestoreId, language: next.language === 'en' ? 'en' : 'zh', showcase: {
      fish: Array.isArray(collection.fish) ? collection.fish.slice(0, 3) : [], stats,
      selection: { fishIds: Array.isArray(collection.selection?.fishIds) ? collection.selection.fishIds.filter(id => typeof id === 'string' && id.length <= 128).slice(0, 3) : [] },
    } };
    if (Array.isArray(collection.selection?.decorationIds)) projection.showcase.selection.decorationIds = collection.selection.decorationIds.filter(id => typeof id === 'string' && id.length <= 128).slice(0, 3);
    let serialized;
    try { serialized = JSON.stringify(projection); } catch { return; }
    if (serialized.length > 32000) return;
    const changed = !snapshot || !sameScope(snapshot, projection);
    if (changed) rotateSession();
    snapshot = JSON.parse(serialized);
    if (changed && live()) { visibility(false, true); ready = false; window.hide(); window.webContents.reload(); }
    publish();
    if (saved.enabled && ready && live()) { window.showInactive(); visibility(true); }
  }
  function bounds() {
    const primary = screen.getPrimaryDisplay().workArea;
    const x = Number.isFinite(saved.x) ? Math.round(saved.x) : primary.x + primary.width - Math.round(WIDTH * saved.scale) - 22;
    const y = Number.isFinite(saved.y) ? Math.round(saved.y) : primary.y + 32;
    const area = screen.getDisplayNearestPoint({ x, y }).workArea;
    saved.scale = Math.min(saved.scale, area.width / WIDTH, area.height / HEIGHT);
    const width = Math.round(WIDTH * saved.scale), height = Math.round(HEIGHT * saved.scale);
    return { width, height, x: Math.max(area.x, Math.min(x, area.x + area.width - width)), y: Math.max(area.y, Math.min(y, area.y + area.height - height)) };
  }
  function show() {
    if (disposed) return;
    saved.enabled = true;
    if (!live()) {
      window = new BrowserWindow({ ...bounds(), transparent: true, backgroundColor: '#00000000', frame: false, resizable: false,
        maximizable: false, fullscreenable: false, alwaysOnTop: true, skipTaskbar: true, focusable: false, show: false,
        title: 'Tracer Legendary Aquarium', webPreferences: { preload: path.join(__dirname, 'fishing-aquarium-preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: true } });
      const created = window;
      pointerGuard = attachOverlayPointer(created, screen, setIgnored, () => drag || menuOpen); ready = false; passThrough = false;
      created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      created.webContents.on('will-navigate', (event, url) => { if ((event.url || url) !== origin + PAGE) event.preventDefault(); });
      created.webContents.on('will-attach-webview', event => event.preventDefault());
      const reveal = () => { if (created !== window || created.isDestroyed()) return; publish(); if (ready && !paused && snapshot && saved.enabled) { created.showInactive(); visibility(true); } };
      created.webContents.on('did-finish-load', () => { if (created !== window || created.isDestroyed()) return; pointerGuard?.reset(); menuOpen = false; ready = true; passThrough = false; created.setIgnoreMouseEvents?.(false); reveal(); });
      created.once('ready-to-show', reveal);
      created.webContents.on('render-process-gone', () => { if (created !== window) return; ready = false; rotateSession(); persist(); created.destroy(); });
      created.on('moved', () => { if (!drag) persist(); });
      created.on('closed', () => { if (window === created) { window = null; ready = false; drag = null; } });
      created.loadURL(origin + PAGE);
    } else if (ready && !paused && snapshot) { window.showInactive(); visibility(true); }
    persist(); publish();
  }
  function hide() { saved.enabled = false; drag = null; visibility(false); if (live()) window.hide(); persist(); }
  function authorized(message) { return ready && !paused && snapshot && message && sameScope(message, snapshot) && message.nativeSessionId === nativeSessionId; }
  function action(event, message) {
    if (!trusted(event, window, PAGE) || !window.isVisible() || !authorized(message) || message.type !== 'open-aquarium'
        || !Number.isSafeInteger(message.sequence) || message.sequence <= lastSequence || message.sequence > lastSequence + 1000 || main.isDestroyed()) return;
    lastSequence = message.sequence; showMain();
    main.webContents.send(PREFIX + 'action', { type: 'open-aquarium', accountScope: scope(snapshot)[0], accountGeneration: scope(snapshot)[1], accountRestoreId: scope(snapshot)[2], nativeSessionId, sequence: message.sequence });
  }
  function pointer(value) {
    if (!value || !Number.isFinite(value.screenX) || !Number.isFinite(value.screenY) || Math.abs(value.screenX) > 1000000 || Math.abs(value.screenY) > 1000000) return null;
    return { x: Math.round(value.screenX), y: Math.round(value.screenY) };
  }
  function move(value) {
    const cursor = pointer(value); if (!drag || !cursor || !live()) return;
    const area = screen.getDisplayNearestPoint(cursor).workArea, current = window.getBounds();
    window.setPosition(Math.max(area.x, Math.min(drag.bounds.x + cursor.x - drag.cursor.x, area.x + Math.max(0, area.width - current.width))), Math.max(area.y, Math.min(drag.bounds.y + cursor.y - drag.cursor.y, area.y + Math.max(0, area.height - current.height))), false);
  }
  function resize(value) {
    if (!Number.isFinite(value) || drag || !live()) return;
    const current = window.getBounds(), center = { x: Math.round(current.x + current.width / 2), y: Math.round(current.y + current.height / 2) };
    const area = screen.getDisplayNearestPoint(center).workArea;
    saved.scale = Math.min(Math.max(.75, Math.min(2.5, value)), area.width / WIDTH, area.height / HEIGHT);
    const width = Math.round(WIDTH * saved.scale), height = Math.round(HEIGHT * saved.scale);
    const x = Math.max(area.x, Math.min(Math.round(center.x - width / 2), area.x + area.width - width));
    const y = Math.max(area.y, Math.min(Math.round(center.y - height / 2), area.y + area.height - height));
    window.setBounds({ x, y, width, height }, false); persist(); publish();
  }
  function setYaw(value) {
    if (!Number.isFinite(value) || drag || !live()) return;
    saved.yaw = normalizeYaw(value); persist(); publish();
  }
  function command(event, message) {
    if (!message || typeof message !== 'object') return;
    if (trusted(event, main, '/')) { if (message.type === 'account-lock') lockAccount(); else if (message.type === 'account-unlock') paused = false; return; }
    if (!trusted(event, window, PAGE)) return;
    if (message.type === 'ready') { publish(); return; }
    if (!authorized(message)) return;
    if (message.type === 'input-regions') { pointerGuard?.update(message.value); return; }
    if (!window.isVisible()) return;
    if (message.type === 'context-menu') {
      if (!Menu || drag || menuOpen) return;
      const en=snapshot.language==='en',label=(zh,english)=>en?english:zh;
      const valid=()=>!disposed&&live()&&window.isVisible()&&authorized(message);
      const item=(zh,english,run)=>({label:label(zh,english),click:()=>{if(valid())run();}});
      menuOpen=true;passThrough=false;window.setIgnoreMouseEvents?.(false);
      Menu.buildFromTemplate([
        item('移动水族箱','Move aquarium',()=>window.webContents.send(PREFIX+'menu-action',{type:'move',nativeSessionId})),
        item('放大水族箱','Enlarge aquarium',()=>resize(saved.scale*1.1)),
        item('缩小水族箱','Shrink aquarium',()=>resize(saved.scale/1.1)),
        item('恢复默认大小','Reset size',()=>resize(1)),{type:'separator'},
        item('向左旋转','Rotate left',()=>setYaw(saved.yaw-15)),
        item('向右旋转','Rotate right',()=>setYaw(saved.yaw+15)),
        item('恢复默认角度','Reset angle',()=>setYaw(0)),{type:'separator'},
        item('打开传奇水族箱','Open legendary aquarium',()=>{showMain();main.webContents.send(PREFIX+'action',{type:'open-aquarium',accountScope:scope(snapshot)[0],accountGeneration:scope(snapshot)[1],accountRestoreId:scope(snapshot)[2],nativeSessionId});}),
        item('从桌面隐藏','Hide from desktop',hide)
      ]).popup({window, callback:()=>{menuOpen=false;pointerGuard?.poll();}});return;
    }
    if (message.type === 'hide') { hide(); return; }
    if (message.type === 'resize') { resize(message.value); return; }
    if (message.type === 'pointer-pass-through') {
      if (typeof message.value !== 'boolean') return;
      const next = message.value && !drag;
      if (!menuOpen) pointerGuard?.request(next);
    } else if (message.type === 'drag-start') {
      const cursor = pointer(message.value), b = window.getBounds();
      if (cursor && cursor.x >= b.x && cursor.x <= b.x + b.width && cursor.y >= b.y && cursor.y <= b.y + b.height) { passThrough = false; window.setIgnoreMouseEvents?.(false); drag = { cursor, bounds: b }; }
    } else if (message.type === 'drag-move') move(message.value);
    else if (message.type === 'drag-end') { move(message.value); drag = null; persist(); }
  }
  const showIPC = event => { if (trusted(event, main, '/')) show(); }, hideIPC = event => { if (trusted(event, main, '/')) hide(); };
  const startNavigation = (details, _url, inPlace, isMainFrame) => { if ((details.isMainFrame ?? isMainFrame) && !(details.isSameDocument ?? inPlace)) lockAccount(); };
  const finishNavigation = () => { paused = false; }, commitNavigation = (_event, _url, _code, _status, isMainFrame) => { if (isMainFrame) finishNavigation(); };
  const handlers = [['update', update], ['show', showIPC], ['hide', hideIPC], ['action', action], ['command', command]];
  for (const [name, handler] of handlers) ipcMain.on(PREFIX + name, handler);
  main.webContents.on('did-start-navigation', startNavigation); main.webContents.on('did-frame-navigate', commitNavigation); main.webContents.on('did-finish-load', finishNavigation);
  function destroy() {
    if (disposed) return; visibility(false, true); disposed = true; snapshot = null; rotateSession();
    for (const [name, handler] of handlers) ipcMain.removeListener(PREFIX + name, handler);
    main.webContents.removeListener('did-start-navigation', startNavigation); main.webContents.removeListener('did-frame-navigate', commitNavigation); main.webContents.removeListener('did-finish-load', finishNavigation);
    main.removeListener('closed', destroy); if (live()) window.destroy();
  }
  main.once('closed', destroy); if (saved.enabled) show();
  return { show, hide, destroy };
}

module.exports = { attachFishingAquarium };
