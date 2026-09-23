'use strict';
// Real renderer + workspace server, with synthetic receipts in an isolated profile.
// This never reads or modifies the user's workspace, garden, or companion saves.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const M=require('../skins/tracer/model'),S=require('../public/workspace-sync'),G=require('../public/task-garden');
const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/task-garden-world-')),data=path.join(folder,'data');
fs.mkdirSync(data);
const workspace=S.empty(),project=M.addProject(workspace,{name:'把春天收进一颗星球',color:'#92ad75'});
const rare=M.addTask(workspace,{title:'认真读完喜欢的一章',projectId:project.id}),shiny=M.addTask(workspace,{title:'写下今天闪闪发光的灵感',projectId:project.id});
// Explicit model draw fixtures are confined to this new, never-used workspace.
for(const [task,species,ticket]of [[rare,0,25],[shiny,1,0]]){task.status='doing';task.updatedAt=Math.max(Date.now(),task.updatedAt);G.taskChanged(workspace,task,task.updatedAt,limit=>limit===6?species:ticket);}
const normal=Array.from({length:7},(_,i)=>M.addTask(workspace,{title:['给窗边的植物浇水','做一顿认真准备的晚餐','完成第一版设计','整理这一周的笔记','练习一首新的曲子','走一条没走过的小路','为明天留下一点期待'][i],projectId:project.id}));
fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(workspace));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
const {server}=require('../server');

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;
  const errors=[],external=[];let blockSave=false,failedPuts=0;
  try{
    browser=await chromium.launch({channel:process.env.TRACER_QA_BROWSER||'msedge',headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1100},serviceWorkers:'block'});
    await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){external.push(url.href);return route.abort();}if(url.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});if(blockSave&&url.pathname==='/api/store/workspace'&&route.request().method()==='PUT'){failedPuts++;return route.fulfill({status:500,json:{error:'qa-save-unavailable'}});}return route.continue();});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&message.text().includes('[task garden]'))errors.push(message.text());});
    const saved=()=>page.waitForFunction(()=>window.Tracer?.store?.data&&!Tracer.store.dirty&&!Tracer.store.inflight);
    const decision=answer=>page.locator('[data-task-action="'+answer+'"]').click();
    const seed=id=>page.evaluate(id=>TaskGarden.read(Tracer.store.base||Tracer.store.data).seeds.find(s=>s.taskId===id),id);
    const collections=()=>page.evaluate(()=>TaskGarden.collection(Tracer.store.base||Tracer.store.data));
    const total=async()=>(await collections()).reduce((sum,row)=>sum+row.total,0);
    const openGarden=async()=>{await page.click('#nav-garden');await page.waitForFunction(()=>document.querySelector('.garden-world')?.dataset.art==='ready');};
    const choose=(id,status)=>page.locator('.card[data-id="'+id+'"] .card-move').selectOption(status);
    const finish=async ids=>{await page.evaluate(ids=>{for(const id of ids)TracerModel.moveTask(Tracer.store.data,id,'done');Tracer.touch();Tracer.redraw();},ids);await saved();};
    const pick=async id=>{await page.evaluate(id=>Tracer.garden.open(id),id);await page.locator('.garden-world-plot[data-project-id="'+id+'"]').click();};
    const plantCard=(id,scope=page)=>scope.locator('.garden-task-plant-card[data-task-id="'+id+'"]');
    const snapshot=async(label,width,language,section)=>{
      await page.setViewportSize({width,height:1100});await page.selectOption('#language-select',language);await page.click('#nav-'+section);
      const host=page.locator(section==='garden'?'.garden-home':'.garden-planets');await host.waitFor();
      if(section==='garden')await page.waitForFunction(()=>document.querySelector('.garden-world')?.dataset.art==='ready');
      else{for(const canvas of await page.locator('.garden-planets-preview').all()){await canvas.scrollIntoViewIfNeeded();}}
      await host.evaluate(el=>{for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.scrollHeight>parent.clientHeight)parent.scrollTop=0;});
      await page.waitForTimeout(180);
      const overflow=await host.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,body:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert.ok(overflow.scroll<=overflow.client+1&&overflow.body<=overflow.viewport+1,JSON.stringify({label,...overflow}));
      await page.screenshot({path:path.join(folder,label+'.png'),animations:'disabled'});
      const detail=page.locator(section==='garden'?'.garden-collection-grid':'.garden-planets-records');await detail.scrollIntoViewIfNeeded();await page.waitForTimeout(120);
      const detailBox=await detail.boundingBox();assert.ok(detailBox&&detailBox.width>0&&detailBox.y<1100&&detailBox.y+detailBox.height>0,'collection is actually visible');
      await page.screenshot({path:path.join(folder,label+(section==='garden'?'-collection':'-flowers')+'.png'),animations:'disabled'});
    };
    await page.goto(origin);await page.waitForFunction(()=>window.Tracer?.garden&&Tracer.store.data);await saved();await page.selectOption('#language-select','zh');await page.evaluate(id=>Tracer.openProject(id),project.id);
    for(const task of normal){await choose(task.id,'doing');await saved();}
    assert.equal(await page.evaluate(()=>TaskGarden.active(Tracer.store.base).length),9,'starting each task automatically plants its seed');
    const fixed=await seed(normal[0].id);await choose(normal[0].id,'todo');assert.equal((await seed(normal[0].id)).state,'growing');await decision('cancel');assert.deepEqual(await seed(normal[0].id),fixed);
    await choose(normal[0].id,'todo');await decision('confirm');await saved();assert.equal((await seed(normal[0].id)).state,'destroyed');await choose(normal[0].id,'doing');await saved();const restart=await seed(normal[0].id);assert.equal(restart.plantKind,fixed.plantKind);assert.equal(restart.ticket,fixed.ticket);
    console.log('PASS task seeds and confirmed withdrawal/restart');
    await openGarden();assert.equal(await page.locator('.garden-world-plot[data-empty="false"]').count(),6);assert.equal(await page.locator('.garden-task-page-count').textContent(),'1 / 2');
    assert.equal(await page.locator('.garden-task-plant-card').count(),9,'all nine live plants appear together below the six-plot scenery');
    await page.evaluate(()=>{window.__plantCards=Array.from(document.querySelectorAll('.garden-task-plant-card')).map(node=>({node,art:node.querySelector('.garden-plant-sprite')}));});
    const firstPage=await page.locator('.garden-world-plot[data-empty="false"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.projectId));await page.locator('[data-home-action="next-page"]').click();assert.equal(await page.locator('.garden-world-plot[data-empty="false"]').count(),3);assert.equal(await page.locator('.garden-task-page-count').textContent(),'2 / 2');const secondPage=await page.locator('.garden-world-plot[data-empty="false"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.projectId));assert.equal(new Set([...firstPage,...secondPage]).size,9);
    assert.equal(await page.locator('.garden-task-plant-card').count(),9,'turning the scenery page does not filter the full plant list');
    assert.ok(await page.evaluate(()=>__plantCards.every(({node,art})=>node.isConnected&&node.querySelector('.garden-plant-sprite')===art)),'paging retains every card and player node');
    await plantCard(rare.id).locator('[data-plant-action="select"]').click();assert.equal(await page.locator('.garden-task-page-count').textContent(),'1 / 2','selecting any list plant locates its scenery page');
    assert.equal(await plantCard(rare.id).getAttribute('data-selected'),'true');
    await plantCard(normal[4].id).locator('[data-plant-action="select"]').click();
    assert.equal(await page.locator('.garden-task-page-count').textContent(),'2 / 2','the seventh plant can be selected from the complete list');
    assert.equal(await page.locator('.garden-world-detail').getAttribute('data-project-id'),normal[4].id);
    await plantCard(normal[4].id).locator('[data-plant-care="water"]').click();
    await page.waitForFunction(id=>document.querySelector('.garden-task-plant-card[data-task-id="'+id+'"] .garden-plant-sprite')?.dataset.action==='water',normal[4].id);
    assert.equal(await page.locator('.garden-task-plant-card').count(),9,'care for a later-page plant preserves every card');
    await plantCard(normal[6].id).locator('[data-plant-action="open-task"]').click();assert.equal(await page.locator('#f-title').inputValue(),normal[6].title);await page.locator('#f-cancel').click();
    assert.equal(await page.locator('.garden-home select,[data-home-action="plant-project"],.garden-plant-picker').count(),0,'plants cannot be hand-selected');
    assert.equal(await page.locator('.garden-collection-card[data-unlocked="false"]').count(),G.KINDS.length);
    const silhouette=await page.locator('.garden-collection-art').first().evaluate(el=>getComputedStyle(el).filter);assert.match(silhouette,/brightness\(0\)/,'locked plants are black shape silhouettes');
    await finish([rare.id,shiny.id]);await page.locator('.garden-task-plants-heading').evaluate(el=>el.scrollIntoView({block:'start'}));await page.waitForTimeout(150);
    const cardHeights=await page.locator('.garden-task-plant-card').evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().height)));assert.ok(Math.max(...cardHeights)<=375,'plant cards stay compact: '+cardHeights.join(', '));console.log('Plant card heights: '+cardHeights.join(', ')+' px');
    await page.screenshot({path:path.join(folder,'all-plants-desktop.png'),animations:'disabled'});
    await page.setViewportSize({width:390,height:1100});assert.ok(await page.locator('.garden-task-plants').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.locator('.garden-task-plants-heading').evaluate(el=>el.scrollIntoView({block:'start'}));await page.waitForTimeout(150);await page.screenshot({path:path.join(folder,'all-plants-narrow.png'),animations:'disabled'});await page.setViewportSize({width:1440,height:1100});
    await pick(rare.id);assert.equal(await plantCard(rare.id).getAttribute('data-rarity'),'rare');await plantCard(rare.id).locator('[data-plant-action="harvest"]').click();await saved();assert.equal(await total(),1);assert.equal(await plantCard(rare.id).count(),0);assert.equal(await page.locator('.garden-task-plant-card').count(),8,'harvest removes only its card');assert.equal(await page.locator('.garden-world-plot[data-project-id="'+rare.id+'"]').count(),0,'harvest leaves the live garden');assert.match(await page.locator('.garden-collection-card[data-plant="wildflower"] .garden-collection-count').textContent(),/1/);assert.ok(await page.evaluate(()=>Tracer.pet.read().unlocked.includes('garden_wildflower')));
    await pick(shiny.id);const originalTicket=(await seed(shiny.id)).ticket;blockSave=true;await plantCard(shiny.id).locator('[data-plant-action="harvest"]').click();await page.locator('.garden-home-error').waitFor();assert.ok(failedPuts>0);assert.equal(await total(),1,'failed PUT grants no collection count');assert.equal(await page.locator('.garden-task-plant-card').count(),8,'failed harvest retains every accepted card');assert.equal(await page.evaluate(()=>Tracer.pet.read().unlocked.includes('garden_sunflower_shiny')),false,'failed PUT grants no shiny pet');assert.equal((await seed(shiny.id)).state,'mature','accepted receipt remains unharvested');
    blockSave=false;await page.locator('[data-home-action="retry-save"]').click();await saved();await page.waitForFunction(()=>Tracer.pet.read().unlocked.includes('garden_sunflower_shiny'));assert.equal(await total(),2);assert.equal(await page.locator('.garden-task-plant-card').count(),7,'successful retry removes exactly the harvested card');assert.equal((await seed(shiny.id)).ticket,originalTicket);assert.equal(await page.locator('.garden-collection-card[data-unlocked="false"]').count(),G.KINDS.length-2);
    await finish([normal[0].id]);await plantCard(normal[0].id).locator('[data-plant-action="harvest"]').click();await saved();assert.equal(await total(),3);assert.equal(await page.locator('.garden-task-plant-card').count(),6);
    const beforeReload=await collections(),receipts=await page.evaluate(()=>TaskGarden.read(Tracer.store.base).seeds);await page.reload();await page.waitForFunction(()=>window.Tracer?.garden&&Tracer.store.data);await saved();await openGarden();assert.deepEqual(await collections(),beforeReload);assert.deepEqual(await page.evaluate(()=>TaskGarden.read(Tracer.store.base).seeds),receipts,'reload neither rerolls nor grants additional harvests');
    console.log('PASS task harvests, rare/shiny rewards, failed PUT/retry and reload');
    await snapshot('garden-zh-desktop',1440,'zh','garden');await snapshot('garden-en-desktop',1440,'en','garden');await snapshot('garden-zh-narrow',390,'zh','garden');await snapshot('garden-en-narrow',390,'en','garden');
    if(process.env.TRACER_QA_GARDEN_ONLY==='1'){assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS all live plant cards, stable player nodes, scene-only paging, task actions, harvest/retry counts and bilingual desktop/narrow layouts.');console.log('Screenshots: '+folder);return;}
    await page.setViewportSize({width:1440,height:1100});await page.selectOption('#language-select','zh');await finish(normal.slice(1).map(task=>task.id));await page.evaluate(id=>Tracer.openProject(id),project.id);await page.locator('#board-complete-project').click();await decision('confirm');await saved();await page.click('#nav-planets');await page.locator('.garden-planets-canvas').waitFor();
    assert.equal(await page.locator('.garden-planets-flower').count(),9);assert.equal(await total(),9,'archive automatically gathers remaining mature flowers');assert.match(await page.locator('.garden-planets-plaque').textContent(),new RegExp(project.name));
    await page.locator('[data-planet-action="pause"]').click();await page.waitForTimeout(120);const canvas=page.locator('.garden-planets-canvas'),start=await canvas.evaluate(el=>el.toDataURL()),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+80,box.y+box.height*.5+30,{steps:10});await page.mouse.up();await page.waitForTimeout(120);assert.notEqual(await canvas.evaluate(el=>el.toDataURL()),start,'project planet really rotates');
    const rareIndex=await page.evaluate(id=>TaskGarden.read(Tracer.store.base).planets[0].flowers.findIndex(f=>f.taskId===id),rare.id);await page.locator('[data-planet-action="select-flower"][data-value="'+rareIndex+'"]').click();assert.match(await page.locator('.garden-planets-memory').textContent(),new RegExp(rare.title));
    await snapshot('planets-zh-desktop',1440,'zh','planets');await snapshot('planets-en-desktop',1440,'en','planets');await snapshot('planets-zh-narrow',390,'zh','planets');await snapshot('planets-en-narrow',390,'en','planets');
    await page.setViewportSize({width:1440,height:1100});await page.selectOption('#language-select','zh');await page.click('#nav-planets');const planetBefore=await page.evaluate(()=>TaskGarden.read(Tracer.store.base).planets);await page.locator('[data-planet-action="delete-planet"]').click();await decision('cancel');assert.deepEqual(await page.evaluate(()=>TaskGarden.read(Tracer.store.base).planets),planetBefore);
    const collectionBeforeDelete=await collections();blockSave=true;await page.locator('[data-planet-action="delete-planet"]').click();await decision('confirm');await page.locator('.garden-planets-retry').waitFor();await page.waitForFunction(()=>!Tracer.store.inflight&&Tracer.store.dirty);assert.deepEqual(await page.evaluate(()=>TaskGarden.read(Tracer.store.base).planets),planetBefore,'failed delete keeps the accepted planet visible');await page.evaluate(()=>{window.__planetRetryButton=document.querySelector('.garden-planets-retry');Tracer.garden.refresh();});assert.ok(await page.evaluate(()=>document.querySelector('.garden-planets-retry')===window.__planetRetryButton),'retry controls are not recreated on every refresh');blockSave=false;await page.locator('.garden-planets-retry').click();await saved();assert.equal(await page.locator('.garden-planets-empty').count(),1);assert.deepEqual(await collections(),collectionBeforeDelete,'deleting the world preserves collection counts');assert.ok(await page.evaluate(()=>Tracer.pet.read().unlocked.includes('garden_sunflower_shiny')));await page.reload();await page.waitForFunction(()=>window.Tracer?.garden&&Tracer.store.data);await saved();assert.equal(await page.evaluate(()=>TaskGarden.read(Tracer.store.base).planets.length),0);assert.deepEqual(await collections(),collectionBeforeDelete);
    console.log('PASS project planet archive, rotation, deletion and collection retention');
    const legacyRaw=JSON.stringify({v:1,records:[{projectId:'legacy-keepsake',plantKind:'cherry',maturedAt:Date.now()-2000,ticket:800,harvestedAt:Date.now()-1000},{projectId:'legacy-rare',plantKind:'apple',maturedAt:Date.now()-2000,ticket:1,harvestedAt:null}]},null,2);
    const migrationContext=await browser.newContext({viewport:{width:1000,height:800},serviceWorkers:'block'});
    await migrationContext.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});return route.continue();});
    await migrationContext.addInitScript(raw=>localStorage.setItem('tracer.garden.harvest.v1',raw),legacyRaw);
    const migrationPage=await migrationContext.newPage();migrationPage.on('pageerror',error=>errors.push(error.message));migrationPage.on('console',message=>{if(message.type()==='error'&&message.text().includes('[task garden]'))errors.push(message.text());});
    await migrationPage.goto(origin);await migrationPage.waitForFunction(()=>window.Tracer?.garden&&Tracer.store.base&&!Tracer.store.dirty&&!Tracer.store.inflight&&TaskGarden.read(Tracer.store.base).seeds.some(s=>s.taskId==='legacy-plot-legacy-keepsake'));
    assert.equal(await migrationPage.evaluate(()=>localStorage.getItem('tracer.garden.harvest.v1')),legacyRaw,'migration retains the original save byte for byte');
    assert.equal(await migrationPage.evaluate(()=>TaskGarden.collection(Tracer.store.base).reduce((sum,row)=>sum+row.total,0)),10,'the old receipt joins the collection once');
    await migrationPage.evaluate(()=>Tracer.garden.open('legacy-plot-legacy-rare'));await plantCard('legacy-plot-legacy-rare',migrationPage).locator('[data-plant-action="harvest"]').click();
    await migrationPage.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight&&TaskGarden.read(Tracer.store.base).seeds.find(s=>s.taskId==='legacy-plot-legacy-rare')?.harvestedAt&&Tracer.pet.read().unlocked.includes('garden_apple'));
    assert.equal(await migrationPage.evaluate(()=>TaskGarden.collection(Tracer.store.base).reduce((sum,row)=>sum+row.total,0)),11,'migrated unharvested rare seed can be collected');
    assert.equal(await migrationPage.evaluate(()=>localStorage.getItem('tracer.garden.harvest.v1')),legacyRaw,'claiming a migrated seed still preserves the legacy raw save');
    await migrationPage.reload();await migrationPage.waitForFunction(()=>window.Tracer?.garden&&Tracer.store.base&&!Tracer.store.dirty&&!Tracer.store.inflight);
    assert.equal(await migrationPage.evaluate(()=>TaskGarden.read(Tracer.store.base).seeds.filter(s=>s.taskId==='legacy-plot-legacy-keepsake').length),1);assert.equal(await migrationPage.evaluate(()=>TaskGarden.read(Tracer.store.base).seeds.filter(s=>s.taskId==='legacy-plot-legacy-rare').length),1);assert.equal(await migrationPage.evaluate(()=>TaskGarden.collection(Tracer.store.base).reduce((sum,row)=>sum+row.total,0)),11);assert.equal(await migrationPage.evaluate(()=>localStorage.getItem('tracer.garden.harvest.v1')),legacyRaw);assert.ok(await migrationPage.evaluate(()=>Tracer.pet.read().unlocked.includes('garden_apple')));await migrationContext.close();
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log('PASS: task planting and paging, stable seed restart, harvest collection silhouettes, rare/shiny companions, failed PUT and retry, reload, project archive planet rotation and flowers, cancel/delete collection preservation, bilingual desktop/narrow layouts.');console.log('Screenshots: '+folder);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
