'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const assets=path.resolve(__dirname,'../skins/tracer'),out=path.resolve(__dirname,'../output/fishing-relic-upgrade');
const scripts=['fishing-vfx-tween','fishing-painted-vfx','fishing-relic-vfx','fishing-onepiece-vfx','fishing-naruto-vfx','fishing-valorant-vfx'];
const cases=[['Relic','thunderdrum','天雷鼓'],['Relic','ruyi','如意定海'],['Relic','guanyuyunchang','关羽'],['OnePiece','anime_luffy','路飞'],['OnePiece','anime_nika','尼卡'],['OnePiece','anime_zoro','索隆'],['Naruto','anime_naruto','鸣人'],['Naruto','anime_minato','水门'],['Valorant','valorant_jett','捷风'],['Valorant','valorant_spike','爆能器']];
const html='<meta charset="utf-8">'+scripts.map(s=>'<script src="/'+s+'.js"></script>').join('')+'<canvas id="stage" width="380" height="260"></canvas>';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://motion.test/**',route=>{const p=new URL(route.request().url()).pathname;if(p==='/')return route.fulfill({contentType:'text/html',body:html});const file=path.resolve(assets,'.'+p);return file.startsWith(assets+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.abort();});
  await page.goto('http://motion.test/');
  const results=[],reviews=[];
  for(const [collection,id,name]of cases){
   const result=await page.evaluate(async({collection,id})=>{
    const api=window['TracerFishing'+collection+'VFX'],canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
    let running=true;const ticks=[];function tick(t){ticks.push(t);if(running)requestAnimationFrame(tick);}requestAnimationFrame(tick);
    const start=performance.now();await api.load(document,id);const warmMs=performance.now()-start;running=false;
    const stats=TracerFishingVFXTween.stats(document);if(!stats.ready)throw Error('Interpolation worker is not ready: '+JSON.stringify(stats));
    const spike=id==='valorant_spike',phase=spike?'detonating':'caught',duration=spike?950:api.duration?api.duration(id,phase):api.durations[phase],count=Math.ceil(duration*30/1000);
    const g={width:380,height:260,water:{x:245,y:173},grip:{x:60,y:211}},tip={x:83,y:62},values={effectSeed:4,waitDuration:3800};
    const sheet=document.createElement('canvas');sheet.width=380*8;sheet.height=260*Math.ceil(count/8);const sc=sheet.getContext('2d');
    const frames=[],drawMs=[],checksums=[],deltas=[],wristSamples=[];let previous=null;
    for(let i=0;i<count;i++){
     const age=i*1000/30,p=age/duration,point={x:245-86*p,y:173-35*Math.sin(p*Math.PI)};ctx.clearRect(0,0,380,260);
     const before=performance.now();const q=api.draw(ctx,id,phase,age,values,g,tip,point);drawMs.push(performance.now()-before);if(!q)throw Error(id+' missing pose '+i);
     const data=ctx.getImageData(0,0,380,260).data;let checksum=2166136261,delta=0,occupied=0;for(let k=0;k<data.length;k++){checksum=Math.imul(checksum^data[k],16777619)>>>0;if(previous)delta+=Math.abs(data[k]-previous[k]);if(k%4===3&&data[k]>10)occupied++;}checksums.push(checksum);deltas.push(delta/data.length);previous=data;
     if((id==='anime_luffy'||id==='anime_nika')&&q.alpha>.8){const joint=TracerFishingPaintedVFX.wrist(id,q),c=Math.cos(q.rotation),s=Math.sin(q.rotation);if(Math.hypot(joint.x-tip.x,joint.y-tip.y)>joint.width*2){let minAlpha=255;for(const along of [-.7,-.4,-.1,.2,.5])for(const across of [-.18,0,.18]){const x=Math.round(joint.x+(along*c-across*s)*joint.width),y=Math.round(joint.y+(along*s+across*c)*joint.width);minAlpha=Math.min(minAlpha,data[(y*380+x)*4+3]);}wristSamples.push({age,minAlpha,opacity:q.alpha});}}
     frames.push({age,occupied,frame:q.frame,alpha:q.alpha});
     sc.fillStyle='#243c39';sc.fillRect(i%8*380,Math.floor(i/8)*260,380,260);sc.drawImage(canvas,i%8*380,Math.floor(i/8)*260);
    }
    // Measure the rendering budget without readback/screenshot overhead.
    const timings=[];for(let i=0;i<300;i++){ctx.clearRect(0,0,380,260);const t=performance.now();api.draw(ctx,id,phase,100+(i%20)*15,values,g,tip,g.water);timings.push(performance.now()-t);}timings.sort((a,b)=>a-b);
    return{id,collection,warmMs,stats,frames,deltas,wristSamples,unique:new Set(checksums).size,count,p95DrawMs:timings[Math.floor(timings.length*.95)],warmFrameGaps:ticks.slice(1).map((t,i)=>t-ticks[i]),sheet:sheet.toDataURL('image/webp',.91)};
   },{collection,id});
   const file='motion-'+id+'.webp';fs.writeFileSync(path.join(out,file),Buffer.from(result.sheet.split(',')[1],'base64'));delete result.sheet;
   assert(result.unique>result.count*.8,id+' repeated poses');assert(result.p95DrawMs<33.33,id+' exceeds 30 Hz draw budget');assert(!result.stats.failed,id+' worker failed');for(const sample of result.wristSamples)assert(sample.minAlpha>sample.opacity*200,id+' wrist gap at '+sample.age);
   reviews.push({file,name,count:result.count});results.push(result);console.log(JSON.stringify({id,frames:result.count,unique:result.unique,warmMs:result.warmMs,p95DrawMs:result.p95DrawMs}));
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'continuity-qa.json'),JSON.stringify({passed:true,fps:30,results,errors},null,2));
  fs.writeFileSync(path.join(out,'motion-review.html'),'<!doctype html><meta charset="utf-8"><title>钓鱼特效动作检查</title><style>body{background:#172c29;color:#eee3c9;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(3,380px);gap:18px}canvas{width:380px;height:260px;background:#243c39;border-radius:12px}p{margin:6px 0 22px}button{margin-bottom:16px;padding:9px 20px}small{color:#b6c9c1}</style><h1>钓鱼特效 · 30 帧动作</h1><small>发力、命中、收势；路飞抓握跟随鱼的回程。循环间留白一秒。</small><br><button id="pause">暂停</button><main></main><script>const items='+JSON.stringify(reviews)+';let paused=false,time=0,last=performance.now();pause.onclick=()=>{paused=!paused;pause.textContent=paused?"播放":"暂停"};const players=items.map(x=>{const box=document.createElement("section"),c=document.createElement("canvas"),p=document.createElement("p"),im=new Image();c.width=380;c.height=260;p.textContent=x.name;im.src=x.file;box.append(c,p);document.querySelector("main").append(box);return{...x,c,im}});function draw(t){if(!paused)time+=t-last;last=t;for(const x of players){const f=Math.floor(time/1000*30)%(x.count+30),ctx=x.c.getContext("2d");ctx.clearRect(0,0,380,260);if(f<x.count&&x.im.complete)ctx.drawImage(x.im,f%8*380,Math.floor(f/8)*260,380,260,0,0,380,260);}requestAnimationFrame(draw)}requestAnimationFrame(draw);</script>');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
