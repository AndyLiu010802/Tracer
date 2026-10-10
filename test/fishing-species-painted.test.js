'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),F=require('../public/fishing-model'),Art=require('../skins/tracer/fishing-art'),paint=require('../skins/tracer/fishing-species-painted'),manifest=require('../docs/fishing-species-art-manifest.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');

test('all 156 species have distinct generated originals, provenance and a unique atlas cell',()=>{
  assert.equal(F.catalog.fish.length,156);assert.equal(manifest.completed,156);assert.equal(manifest.generator,'built-in imagegen');
  const ids=F.catalog.fish.map(f=>f.id).sort();assert.deepEqual(Object.keys(paint.assets).sort(),ids);assert.deepEqual(manifest.records.map(r=>r.id).sort(),ids);
  const prompts=new Set(),digests=new Set(),cells=new Set();
  for(const r of manifest.records){
    assert.equal(r.generator,'built-in imagegen');assert(r.prompt.length>600,r.id+' has a recorded design brief');prompts.add(r.prompt);
    assert.equal(r.sha256,hash(fs.readFileSync(path.join(root,r.source))));digests.add(r.sha256);
    assert(r.metrics.clear>.12,r.id+' has genuine surrounding transparency');assert.equal(r.metrics.borderPixels,0,r.id+' has no clipped appendages');assert(r.metrics.occupiedPixels>50000,r.id+' is a complete illustration');
    const asset=paint.assets[r.id];cells.add(asset.src+':'+asset.bounds.join(','));assert.deepEqual(asset.bounds,r.metrics.bounds);
  }
  assert.equal(prompts.size,156);assert.equal(digests.size,156);assert.equal(cells.size,156);
});

test('paged runtime textures preserve alpha and remain separate from high-resolution originals',()=>{
  assert.equal(manifest.atlases.length,10);let occupied=0;
  for(const a of manifest.atlases){
    const bytes=fs.readFileSync(path.join(root,'skins/tracer/fishing-art',a.file));assert.equal(hash(bytes),a.sha256);assert.equal(a.revision,a.sha256.slice(0,12));
    assert.equal(bytes.toString('ascii',12,16),'IHDR');assert.equal(bytes[25],6);assert.equal(bytes.readUInt32BE(16),1536);assert.equal(bytes.readUInt32BE(20),1024);
    assert(a.items.length<=16);occupied+=a.items.length;
    for(const item of a.items){const asset=paint.assets[item.id];assert(asset.src.includes('?v='+a.revision));assert.equal(asset.width,1536);assert.equal(asset.height,1024);const [x,y,x2,y2]=asset.bounds;assert(x>=0&&y>=0&&x2<=1536&&y2<=1024);assert.equal(x2-x,384);assert.equal(y2-y,256);}
  }
  assert.equal(occupied,156);
});

test('fish, resident and multi-catch views resolve the actual species illustration',()=>{
  for(const fish of F.catalog.fish){
    for(const item of [fish,{id:'resident-123',fishId:fish.id,growth:25},{id:'stored-fry',speciesId:fish.id,growth:100}]){const markup=Art.fishMarkup(item),asset=paint.assets[fish.id];assert(markup.includes(asset.src));assert(markup.includes('data-species="'+fish.id+'"'));assert(markup.includes('data-fish-art="imagegen"'));assert(!markup.includes('fish-model-v1.png'));}
  }
  const haul=F.catalog.fish.slice(57,62),flight=Art.catchFlightMarkup(haul);assert.equal((flight.match(/data-fish-art="imagegen"/g)||[]).length,5);
  for(const fish of haul)assert(flight.includes('data-fish-id="'+fish.id+'"'));
  for(const id of ['unregistered-fish','__proto__','constructor','"><script>bad</script>']){const markup=Art.fishMarkup({id});assert(markup.includes('data-fish-art="model"'));assert(!markup.includes('<script>'));}
});

test('asynchronous portrait warming deduplicates pages and keeps at most six recent image references',async()=>{
  const assignments=[],images=[];class Image{constructor(){images.push(this);}set src(value){this.value=value;assignments.push(value);}decode(){return Promise.resolve();}}
  const doc={defaultView:{Image}},ids=[...new Map(Object.entries(paint.assets).map(([id,a])=>[a.src,id])).values()];assert(ids.length>=7);
  const finish=async promise=>{for(const image of images)image.onload?.();await promise;};
  let done=false;const first=Art.preloadFishPortraits([{id:ids[0]},{fishId:ids[0]}],doc).then(()=>{done=true;});assert.equal(assignments.length,1);assert.equal(done,false);assert.equal(images[0].decoding,'async');await finish(first);assert(done);
  await Art.preloadFishPortraits([{speciesId:ids[0]}],doc);assert.equal(assignments.length,1);
  for(const id of ids.slice(1,7))await finish(Art.preloadFishPortraits([{id}],doc));assert.equal(assignments.length,7);
  await finish(Art.preloadFishPortraits([{id:ids[0]}],doc));assert.equal(assignments.length,8,'least recently used page is no longer retained');
  assert.deepEqual(await Art.preloadFishPortraits([{id:'unknown'}],doc),[]);assert.deepEqual(await Art.preloadFishPortraits([],null),[]);
  const fail=Art.preloadFishPortraits([{id:ids[1]}],{defaultView:{Image}});images.at(-1).onerror();assert.deepEqual(await fail,[false],'image failure never blocks fishing');
});

test('all production windows load the painted species map before the renderer',()=>{
  for(const name of ['index.html','fishing-desktop.html','fishing-aquarium-desktop.html']){const html=fs.readFileSync(path.join(root,'skins/tracer',name),'utf8');assert(html.indexOf('/fishing-species-painted.js')>=0,name);assert(html.indexOf('/fishing-species-painted.js')<html.indexOf('/fishing-art.js'),name);}
  const pack=fs.readFileSync(path.join(root,'dev/desktop-pack-assets.cjs'),'utf8');assert(pack.includes("require('../skins/tracer/fishing-species-painted').assets"));
});
