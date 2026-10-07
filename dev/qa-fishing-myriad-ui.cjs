'use strict';
// Actual shop/controller/filesystem saves. The fixture is isolated from user data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createSuiteEnvironment}=require('./test-isolated.cjs');
const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/fishing-myriad-ui-'));
const isolated=createSuiteEnvironment(folder,'root'),original={...process.env};
for(const key of ['HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','TMPDIR']){
  if(original[key]===undefined)delete isolated.env[key];else isolated.env[key]=original[key];
}
for(const key of Object.keys(process.env))if(!(key in isolated.env))delete process.env[key];
Object.assign(process.env,isolated.env);
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),G=require('../public/task-garden');
const workspace=M.emptyWorkspace();workspace.taskGarden=G.empty();F.ensure(workspace);
workspace.taskGarden.market.testCredit={id:'myriad_ui_credit',amount:10000,updatedAt:1};
for(let i=0;i<9;i++)assert(F.buyBox(workspace,{poolId:'basic',now:100+i,random:()=>0}).ok);
fs.writeFileSync(path.join(isolated.dirs.data,'workspace.json'),JSON.stringify(workspace));
const {chromium}=require(original.TRACER_QA_PLAYWRIGHT||'../.cache/desktop-qa-tools/node_modules/playwright'),{server}=require('../server');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  let browser,page;const report={passed:false,checks:[],errors:[],failedAssets:[],external:[],screenshots:[]};
  try{
    browser=await chromium.launch({channel:original.TRACER_QA_BROWSER||'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){report.external.push(url.origin);return route.abort();}if(url.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});return route.continue();});
    page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/ai/'))report.failedAssets.push({status:r.status(),url:r.url()});});
    const saved=()=>page.waitForFunction(()=>window.Tracer?.fishing&&Tracer.store.base?.fishing&&!Tracer.store.dirty&&!Tracer.store.inflight&&!Tracer.fishing.snapshot().busy);
    const state=()=>page.evaluate(()=>TracerFishingModel.read(Tracer.store.data));
    const shot=async(name,locator)=>{if(locator)await locator.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(folder,name)});report.screenshots.push(name);};
    const pool=()=>page.locator('.fishing-box-feature');
    const choose=async id=>{await page.locator('[data-fishing-action="select-pool"][data-value="'+id+'"]').click();await page.locator('[data-rod-pool="'+id+'"]').waitFor();};
    await page.goto(origin);await saved();await page.locator('#language-select').selectOption('zh');
    await page.evaluate(()=>Tracer.fishing.action('open-pool','myriad'));
    await page.locator('[data-rod-pool="myriad"]').waitFor();
    assert.match(await pool().textContent(),/万象秘藏/);assert.match(await pool().textContent(),/20 款/);
    assert.equal(await page.locator('[data-rod-id="eclipse"],[data-rod-id="golden"]').count(),0);
    assert(!(await pool().textContent()).includes('万象归墟'));assert(!(await pool().textContent()).includes('万金之王'));
    const previews=await pool().locator('[data-rod-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.rodId));
    assert.deepEqual(previews,['walnut','candlewyrm','sunforge']);
    await shot('01-myriad-shop.png',pool());
    await choose('basic');assert.match(await pool().textContent(),/基础奖池/);
    assert.equal((await state()).boxes.length,9);await choose('myriad');
    const before=await state();await pool().locator('[data-fishing-action="buy-box"]').click();
    await page.locator('.fishing-modal[open] .fishing-reveal').waitFor();await saved();
    const after=await state(),receipt=after.boxes.at(-1);assert.equal(after.boxes.length,before.boxes.length+1);assert.equal(receipt.poolId,'myriad');
    const selected=F.catalog.rodPools.find(p=>p.id==='myriad');assert([...selected.rodIds,selected.hiddenRodId].includes(receipt.rodId));
    assert.equal(F.pity(after,'basic').epic,9);assert.equal(after.rods.includes(receipt.rodId),true);
    await page.locator('.fishing-modal[open] [data-equip]').click();await saved();assert.equal((await state()).equippedRodId,receipt.rodId);
    report.checks.push('two real pool tabs and deep-link routing','hidden rods absent before discovery','real random new-pool purchase and equip saved; base guarantee unaffected');
    await page.reload();await saved();assert.equal((await state()).equippedRodId,receipt.rodId);assert.equal((await state()).boxes.at(-1).poolId,'myriad');
    await page.evaluate(()=>Tracer.show('rods'));
    await page.locator('[data-fishing-action="select-rod-pool"][data-value="myriad"]').click();
    const grid=page.locator('.fishing-rod-grid');assert.equal(await grid.locator('article').count(),20);
    const ids=await grid.locator('[data-rod-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.rodId));
    assert.equal(new Set(ids).size,receipt.rodId==='eclipse'?20:19);assert(ids.every(id=>selected.rodIds.includes(id)||id===receipt.rodId));
    if(receipt.rodId!=='eclipse'){assert.equal(await grid.locator('[data-hidden-reward]').count(),1);assert(!(await grid.textContent()).includes('万象归墟'));}
    await page.waitForFunction(()=>[...document.querySelectorAll('.fishing-rod-grid image')].every(node=>{const img=new Image();img.src=node.getAttribute('href');return img.complete&&img.naturalWidth>0;}));
    await shot('02-myriad-collection-top.png',grid.locator('article').first());
    await shot('03-myriad-collection-epics.png',grid.locator('article').nth(10));
    await shot('04-myriad-collection-legends.png',grid.locator('article').last());
    await page.locator('#language-select').selectOption('en');await saved();
    await page.evaluate(()=>Tracer.fishing.action('open-pool','myriad'));await page.locator('[data-rod-pool="myriad"]').waitFor();
    assert.match(await pool().textContent(),/Myriad reliquary/);assert.match(await pool().textContent(),/20 rods/);
    await page.setViewportSize({width:430,height:932});await shot('05-myriad-narrow.png',pool());
    const width=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth}));assert(width.body<=width.viewport+2,'no narrow-layout horizontal overflow');
    report.checks.push('equipped rod and receipt survive actual reload','20-entry collection matches new pool with unrevealed secret hidden','English copy and 430px layout');
    report.purchase={rodId:receipt.rodId,poolId:receipt.poolId};assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedAssets,[]);assert.deepEqual(report.external,[]);report.passed=true;
  }catch(error){report.error=error.stack;if(page)await page.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});throw error;}
  finally{fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify({folder,passed:report.passed,checks:report.checks}));}
})().catch(error=>{console.error(error);process.exitCode=1;});
