(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingRodRenderer=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const Crafted=typeof module==='object'&&module.exports?require('./fishing-crafted-rods'):globalThis.TracerFishingCraftedRods;
  const OnePiecePainted=typeof module==='object'&&module.exports?require('./fishing-onepiece-painted'):globalThis.TracerFishingOnePiecePainted;
  const NarutoPainted=typeof module==='object'&&module.exports?require('./fishing-naruto-painted'):globalThis.TracerFishingNarutoPainted;
  const ValorantPainted=typeof module==='object'&&module.exports?require('./fishing-valorant-painted'):globalThis.TracerFishingValorantPainted;
  const RelicPainted=typeof module==='object'&&module.exports?require('./fishing-relic-painted'):globalThis.TracerFishingRelicPainted;
  const BasicPainted=typeof module==='object'&&module.exports?require('./fishing-basic-painted'):globalThis.TracerFishingBasicPainted;
  const paintedFor=rod=>BasicPainted?.assets[typeof rod==='string'?rod:rod?.id]?BasicPainted:RelicPainted?.assets[typeof rod==='string'?rod:rod?.id]?RelicPainted:ValorantPainted?.assets[typeof rod==='string'?rod:rod?.id]?ValorantPainted:NarutoPainted?.assets[typeof rod==='string'?rod:rod?.id]?NarutoPainted:OnePiecePainted;
  const Lighting=typeof module==='object'&&module.exports?require('./fishing-lighting'):globalThis.TracerFishingLighting;
  const W=250.8,H=418,PAD=128,TAU=Math.PI*2,GRIP={x:W*.11,y:H*.94},TIP={x:W*.9,y:H*.04},L=Math.hypot(TIP.x-GRIP.x,TIP.y-GRIP.y),AXIS=[(TIP.x-GRIP.x)/L,(TIP.y-GRIP.y)/L],NORMAL=[-AXIS[1],AXIS[0]];
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0)),mix=(a,b,t)=>a+(b-a)*t;
  const rgb=hex=>[0,2,4].map(i=>parseInt(hex.slice(1+i,3+i),16)/255);
  const PALETTES={
    bamboo:['#d2a43b','#bc8b42','#28633c','#f5ce75','#e8b751',1],
    willow:['#875024','#aa743d','#3e7834','#d2a856','#86a942',5],
    carbon:['#172b3f','#111e2b','#233e51','#b8d4e2','#e9b54c',3],
    copper:['#be6030','#d38c4b','#146a78','#efad4b','#8bddde',6],
    rosewood:['#861b29','#592330','#672c31','#e1d3bd','#deaa62',5],
    tide:['#f07760','#c55c47','#087c98','#ffc991','#43dce9',0],
    clockwork:['#08727b','#174447','#75452a','#dca047','#72eedc',6],
    frost:['#379ce8','#1e66ac','#bdeeff','#d5f4ff','#82e9ff',0],
    jade:['#168749','#d1dcc0','#136b48','#ecc45b','#72e8aa',0],
    moon:['#442477','#272051','#79619d','#e4bc59','#aaa5ff',0],
    phoenix:['#b92622','#822119','#eb672a','#f7bd48','#ffe087',5],
    cloud:['#b7e4f0','#d6e3df','#42a7c6','#efcc8a','#f1fbff',0],
    astral:['#162d70','#1b2250','#454b8d','#eab958','#9acaff',3],
    dragon:['#17624b','#18483b','#176d4c','#e8b34b','#77e29a',6],
    lotus:['#317f55','#d796a8','#e4adbc','#eac16e','#ffb4d3',0],
    guandao:['#126149','#164937','#8f2c25','#efd073','#6cf1ac',0],
    golden:['#f6c94e','#c98b20','#e7b02f','#ffe69a','#fff1b9',6],
    katana:['#d5e6f0','#182e3b','#182637','#aebdcd','#f0be60',6],
    walnut:['#795037','#473026','#b98b61','#cfa96d','#e1cda3',7],
    porcelain:['#e6eee9','#cbdcdd','#315e85','#c3d4df','#5f9dc1',8],
    citrus:['#dc782c','#a3814a','#efe0b9','#c7b784','#69944e',0],
    amber:['#dc9c39','#443629','#926a34','#bd8e50','#f5dca3',10],
    vinyl:['#175386','#152432','#3e78a9','#bbcbd2','#b79964',0],
    nautilus:['#326f89','#c1bbaa','#467c91','#c6dbdf','#dfbea0',12],
    alpine:['#53869a','#263d47','#bd6746','#bccbd2','#a4e0ed',6],
    candlewyrm:['#291f27','#382026','#a34134','#bfa078','#f07d5b',16],
    thunderdrum:['#1f4668','#313643','#35608d','#c9a15d','#bddded',0],
    abysswhale:['#203b54','#263741','#377c93','#a7c3ce','#70bfd1',0],
    foxfire:['#a33f30','#46262c','#d88950','#d2ae73','#f1d4a8',0],
    lilybell:['#467761','#e0dfcf','#668e76','#becdd0','#f2eee1',0],
    sandscript:['#b89a59','#5a4c37','#446d75','#d7be7d','#e6d9ad',13],
    frostwolf:['#6a9aac','#283c52','#9ec3d0','#d9e8ea','#b7e4ee',14],
    rosevow:['#413341','#322532','#753b55','#beb8bc','#c7556d',0],
    inkjudge:['#263d3d','#343936','#9b302f','#bd9e69','#dfd6b7',0],
    butterfly:['#77649d','#3a3456','#a5a4c9','#c9c5df','#bddddc',12],
    sunforge:['#eadab4','#b09a66','#e5ebdf','#eac279','#e4a84b',0],
    leviathan:['#27636e','#233f45','#81afad','#d2c4a2','#6bc0be',16],
    eclipse:['#25283d','#27273d','#696586','#b9a076','#a0a1cf',15],
    pilgrim:["#ae9569","#534335","#e4d2a8","#d8b36b","#e4d2a8",5],
    sandalwood:["#86533e","#534335","#c9a169","#d8b36b","#c9a169",7],
    reedraft:["#9b8955","#534335","#b6c4a3","#d8b36b","#b6c4a3",0],
    monkeytwig:["#815a43","#352e35","#d9a879","#d8b36b","#d9a879",0],
    goldenhoop:["#bc8734","#352e35","#e5d293","#d8b36b","#e5d293",6],
    moonspade:["#547989","#352e35","#d8e1d8","#c5d7df","#d8e1d8",0],
    ninerake:["#677785","#352e35","#c1d2db","#c5d7df","#c1d2db",0],
    whitedragon:["#9dbfc1","#352e35","#f0e2b8","#d8b36b","#f0e2b8",0],
    kasaya:["#a44332","#352e35","#edc96b","#d8b36b","#edc96b",0],
    windfan:["#52754f","#352e35","#d9bf73","#d8b36b","#d9bf73",0],
    redboy:["#af382b","#352e35","#ffd480","#d8b36b","#ffd480",0],
    jadebottle:["#70ab9e","#352e35","#e9e2ba","#d8b36b","#e9e2ba",8],
    demonmirror:["#506676","#352e35","#edc476","#d8b36b","#edc476",0],
    goldenbell:["#746386","#352e35","#e6c477","#d8b36b","#e6c477",0],
    sevenstars:["#385e75","#352e35","#b9d6e2","#d8b36b","#b9d6e2",0],
    gourd:["#954848","#352e35","#d7b673","#d8b36b","#d7b673",0],
    lotuswheel:["#be6557","#352e35","#edcf83","#d8b36b","#edcf83",0],
    ruyi:["#8e2922","#ae782e","#a47135","#dfb35c","#ffe4a3",6],
    erlang:["#263e51","#23313e","#718da2","#bacfdc","#eff8fc",6],
    wukong:["#a44d32","#352e35","#f6d17c","#d8b36b","#f6d17c",0]
  };
  const JOURNEY_IDS=Object.freeze(["pilgrim","sandalwood","reedraft","monkeytwig","goldenhoop","moonspade","ninerake","whitedragon","kasaya","windfan","redboy","jadebottle","demonmirror","goldenbell","sevenstars","gourd","lotuswheel","ruyi","erlang","wukong"]);
  const EXPANSION_IDS=Object.freeze(['walnut','porcelain','citrus','amber','vinyl','nautilus','alpine','candlewyrm','thunderdrum','abysswhale','foxfire','lilybell','sandscript','frostwolf','rosevow','inkjudge','butterfly','sunforge','leviathan','eclipse']);
  function profile(rod){const id=typeof rod==='string'?rod:rod?.id||'bamboo',p=PALETTES[id]||PALETTES.bamboo;const craft=Crafted?.catalog[id];if(craft)return{id,shaft:rgb(craft.color),grip:rgb(craft.craft.grip),wrap:rgb(craft.accent),metal:rgb(craft.craft.metal),trim:rgb(craft.accent),pattern:craft.craft.pattern,advanced:craft.rarity!=='common',craft:craft.craft,rarity:craft.rarity,cel:craft.collection==='onepiece'};return{id:PALETTES[id]?id:'bamboo',shaft:rgb(p[0]),grip:rgb(p[1]),wrap:rgb(p[2]),metal:rgb(p[3]),trim:rgb(p[4]),pattern:p[5],advanced:EXPANSION_IDS.includes(id)?EXPANSION_IDS.indexOf(id)>=3:Object.keys(PALETTES).indexOf(id)>=5};}
  function curvePoint(s,bend){
    const shared=typeof globalThis!=='undefined'&&globalThis.TracerFishingMotion?.rodCurvePoint;
    if(shared&&s>=0&&s<=1)return shared(s,bend);
    const ratio=clamp(bend,-.24,.24),q=clamp((s-.3)/.7),d=ratio*L,shortening=d*d/(1.4*L)*(3*q**3-2.25*q**4+.45*q**5),lateral=d*q*q*(3-q)/2,slope=d/(.7*L)*(3*q-1.5*q*q),angle=Math.atan2(slope,1-.5*slope*slope);
    return{x:GRIP.x+AXIS[0]*(s*L-shortening)+NORMAL[0]*lateral,y:GRIP.y+AXIS[1]*(s*L-shortening)+NORMAL[1]*lateral,angle:angle*180/Math.PI};
  }
  function deformed(local,bend){const p=curvePoint(local[0],bend),angle=p.angle*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),n=[NORMAL[0]*c-AXIS[0]*s,NORMAL[1]*c-AXIS[1]*s];return{x:p.x+n[0]*local[1]+local[2]*.22,y:p.y+n[1]*local[1]-local[2]*.14,z:local[2],angle:p.angle};}
  const add=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,b)=>a.map(v=>v*b),dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
  // Model-space coordinates are longitudinal distance, transverse distance and
  // depth in canonical rod units. Only the first component is divided by L.
  function mesh(){const data=[];return{data,tri(a,b,c,na,nb,nc,material,uv){for(const [v,n,i]of [[a,na,0],[b,nb,1],[c,nc,2]])data.push(v[0]/L,v[1],v[2],...n,...material.color,material.rough,material.metal,material.pattern,...(uv?.[i]||[v[0],v[1]]));}};}
  function material(color,rough=.45,metal=0,pattern=0){return{color,rough,metal,pattern};}
  function tube(g,points,radii,mat,sides=16){
    const rows=points.map((p,i)=>{const tangent=unit(add(points[Math.min(i+1,points.length-1)],scale(points[Math.max(0,i-1)],-1))),normal=unit(cross(Math.abs(tangent[2])<.8?[0,0,1]:[0,1,0],tangent)),binormal=unit(cross(tangent,normal));return{p,normal,binormal,tangent,r:radii[i]??radii[0]};});
    const at=(row,j)=>{const angle=j/sides*TAU,n=add(scale(row.normal,Math.cos(angle)),scale(row.binormal,Math.sin(angle)));return{p:add(row.p,scale(n,row.r)),n,uv:[row.p[0],angle]};};
    for(let i=0;i<rows.length-1;i++)for(let j=0;j<sides;j++){const a=at(rows[i],j),b=at(rows[i+1],j),c=at(rows[i+1],j+1),d=at(rows[i],j+1);g.tri(a.p,b.p,c.p,a.n,b.n,c.n,mat,[a.uv,b.uv,c.uv]);g.tri(a.p,c.p,d.p,a.n,c.n,d.n,mat,[a.uv,c.uv,d.uv]);}
    for(const i of [0,rows.length-1]){const row=rows[i],normal=scale(row.tangent,i===0?-1:1);for(let j=0;j<sides;j++){const a=at(row,j),b=at(row,j+1);g.tri(row.p,a.p,b.p,normal,normal,normal,mat);}}
  }
  function shaft(g,from,to,radius,mat,steps,sides){const p=[],r=[];for(let i=0;i<=steps;i++){const s=mix(from,to,i/steps);p.push([s*L,0,0]);r.push(typeof radius==='function'?radius(s):radius);}tube(g,p,r,mat,sides);}
  function torus(g,center,u,v,radius,thickness,mat,around=24,sections=6){
    u=unit(u);v=unit(add(v,scale(u,-dot(u,v))));
    const normal=unit(cross(u,v)),at=(a,b)=>{const radial=add(scale(u,Math.cos(a)),scale(v,Math.sin(a))),n=add(scale(radial,Math.cos(b)),scale(normal,Math.sin(b)));return{p:add(center,add(scale(radial,radius),scale(n,thickness))),n};};
    for(let i=0;i<around;i++)for(let j=0;j<sections;j++){const a=at(i/around*TAU,j/sections*TAU),b=at((i+1)/around*TAU,j/sections*TAU),c=at((i+1)/around*TAU,(j+1)/sections*TAU),d=at(i/around*TAU,(j+1)/sections*TAU);g.tri(a.p,b.p,c.p,a.n,b.n,c.n,mat);g.tri(a.p,c.p,d.p,a.n,c.n,d.n,mat);}
  }
  function ellipsoid(g,center,radii,mat,rows=12,columns=20){
    const at=(a,b)=>{const p=[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];return{p:add(center,p.map((n,i)=>n*radii[i])),n:unit(p.map((n,i)=>n/radii[i]))};};
    for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){const a=at(i/rows*Math.PI,j/columns*TAU),b=at((i+1)/rows*Math.PI,j/columns*TAU),c=at((i+1)/rows*Math.PI,(j+1)/columns*TAU),d=at(i/rows*Math.PI,(j+1)/columns*TAU);g.tri(a.p,b.p,c.p,a.n,b.n,c.n,mat);g.tri(a.p,c.p,d.p,a.n,c.n,d.n,mat);}
  }
  function facet(g,a,b,c,mat){const n=unit(cross(add(b,scale(a,-1)),add(c,scale(a,-1))));g.tri(a,b,c,n,n,n,mat);}
  // Flattened, convex leaves and feathers catch a broad highlight. Their real
  // thickness also survives the Canvas renderer instead of becoming decals.
  function blade(g,start,end,width,thickness,mat,edge,curve=0,detail=10){
    const axis=unit([end[0]-start[0],end[1]-start[1],0]),side=[-axis[1],axis[0],0],rows=[],count=8;
    for(let i=0;i<=detail;i++){const t=i/detail,envelope=Math.pow(Math.sin(Math.PI*t),.72),center=add(add(scale(start,1-t),scale(end,t)),add(scale(side,curve*Math.sin(Math.PI*t)),[0,0,thickness*.5*Math.sin(Math.PI*t)])),row=[];
      for(let j=0;j<count;j++){const a=j/count*TAU,n=unit(add(scale(side,Math.cos(a)/Math.max(width,.1)),[0,0,Math.sin(a)/Math.max(thickness,.1)]));row.push({p:add(center,add(scale(side,Math.cos(a)*width*envelope),[0,0,Math.sin(a)*thickness*envelope])),n});}rows.push(row);
    }
    for(let i=0;i<detail;i++)for(let j=0;j<count;j++){const a=rows[i][j],b=rows[i+1][j],c=rows[i+1][(j+1)%count],d=rows[i][(j+1)%count];g.tri(a.p,b.p,c.p,a.n,b.n,c.n,mat);g.tri(a.p,c.p,d.p,a.n,c.n,d.n,mat);}
    if(edge)for(const j of [0,4])tube(g,rows.map(row=>add(row[j].p,[0,0,.25])),[.5],edge,5);
  }
  function gem(g,center,height,width,mat,sides=6){
    const top=add(center,[height*.6,0,0]),bottom=add(center,[-height*.4,0,0]),ring=[];
    for(let i=0;i<sides;i++){const a=i/sides*TAU;ring.push(add(center,[0,Math.cos(a)*width,Math.sin(a)*width]));}
    for(let i=0;i<sides;i++){facet(g,top,ring[i],ring[(i+1)%sides],mat);facet(g,bottom,ring[(i+1)%sides],ring[i],mat);}
  }
  function emblemStar(g,center,radius,mat,points=5){
    const ring=[];for(let i=0;i<points*2;i++){const a=i/(points*2)*TAU,r=i%2?radius*.43:radius;ring.push(add(center,[Math.cos(a)*r,Math.sin(a)*r,0]));}
    for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];facet(g,add(center,[0,0,3]),a,b,mat);facet(g,add(center,[0,0,-1.5]),b,a,mat);}
  }
  function gear(g,center,radius,teeth,mat,detail=1){
    const n=teeth*4,inside=radius*.57,z=1.45;
    for(let i=0;i<n;i++){const a=i/n*TAU,b=(i+1)/n*TAU,ra=i%4===1||i%4===2?radius:radius*.83,rb=(i+1)%4===1||(i+1)%4===2?radius:radius*.83;
      const at=(t,r,d)=>add(center,[Math.cos(t)*r,Math.sin(t)*r,d]),outerA=at(a,ra,z),outerB=at(b,rb,z),innerA=at(a,inside,z),innerB=at(b,inside,z),backA=at(a,ra,-z),backB=at(b,rb,-z);
      facet(g,innerA,outerA,outerB,mat);facet(g,innerA,outerB,innerB,mat);facet(g,outerA,backA,backB,mat);facet(g,outerA,backB,outerB,mat);
      facet(g,innerA,at(b,inside,-z),at(a,inside,-z),mat);facet(g,innerA,innerB,at(b,inside,-z),mat);
    }
    for(let i=0;i<5;i++){const a=i/5*TAU;tube(g,[center,add(center,[Math.cos(a)*inside,Math.sin(a)*inside,0])],[1.2],mat,6);}
    torus(g,center,[1,0,0],[0,1,0],radius*.24,.8,mat,detail?20:12,4);
  }
  function swordBlank(g,lowDetail){
    const steel=material(rgb('#bfd6e8'),.21,.78,6),edge=material(rgb('#f1f6fa'),.15,.82,6),spine=material(rgb('#354a60'),.3,.65,6),stations=[.269,.31,.4,.51,.62,.73,.84,.92,.967,.995],rows=stations.map(s=>{
      const t=(s-.269)/.726,center=-5*Math.sin(t*Math.PI),width=s>.94?Math.max(.18,5.8*(.999-s)/.059):5.8-.9*t;
      return[[s*L,center-width,.65],[s*L,center-width*.44,2.65],[s*L,center+width*.42,3.25],[s*L,center+width,1.15],[s*L,center+width,-1.15],[s*L,center-width,-.65]];
    });
    for(let i=0;i<rows.length-1;i++)for(let j=0;j<6;j++){const k=(j+1)%6,mat=j===0?edge:j===2||j===3?spine:steel;facet(g,rows[i][j],rows[i+1][j],rows[i+1][k],mat);facet(g,rows[i][j],rows[i+1][k],rows[i][k],mat);}
    // The wavy hardened edge is geometry, so it remains visible without texture maps.
    const hamon=[];for(let i=0;i<=(lowDetail?36:64);i++){const t=i/(lowDetail?36:64),s=.292+t*.642;hamon.push([s*L,-5*Math.sin((s-.269)/.726*Math.PI)-2.7+Math.sin(t*TAU*9)*.45,2.9]);}tube(g,hamon,[.24],edge,5);
  }
  // A swept surface is the continuous body of the new designs. Its section,
  // centreline and roll are interpolated together; ornaments grow from shaped
  // sockets instead of touching the blank as unrelated primitive solids.
  function sculpt(g,stations,mat,options={}){
    const rows=options.rows||32,columns=options.sides||18,lobes=options.lobes||0,flute=options.flute||0;
    const sample=t=>{
      const f=clamp(t)*(stations.length-1),i=Math.min(stations.length-2,Math.floor(f)),q=f-i;
      const a=stations[Math.max(0,i-1)],b=stations[i],c=stations[i+1],d=stations[Math.min(stations.length-1,i+2)];
      const result=[];for(let k=0;k<6;k++){const A=a[k]||0,B=b[k]||0,C=c[k]||0,D=d[k]||0;result.push(.5*((2*B)+(-A+C)*q+(2*A-5*B+4*C-D)*q*q+(-A+3*B-3*C+D)*q*q*q));}
      result[3]=Math.max(.025,result[3]);result[4]=Math.max(.025,result[4]);return result;
    };
    const at=(t,angle)=>{const v=sample(t),lo=sample(Math.max(0,t-.001)),hi=sample(Math.min(1,t+.001)),tangent=unit([hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]]),normal=unit(cross(Math.abs(tangent[2])<.86?[0,0,1]:[0,1,0],tangent)),binormal=unit(cross(tangent,normal)),a=angle+v[5],r=1+flute*Math.cos(angle*lobes+(options.twist||0)*t*TAU);return add(v.slice(0,3),add(scale(normal,Math.cos(a)*v[3]*r),scale(binormal,Math.sin(a)*v[4]*r)));};
    const vertices=[];
    for(let i=0;i<=rows;i++){const t=i/rows,row=[];for(let j=0;j<columns;j++){const a=j/columns*TAU,p=at(t,a),along=add(at(Math.min(1,t+.001),a),scale(at(Math.max(0,t-.001),a),-1)),across=add(at(t,a+.002),scale(at(t,a-.002),-1)),n=unit(cross(across,along));row.push({p,n,uv:[p[0],a]});}vertices.push(row);}
    for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){const a=vertices[i][j],b=vertices[i+1][j],c=vertices[i+1][(j+1)%columns],d=vertices[i][(j+1)%columns];g.tri(a.p,b.p,c.p,a.n,b.n,c.n,mat,[a.uv,b.uv,c.uv]);g.tri(a.p,c.p,d.p,a.n,c.n,d.n,mat,[a.uv,c.uv,d.uv]);}
    for(const i of [0,rows]){const center=sample(i/rows).slice(0,3),near=sample(i?1-.001:.001).slice(0,3),n=unit(add(center,scale(near,-1)));for(let j=0;j<columns;j++){const a=vertices[i][j],b=vertices[i][(j+1)%columns];g.tri(center,a.p,b.p,n,n,n,mat);}}
    return {sample,at};
  }
  function revolved(g,center,axis,section,mat,columns=28){
    const n=unit(axis),u=unit(cross(Math.abs(n[0])<.8?[1,0,0]:[0,1,0],n)),v=unit(cross(n,u));
    const at=(i,j)=>{const a=j/columns*TAU,[base,h,lobe=0]=section[i],r=base+lobe*Math.cos(a*5),before=section[Math.max(0,i-1)],after=section[Math.min(section.length-1,i+1)],dr=after[0]-before[0]+((after[2]||0)-(before[2]||0))*Math.cos(a*5),dh=after[1]-before[1],radial=add(scale(u,Math.cos(a)),scale(v,Math.sin(a))),azimuth=add(scale(u,-Math.sin(a)),scale(v,Math.cos(a))),normal=unit(add(add(scale(radial,dh),scale(n,-dr)),scale(azimuth,dh*lobe*5*Math.sin(a*5)/Math.max(.1,r))));return {p:add(center,add(scale(radial,r),scale(n,h))),n:normal,uv:[r,a]};};
    for(let i=0;i<section.length-1;i++)for(let j=0;j<columns;j++){const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1),m=Array.isArray(mat)?mat[i]||mat[0]:mat;g.tri(a.p,b.p,c.p,a.n,b.n,c.n,m,[a.uv,b.uv,c.uv]);g.tri(a.p,c.p,d.p,a.n,c.n,d.n,m,[a.uv,c.uv,d.uv]);}
  }
  function ribbon(g,points,width,mat,edge,options={}){
    const depth=options.depth||1.25,stations=points.map((p,i)=>[...p,typeof width==='function'?width(i/(points.length-1)):width,depth*(.35+.65*Math.sin(Math.PI*i/(points.length-1)))]);
    const surface=sculpt(g,stations,mat,{rows:options.rows||24,sides:options.sides||12});
    if(edge)for(const a of [0,Math.PI]){const rim=[],count=options.edgeRows||24;for(let i=0;i<=count;i++)rim.push(surface.at(i/count,a));tube(g,rim,[options.rim||.42],edge,5);}
    return surface;
  }
  function transparentPattern(pattern){return pattern===10||pattern===14||pattern===17||pattern===19;}
  function finishModel(g,p,details){
    if(p.cel)for(let i=0;i<g.data.length;i+=14){g.data[i+9]=.85;g.data[i+10]=0;if(g.data[i+11]!==31)g.data[i+11]=30;}
    const opaque=[],glass=[];
    for(let i=0;i<g.data.length;i+=42){const triangle=g.data.slice(i,i+42);if(transparentPattern(g.data[i+11]))glass.push({triangle,z:(g.data[i+2]+g.data[i+16]+g.data[i+30])/3});else opaque.push(...triangle);}
    glass.sort((a,b)=>a.z-b.z);const opaqueVertices=opaque.length/14;
    for(const face of glass)opaque.push(...face.triangle);
    return {vertices:new Float32Array(opaque),triangles:opaque.length/42,opaqueVertices,profile:p,design:details};
  }
  function buildExpansionMesh(p,lowDetail){
    const g=mesh(),fine=!lowDetail,steps=fine?52:28,sides=fine?20:12,around=fine?24:14,sections=fine?6:4;
    const mat=(hex,rough=.28,metal=.12,pattern=0)=>material(typeof hex==='string'?rgb(hex):hex,rough,metal,pattern);
    const metal=mat(p.metal,.22,.82,6),trim=mat(p.trim,.25,.5,6),body=mat(p.shaft,.28,.16,p.pattern),grip=mat(p.grip,.55,.04,2),dark=mat('#24343a',.47,.18),ivory=mat('#ebe3ce',.35,.07),silver=mat('#d1e0e4',.2,.8,6);
    const journeyIndex=JOURNEY_IDS.indexOf(p.id),collectionIndex=journeyIndex>=0?journeyIndex:EXPANSION_IDS.indexOf(p.id),common=p.craft?p.rarity==='common':collectionIndex<3,rare=p.craft?p.rarity==='rare':collectionIndex<7;
    const silhouette={walnut:'folding-travel-reel',porcelain:'porcelain-cloud-collar',citrus:'leaf-cradle',amber:'resin-pine-bough',vinyl:'phonograph-tonearm',nautilus:'chambered-spiral-shell',alpine:'ice-axe-ridge'}[p.id]||p.id;
    const section={walnut:[6.1,5.5],porcelain:[5.7,5.7],citrus:[5.5,4.8],amber:[6.2,5.4],vinyl:[5.8,3.8],nautilus:[5.3,4.7],alpine:[5.1,3.1]}[p.id]||[5.7,4.6];
    const sw=section[0],sz=section[1],shift={walnut:1.2,porcelain:-1.8,citrus:3.2,amber:-3,vinyl:0,nautilus:3,alpine:-1.2,lilybell:5,abysswhale:-3.5,butterfly:2.8,leviathan:-3,eclipse:2}[p.id]||0;
    const rodStations=p.id==='ruyi'?[[.01*L,0,0,5.8,5.8],[.2*L,0,0,5.8,5.8],[.4*L,0,0,5.6,5.6],[.65*L,0,0,5.5,5.5],[.84*L,0,0,5.4,5.4],[L,0,0,5.4,5.4]]:[[.01*L,0,0,sw+1,sz+.7],[.2*L,0,0,sw,sz],[.38*L,shift,0,sw*.81,sz*.85],[.64*L,shift*.7,0,sw*.53,sz*.58],[.86*L,shift*.3,0,2.2,1.8],[L,0,0,1.12,1.05]];
    const rodSurface=sculpt(g,rodStations,body,{rows:steps,sides,lobes:p.id==='alpine'?4:6,flute:p.id==='ruyi'?0:p.id==='alpine'?.1:p.id==='walnut'?.024:.016});
    const blankAt=s=>{let lo=0,hi=1;for(let i=0;i<16;i++){const t=(lo+hi)/2;if(rodSurface.sample(t)[0]<s*L)lo=t;else hi=t;}return rodSurface.sample((lo+hi)/2);};
    const sleeve=(x0,x1,r0,r1,m=metal)=>sculpt(g,[[x0,0,0,r0*.97,r0*.94],[mix(x0,x1,.22),0,0,r0,r0],[mix(x0,x1,.8),0,0,r1,r1],[x1,0,0,r1*.97,r1*.94]],m,{rows:fine?(Math.abs(x1-x0)<4?3:6):3,sides});
    const seam=(from,to,turns,radius,m,thickness=.36,phase=0)=>{const pts=[],n=Math.max(18,Math.ceil(Math.abs(turns)*(fine?16:9)));for(let i=0;i<=n;i++){const t=i/n,a=t*turns*TAU+phase,s=mix(from,to,t),r=typeof radius==='function'?radius(s):radius;pts.push([s*L,Math.cos(a)*r,Math.sin(a)*r]);}tube(g,pts,[thickness],m,fine?6:4);};
    const carve=(points,m=metal,r=.4)=>tube(g,points,[r],m,fine?6:4);
    const bolt=(c,r=1.05,m=metal)=>{revolved(g,c,[0,0,1],[[.05,0],[r,0],[r,.45],[r*.8,.75],[.05,.8]],m,6);carve([add(c,[-r*.57,0,.87]),add(c,[r*.57,0,.87])],dark,.16);};
    const sectionBody=(stations,m=body,opts={})=>sculpt(g,stations,m,{...opts,rows:fine?(opts.rows||32):Math.max(5,Math.ceil((opts.rows||32)*.45)),sides:fine?(opts.sides||20):Math.min(10,opts.sides||10)});
    // Ergonomic, subtly oval grips retain a single uninterrupted surface.
    const gripWidth={walnut:8.8,porcelain:8,citrus:8.4,amber:8.6,vinyl:7.4,nautilus:8.2,alpine:8.8,inkjudge:8.1,leviathan:9,eclipse:8.1}[p.id]||8.6;
    const gm=p.id==='ruyi'?metal:p.id==='porcelain'?mat('#dce8e4',.19,.05,8):p.id==='citrus'?mat('#b29a62',.53,.02,9):p.id==='sunforge'?mat('#eee7d6',.24,.06,8):grip;
    sectionBody([[-12,0,0,gripWidth*.5,6],[-8,0,0,gripWidth,7.5],[6,-.6,0,gripWidth*.98,8],[32,-.3,0,gripWidth*.92,7.5],[52,0,0,gripWidth*.78,6.6],[58,0,0,6.4,5.9]],gm,{rows:fine?30:16,sides});
    sleeve(-13,-8,gripWidth*.8,gripWidth,metal);sleeve(53,60,6.9,6.7,metal);
    sleeve(64,73,6.6,7.1,body);sleeve(72,77,7.15,6.5,metal);sleeve(99,107,6.2,6.5,metal);
    for(let i=0;i<(fine?7:4);i++)torus(g,[62+i*1.4,0,0],[0,1,0],[0,0,1],6.7,.28,metal,around,4);
    if(!['porcelain','citrus','sunforge','ruyi'].includes(p.id)){
      for(const side of [-1,1]){carve([[0,side*gripWidth*.65,5.8],[23,side*gripWidth*.66,5.8],[47,side*gripWidth*.62,5.6]],mat(p.wrap,.54,.02),.3);if(fine)for(let i=0;i<14;i++){const x=2+i*3.25;carve([[x,side*(gripWidth*.65-.55),6.04],[x+1.05,side*(gripWidth*.65+.65),6.14]],ivory,.16);}}
    }
    const reelStyle={walnut:0,porcelain:1,citrus:2,amber:3,vinyl:4,nautilus:5,alpine:6}[p.id]??(p.craft?p.craft.variant%7:collectionIndex%7);
    const reelCenter=[83,reelStyle===4?23:26,reelStyle===5?10:9],spoolR=reelStyle===4?17.5:reelStyle===5?13:11.8;
    sectionBody([[62,1,1,3.1,2.3],[67,7,4,4.2,3.5],[73,14,5,6.5,5.2],[78,19,5,8.1,6.8],[92,19.6,5,5.6,5.9],[97,17,4,1.3,1.8]],p.id==='porcelain'?gm:body,{rows:fine?32:17,sides});
    // A stepped spool and recessed face. The individual wound line, folded
    // handle, rotor yoke and screws are supported by the actual reel housing.
    revolved(g,reelCenter,[0,0,1],[[.05,-5.2],[8.5,-5.2],[spoolR,-4.9],[spoolR+.8,-4.2],[spoolR+.7,-3.2],[spoolR-1.6,-2.6],[spoolR-1.7,4],[spoolR+.8,4.4],[spoolR+1,5.5],[spoolR-.2,6.5],[4.8,6.7],[.05,6.1]],metal,fine?40:22);
    for(let i=0;i<(fine?7:4);i++)torus(g,add(reelCenter,[0,0,-2.2+i*(fine?1:1.9)]),[1,0,0],[0,1,0],spoolR-1.4,.25,mat('#ccc8ab',.65,.03,4),around,4);
    revolved(g,add(reelCenter,[0,0,6.7]),[0,0,1],[[.05,0],[spoolR-2,0],[spoolR-2,.45],[3.1,1.2],[.05,1.3]],p.id==='vinyl'?mat('#172027',.31,.22,11):p.id==='porcelain'?gm:body,fine?40:22);
    for(let i=0;i<(reelStyle===4?3:5);i++){const a=i/(reelStyle===4?3:5)*TAU;bolt(add(reelCenter,[Math.cos(a)*(spoolR-3.2),Math.sin(a)*(spoolR-3.2),7.35]),.72,metal);}
    revolved(g,add(reelCenter,[0,0,7.8]),[0,0,1],[[.05,0],[3.2,0],[3.35,.4],[2.6,1.25],[.05,1.4]],trim,around);
    const bail=[];for(let i=0;i<=32;i++){const a=-.58+i/32*Math.PI*1.73;bail.push(add(reelCenter,[Math.cos(a)*(spoolR+3),Math.sin(a)*(spoolR+3),1.6+2.2*Math.sin(a)]));}carve(bail,metal,.74);
    sectionBody([[71,19,9,1.5,1.5],[64,27,12,1.8,1.6],[57,34,15,1.7,1.4],[55,39,15,.9,.9]],metal,{rows:fine?16:10,sides:10});
    sectionBody([[54,35,15,2.7,3],[54,40,16,4.2,4.3],[54,45,17,2.5,3]],gm,{rows:fine?16:10,sides:14});bolt([64,27,14],1.7,metal);
    // Open, arched double-foot guides use a dark ceramic inner race, proper
    // bindings and feet. Their centres follow the same flexible blank.
    for(const s of [.34,.47,.60,.72,.83,.92]){
      const base=blankAt(s),r=9.1-6.2*s,center=[s*L,base[1]+base[3]+r*.81,1.4],axis=[.53,0,.848],ceramic=mat('#263b3d',.2,.12);
      torus(g,center,[0,1,0],axis,r,.68,metal,around,sections);torus(g,center,[0,1,0],axis,r-.48,.31,ceramic,around,4);
      for(const side of [-1,1])sectionBody([[(s-side*.016)*L,base[1]+base[3]*.96,.1,1.1,.4],[(s-side*.009)*L,base[1]+base[3]+r*.36,.8,.72,.6],[s*L,center[1],1.4,.55,.52]],metal,{rows:fine?10:6,sides:6});
      for(const [from,to]of [[s-.019,s-.013],[s+.013,s+.019]]){const a=blankAt(from),b=blankAt(to);sectionBody([[a[0],a[1],a[2],a[3]+.18,a[4]+.18],[b[0],b[1],b[2],b[3]+.18,b[4]+.18]],mat(p.wrap,.48,.03,4),{rows:3,sides});}
    }
    torus(g,[L,0,0],[0,1,0],[.5,0,.866],2,.54,metal,around,sections);
    torus(g,[L,0,0],[0,1,0],[.5,0,.866],1.58,.23,dark,around,4);
    const leaf=(start,middle,end,width,m=body,rim=metal)=>ribbon(g,[start,middle,end],t=>Math.max(.06,width*Math.pow(Math.sin(t*Math.PI),.75)),m,rim,{rows:p.craft?(fine?18:8):(fine?28:14),sides:p.craft?(fine?8:6):(fine?12:8),edgeRows:p.craft?(fine?14:6):(fine?24:12),depth:1.6});
    const veins=(surface,count=4,m=metal)=>{carve(Array.from({length:19},(_,i)=>add(surface.sample(i/18).slice(0,3),[0,0,1.8])),m,.34);if(fine)for(let i=1;i<=count;i++){const t=i/(count+1),a=surface.sample(t).slice(0,3);for(const side of [-1,1])carve([add(a,[0,0,1.5]),add(surface.at(Math.min(.98,t+.09),side>0?0:Math.PI),[0,0,.1])],m,.2);}};
    const curve=(points,r,m=metal,rows=fine?30:16)=>sectionBody(points.map((v,i)=>[...v,Array.isArray(r)?r[i]:r,Array.isArray(r)?r[i]:r]),m,{rows,sides:fine?9:6});
    const spine=(points,width,m=body,rim=metal,depth=1.7)=>ribbon(g,points,t=>Math.max(.06,width*Math.pow(Math.sin(Math.PI*t),.63)),m,rim,{rows:fine?46:18,sides:fine?14:8,edgeRows:fine?24:12,depth});
    const enamelEye=(x,y,z,sign,m=trim)=>{leaf([x-4,y,z],[x,y+sign*1.15,z+.4],[x+5,y+sign*.5,z],1.05,dark,null);curve([[x-4,y+sign*.8,z+.3],[x,y+sign*1.95,z+.8],[x+5,y+sign*.8,z+.2]],.4,m,12);};

    if(p.craft){
      const crafted=Crafted.build(p,{g,L,fine,metal,trim,body,ivory,silver,dark,leaf,veins,curve,spine,sleeve,sectionBody,torus,ellipsoid,gem,blade,facet,bolt});
      return finishModel(g,p,crafted);
    }
    if(journeyIndex>=0){
      // Every ornament is model-space geometry attached to the same continuous
      // flexible blank. The line still leaves the unchanged canonical tip.
      const at=s=>s*L,ring=(x,y,r,m=metal)=>torus(g,[x,y,5],[1,0,0],[0,1,0],r,.85,m,around,sections);
      const bead=(x,y,z,r,m=body)=>ellipsoid(g,[x,y,z],[r,r,r],m,fine?12:6,fine?18:10);
      const curl=(x,y,size,m=metal)=>curve(Array.from({length:19},(_,i)=>{const a=i/18*TAU*1.5,rr=size*(1-i/22);return[x+Math.cos(a)*rr,y+Math.sin(a)*rr,6];}),.65,m);
      const knot=(x,y)=>{for(const side of[-1,1])curve([[x-6,y,6],[x,y+side*5,8],[x+6,y,6],[x,y-side*5,8],[x-6,y,6]],.9,trim);};
      const tassel=(x,y,len,m=body)=>{bead(x,y,7,2.2,metal);for(let k=-2;k<=2;k++)curve([[x,y,7],[x-len*.4,y+k*1.6,6],[x-len,y+k*2.1,5]],.65,m);};
      const flame=(x,y,h,w,m=body)=>spine([[x,y,4],[x+h*.34,y+w,6],[x+h*.68,y-w*.35,5],[x+h,y+w*.3,4]],w*.60,m,trim,1.4);
      const petal=(x,y,angle,length,width,m=body)=>{const ex=x+Math.cos(angle)*length,ey=y+Math.sin(angle)*length;return leaf([x,y,5],[(x+ex)/2-Math.sin(angle)*width*.35,(y+ey)/2+Math.cos(angle)*width*.35,8],[ex,ey,5],width,m,metal);};
      const lotus=(x,y,size)=>{for(let j=0;j<7;j++){const a=-Math.PI*.86+j/6*Math.PI*1.72;petal(x,y,a,size, size*.19,j%2?body:ivory);}gem(g,[x,y,7],size*.65,size*.19,trim,8);};
      const cloud=(x,y,size)=>{curl(x,y,size,ivory);curl(x-size*1.1,y-size*.3,size*.65,trim);curve([[x-size*1.7,y-2,5],[x,y-size*.4,6],[x+size*1.4,y+size*.4,5]],.75,metal);};
      const sword=(x0,x1,width,m=silver)=>{blade(g,[x0,0,4],[x1,0,4],width,2.4,m,metal,0,fine?28:12);curve([[x0-2,-width*1.7,4],[x0+3,0,5],[x0-2,width*1.7,4]],2,metal);};
      // Longitudinal etched scrolls are fine relief, with restrained specular rims.
      if(journeyIndex>=3&&!['ruyi','erlang'].includes(p.id))for(const s of [.38,.52,.67,.82]){const x=at(s);for(const side of[-1,1])curve([[x-9,side*3.8,4],[x-3,side*6.4,4],[x+3,side*4.4,4],[x+8,side*5.4,4]],.35,trim);}
      switch(p.id){
        case 'pilgrim':
          for(const s of [.28,.43,.61,.78,.92]){sleeve(at(s)-2,at(s)+2,5.4-3*s,5.4-3*s,body);curve([[at(s),-4,2],[at(s)+12,-11,4],[at(s)+22,-8,4]],.7,trim);}
          seam(.015,.13,15,8.7,mat('#c5af7e',.76,.02,9),.48);knot(64,-8);tassel(64,-10,22,grip);break;
        case 'sandalwood':
          for(let k=0;k<18;k++){const a=k/18*TAU;bead(105+Math.cos(a)*21,Math.sin(a)*20,4+Math.sin(a)*2,3.2,k%6===0?metal:body);}
          knot(83,-20);tassel(79,-20,32,trim);for(const s of [.39,.59,.79])sleeve(at(s),at(s)+3,5.5-3*s,5.5-3*s,metal);break;
        case 'reedraft':
          for(const side of[-1,1])curve([[30,side*7,1],[96,side*8,2],[141,side*4,2]],1.2,mat('#b5a776',.7,.02,9));
          for(const s of [.27,.45,.64,.81]){seam(s-.01,s+.01,3,5.5-2*s,ivory,.42);leaf([at(s),-2,3],[at(s)+18,-10,4],[at(s)+32,-5,3],3.7,body,null);}
          break;
        case 'monkeytwig':
          curve([[at(.30),-3,1],[at(.45),-9,2],[at(.61),-16,2],[at(.70),-11,3]],2.3,body);
          for(let j=0;j<5;j++){const x=at(.39+j*.06);veins(leaf([x,-7,5],[x+9,-23,6],[x+23,-20,5],6.4,mat('#718652',.5,.02),metal),3);}
          bead(at(.53),-24,7,8,mat('#d99880',.4,.02));curve([[at(.53)-4,-27,14],[at(.53),-29,15],[at(.53)+4,-27,14]],.5,ivory);break;
        case 'goldenhoop':
          for(const s of [.34,.58,.81]){ring(at(s),0,15-4*s,metal);curl(at(s),-11,7,trim);curl(at(s),11,7,trim);gem(g,[at(s),0,9],7,3.8,mat('#9e5144',.3,.2),8);}
          seam(.09,.14,8,8,metal,.45);tassel(at(.35),-18,28,body);break;
        case 'moonspade':
          spine([[at(.60),-2,3],[at(.76),-21,5],[at(.89),-28,5],[at(.96),-13,3]],6,silver,metal,2);
          spine([[at(.60),2,3],[at(.76),21,5],[at(.89),28,5],[at(.96),13,3]],6,silver,metal,2);
          for(let j=0;j<8;j++)bead(92+Math.cos(j/8*TAU)*17,Math.sin(j/8*TAU)*17,5,3.4,body);knot(at(.56),0);break;
        case 'ninerake':
          curve([[at(.62),-37,4],[at(.68),0,4],[at(.62),37,4]],3.5,silver);
          for(let j=0;j<9;j++){const y=(j-4)*8.7;spine([[at(.64),y,4],[at(.73),y*1.04,6],[at(.80),y*.99,6],[at(.82),y*.88,4]],2.5,silver,metal,1.4);}
          curve([[at(.52),-5,2],[at(.59),-16,4],[at(.66),-4,4]],2,metal);break;
        case 'whitedragon':
          spine([[at(.30),-4,4],[at(.43),-22,4],[at(.59),-12,5],[at(.73),-27,5],[at(.87),-7,4]],8,ivory,silver,4);
          sectionBody([[at(.78),-14,4,5,4],[at(.84),-22,5,10,7],[at(.89),-17,5,7,5],[at(.92),-10,5,2,2]],ivory,{rows:32});
          enamelEye(at(.86),-24,12,-1);for(const side of[-1,1]){curve([[at(.83),-22,side*5],[at(.77),-35,side*8],[at(.74),-32,side*9]],1.3,metal);curve([[at(.9),-13,side*6],[at(.92),-27,side*8],[at(.87),-35,side*9]],.55,ivory);}
          for(let j=0;j<7;j++)petal(at(.35+j*.058),-15,j%2?-2.6:-.8,19,3.5,silver);cloud(at(.37),12,14);break;
        case 'kasaya':
          for(const side of[-1,1])spine([[at(.3),side*4,4],[at(.43),side*29,5],[at(.62),side*21,6],[at(.79),side*37,4],[at(.9),side*7,3]],10,body,metal,1.25);
          for(let j=0;j<5;j++){const x=at(.38+j*.085);ring(x,(j%2?1:-1)*20,3.5);knot(x,0);}
          lotus(at(.55),0,23);tassel(at(.34),-16,32,trim);break;
        case 'windfan':
          for(let j=0;j<11;j++){const a=-1.05+j/10*2.1;const surface=leaf([at(.50),0,3],[at(.65),Math.sin(a)*35,6],[at(.86)-Math.abs(Math.sin(a))*16,Math.sin(a)*55,3],5.7,body,metal);veins(surface,3,trim);}
          curve([[at(.35),0,4],[at(.48),0,7],[at(.77),0,7]],1.5,trim);cloud(at(.38),-16,11);break;
        case 'redboy':
          for(let j=0;j<7;j++)flame(at(.34+j*.045),(j%2?1:-1)*(10+j*2),55+(j%3)*12,9,j%2?body:trim);
          lotus(at(.38),0,19);gem(g,[at(.67),0,7],31,8,mat('#e47732',.2,.2,18),8);break;
        case 'jadebottle':
          sectionBody([[at(.40),0,4,1,1],[at(.43),0,4,19,14],[at(.48),0,4,21,15],[at(.53),0,4,13,10],[at(.56),0,4,5,5],[at(.63),0,4,5,5],[at(.65),0,4,9,7]],mat('#a4d0bb',.22,.06,8),{rows:46});
          ring(at(.61),0,6);curve([[at(.63),0,5],[at(.76),-14,5],[at(.88),-6,4]],1.2,metal);
          for(let j=0;j<7;j++)petal(at(.68+j*.025),-6-j, j%2?-.3:-2.2,16,3.3,body);
          for(let j=0;j<3;j++)gem(g,[at(.34)-j*8,-10-j*6,7],8,2.6,mat('#bfe8e0',.15,.04,19),8);break;
        case 'demonmirror':
          revolved(g,[at(.62),0,5],[0,0,1],[[.1,0],[24,0],[28,2],[29,4],[24,5],[.1,5]],metal,fine?48:24);
          ellipsoid(g,[at(.62),0,10],[23,23,2],mat('#97c3ca',.14,.76,6),fine?18:8,fine?40:18);
          for(let j=0;j<8;j++){const a=j/8*TAU;gem(g,[at(.62)+Math.cos(a)*26,Math.sin(a)*26,10],6,2.6,j%2?trim:body,6);}
          for(const s of [.36,.84]){cloud(at(s),0,13);knot(at(s),0);}break;
        case 'goldenbell':
          for(let j=0;j<3;j++){const x=at(.40+j*.17),side=j%2?-1:1;curve([[x,0,4],[x+4,side*18,5],[x,side*23,5]],1.8,metal);
            revolved(g,[x,side*25,5],[1,0,0],[[.1,-13],[4,-12],[6,-7],[7,0],[11,7],[12,9],[9,9],[8,7],[5,0],[.1,-7]],j%2?metal:body,fine?32:16);
            bead(x+7,side*25,5,2.4,trim);ring(x-11,side*25,4);for(let k=-1;k<=1;k++)curve([[x-4,side*25+k*3,12],[x+4,side*25+k*4,14]],.45,metal);}
          break;
        case 'sevenstars':
          sword(at(.32),at(.96),9);for(let j=0;j<7;j++){const x=at(.39+j*.075),y=Math.sin(j*1.6)*4;emblemStar(g,[x,y,8],2.8,trim,5);if(j)curve([[x-L*.075,Math.sin((j-1)*1.6)*4,8],[x,y,8]],.28,metal);}
          for(const side of[-1,1])spine([[at(.33),0,4],[at(.36),side*25,4],[at(.44),side*30,4]],4,body,metal,1.6);break;
        case 'gourd':
          sectionBody([[at(.38),0,4,1,1],[at(.41),0,4,17,13],[at(.46),0,4,21,16],[at(.51),0,4,9,7],[at(.54),0,4,13,10],[at(.58),0,4,15,11],[at(.62),0,4,5,4],[at(.65),0,4,4,3]],body,{rows:46});
          seam(.50,.515,4,9,metal,.75);knot(at(.52),-11);tassel(at(.51),-14,47,trim);cloud(at(.76),0,16);break;
        case 'lotuswheel':
          for(const s of [.42,.72]){ring(at(s),0,22,metal);ring(at(s),0,16,trim);for(let j=0;j<8;j++){const a=j/8*TAU;petal(at(s)+Math.cos(a)*18,Math.sin(a)*18,a+.5,17,4.5,j%2?body:trim);curve([[at(s),0,4],[at(s)+Math.cos(a)*16,Math.sin(a)*16,5]],.7,metal);}}
          for(const side of[-1,1])spine([[at(.3),0,4],[at(.44),side*33,4],[at(.58),side*24,5],[at(.83),side*40,4]],4,body,trim);break;
        case 'ruyi': {
          // Matching cylindrical gold ends, with relief wrapped ON the metal.
          // No lateral dragon coils: the long red-iron staff remains readable.
          const aged=mat('#795025',.38,.67,6),bright=mat('#ffe6a8',.2,.86,6);
          for(const [from,to,r] of [[-12,58,8.5],[at(.825),at(.997),7.4]]){
            sleeve(from,to,r,r,metal);
            for(const x of [from+2,from+6,to-6,to-2])torus(g,[x,0,0],[0,1,0],[0,0,1],r,.43,bright,around,sections);
            const rows=fine?5:3;
            for(let row=0;row<rows;row++)for(let face=0;face<4;face++){
              const cx=mix(from+13,to-13,(row+.5)/rows),angle=face*TAU/4;
              const count=fine?23:12,pts=Array.from({length:count},(_,j)=>{const t=j/(count-1),a=t*TAU*1.2,rr=4.2*(1-t*.8),theta=angle+Math.sin(a)*rr/r;return[cx+Math.cos(a)*rr,Math.cos(theta)*(r+.07),Math.sin(theta)*(r+.07)];});
              carve(pts,aged,fine?.27:.32);
              carve(pts.map(v=>[v[0]+.42,v[1]*1.009,v[2]*1.009]),bright,.13);
            }
            for(const phase of [0,Math.PI])seam((from+10)/L,(to-10)/L,1.5,r+.12,aged,.22,phase);
          }
          // Narrow inlaid strokes and a flush end medallion reward close viewing.
          for(const angle of [.8,3.94])carve(Array.from({length:25},(_,j)=>{const s=.28+j/24*.52,r=blankAt(s)[3]+.03;return[at(s),Math.cos(angle)*r,Math.sin(angle)*r];}),mat('#d06440',.3,.4),.12);
          revolved(g,[-12.5,0,0],[-1,0,0],[[.05,0],[7.4,0],[7.8,.6],[6.6,1],[.05,1.2]],metal,around);
          break;
        }
        case 'erlang': {
          const edge=mat('#ecf7ff',.17,.91,6),steel=mat('#7f9caf',.24,.84,6),fuller=mat('#344e63',.3,.7,6);
          // Forged diamond sections give each of the three points a real bevel.
          // Straight stations keep crisp cutting edges; subdivisions follow flex.
          const forged=stations=>{
            const rows=[];
            for(let k=0;k<stations.length-1;k++){
              const a=stations[k],b=stations[k+1],n=fine?8:4;
              for(let j=0;j<n;j++)rows.push(a.map((v,i)=>mix(v,b[i],j/n)));
            }
            rows.push(stations[stations.length-1]);
            const sections=rows.map(([s,y,w,h])=>[[at(s),y-w,2],[at(s),y-w*.66,2+h*.55],[at(s),y,2+h],[at(s),y+w*.66,2+h*.55],[at(s),y+w,2],[at(s),y,2-h*.65]]);
            for(let j=0;j<sections.length-1;j++)for(let face=0;face<6;face++){
              const next=(face+1)%6,m=face===0||face===3?edge:face===2?steel:fuller;
              facet(g,sections[j][face],sections[j+1][face],sections[j+1][next],m);
              facet(g,sections[j][face],sections[j+1][next],sections[j][next],m);
            }
            for(const end of [0,sections.length-1]){const c=rows[end];for(let j=0;j<6;j++)facet(g,[at(c[0]),c[1],2],sections[end][j],sections[end][(j+1)%6],steel);}
          };
          forged([[.704,0,4,2],[.75,0,13,4],[.828,0,12,4.2],[.995,0,.07,.08]]);
          for(const side of [-1,1]){
            forged([[.721,side*5,3,2],[.764,side*19,9,3.6],[.824,side*28,9.5,3.9],[.942,side*28,.07,.08]]);
            // A recessed groove ends before each point, leaving clean cutting tips.
            carve([[at(.75),side*17,5],[at(.8),side*27,5.7],[at(.895),side*28,3.7]],fuller,.45);
          }
          sleeve(at(.671),at(.728),5.6,7.1,steel);
          for(const s of [.675,.689,.716])sleeve(at(s),at(s)+1.3,6.5,6.5,edge);
          enamelEye(at(.70),0,7.7,1,edge);gem(g,[at(.70),0,8],7,1.8,mat('#83d6ef',.16,.5),6);
          for(const s of [.29,.47,.62]){sleeve(at(s),at(s)+2.6,5.5-3*s,5.5-3*s,steel);seam(s-.009,s+.009,3,5.5-3*s,fuller,.22);}
          break;
        }
        case 'wukong':
          for(const s of [.30,.87]){sleeve(at(s)-8,at(s)+9,9,9,metal);curl(at(s),-8,8,trim);curl(at(s),8,8,trim);}
          sectionBody([[at(.48),0,4,2,2],[at(.53),0,4,19,9],[at(.59),0,4,23,10],[at(.65),0,4,16,8],[at(.69),0,4,3,3]],body,{rows:32});
          for(const side of[-1,1]){leaf([at(.52),side*5,13],[at(.6),side*17,16],[at(.67),side*6,12],5.5,ivory,metal);enamelEye(at(.6),side*10,17,side);curl(at(.68),side*13,9,metal);
            const plume=spine([[at(.62),side*16,6],[at(.70),side*46,6],[at(.84),side*52,5],[at(.95),side*27,3]],4.5,mat('#bc8541',.45,.13),metal,1.4);
            for(let j=1;j<10;j++){const q=plume.sample(j/11);curve([[q[0]-6,q[1]+side*3,7],[q[0],q[1],8],[q[0]+5,q[1]-side*3,7]],.28,ivory);}
            spine([[at(.44),side*5,4],[at(.39),side*27,5],[at(.31),side*32,4],[at(.22),side*19,3]],4.5,body,metal);}
          gem(g,[at(.64),0,17],11,4,trim,8);cloud(at(.37),0,13);break;
      }
      return finishModel(g,p,{collection:'journey',silhouette:p.id,rarity:journeyIndex<3?'common':journeyIndex<7?'rare':journeyIndex<17?'epic':'legendary',continuousBody:true,reel:reelStyle,materials:'engraved-gilt-lacquer'});
    }

    if(p.id==='walnut'){
      // Joinery, rather than applied foliage, supplies this travel rod's shape.
      sectionBody([[108,0,0,6.7,5.8],[113,-.2,0,8.7,6.2],[124,-.6,0,7.6,5.8],[139,0,0,5.8,5.3]],mat('#886043',.35,.06,7),{rows:26,sides});
      sleeve(108,112,6.9,8.4,metal);sleeve(124,128,7.6,6.9,metal);
      for(const y of [-2.7,2.7])carve([[126,y,5.95],[159,y*.91,5.4],[210,y*.6,4.4],[260,y*.35,3.5]],mat('#d1b58c',.39,.08),.31);
      for(const x of [117,121])bolt([x,0,6.5],.9,metal);
      sectionBody([[49,30,11,1.7,1.4],[48,36,13,2.2,1.9],[54,40,15,1.7,1.5]],metal,{rows:14,sides:10});
      bolt([48,35,15],2.2,metal);carve([[45,35,16],[51,35,16]],dark,.31);
      for(const x of [10,37]){sleeve(x-1.4,x+1.4,8.7,8.7,mat('#4d3830',.56,.02));if(fine)for(let i=0;i<7;i++)bolt([x-1+i*.35,-7.8,3],.24,metal);}
      revolved(g,[-12,0,0],[1,0,0],[[.1,0],[5.4,0],[6.2,.65],[5.2,1.2],[.1,1.2]],metal,around);
    }else if(p.id==='porcelain'){
      const cobalt=mat('#315b84',.23,.09),porcelain=mat('#e8efec',.2,.035,8);
      sectionBody([[106,0,0,5.8,5.5],[115,-1,0,10.4,6.5],[131,-1.8,0,11.7,6.7],[151,-.8,0,8.1,5.8],[174,0,0,4.9,4.4]],porcelain,{rows:42,sides:fine?26:16,lobes:5,flute:.025});
      for(const side of [-1,1]){const pts=[];for(let i=0;i<=40;i++){const t=i/40;pts.push([115+t*48,side*(4.2+1.7*Math.sin(t*TAU)),5.9+Math.sin(t*Math.PI)*.8]);}carve(pts,cobalt,.63);const curl=[];for(let i=0;i<=30;i++){const t=i/30,a=t*TAU*1.2,r=6*(1-.7*t);curl.push([131+Math.cos(a)*r,side*(4+Math.sin(a)*r),7.02]);}carve(curl,cobalt,.43);}
      for(const x of [114,164])sleeve(x,x+2, x===114?9.5:5.8,x===114?9.7:5.6,silver);
      for(const x of [6,43]){const pts=[];for(let i=0;i<=32;i++){const a=i/32*TAU;pts.push([x+Math.sin(a*3)*1.5,Math.cos(a)*8.3,Math.sin(a)*7.6]);}carve(pts,cobalt,.49);}
      const crest=leaf([81,19,16],[91,25,17.5],[83,33,17],3.3,cobalt,silver);veins(crest,2,silver);
      seam(.46,.83,.65,s=>5.6*(1-s)+1.6,cobalt,.34,.8);
    }else if(p.id==='citrus'){
      const green=mat('#62844a',.27,.12),pith=mat('#eadeba',.5,.03),orange=mat('#e48b39',.24,.15);
      for(const side of [-1,1]){const sprig=leaf([110,side*2,1],[132,side*14,3],[163,side*12,3],6.2,green,mat('#adb77a',.31,.33));veins(sprig,5,mat('#a7b774',.36,.12));}
      sectionBody([[108,0,0,5.8,4.9],[120,0,1,8,5.8],[132,0,1.4,7.4,5.5],[146,0,.5,5,4.4]],orange,{rows:30,sides,lobes:7,flute:.038});
      for(const dir of [-1,1])for(let k=0;k<(fine?6:4);k++)seam(.004,.113,dir*1.25,s=>8.85-.7*s/.113,pith,.37,k/(fine?6:4)*TAU);
      for(const x of [106,149])sleeve(x,x+3,x===106?6.5:5.1,x===106?6.7:5,pith);
      leaf([65,17,11],[61,22,13],[68,28,13],4.7,green,metal);
      revolved(g,[83,26,17.1],[0,0,1],[[.05,0],[5.3,0],[5.7,.6],[4.8,1.2],[.05,1.4]],orange,around);
      for(let i=0;i<7;i++){const a=i/7*TAU;carve([[83+Math.cos(a)*1.1,26+Math.sin(a)*1.1,18.56],[83+Math.cos(a)*4.6,26+Math.sin(a)*4.6,18.15]],pith,.3);}
    }else if(p.id==='amber'){
      const wood=mat('#544133',.39,.05,7),resin=mat('#e2a94c',.16,.08,10),pine=mat('#667547',.49,.04),bronze=mat('#b79b6a',.27,.77,13);
      sectionBody([[105,-1,0,6.1,5.4],[114,-1.5,1,10.8,8.1],[134,-1.2,2,12.4,9.2],[157,0,1.6,8.9,7.1],[176,0,0,4.8,4.4]],resin,{rows:42,sides:fine?28:16,lobes:5,flute:.055});
      carve([[112,-2,4],[128,-1.6,4.5],[152,1,4],[166,2,3]],wood,.61);
      for(let i=0;i<(fine?12:7);i++){const x=116+i*(fine?3.5:6.5),y=-2+(x-116)*.06;for(const sign of [-1,1])carve([[x,y,4.5],[x-4,sign*(3.5+i%3*.65),5.4],[x-7,sign*(6+i%3*.7),4.6]],pine,.23);}
      for(const sign of [-1,1])sectionBody([[103,sign*2,1],[119,sign*11,1.5,2.4,1.9],[146,sign*13,1,2,1.5],[169,sign*5,1,.45,.45]].map((v,i)=>i? v:[...v,3.3,2.6]),wood,{rows:35,sides:12});
      for(const [x,y]of [[114,-9],[148,11]]){sectionBody([[x,y,1,2,1.7],[x+10,y*1.5,3,1.5,1],[x+20,y*1.55,5,.15,.2]],bronze,{rows:18,sides:10});}
      sleeve(102,109,6.4,7.1,bronze);sleeve(171,177,5.3,4.8,bronze);
      for(const s of [.49,.68,.84])sleeve(s*L-2,s*L+3,5.5*(1-s)+1.6,5.5*(1-s)+1.5,wood);
      revolved(g,[83,26,17],[0,0,1],[[.05,0],[6.7,0],[7.5,1.3],[6.2,3.2],[.05,4]],resin,around);
    }else if(p.id==='vinyl'){
      const navy=mat('#285b80',.23,.18),black=mat('#142029',.3,.27,11),nickel=mat('#b5c9ce',.25,.78,6),brass=mat('#c7aa70',.28,.72,6);
      sectionBody([[106,0,0,5.8,3.9],[112,-2,1,8.5,4.4],[135,-3.4,2,8.4,3.9],[151,-2,1,6.1,3.7],[172,0,0,4.6,3.4]],navy,{rows:36,sides:fine?24:14});
      // The cantilevered tonearm terminates in a sculpted cartridge, joined at
      // a real hinge to the lacquer chassis beside the grooved fly reel.
      sectionBody([[104,-1,4,2,1.4],[113,-11,6,2.3,1.6],[134,-16,6.7,1.9,1.5],[151,-10,6.2,1.5,1.2]],nickel,{rows:30,sides:12});
      sectionBody([[147,-11,5.7,2,1.3],[155,-8,6,3.3,2],[163,-5.8,5.8,2.5,1.6],[166,-5,4.4,.4,.35]],black,{rows:18,sides:12});bolt([112,-9,8],2.25,brass);
      for(let i=0;i<(fine?24:12);i++){const a=i/(fine?24:12)*TAU,r=12;carve([[83+Math.cos(a)*r,23+Math.sin(a)*r,15.85],[83+Math.cos(a)*(r+(i%3===0?1.7:.8)),23+Math.sin(a)*(r+(i%3===0?1.7:.8)),15.85]],nickel,.18);}
      for(const r of [5.5,7.2,8.7,10.2,11.6])torus(g,[83,23,15.86],[1,0,0],[0,1,0],r,.13,black,fine?48:24,4);
      revolved(g,[83,23,16.2],[0,0,1],[[.1,0],[4.5,0],[4.5,.35],[.1,.5]],brass,around);
      for(const y of [-3.5,3.5])carve([[172,y,3.2],[211,y*.75,2.9],[250,y*.5,2.5]],nickel,.34);
      for(let i=0;i<10;i++)carve([[114+i*3.2,-4.5,5.35],[114+i*3.2,-2.3,5.65]],brass,.2);
    }else if(p.id==='nautilus'){
      const pearl=mat('#e6d8c0',.19,.21,12),blue=mat('#366e82',.22,.24),rim=mat('#c8d9d6',.21,.74,6);
      // A logarithmic shell grows from its innermost whorl as one continuous
      // expanding surface. Chamber ribs follow the same curved body.
      const shell=[],count=fine?68:38;for(let i=0;i<=count;i++){const t=i/count,a=-.6+t*TAU*1.43,r=2.5+18*t*t;shell.push([133+Math.cos(a)*r,-3+Math.sin(a)*r,6+4*t, .9+6.5*t*t,.8+5.7*t*t]);}
      sectionBody(shell,pearl,{rows:fine?104:52,sides:fine?18:10,lobes:3,flute:.018});
      for(let i=0;i<(fine?20:11);i++){const t=.26+i/(fine?20:11)*.72,a=-.6+t*TAU*1.43,r=2.5+18*t*t,c=[133+Math.cos(a)*r,-3+Math.sin(a)*r,6+4*t],axis=unit([-Math.sin(a),Math.cos(a),0]);torus(g,c,[Math.cos(a),Math.sin(a),0],[0,0,1],.9+6.5*t*t,.32,i%4===0?rim:mat('#b69e80',.34,.28),fine?22:12,4);}
      const nacre=leaf([107,3,1],[139,19,4],[173,8,2],7,blue,rim);veins(nacre,5,rim);
      const intake=[];for(let i=0;i<=28;i++){const a=i/28*Math.PI*1.82;intake.push([165+Math.cos(a)*7.7,1+Math.sin(a)*6,12+Math.sin(a)*1.2]);}carve(intake,rim,.7);
      seam(.43,.86,1.2,s=>6.2*(1-s)+1.5,pearl,.71,.4);
      for(const side of [-1,1])carve([[69,side*4,6],[74,side*7+9,12],[80,side*7+20,15]],rim,.6);
    }else if(p.id==='alpine'){
      const forged=mat('#a9c1cc',.31,.76,6),ice=mat('#b7dfe9',.12,.1,14),rope=mat('#cf744d',.56,.015,4),rubber=mat('#293c45',.71,.02,3);
      sectionBody([[106,0,0,5.2,3.1],[121,-2,0,7.5,3.3],[146,-2,0,6,3.1],[173,0,0,4.4,2.9]],forged,{rows:30,sides:12,lobes:4,flute:.12});
      ribbon(g,[[117,-1,0],[130,-17,2],[151,-25,2],[178,-21,1]],t=>Math.max(.06,3.4*(1-t)+1.8*Math.sin(Math.PI*t)),forged,dark,{rows:fine?34:19,sides:12,depth:1.8});curve([[120,-2,4],[136,-20,4],[158,-24,3],[175,-21,1.6]],.54,ice);
      for(let i=0;i<6;i++){const x=138+i*5.2,y=-21-(i<3?i*.65:(5-i)*.7);leaf([x,y,1],[x+2,y+3.8,1],[x+5,y+.5,1],1.3,forged,null);}
      sectionBody([[117,2,1,3,2.8],[126,12,3,4.2,2.6],[137,17,3,6.1,2],[144,18,2,3.3,1.4]],forged,{rows:26,sides:14});
      for(const x of [116,128])bolt([x,0,4.2],1.4,dark);
      for(let i=0;i<10;i++)sleeve(i*4.3-1,i*4.3+1.2,8.85-i*.04,8.85-i*.04,rubber);
      for(const dir of [-1,1])seam(.23,.29,dir*2.25,7,rope,.73,dir*.8);
      curve([[115,6,2],[105,15,4],[98,20,5],[93,17,6],[99,10,6],[105,15,4],[99,18,7]],.83,rope,40);
      leaf([171,0,2],[238,-3,2],[312,-1.2,1.4],2.2,ice,forged);
    }else if(p.id==='candlewyrm'){
      const lacquer=mat('#29232c',.22,.17,16),bone=mat('#c1a180',.3,.43),red=mat('#a94a38',.15,.08,14),ember=mat('#e8a46e',.28,.15),soot=mat('#45313a',.35,.18);
      sectionBody([[105,0,0,6.5,5],[125,-2,0,11.5,7],[143,-3,0,9,6.2],[163,-3,0,6,4.7],[187,-1,0,4.1,3.6]],lacquer,{rows:fine?42:25,sides,lobes:5,flute:.055});
      // The dragon's back and forked antlers are load-bearing continuations of
      // the lantern housing; the dark blade remains readable without its FX.
      const ridge=spine([[112,-4,-1],[151,-20,0],[213,-23,1],[279,-16,1],[350,-5,0]],9,lacquer,bone,2.5);veins(ridge,6,bone);
      for(const sign of [-1,1]){curve([[119,sign*5,2],[137,sign*14,4],[159,sign*22,6],[187,sign*17,6],[204,sign*8,4]],[3.8,3.3,2.1,1.1,.06],bone,40);curve([[156,sign*20,6],[166,sign*29,5],[185,sign*29,4]],[1.8,1.3,.04],bone,24);}
      // Raised cheek planes, deep eye channels and a blunt split muzzle make
      // the carved wyrm legible below its lamp, instead of burying a face under it.
      sectionBody([[115,-1,5,3,2],[124,-1,7,9.2,3.8],[135,-1,8,8,4.5],[145,-1,9,5.4,3.8],[153,-1,8,4.8,2.8],[157,-1,7,1.1,1]],lacquer,{rows:34,sides:20,lobes:3,flute:.045});
      for(const sign of [-1,1]){
        curve([[121,sign*4-1,9],[128,sign*9-1,12],[138,sign*8.6-1,13],[145,sign*5-1,12]],[1.9,1.8,1.4,.55],bone,28);
        ribbon(g,[[136,sign*10-1,14.4],[139,sign*6.4-1,15.8],[141,sign*2.9-1,15]],t=>Math.max(.04,1.7*Math.sin(t*Math.PI)),soot,null,{rows:18,sides:10,depth:.4});
        ribbon(g,[[136.8,sign*9.4-1,15.1],[139.6,sign*6.2-1,16.5],[141.6,sign*3.5-1,15.7]],t=>Math.max(.03,.98*Math.sin(t*Math.PI)),mat('#efb86a',.18,.06,18),null,{rows:18,sides:10,depth:.26});
        curve([[142,sign*3.3-1,12],[149,sign*4.4-1,12],[155,sign*2.4-1,10]],[1.35,1.1,.2],bone,22);
        curve([[144,sign*3-1,10],[153,sign*4-1,9.9],[159,sign*1.7-1,8.6]],.5,soot,20);
        curve([[144,sign*7-1,8],[147,sign*15-1,10],[158,sign*16-1,9],[167,sign*12-1,7]],[.85,.7,.4,.02],bone,27);
      }
      sectionBody([[143,-1,7,3.7,1.2],[151,-1,8,5.5,1.3],[160,-1,7.5,2.6,.9],[162,-1,6,.1,.1]],bone,{rows:24,sides:12});
      for(const sign of [-1,1])leaf([150,sign*1.8-1,11.4],[153,sign*2.3-1,11.5],[155,sign*1.7-1,10.7],.7,soot,null);
      sectionBody([[164,-1,8,.3,.5],[170,-1,9,4.6,4.4],[179,-1,9,5.6,5.1],[193,-1,7,3.3,3],[201,-1,5,.1,.1]],red,{rows:32,sides:18,lobes:6,flute:.08});
      curve([[169,-1,9],[178,-.3,11],[186,-1.4,9.4],[196,-.4,7]],[.6,1.35,.7,.06],ember,26);
      for(const sign of [-1,1])curve([[164,sign*3,7],[180,sign*7.1,9],[192,sign*4.9,7],[201,sign*.5,5]],[1.1,.95,.75,.4],bone,30);
      for(let i=0;i<8;i++){const x=180+i*18;leaf([x,-8,2],[x+9,-17+i*.65,3],[x+19,-7,2],2.6,soot,bone);}
      curve([[81,21,17],[89,23,18],[91,30,17],[83,32,17],[80,26,18]],.7,bone,32);
    }else if(p.id==='thunderdrum'){
      const blue=mat('#244763',.24,.18),bronze=mat('#bca064',.27,.78,13),skin=mat('#a59c80',.66,.03,2),nickel=mat('#c3d7df',.23,.8,6);
      const c=[138,-1,6];sectionBody([[103,0,0,6,4.8],[120,-1,0,9,5.7],[142,-1,0,11,6],[166,0,0,6,4.5]],blue,{rows:30,sides});
      revolved(g,c,[0,0,1],[[.1,-5],[14,-5],[17,-4],[18,-2],[17,4],[15.8,5],[.1,5]],bronze,fine?40:24);
      revolved(g,add(c,[0,0,5.2]),[0,0,1],[[.05,0],[14.6,0],[15,.5],[13.5,1],[.05,1.2]],skin,fine?40:24);
      for(let i=0;i<12;i++){const a=i/12*TAU,xy=[Math.cos(a)*16.3,Math.sin(a)*16.3];curve([[c[0]+xy[0],c[1]+xy[1],2],[c[0]+xy[0]*1.04,c[1]+xy[1]*1.04,7],[c[0]+xy[0]*.95,c[1]+xy[1]*.95,11]],.68,bronze,8);bolt([c[0]+xy[0]*.9,c[1]+xy[1]*.9,12.1],.8,bronze);}
      for(const sign of [-1,1]){
        spine([[116,sign*5,-1],[147,sign*22,0],[215,sign*28,1],[285,sign*19,2],[345,sign*7,1]],5.3,blue,bronze,2.7);
        curve([[150,sign*22,4],[190,sign*20,4],[211,sign*29,4],[239,sign*14,4],[271,sign*18,4],[322,sign*7,3]],[1.8,1.6,1.4,1.2,.85,.1],nickel,46);
        for(let i=0;i<4;i++){const x=184+i*32;curve([[x,sign*(23-i*2),3],[x+8,sign*(13-i),3],[x+18,sign*(14-i),3]],.7,bronze,12);}
      }
      for(const y of [-4,4])curve([[76,23+y,17],[85,23+y,18],[91,23+y,17]],.45,bronze,10);
      for(let i=0;i<8;i++){const a=i/8*TAU;bolt([83+Math.cos(a)*8.3,26+Math.sin(a)*8.3,17.1],.65,bronze);}
    }else if(p.id==='abysswhale'){
      const blue=mat('#243e53',.25,.2),glass=mat('#62a9ba',.14,.07,19),pearl=mat('#cbd7cd',.23,.19,12),deep=mat('#315c70',.3,.2);
      sectionBody([[108,-1,-1,4.5,4],[133,-3,-1,11,6],[168,-4,-1,14.5,7],[206,-3,-1,12,6],[234,-1,-1,5.5,4],[250,0,0,3.5,3]],blue,{rows:fine?54:30,sides});
      spine([[125,-5,-2],[182,-24,-1],[246,-20,1],[301,-10,1],[359,-3,0]],6.6,blue,silver,2.5);
      for(const sign of [-1,1]){const fin=spine([[119,sign*3,0],[126,sign*18,1],[149,sign*36,3],[175,sign*39,4],[193,sign*26,2]],8.6,deep,silver,2.2);veins(fin,6,pearl);curve([[196,sign*9,3],[217,sign*15,4],[232,sign*7,3]],[1.2,.8,.08],silver,24);}
      // A glass belly is lifted clear of the opaque whale back. Its ribbed
      // silver cradle and internal pearl can be seen through the clear front.
      sectionBody([[149,-2,9,.3,.4],[157,-2,10,7,4.2],[180,-2,10,9,5.4],[207,-2,9,6,4],[215,-2,8,.2,.2]],glass,{rows:40,sides:22});
      for(let i=0;i<5;i++){const x=157+i*12,r=6+Math.sin(i/4*Math.PI)*2.5;curve([[x,-2-r,7],[x,-2-r*.6,11.5],[x,-2,12.8],[x,-2+r*.6,11.5],[x,-2+r,7]],.51,silver,24);}
      ellipsoid(g,[182,-2,11],[4.7,4.1,3.9],pearl,fine?12:8,fine?20:12);
      enamelEye(218,-5,5.9,-1,pearl);curve([[228,-3,5],[235,-1,4],[229,3.5,4]],.43,silver,18);
      for(let i=0;i<8;i++)curve([[199+i*3,4,5.4],[204+i*3,8-i*.2,4.4]],.25,pearl,5);
      for(const sign of [-1,1])spine([[107,0,0],[105,sign*15,1],[91,sign*22,2],[88,sign*16,1]],4.4,deep,silver);
    }else if(p.id==='foxfire'){
      const red=mat('#a84331',.22,.19),cream=mat('#ead8b9',.25,.12),gold=mat('#ceaa68',.25,.76,6),darkRed=mat('#642e31',.33,.11),rope=mat('#bd845a',.61,.02,4);
      sectionBody([[106,0,0,5.6,4.9],[121,0,2,10.9,7],[140,0,3,9,7.2],[157,0,3,5.4,5],[171,0,2,1.2,1.5]],red,{rows:38,sides:22,lobes:3,flute:.05});
      for(const sign of [-1,1]){spine([[121,sign*6,1],[139,sign*16,2],[163,sign*21,3],[172,sign*18,3]],5.6,cream,gold,2);enamelEye(138,sign*5.2,9,sign,gold);curve([[146,sign*5,7.5],[155,sign*3.1,8],[164,sign*.7,5]],[1,.7,.2],cream,18);}
      sectionBody([[157,0,6,2.8,1.7],[164,0,6,2.5,1.8],[169,0,5,.4,.3]],darkRed,{rows:12,sides:10});
      for(let k=0;k<3;k++){const sign=k===1?1:-1,spread=k===2?35:25;const tail=spine([[117,sign*4,-2],[164,sign*spread,-3+k*3],[226,sign*(spread+3),1+k*2],[284,sign*12,2],[326-k*11,sign*4,1]],k===2?5.2:7.8,k===1?cream:red,gold,2);if(k!==2)veins(tail,5,gold);}
      for(const [x,y]of [[225,-23],[272,15]])for(let i=0;i<5;i++){const a=-1.35+i*.68,dx=Math.cos(a)*15,dy=Math.sin(a)*15;leaf([x,y,5],[x+dx*.58,y+dy*.7,6],[x+dx,y+dy,4],3.3,gold,null);}
      for(const dir of [-1,1])seam(.242,.291,dir*2.2,8.2,rope,.62,.5);
      curve([[109,7,3],[100,16,5],[96,16,8],[95,10,8],[102,8,6],[107,14,5],[100,18,7]],.74,rope,40);
      for(let i=0;i<4;i++)curve([[100+i*.7,17,6],[87+i*1.4,24+i*.8,5],[80+i*1.8,22+i,4]],[.65,.6,.1],darkRed,20);
    }else if(p.id==='lilybell'){
      const green=mat('#53785e',.25,.18),porcelain=mat('#e9e9d9',.2,.055,8),vein=mat('#c5d2c8',.23,.7,6),pollen=mat('#d5bf7a',.38,.36);
      curve([[108,0,0],[149,-12,1],[199,-16,1],[257,-10,2],[320,-7,1],[375,-1,0]],[4.8,4.3,3.6,2.9,1.8,.3],green,64);
      for(const [x,y,sign,size]of [[138,-9,-1,9],[210,-15,1,8],[271,-8,-1,6.8]]){
        const bellCenter=[x+27,y+sign*22,5];curve([[x,y,1],[x+13,y+sign*16,2],[x+24,y+sign*23,4],[x+27,y+sign*22,5]],[2,1.5,1,.6],green,30);
        revolved(g,bellCenter,[.2,sign*.92,.28],[[.5,-2],[size*.25,-1],[size*.55,1],[size*.74,5],[size*.86,9,.6],[size,11.3,1],[size*.9,11.7,1],[size*.75,10.5,.65],[size*.62,6],[size*.43,2],[.3,.4]],porcelain,fine?35:20);
        curve([add(bellCenter,[.5,sign*2,.6]),add(bellCenter,[1.6,sign*9,2.4]),add(bellCenter,[2.6,sign*12,3])],.39,vein,16);ellipsoid(g,add(bellCenter,[2.6,sign*12,3]),[1.2,1.7,1],pollen,8,12);
        const l=spine([[x-13,y,0],[x+1,y-sign*19,1],[x+35,y-sign*24,2],[x+49,y-sign*11,1]],7.8,green,vein,1.4);veins(l,5,vein);
      }
      const cradle=spine([[102,0,0],[116,13,3],[144,16,4],[167,5,1]],6.2,green,vein);veins(cradle,5,vein);
      for(const x of [5,21,38])curve([[x,-5,6],[x+5,-3,7],[x+7,2,7],[x+4,5,6]],.43,vein,16);
    }else if(p.id==='sandscript'){
      const brass=mat('#c9ad6d',.29,.78,13),glass=mat('#d5e4d6',.1,.06,19),sand=mat('#bc9b5e',.67,.04),teal=mat('#456769',.29,.21),darkBrass=mat('#776746',.39,.64,13);
      for(const sign of [-1,1]){spine([[107,sign*4,0],[133,sign*20,1],[185,sign*23,0],[248,sign*14,1],[318,sign*4,0]],4.8,brass,darkBrass,2);curve([[113,sign*6,5],[123,sign*13,9],[142,sign*14,11],[161,sign*13,9],[173,sign*5,5]],[1.8,1.3,1.1,1.3,1.6],brass,36);}
      sectionBody([[120,0,10,6.7,6.7],[126,0,10,7.8,7.8],[140,0,10,1.8,1.8],[143,0,10,1.5,1.5],[156,0,10,7.6,7.6],[164,0,10,6.7,6.7]],glass,{rows:40,sides:fine?26:16});
      for(const x of [120,164])revolved(g,[x,0,10],[1,0,0],[[.1,-1],[7.5,-1],[8.7,-.3],[8.7,1],[7.6,1.8],[.1,1.8]],brass,around);
      sectionBody([[122,0,10,6,6],[128,0,10,6.5,6.5],[137,0,10,1.4,1.4]],sand,{rows:18,sides:16});
      sectionBody([[147,0,10,.4,.4],[159,0,10,6.4,6.4],[162,0,10,6.4,6.4]],sand,{rows:16,sides:16});curve([[138,0,10],[151,0,10]],.25,sand,6);
      const wheel=[219,-2,5];torus(g,wheel,[1,0,0],[0,1,0],17,2,brass,fine?48:28,8);torus(g,wheel,[1,0,0],[0,1,0],13.8,.7,teal,around,4);
      for(let i=0;i<24;i++){const a=i/24*TAU,r=i%6===0?13.7:15;carve([[219+Math.cos(a)*r,-2+Math.sin(a)*r,7],[219+Math.cos(a)*17,-2+Math.sin(a)*17,7]],darkBrass,i%6===0?.47:.25);}
      for(const a of [-.72,1.4,3.1])curve([[219,-2,5],[219+Math.cos(a)*9,-2+Math.sin(a)*9,6],[219+Math.cos(a)*15,-2+Math.sin(a)*15,5]],[1.3,.8,.4],brass,14);
      leaf([209,-7,8],[219,-2,9],[229,2,8],1.5,teal,brass);bolt([219,-2,9.3],1.6,brass);
      for(let i=0;i<9;i++)carve([[177+i*9,-4,4.5],[180+i*9,-2,4.5],[178+i*9,1,4.5]],brass,.26);
    }else if(p.id==='frostwolf'){
      const ice=mat('#a9d5df',.14,.11,14),steel=mat('#c3d2d6',.28,.77,6),blue=mat('#526f84',.28,.28),pearl=mat('#e0e9e5',.24,.16),nose=mat('#30414d',.23,.16);
      sectionBody([[107,0,0,6,5],[124,-1,0,11.5,7],[143,-1,2,12.5,7.2],[159,-.5,3,7.4,6],[174,0,3,3.7,3.6]],blue,{rows:42,sides:22,lobes:5,flute:.025});
      sectionBody([[108,0,1,5.7,4.5],[118,0,2,13,6.8],[129,0,3,12.5,6.5],[136,0,3,8.6,5]],steel,{rows:30,sides:20,lobes:9,flute:.055});
      sectionBody([[126,0,5,6,3],[137,0,7,11.7,5],[150,0,8,8.8,5],[162,0,9,5.2,3.4],[171,0,9,3.8,2.6]],blue,{rows:38,sides:22});
      for(const sign of [-1,1]){
        // Short backward-swept ears have an inset dark concha and share their
        // broad root with the cheek casting; no floating claws or round eyes.
        spine([[135,sign*7,5],[125,sign*15,8],[112,sign*20,11]],6.8,steel,pearl,2.5);
        spine([[133,sign*8.5,8],[125,sign*14.5,10.4],[116,sign*18.5,11.8]],3.8,nose,null,1.2);
        curve([[135,sign*3.7,12],[140,sign*7.6,14.8],[146,sign*10.3,12.7]],[1.5,1.75,.35],steel,22);
        ribbon(g,[[143,sign*10.3,14.8],[145,sign*7,16.6],[147,sign*3.5,16]],t=>Math.max(.04,1.85*Math.sin(t*Math.PI)),nose,null,{rows:18,sides:10,depth:.45});
        ribbon(g,[[143.8,sign*9.6,15.55],[145.8,sign*6.8,17.35],[147.8,sign*4.1,16.75]],t=>Math.max(.03,1.1*Math.sin(t*Math.PI)),mat('#c8f2f2',.15,.03),null,{rows:18,sides:10,depth:.27});
        curve([[149,sign*5.5,12],[160,sign*4.2,13],[170,sign*2.7,11.2]],[1.7,1.4,.3],steel,25);
        curve([[155,sign*4.2,10.7],[164,sign*4.7,11.3],[174,sign*2.4,10.3]],.51,nose,20);
        for(let k=0;k<4;k++)curve([[117+k*3.7,sign*(9+k*.5),6],[115+k*3.7,sign*(13+k*.3),6.8],[111+k*3.7,sign*(15+k*.3),5.9]],[.62,.5,.08],blue,12);
      }
      sectionBody([[150,0,8,3.8,1.5],[163,0,9,5.1,1.6],[174,0,8.8,3.4,1.2],[178,0,7.8,.3,.2]],steel,{rows:24,sides:14});
      sectionBody([[166,0,11,3.6,1.8],[172,0,11.8,3.8,2.1],[177,0,10.3,2.1,1.3],[179,0,9,.3,.4]],nose,{rows:18,sides:10});
      curve([[172,-2.3,13.1],[172.7,0,13.7],[172,2.3,13.1]],.25,steel,12);
      const edge=spine([[133,-8,-2],[181,-22,0],[252,-28,2],[311,-17,2],[382,-2,0]],11.2,ice,steel,3.6);veins(edge,6,pearl);
      for(let k=0;k<6;k++){const x=186+k*24;spine([[x,-20+k*.8,1],[x+11,-36+k*2.7,2],[x+27,-20+k*.8,1]],3.6,ice,steel,2.2);}
      curve([[186,-11,5],[238,-17,6],[282,-12,5],[346,-4,2]],.49,pearl,34);
    }else if(p.id==='rosevow'){
      const iron=mat('#3c333f',.27,.59,6),chrome=mat('#c0b9c2',.21,.79,6),ruby=mat('#b44c66',.17,.08,17),leafGreen=mat('#544653',.31,.29),glass=mat('#927589',.15,.09,17);
      for(const sign of [-1,1]){
        // Each chapel lancet is a thick, continuously swept ogive with open
        // space around two glass inserts, not a flat decal on the shaft.
        const frame=[[112,sign*3,1],[134,sign*24,2],[180,sign*31,3],[218,sign*8,2],[176,sign*14,4],[138,sign*12,3],[112,sign*3,1]];curve(frame,[2.6,2.2,1.8,.4,1.3,1.8,2.6],chrome,64);
        spine([[129,sign*12,2],[156,sign*23,3],[197,sign*16,3],[213,sign*8,2]],6.8,glass,chrome,1.1);
        curve([[131,sign*12,4],[166,sign*24,5],[196,sign*17,4]],.63,chrome,26);
      }
      for(const sign of [-1,1]){const pts=[];for(let i=0;i<=36;i++){const t=i/36,a=t*TAU*1.34+sign;pts.push([109+t*266,Math.sin(a)*9.5,Math.cos(a)*6]);}curve(pts,1.45,iron,64);for(let i=0;i<9;i++){const t=.09+i*.096,a=t*TAU*1.34+sign,x=109+t*266,y=Math.sin(a)*9.5,z=Math.cos(a)*6;curve([[x,y,z],[x+5,y+Math.sign(y||1)*5,z+1],[x+12,y+Math.sign(y||1)*3,z+1]],[1.15,.8,.02],chrome,12);}}
      for(let i=0;i<7;i++){const a=i/7*TAU;spine([[137,0,8],[140+Math.cos(a)*6,Math.sin(a)*7,14],[146+Math.cos(a)*10,Math.sin(a)*11,12],[151+Math.cos(a)*7,Math.sin(a)*7,10]],3.7,ruby,chrome,1.9);}
      for(let i=0;i<4;i++){const a=i/4*TAU+.4;spine([[140,0,11],[145+Math.cos(a)*3,Math.sin(a)*5,17],[150+Math.cos(a)*5,Math.sin(a)*5,14]],2.7,ruby,null,1.6);}
      for(const sign of [-1,1]){const l=spine([[127,sign*2,2],[127,sign*17,3],[145,sign*20,4],[154,sign*9,3]],5,leafGreen,chrome);veins(l,4,chrome);}
    }else if(p.id==='inkjudge'){
      const jade=mat('#314542',.2,.16),gold=mat('#b99e6e',.26,.76,6),paper=mat('#dbd3b9',.57,.02,9),red=mat('#963f37',.25,.1),ink=mat('#1e2d31',.24,.34),quill=mat('#889185',.3,.48);
      sectionBody([[108,0,0,6.4,5],[136,-2,0,8,5.5],[173,-2,0,6,4],[203,0,0,4.2,3.2]],jade,{rows:36,sides:20,lobes:6,flute:.04});
      const feather=spine([[133,-5,-1],[177,-20,1],[239,-34,2],[302,-26,2],[374,-4,1]],12,ink,gold,2.4);veins(feather,11,gold);
      curve([[135,-6,2],[190,-20,5],[253,-27,6],[313,-19,5],[374,-4,2]],[1.6,1.45,1.1,.7,.05],gold,54);
      if(fine)for(let i=0;i<20;i++){const t=.12+i*.036,center=feather.sample(t).slice(0,3);for(const a of [0,Math.PI])curve([add(center,[0,0,2]),add(feather.at(Math.min(.97,t+.045),a),[0,0,.5])],.21,quill,7);}
      // Scroll rollers are a functional reel face: a shallow folded paper
      // saddle joins their cylindrical bearings and carries the cinnabar seal.
      for(const sign of [-1,1]){curve([[70,26+sign*8,17],[83,26+sign*9,18],[95,26+sign*8,17]],1.9,gold,22);for(const x of [70,95])revolved(g,[x,26+sign*8,17],[1,0,0],[[.1,-1],[2.6,-1],[2.7,.6],[.1,1]],gold,16);}
      ribbon(g,[[71,26,18],[78,26,19.5],[87,26,18.5],[94,26,18]],7.5,paper,null,{rows:26,sides:14,depth:.45});
      sectionBody([[117,7,4,3,2],[123,11,5,5,3],[131,11,5,5,3],[136,8,4,2,1]],red,{rows:20,sides:8});
      for(const [x,y]of [[122,9],[126,11],[130,9]])carve([[x,y,8.3],[x,y+3,8.3],[x+2,y+3,8.3]],gold,.29);
      for(let i=0;i<5;i++)carve([[76+i*3,22,20],[76+i*3,28+(i%2)*2,20]],ink,.27);
      for(let i=0;i<7;i++){const a=i/7*TAU;curve([[329,Math.cos(a)*4,Math.sin(a)*3],[367,Math.cos(a)*3.1,Math.sin(a)*2.6],[408,Math.cos(a)*1.2,Math.sin(a)*1.1]],[.5,.39,.06],ink,32);}
    }else if(p.id==='butterfly'){
      const frame=mat('#bbbcd2',.24,.72,12),glass=mat('#b4b4d1',.16,.09,17),violet=mat('#81739d',.15,.08,14),silk=mat('#c3d7d1',.3,.33),deep=mat('#514668',.25,.28);
      for(const sign of [-1,1]){
        const upper=[[130,sign*3,2],[150,sign*20,1],[185,sign*44,3],[218,sign*37,5],[206,sign*20,6],[179,sign*8,4],[148,sign*3,2],[130,sign*3,2]];
        const lower=[[132,sign*3,1],[130,sign*24,2],[111,sign*37,4],[100,sign*30,5],[109,sign*14,5],[130,sign*3,1]];
        curve(upper,[2.8,2,1.6,.6,1.4,1.8,2.3,2.8],frame,70);curve(lower,[2.4,1.9,1.4,1.1,1.8,2.4],frame,45);
        for(const [ex,ey]of [[181,38],[206,32],[198,23]])curve([[140,sign*5,3],[165,sign*(ey*.55),4],[ex,sign*ey,4]],[1.1,.8,.42],frame,26);
        for(const [ex,ey]of [[111,31],[105,22]])curve([[132,sign*5,3],[123,sign*18,4],[ex,sign*ey,5]],[.9,.65,.4],frame,22);
        spine([[159,sign*16,3],[176,sign*32,4],[197,sign*37,4],[209,sign*35,4]],4.6,glass,frame,1);
        spine([[127,sign*12,3],[123,sign*26,4],[112,sign*32,5]],4,glass,frame,1);
        curve([[145,sign*3,2],[191,sign*9,1],[249,sign*16,1],[298,sign*11,1],[358,sign*2,0]],[1.9,1.7,1.15,.75,.06],frame,55);
      }
      sectionBody([[119,0,7,.3,.4],[130,0,8,5.5,4.8],[143,0,9,7.2,6.3],[157,0,8,4.7,4.2],[169,0,5,.1,.1]],violet,{rows:38,sides:22,lobes:5,flute:.045});
      for(let k=0;k<4;k++){const pts=[];for(let i=0;i<=32;i++){const t=i/32,a=t*TAU*1.2+k/4*TAU,r=2+3.2*Math.sin(t*Math.PI);pts.push([123+t*39,Math.cos(a)*r,8+Math.sin(a)*r*.8]);}curve(pts,.29,silk,34);}
      for(const sign of [-1,1])curve([[163,sign*2,4],[179,sign*9,6],[191,sign*10,7],[196,sign*7,7]],[.75,.6,.5,.12],deep,26);
    }else if(p.id==='sunforge'){
      const gold=mat('#dcbb7a',.22,.86,6),darkGold=mat('#ad8a4f',.31,.72,13),porcelain=mat('#eeead9',.19,.055,8),core=mat('#e8aa46',.13,.08,14),hot=mat('#e1a444',.24,.3,18),enamel=mat('#665c42',.34,.42);
      // The furnace's forked ivory chassis reaches into the flexible blank.
      // Its gold ribs follow the same continuously changing cross-section.
      for(const sign of [-1,1]){
        const wing=spine([[104,sign*4,-2],[140,sign*24,-1],[193,sign*33,0],[260,sign*26,1],[328,sign*7,0]],9.6,porcelain,gold,3.1);veins(wing,7,gold);
        curve([[112,sign*5,2],[148,sign*24,4],[213,sign*26,4],[284,sign*15,3],[345,sign*3,1]],[2.5,2.1,1.7,1.1,.05],gold,58);
        spine([[150,sign*20,0],[194,sign*43,2],[247,sign*38,3],[282,sign*24,1]],6.4,gold,darkGold,2.4);
        curve([[160,sign*24,3],[193,sign*39,5],[219,sign*36,6]],.59,porcelain,28);
      }
      const c=[150,-1,9];revolved(g,c,[0,0,1],[[.1,-7],[12,-7],[17,-4],[18,0],[16,4],[12,5],[.1,5]],darkGold,fine?48:28);
      revolved(g,add(c,[0,0,5]),[0,0,1],[[.05,0],[10.8,0],[11.8,1.5],[10.1,4],[6,6],[.05,6.8]],hot,fine?44:24);
      torus(g,add(c,[0,0,6]),[1,0,0],[0,1,0],12.5,1.4,gold,fine?44:24,8);
      // Alternating forged rays grow out of the beveled furnace rim and curl
      // backward, leaving genuine gaps and shadowed depth between the wings.
      for(let i=0;i<12;i++){
        const a=i/12*TAU,r=15,end=i%2?24:32,dx=Math.cos(a),dy=Math.sin(a),tangent=[-dy,dx];
        const ray=spine([[150+dx*r,-1+dy*r,10],[150+dx*(r+7)+tangent[0]*2,-1+dy*(r+7)+tangent[1]*2,12],[150+dx*end+tangent[0]*4,-1+dy*end+tangent[1]*4,8]],i%2?2.6:3.8,gold,darkGold,1.6);
        if(i%2===0)veins(ray,2,porcelain);
        bolt([150+dx*14,-1+dy*14,15],.76,gold);
      }
      ellipsoid(g,[150,-1,17.5],[11.1,11.1,6.9],core,fine?18:10,fine?32:18);
      for(let i=0;i<5;i++){const a=i/5*TAU;curve([[150+Math.cos(a)*2,-1+Math.sin(a)*2,21.7],[150+Math.cos(a+.4)*5,-1+Math.sin(a+.4)*5,21.8],[150+Math.cos(a+.75)*8,-1+Math.sin(a+.75)*8,20.8]],.38,hot,16);}
      for(const sign of [-1,1]){curve([[107,sign*6,4],[120,sign*10,7],[129,sign*16,10]],[3,2.4,1.6],gold,24);bolt([122,sign*11,10],1.55,gold);}
      for(let i=0;i<9;i++){const x=231+i*10;carve([[x,-3.2,4.6],[x+2.5,-1.5,4.7],[x,1,4.6],[x+3,2.6,4.4]],enamel,.23);}
      // Gilded inlays stop at silvered edges; they never cover the porcelain.
      for(const y of [-4.8,4.8])curve([[-5,y,6],[15,y*.98,7.4],[37,y*.88,7],[50,y*.7,5.8]],.55,gold,28);
      revolved(g,[83,26,17],[0,0,1],[[.1,0],[6.2,0],[7.2,.8],[6.2,2.2],[.1,2.7]],porcelain,around);
      for(let i=0;i<8;i++){const a=i/8*TAU;curve([[83+Math.cos(a)*3,26+Math.sin(a)*3,20],[83+Math.cos(a)*6,26+Math.sin(a)*6,19.6]],.46,gold,6);}
    }else if(p.id==='leviathan'){
      const bone=mat('#d0c5a4',.28,.48,12),teal=mat('#376f73',.23,.27,16),deep=mat('#26484c',.27,.22),crystal=mat('#84c2bd',.13,.08,14),gold=mat('#b7a277',.27,.77,6),pearl=mat('#e1e6d4',.18,.11,12);
      sectionBody([[104,0,0,6,5],[123,-1,0,10.5,7],[151,-1,0,13.4,7.5],[179,0,0,10.8,6.4],[208,0,0,5.6,4.3]],teal,{rows:46,sides:22,lobes:7,flute:.065});
      for(const sign of [-1,1]){
        // Three true spear-like crown prongs define this silhouette. Their
        // outer edges are marine bone and the hollow troughs are blue enamel.
        const prong=spine([[112,sign*5,-2],[164,sign*27,-1],[229,sign*38,0],[289,sign*31,1],[350,sign*17,2]],7.4,bone,gold,3);
        spine([[124,sign*7,2],[172,sign*25,3],[232,sign*34,4],[291,sign*27,4],[346,sign*17,3]],3.7,deep,null,1.6);
        veins(prong,7,gold);
        spine([[293,sign*30,1],[319,sign*31,3],[358,sign*15,3],[363,sign*9,1]],5.1,bone,gold,2.5);
        const fin=spine([[130,sign*4,-2],[152,sign*34,-1],[188,sign*46,1],[220,sign*35,2]],8.4,teal,bone,2.2);veins(fin,6,bone);
        curve([[149,sign*8,7],[164,sign*12,8],[183,sign*8,7],[195,sign*3,4]],[2.7,2.1,1.2,.15],bone,30);enamelEye(161,sign*6.2,8.4,sign,pearl);
      }
      const central=spine([[173,-2,4],[225,-3,7],[280,-2,6],[328,-1,5],[380,0,1]],6.7,crystal,bone,3.7);veins(central,7,gold);
      sectionBody([[130,0,10,.2,.3],[141,0,11,7.5,5],[161,0,12,9,6.6],[184,0,10,5.6,4.2],[196,0,7,.1,.1]],crystal,{rows:38,sides:24,lobes:6,flute:.065});
      curve([[144,0,11],[156,-1.5,13],[169,0,12],[181,.7,10]],[.65,1.2,.65,.1],pearl,25);
      // A restrained pearl chain hangs from real eyelets across the crown,
      // with metal spacers rather than pearls floating around the silhouette.
      const chain=[];for(let i=0;i<=20;i++){const t=i/20;chain.push([122+Math.sin(t*Math.PI)*-9,mix(-24,24,t),5+Math.sin(t*Math.PI)*2]);}curve(chain,.44,gold,30);
      for(let i=0;i<9;i++){const t=(i+.5)/9,c=[122+Math.sin(t*Math.PI)*-9,mix(-24,24,t),5+Math.sin(t*Math.PI)*2];ellipsoid(g,c,[1.65,1.65,1.6],pearl,fine?8:6,fine?12:8);}
      for(const sign of [-1,1])torus(g,[122,sign*24,5],[1,0,0],[0,1,0],2, .54,gold,16,5);
      for(let i=0;i<5;i++){const x=189+i*19;curve([[x,-4.4,4.6],[x+6,0,5.6],[x,4.4,4.6]],.6,bone,13);}
      const reelFin=spine([[70,22,14],[78,14,17],[95,20,17],[92,29,16]],4.5,teal,bone);veins(reelFin,4,gold);
    }else if(p.id==='eclipse'){
      const obsidian=mat('#292c40',.18,.44,15),gold=mat('#ad956d',.28,.73,6),edge=mat('#737387',.24,.59,6),starGlass=mat('#75749b',.12,.1,14),dust=mat('#bbb7ce',.22,.48),black=mat('#202738',.25,.34);
      // Two long, twisted armillary ovals alternate in front of and behind
      // the blank. Real negative space and overlap supply their volume.
      for(let k=0;k<2;k++){
        const pts=[],radii=[],n=fine?96:52;for(let i=0;i<=n;i++){const a=i/n*TAU,twist=a*1.4+k*Math.PI,spread=26+4*Math.sin(a*2);pts.push([226+Math.cos(a)*112,Math.sin(a)*spread*Math.cos(k*Math.PI*.42)+Math.sin(a*2)*5,Math.sin(a)*Math.sin(k*Math.PI*.42)*21+Math.sin(twist)*5]);radii.push(1.65+.45*Math.pow(Math.sin(a),2));}
        curve(pts,radii,k?gold:edge,n);
        const trace=pts.map((v,i)=>add(v,[0,Math.cos(i/n*TAU)*.7,1.1]));curve(trace,.33,k?edge:gold,n);
      }
      for(const sign of [-1,1]){
        spine([[103,sign*3,-1],[139,sign*14,0],[183,sign*17,1],[223,sign*8,0]],7.1,obsidian,gold,3.3);
        spine([[241,sign*5,0],[286,sign*18,1],[328,sign*15,1],[379,sign*1,0]],5.2,obsidian,edge,2.6);
        curve([[112,sign*5,1],[126,sign*10,3],[139,sign*11,4]],[2.6,1.8,.7],gold,22);
        curve([[317,sign*9,2],[332,sign*8,3],[339,sign*3,1]],[1.5,1.1,.4],gold,18);
      }
      // Faceted crystal is seated in a four-prong cage. Its star inclusions
      // remain within the polished glass, not a billboard or particle halo.
      gem(g,[223,0,10],40,11,starGlass,10);gem(g,[225,0,10],17,5.8,obsidian,8);
      for(const sign of [-1,1])curve([[193,sign*2,2],[210,sign*11,7],[231,sign*12,11],[245,sign*5,5]],[1.7,1.2,.9,.3],gold,35);
      for(let i=0;i<11;i++){const a=i*2.39996,r=2.3+(i%4)*1.8;const c=[208+i*2.7,Math.cos(a)*r,10+Math.sin(a)*r*.8];gem(g,c,1.25,.45,dust,4);}
      for(let i=0;i<10;i++){const x=131+i*21,sign=i%2?1:-1;curve([[x,sign*2,5],[x+6,sign*5,5.6],[x+11,sign*4.2,5.4]],.26,gold,8);}
      sectionBody([[106,0,0,6.7,5.4],[112,0,0,8.1,6.4],[120,0,0,6.3,5]],black,{rows:20,sides:10,lobes:5,flute:.13});
      for(let k=0;k<3;k++)spine([[1+k*10,-5,4],[12+k*10,-7,7],[24+k*10,-5,6]],2.1,obsidian,gold,1.4);
      revolved(g,[83,26,17],[0,0,1],[[.1,0],[6.7,0],[7.4,1],[6.4,2],[.1,3]],obsidian,24);
      torus(g,[83,26,19],[1,0,0],[0,1,0],4.8,.5,gold,24,5);gem(g,[83,26,21],6,2.1,starGlass,8);
    }
    return finishModel(g,p,{collection:'myriad',silhouette,rarity:common?'common':rare?'rare':EXPANSION_IDS.indexOf(p.id)<17?'epic':'legendary',continuousBody:true,reel:reelStyle,materials:'surface-crafted'});
  }
  function buildMesh(rod,lowDetail=false){
    const requestedProfile=profile(rod);if((requestedProfile.craft||EXPANSION_IDS.includes(requestedProfile.id)||JOURNEY_IDS.includes(requestedProfile.id)))return buildExpansionMesh(requestedProfile,lowDetail);
    const p=profile(rod),g=mesh(),metal=material(p.metal,.2,.86,6),trim=material(p.trim,.25,.65,6),wrap=material(p.wrap,.52,.04,4),grip=material(p.grip,.62,.03,/carbon|tide|frost|moon|astral/.test(p.id)?4:2),steps=lowDetail?36:p.id==='golden'?48:64,sides=lowDetail?10:p.id==='golden'?12:16,around=lowDetail?12:p.id==='golden'?16:22,sections=lowDetail?4:p.id==='golden'?5:6;
    const radius=s=>p.id==='guandao'&&s<.67?5.3-.5*s:1.38+5.35*Math.pow(1-s,1.18);
    if(p.id==='katana')swordBlank(g,lowDetail);else shaft(g,.015,.997,radius,material(p.shaft,p.pattern===0?.19:.3,p.pattern===6?.42:.12,p.pattern),steps,sides);
    shaft(g,-.022,p.id==='katana'?.242:.126,s=>p.id==='katana'?8.4:p.id==='golden'?9.3:9.6-.7*Math.cos((s+.022)/.148*Math.PI*2),grip,lowDetail?8:18,sides);
    shaft(g,-.027,-.018,p.id==='katana'?8.7:9.6,trim,2,sides);if(p.id!=='katana'){shaft(g,.125,.134,8.7,metal,2,sides);shaft(g,.137,.21,6.7,material(p.shaft,.3,.55,6),4,sides);shaft(g,.214,.272,7.1,grip,8,sides);shaft(g,.273,.282,6.6,trim,2,sides);}
    // Fine reel-seat threads, binding wraps and tapered ferrule transitions.
    if(p.id!=='katana')for(let i=0;i<7;i++)torus(g,[(.153+i*.006)*L,0,0],[0,1,0],[0,0,1],6.8,.34,metal,around,4);
    for(const s of p.id==='katana'?[-.015,.24]:[-.015,.016,.116,.224,.264]){shaft(g,s-.002,s+.002,p.id==='katana'?8.7:s<.13?9.8:7.3,metal,1,sides);}
    // Raised leather seams and a polished inset spine remain legible at card size.
    for(const a of p.id==='golden'?[]:[-.25,Math.PI-.25]){const seam=[];for(let i=0;i<=10;i++){const s=-.01+i*.012;seam.push([s*L,Math.cos(a)*9.7,Math.sin(a)*9.7]);}tube(g,seam,[.45],wrap,5);}
    if(p.id!=='katana')for(const s of [.34,.51,.7,.86]){const r=radius(s);shaft(g,s-.006,s+.008,r+(p.id==='bamboo'?.7:.33),p.id==='bamboo'?material(p.trim,.56,0,1):wrap,2,sides);shaft(g,s+.008,s+.011,r+.46,trim,1,sides);}
    // A spinning reel with a machined seat, stem, spool, bail and crank.
    tube(g,[[.177*L,0,1],[.178*L,10,5],[.185*L,16,7]],[2.6,2.7,3.2],metal,12);
    ellipsoid(g,[.177*L,18,5],[13,8.7,10],material(p.shaft,.38,.43,6),lowDetail?8:12,lowDetail?14:20);
    ellipsoid(g,[.207*L,25,8],[7.5,9.8,7.5],metal,lowDetail?8:12,lowDetail?14:20);
    const spoolAxis=unit([-.18,.15,1]),su=unit(cross([1,0,0],spoolAxis)),sv=unit(cross(spoolAxis,su)),spool=[.211*L,29,10];
    tube(g,[add(spool,scale(spoolAxis,-5)),add(spool,scale(spoolAxis,5))],[10.4,10.4],material(p.wrap,.65,.15,4),24);
    for(const d of [-5.7,5.7])torus(g,add(spool,scale(spoolAxis,d)),su,sv,11.5,1.4,metal,around,sections);
    for(let i=0;i<8;i++)torus(g,add(spool,scale(spoolAxis,-4.2+i*1.2)),su,sv,10.7,.38,material(p.grip,.67,.05,4),around,4);
    tube(g,[add(spool,scale(spoolAxis,5.8)),add(spool,scale(spoolAxis,6.6))],[8.7,8.7],material(p.shaft,.21,.35,0),lowDetail?12:20);
    // Open spokes over a dark enamel recess, with rivets and an engraved hub.
    for(let i=0;i<8;i++){const a=i/8*TAU,radial=add(scale(su,Math.cos(a)),scale(sv,Math.sin(a))),face=add(spool,scale(spoolAxis,7));tube(g,[add(face,scale(radial,3)),add(face,scale(radial,8.6))],[.75],metal,6);if(!lowDetail)ellipsoid(g,add(face,scale(radial,9.4)),[.75,.75,.65],trim,4,6);}
    ellipsoid(g,add(spool,scale(spoolAxis,7.2)),[3.2,3.2,2.2],trim,8,12);
    const bail=[];for(let i=0;i<=24;i++){const a=-.4+i/24*Math.PI*1.8;bail.push(add(add(spool,scale(spoolAxis,1.6)),add(scale(su,Math.cos(a)*15.5),scale(sv,Math.sin(a)*15.5))));}tube(g,bail,[.82],metal,8);
    tube(g,[[.175*L,18,11],[.15*L,29,14],[.133*L,38,16]],[1.7],trim,10);ellipsoid(g,[.133*L,39,19],[5,4.5,7],material(p.wrap,.53,.08,4),lowDetail?8:12,lowDetail?12:18);
    // Guides face the line side. Their feet stay aligned with the bent shaft.
    const guidePositions=p.id==='bamboo'?[.37,.55,.72,.87]:p.id==='katana'?[.36,.55,.73,.9]:p.id==='guandao'?[.34,.51,.65,.82,.92]:[.34,.47,.6,.72,.83,.92];
    for(const s of guidePositions){const ringRadius=9.8-7*s,stemRadius=radius(s),center=[s*L,stemRadius+ringRadius*.84,1.4];
      torus(g,center,[0,1,0],[.5,0,Math.sqrt(.75)],ringRadius,.75,metal,around,sections);
      torus(g,center,[0,1,0],[.5,0,Math.sqrt(.75)],ringRadius-.5,.3,material([.19,.25,.24],.29,.1),around,4);
      for(const side of [-1,1])tube(g,[[(s-side*.012)*L,stemRadius,0],[s*L,stemRadius+ringRadius*.65,1.4]],[.72],metal,6);
      if(p.id!=='katana')shaft(g,s-.014,s+.014,stemRadius+.36,wrap,2,sides);
    }
    torus(g,[L,0,0],[0,1,0],[.5,0,Math.sqrt(.75)],2.05,.58,metal,around,sections);
    torus(g,[L,0,0],[0,1,0],[.5,0,Math.sqrt(.75)],1.7,.22,material([.19,.25,.24],.29,.1),around,4);
    const detail=lowDetail?6:10,gold=material(rgb('#efbb50'),.2,.82,6),silver=material(rgb('#dbf2ff'),.18,.8,6),enamel=material(p.shaft,.16,.16,0),jewel=material(p.trim,.12,.28,0);
    const leaf=(start,end,width,depth,mat=trim,edge=metal,curve=0)=>blade(g,start,end,width,depth,mat,edge,curve,detail);
    const ring=(s,r=radius(s)+.5,mat=metal)=>torus(g,[s*L,0,0],[0,1,0],[0,0,1],r,.72,mat,around,sections);
    const spiral=(from,to,turns,radiusAt,mat,thickness=1)=>{const points=[],n=lowDetail?32:56;for(let i=0;i<=n;i++){const s=mix(from,to,i/n),a=i/n*TAU*turns,r=radiusAt(s);points.push([s*L,Math.cos(a)*r,Math.sin(a)*r]);}tube(g,points,[thickness],mat,lowDetail?6:8);};
    const scroll=(s,side,size,mat,z=7)=>{const points=[];for(let i=0;i<=24;i++){const t=i/24,a=t*TAU*1.15,r=size*(1-t*.78);points.push([s*L+Math.sin(a)*r,side*(7+Math.cos(a)*r),z+Math.sin(t*Math.PI)]);}tube(g,points,[1.55],mat,lowDetail?6:8);};
    if(p.id==='bamboo'){
      for(const s of [.285,.44,.6,.75,.88]){shaft(g,s-.006,s+.006,radius(s)+.7,wrap,1,sides);ring(s,radius(s)+.9,trim);}
      for(const side of [-1,1])leaf([.25*L,side*4,4],[.345*L,side*13,4],3.9,1.25,material(rgb('#448340'),.45,.03),trim,side*1.5);
      spiral(.28,.5,1.25,s=>radius(s)+.4,wrap,.85);
    }else if(p.id==='willow'){
      spiral(.245,.85,2.8,s=>radius(s)+.7,material(rgb('#c49650'),.34,.1,5),1.25);
      for(let i=0;i<5;i++){const s=.29+i*.075,side=i%2?-1:1;leaf([s*L,side*4,3],[(s+.071)*L,side*13,3],3.6,1.1,wrap,trim,side*2);}
      leaf([.18*L,-4,5],[.13*L,-17,5],4,1.3,wrap,trim,2);
    }else if(p.id==='carbon'){
      for(const s of [.135,.215,.28,.51,.71,.88])ring(s,undefined,gold);
      for(const y of [-2.6,2.6])tube(g,[[.29*L,y,4.7],[.48*L,y*.7,4.1],[.69*L,y*.5,2.9]],[.38],silver,5);
      shaft(g,.276,.29,7.1,metal,1,sides);
    }else if(p.id==='copper'){
      for(const s of [.295,.375,.455,.535]){shaft(g,s-.009,s+.009,radius(s)+.55,wrap,2,sides);ring(s-.01);ring(s+.01);}
      const compass=[.211*L,29,19];torus(g,compass,[1,0,0],[0,1,0],10.3,1.1,gold,around,sections);emblemStar(g,add(compass,[0,0,1]),8.6,gold,4);
      spiral(.3,.8,2,s=>radius(s)+.4,metal,.5);
    }else if(p.id==='rosewood'){
      for(const s of [.29,.38,.49,.65,.81]){shaft(g,s-.008,s+.008,radius(s)+.45,metal,2,sides);ring(s+.01,radius(s)+.7,trim);}
      for(const side of [-1,1]){leaf([.275*L,side*4,4],[.37*L,side*10,5],2.7,1,trim,metal,side*3);}
      emblemStar(g,[.211*L,29,19],7.6,trim,8);
    }
    if(p.advanced){
      if(!/katana|guandao|golden/.test(p.id))for(const s of [.13,.218,.273,.34,.49,.69,.86])ring(s,s<.28?7.25:radius(s)+.6,metal);
      // Sculpted sockets frame the jewel, with enamel between two gilt rails.
      if(!/katana|guandao|golden/.test(p.id)){for(const side of [-1,1])tube(g,[[.275*L,side*4.8,3],[.32*L,side*6.8,3],[.37*L,side*5.2,3],[.49*L,side*3.8,2]],[.8],metal,6);
      ellipsoid(g,[.259*L,0,7.8],[7,4.7,2.2],metal,6,10);ellipsoid(g,[.259*L,0,9.6],[5.7,3.4,2],jewel,8,12);}
      if(p.id==='golden'){
        // Restrained solid-gold silhouette: one seal, flush collars, fine chasing.
        // Broad uninterrupted surfaces carry the light instead of applied foliage.
        for(const s of [.006,.108,.269])ring(s,s<.13?9.45:7.15,trim);
        for(const angle of [.65,1.18,1.7,2.22]){
          const points=[];for(let i=0;i<=12;i++){const t=i/12,s=.024+t*.064,a=angle+Math.sin(t*Math.PI)*.035;points.push([s*L,Math.cos(a)*9.32,Math.sin(a)*9.32]);}
          tube(g,points,[.18],metal,5);
        }
        // A single shallow sovereign medallion belongs to the reel housing.
        ellipsoid(g,[.211*L,29,18],[8.7,8.7,1.1],gold,10,24);
        torus(g,[.211*L,29,18.7],[1,0,0],[0,1,0],7.8,.36,trim,32,5);
        emblemStar(g,[.211*L,29,19],4.1,trim,4);
      }else if(p.id==='tide'){
        const coral=material(rgb('#ff9277'),.26,.12),deep=material(rgb('#0787a1'),.19,.2),pearl=material(rgb('#a2f8ee'),.11,.32);
        for(const side of [-1,1]){
          tube(g,[[.268*L,0,5],[.3*L,side*9,7],[.34*L,side*17,6],[.38*L,side*20,4]],[2.8,2.45,1.55,.7],coral,8);
          tube(g,[[.307*L,side*10,7],[.335*L,side*21,5],[.357*L,side*25,5]],[1.9,1.3,.6],coral,8);
          tube(g,[[.334*L,side*16,6],[.365*L,side*10,6],[.39*L,side*9,4]],[1.8,1.3,.55],coral,8);
          leaf([.286*L,side*4,6],[.415*L,side*11,4],3.5,1.6,deep,metal,side*5);
        }
        scroll(.36,-1,10,deep,8);ellipsoid(g,[.32*L,0,11],[8,7,6],pearl,10,14);torus(g,[.32*L,0,9],[1,0,0],[0,1,0],8.1,1.1,metal,around,6);
        spiral(.44,.82,1.6,s=>radius(s)+.5,deep,1);
      }else if(p.id==='clockwork'){
        const brass=material(rgb('#e0a34a'),.23,.86,6),dark=material(rgb('#58402c'),.48,.6,6);
        for(const s of [.3,.365,.43,.505,.585,.68]){shaft(g,s-.004,s+.004,radius(s)+1.8,brass,1,sides);ring(s,radius(s)+2,brass);}
        for(const side of [-1,1])tube(g,[[.283*L,side*8,3],[.55*L,side*6,3],[.7*L,side*4,2]],[1.5],brass,8);
        gear(g,[.31*L,-10,7],12.5,12,brass,!lowDetail);gear(g,[.37*L,-6,7.5],9.6,10,metal,!lowDetail);gear(g,[.405*L,9,7],7.4,9,dark,!lowDetail);
        gear(g,[.211*L,29,20],9.1,12,brass,!lowDetail);gem(g,[.445*L,0,7],15,4,jewel);
      }else if(p.id==='frost'){
        const ice=material(rgb('#90ddff'),.11,.22),azure=material(rgb('#3289f0'),.19,.3),white=material(rgb('#e2fbff'),.15,.2);
        for(const side of [-1,1])for(let i=0;i<3;i++)gem(g,[(.29+i*.043)*L,side*(7+i*1.9),7],24-i*3,4.3-i*.4,i%2?ice:azure,5);
        spiral(.285,.92,2.8,s=>radius(s)+.5,silver,.8);
        for(const s of [.45,.6,.74])gem(g,[s*L,-2,radius(s)+1],18,3.2,ice,5);
        const snow=[.32*L,0,12];for(let i=0;i<6;i++){const a=i/6*TAU,v=[Math.cos(a),Math.sin(a),0],b=[-v[1],v[0],0];tube(g,[snow,add(snow,scale(v,12))],[.9],white,6);for(const side of [-1,1])tube(g,[add(snow,scale(v,7)),add(add(snow,scale(v,10)),scale(b,side*3))],[.62],silver,5);}
      }else if(p.id==='jade'){
        const jade=material(rgb('#35b879'),.16,.12),light=material(rgb('#a6ebbb'),.22,.09),silk=material(rgb('#fff1c6'),.5,.08);
        for(const side of [-1,1])leaf([.278*L,side*3,5],[.405*L,side*7,5],5,2.3,jade,gold,side*2);
        scroll(.315,-1,8.5,gold,9);scroll(.37,1,7,gold,8);
        for(const s of [.45,.59,.75]){shaft(g,s-.011,s+.011,radius(s)+.5,light,2,sides);ring(s-.013,undefined,gold);ring(s+.013,undefined,gold);}
        ellipsoid(g,[.32*L,0,11],[8.5,7,4],jade,10,16);
        tube(g,[[.265*L,-8,5],[.236*L,-15,4],[.215*L,-16,5]],[.9],gold,6);ellipsoid(g,[.208*L,-16,5],[4,4,3],jade,8,12);
        for(let i=0;i<6;i++)tube(g,[[.2*L,-17+i*.6,5],[(.137-i*.001)*L,-20+i*1.2,5]],[.65,.3],silk,5);
      }else if(p.id==='moon'){
        const purple=material(rgb('#5e389d'),.19,.2),moon=material(rgb('#ffe394'),.2,.73),lunar=material(rgb('#b9b4ff'),.12,.25);
        ellipsoid(g,[.33*L,-2,7],[18,13,4],purple,10,16);
        const arc=[],radii=[];for(let i=0;i<=32;i++){const t=i/32,a=.25+t*Math.PI*1.66;arc.push([.334*L+Math.cos(a)*19,-2+Math.sin(a)*14,11]);radii.push(.55+3.1*Math.pow(Math.sin(Math.PI*t),.7));}tube(g,arc,radii,moon,8);
        ellipsoid(g,[.342*L,1,12],[4.5,4.5,3.5],lunar,10,14);emblemStar(g,[.395*L,11,7],5.2,moon);emblemStar(g,[.29*L,-20,6],3.8,moon);
        for(const s of [.46,.57,.71,.83])emblemStar(g,[s*L,0,radius(s)+1],2.2,moon,4);
        spiral(.42,.84,1.3,s=>radius(s)+.4,lunar,.6);
      }else if(p.id==='phoenix'){
        const red=material(rgb('#dc3e28'),.22,.13),orange=material(rgb('#ff892f'),.22,.32),feather=material(rgb('#ffd15d'),.2,.66);
        for(const side of [-1,1])for(let i=0;i<4;i++){const start=[(.267+i*.013)*L,side*3,7],end=[(.395+i*.027)*L,side*(27-i*4.8),4+i*.8];leaf(start,end,4.8-i*.45,1.7,i%2?orange:red,feather,side*6);}
        for(const side of [-1,1])leaf([.29*L,side*2,10],[.427*L,side*8,7],3.8,1.5,feather,gold,side*2);
        leaf([.282*L,0,9],[.398*L,0,11],5,3,orange,feather,0);gem(g,[.367*L,0,14],13,3.6,feather,5);
        for(const side of [-1,1])leaf([.43*L,side*3,3],[.56*L,side*8,3],2.6,1,red,gold,side*3);
      }else if(p.id==='cloud'){
        const white=material(rgb('#f0fbf8'),.22,.15),blue=material(rgb('#4fbbd9'),.24,.16);
        for(const [s,side,size]of [[.29,-1,10],[.36,1,12],[.425,-1,8],[.54,1,6]]){ellipsoid(g,[s*L,side*7,5],[size+2,size,3.6],white,8,12);scroll(s,side,size,blue,9);}
        for(const side of [-1,1]){leaf([.28*L,side*4,4],[.47*L,side*20,4],5,1.6,blue,silver,side*8);leaf([.3*L,side*3,6],[.415*L,side*17,6],3,1,white,gold,side*5);}
        spiral(.47,.87,1.5,s=>radius(s)+.65,blue,.8);
      }else if(p.id==='astral'){
        const midnight=material(rgb('#253384'),.16,.23),star=material(rgb('#ffdc75'),.2,.75),crystal=material(rgb('#9da2ff'),.12,.3);
        ellipsoid(g,[.337*L,0,7],[15,11,7],midnight,10,16);
        torus(g,[.337*L,0,8],[1,0,0],[0,.85,.527],18,1.15,gold,around,6);torus(g,[.337*L,0,8],[.9,0,.436],[0,1,0],16.5,.85,silver,around,6);
        emblemStar(g,[.337*L,0,16],11,star,5);emblemStar(g,[.378*L,-11,9],4.2,star,4);gem(g,[.406*L,0,6],21,5.5,crystal,6);
        for(const side of [-1,1])leaf([.28*L,side*3,3],[.433*L,side*10,4],2.6,1.4,midnight,gold,side*4);
        spiral(.43,.91,2.2,s=>radius(s)+.55,gold,.7);for(const s of [.5,.63,.77])emblemStar(g,[s*L,0,radius(s)+1],3.1,star,4);
      }else if(p.id==='dragon'){
        const dragon=material(rgb('#d5a640'),.22,.82,6),jade=material(rgb('#288861'),.2,.2),horn=material(rgb('#ffe6a0'),.23,.58),eye=material(rgb('#e95430'),.13,.18);
        const coil=[];for(let i=0;i<=60;i++){const t=i/60,s=.274+t*.35,a=t*TAU*2.2;coil.push([s*L,Math.cos(a)*9.4,Math.sin(a)*7.3+1]);}tube(g,coil,[2.6],dragon,lowDetail?6:10);
        for(let i=0;i<13;i++){const t=i/12,s=.285+t*.315,a=t*TAU*2.2;leaf([s*L,Math.cos(a)*10,Math.sin(a)*7.5+3],[(s+.024)*L,Math.cos(a)*12,Math.sin(a)*7.5+3],2,1,jade,gold,0);}
        const head=[.642*L,-1,7];ellipsoid(g,head,[12,7.2,5.3],dragon,10,16);ellipsoid(g,add(head,[8,-1,1]),[7.5,5.5,3.4],dragon,8,12);
        for(const side of [-1,1]){tube(g,[add(head,[-5,side*5,1]),add(head,[-3,side*11,3]),add(head,[6,side*13,4])],[2,1.3,.25],horn,7);ellipsoid(g,add(head,[4,side*4.6,4.5]),[2.1,1.4,1],eye,6,8);tube(g,[add(head,[11,side*4,1]),add(head,[16,side*10,2]),add(head,[11,side*15,2])],[.7,.6,.2],gold,6);leaf([.535*L,side*4,4],[.59*L,side*18,5],3,1.5,dragon,gold,side*3);}
        for(let i=0;i<4;i++)gem(g,[(.588+i*.022)*L,0,10],8,2.3,horn,4);
      }else if(p.id==='lotus'){
        const pink=material(rgb('#f58eb3'),.22,.15),pale=material(rgb('#ffd5e5'),.18,.18),green=material(rgb('#429864'),.25,.1),center=[.326*L,0,7];
        for(const side of [-1,1])leaf([.27*L,side*3,4],[.42*L,side*19,4],6,1.8,green,gold,side*6);
        for(let i=0;i<7;i++){const a=i/7*TAU,end=add(center,[Math.cos(a)*23,Math.sin(a)*19,0]);leaf(center,end,5.8,2.2,pink,pale,0);}
        for(let i=0;i<5;i++){const a=i/5*TAU+.3,start=add(center,[0,0,4]),end=add(start,[Math.cos(a)*15,Math.sin(a)*12,0]);leaf(start,end,4.2,2.3,pale,pink,0);}
        ellipsoid(g,add(center,[0,0,9]),[4.8,4.8,3],gold,8,12);
        for(const s of [.47,.64,.79]){leaf([s*L,0,3],[(s+.045)*L,0,4],3,1.7,pink,pale);ring(s-.008,undefined,gold);}
      }else if(p.id==='guandao'){
        const steel=material(rgb('#79bdb7'),.19,.73,6),cutting=material(rgb('#d0f9ec'),.12,.83,6),darkJade=material(rgb('#126745'),.18,.21),golden=material(rgb('#f2cd78'),.19,.86,6),red=material(rgb('#a42d2d'),.42,.09,4);
        // A broad crescent blade is forged around the shared centreline. The
        // cutting edge, recessed jade face and bevel have separate geometry.
        const outline=[[.633,-3],[.657,-15],[.7,-25],[.765,-29],[.835,-25],[.902,-15],[.985,0],[.922,-4],[.842,-8],[.738,-7],[.66,-1]].map(([s,y])=>[s*L,y,2.2]),center=[.774*L,-14.5,5.8];
        for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],ia=add(scale(a,.81),scale(center,.19)),ib=add(scale(b,.81),scale(center,.19));ia[2]=ib[2]=5.4;facet(g,center,ia,ib,darkJade);facet(g,ia,a,b,i<7?cutting:steel);facet(g,ia,b,ib,i<7?cutting:steel);facet(g,[center[0],center[1],-1.2],b,a,steel);}
        tube(g,[...outline,outline[0]],[.65],golden,6);
        const spine=[];for(let i=0;i<=20;i++){const t=i/20;spine.push([(.669+t*.239)*L,-8-4*Math.sin(t*Math.PI),5.8]);}tube(g,spine,[1.15],golden,6);
        for(const s of [.3,.41,.52,.605]){shaft(g,s-.008,s+.008,6.1,golden,2,sides);ring(s-.01,6.5,gold);ring(s+.01,6.5,gold);}
        spiral(.282,.58,2.1,()=>5.65,golden,.85);
        const head=[.631*L,-1,5];ellipsoid(g,head,[13,8.6,5.5],golden,8,12);ellipsoid(g,add(head,[9,-2,1]),[7,6.2,4],golden,8,12);
        for(const side of [-1,1]){tube(g,[add(head,[-5,side*6,2]),add(head,[-2,side*13,3]),add(head,[8,side*15,3])],[2,1.2,.25],golden,7);ellipsoid(g,add(head,[5,side*5,5]),[2.2,1.4,1],material(rgb('#80f4b7'),.1,.2),6,8);leaf([.57*L,side*4,5],[.61*L,side*12,7],3.3,1.8,darkJade,golden,side*2);}
        for(let i=0;i<4;i++)leaf([(.603-i*.025)*L,-1,6],[ (.637-i*.025)*L,-1,8],3.6,1.1,darkJade,gold,0);
        tube(g,[[.604*L,6,2],[.573*L,15,4],[.536*L,19,3]],[1.2],red,6);
        for(let i=0;i<4;i++)leaf([.548*L,17+i,4],[(.432+i*.012)*L,24+i,3],1.4,.6,red,null,4);
        emblemStar(g,[.211*L,29,20],7.8,gold,4);
      }else if(p.id==='katana'){
        const black=material(rgb('#15232f'),.32,.34,4),ivory=material(rgb('#d8ddcf'),.55,.03,2),golden=material(rgb('#eabe61'),.2,.78,6),steel=material(rgb('#d6e5ef'),.18,.86,6);
        // Raised ivory diamonds sit between two intersecting lacquered cord
        // spirals; the sword grip is longer and has a proper oval tsuba.
        for(let i=0;i<7;i++){const s=.004+i*.031,c=[s*L,0,8.7],corners=[[c[0]-5,0,9],[c[0],-3.3,9],[c[0]+5,0,9],[c[0],3.3,9]];for(let j=0;j<4;j++)facet(g,add(c,[0,0,1]),corners[j],corners[(j+1)%4],ivory);}
        spiral(-.006,.23,6,()=>8.65,black,1.15);spiral(-.006,.23,-6,()=>8.7,black,1.15);
        shaft(g,-.027,-.017,9.1,golden,2,sides);shaft(g,.227,.241,9.2,golden,2,sides);shaft(g,.252,.271,6.7,golden,2,sides);
        ellipsoid(g,[.247*L,0,0],[2.2,17.6,10.3],black,8,16);
        const guard=[];for(let i=0;i<=36;i++){const a=i/36*TAU;guard.push([.247*L,Math.cos(a)*17.5,Math.sin(a)*10.1]);}tube(g,guard,[.9],golden,6);
        for(const side of [-1,1]){tube(g,[[.247*L,side*8,8],[.248*L,side*12,6],[.247*L,side*15,3]],[.8],golden,6);gem(g,[.247*L,side*10,7],3.4,1.5,steel,4);}
        // A compact circular reel reads as part of the sword's metal fittings.
        torus(g,[.211*L,29,18],[1,0,0],[0,1,0],9.5,1.1,black,around,6);emblemStar(g,[.211*L,29,20],6.4,golden,3);
        for(const s of [.015,.219])ring(s,8.8,golden);
      }
    }
    if(p.id==='golden')for(let i=0;i<g.data.length;i+=14){
      // Every fitting, wrap and guide is gold: satin engraving against polished ridges.
      const satin=g.data[i+9]>.4,brightness=.84+.16*g.data[i+7];
      g.data[i+6]=brightness;g.data[i+7]=brightness*(satin?.67:.79);g.data[i+8]=brightness*(satin?.16:.31);
      g.data[i+9]=satin?.30:.16;g.data[i+10]=.96;g.data[i+11]=6;
    }
    return{vertices:new Float32Array(g.data),triangles:g.data.length/42,profile:p};
  }
  const VERTEX=`
    precision highp float;
    attribute vec3 aLocal,aNormal,aColor,aMaterial;attribute vec2 aUv;
    uniform float uBend,uShadowPass;uniform mat4 uLightView;uniform vec2 uArea;
    varying vec3 vNormal,vColor,vPosition,vMaterial;varying vec2 vUv;
    void main(){
      float s=aLocal.x,q=clamp((s-.3)/.7,0.,1.),d=uBend*${L.toFixed(9)},f=.7*${L.toFixed(9)};
      float lateral=d*q*q*(3.-q)*.5,shortening=d*d/(2.*f)*(3.*q*q*q-2.25*q*q*q*q+.45*q*q*q*q*q),slope=d/f*(3.*q-1.5*q*q);
      float angle=atan(slope,1.-.5*slope*slope),c=cos(angle),sn=sin(angle);
      vec2 axis=vec2(${AXIS[0].toFixed(9)},${AXIS[1].toFixed(9)}),normal=vec2(${NORMAL[0].toFixed(9)},${NORMAL[1].toFixed(9)}),t=axis*c+normal*sn,n=normal*c-axis*sn;
      vec2 center=vec2(${GRIP.x},${GRIP.y})+axis*(s*${L.toFixed(9)}-shortening)+normal*lateral;
      vec3 p=vec3(center+n*aLocal.y,aLocal.z);vPosition=p;vNormal=normalize(vec3(t*aNormal.x+n*aNormal.y,aNormal.z));vColor=aColor;vMaterial=aMaterial;vUv=aUv;
      vec2 projected=p.xy+vec2(p.z*.22,-p.z*.14)+vec2(${PAD});gl_Position=vec4(projected.x/uArea.x*2.-1.,1.-projected.y/uArea.y*2.,-p.z/128.,1.);if(uShadowPass>.5)gl_Position=uLightView*vec4(p,1.);
    }`;
  const FRAGMENT=`
    precision highp float;varying vec3 vNormal,vColor,vPosition,vMaterial;varying vec2 vUv;
    ${Lighting?.fragment||'uniform float uShadowPass;vec4 fishingDepth(float d){return vec4(1.);}float fishingVisibility(vec3 p,vec3 n,vec3 l){return 1.;}'}
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float grain(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
    float glazeCrack(vec2 p){vec2 cell=floor(p),f=fract(p);float a=8.,b=8.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec2 o=vec2(float(x),float(y)),seed=cell+o,r=o+vec2(hash(seed),hash(seed+71.3))-f;float d=dot(r,r);if(d<a){b=a;a=d;}else b=min(b,d);}return sqrt(b)-sqrt(a);}
    void main(){
      bool transmission=abs(vMaterial.z-10.)<.1||abs(vMaterial.z-14.)<.1||abs(vMaterial.z-17.)<.1||abs(vMaterial.z-19.)<.1;
      if(uShadowPass>.5){if(transmission&&hash(floor(gl_FragCoord.xy))>.51)discard;gl_FragColor=fishingDepth(gl_FragCoord.z);return;}
      vec3 n=normalize(vNormal),view=normalize(vec3(-.22,.14,1.)),light=normalize(vec3(-.52,-.68,.78));float rough=vMaterial.x,metal=vMaterial.y,pattern=vMaterial.z,texture=1.;
      if(pattern>29.5){float tone=dot(n,light);float band=tone>.5?1.:tone>-.05?.82:.61;gl_FragColor=vec4(pattern>30.5?vColor:vColor*band,1.);return;}
      if(pattern>.5&&pattern<1.5)texture=.95+.045*sin(vUv.x*.08+sin(vUv.y*7.)*.3)+.02*sin(vUv.y*29.+vUv.x*.04);
      else if(pattern>1.5&&pattern<2.5)texture=.86+.13*hash(floor(vec2(vUv.x*1.1,vUv.y*12.)))+.035*sin(vUv.x*1.7);
      else if(pattern>2.5&&pattern<3.5)texture=.9+.08*sin(vUv.x*1.8+vUv.y*8.)*sin(vUv.x*1.8-vUv.y*8.);
      else if(pattern>3.5&&pattern<4.5)texture=.91+.075*cos(vUv.x*4.+vUv.y*2.);
      else if(pattern>4.5&&pattern<5.5)texture=.94+.06*sin(vUv.x*.07+sin(vUv.y*4.))+.025*sin(vUv.y*17.+vUv.x*.11);
      else if(pattern>5.5&&pattern<6.5)texture=.975+.025*sin(vUv.x*6.+vUv.y*4.);
      else if(pattern>6.5&&pattern<7.5){float growth=vUv.y*10.+sin(vUv.x*.034+sin(vUv.y*2.))*.65;texture=.86+.11*grain(vec2(vUv.x*.025,vUv.y*15.))+.045*sin(growth*5.);}
      else if(pattern>7.5&&pattern<8.5)texture=mix(.82,1.,smoothstep(.006,.055,glazeCrack(vec2(vUv.x*.2,vUv.y*4.3))))*(.985+.015*grain(vUv*11.));
      else if(pattern>8.5&&pattern<9.5){vec2 w=vec2(vUv.x*.7+vUv.y*3.4,vUv.x*.7-vUv.y*3.4);float weave=mod(floor(w.x)+floor(w.y),2.);texture=.76+.24*mix(sin(fract(w.x)*3.14159),sin(fract(w.y)*3.14159),weave);}
      else if(pattern>9.5&&pattern<10.5)texture=.87+.13*grain(vec2(vUv.x*.026,vUv.y*2.1));
      else if(pattern>10.5&&pattern<11.5)texture=.84+.16*pow(.5+.5*sin(vUv.x*15.),3.);
      else if(pattern>11.5&&pattern<12.5)texture=.97+.025*sin(vUv.x*.6+sin(vUv.y*3.)*1.4);
      else if(pattern>12.5&&pattern<13.5){vec2 h=vec2(vUv.x*.8,vUv.y*7.);texture=.9+.1*grain(h);n=normalize(n+vec3(grain(h)-.5,grain(h+17.)-.5,0.)*.09);}
      else if(pattern>13.5&&pattern<14.5)texture=.94+.055*sin(vUv.x*.11+vUv.y*3.4);
      else if(pattern>14.5&&pattern<15.5)texture=.8+.2*smoothstep(.2,.8,grain(vec2(vUv.x*.033,vUv.y*3.)));
      else if(pattern>15.5&&pattern<16.5){vec2 s=vec2(vUv.x*.2,vUv.y*3.);s.x+=mod(floor(s.y),2.)*.5;float scallop=abs(length(vec2(fract(s.x)-.5,fract(s.y)*.65))-.48);texture=.85+.15*smoothstep(.025,.1,scallop);}
      else if(pattern>16.5&&pattern<17.5)texture=.92+.08*grain(vec2(vUv.x*.12,vUv.y*4.));
      else if(pattern>17.5&&pattern<18.5)texture=.9+.1*grain(vec2(vUv.x*.31,vUv.y*3.));
      float diffuse=max(dot(n,light),0.),sky=max(n.z,0.),occlusion=.76+.24*sky;vec3 base=vColor*texture;
      vec3 fill=normalize(vec3(.65,.25,.6));float bounce=max(dot(n,fill),0.);
      vec3 color=base*(vec3(.2,.23,.28)*occlusion+vec3(1.1,1.02,.88)*diffuse*.86+vec3(.12,.19,.24)*bounce);
      float spec=pow(max(dot(n,normalize(light+view)),0.),mix(130.,20.,rough))*(.18+metal*.82),fresnel=pow(1.-max(dot(n,view),0.),3.);
      color+=mix(vec3(.95,.98,1.),base,metal*.66)*spec*.9; color+=mix(vec3(.44,.64,.85),base,.55)*fresnel*(.06+metal*.2);
      if(pattern>11.5&&pattern<12.5){vec3 pearl=.5+.5*cos(vec3(0.,2.1,4.2)+dot(n,view)*5.8+vUv.x*.075);color+=pearl*(.035+.1*fresnel);}
      if(transmission)color+=base*.12+vec3(.09,.16,.18)*fresnel;
      if(pattern>14.5&&pattern<15.5)color+=vec3(.11,.13,.21)*pow(max(dot(n,normalize(vec3(.7,-.2,1.))),0.),28.);
      color*=mix(.48,1.,fishingVisibility(vPosition,n,light));
      if(pattern>17.5&&pattern<18.5)color+=vec3(.44,.2,.028)*(.65+.35*max(n.z,0.));
      color=1.16*color/(vec3(1.)+color*.23);color=pow(max(color,vec3(0.)),vec3(.94));float alpha=1.;if(transmission)alpha=pattern<10.5?.66+.27*fresnel:pattern>18.5?.27+.42*fresnel:pattern>16.5?.66+.21*fresnel:.49+.32*fresnel;gl_FragColor=vec4(clamp(color,0.,1.),alpha);
    }`;
  function create(host,initial={}){
    if(!host?.ownerDocument)throw new Error('A live rod host is required.');
    const doc=host.ownerDocument,win=doc.defaultView||globalThis,ns='http://www.w3.org/2000/svg',staticSvg=host.querySelector('.fishing-rod-art'),previousVisibility=staticSvg?.style.visibility;
    let rod=initial.rod||{id:staticSvg?.dataset.rodId||'bamboo'},bend=0,destroyed=false,gl=null,ctx=null,program=null,buffer=null,meshData=null,cpuMesh=null,observer=null,lastSignature='',canvas,shadowMap=null,shadowsEnabled=initial.shadows!==false,paintedEntry=null,paintedGL=null,paintedPromise=Promise.resolve(null);
    let Painted=paintedFor(rod);
    const isPainted=()=>!!Painted?.assets[typeof rod==='string'?rod:rod?.id];
    const paintedSegments=()=>['weapon','device'].includes(Painted?.assets[paintedEntry?.id]?.rig)?1:64;
    function selectPainted(value){const id=typeof value==='string'?value:value?.id;doc.defaultView?.TracerFishingRelicVFX?.load(doc,id);doc.defaultView?.TracerFishingOnePieceVFX?.load(doc,id);doc.defaultView?.TracerFishingNarutoVFX?.load(doc,id);doc.defaultView?.TracerFishingValorantVFX?.load(doc,id);paintedEntry=Painted?.get(doc,id)||null;if(paintedEntry||!Painted?.assets[id]){paintedPromise=Promise.resolve(paintedEntry);return;}paintedPromise=Painted.load(doc,id).then(entry=>{if(!destroyed&&profile(rod).id===id){paintedEntry=entry;lastSignature='';draw();}return entry;}).catch(()=>{if(!destroyed&&profile(rod).id===id){prepareMesh();lastSignature='';draw();}return null;});}
    function makeCanvas(){const node=doc.createElement('canvas');node.className='fishing-rod-flex-canvas fishing-rod-3d-canvas';node.setAttribute('aria-hidden','true');Object.assign(node.style,{position:'absolute',display:'block',pointerEvents:'none',imageRendering:'auto'});host.appendChild(node);return node;}canvas=makeCanvas();
    const markers=doc.createElementNS(ns,'svg');markers.classList.add('fishing-rod-flex-markers');markers.setAttribute('viewBox','0 0 '+W+' '+H);markers.setAttribute('aria-hidden','true');Object.assign(markers.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',overflow:'visible',pointerEvents:'none'});
    const tipMarker=doc.createElementNS(ns,'circle'),gripMarker=doc.createElementNS(ns,'circle');for(const [node,kind]of [[tipMarker,'tip'],[gripMarker,'grip']]){node.classList.add('fishing-rod-flex-'+kind);node.setAttribute('r','.015');node.setAttribute('opacity','0');markers.appendChild(node);}gripMarker.setAttribute('cx',GRIP.x);gripMarker.setAttribute('cy',GRIP.y);host.appendChild(markers);
    function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(error);}return shader;}
    function releaseGL(lose=true){if(!gl)return;paintedGL?.destroy();paintedGL=null;canvas.removeEventListener('webglcontextlost',contextLost);shadowMap?.destroy();shadowMap=null;if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);if(lose)gl.getExtension('WEBGL_lose_context')?.loseContext();gl=null;buffer=program=null;}
    function contextLost(event){event.preventDefault();if(!destroyed){fallback();draw();}}
    function fallback(){releaseGL();canvas.remove();canvas=makeCanvas();ctx=canvas.getContext('2d',{alpha:true});meshData=isPainted()&&!meshData?null:buildMesh(rod,true);cpuMesh=null;lastSignature='';host.dataset.rodFlexRenderer='canvas2d';}
    function prepareMesh(){
      if(!meshData)meshData=buildMesh(rod,!gl);cpuMesh=null;if(!gl)return;
      // Painted collections never compile the PBR material shader, construct a
      // 20K-triangle fallback or allocate a shadow map unless loading fails.
      if(!program){const vertex=compile(gl.VERTEX_SHADER,VERTEX),fragment=compile(gl.FRAGMENT_SHADER,FRAGMENT);program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));buffer=gl.createBuffer();shadowMap=Lighting?.createShadowMap(gl,program,{size:1024,matrix:Lighting.lightView({center:[W/2,H/2,0],direction:[-.52,-.68,.78],extent:255,distance:600,far:1300}),bias:.00048});host.dataset.shadows=shadowMap?'pcf':'unavailable';}
      gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const [name,size,offset]of [['aLocal',3,0],['aNormal',3,3],['aColor',3,6],['aMaterial',3,9],['aUv',2,12]]){const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,56,offset*4);}gl.bufferData(gl.ARRAY_BUFFER,meshData.vertices,gl.STATIC_DRAW);
    }
    try{
      gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,powerPreference:'low-power'});if(!gl)throw Error('WebGL unavailable');
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);canvas.addEventListener('webglcontextlost',contextLost);host.dataset.rodFlexRenderer='webgl';if(!isPainted())prepareMesh();
    }catch(_){fallback();}
    const light=unit([-.52,-.68,.78]),half=unit(add(light,unit([-.22,.14,1])));
    function faceColor(face,angle){const c=Math.cos(angle),s=Math.sin(angle),tx=AXIS[0]*c+NORMAL[0]*s,ty=AXIS[1]*c+NORMAL[1]*s,nx=NORMAL[0]*c-AXIS[0]*s,ny=NORMAL[1]*c-AXIS[1]*s,x=tx*face.normal[0]+nx*face.normal[1],y=ty*face.normal[0]+ny*face.normal[1],z=face.normal[2],lit=.25+Math.max(0,x*light[0]+y*light[1]+z*light[2])*.9+Math.max(0,x*.68+y*.26+z*.68)*.15,spec=Math.pow(Math.max(0,x*half[0]+y*half[1]+z*half[2]),mix(130,20,face.rough))*(.18+face.metal*.82),alpha=transparentPattern(face.pattern)?(face.pattern===19?.35:face.pattern===10?.72:.62):1;if(face.pattern>=30){const tone=x*light[0]+y*light[1]+z*light[2],band=face.pattern===31?1:tone>.5?1:tone>-.05?.82:.61;return 'rgba('+face.color.map(v=>Math.round(clamp(v*band)*255)).join(',')+',1)';}return 'rgba('+face.color.map((v,i)=>{const value=v*lit+mix(1,v,face.metal*.66)*spec*.9+(face.pattern===18?[.44,.2,.028][i]*(.65+.35*Math.max(z,0)):0);return Math.round(clamp(Math.pow(1.16*value/(1+value*.23),.94))*255);}).join(',')+','+alpha+')';}
    function prepareCpuMesh(){
      const data=meshData.vertices,local=[],vertices=new Map(),faces=[],index=offset=>{const key=data[offset]+':'+data[offset+1]+':'+data[offset+2];let n=vertices.get(key);if(n===undefined){n=local.length;vertices.set(key,n);local.push([data[offset],data[offset+1],data[offset+2]]);}return n;},same=(a,b)=>data[a]===data[b]&&data[a+1]===data[b+1]&&data[a+2]===data[b+2];
      for(let i=0;i<data.length;i+=42){let offsets=[i,i+14,i+28];if(i+83<data.length&&same(i,i+42)&&same(i+28,i+56)){offsets.push(i+70);i+=42;}const first=offsets[0],normal=unit([3,4,5].map(k=>offsets.reduce((v,at)=>v+data[at+k],0))),along=offsets.reduce((v,at)=>v+data[at],0)/offsets.length;
        if(normal[2]<-.27)continue;const nx=AXIS[0]*normal[0]+NORMAL[0]*normal[1],ny=AXIS[1]*normal[0]+NORMAL[1]*normal[1];if(along<=.3&&-.22*nx+.14*ny+normal[2]<=0)continue;
        const face={indices:offsets.map(index),normal,color:[data[first+6],data[first+7],data[first+8]],rough:data[first+9],metal:data[first+10],pattern:data[first+11],along,depth:offsets.reduce((v,at)=>v+data[at+2],0)/offsets.length};face.baseColor=faceColor(face,0);faces.push(face);
      }
      faces.sort((a,b)=>a.depth-b.depth);const points=new Float32Array(local.length*2),dynamic=[];for(let i=0;i<local.length;i++){const p=deformed(local[i],0);points[i*2]=p.x;points[i*2+1]=p.y;if(local[i][0]>.3)dynamic.push(i);}cpuMesh={local,points,faces,dynamic};
    }
    function drawCanvas(scale,dpr){
      if(!ctx)return;if(paintedEntry){ctx.setTransform(scale*dpr,0,0,scale*dpr,PAD*scale*dpr,PAD*scale*dpr);ctx.clearRect(-PAD,-PAD,W+2*PAD,H+2*PAD);Painted.draw2D(ctx,paintedEntry,Painted.vertices(paintedEntry,bend,deformed,L,paintedSegments()));return;}if(!cpuMesh)prepareCpuMesh();ctx.setTransform(scale*dpr,0,0,scale*dpr,PAD*scale*dpr,PAD*scale*dpr);ctx.clearRect(-PAD,-PAD,W+2*PAD,H+2*PAD);const basis=new Map(),positions=cpuMesh.points;
      const at=along=>{let value=basis.get(along);if(!value){const p=curvePoint(along,bend),angle=p.angle*Math.PI/180;value={x:p.x,y:p.y,nx:NORMAL[0]*Math.cos(angle)-AXIS[0]*Math.sin(angle),ny:NORMAL[1]*Math.cos(angle)-AXIS[1]*Math.sin(angle),angle};basis.set(along,value);}return value;};
      for(const i of cpuMesh.dynamic){const [s,n,z]=cpuMesh.local[i],p=at(s);positions[i*2]=p.x+p.nx*n+z*.22;positions[i*2+1]=p.y+p.ny*n-z*.14;}
      ctx.lineJoin='round';ctx.lineWidth=.3;for(const face of cpuMesh.faces){const angle=face.along<=.3?0:at(face.along).angle;if(face.along>.3&&face.normal[2]<.27){const c=Math.cos(angle),s=Math.sin(angle),x=(AXIS[0]*c+NORMAL[0]*s)*face.normal[0]+(NORMAL[0]*c-AXIS[0]*s)*face.normal[1],y=(AXIS[1]*c+NORMAL[1]*s)*face.normal[0]+(NORMAL[1]*c-AXIS[1]*s)*face.normal[1];if(-.22*x+.14*y+face.normal[2]<=0)continue;}ctx.beginPath();let first=true;for(const i of face.indices){if(first){ctx.moveTo(positions[i*2],positions[i*2+1]);first=false;}else ctx.lineTo(positions[i*2],positions[i*2+1]);}ctx.closePath();ctx.fillStyle=face.along<=.3?face.baseColor:faceColor(face,angle);ctx.strokeStyle=ctx.fillStyle;ctx.fill();ctx.stroke();}
    }
    function draw(){
      if(destroyed)return;const tip=curvePoint(1,bend);tipMarker.setAttribute('cx',tip.x);tipMarker.setAttribute('cy',tip.y);host.dataset.rodBend=String(bend);
      if(doc.hidden||!host.isConnected||!paintedEntry&&!meshData)return;const width=host.clientWidth||W,height=host.clientHeight||H,scale=Math.min(width/W,height/H),dpr=Math.min(2,Math.max(1,win.devicePixelRatio||1)),key=[profile(rod).id,gl||paintedEntry?bend:Math.round(bend*800)/800,width,height,dpr,shadowsEnabled].join(':');if(key===lastSignature)return;lastSignature=key;
      const area=[W+2*PAD,H+2*PAD],cssWidth=area[0]*scale,cssHeight=area[1]*scale;Object.assign(canvas.style,{left:(width-W*scale)/2-PAD*scale+'px',top:(height-H*scale)/2-PAD*scale+'px',width:cssWidth+'px',height:cssHeight+'px'});if(canvas.width!==Math.ceil(cssWidth*dpr)||canvas.height!==Math.ceil(cssHeight*dpr)){canvas.width=Math.ceil(cssWidth*dpr);canvas.height=Math.ceil(cssHeight*dpr);}
      if(gl){if(gl.isContextLost())return;gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(paintedEntry){if(!paintedGL)paintedGL=Painted.createGL(gl);paintedGL.draw(paintedEntry,Painted.vertices(paintedEntry,bend,deformed,L,paintedSegments()),area,PAD);}else{gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const [name,size,offset]of [['aLocal',3,0],['aNormal',3,3],['aColor',3,6],['aMaterial',3,9],['aUv',2,12]]){const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,56,offset*4);}gl.uniform1f(gl.getUniformLocation(program,'uBend'),bend);gl.uniform2fv(gl.getUniformLocation(program,'uArea'),area);if(shadowMap){shadowMap.begin();gl.drawArrays(gl.TRIANGLES,0,meshData.vertices.length/14);shadowMap.end(canvas.width,canvas.height,shadowsEnabled);}const count=meshData.vertices.length/14,opaque=meshData.opaqueVertices??count;gl.drawArrays(gl.TRIANGLES,0,opaque);if(opaque<count){gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,opaque,count-opaque);gl.depthMask(true);gl.disable(gl.BLEND);}}}else drawCanvas(scale,dpr);
      if(staticSvg)staticSvg.style.visibility='hidden';host.dataset.rodFlex='ready';host.dataset.rodGeometry=paintedEntry?'painted-flex':'mesh3d';host.dataset.rodTriangles=String(paintedEntry?paintedSegments()*2:meshData?.triangles||0);
    }
    function visibility(){if(!doc.hidden){lastSignature='';draw();}}doc.addEventListener('visibilitychange',visibility);if(win.ResizeObserver){observer=new win.ResizeObserver(()=>{lastSignature='';draw();});observer.observe(host);}
    const api={get kind(){return gl?'webgl':'canvas2d';},update(next={}){if(destroyed)return;if(next.shadows!==undefined)shadowsEnabled=next.shadows!==false;if(next.rod&&profile(next.rod).id!==profile(rod).id){rod=next.rod;Painted=paintedFor(rod);meshData=null;cpuMesh=null;selectPainted(rod);if(!isPainted())prepareMesh();lastSignature='';}if(next.bend!==undefined)bend=clamp(next.bend,-.24,.24);draw();},whenReady(){return paintedPromise;},getTip(){return{...curvePoint(1,bend)};},getGeometry(){return{width:W,height:H,length:L,bend,grip:{...GRIP},baseTip:{...TIP},tip:curvePoint(1,bend),normal:{x:NORMAL[0],y:NORMAL[1]},triangles:paintedEntry?paintedSegments()*2:meshData?.triangles||0,rodId:profile(rod).id};},destroy(){if(destroyed)return;destroyed=true;observer?.disconnect();doc.removeEventListener('visibilitychange',visibility);releaseGL();canvas.remove();markers.remove();if(staticSvg&&host.contains(staticSvg))staticSvg.style.visibility=previousVisibility;for(const key of ['rodFlex','rodFlexRenderer','rodGeometry','rodTriangles','rodBend','shadows'])delete host.dataset[key];meshData=cpuMesh=null;}};selectPainted(rod);api.update(initial);return api;
  }
  // Live scenes need an identity/geometry anchor, not the catalogue atlas.
  // The renderer supplies the entire rod in both WebGL and Canvas fallback.
  function liveMarkup(rod){const id=String(rod?.id||'bamboo').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return '<svg class="fishing-rod-art" data-rod-id="'+id+'" viewBox="0 0 250.8 418" aria-hidden="true"></svg>';}
  return Object.freeze({create,profile,curvePoint,deformed,buildMesh,liveMarkup});
});
