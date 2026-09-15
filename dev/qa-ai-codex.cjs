'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'.cache/codex-ui-qa-'));
Object.assign(process.env,{DOCS_PORTAL_PORT:'18149',DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(profile,'data'),DOCS_PORTAL_STATE_FILE:path.join(profile,'bookmarks.json')});
const {server}=require('../server');
const checks=[];function check(value,label){assert.ok(value,label);checks.push(label);console.log('PASS '+label);}
const plan={title:'Report',summary:'Prepare a report.',questions:[],assumptions:[],risks:[],tasks:[{key:'t1',title:'Draft report',notes:'',acceptance:'Reviewed',hours:1,priority:'medium',dependsOn:[],checklist:[]}]};
(async()=>{
 await new Promise(r=>server.listen(18149,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[],requests=[];
  let logged=false,pending=false,tested=false,exhausted=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/ai/codex-*',async route=>{const req=route.request(),action=req.url().split('/').at(-1);requests.push(action);
   if(action==='codex-login')pending=true;if(action==='codex-cancel')pending=false;if(action==='codex-logout'){logged=false;tested=false;}if(action==='codex-test')tested=true;
   if(action==='codex-plan'){await route.fulfill({status:exhausted?400:200,json:exhausted?{error:'codex-quota-exhausted'}:{plan}});return;}
   await route.fulfill({json:{available:true,running:true,account:logged?{email:'test@example.com',plan:'pro'}:null,login:!logged&&pending?{url:'https://auth.openai.com/oauth/authorize?response_type=code&state=test',code:null}:null,tested}});
  });
  await page.goto('http://127.0.0.1:18149/');await page.waitForFunction(()=>window.Tracer?.store?.data);await page.selectOption('#language-select','en');await page.click('#ai-open');
  await page.fill('#ai-goal','Write a project report');await page.click('#ai-generate');await page.waitForSelector('#ai-codex-login');check(await page.locator('#ai-error').innerText().then(s=>s.includes('Sign in')),'generation directs unsigned users to ChatGPT login');
  await page.click('#ai-codex-login');await page.waitForSelector('.ai-login-code');
  check(await page.locator('.ai-login-code a').getAttribute('href')==='https://auth.openai.com/oauth/authorize?response_type=code&state=test','authorization link is the official browser OAuth page');
  check(await page.locator('.ai-login-code strong').count()===0,'browser login does not require a device code');
  await page.click('#ai-codex-cancel');await page.waitForSelector('#ai-codex-login');check(await page.locator('.ai-login-code').count()===0,'pending login can be cancelled');
  await page.click('#ai-codex-login');logged=true;pending=false;await page.waitForSelector('.ai-signed-in');
  check(await page.locator('.ai-service-state').innerText().then(s=>s.includes('not tested')),'login completion is distinct from model verification');
  await page.click('#ai-codex-test');await page.waitForFunction(()=>document.querySelector('.ai-service-state').textContent==='Model test passed');
  await page.click('[data-ai-step="0"]');check(await page.locator('#ai-goal').inputValue()==='Write a project report','brief survives authentication');
  exhausted=true;await page.click('#ai-generate');await page.waitForFunction(()=>document.querySelector('#ai-error').textContent.includes('Included usage'));
  check(await page.evaluate(()=>Tracer.store.data.tasks.length===0),'quota failure leaves workspace unchanged');
  exhausted=false;await page.click('#ai-generate');await page.waitForSelector('#ai-title');
  check(await page.evaluate(()=>Tracer.store.data.tasks.length===0),'Codex plan is previewed before task creation');
  await page.click('#ai-apply');await page.waitForSelector('.ai-success');check(await page.evaluate(()=>Tracer.store.data.tasks.length===1),'confirmed Codex plan creates a scheduled task');
  await page.click('#ai-new');
  for(const language of ['en','zh']){
   await page.click('#ai-close');await page.selectOption('#language-select',language);await page.click('#ai-open');await page.click('[data-ai-step="3"]');
   for(const width of [420,760,1440]){await page.setViewportSize({width,height:1080});check(await page.locator('.ai-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+2),'signed-in layout fits '+language+' '+width);}
  }
  await page.screenshot({path:path.join(root,'.cache/codex-signed-in.png')});await page.click('#ai-codex-logout');await page.waitForSelector('#ai-codex-login');await page.click('#ai-codex-login');
  await page.waitForSelector('.ai-login-code');await page.screenshot({path:path.join(root,'.cache/codex-login.png')});
  check(await page.evaluate(()=>!JSON.stringify(localStorage).includes('TEST-CODE')),'login codes are not saved with drafts');check(errors.length===0,'no renderer exceptions');
  fs.writeFileSync(path.join(root,'.cache/codex-ui-qa-result.json'),JSON.stringify({checks,requests},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
