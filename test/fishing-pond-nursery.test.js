'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync');
const copy=structuredClone;
function workspace(){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'pond_nursery_test',amount:10000,updatedAt:1};return ws;}
function land(ws,id,bait,now=1000){
  if(!F.read(ws).baits[bait])assert.equal(F.buyBait(ws,bait,1,now).ok,true);
  assert.equal(F.equipBait(ws,bait,now).ok,true);let seed=0;
  while(F.createSession(F.empty(),{baitId:bait,seed,now}).fishId!==id){if(++seed>1000)throw Error('Unreachable fish '+id);}
  const {session}=F.beginCast(ws,{seed,now});F.stepSession(session,{},900);F.stepSession(session,{release:true},0);assert.equal(F.commitCast(ws,session,now+1).ok,true);
  for(let frame=0;frame<3000&&!['caught','escaped'].includes(session.phase);frame++)F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);
  assert.equal(session.phase,'caught',id+' lands through the authoritative simulation');return F.recordCatch(ws,session,now+20000);
}
async function desktopSnapshot(ws){
  const node={textContent:'',addEventListener(){}},window={Tracer:{store:{data:ws,dirty:false,inflight:false,lost:false},ready:Promise.resolve(ws),sections:[],currentSec:()=>'',onShow(){},touch(){},saveNow(){},garden:{refresh(){}}},TracerFishingModel:F,TracerAccount:{scope:'pond-test',context:{generation:1,restoreId:''},locked:false,switching:false},addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/fishing.js'),'utf8'),{window,document:{hidden:false,getElementById:()=>node,addEventListener(){}},TracerLocale:{language:()=> 'zh'},performance:{now:()=>1000},setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){}});
  await Promise.resolve();await Promise.resolve();return window.Tracer.fishing.snapshot().desktopPond;
}

test('Dream ray gives a real epic fingerling that survives sale, enters the pond and appears on desktop after reload',async()=>{
  const ws=workspace(),catalog=F.catalog.fish.find(f=>f.id==='dreamray');assert.equal(catalog.rarity,'epic');assert.equal(catalog.fry,true);
  const result=land(ws,'dreamray','glow');assert.equal(result.ok,true);assert(result.fry);assert.equal(result.fry.fishId,'dreamray');assert.equal(result.fry.catchId,result.catch.id);assert.equal(result.fry.pondId,null);
  assert.deepEqual(F.read(ws).fry,[result.fry]);assert.equal((await desktopSnapshot(ws)).fish.length,0,'nursery fish do not appear until placed');
  assert.equal(F.placeAquariumFish(ws,result.fry.id,true,22000).reason,'showcase-not-legendary');
  assert.equal(F.sellFish(ws,result.catch.id,22001).earned,catalog.price);assert.deepEqual(F.read(ws).fry,[result.fry],'selling the adult does not consume its fingerling');
  const pondId=F.read(ws).activePondId;assert.equal(F.placeFry(ws,result.fry.id,pondId,22002).ok,true);const fishBeforeReload=copy(F.read(ws).fry[0]);
  const desktop=await desktopSnapshot(ws);assert.equal(desktop.pond.id,pondId);assert.equal(desktop.fish.length,1);assert.equal(desktop.fish[0].id,result.fry.id);assert.equal(desktop.fish[0].speciesId,'dreamray');assert.equal(desktop.fish[0].body,'ray');assert.equal(desktop.fish[0].name[0],'星梦鳐鱼');
  const reloaded=S.validate(JSON.parse(JSON.stringify(ws)));assert.deepEqual(F.read(reloaded).fry[0],fishBeforeReload);assert.deepEqual(JSON.parse(JSON.stringify(await desktopSnapshot(reloaded))),JSON.parse(JSON.stringify(desktop)));assert.equal(F.read(reloaded).catches[0].soldAt,22001);
});

test('nonlegendary rare and epic fry remain pond candidates while legendary fry retain their aquarium route',()=>{
  const ws=workspace(),rare=land(ws,'koi','grain'),epic=land(ws,'dreamray','glow',30000),legend=land(ws,'dragonkoi','spirit',60000),ordinary=land(ws,'minnow','worm',90000);
  assert.equal(ordinary.fry,null);const nursery=F.read(ws).fry.filter(f=>f.pondId===null&&f.releasedAt===null);
  const pondCandidates=nursery.filter(f=>{const species=F.catalog.fish.find(s=>s.id===f.fishId);return species.fry&&species.rarity!=='legendary';});
  const aquariumCandidates=nursery.filter(f=>F.catalog.fish.find(s=>s.id===f.fishId).rarity==='legendary');
  assert.deepEqual(pondCandidates.map(f=>f.id),[rare.fry.id,epic.fry.id]);assert.deepEqual(aquariumCandidates.map(f=>f.id),[legend.fry.id]);
  for(const result of [rare,epic]){assert.equal(F.placeAquariumFish(ws,result.fry.id,true,120000).reason,'showcase-not-legendary');assert.equal(F.placeFry(ws,result.fry.id,'pond_starter',120001).ok,true);}
  assert.equal(F.placeAquariumFish(ws,legend.fry.id,true,120002).ok,true);assert.equal(F.aquarium(ws).fish[0].speciesId,'dragonkoi');assert.equal(F.read(ws).ponds[0].fishIds.length,2);
});

test('a Dream ray pond still requires exactly five residents to archive and rejects a sixth without changing stock',async()=>{
  const ws=workspace(),species=[['dreamray','glow'],['koi','grain'],['goldfish','grain'],['moonfin','stardust'],['crystal','frost'],['seahorse','shrimp']],catches=species.map(([id,bait],i)=>land(ws,id,bait,1000+i*30000));
  const pondId=F.read(ws).activePondId;assert.equal(F.placeFry(ws,catches[0].fry.id,pondId,200000).ok,true);assert.equal(F.archivePond(ws,pondId,200001).reason,'requires-five-fish');
  for(const caught of catches.slice(1,5))assert.equal(F.placeFry(ws,caught.fry.id,pondId,200002).ok,true);
  const before=copy(ws);assert.equal(F.placeFry(ws,catches[5].fry.id,pondId,200003).reason,'pond-full');assert.deepEqual(ws,before);
  const archived=F.archivePond(ws,pondId,200004);assert.equal(archived.ok,true);assert.equal(F.read(ws).ponds.find(p=>p.id===pondId).sealedFishIds.length,5);assert.equal(F.read(ws).fry.find(f=>f.id===catches[5].fry.id).pondId,null);
  assert.equal(F.placeFry(ws,catches[0].fry.id,null,200005).reason,'pond-archived');assert.equal(F.releaseFish(ws,catches[0].fry.id,200006).reason,'pond-archived');
  assert.equal(F.sellFish(ws,catches[0].catch.id,200007).ok,true);const reloaded=S.validate(JSON.parse(JSON.stringify(ws)));assert.equal(F.read(reloaded).ponds.find(p=>p.id===pondId).fishIds.length,5);assert.equal(F.read(reloaded).fry.find(f=>f.id===catches[0].fry.id).pondId,pondId);assert.equal((await desktopSnapshot(reloaded)).pond.id,archived.activePondId,'the next active pond is selected after archiving');
});

test('historical legendary pond residents remain valid and can move to an aquarium without save migration',()=>{
  const ws=workspace(),legend=land(ws,'dragonkoi','spirit');assert.equal(F.placeFry(ws,legend.fry.id,'pond_starter',22000).ok,true);
  const reloaded=S.validate(JSON.parse(JSON.stringify(ws)));assert.equal(F.read(reloaded).fry[0].pondId,'pond_starter');assert.equal(F.placeAquariumFish(reloaded,legend.fry.id,true,22001).ok,true);assert.equal(F.read(reloaded).fry[0].pondId,null);assert.equal(F.aquarium(reloaded).fish[0].speciesId,'dragonkoi');
});
