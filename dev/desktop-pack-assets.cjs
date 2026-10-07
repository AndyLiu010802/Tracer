'use strict';
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
// Only the two data validators remain for reading legacy character backups.
// Runtime and artwork have been retired from the fishing experience.
const excludedPatterns=[
  '!skins/tracer/garden-art/*-normal-*-v2.png',
  '!skins/tracer/garden-art/*-shiny-*-v2.png',
  '!skins/tracer/pet-art/*-v1.png',
  '!skins/tracer/pet-art/anime-v1/*-draft.png',
  '!desktop/pet*', '!desktop/garden-trail*', '!skins/tracer/pet*', '!skins/tracer/pet-art/**',
  '!skins/tracer/garden-companion*', '!skins/tracer/garden-wildflower-motion.js', '!skins/tracer/garden-trails.js',
  '!skins/tracer/garden-wildflower-atlas.js',
  '!skins/tracer/companion-inbetweens.js', '!skins/tracer/garden-art/*-normal-*.png', '!skins/tracer/garden-art/*-shiny-*.png'
];
function omittedArt(file){return /^skins\/tracer\/garden-art\/[^/]+-(normal|shiny)-[^/]+\.png$/.test(file)||/^skins\/tracer\/pet-art\//.test(file);}
function omittedRuntime(file){return omittedArt(file)||/^desktop\/(pet|garden-trail)/.test(file)||(/^skins\/tracer\/pet/.test(file)&&!['skins/tracer/pet-model.js','skins/tracer/pet-animation.js'].includes(file))||/^skins\/tracer\/(garden-companion|garden-wildflower-(motion|atlas)|garden-trails|companion-inbetweens)/.test(file);}
function verifyAssets(root){
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  for(const pattern of excludedPatterns)assert.ok(pkg.build.files.includes(pattern),'Packaging must exclude the retired character runtime: '+pattern);
  const sources=new Set();
  const plants=require(path.join(root,'skins/tracer/garden-plant-atlas.js'));
  for(const kind of Object.keys(plants))sources.add('skins/tracer/garden-art/'+kind+'-v2.png');
  for(const file of ['fishing-model.js','fishing-lighting.js','fishing-art.js','fishing-rod-effects.js','fishing-motion.js','fishing-rod-renderer.js','fishing-game.js','fishing-scene.css','fishing-tackle.js','fishing-tackle.css','fishing-view.js','fishing.js','fishing.css','fishing-desktop.html','fishing-desktop.js','fishing-desktop.css'])sources.add('skins/tracer/'+file);
  for(const file of ['fishing.js','fishing-preload.js','fishing-aquarium.js','fishing-aquarium-preload.js'])sources.add('desktop/'+file);
  for(const file of ['fishing-aquarium-motion.js','fishing-aquarium.js','fishing-aquarium.css','fishing-aquarium-desktop.html','fishing-aquarium-desktop.js','fishing-aquarium-desktop.css'])sources.add('skins/tracer/'+file);
  sources.add('skins/tracer/fishing-art/pond-decor-v2.png');
  sources.add('skins/tracer/fishing-art/rods-model-v1.png');
  sources.add('skins/tracer/fishing-art/fish-model-v1.png');
  sources.add('skins/tracer/fishing-art/baits-v1.png');
  sources.add('skins/tracer/fishing-art/bite-hooked-gold-v1.png');
  for(const file of ['fishing-rewards.js','fishing-rewards.css'])sources.add('skins/tracer/'+file);
  for(const id of ['tide_crown','moon_jelly','dragon_seal','sunken_library','cloud_koi_garden','starlit_harbor'])sources.add('skins/tracer/fishing-art/gift-'+id+'-v1.png');
  for(const id of ['boots','broken_watch','trash_bag','mystery_bundle'])sources.add('skins/tracer/fishing-art/catch-'+id+'-v1.png');
  sources.add('skins/tracer/fishing-art/golden-caishen-v1.png');
  sources.add('skins/tracer/fishing-art/summon-azure-dragon-v1.png');
  sources.add('skins/tracer/fishing-art/summon-phoenix-v1.png');
  sources.add('skins/tracer/fishing-art/summon-ashura-v2.png');
  for(const id of ['candlewyrm','abysswhale','foxfire','frostwolf','inkjudge','leviathan','thunderdrum','sandscript','lilybell','rosevow','butterfly','sunforge'])sources.add('skins/tracer/fishing-art/summon-'+id+'-v1.png');
  assert.ok(sources.size>9,'Garden and fishing assets are available');
  for(const file of sources){assert.equal(omittedRuntime(file),false,'Active garden or fishing asset must remain in the package: '+file);assert.ok(fs.existsSync(path.join(root,file)),'Active garden or fishing asset exists: '+file);}
  return [...sources];
}
module.exports={excludedPatterns,omittedArt,omittedRuntime,verifyAssets};
if(require.main===module)console.log('PASS all '+verifyAssets(path.resolve(__dirname,'..')).length+' garden and fishing assets are retained');
