'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { attachGarden } = require('../garden');
const PREFIX = 'tracer-garden-';
const PAGE = '/garden-desktop.html';

function fixture(t, saved, area = { x: 0, y: 0, width: 1200, height: 900 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-garden-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (saved !== undefined) fs.writeFileSync(path.join(dir, 'garden-window.json'), typeof saved === 'string' ? saved : JSON.stringify(saved));
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
  const controller = attachGarden(main, origin, dir, () => opened++, { BrowserWindow: Window, ipcMain, screen, Menu });
  const event = (target = main) => ({ sender: target.webContents, senderFrame: target.webContents.mainFrame });
  const latestWindow = () => windows.at(-1);
  const garden = {farmId:'coast',plants:[{id:'ready',title:'Finish a task',kind:'sunflower',stage:4,variant:'normal',canHarvest:true},{id:'growing',title:'A growing task',kind:'apple',stage:1,canHarvest:false}],total:2};
  function update(value = {}, from = event()) { ipcMain.emit(PREFIX + 'update', from, { accountScope: 'guest', accountGeneration: 0, accountRestoreId: '', language: 'zh', garden, ...value }); }
  function ready() { const window = latestWindow(); window.webContents.emit('did-finish-load'); return window; }
  function credentials() { const s = latestWindow().messages.filter(([name]) => name === PREFIX + 'snapshot').at(-1)?.[1] || {}; return { accountScope: s.accountScope, accountGeneration: s.accountGeneration, accountRestoreId: s.accountRestoreId, nativeSessionId: s.nativeSessionId }; }
  const command = (type, value, extra = {}) => ipcMain.emit(PREFIX + 'command', event(latestWindow()), { ...credentials(), type, value, ...extra });
  const action = (type = 'open-garden', sequence = 1, extra = {}, from = event(latestWindow())) => ipcMain.emit(PREFIX + 'action', from, { ...credentials(), type, sequence, ...extra });
  return { menus, dir, controller, main, ipcMain, windows, latestWindow, event, update, ready, credentials, command, action, garden, opened: () => opened };
}

test('desktop garden is opt-in, restores bounds and uses an isolated renderer',t=>{
 const f=fixture(t);assert.equal(f.windows.length,1);f.controller.show();f.update();const w=f.ready();assert.equal(w.visible,true);assert.equal(w.getBounds().width,440);assert.equal(w.options.webPreferences.nodeIntegration,false);assert.equal(w.options.webPreferences.sandbox,true);assert.equal(w.options.webPreferences.contextIsolation,true);
 f.command('resize',1.5);const bounds=w.getBounds();f.controller.hide();assert.equal(w.visible,false);f.controller.show();assert.deepEqual(w.getBounds(),bounds);const saved=JSON.parse(fs.readFileSync(path.join(f.dir,'garden-window.json'),'utf8'));assert.equal(saved.enabled,true);assert.equal(saved.scale,1.5);assert.deepEqual(Object.keys(saved).sort(),['enabled','scale','x','y']);f.main.destroy();
});
test('harvesting forwards one authorized mature plant request and never mutates native inventory',t=>{
 const f=fixture(t);f.controller.show();f.update();const w=f.ready(),requests=()=>f.main.messages.filter(([n])=>n===PREFIX+'action');
 f.action('harvest',1,{id:'ready'});assert.equal(requests().length,1);assert.equal(requests()[0][1].id,'ready');assert.equal(f.opened(),0);f.action('harvest',1,{id:'ready'});f.action('harvest',2,{id:'growing'});f.action('harvest',3,{id:'missing'});assert.equal(requests().length,1);
 f.update({busy:true});f.action('harvest',4,{id:'ready'});assert.equal(requests().length,1);f.update();f.action('open-garden',5);assert.equal(f.opened(),1);assert.equal(w.messages.filter(([n])=>n===PREFIX+'snapshot').at(-1)[1].garden.plants[0].canHarvest,true);f.main.destroy();
});
test('stale sessions, subframes, external documents and hidden windows cannot harvest',t=>{
 const f=fixture(t);f.controller.show();f.update();const w=f.ready(),old=f.credentials(),requests=()=>f.main.messages.filter(([n])=>n===PREFIX+'action').length;
 f.action('harvest',1,{id:'ready'},{sender:w.webContents,senderFrame:{url:w.webContents.mainFrame.url}});assert.equal(requests(),0);
 f.action('harvest',1,{id:'ready',nativeSessionId:'fake'});assert.equal(requests(),0);f.controller.hide();f.action('harvest',1,{id:'ready'});assert.equal(requests(),0);f.controller.show();
 f.update({accountScope:'another',accountGeneration:1});assert.equal(w.visible,false);f.ready();f.action('harvest',1,{id:'ready',...old});assert.equal(requests(),0);f.action('harvest',1,{id:'ready'});assert.equal(requests(),1);f.main.destroy();
});
test('account lock clears visible plants and requires a new projection after unlock',t=>{
 const f=fixture(t);f.controller.show();f.update();const w=f.ready();f.ipcMain.emit(PREFIX+'command',f.event(),{type:'account-lock'});assert.equal(w.visible,false);assert(w.messages.some(([n,v])=>n===PREFIX+'visibility'&&v.clear));f.update();assert.equal(w.visible,false);f.ipcMain.emit(PREFIX+'command',f.event(),{type:'account-unlock'});f.update({accountScope:'new'});f.ready();assert.equal(w.visible,true);f.main.destroy();
});
test('native projection caps plants, strips fields and constrains display to a real region',t=>{
 const f=fixture(t);f.controller.show();f.update({garden:{farmId:'https://bad',total:1000000,plants:Array.from({length:30},(_,i)=>({id:'p'+i,title:'x'.repeat(500),kind:'apple',stage:900,canHarvest:true,secret:'hidden'}))}});const w=f.ready(),state=w.messages.filter(([n])=>n===PREFIX+'snapshot').at(-1)[1];assert.equal(state.garden.plants.length,6);assert.equal(state.garden.farmId,'meadow');assert.equal(state.garden.total,50000);assert.equal(state.garden.plants[0].title.length,200);assert.equal(state.garden.plants[0].stage,4);assert.equal(state.garden.plants[0].secret,undefined);f.main.destroy();
});
test('resize and movement stay inside the current work area; closing main removes native handlers',t=>{
 const f=fixture(t,{enabled:true,x:100000,y:-999,scale:9},{x:-800,y:20,width:800,height:600});f.update();const w=f.ready();for(const scale of [.1,100,1]){f.command('resize',scale);const b=w.getBounds();assert(b.x>=-800&&b.y>=20&&b.x+b.width<=0&&b.y+b.height<=620);}
 f.command('drag-start',{screenX:w.bounds.x+20,screenY:w.bounds.y+20});f.command('drag-move',{screenX:100000,screenY:-100000});f.command('drag-end',{screenX:100000,screenY:-100000});assert(w.bounds.x+w.bounds.width<=0);assert(w.bounds.y>=20);f.main.destroy();assert(w.dead);for(const channel of ['update','show','hide','command','action'])assert.equal(f.ipcMain.listenerCount(PREFIX+channel),0);
});

