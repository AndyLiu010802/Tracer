'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),A=require('../skins/tracer/fishing-art'),Motion=require('../skins/tracer/fishing-motion');
const env=spotId=>({spotId:spotId||'creek',timeId:'day',weatherId:'clear'}),fish=id=>F.catalog.fish.find(f=>f.id===id),rank=f=>['common','rare','epic','legendary'].indexOf(f.rarity);
function preview(id,seed,spot){const s=F.createSession(null,{rodId:id,seed,expedition:env(spot)});F.stepSession(s,{release:true,heldMs:800},0);return s;}
function workspace(id){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'hidden_v3_credit',amount:100000,updatedAt:1};const p=F.catalog.rodPools.find(p=>p.hiddenRodId===id);assert(F.buyBox(ws,{poolId:p.id,now:2,random:n=>n===10000?(p.id==='valorant'?9999:5450):0}).ok);F.equipRod(ws,id,3);return ws;}
function seedFor(id,predicate){for(let seed=0;seed<10000;seed++){const s=preview(id,seed);if(predicate(s))return seed;}throw Error('No matching seed '+id);}
function caught(ws,seed,model=F){const s=model.beginCast(ws,{now:10,seed,expedition:env()}).session;model.stepSession(s,{release:true,heldMs:800},0);assert(model.commitCast(ws,s,11).ok);for(let i=0;i<4000&&!['caught','escaped'].includes(s.phase);i++)model.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);assert.equal(s.phase,'caught');return{s,result:model.recordCatch(ws,s,70000)};}

test('random hidden powers receive a multiplicative 30 percent increase; guaranteed powers and box odds stay guaranteed/unchanged',()=>{
 const c={fish:0,instant:0,double:0,triple:0,nika:0,seal:0,vitality:0};
 for(let seed=0;seed<12000;seed++){
  const a=F.createSession(null,{rodId:'wukong',seed,expedition:env()}),b=F.createSession(null,{rodId:'eclipse',seed,expedition:env()}),n=F.createSession(null,{rodId:'anime_nika',seed,expedition:env()});
  if(!fish(a.fishId)){assert.equal(a.haulCount,1);assert(!b.instant&&!n.hiddenSkill);continue;}
  c.fish++;c.instant+=b.instant;c.double+=a.haulCount===2;c.triple+=a.haulCount===3;c.nika+=n.hiddenSkill==='liberation-rhythm';c.seal+=F.createSession(null,{rodId:'emperorjade',seed,expedition:env()}).hiddenSkill==='imperial-decree';c.vitality+=F.createSession(null,{rodId:'anime_sixpaths',seed,expedition:env()}).hiddenSkill==='sixpaths-nurture';assert.equal(n.instant,false);assert.equal(n.haulCount,1);
 }
 for(const [key,rate]of [['instant',.195],['double',.208],['triple',.078],['nika',.26],['seal',.325],['vitality',.39]])assert(Math.abs(c[key]/c.fish-rate)<.012,key);
 assert.equal(F.catalog.rods.find(r=>r.id==='golden').saleMultiplier,2);for(const p of F.catalog.rodPools)assert.equal(p.odds.hidden,.005);
});

test('Imperial decree upgrades within the same pond; Six Paths always selects eligible nursery fish on proc',()=>{
 let promotions=0,nurseries=0;
 for(const spot of F.catalog.spots)for(let seed=0;seed<100;seed++){
  const ordinary=preview('bamboo',seed,spot.id),seal=preview('emperorjade',seed,spot.id),sage=preview('anime_sixpaths',seed,spot.id);
  const pool=F.expedition({fishing:{...F.empty(),expedition:{...env(spot.id),updatedAt:0}}}).fish;
  if(seal.hiddenSkill){promotions++;assert(pool.some(f=>f.id===seal.fishId));assert.equal(rank(fish(seal.fishId)),Math.min(3,rank(fish(ordinary.fishId)))+Number(rank(fish(ordinary.fishId))<3));}
  if(sage.hiddenSkill){nurseries++;assert(fish(sage.fishId).fry);assert(pool.some(f=>f.id===sage.fishId));}
 }assert(promotions>50&&nurseries>50);
});

test('new nursery growth and successful bait return survive validation, replay and merge without paying twice',()=>{
 for(const id of ['anime_sixpaths','anime_nika','emperorjade']){
  const seed=seedFor(id,s=>!!s.hiddenSkill&&fish(s.fishId)?.rarity==='rare'),ws=workspace(id),before=F.read(ws).baits.earthworm,{s,result}=caught(ws,seed);assert(result.ok);assert(result.hiddenSkill);
  if(id==='anime_sixpaths'){assert.equal(result.fry.growth,50);assert.equal(F.read(ws).fry[0].growth,50);}
  if(id==='anime_nika'){assert.equal(result.baitReturned,1);assert.equal(F.read(ws).baits.earthworm,before);const normal=preview('bamboo',seed);assert.equal(s.waitDuration,Math.round(normal.waitDuration*.45));}
  else assert.equal(F.read(ws).baits.earthworm,before-1);
  const saved=structuredClone(ws.fishing);assert.deepEqual(F.validate(saved),saved);assert(F.recordCatch(ws,s,70001).alreadyRecorded);assert.deepEqual(ws.fishing,saved);
  const merged=F.merge(saved,saved,saved);assert.deepEqual(merged,saved);
  const forged=structuredClone(saved);forged.catches[0].fishId='not-a-fish';assert.throws(()=>F.validate(forged));
 }
});

test('cancelled Nika casts consume bait; old instant and rescue mechanics no longer bypass a new fight',()=>{
 const seed=seedFor('anime_nika',s=>s.hiddenSkill==='liberation-rhythm'),ws=workspace('anime_nika'),before=F.read(ws).baits.earthworm,s=F.beginCast(ws,{now:10,seed,expedition:env()}).session;F.stepSession(s,{release:true,heldMs:800},0);F.commitCast(ws,s,11);F.stepSession(s,{cancel:true},0);assert.equal(F.read(ws).baits.earthworm,before-1);assert.equal(F.recordCatch(ws,s,10000).ok,false);
 for(const id of ['anime_nika','anime_sixpaths']){const s=preview(id,seed);for(let i=0;i<5000&&!['escaped','caught'].includes(s.phase);i++)F.stepSession(s,{hook:s.phase==='bite',holding:false},16);assert.equal(s.phase,'escaped');assert(!s.tensionRescued&&!s.progressRescued);}
});

test('each fish in a multi-haul has its real species and its own continuous water-to-shore trajectory',()=>{
 assert.deepEqual(A.catchFlightFish({}),[]);assert.deepEqual(A.catchFlightFish(undefined),[]);
 for(const count of [2,3,4,5]){const ids=F.catalog.fish.slice(0,count).map(f=>f.id),snapshot={session:{id:'new',fishId:ids[0],haulCount:count,haulFishIds:ids},lastCatch:{sessionId:'old',catches:[{fishId:'galaxywhale'}]}},haul=A.catchFlightFish(snapshot,fish(ids[0])),markup=A.catchFlightMarkup(haul);assert.deepEqual(haul.map(f=>f.id),ids);assert.equal((markup.match(/data-flight-index=/g)||[]).length,count);
  const g={width:380,height:260,water:{x:260,y:150}},end=[];for(let i=0;i<count;i++){let last=null;for(let t=0;t<2600;t+=1000/30){const p=Motion.haulPose(i,count,t,{},g,false);assert([p.x,p.y,p.fishAlpha,p.fishScale].every(Number.isFinite));if(last)assert(Math.hypot(p.x-last.x,p.y-last.y)<30);last=p;}end.push(Motion.haulPose(i,count,1200,{},g,false).x);assert(Motion.haulPose(i,count,400,{},g,false).fishAlpha>0);assert.equal(Motion.haulPose(i,count,2600,{},g,false).fishAlpha,0);}assert.equal(new Set(end.map(x=>Math.round(x))).size,count);
 }
});

test('the initial Spike burst already knows all species before its reward save finishes',()=>{
 for(const count of [3,4,5]){const seed=seedFor('valorant_spike',s=>s.haulCount===count),ws=workspace('valorant_spike'),{s,result}=caught(ws,seed);assert.equal(s.rules,8);assert.deepEqual(s.haulFishIds,result.catches.map(c=>c.fishId));assert.equal(A.catchFlightFish({session:s},result.fish).length,count);assert.equal(result.fryRows.length,0);}
});

test('rules 5 and 6 catches and sales remain valid after the ability upgrade',()=>{
 const context={module:{exports:{}},require:require('node:module').createRequire(require.resolve('../public/fishing-model'))};vm.runInNewContext(fs.readFileSync(require.resolve('../public/fishing-model'),'utf8').replace("rules:rod.id==='valorant_spike'?8:7","rules:rod.id==='valorant_spike'?6:5"),context);const old=context.module.exports;
 for(const id of ['valorant_spike','anime_nika','anime_sixpaths','emperorjade','wukong','eclipse']){const ws=workspace(id),{s,result}=caught(ws,3,old);assert(result.ok);assert.equal(s.rules,id==='valorant_spike'?6:5);assert(old.sellFish(ws,result.catch.id,70001).ok);const saved=JSON.parse(JSON.stringify(ws.fishing));assert.deepEqual(F.validate(saved),saved);assert.deepEqual(F.merge(saved,saved,saved),saved);}
});

test('desktop atlas resolves all hauled species without loading the full game model',()=>{
 const context={};vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/fishing-art'),'utf8'),context);const a=context.TracerFishingArt,ids=['sandgoby','rockling','lionfish'],haul=a.catchFlightFish({session:{haulCount:3,haulFishIds:ids,fishId:ids[0]}},{id:ids[0]});assert.equal(haul.map(f=>f.id).join(','),ids.join(','));assert.equal((a.catchFlightMarkup(haul).match(/data-flight-index=/g)||[]).length,3);
});
