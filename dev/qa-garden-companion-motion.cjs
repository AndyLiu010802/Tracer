'use strict';
// Local, isolated browser verification. Never modifies real workspaces or art.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
(async()=>{
  const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/companion-motion-'));fs.mkdirSync(path.join(folder,'data'));
  Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(folder,'data'),DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
  const {server}=require('../server');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1400,height:1050},serviceWorkers:'block'}),errors=[];
    await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();if(u.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});return route.continue();});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);await page.waitForFunction(()=>window.TracerGardenCompanionMotion&&window.TracerPetView);
    const report=await page.evaluate(async()=>{
      const result={sheets:0,frames:0,coverage:{}},host=document.createElement('section');host.id='qa-motion';host.style.cssText='position:fixed;inset:0;z-index:99999;background:#142019;color:#d7e7c5;padding:24px;overflow:auto;font-family:system-ui';document.body.appendChild(host);
      for(const[kind,variants]of Object.entries(TracerGardenCompanionAtlas.kinds))for(const[variant,actions]of Object.entries(variants)){
        const entry=kind+'/'+variant;result.coverage[entry]=Object.keys(actions);
        for(const[action,sheet]of Object.entries(actions)){
          const element=document.createElement('span');element.style.cssText='display:block;width:160px;height:176px';host.appendChild(element);
          const layer=TracerGardenCompanionMotion.create(element,{kind,stage:4,rare:true,shiny:variant==='shiny',onReady:()=>layer.render(action,0)});layer.render(action,0);
          await new Promise((resolve,reject)=>{const start=performance.now();function check(){if(element.dataset.motion==='ready'&&element.dataset.motionClip===action)return resolve();if(performance.now()-start>15000)return reject(new Error(entry+'/'+action+' did not load'));setTimeout(check,20);}check();});
          const crops=new Set();let at=0;for(let frame=0;frame<16;frame++){
            layer.render(action,at+1,false,null,false);const crop=element.querySelector('svg svg'),image=element.querySelector('image');
            if(element.dataset.frame!==String(frame)||element.dataset.motionClip!==action||image.getAttribute('href')!==sheet.src)throw new Error(entry+'/'+action+'/'+frame+' wrong source frame');
            crops.add(crop.getAttribute('viewBox'));at+=TracerGardenCompanionMotion.timings[action][frame];result.frames++;
          }
          if(crops.size!==16)throw new Error(entry+'/'+action+' reused a frame');layer.destroy();element.remove();result.sheets++;
        }
      }
      host.remove();return result;
    });
    const expected=require('./build-garden-companion-atlas.cjs').KINDS.length*2*16;
    assert.equal(report.frames,report.sheets*16);if(process.argv.includes('--complete'))assert.equal(report.sheets,expected,'all '+expected+' inspected sheets are required for completion');
    console.log(`PASS ${report.sheets} real PNG sheets / ${report.frames} distinct source frame crops`);
    // Static review boards use the actual production cropper, including its
    // common foot anchor. They expose identity, padding and resting poses at
    // application size without modifying or resampling the source PNG files.
    for(const action of ['idle','rest','celebrate']){
      await page.evaluate(async action=>{
        const host=document.createElement('section');host.id='qa-motion-board';host.style.cssText='position:fixed;inset:0;z-index:99999;background:#101813;color:#d7e7c5;padding:36px;overflow:auto;font:15px system-ui';
        const title=document.createElement('h1');title.textContent='Plant companions · '+action;host.appendChild(title);
        const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(6,1fr);gap:18px';host.appendChild(grid);document.body.appendChild(host);const layers=[];
        for(const[kind,variants]of Object.entries(TracerGardenCompanionAtlas.kinds))for(const[variant,actions]of Object.entries(variants)){
          if(!actions[action])continue;
          const card=document.createElement('article');card.style.cssText='display:flex;flex-direction:column;align-items:center;background:#1c2920;border:1px solid #3a4939;border-radius:20px;padding:18px 8px 14px';
          const element=document.createElement('span');element.style.cssText='display:block;width:160px;height:176px';const label=document.createElement('p');label.textContent=kind+' · '+variant;label.style.cssText='margin:10px 0 0;font-size:13px;color:#b7c5a7';card.appendChild(element);card.appendChild(label);grid.appendChild(card);
          const at=TracerGardenCompanionMotion.timings[action].slice(0,action==='rest'?12:action==='celebrate'?7:0).reduce((sum,ms)=>sum+ms,0)+1;
          const layer=TracerGardenCompanionMotion.create(element,{kind,stage:4,rare:true,shiny:variant==='shiny',onReady:()=>layer.render(action,at,false,null,false)});layers.push(layer);layer.render(action,at,false,null,false);
        }
        window.__motionBoard={host,layers};
      },action);
      await page.waitForFunction(()=>[...document.querySelectorAll('#qa-motion-board [data-motion]')].every(element=>element.dataset.motion==='ready'));
      await page.screenshot({path:path.join(folder,'companions-'+action+'.png')});
      await page.evaluate(()=>{__motionBoard.layers.forEach(layer=>layer.destroy());__motionBoard.host.remove();delete window.__motionBoard;});
    }
    // Run the exact same companion UI in its main-window and desktop layouts.
    for(const desktop of [false,true]){
      if(desktop){await page.setViewportSize({width:420,height:720});await page.goto(origin+'/pet.html');await page.waitForFunction(()=>window.TracerGardenCompanionMotion&&window.TracerPetView);}
      await page.evaluate(desktop=>{
        const host=document.createElement('section');host.id='qa-pet-motion';host.style.cssText='position:fixed;inset:0;z-index:99999;background:#111815;overflow:auto;padding:'+(desktop?'0':'24px');document.body.appendChild(host);
        const pet=TracerPetModel.gardenPets.find(p=>p.id==='garden_wildflower_shiny'),calls=[],snapshot={language:'zh',pet,catalog:[pet],needs:{sleeping:false,food:80,energy:80,joy:80,bond:30},focus:{running:false,completed:false,clock:'25:00'},unlocked:[pet.id],metrics:{},mood:'happy',lastAction:'',lastActionAt:0,reminders:true};
        const view=TracerPetView(host,(...args)=>calls.push(args),desktop);view.update(snapshot);window.__motionQA={host,view,snapshot,calls};
      },desktop);
      if(desktop){await page.locator('#qa-pet-motion .pet-character').hover();await page.locator('#qa-pet-motion [data-quick-act=expand]').click();}
      await page.locator('#qa-pet-motion .garden-companion-preview summary').click();
      assert.equal(await page.locator('#qa-pet-motion .garden-companion-preview option').count(),16);
      await page.locator('#qa-pet-motion .garden-companion-preview select').selectOption('greet');await page.locator('#qa-pet-motion .garden-companion-preview button').click();
      await page.waitForFunction(()=>document.querySelector('#qa-pet-motion .pet-character .garden-plant-sprite')?.dataset.motionClip==='greet');
      const before=await page.locator('#qa-pet-motion .pet-character .garden-plant-sprite').getAttribute('data-frame');await page.waitForFunction(before=>document.querySelector('#qa-pet-motion .pet-character .garden-plant-sprite').dataset.frame!==before,before);
      assert.equal(await page.evaluate(()=>__motionQA.calls.filter(c=>!['expand'].includes(c[0])).length),0,'previews must never earn rewards or change needs');
      await page.screenshot({path:path.join(folder,desktop?'desktop-preview.png':'main-preview.png')});
      await page.evaluate(()=>{__motionQA.snapshot.focus.running=true;__motionQA.view.update(__motionQA.snapshot);});assert.equal(await page.locator('#qa-pet-motion .garden-companion-preview button').isDisabled(),true);
      await page.evaluate(()=>{__motionQA.snapshot.focus.running=false;__motionQA.snapshot.language='en';__motionQA.view.update(__motionQA.snapshot);});assert.equal(await page.locator('#qa-pet-motion .garden-companion-preview summary').textContent(),'Companion movements');
      await page.evaluate(()=>{__motionQA.view.destroy();__motionQA.host.remove();delete window.__motionQA;});
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(report,null,2));console.log('PASS main / desktop preview, no reward dispatch, focus guard, language rebuild and destruction');console.log('Artifacts: '+folder);
  }catch(error){console.error('Artifacts: '+folder);await browser?.contexts()[0]?.pages()[0]?.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});throw error;}
  finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
