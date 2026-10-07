'use strict';
const M=require('./local-vfx-shell-model');
function createRouter({app,profile,platform,launch,release,cancel,configure,onResult=()=>{}}){
 const enabled=M.allowed(app,profile,platform);let started=false,dead=false,pending=null,generation=0;
 function result(value,request=generation){if(dead||request!==generation)return;try{onResult(value);}catch{}}
 function dispatch(command){
  if(dead||!enabled)return;
  const request=++generation;
  try{
   const action=command.action,handler={release,cancel,configure}[action];
   if(typeof handler!=='function')throw Error('local-command-failed');
   const value=handler();
   if(value?.then){value.then(v=>result({action,...(v||{ok:true})},request)).catch(()=>result({action,ok:false,error:'local-command-failed'},request));}
   else result({action,...(value||{ok:true})},request);
  }catch(e){result({action:command.action,ok:false,error:['local-vfx-disabled','local-vfx-assets-pending','local-vfx-assets-failed','local-vfx-invoke-point-unavailable','local-vfx-placement-unavailable'].includes(e?.message)?e.message:'local-command-failed'},request);}
 }
 function receive(argv,secondInstance=false){
  const command=M.parseArgv(argv,launch,secondInstance);if(command===null)return false;
  if(dead||!enabled){result({ok:false,error:'local-menu-forbidden'});return true;}
  if(command.kind!=='command'){result({ok:false,error:command.error});return true;}
  if(!started)pending=command;else dispatch(command);return true;
 }
 return{receive,ready(){if(dead||started)return;started=true;const command=pending;pending=null;if(command)dispatch(command);},destroy(){dead=true;pending=null;generation++;},state:()=>({ready:started,pending:pending?.action||null,enabled:enabled&&!dead})};
}
module.exports={createRouter};
