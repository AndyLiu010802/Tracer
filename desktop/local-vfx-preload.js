'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function ready(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 if(value.ok===true&&Object.keys(value).sort().join(',')==='durationMs,effect,ok,renderer'&&value.effect==='haunt'&&value.renderer==='haunt-reference-texture-2'&&value.durationMs===7000){
  ipcRenderer.send('tracer-local-vfx-ready',{ok:true,effect:'haunt',renderer:value.renderer,durationMs:7000});
 }else if(value.ok===false&&Object.keys(value).sort().join(',')==='error,ok'&&value.error==='local-vfx-assets-failed')ipcRenderer.send('tracer-local-vfx-ready',{ok:false,error:value.error});
}
if(process.isMainFrame)contextBridge.exposeInMainWorld('LocalVfxPlayer',Object.freeze({ready,
 done:id=>{if(typeof id==='string'&&UUID.test(id))ipcRenderer.send('tracer-local-vfx-done',id);},
 onStart:callback=>{
  if(typeof callback!=='function')return;let subscribed=true;
  const listener=(_event,value)=>{if(subscribed)callback(value);};ipcRenderer.on('tracer-local-vfx-start',listener);
  return()=>{if(!subscribed)return;subscribed=false;ipcRenderer.removeListener('tracer-local-vfx-start',listener);};
 }}));
