'use strict';
// Isolated real shop, controller, HTTP save and reload; never uses player data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createSuiteEnvironment}=require('./test-isolated.cjs');
const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/fishing-ten-draw-')),out=path.join(root,'output/fishing-ten-draw');fs.mkdirSync(out,{recursive:true});
const isolated=createSuiteEnvironment(folder,'root'),original={...process.env};
for(const key of ['HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','TMPDIR']){if(original[key]===undefined)delete isolated.env[key];else isolated.env[key]=original[key];}
for(const key of Object.keys(process.env))if(!(key in isolated.env))delete process.env[key];Object.assign(process.env,isolated.env);
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'ten_draw_ui',amount:10000,updatedAt:1};
fs.writeFileSync(path.join(isolated.dirs.data,'workspace.json'),JSON.stringify(ws));
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright'),{server}=require('../server');
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser,page;const report={passed:false,errors:[],checks:[]};
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});return route.continue();});
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const saved=()=>page.waitForFunction(()=>window.Tracer?.fishing&&Tracer.store.base?.fishing&&!Tracer.store.dirty&&!Tracer.store.inflight&&!Tracer.fishing.snapshot().busy);
 const state=()=>page.evaluate(()=>({state:TracerFishingModel.read(Tracer.store.data),balance:TracerFishingModel.economy(Tracer.store.data).balance}));
 await page.goto(origin);await saved();await page.locator('#language-select').selectOption('zh');
 await page.evaluate(()=>Tracer.fishing.action('open-pool','naruto'));await page.locator('[data-rod-pool="naruto"]').waitFor();
 await page.locator('[data-fishing-action="buy-ten-boxes"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'shop.png')});
 // Deterministic tickets let the real purchase exercise all quality colors and
 // a same-batch hidden duplicate. The next collection uses secure randomness.
 await page.evaluate(()=>{const original=TracerFishingModel.buyBoxes;TracerFishingModel.buyBoxes=(ws,options)=>{TracerFishingModel.buyBoxes=original;let n=0;const tickets=[5450,9700,8500,5500,0,0,0,5500,8500,5450];return original(ws,{...options,random:limit=>limit===10000?tickets[n++]:0});};});
 const before=await state();await page.locator('[data-fishing-action="buy-ten-boxes"]').click();await page.locator('.fishing-batch-modal[open]').waitFor();await saved();
 const after=await state(),modal=page.locator('.fishing-batch-modal[open]');assert.equal(after.state.boxes.length-before.state.boxes.length,10);assert.equal(await modal.locator('.fishing-batch-card').count(),10);assert(after.state.boxes.every(b=>b.poolId==='naruto'));
 const qualities=await modal.locator('.fishing-batch-card').evaluateAll(nodes=>nodes.map(n=>({tier:n.dataset.rarity,color:getComputedStyle(n).getPropertyValue('--reveal-color'),animation:getComputedStyle(n).animationName})));
 assert.equal(new Set(qualities.map(q=>q.tier)).size,5);assert.equal(new Set(qualities.map(q=>q.color)).size,5);assert(qualities.every(q=>q.animation==='none'));
 assert.match(await modal.textContent(),/重复 · 返还 150 金币/);assert.equal(after.balance,before.balance-1000+150);
 await modal.screenshot({path:path.join(out,'results-wide.png')});
 await page.setViewportSize({width:430,height:932});await modal.screenshot({path:path.join(out,'results-narrow.png')});
 const fits=await modal.evaluate(n=>({width:n.getBoundingClientRect().width,scroll:n.scrollWidth,inner:n.clientWidth,viewport:innerWidth}));assert(fits.width<=fits.viewport);assert(fits.scroll<=fits.inner+1);
 const chosen=after.state.boxes[1].rodId;await modal.locator('[data-equip-rod="'+chosen+'"]').click();await saved();assert.equal((await state()).state.equippedRodId,chosen);
 await page.reload();await saved();const restored=await state();assert.deepEqual(restored.state.boxes,after.state.boxes);assert.equal(restored.balance,after.balance);assert.equal(restored.state.equippedRodId,chosen);
 report.checks.push('10 saved receipts in selected pool','five distinct quality colors and reduced-motion handling','hidden duplicate refunded once','430px layout and equip action','HTTP save and reload preserve every result');
 await page.setViewportSize({width:1440,height:1000});await page.locator('#language-select').selectOption('en');await page.evaluate(()=>Tracer.fishing.action('open-pool','onepiece'));
 await page.locator('[data-fishing-action="buy-ten-boxes"][data-value="onepiece"]').click();await page.locator('.fishing-batch-modal[open]').waitFor();await saved();assert.equal((await state()).state.boxes.length,20);
 assert.equal(await page.locator('.fishing-batch-card').count(),10);assert.match(await page.locator('.fishing-batch-modal').textContent(),/Ten rod boxes/);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.fishing-batch-modal'));
 report.checks.push('secure random second batch in a different pool','English result and Escape dismissal');assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.error=e.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
