'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow, ipcMain, screen } = require('electron');
const Work = require('../public/companion-work');
const { randomUUID } = require('node:crypto');

function attachPet(main, origin, userData, showMain) {
  const trail=require('./garden-trail').attachGardenTrail(main);
  const file = path.join(userData, 'pet-window.json');
  let saved = {}, pet = null, snapshot = null, drag = null, expanded = false;
  let accountPaused=false,petScope=null;
  const pendingWork = new Map();
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const normalizeSize = value => Number.isFinite(value) ? Math.max(70, Math.min(180, Math.round(value))) : 100;
  saved.size = normalizeSize(saved.size);
  function dimensions(area, isExpanded = expanded) {
    const body = Math.round(180 * saved.size / 100);
    return { width: Math.min(isExpanded ? 380 : Math.max(220, body + 40), area.width), height: Math.min(isExpanded ? 700 : Math.max(240, body + 104), area.height) };
  }
  function sendSnapshot() {
    if (snapshot && pet && !pet.isDestroyed()) pet.webContents.send('tracer-pet-snapshot', { ...snapshot, desktopSize: saved.size });
  }
  function pauseAccount(){accountPaused=true;snapshot=null;drag=null;trail.update(null);for(const token of pendingWork.keys())settleWork(token,{ok:false,error:'workspace-busy'});if(pet&&!pet.isDestroyed())pet.hide();}
  main.webContents.on('did-start-navigation',(_event,_url,inPlace,isMainFrame)=>{if(isMainFrame&&!inPlace)pauseAccount();});
  main.webContents.on('did-finish-load',()=>{accountPaused=false;});
  function trusted(event, win, pathname) {
    if (!win || win.isDestroyed() || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) return false;
    try { const url = new URL(event.senderFrame.url); return url.origin === origin && url.pathname === pathname; } catch { return false; }
  }
  function settleWork(token, response) {
    const pending = pendingWork.get(token);
    if (!pending) return;
    pendingWork.delete(token); clearTimeout(pending.timer); pending.resolve(response);
  }
  function workResult(event, message) {
    if (!trusted(event, main, '/') || !message || typeof message.token !== 'string' || !pendingWork.has(message.token)) return;
    if (message.ok === true && message.result && Array.isArray(message.result.taskIds) && message.result.taskIds.length <= 20) {
      settleWork(message.token, { ok: true, result: message.result });
    } else settleWork(message.token, { ok: false, error: typeof message.error === 'string' ? message.error.slice(0,100) : 'companion-save-pending' });
  }
  ipcMain.handle('tracer-pet-create-work', async (event, request) => {
    if (!trusted(event, pet, '/pet.html') || !request || !Work.validRequestId(request.requestId)) return { ok: false, error: 'invalid-companion-request-id' };
    if(accountPaused||!snapshot||(request.accountScope||'guest')!==(snapshot.accountScope||'guest'))return{ok:false,error:'workspace-busy'};
    if (main.isDestroyed() || pendingWork.size >= 8) return { ok: false, error: 'workspace-busy' };
    let proposal;
    try { proposal = Work.normalize(request.proposal); } catch (error) { return { ok: false, error: error.message }; }
    const token = randomUUID();
    return new Promise(resolve => {
      const timer = setTimeout(() => settleWork(token, { ok: false, error: 'companion-save-pending' }), 30000);
      pendingWork.set(token, { resolve, timer });
      try { main.webContents.send('tracer-pet-work-request', { token, accountScope:snapshot.accountScope||'guest', value: { requestId: request.requestId, proposal } }); }
      catch { settleWork(token, { ok: false, error: 'workspace-busy' }); }
    });
  });
  ipcMain.on('tracer-pet-work-result', workResult);
  function persist(enabled) {
    if (pet && !pet.isDestroyed()) { const bounds = pet.getBounds(); saved.x = bounds.x; saved.y = bounds.y; }
    saved.enabled = enabled;
    try { fs.writeFileSync(file, JSON.stringify(saved)); } catch {}
  }
  function pointer(message) {
    const value = message.value;
    if (value === undefined) return screen.getCursorScreenPoint();
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !Number.isFinite(value.screenX) || !Number.isFinite(value.screenY) ||
      Math.abs(value.screenX) > 1000000 || Math.abs(value.screenY) > 1000000) return null;
    return { x: Math.round(value.screenX), y: Math.round(value.screenY) };
  }
  function moveDrag(message) {
    if (!drag || !pet || pet.isDestroyed()) return;
    const cursor = pointer(message); if (!cursor) return;
    const area = screen.getDisplayNearestPoint(cursor).workArea;
    const bounds = pet.getBounds();
    const x = Math.max(area.x, Math.min(drag.bounds.x + cursor.x - drag.cursor.x, area.x + Math.max(0, area.width - bounds.width)));
    const y = Math.max(area.y, Math.min(drag.bounds.y + cursor.y - drag.cursor.y, area.y + Math.max(0, area.height - bounds.height)));
    pet.setPosition(Math.round(x), Math.round(y), false);
  }
  function endDrag(message) {
    if (!drag) return;
    if (message) moveDrag(message);
    drag = null; persist(pet.isVisible());
  }
  function size(isExpanded = expanded) {
    if (!pet || pet.isDestroyed()) return;
    endDrag();
    expanded = isExpanded;
    const area = screen.getDisplayMatching(pet.getBounds()).workArea;
    const { width, height } = dimensions(area);
    const old = pet.getBounds();
    pet.setBounds({ width, height, x: Math.max(area.x, Math.min(Math.round(old.x+(old.width-width)/2), area.x+area.width-width)), y: Math.max(area.y, Math.min(old.y+old.height-height, area.y+area.height-height)) });
    persist(pet.isVisible());
  }
  function show() {
    if (pet && !pet.isDestroyed()) { pet.show(); persist(true); return; }
    expanded = false;
    const area = screen.getPrimaryDisplay().workArea;
    const initial = dimensions(area);
    const x = Number.isFinite(saved.x) ? saved.x : area.x+area.width-initial.width-30;
    const y = Number.isFinite(saved.y) ? saved.y : area.y+area.height-initial.height-20;
    const display = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) }).workArea;
    const { width, height } = dimensions(display);
    pet = new BrowserWindow({ width, height, x: Math.max(display.x,Math.min(x,display.x+display.width-width)), y: Math.max(display.y,Math.min(y,display.y+display.height-height)),
      transparent: true, frame: false, resizable: false, maximizable: false, fullscreenable: false, alwaysOnTop: true, skipTaskbar: true, show: false,
      title: 'Tracer Companion', webPreferences: { preload: path.join(__dirname,'pet-preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: true } });
    pet.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    pet.webContents.on('will-navigate', (event, url) => { endDrag(); if (url !== origin+'/pet.html') event.preventDefault(); });
    pet.webContents.on('did-finish-load', ()=>{sendSnapshot();if(!accountPaused&&saved.enabled&&pet&&!pet.isDestroyed())pet.showInactive();});
    pet.once('ready-to-show', () => { if (pet && !pet.isDestroyed()) pet.showInactive(); });
    pet.on('moved', () => { if (!drag) persist(pet.isVisible()); });
    pet.on('closed', () => { drag = null; pet = null; });
    pet.loadURL(origin+'/pet.html'); persist(true);
  }
  function hide() { drag = null; if (pet && !pet.isDestroyed()) pet.hide(); persist(false); }
  function command(event, message) {
    if (!message || typeof message !== 'object') return;
    if (trusted(event, main, '/')) {
      if(message.type==='account-lock'){pauseAccount();return;}
      if(message.type==='account-unlock'){accountPaused=false;return;}
      if (message.type === 'show') show();
      if (message.type === 'hide') hide();
      if (message.type === 'snapshot' && message.value && JSON.stringify(message.value).length < 50000) {
        if(accountPaused)return;
        const nextScope=message.value.accountScope||'guest';
        const scopeChanged=petScope!==nextScope;
        petScope=nextScope;
        snapshot = message.value;
        // The companion may open before the main page's first snapshot. Treat
        // that unknown scope as needing a reload too, including a fast sign-in.
        if(scopeChanged&&pet&&!pet.isDestroyed()){pet.hide();pet.webContents.reload();}
        trail.update(snapshot);
        sendSnapshot();
      }
      return;
    }
    if (!trusted(event, pet, '/pet.html')) return;
    if (message.type === 'drag-start') {
      if (!pet.isVisible()) return;
      const cursor = pointer(message), bounds = pet.getBounds();
      if (cursor && cursor.x >= bounds.x-16 && cursor.x <= bounds.x+bounds.width+16 && cursor.y >= bounds.y-16 && cursor.y <= bounds.y+bounds.height+16) drag = { cursor, bounds };
      return;
    }
    if (message.type === 'drag-move') { moveDrag(message); return; }
    if (message.type === 'drag-end') { endDrag(message); return; }
    if (message.type === 'hide') { hide(); return; }
    if (message.type === 'expand') { size(message.value === true); return; }
    if (message.type === 'set-size') {
      if (!Number.isFinite(message.value)) return;
      saved.size = normalizeSize(message.value);
      size(); sendSnapshot(); return;
    }
    if (message.type === 'ready') { sendSnapshot(); return; }
    if(accountPaused||!snapshot||(message.accountScope||'guest')!==(snapshot.accountScope||'guest'))return;
    const allowed = ['feed','play','sleep','pet','toggle-trail','select','reminders','snooze','focus-toggle','open-task','open-ai','open-home','open-create','open-remove','open-import','open-export'];
    if (!allowed.includes(message.type)) return;
    if (message.type.startsWith('open-')) showMain();
    const value = typeof message.value === 'boolean' ? message.value : typeof message.value === 'string' ? message.value.slice(0,100) : undefined;
    main.webContents.send('tracer-pet-action', { type: message.type, value });
  }
  ipcMain.on('tracer-pet-command', command);
  main.once('closed', () => {
    ipcMain.removeListener('tracer-pet-command',command);
    ipcMain.removeListener('tracer-pet-work-result',workResult); ipcMain.removeHandler('tracer-pet-create-work');
    for (const token of pendingWork.keys()) settleWork(token, { ok: false, error: 'workspace-busy' });
    if (pet && !pet.isDestroyed()) pet.destroy();
  });
  if (saved.enabled) show();
  return { show, hide };
}
module.exports = { attachPet };
