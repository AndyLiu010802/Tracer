'use strict';
// Explicit local builds retain personal characters and must never publish.
process.env.TRACER_LOCAL_BUILD='1';
const {build,Platform,Arch}=require('electron-builder');
if(process.argv[2]==='mac'){
 const cp=require('node:child_process'),path=require('node:path');const result=cp.spawnSync(process.execPath,[path.join(__dirname,'build-macos.cjs'),process.argv[3]||process.arch],{stdio:'inherit',env:process.env,windowsHide:true});process.exitCode=result.status||0;
}else build({targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),publish:'never'}).catch(error=>{console.error(error.message);process.exitCode=1;});
