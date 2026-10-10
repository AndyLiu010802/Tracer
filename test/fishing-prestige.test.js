'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('../public/fishing-model'),P=require('../skins/tracer/fishing-prestige'),M=require('../skins/tracer/fishing-motion');
const rods=F.catalog.rods.filter(r=>r.rarity==='legendary');
test('each legendary rod has an explicit theme, original float direction and hidden signature',()=>{
  assert.equal(rods.length,66);assert.deepEqual(Object.keys(P.themes).sort(),rods.map(r=>r.id).sort());
  const labels=new Set(),prompts=new Set(),signatures=new Set();
  for(const r of rods){const s=P.get(r.id);labels.add(s.label);prompts.add(s.bobber);assert(P.getGlyph(s.motif));assert.equal(!!s.signature,!!r.hidden);if(r.hidden)signatures.add(s.signature);assert(P.bobberMarkup(r).includes(s.src));}
  assert.equal(labels.size,66);assert.equal(prompts.size,66);assert.equal(signatures.size,7);assert.equal(P.get('__proto__'),null);
  assert.equal(P.bobberMarkup(F.catalog.rods[0]),'');
});
test('orbit objects follow the actual curved rod in front and behind without frame jumps',()=>{
  const g={width:380,height:260,curve:u=>({x:60+80*u+18*u*u,y:230-175*u})};
  for(const r of rods)for(const t of [0,33.333,990,6280,22000]){
    const current=P.field(r,t,g),next=P.field(r,t+1000/30,g);assert.equal(current.length,P.get(r.id).count);
    const shifted=P.field(r,t,{...g,curve:u=>{const p=g.curve(u);return{x:p.x+25,y:p.y-10};}});
    for(let i=0;i<current.length;i++){const a=current[i],b=next[i];assert([a.x,a.y,a.size,a.alpha,a.angle,a.depth].every(Number.isFinite));assert(a.alpha>=0&&a.alpha<=1);assert(Math.hypot(a.x-b.x,a.y-b.y)<1.6,r.id+' 30fps continuity');assert(Math.abs(shifted[i].x-a.x-25)<1e-9);assert(Math.abs(shifted[i].y-a.y+10)<1e-9);}
    assert(current.some(p=>p.depth>=0));assert(current.some(p=>p.depth<0));
  }
});
test('reeling uses quiet bounded orbit cues, reduced motion is static and hidden forms remain distinct',()=>{
  const g={width:380,height:260,curve:u=>({x:60+80*u,y:230-175*u})},forms=new Set();
  for(const r of rods){
    const idle=P.field(r,1000,g),fight=P.field(r,1000,g,'reeling',1800);assert([...idle,...fight].every(p=>p.alpha===1),'opaque bodies in all phases');if(!r.hidden)assert(fight.length<=2,'reduce clutter by count, not translucency');
    assert.deepEqual(P.field(r,1000,g,'reeling',1800,true),P.field(r,9000,g,'reeling',1800,true));
    assert.deepEqual(P.field(r,9000,g,'escaped',1200),[]);
    if(r.hidden){const q=P.signature(r,1000,g,'idle',0);forms.add(q.kind);assert.notDeepEqual(q,P.signature(r,3000,g,'idle',0));assert.deepEqual(P.signature(r,1000,g,'idle',0,true),P.signature(r,9000,g,'idle',0,true));}
  }assert.equal(forms.size,7);
});
test('prestige is a presentation-only layer and is bundled before effects on both surfaces',()=>{
  const initial=F.createSession(null,{seed:0}),saved=JSON.stringify(initial),g={width:380,height:260,curve:u=>({x:60+80*u,y:230-175*u})};
  for(const r of rods){P.field(r,1000,g,'reeling',1500);P.signature(r,1000,g,'cast',300);M.catalogEffectsMarkup(r);}assert.equal(JSON.stringify(initial),saved);
  for(const file of ['index.html','fishing-desktop.html']){const s=fs.readFileSync(path.join(__dirname,'../skins/tracer',file),'utf8');assert(s.indexOf('/fishing-prestige.js')<s.indexOf('/fishing-rod-effects.js'));}
});

test('painted ornaments decode asynchronously and repeat selections reuse the loaded image',async()=>{
  const instances=[];let completeDecode;
  class Image {constructor(){instances.push(this);}decode(){return new Promise(resolve=>{completeDecode=resolve;});}}
  const doc={defaultView:{Image}},rod=rods[0],first=P.preload(rod,doc);
  assert.equal(P.preload(rod,doc),first,'repeated state updates cannot create duplicate decodes');
  assert.equal(instances.length,1);let settled=false;first.then(()=>settled=true);
  instances[0].onload();await Promise.resolve();assert.equal(settled,false,'do not upload a still undecoded sprite on an input frame');
  completeDecode();assert.equal((await first).ready,true);assert.equal(P.preload(rod,doc),first);
  const other=P.preload(rods[1],doc);instances[1].onerror();assert.equal((await other).error,true,'missing art settles without holding gameplay');
  assert.equal(await P.preload(F.catalog.rods[0],doc),null,'ordinary rods do not load prestige textures');
});
