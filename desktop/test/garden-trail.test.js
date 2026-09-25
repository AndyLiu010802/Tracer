'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {eligible,localPoint,attachGardenTrail}=require('../garden-trail');
const valid={trailEnabled:true,pet:{id:'garden_apple_shiny'},unlocked:['garden_apple_shiny']};
function fixture(offsetY=0){
  const windows=[],timers=new Map(),ipcMain=new EventEmitter(),powerMonitor=new EventEmitter(),main=new EventEmitter();let serial=0,point={x:-50,y:80},time=0,displayQueries=0,maxTimers=0;
  class Window extends EventEmitter{
    constructor(options){super();this.options=options;this.webContents=new EventEmitter();this.webContents.mainFrame={};this.webContents.setWindowOpenHandler=handler=>{this.open=handler;};this.messages=[];this.webContents.send=(...args)=>this.messages.push(args);windows.push(this);}
    isDestroyed(){return !!this.dead;}setIgnoreMouseEvents(value){this.ignores=value;}setAlwaysOnTop(value,level){this.top=[value,level];}setVisibleOnAllWorkspaces(){}setBounds(bounds){this.bounds={...bounds,y:bounds.y+offsetY};}getBounds(){return this.bounds;}showInactive(){this.visible=true;}hide(){this.visible=false;}loadFile(){return Promise.resolve();}destroy(){this.dead=true;this.emit('closed');}
  }
  const screen={getCursorScreenPoint:()=>point,getDisplayNearestPoint:p=>{displayQueries++;return p.x<0?{id:1,bounds:{x:-1920,y:0,width:1920,height:1080}}:{id:2,bounds:{x:0,y:0,width:2560,height:1440}};}};
  const trail=attachGardenTrail(main,{BrowserWindow:Window,screen,ipcMain,powerMonitor,clock:{now:()=>time,setInterval(fn,interval){const id=++serial;timers.set(id,{fn,interval,next:time+interval});maxTimers=Math.max(maxTimers,timers.size);return id;},clearInterval(id){timers.delete(id);}}});
  function advance(ms){
    const until=time+ms;
    while(timers.size){
      const next=[...timers.values()].sort((a,b)=>a.next-b.next)[0];
      if(next.next>until)break;
      time=next.next;next.next+=next.interval;next.fn();
    }
    time=until;
  }
  return {trail,main,windows,timers,ipcMain,powerMonitor,advance,setPoint(next){point=next;},move(next){point=next;for(const timer of [...timers.values()])timer.fn();},get displayQueries(){return displayQueries;},get maxTimers(){return maxTimers;},get interval(){return [...timers.values()][0]?.interval;}};
}
test('desktop trails require an enabled and owned shiny garden companion',()=>{
  for(const kind of ['neon_orchid','volt_berry','crystal_tree']){const id='garden_'+kind+'_shiny';assert.equal(eligible({trailEnabled:true,pet:{id},unlocked:[id]}),true);assert.equal(eligible({trailEnabled:true,pet:{id},unlocked:[]}),false);}
  assert.equal(eligible(valid),true);for(const input of [{...valid,trailEnabled:false},{...valid,unlocked:[]},{...valid,pet:{id:'garden_apple',shiny:true}},{...valid,pet:{id:'custom_shiny',shiny:true}},null])assert.equal(eligible(input),false);
  assert.deepEqual(localPoint({x:-50,y:80},{x:-1920,y:0}),{x:1870,y:80});
});
test('the trail window never takes focus/clicks, changes monitors, and stops on toggle or main-window disposal',()=>{
  const f=fixture();f.trail.update(valid);const w=f.windows[0];assert.equal(w.options.focusable,false);assert.equal(w.ignores,true);assert.equal(w.options.webPreferences.nodeIntegration,false);assert.equal(w.options.webPreferences.sandbox,true);
  w.webContents.emit('did-finish-load');assert.equal(f.timers.size,1);assert.equal(w.visible,true);
  assert.deepEqual(w.messages.at(-1)[1],{x:1870,y:80,reset:true,kind:'apple'});
  f.move({x:20,y:30});assert.equal(w.bounds.width,2560);assert.deepEqual(w.messages.at(-1)[1],{x:20,y:30,reset:true,kind:'apple'});
  const count=w.messages.length;f.move({x:20,y:30});assert.equal(w.messages.length,count,'stationary pointer sends no duplicate points');
  f.trail.update({...valid,trailEnabled:false});assert.equal(f.timers.size,0);assert.equal(w.dead,true);
  f.trail.update(valid);f.main.emit('closed');assert.equal(f.windows[1].dead,true);assert.equal(f.ipcMain.listenerCount('tracer-garden-trail-motion'),0);
});

test('switching owned shiny companions changes the trail at a stationary pointer without another overlay or timer',()=>{
  const f=fixture();f.trail.update(valid);const w=f.windows[0];w.webContents.emit('did-finish-load');
  f.trail.update({...valid,pet:{id:'garden_cherry_shiny'},unlocked:['garden_cherry_shiny']});
  assert.equal(f.windows.length,1);assert.equal(f.timers.size,1);
  assert.deepEqual(w.messages.at(-1)[1],{x:1870,y:80,reset:true,kind:'cherry'});
  const count=w.messages.length;f.trail.update({...valid,pet:{id:'garden_cherry_shiny'},unlocked:['garden_cherry_shiny']});assert.equal(w.messages.length,count);
  f.trail.update({...valid,pet:{id:'garden_cherry'},unlocked:['garden_cherry']});assert.equal(w.dead,true);assert.equal(f.timers.size,0);
  f.trail.destroy();
});

test('native menu-bar constraints do not shift the pointer trail on either monitor',()=>{
  const f=fixture(25);f.trail.update(valid);const w=f.windows[0];w.webContents.emit('did-finish-load');
  assert.deepEqual(w.messages.at(-1)[1],{x:1870,y:55,reset:true,kind:'apple'});
  f.move({x:120,y:130});assert.deepEqual(w.messages.at(-1)[1],{x:120,y:105,reset:true,kind:'apple'});
  f.move({x:125,y:135});assert.deepEqual(w.messages.at(-1)[1],{x:125,y:110,reset:false,kind:'apple'});
  f.trail.destroy();
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

test('idle polling drops to 20 Hz without display work or IPC and resumes 60 Hz within 50 ms of movement',()=>{
  const f=fixture();f.trail.update(valid);const w=f.windows[0];w.webContents.emit('did-finish-load');
  const count=w.messages.length,queries=f.displayQueries;
  assert.equal(f.interval,1000/60);
  f.advance(499);assert.equal(f.interval,1000/60);
  f.advance(20);assert.equal(f.interval,50);assert.equal(f.timers.size,1);
  f.advance(1000);assert.equal(w.messages.length,count);assert.equal(f.displayQueries,queries);
  f.setPoint({x:40,y:60});f.advance(50);
  assert.equal(w.messages.length,count+1);assert.equal(f.displayQueries,queries+1);assert.equal(f.interval,1000/60);
  assert.deepEqual(w.messages.at(-1)[1],{x:40,y:60,reset:true,kind:'apple'});
  f.setPoint({x:45,y:65});f.advance(1000/60);
  assert.equal(w.messages.length,count+2);assert.equal(f.maxTimers,1);
  f.trail.destroy();assert.equal(f.timers.size,0);f.advance(1000);assert.equal(w.messages.length,count+2);
});

test('idle timers survive companion changes and release on lock, reduced motion, renderer exit and disposal',()=>{
  const f=fixture();f.trail.update(valid);const w=f.windows[0];w.webContents.emit('did-finish-load');f.advance(550);
  assert.equal(f.interval,50);
  f.trail.update({...valid,pet:{id:'garden_cherry_shiny'},unlocked:['garden_cherry_shiny']});
  assert.equal(f.interval,1000/60);assert.equal(f.windows.length,1);
  assert.deepEqual(w.messages.at(-1)[1],{x:1870,y:80,reset:true,kind:'cherry'});
  f.advance(550);f.powerMonitor.emit('lock-screen');assert.equal(f.timers.size,0);
  f.powerMonitor.emit('unlock-screen');assert.equal(f.interval,1000/60);
  f.advance(550);f.ipcMain.emit('tracer-garden-trail-motion',{sender:w.webContents,senderFrame:w.webContents.mainFrame},false);assert.equal(f.timers.size,0);
  f.ipcMain.emit('tracer-garden-trail-motion',{sender:w.webContents,senderFrame:w.webContents.mainFrame},true);assert.equal(f.interval,1000/60);
  f.advance(550);w.webContents.emit('render-process-gone');assert.equal(f.timers.size,0);assert.equal(w.dead,true);
  f.trail.destroy();assert.equal(f.maxTimers,1);assert.equal(f.powerMonitor.eventNames().length,0);
});
