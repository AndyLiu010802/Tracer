'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/wallpaper-motion-'));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(folder,'data'),DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
const {server}=require('../server'),items=require('../public/wallpaper-catalog.json').filter(i=>i.type==='dynamic');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1500,height:1200}}),page=await context.newPage(),errors=[],photos=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/dynamic-.*\.png/.test(r.url()))photos.push(r.url());});
 try{
  const html=fs.readFileSync(path.join(root,'design/dynamic-wallpapers-v2/index.html'),'utf8').replace('<script src="catalog.js"></script>','<script>window.DYNAMIC_SCENES='+JSON.stringify(items)+'</script>').replace('../../skins/tracer/wallpaper-motion.js','/wallpaper-motion.js');
  await context.route(origin+'/motion-review',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto(origin+'/motion-review');await page.waitForFunction(()=>document.querySelectorAll('.tile canvas[data-renderer=particles]').length===10);await page.click('#pause');
  const stats=await page.evaluate(items=>items.map(item=>{
   const c=document.createElement('canvas');c.width=1000;c.height=625;const q=c.getContext('2d'),M=TracerWallpaperMotion,snapshot=t=>{M.draw(c,item,t);return q.getImageData(0,0,1000,625).data;},delta=(a,b)=>{let sum=0;for(let i=0;i<a.length;i+=4)sum+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);return sum/(625000*3);};
   const a=snapshot(4),b=snapshot(7),tiny=snapshot(4.033),same=snapshot(4);let opaque=true;for(let i=3;i<a.length;i+=4)if(a[i]!==255)opaque=false;
   const start=performance.now();for(let i=0;i<20;i++)M.draw(c,item,i/30);q.getImageData(0,0,1,1);const frameMs=(performance.now()-start)/20;
   return{id:item.id,opaque,change:delta(a,b),step:delta(a,tiny),repeat:delta(a,same),frameMs,signature:c.toDataURL().slice(-500)};
  }),items);
  for(const r of stats){assert.ok(r.opaque,r.id+' opaque');assert.ok(r.change>.02,r.id+' visible motion '+r.change);assert.ok(r.step<r.change,r.id+' smooth small step');assert.equal(r.repeat,0,r.id+' deterministic');assert.ok(r.frameMs<60,r.id+' frame budget '+r.frameMs);}assert.equal(new Set(stats.map(s=>s.signature)).size,10);
  await page.locator('#grid').screenshot({path:path.join(root,'docs/procedural-wallpapers.png')});await page.locator('#scene').screenshot({path:path.join(folder,'aurora.png')});
  const hero=page.locator('#hero'),snapshot=()=>hero.evaluate(c=>c.toDataURL());await page.click('#pause');await page.waitForTimeout(120);let before=await snapshot();await page.waitForTimeout(250);assert.notEqual(await snapshot(),before,'plays');await page.click('#pause');before=await snapshot();await page.waitForTimeout(180);assert.equal(await snapshot(),before,'pauses');
  await page.click('#pause');await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(90);before=await snapshot();await page.waitForTimeout(160);assert.equal(await snapshot(),before,'reduced motion');assert.ok(await page.locator('#pause').isDisabled());await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{player.pause(true);player.speed(2);for(const item of DYNAMIC_SCENES)player.set(item);});assert.equal(await hero.getAttribute('data-scene-id'),'d10');assert.equal(await hero.getAttribute('data-motion-speed'),'2');
  for(const viewport of [{width:390,height:900},{width:2200,height:1800}]){await page.setViewportSize(viewport);await page.waitForTimeout(100);assert.ok(await hero.evaluate(c=>c.width>0&&c.height>0&&c.width<=1920&&c.height<=1600));}
  await page.setViewportSize({width:1500,height:1200});await page.evaluate(()=>{player.pause(false);hero.style.position='absolute';hero.style.top='-5000px';});await page.waitForTimeout(100);before=await snapshot();await page.waitForTimeout(150);assert.equal(await snapshot(),before,'offscreen pauses');
  await page.evaluate(()=>{hero.style.position='';hero.style.top='';player.destroy();});await page.waitForTimeout(100);before=await snapshot();await page.waitForTimeout(150);assert.equal(await snapshot(),before,'destroy cancels');
  assert.deepEqual(photos,[]);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'motion-stats.json'),JSON.stringify(stats,null,2));console.log('PASS: 10 procedural styles, deterministic, opaque, smooth motion, pause, reduced motion, resize, rapid switch, offscreen and cleanup. '+folder);console.log(stats.map(({id,change,step,frameMs})=>({id,change,step,frameMs})));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
