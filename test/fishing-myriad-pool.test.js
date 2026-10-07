'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync'),Backup=require('../lib/workspace-backup');
const BASIC=['willow','carbon','copper','rosewood','tide','clockwork','frost','jade','moon','phoenix','cloud','astral','dragon','lotus','guandao','katana'];
const MYRIAD=['walnut','porcelain','citrus','amber','vinyl','nautilus','alpine','candlewyrm','thunderdrum','abysswhale','foxfire','lilybell','sandscript','frostwolf','rosevow','inkjudge','butterfly','sunforge','leviathan','eclipse'];
const copy=value=>structuredClone(value);
function workspace(){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'myriad_test',amount:10000,updatedAt:1};return ws;}
function draw(ws,poolId,ticket=0,now=100,index=0){return F.buyBox(ws,{poolId,now,random:limit=>limit===10000?ticket:index});}
function collect(ws,poolId,id,now){
  const pool=F.catalog.rodPools.find(p=>p.id===poolId),rod=F.catalog.rods.find(r=>r.id===id),state=F.read(ws);
  const available=F.catalog.rods.filter(r=>pool.rodIds.includes(r.id)&&r.rarity===rod.rarity),unowned=available.filter(r=>!state.rods.includes(r.id)),choices=unowned.length?unowned:available;
  return draw(ws,poolId,rod.hidden?5450:({common:0,rare:5500,epic:8500,legendary:9700})[rod.rarity],now,rod.hidden?0:choices.findIndex(r=>r.id===id));
}

test('the original collection is permanently closed and the new collection has exactly twenty distinct rewards',()=>{
  const basic=F.catalog.rodPools.find(p=>p.id==='basic'),myriad=F.catalog.rodPools.find(p=>p.id==='myriad');
  assert.deepEqual(basic.rodIds,BASIC);assert.equal(basic.hiddenRodId,'golden');
  assert.deepEqual([...myriad.rodIds,myriad.hiddenRodId],MYRIAD);assert.equal(myriad.hiddenRodId,'eclipse');
  assert.equal(F.catalog.rods.length,38);
  const counts={};for(const id of MYRIAD){const r=F.catalog.rods.find(r=>r.id===id);counts[r.rarity]=(counts[r.rarity]||0)+1;assert(r.barSize<=.38&&r.control<=1.18);assert.equal(r.style,id);}
  assert.deepEqual(counts,{common:3,rare:4,epic:10,legendary:3});
  const membership=F.catalog.rodPools.flatMap(p=>[...p.rodIds,p.hiddenRodId]);assert.equal(new Set(membership).size,37);
  assert.deepEqual([...membership].sort(),F.catalog.rods.filter(r=>r.id!=='bamboo').map(r=>r.id).sort());
  assert.deepEqual(F.catalog.rods.filter(r=>r.hidden).map(r=>r.id),['golden','eclipse']);
  assert.deepEqual(F.catalog.rods.filter(r=>r.saleMultiplier!==undefined).map(r=>[r.id,r.saleMultiplier]),[['golden',2]]);
  assert.equal(fs.readFileSync(require.resolve('../public/fishing-model'),'utf8'),fs.readFileSync(require.resolve('../skins/tracer/fishing-model'),'utf8'));
});

test('each collection keeps exactly fifty secret tickets even on the fortieth guarantee draw',()=>{
  for(const pool of F.catalog.rodPools)for(const [epic,legendary]of [[0,0],[9,9],[9,39],[0,39]]){
    const counts={};for(let ticket=0;ticket<10000;ticket++){const tier=F.poolTier(pool.id,ticket,epic,legendary);counts[tier]=(counts[tier]||0)+1;}
    assert.equal(counts.hidden,50,pool.id+' fixed secret chance');
    if(!epic&&!legendary)assert.deepEqual(counts,{common:5450,hidden:50,rare:3000,epic:1200,legendary:300});
    if(legendary===39)assert.deepEqual(counts,{legendary:9950,hidden:50});
    for(const ticket of [5450,5499])assert.equal(F.poolTier(pool.id,ticket,epic,legendary),'hidden');
  }
});

test('all twenty new rods can be acquired without repetition, restored, equipped and committed to real casts',()=>{
  const ws=workspace();let now=100;
  for(const id of MYRIAD){const result=collect(ws,'myriad',id,now++);assert.equal(result.rod.id,id);assert.equal(result.poolId,'myriad');assert.equal(result.duplicate,false);assert.equal(result.spent,100);}
  const restored=S.validate(copy(ws));assert.deepEqual(F.read(restored).rods,['bamboo',...MYRIAD]);assert.equal(F.economy(restored).balance,8000);
  for(const id of MYRIAD){
    assert(F.equipRod(restored,id,now++).ok);const session=F.beginCast(restored,{seed:0,now:now++}).session;assert.equal(session.rodId,id);
    F.stepSession(session,{},900);F.stepSession(session,{release:true},0);assert(F.commitCast(restored,session,now++).ok);F.stepSession(session,{cancel:true},0);
  }
  assert.equal(F.read(restored).baits.worm,10);assert.deepEqual(restored.fishing.casts.map(c=>c.rodId),MYRIAD);
  const backup=Backup.sign('guest',restored,{},'a'.repeat(64),10000);assert.doesNotThrow(()=>Backup.inspect(backup,'guest','a'.repeat(64)));
  assert.deepEqual(backup.payload.workspace.fishing,restored.fishing);assert.deepEqual(S.validate(copy(restored)).fishing,restored.fishing);
});

test('same-tier protection is scoped to the chosen collection and compensation reaches the ledger once',()=>{
  const ws=workspace(),first=[];
  for(let i=0;i<10;i++){const result=draw(ws,'myriad',8500,100+i);assert(!result.duplicate);first.push(result.rod.id);}
  assert.equal(new Set(first).size,10);assert(first.every(id=>MYRIAD.includes(id)));
  const basic=draw(ws,'basic',8500,111);assert.equal(basic.duplicate,false);assert(BASIC.includes(basic.rod.id));
  const before=F.economy(ws).balance,duplicate=draw(ws,'myriad',8500,112);assert(duplicate.duplicate);assert.equal(duplicate.compensation,75);assert.equal(F.economy(ws).balance,before-25);
  const stale=copy(ws);F.preserve(ws,stale);F.preserve(ws,stale);assert.equal(F.economy(stale).balance,F.economy(ws).balance);
  assert.equal(stale.fishing.transactions.filter(t=>t.kind==='duplicate').length,1);assert.deepEqual(S.validate(copy(stale)).fishing,stale.fishing);
});

test('interleaved collections have independent guarantees and secret discoveries reset only their own counters',()=>{
  const ws=workspace();for(let i=0;i<9;i++)draw(ws,'basic',0,100+i);
  for(let i=0;i<39;i++)draw(ws,'myriad',0,200+i);
  assert.equal(F.pity(F.read(ws),'basic').epicRemaining,1);assert.equal(F.pity(F.read(ws),'basic').legendaryRemaining,31);
  assert.equal(F.pity(F.read(ws),'myriad').legendaryRemaining,1);
  const guaranteed=copy(ws);assert.equal(draw(guaranteed,'myriad',0,300).rod.rarity,'legendary');assert.equal(F.pity(F.read(guaranteed),'myriad').legendaryRemaining,40);
  const secret=draw(ws,'myriad',5499,300);assert.equal(secret.rod.id,'eclipse');assert.equal(F.pity(F.read(ws),'myriad').epicRemaining,10);assert.equal(F.pity(F.read(ws),'myriad').legendaryRemaining,40);
  assert.equal(F.pity(F.read(ws),'basic').epicRemaining,1);assert.equal(draw(ws,'basic',0,301).rod.rarity,'epic');
  const again=draw(ws,'myriad',5450,302);assert(again.hidden&&again.duplicate);assert.equal(again.compensation,150);
});

test('old ticket semantics and signed payloads remain exact after the catalog expansion',()=>{
  const fixture=copy(require('./fixtures/fishing-legacy-cabin.json')),signed=fixture.signedBackup,before=JSON.stringify(signed);
  assert.doesNotThrow(()=>Backup.inspect(signed,'guest','a'.repeat(64)));assert.equal(JSON.stringify(signed),before);
  assert.deepEqual(F.validate(fixture.workspace.fishing),fixture.workspace.fishing);
  const ws=workspace();draw(ws,'basic',0,100);delete ws.fishing.boxes[0].poolId;ws.fishing.boxes[0].ticket=5475;
  const historical=copy(ws.fishing);assert.deepEqual(F.validate(historical),historical,'legacy 5475 is common, not a secret');
  const nowSecret=draw(ws,'basic',5475,101);assert.equal(nowSecret.rod.id,'golden');assert.equal(ws.fishing.boxes[0].poolId,undefined);
  collect(ws,'myriad','walnut',102);assert.deepEqual(ws.fishing.boxes[0],historical.boxes[0]);assert.deepEqual(S.validate(copy(ws)).fishing,ws.fishing);
});

test('pool substitution, hidden substitution and stripped new-pool receipts cannot invent rewards',()=>{
  const ws=workspace();collect(ws,'myriad','walnut',100);const raw=ws.fishing;
  for(const mutate of [s=>s.boxes[0].poolId='basic',s=>delete s.boxes[0].poolId,s=>s.boxes[0].poolId='missing',s=>s.boxes[0].rodId='willow',s=>s.boxes[0].ticket=5450]){
    const bad=copy(raw);mutate(bad);assert.throws(()=>F.validate(bad),/Invalid fishing state/);
  }
  const hidden=workspace();collect(hidden,'myriad','eclipse',101);
  for(const mutate of [s=>s.boxes[0].rodId='golden',s=>s.boxes[0].ticket=9700,s=>delete s.boxes[0].poolId]){const bad=copy(hidden.fishing);mutate(bad);assert.throws(()=>F.validate(bad));}
  const before=copy(ws);assert.deepEqual(F.buyBox(ws,{poolId:'unreleased'}),{ok:false,reason:'unknown-pool'});assert.deepEqual(ws,before);
});

test('draws from different pools merge without moving pity or changing historical receipt identity',()=>{
  const base=workspace();draw(base,'basic',0,100);const local=copy(base),remote=copy(base);
  collect(local,'myriad','candlewyrm',200);collect(remote,'basic','moon',201);
  const merged={...copy(base),fishing:F.merge(base.fishing,local.fishing,remote.fishing)};F.ensure(merged);
  assert(F.read(merged).rods.includes('candlewyrm'));assert(F.read(merged).rods.includes('moon'));assert.equal(F.economy(merged).balance,9700);
  assert.deepEqual(merged.fishing.boxes[0],base.fishing.boxes[0]);assert.equal(F.pity(F.read(merged),'basic').legendary,2);assert.equal(F.pity(F.read(merged),'myriad').legendary,1);
  const again=F.merge(base.fishing,merged.fishing,remote.fishing);assert.deepEqual(again,merged.fishing);
  assert.deepEqual(S.validate(copy(merged)).fishing,merged.fishing);
});

test('the new secret keeps normal catch value and cannot forge the golden fishing bonus',()=>{
  const ws=workspace();collect(ws,'myriad','eclipse',100);F.equipRod(ws,'eclipse',101);
  const session=F.beginCast(ws,{seed:0,now:102}).session;F.stepSession(session,{},900);F.stepSession(session,{release:true},0);assert(F.commitCast(ws,session,103).ok);
  for(let i=0;i<6000&&!['caught','escaped'].includes(session.phase);i++)F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);
  assert.equal(session.phase,'caught');const caught=F.recordCatch(ws,session,10000);assert(caught.ok);
  const price=F.catalog.fish.find(f=>f.id===caught.catch.fishId).price;assert.equal(F.catchValue(F.read(ws),caught.catch),price);assert.equal(F.sellFish(ws,caught.catch.id,10001).earned,price);
  const bad=copy(ws.fishing),sale=bad.transactions.find(t=>t.kind==='sale');sale.multiplier=2;sale.amount*=2;assert.throws(()=>F.validate(bad));
});
