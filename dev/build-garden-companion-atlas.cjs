'use strict';
// Reads generated PNGs without resampling or rewriting a single source pixel.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), zlib = require('node:zlib');
const ROOT = path.resolve(__dirname, '..');
const KINDS = ['wildflower', 'sunflower', 'lavender', 'apple', 'peach', 'cherry', 'neon_orchid', 'volt_berry', 'crystal_tree'];
const ACTIONS = ['idle', 'greet', 'walk', 'hop', 'water', 'pet', 'music', 'celebrate', 'rest', 'focus', 'breeze', 'stretch', 'look', 'shy', 'eat', 'thanks'];
function decode(bytes) {
  if (bytes.length < 33 || bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not-png');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(width<256||height<256||width>4096||height>4096||bytes[24]!==8||bytes[25]!==6||bytes[28]!==0)throw new Error('requires-noninterlaced-RGBA8');
  const chunks=[];let offset=8;
  while(offset+12<=bytes.length){const size=bytes.readUInt32BE(offset);if(offset+size+12>bytes.length)throw new Error('truncated-png');if(bytes.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(bytes.subarray(offset+8,offset+8+size));offset+=size+12;}
  const stride=width*4,raw=zlib.inflateSync(Buffer.concat(chunks),{maxOutputLength:(stride+1)*height});
  if(raw.length!==(stride+1)*height)throw new Error('png-size-mismatch');
  const data=Buffer.alloc(stride*height),paeth=(a,b,c)=>{const p=a+b-c,A=Math.abs(p-a),B=Math.abs(p-b),C=Math.abs(p-c);return A<=B&&A<=C?a:B<=C?b:c;};
  for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];if(filter>4)throw new Error('png-filter');for(let x=0;x<stride;x++){const a=x>=4?data[y*stride+x-4]:0,b=y?data[(y-1)*stride+x]:0,c=y&&x>=4?data[(y-1)*stride+x-4]:0;data[y*stride+x]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}}
  return {width,height,data};
}
function frameGrid({width,height,data}) {
  const columns=new Uint32Array(width),rows=new Uint32Array(height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>128){columns[x]++;rows[y]++;}
  if(columns[0]||columns[width-1]||rows[0]||rows[height-1])throw new Error('outer-edge-clipping');
  function boundaries(profile){
    // Generated sheets can give the standing introduction a taller first row.
    // Measure the clear gutter instead of cutting that row at an ideal quarter.
    // Adjacent searches stay disjoint; empty/repeated cells are still rejected.
    const values=[0],radius=Math.max(3,Math.floor(profile.length/4*.24));
    for(let part=1;part<4;part++){
      const expected=Math.floor(part*profile.length/4),candidates=[];
      // The two sides of a crop boundary need a clear gutter. Moving only
      // the crop, never the ground anchor, preserves authored hops and falls.
      for(let at=Math.max(2,expected-radius);at<=Math.min(profile.length-2,expected+radius);at++)if(!profile[at-1]&&!profile[at]&&!profile[at+1])candidates.push(at);
      candidates.sort((a,b)=>Math.abs(a-expected)-Math.abs(b-expected)||a-b);
      if(!candidates.length)throw new Error('missing-frame-gutter-'+part);
      values.push(candidates[0]);
    }
    values.push(profile.length);return values;
  }
  return{x:boundaries(columns),y:boundaries(rows)};
}
// Anchor the character, not its cell or detached props. A fixed atlas cell can
// contain drawings at different positions; those offsets are not motion.
function bodyAnchor({width,data},x0,y0,x1,y1) {
  const w=x1-x0,h=y1-y0,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
  let largest=[];
  const opaque=i=>data[((y0+Math.floor(i/w))*width+x0+i%w)*4+3]>128;
  for(let start=0;start<seen.length;start++){
    if(seen[start]||!opaque(start))continue;
    let head=0,tail=1;queue[0]=start;seen[start]=1;
    while(head<tail){const at=queue[head++],x=at%w;
      for(const next of [x?at-1:-1,x<w-1?at+1:-1,at-w,at+w]){
        if(next<0||next>=seen.length||seen[next])continue;
        seen[next]=1;if(opaque(next))queue[tail++]=next;
      }
    }
    if(tail>largest.length)largest=Array.from(queue.subarray(0,tail));
  }
  let top=h,bottom=0,left=w,right=0;
  for(const at of largest){const x=at%w,y=Math.floor(at/w);top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}
  const columns=new Uint32Array(w);
  // The dense middle of the body excludes thin rods, loose droplets and feet.
  for(const at of largest){const y=Math.floor(at/w);if(y>=top+(bottom-top)*.25&&y<=top+(bottom-top)*.75)columns[at%w]++;}
  const total=columns.reduce((a,b)=>a+b,0);let mass=0,center=(left+right)/2;
  for(let x=0;x<w;x++){mass+=columns[x];if(mass>=total/2){center=x;break;}}
  let foot=top;
  for(const at of largest){if(Math.abs(at%w-center)<=Math.max(3,(right-left)*.22))foot=Math.max(foot,Math.floor(at/w));}
  return {rootX:x0+center+.5,rootY:y0+foot+1};
}
function inspectSheet(file) {
  const bytes=fs.readFileSync(file),decoded=decode(bytes),{width,height,data}=decoded,cells=[],signatures=[];
  let clear=0,maxAlpha=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)clear++;maxAlpha=Math.max(maxAlpha,data[i]);}
  const clearRatio=clear/(width*height);if(clearRatio<.03||maxAlpha<240)throw new Error('missing-transparent-artwork');
  const grid=frameGrid(decoded);
  let baseline=0,maxWidth=0,minTop=Infinity;
  for(let frame=0;frame<16;frame++){
    const col=frame%4,row=Math.floor(frame/4),x0=grid.x[col],x1=grid.x[col+1],y0=grid.y[row],y1=grid.y[row+1],nominalY=Math.floor(row*height/4);
    let minX=x1,minY=y1,maxX=x0-1,maxY=y0-1,visible=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(data[(y*width+x)*4+3]>128){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);visible++;}
    if(visible<(x1-x0)*(y1-y0)*.015||maxX<minX||maxY<minY)throw new Error('empty-frame-'+frame);
    const x=Math.max(x0,minX-3),y=Math.max(y0,minY-3),right=Math.min(x1,maxX+4),bottom=Math.min(y1,maxY+4);
    const cell={x,y,w:right-x,h:bottom-y,...bodyAnchor(decoded,x0,y0,x1,y1)};cells.push(cell);
    baseline=Math.max(baseline,maxY-nominalY+1);minTop=Math.min(minTop,minY-nominalY);maxWidth=Math.max(maxWidth,cell.w);
    // A normalized frame fingerprint rejects exact repeated drawings despite odd grid dimensions.
    const normalized=Buffer.alloc(64*64*4);
    for(let py=0;py<64;py++)for(let px=0;px<64;px++){const sx=Math.min(x1-1,x0+Math.floor((px+.5)*(x1-x0)/64)),sy=Math.min(y1-1,y0+Math.floor((py+.5)*(y1-y0)/64)),source=(sy*width+sx)*4,target=(py*64+px)*4;for(let c=0;c<4;c++)normalized[target+c]=data[source+c];}
    signatures.push(crypto.createHash('sha256').update(normalized).digest('hex').slice(0,16));
  }
  if(new Set(signatures).size!==16)throw new Error('repeated-frame-drawings');
  // Feet and body center stay planted for every action, including in-place hops.
  // Only the internal drawn pose changes; source PNG pixels are untouched.
  const scale=Math.min(132/Math.max(1,baseline-minTop),142/Math.max(1,maxWidth));
  return {width,height,frames:16,grid,clearRatio:Math.round(clearRatio*1000)/1000,maxAlpha,scale,cells,
    frameHashes:signatures,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
function build({directory=path.join(ROOT,'skins/tracer/garden-art'),output=path.join(ROOT,'skins/tracer/garden-companion-atlas.js')}={}) {
  const manifest={version:1,frames:16,kinds:{}},missing=[],rejected=[];let count=0;
  for(const kind of KINDS){manifest.kinds[kind]={normal:{},shiny:{}};for(const variant of ['normal','shiny'])for(const action of ACTIONS){
    let name=`${kind}-${variant}-${action}-v2.png`,file=path.join(directory,name);
    if(!fs.existsSync(file)&&kind==='wildflower'&&['idle','greet','celebrate'].includes(action)){name=`${kind}-${variant}-${action}-v1.png`;file=path.join(directory,name);}
    if(!fs.existsSync(file)){missing.push(`${kind}/${variant}/${action}`);continue;}
    try{const sheet=inspectSheet(file);manifest.kinds[kind][variant][action]={src:'/garden-art/'+name,sourceVersion:name.endsWith('-v1.png')?1:2,...sheet};count++;}
    catch(error){rejected.push({file:name,error:error.message});}
  }}
  const source='// Generated by dev/build-garden-companion-atlas.cjs from existing, inspected original PNGs.\n(function(root,data){if(typeof module===\'object\'&&module.exports)module.exports=data;else root.TracerGardenCompanionAtlas=data;})(typeof globalThis!==\'undefined\'?globalThis:this,'+JSON.stringify(manifest)+');\n';
  if(output){const next=output+'.tmp';fs.writeFileSync(next,source);fs.renameSync(next,output);}
  return {manifest,count,expected:KINDS.length*2*ACTIONS.length,missing,rejected};
}
if(require.main===module){const result=build();console.log(JSON.stringify({included:result.count,expected:result.expected,missing:result.missing.length,rejected:result.rejected},null,2));if(result.rejected.length)process.exitCode=1;}
module.exports={KINDS,ACTIONS,decode,frameGrid,bodyAnchor,inspectSheet,build};
