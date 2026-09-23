'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'.cache/pet-web-'));
Object.assign(process.env,{DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(profile,'data'),DOCS_PORTAL_STATE_FILE:path.join(profile,'bookmarks.json')});
const {server}=require('../server');
async function seedNeeds(page,needs){
 await page.evaluate(needs=>{
  const state=Tracer.pet.read();Object.assign(state.pets[state.selected],needs);state.lastAction='';state.lastActionAt=0;state.updatedAt=Date.now();
  const raw=JSON.stringify(state);localStorage.setItem('tracer.pet.v1',raw);dispatchEvent(new StorageEvent('storage',{key:'tracer.pet.v1',newValue:raw}));Tracer.pet.refresh(true);
 },needs);
}
async function reaction(page,action,prop){
 await page.waitForFunction(action=>document.querySelector('.pet-home').dataset.action===action,action);
 const builtin=page.locator('.pet-character .pet-builtin-sprite');
 if(await builtin.count()){
  assert.equal(await builtin.getAttribute('data-action'),action,action+' selects its authored action');
  assert.equal(await builtin.getAttribute('data-frames'),'16',action+' uses all sixteen authored frames');
  assert.equal(await builtin.getAttribute('data-playback'),'playing');
  const before=await builtin.evaluate(el=>({frame:el.dataset.frame,markup:el.innerHTML,head:el.querySelector('.rig-head').style.transform}));
  await page.waitForFunction(({action,frame})=>{const el=document.querySelector('.pet-character .pet-builtin-sprite');return el?.dataset.action===action&&el.dataset.frame!==frame;},{action,frame:before.frame},{timeout:2000});
  const after=await builtin.evaluate(el=>{
   const prop=el.lastElementChild,box=prop.getBoundingClientRect();
   return {markup:el.innerHTML,head:el.querySelector('.rig-head').style.transform,propVisible:prop.checkVisibility()&&box.width>0&&box.height>0};
  });
  assert.notEqual(after.markup,before.markup,action+' renders a different articulated pose');
  assert.notEqual(after.head,before.head,action+' changes the head pose between frames');
  assert.ok(after.propVisible,action+' includes its visible authored prop');
  assert.equal(await page.locator(prop).isVisible(),false,'authored action props do not duplicate the old overlay');
  return;
 }
 assert.ok(await page.locator(prop).isVisible(),action+' displays its reaction prop');
 const moving=await page.locator('.pet-character').evaluate(el=>el.getAnimations({subtree:true}).some(animation=>{
  const target=animation.effect?.target;if(!target?.checkVisibility()||animation.playState!=='running'||(!target.classList.contains('pet-sprite')&&!target.closest('.pet-rig')))return false;
  return new Set(animation.effect.getKeyframes().map(frame=>frame.transform).filter(Boolean)).size>1;
 }));
 assert.ok(moving,action+' animates the companion body or articulated parts');
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
  await page.click('#pet-open');assert.equal(await page.locator('.pet-name').innerText(),'Sprout');
  await page.click('[data-act=feed]');assert.ok(await page.evaluate(()=>Tracer.pet.read().pets.sprout.food>95));
  await reaction(page,'feed','.pet-food-prop');
  await page.screenshot({path:path.join(profile,'feeding-reaction.png')});
  await page.click('[data-act=feed]');await page.waitForFunction(()=>document.querySelector('.pet-home').dataset.feedback==='full');
  assert.ok((await page.locator('.pet-speech').innerText()).trim(),'full feeding explains the no-op');
  await seedNeeds(page,{food:40,energy:85,joy:40,sleeping:false});
  await page.click('[data-act=play]');await reaction(page,'play','.pet-ball-prop');
  assert.ok(await page.evaluate(()=>Tracer.pet.read().pets.sprout.joy>60));
  const playSpeech=await page.locator('.pet-speech').innerText();
  await page.click('[data-act=feed]');await page.waitForFunction(()=>document.querySelector('.pet-home').dataset.feedback==='cooldown');
  assert.notEqual(await page.locator('.pet-speech').innerText(),playSpeech,'cooldown is explained instead of repeating successful play feedback');
  await page.click('[data-act=sleep]');assert.equal(await page.locator('.pet-home').getAttribute('data-mood'),'sleeping');
  await page.click('[data-act=feed]');await page.waitForFunction(()=>document.querySelector('.pet-home').dataset.feedback==='sleeping');
  assert.ok((await page.locator('.pet-speech').innerText()).trim(),'sleeping feeding explains the no-op');
  await page.click('[data-act=sleep]');
  await seedNeeds(page,{food:40,energy:85,joy:40,sleeping:false});
  const bond=await page.evaluate(()=>Tracer.pet.read().pets.sprout.bond);
  await page.click('.pet-character');await reaction(page,'pet','.pet-heart-one');
  assert.ok(await page.evaluate(bond=>Tracer.pet.read().pets.sprout.bond>bond,bond),'clicking the character builds bond');
  await page.screenshot({path:path.join(profile,'petting-reaction.png')});
  await page.click('[data-act=focus-toggle]');await page.waitForFunction(()=>Tracer.focus.read().running);
  await page.click('[data-act=focus-toggle]');await page.waitForFunction(()=>!Tracer.focus.read().running);
  await page.click('[data-tab=collection]');assert.equal(await page.locator('.pet-unlock:disabled').count(),5);
  await page.evaluate(()=>{
   // An ordinary project-garden receipt unlocks Miso without granting a rare
   // plant companion; the existing focus fixture also earns Brook and Nova.
   const harvestedAt=Date.now(),projectId='qa-companion-garden';
   const mature=TracerGardenHarvest.mature(TracerGardenHarvest.fresh(),[{projectId,plantKind:'wildflower',stage:4,commemoratedAt:harvestedAt}],()=>100);
   localStorage.setItem(TracerGardenHarvest.key,JSON.stringify(TracerGardenHarvest.harvest(mature,projectId,harvestedAt)));
   for(let i=0;i<10;i++){const t=TracerModel.addTask(Tracer.store.data,{title:'Finished '+i,status:'done'});t.doneAt=Date.now()-(i%3)*86400000;TaskHistory.record(Tracer.store.data,t);}
   const f=TracerFocus.fresh();f.totalMinutes=120;localStorage.setItem('tracer.focus.v1',JSON.stringify(f));Tracer.refreshWellness();Tracer.touch();
  });
  await page.waitForFunction(()=>Tracer.pet.read().unlocked.length===6);await page.locator('[data-value=miso]').click();
  await page.screenshot({path:path.join(profile,'collection.png')});
  for(const language of ['en','zh']) {
   await page.click('[data-act=close]');await page.selectOption('#language-select',language);await page.click('#pet-open');
   for(const width of [360,420,760,1440]) {
    await page.setViewportSize({width,height:1000});
    for(const tab of ['care','collection','chat']) {
     await page.click('[data-tab='+tab+']');
     const issues=await page.locator('.pet-home').evaluate(el=>{
      const bounds=el.getBoundingClientRect();return [...el.querySelectorAll('button,textarea,meter,label')].filter(e=>e.checkVisibility()).filter(e=>{const r=e.getBoundingClientRect();return r.left<bounds.left-1||r.right>bounds.right+1;}).map(e=>e.className);
     });assert.deepEqual(issues,[],language+'/'+width+'/'+tab);
    }
   }
   await page.click('[data-tab=care]');await page.screenshot({path:path.join(profile,'home-'+language+'.png')});
  }
  await page.route('**/api/ai/codex-chat',route=>route.fulfill({json:{reply:'One small step at a time.'}}));
  await page.click('[data-tab=chat]');await page.fill('#pet-message','Hello');await page.click('.pet-send');await page.locator('.pet-chat-assistant').waitFor();
  assert.equal(await page.locator('.pet-chat-assistant').innerText(),'One small step at a time.');
  await page.unroute('**/api/ai/codex-chat');await page.route('**/api/ai/codex-chat',route=>route.fulfill({status:400,json:{error:'provider-unavailable'}}));
  await page.fill('#pet-message','Please keep this');await page.click('.pet-send');await page.waitForFunction(()=>document.querySelector('.pet-chat-error').textContent);
  assert.equal(await page.inputValue('#pet-message'),'Please keep this');
  await page.reload();await page.waitForFunction(()=>window.Tracer?.pet);assert.equal(await page.evaluate(()=>Tracer.pet.read().selected),'miso');
  assert.deepEqual(errors,[]);console.log('PASS care, achievements, shared timer, persistence, chat and bilingual layouts at 360–1440px');console.log('Artifacts: '+profile);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
