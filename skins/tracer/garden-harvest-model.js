(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerGardenHarvest=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const key='tracer.garden.harvest.v1',limit=10000,kinds=['wildflower','sunflower','lavender','apple','peach','cherry'];
  const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
  const time=value=>Number.isSafeInteger(value)&&value>=0&&value<=8640000000000000;
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const exact=(value,fields)=>object(value)&&Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k));
  const fail=code=>{throw Object.assign(new Error(code),{code});};
  const rarity=ticket=>ticket===0?'shiny':ticket<100?'rare':'normal';
  function fresh(){return {v:1,records:[]};}
  function read(raw){
    if(!exact(raw,['v','records'])||raw.v!==1||!Array.isArray(raw.records)||raw.records.length>limit)fail('invalid-garden-harvest');
    const seen=new Set();
    const records=Array.from(raw.records,row=>{
      if(!exact(row,['projectId','plantKind','maturedAt','ticket','harvestedAt'])||!id(row.projectId)||seen.has(row.projectId)||!kinds.includes(row.plantKind)||!time(row.maturedAt)||!Number.isInteger(row.ticket)||row.ticket<0||row.ticket>=10000||!(row.harvestedAt===null||time(row.harvestedAt)&&row.harvestedAt>=row.maturedAt))fail('invalid-garden-harvest');
      seen.add(row.projectId);return {...row};
    });return {v:1,records};
  }
  function draw(crypto){
    if(!crypto?.getRandomValues)fail('garden-random-unavailable');
    // Rejection sampling avoids modulo bias: each of the 10,000 outcomes has
    // identical probability, including the single shiny outcome.
    const ceiling=Math.floor(0x100000000/10000)*10000,buffer=new Uint32Array(1);
    for(let i=0;i<128;i++){crypto.getRandomValues(buffer);if(buffer[0]<ceiling)return buffer[0]%10000;}
    fail('garden-random-unavailable');
  }
  function mature(raw,plots,random){
    const state=read(raw),known=new Set(state.records.map(row=>row.projectId));
    if(!Array.isArray(plots)||typeof random!=='function')fail('invalid-garden-harvest');
    for(const plot of plots){
      if(plot.stage!==4||known.has(plot.projectId))continue;
      if(!id(plot.projectId)||!kinds.includes(plot.plantKind)||!time(plot.commemoratedAt))fail('invalid-garden-harvest');
      if(state.records.length>=limit)fail('garden-harvest-limit');
      const ticket=random();if(!Number.isInteger(ticket)||ticket<0||ticket>=10000)fail('invalid-garden-ticket');
      state.records.push({projectId:plot.projectId,plantKind:plot.plantKind,maturedAt:plot.commemoratedAt,ticket,harvestedAt:null});known.add(plot.projectId);
    }return state;
  }
  function harvest(raw,projectId,now=Date.now()){
    const state=read(raw),row=state.records.find(row=>row.projectId===projectId);
    if(!row||!time(now)||now<row.maturedAt)fail('garden-not-ready');
    if(row.harvestedAt===null)row.harvestedAt=now;
    return state;
  }
  function snapshot(raw){
    const state=read(raw),records=state.records.map(row=>({...row,rarity:rarity(row.ticket),petId:row.ticket<100?'garden_'+row.plantKind+(row.ticket===0?'_shiny':''):null}));
    return {records,collected:records.filter(row=>row.harvestedAt!==null),total:records.filter(row=>row.harvestedAt!==null).length};
  }
  return {key,kinds,fresh,read,draw,mature,harvest,snapshot,rarity};
});
