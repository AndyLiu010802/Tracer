'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const F=require('../public/fishing-model'),Painted=require('../skins/tracer/fishing-basic-painted');
const root=path.resolve(__dirname,'..');
test('every base rod including the starter and hidden gold has its own complete imagegen asset',()=>{
 const pool=F.catalog.rodPools.find(p=>p.id==='basic'),ids=['bamboo',...pool.rodIds,pool.hiddenRodId],manifest=require('../docs/fishing-basic-art-manifest.json');
 assert.equal(manifest.generator,'built-in imagegen');assert.equal(manifest.complete,true);assert.equal(manifest.count,28);
 assert.deepEqual(Object.keys(Painted.assets).sort(),ids.sort());
 const hashes=new Set();
 for(const id of ids){const asset=Painted.assets[id],record=manifest.records.find(r=>r.key===id),bytes=fs.readFileSync(path.join(root,'skins/tracer',asset.src));
  const hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);hashes.add(hash);assert.equal(hash,record.revision,id);assert.equal(asset.src,record.destination.replace('skins/tracer',''));
  assert.equal(bytes[25],6,id+' transparent RGBA');assert(bytes.readUInt32BE(16)>1500);assert(bytes.readUInt32BE(16)>bytes.readUInt32BE(20)*2.5,id+' full horizontal prop');
 }
 assert.equal(hashes.size,ids.length,'individual paintings, not repeated placeholder art');
});
test('both fishing entry points load the new painted collection before their renderer',()=>{
 for(const file of ['index.html','fishing-desktop.html']){const html=fs.readFileSync(path.join(root,'skins/tracer',file),'utf8'),base=html.indexOf('src="/fishing-basic-painted.js"');
  assert(base>html.indexOf('src="/fishing-onepiece-painted.js"'));assert(base<html.indexOf('src="/fishing-rod-renderer.js"'));assert.equal((html.match(/src="\/fishing-basic-painted.js"/g)||[]).length,1);
 }
});
test('the basic guandao head is rigid while its upper fishing blank remains flexible',()=>{
 const entry={id:'guandao',bounds:[0,0,1000,300],base:[0,150],tip:[1000,150],width:1000,height:300};
 const deform=([t,n],bend)=>({x:t*500+bend*t*t*200,y:n+t*300});
 const rest=Array.from(Painted.vertices(entry,0,deform,500)),bent=Array.from(Painted.vertices(entry,.24,deform,500));
 for(let i=0;i<28*24;i+=4){assert.equal(rest[i],bent[i]);assert.equal(rest[i+1],bent[i+1]);}
 assert.notEqual(rest[63*24+4],bent[63*24+4]);
});
