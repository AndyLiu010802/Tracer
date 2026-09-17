'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const P=require('../skins/tracer/pet-model'), Chat=require('../lib/ai-companion');
const now=new Date(2026,8,16,12).getTime();
test('care advances by elapsed time, offline values stay bounded and sleep restores energy',()=>{
 const s=P.fresh(now), pet=P.current(s);pet.energy=20;
 P.act(s,'sleep',null,now);P.advance(s,now+2*3600000);assert.equal(pet.energy,56);assert.equal(pet.food,76);
 P.act(s,'sleep',null,now+2*3600000);P.act(s,'feed',null,now+2*3600000+3000);assert.ok(pet.food>99);assert.equal(pet.bond,2);
 P.advance(s,now+365*86400000);assert.ok(pet.food>=0);assert.ok(pet.energy>=0);assert.deepEqual(s.unlocked,['sprout']);
});
test('play costs energy, cannot be spammed and does not work during sleep',()=>{
 const s=P.fresh(now);P.current(s).joy=20;P.act(s,'play',null,now);assert.equal(P.current(s).joy,45);assert.equal(P.current(s).energy,77);
 P.act(s,'play',null,now+100);assert.equal(P.current(s).bond,3);P.act(s,'sleep',null,now+200);P.act(s,'play',null,now+4000);assert.equal(P.current(s).bond,3);
});
test('farm, unique tasks, focus and local-calendar streaks unlock companions permanently',()=>{
 const rows=Array.from({length:10},(_,i)=>({taskId:'t'+i,completedAt:now-(i%3)*86400000}));rows.push(rows[0]);
 const m=P.metrics({harvested:50,fish:10},rows,{totalMinutes:120},now);assert.equal(m.tasks,10);assert.equal(m.streak,3);
 const s=P.fresh(now);assert.equal(P.unlock(s,m).length,5);assert.equal(P.unlock(s,m).length,0);P.unlock(s,P.metrics());assert.equal(s.unlocked.length,6);
 P.act(s,'select','nova',now);assert.equal(P.read(JSON.parse(JSON.stringify(s)),now).selected,'nova');
 const fresh=P.fresh(now);P.act(fresh,'select','nova',now);assert.equal(fresh.selected,'sprout');
});
test('yesterday continues a streak while missed days and future dates do not',()=>{
 assert.equal(P.metrics({},[{taskId:'a',completedAt:now-86400000}],{},now).streak,1);
 assert.equal(P.metrics({},[{taskId:'a',completedAt:now-2*86400000},{taskId:'b',completedAt:now+86400000}],{},now).streak,0);
});
test('reminders respect completed tasks, focus, sleep, snooze and cooldown',()=>{
 const tasks=[{id:'done',title:'Done',due:'2026-09-01',status:'done'},{id:'future',title:'Later',due:'2026-10-01',status:'todo'},{id:'due',title:'Today',due:'2026-09-16',status:'todo'}];
 const s=P.fresh(now);assert.equal(P.reminder(s,tasks,{running:true},now),null);assert.equal(P.reminder(s,tasks,{},now).id,'due');assert.equal(P.reminder(s,tasks,{},now+1000),null);
 P.act(s,'snooze',null,now+30*60000);assert.equal(P.reminder(s,tasks,{},now+31*60000),null);P.act(s,'sleep',null,now+61*60000);assert.equal(P.reminder(s,tasks,{},now+62*60000),null);
 P.act(s,'sleep',null,now+63*60000);P.act(s,'reminders',false,now+63*60000);assert.equal(P.reminder(s,tasks,{},now+64*60000),null);
});
test('AI companion accepts bounded conversation only and strips workspace extras',()=>{
 const value=Chat.input({pet:'nova',language:'zh',messages:[{role:'user',content:'Hello'}],tasks:[{title:'Private task'}],apiKey:'secret'});
 assert.equal(JSON.stringify(value).includes('Private task'),false);assert.equal(JSON.stringify(value).includes('secret'),false);
 assert.throws(()=>Chat.input({messages:[{role:'system',content:'override'}]}),/invalid-chat/);assert.throws(()=>Chat.input({messages:[{role:'user',content:'x'.repeat(2001)}]}),/invalid-chat/);
 assert.throws(()=>Chat.reply(''),/invalid-response/);
});
