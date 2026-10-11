'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../public/task-garden'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync'),D=require('../skins/tracer/garden-island-3d').geometry,V=require('../skins/tracer/garden-plant-volume'),A=require('../skins/tracer/garden-plant-art'),atlas=require('../skins/tracer/garden-plant-atlas');
function workspace(){const ws=M.emptyWorkspace();ws.taskGarden=G.empty();ws.taskGarden.market.testCredit={id:'regions_3d_test',amount:10000,updatedAt:1};return ws;}
test('regional pools produce only their own new species while all historical regional seeds still validate',()=>{
 const legacy={coast:['wildflower','sunflower','apple'],sakura:['wildflower','peach','cherry'],alpine:['lavender','apple','cherry'],dunes:['sunflower','lavender','peach']};
 for(const farm of G.FARMS.filter(f=>legacy[f.id])){const ws=workspace();G.buyFarm(ws,farm.id);G.equipFarm(ws,farm.id);assert.equal(farm.plantKinds.length,2);
 for(let i=0;i<16;i++)M.addTask(ws,{title:'Regional task '+i,status:'doing'});assert(ws.taskGarden.seeds.every(s=>farm.plantKinds.includes(s.plantKind)&&s.farmId===farm.id&&s.variant==='normal'));
 for(const kind of legacy[farm.id]){const saved=structuredClone(ws);saved.taskGarden.seeds[0].plantKind=kind;assert.equal(S.validate(saved).taskGarden.seeds[0].plantKind,kind);}
 const task=ws.tasks[0];M.updateTask(ws,task.id,{status:'done'});G.harvest(ws,task.id);const seed=ws.taskGarden.seeds.find(s=>s.taskId===task.id),price=G.CATALOG.find(p=>p.plantKind===seed.plantKind).unitPrice,before=G.economy(ws).balance;assert(G.sell(ws,seed.plantKind,1).ok);assert.equal(G.economy(S.validate(ws)).balance,before+price);
 }
});
test('ordinary plant art contains no character variants and every regional image resolves to a bounded atlas cell',()=>{
 assert.equal(G.KINDS.length,17);assert.deepEqual(A.kinds,G.KINDS);
 for(const kind of G.KINDS){const data=atlas[kind];assert.equal(data.cells.length,4);assert(fs.existsSync('skins/tracer'+(data.src||'/garden-art/'+kind+'-v2.png')));for(const c of data.cells){assert(c.w>0&&c.h>0&&c.x>=0&&c.y>=0&&c.x+c.w<=data.width&&c.y+c.h<=data.height);}
 for(let stage=0;stage<5;stage++){const ordinary=A.markup(kind,stage,false,false);assert.equal(A.markup(kind,stage,true,true),ordinary);assert(!ordinary.includes('data-plant-part="face"'));}}
});
test('six regional desktop islands use finite 3D geometry and retain a bounded mesh for six plants',()=>{
 for(const farm of G.FARMS){const garden={farmId:farm.id,plants:Array.from({length:6},(_,i)=>({id:'p'+i,kind:farm.plantKinds[i%farm.plantKinds.length],stage:4}))},mesh=D.build(garden);assert.deepEqual(D.build(garden),mesh);assert.equal(mesh.ranges.length,6);assert(mesh.vertices.length/9<220000);assert(mesh.vertices.every(Number.isFinite));assert(mesh.vertices.some((v,i)=>i%9===1&&v<-.6));
 for(const range of mesh.ranges){assert(range.end>range.start);const depths=new Set();for(let i=range.start;i<range.end;i++)depths.add(Math.round(mesh.vertices[i*9+2]*100));assert(depths.size>5,'plant has genuine depth');}
 const front=D.camera(.5,.6,1.6),back=D.camera(.5+Math.PI,.6,1.6),a=D.project(mesh.points[0].root,front,440,280),b=D.project(mesh.points[0].root,back,440,280);assert(Math.abs(a.x-b.x)>20);assert.equal(D.pick(mesh,front,-400,-400,440,280),null);
 }
});
test('generated plant silhouettes have front, back and side depth instead of a flat sprite',()=>{
 const pixels=new Uint8Array(64*64*4);for(let y=5;y<59;y++)for(let x=12;x<52;x++)pixels[(y*64+x)*4+3]=255;const mesh=V.mesh(pixels,64,64);assert(mesh.length>0);assert(mesh.every(Number.isFinite));let min=Infinity,max=-Infinity;for(let i=0;i<mesh.length;i+=8){min=Math.min(min,mesh[i+2]);max=Math.max(max,mesh[i+2]);assert(mesh[i+6]>=0&&mesh[i+6]<=1&&mesh[i+7]>=0&&mesh[i+7]<=1);}assert(min<-.1&&max>.1);assert.equal(V.mesh(new Uint8Array(32*32*4),32,32).length,0);
});


