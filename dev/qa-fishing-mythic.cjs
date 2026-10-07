'use strict';
// Real Canvas/WebGL effects, deterministic phase clock, no application profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'../.cache/desktop-qa-tools/node_modules/playwright');
const F=require('../public/fishing-model'),FX=require('../skins/tracer/fishing-rod-effects');
const assets=path.resolve(__dirname,'../skins/tracer'),out=fs.mkdtempSync(path.resolve(__dirname,'../.cache/fishing-mythic-'));
const rods=F.catalog.rods.filter(rod=>FX.mythicGeometry(rod.id,{progress:.4}).length);
const report={out,errors:[],frames:[],source:crypto.createHash('sha256').update(fs.readFileSync(path.join(assets,'fishing-rod-effects.js'))).digest('hex')};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--max-active-webgl-contexts=64']});try{
  const page=await browser.newPage({viewport:{width:1216,height:1000},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!=='http://mythic.test')return route.abort();const file=path.resolve(assets,'.'+url.pathname);return file.startsWith(assets+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body></body>'});});
  await page.goto('http://mythic.test/qa.html');
  await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:0;display:grid;grid-template-columns:repeat(4,304px);background:#13252d;color:#e8dab6;font:12px system-ui}article{height:236px;background:radial-gradient(ellipse at 70% 70%,#385451,#1c303b);border:1px solid #5d797533}section{position:relative;width:304px;height:208px;overflow:hidden}canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}h3{margin:0;padding:0 12px;font-size:12px}section:before{content:"";position:absolute;left:132px;top:135px;width:136px;height:50px;border-radius:50%;background:radial-gradient(ellipse,#547975,#284850);box-shadow:inset 0 1px #a6d1b822}section:after{content:"";position:absolute;right:10px;top:82px;width:18px;height:91px;border:1px dashed #cca66f44;border-radius:10px}'});
  await page.addScriptTag({url:'http://mythic.test/fishing-rod-effects.js'});
  await page.evaluate(rods=>{
    const original=HTMLCanvasElement.prototype.getContext,counts=window.resourceCounts={created:{},deleted:{}};
    HTMLCanvasElement.prototype.getContext=function(type,...args){const ctx=original.call(this,type,...args);if(type==='webgl'&&ctx&&!ctx.__counted){ctx.__counted=true;for(const name of ['Shader','Program','Buffer','Texture'])for(const verb of ['create','delete']){const method=verb+name,old=ctx[method].bind(ctx);ctx[method]=(...values)=>{const target=verb==='create'?counts.created:counts.deleted;target[name]=(target[name]||0)+1;return old(...values);};}}return ctx;};
    const FX=TracerFishingRodEffects;window.scenes=rods.map(rod=>{const article=document.createElement('article'),host=document.createElement('section'),caption=document.createElement('h3');caption.textContent=rod.name[0]+' · '+rod.id;article.dataset.rod=rod.id;article.append(host,caption);document.body.append(article);return{rod,host,fx:FX.create(host),summon:FX.createSummon(host)};});
    window.draw=(mode,p,reduced=false)=>{for(const s of scenes){const width=s.host.clientWidth,height=s.host.clientHeight;if(!width||!height)continue;const g={width,height,grip:{x:width*.18,y:height*.87},tip:{x:width*.37,y:height*.17},water:{x:width*.69,y:height*.71},curve:u=>({x:width*(.18+.19*u+.025*Math.sin(u*Math.PI)),y:height*(.87-.70*u)})};
      if(mode==='summon'||mode==='depart'){s.fx.draw(null,'idle',0,{},g,g.tip,g.water,g.tip,g.water,reduced);const state=FX.summonState(s.rod,p*(reduced?260:FX.summonScene(s.rod.id).duration),reduced);s.summon.draw(s.rod,{...state,departing:mode==='depart'},g);}
      else{s.summon.draw(s.rod,null,g);const duration=mode==='caught'?1260:mode==='bite'?560:mode==='cast'?640:760,start=mode==='caught'?680:mode==='cast'?30:0;s.fx.draw({variant:s.rod.id,energy:s.rod.rarity==='legendary'?1:.85},mode,start+p*duration,{tension:.58},g,g.tip,g.water,{x:width*.46,y:height*.16},{x:width*.68,y:height*.4},reduced);}
    }};
    window.stats=()=>scenes.map(s=>{const c=s.host.querySelector('canvas:not([hidden])'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0,hash=2166136261,edgeAlpha=0,minX=c.width,maxX=0,minY=c.height,maxY=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const alpha=pixels[(y*c.width+x)*4+3];if(alpha>8){count++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}if(x<2||y<2||x>=c.width-2||y>=c.height-2)edgeAlpha=Math.max(edgeAlpha,alpha);hash=Math.imul(hash^alpha,16777619)>>>0;}return{id:s.rod.id,count,hash,edgeAlpha,bounds:[minX,minY,maxX,maxY],dataset:{...c.dataset}};});
  },rods);
  await page.evaluate(()=>{for(const s of scenes)s.summon.preload(s.rod);});
  await page.waitForLoadState('networkidle');
  if(!process.argv.includes('--live-only')){
  for(const mode of ['summon','cast','bite','reeling','caught','depart'])for(const p of (mode==='summon'?[.18,.34,.43,.60,.82]:mode==='depart'?[.72,.48,.22]:[.24,.48,.7])){
    await page.evaluate(({mode,p})=>draw(mode,p),{mode,p});const stats=await page.evaluate(()=>window.stats());
    for(const s of stats){assert(s.count>15,`${s.id} ${mode} ${p} visible`);assert(s.edgeAlpha<20,`${s.id} ${mode} ${p} clips at canvas edge: ${s.edgeAlpha}`);}
    const file=mode+'-'+Math.round(p*100)+'.png';await page.screenshot({path:path.join(out,file),fullPage:true});report.frames.push({mode,p,file,stats});
    if(mode==='summon')await page.locator('[data-rod="katana"]').screenshot({path:path.join(out,'asura-'+Math.round(p*100)+'.png')});
  }
  for(const rod of rods)for(const mode of ['summon','cast','bite','reeling','caught']){const frames=report.frames.filter(f=>f.mode===mode).map(f=>f.stats.find(s=>s.id===rod.id));assert(new Set(frames.map(f=>f.hash)).size>1,rod.id+' '+mode+' physical animation');}
  await page.evaluate(()=>draw('caught',.48,true));const quietA=await page.evaluate(()=>stats());await page.evaluate(()=>draw('caught',.66,true));const quietB=await page.evaluate(()=>stats());
  // Event alpha can finish under reduced motion; the actual normalized mesh is
  // fixed and is verified in the numeric tests, while Canvas remains readable.
  assert(quietA.every(s=>s.count>0));report.reduced={first:quietA,last:quietB};await page.screenshot({path:path.join(out,'reduced.png'),fullPage:true});
  // Larger faithful runtime crops let reviewers inspect faces, joints, blade
  // geometry and crystalline density instead of approving a tiny contact sheet.
  await page.addStyleTag({content:'body.hero{display:block;width:600px}body.hero article{width:600px;height:430px}body.hero section{width:600px;height:400px}'});
  for(const id of rods.filter(rod=>FX.summonScene(rod.id)?.art).map(rod=>rod.id)){
    await page.evaluate(id=>{document.body.classList.add('hero');for(const a of document.querySelectorAll('article'))a.style.display=a.dataset.rod===id?'':'none';
      document.querySelectorAll('.source-reference').forEach(n=>n.remove());const art=TracerFishingRodEffects.summonScene(id)?.art;if(art){const image=document.createElement('img');image.className='source-reference';image.src='/fishing-art/'+art;image.style.cssText='position:absolute;left:345px;top:90px;width:200px;height:202px;object-fit:contain;opacity:.45;pointer-events:none';document.querySelector('[data-rod="'+id+'"] section').append(image);}
    },id);
    for(const p of [.26,.40,.60]){await page.evaluate(p=>draw('summon',p),p);await page.locator('[data-rod="'+id+'"]').screenshot({path:path.join(out,id+'-hero-'+Math.round(p*100)+'.png')});}
  }
  }
  report.resources=await page.evaluate(()=>{for(const s of scenes){s.fx.destroy();s.summon.destroy();s.fx.destroy();s.summon.destroy();}return resourceCounts;});assert.equal(await page.locator('canvas').count(),0);assert.deepEqual(report.resources.created,report.resources.deleted);assert.deepEqual(report.errors,[]);
  // Use the actual desktop HTML, pond renderer, motion rig and summon menu for
  // final composition. The bridge supplies isolated snapshots; no user data.
  const live=await browser.newPage({viewport:{width:304,height:208},deviceScaleFactor:2}),requests=[];
  live.on('pageerror',error=>report.errors.push(error.message));live.on('request',request=>{if(/\/fishing-art\/summon-|\/golden-caishen/.test(request.url()))requests.push(new URL(request.url()).pathname);});
  await live.addInitScript(()=>{let time=100,serial=0;const callbacks=new Map();Object.defineProperty(performance,'now',{value:()=>time});window.requestAnimationFrame=fn=>{callbacks.set(++serial,fn);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);window.advance=ms=>{time+=ms;const frame=[...callbacks.values()];callbacks.clear();for(const fn of frame)fn(time);};window.qaTime=()=>time;window.FishingDesktop={send(){},onSnapshot(fn){window.receiveFishing=fn;return()=>{};},onMenuAction(fn){window.menuFishing=fn;return()=>{};}};});
  await live.route('**/*',route=>{const url=new URL(route.request().url()),file=path.resolve(assets,'.'+url.pathname);if(url.origin!=='http://mythic.test'||!file.startsWith(assets+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({path:file});});
  await live.goto('http://mythic.test/fishing-desktop.html');await live.waitForFunction(()=>window.receiveFishing&&window.menuFishing,null,{polling:50});await live.waitForLoadState('networkidle');assert.equal(requests.length,0,'unequipped production host does not request the complete spirit library');
  await live.addStyleTag({content:'body{background:linear-gradient(130deg,#1b333f,#547363)!important}'});
  const actual=[];
  for(const rod of rods){
    const before=requests.length,art=FX.summonScene(rod.id)?.art,ready=art?live.waitForResponse(response=>response.url().endsWith('/fishing-art/'+art)):null;
    await live.evaluate(rod=>{receiveFishing({language:'zh',rod,desktopPond:{pond:{style:'meadow'},fish:[]},session:{id:'live-'+rod.id,phase:'idle'}});advance(16);},rod);if(ready)await (await ready).finished();await live.waitForLoadState('networkidle');
    assert.deepEqual(requests.slice(before),art?['/fishing-art/'+art]:[],rod.id+' only preheats its equipped illustration');
    await live.evaluate(()=>menuFishing({type:'summon-rod'}));let age=0;
    for(const p of rod.id==='katana'?[.20,.31,.38,.45,.58,.76,.92]:[.40,.76]){
      const target=FX.summonScene(rod.id).duration*p;await live.evaluate(dt=>advance(dt),target-age);age=target;
      const state=await live.evaluate(()=>({summon:{...document.querySelector('.fishing-summon-canvas').dataset},power:document.getElementById('fishing-power').hidden,reel:document.getElementById('fishing-reel').hidden,phase:document.getElementById('desktop-fishing').dataset.phase}));assert(state.power&&state.reel,'summoning never exposes fishing progress bars');assert.equal(state.phase,'idle');
      if(art)assert.equal(state.summon.spiritRenderer,'webgl',rod.id+' uses its continuous crystal surface');const file='pond-'+rod.id+'-'+Math.round(p*100)+'.png';await live.screenshot({path:path.join(out,file)});actual.push({id:rod.id,p,file,state});
    }
    await live.evaluate(()=>advance(5000));
  }
  report.production={actual,requests};assert.deepEqual(report.errors,[]);await live.close();
  report.ok=true;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,out,rods:rods.length,frames:report.frames.length}));
}finally{await browser.close();}})().catch(error=>{report.failure=error.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(error);process.exitCode=1;});
