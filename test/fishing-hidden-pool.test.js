'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync'),Rod=require('../skins/tracer/fishing-rod-renderer'),FX=require('../skins/tracer/fishing-rod-effects');
function workspace(){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'gold_test',amount:10000,updatedAt:1};return ws;}
function open(ws,ticket=5450,now=10){return F.buyBox(ws,{now,poolId:'basic',random:limit=>limit===10000?ticket:0});}
function catchFish(ws,now){const s=F.beginCast(ws,{seed:0,now}).session;F.stepSession(s,{},900);F.stepSession(s,{release:true},0);assert(F.commitCast(ws,s,now+1).ok);for(let i=0;i<4000&&!['caught','escaped'].includes(s.phase);i++)F.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);assert.equal(s.phase,'caught');return F.recordCatch(ws,s,now+10000).catch;}
test('base pool has exactly one secret and exactly 0.5% hidden tickets at every guarantee boundary',()=>{
  for(const pool of F.catalog.rodPools){assert.equal(pool.rodIds.includes(pool.hiddenRodId),false);assert(F.catalog.rods.find(r=>r.id===pool.hiddenRodId).hidden);assert.equal(Object.values(pool.odds).reduce((n,p)=>n+Math.round(p*10000),0),10000);
    for(const [epic,legendary]of [[0,0],[9,9],[9,39]]){const counts={};for(let ticket=0;ticket<10000;ticket++){const tier=F.poolTier(pool.id,ticket,epic,legendary);counts[tier]=(counts[tier]||0)+1;}assert.equal(counts.hidden,50);if(!epic)assert.deepEqual(counts,pool.id==='valorant'?{legendary:9950,hidden:50}:{common:5450,hidden:50,rare:3000,epic:1200,legendary:300});if(legendary===39)assert.equal(counts.legendary,9950);}
  }
  const ws=workspace(),before=structuredClone(ws);assert.equal(F.buyBox(ws,{poolId:'future'}).reason,'unknown-pool');assert.deepEqual(ws,before);
});
test('hidden discovery, duplicate, guarantee reset, validation and legacy receipts retain identity',()=>{
  const ws=workspace();for(let i=0;i<9;i++)open(ws,0,i+1);assert.equal(F.pity(F.read(ws)).epic,9);assert.equal(open(ws,5499,20).rod.id,'golden');assert.equal(F.read(ws).pity.epic,0);assert.equal(F.read(ws).pity.legendary,0);
  const duplicate=open(ws,5450,21);assert(duplicate.hidden&&duplicate.duplicate);assert.equal(duplicate.compensation,150);assert.deepEqual(S.validate(structuredClone(ws)).fishing,ws.fishing);
  for(const mutate of [s=>s.boxes.at(-1).poolId='missing',s=>s.boxes.at(-1).ticket=5500,s=>delete s.boxes.at(-1).poolId]){const bad=structuredClone(ws.fishing);mutate(bad);assert.throws(()=>F.validate(bad));}
  const old=workspace();open(old,0);delete old.fishing.boxes[0].poolId;const original=structuredClone(old.fishing);assert.deepEqual(F.validate(original),original);open(old,5450);assert.equal(old.fishing.boxes[0].poolId,undefined);assert.equal(old.fishing.boxes[1].poolId,'basic');
});
test('gold catch prices follow the committed rod through switching, backups, batch sales and stale merge',()=>{
  const ws=workspace();open(ws);const normal=catchFish(ws,100);F.equipRod(ws,'golden',11000);const gold=catchFish(ws,12000);F.equipRod(ws,'bamboo',23000);
  const state=F.read(ws),base=F.catalog.fish.find(f=>f.id===normal.fishId).price;assert.equal(F.catchValue(state,normal),base);assert.equal(F.catchValue(state,gold),base*2);
  const backup=S.validate(structuredClone(ws)),stale=structuredClone(backup);assert.equal(F.sellFishBatch(backup,[normal.id,gold.id],24000).earned,base*3);assert.equal(F.sellFishBatch(backup,[normal.id,gold.id],24001).earned,0);
  const tx=backup.fishing.transactions.find(t=>t.refId===gold.id&&t.kind==='sale');assert.equal(tx.multiplier,2);assert.equal(tx.amount,base*2);assert.deepEqual(S.validate(structuredClone(backup)).fishing,backup.fishing);F.preserve(backup,stale);assert.equal(F.catchValue(F.read(stale),gold),base*2);assert.equal(F.economy(stale).balance,F.economy(backup).balance);
  const single=structuredClone(ws);assert.equal(F.sellFish(single,gold.id,24000).earned,base*2);assert.equal(F.sellFish(single,gold.id,24001).earned,0);
  const forged=structuredClone(backup.fishing),sale=forged.transactions.find(t=>t.refId===normal.id);sale.multiplier=2;sale.amount*=2;assert.throws(()=>F.validate(forged),'ordinary casts cannot forge the bonus');
  const underpaid=structuredClone(backup.fishing),t=underpaid.transactions.find(t=>t.refId===gold.id);delete t.multiplier;t.amount/=2;assert.throws(()=>F.validate(underpaid));
});
test('golden mesh is entirely metallic gold and its single coin rises while turning',()=>{
  const mesh=Rod.buildMesh({id:'golden'});assert.equal(mesh.profile.id,'golden');assert(mesh.vertices.every(Number.isFinite));for(let i=0;i<mesh.vertices.length;i+=14){assert(mesh.vertices[i+6]>mesh.vertices[i+7]);assert(mesh.vertices[i+7]>mesh.vertices[i+8]);assert(mesh.vertices[i+10]>.95);}
  const a=FX.coinPose(.2),b=FX.coinPose(.6);assert(b.rise>a.rise);assert(b.angle>a.angle);assert.equal(FX.coinPose(0).alpha,0);assert.equal(FX.coinPose(1).alpha,0);assert.equal(FX.coinPose(.2,true).angle,FX.coinPose(.8,true).angle);
});
