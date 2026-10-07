'use strict';
// Production controller, view, motion, model and disk saves. One RNG draw is
// seeded for the target species; the catch itself uses real timed F input.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const F=require('../public/fishing-model'),G=require('../public/task-garden'),M=require('../skins/tracer/model');
const folder=fs.mkdtempSync(path.join(__dirname,'../.cache/fishing-pond-nursery-')),data=path.join(folder,'data');fs.mkdirSync(data);
const workspace=M.emptyWorkspace();workspace.taskGarden=G.empty();F.ensure(workspace);workspace.taskGarden.market.testCredit={id:'pond_nursery_review',amount:10000,updatedAt:1};
let at=1000;
function seedFor(fishId,bait){for(let seed=0;seed<10000;seed++)if(F.createSession(null,{seed,baitId:bait}).fishId===fishId)return seed;throw Error('No seed for '+fishId);}
function caught(fishId,bait){
 if(!F.read(workspace).baits[bait])assert(F.buyBait(workspace,bait,1,at).ok);assert(F.equipBait(workspace,bait,at).ok);
 const session=F.beginCast(workspace,{seed:seedFor(fishId,bait),now:at}).session;F.stepSession(session,{},900);F.stepSession(session,{release:true},0);assert(F.commitCast(workspace,session,at+1).ok);
 for(let i=0;i<6000&&!['caught','escaped'].includes(session.phase);i++)F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);
 assert.equal(session.phase,'caught',fishId);const result=F.recordCatch(workspace,session,at+20000);assert(result.ok&&result.fry);at+=30000;return result;
}
const archived=[['koi','grain'],['goldfish','grain'],['seahorse','shrimp'],['moonfin','stardust'],['dragonkoi','spirit']].map(([id,bait])=>caught(id,bait));
for(const c of archived)assert(F.placeFry(workspace,c.fry.id,'pond_starter',at).ok);
assert(F.archivePond(workspace,'pond_starter',at+1).ok);at+=10;const activeId=F.read(workspace).activePondId;
const legacy=caught('dragonkoi','spirit');assert(F.placeFry(workspace,legacy.fry.id,activeId,at).ok);
const available=[['koi','grain'],['goldfish','grain'],['seahorse','shrimp'],['crystal','frost']].map(([id,bait])=>caught(id,bait));
const legendary=caught('snagglefin','stardust');assert(F.buyBait(workspace,'glow',1,at).ok);assert(F.equipBait(workspace,'glow',at).ok);
const dreamSeed=seedFor('dreamray','glow'),archiveBefore=F.read(workspace).fry.filter(f=>f.pondId==='pond_starter'),legacyBefore=F.read(workspace).fry.find(f=>f.id===legacy.fry.id);
fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(workspace));
if(process.argv.includes('--prepare-only')){console.log(JSON.stringify({prepared:true,folder,dreamSeed,fry:F.read(workspace).fry.length}));process.exit(0);}
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
const {server}=require('../server');
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;const errors=[],failed=[],checks=[],observations={};try{
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});return route.continue();});
 await context.addInitScript(()=>{
  window.TracerFishing={update:value=>{window.qaDesktop=value;},show:()=>{window.qaPinned=(window.qaPinned||0)+1;},hide(){},onAction(){return()=>{};}};
  window.FishingDesktop={send(){},onSnapshot(fn){window.receiveDesktop=fn;return()=>{};},onMenuAction(){return()=>{};}};
  const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=value=>{if(window.qaNextFishSeed!==undefined&&value instanceof Uint32Array&&value.length===1){value[0]=window.qaNextFishSeed;delete window.qaNextFishSeed;return value;}return original(value);};
  let art;Object.defineProperty(window,'TracerFishingArt',{configurable:true,get:()=>art,set:value=>{art={...value,createPond(host,options){const player=value.createPond(host,options),update=player.update;window.qaPondFish=options.fish||[];return{...player,update(next){if(next.fish)window.qaPondFish=next.fish;return update(next);}};}};}});
 });
 const projectionOnly=process.argv.indexOf('--desktop-only');
 if(projectionOnly>=0){
  const source=JSON.parse(fs.readFileSync(process.argv[projectionOnly+1],'utf8')),desktopPond=source.observations.projection;assert(desktopPond.fish.some(f=>f.speciesId==='dreamray'));
  const overlay=await context.newPage();overlay.on('pageerror',e=>errors.push(e.message));await overlay.setViewportSize({width:380,height:260});await overlay.goto(origin+'/fishing-desktop.html');await overlay.waitForFunction(()=>window.receiveDesktop);await overlay.addStyleTag({content:'body{background:linear-gradient(140deg,#28454a,#667b65)!important}'});
  await overlay.evaluate(value=>receiveDesktop(value),{desktopPond,language:'zh',rod:F.catalog.rods[0],session:null});await overlay.waitForFunction(()=>qaPondFish.some(f=>f.speciesId==='dreamray'));await overlay.waitForTimeout(1200);await overlay.screenshot({path:path.join(folder,'04-desktop-dream-ray-settled.png')});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,folder,fish:desktopPond.fish.map(f=>f.speciesId),source:process.argv[projectionOnly+1]}));return;
 }
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/ai/'))failed.push([r.status(),r.url()]);});
 const saved=()=>page.waitForFunction(()=>window.Tracer?.fishing&&Tracer.store.base?.fishing&&!Tracer.store.dirty&&!Tracer.store.inflight&&!Tracer.fishing.snapshot().busy);
 const state=()=>page.evaluate(()=>TracerFishingModel.read(Tracer.store.data));
 const goPonds=async()=>{await page.evaluate(()=>Tracer.show('ponds'));await page.locator('[data-pond-nursery]').waitFor();};
 const shoot=async(name,locator)=>{if(locator)await locator.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(folder,name),fullPage:false});};
 await page.goto(origin);await saved();await goPonds();
 for(const c of available)assert.equal(await page.locator('[data-pond-nursery] [data-fry-id="'+c.fry.id+'"]').count(),1,'rare and epic waiting fry are visible');
 assert.equal(await page.locator('[data-pond-nursery] [data-fry-id="'+legendary.fry.id+'"]').count(),0,'new legendary fish belongs in the aquarium');
 await shoot('01-waiting-fingerlings.png',page.locator('[data-pond-nursery]'));
 await page.setViewportSize({width:430,height:932});await page.locator('[data-pond-nursery]').scrollIntoViewIfNeeded();await page.waitForTimeout(160);
 const responsive=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('[data-pond-nursery] [data-fry-id]')].map(n=>{const b=n.getBoundingClientRect();return{left:b.left,right:b.right,width:b.width};})}));assert(responsive.width<=responsive.viewport+1,'430px viewport has no horizontal document scrolling');assert(responsive.cards.every(c=>c.left>=0&&c.right<=431),'all nursery cards fit the narrow viewport');await shoot('01b-nursery-430px.png');observations.responsive=responsive;checks.push('430px nursery fits without horizontal scrolling');
 if(process.argv.includes('--responsive-only')){assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify({passed:true,checks,observations,errors,failed},null,2));console.log(JSON.stringify({passed:true,folder,checks}));return;}
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>Tracer.fishing.openGame());await page.locator('.fishing-modal[open] .fishing-game').waitFor();await page.locator('.fishing-modal[open] .fishing-game').focus();
 await page.evaluate(seed=>{window.qaNextFishSeed=seed;},dreamSeed);await page.keyboard.down('f');await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='charging');assert.equal(await page.evaluate(()=>Tracer.fishing.snapshot().session.fishId),'dreamray');await page.waitForTimeout(450);await page.keyboard.up('f');
 await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='bite',null,{timeout:18000});await page.keyboard.press('f');await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='reeling');
 const began=Date.now();let holding=false,downs=0,ups=0;try{while(Date.now()-began<60000){const s=await page.evaluate(()=>{const s=Tracer.fishing.snapshot().session;return{phase:s.phase,fish:s.fishPosition,bar:s.barPosition,reason:s.reason};});if(s.phase==='caught')break;assert.equal(s.phase,'reeling',s.reason||'catch remains active');const next=s.fish>s.bar;if(next!==holding){await page.keyboard[next?'down':'up']('f');holding=next;if(next)downs++;else ups++;}await page.waitForTimeout(18);}}finally{await page.keyboard.up('f');}
 await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='caught',null,{timeout:1000});await saved();const caughtState=await state(),dream=caughtState.fry.find(f=>f.fishId==='dreamray');assert(dream,'real saved catch grants its epic fry');assert(downs>1&&ups>1);assert.equal(dream.pondId,null);observations.dream={id:dream.id,seed:dreamSeed,downs,ups};checks.push('dream ray caught through the live controller using timed F input; persisted epic fry');
 await shoot('02-dream-ray-caught.png');await page.waitForTimeout(2100);await page.locator('.fishing-modal[open]').evaluate(d=>d.close());await goPonds();
 const dreamCard=page.locator('[data-pond-nursery] [data-fry-id="'+dream.id+'"]');await dreamCard.waitFor();assert((await dreamCard.textContent()).includes('星梦鳐'));await shoot('03-dream-ray-nursery.png',dreamCard);
 await dreamCard.locator('[data-fishing-action="place-pond-fish"]').click();await saved();assert.equal((await state()).fry.find(f=>f.id===dream.id).pondId,activeId);assert.equal(await page.locator('[data-pond-nursery] [data-fry-id="'+dream.id+'"]').count(),0);assert.equal(await page.locator('[data-fishing-action="take-pond-fish"][data-value="'+dream.id+'"]').count(),1);
 await page.locator('[data-fishing-action="pin-pond"]').click();await page.waitForFunction(id=>window.qaDesktop?.desktopPond?.fish.some(f=>f.id===id),dream.id);assert((await page.evaluate(()=>qaPinned))>0);observations.projection=await page.evaluate(()=>qaDesktop.desktopPond);checks.push('nursery placement reaches pond residents and the desktop projection');
 const overlay=await context.newPage();overlay.on('pageerror',e=>errors.push(e.message));await overlay.setViewportSize({width:380,height:260});await overlay.goto(origin+'/fishing-desktop.html');await overlay.waitForFunction(()=>window.receiveDesktop);await overlay.evaluate(value=>receiveDesktop(value),await page.evaluate(()=>qaDesktop));await overlay.waitForFunction(id=>qaPondFish.some(f=>f.id===id&&f.speciesId==='dreamray'),dream.id);await overlay.waitForTimeout(3700);await overlay.screenshot({path:path.join(folder,'04-desktop-dream-ray.png')});await overlay.close();
 await page.reload();await saved();await goPonds();const restored=(await state()).fry.find(f=>f.id===dream.id);assert.equal(restored.pondId,activeId);assert(await page.evaluate(id=>qaDesktop.desktopPond.fish.some(f=>f.id===id),dream.id));
 await page.evaluate(()=>Tracer.show('cabin'));await page.locator('[data-catch-basket]').waitFor();assert.equal(await page.locator('[data-fishing-action="place-aquarium-fish"][data-value="'+dream.id+'"]').count(),0);const sell=page.locator('[data-fishing-action="sell-fish"][data-value="'+dream.catchId+'"]');await sell.click();await saved();const sold=await state();assert(sold.catches.find(c=>c.id===dream.catchId).soldAt!==null);assert.deepEqual(sold.fry.find(f=>f.id===dream.id),restored);assert(await page.evaluate(id=>qaDesktop.desktopPond.fish.some(f=>f.id===id),dream.id));checks.push('refresh and selling the adult preserve its fry and desktop resident');
 await page.locator('[data-fishing-action="place-aquarium-fish"][data-value="'+legendary.fry.id+'"]').click();await saved();assert((await state()).aquarium.fryIds.includes(legendary.fry.id));await goPonds();await page.evaluate(({id,pondId})=>Tracer.fishing.action('place-pond-fish',id,{pondId}),{id:legendary.fry.id,pondId:activeId});await saved();assert.equal((await state()).fry.find(f=>f.id===legendary.fry.id).pondId,null);checks.push('new legendary fry can enter aquarium but cannot enter pond through UI controller');
 // Return/re-place the ray exercises the full nursery loop while retaining identity.
 await page.locator('[data-fishing-action="take-pond-fish"][data-value="'+dream.id+'"]').click();await saved();assert.equal((await state()).fry.find(f=>f.id===dream.id).pondId,null);await page.locator('[data-pond-nursery] [data-fishing-action="place-pond-fish"][data-value="'+dream.id+'"]').click();await saved();
 for(const c of available.slice(0,3)){await page.locator('[data-pond-nursery] [data-fishing-action="place-pond-fish"][data-value="'+c.fry.id+'"]').click();await saved();}
 assert.equal((await state()).fry.filter(f=>f.pondId===activeId&&f.releasedAt===null).length,5);assert(await page.locator('[data-pond-nursery] [data-fishing-action="place-pond-fish"][data-value="'+available[3].fry.id+'"]').isDisabled());checks.push('return-to-nursery preserves identity; a five-fish pond disables further placement');await shoot('05-full-pond.png',page.locator('.fishing-pond-title'));
 await page.locator('[data-fishing-action="select-pond"][data-value="pond_starter"]').click();assert.equal(await page.locator('.fishing-residents .fishing-fish-card').count(),5);assert.equal(await page.locator('[data-fishing-action="take-pond-fish"]').count(),0);assert.equal(await page.locator('[data-pond-nursery] [data-fishing-action="place-pond-fish"]:not(:disabled)').count(),0);await shoot('06-legacy-archived-pond.png',page.locator('.fishing-pond-title'));
 const final=await state();assert.deepEqual(final.fry.filter(f=>f.pondId==='pond_starter'),archiveBefore);assert.deepEqual(final.fry.find(f=>f.id===legacy.fry.id),legacyBefore);checks.push('legacy active legendary resident and archived five-fish collection remain byte-for-byte intact');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify({passed:true,checks,observations,errors,failed},null,2));console.log(JSON.stringify({passed:true,folder,checks}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
