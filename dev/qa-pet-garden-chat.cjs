'use strict';
// Isolated browser/server data, mocked AI transport, real request normalization.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const Chat=require('../lib/ai-companion');
const Pets=require('../skins/tracer/pet-model');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'.cache'),{recursive:true});
const artifacts=fs.mkdtempSync(path.join(root,'.cache/pet-garden-chat-'));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(artifacts,'data'),DOCS_PORTAL_STATE_FILE:path.join(artifacts,'state.json')});
const {server}=require('../server');
const legacyReply='你好呀，我是芽芽～（蓬松的小羊轻轻歪了歪头）今天想聊些什么？';
const ordered=[...Pets.gardenPets.filter(p=>p.plantKind==='apple'),...Pets.gardenPets.filter(p=>p.plantKind!=='apple')];

async function seedHistory(page,surface){
  await page.evaluate(({surface,legacyReply})=>{
    const store=TracerPetChatState.create({surface,petId:'garden_apple'});store.load();
    store.save({conversation:[{id:1,role:'user',content:'你好呀',status:'sent'},{id:2,role:'assistant',content:legacyReply}],draft:'',work:null,proposalContext:null});
  },{surface,legacyReply});
}
function gardenProfile(instructions){
  const marker=instructions.indexOf('Authored garden companion profile');
  assert.ok(marker>=0,'garden companions receive their own authored identity');
  const start=instructions.indexOf('{',marker),end=instructions.indexOf('}',start);
  assert.ok(start>=0&&end>start,'authored garden identity has a JSON profile');
  return JSON.parse(instructions.slice(start,end+1));
}
async function send(page,mock,message,expected){
  const before=mock.calls.length;
  await page.fill('#pet-message',message);await page.press('#pet-message','Enter');
  await page.waitForFunction(()=>!document.querySelector('.pet-send').disabled);
  assert.equal(mock.calls.length,before+1,'one user message produces one request');
  const call=mock.calls.at(-1);
  if(call.error)throw new Error(call.error);
  assert.equal(call.raw.pet,expected.id,'UI transmits the selected companion ID');
  assert.equal(call.normalized.pet,expected.id,'server preserves the selected companion ID');
  assert.equal(call.raw.language,expected.language);
  assert.equal(call.raw.messages.at(-1).content,message);
  assert.equal(await page.locator('.pet-chat-assistant').last().innerText(),call.reply);
  return call;
}
async function exercise(page,mock,surface,select){
  await select(Pets.pets[0],'zh');
  await page.click('[data-tab=chat]');
  const sproutMessage=surface+' sprout-only conversation';
  await send(page,mock,sproutMessage,{id:'sprout',language:'zh'});
  for(const pet of ordered){
    for(const language of ['zh','en']){
      await select(pet,language);await page.click('[data-tab=chat]');
      assert.equal(await page.locator('.pet-home').getAttribute('data-pet'),pet.id);
      assert.equal(await page.locator('.pet-name').innerText(),pet[language],'displayed name matches the canonical catalog');
      if(language==='zh')assert.equal((await page.locator('.pet-chat-log').innerText()).includes(sproutMessage),false,'switching keeps Sprout history out of garden chat');
      const mode=pet.shiny?'api':'codex';
      await page.evaluate(mode=>localStorage.setItem('tracer.ai.mode',mode),mode);
      const message=surface+' '+pet.id+' '+language+' identity check';
      const call=await send(page,mock,message,{id:pet.id,language});
      assert.equal(call.provider,pet.shiny?'personal':'codex','both provider request routes use the same garden identity');
      const profile=gardenProfile(call.instructions);
      assert.equal(profile.id,pet.id);assert.equal(profile.name,pet[language]);
      assert.equal(profile.plantKind,pet.plantKind);assert.equal(profile.shiny,pet.shiny);
      assert.match(call.instructions,/magical plant spirit/i);
      assert.doesNotMatch(call.instructions,/Authored built-in character profile|Cloud sheep|cloud sheep/);
      assert.ok(call.raw.messages.every(row=>Object.keys(row).sort().join(',')==='content,role'),'provider messages contain only role and content');
      assert.equal(call.raw.messages.some(row=>row.content===sproutMessage),false,'Sprout history never crosses companion IDs');
      const earlierUsers=call.raw.messages.filter(row=>row.role==='user'&&row.content!==message);
      assert.ok(earlierUsers.every(row=>row.content==='你好呀'||row.content.startsWith(surface+' '+pet.id+' ')),'history belongs only to the current surface and pet');
      if(pet.id==='garden_apple'){
        assert.ok(call.raw.messages.some(row=>row.role==='assistant'&&row.content===legacyReply),'old incorrect assistant reply is preserved verbatim');
        assert.ok(Chat.conversation(call.normalized).some(row=>row.role==='assistant'&&row.content===legacyReply),'provider history preserves the old reply without changing the current profile');
      }
      if(pet.plantKind==='apple'&&language==='zh')await page.screenshot({path:path.join(artifacts,surface+'-'+pet.id+'-zh.png'),animations:'disabled'});
    }
  }
  await select(Pets.pets[0],'zh');await page.click('[data-tab=chat]');
  const restored=await page.locator('.pet-chat-log').innerText();
  assert.ok(restored.includes(sproutMessage),'switching back restores only Sprout conversation');
  assert.equal(restored.includes('garden_apple'),false);
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  let browser;
  const mock={calls:[],external:[],unexpected:[],errors:[]};
  try{
    browser=await chromium.launch({channel:process.env.TRACER_QA_BROWSER||'msedge',headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin!==origin){mock.external.push(url.origin+url.pathname);return route.abort();}
      if(!url.pathname.startsWith('/api/ai/'))return route.continue();
      if(url.pathname.endsWith('-status'))return route.fulfill({json:{configured:true,tested:true,account:{type:'chatgpt',planType:'pro'}}});
      if(!/^\/api\/ai\/(personal|codex)-chat$/.test(url.pathname)){mock.unexpected.push(url.pathname);return route.fulfill({status:503,json:{error:'unexpected-ai-request'}});}
      const call={provider:url.pathname.includes('personal')?'personal':'codex',raw:request.postDataJSON()};mock.calls.push(call);
      try{
        call.normalized=Chat.input(call.raw);call.instructions=Chat.instructions(call.normalized);
        const pet=Pets.gardenPets.find(p=>p.id===call.normalized.pet)||Pets.pets.find(p=>p.id===call.normalized.pet);
        call.reply='QA identity: '+pet[call.normalized.language]+' ('+pet.id+')';
        return route.fulfill({json:{reply:call.reply,proposal:null}});
      }catch(error){call.error=error.stack;return route.fulfill({status:500,json:{error:'qa-normalization-failed'}});}
    });
    const page=await context.newPage();page.on('pageerror',error=>mock.errors.push(error.message));
    await page.goto(origin);await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data&&window.TracerPetChatState);
    await page.evaluate(()=>{
      const state=Tracer.pet.read();state.unlocked=TracerPetModel.pets.concat(TracerPetModel.gardenPets).map(p=>p.id);state.reminders=false;
      const raw=JSON.stringify(state);localStorage.setItem('tracer.pet.v1',raw);dispatchEvent(new StorageEvent('storage',{key:'tracer.pet.v1',newValue:raw}));Tracer.pet.refresh(true);
    });
    await seedHistory(page,'main');await page.click('#pet-open');
    const selectMain=async(pet,language)=>{await page.selectOption('#language-select',language);await page.evaluate(id=>Tracer.pet.action('select',id),pet.id);};
    await exercise(page,mock,'main',selectMain);
    const snapshot=await page.evaluate(()=>{const state=Tracer.pet.read();return {accountScope:window.TracerAccount?.scope||'guest',accountGeneration:window.TracerAccount?.context.generation||0,pet:TracerPetModel.pets[0],language:'zh',catalog:TracerPetModel.catalog(state),needs:TracerPetModel.current(state),mood:'happy',unlocked:state.unlocked,metrics:{},focus:{running:false,completed:false,clock:'25:00'},reminders:false,snoozedUntil:0,lastAction:'',lastActionAt:0,task:null,reminder:null};});
    const native=await context.newPage();await native.setViewportSize({width:520,height:1000});native.on('pageerror',error=>mock.errors.push(error.message));
    await native.addInitScript(()=>{window.PetDesktop={onState(fn){window.__qaNativeState=fn;},send(){}};});
    await native.goto(origin+'/pet.html');await native.waitForFunction(()=>!!window.__qaNativeState&&!!window.TracerPetChatState);
    await seedHistory(native,'native');
    const selectNative=async(pet,language)=>native.evaluate(value=>window.__qaNativeState(value),{...snapshot,pet,language});
    await selectNative(Pets.pets[0],'zh');await native.locator('.pet-character').hover();await native.click('[data-quick-act=expand]');
    await exercise(native,mock,'native',selectNative);
    assert.deepEqual(mock.external,[]);assert.deepEqual(mock.unexpected,[]);assert.deepEqual(mock.errors,[]);
    fs.writeFileSync(path.join(artifacts,'requests.json'),JSON.stringify(mock.calls,null,2));
    assert.equal(mock.calls.length,74,'two surfaces each check Sprout and all 18 garden companions in both languages');
    console.log('PASS all 18 garden identities in Chinese/English on main + native views; both provider routes; Sprout switches, isolated history and preserved legacy replies.');
    console.log('Artifacts: '+artifacts);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
