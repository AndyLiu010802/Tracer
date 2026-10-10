'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const F=require('../public/fishing-model'),G=require('../public/task-garden'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync'),Skins=require('../skins/tracer/fishing-pond-skins');
const clone=x=>structuredClone(x);
function workspace(credit=50000){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'skin_test',amount:credit,updatedAt:1};return ws;}

test('all ten themes ship editable Blender sources, matching GLB and bounded game meshes',()=>{
  for(const skin of Skins.catalog){
    const source='art-source/fishing-pond-skins/'+skin.id;
    assert.equal(fs.readFileSync(source+'.blend').toString('ascii',0,7),'BLENDER');
    assert.equal(fs.readFileSync(source+'.glb').toString('ascii',0,4),'glTF');
    const meta=JSON.parse(fs.readFileSync('skins/tracer/fishing-art/pond-skin-'+skin.id+'-scene-v1.json'));
    const bytes=fs.readFileSync('skins/tracer'+meta.binary);
    assert.match(meta.authoring,/^Blender /);assert(meta.parts.length<=24);assert(meta.triangles<55000);assert(bytes.length<4000000);
    let length=0,count=0;
    for(const part of meta.parts){
      assert.equal(part.offset,length);assert.equal(part.count%3,0);length+=part.count*24;count+=part.count/3;
      const p=new Float32Array(bytes.buffer,bytes.byteOffset+part.offset,part.count*3),n=new Float32Array(bytes.buffer,bytes.byteOffset+part.offset+part.count*12,part.count*3);
      for(let i=0;i<p.length;i+=3){assert(p.subarray(i,i+3).every(Number.isFinite));assert(Math.abs(Math.hypot(n[i],n[i+1],n[i+2])-1)<.001);}
      for(let i=0;i<p.length;i+=9){const ax=p[i+3]-p[i],ay=p[i+4]-p[i+1],az=p[i+5]-p[i+2],bx=p[i+6]-p[i],by=p[i+7]-p[i+1],bz=p[i+8]-p[i+2];const facing=(ay*bz-az*by)*(n[i]+n[i+3]+n[i+6])+(az*bx-ax*bz)*(n[i+1]+n[i+4]+n[i+7])+(ax*by-ay*bx)*(n[i+2]+n[i+5]+n[i+8]);assert(facing>=-1e-7,skin.id+' face winding matches normals');}
    }
    assert.equal(length,bytes.length);assert.equal(count,meta.triangles);
    for(const asset of [skin.bank,skin.box,skin.preview])assert(fs.statSync('skins/tracer'+asset).size>1000);
  }
});
test('ten paired skins share the same client and authoritative catalog; old saves stay unchanged',()=>{
  assert.equal(F.catalog.pondSkins.length,10);assert.deepEqual(F.catalog.pondSkins,Skins.catalog);assert.equal(new Set(Skins.catalog.map(s=>s.id)).size,10);
  assert.equal(fs.readFileSync('public/fishing-model.js','utf8'),fs.readFileSync('skins/tracer/fishing-model.js','utf8'));
  const old=F.empty();assert.deepEqual(F.validate(old),old);assert.equal(Object.hasOwn(F.validate(old),'pondAppearance'),false);
});
test('one purchase permanently owns both skins and deducts once from both ledgers',()=>{
  const ws=workspace(),balance=F.economy(ws).balance,original=clone(ws.fishing),skin=Skins.catalog[0];
  assert.deepEqual(F.buyPondSkin(ws,skin.id,20),{ok:true,changed:true,spent:skin.price,itemId:skin.id});
  assert.equal(F.economy(ws).balance,balance-skin.price);assert.equal(G.economy(ws).balance,balance-skin.price);
  const bought=clone(ws);assert.equal(F.buyPondSkin(ws,skin.id,21).changed,false);assert.deepEqual(ws,bought);
  for(const key of ['ponds','fry','casts','catches','boxes','equippedBaitId','equippedRodId'])assert.deepEqual(ws.fishing[key],original[key]);
  assert.equal(ws.fishing.pondAppearance,undefined,'buying does not silently equip');assert.deepEqual(S.validate(clone(ws)).fishing,ws.fishing);
});
test('insufficient coins and unowned/invalid selections cannot mutate the account',()=>{
  const ws=workspace(100),before=clone(ws);
  assert.equal(F.buyPondSkin(ws,'konoha',30).reason,'insufficient-coins');
  assert.equal(F.buyPondSkin(ws,'unknown',30).reason,'unknown-pond-skin');
  assert.equal(F.equipPondSkin(ws,'konoha',30).reason,'not-owned');assert.equal(F.equipPondSkin(ws,'unknown',30).reason,'not-owned');assert.deepEqual(ws,before);
});
test('equip and restore persist independently of a newer unrelated stale write',()=>{
  const ws=workspace();F.buyPondSkin(ws,'sunny',40);const stale=clone(ws);F.equipPondSkin(ws,'sunny',41);F.equipBait(stale,'worm',80);F.preserve(ws,stale);assert.equal(stale.fishing.pondAppearance.skinId,'sunny');
  const equipped=clone(stale),balance=F.economy(stale).balance;F.equipPondSkin(stale,null,81);F.equipBait(equipped,'worm',100);F.preserve(stale,equipped);assert.equal(equipped.fishing.pondAppearance.skinId,null);assert.equal(F.economy(equipped).balance,balance);
});
test('two offline purchases of the same theme merge into one debit in either order',()=>{
  const base=workspace(),a=clone(base),b=clone(base);F.buyPondSkin(a,'valorant',50);F.buyPondSkin(b,'valorant',60);F.equipPondSkin(b,'valorant',61);
  for(const state of [F.merge(base.fishing,a.fishing,b.fishing),F.merge(base.fishing,b.fishing,a.fishing)]){assert.equal(state.transactions.filter(t=>t.kind==='pond_skin').length,1);assert.equal(state.pondAppearance.skinId,'valorant');assert.equal(F.moneySummary(state.transactions).spent,3000);}
});
test('forged ownership, future equip clocks and wrong prices are rejected',()=>{
  const ws=workspace();F.buyPondSkin(ws,'onsen',70);F.equipPondSkin(ws,'onsen',71);
  for(const mutate of [s=>s.pondAppearance.skinId='konoha',s=>s.pondAppearance.updatedAt=s.updatedAt+1,s=>s.transactions[0].amount=-1,s=>s.transactions[0].id='random',s=>s.transactions.push({...s.transactions[0]}),s=>s.pondAppearance.price=0]){const raw=clone(ws.fishing);mutate(raw);assert.throws(()=>F.validate(raw));}
});
test('every skin leaves every ground pool and deterministic catch mechanics intact',()=>{
  const ws=workspace();for(const skin of Skins.catalog)F.buyPondSkin(ws,skin.id,100);
  const sample=()=>{const s=F.read(ws);return [0,71,981,6500].map(seed=>{const v=F.createSession(s,{seed,now:1000});const {id,...rest}=v;return rest;});};
  for(const spot of F.catalog.spots){F.setExpedition(ws,{spotId:spot.id},200);F.equipPondSkin(ws,null,201);const ground=F.expedition(ws,{timeId:'day',weatherId:'clear'}),baseline=sample();for(const skin of Skins.catalog){F.equipPondSkin(ws,skin.id,202);assert.deepEqual(F.expedition(ws,{timeId:'day',weatherId:'clear'}),ground,skin.id+' '+spot.id);assert.deepEqual(sample(),baseline,skin.id+' does not affect catches');}}
});
test('mystery explanation is hidden while bundle opening and motor odds are retained',()=>{
  const source=fs.readFileSync('skins/tracer/fishing-view.js','utf8');assert.ok(!source.includes('Sealed treasures occasionally caught while fishing.'));assert.ok(source.includes("button('open-bundle'"));assert.ok(source.includes('Ultra-rare equipment · 0.001%'));
});
