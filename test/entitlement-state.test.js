'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Model=require('../lib/entitlement-state');
const config={platform:'steam',productId:'synthetic-product',subject:'synthetic-principal'};
function fixture(verify){let current=1000;const adapter={verifyEvidence:async r=>verify?verify(r):reply(r)};return {model:Model.create({...config,mode:'test',adapter,clock:()=>current}),time:v=>{current=v;}};}
function reply(r,status='valid',revision=1,changes={}){return {verification:'development_simulation',claims:{platform:r.platform,productId:r.productId,subject:r.subject,requestId:r.requestId,status,issuedAt:r.now,checkedAt:r.now,expiresAt:status==='revoked'||status==='unknown'?null:2000,revision,...changes}};}
test('production cannot authorize injected adapters, local flags, caches or backup data',async()=>{
 assert.throws(()=>Model.create({...config,adapter:{verifyEvidence:async r=>reply(r)}}),{code:'entitlement-platform-integration-unavailable'});
 const m=Model.create({...config,verified:true,cache:{status:'valid',source:'platform_verified'}});const r=await m.refresh('{"verified":true}');assert.equal(r.state.status,'unknown');assert.equal(r.state.source,'unverified');assert.equal(r.state.reason,'integration_unavailable');assert.equal(r.state.canAuthorize,false);assert.equal(r.state.currentVerified,false);assert.equal(r.state.lastKnownEvidence,null);assert.equal(typeof m.import,'undefined');
});
test('simulations stay clearly simulated and expiration equality is expired',async()=>{
 const f=fixture();assert.equal((await f.model.refresh()).state.status,'valid');f.time(2000);assert.equal(f.model.inspect().status,'expired');assert.equal(f.model.inspect().source,'development_simulation');assert.equal(f.model.inspect().canAuthorize,false);
});
for(const [name,mutate,reason] of [
 ['wrong platform',r=>reply(r,'valid',1,{platform:'microsoft_store'}),'scope_mismatch'],['wrong product',r=>reply(r,'valid',1,{productId:'other'}),'scope_mismatch'],['wrong principal',r=>reply(r,'valid',1,{subject:'other'}),'scope_mismatch'],['wrong request',r=>reply(r,'valid',1,{requestId:'old'}),'request_mismatch'],['future issue time',r=>reply(r,'valid',1,{issuedAt:1001}),'response_invalid'],['wrong checked time',r=>reply(r,'valid',1,{checkedAt:999}),'response_invalid'],['invalid expiry',r=>reply(r,'valid',1,{expiresAt:null}),'response_invalid'],['invalid revision',r=>reply(r,'valid',-1),'response_invalid'],['unknown claims',r=>reply(r,'valid',1,{verified:true}),'response_invalid'],['fake real source',r=>({...reply(r),verification:'platform_verified'}),'response_invalid'],['untrusted array',()=>[],'response_invalid']
])test('reject '+name,async()=>{const f=fixture(mutate);const r=await f.model.refresh();assert.equal(r.state.status,'verification_failed');assert.equal(r.state.reason,reason);assert.equal(r.state.currentVerified,false);});
test('delayed valid response never overwrites a newer revocation',async()=>{
 let release;const f=fixture(r=>r.evidence==='old'?new Promise(resolve=>{release=()=>resolve(reply(r));}):reply(r,'revoked',2));const old=f.model.refresh('old');const newer=await f.model.refresh('new');assert.equal(newer.state.status,'revoked');release();assert.equal((await old).applied,false);assert.equal(f.model.inspect().status,'revoked');
});
test('old revisions and same-version conflicts do not erase last evidence',async()=>{
 const f=fixture(r=>r.evidence==='revoke'?reply(r,'revoked',3):r.evidence==='conflict'?reply(r,'valid',3):reply(r,'valid',2));await f.model.refresh('revoke');for(const [input,reason] of [['old','stale_revision'],['conflict','revision_conflict']]){const r=await f.model.refresh(input);assert.equal(r.state.reason,reason);assert.equal(r.state.lastKnownEvidence.status,'revoked');assert.equal(r.state.currentVerified,false);}
});
test('offline failure retains diagnostic history, hides private adapter errors and grants nothing',async()=>{
 const f=fixture(r=>{if(r.evidence==='offline')throw Error('secret receipt and identity');return reply(r);});await f.model.refresh();const r=await f.model.refresh('offline');assert.equal(r.state.status,'verification_failed');assert.equal(r.state.reason,'verification_unavailable');assert.equal(r.state.lastKnownEvidence.status,'valid');const printed=JSON.stringify(r);for(const privateValue of ['secret','synthetic-principal','requestId','evidence'])assert(!printed.includes(privateValue));assert.equal(r.state.canAuthorize,false);
});
test('account changes and cancellation invalidate asynchronous results',async()=>{
 let release;const f=fixture(r=>new Promise(resolve=>{release=()=>resolve(reply(r));}));let p=f.model.refresh();f.model.setSubject('different-principal');release();assert.equal((await p).applied,false);assert.equal(f.model.inspect().lastKnownEvidence,null);p=f.model.refresh();f.model.cancel();release();assert.equal((await p).applied,false);
});
test('response mutation, snapshots and model reconstruction cannot alter authorization state',async()=>{
 let result;const f=fixture(r=>(result=reply(r)));await f.model.refresh();result.claims.status='revoked';const snapshot=f.model.inspect();assert.throws(()=>{snapshot.lastKnownEvidence.status='revoked';},TypeError);assert.equal(f.model.inspect().status,'valid');const reconstructed=Model.create({...config,cache:snapshot});assert.equal(reconstructed.inspect().status,'unknown');assert.equal(reconstructed.inspect().canAuthorize,false);
});
test('invalid clocks, oversized evidence and disposal fail safely',async()=>{
 const f=fixture();f.time(NaN);assert.equal((await f.model.refresh()).state.reason,'clock_invalid');const g=fixture();assert.equal((await g.model.refresh('x'.repeat(65537))).state.reason,'request_invalid');g.model.dispose();await assert.rejects(g.model.refresh(),{code:'entitlement-disposed'});
});

test('elapsed expiration does not turn same-version evidence into a revision conflict',async()=>{
 const f=fixture(r=>reply(r,'valid',1,{issuedAt:1000}));await f.model.refresh();f.time(2000);const result=await f.model.refresh();assert.equal(result.state.status,'expired');assert.equal(result.state.reason,'expired');assert.equal(result.state.revision,1);assert.equal(result.state.canAuthorize,false);
});

for(const value of [null,undefined,{get code(){throw Error('private');}}])test('nonstandard adapter exception still returns a safe failure',async()=>{
 const f=fixture(()=>{throw value;});const result=await f.model.refresh();assert.equal(result.state.status,'verification_failed');assert.equal(result.state.reason,'verification_unavailable');assert.equal(result.state.canAuthorize,false);
});
test('an adapter can normalize an elapsed grant to expired without increasing its revision',async()=>{
 const f=fixture(r=>reply(r,r.now>=2000?'expired':'valid',1,{issuedAt:1000}));await f.model.refresh();f.time(2001);const result=await f.model.refresh();assert.equal(result.state.status,'expired');assert.equal(result.state.reason,'expired');assert.equal(result.state.revision,1);
});
test('throwing clocks are reported safely without revealing their errors',async()=>{
 const m=Model.create({...config,mode:'test',adapter:{verifyEvidence:async r=>reply(r)},clock:()=>{throw null;}});assert.equal((await m.refresh()).state.reason,'clock_invalid');
});

test('backup preferences cannot carry entitlement markers and both stores default to unverified',async()=>{
 const Preferences=require('../public/backup-preferences');assert.deepEqual(Preferences.clean({'tracer.entitlement.v1':JSON.stringify({source:'platform_verified',status:'valid',verified:true})}),{});
 for(const platform of Model.PLATFORMS){const model=Model.create({...config,platform});assert.equal((await model.refresh('local paid marker')).state.source,'unverified');assert.equal(model.inspect().canAuthorize,false);}
});
