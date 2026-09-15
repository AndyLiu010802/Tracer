'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'..');
(async()=>{
 const version=require('../package.json').version;
 const archive=path.resolve(process.argv[2]||path.join(root,'dist','win-unpacked','resources','app.asar')),files=asar.listPackage(archive),bad=files.filter(f=>/(^|[\\/])(workspace\.json|bookmarks\.json|accounts\.json|connection\.json|local\.config\.json|\.env|\.cache|personal\.json|output)([\\/]|$)/.test(f));assert.deepEqual(bad,[],'No personal data or cloud credentials in installer');
 assert.deepEqual(files.filter(f=>f.replaceAll('\\','/').includes('/ai-service/')&&!f.replaceAll('\\','/').endsWith('/ai-service/provider.js')),[]); const pkg=JSON.parse(asar.extractFile(archive,'package.json'));assert.equal(pkg.version,version);
 for(const file of ['lib/ai-personal.js','lib/ai-gateway.js','ai-service/provider.js','public/ai-planner.js','public/tracer-logo.png','lib/ai-extract-worker.js','skins/tracer/ai-assistant.js','skins/tracer/ai-assistant.css','desktop/assets/app-icon.png','desktop/main.js','desktop/preload.js','desktop/window-controls.js','skins/tracer/window-controls.js','skins/tracer/window-controls.css','skins/tracer/wellness.css','skins/tracer/index.html','skins/tracer/notes.js','skins/tracer/notes.css'])assert.ok(asar.extractFile(archive,file.split('/').join(path.sep)).equals(fs.readFileSync(path.join(root,file))),file+' matches source');
 const sums=['Tracer-Setup-'+version+'-x64.exe'].map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist',name))).digest('hex')+'  '+name);fs.writeFileSync(path.join(root,'dist','SHA256SUMS-'+version+'.txt'),sums.join('\n')+'\n');console.log('PASS installer privacy, personal AI modules, approved assets and checksums');
})().catch(e=>{console.error(e);process.exitCode=1;});
