'use strict';
// Two isolated browser profiles, local PNG fixtures and real package endpoints; no AI calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const Images=require('../lib/pet-image'),Packages=require('../lib/pet-package');
const {fixtures}=require('./qa-pet-animation.cjs');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'.cache/pet-transfer-')),data=path.join(profile,'data');
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(profile,'bookmarks.json')});
const {server}=require('../server');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function ready(page,origin) {await page.goto(origin);await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);await page.selectOption('#language-select','en');}
async function transfer(page,action) {await page.evaluate(()=>Tracer.pet.open());await page.click('[data-tab="collection"]');await page.click('[data-act="open-'+action+'"]');}
async function upload(page,pack) {await page.locator('#pet-package-file').setInputFiles({name:'friend.tracer-pet',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pack))});}
async function layout(page,label) {
  const issues=await page.locator('.pet-transfer-dialog').evaluate(modal=>{
    const issues=[],bounds=modal.getBoundingClientRect();
    if(modal.scrollWidth>modal.clientWidth+1||bounds.left<0||bounds.right>innerWidth)issues.push('modal overflow');
    for(const el of modal.querySelectorAll('button,input,h2,p,canvas')) {
      if(!el.checkVisibility())continue;
      const r=el.getBoundingClientRect();
      if(r.left<bounds.left||r.right>bounds.right)issues.push(el.className||el.tagName);
    }
    return issues;
  });assert.deepEqual(issues,[],label);
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'msedge',headless:true}),origin='http://127.0.0.1:'+server.address().port;
  let aiCalls=0;const errors=[];
  try {
    const sender=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
    const receiver=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
    for(const context of [sender,receiver]) {
      await context.route('**/api/ai/**',route=>{aiCalls++;return route.fulfill({status:503,json:{error:'no-ai-account'}});});
      context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
    }
    const a=await sender.newPage();await ready(a,origin);const art=await fixtures(a),pages=[];
    for(const sheet of art.sheets)pages.push(await Images.storeGenerated(data,sheet));
    const original={id:'custom_'+'a'.repeat(32),name:'Robin the Quiet Companion',kind:'humanoid',personality:'Patient, curious and fond of books.',image:pages[0],animation:{version:1,pages}};
    await a.evaluate(record=>{
      const state=Tracer.pet.read();TracerPetModel.addCustom(state,record);state.pets[record.id].bond=87;
      const raw=JSON.stringify(state);localStorage.setItem('tracer.pet.v1',raw);dispatchEvent(new StorageEvent('storage',{key:'tracer.pet.v1',newValue:raw}));Tracer.pet.refresh(true);
    },original);
    await transfer(a,'export');await layout(a,'export');
    const downloadEvent=a.waitForEvent('download');await a.click('.pet-transfer-submit');const download=await downloadEvent;
    assert.equal(download.suggestedFilename(),original.name+'.tracer-pet');
    const exported=path.join(profile,'shared.tracer-pet');await download.saveAs(exported);
    const pack=JSON.parse(fs.readFileSync(exported,'utf8'));
    assert.equal(pack.artwork.images.length,4);assert.equal(pack.companion.personality,original.personality);
    assert.ok(!JSON.stringify(pack).includes('bond'));assert.ok(!JSON.stringify(pack).includes('/api/pet-art'));
    // The recipient's import must not depend on the sender's local image paths.
    for(const url of pages)fs.unlinkSync(path.join(data,'.pet-art',path.basename(url)));
    const b=await receiver.newPage();await ready(b,origin);await transfer(b,'import');await upload(b,pack);
    await b.locator('.pet-transfer-submit:not([disabled])').waitFor();assert.equal(fs.readdirSync(path.join(data,'.pet-art')).length,0,'preview never writes artwork');
    for(const language of ['en','zh']) {
      // Reopen through the actual language selector so labels are rebuilt normally.
      await b.click('[data-transfer-close]');await b.keyboard.press('Escape');await b.selectOption('#language-select',language);
      await transfer(b,'import');await upload(b,pack);await b.locator('.pet-transfer-submit:not([disabled])').waitFor();
      for(const width of [360,760,1440]) {await b.setViewportSize({width,height:900});await layout(b,language+'/'+width);}
      await b.setViewportSize({width:360,height:900});await b.screenshot({path:path.join(profile,'import-'+language+'-360.png')});
    }
    await b.click('.pet-transfer-submit');await b.locator('.pet-character .pet-animated-sprite').waitFor();
    const imported=await b.evaluate(()=>Tracer.pet.read().customs[0]);assert.equal(imported.name,original.name);assert.equal(imported.animation.pages.length,4);
    assert.equal(await b.evaluate(()=>TracerPetModel.current(Tracer.pet.read()).bond),0,'care starts fresh');
    for(const [i,url]of imported.animation.pages.entries())assert.equal(hash(await Images.readAsset(data,url)),pack.artwork.images[i].sha256);
    const sprite=b.locator('.pet-character .pet-animated-sprite'),frame=await sprite.getAttribute('data-frame');
    await b.waitForFunction(frame=>document.querySelector('.pet-character .pet-animated-sprite').dataset.frame!==frame,frame);
    await b.reload();await b.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);assert.equal(await b.evaluate(()=>Tracer.pet.read().customs[0].id),imported.id);
    await b.evaluate(()=>Tracer.pet.action('pet'));const bond=await b.evaluate(()=>TracerPetModel.current(Tracer.pet.read()).bond);
    await transfer(b,'import');await upload(b,pack);await b.locator('.pet-transfer-submit:not([disabled])').waitFor();await b.click('.pet-transfer-submit');
    assert.equal(await b.evaluate(()=>Tracer.pet.read().customs.length),1);assert.equal(await b.evaluate(()=>TracerPetModel.current(Tracer.pet.read()).bond),bond);
    assert.equal(fs.readdirSync(path.join(data,'.pet-art')).length,4,'duplicate imports do not copy artwork');
    await transfer(b,'import');const damaged=structuredClone(pack);damaged.artwork.images[3].sha256='0'.repeat(64);await upload(b,damaged);
    await b.waitForFunction(()=>document.querySelector('.pet-transfer-error').textContent.length>0);assert.equal(await b.locator('.pet-transfer-submit').isDisabled(),true);
    assert.equal(await b.evaluate(()=>Tracer.pet.read().customs.length),1);assert.equal(fs.readdirSync(path.join(data,'.pet-art')).length,4);
    // A failed preference save leaves the old collection intact and retries reuse the saved images.
    const changed=structuredClone(pack);changed.companion.name='Another quiet friend';await upload(b,changed);await b.locator('.pet-transfer-submit:not([disabled])').waitFor();
    await b.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='tracer.pet.v1'&&!window.__failedSave){window.__failedSave=true;throw new DOMException('Full','QuotaExceededError');}return write.call(this,key,value);};});
    await b.click('.pet-transfer-submit');await b.waitForFunction(()=>document.querySelector('.pet-transfer-error').textContent.length>0);
    assert.equal(await b.evaluate(()=>Tracer.pet.read().customs.length),1);const stored=fs.readdirSync(path.join(data,'.pet-art')).length;
    await b.click('.pet-transfer-submit');await b.locator('.pet-character .pet-animated-sprite').waitFor();assert.equal(await b.evaluate(()=>Tracer.pet.read().customs.length),2);
    assert.equal(fs.readdirSync(path.join(data,'.pet-art')).length,stored,'retry after preference failure reuses stored images');
    for(const count of [1,3]) {
      const legacy={...pack,companion:{...pack.companion,name:'Legacy '+count},artwork:count===1?{layout:'portrait',images:[{data:art.portrait.toString('base64'),sha256:hash(art.portrait)}]}:{...pack.artwork,images:pack.artwork.images.slice(0,3)}};
      await transfer(b,'import');await upload(b,legacy);await b.locator('.pet-transfer-submit:not([disabled])').waitFor();await b.click('.pet-transfer-submit');
      await b.locator('.pet-character .pet-sprite').waitFor();const saved=await b.evaluate(()=>Tracer.pet.read().customs.at(-1));
      assert.equal(saved.animation?.pages.length,count===1?undefined:3);
    }
    assert.equal(aiCalls,0,'sharing never calls an AI service');assert.deepEqual(errors,[]);
    console.log('PASS real export/download/import, fresh recipient profile, missing sender assets, all 16 actions retained, duplicate care preservation, damaged files, storage retry, legacy artwork and bilingual responsive previews');
    console.log('Artifacts: '+profile);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
