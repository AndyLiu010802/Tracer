'use strict';

const path = require('node:path');
const { attachOverlayPointer } = require('./overlay-pointer');
const BAITS = new Set(['earthworm', 'dough', 'prawn', 'cutbait', 'lotusmeal']);
const PAGE = '/fishing-bait-desktop.html';
const WIDTH = 320, HEIGHT = 208;
const credentials = s => JSON.stringify([s?.accountScope, s?.accountGeneration, s?.accountRestoreId, s?.sessionId || s?.fishing?.sessionId || '', s?.nativeSessionId]);
const account = s => JSON.stringify([s?.accountScope, s?.accountGeneration, s?.accountRestoreId]);

// A presentation-only companion. Prices, inventory, purchases and saving stay
// in the main application's fishing controller, including failed-save retries.
function attachBaitBox(origin, getState, forward, getAnchor, dependencies) {
  const { BrowserWindow, ipcMain, screen, Menu } = dependencies;
  let window = null, ready = false, menuOpen = false, guard = null, lastAccount = '', disposed = false;
  const live = () => window && !window.isDestroyed();
  function trusted(event) {
    if (!live() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return false;
    try { const url = new URL(event.senderFrame.url); return url.origin === origin && url.pathname === PAGE; } catch { return false; }
  }
  function valid(message) {
    const s = getState();
    return !disposed && ready && live() && window.isVisible() && s && credentials(message) === credentials(s);
  }
  function sync() {
    const s = getState();
    if (!s || lastAccount && account(s) !== lastAccount) { close(); return; }
    if (!live() || !ready) return;
    lastAccount = account(s);
    window.webContents.send('tracer-fishing-bait-snapshot', {
      accountScope: s.accountScope, accountGeneration: s.accountGeneration, accountRestoreId: s.accountRestoreId,
      sessionId: s.sessionId || s.fishing?.sessionId || '', nativeSessionId: s.nativeSessionId,
      language: s.language, tackle: s.tackle, error: s.error, notice: s.notice
    });
  }
  function close() {
    guard?.destroy(); guard = null; ready = false; menuOpen = false; lastAccount = '';
    if (live()) window.destroy();
    window = null;
  }
  function show() {
    const s = getState();
    if (disposed || !s?.tackle) return;
    if (live()) { sync(); if (ready && live()) window.showInactive(); return; }
    const anchor = getAnchor() || screen.getPrimaryDisplay().workArea;
    const area = screen.getDisplayNearestPoint({ x: Math.round(anchor.x + anchor.width / 2), y: Math.round(anchor.y + anchor.height / 2) }).workArea;
    const scale = Math.min(1, area.width / WIDTH, area.height / HEIGHT), width = Math.round(WIDTH * scale), height = Math.round(HEIGHT * scale);
    // Open beside the pond at its lower edge. Prefer the right, then the left;
    // only stack above when neither side fits on the current monitor.
    const right = anchor.x + anchor.width + 4, left = anchor.x - width - 4;
    const beside = right + width <= area.x + area.width ? right : left >= area.x ? left : null;
    const x = Math.max(area.x, Math.min(beside ?? anchor.x + anchor.width - width, area.x + area.width - width));
    const y = Math.max(area.y, Math.min(beside === null ? anchor.y - height - 4 : anchor.y + anchor.height - height, area.y + area.height - height));
    window = new BrowserWindow({ x, y, width, height, transparent: true, backgroundColor: '#00000000', frame: false,
      resizable: false, maximizable: false, fullscreenable: false, alwaysOnTop: true, skipTaskbar: true, show: false,
      title: 'Tracer Bait Box', webPreferences: { preload: path.join(__dirname, 'fishing-bait-preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
    const created = window; lastAccount = account(s);
    guard = attachOverlayPointer(created, screen, ignored => { if (!created.isDestroyed()) created.setIgnoreMouseEvents?.(ignored, { forward: true }); }, () => menuOpen);
    created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    created.webContents.on('will-navigate', (event, url) => { if ((event.url || url) !== origin + PAGE) event.preventDefault(); });
    created.webContents.on('did-finish-load', () => {
      if (created !== window || created.isDestroyed()) return;
      ready = true; guard?.reset(); sync(); if (live() && getState()) created.showInactive();
    });
    created.webContents.on('render-process-gone', close);
    created.on('closed', () => { if (created === window) { guard?.destroy(); guard = null; window = null; ready = false; menuOpen = false; } });
    created.loadURL(origin + PAGE);
  }
  function command(event, message) {
    if (!trusted(event) || !message || typeof message !== 'object') return;
    if (message.type === 'ready') { sync(); return; }
    if (!valid(message)) return;
    if (message.type === 'close') { close(); return; }
    if (message.type === 'input-regions') { guard?.update(message.value); return; }
    if (message.type === 'retry-save') {
      const t = getState().tackle;
      if (t?.pendingSave && !t.busy) forward('retry-save');
      return;
    }
    if (message.type !== 'context-menu' || menuOpen || !Menu || !BAITS.has(message.baitId)) return;
    const s = getState(), t = s.tackle, bait = t?.baits?.find(b => b.id === message.baitId);
    if (!bait) return;
    const en = s.language === 'en', text = (zh, english) => en ? english : zh;
    const available = () => { const now = getState()?.tackle; return now && !now.busy && !now.locked && !now.pendingSave; };
    const canBuy = () => { const now = getState()?.tackle, b = now?.baits.find(b => b.id === bait.id); return available() && b && now.coins >= b.price; };
    const canEquip = () => { const now = getState()?.tackle; return available() && now.equippedBaitId !== bait.id && now.baits.some(b => b.id === bait.id && b.count > 0); };
    // A menu item is single-use, even if native click callbacks are repeated.
    const owner = window; let consumed = false;
    const item = (label, type, check) => ({ label, enabled: !!check(), click: () => {
      if (consumed || owner !== window || owner.isDestroyed() || !valid(message) || !check()) return;
      consumed = true; forward(type, { value: bait.id });
    } });
    const items = [
      { label: (bait.name?.[en ? 1 : 0] || bait.id) + text(' · 库存 ', ' · Stock ') + bait.count, enabled: false },
      { type: 'separator' },
      item(t.equippedBaitId === bait.id ? text('已装备', 'Equipped') : text('装备', 'Equip'), 'equip-bait', canEquip),
      item(text('购买 ' + bait.quantity + ' 份 · ' + bait.price + ' 金币', 'Buy ' + bait.quantity + ' · ' + bait.price + ' coins'), 'buy-bait', canBuy),
      item(text('购买并装备 · ' + bait.price + ' 金币', 'Buy & equip · ' + bait.price + ' coins'), 'buy-equip-bait', canBuy)
    ];
    if (t.busy || t.locked || t.pendingSave || t.coins < bait.price) items.push({ type: 'separator' }, { enabled: false, label: t.busy ? text('正在保存…', 'Saving…') : t.pendingSave ? text('请先重试保存', 'Retry saving first') : t.locked ? text('收竿后可补充或更换', 'Finish this cast first') : text('金币不足', 'Not enough coins') });
    menuOpen = true; window.setIgnoreMouseEvents?.(false);
    Menu.buildFromTemplate(items).popup({ window, callback: () => { if (owner === window) { menuOpen = false; guard?.poll(); } } });
  }
  ipcMain.on('tracer-fishing-bait-command', command);
  return { show, sync, close, destroy() { disposed = true; close(); ipcMain.removeListener('tracer-fishing-bait-command', command); } };
}

module.exports = { attachBaitBox };
