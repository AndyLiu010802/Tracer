'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const M=require('../skins/tracer/model');
const S=require('../public/workspace-sync');
const task=(title,overrides={})=>({title,notes:'Keep the reviewed requirements.',due:'2030-06-14',scheduled:'2030-06-12',priority:'high',estimate:2.5,checklist:['Review requirements','Check the result'],...overrides});
const tasks={type:'tasks',project:null,tasks:[task('Write the release checklist')]};
const project={type:'project',project:{name:'A thoughtful release',notes:'Ship a small, well-tested improvement.',start:'2030-06-10',end:'2030-06-20'},tasks:[task('Prepare the plan'),task('Review the implementation',{priority:'medium',estimate:0,checklist:[]})]};
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
async function until(fn,label,timeout=20000){const start=Date.now();while(!await fn()){if(Date.now()-start>timeout)throw new Error('Timed out: '+label);await tick();}}
async function stored(page,surface='main',pet='sprout'){return page.evaluate(({surface,pet})=>TracerPetChatState.create({surface,petId:pet}).load(),{surface,pet});}
async function chat(page,mock,message,response){mock.responses.push(response);await page.fill('#pet-message',message);await page.press('#pet-message','Enter');if(response.hold){await until(()=>mock.releaseChat,'held chat request');return;}await page.waitForFunction(()=>!document.querySelector('.pet-send').disabled);if(response.error)await page.locator('.pet-chat-retry').waitFor();else await page.locator('.pet-chat-assistant').last().waitFor();}

async function main(){
  const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(root,'.cache'),{recursive:true});
  const artifacts=fs.mkdtempSync(path.join(root,'.cache/companion-work-')),data=path.join(artifacts,'data');fs.mkdirSync(data);
  const initial=S.empty();M.addTask(initial,{title:'PRIVATE EXISTING TASK - DO NOT SEND',notes:'Private existing notes'});fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(initial));
  Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(artifacts,'state.json')});
  const {server}=require('../server');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({channel:process.env.TRACER_QA_BROWSER||'msedge',headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
    const mock={responses:[],calls:[],external:[],unexpected:[],errors:[],writes:[],failPut:false,holdPut:false,releasePut:null,releaseChat:null};
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin!==origin){mock.external.push(url.origin+url.pathname);return route.abort();}
      if(url.pathname==='/api/store/workspace'&&request.method()==='PUT'){
        mock.writes.push(request.postDataJSON());
        if(mock.failPut){mock.failPut=false;return route.fulfill({status:503,json:{error:'synthetic-save-failure'}});}
        if(mock.holdPut){mock.holdPut=false;await new Promise(resolve=>mock.releasePut=resolve);mock.releasePut=null;}
      }
      if(url.pathname.startsWith('/api/ai/')){
        if(url.pathname.endsWith('-status'))return route.fulfill({json:{configured:true,imageGeneration:true,account:{type:'chatgpt'}}});
        if(!url.pathname.endsWith('-chat')){mock.unexpected.push(url.pathname);return route.fulfill({status:503,json:{error:'unexpected-ai-request'}});}
        const body=request.postDataJSON();mock.calls.push(body);const next=mock.responses.shift();
        if(!next){mock.unexpected.push('unplanned-chat');return route.fulfill({status:503,json:{error:'no-qa-response'}});}
        if(next.hold){await new Promise(resolve=>mock.releaseChat=resolve);mock.releaseChat=null;}
        try{return next.error?await route.fulfill({status:503,json:{error:next.error}}):await route.fulfill({json:{reply:next.reply,proposal:next.proposal??null}});}catch(error){if(!next.hold)throw error;return;}
      }
      return route.continue();
    });
    const page=await context.newPage();page.on('pageerror',error=>mock.errors.push(error.message));
    await page.goto(origin);await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data&&window.TracerCompanionWork&&window.TracerPetChatState);
    await page.selectOption('#language-select','en');await page.click('#pet-open');await page.click('[data-tab=chat]');
    await chat(page,mock,'Help me make a task.',{reply:'What should be done, and when is it due?'});
    assert.equal(await page.locator('.pet-work-preview').isVisible(),false);assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),1);
    await chat(page,mock,'Write a release checklist by June 14, 2030.',{reply:'Here is the task for your review.',proposal:tasks});
    await page.locator('[data-act=confirm-work]').waitFor();
    await page.locator('.pet-work-preview').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(artifacts,'main-task-preview.png'),animations:'disabled'});
    let state=await stored(page),firstId=state.work.requestId;
    assert.deepEqual(state.work.proposal,tasks);assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),1);
    const preview=await page.locator('.pet-work-preview').innerText();for(const content of ['Write the release checklist','2030-06-14','2030-06-12','2.5 hours','High','Review requirements','Check the result'])assert.ok(preview.includes(content),content+' appears before creation');
    await page.click('[data-act=edit-work]');assert.equal(await page.locator('[data-act=confirm-work]').isDisabled(),true);
    await chat(page,mock,'Move its deadline.',{reply:'Which date would you prefer?'});
    assert.equal(await page.locator('.pet-work-preview').isVisible(),false);assert.deepEqual(mock.calls.at(-1).proposal,tasks);
    const revised={...tasks,tasks:[{...tasks.tasks[0],due:'2030-06-15'}]};
    await chat(page,mock,'June 15, 2030.',{reply:'I updated the date. Please check it.',proposal:revised});
    state=await stored(page);assert.notEqual(state.work.requestId,firstId);assert.deepEqual(mock.calls.at(-1).proposal,tasks,'a follow-up question retains the validated draft context');
    const requestId=state.work.requestId;
    await page.evaluate(()=>{window.__qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('tracer.petChat.v1.'))throw new DOMException('synthetic-quota','QuotaExceededError');return window.__qaSetItem.call(this,key,value);};});
    const writesBefore=mock.writes.length;await page.click('[data-act=confirm-work]');
    await page.waitForFunction(()=>document.querySelector('.pet-chat-storage-error').textContent.length>0);
    assert.equal(mock.writes.length,writesBefore);assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),1,'failed proposal persistence prevents creation');
    await page.evaluate(()=>{Storage.prototype.setItem=window.__qaSetItem;});
    mock.failPut=true;await page.click('[data-act=confirm-work]');
    await page.locator('.pet-work-preview[data-status=failed]').waitFor();
    assert.equal((await stored(page)).work.requestId,requestId);assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),2);
    for(const selector of ['[data-act=edit-work]','[data-act=cancel-work]','[data-act=clear-chat]','.pet-send'])assert.equal(await page.locator(selector).isDisabled(),true,'an unconfirmed creation locks '+selector);
    const chatsBefore=mock.calls.length;await page.fill('#pet-message','Change the pending request into another task.');await page.press('#pet-message','Enter');
    await page.evaluate(()=>document.querySelector('.pet-chat-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    assert.equal(mock.calls.length,chatsBefore);assert.equal((await stored(page)).work.requestId,requestId,'unconfirmed work cannot be replaced by a new request ID');
    assert.equal((await (await fetch(origin+'/api/store/workspace')).json()).tasks.length,1,'failed PUT does not claim durable creation');
    mock.holdPut=true;await page.click('[data-act=confirm-work]');await until(()=>mock.releasePut,'creation retry PUT');
    assert.equal(await page.locator('[data-act=confirm-work]').isDisabled(),true);assert.equal(await page.locator('[data-act=clear-chat]').isDisabled(),true);
    await page.fill('#pet-message','Keep this new draft while the task saves.');
    await page.locator('.pet-top [data-act=close]').click();
    await page.click('#pet-open');await page.locator('.pet-work-preview[data-status=failed]').waitFor();
    assert.equal(await page.locator('.pet-send').isDisabled(),true,'reopening before completion retains the unknown-result lock');
    await page.fill('#pet-message','Keep the newer draft from the reopened window.');mock.releasePut();
    await until(async()=>(await stored(page))?.work?.status==='created','closed view stores final creation status');
    await page.locator('.pet-work-preview[data-status=created]').waitFor();
    assert.equal(await page.inputValue('#pet-message'),'Keep the newer draft from the reopened window.');assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),2);
    const savedTasks=(await (await fetch(origin+'/api/store/workspace')).json()).tasks;assert.equal(savedTasks.length,2);assert.equal(savedTasks[1].due,'2030-06-15');
    await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);await page.click('#pet-open');await page.locator('.pet-work-preview[data-status=created]').waitFor();
    assert.equal((await stored(page)).work.requestId,requestId);
    await chat(page,mock,'Thank you. How are you?',{reply:'Happy to spend a little time with you.'});assert.equal(await page.locator('.pet-work-preview').isVisible(),false);assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),2);
    await page.screenshot({path:path.join(artifacts,'main-chat-created.png'),animations:'disabled'});
    for(const request of mock.calls){assert.match(request.today,/^\d{4}-\d{2}-\d{2}$/);assert.equal(JSON.stringify(request).includes('PRIVATE EXISTING TASK'),false);assert.equal('workspace' in request,false);assert.equal('tasks' in request,false);}
    console.log('PASS follow-up questions, full field preview, revision context, explicit creation, storage failure protection, failed PUT retry and close/reload recovery');

    const snapshot=await page.evaluate(()=>{const state=Tracer.pet.read(),pet=TracerPetModel.catalog(state).find(pet=>pet.id===state.selected);return {pet,language:'zh',catalog:TracerPetModel.catalog(state),needs:TracerPetModel.current(state),mood:'happy',unlocked:state.unlocked,metrics:{},focus:{running:false,completed:false,clock:'25:00'},reminders:true,snoozedUntil:0,lastAction:'',lastActionAt:0,task:null,reminder:null};});
    const native=await context.newPage();await native.setViewportSize({width:380,height:880});native.on('pageerror',error=>mock.errors.push(error.message));
    const nativeCalls=[];let failNative=true;
    await native.exposeBinding('__qaNativeCreate',async(_source,request)=>{nativeCalls.push(request);if(failNative){failNative=false;throw new Error('synthetic-ipc-failure');}return page.evaluate(request=>Tracer.pet.action('create-work',request),request);});
    await native.addInitScript(()=>{window.PetDesktop={onState(fn){window.__qaNativeState=fn;},send(message){window.__qaNativeMessages=(window.__qaNativeMessages||[]).concat(message);},createWork:request=>window.__qaNativeCreate(request)};});
    const readyNative=async()=>{await native.goto(origin+'/pet.html');await native.waitForFunction(()=>!!window.__qaNativeState);await native.evaluate(snapshot=>window.__qaNativeState(snapshot),snapshot);await native.locator('.pet-character').hover();await native.click('[data-quick-act=expand]');await native.click('[data-tab=chat]');};
    await readyNative();assert.equal(await native.locator('.pet-work-preview').isVisible(),false,'main and native recovery keys do not collide');
    await chat(native,mock,'帮我建立发布项目和两项任务。',{reply:'项目名称、时间和任务如下，请确认。',proposal:project});
    await native.locator('.pet-work-preview').scrollIntoViewIfNeeded();
    assert.equal(await native.locator('.pet-work-preview').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'380px native preview has no horizontal overflow');
    await native.screenshot({path:path.join(artifacts,'native-project-preview-380px.png'),animations:'disabled'});
    const nativeId=(await stored(native,'native')).work.requestId;assert.equal(nativeCalls.length,0);
    await readyNative();assert.equal((await stored(native,'native')).work.requestId,nativeId);
    await native.click('[data-act=confirm-work]');await native.locator('.pet-work-preview[data-status=failed]').waitFor();
    await native.click('[data-act=confirm-work]');await native.locator('.pet-work-preview[data-status=created]').waitFor();
    assert.equal(nativeCalls.length,2);assert.equal(nativeCalls[0].requestId,nativeCalls[1].requestId);assert.equal(nativeCalls[0].requestId,nativeId);
    assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),4);assert.equal(await page.evaluate(()=>Tracer.store.data.projects.length),1);
    assert.equal((await stored(native,'native')).work.result.taskIds.length,2);
    await chat(native,mock,'再建一个我稍后决定的任务。',{reply:'请先查看这项任务。',proposal:tasks});await native.click('[data-act=cancel-work]');assert.equal(await native.locator('.pet-work-preview').isVisible(),false);assert.equal(nativeCalls.length,2);
    await chat(native,mock,'普通聊天失败后重试。',{error:'synthetic-chat-failure'});const callsBefore=mock.calls.length;
    mock.responses.push({reply:'收到，我们继续聊。'});await native.click('[data-act=retry-chat]');await native.waitForFunction(()=>!document.querySelector('.pet-send').disabled);assert.equal(mock.calls.length,callsBefore+1);
    await chat(native,mock,'这条回复将晚到。',{hold:true,reply:'不应出现在另一个伙伴这里。',proposal:tasks});
    const switched={...snapshot,pet:await page.evaluate(()=>TracerPetModel.pets.find(pet=>pet.id==='miso'))};await native.evaluate(value=>window.__qaNativeState(value),switched);mock.releaseChat();
    await until(()=>mock.releaseChat===null,'aborted prior companion reply settles');assert.equal(await native.locator('.pet-work-preview').isVisible(),false);assert.equal(await native.locator('.pet-chat-log').innerText(),'小伙伴在这里，等你开口。');
    await chat(native,mock,'清空时也不能接受旧回复。',{hold:true,reply:'这条也应丢弃。',proposal:tasks});await native.click('[data-act=clear-chat]');mock.releaseChat();await until(()=>mock.releaseChat===null,'cleared chat settles');assert.equal(await native.locator('.pet-work-preview').isVisible(),false);
    assert.equal(nativeCalls.length,2);assert.deepEqual(mock.external,[]);assert.deepEqual(mock.unexpected,[]);assert.deepEqual(mock.errors,[]);
    console.log('PASS native 380px project preview, persisted proposal identity, IPC retry, project + tasks, cancellation, normal chat retry and stale response protection');
    console.log('Artifacts: '+artifacts);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
