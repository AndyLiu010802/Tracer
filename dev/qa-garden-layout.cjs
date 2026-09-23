'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const output=fs.mkdtempSync(path.join(__dirname,'../.cache/garden-layout-'));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(output,'data'),DOCS_PORTAL_STATE_FILE:path.join(output,'state.json')});const {server}=require('../server');
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1100,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/?sec=garden');await page.waitForFunction(()=>Tracer.store.base&&TracerGardenHomeView);
  await page.evaluate(()=>{const host=document.createElement('section');host.id='layout-qa';host.style.cssText='position:fixed;inset:0;overflow:auto;z-index:99999;background:#18241f';document.body.appendChild(host);
   window.layoutSnapshot={language:'zh',pet:TracerPetModel.catalog(TracerPetModel.fresh())[0],petSleeping:true,companionPlacement:{x:66.5,y:43.5,scale:1,visible:true,flip:false},economy:{equippedFarmId:'meadow'},collectibles:TaskGarden.collectibles(Tracer.store.base)};
   window.layoutView=TracerGardenHomeView(host,(type,value)=>{if(type==='layout-companion'){Object.assign(layoutSnapshot.companionPlacement,value);layoutView.update(layoutSnapshot);}});layoutView.update(layoutSnapshot);
  });
  const host=page.locator('#layout-qa'),surface=host.locator('.garden-world-surface'),resident=host.locator('.garden-home-companion'),hud=host.locator('.garden-layout-floating');
  await host.locator('.garden-layout-toolbar>button').click();await host.locator('.garden-layout-picker').selectOption('__companion__');
  async function check(label){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const boxes=await host.evaluate(h=>{const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};return{pet:rect(h.querySelector('.garden-home-companion')),art:rect(h.querySelector('.garden-home-companion-art .garden-companion-motion')),caption:rect(h.querySelector('.garden-home-companion-caption')),hud:rect(h.querySelector('.garden-layout-floating')),surface:rect(h.querySelector('.garden-world-surface')),docked:h.querySelector('.garden-layout-floating').dataset.docked};});
   const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.5;
   assert.ok(Math.abs(boxes.art.w-boxes.pet.w)<1&&Math.abs(boxes.art.h-boxes.pet.h)<1,label+': artwork must fit hit box');assert.ok(!overlap(boxes.pet,boxes.caption),label+': caption must not cover pet');assert.ok(!overlap(boxes.pet,boxes.hud)&&!overlap(boxes.caption,boxes.hud),label+': controls must not cover pet or label');assert.ok(boxes.hud.x>=-1&&boxes.hud.x+boxes.hud.w<=await page.evaluate(()=>innerWidth)+1,label+': reachable controls');if(boxes.surface.w<=540)assert.equal(boxes.docked,'true');return boxes;
  }
  for(const id of ['sprout','miso','brook','ember','luna','nova']){
   await page.evaluate(id=>{layoutSnapshot.pet=TracerPetModel.catalog(TracerPetModel.fresh()).find(p=>p.id===id);layoutView.update(layoutSnapshot);},id);
   await page.waitForFunction(()=>document.querySelector('#layout-qa .garden-home-companion .pet-illustrated-sprite')?.dataset.motion==='ready');await check(id+' sleeping');
  }
  await page.evaluate(()=>{layoutSnapshot.pet=TracerPetModel.catalog(TracerPetModel.fresh())[0];layoutView.update(layoutSnapshot);});await page.waitForFunction(()=>document.querySelector('#layout-qa .garden-home-companion .pet-illustrated-sprite')?.dataset.motion==='ready');
  for(const width of [1100,768,390,320]){await page.setViewportSize({width,height:1100});for(const farm of ['meadow','cyber'])for(const [x,y,scale]of [[66.5,43.5,1],[5,20,1.8],[95,90,.6]]){await page.evaluate(({farm,x,y,scale})=>{layoutSnapshot.economy.equippedFarmId=farm;Object.assign(layoutSnapshot.companionPlacement,{x,y,scale});layoutView.update(layoutSnapshot);},{farm,x,y,scale});await check(width+' '+farm+' '+x+','+y);}}
  await page.setViewportSize({width:1100,height:1100});await page.evaluate(()=>{layoutSnapshot.economy.equippedFarmId='meadow';Object.assign(layoutSnapshot.companionPlacement,{x:66.5,y:43.5,scale:1});layoutView.update(layoutSnapshot);});await resident.scrollIntoViewIfNeeded();let b=await resident.boundingBox();await page.mouse.move(b.x+b.width*.35,b.y+b.height*.45);await page.mouse.down();await page.mouse.move(b.x+b.width*.35-44,b.y+b.height*.45+17,{steps:5});let moved=await resident.boundingBox();assert.ok(Math.abs(moved.x-b.x+44)<1&&Math.abs(moved.y-b.y-17)<1);await check('drag');await page.keyboard.press('Escape');await page.mouse.up();const restored=await resident.boundingBox();assert.ok(Math.abs(restored.x-b.x)<1&&Math.abs(restored.y-b.y)<1);
  await surface.screenshot({path:path.join(output,'companion-layout-desktop.png')});await host.locator('.garden-layout-toolbar>button').click();await surface.screenshot({path:path.join(output,'companion-label.png')});await host.locator('.garden-layout-toolbar>button').click();await page.setViewportSize({width:390,height:1000});await hud.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'companion-layout-mobile.png')});
  assert.deepEqual(errors,[]);console.log('PASS: all six sleeping companions fit hit boxes; labels and controls do not overlap, four widths, two farms, edge placements, scaling, anchored drag and Escape. Screenshots: '+output);
 }catch(e){await page.screenshot({path:path.join(output,'failure.png')});console.log('Failure screenshot: '+output,errors);throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
