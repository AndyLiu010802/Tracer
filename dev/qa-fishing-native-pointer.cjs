'use strict';
// Launch with Electron. Real transparent windows/preloads/menus, isolated stock
// and profile. Companion automation can inspect globalThis.pointerQA via CDP.
const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(root, '.cache/native-pointer-'));
app.setPath('userData', path.join(output, 'profile'));
app.whenReady().then(async () => {
  const server = http.createServer(async (request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    if (name === '/__qa') { const q=globalThis.pointerQA; response.setHeader('Content-Type','application/json'); response.end(JSON.stringify(q&&{output:q.output,menus:q.menus.map(m=>m.labels),modes:q.modes,regions:q.regions,windows:q.windows?.map(w=>({id:w.id,title:w.getTitle(),bounds:w.getBounds()}))})); return; }
    if (name === '/__qa/quit') { response.end('closed'); setImmediate(()=>app.quit()); return; }
    if (name === '/__qa/check') {
      const q=globalThis.pointerQA, checks=[];
      for(const win of q.windows){
        const state=await win.webContents.executeJavaScript(`({hidden:document.hidden,paused:document.body.dataset.paused,rod:document.querySelector('#desktop-fishing')?.dataset.rodVisible,tank:!!document.querySelector('.fishing-aquarium-tank'),visibility:document.visibilityState})`);
        const png=await win.webContents.capturePage();fs.writeFileSync(path.join(output,'window-'+win.id+'.png'),png.toPNG());
        checks.push({id:win.id,visible:win.isVisible(),state});
      }
      response.end(JSON.stringify(checks));return;
    }
    if (name === '/__qa/recover') {
      const q=globalThis.pointerQA, checks=[];q.closeMenus();
      for(const win of q.windows){
        const bounds=win.getBounds(),cursor=screen.getCursorScreenPoint();
        const centerX=win.getBounds().width===210?.5:.65;
        // A stationary real native cursor, no renderer-dispatched mousemove.
        win.setPosition(Math.round(cursor.x-bounds.width*centerX),Math.round(cursor.y-bounds.height*.6));win.showInactive();
        await new Promise(resolve=>setTimeout(resolve,150));
        const inside=q.modes.filter(m=>m.id===win.id).at(-1)?.ignore;
        win.setPosition(cursor.x+60,cursor.y+60);
        await new Promise(resolve=>setTimeout(resolve,150));
        const outside=q.modes.filter(m=>m.id===win.id).at(-1)?.ignore;
        win.setBounds(bounds);checks.push({id:win.id,inside,outside,passed:inside===false&&outside===true});
      }
      fs.writeFileSync(path.join(output,'native-recovery.json'),JSON.stringify(checks,null,2));response.end(JSON.stringify(checks));return;
    }
    if (name === '/') { response.end('<title>Pointer QA controller</title>'); return; }
    const file = path.resolve(root, 'skins/tracer', '.' + name), base = path.join(root, 'skins/tracer') + path.sep;
    if (!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    const ext = path.extname(file); response.setHeader('Content-Type', ({'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.png':'image/png'})[ext] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  console.log('POINTER_QA_ORIGIN='+origin);
  const main = new BrowserWindow({ show: false }); await main.loadURL(origin + '/');
  const area = screen.getPrimaryDisplay().workArea;
  for (const [name, offset] of [['fishing', 40], ['fishing-aquarium', 410]]) fs.writeFileSync(path.join(output, name + '-window.json'), JSON.stringify({ x: area.x + offset, y: area.y + 80, scale: 1 }));
  const qa = globalThis.pointerQA = { output, menus: [], modes: [], regions: [], controllers: [], main };
  const original = BrowserWindow.prototype.setIgnoreMouseEvents;
  BrowserWindow.prototype.setIgnoreMouseEvents = function(ignore, options) { qa.modes.push({id:this.id,ignore}); return original.call(this,ignore,options); };
  const nativeMenu = { buildFromTemplate(items) { const menu=Menu.buildFromTemplate(items); qa.menus.push({labels:items.map(i=>i.label).filter(Boolean),menu}); return menu; } };
  const deps = { BrowserWindow, ipcMain, screen, Menu:nativeMenu }, event = {sender:main.webContents,senderFrame:main.webContents.mainFrame};
  for (const name of ['fishing', 'fishing-aquarium']) ipcMain.on('tracer-'+name+'-command', (_e,m) => { if(m.type==='input-regions') qa.regions.push({name,value:m.value}); });
  const pond=require('../desktop/fishing').attachFishing(main,origin,output,()=>{},deps);
  const tank=require('../desktop/fishing-aquarium').attachFishingAquarium(main,origin,output,()=>{},deps);
  qa.controllers.push(pond,tank);
  const F=require('../public/fishing-model');
  ipcMain.emit('tracer-fishing-update', event, {accountScope:'qa',accountGeneration:0,language:'zh',session:{phase:'idle'},rod:F.catalog.rods.find(r=>r.id==='guandao'),desktopPond:{pond:{style:'meadow'},fish:[]}});
  ipcMain.emit('tracer-fishing-aquarium-update', event, {accountScope:'qa',accountGeneration:0,language:'zh',showcase:{fish:[],selection:{decorationIds:[]},stats:{}}});
  pond.show();tank.show();
  const windows=BrowserWindow.getAllWindows().filter(w=>w!==main);
  for(const win of windows){win.on('page-title-updated',e=>e.preventDefault());win.setSkipTaskbar(false);win.setTitle(win.getBounds().width===210?'QA Aquarium - native pointer':'QA Pond - native pointer');}
  qa.windows=windows;
  qa.closeMenus=()=>qa.menus.forEach(entry=>entry.menu.closePopup());
  app.on('before-quit',()=>{qa.closeMenus();pond.destroy();tank.destroy();server.close();});
  setTimeout(()=>app.quit(),600000).unref();
});
