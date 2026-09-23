'use strict';
// Validate the complete platform set before any draft becomes a public release.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const version=require('../package.json').version;
const binaries=[`Tracer-Setup-${version}-x64.exe`,`Tracer-Setup-${version}-x64.exe.blockmap`,...['arm64','x64'].flatMap(arch=>['dmg','zip'].map(ext=>`Tracer-${version}-mac-${arch}.${ext}`))];
const sumFile=`SHA256SUMS-${version}.txt`;
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const [mode,inputArg,outputArg]=process.argv.slice(2),input=path.resolve(inputArg||'artifacts');
if(mode==='stage'){
  const output=path.resolve(outputArg||'release');
  assert.notEqual(input,output,'Keep downloaded and publishable files separate');
  const sums=[sumFile,...['arm64','x64'].map(arch=>`SHA256SUMS-${version}-mac-${arch}.txt`)];
  assert.deepEqual(fs.readdirSync(input).sort(),[...binaries,...sums].sort(),'Exactly the expected files from all three successful builds');
  const verified=new Set();
  for(const file of sums)for(const line of fs.readFileSync(path.join(input,file),'utf8').trim().split(/\r?\n/)){
    const match=/^([a-f0-9]{64})  (.+)$/.exec(line);assert.ok(match,'Valid SHA-256 entry');
    assert.ok(binaries.includes(match[2]),'Only expected release filenames');assert.ok(!verified.has(match[2]),'No duplicate checksum entries');
    assert.equal(digest(path.join(input,match[2])),match[1],match[2]+' matches its native build checksum');verified.add(match[2]);
  }
  assert.deepEqual([...verified].sort(),binaries.filter(name=>!name.endsWith('.blockmap')).sort(),'All five installers/archives have native verification');
  fs.mkdirSync(output,{recursive:true});assert.deepEqual(fs.readdirSync(output),[],'Do not mix with an earlier release');
  // Both directories are in the CI workspace. Hard links keep the verified
  // binaries intact without duplicating several gigabytes before upload.
  for(const name of binaries){assert.ok(fs.statSync(path.join(input,name)).size>0);fs.linkSync(path.join(input,name),path.join(output,name));}
  fs.writeFileSync(path.join(output,sumFile),binaries.map(name=>digest(path.join(output,name))+'  '+name).join('\n')+'\n');
  console.log('PASS complete Windows, Apple Silicon and Intel artifacts; combined SHA-256 checksums');
}else if(mode==='uploaded'){
  const release=JSON.parse(fs.readFileSync(path.resolve(outputArg),'utf8'));
  assert.equal(release.tag_name,'v'+version);assert.equal(release.draft,true,'Check uploads while still a draft');
  assert.equal(release.target_commitish,process.env.GITHUB_SHA,'Release source is the tested commit');
  assert.deepEqual(release.assets.map(asset=>asset.name).sort(),[...binaries,sumFile].sort(),'Complete published asset set');
  for(const asset of release.assets){const file=path.join(input,asset.name);assert.equal(asset.state,'uploaded');assert.equal(asset.size,fs.statSync(file).size);assert.equal(asset.digest,'sha256:'+digest(file),asset.name+' GitHub SHA-256');}
  console.log('PASS all uploaded release assets, byte sizes, source commit and GitHub SHA-256 digests');
}else throw new Error('Usage: verify-release-artifacts.cjs stage <artifacts> <release> | uploaded <release> <json>');
