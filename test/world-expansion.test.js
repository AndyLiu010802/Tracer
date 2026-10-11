'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../public/task-garden'),F=require('../public/fishing-model'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync'),P=require('../skins/tracer/garden-planets-view').geometry;
function workspace(){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'expansion_test',amount:10000,updatedAt:1};return ws;}
function bundle(ws,now=1000){const {session:s}=F.beginCast(ws,{seed:970000,now});F.stepSession(s,{release:true,heldMs:800},0);F.commitCast(ws,s,now);for(let t=0;!['caught','escaped'].includes(s.phase)&&t<60000;t+=16)F.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);assert.equal(s.phase,'caught');return F.recordCatch(ws,s,now+20000).catch;}
function open(ws,catchId,ticket,now=300000){return F.openMysteryBundle(ws,catchId,{now,random:n=>n===100000?ticket:0});}
function planet(ws){const project=M.addProject(ws,{name:'A whole world'});for(const farm of G.FARMS){assert(G.buyFarm(ws,farm.id).ok);assert(G.equipFarm(ws,farm.id).ok);for(let i=0;i<3;i++){const task=M.addTask(ws,{title:farm.id+i,status:'doing',projectId:project.id});M.updateTask(ws,task.id,{status:'done'});}}assert(G.archiveProject(ws,project.id).ok);return G.read(ws).planets[0];}
test('new regions preserve planting identity, permanent price and mixed-world archive across reloads',()=>{
 const ws=workspace(),p=planet(ws);assert.equal(new Set(p.flowers.map(f=>f.farmId)).size,6);assert.equal(p.flowers.length,18);
 const saved=S.validate(structuredClone(ws));assert.deepEqual(G.read(saved).planets[0],p);assert.equal(G.economy(saved).spent,1200);
 for(const f of G.FARMS){const balance=G.economy(saved).balance;assert.equal(G.buyFarm(saved,f.id).alreadyOwned,true);assert.equal(G.economy(saved).balance,balance);}
 const bad=structuredClone(ws.taskGarden);bad.seeds[0].farmId='missing';assert.throws(()=>G.validate(bad));
});
test('six-biome planets are deterministic, keep all roots on land and represent small regions',()=>{
 for(const count of [6,24,100,2000]){const flowers=Array.from({length:count},(_,i)=>({taskId:'f'+i,plantKind:i%6===1?'neon_orchid':'wildflower',farmId:G.FARMS[i%6].id})),layout=P.biomes(flowers),all=P.positions(flowers,2.3);assert.equal(new Set(layout.beds.map(b=>b.region)).size,6);assert.deepEqual(P.positions(structuredClone(flowers),2.3),all);assert.equal(new Set(all.map(i=>i.point.x.toFixed(8)+':'+i.point.z.toFixed(8))).size,count);
 for(const item of all){const t=P.terrain(item.point,2.3);assert(t.water>=.025&&t.path>=.068);assert.equal(P.regionAt(item.point,layout),P.regionOf(item.flower));}assert(P.samplePositions(all).length<=72);}
 const flowers=[{farmId:'coast'},...Array.from({length:999},()=>({farmId:'alpine'}))];assert.equal(new Set(P.biomes(flowers).beds.map(b=>b.region)).size,2);
});
test('twelve stationery designs share immutable one-time purchases and valid preview assets',()=>{
 const ws=workspace(),items=G.postcards(ws).items;assert.equal(items.length,12);assert.equal(items.filter(i=>i.price===0).length,1);
 for(const item of items){const before=G.economy(ws).balance;assert.equal(G.buyPostcard(ws,item.id).spent,item.price);assert.equal(G.buyPostcard(ws,item.id).spent,0);assert.equal(G.economy(ws).balance,before-item.price);}
 assert(G.postcards(S.validate(structuredClone(ws))).items.every(i=>i.owned));for(const id of ['coast','sakura','alpine','dunes'])assert(fs.statSync('skins/tracer/garden-art/'+id+'-garden-v2.png').size>1000);
});
test('postcard stickers persist per planet, merge moves and removals, and do not charge per use',()=>{
 const ws=workspace(),p=planet(ws);G.buySticker(ws,'st_bunny');const before=G.economy(ws).balance;
 const place=(id)=>({id,itemId:'st_bunny',targetType:'postcard',targetId:p.id,x:32,y:76,size:84,rotation:15});assert(G.layoutSticker(ws,place('one')).ok);assert(G.layoutSticker(ws,place('two')).ok);
 const base=structuredClone(ws),a=structuredClone(ws),b=structuredClone(ws);G.layoutSticker(a,{id:'one',x:80});G.layoutSticker(b,{id:'two',visible:false});const merged=S.merge(base,a,b).workspace;
 const rows=G.stickers(S.validate(merged)).placements;assert.equal(rows.length,1);assert.equal(rows[0].x,80);assert.equal(G.economy(merged).balance,before);
 assert.equal(G.layoutSticker(ws,{...place('bad'),targetId:'missing'}).reason,'target-missing');assert.equal(G.layoutSticker(ws,{...place('bad'),itemId:'st_cat'}).reason,'not-owned');
 G.removePlanet(merged,p.id);assert.equal(G.stickers(merged).placements.length,0);assert.equal(G.layoutSticker(merged,{id:'one',x:10}).reason,'target-missing');
});
test('coin ticket buckets are exhaustive, disjoint and have exactly 100 jackpot tickets per 100,000',()=>{
 const counts={};for(let i=0;i<100000;i++){const g=F.coinGiftForTicket(i);counts[g?.id||'other']=(counts[g?.id||'other']||0)+1;if(g)assert(!F.motorTicketWins(i));}
 assert.deepEqual(counts,{other:70900,coins_pouch:20000,coins_chest:8000,coins_vault:1000,coins_jackpot:100});
 for(const value of [-1,100000,NaN,99899.5])assert.equal(F.coinGiftForTicket(value),undefined);
});
test('every coin prize credits exactly once, repeats at full value and never becomes an equippable collectible',()=>{
 for(const gift of F.catalog.gifts.filter(g=>g.slot==='coins')){const ws=workspace(),c=bundle(ws),balance=F.economy(ws).balance,r=open(ws,c.id,gift.first);assert.equal(r.earned,gift.amount);assert.equal(F.economy(ws).balance,balance+gift.amount);assert.equal(F.read(ws).giftUnlocks.length,0);assert.equal(open(ws,c.id,gift.first).earned,0);assert.equal(ws.fishing.transactions.filter(t=>t.kind==='gift_coins').length,1);
 const c2=bundle(ws,400000),r2=open(ws,c2.id,gift.last-1,500000);assert.equal(r2.duplicate,false);assert.equal(r2.earned,gift.amount);assert.equal(F.economy(S.validate(structuredClone(ws))).balance,balance+gift.amount*2);assert(fs.existsSync('skins/tracer'+gift.asset));}
});
test('jackpot receipts reject altered tickets, missing or duplicate payouts and forged quantities',()=>{
 const ws=workspace();open(ws,bundle(ws).id,99899);const mutate=fn=>{const raw=structuredClone(ws.fishing);fn(raw);assert.throws(()=>F.validate(raw));};
 mutate(s=>s.transactions=[]);mutate(s=>s.transactions.find(t=>t.kind==='gift_coins').amount++);mutate(s=>s.transactions.find(t=>t.kind==='gift_coins').quantity=2);mutate(s=>s.transactions.push({...s.transactions.find(t=>t.kind==='gift_coins'),id:'extra'}));mutate(s=>s.mysteryOpenings[0].motorTicket=99898);mutate(s=>delete s.mysteryOpenings[0].rewardVersion);mutate(s=>s.mysteryOpenings[0].duplicate=true);mutate(s=>s.transactions.find(t=>t.kind==='gift_coins').refId='missing');
});
test('legacy cosmetic openings in newly reserved coin bands remain valid without retroactive prizes',()=>{
 const ws=workspace();open(ws,bundle(ws).id,0);delete ws.fishing.mysteryOpenings[0].rewardVersion;ws.fishing.mysteryOpenings[0].motorTicket=99998;
 assert.doesNotThrow(()=>F.validate(ws.fishing));assert.equal(F.economy(ws).balance,10000);assert(!ws.fishing.transactions.some(t=>t.kind==='gift_coins'));
});
test('concurrent opens of the same bundle cannot duplicate a jackpot and conflicting earlier rewards win',()=>{
 const base=workspace(),c=bundle(base),a=structuredClone(base),b=structuredClone(base);open(a,c.id,99899,30000);open(b,c.id,99900,30001);
 const merged=S.merge(base,a,b).workspace;assert.equal(F.economy(merged).balance,60000);assert.equal(merged.fishing.transactions.filter(t=>t.kind==='gift_coins').length,1);assert.equal(F.economy(S.merge(base,merged,b).workspace).balance,60000);
 const earlier=structuredClone(base);open(earlier,c.id,0,25000);assert.equal(F.economy(S.merge(base,a,earlier).workspace).balance,10000);
});
