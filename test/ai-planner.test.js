'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../public/ai-planner'),M=require('../skins/tracer/model');
const c={start:'2026-09-14',deadline:'2026-09-25',days:[1,2,3,4,5],weekly:10,daily:3,session:1,buffer:20};
const task=(key,hours,dependsOn=[])=>({key,title:key,notes:'Detailed work',acceptance:'Deliverable reviewed',hours,priority:'medium',dependsOn,checklist:['Review result']});
const plan=tasks=>({title:'A project',summary:'A summary',assumptions:[],questions:[],risks:[],tasks});
test('scheduling respects workdays, daily/weekly caps, buffer, existing work and dependency order',()=>{
 const existing=[{id:'old',scheduled:'2026-09-14',estimate:2,spent:0,status:'todo'}],p=plan([task('b',3,['a']),task('a',6)]),s=P.schedule(p,c,existing);
 assert.equal(s.missingHours,0);assert.equal(s.totalHours,9);assert.ok(s.weekly.every(w=>w.hours<=8));assert.equal(s.blocks.filter(b=>b.date==='2026-09-14').reduce((n,b)=>n+b.hours,0),1);
 assert.ok(s.blocks.every(b=>c.days.includes(new Date(b.date+'T12:00:00Z').getUTCDay())&&b.hours<=1));
 assert.ok(s.blocks.find(b=>b.key==='b').date>=s.blocks.filter(b=>b.key==='a').at(-1).date);
});
test('reports shortfall instead of silently scheduling past deadline',()=>{const s=P.schedule(plan([task('a',40),task('b',2,['a'])]),c,[]);assert.equal(s.scheduledHours,16);assert.equal(s.missingHours,26);assert.ok(s.blocks.every(b=>b.date<=c.deadline));});
test('unknown task estimates reserve 1 hour; completed work does not consume capacity',()=>{const s=P.schedule(plan([task('a',1)]),c,[{id:'x',scheduled:c.start,status:'todo'},{id:'done',scheduled:c.start,status:'done',estimate:100}]);assert.equal(s.unknownEstimates,1);assert.equal(s.weekly[0].hours,2);});
test('rejects dependency cycles, invalid dates and zero session lengths',()=>{
 assert.throws(()=>P.proposal(plan([task('a',1,['b']),task('b',1,['a'])])),/invalid-dependencies/);
 for(const patch of [{deadline:'2026-02-30'},{days:[]},{days:{}},{session:0},{session:4}])assert.throws(()=>P.constraints({...c,...patch}));
});
test('plan application preserves existing tasks/history and is idempotent',()=>{
 const ws=M.emptyWorkspace();M.addTask(ws,{title:'Previous completed task',status:'done'});const before=JSON.stringify(ws),p=plan([task('a',2),task('b',1,['a'])]);
 const result=P.apply(ws,p,c,'aip_test',M);assert.equal(JSON.stringify(ws),before);assert.equal(result.tasks,3);assert.deepEqual(result.workspace.completionHistory,ws.completionHistory);assert.deepEqual(result.workspace.tasks[0],ws.tasks[0]);
 assert.equal(result.workspace.tasks.at(-1).dependsOn[0],result.workspace.tasks.at(-2).id);assert.equal(result.workspace.tasks.at(-1).checklist[0].text,'Review result');
 assert.equal(P.apply(result.workspace,p,c,'aip_test',M).duplicate,true);assert.equal(result.workspace.notes[0].body,'A summary\n\n');
 assert.throws(()=>P.apply(ws,plan([task('a',160)]),c,'aip_short',M),/insufficient-capacity/);
});
module.exports={c,task,plan};
test('task keys matching Object prototype names remain valid independent keys',()=>{const p=plan([task('constructor',1),task('__proto__',1,['constructor'])]);const result=P.apply(M.emptyWorkspace(),p,c,'aip_keys',M);assert.equal(result.tasks,2);assert.equal(result.workspace.tasks[1].dependsOn[0],result.workspace.tasks[0].id);});
