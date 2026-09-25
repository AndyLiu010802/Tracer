'use strict';
// Incremental, read-only PNG audit. Only the report in .cache is written.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {decode,frameGrid,inspectPages,KINDS,ACTIONS}=require('./build-garden-companion-atlas.cjs');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'skins/tracer/garden-art');
const reportFile=path.join(root,'.cache/companion-motion-assets-audit.json');
const pattern=new RegExp(`^(${KINDS.join('|')})-(normal|shiny)-(${ACTIONS.join('|')})-v([123])(?:-p([12]))?\\.png$`);
function inspect(file){
  const bytes=fs.readFileSync(file),decoded=decode(bytes),{width,height,data}=decoded,frames=[],warnings=[];
  let grid;try{grid=frameGrid(decoded);}catch(error){warnings.push(error.message);grid={x:Array.from({length:5},(_,i)=>Math.floor(i*width/4)),y:Array.from({length:5},(_,i)=>Math.floor(i*height/4))};}
  let clear=0;
  for(let i=3;i<data.length;i+=4)if(data[i]===0)clear++;
  for(let index=0;index<16;index++){
    const col=index%4,row=Math.floor(index/4),x0=grid.x[col],x1=grid.x[col+1],y0=grid.y[row],y1=grid.y[row+1];
    let minX=x1,minY=y1,maxX=x0-1,maxY=y0-1,visible=0,clear=0,edgePixels=0,gutterPixels=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const alpha=data[(y*width+x)*4+3];if(alpha===0)clear++;
      if(alpha<=128)continue;
      visible++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      if(x===x0||x===x1-1||y===y0||y===y1-1)edgePixels++;
      if(x<x0+3||x>=x1-3||y<y0+3||y>=y1-3)gutterPixels++;
    }
    const area=(x1-x0)*(y1-y0),margin=visible?Math.min(minX-x0,minY-y0,x1-1-maxX,y1-1-maxY):-1;
    const normalized=Buffer.alloc(64*64*4);
    for(let py=0;py<64;py++)for(let px=0;px<64;px++){
      const sx=Math.min(x1-1,x0+Math.floor((px+.5)*(x1-x0)/64)),sy=Math.min(y1-1,y0+Math.floor((py+.5)*(y1-y0)/64)),source=(sy*width+sx)*4,target=(py*64+px)*4;
      for(let channel=0;channel<4;channel++)normalized[target+channel]=data[source+channel];
    }
    frames.push({frame:index+1,clearRatio:Math.round(clear/area*1000)/1000,visibleRatio:Math.round(visible/area*1000)/1000,margin,edgePixels,gutterPixels,hash:crypto.createHash('sha256').update(normalized).digest('hex').slice(0,16)});
    if(visible<area*.015)warnings.push(`frame ${index+1}: empty or too small`);
    if(edgePixels)warnings.push(`frame ${index+1}: ${edgePixels} opaque pixels touch its cell boundary`);
    if(clear/area<.03)warnings.push(`frame ${index+1}: little or no alpha transparency`);
  }
  if(new Set(frames.map(frame=>frame.hash)).size!==16)warnings.push('repeated normalized frame drawings');
  return{width,height,grid,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),clearRatio:Math.round(clear/(width*height)*1000)/1000,frames,warnings};
}
function audit({fresh=false}={}){
  let previous={files:{}};
  if(!fresh)try{previous=JSON.parse(fs.readFileSync(reportFile,'utf8'));}catch{}
  const files={},changed=[];
  for(const name of fs.readdirSync(directory).filter(name=>pattern.test(name)).sort()){
    const file=path.join(directory,name),stat=fs.statSync(file),signature=stat.size+':'+stat.mtimeMs;
    if(previous.version===3&&previous.files?.[name]?.signature===signature){files[name]=previous.files[name];continue;}
    try{files[name]={signature,...inspect(file)};}catch(error){files[name]={signature,warnings:[error.message]};}
    changed.push(name);
  }
  const coverage=new Map(),shaFiles=new Map();
  for(const[name,record]of Object.entries(files)){
    const[,kind,variant,action,version,part]=pattern.exec(name),key=[kind,variant,action].join('/');
    if(version==='3'){
      if(part==='1'){
        const second=name.replace('-p1.png','-p2.png');
        if(files[second])try{inspectPages([name,second].map(n=>path.join(directory,n)),[name,second]);coverage.set(key,[name,second]);}catch(error){record.warnings.push(error.message);}
      }
    }else if(!coverage.has(key)||version==='2')coverage.set(key,name);
    if(record.sha256){const list=shaFiles.get(record.sha256)||[];list.push(name);shaFiles.set(record.sha256,list);}
  }
  const duplicateFiles=[...shaFiles.values()].filter(names=>names.length>1),missing=[];
  for(const kind of KINDS)for(const variant of ['normal','shiny'])for(const action of ACTIONS)if(!coverage.has([kind,variant,action].join('/')))missing.push([kind,variant,action].join('/'));
  const issues=Object.entries(files).filter(([,record])=>record.warnings.length).map(([file,record])=>({file,warnings:record.warnings}));
  const result={version:3,checkedAt:new Date().toISOString(),sourceCount:Object.keys(files).length,coverage:coverage.size,expected:KINDS.length*2*ACTIONS.length,decoded:changed.length,unchanged:Object.keys(files).length-changed.length,duplicateFiles,issues,missing,files};
  fs.mkdirSync(path.dirname(reportFile),{recursive:true});fs.writeFileSync(reportFile,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({coverage:result.coverage,expected:result.expected,decoded:result.decoded,unchanged:result.unchanged,duplicates:duplicateFiles,issueFiles:issues.length,newIssues:issues.filter(issue=>changed.includes(issue.file)),report:reportFile},null,2));
  return result;
}
if(require.main===module){const result=audit({fresh:process.argv.includes('--fresh')});if(process.argv.includes('--complete')&&(result.coverage!==result.expected||result.duplicateFiles.length||result.issues.length))process.exitCode=1;}
module.exports={inspect,audit};
