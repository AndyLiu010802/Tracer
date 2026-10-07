'use strict';
// Local developer diagnostic. Not imported by the app; no purchases or gating.
const Model=require('../lib/entitlement-state');
async function main(){
 const simulate=process.argv.includes('--simulate');let now=1000;const rows=[];
 const config={platform:'steam',productId:'synthetic-product',subject:'synthetic-principal',clock:()=>now};
 if(!simulate){const model=Model.create(config);await model.refresh();rows.push(model.inspect());console.log('Production platform verification is NOT implemented. No purchase verified; no feature gating.');}
 else{console.log('DEVELOPMENT SIMULATION ONLY — these states never prove a purchase or authorize a feature.');
  const adapter={verifyEvidence:async r=>{if(r.evidence==='offline')throw Error('offline');return {verification:'development_simulation',claims:{platform:r.platform,productId:r.productId,subject:r.subject,requestId:r.requestId,status:r.evidence==='revoke'?'revoked':'valid',issuedAt:r.now,checkedAt:r.now,expiresAt:r.evidence==='revoke'?null:2000,revision:r.evidence==='revoke'?2:1}};}};
  const model=Model.create({...config,mode:'development',adapter});rows.push(model.inspect());await model.refresh();rows.push(model.inspect());now=2000;rows.push(model.inspect());await model.refresh('offline');rows.push(model.inspect());await model.refresh('revoke');rows.push(model.inspect());
 }
 console.table(rows.map(r=>({status:r.status,source:r.source,reason:r.reason,purchaseVerified:r.currentVerified,canAuthorize:r.canAuthorize,lastKnown:r.lastKnownEvidence?.status||'none'})));
}
main().catch(()=>{console.error('Diagnostic failed. No authorization created.');process.exitCode=1;});

