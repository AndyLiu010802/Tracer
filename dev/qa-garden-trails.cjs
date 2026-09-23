'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),output=fs.mkdtempSync(path.join(root,'.cache/shiny-trails-'));
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1260,height:1030},deviceScaleFactor:1,recordVideo:{dir:output,size:{width:1260,height:1030}}});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.setContent('<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:34px;background:#0c141b;color:#e9eeed;font:14px "Segoe UI","Microsoft YaHei",sans-serif}header{margin-bottom:25px}header small{color:#a9c2bf;letter-spacing:3px;font-size:10px}h1{font-weight:500;margin:12px 0 8px;font-size:29px}header p{color:#91a5b1;margin:0;font-size:12px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}article{border:1px solid #a2c0bf24;background:linear-gradient(145deg,#14212b,#0e171f);border-radius:15px;padding:18px;height:264px;overflow:hidden}article small{font-size:10px;color:var(--accent);letter-spacing:1px}h2{font-size:17px;margin:7px 0 0;font-weight:500}canvas{display:block;width:100%;height:auto;aspect-ratio:340/128;margin:5px 0}article p{margin:0;color:#a9b8c2;font-size:11px;line-height:1.8}</style><header><small>TRACER / SHINY COMPANIONS</small><h1>九位伙伴，九种留下的光</h1><p>实际拖尾绘制引擎截帧 · 花园系 6 款 / 赛博系 3 款 · 每位异色伙伴独立开关</p></header><main></main>');
    await page.addScriptTag({path:path.join(root,'skins/tracer/garden-trails.js')});
    const checks=await page.evaluate(()=>{
      const names=['花团','小葵','绒绒','苹宝','桃桃','樱丸','霓霓','莓光','晶芽'],rows=[];window.trailPlayers=[];
      for(const [i,item]of TracerGardenTrails.catalog.entries()){
        const card=document.createElement('article');card.dataset.kind=item.id;card.style.setProperty('--accent',item.colors[0]);
        card.innerHTML='<small>'+String(i+1).padStart(2,'0')+' / '+names[i]+'</small><h2>'+item.name[0]+'</h2><canvas></canvas><p>'+item.description[0]+'</p>';document.querySelector('main').append(card);
        const canvas=card.querySelector('canvas'),player=TracerGardenTrails.create(canvas,{kind:item.id,animate:false});player.resize(340,128,1);trailPlayers.push(player);
        for(let j=0;j<=30;j++){const t=j/30;player.point({x:25+t*285,y:66-Math.sin(t*Math.PI*1.6)*26},j*16);}player.draw(490);
        const pixels=canvas.getContext('2d').getImageData(0,0,340,128).data;let lit=0;for(let n=3;n<pixels.length;n+=4)if(pixels[n]>30)lit++;
        rows.push({id:item.id,lit,image:canvas.toDataURL(),stats:player.stats()});
      }return rows;
    });
    assert.equal(new Set(checks.map(row=>row.image)).size,9);assert.ok(checks.every(row=>row.lit>450&&row.stats.particles<=120&&!row.stats.running));
    await page.screenshot({path:path.join(root,'docs/shiny-companion-trails.png')});
    for(const row of checks)await page.locator('[data-kind="'+row.id+'"]').screenshot({path:path.join(output,row.id+'.png')});
    const cleanup=await page.evaluate(()=>trailPlayers.map(player=>{player.draw(2500);return player.stats();}));assert.ok(cleanup.every(row=>row.particles===0&&row.knots===0));
    const lifecycle=await page.evaluate(async()=>{
      const canvas=document.createElement('canvas'),player=TracerGardenTrails.create(canvas,{kind:'cherry'});player.resize(600,300,1);
      player.point({x:20,y:100});for(let i=1;i<=80;i++)player.point({x:20+i*6,y:100});
      const moving=player.stats();player.setKind('volt_berry');const switched=player.stats();
      player.point({x:20,y:100});player.point({x:220,y:100});
      await new Promise(resolve=>setTimeout(resolve,1450));const drained=player.stats();
      const pixels=canvas.getContext('2d').getImageData(0,0,600,300).data;let lit=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])lit++;
      player.point({x:320,y:100});player.resize(300,150,1);const resized=player.stats();player.destroy();
      return {moving,switched,drained,resized,lit};
    });
    assert.equal(lifecycle.moving.running,true);assert.ok(lifecycle.moving.particles<=120&&lifecycle.moving.knots<=32);
    for(const state of [lifecycle.switched,lifecycle.drained,lifecycle.resized])assert.ok(state.particles===0&&state.knots===0&&!state.running);
    assert.equal(lifecycle.lit,0,'expired animation clears every pixel and stops scheduling frames');
    // A bounded moving preview uses the same positions, lifetime, glyphs and drawing
    // code as the desktop; it is not a separately animated concept mockup.
    await page.evaluate(()=>{
      let frame=0;window.previewTimer=setInterval(()=>{
        const t=(frame%100)/99;
        for(const player of trailPlayers){if(frame%100===0)player.clear();player.point({x:25+t*285,y:66-Math.sin(t*Math.PI*1.6)*26});player.draw();}
        frame++;
      },33);
    });
    await page.waitForTimeout(6500);await page.evaluate(()=>{clearInterval(previewTimer);trailPlayers.forEach(player=>player.destroy());});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(checks.map(({image,...row})=>row),null,2));
    console.log('PASS nine distinct rendered trails, bounded particle count, static previews, theme/resize reset and idle animation cleanup. '+output);
    await page.close();const video=await page.video().path();fs.copyFileSync(video,path.join(root,'docs/shiny-companion-trails.webm'));
  }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
