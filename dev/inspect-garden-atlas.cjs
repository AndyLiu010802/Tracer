'use strict';
// Read-only PNG analysis. Preserve original generated pixels and alpha exactly.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..');
function inspect(file,{columns=3,rows=2,threshold=64}={}){
  const bytes=fs.readFileSync(file),w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
  if(bytes[24]!==8||bytes[25]!==6||bytes[28]!==0)throw new Error('Expected non-interlaced RGBA8 PNG');
  let offset=8,chunks=[];while(offset<bytes.length){const n=bytes.readUInt32BE(offset);if(bytes.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(bytes.subarray(offset+8,offset+8+n));offset+=n+12;}
  const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=w*4,rgba=Buffer.alloc(stride*h);
  function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
  for(let y=0;y<h;y++){const f=raw[y*(stride+1)];for(let x=0;x<stride;x++){const a=x>=4?rgba[y*stride+x-4]:0,b=y?rgba[(y-1)*stride+x]:0,c=y&&x>=4?rgba[(y-1)*stride+x-4]:0;rgba[y*stride+x]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][f])&255;}}
  const cells=[];let clear=0,maxAlpha=0;for(let i=3;i<rgba.length;i+=4){if(!rgba[i])clear++;maxAlpha=Math.max(maxAlpha,rgba[i]);}
  for(let index=0;index<columns*rows;index++){
    const column=index%columns,row=Math.floor(index/columns),x0=Math.floor(column*w/columns),y0=Math.floor(row*h/rows),x1=Math.floor((column+1)*w/columns),y1=Math.floor((row+1)*h/rows);let minX=x1,minY=y1,maxX=x0,maxY=y0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(rgba[(y*w+x)*4+3]>threshold){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    const x=Math.max(x0,minX-4),y=Math.max(y0,minY-4),right=Math.min(x1,maxX+5),bottom=Math.min(y1,maxY+5);
    cells.push({x,y,w:right-x,h:bottom-y,rootX:(x0+x1)/2,rootY:maxY+1});
  }
  return {width:w,height:h,clearRatio:Math.round(clear/(w*h)*1000)/1000,maxAlpha,cells};
}
if(require.main===module){
  const data={};for(const kind of require('../public/task-garden').KINDS)data[kind]=inspect(path.join(root,'skins/tracer/garden-art',kind+'-v2.png'));
  if(process.argv.includes('--write')){
    const target=path.join(root,'skins/tracer/garden-plant-atlas.js'),temp=target+'.tmp';
    fs.writeFileSync(temp,'// Generated from original PNG alpha bounds by dev/inspect-garden-atlas.cjs.\n(function(root,data){if(typeof module===\'object\'&&module.exports)module.exports=data;else root.TracerGardenPlantAtlas=data;})(typeof globalThis!==\'undefined\'?globalThis:this,'+JSON.stringify(data)+');\n');
    fs.renameSync(temp,target);console.log('Wrote '+Object.keys(data).length+' plant atlases; original PNG pixels unchanged.');
  }else console.log(JSON.stringify(data,null,2));
}
module.exports={inspect};
