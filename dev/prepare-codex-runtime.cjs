'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),spec=require('../build/codex-runtime.json');
const cache=path.join(root,'.cache/codex-download'),archive=path.join(cache,'openai-codex-'+spec.version+'-'+spec.platform+'.tgz');
const target=path.join(root,'.cache/codex-runtime');
(async()=>{
 fs.mkdirSync(cache,{recursive:true});
 if(!fs.existsSync(archive)){
  const response=await fetch(spec.url,{redirect:'error',signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error('Unable to download the pinned Codex runtime');
  const {Readable}=require('node:stream'),{pipeline}=require('node:stream/promises');
  await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(archive+'.tmp'));
  fs.renameSync(archive+'.tmp',archive);
 }
 const integrity='sha512-'+crypto.createHash('sha512').update(fs.readFileSync(archive)).digest('base64');
 if(integrity!==spec.integrity)throw Error('Codex package integrity mismatch');
 fs.mkdirSync(target,{recursive:true});
 const vendor=path.join(target,'package/vendor/x86_64-pc-windows-msvc');
 const valid=()=>Object.entries(spec.files).every(([name,hash])=>{const file=path.join(vendor,name);return fs.existsSync(file)&&crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===hash;});
 if(!valid())cp.execFileSync('tar',['-xf',archive,'-C',target],{windowsHide:true});
 if(!valid())throw Error('Extracted Codex runtime file hashes do not match');
 const exe=path.join(target,'package/vendor/x86_64-pc-windows-msvc/bin/codex.exe');
 const version=cp.execFileSync(exe,['--version'],{encoding:'utf8',windowsHide:true}).trim();
 if(version!=='codex-cli '+spec.version)throw Error('Unexpected Codex version');
 console.log('Verified official Codex '+spec.version+' archive and executable.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
