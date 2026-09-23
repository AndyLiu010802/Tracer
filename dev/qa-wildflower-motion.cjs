'use strict';
// Production garden view/player with isolated, synthetic progress snapshots.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
(async()=>{
  const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/wildflower-motion-'));fs.mkdirSync(path.join(folder,'data'));
  Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(folder,'data'),DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
  const {server}=require('../server');await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1600},serviceWorkers:'block'});
    const errors=[],requests=[];await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();if(u.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});if(/wildflower-(normal|shiny)-.+-v1.png/.test(u.pathname))requests.push(u.pathname);return route.continue();});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.waitForFunction(()=>!!window.TracerGardenHomeView);
    await page.evaluate(()=>{
      const host=document.createElement('main');host.id='qa-wildflower';host.style.cssText='position:fixed;inset:0;overflow:auto;background:#101615;z-index:99999';document.body.appendChild(host);
      const view=TracerGardenHomeView(host,()=>{}),pet=TracerPetModel.gardenPets.find(p=>p.id==='garden_wildflower_shiny');
      const snapshot={language:'zh',pet,plots:[['normal','rare'],['shiny','shiny'],['plant','normal']].map(([id,rarity])=>({projectId:id,name:{normal:'花团的小花圃',shiny:'星光花团',plant:'普通野花'}[id],plant:'wildflower',stage:4,completedCount:1,done:1,total:1,focusMinutes:0,growth:{bond:0,progress:1,remaining:0},harvest:{rarity,harvestedAt:1}})),today:{tasks:1,minutes:0}};
      window.__qa={host,view,snapshot};view.update(snapshot);
    });
    const update=changes=>page.evaluate(changes=>{const q=window.__qa;Object.assign(q.snapshot,changes);q.view.update(q.snapshot);},changes);
    await page.waitForFunction(()=>document.querySelectorAll('#qa-wildflower [data-motion="ready"]').length===5);
    assert.equal(await page.locator('#qa-wildflower [data-action="celebrate"]').count(),0,'initial progress does not celebrate');
    assert.equal(await page.locator('[data-project-id="plant"].garden-world-plot .garden-wildflower-motion').count(),0,'normal plants never animate a face');
    const first=page.locator('.garden-world-plot[data-project-id="normal"]'),sprite=first.locator('.garden-plant-sprite');
    await first.click();await page.waitForFunction(()=>document.querySelector('.garden-world-plot[data-project-id="normal"] .garden-plant-sprite').dataset.motionClip==='greet');
    assert.equal(await sprite.getAttribute('data-frames'),'16');
    const raised=Number(await sprite.getAttribute('data-frame'));await page.locator('.garden-task-plant-card[data-task-id="normal"] [data-plant-care="greet"]').click();
    assert.ok(Number(await sprite.getAttribute('data-frame'))>=raised,'repeated greeting does not reset a running clip');
    await page.waitForFunction(()=>document.querySelector('.garden-world-plot[data-project-id="normal"] .garden-plant-sprite').dataset.action==='idle');
    assert.equal(await page.locator('.garden-home-companion-art .garden-plant-sprite').getAttribute('data-action'),'idle','resident greeting also finishes once');
    console.log('PASS loaded actual normal/shiny frames, independent greeting and natural finish');
    await page.evaluate(()=>{const q=__qa;q.snapshot.plots[0].completedCount=2;q.snapshot.error='test save failure';q.view.update(q.snapshot);});
    assert.equal(await page.locator('#qa-wildflower [data-action="celebrate"]').count(),0);
    await update({error:''});assert.equal(await page.locator('#qa-wildflower [data-action="celebrate"]').count(),3,'one successful task increment celebrates in plot, portrait and resident');
    await page.waitForFunction(()=>Number(document.querySelector('.garden-world-plot[data-project-id="normal"] .garden-plant-sprite').dataset.frame)>2);
    const before=Number(await sprite.getAttribute('data-frame'));await update({});assert.ok(Number(await sprite.getAttribute('data-frame'))>=before,'snapshot refresh preserves the running celebration');
    await page.evaluate(()=>{const q=__qa;q.snapshot.focus={running:true};q.snapshot.plots[0].activeFocus=true;q.view.update(q.snapshot);});
    assert.equal(await sprite.getAttribute('data-action'),'focus');assert.equal(await page.locator('.garden-task-plant-card[data-task-id="normal"] .garden-world-portrait .garden-plant-sprite').getAttribute('data-action'),'focus');
    assert.equal(await page.locator('.garden-task-plant-card[data-task-id="normal"] [data-plant-care="greet"]').isDisabled(),true);
    await page.evaluate(()=>{const q=__qa;q.snapshot.plots[0].completedCount=3;q.view.update(q.snapshot);q.snapshot.focus=null;q.snapshot.plots[0].activeFocus=false;q.view.update(q.snapshot);});
    assert.equal(await page.locator('#qa-wildflower [data-action="celebrate"]').count(),0,'focus-period progress is not queued for later');
    await first.click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.garden-world-plot[data-project-id="normal"] .garden-plant-sprite').dataset.playback==='reduced');
    assert.equal(await sprite.getAttribute('data-action'),'idle');assert.equal(await sprite.getAttribute('data-playback'),'reduced');
    await page.emulateMedia({reducedMotion:'no-preference'});assert.equal(await sprite.getAttribute('data-action'),'idle','old greeting never resumes after reduce');
    console.log('PASS committed progress only, no duplicate celebration, focus priority and reduced-motion cancellation');
    await page.evaluate(()=>{const q=__qa;q.snapshot.plots.reverse();q.view.update(q.snapshot);});
    assert.equal(await page.locator('#qa-wildflower [data-action="celebrate"]').count(),0,'reordering projects does not replay achievements');
    await page.locator('.garden-world-plot[data-project-id="shiny"]').click();await page.waitForFunction(()=>document.querySelector('.garden-world-plot[data-project-id="shiny"] .garden-plant-sprite').dataset.motionClip==='greet');
    await page.screenshot({path:path.join(folder,'wildflower-in-garden.png'),animations:'disabled'});
    // A review board uses the exact production frame renderer. It is not a
    // replacement image or a synthetic stand-in for the sprites under test.
    await page.evaluate(()=>{
      __qa.view.destroy();__qa.host.remove();const host=document.createElement('section');host.id='qa-frame-review';host.style.cssText='position:fixed;inset:0;background:#17221b;z-index:99999;padding:28px;color:#dce6ce;font-family:system-ui;overflow:auto';
      host.innerHTML='<h1 style="margin:0 0 6px;font-size:25px">花团 · 第一轮动作精修</h1><p style="color:#9fb291;margin:0 0 22px">待机眨眼 · 抬手招呼 · 完成庆祝</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px"></div>';
      document.body.appendChild(host);window.__review=[];for(const shiny of [false,true])for(const [action,label,at]of [['idle','待机 · 轻轻眨眼',3200],['greet','招呼 · 向你挥手',600],['celebrate','庆祝 · 为你开心',650]]){
        const card=document.createElement('article');card.style.cssText='border:1px solid #9aac6c44;border-radius:18px;padding:18px;background:#202c22;text-align:center';const title=document.createElement('div');title.textContent=(shiny?'闪光花团':'花团')+' / '+label;title.style.fontSize='14px';card.appendChild(title);const element=document.createElement('span');element.className='garden-plant-sprite';element.dataset.shiny=String(shiny);element.style.cssText='display:block;width:270px;height:297px;margin:12px auto';card.appendChild(element);host.querySelector('div').appendChild(card);const layer=TracerGardenWildflowerMotion.create(element,{kind:'wildflower',stage:4,rare:true,shiny,onReady:()=>layer.render(action,at,false)});__review.push(layer);
      }
    });
    await page.waitForFunction(()=>document.querySelectorAll('#qa-frame-review [data-motion="ready"]').length===6);await page.screenshot({path:path.join(folder,'wildflower-motion-preview.png')});
    await page.evaluate(()=>{__review.forEach(p=>p.destroy());document.getElementById('qa-frame-review').remove();});
    assert.deepEqual(errors,[]);assert.equal(new Set(requests).size,6);assert.equal(requests.length,6,'all players share the six decoded sheets');
    console.log('PASS project identity isolation, illustration review board, shared loading, cleanup');console.log('Artifacts: '+folder);
  }catch(error){console.error('Artifacts: '+folder);const page=browser?.contexts()[0]?.pages()[0];await page?.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});throw error;}
  finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
