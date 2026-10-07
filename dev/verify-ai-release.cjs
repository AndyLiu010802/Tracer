'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {verifyPackagedSources}=require('./verify-packaged-sources.cjs');
const {verifyDataModules}=require('./verify-macos-release.cjs');
(async()=>{
 const version=require('../package.json').version;
 const archive=path.resolve(process.argv[2]||path.join(root,'dist','win-unpacked','resources','app.asar'));
 const checked=verifyPackagedSources(archive,root);
 verifyDataModules(archive);
 const runtime=path.join(path.dirname(archive),'codex'),spec=require('../build/codex-runtime.json');
 for(const [name,hash] of Object.entries(spec.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(runtime,name))).digest('hex'),hash,'Official runtime '+name);
 const allowed=new Set([...Object.keys(spec.files),'codex-LICENSE.txt','codex-NOTICE.txt']);
 function walk(dir,base=''){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const name=base+f.name;assert.ok(!f.isSymbolicLink(),'No bundled runtime links: '+name);if(f.isDirectory())walk(path.join(dir,f.name),name+'/');else assert.ok(allowed.has(name),'Unexpected bundled runtime file '+name);}}walk(runtime);
 for(const name of ['codex-LICENSE.txt','codex-NOTICE.txt'])assert.ok(fs.readFileSync(path.join(runtime,name)).equals(fs.readFileSync(path.join(root,'build',name))));
 const distribution=path.dirname(path.dirname(path.dirname(archive)));
 const sums=[];
 for(const name of ['Tracer-Setup-'+version+'-x64.exe','Tracer-Setup-'+version+'-x64.exe.blockmap']){
  assert.ok(fs.statSync(path.join(distribution,name)).size>0,'Nonempty release artifact '+name);
  const hash=crypto.createHash('sha256');for await(const bytes of fs.createReadStream(path.join(distribution,name)))hash.update(bytes);
  sums.push(hash.digest('hex')+'  '+name);
 }
 fs.writeFileSync(path.join(distribution,'SHA256SUMS-'+version+'.txt'),sums.join('\n')+'\n');
 console.log('PASS Windows commercial installer: '+checked.files.length+' reviewed files, '+checked.retainedExperienceAssets+' garden/fishing assets, privacy, legacy backup compatibility, approved native runtime and artifact checksums');
})().catch(e=>{console.error(e);process.exitCode=1;});

