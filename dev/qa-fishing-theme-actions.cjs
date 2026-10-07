'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright'),F=require('../public/fishing-model');
const assets=path.resolve(__dirname,'../skins/tracer'),out=path.resolve(__dirname,'../.cache/fishing-theme-actions');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage({viewport:{width:1140,height:858},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://theme-actions.test/**',route=>{const file=path.resolve(assets,'.'+new URL(route.request().url()).pathname);return file.startsWith(assets+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body></body>'});});
  await page.goto('http://theme-actions.test/qa.html');
  await page.addStyleTag({content:'body{margin:0;background:#192e35;color:#e5d4af;font:13px system-ui;display:grid;grid-template-columns:repeat(3,380px)}article{height:286px;position:relative;background:radial-gradient(ellipse at 70% 75%,#354b47,#243943 80%);overflow:hidden}h3{position:absolute;bottom:3px;left:16px;margin:0;font:13px system-ui;color:#dacb9e}section{position:relative;width:380px;height:260px}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}section:before{content:"";position:absolute;left:160px;top:175px;width:166px;height:55px;border-radius:50%;background:radial-gradient(ellipse,#365f66,#27444a);box-shadow:inset 0 1px 2px #80a99e55,0 8px 18px #0f252d55}'});
  await page.addScriptTag({url:'http://theme-actions.test/fishing-rod-effects.js'});
  const rods=F.catalog.rods.filter(r=>['epic','legendary'].includes(r.rarity));
  await page.evaluate(rods=>{
    const original=HTMLCanvasElement.prototype.getContext,counts=window.resourceCounts={created:{},deleted:{}};
    HTMLCanvasElement.prototype.getContext=function(type,...args){const ctx=original.call(this,type,...args);if(type==='webgl'&&ctx&&!ctx.__counted){ctx.__counted=true;for(const name of ['Shader','Program','Buffer','Texture'])for(const verb of ['create','delete']){const method=verb+name,old=ctx[method].bind(ctx);ctx[method]=(...values)=>{const target=verb==='create'?counts.created:counts.deleted;target[name]=(target[name]||0)+1;return old(...values);};}}return ctx;};
    const FX=window.TracerFishingRodEffects;window.scenes=rods.map(rod=>{const article=document.createElement('article'),host=document.createElement('section'),caption=document.createElement('h3');caption.textContent=rod.name[0]+' · '+rod.id;article.append(host,caption);document.body.append(article);return{rod,host,flow:FX.create(host),summon:FX.createSummon(host)};});
    window.drawFrames=(progress,mode='caught',reduced=false)=>{for(const scene of scenes){const {rod,flow,summon}=scene,FX=TracerFishingRodEffects,g={width:380,height:260,grip:{x:66,y:224},tip:{x:133,y:51},water:{x:253,y:194},curve:u=>({x:66+u*67+Math.sin(u*Math.PI)*7,y:224-u*173})};if(mode==='summon'){flow.draw(null,'idle',0,{},g,g.tip,g.water,g.tip,g.water,reduced);summon.draw(rod,FX.summonState(rod,progress*(reduced?260:FX.summonScene(rod.id).duration),reduced),g);}else{summon.draw(rod,null,g);flow.draw({variant:rod.id,energy:rod.rarity==='legendary'?1:.85},mode,(mode==='caught'?680:mode==='cast'?30:0)+progress*(mode==='caught'?1260:mode==='cast'?640:760),{tension:.6},g,g.tip,{x:255,y:190},{x:180,y:58},{x:257,y:110},reduced);}}};
  },rods);
  await page.evaluate(async()=>{await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})));});
  // Renderer-owned images are off DOM; let the intercepted image requests settle.
  await page.waitForLoadState('networkidle');
  const counts=[];
  for(const mode of ['summon','caught','cast'])for(const progress of [.24,.48,.7]){
    await page.evaluate(({progress,mode})=>drawFrames(progress,mode),{progress,mode});
    const stats=await page.evaluate(()=>scenes.map(s=>{const canvas=s.host.querySelector('canvas:not([hidden])'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let pixels=0,x=0,y=0,weight=0;for(let i=3;i<data.length;i+=4)if(data[i]>8){pixels++;const j=(i-3)/4;weight+=data[i];x+=(j%canvas.width)*data[i];y+=Math.floor(j/canvas.width)*data[i];}return{id:s.rod.id,pixels,x:x/weight,y:y/weight,renderer:canvas.dataset.spiritRenderer||''};}));
    for(const stat of stats){assert(stat.pixels>15,`${mode} ${progress} ${stat.id} is visible`);assert([stat.x,stat.y].every(Number.isFinite));}counts.push({mode,progress,stats});
    await page.screenshot({path:path.join(out,`${mode}-${Math.round(progress*100)}.png`)});
  }
  for(const rod of rods){const a=counts.find(s=>s.mode==='caught'&&s.progress===.24).stats.find(s=>s.id===rod.id),b=counts.find(s=>s.mode==='caught'&&s.progress===.7).stats.find(s=>s.id===rod.id);assert(Math.hypot(a.x-b.x,a.y-b.y)>.3||Math.abs(a.pixels-b.pixels)>20,rod.id+' changes its geometry between readable frames');}
  await page.evaluate(()=>drawFrames(.48,'caught',true));await page.screenshot({path:path.join(out,'reduced-motion.png')});
  const resources=await page.evaluate(()=>{for(const scene of scenes){scene.flow.destroy();scene.summon.destroy();scene.flow.destroy();scene.summon.destroy();}return{...resourceCounts,remaining:document.querySelectorAll('canvas').length};});
  assert.equal(resources.remaining,0);assert.deepEqual(resources.created,resources.deleted,'all WebGL allocations are released exactly once');assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,rods:rods.length,counts,resources,errors},null,2));console.log(JSON.stringify({passed:true,out,rods:rods.length,resources}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
