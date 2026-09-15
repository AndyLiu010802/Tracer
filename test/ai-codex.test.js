'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {PassThrough}=require('node:stream'),{EventEmitter}=require('node:events');
const {createCodex,Rpc,quotaAvailable,runtimeArgs,childEnvironment,loginURL}=require('../lib/ai-codex');
const quota={ordinaryUsageAllowed:true,rateLimits:{limitId:'codex',primary:{usedPercent:20},secondary:{usedPercent:30}}};
const plan={title:'Report',summary:'Create a report.',questions:[],assumptions:[],risks:[],tasks:[{key:'t1',title:'Draft',notes:'',acceptance:'Reviewed',hours:1,priority:'medium',dependsOn:[],checklist:[]}]};
const constraints={start:'2026-09-15',deadline:'2026-10-15',weekly:10,daily:3,session:1,buffer:15,days:[1,2,3,4,5]};
function fixture(t,options={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-codex-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const calls=[];let processOptions,logged=false,output=plan,available=quota;
 const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};
 function emit(message){child.stdout.write(JSON.stringify(message)+'\n');}
 child.stdin.on('data',chunk=>{for(const line of chunk.toString().trim().split('\n')){const req=JSON.parse(line);calls.push(req);if(!req.method||req.id==null)continue;let result={};
  if(req.method==='account/read')result={account:logged?{type:options.api?'apiKey':'chatgpt',email:'user@example.com',planType:'pro'}:null};
  if(req.method==='account/login/start'){result=req.params.type==='chatgptDeviceCode'?{type:'chatgptDeviceCode',loginId:'login1',verificationUrl:options.badURL||'https://auth.openai.com/codex/device',userCode:'ABCD-EFGH'}:{type:'chatgpt',loginId:'login1',authUrl:options.badURL||'https://auth.openai.com/oauth/authorize?response_type=code&state=test'};}
  if(req.method==='account/logout')logged=false;
  if(req.method==='account/rateLimits/read')result=available;
  if(req.method==='thread/start')result={thread:{id:'thread1'}};
  if(req.method==='turn/start'){
   emit({method:'item/completed',params:{threadId:'thread1',item:{id:'message1',type:'agentMessage',text:JSON.stringify(output)}}});
   emit({method:'turn/completed',params:{threadId:'thread1',turn:{id:'turn1',status:'completed',items:[]}}});
   result={turn:{id:'turn1',status:'inProgress'}};
  }
  emit({id:req.id,result});
 }});
 const client=createCodex(dir,{executable:__filename,spawn:(exe,args,opts)=>{processOptions={exe,args,opts};return child;},timeout:500,turnTimeout:500});
 t.after(()=>client.close());
 return {client,calls,emit,get options(){return processOptions;},login(){logged=true;emit({method:'account/login/completed',params:{loginId:'login1',success:true}});},setQuota:q=>available=q,setOutput:p=>output=p};
}
test('ChatGPT login uses official browser flow and isolates credentials without API environment inheritance',async t=>{
 const f=fixture(t);assert.equal((await f.client.handle('codex-status')).account,null);
 const pending=await f.client.handle('codex-login');assert.deepEqual(pending.login,{url:'https://auth.openai.com/oauth/authorize?response_type=code&state=test',code:null});
 const device=await f.client.handle('codex-login',{method:'device'});assert.equal(device.login.code,'ABCD-EFGH');
 f.login();assert.equal((await f.client.handle('codex-status')).account.plan,'pro');
 await f.client.handle('codex-logout');assert.equal((await f.client.handle('codex-status')).account,null);
 assert.equal(f.options.opts.windowsHide,true);assert.ok(f.options.opts.env.CODEX_HOME.endsWith(path.join('.ai','codex')));
 assert.ok(!Object.keys(childEnvironment('isolated')).some(k=>/API_KEY|ACCESS_TOKEN/.test(k)));
 assert.ok(runtimeArgs().includes('forced_login_method="chatgpt"'));assert.ok(runtimeArgs().includes('cli_auth_credentials_store="keyring"'));
 assert.equal(f.calls[0].method,'initialize');assert.equal(f.calls[1].method,'initialized');
});
test('invalid authorization URLs are never returned; cancellation is routed to the pending login',async t=>{
 for(const url of ['http://auth.openai.com/codex/device','https://evil.example/codex/device','https://auth.openai.com/codex/device?token=secret'])assert.throws(()=>loginURL(url));
 const bad=fixture(t,{badURL:'https://evil.example/login'});await assert.rejects(bad.client.handle('codex-login'),/codex-invalid-login/);
 const f=fixture(t);await f.client.handle('codex-login');await f.client.handle('codex-cancel');assert.ok(f.calls.some(c=>c.method==='account/login/cancel'&&c.params.loginId==='login1'));
});
test('unknown or exhausted included quota prevents any model turn and never falls back to API',async t=>{
 const f=fixture(t);f.login();
 for(const q of [{}, {...quota,ordinaryUsageAllowed:false},{...quota,rateLimits:{primary:{usedPercent:100}}}]){
  f.setQuota(q);await assert.rejects(f.client.handle('codex-plan',{goal:'Report',constraints}),/codex-quota-/);
 }
 assert.ok(!f.calls.some(c=>c.method==='thread/start'||c.method==='turn/start'));
 assert.equal(quotaAvailable({...quota,ordinaryUsageAllowed:null}),false);assert.equal(quotaAvailable(quota),true);
 const api=fixture(t,{api:true});api.login();await assert.rejects(api.client.handle('codex-plan',{goal:'Report',constraints}),/codex-chatgpt-only/);
});
test('planning consumes only structured output from an ephemeral restricted thread, including early completion',async t=>{
 const f=fixture(t);f.login();const result=await f.client.handle('codex-plan',{goal:'Report',constraints});assert.equal(result.plan.title,'Report');
 const thread=f.calls.find(c=>c.method==='thread/start').params,turn=f.calls.find(c=>c.method==='turn/start').params;
 assert.equal(thread.ephemeral,true);assert.equal(thread.modelProvider,'openai');assert.equal(thread.config['features.shell_tool'],false);
 assert.equal(turn.sandboxPolicy.type,'readOnly');assert.equal(turn.sandboxPolicy.networkAccess,false);assert.equal(turn.serviceTier,'default');assert.ok(turn.outputSchema.required.includes('tasks'));
 f.setOutput({tasks:[]});await assert.rejects(f.client.handle('codex-plan',{goal:'Report',constraints}),/invalid-plan/);
});
test('RPC rejects server-initiated tools, cleans up on malformed data and times out unanswered requests',async()=>{
 function child(){const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin=new PassThrough();c.kill=()=>{};return c;}
 const c=child(),r=new Rpc(c,15),replies=[];c.stdin.on('data',s=>replies.push(JSON.parse(s.toString())));
 c.stdout.write(JSON.stringify({id:90,method:'item/commandExecution/requestApproval',params:{}})+'\n');assert.equal(replies[0].error.code,-32601);
 await assert.rejects(r.request('account/read'),/codex-timeout/);r.close();
 const c2=child(),r2=new Rpc(c2,100);const pending=r2.request('account/read');c2.stdout.write('not-json\n');await assert.rejects(pending,/invalid-response/);
});
