'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { attachFishingAquarium } = require('../fishing-aquarium');
const PREFIX = 'tracer-fishing-aquarium-';
const PAGE = '/fishing-aquarium-desktop.html';

function fixture(t, saved, area = { x: 0, y: 0, width: 1200, height: 900 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-aquarium-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (saved !== undefined) fs.writeFileSync(path.join(dir, 'fishing-aquarium-window.json'), typeof saved === 'string' ? saved : JSON.stringify(saved));
  const ipcMain = new EventEmitter(), windows = [], origin = 'http://127.0.0.1:18000'; let opened = 0;
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
      this.visible = options.show !== false; this.messages = []; this.reloads = 0; this.mouseModes = [];
      this.webContents = new EventEmitter(); this.webContents.mainFrame = { url: origin + '/' };
      this.webContents.send = (...args) => this.messages.push(args); this.webContents.setWindowOpenHandler = handler => { this.openHandler = handler; };
      this.webContents.reload = () => { this.reloads++; }; windows.push(this);
    }
    isDestroyed() { return !!this.dead; } isVisible() { return this.visible; } getBounds() { return { ...this.bounds }; }
    setPosition(x, y) { Object.assign(this.bounds, { x, y }); this.emit('moved'); }
    setBounds(bounds) { Object.assign(this.bounds, bounds); this.emit('moved'); this.emit('resize'); }
    setIgnoreMouseEvents(ignore, options) { this.mouseModes.push({ ignore, options }); }
    showInactive() { this.visible = true; } hide() { this.visible = false; }
    loadURL(url) { this.webContents.mainFrame.url = url; }
    destroy() { this.dead = true; this.emit('closed'); }
  }
  const main = new Window({ x: 0, y: 0, width: 1000, height: 800 });
  const screen = { getPrimaryDisplay: () => ({ workArea: area }), getDisplayNearestPoint: () => ({ workArea: area }) };
  const menus=[];const Menu={buildFromTemplate(items){menus.push(items);return{popup(){}};}};
  const controller = attachFishingAquarium(main, origin, dir, () => opened++, { BrowserWindow: Window, ipcMain, screen, Menu });
  const event = (target = main) => ({ sender: target.webContents, senderFrame: target.webContents.mainFrame });
  const latestWindow = () => windows.at(-1);
  const showcase = { fish: [{ id: 'gulpuffer', rarity: 'legendary' }], stats: { catches: 8, species: 3, ponds: 1 }, selection: { fishIds: ['gulpuffer'] } };
  function update(value = {}, from = event()) { ipcMain.emit(PREFIX + 'update', from, { accountScope: 'guest', accountGeneration: 0, accountRestoreId: '', language: 'zh', showcase, ...value }); }
  function ready() { const window = latestWindow(); window.webContents.emit('did-finish-load'); return window; }
  function credentials() { const s = latestWindow().messages.filter(([name]) => name === PREFIX + 'snapshot').at(-1)?.[1] || {}; return { accountScope: s.accountScope, accountGeneration: s.accountGeneration, accountRestoreId: s.accountRestoreId, nativeSessionId: s.nativeSessionId }; }
  const command = (type, value, extra = {}) => ipcMain.emit(PREFIX + 'command', event(latestWindow()), { ...credentials(), type, value, ...extra });
  const action = (type = 'open-aquarium', sequence = 1, extra = {}, from = event(latestWindow())) => ipcMain.emit(PREFIX + 'action', from, { ...credentials(), type, sequence, ...extra });
  return { menus, dir, controller, main, ipcMain, windows, latestWindow, event, update, ready, credentials, command, action, showcase, opened: () => opened };
}

test('native aquarium menu scales, moves, opens and hides with current account credentials',t=>{
  const f=fixture(t);f.controller.show();f.update();const w=f.ready();f.command('context-menu');
  const menu=f.menus.at(-1),choose=label=>menu.find(row=>row.label===label).click();
  choose('放大水族箱');assert.equal(w.getBounds().width,231);choose('恢复默认大小');assert.equal(w.getBounds().width,210);
  choose('移动水族箱');assert.equal(w.messages.at(-1)[1].type,'move');choose('打开传奇水族箱');assert.equal(f.opened(),1);
  f.update({accountScope:'new'});f.ready();choose('从桌面隐藏');assert.equal(w.visible,true,'stale menu cannot hide another account');
  f.command('context-menu');f.menus.at(-1).find(row=>row.label==='从桌面隐藏').click();assert.equal(w.visible,false);f.main.destroy();
});

test('native aquarium rotation covers a full turn without moving, scaling or mutating its collection',t=>{
  const f=fixture(t,{enabled:true,x:310,y:220,scale:1.5});f.update();const w=f.ready();f.command('context-menu');
  const menu=f.menus.at(-1),choose=label=>menu.find(row=>row.label===label).click(),latest=()=>w.messages.filter(([n])=>n===PREFIX+'snapshot').at(-1)[1];
  const before={bounds:w.getBounds(),showcase:structuredClone(latest().showcase),credentials:f.credentials(),mainMessages:f.main.messages.length};
  assert.equal(latest().desktopYaw,0);choose('向左旋转');assert.equal(latest().desktopYaw,-15);choose('向右旋转');assert.equal(latest().desktopYaw,0);
  const angles=new Set();for(let step=0;step<24;step++){choose('向右旋转');angles.add(latest().desktopYaw);assert(latest().desktopYaw>=-180&&latest().desktopYaw<180);}
  assert.equal(angles.size,24);assert(angles.has(-180));assert(angles.has(165));assert.equal(latest().desktopYaw,0);
  for(let step=0;step<24;step++)choose('向左旋转');assert.equal(latest().desktopYaw,0);
  choose('向右旋转');choose('向右旋转');choose('恢复默认角度');assert.equal(latest().desktopYaw,0);
  assert.deepEqual(w.getBounds(),before.bounds);assert.deepEqual(latest().showcase,before.showcase);assert.deepEqual(f.credentials(),before.credentials);assert.equal(f.main.messages.length,before.mainMessages);
  const saved=JSON.parse(fs.readFileSync(path.join(f.dir,'fishing-aquarium-window.json'),'utf8'));assert.deepEqual(saved,{enabled:true,x:310,y:220,scale:1.5,yaw:0});f.main.destroy();
});

test('native yaw survives hide, show, renderer recreation and application relaunch as local display settings',t=>{
  const f=fixture(t,{enabled:true,x:250,y:200,scale:1.25,yaw:45});f.update();let w=f.ready();
  const latest=()=>w.messages.filter(([n])=>n===PREFIX+'snapshot').at(-1)[1];assert.equal(latest().desktopYaw,45);
  f.command('context-menu');f.menus.at(-1).find(row=>row.label==='向左旋转').click();assert.equal(latest().desktopYaw,30);
  f.controller.hide();f.controller.show();assert.equal(latest().desktopYaw,30);
  const nativeSession=f.credentials().nativeSessionId;w.webContents.emit('render-process-gone');f.controller.show();w=f.ready();assert.equal(latest().desktopYaw,30);assert.notEqual(f.credentials().nativeSessionId,nativeSession);
  const saved=JSON.parse(fs.readFileSync(path.join(f.dir,'fishing-aquarium-window.json'),'utf8')),restored=fixture(t,saved);restored.update();const next=restored.ready();
  assert.deepEqual(next.getBounds(),w.getBounds());assert.equal(next.messages.filter(([n])=>n===PREFIX+'snapshot').at(-1)[1].desktopYaw,30);
  assert.deepEqual(Object.keys(saved).sort(),['enabled','scale','x','y','yaw']);f.main.destroy();restored.main.destroy();
});

test('old aquarium settings default to zero and saved yaw normalizes finite angles or rejects nonfinite values',t=>{
  const cases=[
    [{enabled:true},0],[{enabled:true,yaw:180},-180],[{enabled:true,yaw:540},-180],[{enabled:true,yaw:-540},-180],
    [{enabled:true,yaw:735.5},15.5],[{enabled:true,yaw:-735.5},-15.5],[{enabled:true,yaw:-0},0],
    [{enabled:true,yaw:'90'},0],[{enabled:true,yaw:null},0],[{enabled:true,yaw:{}},0],
    ['{"enabled":true,"yaw":1e999}',0],['{"enabled":true,"yaw":-1e999}',0],['not json',0]
  ];
  for(const [saved,expected]of cases){const f=fixture(t,saved);f.controller.show();f.update();const w=f.ready(),snapshot=w.messages.filter(([n])=>n===PREFIX+'snapshot').at(-1)[1];assert.equal(snapshot.desktopYaw,expected);assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'fishing-aquarium-window.json'),'utf8')).yaw,expected);f.main.destroy();}
});

test('rotation menus remain scoped, hidden and dragged displays reject stale clicks, and renderers cannot set yaw',t=>{
  const f=fixture(t,{enabled:true,yaw:75});f.update({language:'en',desktopYaw:-30,showcase:{...f.showcase,yaw:-45}});const w=f.ready();
  const latest=()=>w.messages.filter(([n])=>n===PREFIX+'snapshot').at(-1)[1];assert.equal(latest().desktopYaw,75);assert.equal(Object.hasOwn(latest().showcase,'yaw'),false);
  f.command('context-menu',undefined,{nativeSessionId:'stale'});assert.equal(f.menus.length,0);
  f.command('context-menu');const menu=f.menus.at(-1),left=menu.find(row=>row.label==='Rotate left'),right=menu.find(row=>row.label==='Rotate right');assert(left);assert(right);assert(menu.some(row=>row.label==='Reset angle'));
  const before=JSON.parse(fs.readFileSync(path.join(f.dir,'fishing-aquarium-window.json'),'utf8'));
  f.command('set-yaw',90);f.command('rotate',15);assert.equal(latest().desktopYaw,75);
  f.command('drag-start',{screenX:w.bounds.x+10,screenY:w.bounds.y+10});left.click();assert.equal(latest().desktopYaw,75);f.command('drag-end',{screenX:w.bounds.x+10,screenY:w.bounds.y+10});
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir,'fishing-aquarium-window.json'),'utf8')),before);
  f.controller.hide();left.click();assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'fishing-aquarium-window.json'),'utf8')).yaw,75);f.controller.show();
  f.update({accountScope:'other',accountGeneration:2});f.ready();right.click();assert.equal(latest().desktopYaw,75,'a former account menu cannot change current display');
  f.command('context-menu');const fresh=f.menus.at(-1).find(row=>row.label==='向右旋转');fresh.click();assert.equal(latest().desktopYaw,90);
  f.ipcMain.emit(PREFIX+'command',f.event(),{type:'account-lock'});fresh.click();assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'fishing-aquarium-window.json'),'utf8')).yaw,90);f.main.destroy();fresh.click();
});

test('aquarium display is isolated, non-focusing and invisible before authoritative hydration', t => {
  const f = fixture(t); f.controller.show(); const w = f.ready(); assert.equal(w.visible, false);
  f.update(); f.ready(); assert.equal(w.visible, true);
  assert.equal(w.options.width, 210); assert.equal(w.options.height, 170);
  for (const key of ['transparent', 'alwaysOnTop', 'skipTaskbar']) assert.equal(w.options[key], true);
  assert.equal(w.options.focusable, false); assert.equal(w.options.backgroundColor, '#00000000');
  assert.equal(w.options.webPreferences.contextIsolation, true); assert.equal(w.options.webPreferences.sandbox, true);
  assert.equal(w.options.webPreferences.nodeIntegration, false); assert.equal(w.options.webPreferences.backgroundThrottling, true);
  assert.equal(w.webContents.mainFrame.url.endsWith(PAGE), true); assert.deepEqual(w.openHandler({ url: 'https://example.com' }), { action: 'deny' });
  let rejected = 0; w.webContents.emit('will-navigate', { preventDefault() { rejected++; } }, 'https://example.com');
  w.webContents.emit('will-attach-webview', { preventDefault() { rejected++; } }); assert.equal(rejected, 2);
  f.main.destroy(); assert.equal(w.dead, true);
  for (const name of ['update', 'show', 'hide', 'action', 'command']) assert.equal(f.ipcMain.listenerCount(PREFIX + name), 0);
});

test('projection excludes ledger growth and bounds fish, stats and payload size', t => {
  const f = fixture(t); f.controller.show();
  f.update({ state: { catches: 'x'.repeat(100000) }, showcase: { ...f.showcase, fish: Array.from({ length: 50 }, (_, i) => ({ id: 'fish' + i })), stats: { catches: -1, species: NaN, ponds: 3, coins: 999999 }, inventory: 'x'.repeat(50000) } });
  const w = f.ready(), first = w.messages.filter(([n]) => n === PREFIX + 'snapshot').at(-1)[1];
  assert.equal(first.showcase.fish.length, 3); assert.equal(Object.hasOwn(first, 'state'), false); assert.equal(Object.hasOwn(first.showcase, 'inventory'), false);
  assert.deepEqual(Object.keys(first.showcase).sort(), ['fish', 'selection', 'stats']);
  assert.deepEqual(Object.keys(first.showcase.selection), ['fishIds']);
  assert.deepEqual(first.showcase.stats, { catches: 0, species: 0, ponds: 3 });
  const before = w.messages.length;
  f.update({ showcase: { fish: [{ name: 'x'.repeat(40000) }] } }); f.update({ accountGeneration: -1 });
  f.update({ accountScope: {} }); f.update({ accountRestoreId: 'x'.repeat(300) });
  assert.equal(w.messages.length, before); f.main.destroy();
});

test('only a visible current local top frame can open the aquarium, never mutate stock', t => {
  const f = fixture(t); f.controller.show(); f.update(); const w = f.ready();
  for (const from of [f.event(), { sender: w.webContents, senderFrame: { url: w.webContents.mainFrame.url } }, { sender: {}, senderFrame: w.webContents.mainFrame }]) f.action('open-aquarium', 1, {}, from);
  for (const type of ['buy-aquarium', 'equip-rod', 'catch', 'feed-pond', 'update', 'cast-start']) f.action(type);
  for (const extra of [{ accountScope: 'foreign' }, { accountGeneration: 8 }, { accountRestoreId: 'stale' }, { nativeSessionId: 'stale' }]) f.action('open-aquarium', 1, extra);
  f.action('open-aquarium', NaN); f.action('open-aquarium', 5000); assert.equal(f.opened(), 0);
  f.action('open-aquarium', 1, { reward: 99999, fishIds: ['legendary'] }); assert.equal(f.opened(), 1);
  const message = f.main.messages.at(-1); assert.equal(message[0], PREFIX + 'action'); assert.equal(message[1].type, 'open-aquarium');
  assert.equal(Object.hasOwn(message[1], 'reward'), false); assert.equal(Object.hasOwn(message[1], 'fishIds'), false);
  f.action('open-aquarium', 1); assert.equal(f.opened(), 1);
  f.controller.hide(); f.action('open-aquarium', 2); assert.equal(f.opened(), 1); assert.equal(f.main.messages.length, 1, 'hiding never cancels a separate fishing cast');
  f.main.destroy();
});

test('account lock, restore and generation changes clear display and invalidate queued actions', t => {
  const f = fixture(t); f.controller.show(); f.update(); const w = f.ready(), old = f.credentials();
  f.ipcMain.emit(PREFIX + 'command', f.event(), { type: 'account-lock' }); assert.equal(w.visible, false);
  assert.deepEqual(w.messages.at(-1), [PREFIX + 'visibility', { visible: false, clear: true }]);
  f.update({ accountScope: 'other' }); f.action('open-aquarium', 1, old); assert.equal(f.opened(), 0);
  f.ipcMain.emit(PREFIX + 'command', f.event(), { type: 'account-unlock' }); f.update({ accountScope: 'other', accountGeneration: 2, accountRestoreId: 'new' }); f.ready();
  f.action('open-aquarium', 1, old); assert.equal(f.opened(), 0); f.action(); assert.equal(f.opened(), 1);
  const restore = f.credentials(); f.update({ accountScope: 'other', accountGeneration: 3, accountRestoreId: 'new' }); f.ready();
  f.action('open-aquarium', 2, restore); assert.equal(f.opened(), 1);
  const after = w.messages.length; f.update({ accountScope: 'other', accountGeneration: 2, accountRestoreId: 'new' }); assert.equal(w.messages.length, after, 'old generation cannot replace fresh projection');
  f.main.destroy();
});

test('main navigation waits for new account hydration; late ready cannot reopen hidden display', t => {
  const f = fixture(t); f.controller.show(); f.update(); const w = f.ready();
  f.main.webContents.emit('did-start-navigation', { isSameDocument: false, isMainFrame: true }); f.ready(); assert.equal(w.visible, false);
  f.main.webContents.emit('did-frame-navigate', {}, '', 200, 'OK', false); f.update(); assert.equal(w.visible, false);
  f.main.webContents.emit('did-frame-navigate', {}, '', 200, 'OK', true); f.ready(); assert.equal(w.visible, false);
  f.update(); f.ready(); assert.equal(w.visible, true);
  f.controller.hide(); assert.deepEqual(w.messages.at(-1), [PREFIX + 'visibility', { visible: false, clear: false }]); f.ready(); assert.equal(w.visible, false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'fishing-aquarium-window.json'))).enabled, false); f.main.destroy();
});

test('blank-only passthrough is scoped; dragging clamps negative monitors and stores no collection', t => {
  const f = fixture(t, { enabled: true, x: -5000, y: -5000 }, { x: -900, y: -100, width: 900, height: 700 }); f.update(); const w = f.ready();
  assert.equal(w.bounds.x, -900); assert.equal(w.bounds.y, -100);
  f.command('pointer-pass-through', true, { nativeSessionId: 'old' }); assert.equal(w.mouseModes.at(-1).ignore, false);
  f.command('pointer-pass-through', true); assert.deepEqual(w.mouseModes.at(-1), { ignore: true, options: { forward: true } });
  f.command('drag-start', { screenX: -880, screenY: -80 }); assert.equal(w.mouseModes.at(-1).ignore, false);
  f.command('pointer-pass-through', true); assert.equal(w.mouseModes.at(-1).ignore, false);
  f.command('drag-move', { screenX: -780, screenY: 20 }); assert.equal(w.bounds.x, -800); assert.equal(w.bounds.y, 0);
  f.command('drag-end', { screenX: 10000, screenY: 10000 }); assert.equal(w.bounds.x, -210); assert.equal(w.bounds.y, 430);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir, 'fishing-aquarium-window.json'))), { enabled: true, x: -210, y: 430, scale: 1, yaw: 0 });
  f.controller.hide(); f.command('drag-start', { screenX: -400, screenY: 270 }); f.command('drag-move', { screenX: -700, screenY: 0 }); assert.equal(w.bounds.x, -210); f.main.destroy();
});

test('aquarium scaling preserves aspect ratio and center, fits the display, and survives reopening', t => {
  const f = fixture(t, { enabled: true, x: 300, y: 250 }); f.update(); const w = f.ready();
  const center = { x: w.bounds.x + w.bounds.width / 2, y: w.bounds.y + w.bounds.height / 2 };
  f.command('resize', 2); assert.equal(w.bounds.width, 420); assert.equal(w.bounds.height, 340);
  assert.equal(w.bounds.x + w.bounds.width / 2, center.x); assert.equal(w.bounds.y + w.bounds.height / 2, center.y);
  const saved = JSON.parse(fs.readFileSync(path.join(f.dir, 'fishing-aquarium-window.json'))); assert.equal(saved.scale, 2);
  assert.equal(w.messages.filter(([n]) => n === PREFIX + 'snapshot').at(-1)[1].desktopScale, 2);
  const restored = fixture(t, saved); assert.deepEqual(restored.latestWindow().bounds, w.bounds);
  f.command('resize', 200); assert.equal(w.bounds.width, 525); assert.equal(w.bounds.height, 425);
  f.command('resize', .01); assert.equal(w.bounds.width, 158); assert.equal(w.bounds.height, 128);
  const before = { ...w.bounds }; f.command('resize', NaN); f.command('resize', Infinity); f.command('resize', '2'); f.command('resize', 2, { nativeSessionId: 'stale' }); assert.deepEqual(w.bounds, before);
  f.command('drag-start', { screenX: w.bounds.x + 10, screenY: w.bounds.y + 10 }); f.command('resize', 2); assert.deepEqual(w.bounds, before);
  f.command('drag-end', { screenX: w.bounds.x + 10, screenY: w.bounds.y + 10 }); f.controller.hide(); f.command('resize', 2); assert.deepEqual(w.bounds, before);
  f.main.destroy(); restored.main.destroy();
});

test('scaling stays within small negative-coordinate monitor work areas', t => {
  const area = { x: -400, y: -200, width: 320, height: 220 }, f = fixture(t, { enabled: true, x: -400, y: -200, scale: 2.5 }, area); f.update(); const w = f.ready();
  for (const size of [2.5, .75, 1, 2]) { f.command('resize', size); const b = w.bounds; assert(b.x >= area.x && b.y >= area.y); assert(b.x + b.width <= area.x + area.width); assert(b.y + b.height <= area.y + area.height); assert(Math.abs(b.width / b.height - 210 / 170) < .01); }
  f.main.destroy();
});

test('renderer crash recreates a fresh non-focusing native capability', t => {
  const f = fixture(t); f.controller.show(); f.update(); const w = f.ready(), old = f.credentials();
  w.webContents.emit('render-process-gone'); assert.equal(w.dead, true);
  f.controller.show(); const next = f.ready(); assert.equal(next.visible, true); assert.notEqual(f.credentials().nativeSessionId, old.nativeSessionId);
  f.action('open-aquarium', 1, old); assert.equal(f.opened(), 0); f.action(); assert.equal(f.opened(), 1); f.main.destroy();
});

test('aquarium preload supplies native credentials, restricts capabilities and forgets locked data', () => {
  let bridge; const sent = [], ipcRenderer = new EventEmitter(); ipcRenderer.send = (...args) => sent.push(args);
  const source = fs.readFileSync(path.join(__dirname, '../fishing-aquarium-preload.js'), 'utf8');
  const context = { process: { isMainFrame: true }, require: () => ({ ipcRenderer, contextBridge: { exposeInMainWorld(name, value) { assert.equal(name, 'FishingAquariumDesktop'); bridge = value; } } }) };
  vm.runInNewContext(source, context); bridge.send({ type: 'open-aquarium' }); assert.equal(sent.length, 0);
  ipcRenderer.emit(PREFIX + 'snapshot', {}, { accountScope: 'active', accountGeneration: 2, accountRestoreId: 'restore', nativeSessionId: 'native', desktopVisible: true });
  bridge.send({ type: 'open-aquarium', accountScope: 'forged', fishIds: ['fake'] }); assert.equal(sent.at(-1)[1].accountScope, 'active'); assert.equal(sent.at(-1)[1].sequence, 1); assert.equal(Object.hasOwn(sent.at(-1)[1], 'fishIds'), false);
  bridge.send({ type: 'cast' }); bridge.send({ type: 'equip' }); bridge.send({ type: 'drag-start', value: { screenX: Infinity, screenY: 1 } }); assert.equal(sent.length, 1);
  let calls = 0; const off = bridge.onVisibility(value => { assert.equal(value.visible, false); calls++; });
  ipcRenderer.emit(PREFIX + 'visibility', {}, { visible: false, clear: true }); assert.equal(calls, 1); bridge.send({ type: 'open-aquarium' }); assert.equal(sent.length, 1); off();
  ipcRenderer.emit(PREFIX + 'snapshot', {}, { nativeSessionId: 'second' }); bridge.send({ type: 'open-aquarium' }); assert.equal(sent.at(-1)[1].sequence, 1);
  let exposures = 0; vm.runInNewContext(source, { ...context, process: { isMainFrame: false }, require: () => ({ ipcRenderer, contextBridge: { exposeInMainWorld() { exposures++; } } }) }); assert.equal(exposures, 0);
  const before = sent.length; for (const value of [NaN, Infinity, '2', {}]) bridge.send({ type: 'resize', value }); assert.equal(sent.length, before);
  bridge.send({ type: 'resize', value: 20, nativeSessionId: 'forged' }); assert.equal(sent.at(-1)[1].value, 2.5); assert.equal(sent.at(-1)[1].nativeSessionId, 'second');
});
