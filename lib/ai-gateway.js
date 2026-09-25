'use strict';
const fs=require('node:fs'),path=require('node:path');
let secure=null;
const codexInstances=new Set();
function closeCodex(){for(const instance of codexInstances)instance.close();codexInstances.clear();}
function setSecureStorage(adapter){secure=adapter;}
function endpoint(value){let u;try{u=new URL(value);}catch{throw new Error('invalid-service-url');}if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw new Error('invalid-service-url');return u.origin;}
function createGateway(dir,{request=fetch}={}){
 const personal=require('./ai-personal').createPersonal(dir,{request,getSecureStorage:()=>secure});
 let codex=null;
 const file=path.join(dir,'.ai','connection.json');let connection=null,token='',loaded=false,busy=false;
 function read(){if(loaded)return;loaded=true;try{connection=JSON.parse(fs.readFileSync(file,'utf8'));connection.url=endpoint(connection.url);if(connection.encrypted&&secure&&secure.isEncryptionAvailable())token=secure.decryptString(Buffer.from(connection.encrypted,'base64'));}catch{connection=null;token='';}if(!connection&&process.env.TRACER_AI_SERVICE_URL)try{connection={url:endpoint(process.env.TRACER_AI_SERVICE_URL)};}catch{}}
 function save(){fs.mkdirSync(path.dirname(file),{recursive:true});const data={url:connection.url};if(token&&secure&&secure.isEncryptionAvailable())data.encrypted=secure.encryptString(token).toString('base64');fs.writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(file+'.tmp',file);}
 async function remote(route,data){read();if(!connection)throw new Error('service-not-configured');let r;try{r=await request(connection.url+'/v1/'+route,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data===undefined?undefined:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(140000)});}catch{throw new Error('service-unreachable');}const txt=await r.text();if(txt.length>1000000)throw new Error('invalid-response');let result;try{result=JSON.parse(txt);}catch{throw new Error('invalid-response');}if(!r.ok){if(r.status===401&&route!=='login'){token='';save();}throw new Error(result.error||'service-unreachable');}return result;}
 return {async close(){if(codex){await codex.close();codexInstances.delete(codex);codex=null;}connection=null;token='';loaded=false;},async handle(action,data){if(action.startsWith('codex-')){if(!codex){codex=require('./ai-codex').createCodex(dir);codexInstances.add(codex);}return codex.handle(action,data);}if(action.startsWith('personal-'))return personal.handle(action,data);read();if(action==='status'){let user=null,error=null;if(token)try{user=(await remote('me')).user;}catch(e){error=e.message;}return {url:connection?connection.url:'',user,error,persistentLogin:!!(secure&&secure.isEncryptionAvailable())};}
  if(action==='plan')return remote('plan',data);
  if(busy)throw new Error('service-busy');busy=true;
  try{if(action==='configure'){const url=endpoint(data.url);connection={url};token='';save();return {ok:true};}
   if(action==='login'||action==='register'){const r=await remote(action,data);if(typeof r.token!=='string'||r.token.length>256)throw new Error('invalid-response');token=r.token;save();return {user:r.user};}
   if(action==='logout'){try{if(token)await remote('logout',{});}finally{token='';if(connection)save();}return {ok:true};}throw new Error('not-found');
  }finally{busy=false;}
 }};
}
module.exports={createGateway,setSecureStorage,endpoint,closeCodex};
