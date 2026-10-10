'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync');
function stock(id='koi',bait='grain'){
  const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'harvest_test',amount:10000,updatedAt:1};
  F.buyBait(ws,bait,1,1000);F.equipBait(ws,bait,1000);let seed=0;
  while(F.createSession(F.empty(),{baitId:bait,seed,now:1000}).fishId!==id)if(++seed>1000)throw Error(id);
  const {session}=F.beginCast(ws,{seed,now:1000});F.stepSession(session,{},900);F.stepSession(session,{release:true},0);F.commitCast(ws,session,1001);
  for(let frame=0;frame<4000&&!['caught','escaped'].includes(session.phase);frame++)F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);
  const caught=F.recordCatch(ws,session,21000);assert(caught.fry);return {ws,fry:caught.fry,fish:caught.fish,catch:caught.catch};
}
function grow(s,aquarium=false){
  if(aquarium)F.placeAquariumFish(s.ws,s.fry.id,true,22000);else F.placeFry(s.ws,s.fry.id,'pond_starter',22000);
  for(let i=0;i<5;i++)assert.equal((aquarium?F.feedAquarium(s.ws,30000+i*60000):F.feedPond(s.ws,'pond_starter',30000+i*60000)).ok,true);
  return s;
}
test('only mature residents can be harvested, at 150% of the species base price',()=>{
  const s=stock(),before=structuredClone(s.ws);assert.equal(F.harvestFish(s.ws,s.fry.id,22000).reason,'fish-not-mature');assert.deepEqual(s.ws,before);
  grow(s);const coins=F.economy(s.ws).balance,result=F.harvestFish(s.ws,s.fry.id,300000);
  assert.equal(result.earned,Math.round(s.fish.price*1.5));assert.equal(F.economy(s.ws).balance,coins+result.earned);
  assert.equal(F.read(s.ws).ponds[0].fishIds.length,0);assert.equal(F.read(s.ws).catches[0].soldAt,null,'basket catch is a separate owned item');
  assert.equal(F.progression(s.ws).discovered,1);assert.equal(F.read(s.ws).fry[0].growth,100);
  const saved=structuredClone(s.ws);assert.equal(F.harvestFish(s.ws,s.fry.id,300001).earned,0);assert.deepEqual(s.ws,saved);
  assert.equal(F.placeFry(s.ws,s.fry.id,'pond_starter',300002).reason,'fish-released');
});
test('legendary harvest removes aquarium membership and remains sold after workspace reload',()=>{
  const s=grow(stock('dragonkoi','spirit'),true);F.harvestFish(s.ws,s.fry.id,300000);
  assert.equal(F.aquarium(s.ws).fish.length,0);const restored=S.validate(JSON.parse(JSON.stringify(s.ws)));
  assert.equal(F.read(restored).fry[0].harvestedAt,300000);assert.deepEqual(restored.fishing.transactions,s.ws.fishing.transactions);
  assert.equal(F.placeAquariumFish(restored,s.fry.id,true,400000).ok,false);
});
test('mature fish returned to the nursery can be harvested there',()=>{
  const s=grow(stock());F.placeFry(s.ws,s.fry.id,null,280000);assert.equal(F.harvestFish(s.ws,s.fry.id,300000).ok,true);
});
test('harvest receipts must match one mature removed resident, amount and timestamp',()=>{
  const s=grow(stock());F.harvestFish(s.ws,s.fry.id,300000);const state=s.ws.fishing,tx=state.transactions.find(t=>t.kind==='harvest');
  for(const mutate of [s=>s.fry[0].growth=99,s=>s.fry[0].releasedAt=null,s=>delete s.fry[0].harvestedAt,s=>s.fry[0].harvestedAt++,s=>s.transactions.find(t=>t.kind==='harvest').amount++,s=>s.transactions.push({...tx,id:'forged'}),s=>s.transactions.find(t=>t.kind==='harvest').refId='missing']){
    const bad=structuredClone(state);mutate(bad);assert.throws(()=>F.validate(bad));
  }
});
test('two offline harvests merge to one payment and stale residents cannot reappear',()=>{
  const s=grow(stock()),base=structuredClone(s.ws.fishing),a=structuredClone(s.ws),b=structuredClone(s.ws);
  F.harvestFish(a,s.fry.id,300000);F.harvestFish(b,s.fry.id,310000);
  for(const [local,remote]of [[a,b],[b,a]]){
    const merged=F.merge(base,local.fishing,remote.fishing),sales=merged.transactions.filter(t=>t.kind==='harvest');
    assert.equal(sales.length,1);assert.equal(sales[0].createdAt,300000);assert.equal(merged.fry[0].harvestedAt,300000);assert.equal(merged.fry[0].pondId,null);
    const stale=F.merge(base,base,merged);assert.equal(stale.fry[0].releasedAt,300000);assert.equal(F.moneySummary(stale.transactions).earned,sales[0].amount);
  }
});
test('a concurrent release cannot cancel a completed harvest or its receipt',()=>{
  const s=grow(stock()),base=structuredClone(s.ws.fishing),released=structuredClone(s.ws);F.releaseFish(released,s.fry.id,320000);F.harvestFish(s.ws,s.fry.id,300000);
  const merged=F.merge(base,released.fishing,s.ws.fishing);assert.equal(merged.fry[0].releasedAt,300000);assert.equal(merged.fry[0].harvestedAt,300000);assert.equal(merged.transactions.filter(t=>t.kind==='harvest').length,1);
});
test('live conditions override an old manual choice without rewriting historical casts',()=>{
  const ws=M.emptyWorkspace();F.ensure(ws);F.setExpedition(ws,{spotId:'creek',timeId:'day',weatherId:'rain'},1000);
  const e=F.expedition(ws,{timeId:'night',weatherId:'unknown'});assert.equal(e.selection.weatherId,'unknown');assert.equal(e.selection.timeId,'night');assert.equal(e.fishChance,.82+F.catalog.baits[0].fishBonus);
  const {session}=F.beginCast(ws,{expedition:e.selection,seed:0,now:2000});
  F.expedition(ws,{timeId:'dawn',weatherId:'storm'});assert.equal(session.timeId,'night');assert.equal(session.weatherId,'unknown');
});
