'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const release=require('../dev/commercial-release.cjs');
test('commercial source manifest retires character UI and keeps the garden, fishing and legacy backup validation',()=>{
 const destination=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-commercial-'));const report=release.manifest(path.resolve(__dirname,'..'),destination);
 assert(report.retainedExperienceAssets>=21);
 for(const file of ['desktop/pet.js','skins/tracer/pet.html','skins/tracer/garden-companion-motion.js'])assert(!report.files.some(row=>row.file===file));
 assert(report.files.some(f=>f.file==='desktop/fishing.js'));
 assert(report.files.some(f=>f.file==='skins/tracer/fishing-art.js'));
 assert(report.files.every(f=>!/(alchemy-v1|pet-alchemy|edward|alphonse|elric)/i.test(f.file)));
 const vm=require('node:vm'),ctx={TracerPetAnimation:require('../skins/tracer/pet-animation.js')};ctx.self=ctx;vm.runInNewContext(fs.readFileSync(path.join(destination,'pet-model.js'),'utf8'),ctx);const M=ctx.TracerPetModel;
 assert.equal(M.pets.length,6);assert(!M.pets.some(p=>p.alchemy));
 const custom={id:'custom_'+ 'a'.repeat(32),name:'My companion',kind:'creature',image:'/api/pet-art/'+ 'a'.repeat(32)+'.png'};
 const raw={...M.fresh(),selected:custom.id,customs:[custom],unlocked:['garden_neon_orchid_shiny',custom.id],pets:{}};
 const state=M.read(raw);assert.equal(state.selected,custom.id);assert(M.catalog(state).some(p=>p.id==='garden_neon_orchid_shiny'));assert(M.catalog(state).some(p=>p.id===custom.id));
 const local=require('../skins/tracer/pet-model.js');assert(local.pets.some(p=>p.id==='edward'));assert(local.pets.some(p=>p.id==='alphonse'));
 assert.throws(()=>release.transform('pet-model.js','unreviewed upstream source'));
});

test('default direct packager fails closed; explicit personal builds and commercial overlays are distinct',()=>{
 const root=path.resolve(__dirname,'..'),guard=require('../dev/release-mode.cjs'),pkg=require('../package.json');
 assert.throws(()=>guard.assertBuildMode(pkg.build,root,{}),/Commercial build/);
 assert.equal(guard.assertBuildMode(pkg.build,root,{TRACER_LOCAL_BUILD:'1'}),'local-only');
 const config=release.config(root);assert.equal(guard.assertBuildMode(config,root,{}),'commercial');
 const normalized={...config,files:[{filter:config.files.filter(e=>typeof e==='string')},...config.files.filter(e=>typeof e==='object')]};assert.equal(guard.assertBuildMode(normalized,root,{}),'commercial');
 assert(pkg.scripts.dist.includes('desktop-commercial.config'));assert(pkg.scripts['dist:local'].includes('build-local'));
});
