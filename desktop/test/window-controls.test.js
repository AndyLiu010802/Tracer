'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {attachWindowControls}=require('../window-controls');
function fixture(platform,fullscreen){
  const win=new EventEmitter(),ipcMain=new EventEmitter(),wc=new EventEmitter(),calls=[];
  Object.assign(wc,{mainFrame:{url:'http://localhost/',isDestroyed:()=>false},isDestroyed:()=>false,send(){}});
  Object.assign(win,{webContents:wc,isDestroyed:()=>!!win.dead,isFullScreen:()=>fullscreen,isMaximized:()=>false,isVisible:()=>true,isMinimized:()=>false,setFullScreen:value=>calls.push(['fullscreen',value]),minimize:()=>calls.push(['minimize'])});
  attachWindowControls(win,'http://localhost',[],{ipcMain,platform});
  return {win,calls,command:()=>ipcMain.emit('tracer-window-action',{sender:wc,senderFrame:wc.mainFrame},'minimize')};
}
test('Mac fullscreen minimize waits for the native transition and coalesces repeated clicks',()=>{
  const f=fixture('darwin',true);f.command();f.command();assert.deepEqual(f.calls,[['fullscreen',false]]);
  f.win.emit('leave-full-screen');assert.deepEqual(f.calls,[['fullscreen',false],['minimize']]);
  f.win.emit('leave-full-screen');assert.equal(f.calls.length,2);f.win.dead=true;f.win.emit('closed');
});
test('ordinary windows minimize immediately, and closed Mac windows discard pending actions',()=>{
  for(const platform of ['win32','darwin']){const f=fixture(platform,false);f.command();assert.deepEqual(f.calls,[['minimize']]);f.win.dead=true;f.win.emit('closed');}
  const f=fixture('darwin',true);f.command();f.win.dead=true;f.win.emit('closed');f.win.emit('leave-full-screen');assert.deepEqual(f.calls,[['fullscreen',false]]);
});
