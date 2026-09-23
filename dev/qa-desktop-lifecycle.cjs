'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const {_electron}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(root,'.cache'),{recursive:true});
const profile=fs.mkdtempSync(path.join(root,'.cache/lifecycle-'));
const stage=message=>console.log('[lifecycle QA] '+new Date().toISOString()+' '+message);
(async()=>{
  const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  const env={...process.env,TRACER_USER_DATA_DIR:profile,TRACER_DISABLE_INPUT_HOOK:'1',DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_PORT:String(port),DOCS_PORTAL_DATA_DIR:path.join(profile,'data'),DOCS_PORTAL_STATE_FILE:path.join(profile,'state.json')};delete env.ELECTRON_RUN_AS_NODE;
  stage('launch isolated packaged application');
  const executable=process.argv[2],app=await _electron.launch({executablePath:executable?path.resolve(executable):require('electron'),args:executable?[]:[root],env,timeout:60000}),errors=[];
  app.process().stderr.on('data',b=>fs.appendFileSync(path.join(profile,'electron.log'),b));
  try{
    const origin='http://127.0.0.1:'+port;
    await app.context().route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    let page;for(let i=0;i<120;i++){page=app.context().pages().find(p=>p.url()===origin+'/');if(page)break;await new Promise(r=>setTimeout(r,100));}assert.ok(page,'main page starts');page.on('pageerror',e=>errors.push(e.message));
    stage('wait for main workspace');
    await page.waitForFunction(()=>window.Tracer?.store?.base&&Tracer.focus&&Tracer.pet&&window.TracerWallpaperMotion);
    await page.waitForFunction(()=>document.tracerHidden===false);
    stage('save note and verify native edit shortcut');
    const noteId=await page.evaluate(()=>{const n=TracerModel.addNote(Tracer.store.data,{title:'Lifecycle note',body:'Saved before hiding'});Tracer.touch();Tracer.saveNow();return n.id;});
    await page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight);await page.evaluate(()=>Tracer.show('notes'));await page.fill('#note-body','Native note remains editable');await page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight);
    await page.keyboard.press(process.platform==='darwin'?'Meta+e':'Control+e');assert.equal(await page.locator('#note-body').count(),0,'native note shortcut previews');await page.keyboard.press(process.platform==='darwin'?'Meta+e':'Control+e');assert.equal(await page.inputValue('#note-body'),'Native note remains editable');
    stage('start visible wallpaper and material rendering');
    await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:400px;top:250px;width:300px;height:200px;z-index:13000';document.body.append(canvas);window.lifecycleCanvas=canvas;window.lifecycleDraws=0;
      const fill=CanvasRenderingContext2D.prototype.fillRect;CanvasRenderingContext2D.prototype.fillRect=function(...args){if(this.canvas===canvas)window.lifecycleDraws++;return fill.apply(this,args);};
      window.lifecyclePlayer=TracerWallpaperMotion.player(canvas);lifecyclePlayer.set({id:'lifecycle',effect:'rain',colors:['#08182b','#53d2b5','#9472dc']});
      const host=document.createElement('div');host.style.cssText='position:fixed;left:720px;top:250px;width:300px;height:200px;z-index:13000';document.body.append(host);window.lifecycleMaterial=TracerMaterialOptics.mount(host,{material:'glass',source:()=>canvas});
    });
    await page.waitForFunction(()=>window.lifecycleDraws>6);
    await page.evaluate(()=>{const f=TracerFocus.fresh();f.duration=f.remaining=2000;TracerFocus.start(f,Date.now(),'lifecycle-focus');localStorage.setItem('tracer.focus.v1',JSON.stringify(f));dispatchEvent(new StorageEvent('storage',{key:'tracer.focus.v1'}));});
    stage('minimize and verify paused graphics with live focus timer');
    await page.locator('#window-minimize').click();
    await page.waitForFunction(()=>document.tracerHidden===true);await page.waitForTimeout(200);
    const paused=await page.evaluate(()=>({draws:lifecycleDraws,material:lifecycleMaterial.stats().draws}));await page.waitForTimeout(2600);
    assert.deepEqual(await page.evaluate(()=>({draws:lifecycleDraws,material:lifecycleMaterial.stats().draws})),paused,'hidden wallpaper and material stop rendering');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tracer.focus.v1')).completed),true,'background focus still settles');
    stage('restore through Dock or tray lifecycle and resume graphics');
    await app.evaluate(({app})=>app.emit(process.platform==='darwin'?'activate':'second-instance'));await page.waitForFunction(()=>!document.tracerHidden);await page.waitForFunction(n=>lifecycleDraws>n,paused.draws);
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/')).close());await page.waitForFunction(()=>document.tracerHidden);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/')).isDestroyed()),false,'close preserves background window');
    await app.evaluate(({app})=>app.emit(process.platform==='darwin'?'activate':'second-instance'));await page.waitForFunction(()=>!document.tracerHidden);await page.evaluate(()=>{lifecyclePlayer.destroy();lifecycleMaterial.destroy();});
    stage('reload saved note and inspect native menu');
    await page.reload();await page.waitForFunction(()=>window.Tracer?.store?.base&&Tracer.focus);assert.equal(await page.evaluate(id=>Tracer.store.base.notes.find(n=>n.id===id).body,noteId),'Native note remains editable','saved note survives reload');
    if(process.platform==='darwin')assert.ok(await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.some(i=>String(i.role).toLowerCase()==='editmenu')),'Mac native edit menu');
    assert.deepEqual(errors,[]);console.log('PASS '+process.platform+'/'+process.arch+': startup, note save/shortcut/reload, minimize pauses wallpaper/material, background focus completion, tray/Dock restore. '+profile);
  }catch(error){console.error('Lifecycle assertion failed:',error);throw error;}finally{await require('./close-qa-electron.cjs')(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
