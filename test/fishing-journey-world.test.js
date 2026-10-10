'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),Sync=require('../public/workspace-sync');
const env=(spotId='creek',timeId='day',weatherId='clear')=>({spotId,timeId,weatherId,updatedAt:0});
const copy=structuredClone;
function workspace(){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'journey_qa',amount:100000,updatedAt:1};for(const spot of F.catalog.spots)F.unlockGround(ws,spot.id,1);return ws;}
function preview(seed,options={}){const s=F.createSession(F.empty(),{seed,expedition:env(),...options});F.stepSession(s,{},options.charge||900);F.stepSession(s,{release:true},0);return s;}
function seedFor(predicate,options){for(let seed=0;seed<10000;seed++){const s=preview(seed,options);if(predicate(s))return seed;}throw Error('No matching encounter');}
function unlock(ws,id){const rod=F.catalog.rods.find(r=>r.id===id),pool=F.catalog.rodPools.find(p=>p.hiddenRodId===id||p.rodIds.includes(id)),owned=F.read(ws).rods;const all=F.catalog.rods.filter(r=>pool.rodIds.includes(r.id)&&r.rarity===rod.rarity),unowned=all.filter(r=>!owned.includes(r.id));const result=F.buyBox(ws,{poolId:pool.id,random:n=>n===10000?rod.hidden?5450:({common:0,rare:5500,epic:8500,legendary:9700})[rod.rarity]:(unowned.length?unowned:all).findIndex(r=>r.id===id)});assert.equal(result.rod.id,id);assert(F.equipRod(ws,id).ok);}
function catchSeed(ws,seed){const s=F.beginCast(ws,{seed,expedition:F.expedition(ws).selection}).session;F.stepSession(s,{},900);F.stepSession(s,{release:true},0);assert(F.commitCast(ws,s).ok);for(let frame=0;frame<4000&&!['caught','escaped'].includes(s.phase);frame++)F.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);assert.equal(s.phase,'caught');return{session:s,result:F.recordCatch(ws,s)};}

test('six fishing grounds contain every one of the 156 species and never leak an outside fish',()=>{
  assert.equal(F.catalog.fish.length,156);assert.equal(F.catalog.baits.length,5);assert.equal(F.catalog.spots.length,6);
  const all=new Set();
  for(const spot of F.catalog.spots){const ws=workspace();F.setExpedition(ws,{spotId:spot.id});const allowed=new Set(F.expedition(ws).fish.map(f=>f.id)),seen=new Set();for(let seed=0;seed<4000;seed++){const s=preview(seed,{expedition:env(spot.id)});if(F.catalog.products.some(p=>p.id===s.fishId))continue;assert(allowed.has(s.fishId),spot.id+'/'+s.fishId);seen.add(s.fishId);all.add(s.fishId);}assert.deepEqual([...seen].sort(),[...allowed].sort(),spot.id+' all species reachable with starter bait');}
  assert.equal(all.size,156);
});

test('bait changes fish odds and preference, never availability; depth and conditions have real effects',()=>{
  const tally=(baitId,environment,charge=900)=>{let fish=0,targets=0,large=0;for(let seed=0;seed<6000;seed++){const s=preview(seed,{baitId,expedition:environment,charge}),f=F.catalog.fish.find(f=>f.id===s.fishId);if(f){fish++;if(['crucian','carp','koi','goldfish','lotusfin'].includes(f.id))targets++;if(f.baseLength>=40)large++;}}return{fish,targets,large};};
  const worm=tally('worm',env()),grain=tally('grain',env()),dawnRain=tally('grain',env('creek','dawn','rain')),near=tally('worm',env(),250);
  assert(grain.targets>worm.targets*1.25);assert(dawnRain.fish>grain.fish);assert(worm.large>near.large);
  const ws=workspace();F.setExpedition(ws,{spotId:'reef'});F.equipBait(ws,'worm');assert.equal(F.expedition(ws).favoredFishIds.length,0);assert(F.expedition(ws).fishChance>.8,'unmatched bait remains viable');
});

test('all thirty Journey rods draw from their own pool and preserve physical tuning limits',()=>{
  const ws=workspace(),pool=F.catalog.rodPools.find(p=>p.id==='journey'),ids=[...pool.rodIds,pool.hiddenRodId];assert.equal(ids.length,30);assert.equal(F.catalog.rods.length,253);
  for(const id of ids){unlock(ws,id);const r=F.catalog.rods.find(r=>r.id===id);assert(r.barSize<=.38&&r.control<=1.18);assert(r.effectDescription.every(s=>s.length>=12));}
  assert.equal(F.read(Sync.validate(copy(ws))).rods.length,31);assert.equal(F.pity(F.read(ws),'basic').epic,0);assert.equal(F.pity(F.read(ws),'myriad').epic,0);
});

test('Eclipse triggers instant catches at the bite without a reeling input or perfect reward',()=>{
  const ws=workspace();unlock(ws,'eclipse');const seed=seedFor(s=>s.instant&&F.catalog.fish.find(f=>f.id===s.fishId)?.rarity==='common',{rodId:'eclipse'});
  const s=F.beginCast(ws,{seed,expedition:env()}).session;F.stepSession(s,{},900);F.stepSession(s,{release:true},0);F.commitCast(ws,s);F.stepSession(s,{},682+s.waitDuration);
  assert.equal(s.phase,'caught');assert.equal(s.perfect,false);const result=F.recordCatch(ws,s);assert(result.instant);assert.equal(result.count,1);assert.equal(result.catch.quality,'normal');assert.equal(F.read(ws).baits.earthworm,29);assert.equal(F.recordCatch(ws,s).alreadyRecorded,true);assert.equal(ws.fishing.catches.length,1);
  const ordinary=seedFor(s=>!s.instant&&F.catalog.fish.some(f=>f.id===s.fishId),{rodId:'eclipse'});assert.equal(preview(ordinary,{rodId:'eclipse'}).instant,false);
});

test('Great Sage lands two or three real catches with one bait; retries, sales and merges are idempotent',()=>{
  for(const count of [2,3]){const ws=workspace();unlock(ws,'wukong');const seed=seedFor(s=>s.haulCount===count&&F.catalog.fish.find(f=>f.id===s.fishId)?.rarity==='rare',{rodId:'wukong'}),base=copy(ws),{session,result}=catchSeed(ws,seed);
    assert.equal(result.count,count);assert.equal(result.catches.length,count);assert.equal(result.fryRows.length,count);assert.equal(ws.fishing.casts.length,1);assert.equal(F.read(ws).baits.earthworm,29);assert.equal(ws.fishing.catches.length,count);
    const after=JSON.stringify(ws);assert(F.recordCatch(ws,session).alreadyRecorded);assert.equal(JSON.stringify(ws),after);assert.deepEqual(Sync.validate(copy(ws)).fishing,ws.fishing);
    const merged=F.merge(base.fishing,ws.fishing,copy(ws.fishing));assert.equal(merged.catches.length,count);assert.equal(merged.fry.length,count);
    const value=result.fish.price*count,balance=F.economy(ws).balance;for(const c of result.catches)assert(F.sellFish(ws,c.id).ok);assert.equal(F.economy(ws).balance,balance+value);assert.equal(ws.fishing.transactions.filter(t=>t.kind==='sale').length,count);
    for(const mutate of [s=>s.casts[0].haulCount=4,s=>s.casts[0].rodId='bamboo',s=>s.catches[1].batchIndex=0,s=>s.catches.pop(),s=>s.catches[0].fishId='galaxywhale']){const bad=copy(ws.fishing);mutate(bad);assert.throws(()=>F.validate(bad));}
  }
});

test('hidden probabilities are stable and salvage never activates hidden rewards',()=>{
  let instant=0,double=0,triple=0,fish=0;
  for(let seed=0;seed<12000;seed++){const a=preview(seed,{rodId:'wukong'}),b=preview(seed,{rodId:'eclipse'});if(F.catalog.fish.some(f=>f.id===a.fishId)){fish++;double+=a.haulCount===2;triple+=a.haulCount===3;instant+=b.instant;}else{assert.equal(a.haulCount,1);assert.equal(b.instant,false);}}
  for(const [actual,target]of [[instant/fish,.195],[double/fish,.208],[triple/fish,.078]])assert(Math.abs(actual-target)<.015,actual+' vs '+target);
});

test('expedition clocks survive unrelated edits, historical saves remain exact, records survive sales',()=>{
  const ws=workspace(),old=copy(ws.fishing);assert.equal(old.expedition,undefined);assert.deepEqual(F.validate(old),old);
  const base=copy(ws),local=copy(ws),remote=copy(ws);F.setExpedition(local,{spotId:'reef',timeId:'dusk'},100);F.equipBait(remote,'worm',200);const merged=F.merge(base.fishing,local.fishing,remote.fishing);assert.equal(merged.expedition.spotId,'reef');assert.equal(merged.expedition.updatedAt,100);
  const before=copy(ws);assert.equal(F.setExpedition(ws,{spotId:'missing'}).ok,false);assert.deepEqual(ws,before);
  const {result}=catchSeed(ws,seedFor(s=>s.fishId==='minnow'));const records=F.progression(ws);F.sellFish(ws,result.catch.id);assert.deepEqual(F.progression(ws),records);assert(records.mastery.xp>0);assert.equal(records.discovered,1);
});
