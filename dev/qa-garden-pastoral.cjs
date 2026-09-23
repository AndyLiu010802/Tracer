'use strict';
// Synthetic local workspace and controlled entropy; no user save or AI request.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const M=require('../skins/tracer/model'),S=require('../public/workspace-sync');
(async()=>{
  const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/garden-pastoral-')),data=path.join(folder,'data');fs.mkdirSync(data);
  const ws=S.empty(),names=['苹果小院','春日花田','樱桃计划','慢慢长大的桃树','阳光向日葵','薰衣草时光'];
  const projects=names.map(name=>M.addProject(ws,{name}));
  projects.forEach((p,i)=>{const t=M.addTask(ws,{title:'完成 '+p.name,projectId:p.id});if(i<3)M.moveTask(ws,t.id,'done');});
  fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(ws));
  Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
  const {server}=require('../server');await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  let browser;const errors=[],external=[];
  try{
    browser=await chromium.launch({channel:process.env.TRACER_QA_BROWSER||'msedge',headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1080},serviceWorkers:'block'});
    await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin){external.push(u.href);return route.abort();}if(u.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});return route.continue();});
    await context.addInitScript(()=>{localStorage.setItem('tracer.language','zh');window.__draws=[100,99,0];window.__drawCount=0;const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=function(array){if(array instanceof Uint32Array&&array.length===1){window.__drawCount++;array[0]=window.__draws.shift()??9999;return array;}return original(array);};});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin);await page.waitForFunction(()=>window.Tracer?.garden&&Tracer.store.data);await page.click('#nav-garden');
    const kinds=['apple','wildflower','cherry','peach','sunflower','lavender'];
    for(let i=0;i<projects.length;i++)await page.evaluate(async({id,kind})=>Tracer.garden.plant(id,kind),{id:projects[i].id,kind:kinds[i]});
    await page.waitForFunction(()=>document.querySelector('.garden-world')?.dataset.art==='ready');
    assert.equal(await page.evaluate(()=>window.__drawCount),3);
    const slot=i=>page.locator('.garden-world-plot[data-project-id="'+projects[i].id+'"]');
    assert.equal(await slot(0).getAttribute('data-rarity'),'normal');assert.equal(await slot(1).getAttribute('data-rarity'),'rare');assert.equal(await slot(2).getAttribute('data-rarity'),'shiny');
    assert.equal(await slot(0).locator('[data-plant-part="face"]').count(),0);assert.equal(await slot(1).locator('[data-plant-part="face"]').count(),1);
    assert.equal(await slot(2).locator('[data-shiny="true"]').count(),1);
    await slot(0).click();assert.equal(await page.locator('.garden-world-care-button[data-interaction="pet"]').isVisible(),false);
    const xp=await page.locator('.garden-world-xp').textContent();
    for(const action of ['water','breeze','music']){
      await page.locator('.garden-world-care-button[data-interaction="'+action+'"]').click();
      assert.equal(await slot(0).getAttribute('data-interaction'),action);
      assert.equal(await page.locator('.garden-world-portrait .garden-plant-sprite').getAttribute('data-frames'),'32');
      await page.waitForFunction(()=>Number(document.querySelector('.garden-world-portrait .garden-plant-sprite').dataset.frame)>0);
    }
    assert.equal(await page.locator('.garden-world-xp').textContent(),xp,'care animations do not award work XP');
    await slot(1).click();await page.locator('.garden-world-care-button[data-interaction="pet"]').click();assert.equal(await slot(1).getAttribute('data-interaction'),'pet');
    // A failed receipt save cannot grant a companion. Retrying uses the already
    // persisted maturity ticket; it does not call the random source again.
    await page.evaluate(()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='tracer.garden.harvest.v1')throw new DOMException('quota','QuotaExceededError');return window.__set.call(this,key,value);};});
    await page.locator('.garden-world-harvest').click();await page.locator('.garden-home-error').waitFor();
    assert.equal(await page.evaluate(()=>Tracer.pet.read().unlocked.includes('garden_wildflower')),false);
    await page.evaluate(()=>{Storage.prototype.setItem=window.__set;});
    await page.locator('.garden-world-harvest').click();await page.waitForFunction(()=>Tracer.pet.read().unlocked.includes('garden_wildflower'));
    await slot(2).click();await page.locator('.garden-world-harvest').click();await page.waitForFunction(()=>Tracer.pet.read().unlocked.includes('garden_cherry_shiny'));
    await slot(0).click();await page.locator('.garden-world-harvest').click();await page.waitForFunction(()=>TracerGardenHarvest.snapshot(JSON.parse(localStorage.getItem(TracerGardenHarvest.key))).total===3);
    assert.equal(await page.evaluate(()=>window.__drawCount),3);
    const before=await page.evaluate(()=>localStorage.getItem(TracerGardenHarvest.key));
    await page.reload();await page.waitForFunction(()=>window.Tracer?.garden&&Tracer.store.data);await page.evaluate(()=>Tracer.garden.refresh(true));
    assert.equal(await page.evaluate(()=>window.__drawCount),0);assert.equal(await page.evaluate(()=>localStorage.getItem(TracerGardenHarvest.key)),before);
    await page.evaluate(()=>Tracer.pet.action('select','garden_cherry_shiny'));await page.evaluate(()=>Tracer.pet.open());
    await page.locator('.pet-trail-toggle').waitFor();assert.equal(await page.locator('.pet-trail-toggle').isDisabled(),true,'global cursor trail requires desktop app');
    assert.equal(await page.locator('.pet-home .garden-plant-sprite[data-shiny="true"]').count()>0,true);
    await page.locator('.pet-top [data-act="close"]').click();
    await page.locator('.garden-home-title').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(folder,'pastoral-desktop.png'),animations:'disabled'});
    await page.setViewportSize({width:380,height:1000});await slot(2).click();
    const widths=await page.locator('.garden-home').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert.ok(widths.scroll<=widths.client+1,JSON.stringify(widths));
    await page.locator('.garden-home-title').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(folder,'pastoral-mobile.png'),animations:'disabled'});
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>[...document.querySelectorAll('.garden-plant-sprite')].every(e=>['static','reduced'].includes(e.dataset.playback)));
    await slot(2).click();await page.locator('.garden-world-care-button[data-interaction="water"]').click();
    await page.evaluate(()=>Tracer.show('board'));assert.equal(await page.locator('.garden-plant-sprite').count(),0,'leaving the garden removes the animation players');
    // Review every production illustration together, including its true alpha.
    await page.setViewportSize({width:1280,height:1660});
    await page.evaluate(async()=>{
      const kinds=TracerGardenPlantArt.kinds,names=['野花','向日葵','薰衣草','苹果树','桃树','樱桃树'];
      await Promise.all(kinds.map(kind=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);if(ctx.getImageData(0,0,1,1).data[3]!==0)reject(new Error(kind+' has an opaque background'));else resolve();};image.onerror=()=>reject(new Error('Missing atlas '+kind));image.src='/garden-art/'+kind+'-v2.png';})));
      const host=document.createElement('section');host.id='qa-art-gallery';host.style.cssText='position:fixed;inset:0;z-index:99999;overflow:auto;background:#171e1b;padding:28px 42px;color:#e1e7d5;font-family:system-ui';
      host.innerHTML='<h1 style="font-size:26px;margin:0 0 8px">花园里的新朋友</h1><p style="margin:0 0 22px;color:#9bac92">六种植物 · 六位奇幻伙伴 · 六位异色闪光伙伴</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px" class="qa-gallery-grid"></div>';
      const grid=host.querySelector('div');kinds.forEach((kind,i)=>[false,true,'shiny'].forEach(variant=>{const card=document.createElement('article');card.style.cssText='height:236px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #9caf7833;border-radius:14px;background:#202923';const title=document.createElement('div');title.textContent=names[i]+' · '+(!variant?'自然植物':variant==='shiny'?'闪光伙伴':'奇幻伙伴');title.style.cssText='font-size:13px;color:#bfccad';card.appendChild(title);const art=TracerGardenPlantAnimation.create({document,kind,stage:4,rare:!!variant,shiny:variant==='shiny',animated:false});art.element.style.cssText='width:190px;height:209px';card.appendChild(art.element);grid.appendChild(card);}));document.body.appendChild(host);
    });
    await page.screenshot({path:path.join(folder,'plant-companions-v2.png'),animations:'disabled'});
    await page.evaluate(()=>document.getElementById('qa-art-gallery').remove());
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log('PASS pastoral artwork, six plant kinds, 32-pose interaction, normal faceless plants, rare/shiny draws, quota recovery, harvest roster, reload deduplication, reduced motion and narrow layout');
    console.log('Artifacts: '+folder);
  }catch(error){console.error('Artifacts: '+folder);const page=browser?.contexts()[0]?.pages()[0];await page?.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});throw error;}
  finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
