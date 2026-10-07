'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Art=require('../skins/tracer/fishing-art'),F=require('../public/fishing-model');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'skins/tracer/fishing-art');
const manifest=()=>JSON.parse(fs.readFileSync(path.join(folder,'catalog-model-v1.json'),'utf8'));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('catalog previews stay current with their shared live models and renderer',()=>{
  const {sources}=manifest();
  for(const file of ['skins/tracer/fishing-lighting.js','skins/tracer/fishing-art.js','skins/tracer/fishing-rod-renderer.js','public/fishing-model.js','dev/build-fishing-catalog-art.cjs']){
    assert.equal(sources[file],digest(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')),file+' changed: run node dev/build-fishing-catalog-art.cjs');
  }
});

test('bundled model atlases contain one complete transparent preview for every catalog entry',()=>{
  const {atlases}=manifest();
  for(const [file,catalog]of [['rods-model-v1.png',F.catalog.rods],['fish-model-v1.png',F.catalog.fish]]){
    const atlas=atlases.find(item=>item.file===file);assert(atlas,file+' is in the generated manifest');
    assert.deepEqual(atlas.ids,catalog.map(item=>item.id));assert.deepEqual(atlas.items.map(item=>item.id),atlas.ids);
    assert.equal(atlas.width,atlas.cellWidth*atlas.columns);assert.equal(atlas.height,atlas.cellHeight*atlas.rows);
    assert(atlas.ids.length<=atlas.columns*atlas.rows&&atlas.ids.length>atlas.columns*(atlas.rows-1));
    const bytes=fs.readFileSync(path.join(folder,file));
    assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    assert.equal(bytes.toString('ascii',12,16),'IHDR');assert.equal(bytes.readUInt32BE(16),atlas.width);assert.equal(bytes.readUInt32BE(20),atlas.height);
    assert.equal(bytes[24],8,'eight bit channels');assert.equal(bytes[25],6,'RGBA keeps the background transparent');
    assert.equal(digest(bytes),atlas.sha256,file+' matches its measured crop metadata');
    for(const [index,item]of atlas.items.entries()){
      const [left,top,right,bottom]=item.bounds,x=index%atlas.columns*atlas.cellWidth,y=Math.floor(index/atlas.columns)*atlas.cellHeight;
      assert(item.bounds.every(Number.isFinite),item.id+' has finite bounds');
      assert(left>=x&&top>=y&&right<=x+atlas.cellWidth&&bottom<=y+atlas.cellHeight,item.id+' stays in its own cell');
      assert(right>left&&bottom>top,item.id+' has visible dimensions');
      assert(item.occupiedPixels>100&&item.occupiedPixels<=(right-left)*(bottom-top),item.id+' has visible, nonempty art');
    }
  }
});

test('rods, journal fish and fish instances all use the matching model atlas',()=>{
  for(const rod of F.catalog.rods){const markup=Art.rodMarkup(rod);assert(markup.includes('/fishing-art/rods-model-v1.png'));assert(markup.includes('data-rod-id="'+rod.id+'"'));}
  for(const fish of F.catalog.fish){
    const markup=Art.fishMarkup(fish);assert(markup.includes('/fishing-art/fish-model-v1.png'));assert(markup.includes('data-species="'+fish.id+'"'));
    const image=markup.match(/<image\b[^>]*>/)[0];
    for(const field of ['fishId','speciesId']){
      const instance=Art.fishMarkup({id:'fish_instance_42',[field]:fish.id});
      assert.equal(instance.match(/<image\b[^>]*>/)[0],image,field+' selects the same species preview');
      assert(instance.includes('data-species="'+fish.id+'"'));
    }
  }
});

test('advanced catalogue rods keep their live effect theme and independent glow definitions',()=>{
  const Motion=require('../skins/tracer/fishing-motion'),gradients=new Set();
  for(const rod of F.catalog.rods){
    const preview=Art.rodMarkup(rod),profile=Motion.fxProfile(rod);
    assert.equal(/class="[^"]*\bfishing-catalog-fx\b/.test(preview),!!profile,rod.id+' effect availability matches the live rod');
    if(!profile)continue;
    assert(preview.includes('data-fx-theme="'+profile.theme+'"'));
    assert(preview.includes('--rod-glow:'+profile.color));
    for(const markup of [preview,Art.rodMarkup(rod)]){
      const id=markup.match(/<radialGradient id="([^"]+)"/)[1];
      assert(!gradients.has(id),'separate cards have separate glow gradients');gradients.add(id);
    }
  }
  assert.equal(gradients.size,F.catalog.rods.filter(r=>Motion.fxProfile(r)).length*2,'all advanced rods retain effects in repeated previews');
});
