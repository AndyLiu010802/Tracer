'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),Sync=require('../public/workspace-sync');
function workspace(){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'ground_qa',amount:500000,updatedAt:1};return ws;}
function unlock(ws,id){for(const spot of F.catalog.spots){assert(F.unlockGround(ws,spot.id,2).ok);if(spot.id===id)break;}}
function open(ws,poolId,ticket,now=20){return F.buyBox(ws,{poolId,now,random:limit=>limit===10000?ticket:0});}
function complete(ws,poolId='basic'){const pool=F.catalog.rodPools.find(p=>p.id===poolId);for(const [rarity,ticket] of [['common',0],['rare',5500],['epic',8500],['legendary',9700]])while(pool.rodIds.some(id=>!F.read(ws).rods.includes(id)&&F.catalog.rods.find(r=>r.id===id).rarity===rarity))assert(open(ws,poolId,ticket).ok);}
test('grounds unlock in order, once, with exact permanent ledger prices and locked cast enforcement',()=>{
 assert.deepEqual(F.catalog.spots.map(s=>s.valueMultiplier),[1,1.2,1.5,1.8,2.2,2.6]);assert.deepEqual(F.catalog.spots.map(s=>s.unlockPrice),[0,400,1000,2200,4500,8500]);
 const ws=workspace(),before=structuredClone(ws);assert.equal(F.setExpedition(ws,{spotId:'reef'},2).reason,'ground-locked');assert.equal(F.beginCast(ws,{expedition:{spotId:'moon',timeId:'day',weatherId:'clear'}}).reason,'ground-locked');assert.equal(F.unlockGround(ws,'frost',2).reason,'previous-ground-locked');assert.deepEqual(ws,before);
 let spent=0;for(const spot of F.catalog.spots){assert.equal(F.unlockGround(ws,spot.id,3).spent,spot.unlockPrice);spent+=spot.unlockPrice;assert.equal(F.unlockGround(ws,spot.id,4).spent,0);assert(F.setExpedition(ws,{spotId:spot.id},5).ok);assert.equal(F.economy(ws).balance,500000-spent);}
 assert.equal(F.read(ws).transactions.filter(t=>t.kind==='ground_unlock').length,5);assert.deepEqual(Sync.validate(structuredClone(ws)).fishing,ws.fishing);
 const stale=structuredClone(before);F.preserve(ws,stale);assert(F.groundProgress(F.read(stale)).every(s=>s.unlocked));assert.equal(F.economy(stale).balance,F.economy(ws).balance);
 const poor=workspace();poor.taskGarden.market.testCredit.amount=399;const unchanged=structuredClone(poor);assert.equal(F.unlockGround(poor,'reef').reason,'insufficient-coins');assert.deepEqual(poor,unchanged);
 const forged=structuredClone(ws.fishing);forged.transactions.find(t=>t.itemId==='reef').amount=-1;assert.throws(()=>F.validate(forged));
});
test('each ground raises forecast values and new catch sales preserve their committed value across switching and backup',()=>{
 const ws=workspace();unlock(ws,'moon');F.setExpedition(ws,{spotId:'moon',timeId:'day',weatherId:'clear'},3);
 const forecast=F.expedition(ws);for(const fish of forecast.fish)assert.equal(fish.groundPrice,Math.round(fish.price*2.6));
 let caught;
 for(let seed=0;seed<30&&!caught;seed++){
  const s=F.beginCast(ws,{seed,now:10+seed}).session;F.stepSession(s,{},900);F.stepSession(s,{release:true},0);assert(F.commitCast(ws,s,50+seed).ok);
  for(let i=0;i<5000&&!['caught','escaped'].includes(s.phase);i++)F.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);
  if(s.phase==='caught'){const r=F.recordCatch(ws,s,100+seed);if(F.catalog.fish.some(f=>f.id===r.catch.fishId))caught=r.catch;}
 }
 assert(caught);const base=F.catalog.fish.find(f=>f.id===caught.fishId).price;F.setExpedition(ws,{spotId:'creek'},200);assert.equal(F.catchValue(F.read(ws),caught),Math.round(base*2.6));assert.equal(F.sellFish(ws,caught.id,201).earned,Math.round(base*2.6));assert.deepEqual(Sync.validate(structuredClone(ws)).fishing,ws.fishing);
 const sale=ws.fishing.transactions.find(t=>t.kind==='sale');assert.equal(sale.valueSpotId,'moon');const bad=structuredClone(ws.fishing);bad.transactions.find(t=>t.kind==='sale').valueSpotId='reef';assert.throws(()=>F.validate(bad));
});
test('collection completion starts a fresh hidden counter; draw 100 overrides other guarantees and resets',()=>{
 const ws=workspace();complete(ws);let p=F.pity(F.read(ws));assert(p.hiddenActive);assert.equal(p.hidden,0);assert.equal(p.hiddenRemaining,100);
 for(let i=0;i<99;i++){const r=open(ws,'basic',0,30+i);assert(!r.hidden);assert.equal(r.pity.hidden,i+1);}
 assert.equal(F.pity(F.read(ws),'myriad').hiddenActive,false);const result=open(ws,'basic',0,150);assert(result.hidden);assert.equal(result.rod.id,F.catalog.rodPools[0].hiddenRodId);assert.equal(result.pity.hiddenRemaining,100);assert.equal(result.pity.hidden,0);assert.deepEqual(Sync.validate(structuredClone(ws)).fishing,ws.fishing);
 const forged=structuredClone(ws.fishing);delete forged.boxes.at(-1).pityRevision;assert.throws(()=>F.validate(forged));
 open(ws,'basic',0,151);assert.equal(F.pity(F.read(ws)).hidden,1);assert(open(ws,'basic',5450,152).hidden);assert.equal(F.pity(F.read(ws)).hidden,0);
});
test('ten draws cross the hidden boundary, and historical boxes do not retroactively trigger a guarantee',()=>{
 const ws=workspace();complete(ws,'valorant');for(let i=0;i<95;i++)open(ws,'valorant',0,30+i);
 const r=F.buyBoxes(ws,{poolId:'valorant',now:140,random:()=>0});assert.equal(r.results[4].hidden,true);assert.equal(r.pity.hidden,5);assert.equal(r.pity.hiddenRemaining,95);assert.equal(F.pity(F.read(ws),'basic').collected,0);
 const old=workspace();complete(old);for(let i=0;i<110;i++){open(old,'basic',0,200+i);delete old.fishing.boxes.at(-1).pityRevision;}
 assert.equal(F.pity(F.read(old)).hidden,0);assert.doesNotThrow(()=>F.validate(old.fishing));assert.equal(open(old,'basic',0,400).pity.hidden,1);
});

test('grown residents keep the value of their birth ground through harvest and stale merges',()=>{
 const ws=workspace();unlock(ws,'lotus');F.setExpedition(ws,{spotId:'lotus',timeId:'day',weatherId:'clear'},3);
 let fry;
 for(let seed=0;seed<30&&!fry;seed++){
  const s=F.beginCast(ws,{seed,now:10}).session;F.stepSession(s,{},900);F.stepSession(s,{release:true},0);F.commitCast(ws,s,11);
  for(let i=0;i<5000&&!['caught','escaped'].includes(s.phase);i++)F.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);
  if(s.phase==='caught')fry=F.recordCatch(ws,s,12).fryRows?.[0];
 }
 assert(fry);F.placeFry(ws,fry.id,'pond_starter',20);for(let i=0;i<5;i++)F.feedPond(ws,'pond_starter',1000+i*61000);
 const state=F.read(ws),resident=state.fry.find(f=>f.id===fry.id);assert.equal(resident.growth,100);
 const expected=Math.round(F.groundValue(F.catalog.fish.find(f=>f.id===resident.fishId),'lotus')*1.5),before=structuredClone(ws);assert.equal(F.harvestValue(resident,state),expected);
 assert.equal(F.harvestFish(ws,fry.id,400000).earned,expected);assert.equal(ws.fishing.transactions.at(-1).valueSpotId,'lotus');assert.deepEqual(Sync.validate(structuredClone(ws)).fishing,ws.fishing);
 F.preserve(ws,before);assert.equal(before.fishing.transactions.find(t=>t.kind==='harvest').amount,expected);
});

test('first preview economy records keep their original costs and fish value after the rebalance',()=>{
 const ws=workspace();unlock(ws,'moon');F.setExpedition(ws,{spotId:'moon',timeId:'day',weatherId:'clear'},3);let caught;
 for(let seed=0;seed<30&&!caught;seed++){
  const s=F.beginCast(ws,{seed,now:10}).session;F.stepSession(s,{},900);F.stepSession(s,{release:true},0);F.commitCast(ws,s,11);
  for(let i=0;i<5000&&!['caught','escaped'].includes(s.phase);i++)F.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);
  if(s.phase==='caught'){const c=F.recordCatch(ws,s,12).catch;if(F.catalog.fish.some(f=>f.id===c.fishId))caught=c;}
 }
 assert(caught);for(const cast of ws.fishing.casts)cast.valueRevision=1;
 for(const tx of ws.fishing.transactions.filter(t=>t.kind==='ground_unlock')){delete tx.economyRevision;tx.amount=-[0,600,1800,5000,12000,30000][F.catalog.spots.findIndex(s=>s.id===tx.itemId)];}
 ws.taskGarden.market.fishingTransactions=structuredClone(ws.fishing.transactions);
 const base=F.catalog.fish.find(f=>f.id===caught.fishId).price;assert.equal(F.catchValue(F.read(ws),caught),base*10);assert.equal(F.sellFish(ws,caught.id,20).earned,base*10);assert.equal(ws.fishing.transactions.at(-1).economyRevision,undefined);
 const saved=structuredClone(ws);assert.deepEqual(Sync.validate(saved).fishing,ws.fishing);assert.equal(F.expedition(ws).spot.valueMultiplier,2.6);
 assert.equal(F.groundProgress(F.read(ws)).filter(s=>s.unlocked).length,6);
});
