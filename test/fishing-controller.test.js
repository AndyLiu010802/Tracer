'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model');
const source=fs.readFileSync(require.resolve('../skins/tracer/fishing.js'),'utf8');

async function fixture(){
  const ws=M.emptyWorkspace();F.ensure(ws);
  let now=1000,serial=0,desktopAction;const timers=new Map(),updates=[],listeners=new Map(),confirmations=[],rewards={applied:[],revealed:[],cleared:0};
  const store={data:ws,base:structuredClone(ws),dirty:false,inflight:false,lost:false,timer:0};
  const node={textContent:'',addEventListener(){}};
  const modals=[];
  const document={hidden:false,getElementById:()=>node,addEventListener(){},body:{append:modal=>modals.push(modal)},createElement:()=>{
    const events=new Map();return{innerHTML:'',setAttribute(){},addEventListener:(name,fn)=>events.set(name,fn),showModal(){this.open=true;},close(){this.open=false;events.get('close')?.();},remove(){this.removed=true;}};
  }};
  const window={Tracer:{store,sections:[],ready:Promise.resolve(ws),currentSec:()=>'',onShow(){},touch(){store.dirty=true;},saveNow(){store.dirty=false;store.inflight=false;},garden:{refresh(){}},show(){}},TracerFishingModel:{...F,beginCast:(workspace,options)=>F.beginCast(workspace,{...options,seed:0,now})},TracerFishing:{update:snapshot=>updates.push({...snapshot,session:snapshot.session&&{...snapshot.session}}),onAction:fn=>{desktopAction=fn;return()=>{};}},TracerAccount:{scope:'guest',context:{generation:1,restoreId:''},locked:false,switching:false},addEventListener:(type,fn)=>listeners.set(type,fn)};
  window.TracerFishingRewards={apply:state=>rewards.applied.push(structuredClone(state)),reveal:result=>rewards.revealed.push(structuredClone(result)),clear:()=>rewards.cleared++};
  window.TracerFishingArt={escape:String,rodMarkup:rod=>'<svg data-rod-id="'+rod.id+'"></svg>'};
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
  return{window,store,updates,action,tick,skip,settle,runTimeouts,bite,snapshot,confirmations,rewards,modals,event(type){listeners.get(type)?.();},desktop(type,extra={}){desktopAction({type,accountScope:window.TracerAccount.scope,accountGeneration:window.TracerAccount.context.generation,accountRestoreId:'',sessionId:snapshot().session?.id||'',...extra});}};
}

test('live desktop snapshots are bounded before IPC and do not rescan the economy each tick',async()=>{
  const f=await fixture();let reads=0;const original=f.window.TracerFishingModel.economy;f.window.TracerFishingModel.economy=(...args)=>{reads++;return original(...args);};
  await f.bite();f.action('hook');await f.settle();const before=reads;
  for(let i=0;i<12;i++)f.tick(32);
  assert.equal(reads,before,'animation ticks reuse the balance from the last inventory refresh');
  const update=f.updates.at(-1);assert(update.session);assert(update.tackle.baits.length===5);
  for(const key of ['catalog','state','showcase','progression','economy'])assert.equal(key in update,false,key+' does not cross the bridge');
  assert(JSON.stringify(update).length<30000);
});

test('rapid ten-draw clicks purchase one batch and show all ten results only after persistence',async()=>{
  const f=await fixture();f.store.data.taskGarden.market.testCredit={id:'batch_controller',amount:10000,updatedAt:1};
  const save=f.window.Tracer.saveNow;f.window.Tracer.saveNow=()=>{f.store.dirty=false;f.store.inflight=true;};
  const pending=f.action('buy-ten-boxes','naruto');await f.settle();
  assert.equal(F.read(f.store.data).boxes.length,10);assert.equal(f.modals.length,0);
  await f.action('buy-ten-boxes','naruto');await f.action('buy-box','naruto');assert.equal(F.read(f.store.data).boxes.length,10);
  f.window.Tracer.saveNow=save;f.store.inflight=false;f.runTimeouts();await pending;
  assert.equal(f.modals.length,1);assert.equal((f.modals[0].innerHTML.match(/class="fishing-batch-card"/g)||[]).length,10);
  assert.match(f.modals[0].innerHTML,/Spent 1000 coins/);
});

test('ten-draw save retries preserve the exact ten receipts, balance and result without another random draw',async()=>{
  const f=await fixture();f.store.data.taskGarden.market.testCredit={id:'batch_retry',amount:10000,updatedAt:1};
  const save=f.window.Tracer.saveNow;f.window.Tracer.saveNow=()=>{throw Error('offline');};
  await f.action('buy-ten-boxes','onepiece');assert.match(f.snapshot().error,/not saved/);assert.equal(f.modals.length,0);
  const receipts=structuredClone(f.store.data.fishing.boxes),coins=F.economy(f.store.data).balance;
  f.window.Tracer.saveNow=save;await f.action('retry-save');await f.action('retry-save');
  assert.deepEqual(f.store.data.fishing.boxes,receipts);assert.equal(F.economy(f.store.data).balance,coins);assert.equal(f.modals.length,1);
});

test('mature rare fish harvest directly while legendary adults wait for explicit confirmation',async()=>{
  const f=await fixture(),rare=stockFish(f,'koi','grain'),legend=stockFish(f,'dragonkoi','spirit');
  f.store.data.fishing.fry.forEach(row=>row.growth=100);F.placeAquariumFish(f.store.data,legend.fry.id,true);
  await f.action('harvest-fish',rare.fry.id);assert.equal(f.confirmations.length,0);assert.equal(F.read(f.store.data).fry.find(row=>row.id===rare.fry.id).growth,100);
  const before=JSON.stringify(f.store.data);await f.action('harvest-fish',legend.fry.id);assert.equal(JSON.stringify(f.store.data),before);
  const confirmation=f.confirmations.pop();assert.match(confirmation.options.body,new RegExp(F.harvestValue(legend.fish)+' coins'));assert.match(confirmation.options.detail,/permanently/);
  const coins=F.economy(f.store.data).balance;await confirmation.confirm();await confirmation.confirm();
  assert.equal(F.economy(f.store.data).balance,coins+F.harvestValue(legend.fish));assert.equal(F.aquarium(f.store.data).fish.length,0);
  assert.equal(F.read(f.store.data).transactions.filter(t=>t.kind==='harvest').length,2);
});

test('a stale harvest confirmation cannot sell a different account or already removed fish',async()=>{
  for(const change of ['account','release']){
    const f=await fixture(),legend=stockFish(f,'dragonkoi','spirit');f.store.data.fishing.fry[0].growth=100;
    await f.action('harvest-fish',legend.fry.id);const confirmation=f.confirmations.pop();
    if(change==='account')f.window.TracerAccount.scope='another';else F.releaseFish(f.store.data,legend.fry.id);
    const before=JSON.stringify(f.store.data);await confirmation.confirm();assert.equal(JSON.stringify(f.store.data),before);assert.equal(F.read(f.store.data).transactions.filter(t=>t.kind==='harvest').length,0);
  }
});

test('failed harvest persistence retries the same receipt and never pays twice',async()=>{
  const f=await fixture(),fish=stockFish(f,'koi','grain');f.store.data.fishing.fry[0].growth=100;const save=f.window.Tracer.saveNow;
  f.window.Tracer.saveNow=()=>{throw Error('offline');};const coins=F.economy(f.store.data).balance;await f.action('harvest-fish',fish.fry.id);
  assert.match(f.snapshot().error,/not saved/);assert.equal(F.economy(f.store.data).balance,coins+F.harvestValue(fish.fish));
  f.window.Tracer.saveNow=save;await f.action('retry-save');await f.action('harvest-fish',fish.fry.id);
  assert.equal(F.read(f.store.data).transactions.filter(t=>t.kind==='harvest').length,1);assert.equal(F.economy(f.store.data).balance,coins+F.harvestValue(fish.fish));
});

test('the player may select fishing grounds but cannot choose weather, time or archive a pond',async()=>{
  const f=await fixture();f.store.data.taskGarden.market.testCredit={id:'ground_test',amount:100000,updatedAt:1};await f.action('unlock-ground','reef');await f.action('set-expedition','',{patch:{spotId:'reef'}});assert.equal(f.snapshot().expedition.spot.id,'reef');
  const before=JSON.stringify(f.store.data);
  for(const patch of [{timeId:'night'},{weatherId:'rain'},{spotId:'moon',weatherId:'rain'}]){await f.action('set-expedition','',{patch});assert.equal(JSON.stringify(f.store.data),before);}
  await f.action('archive-request','pond_starter');assert.equal(f.confirmations.length,0);assert.equal(JSON.stringify(f.store.data),before);
  assert.equal(f.snapshot().expedition.weather.id,'unknown');
});

test('a throttled controller tick spends the full bite deadline and awards no catch',async()=>{
  const f=await fixture();await f.bite();f.tick(3000);
  assert.equal(f.snapshot().session.phase,'escaped');assert.equal(f.snapshot().session.reason,'missed-bite');
  assert.equal(F.read(f.store.data).catches.length,0);assert.equal(F.read(f.store.data).baits.earthworm,29);
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
  assert.equal(F.read(f.store.data).baits.earthworm,29);f.tick(3000);assert.equal(f.snapshot().session.phase,'cast');
  f.store.inflight=false;f.runTimeouts();await f.settle();f.tick(650);assert.equal(f.snapshot().session.phase,'waiting');
  assert.equal(F.read(f.store.data).casts.length,1);assert.equal(F.read(f.store.data).baits.earthworm,29);
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
  assert.equal(F.read(f.store.data).casts.length,1);assert.equal(F.read(f.store.data).baits.earthworm,29);
  f.action('cast-start');assert.equal(f.snapshot().session.phase,'charging');assert.notEqual(f.snapshot().session.id,caughtId);
  f.tick(300);f.action('cast-release');await f.settle();
  assert.equal(F.read(f.store.data).casts.length,2);assert.equal(F.read(f.store.data).baits.earthworm,28);
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

function stockMotor(f,remaining=2){
  const reward=stockFish(f,'mystery_bundle');F.openMysteryBundle(f.store.data,reward.catch.id,{random:n=>n-1});
  while(F.read(f.store.data).baits.earthworm>remaining){const {session:s}=F.beginCast(f.store.data,{seed:0});F.stepSession(s,{release:true,heldMs:650},0);F.commitCast(f.store.data,s);F.stepSession(s,{cancel:true},0);}
  f.window.Tracer.fishing.refresh();
}
test('motor installs, uses every bait inventory, saves each catch once and stops without buying bait',async()=>{
  const f=await fixture();stockMotor(f,2);F.buyBait(f.store.data,'prawn',1);const before=F.read(f.store.data),balance=F.economy(f.store.data).balance;
  await f.action('install-motor');assert(f.snapshot().autoMotor.running);const phases=new Set();
  for(let i=0;i<600&&f.snapshot().autoMotor.running;i++){f.tick(1000);await f.settle();phases.add(f.snapshot().session?.phase);}
  const after=F.read(f.store.data);assert.equal(f.snapshot().autoMotor.running,false);assert.equal(f.snapshot().autoMotor.reason,'empty');assert.equal(f.snapshot().autoMotor.baitCount,0);
  assert.equal(after.casts.length-before.casts.length,12);assert.equal(after.catches.length-before.catches.length,12);assert.equal(F.economy(f.store.data).balance,balance);assert(phases.has('reeling'));assert(phases.has('caught'));
  assert.equal(after.transactions.filter(t=>t.kind==='bait').length,before.transactions.filter(t=>t.kind==='bait').length);assert.equal(new Set(after.catches.map(c=>c.id)).size,after.catches.length);
});
test('motor pause, stale desktop requests and account changes cannot continue consuming bait',async()=>{
  const f=await fixture();stockMotor(f,4);await f.action('install-motor');f.tick(1000);await f.settle();assert(f.snapshot().session.automatic);
  f.desktop('pause-motor',{accountScope:'obsolete'});assert(f.snapshot().autoMotor.running);f.desktop('pause-motor');assert(!f.snapshot().autoMotor.running);
  const paused=F.read(f.store.data).casts.length;for(let i=0;i<5;i++){f.tick(1000);await f.settle();}assert.equal(F.read(f.store.data).casts.length,paused);
  f.action('start-motor');f.tick(1000);await f.settle();f.window.TracerAccount.context.generation++;const before=F.read(f.store.data).casts.length;f.tick(1000);await f.settle();assert(!f.snapshot().autoMotor.running);assert.equal(F.read(f.store.data).casts.length,before);
});
test('motor never starts from an unsaved unlock or installation and retry preserves the one rare reward',async()=>{
  const f=await fixture(),gift=stockFish(f,'mystery_bundle'),save=f.window.Tracer.saveNow;f.window.TracerFishingModel.openMysteryBundle=(ws,id)=>F.openMysteryBundle(ws,id,{random:n=>n-1});
  f.window.Tracer.saveNow=()=>{throw Error('offline');};await f.action('open-bundle',gift.catch.id);assert.equal(f.snapshot().autoMotor.owned,false);assert.equal(f.snapshot().progression.achievements.find(a=>a.id==='fortune_child').complete,false);assert.equal(f.rewards.revealed.length,0);
  f.window.Tracer.saveNow=save;await f.action('retry-save');assert.equal(f.rewards.revealed.length,1);assert.equal(f.snapshot().autoMotor.owned,true);
  f.window.Tracer.saveNow=()=>{throw Error('offline');};await f.action('install-motor');f.tick(1000);await f.settle();assert.equal(f.snapshot().autoMotor.running,false);
  f.window.Tracer.saveNow=save;await f.action('retry-save');f.tick(1000);await f.settle();assert(f.snapshot().autoMotor.running);assert.equal(F.read(f.store.data).mysteryOpenings.length,1);
});
test('motor stops new casts after a failed bait receipt save and does not deduct again on retry',async()=>{
  const f=await fixture();stockMotor(f,3);await f.action('install-motor');f.tick(100);await f.settle();const before=F.read(f.store.data).baits.earthworm,save=f.window.Tracer.saveNow;
  f.window.Tracer.saveNow=()=>{throw Error('offline');};f.tick(1000);await f.settle();assert(!f.snapshot().autoMotor.running);assert.equal(F.read(f.store.data).baits.earthworm,before-1);
  for(let i=0;i<4;i++){f.tick(1000);await f.settle();}assert.equal(F.read(f.store.data).baits.earthworm,before-1);
  f.window.Tracer.saveNow=save;await f.action('retry-save');assert.equal(F.read(f.store.data).baits.earthworm,before-1);
});

test('desktop projection follows selected ground scenery and actual pond fish while nursery fish remain unplaced',async()=>{
  const f=await fixture();stockFish(f,'koi','grain');stockFish(f,'dragonkoi','spirit');
  const s=F.read(f.store.data),koi=s.fry.find(x=>x.fishId==='koi');
  assert.equal(F.placeFry(f.store.data,koi.id,s.activePondId).ok,true);
  let shown=0;f.window.TracerFishing.show=()=>shown++;
  f.action('pin-pond','',{pondId:s.activePondId});
  const projection=f.updates.at(-1).desktopPond;
  assert.equal(shown,1);assert.equal(projection.fish.length,1);assert.equal(projection.fish[0].id,koi.id);assert.equal(projection.fish[0].speciesId,'koi');
  await f.action('pond-style','crystal',{pondId:s.activePondId});assert.equal(f.updates.at(-1).desktopPond.pond.style,'meadow');
  f.store.data.taskGarden.market.testCredit={id:'ground_test',amount:100000,updatedAt:1};for(const spot of F.catalog.spots){await f.action('unlock-ground',spot.id);await f.action('set-expedition','',{patch:{spotId:spot.id}});assert.equal(f.updates.at(-1).desktopPond.pond.style,spot.style);assert.equal(f.updates.at(-1).spot.pondStyle,spot.style);}
  assert.equal(F.read(f.store.data).ponds[0].styleId,'crystal','ground changes do not overwrite nursery customization');
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

test('desktop release starts flight immediately, independent of the entrance duration',async()=>{
  const f=await fixture(),ws=f.store.data;ws.taskGarden.market.testCredit={id:'summon_test',amount:10000,updatedAt:1};
  F.buyBox(ws,{random:n=>n===10000?5450:0});F.equipRod(ws,'golden');f.window.TracerFishingRodEffects=require('../skins/tracer/fishing-rod-effects');
  f.desktop('cast-start');f.tick(400);const bait=F.read(ws).baits.earthworm;
  f.desktop('cast-release');assert.equal(f.snapshot().session.phase,'cast');assert(Math.abs(f.snapshot().session.castPower-400/1100)<1e-10);
  f.desktop('cast-release');f.desktop('cast-start');await f.settle();
  assert.equal(F.read(ws).casts.length,1);assert.equal(F.read(ws).baits.earthworm,bait-1);
});

test('account locks cancel charging without spending bait',async()=>{
  const f=await fixture();f.desktop('cast-start');f.tick(500);f.window.TracerAccount.locked=true;f.desktop('cast-release');f.tick(32);
  assert.equal(f.snapshot().session.phase,'escaped');assert.equal(F.read(f.store.data).casts.length,0);assert.equal(F.read(f.store.data).baits.earthworm,30);
});

test('originating hold time determines distance despite delayed desktop release delivery',async()=>{
  for(const heldMs of [180,420,770,1100]){
    const f=await fixture();f.desktop('cast-start');f.tick(heldMs+220);f.desktop('cast-release',{heldMs});await f.settle();
    const s=f.snapshot().session;assert.equal(s.phase,'cast');assert(Math.abs(s.castPower-heldMs/1100)<1e-10);assert(Math.abs(s.castDistance-(.15+.85*heldMs/1100))<1e-10);assert.equal(F.read(f.store.data).casts.length,1);
  }
  const f=await fixture();f.desktop('cast-start');f.tick(300);f.desktop('cast-release',{heldMs:70});assert.equal(f.snapshot().session.phase,'escaped');assert.equal(F.read(f.store.data).casts.length,0);
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
  const bait=F.read(ws).baits.earthworm;
  f.desktop('cast-start',{entranceReady:true});f.tick(400);f.desktop('cast-release');await f.settle();
  assert.equal(f.snapshot().session.phase,'cast');assert.equal(F.read(ws).casts.length,1);assert.equal(F.read(ws).baits.earthworm,bait-1);
});

test('junk and bundle casts project their real catch item and preserve the saved product identity',async()=>{
  for(const target of ['junk','mystery_bundle']){
    let seed=0;for(;seed<10000;seed++){const s=F.createSession(F.empty(),{seed,expedition:{spotId:'creek',timeId:'day',weatherId:'clear'}});F.stepSession(s,{},400);F.stepSession(s,{release:true},0);if(s.fishId===target)break;}assert(seed<10000);
    const f=await fixture();f.window.TracerFishingModel.beginCast=(workspace,options)=>F.beginCast(workspace,{...options,seed});
    await f.bite();assert.equal(f.snapshot().fish.kind,target==='mystery_bundle'?'mystery':'junk');assert.equal(f.updates.at(-1).fish.id,f.snapshot().session.fishId);
    if(target!=='mystery_bundle')assert.equal(f.updates.at(-1).fish.variant,f.snapshot().session.variant);
    await reelToCatch(f);await f.settle();assert.equal(F.read(f.store.data).catches.length,1);assert.equal(F.read(f.store.data).fry.length,0);assert.equal(f.snapshot().lastCatch.fish.kind,target==='mystery_bundle'?'mystery':'junk');
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


function creditBaitWallet(f,amount=100){f.store.data.taskGarden.market.testCredit={id:'qa_credit',amount,updatedAt:1};f.window.Tracer.fishing.refresh();}

test('desktop bait purchasing and equipping use the shared wallet, one receipt and no main-app navigation',async()=>{
  const f=await fixture();creditBaitWallet(f);let visits=0;f.window.Tracer.show=()=>visits++;
  assert.equal(f.snapshot().tackle.coins,100);assert.equal(f.snapshot().tackle.baits.length,5);
  f.desktop('buy-equip-bait',{value:'prawn',price:0,quantity:99});f.desktop('buy-equip-bait',{value:'prawn'});await f.settle();
  assert.equal(F.economy(f.store.data).balance,70);assert.equal(F.read(f.store.data).baits.prawn,10);assert.equal(F.read(f.store.data).equippedBaitId,'prawn');
  assert.equal(F.read(f.store.data).transactions.filter(t=>t.kind==='bait').length,1);assert.equal(visits,0);
  f.desktop('equip-bait',{value:'earthworm'});await f.settle();assert.equal(F.read(f.store.data).equippedBaitId,'earthworm');assert.equal(F.economy(f.store.data).balance,70);
  assert.equal(f.updates.at(-1).tackle.baits.find(b=>b.id==='prawn').count,10);
});

test('desktop bait purchases reject stale accounts, active casts, unknown bait and insufficient funds',async()=>{
  for(const reason of ['account','restore','session','active','unknown','coins']){
    const f=await fixture();creditBaitWallet(f,reason==='coins'?0:100);
    if(reason==='active')f.action('cast-start');
    const before=JSON.stringify(f.store.data),extra={value:'prawn'};
    if(reason==='account')extra.accountScope='obsolete';if(reason==='restore')extra.accountRestoreId='obsolete';if(reason==='session')extra.sessionId='obsolete';if(reason==='unknown')extra.value='grain';
    f.desktop('buy-equip-bait',extra);await f.settle();assert.equal(JSON.stringify(f.store.data),before,reason);
  }
});

test('failed desktop bait persistence retries the original purchase without charging or stocking twice',async()=>{
  const f=await fixture();creditBaitWallet(f);const save=f.window.Tracer.saveNow;
  f.window.Tracer.saveNow=()=>{throw Error('offline');};f.desktop('buy-equip-bait',{value:'cutbait'});await f.settle();
  assert.equal(f.snapshot().tackle.pendingSave,true);assert.equal(F.read(f.store.data).baits.cutbait,10);assert.equal(F.economy(f.store.data).balance,70);
  f.window.Tracer.saveNow=save;f.desktop('retry-save');await f.settle();
  assert.equal(f.snapshot().tackle.pendingSave,false);assert.equal(F.read(f.store.data).baits.cutbait,10);assert.equal(F.read(f.store.data).equippedBaitId,'cutbait');assert.equal(F.economy(f.store.data).balance,70);
  assert.equal(F.read(f.store.data).transactions.filter(t=>t.kind==='bait').length,1);
});


test('ordinary queued workspace changes flush automatically before a desktop bait purchase',async()=>{
  const f=await fixture();creditBaitWallet(f);f.store.dirty=true;f.window.Tracer.fishing.refresh();
  assert.equal(f.snapshot().tackle.pendingSave,false,'ordinary autosave is not a failed purchase');
  f.desktop('buy-bait',{value:'prawn'});await f.settle();
  assert.equal(F.economy(f.store.data).balance,70);assert.equal(F.read(f.store.data).baits.prawn,10);assert.equal(f.store.dirty,false);
});
