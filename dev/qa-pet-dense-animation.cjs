'use strict';
// Isolated v2 QA: synthetic PNGs, mocked generation and real local package routes.
// No user profile, source photograph, paid image generation or AI account is used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const Images=require('../lib/pet-image');
const {fixtures:legacyFixtures}=require('./qa-pet-animation.cjs');
const root=path.resolve(__dirname,'..');
const actions=['idle','pet','feed','play','sleep','wake','focus','drag','fishing','exercise','farming','mining','reading','writing','crafting','tea'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

async function fixtures(page) {
  const result=await page.evaluate(actions=>{
    function pose(ctx,action,frame) {
      const box=(color,x,y,w,h)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
      const angle=frame*Math.PI/8,handX=22+Math.round(Math.cos(angle)*4),handY=16+Math.round(Math.sin(angle)*6);
      const skin='#e9bc93',hair='#654530',shirt='#6ba08d',ink='#24302c';
      // The head and torso stay anchored; articulated arms describe sixteen poses.
      box(skin,11,5,10,11);box(hair,10,4,12,5);box(hair,10,8,3,3);
      box(ink,14,10,1,action==='sleep'?1:2);box(ink,18,10,1,action==='sleep'?1:2);
      box('#a96d60',15,14,3,1);box(shirt,9,16,14,10);
      box(skin,6+Math.round(Math.sin(angle)*2),16+Math.round(Math.cos(angle)*3),4,7);
      box(skin,21,17,Math.max(2,handX-20),3);box(skin,handX,Math.min(18,handY),3,Math.abs(18-handY)+3);
      box('#394b5b',10,26,5,4);box('#394b5b',18,26,5,4);box('#d9e9d4',11,18,3,3);
      if(action==='pet'){box('#e394a5',25,3,3,3);box('#e394a5',24,5,5,2);}
      if(action==='feed'){box('#f1ad65',4,25,5,4);box('#7fac75',6,23,2,2);}
      if(action==='play')box('#85b8d0',3,27,5,4);
      if(action==='focus'||action==='crafting'){box('#846c58',3,27,26,2);box('#b9d4de',11,23,9,4);}
      if(action==='drag'){box('#f2d996',3,6,2,5);box('#f2d996',28,8,2,5);}
      if(action==='fishing'){box('#ac825b',28,5,1,24);box('#8bc6de',20,30,11,1);}
      if(action==='exercise'){box(ink,2,12,8,2);box(ink,2,10,2,6);box(ink,8,10,2,6);}
      if(action==='farming'){box('#e5b575',26,25,4,3);box('#8aba78',3,27,4,4);}
      if(action==='mining'){box('#ac825b',28,10,1,17);box('#aac1c7',24,9,7,2);box('#a69dcc',2,27,6,4);}
      if(action==='reading'||action==='writing'){box('#e9dfbe',7,25,17,5);box('#746a64',15,25,1,5);}
      if(action==='tea'){box('#b9d4de',25,26,4,4);box('#b9d4de',29,27,2,2);}
    }
    const sheets=actions.map(action=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
      const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
      for(let frame=0;frame<16;frame++){
        ctx.save();ctx.translate((frame%4)*256+16,Math.floor(frame/4)*256+16);ctx.scale(7,7);pose(ctx,action,frame);ctx.restore();
      }
      return canvas.toDataURL('image/png').split(',')[1];
    });
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.translate(16,16);ctx.scale(7,7);pose(ctx,'idle',0);
    return {sheets,portrait:canvas.toDataURL('image/png').split(',')[1]};
  },actions);
  return {sheets:result.sheets.map(value=>Buffer.from(value,'base64')),portrait:Buffer.from(result.portrait,'base64')};
}

async function ready(page,origin) {
  await page.goto(origin);await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);await page.selectOption('#language-select','en');
}

async function playback(browser,origin,profile,record,legacyPages) {
  const page=await browser.newPage({viewport:{width:1100,height:900}});
  await ready(page,origin);
  await page.clock.install({time:new Date('2030-01-01T12:00:00Z')});
  await page.clock.pauseAt(new Date('2030-01-01T12:00:01Z'));
  await page.evaluate(record=>{
    const host=document.createElement('div');host.id='dense-qa';
    Object.assign(host.style,{position:'fixed',inset:'20px auto auto 20px',width:'224px',height:'224px',padding:'16px',boxSizing:'border-box',background:'#172229',zIndex:99999});
    document.body.appendChild(host);window.__densePlayer=TracerPetAnimation.create({...record,label:'Sixteen-frame QA'});
    Object.assign(window.__densePlayer.element.style,{width:'192px',height:'192px'});host.appendChild(window.__densePlayer.element);
  },record);
  const selector='#dense-qa .pet-animated-sprite',sprite=page.locator(selector);
  for(const [actionIndex,action] of actions.entries()) {
    await page.evaluate(action=>window.__densePlayer.setAction(action),action);
    await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.playback==='playing',selector);
    const timings=await page.evaluate(action=>TracerPetAnimation.denseClips[action].frameMs,action),pictures=new Set();
    assert.equal(timings.length,16,action+' has sixteen frame durations');
    for(let frame=0;frame<16;frame++) {
      assert.equal(await sprite.getAttribute('data-action'),action);
      assert.equal(await sprite.getAttribute('data-page'),String(actionIndex),action+' owns one complete sheet');
      assert.equal(await sprite.getAttribute('data-frame'),String(frame),action+' visits every frame in sequence');
      const crop=await sprite.evaluate(el=>{
        const image=el.querySelector('.pet-animation-sheet'),host=el.getBoundingClientRect(),bounds=image.getBoundingClientRect();
        return {transform:image.style.transform,width:bounds.width/host.width,height:bounds.height/host.height,overflow:getComputedStyle(el).overflow,bodyAnimation:getComputedStyle(el).animationName,loaded:image.complete&&image.naturalWidth===1024};
      });
      assert.equal(crop.transform,'translate('+(-(frame%4)*25)+'%, '+(-Math.floor(frame/4)*25)+'%)',action+' crops row-major cells');
      assert.equal(crop.overflow,'hidden');assert.equal(crop.bodyAnimation,'none');assert.ok(crop.loaded);
      assert.ok(Math.abs(crop.width-4)<.01&&Math.abs(crop.height-4)<.01);
      const shot=await sprite.screenshot();pictures.add(hash(shot));
      if(action==='fishing')fs.writeFileSync(path.join(profile,'fishing-frame-'+String(frame).padStart(2,'0')+'.png'),shot);
      await page.clock.runFor(timings[frame]);
    }
    assert.equal(await sprite.getAttribute('data-frame'),'0',action+' returns to the first pose');
    assert.equal(pictures.size,16,action+' displays sixteen distinct actual image frames');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.clock.runFor(50);
  assert.equal(await sprite.getAttribute('data-playback'),'reduced-motion');assert.equal(await sprite.getAttribute('data-frame'),'0');
  const still=await sprite.screenshot();await page.clock.runFor(10000);assert.deepEqual(await sprite.screenshot(),still);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.clock.runFor(50);
  for(const count of [3,4]) {
    await page.evaluate(pages=>{
      window.__densePlayer.destroy();document.querySelector('#dense-qa').replaceChildren();
      window.__densePlayer=TracerPetAnimation.create({image:pages[0],animation:{version:1,pages}});
      Object.assign(window.__densePlayer.element.style,{width:'192px',height:'192px'});document.querySelector('#dense-qa').appendChild(window.__densePlayer.element);
    },legacyPages.slice(0,count));
    await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.playback==='playing',selector);
    const timings=await page.evaluate(()=>TracerPetAnimation.clips.idle.frameMs);
    for(let frame=0;frame<4;frame++){assert.equal(await sprite.getAttribute('data-frame'),String(frame));await page.clock.runFor(timings[frame]);}
    assert.equal(await sprite.getAttribute('data-frame'),'0','legacy '+count+'-sheet pack keeps its four-frame loop');
  }
  await page.close();
}

async function transfer(browser,origin,source,profile,record) {
  await source.evaluate(()=>Tracer.pet.open());await source.click('[data-tab="collection"]');await source.click('[data-act="open-export"]');
  assert.match(await source.locator('.pet-transfer-kind').innerText(),/16 behaviors/);
  const downloaded=source.waitForEvent('download');await source.click('.pet-transfer-submit');
  const download=await downloaded,file=path.join(profile,'dense-companion.tracer-pet');await download.saveAs(file);
  const pack=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(pack.version,2);assert.equal(pack.artwork.animationVersion,2);assert.equal(pack.artwork.images.length,16);
  const receiver=await browser.newContext({viewport:{width:1100,height:900}});
  await receiver.route('**/api/ai/**',route=>route.fulfill({status:503,json:{error:'no-ai-account'}}));
  const page=await receiver.newPage();await ready(page,origin);
  await page.click('#pet-open');await page.click('[data-tab="collection"]');await page.click('[data-act="open-import"]');
  await page.locator('#pet-package-file').setInputFiles(file);await page.locator('.pet-transfer-submit:not([disabled])').waitFor();
  assert.match(await page.locator('.pet-transfer-kind').innerText(),/16 behaviors/);
  await page.click('.pet-transfer-submit');await page.locator('.pet-character .pet-animated-sprite').waitFor();
  const imported=await page.evaluate(()=>Tracer.pet.read().customs[0]);
  assert.equal(imported.name,record.name);assert.equal(imported.animation.version,2);assert.equal(imported.animation.pages.length,16);
  assert.equal(await page.evaluate(()=>TracerPetModel.current(Tracer.pet.read()).bond),0);
  await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
  assert.deepEqual(await page.evaluate(()=>Tracer.pet.read().customs[0]),imported,'dense imported manifest survives restart');
  for(const [index,url] of imported.animation.pages.entries()) {
    const bytes=await Images.readAsset(path.join(profile,'data'),url);assert.equal(hash(bytes),pack.artwork.images[index].sha256);
  }
  await receiver.close();
}

async function main() {
  const profile=fs.mkdtempSync(path.join(root,'.cache/pet-dense-animation-')),data=path.join(profile,'data');
  Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(profile,'bookmarks.json')});
  const {server}=require('../server');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'msedge',headless:true}),origin='http://127.0.0.1:'+server.address().port;
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),calls=[],errors=[],pagePaths=[];
    let failPage=5,personalCalls=0;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/ai/codex-status',route=>route.fulfill({json:{configured:true,account:{type:'chatgpt',planType:'pro'},imageGeneration:true}}));
    await page.route('**/api/ai/personal-status',route=>route.fulfill({json:{configured:true,tested:true,hasKey:true,url:'https://mock.invalid/v1'}}));
    await page.route('**/api/ai/personal-pet-image',route=>{personalCalls++;return route.fulfill({status:500,json:{error:'unexpected-api-fallback'}});});
    await page.route('**/api/ai/codex-pet-image',route=>{
      const request=route.request().postDataJSON();calls.push(request);
      assert.equal(request.animationVersion,2,'new creation explicitly requests dense artwork');
      if(request.animationPage===failPage){failPage=-1;return route.fulfill({status:400,json:{error:'codex-image-no-result'}});}
      return route.fulfill({json:{image:pagePaths[request.animationPage],animationPage:request.animationPage,animationVersion:2,model:'synthetic-dense-animation'}});
    });
    await ready(page,origin);const art=await fixtures(page),legacy=await legacyFixtures(page),legacyPages=[];
    for(const sheet of art.sheets)pagePaths.push(await Images.storeGenerated(data,sheet));
    for(const sheet of legacy.sheets)legacyPages.push(await Images.storeGenerated(data,sheet));
    fs.writeFileSync(path.join(profile,'synthetic-fishing-sheet.png'),art.sheets[8]);
    for(const url of pagePaths)assert.equal((await page.evaluate(image=>TracerPetAnimation.validatePage(image,{version:2}),url)).frames,16);
    await page.click('#pet-open');await page.click('[data-tab="collection"]');await page.click('[data-act="open-create"]');
    await page.locator('#pet-photo').setInputFiles({name:'synthetic-reference.png',mimeType:'image/png',buffer:art.portrait});
    await page.fill('#pet-custom-name','Juniper Dense');await page.selectOption('#pet-custom-kind','humanoid');
    await page.fill('#pet-custom-personality','Patient and curious.');await page.fill('#pet-distinctive-features','Keep the green shirt and brown hair.');
    await page.locator('.pet-photo-preview').waitFor({state:'visible'});const photo=await page.locator('.pet-photo-preview').getAttribute('src');
    assert.equal(calls.length,0);await page.click('.pet-generate');
    await page.waitForFunction(()=>!document.querySelector('.pet-generate').disabled&&document.querySelector('.pet-create-error').textContent.includes('returned no image'));
    assert.deepEqual(calls.map(call=>call.animationPage),[0,1,2,3,4,5]);assert.equal(await page.locator('.pet-animation-progress').getAttribute('value'),'5');
    assert.equal(await page.locator('.pet-adopt').isVisible(),false);assert.equal(await page.locator('.pet-photo-preview').getAttribute('src'),photo);
    await page.click('.pet-generate');await page.locator('.pet-adopt').waitFor({state:'visible'});
    assert.deepEqual(calls.map(call=>call.animationPage),[0,1,2,3,4,5,...Array.from({length:11},(_,i)=>i+5)]);
    assert.equal(await page.locator('.pet-animation-progress').getAttribute('value'),'16');
    for(const call of calls){assert.equal(call.photo,photo);if(call.animationPage)assert.equal(call.identityImage,pagePaths[0]);}
    assert.equal(personalCalls,0,'generation retry never changes the selected provider');
    assert.deepEqual(await page.locator('#pet-preview-action option').evaluateAll(options=>options.map(option=>({value:option.value,disabled:option.disabled}))),actions.map(value=>({value,disabled:false})));
    for(const [index,action] of actions.entries()) {
      await page.selectOption('#pet-preview-action',action);
      assert.equal(await page.locator('.pet-result-frame .pet-animated-sprite').getAttribute('data-action'),action);
      assert.equal(await page.locator('.pet-result-frame .pet-animated-sprite').getAttribute('data-page'),String(index));
    }
    await page.screenshot({path:path.join(profile,'dense-generation-complete.png')});
    await page.click('.pet-adopt');await page.locator('.pet-character .pet-animated-sprite').waitFor();
    const saved=await page.evaluate(()=>Tracer.pet.read().customs[0]);assert.deepEqual(saved.animation,{version:2,pages:pagePaths});
    await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);assert.deepEqual(await page.evaluate(()=>Tracer.pet.read().customs[0]),saved);
    await playback(browser,origin,profile,saved,legacyPages);
    await transfer(browser,origin,page,profile,saved);
    assert.deepEqual(errors,[],'no creation renderer errors');
    console.log('PASS sixteen genuine frames for all sixteen actions, row-major playback and wrapping, legacy four-frame packs, reduced motion, sixteen-page creation with failed-action retry, save/reload and real dense export/import');
    console.log('Artifacts: '+profile);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
module.exports={fixtures};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
