'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {eligible,localPoint,attachGardenTrail}=require('../garden-trail');
const valid={trailEnabled:true,pet:{id:'garden_apple_shiny'},unlocked:['garden_apple_shiny']};
function fixture(){
  const windows=[],timers=new Map(),ipcMain=new EventEmitter(),powerMonitor=new EventEmitter(),main=new EventEmitter();let serial=0,point={x:-50,y:80};
  class Window extends EventEmitter{
    constructor(options){super();this.options=options;this.webContents=new EventEmitter();this.webContents.mainFrame={};this.webContents.setWindowOpenHandler=handler=>{this.open=handler;};this.messages=[];this.webContents.send=(...args)=>this.messages.push(args);windows.push(this);}
    isDestroyed(){return !!this.dead;}setIgnoreMouseEvents(value){this.ignores=value;}setAlwaysOnTop(value,level){this.top=[value,level];}setVisibleOnAllWorkspaces(){}setBounds(bounds){this.bounds=bounds;}showInactive(){this.visible=true;}hide(){this.visible=false;}loadFile(){return Promise.resolve();}destroy(){this.dead=true;this.emit('closed');}
  }
  const screen={getCursorScreenPoint:()=>point,getDisplayNearestPoint:p=>p.x<0?{id:1,bounds:{x:-1920,y:0,width:1920,height:1080}}:{id:2,bounds:{x:0,y:0,width:2560,height:1440}}};
  const trail=attachGardenTrail(main,{BrowserWindow:Window,screen,ipcMain,powerMonitor,clock:{setInterval(fn){const id=++serial;timers.set(id,fn);return id;},clearInterval(id){timers.delete(id);}}});
  return {trail,main,windows,timers,ipcMain,powerMonitor,move(next){point=next;for(const fn of timers.values())fn();}};
}
test('desktop trails require an enabled and owned shiny garden companion',()=>{
  for(const kind of ['neon_orchid','volt_berry','crystal_tree']){const id='garden_'+kind+'_shiny';assert.equal(eligible({trailEnabled:true,pet:{id},unlocked:[id]}),true);assert.equal(eligible({trailEnabled:true,pet:{id},unlocked:[]}),false);}
  assert.equal(eligible(valid),true);for(const input of [{...valid,trailEnabled:false},{...valid,unlocked:[]},{...valid,pet:{id:'garden_apple',shiny:true}},{...valid,pet:{id:'custom_shiny',shiny:true}},null])assert.equal(eligible(input),false);
  assert.deepEqual(localPoint({x:-50,y:80},{x:-1920,y:0}),{x:1870,y:80});
});
test('the trail window never takes focus/clicks, changes monitors, and stops on toggle or main-window disposal',()=>{
  const f=fixture();f.trail.update(valid);const w=f.windows[0];assert.equal(w.options.focusable,false);assert.equal(w.ignores,true);assert.equal(w.options.webPreferences.nodeIntegration,false);assert.equal(w.options.webPreferences.sandbox,true);
  w.webContents.emit('did-finish-load');assert.equal(f.timers.size,1);assert.equal(w.visible,true);
  assert.deepEqual(w.messages.at(-1)[1],{x:1870,y:80,reset:true});
  f.move({x:20,y:30});assert.equal(w.bounds.width,2560);assert.deepEqual(w.messages.at(-1)[1],{x:20,y:30,reset:true});
  const count=w.messages.length;f.move({x:20,y:30});assert.equal(w.messages.length,count,'stationary pointer sends no duplicate points');
  f.trail.update({...valid,trailEnabled:false});assert.equal(f.timers.size,0);assert.equal(w.dead,true);
  f.trail.update(valid);f.main.emit('closed');assert.equal(f.windows[1].dead,true);assert.equal(f.ipcMain.listenerCount('tracer-garden-trail-motion'),0);
});
test('screen lock, sleep and trusted reduced-motion settings suspend sampling without losing the chosen reward',()=>{
  const f=fixture();f.trail.update(valid);const w=f.windows[0];w.webContents.emit('did-finish-load');
  f.powerMonitor.emit('lock-screen');assert.equal(f.timers.size,0);assert.equal(w.visible,false);
  f.powerMonitor.emit('unlock-screen');assert.equal(f.timers.size,1);
  f.ipcMain.emit('tracer-garden-trail-motion',{sender:{},senderFrame:{}},false);assert.equal(f.timers.size,1);
  f.ipcMain.emit('tracer-garden-trail-motion',{sender:w.webContents,senderFrame:w.webContents.mainFrame},false);assert.equal(f.timers.size,0);
  f.ipcMain.emit('tracer-garden-trail-motion',{sender:w.webContents,senderFrame:w.webContents.mainFrame},true);assert.equal(f.timers.size,1);
  f.trail.destroy();assert.equal(f.timers.size,0);assert.equal(f.powerMonitor.eventNames().length,0);
});
