'use strict';
const {contextBridge,ipcRenderer}=require('electron');
if(process.isMainFrame)contextBridge.exposeInMainWorld('GardenTrail',{
  onFrame(callback){if(typeof callback!=='function')return;ipcRenderer.on('tracer-garden-trail-frame',(_event,value)=>{if(value&&Number.isFinite(value.x)&&Number.isFinite(value.y))callback({x:value.x,y:value.y,reset:value.reset===true,kind:typeof value.kind==='string'&&/^[a-z_]{1,32}$/.test(value.kind)?value.kind:undefined});});},
  motion(value){if(typeof value==='boolean')ipcRenderer.send('tracer-garden-trail-motion',value);}
});
