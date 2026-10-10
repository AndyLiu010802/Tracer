'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Engine=require('../skins/tracer/fishing-painted-vfx');
const Relic=require('../skins/tracer/fishing-relic-vfx'),Pirates=require('../skins/tracer/fishing-onepiece-vfx');
const g={width:380,height:260,water:{x:225,y:175},ground:{x:160,y:230}},tip={x:95,y:35};
test('painted techniques finish cleanly and never animate during waiting or reeling',()=>{
  for(const api of [Relic,Pirates])for(const id of Object.keys(api.specs)){
    for(const phase of ['idle','charging','waiting','reeling'])for(const age of [0,200,900,20000])assert.equal(api.pose(id,phase,age,g,tip,g.water),null,id+' '+phase);
    for(const phase of ['cast','bite','caught','summon']){
      const duration=api.duration(id,phase);assert.equal(api.pose(id,phase,duration,g,tip,g.water),null);
      for(const age of [1,duration*.25,duration*.5,duration-.01]){const q=api.pose(id,phase,age,g,tip,g.water);for(const key of ['x','y','rotation','scale','size','alpha','blend'])assert(Number.isFinite(q[key]),id+' '+key);assert(q.alpha>=0&&q.alpha<=1);assert(q.a>=0&&q.b<=5);}
    }
    for(const age of [NaN,Infinity,-1])assert.equal(api.pose(id,'cast',age,g,tip,g.water),null);
  }
});
test('rubber grasp stays on the actual returning fish rather than a second decorative target',()=>{
  const api=Engine.createCollection({anime_luffy:{motion:'rubber'}},'test');
  for(const point of [{x:225,y:175},{x:192,y:100},{x:160,y:230}]){
    const q=api.pose('anime_luffy','caught',1000,g,tip,point);assert.equal(q.x,point.x);assert.equal(q.y,point.y);assert.equal(q.a,3);assert(q.alpha>.5);
  }
  const release=api.pose('anime_luffy','caught',1800,g,tip,g.ground);assert(release.a>=4);assert.equal(api.pose('anime_luffy','caught',1940,g,tip,g.ground),null);
});
test('rubber arms follow the painted wrist socket and match its width through grasp and release',()=>{
  for(const id of ['anime_luffy','anime_nika']){
    const api=Engine.createCollection({[id]:{motion:'rubber'}},'test');
    for(const phase of ['cast','bite','caught']){
      const first=api.pose(id,phase,0,g,tip,g.water),start=Engine.wrist(id,first);assert(Math.hypot(start.x-tip.x,start.y-tip.y)<1e-8);
      for(let age=10;age<api.duration(id,phase);age+=1000/30){
        const q=api.pose(id,phase,age,g,tip,g.water),rig=Engine.armGeometry(id,q,tip,false),left=rig.left.at(-1),right=rig.right.at(-1);
        assert(Math.hypot((left.x+right.x)/2-rig.end.x,(left.y+right.y)/2-rig.end.y)<1e-8);
        assert(Math.abs(Math.hypot(left.x-right.x,left.y-right.y)-rig.end.width)<1e-8);
        assert(rig.length>=0&&rig.end.width>3);
        assert([...rig.left,...rig.right].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
      }
    }
  }
});
test('only eight equipped technique atlases remain cached',async()=>{
  let created=0;
  class FakeImage{constructor(){created++;}set src(value){this.onload();}}
  const ctx={drawImage(){},save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(){},createLinearGradient(){return{addColorStop(){}};}};
  const doc={defaultView:{Image:FakeImage},createElement(){return{getContext:()=>ctx};}};
  const specs=Object.fromEntries(Array.from({length:20},(_,i)=>['rod'+i,{src:'/test'+i+'.png',revision:'v1',motion:'slash'}]));
  const api=Engine.createCollection(specs,'test');for(const id of Object.keys(specs))await api.load(doc,id);
  assert.equal(created,20);assert.equal(Object.keys(specs).filter(id=>api.get(doc,id)).length,8);assert.equal(api.get(doc,'rod0'),null);await api.load(doc,'rod19');assert.equal(created,20);
});
test('guandao cutting head remains rigid while its fishing tip flexes',()=>{
  const Painted=require('../skins/tracer/fishing-relic-painted');
  const entry={id:'guanyuyunchang',bounds:[0,0,1000,300],base:[0,150],tip:[1000,150],width:1000,height:300};
  const deform=([t,n],bend)=>({x:t*500+bend*t*t*200,y:n+t*300});
  const rest=Array.from(Painted.vertices(entry,0,deform,500)),bent=Array.from(Painted.vertices(entry,.24,deform,500));
  for(let i=0;i<30*24;i+=4){assert.equal(rest[i],bent[i]);assert.equal(rest[i+1],bent[i+1]);}
  assert.notEqual(rest[63*24+4],bent[63*24+4]);
});
