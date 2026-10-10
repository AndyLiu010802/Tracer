'use strict';
// Isolated UI fixtures: no account data or running application is touched.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'skins/tracer'),out=path.join(root,'output/fishing-progression');fs.mkdirSync(out,{recursive:true});
const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'ground_ui_test',amount:100000,updatedAt:1};
const scripts=['task-garden','fishing-model','fishing-aquarium-motion','fishing-lighting','fishing-aquatic-renderer','fishing-pond-skins','fishing-species-painted','fishing-species-live','fishing-art','fishing-tackle','fishing-view'];
const html='<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fishing.css"><style>body{margin:0;background:#203129;color:#eee5cd;font:14px system-ui}main{max-width:1200px;margin:28px auto;padding:0 24px}.fishing-page{max-width:none}</style><main id="grounds"></main><main id="shop"></main>'+scripts.map(s=>'<script src="/'+s+'.js"></script>').join('')+`<script>
window.ws=${JSON.stringify(ws)};const F=TracerFishingModel;window.results=[];
window.refresh=()=>{const snap={state:F.read(ws),economy:F.economy(ws),expedition:F.expedition(ws),progression:F.progression(ws),language:'zh',busy:false};grounds.update(snap);shop.update(snap);};
window.grounds=TracerFishingView.create(document.querySelector('#grounds'),{section:'ponds',onAction:(type,value,extra)=>{let r;if(type==='unlock-ground'){r=F.unlockGround(ws,value);if(r.ok)F.setExpedition(ws,{spotId:value});}else if(type==='set-expedition')r=F.setExpedition(ws,extra.patch);results.push(r);refresh();}});
window.shop=TracerFishingView.create(document.querySelector('#shop'),{section:'tackle'});refresh();
</script>`;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://grounds.test/**',route=>{const u=new URL(route.request().url());if(u.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});const file=path.resolve(assets,'.'+u.pathname);if(file.startsWith(assets+path.sep)&&fs.existsSync(file))return route.fulfill({path:file});return route.abort();});
 await page.goto('http://grounds.test/');await page.locator('.fishing-spots button').first().waitFor();
 await page.locator('.fishing-ground-art').first().evaluate(async el=>{const img=new Image();img.src=getComputedStyle(el).backgroundImage.slice(5,-2);await img.decode();});
 await page.locator('.fishing-expedition').screenshot({path:path.join(out,'grounds-desktop.png')});
 assert(await page.locator('[data-water=frost]').isDisabled());await page.locator('[data-water=reef]').click();assert.equal(await page.evaluate(()=>results.at(-1).spent),400);assert.equal(await page.locator('[data-water=reef]').getAttribute('aria-pressed'),'true');assert(!await page.locator('[data-water=frost]').isDisabled());
 await page.locator('[data-water=creek]').click();await page.locator('[data-water=reef]').click();assert.equal(await page.evaluate(()=>ws.fishing.transactions.filter(t=>t.kind==='ground_unlock').length),1);
 await page.evaluate(()=>{ws.taskGarden.market.testCredit.amount=401;refresh();});assert(await page.locator('[data-water=frost]').isDisabled());assert((await page.locator('[data-water=frost]').innerText()).includes('还差'));
 await page.setViewportSize({width:390,height:844});await page.locator('.fishing-expedition').screenshot({path:path.join(out,'grounds-mobile.png')});assert(await page.evaluate(()=>document.querySelector('.fishing-expedition').scrollWidth<=document.querySelector('.fishing-expedition').clientWidth));
 await page.setViewportSize({width:1440,height:1000});await page.locator('.fishing-hidden-pity').screenshot({path:path.join(out,'hidden-pity.png')});assert((await page.locator('.fishing-hidden-pity').innerText()).includes('100 抽内必出隐藏款'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({errors,unlock:'sequential, paid once, selects immediately',responsive:'390px and 1440px',screenshots:out},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
