'use strict';
// Local renderer-only visual review; never opens or modifies a player save.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'skins/tracer'),out=path.join(root,'output/fishing-staff-blade');
fs.mkdirSync(out,{recursive:true});
const scripts=['fishing-model','fishing-lighting','fishing-crafted-rods','fishing-expansion-effects','fishing-spell-effects','fishing-journey-effects','fishing-rod-effects','fishing-motion','fishing-rod-renderer'];
const html='<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:28px;background:#142420;color:#ecdcbc;font:14px system-ui}h1{font-size:23px;font-weight:500;margin:0 0 22px}h2{font-size:17px;font-weight:500;margin:25px 0 14px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{border:1px solid #40544b;background:radial-gradient(ellipse at 45% 30%,#304b43,#192c26 78%);border-radius:12px;overflow:hidden}.card p{margin:14px 16px}.card img{width:100%;display:block}.fixture{position:fixed;left:-6000px;top:0}small{color:#9faf9e}</style><h1>如意定海 · 二郎照雪</h1><div id="models" class="grid"></div><h2>耍棍动作 · 抛竿与收势</h2><div id="motion" class="grid"></div><h2>桌面尺寸 · 出场虚影与降级渲染</h2><div id="spirits" class="grid"></div>'+scripts.map(s=>'<script src="/'+s+'.js"></script>').join('');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://staff-blade.test/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});const file=path.resolve(assets,'.'+url.pathname);return file.startsWith(assets+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.abort();});
  await page.goto('http://staff-blade.test/');
  const report=await page.evaluate(async()=>{
   const R=TracerFishingRodRenderer,E=TracerFishingRodEffects,F=TracerFishingModel,J=TracerFishingJourney,rows=[];
   const card=(id,title,canvas)=>{const el=document.createElement('article');el.className='card';const label=document.createElement('p');label.textContent=title;const img=document.createElement('img');img.src=canvas.toDataURL();el.append(label,img);document.getElementById(id).append(el);};
   const fixture=(w,h)=>{const el=document.createElement('div');el.className='fixture';Object.assign(el.style,{width:w+'px',height:h+'px'});document.body.append(el);return el;};
   const stats=canvas=>{const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let left=c.width,top=c.height,right=0,bottom=0,count=0,hash=2166136261;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(data[i+3]>8){count++;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}hash=Math.imul(hash^data[i]^data[i+1]^data[i+2]^data[i+3],16777619)>>>0;}return {count,hash,bounds:[left,top,right,bottom],width:c.width,height:c.height};};
   const original=HTMLCanvasElement.prototype.getContext;
   for(const fallback of [false,true]){
    if(fallback)HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args);};
    for(const bend of [0,.24,-.24])for(const id of ['ruyi','erlang']){
     const host=fixture(250.8,418),renderer=R.create(host,{rod:{id},bend}),source=host.querySelector('canvas'),st=stats(source),capture=document.createElement('canvas');capture.width=290;capture.height=478;
     const [left,top,right,bottom]=st.bounds,fit=Math.min(256/(right-left),446/(bottom-top));capture.getContext('2d').drawImage(source,left-2,top-2,right-left+4,bottom-top+4,(290-(right-left+4)*fit)/2,12,(right-left+4)*fit,(bottom-top+4)*fit);
     if(!fallback&&bend>=0)card('models',(id==='ruyi'?'如意定海':'二郎照雪')+(bend?' · 满弓受力':' · 实体鱼竿'),capture);
     rows.push({kind:'rod',id,bend,fallback,renderer:renderer.kind,...st});renderer.destroy();host.remove();
    }
    const g={width:380,height:260,grip:{x:82,y:232},tip:{x:140,y:32},water:{x:272,y:193},curve:u=>({x:82+58*u+Math.sin(u*Math.PI)*5,y:232-200*u})};
    for(const id of ['ruyi','erlang']){
     const rod=F.catalog.rods.find(r=>r.id===id),host=fixture(380,260),summon=E.createSummon(host),flow=E.create(host);await summon.preload(rod).decode();
     for(const p of [.18,.30,.43,.57,.7,.85]){summon.draw(rod,E.summonState(rod,E.summonScene(id).duration*p),g);const canvas=host.querySelector('.fishing-summon-canvas');rows.push({kind:'summon',id,p,fallback,renderer:canvas.dataset.spiritRenderer,...stats(canvas)});if(p===.43)card('spirits',(id==='ruyi'?'如意定海':'二郎照雪')+(fallback?' · Canvas':' · WebGL'),canvas);}
     for(const phase of ['cast','bite','reeling','caught'])for(const p of [.1,.3,.5,.7,.88]){
      const start=phase==='caught'?680:phase==='cast'?30:0,duration=phase==='caught'?1260:phase==='cast'?640:phase==='bite'?560:id==='ruyi'?1280:760;
      flow.draw({variant:id,energy:1},phase,start+p*duration,{castPower:.8,tension:.6},g,g.tip,g.water,{x:180,y:38},{x:241,y:105},false);
      const canvas=host.querySelector('.fishing-flow-canvas');rows.push({kind:'action',id,phase,p,fallback,...stats(canvas)});
      if(id==='ruyi'&&!fallback&&['cast','caught'].includes(phase)&&p>.1)card('motion',(phase==='cast'?'抛竿':'收魚')+' · '+Math.round(p*100)+'%',canvas);
     }
     flow.draw({variant:id,energy:1},'cast',300,{},g,g.tip,g.water,g.tip,g.water,true);rows.push({kind:'quiet',id,fallback,...stats(host.querySelector('.fishing-flow-canvas'))});
     summon.destroy();flow.destroy();host.remove();
    }
    HTMLCanvasElement.prototype.getContext=original;
   }
   return {rows,remaining:document.querySelectorAll('.fixture,canvas').length};
  });
  for(const r of report.rows){assert(r.kind==='action'&&r.phase==='reeling'?r.count===0:r.count>10,JSON.stringify(r));if(r.kind==='rod'||r.kind==='summon'){const [l,t,rr,b]=r.bounds;assert(l>1&&t>1&&rr<r.width-2&&b<r.height-2,'clipped '+JSON.stringify(r));assert.equal(r.renderer,r.fallback?(r.kind==='rod'?'canvas2d':'canvas'):'webgl');}}
  assert.equal(report.remaining,0);assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(out,'review.png'),fullPage:true});
  await page.locator('#models').screenshot({path:path.join(out,'rods.png')});
  await page.goto(require('node:url').pathToFileURL(path.join(out,'motion.html')).href);
  await page.waitForTimeout(250);
  const before=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(220);
  assert.notEqual(await page.locator('canvas').evaluate(c=>c.toDataURL()),before,'preview animates');
  await page.getByRole('button',{name:'暂停'}).click();const paused=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(120);
  assert.equal(await page.locator('canvas').evaluate(c=>c.toDataURL()),paused,'preview pause works');
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();assert.equal(await page.locator('button').textContent(),'播放');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,...report,errors},null,2));
  console.log(JSON.stringify({passed:true,frames:report.rows.length,out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
