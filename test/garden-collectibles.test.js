'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../public/task-garden'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync');
const clone=x=>JSON.parse(JSON.stringify(x));
function harvest(ws,id,kind=4,at=100){const task={id,title:id,status:'doing',projectId:null,createdAt:at,updatedAt:at};ws.tasks.push(task);G.taskChanged(ws,task,at,n=>n===10000?1000:kind);task.status='done';task.doneAt=at+1;task.updatedAt=at+1;G.taskChanged(ws,task,at+1);G.harvest(ws,id,at+2);}
function funded(){const ws=M.emptyWorkspace();for(let i=0;i<8;i++)harvest(ws,'fund'+i);G.sell(ws,'peach',8,200);return ws;}
test('old saves gain a read-only catalogue and all progress survives selling',()=>{
 const ws=funded(),before=JSON.stringify(ws),c=G.collectibles(ws);assert.equal(c.total,15);assert.equal(c.owned,0);assert.equal(c.progress.harvests,8);assert.equal(c.progress.species,1);assert.equal(c.target.id,'birdhouse');assert.equal(JSON.stringify(ws),before);
 c.items[0].name[0]='changed';assert.notEqual(G.collectibles(ws).items[0].name[0],'changed');assert.equal(G.economy(ws).balance,240);
});
test('collecting charges fixed coins once, enforces eligibility, equips only owned items and persists',()=>{
 const ws=funded(),before=JSON.stringify(ws);
 assert.equal(G.buyCollectible(ws,'crystal_deer').reason,'collection-locked');assert.equal(G.buyCollectible(ws,'invalid').reason,'unknown-collectible');assert.equal(G.equipCollectible(ws,'birdhouse').reason,'not-owned');assert.equal(JSON.stringify(ws),before);
 assert.equal(G.buyCollectible(ws,'birdhouse',300).spent,18);const owned=JSON.stringify(ws);assert.equal(G.buyCollectible(ws,'birdhouse',301).alreadyOwned,true);assert.equal(JSON.stringify(ws),owned);
 G.equipCollectible(ws,'birdhouse',400);const reloaded=S.validate(clone(ws));assert.equal(G.collectibles(reloaded).equippedId,'birdhouse');assert.equal(G.economy(reloaded).balance,222);
 G.equipCollectible(reloaded,null,1);assert.equal(reloaded.taskGarden.market.collectibles.equipped.updatedAt,401);assert.equal(G.economy(reloaded).balance,222);
 const poor=M.emptyWorkspace();harvest(poor,'first');const bytes=JSON.stringify(poor);assert.equal(G.buyCollectible(poor,'birdhouse').reason,'insufficient-coins');assert.equal(JSON.stringify(poor),bytes);
});
test('a completed set unlocks its plaque without minting coins or requiring retained stock',()=>{
 const ws=funded();harvest(ws,'other',1,210);G.sell(ws,'sunflower',1,220);
 for(const id of ['birdhouse','mushroom_lamp','tea_table'])assert.equal(G.buyCollectible(ws,id,300).ok,true);
 const c=G.collectibles(ws);assert.equal(c.sets[0].owned,3);assert.equal(c.owned,3);assert.equal(c.target.id,'moon_lamp');assert.equal(G.economy(ws).balance,80);assert.equal(G.inventory(ws).reduce((n,p)=>n+p.available,0),0);
});
test('wishlist uses logical timestamps and survives stale windows and reload',()=>{
 const base=funded(),local=clone(base),remote=clone(base);G.wishCollectible(local,'crystal_deer',400);G.wishCollectible(remote,'moon_gate',500);const merged=S.merge(base,local,remote).workspace;assert.equal(G.collectibles(merged).target.id,'moon_gate');G.wishCollectible(merged,null,1);assert.equal(merged.taskGarden.market.collectibles.wish.updatedAt,501);G.preserve(merged,local);assert.equal(G.collectibles(local).wishId,null);assert.equal(G.economy(local).balance,240);
});
test('concurrent duplicate collectibles charge once; older clients cannot erase purchases',()=>{
 const base=funded(),a=clone(base),b=clone(base);G.buyCollectible(a,'birdhouse',300);G.buyCollectible(b,'birdhouse',350);G.equipCollectible(a,'birdhouse',400);
 const merged=S.merge(base,a,b).workspace;assert.equal(G.economy(merged).spent,18);assert.equal(G.collectibles(merged).equippedId,'birdhouse');const stale=clone(base);G.preserve(merged,stale);assert.equal(G.collectibles(stale).owned,1);assert.equal(G.economy(stale).balance,222);
});
test('farm and collectible purchases share one balance across concurrent merges',()=>{
 const base=funded(),a=clone(base),b=clone(base);G.buyCollectible(a,'birdhouse',300);G.equipCollectible(a,'birdhouse',400);G.buyFarm(b,'cyber',350);
 const farmWins=S.merge(base,a,b).workspace;assert.equal(G.economy(farmWins).balance,0);assert.equal(G.farms(farmWins)[1].owned,true);assert.equal(G.collectibles(farmWins).owned,0);assert.equal(G.collectibles(farmWins).equippedId,null);
 const itemWins=S.merge(base,b,a).workspace;assert.equal(G.economy(itemWins).balance,222);assert.equal(G.farms(itemWins)[1].owned,false);assert.equal(G.collectibles(itemWins).owned,1);
 assert.throws(()=>G.preserve(a,clone(b)),e=>e.code==='workspace-stale');
 const acceptedFarm=clone(b),incoming=clone(a);assert.throws(()=>G.preserve(acceptedFarm,incoming),e=>e.code==='workspace-stale');assert.equal(G.economy(acceptedFarm).balance,0);
});
test('tampered, duplicate, unearned, unfunded and impossible display receipts are rejected',()=>{
 const ws=funded();G.buyCollectible(ws,'birdhouse',300);const mutations=[g=>g.market.collectibles.purchases.push({...g.market.collectibles.purchases[0]}),g=>g.market.collectibles.purchases[0].itemId='crystal_deer',g=>g.market.collectibles.purchases[0].purchasedAt=1,g=>g.market.collectibles.equipped.itemId='moon_lamp',g=>g.market.collectibles.wish.updatedAt=-1,g=>g.market.collectibles=null,g=>g.market.sales=[]];
 for(const mutate of mutations){const raw=clone(ws.taskGarden);mutate(raw);assert.throws(()=>G.validate(raw),/Invalid task garden/);}
 const raw=clone(ws.taskGarden);raw.market.collectibles.purchases[0].price=-999;assert.equal(G.economy({taskGarden:raw}).spent,18);
});


test('layouts place multiple owned objects, retain transforms and isolate farms without spending',()=>{
 const ws=funded();for(let i=0;i<12;i++)harvest(ws,'more'+i,4,250);G.sell(ws,'peach',12,270);G.buyFarm(ws,'cyber',280);
 for(const id of ['birdhouse','mushroom_lamp'])G.buyCollectible(ws,id,300);
 const balance=G.economy(ws).balance;
 G.layoutCollectible(ws,{itemId:'birdhouse',x:31,y:63,scale:1.4,flip:true},400);G.layoutCollectible(ws,{itemId:'mushroom_lamp'},401);
 assert.equal(G.collectibles(ws).placements.length,2);G.equipFarm(ws,'cyber',500);assert.equal(G.collectibles(ws).placements.length,0);
 G.layoutCollectible(ws,{itemId:'birdhouse',x:72,y:52},600);assert.equal(G.collectibles(ws).placements[0].x,72);
 G.equipFarm(ws,'meadow',700);const saved=S.validate(clone(ws));assert.equal(G.collectibles(saved).placements[0].x,31);assert.equal(G.collectibles(saved).placements[0].flip,true);
 G.layoutCollectible(saved,{itemId:'birdhouse',visible:false},800);assert.deepEqual(G.collectibles(saved).placements.map(p=>p.itemId),['mushroom_lamp']);
 G.layoutCollectible(saved,{itemId:'birdhouse',visible:true},900);assert.equal(G.collectibles(saved).placements.find(p=>p.itemId==='birdhouse').scale,1.4);assert.equal(G.economy(saved).balance,balance);
});
test('concurrent layout edits merge per item and removed decorations stay removed on stale saves',()=>{
 const base=funded();for(const id of ['birdhouse','mushroom_lamp']){G.buyCollectible(base,id,300);G.layoutCollectible(base,{itemId:id},400);}
 const a=clone(base),b=clone(base);G.layoutCollectible(a,{itemId:'birdhouse',x:24},500);G.layoutCollectible(b,{itemId:'mushroom_lamp',x:75},501);
 const merged=S.merge(base,a,b).workspace;assert.equal(G.collectibles(merged).placements.find(p=>p.itemId==='birdhouse').x,24);assert.equal(G.collectibles(merged).placements.find(p=>p.itemId==='mushroom_lamp').x,75);
 G.layoutCollectible(merged,{itemId:'birdhouse',visible:false},502);G.preserve(merged,a);assert.deepEqual(G.collectibles(a).placements.map(p=>p.itemId),['mushroom_lamp']);
});
test('invalid and unowned layouts cannot be written or imported',()=>{
 const ws=funded();G.buyCollectible(ws,'birdhouse',300);G.layoutCollectible(ws,{itemId:'birdhouse'},400);const before=JSON.stringify(ws);
 for(const patch of [{x:NaN},{x:96},{y:0},{scale:4},{flip:1},{visible:'yes'},{farmId:'cyber'},{itemId:'tea_table'}])assert.equal(G.layoutCollectible(ws,{itemId:'birdhouse',...patch}).ok,false);
 assert.equal(JSON.stringify(ws),before);
 for(const patch of [{x:Infinity},{y:-1},{scale:.1},{farmId:'cyber'},{itemId:'tea_table'},{updatedAt:0}]){const raw=clone(ws.taskGarden);Object.assign(raw.market.collectibles.layouts[0],patch);assert.throws(()=>G.validate(raw));}
 const duplicate=clone(ws.taskGarden);duplicate.market.collectibles.layouts.push(duplicate.market.collectibles.layouts[0]);assert.throws(()=>G.validate(duplicate));
});


test('companion placement is free, read-only by default and independent from furniture and other farms',()=>{
 const ws=funded(),before=JSON.stringify(ws),initial=G.companionPlacement(ws);assert.equal(JSON.stringify(ws),before);assert.equal(initial.x,66.5);
 G.layoutCompanion(ws,{x:42,y:68,scale:1.3,flip:true},500);assert.equal(G.economy(ws).balance,240);assert.equal(G.collectibles(ws).placements.length,0);
 const saved=S.validate(clone(ws));assert.equal(G.companionPlacement(saved).x,42);assert.equal(G.companionPlacement(saved).flip,true);
 G.buyFarm(saved,'cyber',600);G.equipFarm(saved,'cyber',700);assert.equal(G.companionPlacement(saved).x,65.89);G.layoutCompanion(saved,{x:30,y:55},800);
 G.equipFarm(saved,'meadow',900);assert.equal(G.companionPlacement(saved).x,42);G.layoutCompanion(saved,{visible:false},1000);assert.equal(G.companionPlacement(saved).visible,false);G.layoutCompanion(saved,{visible:true},1001);assert.equal(G.companionPlacement(saved).scale,1.3);
});
test('companion layouts survive stale windows, merge independently from furniture and reject malformed data',()=>{
 const base=funded();G.buyCollectible(base,'birdhouse',300);const a=clone(base),b=clone(base);
 G.layoutCompanion(a,{x:33,y:68},400);G.layoutCollectible(b,{itemId:'birdhouse',x:70},410);const merged=S.merge(base,a,b).workspace;
 assert.equal(G.companionPlacement(merged).x,33);assert.equal(G.collectibles(merged).placements[0].x,70);
 G.layoutCompanion(merged,{visible:false},500);G.preserve(merged,a);assert.equal(G.companionPlacement(a).visible,false);
 const before=JSON.stringify(a);for(const patch of [{x:NaN},{y:999},{scale:0},{flip:'yes'},{visible:1},{farmId:'cyber'}])assert.equal(G.layoutCompanion(a,patch).ok,false);assert.equal(JSON.stringify(a),before);
 for(const patch of [{x:-1},{farmId:'cyber'},{updatedAt:0}]){const raw=clone(a.taskGarden);Object.assign(raw.market.companionLayouts[0],patch);assert.throws(()=>G.validate(raw));}
});
test('new furniture has attainable entry pieces, fixed prices, and supports all catalogue layouts in both farms',()=>{
 const ws=funded();assert.equal(G.buyCollectible(ws,'reading_bench',300).spent,36);const owned=JSON.stringify(ws);assert.equal(G.buyCollectible(ws,'reading_bench',301).alreadyOwned,true);assert.equal(JSON.stringify(ws),owned);
 G.layoutCollectible(ws,{itemId:'reading_bench'},400);assert.ok(Number.isFinite(G.collectibles(ws).placements[0].x));assert.equal(G.collectibles(ws).sets.length,5);
 const ids=G.collectibles(ws).items.map(i=>i.id);assert.equal(new Set(ids).size,15);assert.equal(G.buyCollectible(ws,'garden_greenhouse').reason,'collection-locked');
});

test('six orientations persist across hiding, reload, stale saves and independent farm layouts',()=>{
 const ws=funded();G.buyCollectible(ws,'birdhouse',300);const balance=G.economy(ws).balance;
 for(let orientation=0;orientation<6;orientation++){assert.equal(G.layoutCollectible(ws,{itemId:'birdhouse',orientation},400+orientation).ok,true);assert.equal(G.collectibles(S.validate(clone(ws))).placements[0].orientation,orientation);}
 const stale=clone(ws);G.layoutCollectible(ws,{itemId:'birdhouse',visible:false},500);G.preserve(ws,stale);assert.equal(G.collectibles(stale).placements.length,0);assert.equal(G.collectibles(stale).layouts[0].orientation,5);
 G.layoutCollectible(stale,{itemId:'birdhouse',visible:true},501);assert.equal(G.collectibles(stale).placements[0].orientation,5);assert.equal(G.economy(stale).balance,balance);
 const before=JSON.stringify(stale);for(const orientation of [-1,6,.5,NaN,'2',null])assert.equal(G.layoutCollectible(stale,{itemId:'birdhouse',orientation}).ok,false);assert.equal(JSON.stringify(stale),before);
 for(const orientation of [-1,6,.5,'2']){const raw=clone(stale.taskGarden);raw.market.collectibles.layouts[0].orientation=orientation;assert.throws(()=>G.validate(raw));}
 const legacy=clone(stale);delete legacy.taskGarden.market.collectibles.layouts[0].orientation;assert.equal(G.collectibles(S.validate(legacy)).placements[0].orientation,0);
});

test('all fifteen furniture pieces fit in both farms and six-view assets cover the catalogue',()=>{
 const fs=require('node:fs'),path=require('node:path'),ws=M.emptyWorkspace();for(let i=0;i<240;i++)harvest(ws,'capacity'+i,i<6?i:4);
 for(const row of G.inventory(ws))G.sell(ws,row.plantKind,row.available,200);assert.equal(G.buyFarm(ws,'cyber',300).ok,true);
 G.equipFarm(ws,'cyber',301);for(let i=0;i<3;i++)harvest(ws,'cyber-capacity'+i,i,310);for(const row of G.inventory(ws))if(row.available)G.sell(ws,row.plantKind,row.available,350);G.equipFarm(ws,'meadow',360);
 const items=G.collectibles(ws).items;for(const item of items){assert.equal(G.buyCollectible(ws,item.id,400).ok,true,item.id);assert.ok(!item.name[0].includes('?'));assert.ok(fs.existsSync(path.join(__dirname,'../skins/tracer/garden-art/collectible-'+item.id+'-six-v1.png')));}
 for(const farmId of ['meadow','cyber'])for(const item of items)assert.equal(G.layoutCollectible(ws,{farmId,itemId:item.id,orientation:3},500).ok,true);
 const saved=S.validate(clone(ws));assert.equal(saved.taskGarden.market.collectibles.layouts.length,30);for(const farm of ['meadow','cyber']){G.equipFarm(saved,farm,600);assert.equal(G.collectibles(saved).placements.length,15);}
});
