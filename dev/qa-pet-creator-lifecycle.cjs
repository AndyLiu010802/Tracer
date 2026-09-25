'use strict';
// Isolated creator lifecycle checks. All image services and validation are mocked;
// no user profile, credentials, real photograph, or image allowance is used.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const creatorSource=fs.readFileSync(path.join(__dirname,'../skins/tracer/pet-creator.js'),'utf8');
const server=http.createServer((request,response)=>{
  response.setHeader('Content-Type','text/html; charset=utf-8');
  response.end('<!doctype html><html><body><main id="fixture"></main></body></html>');
});

async function idle(page) { await page.waitForFunction(()=>!window.creator.status().busy); }
async function generate(page) { await page.locator('.pet-generate').click(); await idle(page); }
async function snapshot(page) { return page.evaluate(()=>({draft:creator.read(),status:creator.status(),calls:mock.calls,completions:mock.completions,changes:mock.changes,confirmations:mock.confirmations})); }

async function singleActionCases(page) {
  await page.evaluate(()=>{mock.accept=false;mount(fixtureDraft(16));});
  await page.selectOption('#pet-preview-action','fishing');
  const original=await snapshot(page),identity=original.draft.pages[0];
  await page.click('.pet-regenerate-action');await idle(page);
  let state=await snapshot(page);
  assert.equal(state.calls.length,original.calls.length,'cancelled action replacement makes no request');
  assert.deepEqual(state.draft.pages,original.draft.pages);
  assert.deepEqual(state.draft.pageAttempts,original.draft.pageAttempts);

  await page.evaluate(()=>{mock.accept=true;mock.holdNext=true;mock.imageOverrides[8]=sheetURL(72);});
  await page.click('.pet-regenerate-action');
  await page.waitForFunction(()=>!!mock.releaseRequest);
  state=await snapshot(page);
  assert.deepEqual(state.draft.pages,original.draft.pages,'all old pages remain available while replacing one action');
  assert.equal(state.status.busy,true);
  assert.equal(await page.locator('.pet-adopt').isDisabled(),true);
  assert.equal(await page.locator('.pet-regenerate-action').isDisabled(),true);
  assert.equal(await page.locator('.pet-keep-action').isDisabled(),true);
  assert.equal(state.calls.length,original.calls.length+1);
  assert.equal(state.calls.at(-1).animationPage,8);
  assert.equal(state.calls.at(-1).generationAttempt,1);
  assert.equal(state.calls.at(-1).generationId,original.draft.generationId);
  assert.equal(state.calls.at(-1).identityImage,identity);
  assert.deepEqual(state.draft.pendingReplacement,{pageIndex:8,attempt:1,identityImage:identity});
  assert.ok(await page.evaluate(before=>mock.checkpoints.some(value=>value.pendingReplacement?.pageIndex===8&&value.pendingReplacement.attempt===1&&value.calls===before),original.calls.length),'the new action attempt is checkpointed before its POST');
  await page.evaluate(()=>mock.releaseRequest());await idle(page);
  state=await snapshot(page);
  const expected=original.draft.pages.slice();expected[8]=await page.evaluate(()=>sheetURL(72));
  assert.deepEqual(state.draft.pages,expected,'successful replacement changes exactly the selected page');
  assert.equal(state.draft.pendingReplacement,null);
  assert.equal(state.draft.generationIdentity,identity);
  const replacementCompletions=state.completions.slice(original.completions.length);
  assert.equal(replacementCompletions.length,1);
  assert.deepEqual(replacementCompletions.map(({pages,busy,wasBusy,info})=>({pages,busy,wasBusy,type:info?.type,action:info?.action})),[{pages:16,busy:false,wasBusy:false,type:'replacement',action:'fishing'}]);

  await page.evaluate(()=>{mock.serviceError='network';mock.imageOverrides[9]=sheetURL(73);});
  await page.selectOption('#pet-preview-action','exercise');await page.click('.pet-regenerate-action');await idle(page);
  state=await snapshot(page);
  assert.deepEqual(state.draft.pages,expected,'network failure retains every old page');
  assert.deepEqual(state.draft.pendingReplacement,{pageIndex:9,attempt:1,identityImage:identity});
  await page.evaluate(()=>{mock.accept=false;mount(creator.read());});
  const restored=await snapshot(page);
  await generate(page);
  state=await snapshot(page);expected[9]=await page.evaluate(()=>sheetURL(73));
  assert.equal(state.calls.length,restored.calls.length+1,'the primary button retries only the pending replacement');
  assert.equal(state.calls.at(-1).animationPage,9);
  assert.equal(state.calls.at(-1).generationAttempt,1,'restored network retry reuses its billable attempt');
  assert.equal(state.confirmations.length,restored.confirmations.length,'retrying pending work does not ask for another replacement');
  assert.deepEqual(state.draft.pages,expected);

  await page.evaluate(()=>{mock.accept=true;mock.serviceError='codex-image-no-result';});
  await page.selectOption('#pet-preview-action','farming');await page.click('.pet-regenerate-action');await idle(page);
  state=await snapshot(page);assert.equal(state.draft.pendingReplacement.pageIndex,10);
  await page.selectOption('#pet-preview-action','mining');
  assert.equal(await page.locator('.pet-regenerate-action').isDisabled(),true,'another action cannot supersede an unresolved replacement');
  const beforeKeep=state.calls.length;
  await page.click('.pet-keep-action');await idle(page);
  state=await snapshot(page);
  assert.equal(state.draft.pendingReplacement,null);
  assert.equal(state.draft.pageAttempts[10],1,'keeping the old action never reuses an already consumed attempt');
  assert.equal(state.calls.length,beforeKeep);
  assert.deepEqual(state.draft.pages,expected);
  await page.evaluate(()=>{mock.imageOverrides[10]=sheetURL(74);});
  await page.selectOption('#pet-preview-action','farming');await page.click('.pet-regenerate-action');await idle(page);
  state=await snapshot(page);assert.equal(state.calls.at(-1).generationAttempt,2);

  await page.evaluate(()=>{mock.imageOverrides[0]=sheetURL(64);mock.imageOverrides[12]=sheetURL(76);});
  await page.selectOption('#pet-preview-action','idle');await page.click('.pet-regenerate-action');await idle(page);
  state=await snapshot(page);
  assert.equal(state.calls.at(-1).animationPage,0);
  assert.equal(state.calls.at(-1).identityImage,identity,'even idle replacement uses the original generation identity');
  assert.equal(state.draft.pages[0],await page.evaluate(()=>sheetURL(64)));
  assert.equal(state.draft.image,state.draft.pages[0]);
  assert.equal(state.draft.generationIdentity,identity);
  await page.selectOption('#pet-preview-action','reading');await page.click('.pet-regenerate-action');await idle(page);
  assert.equal((await snapshot(page)).calls.at(-1).identityImage,identity,'later actions keep the fixed identity after idle changes');

  for(const error of ['invalid-animation-image','invalid-animation-sheet','invalid-animation-response']) {
    await page.evaluate(error=>{
      mount(fixtureDraft(3));mock.accept=true;mock.imageOverrides[1]=sheetURL(65);
      if(error==='invalid-animation-response')mock.badResponse=true;else mock.validationError=error;
    },error);
    const before=await snapshot(page);
    await page.selectOption('#pet-preview-action','pet');await page.click('.pet-regenerate-action');await idle(page);
    state=await snapshot(page);
    assert.equal(state.calls.length,before.calls.length+2,'invalid-art automatically retries only the selected action');
    assert.deepEqual(state.calls.slice(before.calls.length).map(call=>[call.animationPage,call.generationAttempt]),[[1,1],[1,2]]);
    assert.equal(state.draft.pages.length,3,'resolving a partial replacement does not generate remaining actions');
    const partialPages=before.draft.pages.slice();partialPages[1]=await page.evaluate(()=>sheetURL(65));
    assert.deepEqual(state.draft.pages,partialPages);
    assert.equal(state.draft.pendingReplacement,null);
  }
  await page.evaluate(()=>{mount(fixtureDraft(3));mock.accept=true;mock.imageOverrides[1]=sheetURL(66);mock.validationError='animation-load-failed';});
  const beforeLoadFailure=await snapshot(page);
  await page.selectOption('#pet-preview-action','pet');await page.click('.pet-regenerate-action');await idle(page);
  state=await snapshot(page);
  assert.deepEqual(state.draft.pages,beforeLoadFailure.draft.pages,'a temporary image read failure keeps all old actions');
  assert.deepEqual(state.draft.pendingReplacement,{pageIndex:1,attempt:1,identityImage:identity});
  assert.deepEqual(state.draft.pageAttempts,Array.from({length:16},(_,index)=>index===1?1:0),'temporary image loading does not consume another generation attempt');
  await generate(page);state=await snapshot(page);
  assert.deepEqual(state.calls.slice(beforeLoadFailure.calls.length).map(call=>[call.animationPage,call.generationAttempt]),[[1,1],[1,1]],'loading failure retries the exact cached replacement attempt');
  const loadedPages=beforeLoadFailure.draft.pages.slice();loadedPages[1]=await page.evaluate(()=>sheetURL(66));
  assert.deepEqual(state.draft.pages,loadedPages);
  assert.equal(state.draft.pendingReplacement,null);
  console.log('PASS single-action confirmation, busy protection, exact-page replacement, fixed identity, pending retry/keep, partial drafts, invalid-art attempts and recoverable image loading');
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:process.env.TRACER_QA_BROWSER||'msedge',headless:true});
  try {
    const page=await browser.newPage();
    const rendererErrors=[];
    page.on('pageerror',error=>rendererErrors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.addScriptTag({content:creatorSource});
    await page.evaluate(()=>{
      const actions=['idle','pet','feed','play','sleep','wake','focus','drag','fishing','exercise','farming','mining','reading','writing','crafting','tea'];
      const sheet=index=>'/api/pet-art/'+(index+1).toString(16).padStart(32,'0')+'.png';
      const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
      canvas.getContext('2d').fillRect(3,3,10,10);
      const photo=canvas.toDataURL('image/png');
      window.mock={calls:[],changes:[],completions:[],checkpoints:[],confirmations:[],adoptions:[],accept:false,validationError:'',serviceError:'',badResponse:false,saveError:false,previewError:null,imageOverrides:{},holdNext:false,releaseRequest:null};
      window.sheetURL=sheet;
      window.TracerPetAnimation={actions,
        async validatePage(_image, options) { if(options.generated!==true)throw new Error('missing-generation-boundary-check');if(mock.validationError){const value=mock.validationError;if(!mock.validationFailures||!--mock.validationFailures)mock.validationError='';throw new Error(value);} },
        createPage(_image,_index,options) {
          const element=document.createElement('div');element.textContent='Animation preview';
          mock.previewError=options.onError;
          return {element,setAction(){},destroy(){}};
        }
      };
      window.fetch=async(url,options)=>{
        if(url.endsWith('-status'))return{ok:true,json:async()=>({account:{type:'chatgpt'},imageGeneration:true,configured:true,url:'https://mock.invalid'})};
        if(!url.endsWith('-pet-image'))throw new Error('Unexpected request: '+url);
        const request=JSON.parse(options.body);mock.calls.push(request);
        if(mock.holdNext){mock.holdNext=false;await new Promise(resolve=>mock.releaseRequest=resolve);mock.releaseRequest=null;}
        if(mock.serviceError) {
          const value=mock.serviceError;mock.serviceError='';
          if(value==='network')throw new TypeError('Failed to fetch');
          return {ok:false,json:async()=>({error:value})};
        }
        const animationPage=mock.badResponse?request.animationPage+1:request.animationPage;
        mock.badResponse=false;
        return {ok:true,json:async()=>({image:mock.imageOverrides[request.animationPage]||sheet(request.animationPage),animationVersion:request.animationVersion,animationPage})};
      };
      window.fixtureDraft=(count=3)=>({actionDescriptions:Array.from({length:16},(_,i)=>i===3?'Red ball':i===14?'Fold a paper boat':''),name:'Recovery companion',kind:'creature',personality:'Curious',distinctiveFeatures:'Glasses',imageSource:'codex',imageModel:'gpt-image-2.5-flare',recordId:'custom_'+'a'.repeat(32),generationId:'b'.repeat(32),generationIdentity:count?sheet(0):'',pendingReplacement:null,pageAttempts:Array(16).fill(0),photo,animationVersion:2,pages:Array.from({length:count},(_,index)=>sheet(index))});
      window.mount=draft=>{
        window.creator?.destroy();
        const root=document.getElementById('fixture');
        window.creator=TracerPetCreator(root,{language:mock.language||'en',draft,
          confirmDiscard:async message=>{mock.confirmations.push(message);return mock.accept;},
          onChange:(value,status)=>mock.changes.push({pages:value.pages.length,attempts:value.pageAttempts,busy:status.busy,error:status.error}),
          onCheckpoint:async(value,status)=>mock.checkpoints.push({pages:value.pages.length,attempts:value.pageAttempts,busy:status.busy,pendingReplacement:value.pendingReplacement,calls:mock.calls.length}),
          onComplete:(value,status,info)=>mock.completions.push({pages:value.pages.length,busy:status.busy,wasBusy:value.wasBusy,...(info?{info}:{})}),
          onAdopt:async record=>{
            mock.adoptions.push(record);await Promise.resolve();
            if(mock.saveError){mock.saveError=false;throw new Error('disk-full');}
            mock.changesAtDestroy=mock.changes.length;creator.destroy();
          }
        });
      };
      mount();
    });
    assert.equal((await snapshot(page)).status.hasDraft,false,'default fields are not a draft');
    await page.selectOption('#pet-custom-kind','humanoid');
    assert.equal((await snapshot(page)).status.hasDraft,true,'an explicitly chosen kind is recoverable');

    // Rejected artwork advances only the affected action attempt. A reload keeps
    // that token; network failures continue using it to recover the same result.
    await page.evaluate(()=>{mount(fixtureDraft());mock.validationFailures=3;mock.validationError='invalid-animation-sheet';});
    const original=(await snapshot(page)).draft;
    await generate(page);
    let state=await snapshot(page);
    assert.equal(state.draft.pages.length,3);
    assert.equal(state.draft.pageAttempts[3],3);
    assert.equal(state.calls.at(-1).generationAttempt,2);
    assert.equal(state.draft.generationId,original.generationId);
    assert.equal(state.draft.recordId,original.recordId);
    assert.match(state.status.error,/frame boundaries/);
    assert.ok(await page.evaluate(()=>mock.checkpoints.some(value=>value.pages===3&&value.attempts[3]===3)),'updated retry attempt is checkpointed');
    await page.evaluate(()=>{mount(creator.read());mock.serviceError='network';});
    assert.equal(await page.locator('#pet-photo').evaluate(input=>input.required),false,'restored photo-only drafts do not require another upload');
    await generate(page);
    state=await snapshot(page);
    assert.equal(state.draft.pageAttempts[3],3,'network failure does not create another billable attempt');
    assert.equal(state.calls.at(-1).generationAttempt,3);
    await generate(page);
    state=await snapshot(page);
    assert.equal(state.draft.pages.length,16);
    assert.deepEqual(state.completions,[{pages:16,busy:false,wasBusy:false}],'completion fires exactly once after busy has cleared');
    const complete=state.draft, requestCount=state.calls.length;

    await page.fill('#pet-custom-name','Edited name');
    await page.fill('#pet-custom-personality','Edited personality');
    assert.equal((await snapshot(page)).draft.pages.length,16,'metadata edits retain all actions');
    for(const selector of ['#pet-custom-kind','#pet-distinctive-features','#pet-image-model','#pet-image-source']) {
      const before=await page.inputValue(selector);
      if(selector==='#pet-custom-kind')await page.selectOption(selector,'humanoid');
      else if(selector==='#pet-image-source')await page.selectOption(selector,'personal');
      else if(selector==='#pet-image-model')await page.locator(selector).evaluate(input=>{input.value='replacement';input.dispatchEvent(new Event('input',{bubbles:true}));});
      else await page.fill(selector,'replacement');
      assert.equal(await page.inputValue(selector),before,'cancel restores '+selector);
      assert.deepEqual((await snapshot(page)).draft.pages,complete.pages);
    }
    await page.click('.pet-restart-generation');
    assert.equal((await snapshot(page)).draft.generationId,complete.generationId,'cancelled restart preserves the generation token');
    await generate(page);await generate(page);
    state=await snapshot(page);
    assert.equal(state.calls.length,requestCount,'completed primary button never regenerates');
    assert.equal(state.completions.length,1,'previewing does not repeat completion');

    const reference=state.draft.photo;
    const png=Buffer.from(reference.split(',')[1],'base64');
    await page.locator('#pet-photo').setInputFiles({name:'another-photo.png',mimeType:'image/png',buffer:png});
    await idle(page);
    state=await snapshot(page);
    assert.equal(state.draft.photo,reference);
    assert.deepEqual(state.draft.pages,complete.pages,'cancelled photo replacement keeps all artwork');
    await page.locator('#pet-photo').setInputFiles({name:'broken-photo.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
    await idle(page);
    assert.deepEqual((await snapshot(page)).draft.pages,complete.pages,'unreadable uploads never invalidate existing artwork');

    await page.evaluate(()=>mock.previewError());
    assert.equal((await snapshot(page)).status.ready,false);
    await page.click('.pet-reload-preview');
    state=await snapshot(page);
    assert.equal(state.status.ready,true);
    assert.equal(state.calls.length,requestCount,'reloading the preview does not consume image requests');

    // An asynchronous save failure keeps the complete result and stable ID;
    // successful destruction must not enqueue another draft write.
    await page.evaluate(()=>{mock.saveError=true;});
    await page.click('.pet-adopt');await idle(page);
    assert.match((await snapshot(page)).status.error,/Could not save/);
    await page.click('.pet-adopt');
    await page.locator('.pet-create-form').waitFor({state:'detached'});
    const saved=await page.evaluate(()=>({adoptions:mock.adoptions,changes:mock.changes.length,atDestroy:mock.changesAtDestroy}));
    assert.equal(saved.adoptions.length,2);
    assert.equal(saved.adoptions[0].id,saved.adoptions[1].id);
    assert.equal(saved.changes,saved.atDestroy,'saving and destroying never resurrects a draft');

    for(const error of ['invalid-animation-image','invalid-animation-response']) {
      await page.evaluate(error=>{
        mount(fixtureDraft(15));
        if(error==='invalid-animation-response')mock.badResponse=true;else mock.validationError=error;
      },error);
      await generate(page);
      assert.equal((await snapshot(page)).draft.pageAttempts[15],1,error+' advances only its action attempt');
    }
    await page.evaluate(()=>{mount(fixtureDraft(15));mock.serviceError='pet-generation-save-failed';});
    await generate(page);
    assert.equal((await snapshot(page)).draft.pageAttempts[15],0,'journal write failure can recover the cached result');
    assert.match((await snapshot(page)).status.error,/Keep the app open/);
    await page.evaluate(()=>{const draft=fixtureDraft(15);draft.pageAttempts[15]=1000;mount(draft);});
    const beforeLimit=(await snapshot(page)).calls.length;
    await generate(page);
    assert.equal((await snapshot(page)).calls.length,beforeLimit,'retry ceiling does not send another image request');
    assert.equal((await snapshot(page)).draft.pageAttempts[15],1000,'retry ceiling stays persistable');
    await page.evaluate(()=>{mock.accept=true;});
    await page.click('.pet-restart-generation');
    state=await snapshot(page);
    assert.equal(state.draft.pages.length,0);
    assert.deepEqual(state.draft.pageAttempts,Array(16).fill(0));
    assert.notEqual(state.draft.generationId,original.generationId);
    assert.equal(state.draft.recordId,original.recordId);
    assert.equal(state.draft.photo,original.photo);
    await singleActionCases(page);
    await page.evaluate(()=>mount(fixtureDraft(15)));
    await page.locator('#pet-action-description').evaluate(el=>el.closest('details').open=true);
    await page.selectOption('#pet-description-action','tea');
    await page.fill('#pet-action-description','Lift the cup slowly, sip once and lower it.');
    const described=(await snapshot(page)).draft;
    await page.evaluate(()=>mount(creator.read()));
    assert.equal((await snapshot(page)).draft.actionDescriptions[15],described.actionDescriptions[15]);
    await generate(page);
    state=await snapshot(page);
    assert.equal(state.draft.pages.length,16);
    assert.equal(state.calls.at(-1).actionDescription,described.actionDescriptions[15]);
    assert.equal(state.calls.at(-1).animationPage,15);
    assert.deepEqual(state.draft.pages.slice(0,15),described.pages);
    await page.evaluate(()=>{const draft=fixtureDraft(0);delete draft.animationVersion;delete draft.actionDescriptions;mount(draft);});
    const before32=(await snapshot(page)).calls.length;
    await generate(page);
    assert.equal((await snapshot(page)).calls.length,before32,'missing play prop must stop before using image allowance');
    await page.fill('#pet-play-prop','A red spinning top');
    await generate(page);
    assert.equal((await snapshot(page)).calls.length,before32,'missing craft information must stop before using image allowance');
    await page.fill('#pet-craft-details','Fold a colored paper boat');
    await page.evaluate(()=>mount(creator.read()));
    await generate(page);
    state=await snapshot(page);
    const newCalls=state.calls.slice(before32);
    assert.equal(newCalls.length,16);
    assert.ok(newCalls.every(call=>call.animationVersion===3));
    assert.equal(newCalls[3].actionDescription,'A red spinning top');
    assert.equal(newCalls[14].actionDescription,'Fold a colored paper boat');
    assert.deepEqual(state.draft.retainedFrames,Array(16).fill(32));
    assert.equal(state.status.ready,true);
    await page.evaluate(()=>{mock.language='zh';mount(creator.read());});
    assert.match(await page.locator('.pet-required-actions').innerText(),/玩耍道具 · 必填/);
    assert.match(await page.locator('.pet-required-actions').innerText(),/手作内容与材料 · 必填/);
    assert.match(await page.locator('.pet-create-intro p').first().innerText(),/每个动作 32 帧，共 512 帧/);
    assert.deepEqual(rendererErrors,[]);
    console.log('PASS creator attempt recovery, rejected-art retries, confirmation cancellation, metadata/photo preservation, preview recovery, completion timing and asynchronous save identity');
  } finally {
    await browser.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
