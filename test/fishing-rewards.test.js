'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync');
const copy=structuredClone;
function workspace(){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'fishing_test',amount:10000,updatedAt:1};return ws;}
function catchSeed(ws,seed,now=1000){const s=F.beginCast(ws,{seed,now}).session;F.stepSession(s,{},900);F.stepSession(s,{release:true},0);assert(F.commitCast(ws,s,now+1).ok);while(!['caught','escaped'].includes(s.phase))F.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);assert.equal(s.phase,'caught');return F.recordCatch(ws,s,now+20000);}
function bundle(ws,now=1000){return catchSeed(ws,970000,now).catch;}
function seedFor(id,bait){for(let seed=0;seed<1000;seed++)if(F.createSession(null,{seed,baitId:bait}).fishId===id)return seed;throw Error(id);}
function reeling(id,bait='worm'){const s=F.createSession(null,{seed:seedFor(id,bait),baitId:bait});F.stepSession(s,{},900);F.stepSession(s,{release:true},0);while(s.phase!=='bite')F.stepSession(s,{},16);F.stepSession(s,{hook:true},0);return s;}

test('signed backups retain sealed bundles, junk appearances, opened gifts and equipped slots exactly',()=>{
  const Backup=require('../lib/workspace-backup'),ws=workspace();
  const junk=catchSeed(ws,890001,1000).catch,opened=bundle(ws,31000),sealed=bundle(ws,61000);
  const reward=F.openMysteryBundle(ws,opened.id,{now:90000,random:()=>0});
  F.equipGift(ws,reward.gift.id,reward.gift.slot,90001);
  F.setShowcase(ws,{decorationIds:['glass_observatory','sunken_astrolabe','ribbon_jellyfish']},90002);
  const signed=Backup.sign('guest',ws,{},'b'.repeat(64),100000);
  assert.doesNotThrow(()=>Backup.inspect(signed,'guest','b'.repeat(64)));
  const restored=S.validate(copy(signed.payload.workspace));
  assert.deepEqual(restored.fishing,ws.fishing);
  assert.equal(F.read(restored).catches.find(c=>c.id===sealed.id).openedAt,null);
  assert.equal(F.catchItem(F.read(restored).catches.find(c=>c.id===junk.id)).variant,junk.variant);
  assert.equal(F.read(restored).giftAppearance.avatarFrameId,reward.gift.id);
  assert.equal(F.openMysteryBundle(restored,opened.id).alreadyOpened,true);
  assert.equal(F.read(restored).giftUnlocks.length,1);
});

test('products are independent of species and the fixed seed bands allocate 8% junk and 3% bundles',()=>{
  assert.deepEqual(F.catalog.products.map(p=>p.id),['junk','mystery_bundle']);
  assert.equal(F.catalog.fish.length,24);assert(!F.catalog.fish.some(f=>F.catalog.products.some(p=>p.id===f.id)));
  const counts={fish:0,junk:0,mystery_bundle:0};
  for(let seed=0;seed<1000000;seed+=1000){const s=F.createSession(null,{seed});counts[F.catalog.products.some(p=>p.id===s.fishId)?s.fishId:'fish']++;}
  assert.deepEqual(counts,{fish:890,junk:80,mystery_bundle:30});
  assert(F.catalog.fish.some(f=>f.id===F.createSession(null,{seed:1000000}).fishId));
});

test('one junk product has three saved appearances, costs exactly one coin, and never creates fish or fry',()=>{
  const ws=workspace();F.buyBox(ws,{random:n=>n===10000?5450:0});F.equipRod(ws,'golden');
  const catches=[890000,890001,890002].map((seed,i)=>catchSeed(ws,seed,1000+i*30000));
  assert.deepEqual(new Set(catches.map(c=>c.catch.variant)),new Set(['boots','broken_watch','trash_bag']));
  for(const result of catches){assert.equal(result.fry,null);assert.equal(result.fish.kind,'junk');assert.equal(F.catchItem(result.catch).variant,result.catch.variant);assert.equal(result.catch.length,0);assert.equal(F.catchValue(F.read(ws),result.catch),1);}
  assert.equal(F.showcase(ws).stats.species,0);assert.equal(F.showcase(ws).stats.catches,0);assert.deepEqual(F.aquarium(ws).fish,[]);assert.deepEqual(F.read(ws).fry,[]);
  assert.equal(F.sellFishBatch(ws,catches.map(c=>c.catch.id)).earned,3);
  assert.equal(F.sellFishBatch(ws,catches.map(c=>c.catch.id)).earned,0);
  assert(ws.fishing.transactions.filter(t=>t.kind==='sale').every(t=>t.amount===1&&t.multiplier===undefined));
  assert.deepEqual(S.validate(copy(ws)).fishing,ws.fishing);
  const malformed=copy(ws.fishing);malformed.catches[0].variant='diamond';assert.throws(()=>F.validate(malformed));
  const doubled=copy(ws.fishing);const tx=doubled.transactions.find(t=>t.kind==='sale');tx.amount=2;tx.multiplier=2;assert.throws(()=>F.validate(doubled));
});

test('bundles are fishing-only inventory, cannot be sold, and refuse atomic mixed batch sales',()=>{
  const ws=workspace(),gift=bundle(ws),junk=catchSeed(ws,890000,22000).catch,before=copy(ws);
  assert.equal(F.catchItem(gift).openable,true);assert.equal(gift.openedAt,null);assert.equal(F.catchValue(F.read(ws),gift),0);
  assert.equal(F.sellFish(ws,gift.id).reason,'bundle-not-sellable');assert.equal(F.sellFishBatch(ws,[junk.id,gift.id]).reason,'bundle-not-sellable');
  assert.equal(F.openMysteryBundle(ws,junk.id).reason,'not-a-bundle');assert.equal(F.openMysteryBundle(workspace(),gift.id).reason,'unknown-catch');
  assert.equal(F.buyBait(ws,'mystery_bundle',1).reason,'unknown-bait');assert.deepEqual(ws,before);
  assert.throws(()=>F.validateTransactions([{id:'forged',kind:'sale',itemId:'mystery_bundle',quantity:1,amount:1,createdAt:1}]));
});

test('opening gifts exhausts the unseen collection before duplicates and grants a single lawful compensation',()=>{
  const ws=workspace(),originalBalance=F.economy(ws).balance,unlocked=[];
  for(let i=0;i<7;i++){
    const c=bundle(ws,1000+i*30000),r=F.openMysteryBundle(ws,c.id,{now:25000+i*30000,random:()=>0});
    assert.equal(r.ok,true);assert.equal(r.duplicate,i===6);assert.equal(r.earned,i===6?15:0);unlocked.push(r.gift.id);
    const saved=copy(ws);assert.equal(F.openMysteryBundle(ws,c.id,{now:999999,random:()=>{throw Error('replayed randomness');}}).alreadyOpened,true);assert.deepEqual(ws,saved);
  }
  assert.equal(new Set(unlocked.slice(0,6)).size,6);assert.equal(unlocked[6],unlocked[0]);assert.equal(F.read(ws).giftUnlocks.length,6);
  assert.equal(F.economy(ws).balance,originalBalance+15);assert.equal(ws.fishing.transactions.filter(t=>t.kind==='gift_duplicate').length,1);
  assert.deepEqual(S.validate(copy(ws)).fishing,ws.fishing);
  const missing=copy(ws.fishing);missing.transactions=missing.transactions.filter(t=>t.kind!=='gift_duplicate');assert.throws(()=>F.validate(missing));
  const overpaid=copy(ws.fishing);overpaid.transactions.find(t=>t.kind==='gift_duplicate').amount=150;assert.throws(()=>F.validate(overpaid));
  const replay=copy(ws.fishing);replay.transactions.push({...replay.transactions.find(t=>t.kind==='gift_duplicate'),id:'second_payment'});assert.throws(()=>F.validate(replay));
});

test('gift wearing has its own saved clock and cannot equip unearned gifts or the wrong slot',()=>{
  const ws=workspace(),before=copy(ws);
  assert.equal(F.equipGift(ws,'tide_crown','avatarFrame').reason,'gift-not-owned');assert.equal(F.equipGift(ws,null,'unexpected').reason,'invalid-gift-slot');assert.deepEqual(ws,before);
  const one=F.openMysteryBundle(ws,bundle(ws).id,{random:()=>0,now:22000});
  const two=F.openMysteryBundle(ws,bundle(ws,30000).id,{random:n=>n-1,now:52000});
  assert.equal(one.gift.slot,'avatarFrame');assert.equal(two.gift.slot,'background');
  assert.equal(F.equipGift(ws,one.gift.id,'avatarFrame',53000).ok,true);assert.equal(F.equipGift(ws,two.gift.id,'background',53001).ok,true);
  assert.equal(F.equipGift(ws,one.gift.id,'background',53002).reason,'gift-not-owned');
  const stale=copy(ws);assert.equal(F.equipGift(ws,null,'avatarFrame',53003).ok,true);
  F.equipBait(stale,'worm',60000);F.preserve(ws,stale);
  assert.deepEqual(F.read(stale).giftAppearance,{avatarFrameId:null,backgroundId:two.gift.id,updatedAt:53003});
  catchSeed(ws,0,70000);assert.equal(F.read(ws).giftAppearance.backgroundId,two.gift.id);
  assert.deepEqual(S.validate(copy(ws)).fishing,ws.fishing);
  const forged=copy(ws.fishing);forged.giftAppearance.avatarFrameId='dragon_seal';assert.throws(()=>F.validate(forged));
});

test('opening a copied bundle on two clients consumes it only once and merges symmetrically',()=>{
  const base=workspace(),c=bundle(base),local=copy(base),remote=copy(base);
  F.openMysteryBundle(local,c.id,{now:25000,random:()=>0});F.openMysteryBundle(remote,c.id,{now:25001,random:n=>n-1});
  const a=F.merge(base.fishing,local.fishing,remote.fishing),b=F.merge(base.fishing,remote.fishing,local.fishing);
  assert.deepEqual(a.mysteryOpenings,b.mysteryOpenings);assert.equal(a.mysteryOpenings.length,1);assert.equal(a.mysteryOpenings[0].giftId,'tide_crown');assert.equal(a.catches[0].openedAt,25000);
  const merged=S.merge(base,local,remote).workspace;assert.equal(F.read(merged).giftUnlocks.length,1);assert.equal(F.openMysteryBundle(merged,c.id).alreadyOpened,true);assert.equal(F.economy(merged).balance,F.economy(base).balance);
  const stale=copy(base);F.equipBait(stale,'worm',99999);F.preserve(merged,stale);assert.equal(F.read(stale).mysteryOpenings.length,1);assert.equal(F.openMysteryBundle(stale,c.id).alreadyOpened,true);
});

test('two different bundles opened concurrently reconcile a repeated gift into exactly one compensation',()=>{
  const base=workspace(),c1=bundle(base),c2=bundle(base,30000),local=copy(base),remote=copy(base);
  F.openMysteryBundle(local,c1.id,{now:60000,random:()=>0});F.openMysteryBundle(remote,c2.id,{now:60001,random:()=>0});
  const merged=S.merge(base,local,remote).workspace;
  assert.equal(F.read(merged).mysteryOpenings.length,2);assert.equal(F.read(merged).giftUnlocks.length,1);assert.equal(F.economy(merged).balance,F.economy(base).balance+15);
  const repeat=S.merge(base,merged,remote).workspace;assert.equal(F.economy(repeat).balance,F.economy(merged).balance);assert.deepEqual(S.validate(copy(repeat)).fishing,repeat.fishing);
});

test('forged openings, appearances and product records cannot unlock gifts',()=>{
  const ws=workspace(),c=bundle(ws),raw=copy(ws.fishing);
  raw.catches[0].openedAt=22000;raw.updatedAt=22000;assert.throws(()=>F.validate(raw));
  raw.mysteryOpenings=[{id:'gift_'+c.id,catchId:c.id,giftId:'tide_crown',openedAt:22000,duplicate:false}];assert.doesNotThrow(()=>F.validate(raw));
  for(const patch of [{catchId:'missing'},{id:'different'},{giftId:'unknown'},{duplicate:true},{openedAt:21999}]){const bad=copy(raw);Object.assign(bad.mysteryOpenings[0],patch);assert.throws(()=>F.validate(bad));}
  const replay=copy(raw);replay.mysteryOpenings.push({...replay.mysteryOpenings[0],id:'second'});assert.throws(()=>F.validate(replay));
  const bad=copy(ws.fishing);bad.catches[0].variant='boots';assert.throws(()=>F.validate(bad));
  assert.throws(()=>F.validateTransactions([{id:'fake',kind:'gift_duplicate',itemId:'unknown',quantity:1,amount:15,createdAt:1,refId:'gift_fake'}]));
});

test('four rarity tiers have progressively tighter zones and longer fights yet the starter rod can finish each',()=>{
  const setups=[['minnow','worm'],['koi','grain'],['moonfin','stardust'],['dragonkoi','spirit']],times=[],sizes=[];
  for(const [id,bait]of setups){const s=reeling(id,bait);sizes.push(s.barSize);let time=0;while(s.phase==='reeling'&&time<45000){F.stepSession(s,{holding:s.fishPosition>s.barPosition},16);time+=16;}assert.equal(s.phase,'caught',id);times.push(time);}
  for(let i=1;i<4;i++){assert(sizes[i]<sizes[i-1]);assert(times[i]>times[i-1]*1.12,JSON.stringify(times));}
  assert.equal(Object.keys(F.catalog.difficultyProfiles).length,4);assert(F.catalog.fish.every(f=>f.difficultyDescription.length===2));
});

test('every legendary species has a distinct readable movement and stable substepped simulation',()=>{
  const paths=[];
  for(const fish of F.catalog.fish.filter(f=>f.rarity==='legendary')){
    const bait=F.catalog.baits.find(b=>b.fishIds.includes(fish.id)).id,s=reeling(fish.id,bait),trace=[];
    for(let i=0;i<120;i++){const before=s.fishPosition;F.stepSession(s,{holding:s.fishPosition>s.barPosition},16);assert(Math.abs(s.fishPosition-before)/.016<.38);if(i%20===0)trace.push(s.fishPosition.toFixed(4));}
    assert.equal(s.fishTechnique,fish.technique.id);paths.push(trace.join(','));
    const small=reeling(fish.id,bait),large=reeling(fish.id,bait);for(let i=0;i<100;i++)F.stepSession(small,{holding:true},16);for(let i=0;i<10;i++)F.stepSession(large,{holding:true},160);
    for(const key of ['fishPosition','barPosition','progress','stamina','tension'])assert.equal(small[key],large[key],fish.id+'/'+key);
  }
  assert.equal(new Set(paths).size,paths.length);
});
