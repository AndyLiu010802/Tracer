'use strict';
// Isolated, repeatable idle-render benchmark. No user workspace or external requests.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const M=require('../skins/tracer/model');
const output=fs.mkdtempSync(path.join(__dirname,'../.cache/performance-')),data=path.join(output,'data');fs.mkdirSync(data);
const ws=M.emptyWorkspace();for(let i=0;i<150;i++)M.addTask(ws,{title:'Audit task '+i});M.addNote(ws,{title:'Audit note',body:'Typing and sticker workspace'});
fs.writeFileSync(path.join(data,'workspace.json'),JSON.stringify(ws));Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(output,'state.json')});
const {server}=require('../server');
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
await page.goto(origin+'/?sec=inbox');await page.waitForFunction(()=>Tracer.store.base&&Tracer.pet&&Tracer.garden);await page.waitForTimeout(1500);
const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));const results=[];
for(const section of ['inbox','notes','garden','shop']){await page.evaluate(s=>Tracer.show(s),section);await page.waitForTimeout(1000);await page.evaluate(()=>{window.auditMutations=0;window.auditObserver=new MutationObserver(rows=>window.auditMutations+=rows.length);auditObserver.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});});const before=await metrics();await page.waitForTimeout(4000);const after=await metrics();const mutations=await page.evaluate(()=>{auditObserver.disconnect();return auditMutations;});results.push({section,seconds:4,taskMs:Math.round((after.TaskDuration-before.TaskDuration)*1000),scriptMs:Math.round((after.ScriptDuration-before.ScriptDuration)*1000),layoutMs:Math.round((after.LayoutDuration-before.LayoutDuration)*1000),mutations,heapMB:Math.round(after.JSHeapUsedSize/1048576)});}
const report={date:new Date().toISOString(),platform:process.platform,fixtureTasks:150,results,errors};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));console.log(output);if(errors.length)process.exitCode=1;
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
