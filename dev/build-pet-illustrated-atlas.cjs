'use strict';
const fs=require('node:fs'),path=require('node:path');
const {inspectSheet,inspectPages}=require('./build-garden-companion-atlas.cjs');
const {actions}=require('../skins/tracer/pet-builtin-animation');
const root=path.resolve(__dirname,'..'),kinds=['sprout','miso','brook','ember','luna','nova'];
function build(){
  const manifest={version:2,kinds:{}},missing=[],rejected=[];let count=0;
  for(const id of kinds){manifest.kinds[id]={normal:{}};for(const action of actions){
    const names=[1,2].map(part=>`${id}-${action}-v2-p${part}.png`),files=names.map(name=>path.join(root,'skins/tracer/pet-art',name));
    if(files.every(file=>fs.existsSync(file))){
      try{manifest.kinds[id].normal[action]={...inspectPages(files,names.map(name=>'/pet-art/'+name)),sourceVersion:2};count++;continue;}
      catch(error){rejected.push({file:names.join(', '),error:error.message});}
    }
    const name=`${id}-${action}-v1.png`,file=path.join(root,'skins/tracer/pet-art',name);
    if(!fs.existsSync(file)){missing.push(name);continue;}
    try{manifest.kinds[id].normal[action]={src:'/pet-art/'+name,...inspectSheet(file)};count++;}
    catch(error){rejected.push({file:name,error:error.message});}
  }}
  const output=path.join(root,'skins/tracer/pet-illustrated-atlas.js');
  fs.writeFileSync(output+'.tmp',"// Generated from inspected original PNGs.\n(function(root,data){if(typeof module==='object'&&module.exports)module.exports=data;else root.TracerPetIllustratedAtlas=data;})(typeof globalThis!=='undefined'?globalThis:this,"+JSON.stringify(manifest)+');\n');
  fs.renameSync(output+'.tmp',output);return{count,expected:96,missing,rejected};
}
if(require.main===module){const result=build();console.log(JSON.stringify(result,null,2));if(result.rejected.length||process.argv.includes('--complete')&&result.count!==96)process.exitCode=1;}
module.exports={build,kinds};
