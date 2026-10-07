(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingRodRenderer=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
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
    katana:['#d5e6f0','#182e3b','#182637','#aebdcd','#f0be60',6]
  };
  function profile(rod){const id=typeof rod==='string'?rod:rod?.id||'bamboo',p=PALETTES[id]||PALETTES.bamboo;return{id:PALETTES[id]?id:'bamboo',shaft:rgb(p[0]),grip:rgb(p[1]),wrap:rgb(p[2]),metal:rgb(p[3]),trim:rgb(p[4]),pattern:p[5],advanced:Object.keys(PALETTES).indexOf(id)>=5};}
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
  function buildMesh(rod,lowDetail=false){
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
    void main(){
      if(uShadowPass>.5){gl_FragColor=fishingDepth(gl_FragCoord.z);return;}
      vec3 n=normalize(vNormal),view=normalize(vec3(-.22,.14,1.)),light=normalize(vec3(-.52,-.68,.78));float rough=vMaterial.x,metal=vMaterial.y,pattern=vMaterial.z,texture=1.;
      if(pattern>.5&&pattern<1.5)texture=.95+.045*sin(vUv.x*.08+sin(vUv.y*7.)*.3)+.02*sin(vUv.y*29.+vUv.x*.04);
      else if(pattern>1.5&&pattern<2.5)texture=.86+.13*hash(floor(vec2(vUv.x*1.1,vUv.y*12.)))+.035*sin(vUv.x*1.7);
      else if(pattern>2.5&&pattern<3.5)texture=.9+.08*sin(vUv.x*1.8+vUv.y*8.)*sin(vUv.x*1.8-vUv.y*8.);
      else if(pattern>3.5&&pattern<4.5)texture=.91+.075*cos(vUv.x*4.+vUv.y*2.);
      else if(pattern>4.5&&pattern<5.5)texture=.94+.06*sin(vUv.x*.07+sin(vUv.y*4.))+.025*sin(vUv.y*17.+vUv.x*.11);
      else if(pattern>5.5)texture=.975+.025*sin(vUv.x*6.+vUv.y*4.);
      float diffuse=max(dot(n,light),0.),sky=max(n.z,0.),occlusion=.76+.24*sky;vec3 base=vColor*texture;
      vec3 fill=normalize(vec3(.65,.25,.6));float bounce=max(dot(n,fill),0.);
      vec3 color=base*(vec3(.2,.23,.28)*occlusion+vec3(1.1,1.02,.88)*diffuse*.86+vec3(.12,.19,.24)*bounce);
      float spec=pow(max(dot(n,normalize(light+view)),0.),mix(130.,20.,rough))*(.18+metal*.82),fresnel=pow(1.-max(dot(n,view),0.),3.);
      color+=mix(vec3(.95,.98,1.),base,metal*.66)*spec*.9; color+=mix(vec3(.44,.64,.85),base,.55)*fresnel*(.06+metal*.2);
      color*=mix(.48,1.,fishingVisibility(vPosition,n,light));
      color=1.16*color/(vec3(1.)+color*.23);color=pow(max(color,vec3(0.)),vec3(.94));gl_FragColor=vec4(clamp(color,0.,1.),1.);
    }`;
  function create(host,initial={}){
    if(!host?.ownerDocument)throw new Error('A live rod host is required.');
    const doc=host.ownerDocument,win=doc.defaultView||globalThis,ns='http://www.w3.org/2000/svg',staticSvg=host.querySelector('.fishing-rod-art'),previousVisibility=staticSvg?.style.visibility;
    let rod=initial.rod||{id:staticSvg?.dataset.rodId||'bamboo'},bend=0,destroyed=false,gl=null,ctx=null,program=null,buffer=null,meshData=null,cpuMesh=null,observer=null,lastSignature='',canvas,shadowMap=null,shadowsEnabled=initial.shadows!==false;
    function makeCanvas(){const node=doc.createElement('canvas');node.className='fishing-rod-flex-canvas fishing-rod-3d-canvas';node.setAttribute('aria-hidden','true');Object.assign(node.style,{position:'absolute',display:'block',pointerEvents:'none',imageRendering:'auto'});host.appendChild(node);return node;}canvas=makeCanvas();
    const markers=doc.createElementNS(ns,'svg');markers.classList.add('fishing-rod-flex-markers');markers.setAttribute('viewBox','0 0 '+W+' '+H);markers.setAttribute('aria-hidden','true');Object.assign(markers.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',overflow:'visible',pointerEvents:'none'});
    const tipMarker=doc.createElementNS(ns,'circle'),gripMarker=doc.createElementNS(ns,'circle');for(const [node,kind]of [[tipMarker,'tip'],[gripMarker,'grip']]){node.classList.add('fishing-rod-flex-'+kind);node.setAttribute('r','.015');node.setAttribute('opacity','0');markers.appendChild(node);}gripMarker.setAttribute('cx',GRIP.x);gripMarker.setAttribute('cy',GRIP.y);host.appendChild(markers);
    function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(error);}return shader;}
    function releaseGL(lose=true){if(!gl)return;canvas.removeEventListener('webglcontextlost',contextLost);shadowMap?.destroy();shadowMap=null;if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);if(lose)gl.getExtension('WEBGL_lose_context')?.loseContext();gl=null;buffer=program=null;}
    function contextLost(event){event.preventDefault();if(!destroyed)fallback();}
    function fallback(){releaseGL();canvas.remove();canvas=makeCanvas();ctx=canvas.getContext('2d',{alpha:true});meshData=buildMesh(rod,true);cpuMesh=null;lastSignature='';host.dataset.rodFlexRenderer='canvas2d';}
    try{
      gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,powerPreference:'low-power'});if(!gl)throw Error('WebGL unavailable');const vertex=compile(gl.VERTEX_SHADER,VERTEX),fragment=compile(gl.FRAGMENT_SHADER,FRAGMENT);program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const [name,size,offset]of [['aLocal',3,0],['aNormal',3,3],['aColor',3,6],['aMaterial',3,9],['aUv',2,12]]){const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,56,offset*4);}gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);canvas.addEventListener('webglcontextlost',contextLost);host.dataset.rodFlexRenderer='webgl';meshData=buildMesh(rod);gl.bufferData(gl.ARRAY_BUFFER,meshData.vertices,gl.STATIC_DRAW);shadowMap=Lighting?.createShadowMap(gl,program,{size:1024,matrix:Lighting.lightView({center:[W/2,H/2,0],direction:[-.52,-.68,.78],extent:255,distance:600,far:1300}),bias:.00048});host.dataset.shadows=shadowMap?'pcf':'unavailable';
    }catch(_){fallback();}
    const light=unit([-.52,-.68,.78]),half=unit(add(light,unit([-.22,.14,1])));
    function faceColor(face,angle){const c=Math.cos(angle),s=Math.sin(angle),tx=AXIS[0]*c+NORMAL[0]*s,ty=AXIS[1]*c+NORMAL[1]*s,nx=NORMAL[0]*c-AXIS[0]*s,ny=NORMAL[1]*c-AXIS[1]*s,x=tx*face.normal[0]+nx*face.normal[1],y=ty*face.normal[0]+ny*face.normal[1],z=face.normal[2],lit=.25+Math.max(0,x*light[0]+y*light[1]+z*light[2])*.9+Math.max(0,x*.68+y*.26+z*.68)*.15,spec=Math.pow(Math.max(0,x*half[0]+y*half[1]+z*half[2]),mix(130,20,face.rough))*(.18+face.metal*.82);return 'rgb('+face.color.map(v=>{const value=v*lit+mix(1,v,face.metal*.66)*spec*.9;return Math.round(clamp(Math.pow(1.16*value/(1+value*.23),.94))*255);}).join(',')+')';}
    function prepareCpuMesh(){
      const data=meshData.vertices,local=[],vertices=new Map(),faces=[],index=offset=>{const key=data[offset]+':'+data[offset+1]+':'+data[offset+2];let n=vertices.get(key);if(n===undefined){n=local.length;vertices.set(key,n);local.push([data[offset],data[offset+1],data[offset+2]]);}return n;},same=(a,b)=>data[a]===data[b]&&data[a+1]===data[b+1]&&data[a+2]===data[b+2];
      for(let i=0;i<data.length;i+=42){let offsets=[i,i+14,i+28];if(i+83<data.length&&same(i,i+42)&&same(i+28,i+56)){offsets.push(i+70);i+=42;}const first=offsets[0],normal=unit([3,4,5].map(k=>offsets.reduce((v,at)=>v+data[at+k],0))),along=offsets.reduce((v,at)=>v+data[at],0)/offsets.length;
        if(normal[2]<-.27)continue;const nx=AXIS[0]*normal[0]+NORMAL[0]*normal[1],ny=AXIS[1]*normal[0]+NORMAL[1]*normal[1];if(along<=.3&&-.22*nx+.14*ny+normal[2]<=0)continue;
        const face={indices:offsets.map(index),normal,color:[data[first+6],data[first+7],data[first+8]],rough:data[first+9],metal:data[first+10],along,depth:offsets.reduce((v,at)=>v+data[at+2],0)/offsets.length};face.baseColor=faceColor(face,0);faces.push(face);
      }
      faces.sort((a,b)=>a.depth-b.depth);const points=new Float32Array(local.length*2),dynamic=[];for(let i=0;i<local.length;i++){const p=deformed(local[i],0);points[i*2]=p.x;points[i*2+1]=p.y;if(local[i][0]>.3)dynamic.push(i);}cpuMesh={local,points,faces,dynamic};
    }
    function drawCanvas(scale,dpr){
      if(!ctx)return;if(!cpuMesh)prepareCpuMesh();ctx.setTransform(scale*dpr,0,0,scale*dpr,PAD*scale*dpr,PAD*scale*dpr);ctx.clearRect(-PAD,-PAD,W+2*PAD,H+2*PAD);const basis=new Map(),positions=cpuMesh.points;
      const at=along=>{let value=basis.get(along);if(!value){const p=curvePoint(along,bend),angle=p.angle*Math.PI/180;value={x:p.x,y:p.y,nx:NORMAL[0]*Math.cos(angle)-AXIS[0]*Math.sin(angle),ny:NORMAL[1]*Math.cos(angle)-AXIS[1]*Math.sin(angle),angle};basis.set(along,value);}return value;};
      for(const i of cpuMesh.dynamic){const [s,n,z]=cpuMesh.local[i],p=at(s);positions[i*2]=p.x+p.nx*n+z*.22;positions[i*2+1]=p.y+p.ny*n-z*.14;}
      ctx.lineJoin='round';ctx.lineWidth=.3;for(const face of cpuMesh.faces){const angle=face.along<=.3?0:at(face.along).angle;if(face.along>.3&&face.normal[2]<.27){const c=Math.cos(angle),s=Math.sin(angle),x=(AXIS[0]*c+NORMAL[0]*s)*face.normal[0]+(NORMAL[0]*c-AXIS[0]*s)*face.normal[1],y=(AXIS[1]*c+NORMAL[1]*s)*face.normal[0]+(NORMAL[1]*c-AXIS[1]*s)*face.normal[1];if(-.22*x+.14*y+face.normal[2]<=0)continue;}ctx.beginPath();let first=true;for(const i of face.indices){if(first){ctx.moveTo(positions[i*2],positions[i*2+1]);first=false;}else ctx.lineTo(positions[i*2],positions[i*2+1]);}ctx.closePath();ctx.fillStyle=face.along<=.3?face.baseColor:faceColor(face,angle);ctx.strokeStyle=ctx.fillStyle;ctx.fill();ctx.stroke();}
    }
    function draw(){
      if(destroyed)return;const tip=curvePoint(1,bend);tipMarker.setAttribute('cx',tip.x);tipMarker.setAttribute('cy',tip.y);host.dataset.rodBend=String(bend);
      if(doc.hidden||!host.isConnected)return;const width=host.clientWidth||W,height=host.clientHeight||H,scale=Math.min(width/W,height/H),dpr=Math.min(2,Math.max(1,win.devicePixelRatio||1)),key=[profile(rod).id,gl?bend:Math.round(bend*800)/800,width,height,dpr,shadowsEnabled].join(':');if(key===lastSignature)return;lastSignature=key;
      const area=[W+2*PAD,H+2*PAD],cssWidth=area[0]*scale,cssHeight=area[1]*scale;Object.assign(canvas.style,{left:(width-W*scale)/2-PAD*scale+'px',top:(height-H*scale)/2-PAD*scale+'px',width:cssWidth+'px',height:cssHeight+'px'});if(canvas.width!==Math.ceil(cssWidth*dpr)||canvas.height!==Math.ceil(cssHeight*dpr)){canvas.width=Math.ceil(cssWidth*dpr);canvas.height=Math.ceil(cssHeight*dpr);}
      if(gl){if(gl.isContextLost())return;gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniform1f(gl.getUniformLocation(program,'uBend'),bend);gl.uniform2fv(gl.getUniformLocation(program,'uArea'),area);if(shadowMap){shadowMap.begin();gl.drawArrays(gl.TRIANGLES,0,meshData.vertices.length/14);shadowMap.end(canvas.width,canvas.height,shadowsEnabled);}gl.drawArrays(gl.TRIANGLES,0,meshData.vertices.length/14);}else drawCanvas(scale,dpr);
      if(staticSvg)staticSvg.style.visibility='hidden';host.dataset.rodFlex='ready';host.dataset.rodGeometry='mesh3d';host.dataset.rodTriangles=String(meshData.triangles);
    }
    function visibility(){if(!doc.hidden){lastSignature='';draw();}}doc.addEventListener('visibilitychange',visibility);if(win.ResizeObserver){observer=new win.ResizeObserver(()=>{lastSignature='';draw();});observer.observe(host);}
    const api={get kind(){return gl?'webgl':'canvas2d';},update(next={}){if(destroyed)return;if(next.shadows!==undefined)shadowsEnabled=next.shadows!==false;if(next.rod&&profile(next.rod).id!==profile(rod).id){rod=next.rod;meshData=buildMesh(rod,!gl);cpuMesh=null;if(gl){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,meshData.vertices,gl.STATIC_DRAW);}lastSignature='';}if(next.bend!==undefined)bend=clamp(next.bend,-.24,.24);draw();},getTip(){return{...curvePoint(1,bend)};},getGeometry(){return{width:W,height:H,length:L,bend,grip:{...GRIP},baseTip:{...TIP},tip:curvePoint(1,bend),normal:{x:NORMAL[0],y:NORMAL[1]},triangles:meshData.triangles,rodId:profile(rod).id};},destroy(){if(destroyed)return;destroyed=true;observer?.disconnect();doc.removeEventListener('visibilitychange',visibility);releaseGL();canvas.remove();markers.remove();if(staticSvg&&host.contains(staticSvg))staticSvg.style.visibility=previousVisibility;for(const key of ['rodFlex','rodFlexRenderer','rodGeometry','rodTriangles','rodBend','shadows'])delete host.dataset[key];meshData=cpuMesh=null;}};api.update(initial);return api;
  }
  return Object.freeze({create,profile,curvePoint,deformed,buildMesh});
});
