'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'skins/tracer'),out=path.join(root,'output/fishing-basic-upgrade');
const F=require('../public/fishing-model');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:380,height:260}}),errors=[],rows=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-09T02:00:00Z')});await page.clock.pauseAt(new Date('2026-10-09T02:00:01Z'));
  await page.addInitScript(()=>{window.commands=[];window.FishingDesktop={send:m=>commands.push(m),onSnapshot(fn){window.qaSnapshot=fn;return()=>{};},onMenuAction(fn){window.qaMenu=fn;return()=>{};}};});
  await page.route('http://entrance.test/**',route=>{const file=path.resolve(assets,'.'+new URL(route.request().url()).pathname);return file.startsWith(assets+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.abort();});
  await page.goto('http://entrance.test/fishing-desktop.html');await page.waitForFunction(()=>window.qaSnapshot&&window.qaMenu);
  for(const id of ['bamboo','tide','phoenix','golden','pilgrim','ruyi','wukong','peachbough','liubei','guanyuyunchang','lubu','emperorjade']){
   const timing=await page.evaluate(async ({rod,bait,decorations})=>{
    const id=rod.id,P=TracerFishingBasicPainted.assets[id]?TracerFishingBasicPainted:TracerFishingRelicPainted;
    await P.load(document,id);window.qaBase={accountScope:'guest',accountGeneration:1,language:'zh',nativeSessionId:'native-'+id,rod,bait,disabled:false,desktopPond:{pond:{style:'meadow',decorations},fish:[]},session:{id:'idle-'+id,phase:'idle'}};
    qaSnapshot(qaBase);qaMenu({type:'summon-rod'});return TracerFishingRodEffects.entranceTiming(rod);
   },{rod:F.catalog.rods.find(r=>r.id===id),bait:F.catalog.baits[0],decorations:F.defaultPondDecorations('meadow',0)});
   assert(timing.duration<=1700);await page.clock.runFor(16);
   // A real key press arrives while the material is still revealing.
   await page.locator('#fishing-rod').focus();await page.keyboard.down('KeyF');await page.clock.runFor(16);
   const start=await page.evaluate(()=>({phase:document.querySelector('#desktop-fishing').dataset.phase,power:Number(document.querySelector('#desktop-fishing').dataset.castPower),opacity:document.querySelector('#fishing-rod').style.opacity,commands:commands.filter(m=>m.type==='cast-start').length,renderer:document.querySelector('#fishing-rod').dataset.rodGeometry}));
   assert.equal(start.phase,'charging',id);assert(start.power>0&&start.power<.03,id);assert.equal(start.opacity,'1');assert.equal(start.renderer,'painted-flex');
   await page.clock.runFor(284);await page.keyboard.up('KeyF');await page.clock.runFor(16);
   const release=await page.evaluate(()=>({phase:document.querySelector('#desktop-fishing').dataset.phase,last:commands.filter(m=>m.type==='cast-release').at(-1)}));assert.equal(release.phase,'cast');assert.equal(release.last.heldMs,300);
   // Acknowledge a new idle session, play the complete entry and dismiss it.
   await page.evaluate(()=>{qaBase={...qaBase,nativeSessionId:qaBase.nativeSessionId+'-next',session:{...qaBase.session,id:qaBase.session.id+'-next'}};qaSnapshot(qaBase);qaMenu({type:'summon-rod'});});
   await page.clock.runFor(300);if(['phoenix','ruyi','guanyuyunchang','golden'].includes(id))await page.screenshot({path:path.join(out,'entrance-'+id+'-300ms.png')});
   await page.clock.runFor(timing.duration);assert.equal(await page.locator('#fishing-rod').evaluate(n=>n.style.opacity),'1');
   await page.evaluate(()=>qaMenu({type:'dismiss-rod'}));await page.clock.runFor(240);assert.equal(await page.locator('#desktop-fishing').getAttribute('data-rod-visible'),'false',id+' prompt dismissal');
   rows.push({id,...timing,firstFrame:start.phase,heldMs:release.last.heldMs,renderer:start.renderer});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'entrance-qa.json'),JSON.stringify({passed:true,rows,errors},null,2));console.log(JSON.stringify({passed:true,rods:rows.length,firstFrame:'charging',errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
