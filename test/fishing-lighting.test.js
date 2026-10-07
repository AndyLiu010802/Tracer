'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Lighting=require('../skins/tracer/fishing-lighting');
const project=(m,p)=>[0,1,2].map(row=>m[12+row]+p.reduce((sum,x,i)=>sum+x*m[i*4+row],0));
test('an occluder on a light ray covers its receiver and has a nearer shadow depth',()=>{
 for(const options of[{}, {extent:3.7,distance:10,far:22}, {extent:2.3,distance:7,far:15}, {center:[125.4,209,0],direction:[-.52,-.68,.78],extent:255,distance:600,far:1300}]){
  const matrix=Lighting.lightView(options),center=options.center||[0,0,0],direction=options.direction||[-.62,1,-.68],a=project(matrix,center),b=project(matrix,center.map((v,i)=>v+direction[i]));
  assert([...matrix].every(Number.isFinite));assert(Math.abs(a[0]-b[0])<.00001);assert(Math.abs(a[1]-b[1])<.00001);assert(b[2]<a[2]);assert(a.every(v=>Math.abs(v)<1));
 }
});
function mock(complete=true){const released=[],calls=[],gl={};let serial=0;for(const key of['FRAMEBUFFER','FRAMEBUFFER_COMPLETE','TEXTURE_2D','TEXTURE0','TEXTURE1','RGBA','UNSIGNED_BYTE','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','TEXTURE_WRAP_S','TEXTURE_WRAP_T','NEAREST','CLAMP_TO_EDGE','RENDERBUFFER','DEPTH_COMPONENT16','COLOR_ATTACHMENT0','DEPTH_ATTACHMENT','MAX_TEXTURE_SIZE','BLEND','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','POLYGON_OFFSET_FILL'])gl[key]=++serial;
 for(const kind of['Framebuffer','Texture','Renderbuffer']){gl['create'+kind]=()=>({kind,id:++serial});gl['delete'+kind]=value=>released.push(value);}
 for(const key of['activeTexture','bindTexture','texImage2D','texParameteri','bindRenderbuffer','renderbufferStorage','bindFramebuffer','framebufferTexture2D','framebufferRenderbuffer','uniform1i','uniform1f','uniformMatrix4fv','viewport','disable','enable','polygonOffset','depthMask','clearColor','clear'])gl[key]=(...args)=>calls.push([key,...args]);
 gl.getParameter=()=>2048;gl.getUniformLocation=(_,name)=>name;gl.checkFramebufferStatus=()=>complete?gl.FRAMEBUFFER_COMPLETE:0;return{gl,released,calls};}
test('shadow passes restore the drawing surface and release every GPU allocation once',()=>{
 const {gl,released,calls}=mock(),map=Lighting.createShadowMap(gl,{});assert(map);map.begin();map.end(304,208);assert(calls.some(c=>c[0]==='viewport'&&c[3]===304&&c[4]===208));assert(calls.some(c=>c[0]==='uniform1f'&&c[1]==='uShadowPass'&&c[2]===0));map.destroy();map.destroy();assert.equal(released.length,4);assert.equal(new Set(released).size,4);
 const failed=mock(false);assert.equal(Lighting.createShadowMap(failed.gl,{}),null);assert.equal(failed.released.length,3);assert(failed.calls.some(c=>c[0]==='bindFramebuffer'&&c[2]===null));
});
test('all production surfaces load lighting before model renderers',()=>{
 for(const file of['index.html','fishing-desktop.html','fishing-aquarium-desktop.html']){const html=fs.readFileSync(path.join(__dirname,'../skins/tracer',file),'utf8'),lighting=html.indexOf('src="/fishing-lighting.js"'),art=html.indexOf('src="/fishing-art.js"');assert(lighting>0&&lighting<art,file);}
});
