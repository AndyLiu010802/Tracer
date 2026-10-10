'use strict';
// Isolated hidden Electron diagnostic. Does not load the app or player saves.
const {app,BrowserWindow}=require('electron'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');app.setPath('userData',path.join(root,'.cache/fishing-gpu-audit'));app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:320,height:200,webPreferences:{sandbox:true,contextIsolation:true}});
 await win.loadURL('data:text/html,<canvas id="gl"></canvas>');
 const renderer=await win.webContents.executeJavaScript(`(()=>{const gl=document.querySelector('canvas').getContext('webgl');if(!gl)return{available:false};const e=gl.getExtension('WEBGL_debug_renderer_info');return{available:true,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:e?gl.getParameter(e.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};})()`);
 const result={electron:process.versions.electron,features:app.getGPUFeatureStatus(),info:await app.getGPUInfo('basic'),renderer};fs.mkdirSync(path.join(root,'output/fishing-orbit-v2'),{recursive:true});fs.writeFileSync(path.join(root,'output/fishing-orbit-v2/gpu-electron.json'),JSON.stringify(result,null,2));win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
