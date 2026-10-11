'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model');
function workspace(){const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'presentation_test',amount:50000,updatedAt:1};return ws;}
function expected(ws,conditions){return{state:F.read(ws),expedition:F.expedition(ws,conditions),progression:F.progression(ws),showcase:F.aquarium(ws),economy:F.economy(ws)};}
test('a single-read presentation matches independently validated views and never changes the save',()=>{
  const ws=workspace();F.buyBoxes(ws,{poolId:'basic',now:10,random:()=>0});F.unlockGround(ws,'reef',11);F.setExpedition(ws,{spotId:'reef'},12);
  const before=structuredClone(ws),conditions={timeId:'night',weatherId:'rain'};
  assert.deepEqual(F.presentation(ws,conditions),expected(ws,conditions));assert.deepEqual(ws,before);
  const display=F.presentation(ws);display.state.boxes.length=0;display.showcase.selection.fishIds.push('not-a-fish');
  assert.deepEqual(ws,before);assert.deepEqual(F.presentation(ws),expected(ws));
});
test('presentation sees in-place changes immediately and remains isolated between workspaces',()=>{
  const first=workspace(),second=workspace(),old=F.presentation(first);
  F.buyBox(first,{poolId:'basic',now:20,random:()=>0});
  assert.equal(F.presentation(first).state.boxes.length,old.state.boxes.length+1);
  assert.equal(F.presentation(second).state.boxes.length,0);
  assert.notEqual(F.presentation(first).economy.balance,F.presentation(second).economy.balance);
  assert.deepEqual(F.presentation(second),expected(second));
});
test('presentation continues to reject forged fishing and wallet records after a valid read',()=>{
  const ws=workspace();F.presentation(ws);ws.fishing.equippedRodId='forged';assert.throws(()=>F.presentation(ws));
  const wallet=workspace();F.presentation(wallet);wallet.taskGarden.market.fishingTransactions=[{id:'forged',amount:999999}];assert.throws(()=>F.presentation(wallet));
});
