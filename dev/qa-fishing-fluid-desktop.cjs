'use strict';
// Real desktop renderer/CSS, isolated bridge and snapshots; no account data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'skins/tracer'),out=fs.mkdtempSync(path.join(root,'.cache/fishing-fluid-desktop-'));
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];
  try{
    const page=await browser.newPage({viewport:{width:304,height:208},deviceScaleFactor:2});page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.FishingDesktop={send(){},onSnapshot(fn){window.receiveFishing=fn;return()=>{};}};});
    await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://fluid-desktop.test')return route.abort();
      if(u.pathname==='/'){let html=fs.readFileSync(path.join(assets,'fishing-desktop.html'),'utf8').replace('<script src="/fishing-art.js">','<script src="/fishing-model.js"></script><script src="/fishing-art.js">');return route.fulfill({contentType:'text/html',body:html});}
      const p=path.resolve(assets,'.'+u.pathname);if(!p.startsWith(assets+path.sep)||!fs.existsSync(p))return route.fulfill({status:404});return route.fulfill({path:p});
    });
    await page.goto('http://fluid-desktop.test');await page.waitForFunction(()=>window.receiveFishing&&window.TracerFishingModel);
    const ids=await page.evaluate(()=>{window.showRod=(id,phase)=>{const {catalog}=TracerFishingModel,rod=catalog.rods.find(r=>r.id===id),fish=catalog.fish.find(f=>f.id==='dragonkoi');receiveFishing({language:'zh',rod,fish,catalog,session:{id,phase,tension:.65,holding:true,castPower:.85,castDistance:.65,progress:.3,fishPosition:.65,barPosition:.55,barSize:.28,stamina:.8},lastCatch:phase==='caught'?{id:id+'-catch',fish,fishId:fish.id}:null});};return TracerFishingModel.catalog.rods.filter(r=>['epic','legendary'].includes(r.rarity)).map(r=>r.id);});
    for(const id of ids){
      await page.evaluate(id=>showRod(id,'waiting'),id);await page.waitForTimeout(100);
      await page.evaluate(id=>showRod(id,'caught'),id);await page.waitForTimeout(1080);
      const canvas=page.locator('.fishing-flow-canvas');assert.equal(await canvas.getAttribute('data-variant'),id);assert.equal(await canvas.getAttribute('data-event'),'caught');
      assert.equal(await page.locator('.fishing-signature-event,.rod-spirit').count(),0);
      await page.screenshot({path:path.join(out,id+'-304.png')});
      const pixels=await canvas.evaluate(c=>{const ctx=c.getContext('2d'),d=ctx.getImageData(0,0,c.width,c.height).data;let painted=0;for(let i=3;i<d.length;i+=4)if(d[i]>12)painted++;return painted;});assert(pixels>100,id+' continuous light actually paints pixels');
    }
    await page.evaluate(()=>showRod('guandao','reeling'));await page.waitForTimeout(240);await page.screenshot({path:path.join(out,'guandao-reeling-304.png')});
    const gutter=await page.locator('.fishing-flow-canvas').evaluate(c=>{const ctx=c.getContext('2d'),x=Math.ceil(c.width-40*(c.width/380)),d=ctx.getImageData(x,0,c.width-x,c.height).data;return d.some((n,i)=>i%4===3&&n>0);});assert.equal(gutter,false,'light leaves the reel meter gutter clear');
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>showRod('guandao','caught'));await page.waitForTimeout(1070);assert(Number(await page.locator('.fishing-flow-canvas').getAttribute('data-event-alpha'))<=.18);await page.screenshot({path:path.join(out,'guandao-reduced-304.png')});
    await page.waitForTimeout(1000);assert.equal(await page.locator('.fishing-flow-canvas').getAttribute('data-event'),'');
    const drawCosts=await page.evaluate(()=>{
      const result=[];
      for(const [width,height,displayWidth]of [[380,260,304],[760,340,760]])for(const id of ['phoenix','lotus']){
        const host=document.createElement('div');document.body.appendChild(host);const effect=TracerFishingRodEffects.create(host),profile=TracerFishingMotion.fxProfile(TracerFishingModel.catalog.rods.find(r=>r.id===id)),g={width,height,grip:{x:width*.12,y:height*.88}},tip={x:width*.3,y:height*.28},point={x:width*.5,y:height*.78},costs=[];
        for(let i=0;i<85;i++){const start=performance.now();effect.draw(profile,'caught',1040+i,{tension:.7,castPower:.8},g,tip,point,tip,point,false);const elapsed=performance.now()-start;if(i>=15)costs.push(elapsed);}
        costs.sort((a,b)=>a-b);result.push({id,displayWidth,logicalWidth:width,medianMs:costs[35],p95Ms:costs[66],maxMs:costs.at(-1)});effect.destroy();host.remove();
      }
      return result;
    });
    await page.evaluate(()=>window.dispatchEvent(new Event('beforeunload')));assert.equal(await page.locator('.fishing-flow-canvas').count(),0);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,ids,errors,drawCosts,viewport:{width:304,height:208}},null,2));console.log('PASS desktop 304x208 flow, painted pixels, control gutter, reduced motion, cleanup: '+out);console.log(JSON.stringify(drawCosts));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);console.error('Artifacts: '+out);process.exitCode=1;});
