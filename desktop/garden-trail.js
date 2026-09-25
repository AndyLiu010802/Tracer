'use strict';
const path=require('node:path');
const {kindForPet}=require('../skins/tracer/garden-trails');
function eligible(snapshot){return !!(snapshot?.trailEnabled===true&&kindForPet(snapshot.pet)&&Array.isArray(snapshot.unlocked)&&snapshot.unlocked.includes(snapshot.pet.id));}
function localPoint(point,bounds){return {x:point.x-bounds.x,y:point.y-bounds.y};}
function attachGardenTrail(main,dependencies=require('electron')){
  const {BrowserWindow,screen,ipcMain,powerMonitor}=dependencies;
  const clock=dependencies.clock||{setInterval,clearInterval};
  const now=typeof clock.now==='function'?()=>clock.now():()=>performance.now();
  const activeInterval=1000/60,idleInterval=50,idleAfter=500;
  let overlay=null,timer=null,sampleInterval=null,lastMovedAt=0,enabled=false,suspended=false,motion=true,ready=false,last=null,displayId=null,closed=false,kind=null;
  function stop(){if(timer!==null)clock.clearInterval(timer);timer=null;sampleInterval=null;last=null;lastMovedAt=0;}
  function setSamplingInterval(interval){
    if(timer!==null&&sampleInterval===interval)return;
    if(timer!==null)clock.clearInterval(timer);
    sampleInterval=interval;timer=clock.setInterval(sample,interval);
  }
  function sample(){
    if(!overlay||overlay.isDestroyed()||!ready)return;
    const point=screen.getCursorScreenPoint(),at=now();
    // Idle polling only checks the pointer; avoid display lookup and renderer IPC.
    if(last?.x===point.x&&last?.y===point.y){
      if(at-lastMovedAt>=idleAfter)setSamplingInterval(idleInterval);
      return;
    }
    lastMovedAt=at;
    if(timer!==null)setSamplingInterval(activeInterval);
    const display=screen.getDisplayNearestPoint(point),bounds=display.bounds;
    const reset=displayId!==display.id;displayId=display.id;
    if(reset)overlay.setBounds(bounds,false);
    // macOS may constrain the requested origin below its menu bar. Pointer
    // coordinates must use the actual native window, not the requested display.
    last=point;overlay.webContents.send('tracer-garden-trail-frame',{...localPoint(point,overlay.getBounds()),reset,kind});
  }
  function reconcile(){
    if(closed||!enabled){stop();if(overlay&&!overlay.isDestroyed())overlay.destroy();overlay=null;ready=false;return;}
    if(!overlay||overlay.isDestroyed()){
      const bounds=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds;
      const win=new BrowserWindow({...bounds,transparent:true,frame:false,focusable:false,resizable:false,movable:false,maximizable:false,minimizable:false,fullscreenable:false,hasShadow:false,alwaysOnTop:true,skipTaskbar:true,show:false,backgroundColor:'#00000000',title:'Tracer Companion Trail',
        webPreferences:{preload:path.join(__dirname,'garden-trail-preload.js'),contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
      overlay=win;ready=false;displayId=null;motion=true;
      win.setIgnoreMouseEvents(true,{forward:true});win.setAlwaysOnTop(true,'screen-saver');
      if(process.platform==='darwin')win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
      win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
      win.webContents.on('did-finish-load',()=>{if(overlay!==win||closed)return;ready=true;reconcile();});
      win.webContents.on('render-process-gone',()=>{if(overlay===win){stop();win.destroy();}});
      win.on('closed',()=>{if(overlay===win){stop();overlay=null;ready=false;}});
      win.loadFile(path.join(__dirname,'garden-trail.html')).catch(()=>{if(!win.isDestroyed())win.destroy();});
    }
    if(!ready)return;
    if(suspended||!motion){stop();overlay.hide();return;}
    overlay.showInactive();
    if(timer===null){sample();setSamplingInterval(activeInterval);}
  }
  function motionChanged(event,value){
    if(!overlay||overlay.isDestroyed()||event.sender!==overlay.webContents||event.senderFrame!==overlay.webContents.mainFrame||typeof value!=='boolean')return;
    motion=value;reconcile();
  }
  const pause=()=>{suspended=true;reconcile();},resume=()=>{suspended=false;reconcile();};
  ipcMain.on('tracer-garden-trail-motion',motionChanged);
  for(const event of ['suspend','lock-screen'])powerMonitor?.on(event,pause);
  for(const event of ['resume','unlock-screen'])powerMonitor?.on(event,resume);
  function destroy(){
    if(closed)return;closed=true;reconcile();ipcMain.removeListener('tracer-garden-trail-motion',motionChanged);
    for(const event of ['suspend','lock-screen'])powerMonitor?.removeListener(event,pause);
    for(const event of ['resume','unlock-screen'])powerMonitor?.removeListener(event,resume);
  }
  main.once('closed',destroy);
  return {update(snapshot){
    if(closed)return;const next=eligible(snapshot),nextKind=next?kindForPet(snapshot.pet):null,changed=nextKind!==kind;
    kind=nextKind;if(changed){last=null;displayId=null;}
    if(next===enabled&&overlay&&!overlay.isDestroyed()){if(changed&&timer!==null)sample();return;}
    enabled=next;reconcile();
  },destroy};
}
module.exports={eligible,localPoint,attachGardenTrail};
