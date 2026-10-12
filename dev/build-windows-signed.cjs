'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const signing=require('./windows-signing.cjs');
async function main(args=process.argv.slice(2)){
  if(args.length && !(args.length===1&&args[0]==='--check'))throw Error('Usage: node dev/build-windows-signed.cjs [--check]');
  const root=path.resolve(__dirname,'..');
  const config=signing.signedConfig(require('./commercial-release.cjs').config(root));
  const certificate=signing.inspect('certificate');
  console.log('Verified signing certificate: '+certificate.subject+'; expires '+certificate.expires);
  if(args[0]==='--check')return;
  const version=require('../package.json').version,output=path.join(root,'dist','signed',version);
  if(fs.existsSync(output))throw Error('Signed output directory already exists. Use a new release version to avoid overwriting an artifact.');
  config.directories={...config.directories,output};
  const {build,Platform,Arch}=require('electron-builder');
  await build({config,targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),publish:'never'});
  const application=path.join(output,'win-unpacked','Tracer.exe'),installer=path.join(output,'Tracer-Setup-'+version+'-x64.exe');
  const artifacts=signing.inspect('artifacts',[application,installer]);
  // Hash only after signing is finished; the existing verifier also checks
  // every packaged source file, private-data exclusions and pinned runtimes.
  cp.execFileSync(process.execPath,[path.join(__dirname,'verify-ai-release.cjs'),path.join(output,'win-unpacked','resources','app.asar')],{cwd:root,stdio:'inherit',windowsHide:true});
  fs.writeFileSync(path.join(output,'signing-verification.json'),JSON.stringify({version,verifiedAt:new Date().toISOString(),certificate,artifacts,published:false},null,2)+'\n');
  console.log('Signed application, installer, timestamps and package verified: '+output);
}
module.exports={main};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
