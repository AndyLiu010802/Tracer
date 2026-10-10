'use strict';
// Compare cached and uncached draw state, retaining the same scene and time.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/fishing-smoothness');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<div id="pond" style="width:640px;height:400px"></div>');
 for(const name of ['fishing-model','fishing-lighting','fishing-aquatic-renderer','fishing-art'])await page.addScriptTag({content:fs.readFileSync(path.join(root,'skins/tracer/'+name+'.js'),'utf8')});
 let uncached=fs.readFileSync(path.join(root,'skins/tracer/fishing-art.js'),'utf8').replaceAll('TracerFishingArt','UncachedFishingArt');
 uncached=uncached.replace('if(boundMesh!==g)','if(true)').replace("if(drawUniforms.get(key)!==value)",'if(true)').replace("if(drawUniforms.get('Color')!==hex)",'if(true)').replace("if(drawUniforms.get('UvRect')!==tileKey)",'if(true)').replace('if(heights.has(key))','if(false)').replace('if(!poses.has(f))','if(true)');
 await page.addScriptTag({content:uncached});
 const report=await page.evaluate(()=>{
  window.requestAnimationFrame=()=>0;const host=document.querySelector('#pond'),F=TracerFishingModel,records=[];
  const fish=['koi','trout','rivercrab','goldfish','minnow'].map((id,i)=>({...F.catalog.fish.find(f=>f.id===id),instanceId:'cache_'+i,growth:70}));
  for(const style of F.catalog.pondStyles){
   const images=[];for(const Art of [UncachedFishingArt,TracerFishingArt]){
    const r=Art.createPond(host,{pond:{style:style.id,decorations:F.defaultPondDecorations(style.id,0)},fish});assertWebGL(r.kind);
    const c=host.querySelector('canvas'),gl=c.getContext('webgl'),pixels=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    if(gl.getError())throw Error('GL error '+style.id);images.push(pixels);r.destroy();
   }
   let max=0,total=0;for(let i=0;i<images[0].length;i++){const delta=Math.abs(images[0][i]-images[1][i]);max=Math.max(max,delta);total+=delta;}
   if(max>1)throw Error('cache changes pixels '+style.id+' '+max);records.push({style:style.id,maxChannelDifference:max,meanDifference:total/images[0].length});
  }
  function assertWebGL(kind){if(kind!=='webgl')throw Error('WebGL unavailable');}
  return records;
 });
 assert.deepEqual(errors,[]);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'render-cache.json'),JSON.stringify({passed:true,report,errors},null,2));console.log(JSON.stringify({passed:true,report}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
