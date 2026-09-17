'use strict';
// Isolated browser QA: locally drawn transparent atlases and mocked image services.
// No source photo, live AI account, native user profile or paid generation is used.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
let profile;
let densePlayback=false;
const actions = [['idle','pet','feed','play'], ['sleep','wake','focus','drag'], ['fishing','exercise','farming','mining'], ['reading','writing','crafting','tea']];
const pagePaths = actions.flat().map((_, index) => '/api/pet-art/' + String(index + 1).padStart(32, 'a') + '.png');
const legacyPath = '/api/pet-art/' + 'b'.repeat(32) + '.png';

async function fixtures(page) {
  const data = await page.evaluate(actions => {
    function pose(ctx, action, frame) {
      const box = (color,x,y,w,h) => { ctx.fillStyle=color; ctx.fillRect(x,y,w,h); };
      const skin='#e9bc93', hair='#654530', shirt='#6ba08d', ink='#24302c', pants='#394b5b';
      const lift=[0,1,3,1][frame], sway=[-2,0,2,0][frame];
      ctx.save();
      if (action==='sleep') { ctx.translate(16,17); ctx.rotate(Math.PI/2); ctx.translate(-16,-17); }
      ctx.translate(action==='play' ? sway : 0, ['play','exercise','wake'].includes(action) ? -lift : 0);
      box(skin,11,4,10,12); box(hair,10,3,12,5); box(hair,10,7,3,4);
      box(ink,13,9,1,action==='sleep'?1:2); box(ink,18,9,1,action==='sleep'?1:2);
      box('#a96d60',14,13,4,1); box(shirt,9,16,14,10);
      // Arm and leg poses are redrawn per frame; the changes are intrinsic pixels.
      box(skin,5+frame,14+lift,4,8-lift); box(skin,23,12+frame*2,4,8);
      box(pants,10+sway,26,5,4); box(pants,18-sway,26,5,4);
      box('#d9e9d4',11,17,3+frame,3);
      if (action==='pet') { box('#e394a5',24,3+lift,3,3); box('#e394a5',22,5+lift,7,3); }
      if (action==='feed') { box('#f1ad65',23-frame,20-lift,5,5); box('#7fac75',25-frame,18-lift,2,2); }
      if (action==='play') box('#85b8d0',3+frame*6,27-lift*3,4,4);
      if (action==='focus') { box('#846c58',3,24,25,2); box('#b9d4de',12,20-frame,9,4); }
      if (action==='drag') { box('#f2d996',4,4+frame*2,2,5); box('#f2d996',27,8-frame,2,5); }
      if (action==='fishing') { box('#ac825b',26-frame,5,1,22); box('#8bc6de',21,29,10,2); }
      if (action==='exercise') { box(ink,2,12-lift,9,2); box(ink,2,10-lift,2,6); box(ink,9,10-lift,2,6); }
      if (action==='farming') { box('#e5b575',24-frame,20,5,4); box('#8bc6de',20-frame,23+lift,3,3); box('#8aba78',3,27,4,4); }
      if (action==='mining') { box('#ac825b',25-frame,10+lift,2,14); box('#aac1c7',21-frame,9+lift,10,3); box('#a69dcc',2,27,6,4); }
      if (action==='reading'||action==='writing') { box('#e9dfbe',6,21,18,6); box('#746a64',14,21,1,6); box('#85664e',18-frame,19+frame,1,5); }
      if (action==='crafting') { box('#846c58',3,25,25,2); box('#b6a47e',13+frame,22,5,3); }
      if (action==='tea') { box('#b9d4de',20-frame,22-lift,5,4); box('#b9d4de',25-frame,23-lift,2,2); }
      ctx.restore();
    }
    const sheets=actions.map(rows=>{
      const canvas=document.createElement('canvas'); canvas.width=canvas.height=1024;
      const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false;
      rows.forEach((action,row)=>{ for(let frame=0;frame<4;frame++) { ctx.save(); ctx.translate(frame*256+16,row*256+16); ctx.scale(7,7); pose(ctx,action,frame); ctx.restore(); } });
      return canvas.toDataURL('image/png').split(',')[1];
    });
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d'); ctx.scale(8,8); pose(ctx,'idle',0);
    return { sheets, portrait:canvas.toDataURL('image/png').split(',')[1] };
  }, actions);
  return { sheets:data.sheets.map(value=>Buffer.from(value,'base64')), portrait:Buffer.from(data.portrait,'base64') };
}

async function tick(page, seconds=1, desktop=false) {
  await page.evaluate(({seconds,desktop})=>{
    for(let i=0;i<seconds;i++) {
      window.__animationClock+=1000;
      if(desktop) window.__nativeState(window.__nativeSnapshot);
      else Tracer.pet.refresh();
    }
  },{seconds,desktop});
}

async function seedCare(page) {
  await page.evaluate(()=>{
    const state=Tracer.pet.read(), care=TracerPetModel.current(state);
    Object.assign(care,{food:50,energy:85,joy:50,sleeping:false});
    state.lastAction=''; state.lastActionAt=0;
    const raw=JSON.stringify(state); localStorage.setItem('tracer.pet.v1',raw);
    dispatchEvent(new StorageEvent('storage',{key:'tracer.pet.v1',newValue:raw})); Tracer.pet.refresh(true);
  });
}

async function layout(page, caption, desktop=false) {
  const issues=await page.locator('.pet-home').evaluate((home,desktop)=>{
    const host=desktop?home:home.closest('.modal'), bounds=host.getBoundingClientRect(), problems=[];
    if(host.scrollWidth>host.clientWidth+1) problems.push('horizontal overflow');
    for(const el of home.querySelectorAll('.pet-character,.pet-sprite')) {
      if(!el.checkVisibility())continue;
      const rect=el.getBoundingClientRect();
      if(rect.left<bounds.left-1||rect.right>bounds.right+1)problems.push('sprite outside host');
      if(desktop&&(rect.top<0||rect.bottom>innerHeight+1))problems.push('sprite outside native viewport');
    }
    const speech=home.querySelector('.pet-speech'), character=home.querySelector('.pet-character');
    if(desktop&&home.classList.contains('has-message')&&!home.classList.contains('is-expanded')) {
      if(speech.getBoundingClientRect().bottom>character.getBoundingClientRect().top) problems.push('speech overlaps character');
    }
    return problems;
  },desktop);
  assert.deepEqual(issues,[],caption);
}

async function playback(page, selector, action, caption) {
  const player=page.locator(selector);
  await page.waitForFunction(({selector,action})=>document.querySelector(selector)?.dataset.action===action,{selector,action});
  await page.waitForFunction(selector=>{
    const player=document.querySelector(selector),image=player?.querySelector('.pet-animation-sheet');
    return player?.dataset.playback==='playing'&&image?.complete&&image.naturalWidth>=768;
  },selector);
  const position=actions.flat().indexOf(action), expectedPage=densePlayback?position:Math.floor(position/4), expectedRow=position%4;
  assert.equal(await player.getAttribute('data-page'),String(expectedPage),caption+' atlas page');
  if(!densePlayback)assert.equal(await player.getAttribute('data-row'),String(expectedRow),caption+' atlas row');
  if(process.env.TRACER_QA_LAYOUT_ONLY) return;
  const frames=new Set(), pictures=new Set();
  for(let i=0;i<4;i++) {
    const frame=await player.getAttribute('data-frame'); frames.add(frame);
    const crop=await player.evaluate(el=>{
      const sheet=el.querySelector('.pet-animation-sheet'), host=el.getBoundingClientRect(), image=sheet.getBoundingClientRect();
      return {host:[host.width,host.height],image:[image.width,image.height],overflow:getComputedStyle(el).overflow,
        legacyAnimation:getComputedStyle(el).animationName,transform:getComputedStyle(el).transform,loaded:sheet.complete&&sheet.naturalWidth>=768};
    });
    assert.ok(crop.loaded,caption+' decoded atlas');
    assert.ok(Math.abs(crop.image[0]/crop.host[0]-4)<.02&&Math.abs(crop.image[1]/crop.host[1]-4)<.02,caption+' shows one 4x4 cell');
    assert.equal(crop.overflow,'hidden',caption+' clips adjacent frames');
    assert.equal(crop.legacyAnimation,'none',caption+' has no legacy body transform animation');
    assert.equal(crop.transform,'none',caption+' pose comes from image pixels');
    pictures.add(crypto.createHash('sha256').update(await player.screenshot()).digest('hex'));
    await page.waitForFunction(({selector,frame})=>document.querySelector(selector)?.dataset.frame!==frame,{selector,frame});
  }
  assert.ok(frames.size>=2,caption+' advances actual frame indices');
  assert.ok(pictures.size>=2,caption+' visible sprite pixels change');
}

async function main() {
  profile=fs.mkdtempSync(path.join(root,'.cache/pet-animation-'));
  Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(profile,'data'),DOCS_PORTAL_STATE_FILE:path.join(profile,'bookmarks.json')});
  const {server}=require('../server');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[], calls=[];
    let art, failPage=1, personalCalls=0;
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.__animationClock=Date.now(); Date.now=()=>window.__animationClock;
      window.TracerPet={send(message){if(message.type==='snapshot')window.__qaSnapshot=message.value;},onAction(){}};
    });
    await page.route('**/api/ai/codex-status',route=>route.fulfill({json:{configured:true,account:{type:'chatgpt',planType:'pro'},imageGeneration:true}}));
    await page.route('**/api/ai/personal-status',route=>route.fulfill({json:{configured:true,tested:true,hasKey:true,url:'https://mock.invalid/v1'}}));
    await page.route('**/api/ai/personal-pet-image',route=>{personalCalls++;return route.fulfill({status:500,json:{error:'unexpected-api-fallback'}});});
    await page.route('**/api/ai/codex-pet-image',route=>{
      const request=route.request().postDataJSON(); calls.push(request);
      if(request.animationPage===failPage) {failPage=-1;return route.fulfill({status:400,json:{error:'codex-image-no-result'}});}
      return route.fulfill({json:{image:pagePaths[request.animationPage],animationPage:request.animationPage,animationVersion:2,model:'mock-pixel-animation'}});
    });
    const routeArt=async target=>{
      for(const [index,url] of pagePaths.entries())await target.route('**'+url,route=>route.fulfill({contentType:'image/png',body:art.sheets[index]}));
      await target.route('**'+legacyPath,route=>route.fulfill({contentType:'image/png',body:art.portrait}));
    };
    await routeArt(page);
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
    art=await fixtures(page);
    art.sheets.forEach((png,index)=>fs.writeFileSync(path.join(profile,'synthetic-sheet-'+index+'.png'),png));
    if(process.env.TRACER_QA_REAL_SHEET) {
      const bytes=fs.readFileSync(process.env.TRACER_QA_REAL_SHEET), url='/api/pet-art/'+'d'.repeat(32)+'.png';
      fs.writeFileSync(path.join(profile,'real-sheet.png'),bytes);
      await page.route('**'+url,route=>route.fulfill({contentType:'image/png',body:bytes}));
      const valid=await page.evaluate(image=>TracerPetAnimation.validatePage(image),url);
      console.log('Real sheet validated: '+JSON.stringify(valid));
      await page.evaluate(image=>{
        const host=document.createElement('div');host.className='real-sheet-preview';
        Object.assign(host.style,{position:'fixed',top:'20px',left:'20px',width:'380px',height:'380px',zIndex:99999,background:'#161d23'});
        window.__realPlayer=TracerPetAnimation.createPage(image,0,{label:'Actual generated companion'});host.appendChild(window.__realPlayer.element);document.body.appendChild(host);
      },url);
      for(const action of actions[0]) {
        await page.evaluate(action=>window.__realPlayer.setAction(action),action);
        await playback(page,'.real-sheet-preview .pet-animated-sprite',action,'real/'+action);
        await page.locator('.real-sheet-preview').screenshot({path:path.join(profile,'real-'+action+'.png')});
      }
      console.log('PASS actual generated sheet validation, 4 action loops and visible frame changes');console.log('Artifacts: '+profile);return;
    }
    densePlayback=true;art=await require('./qa-pet-dense-animation.cjs').fixtures(page);
    art.sheets.forEach((png,index)=>fs.writeFileSync(path.join(profile,'synthetic-sheet-'+index+'.png'),png));
    for(const image of pagePaths) assert.equal((await page.evaluate(image=>TracerPetAnimation.validatePage(image,{version:2}),image)).frames,16,'valid transparent dense atlas fixture');
    assert.equal(await page.evaluate(async image=>{try{await TracerPetAnimation.validatePage(image);return false;}catch{return true;}},legacyPath),true,'a legacy portrait is not accepted as an animation sheet');
    await page.click('#pet-open'); await page.click('[data-tab="collection"]'); await page.click('[data-act="open-create"]');
    await page.locator('#pet-photo').setInputFiles({name:'synthetic-reference.png',mimeType:'image/png',buffer:art.portrait});
    await page.fill('#pet-custom-name','Juniper'); await page.selectOption('#pet-custom-kind','humanoid');
    await page.fill('#pet-custom-personality','Patient and curious.'); await page.fill('#pet-distinctive-features','Keep the green shirt and brown hair.');
    await page.locator('.pet-photo-preview').waitFor({state:'visible'});
    const photo=await page.locator('.pet-photo-preview').getAttribute('src');
    assert.equal(calls.length,0,'choosing a photo does not call a provider');
    await page.click('.pet-generate');
    await page.waitForFunction(()=>!document.querySelector('.pet-generate').disabled&&document.querySelector('.pet-create-error').textContent.includes('returned no image'));
    assert.deepEqual(calls.map(call=>call.animationPage),[0,1],'generation stops at the failed second group');
    assert.equal(await page.locator('.pet-animation-progress').getAttribute('value'),'1');
    assert.equal(await page.locator('.pet-photo-preview').getAttribute('src'),photo);
    assert.equal(await page.locator('#pet-photo').evaluate(el=>el.files.length),1);
    for(const [selector,value] of Object.entries({'#pet-custom-name':'Juniper','#pet-custom-kind':'humanoid','#pet-custom-personality':'Patient and curious.','#pet-distinctive-features':'Keep the green shirt and brown hair.','#pet-image-source':'codex'}))assert.equal(await page.inputValue(selector),value,'failed group retains '+selector);
    assert.equal(await page.locator('.pet-adopt').isVisible(),false,'partial animation packs cannot be saved');
    assert.equal(personalCalls,0,'a failed subscription group never falls back to API');
    await page.screenshot({path:path.join(profile,'partial-group-retry.png')});
    await page.click('.pet-generate'); await page.locator('.pet-adopt').waitFor({state:'visible'});
    assert.deepEqual(calls.map(call=>call.animationPage),[0,1,...Array.from({length:15},(_,i)=>i+1)],'retry resumes with missing actions without regenerating the first');
    assert.equal(await page.locator('.pet-animation-progress').getAttribute('value'),'16');
    for(const call of calls) {
      assert.equal(call.animationVersion,2);
      assert.equal(call.kind,'humanoid'); assert.equal(call.name,'Juniper');
      assert.equal(call.personality,'Patient and curious.'); assert.equal(call.distinctiveFeatures,'Keep the green shirt and brown hair.');
      assert.equal(call.photo,photo,'each explicitly generated group uses the retained reference');
      if(call.animationPage)assert.equal(call.identityImage,pagePaths[0],'later groups reuse the first group identity');
      else assert.equal(call.identityImage,undefined);
    }
    assert.deepEqual(await page.locator('#pet-preview-action option').evaluateAll(options=>options.map(option=>({value:option.value,disabled:option.disabled}))),actions.flat().map(value=>({value,disabled:false})));
    for(const action of actions.flat()) {
      await page.selectOption('#pet-preview-action',action);
      await playback(page,'.pet-result-frame .pet-animated-sprite',action,'preview/'+action);
      await page.locator('.pet-result-frame').screenshot({path:path.join(profile,'preview-'+action+'.png')});
    }
    await page.click('.pet-adopt'); await page.locator('.pet-character .pet-animated-sprite').waitFor();
    const saved=await page.evaluate(()=>Tracer.pet.read().customs[0]);
    assert.deepEqual(saved.animation,{version:2,pages:pagePaths}); assert.equal(saved.image,pagePaths[0]);
    assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(key=>(localStorage.getItem(key)||'').includes('data:image/png;base64,'))),false,'source reference is not persisted');
    assert.deepEqual(await page.evaluate(()=>TracerPetModel.read(JSON.parse(JSON.stringify(Tracer.pet.read()))).customs),[saved],'pet model retains the complete animation manifest');
    await page.reload(); await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data); await page.click('#pet-open');
    assert.deepEqual(await page.evaluate(()=>Tracer.pet.read().customs[0]),saved,'animation pack survives reload');
    await seedCare(page);
    const active='.pet-character .pet-animated-sprite';
    await playback(page,active,'idle','adopted/idle');
    assert.equal(await page.locator('.pet-effects').isVisible(),false,'generated frames own their effects');
    assert.equal(await page.locator('.pet-idle-scene').isVisible(),false,'generated frames own their activity props');
    for(const [control,action] of [['[data-act="feed"]','feed'],['[data-act="play"]','play'],['.pet-character','pet'],['[data-act="sleep"]','sleep'],['[data-act="sleep"]','wake']]) {
      await page.click(control); await page.waitForFunction(({selector,action})=>document.querySelector(selector)?.dataset.action===action,{selector:active,action});
      await tick(page,7);
    }
    await page.click('[data-act="focus-toggle"]');
    await page.waitForFunction(()=>document.querySelector('.pet-character .pet-animated-sprite')?.dataset.action==='focus');
    await page.click('[data-act="focus-toggle"]');
    const seen=new Set();
    for(let second=0;second<740&&seen.size<8;second++) {
      await tick(page);
      const activity=await page.locator('.pet-home').getAttribute('data-idle');
      if(activity){seen.add(activity);assert.equal(await page.locator(active).getAttribute('data-action'),activity,'idle scheduler routes into real frame playback');}
    }
    assert.deepEqual([...seen].sort(),actions.slice(2).flat().sort());
    for(const width of [360,1440]) {await page.setViewportSize({width,height:1000});await layout(page,'main animated/'+width);}
    await page.screenshot({path:path.join(profile,'main-animated.png')});
    await page.click('[data-tab="collection"]');
    const thumbnail=page.locator('.pet-unlock .pet-animated-sprite');
    assert.equal(await thumbnail.getAttribute('data-playback'),'static','collection thumbnails do not animate');
    assert.ok(await thumbnail.evaluate(el=>{const rect=el.getBoundingClientRect();return Math.abs(rect.width-52)<1&&Math.abs(rect.height-52)<1;}),'collection sprite stays 52px square');
    await layout(page,'animated collection');await page.click('[data-tab="care"]');
    const snapshot=await page.evaluate(()=>{Tracer.pet.refresh();const value=structuredClone(window.__qaSnapshot);value.lastAction='';value.lastActionAt=0;value.feedback=null;value.focus.running=false;value.focus.completed=false;value.needs.sleeping=false;value.desktopSize=100;return value;});
    const compact=await browser.newPage({viewport:{width:220,height:284}});
    compact.on('pageerror',error=>errors.push(error.message));
    await compact.addInitScript(()=>{window.__animationClock=Date.now();Date.now=()=>window.__animationClock;window.PetDesktop={send(message){(window.__desktopCommands||=[]).push(message);},onState(callback){window.__nativeState=callback;}};});
    await routeArt(compact); await compact.goto('http://127.0.0.1:'+server.address().port+'/pet.html');
    await compact.waitForFunction(()=>typeof window.__nativeState==='function');
    await compact.evaluate(value=>{window.__nativeSnapshot=value;window.__nativeState(value);},snapshot);
    await playback(compact,active,'idle','compact/idle'); await layout(compact,'compact animated sprite',true);
    await compact.screenshot({path:path.join(profile,'compact-idle.png'),omitBackground:true});
    await compact.evaluate(()=>{window.__nativeSnapshot.feedback={id:'layout',at:Date.now(),accepted:true,action:'pet'};window.__nativeState(window.__nativeSnapshot);});
    await layout(compact,'compact speech clears character',true);
    for(const [width,height,size] of [[220,240,70],[220,284,100],[364,428,180]]) {
      await compact.setViewportSize({width,height});
      await compact.evaluate(size=>{window.__nativeSnapshot.desktopSize=size;window.__nativeState(window.__nativeSnapshot);},size);
      await layout(compact,'compact speech and scale/'+size,true);
    }
    await compact.setViewportSize({width:220,height:284});
    await compact.evaluate(()=>{window.__nativeSnapshot.desktopSize=100;window.__nativeState(window.__nativeSnapshot);});
    await compact.screenshot({path:path.join(profile,'compact-message.png'),omitBackground:true});
    await compact.evaluate(()=>{window.__nativeSnapshot.feedback=null;window.__nativeState(window.__nativeSnapshot);});
    for (const activity of actions[3]) {
      for (let second=0;second<740;second++) {
        if (await compact.locator('.pet-home').getAttribute('data-idle')===activity) break;
        await tick(compact,1,true);
      }
      await playback(compact,active,activity,'compact/'+activity);
      await layout(compact,'compact work/'+activity,true);
      await compact.screenshot({path:path.join(profile,'compact-'+activity+'.png'),omitBackground:true});
    }
    const body=await compact.locator('.pet-character').boundingBox();
    await compact.mouse.move(body.x+body.width/2,body.y+body.height/2);await compact.mouse.down();await compact.mouse.move(body.x+body.width/2+16,body.y+body.height/2+12,{steps:3});
    await playback(compact,active,'drag','compact/drag');
    assert.ok(await compact.evaluate(()=>window.__desktopCommands.some(command=>command.type==='drag-move')),'real pointer drag reaches the desktop transport');
    await compact.mouse.up();
    assert.equal(await compact.locator(active).getAttribute('data-action'),'idle','releasing drag restores idle frames');
    await compact.evaluate(()=>{window.__nativeSnapshot.focus.running=true;window.__nativeState(window.__nativeSnapshot);});
    await compact.emulateMedia({reducedMotion:'reduce'});
    await compact.waitForFunction(()=>document.querySelector('.pet-animated-sprite')?.dataset.playback==='reduced-motion');
    assert.equal(await compact.locator(active).getAttribute('data-action'),'focus');
    assert.equal(await compact.locator(active).getAttribute('data-frame'),'0');
    const frozen=await compact.locator(active).screenshot(); await compact.waitForTimeout(700);
    assert.equal(await compact.locator(active).getAttribute('data-frame'),'0','reduced motion keeps frame zero of the current behavior');
    assert.deepEqual(await compact.locator(active).screenshot(),frozen,'reduced motion preserves a still pose');
    await compact.emulateMedia({reducedMotion:'no-preference'}); await playback(compact,active,'focus','compact/resumed-focus');
    await compact.locator('.pet-character').hover();await compact.click('.pet-panel-toggle');await compact.setViewportSize({width:380,height:700});
    for(const language of ['en','zh']) {
      await compact.evaluate(language=>{
        Object.assign(window.__nativeSnapshot.pet,{en:'AlexandriaTheStarlitGardenCompanionForever',zh:'喜欢安静阅读和认真记录每一个小小想法的伙伴'});
        window.__nativeSnapshot.language=language;window.__nativeState(window.__nativeSnapshot);
      },language);
      const overflow=await compact.locator('.pet-home').evaluate(home=>{
        const identity=home.querySelector('.pet-identity').getBoundingClientRect();
        return [...home.querySelectorAll('.pet-name,.pet-mood')].some(el=>{const r=el.getBoundingClientRect();return r.left<identity.left||r.right>identity.right;})||home.scrollWidth>innerWidth;
      });
      assert.equal(overflow,false,'expanded long identity fits/'+language);
      await compact.screenshot({path:path.join(profile,'expanded-long-name-'+language+'.png'),omitBackground:true});
    }
    await page.evaluate(image=>{
      const state=Tracer.pet.read();TracerPetModel.addCustom(state,{id:'custom_'+ 'b'.repeat(32),image,name:'Legacy portrait',kind:'creature',personality:''});
      const raw=JSON.stringify(state);localStorage.setItem('tracer.pet.v1',raw);dispatchEvent(new StorageEvent('storage',{key:'tracer.pet.v1',newValue:raw}));Tracer.pet.refresh(true);
    },legacyPath);
    assert.equal(await page.locator('.pet-character img.pet-custom-sprite').getAttribute('src'),legacyPath,'legacy custom portrait still displays normally');
    assert.equal(await page.locator('.pet-character .pet-animated-sprite').count(),0);
    assert.equal(await page.locator('.pet-home').evaluate(el=>el.classList.contains('has-animation-pack')),false);
    await page.evaluate(()=>Tracer.pet.action('select','sprout'));assert.ok(await page.locator('.pet-character svg.pet-sprite').isVisible(),'earned companions retain their existing art');
    // Starting over drops a partial pack only; it does not send another request or discard the reference.
    await page.click('[data-tab="collection"]');await page.click('[data-act="open-create"]');
    await page.locator('#pet-photo').setInputFiles({name:'synthetic-reference.png',mimeType:'image/png',buffer:art.portrait});
    await page.fill('#pet-custom-name','Keep my reference');await page.selectOption('#pet-custom-kind','humanoid');
    await page.fill('#pet-custom-personality','Calm and kind.');await page.fill('#pet-distinctive-features','Keep the brown hair.');
    await page.locator('.pet-photo-preview').waitFor({state:'visible'});
    const restartPhoto=await page.locator('.pet-photo-preview').getAttribute('src');failPage=1;
    await page.click('.pet-generate');await page.locator('.pet-restart-generation').waitFor({state:'visible'});
    const beforeRestart=calls.length;assert.equal(await page.locator('.pet-animation-progress').getAttribute('value'),'1');
    await page.click('.pet-restart-generation');
    assert.equal(calls.length,beforeRestart,'Start over never automatically regenerates');
    assert.equal(await page.locator('.pet-result-frame .pet-animated-sprite').count(),0);
    assert.equal(await page.locator('.pet-animation-progress').isVisible(),false);
    assert.equal(await page.locator('.pet-adopt').isVisible(),false);
    assert.equal(await page.locator('.pet-photo-preview').getAttribute('src'),restartPhoto);
    assert.equal(await page.inputValue('#pet-custom-name'),'Keep my reference');assert.equal(await page.inputValue('#pet-custom-kind'),'humanoid');
    assert.equal(await page.inputValue('#pet-custom-personality'),'Calm and kind.');assert.equal(await page.inputValue('#pet-distinctive-features'),'Keep the brown hair.');
    assert.equal(await page.inputValue('#pet-image-source'),'codex');
    assert.equal(personalCalls,0);assert.deepEqual(errors,[],'no renderer errors');
    console.log(process.env.TRACER_QA_LAYOUT_ONLY?'PASS 16 action routes, generation retry, compact speech clearance at 70/100/180 percent, long bilingual names and responsive layouts':'PASS 16 genuine frame behaviors, transparent atlas validation, partial retry without regeneration, manifest/model persistence, care/focus/sleep/drag/idle routing, reduced motion, static legacy and responsive compact/main views');
    console.log('Artifacts: '+profile);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
module.exports={fixtures};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
