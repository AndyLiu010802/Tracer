'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),S=require('../public/workspace-sync');
function workspace(amount=10000){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'ten_draw_credit',amount,updatedAt:1};return ws;}
function random(){let draw=0;const tickets=[0,5500,5450,8500,9700,0,5499,5500,0,0];return limit=>limit===10000?tickets[draw++%tickets.length]:0;}
const summary=r=>({id:r.rod.id,duplicate:r.duplicate,hidden:r.hidden,compensation:r.compensation,pity:r.pity});

test('ten boxes exactly match ten sequential purchases for every collection, including secrets and guarantees',()=>{
  for(const pool of F.catalog.rodPools){
    const batch=workspace();for(let i=0;i<8;i++)F.buyBox(batch,{poolId:pool.id,now:100+i,random:()=>0});
    const single=structuredClone(batch),before=F.economy(batch).balance,result=F.buyBoxes(batch,{poolId:pool.id,now:200,random:random()}),rng=random();
    const expected=Array.from({length:10},()=>F.buyBox(single,{poolId:pool.id,now:200,random:rng}));
    assert(result.ok);assert.equal(result.count,10);assert.equal(result.spent,F.boxPrice(pool.id)*10);
    assert.deepEqual(result.results.map(summary),expected.map(summary));assert.deepEqual(result.pity,F.pity(F.read(single),pool.id));
    assert.equal(result.compensation,expected.reduce((sum,r)=>sum+r.compensation,0));assert.equal(F.economy(batch).balance,before-F.boxPrice(pool.id)*10+result.compensation);
    assert.equal(F.economy(batch).balance,F.economy(single).balance);assert.deepEqual(F.read(batch).rods,F.read(single).rods);
    const added=F.read(batch).boxes.slice(-10);assert.equal(new Set(added.map(b=>b.id)).size,10);assert(added.every(b=>b.poolId===pool.id));
    assert.deepEqual(S.validate(structuredClone(batch)).fishing,batch.fishing);
  }
});

test('ten boxes require the full price up front and unknown pools never consume randomness or mutate balances',()=>{
  for(const options of [{poolId:'naruto'},{poolId:'missing'}]){
    const ws=workspace(999),before=structuredClone(ws);let calls=0;
    const result=F.buyBoxes(ws,{...options,random:()=>{calls++;return 5450;}});
    assert.equal(result.reason,options.poolId==='missing'?'unknown-pool':'insufficient-coins');assert.equal(calls,0);assert.deepEqual(ws,before);
  }
  const ws=workspace(1000),result=F.buyBoxes(ws,{poolId:'naruto',random:()=>0});assert(result.ok);assert.equal(F.read(ws).boxes.length,10);
});

test('a mid-batch random failure rolls back every receipt and the shared garden coin ledger',()=>{
  const ws=workspace(),before=structuredClone(ws);let draws=0;
  assert.throws(()=>F.buyBoxes(ws,{poolId:'onepiece',random:limit=>{if(limit===10000&&++draws===6)throw Error('random unavailable');return 0;}}),/random unavailable/);
  assert.equal(draws,6);assert.deepEqual(ws,before);
});

test('ten boxes apply the fortieth guarantee and duplicate refunds once and survive repeated stale merges',()=>{
  const ws=workspace();for(let i=0;i<39;i++)F.buyBox(ws,{poolId:'naruto',now:10+i,random:()=>0});
  const stale=structuredClone(ws),before=F.economy(ws).balance,result=F.buyBoxes(ws,{poolId:'naruto',now:100,random:()=>0});
  assert.equal(result.results[0].rod.rarity,'legendary');assert.equal(result.pity.legendary,9);assert.equal(F.pity(F.read(ws),'onepiece').epic,0);
  const balance=before-1000+result.compensation;F.preserve(ws,stale);F.preserve(ws,stale);
  assert.equal(F.read(stale).boxes.length,49);assert.equal(F.economy(stale).balance,balance);assert.deepEqual(S.validate(stale).fishing,stale.fishing);
});
