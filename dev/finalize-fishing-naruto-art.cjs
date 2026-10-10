'use strict';
// Source art is never modified. Record exact revisions and regenerate the manifest.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'..'),art=require('./fishing-naruto-art-specs.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=art.jobs.map(job=>{const file=path.join(root,job.destination);if(!fs.existsSync(file))throw Error('Missing generated original '+job.destination);const b=fs.readFileSync(file);return{key:job.key,kind:job.kind,file:job.destination,sha256:hash(b),width:b.readUInt32BE(16),height:b.readUInt32BE(20),rgba:b[25]===6};});
const revisions=Object.fromEntries(manifest.filter(r=>r.kind==='rod').map(r=>['anime_'+r.key,r.sha256.slice(0,12)]));
let p=fs.readFileSync(path.join(root,'skins/tracer/fishing-naruto-painted.js'),'utf8');p=p.replace(/const revisions=.*?; \/\/ GENERATED NARUTO REVISIONS/,'const revisions='+JSON.stringify(revisions)+'; // GENERATED NARUTO REVISIONS');fs.writeFileSync(path.join(root,'skins/tracer/fishing-naruto-painted.js'),p);
const specs=Object.fromEntries(manifest.filter(r=>r.kind==='fx').map(r=>['anime_'+r.key,{src:'/fishing-art/fx-naruto-'+r.key+'-v2.png',motion:art.specs[r.key][2],revision:r.sha256.slice(0,12)}]));
let v=fs.readFileSync(path.join(root,'skins/tracer/fishing-naruto-vfx.js'),'utf8');v=v.replace(/const specs=.*?; \/\/ GENERATED NARUTO VFX SPECS/,'const specs='+JSON.stringify(specs)+'; // GENERATED NARUTO VFX SPECS');fs.writeFileSync(path.join(root,'skins/tracer/fishing-naruto-vfx.js'),v);
fs.writeFileSync(path.join(root,'docs/fishing-naruto-art-manifest.json'),JSON.stringify({generator:'built-in image_gen',originals:manifest},null,2));console.log('Verified '+manifest.length+' original generated assets');
