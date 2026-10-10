'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),Sync=require('../public/workspace-sync'),Art=require('../skins/tracer/fishing-art'),E=Art.pondEnvironment;
function workspace(){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'environment_qa',amount:100000,updatedAt:1};for(const spot of F.catalog.spots)F.unlockGround(ws,spot.id,1);return ws;}
const env=spotId=>({spotId:spotId||'creek',timeId:'day',weatherId:'clear'});
function cast(ws,options={},api=F){const result=api.beginCast(ws,options);assert(result.ok);const s=result.session;api.stepSession(s,{},900);api.stepSession(s,{release:true},0);assert(api.commitCast(ws,s).ok);return s;}
test('five distinct live bait roles use valid targets and one specialist price',()=>{
 assert.deepEqual(F.catalog.baits.map(b=>b.id),['earthworm','dough','prawn','cutbait','lotusmeal']);
 assert.deepEqual([...new Set(F.catalog.baits.slice(1).map(b=>b.price))],[30]);
 for(const b of F.catalog.baits){assert.equal(b.quantity,10);assert.equal(new Set(b.fishIds).size,b.fishIds.length);for(const id of b.fishIds)assert(F.catalog.fish.some(f=>f.id===id));assert(Art.baitMarkup(b).includes('bait-'+b.id+'-v2.png'));}
 for(const old of F.catalog.legacyBaits)assert(F.catalog.baits.some(b=>b.id===F.activeBaitId(old.id)));
});
test('legacy bait quantities and paid receipts survive projection, repeated reads and merges',()=>{
 const ws=workspace();for(const b of F.catalog.legacyBaits)assert(F.buyBait(ws,b.id,2).ok);for(let j=0;j<3;j++)cast(ws,{baitId:'worm'});
 const raw=structuredClone(ws.fishing),state=F.read(ws),expected=Object.fromEntries(F.catalog.baits.map(b=>[b.id,0]));
 for(const b of F.catalog.legacyBaits)expected[F.activeBaitId(b.id)]+=state.baits[b.id];for(const [id,count]of Object.entries(expected))assert.equal(state.baits[id],count);
 for(let j=0;j<5;j++){assert.deepEqual(F.read(ws).baits,state.baits);assert.deepEqual(ws.fishing,raw);}
 assert.deepEqual(Sync.validate(structuredClone(ws)).fishing,raw);assert.deepEqual(F.merge(raw,raw,raw),raw);
});
test('new casts use canonical stock once, and stale legacy or new sessions cannot overspend it',()=>{
 const ws=workspace(),old=F.beginCast(ws,{baitId:'worm'}).session;F.stepSession(old,{},900);F.stepSession(old,{release:true},0);
 const pending=F.beginCast(ws,{baitId:'worm',expedition:env()}).session;F.stepSession(pending,{},900);F.stepSession(pending,{release:true},0);
 for(let j=0;j<30;j++){const s=cast(ws,{baitId:'worm',expedition:env()});assert.equal(s.rules,7);assert.equal(s.baitId,'earthworm');assert.equal(F.commitCast(ws,s).changed,false);}
 assert.equal(F.read(ws).baits.earthworm,0);assert.equal(F.beginCast(ws,{baitId:'worm',expedition:env()}).reason,'no-bait');assert.equal(F.beginCast(ws,{baitId:'worm'}).reason,'no-bait');assert.equal(F.commitCast(ws,old).reason,'no-bait');assert.equal(F.commitCast(ws,pending).reason,'no-bait');assert.doesNotThrow(()=>F.validate(ws.fishing));
});
test('historical rules 3 catches keep their original bait weights and exact saved records',()=>{
 const source=fs.readFileSync(require.resolve('../public/fishing-model'),'utf8').replace("Object.assign(session,{rules:rod.id==='valorant_spike'?8:7,baitId:activeBaitId(baitId)",'Object.assign(session,{rules:3,baitId:baitId');
 const context={module:{exports:{}},console,require:require('node:module').createRequire(require.resolve('../public/fishing-model'))};vm.runInNewContext(source,context);const Old=context.module.exports,ws=workspace();
 for(const [i,bait]of ['grain','glow','frost','dragonfruit'].entries()){
  assert(Old.buyBait(ws,bait,1).ok);const s=cast(ws,{baitId:bait,seed:100+i*23,expedition:env(['creek','reef','frost','lotus'][i])},Old);
  for(let frame=0;frame<4000&&!['caught','escaped'].includes(s.phase);frame++)Old.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);
  assert.equal(s.phase,'caught');assert(Old.recordCatch(ws,s).ok);
 }
 const saved=JSON.parse(JSON.stringify(ws.fishing));assert(saved.casts.every(c=>c.rules===3));assert.deepEqual(F.validate(saved),saved);assert.deepEqual(JSON.parse(JSON.stringify(F.read(ws).catches)),saved.catches);
 const altered=structuredClone(saved);altered.casts.forEach(c=>c.rules=4);assert.throws(()=>F.validate(altered));
});
test('all five baits respect the current ground and their preference forecast',()=>{
 for(const spot of F.catalog.spots){const ws=workspace();F.setExpedition(ws,env(spot.id));const available=new Set(F.expedition(ws).fish.map(f=>f.id));
  for(const bait of F.catalog.baits){F.buyBait(ws,bait.id,1);F.equipBait(ws,bait.id);const forecast=F.expedition(ws);for(const id of forecast.favoredFishIds){assert(available.has(id));assert(bait.fishIds.includes(id));}
   for(let seed=0;seed<200;seed++){const s=F.createSession(F.empty(),{baitId:bait.id,seed,expedition:env(spot.id)});F.stepSession(s,{},900);F.stepSession(s,{release:true},0);assert(available.has(s.fishId)||F.catalog.products.some(p=>p.id===s.fishId));}
  }
 }
});
test('nine free pond settings persist and custom layouts are retained while switching scenery',()=>{
 const ws=workspace();assert.equal(F.catalog.pondStyles.length,9);assert.equal(E.styles.length,9);
 for(const style of F.catalog.pondStyles){assert.equal(style.price,0);assert(F.selectPondStyle(ws,'pond_starter',style.id).ok);assert.equal(F.read(Sync.validate(structuredClone(ws))).ponds[0].styleId,style.id);}
 F.setPondDecoration(ws,'pond_starter',{kind:'lantern',x:-.8,z:.6,scale:.7,rotation:2});const custom=F.read(ws).ponds[0].decorations;
 F.selectPondStyle(ws,'pond_starter','bamboo');assert.deepEqual(F.read(ws).ponds[0].decorations,custom);
});
test('every shoreline has a distinct outline, submerged bottom and enough clearance for the whole fish',()=>{
 assert.equal(new Set(E.styles.map(s=>E.outline(s))).size,9);
 for(const style of E.styles){assert(E.floorHeight(0,0,style)<-.60);
  for(let i=0;i<72;i++){const a=i*Math.PI/36,r=E.shoreRadius(a,style),x=Math.cos(a)*r,z=Math.sin(a)*r/1.035;assert(r>1.25&&r<2.9);assert(Math.abs(E.floorHeight(x,z,style)+.043)<1e-8);assert(Math.abs(E.terrainHeight(x,z,[],style)+.043)<1e-8);
   for(const margin of [.12,.5,.85]){const p=E.fit(x*2,z*2,style,margin);for(let j=0;j<12;j++){const b=j*Math.PI/6;assert(E.contains(p.x+Math.cos(b)*margin,p.z+Math.sin(b)*margin,style),style+' full body clearance');}}
  }
 }
});

test('untouched old factory scenery upgrades visually without rewriting backups or custom positions',()=>{
 const ws=workspace();F.selectPondStyle(ws,'pond_starter','lily',100);const pond=ws.fishing.ponds[0];const old=[['willow',-2.23,-1.73,0,1.05],['flowers',-2.08,1.69,0,.85],['bench',1.89,1.89,1,.85],['lilies',-.86,.38,0,.65],['lantern',-1.08,2.25,0,.75],['rocks',2.20,-1.41,1,.85]];
 pond.decorations=old.map((d,i)=>({id:'decoration_default_'+i,kind:d[0],x:d[1],z:d[2],rotation:d[3],scale:d[4],updatedAt:pond.decorationLayoutAt}));const raw=structuredClone(ws.fishing);
 assert.deepEqual(F.validate(raw),raw);assert.deepEqual(F.read(ws).ponds[0].decorations,F.defaultPondDecorations('lily',pond.decorationLayoutAt));assert.deepEqual(ws.fishing,raw);assert.deepEqual(Sync.validate(structuredClone(ws)).fishing,raw);
 pond.decorations[0].x=-1.75;assert.deepEqual(F.read(ws).ponds[0].decorations,pond.decorations);
});
