'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync');
const copy=structuredClone;
function workspace(){const ws=M.emptyWorkspace();F.ensure(ws);return ws;}
function bundle(ws,now=1000){
  const {session:s}=F.beginCast(ws,{seed:970000,now});F.stepSession(s,{release:true,heldMs:800},0);F.commitCast(ws,s,now);
  for(let t=0;!['caught','escaped'].includes(s.phase)&&t<60000;t+=16)F.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);
  assert.equal(s.phase,'caught');return F.recordCatch(ws,s,now+20000).catch;
}
function unlock(ws){return F.openMysteryBundle(ws,bundle(ws).id,{now:22000,random:n=>n-1});}
test('motor has exactly one winning ticket out of 100,000, independent of ordinary gift completion',()=>{
  let winners=0;for(let i=0;i<100000;i++)winners+=Number(F.motorTicketWins(i));assert.equal(winners,1);assert.equal(winners/100000*100,.001);
  for(const ticket of [0,99998,99999]){const ws=workspace(),calls=[];const result=F.openMysteryBundle(ws,bundle(ws).id,{random:n=>{calls.push(n);return n===100000?ticket:0;}});assert.equal(result.gift.id==='auto_fishing_motor',ticket===99999);assert.equal(calls[0],100000);assert.equal(result.opening.motorTicket,ticket);}
  const ws=workspace();for(let i=0;i<7;i++)F.openMysteryBundle(ws,bundle(ws,1000+i*30000).id,{now:25000+i*30000,random:()=>0});assert.equal(F.read(ws).giftUnlocks.length,6);assert(!F.progression(ws).achievements.find(a=>a.id==='fortune_child').complete);
});
test('motor reward and achievement survive replay, installation, backup validation and stale merges',()=>{
  const ws=workspace(),result=unlock(ws);assert.equal(result.gift.id,'auto_fishing_motor');const saved=copy(ws);
  assert(F.openMysteryBundle(ws,result.opening.catchId,{random:()=>{throw Error('reroll');}}).alreadyOpened);assert.deepEqual(ws,saved);
  const achievement=F.progression(ws).achievements.find(a=>a.id==='fortune_child');assert.equal(achievement.name[0],'气运之子');assert.equal(achievement.description[0],'抽到概率0.001%的自动钓鱼马达');assert(achievement.complete);
  assert(F.installMotor(ws,true,23000).ok);assert(F.read(ws).motorInstallation.installed);assert.deepEqual(S.validate(copy(ws)).fishing,ws.fishing);
  const stale=copy(ws);F.installMotor(ws,false,24000);F.preserve(ws,stale);assert.equal(F.read(stale).motorInstallation.installed,false);
  assert.deepEqual(F.merge(saved.fishing,ws.fishing,stale.fishing),F.merge(saved.fishing,stale.fishing,ws.fishing));
});
test('motor installation and drop receipts reject unearned or forged state',()=>{
  const ws=workspace();assert.equal(F.installMotor(ws,true).reason,'motor-not-owned');assert.equal(F.beginCast(ws,{autoMotor:true}).reason,'motor-not-installed');
  const forged=copy(ws.fishing);forged.motorInstallation={installed:true,updatedAt:0};assert.throws(()=>F.validate(forged));
  unlock(ws);F.installMotor(ws,true,24000);
  for(const value of [undefined,0,99998,100000,.1]){const bad=copy(ws.fishing);bad.mysteryOpenings[0].motorTicket=value;assert.throws(()=>F.validate(bad));}
  const ordinary=F.beginCast(ws,{seed:0}).session;assert.throws(()=>F.stepAutoSession(ordinary,16));ordinary.automatic=true;assert.throws(()=>F.stepAutoSession(ordinary,16));
});
test('motor controls real bite and reeling physics and catches once without bypassing bait receipts',()=>{
  const ws=workspace();unlock(ws);F.installMotor(ws,true,24000);
  for(const dt of [16,32,1000]){
    const before=F.read(ws),{session:s}=F.beginCast(ws,{seed:0,autoMotor:true});F.stepSession(s,{release:true,heldMs:650},0);assert(F.commitCast(ws,s).ok);
    const phases=new Set();for(let t=0;!['caught','escaped'].includes(s.phase)&&t<60000;t+=dt){phases.add(s.phase);F.stepAutoSession(s,dt);}assert.equal(s.phase,'caught');assert(phases.has('reeling'));
    assert.equal(F.read(ws).baits.earthworm,before.baits.earthworm-1);const result=F.recordCatch(ws,s);assert(result.ok);assert.equal(F.recordCatch(ws,s).alreadyRecorded,true);assert.equal(F.read(ws).catches.length,before.catches.length+1);
  }
});
test('another client winning the same bundle cannot resurrect a losing motor installation',()=>{
  const base=workspace(),c=bundle(base),a=copy(base),b=copy(base);F.openMysteryBundle(a,c.id,{now:22000,random:n=>n-1});F.installMotor(a,true,23000);F.openMysteryBundle(b,c.id,{now:21001,random:()=>0});
  const merged=F.merge(base.fishing,a.fishing,b.fishing);assert.equal(merged.mysteryOpenings[0].giftId,'tide_crown');assert.equal(merged.motorInstallation,undefined);assert.doesNotThrow(()=>F.validate(merged));
});

test('automatic feedback can land each rarity with the starter rod, including legendary movement',()=>{
  const ws=workspace();unlock(ws);F.installMotor(ws,true);ws.taskGarden.market.testCredit={id:'motor_test',amount:1000,updatedAt:1};
  for(const [fishId,baitId]of [['minnow','worm'],['koi','grain'],['moonfin','stardust'],['dragonkoi','spirit']]){
    assert(F.buyBait(ws,baitId).ok);let seed=0;for(;seed<1000;seed++)if(F.createSession(null,{seed,baitId}).fishId===fishId)break;assert(seed<1000);
    const {session:s}=F.beginCast(ws,{seed,baitId,autoMotor:true});F.stepSession(s,{release:true,heldMs:650},0);assert(F.commitCast(ws,s).ok);
    for(let t=0;t<60000&&!['caught','escaped'].includes(s.phase);t+=1000)F.stepAutoSession(s,1000);
    assert.equal(s.phase,'caught',fishId);assert.equal(F.recordCatch(ws,s).fish.id,fishId);
  }
});
