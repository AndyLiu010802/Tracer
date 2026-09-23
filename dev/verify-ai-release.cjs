'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'..');
function runtimeFiles(folder){
 const result=[];
 for(const entry of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){
  const file=folder+'/'+entry.name;
  if(/^desktop\/(test|node_modules)(\/|$)/.test(file)||['desktop/package-lock.json','desktop/README.md'].includes(file)||/\.(bak|log)$/.test(file))continue;
  if(entry.isDirectory())result.push(...runtimeFiles(file));else if(entry.isFile())result.push(file);
 }
 return result;
}
(async()=>{
 const version=require('../package.json').version;
 const archive=path.resolve(process.argv[2]||path.join(root,'dist','win-unpacked','resources','app.asar')),files=asar.listPackage(archive),bad=files.filter(f=>/(^|[\\/])(workspace\.json|bookmarks\.json|accounts\.json|connection\.json|local\.config\.json|\.env|\.cache|personal\.json|output)([\\/]|$)/.test(f));assert.deepEqual(bad,[],'No personal data or cloud credentials in installer');
 assert.deepEqual(files.filter(f=>f.replaceAll('\\','/').includes('/ai-service/')&&!f.replaceAll('\\','/').endsWith('/ai-service/provider.js')),[]); const pkg=JSON.parse(asar.extractFile(archive,'package.json'));assert.equal(pkg.version,version);
 const runtimeSources=['server.js','ai-service/provider.js',...['desktop','lib','public','skins'].flatMap(runtimeFiles)];
 for(const file of runtimeSources)assert.ok(asar.extractFile(archive,file.split('/').join(path.sep)).equals(fs.readFileSync(path.join(root,file))),file+' matches release source and assets');
 for(const file of ['lib/ai-codex.js','lib/ai-personal.js','lib/ai-gateway.js','ai-service/provider.js','public/ai-planner.js','public/tracer-logo.png','lib/ai-extract-worker.js','skins/tracer/ai-assistant.js','skins/tracer/ai-assistant.css','desktop/assets/app-icon.png','desktop/main.js','desktop/preload.js','desktop/window-controls.js','skins/tracer/window-controls.js','skins/tracer/window-controls.css','skins/tracer/wellness.css','skins/tracer/index.html','skins/tracer/notes.js','skins/tracer/notes.css'])assert.ok(asar.extractFile(archive,file.split('/').join(path.sep)).equals(fs.readFileSync(path.join(root,file))),file+' matches source');
 const runtime=path.join(path.dirname(archive),'codex'),spec=require('../build/codex-runtime.json');
 for(const [name,hash] of Object.entries(spec.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(runtime,name))).digest('hex'),hash,'Official runtime '+name);
 const allowed=new Set([...Object.keys(spec.files),'codex-LICENSE.txt','codex-NOTICE.txt']);
 function walk(dir,base=''){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const name=base+f.name;if(f.isDirectory())walk(path.join(dir,f.name),name+'/');else assert.ok(allowed.has(name),'Unexpected bundled runtime file '+name);}}walk(runtime);
 for(const name of ['codex-LICENSE.txt','codex-NOTICE.txt'])assert.ok(fs.readFileSync(path.join(runtime,name)).equals(fs.readFileSync(path.join(root,'build',name))));
 for(const file of ['server.js','lib/pet-package.js','lib/pet-image.js','desktop/pet.js','desktop/pet-preload.js','skins/tracer/pet-animation.js','skins/tracer/pet-builtin-animation.js','skins/tracer/pet-art.js','skins/tracer/pet-character-motion.css','skins/tracer/pet-idle.js','skins/tracer/pet-model.js','skins/tracer/pet-view.js','skins/tracer/pet-creator.js','skins/tracer/pet-transfer.js','skins/tracer/pet-transfer.css','skins/tracer/pet-desktop.css','skins/tracer/pet.js','skins/tracer/pet.html','skins/tracer/skin.css'])assert.ok(asar.extractFile(archive,file.split('/').join(path.sep)).equals(fs.readFileSync(path.join(root,file))),file+' matches source');
 for(const file of ['lib/pet-generation-jobs.js','skins/tracer/pet-generation-draft.js','skins/tracer/pet-edit-draft.js','skins/tracer/pet.css'])assert.ok(asar.extractFile(archive,file.split('/').join(path.sep)).equals(fs.readFileSync(path.join(root,file))),file+' matches source');
 for(const file of ['lib/ai-companion.js','public/companion-work.js','public/workspace-sync.js','skins/tracer/app.js','skins/tracer/pet-chat-state.js','skins/tracer/pet-chat.css','skins/tracer/pet-window.js'])assert.ok(asar.extractFile(archive,file.split('/').join(path.sep)).equals(fs.readFileSync(path.join(root,file))),file+' matches source');
 assert.deepEqual(files.filter(file=>/(^|[\\/])wechat([\\/]|$)|[\\/]lib[\\/]cloud-sync\.js$|[\\/]skins[\\/]tracer[\\/]sync-ui\.js$/.test(file)),[],'Retired WeChat code is absent from the installer');
 const distribution=path.dirname(path.dirname(path.dirname(archive)));
 const sums=['Tracer-Setup-'+version+'-x64.exe'].map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(distribution,name))).digest('hex')+'  '+name);fs.writeFileSync(path.join(distribution,'SHA256SUMS-'+version+'.txt'),sums.join('\n')+'\n');console.log('PASS installer privacy, companion sharing and animation modules, approved assets and checksums');
})().catch(e=>{console.error(e);process.exitCode=1;});
