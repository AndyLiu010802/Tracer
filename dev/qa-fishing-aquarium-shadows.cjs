'use strict';
// Actual desktop/WebGL pipeline in isolated fixtures; no saved account is read.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'skins/tracer'),out=fs.mkdtempSync(path.join(root,'.cache/fishing-aquarium-shadows-'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:210,height:170},deviceScaleFactor:2,reducedMotion:'reduce'}),errors=[];
  await context.route('**/*',route=>{
   const url=new URL(route.request().url()),file=path.resolve(assets,'.'+url.pathname);
   if(url.origin!=='http://aquarium-shadow.test'||!file.startsWith(assets+path.sep)||!fs.existsSync(file))return route.abort();
   return route.fulfill({path:file});
  });
  await context.addInitScript(()=>{
   let clock=0,rafId=0;const callbacks=new Map(),snapshots=new Set();Object.defineProperty(performance,'now',{value:()=>clock});window.requestAnimationFrame=fn=>{callbacks.set(++rafId,fn);return rafId;};window.cancelAnimationFrame=id=>callbacks.delete(id);
   window.advanceAquarium=ms=>{clock+=ms;const entries=[...callbacks];callbacks.clear();for(const [,fn]of entries)fn(clock);};
   window.shadowAudit={messages:[],resources:{},contexts:[],uniforms:{},hideFishShadows:false,onlySand:false};
   window.FishingAquariumDesktop={send:value=>shadowAudit.messages.push(value),onSnapshot:fn=>(snapshots.add(fn),()=>snapshots.delete(fn)),onMenuAction:()=>()=>{},onVisibility:fn=>(window.setAquariumVisibility=fn,()=>{})};
   window.sendAquariumSnapshot=value=>{for(const fn of snapshots)fn(value);};
   const proto=WebGLRenderingContext.prototype,names=new WeakMap(),getLocation=proto.getUniformLocation,uniform1f=proto.uniform1f,draw=proto.drawArrays,getContext=HTMLCanvasElement.prototype.getContext;
   const compile=proto.compileShader;proto.compileShader=function(shader){compile.call(this,shader);if(!this.getShaderParameter(shader,this.COMPILE_STATUS))console.error(this.getShaderInfoLog(shader));};
   proto.getUniformLocation=function(program,name){const location=getLocation.call(this,program,name);if(location)names.set(location,name);return location;};
   proto.uniform1f=function(location,value){const name=location&&names.get(location);if(name)shadowAudit.uniforms[name]=value;return uniform1f.call(this,location,value);};
   proto.drawArrays=function(...args){const u=shadowAudit.uniforms;if(shadowAudit.hideFishShadows&&u.uShadowPass===1&&u.uSpecies>=0)return;if(shadowAudit.onlySand&&u.uShadowPass!==1&&u.uMaterial!==27)return;return draw.apply(this,args);};
   HTMLCanvasElement.prototype.getContext=function(...args){const gl=getContext.apply(this,args);if(gl&&/webgl/.test(args[0])&&!shadowAudit.contexts.includes(gl))shadowAudit.contexts.push(gl);return gl;};
   for(const kind of['Buffer','Texture','Program','Framebuffer','Renderbuffer']){const create=proto['create'+kind],remove=proto['delete'+kind],live=new Set();shadowAudit.resources[kind]=live;proto['create'+kind]=function(...args){const value=create.apply(this,args);if(value)live.add(value);return value;};proto['delete'+kind]=function(value){live.delete(value);return remove.call(this,value);};}
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'){errors.push(message.text());console.error(message.text());}});
  await page.goto('http://aquarium-shadow.test/fishing-aquarium-desktop.html');
  await page.evaluate(()=>{
   const fish=['gulpuffer','grumpangler','flopray'].map(id=>({...TracerFishingModel.catalog.fish.find(f=>f.id===id),id:'shadow-'+id,speciesId:id,fishId:id,growth:100}));
   window.aquariumFixture={accountScope:'isolated-shadow-review',accountGeneration:1,accountRestoreId:'shadow-review',nativeSessionId:'shadow-review',desktopVisible:true,language:'zh',showcase:{fish,selection:{decorationIds:['sunken_astrolabe','jade_arch','coral_conch']}}};
   sendAquariumSnapshot(aquariumFixture);
  });
  await page.waitForSelector('.fishing-aquarium-volume[data-shadows="pcf"]');
  const report={layouts:[],checks:[]};
  for(const [name,width,height]of[['desktop-half',210,170],['desktop-enlarged',630,510]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>window.dispatchEvent(new Event('resize')));await page.waitForTimeout(120);
   for(const [surface,color]of[['light','#e8e1d5'],['dark','#182728'],['transparent','transparent']]){
    await page.evaluate(color=>{document.body.style.background=color;window.dispatchEvent(new Event('resize'));},color);await page.waitForTimeout(70);
    await page.screenshot({path:path.join(out,name+'-'+surface+'.png'),omitBackground:true});
   }
   const audit=await page.evaluate(()=>{
    window.dispatchEvent(new Event('resize'));
    const canvas=document.querySelector('canvas'),gl=shadowAudit.contexts.at(-1),hits=[...document.querySelectorAll('.fishing-aquarium-tank,.fishing-aquarium-base')].map(e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};});
    const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let edgeAlpha=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(x<2||y<2||x>=canvas.width-2||y>=canvas.height-2)edgeAlpha=Math.max(edgeAlpha,pixels[(y*canvas.width+x)*4+3]);
    return{shadows:document.querySelector('.fishing-aquarium-volume').dataset.shadows,canvas:[canvas.width,canvas.height],hits,regions:shadowAudit.messages.filter(m=>m.type==='input-regions').at(-1)?.value,edgeAlpha,glError:gl.getError(),filter:getComputedStyle(document.querySelector('.fishing-aquarium-scene')).filter};
   });assert.equal(audit.shadows,'pcf');assert.equal(audit.glError,0);assert.equal(audit.filter,'none');assert.equal(audit.hits.length,2);assert.equal(audit.regions.length,2);assert(audit.edgeAlpha<=1,'Native desktop keeps transparent padding around the soft shadow: '+JSON.stringify({name,...audit}));assert(audit.canvas[0]>=width*1.6,'Desktop zoom resamples the rendering buffer even with reduced motion');report.layouts.push({name,width,height,...audit});
  }
  // Wide presentation uses the very same shared renderer and material code.
  await page.setViewportSize({width:1100,height:700});
  await page.evaluate(()=>{
   setAquariumVisibility({visible:false});document.body.innerHTML='<style>#wide canvas{display:block;width:100%;height:100%}</style><div id="wide" style="position:absolute;inset:0"></div>';document.body.style.background='#e8e1d5';
   window.renderer=TracerFishingArt.createAquarium(document.querySelector('#wide'),{fish:[aquariumFixture.showcase.fish[0]],aquariumDecorations:['water_grass','jade_arch','sunken_astrolabe'],reducedMotion:true});
   window.renderShadowFrame=()=>{renderer.update({});const gl=shadowAudit.contexts.at(-1),canvas=document.querySelector('canvas'),pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return{pixels,width:canvas.width,height:canvas.height};};
  });
  await page.screenshot({path:path.join(out,'wide-light.png')});
  await page.evaluate(()=>{document.body.style.background='#182728';renderer.update({});});await page.screenshot({path:path.join(out,'wide-dark.png')});
  await page.evaluate(()=>{document.body.style.background='transparent';renderer.update({});});await page.screenshot({path:path.join(out,'wide-transparent.png'),omitBackground:true});
  const edge=await page.evaluate(()=>{
   const {pixels,width,height}=renderShadowFrame();let alpha=0,count=0;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(x<3||y<3||x>=width-3||y>=height-3){alpha=Math.max(alpha,pixels[(y*width+x)*4+3]);count++;}
   return{alpha,count,width,height};
  });assert(edge.alpha<=1,'Desktop drawing has a fully transparent perimeter, so no shadow is cut by a window edge');report.checks.push({edge});
  await page.evaluate(()=>{shadowAudit.onlySand=true;shadowAudit.hideFishShadows=false;shadowAudit.sandWith=renderShadowFrame();});await page.screenshot({path:path.join(out,'sand-fish-shadow.png'),omitBackground:true});
  const liveFishShadow=await page.evaluate(()=>{
   shadowAudit.hideFishShadows=true;const {pixels}=renderShadowFrame(),before=shadowAudit.sandWith.pixels;let changed=0,strong=0,total=0;
   for(let i=0;i<pixels.length;i+=4){const diff=Math.abs(pixels[i]-before[i])+Math.abs(pixels[i+1]-before[i+1])+Math.abs(pixels[i+2]-before[i+2]);if(diff>2)changed++;if(diff>18)strong++;total+=diff;}
   return{changed,strong,total};
  });await page.screenshot({path:path.join(out,'sand-without-fish-shadow.png'),omitBackground:true});assert(liveFishShadow.strong>40,'Animated fish geometry must cast a measurable shadow onto the sand');report.checks.push({liveFishShadow});
  const motion=await page.evaluate(()=>{
   shadowAudit.onlySand=false;shadowAudit.hideFishShadows=false;renderer.update({reducedMotion:false});const before=Object.fromEntries(Object.entries(shadowAudit.resources).map(([k,v])=>[k,v.size]));for(let i=0;i<120;i++)advanceAquarium(34);const after=Object.fromEntries(Object.entries(shadowAudit.resources).map(([k,v])=>[k,v.size]));renderer.update({reducedMotion:true});const frozen=document.querySelector('canvas').toDataURL();advanceAquarium(3000);const stable=frozen===document.querySelector('canvas').toDataURL();renderer.destroy();return{before,after,stable,cleanup:Object.fromEntries(Object.entries(shadowAudit.resources).map(([k,v])=>[k,v.size]))};
  });assert.deepEqual(motion.before,motion.after);assert.equal(motion.stable,true);assert(Object.values(motion.cleanup).every(v=>v===0));assert.deepEqual(errors,[]);report.checks.push({motion,errors});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,passed:true,...report}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
