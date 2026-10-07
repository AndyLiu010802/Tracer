const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright'),F=require('../public/fishing-model');
const assets=path.resolve(__dirname,'../skins/tracer'),out=path.join(__dirname,'../.cache/rod-summon');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:304,height:208},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let time=100,serial=0;const callbacks=new Map();Object.defineProperty(performance,'now',{value:()=>time});window.requestAnimationFrame=fn=>{callbacks.set(++serial,fn);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);window.advance=ms=>{time+=ms;const frame=[...callbacks.values()];callbacks.clear();for(const fn of frame)fn(time);};window.FishingDesktop={send(){},onSnapshot(fn){window.receiveFishing=fn;return()=>{};}};});
 await page.route('**/*',route=>{const url=new URL(route.request().url()),file=path.resolve(assets,'.'+url.pathname);if(url.origin!=='http://summon.test'||!file.startsWith(assets+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({path:file});});
 await page.goto('http://summon.test/fishing-desktop.html');await page.waitForFunction(()=>window.receiveFishing);
 await page.addStyleTag({content:'body{background:linear-gradient(115deg,#273b48,#516657)!important}'});
 const update=async(rod,phase)=>page.evaluate(({rod,phase})=>{receiveFishing({language:'zh',rod,session:{id:'summon-'+rod.id,phase,castPower:.4}});advance(16);},{rod,phase});
 const sample=()=>page.evaluate(()=>{const c=document.querySelector('.fishing-summon-canvas'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let painted=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>8)painted++;return{hidden:c.hidden,tier:c.dataset.tier,p:Number(c.dataset.progress),painted,opacity:Number(document.getElementById('fishing-rod').style.opacity)};});
 const results=[];
 for(const rod of F.catalog.rods){
  await update(rod,'idle');assert((await sample()).hidden);await update(rod,'charging');
  if(['golden','guandao','dragon','phoenix'].includes(rod.id))await page.waitForFunction(()=>{advance(1);return !!document.querySelector('.fishing-summon-canvas').dataset.apparition;},null,{polling:30});
  await page.evaluate(()=>advance(180));const a=await sample();assert.equal(a.tier,rod.rarity);assert(a.painted>5,rod.id+' draws light');
  await update(rod,'charging');const b=await sample();assert(b.p>a.p,'snapshots do not restart entrance');
  await update(rod,'cast');assert((await sample()).p>b.p,'releasing a fast cast preserves entrance clock');
  if(['epic','legendary'].includes(rod.rarity)){await page.evaluate(()=>advance(430));
    if(['golden','guandao','dragon','phoenix'].includes(rod.id)){const state=await page.locator('.fishing-summon-canvas').evaluate(c=>{const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0,total=0,opaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>2){count++;total+=pixels[i];if(pixels[i]>220)opaque++;}return{alpha:Number(c.dataset.spiritAlpha),renderer:c.dataset.spiritRenderer,material:c.dataset.spiritMaterial,meanAlpha:total/count,opaqueFraction:opaque/count};});assert(state.alpha>0&&state.alpha<=.86,'spirit body retains a bounded opacity envelope');assert(state.meanAlpha>30&&state.meanAlpha<150,'spirit is readable while remaining translucent');assert(state.opaqueFraction<.03,'crystal highlights do not become an opaque silhouette '+JSON.stringify({rod:rod.id,...state}));assert.equal(state.renderer,'webgl');assert.equal(state.material,'translucent-crystal');results.push({spirit:rod.id,...state});}
    assert.equal(await page.locator('.fishing-motion-fx').isVisible(),false,'old action overlays stay quiet during the entrance');await page.screenshot({path:path.join(out,rod.id+'.png')});}
  await page.evaluate(()=>advance(4000));assert((await sample()).hidden);assert.equal((await sample()).opacity,1);await update(rod,'waiting');assert((await sample()).hidden,'no repeating entrance while waiting');
  await update(rod,'idle');await update(rod,'charging');await page.evaluate(()=>advance(120));assert(!(await sample()).hidden);await update(rod,'escaped');assert((await sample()).hidden,'cancel/escape clears entrance');results.push({id:rod.id,tier:a.tier,painted:a.painted});
 }
 const FX=require('../skins/tracer/fishing-rod-effects'),sequence=[];
 for(const id of ['guandao','phoenix','golden','katana']){
  const rod=F.catalog.rods.find(r=>r.id===id),duration=FX.summonScene(id).duration;await update(rod,'idle');await update(rod,'charging');let age=16;
  for(const p of [.20,.43,.60,.75,.86,.98]){
   const target=duration*p;await page.evaluate(dt=>advance(dt),target-age);age=target;
   const state=await sample();assert(state.painted>0);if(p<.6)assert.equal(state.opacity,0,'the creature appears before the weapon');if(p>.95)assert.equal(state.opacity,1,'the weapon is complete before casting');
   const file=id+'-stage-'+Math.round(p*100)+'.png';await page.screenshot({path:path.join(out,file)});sequence.push({id,p,file,opacity:state.opacity});
  }
 }
 const review=await browser.newPage({viewport:{width:1824,height:960},deviceScaleFactor:1});
 await review.setContent('<style>body{margin:0;background:#243a40;color:#efdfb9;font:14px system-ui;display:grid;grid-template-columns:repeat(6,304px)}figure{margin:0;height:240px}img{width:304px;height:208px}figcaption{padding:4px 12px}</style>'+sequence.map(row=>'<figure><img src="data:image/png;base64,'+fs.readFileSync(path.join(out,row.file)).toString('base64')+'"><figcaption>'+row.id+' · '+Math.round(row.p*100)+'%</figcaption></figure>').join(''));
 await review.screenshot({path:path.join(out,'transformation-sequence.png')});await review.close();
 await page.emulateMedia({reducedMotion:'reduce'});await update(F.catalog.rods.at(-1),'idle');await update(F.catalog.rods.at(-1),'charging');await page.evaluate(()=>advance(100));assert(!(await sample()).hidden);await page.evaluate(()=>advance(180));assert((await sample()).hidden);assert.equal((await sample()).opacity,1);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,out,rods:F.catalog.rods.length,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
