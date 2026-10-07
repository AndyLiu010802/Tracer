'use strict';
// All destructive checks use a freshly created temporary data directory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/account-clear-')),data=path.join(folder,'data');
fs.mkdirSync(data);Object.assign(process.env,{DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json'),DOCS_PORTAL_SKIN:'tracer'});
const M=require('../skins/tracer/model'),workspace=M.emptyWorkspace();M.addTask(workspace,{title:'Keep guest task'});fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(workspace));
const {server}=require('../server');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1200,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(origin);
    const registered=await page.evaluate(async()=>{
      localStorage.setItem('tracer.guest-test','keep');
      const created=await TracerAccount.api('register',{email:'clear-ui@example.com',password:'Clear test password 123',profile:{nickname:'To clear',bio:'Private profile'}});
      return created.user.id;
    });
    await page.reload();await page.waitForFunction(()=>window.Tracer?.store?.data&&!Tracer.store.lost);
    await page.evaluate(async()=>{localStorage.setItem('tracer.private-test','remove');const w=structuredClone(Tracer.store.data);w.tasks.push({id:'test',title:'Remove account task',status:'todo',createdAt:1,updatedAt:1});const saved=await fetch('/api/store/workspace',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(w)});if(!saved.ok)throw new Error('seed-failed');});
    await page.reload();await page.waitForFunction(()=>window.Tracer?.store?.data&&!Tracer.store.lost);
    assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),1);
    const oldTab=await context.newPage();await oldTab.goto(origin);await oldTab.waitForFunction(()=>window.Tracer?.store?.data);
    await oldTab.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open(TracerAccount.storageName('tracer-pet-generation'),1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onerror=reject;r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>db.close();const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put('private photo','draft');tx.oncomplete=resolve;};}));
    await page.locator('#account-open').click();await page.locator('#account-tab-data').click();
    await page.locator('#account-clear-data').click();assert.equal(await page.locator('#account-clear-submit').isDisabled(),true);
    await page.locator('.account-clear-actions button').last().click();assert.equal(await page.locator('#account-clear-password').isVisible(),false);
    await page.locator('#account-clear-data').click();await page.locator('#account-clear-password').fill('incorrect');await page.locator('#account-clear-confirm').check();await page.locator('#account-clear-submit').click();
    await page.waitForFunction(()=>document.getElementById('account-notice').classList.contains('error'));
    assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),1);
    await page.locator('#account-clear-password').fill('Clear test password 123');
    for(const width of [1200,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.locator('#account-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1),true);await page.locator('#account-clear-submit').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(folder,'clear-'+width+'.png')});}
    await Promise.all([page.waitForEvent('load'),page.locator('#account-clear-submit').click()]);
    await page.waitForFunction(()=>window.Tracer?.store?.data&&!Tracer.store.lost);
    assert.equal(await page.evaluate(()=>TracerAccount.scope),registered);
    assert.equal(await page.evaluate(()=>TracerAccount.context.generation),1);
    assert.equal(await page.evaluate(()=>Tracer.store.data.tasks.length),0);
    assert.equal(await page.evaluate(()=>TracerAccount.context.user.profile.nickname),'Tracer');
    assert.equal(await page.evaluate(()=>localStorage.getItem('tracer.private-test')),null);
    assert.equal(await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open(TracerAccount.storageName('tracer-pet-generation'));r.onerror=reject;r.onsuccess=()=>{const db=r.result,tx=db.transaction('drafts','readonly'),read=tx.objectStore('drafts').get('draft');read.onsuccess=()=>resolve(read.result);tx.oncomplete=()=>db.close();};})),undefined);
    await oldTab.locator('#account-session-lock').waitFor();
    await oldTab.evaluate(()=>localStorage.setItem('tracer.private-test','stale write'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('tracer.private-test')),null);
    assert.equal(JSON.parse(fs.readFileSync(path.join(data,'workspace.json'))).tasks[0].title,'Keep guest task');
    await page.locator('#account-open').click();await Promise.all([page.waitForEvent('load'),page.locator('#account-logout').click()]);
    await page.waitForFunction(()=>window.Tracer?.store?.data&&!Tracer.store.lost);
    assert.equal(await page.evaluate(()=>localStorage.getItem('tracer.guest-test')),'keep');
    assert.deepEqual(errors,[]);console.log('PASS clear confirmation, cancel, wrong password, retained login, profile/workspace/preferences/IndexedDB purge, stale-tab lock, guest isolation and 320–1200px layouts. Screenshots: '+folder);
  }catch(error){await page.screenshot({path:path.join(folder,'failure.png')});console.log(await page.locator('#account-dialog').textContent().catch(()=>''));throw error;}
  finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
