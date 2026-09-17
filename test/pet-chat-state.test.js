'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Work=require('../public/companion-work');
const proposal={type:'tasks',project:null,tasks:[{title:'A recoverable task',notes:'',due:null,scheduled:null,priority:'medium',estimate:null,checklist:[]}]};
const requestId='11111111-1111-4111-8111-111111111111';
const state=()=>({conversation:[{id:1,role:'user',content:'Create a task.',status:'sent'}],draft:'A new message',work:{requestId,proposal,status:'pending',result:null},proposalContext:proposal});
function setup(){
  const data=new Map();let unavailable=false;
  const storage={getItem:key=>data.get(key)??null,setItem(key,value){if(unavailable)throw new Error('quota');data.set(key,value);},removeItem:key=>data.delete(key)};
  const sandbox={TracerCompanionWork:Work,localStorage:storage};
  vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/pet-chat-state.js'),'utf8'),sandbox);
  return {api:sandbox.TracerPetChatState,data,storage,fail(value){unavailable=value;}};
}
const json=value=>JSON.parse(JSON.stringify(value));

test('chat persistence separates main/native and companions and whitelists only recovery fields',()=>{
  const f=setup(),main=f.api.create({surface:'main',petId:'sprout'}),native=f.api.create({surface:'native',petId:'sprout'}),other=f.api.create({surface:'main',petId:'miso'});
  main.load();native.load();other.load();
  main.save({...state(),apiKey:'never-store',workspace:{private:'never-store'}});
  assert.deepEqual(json(main.load()),state());assert.equal(native.load(),null);assert.equal(other.load(),null);
  const pending=state();pending.draft='Native draft';native.save(pending);assert.equal(main.load().draft,'A new message');assert.equal(native.load().draft,'Native draft');
  for(const value of f.data.values())assert.equal(value.includes('never-store'),false);
});

test('stable request and pending state survive reloading; completion preserves newly typed input',()=>{
  const f=setup(),old=f.api.create({surface:'main',petId:'sprout'});old.load();const value=state();value.work.status='saving';old.save(value);
  const reopened=f.api.create({surface:'main',petId:'sprout'}),restored=reopened.load();assert.equal(restored.work.requestId,requestId);assert.equal(restored.work.status,'saving');
  restored.draft='Typed while the previous window was saving';reopened.save(restored);
  assert.equal(old.finish(requestId,'created',{projectId:null,taskIds:['task-1']},'Created one task.'),true);
  const complete=old.load();assert.equal(complete.draft,restored.draft);assert.equal(complete.work.status,'created');assert.equal(complete.proposalContext,null);assert.equal(complete.conversation.at(-1).content,'Created one task.');
  assert.equal(old.finish(requestId,'failed'),false,'a late failure cannot downgrade known success');assert.equal(old.load().work.status,'created');
  assert.equal(old.finish(requestId,'created',{projectId:null,taskIds:['task-1']},'Created one task.'),true);assert.equal(old.load().conversation.length,2,'duplicate acknowledgements do not append duplicate success messages');
});

test('quota failure keeps the previous confirmation, and a stale view cannot overwrite another draft',()=>{
  const f=setup(),a=f.api.create({surface:'main',petId:'sprout'}),b=f.api.create({surface:'main',petId:'sprout'});a.load();a.save(state());b.load();
  f.fail(true);assert.throws(()=>a.save({...state(),draft:'not durable'}),/quota/);f.fail(false);assert.equal(a.load().draft,'A new message');
  const changed=state();changed.draft='Newer window';b.save(changed);
  assert.throws(()=>a.save(state()),/pet-chat-state-changed/);assert.throws(()=>a.clear(),/pet-chat-state-changed/);assert.equal(b.load().draft,'Newer window');
});

test('corrupt records remain intact until explicit clear and invalid proposals never enter storage',()=>{
  const f=setup(),key='tracer.petChat.v1.main.sprout';f.data.set(key,'{broken');const store=f.api.create({surface:'main',petId:'sprout'});
  assert.throws(()=>store.load());assert.throws(()=>store.save(state()));assert.equal(f.data.get(key),'{broken');store.clear();assert.equal(store.load(),null);
  const invalid=state();invalid.work.proposal={...proposal,tasks:[]};assert.throws(()=>store.save(invalid),/invalid-companion-work/);assert.equal(store.load(),null);
  const badId=state();badId.work.requestId='not-a-request';assert.throws(()=>store.save(badId),/pet-chat-state-invalid/);
});

test('a completion cannot recreate a cleared chat or replace a newer proposal',()=>{
  const f=setup(),store=f.api.create({surface:'native',petId:'sprout'});store.load();store.save(state());store.clear();
  assert.equal(store.finish(requestId,'created',{projectId:null,taskIds:['task-1']}),false);assert.equal(store.load(),null);
  const next=state();next.work.requestId='22222222-2222-4222-8222-222222222222';store.save(next);
  assert.equal(store.finish(requestId,'failed'),false);assert.equal(store.load().work.requestId,next.work.requestId);
});
