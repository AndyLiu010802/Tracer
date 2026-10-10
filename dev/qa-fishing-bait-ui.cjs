'use strict';
// Isolated browser fixture. Never reads or writes a user's workspace/location.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/fishing-bait-ui-qa');
fs.mkdirSync(out,{recursive:true});
const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'qa_credit',amount:10000,updatedAt:1};
function stock(id,bait,growth,aquarium=false){
  F.buyBait(ws,bait,1);F.equipBait(ws,bait);let seed=0;
  while(F.createSession(F.empty(),{baitId:bait,seed}).fishId!==id)if(++seed>10000)throw Error(id);
  const {session}=F.beginCast(ws,{seed});F.stepSession(session,{},900);F.stepSession(session,{release:true},0);F.commitCast(ws,session);
  for(let i=0;i<4000&&!['caught','escaped'].includes(session.phase);i++)F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);
  const result=F.recordCatch(ws,session);const fry=ws.fishing.fry.find(f=>f.id===result.fry.id);fry.growth=growth;
  if(aquarium)F.placeAquariumFish(ws,fry.id,true);else F.placeFry(ws,fry.id,'pond_starter');return fry.id;
}
const young=stock('koi','grain',40),adult=stock('dreamray','glow',100),legend=stock('dragonkoi','spirit',100,true);
const files=['task-garden','fishing-model','fishing-aquarium-motion','fishing-lighting','fishing-aquatic-renderer','fishing-pond-skins','fishing-species-painted','fishing-species-live','fishing-art','fishing-rewards','fishing-crafted-rods','fishing-expansion-effects','fishing-spell-effects','fishing-journey-effects','fishing-rod-effects','fishing-motion','fishing-rod-renderer','fishing-tackle','fishing-aquarium','fishing-weather','fishing-view'];
const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><title>Fishing QA fixture</title>${['skin','fishing','fishing-scene','fishing-tackle','fishing-aquarium'].map(f=>'<link rel="stylesheet" href="/'+f+'.css">').join('')}<style>body{margin:0;padding:24px;background:#f5f4ed;overflow:auto;height:auto}main{max-width:1250px;margin:auto}#fishing-open{margin:0 0 16px}dialog{max-width:550px;padding:28px;border-radius:18px;border:1px solid #b4c4b7}dialog::backdrop{background:#182a2588}</style><main><button id="fishing-open">钓鱼</button><div id="fishing-ponds-root"></div><div id="fishing-cabin-root" hidden></div></main>${files.map(f=>'<script src="/'+f+'.js"></script>').join('')}<script>
window.TracerLocale={language:()=> 'zh'};
const ws=${JSON.stringify(ws)},callbacks={};let section='ponds';
window.Tracer={store:{data:ws,dirty:false,inflight:false,lost:false,timer:0},sections:['ponds','cabin'],ready:Promise.resolve(ws),currentSec:()=>section,onShow:(key,fn)=>callbacks[key]=fn,touch(){this.store.dirty=true},saveNow(){this.store.dirty=false},garden:{refresh(){}},show(key){section=key;document.getElementById('fishing-ponds-root').hidden=key!=='ponds';document.getElementById('fishing-cabin-root').hidden=key!=='cabin';callbacks[key]?.()},confirmTaskAction(options,confirm){const modal=document.createElement('dialog');modal.innerHTML='<h2></h2><p></p><p class="detail"></p><button data-cancel>取消</button><button data-confirm></button>';modal.querySelector('h2').textContent=options.title;modal.querySelector('p').textContent=options.body;modal.querySelector('.detail').textContent=options.detail;modal.querySelector('[data-confirm]').textContent=options.confirmText;modal.querySelector('[data-cancel]').onclick=()=>modal.remove();modal.querySelector('[data-confirm]').onclick=()=>{modal.remove();confirm()};document.body.append(modal);modal.showModal()}};
</script><script src="/fishing.js"></script></html>`;
let failWeather=false;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  if(url.pathname==='/api/fishing/weather'){
    assert.equal(url.searchParams.get('latitude'),'-42.88');assert.equal(url.searchParams.get('longitude'),'147.33');
    if(failWeather){res.writeHead(503).end('{}');return;}
    const now=Date.now();res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:61,temperature:17.4,isDay:true,observedAt:now,fetchedAt:now,timezone:'Australia/Hobart',sun:[{rise:now-5*3600000,set:now+5*3600000}]}));return;
  }
  const target=path.resolve(root,'skins/tracer','.'+url.pathname);
  if(!target.startsWith(path.join(root,'skins/tracer')+path.sep)||!fs.existsSync(target)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':target.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(target));
});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1400,height:1050},permissions:['geolocation'],geolocation:{latitude:-42.8824,longitude:147.3278}}),page=await context.newPage(),errors=[];
    page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
    await page.locator('[data-weather-status="ready"]').waitFor();
    await page.evaluate(()=>{
      Tracer.show('shop');const host=document.createElement('div');host.id='qa-tackle';host.style.maxWidth='1250px';document.body.append(host);
      window.qaTackle=TracerFishingTackle.create(host,{mode:'shop',onAction:async(type,id)=>{await Tracer.fishing.action(type,id);qaTackle.update(Tracer.fishing.snapshot());}});qaTackle.update(Tracer.fishing.snapshot());
    });
    await page.locator('.fishing-tackle-slot').first().waitFor();assert.equal(await page.locator('.fishing-tackle-slot').count(),5);
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('.fishing-tackle-slot img')).every(i=>i.complete&&i.naturalWidth>1000));
    await page.locator('.fishing-tackle').screenshot({path:path.join(out,'five-baits-shop.png')});
    const before=await page.evaluate(()=>({count:Tracer.fishing.snapshot().state.baits.cutbait,coins:Tracer.fishing.snapshot().economy.balance}));
    await page.locator('.fishing-tackle-slot[data-bait-id="cutbait"]').click();await page.locator('[data-tackle-action="buy-bait"]').click();
    await page.waitForFunction(count=>Tracer.fishing.snapshot().state.baits.cutbait===count+10,before.count);
    assert.equal(await page.evaluate(()=>Tracer.fishing.snapshot().economy.balance),before.coins-30);
    await page.evaluate(()=>Tracer.fishing.action('equip-bait','cutbait'));
    assert.equal(await page.evaluate(()=>Tracer.fishing.snapshot().state.equippedBaitId),'cutbait');
    await page.locator('.fishing-tackle-slot[data-bait-id="cutbait"]').focus();await page.keyboard.press('Home');assert.equal(await page.locator('.fishing-tackle-slot:focus').getAttribute('data-bait-id'),'earthworm');await page.keyboard.press('End');assert.equal(await page.locator('.fishing-tackle-slot:focus').getAttribute('data-bait-id'),'lotusmeal');
    await page.setViewportSize({width:600,height:1000});await page.locator('.fishing-tackle').screenshot({path:path.join(out,'five-baits-narrow.png')});
    const images=await page.locator('.fishing-tackle-slot img').evaluateAll(imgs=>imgs.map(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let empty=0,solid=0;for(let i=3;i<data.length;i+=4){empty+=data[i]===0;solid+=data[i]>240;}return{src:img.getAttribute('src'),empty,solid};}));for(const row of images){assert(row.empty>100000);assert(row.solid>100000);}
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({images,errors},null,2));console.log('Five unified transparent images, purchase, stock, equip, keyboard navigation and narrow layout verified.');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
