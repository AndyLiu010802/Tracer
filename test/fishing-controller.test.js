'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model');
const source=fs.readFileSync(require.resolve('../skins/tracer/fishing.js'),'utf8');

async function fixture(){
  const ws=M.emptyWorkspace();F.ensure(ws);
  let now=1000,serial=0,desktopAction;const timers=new Map(),updates=[],listeners=new Map(),confirmations=[],rewards={applied:[],revealed:[],cleared:0};
  const store={data:ws,base:structuredClone(ws),dirty:false,inflight:false,lost:false,timer:0};
  const node={textContent:'',addEventListener(){}};
  const document={hidden:false,getElementById:()=>node,addEventListener(){}};
  const window={Tracer:{store,sections:[],ready:Promise.resolve(ws),currentSec:()=>'',onShow(){},touch(){store.dirty=true;},saveNow(){store.dirty=false;store.inflight=false;},garden:{refresh(){}},show(){}},TracerFishingModel:{...F,beginCast:(workspace,options)=>F.beginCast(workspace,{...options,seed:0,now})},TracerFishing:{update:snapshot=>updates.push({...snapshot,session:snapshot.session&&{...snapshot.session}}),onAction:fn=>{desktopAction=fn;return()=>{};}},TracerAccount:{scope:'guest',context:{generation:1,restoreId:''},locked:false,switching:false},addEventListener:(type,fn)=>listeners.set(type,fn)};
  window.TracerFishingRewards={apply:state=>rewards.applied.push(structuredClone(state)),reveal:result=>rewards.revealed.push(structuredClone(result)),clear:()=>rewards.cleared++};
  window.Tracer.confirmTaskAction=(options,confirm)=>confirmations.push({options,confirm});
  const clock={now:()=>now};
  const DateClass=class extends Date{static now(){return now;}};
  vm.runInNewContext(source,{window,document,performance:clock,Date:DateClass,TracerLocale:{language:()=> 'en'},setInterval:(fn,delay)=>{const id=++serial;timers.set(id,{fn,delay,interval:true});return id;},clearInterval:id=>timers.delete(id),setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)});
  const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};await settle();
  const tick=ms=>{now+=ms;for(const timer of [...timers.values()])if(timer.interval&&(timer.delay===32||timer.delay===100))timer.fn();};
  const skip=ms=>{now+=ms;};
  const runTimeouts=()=>{for(const [id,timer]of [...timers])if(!timer.interval){timers.delete(id);timer.fn();}};
  const action=(type,...args)=>window.Tracer.fishing.action(type,...args);
  const bite=async()=>{action('cast-start');tick(900);action('cast-release');await settle();tick(650);tick(window.Tracer.fishing.snapshot().session.waitDuration);assert.equal(window.Tracer.fishing.snapshot().session.phase,'bite');};
  const snapshot=()=>window.Tracer.fishing.snapshot();
  return{window,store,updates,action,tick,skip,settle,runTimeouts,bite,snapshot,confirmations,rewards,event(type){listeners.get(type)?.();},desktop(type,extra={}){desktopAction({type,...extra,accountScope:window.TracerAccount.scope,accountGeneration:window.TracerAccount.context.generation,accountRestoreId:'',sessionId:snapshot().session?.id||''});}};
}

test('a throttled controller tick spends the full bite deadline and awards no catch',async()=>{
  const f=await fixture();await f.bite();f.tick(3000);
  assert.equal(f.snapshot().session.phase,'escaped');assert.equal(f.snapshot().session.reason,'missed-bite');
  assert.equal(F.read(f.store.data).catches.length,0);assert.equal(F.read(f.store.data).baits.worm,29);
});

test('rod collection links target their own pool without changing existing bait shop links',async()=>{
  const f=await fixture(),visits=[];f.window.Tracer.show=section=>visits.push(['section',section]);f.window.Tracer.garden.department=(...args)=>visits.push(['department',...args]);
  f.action('open-pool','myriad');assert.deepEqual(JSON.parse(JSON.stringify(visits)),[['section','shop'],['department','fishing',{poolId:'myriad'}]]);
  visits.length=0;f.action('open-pool','missing');assert.deepEqual(visits,[]);
  f.action('open-shop','grain');assert.deepEqual(visits,[['section','shop'],['department','fishing','grain']]);
});

test('a click arriving after the bite deadline cannot hook before the next interval tick',async()=>{
  const f=await fixture();await f.bite();f.skip(1701);f.action('hook');
  assert.equal(f.snapshot().session.phase,'escaped');assert.equal(f.snapshot().session.reason,'missed-bite');
});

test('a save retry cannot freeze the bite clock or disable an otherwise valid hook',async()=>{
  const f=await fixture();await f.bite();f.store.inflight=true;const retry=f.action('retry-save');await f.settle();
  assert.equal(f.updates.at(-1).disabled,false);assert.equal(f.updates.at(-1).busy,false);assert.equal(f.snapshot().disabled,false);
  f.tick(500);f.action('hook');assert.equal(f.snapshot().session.phase,'reeling');
  f.store.inflight=false;f.runTimeouts();await retry;
});

test('a save retry keeps missed bites expiring even while its request is unresolved',async()=>{
  const f=await fixture();await f.bite();f.store.inflight=true;const retry=f.action('retry-save');await f.settle();
  f.tick(1800);assert.equal(f.snapshot().session.phase,'escaped');assert.equal(f.snapshot().session.reason,'missed-bite');
  f.store.inflight=false;f.runTimeouts();await retry;
});

test('an escaped terminal snapshot bypasses bridge throttling before the timer stops',async()=>{
  const f=await fixture();await f.bite();f.tick(1668);assert.equal(f.updates.at(-1).session.phase,'bite');
  const count=f.updates.length;f.tick(32);assert.equal(f.snapshot().session.phase,'escaped');
  assert.equal(f.updates.length,count+1,'the terminal notification is sent even within the 48ms throttle');
  assert.equal(f.updates.at(-1).session.phase,'escaped');assert.equal(f.updates.at(-1).session.reason,'missed-bite');
});

test('a catch completed during a save retry waits and is recorded once before another cast can begin',async()=>{
  const f=await fixture();await f.bite();f.action('hook');f.store.inflight=true;const retry=f.action('retry-save');await f.settle();
  for(let i=0;i<3000&&f.snapshot().session.phase==='reeling';i++){const s=f.snapshot().session;f.action(s.fishPosition>s.barPosition?'reel-start':'reel-release');f.tick(16);}
  assert.equal(f.snapshot().session.phase,'caught');assert.equal(F.read(f.store.data).catches.length,0);
  const id=f.snapshot().session.id;f.action('cast-start');assert.equal(f.snapshot().session.id,id);
  f.store.inflight=false;f.runTimeouts();await retry;f.runTimeouts();await f.settle();
  assert.equal(F.read(f.store.data).catches.length,1);assert.equal(F.read(f.store.data).casts.length,1);
  f.runTimeouts();await f.settle();assert.equal(F.read(f.store.data).catches.length,1);
});

test('the first cast pauses only until its bait receipt saves without losing or charging bait twice',async()=>{
  const f=await fixture();f.window.Tracer.saveNow=()=>{f.store.dirty=false;f.store.inflight=true;};
  f.action('cast-start');f.tick(900);f.action('cast-release');await f.settle();
  assert.equal(F.read(f.store.data).baits.worm,29);f.tick(3000);assert.equal(f.snapshot().session.phase,'cast');
  f.store.inflight=false;f.runTimeouts();await f.settle();f.tick(650);assert.equal(f.snapshot().session.phase,'waiting');
  assert.equal(F.read(f.store.data).casts.length,1);assert.equal(F.read(f.store.data).baits.worm,29);
});

async function reelToCatch(f){
  f.action('hook');
  for(let i=0;i<3000&&f.snapshot().session.phase==='reeling';i++){
    const s=f.snapshot().session;f.action(s.fishPosition>s.barPosition?'reel-start':'reel-release');f.tick(16);
  }
  assert.equal(f.snapshot().session.phase,'caught');
}

test('a saved catch remains visible for two seconds and rapid inputs never queue another cast',async()=>{
  const f=await fixture();await f.bite();await reelToCatch(f);await f.settle();
  const caughtId=f.snapshot().session.id;
  assert.equal(F.read(f.store.data).catches.length,1,'the pause does not delay saving the catch');
  assert.equal(f.snapshot().recastRemaining,2000);assert.equal(f.snapshot().busy,false);assert.equal(f.snapshot().disabled,false,'presentation timing is separate from saving');
  for(let i=0;i<9;i++){
    f.action('cast-start');f.action('cast-release');f.tick(200);
    assert.equal(f.snapshot().session.id,caughtId);assert.equal(f.snapshot().session.phase,'caught');
  }
  f.tick(199);assert.equal(f.snapshot().recastRemaining,1);f.action('cast-start');assert.equal(f.snapshot().session.id,caughtId);
  f.tick(1);assert.equal(f.snapshot().recastRemaining,0);assert.equal(f.updates.at(-1).recastRemaining,0,'the renderer receives the end of the pause without another input');
  f.tick(1000);assert.equal(f.snapshot().session.phase,'caught','the last rapid press is discarded rather than queued');
  assert.equal(F.read(f.store.data).casts.length,1);assert.equal(F.read(f.store.data).baits.worm,29);
  f.action('cast-start');assert.equal(f.snapshot().session.phase,'charging');assert.notEqual(f.snapshot().session.id,caughtId);
  f.tick(300);f.action('cast-release');await f.settle();
  assert.equal(F.read(f.store.data).casts.length,2);assert.equal(F.read(f.store.data).baits.worm,28);
});

test('the recast pause can expire while a catch is saving without bypassing the save guard',async()=>{
  const f=await fixture();await f.bite();f.store.inflight=true;await reelToCatch(f);await f.settle();
  const caughtId=f.snapshot().session.id;assert.equal(f.snapshot().recastRemaining,2000);assert.equal(F.read(f.store.data).catches.length,0);
  f.tick(2100);assert.equal(f.snapshot().recastRemaining,0);f.action('cast-start');assert.equal(f.snapshot().session.id,caughtId);
  assert.equal(f.snapshot().disabled,true,'an unfinished save continues to block recasting');
  f.store.inflight=false;f.runTimeouts();await f.settle();
  assert.equal(F.read(f.store.data).catches.length,1);assert.equal(f.snapshot().session.phase,'caught');
  f.action('cast-start');assert.equal(f.snapshot().session.phase,'charging');assert.notEqual(f.snapshot().session.id,caughtId);
});

test('recast eligibility uses elapsed time even if the presentation timer was throttled',async()=>{
  const f=await fixture();await f.bite();await reelToCatch(f);await f.settle();
  const caughtId=f.snapshot().session.id;f.skip(1999);f.action('cast-start');assert.equal(f.snapshot().session.id,caughtId);
  f.skip(1);assert.equal(f.snapshot().recastRemaining,0);f.action('cast-start');assert.equal(f.snapshot().session.phase,'charging');
});

test('cancel disposes the result pause publisher without discarding the saved catch',async()=>{
  const f=await fixture();await f.bite();await reelToCatch(f);await f.settle();assert.equal(f.snapshot().recastRemaining,2000);
  f.action('cancel');assert.equal(f.snapshot().recastRemaining,0);const count=f.updates.length;
  f.tick(2500);assert.equal(f.updates.length,count,'a disposed result timer publishes no further snapshots');
  assert.equal(F.read(f.store.data).catches.length,1);assert.equal(F.read(f.store.data).casts.length,1);
});

function stockFish(f,id,bait='worm'){
  const ws=f.store.data;ws.taskGarden.market.testCredit={id:'fish_sale_test',amount:10000,updatedAt:1};
  if(!F.read(ws).baits[bait])assert.equal(F.buyBait(ws,bait,1).ok,true);assert.equal(F.equipBait(ws,bait).ok,true);
  let seed=id==='junk'?890000:id==='mystery_bundle'?970000:0;while(F.createSession(F.empty(),{seed,baitId:bait}).fishId!==id){if(++seed>10000)throw Error('Missing fish '+id);}
  const {session}=F.beginCast(ws,{seed});F.stepSession(session,{},900);F.stepSession(session,{release:true},0);assert.equal(F.commitCast(ws,session).ok,true);
  for(let i=0;i<4000&&!['caught','escaped'].includes(session.phase);i++)F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);
  assert.equal(session.phase,'caught');const caught=F.recordCatch(ws,session);assert.equal(caught.ok,true);return caught;
}

test('desktop projection follows actual pond fish and scenery while nursery fish remain unplaced',async()=>{
  const f=await fixture();stockFish(f,'koi','grain');stockFish(f,'dragonkoi','spirit');
  const s=F.read(f.store.data),koi=s.fry.find(x=>x.fishId==='koi');
  assert.equal(F.placeFry(f.store.data,koi.id,s.activePondId).ok,true);
  let shown=0;f.window.TracerFishing.show=()=>shown++;
  f.action('pin-pond','',{pondId:s.activePondId});
  const projection=f.updates.at(-1).desktopPond;
  assert.equal(shown,1);assert.equal(projection.fish.length,1);assert.equal(projection.fish[0].id,koi.id);assert.equal(projection.fish[0].speciesId,'koi');
  await f.action('pond-style','crystal',{pondId:s.activePondId});assert.equal(f.updates.at(-1).desktopPond.pond.style,'crystal');
  assert.equal(f.updates.at(-1).desktopPond.fish.length,1);
  assert.equal(F.releaseFish(f.store.data,koi.id).ok,true);f.action('pin-pond','',{pondId:s.activePondId});
  assert.equal(f.updates.at(-1).desktopPond.fish.length,0);
});

test('pond nursery actions place and return epic fry, preserve growth, and keep new legends in the aquarium route',async()=>{
  const f=await fixture();stockFish(f,'dreamray','glow');stockFish(f,'dragonkoi','spirit');
  const before=F.read(f.store.data),ray=before.fry.find(x=>x.fishId==='dreamray'),legend=before.fry.find(x=>x.fishId==='dragonkoi'),pondId=before.activePondId;
  assert.equal((await f.action('place-pond-fish',ray.id,{pondId})).ok,true);
  assert(f.updates.at(-1).desktopPond.fish.some(x=>x.id===ray.id&&x.speciesId==='dreamray'));
  assert.equal((await f.action('feed-pond',pondId)).ok,true);
  const fed=structuredClone(F.read(f.store.data).fry.find(x=>x.id===ray.id));
  assert.equal((await f.action('take-pond-fish',ray.id,{pondId})).ok,true);
  const returned=F.read(f.store.data).fry.find(x=>x.id===ray.id);
  assert.equal(returned.pondId,null);assert.equal(returned.growth,fed.growth);assert.equal(returned.fedAt,fed.fedAt);assert.equal(returned.catchId,ray.catchId);
  assert.equal(f.updates.at(-1).desktopPond.fish.length,0);
  assert.equal(await f.action('place-pond-fish',legend.id,{pondId}),null);
  assert.equal(F.read(f.store.data).fry.find(x=>x.id===legend.id).pondId,null);
  assert.equal((await f.action('place-aquarium-fish',legend.id)).ok,true);
  assert(F.read(f.store.data).aquarium.fryIds.includes(legend.id));
});

test('desktop transformation preserves release power, delays the cast and charges bait exactly once',async()=>{
  const f=await fixture(),ws=f.store.data;ws.taskGarden.market.testCredit={id:'summon_test',amount:10000,updatedAt:1};
  assert.equal(F.buyBox(ws,{random:n=>n===10000?5450:0}).rod.id,'golden');F.equipRod(ws,'golden');
  f.window.TracerFishingRodEffects=require('../skins/tracer/fishing-rod-effects');
  f.desktop('cast-start');f.tick(400);f.desktop('cast-release');const power=f.snapshot().session.castPower,bait=F.read(ws).baits.worm;
  f.tick(1800);assert.equal(f.snapshot().session.phase,'charging');assert.equal(f.snapshot().session.castPower,power);assert.equal(F.read(ws).casts.length,0);
  f.desktop('cast-release');f.desktop('cast-start');f.tick(1100);await f.settle();
  assert.equal(f.snapshot().session.phase,'cast');assert.equal(f.snapshot().session.castPower,power);assert.equal(F.read(ws).casts.length,1);assert.equal(F.read(ws).baits.worm,bait-1);
  f.desktop('cancel');f.desktop('cast-start');f.tick(350);f.desktop('cast-release');f.desktop('cancel');f.tick(4000);await f.settle();assert.equal(F.read(ws).casts.length,1,'cancel removes the queued cast');
});

test('account locks cancel queued transformations before bait is charged',async()=>{
  const f=await fixture(),ws=f.store.data;ws.taskGarden.market.testCredit={id:'summon_lock',amount:10000,updatedAt:1};
  F.buyBox(ws,{random:n=>n===10000?5450:0});F.equipRod(ws,'golden');f.window.TracerFishingRodEffects=require('../skins/tracer/fishing-rod-effects');
  f.desktop('cast-start');f.tick(500);f.desktop('cast-release');f.window.TracerAccount.locked=true;f.tick(3000);
  assert.equal(f.snapshot().session.phase,'escaped');assert.equal(F.read(ws).casts.length,0);assert.equal(F.read(ws).baits.worm,30);
});

test('ordinary fish sell directly and sell-all saves every selected catch once',async()=>{
  const f=await fixture(),first=stockFish(f,'minnow'),second=stockFish(f,'carp','grain');
  await f.action('sell-fish',first.catch.id);assert.equal(f.confirmations.length,0);assert.equal(F.read(f.store.data).catches.filter(c=>c.soldAt===null).length,1);
  const balance=F.economy(f.store.data).balance;let saves=0;const save=f.window.Tracer.saveNow;f.window.Tracer.saveNow=()=>{saves++;save();};
  const pending=f.action('sell-all-fish');await f.action('sell-all-fish');await pending;
  assert.equal(f.confirmations.length,0);assert.equal(saves,1);assert.equal(F.economy(f.store.data).balance,balance+second.fish.price);
  assert.equal(F.read(f.store.data).transactions.filter(t=>t.kind==='sale').length,2);assert.match(f.snapshot().notice,/Sold 1 catches/);
  await f.action('sell-all-fish');assert.equal(saves,1,'an empty basket does not create another save');
});

test('legendary single and bulk sales quote exact counts and value before confirmation',async()=>{
  const f=await fixture(),ordinary=stockFish(f,'minnow'),legend=stockFish(f,'dragonkoi','spirit');
  await f.action('place-aquarium-fish',legend.fry.id);const resident=JSON.stringify(F.aquarium(f.store.data));
  const before=JSON.stringify(f.store.data);await f.action('sell-fish',legend.catch.id);
  assert.equal(JSON.stringify(f.store.data),before,'requesting a legendary sale does not mutate inventory');assert.equal(f.confirmations.length,1);
  const single=f.confirmations.pop();assert.match(single.options.body,new RegExp('Sell 1 catches, including 1 legendary, for '+legend.fish.price+' coins'));assert.match(single.options.detail,/aquarium residents/);
  await f.action('sell-all-fish');const batch=f.confirmations.pop();assert.match(batch.options.body,new RegExp('Sell 2 catches, including 1 legendary, for '+(legend.fish.price+ordinary.fish.price)+' coins'));
  const late=stockFish(f,'galaxywhale','stardust');await batch.confirm();await batch.confirm();
  const state=F.read(f.store.data);assert.deepEqual(state.catches.filter(c=>c.soldAt===null).map(c=>c.id),[late.catch.id],'a newly caught legend is excluded from the frozen confirmation');
  assert.equal(state.transactions.filter(t=>t.kind==='sale').length,2);assert.equal(JSON.stringify(F.aquarium(f.store.data).fish),JSON.stringify(JSON.parse(resident).fish));
  await f.action('sell-fish',late.catch.id);await f.confirmations.pop().confirm();assert.equal(F.read(f.store.data).catches.filter(c=>c.soldAt===null).length,0);
});

test('stale legendary confirmation cannot sell a changed selection or another account',async()=>{
  const f=await fixture(),first=stockFish(f,'dragonkoi','spirit'),ordinary=stockFish(f,'minnow');await f.action('sell-all-fish');
  F.sellFish(f.store.data,first.catch.id);const before=JSON.stringify(f.store.data);await f.confirmations.pop().confirm();assert.equal(JSON.stringify(f.store.data),before);assert.match(f.snapshot().error,/basket or account has changed/);
  assert.equal(F.read(f.store.data).catches.find(c=>c.id===ordinary.catch.id).soldAt,null);
  stockFish(f,'galaxywhale','stardust');await f.action('sell-all-fish');f.window.TracerAccount.scope='another-account';const accountBefore=JSON.stringify(f.store.data);
  await f.confirmations.pop().confirm();assert.equal(JSON.stringify(f.store.data),accountBefore);assert.match(f.snapshot().error,/basket or account has changed/);
});

test('failed fish bulk sale persistence retries the same receipts without duplicate earnings',async()=>{
  const f=await fixture();stockFish(f,'minnow');stockFish(f,'carp','grain');const save=f.window.Tracer.saveNow;
  f.window.Tracer.saveNow=()=>{};await f.action('sell-all-fish');assert.match(f.snapshot().error,/not saved/);const after=JSON.stringify(f.store.data),balance=F.economy(f.store.data).balance;
  f.window.Tracer.saveNow=save;await f.action('sell-all-fish');assert.equal(JSON.stringify(f.store.data),after);assert.equal(F.economy(f.store.data).balance,balance);assert.equal(F.read(f.store.data).transactions.filter(t=>t.kind==='sale').length,2);assert.match(f.snapshot().notice,/Sold 2 catches/);assert.equal(f.snapshot().error,'');
});


test('a completed desktop summon charges immediately without replaying the transformation or double spending bait',async()=>{
  const f=await fixture(),ws=f.store.data;ws.taskGarden.market.testCredit={id:'ready_summon',amount:10000,updatedAt:1};
  F.buyBox(ws,{random:n=>n===10000?5450:0});F.equipRod(ws,'golden');f.window.TracerFishingRodEffects=require('../skins/tracer/fishing-rod-effects');
  const bait=F.read(ws).baits.worm;
  f.desktop('cast-start',{entranceReady:true});f.tick(400);f.desktop('cast-release');await f.settle();
  assert.equal(f.snapshot().session.phase,'cast');assert.equal(F.read(ws).casts.length,1);assert.equal(F.read(ws).baits.worm,bait-1);
});

test('junk and bundle casts project their real catch item and preserve the saved product identity',async()=>{
  for(const seed of [890002,970000]){
    const f=await fixture();f.window.TracerFishingModel.beginCast=(workspace,options)=>F.beginCast(workspace,{...options,seed});
    await f.bite();assert.equal(f.snapshot().fish.kind,seed===970000?'mystery':'junk');assert.equal(f.updates.at(-1).fish.id,f.snapshot().session.fishId);
    if(seed!==970000)assert.equal(f.updates.at(-1).fish.variant,f.snapshot().session.variant);
    await reelToCatch(f);await f.settle();assert.equal(F.read(f.store.data).catches.length,1);assert.equal(F.read(f.store.data).fry.length,0);assert.equal(f.snapshot().lastCatch.fish.kind,seed===970000?'mystery':'junk');
  }
});

test('sell-all includes one-coin junk but keeps unopened and opened mystery bundles',async()=>{
  const f=await fixture(),fish=stockFish(f,'minnow'),junk=stockFish(f,'junk'),bundle=stockFish(f,'mystery_bundle'),opened=stockFish(f,'mystery_bundle');
  F.openMysteryBundle(f.store.data,opened.catch.id,{random:()=>0});const balance=F.economy(f.store.data).balance;
  await f.action('sell-all-fish');assert.equal(f.confirmations.length,0);assert.equal(F.economy(f.store.data).balance,balance+fish.fish.price+1);
  assert.deepEqual(F.read(f.store.data).catches.filter(c=>c.soldAt===null).map(c=>c.id),[bundle.catch.id,opened.catch.id]);
  assert.match(f.snapshot().notice,/Sold 2 catches/);const before=JSON.stringify(f.store.data);await f.action('sell-fish',bundle.catch.id);assert.equal(JSON.stringify(f.store.data),before);
  assert.equal(F.read(f.store.data).catches.find(c=>c.id===junk.catch.id).soldAt!==null,true);
});

test('a mystery gift is revealed only after saving and retries never open or pay twice',async()=>{
  const f=await fixture(),bundle=stockFish(f,'mystery_bundle');let openings=0;
  f.window.TracerFishingModel.openMysteryBundle=(ws,id)=>{openings++;return F.openMysteryBundle(ws,id,{random:()=>0});};
  const save=f.window.Tracer.saveNow;f.window.Tracer.saveNow=()=>{};
  await f.action('open-bundle',bundle.catch.id);assert.equal(openings,1);assert.equal(f.rewards.revealed.length,0);assert.match(f.snapshot().error,/not saved/);
  assert.equal(f.snapshot().state.giftUnlocks.length,0,'an unsaved gift also stays hidden from collection previews');assert.equal(f.snapshot().state.catches.find(c=>c.id===bundle.catch.id).openedAt,null);
  assert.equal(F.read(f.store.data).mysteryOpenings.length,1);const state=JSON.stringify(f.store.data);
  f.window.Tracer.saveNow=save;await f.action('open-bundle',bundle.catch.id);
  assert.equal(openings,1);assert.equal(JSON.stringify(f.store.data),state);assert.equal(f.rewards.revealed.length,1);assert.equal(f.rewards.revealed[0].gift.id,'tide_crown');assert.equal(f.snapshot().error,'');
  await f.action('retry-save');assert.equal(f.rewards.revealed.length,1);
});

test('gift wear and removal actions save each slot and refresh the applied appearance',async()=>{
  const f=await fixture();for(let i=0;i<6;i++)F.openMysteryBundle(f.store.data,stockFish(f,'mystery_bundle').catch.id,{random:()=>0});
  await f.action('equip-gift','dragon_seal');assert.equal(F.read(f.store.data).giftAppearance.avatarFrameId,'dragon_seal');
  await f.action('equip-gift','cloud_koi_garden',{slot:'background'});assert.equal(f.rewards.applied.at(-1).giftAppearance.backgroundId,'cloud_koi_garden');
  await f.action('remove-gift','avatarFrame');assert.equal(F.read(f.store.data).giftAppearance.avatarFrameId,null);assert.equal(F.read(f.store.data).giftAppearance.backgroundId,'cloud_koi_garden');
  await f.action('remove-gift','',{slot:'background'});assert.equal(f.rewards.applied.at(-1).giftAppearance.backgroundId,null);
});

test('account changes while a gift is saving discard the old reveal and clear its decoration',async()=>{
  const f=await fixture(),bundle=stockFish(f,'mystery_bundle'),old=f.store.data;
  f.window.Tracer.saveNow=()=>{f.store.dirty=false;f.store.inflight=true;};
  const opening=f.action('open-bundle',bundle.catch.id);await f.settle();assert.equal(F.read(old).mysteryOpenings.length,1);assert.equal(f.rewards.revealed.length,0);
  f.window.TracerAccount.scope='next-account';f.window.TracerAccount.locked=true;f.window.Tracer.fishing.cancel();assert(f.rewards.cleared>0);
  f.store.data=M.emptyWorkspace();F.ensure(f.store.data);f.store.inflight=false;f.runTimeouts();await opening;
  assert.equal(f.rewards.revealed.length,0);assert.equal(F.read(f.store.data).mysteryOpenings.length,0);
  const clears=f.rewards.cleared;f.window.Tracer.fishing.refresh();assert(f.rewards.cleared>clears);
});

test('an account change before the initial flush cannot apply an old bundle action to new data',async()=>{
  const f=await fixture(),bundle=stockFish(f,'mystery_bundle');let calls=0;
  f.window.TracerFishingModel.openMysteryBundle=(ws,id)=>{calls++;return F.openMysteryBundle(ws,id);};f.store.inflight=true;
  const opening=f.action('open-bundle',bundle.catch.id);await f.settle();f.window.TracerAccount.context.generation++;
  f.store.data=M.emptyWorkspace();F.ensure(f.store.data);f.store.inflight=false;f.runTimeouts();await opening;
  assert.equal(calls,0);assert.equal(F.read(f.store.data).mysteryOpenings.length,0);assert.equal(f.rewards.revealed.length,0);
});

test('switch preparation and unload clear gift decoration and stale retry cannot reveal another account reward',async()=>{
  const f=await fixture(),bundle=stockFish(f,'mystery_bundle'),save=f.window.Tracer.saveNow;
  f.window.Tracer.saveNow=()=>{};await f.action('open-bundle',bundle.catch.id);f.window.Tracer.saveNow=save;
  f.window.TracerAccount.scope='next';await f.action('retry-save');assert.equal(f.rewards.revealed.length,0);assert(f.rewards.cleared>0);
  const before=f.rewards.cleared;await f.window.Tracer.fishing.prepareAccountSwitch();assert(f.rewards.cleared>=before+2);
  f.event('beforeunload');assert(f.rewards.cleared>before+2);
});
