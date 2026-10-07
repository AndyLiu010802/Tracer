'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const policy=require('../dev/desktop-pack-assets.cjs');
const root=path.resolve(__dirname,'..');

test('local installer matcher ships fishing and botanical art while retiring all character runtimes',()=>{
  const {FileMatcher}=require('app-builder-lib/out/fileMatcher.js');
  const config=require('../package.json').build;
  const filter=new FileMatcher(root,'',s=>s,config.files).createFilter();
  const included=file=>filter(path.join(root,file),fs.statSync(path.join(root,file)));
  const assets=policy.verifyAssets(root);
  for(const file of ['pond-decor-v2.png','rods-model-v1.png','fish-model-v1.png','baits-v1.png'])assert(assets.includes('skins/tracer/fishing-art/'+file),'Active fishing atlas is verified: '+file);
  assert.equal(assets.includes('skins/tracer/fishing-art/cabins-v2.png'),false,'Retired cabin artwork is not an active asset');
  for(const file of ['skins/tracer/fishing-aquarium-motion.js','skins/tracer/fishing-aquarium.js','skins/tracer/fishing-aquarium.css'])assert.equal(included(file),true,'Shared aquarium display ships offline: '+file);
  assert(assets.includes('skins/tracer/fishing-lighting.js'),'Shared shadow renderer ships offline');
  assert(assets.includes('skins/tracer/fishing-rod-renderer.js'),'The live 3D rod renderer ships with the offline app');
  const effects=require('../skins/tracer/fishing-rod-effects'),catalog=require('../public/fishing-model').catalog;
  for(const rod of catalog.rods){const file=effects.summonScene(rod.id)?.art;if(file)assert(assets.includes('skins/tracer/fishing-art/'+file),'Summon artwork is verified offline: '+rod.id);}
  for(const file of assets)assert(included(file),'Active garden/fishing asset: '+file);
  for(const file of ['desktop/pet.js','desktop/pet-preload.js','desktop/garden-trail.js','skins/tracer/pet.js','skins/tracer/pet.html','skins/tracer/pet.css','skins/tracer/pet-art/brook-crafting-v1.png','skins/tracer/garden-companion-motion.js','skins/tracer/garden-companion-atlas.js','skins/tracer/garden-wildflower-motion.js','skins/tracer/garden-art/apple-normal-idle-v3-p1.png']){
    if(fs.existsSync(path.join(root,file)))assert.equal(included(file),false,'Retired character asset: '+file);
    assert.equal(policy.omittedRuntime(file),true);
  }
  for(const file of ['skins/tracer/pet-model.js','skins/tracer/pet-animation.js'])assert.equal(included(file),true,'Legacy backup validation remains importable: '+file);
});

test('desktop startup and preload expose fishing without starting the retired pet runtime',()=>{
  const main=fs.readFileSync(path.join(root,'desktop/main.js'),'utf8'),preload=fs.readFileSync(path.join(root,'desktop/preload.js'),'utf8');
  assert(main.includes("require('./fishing').attachFishing"));assert(!main.includes("require('./pet')"));
  assert(!main.includes('Desktop companion'));assert(main.includes('Desktop fishing'));
  assert(preload.includes("exposeInMainWorld('TracerFishing'"));assert(!preload.includes("exposeInMainWorld('TracerPet'"));
});
