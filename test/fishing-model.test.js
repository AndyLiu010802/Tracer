'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const F=require('../public/fishing-model'),G=require('../public/task-garden'),S=require('../public/workspace-sync'),M=require('../skins/tracer/model'),Store=require('../lib/store');
const clone=value=>structuredClone(value);
function workspace(credit=10000){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'fishing_test',amount:credit,updatedAt:1};return ws;}
const seedCache=new Map();function seedFor(fishId,baitId){const key=fishId+'|'+baitId;if(seedCache.has(key))return seedCache.get(key);for(let seed=0;seed<10000;seed++){if(F.createSession(F.empty(),{seed,baitId,now:1}).fishId===fishId){seedCache.set(key,seed);return seed;}}throw new Error('Missing fish pool '+fishId);}
function reel(session){F.stepSession(session,{},900);F.stepSession(session,{release:true},0);for(let frame=0;frame<4000&&!['caught','escaped'].includes(session.phase);frame++)F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);return session;}
function catchFish(ws,fishId,baitId,now=1000){if(F.read(ws).baits[baitId]<1)assert.equal(F.buyBait(ws,baitId,1,now).ok,true);assert.equal(F.equipBait(ws,baitId,now).ok,true);const session=F.beginCast(ws,{seed:seedFor(fishId,baitId),now}).session;F.stepSession(session,{},900);F.stepSession(session,{release:true},0);assert.equal(F.commitCast(ws,session,now+1).ok,true);for(let frame=0;frame<4000&&!['caught','escaped'].includes(session.phase);frame++)F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);assert.equal(session.phase,'caught',fishId);return F.recordCatch(ws,session,now+10000);}
function waitingSession(options={},charge=900){const s=F.createSession(F.empty(),{seed:0,now:1,...options});F.stepSession(s,{},charge);F.stepSession(s,{release:true},0);F.stepSession(s,{},650);assert.equal(s.phase,'waiting');return s;}
function biteSession(options={}){const s=waitingSession(options);F.stepSession(s,{},s.waitDuration);assert.equal(s.phase,'bite');return s;}

test('aquarium decorations are free, bounded, persistent and independent of selected fish',()=>{
  const ws=workspace(),before=clone(ws);assert.equal(F.catalog.aquariumDecorations.length,12);
  assert.equal(F.read(ws).showcase.decorationIds,undefined);assert.deepEqual(ws,before);
  const ids=['pearl_shell','jade_arch','sunken_chest'];assert.equal(F.setShowcase(ws,{decorationIds:ids},20).ok,true);ids.length=0;
  assert.deepEqual(F.showcase(ws).selection,{fishIds:[],decorationIds:['pearl_shell','jade_arch','sunken_chest']});
  assert.equal(F.economy(ws).balance,F.economy(before).balance);assert.deepEqual(ws.fishing.transactions,before.fishing.transactions);
  assert.deepEqual(F.validate(ws.fishing),ws.fishing);assert.deepEqual(S.validate(clone(ws)).fishing,ws.fishing);
  const valid=clone(ws);for(const decorationIds of [null,'jade_arch',new Array(1),['missing'],['jade_arch','jade_arch'],F.catalog.aquariumDecorations.slice(0,4).map(x=>x.id)]){
    assert.equal(F.setShowcase(ws,{decorationIds},30).reason,'invalid-showcase');assert.deepEqual(ws,valid);
    assert.throws(()=>F.validate({...ws.fishing,showcase:{...ws.fishing.showcase,decorationIds}}));
  }
  assert.equal(F.setShowcase(ws,{fishIds:[]},31).changed,false);
  const stale=clone(ws);F.setShowcase(ws,{decorationIds:[]},32);F.equipBait(stale,'worm',40);F.preserve(ws,stale);
  assert.deepEqual(F.showcase(stale).selection.decorationIds,[],'removed decorations stay removed after an unrelated stale write');
});

test('only real legendary fry can live in the aquarium, move from old ponds and return without loss',()=>{
  const ws=workspace();catchFish(ws,'koi','grain');for(const [i,id]of ['gulpuffer','grumpangler','flopray','snagglefin'].entries())catchFish(ws,id,id==='grumpangler'?'spirit':id==='flopray'?'glow':'stardust',12000+i*12000);
  const state=F.read(ws),legends=state.fry.filter(f=>f.fishId!=='koi'),koi=state.fry.find(f=>f.fishId==='koi'),before=clone(ws);
  assert.deepEqual(F.aquarium(ws).fish,[],'journal discoveries do not create aquarium residents');
  assert.equal(F.placeAquariumFish(ws,koi.id,true,60000).reason,'showcase-not-legendary');assert.deepEqual(ws,before);
  assert.equal(F.placeFry(ws,legends[0].id,state.activePondId,60000).ok,true);
  for(const f of legends.slice(0,3))assert.equal(F.placeAquariumFish(ws,f.id,true,61000).ok,true);
  assert.equal(F.read(ws).fry.find(f=>f.id===legends[0].id).pondId,null);assert.equal(F.read(ws).ponds[0].fishIds.length,0);
  assert.deepEqual(F.aquarium(ws).selection.fryIds,legends.slice(0,3).map(f=>f.id));assert.equal(F.aquarium(ws).fish[0].speciesId,legends[0].fishId);
  const full=clone(ws);assert.equal(F.placeAquariumFish(ws,legends[3].id,true,62000).reason,'aquarium-full');assert.deepEqual(ws,full);
  assert.equal(F.placeFry(ws,legends[0].id,state.activePondId,62000).reason,'fish-in-aquarium');assert.deepEqual(ws,full);
  const balance=F.economy(ws).balance;assert.equal(F.feedAquarium(ws,63000).fed,3);assert.equal(F.economy(ws).balance,balance-5);assert.equal(F.feedAquarium(ws,63001).reason,'no-hungry-fish');
  const old=clone(ws),resident=clone(F.read(ws).fry.find(f=>f.id===legends[0].id));assert.equal(F.placeAquariumFish(ws,legends[0].id,false,64000).ok,true);assert.deepEqual(F.read(ws).fry.find(f=>f.id===resident.id),resident,'taking out retains the actual fish and growth');
  F.equipBait(old,'worm',65000);F.preserve(ws,old);assert.deepEqual(F.aquarium(old).selection.fryIds,legends.slice(1,3).map(f=>f.id));
  assert.equal(F.placeAquariumFish(ws,legends[3].id,true,65001).ok,true);assert.equal(F.read(ws).fry.length,state.fry.length);
  const restored=S.validate(clone(ws));assert.deepEqual(F.aquarium(restored),F.aquarium(ws));
  assert.equal(F.releaseFish(ws,legends[1].id,65002).ok,true);assert.equal(F.aquarium(ws).fish.length,2);assert.doesNotThrow(()=>F.validate(ws.fishing));
});

test('browser model mirror and complete free starter kit stay identical',()=>{assert.equal(fs.readFileSync(require.resolve('../public/fishing-model'),'utf8'),fs.readFileSync(require.resolve('../skins/tracer/fishing-model'),'utf8'));const ws=workspace(0),state=F.read(ws);assert.deepEqual(state.rods,['bamboo']);assert.equal(state.baits.worm,30);assert.equal(state.ponds.length,1);assert.equal(state.activePondId,'pond_starter');assert.equal(F.economy(ws).balance,0);assert.ok(F.catalog.rods.length>=12);assert.equal(F.catalog.fish.length,156);assert.ok(F.catalog.pondStyles.every(p=>p.price===0));assert.equal(F.buyPond,undefined);assert.equal(new Set(F.catalog.fish.map(f=>f.feedingReaction.description[0])).size,F.catalog.fish.length);});

test('published 55/30/12/3 odds and both guarantees derive from receipts',()=>{const counts={common:0,rare:0,epic:0,legendary:0};for(let i=0;i<10000;i++)counts[F.boxRarity(i,0,0)]++;assert.deepEqual(counts,{common:5500,rare:3000,epic:1200,legendary:300});const ws=workspace();for(let i=1;i<=40;i++){const result=F.buyBox(ws,{now:100+i,random:()=>0});assert.equal(result.ok,true);assert.equal(result.rod.rarity,i===40?'legendary':i%10===0?'epic':'common');}assert.equal(F.read(ws).pity.legendary,0);assert.equal(F.read(ws).pity.epic,0);});

test('glaive and katana rods can be collected, saved, equipped and used for a cast',()=>{
  const ws=workspace(300);
  for(const [id,ticket]of [['guandao',9999],['katana',9000]]){
    const rod=F.catalog.rods.find(rod=>rod.id===id),pool=F.catalog.rods.filter(item=>item.rarity===rod.rarity&&item.id!=='bamboo');
    const result=F.buyBox(ws,{random:limit=>limit===10000?ticket:pool.findIndex(item=>item.id===id)});
    assert.equal(result.rod.id,id);assert.equal(F.equipRod(ws,id).ok,true);
    const restored=S.validate(clone(ws));assert.equal(F.read(restored).equippedRodId,id);
    const session=F.beginCast(restored,{seed:0}).session;assert.equal(session.rodId,id);
    F.stepSession(session,{},900);F.stepSession(session,{release:true},0);
    assert.equal(F.commitCast(restored,session).ok,true);assert.equal(F.read(restored).baits.worm,29);
  }
  assert.equal(F.economy(ws).balance,100);
});

test('unowned rods are preferred within the rolled tier, then duplicates compensate once through the shared wallet',()=>{
  const ws=workspace(900),firstFour=[];
  for(let i=0;i<7;i++){const result=F.buyBox(ws,{now:100+i,random:()=>0});assert.equal(result.duplicate,false);firstFour.push(result.rod.id);}
  assert.equal(new Set(firstFour).size,7);const duplicate=F.buyBox(ws,{now:107,random:()=>0});assert.equal(duplicate.duplicate,true);assert.equal(duplicate.compensation,20);
  assert.equal(G.economy(ws).balance,120);assert.equal(F.buyBait(ws,'spirit',1,108).ok,true);assert.equal(G.economy(ws).balance,45);
  const before=JSON.stringify(ws);assert.equal(F.buyBox(ws).reason,'insufficient-coins');assert.equal(F.buyBait(ws,'spirit',1).reason,'insufficient-coins');assert.equal(JSON.stringify(ws),before);
  const raw=clone(ws.fishing.transactions);raw.find(t=>t.kind==='duplicate').quantity=100;assert.throws(()=>F.validateTransactions(raw));
});

test('retired cabin APIs are absent while historical purchases retain their price and saved identity',()=>{
  const ws=clone(require('./fixtures/fishing-legacy-cabin.json').workspace),before=clone(ws),receipt=ws.fishing.transactions[0];
  for(const key of ['buyCabin','equipCabin'])assert.equal(Object.hasOwn(F,key),false);
  assert.equal(Object.hasOwn(F.catalog,'cabins'),false);assert.equal(Object.hasOwn(F.read(ws),'ownedCabinIds'),false);
  assert.deepEqual(F.validate(ws.fishing),before.fishing);assert.deepEqual(S.validate(clone(ws)).fishing,before.fishing);assert.deepEqual(ws,before);
  assert.equal(F.read(ws).equippedCabinId,'cottage');assert.equal(F.economy(ws).balance,2820);
  for(const [itemId,price]of [['cottage',180],['harbor',260],['observatory',420],['pavilion',560]]){
    const raw={...receipt,itemId,amount:-price};assert.deepEqual(F.validateTransactions([raw]),[raw]);
    for(const amount of [0,-price+1,price])assert.throws(()=>F.validateTransactions([{...raw,amount}]),/Invalid fishing state/);
  }
  for(const itemId of ['wood','missing'])assert.throws(()=>F.validateTransactions([{...receipt,itemId}]),/Invalid fishing state/);
  const invalid=clone(ws.fishing);invalid.equippedCabinId='pavilion';assert.throws(()=>F.validate(invalid),/Invalid fishing state/);
  assert.equal(F.buyBait(ws,'grain',1,100).ok,true);assert.equal(F.equipBait(ws,'grain',101).ok,true);
  assert.equal(ws.fishing.equippedCabinId,'cottage');assert.deepEqual(ws.fishing.transactions[0],receipt);
  const stale=clone(before);F.preserve(ws,stale);assert.equal(stale.fishing.equippedCabinId,'cottage');assert.equal(stale.fishing.transactions.filter(t=>t.kind==='cabin').length,1);
});

test('all catalogue species remain catchable with every ordinary rod, including three bamboo seeds',()=>{
  for(const fish of F.catalog.fish){
    const bait=F.catalog.legacyBaits.find(b=>b.fishIds.includes(fish.id)),weights={common:60,rare:20,epic:7,legendary:2};
    const period=bait.fishIds.reduce((sum,id)=>sum+weights[F.catalog.fish.find(f=>f.id===id).rarity],0);
    for(const rod of F.catalog.rods.filter(r=>r.family==='real'))for(const offset of rod.id==='bamboo'?[0,1,3]:[0]){
      const s=F.createSession(F.empty(),{seed:seedFor(fish.id,bait.id)+offset*period,baitId:bait.id,rodId:rod.id,now:1});
      assert.equal(s.fishId,fish.id);reel(s);assert.equal(s.phase,'caught',rod.id+' / '+fish.id);assert.equal(s.stamina,0);
    }
  }
  const dragon=F.createSession(F.empty(),{baitId:'spirit',seed:87,now:1});reel(dragon);assert.equal(dragon.phase,'caught');
});

test('bait commits once on cast, charging cancellation consumes none, and a missed bite has no reward',()=>{const ws=workspace(),cancelled=F.beginCast(ws,{now:100,seed:0}).session;F.stepSession(cancelled,{cancel:true},16);assert.equal(F.commitCast(ws,cancelled).ok,false);assert.equal(F.read(ws).baits.worm,30);const s=F.beginCast(ws,{now:200,seed:0}).session;F.stepSession(s,{},900);F.stepSession(s,{release:true},0);assert.equal(F.commitCast(ws,s,201).changed,true);assert.equal(F.commitCast(ws,s,202).changed,false);assert.equal(F.read(ws).baits.worm,29);for(let i=0;i<15;i++)F.stepSession(s,{},1000);assert.equal(s.phase,'escaped');assert.equal(F.recordCatch(ws,s).ok,false);assert.equal(F.read(ws).catches.length,0);});

test('bite deadlines use all elapsed time and resolve expiry before a late hook input',()=>{
  const bite=biteSession;
  const timely=bite();F.stepSession(timely,{hook:true},1699);assert.equal(timely.phase,'reeling');
  for(const delay of [1700,1701,3000,60000]){const late=bite();F.stepSession(late,{hook:true},delay);assert.equal(late.phase,'escaped');assert.equal(late.reason,'missed-bite');}
  const ignored=bite();F.stepSession(ignored,{},3000);assert.equal(ignored.phase,'escaped');assert.equal(ignored.reason,'missed-bite');
});

test('cast strength changes the actual distance and waiting time while preserving the selected bait pool',()=>{
  const short=waitingSession({seed:9},200),far=waitingSession({seed:9},1100);
  assert(short.castDistance>=0&&short.castDistance<far.castDistance);assert.equal(far.castDistance,1);
  assert(short.waitDuration>far.waitDuration);assert.equal(short.waitDuration,Math.round(2650+9-short.castDistance*1100));
  assert.equal(short.fishId,far.fishId);F.stepSession(far,{},far.waitDuration);F.stepSession(short,{},far.waitDuration);
  assert.equal(far.phase,'bite');assert.equal(short.phase,'waiting');assert.equal(far.biteRemaining,1700);
  F.stepSession(far,{},500);assert.equal(far.biteRemaining,1200);
});

test('one or two tentative nibbles never open the real bite window',()=>{
  for(const seed of [0,1]){
    const s=waitingSession({seed});let cues=0,previous=false;
    while(s.phase==='waiting'){F.stepSession(s,{},16);const cue=s.nibble>0;if(cue&&!previous)cues++;if(cue){assert.equal(s.phase,'waiting');assert.equal(s.biteRemaining,0);}assert(s.nibble>=0&&s.nibble<=1);previous=cue;}
    assert.equal(cues,1+seed%2);assert.equal(s.phase,'bite');assert.equal(s.nibble,0);assert.equal(s.biteWindow,1700);assert(s.biteRemaining>1600);
  }
});

test('hooking on a nibble or before it loses the cast with one consumed bait and no reward',()=>{
  for(const onNibble of [false,true]){
    const ws=workspace(),s=F.beginCast(ws,{seed:1,now:1}).session;
    F.stepSession(s,{},900);F.stepSession(s,{release:true},0);assert.equal(F.commitCast(ws,s,2).ok,true);F.stepSession(s,{},650);
    if(onNibble){F.stepSession(s,{},s.waitDuration*.34);assert(s.nibble>.99);}
    F.stepSession(s,{hook:true},0);assert.equal(s.phase,'escaped');assert.equal(s.reason,'early-hook');
    assert.equal(s.nibble,0);assert.equal(F.read(ws).baits.worm,29);assert.equal(F.recordCatch(ws,s).ok,false);assert.equal(F.read(ws).catches.length,0);
    assert.equal(F.read(ws).casts.length,1);assert(!Object.keys(ws.fishing.casts[0]).some(key=>['stamina','nibble','castDistance'].includes(key)),'gameplay fields do not alter receipt schema');
  }
});

test('fish surge and recover before an actual exhausted catch; blindly holding never wins',()=>{
  const s=biteSession({baitId:'spirit',seed:87});F.stepSession(s,{hook:true},0);const behaviors=new Set(),started=s.elapsed;
  while(s.phase==='reeling'){F.stepSession(s,{holding:s.fishPosition>s.barPosition},16);behaviors.add(s.fishBehavior);assert(s.stamina>=0&&s.stamina<=1);assert(s.tension>=0&&s.tension<=1);}
  assert.equal(s.phase,'caught');assert.equal(s.stamina,0);assert.deepEqual([...behaviors],['cruise','surge','rest']);assert(s.elapsed-started<45000);
  for(const options of [{seed:0},{baitId:'spirit',seed:87}]){const held=biteSession(options);F.stepSession(held,{hook:true},0);while(held.phase==='reeling')F.stepSession(held,{holding:true},16);assert.equal(held.phase,'escaped');}
});

test('pulling outside the tracking zone loads the line, while releasing trades progress for lower tension',()=>{
  const s=biteSession();F.stepSession(s,{hook:true},0);F.stepSession(s,{holding:true},2500);
  assert.equal(s.phase,'reeling');assert(s.tension>.5);const before={tension:s.tension,progress:s.progress};
  F.stepSession(s,{holding:false},240);assert.equal(s.phase,'reeling');assert(s.tension<before.tension);assert(s.progress<before.progress);
});

test('fabricated phase and copied sessions cannot grant fish; real catches never replay',()=>{const ws=workspace(),s=F.beginCast(ws,{seed:0,now:100}).session;s.phase='caught';assert.equal(F.recordCatch(ws,s).ok,false);assert.equal(F.recordCatch(ws,{...s}).ok,false);F.stepSession(s,{},900);F.stepSession(s,{release:true},0);F.commitCast(ws,s,101);while(!['caught','escaped'].includes(s.phase))F.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);const caught=F.recordCatch(ws,s,10000);assert.equal(caught.ok,true);assert.equal(F.recordCatch(ws,s,10001).alreadyRecorded,true);assert.equal(F.read(ws).catches.length,1);assert.equal(F.sellFish(ws,caught.catch.id,10002).earned,F.catalog.fish.find(f=>f.id===caught.catch.fishId).price);assert.equal(F.sellFish(ws,caught.catch.id,10003).earned,0);});

test('rarer fish always receive fry; ordinary catches and sales stay distinct',()=>{const ws=workspace();const ordinary=catchFish(ws,'carp','grain',1000),rare=catchFish(ws,'koi','grain',12000),epic=catchFish(ws,'moonfin','stardust',23000),legendary=catchFish(ws,'dragonkoi','spirit',34000);assert.equal(ordinary.fry,null);for(const c of [rare,epic,legendary]){assert.equal(c.fry.fishId,c.catch.fishId);assert.equal(c.fry.releasedAt,null);}F.sellFish(ws,rare.catch.id,45000);assert.equal(F.read(ws).fry.length,3);});

test('batch fish sales preserve fry, aquarium residents and discoveries and never pay twice',()=>{
  const ws=workspace(),catches=[catchFish(ws,'carp','grain',1000),catchFish(ws,'dragonkoi','spirit',12000),catchFish(ws,'koi','grain',23000)];
  F.placeAquariumFish(ws,catches[1].fry.id,true,34000);F.feedAquarium(ws,35000);const before=clone(ws),balance=F.economy(ws).balance,ids=catches.map(c=>c.catch.id),earned=catches.reduce((sum,c)=>sum+c.fish.price,0);
  assert.deepEqual(F.sellFishBatch(ws,ids,36000),{ok:true,sold:3,earned});const after=clone(ws);
  assert.equal(F.economy(ws).balance,balance+earned);assert.deepEqual(ws.fishing.fry,before.fishing.fry);assert.deepEqual(ws.fishing.aquarium,before.fishing.aquarium);assert.deepEqual(F.aquarium(ws),F.aquarium(before));assert.deepEqual(S.validate(clone(ws)).fishing,ws.fishing);
  assert.deepEqual(F.sellFishBatch(ws,ids,37000),{ok:true,sold:0,earned:0,alreadySold:true});assert.deepEqual(ws,after);
  const stale=clone(before);F.preserve(ws,stale);assert.ok(stale.fishing.catches.every(c=>c.soldAt!==null));assert.equal(F.economy(stale).balance,F.economy(ws).balance);
});

test('batch fish sales validate every selection before changing stock and ignore display pagination',()=>{
  const ws=workspace();for(let i=0;i<61;i++)catchFish(ws,'minnow','worm',1000+i*11000);const ids=F.read(ws).catches.map(c=>c.id),before=clone(ws);
  for(const selection of [null,'fish',new Array(1),[ids[0],ids[0]],[ids[0],'unknown']]){assert.equal(F.sellFishBatch(ws,selection,800000).ok,false);assert.deepEqual(ws,before);}
  assert.equal(F.sellFishBatch(ws,ids,800000).sold,61);assert.equal(F.read(ws).catches.filter(c=>c.soldAt===null).length,0);assert.equal(F.read(ws).transactions.filter(t=>t.kind==='sale').length,61);
});

function sixFry(ws){return [['koi','grain'],['goldfish','grain'],['seahorse','shrimp'],['lotusfin','spirit'],['moonfin','stardust'],['dragonkoi','spirit']].map(([fish,bait],i)=>catchFish(ws,fish,bait,1000+i*11000).fry.id);}
test('four odd legends can be caught, raised, fed and sold across a saved workspace',()=>{
  const ws=workspace(),species=[['gulpuffer','stardust'],['grumpangler','spirit'],['flopray','glow'],['snagglefin','stardust']];
  const catches=species.map(([id,bait],i)=>catchFish(ws,id,bait,1000+i*11000));
  for(const result of catches){assert.equal(result.fish.rarity,'legendary');assert.equal(result.fry.fishId,result.catch.fishId);assert.equal(F.placeFry(ws,result.fry.id,'pond_starter',50000).ok,true);}
  const restored=S.validate(clone(ws)),fed=F.feedPond(restored,'pond_starter',60000);
  assert.equal(fed.ok,true);assert.deepEqual(new Set(fed.reactions.map(r=>r.fishId)),new Set(species.map(([id])=>id)));
  for(const result of catches){assert.equal(F.sellFish(restored,result.catch.id,60001).earned,result.fish.price);assert.equal(F.sellFish(restored,result.catch.id,60002).earned,0);}
  const saved=S.validate(clone(restored)),state=F.read(saved);
  assert.equal(state.catches.filter(c=>c.soldAt!==null).length,4);assert.equal(state.ponds[0].fishIds.length,4);assert.ok(state.fry.every(f=>f.growth===20&&f.fedAt===60000));
});
test('pond capacity and old collection receipts remain compatible while residents can now move',()=>{const ws=workspace(),fry=sixFry(ws),initial=F.economy(ws).balance;assert.equal(F.selectPondStyle(ws,'pond_starter','cloud',90000).spent,0);assert.equal(F.economy(ws).balance,initial);assert.equal(F.archivePond(ws,'pond_starter',90001).reason,'requires-five-fish');for(const id of fry.slice(0,5))assert.equal(F.placeFry(ws,id,'pond_starter',90002).ok,true);assert.equal(F.placeFry(ws,fry[5],'pond_starter',90003).reason,'pond-full');assert.equal(F.releaseFish(ws,fry[0],90004).ok,true);assert.equal(F.placeFry(ws,fry[0],'pond_starter',90005).reason,'fish-released');assert.equal(F.placeFry(ws,fry[5],'pond_starter',90006).ok,true);const archived=F.archivePond(ws,'pond_starter',90007);assert.equal(archived.ok,true);assert.equal(archived.spent,0);assert.equal(F.economy(ws).balance,initial);const state=F.read(ws);assert.equal(state.ponds.length,2);assert.equal(state.ponds.filter(p=>p.archivedAt===null).length,1);assert.equal(state.ponds[0].fishIds.length,5);assert.equal(state.activePondId,archived.activePondId);assert.equal(F.moveFish(ws,fry[1],archived.activePondId).ok,true);assert.equal(F.releaseFish(ws,fry[1]).ok,true);assert.equal(F.archivePond(ws,'pond_starter').alreadyArchived,true);});

test('archived fish respond individually and continue feeding at full growth forever with cooldown',()=>{const ws=workspace(),fry=sixFry(ws);for(const id of fry.slice(0,5))F.placeFry(ws,id,'pond_starter',90000);F.archivePond(ws,'pond_starter',90001);for(let i=0;i<6;i++){const result=F.feedPond(ws,'pond_starter',100000+i*60000);assert.equal(result.ok,true);assert.equal(result.fed,5);assert.equal(result.fishIds.length,5);assert.equal(new Set(result.reactions.map(r=>r.reaction.id)).size,5);if(i===0)assert.equal(F.feedPond(ws,'pond_starter',100001).reason,'no-hungry-fish');}assert.ok(F.read(ws).fry.filter(f=>f.pondId==='pond_starter').every(f=>f.growth===100));assert.equal(F.feedPond(ws,'pond_starter',460000).ok,true);});

test('released tombstones and sealed pond membership survive stale clients and free active style changes persist',()=>{const ws=workspace(),fry=sixFry(ws);for(const id of fry.slice(0,5))F.placeFry(ws,id,'pond_starter',90000);const before=clone(ws);F.releaseFish(ws,fry[0],90001);F.placeFry(ws,fry[5],'pond_starter',90002);F.selectPondStyle(ws,'pond_starter','moon',90003);F.archivePond(ws,'pond_starter',90004);const stale=clone(before);G.preserve(ws,stale);F.preserve(ws,stale);assert.equal(F.read(stale).fry.find(f=>f.id===fry[0]).releasedAt,90001);assert.equal(F.read(stale).ponds[0].styleId,'moon');assert.equal(F.read(stale).ponds[0].archivedAt,90004);assert.equal(F.read(stale).ponds[0].fishIds.length,5);assert.equal(F.read(stale).ponds.length,2);});

test('historical collection ponds can change scenery and preserve the latest style',()=>{const ws=workspace(),fry=sixFry(ws);F.selectPondStyle(ws,'pond_starter','moon',80000);for(const id of fry.slice(0,5))F.placeFry(ws,id,'pond_starter',90000);F.archivePond(ws,'pond_starter',90001);const before=clone(ws);assert.equal(F.selectPondStyle(ws,'pond_starter','cloud',90002).ok,true);const incoming=clone(before);F.preserve(ws,incoming);assert.equal(F.read(incoming).ponds[0].styleId,'cloud');assert.deepEqual(F.read(incoming).ponds[0].fishIds,F.read(ws).ponds[0].fishIds);});

test('workspace validation includes fishing and rejects a mismatched shared wallet',()=>{const ws=workspace();F.buyBait(ws,'grain',2,100);assert.deepEqual(S.validate(clone(ws)).fishing,ws.fishing);const bad=clone(ws);bad.taskGarden.market.fishingTransactions=[];assert.throws(()=>S.validate(bad),/Invalid fishing state/);const base=clone(ws),local=clone(ws),remote=clone(ws);F.buyBait(local,'worm',1,101);F.buyBait(remote,'shrimp',1,102);const merged=S.merge(base,local,remote).workspace;assert.equal(F.read(merged).baits.worm,40);assert.equal(F.read(merged).baits.shrimp,10);assert.equal(F.economy(merged).balance,9915);});

test('serialized server preservation retains fishing catches, fry, tombstones and wallet receipts',async t=>{const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'tracer-fishing-'));t.after(async()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));await fsp.rm(dir,{recursive:true,force:true});});const save=ws=>Store.writeStore(dir,'workspace',JSON.stringify(ws),(old,next)=>{G.preserve(old,next);return F.preserve(old,next);});const ws=workspace();await Store.writeStore(dir,'workspace',JSON.stringify(ws));const rare=catchFish(ws,'koi','grain',1000);await save(ws);const stale=clone(ws);F.placeFry(ws,rare.fry.id,'pond_starter',12000);F.releaseFish(ws,rare.fry.id,12001);await save(ws);await save(stale);const loaded=await Store.readStore(dir,'workspace');assert.equal(F.read(loaded).fry[0].releasedAt,12001);assert.deepEqual(S.validate(loaded).fishing,loaded.fishing);});

test('twelve free scenery pieces have bounded theme defaults and can be placed, transformed and reset',()=>{const ws=workspace(0),pond='pond_starter';assert.equal(F.catalog.decorations.length,12);assert.ok(F.catalog.decorations.every(d=>d.price===0));for(const style of F.catalog.pondStyles){const rows=F.defaultPondDecorations(style.id,0);assert.ok(rows.length>=5&&rows.length<=7);assert.ok(rows.every(d=>Math.abs(d.x)<=2.65&&Math.abs(d.z)<=2.65));assert.ok(rows.filter(d=>d.kind!=='lilies').every(d=>Math.abs(d.x)>1.8||Math.abs(d.z)>1.8));}const before=G.economy(ws);F.selectPondStyle(ws,pond,'lily',100);assert.ok(F.read(ws).ponds[0].decorations.some(d=>d.kind==='lilies'));const result=F.setPondDecoration(ws,pond,{kind:'signpost',x:-2.65,z:2.65,rotation:3,scale:1.5},101);assert.equal(result.ok,true);assert.equal(result.spent,0);const id=result.decoration.id;assert.equal(F.setPondDecoration(ws,pond,{id,x:2.65,z:-2.65,rotation:1,scale:.6},1).ok,true);assert.ok(F.read(ws).ponds[0].decorationLayoutAt>101,'clock rollback cannot undo the layout');assert.deepEqual(G.economy(ws),before);F.selectPondStyle(ws,pond,'moon',103);assert.ok(F.read(ws).ponds[0].decorations.some(d=>d.id===id),'custom layout survives style change');assert.equal(F.resetPondDecorations(ws,pond,104).ok,true);assert.deepEqual(F.read(ws).ponds[0].decorations.map(d=>d.kind),F.defaultPondDecorations('moon',0).map(d=>d.kind));});

test('invalid decoration transforms, unknown objects and a seventeenth placement are atomic failures',()=>{const ws=workspace(),pond='pond_starter';for(const patch of [{kind:'unknown'},{kind:'tree',x:2.651},{kind:'tree',z:-2.651},{kind:'tree',rotation:4},{kind:'tree',scale:.59},{kind:'tree',scale:1.51},{kind:'tree',x:NaN},{kind:'tree',rotation:1.5},{kind:'tree',id:'../escape'}]){const before=JSON.stringify(ws);assert.equal(F.setPondDecoration(ws,pond,patch,100).reason,'invalid-decoration');assert.equal(JSON.stringify(ws),before);}assert.equal(F.setPondDecoration(ws,'missing',{kind:'tree'}).reason,'unknown-pond');while(F.read(ws).ponds[0].decorations.length<16)assert.equal(F.setPondDecoration(ws,pond,{kind:'lantern'},200).ok,true);const before=JSON.stringify(ws);assert.equal(F.setPondDecoration(ws,pond,{kind:'tree'}).reason,'decoration-limit');assert.equal(JSON.stringify(ws),before);const id=F.read(ws).ponds[0].decorations[0].id;assert.equal(F.setPondDecoration(ws,pond,{id,remove:true},300).ok,true);assert.equal(F.setPondDecoration(ws,pond,{kind:'tree'},301).ok,true);const bad=clone(ws.fishing);bad.ponds[0].decorations[0].x=Infinity;assert.throws(()=>F.validate(bad));});

test('decoration deletion cannot reappear through stale merge or newer unrelated pond writes',()=>{const ws=workspace(),pond='pond_starter',id=F.read(ws).ponds[0].decorations[0].id,base=clone(ws);F.setPondDecoration(ws,pond,{id,remove:true},100);const accepted=clone(ws),stale=clone(base);F.selectPondStyle(stale,pond,'moon',200);const local=clone(base);local.fishing.ponds[0].updatedAt=300;local.fishing.updatedAt=300;const merged=F.merge(base.fishing,local.fishing,accepted.fishing);assert.equal(merged.ponds[0].decorations.some(d=>d.id===id),false);const next=clone(local);G.preserve(accepted,next);F.preserve(accepted,next);assert.equal(F.read(next).ponds[0].decorations.some(d=>d.id===id),false);const a=clone(accepted),b=clone(accepted);F.setPondDecoration(a,pond,{kind:'bench'},400);F.setPondDecoration(b,pond,{kind:'lantern'},400);assert.deepEqual(F.merge(accepted.fishing,a.fishing,b.fishing).ponds[0].decorations,F.merge(accepted.fishing,b.fishing,a.fishing).ponds[0].decorations);});

test('archived pond scenery remains editable without changing five sealed residents',()=>{const ws=workspace(),fry=sixFry(ws);for(const id of fry.slice(0,5))F.placeFry(ws,id,'pond_starter',90000);F.archivePond(ws,'pond_starter',90001);const before=F.read(ws).ponds[0].sealedFishIds.slice();assert.equal(F.setPondDecoration(ws,'pond_starter',{kind:'lantern',x:2.3,z:2.2},90002).ok,true);assert.equal(F.resetPondDecorations(ws,'pond_starter',90003).ok,true);assert.deepEqual(F.read(ws).ponds[0].sealedFishIds,before);assert.equal(F.read(ws).ponds[0].archivedAt,90001);assert.equal(F.releaseFish(ws,before[0]).ok,true);});

test('aquarium defaults are read-only and keep updating with discovered legendary fish until selected',()=>{
  const ws=workspace(),initial=clone(ws);
  assert.deepEqual(F.showcase(ws),{fish:[],selection:{fishIds:[]},stats:{catches:0,species:0,ponds:0}});assert.deepEqual(ws,initial);
  assert.equal(F.read(ws).showcase.updatedAt,0);assert.equal(F.validate(ws.fishing).showcase,undefined);
  catchFish(ws,'minnow','worm');catchFish(ws,'koi','grain',12000);assert.deepEqual(F.showcase(ws).selection.fishIds,[]);
  catchFish(ws,'gulpuffer','stardust',23000);assert.deepEqual(F.showcase(ws).selection.fishIds,['gulpuffer']);assert.equal(ws.fishing.showcase,undefined);
  assert.equal(F.setShowcase(ws,{fishIds:['gulpuffer']},34000).changed,true);
  catchFish(ws,'dragonkoi','spirit',35000);assert.deepEqual(F.showcase(ws).selection.fishIds,['gulpuffer']);
  const saved=clone(ws);assert.equal(F.setShowcase(ws,{fishIds:['gulpuffer']},50000).changed,false);assert.deepEqual(ws,saved);
  assert.equal(F.catalog.souvenirs,undefined);assert.equal(F.unlockedSouvenirs,undefined);
});

test('automatic aquarium highlights contain three unique legends while collection stats retain all catches',()=>{
  const ws=workspace(),fry=[['koi','grain'],['snagglefin','stardust'],['gulpuffer','stardust'],['galaxywhale','stardust'],['dragonkoi','spirit']].map(([fish,bait],i)=>catchFish(ws,fish,bait,1000+i*11000).fry.id),balance=F.economy(ws).balance;
  assert.deepEqual(F.showcase(ws).selection,{fishIds:['dragonkoi','galaxywhale','gulpuffer']});assert.ok(F.showcase(ws).fish.every(f=>f.rarity==='legendary'));
  for(const id of fry)F.placeFry(ws,id,'pond_starter',90000);F.archivePond(ws,'pond_starter',90001);
  assert.deepEqual(F.showcase(ws).stats,{catches:5,species:5,ponds:1});assert.equal(F.economy(ws).balance,balance);assert.equal(ws.fishing.showcase,undefined);
});

test('aquarium display is free and remains a collection memory after sale or fry release',()=>{
  const ws=workspace(),rare=catchFish(ws,'gulpuffer','stardust'),before=clone(ws),balance=F.economy(ws).balance,fishIds=['gulpuffer'];
  const selected=F.setShowcase(ws,{fishIds},13000);assert.equal(selected.ok,true);assert.equal(selected.changed,true);assert.equal(selected.spent,0);
  for(const key of ['catches','fry','transactions','casts','boxes','ponds'])assert.deepEqual(ws.fishing[key],before.fishing[key]);assert.equal(F.economy(ws).balance,balance);
  fishIds.push('minnow');selected.showcase.fish[0].name[0]='modified';selected.showcase.selection.fishIds.length=0;
  assert.deepEqual(F.read(ws).showcase.fishIds,['gulpuffer']);assert.notEqual(F.showcase(ws).fish[0].name[0],'modified');
  F.sellFish(ws,rare.catch.id,14000);F.releaseFish(ws,rare.fry.id,14001);
  assert.deepEqual(F.showcase(ws).selection,{fishIds:['gulpuffer']});assert.deepEqual(F.showcase(ws).stats,{catches:1,species:1,ponds:0});
  assert.equal(F.setShowcase(ws,{fishIds:[]},14002).ok,true);assert.deepEqual(F.showcase(ws).fish,[]);assert.deepEqual(Object.keys(ws.fishing.showcase),['fishIds','updatedAt']);
});

test('invalid, unearned or nonlegendary aquarium selections are atomic failures',()=>{
  const ws=workspace();catchFish(ws,'koi','grain');catchFish(ws,'gulpuffer','stardust',12000);const before=clone(ws);
  for(const patch of [null,[],{fishIds:'gulpuffer'},{fishIds:new Array(1)},{fishIds:['missing']},{fishIds:['gulpuffer','gulpuffer']},{fishIds:['gulpuffer','dragonkoi','flopray','galaxywhale']},{rodId:'bamboo'},{souvenirId:null},{updatedAt:99999},{fishIds:[],unexpected:true}]){
    assert.equal(F.setShowcase(ws,patch,23000).reason,'invalid-showcase');assert.deepEqual(ws,before);
  }
  assert.equal(F.setShowcase(ws,{fishIds:['dragonkoi']},23000).reason,'showcase-not-unlocked');assert.deepEqual(ws,before);
  assert.equal(F.setShowcase(ws,{fishIds:['koi']},23000).reason,'showcase-not-legendary');assert.deepEqual(ws,before);
  assert.equal(F.setShowcase(ws,{},23000).changed,false);assert.deepEqual(ws,before);
  const valid={fishIds:['gulpuffer'],updatedAt:ws.fishing.updatedAt};
  for(const patch of [{fishIds:['gulpuffer','gulpuffer']},{fishIds:['dragonkoi']},{rodId:'dragon'},{souvenirId:'pond_keeper'},{updatedAt:-1},{updatedAt:ws.fishing.updatedAt+1},{updatedAt:1.2},{extra:true}])assert.throws(()=>F.validate({...ws.fishing,showcase:{...valid,...patch}}),/Invalid fishing state/);
  assert.deepEqual(F.validate({...ws.fishing,showcase:valid}).showcase,valid);
});

test('legacy cabin layouts validate unchanged, project legends only and migrate on explicit selection',()=>{
  const ws=workspace();catchFish(ws,'koi','grain');catchFish(ws,'gulpuffer','stardust',12000);
  ws.fishing.showcase={fishIds:['koi','gulpuffer'],rodId:'bamboo',souvenirId:'first_catch',updatedAt:ws.fishing.updatedAt};
  const raw=clone(ws.fishing.showcase);assert.deepEqual(F.validate(ws.fishing).showcase,raw);
  assert.deepEqual(F.read(ws).showcase,{fishIds:['gulpuffer'],updatedAt:raw.updatedAt});assert.deepEqual(F.showcase(ws).selection,{fishIds:['gulpuffer']});assert.deepEqual(ws.fishing.showcase,raw);
  F.equipBait(ws,'worm',23000);assert.deepEqual(ws.fishing.showcase,raw);
  const legacy=clone(ws);assert.equal(F.setShowcase(ws,{fishIds:['gulpuffer']},23001).changed,true);assert.deepEqual(ws.fishing.showcase,{fishIds:['gulpuffer'],updatedAt:23001});
  F.preserve(ws,legacy);assert.deepEqual(legacy.fishing.showcase,ws.fishing.showcase);
  const commonOnly=clone(ws);commonOnly.fishing.showcase={...raw,fishIds:['koi']};assert.deepEqual(F.showcase(commonOnly).fish,[]);
  assert.equal(F.setShowcase(commonOnly,{fishIds:[]},24000).changed,true);assert.deepEqual(commonOnly.fishing.showcase,{fishIds:[],updatedAt:24000});
});

test('aquarium selection has an independent monotonic merge clock and empty slots survive stale clients',()=>{
  const base=workspace();catchFish(base,'gulpuffer','stardust');catchFish(base,'dragonkoi','spirit',12000);F.setShowcase(base,{fishIds:['gulpuffer']},23000);
  const local=clone(base),remote=clone(base);F.setShowcase(local,{fishIds:['dragonkoi']},24000);F.equipBait(remote,'worm',99000);
  assert.deepEqual(S.merge(base,local,remote).workspace.fishing.showcase,local.fishing.showcase);
  const stale=clone(remote);delete stale.fishing.showcase;F.preserve(local,stale);assert.deepEqual(stale.fishing.showcase,local.fishing.showcase);
  const at=local.fishing.showcase.updatedAt;assert.equal(F.setShowcase(local,{fishIds:[]},10).ok,true);assert.ok(local.fishing.showcase.updatedAt>at);
  F.equipBait(local,'worm',11);assert.ok(local.fishing.updatedAt>=local.fishing.showcase.updatedAt);F.preserve(local,stale);assert.deepEqual(stale.fishing.showcase.fishIds,[]);
  const a=clone(base),b=clone(base);F.setShowcase(a,{fishIds:['gulpuffer','dragonkoi']},100000);F.setShowcase(b,{fishIds:['dragonkoi','gulpuffer']},100000);
  assert.deepEqual(F.merge(base.fishing,a.fishing,b.fishing).showcase,F.merge(base.fishing,b.fishing,a.fishing).showcase);assert.equal(F.merge(undefined,F.empty(),F.empty()).showcase,undefined);
});

test('serialized server saves retain aquarium layout after an older client omits the field',async t=>{
  const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'tracer-fishing-showcase-'));t.after(async()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));await fsp.rm(dir,{recursive:true,force:true});});
  const ws=workspace();catchFish(ws,'gulpuffer','stardust');const stale=clone(ws);F.setShowcase(ws,{fishIds:['gulpuffer']},12000);await Store.writeStore(dir,'workspace',JSON.stringify(ws));
  F.equipBait(stale,'worm',99000);assert.equal(stale.fishing.showcase,undefined);await Store.writeStore(dir,'workspace',JSON.stringify(stale),(old,next)=>{G.preserve(old,next);return F.preserve(old,next);});
  const restored=await Store.readStore(dir,'workspace');assert.deepEqual(restored.fishing.showcase,ws.fishing.showcase);assert.deepEqual(S.validate(restored).fishing,restored.fishing);
});


test('new reef, silk, pearl and starcrown species can be caught, hatched and fed to adulthood',()=>{
  const ws=workspace(),entries=[['clownfish','shrimp','dart'],['bluebetta','worm','flutter'],['pearljelly','glow','bubble'],['crownray','stardust','twirl']];
  const caught=entries.map(([id,bait,motion],index)=>{const result=catchFish(ws,id,bait,1000+index*12000);assert.equal(result.fish.feedingReaction.motion,motion);assert.equal(result.fry.fishId,id);assert.equal(F.placeFry(ws,result.fry.id,'pond_starter',60000).ok,true);return result;});
  for(let turn=0;turn<5;turn++){const fed=F.feedPond(ws,'pond_starter',100000+turn*60000);assert.equal(fed.ok,true);assert.equal(fed.fed,4);assert.deepEqual(new Set(fed.reactions.map(r=>r.fishId)),new Set(entries.map(e=>e[0])));if(turn===4)assert.deepEqual(new Set(fed.maturation.map(f=>f.fishId)),new Set(entries.map(e=>e[0])));}
  for(const result of caught){const resident=F.read(ws).fry.find(f=>f.id===result.fry.id);assert.equal(resident.growth,100);assert.equal(F.growthAppearance(resident).mature,true);}
  const crown=caught.at(-1);assert.equal(F.placeAquariumFish(ws,crown.fry.id,true,410000).ok,true);assert.equal(F.aquarium(ws).fish[0].speciesId,'crownray');assert.doesNotThrow(()=>F.validate(ws.fishing));
});
