'use strict';
// Deterministic wiring; artwork itself comes exclusively from built-in image_gen.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
function edit(file,pairs){let s=fs.readFileSync(path.join(root,file),'utf8');for(const [a,b]of pairs){if(s.includes(b))continue;if(!s.includes(a))throw Error('Missing anchor '+file+' '+a);s=s.replaceAll(a,b);}fs.writeFileSync(path.join(root,file),s);}
edit('dev/build-fishing-catalog-art.cjs',[
 ["await page.evaluate(()=>TracerFishingOnePiecePainted.preload(document));","await page.evaluate(()=>Promise.all([TracerFishingOnePiecePainted.preload(document),TracerFishingNarutoPainted.preload(document)]));"],
 ["'skins/tracer/fishing-onepiece-painted.js','skins/tracer/fishing-onepiece-rods.js',","'skins/tracer/fishing-onepiece-painted.js','skins/tracer/fishing-naruto-painted.js','skins/tracer/fishing-onepiece-rods.js',"],
 ["const paintedAssets=require('../skins/tracer/fishing-onepiece-painted').assets;","const paintedAssets={...require('../skins/tracer/fishing-onepiece-painted').assets,...require('../skins/tracer/fishing-naruto-painted').assets};"],
 ['<script src="/fishing-onepiece-painted.js"></script>','<script src="/fishing-onepiece-painted.js"></script><script src="/fishing-naruto-painted.js"></script>'],
 ["  ['/fishing-onepiece-painted.js', sourceContents.get('skins/tracer/fishing-onepiece-painted.js')],","  ['/fishing-onepiece-painted.js', sourceContents.get('skins/tracer/fishing-onepiece-painted.js')],\n  ['/fishing-naruto-painted.js', sourceContents.get('skins/tracer/fishing-naruto-painted.js')],"]
]);
for(const file of ['dev/qa-fishing-painted-regression.cjs'])edit(file,[["'fishing-onepiece-painted','fishing-onepiece-rods'","'fishing-onepiece-painted','fishing-naruto-painted','fishing-naruto-vfx','fishing-onepiece-rods'"]]);
edit('dev/qa-fishing-painted-regression.cjs',[["assert.equal(row.geometry,row.id.startsWith('anime_')&&row.id!=='anime_naruto'?'painted-flex':'mesh3d')","assert.equal(row.geometry,row.id.startsWith('anime_')?'painted-flex':'mesh3d')"]]);
edit('test/fishing-anime-upgrade.test.js',[
 ['freshRods.length,75','freshRods.length,90'],['F.catalog.rods.length,208','F.catalog.rods.length,223'],
 ["pool.rodIds.length,id==='naruto'?29:44","pool.rodIds.length,44"],
 ['seventy-five rod meshes','ninety rod meshes'],['signatures.size,75','signatures.size,90']
]);
edit('test/fishing-onepiece-expansion.test.js',[["r.collection==='naruto').length,30","r.collection==='naruto').length,45"]]);
edit('test/fishing-naruto-refinement.test.js',[['rods.length,30','rods.length,45'],['count,38','count,45']]);
edit('test/fishing-catalog-art.test.js',[
 ["Object.values(require('../skins/tracer/fishing-onepiece-painted').assets)","[...Object.values(require('../skins/tracer/fishing-onepiece-painted').assets),...Object.values(require('../skins/tracer/fishing-naruto-painted').assets)]"],
 ["'skins/tracer/fishing-onepiece-painted.js','skins/tracer/fishing-onepiece-rods.js'","'skins/tracer/fishing-onepiece-painted.js','skins/tracer/fishing-naruto-painted.js','skins/tracer/fishing-onepiece-rods.js'"]
]);
// Same live renderer QA as the other painted collection, including both fallbacks.
let qa=fs.readFileSync(path.join(root,'dev/qa-fishing-onepiece-cel.cjs'),'utf8')
 .replaceAll('fishing-onepiece-cel','fishing-naruto-cel')
 .replace("r.collection==='onepiece'","r.collection==='naruto'")
 .replace("['anime_luffy','anime_zoro','anime_mihawk']","['anime_naruto','anime_sasuke','anime_minato','anime_kakashi']")
 .replace("'fishing-onepiece-painted','fishing-onepiece-rods'","'fishing-onepiece-painted','fishing-naruto-painted','fishing-onepiece-rods'")
 .replaceAll('TracerFishingOnePiecePainted','TracerFishingNarutoPainted')
 .replaceAll('rod-onepiece-','rod-naruto-').replaceAll('海贼王','火影忍者')
 .replace('索隆采用三把完整直刀，鹰眼采用完整黑刀夜；','佐助、草薙剑、斩首大刀、鲛肌与三月镰使用完整武器；');
fs.writeFileSync(path.join(root,'dev/qa-fishing-naruto-cel.cjs'),qa);
console.log('Naruto painted assets and QA wired');
