'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../skins/tracer/celebrations-model'),M=require('../skins/tracer/model'),G=require('../public/task-garden');
const copy=structuredClone;
function fixture(ticket=0){const ws=M.emptyWorkspace(),p=M.addProject(ws,{name:'A little milestone'}),task=M.addTask(ws,{projectId:p.id,title:'A special seed'});task.status='doing';task.updatedAt=Date.now();G.taskChanged(ws,task,task.updatedAt,n=>n===10000?ticket:0);return{ws,p,task};}
test('completed projects celebrate the accepted transition, not initial load, imports, task completion or repeated snapshots',()=>{
 const {ws,p,task}=fixture(150),before=copy(ws);assert.deepEqual(C.changes(null,ws),[]);M.moveTask(ws,task.id,'done');assert.deepEqual(C.changes(before,ws),[]);const beforeArchive=copy(ws);assert.ok(M.completeProject(ws,p.id).ok);assert.deepEqual(C.changes(beforeArchive,ws).map(e=>e.type),['project']);assert.deepEqual(C.changes(ws,copy(ws)),[]);assert.equal(C.valid(C.changes(beforeArchive,ws)[0],ws),true);assert.deepEqual(C.changes(M.emptyWorkspace(),ws).filter(e=>e.type==='project'),[]);
});
test('shiny reveal waits for the first mature receipt, does not repeat after harvesting or reopening',()=>{
 const {ws,task}=fixture(),growing=copy(ws);assert.deepEqual(C.changes(M.emptyWorkspace(),ws),[]);M.moveTask(ws,task.id,'done');const event=C.changes(growing,ws)[0];assert.equal(event.type,'shiny');assert.ok(C.valid(event,ws));const mature=copy(ws);G.harvest(ws,task.id);assert.deepEqual(C.changes(mature,ws),[]);assert.ok(C.valid(event,ws));
 const other=fixture(),initial=copy(other.ws);M.moveTask(other.ws,other.task.id,'done');const otherEvent=C.changes(initial,other.ws)[0],first=copy(other.ws);M.moveTask(other.ws,other.task.id,'doing');assert.equal(C.valid(otherEvent,other.ws),false);M.moveTask(other.ws,other.task.id,'done');assert.deepEqual(C.changes(first,other.ws),[]);
});
test('rare, normal, forgotten and legacy plants do not create shiny announcements',()=>{
 for(const ticket of [5,1000]){const {ws,task}=fixture(ticket),before=copy(ws);M.moveTask(ws,task.id,'done');assert.deepEqual(C.changes(before,ws),[]);}
 const {ws,task}=fixture(),before=copy(ws);M.moveTask(ws,task.id,'done');ws.taskGarden.seeds[0].forgottenAt=Date.now();assert.deepEqual(C.changes(before,ws),[]);ws.taskGarden.seeds[0].forgottenAt=null;ws.taskGarden.seeds[0].taskId='legacy-old';assert.deepEqual(C.changes(before,ws),[]);
});
test('confetti launches inward from all three edges with all six materials and a bounded mobile count',()=>{
 for(const width of [390,1440]){const height=900,particles=C.burst(width,height,()=>.5);assert.equal(particles.length,width<600?108:180);assert.equal(new Set(particles.map(p=>p.material)).size,6);assert.deepEqual([...new Set(particles.map(p=>p.from))],['bottom','left','right']);for(const p of particles){assert.ok(p.vy<0);if(p.from==='bottom')assert.ok(p.y>height);if(p.from==='left')assert.ok(p.x<0&&p.vx>0);if(p.from==='right')assert.ok(p.x>width&&p.vx<0);}}
});
