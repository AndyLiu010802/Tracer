'use strict';
// Real WebGL renderers with a frozen animation clock. Pixel comparisons ensure
// shadows darken receivers without changing silhouettes or transparency.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'skins/tracer'),out=fs.mkdtempSync(path.join(root,'.cache/fishing-shadows-'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:960,height:700},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};window.shaderErrors=[];for(const key of['getShaderInfoLog','getProgramInfoLog']){const original=WebGLRenderingContext.prototype[key];WebGLRenderingContext.prototype[key]=function(...args){const info=original.apply(this,args);if(info)shaderErrors.push(info);return info;};}});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://shadows.test')return route.abort();if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fishing-scene.css"><style>body{margin:0;background:#b4c9b8}#scene{width:960px;height:690px;position:relative}.fishing-aquarium-canvas{position:absolute;inset:0;width:100%;height:100%}#scene.rod{width:300px;height:500px;margin:80px auto}</style><div id="scene"></div>'+['fishing-model','fishing-lighting','fishing-art','fishing-rod-renderer','fishing-aquarium-motion'].map(f=>'<script src="/'+f+'.js"></script>').join('')});const file=path.resolve(assets,'.'+u.pathname);if(!file.startsWith(assets+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});return route.fulfill({path:file});});
 await page.goto('http://shadows.test');const results=[];
 for(const kind of['pond','aquarium','fish','rod']){
  const result=await page.evaluate(kind=>{
   const host=document.getElementById('scene'),F=TracerFishingModel;host.className=kind==='rod'?'rod':'';
   const fish=['dragonkoi','gulpuffer','flopray'].map(id=>F.catalog.fish.find(f=>f.id===id));
   window.player=kind==='rod'?TracerFishingRodRenderer.create(host,{rod:F.catalog.rods.find(r=>r.id==='golden')}):kind==='aquarium'?TracerFishingArt.createAquarium(host,{fish,aquariumDecorations:['jade_arch','water_grass','pebble_garden']}):kind==='fish'?TracerFishingArt.createFishFigure(host,{fish:fish[0]}):TracerFishingArt.createPond(host,{pond:{style:'meadow'},fish:[F.catalog.fish[8]],zoom:1.2});
   if(player.kind!=='webgl')throw Error(kind+' fell back: '+JSON.stringify(shaderErrors));if(host.dataset.shadows!=='pcf')throw Error('Shadow map missing');
   const canvas=host.querySelector('canvas'),gl=canvas.getContext('webgl'),pixels=()=>{const a=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
   player.update({shadows:false});const before=pixels();player.update({shadows:true});const after=pixels();let darkened=0,alphaChanged=0,delta=0;
   for(let i=0;i<after.length;i+=4){if(before[i+3]!==after[i+3])alphaChanged++;const d=before[i]+before[i+1]+before[i+2]-after[i]-after[i+1]-after[i+2];if(d>12&&after[i+3]>100)darkened++;delta+=Math.max(0,d);}
   return{kind,darkened,alphaChanged,delta,glError:gl.getError(),shaderErrors:[...shaderErrors],width:canvas.width,height:canvas.height};
  },kind);
  assert(result.darkened>(kind==='rod'?80:200),kind+' has visible geometry shadows: '+JSON.stringify(result));assert.equal(result.alphaChanged,0,kind+' retains alpha');assert.equal(result.glError,0);assert.deepEqual(result.shaderErrors,[]);results.push(result);
  await page.screenshot({path:path.join(out,kind+'-shadows.png')});await page.evaluate(()=>player.destroy());assert.equal(await page.locator('canvas').count(),0);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({out,results},null,2));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
