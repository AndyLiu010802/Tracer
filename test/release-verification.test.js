'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const asar=require('@electron/asar');
const {verifyArchiveSources}=require('../dev/verify-packaged-sources.cjs');
const {artifactSet,stageArtifacts,verifyUploaded,digest}=require('../dev/verify-release-artifacts.cjs');
const version='0.4.2',commit='a'.repeat(40),marker={version:1,channel:'commercial'};
function temporary(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-release-verify-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
async function packageFixture(t,options={}){
  const folder=temporary(t),source=path.join(folder,'expected'),packed=path.join(folder,'packed');
  const files={'package.json':JSON.stringify({version,tracerRelease:marker}),'server.js':'exports.ready = true;','desktop/main.js':'// Reviewed commercial overlay\n','skins/tracer/fishing-aquarium.js':'// Current aquarium rotation renderer\n'};
  for(const [file,bytes] of Object.entries(files)){const full=path.join(source,file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,bytes);}
  const actual={...files,...options.files};
  for(const file of options.omit||[])delete actual[file];
  for(const [file,bytes] of Object.entries(actual)){const full=path.join(packed,file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,bytes);}
  const archive=path.join(folder,'app.asar');await asar.createPackage(packed,archive);
  return {archive,manifest:{files:Object.keys(files).map(file=>({file,source:path.join(source,file)})),retainedExperienceAssets:1}};
}
test('commercial package verification compares actual overlays and permits rewritten package metadata',async t=>{
  const f=await packageFixture(t,{files:{'package.json':JSON.stringify({version,tracerRelease:marker,main:'desktop/main.js'})}});
  const checked=verifyArchiveSources(f.archive,f.manifest,version);assert.equal(checked.files.length,4);assert.equal(checked.retainedExperienceAssets,1);
});
test('commercial package rejects stale or missing current fishing assets',async t=>{
  for(const options of [{files:{'skins/tracer/fishing-aquarium.js':'// stale renderer'}},{omit:['skins/tracer/fishing-aquarium.js']}]){
    const f=await packageFixture(t,options);assert.throws(()=>verifyArchiveSources(f.archive,f.manifest,version));
  }
});
test('commercial package rejects local profiles, old effects and unreviewed first-party files',async t=>{
  for(const file of ['public/accounts.json','desktop/local-vfx.js','skins/tracer/pet-alchemy.js','ai-service/private-key.js','skins/tracer/unreviewed.js','private-key.json']){
    const f=await packageFixture(t,{files:{[file]:'private or obsolete'}});assert.throws(()=>verifyArchiveSources(f.archive,f.manifest,version),undefined,file);
  }
});
test('commercial package requires the exact release marker and requested version',async t=>{
  for(const pkg of [{version},{version,tracerRelease:{version:1,channel:'local'}},{version:'0.4.1',tracerRelease:marker}]){
    const f=await packageFixture(t,{files:{'package.json':JSON.stringify(pkg)}});assert.throws(()=>verifyArchiveSources(f.archive,f.manifest,version));
  }
});
function artifacts(t,platforms){
  const folder=temporary(t),input=path.join(folder,'artifacts'),output=path.join(folder,'release');fs.mkdirSync(input);
  const set=artifactSet(version,platforms);
  for(const name of set.binaries)fs.writeFileSync(path.join(input,name),'verified native build: '+name);
  for(const name of set.sums){
    const arch=/mac-(arm64|x64)/.exec(name)?.[1];
    const bins=set.binaries.filter(file=>arch?file.includes('-mac-'+arch+'.'):file.startsWith('Tracer-Setup-'));
    fs.writeFileSync(path.join(input,name),bins.map(file=>digest(path.join(input,file))+'  '+file).join('\n')+'\n');
  }
  return {input,output,set};
}
for(const platforms of ['windows','all'])test(platforms+' release requires complete native checksums and verifies the draft upload',t=>{
  const f=artifacts(t,platforms),staged=stageArtifacts(f.input,f.output,version,platforms);
  assert.equal(staged.files.length,platforms==='windows'?3:7);
  const release={tag_name:'v'+version,draft:true,target_commitish:commit,assets:staged.files.map(name=>({name,state:'uploaded',size:fs.statSync(path.join(f.output,name)).size,digest:'sha256:'+digest(path.join(f.output,name))}))};
  assert.doesNotThrow(()=>verifyUploaded(f.output,release,version,platforms,commit));
  assert.throws(()=>verifyUploaded(f.output,{...release,draft:false},version,platforms,commit));
  assert.throws(()=>verifyUploaded(f.output,{...release,target_commitish:'b'.repeat(40)},version,platforms,commit));
  assert.throws(()=>verifyUploaded(f.output,{...release,assets:release.assets.slice(1)},version,platforms,commit));
  assert.throws(()=>verifyUploaded(f.output,{...release,assets:release.assets.map((asset,i)=>i?asset:{...asset,digest:'sha256:'+'0'.repeat(64)})},version,platforms,commit));
});
test('Windows-only mode rejects partial, stale and tampered artifacts including blockmaps',t=>{
  for(const mutate of [
    f=>fs.unlinkSync(path.join(f.input,f.set.binaries[1])),
    f=>fs.appendFileSync(path.join(f.input,f.set.binaries[1]),'tampered'),
    f=>fs.writeFileSync(path.join(f.input,'Tracer-Setup-0.4.1-x64.exe'),'stale'),
    f=>fs.writeFileSync(path.join(f.input,f.set.sumFile),fs.readFileSync(path.join(f.input,f.set.sumFile),'utf8').split('\n')[0]+'\n'),
  ]){const f=artifacts(t,'windows');mutate(f);assert.throws(()=>stageArtifacts(f.input,f.output,version,'windows'));}
  assert.throws(()=>artifactSet(version,'win'));
});
test('all-platform release cannot silently publish only its successful Windows job',t=>{
  const f=artifacts(t,'windows');assert.throws(()=>stageArtifacts(f.input,f.output,version,'all'));
});
