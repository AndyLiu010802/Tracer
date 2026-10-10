'use strict';
// Isolated production-renderer fixture. Never reads or changes an account.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'skins/tracer'),out=path.join(root,'output/fishing-live-species');fs.mkdirSync(out,{recursive:true});
const scripts=['fishing-model','fishing-aquarium-motion','fishing-lighting','fishing-aquatic-renderer','fishing-pond-skins','fishing-species-painted','fishing-species-live','fishing-art'];
const html=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fishing.css"><style>body{margin:0;background:#112a26;color:#eee4cd;font:16px system-ui}main{display:flex;gap:16px}section{flex:1;min-width:0}h2{margin:20px;text-align:center;font-size:20px}.scene{height:530px;width:100%}p{text-align:center}</style><main><section><h2>鱼塘 · 新原画游动</h2><div class="scene" id="pond"></div></section><section><h2>水族馆 · 新原画游动</h2><div class="scene" id="aquarium"></div></section></main><p>生产渲染器验证 · 独立测试数据</p>`+scripts.map(s=>`<script src="/${s}.js"></script>`).join('')+`<script>
window.calls={draw:0,frames:0,cpu:[]};const originalDraw=WebGLRenderingContext.prototype.drawArrays;WebGLRenderingContext.prototype.drawArrays=function(...args){calls.draw++;return originalDraw.apply(this,args)};
const originalRaf=requestAnimationFrame;window.requestAnimationFrame=fn=>originalRaf(stamp=>{let at=performance.now();fn(stamp);let ms=performance.now()-at;if(ms>.3){calls.cpu.push(ms);calls.frames++;}});
const F=TracerFishingModel,Art=TracerFishingArt,catalog=F.catalog.fish;
window.resident=(id,i=0)=>({...catalog.find(f=>f.id===id),speciesId:id,id:'resident-'+i,growth:100});
window.players=[];window.mount=()=>{for(const p of players)p.destroy();players=[Art.createPond(document.querySelector('#pond'),{pond:{styleId:'meadow',decorations:[]},fish:['koi','clownfish','rivercrab','carp','guppy'].map(resident)}),Art.createAquarium(document.querySelector('#aquarium'),{fish:['dragonkoi','dreamray','galaxywhale'].map(resident),decorations:['water_grass','pearl_shell','jade_arch']})];};mount();
</script>`;
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:680},deviceScaleFactor:1}),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.route('http://fish-live.test/**',route=>{const u=new URL(route.request().url());if(u.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});const file=path.resolve(assets,'.'+u.pathname);if(file.startsWith(assets+path.sep)&&fs.existsSync(file))return route.fulfill({path:file});missing.push(u.pathname);return route.abort();});
 await page.goto('http://fish-live.test/');await page.waitForFunction(()=>document.querySelector('#pond').dataset.paintedFish==='5'&&document.querySelector('#aquarium').dataset.paintedFish==='3');
 await page.screenshot({path:path.join(out,'pond-aquarium.png')});
 const measure=async()=>{await page.evaluate(()=>{calls={draw:0,frames:0,cpu:[]};});await page.waitForTimeout(2000);return page.evaluate(()=>{const sorted=calls.cpu.sort((a,b)=>a-b);return{drawCallsPerSecond:Math.round(calls.draw/2),sceneFrames:calls.frames,cpuMedian:sorted[Math.floor(sorted.length/2)],cpuP95:sorted[Math.floor(sorted.length*.95)],textureBytes:[...document.querySelectorAll('.scene')].reduce((n,h)=>n+Number(h.dataset.fishTextureBytes||0),0)};});};
 const painted=await measure();
 await page.evaluate(()=>{document.tracerHidden=true;document.dispatchEvent(new Event('tracer-visibilitychange'));});const hiddenStart=await page.evaluate(()=>calls.draw);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>calls.draw),hiddenStart,'hidden native window must stop drawing');
 await page.evaluate(()=>{document.tracerHidden=false;document.dispatchEvent(new Event('tracer-visibilitychange'));});await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>calls.draw)>hiddenStart,'visible scene resumes');
 const checked=[];for(let offset=0;offset<156;offset+=5){await page.evaluate(()=>players[0].update({fish:[]}));await page.waitForFunction(()=>document.querySelector('#pond').dataset.paintedFish==='0');const batch=await page.evaluate(offset=>{const batch=catalog.slice(offset,offset+5).map((f,i)=>resident(f.id,i));players[0].update({fish:batch});return batch.map(f=>f.speciesId);},offset);await page.waitForFunction(count=>document.querySelector('#pond').dataset.paintedFish===String(count),batch.length);await page.waitForTimeout(40);checked.push(...batch);}
 assert.equal(new Set(checked).size,156);
 await page.evaluate(()=>{mount();players[0].feed({at:Date.now(),fishIds:['resident-0','resident-1'],grownFishIds:['resident-0']});});await page.waitForTimeout(800);await page.screenshot({path:path.join(out,'feeding.png')});
 const glErrors=await page.evaluate(()=>[...document.querySelectorAll('canvas')].map(c=>c.getContext('webgl').getError()));assert.ok(glErrors.every(x=>x===0),'WebGL must have no buffer/program/texture errors');
 // Same production scene without the new module is the old articulated-fish
 // path. Reload so all allocations/timers are equivalent and JIT is warmed.
 await page.route('http://fish-live.test/fishing-species-live.js',route=>route.fulfill({body:'',contentType:'text/javascript'}));await page.reload();await page.waitForTimeout(2200);const previous=await measure();await page.screenshot({path:path.join(out,'previous-models.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checked:checked.length,painted,previous,glErrors,hiddenRendering:'stopped and resumed',errors,missing},null,2));console.log(JSON.stringify({checked:checked.length,painted,previous,errors,missing},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
