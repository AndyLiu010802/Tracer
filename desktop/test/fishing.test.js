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
    showInactive() { this.shows = (this.shows || 0) + 1; this.visible = true; } hide() { this.visible = false; }
    loadURL(url) { this.webContents.mainFrame.url = url; }
    destroy() { this.dead = true; this.emit('closed'); }
  }
  const main = new Window({ width: 1000, height: 800, x: 0, y: 0 });
  const screen = { getPrimaryDisplay: () => ({ workArea: area }), getDisplayNearestPoint: () => ({ workArea: area }) };
  const menus=[],popups=[];const Menu={buildFromTemplate(items){menus.push(items);return{popup(options){popups.push(options);}};}};
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
  return { menus, popups, dir, ipcMain, main, windows, event, update, ready, credentials, action, command, controller, opened: () => opened };
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

test('motor state reaches the native overlay and pause/resume retain account and session validation', t => {
  const f=fixture(t);f.controller.show();f.update({busy:true,autoMotor:{owned:true,installed:true,running:true,baitCount:12,saving:true,unbounded:'ignored'}});const window=f.ready();
  const state=window.messages.filter(([name])=>name==='tracer-fishing-snapshot').at(-1)[1];
  assert.deepEqual(state.autoMotor,{owned:true,installed:true,running:true,baitCount:12,saving:true});assert.equal(state.busy,true);
  f.action('pause-motor',1,{accountScope:'stale'});assert.equal(f.main.messages.length,0);
  f.action('pause-motor',1);assert.equal(f.main.messages.at(-1)[1].type,'pause-motor');
  f.action('start-motor',2);assert.equal(f.main.messages.at(-1)[1].type,'start-motor');
  f.action('install-motor',3);assert.equal(f.main.messages.length,2);f.main.destroy();
});

test('live cast snapshots do not repeatedly show or move the transparent window', t => {
  const f=fixture(t);f.controller.show();f.update();const window=f.ready(),bounds=window.getBounds(),shows=window.shows;
  window.emit('ready-to-show');
  for(let i=0;i<120;i++)f.update({session:{id:'session-a',phase:'reeling',progress:i/120}});
  assert.equal(window.shows,shows,'show only on a visibility transition, including both native ready events');
  assert.deepEqual(window.getBounds(),bounds);assert.equal(window.options.webPreferences.backgroundThrottling,true);
  f.controller.hide(false);const count=window.messages.length;f.update();assert.equal(window.messages.length,count,'no hidden renderer IPC churn');assert.equal(window.isVisible(),false);f.controller.show();assert.equal(window.shows,shows+1);
  f.main.destroy();
});

test('first hydration initializes the desktop once while account changes still reload it',t=>{
  const f=fixture(t);f.controller.show();const window=f.ready();assert.equal(window.isVisible(),false);
  f.update();assert.equal(window.reloads,0);assert.equal(window.isVisible(),true);
  f.update({accountScope:'second',accountGeneration:1});assert.equal(window.reloads,1);assert.equal(window.isVisible(),false);
  f.ready();assert.equal(window.isVisible(),true);f.main.destroy();
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

function preloadGestureFixture() {
  let bridge; const sent=[],ipcRenderer=new EventEmitter();
  ipcRenderer.send=(channel,value)=>sent.push({channel,...value});
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../fishing-preload.js'),'utf8'),{
    process:{isMainFrame:true},require:()=>({ipcRenderer,contextBridge:{exposeInMainWorld(_name,value){bridge=value;}}}),
  });
  const initial={accountScope:'active',accountGeneration:2,accountRestoreId:'restore-a',nativeSessionId:'native-idle',session:{id:'old-catch',phase:'caught'}};
  const update=value=>ipcRenderer.emit('tracer-fishing-snapshot',{},value);
  update(initial);return{bridge,sent,initial,update};
}

test('fast physical release waits for the new cast credentials and is delivered exactly once',()=>{
  const f=preloadGestureFixture();f.bridge.send({type:'cast-start',entranceReady:true});f.bridge.send({type:'cast-release'});
  assert.deepEqual(f.sent.map(x=>x.type),['cast-start']);
  f.update({...f.initial});f.bridge.send({type:'cast-start'});assert.equal(f.sent.length,1);
  const charging={...f.initial,nativeSessionId:'native-cast',session:{id:'new-cast',phase:'charging'}};
  f.update(charging);assert.deepEqual(f.sent.map(x=>x.type),['cast-start','cast-release']);
  assert.equal(f.sent[1].sessionId,'new-cast');assert.equal(f.sent[1].nativeSessionId,'native-cast');assert.equal(f.sent[1].sequence,1);
  f.update(charging);assert.equal(f.sent.length,2);
});

test('blur before cast acknowledgement cancels once instead of later throwing the rod',()=>{
  const f=preloadGestureFixture();f.bridge.send({type:'cast-start'});f.bridge.send({type:'cast-release'});f.bridge.send({type:'cancel'});f.bridge.send({type:'cast-release'});
  f.update({...f.initial,nativeSessionId:'native-cast',session:{id:'new-cast',phase:'charging'}});
  assert.deepEqual(f.sent.map(x=>x.type),['cast-start','cancel']);
});

test('accepted charging acknowledges release or cancellation despite a concurrent background save',()=>{
  for(const terminal of ['cast-release','cancel'])for(const status of [{disabled:true},{error:'Background save pending'},{disabled:true,error:'Background save pending'}]){
    const f=preloadGestureFixture();f.bridge.send({type:'cast-start'});f.bridge.send({type:'cast-release'});
    if(terminal==='cancel'){f.bridge.send({type:'cancel'});f.bridge.send({type:'cast-release'});}
    const charging={...f.initial,...status,nativeSessionId:'native-cast',session:{id:'new-cast',phase:'charging'}};
    f.update(charging);assert.deepEqual(f.sent.map(x=>x.type),['cast-start',terminal]);
    assert.equal(f.sent[1].sessionId,'new-cast');assert.equal(f.sent[1].nativeSessionId,'native-cast');assert.equal(f.sent[1].sequence,1);
    f.update({...charging,disabled:false,error:''});f.update(charging);assert.equal(f.sent.length,2,'an acknowledgement cannot replay the terminal action');
  }
});

test('a held cast retains its eventual physical release through a disabled charging acknowledgement',()=>{
  const f=preloadGestureFixture();f.bridge.send({type:'cast-start'});
  f.update({...f.initial,nativeSessionId:'native-cast',session:{id:'new-cast',phase:'charging'},disabled:true});
  assert.deepEqual(f.sent.map(x=>x.type),['cast-start']);f.bridge.send({type:'cast-release'});
  assert.deepEqual(f.sent.map(x=>x.type),['cast-start','cast-release']);assert.equal(f.sent[1].sessionId,'new-cast');
});

test('charging and disabled flags never bypass pending gesture account or restore isolation',()=>{
  for(const change of [{accountScope:'other'},{accountGeneration:3},{accountRestoreId:'restore-b'}]){
    const f=preloadGestureFixture();f.bridge.send({type:'cast-start'});f.bridge.send({type:'cast-release'});
    f.update({...f.initial,...change,nativeSessionId:'other-native',session:{id:'other-cast',phase:'charging'},disabled:true});
    f.update({...f.initial,nativeSessionId:'later-native',session:{id:'later-cast',phase:'charging'}});
    assert.deepEqual(f.sent.map(x=>x.type),['cast-start']);
  }
  const f=preloadGestureFixture();f.bridge.send({type:'cast-start'});f.bridge.send({type:'cancel'});
  f.update({...f.initial,nativeSessionId:'native-reload',disabled:true});
  f.update({...f.initial,nativeSessionId:'later-native',session:{id:'later-cast',phase:'charging'}});
  assert.deepEqual(f.sent.map(x=>x.type),['cast-start'],'native-only rotation discards the pending cancellation');
});

test('pending release is never replayed across accounts, restores, navigation or a failed cast',()=>{
  for(const change of [{accountScope:'other'},{accountGeneration:3},{accountRestoreId:'restore-b'},{nativeSessionId:'native-reload'},{error:'No bait'},{disabled:true}]){
    const f=preloadGestureFixture();f.bridge.send({type:'cast-start'});f.bridge.send({type:'cast-release'});
    f.update({...f.initial,...change});
    f.update({...f.initial,...change,error:'',disabled:false,nativeSessionId:'later-cast',session:{id:'new-cast',phase:'charging'}});
    assert.deepEqual(f.sent.map(x=>x.type),['cast-start'],JSON.stringify(change));
  }
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

test('desktop and companion box forward only known cosmetic skin IDs',t=>{
  const f=fixture(t);f.controller.show();f.update({desktopPond:{pond:{style:'coral',skinId:'sunny',decorations:[]},fish:[]},tackle:{pondSkinId:'sunny',baits:[]}});
  const w=f.ready(),value=w.messages.at(-1)[1];assert.equal(value.desktopPond.pond.skinId,'sunny');assert.equal(value.tackle.pondSkinId,'sunny');
  f.command('open-bait-box');const box=f.windows[2];box.webContents.emit('did-finish-load');assert.equal(box.messages.at(-1)[1].tackle.pondSkinId,'sunny');
  f.update({desktopPond:{pond:{style:'coral',skinId:'not-a-skin',decorations:[]},fish:[]},tackle:{pondSkinId:'not-a-skin',baits:[]}});
  assert.equal(w.messages.at(-1)[1].desktopPond.pond.skinId,null);assert.equal(w.messages.at(-1)[1].tackle.pondSkinId,null);f.main.destroy();
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


function baitFixture(t, patch={}, area) {
  const f=fixture(t,undefined,area);t.after(()=>f.main.destroy());
  const tackle={coins:100,equippedBaitId:'earthworm',busy:false,locked:false,pendingSave:false,baits:require('../../public/fishing-model').catalog.baits.map(b=>({...b,count:b.id==='earthworm'?30:0})),...patch};
  f.controller.show();f.update({tackle});f.ready();f.command('open-bait-box');
  const box=f.windows[2];box.webContents.emit('did-finish-load');
  const auth=()=>box.messages.filter(([channel])=>channel==='tracer-fishing-bait-snapshot').at(-1)[1];
  const command=(type,extra={},from=f.event(box))=>f.ipcMain.emit('tracer-fishing-bait-command',from,{...auth(),type,...extra});
  const menu=(id='prawn')=>{command('context-menu',{baitId:id});return f.menus.at(-1);};
  return {...f,tackle,box,boxCommand:command,boxAuth:auth,boxMenu:menu};
}

test('the bait box opens on desktop, stays bounded on negative monitors and receives only five bait rows',t=>{
  const area={x:-900,y:-600,width:900,height:600},f=baitFixture(t,{},area),b=f.box.getBounds();
  assert.equal(f.opened(),0);assert.equal(f.box.isVisible(),true);assert.equal(f.box.options.webPreferences.sandbox,true);
  assert.equal(b.width,320);assert.equal(b.height,208);
  const pond=f.windows[1].getBounds();assert(b.x+b.width<=pond.x||b.x>=pond.x+pond.width||b.y+b.height<=pond.y,'opened box avoids covering the pond');
  assert.equal(f.box.options.alwaysOnTop,true);assert.ok(b.x>=area.x&&b.y>=area.y&&b.x+b.width<=area.x+area.width&&b.y+b.height<=area.y+area.height);
  const state=f.boxAuth();assert.equal(state.tackle.baits.length,5);assert.equal(Object.hasOwn(state,'state'),false);assert.equal(Object.hasOwn(state.tackle.baits[0],'fishIds'),false);
  f.command('open-bait-box');assert.equal(f.windows.length,3,'opening reuses the current box');
  f.boxMenu().find(row=>row.label?.startsWith('购买并装备')).click();
  const action=f.main.messages.at(-1)[1];assert.equal(action.type,'buy-equip-bait');assert.equal(action.value,'prawn');assert.equal(Object.hasOwn(action,'price'),false);assert.equal(f.opened(),0);
  f.main.destroy();assert.equal(f.box.isDestroyed(),true);assert.equal(f.ipcMain.listenerCount('tracer-fishing-bait-command'),0);
});

test('bait menu never equips empty stock and disables spending while busy, fishing, unsaved or broke',t=>{
  for(const patch of [{},{busy:true},{locked:true},{pendingSave:true},{coins:0}]){
    const f=baitFixture(t,patch),rows=f.boxMenu();
    assert.equal(rows.find(row=>row.label==='装备').enabled,false);
    const buy=rows.find(row=>row.label?.startsWith('购买 10'));
    assert.equal(buy.enabled,!Object.keys(patch).length);
    if(!buy.enabled){const count=f.main.messages.length;buy.click();assert.equal(f.main.messages.length,count);}
  }
});

test('bait menu callbacks are single-use and revalidate balance, locks, cast and account at click time',t=>{
  for(const change of ['repeat','coins','busy','locked','cast','account','close']){
    const f=baitFixture(t),buy=f.boxMenu().find(row=>row.label?.startsWith('购买 10')),before=f.main.messages.length;
    if(change==='repeat'){buy.click();buy.click();assert.equal(f.main.messages.length,before+1);continue;}
    if(['coins','busy','locked'].includes(change))f.update({tackle:{...f.tackle,[change]:change==='coins'?0:true}});
    if(change==='cast')f.update({tackle:f.tackle,fishing:{sessionId:'new-cast'}});
    if(change==='account')f.update({accountScope:'another',tackle:f.tackle});
    if(change==='close'){f.boxCommand('close');f.command('open-bait-box');f.windows.at(-1).webContents.emit('did-finish-load');}
    buy.click();assert.equal(f.main.messages.length,before,change);
  }
});

test('bait commands reject stale scopes, frames, invented bait and arbitrary purchase messages',t=>{
  const f=baitFixture(t),before=f.main.messages.length;
  f.boxCommand('context-menu',{baitId:'prawn',nativeSessionId:'obsolete'});
  f.boxCommand('context-menu',{baitId:'prawn'},f.event(f.main));
  f.boxCommand('context-menu',{baitId:'prawn'},{...f.event(f.box),senderFrame:{url:f.box.webContents.mainFrame.url}});
  f.boxCommand('context-menu',{baitId:'free-gold'});f.boxCommand('buy-bait',{baitId:'prawn',quantity:100,price:0});
  assert.equal(f.menus.length,0);assert.equal(f.main.messages.length,before);
  f.ipcMain.emit('tracer-fishing-command',f.event(),{type:'account-lock'});assert.equal(f.box.isDestroyed(),true);
});

test('a stock-only equipment choice and save retry remain in the desktop window',t=>{
  const f=baitFixture(t,{baits:require('../../public/fishing-model').catalog.baits.map(b=>({...b,count:10}))});
  f.boxMenu().find(row=>row.label==='装备').click();assert.equal(f.main.messages.at(-1)[1].type,'equip-bait');
  f.update({tackle:{...f.tackle,pendingSave:true}});f.boxCommand('retry-save');assert.equal(f.main.messages.at(-1)[1].type,'retry-save');assert.equal(f.opened(),0);
});

test('bait preload forwards only menu intent with authoritative credentials, never a price or purchase',()=>{
  let bridge;const events=new EventEmitter(),sent=[];
  const ipc={on:(...args)=>events.on(...args),removeListener:(...args)=>events.removeListener(...args),send:(...args)=>sent.push(args)};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../fishing-bait-preload.js'),'utf8'),{require:()=>({ipcRenderer:ipc,contextBridge:{exposeInMainWorld:(_name,value)=>bridge=value}}),process:{isMainFrame:true}});
  bridge.send({type:'context-menu',baitId:'prawn'});assert.equal(sent.length,0);
  events.emit('tracer-fishing-bait-snapshot',{}, {accountScope:'guest',accountGeneration:2,accountRestoreId:'restore',sessionId:'cast',nativeSessionId:'native'});
  bridge.send({type:'context-menu',baitId:'prawn',nativeSessionId:'spoof',price:0,quantity:100});
  assert.deepEqual(JSON.parse(JSON.stringify(sent.at(-1))),['tracer-fishing-bait-command',{type:'context-menu',accountScope:'guest',accountGeneration:2,accountRestoreId:'restore',sessionId:'cast',nativeSessionId:'native',baitId:'prawn'}]);
  bridge.send({type:'buy-bait',baitId:'prawn'});bridge.send({type:'context-menu',baitId:'unknown'});assert.equal(sent.length,1);
});

test('a queued physical release retains hold time across credential acknowledgement',()=>{
  const f=preloadGestureFixture();f.bridge.send({type:'cast-start'});f.bridge.send({type:'cast-release',heldMs:420});
  f.update({...f.initial,nativeSessionId:'native-cast',session:{id:'new-cast',phase:'charging'}});
  assert.equal(f.sent[1].heldMs,420);
  const g=preloadGestureFixture();g.bridge.send({type:'cast-release',heldMs:Infinity});assert.equal(g.sent[0].heldMs,undefined);
});
