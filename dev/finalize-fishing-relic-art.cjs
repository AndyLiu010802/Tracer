'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),relic=require('./fishing-relic-art-specs.cjs'),onepiece=require('./fishing-onepiece-vfx-specs.cjs');
const partial=process.argv.includes('--partial'),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').slice(0,12);
const assets={},revisions={},relicFX={},onepieceFX={},records=[];
for(const job of [...relic.jobs,...onepiece.jobs]){
  const file=path.join(root,'output/fishing-relic-upgrade/records',job.key+'-'+job.kind+'.json');
  if(!fs.existsSync(file)){if(partial)continue;throw Error('Missing generation record: '+job.key+' '+job.kind);}
  const record=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(record.prompt,job.prompt,'Stale prompt for '+job.key+' '+job.kind);assert.equal(record.destination,job.destination);assert.ok(fs.statSync(path.join(root,job.destination)).size>10000);
  const revision=hash(job.destination),src=job.destination.replace('skins/tracer','');records.push({...record,revision});
  if(job.kind==='rod'){assets[job.key]={src,...(job.key==='guanyuyunchang'?{rigidUntil:.57}:{}),...(relic.specs[job.key].rig?{rig:relic.specs[job.key].rig}:{})};revisions[job.key]=revision;}
  else if(job.kind==='fx')relicFX[job.key]={src,revision,motion:relic.specs[job.key].motion};
  else onepieceFX['anime_'+job.key]={src,revision,motion:onepiece.specs[job.key].motion};
}
if(!partial){assert.equal(Object.keys(assets).length,105);assert.equal(Object.keys(relicFX).length,105);assert.equal(Object.keys(onepieceFX).length,45);}
const write=(file,contents)=>fs.writeFileSync(path.join(root,file),contents);
write('skins/tracer/fishing-relic-painted.js',"(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./fishing-onepiece-painted'):root.TracerFishingOnePiecePainted);if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingRelicPainted=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Painted){\n'use strict';\nconst assets="+JSON.stringify(assets)+";\nconst revisions="+JSON.stringify(revisions)+";\nreturn Painted.createCollection(assets,revisions);\n});\n");
for(const [name,globalName,specs,renderer] of [['relic','TracerFishingRelicVFX',relicFX,'painted-relic'],['onepiece','TracerFishingOnePieceVFX',onepieceFX,'painted-onepiece']]){
  write('skins/tracer/fishing-'+name+'-vfx.js',"(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./fishing-painted-vfx'):root.TracerFishingPaintedVFX);if(typeof module==='object'&&module.exports)module.exports=api;else root."+globalName+"=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Painted){\n'use strict';\nconst specs="+JSON.stringify(specs)+";\nreturn Painted.createCollection(specs,"+JSON.stringify(renderer)+");\n});\n");
}
write('output/fishing-relic-upgrade/manifest.json',JSON.stringify({generator:'built-in imagegen',complete:!partial,counts:{rods:Object.keys(assets).length,relicFX:Object.keys(relicFX).length,onepieceFX:Object.keys(onepieceFX).length},records},null,2));
console.log(JSON.stringify({partial,assets:Object.keys(assets).length,relicFX:Object.keys(relicFX).length,onepieceFX:Object.keys(onepieceFX).length}));
