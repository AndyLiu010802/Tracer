'use strict';
// Smoke the actual packaged app in a fresh profile using local, synthetic artwork.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),net=require('node:net'),crypto=require('node:crypto');
const {chromium,_electron}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const {fixtures:denseFixtures}=require('./qa-pet-dense-animation.cjs');
const {fixtures:legacyFixtures}=require('./qa-pet-animation.cjs');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const executable=path.resolve(process.argv[2]||path.join(root,'dist',version+'-final','win-unpacked/Tracer.exe'));
fs.mkdirSync(path.join(root,'.cache'),{recursive:true});
const profile=fs.mkdtempSync(path.join(root,'.cache/pet-dense-release-')),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
let stage='setup',failureLogged=false,nativeApplication;
function checkpoint(label) { stage=label;console.log('[native QA] '+new Date().toISOString()+' '+label); }
async function deadline(promise,ms,message) {
  let timer;
  try {return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(typeof message==='function'?message():message)),ms);})]);}
  finally {clearTimeout(timer);}
}

function packageFile(name,version,sheets) {
  const pack={format:'tracer-companion',version,companion:{name,kind:'humanoid',personality:'A locally drawn release-test companion.'},artwork:{layout:'atlas-4x4',...(version===2?{animationVersion:2}:{}),images:sheets.map(bytes=>({sha256:hash(bytes),data:bytes.toString('base64')}))}};
  const file=path.join(profile,'synthetic-v'+version+'.tracer-pet');fs.writeFileSync(file,JSON.stringify(pack));return {file,pack};
}

async function importPack(page,file) {
  checkpoint('import '+path.basename(file));
  // Native playback checks leave the companion in front. The main window
  // intentionally skips view updates while hidden, so restore it before UI work.
  await restoreWindow(page);
  if(!await page.locator('[data-tab="collection"]').count())await page.click('#pet-open');
  await page.click('[data-tab="collection"]');await page.click('[data-act="open-import"]');
  await page.locator('#pet-package-file').setInputFiles(file);await page.locator('.pet-transfer-submit:not([disabled])').waitFor();
  await page.click('.pet-transfer-submit');await page.locator('.pet-character .pet-animated-sprite').waitFor();
  return page.evaluate(()=>{const state=Tracer.pet.read();return state.customs.find(pet=>pet.id===state.selected);});
}

async function restoreWindow(page) {
  // Activating a CDP target alone does not restore a minimized Electron window.
  // Control only this QA process's matching native window, then wait for its IPC.
  await nativeApplication.evaluate(({BrowserWindow},url)=>{
    const win=BrowserWindow.getAllWindows().find(win=>win.webContents.getURL()===url);
    if(!win)throw new Error('QA native window is unavailable: '+url);
    // A fullscreen Windows app can minimize again when another native window
    // takes focus. Keep these playback checks in a real normal desktop window.
    if(win.isFullScreen())win.setFullScreen(false);
    if(win.isMinimized())win.restore();
    win.show();win.focus();
  },page.url());
  await page.bringToFront();
  await page.evaluate(()=>window.TracerWindow?.send('state'));
  await page.waitForFunction(()=>document.visibilityState==='visible'&&!document.tracerHidden);
}

async function cycle(page,selector,action,count,label) {
  checkpoint(label);
  await restoreWindow(page);
  await page.waitForFunction(({selector,action})=>{
    const el=document.querySelector(selector);return el?.dataset.action===action&&el.dataset.playback==='playing'&&/^\d+$/.test(el.dataset.frame||'')&&(!el.dataset.motionClip||el.dataset.motionClip===action);
  },{selector,action}).catch(async error=>{
    console.error('Animation wait state:',await page.evaluate(selector=>({hidden:document.hidden,section:window.Tracer?.currentSec(),matching:[...document.querySelectorAll(selector)].map(el=>({data:{...el.dataset},rect:el.getBoundingClientRect().toJSON()})),home:document.querySelector('.garden-home')?.dataset.petAction}),selector));
    await page.screenshot({path:path.join(profile,'animation-wait-failure.png')});throw error;
  });
  const result=await page.evaluate(({selector,action,count})=>new Promise((resolve,reject)=>{
    let element=document.querySelector(selector);const frames=new Map();
    const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Timed out waiting for '+count+' '+action+' frames: '+[...frames.keys()].join(',')+'; state='+JSON.stringify({hidden:document.hidden,nativeHidden:document.tracerHidden,data:element?.dataset,connected:element?.isConnected})));},30000);
    const collect=()=>{
      const current=document.querySelector(selector);if(current!==element){element=current;frames.clear();}
      if(!element)return;
      if(element.dataset.action!==action)return;
      // The illustrated atlas reports playback before its first sheet finishes
      // decoding. An absent frame is not a rendered pose and must not satisfy
      // the expected frame count before the last real frame appears.
      if(!/^\d+$/.test(element.dataset.frame||''))return;
      const frame=Number(element.dataset.frame),sheet=element.querySelector('.pet-animation-sheet');
      if(!Number.isInteger(frame)||frame<0||frame>=count)return;
      if(sheet&&(!sheet.complete||!sheet.naturalWidth))return;
      frames.set(frame,sheet?sheet.style.transform:element.innerHTML);
      if(frames.size===count){clearTimeout(timer);observer.disconnect();resolve({frames:[...frames.keys()].sort((a,b)=>a-b),poses:new Set(frames.values()).size});}
    };
    const observer=new MutationObserver(collect);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-frame','data-action']});collect();
  }),{selector,action,count});
  assert.deepEqual(result.frames,Array.from({length:count},(_,i)=>i),label+' visits every frame');
  assert.equal(result.poses,count,label+' supplies a different pose/crop for every frame');
  console.log('PASS '+label);
}

(async()=>{
  checkpoint('validate package and reserve isolated service port');
  assert.ok(fs.existsSync(executable),'packaged executable exists: '+executable);
  const resources=process.platform==='darwin'?path.resolve(path.dirname(executable),'../Resources'):path.join(path.dirname(executable),'resources');
  const manifest=JSON.parse(require('@electron/asar').extractFile(path.join(resources,'app.asar'),'package.json').toString('utf8'));
  assert.equal(manifest.version,version,'the launched application package matches the release version');
  const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  const env={...process.env,TRACER_USER_DATA_DIR:profile,TRACER_DISABLE_INPUT_HOOK:'1',DOCS_PORTAL_PORT:String(port),DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_DATA_DIR:path.join(profile,'data'),DOCS_PORTAL_STATE_FILE:path.join(profile,'bookmarks.json')};delete env.ELECTRON_RUN_AS_NODE;
  nativeApplication=await _electron.launch({executablePath:executable,args:['--disable-gpu','--in-process-gpu'],env,timeout:60000});
  const child=nativeApplication.process();
  let browser,log='',launchError;child.stdout.on('data',bytes=>log+=bytes);child.stderr.on('data',bytes=>log+=bytes);child.on('error',error=>{launchError=error;});
  const verify=async()=>{
    checkpoint('wait for packaged Electron and DevTools endpoint');
    const active=path.join(profile,'DevToolsActivePort');
    for(let i=0;i<120&&!fs.existsSync(active)&&child.exitCode===null&&!launchError;i++)await sleep(250);
    assert.ok(fs.existsSync(active),'packaged app starts: '+(launchError?.message||log.slice(-1500)));
    checkpoint('connect to packaged browser over CDP');
    browser=await chromium.connectOverCDP('http://127.0.0.1:'+fs.readFileSync(active,'utf8').split(/\r?\n/)[0],{timeout:15000});
    const context=browser.contexts()[0],origin='http://127.0.0.1:'+port,errors=[];let page,aiWrites=0,mockedChats=0,allowWorkChat=false;
    const workProposal={type:'tasks',project:null,tasks:[{title:'Packaged native companion task',notes:'Local synthetic release QA; no AI service was contacted.',due:null,scheduled:null,priority:'medium',estimate:null,checklist:['Confirm native-to-main persistence']}]};
    await context.route('**/api/ai/**',route=>{
      const request=route.request();
      if(allowWorkChat&&request.method()==='POST'&&/\/(codex|personal)-chat$/.test(new URL(request.url()).pathname)&&request.frame().url().endsWith('/pet.html')){
        mockedChats++;const body=request.postDataJSON();assert.match(body.today,/^\d{4}-\d{2}-\d{2}$/);assert.equal('workspace' in body,false);
        return route.fulfill({json:{reply:'Review this task, then confirm to create it.',proposal:workProposal}});
      }
      if(request.method()!=='GET')aiWrites++;return route.fulfill({status:503,json:{error:'release-test-no-ai'}});
    });
    context.on('page',target=>target.on('pageerror',error=>errors.push(error.message)));
    for(let i=0;i<120;i++){page=context.pages().find(target=>target.url()===origin+'/');if(page)break;await sleep(250);}
    assert.ok(page,'packaged workspace opens');page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
    checkpoint('initialize clean workspace and synthetic fixtures');
    await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);await page.selectOption('#language-select','en');
    assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),0,'test profile has no private tasks');
    assert.equal(await page.evaluate(()=>Tracer.pet.read().customs.length),0,'test profile has no existing user companions');
    const dense=packageFile('Dense Release Fixture',2,(await denseFixtures(page)).sheets),legacy=packageFile('Legacy Release Fixture',1,(await legacyFixtures(page)).sheets);
    await page.click('#pet-open');assert.equal(await page.locator('.pet-name').innerText(),'Sprout');
    // Built-in and illustrated companions now play 32 poses. Imported v2
    // custom packs below still retain their authored 16-frame playback/files.
    assert.equal(await page.evaluate(()=>TracerPetBuiltinAnimation.frames),32);
    await page.click('[data-act="focus-toggle"]');
    await cycle(page,'.pet-character .pet-builtin-sprite','focus',32,'packaged main-window built-in thirty-two-frame cycle');
    checkpoint('capture main built-in and open native companion');
    await page.screenshot({path:path.join(profile,'main-builtin.png')});
    await page.click('[data-act="desktop"]');let pet;
    for(let i=0;i<120;i++){pet=context.pages().find(target=>target.url().endsWith('/pet.html'));if(pet)break;await sleep(150);}
    assert.ok(pet,'actual native desktop companion window opens');pet.setDefaultTimeout(20000);
    await cycle(pet,'.pet-character .pet-builtin-sprite','focus',32,'native desktop built-in thirty-two-frame cycle');
    assert.deepEqual(await pet.evaluate(()=>[innerWidth,innerHeight]),[220,284]);
    checkpoint('capture native built-in');
    await pet.screenshot({path:path.join(profile,'native-builtin.png'),omitBackground:true});
    const adopted=await importPack(page,dense.file);
    assert.equal(adopted.animation.version,2);assert.equal(adopted.animation.pages.length,16);
    await cycle(page,'.pet-character .pet-animated-sprite','focus',16,'packaged main-window generated sixteen-frame cycle');
    await pet.waitForFunction(()=>document.querySelector('.pet-name')?.textContent==='Dense Release Fixture');
    await cycle(pet,'.pet-character .pet-animated-sprite','focus',16,'native desktop generated sixteen-frame cycle');
    checkpoint('capture generated companions and perform sleep action');
    await page.screenshot({path:path.join(profile,'main-generated.png')});
    await pet.screenshot({path:path.join(profile,'native-generated.png'),omitBackground:true});
    await pet.locator('.pet-character').hover();await pet.click('[data-quick-act="sleep"]');
    await page.waitForFunction(()=>TracerPetModel.current(Tracer.pet.read()).sleeping);
    await pet.waitForFunction(()=>{const el=document.querySelector('.pet-character .pet-animated-sprite');return el?.dataset.action==='sleep'&&el.dataset.playback==='sleeping'&&el.dataset.frame==='12';});
    const sleepingPose=await pet.locator('.pet-character .pet-animated-sprite').innerHTML();await pet.waitForTimeout(900);
    assert.equal(await pet.locator('.pet-character .pet-animated-sprite').innerHTML(),sleepingPose,'sleep holds the settled pose without continuously redrawing');
    console.log('PASS native care action settles into the resting pose and pauses playback');
    checkpoint('wake native companion and configure export download');
    await pet.locator('.pet-character').hover();await pet.click('[data-quick-act="sleep"]');
    await page.waitForFunction(()=>!TracerPetModel.current(Tracer.pet.read()).sleeping);
    // Route Electron's download into the isolated profile, avoiding native save dialogs.
    const downloads=path.join(profile,'downloads');fs.mkdirSync(downloads);const cdp=await browser.newBrowserCDPSession();
    await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
    checkpoint('export dense companion and verify downloaded file');
    await page.click('[data-tab="collection"]');await page.click('[data-act="open-export"]');await page.click('.pet-transfer-submit');
    let file;
    for(let i=0;i<80;i++){file=fs.readdirSync(downloads).find(name=>name.endsWith('.tracer-pet'));if(file)break;await sleep(200);}
    assert.ok(file,'native packaged app downloads a companion file');const exported=JSON.parse(fs.readFileSync(path.join(downloads,file),'utf8'));
    assert.equal(exported.version,2);assert.equal(exported.artwork.images.length,16);
    assert.deepEqual(exported.artwork.images.map(image=>image.sha256),dense.pack.artwork.images.map(image=>image.sha256));
    await page.locator('[data-transfer-close]').first().click();
    const old=await importPack(page,legacy.file);assert.equal(old.animation.version,1);assert.equal(old.animation.pages.length,4);
    await pet.waitForFunction(()=>document.querySelector('.pet-name')?.textContent==='Legacy Release Fixture');
    await cycle(pet,'.pet-character .pet-animated-sprite','focus',4,'native desktop legacy four-frame pack remains playable');
    checkpoint('reload and restore selected dense companion');
    await page.evaluate(id=>Tracer.pet.action('select',id),adopted.id);await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
    assert.equal(await page.evaluate(()=>Tracer.pet.read().selected),adopted.id);
    assert.equal(await page.evaluate(()=>Tracer.pet.read().customs.find(pet=>pet.id===Tracer.pet.read().selected).animation.version),2);
    // Workspace reload pauses account-bound native windows until the user
    // explicitly opens the companion again in the restored account context.
    await page.click('#pet-open');await page.click('[data-act="desktop"]');await page.click('.pet-home [data-act="close"]');
    await pet.waitForFunction(()=>document.querySelector('.pet-name')?.textContent==='Dense Release Fixture');
    checkpoint('native chat proposal and confirmed workspace creation over real IPC');
    allowWorkChat=true;
    await pet.bringToFront();await pet.locator('.pet-character').hover();await pet.click('[data-quick-act="expand"]');await pet.click('[data-tab="chat"]');
    await pet.fill('#pet-message','Create a release-check task with no deadline.');await pet.press('#pet-message','Enter');
    await pet.locator('.pet-work-preview[data-status="pending"]').waitFor();
    assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),0,'a native chat preview never creates work before confirmation');
    const pending=await pet.evaluate(id=>TracerPetChatState.create({surface:'native',petId:id}).load().work,adopted.id);
    await pet.click('[data-act="confirm-work"]');await pet.locator('.pet-work-preview[data-status="created"]').waitFor();
    assert.equal(mockedChats,1,'exactly one locally mocked chat request supplies the preview');
    const created=await page.evaluate(()=>Tracer.store.data.tasks.map(task=>({id:task.id,title:task.title})));
    assert.equal(created.length,1);assert.equal(created[0].title,workProposal.tasks[0].title);
    const duplicate=await pet.evaluate(request=>PetDesktop.createWork(request),{requestId:pending.requestId,proposal:pending.proposal});
    assert.deepEqual(duplicate.taskIds,[created[0].id],'native IPC retries resolve the same recorded task');
    assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),1,'retrying native confirmation never creates a duplicate');
    const persisted=await page.evaluate(async()=>{const response=await fetch('/api/store/workspace');if(!response.ok)throw new Error('workspace-read-failed');return response.json();});
    assert.equal(persisted.tasks.length,1);assert.equal(persisted.tasks[0].id,created[0].id);
    await pet.screenshot({path:path.join(profile,'native-chat-created.png'),omitBackground:true,animations:'disabled'});
    checkpoint('packaged companion home, task planting and mature flower preservation');
    await page.bringToFront();
    const gardenProject=await page.evaluate(()=>{
      const project=TracerModel.addProject(Tracer.store.data,{name:'Packaged home check'});
      Tracer.store.data.tasks[0].projectId=project.id;Tracer.touch();Tracer.saveNow();return project.id;
    });
    await page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight);
    await page.click('#nav-garden');await page.locator('.garden-home').waitFor();
    await cycle(page,'.garden-home-companion-art .pet-animated-sprite','focus',16,'packaged home uses the selected generated companion during the active focus session');
    await page.evaluate(id=>Tracer.openProject(id),gardenProject);
    const taskCard=page.locator('.card[data-id="'+created[0].id+'"]');
    await taskCard.locator('.card-move').selectOption('doing');
    await page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight);
    assert.equal(await page.evaluate(id=>TaskGarden.read(Tracer.store.base).seeds.find(seed=>seed.taskId===id)?.state,created[0].id),'growing');
    await taskCard.locator('.card-move').selectOption('done');
    await page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight);
    await page.click('#nav-garden');await page.evaluate(()=>Tracer.garden.refresh(true));
    const gardenCard=page.locator('.garden-task-plant-card[data-task-id="'+created[0].id+'"]');await gardenCard.waitFor();
    assert.equal(await gardenCard.getAttribute('data-stage'),'4');
    await page.evaluate(id=>Tracer.openProject(id),gardenProject);await page.click('#board-clear-completed');await page.click('[data-task-action="confirm"]');
    await page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight);
    assert.equal(await page.evaluate(()=>Tracer.store.base.tasks.length),0,'clearing removes the completed card');
    await page.click('#nav-garden');await gardenCard.waitFor();assert.equal(await gardenCard.getAttribute('data-stage'),'4','clearing retains the mature flower');
    await page.screenshot({path:path.join(profile,'main-companion-home.png'),animations:'disabled'});
    await page.reload();await page.waitForFunction(()=>window.Tracer?.garden&&Tracer.store.data);await page.evaluate(()=>Tracer.garden.refresh(true));
    const kept=await page.evaluate(id=>TaskGarden.read(Tracer.store.base).seeds.filter(seed=>seed.taskId===id),created[0].id);
    assert.equal(kept.length,1,'reload retains a single flower');assert.equal(kept[0].state,'mature');assert.equal(kept[0].harvestedAt,null);
    await gardenCard.waitFor();await gardenCard.locator('[data-plant-action="harvest"]').click();await page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight);
    assert.equal(await page.evaluate(id=>TaskGarden.read(Tracer.store.base).seeds.find(seed=>seed.taskId===id).state,created[0].id),'harvested');
    console.log('PASS packaged companion home, selected sixteen-frame companion, task planting, mature flowers survive clearing/reload and remain manually harvestable');
    assert.equal(aiWrites,0,'native release test never reaches a real generation or AI chat endpoint');assert.deepEqual(errors,[],'no packaged renderer errors');
    console.log('PASS packaged native chat preview, explicit confirmation, real IPC, durable main workspace save and idempotent retry');
    console.log('PASS packaged '+version+', isolated clean profile, main/native built-in thirty-two-frame and legacy generated sixteen-frame playback, live care, real v2 export/import, legacy v1 import and saved selection');
    console.log('Artifacts: '+profile);
  };
  let verificationError;
  try {
    // evaluate()/CDP calls have no Playwright action timeout. This Node-side
    // bound also covers renderer timers suspended by a stuck native window.
    await deadline(verify(),180000,()=> 'Packaged QA exceeded 180s during: '+stage);
  } catch(error) {
    verificationError=error;process.exitCode=1;failureLogged=true;
    console.error(error); // Report the original failure before cleanup begins.
    throw error;
  } finally {
    let cleanupError;
    try {
      checkpoint('cleanup: disconnect CDP (maximum 5s)');
      if(browser) {
        try {await deadline(browser.close(),5000,'CDP disconnect exceeded 5s');}
        catch(error) {console.error('Native QA disconnect:',error.message);}
      }
      // _electron.launch owns a Windows launcher shell plus Chromium helpers.
      // The shared scoped cleanup closes that full QA tree, including its IPC.
      checkpoint('cleanup: close QA-owned Electron and native control transport');
      await require('./close-qa-electron.cjs')(nativeApplication);
    } catch(error) {
      cleanupError=error;process.exitCode=1;
      console.error('Native QA cleanup:',error.message);
    } finally {
      try {fs.writeFileSync(path.join(profile,'launch.log'),log);}
      catch(error) {cleanupError=cleanupError||error;process.exitCode=1;console.error('Native QA log:',error.message);}
      checkpoint('cleanup finished');
    }
    if(cleanupError&&!verificationError)throw cleanupError;
  }
})().catch(error=>{if(!failureLogged)console.error(error);process.exitCode=1;});
