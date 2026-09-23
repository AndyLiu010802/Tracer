'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Trails=require('../skins/tracer/garden-trails'),Pets=require('../skins/tracer/pet-model');
test('every shiny garden species has an exclusive named trail, ordinary and custom pets have none',()=>{
  const state=Pets.fresh(),now=Date.now();
  Pets.unlockGarden(state,Trails.catalog.map(item=>({projectId:'trail-'+item.id,plantKind:item.id,ticket:0,maturedAt:now-1,harvestedAt:now})));
  const pets=Pets.catalog(state).filter(p=>p.garden&&p.shiny);
  assert.equal(Trails.catalog.length,9);assert.equal(pets.length,9);
  assert.equal(new Set(Trails.catalog.map(t=>t.name[0])).size,9);
  for(const pet of pets){assert.equal(Trails.kindForPet(pet),pet.plantKind);assert.ok(Trails.profile(pet.plantKind));assert.equal(Trails.kindForPet(pet.id.replace('_shiny','')),null);}
  for(const id of ['custom_shiny','garden_unknown_shiny','sprout',null])assert.equal(Trails.kindForPet({id,shiny:true}),null);
});
test('per-companion preferences migrate old global settings and do not enable other companions when toggled',()=>{
  for(const legacy of [null,'false','true']){
    const prefs=Trails.preferences(null,legacy);assert.equal(Object.values(prefs.enabled).every(v=>v===(legacy==='true')),true);
    prefs.enabled.garden_cherry_shiny=!prefs.enabled.garden_cherry_shiny;
    const restored=Trails.preferences(JSON.stringify(prefs),'true');assert.deepEqual(restored,prefs);
    assert.equal(restored.enabled.garden_apple_shiny,legacy==='true');
  }
  assert.equal(Trails.preferences('{broken','false').enabled.garden_cherry_shiny,false);
  assert.equal(Trails.preferences(JSON.stringify({version:2,enabled:{garden_apple_shiny:'true',custom_shiny:true}}),'true').enabled.garden_apple_shiny,false);
});
