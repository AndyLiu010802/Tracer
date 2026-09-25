'use strict';
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
// Old source sheets remain available to the offline atlas builders. Production
// playback uses the current multi-page atlases, so these need not be distributed.
const excludedPatterns=[
  '!skins/tracer/garden-art/*-normal-*-v2.png',
  '!skins/tracer/garden-art/*-shiny-*-v2.png',
  '!skins/tracer/pet-art/*-v1.png'
];
function omittedArt(file){return /^skins\/tracer\/garden-art\/[^/]+-(normal|shiny)-[^/]+-v2\.png$/.test(file)||/^skins\/tracer\/pet-art\/[^/]+-v1\.png$/.test(file);}
function verifyAssets(root){
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  for(const pattern of excludedPatterns)assert.ok(pkg.build.files.includes(pattern),'Packaging must exclude only reviewed retired sheets: '+pattern);
  const sources=new Set();
  function visit(value){if(typeof value==='string'&&/^\/(garden|pet)-art\/[^/]+\.png$/.test(value))sources.add('skins/tracer'+value);else if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')Object.values(value).forEach(visit);}
  for(const file of ['garden-companion-atlas.js','pet-illustrated-atlas.js'])visit(require(path.join(root,'skins/tracer',file)));
  assert.ok(sources.size>0,'Current companion atlas references are available');
  for(const file of sources){assert.equal(omittedArt(file),false,'Current animation sheet must remain in the package: '+file);assert.ok(fs.existsSync(path.join(root,file)),'Current animation sheet exists: '+file);}
  return [...sources];
}
module.exports={excludedPatterns,omittedArt,verifyAssets};
if(require.main===module)console.log('PASS all '+verifyAssets(path.resolve(__dirname,'..')).length+' current companion animation sheets are retained');
