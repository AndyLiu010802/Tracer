'use strict';
// Standard sprite export: preserve imagegen originals, resample for runtime,
// measure each cell. Does not repaint or synthesize any of the generated art.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/fishing-orbit-v2'),jobs=require('./fishing-orbit-art-specs.cjs').jobs;
(async()=>{const records=jobs.map(j=>{const f=path.join(out,'art-'+j.id+'.json');return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null;}).filter(Boolean);if(!process.argv.includes('--partial'))assert.equal(records.length,66);
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{const page=await browser.newPage(),assets={};
 for(const r of records){const input=fs.readFileSync(r.source);const source=path.join(root,'art-source/fishing-orbit-v2',r.id+'.png');fs.mkdirSync(path.dirname(source),{recursive:true});fs.writeFileSync(source,input);
  const metrics=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(img,0,0,512,512);const px=g.getImageData(0,0,512,512).data,cells=[];let clear=0,solid=0,semi=0;
   for(let i=3;i<px.length;i+=4){if(px[i]<8)clear++;else if(px[i]>245)solid++;else semi++;}
   // Read connected silhouette bounds, rather than slicing a tail or flourish
   // that extends slightly beyond the nominal atlas quadrant.
   const seen=new Uint8Array(512*512),queue=new Int32Array(512*512),groups=Array.from({length:4},()=>({minX:512,minY:512,maxX:0,maxY:0,count:0,edge:0}));
   for(let seed=0;seed<seen.length;seed++){if(seen[seed]||px[seed*4+3]<=40)continue;let head=0,tail=1,count=0,sumX=0,sumY=0,minX=512,minY=512,maxX=0,maxY=0,edge=0;queue[0]=seed;seen[seed]=1;while(head<tail){const n=queue[head++],x=n%512,y=Math.floor(n/512);count++;sumX+=x;sumY+=y;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(x===0||y===0||x===511||y===511)edge++;for(const [xx,yy]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(xx<0||yy<0||xx>=512||yy>=512)continue;const k=yy*512+xx;if(!seen[k]&&px[k*4+3]>40){seen[k]=1;queue[tail++]=k;}}}if(count<8)continue;const index=(sumX/count>=256?1:0)+(sumY/count>=256?2:0),g=groups[index];g.minX=Math.min(g.minX,minX);g.minY=Math.min(g.minY,minY);g.maxX=Math.max(g.maxX,maxX);g.maxY=Math.max(g.maxY,maxY);g.count+=count;g.edge+=edge;}
   for(const g of groups)cells.push({x:Math.max(0,g.minX-1),y:Math.max(0,g.minY-1),w:Math.min(511,g.maxX+1)-Math.max(0,g.minX-1)+1,h:Math.min(511,g.maxY+1)-Math.max(0,g.minY-1)+1,count:g.count,edge:g.edge});
   return{png:c.toDataURL('image/png').split(',')[1],width:512,height:512,cells,clear:clear/(512*512),solid:solid/(solid+semi),sourceWidth:img.width,sourceHeight:img.height};
  },'data:image/png;base64,'+input.toString('base64'));
  assert(metrics.clear>.15,r.id+' needs empty alpha background');assert(metrics.cells.every(c=>c.count>250),r.id+' has four nonempty sprites');
  fs.writeFileSync(path.join(root,r.destination),Buffer.from(metrics.png,'base64'));delete metrics.png;assets[r.id]={src:'/'+r.destination.replace('skins/tracer/',''),width:512,height:512,cells:metrics.cells.map(({x,y,w,h})=>[x,y,w,h])};Object.assign(r,{exported:true,metrics,original:'art-source/fishing-orbit-v2/'+r.id+'.png'});
 }
 const module='(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.TracerFishingOrbitArt=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";return Object.freeze('+JSON.stringify(assets,null,2)+');});\n';fs.writeFileSync(path.join(root,'skins/tracer/fishing-orbit-art.js'),module);
 fs.writeFileSync(path.join(root,'docs/fishing-orbit-art-manifest.json'),JSON.stringify({version:2,mode:'built-in imagegen',total:66,completed:records.length,assets:records},null,2));console.log(JSON.stringify({completed:records.length,review:records.filter(r=>r.metrics.cells.some(c=>c.edge>8)||r.metrics.solid<.85).map(r=>({id:r.id,solid:r.metrics.solid,edges:r.metrics.cells.map(c=>c.edge)}))}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
