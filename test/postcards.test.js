'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../public/task-garden');
const clone=x=>JSON.parse(JSON.stringify(x));
function wallet(amount){const taskGarden=G.empty();taskGarden.market.testCredit={id:'postcard-test',amount,updatedAt:100};return{taskGarden};}
test('postcard purchases share the wallet, persist once, and keep free stationery available',()=>{
  const ws=wallet(100);assert.equal(G.postcards({}).items.filter(i=>i.owned).length,1);
  assert.equal(G.buyPostcard(ws,'pc_night',200).reason,'insufficient-coins');
  assert.equal(G.buyPostcard(ws,'missing',200).reason,'unknown-postcard');
  assert.equal(G.buyPostcard(ws,'pc_forest',200).spent,60);assert.equal(G.economy(ws).balance,40);
  assert.equal(G.buyPostcard(ws,'pc_forest',201).spent,0);assert.equal(G.buyPostcard(ws,'pc_field',201).spent,0);
  const reloaded={taskGarden:G.validate(clone(ws.taskGarden))};assert.equal(G.economy(reloaded).balance,40);assert.ok(G.postcards(reloaded).items.find(i=>i.id==='pc_forest').owned);
  assert.equal(G.buySticker(ws,'st_whale',202).reason,'insufficient-coins');
});
test('postcard ledger rejects invalid IDs, dates, duplicate receipts and negative balances',()=>{
  for(const purchases of [[{itemId:'bad',purchasedAt:200}],[{itemId:'pc_field',purchasedAt:200}],[{itemId:'pc_forest',purchasedAt:0}],[{itemId:'pc_forest',purchasedAt:200},{itemId:'pc_forest',purchasedAt:201}]]){const ws=wallet(200);ws.taskGarden.market.postcards={purchases};assert.throws(()=>G.validate(ws.taskGarden));}
  const ws=wallet(0);ws.taskGarden.market.postcards={purchases:[{itemId:'pc_forest',purchasedAt:200}]};assert.throws(()=>G.validate(ws.taskGarden));
});
test('concurrent purchases converge without double spending or revoking accepted stationery',()=>{
  const base=wallet(100),a=clone(base),b=clone(base);G.buyPostcard(a,'pc_forest',200);G.buyPostcard(b,'pc_letter',201);
  const merged=G.merge(base.taskGarden,a.taskGarden,b.taskGarden);assert.deepEqual(merged,G.merge(base.taskGarden,b.taskGarden,a.taskGarden));assert.equal(G.economy({taskGarden:merged}).balance,40);
  const stale=G.merge(a.taskGarden,base.taskGarden,a.taskGarden);assert.ok(G.postcards({taskGarden:stale}).items.find(i=>i.id==='pc_forest').owned);
  const same=clone(base);G.buyPostcard(same,'pc_forest',205);assert.equal(G.merge(base.taskGarden,a.taskGarden,same.taskGarden).market.postcards.purchases.length,1);
});
