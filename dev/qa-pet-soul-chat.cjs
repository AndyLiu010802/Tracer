'use strict';
// Isolated browser profile, controlled clock and held mock replies; no live AI.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'.cache/pet-soul-chat-'));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(profile,'data'),DOCS_PORTAL_STATE_FILE:path.join(profile,'bookmarks.json')});
const {server}=require('../server');
const ids=['sprout','miso','brook','ember','luna','nova'];
const behaviors=['idle','pet','feed','play','sleep','wake','focus','drag','fishing','exercise','farming','mining'];

async function tick(page,seconds=1,desktop=false){
  await page.evaluate(({seconds,desktop})=>{for(let i=0;i<seconds;i++){window.__soulClock+=1000;if(desktop)window.__nativeState(window.__nativeSnapshot);else Tracer.pet.refresh();}},{seconds,desktop});
}
async function poll(check,message){
  const until=Date.now()+5000;while(Date.now()<until){if(check())return;await new Promise(resolve=>setTimeout(resolve,20));}assert.fail(message);
}
async function seed(page){
  await page.evaluate(()=>{const state=Tracer.pet.read();state.unlocked=TracerPetModel.pets.map(pet=>pet.id);state.reminders=false;Object.assign(TracerPetModel.current(state),{food:50,energy:90,joy:40,sleeping:false});state.lastAction='';state.lastActionAt=0;const raw=JSON.stringify(state);localStorage.setItem('tracer.pet.v1',raw);dispatchEvent(new StorageEvent('storage',{key:'tracer.pet.v1',newValue:raw}));Tracer.pet.refresh(true);});
}
async function visibleRigMotion(page,caption){
  const value=await page.locator('.pet-character .pet-rig').evaluate(svg=>{
    const moving=svg.getAnimations({subtree:true}).filter(animation=>animation.playState==='running'&&animation.effect?.target?.checkVisibility()).map(animation=>({
      target:animation.effect.target.getAttribute('class'),name:animation.animationName||'',duration:animation.effect.getTiming().duration,
      frames:animation.effect.getKeyframes().map(frame=>({transform:frame.transform,opacity:frame.opacity})),
    })).filter(animation=>new Set(animation.frames.map(frame=>JSON.stringify(frame))).size>1);
    return{moving,outer:getComputedStyle(svg).animationName,transform:getComputedStyle(svg).transform};
  });
  assert.ok(value.moving.some(animation=>/rig-/.test(animation.target)),caption+' visibly animates articulated parts');
  assert.equal(value.outer,'none',caption+' does not substitute a whole-picture animation');
  return JSON.stringify(value.moving);
}
async function deliver(route,json,status=200){
  await route.fulfill({status,json}).catch(error=>{if(!/interception|closed|aborted|invalid/i.test(error.message))throw error;});
}
async function rigMatrix(browser,origin){
  const page=await browser.newPage({viewport:{width:1240,height:1000}});
  await page.route('**/qa-rig-matrix',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="stylesheet" href="/pet.css"><link rel="stylesheet" href="/pet-interactions.css"><link rel="stylesheet" href="/pet-character-motion.css"><style>body{margin:0;padding:12px;background:#161d23;color:#dce8d9;font:12px system-ui}#matrix{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.rig-case{padding:8px;border:1px solid #ffffff20;border-radius:8px;min-width:0;text-align:center}.rig-case .pet-character{margin:4px auto;width:160px;height:160px}h3{margin:4px;font-size:11px;font-weight:400}</style></head><body><div id="matrix"></div><script src="/pet-art.js"></script></body></html>'}));
  await page.goto(origin+'/qa-rig-matrix');await page.waitForFunction(()=>typeof TracerPetArt==='function');
  await page.evaluate(({ids,behaviors})=>{
    for(const behavior of behaviors)for(const id of ids){
      const host=document.createElement('section');host.className='pet-home rig-case';Object.assign(host.dataset,{pet:id,behavior,kind:'creature',mood:behavior==='sleep'?'sleeping':behavior==='focus'?'focusing':'happy',action:['pet','feed','play','sleep','wake'].includes(behavior)?behavior:'',idle:['fishing','exercise','farming','mining'].includes(behavior)?behavior:''});
      host.innerHTML='<h3>'+id+' · '+behavior+'</h3><div class="pet-character">'+TracerPetArt(id)+'</div>';document.querySelector('#matrix').appendChild(host);
    }
  },{ids,behaviors});
  const results=await page.locator('.rig-case').evaluateAll(hosts=>hosts.map(host=>{
    const svg=host.querySelector('svg'),box=svg.getBoundingClientRect(),animations=svg.getAnimations({subtree:true}),moving=animations.filter(animation=>animation.playState==='running'&&animation.effect?.target?.checkVisibility()).filter(animation=>new Set(animation.effect.getKeyframes().map(frame=>JSON.stringify({transform:frame.transform,opacity:frame.opacity}))).size>1);
    const phases=new Set([0,.25,.5,.75]);for(const animation of animations)for(const frame of animation.effect.getKeyframes())if(frame.computedOffset<1)phases.add(frame.computedOffset);
    const clipped=[],extents={left:0,top:0,right:160,bottom:160};
    for(const phase of phases){
      for(const animation of animations){animation.pause();const timing=animation.effect.getTiming();animation.currentTime=Math.max(0,timing.delay+Number(timing.duration)*phase);}
      for(const part of svg.querySelectorAll('path,rect,circle,ellipse')){
        if(!part.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue;
        const b=part.getBoundingClientRect();if(!b.width||!b.height)continue;
        const bounds={left:(b.left-box.left)*160/box.width,right:(b.right-box.left)*160/box.width,top:(b.top-box.top)*160/box.height,bottom:(b.bottom-box.top)*160/box.height};
        for(const side of ['left','top'])extents[side]=Math.min(extents[side],bounds[side]);for(const side of ['right','bottom'])extents[side]=Math.max(extents[side],bounds[side]);
        if(getComputedStyle(svg).overflow!=='visible'&&(bounds.left<-.6||bounds.top<-.6||bounds.right>160.6||bounds.bottom>160.6))clipped.push({phase,bounds});
      }
    }
    for(const animation of animations){const timing=animation.effect.getTiming();animation.currentTime=Math.max(0,timing.delay+Number(timing.duration)*.25);}
    const visible=selector=>svg.querySelector(selector)?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})===true;
    return{id:host.dataset.pet,behavior:host.dataset.behavior,movingParts:moving.map(animation=>animation.effect.target.getAttribute('class')),openEyes:visible('.rig-eyes'),closedEyes:visible('.rig-eyes-closed'),extents,clipped};
  }));
  fs.writeFileSync(path.join(profile,'rig-matrix.json'),JSON.stringify(results,null,2));
  await page.screenshot({path:path.join(profile,'rig-matrix.png'),fullPage:true});
  for(const row of results){
    assert.ok(row.movingParts.some(name=>/rig-/.test(name)),row.id+'/'+row.behavior+' has visible part movement');
    assert.equal(row.openEyes,row.behavior!=='sleep',row.id+'/'+row.behavior+' open-eye state');assert.equal(row.closedEyes,row.behavior==='sleep',row.id+'/'+row.behavior+' closed-eye state');
  }
  assert.deepEqual(results.filter(row=>row.clipped.length),[],'common animation extrema stay inside any clipping SVG viewport');
  await page.close();
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],calls=[],held=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{window.__soulClock=Date.now();Date.now=()=>window.__soulClock;window.TracerPet={send(message){if(message.type==='snapshot')window.__qaSnapshot=message.value;},onAction(){}};});
    await page.route('**/api/ai/codex-status',route=>route.fulfill({json:{configured:true,account:{type:'chatgpt',planType:'pro'}}}));
    await page.route('**/api/ai/personal-status',route=>route.fulfill({json:{configured:true,tested:true,url:'https://mock.invalid/v1'}}));
    for(const provider of ['personal','codex'])await page.route('**/api/ai/'+provider+'-chat',route=>{calls.push(route.request().postDataJSON());held.push(route);});
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);await seed(page);
    await page.click('#pet-open');await page.click('[data-tab="chat"]');
    const input=page.locator('#pet-message'),userRows=page.locator('.pet-chat-user'),thinking=page.locator('.pet-chat-thinking');
    await input.fill('First line');await input.press('Shift+Enter');await input.press('End');await input.type('Second line');
    assert.equal(await input.inputValue(),'First line\nSecond line','Shift+Enter inserts a newline');assert.equal(calls.length,0);
    await input.evaluate(el=>{window.__qaKeys=[];el.addEventListener('keydown',event=>window.__qaKeys.push({key:event.key,isComposing:event.isComposing,keyCode:event.keyCode,repeat:event.repeat}),true);});
    for(const init of [{key:'Enter',code:'Enter',isComposing:true},{key:'Enter',code:'Enter',keyCode:229}]){await input.dispatchEvent('keydown',init);await page.waitForTimeout(100);assert.equal(calls.length,0,'IME guard '+JSON.stringify(await page.evaluate(()=>window.__qaKeys)));}
    await input.dispatchEvent('compositionstart',{data:'文'});await input.dispatchEvent('keydown',{key:'Enter',code:'Enter'});await input.dispatchEvent('compositionend',{data:'文'});
    await page.waitForTimeout(100);assert.equal(calls.length,0,'composition session guard '+JSON.stringify(await page.evaluate(()=>window.__qaKeys)));
    await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',repeat:true});
    await page.waitForTimeout(100);
    assert.equal(calls.length,0,'repeat guard '+JSON.stringify(await page.evaluate(()=>window.__qaKeys)));
    await input.press('Enter');await poll(()=>calls.length===1,'first Enter should send');
    assert.equal(await userRows.count(),1,'sent user bubble appears before the response');
    assert.match(await userRows.first().innerText(),/First line\nSecond line/);
    assert.equal(await input.inputValue(),'','sending clears the composer immediately');assert.equal(await input.isDisabled(),false,'a next draft remains editable');
    assert.equal(await thinking.count(),1,'a separate thinking bubble is visible');assert.equal(await page.locator('.pet-send').isDisabled(),true);
    await input.fill('Next draft survives the first reply.');await input.press('Enter');await input.press('Enter');
    assert.equal(calls.length,1,'repeated Enter while pending cannot duplicate the request');assert.equal(await userRows.count(),1);
    await page.selectOption('#language-select','zh');assert.equal(await thinking.count(),1);assert.equal(await input.inputValue(),'Next draft survives the first reply.');assert.equal(await page.locator('.pet-send').isDisabled(),true);
    await page.selectOption('#language-select','en');assert.equal(await thinking.count(),1);assert.equal(await input.inputValue(),'Next draft survives the first reply.','language changes keep the pending conversation and next draft');
    await page.screenshot({path:path.join(profile,'optimistic-pending.png')});
    await deliver(held[0],{reply:'I heard both lines.'});await page.locator('.pet-chat-assistant').waitFor();
    assert.equal(await thinking.count(),0);assert.equal(await input.inputValue(),'Next draft survives the first reply.','the reply leaves a newer draft intact');
    await input.fill('Please retry this message.');await input.press('Enter');await poll(()=>calls.length===2,'failure request should start');
    await deliver(held[1],{error:'provider-unavailable'},503);
    await page.locator('.pet-chat-user[data-status="failed"]').waitFor();
    assert.equal(await input.inputValue(),'Please retry this message.','failure restores the draft when no newer text was entered');
    assert.equal(await userRows.count(),2,'the failed sent bubble remains in place');
    assert.equal(await page.locator('.pet-chat-retry').isVisible(),true);
    await input.press('Enter');await poll(()=>calls.length===3,'sending the restored failed draft should retry the same row');
    assert.equal(await userRows.count(),2,'retry reuses the existing sent row');
    assert.equal(calls[2].messages.filter(message=>message.content==='Please retry this message.').length,1,'retry sends no duplicate user entry');
    assert.ok(calls[2].messages.every(message=>Object.keys(message).sort().join(',')==='content,role'),'UI delivery status and message IDs are not sent to the provider');
    await input.fill('Keep my new unsent draft.');await deliver(held[2],{error:'provider-unavailable'},503);
    await page.locator('.pet-chat-user[data-status="failed"]').waitFor();
    assert.equal(await input.inputValue(),'Keep my new unsent draft.','a failed retry never overwrites a newer draft');
    await page.click('.pet-home [data-act="open-ai"]');await page.locator('.ai-dialog').waitFor();await page.click('#ai-close');await page.click('#pet-open');
    await page.locator('.pet-chat-user[data-status="failed"]').waitFor();
    assert.equal(await page.locator('[data-tab="chat"]').getAttribute('aria-pressed'),'true','return from My AI restores the chat tab');
    assert.equal(await userRows.count(),2);assert.equal(await input.inputValue(),'Keep my new unsent draft.','My AI settings retain the unsent draft in memory');
    assert.equal(await page.locator('.pet-chat-retry').isVisible(),true);assert.equal(calls.length,3,'settings roundtrip never automatically resends');
    assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(key=>(localStorage.getItem(key)||'').includes('Keep my new unsent draft.'))),false,'chat recovery is not written to persistent storage');
    await page.click('[data-act="retry-chat"]');await poll(()=>calls.length===4,'second retry should start');
    assert.equal(await userRows.count(),2);assert.equal(await input.inputValue(),'Keep my new unsent draft.');
    await deliver(held[3],{reply:'Retry received.'});await page.waitForFunction(()=>document.querySelectorAll('.pet-chat-assistant').length===2);
    assert.equal(await page.locator('.pet-chat-user[data-status="failed"]').count(),0);assert.equal(await input.inputValue(),'Keep my new unsent draft.');
    // Clearing and switching abort requests; late responses cannot repopulate the new conversation.
    await input.fill('This reply will be cleared.');await input.press('Enter');await poll(()=>calls.length===5,'clear-case request should start');
    await page.click('[data-act="clear-chat"]');assert.equal(await userRows.count(),0);assert.equal(await thinking.count(),0);assert.equal(await page.locator('.pet-send').isDisabled(),false);
    await deliver(held[4],{reply:'STALE CLEARED REPLY'});assert.equal(await page.locator('.pet-chat-assistant').count(),0);
    await input.fill('This reply belongs to Sprout.');await input.press('Enter');await poll(()=>calls.length===6,'switch-case request should start');
    await page.click('[data-tab="collection"]');await page.click('[data-act="select"][data-value="miso"]');await page.click('[data-tab="chat"]');
    assert.equal(await userRows.count(),0);assert.equal(await thinking.count(),0);assert.equal(await input.inputValue(),'');assert.equal(await input.isDisabled(),false);
    await deliver(held[5],{reply:'STALE SPROUT REPLY'});
    await input.fill('Hello, Miso.');await input.press('Enter');await poll(()=>calls.length===7,'new companion request should start');
    assert.equal(calls[6].pet,'miso');assert.deepEqual(calls[6].messages,[{role:'user',content:'Hello, Miso.'}]);
    await deliver(held[6],{reply:'Miso is listening.'});await page.locator('.pet-chat-assistant').waitFor();
    assert.equal(await page.locator('.pet-chat-log').innerText().then(text=>text.includes('STALE')),false,'stale replies stay out of the active chat');
    if(process.env.TRACER_QA_CHAT_ONLY){assert.deepEqual(errors,[]);console.log('PASS optimistic chat, editable drafts, Enter/newline/IME guards, same-row retries, language changes and safe clear/switch');console.log('Artifacts: '+profile);return;}
    await page.click('[data-tab="care"]');
    const biographies=new Set(),signatures=new Set(),reactions={pet:new Set(),feed:new Set(),play:new Set()},snapshots=[];
    for(const id of ids){
      await page.evaluate(id=>Tracer.pet.action('select',id),id);await seed(page);
      assert.equal(await page.locator('.pet-home').getAttribute('data-pet'),id);
      assert.equal(await page.locator('.pet-character .pet-rig').getAttribute('data-rig'),id);
      const card=page.locator('.pet-personality-card');assert.equal(await card.isVisible(),true,id+' has an authored personality sheet');
      if(!await card.evaluate(el=>el.open))await card.locator('summary').click();
      const biography=await page.locator('.pet-personality-bio').innerText(),likes=await page.locator('.pet-personality-likes').innerText(),habit=await page.locator('.pet-personality-habit').innerText();
      assert.ok(biography.length>30&&likes.length>3&&habit.length>10,id+' sheet contains meaningful biography, likes and ritual');biographies.add(biography);
      for(const action of ['pet','feed','play']){
        await page.click(action==='pet'?'.pet-character':'[data-act="'+action+'"]');
        await page.waitForFunction(action=>document.querySelector('.pet-home')?.dataset.behavior===action,action);
        reactions[action].add(await page.locator('.pet-speech').innerText());
        const signature=await visibleRigMotion(page,id+'/'+action);if(action==='play')signatures.add(signature);
        if(action==='play')await page.locator('.pet-stage').screenshot({path:path.join(profile,id+'-play.png')});
        await tick(page,7);
      }
      await tick(page,20);
      const preferred=await page.evaluate(id=>TracerPetPersonalities.get(id).activityOrder[0],id);
      assert.equal(await page.locator('.pet-home').getAttribute('data-idle'),preferred,id+' begins its preferred quiet activity');
      assert.equal(await page.locator('.pet-home').getAttribute('data-behavior'),preferred);
      await visibleRigMotion(page,id+'/'+preferred);
      await page.screenshot({path:path.join(profile,id+'-personality.png')});
      snapshots.push(await page.evaluate(()=>{const value=structuredClone(window.__qaSnapshot);value.feedback=null;value.lastAction='';value.lastActionAt=0;return value;}));
    }
    assert.equal(biographies.size,6,'all six companions have distinct biographies');assert.equal(signatures.size,6,'all six rigs have distinct play movement signatures');
    for(const [action,lines] of Object.entries(reactions))assert.equal(lines.size,6,action+' has a distinct authored reaction for every built-in companion');
    const compact=await browser.newPage({viewport:{width:220,height:260}});compact.on('pageerror',error=>errors.push(error.message));
    await compact.addInitScript(()=>{window.__soulClock=Date.now();Date.now=()=>window.__soulClock;window.PetDesktop={send(message){(window.__commands||=[]).push(message);},onState(callback){window.__nativeState=callback;}};});
    await compact.goto('http://127.0.0.1:'+server.address().port+'/pet.html');await compact.waitForFunction(()=>typeof window.__nativeState==='function');
    for(const snapshot of snapshots){
      await compact.evaluate(value=>{window.__nativeSnapshot=value;window.__nativeState(value);},snapshot);
      assert.equal(await compact.locator('.pet-home').getAttribute('data-pet'),snapshot.pet.id);
      assert.equal(await compact.locator('.pet-speech').isVisible(),false,snapshot.pet.id+' personality does not force persistent compact text');
      assert.equal(await compact.locator('.pet-identity').isVisible(),false);await visibleRigMotion(compact,'compact/'+snapshot.pet.id);
      assert.ok(await compact.locator('.pet-character').evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight;}),'rig fits minimal desktop');
      await compact.screenshot({path:path.join(profile,'compact-'+snapshot.pet.id+'.png'),omitBackground:true});
    }
    const body=await compact.locator('.pet-character').boundingBox();await compact.mouse.move(body.x+body.width/2,body.y+body.height/2);await compact.mouse.down();await compact.mouse.move(body.x+body.width/2+18,body.y+body.height/2+12,{steps:3});
    assert.equal(await compact.locator('.pet-home').getAttribute('data-behavior'),'drag');await visibleRigMotion(compact,'native articulated drag');await compact.mouse.up();
    await compact.evaluate(()=>{window.__nativeSnapshot.needs.sleeping=true;window.__nativeState(window.__nativeSnapshot);});assert.equal(await compact.locator('.pet-home').getAttribute('data-behavior'),'sleep');
    await compact.evaluate(()=>{window.__nativeSnapshot.needs.sleeping=false;window.__nativeSnapshot.focus.running=true;window.__nativeState(window.__nativeSnapshot);});assert.equal(await compact.locator('.pet-home').getAttribute('data-behavior'),'focus');
    await compact.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await compact.locator('.pet-character .pet-rig').evaluate(el=>el.getAnimations({subtree:true}).filter(animation=>animation.playState==='running'&&animation.effect?.target?.checkVisibility()).length),0,'reduced motion pauses rig parts');
    await compact.evaluate(()=>{window.__nativeSnapshot.focus.running=false;window.__nativeSnapshot.focus.completed=true;window.__nativeSnapshot.reminder={id:'qa-reminder',title:'Review one small test task',at:Date.now()};window.__nativeState(window.__nativeSnapshot);});
    assert.match(await compact.locator('.pet-speech').innerText(),/Review one small test task/,'a current task reminder takes priority over an older completed focus round');
    assert.equal(await compact.locator('.pet-speech').isVisible(),true);
    for(const language of ['zh','en']){
      await page.selectOption('#language-select',language);
      for(const width of [360,760,1440]){
        await page.setViewportSize({width,height:1000});
        assert.ok(await page.locator('.modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),language+'/'+width+' personality layout does not overflow');
      }
    }
    await rigMatrix(browser,'http://127.0.0.1:'+server.address().port);
    assert.deepEqual(errors,[]);console.log('PASS optimistic chat, Enter/newline/IME guards, editable drafts/retries/stale replies, six distinct personalities and articulated rigs, preferred activities, compact silence and reduced motion');console.log('Artifacts: '+profile);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
