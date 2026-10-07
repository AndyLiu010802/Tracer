'use strict';
const path=require('node:path');
const ROOT='HKCU\\Software\\Classes\\DesktopBackground\\Shell',OWNER='Tracer.LocalEffects.v1';
const ACTIONS=Object.freeze(['release','cancel','configure']),PREFIX='--tracer-local-action=';
const plans=new WeakSet();
const fail=code=>{throw Error(code);};
function allowed(app,profile,platform){return app?.isPackaged===false&&profile?.channel==='local'&&platform==='win32';}
function safePath(value,extension){
 if(typeof value!=='string'||value.length>30000||/[\x00-\x1f\x7f"%<>|?*]/.test(value)||!path.win32.isAbsolute(value)||value.startsWith('\\\\')||! /^[a-z]:\\/i.test(value.replaceAll('/','\\'))||value.slice(2).includes(':'))fail('local-menu-invalid-path');
 const v=path.win32.normalize(value);if(v.endsWith('\\'))fail('local-menu-invalid-path');if(extension&&!v.toLowerCase().endsWith(extension))fail('local-menu-invalid-path');return v;
}
function sourceLaunch(launch){
 if(!launch||launch.kind!=='source')fail('local-menu-source-only');
 return Object.freeze({kind:'source',executable:safePath(launch.executable,'.exe'),appPath:safePath(launch.appPath)});
}
// Derive registry targets only from this module's project directory. Callers
// can inspect the trusted launch, but cannot supply another executable or app.
function fixedSourceLaunch(){
 const appPath=safePath(path.resolve(__dirname,'..'));
 return sourceLaunch({kind:'source',executable:path.join(appPath,'node_modules','electron','dist','electron.exe'),appPath});
}
function registrationLaunch(launch){
 const target=fixedSourceLaunch();
 if(launch!==undefined){
  const supplied=sourceLaunch(launch);
  if(Object.keys(launch).sort().join(',')!=='appPath,executable,kind'||supplied.executable!==target.executable||supplied.appPath!==target.appPath)fail('local-menu-fixed-launch-required');
 }
 return target;
}
function samePath(a,b){try{return safePath(a).toLowerCase()===safePath(b).toLowerCase();}catch{return false;}}
function parseArgv(argv,launch,secondInstance=false){
 if(typeof secondInstance!=='boolean'||!Array.isArray(argv)||argv.some(v=>typeof v!=='string'))return{kind:'invalid',error:'invalid-local-command'};
 if(!argv.some(v=>v.startsWith('--tracer-local-')))return null;
 let exact;try{exact=sourceLaunch(launch);}catch{return{kind:'invalid',error:'invalid-local-command'};}
 // Electron second-instance events may reorder arguments and inject this
 // exact internal switch. Only that explicit main-process transport accepts it.
 if(secondInstance===true){
  const invalid={kind:'invalid',error:'invalid-local-command'};
  if(argv.length<3||argv.length>4||!samePath(argv[0],exact.executable))return invalid;
  const args=argv.slice(1),paths=args.filter(value=>samePath(value,exact.appPath)),actions=args.filter(value=>value.startsWith(PREFIX)),internal=args.filter(value=>value==='--allow-file-access-from-files');
  if(paths.length!==1||actions.length!==1||internal.length>1||args.length!==paths.length+actions.length+internal.length)return invalid;
  argv=[argv[0],paths[0],actions[0]];
 }
 if(argv.length!==3||!samePath(argv[0],exact.executable)||!samePath(argv[1],exact.appPath)||!argv[2].startsWith(PREFIX))return{kind:'invalid',error:'invalid-local-command'};
 const action=argv[2].slice(PREFIX.length);
 return ACTIONS.includes(action)?Object.freeze({kind:'command',action}):Object.freeze({kind:'invalid',error:'invalid-local-command'});
}
const labels={release:'Tracer: Release selected local effect',cancel:'Tracer: Cancel local effect',configure:'Tracer: Local effect settings'};
function buildPlan({app,profile,platform,launch}){
 if(!allowed(app,profile,platform))fail('local-menu-forbidden');
 const target=registrationLaunch(launch),entries=ACTIONS.map(action=>{
  const key=ROOT+'\\Tracer.LocalEffects.'+action[0].toUpperCase()+action.slice(1),command='"'+target.executable+'" "'+target.appPath+'" "'+PREFIX+action+'"';
  const parent=Object.freeze({values:Object.freeze({'':labels[action],Position:'Bottom',TracerOwner:OWNER,TracerCommand:command}),children:Object.freeze(['command'])});
  const child=Object.freeze({key:key+'\\command',values:Object.freeze({'':command,TracerOwner:OWNER}),children:Object.freeze([])});
  return Object.freeze({key,action,parent,command:child});
 });
 const plan=Object.freeze({owner:OWNER,root:ROOT,launch:target,entries:Object.freeze(entries)});plans.add(plan);return plan;
}
function equal(a,b){
 if(a===null||b===null)return a===b;
 if(!a||!b||!a.values||!b.values||!Array.isArray(a.children)||!Array.isArray(b.children))return false;
 const keys=Object.keys(a.values).sort(),other=Object.keys(b.values).sort();
 return JSON.stringify(keys)===JSON.stringify(other)&&keys.every(k=>a.values[k]===b.values[k])&&JSON.stringify([...a.children].sort())===JSON.stringify([...b.children].sort());
}
function operations(plan,registry,mode){
 if(!plans.has(plan)||!registry||!['read','write','remove'].every(k=>typeof registry[k]==='function'))fail('local-menu-invalid-plan');
 const steps=[];
 // Preflight every owned key before the first mutation. Unknown values/children conflict.
 for(const entry of plan.entries){
  const parent=registry.read(entry.key),child=registry.read(entry.command.key);
  if(parent===null&&child===null){if(mode==='install')steps.push({key:entry.key,before:null,after:entry.parent},{key:entry.command.key,before:null,after:{values:entry.command.values,children:[]}});continue;}
  if(!equal(parent,entry.parent)||!equal(child,entry.command))fail('local-menu-conflict');
  if(mode==='remove')steps.push({key:entry.command.key,before:child,after:null},{key:entry.key,before:{...parent,children:[]},after:null});
 }
 return steps;
}
function apply(plan,registry,mode){
 const steps=operations(plan,registry,mode),attempted=[];
 try{
  for(const step of steps){
   const owner=plan.entries.find(entry=>entry.command.key===step.key);
   if(owner){
    const expectedParent=mode==='install'?{...owner.parent,children:[]}:owner.parent;
    if(!equal(registry.read(owner.key),expectedParent))fail('local-menu-conflict');
   }
   const current=registry.read(step.key);
   // A parent gains/loses its command child as the adjacent step runs.
   const expected=step.before;
   if(!equal(current,expected)){
    const installingParent=mode==='install'&&step.after===plan.entries.find(e=>e.key===step.key)?.parent;
    if(!installingParent)fail('local-menu-conflict');
    if(current!==null)fail('local-menu-conflict');
   }
   attempted.push(step);
   if(step.after===null)registry.remove(step.key);else registry.write(step.key,step.after.values);
  }
  return{ok:true,mode,changed:steps.length,keys:plan.entries.map(e=>e.key)};
 }catch(error){
  let blocked=false;
  for(const step of attempted.reverse()){
   try{
    let current=registry.read(step.key),after=step.after;
    if(after&&step.key.endsWith('\\command')===false)after={...after,children:[]};
    if(equal(current,step.before))continue;
    if(!equal(current,after)){blocked=true;continue;}
    if(step.before===null)registry.remove(step.key);else registry.write(step.key,step.before.values);
   }catch{blocked=true;}
  }
  return{ok:false,error:blocked?'local-menu-rollback-blocked':error.message==='local-menu-conflict'?'local-menu-conflict':'local-menu-operation-failed',mode};
 }
}
module.exports={ROOT,OWNER,ACTIONS,PREFIX,allowed,fixedSourceLaunch,parseArgv,buildPlan,install:(plan,r)=>apply(plan,r,'install'),remove:(plan,r)=>apply(plan,r,'remove')};
