'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model');
const ws=()=>{const w=M.emptyWorkspace();F.ensure(w);w.taskGarden.market.testCredit={id:'valorant_credit',amount:100000,updatedAt:1};return w;};
function spike(w){const result=F.buyBox(w,{poolId:'valorant',now:2,random:n=>n===10000?9999:0});assert.equal(result.rod.id,'valorant_spike');F.equipRod(w,'valorant_spike',3);}
function blast(w,seed,spotId='creek'){
  const start=F.beginCast(w,{now:10+seed,seed,expedition:{spotId,timeId:'day',weatherId:'clear'}});assert(start.ok);const s=start.session;
  F.stepSession(s,{release:true},850);assert.equal(s.phase,'cast');assert(F.commitCast(w,s,900+seed).ok);
  F.stepSession(s,{},660);assert.equal(s.phase,'waiting');F.stepSession(s,{hook:true},100);assert.equal(s.phase,'waiting');
  F.stepSession(s,{},3800);assert.equal(s.phase,'detonating');assert.equal(F.recordCatch(w,s,5000+seed).ok,false);
  F.stepSession(s,{},1000);assert.equal(s.phase,'caught');return{s,result:F.recordCatch(w,s,6000+seed)};
}
test('VALORANT includes every authored agent, all legendary, plus one hidden Spike; single and ten draw charge pool price',()=>{
  const pool=F.catalog.rodPools.find(p=>p.id==='valorant'),agents=require('../dev/fishing-valorant-data.cjs').agents;
  assert.equal(pool.rodIds.length,agents.length);assert.equal(agents.length,29);assert.equal(pool.hiddenRodId,'valorant_spike');
  assert(pool.rodIds.every(id=>F.catalog.rods.find(r=>r.id===id).rarity==='legendary'));assert.equal(F.boxPrice('valorant'),500);assert.equal(F.boxPrice('naruto'),100);
  const w=ws(),before=F.economy(w).balance,r=F.buyBoxes(w,{poolId:'valorant',now:2,random:()=>0});assert(r.ok);assert.equal(r.spent,5000);assert.equal(F.economy(w).balance,before-5000);assert.equal(new Set(r.results.map(r=>r.rod.id)).size,10);assert.doesNotThrow(()=>F.validate(w.fishing));
  const forged=structuredClone(w.fishing);forged.transactions[0].amount=-100;assert.throws(()=>F.validate(forged));
});
test('Spike automatically detonates, catches 3–5 pond fish with individual fixed values, never grants fry, and retries once',()=>{
  const counts=new Set(),percents=new Set();
  for(let seed=0;seed<42;seed++){
    const w=ws();spike(w);const{s,result}=blast(w,seed);assert(result.ok);counts.add(result.count);assert.equal(result.fry,null);assert.deepEqual(result.fryRows,[]);assert.equal(w.fishing.fry.length,0);
    const pondIds=F.expedition(w).fish.map(f=>f.id);assert(result.catches.every(c=>pondIds.includes(c.fishId)));
    for(const c of result.catches){assert(c.blastPercent>=50&&c.blastPercent<=150);percents.add(c.blastPercent);const fish=F.catalog.fish.find(f=>f.id===c.fishId);assert.equal(F.catchValue(F.read(w),c),Math.max(1,Math.round(fish.price*c.blastPercent/100)));}
    assert.equal(F.recordCatch(w,s,9999).alreadyRecorded,true);assert.equal(w.fishing.catches.length,result.count);
    const expected=result.catches.reduce((n,c)=>n+F.catchValue(F.read(w),c),0),sold=F.sellFishBatch(w,result.catches.map(c=>c.id),10000);assert.equal(sold.earned,expected);assert.equal(F.sellFishBatch(w,result.catches.map(c=>c.id),10001).earned,0);assert.doesNotThrow(()=>F.validate(w.fishing));
  }
  assert.deepEqual([...counts].sort(),[3,4,5]);assert(percents.size>60);
});
test('Spike validation rejects rewritten value, forbidden fry, and changed pond catches',()=>{
  const w=ws();spike(w);blast(w,18);
  const price=structuredClone(w.fishing);price.catches[0].blastPercent=price.catches[0].blastPercent===50?51:50;assert.throws(()=>F.validate(price));
  const count=structuredClone(w.fishing);count.casts[0].haulCount=2;assert.throws(()=>F.validate(count));
  const rules=structuredClone(w.fishing);rules.casts[0].rules=5;assert.throws(()=>F.validate(rules));
  const fry=structuredClone(w.fishing),c=fry.catches.find(c=>F.catalog.fish.find(f=>f.id===c.fishId).fry);if(c){fry.fry.push({id:'bad_fry',catchId:c.id,fishId:c.fishId,pondId:null,createdAt:c.caughtAt,updatedAt:c.caughtAt,growth:0,fedAt:null,releasedAt:null});assert.throws(()=>F.validate(fry));}
});
test('agent technique choice is stable through a cast and can reach both canon abilities; idle/reeling remain quiet',()=>{
  const V=require('../skins/tracer/fishing-valorant-vfx');for(const[id,list]of Object.entries(V.skills)){assert.equal(list.length,2);const choices=new Set(Array.from({length:32},(_,seed)=>V.technique(id,seed)));assert.equal(choices.size,2);assert.equal(V.visible('reeling',10,id),false);assert.equal(V.visible('idle',10,id),false);for(const s of list)assert(V.specs[s].src.includes('valorant'));}
  assert(V.visible('waiting',3700,'valorant_spike'));assert(V.visible('detonating',900,'valorant_spike'));assert.equal(V.visible('caught',0,'valorant_spike'),false);
});
