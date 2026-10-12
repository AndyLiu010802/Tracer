'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),W=require('../skins/tracer/postcard-world-layout');
test('asymmetric transparent margins do not shift the visible world away from the illustration panel centre',()=>{
 const pixels=new Uint8ClampedArray(100*100*4);for(let y=31;y<91;y++)for(let x=18;x<74;x++)pixels[(y*100+x)*4+3]=255;
 pixels[3]=20;const bounds=W.alphaBounds(pixels,100,100);assert.deepEqual(bounds,{x:18,y:31,width:56,height:60});
 const box={width:100,height:100,bounds},r=W.fittedRect(W.defaults,box),scale=r.width/100;
 assert.equal(r.x+(bounds.x+bounds.width/2)*scale,624);assert.equal(r.y+(bounds.y+bounds.height/2)*scale,800);
 const preview=W.fittedRect(W.defaults,box,720,480);assert(Math.abs(preview.x/r.x-.3)<1e-10);assert(Math.abs(preview.y/r.y-.3)<1e-10);
 const storage={getItem:()=>JSON.stringify({x:27,y:57,size:46})};assert.deepEqual(W.read(storage,'guest','world'),W.defaults);
 const centred=W.forStyle(null,{x:29.5,y:49});assert.deepEqual(centred,{x:29.5,y:49,size:46});
 assert.deepEqual(W.forStyle({x:31,y:45,size:60},{x:29.5,y:49}),{x:34.5,y:44,size:60});
});
test('world layouts clamp drag and size inputs while keeping safe defaults for corrupt preferences',()=>{
 assert.deepEqual(W.normalize({x:-80,y:200,size:100}),{x:5,y:95,size:72});
 assert.deepEqual(W.normalize({x:NaN,y:'20',size:null}),W.defaults);
 const storage={getItem:()=>'{broken'};assert.deepEqual(W.read(storage,'guest','world'),W.defaults);
 assert.equal(W.save({setItem(){throw Error('storage denied');}},'guest','world',{}),false);
});
test('world layouts persist per account and planet and use the same normalized export coordinates',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},layout={x:38,y:52,size:61};
 assert.equal(W.save(storage,'alice','one',layout),true);assert.deepEqual(W.read(storage,'alice','one'),layout);
 assert.deepEqual(W.read(storage,'bob','one'),W.defaults);assert.deepEqual(W.read(storage,'alice','two'),W.defaults);
 const preview=W.rect(layout,1200,800),exported=W.rect(layout);for(const key of ['x','y','size'])assert.equal(preview[key]*2,exported[key]);
});
