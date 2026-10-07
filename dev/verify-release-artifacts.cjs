'use strict';
// Validate exactly the requested platform set before a draft becomes public.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function artifactSet(version,platforms='all'){
  assert.ok(['windows','all'].includes(platforms),'Choose windows or all release platforms');
  assert.match(version,/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/,'Valid release version');
  const windows=['Tracer-Setup-'+version+'-x64.exe','Tracer-Setup-'+version+'-x64.exe.blockmap'];
  const binaries=platforms==='windows'?windows:[...windows,...['arm64','x64'].flatMap(arch=>['dmg','zip'].map(ext=>'Tracer-'+version+'-mac-'+arch+'.'+ext))];
  const sumFile='SHA256SUMS-'+version+'.txt';
  return {binaries,sumFile,sums:platforms==='windows'?[sumFile]:[sumFile,...['arm64','x64'].map(arch=>'SHA256SUMS-'+version+'-mac-'+arch+'.txt')]};
}
function stageArtifacts(input,output,version,platforms='all'){
  input=path.resolve(input);output=path.resolve(output);
  assert.notEqual(input,output,'Keep downloaded and publishable files separate');
  const {binaries,sumFile,sums}=artifactSet(version,platforms);
  assert.deepEqual(fs.readdirSync(input).sort(),[...binaries,...sums].sort(),'Exactly the expected files from successful '+platforms+' builds');
  const verified=new Set();
  for(const file of sums)for(const line of fs.readFileSync(path.join(input,file),'utf8').trim().split(/\r?\n/)){
    const match=/^([a-f0-9]{64})  (.+)$/.exec(line);assert.ok(match,'Valid SHA-256 entry');
    assert.ok(binaries.includes(match[2]),'Only expected release filenames');assert.ok(!verified.has(match[2]),'No duplicate checksum entries');
    const full=path.join(input,match[2]),stat=fs.lstatSync(full);
    assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0,'Nonempty regular release artifact '+match[2]);
    assert.equal(digest(full),match[1],match[2]+' matches its native build checksum');verified.add(match[2]);
  }
  assert.deepEqual([...verified].sort(),binaries.slice().sort(),'Every installer, archive and blockmap has native verification');
  fs.mkdirSync(output,{recursive:true});assert.deepEqual(fs.readdirSync(output),[],'Do not mix with an earlier release');
  for(const name of binaries)fs.linkSync(path.join(input,name),path.join(output,name));
  fs.writeFileSync(path.join(output,sumFile),binaries.map(name=>digest(path.join(output,name))+'  '+name).join('\n')+'\n');
  return {platforms,files:[...binaries,sumFile]};
}
function verifyUploaded(input,release,version,platforms='all',commit=process.env.GITHUB_SHA){
  const {binaries,sumFile}=artifactSet(version,platforms);
  assert.match(commit||'',/^[a-f0-9]{40}$/,'A tested source commit is required');
  assert.equal(release.tag_name,'v'+version);assert.equal(release.draft,true,'Check uploads while still a draft');
  assert.equal(release.target_commitish,commit,'Release source is the tested commit');
  assert.deepEqual(release.assets.map(asset=>asset.name).sort(),[...binaries,sumFile].sort(),'Complete published asset set');
  for(const asset of release.assets){
    const file=path.join(input,asset.name);
    assert.equal(asset.state,'uploaded');assert.equal(asset.size,fs.statSync(file).size);
    assert.equal(asset.digest,'sha256:'+digest(file),asset.name+' GitHub SHA-256');
  }
}
function main(){
  const [mode,inputArg,outputArg,platformArg]=process.argv.slice(2),input=path.resolve(inputArg||'artifacts');
  const version=require('../package.json').version,platforms=platformArg||process.env.TRACER_RELEASE_PLATFORMS||'all';
  if(mode==='stage'){
    stageArtifacts(input,path.resolve(outputArg||'release'),version,platforms);
    console.log('PASS complete '+platforms+' artifacts and native SHA-256 checksums');
  }else if(mode==='uploaded'){
    verifyUploaded(input,JSON.parse(fs.readFileSync(path.resolve(outputArg),'utf8')),version,platforms);
    console.log('PASS all uploaded '+platforms+' release assets, byte sizes, source commit and GitHub SHA-256 digests');
  }else throw new Error('Usage: verify-release-artifacts.cjs stage <artifacts> <release> [windows|all] | uploaded <release> <json> [windows|all]');
}
module.exports={artifactSet,stageArtifacts,verifyUploaded,digest};
if(require.main===module)main();

