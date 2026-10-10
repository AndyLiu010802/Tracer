'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),jobs=require('./fishing-basic-art-specs.cjs').jobs;
const records=JSON.parse(fs.readFileSync(path.join(root,'output/fishing-basic-upgrade/records.json'),'utf8'));
const partial=process.argv.includes('--partial'),assets={},revisions={},final=[];
for(const job of jobs){
  const record=records.find(r=>r.key===job.key);
  if(!record){if(partial)continue;throw Error('Missing generated rod: '+job.key);}
  assert.equal(record.prompt,job.prompt);assert.equal(record.generator,'built-in imagegen');
  fs.copyFileSync(record.source,path.join(root,job.destination));
  const bytes=fs.readFileSync(path.join(root,job.destination));assert.equal(bytes[25],6,'RGBA source');
  const revision=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
  assets[job.key]={src:job.destination.replace('skins/tracer',''),...(job.key==='guandao'?{rigidUntil:.46}:{} )};
  revisions[job.key]=revision;final.push({...record,revision,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length});
}
if(!partial)assert.equal(final.length,28);
fs.writeFileSync(path.join(root,'skins/tracer/fishing-basic-painted.js'),"(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./fishing-onepiece-painted'):root.TracerFishingOnePiecePainted);if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingBasicPainted=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Painted){\n'use strict';\nconst assets="+JSON.stringify(assets)+";\nconst revisions="+JSON.stringify(revisions)+";\nreturn Painted.createCollection(assets,revisions);\n});\n");
fs.writeFileSync(path.join(root,'docs/fishing-basic-art-manifest.json'),JSON.stringify({generator:'built-in imagegen',complete:!partial,count:final.length,records:final},null,2)+'\n');
console.log('Integrated '+final.length+' basic rods');
