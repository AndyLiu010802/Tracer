'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {promisify}=require('node:util'),scrypt=promisify(crypto.scrypt),Provider=require('./provider');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const equal=(a,b)=>{a=Buffer.from(a);b=Buffer.from(b);return a.length===b.length&&crypto.timingSafeEqual(a,b);};
async function body(req){let n=0,chunks=[];for await(const chunk of req){n+=chunk.length;if(n>900000)throw new Error('request-too-large');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('invalid-request');}}
function createService(options={}){
 const env={...(options.env||process.env)};
 for(const name of ['OPENAI_API_KEY','INVITE_CODE'])if(env[name+'_FILE'])env[name]=fs.readFileSync(env[name+'_FILE'],'utf8').trim();
 const file=options.file||path.join(env.DATA_DIR||path.join(__dirname,'data'),'accounts.json');
 let db={users:[],sessions:[]};try{db=JSON.parse(fs.readFileSync(file,'utf8'));if(!Array.isArray(db.users)||!Array.isArray(db.sessions))throw new Error();}catch(e){if(e.code!=='ENOENT')throw new Error('Account database unreadable; refusing to start');}
 const daily=Math.max(1,Math.min(100,Number(env.DAILY_PLAN_LIMIT)||10)),globalLimit=Math.max(1,Number(env.GLOBAL_DAILY_PLAN_LIMIT)||100);
 const flights=new Set(),attempts=new Map();let active=0,authActive=0;
 const now=options.now||Date.now;
 function persist(){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db),{mode:0o600});fs.renameSync(tmp,file);}
 function account(req){const token=String(req.headers.authorization||'').replace(/^Bearer /,'');const session=db.sessions.find(s=>s.token===hash(token)&&s.expires>now());const user=session&&db.users.find(u=>u.id===session.userId);if(!user)throw new Error('login-required');return user;}
 function publicUser(user){const today=new Date(now()).toISOString().slice(0,10);return {username:user.username,remaining:Math.max(0,daily-(user.day===today?user.used:0)),limit:daily,resetTimezone:'UTC'};}
 function throttle(req){const address=env.TRUST_PROXY==='1'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').pop().trim():req.socket.remoteAddress;const old=attempts.get(address)||{at:now(),count:0};if(now()-old.at>900000){old.at=now();old.count=0;}old.count++;attempts.set(address,old);if(attempts.size>10000)for(const [k,v]of attempts)if(now()-v.at>900000)attempts.delete(k);if(old.count>20)throw new Error('too-many-attempts');}
 const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const route=req.url.split('?')[0];
  try{
   if(route==='/health'&&req.method==='GET')return send(200,{ok:true,service:'tracer-ai',version:'0.3.0',configured:!!env.OPENAI_API_KEY});
   if(route==='/v1/me'&&req.method==='GET')return send(200,{user:publicUser(account(req))});
   if(req.method!=='POST'||!String(req.headers['content-type']).startsWith('application/json'))return send(404,{error:'not-found'});
   if(route==='/v1/login'||route==='/v1/register'){
    throttle(req);if(authActive>=4)throw new Error('service-busy');authActive++;
    try{
     const data=await body(req),username=String(data.username||'').trim().toLowerCase(),password=data.password;
     if(!/^[a-z0-9_\-]{3,40}$/.test(username)||typeof password!=='string'||password.length<12||password.length>128)throw new Error('invalid-credentials-format');
     let user=db.users.find(u=>u.username===username);
     if(route==='/v1/register'){
      if(!env.INVITE_CODE||!equal(hash(String(data.invite||'')),hash(env.INVITE_CODE)))throw new Error('invalid-invite');
      if(user)throw new Error('username-unavailable');if(db.users.length>=Number(env.MAX_USERS||1000))throw new Error('registration-closed');
      const salt=crypto.randomBytes(16).toString('hex'),digest=(await scrypt(password,salt,64)).toString('hex');
      if(db.users.some(u=>u.username===username))throw new Error('username-unavailable');
      user={id:crypto.randomUUID(),username,salt,digest,day:'',used:0};db.users.push(user);
     }else{
      const digest=(await scrypt(password,user?user.salt:'unknown-account-salt',64)).toString('hex');if(!user||!equal(digest,user.digest))throw new Error('invalid-login');
     }
     const token=crypto.randomBytes(32).toString('base64url');db.sessions=db.sessions.filter(s=>s.expires>now());const own=db.sessions.filter(s=>s.userId===user.id);if(own.length>=5)db.sessions=db.sessions.filter(s=>s!==own[0]);db.sessions.push({token:hash(token),userId:user.id,expires:now()+30*86400000});persist();return send(200,{token,user:publicUser(user)});
    }finally{authActive--;}
   }
   const user=account(req);
   if(route==='/v1/logout'){const token=hash(String(req.headers.authorization||'').replace(/^Bearer /,''));db.sessions=db.sessions.filter(s=>s.token!==token);persist();return send(200,{ok:true});}
   if(route!=='/v1/plan')return send(404,{error:'not-found'});
   if(flights.has(user.id)||active>=4)throw new Error('service-busy');
   if(!env.OPENAI_API_KEY&&!options.generate)throw new Error('ai-not-configured');
   const data=Provider.input(await body(req)),today=new Date(now()).toISOString().slice(0,10);
   // Recheck after asynchronous body reading; reserve quota before the provider call.
   if(flights.has(user.id)||active>=4)throw new Error('service-busy');
   if(user.day!==today){user.day=today;user.used=0;}if(user.used>=daily||db.users.reduce((n,u)=>n+(u.day===today?u.used:0),0)>=globalLimit)throw new Error('quota-exceeded');
   user.used++;persist();flights.add(user.id);active++;
   try{const plan=await (options.generate||Provider.generate)(data,{apiKey:env.OPENAI_API_KEY,baseURL:env.OPENAI_BASE_URL||undefined,model:env.OPENAI_MODEL||undefined});return send(200,{plan,user:publicUser(user)});}finally{flights.delete(user.id);active--;}
  }catch(e){const code=e.message;const known=/^(login-required|invalid-login|invalid-invite|invalid-credentials-format|username-unavailable|registration-closed|too-many-attempts|service-busy|quota-exceeded|ai-not-configured|provider-busy|provider-unavailable|incomplete-plan|plan-refused|invalid-plan|invalid-dependencies|invalid-goal|invalid-dates|invalid-days|invalid-hours|invalid-documents|documents-too-large|too-many-context-tasks|request-too-large|invalid-request)$/.test(code);send(code==='login-required'||code==='invalid-login'?401:/quota|busy|attempts/.test(code)?429:code==='ai-not-configured'?503:known?400:503,{error:known?code:'service-unavailable'});}
 });
 server.requestTimeout=150000;server.headersTimeout=10000;return server;
}
if(require.main===module){const server=createService();server.listen(Number(process.env.PORT)||8787,process.env.HOST||'127.0.0.1',()=>console.log('Tracer AI service listening'));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));}
module.exports={createService};
