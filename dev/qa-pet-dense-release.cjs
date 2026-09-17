'use strict';
// Smoke the actual packaged app in a fresh profile using local, synthetic artwork.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),net=require('node:net'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const {fixtures:denseFixtures}=require('./qa-pet-dense-animation.cjs');
const {fixtures:legacyFixtures}=require('./qa-pet-animation.cjs');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const executable=path.resolve(process.argv[2]||path.join(root,'dist',version+'-final','win-unpacked/Tracer.exe'));
fs.mkdirSync(path.join(root,'.cache'),{recursive:true});
const profile=fs.mkdtempSync(path.join(root,'.cache/pet-dense-release-')),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
let stage='setup',failureLogged=false;
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
  if(!await page.locator('[data-tab="collection"]').count())await page.click('#pet-open');
  await page.click('[data-tab="collection"]');await page.click('[data-act="open-import"]');
  await page.locator('#pet-package-file').setInputFiles(file);await page.locator('.pet-transfer-submit:not([disabled])').waitFor();
  await page.click('.pet-transfer-submit');await page.locator('.pet-character .pet-animated-sprite').waitFor();
  return page.evaluate(()=>{const state=Tracer.pet.read();return state.customs.find(pet=>pet.id===state.selected);});
}

async function cycle(page,selector,action,count,label) {
  checkpoint(label);
  await page.waitForFunction(({selector,action})=>{
    const el=document.querySelector(selector);return el?.dataset.action===action&&el.dataset.playback==='playing';
  },{selector,action});
  const result=await page.evaluate(({selector,action,count})=>new Promise((resolve,reject)=>{
    const element=document.querySelector(selector),frames=new Map();
    const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Timed out waiting for '+count+' '+action+' frames: '+[...frames.keys()].join(',')));},15000);
    const collect=()=>{
      if(element.dataset.action!==action)return;
      const frame=Number(element.dataset.frame),sheet=element.querySelector('.pet-animation-sheet');
      if(sheet&&(!sheet.complete||!sheet.naturalWidth))return;
      frames.set(frame,sheet?sheet.style.transform:element.innerHTML);
      if(frames.size===count){clearTimeout(timer);observer.disconnect();resolve({frames:[...frames.keys()].sort((a,b)=>a-b),poses:new Set(frames.values()).size});}
    };
    const observer=new MutationObserver(collect);observer.observe(element,{attributes:true,attributeFilter:['data-frame','data-action']});collect();
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
  const child=spawn(executable,['--remote-debugging-port=0','--disable-gpu','--in-process-gpu'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let browser,log='',launchError;child.stdout.on('data',bytes=>log+=bytes);child.stderr.on('data',bytes=>log+=bytes);child.on('error',error=>{launchError=error;});
  const exited=new Promise(resolve=>child.once('exit',resolve));
  const running=()=>!!child.pid&&child.exitCode===null&&child.signalCode===null;
  const verify=async()=>{
    checkpoint('wait for packaged Electron and DevTools endpoint');
    const active=path.join(profile,'DevToolsActivePort');
    for(let i=0;i<120&&!fs.existsSync(active)&&child.exitCode===null&&!launchError;i++)await sleep(250);
    assert.ok(fs.existsSync(active),'packaged app starts: '+(launchError?.message||log.slice(-1500)));
    checkpoint('connect to packaged browser over CDP');
    browser=await chromium.connectOverCDP('http://127.0.0.1:'+fs.readFileSync(active,'utf8').split(/\r?\n/)[0],{timeout:15000});
    const context=browser.contexts()[0],origin='http://127.0.0.1:'+port,errors=[];let page,aiWrites=0;
    await context.route('**/api/ai/**',route=>{if(route.request().method()!=='GET')aiWrites++;return route.fulfill({status:503,json:{error:'release-test-no-ai'}});});
    context.on('page',target=>target.on('pageerror',error=>errors.push(error.message)));
    for(let i=0;i<120;i++){page=context.pages().find(target=>target.url()===origin+'/');if(page)break;await sleep(250);}
    assert.ok(page,'packaged workspace opens');page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
    checkpoint('initialize clean workspace and synthetic fixtures');
    await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);await page.selectOption('#language-select','en');
    assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),0,'test profile has no private tasks');
    assert.equal(await page.evaluate(()=>Tracer.pet.read().customs.length),0,'test profile has no existing user companions');
    const dense=packageFile('Dense Release Fixture',2,(await denseFixtures(page)).sheets),legacy=packageFile('Legacy Release Fixture',1,(await legacyFixtures(page)).sheets);
    await page.click('#pet-open');assert.equal(await page.locator('.pet-name').innerText(),'Sprout');
    assert.equal(await page.evaluate(()=>TracerPetBuiltinAnimation.frames),16);
    await page.click('[data-act="focus-toggle"]');
    await cycle(page,'.pet-character .pet-builtin-sprite','focus',16,'packaged main-window built-in sixteen-frame cycle');
    checkpoint('capture main built-in and open native companion');
    await page.screenshot({path:path.join(profile,'main-builtin.png')});
    await page.click('[data-act="desktop"]');let pet;
    for(let i=0;i<120;i++){pet=context.pages().find(target=>target.url().endsWith('/pet.html'));if(pet)break;await sleep(150);}
    assert.ok(pet,'actual native desktop companion window opens');pet.setDefaultTimeout(20000);
    await cycle(pet,'.pet-character .pet-builtin-sprite','focus',16,'native desktop built-in sixteen-frame cycle');
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
    await cycle(pet,'.pet-character .pet-animated-sprite','sleep',16,'native care action changes to sixteen sleeping frames');
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
    await pet.waitForFunction(()=>document.querySelector('.pet-name')?.textContent==='Dense Release Fixture');
    assert.equal(aiWrites,0,'native release test never invokes generation or AI chat');assert.deepEqual(errors,[],'no packaged renderer errors');
    console.log('PASS packaged '+version+', isolated clean profile, main/native builtin and generated sixteen-frame playback, live care, real v2 export/import, legacy v1 import and saved selection');
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
    // Never let a CDP socket or inherited pipe retain this QA process forever.
    // Every signal below targets only the ChildProcess spawned by this script.
    const lastResort=setTimeout(()=>{
      console.error('Native QA cleanup exceeded 15s; terminating its spawned process.');
      process.exitCode=1;
      if(running()) {try {child.kill('SIGKILL');} catch {}}
      child.stdout?.destroy();child.stderr?.destroy();
      try {fs.writeFileSync(path.join(profile,'launch.log'),log);} catch {}
      process.exit(1);
    },15000);
    lastResort.unref();
    try {
      checkpoint('cleanup: disconnect CDP (maximum 5s)');
      if(browser) {
        try {await deadline(browser.close(),5000,'CDP disconnect exceeded 5s');}
        catch(error) {console.error('Native QA disconnect:',error.message);}
      }
      if(running()) {
        checkpoint('cleanup: stop spawned Electron (SIGTERM, maximum 5s)');
        child.kill('SIGTERM');
        try {await deadline(exited,5000,'Spawned Electron did not exit after SIGTERM');}
        catch {
          if(running()) {
            checkpoint('cleanup: force spawned Electron to exit (SIGKILL, maximum 2s)');
            child.kill('SIGKILL');
            await deadline(exited,2000,'Spawned Electron did not exit after SIGKILL');
          }
        }
      }
      assert.equal(running(),false,'the QA-owned packaged app has stopped');
    } catch(error) {
      cleanupError=error;process.exitCode=1;
      console.error('Native QA cleanup:',error.message);
    } finally {
      child.stdout?.destroy();child.stderr?.destroy();
      try {fs.writeFileSync(path.join(profile,'launch.log'),log);}
      catch(error) {cleanupError=cleanupError||error;process.exitCode=1;console.error('Native QA log:',error.message);}
      if(running()) child.unref();
      checkpoint('cleanup finished');
      // Keep the unref'ed guard armed until process exit: a stuck protocol
      // transport must still fail promptly after the scoped child was stopped.
    }
    if(cleanupError&&!verificationError)throw cleanupError;
  }
})().catch(error=>{if(!failureLogged)console.error(error);process.exitCode=1;});
