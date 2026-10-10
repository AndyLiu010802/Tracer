'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/fishing-pond-skins'),F=require('../public/fishing-model'),M=require('../skins/tracer/model');
async function route(page){await page.route('http://pond-skins.test/**',async r=>{const url=new URL(r.request().url());let file=path.join(root,'skins/tracer',decodeURIComponent(url.pathname));if(!fs.existsSync(file))file=path.join(root,'public',decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:'missing'});await r.fulfill({path:file});});}
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1120,height:850},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));await route(page);await page.goto('http://pond-skins.test/fishing-bait-desktop.html');
 await page.setContent('<html lang="zh-CN"><body style="margin:0;padding:24px;background:#172a23;color:#e4e7cd;font-family:Segoe UI,Microsoft YaHei,sans-serif"><main id="app"></main></body></html>');
 for(const name of ['fishing.css','fishing-tackle.css','fishing-rewards.css'])await page.addStyleTag({url:'http://pond-skins.test/'+name});
 for(const name of ['task-garden','fishing-model','fishing-lighting','fishing-aquatic-renderer','fishing-pond-skins','fishing-art','fishing-rewards','fishing-tackle','fishing-view'])await page.addScriptTag({url:'http://pond-skins.test/'+name+'.js'});
 const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'pond_skin_qa',amount:50000,updatedAt:1};
 await page.evaluate(data=>{
   window.ws=data;window.actions=[];
   window.snap=()=>({language:'zh',state:TracerFishingModel.read(ws),economy:TracerFishingModel.economy(ws),catalog:TracerFishingModel.catalog,showcase:TracerFishingModel.aquarium(ws),expedition:TracerFishingModel.expedition(ws,{timeId:'day',weatherId:'clear'}),busy:false});
   window.view=TracerFishingView.create(document.querySelector('#app'),{section:'tackle',onAction:(action,id)=>{actions.push([action,id]);if(action==='buy-pond-skin')TracerFishingModel.buyPondSkin(ws,id);if(action==='equip-pond-skin')TracerFishingModel.equipPondSkin(ws,id||null);view.update(snap());}});view.update(snap());
 },ws);
 assert.equal(await page.locator('.fishing-skin-card').count(),10);
 await page.locator('[data-fishing-action="preview-pond-skin"][data-value="konoha"]').click();await page.waitForFunction(()=>document.querySelector('[data-skin-pond]')?.dataset.skinModel==='blender');
 assert.equal(await page.evaluate(()=>ws.fishing.pondAppearance),undefined);
 await page.evaluate(()=>window.previewCanvas=document.querySelector('[data-skin-pond] canvas'));
 await page.locator('[data-skin-preview] [data-fishing-action="buy-pond-skin"]').click();assert.equal(await page.evaluate(()=>TracerFishingModel.economy(ws).balance),48200);
 assert.equal(await page.evaluate(()=>previewCanvas===document.querySelector('[data-skin-pond] canvas')),true);
 await page.locator('[data-skin-preview] [data-fishing-action="equip-pond-skin"]').click();assert.equal(await page.evaluate(()=>ws.fishing.pondAppearance.skinId),'konoha');
 await page.locator('[data-skin-preview]').screenshot({path:path.join(out,'shop-preview.png')});
 await page.locator('[data-fishing-action="close-skin-preview"]').click();assert.equal(await page.locator('[data-skin-pond]').count(),0);await page.locator('[data-pond-skin-shop]').screenshot({path:path.join(out,'shop-ten-themes.png')});
 await page.locator('[data-pond-skin-shop] [data-fishing-action="equip-pond-skin"][data-value=""]').click();assert.equal(await page.evaluate(()=>ws.fishing.pondAppearance.skinId),null);
 await page.evaluate(()=>{TracerFishingModel.equipPondSkin(ws,'konoha');view.destroy();view=TracerFishingView.create(document.querySelector('#app'),{section:'ponds'});view.update(snap());});await page.waitForFunction(()=>document.querySelector('#fishing-pond-canvas')?.dataset.skinModel==='blender');await page.locator('#fishing-pond-canvas').screenshot({path:path.join(out,'nursery-equipped.png')});
 await page.setViewportSize({width:580,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.evaluate(()=>view.destroy());
 // Actual compact native box page, with an isolated native bridge.
 await page.addInitScript(()=>{window.FishingBaitDesktop={onSnapshot(fn){window.pushBait=fn;return()=>{};},send(message){(window.sentBait||=[]).push(message);}};});
 await page.setViewportSize({width:320,height:208});await page.goto('http://pond-skins.test/fishing-bait-desktop.html');
 const tackle={coins:48200,pondSkinId:'valorant',equippedBaitId:'earthworm',busy:false,locked:false,baits:F.catalog.baits.map(b=>({...b,count:b.id==='earthworm'?20:0}))};
 await page.evaluate(t=>pushBait({language:'zh',tackle:t}),tackle);await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:path.join(out,'compact-themed-box.png')});
 assert.equal(await page.locator('#bait-box').getAttribute('data-pond-skin'),'valorant');await page.locator('[data-bait="prawn"]').click({button:'right'});assert.equal(await page.evaluate(()=>sentBait.at(-1).type),'context-menu');assert.equal(await page.evaluate(()=>sentBait.at(-1).baitId),'prawn');
 await page.evaluate(t=>pushBait({language:'en',tackle:{...t,pondSkinId:null}}),tackle);assert.equal(await page.locator('#bait-box').getAttribute('data-pond-skin'),'');
 assert.deepEqual(errors,[]);console.log('PASS 10 shop cards, isolated preview, buy/equip/reset, retained context, responsive layout, native box and right-click actions.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
