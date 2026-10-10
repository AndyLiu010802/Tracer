'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync');
const copy=structuredClone;
function workspace(credit=1000){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'growth_test',amount:credit,updatedAt:1};return ws;}
function land(ws,id,bait,now=1000){
  if(!F.read(ws).baits[bait])assert.equal(F.buyBait(ws,bait,1,now).ok,true);
  assert.equal(F.equipBait(ws,bait,now).ok,true);let seed=0;
  while(F.createSession(F.empty(),{baitId:bait,seed,now}).fishId!==id){if(++seed>1000)throw Error('Unreachable fish '+id);}
  const {session}=F.beginCast(ws,{seed,now});F.stepSession(session,{},900);F.stepSession(session,{release:true},0);assert.equal(F.commitCast(ws,session,now+1).ok,true);
  for(let frame=0;frame<4000&&!['caught','escaped'].includes(session.phase);frame++)F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);
  assert.equal(session.phase,'caught');return F.recordCatch(ws,session,now+20000).fry;
}

test('growth stages and size remain bounded and every species has a bilingual adult form and action',()=>{
  assert.deepEqual([0,20,39,40,80,99,100].map(F.growthStage),['fry','fry','fry','juvenile','juvenile','juvenile','adult']);
  for(const fish of F.catalog.fish){
    let scale=0;for(const growth of [0,20,40,60,80,99,100]){const appearance=F.growthAppearance(fish,growth);assert(appearance.scale>scale);scale=appearance.scale;assert.equal(appearance.mature,growth===100);assert.equal(appearance.stage,F.growthStage({growth}));}
    const adult=F.growthAppearance({id:'resident',fishId:fish.id,growth:100});
    for(const key of ['formName','description','actionName'])assert(adult[key].length===2&&adult[key].every(t=>typeof t==='string'&&t.length>0));
    assert(['orbit','twirl','sway','glow','flutter','leap','bubble','bottom','glide','pulse','dart'].includes(adult.motion));
    assert.deepEqual(adult,F.growthAppearance({id:'resident',speciesId:fish.id,growth:100}));
    const before=copy(fish);adult.formName[0]='changed';assert.deepEqual(fish,before,'appearance metadata does not mutate the catalog');
  }
  assert.equal(F.growthAppearance({growth:-1}).scale,.64);assert(Math.abs(F.growthAppearance({growth:1000}).scale-1.18)<1e-12);
  for(const growth of [NaN,Infinity,-Infinity,'bad'])assert.equal(F.growthAppearance({growth}).progress,0);
});

test('the fifth pond feed announces each adult once, charges once and leaves continued feeding available',()=>{
  const ws=workspace(),a=land(ws,'koi','grain'),b=land(ws,'goldfish','grain',30000),pond=F.read(ws).activePondId;
  for(const f of [a,b])assert.equal(F.placeFry(ws,f.id,pond,60000).ok,true);
  const initialBalance=F.economy(ws).balance;
  for(let n=1;n<=5;n++){
    const result=F.feedPond(ws,pond,60000+(n-1)*60000);assert.equal(result.ok,true);assert.equal(result.fed,2);
    assert.deepEqual(result.fishIds,[a.id,b.id]);assert.equal(result.reactions.length,2);assert.equal(F.economy(ws).balance,initialBalance-n*5);
    assert(F.read(ws).fry.every(f=>f.growth===n*20));
    assert.deepEqual(result.grownFishIds,n===5?[a.id,b.id]:[]);assert.equal(result.maturation.length,n===5?2:0);
    for(const event of result.maturation){assert.equal(event.fromGrowth,80);assert.equal(event.growth,100);assert.deepEqual(event.name,F.catalog.fish.find(f=>f.id===event.fishId).name);assert.deepEqual(event.actionName,F.growthAppearance({fishId:event.fishId,growth:100}).actionName);}
  }
  const grown=copy(ws);assert.equal(F.feedPond(ws,pond,300001).reason,'no-hungry-fish');assert.deepEqual(ws,grown);
  const reloaded=S.validate(copy(ws)),result=F.feedPond(reloaded,pond,360000);assert.equal(result.ok,true);assert.deepEqual(result.maturation,[]);assert.deepEqual(result.grownFishIds,[]);assert(F.read(reloaded).fry.every(f=>f.growth===100));
});

test('aquarium maturity survives nursery moves, reload and stale preservation without reannouncing',()=>{
  const ws=workspace(),fry=land(ws,'dragonkoi','spirit');assert.equal(F.placeAquariumFish(ws,fry.id,true,22000).ok,true);
  for(let n=0;n<4;n++)assert.equal(F.feedAquarium(ws,30000+n*60000).ok,true);
  const stale=copy(ws),result=F.feedAquarium(ws,270000);assert.deepEqual(result.grownFishIds,[fry.id]);assert.equal(result.maturation[0].motion,'leap');
  assert.equal(F.aquarium(ws).fish[0].growth,100);assert.equal(F.growthAppearance(F.aquarium(ws).fish[0]).mature,true);
  F.equipBait(stale,'worm',280000);F.preserve(ws,stale);assert.equal(F.aquarium(stale).fish[0].growth,100,'a stale client cannot undo adulthood');
  const reloaded=S.validate(copy(ws));assert.equal(F.placeAquariumFish(reloaded,fry.id,false,280001).ok,true);assert.equal(F.read(reloaded).fry[0].growth,100);
  assert.equal(F.placeAquariumFish(reloaded,fry.id,true,280002).ok,true);assert.deepEqual(F.feedAquarium(reloaded,330000).maturation,[]);
});

test('a rejected feed cannot spend money, grow a fish or emit maturity',()=>{
  const ws=workspace(),fry=land(ws,'koi','grain'),pond=F.read(ws).activePondId;F.placeFry(ws,fry.id,pond,22000);
  for(let n=0;n<4;n++)F.feedPond(ws,pond,30000+n*60000);
  ws.taskGarden.market.testCredit.amount=F.economy(ws).spent;const before=copy(ws),result=F.feedPond(ws,pond,270000);
  assert.deepEqual(result,{ok:false,reason:'insufficient-coins'});assert.deepEqual(ws,before);assert.equal(F.read(ws).fry[0].growth,80);
});

test('non-round saved growth crosses adulthood once and keeps existing save fields',()=>{
  const ws=workspace(),fry=land(ws,'koi','grain'),pond=F.read(ws).activePondId;F.placeFry(ws,fry.id,pond,22000);ws.fishing.fry[0].growth=91;
  const keys=Object.keys(ws.fishing.fry[0]),result=F.feedPond(ws,pond,30000);assert.equal(result.maturation[0].fromGrowth,91);assert.equal(F.read(ws).fry[0].growth,100);
  assert.deepEqual(Object.keys(ws.fishing.fry[0]),keys);assert.doesNotThrow(()=>S.validate(copy(ws)));assert.deepEqual(F.feedPond(ws,pond,90000).grownFishIds,[]);
});
