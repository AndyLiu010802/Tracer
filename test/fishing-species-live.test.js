'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Live=require('../skins/tracer/fishing-species-live'),Painted=require('../skins/tracer/fishing-species-painted'),F=require('../public/fishing-model');
test('live painted residents resolve all 156 species from saved-instance IDs',()=>{
  for(const fish of F.catalog.fish){const portrait=Live.portrait({...fish,id:'saved-fry',fishId:fish.id},Painted.assets);assert.equal(portrait.id,fish.id);assert.equal(portrait.bounds[2]-portrait.bounds[0],384);}
  assert.equal(Live.portrait({id:'junk'},Painted.assets),null);
  assert.equal(Live.profile({id:'rivercrab'}),4);assert.equal(Live.profile({id:'dreamray'}),1);assert.equal(Live.profile({id:'glassoctopus'}),3);
});
function fixture(){
  let serial=0;const events=[],pending=[],bitmaps=[];
  const gl=new Proxy({}, {get:(_,key)=>{
    if(key.startsWith('create'))return()=>({id:++serial});
    if(key==='getShaderParameter'||key==='getProgramParameter')return()=>true;
    if(key==='getAttribLocation')return()=>0;if(key==='getUniformLocation')return()=>({});
    if(key.toUpperCase()===key)return key;
    return(...args)=>events.push([key,...args]);
  }});
  const doc={createElement(){return{getContext(){return{drawImage(){},getImageData(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4).fill(255)};}};}};},defaultView:{Image:class{set src(value){this.url=value;pending.push(this);}},async createImageBitmap(){const bitmap={closed:false,close(){this.closed=true;}};bitmaps.push(bitmap);return bitmap;}}};
  const live=Live.create(gl,doc,Painted.assets),draw=f=>live.draw(f,{angle:0,x:0,y:0,z:0,seed:1},{right:[1,0,0],up:[0,1,0],normal:[0,0,1],view:new Float32Array(16),scale:.4,time:0,kind:0});
  return{gl,events,pending,bitmaps,live,draw};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('painted volume has a rounded torso and remains visible through a full three-dimensional turn',()=>{
  const w=96,h=64,pixels=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(((x-w*.45)/(w*.4))**2+((y-h*.5)/(h*.36))**2<1)pixels[(y*w+x)*4+3]=255;
  const mesh=Live.volumeMesh(pixels,w,h);assert(mesh.length>0);assert(mesh.every(Number.isFinite));
  const depths=[];for(let i=2;i<mesh.length;i+=6)depths.push(mesh[i]);assert(Math.max(...depths)>.1);assert(Math.min(...depths)<-.1);
  for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12){const basis=Live.swimBasis(angle),xs=[];assert(Math.abs(Math.hypot(...basis.right)-1)<1e-8);for(let i=0;i<mesh.length;i+=6)xs.push((mesh[i]-.5)*basis.right[0]+mesh[i+2]*basis.normal[0]);assert(Math.max(...xs)-Math.min(...xs)>.18,'body cannot collapse edge-on');}
  assert.equal(Live.volumeMesh(new Uint8ClampedArray(w*h*4),w,h).length,0);
});
test('resident textures load only needed cells, release removed species and close decoded crops',async()=>{
  const f=fixture(),fish={id:F.catalog.fish[0].id};f.live.sync([fish,fish]);assert.equal(f.pending.length,1);assert.equal(f.live.stats().residents,1);
  f.pending[0].onload();await settle();assert.equal(f.live.stats().ready,1);assert.equal(f.live.stats().textures,0);
  assert.equal(f.draw(fish),true);assert.equal(f.live.stats().textures,1);assert.equal(f.live.stats().bytes,384*256*4);assert.ok(f.bitmaps[0].closed);
  f.live.sync([]);assert.equal(f.live.stats().textures,0);assert.equal(f.events.filter(e=>e[0]==='deleteTexture').length,1);f.live.destroy();f.live.destroy();
  assert.equal(f.events.filter(e=>e[0]==='deleteProgram').length,1);
});
test('late image loading after disposal cannot create textures or revive a scene',async()=>{
  const f=fixture();f.live.sync([{id:'koi'}]);f.live.destroy();f.pending[0].onload();await settle();assert.equal(f.live.stats().ready,0);assert.equal(f.bitmaps.length,0);assert.equal(f.events.filter(e=>e[0]==='texImage2D').length,0);
});
test('main embedded fishing is retired while all three live surfaces load the resident renderer',()=>{
  assert.equal(fs.existsSync(require('node:path').join(__dirname,'../skins/tracer/fishing-game.js')),false);
  const controller=fs.readFileSync(require.resolve('../skins/tracer/fishing.js'),'utf8'),view=fs.readFileSync(require.resolve('../skins/tracer/fishing-view.js'),'utf8');assert.doesNotMatch(controller,/openGame|TracerFishingGame/);assert.doesNotMatch(view,/open-game/);
  for(const name of ['index','fishing-desktop','fishing-aquarium-desktop']){const html=fs.readFileSync(require('node:path').join(__dirname,'../skins/tracer/'+name+'.html'),'utf8');assert.ok(html.indexOf('/fishing-species-painted.js')<html.indexOf('/fishing-species-live.js'));assert.ok(html.indexOf('/fishing-species-live.js')<html.indexOf('/fishing-art.js'));}
});
