'use strict';
// Real application/controller/view and filesystem-backed saves in a disposable
// workspace. No production data, RNG replacement or mocked UI is involved.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const F=require('../public/fishing-model'),G=require('../public/task-garden'),M=require('../skins/tracer/model');
const folder=fs.mkdtempSync(path.join(__dirname,'../.cache/fishing-mystery-ui-')),data=path.join(folder,'data');fs.mkdirSync(data);
const workspace=M.emptyWorkspace();workspace.taskGarden=G.empty();F.ensure(workspace);workspace.taskGarden.market.testCredit={id:'mystery_ui_fixture',amount:10000,updatedAt:1};
let caughtAt=1000;
function catchSeed(seed,bait='worm'){
  if(!F.read(workspace).baits[bait])assert(F.buyBait(workspace,bait,1,caughtAt).ok);F.equipBait(workspace,bait,caughtAt);
  const session=F.beginCast(workspace,{seed,now:caughtAt}).session;F.stepSession(session,{},900);F.stepSession(session,{release:true},0);F.commitCast(workspace,session,caughtAt+1);
  while(!['caught','escaped'].includes(session.phase))F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);
  assert.equal(session.phase,'caught');const result=F.recordCatch(workspace,session,caughtAt+20000);assert(result.ok);caughtAt+=30000;return result;
}
const junk=[890000,890001,890002].map(seed=>catchSeed(seed));for(let i=0;i<8;i++)catchSeed(970000);catchSeed(0);
let legendSeed=0;while(F.createSession(null,{seed:legendSeed,baitId:'spirit'}).fishId!=='dragonkoi')legendSeed++;
const legend=catchSeed(legendSeed,'spirit');F.placeAquariumFish(workspace,legend.fry.id,true,caughtAt);
fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(workspace));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
const {server}=require('../server');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  let browser,page;const errors=[],failed=[],external=[],giftRequests=[],checks=[],observations={};
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
    await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){external.push(url.href);return route.abort();}if(url.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});return route.continue();});
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/ai/'))failed.push([r.status(),r.url()]);if(/\/fishing-art\/gift-/.test(r.url()))giftRequests.push(r.url());});
    const saved=()=>page.waitForFunction(()=>window.Tracer?.fishing&&Tracer.store.base?.fishing&&!Tracer.store.dirty&&!Tracer.store.inflight&&!Tracer.fishing.snapshot().busy);
    const state=()=>page.evaluate(()=>TracerFishingModel.read(Tracer.store.data));
    const goAquarium=async()=>{await page.evaluate(()=>Tracer.show('cabin'));await page.locator('[data-mystery-bundles]').waitFor();};
    const screenshot=async(name,locator)=>{if(locator)await locator.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(folder,name),fullPage:false});};
    const allImagesLoaded=async()=>page.waitForFunction(()=>[...document.querySelectorAll('.fishing-catch-item,.fishing-gift-card img')].every(img=>img.complete&&img.naturalWidth>0));
    await page.goto(origin);await saved();await goAquarium();await allImagesLoaded();
    assert.equal(await page.locator('[data-gift]').count(),0);assert.equal(await page.locator('img[src*="/gift-"]').count(),0);assert.deepEqual(giftRequests,[]);
    const junkCards=page.locator('.fishing-catch-grid .fishing-fish-card').filter({has:page.locator('.fishing-catch-item')});assert.equal(await junkCards.count(),3);
    observations.junk=await junkCards.evaluateAll(cards=>cards.map(c=>({src:c.querySelector('img').getAttribute('src'),button:c.querySelector('button').textContent,name:c.querySelector('h3').textContent})));
    assert.equal(new Set(observations.junk.map(x=>x.src)).size,3);assert(observations.junk.every(x=>/1$/.test(x.button.trim())));checks.push('three distinct junk images, all priced at one coin','unopened gifts absent from DOM and network');
    await screenshot('01-sealed-bundles-wide.png',page.locator('[data-mystery-bundles]'));await screenshot('02-junk-wide.png',junkCards.first());
    await page.evaluate(()=>Tracer.fishing.openShop());await page.locator('.garden-shop').waitFor({state:'visible',timeout:5000}).catch(()=>{});
    assert.equal(await page.locator('img[src*="/gift-"],[data-gift]').count(),0);assert.deepEqual(giftRequests,[]);checks.push('shop never renders or requests mystery gift previews');
    await goAquarium();
    for(let i=0;i<6;i++){
      await page.locator('[data-mystery-bundles] [data-fishing-action="open-bundle"]').click();await page.locator('.fishing-gift-reveal[open]').waitFor();await saved();
      const current=await state();assert.equal(current.giftUnlocks.length,i+1);assert.equal(current.mysteryOpenings.length,i+1);assert.equal(await page.locator('[data-gift]').count(),i+1);
      const rendered=await page.locator('[data-gift]').evaluateAll(nodes=>nodes.map(n=>n.dataset.gift));assert.deepEqual(rendered.slice().sort(),current.giftUnlocks.map(g=>g.id).sort());
      if(i===0){await page.waitForTimeout(1550);await screenshot('03-first-gift-reveal.png');observations.firstGift=current.giftUnlocks[0].id;}
      await page.locator('.fishing-gift-reveal[open] .fishing-gift-close').click();
      if(i===0){await page.reload();await saved();await goAquarium();assert.equal(await page.locator('[data-gift]').count(),1);assert.equal((await state()).giftUnlocks.length,1);}
    }
    checks.push('six real saved opens reveal six unique gifts; each stage renders only owned rewards','refresh preserves first discovery and unconsumed bundles');
    await allImagesLoaded();await screenshot('04-collection-wide.png',page.locator('[data-gift-collection]'));
    await page.locator('[data-gift="dragon_seal"] [data-fishing-action="equip-gift"]').click();await saved();await page.waitForFunction(()=>document.documentElement.dataset.fishingAvatar==='dragon_seal');
    await page.locator('[data-gift="cloud_koi_garden"] [data-fishing-action="equip-gift"]').click();await saved();await page.waitForFunction(()=>document.documentElement.dataset.fishingBackground==='cloud_koi_garden');
    observations.appearance=await page.evaluate(()=>({frame:document.documentElement.dataset.fishingAvatar,background:document.documentElement.dataset.fishingBackground,frameCSS:getComputedStyle(document.querySelector('.account-trigger'),'::after').backgroundImage,backgroundCSS:getComputedStyle(document.querySelector('#fishing-gift-background')).backgroundImage}));
    assert.match(observations.appearance.frameCSS,/gift-dragon_seal-v1/);assert.match(observations.appearance.backgroundCSS,/gift-cloud_koi_garden-v1/);
    await page.reload();await saved();await goAquarium();assert.equal(await page.evaluate(()=>document.documentElement.dataset.fishingAvatar),'dragon_seal');assert.equal(await page.evaluate(()=>document.documentElement.dataset.fishingBackground),'cloud_koi_garden');
    await screenshot('05-equipped-wide.png',page.locator('[data-gift-collection]'));
    await page.setViewportSize({width:430,height:932});await allImagesLoaded();await screenshot('06-equipped-narrow.png',page.locator('[data-gift="dragon_seal"]'));
    observations.narrowOverflow=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,main:document.querySelector('.main')?.scrollWidth}));
    assert(observations.narrowOverflow.body<=432,'mobile body must not scroll horizontally');
    await page.locator('[data-gift="dragon_seal"] [data-fishing-action="remove-gift"]').click();await saved();await page.waitForFunction(()=>!document.documentElement.dataset.fishingAvatar);
    await page.locator('[data-gift="cloud_koi_garden"] [data-fishing-action="remove-gift"]').click();await saved();await page.waitForFunction(()=>!document.documentElement.dataset.fishingBackground&&!document.querySelector('#fishing-gift-background'));
    await page.reload();await saved();await goAquarium();assert.equal((await state()).giftAppearance.avatarFrameId,null);assert.equal((await state()).giftAppearance.backgroundId,null);checks.push('frame/background equip and remove update actual chrome and survive reload','430 px layout has no horizontal overflow');
    await page.setViewportSize({width:1440,height:1000});const beforeSale=await state(),unsoldBundles=beforeSale.catches.filter(c=>c.fishId==='mystery_bundle'&&c.openedAt===null).map(c=>c.id);
    await page.locator('[data-fishing-action="sell-all-fish"]').click();await page.locator('.task-action-confirm').waitFor();assert.equal((await state()).catches.filter(c=>c.soldAt!==null).length,0);await screenshot('07-legendary-sale-confirmation.png');
    await page.locator('[data-task-action="confirm"]').click();await saved();const afterSale=await state();assert.equal(afterSale.catches.filter(c=>c.soldAt!==null).length,5);assert.equal(afterSale.catches.filter(c=>c.fishId==='mystery_bundle').length,8);assert.deepEqual(afterSale.catches.filter(c=>c.fishId==='mystery_bundle'&&c.openedAt===null).map(c=>c.id),unsoldBundles);assert.equal(afterSale.aquarium.fryIds.length,1);checks.push('bulk sale confirms its legend, sells all five marketable catches and retains every bundle and aquarium resident');
    await page.evaluate(()=>Tracer.fishing.openShop());assert.equal(await page.locator('img[src*="/gift-"],[data-gift]').count(),0);checks.push('shop still has no gift previews after owning all gifts');
    await page.reload();await saved();assert.equal((await state()).catches.filter(c=>c.soldAt!==null).length,5);assert.equal((await state()).giftUnlocks.length,6);
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify({passed:true,checks,observations,errors,failed,external},null,2));console.log('PASS '+checks.join('; '));console.log('Artifacts: '+folder);
  }catch(error){if(page&&!page.isClosed()){await page.screenshot({path:path.join(folder,'failure.png'),fullPage:false}).catch(()=>{});fs.writeFileSync(path.join(folder,'failure.html'),await page.content().catch(()=>''));}fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify({passed:false,error:error.stack,checks,observations,errors,failed,external},null,2));throw error;}
  finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);console.error('Artifacts: '+folder);process.exitCode=1;});
