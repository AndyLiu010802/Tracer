'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const H=require('../skins/tracer/garden-harvest-model'),P=require('../skins/tracer/pet-model');
const A=require('../skins/tracer/garden-plant-art'),Motion=require('../skins/tracer/garden-plant-animation');
const mature=(id,kind='wildflower')=>({projectId:id,plantKind:kind,stage:4,commemoratedAt:100});
test('10,000 equiprobable outcomes contain 99 rare companions, one shiny companion and 9,900 ordinary plants',()=>{
  const counts={normal:0,rare:0,shiny:0};for(let ticket=0;ticket<10000;ticket++)counts[H.rarity(ticket)]++;
  assert.deepEqual(counts,{normal:9900,rare:99,shiny:1});
  assert.equal(H.draw({getRandomValues(array){array[0]=0;}}),0);
  let calls=0;assert.equal(H.draw({getRandomValues(array){array[0]=++calls===1?0xffffffff:9999;}}),9999);assert.equal(calls,2);
  assert.throws(()=>H.draw({getRandomValues(array){array[0]=0xffffffff;}}),/garden-random-unavailable/);
});
test('maturity rolls only once per project and survives reload, removal, replanting and harvest retries',()=>{
  let calls=0;const first=H.mature(H.fresh(),[mature('p')],()=>{calls++;return 0;});
  const clone=JSON.parse(JSON.stringify(first));
  let next=H.mature(clone,[mature('p','apple')],()=>{calls++;return 9999;});
  assert.equal(calls,1);assert.deepEqual(next,first);assert.equal(H.snapshot(next).records[0].rarity,'shiny');
  next=H.harvest(next,'p',150);const once=H.harvest(next,'p',300);assert.deepEqual(once,next);
  assert.equal(H.snapshot(once).collected[0].petId,'garden_wildflower_shiny');
  assert.equal(first.records[0].harvestedAt,null);
});
test('unripe plants earn no draw; malformed and future harvests fail without mutating receipts',()=>{
  const fresh=H.fresh();assert.deepEqual(H.mature(fresh,[{...mature('p'),stage:3}],()=>assert.fail('must not draw')),fresh);
  assert.throws(()=>H.harvest(fresh,'p',200),/garden-not-ready/);
  const state=H.mature(fresh,[mature('p')],()=>100),copy=JSON.stringify(state);
  assert.throws(()=>H.harvest(state,'p',99),/garden-not-ready/);
  for(const bad of [{...state,unknown:true},{...state,records:[state.records[0],state.records[0]]},{v:1,records:[{...state.records[0],ticket:-1}]},{v:1,records:[{...state.records[0],harvestedAt:50}]}])assert.throws(()=>H.read(bad),/invalid-garden-harvest/);
  assert.equal(JSON.stringify(state),copy);
});
test('only collected rare plants enter the existing roster, shiny variants stay distinct and needs persist',()=>{
  const state=P.fresh(100);let harvest=H.mature(H.fresh(),[mature('normal'),mature('rare','apple'),mature('shiny','apple')],(()=>{const values=[100,99,0];return()=>values.shift();})());
  assert.deepEqual(P.unlockGarden(state,harvest.records),[]);
  for(const id of ['normal','rare','shiny'])harvest=H.harvest(harvest,id,200);
  assert.deepEqual(P.unlockGarden(state,harvest.records),['garden_apple','garden_apple_shiny']);
  assert.deepEqual(P.unlockGarden(state,harvest.records),[]);
  assert.equal(P.act(state,'select','garden_apple_shiny',200).accepted,true);P.current(state).bond=42;
  const restored=P.read(JSON.parse(JSON.stringify(state)),200);
  assert.equal(restored.selected,'garden_apple_shiny');assert.equal(P.current(restored).bond,42);
  assert.equal(P.catalog(restored).find(p=>p.id===restored.selected).shiny,true);
  assert.equal(restored.customs.length,0,'garden friends do not consume custom image slots');
});
test('all six ordinary plant kinds and all five growth stages contain no face; only mature variants gain a face',()=>{
  for(const kind of A.kinds)for(let stage=0;stage<5;stage++){
    assert.doesNotMatch(A.markup(kind,stage),/data-plant-part="face"/);
    if(stage===4)assert.match(A.markup(kind,stage,true),/data-plant-part="face"/);
  }
  assert.doesNotMatch(A.markup('<script>',NaN),/<script>/);
});
test('nine animation clips articulate independent parts across 32 sampled poses with finite bounded values',()=>{
  assert.equal(Motion.frames,32);
  for(const action of Motion.actions){
    const poses=Array.from({length:32},(_,frame)=>Motion.sample(action,frame));
    const shapes=new Set(poses.map(({frame,...pose})=>JSON.stringify(pose)));
    assert.ok(shapes.size>=16,action+' must contain moving articulated poses');
    assert.ok(poses.some(pose=>pose.head!==pose['leaf-left']),action);
    assert.doesNotMatch(JSON.stringify(poses),/NaN|Infinity/);
    assert.deepEqual(Motion.sample(action,32),Motion.sample(action,0));
  }
});
