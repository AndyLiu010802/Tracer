'use strict';
// Native windows and production IPC, with synthetic receipts in an isolated profile.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const {_electron}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const Trails=require('../skins/tracer/garden-trails');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'.cache/garden-trail-'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(read,check=Boolean){for(let i=0;i<150;i++){const value=await read();if(check(value))return value;await delay(100);}throw new Error('Native state did not settle');}
(async()=>{
  const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const origin='http://127.0.0.1:'+port+'/';
  const env={...process.env,TRACER_USER_DATA_DIR:profile,TRACER_DISABLE_INPUT_HOOK:'1',DOCS_PORTAL_PORT:String(port),DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_DATA_DIR:path.join(profile,'data'),DOCS_PORTAL_STATE_FILE:path.join(profile,'bookmarks.json')};delete env.ELECTRON_RUN_AS_NODE;
  console.log('Launch isolated native test: '+profile);
  const executable=process.argv[2],app=await _electron.launch({executablePath:executable?path.resolve(executable):require('electron'),args:executable?[]:[root],env,timeout:60000}),errors=[];
  const overlay=()=>app.context().pages().find(p=>p.url().endsWith('/garden-trail.html'));
  const count=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().endsWith('/garden-trail.html')).length);
  try{
    const page=await until(()=>app.context().pages().find(p=>p.url().startsWith(origin)));
    page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
    await page.selectOption('#language-select','zh');
    await page.evaluate(()=>{
      const now=Date.now();TaskGarden.importLegacy(Tracer.store.data,TracerGardenTrails.catalog.map(item=>({projectId:'trail-'+item.id,plantKind:item.id,maturedAt:now-1000,ticket:0,harvestedAt:now})));
      Tracer.touch();Tracer.saveNow();
    });
    await page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight);
    await page.evaluate(()=>{Tracer.pet.refresh(true);Tracer.pet.action('select','garden_cherry_shiny');Tracer.pet.open();});
    const toggle=page.locator('.pet-trail-toggle');await toggle.waitFor();assert.equal(await toggle.isEnabled(),true);
    const select=async id=>{
      await page.locator('.pet-tabs [data-tab="collection"]').click();
      await page.locator('.pet-unlock[data-value="'+id+'"]').click();
      await page.locator('.pet-tabs [data-tab="care"]').click();
    };
    for(const item of Trails.catalog){
      await select('garden_'+item.id+'_shiny');
      assert.equal(await page.locator('.pet-trail-name').innerText(),item.name[0]);
      assert.equal(await toggle.getAttribute('aria-pressed'),'false');
      await until(count,n=>n===0);await toggle.click();
      const trail=await until(overlay);trail.on('pageerror',e=>errors.push(e.message));
      await trail.waitForFunction(kind=>document.querySelector('canvas')?.dataset.trailKind===kind,item.id);
      assert.equal(await toggle.getAttribute('aria-pressed'),'true');
      assert.equal(await count(),1);
      // Real native IPC -> sandboxed preload -> production canvas, with known coordinates.
      await app.evaluate(({BrowserWindow},kind)=>{
        const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/garden-trail.html'));
        w.webContents.send('tracer-garden-trail-frame',{x:120,y:120,reset:true,kind});
        w.webContents.send('tracer-garden-trail-frame',{x:320,y:180,reset:false,kind});
      },item.id);
      await trail.waitForFunction(()=>{const c=document.querySelector('canvas'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<a.length;i+=4)if(a[i])return true;return false;});
      console.log('PASS native '+item.id+' / '+item.name[0]);
    }
    const trail=overlay();
    const properties=await app.evaluate(({BrowserWindow,screen})=>{
      const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/garden-trail.html')),p=w.webContents.getLastWebPreferences();
      return {id:w.id,focusable:w.isFocusable(),top:w.isAlwaysOnTop(),bounds:w.getBounds(),display:screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds,node:p.nodeIntegration,sandbox:p.sandbox,isolated:p.contextIsolation};
    });
    assert.equal(properties.focusable,false);assert.equal(properties.top,true);assert.equal(properties.node,false);assert.equal(properties.sandbox,true);assert.equal(properties.isolated,true);assert.deepEqual(properties.bounds,properties.display);
    // Both are already enabled: switch species without creating a second overlay.
    await select('garden_cherry_shiny');await trail.waitForFunction(()=>document.querySelector('canvas').dataset.trailKind==='cherry');
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/garden-trail.html')).id),properties.id);
    assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    await toggle.click();await until(count,n=>n===0);
    await select('garden_crystal_tree_shiny');const crystal=await until(overlay);await crystal.waitForFunction(()=>!!window.GardenTrail);
    assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    await select('garden_cherry_shiny');await until(count,n=>n===0);assert.equal(await toggle.getAttribute('aria-pressed'),'false');
    await toggle.click();const restored=await until(overlay);await restored.waitForFunction(()=>!!window.GardenTrail);
    await restored.emulateMedia({reducedMotion:'reduce'});
    const visible=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/garden-trail.html')).isVisible());
    await until(visible,v=>v===false);await restored.emulateMedia({reducedMotion:'no-preference'});await until(visible);
    console.log('PASS independent switches, single overlay, click-through window properties and reduced motion');
    await page.locator('.pet-trail-card').scrollIntoViewIfNeeded();
    await page.locator('.pet-dialog').screenshot({path:path.join(root,'docs/shiny-trail-controls.png')});
    await select('sprout');assert.equal(await page.locator('.pet-trail-card').isHidden(),true);await until(count,n=>n===0);
    await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);await page.evaluate(()=>Tracer.pet.open());
    await select('garden_cherry_shiny');await until(overlay);assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    await page.locator('.pet-launch').click();
    const companion=await until(()=>app.context().pages().find(p=>p.url().startsWith(origin+'pet.html')));
    companion.on('pageerror',e=>errors.push(e.message));
    await companion.locator('.pet-character').hover();
    await companion.locator('[data-quick-act="expand"]').click();
    await companion.locator('.pet-trail-toggle').scrollIntoViewIfNeeded();
    await companion.waitForFunction(()=>document.querySelector('.pet-trail-toggle')?.getAttribute('aria-pressed')==='true');
    assert.equal(await companion.locator('.pet-trail-name').innerText(),'樱吹雪');
    const layout=await companion.evaluate(()=>{const card=document.querySelector('.pet-trail-card'),panel=document.querySelector('.pet-panel');return {card:card.getBoundingClientRect().width,panel:panel.clientWidth,overflow:panel.scrollWidth-panel.clientWidth};});
    assert.ok(layout.card<=layout.panel&&layout.overflow<=1,'standalone companion trail card fits its narrow panel');
    await companion.screenshot({path:path.join(profile,'standalone-trail-controls.png')});
    // The native companion must still change preferences when the workspace is hidden.
    await app.evaluate(({BrowserWindow},origin)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===origin).hide(),origin);
    await companion.locator('.pet-trail-toggle').click();await until(count,n=>n===0);
    await companion.waitForFunction(()=>document.querySelector('.pet-trail-toggle').getAttribute('aria-pressed')==='false');
    const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem(TracerGardenTrails.key)));
    assert.equal(prefs.enabled.garden_cherry_shiny,false);assert.equal(prefs.enabled.garden_crystal_tree_shiny,true);
    assert.deepEqual(errors,[]);
    console.log('PASS ordinary companions hide trail controls; reload preserves preferences; standalone narrow panel toggles while workspace is hidden; no renderer errors');
  }catch(error){
    for(const [i,p]of app.context().pages().entries()){try{await p.screenshot({path:path.join(profile,'failure-'+i+'.png')});}catch{}}
    throw error;
  }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
