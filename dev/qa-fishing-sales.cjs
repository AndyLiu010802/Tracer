'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model');
const folder=fs.mkdtempSync(path.join(__dirname,'../.cache/fishing-sales-ui-')),data=path.join(folder,'data');fs.mkdirSync(data);
const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'fish_sales_qa',amount:10000,updatedAt:1};
function catchFish(model,workspace,fishId,baitId){
  if(!model.read(workspace).baits[baitId])assert(model.buyBait(workspace,baitId,1).ok);assert(model.equipBait(workspace,baitId).ok);
  let seed=0;while(model.createSession(model.empty(),{seed,baitId}).fishId!==fishId){if(++seed>10000)throw Error('No fixture seed');}
  const {session}=model.beginCast(workspace,{seed});model.stepSession(session,{},900);model.stepSession(session,{release:true},0);assert(model.commitCast(workspace,session).ok);
  for(let i=0;i<4000&&!['caught','escaped'].includes(session.phase);i++)model.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);
  assert.equal(session.phase,'caught');const result=model.recordCatch(workspace,session);assert(result.ok);return result;
}
const catches=[catchFish(F,ws,'minnow','worm'),catchFish(F,ws,'carp','grain'),catchFish(F,ws,'dragonkoi','spirit'),catchFish(F,ws,'gulpuffer','stardust')];
F.placeAquariumFish(ws,catches[2].fry.id,true);F.equipBait(ws,'worm');fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(ws));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
const {server}=require('../server');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;const errors=[],checks=[];
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1500,height:1050},serviceWorkers:'block'});
    await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});return route.continue();});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    const action=(type,id)=>page.locator('[data-fishing-action="'+type+'"]'+(id?'[data-value="'+id+'"]':''));
    const saved=()=>page.waitForFunction(()=>window.Tracer?.fishing&&Tracer.store.base?.fishing&&!Tracer.store.dirty&&!Tracer.store.inflight&&!Tracer.fishing.snapshot().busy);
    const state=()=>page.evaluate(()=>{const s=TracerFishingModel.read(Tracer.store.data);return{unsold:s.catches.filter(c=>c.soldAt===null),sales:s.transactions.filter(t=>t.kind==='sale'),fry:s.fry,aquarium:s.aquarium,balance:TracerFishingModel.economy(Tracer.store.data).balance};});
    const panel=()=>page.locator('.task-action-confirm'),decision=type=>page.locator('[data-task-action="'+type+'"]');
    const quiet=async()=>{if(await page.locator('#daily-card-hide').isVisible())await page.locator('#daily-card-hide').click();await page.locator('#aside-slot .fx-panel').waitFor({state:'attached'});if(await page.locator('.shell').getAttribute('data-rail')!=='collapsed')await page.locator('.rail-grip').dblclick();};
    await page.goto(origin);await saved();await quiet();await page.selectOption('#language-select','zh');await page.click('#nav-cabin');const initial=await state();assert.equal(await action('sell-fish').count(),4);
    const total=catches.reduce((sum,c)=>sum+c.fish.price,0);assert.match(await action('sell-all-fish').textContent(),new RegExp(String(total)));
    await action('sell-fish',catches[0].catch.id).click();await saved();assert.equal(await panel().count(),0);assert.equal((await state()).unsold.length,3);checks.push('ordinary individual sale is immediate');
    await action('sell-fish',catches[2].catch.id).click();await panel().waitFor();assert.match(await panel().textContent(),/传奇鱼 1 条/);assert.match(await panel().textContent(),new RegExp(String(catches[2].fish.price)));
    const beforeSingle=await state();await decision('cancel').click();assert.deepEqual(await state(),beforeSingle);await action('sell-fish',catches[2].catch.id).click();await decision('confirm').click();await saved();assert.equal((await state()).unsold.length,2);checks.push('legendary individual sale requires confirm; cancel preserves stock');
    await page.setViewportSize({width:390,height:950});await page.selectOption('#language-select','en');await page.click('#nav-cabin');await action('sell-all-fish').click();await panel().waitFor();
    const bulkPrice=catches[1].fish.price+catches[3].fish.price;assert.match(await panel().textContent(),new RegExp('Sell 2 fish, including 1 legendary, for '+bulkPrice+' coins'));
    const fit=await panel().evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,page:document.documentElement.scrollWidth,viewport:innerWidth}));assert(fit.scroll<=fit.width+1&&fit.page<=fit.viewport+1);await page.waitForTimeout(350);await page.screenshot({path:path.join(folder,'legendary-confirm-390-en.png')});await decision('cancel').click();assert.equal((await state()).unsold.length,2);
    await page.setViewportSize({width:1500,height:1050});await page.selectOption('#language-select','zh');await page.click('#nav-cabin');await action('sell-all-fish').click();await panel().waitFor();await page.waitForTimeout(350);await page.screenshot({path:path.join(folder,'legendary-confirm-1500-zh.png')});await decision('confirm').click();await saved();
    const sold=await state();assert.equal(sold.unsold.length,0);assert.equal(sold.sales.length,4);assert.equal(sold.balance,initial.balance+total);assert.deepEqual(sold.fry,initial.fry);assert.deepEqual(sold.aquarium,initial.aquarium);assert(await action('sell-all-fish').isDisabled());checks.push('bulk legendary confirmation shows exact counts/value, works in both languages and sizes; aquarium stays intact');
    await page.reload();await saved();await quiet();await page.click('#nav-cabin');assert.deepEqual(await state(),sold);checks.push('sales and retained residents persist after reload');
    await page.evaluate(()=>{
      const F=TracerFishingModel,ws=Tracer.store.data;F.equipBait(ws,'worm');for(let n=0;n<2;n++){const {session}=F.beginCast(ws,{seed:0});F.stepSession(session,{},900);F.stepSession(session,{release:true},0);F.commitCast(ws,session);for(let i=0;i<4000&&!['caught','escaped'].includes(session.phase);i++)F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);if(session.phase!=='caught'||!F.recordCatch(ws,session).ok)throw Error('Fixture catch failed');}Tracer.touch();clearTimeout(Tracer.store.timer);Tracer.saveNow();
    });await saved();await action('sell-all-fish').click();await saved();assert.equal(await panel().count(),0);assert.equal((await state()).unsold.length,0);assert.equal((await state()).sales.length,6);checks.push('ordinary-only bulk sale is immediate');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify({passed:true,checks,fit,errors},null,2));console.log('PASS '+checks.join('; '));console.log('Artifacts: '+folder);
  }catch(error){const page=browser?.contexts()[0]?.pages()[0];await page?.screenshot({path:path.join(folder,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
  finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);console.error('Artifacts: '+folder);process.exitCode=1;});
