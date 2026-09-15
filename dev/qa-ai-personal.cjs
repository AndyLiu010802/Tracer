'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'.cache/ai-personal-qa-'));
Object.assign(process.env,{DOCS_PORTAL_PORT:'18146',DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(profile,'data'),DOCS_PORTAL_STATE_FILE:path.join(profile,'bookmarks.json')});
const {server}=require('../server');
const inputs=[],checks=[];function check(value,label){assert.ok(value,label);checks.push(label);console.log('PASS '+label);}
const plan={title:'Research report',summary:'Prepare and review a short report.',questions:[],assumptions:['Use the supplied material.'],risks:[],tasks:[{key:'t1',title:'Draft report',notes:'Read sources and write.',acceptance:'A reviewed report',hours:2,priority:'medium',dependsOn:[],checklist:['Check sources']}]};
const provider=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const request=JSON.parse(body);inputs.push(request);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:request.messages[0].role==='user'?'OK':JSON.stringify(plan)},finish_reason:'stop'}]}));});
(async()=>{
 await new Promise(r=>server.listen(18146,'127.0.0.1',r));await new Promise(r=>provider.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:18146/');await page.waitForFunction(()=>window.Tracer?.store?.data);await page.selectOption('#language-select','en');
  await page.evaluate(()=>{TracerModel.addTask(Tracer.store.data,{title:'Existing completed task',status:'done'});TracerModel.addTask(Tracer.store.data,{title:'Existing task'});Tracer.touch();});
  await page.waitForFunction(()=>!Tracer.store.inflight&&!Tracer.store.dirty);const history=await page.evaluate(()=>JSON.stringify(Tracer.store.data.completionHistory));
  await page.click('#ai-open');check(await page.locator('#ai-goal').isVisible()&&await page.locator('#ai-deadline').isVisible()&&await page.locator('#ai-weekly').isVisible(),'three key questions are visible');
  check(!await page.locator('#ai-daily').isVisible()&&!await page.locator('#ai-files').isVisible(),'advanced settings and attachments start collapsed');
  await page.fill('#ai-goal','Write a short report');await page.fill('#ai-weekly','8');
  await page.click('[data-ai-step="3"]');check(await page.locator('#ai-login').count()===0,'no Tracer login or invitation required');
  await page.click('#ai-preset-local');await page.fill('#ai-url','http://127.0.0.1:'+provider.address().port+'/v1');await page.fill('#ai-model','test-local-model');await page.fill('#ai-key','qa-secret-only');
  await page.click('#ai-configure');await page.waitForFunction(()=>document.querySelector('.ai-service-state').textContent.includes('not tested'));
  check(inputs.length===0,'saving configuration does not call or claim connection to a model');
  await page.click('#ai-test');await page.waitForFunction(()=>document.querySelector('.ai-service-state').textContent==='Model test passed');
  check(inputs.length===1&&inputs[0].model==='test-local-model','connection test calls the configured model');
  await page.click('[data-ai-step="0"]');check(await page.locator('#ai-goal').inputValue()==='Write a short report','goal survives settings navigation');
  await page.locator('summary').filter({hasText:'Add context (optional)'}).click();await page.check('#ai-context');
  await page.setInputFiles('#ai-files',{name:'brief.txt',mimeType:'text/plain',buffer:Buffer.from('A two-page report with sources.')});await page.waitForSelector('.ai-doc');
  await page.click('#ai-generate');await page.waitForSelector('#ai-title');
  const payload=JSON.parse(inputs[1].messages[1].content);check(payload.goal==='Write a short report'&&payload.constraints.weekly===8&&payload.documents[0].text.includes('two-page')&&payload.tasks.length===1,'three answers, selected file and unfinished task context reach the model');
  check(await page.evaluate(()=>Tracer.store.data.tasks.length===2),'preview leaves existing tasks intact');
  await page.fill('#ai-task-hours-0','160');await page.click('#ai-recalculate');await page.click('#ai-apply');await page.waitForFunction(()=>!document.querySelector('#ai-apply').disabled);
  check(await page.locator('#ai-error').innerText().then(t=>t.includes('capacity'))&&await page.evaluate(()=>Tracer.store.data.tasks.length===2),'insufficient capacity blocks task creation');
  await page.fill('#ai-task-hours-0','2');await page.click('#ai-recalculate');await page.click('#ai-apply');await page.waitForSelector('.ai-success');
  check(await page.evaluate(()=>Tracer.store.data.tasks.length===4&&Tracer.store.data.notes.length===1),'confirmation creates the scheduled sessions and summary');
  check(await page.evaluate(()=>JSON.stringify(Tracer.store.data.completionHistory))===history,'completion history is preserved');
  await page.click('#ai-new');
  for(const language of ['en','zh']){
   await page.click('#ai-close');await page.selectOption('#language-select',language);await page.click('#ai-open');
   for(const width of [420,760,1440]){
    await page.setViewportSize({width,height:1080});
    for(const step of [0,3]){
     await page.click('[data-ai-step="'+step+'"]');
     check(await page.locator('.ai-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+2),'dialog fits '+language+' '+width+' step '+step);
    }
   }
  }
  await page.setViewportSize({width:1440,height:1080});await page.click('[data-ai-step="0"]');await page.screenshot({path:path.join(root,'.cache/ai-personal-brief.png')});
  await page.click('[data-ai-step="3"]');await page.screenshot({path:path.join(root,'.cache/ai-personal-settings.png')});
  check(await page.evaluate(()=>!JSON.stringify(localStorage).includes('qa-secret-only')),'API key is absent from renderer localStorage');
  check(!fs.readFileSync(path.join(profile,'data/.ai/personal.json'),'utf8').includes('qa-secret-only'),'unencrypted runtime never writes the API key to disk');
  await page.click('#ai-forget');await page.waitForFunction(()=>!document.querySelector('#ai-forget').disabled);
  check(!fs.existsSync(path.join(profile,'data/.ai/personal.json')),'removing AI settings deletes stored configuration');
  check(errors.length===0,'no renderer errors');fs.writeFileSync(path.join(root,'.cache/ai-personal-qa-result.json'),JSON.stringify({checks},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));await new Promise(r=>provider.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
