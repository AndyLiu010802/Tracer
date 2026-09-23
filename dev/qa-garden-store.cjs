'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const M=require('../skins/tracer/model'),G=require('../public/task-garden');
const output=fs.mkdtempSync(path.join(__dirname,'../.cache/garden-store-')),data=path.join(output,'data');fs.mkdirSync(data);
const ws=M.emptyWorkspace();let counter=0;
function harvest(kind){const task=M.addTask(ws,{title:'收藏测试 '+(++counter)});task.status='doing';G.taskChanged(ws,task,task.updatedAt,n=>n===10000?1000:kind);M.moveTask(ws,task.id,'done');G.harvest(ws,task.id);}
for(let i=0;i<24;i++)harvest(i%6);
for(const row of G.inventory(ws))if(row.available)G.sell(ws,row.plantKind,row.available);
G.buyFarm(ws,'cyber');G.equipFarm(ws,'cyber');for(let i=0;i<60;i++)harvest(i%3);
for(const row of G.inventory(ws))if(row.available)G.sell(ws,row.plantKind,row.available);
G.equipFarm(ws,'meadow');const growing=M.addTask(ws,{title:'把下一个目标种进花园'});M.moveTask(ws,growing.id,'doing');
fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(ws));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(output,'state.json')});
const {server}=require('../server');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];let blocked=false;
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();if(blocked&&u.pathname==='/api/store/workspace'&&r.request().method()==='PUT')return r.fulfill({status:500,json:{error:'qa-failure'}});return r.continue();});
  await page.goto(origin+'/?sec=shop');await page.waitForFunction(()=>window.Tracer?.store?.base);await page.selectOption('#language-select','zh');await page.click('#nav-shop');
  const saved=()=>page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight),collect=()=>page.evaluate(()=>TaskGarden.collectibles(Tracer.store.base)),money=()=>page.evaluate(()=>TaskGarden.economy(Tracer.store.base).balance);
  const card=id=>page.locator('.garden-collect-card[data-item-id='+id+']'),department=id=>page.locator('.store-navigation [data-store-action='+id+']');
  await page.locator('.garden-store').waitFor();
  const art=await page.evaluate(async()=>{const ids=TaskGarden.collectibles(Tracer.store.base).items.map(i=>i.id);return Promise.all(ids.map(async id=>{const holder=document.createElement('div');holder.innerHTML=TracerGardenCollectionArt.markup(id,0);const img=new Image();img.src=holder.querySelector('image').getAttribute('href');await img.decode();return [img.naturalWidth,new Set(Array.from({length:6},(_,i)=>TracerGardenCollectionArt.markup(id,i))).size];}));});assert.ok(art.every(([w,n])=>w===1536&&n===6));
  for(const id of ['book_cabinet','reading_bench','flower_cart']){await page.locator('[data-store-feature='+id+']').click();await page.locator('.garden-collect-detail[open]').waitFor();assert.equal(await page.locator('.garden-collect-detail-art').getAttribute('data-item-id'),id+':0');await page.keyboard.press('Escape');}
  await page.locator('[data-set-id=reading]').click();
  for(const id of ['reading_bench','book_cabinet','wisteria_swing']){await card(id).locator('[data-collect-action=buy]').click();await saved();}
  assert.equal((await collect()).sets.find(s=>s.id==='reading').owned,3);
  await card('reading_bench').locator('[data-collect-action=inspect]').click();const detail=page.locator('.garden-collect-detail');const views=new Set();
  for(let i=0;i<6;i++){views.add(await detail.locator('.garden-collect-detail-art').innerHTML());await detail.locator('[data-collect-action=angle-next]').click();}
  assert.equal(views.size,6);await detail.screenshot({path:path.join(output,'furniture-detail.png')});await page.keyboard.press('Escape');
  await page.locator('.store-top').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'store-desktop.png')});await page.locator('.garden-collect-grid').evaluate(n=>n.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(output,'furniture-cards.png')});
  await department('wallpapers').click();await page.waitForFunction(()=>document.querySelectorAll('.store-wall-card').length===10);
  await page.locator('[data-wallpaper-id=s01]').click();assert.match(await page.locator('[data-store-action=wall-buy]').textContent(),/登录/);await page.keyboard.press('Escape');
  await page.locator('[data-store-action=filter-dynamic]').click();assert.equal(await page.locator('.store-wall-card').count(),10);await page.locator('.store-wall-card').first().click();
  const canvas=page.locator('.store-wall-detail canvas'),frame=await canvas.evaluate(c=>c.toDataURL());await page.waitForTimeout(200);assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),frame);await page.keyboard.press('Escape');
  await department('materials').click();assert.equal(await page.locator('.store-wall-card').count(),10);
  await page.locator('.store-wallpapers').screenshot({path:path.join(output,'materials-desktop.png')});
  await page.click('#nav-garden');assert.equal(await page.locator('.garden-collection-shop').count(),0);
  const toolbar=page.locator('.garden-layout-toolbar'),hud=page.locator('.garden-layout-floating'),tile=id=>page.locator('[data-layout-toggle='+id+']'),placed=id=>page.locator('.garden-world-ornament[data-item-id='+id+']');
  await toolbar.locator('>button').click();await tile('reading_bench').click();await saved();await placed('reading_bench').waitFor();
  for(let i=1;i<=6;i++){await hud.locator('[data-layout-action=rotate-right]').click();await saved();assert.equal((await collect()).placements[0].orientation,i%6);}
  await hud.locator('[data-layout-action=rotate-left]').click();await saved();await hud.locator('[data-layout-action=right]').click();await saved();await hud.locator('[data-layout-action=larger]').click();await saved();
  const before=(await collect()).placements[0];await tile('reading_bench').click();await saved();assert.equal(await placed('reading_bench').count(),0);await tile('reading_bench').click();await saved();assert.equal((await collect()).placements[0].orientation,5);assert.equal((await collect()).placements[0].x,before.x);
  await page.locator('.garden-world').screenshot({path:path.join(output,'layout-six-directions.png')});
  const resident=page.locator('.garden-home-companion'),position=()=>page.evaluate(()=>TaskGarden.companionPlacement(Tracer.store.base));
  await toolbar.locator('select').selectOption('__companion__');await resident.scrollIntoViewIfNeeded();const box=await resident.boundingBox(),previous=await position(),coins=await money();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-70,box.y+box.height/2+30,{steps:5});const moved=await resident.boundingBox();assert.ok(Math.abs(moved.x-box.x+70)<2);assert.ok(Math.abs(moved.y-box.y-30)<2);await page.mouse.up();await saved();assert.notEqual((await position()).x,previous.x);
  await hud.locator('[data-layout-action=flip]').click();await saved();assert.equal((await position()).flip,true);assert.equal(await money(),coins);await tile('__companion__').click();await saved();assert.equal(await resident.isVisible(),false);await tile('__companion__').click();await saved();assert.equal(await resident.isVisible(),true);
  const petPlaced=await position();blocked=true;await hud.locator('[data-layout-action=right]').click();await page.locator('.garden-home-error').waitFor();await page.waitForFunction(()=>!Tracer.store.inflight&&!document.querySelector('.garden-layout-toolbar>button').disabled);assert.equal((await position()).x,petPlaced.x);blocked=false;await page.locator('.garden-home-retry').click();await saved();assert.equal((await position()).x,petPlaced.x+1);
  await page.reload();await saved();assert.equal((await position()).x,petPlaced.x+1);assert.equal((await collect()).placements[0].orientation,5);
  await page.click('#nav-shop');for(const lang of ['zh','en']){await page.selectOption('#language-select',lang);await page.setViewportSize({width:390,height:1000});await page.locator('.store-top').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'store-'+lang+'-mobile.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  for(const width of [320,768]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'store overflow at '+width);}
  await page.setViewportSize({width:1440,height:1100});
  const id=await page.evaluate(async()=>{const r=await TracerAccount.api('register',{email:'store@example.com',password:'Garden store test 123',profile:{nickname:'Store QA'}});TracerAccount.seedLanguage(r.user.id,'zh');return r.user.id;});
  fs.mkdirSync(path.join(data,'.accounts',id,'data'),{recursive:true});fs.writeFileSync(path.join(data,'.accounts',id,'data','workspace.json'),JSON.stringify(ws));
  await page.reload();await page.waitForFunction(()=>TracerAccount.context.user&&Tracer.store.base);await page.click('#nav-shop');const start=await money();
  for(const [dept,filter,id,slot]of [['wallpapers','static','s01','background'],['wallpapers','dynamic','d01','background'],['materials',null,'m04','material']]){
   await department(dept).click();if(filter)await page.locator('[data-store-action=filter-'+filter+']').click();await page.locator('[data-wallpaper-id='+id+']').click();await page.locator('[data-store-action=wall-buy]').click();await page.waitForFunction(id=>Tracer.store.base.taskGarden.market.wallpapers?.purchases.some(p=>p.itemId===id),id);await page.waitForFunction(()=>!document.querySelector('[data-store-action=wall-buy]').disabled);await page.locator('[data-store-action=wall-buy]').click();await page.waitForFunction(({id,slot})=>Tracer.store.base.taskGarden.market.wallpapers.appearance[slot+'ItemId']===id,{id,slot});await page.keyboard.press('Escape');
  }
  assert.equal(await money(),start-560);await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.wallpaperMaterial==='walnut');assert.equal(await page.locator('#account-wallpaper canvas').count(),1);
  await page.click('#nav-shop');await department('wallpapers').click();await page.locator('[data-store-action=filter-owned]').click();assert.equal(await page.locator('.store-wall-card').count(),2);await page.locator('[data-store-action=default-background]').click();await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-account-wallpaper'));
  await page.locator('[data-store-action=default-material]').click();await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-wallpaper-material'));
  assert.deepEqual(errors,[]);console.log('PASS: independent shop, 30 wallpaper/material previews, 6 directions, purchase/equip/wallet, image toggles, companion drag, failed save/retry, persistence, bilingual mobile. Screenshots: '+output);
 }catch(e){console.log('Page errors:',errors);await page.screenshot({path:path.join(output,'failure.png')});console.log('Failure screenshot: '+output);throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
