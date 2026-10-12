'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),cp=require('node:child_process');
function thumbprint(env=process.env){
  const value=String(env.TRACER_WINDOWS_CERT_SHA1||'').replace(/\s/g,'').toUpperCase();
  assert.match(value,/^[A-F0-9]{40}$/,'Set TRACER_WINDOWS_CERT_SHA1 to the code-signing certificate thumbprint after identity validation and installation.');
  return value;
}
function signedConfig(base,env=process.env){
  const certificateSha1=thumbprint(env);
  assert(!base.win?.azureSignOptions,'Choose one signing provider.');
  assert(!base.win?.signtoolOptions?.sign,'A custom signer must be reviewed separately.');
  assert(base.win?.signAndEditExecutable!==false&&base.win?.signExecutable!==false,'Executable signing must remain enabled.');
  return {...base,forceCodeSigning:true,win:{...base.win,signExecutable:true,signAndEditExecutable:true,verifyUpdateCodeSignature:true,signtoolOptions:{certificateSha1,sign:path.join(__dirname,'windows-sign-hook.cjs'),signingHashAlgorithms:['sha256'],rfc3161TimeStampServer:'http://timestamp.digicert.com'}}};
}
function inspect(mode,files=[],env=process.env){
  assert.equal(process.platform,'win32','Windows certificate-store signing requires Windows.');
  const sha=thumbprint(env);
  assert(['certificate','artifacts'].includes(mode),'Unknown signing inspection mode.');
  const ps=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const args=['-NoProfile','-NonInteractive','-File',path.join(__dirname,'windows-signing-check.ps1'),'-Mode',mode,'-Thumbprint',sha];
  if(mode==='artifacts'){
    assert.equal(files.length,2,'Verify the application and installer.');
    args.push('-Application',path.resolve(files[0]),'-Installer',path.resolve(files[1]));
  }
  try{return JSON.parse(cp.execFileSync(ps,args,{encoding:'utf8',windowsHide:true,env,stdio:['ignore','pipe','pipe'],timeout:120000}).replace(/^\uFEFF/,''));}
  catch(error){throw Error('Windows signing check failed: '+String(error.stderr||error.message).trim());}
}
module.exports={thumbprint,signedConfig,inspect};
