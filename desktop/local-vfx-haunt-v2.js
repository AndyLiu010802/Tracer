(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerLocalVfxHauntV2=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Independent original candidate: projected solid geometry, paired slits and
 // narrow grounded ribbons. Official footage is observation only, never texture.
 const duration=7000,TAU=Math.PI*2;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),finite=(n,f)=>Number.isFinite(n)?n:f;
 const lerp=(a,b,t)=>a+(b-a)*t,smooth=n=>{n=clamp(n,0,1);return n*n*(3-2*n);};
 const progress=(t,a,b)=>smooth((t-a)/(b-a));
 const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const light=norm([-.48,-.65,.78]);

 function sample(packet={},elapsedMs=0){
  packet=packet&&typeof packet==='object'?packet:{};
  const w=clamp(finite(packet.width,1280),1,32768),h=clamp(finite(packet.height,720),1,32768);
  const size=clamp(finite(packet.size,150),60,240),intensity=clamp(finite(packet.intensity,finite(packet.strength,.5)),0,1);
  const start={x:clamp(finite(packet.start?.x,w*.24),0,w),y:clamp(finite(packet.start?.y,h*.65),0,h)};
  const foot={x:clamp(finite(packet.target?.x,w*.63),0,w),y:clamp(finite(packet.target?.y,h*.81),0,h)};
  const t=clamp(finite(elapsedMs,0),0,duration),reduced=!!packet.reducedMotion||packet.motion==='reduced';
  const flight=0,rise=progress(t,800,2300),exit=progress(t,6000,6700);
  let phase=t>=duration?'finished':t<800?'gather':t<2300?'unfold':t<6000?'scan':t<6700?'breakup':'residue';
  const wobble=(reduced?.18:1)*Math.sin((t-2300)/650)*size*.017*rise*(1-exit);
  // The actual click is the ground point for the entire lifetime. Compatible
  // packet.start is reported but never used to reposition or launch the actor.
  const center={x:foot.x,y:foot.y-size*.18-rise*size*1.77+wobble};
  const scale=lerp(.38,1,rise)*(1-exit*.12);
  const yaw=Math.sin(t/1350)*.075*(reduced?.25:1),pitch=-.09;
  const alpha=progress(t,0,600)*(1-progress(t,6140,6650));
  return {elapsed:t,duration,durationMs:duration,phase,finished:t>=duration,width:w,height:h,size,intensity,seed:Number.isSafeInteger(packet.seed)?packet.seed>>>0:73129,reducedMotion:reduced,localSmoke:packet.localSmoke!==false,start,foot,anchor:foot,center,flight,rise,exit,scale,yaw,pitch,alpha,opacity:alpha,eye:progress(t,180,690)*(1-progress(t,6010,6350))};
 }

 function clear(ctx){
  const canvas=ctx.canvas;if(!canvas)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.restore();
 }

 function vertex(phi,theta){
  const s=Math.sin(phi),c=Math.cos(phi),front=Math.max(0,Math.sin(theta));
  let x=.56*s*Math.cos(theta)*(1+.15*c),y=-.42*c,z=.37*s*Math.sin(theta);
  const crown=Math.exp(-Math.pow((phi-.66)/.38,2));
  const left=Math.exp(-Math.pow((x+.32)/.15,2)),right=Math.exp(-Math.pow((x-.34)/.16,2)),middle=Math.exp(-Math.pow((x-.018)/.145,2));
  // Three broad folded plates grow out of the same volume, rather than strokes
  // glued to a sphere. Unequal side lobes bend outwards into the forehead.
  y-=crown*(.22*left+.205*right+.178*middle);
  x+=Math.sign(x)*crown*(.055*left+.067*right);
  z+=front*front*crown*(.11*left+.085*right+.13*middle);
  const ridge=Math.exp(-Math.pow(x/.105,2))+.55*Math.exp(-Math.pow((Math.abs(x)-.245)/.065,2));
  z+=front*front*ridge*.065*Math.sin(phi);
  if(y>.08){x*=1-(y-.08)*.82;z*=1-(y-.08)*.44;}
  return [x,y,z];
 }
 const mesh=[];
 function surfaceNormal(phi,theta){
  if(Math.sin(phi)<.00001)return [0,Math.cos(phi)>0?-1:1,0];
  const a=sub(vertex(clamp(phi+.0008,0,Math.PI),theta),vertex(clamp(phi-.0008,0,Math.PI),theta));
  const b=sub(vertex(phi,theta+.0008),vertex(phi,theta-.0008));
  let n=norm(cross(a,b));if(dot(n,vertex(phi,theta))<0)n=n.map(x=>-x);return n;
 }
 for(let p=0;p<28;p++)for(let u=0;u<64;u++){
  const points=[vertex(Math.PI*p/28,TAU*u/64),vertex(Math.PI*(p+1)/28,TAU*u/64),vertex(Math.PI*(p+1)/28,TAU*(u+1)/64),vertex(Math.PI*p/28,TAU*(u+1)/64)];
  const normals=[surfaceNormal(Math.PI*p/28,TAU*u/64),surfaceNormal(Math.PI*(p+1)/28,TAU*u/64),surfaceNormal(Math.PI*(p+1)/28,TAU*(u+1)/64),surfaceNormal(Math.PI*p/28,TAU*(u+1)/64)];
  mesh.push({points,normals,center:points[0].map((_,i)=>points.reduce((a,v)=>a+v[i],0)/4)});
 }

 function rotate(v,frame){
  const cy=Math.cos(frame.yaw),sy=Math.sin(frame.yaw),cp=Math.cos(frame.pitch),sp=Math.sin(frame.pitch);
  const x=v[0]*cy+v[2]*sy,z=-v[0]*sy+v[2]*cy;
  return [x,v[1]*cp-z*sp,v[1]*sp+z*cp];
 }
 function project(v,frame){const r=rotate(v,frame),perspective=3.2/(3.2-r[2]);return {x:frame.center.x+r[0]*frame.size*frame.scale*perspective,y:frame.center.y+r[1]*frame.size*frame.scale*perspective,z:r[2]};}
 const shineDirection=norm([-.22,-.45,1]);
 function vertexColor(v,n,frame){
  n=norm(rotate(n,frame));
  const diffuse=Math.max(0,dot(n,light)),rim=Math.pow(1-Math.max(0,n[2]),2)*.19;
  const spec=Math.pow(Math.max(0,dot(n,shineDirection)),19)*.32;
  const upper=clamp((.14-v[1])/.62,0,1),x=v[0];
  const fold=Math.exp(-Math.pow((x+.045+.155*upper)/.026,2))+.9*Math.exp(-Math.pow((x-.05-.18*upper)/.028,2));
  const vein=(Math.exp(-Math.pow(x/.024,2))*.13+fold*.34)*Math.max(0,v[2])/.42*upper;
  const shade=Math.max(.02,.13+diffuse*.67+rim+spec-vein*.33);
  return [4+shade*22+spec*15,8+shade*46+spec*24,16+shade*70+spec*34];
 }
 function rasterTriangle(data,width,height,a,b,c){
  const d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(d)<.00001)return;
  const left=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),right=Math.min(width-1,Math.ceil(Math.max(a.x,b.x,c.x)));
  const top=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),bottom=Math.min(height-1,Math.ceil(Math.max(a.y,b.y,c.y)));
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
   const px=x+.5,py=y+.5;
   const wa=((b.y-c.y)*(px-c.x)+(c.x-b.x)*(py-c.y))/d;
   const wb=((c.y-a.y)*(px-c.x)+(a.x-c.x)*(py-c.y))/d,wc=1-wa-wb;
   if(wa<-.000001||wb<-.000001||wc<-.000001)continue;
   const index=(y*width+x)*4;
   data[index]=wa*a.color[0]+wb*b.color[0]+wc*c.color[0];
   data[index+1]=wa*a.color[1]+wb*b.color[1]+wc*c.color[1];
   data[index+2]=wa*a.color[2]+wb*b.color[2]+wc*c.color[2];data[index+3]=255;
  }
 }
 function rasterShell(ctx,frame,image){
  const faces=[];
  for(const face of mesh){
   const vertices=face.points.map((v,i)=>({...project(v,frame),color:vertexColor(v,face.normals[i],frame)}));
   const vs=face.points.map(v=>rotate(v,frame));let n=norm(cross(sub(vs[1],vs[0]),sub(vs[3],vs[0])));
   const center=rotate(face.center,frame);if(dot(n,center)<0)n=n.map(x=>-x);if(n[2]<-.04)continue;
   faces.push({depth:center[2],vertices});
  }
  faces.sort((a,b)=>a.depth-b.depth);image.data.fill(0);
  for(const face of faces){const v=face.vertices;rasterTriangle(image.data,image.width,image.height,v[0],v[1],v[2]);rasterTriangle(image.data,image.width,image.height,v[0],v[2],v[3]);}
  ctx.putImageData(image,0,0);
 }
 function shell(ctx,frame){
  const faces=[];
  for(const face of mesh){
   const vs=face.points.map(v=>rotate(v,frame));
   let n=norm(cross(sub(vs[1],vs[0]),sub(vs[3],vs[0])));
   const c=rotate(face.center,frame);if(dot(n,c)<0)n=n.map(v=>-v);
   if(n[2]<-.04)continue;
   const diffuse=Math.max(0,dot(n,light)),rim=Math.pow(1-Math.max(0,n[2]),2)*.23;
   const spec=Math.pow(Math.max(0,dot(n,norm([-.22,-.45,1]))),23)*.37;
   const upper=clamp((.14-face.center[1])/.62,0,1),x=face.center[0];
   const fold=Math.exp(-Math.pow((x+.045+.155*upper)/.026,2))+.9*Math.exp(-Math.pow((x-.05-.18*upper)/.028,2));
   const vein=(Math.exp(-Math.pow(x/.024,2))*.16+fold*.36)*Math.max(0,face.center[2])/.42*upper;
   const shade=Math.max(.02,.12+diffuse*.65+rim+spec-vein*.34);
   faces.push({c,points:face.points.map(v=>project(v,frame)),shade,spec,rim});
  }
  faces.sort((a,b)=>a.c[2]-b.c[2]);
  ctx.save();ctx.globalAlpha=frame.alpha;
  // Opaque overlapping faces render into the head tile. Their own silhouette
  // preserves concave folds; a convex-hull backing would flatten the crown.
  for(const f of faces){
   const r=Math.round(4+f.shade*21+f.spec*16),g=Math.round(8+f.shade*43+f.spec*25),b=Math.round(16+f.shade*66+f.spec*35);
   ctx.beginPath();ctx.moveTo(f.points[0].x,f.points[0].y);for(let i=1;i<4;i++)ctx.lineTo(f.points[i].x,f.points[i].y);ctx.closePath();
   ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=1.15;ctx.fill();ctx.stroke();
  }
  // A continuous soft light film integrates the tessellated surface without
  // exposing grid seams; the mesh still supplies view-dependent depth/occlusion.
  ctx.save();ctx.globalCompositeOperation='source-atop';
   const soft=ctx.createRadialGradient(frame.center.x-frame.size*.18,frame.center.y-frame.size*.25,frame.size*.03,frame.center.x-frame.size*.13,frame.center.y-frame.size*.2,frame.size*.78);
   soft.addColorStop(0,'rgba(46,75,106,.25)');soft.addColorStop(.55,'rgba(24,43,68,.22)');soft.addColorStop(1,'rgba(3,8,19,.06)');ctx.fillStyle=soft;ctx.fillRect(frame.center.x-frame.size,frame.center.y-frame.size,frame.size*2,frame.size*2);ctx.restore();
  ctx.restore();
 }

 function frontDepth(x,y){return .37*Math.sqrt(Math.max(.02,1-Math.pow(x/.53,2)-Math.pow(y/.46,2)))+.018;}
 function eyes(ctx,frame){
  if(Math.cos(frame.yaw)<.05||frame.eye<=0)return;
  ctx.save();ctx.globalAlpha=frame.alpha*frame.eye;
  for(const side of [-1,1]){
   const coords=[[.35,-.105],[.295,-.078],[.225,.018],[.12,.112],[.205,.082],[.293,.012]];
   const pts=coords.map(([x,y])=>project([x*side,y,frontDepth(x,y)],frame));
   ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
   ctx.bezierCurveTo(pts[1].x,pts[1].y,pts[2].x,pts[2].y,pts[3].x,pts[3].y);
   ctx.bezierCurveTo(pts[4].x,pts[4].y,pts[5].x,pts[5].y,pts[0].x,pts[0].y);ctx.closePath();
   const g=ctx.createLinearGradient(pts[0].x,pts[0].y,pts[3].x,pts[3].y);
   g.addColorStop(0,'#a51670');g.addColorStop(.25,'#f33da0');g.addColorStop(.62,'#ffd8f3');g.addColorStop(1,'#de238f');
   ctx.shadowColor='#e2298c';ctx.shadowBlur=frame.size*.072*(.55+frame.intensity*.45);ctx.fillStyle=g;ctx.fill();
   ctx.shadowBlur=0;
   const a=project([.275*side,-.017,frontDepth(.275,-.017)+.02],frame),b=project([.172*side,.06,frontDepth(.172,.06)+.02],frame);
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#ffe4f8';ctx.lineWidth=frame.size*.011*frame.scale;ctx.stroke();
  }
  ctx.restore();
 }

 function ribbon(ctx,points,width,color,edge){
  const left=[],right=[];
  for(let i=0;i<points.length;i++){
   const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],n=norm([-(b.y-a.y),b.x-a.x]);
   const taper=.22+.78*Math.sin(Math.PI*(i/(points.length-1))*.86),half=width*taper/2;
   left.push({x:points[i].x+n[0]*half,y:points[i].y+n[1]*half});right.push({x:points[i].x-n[0]*half,y:points[i].y-n[1]*half});
  }
  ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);for(const p of left.slice(1))ctx.lineTo(p.x,p.y);for(const p of right.reverse())ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fillStyle=color;ctx.fill();
  if(edge){ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);for(const p of left.slice(1))ctx.lineTo(p.x,p.y);ctx.strokeStyle=edge;ctx.lineWidth=.8;ctx.stroke();}
 }

 function supports(ctx,frame){
  if(frame.rise<=0||frame.phase==='residue')return;
  ctx.save();ctx.globalAlpha=frame.alpha*frame.rise;
  for(let n=0;n<4;n++){
   const side=n%2?-1:1,offset=(n-1.5)*.12;
   const base=project([offset,.3,-.12+(n%2)*.15],frame),points=[];
   const damp=frame.reducedMotion?.22:1;
   const frequency=[.58,.91,.35,.71][n],amplitude=[.16,.095,.14,.063][n];
   const twist=frame.elapsed/1000*damp*[.42,.67,.29,.51][n]+[.4,2.9,1.4,4.6][n];
   const footX=frame.foot.x+frame.size*[-.038,.043,-.008,.016][n];
   for(let i=0;i<=34;i++){
    const t=i/34,s=Math.sin(Math.PI*t);
    // A stable long S is the support's resting shape. Independent small drift
    // bends its material without periodically collapsing all four into lines.
    const curl=side*Math.sin(t*TAU*.82+[0,.36,.7,1.2][n])*frame.size*[.2,.17,.10,.08][n]*s+Math.sin(t*TAU*frequency+twist)*frame.size*amplitude*s*.45;
    const bend=t>.7?Math.sin((t-.7)/.3*Math.PI):0;
    const x=lerp(base.x,footX,t)+curl+side*frame.size*(n===2?.105:.038)*Math.sin(t*Math.PI*1.4)*s+side*frame.size*(n<2?.2:.065)*bend;
    const y=lerp(base.y,frame.foot.y,t)+Math.sin(t*TAU*(.63+n*.21)+twist)*frame.size*(.027+n*.008)*s-frame.size*.045*bend*bend;
    points.push({x,y});
   }
   const gradient=ctx.createLinearGradient(base.x,base.y,frame.foot.x,frame.foot.y);gradient.addColorStop(0,'#071021');gradient.addColorStop(.48,n%2?'#10213b':'#080e1c');gradient.addColorStop(1,'#030b14');
   ribbon(ctx,points,frame.size*(n<2?.043:.024),gradient,n<2?'rgba(38,71,111,.48)':'rgba(24,48,78,.4)');
  }
  ctx.restore();
 }

 function wisps(ctx,frame){
  if(frame.elapsed>2300)return;
  const active=(1-frame.rise)*frame.alpha;
  ctx.save();ctx.globalAlpha=active*.64;
  for(let n=0;n<3;n++){
   const angle=frame.elapsed/1000*(frame.reducedMotion?.2:1)+n*2.1,points=[];
   for(let i=0;i<=28;i++){
    const t=i/28,a=angle+t*Math.PI*1.35,r=frame.size*(.26+t*.52)*frame.scale;
    points.push({x:frame.center.x+Math.cos(a)*r,y:frame.center.y+Math.sin(a)*r*.43+(t*t)*frame.size*.08});
   }
   ribbon(ctx,points,frame.size*.026,'#090f20','rgba(33,65,106,.55)');
  }
  ctx.restore();
 }

 function groundAndScan(ctx,frame){
  if(frame.elapsed<650||frame.elapsed>=6700)return;
  const pulse=progress(frame.elapsed,650,950)*(1-progress(frame.elapsed,1150,1750));
  ctx.save();ctx.globalAlpha=frame.alpha;
  const ground=ctx.createRadialGradient(frame.foot.x,frame.foot.y,0,frame.foot.x,frame.foot.y,frame.size*.43);
  ground.addColorStop(0,`rgba(7,22,39,${.27*frame.rise})`);ground.addColorStop(1,'rgba(4,10,19,0)');
  ctx.save();ctx.translate(frame.foot.x,frame.foot.y);ctx.scale(1,.17);ctx.fillStyle=ground;ctx.restore();
  ctx.beginPath();ctx.ellipse(frame.foot.x,frame.foot.y,frame.size*.42,frame.size*.055,0,0,TAU);ctx.fillStyle='rgba(7,19,34,.14)';ctx.fill();
  if(pulse>0){
   ctx.globalAlpha=pulse*.36;
   for(let i=0;i<2;i++){ctx.beginPath();ctx.ellipse(frame.foot.x,frame.foot.y-frame.size*.25,frame.size*(.24+pulse*.68+i*.1),frame.size*(.13+pulse*.38),0,0,TAU);ctx.strokeStyle=i?'#2c5c83':'#4cabc2';ctx.lineWidth=1.5;ctx.stroke();}
  }
  if(frame.phase==='scan'){
   const cycle=((frame.elapsed-2300)%1400)/1400;
   ctx.globalAlpha=Math.sin(Math.PI*clamp(cycle,0,1))*.115*frame.intensity;
   ctx.beginPath();ctx.ellipse(frame.center.x,frame.center.y,frame.size*(.48+cycle*.56),frame.size*(.4+cycle*.42),0,0,TAU);
   ctx.strokeStyle='#7084c0';ctx.lineWidth=1.1;ctx.stroke();
  }
  ctx.restore();
 }

 function breakup(ctx,frame){
  if(frame.elapsed<6000)return;
  const p=progress(frame.elapsed,6000,7000),alpha=Math.sin(Math.PI*p)*(1-p)*.72;
  ctx.save();ctx.globalAlpha=alpha;
  const count=frame.reducedMotion?14:38;
  for(let n=0;n<count;n++){
   const random=()=>{const value=Math.sin(n*17.38+7.16)*43758.5453;return value-Math.floor(value);},jitter=random();
   const a=n*2.39996+jitter*.9,r=frame.size*(.035+jitter*.3+p*(.2+(n%5)*.073));
   const x=frame.center.x+Math.cos(a)*r,y=frame.center.y+Math.sin(a)*r*.73-p*frame.size*(.12+jitter*.23);
   const s=frame.size*(.01+jitter*.027)*(1-p*.65);
   ctx.save();ctx.translate(x,y);ctx.rotate(a+p*.5);ctx.beginPath();ctx.moveTo(-s,-s*.4);ctx.lineTo(s*.55,-s);ctx.lineTo(s,s*.15);ctx.lineTo(-s*.2,s*.74);ctx.closePath();ctx.fillStyle=n%6?'#0b1a2c':'#284769';ctx.fill();ctx.restore();
  }
  ctx.restore();
 }

 function smoke(ctx,frame,front=false){
  if(!frame.localSmoke||frame.alpha<=0||frame.intensity<=0)return;
  const time=frame.elapsed/1000,motion=frame.reducedMotion?.18:1;
  const envelope=progress(frame.elapsed,80,750)*(1-progress(frame.elapsed,5900,6750));
  ctx.save();ctx.globalCompositeOperation='source-over';
  // Each scale has a different drift/roll speed. All are local transparent
  // plumes; no flat screen rectangle or background screenshot is sampled.
  const count=front?4:13;
  for(let n=0;n<count;n++){
   const ground=!front&&n<7;
   const phase=n*2.17+time*motion*(ground?.23:.38+n*.017);
   const reach=ground?.13+(n%4)*.08:.28+(n%3)*.08;
   const centerX=(ground?frame.foot.x:frame.center.x)+Math.sin(phase)*frame.size*reach;
   const centerY=ground?frame.foot.y-frame.size*(.06+(n%3)*.026):frame.center.y+Math.cos(phase*.71)*frame.size*(.2+(n%3)*.08);
   const rx=frame.size*(ground?.3+(n%4)*.09:.15+(n%3)*.075),ry=frame.size*(ground?.065+(n%3)*.027:.2+(n%3)*.055);
   const alpha=envelope*frame.intensity*(front?.065:ground?.23:.10)*(.7+.3*Math.sin(phase+1.2));
   ctx.save();ctx.translate(centerX,centerY);ctx.scale(rx,ry);
   const haze=ctx.createRadialGradient(-.12,-.08,0,0,0,1);
   haze.addColorStop(0,`rgba(${ground?'2,8,15':'4,13,25'},${alpha})`);
   haze.addColorStop(.45,`rgba(7,21,36,${alpha*.67})`);haze.addColorStop(1,'rgba(3,10,20,0)');
   ctx.beginPath();ctx.ellipse(0,0,1,1,0,0,TAU);ctx.fillStyle=haze;ctx.fill();ctx.restore();
  }
  // A few tapered ink ribbons give the intermediate layer coherent curl and
  // parallax, rather than substituting a single radial gradient for smoke.
  if(!front)for(let n=0;n<3;n++){
   const points=[],phase=time*motion*(.32+n*.13)+n*1.7;
   for(let i=0;i<=25;i++){
    const t=i/25,a=phase+t*Math.PI*1.1;
    points.push({x:frame.center.x+Math.cos(a)*frame.size*(.42+t*.24),y:frame.center.y+Math.sin(a)*frame.size*(.18+t*.22)+t*frame.size*.11});
   }
   ctx.globalAlpha=envelope*frame.intensity*.13;
   ribbon(ctx,points,frame.size*.017,'#0b192b','rgba(40,68,104,.33)');
  }
  ctx.restore();
 }

 const TILE_SIZE=768,TILE_SCALE=2;
 function create(options={}){
  options=options&&typeof options==='object'?options:{};
  let tile=null,tileCtx=null,raster=null,destroyed=false,allocations=0,rasterAllocations=0,renders=0,headComposites=0,headMode='uninitialized';
  const makeCanvas=typeof options.createCanvas==='function'?options.createCanvas:null;
  let smokeEngine=options.smoke||null;
  if(smokeEngine&&(typeof smokeEngine.drawBehind!=='function'||typeof smokeEngine.drawFront!=='function'))throw new TypeError('haunt-v2-smoke-engine-invalid');
  function ensureTile(ctx){
   if(tile)return;
   let candidate;
   if(makeCanvas)candidate=makeCanvas(TILE_SIZE,TILE_SIZE);
   else if(ctx.canvas?.ownerDocument?.createElement)candidate=ctx.canvas.ownerDocument.createElement('canvas');
   else if(typeof OffscreenCanvas==='function')candidate=new OffscreenCanvas(TILE_SIZE,TILE_SIZE);
   else throw new Error('haunt-v2-canvas-factory-required');
   if(!candidate||typeof candidate.getContext!=='function')throw new TypeError('haunt-v2-head-tile-invalid');
   let context;
   try{candidate.width=TILE_SIZE;candidate.height=TILE_SIZE;context=candidate.getContext('2d');if(!context)throw new Error('haunt-v2-head-context-unavailable');}
   catch(error){try{candidate.width=1;candidate.height=1;}catch{}throw error;}
   tile=candidate;tileCtx=context;
   allocations++;
  }
  function paintHead(ctx,frame){
   if(frame.alpha<=0)return;
   ensureTile(ctx);
   clear(tileCtx);
   // Head geometry is drawn fully opaque first, including all overlapping mesh
   // faces and crown layers. Exactly one alpha operation composites the tile.
   const local={...frame,center:{x:TILE_SIZE/2,y:TILE_SIZE/2},size:frame.size*TILE_SCALE,alpha:1,opacity:1};
   if(typeof tileCtx.createImageData==='function'&&typeof tileCtx.putImageData==='function'){
    if(!raster){const image=tileCtx.createImageData(TILE_SIZE,TILE_SIZE);if(!image||!ArrayBuffer.isView(image.data)||image.data.BYTES_PER_ELEMENT!==1||image.width!==TILE_SIZE||image.height!==TILE_SIZE||image.data.length!==TILE_SIZE*TILE_SIZE*4)throw new Error('haunt-v2-raster-buffer-invalid');raster=image;rasterAllocations++;}
    headMode='gouraud-raster';rasterShell(tileCtx,local,raster);
   }else{headMode='vector-fallback';shell(tileCtx,local);}
   eyes(tileCtx,local);
   ctx.save();
   try{ctx.globalAlpha=frame.alpha;ctx.globalCompositeOperation='source-over';ctx.drawImage(tile,frame.center.x-TILE_SIZE/(TILE_SCALE*2),frame.center.y-TILE_SIZE/(TILE_SCALE*2),TILE_SIZE/TILE_SCALE,TILE_SIZE/TILE_SCALE);headComposites++;}finally{ctx.restore();}
  }
  return Object.freeze({
   render(ctx,packet,elapsedMs){
    if(!ctx||!ctx.canvas)throw new TypeError('haunt-v2-context-required');
    const frame=sample(packet,elapsedMs);headComposites=0;
    if(destroyed)return {...frame,phase:'destroyed',finished:true,alpha:0,opacity:0,eye:0};
    if(frame.finished)return frame;
    renders++;
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
    try{if(smokeEngine)smokeEngine.drawBehind(ctx,frame);else smoke(ctx,frame);groundAndScan(ctx,frame);wisps(ctx,frame);supports(ctx,frame);paintHead(ctx,frame);if(smokeEngine)smokeEngine.drawFront(ctx,frame);else smoke(ctx,frame,true);breakup(ctx,frame);}finally{ctx.restore();}
    return frame;
   },
   destroy(){
    if(destroyed)return;
    destroyed=true;
    if(tile){tile.width=1;tile.height=1;}
    tile=null;tileCtx=null;raster=null;headComposites=0;headMode='destroyed';
    smokeEngine=null;
   },
   getDiagnostics(){const headTileBytes=tile?TILE_SIZE*TILE_SIZE*4:0,headRasterBytes=raster?raster.data.byteLength:0;return Object.freeze({destroyed,allocations,rasterAllocations,renders,headComposites,headMode,headTileCount:tile?1:0,headTileWidth:tile?TILE_SIZE:0,headTileHeight:tile?TILE_SIZE:0,headTileBytes,headRasterBytes,totalHeadBytes:headTileBytes+headRasterBytes,externalSmoke:!!smokeEngine});}
  });
 }
 const defaults=new WeakMap();
 function render(ctx,packet,elapsedMs){
  if(!ctx||!ctx.canvas)throw new TypeError('haunt-v2-context-required');
  let renderer=defaults.get(ctx);if(!renderer){renderer=create();defaults.set(ctx,renderer);}
  return renderer.render(ctx,packet,elapsedMs);
 }
 function destroy(ctx){const renderer=defaults.get(ctx);if(renderer){renderer.destroy();defaults.delete(ctx);}}
 return Object.freeze({create,render,destroy,sample,clear,duration,durationMs:duration,metadata:Object.freeze({durationMs:duration,version:'haunt-v2-volume',art:'original-smooth-gouraud-shell-single-alpha',clearOwner:'compositor',headTileSize:TILE_SIZE,headTileBytes:TILE_SIZE*TILE_SIZE*4,maxHeadRasterBytes:TILE_SIZE*TILE_SIZE*4,maxTotalHeadBytes:TILE_SIZE*TILE_SIZE*8,smokeOwner:'compositor'})});
});
