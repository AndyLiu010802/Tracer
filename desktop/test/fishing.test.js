'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { attachFishing } = require('../fishing');

function fixture(t, saved, area = { x: 0, y: 0, width: 1200, height: 900 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-fishing-desktop-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (saved !== undefined) fs.writeFileSync(path.join(dir, 'fishing-window.json'), JSON.stringify(saved));
  const ipcMain = new EventEmitter(), windows = [], origin = 'http://127.0.0.1:18000';
  let opened = 0;
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
      this.visible = options.show !== false; this.messages = []; this.reloads = 0; this.mouseModes = [];
      this.webContents = new EventEmitter(); this.webContents.mainFrame = { url: origin + '/' };
      this.webContents.send = (...args) => this.messages.push(args);
      this.webContents.setWindowOpenHandler = handler => { this.openHandler = handler; };
      this.webContents.reload = () => { this.reloads++; }; windows.push(this);
    }
    isDestroyed() { return !!this.dead; } isVisible() { return this.visible; }
    getBounds() { return { ...this.bounds }; }
    setPosition(x, y) { Object.assign(this.bounds, { x, y }); this.emit('moved'); }
    setBounds(bounds) { Object.assign(this.bounds, bounds); this.emit('moved'); }
    setIgnoreMouseEvents(ignore, options) { this.mouseModes.push({ ignore, options }); }
    showInactive() { this.visible = true; } hide() { this.visible = false; }
    loadURL(url) { this.webContents.mainFrame.url = url; }
    destroy() { this.dead = true; this.emit('closed'); }
  }
  const main = new Window({ width: 1000, height: 800, x: 0, y: 0 });
  const screen = { getPrimaryDisplay: () => ({ workArea: area }), getDisplayNearestPoint: () => ({ workArea: area }) };
  const menus=[];const Menu={buildFromTemplate(items){menus.push(items);return{popup(){}};}};
  const controller = attachFishing(main, origin, dir, () => opened++, { BrowserWindow: Window, ipcMain, screen, Menu });
  function event(window = main) { return { sender: window.webContents, senderFrame: window.webContents.mainFrame }; }
  function update(value = {}) { ipcMain.emit('tracer-fishing-update', event(), { accountScope: 'guest', accountGeneration: 0, accountRestoreId: '', fishing: { sessionId: 'session-a' }, ...value }); }
  function ready() { const window = windows[1]; window.webContents.emit('did-finish-load'); return window; }
  function credentials() {
    const snapshot = windows[1].messages.filter(([name]) => name === 'tracer-fishing-snapshot').at(-1)[1];
    return { accountScope: snapshot.accountScope, accountGeneration: snapshot.accountGeneration, accountRestoreId: snapshot.accountRestoreId, sessionId: snapshot.fishing.sessionId, nativeSessionId: snapshot.nativeSessionId };
  }
  function action(type, sequence = 1, extra = {}, from = event(windows[1])) { ipcMain.emit('tracer-fishing-action', from, { ...credentials(), type, sequence, ...extra }); }
  function command(type, value, extra = {}) { ipcMain.emit('tracer-fishing-command', event(windows[1]), { ...credentials(), type, value, ...extra }); }
  return { menus, dir, ipcMain, main, windows, event, update, ready, credentials, action, command, controller, opened: () => opened };
}

test('the fishing window replaces characters with a sandboxed overlay and waits for the active account', t => {
  const f = fixture(t); f.controller.show(); const window = f.ready();
  assert.equal(window.isVisible(), false, 'a window opened before account hydration reveals no previous data');
  f.update(); f.ready(); assert.equal(window.isVisible(), true);
  assert.equal(window.options.transparent, true); assert.equal(window.options.alwaysOnTop, true);
  assert.equal(window.options.backgroundColor, '#00000000'); assert.equal(window.options.width, 304); assert.equal(window.options.height, 208);
  assert.equal(window.options.webPreferences.sandbox, true); assert.equal(window.options.webPreferences.contextIsolation, true);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.webContents.mainFrame.url.endsWith('/fishing-desktop.html'), true);
  assert.deepEqual(window.openHandler({ url: 'https://evil.example/' }), { action: 'deny' });
  let prevented = false; window.webContents.emit('will-navigate', { preventDefault() { prevented = true; } }, 'https://evil.example/'); assert.equal(prevented, true);
  f.main.destroy(); assert.equal(window.dead, true);
  for (const name of ['update', 'show', 'hide', 'action', 'command']) assert.equal(f.ipcMain.listenerCount('tracer-fishing-' + name), 0);
});

test('transparent blank space passes through only current scoped commands and dragging restores input', t => {
  const f = fixture(t); f.controller.show(); f.update(); const window = f.ready();
  f.command('pointer-pass-through', true, { nativeSessionId: 'stale' }); f.command('pointer-pass-through', 'true');
  assert.deepEqual(window.mouseModes, []);
  f.command('pointer-pass-through', true); assert.deepEqual(window.mouseModes.at(-1), { ignore: true, options: { forward: true } });
  f.command('pointer-pass-through', true); assert.equal(window.mouseModes.length, 1);
  const rect = window.getBounds();f.command('drag-start', { screenX: rect.x + 20, screenY: rect.y + 20 });
  assert.equal(window.mouseModes.at(-1).ignore, false);
  f.command('pointer-pass-through', true); assert.equal(window.mouseModes.at(-1).ignore, false, 'dragging keeps the pointer captured');
  f.command('drag-end', { screenX: rect.x + 20, screenY: rect.y + 20 });f.command('pointer-pass-through', true);
  assert.equal(window.mouseModes.at(-1).ignore, true);f.main.destroy();
});

test('collection size does not block desktop state and a crashed overlay cannot reuse input credentials', t => {
  const f = fixture(t);f.controller.show();f.update({ state: { catches: 'x'.repeat(200000) }, catalog: { fish: 'y'.repeat(200000) }, rod: { id: 'bamboo' }, recastRemaining: 1700 });
  const window = f.ready(),old = f.credentials();assert.equal(window.isVisible(), true);
  const snapshot = window.messages.at(-1)[1];assert.equal(snapshot.rod.id, 'bamboo');assert.equal(snapshot.recastRemaining, 1700, 'the presentation pause reaches desktop input');assert.equal(Object.hasOwn(snapshot, 'state'), false);assert.equal(Object.hasOwn(snapshot, 'catalog'), false);
  window.webContents.emit('render-process-gone', {}, { reason: 'crashed' });assert.equal(window.dead, true);
  f.controller.show();const recreated = f.windows.at(-1);recreated.webContents.emit('did-finish-load');
  assert.equal(recreated.isVisible(), true);const fresh = recreated.messages.at(-1)[1];assert.notEqual(fresh.nativeSessionId, old.nativeSessionId);
  f.ipcMain.emit('tracer-fishing-action', f.event(recreated), { ...old, type: 'hook', sequence: 1 });assert.equal(f.main.messages.length, 0);
  f.main.destroy();
});

test('a stationary-pointer bite restores native clicks and reloading clears obsolete passthrough', t => {
  const f = fixture(t);f.controller.show();f.update({session:{id:'session-a',phase:'waiting'}});const window=f.ready();
  f.command('pointer-pass-through',true);assert.equal(window.mouseModes.at(-1).ignore,true);
  f.update({session:{id:'session-a',phase:'bite'}});assert.equal(window.mouseModes.at(-1).ignore,false,'bite input cannot depend on another mouse move');
  f.command('pointer-pass-through',true);assert.equal(window.mouseModes.at(-1).ignore,false,'blank hover cannot pass through the bite deadline');
  f.action('hook');assert.equal(f.main.messages.at(-1)[1].type,'hook');
  f.update({session:{id:'session-a',phase:'escaped'}});f.command('pointer-pass-through',true);assert.equal(window.mouseModes.at(-1).ignore,true);
  window.webContents.emit('did-finish-load');assert.equal(window.mouseModes.at(-1).ignore,false,'new renderer input state matches the native window');f.main.destroy();
});

test('desktop input requires the exact local top-level sender, account and fresh session, and strips rewards', t => {
  const f = fixture(t); f.controller.show(); f.update(); const window = f.ready();
  for (const from of [f.event(), { sender: window.webContents, senderFrame: { url: window.webContents.mainFrame.url } }, { sender: {}, senderFrame: window.webContents.mainFrame }]) f.action('catch', 1, {}, from);
  f.action('catch', 1, { accountScope: 'another-account' }); f.action('catch', 1, { accountGeneration: 1 });
  f.action('catch', 1, { accountRestoreId: 'old-restore' }); f.action('catch', 1, { nativeSessionId: 'old-native' });
  f.action('catch', 1, { sessionId: 'old-cast' }); f.action('unknown', 1); f.action('cast', NaN); f.action('cast', 5000);
  assert.equal(f.main.messages.length, 0);
  f.action('cast', 1, { fishId: 'legendary', reward: 99999 });
  const forwarded = f.main.messages.at(-1); assert.equal(forwarded[0], 'tracer-fishing-action'); assert.equal(forwarded[1].type, 'cast');
  assert.equal(Object.hasOwn(forwarded[1], 'fishId'), false); assert.equal(Object.hasOwn(forwarded[1], 'reward'), false);
  f.action('cast', 1); assert.equal(f.main.messages.length, 1, 'replayed cast is ignored');
  f.action('open-home', 2); assert.equal(f.opened(), 1);
  f.action('open-tackle', 3); assert.equal(f.opened(), 2);assert.equal(f.main.messages.at(-1)[1].type,'open-tackle','the scoped tackle button opens the main app before forwarding');
  f.main.destroy();
});

test('account switch, restore, data reset and next cast all invalidate queued input', t => {
  const f = fixture(t); f.controller.show(); f.update(); f.ready();
  const old = f.credentials();
  f.ipcMain.emit('tracer-fishing-command', f.event(), { type: 'account-lock' }); assert.equal(f.windows[1].isVisible(), false);
  f.action('hook', 1, old); assert.equal(f.main.messages.length, 0);
  f.update({ accountScope: 'other' }); assert.equal(f.credentials().accountScope, 'guest', 'locked updates cannot replace the account');
  f.ipcMain.emit('tracer-fishing-command', f.event(), { type: 'account-unlock' });
  f.update({ accountScope: 'other', accountRestoreId: 'restore-new' }); f.ready();
  f.action('hook', 1, old); assert.equal(f.main.messages.length, 0);
  const restored = f.credentials(); f.action('hook', 1); assert.equal(f.main.messages.length, 1);
  f.update({ accountScope: 'other', accountGeneration: 1, accountRestoreId: 'restore-new' }); f.ready();
  f.action('hook', 2, restored); assert.equal(f.main.messages.length, 1);
  const previous = f.credentials(); f.update({ accountScope: 'other', accountGeneration: 1, accountRestoreId: 'restore-new', fishing: { sessionId: 'session-b' } });
  f.action('catch', 2, previous); assert.equal(f.main.messages.length, 1);
  f.action('catch', 1); assert.equal(f.main.messages.length, 2);
  f.main.destroy();
});

test('navigation hides the overlay until fresh hydration and late loads do not reenable a hidden window', t => {
  const f = fixture(t); f.controller.show(); f.update(); const window = f.ready(); const old = f.credentials();
  f.main.webContents.emit('did-start-navigation', { url: 'http://127.0.0.1:18000/', isSameDocument: false, isMainFrame: true });
  assert.equal(window.isVisible(), false); f.ready(); assert.equal(window.isVisible(), false);
  f.main.webContents.emit('did-frame-navigate', {}, 'http://127.0.0.1:18000/child', 200, 'OK', false);
  f.update(); f.ready(); assert.equal(window.isVisible(), false, 'a child document cannot unlock account hydration');
  f.main.webContents.emit('did-frame-navigate', {}, 'http://127.0.0.1:18000/', 200, 'OK', true);
  f.ready(); assert.equal(window.isVisible(), false, 'the committed main document still requires fresh data');
  f.update(); f.ready(); f.action('catch', 1, old); assert.equal(f.main.messages.length, 0);
  assert.equal(window.isVisible(), true, 'first hydration before slow images finish loading is retained');
  f.main.webContents.emit('did-finish-load');
  f.controller.hide(); assert.equal(f.main.messages.at(-1)[1].type, 'cancel'); f.ready(); assert.equal(window.isVisible(), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'fishing-window.json'), 'utf8')).enabled, false);
  f.main.destroy();
});

test('desktop dragging preserves grab position, clamps to negative monitors and persists only native settings', t => {
  const f = fixture(t, { enabled: true, x: -5000, y: -5000 }, { x: -800, y: -100, width: 800, height: 700 });
  f.update(); const window = f.ready(); assert.equal(window.bounds.x, -800); assert.equal(window.bounds.y, -100);
  const original = window.getBounds(); f.command('drag-start', { screenX: NaN, screenY: 20 }); f.command('drag-move', { screenX: 0, screenY: 0 }); assert.deepEqual(window.getBounds(), original);
  f.command('drag-start', { screenX: -780, screenY: -80 }); f.command('drag-move', { screenX: -680, screenY: 20 });
  assert.equal(window.bounds.x, -700); assert.equal(window.bounds.y, 0);
  f.command('drag-end', { screenX: 10000, screenY: 10000 }); assert.equal(window.bounds.x, -304); assert.equal(window.bounds.y, 392);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir, 'fishing-window.json'), 'utf8')), { enabled: true, x: -304, y: 392, scale: 1 });
  f.controller.hide(); f.command('drag-start', { screenX: -294, screenY: 402 }); f.command('drag-move', { screenX: -700, screenY: -80 }); assert.equal(window.bounds.x, -304);
  f.main.destroy();
});

test('overlay preload supplies authoritative credentials, counts actions and rejects invented actions', () => {
  let bridge; const sent = [], ipcRenderer = new EventEmitter();
  ipcRenderer.send = (...args) => sent.push(args);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../fishing-preload.js'), 'utf8'), {
    process: { isMainFrame: true }, require: () => ({ ipcRenderer, contextBridge: { exposeInMainWorld(_name, value) { bridge = value; } } }),
  });
  bridge.send({ type: 'cast' }); assert.equal(sent.length, 0);
  ipcRenderer.emit('tracer-fishing-snapshot', {}, { accountScope: 'active', accountGeneration: 2, accountRestoreId: 'restored', fishing: { sessionId: 'cast-one' }, nativeSessionId: 'native-one' });
  bridge.send({ type: 'cast', accountScope: 'forged', fishId: 'legendary' });
  assert.equal(sent.at(-1)[1].accountScope, 'active'); assert.equal(sent.at(-1)[1].sequence, 1); assert.equal(Object.hasOwn(sent.at(-1)[1], 'fishId'), false);
  bridge.send({ type: 'hold' }); assert.equal(sent.at(-1)[1].sequence, 2);
  bridge.send({ type: 'open-tackle' });assert.equal(sent.at(-1)[1].type,'open-tackle');assert.equal(sent.at(-1)[1].sequence,3);
  bridge.send({ type: 'invent-reward' }); bridge.send({ type: 'drag-start', value: { screenX: Infinity, screenY: 1 } }); assert.equal(sent.length, 3);
  ipcRenderer.emit('tracer-fishing-snapshot', {}, { nativeSessionId: 'native-two', sessionId: 'new' }); bridge.send({ type: 'hook' }); assert.equal(sent.at(-1)[1].sequence, 1);
  let count = 0; const off = bridge.onSnapshot(() => count++); ipcRenderer.emit('tracer-fishing-snapshot', {}, { nativeSessionId: 'native-two' }); assert.equal(count, 1); off(); ipcRenderer.emit('tracer-fishing-snapshot', {}, { nativeSessionId: 'native-two' }); assert.equal(count, 1);
  const before=sent.length;bridge.send({type:'resize',value:Infinity});bridge.send({type:'resize',value:'2'});assert.equal(sent.length,before);
  bridge.send({type:'resize',value:8});assert.equal(sent.at(-1)[0],'tracer-fishing-command');assert.equal(sent.at(-1)[1].value,2.5);
  bridge.send({type:'resize',value:.1});assert.equal(sent.at(-1)[1].value,.5);
});

test('desktop ponds retain their theme and real residents without sending the collection ledger', t => {
  const f=fixture(t);f.controller.show();
  f.update({desktopPond:{pond:{id:'pond-a',style:'coral',decorations:[]},fish:Array.from({length:6},(_,i)=>({id:'fry-'+i,speciesId:'koi',growth:30}))}});
  const window=f.ready(),value=window.messages.at(-1)[1];
  assert.equal(value.desktopPond.pond.style,'coral');assert.equal(value.desktopPond.fish.length,5);
  assert.equal(value.desktopPond.fish[0].speciesId,'koi');assert.equal(Object.hasOwn(value,'state'),false);
  f.update({desktopPond:{pond:{id:'pond-b',style:'moon',decorations:[]},fish:[]}});
  assert.deepEqual(window.messages.at(-1)[1].desktopPond.fish,[]);f.main.destroy();
});

test('pond resizing is scoped, bounded, preserves aspect and center, and restores saved scale', t => {
  const f=fixture(t);f.controller.show();f.update();const window=f.ready(),before=window.getBounds();
  f.command('resize',2,{nativeSessionId:'stale'});f.command('resize',NaN);assert.deepEqual(window.getBounds(),before);
  f.command('resize',2);const bounds=window.getBounds();assert.equal(bounds.width,608);assert.equal(bounds.height,416);
  assert.equal(bounds.x+304,Math.min(before.x+152,1200-304));
  assert.equal(window.messages.at(-1)[1].desktopScale,2);
  f.command('resize',.1);assert.equal(window.getBounds().width,152);
  f.command('resize',10);assert.equal(window.getBounds().width,760);
  const saved=JSON.parse(fs.readFileSync(path.join(f.dir,'fishing-window.json'),'utf8'));assert.equal(saved.scale,2.5);
  f.main.destroy();const restored=fixture(t,saved);restored.update();restored.ready();assert.equal(restored.windows[1].getBounds().width,760);restored.main.destroy();
});

test('pond native menu offers rod summoning and ignores stale menu callbacks',t=>{
  const f=fixture(t);f.controller.show();f.update({session:{phase:'idle'}});const w=f.ready();
  f.command('context-menu');const menu=f.menus.at(-1),choose=label=>menu.find(row=>row.label===label).click();
  choose('召唤鱼竿');assert.equal(w.messages.at(-1)[0],'tracer-fishing-menu-action');assert.equal(w.messages.at(-1)[1].type,'summon-rod');assert.equal(f.main.messages.length,0,'display creates no cast');
  choose('放大水塘');assert.equal(w.getBounds().width,334);choose('恢复默认大小');assert.equal(w.getBounds().width,304);
  choose('移动水塘');assert.equal(w.messages.at(-1)[1].type,'move');
  f.update({accountScope:'other'});f.ready();const count=w.messages.length;choose('召唤鱼竿');assert.equal(w.messages.length,count);
  f.update({accountScope:'other',session:{phase:'reeling'}});f.command('context-menu');assert.equal(f.menus.at(-1).find(row=>row.label==='召唤鱼竿').enabled,false);
  f.main.destroy();
});
