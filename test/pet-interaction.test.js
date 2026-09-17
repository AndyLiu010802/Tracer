'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../skins/tracer/pet-model');
const now=new Date(2026,8,16,12).getTime();

test('touching a companion improves joy and bond with a shared anti-spam cooldown',()=>{
 const s=P.fresh(now),pet=P.current(s);pet.joy=40;
 assert.deepEqual(P.act(s,'pet',null,now),{accepted:true,reason:'ok',action:'pet'});
 assert.equal(pet.joy,45);assert.equal(pet.bond,1);assert.equal(pet.energy,85);
 assert.deepEqual(P.act(s,'pet',null,now+100),{accepted:false,reason:'cooldown',action:'pet'});
 assert.deepEqual(P.act(s,'play',null,now+200),{accepted:false,reason:'cooldown',action:'play'});
 assert.equal(pet.bond,1);assert.equal(s.lastActionAt,now);
 assert.equal(P.act(s,'pet',null,now+2500).accepted,true);assert.equal(pet.bond,2);
 assert.equal(P.read(JSON.parse(JSON.stringify(s)),now+2500).lastAction,'pet');
 pet.joy=99;pet.bond=99.5;
 P.act(s,'pet',null,now+5000);assert.equal(pet.joy,100);assert.equal(pet.bond,100);
 assert.equal(P.act(s,'pet',null,now+5000).reason,'content');
});

test('care reports clear reasons for rejected actions without replacing the last successful action',()=>{
 const s=P.fresh(now),pet=P.current(s);
 pet.food=100;assert.equal(P.act(s,'feed',null,now).reason,'full');
 pet.energy=10;assert.equal(P.act(s,'play',null,now).reason,'tired');
 pet.energy=80;pet.joy=100;assert.equal(P.act(s,'play',null,now).reason,'content');
 assert.deepEqual(P.act(s,'sleep',null,now),{accepted:true,reason:'ok',action:'sleep'});
 for(const action of ['feed','play','pet'])assert.deepEqual(P.act(s,action,null,now),{accepted:false,reason:'sleeping',action});
 assert.equal(s.lastAction,'sleep');assert.equal(pet.bond,0);
 assert.deepEqual(P.act(s,'sleep',null,now),{accepted:true,reason:'ok',action:'wake'});
 assert.equal(P.act(s,'unsupported',null,now).reason,'invalid-action');
 assert.equal(P.act(s,'select','nova',now).reason,'locked');
});

test('humanoid companions respond to direct touch and changing companions clears old action feedback',()=>{
 const s=P.fresh(now),id='custom_'+'b'.repeat(32);
 P.addCustom(s,{id,name:'June',kind:'humanoid',personality:'Thoughtful',image:'/api/pet-art/'+'b'.repeat(32)+'.png'},now);
 assert.equal(P.act(s,'pet',null,now).accepted,true);assert.equal(P.current(s).bond,1);
 assert.equal(P.act(s,'select','sprout',now).accepted,true);assert.equal(s.lastAction,'');assert.equal(s.lastActionAt,0);
 assert.equal(P.act(s,'pet',null,now).accepted,true);assert.equal(P.current(s).bond,1);
 assert.equal(s.pets[id].bond,1);
});
