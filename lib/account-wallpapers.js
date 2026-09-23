'use strict';
const store=require('./store'),G=require('../public/task-garden'),catalog=require('../public/wallpaper-catalog.json').concat(require('../public/frame-catalog.json'));
const clone=value=>JSON.parse(JSON.stringify(value));
const empty=()=>({purchases:[],appearance:{backgroundItemId:null,materialItemId:null},updatedAt:0});
const fail=(code,status=409)=>{throw Object.assign(new Error(code),{code,status});};
function project(workspace,accountId){
  const garden=G.read(workspace||{}),ledger=garden.market.wallpapers||empty();
  return{version:1,accountId,items:clone(ledger.purchases),appearance:clone(ledger.appearance),ledger:clone(ledger),balance:G.economy(workspace||{}).balance,purchasingAvailable:true,catalog:catalog.map(item=>({...item,asset:item.asset?(['avatarFrame','taskFrame'].includes(item.type)?item.asset:'/wallpapers/'+item.asset.split('/').pop()):undefined}))};
}
async function mutate(dir,accountId,action,input,now){
  let result;
  await store.writeStore(dir,'workspace','null',(previous)=>{
    if(!previous&&action==='purchase')fail('insufficient-coins');
    const next=clone(previous||require('../skins/tracer/model').emptyWorkspace()),garden=G.read(next),ledger=garden.market.wallpapers||empty();
    const item=catalog.find(row=>row.id===input.itemId);
    if(action==='purchase'){
      if(!item)fail('invalid-wallpaper',400);
      const owned=ledger.purchases.some(p=>p.itemId===item.id);
      if(!owned){if(G.economy(next).balance<item.price)fail('insufficient-coins');ledger.purchases.push({itemId:item.id,purchasedAt:now});}
      result={alreadyOwned:owned};
    }else{
      const slots={background:['static','dynamic'],material:['material'],avatarFrame:['avatarFrame'],taskFrame:['taskFrame']};
      if(!Object.prototype.hasOwnProperty.call(slots,input.slot))fail('invalid-wallpaper',400);
      const key=input.slot+'ItemId';
      if(input.itemId!==null&&(!item||!slots[input.slot].includes(item.type)))fail('invalid-wallpaper',400);
      if(item&&!ledger.purchases.some(p=>p.itemId===item.id))fail('wallpaper-not-owned');
      ledger.appearance[key]=input.itemId;result={};
    }
    ledger.updatedAt=Math.max(now,ledger.updatedAt+1);garden.market.wallpapers=ledger;next.taskGarden=G.validate(garden);
    result={ok:true,...result,collection:project(next,accountId)};return next;
  });
  return result;
}
// Generic workspace saves cannot mint purchases, revoke ownership, or revert appearance.
// Preserve the previous ledger inside the same serialized write as garden spending.
function preserve(previous,next){
  const saved=previous?.taskGarden?.market?.wallpapers;
  if(next?.taskGarden?.market){
    if(saved){
      const changed=JSON.stringify(saved)!==JSON.stringify(next.taskGarden.market.wallpapers);
      if(changed)G.validate(next.taskGarden);
      next.taskGarden.market.wallpapers=clone(saved);
      if(changed){try{G.validate(next.taskGarden);}catch{fail('workspace-stale');}}
    }else delete next.taskGarden.market.wallpapers;
  }
}
module.exports={project,mutate,preserve};
