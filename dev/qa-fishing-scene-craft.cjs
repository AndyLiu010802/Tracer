'use strict';
// Isolated actual WebGL artwork review, with no account or desktop writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'skins/tracer'),out=fs.mkdtempSync(path.join(root,'.cache/fishing-scene-craft-'));
const ornaments=['water_grass','pebble_garden','pearl_shell','jade_arch','moon_crystal','sunken_chest','glass_observatory','jade_koi_seal','sunken_astrolabe','coral_conch','porcelain_pagoda','ribbon_jellyfish'];
const names=['水草','卵石','珍珠贝','玉拱门','月晶簇','沉船宝箱','星砂玻璃穹','游鲤玉印','沉海星盘','珊瑚螺庭','青瓷小灯塔','琉璃水母铃'];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   let clock=0,rafId=0;const callbacks=new Map();Object.defineProperty(performance,'now',{value:()=>clock});window.requestAnimationFrame=fn=>{callbacks.set(++rafId,fn);return rafId;};window.cancelAnimationFrame=id=>callbacks.delete(id);
   window.advanceScene=ms=>{clock+=ms;const current=[...callbacks];callbacks.clear();for(const [,fn]of current)fn(clock);};
   window.artAudit={resources:{},contexts:[],badCoordinates:0};
   const proto=WebGLRenderingContext.prototype,getContext=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(...args){const gl=getContext.apply(this,args);if(gl&&/webgl/.test(args[0])&&!artAudit.contexts.includes(gl))artAudit.contexts.push(gl);return gl;};
   for(const kind of['Buffer','Texture','Program','Framebuffer','Renderbuffer']){
    const create=proto['create'+kind],remove=proto['delete'+kind],live=new Set();artAudit.resources[kind]=live;
    proto['create'+kind]=function(...args){const value=create.apply(this,args);if(value)live.add(value);return value;};
    proto['delete'+kind]=function(value){live.delete(value);return remove.call(this,value);};
   }
   const bufferData=proto.bufferData;proto.bufferData=function(target,data,usage){if(data instanceof Float32Array)for(const n of data)if(!Number.isFinite(n))artAudit.badCoordinates++;return bufferData.call(this,target,data,usage);};
  });
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.origin!=='http://scene-craft.test')return route.abort();
   if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><style>body{margin:0;background:radial-gradient(ellipse at 35% 10%,#456057,#1d302c);font:18px system-ui;color:#eae5cf}#host{width:1100px;height:780px}#name{position:absolute;top:25px;left:42px;z-index:2;letter-spacing:3px}#icon{position:absolute;right:40px;bottom:35px;width:145px;height:145px}canvas{width:100%;height:100%;display:block}</style><div id="name"></div><div id="host"></div><div id="icon"></div>'+['fishing-model','fishing-lighting','fishing-aquarium-motion','fishing-art','fishing-aquarium'].map(f=>'<script src="/'+f+'.js"></script>').join('')});
   const file=path.resolve(assets,'.'+url.pathname);if(!file.startsWith(assets+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});return route.fulfill({path:file});
  });
  await page.goto('http://scene-craft.test');
  const report={ornaments:[],ponds:[],checks:[]};
  for(let index=0;index<ornaments.length;index++){
   const id=ornaments[index];
   const audit=await page.evaluate(({id,title})=>{
    window.player?.destroy();document.querySelector('#name').textContent=title;document.querySelector('#icon').innerHTML=TracerFishingAquariumArt.decorationMarkup(id);
    window.player=TracerFishingArt.createAquarium(document.querySelector('#host'),{fish:[],aquariumDecorations:[id],reducedMotion:true});
    return {kind:player?.kind,selected:document.querySelector('#host').dataset.aquariumDecorations,shadows:document.querySelector('#host').dataset.shadows,resources:Object.fromEntries(Object.entries(artAudit.resources).map(([k,v])=>[k,v.size])),badCoordinates:artAudit.badCoordinates,glError:artAudit.contexts.at(-1).getError(),svg:!!document.querySelector('#icon svg'),pathErrors:[...document.querySelectorAll('#icon path')].filter(p=>!p.getTotalLength()).length};
   },{id,title:names[index]});
   assert.equal(audit.kind,'webgl');assert.equal(audit.selected,id);assert.equal(audit.shadows,'pcf');assert.equal(audit.badCoordinates,0);assert.equal(audit.glError,0);assert.equal(audit.svg,true);assert.equal(audit.pathErrors,0);
   const file=path.join(out,id+'.png');await page.screenshot({path:file});report.ornaments.push({id,...audit,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
  }
  // Animation never grows GPU allocations, and reduced motion freezes all details.
  const motion=await page.evaluate(()=>{
   player.update({aquariumDecorations:['sunken_astrolabe','ribbon_jellyfish','water_grass'],reducedMotion:false});
   const before=Object.fromEntries(Object.entries(artAudit.resources).map(([k,v])=>[k,v.size]));for(let i=0;i<120;i++)advanceScene(34);
   const after=Object.fromEntries(Object.entries(artAudit.resources).map(([k,v])=>[k,v.size]));player.update({reducedMotion:true});
   const frozen=document.querySelector('canvas').toDataURL();advanceScene(1000);return{before,after,frozen:frozen===document.querySelector('canvas').toDataURL(),errors:artAudit.contexts.at(-1).getError()};
  });assert.deepEqual(motion.before,motion.after);assert.equal(motion.frozen,true);assert.equal(motion.errors,0);report.checks.push({motion});
  for(const style of['meadow','lily','coral','crystal','moon','cloud']){
   await page.evaluate(style=>{player.destroy();document.querySelector('#name').textContent=style;document.querySelector('#icon').innerHTML='';const workspace={};TracerFishingModel.read(workspace);const p=TracerFishingModel.read(workspace).ponds[0];TracerFishingModel.selectPondStyle(workspace,p.id,style);player=TracerFishingArt.createPond(document.querySelector('#host'),{pond:TracerFishingModel.read(workspace).ponds[0],fish:[],interactive:true,zoom:1.12});},style);
   for(const [angle,dx]of[['front',0],['quarter',140],['back',250]]){
    if(dx){await page.mouse.move(400,400);await page.mouse.down();await page.mouse.move(400+dx,400);await page.mouse.up();await page.evaluate(()=>advanceScene(34));}
    await page.screenshot({path:path.join(out,style+'-'+angle+'.png')});
   }
   const audit=await page.evaluate(()=>({badCoordinates:artAudit.badCoordinates,glError:artAudit.contexts.at(-1).getError(),shadows:document.querySelector('#host').dataset.shadows}));assert.equal(audit.badCoordinates,0);assert.equal(audit.glError,0);assert.equal(audit.shadows,'pcf');report.ponds.push({style,...audit});
  }
  const cleanup=await page.evaluate(()=>{player.destroy();return Object.fromEntries(Object.entries(artAudit.resources).map(([k,v])=>[k,v.size]));});assert(Object.values(cleanup).every(n=>n===0));assert.deepEqual(errors,[]);report.checks.push({cleanup,errors});
  // Review sheet is assembled from the actual renders, not substitute art.
  const sheets=await browser.newPage({viewport:{width:1440,height:1630}});await sheets.setContent('<style>body{margin:0;background:#1d302c;display:grid;grid-template-columns:repeat(3,480px);gap:0}img{width:480px;height:407px;object-fit:cover}</style>'+ornaments.map(id=>'<img src="data:image/png;base64,'+fs.readFileSync(path.join(out,id+'.png')).toString('base64')+'">').join(''));await sheets.screenshot({path:path.join(out,'ornaments-review.png'),fullPage:true});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,ornaments:report.ornaments.length,ponds:report.ponds.length,checks:report.checks}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
