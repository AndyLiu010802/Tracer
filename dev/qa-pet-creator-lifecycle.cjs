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
      window.mock={calls:[],changes:[],completions:[],checkpoints:[],confirmations:[],adoptions:[],accept:false,validationError:'',serviceError:'',badResponse:false,saveError:false,previewError:null};
      window.TracerPetAnimation={actions,
        async validatePage() { if(mock.validationError){const value=mock.validationError;mock.validationError='';throw new Error(value);} },
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
        if(mock.serviceError) {
          const value=mock.serviceError;mock.serviceError='';
          if(value==='network')throw new TypeError('Failed to fetch');
          return {ok:false,json:async()=>({error:value})};
        }
        const animationPage=mock.badResponse?request.animationPage+1:request.animationPage;
        mock.badResponse=false;
        return {ok:true,json:async()=>({image:sheet(request.animationPage),animationVersion:2,animationPage})};
      };
      window.fixtureDraft=(count=3)=>({name:'Recovery companion',kind:'creature',personality:'Curious',distinctiveFeatures:'Glasses',imageSource:'codex',imageModel:'gpt-image-2.5-flare',recordId:'custom_'+'a'.repeat(32),generationId:'b'.repeat(32),pageAttempts:Array(16).fill(0),photo,animationVersion:2,pages:Array.from({length:count},(_,index)=>sheet(index))});
      window.mount=draft=>{
        window.creator?.destroy();
        const root=document.getElementById('fixture');
        window.creator=TracerPetCreator(root,{language:'en',draft,
          confirmDiscard:async message=>{mock.confirmations.push(message);return mock.accept;},
          onChange:(value,status)=>mock.changes.push({pages:value.pages.length,attempts:value.pageAttempts,busy:status.busy,error:status.error}),
          onCheckpoint:async(value,status)=>mock.checkpoints.push({pages:value.pages.length,attempts:value.pageAttempts,busy:status.busy}),
          onComplete:(value,status)=>mock.completions.push({pages:value.pages.length,busy:status.busy,wasBusy:value.wasBusy}),
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
    await page.evaluate(()=>{mount(fixtureDraft());mock.validationError='invalid-animation-sheet';});
    const original=(await snapshot(page)).draft;
    await generate(page);
    let state=await snapshot(page);
    assert.equal(state.draft.pages.length,3);
    assert.equal(state.draft.pageAttempts[3],1);
    assert.equal(state.calls.at(-1).generationAttempt,0);
    assert.equal(state.draft.generationId,original.generationId);
    assert.equal(state.draft.recordId,original.recordId);
    assert.match(state.status.error,/frame boundaries/);
    assert.ok(await page.evaluate(()=>mock.checkpoints.some(value=>value.pages===3&&value.attempts[3]===1)),'updated retry attempt is checkpointed');
    await page.evaluate(()=>{mount(creator.read());mock.serviceError='network';});
    assert.equal(await page.locator('#pet-photo').evaluate(input=>input.required),false,'restored photo-only drafts do not require another upload');
    await generate(page);
    state=await snapshot(page);
    assert.equal(state.draft.pageAttempts[3],1,'network failure does not create another billable attempt');
    assert.equal(state.calls.at(-1).generationAttempt,1);
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
    assert.deepEqual(rendererErrors,[]);
    console.log('PASS creator attempt recovery, rejected-art retries, confirmation cancellation, metadata/photo preservation, preview recovery, completion timing and asynchronous save identity');
  } finally {
    await browser.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
