'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),retained=new Set(['pet-model.js','pet-animation.js']);
const priorFile=path.join(root,'.cache/fishing-retirement-inventory.json');
if(fs.existsSync(priorFile)){
  const prior=JSON.parse(fs.readFileSync(priorFile,'utf8'));
  if(prior.workspace===root&&prior.files.every(row=>!fs.existsSync(path.join(root,row.path)))){
    console.log(JSON.stringify({retiredFiles:prior.fileCount,allAbsent:true,inventory:'.cache/fishing-retirement-inventory.json'},null,2));process.exit(0);
  }
}
const files=[],roots=[];
function within(file){const relative=path.relative(root,file);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Outside workspace: '+file);return relative.replaceAll('\\','/');}
function add(file){const stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('Refuse link: '+file);if(stat.isDirectory()){roots.push(within(file));for(const name of fs.readdirSync(file))add(path.join(file,name));}else if(stat.isFile())files.push({path:within(file),bytes:stat.size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});}
function select(folder,predicate){for(const name of fs.readdirSync(path.join(root,folder)))if(predicate(name))add(path.join(root,folder,name));}
select('skins/tracer',name=>(name.startsWith('pet')&&!retained.has(name))||name.startsWith('garden-companion')||['garden-wildflower-motion.js','garden-trails.js','companion-inbetweens.js'].includes(name));
select('desktop',name=>name.startsWith('pet')||name.startsWith('garden-trail'));
select('skins/tracer/garden-art',name=>/-(normal|shiny)-.+\.png$|MOTION|COMPANION/.test(name));
select('dev',name=>/(pet|brook|alchemy|painted-companion|companion-|anime-companion|garden-companion|garden-trail)/.test(name));
select('test',name=>(name.startsWith('pet-')&&!['pet-model.test.js','pet-animation.test.js','pet-image.test.js','pet-package.test.js','pet-commercial.test.js'].includes(name))||/^(garden-companion|garden-trail|companion-inbetweens|ai-companion)/.test(name));
select('desktop/test',name=>/^(pet|garden-trail)/.test(name));
add(path.join(root,'lib/ai-companion.js'));
const proposed=new Set(files.map(row=>row.path));
const missingDependencies=[];
// Reachability starts at the shipped main document and Electron/HTTP entry
// points. Only local script/style imports and literal relative Node requires
// are followed; historical backups remain reached through public validators.
const queue=['server.js','desktop/main.js','desktop/preload.js','desktop/fishing.js','desktop/fishing-preload.js','skins/tracer/index.html','skins/tracer/fishing-desktop.html'];
const seen=new Set();
function dependency(owner,spec){let target;if(spec.startsWith('/')){const name=spec.slice(1).split('?')[0];target=fs.existsSync(path.join(root,'skins/tracer',name))?'skins/tracer/'+name:fs.existsSync(path.join(root,'public',name))?'public/'+name:null;}else if(spec.startsWith('.')){const base=path.resolve(root,path.dirname(owner),spec);for(const suffix of ['','.js','.cjs','.json','/index.js'])if(fs.existsSync(base+suffix)){target=within(base+suffix);break;}}if(target)queue.push(target);}
while(queue.length){const file=queue.pop();if(seen.has(file))continue;seen.add(file);if(proposed.has(file))missingDependencies.push(file);if(!/\.(js|cjs|html|css)$/.test(file))continue;const text=fs.readFileSync(path.join(root,file),'utf8');for(const match of text.matchAll(/require\(['"]([^'"]+)['"]\)|<(?:script|link)[^>]*(?:src|href)=["']([^"']+)["']|@import\s+["']([^"']+)["']/g))dependency(file,match[1]||match[2]||match[3]);}
if(missingDependencies.length)throw Error('Deletion would remove reachable modules: '+missingDependencies.join(', '));
const report={format:'tracer-retirement-inventory-v1',workspace:root,reason:'User explicitly requested removal of all unused old character/pet resources. Current desktop/runtime uses fishing.',preserved:['skins/tracer/pet-model.js','skins/tracer/pet-animation.js','lib/pet-image.js','lib/pet-package.js','lib/companion-backup.js','lib/portable-backup.js','lib/workspace-backup.js','public/companion-work.js','skins/tracer/garden-plant-atlas.js','all ordinary garden kind-v2.png and furniture artwork'],entryPoints:seen.size,reachableDeletedFiles:missingDependencies,fileCount:files.length,totalBytes:files.reduce((sum,row)=>sum+row.bytes,0),files,emptyDirectoriesAfterDeletion:roots.sort((a,b)=>b.length-a.length)};
fs.mkdirSync(path.join(root,'.cache'),{recursive:true});fs.writeFileSync(path.join(root,'.cache/fishing-retirement-inventory.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({fileCount:report.fileCount,totalMiB:Math.round(report.totalBytes/1048576),reachableFiles:report.entryPoints,reachableDeletedFiles:report.reachableDeletedFiles,inventory:'.cache/fishing-retirement-inventory.json'},null,2));
