'use strict';
// Reads generated PNGs without resampling or rewriting a single source pixel.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), zlib = require('node:zlib');
const ART_CALIBRATION = require('./companion-art-calibration.json');
const ROOT = path.resolve(__dirname, '..');
const KINDS = ['wildflower', 'sunflower', 'lavender', 'apple', 'peach', 'cherry', 'neon_orchid', 'volt_berry', 'crystal_tree'];
const ACTIONS = ['idle', 'greet', 'walk', 'hop', 'water', 'pet', 'music', 'celebrate', 'rest', 'focus', 'breeze', 'stretch', 'look', 'shy', 'eat', 'thanks', 'play', 'crafting'];
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
function bodyAnchor({width,data},x0,y0,x1,y1,measure=false) {
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
  let bodySize;
  if(measure){
    // The thick head/torso stays the same size even when a paw touches a large
    // prop. Component area includes that prop; its inner radius does not.
    const distance=new Float32Array(w*h),diagonal=Math.SQRT2;
    for(const at of largest)distance[at]=w+h;
    for(let at=0;at<distance.length;at++)if(distance[at]){
      const x=at%w,y=Math.floor(at/w);
      distance[at]=Math.min(distance[at],x?distance[at-1]+1:1,y?distance[at-w]+1:1,x&&y?distance[at-w-1]+diagonal:diagonal,x<w-1&&y?distance[at-w+1]+diagonal:diagonal);
    }
    let radius=0;
    for(let at=distance.length-1;at>=0;at--)if(distance[at]){
      const x=at%w,y=Math.floor(at/w);
      distance[at]=Math.min(distance[at],x<w-1?distance[at+1]+1:1,y<h-1?distance[at+w]+1:1,x<w-1&&y<h-1?distance[at+w+1]+diagonal:diagonal,x&&y<h-1?distance[at+w-1]+diagonal:diagonal);
      radius=Math.max(radius,distance[at]);
    }
    bodySize=radius*2;
  }
  return {rootX:x0+center+.5,rootY:y0+foot+1,...(measure?{bodySize}:{})};
}
// Botanical companions share a pale warm face. Its width is more stable than
// the outer flower silhouette, whose petal gaps change the inscribed diameter.
// This is deliberately limited to that authored palette, never photo portraits.
function botanicalFaceSize({width,data},x0,y0,x1,y1) {
  const w=x1-x0,h=y1-y0,mask=new Uint8Array(w*h),queue=new Int32Array(w*h);let largest=0,size=0,eyeScore=0,faceSize=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const at=((y+y0)*width+x+x0)*4,r=data[at],g=data[at+1],b=data[at+2];
    if(data[at+3]>128&&r>170&&g>135&&b>110&&r>=g&&g>=b&&r-g<65&&g-b<70)mask[y*w+x]=1;
  }
  for(let start=0;start<mask.length;start++){
    if(!mask[start])continue;let head=0,tail=1,left=w,right=0,top=h,bottom=0;queue[0]=start;mask[start]=0;
    while(head<tail){const at=queue[head++],x=at%w,y=Math.floor(at/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const next of [x?at-1:-1,x<w-1?at+1:-1,at-w,at+w])if(next>=0&&next<mask.length&&mask[next]){mask[next]=0;queue[tail++]=next;}
    }
    if(tail>largest){largest=tail;size=right-left+1;}
    if(tail<w*h*.005)continue;
    // Warm orchid petals and bellies can be larger than the face. Prefer a
    // warm region with dark features on both sides of its interior (the eyes).
    // Do not mistake the largest cream-colored petal for the character's head.
    const bw=right-left+1,bh=bottom-top+1;let darkLeft=0,darkRight=0;
    for(let y=Math.ceil(top+bh*.2);y<top+bh*.8;y++)for(let x=Math.ceil(left+bw*.1);x<left+bw*.9;x++){
      const at=((y+y0)*width+x+x0)*4;
      if(data[at+3]>128&&data[at]<165&&data[at+1]<130&&data[at+2]<145){if(x<left+bw*.45)darkLeft++;if(x>left+bw*.55)darkRight++;}
    }
    const score=Math.min(darkLeft,darkRight);
    if(score>Math.max(4,eyeScore)){eyeScore=score;faceSize=bw;}
  }
  return faceSize|| (largest>=w*h*.005&&size>=8?size:0);
}
function inspectSheet(file,{botanical=false}={}) {
  const bytes=fs.readFileSync(file),decoded=decode(bytes),{width,height,data}=decoded,cells=[],signatures=[],sizes=[];
  let clear=0,maxAlpha=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)clear++;maxAlpha=Math.max(maxAlpha,data[i]);}
  const clearRatio=clear/(width*height);if(clearRatio<.03||maxAlpha<240)throw new Error('missing-transparent-artwork');
  const grid=frameGrid(decoded);
  let baseline=0,maxWidth=0,minTop=Infinity;const faces=[];
  for(let frame=0;frame<16;frame++){
    const col=frame%4,row=Math.floor(frame/4),x0=grid.x[col],x1=grid.x[col+1],y0=grid.y[row],y1=grid.y[row+1],nominalY=Math.floor(row*height/4);
    let minX=x1,minY=y1,maxX=x0-1,maxY=y0-1,visible=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(data[(y*width+x)*4+3]>128){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);visible++;}
    if(visible<(x1-x0)*(y1-y0)*.015||maxX<minX||maxY<minY)throw new Error('empty-frame-'+frame);
    const x=Math.max(x0,minX-3),y=Math.max(y0,minY-3),right=Math.min(x1,maxX+4),bottom=Math.min(y1,maxY+4);
    const {bodySize,...anchor}=bodyAnchor(decoded,x0,y0,x1,y1,true);sizes.push(bodySize);
    if(botanical)faces.push(botanicalFaceSize(decoded,x0,y0,x1,y1));
    const cell={x,y,w:right-x,h:bottom-y,...anchor};cells.push(cell);
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
  // One size calibration per page, never per frame. The median solid-body
  // diameter excludes narrow limbs, tails and small/detached tools.
  sizes.sort((a,b)=>a-b);const bodySize=(sizes[7]+sizes[8])/2;
  // A turned-away pose may hide the face; use the visible majority of the page.
  const visibleFaces=faces.filter(size=>size>0).sort((a,b)=>a-b),middle=Math.floor(visibleFaces.length/2);
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  // Reviewed palette-mask failures need a stable page-level calibration. Bind
  // it to the exact source pixels so replacement artwork cannot inherit it.
  const reviewed=botanical&&ART_CALIBRATION[sha256];
  const identitySize=reviewed?reviewed.identitySize:visibleFaces.length>=8?(visibleFaces[middle]+visibleFaces[Math.ceil(visibleFaces.length/2)-1])/2:0;
  return {width,height,frames:16,grid,clearRatio:Math.round(clearRatio*1000)/1000,maxAlpha,scale,bodySize,...(identitySize?{identitySize}:{}),cells,
    frameHashes:signatures,sha256};
}
function inspectPages(files,sources,options) {
  if(files.length!==2||files.some(file=>!fs.existsSync(file)))throw new Error('incomplete-original-pages');
  const pages=files.map((file,index)=>({src:sources[index],...inspectSheet(file,options)}));
  const frameHashes=pages.flatMap(page=>page.frameHashes);
  if(new Set(frameHashes).size!==32)throw new Error('repeated-frame-drawings-across-pages');
  return {...pages[0],frames:32,pages,cells:pages.flatMap((page,index)=>page.cells.map(cell=>({...cell,page:index}))),frameHashes,
    sha256:crypto.createHash('sha256').update(pages.map(page=>page.sha256).join(':')).digest('hex')};
}
function build({directory=path.join(ROOT,'skins/tracer/garden-art'),output=path.join(ROOT,'skins/tracer/garden-companion-atlas.js')}={}) {
  const manifest={version:2,kinds:{}},missing=[],rejected=[];let count=0;
  for(const kind of KINDS){manifest.kinds[kind]={normal:{},shiny:{}};for(const variant of ['normal','shiny'])for(const action of ACTIONS){
    const names=[1,2].map(part=>`${kind}-${variant}-${action}-v3-p${part}.png`),files=names.map(name=>path.join(directory,name));
    if(files.every(file=>fs.existsSync(file))){
      try{manifest.kinds[kind][variant][action]={...inspectPages(files,names.map(name=>'/garden-art/'+name),{botanical:true}),sourceVersion:3};count++;continue;}
      catch(error){rejected.push({file:names.join(', '),error:error.message});}
    }
    let name=`${kind}-${variant}-${action}-v2.png`,file=path.join(directory,name);
    if(!fs.existsSync(file)&&kind==='wildflower'&&['idle','greet','celebrate'].includes(action)){name=`${kind}-${variant}-${action}-v1.png`;file=path.join(directory,name);}
    if(!fs.existsSync(file)){missing.push(`${kind}/${variant}/${action}`);continue;}
    try{const sheet=inspectSheet(file,{botanical:true});manifest.kinds[kind][variant][action]={src:'/garden-art/'+name,sourceVersion:name.endsWith('-v1.png')?1:2,...sheet};count++;}
    catch(error){rejected.push({file:name,error:error.message});}
  }}
  const source='// Generated by dev/build-garden-companion-atlas.cjs from existing, inspected original PNGs.\n(function(root,data){if(typeof module===\'object\'&&module.exports)module.exports=data;else root.TracerGardenCompanionAtlas=data;})(typeof globalThis!==\'undefined\'?globalThis:this,'+JSON.stringify(manifest)+');\n';
  if(output){const next=output+'.tmp';fs.writeFileSync(next,source);fs.renameSync(next,output);}
  return {manifest,count,expected:KINDS.length*2*ACTIONS.length,missing,rejected};
}
if(require.main===module){const result=build();console.log(JSON.stringify({included:result.count,expected:result.expected,missing:result.missing.length,rejected:result.rejected},null,2));if(result.rejected.length)process.exitCode=1;}
module.exports={KINDS,ACTIONS,decode,frameGrid,bodyAnchor,botanicalFaceSize,inspectSheet,inspectPages,build};
