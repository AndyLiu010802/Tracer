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
  for(const id of ['earthworm','dough','prawn','cutbait','lotusmeal'])sources.add('skins/tracer/fishing-art/bait-'+id+'-v2.png');
  for(const file of ['fishing-basic-painted.js','fishing-onepiece-painted.js','fishing-naruto-painted.js','fishing-vfx-tween.js','fishing-vfx-tween-worker.js','fishing-vfx-inbetweens.js','fishing-naruto-vfx.js','fishing-valorant-painted.js','fishing-valorant-vfx.js','fishing-painted-vfx.js','fishing-relic-painted.js','fishing-relic-vfx.js','fishing-onepiece-vfx.js','fishing-onepiece-rods.js','fishing-anime-rods.js','fishing-anime-effects.js','fishing-expansion-effects.js','fishing-aquatic-renderer.js','fishing-crafted-rods.js','fishing-model.js','fishing-lighting.js','fishing-art.js','fishing-species-live.js','fishing-rod-effects.js','fishing-journey-effects.js','fishing-spell-effects.js','fishing-motion.js','fishing-rod-renderer.js','fishing-scene.css','fishing-tackle.js','fishing-tackle.css','fishing-weather.js','fishing-view.js','fishing.js','fishing.css','fishing-desktop.html','fishing-desktop.js','fishing-desktop.css','fishing-bait-desktop.html','fishing-bait-desktop.css','fishing-bait-desktop.js'])sources.add('skins/tracer/'+file);
  for(const file of ['fishing.js','fishing-preload.js','fishing-bait.js','fishing-bait-preload.js','fishing-aquarium.js','fishing-aquarium-preload.js'])sources.add('desktop/'+file);
  for(const file of ['fishing-aquarium-motion.js','fishing-aquarium.js','fishing-aquarium.css','fishing-aquarium-desktop.html','fishing-aquarium-desktop.js','fishing-aquarium-desktop.css'])sources.add('skins/tracer/'+file);
  sources.add('skins/tracer/fishing-pond-skins.js');
  for(const s of require('../skins/tracer/fishing-pond-skins').catalog){sources.add('skins/tracer'+s.bank);sources.add('skins/tracer'+s.box);sources.add('skins/tracer'+s.preview);for(const ext of ['json','bin'])sources.add('skins/tracer/fishing-art/pond-skin-'+s.id+'-scene-v1.'+ext);}
  sources.add('skins/tracer/fishing-prestige.js');
  sources.add('skins/tracer/fishing-orbit-art.js');sources.add('skins/tracer/fishing-orbit-renderer.js');
  for(const rod of require('../public/fishing-model').catalog.rods.filter(r=>r.rarity==='legendary'))sources.add('skins/tracer/fishing-art/orbit-prestige-'+rod.id+'-v2.png');
  for(const t of Object.values(require('../skins/tracer/fishing-prestige').themes))sources.add('skins/tracer'+t.src);
  sources.add('skins/tracer/fishing-art/pond-decor-v2.png');
  sources.add('skins/tracer/fishing-art/rods-model-v1.png');
  for(const a of [...Object.values(require('../skins/tracer/fishing-basic-painted').assets),...Object.values(require('../skins/tracer/fishing-onepiece-painted').assets),...Object.values(require('../skins/tracer/fishing-naruto-painted').assets),...Object.values(require('../skins/tracer/fishing-naruto-vfx').specs),...Object.values(require('../skins/tracer/fishing-valorant-painted').assets),...Object.values(require('../skins/tracer/fishing-valorant-vfx').specs),...Object.values(require('../skins/tracer/fishing-relic-painted').assets),...Object.values(require('../skins/tracer/fishing-relic-vfx').specs),...Object.values(require('../skins/tracer/fishing-onepiece-vfx').specs)])sources.add('skins/tracer'+a.src);
  sources.add('skins/tracer/fishing-art/fish-model-v1.png');
  sources.add('skins/tracer/fishing-species-painted.js');
  for(const a of Object.values(require('../skins/tracer/fishing-species-painted').assets))sources.add('skins/tracer'+a.src.split('?')[0]);
  sources.add('skins/tracer/fishing-art/baits-v1.png');
  sources.add('skins/tracer/fishing-art/bite-hooked-gold-v1.png');
  for(const file of ['fishing-rewards.js','fishing-rewards.css'])sources.add('skins/tracer/'+file);
  for(const id of ['tide_crown','moon_jelly','dragon_seal','sunken_library','cloud_koi_garden','starlit_harbor'])sources.add('skins/tracer/fishing-art/gift-'+id+'-v1.png');
  for(const id of ['boots','broken_watch','trash_bag','mystery_bundle'])sources.add('skins/tracer/fishing-art/catch-'+id+'-v1.png');
  sources.add('skins/tracer/fishing-art/gift-auto_fishing_motor-v1.png');
  sources.add('skins/tracer/fishing-art/golden-caishen-v1.png');
  sources.add('skins/tracer/fishing-art/summon-azure-dragon-v1.png');
  sources.add('skins/tracer/fishing-art/summon-phoenix-v1.png');
  sources.add('skins/tracer/fishing-art/summon-ashura-v2.png');
  for(const id of ['candlewyrm','abysswhale','foxfire','frostwolf','inkjudge','leviathan','thunderdrum','sandscript','lilybell','rosevow','butterfly','sunforge'])sources.add('skins/tracer/fishing-art/summon-'+id+'-v1.png');
  for(const id of ['whitedragon','kasaya','windfan','redboy','jadebottle','demonmirror','goldenbell','sevenstars','gourd','lotuswheel','ruyi','erlang','wukong'])sources.add('skins/tracer/fishing-art/summon-journey-'+id+'-v1.png');
  sources.add('skins/tracer/fishing-art/summon-journey-ruyi-v2.png');
  for(const r of require('../public/fishing-model').catalog.rods.filter(r=>r.expansion===2&&r.apparition))sources.add('skins/tracer/fishing-art/summon-expansion-'+r.id+'-v1.png');
  assert.ok(sources.size>9,'Garden and fishing assets are available');
  for(const file of sources){assert.equal(omittedRuntime(file),false,'Active garden or fishing asset must remain in the package: '+file);assert.ok(fs.existsSync(path.join(root,file)),'Active garden or fishing asset exists: '+file);}
  return [...sources];
}
module.exports={excludedPatterns,omittedArt,omittedRuntime,verifyAssets};
if(require.main===module)console.log('PASS all '+verifyAssets(path.resolve(__dirname,'..')).length+' garden and fishing assets are retained');
