'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../skins/tracer/fishing-vfx-inbetweens'),Tween=require('../skins/tracer/fishing-vfx-tween');
function disk(n,cx,cy,r,color=[1,.4,.1]){const a=new Float32Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const alpha=Math.max(0,Math.min(1,r+.5-Math.hypot(x-cx,y-cy))),i=(y*n+x)*4;for(let k=0;k<3;k++)a[i+k]=color[k]*alpha;a[i+3]=alpha;}return a;}
test('inbetween contours travel with the subject instead of dissolving two stationary silhouettes',()=>{
  const n=48,a=disk(n,13,24,6),b=disk(n,33,24,6),forward=M.flow(a,b,n),backward=M.flow(b,a,n);
  const mid=M.morph(a,b,n,.5,forward,backward),center=M.moments(mid,n);
  assert(Math.abs(center.x-23)<1.1);assert(Math.abs(center.y-24)<.5);assert(center.mass>M.moments(a,n).mass*.88);
  assert(mid[(24*n+23)*4+3]>.95,'one solid middle silhouette');
  assert(mid[(24*n+13)*4+3]<.15,'no stationary source ghost');assert(mid[(24*n+33)*4+3]<.15,'no stationary target ghost');
  let last=12;for(let t=0;t<=1;t+=.1){const frame=M.morph(a,b,n,t,forward,backward),x=M.moments(frame,n).x;assert(x>last);last=x;for(let i=0;i<frame.length;i++)assert(Number.isFinite(frame[i]));}
  assert.deepEqual(M.morph(a,b,n,0,forward,backward),a);assert.deepEqual(M.morph(a,b,n,1,forward,backward),b);
});
test('baked atlas preserves endpoints, transparency and full brightness through 31 poses',()=>{
  const n=32,width=n*3,height=n*2,data=new Uint8ClampedArray(width*height*4);
  for(let f=0;f<6;f++){const a=disk(n,8+f*3,16,4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,j=((Math.floor(f/3)*n+y)*width+f%3*n+x)*4;data[j]=255;data[j+1]=102;data[j+2]=26;data[j+3]=a[i+3]*255;}}
  const result=M.bake({data,width,height,size:n});assert.equal(result.count,31);assert.equal(result.steps,6);
  for(let f=0;f<31;f++){
    const x=8+f*.5,j=((Math.floor(f/8)*n+16)*result.width+f%8*n+Math.round(x))*4;
    assert(result.data[j+3]>230,'solid center at '+f);assert(result.data[j]>245,'no black fringe at '+f);
    const edge=(Math.floor(f/8)*n*result.width+f%8*n)*4;assert.equal(result.data[edge+3],0);
  }
  assert.throws(()=>M.bake({data,width:width-1,height}));
});
test('empty and appearing shapes have finite deformation with no opaque border',()=>{
  const n=32,a=new Float32Array(n*n*4),b=disk(n,16,16,6),f=M.flow(a,b,n),r=M.flow(b,a,n),mid=M.morph(a,b,n,.5,f,r);
  assert([...f.field,...r.field,...mid].every(Number.isFinite));assert.equal(mid[3],0);assert(M.moments(mid,n).mass>0);
});
test('background cache is bounded and gracefully falls back without worker support',async()=>{
  assert.equal(await Tween.prepare({defaultView:{}},{}),null);
  const pending=[];class Worker{postMessage(message){pending.push([this,message]);}terminate(){}}
  const ctx={getImageData:()=>({data:new Uint8ClampedArray(24)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};
  const doc={defaultView:{Worker,addEventListener(){}},createElement:()=>({width:3,height:2,getContext:()=>ctx})};
  const sources=Array.from({length:12},()=>doc.createElement('canvas')),promises=sources.map(s=>Tween.prepare(doc,s));
  assert.equal(pending.length,1,'only one computation is dispatched at a time');assert.equal(Tween.stats(doc).pending,8,'evicted requests are removed before computation');
  for(const [worker,msg]of pending)worker.onmessage({data:{id:msg.id,data:new Uint8ClampedArray(24),width:3,height:2,size:1,count:6,steps:1,columns:3}});
  const result=await Promise.all(promises);assert(result.slice(0,4).every(x=>x===null));assert.equal(Tween.stats(doc).ready,8);assert.equal(Tween.stats(doc).pending,0);
});
test('worker failure releases pending loads and keeps the original atlas usable',async()=>{
  let worker;class Worker{constructor(){worker=this;}postMessage(){}terminate(){this.stopped=true;}}
  const ctx={getImageData:()=>({data:new Uint8ClampedArray(24)})},doc={defaultView:{Worker},createElement:()=>({width:3,height:2,getContext:()=>ctx})};
  const pending=Tween.prepare(doc,doc.createElement('canvas'));worker.onerror();assert.equal(await pending,null);assert(worker.stopped);assert(Tween.stats(doc).failed);assert.equal(Tween.stats(doc).pending,0);
});
