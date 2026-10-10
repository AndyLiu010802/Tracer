'use strict';
// Standard transparent sprite export only: generated originals stay untouched.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/fishing-prestige'),file=path.join(out,'art-manifest.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
(async()=>{const manifest=read(file);for(const p of fs.readdirSync(out).filter(n=>/^art-(?!manifest).+\.json$/.test(n))){const record=read(path.join(out,p));if(manifest.assets[record.id])manifest.assets[record.id]={...manifest.assets[record.id],...record};}
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{const page=await browser.newPage();await page.goto('about:blank');
  for(const art of Object.values(manifest.assets).filter(a=>a.status==='complete'&&!a.exported)){
   const result=await page.evaluate(async data=>{const image=new Image();image.src=data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,c.width,c.height).data;let minX=c.width,minY=c.height,maxX=0,maxY=0,clear=0,solid=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const a=rgba[(y*c.width+x)*4+3];if(a<8)clear++;if(a>32){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);solid++;}}
    const pad=Math.ceil(Math.max(maxX-minX,maxY-minY)*.045),left=Math.max(0,minX-pad),top=Math.max(0,minY-pad),right=Math.min(c.width,maxX+pad+1),bottom=Math.min(c.height,maxY+pad+1),w=right-left,h=bottom-top,scale=Math.min(1,384/Math.max(w,h)),thumb=document.createElement('canvas');thumb.width=Math.round(w*scale);thumb.height=Math.round(h*scale);const t=thumb.getContext('2d');t.imageSmoothingEnabled=true;t.imageSmoothingQuality='high';t.drawImage(c,left,top,w,h,0,0,thumb.width,thumb.height);return{png:thumb.toDataURL('image/png').split(',')[1],width:thumb.width,height:thumb.height,sourceWidth:c.width,sourceHeight:c.height,transparentFraction:clear/(c.width*c.height),solidFraction:solid/(c.width*c.height)};
   },'data:image/png;base64,'+fs.readFileSync(art.source).toString('base64'));
   assert(result.transparentFraction>.08,art.id+' must have transparent alpha');assert(result.solidFraction>.04,art.id+' must contain visible art');const data=Buffer.from(result.png,'base64');delete result.png;fs.writeFileSync(path.join(root,art.destination),data);Object.assign(art,result,{exported:true,bytes:data.length});console.log(art.id+' '+data.length+' bytes');
  }
  manifest.completed=Object.values(manifest.assets).filter(a=>a.exported).length;fs.writeFileSync(file,JSON.stringify(manifest,null,2));console.log(manifest.completed+'/'+manifest.total+' transparent sprites exported');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
