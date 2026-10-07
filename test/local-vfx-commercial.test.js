'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const release=require('../dev/commercial-release.cjs'),guard=require('../dev/release-mode.cjs');
const root=path.resolve(__dirname,'..');

test('local VFX block removal preserves normal source around multiple JS and HTML blocks',()=>{
 const source='const normal = 1;\n// TRACER_LOCAL_VFX_BEGIN\nconst localVfx = require("./local-vfx");\n// TRACER_LOCAL_VFX_END\nconst rare = 2;\n// TRACER_LOCAL_VFX_BEGIN menu\nlocalVfx.open();\n// TRACER_LOCAL_VFX_END menu\nconst custom = 3;\n';
 const result=release.stripLocalVfxBlocks('desktop/main.js',source);
 assert.equal(result,'const normal = 1;\nconst rare = 2;\nconst custom = 3;\n');new vm.Script(result);
 const html='<main>Normal</main>\r\n<!-- TRACER_LOCAL_VFX_BEGIN -->\r\n<script src="/local-vfx/demo.js"></script>\r\n<!-- TRACER_LOCAL_VFX_END -->\r\n<footer>Custom</footer>\r\n';
 assert.equal(release.stripLocalVfxBlocks('index.html',html),'<main>Normal</main>\r\n<footer>Custom</footer>\r\n');
});

test('local VFX transforms reject missing, nested, unmatched or outside-block references',()=>{
 for(const source of ['plain source','// TRACER_LOCAL_VFX_BEGIN\nlocalVfx();', '// TRACER_LOCAL_VFX_END\n',
  '// TRACER_LOCAL_VFX_BEGIN\n// TRACER_LOCAL_VFX_BEGIN\n// TRACER_LOCAL_VFX_END\n// TRACER_LOCAL_VFX_END\n',
  '// TRACER_LOCAL_VFX_BEGIN one\n// TRACER_LOCAL_VFX_END two\n',
  '// TRACER_LOCAL_VFX_BEGIN\nlocalVfx();\n// TRACER_LOCAL_VFX_END\nrequire("./local-vfx");\n']){
  assert.throws(()=>release.stripLocalVfxBlocks('desktop/main.js',source));
 }
 assert.throws(()=>release.transform('desktop/preload.js','normal source'),/missing/);
});

test('commercial guards require VFX exclusions, both desktop replacements and strict overlay allowlists',()=>{
 const config=release.config(root);
 assert.equal(guard.assertBuildMode(config,root,{}),'commercial');
 for(const exclusion of ['!desktop/local-vfx*.js','!desktop/local-vfx*.html','!desktop/local-vfx*.css','!desktop/local-vfx*.ps1','!skins/tracer/local-vfx/**','!desktop/main.js','!desktop/preload.js']){
  assert.throws(()=>guard.assertBuildMode({...config,files:config.files.filter(entry=>entry!==exclusion)},root,{}),/exclude local-only content/);
 }
 const mapping=config.files.find(entry=>typeof entry==='object'&&entry.to==='desktop');
 assert.deepEqual(mapping.filter,['main.js','preload.js']);
 assert.throws(()=>guard.assertBuildMode({...config,files:config.files.filter(entry=>entry!==mapping)},root,{}),/replacement mappings/);
 assert.throws(()=>guard.assertBuildMode({...config,files:config.files.map(entry=>entry===mapping?{...entry,filter:['**/*']}:entry)},root,{}),/mapping changed/);
 assert.throws(()=>guard.assertBuildMode({...config,files:[...config.files,{from:path.join(root,'desktop'),to:'desktop',filter:['local-vfx*.js']}]},root,{}),/replacement mappings/);
 assert.throws(()=>guard.assertBuildMode({...config,files:[...config.files,{filter:['**/*']}]},root,{}),/unreviewed root file mappings/);
 assert.throws(()=>guard.assertBuildMode({...config,files:[...config.files,'desktop/local-vfx-art.js']},root,{}),/reviewed root pattern order/);
 assert.throws(()=>guard.assertBuildMode({...config,extraResources:[...config.extraResources,{from:'desktop',to:'desktop',filter:['local-vfx*']}]},root,{}),/resource mapping changed/);
 assert.throws(()=>guard.assertBuildMode({...config,win:{...config.win,files:['desktop/local-vfx-art.js']}},root,{}),/platform file mapping changed/);
 const normalized={...config,files:[{filter:config.files.filter(entry=>typeof entry==='string')},...config.files.filter(entry=>typeof entry==='object')]};
 assert.equal(guard.assertBuildMode(normalized,root,{}),'commercial');
 const builderNormalized=require(path.join(root,'node_modules/app-builder-lib/out/util/config/config.js')).doMergeConfigs([release.config(root)]);
 assert.equal(guard.assertBuildMode(builderNormalized,root,{}),'commercial','installed builder normalization stays compatible');
 builderNormalized.files.find(entry=>!entry.from&&!entry.to).filter.push('desktop/local-vfx-art.js');
 assert.throws(()=>guard.assertBuildMode(builderNormalized,root,{}),/reviewed root pattern order/);
});

test('actual FileMatcher manifest strips VFX entry points, ignores stale staging files and retains garden and fishing',t=>{
 const destination=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-vfx-commercial-'));
 t.after(()=>{
  const resolved=path.resolve(destination);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));
  assert(path.basename(resolved).startsWith('tracer-vfx-commercial-'));fs.rmSync(resolved,{recursive:true,force:true});
 });
 fs.mkdirSync(path.join(destination,'desktop'));fs.writeFileSync(path.join(destination,'local-vfx-stale.js'),'localVfx();');
 fs.writeFileSync(path.join(destination,'desktop','local-vfx-stale.js'),'localVfx();');
 const report=release.manifest(root,destination);
 const byPath=new Map(report.files.map(entry=>[entry.file,entry]));
 assert(report.retainedExperienceAssets>=21);
 assert(!report.files.some(entry=>/local-vfx/i.test(entry.file)));
 assert(report.excludedLocalVfxFiles.includes('desktop/local-vfx-shell-registry.js'));
 assert(report.excludedLocalVfxFiles.includes('desktop/local-vfx-shell-registry.ps1'));
 for(const name of ['local-vfx-placement.js','local-vfx-placement.html','local-vfx-placement.css','local-vfx-placement-preload.js','local-vfx-placement-renderer.js']){assert(report.excludedLocalVfxFiles.includes('desktop/'+name));assert(!byPath.has('desktop/'+name));}
 for(const name of ['main.js','preload.js']){
  const entry=byPath.get('desktop/'+name);assert(entry,'desktop replacement exists: '+name);
  assert.equal(entry.source,path.join(destination,'desktop',name));
  const source=fs.readFileSync(entry.source,'utf8');assert(!/local[-_]?vfx|TRACER_LOCAL_VFX/i.test(source));new vm.Script(source);
 }
 assert.equal(byPath.get('skins/tracer/index.html').source,path.join(destination,'index.html'));
 assert(!report.files.some(entry=>entry.file.startsWith('skins/tracer/desktop/')));
 const modelContext={TracerPetAnimation:require('../skins/tracer/pet-animation.js')};modelContext.self=modelContext;
 vm.runInNewContext(fs.readFileSync(byPath.get('skins/tracer/pet-model.js').source,'utf8'),modelContext);
 const model=modelContext.TracerPetModel;assert.equal(model.pets.length,6);
 const id='custom_'+ 'a'.repeat(32),custom={id,name:'Synthetic custom',kind:'creature',image:'/api/pet-art/'+ 'a'.repeat(32)+'.png'};
 const state=model.read({...model.fresh(),selected:id,customs:[custom],unlocked:['garden_neon_orchid_shiny',id]});
 assert.equal(state.selected,id);assert(model.catalog(state).some(entry=>entry.id==='garden_neon_orchid_shiny'));assert(model.catalog(state).some(entry=>entry.id===id));
 assert(require('../skins/tracer/pet-model.js').pets.some(entry=>entry.id==='edward'),'personal local catalog preserved');
});
