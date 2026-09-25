'use strict';
// Read-only pixel audit and non-destructive import of reviewed image_gen outputs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {decode}=require('./build-garden-companion-atlas.cjs');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'skins/tracer/sticker-art');
const plan=require('../skins/tracer/sticker-art/stickers-v2-prompts.json');
function inspect(file){
 const bytes=fs.readFileSync(file),{width,height,data}=decode(bytes);
 if(width<768||height<768||Math.abs(width-height)>Math.max(width,height)*.01)throw Error('invalid-sticker-size');
 let clear=0,visible=0,left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const a=data[(y*width+x)*4+3];if(a===0)clear++;if(a>=128){visible++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 if(clear/(width*height)<.15||visible/(width*height)<.08)throw Error('missing-transparent-cutout');
 const margin=Math.min(left/width,top/height,(width-right-1)/width,(height-bottom-1)/height);
 if(margin<.04)throw Error('insufficient-clear-border '+margin.toFixed(4));
 return{width,height,margin:Number(margin.toFixed(4)),clearRatio:Number((clear/(width*height)).toFixed(4)),sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
function importReviewed(ids){
 const file=path.join(folder,'stickers-v2-sources.json'),sources=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
 for(const id of ids){
  const j=plan.jobs.find(j=>j.id===id);if(!j)throw Error('unknown-sticker '+id);
  const result=JSON.parse(fs.readFileSync(path.join(root,'.cache/sticker-generation/result-'+id+'.json'),'utf8'));
  const source=result.output_hint.match(/ as ([^\r\n]+\.png) by default/)[1],quality=inspect(source);
  const output=path.join(folder,id+'-v1.png');
  if(fs.existsSync(output)){if(inspect(output).sha256!==quality.sha256)throw Error('existing-different-sticker '+id);continue;}
  fs.copyFileSync(source,output,fs.constants.COPYFILE_EXCL);
  sources[id]={source:path.basename(source),output:path.relative(root,output).replace(/\\/g,'/'),...quality};
  fs.writeFileSync(file,JSON.stringify(sources,null,2)+'\n');console.log(JSON.stringify({id,...quality}));
 }
}
function audit(){
 const groups={},missing=[],rejected=[],hashes=new Set();let ready=0;
 for(const j of plan.jobs){const file=path.join(folder,j.id+'-v1.png');if(!fs.existsSync(file)){missing.push(j.id);continue;}
  try{const a=inspect(file);if(hashes.has(a.sha256))throw Error('duplicate-artwork');hashes.add(a.sha256);groups[j.material+'/'+j.theme]=(groups[j.material+'/'+j.theme]||0)+1;ready++;}
  catch(e){rejected.push({id:j.id,error:e.message});}
 }
 return{expected:72,ready,groups,missing,rejected};
}
if(require.main===module){if(process.argv[2]==='--import')importReviewed(process.argv.slice(3));else{const report=audit();console.log(JSON.stringify(report,null,2));if(report.ready!==72)process.exitCode=1;}}
module.exports={inspect,audit};
