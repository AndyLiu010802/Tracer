'use strict';
// Isolated workspace: exercise the real storefront, save path, planet renderer and download.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright-core');
const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/postcards-')),data=path.join(folder,'data');fs.mkdirSync(data);
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
const {server}=require('../server'),M=require('../skins/tracer/model'),G=require('../public/task-garden');
(async()=>{
  const ws=M.emptyWorkspace();ws.taskGarden=G.empty();ws.taskGarden.market.testCredit={id:'postcard-qa',amount:400,updatedAt:100};
  const project={id:'postcard-world',name:'认真生活的四十个小瞬间',color:'#95ab78',status:'active',createdAt:100,updatedAt:100};ws.projects.push(project);
  for(let i=0;i<40;i++){const t={id:'flower-'+i,title:'第 '+(i+1)+' 次努力',status:'doing',projectId:project.id,createdAt:100,updatedAt:100};ws.tasks.push(t);G.taskChanged(ws,t,100,n=>n===10000?1234:i%6);t.status='done';t.doneAt=t.updatedAt=200;G.taskChanged(ws,t,200);G.harvest(ws,t.id,300);}
  G.archiveProject(ws,project.id,Date.UTC(2026,8,24));fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(ws));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  let browser,page;const errors=[];
  try{
    browser=await chromium.launch({channel:process.env.TRACER_QA_BROWSER||'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());await context.addInitScript(()=>localStorage.setItem('tracer.language','zh'));
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.waitForFunction(()=>window.Tracer?.store?.data);
    await page.evaluate(()=>Tracer.show('shop'));await page.locator('[data-store-action="postcards"]').click();assert.equal(await page.locator('.postcard-shop-card').count(),4);
    await page.locator('[data-postcard-buy="pc_forest"]').click();await page.waitForFunction(()=>TaskGarden.postcards(Tracer.store.base).items.find(i=>i.id==='pc_forest').owned);
    assert.equal(await page.evaluate(()=>TaskGarden.economy(Tracer.store.base).balance),340);await page.locator('.store-postcards').screenshot({path:path.join(folder,'shop.png')});
    await page.reload();await page.waitForFunction(()=>window.Tracer?.store?.data);assert.ok(await page.evaluate(()=>TaskGarden.postcards(Tracer.store.data).items.find(i=>i.id==='pc_forest').owned));
    await page.evaluate(()=>Tracer.show('planets'));await page.locator('[data-planet-action="postcard"]').click();await page.waitForFunction(()=>!document.querySelector('.postcard-actions button')?.disabled);
    await page.getByLabel('寄给',{exact:true}).fill('未来的自己');await page.getByLabel('写一句寄语',{exact:true}).fill('那些认真生活的日子，都在这里开成了花。下一段旅程，也要慢慢走，勇敢生长。');
    for(const id of ['pc_field','pc_forest','pc_letter','pc_night']){await page.locator('[data-postcard-style="'+id+'"]').click();assert.equal(await page.locator('.postcard-actions button').first().isDisabled(),['pc_letter','pc_night'].includes(id));await page.locator('.postcard-dialog').screenshot({path:path.join(folder,id+'.png')});}
    await page.locator('[data-postcard-style="pc_forest"]').click();const downloadReady=page.waitForEvent('download');await page.locator('.postcard-actions button').first().click();const download=await downloadReady;await download.saveAs(path.join(folder,'postcard.png'));
    const bytes=fs.readFileSync(path.join(folder,'postcard.png'));assert.equal(bytes.readUInt32BE(16),2400);assert.equal(bytes.readUInt32BE(20),1600);assert.ok(bytes.length>100000,'the exported planet has detailed image content');
    await page.setViewportSize({width:390,height:900});assert.ok(await page.locator('.postcard-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));await page.locator('.postcard-dialog').screenshot({path:path.join(folder,'mobile.png')});await page.keyboard.press('Escape');assert.equal(await page.locator('.postcard-dialog').count(),0);
    await page.setViewportSize({width:1440,height:1100});await page.evaluate(()=>TracerPostcards.open({planet:{id:'empty',name:'An extraordinarily long project name '.repeat(8),completedAt:0,flowers:[],taskCount:0},snapshot:()=>TracerGardenPlanetsView.snapshot(document,{id:'empty',flowers:[]}),collection:TaskGarden.postcards(Tracer.store.base),language:'en'}));await page.waitForFunction(()=>!document.querySelector('.postcard-actions button')?.disabled);await page.getByLabel('Your message',{exact:true}).fill('A'.repeat(180));await page.locator('.postcard-dialog').screenshot({path:path.join(folder,'english-long.png')});await page.keyboard.press('Escape');
    const sheet=await page.evaluate(async()=>{
      const planet=TaskGarden.read(Tracer.store.base).planets[0],globe=await TracerGardenPlanetsView.snapshot(document,planet),canvas=document.createElement('canvas');canvas.width=1664;canvas.height=1280;const c=canvas.getContext('2d');c.fillStyle='#ded9cd';c.fillRect(0,0,1664,1280);
      const items=TaskGarden.postcards(Tracer.store.base).items;for(let i=0;i<items.length;i++){const card=document.createElement('canvas');TracerPostcards.draw(card,{planet,globe,item:items[i],language:'zh'});const x=32+(i%2)*832,y=38+Math.floor(i/2)*630;c.drawImage(card,x,y,800,533);c.fillStyle='#354735';c.font='20px sans-serif';c.fillText(String(i+1).padStart(2,'0')+' / '+items[i].name[0],x,y+570);}return canvas.toDataURL('image/png');
    });fs.writeFileSync(path.join(folder,'styles.png'),Buffer.from(sheet.split(',')[1],'base64'));
    assert.deepEqual(errors,[]);console.log('PASS storefront purchase, reload persistence, locked previews, edited PNG export, 2400 x 1600 dimensions, narrow layout and long English copy.');console.log('Artifacts: '+folder);
  }catch(e){await page?.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});throw e;}
  finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
