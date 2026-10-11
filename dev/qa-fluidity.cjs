'use strict';
// Synthetic UI regression: isolated workspace, loopback traffic, no user profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const M=require('../skins/tracer/model'),F=require('../public/fishing-model');
const output=fs.mkdtempSync(path.join(__dirname,'../.cache/fluidity-ui-')),data=path.join(output,'data');fs.mkdirSync(data);
const ws=M.emptyWorkspace();for(let i=0;i<500;i++)M.addTask(ws,{title:'Fluidity '+i+(i%5===0?' matching':''),notes:'Synthetic task',priority:i%2?'high':'low',status:['todo','doing','review','done'][i%4]});M.addNote(ws,{title:'Synthetic note',body:'UI regression only'});F.ensure(ws);
fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(ws));fs.writeFileSync(path.join(output,'config.json'),JSON.stringify({skin:'tracer',host:'127.0.0.1',autoHide:'off',idleMinutes:0}));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(output,'state.json'),DOCS_PORTAL_CONFIG_FILE:path.join(output,'config.json')});
const {server}=require('../server');
(async()=>{let browser;const errors=[],checks=[];try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin+'/?sec=board');await page.waitForFunction(()=>window.Tracer?.store.base?.tasks.length===500&&Tracer.fishing);
  if(await page.locator('#daily-card-hide').isVisible())await page.locator('#daily-card-hide').click();
  await page.evaluate(()=>{window.originalInput=document.querySelector('#board-search');window.originalCard=document.querySelector('.card');});
  const search=page.locator('#board-search');await search.fill('matching');assert.equal(await page.locator('#sec-board .card').count(),100);
  assert(await page.evaluate(()=>originalInput===document.querySelector('#board-search')&&originalInput===document.activeElement));
  await search.evaluate(el=>{el.value='uncommitted IME';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));});assert.equal(await page.locator('#sec-board .card').count(),100);
  await search.evaluate(el=>{el.value='no-such-task';el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));});assert.equal(await page.locator('#sec-board .card').count(),0);assert.equal(await page.locator('#sec-board .col-empty').count(),4);
  await page.locator('#board-clear').click();assert.equal(await page.locator('#sec-board .card').count(),500);assert(await page.evaluate(()=>document.querySelector('.card')===originalCard));
  await page.selectOption('#board-priority','high');assert.equal(await page.locator('#sec-board .card').count(),250);await search.fill('matching');assert.equal(await page.locator('#sec-board .card').count(),50);
  const counts=await page.locator('#sec-board .col-count').allTextContents();assert.equal(counts.reduce((n,v)=>n+Number(v),0),50);
  await page.locator('#board-clear').click();checks.push('typing, IME composition, combined filters, empty results, counts, input/caret and card reuse');
  // Keyboard activation and native selector handlers still belong to reused cards.
  await page.locator('#sec-board .card-title').first().click();await page.locator('#f-title').waitFor();await page.locator('#f-cancel').click();
  await page.locator('#sec-board .card').first().focus();await page.keyboard.press('Enter');await page.locator('#f-title').waitFor();await page.locator('#f-cancel').click();checks.push('reused card click and keyboard edit');
  // Scroll to a far card: deferred layout must materialize its real contents.
  const last=page.locator('#sec-board .card').last();await last.scrollIntoViewIfNeeded();assert(await last.locator('.card-title').isVisible());await last.focus();await page.keyboard.press('Enter');await page.locator('#f-title').waitFor();await page.locator('#f-cancel').click();checks.push('offscreen card scroll, focus and edit');
  await page.evaluate(()=>document.querySelector('.main').scrollTop=0);await page.screenshot({path:path.join(output,'board-desktop.png')});
  // A filtered drag must preserve data, and clear must restore every card.
  await search.fill('matching');const moving=page.locator('.col[data-col="todo"] .card').first(),id=await moving.getAttribute('data-id');const from=await moving.locator('.drag-handle').boundingBox(),to=await page.locator('.col[data-col="doing"] .col-head').boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height+22,{steps:8});await page.mouse.up();
  await page.waitForFunction(id=>Tracer.store.data.tasks.find(t=>t.id===id).status==='doing',id);await page.locator('#board-clear').click();assert.equal(await page.locator('#sec-board .card').count(),500);checks.push('filtered drag and subsequent clear preserve all tasks');
  await page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight);
  for(const section of ['inbox','notes','garden','shop','ponds','cabin','rods','board']){await page.evaluate(s=>Tracer.show(s),section);await page.waitForTimeout(150);}
  assert.equal(await page.locator('#sec-board .card').count(),500);checks.push('all eight main sections switch without runtime errors');
  await page.evaluate(()=>{const old=TracerFishingModel.presentation;window.presentationReads=0;TracerFishingModel.presentation=(...args)=>{presentationReads++;return old(...args);};Tracer.show('ponds');});
  await page.waitForTimeout(1200);await page.evaluate(()=>presentationReads=0);await page.waitForTimeout(2300);assert.equal(await page.evaluate(()=>presentationReads),0,'feeding clock does not revalidate the whole collection');checks.push('idle feeding clock reuses accepted state');
  await page.evaluate(()=>Tracer.show('board'));await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'board-mobile.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('390px viewport has no page overflow');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({output,checks,errors},null,2));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({checks,errors},null,2));
}catch(error){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({message:error.message,checks,errors},null,2));console.error(output);throw error;}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exitCode=1;});
