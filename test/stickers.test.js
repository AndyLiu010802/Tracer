'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../public/task-garden'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync');
const clone=x=>JSON.parse(JSON.stringify(x));
function funded(){const ws=M.emptyWorkspace();for(let i=0;i<8;i++){const t=M.addTask(ws,{title:'Fund '+i});t.status='doing';G.taskChanged(ws,t,100,n=>n===10000?1000:4);t.status='done';t.doneAt=101;t.updatedAt=101;G.taskChanged(ws,t,101);G.harvest(ws,t.id,102);}G.sell(ws,'peach',8,200);M.addNote(ws,{title:'Journal',body:'Keep my words'});return ws;}
function place(ws,id='placement',extra={}){return G.layoutSticker(ws,{id,itemId:'st_bunny',targetType:'note',targetId:ws.notes[0].id,...extra},400);}
test('catalogue is read-only, purchases charge immutable prices once and old saves remain valid',()=>{
 const ws=funded(),before=JSON.stringify(ws),list=G.stickers(ws);assert.equal(list.total,8);assert.equal(list.owned,0);assert.equal(JSON.stringify(ws),before);list.items[0].price=0;assert.equal(G.stickers(ws).items[0].price,12);
 assert.equal(G.buySticker(ws,'st_bunny',300).spent,12);const owned=JSON.stringify(ws);assert.equal(G.buySticker(ws,'st_bunny',301).alreadyOwned,true);assert.equal(JSON.stringify(ws),owned);assert.equal(G.economy(S.validate(clone(ws))).balance,228);
 const poor=M.emptyWorkspace(),bytes=JSON.stringify(poor);assert.equal(G.buySticker(poor,'st_bunny').reason,'insufficient-coins');assert.equal(JSON.stringify(poor),bytes);
});
test('owned stickers are reusable on separate notes without changing text or charging again',()=>{
 const ws=funded();G.buySticker(ws,'st_bunny',300);const other=M.addNote(ws,{title:'Another page'}),content=JSON.stringify([ws.tasks,ws.notes]);assert.equal(place(ws).ok,true);assert.equal(place(ws,'copy',{targetType:'note',targetId:other.id,x:23,y:75,rotation:32,size:150}).ok,true);
 assert.equal(JSON.stringify([ws.tasks,ws.notes]),content);assert.equal(G.economy(ws).balance,228);const saved=S.validate(clone(ws));assert.equal(G.stickers(saved).placements.length,2);assert.equal(G.stickers(saved).placements[1].rotation,32);
});
test('removal tombstones and separate placement edits survive stale saves and concurrent windows',()=>{
 const base=funded();G.buySticker(base,'st_bunny',300);place(base,'a');place(base,'b');const a=clone(base),b=clone(base);G.layoutSticker(a,{id:'a',visible:false},500);G.layoutSticker(b,{id:'b',x:80},501);
 const merged=S.merge(base,a,b).workspace;assert.deepEqual(G.stickers(merged).placements.map(p=>p.id),['b']);assert.equal(G.stickers(merged).placements[0].x,80);G.preserve(merged,a);assert.deepEqual(G.stickers(a).placements.map(p=>p.id),['b']);assert.equal(a.taskGarden.market.stickers.placements.find(p=>p.id==='a').visible,false);
 G.layoutSticker(a,{id:'a',visible:true},1);assert.equal(G.stickers(a).placements.length,2);assert.ok(a.taskGarden.market.stickers.placements[0].updatedAt>501);
});
test('concurrent purchases share the wallet with farms and duplicate ownership only charges once',()=>{
 const base=funded(),a=clone(base),b=clone(base);G.buySticker(a,'st_bunny',300);G.buySticker(b,'st_bunny',301);assert.equal(G.economy(S.merge(base,a,b).workspace).spent,12);
 const farm=clone(base);G.buyFarm(farm,'cyber',350);place(a);const merged=S.merge(base,a,farm).workspace;assert.equal(G.economy(merged).balance,0);assert.equal(G.stickers(merged).owned,0);assert.equal(G.stickers(merged).placements.length,0);assert.throws(()=>G.preserve(farm,clone(a)),e=>e.code==='workspace-stale');
});
test('invalid, unowned, deleted and archived placements cannot mutate workspace',()=>{
 const ws=funded();const bytes=JSON.stringify(ws);assert.equal(place(ws).reason,'not-owned');assert.equal(JSON.stringify(ws),bytes);G.buySticker(ws,'st_bunny',300);place(ws);const before=JSON.stringify(ws);
 for(const patch of [{x:-1},{y:101},{size:181},{rotation:NaN},{visible:'yes'},{targetId:'missing'},{itemId:'st_cat'}]){assert.equal(G.layoutSticker(ws,{id:'placement',...patch},500).ok,false);assert.equal(JSON.stringify(ws),before);}
 assert.equal(place(ws,'deleted',{targetId:'missing'}).reason,'target-missing');ws.projects.push({id:'archived',status:'completed'});ws.tasks[0].projectId='archived';assert.equal(place(ws,'archive',{targetType:'task',targetId:ws.tasks[0].id}).reason,'notes-only');
 ws.notes=[];assert.equal(G.stickers(ws).placements.length,0);assert.equal(G.layoutSticker(ws,{id:'placement',x:50}).reason,'target-missing');
});
test('task placement is rejected while legacy task decorations remain readable but hidden',()=>{
 const ws=funded();G.buySticker(ws,'st_bunny',300);const before=JSON.stringify(ws);assert.equal(place(ws,'task',{targetType:'task',targetId:ws.tasks[0].id}).reason,'notes-only');assert.equal(JSON.stringify(ws),before);
 place(ws);ws.taskGarden.market.stickers.placements.push({...ws.taskGarden.market.stickers.placements[0],id:'legacy-task',targetType:'task',targetId:ws.tasks[0].id});const saved=S.validate(clone(ws));assert.equal(saved.taskGarden.market.stickers.placements.length,2);assert.deepEqual(G.stickers(saved).placements.map(p=>p.targetType),['note']);assert.equal(G.stickers(saved).owned,1);assert.equal(G.layoutSticker(saved,{id:'legacy-task',x:60}).reason,'notes-only');
});
test('per-page capacity can be reclaimed by taking stickers down; malformed receipts are rejected',()=>{
 const ws=funded();G.buySticker(ws,'st_bunny',300);for(let i=0;i<24;i++)assert.equal(place(ws,'p'+i).ok,true);const before=JSON.stringify(ws);assert.equal(place(ws,'overflow').reason,'page-full');assert.equal(JSON.stringify(ws),before);G.layoutSticker(ws,{id:'p0',visible:false});assert.equal(place(ws,'replacement').ok,true);
 for(const change of [g=>g.market.stickers.purchases.push({...g.market.stickers.purchases[0]}),g=>g.market.stickers.placements[0].itemId='st_cat',g=>g.market.stickers.placements[0].x=Infinity,g=>g.market.stickers.placements[0].targetType='html',g=>g.market.sales=[]]){const raw=clone(ws.taskGarden);change(raw);assert.throws(()=>G.validate(raw),/Invalid task garden/);}
});
