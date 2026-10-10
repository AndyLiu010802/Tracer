'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const assets=path.resolve(__dirname,'../skins/tracer'),out=path.resolve(__dirname,'../output/fishing-relic-upgrade');
const scripts=['fishing-vfx-tween','fishing-naruto-vfx','fishing-valorant-vfx'];
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://vfx-catalog.test/**',route=>{const p=new URL(route.request().url()).pathname;if(p==='/')return route.fulfill({contentType:'text/html',body:scripts.map(s=>'<script src="/'+s+'.js"></script>').join('')+'<canvas width="380" height="260"></canvas>'});const file=path.resolve(assets,'.'+p);return file.startsWith(assets+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.abort();});
  await page.goto('http://vfx-catalog.test/');const rows=[];
  for(const collection of ['Naruto','Valorant']){
   const ids=await page.evaluate(collection=>Object.keys(window['TracerFishing'+collection+'VFX'].specs),collection);
   for(const id of ids){
    const result=await page.evaluate(async({collection,id})=>{
     const api=window['TracerFishing'+collection+'VFX'],canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});await api.load(document,id);
     const entry=api.get(document,id),g={width:380,height:260,water:{x:245,y:173},grip:{x:60,y:211}},tip={x:83,y:62};if(!entry)throw Error('Missing atlas '+id);
     const samples=[];
     for(const frame of [.75,2.25,3.75,4.8]){ctx.clearRect(0,0,380,260);if(!TracerFishingVFXTween.draw(ctx,entry,frame,100,60,160,160))throw Error('Missing inbetween '+id);const data=ctx.getImageData(0,0,380,260).data;let occupied=0;for(let i=3;i<data.length;i+=4)if(data[i]>10)occupied++;samples.push(occupied);}
     if(!id.startsWith('valorant_spike:'))for(const phase of ['cast','bite','caught']){ctx.clearRect(0,0,380,260);if(!api.draw(ctx,id,phase,api.durations[phase]*.45,{},g,tip,g.water))throw Error('Missing action '+id+' '+phase);}
     return{id,samples,cache:TracerFishingVFXTween.stats(document)};
    },{collection,id});
    assert(result.samples.every(n=>n>15),id+' empty intermediate pose');assert(!result.cache.failed);assert(result.cache.cached<=8);rows.push(result);
   }
   console.log(collection+' passed '+ids.length+' atlases');
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'anime-continuity-catalog-qa.json'),JSON.stringify({passed:true,atlases:rows.length,rows,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
