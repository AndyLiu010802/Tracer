'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../skins/tracer/fishing-anime-effects');
const P=require('../skins/tracer/fishing-onepiece-painted'),R=require('../skins/tracer/fishing-rod-renderer'),F=require('../public/fishing-model');
const entry=id=>({id,width:2048,height:768,bounds:[50,180,1995,640],base:[60,350],tip:[1990,320]});
test('every One Piece skin has a distinct bundled original painting, and other collections retain their renderer',()=>{
  const rods=F.catalog.rods.filter(r=>r.collection==='onepiece');assert.equal(rods.length,45);assert.deepEqual(Object.keys(P.assets).sort(),rods.map(r=>r.id).sort());assert.equal(new Set(Object.values(P.assets).map(a=>a.src)).size,45);
  for(const r of rods){assert(A.presentation[r.animeAction],r.id+' conventional effect family');for(const phase of Object.keys(A.cleanDurations)){const end=A.duration(r.id,phase);assert.equal(A.visible(phase,end-1,r.id),true);assert.equal(A.visible(phase,end,r.id),false);}for(const phase of ['idle','charging','waiting','reeling','escaped'])assert.equal(A.visible(phase,150,r.id),false);const bytes=fs.readFileSync(path.join(__dirname,'../skins/tracer',P.assets[r.id].src));assert.equal(bytes.toString('ascii',12,16),'IHDR');assert(bytes.readUInt32BE(16)>=1500,r.id+' full-size original');assert.equal(bytes[25],6,r.id+' transparent RGBA');}
  for(const r of F.catalog.rods.filter(r=>r.collection!=='onepiece'))assert.equal(P.assets[r.id],undefined);
});
test('painted geometry preserves source proportions, finite coordinates, rigid weapons and shared load endpoints',()=>{
  const origin=R.deformed([0,0,0],0),tip=R.deformed([1,0,0],0),length=Math.hypot(tip.x-origin.x,tip.y-origin.y);
  for(const id of Object.keys(P.assets))for(const bend of[-.24,0,.24]){const e=entry(id),v=P.vertices(e,bend,R.deformed,length);assert(v.every(Number.isFinite),id);assert.equal(v.length,64*24);const span=Math.hypot(e.tip[0]-e.base[0],e.tip[1]-e.base[1]),ux=(e.tip[0]-e.base[0])/span,uy=(e.tip[1]-e.base[1])/span,root=R.deformed([0,0,0],bend),end=R.deformed([1,0,0],bend),dx=end.x-root.x,dy=end.y-root.y,l=Math.hypot(dx,dy);
    for(let i=0;i<v.length;i+=4){const x=v[i+2]*e.width,y=v[i+3]*e.height,s=((x-e.base[0])*ux+(y-e.base[1])*uy)/span,n=(-(x-e.base[0])*uy+(y-e.base[1])*ux)*length/span,p=P.assets[id].rig==='weapon'?{x:root.x+dx*s-dy/l*n,y:root.y+dy*s+dx/l*n}:R.deformed([s,n,0],bend);assert(Math.hypot(p.x-v[i],p.y-v[i+1])<.0001,id+' exact skinning');}
  }
});
test('full sword skins are rigid, including the straight three-blade Zoro correction',()=>{
  for(const id of ['anime_zoro','anime_mihawk','anime_brook','anime_law','anime_shanks','anime_whitebeard','anime_alvida','anime_kuro','anime_tashigi','anime_moria','anime_weevil','anime_yamatooni','anime_kaido','anime_bigmom'])assert.equal(P.assets[id].rig,'weapon');
  assert.equal(P.assets.anime_luffy.rig,undefined);assert.equal(P.assets.anime_nika.rig,undefined);
  for(const file of ['index.html','fishing-desktop.html']){const html=fs.readFileSync(path.join(__dirname,'../skins/tracer',file),'utf8');assert(html.indexOf('/fishing-onepiece-painted.js')<html.indexOf('/fishing-rod-renderer.js'));}
});

test('painted skin storage is reused without accumulating deformation or changing UVs',()=>{
  const e=entry('anime_luffy'),length=Math.hypot(R.curvePoint(1,0).x-R.curvePoint(0,0).x,R.curvePoint(1,0).y-R.curvePoint(0,0).y);
  const data=P.vertices(e,0,R.deformed,length),neutral=Array.from(data),uv=neutral.filter((_,i)=>i%4>=2);
  for(const bend of [.24,-.24,.12,-.07]){assert.equal(P.vertices(e,bend,R.deformed,length),data);assert.deepEqual(Array.from(data).filter((_,i)=>i%4>=2),uv);}
  assert.deepEqual(Array.from(P.vertices(e,0,R.deformed,length)),neutral);
});

test('software weapons use one image draw and flexible grips batch without changing bend resolution',()=>{
  const length=Math.hypot(R.curvePoint(1,0).x-R.curvePoint(0,0).x,R.curvePoint(1,0).y-R.curvePoint(0,0).y);
  for(const id of ['anime_mihawk','anime_zoro','anime_kaido','anime_luffy','anime_kuma']){
    const e={...entry(id),image:{}},calls=[];let clips=0,depth=0;
    const ctx={save(){depth++;},restore(){depth--;},beginPath(){},closePath(){},moveTo(){},lineTo(){},clip(){clips++;},transform(...args){assert(args.every(Number.isFinite));},drawImage(...args){calls.push(args);}};
    const data=P.vertices(e,.23,R.deformed,length,P.assets[id].rig==='weapon'?1:64);P.draw2D(ctx,e,data);assert.equal(depth,0);
    if(P.assets[id].rig==='weapon'){assert.equal(calls.length,1);assert.equal(clips,0);}else{assert.equal(data.length,64*24);assert(calls.length<100&&calls.length>60);assert.equal(clips,calls.length-1);}
    for(const c of calls){assert.equal(c.length,9);assert(c[3]>0&&c[4]>0);assert(c[1]>=0&&c[1]+c[3]<=e.width);assert(c[2]>=0&&c[2]+c[4]<=e.height);assert(c[3]<e.width);}
  }
});

test('continuous hardware animation reuses texture, buffer allocation and uniform lookups',()=>{
  const calls=[],constants=['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','DYNAMIC_DRAW','FLOAT','TEXTURE_2D','UNPACK_PREMULTIPLY_ALPHA_WEBGL','RGBA','UNSIGNED_BYTE','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','LINEAR','TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE','TEXTURE0','DEPTH_TEST','BLEND','ONE','ONE_MINUS_SRC_ALPHA','TRIANGLES'];
  const gl=new Proxy(Object.fromEntries(constants.map((k,i)=>[k,i+1])),{get(o,k){if(k in o)return o[k];if(k==='getShaderParameter'||k==='getProgramParameter')return()=>true;if(k==='getAttribLocation')return(_p,name)=>name==='aPoint'?0:1;return(...args)=>{calls.push([k,...args]);return{};};}});
  const renderer=P.createGL(gl),e={...entry('anime_luffy'),image:{}},data=new Float32Array(64*24);
  for(let i=0;i<120;i++){data[0]=i/100;renderer.draw(e,data,[506.8,674],128);}
  assert.equal(calls.filter(c=>c[0]==='bufferData').length,1);assert.equal(calls.filter(c=>c[0]==='bufferSubData').length,119);assert.equal(calls.filter(c=>c[0]==='texImage2D').length,1);assert.equal(calls.filter(c=>c[0]==='getUniformLocation').length,3);
  renderer.destroy();for(const kind of ['deleteTexture','deleteBuffer','deleteProgram'])assert.equal(calls.filter(c=>c[0]===kind).length,1);
});
