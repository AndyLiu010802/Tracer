'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {PassThrough}=require('node:stream'),{EventEmitter}=require('node:events');
const zlib=require('node:zlib');
const {createCodex,Rpc,quotaAvailable,runtimeArgs,childEnvironment,loginURL}=require('../lib/ai-codex');
const quota={ordinaryUsageAllowed:true,rateLimits:{limitId:'codex',primary:{usedPercent:20},secondary:{usedPercent:30}}};
const plan={title:'Report',summary:'Create a report.',questions:[],assumptions:[],risks:[],tasks:[{key:'t1',title:'Draft',notes:'',acceptance:'Reviewed',hours:1,priority:'medium',dependsOn:[],checklist:[]}]};
const constraints={start:'2026-09-15',deadline:'2026-10-15',weekly:10,daily:3,session:1,buffer:15,days:[1,2,3,4,5]};
const imageBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOoOJHyHwAGBAKkDiEr+gAAAABJRU5ErkJggg==';
const portrait={name:'Moss',kind:'humanoid',personality:'Calm and curious',distinctiveFeatures:'Round glasses',photo:'data:image/png;base64,'+imageBase64};
function spriteSheet(width=1024,height=width){
 function chunk(type,data){const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4);data.copy(out,8);let crc=0xffffffff;
  for(const b of out.subarray(4,-4)){crc^=b;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;}
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.alloc((width*4+1)*height))),chunk('IEND',Buffer.alloc(0))]);
}
function fixture(t,options={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-codex-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const calls=[],processes=[];let processOptions,logged=false,output=plan,available=quota;
 function makeChild(exe,args,opts){
 const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.killed=false;
 child.kill=()=>{if(child.killed)return;child.killed=true;setImmediate(()=>{child.exitCode=0;child.emit('exit',0);});};
 processOptions={exe,args,opts,child};processes.push(processOptions);
 function emit(message){child.stdout.write(JSON.stringify(message)+'\n');}
 child.stdin.on('data',chunk=>{for(const line of chunk.toString().trim().split('\n')){const req=JSON.parse(line);calls.push(req);if(!req.method||req.id==null)continue;let result={};
  if(req.method==='account/read')result={account:logged?{type:options.api?'apiKey':'chatgpt',email:'user@example.com',planType:'pro'}:null};
  if(req.method==='account/login/start'){result=req.params.type==='chatgptDeviceCode'?{type:'chatgptDeviceCode',loginId:'login1',verificationUrl:options.badURL||'https://auth.openai.com/codex/device',userCode:'ABCD-EFGH'}:{type:'chatgpt',loginId:'login1',authUrl:options.badURL||'https://auth.openai.com/oauth/authorize?response_type=code&state=test'};}
  if(req.method==='account/logout')logged=false;
  if(req.method==='account/rateLimits/read')result=available;
  if(req.method==='modelProvider/capabilities/read')result={imageGeneration:options.imageCapability!==false,namespaceTools:true,webSearch:true};
  if(req.method==='thread/start')result={thread:{id:'thread1'}};
  if(req.method==='turn/start'){
   if(options.images&&args.includes('features.code_mode_host=true')){for(const item of options.images({room:calls.findLast(c=>c.method==='thread/start').params.cwd,dir,turn:req.params}))emit({method:'item/completed',params:{threadId:'thread1',item}});}
   else emit({method:'item/completed',params:{threadId:'thread1',item:{id:'message1',type:'agentMessage',text:options.rawOutput===undefined?JSON.stringify(output):options.rawOutput}}});
   if(!options.hang)emit({method:'turn/completed',params:{threadId:'thread1',turn:{id:'turn1',status:'completed',items:[]}}});
   result={turn:{id:'turn1',status:'inProgress'}};
  }
  emit({id:req.id,result});
 }});return child;
 }
 function emit(message){processes[0]?.child.stdout.write(JSON.stringify(message)+'\n');}
 const client=createCodex(dir,{executable:__filename,spawn:makeChild,timeout:500,turnTimeout:500,imageTimeout:options.imageTimeout||500,
  ...(options.removeArtwork?{removeArtwork:options.removeArtwork}: {})});
 t.after(()=>client.close());
 return {client,calls,emit,dir,processes,get options(){return processOptions;},login(){logged=true;emit({method:'account/login/completed',params:{loginId:'login1',success:true}});},setQuota:q=>available=q,setOutput:p=>output=p};
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
 assert.ok(runtimeArgs().includes('features.image_generation=false'));
 assert.ok(runtimeArgs().includes('features.code_mode_host=false'));
 assert.equal(f.calls[0].method,'initialize');assert.equal(f.calls[1].method,'initialized');
 assert.equal(f.calls[0].params.capabilities.experimentalApi,true);
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
 assert.equal(thread.config['features.image_generation'],false);
 assert.equal(thread.config['features.code_mode_host'],false);
 assert.equal(turn.sandboxPolicy.type,'readOnly');assert.equal(turn.sandboxPolicy.networkAccess,false);assert.equal(turn.serviceTier,'default');assert.ok(turn.outputSchema.required.includes('tasks'));
 f.setOutput({tasks:[]});await assert.rejects(f.client.handle('codex-plan',{goal:'Report',constraints}),/invalid-plan/);
});
test('companion chat reuses the signed-in account with a restricted tool-free turn',async t=>{
 const f=fixture(t);f.login();f.setOutput({reply:'Hello, let’s take one small step.',proposal:null});
 const result=await f.client.handle('codex-chat',{pet:'nova',messages:[{role:'user',content:'Hi'}]});assert.equal(result.reply,'Hello, let’s take one small step.');
 const thread=f.calls.find(c=>c.method==='thread/start').params,turn=f.calls.find(c=>c.method==='turn/start').params;
 assert.ok(thread.baseInstructions.includes('virtual companion'));assert.equal(thread.config['features.shell_tool'],false);assert.deepEqual(turn.outputSchema.required,['reply','proposal']);assert.equal(turn.sandboxPolicy.networkAccess,false);
 assert.equal(thread.config['features.code_mode_host'],false);assert.ok(f.processes[0].args.includes('features.code_mode_host=false'));
});

test('subscription chat preserves selected plant identity and trusted profile when old history names a sheep',async t=>{
 const f=fixture(t);f.login();f.setOutput({reply:'我是苹宝，苹果花精灵。',proposal:null});
 const messages=[{role:'user',content:'你好呀'},{role:'assistant',content:'我是芽芽，一只蓬松的小绵羊。'},{role:'user',content:'请介绍你自己。'}];
 for(const shiny of [false,true]){
  const pet='garden_apple'+(shiny?'_shiny':'');
  await f.client.handle('codex-chat',{pet,language:'zh',messages,companion:{name:'Wrong caller identity',personality:'Wrong caller biography',kind:'humanoid'}});
  const thread=f.calls.findLast(c=>c.method==='thread/start').params,turn=f.calls.findLast(c=>c.method==='turn/start').params;
  const sent=JSON.parse(turn.input[0].text);
  assert.equal(sent.pet,pet);assert.deepEqual(sent.messages,messages);assert.equal(sent.companion,undefined);
  assert.match(thread.baseInstructions,/Authored garden companion profile/);
  assert.ok(thread.baseInstructions.includes(JSON.stringify({id:pet,name:shiny?'闪光 · 苹宝':'苹宝',plantKind:'apple',shiny,form:'magical plant spirit'})));
  assert.match(thread.baseInstructions,/The active character profile defines your current identity, even if earlier assistant messages used a different name or species\./);
  assert.doesNotMatch(thread.baseInstructions,/patient cloud sheep|Wrong caller/);
 }
});

test('subscription chat returns only validated draft proposals and never sends existing task or project records',async t=>{
 const proposal={type:'project',project:{name:'Report',notes:'Summarize findings',start:null,end:null},tasks:[]};
 const f=fixture(t);f.login();f.setOutput({reply:'What should the project deliver?',proposal:null});
 const input={pet:'ember',today:'2026-09-17',messages:[{role:'user',content:'Create a project.'}],tasks:[{title:'Private existing task'}],projects:[{name:'Private existing project'}],workspace:{notes:'Private workspace note'}};
 assert.equal((await f.client.handle('codex-chat',input)).proposal,null);
 f.setOutput({reply:'Here is a project draft for your confirmation.',proposal});
 assert.deepEqual((await f.client.handle('codex-chat',{...input,messages:[...input.messages,{role:'assistant',content:'What should the project deliver?'},{role:'user',content:'A summary report. No deadline.'}]})).proposal,proposal);
 f.setOutput({reply:'Updated draft for review.',proposal:{...proposal,project:{...proposal.project,end:'2026-09-18'}}});
 await f.client.handle('codex-chat',{...input,proposal,messages:[{role:'user',content:'Make it due tomorrow.'}]});
 const thread=f.calls.findLast(c=>c.method==='thread/start').params,turn=f.calls.findLast(c=>c.method==='turn/start').params;
 const sent=JSON.parse(turn.input[0].text);
 assert.equal(sent.today,input.today);assert.deepEqual(sent.proposal,proposal);
 for(const privateText of ['Private existing task','Private existing project','Private workspace note'])assert.equal(JSON.stringify(turn).includes(privateText),false);
 assert.equal(thread.ephemeral,true);assert.equal(thread.config['features.shell_tool'],false);assert.equal(thread.config['features.code_mode_host'],false);
 assert.deepEqual(turn.sandboxPolicy,{type:'readOnly',networkAccess:false});assert.deepEqual(turn.outputSchema.required,['reply','proposal']);
 assert.equal(fs.existsSync(path.join(f.dir,'workspace.json')),false);
 f.setOutput({reply:'Draft',proposal:{type:'tasks',project:null,tasks:[]}});
 await assert.rejects(f.client.handle('codex-chat',input),/invalid-response/);
 const turns=f.calls.filter(c=>c.method==='turn/start').length;
 await assert.rejects(f.client.handle('codex-chat',{...input,proposal:{tasks:[]}}),/invalid-chat/);
 assert.equal(f.calls.filter(c=>c.method==='turn/start').length,turns);
});

test('subscription chat handles legacy prose safely and rejects malformed structured output',async t=>{
 const input={pet:'sprout',messages:[{role:'user',content:'Hello'}]};
 const prose=fixture(t,{rawOutput:'Hello, take a little stretch.'});prose.login();
 assert.deepEqual(await prose.client.handle('codex-chat',input),{reply:'Hello, take a little stretch.',proposal:null});
 const malformed=fixture(t,{rawOutput:'{"reply":"Draft","proposal":'});malformed.login();
 await assert.rejects(malformed.client.handle('codex-chat',input),/invalid-response/);
});

test('subscription artwork uses only native image output, attached photo and an isolated ephemeral artwork thread',async t=>{
 const f=fixture(t,{images:()=>[{id:'image1',type:'imageGeneration',status:'completed',result:imageBase64,transparentBackground:true}]});f.login();
 assert.equal((await f.client.handle('codex-status')).imageGeneration,true);
 const result=await f.client.handle('codex-pet-image',{...portrait,tasks:[{title:'Private task'}],apiKey:'never-forward-me'});
 assert.match(result.image,/^\/api\/pet-art\/[a-f0-9]{32}\.png$/);assert.equal(result.model,'codex-image-generation');
 assert.equal(Object.hasOwn(result,'animationPage'),false);
 const thread=f.calls.find(c=>c.method==='thread/start').params,turn=f.calls.find(c=>c.method==='turn/start').params;
 assert.equal(thread.ephemeral,true);assert.equal(thread.config['features.image_generation'],true);assert.equal(thread.config['features.shell_tool'],false);
 assert.equal(thread.config['features.code_mode_host'],true);
 assert.equal(thread.config['features.unified_exec'],false);assert.equal(thread.config['features.multi_agent'],false);assert.equal(thread.config['features.plugins'],false);
 assert.equal(thread.modelProvider,'openai');assert.equal(turn.approvalPolicy,'never');assert.equal(turn.serviceTier,'default');
 assert.deepEqual(turn.sandboxPolicy,{type:'readOnly',networkAccess:false});
 assert.equal(thread.sandbox,'read-only');assert.equal(thread.config['features.omit_app_server_notification_media'],false);
 assert.deepEqual(thread.environments,[]);assert.equal(turn.environments,undefined);assert.equal(turn.cwd,undefined);
 assert.ok(thread.baseInstructions.includes('num_last_images_to_include=1'));
 assert.equal(turn.input[1].type,'image');assert.equal(turn.input[1].url,portrait.photo);assert.equal(turn.input[1].detail,'original');
 assert.ok(turn.input[0].text.includes(portrait.distinctiveFeatures));assert.ok(!JSON.stringify(turn).includes('Private task'));assert.ok(!JSON.stringify(turn).includes('never-forward-me'));
 assert.deepEqual(fs.readFileSync(path.join(f.dir,'.pet-art',result.image.split('/').pop())),Buffer.from(imageBase64,'base64'));
 assert.equal(fs.existsSync(thread.cwd),false);assert.ok(f.calls.some(c=>c.method==='thread/unsubscribe'));
 assert.equal(f.processes.length,2);assert.ok(f.processes[0].args.includes('features.code_mode_host=false'));
 assert.ok(f.processes[1].args.includes('features.code_mode_host=true'));
 assert.equal(f.processes[0].opts.env.CODEX_HOME,f.processes[1].opts.env.CODEX_HOME);
 assert.equal(f.processes[1].opts.windowsHide,true);assert.equal(f.processes[1].child.killed,true);assert.equal(f.processes[0].child.killed,false);
 assert.equal((await f.client.handle('codex-plan',{goal:'Report',constraints})).plan.title,'Report');
 assert.equal(f.processes.length,2);assert.equal(f.calls.findLast(c=>c.method==='thread/start').params.config['features.code_mode_host'],false);
});

test('subscription animation pages attach the source and validated first sheet while preserving their exact action order',async t=>{
 const sheet=spriteSheet(),encoded=sheet.toString('base64');
 const f=fixture(t,{images:()=>[{id:'image1',type:'imageGeneration',status:'completed',result:encoded}]});f.login();
 const first=await f.client.handle('codex-pet-image',{...portrait,animationPage:0});assert.equal(first.animationPage,0);
 for(const animationPage of [1,2,3]){
  const result=await f.client.handle('codex-pet-image',{...portrait,animationPage,identityImage:first.image});assert.equal(result.animationPage,animationPage);
  const thread=f.calls.findLast(c=>c.method==='thread/start').params,turn=f.calls.findLast(c=>c.method==='turn/start').params;
  assert.match(thread.baseInstructions,/one animation sprite sheet/);assert.match(thread.baseInstructions,/num_last_images_to_include=2/);
  assert.deepEqual(thread.environments,[]);assert.equal(thread.config['features.code_mode_host'],true);assert.equal(thread.config['features.shell_tool'],false);
  assert.equal(turn.input.length,3);assert.equal(turn.input[1].url,portrait.photo);assert.equal(turn.input[2].url,'data:image/png;base64,'+encoded);
  assert.equal(turn.input[2].detail,'original');assert.ok(!JSON.stringify(turn).includes(first.image));assert.ok(!JSON.stringify(turn).includes(f.dir));
  assert.ok(turn.input[0].text.includes(['','sleep, wake, focus, drag','fishing, exercise, farming, mining','reading, writing, crafting, tea'][animationPage]));
  assert.deepEqual(fs.readFileSync(path.join(f.dir,'.pet-art',result.image.split('/').pop())),sheet);
 }
 const firstThread=f.calls.find(c=>c.method==='thread/start').params,firstTurn=f.calls.find(c=>c.method==='turn/start').params;
 assert.match(firstThread.baseInstructions,/num_last_images_to_include=1/);assert.equal(firstTurn.input.length,2);assert.match(firstTurn.input[0].text,/idle, pet, feed, play/);
 assert.equal(f.processes.length,5);assert.ok(f.processes.slice(1).every(p=>p.child.killed));
});

test('subscription animation rejects malformed inputs before a turn and unsuitable sheet dimensions before saving',async t=>{
 const invalid=fixture(t);invalid.login();
 for(const animationPage of [null,-1,4,'1',.5])await assert.rejects(invalid.client.handle('codex-pet-image',{...portrait,animationPage}),/invalid-animation-page/);
 for(const identityImage of [undefined,'https://example.test/identity.png','/api/pet-art/'+'a'.repeat(32)+'.png'])
  await assert.rejects(invalid.client.handle('codex-pet-image',{...portrait,animationPage:1,identityImage}),/invalid-identity-image/);
 assert.ok(!invalid.calls.some(c=>c.method==='turn/start'||c.method==='thread/start'));assert.equal(invalid.processes.length,1);
 for(const result of [imageBase64,spriteSheet(1024,900).toString('base64')]){
  const f=fixture(t,{images:()=>[{id:'image1',type:'imageGeneration',status:'completed',result}]});f.login();
  await assert.rejects(f.client.handle('codex-pet-image',{...portrait,animationPage:0}),/invalid-animation-image/);
  assert.equal(fs.existsSync(path.join(f.dir,'.pet-art')),false);assert.equal(f.processes[1].child.killed,true);
 }
});

test('subscription dense sheets preserve their version and continue all sixteen poses of one action', async t => {
 const encoded=spriteSheet().toString('base64');
 const f=fixture(t,{images:()=>[{id:'image1',type:'imageGeneration',status:'completed',result:encoded}]});f.login();
 const first=await f.client.handle('codex-pet-image',{...portrait,animationVersion:2,animationPage:0});
 assert.equal(first.animationVersion,2);
 const last=await f.client.handle('codex-pet-image',{...portrait,animationVersion:2,animationPage:15,identityImage:first.image});
 assert.equal(last.animationPage,15);assert.equal(last.animationVersion,2);
 const thread=f.calls.findLast(c=>c.method==='thread/start').params,turn=f.calls.findLast(c=>c.method==='turn/start').params;
 assert.match(thread.baseInstructions,/sixteen consecutive distinct poses of ONE action/);
 assert.match(turn.input[0].text,/ONE action: tea/);assert.match(turn.input[0].text,/row 4 frames 13-16/);
 assert.equal(turn.input.length,3);assert.equal(turn.input[2].url,'data:image/png;base64,'+encoded);
 assert.equal(thread.config['features.shell_tool'],false);
});

test('subscription 32-frame sheets use a consistent wide layout and preserve supplied crafting information', async t => {
 const encoded=spriteSheet(2048,1024).toString('base64');
 const f=fixture(t,{images:()=>[{id:'image1',type:'imageGeneration',status:'completed',result:encoded}]});f.login();
 const first=await f.client.handle('codex-pet-image',{...portrait,animationVersion:3,animationPage:0});
 const last=await f.client.handle('codex-pet-image',{...portrait,animationVersion:3,animationPage:14,identityImage:first.image,actionDescription:'Fold a paper boat'});
 assert.equal(last.animationVersion,3);assert.equal(last.animationPage,14);
 const thread=f.calls.findLast(c=>c.method==='thread/start').params,turn=f.calls.findLast(c=>c.method==='turn/start').params;
 assert.match(thread.baseInstructions,/four rows and eight columns/);assert.match(thread.baseInstructions,/2048x1024/);
 assert.match(turn.input[0].text,/row 4 frames 25-32/);assert.match(turn.input[0].text,/Fold a paper boat/);
 assert.doesNotMatch(turn.input[0].text,/4x4|16-frame|square 1024x1024/);
 assert.equal(turn.input.length,3);
});

test('image prerequisites stop before a model turn and never fall back to personal API billing',async t=>{
 const unsigned=fixture(t);await assert.rejects(unsigned.client.handle('codex-pet-image',portrait),/codex-login-required/);
 const noImage=fixture(t,{imageCapability:false});noImage.login();assert.equal((await noImage.client.handle('codex-status')).imageGeneration,false);
 await assert.rejects(noImage.client.handle('codex-pet-image',portrait),/codex-image-unavailable/);
 const exhausted=fixture(t);exhausted.login();exhausted.setQuota({...quota,ordinaryUsageAllowed:false});await assert.rejects(exhausted.client.handle('codex-pet-image',portrait),/codex-quota-exhausted/);
 for(const f of [unsigned,noImage,exhausted]){assert.ok(!f.calls.some(c=>c.method==='thread/start'||c.method==='turn/start'));assert.equal(f.processes.length,1);}
});

test('native image quota/refusal/text-only results cannot become fake companions',async t=>{
 for(const [items,expected] of [
  [[{id:'image1',type:'imageGeneration',status:'failed',result:'',failure:{type:'usageLimitExceeded',limitId:'codex'}}],/codex-quota-exhausted/],
  [[{id:'image1',type:'imageGeneration',status:'failed',result:''}],/codex-image-generation-failed/],
  [[{id:'image1',type:'imageGeneration',status:'completed',result:'not-base64'}],/invalid-image-response/],
  [[{id:'text1',type:'agentMessage',text:'Saved C:/secrets/portrait.png'}],/codex-image-no-result/],
  [[{id:'tool1',type:'functionCallOutput',name:'exec',namespace:'functions',output:'code-mode host is disabled; private diagnostic content'}],/codex-image-tool-unavailable/],
  [[{id:'tool1',type:'functionCallOutput',name:'exec',namespace:'functions',output:[{type:'input_text',text:'image_generation tool unavailable'}]}],/codex-image-tool-unavailable/],
  [[{id:'a',type:'imageGeneration',status:'completed',result:imageBase64},{id:'b',type:'imageGeneration',status:'completed',result:imageBase64}],/invalid-image-response/]
 ]){const f=fixture(t,{images:()=>items});f.login();await assert.rejects(f.client.handle('codex-pet-image',portrait),expected);assert.equal(fs.existsSync(path.join(f.dir,'.pet-art')),false);assert.deepEqual(fs.readdirSync(path.join(f.dir,'.ai','artwork-room')),[]);}
});

test('native saved image fallback accepts only a new artifact at its exact default cache path',async t=>{
 const good=fixture(t,{images:({dir})=>{const file=path.join(dir,'.ai','codex','generated_images','thread1','image1.png');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(imageBase64,'base64'));return[{id:'image1',type:'imageGeneration',status:'completed',result:'',savedPath:file}];}});good.login();
 assert.match((await good.client.handle('codex-pet-image',portrait)).image,/^\/api\/pet-art\//);
 assert.equal(fs.existsSync(path.join(good.dir,'.ai','codex','generated_images','thread1','image1.png')),true);
 for(const mode of ['outside','wrong-id','stale','junction','hardlink']){
  const bad=fixture(t,{images:({dir})=>{
   let file=path.join(dir,'.ai','codex','generated_images','thread1','image1.png');fs.mkdirSync(path.dirname(file),{recursive:true});
   const outside=path.join(dir,'outside');fs.mkdirSync(outside);const original=path.join(outside,'image1.png');fs.writeFileSync(original,Buffer.from(imageBase64,'base64'));
   if(mode==='outside')file=original;
   else if(mode==='wrong-id'){file=path.join(path.dirname(file),'unrelated.png');fs.writeFileSync(file,Buffer.from(imageBase64,'base64'));}
   else if(mode==='junction'){fs.rmdirSync(path.dirname(file));fs.symlinkSync(outside,path.dirname(file),process.platform==='win32'?'junction':'dir');}
   else if(mode==='hardlink')fs.linkSync(original,file);
   else {fs.writeFileSync(file,Buffer.from(imageBase64,'base64'));fs.utimesSync(file,new Date(0),new Date(0));}
   return[{id:'image1',type:'imageGeneration',status:'completed',result:'',savedPath:file}];
  }});bad.login();await assert.rejects(bad.client.handle('codex-pet-image',portrait),/invalid-image-response/,mode);
  assert.equal(fs.existsSync(path.join(bad.dir,'.pet-art')),false);
 }
});

test('native image timeout leaves no artwork job or source-photo file behind',async t=>{
 const f=fixture(t,{images:()=>[],hang:true,imageTimeout:15});f.login();
 await assert.rejects(f.client.handle('codex-pet-image',portrait),/codex-timeout/);
 assert.deepEqual(fs.readdirSync(path.join(f.dir,'.ai','artwork-room')),[]);
 assert.equal(f.processes[1].child.killed,true);assert.equal(f.processes[0].child.killed,false);
});

test('Windows artwork cleanup waits for process exit and cannot mask success or the original generation error',async t=>{
 for(const failed of [false,true]){
  let cleanup=0,f;
  f=fixture(t,{images:()=>failed?[]:[{id:'image1',type:'imageGeneration',status:'completed',result:imageBase64}],
   removeArtwork:async(folder,options)=>{
    cleanup++;assert.equal(f.processes[1].child.exitCode,0);
    assert.equal(path.dirname(folder),path.join(f.dir,'.ai','artwork-room'));
    assert.deepEqual(options,{recursive:true,force:true,maxRetries:5,retryDelay:100});
    throw Object.assign(new Error('temporary Windows directory handle'),{code:'EPERM'});
   }});f.login();
  if(failed)await assert.rejects(f.client.handle('codex-pet-image',portrait),error=>error.message==='codex-image-no-result');
  else assert.match((await f.client.handle('codex-pet-image',portrait)).image,/^\/api\/pet-art\/[a-f0-9]{32}\.png$/);
  assert.equal(cleanup,1);assert.equal(f.processes[0].child.killed,false);
 }
});

test('RPC rejects server-initiated tools, cleans up on malformed data and times out unanswered requests',async()=>{
 function child(){const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin=new PassThrough();c.kill=()=>{};return c;}
 const c=child(),r=new Rpc(c,15),replies=[];c.stdin.on('data',s=>replies.push(JSON.parse(s.toString())));
 c.stdout.write(JSON.stringify({id:90,method:'item/commandExecution/requestApproval',params:{}})+'\n');assert.equal(replies[0].error.code,-32601);
 await assert.rejects(r.request('account/read'),/codex-timeout/);r.close();
 const c2=child(),r2=new Rpc(c2,100);const pending=r2.request('account/read');c2.stdout.write('not-json\n');await assert.rejects(pending,/invalid-response/);
});
