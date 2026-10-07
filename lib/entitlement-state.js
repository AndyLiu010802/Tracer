'use strict';
const {randomUUID}=require('node:crypto');
const SOURCES=Object.freeze(['unverified','development_simulation','platform_verified']);
const STATUSES=Object.freeze(['unknown','valid','expired','revoked','verification_failed']);
const PLATFORMS=Object.freeze(['steam','microsoft_store']);
const fail=code=>Object.assign(new Error(code),{code});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const text=value=>typeof value==='string'&&value.length>0&&value.length<=160&&!/[\x00-\x1f]/.test(value);
const time=value=>Number.isSafeInteger(value)&&value>=0;
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

/** Diagnostic state only: no current build can grant production access.
 * verifyEvidence(request) is a privileged adapter boundary, NOT JSON proof.
 * Future native store/signature verification is not implemented here.
 * development/test adapters must return {verification:'development_simulation',
 * claims:{platform,productId,subject,requestId,status,issuedAt,checkedAt,
 * expiresAt,revision}}. All times are epoch milliseconds. checkedAt is the
 * local verification request time; a future adapter must normalize verified
 * store results, bind the request and authenticate the purchaser/product.
 * No raw proof/principal is persisted or emitted. Snapshots cannot be imported.
 */
function create({platform,productId,subject='',mode='production',adapter=null,clock=Date.now}={}){
 if(!PLATFORMS.includes(platform)||!text(productId)||typeof subject!=='string'||(subject!==''&&!text(subject))||!['production','development','test'].includes(mode)||typeof clock!=='function')throw fail('entitlement-invalid-config');
 if(mode==='production'&&adapter!==null)throw fail('entitlement-platform-integration-unavailable');
 if(adapter!==null&&(!record(adapter)||typeof adapter.verifyEvidence!=='function'))throw fail('entitlement-invalid-adapter');
 let generation=0,disposed=false,pending=false,revision=-1,accepted=null,acceptedClaims=null;
 let state={status:'unknown',source:'unverified',reason:'integration_unavailable',issuedAt:null,checkedAt:null,expiresAt:null,revision:null};
 function now(){let value;try{value=clock();}catch{throw fail('entitlement-invalid-clock');}if(!time(value))throw fail('entitlement-invalid-clock');return value;}
 function inspect(){let viewed={...state};try{if(viewed.status==='valid'&&viewed.expiresAt<=now())viewed={...viewed,status:'expired',reason:'expired'};}catch{viewed={...viewed,status:'verification_failed',reason:'clock_invalid'};}
  return freeze({...viewed,platform,productId,mode,scopeConfigured:subject!=='',pending,disposed,currentVerified:false,canAuthorize:false,platformIntegrationAvailable:false,lastKnownEvidence:accepted?{...accepted}:null});
 }
 function reset(reason){generation++;pending=false;revision=-1;accepted=null;acceptedClaims=null;state={status:'unknown',source:'unverified',reason,issuedAt:null,checkedAt:null,expiresAt:null,revision:null};return inspect();}
 function claims(response,request){
  if(!record(response)||Object.keys(response).sort().join(',')!=='claims,verification'||response.verification!=='development_simulation'||!record(response.claims))throw fail('response_invalid');
  const c=response.claims,keys='checkedAt,expiresAt,issuedAt,platform,productId,requestId,revision,status,subject';
  if(Object.keys(c).sort().join(',')!==keys||!['unknown','valid','expired','revoked'].includes(c.status))throw fail('response_invalid');
  if(c.platform!==platform||c.productId!==productId||c.subject!==subject)throw fail('scope_mismatch');
  if(c.requestId!==request.requestId)throw fail('request_mismatch');
  if(!time(c.issuedAt)||!time(c.checkedAt)||c.checkedAt!==request.now||c.issuedAt>c.checkedAt||!Number.isSafeInteger(c.revision)||c.revision<0||(c.expiresAt!==null&&!time(c.expiresAt)))throw fail('response_invalid');
  if(['valid','expired'].includes(c.status)&&(c.expiresAt===null||c.expiresAt<c.checkedAt&&c.status==='valid'))throw fail('response_invalid');
  const result={status:c.status,source:'development_simulation',reason:c.status,issuedAt:c.issuedAt,checkedAt:c.checkedAt,expiresAt:c.expiresAt,revision:c.revision};
  if(result.status==='valid'&&result.expiresAt<=now())result.status=result.reason='expired';
  if(result.status==='expired'&&result.expiresAt>now())throw fail('response_invalid');
  if(c.revision<revision)throw fail('stale_revision');
  // Same-version status/time conflicts cannot replace previously accepted data.
  const elapsed=acceptedClaims?.status==='valid'&&c.status==='expired'&&c.expiresAt<=now();
  if(c.revision===revision&&acceptedClaims&&(['issuedAt','expiresAt'].some(key=>c[key]!==acceptedClaims[key])||c.status!==acceptedClaims.status&&!elapsed))throw fail('revision_conflict');
  acceptedClaims={status:c.status,issuedAt:c.issuedAt,expiresAt:c.expiresAt};
  return result;
 }
 async function refresh(evidence=''){
  if(disposed)throw fail('entitlement-disposed');const token=++generation;pending=false;
  if(mode==='production'||!adapter){state={...state,status:'unknown',source:'unverified',reason:'integration_unavailable'};return freeze({applied:true,state:inspect()});}
  if(!subject||typeof evidence!=='string'||Buffer.byteLength(evidence,'utf8')>64*1024){state={...state,status:'verification_failed',reason:'request_invalid'};return freeze({applied:true,state:inspect()});}
  pending=true;const request={platform,productId,subject,requestId:randomUUID(),now:0,evidence};
  try{request.now=now();const response=await adapter.verifyEvidence(freeze(request));if(disposed||token!==generation)return freeze({applied:false,state:inspect()});
   state=claims(response,request);revision=state.revision;accepted={...state};
  }catch(error){if(disposed||token!==generation)return freeze({applied:false,state:inspect()});let code='';try{const descriptor=error&&Object.getOwnPropertyDescriptor(error,'code');if(typeof descriptor?.value==='string')code=descriptor.value;}catch{}const allowed=['response_invalid','scope_mismatch','request_mismatch','stale_revision','revision_conflict'];state={...state,status:'verification_failed',reason:allowed.includes(code)?code:code==='entitlement-invalid-clock'?'clock_invalid':'verification_unavailable'};
  }finally{if(token===generation)pending=false;}
  return freeze({applied:true,state:inspect()});
 }
 return Object.freeze({inspect,refresh,setSubject(value){if(typeof value!=='string'||(value!==''&&!text(value)))throw fail('entitlement-invalid-subject');if(value!==subject){subject=value;return reset('scope_changed');}return inspect();},clear:()=>reset('cleared'),cancel(){generation++;pending=false;return inspect();},dispose(){disposed=true;return reset('disposed');}});
}
module.exports=Object.freeze({create,SOURCES,STATUSES,PLATFORMS});


