'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Art=require('../skins/tracer/fishing-art'),F=require('../public/fishing-model');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'skins/tracer/fishing-art');
const manifest=()=>JSON.parse(fs.readFileSync(path.join(folder,'catalog-model-v1.json'),'utf8'));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('catalog previews stay current with their shared live models and renderer',()=>{
  const {sources}=manifest();
  for(const a of [...Object.values(require('../skins/tracer/fishing-basic-painted').assets),...Object.values(require('../skins/tracer/fishing-onepiece-painted').assets),...Object.values(require('../skins/tracer/fishing-naruto-painted').assets),...Object.values(require('../skins/tracer/fishing-valorant-painted').assets)]){const file='skins/tracer'+a.src;assert.equal(sources[file],digest(fs.readFileSync(path.join(root,file))),file+' painted art changed: rebuild catalogue');}
  for(const file of ['skins/tracer/fishing-lighting.js','skins/tracer/fishing-aquatic-renderer.js','skins/tracer/fishing-crafted-rods.js','skins/tracer/fishing-basic-painted.js','skins/tracer/fishing-onepiece-painted.js','skins/tracer/fishing-naruto-painted.js','skins/tracer/fishing-valorant-painted.js','skins/tracer/fishing-onepiece-rods.js','skins/tracer/fishing-anime-rods.js','skins/tracer/fishing-art.js','skins/tracer/fishing-rod-renderer.js','public/fishing-model.js','dev/build-fishing-catalog-art.cjs']){
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

test('rod previews and illustrated fish instances resolve their matching atlas',()=>{
  for(const [index,rod]of F.catalog.rods.entries()){
    const markup=Art.rodMarkup(rod),image=markup.match(/<image\b[^>]*>/)[0];assert(markup.includes('/fishing-art/rods-model-v1.png'));assert(markup.includes('data-rod-id="'+rod.id+'"'));
    // An unknown sprite silently selects bamboo, while retaining the requested
    // data-rod-id. Check the real crop so new pool entries cannot do that.
    assert(image.includes(' x="'+(-(index%10)*300)+'"'),rod.id+' has the correct atlas column');
    assert(image.includes(' y="'+(-Math.floor(index/10)*500)+'"'),rod.id+' has the correct atlas row');
    assert(image.includes(' height="'+Math.ceil(F.catalog.rods.length/10)*500+'"'),rod.id+' uses the complete atlas');
  }
  for(const fish of F.catalog.fish){
    const markup=Art.fishMarkup(fish),paint=require('../skins/tracer/fishing-species-painted').assets[fish.id];assert(paint,fish.id+' has its own illustration');assert(markup.includes(paint.src));assert(markup.includes('data-fish-art="imagegen"'));assert(markup.includes('data-species="'+fish.id+'"'));
    const image=markup.match(/<image\b[^>]*>/)[0];
    for(const field of ['fishId','speciesId']){
      const instance=Art.fishMarkup({id:'fish_instance_42',[field]:fish.id});
      assert.equal(instance.match(/<image\b[^>]*>/)[0],image,field+' selects the same species preview');
      assert(instance.includes('data-species="'+fish.id+'"'));
    }
  }
});

test('advanced catalogue rods retain their live theme, solid painted legends and independent lower-tier glows',()=>{
  const Motion=require('../skins/tracer/fishing-motion'),Effects=require('../skins/tracer/fishing-rod-effects'),gradients=new Set();let glowing=0;
  for(const rod of F.catalog.rods){
    const preview=Art.rodMarkup(rod),profile=Motion.fxProfile(rod);
    const hasAmbient=!!profile&&!(Effects.hasPainted?.(rod.id)&&!Effects.design(rod.id));
    assert.equal(/class="[^"]*\bfishing-catalog-fx\b/.test(preview),hasAmbient,rod.id+' ambient effect availability matches the live rod');
    if(!hasAmbient)continue;
    assert(preview.includes('data-fx-theme="'+profile.theme+'"'));
    if(rod.rarity==='legendary'){
      assert(preview.includes('data-prestige-art="imagegen"'));
      assert(preview.includes('/fishing-art/orbit-prestige-'+rod.id+'-v2.png'));
      assert(!preview.includes('<radialGradient'),'solid legendary subjects do not inherit a translucent aura');
      assert(preview.includes('fishing-prestige-orbit'));
      continue;
    }
    glowing++;
    assert(preview.includes('--rod-glow:'+profile.color));
    for(const markup of [preview,Art.rodMarkup(rod)]){
      const id=markup.match(/<radialGradient id="([^"]+)"/)[1];
      assert(!gradients.has(id),'separate cards have separate glow gradients');gradients.add(id);
    }
  }
  assert.equal(gradients.size,glowing*2,'all advanced rods retain effects in repeated previews');
});

test('resident portraits reflect their own growth while journal species keep their catalogue frame',()=>{
  const species=F.catalog.fish.find(f=>f.id==='bluebetta'),fry=Art.fishMarkup({...species,id:'resident',fishId:species.id,growth:0}),adult=Art.fishMarkup({...species,id:'resident',fishId:species.id,growth:100});
  assert(fry.includes('data-growth-stage="fry"'));assert(adult.includes('data-growth-stage="adult"'));assert(!fry.includes('fishing-mature-form'));assert(adult.includes('fishing-mature-form'));assert(!Art.fishMarkup(species).includes('data-growth-stage'));
  for(const markup of [fry,adult])assert.equal((markup.match(/<g[ >]/g)||[]).length,(markup.match(/<\/g>/g)||[]).length,'growth wrappers remain balanced');
});
