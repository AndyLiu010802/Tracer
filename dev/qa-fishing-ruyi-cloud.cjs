'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'skins/tracer'),out=path.join(root,'output/fishing-ruyi-cloud');fs.mkdirSync(out,{recursive:true});
const scripts=['fishing-model','fishing-lighting','fishing-aquatic-renderer','fishing-crafted-rods','fishing-art','fishing-expansion-effects','fishing-spell-effects','fishing-journey-effects','fishing-rod-effects','fishing-rod-renderer'];
const html='<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fishing-scene.css"><link rel="stylesheet" href="/fishing-desktop.css"><style>html,body{overflow:auto;background:#263e34;color:#f0dfb9}body{padding:30px;font:14px system-ui}h1{font-size:22px;font-weight:500}p{color:#b4c0ac}#desktop-fishing{position:relative;zoom:1;overflow:hidden;background:radial-gradient(ellipse at 64% 28%,#486453,#263c31 74%);border-radius:16px;border:1px solid #81977555}#row{display:flex;gap:32px;align-items:center}.detail{position:relative;width:240px;height:210px;border:1px solid #81977555;border-radius:16px;background:#314d40}.detail .fishing-themed-float{width:192px;height:144px}#small{position:relative;width:170px;height:75px}.hint{position:absolute;left:15px;bottom:12px;font-size:12px;color:#c2c9af}</style><h1>如意定海 · 祥云</h1><p>桌面尺寸与鱼漂细节</p><div id="row"><section id="desktop-fishing"><div id="fishing-pond"></div><div id="fishing-rod"></div><svg id="fishing-line" viewBox="0 0 380 260"><path/></svg><button id="fishing-float" style="left:268px;top:151px;transform:translate(-50%,-50%)"><i></i><b></b></button><div class="fishing-motion-fx" id="fx"></div></section><div><div class="detail" id="detail"><span class="hint">祥云鱼漂 · 放大细节</span></div><div id="small"></div></div></div>'+scripts.map(s=>'<script src="/'+s+'.js"></script>').join('');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:750,height:425},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://ruyi-cloud.test/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});const file=path.resolve(assets,'.'+url.pathname);return file.startsWith(assets+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.abort();});await page.goto('http://ruyi-cloud.test/');
  const report=await page.evaluate(()=>{
   const E=TracerFishingRodEffects,R=TracerFishingRodRenderer,F=TracerFishingModel,rod=F.catalog.rods.find(r=>r.id==='ruyi'),bobber=document.querySelector('#fishing-float');
   window.pond=TracerFishingArt.createPond(document.querySelector('#fishing-pond'),{pond:{style:'meadow'},fish:[],interactive:false,zoom:1.12});
   window.model=R.create(document.querySelector('#fishing-rod'),{rod,bend:.08});window.flow=E.create(document.querySelector('#fx'));
   const before=[bobber.style.left,bobber.style.top,bobber.offsetWidth,bobber.offsetHeight];E.decorateBobber(bobber,rod);E.decorateBobber(bobber,rod);
   document.querySelector('#detail').insertAdjacentHTML('beforeend',E.bobberMarkup(rod));document.querySelector('#small').insertAdjacentHTML('beforeend',E.bobberMarkup(rod));
   const scale=170/418,g={width:380,height:260,grip:{x:54,y:237},tip:{x:134,y:82},water:{x:268,y:151},curve:s=>{const p=R.curvePoint(s,.08);return{x:42+p.x*scale,y:77+p.y*scale};}};g.grip=g.curve(0);g.tip=g.curve(1);
   document.querySelector('#fishing-line path').setAttribute('d',`M${g.tip.x} ${g.tip.y} Q205 114 268 151`);
   window.drawClouds=(time,quiet=false,phase='idle',age=4000)=>flow.draw({variant:'ruyi',energy:1},phase,age,{effectTime:time},g,g.tip,g.water,g.tip,g.water,quiet);drawClouds(1200);
   const initial=E.ruyiCloudField(1200,g),later=E.ruyiCloudField(2400,g),still=E.ruyiCloudField(12,g,true),stillLater=E.ruyiCloudField(98765,g,true);
   let maxStep=0;for(let t=0;t<10000;t+=16){const a=E.ruyiCloudField(t,g),b=E.ruyiCloudField(t+16,g);a.forEach((p,i)=>maxStep=Math.max(maxStep,Math.hypot(p.x-b[i].x,p.y-b[i].y)));}
   return {before,after:[bobber.style.left,bobber.style.top,bobber.offsetWidth,bobber.offsetHeight],count:bobber.querySelectorAll('svg').length,ids:[...document.querySelectorAll('linearGradient')].map(n=>n.id),initial,later,still,stillLater,maxStep};
  });
  assert.deepEqual(report.before,report.after);assert.equal(report.count,1);assert.equal(new Set(report.ids).size,report.ids.length);assert.notDeepEqual(report.initial,report.later);assert.deepEqual(report.still,report.stillLater);assert(report.maxStep<.12);
  await page.waitForTimeout(250);await page.screenshot({path:path.join(out,'preview.png')});
  const check=await page.evaluate(()=>{const c=document.querySelector('.fishing-flow-canvas');drawClouds(1200);const a=c.toDataURL();drawClouds(2400);const b=c.toDataURL();drawClouds(1200,true);const q=c.toDataURL();drawClouds(2400,true);const r=c.toDataURL();const E=TracerFishingRodEffects,F=TracerFishingModel,node=document.querySelector('#fishing-float');E.decorateBobber(node,F.catalog.rods.find(r=>r.id==='erlang'));const erlang=node.querySelector('svg').dataset.floatTheme;E.decorateBobber(node,F.catalog.rods[0]);return {animated:a!==b,quiet:q===r,erlang,restored:!node.querySelector('svg')&&getComputedStyle(node.querySelector('i')).visibility==='visible'};});
  assert(check.animated&&check.quiet&&check.restored);assert.equal(check.erlang,'erlang');
  const quietFrames=await page.evaluate(()=>{
    const c=document.querySelector('.fishing-flow-canvas'),rows=[];
    for(const phase of ['waiting','reeling','escaped'])for(const age of [0,230,1280,5000]){
      drawClouds(1200);drawClouds(2400,false,phase,age);
      const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let pixels=0;for(let i=3;i<data.length;i+=4)if(data[i])pixels++;
      rows.push({phase,age,pixels,event:c.dataset.event,spell:c.dataset.spell});
    }
    TracerFishingRodEffects.decorateBobber(document.querySelector('#fishing-float'),TracerFishingModel.catalog.rods.find(r=>r.id==='ruyi'));
    drawClouds(2400,false,'reeling',5000);return rows;
  });
  assert(quietFrames.every(f=>f.pixels===0&&f.event===''&&f.spell===''));
  await page.screenshot({path:path.join(out,'playing-quiet.png')});
  await page.evaluate(()=>{pond.destroy();model.destroy();flow.destroy();});assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,...report,...check,quietFrames,errors},null,2));console.log(JSON.stringify({passed:true,out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
