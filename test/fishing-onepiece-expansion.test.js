'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),Sync=require('../public/workspace-sync');
const A=require('../skins/tracer/fishing-anime-effects'),E=require('../skins/tracer/fishing-rod-effects');
const expansion=require('../dev/fishing-onepiece-expansion.cjs'),fixture=require('./fixtures/fishing-onepiece-v1-boxes.json');
const clone=x=>structuredClone(x);
function workspace(legacy=false){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'op_revision_test',amount:fixture.credit,updatedAt:1};if(legacy){ws.fishing=clone(fixture.fishing);ws.taskGarden.market.fishingTransactions=clone(fixture.fishing.transactions);}return ws;}
function draw(ws,ticket,index=0,now=5000){return F.buyBox(ws,{poolId:'onepiece',now,random:limit=>limit===10000?ticket:index});}

test('One Piece adds exactly eight lower-tier and seven advanced rods, with every Warlord at epic or above',()=>{
  const rods=F.catalog.rods.filter(r=>r.collection==='onepiece');assert.equal(rods.length,45);
  assert.deepEqual(['common','rare','epic','legendary','hidden'].map(t=>rods.filter(r=>t==='hidden'?r.hidden:!r.hidden&&r.rarity===t).length),[9,11,17,7,1]);
  assert.deepEqual(['common','rare','epic','legendary'].map(t=>expansion.rods.filter(r=>r.rarity===t).length),[4,4,4,3]);
  for(const key of expansion.warlords){const r=rods.find(r=>r.id==='anime_'+key);assert(r,key);assert(['epic','legendary'].includes(r.rarity),key);assert(A.detailedBobber(r.id));}
  assert.equal(new Set(expansion.rods.map(r=>r.id)).size,15);assert.equal(F.catalog.rods.filter(r=>r.collection==='naruto').length,45);
});

test('120 authentic pre-upgrade box records retain exact bytes, balance, ownership and pity',()=>{
  const ws=workspace(true),saved=clone(ws.fishing);assert.equal(JSON.stringify(F.validate(saved)),JSON.stringify(saved));
  assert.equal(F.economy(ws).balance,fixture.balance);for(const [key,value] of Object.entries(fixture.pity))assert.equal(F.pity(F.read(ws),'onepiece')[key],value);assert.equal(F.pity(F.read(ws),'onepiece').hidden,0);
  for(const key of Object.keys(expansion.upgrades)){assert(F.read(ws).rods.includes('anime_'+key));assert.equal(F.catalog.rods.find(r=>r.id==='anime_'+key).rarity,'epic');}
  const restored=Sync.validate(clone(ws));assert.deepEqual(restored.fishing,saved);assert.equal(F.economy(restored).balance,fixture.balance);
  assert.deepEqual(F.merge(saved,saved,saved),saved);
});

test('current boxes award promoted characters only at epic tier and pay current duplicate value',()=>{
  const ws=workspace(true),before=clone(ws.fishing),originalPity=F.pity(before,'onepiece');let now=5000;
  // Collect the expanded epic roster, which includes all five promoted originals.
  const epics=F.catalog.rods.filter(r=>r.collection==='onepiece'&&r.rarity==='epic');
  for(let n=0;n<epics.length;n++)assert(draw(ws,8500,0,now++).ok);
  const result=draw(ws,8500,epics.findIndex(r=>r.id==='anime_buggy'),now++);assert.equal(result.rod.id,'anime_buggy');assert(result.duplicate);assert.equal(result.compensation,75);
  assert(ws.fishing.boxes.slice(before.boxes.length).every(b=>b.catalogRevision===2));
  assert(ws.fishing.transactions.filter(t=>t.kind==='duplicate'&&t.createdAt>=5000).every(t=>t.catalogRevision===2&&t.amount===75));
  assert.deepEqual(ws.fishing.boxes.slice(0,before.boxes.length),before.boxes);assert(originalPity.legendary>0);
  const restored=Sync.validate(clone(ws));assert.deepEqual(restored.fishing,ws.fishing);
  const merged=F.merge(before,ws.fishing,before);assert.deepEqual(merged,ws.fishing);
  const fresh=workspace();for(let n=0;n<9;n++){const r=draw(fresh,0,0,now++);assert.equal(r.rod.rarity,'common');assert(!expansion.warlords.includes(r.rod.id.replace('anime_','')));}
});

test('mixed revision saves reject forged historical rewards or mismatched duplicate compensation',()=>{
  const ws=workspace();for(let n=0;n<17;n++)draw(ws,8500,0,6000+n);
  const good=clone(ws.fishing),newBox=good.boxes.find(b=>expansion.rods.some(r=>r.id===b.rodId));assert(newBox);
  const invalid=clone(good);delete invalid.boxes.find(b=>b.id===newBox.id).catalogRevision;assert.throws(()=>F.validate(invalid));
  const old=clone(fixture.fishing),oldPromoted=old.boxes.find(b=>Object.hasOwn(expansion.upgrades,b.rodId.replace('anime_','')));oldPromoted.catalogRevision=2;assert.throws(()=>F.validate(old));
  const other=clone(good);other.boxes[0].catalogRevision=3;assert.throws(()=>F.validate(other));
  const dupeWs=workspace();for(let n=0;n<19;n++)draw(dupeWs,8500,0,7000+n);
  const bad=clone(dupeWs.fishing),t=bad.transactions.find(t=>t.kind==='duplicate');assert(t);delete t.catalogRevision;assert.throws(()=>F.validate(bad));
  assert.throws(()=>F.validateTransactions([{id:'bad_version',kind:'bait',itemId:'worm',quantity:1,amount:-10,createdAt:1,catalogRevision:2}]));
});

test('all 45 One Piece techniques draw finite short attacks and stay completely quiet while playing',()=>{
  const rods=F.catalog.rods.filter(r=>r.collection==='onepiece');
  const quiet=new Proxy({},{get(){throw Error('Quiet frame attempted canvas access');}});
  for(const r of rods){for(const phase of ['waiting','reeling','idle','charging','escaped'])assert.equal(A.draw(quiet,r.id,phase,140),null);for(const phase of Object.keys(A.cleanDurations))assert.equal(A.draw(quiet,r.id,phase,A.duration(r.id,phase)),null);assert.equal(E.summonState(r,700),null);}
  let calls=0;const stack=[],ctx=new Proxy({globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();}},{get(o,k){if(k in o)return o[k];return(...args)=>{for(const x of args)if(typeof x==='number')assert(Number.isFinite(x),String(k));calls++;};}});
  const g={width:400,height:280,water:{x:300,y:190}},tip={x:100,y:40};
  for(const r of rods)for(const phase of ['cast','bite','caught'])for(const reduced of [false,true])for(const p of [.12,.3,.52,.8]){const result=A.draw(ctx,r.id,phase,A.duration(r.id,phase)*p,{},g,tip,g.water,reduced);assert(result,r.id);assert(Number.isFinite(result.alpha));assert.deepEqual(result.impactPoint,g.water);}
  assert.equal(stack.length,0);assert(calls>10000);
});
