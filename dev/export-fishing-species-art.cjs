'use strict';
// Lossless packaging/resampling of imagegen output only; no procedural repainting.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright'),{jobs}=require('./fishing-species-art-specs.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/fishing-species-v1'),folder=path.join(root,'skins/tracer/fishing-art');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),partial=process.argv.includes('--partial');
const records=new Map(jobs.flatMap(job=>{const file=path.join(out,'art-'+job.id+'.json');return fs.existsSync(file)?[[job.id,{...job,...JSON.parse(fs.readFileSync(file,'utf8'))}]]:[];}));
if(!partial)assert.equal(records.size,156,'All individually generated portraits must be present');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage(),assets={},atlases=[],review=[];
 for(let start=0;start<jobs.length;start+=16){
  const group=jobs.slice(start,start+16),inputs=group.map(j=>{const r=records.get(j.id);return r?{id:j.id,name:j.name[0],image:'data:image/png;base64,'+fs.readFileSync(path.join(root,r.source)).toString('base64')}:null;});if(!inputs.some(Boolean))continue;
  const rendered=await page.evaluate(async inputs=>{
   const cellWidth=384,cellHeight=256,columns=4,rows=4,atlas=document.createElement('canvas');atlas.width=cellWidth*columns;atlas.height=cellHeight*rows;const ctx=atlas.getContext('2d');ctx.imageSmoothingQuality='high';
   const contact=document.createElement('canvas');contact.width=1200;contact.height=960;const cg=contact.getContext('2d');cg.fillStyle='#16352d';cg.fillRect(0,0,contact.width,contact.height);const items=[];
   for(let i=0;i<inputs.length;i++){const input=inputs[i];if(!input)continue;const image=new Image();image.src=input.image;await image.decode();const temp=document.createElement('canvas');temp.width=image.width;temp.height=image.height;const tg=temp.getContext('2d',{willReadFrequently:true});tg.drawImage(image,0,0);const pixels=tg.getImageData(0,0,temp.width,temp.height).data;let x0=image.width,y0=image.height,x1=0,y1=0,count=0,solid=0,border=0;
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const a=pixels[(y*image.width+x)*4+3];if(a>32){count++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);if(a>245)solid++;if(x<2||y<2||x>=image.width-2||y>=image.height-2)border++;}}
    if(!count)throw Error(input.id+' is empty');const w=x1-x0+1,h=y1-y0+1,scale=Math.min((cellWidth-32)/w,(cellHeight-32)/h),col=i%4,row=Math.floor(i/4),x=col*cellWidth+(cellWidth-w*scale)/2,y=row*cellHeight+(cellHeight-h*scale)/2;
    ctx.drawImage(image,x0,y0,w,h,x,y,w*scale,h*scale);cg.fillStyle=(col+row)%2?'#1e4237':'#284b3f';cg.fillRect(col*300+4,row*240+4,292,232);const cs=Math.min(268/w,190/h);cg.drawImage(image,x0,y0,w,h,col*300+(300-w*cs)/2,row*240+12+(190-h*cs)/2,w*cs,h*cs);cg.fillStyle='#eadfbd';cg.font='14px "Microsoft YaHei",sans-serif';cg.fillText(input.name+' · '+input.id,col*300+12,row*240+220,276);
    items.push({id:input.id,index:i,bounds:[col*cellWidth,row*cellHeight,(col+1)*cellWidth,(row+1)*cellHeight],sourceWidth:image.width,sourceHeight:image.height,sourceBounds:[x0,y0,x1+1,y1+1],occupiedPixels:count,clear:1-count/(image.width*image.height),solid:solid/count,borderPixels:border});
   }
   return{png:atlas.toDataURL('image/png').split(',')[1],contact:contact.toDataURL('image/png').split(',')[1],width:atlas.width,height:atlas.height,cellWidth,cellHeight,columns,rows,items};
  },inputs);
  const index=start/16,file='species-painted-v1-'+index+'.png',bytes=Buffer.from(rendered.png,'base64'),revision=sha(bytes).slice(0,12);fs.writeFileSync(path.join(folder,file),bytes);fs.writeFileSync(path.join(out,'review-'+index+'.png'),Buffer.from(rendered.contact,'base64'));delete rendered.png;delete rendered.contact;
  atlases.push({file,revision,sha256:sha(bytes),bytes:bytes.length,...rendered});
  for(const item of rendered.items){assert(item.clear>.08,item.id+' needs real transparent background');const r=records.get(item.id);assets[item.id]={src:'/fishing-art/'+file+'?v='+revision,width:rendered.width,height:rendered.height,bounds:item.bounds};review.push({...r,sha256:sha(fs.readFileSync(path.join(root,r.source))),metrics:item});}
 }
 const manifest={version:1,generator:'built-in imagegen',total:156,completed:records.size,atlases,records:review};fs.writeFileSync(path.join(root,'docs/fishing-species-art-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(root,'skins/tracer/fishing-species-painted.js'),'(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.TracerFishingSpeciesPainted=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";return Object.freeze('+JSON.stringify({version:1,assets})+');});\n');
 console.log(JSON.stringify({completed:records.size,atlases:atlases.length,bytes:atlases.reduce((n,a)=>n+a.bytes,0),review:review.filter(r=>r.metrics.borderPixels>0||r.metrics.clear<.12).map(r=>({id:r.id,...r.metrics}))},null,2));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
