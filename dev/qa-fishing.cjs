'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const F=require('../public/fishing-model'),G=require('../public/task-garden'),M=require('../skins/tracer/model');
const folder=fs.mkdtempSync(path.join(__dirname,'../.cache/fishing-ui-')),data=path.join(folder,'data');fs.mkdirSync(data);
const ws=M.emptyWorkspace();ws.taskGarden=G.empty();ws.taskGarden.market.testCredit={id:'fishing_ui_credit',amount:5000,updatedAt:Date.now()-100000};F.ensure(ws);
const fixtureRod=F.buyBox(ws,{random:limit=>limit===10000?9999:0});F.equipRod(ws,fixtureRod.rod.id);
function catchFish(baitId,target){
  F.buyBait(ws,baitId,1);F.equipBait(ws,baitId);let seed=0;
  while(F.createSession(F.read(ws),{seed}).fishId!==target){seed++;if(seed>10000)throw Error('Unknown seed');}
  const {session}=F.beginCast(ws,{seed});F.stepSession(session,{},800);F.stepSession(session,{release:true},0);assert(F.commitCast(ws,session).ok);
  while(session.phase!=='bite')F.stepSession(session,{},100);
  F.stepSession(session,{hook:true},0);
  for(let i=0;i<4000&&session.phase==='reeling';i++)F.stepSession(session,{holding:session.fishPosition>session.barPosition},16);
  assert.equal(session.phase,'caught',target+' seed '+seed);const result=F.recordCatch(ws,session);assert(result.ok);return result.fry;
}
for(const [bait,id] of [['grain','koi'],['grain','goldfish'],['shrimp','seahorse'],['spirit','lotusfin'],['stardust','moonfin'],['spirit','dragonkoi']])catchFish(bait,id);
F.read(ws).fry.slice(0,5).forEach(f=>F.placeFry(ws,f.id,'pond_starter'));F.equipBait(ws,'worm');F.equipRod(ws,'bamboo');
fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(ws));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
const {server}=require('../server');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  let browser,failWrites=0,holdNextWrite=false,releaseWrite=null;const errors=[],external=[],failed=[],injectedFaults=[];
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});
    const context=await browser.newContext({viewport:{width:1500,height:1050},serviceWorkers:'block'});
    await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){external.push(url.href);return route.abort();}if(url.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});if(url.pathname==='/api/store/workspace'&&route.request().method()==='PUT'){if(failWrites>0){failWrites--;return route.fulfill({status:500,headers:{'x-fishing-qa-fault':'1'},json:{error:'qa-save-failed'}});}if(holdNextWrite){holdNextWrite=false;return new Promise(resolve=>{releaseWrite=()=>{releaseWrite=null;resolve(route.continue());};});}}return route.continue();});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.headers()['x-fishing-qa-fault']==='1')injectedFaults.push([r.status(),r.url()]);else if(r.status()>=400&&!r.url().includes('/api/ai/'))failed.push([r.status(),r.url()]);});
    const saved=()=>page.waitForFunction(()=>window.Tracer?.fishing&&Tracer.store.base?.fishing&&!Tracer.store.dirty&&!Tracer.store.inflight&&!Tracer.fishing.snapshot().busy);
    const scrollHeading=async section=>{await page.waitForSelector('#sec-'+section+' .fishing-heading',{state:'visible'});await page.evaluate(section=>document.querySelector('#sec-'+section+' .fishing-heading')?.scrollIntoView({block:'nearest',behavior:'instant'}),section);};
    const screenshot=async(file,options={fullPage:true})=>{
      await page.waitForTimeout(280);
      await page.waitForFunction(()=>Array.from(document.images).filter(image=>{const rect=image.getBoundingClientRect();return(image.currentSrc||image.getAttribute('src'))&&rect.width>0&&rect.height>0;}).every(image=>image.complete&&image.naturalWidth>0));
      await page.screenshot({path:path.join(folder,file),...options});
    };
    const pond=()=>page.evaluate(()=>TracerFishingModel.read(Tracer.store.data).ponds.find(p=>p.id==='pond_starter'));
    const wallet=()=>page.evaluate(()=>TracerFishingModel.economy(Tracer.store.data).balance);
    const tackleState=()=>page.evaluate(()=>{const s=TracerFishingModel.read(Tracer.store.data);return{equipped:s.equippedBaitId,baits:s.baits,balance:TracerFishingModel.economy(Tracer.store.data).balance,transactions:s.transactions.length};});
    const shopBox=()=>page.locator('.store-fishing:not([hidden]) .fishing-tackle[data-mode="shop"]');
    const aquariumBox=()=>page.locator('#sec-cabin .fishing-tackle[data-mode="equip"]');
    const modalBox=()=>page.locator('.fishing-modal [data-bait-tackle] .fishing-tackle');
    const selectBait=async(box,id)=>{await box.locator('.fishing-tackle-slot[data-bait-id="'+id+'"]').click();assert.equal(await box.locator('.fishing-tackle-bay').getAttribute('data-selected-bait'),id);};
    const browseBaits=async box=>{const before=await tackleState();assert.equal(await box.locator('.fishing-tackle-slot').count(),7);for(const bait of F.catalog.baits){await selectBait(box,bait.id);assert.deepEqual(await box.locator('.fishing-tackle-visiting-fish svg[data-species]').evaluateAll(items=>items.map(item=>item.dataset.species)),bait.fishIds);assert.equal(await box.locator('.fishing-tackle-slot[data-bait-id="'+bait.id+'"] svg[data-bait-art]').getAttribute('data-bait-art'),bait.id);assert.deepEqual(await tackleState(),before,'browsing '+bait.id+' never spends or equips');}};
    const sceneryReady=()=>page.waitForFunction(()=>document.querySelector('.fishing-pond-host')?.dataset.decorArt==='ready');
    const quietLayout=async()=>{
      if(await page.locator('#daily-card-hide').isVisible())await page.locator('#daily-card-hide').click();
      await page.locator('#aside-slot .fx-panel').waitFor({state:'attached'});
      if(await page.locator('.shell').getAttribute('data-rail')!=='collapsed')await page.locator('.rail-grip').dblclick();
      await page.waitForFunction(()=>document.querySelector('.shell')?.dataset.rail==='collapsed');
    };
    const edit=async()=>{
      if(!await page.locator('[data-decoration-editor]').isVisible())await page.locator('[data-fishing-action="edit-decorations"]').click();
      await page.locator('[data-decoration-editor]').waitFor({state:'visible'});await sceneryReady();
    };
    const decoratingScreenshot=async file=>{
      await page.setViewportSize({width:1500,height:1550});await page.locator('.fishing-pond-canvas').scrollIntoViewIfNeeded();await sceneryReady();
      await screenshot(file);await page.setViewportSize({width:1500,height:1050});
    };
    const dragDecoration=async id=>{
      await page.locator('.fishing-pond-canvas').scrollIntoViewIfNeeded();await sceneryReady();
      const before=(await pond()).decorations.find(d=>d.id===id),point=await page.evaluate(id=>Tracer.fishing.decorationPosition(id),id);assert(point&&Number.isFinite(point.x)&&Number.isFinite(point.y),'sprite has a visible hit position');
      // Select by hitting the actual textured sprite, then drag it with pointer capture and drop.
      await page.locator('[data-decoration-select]').selectOption('');await page.mouse.click(point.x,point.y);
      assert.equal(await page.locator('[data-decoration-select]').inputValue(),id,'sprite click selects its decoration');
      await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+38,point.y+22,{steps:10});await page.mouse.up();await saved();
      const after=(await pond()).decorations.find(d=>d.id===id);assert(Math.hypot(after.x-before.x,after.z-before.z)>.08,'real sprite drag commits a changed world position');
      assert(after.x>=-2.65&&after.x<=2.65&&after.z>=-2.65&&after.z<=2.65);return after;
    };
    const failedBoxRetry=async nextAction=>{
      const before=await page.evaluate(()=>{const s=TracerFishingModel.read(Tracer.store.data);return{boxes:s.boxes.length,charges:s.transactions.filter(t=>t.kind==='box').length,baits:s.baits};});
      failWrites=1;await page.locator('[data-fishing-action="buy-box"]').click();
      await page.waitForFunction(count=>TracerFishingModel.read(Tracer.store.data).boxes.length===count+1&&Tracer.store.dirty&&!Tracer.store.inflight&&!Tracer.fishing.snapshot().busy,before.boxes);
      assert.equal(await page.locator('.fishing-reveal').count(),0,'an unsaved draw does not reveal early');
      const pending=await page.evaluate(()=>{const s=TracerFishingModel.read(Tracer.store.data);return{box:s.boxes.at(-1),balance:TracerFishingModel.economy(Tracer.store.data).balance};});
      if(nextAction==='buy-bait')await selectBait(shopBox(),'stardust');
      const next=nextAction==='buy-box'?page.locator('[data-fishing-action="buy-box"]'):shopBox().locator('.fishing-tackle-primary[data-tackle-action="buy-bait"]');
      await next.click();await page.locator('.fishing-reveal').waitFor();await saved();
      const recovered=await page.evaluate(()=>{const s=TracerFishingModel.read(Tracer.store.data);return{boxes:s.boxes.length,charges:s.transactions.filter(t=>t.kind==='box').length,box:s.boxes.at(-1),baits:s.baits,balance:TracerFishingModel.economy(Tracer.store.data).balance};});
      assert.equal(recovered.boxes,before.boxes+1,'retry only saves the original draw');assert.equal(recovered.charges,before.charges+1,'retry never charges another box');
      assert.deepEqual(recovered.box,pending.box);assert.equal(recovered.balance,pending.balance);assert.deepEqual(recovered.baits,before.baits,'a different purchase retries the draw first');
      const rod=F.catalog.rods.find(r=>r.id===pending.box.rodId);assert.equal(await page.locator('.fishing-reveal h2').textContent(),rod.name[0]);
      await screenshot('saved-draw-retry-'+nextAction+'.png',{fullPage:false});await page.locator('.fishing-reveal [data-close]').click();
    };
    await page.goto(origin);await saved();await page.selectOption('#language-select','zh');
    await quietLayout();
    assert.equal(await page.locator('#pet-open').count(),0);assert.equal(await page.locator('script[src="/pet.js"]').count(),0);
    await page.click('#nav-garden');await page.locator('.fishing-garden-links').waitFor();assert.equal(await page.locator('.garden-home-companion').count(),0);
    await page.click('#nav-ponds');await page.locator('.fishing-pond-host canvas').waitFor();
    await screenshot('ponds-in-progress.png');
    assert.equal(await page.locator('.fishing-residents .fishing-fish-card').count(),5);
    await page.locator('[data-fishing-action="pond-style"][data-value="moon"]').click();await saved();
    assert.equal(await page.evaluate(()=>TracerFishingModel.read(Tracer.store.data).ponds[0].styleId),'moon');
    const decorationBalance=await wallet(),originalDecorations=(await pond()).decorations;
    assert.equal(await page.locator('[data-decoration-editor]').isVisible(),false);await edit();
    assert.equal(await page.locator('[data-fishing-action="edit-decorations"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-decoration-editor] [data-fishing-action="add-decoration"]').count(),12);
    assert.deepEqual(await page.locator('[data-decoration-editor] [data-fishing-action="add-decoration"]').evaluateAll(items=>items.map(i=>i.dataset.value)),F.catalog.decorations.map(d=>d.id));
    // Exercise every free prop through its real catalog button, preserving the recommended scenery.
    for(const decoration of F.catalog.decorations){
      await page.locator('[data-fishing-action="add-decoration"][data-value="'+decoration.id+'"]').click();await saved();
      const current=await pond(),added=current.decorations.find(d=>!originalDecorations.some(old=>old.id===d.id));
      assert(added&&added.kind===decoration.id,'catalog creates '+decoration.id);assert.equal(current.decorations.length,originalDecorations.length+1);
      await page.locator('[data-decoration-select]').selectOption(added.id);
      await page.locator('[data-fishing-action="decor-remove"]').click();await saved();
      assert.deepEqual((await pond()).decorations,originalDecorations);
    }
    await page.locator('[data-fishing-action="add-decoration"][data-value="basket"]').click();await saved();
    const added=(await pond()).decorations.find(d=>!originalDecorations.some(old=>old.id===d.id));assert(added);
    await page.locator('[data-decoration-select]').selectOption(added.id);
    for(const action of ['right','up','rotate','larger']){await page.locator('[data-fishing-action="decor-'+action+'"]').click();await saved();}
    const moved=(await pond()).decorations.find(d=>d.id===added.id);
    assert.equal(moved.x,Math.min(2.65,added.x+.2));assert.equal(moved.z,Math.max(-2.65,added.z-.2));
    assert.equal(moved.rotation,(added.rotation+1)%4);assert(Math.abs(moved.scale-Math.min(1.5,added.scale+.1))<.00001);
    await dragDecoration(added.id);
    assert.equal(await wallet(),decorationBalance,'all decorating is free');
    const decorated=(await pond()).decorations;
    await decoratingScreenshot('pond-decorating.png');
    await page.locator('[data-fishing-action="edit-decorations"]').click();assert.equal(await page.locator('[data-decoration-editor]').isVisible(),false);
    await page.reload();await saved();await quietLayout();await page.click('#nav-ponds');await sceneryReady();
    assert.deepEqual((await pond()).decorations,decorated,'custom layout survives reload');assert.equal(await wallet(),decorationBalance);
    assert.equal(await page.locator('[data-fishing-action="place-fry"]').count(),0,'fish placement moved to aquarium');
    assert.equal(await page.locator('.fishing-residents .fishing-fish-card').count(),5,'historical pond residents stay intact');
    const balance=await page.evaluate(()=>TracerFishingModel.economy(Tracer.store.data).balance);
    await page.locator('[data-fishing-action="archive-request"]').click();await page.locator('[data-task-action="confirm"]').click();await saved();
    assert.equal(await page.evaluate(()=>TracerFishingModel.read(Tracer.store.data).ponds.length),2);
    assert.equal(await page.evaluate(()=>TracerFishingModel.economy(Tracer.store.data).balance),balance);
    await page.locator('[data-fishing-action="feed-pond"]').click();await saved();
    await screenshot('ponds-collected-feeding.png');
    await page.reload();await saved();await page.click('#nav-ponds');await page.locator('[data-fishing-action="select-pond"][data-value="pond_starter"]').click();
    assert.equal(await page.locator('.fishing-residents .fishing-fish-card').count(),5);assert.equal(await page.locator('[data-fishing-action="release-request"]').count(),0);
    await quietLayout();const archived=await pond(),archivedBalance=await wallet();assert(archived.archivedAt);await edit();
    await page.locator('[data-fishing-action="add-decoration"][data-value="bench"]').click();await saved();
    const archivedAdded=(await pond()).decorations.find(d=>!archived.decorations.some(old=>old.id===d.id));assert(archivedAdded&&archivedAdded.kind==='bench');
    await page.locator('[data-decoration-select]').selectOption(archivedAdded.id);await page.locator('[data-fishing-action="decor-left"]').click();await saved();
    await dragDecoration(archivedAdded.id);
    assert.deepEqual((await pond()).fishIds,archived.fishIds,'archived residents stay fixed during decorating');
    assert.deepEqual((await pond()).sealedFishIds,archived.sealedFishIds);assert.equal((await pond()).styleId,archived.styleId);
    assert.equal(await page.locator('[data-fishing-action="pond-style"]').count(),0,'archived theme stays sealed');assert.equal(await wallet(),archivedBalance);
    const archivedLayout=(await pond()).decorations;await decoratingScreenshot('pond-collected-decorating.png');
    await page.reload();await saved();await quietLayout();await page.click('#nav-ponds');await page.locator('[data-fishing-action="select-pond"][data-value="pond_starter"]').click();await sceneryReady();
    assert.deepEqual((await pond()).decorations,archivedLayout);assert.deepEqual((await pond()).fishIds,archived.fishIds);
    for(const [file,width,height]of [['pond-decor-v2.png',1448,1086],['rods-model-v1.png',1500,2000],['fish-model-v1.png',5*328,Math.ceil(F.catalog.fish.length/5)*216],['baits-v1.png',1536,1024]]){
      const atlas=await page.request.get(origin+'/fishing-art/'+file);assert.equal(atlas.status(),200);assert.match(atlas.headers()['content-type'],/^image\/png/);
      const png=await atlas.body();assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),width,file+' full sprite width');assert.equal(png.readUInt32BE(20),height,file+' full sprite height');
    }
    await page.click('#nav-rods');await scrollHeading('rods');await screenshot('rods.png');
    assert.equal(await page.locator('.fishing-rod-feature svg[data-rod-id]').count(),1,'the equipped rod hero contains one cropped rod');
    await page.locator('[data-fishing-action="equip-rod"][data-value="'+fixtureRod.rod.id+'"]').click();await saved();
    assert.equal(await page.locator('.fishing-rod-feature svg[data-rod-id]').getAttribute('data-rod-id'),fixtureRod.rod.id);
    await scrollHeading('rods');await screenshot('rods-legendary.png');
    for(const family of ['fantasy','xianxia']){
      await page.locator('[data-fishing-action="filter"][data-value="'+family+'"]').click();
      assert.deepEqual(await page.locator('.fishing-rod-grid svg[data-rod-id]').evaluateAll(items=>items.map(item=>item.dataset.rodId)),F.catalog.rods.filter(rod=>rod.family===family).map(rod=>rod.id));
      await page.setViewportSize({width:1500,height:1550});await page.locator('.fishing-filters').scrollIntoViewIfNeeded();await screenshot('rods-'+family+'.png');
    }
    await page.setViewportSize({width:1500,height:1050});await page.locator('[data-fishing-action="filter"][data-value="all"]').click();
    await page.locator('[data-fishing-action="equip-rod"][data-value="bamboo"]').click();await saved();
    await page.locator('[data-fishing-action="open-shop"]').first().click();await page.locator('.store-fishing:not([hidden])').waitFor();
    await browseBaits(shopBox());await shopBox().scrollIntoViewIfNeeded();await screenshot('tackle-shop.png');
    await page.locator('[data-fishing-action="buy-box"]').click();await page.locator('.fishing-reveal').waitFor();await saved();
    await screenshot('blind-box.png',{fullPage:false});await page.locator('.fishing-reveal [data-close]').click();
    await failedBoxRetry('buy-bait');await failedBoxRetry('buy-box');
    await selectBait(shopBox(),'stardust');await shopBox().locator('.fishing-tackle-primary[data-tackle-action="buy-bait"]').click();await saved();
    const frost=F.catalog.baits.find(b=>b.id==='frost'),beforeFrost=await tackleState();assert.equal(beforeFrost.baits.frost,0);
    await selectBait(shopBox(),'frost');await shopBox().locator('.fishing-tackle-primary[data-tackle-action="buy-bait"]').click();await saved();
    const boughtFrost=await tackleState();assert.equal(boughtFrost.baits.frost,frost.quantity);assert.equal(boughtFrost.balance,beforeFrost.balance-frost.price);assert.equal(boughtFrost.equipped,beforeFrost.equipped);
    await screenshot('shop.png');
    await page.click('#nav-cabin');await scrollHeading('cabin');await screenshot('aquarium.png');
    await browseBaits(aquariumBox());await selectBait(aquariumBox(),'frost');
    holdNextWrite=true;await aquariumBox().locator('.fishing-tackle-primary[data-tackle-action="equip-bait"]').click();
    await page.waitForFunction(()=>Tracer.fishing.snapshot().busy&&Tracer.store.inflight);assert(releaseWrite,'equipment save is held');
    await selectBait(aquariumBox(),'grain');assert.equal(await aquariumBox().locator('.fishing-tackle-primary').isDisabled(),true,'save busy blocks a second equip');
    releaseWrite();await saved();assert.equal((await tackleState()).equipped,'frost');assert.equal(await wallet(),boughtFrost.balance,'equipping has no coin cost');
    await selectBait(aquariumBox(),'glow');assert.equal((await tackleState()).baits.glow,0);await aquariumBox().locator('.fishing-tackle-primary[data-tackle-action="open-shop"]').click();
    await shopBox().waitFor();assert.equal(await shopBox().locator('.fishing-tackle-bay').getAttribute('data-selected-bait'),'glow','restocking opens the requested empty compartment');
    const beforeGlow=await tackleState(),glow=F.catalog.baits.find(b=>b.id==='glow');await shopBox().locator('.fishing-tackle-primary[data-tackle-action="buy-bait"]').click();await saved();
    assert.equal((await tackleState()).baits.glow,glow.quantity);assert.equal(await wallet(),beforeGlow.balance-glow.price);assert.equal((await tackleState()).equipped,'frost');
    await page.click('#nav-cabin');await selectBait(aquariumBox(),'glow');await aquariumBox().locator('.fishing-tackle-primary[data-tackle-action="equip-bait"]').click();await saved();assert.equal((await tackleState()).equipped,'glow');
    await selectBait(aquariumBox(),'worm');await aquariumBox().locator('.fishing-tackle-primary[data-tackle-action="equip-bait"]').click();await saved();
    await aquariumBox().scrollIntoViewIfNeeded();await screenshot('tackle-inventory.png');
    assert.equal(await page.locator('.fishing-aquarium-feature').count(),1);
    assert.equal(await page.locator('[data-fishing-action="buy-cabin"],[data-fishing-action="equip-cabin"]').count(),0,'retired cabin purchases are absent');
    assert.equal(await page.locator('.fishing-journal-card').count(),F.catalog.fish.length);
    assert.deepEqual(await page.locator('.fishing-journal-card svg[data-species]').evaluateAll(items=>items.map(item=>item.dataset.species)),F.catalog.fish.map(fish=>fish.id));
    await page.setViewportSize({width:1500,height:1700});await page.locator('.fishing-journal-grid').scrollIntoViewIfNeeded();await screenshot('fish-journal.png');
    for(const species of ['seahorse','angelfish','moonfin','dragonkoi']){
      const card=page.locator('.fishing-journal-card').filter({has:page.locator('svg[data-species="'+species+'"]')});await card.scrollIntoViewIfNeeded();
      await card.screenshot({path:path.join(folder,'fish-'+species+'.png')});
    }
    await page.setViewportSize({width:1500,height:1050});
    const catches=await page.evaluate(()=>TracerFishingModel.read(Tracer.store.data).catches.length);
    await page.locator('[data-fishing-action="open-game"]').first().click();const castButton=page.locator('.fishing-game-action');
    assert.equal(await page.locator('.fishing-modal select').count(),0,'the game uses a illustrated rig and tackle box');
    await page.locator('.fishing-rig-choice[data-rig="bait"]').click();await browseBaits(modalBox());
    await selectBait(modalBox(),'grain');const modalWallet=await wallet();await modalBox().locator('.fishing-tackle-primary[data-tackle-action="equip-bait"]').click();await saved();assert.equal((await tackleState()).equipped,'grain');assert.equal(await wallet(),modalWallet);
    await selectBait(modalBox(),'worm');await modalBox().locator('.fishing-tackle-primary[data-tackle-action="equip-bait"]').click();await saved();
    await screenshot('tackle-modal.png',{fullPage:false});await page.locator('[data-close-rig]').click();
    const initialBaits=(await tackleState()).baits.worm;
    const castToWaiting=async()=>{
      if(await page.locator('.fishing-rig-choice[data-rig="bait"]').getAttribute('aria-expanded')!=='true')await page.locator('.fishing-rig-choice[data-rig="bait"]').click();
      await selectBait(modalBox(),'grain');assert.equal(await modalBox().locator('.fishing-tackle-primary').isDisabled(),false);
      await castButton.hover();await page.mouse.down();await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='charging');
      assert.equal(await modalBox().locator('.fishing-tackle-primary').isDisabled(),true,'charging immediately locks a different bait');
      await page.waitForTimeout(700);await page.mouse.up();await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='waiting');await page.locator('[data-close-rig]').click();
    };
    const castToBite=async()=>{await castToWaiting();await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='bite');assert.equal(await castButton.isDisabled(),false,'a bite offers a working hook');};
    await castToWaiting();await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='waiting'&&Tracer.fishing.snapshot().session.nibble>.2);
    await page.screenshot({path:path.join(folder,'fishing-nibble.png'),fullPage:false});await castButton.click();
    await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='escaped');assert.equal(await page.evaluate(()=>Tracer.fishing.snapshot().session.reason),'early-hook');
    assert.equal((await tackleState()).baits.worm,initialBaits-1);assert.equal(await page.evaluate(()=>TracerFishingModel.read(Tracer.store.data).catches.length),catches);
    await page.locator('.fishing-rig-choice[data-rig="bait"]').click();await selectBait(modalBox(),'grain');assert.equal(await modalBox().locator('.fishing-tackle-primary').isDisabled(),false,'early-hook reopens rig changes');await page.locator('[data-close-rig]').click();
    await screenshot('fishing-early-hook.png',{fullPage:false});
    await castToWaiting();await page.locator('.fishing-rig-choice[data-rig="bait"]').click();await selectBait(modalBox(),'grain');
    assert.equal(await modalBox().locator('.fishing-tackle-primary').isDisabled(),true,'the live cast locks bait changes');assert.equal((await tackleState()).equipped,'worm');await page.locator('[data-close-rig]').click();
    await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='bite');
    await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='escaped',null,{timeout:3000});
    assert.equal(await page.evaluate(()=>Tracer.fishing.snapshot().session.reason),'missed-bite');
    assert.equal(await page.evaluate(()=>TracerFishingModel.read(Tracer.store.data).catches.length),catches,'ignoring a bite grants no fish');
    await page.locator('.fishing-rig-choice[data-rig="bait"]').click();await selectBait(modalBox(),'grain');assert.equal(await modalBox().locator('.fishing-tackle-primary').isDisabled(),false,'missed bite reopens rig changes');await page.locator('[data-close-rig]').click();
    await screenshot('fishing-missed-bite.png',{fullPage:false});
    await castToBite();
    const float=await page.locator('.fishing-game-bobber').boundingBox();assert(float);await page.mouse.click(float.x+float.width/2,float.y+float.height/2);
    await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='reeling',null,{timeout:1000});
    await page.evaluate(()=>{window.fishingQaSamples=[];window.fishingQaReel=setInterval(()=>{const s=Tracer.fishing.snapshot().session;if(s?.phase==='reeling'){window.fishingQaSamples.push({behavior:s.fishBehavior,stamina:s.stamina,tension:s.tension});Tracer.fishing.action(s.fishPosition>s.barPosition?'reel-start':'reel-release');}else if(s?.phase==='caught'||s?.phase==='escaped')clearInterval(window.fishingQaReel);},20);});
    await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='caught',null,{timeout:45000});await saved();
    assert.equal(await page.evaluate(()=>TracerFishingModel.read(Tracer.store.data).catches.length),catches+1);
    assert.equal((await tackleState()).baits.worm,initialBaits-3,'early, missed and successful casts each consume exactly one bait');
    const reelState=await page.evaluate(()=>({stamina:Tracer.fishing.snapshot().session.stamina,behaviors:[...new Set(window.fishingQaSamples.map(s=>s.behavior))],first:window.fishingQaSamples[0].stamina,last:window.fishingQaSamples.at(-1).stamina}));
    assert.equal(reelState.stamina,0);assert.deepEqual(reelState.behaviors,['cruise','surge','rest']);assert(reelState.last<reelState.first);
    await screenshot('fishing-catch.png',{fullPage:false});
    // Keep the complete mouse round above and exercise actual trusted F events
    // through the production keyboard handlers in a separate successful cast.
    await page.waitForFunction(()=>Tracer.fishing.snapshot().recastRemaining===0);
    await page.locator('.fishing-game').focus();
    await page.keyboard.down('f');await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='charging');
    await page.waitForTimeout(700);
    const keyboardCharge=await page.evaluate(()=>Tracer.fishing.snapshot().session.castPower);
    assert(keyboardCharge>.35,'holding F charges the cast');
    await page.keyboard.up('f');await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='waiting');
    assert.equal((await tackleState()).baits.worm,initialBaits-4,'F release commits exactly one additional bait');
    await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='bite');
    await page.keyboard.press('f');await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='reeling',null,{timeout:1000});
    const barBeforeF=await page.evaluate(()=>Tracer.fishing.snapshot().session.barPosition);
    await page.keyboard.down('f');await page.waitForTimeout(180);
    const barHeldF=await page.evaluate(()=>({position:Tracer.fishing.snapshot().session.barPosition,holding:Tracer.fishing.snapshot().session.holding}));
    assert.equal(barHeldF.holding,true,'F keydown holds the control bar');assert(barHeldF.position>barBeforeF,'holding F moves the control bar upward');
    await page.keyboard.up('f');await page.waitForTimeout(180);
    const barReleasedF=await page.evaluate(()=>({position:Tracer.fishing.snapshot().session.barPosition,holding:Tracer.fishing.snapshot().session.holding}));
    assert.equal(barReleasedF.holding,false,'F keyup releases the control bar');assert(barReleasedF.position<barHeldF.position,'releasing F lets the control bar fall');
    await screenshot('fishing-keyboard-reeling.png',{fullPage:false});
    let keyboardHolding=false,keyboardDowns=1,keyboardUps=1;
    const keyboardSamples=[],keyboardStarted=Date.now();
    try{
      while(Date.now()-keyboardStarted<45000){
        const s=await page.evaluate(()=>{const s=Tracer.fishing.snapshot().session;return{phase:s.phase,fishPosition:s.fishPosition,barPosition:s.barPosition,holding:s.holding,behavior:s.fishBehavior,stamina:s.stamina,reason:s.reason};});
        if(s.phase==='caught')break;
        assert.equal(s.phase,'reeling','F fishing stays active until caught: '+(s.reason||s.phase));keyboardSamples.push(s);
        const nextHolding=s.fishPosition>s.barPosition;
        if(nextHolding!==keyboardHolding){if(nextHolding){await page.keyboard.down('f');keyboardDowns++;}else{await page.keyboard.up('f');keyboardUps++;}keyboardHolding=nextHolding;}
        await page.waitForTimeout(25);
      }
    }finally{await page.keyboard.up('f');}
    await page.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='caught',null,{timeout:1000});await saved();
    assert.equal(await page.evaluate(()=>TracerFishingModel.read(Tracer.store.data).catches.length),catches+2,'mouse and F rounds each reward one caught fish');
    assert.equal((await tackleState()).baits.worm,initialBaits-4,'four casts consume four baits across mouse and F');
    assert(keyboardDowns>1&&keyboardUps>1,'the successful F round includes repeated real key holds and releases');
    const keyboardState={chargePower:keyboardCharge,barBefore:barBeforeF,barHeld:barHeldF.position,barReleased:barReleasedF.position,keyDowns:keyboardDowns,keyUps:keyboardUps,stamina:await page.evaluate(()=>Tracer.fishing.snapshot().session.stamina),behaviors:[...new Set(keyboardSamples.map(s=>s.behavior))]};
    assert.equal(keyboardState.stamina,0,'F controls exhaust the caught fish');
    await screenshot('fishing-keyboard-catch.png',{fullPage:false});await page.locator('.fishing-modal [data-close]').click();
    for(const language of ['zh','en'])for(const width of [1500,390]){
      await page.setViewportSize({width,height:1050});await page.selectOption('#language-select',language);
      for(const section of ['ponds','rods','cabin']){await page.click('#nav-'+section);await scrollHeading(section);const overflow=await page.locator('.fishing-page').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,page:document.documentElement.scrollWidth,viewport:innerWidth}));assert(overflow.scroll<=overflow.width+1&&overflow.page<=overflow.viewport+1,section+' '+JSON.stringify(overflow));await screenshot(section+'-'+language+'-'+width+'.png');}
    }
    await page.selectOption('#language-select','en');await page.locator('[data-fishing-action="open-game"]').first().click();await page.locator('.fishing-rig-choice[data-rig="bait"]').click();
    await modalBox().scrollIntoViewIfNeeded();const modalOverflow=await page.locator('.fishing-modal').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert(modalOverflow.scroll<=modalOverflow.width+1);await screenshot('tackle-modal-en-390.png',{fullPage:false});await page.locator('.fishing-modal [data-close]').click();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);assert.equal(injectedFaults.length,2);assert(injectedFaults.every(([status])=>status===500));
    fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify({passed:true,checks:['free pond and archived decoration drag','four active PNG atlases',F.catalog.fish.length+' species journal and legendary aquarium','legendary rods and family catalogs','saved-draw retries charge once','seven baits browse without buying or equipping','confirmed equipment and purchases','empty stock opens the matching shop compartment','equipment is locked during saving and charging','early and missed hooks unlock equipment without fish rewards','one bait consumed per cast','all fish behaviors and exhausted successful catch','real F charge, release, hook, hold/release bar movement and successful catch','bilingual wide and narrow layouts with illustrated modal'],javascriptErrors:errors,failedRequests:failed,externalRequests:external,injectedSaveFailures:injectedFaults.length,reelState,keyboardState,artifacts:fs.readdirSync(folder).filter(file=>file.endsWith('.png'))},null,2));
    console.log('PASS 12 free decoration props and real archived drag, four PNG atlases, '+F.catalog.fish.length+' species journal, legendary aquarium and advanced rods, save/reload and failed-draw single-charge retries, seven-bait tackle browsing without spend/equip, confirmed purchases/equip, empty restock targeting, busy and live rig locks, early-nibble and missed-bite escape without rewards, direct mouse float hook plus real F charge/hook/hold/release and two exhausted catches, exactly one bait per cast, illustrated modal and bilingual responsive layouts.');console.log('Artifacts: '+folder);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);console.error('Artifacts: '+folder);process.exitCode=1;});
