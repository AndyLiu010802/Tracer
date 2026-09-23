'use strict';
// Native windows and production IPC, with synthetic receipts in an isolated profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'.cache/garden-trail-'));
const env={...process.env,TRACER_USER_DATA_DIR:profile,TRACER_DISABLE_INPUT_HOOK:'1',DOCS_PORTAL_PORT:'18187',DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_DATA_DIR:path.join(profile,'data'),DOCS_PORTAL_STATE_FILE:path.join(profile,'bookmarks.json')};
delete env.ELECTRON_RUN_AS_NODE;
(async()=>{
  console.log('Launch isolated native test: '+profile);
  const app=await _electron.launch({executablePath:require('electron'),args:[root],env,timeout:45000});
  try{
    let page;for(let i=0;i<100;i++){page=app.context().pages().find(p=>p.url().startsWith('http://127.0.0.1:18187/'));if(page)break;await new Promise(r=>setTimeout(r,100));}
    assert.ok(page);await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.evaluate(()=>{
      const now=Date.now();localStorage.setItem(TracerGardenHarvest.key,JSON.stringify({v:1,records:[{projectId:'trail-qa',plantKind:'cherry',maturedAt:now-1000,ticket:0,harvestedAt:now}]}));
      Tracer.pet.refresh();Tracer.pet.action('select','garden_cherry_shiny');Tracer.pet.open();
    });
    await page.locator('.pet-trail-toggle').waitFor();assert.equal(await page.locator('.pet-trail-toggle').isEnabled(),true);
    console.log('PASS native shiny companion and trail control');
    const [trail]=await Promise.all([app.waitForEvent('window'),page.locator('.pet-trail-toggle').click()]);
    trail.on('pageerror',e=>errors.push(e.message));await trail.waitForURL('**/garden-trail.html');await trail.waitForFunction(()=>!!window.GardenTrail);
    const properties=await app.evaluate(({BrowserWindow,screen})=>{
      const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/garden-trail.html')),p=w.webContents.getLastWebPreferences();
      return {focusable:w.isFocusable(),top:w.isAlwaysOnTop(),bounds:w.getBounds(),display:screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds,node:p.nodeIntegration,sandbox:p.sandbox,isolated:p.contextIsolation};
    });
    assert.equal(properties.focusable,false);assert.equal(properties.top,true);assert.equal(properties.node,false);assert.equal(properties.sandbox,true);assert.equal(properties.isolated,true);assert.deepEqual(properties.bounds,properties.display);
    // Synthetic coordinates test real IPC/preload/canvas rendering. Unit tests
    // separately cover native cursor polling, monitor switching and screen locks.
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/garden-trail.html'));w.webContents.send('tracer-garden-trail-frame',{x:120,y:120,reset:true});w.webContents.send('tracer-garden-trail-frame',{x:220,y:180,reset:false});});
    await trail.waitForFunction(()=>{const c=document.querySelector('canvas'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<a.length;i+=4)if(a[i])return true;return false;});
    console.log('PASS display-sized non-focusable overlay and real IPC/canvas particles');
    await trail.emulateMedia({reducedMotion:'reduce'});
    const visible=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/garden-trail.html')).isVisible());
    for(let i=0;i<40&&await visible();i++)await new Promise(r=>setTimeout(r,50));
    assert.equal(await visible(),false);
    await trail.emulateMedia({reducedMotion:'no-preference'});
    await Promise.all([trail.waitForEvent('close'),page.locator('.pet-trail-toggle').click()]);
    assert.equal(await page.evaluate(()=>localStorage.getItem('tracer.garden.trail.v1')),'false');assert.deepEqual(errors,[]);
    console.log('PASS reduced motion and toggle cleanup');
  }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
