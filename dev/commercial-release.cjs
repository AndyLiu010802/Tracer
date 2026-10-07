'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {COMMERCIAL_MARKER}=require('../desktop/release-profile');
// The model is retained only to validate historical workspace backups. Character
// UI, artwork and desktop runtime are excluded by the common package patterns.
const overlayFiles=['pet-model.js','index.html'];
const desktopOverlayFiles=['main.js','preload.js'];
const commercialExclusions=['!skins/tracer/pet-alchemy*','!skins/tracer/pet-art/alchemy-v1/**','!desktop/local-vfx*.js','!desktop/local-vfx*.html','!desktop/local-vfx*.css','!desktop/local-vfx*.ps1','!skins/tracer/local-vfx/**'];
const localVfxTokens=/local[-_]?vfx|TRACER_LOCAL_VFX/i;
function stripLocalVfxBlocks(name,source){
 const marker=/^[ \t]*(?:\/\/|<!--)[ \t]*TRACER_LOCAL_VFX_(BEGIN|END)(?:[ \t]+([a-z0-9_-]+))?[ \t]*(?:-->)[ \t]*\r?$/gmi;
 const jsMarker=/^[ \t]*\/\/[ \t]*TRACER_LOCAL_VFX_(BEGIN|END)(?:[ \t]+([a-z0-9_-]+))?[ \t]*\r?$/gmi;
 const markers=[...source.matchAll(marker),...source.matchAll(jsMarker)].sort((a,b)=>a.index-b.index);
 let start=null,cursor=0,result='',count=0;
 for(const match of markers){
  if(match[1].toUpperCase()==='BEGIN'){
   assert.equal(start,null,'Nested local VFX block: '+name);start=match;
  }else{
   assert(start,'Unmatched local VFX end marker: '+name);
   assert.equal(match[2]||'',start[2]||'','Mismatched local VFX block labels: '+name);
   result+=source.slice(cursor,start.index);cursor=match.index+match[0].length;
   if(source[cursor]==='\n')cursor++;start=null;count++;
  }
 }
 assert.equal(start,null,'Unclosed local VFX block: '+name);
 assert(count>0,'Reviewed local VFX block is missing: '+name);
 result+=source.slice(cursor);
 assert(!localVfxTokens.test(result),'Local VFX reference survived block removal: '+name);
 return result;
}
function transform(name,source){
 let text=['index.html','desktop/main.js','desktop/preload.js'].includes(name)?stripLocalVfxBlocks(name,source):source;
 function replace(pattern,value,count=1){const hits=text.match(pattern)||[];assert.equal(hits.length,count,'Reviewed release transformation changed: '+name+' / '+pattern);text=text.replace(pattern,value);}
 if(name==='pet-model.js'){
  replace(/^.*\{ id: '(edward|alphonse)'.*\r?\n/gm,'',2);
  replace(/'sprout','edward','alphonse'/g,"'sprout'",2);
 }
 assert(!/edward|alphonse|elric|TracerAlchemy|\/pet-alchemy\.html/i.test(text),'Exclusive character or entry survived: '+name);
 assert(!localVfxTokens.test(text),'Local VFX reference survived: '+name);
 return text;
}
function overlayMappings(output){return [
 {from:output,to:'skins/tracer',filter:[...overlayFiles]},
 {from:path.join(output,'desktop'),to:'desktop',filter:[...desktopOverlayFiles]},
];}
function prepare(projectRoot=root,output=path.join(projectRoot,'.cache/commercial-overlay')){
 fs.mkdirSync(path.join(output,'desktop'),{recursive:true});const records=[];
 // Regenerate only the allowlisted copies; local sources, saves and archives stay intact.
 for(const [prefix,names,destination] of [['skins/tracer',overlayFiles,output],['desktop',desktopOverlayFiles,path.join(output,'desktop')]]){
  for(const name of names){const relative=prefix+'/'+name;const source=fs.readFileSync(path.join(projectRoot,relative),'utf8');const bytes=transform(prefix==='desktop'?relative:name,source);fs.writeFileSync(path.join(destination,name),bytes);records.push({path:relative,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
 }
 return {output,records};
}
function config(projectRoot=root){
 const pkg=JSON.parse(fs.readFileSync(path.join(projectRoot,'package.json'),'utf8'));const output=path.join(projectRoot,'.cache/commercial-overlay');
 return {...pkg.build,extraMetadata:{...pkg.build.extraMetadata,tracerRelease:{...COMMERCIAL_MARKER}},beforePack:path.join(projectRoot,'dev/before-commercial-pack.cjs'),files:[...pkg.build.files,...commercialExclusions,...overlayFiles.map(f=>'!skins/tracer/'+f),...desktopOverlayFiles.map(f=>'!desktop/'+f),...overlayMappings(output)]};
}
function exclusiveFile(file){return /alchemy-v1|pet-alchemy|edward|alphonse|elric/i.test(file)||/^desktop\/local-vfx[^/]*\.(js|html|css|ps1)$/i.test(file)||/^skins\/tracer\/local-vfx\//i.test(file);}
function manifest(projectRoot=root,output){
 const prepared=prepare(projectRoot,output);const cfg=config(projectRoot);
 require('./release-mode.cjs').assertCommercial(cfg,projectRoot);
 const {FileMatcher}=require(path.join(projectRoot,'node_modules/app-builder-lib/out/fileMatcher.js'));
 const included=[],omitted=[];const filter=new FileMatcher(projectRoot,'',s=>s,cfg.files.filter(x=>typeof x==='string')).createFilter();
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('Do not traverse links in release manifest: '+full);if(entry.isDirectory())walk(full);else{const file=path.relative(projectRoot,full).replaceAll('\\','/');(filter(full,fs.statSync(full))?included:omitted).push({file,source:full});}}}
 for(const name of ['server.js','package.json','lib','ai-service','public','skins','desktop']){const full=path.join(projectRoot,name);if(fs.statSync(full).isDirectory())walk(full);else if(filter(full,fs.statSync(full)))included.push({file:name,source:full});}
 for(const mapping of overlayMappings(prepared.output)){
  const mappedFilter=new FileMatcher(mapping.from,'',s=>s,mapping.filter).createFilter();
  function walkOverlay(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const source=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('Do not traverse links in release overlay: '+source);if(entry.isDirectory())walkOverlay(source);else if(mappedFilter(source,fs.statSync(source)))included.push({file:mapping.to+'/'+path.relative(mapping.from,source).replaceAll('\\','/'),source});}}
  walkOverlay(mapping.from);
 }
 const paths=new Set(included.map(x=>x.file));assert.equal(paths.size,included.length,'No duplicate destinations');
 assert(!included.some(x=>exclusiveFile(x.file)),'No local-only files in actual manifest');
 const assetPolicy=require('./desktop-pack-assets.cjs');
 assert(!included.some(x=>assetPolicy.omittedRuntime(x.file)),'Retired character runtime is absent from the actual manifest');
 const assets=assetPolicy.verifyAssets(projectRoot);for(const file of assets)assert(paths.has(file),'Garden or fishing asset retained: '+file);
 for(const {file,source} of included.filter(x=>/\.(js|html|json|css)$/.test(x.file))){const bytes=fs.readFileSync(source,'utf8');assert(!/edward|alphonse|elric|TracerAlchemy|\/pet-alchemy\.html/i.test(bytes),'Exclusive content leaked: '+file);assert(!localVfxTokens.test(bytes),'Local VFX content leaked: '+file);}
 return {kind:'commercial-app-source-manifest',dependencyAndRuntimeResources:'not enumerated; full installer not built',files:included,excludedExclusiveFiles:omitted.filter(x=>/alchemy-v1|pet-alchemy/.test(x.file)).map(x=>x.file),excludedLocalVfxFiles:omitted.filter(x=>/^desktop\/local-vfx|^skins\/tracer\/local-vfx\//.test(x.file)).map(x=>x.file),excludedCharacterFiles:omitted.filter(x=>assetPolicy.omittedRuntime(x.file)).map(x=>x.file),overlays:prepared.records,retainedExperienceAssets:assets.length,retainedAnimationAssets:assets.length};
}
module.exports={prepare,config,manifest,transform,stripLocalVfxBlocks,overlayMappings,overlayFiles,desktopOverlayFiles,commercialExclusions};
if(require.main===module){const result=manifest();fs.writeFileSync(path.join(root,'.cache/commercial-manifest.json'),JSON.stringify(result,null,2));console.log('PASS commercial app-source manifest: '+result.files.length+' files, '+result.retainedExperienceAssets+' garden/fishing assets, '+result.excludedCharacterFiles.length+' retired character files excluded, '+result.excludedLocalVfxFiles.length+' local VFX files excluded');}
