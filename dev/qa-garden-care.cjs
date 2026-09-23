'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const output=fs.mkdtempSync(path.join(__dirname,'../.cache/garden-care-'));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(output,'data'),DOCS_PORTAL_STATE_FILE:path.join(output,'state.json')});
const {server}=require('../server');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1100,height:1100}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?sec=garden');
    await page.waitForFunction(()=>window.TracerGardenWorldView);
    await page.evaluate(()=>{
      const host=document.createElement('section');host.id='care-qa';host.className='garden-home';host.style.cssText='position:fixed;inset:0;overflow:auto;z-index:99999;padding:0;border-radius:0';document.body.appendChild(host);
      window.careEvents=[];window.careView=TracerGardenWorldView(host,null,(...args)=>careEvents.push(args));
      window.careSnapshot={language:'zh',plots:['wildflower','sunflower','lavender','apple','peach'].map((plant,i)=>({projectId:'care-'+i,name:['一颗新种子','窗边的向日葵','午后的薰衣草','慢慢长大的苹果树','春日桃花'][i],plant,stage:i===0?0:4,harvest:{rarity:'normal'}}))};careView.update(careSnapshot);
    });
    const host=page.locator('#care-qa'),card=host.locator('.garden-task-plant-card').first();
    await page.waitForFunction(()=>document.querySelector('#care-qa .garden-world').dataset.art==='ready');
    await host.locator('.garden-world-surface').screenshot({path:path.join(output,'soil-seeds-desktop.png')});
    const baseline=await card.locator('.garden-plant-sprite').boundingBox();
    for(const action of ['water','music','breeze']){
      await card.locator('[data-plant-care="'+action+'"]').click();
      assert.equal(await host.locator('[data-interaction="'+action+'"] svg').count()>0,true);
      await page.waitForTimeout(1100);
      const box=await card.locator('.garden-plant-sprite').boundingBox();
      assert.equal(box.x,baseline.x);assert.equal(box.width,baseline.width);
      const body=await card.locator('[data-plant-part="body"]').evaluate(el=>getComputedStyle(el).transform);
      assert.ok(body==='none'||body==='matrix(1, 0, 0, 1, 0, 0)',body);
      await card.screenshot({path:path.join(output,action+'-card.png')});
      await page.evaluate(()=>document.getElementById('care-qa').scrollTop=0);
      await host.locator('.garden-world-surface').screenshot({path:path.join(output,action+'-scene.png')});
    }
    await page.waitForTimeout(3700);assert.equal(await host.locator('.garden-world-effects svg,.garden-card-effects svg').count(),0);
    await card.locator('[data-plant-care="water"]').click();
    await page.evaluate(()=>{window.activeCareSvg=document.querySelector('#care-qa .garden-card-effects svg');});
    await card.locator('[data-plant-care="water"]').click();
    assert.ok(await page.evaluate(()=>activeCareSvg===document.querySelector('#care-qa .garden-card-effects svg')),'repeated clicks do not stack or restart the effect');
    await page.evaluate(()=>careView.select('care-1'));
    assert.equal(await host.locator('[data-interaction]').count(),0,'changing selection clears previous care');
    await page.evaluate(()=>careView.select('care-0'));
    await card.locator('[data-plant-care="water"]').click();
    await page.evaluate(()=>{careSnapshot.plots[0].activeFocus=true;careView.update(careSnapshot);});
    assert.equal(await host.locator('[data-interaction]').count(),0);assert.equal(await card.locator('[data-plant-care="water"]').isDisabled(),true);
    await page.evaluate(()=>{careSnapshot.plots[0].activeFocus=false;careView.update(careSnapshot);});
    await page.emulateMedia({reducedMotion:'reduce'});
    await card.locator('[data-plant-care="water"]').click();
    assert.equal(await card.locator('.care-water-can').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.waitForTimeout(1500);assert.equal(await host.locator('[data-interaction]').count(),0);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:390,height:1000});
    await page.evaluate(()=>document.getElementById('care-qa').scrollTop=0);
    await host.locator('.garden-world-surface').screenshot({path:path.join(output,'soil-seeds-mobile.png')});
    assert.ok(await host.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await page.evaluate(()=>{careSnapshot.economy={equippedFarmId:'cyber'};careView.update(careSnapshot);});
    await page.waitForFunction(()=>document.querySelector('#care-qa .garden-world').dataset.art==='ready');
    await host.locator('.garden-world-surface').screenshot({path:path.join(output,'soil-cyber-mobile.png')});
    await card.locator('[data-plant-care="music"]').click();
    await page.evaluate(()=>{careSnapshot.plots.shift();careView.update(careSnapshot);});
    assert.equal(await host.locator('[data-interaction]').count(),0);
    assert.deepEqual(errors,[]);await page.evaluate(()=>careView.destroy());
    console.log('PASS care effects, stable seed anchor, focus cancellation, reduced motion, cleanup, mobile and both farms.\nScreenshots: '+output);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
