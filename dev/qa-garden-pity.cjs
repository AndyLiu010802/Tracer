'use strict';
// Isolated synthetic profile: no user saves, accounts or external services.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const G=require('../public/task-garden'),M=require('../skins/tracer/model');
const folder=fs.mkdtempSync(path.join(__dirname,'../.cache/garden-pity-ui-')),data=path.join(folder,'data');
fs.mkdirSync(data);
const ws=M.emptyWorkspace(),base=Date.now()-10000;
for(let i=1;i<=150;i++){
  const at=base+i*10,task={id:'pity_'+i,title:'完成第 '+i+' 项任务',projectId:null,status:'doing',createdAt:at,updatedAt:at,doneAt:null,order:i};
  ws.tasks.push(task);G.taskChanged(ws,task,at,limit=>limit===10000?9999:0);
  if(i<150){task.status='done';task.updatedAt=task.doneAt=at+1;G.taskChanged(ws,task,at+1);G.harvest(ws,task.id,at+2);}
}
fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(ws));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
const {server}=require('../server');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  let browser;const errors=[],external=[];
  try{
    browser=await chromium.launch({channel:process.env.TRACER_QA_BROWSER||'msedge',headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
    await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){external.push(url.href);return route.abort();}if(url.pathname.startsWith('/api/ai/'))return route.fulfill({json:{configured:false}});return route.continue();});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    const saved=()=>page.waitForFunction(()=>window.Tracer?.garden&&Tracer.store.base&&!Tracer.store.dirty&&!Tracer.store.inflight);
    const help=()=>page.locator('.garden-home-garden .garden-home-section-help');
    await page.goto(origin);await saved();await page.selectOption('#language-select','zh');await page.click('#nav-garden');
    await page.waitForFunction(()=>document.querySelector('.garden-world')?.dataset.art==='ready');
    assert.match(await help().textContent(),/最多 1 个任务出精灵，1 个任务出闪光精灵/);
    await page.evaluate(()=>{TracerModel.moveTask(Tracer.store.data,'pity_150','done');Tracer.touch();Tracer.redraw();});await saved();
    await page.waitForFunction(()=>document.querySelector('.garden-home-garden .garden-home-section-help')?.textContent.includes('30 个任务出精灵，150 个任务出闪光精灵'));
    assert.equal(await page.evaluate(()=>TaskGarden.read(Tracer.store.base).seeds.find(s=>s.taskId==='pity_150').variant),'shiny');
    await page.evaluate(()=>{TaskGarden.harvest(Tracer.store.data,'pity_150');Tracer.touch();Tracer.redraw();});await saved();
    await page.reload();await saved();await page.click('#nav-garden');
    assert.deepEqual(await page.evaluate(()=>TaskGarden.pity(Tracer.store.base)),{companion:0,shiny:0,companionRemaining:30,shinyRemaining:150});
    for(const language of ['zh','en'])for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000});await page.selectOption('#language-select',language);await help().scrollIntoViewIfNeeded();
      const text=await help().textContent();assert.ok(text.includes('30')&&text.includes('150'),text);assert.ok(text.includes(language==='zh'?'保底':'Guaranteed'),text);
      const bounds=await page.locator('.garden-home').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,page:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert.ok(bounds.scroll<=bounds.width+1&&bounds.page<=bounds.viewport+1,JSON.stringify(bounds));
      await page.screenshot({path:path.join(folder,language+'-'+width+'.png'),animations:'disabled'});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log('PASS 150-task shiny guarantee, shared reset, save/reload and bilingual desktop/mobile progress');console.log('Artifacts: '+folder);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
