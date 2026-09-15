'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createService}=require('../ai-service/server'),Provider=require('../ai-service/provider'),{createGateway,endpoint,setSecureStorage}=require('../lib/ai-gateway');
const c={start:'2026-09-14',deadline:'2026-10-01',days:[1,2,3,4,5],weekly:10,daily:3,session:1,buffer:10};
const plan={title:'Project',summary:'Summary',assumptions:[],risks:[],questions:[],tasks:[{key:'t1',title:'Task',notes:'',acceptance:'Reviewed',hours:2,priority:'medium',dependsOn:[],checklist:[]}]};
test('provider uses server-side credentials, strict JSON and no response storage',async()=>{
 let request;const result=await Provider.generate({goal:'Ship a project',constraints:c},{apiKey:'server-only',request:async(url,opts)=>{request={url,...opts};return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(plan)}]}]}));}});
 assert.equal(result.title,'Project');const payload=JSON.parse(request.body);assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.equal(request.headers.Authorization,'Bearer server-only');assert.equal(request.url,'https://api.openai.com/v1/responses');
 await assert.rejects(Provider.generate({goal:'goal',constraints:c},{apiKey:'x',request:async()=>new Response(JSON.stringify({output:[{content:[{type:'refusal'}]}]}))}),/plan-refused/);
});
test('accounts, quotas, isolation, hashed storage and desktop private sessions work end to end',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-ai-')),file=path.join(dir,'db.json'),env={INVITE_CODE:'private-beta',DAILY_PLAN_LIMIT:'1',GLOBAL_DAILY_PLAN_LIMIT:'3'};
 let count=0;const server=createService({file,env,generate:async()=>{count++;return plan;}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const post=async(route,data,token)=>{const r=await fetch(url+'/v1/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(token||'')},body:JSON.stringify(data)});return {status:r.status,...await r.json()};};
 try{
  assert.equal((await post('plan',{goal:'g',constraints:c})).status,401);
  assert.equal((await post('register',{username:'alice',password:'long-password-123',invite:'wrong'})).error,'invalid-invite');
  const alice=await post('register',{username:'alice',password:'long-password-123',invite:'private-beta'});assert.ok(alice.token);
  const bad=await post('login',{username:'alice',password:'different-pass123'});assert.equal(bad.status,401);
  const a=await post('plan',{goal:'Goal',constraints:c},alice.token);assert.equal(a.plan.title,'Project');assert.equal(a.user.remaining,0);
  assert.equal((await post('plan',{goal:'Goal',constraints:c},alice.token)).error,'quota-exceeded');assert.equal(count,1);
  const bridge=createGateway(path.join(dir,'desktop'));await bridge.handle('configure',{url});const login=await bridge.handle('login',{username:'alice',password:'long-password-123'});assert.ok(!login.token);assert.equal((await bridge.handle('status')).user.username,'alice');
  const stored=fs.readFileSync(path.join(dir,'desktop','.ai','connection.json'),'utf8');assert.ok(!stored.includes('token'));assert.equal((await createGateway(path.join(dir,'desktop')).handle('status')).user,null);
  setSecureStorage({isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('encrypted:'+s).reverse(),decryptString:b=>Buffer.from(b).reverse().toString().slice(10)});
  await bridge.handle('login',{username:'alice',password:'long-password-123'});assert.equal((await createGateway(path.join(dir,'desktop')).handle('status')).user.username,'alice');
  await bridge.handle('logout',{});assert.equal((await bridge.handle('status')).user,null);
  const db=fs.readFileSync(file,'utf8');assert.ok(!db.includes('long-password-123')&&!db.includes(alice.token));
  await post('logout',{},alice.token);assert.equal((await post('plan',{goal:'g',constraints:c},alice.token)).status,401);
  assert.doesNotThrow(()=>createService({file,env}));
 }finally{setSecureStorage(null);await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
test('gateway refuses credentials, paths and nonlocal plaintext URLs',()=>{for(const u of ['http://example.com','https://user:secret@example.com','https://example.com/path','https://example.com/?key=x'])assert.throws(()=>endpoint(u));assert.equal(endpoint('https://ai.example.com'),'https://ai.example.com');});
