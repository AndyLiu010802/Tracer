(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingArt=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TAU=Math.PI*2;
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const color=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{3,8}$/i.test(value)?value:fallback;
  function hash(s){let h=2166136261;for(const c of String(s||'')){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
  function identity(item){return typeof item==='string'?item:String(item&&item.id||'');}
  function name(item){return item&&Array.isArray(item.name)?item.name[0]:item&&item.name||identity(item);}
  const ROD_SPRITES=['bamboo','willow','carbon','copper','rosewood','tide','clockwork','frost','jade','moon','phoenix','cloud','astral','dragon','lotus','guandao','katana','golden','walnut','porcelain','citrus','amber','vinyl','nautilus','alpine','candlewyrm','thunderdrum','abysswhale','foxfire','lilybell','sandscript','frostwolf','rosevow','inkjudge','butterfly','sunforge','leviathan','eclipse'];
  let artSerial=0;
  function atlasMarkup(className,filename,bounds,atlasWidth,atlasHeight,width,height,title,attributes){
    const [left,top,right,bottom]=bounds,w=right-left,h=bottom-top,scale=Math.min(width/w,height/h)*.96,dx=(width-w*scale)/2,dy=(height-h*scale)/2,clip='fishing-art-clip-'+(++artSerial);
    const revision=filename.includes('-model-')?'?layout='+atlasWidth+'x'+atlasHeight:'';
    return '<svg class="'+className+'" viewBox="0 0 '+width+' '+height+'" style="overflow:hidden;image-rendering:auto" aria-hidden="true" '+(attributes||'')+'><defs><clipPath id="'+clip+'" clipPathUnits="userSpaceOnUse"><rect width="'+w+'" height="'+h+'"/></clipPath></defs><g transform="translate('+dx+' '+dy+') scale('+scale+')"><g clip-path="url(#'+clip+')"><image href="/fishing-art/'+filename+revision+'" x="'+(-left)+'" y="'+(-top)+'" width="'+atlasWidth+'" height="'+atlasHeight+'"/></g></g><title>'+esc(title)+'</title></svg>';
  }
  function rodMarkup(item){
    const rod=typeof item==='object'&&item||{id:item},index=Math.max(0,ROD_SPRITES.indexOf(identity(rod)));
    const preview=atlasMarkup('fishing-rod-art','rods-model-v1.png',modelBounds(index,300,500),1500,Math.ceil(ROD_SPRITES.length/5)*500,250.8,418,name(rod),'data-rod-id="'+esc(identity(rod))+'" data-rod-tier="'+esc(rod.rarity||'common')+'"');
    const motion=typeof module==='object'&&module.exports?require('./fishing-motion'):globalThis.TracerFishingMotion;
    return preview.replace('</svg>',(motion?.catalogEffectsMarkup?.(rod)||'')+'</svg>');
  }
  function fishShape(fish){const key=String(fish&&fish.body||fish&&fish.shape||identity(fish));return /seahorse/i.test(key)?'seahorse':/whale/i.test(key)?'whale':/catfish/i.test(key)?'catfish':/angler/i.test(key)?'angler':/dragon/i.test(key)?'dragon':/fancy|butterfly/i.test(key)?'fancy':/koi/i.test(key)?'koi':/ray|skate|é³/i.test(key)?'ray':/eel|slender|loach|é³—|æ³¥é³…/i.test(key)?'long':/round|puffer|ball|æ²³è±š/i.test(key)?'round':/angel|sun|ç¥žä»™|å¤ªé˜³/i.test(key)?'tall':'classic';}
  const FISH_SPRITES=['minnow','crucian','carp','perch','trout','sardine','mackerel','catfish','koi','goldfish','seahorse','angelfish','lantern','lotusfin','moonfin','crystal','phoenixfish','dreamray','dragonkoi','galaxywhale','gulpuffer','grumpangler','flopray','snagglefin'];
  // Catalogue portraits are baked from the live meshes by
  // dev/build-fishing-catalog-art.cjs, including their materials and lighting.
  function modelBounds(index,width,height){const x=index%5*width,y=Math.floor(index/5)*height;return[x,y,x+width,y+height];}
  function fishMarkup(item){
    const fish=typeof item==='object'&&item||{id:item},key=fish.fishId||fish.speciesId||identity(fish),index=Math.max(0,FISH_SPRITES.indexOf(key));
    return atlasMarkup('fishing-fish-art','fish-model-v1.png',modelBounds(index,328,216),1640,Math.ceil(FISH_SPRITES.length/5)*216,164,108,name(fish),'data-species="'+esc(key)+'"');
  }
  const BAIT_SPRITES=['worm','grain','shrimp','glow','frost','spirit','stardust'];
  const BAIT_BOUNDS=[[48,152,368,447],[418,130,767,447],[805,81,1138,439],[1213,158,1490,455],[50,643,356,910],[463,576,734,903],[802,609,1142,923]];
  function baitMarkup(item){
    const bait=typeof item==='object'&&item||{id:item},index=Math.max(0,BAIT_SPRITES.indexOf(identity(bait)));
    return atlasMarkup('fishing-bait-art','baits-v1.png',BAIT_BOUNDS[index],1536,1024,112,112,name(bait),'data-bait-art="'+esc(identity(bait))+'"');
  }
  const FLEX_WIDTH=250.8,FLEX_HEIGHT=418;
  const FLEX_GRIP={x:FLEX_WIDTH*.11,y:FLEX_HEIGHT*.94},FLEX_TIP={x:FLEX_WIDTH*.9,y:FLEX_HEIGHT*.04};
  const FLEX_LENGTH=Math.hypot(FLEX_TIP.x-FLEX_GRIP.x,FLEX_TIP.y-FLEX_GRIP.y),FLEX_AXIS=[(FLEX_TIP.x-FLEX_GRIP.x)/FLEX_LENGTH,(FLEX_TIP.y-FLEX_GRIP.y)/FLEX_LENGTH],FLEX_NORMAL=[-FLEX_AXIS[1],FLEX_AXIS[0]];
  function rodFlexPoint(along,bend){
    const s=Math.max(0,Math.min(1,Number(along)||0)),ratio=Math.max(-.24,Math.min(.24,Number(bend)||0));
    const shared=typeof globalThis!=='undefined'&&globalThis.TracerFishingMotion?.rodCurvePoint;
    if(shared)return shared(s,ratio);
    const q=Math.max(0,Math.min(1,(s-.3)/.7)),d=ratio*FLEX_LENGTH,flexLength=FLEX_LENGTH*.7,lateral=d*q*q*(3-q)/2,shortening=d*d/(2*flexLength)*(3*q**3-2.25*q**4+.45*q**5),axial=s*FLEX_LENGTH-shortening,slope=d/flexLength*(3*q-1.5*q*q);
    return{x:FLEX_GRIP.x+FLEX_AXIS[0]*axial+FLEX_NORMAL[0]*lateral,y:FLEX_GRIP.y+FLEX_AXIS[1]*axial+FLEX_NORMAL[1]*lateral,angle:Math.atan2(slope,1-.5*slope*slope)*180/Math.PI};
  }
  // Compatibility entry point: live rods and catalogue portraits share one model.
  // Resolve lazily because the browser loads this module before the rod renderer.
  function createRodFlex(host,initial={}){
    if(!host?.ownerDocument)throw new Error('A live rod host is required.');
    if(!host.querySelector('.fishing-rod-art')){
      const wrapper=host.ownerDocument.createElement('div');wrapper.innerHTML=rodMarkup(initial.rod||{id:'bamboo'});host.appendChild(wrapper.firstElementChild);
    }
    const renderer=typeof module==='object'&&module.exports?require('./fishing-rod-renderer'):globalThis.TracerFishingRodRenderer;
    return renderer?.create?renderer.create(host,initial):null;
  }
  function rgb(hex){let v=color(hex,'#8fbebb').slice(1);if(v.length===3)v=v.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16)/255);}
  function matMul(a,b){const out=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];return out;}
  function model(x,y,z,sx,sy,sz,yaw){const c=Math.cos(yaw||0),s=Math.sin(yaw||0);return new Float32Array([c*sx,0,-s*sx,0,0,sy,0,0,s*sz,0,c*sz,0,x,y,z,1]);}
  function tilt(pitch,roll){const c=Math.cos(pitch||0),s=Math.sin(pitch||0),a=Math.cos(roll||0),b=Math.sin(roll||0),x=new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]),z=new Float32Array([a,b,0,0,-b,a,0,0,0,0,1,0,0,0,0,1]);return matMul(x,z);}
  function viewProjection(aspect,yaw,zoom,figure){const distance=(zoom||1)*.94,eye=figure?[Math.sin(yaw)*2.3,.66,Math.cos(yaw)*2.3]:[Math.sin(yaw)*6.8*distance,7.8*distance,Math.cos(yaw)*6.8*distance],target=figure?[0,0,0]:[0,.09,0],norm=v=>{const l=Math.hypot(...v);return v.map(n=>n/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x),dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0),v=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]),f=1/Math.tan(.62/2),near=.1,far=30,p=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);return matMul(p,v);}
  const AQUARIUM_EYE=[4,2.8,12.5],AQUARIUM_DECOR=['water_grass','pebble_garden','pearl_shell','jade_arch','moon_crystal','sunken_chest','glass_observatory','jade_koi_seal','sunken_astrolabe','coral_conch','porcelain_pagoda','ribbon_jellyfish'];
  function normalizeAquariumYaw(value){return Number.isFinite(value)?((value%360)+540)%360-180:0;}
  function aquariumTurnAt(from,to,progress){const t=Math.max(0,Math.min(1,progress));return normalizeAquariumYaw(from+normalizeAquariumYaw(to-from)*t*t*(3-2*t));}
  // A product-style orthographic camera keeps the same physical composition in
  // the tiny desktop window and in the full collection view.
  function aquariumCamera(aspect,angle=0){const yaw=normalizeAquariumYaw(angle)*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw),eye=[AQUARIUM_EYE[0]*c+AQUARIUM_EYE[2]*s,AQUARIUM_EYE[1],AQUARIUM_EYE[2]*c-AQUARIUM_EYE[0]*s],target=[0,-.07,0],norm=v=>{const l=Math.hypot(...v);return v.map(n=>n/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0),z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x),v=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]),width=Math.max(6.25,4.81*aspect),height=width/aspect,near=.1,far=30,p=new Float32Array([2/width,0,0,0,0,2/height,0,0,0,0,-2/(far-near),0,0,0,-(far+near)/(far-near),1]);return{eye,direction:z,view:matMul(p,v)};}
  function geometry(){const p=[],n=[];return{p,n,tri(a,b,c,na,nb,nc){const u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...cross)||1,normal=cross.map(q=>q/l);p.push(...a,...b,...c);n.push(...(na||normal),...(nb||normal),...(nc||normal));}};}
  function boxMesh(){const g=geometry(),v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];for(const q of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[1,2,6,5],[0,4,7,3]]){g.tri(v[q[0]],v[q[1]],v[q[2]]);g.tri(v[q[0]],v[q[2]],v[q[3]]);}return g;}
  function sphereMesh(rows,columns){const g=geometry(),lat=rows||16,lon=columns||24,point=(a,b)=>[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){const a=point(i*Math.PI/lat,j*TAU/lon),b=point((i+1)*Math.PI/lat,j*TAU/lon),c=point((i+1)*Math.PI/lat,(j+1)*TAU/lon),d=point(i*Math.PI/lat,(j+1)*TAU/lon);g.tri(a,b,c,a,b,c);g.tri(a,c,d,a,c,d);}return g;}
  function curvedFinMesh(){const g=geometry(),point=(u,v)=>[-.94*u,v*(.055+.56*u),Math.sin(u*Math.PI)*.09*(1-v*v)],normal=(u,v)=>{const h=.001,p=point(u,v),a=point(u+h,v).map((q,i)=>q-p[i]),b=point(u,v+h).map((q,i)=>q-p[i]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],l=Math.hypot(...n);return n.map(q=>q/l);};for(let i=0;i<9;i++)for(let j=0;j<10;j++){const u=i/9,v=-1+j/5,uv=[[u,v],[u+1/9,v],[u+1/9,v+.2],[u,v+.2]],p=uv.map(q=>point(...q)),n=uv.map(q=>normal(...q));g.tri(p[0],p[1],p[2],n[0],n[1],n[2]);g.tri(p[0],p[2],p[3],n[0],n[2],n[3]);}return g;}
  function cylinderMesh(){const g=geometry(),count=20;for(let i=0;i<count;i++){const a=i*TAU/count,b=(i+1)*TAU/count,p=[Math.cos(a),-1,Math.sin(a)],q=[Math.cos(b),-1,Math.sin(b)],r=[q[0]*.86,1,q[2]*.86],s=[p[0]*.86,1,p[2]*.86],na=[Math.cos(a),.07,Math.sin(a)],nb=[Math.cos(b),.07,Math.sin(b)];g.tri(p,q,r,na,nb,nb);g.tri(p,r,s,na,nb,na);g.tri([0,-1,0],q,p,[0,-1,0],[0,-1,0],[0,-1,0]);g.tri([0,1,0],s,r,[0,1,0],[0,1,0],[0,1,0]);}return g;}
  function roundedBoxMesh(){const g=geometry(),steps=5,point=(face,u,v)=>{const p=face===0?[1,u,v]:face===1?[-1,u,-v]:face===2?[u,1,-v]:face===3?[u,-1,v]:face===4?[u,v,1]:[-u,v,-1],core=p.map(q=>Math.max(-.82,Math.min(.82,q))),n=p.map((q,i)=>q-core[i]),length=Math.hypot(...n)||1;return{p:core.map((q,i)=>q+n[i]/length*.18),n:n.map(q=>q/length)};};for(let face=0;face<6;face++)for(let i=0;i<steps;i++)for(let j=0;j<steps;j++){const u=-1+2*i/steps,v=-1+2*j/steps,a=point(face,u,v),b=point(face,u+2/steps,v),c=point(face,u+2/steps,v+2/steps),d=point(face,u,v+2/steps);g.tri(a.p,b.p,c.p,a.n,b.n,c.n);g.tri(a.p,c.p,d.p,a.n,c.n,d.n);}return g;}
  function aquariumPanelMesh(){const g=geometry();g.tri([-1,-1,0],[1,-1,0],[1,1,0],[0,0,1],[0,0,1],[0,0,1]);g.tri([-1,-1,0],[1,1,0],[-1,1,0],[0,0,1],[0,0,1],[0,0,1]);g.uv=[0,0,1,0,1,1,0,0,1,1,0,1];return g;}
  function aquariumWaterMesh(){const g=geometry(),point=(u,v)=>{const x=u*2-1,z=v*2-1,edge=Math.max(Math.abs(x),Math.abs(z));return[x,.014*Math.exp(-(1-edge)*95),z];};for(let i=0;i<64;i++)for(let j=0;j<36;j++){const a=point(i/64,j/36),b=point((i+1)/64,j/36),c=point((i+1)/64,(j+1)/36),d=point(i/64,(j+1)/36);g.tri(a,c,b);g.tri(a,d,c);}return g;}
  function aquariumSandHeight(x,z){return-1.12+.16*((1.26-z)/2.52)+.06*Math.exp(-((x+1.52)**2/.36+(z+.36)**2/.3))+.022*Math.sin(x*2.1+z)*Math.sin(z*2.4);}
  function aquariumSandMesh(){const g=geometry(),point=(u,v)=>{const x=(u*2-1)*2.24,z=(v*2-1)*1.26;return[x,aquariumSandHeight(x,z),z];};for(let i=0;i<40;i++)for(let j=0;j<16;j++){const a=point(i/40,j/16),b=point((i+1)/40,j/16),c=point((i+1)/40,(j+1)/16),d=point(i/40,(j+1)/16);g.tri(a,c,b);g.tri(a,d,c);}
    // Close the graded bed down to its tray: an open surface left a visible
    // air gap and let light leak under the deeper back corners.
    const edge=(a,b)=>{const c=[b[0],-1.214,b[2]],d=[a[0],-1.214,a[2]];g.tri(a,c,b);g.tri(a,d,c);};
    for(let i=0;i<40;i++){edge(point(i/40,1),point((i+1)/40,1));edge(point((i+1)/40,0),point(i/40,0));}
    for(let j=0;j<16;j++){edge(point(1,(j+1)/16),point(1,j/16));edge(point(0,j/16),point(0,(j+1)/16));}return g;}
  function aquariumArchMesh(){const g=geometry(),count=44;for(let i=0;i<count;i++){const a=i*Math.PI/count,b=(i+1)*Math.PI/count,points=[];for(const z of[-.12,.12])for(const r of[.44,.59])points.push([[Math.cos(a)*r,.49+Math.sin(a)*r,z],[Math.cos(b)*r,.49+Math.sin(b)*r,z]]);for(const ids of[[0,1],[1,3],[3,2],[2,0]]){const p=points[ids[0]],q=points[ids[1]];g.tri(p[0],p[1],q[1]);g.tri(p[0],q[1],q[0]);}}appendMesh(g,boxMesh(),model(-.515,.245,0,.075,.245,.12));appendMesh(g,boxMesh(),model(.515,.245,0,.075,.245,.12));return g;}
  function aquariumShellMesh(){return fishSurface((u,v)=>{const a=(v-.5)*2.65,r=.055+u*.51,rib=.017*Math.pow(.5+.5*Math.cos(v*TAU*11),3)*Math.sin(u*Math.PI);return[Math.sin(a)*r,-.02+Math.sin(u*Math.PI)*.16+rib,Math.cos(a)*r-.24];},18,54);}
  function organicMesh(){const g=geometry(),rows=12,columns=20,point=(a,b)=>{const s=Math.sin(a),r=1+.09*Math.sin(3*b+.7)*s*s+.055*Math.cos(5*b-2*a)*s+.045*Math.sin(a*4+b*7);return[s*Math.cos(b)*r,Math.cos(a)*(1+.055*Math.sin(4*b)*s),s*Math.sin(b)*r];},normal=(a,b)=>{if(Math.abs(Math.sin(a))<.00001)return[0,a<Math.PI/2?1:-1,0];const h=.001,p=point(a,b),u=point(a+h,b).map((q,i)=>q-p[i]),v=point(a,b+h).map((q,i)=>q-p[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;return n.map(q=>-q/l);};for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){const a=i*Math.PI/rows,b=j*TAU/columns,p=[[a,b],[a+Math.PI/rows,b],[a+Math.PI/rows,b+TAU/columns],[a,b+TAU/columns]].map(q=>({p:point(...q),n:normal(...q)}));g.tri(p[0].p,p[1].p,p[2].p,p[0].n,p[1].n,p[2].n);g.tri(p[0].p,p[2].p,p[3].p,p[0].n,p[2].n,p[3].n);}return g;}
  function leafMesh(){const g=geometry(),rows=5,columns=6,point=(t,a)=>{const w=Math.sin(t*Math.PI);return[Math.cos(a)*w*.35,t-.5,Math.sin(a)*w*.055+Math.sin(t*Math.PI)*.12];};for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){const t=i/rows,a=j*TAU/columns,p=[point(t,a),point(t+1/rows,a),point(t+1/rows,a+TAU/columns),point(t,a+TAU/columns)];g.tri(p[0],p[1],p[2]);g.tri(p[0],p[2],p[3]);}return g;}
  function appendMesh(target,source,matrix){for(let i=0;i<source.p.length;i+=3){const p=source.p.slice(i,i+3),n=source.n.slice(i,i+3),s=[Math.hypot(matrix[0],matrix[1],matrix[2]),Math.hypot(matrix[4],matrix[5],matrix[6]),Math.hypot(matrix[8],matrix[9],matrix[10])],normal=Array.from({length:3},(_,r)=>matrix[r]*n[0]/s[0]**2+matrix[4+r]*n[1]/s[1]**2+matrix[8+r]*n[2]/s[2]**2),length=Math.hypot(...normal)||1;target.p.push(...Array.from({length:3},(_,r)=>matrix[r]*p[0]+matrix[4+r]*p[1]+matrix[8+r]*p[2]+matrix[12+r]));target.n.push(...normal.map(q=>q/length));}}
  let foliageGeometry=null,grassGeometry=null;
  function foliageMesh(){
    if(foliageGeometry)return foliageGeometry;
    // A continuous canopy surface, with blended lobes instead of repeated leaf-shaped solids.
    const g=geometry(),rows=28,cols=44;
    const point=(a,b)=>{const t=Math.sin(a),r=1+.045*Math.sin(b*5+a*2)*t*t+.022*Math.sin(b*9-a*5)*t+.010*Math.sin(b*13+a*7)*t;return[Math.cos(b)*t*r,Math.cos(a)*(.91+.035*Math.cos(b*4)*t),Math.sin(b)*t*r];};
    const normal=(a,b)=>{if(Math.abs(Math.sin(a))<.00001)return[0,a<Math.PI/2?1:-1,0];const h=.001,p=point(a,b),u=point(a+h,b).map((v,i)=>v-p[i]),v=point(a,b+h).map((v,i)=>v-p[i]),n=[u[2]*v[1]-u[1]*v[2],u[0]*v[2]-u[2]*v[0],u[1]*v[0]-u[0]*v[1]],l=Math.hypot(...n)||1;return n.map(v=>v/l);};
    for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*Math.PI/rows,b=j*TAU/cols,q=[[a,b],[a+Math.PI/rows,b],[a+Math.PI/rows,b+TAU/cols],[a,b+TAU/cols]].map(v=>({p:point(...v),n:normal(...v)}));g.tri(q[0].p,q[1].p,q[2].p,q[0].n,q[1].n,q[2].n);g.tri(q[0].p,q[2].p,q[3].p,q[0].n,q[2].n,q[3].n);}
    return foliageGeometry=g;
  }
  function grassMesh(){if(grassGeometry)return grassGeometry;const g=geometry(),leaf=leafMesh();for(let i=0;i<17;i++){const a=i*2.4,r=(i%5)*.033,h=.31+(hash('blade'+i)%40)/100;appendMesh(g,leaf,matMul(model(Math.cos(a)*r,h*.42,Math.sin(a)*r,.06,h,.22,a),tilt(.15+(i%4)*.06,(i%3-1)*.18)));}return grassGeometry=g;}
  function discMesh(){const g=geometry();g.tri([-1,0,-1],[1,0,-1],[1,0,1],[0,1,0],[0,1,0],[0,1,0]);g.tri([-1,0,-1],[1,0,1],[-1,0,1],[0,1,0],[0,1,0],[0,1,0]);g.uv=[0,0,1,0,1,1,0,0,1,1,0,1];return g;}
  function basketMesh(){const g=geometry(),profile=[[.17,.02],[.21,.08],[.24,.25],[.235,.34],[.211,.34],[.208,.24],[.18,.08],[0,.055]];for(let j=0;j<profile.length-1;j++)for(let i=0;i<28;i++){const a=i*TAU/28,b=(i+1)*TAU/28,[r,y]=profile[j],[s,z]=profile[j+1],p=[Math.cos(a)*r,y,Math.sin(a)*r],q=[Math.cos(b)*r,y,Math.sin(b)*r],v=[Math.cos(b)*s,z,Math.sin(b)*s],u=[Math.cos(a)*s,z,Math.sin(a)*s];g.tri(p,q,v);g.tri(p,v,u);}return g;}
  function lilyMesh(){const g=geometry();for(let i=0;i<38;i++){const a=.15+i/38*(TAU-.3),b=.15+(i+1)/38*(TAU-.3),p=[Math.cos(a),.024,Math.sin(a)],q=[Math.cos(b),.024,Math.sin(b)];g.tri([0,.005,0],p,q,[0,1,0],[Math.cos(a)*.06,1,Math.sin(a)*.06],[Math.cos(b)*.06,1,Math.sin(b)*.06]);}return g;}
  // UVs follow the fin rays or the length of the body, so their engraved detail
  // stays attached to the animal in both the live view and its catalogue pose.
  function fishSurface(point,rows,columns){const g=geometry();g.uv=[];const sample=(u,v)=>{const p=point(u,v),h=.0002,a=point(Math.min(1,u+h),v).map((q,i)=>q-point(Math.max(0,u-h),v)[i]),b=point(u,Math.min(1,v+h)).map((q,i)=>q-point(u,Math.max(0,v-h))[i]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],l=Math.hypot(...n)||1;return{p,n:n.map(q=>q/l),uv:[u,v]};};for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){const a=sample(i/rows,j/columns),b=sample((i+1)/rows,j/columns),c=sample((i+1)/rows,(j+1)/columns),d=sample(i/rows,(j+1)/columns);g.tri(a.p,b.p,c.p,a.n,b.n,c.n);g.tri(a.p,c.p,d.p,a.n,c.n,d.n);g.uv.push(...a.uv,...b.uv,...c.uv,...a.uv,...c.uv,...d.uv);}return g;}
  function membraneMesh(ray){return fishSurface((u,v)=>{if(ray){const span=Math.pow(Math.max(0,Math.sin(u*Math.PI)),.75);return[.65-u*1.55,.025+Math.pow(v,1.8)*(.24+.15*Math.sin(u*Math.PI)),span*v*1.42];}const w=v*2-1,edge=.70+.47*Math.pow(Math.abs(w),.7),scallop=.022*Math.cos(v*TAU*9)*u*u;return[-u*(edge+scallop),w*(.045+u*.73),Math.sin(u*Math.PI)*.10*(1-w*w)+Math.sin(v*TAU*9)*.011*u];},18,32);}
  function sculptedFinMesh(flowing){return fishSurface((u,v)=>{if(flowing)return[-u*(.95+.40*Math.sin(v*Math.PI))+.07*Math.sin(u*Math.PI),u*(.06+.84*Math.sin(v*Math.PI*.5))-.31*u*u,Math.sin(u*Math.PI)*.14*(1-v)+Math.sin(v*TAU*9)*.009*u];const x=.29-v*1.13,rim=Math.pow(Math.sin(Math.PI*v),.78)*(.57-.24*v),root=-.25*Math.pow(Math.abs(x),1.5);return[x-u*.055,root+u*rim,Math.sin(u*Math.PI)*.065+Math.sin(v*TAU*11)*.006*u];},18,32);}
  function ribbonFinMesh(){return fishSurface((u,v)=>{const width=Math.sin(Math.PI*u)*(.13+.28*(1-u)),bend=.18*Math.sin(u*Math.PI);return[-u*1.3,(v*2-1)*width+bend,Math.sin(u*Math.PI)*.12+Math.sin(v*Math.PI*5)*.008];},22,10);}
  function fishBodyMesh(){return fishSurface((u,v)=>{const a=u*Math.PI,b=-v*TAU,x=Math.cos(a),r=Math.sin(a)*(.78+.27*x+.12*Math.exp(-Math.pow((x-.28)*2.8,2))),belly=Math.sin(b);return[x,belly*r*(belly<0?.91:1)+.035*(1-x*x),Math.cos(b)*r];},30,36);}
  function dragonSpine(t){const nodes=[[.86,.13,0],[.37,.39,0],[-.35,.47,.015],[-.99,.18,.03],[-1.08,-.36,.025],[-.72,-.61,0],[-.29,-.38,-.02]],q=Math.max(0,Math.min(.999999,t))*(nodes.length-1),i=Math.floor(q),f=q-i,p0=nodes[Math.max(0,i-1)],p1=nodes[i],p2=nodes[Math.min(nodes.length-1,i+1)],p3=nodes[Math.min(nodes.length-1,i+2)];return p1.map((n,k)=>.5*((2*n)+(-p0[k]+p2[k])*f+(2*p0[k]-5*n+4*p2[k]-p3[k])*f*f+(-p0[k]+3*n-3*p2[k]+p3[k])*f*f*f));}
  function dragonBodyMesh(){return fishSurface((u,v)=>{const p=dragonSpine(u),a=dragonSpine(Math.max(0,u-.001)),b=dragonSpine(Math.min(1,u+.001)),dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,r=.235*Math.pow(1-u,.72)+.014,theta=-v*TAU;return[p[0]-dy/l*Math.cos(theta)*r,p[1]+dx/l*Math.cos(theta)*r,p[2]+Math.sin(theta)*r*.82];},64,24);}
  const FISH_DIMENSIONS={minnow:[1.08,.28,.22],crucian:[.96,.55,.29],carp:[1.08,.46,.31],perch:[1.06,.43,.30],trout:[1.16,.33,.26],sardine:[1.16,.29,.23],mackerel:[1.19,.31,.25],catfish:[1.10,.33,.38],koi:[1.03,.41,.29],goldfish:[.77,.53,.36],angelfish:[.72,.67,.22],lantern:[.76,.56,.41],lotusfin:[.93,.44,.29],moonfin:[.86,.43,.28],crystal:[1.30,.27,.26],phoenixfish:[.92,.41,.29],dreamray:[.83,.16,.32],galaxywhale:[1.12,.54,.48],gulpuffer:[.76,.66,.59],grumpangler:[.80,.47,.61],flopray:[1,.20,.5],snagglefin:[1,.4,.3]};
  const FISH_PROFILES={
    slender:[[-1,.14,.18,0],[-.77,.26,.35,0],[-.43,.66,.75,.05],[0,.96,1,.025],[.44,.88,.9,0],[.73,.53,.60,-.04],[.94,.22,.28,-.075],[1,0,0,-.065]],
    round:[[-1,.16,.19,0],[-.73,.35,.40,0],[-.36,.81,.81,.06],[.02,1,1,.03],[.42,.87,.93,-.02],[.72,.55,.62,-.06],[.95,.20,.27,-.085],[1,0,0,-.09]],
    carp:[[-1,.17,.20,0],[-.74,.36,.40,0],[-.37,.81,.86,.05],[.02,1,1,.02],[.42,.83,.88,-.03],[.70,.60,.63,-.08],[.95,.25,.29,-.12],[1,0,0,-.12]],
    catfish:[[-1,.18,.18,-.025],[-.76,.28,.34,-.04],[-.4,.66,.66,-.01],[.05,.9,.91,.02],[.48,.91,1,.01],[.77,.68,.91,-.01],[.91,.49,.73,-.02],[.976,.29,.45,-.02],[1,0,0,-.02]],
    angel:[[-1,.13,.15,0],[-.75,.37,.45,0],[-.43,.82,.79,0],[-.04,1,1,0],[.33,.90,.94,0],[.63,.59,.68,-.015],[.88,.25,.30,-.055],[1,0,0,-.06]],
    angler:[[-1,.15,.20,.04],[-.68,.39,.40,.025],[-.35,.83,.78,.015],[.03,1,1,0],[.48,.98,1,-.005],[.78,.83,.84,-.03],[.95,.44,.49,-.06],[1,0,0,-.08]],
    sturgeon:[[-1,.12,.15,.015],[-.73,.32,.36,.02],[-.37,.75,.76,.06],[.04,1,1,.025],[.38,.81,.88,0],[.58,.49,.62,-.03],[.73,.27,.38,-.08],[.95,.12,.12,-.10],[1,0,0,-.10]],
    whale:[[-1,.16,.20,0],[-.79,.30,.34,0],[-.44,.63,.65,.02],[0,.95,.96,.025],[.43,1,1,.035],[.70,.88,.91,0],[.95,.46,.49,-.015],[1,0,0,-.015]],
    ray:[[-1,.1,.15,0],[-.6,.59,.54,0],[0,1,1,0],[.53,.95,.8,-.02],[.86,.61,.40,-.04],[1,0,0,-.04]],
    gulpuffer:[[-1,.15,.18,-.05],[-.82,.43,.50,-.08],[-.50,.94,.94,-.18],[-.10,1.06,1.02,-.20],[.30,.92,1,-.13],[.63,.72,.88,-.07],[.83,.54,.64,-.05],[.95,.29,.40,-.04],[1,0,0,-.06]],
    grumpangler:[[-1,.20,.24,-.06],[-.80,.52,.60,-.05],[-.44,.98,.94,-.02],[-.02,1.0,1.05,-.02],[.38,.99,1.05,.035],[.66,.78,.87,.02],[.88,.46,.56,-.01],[1,0,0,-.06]]
  };
  function fishProfileKind(id){return id==='gulpuffer'||id==='grumpangler'?id:id==='catfish'?'catfish':id==='angelfish'?'angel':id==='lantern'?'angler':id==='crystal'?'sturgeon':id==='galaxywhale'?'whale':id==='dreamray'?'ray':['carp','koi','lotusfin','phoenixfish'].includes(id)?'carp':['crucian','goldfish','moonfin'].includes(id)?'round':'slender';}
  function fishSection(kind,x){if(kind==='whale'&&x>=.70){const r=Math.sqrt(Math.max(0,1-((x-.70)/.30)**2));return[.88*r,.91*r,-.015*(x-.70)/.30];}const p=FISH_PROFILES[kind]||FISH_PROFILES.slender;let i=0;while(i<p.length-2&&x>p[i+1][0])i++;const a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],d=p[Math.min(p.length-1,i+2)],t=Math.max(0,Math.min(1,(x-b[0])/(c[0]-b[0]))),h=c[0]-b[0];return[1,2,3].map(k=>{const m=(c[k]-a[k])/(c[0]-a[0]),n=(d[k]-b[k])/(d[0]-b[0]),value=(2*t*t*t-3*t*t+1)*b[k]+(t*t*t-2*t*t+t)*h*m+(-2*t*t*t+3*t*t)*c[k]+(t*t*t-t*t)*h*n;return k===3?value:Math.max(0,value);});}
  function anatomicalBodyMesh(kind){const g=fishSurface((u,v)=>{const x=Math.cos(u*Math.PI),[h,w,y]=fishSection(kind,x),a=-v*TAU;let py=y+Math.sin(a)*h,pz=Math.cos(a)*w;if(kind==='gulpuffer'){const jowl=Math.exp(-Math.pow((x-.61)/.25,2))*Math.max(0,-Math.sin(a));py-=jowl*.12;pz*=1+jowl*.05;}if(kind==='grumpangler'){const hood=Math.exp(-Math.pow((x-.37)/.48,2))*Math.max(0,Math.sin(a));py+=hood*(.15+.012*Math.sin(x*11.+Math.sin(a)*1.7)+.005*Math.cos(x*23.+a*3.));pz*=1+.008*hood*Math.cos(a*4.-x*9.);}return[x,py,pz];},48,32);for(let j=0;j<g.p.length;j+=3){if(g.p[j]>.999999&&Math.hypot(g.n[j],g.n[j+1],g.n[j+2])<.001){g.n[j]=1;g.n[j+1]=0;g.n[j+2]=0;}}for(const x of[-1,1]){const [h,w,y]=fishSection(kind,x),n=[x,0,0];if(h*w<.000001)continue;for(let j=0;j<32;j++){const a=j/32*TAU,b=(j+1)/32*TAU;g.tri([x,y,0],[x,y+Math.sin(a)*h,Math.cos(a)*w],[x,y+Math.sin(b)*h,Math.cos(b)*w],n,n,n);g.uv.push(0,0,0,0,0,0);}}return g;}
  function fishCurve(points,t){const q=Math.max(0,Math.min(.999999,t))*(points.length-1),i=Math.floor(q),f=q-i,a=points[Math.max(0,i-1)],b=points[i],c=points[Math.min(points.length-1,i+1)],d=points[Math.min(points.length-1,i+2)];return b.map((n,k)=>.5*(2*n+(-a[k]+c[k])*f+(2*a[k]-5*n+4*c[k]-d[k])*f*f+(-a[k]+3*n-3*c[k]+d[k])*f*f*f));}
  function fishTubeMesh(points,radius,endRadius){return fishSurface((u,v)=>{const p=fishCurve(points,u),a=fishCurve(points,Math.max(0,u-.001)),b=fishCurve(points,Math.min(1,u+.001)),t=b.slice(0,3).map((n,k)=>n-a[k]),length=Math.hypot(...t)||1;for(let k=0;k<3;k++)t[k]/=length;const ref=Math.abs(t[2])>.92?[0,1,0]:[0,0,1],n=[t[1]*ref[2]-t[2]*ref[1],t[2]*ref[0]-t[0]*ref[2],t[0]*ref[1]-t[1]*ref[0]],l=Math.hypot(...n)||1;for(let k=0;k<3;k++)n[k]/=l;const m=[t[1]*n[2]-t[2]*n[1],t[2]*n[0]-t[0]*n[2],t[0]*n[1]-t[1]*n[0]],r=p[3]===undefined?radius+(endRadius-radius)*u:p[3],a2=-v*TAU;return p.slice(0,3).map((q,k)=>q+r*(n[k]*Math.cos(a2)+m[k]*Math.sin(a2)*(p[4]||1)));},Math.max(20,(points.length-1)*8),10);}
  function fishFinMesh(root,edge){return fishSurface((u,v)=>{const a=fishCurve(root,v),b=fishCurve(edge,v);return a.map((n,k)=>n+(b[k]-n)*u+(k===2?Math.sin(u*Math.PI)*.035*Math.sin(v*Math.PI):0));},16,32);}
  function speciesTailMesh(kind){const roots=[[0,.055,0],[.025,0,0],[0,-.055,0]],fork=[[-.79,.53,0],[-.63,.34,0],[-.39,.09,0],[-.38,-.06,0],[-.63,-.34,0],[-.79,-.53,0]],edges=kind==='round'?[[-.49,.39,0],[-.66,.28,0],[-.73,0,0],[-.66,-.28,0],[-.49,-.39,0]]:kind==='shallow'?[[-.64,.43,0],[-.67,.24,0],[-.57,0,0],[-.67,-.24,0],[-.64,-.43,0]]:kind==='hetero'?[[-.85,.67,0],[-.70,.38,0],[-.37,.08,0],[-.40,-.13,0],[-.55,-.36,0],[-.48,-.39,0]]:kind==='moon'?[[-.32,.86,0],[-.64,.61,0],[-.51,.28,0],[-.31,0,0],[-.51,-.28,0],[-.64,-.61,0],[-.32,-.86,0]]:kind==='fluke'?[[-.15,.12,0],[-.10,.54,0],[-.27,.95,0],[-.51,.74,0],[-.61,.37,0],[-.42,.045,0],[-.42,-.045,0],[-.61,-.37,0],[-.51,-.74,0],[-.27,-.95,0],[-.10,-.54,0],[-.15,-.12,0]]:fork;return fishFinMesh(roots,edges);}
  function medianFishFin(id,start,end,height,side,spines){const kind=fishProfileKind(id),d=FISH_DIMENSIONS[id]||[1,.4,.3];return fishSurface((u,v)=>{const x=start+(end-start)*v,[h,,y]=fishSection(kind,x),rise=Math.pow(Math.sin(v*Math.PI),.65)*height*(spines?.68+.32*Math.abs(Math.sin(v*Math.PI*spines)):1);return[x*d[0]-u*.045,y*d[1]+side*(h*d[1]*.98+rise*u),Math.sin(u*Math.PI)*.025];},16,spines?48:30);}
  function rayDiscMesh(){const point=(u,v,under)=>{const x=.98-u*1.91,s=v*2-1,w=Math.max(0,Math.sin(u*Math.PI)),span=u<.1?.18*Math.sin(u/.1*Math.PI/2):u<.4?.18+1.30*Math.pow((u-.1)/.3,.88):1.48*Math.pow((1-u)/.6,1.15),thickness=Math.pow(w,.7)*(1-s*s)*(.017+.155*Math.exp(-s*s*10)),middle=.015*w+.06*s*s*w;return[x,middle+thickness*(under?-.65:1),s*span];},g=fishSurface((u,v)=>point(u,v,false),40,44),bottom=fishSurface((u,v)=>point(u,1-v,true),40,44);g.p.push(...bottom.p);g.n.push(...bottom.n);g.uv.push(...bottom.uv.map((n,i)=>n+(i%2?2:0)));return g;}
  function whaleFlipperMesh(){return fishSurface((u,v)=>{const a=-v*TAU,w=(1-u)*.08+.17*Math.sin(u*Math.PI),h=.055*Math.pow(1-u,.8)+.012*Math.sin(u*Math.PI);return[-u*1.18,Math.sin(a)*w,Math.cos(a)*h+.045*Math.sin(u*Math.PI)];},28,18);}
  function whaleFlukeMesh(){const root=[[0,.09,0],[.035,0,0],[0,-.09,0]],edge=[[-.13,.12,0],[-.095,.53,0],[-.29,.94,0],[-.53,.76,0],[-.61,.38,0],[-.45,.045,0],[-.45,-.045,0],[-.61,-.38,0],[-.53,-.76,0],[-.29,-.94,0],[-.095,-.53,0],[-.13,-.12,0]],point=(u,v,side)=>{const a=fishCurve(root,v),b=fishCurve(edge,v),thick=.072*(1-u)*Math.sin(v*Math.PI)+.028*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);return[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,thick*side];},g=fishSurface((u,v)=>point(u,v,1),22,42),bottom=fishSurface((u,v)=>point(u,1-v,-1),22,42);g.p.push(...bottom.p);g.n.push(...bottom.n);g.uv.push(...bottom.uv);return g;}
  function fishScuteMesh(){const g=geometry(),top=[0,.36,0],points=[[1,0,0],[0,0,.55],[-1,0,0],[0,0,-.55]];for(let j=0;j<4;j++)g.tri(points[j],points[(j+1)%4],top);return g;}
  function bluntToothMesh(){const g=fishSurface((u,v)=>{const a=-v*TAU,r=Math.pow(Math.sin(u*Math.PI),.48)*(.80+.12*u);return[Math.cos(a)*r,.15-u,Math.sin(a)*r*.64];},16,18);for(let j=0;j<g.p.length;j+=3)if(Math.hypot(g.n[j],g.n[j+1],g.n[j+2])<.001){g.n[j]=0;g.n[j+1]=g.p[j+1]>0?1:-1;g.n[j+2]=0;}return g;}
  function coinLureMesh(){return fishSurface((u,v)=>{const a=u*TAU,b=v*TAU,inner=.25/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a))),r=(.98+inner)*.5+(.98-inner)*.5*Math.cos(b),s=Math.sin(b);return[Math.cos(a)*r,Math.sin(a)*r,Math.sign(s)*Math.pow(Math.abs(s),.36)*.076];},64,24);}
  function heartGlowMesh(){const g=geometry(),points=[[0,-1,0],[-.82,-.04,0],[-.86,.52,0],[-.49,.80,0],[0,.44,0],[.49,.80,0],[.86,.52,0],[.82,-.04,0]],curve=[];for(let i=0;i<=48;i++)curve.push(fishCurve([...points,points[0]],i/48));for(let j=0;j<curve.length-1;j++){g.tri([0,0,0],curve[j],curve[j+1],[0,0,1],[0,0,1],[0,0,1]);g.tri([0,0,0],curve[j+1],curve[j],[0,0,-1],[0,0,-1],[0,0,-1]);}return g;}
  const FLOPRAY_WING_PROFILE=[[0,.08],[.10,.24],[.24,.90],[.37,1.48],[.45,1.60],[.55,1.40],[.73,.76],[.90,.22],[1,0]];
  function floprayPoint(u,v,under){
    // Smooth outline tangents and a closed, rounded rim keep the wings fleshy.
    const p=FLOPRAY_WING_PROFILE;let i=0;while(i<p.length-2&&u>p[i+1][0])i++;
    const a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],d=p[Math.min(p.length-1,i+2)],t=(u-b[0])/(c[0]-b[0]),h=c[0]-b[0],m=(c[1]-a[1])/(c[0]-a[0]),n=(d[1]-b[1])/(d[0]-b[0]),span=Math.max(0,(2*t*t*t-3*t*t+1)*b[1]+(t*t*t-2*t*t+t)*h*m+(-2*t*t*t+3*t*t)*c[1]+(t*t*t-t*t)*h*n),s=v*2-1,w=Math.max(0,Math.sin(u*Math.PI)),nose=-.39*Math.exp(-Math.pow((u-.09)/.14,2))*Math.pow(1-s*s,3),thick=Math.pow(w,.66)*Math.pow(Math.max(0,1-s*s),.72)*(.066+.17*Math.exp(-s*s*9)),sleeve=-.20*Math.pow(Math.abs(s),3)*w;
    return[1.14-u*2.11,nose+sleeve+thick*(under?-.66:1),s*span];
  }
  function floprayMesh(){const g=fishSurface((u,v)=>floprayPoint(u,v,false),44,44),bottom=fishSurface((u,v)=>floprayPoint(u,1-v,true),44,44);g.p.push(...bottom.p);g.n.push(...bottom.n);g.uv.push(...bottom.uv.map((n,i)=>n+(i%2?2:0)));return g;}
  const WISH_EEL_SPINE=[[1.04,.345,0,.012,1],[.91,.39,0,.12,.96],[.67,.49,0,.283,.91],[.29,.69,0,.262,.88],[-.24,.72,0,.218,.84],[-.64,.44,0,.181,.80],[-.67,.065,0,.147,.82],[-.33,-.235,0,.113,.85],[-.24,-.61,0,.078,.88],[-.43,-.91,0,.037,.95],[-.59,-1.015,0,.004,1]];
  function waterCell(x,z){const a=Math.atan2(z,x),r=2.11+Math.sin(a*3+.7)*.13+Math.sin(a*7-.4)*.028;return Math.hypot(x,z*1.035)<r;}
  function shoreDistance(x,z){const a=Math.atan2(z,x);return Math.hypot(x,z*1.035)-(2.11+Math.sin(a*3+.7)*.13+Math.sin(a*7-.4)*.028);}
  function bankHeight(x,z){const d=Math.max(0,shoreDistance(x,z)),t=Math.min(1,d/.4);return .018+t*t*(3-2*t)*.085+Math.sin(x*8+z*3)*.006;}
  function shoreRadius(angle){return 2.11+Math.sin(angle*3+.7)*.13+Math.sin(angle*7-.4)*.028;}
  function outerRadius(angle,anchors,style='meadow'){const silhouettes={meadow:0,lily:.095*Math.cos(angle*4+.3),coral:.16*Math.sin(angle*5+.3)+.045*Math.cos(angle*9),crystal:.19*Math.pow(Math.abs(Math.cos(angle*3+.4)),.45)-.08,moon:.17*Math.cos(angle*2-.6)+.09*Math.sin(angle),cloud:.12*Math.cos(angle*6)+.07*Math.sin(angle*3)};let radius=2.64+Math.sin(angle*3+.7)*.13+Math.sin(angle*7-.4)*.045+(silhouettes[style]||0);for(const d of anchors||[]){if(d.kind==='dock'||d.kind==='lilies')continue;const a=Math.atan2(d.z*1.035,d.x),diff=Math.atan2(Math.sin(angle-a),Math.cos(angle-a)),r=Math.hypot(d.x,d.z*1.035),bump=Math.max(0,r+.28-radius)*Math.exp(-diff*diff/.026);radius+=bump;}return radius;}
  function terrainHeight(x,z,anchors){const a=Math.atan2(z*1.035,x),inner=shoreRadius(a),outer=outerRadius(a,anchors),t=Math.max(0,Math.min(1,(Math.hypot(x,z*1.035)-inner)/(outer-inner))),height=bankHeight(x,z);if(t<.28){const q=t/.28;return-.047+(height+.047)*q*q*(3-2*q);}return height*(t>.72?1-(t-.72)/.28*.85:1);}
  const pebblePrimitive=sphereMesh(8,12);
  function addPebble(g,x,y,z,sx,sy,sz){for(let i=0;i<pebblePrimitive.p.length;i+=3){g.p.push(x+pebblePrimitive.p[i]*sx,y+pebblePrimitive.p[i+1]*sy,z+pebblePrimitive.p[i+2]*sz);const n=[pebblePrimitive.n[i]/sx,pebblePrimitive.n[i+1]/sy,pebblePrimitive.n[i+2]/sz],l=Math.hypot(...n);g.n.push(...n.map(q=>q/l));}}
  function bankMesh(layer,anchors,style='meadow'){
    const g=geometry(),count=160,steps=16;
    if(layer==='stone'){for(let i=0;i<42;i++){const seed=hash('stone'+i),a=(hash('stone-cluster'+Math.floor(i/6))%30000)/30000*TAU+((i%6)-2.5)*.025+((seed%31)-15)/1500,r=shoreRadius(a)+.01+(seed%67)/700,x=Math.cos(a)*r,z=Math.sin(a)*r/1.035,size=i%13===0?.056:.012+(seed%24)/800;addPebble(g,x,bankHeight(x,z)+.006,z,size,.012+(seed%11)/550,size*.76);}return g;}
    const point=(angle,t)=>{const inner=shoreRadius(angle),outer=outerRadius(angle,anchors,style),r=layer==='grass'||layer==='soil'?inner+(outer-inner)*t:inner*t,x=Math.cos(angle)*r,z=Math.sin(angle)*r/1.035;let y=-.015;if(layer==='grass'){const fade=t>.72?1-((t-.72)/.28)*.85:1;y=bankHeight(x,z)*fade;if(t<.28){const q=t/.28;y=-.047+(bankHeight(x,z)+.047)*q*q*(3-2*q);}const sculpt=style==='coral'?.022*Math.sin(angle*9+t*8):style==='crystal'?.050*Math.abs(Math.sin(angle*5)):style==='cloud'?.055*(.5+.5*Math.cos(angle*6)):style==='moon'?.025*Math.sin(angle*4):0;y+=sculpt*Math.sin(t*Math.PI);}if(layer==='floor'){const edge=Math.max(0,(t-.72)/.28);y=-.68+edge*edge*(3-2*edge)*.64;}if(layer==='soil')y=t===0?-.05:-.15;return[x,y,z];};
    const normal=(a,t)=>{const h=.001,p=point(a,t),u=point(a+h,t).map((q,i)=>q-p[i]),v=point(a,t+h).map((q,i)=>q-p[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);return l>.0000001?n.map(q=>q/l):[0,1,0];};
    if(layer==='soil'){for(let i=0;i<count;i++){const a=i*TAU/count,b=(i+1)*TAU/count,r=outerRadius(a,anchors,style),s=outerRadius(b,anchors,style),p=[Math.cos(a)*r,.018,Math.sin(a)*r/1.035],q=[Math.cos(b)*s,.018,Math.sin(b)*s/1.035],pl=[p[0],-.05,p[2]],ql=[q[0],-.05,q[2]],na=[Math.cos(a),0,Math.sin(a)],nb=[Math.cos(b),0,Math.sin(b)];g.tri(p,pl,ql,na,na,nb);g.tri(p,ql,q,na,nb,nb);}return g;}
    if(layer==='grass')g.uv=[];
    for(let i=0;i<count;i++)for(let j=0;j<steps;j++){const a=i*TAU/count,b=(i+1)*TAU/count,t=j/steps,v=(j+1)/steps,p=[point(a,t),point(a,v),point(b,v),point(b,t)],n=[normal(a,t),normal(a,v),normal(b,v),normal(b,t)];g.tri(p[0],p[1],p[2],n[0],n[1],n[2]);g.tri(p[0],p[2],p[3],n[0],n[2],n[3]);if(g.uv)g.uv.push(t,0,v,0,v,0,t,0,v,0,t,0);}return g;
  }
  function crystalMesh(){const g=geometry();for(let i=0;i<6;i++){const a=i*TAU/6,b=(i+1)*TAU/6,p=[Math.cos(a),.4,Math.sin(a)],q=[Math.cos(b),.4,Math.sin(b)],r=[q[0],-1,q[2]],s=[p[0],-1,p[2]];g.tri(p,q,[0,1.5,0]);g.tri(p,r,q);g.tri(p,s,r);g.tri(s,[0,-1,0],r);}return g;}
  function ornamentMesh(crescent){const g=geometry(),points=[];if(crescent){for(let i=0;i<=30;i++){const a=(-.68+i/30*1.36)*Math.PI,w=.025+Math.sin(i/30*Math.PI)*.26;points.push([[Math.cos(a),Math.sin(a),0],[Math.cos(a)*(1-w),Math.sin(a)*(1-w),0]]);}for(let i=0;i<points.length-1;i++){const [a,b]=points[i],[c,d]=points[i+1];g.tri(a,b,d);g.tri(a,d,c);g.tri(a,d,b);g.tri(a,c,d);}}else{for(let i=0;i<10;i++){const a=i*TAU/10+Math.PI/2,r=i%2?.43:1;points.push([Math.cos(a)*r,Math.sin(a)*r,0]);}for(let i=0;i<10;i++){g.tri([0,0,.1],points[i],points[(i+1)%10]);g.tri([0,0,-.1],points[(i+1)%10],points[i]);}}return g;}
  function crescentJewelMesh(){
    const g=geometry(),rows=[];for(let i=0;i<=32;i++){const a=(-.68+i/32*1.36)*Math.PI,w=.026+Math.sin(i/32*Math.PI)*.30;rows.push([[Math.cos(a),Math.sin(a),.065],[Math.cos(a)*(1-w),Math.sin(a)*(1-w),.065],[Math.cos(a)*(1-w),Math.sin(a)*(1-w),-.065],[Math.cos(a),Math.sin(a),-.065]]);}
    for(let i=0;i<32;i++)for(let j=0;j<4;j++){const a=rows[i][j],b=rows[i+1][j],c=rows[i+1][(j+1)%4],d=rows[i][(j+1)%4];g.tri(a,b,c);g.tri(a,c,d);}for(const row of[rows[0],rows[32]]){g.tri(row[0],row[1],row[2]);g.tri(row[0],row[2],row[3]);}return g;
  }
  function shellJewelMesh(){
    const point=(u,v,side)=>{const a=(v-.5)*2.35,r=u*(1+.032*Math.cos(v*TAU*9)),ridge=.035*Math.pow(.5+.5*Math.cos(v*TAU*9),4)*Math.sin(u*Math.PI);return[Math.sin(a)*r,Math.cos(a)*r-.67,side*(.024+Math.sin(u*Math.PI)*.17+ridge)];};
    const g=fishSurface((u,v)=>point(u,v,1),16,36),back=fishSurface((u,v)=>point(u,1-v,-1),16,36);g.p.push(...back.p);g.n.push(...back.n);g.uv.push(...back.uv);return g;
  }
  // Jewellery is built once in fish coordinates, grouped by material, and shares
  // the body's deformation. A collar or bezel gives every ornament a visible seat.
  const legendJewelleryCache=new Map();
  function legendJewellery(species){
    if(legendJewelleryCache.has(species))return legendJewelleryCache.get(species);
    if(!['gulpuffer','grumpangler','flopray','snagglefin','dragonkoi','galaxywhale'].includes(species))return[];
    const groups={gold:geometry(),jade:geometry(),pearl:geometry()},ball=sphereMesh(10,16),star=ornamentMesh(false),moon=crescentJewelMesh(),shell=shellJewelMesh(),leaf=leafMesh(),d=FISH_DIMENSIONS[species],kind=fishProfileKind(species);
    const transform=(p,s,ry=0,rx=0,rz=0)=>matMul(model(...p,1,1,1,ry),matMul(tilt(rx,rz),model(0,0,0,...s))),add=(group,g,p,s,ry=0,rx=0,rz=0)=>appendMesh(groups[group],g,transform(p,s,ry,rx,rz)),bead=(group,p,r,sy=r,sz=r)=>add(group,ball,p,[r,sy,sz]),wire=(points,r=.012,group='gold')=>appendMesh(groups[group],fishTubeMesh(points,r,r*.82),model(0,0,0,1,1,1)),ring=(p,r,thickness=.011,rx=0)=>{const pts=[];for(let j=0;j<=24;j++){const a=j/24*TAU;pts.push([p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r*Math.cos(rx),p[2]+Math.sin(a)*r*Math.sin(rx)]);}wire(pts,thickness);};
    const surface=(nx,a,offset=.014)=>{const[h,w,cy]=fishSection(kind,nx),up=Math.cos(a);let y=cy+h*up;if(species==='grumpangler')y+=Math.exp(-Math.pow((nx-.37)/.48,2))*Math.max(0,up)*.15;return[nx*d[0],y*d[1]+up*offset,Math.sin(a)*(w*d[2]+offset)];},collar=(nx,span=1.25)=>{const pts=[];for(let j=0;j<=14;j++)pts.push(surface(nx,-span+j/14*span*2));wire(pts,.016);return pts;};
    if(species==='gulpuffer'){
      collar(-.10,1.30);add('gold',moon,[-.065,.807,0],[.255,.255,.25],0,0,-Math.PI/2);
      wire([[-.076,.573,0],[-.065,.586,0],[-.065,.610,0]],.021);
      for(const p of[[-.280,.944,0],[.150,.944,0],[-.065,.607,.023]]){bead('gold',p,.049,.049,.038);bead('pearl',[p[0],p[1]+.007,p[2]+.018],.039);}
      for(const side of[-1,1]){const a=surface(-.10,side*.85),b=surface(.13,side*1.18),mid=surface(.02,side*1.05);wire([a,mid,b],.011);add('gold',moon,[b[0],b[1]-.050,b[2]+side*.014],[.055,.069,.06],0,0,-.35);}
    }else if(species==='grumpangler'){
      collar(.55,1.18);const p=surface(.55,0);bead('gold',[p[0],p[1]+.086,0],.107,.161,.073);bead('jade',[p[0]+.003,p[1]+.097,.036],.077,.126,.056);
      for(const side of[-1,1]){const a=surface(.55,side*1.12),end=[a[0]-.010,a[1]-.120,a[2]+side*.037];wire([a,[a[0]-.017,a[1]-.071,a[2]+side*.031],end],.011);bead('gold',end,.034,.050,.028);bead('jade',[end[0],end[1]-.017,end[2]+side*.012],.030,.057,.025);const curl=[surface(.55,side*.30),surface(.40,side*.56),surface(.30,side*.74),surface(.40,side*.85)];wire(curl,.011);}
    }else if(species==='flopray'){
      const crown=[];for(let j=0;j<=16;j++){const s=-.31+j/16*.62,p=floprayPoint(.43+Math.abs(s)*.08,.5+s*.5,false);p[1]+=.019;crown.push(p);}wire(crown,.013);
      for(const k of[1,4,8,12,15]){const p=crown[k];bead('pearl',[p[0],p[1]+.012,p[2]],k===8?.052:.039);}
      const flower=floprayPoint(.43,.5,false);flower[1]+=.032;
      for(let j=0;j<5;j++){const a=j/5*TAU,p=[flower[0]+Math.cos(a)*.080,flower[1],Math.sin(a)*.080];add('pearl',leaf,p,[.20,.20,.27],0,Math.PI/2,a);}
      bead('gold',flower,.049,.023,.049);bead('jade',[flower[0],flower[1]+.024,0],.035,.030,.035);
      const shellSeat=floprayPoint(.31,.5,false);shellSeat[1]+=.033;add('gold',shell,shellSeat,[.149,.171,.15],0,-Math.PI/2);add('pearl',shell,[shellSeat[0],shellSeat[1]+.012,0],[.131,.153,.16],0,-Math.PI/2);wire([[flower[0],flower[1],0],[.33,.242,0],[shellSeat[0],shellSeat[1],.055]],.011);
    }else if(species==='snagglefin'){
      for(const side of[-1,1]){
        const path=[];for(let j=0;j<=22;j++){const p=fishCurve(WISH_EEL_SPINE,.16+j/22*.47);path.push([p[0],p[1],side*(p[3]*p[4]+.014)]);}wire(path,.010);
        for(const t of[.27,.40,.55]){const p=fishCurve(WISH_EEL_SPINE,t),z=side*(p[3]*p[4]+.021);add('gold',star,[p[0],p[1],z],[.066,.073,.06]);bead('pearl',[p[0],p[1],z+side*.012],.021,.022,.016);}
        wire([[.62,.505,side*.257],[.63,.421,side*.273],[.63,.384,side*.279]],.010);
        add('gold',moon,[.63,.329,side*.280],[.069,.079,.075],0,0,-.30);bead('pearl',[.655,.339,side*.284],.021);
      }
    }else if(species==='dragonkoi'){
      wire([[.54,.438,-.15],[.66,.506,0],[.54,.438,.15]],.019);bead('gold',[.66,.516,0],.090,.139,.063);bead('jade',[.66,.531,.030],.064,.112,.046);
      for(const side of[-1,1]){
        wire([[.65,.44,side*.158],[.61,.58,side*.17],[.45,.690,side*.19],[.36,.75,side*.20]],.018);bead('jade',[.374,.741,side*.200],.026,.037,.026);wire([[.61,.575,side*.17],[.47,.564,side*.19],[.39,.56,side*.20]],.012);
        wire([[.67,.45,side*.07],[.61,.397,side*.175],[.55,.315,side*.214],[.48,.267,side*.205]],.012);bead('gold',[.545,.317,side*.216],.100,.118,.031);bead('jade',[.545,.322,side*.237],.077,.095,.026);
        wire([[.62,.317,side*.237],[.54,.391,side*.245],[.465,.319,side*.238]],.008);bead('pearl',[.544,.395,side*.245],.023);
        wire([[1.01,-.63,side*.42],[.85,-.65,side*.37],[.81,-.699,side*.36]],.008);bead('gold',[.845,-.656,side*.37],.029);bead('jade',[.81,-.720,side*.36],.028,.052,.026);
      }
    }else if(species==='galaxywhale'){
      collar(.10,1.11);wire([[.112,.542,0],[.106,.644,0],[.10,.695,0]],.018);add('gold',star,[.10,.785,0],[.157,.174,.10]);bead('pearl',[.10,.785,.024],.035,.038,.022);
      for(const side of[-1,1]){
        const a=surface(.10,side*.80),b=surface(.25,side*1.15),end=surface(.36,side*1.52);wire([a,b,end],.012);
        const center=[end[0]+.008,end[1]-.111,end[2]+side*.019];ring(center,.122,.011);wire([[center[0],center[1]+.120,center[2]],[center[0],center[1]+.047,center[2]]],.008);add('gold',star,center,[.059,.069,.055]);bead('jade',[center[0],center[1],center[2]+side*.012],.022,.024,.017);
        const p=surface(.10,side*.61);add('gold',star,[p[0],p[1]+.077,p[2]],[.066,.087,.055]);bead('pearl',[p[0],p[1]+.077,p[2]+side*.010],.021);
      }
    }
    const tones={gold:species==='galaxywhale'?'#decf9e':'#e3bf70',jade:species==='galaxywhale'?'#a9dce2':species==='grumpangler'?'#b6dbac':'#8ed6bf',pearl:'#f8e9d4'},materials={gold:22,jade:23,pearl:24};
    const rows=Object.keys(groups).filter(key=>groups[key].p.length).map(key=>({key:'legend-jewellery-'+species+'-'+key,geometry:groups[key],color:tones[key],material:materials[key]}));legendJewelleryCache.set(species,rows);return rows;
  }
  function resolveFish(options){const catalog=options.catalog&&options.catalog.fish||options.catalog&&options.catalog.fishes||options.catalog||[],lookup=id=>Array.isArray(catalog)?catalog.find(f=>f.id===id):catalog[id],list=options.fish||options.pond&&options.pond.fish||[];return list.slice(0,5).map((item,i)=>typeof item==='string'?{...lookup(item),id:item,instanceId:item+i}:{...lookup(item.fishId||item.speciesId||item.id),...item});}
  function pondStyle(pond){const k=String(pond&&pond.styleId||pond&&pond.style||pond&&pond.kind||pond&&pond.id||'');return /moon|star|astral/i.test(k)?'moon':/cloud|jade|immortal/i.test(k)?'cloud':/crystal|ice|frost/i.test(k)?'crystal':/coral|glass|aquarium|ocean|reef/i.test(k)?'coral':/lily|lotus/i.test(k)?'lily':'meadow';}
  function theme(pond){return({moon:{rim:'#8987bb',edge:'#42425e',floor:'#454f79',water:'#384e9d',leaf:'#8b83b5',grass:'#666087',gem:'#f2d291'},cloud:{rim:'#dce3d8',edge:'#aabcb3',floor:'#7bbaac',water:'#80cfc6',leaf:'#a4c4ad',grass:'#d5ded0',gem:'#e7c887'},coral:{rim:'#eddbc0',edge:'#c4a17e',floor:'#bdd3b5',water:'#23bdcb',leaf:'#d78597',grass:'#eadab9',gem:'#ffbc94'},crystal:{rim:'#d2edf2',edge:'#809caf',floor:'#81b7d4',water:'#5bafd7',leaf:'#c1e1ea',grass:'#e2edf0',gem:'#e5ffff'},lily:{rim:'#b8afa0',edge:'#70645c',floor:'#648d76',water:'#438878',leaf:'#3b7757',grass:'#759866',gem:'#efadc6'},meadow:{rim:'#b2ad96',edge:'#88765b',floor:'#4a877c',water:'#368c85',leaf:'#507b60',grass:'#82966a',gem:'#d8bd80'}})[pondStyle(pond)];}
  const FEED_PROFILES={minnow:'dart',crucian:'bop',carp:'jump',perch:'zigzag',trout:'twist',sardine:'school',mackerel:'spiral',catfish:'nibble',koi:'bow',goldfish:'fan',seahorse:'bob',angelfish:'waltz',lantern:'glow',lotusfin:'blossom',moonfin:'orbit',crystal:'sparkle',phoenixfish:'flame',dreamray:'glide',dragonkoi:'coil',galaxywhale:'breach',gulpuffer:'moonbubble',grumpangler:'fortune',flopray:'hug',snagglefin:'wish'};
  const DECOR_KINDS=['tree','willow','bush','flowers','reeds','rocks','dock','lantern','bench','basket','lilies','signpost'];
  // Opaque silhouette bounds include the art that extends past its atlas cell.
  // Sampling those bounds prevents neighbouring foliage fragments in props.
  const DECOR_BOUNDS=[[8,19,373,405],[382,24,746,419],[754,107,1100,403],[1118,122,1436,401],[33,412,348,754],[360,490,739,748],[748,423,1104,748],[1190,404,1388,741],[21,760,373,1064],[402,801,721,1021],[762,774,1100,1030],[1165,749,1430,1063]];
  function decorationMarkup(item,atlasUrl){const kind=typeof item==='string'?item:item&&item.kind||item&&item.id,index=DECOR_KINDS.indexOf(kind);if(index<0)return'';const b=DECOR_BOUNDS[index],width=b[2]-b[0],height=b[3]-b[1],clip='fishing-decor-clip-'+(++artSerial);return`<svg class="fishing-decoration-art" viewBox="0 0 ${width} ${height}" style="overflow:hidden;image-rendering:auto" aria-hidden="true"><defs><clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><rect width="${width}" height="${height}"/></clipPath></defs><g clip-path="url(#${clip})"><image href="${esc(atlasUrl||'/fishing-art/pond-decor-v2.png')}" x="${-b[0]}" y="${-b[1]}" width="1448" height="1086"/></g></svg>`;}
  const DECOR_SIZE={tree:[1.9,1.92],willow:[1.85,1.94],bush:[1.12,.89],flowers:[.84,.65],reeds:[.92,1.02],rocks:[.87,.7],dock:[1.55,1.38],lantern:[.88,1.15],bench:[1.32,.93],basket:[.64,.55],lilies:[.87,.8],signpost:[.87,.91]};
  function defaultDecorations(style){return[
    {id:'tree-left',kind:'willow',x:-1.82,z:-1.91,scale:.94},
    {id:'tree-right',kind:'tree',x:1.92,z:-1.60,scale:.66},
    {id:'shrub',kind:'bush',x:-.77,z:-2.38,scale:.62},
    {id:'rocks',kind:'rocks',x:2.23,z:-.65,scale:.87},
    {id:'reeds',kind:'reeds',x:2.20,z:.82,scale:.68},
    {id:'flowers-right',kind:'flowers',x:1.57,z:1.99,scale:.53},
    {id:'dock',kind:'dock',x:-1.80,z:1.02,rotation:1,scale:.88},
    {id:'lamp',kind:'lantern',x:-2.34,z:.65,scale:.58},
    {id:'lilies',kind:'lilies',x:1.10,z:-.96,scale:style==='lily'?.78:.50}
  ];}
  function spriteMesh(){const g=geometry();g.tri([-.5,0,0],[.5,0,0],[.5,1,0],[0,0,1],[0,0,1],[0,0,1]);g.tri([-.5,0,0],[.5,1,0],[-.5,1,0],[0,0,1],[0,0,1],[0,0,1]);g.uv=[0,0,1,0,1,1,0,0,1,1,0,1];return g;}
  function createPond(host,initial){
    if(!host||!host.ownerDocument)throw new Error('A pond host element is required.');
    let options={...initial},fish=resolveFish(options),palette=theme(options.pond),destroyed=false,raf=0,last=0,visible=true,time=0,yaw=.2,zoom=Math.max(.65,Math.min(1.5,Number(initial&&initial.zoom)||1)),drag=null,points=[],decorPoints=[],gl=null,program=null,buffers=[],observer=null,feeding=null,feedingKey='',feedStart=-10,texture=null,atlas=null,atlasReady=false,localDecorations=null,projection=null,waterEvents=[],lastWaterKey='';
    const lighting=typeof module==='object'&&module.exports?require('./fishing-lighting'):globalThis.TracerFishingLighting;let shadowMap=null,shadowPass=false;
    const rippleData=new Float32Array(32),swimmerData=new Float32Array(15);
    const doc=host.ownerDocument,win=doc.defaultView||globalThis,canvas=doc.createElement('canvas'),aquarium=options.aquariumOnly===true,motionQuery=aquarium?win.matchMedia?.('(prefers-reduced-motion: reduce)'):null;let reducedAquarium=aquarium&&(options.reducedMotion===undefined?!!motionQuery?.matches:!!options.reducedMotion);canvas.className=aquarium?'fishing-aquarium-canvas':'fishing-pond-canvas'+(options.figureOnly?' fishing-fish-figure-canvas':'');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',aquarium?'传奇鱼玻璃水族箱 / 3D legendary aquarium':options.figureOnly?name(fish[0])+' / 3D fish':'3D 鱼塘，最多五条鱼在水中游动');host.classList.add(aquarium?'fishing-aquarium-volume-host':options.figureOnly?'fishing-fish-figure-host':'fishing-pond-host');host.appendChild(canvas);
    let aquariumYaw=normalizeAquariumYaw(options.aquariumYaw),aquariumTargetYaw=aquariumYaw,aquariumTurn=null,aquariumView=null,aquariumTransparent=null,aquariumBoundsKey='',aquariumBoundsCallback=null;
    canvas.style.imageRendering='auto';try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:aquarium,powerPreference:'low-power'});}catch(_){gl=null;}
    if(!gl){
      canvas.remove();if(aquarium){host.classList.remove('fishing-aquarium-volume-host');return null;}return createPondFallback(host,options);
    }
    function shader(type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){const info=gl.getShaderInfoLog(sh);gl.deleteShader(sh);throw new Error(info);}return sh;}
    try{
      const vertex=shader(gl.VERTEX_SHADER,`
        attribute vec3 aPosition,aNormal; attribute vec2 aUv;
        uniform mat4 uView,uModel; uniform vec4 uUvRect;
        uniform mediump float uMaterial,uTime,uSpecies,uFishFeed,uMotionEnabled;
        uniform mediump float uBodyPhase,uBodyAmplitude,uFinPhase,uFinAmplitude,uWingPhase,uWingAmplitude,uWingFold,uBodyPuff;
        varying vec3 vNormal,vWorld,vLocal; varying vec2 vUv,vScreen;
        float bodyWave(float x){
          float phase=uMotionEnabled>.5?uBodyPhase:uTime*(abs(uSpecies-19.)<.1?3.1:3.)+uSpecies;
          float amplitude=uMotionEnabled>.5?uBodyAmplitude:.045;
          return sin(phase+x*3.2)*(.5-.5*smoothstep(-1.,.4,x))*amplitude*(abs(uSpecies-23.)<.1?1.+uFishFeed*1.3:1.);
        }
        vec3 wingMotion(vec3 p){
          float wing=pow(abs(p.z)/1.65,1.8),phase=uMotionEnabled>.5?uWingPhase:uTime*2.2,amplitude=uMotionEnabled>.5?uWingAmplitude:.13;
          p.y+=sin(phase+p.x*1.8)*wing*amplitude;
          if(abs(uSpecies-22.)<.1){
            float fold=uFishFeed*.72+(uMotionEnabled>.5?uWingFold:0.);
            p.y+=fold*wing;p.x+=fold*wing*(.23/.72);p.z*=1.-fold*wing*(.27/.72);
          }
          return p;
        }
        float bodyPuff(float x){return(uFishFeed*.11+(uMotionEnabled>.5?uBodyPuff:0.))*(1.-smoothstep(.2,.65,x));}
        void main(){
          vLocal=aPosition;vec3 p=aPosition;
          if(uMaterial>12.5&&uMaterial<13.5&&abs(uSpecies-10.)>.1){
            float wave=bodyWave(p.x);if(abs(uSpecies-19.)<.1)p.y+=wave;else p.z+=wave;
            if(abs(uSpecies-20.)<.1){float puff=bodyPuff(p.x);p.y+=(p.y+.16)*puff;p.z*=1.+puff;}
          }
          if(uMaterial>15.5&&uMaterial<16.5)p=wingMotion(p);
          if(uMaterial>13.5&&uMaterial<14.5&&abs(uSpecies-19.)>.1){
            float phase=uMotionEnabled>.5?uFinPhase:uTime*3.2+uSpecies,amplitude=uMotionEnabled>.5?uFinAmplitude:.055;
            p.z+=sin(phase+aUv.y*4.)*aUv.x*amplitude;
          }
          // Jewellery uses the same deformation in the body's coordinates.
          if(uMaterial>21.5&&uMaterial<24.5&&uSpecies>=0.){
            if(abs(uSpecies-22.)<.1)p=wingMotion(p);
            else{
              float dx=abs(uSpecies-19.)<.1?1.12:abs(uSpecies-20.)<.1?.76:abs(uSpecies-21.)<.1?.80:1.;
              float dz=abs(uSpecies-20.)<.1?.59:abs(uSpecies-21.)<.1?.61:1.,px=p.x/dx,wave=bodyWave(px);
              if(abs(uSpecies-19.)<.1)p.y+=wave*.54;else p.z+=wave*dz;
              if(abs(uSpecies-20.)<.1){float puff=bodyPuff(px);p.y+=(p.y+.1056)*puff;p.z*=1.+puff;}
            }
          }
          if(uMaterial>25.5&&uMaterial<26.5){float edge=max(abs(p.x),abs(p.z));p.y+=.003*sin(p.x*6.+uTime*.32)*cos(p.z*7.-uTime*.27)*(1.-smoothstep(.90,1.,edge));}
          vec4 world=uModel*vec4(p,1.);vWorld=world.xyz;vUv=uUvRect.xy+aUv*uUvRect.zw;
          vec3 s=vec3(dot(uModel[0].xyz,uModel[0].xyz),dot(uModel[1].xyz,uModel[1].xyz),dot(uModel[2].xyz,uModel[2].xyz));
          vNormal=normalize(mat3(uModel)*(aNormal/max(s,vec3(.0001))));gl_Position=uView*world;vScreen=gl_Position.xy/gl_Position.w*.5+.5;
        }`);
      const fragmentPrecision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT)?.precision?'highp':'mediump';
      const fragment=shader(gl.FRAGMENT_SHADER,`
        precision ${fragmentPrecision} float;
        ${lighting?.fragment||'uniform float uShadowPass;vec4 fishingDepth(float d){return vec4(1.);}float fishingVisibility(vec3 p,vec3 n,vec3 l){return 1.;}'}
        varying vec3 vNormal; varying vec3 vWorld; varying vec3 vLocal; varying vec2 vUv,vScreen;
        uniform vec3 uColor; uniform vec3 uEye; uniform vec3 uAccent; uniform mediump float uSpecies;
        uniform float uAlpha,uWater,uTextured,uAquarium; uniform mediump float uTime,uMaterial;
        uniform sampler2D uAtlas; uniform vec4 uRipples[8]; uniform vec3 uSwimmers[5];
        float randomAt(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*4375.8);}
        float grain(vec2 p){vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(randomAt(cell),randomAt(cell+vec2(1.,0.)),f.x),mix(randomAt(cell+vec2(0.,1.)),randomAt(cell+vec2(1.,1.)),f.x),f.y);}
        ${aquarium&&lighting?.fragment?`
        // The same animated meshes cast onto the sand and the transparent desk
        // receiver. Blocker distance widens the penumbra; feet stay crisp.
        float aquariumVisibility(vec3 world,vec3 normal,vec3 light){
          if(uShadowEnabled<.5)return 1.;
          vec3 p=(uLightView*vec4(world,1.)).xyz*.5+.5;
          if(p.x<=.015||p.x>=.985||p.y<=.015||p.y>=.985||p.z<=0.||p.z>=1.)return 1.;
          float bias=uShadowBias*(.4+1.6*(1.-max(0.,dot(normalize(normal),normalize(light))))),blocker=0.,count=0.;
          for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
            float depth=dot(texture2D(uShadowMap,p.xy+vec2(float(x),float(y))*.009).rg,vec2(1.,1./255.));
            if(depth<p.z-bias){blocker+=depth;count+=1.;}
          }
          if(count<.5)return fishingVisibility(world,normal,light);
          float separation=max(0.,p.z-blocker/count)*22.,radius=max(uShadowTexel*1.1,(.008+separation*.070)/7.4),lit=0.,weight=0.;
          for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
            vec2 offset=vec2(float(x),float(y))*.5;float w=exp(-dot(offset,offset)*1.25);
            float depth=dot(texture2D(uShadowMap,p.xy+offset*radius).rg,vec2(1.,1./255.));
            lit+=step(p.z-bias,depth)*w;weight+=w;
          }
          return lit/weight;
        }`:'float aquariumVisibility(vec3 world,vec3 normal,vec3 light){return fishingVisibility(world,normal,light);}' }
        float aquariumFootprint(vec2 p,vec2 size,float radius){vec2 q=abs(p)-size+radius;return length(max(q,0.))+min(max(q.x,q.y),0.)-radius;}
        void main(){
          if(uShadowPass>.5){gl_FragColor=fishingDepth(gl_FragCoord.z);return;}
          if(uTextured>.5){vec4 tex=texture2D(uAtlas,vUv);if(tex.a<.12)discard;if(uWater>.5){vec2 p=vWorld.xz;float a=atan(p.y,p.x),shore=2.11+sin(a*3.+.7)*.13+sin(a*7.-.4)*.028;if(length(p*vec2(1.,1.035))>shore)discard;tex.rgb=mix(tex.rgb,uColor,.55);}gl_FragColor=vec4(tex.rgb,tex.a*uAlpha);return;}
          vec3 n=normalize(vNormal),sun=normalize(vec3(-.62,1.,-.68)),sight=normalize(uEye-vWorld);float key=max(dot(n,sun),0.);vec3 c=uColor*(vec3(.38,.47,.48)+vec3(.68,.58,.43)*key);float alpha=uAlpha;
          if(uAquarium>.5&&uMaterial>39.5&&uMaterial<40.5){
            // No coloured floor is drawn: only the lost light is composited
            // onto the user's wallpaper, with premultiplied alpha blending.
            float occlusion=(1.-aquariumVisibility(vWorld,n,sun))*.37;
            float skirt=aquariumFootprint(vWorld.xz,vec2(2.38,1.38),.13);
            float ambient=exp(-max(skirt,0.)*max(skirt,0.)/ .014)*.14;
            float contact=0.;
            for(int x=-1;x<=1;x+=2)for(int z=-1;z<=1;z+=2){
              float gap=max(0.,aquariumFootprint(vWorld.xz-vec2(float(x)*1.80,float(z)*1.),vec2(.27,.20),.06));
              contact=max(contact,exp(-gap*gap/.0028)*.46);
            }
            // Light passing through clear water remains mostly transmitted.
            // Ray/box intersection supplies a quiet, directionally correct
            // absorption shadow beyond the opaque walnut plinth.
            vec3 low=(vec3(-2.255,-1.10,-1.256)-vWorld)/sun,high=(vec3(2.255,1.14,1.256)-vWorld)/sun;
            vec3 nearHit=min(low,high),farHit=max(low,high);
            float entry=max(nearHit.x,max(nearHit.y,nearHit.z)),exit=min(farHit.x,min(farHit.y,farHit.z));
            float waterLength=max(0.,exit-max(entry,0.)),transmitted=(1.-exp(-waterLength*.022));
            alpha=1.-(1.-occlusion)*(1.-ambient)*(1.-contact)*(1.-transmitted);
            // All penumbrae finish inside the transparent drawing surface;
            // neither the desktop window nor the native hit contour grows.
            alpha*=smoothstep(0.,.065,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
            alpha*=smoothstep(.008,.038,min(min(vScreen.x,1.-vScreen.x),min(vScreen.y,1.-vScreen.y)));
            gl_FragColor=vec4(vec3(.024,.031,.030),alpha*uAlpha);return;
          }
          if(uMaterial>.5&&uMaterial<3.5){vec2 p=vWorld.xz+vWorld.y*.31;float patch=grain(p*3.),detail=grain(p*22.);c*=.9+patch*.14+detail*.035;if(uMaterial>1.5&&uMaterial<2.5){c=mix(c,vec3(.44,.52,.28),smoothstep(.64,.86,patch)*.14);float d=length(vWorld.xz*vec2(1.,1.035)),a=atan(vWorld.z,vWorld.x),shore=2.11+sin(a*3.+.7)*.13+sin(a*7.-.4)*.028;float wet=1.-smoothstep(.01,.13,d-shore);float grassLine=smoothstep(.10,.38,vUv.x+(patch-.5)*.30+.12*sin(a*2.+.8));vec3 sand=mix(vec3(.46,.45,.33),vec3(.72,.68,.51),smoothstep(0.,.22,vUv.x));sand*=.97+detail*.055;c=mix(sand,c,grassLine);c*=1.-wet*.12;}if(uMaterial>2.5)c=mix(c,vec3(.31,.4,.25),(1.-smoothstep(.18,.35,patch))*.22);}
          if(uMaterial>3.5&&uMaterial<4.5){float sheen=pow(max(0.,dot(reflect(-sun,n),sight)),40.);c+=vec3(.10,.12,.10)*sheen;c*=.97+.04*grain(vWorld.xz*65.+vWorld.y*30.);c=mix(c,vec3(.32,.48,.45),clamp(-vWorld.y*.14,0.,.10));}
          if(uMaterial>4.5&&uMaterial<5.5){float streak=grain(vec2(vWorld.x*3.+vWorld.y*.5,vWorld.z*42.+vWorld.y*5.));c*=.84+.2*streak;c+=vec3(.03,.022,.012)*pow(key,4.);}
          if(uMaterial>5.5&&uMaterial<6.5){float mottling=grain(vWorld.xz*13.+vWorld.y*7.);c*=.88+mottling*.19;c+=uColor*.11*max(dot(-n,sun),0.);}
          if(uMaterial>32.5&&uMaterial<33.5){float masses=grain(vLocal.xz*4.+vLocal.y*2.3),leaves=grain(vLocal.xz*27.+vLocal.y*17.);vec3 softNormal=normalize(mix(normalize(vLocal),n,.32));float upward=smoothstep(-.6,.85,softNormal.y),leafLight=max(dot(softNormal,sun),0.);c=uColor*(.62+.28*leafLight+.17*upward);c*=.92+masses*.10+leaves*.065;c+=vec3(.055,.070,.029)*smoothstep(.64,.84,masses)*upward;}
          if(uMaterial>33.5&&uMaterial<34.5){float glaze=pow(max(0.,dot(reflect(-sun,n),sight)),76.),pool=grain(vLocal.xz*8.+vLocal.y*3.);c=uColor*(.64+.37*key)*(.95+pool*.075);c+=vec3(.24,.29,.25)*glaze;float crazing=1.-smoothstep(.005,.020,abs(grain(vLocal.xy*13.+grain(vLocal.yz*6.))-.53));c*=1.-crazing*.035;}
          if(uMaterial>34.5&&uMaterial<35.5){float fresnel=pow(1.-abs(dot(n,sight)),2.7),shine=pow(max(0.,dot(reflect(-sun,n),sight)),105.),window=exp(-pow((n.x+n.y*.25+.36)/.08,2.));c=mix(uColor,vec3(.97,.99,.95),fresnel*.45+window*.55);alpha=uAlpha*(.065+fresnel*.47+window*.21+shine*.22);c+=vec3(.22)*shine;}
          if(uMaterial>35.5&&uMaterial<36.5){float oxidation=smoothstep(.49,.76,grain(vLocal.xz*8.+vLocal.y*11.)),brush=grain(vLocal.xy*110.);c=mix(uColor,vec3(.18,.40,.35),oxidation*.72)*(.55+.42*key);c+=vec3(.27,.20,.09)*pow(max(dot(reflect(-sun,n),sight),0.),38.);c*=.976+brush*.035;}
          if(uMaterial>36.5&&uMaterial<37.5){float rib=pow(.5+.5*cos(vUv.y*94.25),8.),stria=.5+.5*sin(vUv.x*230.+vUv.y*17.);c=uColor*(.63+.36*key);c*=.93+rib*.055+stria*.025;c+=vec3(.21,.17,.20)*pow(max(dot(reflect(-sun,n),sight),0.),42.);float iridescence=pow(1.-abs(dot(n,sight)),2.);c+=vec3(.04,.10,.13)*iridescence;}
          if(uMaterial>37.5&&uMaterial<38.5){float bed=grain(vWorld.xz*5.),strata=.5+.5*sin(vWorld.y*145.+grain(vWorld.xz*11.)*3.);c=uColor*(.62+.38*key)*(.91+bed*.12+strata*.025);c+=vec3(.04,.06,.07)*pow(max(dot(reflect(-sun,n),sight),0.),34.);}
          if(uMaterial>38.5&&uMaterial<39.5){float facet=grain(vWorld.xz*8.),crack=1.-smoothstep(.008,.027,abs(grain(vWorld.xz*5.)-.50));c=uColor*(.68+.35*key);c+=vec3(.13,.18,.21)*pow(max(dot(reflect(-sun,n),sight),0.),56.);c=mix(c,vec3(.89,.98,.97),crack*.26);c*=.96+facet*.055;}
          if(uMaterial>6.5&&uMaterial<7.5){float mineral=grain(vWorld.xz*29.+vWorld.y*17.);c*=.91+.13*mineral;float wet=1.-smoothstep(.05,.3,vWorld.y);c*=1.-wet*.16;c+=vec3(.045)*pow(max(dot(reflect(-sun,n),sight),0.),24.)*wet;}
          if(uMaterial>7.5&&uMaterial<8.5){float weave=sin(vWorld.y*125.)*sin((vWorld.x+vWorld.z)*97.);c*=.9+weave*.05;}
          if(uMaterial>8.5&&uMaterial<9.5){vec2 q=(vUv-.5)*2.;float soft=exp(-dot(q,q)*3.7)*(1.-smoothstep(.75,1.,length(q)));gl_FragColor=vec4(uColor,soft*uAlpha);return;}
          if(uMaterial>9.5&&uMaterial<10.5){float metal=pow(max(dot(reflect(-sun,n),sight),0.),45.);c+=vec3(.24,.2,.12)*metal;}
          if(uMaterial>10.5&&uMaterial<11.5)c=uColor*1.12;
          if(uMaterial>11.5&&uMaterial<12.5){float bark=grain(vec2(atan(n.z,n.x)*7.+vWorld.y*.3,vWorld.y*2.));c*=.83+.22*bark;}
          if(uMaterial>12.5&&uMaterial<13.5){
            float oddGlow=0.;
            float belly=1.-smoothstep(-.78,.15,vLocal.y),back=smoothstep(.22,.88,vLocal.y),side=1.-abs(n.y);
            vec3 body=mix(uColor,mix(vec3(.99,.96,.85),uColor,.18),belly*.76);body*=1.-back*.18;
            if(abs(uSpecies-8.)<.1){float crown=(1.-smoothstep(.54,.61,length(vec2((vLocal.x-.55)*2.6,vLocal.z*2.2))))*smoothstep(.40,.57,vLocal.y);body=mix(vec3(.97,.95,.86),uAccent*.97,crown);}
            if(abs(uSpecies-13.)<.1)body=mix(body,vec3(.97,.66,.78),smoothstep(.43,.65,grain(vLocal.xy*3.7))*.65);
            if(abs(uSpecies-4.)<.1){body=mix(body,uAccent,(1.-smoothstep(.045,.24,abs(vLocal.y+.03)))*.8);vec2 dots=vLocal.xy*vec2(21.,13.);float spot=(1.-smoothstep(.10,.2,length(fract(dots)-.5)))*step(.39,randomAt(floor(dots)));body*=1.-spot*.51*(1.-belly*.7);}
            if(abs(uSpecies-3.)<.1){float bars=pow(max(0.,sin((vLocal.x+.83)*22.+vLocal.y*.22)),4.);body*=1.-bars*.44*smoothstep(-.65,.12,vLocal.y);}
            if(abs(uSpecies-6.)<.1){float waves=pow(max(0.,sin((vLocal.x+.9)*35.+sin(vLocal.y*11.)*1.2)),5.);body*=1.-waves*.52*smoothstep(.02,.43,vLocal.y);}
            if(abs(uSpecies-5.)<.1){float dots=(1.-smoothstep(.04,.085,length(vec2(fract(vLocal.x*8.)-.5,(vLocal.y-.19)*3.))))*step(vLocal.x,.4);body*=1.-dots*.36;}
            if(abs(uSpecies-11.)<.1){float arcs=pow(.5+.5*cos(length(vec2((vLocal.x+.49)*1.12,vLocal.y*.86))*28.),10.);body=mix(mix(vec3(.31,.60,.79),uColor,.48),vec3(.78,.87,.98),arcs*.79);}
            if(abs(uSpecies-0.)<.1||abs(uSpecies-5.)<.1||abs(uSpecies-6.)<.1)body=mix(body,vec3(.82,.91,.89),(1.-smoothstep(.04,.16,abs(vLocal.y+.08)))*.48);
            vec2 scaleUv=vUv*vec2(20.,18.);float row=floor(scaleUv.y),longitudinal=fract(scaleUv.x+row*.5)-.13,arc=length(vec2(longitudinal,(fract(scaleUv.y)-.5)*1.08)),exposed=smoothstep(.0,.10,longitudinal),seam=(1.-smoothstep(.020,.073,abs(arc-.49)))*exposed,lip=(1.-smoothstep(.015,.076,abs(arc-.41)))*exposed,scaled=(1.-smoothstep(.38,.70,vLocal.x))*(1.-smoothstep(.91,1.,vUv.x));
            if(abs(uSpecies-7.)<.1||abs(uSpecies-10.)<.1||abs(uSpecies-12.)<.1||abs(uSpecies-15.)<.1||abs(uSpecies-17.)<.1||abs(uSpecies-19.)<.1||uSpecies>19.5)scaled=0.;
            float scaleContrast=(abs(uSpecies-1.)<.1||abs(uSpecies-2.)<.1||abs(uSpecies-9.)<.1)?.105:.042;body*=1.-seam*scaleContrast*scaled;body+=mix(uAccent,vec3(1.,.97,.83),.55)*lip*scaleContrast*.55*scaled;
            if(abs(uSpecies-15.)<.1){body=mix(body,vec3(.83,.97,1.),belly*.35);body+=vec3(.035,.06,.065)*pow(max(0.,sin(vLocal.x*6.+vLocal.y*2.)),4.);}
            if(abs(uSpecies-18.)<.1){float dorsal=.5+.5*cos(vUv.y*6.283185),jadeCloud=grain(vUv*vec2(14.,8.));body=mix(vec3(.66,.74,.42),vec3(.12,.45,.32),smoothstep(.12,.70,dorsal));body=mix(body,vec3(.065,.27,.27),smoothstep(.65,.98,dorsal)*.60);body+=vec3(.025,.053,.027)*(jadeCloud-.5);vec2 scales=vUv*vec2(35.,12.);float row=floor(scales.y),along=fract(scales.x+row*.5)-.16,across=(fract(scales.y)-.5)*1.08,r=length(vec2(along,across)),seam=(1.-smoothstep(.017,.064,abs(r-.49)))*smoothstep(.01,.13,along),overlap=(1.-smoothstep(.013,.058,abs(r-.42)))*smoothstep(.01,.13,along),mask=smoothstep(.09,.19,vUv.x)*(1.-smoothstep(.88,.98,vUv.x));body*=1.-seam*mask*.14;body=mix(body,uAccent,overlap*mask*.27);}
            if(abs(uSpecies-12.)<.1||abs(uSpecies-17.)<.1||abs(uSpecies-19.)<.1){float nebula=grain(vLocal.xy*4.+vLocal.z);body=mix(uColor*.36,uColor*.83,nebula);vec2 stars=vUv*vec2(38.,25.),starCell=floor(stars),starCenter=vec2(.20+.60*randomAt(starCell),.20+.60*randomAt(starCell+vec2(3.,9.)));float speck=(1.-smoothstep(.040,.12,length(fract(stars)-starCenter)))*step(.69,randomAt(starCell+vec2(4.,1.)))*(1.-smoothstep(.60,.82,vLocal.x));body+=mix(uAccent,vec3(1.,.98,.8),.35)*speck*.9;if(abs(uSpecies-19.)<.1)body=mix(body,vec3(.89,.88,.79),belly*.93);}
            if(abs(uSpecies-19.)<.1){float cloud=grain(vLocal.xy*2.4+vLocal.z*.7),veil=grain(vLocal.xy*6.+cloud*.4),milk=1.-smoothstep(-.48,.20,vLocal.y);body=mix(vec3(.095,.14,.29),vec3(.27,.30,.49),cloud);body=mix(body,vec3(.38,.32,.53),smoothstep(.55,.81,veil)*.27);body=mix(body,vec3(.85,.88,.82),milk*.96);vec2 stars=vUv*vec2(34.,23.),cell=floor(stars),center=vec2(.22+.56*randomAt(cell),.22+.56*randomAt(cell+vec2(8.,3.)));float speck=(1.-smoothstep(.030,.090,length(fract(stars)-center)))*step(.83,randomAt(cell+vec2(1.,7.)))*(1.-smoothstep(.55,.77,vLocal.x))*(1.-milk);body+=vec3(.65,.79,.77)*speck*.74;body*=.985+grain(vUv*vec2(124.,78.))*.022;}
            if(abs(uSpecies-12.)<.1){float mouthY=-.22+.13*pow(abs(vLocal.z),1.4),opening=.042*(1.-smoothstep(.43,.78,abs(vLocal.z))),front=smoothstep(.59,.71,vLocal.x),slit=(1.-smoothstep(opening,opening+.019,abs(vLocal.y-mouthY)))*front,lower=(1.-smoothstep(.010,.036,abs(vLocal.y-mouthY+.065)))*front*(1.-smoothstep(.48,.79,abs(vLocal.z)));body=mix(body,vec3(.09,.12,.15),slit*.90);body=mix(body,mix(body,uAccent,.32),lower*.58);}
            if(abs(uSpecies-7.)<.1){float mouthY=-.13+.085*vLocal.z*vLocal.z,front=smoothstep(.72,.82,vLocal.x),slit=(1.-smoothstep(.026,.048,abs(vLocal.y-mouthY)))*front*(1.-smoothstep(.51,.80,abs(vLocal.z)));body=mix(body,vec3(.20,.27,.29),slit*.76);}
            if(abs(uSpecies-20.)<.1){
              float pearl=1.-smoothstep(-.75,.37,vLocal.y),cloud=grain(vLocal.xy*4.+vLocal.z*.7);body=mix(vec3(.44,.36,.65),vec3(.72,.67,.84),1.-smoothstep(.08,.95,vLocal.y));body=mix(body,vec3(.91,.86,.72),pearl*.90);body=mix(body,vec3(.74,.79,.86),(cloud-.35)*.13);
              float front=smoothstep(.35,.71,vLocal.x),mouthY=-.19+.16*pow(abs(vLocal.z),1.5);vec2 mouthCoord=vec2(vLocal.z/.63,(vLocal.y-mouthY)/.076);float mouthR=dot(mouthCoord,mouthCoord),gape=(1.-smoothstep(.72,1.18,mouthR))*front,lip=(1.-smoothstep(.05,.42,abs(mouthR-1.24)))*front;body=mix(body,vec3(.23,.17,.27),gape*.92);body=mix(body,vec3(.79,.66,.72),lip*.19);
              float jowl=(1.-smoothstep(.019,.060,abs(vLocal.y+.32+vLocal.z*vLocal.z*.24)))*smoothstep(.40,.64,vLocal.x)*(1.-smoothstep(.79,.91,vLocal.x));body*=1.-jowl*.10;
              vec2 moon=vec2((vLocal.x-.15)*2.22,(vLocal.y+.57)*2.28);float moonR=length(moon),moonFalloff=exp(-moonR*moonR*1.15),crescent=(1.-smoothstep(.73,.87,moonR))*smoothstep(.57,.75,length(moon-vec2(.28,.15)));body=mix(body,vec3(.98,.87,.57),moonFalloff*.19+crescent*.42);oddGlow=moonFalloff*.035+crescent*(.08+.018*sin(uTime*1.8));
              float pores=grain(vUv*vec2(155.,92.)),freckles=pow(max(0.,grain(vUv*vec2(39.,25.))-.49)*1.96,3.)*smoothstep(-.3,.45,vLocal.y)*(1.-smoothstep(.58,.9,vLocal.x));body*=.98+pores*.025-freckles*.12;body+=vec3(.055,.047,.085)*freckles;
            }
            if(abs(uSpecies-21.)<.1){
              float jade=grain(vLocal.xy*3.5+vLocal.z*.6),jadeFine=grain(vUv*vec2(65.,47.));body=mix(vec3(.22,.40,.34),vec3(.47,.65,.48),jade*.76+smoothstep(.02,.83,vLocal.y)*.17);body=mix(body,vec3(.78,.77,.50),(1.-smoothstep(-.67,.19,vLocal.y))*.70);float front=smoothstep(.47,.75,vLocal.x),mouthY=-.12-.19*abs(vLocal.z),frown=(1.-smoothstep(.026,.056,abs(vLocal.y-mouthY)))*front*(1.-smoothstep(.54,.83,abs(vLocal.z)));body=mix(body,vec3(.18,.25,.19),frown*.84);
              float creaseA=(1.-smoothstep(.012,.040,abs(vLocal.y-(.47+.055*sin(vLocal.x*7.+vLocal.z*.9)))))*(1.-smoothstep(.16,.45,abs(vLocal.x-.65))),creaseB=(1.-smoothstep(.014,.042,abs(vLocal.y-(.73+.037*sin(vLocal.x*10.-vLocal.z*2.)))))*(1.-smoothstep(.12,.32,abs(vLocal.x-.29))),creaseC=(1.-smoothstep(.014,.044,abs(vLocal.y-(.92-.035*cos(vLocal.x*6.+vLocal.z)))))*(1.-smoothstep(.07,.23,abs(vLocal.x-.50)));body*=1.-creaseA*.085-creaseB*.062-creaseC*.045;
              float brow=(1.-smoothstep(.023,.064,abs(vLocal.y-(.33-.29*(vLocal.x-.69)))))*(1.-smoothstep(.10,.24,abs(vLocal.x-.72)));body*=1.-brow*.21;
              float fault=grain(vLocal.xy*5.7+grain(vLocal.yz*4.)*.35),vein=(1.-smoothstep(.018,.061,abs(fault-.50)))*smoothstep(.48,.71,grain(vLocal.yz*3.+2.))*(1.-smoothstep(.57,.82,vLocal.x));body=mix(body,uAccent,vein*.25);body*=.98+jadeFine*.04;oddGlow=vein*.042;
            }
            if(abs(uSpecies-23.)<.1){
              float dorsal=.5+.5*cos(vUv.y*6.283185),eelCloud=grain(vUv*vec2(13.,8.));body=mix(vec3(.67,.83,.70),vec3(.24,.49,.56),smoothstep(.08,.52,dorsal));body=mix(body,vec3(.15,.24,.40),smoothstep(.50,.96,dorsal)*.88);body+=vec3(.028,.055,.047)*(eelCloud-.5);float mouthY=.347+.09*vLocal.z*vLocal.z,front=smoothstep(.69,.87,vLocal.x),slit=(1.-smoothstep(.026,.052,abs(vLocal.y-mouthY)))*front;body=mix(body,vec3(.12,.22,.26),slit*.92);
              float cheek=(1.-smoothstep(.015,.045,abs(vLocal.y-.29+.15*vLocal.z*vLocal.z)))*smoothstep(.45,.63,vLocal.x)*(1.-smoothstep(.76,.87,vLocal.x));body=mix(body,vec3(.67,.69,.61),cheek*.22);float pathA=.20+.035*sin(vUv.x*10.),pathB=.80+.029*sin(vUv.x*12.+1.4),track=(1.-smoothstep(.003,.012,min(abs(vUv.y-pathA),abs(vUv.y-pathB))))*smoothstep(.08,.20,vUv.x)*(1.-smoothstep(.79,.96,vUv.x));float starDistance=length(vec2((fract(vUv.x*7.5)-.5)*.43,min(abs(vUv.y-pathA),abs(vUv.y-pathB))*4.)),wish=(1.-smoothstep(.015,.048,starDistance))*smoothstep(.13,.22,vUv.x);body=mix(body,uAccent,track*.31+wish*.50);body*=.98+grain(vUv*vec2(110.,37.))*.025;oddGlow=wish*.09+track*.018;
            }
            c=body*(vec3(.52,.55,.57)+vec3(.54,.47,.38)*key);
            float sheen=pow(max(0.,dot(reflect(-sun,n),sight)),28.),rim=pow(1.-max(dot(n,sight),0.),3.);c+=vec3(.17,.19,.18)*sheen+uAccent*rim*.10;
            if(uSpecies>13.5)c+=uAccent*(.035+.025*sin(uTime*1.7+vLocal.x*4.))*rim;
            c+=uAccent*oddGlow;
            if(uSpecies>17.5&&uSpecies<19.5){float wet=pow(max(0.,dot(reflect(-sun,n),sight)),64.),pearlRim=pow(1.-max(0.,dot(n,sight)),2.8);c=body*(vec3(.56,.61,.63)+vec3(.49,.42,.32)*key)+vec3(.20,.24,.21)*wet+mix(vec3(.30,.47,.51),uAccent,.22)*pearlRim*.15;}
            if(uSpecies>19.5){float rough=grain(vUv*vec2(83.,59.)),wet=pow(max(0.,dot(reflect(-sun,n),sight)),63.+rough*24.),pearlRim=pow(1.-max(0.,dot(n,sight)),2.7);c=body*(vec3(.59,.62,.64)+vec3(.49,.42,.33)*key)+vec3(.25,.28,.25)*wet+mix(vec3(.27,.39,.53),uAccent,.26)*pearlRim*.19+uAccent*oddGlow;}
          }
          if((uMaterial>13.5&&uMaterial<14.5)||(uMaterial>15.5&&uMaterial<16.5)){
            float rays=pow(.5+.5*cos(vUv.y*201.),10.),veins=pow(.5+.5*cos(vUv.y*100.5),16.),edge=smoothstep(.79,1.,vUv.x);
            vec3 silk=mix(uColor*.83,mix(uColor,vec3(1.,.96,.88),.30),vUv.x);c=silk*(.77+.23*abs(dot(n,sun)));c+=mix(uAccent,vec3(.94,.94,.87),.55)*(rays*.13+veins*.055+edge*.10);alpha*=.72+rays*.14+edge*.09;
            if(abs(uSpecies-4.)<.1){float dots=(1.-smoothstep(.07,.13,length(fract(vUv*vec2(11.,9.))-.5)))*step(.35,randomAt(floor(vUv*vec2(11.,9.))));c*=1.-dots*.33;}
            if(abs(uSpecies-18.)<.1){float rib=pow(.5+.5*cos(vUv.y*94.248+vUv.x*.5),17.);c=mix(vec3(.12,.42,.31),uAccent,smoothstep(.66,.99,vUv.x)*.83)*(.73+.27*abs(dot(n,sun)));c+=uAccent*rib*.12;alpha=uAlpha*(.80+edge*.15);}
            if(abs(uSpecies-19.)<.1){c=mix(vec3(.12,.19,.35),vec3(.27,.34,.52),vUv.x*.62)*(.67+.33*key);c+=vec3(.18,.23,.25)*pow(max(dot(reflect(-sun,n),sight),0.),53.);c+=vec3(.35,.48,.54)*pow(1.-max(0.,dot(n,sight)),3.)*.14;alpha=1.;}
            if(uMaterial<14.5&&uSpecies>19.5){float rib=pow(.5+.5*cos(vUv.y*69.115+sin(vUv.x*3.5)*.36),18.),branch=pow(.5+.5*cos(vUv.y*138.23+vUv.x*8.),20.)*smoothstep(.42,.88,vUv.x),hem=(1.-smoothstep(.025,.09,abs(vUv.x-.92)));vec3 rootTone=abs(uSpecies-20.)<.1?vec3(.48,.43,.67):abs(uSpecies-21.)<.1?vec3(.25,.45,.34):vec3(.19,.47,.52),tipTone=abs(uSpecies-20.)<.1?vec3(.88,.82,.73):abs(uSpecies-21.)<.1?vec3(.80,.78,.45):vec3(.79,.85,.65);c=mix(rootTone,tipTone,pow(vUv.x,.82))*(.69+.31*abs(dot(n,sun)));c+=mix(tipTone,uAccent,.4)*(rib*.15+branch*.06+hem*.09);c*=1.-rib*.07*(1.-vUv.x);alpha=uAlpha*(.72+.25*(1.-vUv.x)+rib*.06);}
            if(uMaterial>15.5){float dust=(1.-smoothstep(.05,.13,length(fract(vUv*vec2(25.,20.))-.5)))*step(.6,randomAt(floor(vUv*vec2(25.,20.))));c=mix(uColor*.58,uAccent,.2+vUv.y*.12)+uAccent*dust*.72;if(vUv.y>1.)c=mix(vec3(.86,.87,.84),uAccent,.12);else c*=.68+.32*key;alpha=uAlpha;}
            if(uMaterial>15.5&&abs(uSpecies-22.)<.1){
              float vv=vUv.y>1.?vUv.y-2.:vUv.y,s=abs(vv*2.-1.),wing=smoothstep(.29,.96,s),rim=smoothstep(.77,.995,s),cloud=grain(vLocal.xz*3.6),fan=atan(vLocal.x+.17,abs(vLocal.z)+.17),rib=pow(.5+.5*cos(fan*33.+abs(vLocal.z)*1.2),20.)*smoothstep(.25,.71,abs(vLocal.z)),fork=pow(.5+.5*cos(fan*66.+abs(vLocal.z)*5.),24.)*smoothstep(.82,1.40,abs(vLocal.z));vec3 rose=mix(vec3(.58,.33,.53),vec3(.77,.54,.69),cloud*.65+.20),pearl=vec3(.75,.90,.81),skin=mix(rose,pearl,wing*.68+rim*.21);skin+=vec3(.030,.020,.030)*sin(vLocal.x*8.+abs(vLocal.z)*3.)*wing;skin*=1.-rib*.055;skin+=pearl*(rib*.055+fork*.035);
              if(vUv.y>1.){skin=mix(skin,vec3(.83,.87,.77),(1.-rim)*smoothstep(.105,.29,vUv.x)*.79);float mouth=(1.-smoothstep(.007,.015,abs(vUv.x-(.151+.28*pow(vv-.5,2.)))))*(1.-smoothstep(.085,.14,abs(vv-.5)));skin=mix(skin,vec3(.37,.24,.32),mouth*.72);}else{vec2 vent=vec2((vUv.x-.315)/.028,(s-.186)/.052);float ventR=dot(vent,vent),spiracle=(1.-smoothstep(.32,1.,ventR));skin=mix(skin,vec3(.38,.24,.37),spiracle*.43);skin+=pearl*(1.-smoothstep(.07,.30,abs(ventR-1.15)))*.035;}
              float wet=pow(max(0.,dot(reflect(-sun,n),sight)),57.),glaze=pow(1.-max(0.,dot(n,sight)),2.7);c=skin*(.64+.36*abs(dot(n,sun)))+vec3(.19,.23,.22)*wet+pearl*glaze*.13;c*=.986+grain(vLocal.xz*67.)*.02;alpha=uAlpha;
            }
          }
          if(uMaterial>17.5&&uMaterial<18.5){float bubbleRim=pow(1.-max(0.,dot(n,sight)),2.4);c=mix(uColor,vec3(1.,.98,.87),bubbleRim*.44);alpha*=.12+bubbleRim*.82;}
          if(uMaterial>18.5&&uMaterial<19.5){float r=length(vLocal.xy),a=atan(vLocal.y,vLocal.x),fiber=pow(.5+.5*sin(a*39.+r*17.),3.),ring=(1.-smoothstep(.025,.13,abs(r-.69)));vec3 iris=mix(uColor,uAccent,.19+fiber*.25);iris=mix(iris,vec3(.055,.15,.17),smoothstep(.77,.98,r)*.85);c=iris*(.80+.20*key)+uAccent*ring*.17;c+=vec3(.25,.29,.26)*pow(max(dot(reflect(-sun,n),sight),0.),78.);}
          if(uMaterial>19.5&&uMaterial<20.5){float r=length(vLocal.xy),a=atan(vLocal.y,vLocal.x),rim=(1.-smoothstep(.017,.047,abs(r-.87))),marks=pow(.5+.5*cos(a*12.),20.)*(1.-smoothstep(.07,.16,abs(r-.66))),engrave=marks*(.72+.28*cos(r*64.));c=mix(vec3(.56,.34,.12),uColor,.67+.20*key);c*=1.-engrave*.22;c+=vec3(.30,.23,.11)*rim+vec3(.37,.28,.13)*pow(max(dot(reflect(-sun,n),sight),0.),54.);c+=uColor*.09;c*=.98+.025*grain(vUv*77.);}
          if(uMaterial>20.5&&uMaterial<21.5){float tip=smoothstep(.03,.95,vUv.x),rib=pow(.5+.5*cos(vLocal.y*139.+vUv.x*2.4),18.);c=mix(vec3(.25,.43,.35),vec3(.67,.75,.49),tip)*(.69+.31*key);c+=uAccent*rib*.10*tip;c+=vec3(.12,.18,.14)*pow(max(dot(reflect(-sun,n),sight),0.),40.);}
          if(uMaterial>21.5&&uMaterial<22.5){float shine=pow(max(dot(reflect(-sun,n),sight),0.),58.),rim=pow(1.-max(dot(n,sight),0.),3.);c=uColor*(.54+.52*key)+vec3(.45,.37,.21)*shine+vec3(.17,.13,.06)*rim;}
          if(uMaterial>22.5&&uMaterial<23.5){float cloud=grain(vLocal.xy*19.+vLocal.z*7.),rim=pow(1.-max(dot(n,sight),0.),2.4);c=mix(uColor*.67,uColor,cloud*.28+.52)*(.76+.26*key)+uColor*rim*.23+vec3(.36,.40,.31)*pow(max(dot(reflect(-sun,n),sight),0.),72.);}
          if(uMaterial>23.5&&uMaterial<24.5){float rim=pow(1.-max(dot(n,sight),0.),2.7),shine=pow(max(dot(reflect(-sun,n),sight),0.),61.);c=uColor*(.76+.26*key)+vec3(.29,.30,.26)*shine+mix(vec3(.20,.30,.36),vec3(.36,.23,.29),.5+.5*n.y)*rim*.24;}
          if(uMaterial>14.5&&uMaterial<15.5){float depth=smoothstep(.025,.66,-vWorld.y);c=mix(mix(uColor,vec3(.91,.92,.85),.47),uColor*.74,depth);c*=.96+grain(vWorld.xz*18.)*.075;float lightLace=pow(max(0.,sin(vWorld.x*11.+uTime*.3)*sin(vWorld.z*13.-uTime*.34)),7.);c+=vec3(.025,.065,.035)*lightLace;}
          if(uWater>.5){
            vec2 p=vWorld.xz;float a=atan(p.y,p.x),shore=2.11+sin(a*3.+.7)*.13+sin(a*7.-.4)*.028;
            float depth=smoothstep(.0,.7,shore-length(p*vec2(1.,1.035)));
            vec3 shallow=mix(uColor,vec3(.87,.90,.85),.48),deep=uColor*vec3(.62,.87,.89);
            c=mix(shallow,deep,depth);
            vec2 bent=p+vec2(sin(p.y*4.+uTime*.65),cos(p.x*3.-uTime*.54))*.023;
            float mineral=grain(bent*24.);c*=1.+(mineral-.5)*.1*(1.-depth);
            vec2 pebble=fract(bent*8.);float seed=grain(floor(bent*8.));
            float stone=(1.-smoothstep(.11,.2,length(pebble-.5)))*step(.66,seed)*(1.-depth)*.16;
            c=mix(c,vec3(.61,.67,.49),stone);
            n=normalize(vec3(-.07*cos(p.x*5.5+uTime*.8)-.035*sin(p.y*7.-uTime),1.,.06*sin(p.y*6.-uTime*.72)));
            float fresnel=.06+.26*pow(1.-max(0.,dot(n,sight)),3.);
            float cloud=grain(bent*.67+vec2(uTime*.014,0.));c=mix(c,vec3(.69,.77,.74),fresnel*(.5+cloud*.5));
            float reflection=pow(max(0.,dot(reflect(-sun,n),sight)),28.);
            c+=vec3(.15,.18,.13)*reflection;
            float caustic=sin(bent.x*10.+uTime*.4)*sin(bent.y*11.-uTime*.5);
            c+=vec3(.025,.05,.035)*max(0.,caustic)*(.4+.6*(1.-depth));
            float ribbon=(1.-smoothstep(.006,.032,abs(sin(bent.x*3.2+bent.y*2.1+uTime*.09)+sin(bent.y*2.8-uTime*.06)*.55)))*smoothstep(.63,.86,grain(bent*1.3));c+=vec3(.19,.25,.22)*ribbon*depth;float skyWindow=exp(-pow((bent.x*.45+bent.y*.75+.48)/.40,2.));c=mix(c,vec3(.74,.83,.76),skyWindow*.10*depth);
            for(int i=0;i<8;i++){float age=uTime-uRipples[i].z;if(age>=0.&&age<4.){float d=length(p-uRipples[i].xy),ring=d-age*.68-.035;float pulse=cos(ring*32.)*exp(-abs(ring)*12.)*exp(-age*.85)*uRipples[i].w;c+=vec3(.075,.11,.09)*pulse;}}
            for(int i=0;i<5;i++){float d=length((p-uSwimmers[i].xy)*vec2(1.,1.3));c*=1.-exp(-d*d*30.)*uSwimmers[i].z*.035;c+=vec3(.009,.018,.013)*sin(d*28.-uTime*3.)*exp(-d*6.)*uSwimmers[i].z;}
            alpha=uAlpha*(.64+.23*depth+fresnel*.7);
          }
          if(uAquarium>.5){
            if(uMaterial>24.5&&uMaterial<25.5){
              float facing=abs(dot(n,sight)),fresnel=pow(1.-facing,3.5),edge=max(abs(vUv.x-.5),abs(vUv.y-.5))*2.;
              float window=exp(-pow((vWorld.x+vWorld.y*.19+1.38)/.29,2.))*(.18+.82*smoothstep(-.9,1.1,vWorld.y));
              float windowFine=exp(-pow((vWorld.x+vWorld.y*.19+1.61)/.015,2.));
              c=mix(vec3(.57,.78,.75),vec3(.96,.98,.91),window*.42+fresnel*.40);
              alpha=uAlpha*(.025+fresnel*.28+window*.10+windowFine*.07+smoothstep(.978,1.,edge)*.10);
            }else if(uMaterial>25.5&&uMaterial<26.5){
              vec2 q=vWorld.xz;vec3 ripple=normalize(vec3(.018*sin(q.x*6.+uTime*.32)+.009*cos(q.y*9.-uTime*.24),1.,.016*cos(q.y*8.-uTime*.29)));
              float fresnel=pow(1.-abs(dot(ripple,sight)),3.),glint=pow(max(0.,dot(reflect(-sun,ripple),sight)),64.);
              float wave=.5+.5*sin(q.x*11.+q.y*6.+uTime*.28),ceiling=exp(-pow((q.x*.47+q.y*.72+.1+.025*sin(q.y*4.-uTime*.21))/.38,2.));c=mix(vec3(.50,.68,.63),vec3(.88,.95,.89),fresnel*.56)+vec3(.20,.24,.21)*glint;c=mix(c,vec3(.93,.96,.91),ceiling*.48);
              alpha=uAlpha*(.095+fresnel*.28+wave*.009+ceiling*.065);
            }else if(uMaterial>26.5&&uMaterial<27.5){
              vec2 q=(abs(n.y)>.5?vWorld.xz:abs(n.z)>.5?vWorld.xy:vWorld.zy)*110.;float grit=grain(q),fine=grain(q*2.8),grains=pow(max(0.,grain(q*.45)-.46)*1.9,3.);
              c=mix(vec3(.40,.37,.30),vec3(.79,.75,.64),grit*.49+.44)*( .78+.22*key);c*=.94+fine*.10-grains*.17;
            }else if(uMaterial>27.5&&uMaterial<28.5){
              float warp=grain(vec2(vWorld.x*1.4,vWorld.z*3.+vWorld.y))*1.1,grainLine=grain(vec2(vWorld.x*1.8+warp,vWorld.y*66.+vWorld.z*21.));
              float pore=pow(max(0.,grain(vec2(vWorld.x*3.2,vWorld.y*185.+vWorld.z*60.))-.52)*2.,3.);
              c=mix(vec3(.10,.065,.043),vec3(.28,.19,.13),grainLine*.59+.17)*( .72+.28*key);c*=1.-pore*.12;c+=vec3(.045,.036,.025)*pow(max(0.,dot(reflect(-sun,n),sight)),22.);
            }else if(uMaterial>28.5&&uMaterial<29.5){
              float brush=grain(vec2(vWorld.x*4.,vWorld.y*260.+vWorld.z*36.)),shine=pow(max(0.,dot(reflect(-sun,n),sight)),27.);
              c=uColor*(.64+.31*key)+vec3(.19,.17,.12)*shine;c*=.985+brush*.028;
            }else if(uMaterial>31.5&&uMaterial<32.5){
              float depth=smoothstep(-1.18,1.14,vWorld.y),light=exp(-pow((vWorld.x+.8)*.48,2.))*depth;
              c=mix(vec3(.15,.32,.31),vec3(.47,.69,.61),depth);c+=vec3(.035,.046,.026)*light;alpha=uAlpha*(.69+depth*.15);
            }
            if((uMaterial<24.5||abs(uMaterial-27.)<.5)&&vWorld.y<1.14&&vWorld.y>-1.18){vec2 p=vWorld.xz*4.3+vec2(sin(vWorld.z*1.7+uTime*.14),cos(vWorld.x*1.8-uTime*.11))*.33;float field=sin(p.x+sin(p.y*.8))+sin(p.y+sin(p.x*.73+uTime*.13)),lace=exp(-pow(field*5.7,2.)),gate=.60+.40*sin(p.x*.9-p.y*.7);c=mix(c,c*vec3(.94,1.01,1.01),.14);c+=vec3(.065,.087,.061)*lace*gate*max(0.,n.y);}
            if((uMaterial>24.5&&uMaterial<26.5)||uMaterial>31.5)alpha=clamp(alpha+(randomAt(gl_FragCoord.xy)-.5)/255.,0.,1.);
          }
          if(uMaterial>1.5&&uMaterial<2.5)alpha*=1.-smoothstep(.87,1.,vUv.x);
          if(!(uMaterial>10.5&&uMaterial<11.5)&&!(uAquarium>.5&&(uMaterial>24.5&&uMaterial<26.5||uMaterial>31.5&&uMaterial<32.5))){bool sand=uAquarium>.5&&uMaterial>26.5&&uMaterial<27.5;float visibility=sand?aquariumVisibility(vWorld,n,sun):fishingVisibility(vWorld,n,sun);c*=mix(uWater>.5?.84:sand?.57:uAquarium>.5?.68:.64,1.,visibility);}
          gl_FragColor=vec4(c,alpha);
        }`);
      program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Pond shader link failed.');
    }catch(error){if(program)gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();host.classList.remove('fishing-pond-host','fishing-aquarium-volume-host');return aquarium?null:createPondFallback(host,options);}
    const pos=gl.getAttribLocation(program,'aPosition'),normal=gl.getAttribLocation(program,'aNormal'),uv=gl.getAttribLocation(program,'aUv'),u={};for(const key of ['View','Model','Color','Alpha','Water','Time','UvRect','Textured','Atlas','Material','Eye','Accent','Species','FishFeed','Aquarium','MotionEnabled','BodyPhase','BodyAmplitude','FinPhase','FinAmplitude','WingPhase','WingAmplitude','WingFold','BodyPuff'])u[key]=gl.getUniformLocation(program,'u'+key);u.Ripples=gl.getUniformLocation(program,'uRipples[0]');u.Swimmers=gl.getUniformLocation(program,'uSwimmers[0]');
    gl.useProgram(program);shadowMap=lighting?.createShadowMap(gl,program,{size:1024,matrix:lighting.lightView(options.figureOnly?{extent:2.3,distance:7,far:15}:aquarium?{extent:3.7,distance:10,far:22}:{extent:4.7,distance:12,far:25}),bias:options.figureOnly?.00065:.0010});host.dataset.shadows=shadowMap?'pcf':'unavailable';
    function upload(g){const vertex=gl.createBuffer(),normals=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.p),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,normals);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.n),gl.STATIC_DRAW);buffers.push(vertex,normals);let textureCoords=null;if(g.uv){textureCoords=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,textureCoords);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.uv),gl.STATIC_DRAW);buffers.push(textureCoords);}return{vertex,normals,textureCoords,count:g.p.length/3};}
    const bankAnchors=decorations(),mesh={sphere:upload(sphereMesh()),fishStroke:upload(sphereMesh(6,10)),fin:upload(curvedFinMesh()),star:upload(ornamentMesh(false)),fishBody:upload(fishBodyMesh()),tail:upload(membraneMesh(false)),rayWing:upload(membraneMesh(true)),dorsalFin:upload(sculptedFinMesh(false)),flowFin:upload(sculptedFinMesh(true)),ribbonFin:upload(ribbonFinMesh()),dragonBody:upload(dragonBodyMesh())};
    if(!options.figureOnly&&!aquarium)Object.assign(mesh,{box:upload(boxMesh()),crystal:upload(crystalMesh()),crescent:upload(crescentJewelMesh()),soil:upload(bankMesh('soil',bankAnchors,pondStyle(options.pond))),grass:upload(bankMesh('grass',bankAnchors,pondStyle(options.pond))),stone:upload(bankMesh('stone',bankAnchors,pondStyle(options.pond))),floor:upload(bankMesh('floor',bankAnchors,pondStyle(options.pond))),water:upload(bankMesh('water',bankAnchors,pondStyle(options.pond))),sprite:upload(spriteMesh()),cylinder:upload(cylinderMesh()),rounded:upload(roundedBoxMesh()),organic:upload(organicMesh()),leaf:upload(leafMesh()),foliage:upload(foliageMesh()),tuft:upload(grassMesh()),disc:upload(discMesh()),basket:upload(basketMesh()),lily:upload(lilyMesh()),arch:upload(aquariumArchMesh()),shell:upload(aquariumShellMesh())});
    if(aquarium)Object.assign(mesh,{box:upload(boxMesh()),crystal:upload(crystalMesh()),crescent:upload(crescentJewelMesh()),cylinder:upload(cylinderMesh()),rounded:upload(roundedBoxMesh()),organic:upload(organicMesh()),leaf:upload(leafMesh()),disc:upload(discMesh()),panel:upload(aquariumPanelMesh()),waterSurface:upload(aquariumWaterMesh()),sand:upload(aquariumSandMesh()),arch:upload(aquariumArchMesh()),shell:upload(aquariumShellMesh())});
    function rebuildBank(){if(options.figureOnly||aquarium)return;const anchors=decorations();for(const key of ['soil','grass','stone']){const old=mesh[key];for(const buffer of [old.vertex,old.normals,old.textureCoords].filter(Boolean)){gl.deleteBuffer(buffer);buffers.splice(buffers.indexOf(buffer),1);}mesh[key]=upload(bankMesh(key,anchors,pondStyle(options.pond)));}}
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);if(aquarium)gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);else gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);
    function draw(key,matrix,hex,alpha,water,tile,material){
      if(aquariumTransparent&&([18,25,26,32,35].includes(material)||material===29&&alpha<.8)){
        const d=aquariumView.direction;aquariumTransparent.push({depth:matrix[12]*d[0]+matrix[13]*d[1]+matrix[14]*d[2],args:[key,matrix,hex,alpha,water,tile,material]});return;
      }
      if(shadowPass){if(water||key==='sprite'||material===9||material===18||material===25||material===26||material===32||material===35||material===40||(alpha!==undefined&&alpha<.8))return;gl.depthMask(true);}const g=mesh[key];gl.bindBuffer(gl.ARRAY_BUFFER,g.vertex);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(pos);gl.bindBuffer(gl.ARRAY_BUFFER,g.normals);gl.vertexAttribPointer(normal,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(normal);if(g.textureCoords){gl.bindBuffer(gl.ARRAY_BUFFER,g.textureCoords);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(uv);}else{gl.disableVertexAttribArray(uv);gl.vertexAttrib2f(uv,0,0);}gl.uniform1f(u.Textured,key==='sprite'?1:0);gl.uniform1f(u.Material,material!==undefined?material:key==='soil'?1:key==='floor'?15:key==='grass'?2:key==='stone'?3:key==='sphere'?4:key==='fin'||key==='tail'?14:key==='rayWing'?16:0);gl.uniform4fv(u.UvRect,tile||[0,0,1,1]);gl.uniformMatrix4fv(u.Model,false,matrix);gl.uniform3fv(u.Color,rgb(hex));gl.uniform1f(u.Alpha,alpha==null?1:alpha);gl.uniform1f(u.Water,water||0);gl.drawArrays(gl.TRIANGLES,0,g.count);}
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    atlasReady=true;host.dataset.decorArt='ready';
    function segment(a,b,r){const delta=b.map((v,i)=>v-a[i]),length=Math.hypot(...delta)||.001,y=delta.map(v=>v/length),axis=Math.abs(y[1])>.95?[1,0,0]:[0,1,0],x=[axis[1]*y[2]-axis[2]*y[1],axis[2]*y[0]-axis[0]*y[2],axis[0]*y[1]-axis[1]*y[0]],n=Math.hypot(...x);for(let i=0;i<3;i++)x[i]/=n;const z=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];return new Float32Array([x[0]*r,x[1]*r,x[2]*r,0,y[0]*length/2,y[1]*length/2,y[2]*length/2,0,z[0]*r,z[1]*r,z[2]*r,0,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,1]);}
    function pondStructure(style){
      gl.depthMask(false);draw('disc',model(.04,-.12,.06,3.05,1,2.96),'#233e32',.14,0,null,9);gl.depthMask(true);
      draw('soil',model(0,0,0,1,1,1),palette.edge,1,0,null,style==='crystal'?39:style==='cloud'?34:38);
      draw('floor',model(0,0,0,1,1,1),palette.floor);draw('grass',model(0,0,0,1,1,1),palette.grass,1,0,null,style==='crystal'?39:style==='moon'?38:style==='cloud'?34:['meadow','lily'].includes(style)?2:7);draw('stone',model(0,-.009,0,1,1,1),palette.rim);
      // Underwater cobbles have real depth; they are not painted on the surface.
      for(let i=0;i<13;i++){const a=i*2.399963,r=1.58+(i%3)*.09,x=Math.cos(a)*r,z=Math.sin(a)*r,size=.035+(i%4)*.018;draw('organic',model(x,-.42,z,size,.023,size*.85,a),i%3?'#778572':'#9a9e82',1,0,null,7);}
      for(let i=0;i<6;i++){const a=2.89+i*.105,r=shoreRadius(a)+.28,x=Math.cos(a)*r,z=Math.sin(a)*r/1.035;draw('organic',model(x,terrainHeight(x,z,decorations())+.018,z,.12,.025,.083,a+.3),i%2?'#aba78f':'#969b83',1,0,null,7);}
      themeLandmarks(style);
    }
    // Curved, tapered silhouettes are shared by every view, including desktop.
    function scenicTube(key,points,r,tone,matrix,material=7){
      if(!mesh[key])mesh[key]=upload(fishTubeMesh(points,r,r*.16));
      draw(key,matrix,tone,1,0,null,material);
    }
    function coralColony(x,y,z,size,turn=0){
      const base=model(x,y,z,size,size,size,turn);
      for(let i=0;i<7;i++){
        const a=(i-3)*.23,h=.56+(3-Math.abs(i-3))*.15,points=[[0,0,0],[a*.35,.26,.01],[a*.8,h*.65,Math.sin(i)*.05],[a,h,.03]];
        scenicTube('reef-branch-'+i,points,.092,i%2?'#ed92b1':'#efac86',base,24);
        for(let j=0;j<2;j++)scenicTube('reef-tip-'+i+'-'+j,[[a*.8,h*.65,.02],[a+(j?-.12:.12),h*.84,.04],[a+(j?-.16:.16),h+.08,.06]],.048,'#efb7b5',base,24);
      }
    }
    function lotusBloom(x,z,size){
      draw('lily',model(x,-.004,z,size*.92,1,size*.78,.4),'#397c5a',1,0,null,6);
      if(!mesh.lotusPetal)mesh.lotusPetal=upload(fishSurface((u,v)=>{const width=Math.sin(u*Math.PI)*.30,lateral=(v-.5)*2;return[lateral*width,.045+.34*u*u+.07*lateral*lateral*Math.sin(u*Math.PI),u*.68];},16,12));
      for(let layer=0;layer<3;layer++)for(let i=0;i<8;i++){
        const a=i*TAU/8+layer*.38,spread=size*(.8-layer*.22);
        draw('lotusPetal',model(x,.016+layer*.014,z,spread,size*(.56+layer*.14),spread,a),layer===2?'#f7d2df':i%2?'#e9a6c0':'#d685ac',1,0,null,24);
      }
      draw('organic',model(x,.12,z,size*.085,.034,size*.085),'#f3d491',1,0,null,10);
    }
    function themeLandmarks(style){
      if(style==='meadow'){
        for(let i=0;i<4;i++){const x=1.35+i*.24,z=-1.88+i*.13;draw('organic',model(x,.10+i%2*.06,z,.32,.14,.24,i*.7),i%2?'#8c998b':'#b0b1a0',1,0,null,7);draw('foliage',model(x-.05,.19+i%2*.06,z,.20,.025,.16),'#6d895e',1,0,null,6);}
      }else if(style==='lily'){
        for(const [x,z,size]of[[-.95,-.9,.68],[.16,-1.39,.57],[1.22,.62,.64]])lotusBloom(x,z,size);
        // Two curved rails and individually fitted planks form a garden bridge.
        for(const z of[-1.96,-2.36])scenicTube('garden-bridge-rail',Array.from({length:17},(_,i)=>{const x=-.68+i*.085;return[x,.24+.25*Math.sin(i*Math.PI/16),0];}),.024,'#845047',model(.0,.12,z,1,1,1),5);
        for(let i=0;i<16;i++){const x=-.68+i*.09,y=.10+.24*Math.sin(i*Math.PI/15);draw('rounded',model(x,y,-2.16,.044,.026,.27),'#ac8270',1,0,null,5);if(i%5===0)for(const z of[-1.96,-2.36])draw('cylinder',segment([x,y,z],[x,y+.22,z],.022),'#80534b',1,0,null,5);}
      }else if(style==='coral'){
        coralColony(1.67,.06,-1.48,.94,-.45);coralColony(-1.58,.02,-1.7,.67,.8);
        for(let i=0;i<4;i++){const x=.4+i*.32,z=-2.13;draw('organic',model(x,.11,z,.30,.16,.24,i),'#cabca5',1,0,null,7);draw('shell',model(x,.26,z,.55,.55,.55,i),i%2?'#daa1af':'#f7dfc5',1,0,null,24);}
        draw('star',matMul(model(1.91,.055,.99,.17,.17,.06,.5),tilt(Math.PI/2,0)),'#eab497',1,0,null,7);
      }else if(style==='crystal'){
        for(let i=0;i<7;i++){const x=1.16+i*.17,z=-1.9+Math.sin(i*1.7)*.22,h=.28+Math.sin(i*2.4)**2*.59;draw('crystal',matMul(model(x,.08+h*.5,z,.16,h,.15,.5+i*.73),tilt(0,(i-3)*.06)),i%2?'#a0dbe7':'#c0daf4',1,0,null,24);}
        for(let i=0;i<8;i++){const a=i*TAU/8;draw('organic',model(Math.cos(a)*2.30,.10,Math.sin(a)*2.22,.29,.085,.22,a),'#eef5f4',1,0,null,24);}
      }else if(style==='moon'){
        draw('organic',model(1.07,.12,-1.99,.56,.13,.35),'#79758d',1,0,null,7);
        draw('crescent',matMul(model(1.07,.79,-1.99,.71,.71,.13,.05),tilt(-.09,0)),'#ecd9a3',1,0,null,10);
        for(let i=0;i<5;i++){const x=.68+i*.18,y=.51+Math.sin(i*2.2)*.17;draw('star',matMul(model(x,y,-1.91,.048,.048,.032,yaw),tilt(0,.2)),palette.gem,1,0,null,11);}
        for(let i=0;i<12;i++){const a=i*2.399,r=1.5+i%2*.22;draw('sphere',model(Math.cos(a)*r,.12+Math.sin(time*.6+i)*.065,Math.sin(a)*r,.014,.014,.014),i%2?'#e4c899':'#a4bfe9',.45+.28*Math.sin(time*.8+i),0,null,11);}
      }else if(style==='cloud'){
        draw('arch',model(.84,.07,-2.05,.86,1.05,.83,.10),'#c1e0cd',1,0,null,23);
        for(const x of[.39,1.28]){draw('rounded',model(x,.10,-2.01,.15,.042,.20),'#e5e8d8',1,0,null,23);draw('sphere',model(x,.27,-2.01,.047,.047,.047),palette.gem,1,0,null,10);}
        gl.depthMask(false);
        for(let i=0;i<10;i++){const a=i*TAU/10,x=Math.cos(a)*2.25,z=Math.sin(a)*2.24;draw('organic',model(x,.025+Math.sin(time*.45+i)*.015,z,.38,.095,.24,a),'#edf3e8',.55,0,null,24);}
        gl.depthMask(true);
      }
    }
    function pondCraftDetails(style){
      const anchors=decorations(),ground=(x,z)=>terrainHeight(x,z,anchors),identity=model(0,0,0,1,1,1);
      // Hand-set edging follows the actual bank instead of a perfect repeated ring.
      if(style==='meadow'||style==='lily'){
        for(let k=0;k<11;k++){const a=.24+k*.145,r=shoreRadius(a)+.26+Math.sin(k*2.6)*.025,x=Math.cos(a)*r,z=Math.sin(a)*r/1.035;draw('organic',model(x,ground(x,z)+.008,z,.105+k%3*.015,.020,.075,a+.5),style==='lily'?'#a5a398':k%2?'#a4a48c':'#b9b6a0',1,0,null,7);}
        if(style==='meadow'){
          for(let k=0;k<5;k++){const x=-2.10-k*.046,z=.92+k*.074,y=ground(x,z),h=.20+k%3*.09;scenicTube('meadow-rush-'+k,[[0,0,0],[.025,h*.55,0],[.018,h,0]],.006,'#6b8652',model(x,y,z,1,1,1),6);draw('sphere',model(x+.018,y+h,z,.015,.052,.015),'#8c7952',1,0,null,7);}
          draw('organic',model(1.72,.104,-1.65,.29,.025,.22,.4),'#708957',1,0,null,6);
          for(let k=0;k<4;k++){const a=k*2.4;draw('leaf',model(1.78+Math.cos(a)*.09,.17,-1.77+Math.sin(a)*.11,.045,.16,.12,a),'#abc181',1,0,null,6);}
        }else{
          for(let i=0;i<16;i+=3){const x=-.68+i*.09,y=.129+.24*Math.sin(i*Math.PI/15);for(const z of[-1.99,-2.31])draw('sphere',model(x,y,z,.010,.004,.010),'#ceba91',1,0,null,10);}
          for(const x of[-.66,.67])for(const z of[-1.96,-2.36]){const h=.34;draw('sphere',model(x,h,z,.035,.019,.035),'#b7a080',1,0,null,10);}
        }
      }else if(style==='coral'){
        // Continuous eroded shelves overlap the sand; scalloped lips show thickness.
        if(!mesh.reefShelf)mesh.reefShelf=upload(fishSurface((u,v)=>{const a=v*TAU,r=.001+u*.459,edge=Math.sin(a*7+.6)*.017*u*u;return[Math.cos(a)*(r+edge),.07*(1-u*u)+.008*Math.sin(a*5)*u,Math.sin(a)*(r+edge)*.68];},12,56));
        for(let k=0;k<3;k++){const a=2.93+k*.2,r=shoreRadius(a)+.31,x=Math.cos(a)*r,z=Math.sin(a)*r/1.035;draw('reefShelf',model(x,ground(x,z)+.035,z,.8,1,.8,k*.6),k%2?'#e9d9be':'#d8ccb7',1,0,null,37);}
        for(let k=0;k<8;k++){const a=-.5+k*.15,r=shoreRadius(a)+.30,x=Math.cos(a)*r,z=Math.sin(a)*r/1.035;draw('organic',model(x,ground(x,z)+.009,z,.018,.012,.021),'#cfa4a1',1,0,null,37);}
      }else if(style==='crystal'){
        if(!mesh.iceShelf)mesh.iceShelf=upload(fishSurface((u,v)=>{const a=v*TAU,r=.001+u*.509,facet=.97+.035*Math.cos(a*6);return[Math.cos(a)*r*facet,.025+.072*(1-u)+Math.cos(a*3)*.015*(1-u),Math.sin(a)*r*.61*facet];},14,48));
        for(let k=0;k<4;k++){const a=2.45+k*.24,r=shoreRadius(a)+.3,x=Math.cos(a)*r,z=Math.sin(a)*r/1.035;draw('iceShelf',model(x,ground(x,z)+.022,z,.82,1,.82,a),'#c7e7ea',1,0,null,39);}
        const cracks=Array.from({length:21},(_,k)=>{const a=.55+k*.037,r=shoreRadius(a)+.21+Math.sin(k*.6)*.024,x=Math.cos(a)*r,z=Math.sin(a)*r/1.035;return[x,ground(x,z)+.009,z];});propWire('ice-rim-crack',cracks,.0045,identity,'#edf7f1',39);
      }else if(style==='moon'){
        const route=Array.from({length:45},(_,k)=>{const a=.22+k*.035,r=shoreRadius(a)+.26,x=Math.cos(a)*r,z=Math.sin(a)*r/1.035;return[x,ground(x,z)+.015,z];});propWire('moon-bank-inlay',route,.007,identity,'#c7b78e',10);
        for(let k=0;k<7;k++){const p=route[2+k*6];draw('star',matMul(model(p[0],p[1]+.004,p[2],k%3?.022:.039,k%3?.022:.039,.008,k*.4),tilt(Math.PI/2,0)),'#dfcda2',1,0,null,10);}
        const ring=model(1.07,.15,-1.99,.28,.28,.28);propRing(ring,'#a7a1bd',10);
        for(let k=0;k<3;k++)draw('crystal',model(.45+k*.12,.09,-2.21,.038,.068+k*.024,.04,k),'#a6a9cc',1,0,null,23);
      }else if(style==='cloud'){
        const route=Array.from({length:64},(_,k)=>{const a=-.33+k*.055,r=shoreRadius(a)+.22,x=Math.cos(a)*r,z=Math.sin(a)*r/1.035;return[x,ground(x,z)+.014,z];});propWire('cloud-bank-inlay',route,.006,identity,'#b7ba8f',10);
        for(let k=0;k<4;k++){const a=.25+k*.47,r=shoreRadius(a)+.35,x=Math.cos(a)*r,z=Math.sin(a)*r/1.035;propWire('cloud-bank-scroll-'+k,Array.from({length:21},(_,j)=>{const t=j/20*TAU*1.2,rr=.10*(1-j/24);return[Math.cos(t)*rr,.011,Math.sin(t)*rr];}),.005,model(x,ground(x,z),z,1,1,1,a),'#9fbaa2',34);}
        for(const x of[.39,1.28])propRing(model(x,.123,-2.01,.105,.10,.14),'#c5b984',10);
        const archFront=model(.84,.07,-2.05,.86,1.05,.83,.10);for(const side of[-1,1])propWire('pond-jade-carving-'+side,[[side*.49,.20,.144],[side*.46,.34,.144],[side*.53,.44,.144],[side*.50,.56,.144]],.008,archFront,'#afbb91',10);
      }
    }
    function pondRim(style){
      pondCraftDetails(style);
      const clusters=[[-1.18,-2.22],[1.45,-1.96],[-2.34,.42],[1.79,1.86],[-1.59,1.84],[.63,2.35]];
      for(let i=0;i<clusters.length;i++){
        const [x,z]=clusters[i],y=terrainHeight(x,z,decorations());
        if(style==='crystal'){draw('crystal',model(x,y+.10,z,.075,.16,.06,i),palette.gem,1,0,null,24);continue;}
        if(style==='coral'){draw('shell',model(x,y+.012,z,.33,.33,.33,i),i%2?'#ead6ba':'#cf9ea0',1,0,null,24);continue;}
        if(style==='cloud')continue;
        for(let j=0;j<3;j++){const px=x+Math.sin(j*2.4+i)*.1,pz=z+Math.cos(j*2.4+i)*.08;if(waterCell(px,pz)||Math.hypot(px,pz*1.035)>outerRadius(Math.atan2(pz*1.035,px),decorations())-.15)continue;draw('tuft',model(px,terrainHeight(px,pz,decorations())-.002,pz,.16+j*.025,.17+j*.025,.16,j*2.4),palette.leaf,1,0,null,6);}
      }
    }

    function fishScale(f,seed){
      const shape=fishShape(f),age=Math.max(aquarium?.65:0,Math.min(1,Number(f.growth==null?100:f.growth)/100));
      return(shape==='whale'?.43:shape==='seahorse'?.36:.40+(seed%4)*.012)*(.56+.44*age)*(aquarium?(fish.length===1?1.47:1.03):1);
    }
    function fishPose(f,i){
      const seed=hash(f.instanceId||f.id||i),species=f.speciesId||f.fishId||f.id,profile=FEED_PROFILES[species]||'bob',fed=feeding&&(!feeding.fishIds||feeding.fishIds.includes(f.id)||feeding.fishIds.includes(species)),t=fed?time-feedStart-i*.08:10,u=Math.max(0,Math.min(1,t/4.6)),e=t>0&&t<4.6?Math.sin(u*Math.PI):0;
      if(options.figureOnly)return{seed,species,profile,e:0,u:0,x:0,y:0,z:0,angle:species==='gulpuffer'||species==='grumpangler'?-.54:-.22,roll:0,pitch:0};
      if(aquarium){
        const motion=typeof module==='object'&&module.exports?require('./fishing-aquarium-motion'):win.TracerAquariumMotion;
        if(motion?.sample)return{...motion.sample(f,{time,index:i,count:fish.length,scale:fishScale(f,seed),reducedMotion:reducedAquarium,feed:{strength:e,progress:u}}),seed,species,profile,e,u};
      }
      if(aquarium){const single=fish.length===1,lanes=fish.length===2?[[-.89,.26,.12],[.86,-.03,-.11]]:[[-.92,.47,-.10],[.94,.15,-.18],[-.13,-.33,.25]],lane=single?[0,.05,.02]:lanes[i%3],a=time*.075+(i===1?Math.PI:.2+i*.25),x=lane[0]+Math.sin(a)*.16,y=lane[1]+Math.sin(time*.48+i*1.9)*.035+e*.09,z=lane[2]+Math.cos(a)*.035,angle=Math.atan2(Math.sin(a)*.035,Math.cos(a)*.16)-.12;return{seed,species,profile,e,u,x,y,z,angle,roll:Math.sin(time*.75+i)*.017,pitch:(fishShape(f)==='ray'?.26:0)+Math.sin(time*.42+i)*.028+e*.06};}
      let a=time*(.19+(seed%7)*.015)+(seed%99),r=.78+(i%3)*.42,y=-.22-(i%3)*.1+Math.sin(time*.7+i)*.025+(fishShape(f)==='seahorse'?.12:0),roll=Math.sin(time*1.4+i)*.035,pitch=0,dx=0,dz=0;
      if(e){switch(profile){case'dart':a+=Math.sin(u*TAU)*e*.8;break;case'bop':y+=Math.sin(u*Math.PI*5)*.16*e;break;case'jump':y+=Math.max(0,Math.sin(u*TAU))*1.03;roll=Math.sin(u*TAU)*.4;break;case'zigzag':dx=Math.sin(u*Math.PI*9)*e*.2;dz=Math.cos(u*Math.PI*7)*e*.2;break;case'twist':roll=Math.sin(u*TAU)*.75;break;case'school':r-=e*.36;a+=e*1.1;break;case'spiral':a+=u*TAU*1.4;r-=e*.25;break;case'nibble':y-=e*.34;roll=-e*.24;break;case'bow':roll=Math.sin(u*Math.PI*4)*e*.23;break;case'fan':pitch=Math.sin(u*Math.PI*8)*e*.17;break;case'bob':y+=Math.sin(u*Math.PI*5)*.24*e;break;case'waltz':a+=Math.sin(u*TAU)*.65;pitch=Math.sin(u*Math.PI*4)*.3*e;break;case'glow':y+=e*.21;break;case'blossom':a+=e*.25;y+=e*.13;break;case'orbit':a+=u*TAU;r-=e*.22;break;case'sparkle':roll=Math.sin(u*TAU)*.22;break;case'flame':a+=u*TAU*.65;roll=Math.sin(u*Math.PI*4)*e*.45;break;case'glide':r+=e*.23;y+=e*.12;pitch=Math.sin(u*Math.PI*4)*.21;break;case'coil':a+=u*TAU*1.2;roll=Math.sin(u*TAU)*.3;break;case'breach':y+=Math.max(0,Math.sin(u*TAU))*1.2;roll=Math.sin(u*TAU)*.45;break;case'moonbubble':y+=e*.20;pitch=-e*.12;roll=Math.sin(u*Math.PI*4)*e*.06;break;case'fortune':y+=Math.sin(u*Math.PI*5)*e*.065;roll=Math.sin(u*Math.PI*4)*e*.08;break;case'hug':y+=e*.16;pitch=e*.13;r-=e*.12;break;case'wish':a+=u*TAU*.58;roll=Math.sin(u*TAU)*e*.27;y+=e*.09;break;}}
      return{seed,species,profile,e,u,x:Math.cos(a)*r+dx,y,z:Math.sin(a)*r*.86+dz,angle:Math.atan2(-Math.cos(a)*.86,-Math.sin(a)),roll,pitch};
    }
    function drawFish(f,i){
      const pose=fishPose(f,i),{x,y,z,angle,roll,pitch,e,u:feedProgress,seed,profile,species}=pose,shape=fishShape(f),scale=pose.scale??fishScale(f,seed),c=color(f.color,'#d7b77a'),accent=color(f.accent,'#f5deb3'),base=matMul(model(x,y,z,scale,scale,scale,angle),tilt(pitch+(options.figureOnly&&shape==='ray'?.68:0),roll)),part=(px,py,pz,sx,sy,sz,ry=0,rx=0,rz=0)=>matMul(base,matMul(model(px,py,pz,1,1,1,ry),matMul(tilt(rx,rz),model(0,0,0,sx,sy,sz)))),dims=FISH_DIMENSIONS[species]||[1,.4,.3],[bodyX,bodyY,bodyZ]=dims,kind=fishProfileKind(species),motion=pose.articulation,tailBeat=motion?.tailBeat??Math.sin(time*4.6+i)*.18,paddle=motion?.paddle??Math.sin(time*3.8+i)*.11,breath=motion?.breath??Math.sin(time*2.4+i)*.004;
      gl.uniform1f(u.Species,FISH_SPRITES.indexOf(species));gl.uniform1f(u.FishFeed,e);gl.uniform3fv(u.Accent,rgb(accent));
      gl.uniform1f(u.MotionEnabled,motion?1:0);
      for(const [key,value]of Object.entries({BodyPhase:motion?.bodyPhase,BodyAmplitude:motion?.bodyAmplitude,FinPhase:motion?.finPhase,FinAmplitude:motion?.finAmplitude,WingPhase:motion?.wingPhase,WingAmplitude:motion?.wingAmplitude,WingFold:motion?.wingFold,BodyPuff:motion?.bodyPuff}))gl.uniform1f(u[key],Number.isFinite(value)?key.endsWith('Phase')?value%TAU:value:0);
      const cached=(key,build)=>{if(!mesh[key])mesh[key]=upload(build());return key;},silk=(key,matrix,tone,alpha=.93)=>draw(key,matrix,tone,alpha,0,null,14),body=()=>draw(cached('anatomy-'+kind,()=>anatomicalBodyMesh(kind)),part(0,0,0,...dims),c,1,0,null,13),stroke=(label,points,r,tone=accent,material=10,matrix=base)=>draw(cached('stroke-'+species+'-'+label,()=>fishTubeMesh(points,r,r*.27)),matrix,tone,1,0,null,material),tail=(type,sx,sy,tone=accent,extra={})=>silk(cached('tail-'+type,()=>speciesTailMesh(type)),part(-bodyX*.985,0,motion?Math.sin(motion.bodyPhase-.985*3.2)*motion.bodyAmplitude*.5*bodyZ:0,sx,sy,1,extra.yaw===undefined?tailBeat:extra.yaw,extra.pitch||0,extra.roll||0),tone),median=(label,start,end,height,side=1,spines=0,tone=accent)=>silk(cached('median-'+species+'-'+label,()=>medianFishFin(species,start,end,height,side,spines)),base,tone);
      const eye=(px,py,pz,size,side=1,up=false)=>{const center=part(px,py,pz,1,1,1,0,up?-Math.PI/2:0),q=(a,b,d,sx,sy,sz)=>matMul(center,model(a,b,d,sx,sy,sz)),gaze=(motion?.gaze??Math.sin(time*.72+seed%7)*.04)*size,odd=FISH_SPRITES.indexOf(species)>19,sleepy=species==='grumpangler',height=sleepy?.78:1;draw('sphere',q(0,0,-side*size*.12,size*1.04,size*1.09*height,size*.20),c,1,0,null,4);draw('sphere',q(.004,0,0,size*.95,size*height,size*.20),odd?(species==='gulpuffer'?'#8c8bad':sleepy?'#a4aa61':species==='flopray'?'#79b9a5':'#5bada1'):'#416773',1,0,null,odd?19:10);draw('sphere',q(size*.06+gaze,sleepy?-size*.11:0,side*size*.14,size*(odd?.56:.67),size*(odd?.66:.80)*height,size*.075),'#10282d',1,0,null,10);draw('sphere',q(-size*.20,size*.35*height,side*size*.19,size*(odd?.17:.22),size*(odd?.20:.24),size*.025),'#fffceb',1,0,null,11);draw('sphere',q(size*.34,-size*.27*height,side*size*.20,size*.08,size*.085,size*.017),'#cceefa',1,0,null,11);};
      const surface=(nx,ny,side,offset=.004)=>{const [h,w,cy]=fishSection(kind,nx),dy=(ny-cy)/Math.max(.001,h);return[nx*bodyX,ny*bodyY,side*(w*bodyZ*Math.sqrt(Math.max(.02,1-dy*dy))+offset)];},standardEyes=(nx=.68,size=.067)=>{for(const side of[-1,1]){const p=surface(nx,.22,side);eye(...p,size,side);}},gills=()=>{for(const side of[-1,1]){const ys=[.49,.27,0,-.27,-.44],points=ys.map(ny=>surface(.44+.14*ny*ny,ny,side,.003));stroke('gill-'+side,points,.0033,'#98a49a',4,part(0,0,side*breath,1,1,1));}},lips=(nx=1,cy=-.065,width=.08,height=.024)=>{const xx=nx*bodyX,yy=cy*bodyY;draw('sphere',part(xx+.006,yy,0,.012,height,width),'#665e57',1,0,null,4);for(const side of[-1,1])stroke('lip-'+side,[[xx-.018,yy,side*width],[xx+.007,yy+side*height,side*width*.45],[xx+.012,yy+side*height,0],[xx+.007,yy+side*height,-side*width*.45],[xx-.018,yy,-side*width]],.0075,accent,4);},paired=(label,nx,ny,sx=.48,sy=.5,tone=accent)=>{for(const side of[-1,1]){const p=surface(nx,ny,side,.005);silk('ribbonFin',part(...p,sx,sy,.50,side*(.73+paddle),side*.42,.22),tone,.85);}},pelvic=(tone=accent)=>paired('pelvic',-.11,-.69,.30,.31,tone);
      if(species==='gulpuffer'){
        body();tail('round',.34,.43,'#b8abc4');median('small-dorsal',-.22,-.55,.11,1,0,'#bcadca');paired('tiny-pectoral',.30,-.025,.18,.25,'#cebed2');
        for(const side of[-1,1]){eye(...surface(.735,.29,side,.002),.067,side);const ny=-.101,nz=side*.18;let low=.55,high=.9999;for(let j=0;j<24;j++){const q=(low+high)/2,[h,w,cy]=fishSection(kind,q),outside=((ny-cy)/Math.max(.0001,h))**2+(nz/Math.max(.0001,w))**2>1;if(outside)high=q;else low=q;}draw(cached('odd-blunt-tooth',bluntToothMesh),part((low+high)/2*bodyX-.012,ny*bodyY,nz*bodyZ,.052,.120,.048,Math.PI/2),'#f3e8c9',1,0,null,4);}
      }else if(species==='grumpangler'){
        body();tail('round',.35,.39,'#b2ba8e');median('small-ridge',-.18,-.58,.10,1,0,c);
        for(const side of[-1,1]){const p=surface(.28,-.33,side,-.015);draw(cached('odd-stubby-fin',whaleFlipperMesh),part(...p,.32,.68,.66,side*(1.13+paddle*.65),side*.30,.14),c,1,0,null,21);eye(...surface(.72,.24,side,.001),.057,side);}
        stroke('folded-lure',[[.16,.50,0],[.24,.82,0],[.41,.98,0],[.60,.92,0],[.70,.822,0]],.017,'#b8ae65',4);draw(cached('fortune-coin-lure',coinLureMesh),part(.70,.706,0,.120,.120,.120,.14+(motion?.lureSwing??Math.sin(time*1.4)*.14)),accent,1,0,null,20);draw('sphere',part(.70,.706,0,.147,.147,.027),accent,.075+.035*Math.sin(time*1.8),0,null,18);
      }else if(species==='flopray'){
        draw(cached('floppy-hug-ray',floprayMesh),base,c,1,0,null,16);stroke('soft-whip',[[-.94,-.01,0],[-1.21,-.06,.03],[-1.53,-.14,.09],[-1.73,-.10,.14]],.022,c,4,part(0,0,0,1,1,1,Math.sin(motion?.bodyPhase??time*1.7)*.030));
        for(const side of[-1,1]){const p=floprayPoint(.238,.5+side*.087,false);eye(p[0],p[1]+.004,p[2],.049,1,true);}
      }else if(species==='snagglefin'){
        draw(cached('wish-eel-body',()=>fishTubeMesh(WISH_EEL_SPINE,.2,.004)),base,c,1,0,null,13);
        for(const side of[-1,1]){eye(.765,.485+side*.012,side*.212,.060,side);const large=side>0;draw(cached('odd-blunt-tooth',bluntToothMesh),part(.952,.318,side*.064,large?.043:.033,large?.132:.073,.051,Math.PI/2,0,Math.PI),'#f0e3ba',1,0,null,4);silk(cached('wish-ear',()=>fishFinMesh([[0,.035,0],[0,-.035,0]],[[-.10,.27,0],[-.29,.30,0],[-.36,.12,0],[-.22,-.06,0]])),part(.27,.56,side*.221,large?1.12:.67,large?1:.69,.68,side*(.77+paddle),side*.19,-.17),large?'#c4d7bf':'#c9dfcf',.88);}
        const last=WISH_EEL_SPINE[WISH_EEL_SPINE.length-1],q=Math.max(0,Math.min(1,(last[0]+1)/1.4)),bend=Math.sin((motion?.bodyPhase??time*3+23)+last[0]*3.2)*(.5-.5*q*q*(3-2*q))*(motion?.bodyAmplitude??.045)*(1+e*1.3);silk(cached('wish-star-tail',()=>fishFinMesh([[0,.017,0],[0,-.017,0]],[[-.11,.18,0],[-.18,.063,0],[-.34,.082,0],[-.25,-.025,0],[-.30,-.19,0],[-.14,-.12,0],[-.055,-.19,0],[-.045,-.025,0]])),part(last[0],last[1],bend,1.12,1.12,.65,0,0,.57),accent,.84);
      }else if(shape==='seahorse'){
        const spine=[[.595,.405,0,.042,1],[.43,.44,0,.054,1],[.215,.535,0,.151,.93],[-.015,.575,0,.148,.9],[-.105,.32,0,.135,.88],[-.105,.03,0,.195,.87],[-.06,-.27,0,.175,.88],[-.16,-.55,0,.102,.86],[-.22,-.85,0,.065,.9],[-.075,-1.065,0,.049,.94],[.16,-1.09,0,.038,1],[.285,-.90,0,.029,1],[.17,-.805,0,.021,1],[.09,-.90,0,.004,1]];
        draw(cached('seahorse-body',()=>fishTubeMesh(spine,.1,.01)),base,c,1,0,null,13);draw('sphere',part(.59,.405,0,.014,.044,.044),'#886451',1,0,null,4);
        for(let j=0;j<8;j++){const t=.285+j*.027,p=fishCurve(spine,t),a=fishCurve(spine,t+.003),dx=a[0]-p[0],dy=a[1]-p[1],l=Math.hypot(dx,dy)||1,r=p[3]+.004,ring=[];for(let k=0;k<=16;k++){const q=k/16*TAU;ring.push([p[0]-dy/l*Math.cos(q)*r,p[1]+dx/l*Math.cos(q)*r,Math.sin(q)*r*.88]);}stroke('bone-ring-'+j,ring,.0065,accent,4);}
        silk(cached('tail-round',()=>speciesTailMesh('round')),part(-.27,-.045,0,.29,.36,.45,Math.sin(time*12)*.18),accent,.76);for(const side of[-1,1]){silk('ribbonFin',part(.015,.425,side*.133,.15,.20,.45,side*(.8+Math.sin(time*10)*.18)),accent,.76);eye(.17,.575,side*.143,.051,side);}
        for(let j=0;j<3;j++)stroke('crown-'+j,[[-.075+j*.070,.665,0],[-.115+j*.09,.81-j*.018,0],[-.035+j*.061,.74-j*.014,0]],.020,accent,4);
      }else if(shape==='dragon'){
        draw(cached('dragon-anatomy',()=>fishTubeMesh([[1.27,.035,0,.035,.95],[1.12,.09,0,.125,.9],[.96,.17,0,.223,.89],[.72,.28,0,.235,.87],[.37,.39,0,.218,.86],[-.35,.47,.015,.181,.86],[-.99,.18,.03,.134,.88],[-1.08,-.36,.025,.088,.91],[-.72,-.61,0,.05,.95],[-.29,-.38,-.02,.008,1]],.2,.01)),base,c,1,0,null,13);
        for(let j=0;j<11;j++){const t=.10+j*.064,p=dragonSpine(t),a=dragonSpine(t+.012),turn=Math.atan2(a[1]-p[1],a[0]-p[0]),r=.235*Math.pow(1-t,.72);silk('flowFin',part(p[0],p[1]+r,p[2],.23,.30,.5,0,0,turn-Math.PI),j%2?accent:c,.90);}
        const last=dragonSpine(1);for(const side of[-1,1]){silk('ribbonFin',part(last[0],last[1],0,.61,.76,.5,tailBeat,0,side*.48+2.1),accent);stroke('horn-'+side,[[.71,.31,side*.15],[.61,.58,side*.17],[.36,.75,side*.20]],.028,c);stroke('horn-tine-'+side,[[.61,.58,side*.17],[.39,.56,side*.20]],.018,c);stroke('whisker-'+side,[[1.23,-.005,side*.12],[1.38,-.15,side*.23],[1.29,-.43,side*.38],[1.01,-.63,side*.42],[.85,-.65,side*.37]],.014,c);silk('ribbonFin',part(.80,-.02,side*.14,.52,.61,.35,side*.32,side*.45,-.7),accent);eye(.99,.16,side*.18,.066,side);stroke('mouth-'+side,[[1.25,.0,side*.05],[1.16,-.047,side*.12],[1.04,-.037,side*.15]],.007,'#7a8060',4);}
      }else if(shape==='ray'){
        draw(cached('ray-disc',rayDiscMesh),base,c,1,0,null,16);stroke('whip',[[-.82,0,0],[-1.18,-.005,0],[-1.55,-.07,.07],[-1.95,-.17,.10]],.022,c,4,part(0,0,0,1,1,1,Math.sin(time*1.8)*.035));
        for(const side of[-1,1]){eye(.46,.112,side*.16,.062,1,true);draw('sphere',part(.29,.116,side*.17,.039,.006,.025),'#554e82',1,0,null,4);for(let j=0;j<5;j++)stroke('ventral-gill-'+side+'-'+j,[[.31-j*.065,-.105,side*.12],[.29-j*.065,-.12,side*.24]],.0045,'#bfc0cf',4);}
        stroke('ventral-mouth',[[.60,-.11,-.12],[.65,-.13,0],[.60,-.11,.12]],.008,'#bab0cc',4);
      }else if(shape==='whale'){
        body();const flap=motion?.tailLift??Math.sin(time*3.1+15.8)*.14,flukeMatrix=matMul(base,matMul(model(-bodyX*.985,Math.sin(motion?motion.bodyPhase-.985*3.2:time*3.1+15.8)*(motion?motion.bodyAmplitude*.5:.0225)*bodyY,0,1,1,1),matMul(tilt(0,flap),matMul(tilt(Math.PI/2,0),model(0,0,0,.91,1.05,1)))));silk(cached('whale-fluke',whaleFlukeMesh),flukeMatrix,c,1);median('dorsal',-.30,-.69,.19,1,0,c);
        for(const side of[-1,1]){silk(cached('whale-flipper',whaleFlipperMesh),part(.18,-.21,side*.36,.91,1.08,1,side*(.99+paddle*.45),side*.30,-.14),c,1);eye(...surface(.607,.15,side,.001),.068,side);stroke('jaw-'+side,[[1.10,-.095,side*.08],[.98,-.20,side*.27],[.74,-.265,side*.39],[.40,-.25,side*.425]],.009,'#d7d5c6',4);for(let j=0;j<3;j++)stroke('throat-'+side+'-'+j,[[.95,-.25-j*.03,side*.12],[.61,-.39-j*.022,side*.22],[.12,-.445-j*.015,side*.24]],.0045,'#c0c9c9',4);}
        draw('sphere',part(.47,.542,0,.037,.010,.022),'#35445f',1,0,null,4);
      }else if(species==='crystal'){
        body();tail('hetero',.78,.83,accent);median('dorsal',-.42,-.76,.24);median('anal',-.55,-.84,.13,-1);paired('pectoral',.28,-.33,.60,.49);pelvic();
        for(const side of[-1,1])eye(.46,.065,side*.228,.054,side);draw('sphere',part(.72,-.172,0,.075,.019,.072),'#647e89',1,0,null,4);
        for(let j=0;j<4;j++){const zz=(j-1.5)*.068;stroke('chin-barbel-'+j,[[.85,-.12,zz],[.83,-.23,zz*1.18],[.77,-.30,zz*1.28]],.0095,accent,4);}
        const scute=cached('sturgeon-scute',fishScuteMesh);for(const [row,a]of[0,1.08,-1.08,2.23,-2.23].entries())for(let j=0;j<8;j++){const nx=.34-j*.145,[h,w,cy]=fishSection(kind,nx);draw(scute,part(nx*bodyX,(cy+h*Math.cos(a))*bodyY,Math.sin(a)*w*bodyZ,.105,.087,.091,0,a),j%2?'#e4f7f6':accent,.94,0,null,10);}
        gills();
      }else if(shape==='catfish'){
        body();tail('round',.57,.59,accent);median('small-dorsal',.22,-.01,.14);median('long-anal',.01,-.95,.19,-1);paired('pectoral',.42,-.18,.55,.52);pelvic();
        for(const side of[-1,1]){eye(.72,.12,side*.328,.049,side);stroke('upper-barbel-'+side,[[1.07,.015,side*.19],[1.22,-.04,side*.38],[1.08,-.16,side*.66],[.79,-.23,side*.78]],.0125,accent,4);stroke('chin-barbel-'+side,[[1.075,-.075,side*.085],[1.06,-.25,side*.15],[.89,-.37,side*.24]],.009,accent,4);}
        gills();
      }else if(shape==='angler'){
        body();tail('round',.50,.50,c);median('rear-dorsal',-.32,-.69,.15,1,0,c);paired('pectoral',.1,-.39,.39,.50,c);
        for(const side of[-1,1])eye(...surface(.64,.39,side,.001),.076,side);
        stroke('lure',[[.12,.51,0],[.24,.81,0],[.49,.98,0],[.73,.88,0],[.81,.72,0]],.019,c,4);draw('sphere',part(.81,.69,0,.071,.091,.071),accent,1,0,null,11);draw('sphere',part(.81,.69,0,.13,.15,.13),accent,.11,0,null,11);
      }else{
        body();let finColor=species==='perch'?'#d79b65':species==='koi'?'#f4e9d8':species==='goldfish'||species==='phoenixfish'?'#eebc68':species==='lotusfin'?'#e3bbd3':accent;
        if(species==='goldfish'){
          for(const side of[-1,1])silk(cached('goldfish-double-tail',()=>fishFinMesh([[0,.06,0],[.02,0,0],[0,-.06,0]],[[-.70,.64,.0],[-1.01,.42,0],[-.77,.02,0],[-1.00,-.39,0],[-.64,-.60,0]])),part(-bodyX*.96,0,side*.042,.85,.84,.90,side*.36+tailBeat),finColor,.9);
        }else if(species==='moonfin')tail('moon',.96,1.05,finColor);
        else if(species==='phoenixfish'||species==='lotusfin'){
          silk(cached('fantasy-forked-tail',()=>fishFinMesh([[0,.06,0],[.018,0,0],[0,-.06,0]],[[-1.04,.60,0],[-1.31,.46,0],[-.92,.21,0],[-.57,0,0],[-.92,-.21,0],[-1.31,-.46,0],[-1.04,-.60,0]])),part(-bodyX*.985,0,0,species==='phoenixfish'?1.02:.78,.94,.9,tailBeat),finColor,.90);
        }else tail(species==='crucian'?'shallow':species==='angelfish'?'round':'fork',species==='angelfish'?.57:.71,species==='angelfish'?.70:.78,finColor);
        if(species==='perch'){median('spinous',.50,-.15,.30,1,7,'#aab87d');median('soft',-.27,-.71,.23,1,0,'#b6ba83');}
        else if(species==='mackerel'){median('first',.42,.02,.21,1,6,finColor);median('second',-.32,-.53,.115,1,0,finColor);for(let j=0;j<5;j++){const start=-.58-j*.075;median('upper-finlet-'+j,start,start-.065,.051-j*.004,1,0,finColor);median('lower-finlet-'+j,start,start-.065,.045-j*.003,-1,0,finColor);}}
        else if(species==='angelfish'){median('continuous-dorsal',.68,-.82,.28,1,0,'#b8d6ea');median('continuous-anal',.14,-.85,.25,-1,0,'#b9c5e5');}
        else{median('main-dorsal',species==='trout'?.30:.45,species==='carp'||species==='koi'||species==='crucian'?-.84:-.37,species==='goldfish'?.30:species==='crucian'?.205:species==='carp'||species==='koi'?.18:.20,1,0,finColor);if(species==='trout')median('adipose',-.58,-.73,.09,1,0,finColor);}
        if(species!=='angelfish')median('anal',-.37,-.72,species==='carp'?.16:.12,-1,0,finColor);paired('pectoral',.33,-.18,species==='angelfish'?.28:.39,species==='angelfish'?.30:.45,finColor);pelvic(finColor);standardEyes(species==='angelfish'?.75:.69,species==='angelfish'?.061:species==='goldfish'?.074:.064);gills();lips(1,fishSection(kind,1)[2],species==='angelfish'?.046:.069,species==='angelfish'?.019:.025);
        if(species==='carp'||species==='koi')for(const side of[-1,1]){stroke('long-mouth-barbel-'+side,[[bodyX*.99,-.075,side*.05],[bodyX*1.025,-.17,side*.1],[bodyX*.94,-.23,side*.16]],.008,finColor,4);stroke('short-mouth-barbel-'+side,[[bodyX*.95,-.065,side*.095],[bodyX*.92,-.15,side*.14]],.0065,finColor,4);}
      }
      for(const jewellery of legendJewellery(species))draw(cached(jewellery.key,()=>jewellery.geometry),base,jewellery.color,1,0,null,jewellery.material);
      if(e&&species==='gulpuffer')for(let j=0;j<4;j++){const rise=(feedProgress*1.5+j*.23)%1,r=.034+rise*.057;draw('sphere',part(.83+rise*.24,-.08+rise*.83,Math.sin(j*2.3)*.14,r,r,r),accent,(1-rise)*e*.66,0,null,18);}
      if(e&&species==='grumpangler')for(let j=0;j<3;j++){const phase=feedProgress*TAU+j*TAU/3;draw(cached('fortune-coin-lure',coinLureMesh),part(.42+Math.cos(phase)*.31,.58+e*.35+j*.06,Math.sin(phase)*.28,.045,.045,.045,phase),accent,e*.53,0,null,11);}
      if(e&&species==='flopray')for(let j=0;j<3;j++){const lift=(feedProgress+j*.23)%1;draw(cached('odd-heart-glow',heartGlowMesh),part(.08-j*.13,.34+lift*.62,(j-1)*.30,.046,.046,.046,-angle),accent,(1-lift)*e*.58,0,null,11);}
      if(e&&species==='snagglefin')for(let j=0;j<5;j++){const phase=j*TAU/5+feedProgress*TAU,r=.38+feedProgress*.16;draw('star',part(-.28+Math.cos(phase)*r,.17+Math.sin(phase)*r,.06,.028,.028,.028,-angle),accent,e*.65,0,null,11);}
      if(options.selectedFishId===f.id)draw('sphere',model(x,y,z,scale*1.3,scale*.8,scale*.85),accent,.14);
      if(e&&FISH_SPRITES.indexOf(species)<20){
        const luminous=['glow','blossom','sparkle','flame','orbit','coil'].includes(profile),count=profile==='breach'?9:luminous?7:4;
        for(let j=0;j<count;j++){const a=j*TAU/count+feedProgress*TAU*(profile==='coil'?2:1),r=(profile==='blossom'?.28:.14)+feedProgress*.35,py=y+Math.max(0,Math.sin(feedProgress*Math.PI))*j*.06+(profile==='breach'?feedProgress*.6:0),matrix=model(x+Math.cos(a)*r,py,z+Math.sin(a)*r,(luminous?.03:.023)*(1-e*.2),.03,.03);if(aquarium&&py>1.10)continue;draw(luminous&&j%2?'star':'sphere',matrix,luminous?accent:'#e9fff2',(.45+e*.4)*(aquarium?Math.min(1,Math.max(0,(1.10-py)/.16)):1));}
        if(profile==='glow'||profile==='sparkle')draw('sphere',model(x,y,z,scale*1.2,scale*.7,scale*.7),accent,.13*e);
      }
      return pose;
    }
    function project(x,y,z){const p=[x,y,z,1],vp=projection.view,clip=Array.from({length:4},(_,row)=>p.reduce((s,v,j)=>s+vp[j*4+row]*v,0));return{x:(clip[0]/clip[3]+1)*projection.width/2,y:(1-clip[1]/clip[3])*projection.height/2,depth:clip[2]/clip[3]};}
    function getWaterPosition(point={}){if(destroyed||options.figureOnly)return null;const b=canvas.getBoundingClientRect(),w=Math.max(1,b.width),h=Math.max(1,b.height),vp=viewProjection(w/h,yaw,zoom),p=[Number(point.x)||0,-.015,Number(point.z)||0,1],clip=Array.from({length:4},(_,row)=>p.reduce((s,v,j)=>s+vp[j*4+row]*v,0));return{x:b.left+(clip[0]/clip[3]+1)*w/2,y:b.top+(1-clip[1]/clip[3])*h/2};}
    function decorations(){return localDecorations||options.pond&&Array.isArray(options.pond.decorations)&&options.pond.decorations||defaultDecorations(pondStyle(options.pond));}
    function volumeDecoration(d,ground,factor){
      const rotation=(Number(d.rotation)||0)*Math.PI/2,base=model(d.x,ground,d.z,factor,factor,factor,rotation),seed=hash(d.id||d.kind),leaf=palette.leaf,lightLeaf=pondStyle(options.pond)==='moon'?'#aba1ca':pondStyle(options.pond)==='cloud'?'#c4d7c0':'#6f946d',wood='#a88960',darkWood='#68543e',stone='#969b86';
      const shape=(key,x,y,z,sx,sy,sz,tone,material=6,turn=0,pitch=0,roll=0,alpha=1)=>draw(key,matMul(base,matMul(model(x,y,z,sx,sy,sz,turn),tilt(pitch,roll))),tone,alpha,0,null,material),tube=(a,b,r,tone=wood,material=12)=>draw('cylinder',matMul(base,segment(a,b,r)),tone,1,0,null,material),crown=(x,y,z,sx,sy,sz,tone)=>{shape('foliage',x,y,z,sx,sy,sz,tone,33,0,Math.sin(time*.43+seed%10)*.008);};
      const style=pondStyle(options.pond);
      if(['tree','willow','bush','reeds'].includes(d.kind)&&style==='coral'){coralColony(d.x,ground,d.z,factor*(d.kind==='tree'||d.kind==='willow'?.95:.55),rotation);return;}
      if(['tree','willow','bush','reeds'].includes(d.kind)&&style==='crystal'){
        for(let i=0;i<5;i++){const x=(i-2)*.14,h=(d.kind==='tree'||d.kind==='willow'?1.2:.58)*(1-Math.abs(i-2)*.22);shape('crystal',x,h*.48,Math.sin(i*2)*.09,.15,h*.65,.13,i%2?'#a8d8e9':'#d2e9f2',24,i*.6,0,-x*.4);}return;
      }
      switch(d.kind){
        case'tree':{
          tube([0,0,0],[.02,.98,.02],.083,darkWood);tube([.015,.58,.01],[-.31,1.24,.03],.045);tube([.02,.78,.02],[.33,1.37,.14],.044);tube([.02,.88,.01],[-.03,1.62,-.11],.038);
          for(let i=0;i<3;i++){const a=i*2.4;tube([0,.10,0],[Math.cos(a)*.23,.012,Math.sin(a)*.23],.044,darkWood);}
          crown(-.31,1.31,.035,.47,.47,.43,leaf);crown(.30,1.43,.13,.49,.46,.47,leaf);crown(-.025,1.68,-.11,.40,.41,.39,lightLeaf);shape('tuft',.14,0,-.12,.52,.42,.52,leaf);break;
        }
        case'willow':{
          tube([0,0,0],[.10,1.07,0],.068,darkWood);
          for(let i=0;i<4;i++){const a=i*TAU/4+.3,x=Math.cos(a)*.34,z=Math.sin(a)*.30;tube([.06,.78,0],[x,1.21,z],.027);crown(x,1.31,z,.40,.29,.37,i%2?leaf:lightLeaf);}
          crown(.02,1.47,-.06,.42,.27,.38,leaf);
          for(let i=0;i<11;i++){const a=i*TAU/11,x=Math.cos(a)*.56,z=Math.sin(a)*.50,sway=Math.sin(time*.48+i)*.014,h=.43+(i%3)*.09;
            tube([x*.88,1.29,z*.88],[x+sway,.68+h*.25,z],.006,leaf,6);
            for(let j=0;j<4;j++){const y=1.22-j*.13;shape('leaf',x+sway+(j%2?.028:-.028),y,z,.10,.25,.11,j%2?leaf:lightLeaf,6,a,.12);}
          }
          break;
        }
        case'bush':crown(-.22,.27,.035,.37,.29,.32,leaf);crown(.22,.35,-.02,.39,.33,.34,lightLeaf);crown(.015,.45,-.13,.32,.30,.29,leaf);break;
        case'flowers':{
          shape('tuft',0,0,0,.83,.55,.75,leaf);for(let i=0;i<5;i++){const a=i*2.4,r=.06+(i%3)*.1,x=Math.cos(a)*r,z=Math.sin(a)*r,y=.28+(i%3)*.055;tube([x,0,z],[x,y,z],.010,leaf,6);for(let j=0;j<5;j++){const b=j*TAU/5;shape('leaf',x+Math.cos(b)*.042,y+.015,z+Math.sin(b)*.042,.16,.13,.32,i%2?'#d1b795':'#c49da0',6,b,Math.PI/2+.2);}shape('organic',x,y+.02,z,.027,.022,.027,'#c8ac62',6);}break;
        }
        case'reeds':{
          shape('tuft',-.06,0,.06,.83,.92,.83,leaf);shape('tuft',.13,0,-.045,.75,.75,.72,lightLeaf);for(let i=0;i<5;i++){const a=i*2.4,x=Math.cos(a)*.13,z=Math.sin(a)*.13,h=.57+(i%3)*.14;tube([x,0,z],[x+Math.sin(time*.5+i)*.012,h,z],.01,'#768258',6);tube([x,h-.06,z],[x,h+.085,z],.030,'#867050',5);}break;
        }
        case'rocks':{
          shape('organic',-.18,.105,.06,.27,.13,.22,stone,7,.4);shape('organic',.19,.19,-.015,.30,.22,.24,'#8a9487',7,-.2,0,.15);shape('organic',.085,.071,.25,.18,.09,.15,'#a6a991',7,.8);shape('tuft',-.29,0,-.1,.37,.37,.4,leaf);break;
        }
        case'dock':{
          for(let i=0;i<9;i++){const z=-.44+i*.105;shape('rounded',0,.17,z,.63,.025,.048,i%3?wood:'#b09670',5);for(const x of[-.48,.48])shape('organic',x,.197,z,.007,.002,.007,'#675b44',10);}
          for(const x of[-.55,.55])for(const z of[-.37,.32]){tube([x,-.66,z],[x,.29,z],.031,darkWood);shape('organic',x,.30,z,.043,.014,.043,wood,5);}
          shape('rounded',0,.09,-.30,.62,.035,.048,darkWood,5);shape('rounded',0,.09,.27,.62,.035,.048,darkWood,5);break;
        }
        case'lantern':{
          tube([-.14,0,0],[-.14,.96,0],.026,'#6e7059',10);tube([-.14,.94,0],[.11,.94,0],.024,'#6e7059',10);tube([.11,.94,0],[.11,.83,0],.014,'#6e7059',10);
          shape('rounded',.11,.68,0,.105,.135,.09,'#bf9c66',11);shape('crystal',.11,.85,0,.14,.055,.12,'#7d765b',10);shape('rounded',.11,.53,0,.125,.03,.105,'#7d765b',10);for(const x of[.015,.205])for(const z of[-.08,.08])tube([x,.54,z],[x,.80,z],.012,'#766b4f',10);shape('organic',.11,.68,0,.055,.09,.048,'#e2c491',11);break;
        }
        case'bench':{
          for(let i=0;i<3;i++)shape('rounded',0,.31,-.12+i*.12,.58,.03,.052,i%2?wood:'#a18763',5);for(const x of[-.47,.47])for(const z of[-.10,.11])tube([x,0,z],[x,.31,z],.025,darkWood,10);for(const x of[-.47,.47])tube([x,.24,-.16],[x,.69,-.16],.026,darkWood);for(const y of[.50,.64])shape('rounded',0,y,-.16,.59,.045,.021,wood,5);break;
        }
        case'basket':{
          shape('basket',0,0,0,1,1,1,'#a38a5c',8);for(let i=0;i<12;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12;tube([Math.cos(a)*.22,.33+Math.sin(a)*.27,0],[Math.cos(b)*.22,.33+Math.sin(b)*.27,0],.014,'#a48a59',8);}shape('organic',.02,.16,.04,.115,.06,.12,'#60553e',8);break;
        }
        case'lilies':{
          for(let i=0;i<3;i++){const a=i*2.6,x=Math.cos(a)*.19,z=Math.sin(a)*.17;shape('lily',x,.014+Math.sin(time*.7+i)*.003,z,.22+i*.023,1,.19+i*.015,i%2?'#68825a':'#506e52',6,a);for(let j=0;j<3;j++){const b=a+j*.55;tube([x,.019,z],[x+Math.cos(b)*.16,.032,z+Math.sin(b)*.14],.002,'#879b68',6);}}
          for(let i=0;i<8;i++){const a=i*TAU/8;shape('leaf',Math.cos(a)*.052,.070,Math.sin(a)*.052,.19,.17,.7,'#ceada9',6,a,Math.PI/2+.44);}shape('organic',0,.074,0,.030,.026,.030,'#c5ab62',6);break;
        }
        case'signpost':{
          tube([0,0,0],[0,.77,0],.043,darkWood);shape('rounded',.015,.61,0,.30,.10,.035,wood,5);tube([-.18,.62,.041],[.18,.62,.041],.008,'#6c5940',5);shape('organic',-.23,.62,.044,.008,.008,.004,'#78766b',10);shape('organic',.23,.62,.044,.008,.008,.004,'#78766b',10);shape('tuft',.10,0,-.07,.40,.32,.37,leaf);break;
        }
      }
    }
    function drawDecorations(){
      decorPoints=[];const sizes={tree:[.88,2.1,.8],willow:[.82,1.9,.78],bush:[.73,.82,.65],flowers:[.48,.44,.46],reeds:[.38,.90,.38],rocks:[.57,.48,.48],dock:[.72,.31,.54],lantern:[.32,1.02,.19],bench:[.65,.73,.25],basket:[.28,.64,.26],lilies:[.53,.19,.51],signpost:[.34,.82,.19]},items=decorations().map(d=>({...d,x:Number(d.x)||0,z:Number(d.z)||0}));
      for(const d of items){if(!sizes[d.kind])continue;const factor=Math.max(.3,Math.min(1.8,Number(d.scale)||1)),ground=d.kind==='lilies'?.013:d.kind==='dock'?.018:terrainHeight(d.x,d.z,decorations())+.004,[width,height,depth]=sizes[d.kind],rotation=(Number(d.rotation)||0)*Math.PI/2,c=Math.cos(rotation),s=Math.sin(rotation);
        gl.depthMask(false);const shade=d.kind==='tree'||d.kind==='willow'?.18:.14;if(d.kind!=='lilies'){draw('disc',model(d.x+height*factor*.13,ground+.008,d.z-height*factor*.08,width*factor*1.14,1,depth*factor*1.12,rotation),'#27392b',shade,0,null,9);draw('disc',model(d.x,ground+.011,d.z,width*factor*.48,1,depth*factor*.48,rotation),'#23312b',.21,0,null,9);}if(options.selectedDecorationId===d.id)draw('disc',model(d.x,ground+.015,d.z,width*factor*1.14,1,depth*factor*1.14,rotation),'#dfcc8d',.45,0,null,9);gl.depthMask(true);
        volumeDecoration(d,ground,factor);const box=[];for(const x of[-width,width])for(const z of[-depth,depth])for(const y of[0,height])box.push(project(d.x+(x*c+z*s)*factor,ground+y*factor,d.z+(-x*s+z*c)*factor));const anchor=project(d.x,ground,d.z);decorPoints.push({id:d.id,decoration:d,x:anchor.x,y:anchor.y,left:Math.min(...box.map(p=>p.x))-5,right:Math.max(...box.map(p=>p.x))+5,top:Math.min(...box.map(p=>p.y))-5,bottom:Math.max(...box.map(p=>p.y))+5,depth:anchor.depth,ground});
      }host.dataset.decorations=String(items.length);host.dataset.decorRenderer='volume';
    }
    function reflectedVegetation(){}
    function decorationAt(event){const b=canvas.getBoundingClientRect(),x=event.clientX-b.left,y=event.clientY-b.top;return decorPoints.slice().sort((a,b)=>a.depth-b.depth).find(p=>x>=p.left&&x<=p.right&&y>=p.top&&y<=p.bottom);}
    function worldAt(x,y,ground,initial){let wx=initial.x,wz=initial.z;for(let i=0;i<4;i++){const p=project(wx,ground,wz),a=project(wx+.01,ground,wz),b=project(wx,ground,wz+.01),ax=(a.x-p.x)/.01,ay=(a.y-p.y)/.01,bx=(b.x-p.x)/.01,by=(b.y-p.y)/.01,det=ax*by-ay*bx;if(Math.abs(det)<.001)break;const dx=x-p.x,dy=y-p.y;wx+=(dx*by-dy*bx)/det;wz+=(dy*ax-dx*ay)/det;}return{x:Math.max(-2.65,Math.min(2.65,wx)),z:Math.max(-2.65,Math.min(2.65,wz))};}
    function waterEvent(value){if(destroyed||!value)return;const key=value.at?String(value.at)+':'+value.type:'';if(key&&key===lastWaterKey)return;lastWaterKey=key;waterEvents.push({type:value.type||'cast',x:Math.max(-2.2,Math.min(2.2,Number(value.x)||0)),z:Math.max(-2.2,Math.min(2.2,Number(value.z)||0)),strength:Math.max(.1,Math.min(1.5,Number(value.strength)||1)),birth:time});waterEvents=waterEvents.slice(-8);host.dataset.waterEffect=value.type||'cast';resume();}
    function aquaticDetails(){
      for(let i=0;i<7;i++){const a=i*2.4,r=1.65+(i%2)*.12,x=Math.cos(a)*r,z=Math.sin(a)*r;if(!waterCell(x,z))continue;for(let j=0;j<3;j++){const sway=Math.sin(time*.7+i+j)*.1;draw('leaf',matMul(model(x+j*.04,-.3,z,.045,.22+(j%2)*.06,.14,a),tilt(0,.2+sway)),i%2?'#587a60':'#668369',.72,0,null,6);}}
      for(const event of waterEvents){const age=time-event.birth;if(age>.95||['bite','escape','nibble','surge','rest'].includes(event.type))continue;const count=event.type==='catch'||event.type==='caught'?8:5;for(let i=0;i<count;i++){const a=i*TAU/count,r=age*(.2+(i%3)*.06),y=.04+Math.sin(age*Math.PI)*(.22+event.strength*.13)-age*.1,size=.011*(1-age*.5);draw('sphere',model(event.x+Math.cos(a)*r,y,event.z+Math.sin(a)*r,size,size*1.5,size),'#c5ede6',Math.max(0,.55-age*.5));}}
    }
    function aquariumDecorations(){return Array.from(new Set((options.aquariumDecorations||['water_grass','pebble_garden']).filter(id=>AQUARIUM_DECOR.includes(id)))).slice(0,3);}
    // All miniature hardware is modelled in the ornament's local coordinates.
    // Curved wires and turned surfaces are cached; no geometry is allocated per frame.
    function propWire(key,points,r,matrix,tone,material=29,alpha=1){if(!mesh[key])mesh[key]=upload(fishTubeMesh(points,r,r));draw(key,matrix,tone,alpha,0,null,material);}
    function propRing(matrix,tone,material=29,alpha=1){if(!mesh.propRing)mesh.propRing=upload(fishTubeMesh(Array.from({length:41},(_,i)=>[Math.cos(i*TAU/40),0,Math.sin(i*TAU/40)]),.023,.023));draw('propRing',matrix,tone,alpha,0,null,material);}
    function propLathe(key,profile,matrix,tone,material=34,alpha=1){if(!mesh[key])mesh[key]=upload(fishSurface((u,v)=>{const p=fishCurve(profile.map(p=>[p[0],p[1],0]),u),a=-v*TAU;return[Math.max(.001,p[0])*Math.cos(a),p[1],Math.max(.001,p[0])*Math.sin(a)];},40,48));draw(key,matrix,tone,alpha,0,null,material);}
    function aquariumArtDetails(id,part,base,index){
      const t=reducedAquarium?0:time,gold='#cfb57a',jade='#7aa38b',milk='#e1dfca',wire=(key,pts,r,color=gold,material=29)=>propWire('prop-'+key,pts,r,base,color,material);
      const ring=(x,y,z,r,color=gold,rx=0,material=29)=>propRing(part(x,y,z,r,r,r,0,rx),color,material);
      if(id==='water_grass'){
        for(let k=0;k<5;k++){const a=k*2.39;wire('grass-root-'+k,[[0,.035,0],[Math.cos(a)*.13,.015,Math.sin(a)*.13],[Math.cos(a)*.27,.005,Math.sin(a)*.24]],.013,'#6f8060',6);}
        for(let k=0;k<3;k++){const sway=Math.sin(t*.65+k)*.04;draw('leaf',part(.10+k*.045,.40+k*.06,.06,.11,.31,.24,1+k,.04,sway),'#a1ae73',1,0,null,6);}
      }else if(id==='pebble_garden'){
        for(let k=0;k<5;k++){const a=k*.42;draw('organic',part(-.17+Math.cos(a)*.20,.27+Math.sin(a)*.11,.21,.046,.022,.026,k),'#99a47c',1,0,null,6);}
        wire('pebble-vein',[[-.25,.40,.05],[-.13,.41,.12],[.005,.33,.24],[.035,.21,.26]],.006,'#c3c8ad',7);
        for(let k=0;k<3;k++)draw('shell',part(.19+k*.10,.025,.33, .09,.07,.09,k),'#d2c7ad',1,0,null,37);
      }else if(id==='pearl_shell'){
        for(let k=0;k<9;k++){const a=-1.03+k*.257,px=Math.sin(a)*.30,pz=Math.cos(a)*.28;draw('sphere',part(px,.035,pz,.018,.016,.020),'#d9c6b5',1,0,null,37);}
        draw('sphere',part(-.23,.042,.24,.029,.029,.029),'#dfdaca',1,0,null,24);
        draw('sphere',part(.27,.055,.11,.043,.043,.043),'#dddac6',1,0,null,24);
      }else if(id==='jade_arch'){
        for(const side of[-1,1]){
          wire('jade-scroll-'+side,[[side*.48,.22,.142],[side*.44,.31,.15],[side*.55,.39,.15],[side*.50,.46,.145]],.008,gold);
          wire('jade-side-'+side,[[side*.56,.10,.144],[side*.56,.47,.144],[side*.46,.77,.144],[side*.25,.92,.144]],.006,'#bdd1b0',22);
          draw('rounded',part(side*.51,.15,.125,.025,.033,.012),'#d5c08a',1,0,null,29);
        }
        draw('sphere',part(0,1.012,.145,.063,.065,.032),'#bad7b8',1,0,null,22);
        ring(0,1.012,.155,.074,gold,Math.PI/2);
      }else if(id==='moon_crystal'){
        ring(0,.041,0,.31,'#a9bcb3');
        for(let k=0;k<5;k++){const a=k*2.39;draw('crystal',part(Math.cos(a)*.30,.055,Math.sin(a)*.21,.023,.055,.025,a),'#b5d9d8',1,0,null,23);}
        wire('moon-seat',[[.11,.08,.015],[.23,.30,.015],[.25,.55,.015],[.28,.63,.015]],.009,gold);
      }else if(id==='sunken_chest'){
        for(const px of[-.255,.255])for(const py of[.10,.32])draw('sphere',part(px,py,.269,.012,.012,.006),'#d1b17b',1,0,null,36);
        for(let k=0;k<3;k++)wire('chest-seam-'+k,[[-.355,.105+k*.095,.256],[0,.100+k*.095,.257],[.355,.105+k*.095,.257]],.0035,'#403e30',5);
        ring(.06,.438,.04,.08,'#b8a176',Math.PI*.13,36);
        draw('crystal',part(-.13,.49,.07,.047,.057,.043,.4),'#7baa9a',1,0,null,23);
        for(let k=0;k<4;k++)draw('organic',part(.29+k*.04,.063,.25+k*.024,.04,.022,.033),'#9faaa0',1,0,null,7);
      }else if(id==='glass_observatory'){
        propLathe('observatory-foot',[[.001,0],[.37,0],[.39,.045],[.35,.087],[.34,.105]],base,'#727762',36);
        ring(0,.11,0,.35);ring(0,.062,0,.385);
        for(let k=0;k<12;k++){const a=k*TAU/12;draw('sphere',part(Math.cos(a)*.367,.045,Math.sin(a)*.367,.011,.012,.011),gold,1,0,null,29);}
        propLathe('observatory-sand',[[.001,.112],[.20,.132],[.30,.119],[.331,.11]],base,'#c8c3a0',27);
        draw('crescent',part(.04,.40,0,.18,.18,.042,-.13,0,-.50),'#dfc68c',1,0,null,29);
        wire('observatory-stem',[[0,.13,0],[.03,.20,0],[.035,.25,0]],.012,gold);
        for(let k=0;k<7;k++){const a=k*2.4;draw('star',part(Math.cos(a)*.19,.14+Math.sin(k)*.025,Math.sin(a)*.21,.020,.020,.015,.1,Math.PI/2),k%2?'#a5bfbd':gold,1,0,null,24);}
        ring(.025,.36,0,.23,'#a2b9ae',.47,29);
        if(!mesh.observatoryDome)mesh.observatoryDome=upload(fishSurface((u,v)=>{const a=v*TAU,b=u*Math.PI/2;return[Math.cos(a)*Math.cos(b)*.346,.113+Math.sin(b)*.585,Math.sin(a)*Math.cos(b)*.346];},26,48));
        gl.depthMask(false);draw('observatoryDome',base,'#a1d3cc',.95,0,null,35);gl.depthMask(true);
        draw('sphere',part(0,.713,0,.038,.041,.038),gold,1,0,null,29);
      }else if(id==='jade_koi_seal'){
        propLathe('koi-seal-foot',[[.001,.005],[.35,.005],[.37,.047],[.34,.08],[.34,.15],[.30,.195],[.001,.195]],base,'#648e7c',22);
        ring(0,.078,0,.356,gold);ring(0,.168,0,.325,'#b8cdb0',0,22);
        const koi=[[-.26,.28,.13,.009,.80],[-.31,.40,.02,.050,.82],[-.16,.57,-.10,.104,.83],[.05,.61,-.13,.134,.85],[.23,.51,-.04,.128,.82],[.28,.38,.10,.055,.8]];
        if(!mesh.jadeSealKoi)mesh.jadeSealKoi=upload(fishTubeMesh(koi,.10,.018));draw('jadeSealKoi',base,jade,1,0,null,23);
        draw('tail',part(-.26,.29,.13,.30,.30,.25,-.7,.15,.70),'#92b09a',1,0,null,23);
        if(!mesh.jadeKoiDorsal)mesh.jadeKoiDorsal=upload(fishSurface((u,v)=>{const a=-.68+u*1.5,r=.327+Math.sin(u*Math.PI)*.14*v;return[Math.sin(a)*r,.36+Math.cos(a)*r,-.09-v*.034];},20,8));draw('jadeKoiDorsal',base,'#a1bfa2',1,0,null,23);
        wire('koi-gill',[[.21,.55,.095],[.28,.51,.096],[.28,.46,.13]],.005,'#447e6b',23);
        wire('koi-mouth',[[.23,.354,.132],[.28,.342,.153],[.32,.362,.135]],.004,'#3e705f',23);
        for(let k=0;k<8;k++){const a=-.68+k*.165,x=Math.sin(a)*.275,y=.37+Math.cos(a)*.275;wire('koi-scale-'+k,[[x-.022,y-.015,.027],[x,y-.029,.042],[x+.022,y-.012,.027]],.0035,'#bad0ab',23);}
        for(const side of[-1,1]){draw('leaf',part(.04,.60,-.13+side*.07,.16,.24,.21,side*.8,.3,side*.8),'#9cbaa0',1,0,null,23);draw('sphere',part(.26,.448,.080+side*.046,.017,.018,.013),gold,1,0,null,29);draw('sphere',part(.266,.449,.087+side*.048,.007,.008,.005),'#234b42',1,0,null,22);}
        for(let k=0;k<5;k++){const a=k*TAU/5;wire('seal-wave-'+k,[[Math.cos(a)*.341,.11,Math.sin(a)*.341],[Math.cos(a+.16)*.345,.13,Math.sin(a+.16)*.345],[Math.cos(a+.32)*.345,.108,Math.sin(a+.32)*.345]],.006,gold);}
        draw('sphere',part(.29,.25,.16,.063,.063,.063),'#d5dab8',1,0,null,24);
      }else if(id==='sunken_astrolabe'){
        propLathe('astrolabe-pedestal',[[.001,.005],[.30,.005],[.32,.038],[.26,.087],[.17,.103],[.11,.32],[.001,.35]],base,'#8d825d',36);
        ring(0,.066,0,.27,gold,0,36);
        const sway=Math.sin(t*.22+index)*.055;
        propRing(part(0,.66,0,.32,.32,.32,.35,Math.PI/2,.20),gold,36);
        propRing(part(0,.66,0,.28,.28,.28,-.2+sway,.50), '#829d8d',36);
        propRing(part(0,.66,0,.22,.22,.22,.65-sway,-.47), '#c4ad74',29);
        draw('sphere',part(0,.66,0,.052,.052,.052),'#c5c9a4',1,0,null,24);
        for(let k=0;k<12;k++){const a=k*TAU/12;draw('rounded',part(Math.cos(a)*.317,.66+Math.sin(a)*.317,.009,.008,k%3?.014:.024,.008,0,0,a-Math.PI/2),'#e0c78d',1,0,null,29);}
        wire('astrolabe-spindle',[[0,.35,0],[0,.66,0],[0,1.01,0]],.011,'#bba373',36);
        draw('sphere',part(0,1.013,0,.024,.030,.024),gold,1,0,null,29);
      }else if(id==='coral_conch'){
        const points=Array.from({length:65},(_,k)=>{const u=k/64,a=u*Math.PI*4.65-2.1,r=.022*Math.exp(2.65*u);return[Math.cos(a)*r,.24+Math.sin(a)*r*.87,-u*.045,.005+r*.64,1.02];});
        if(!mesh.conchSpiral)mesh.conchSpiral=upload(fishTubeMesh(points,.10,.01));draw('conchSpiral',part(0,.10,0,1,1,1,.30),'#e2c6b3',1,0,null,37);
        propLathe('conch-cushion',[[.001,.005],[.34,.005],[.37,.025],[.28,.048],[.001,.06]],base,'#b7b9a0',7);
        for(let k=0;k<5;k++){const px=-.35+k*.165;wire('conch-coral-'+k,[[px*.8,.02,-.15],[px,.22,-.19],[px+Math.sin(k)*.07,.46+k%2*.14,-.18]],.023,k%2?'#bc939d':'#d1a38d',37);wire('conch-fork-'+k,[[px,.20,-.19],[px+.06,.28,-.17],[px+.11,.36,-.16]],.015,'#d6aba7',37);}
        for(let k=0;k<3;k++){draw('sphere',part(.14+k*.055,.035,.21-k*.02,.022,.022,.022),'#e6dac3',1,0,null,24);}
        draw('star',part(-.25,.037,.18,.082,.082,.025,.4,Math.PI/2),'#d2aa88',1,0,null,37);
      }else if(id==='porcelain_pagoda'){
        propLathe('lighthouse-body',[[.001,0],[.30,0],[.32,.05],[.27,.105],[.23,.15],[.185,.62],[.18,.69],[.21,.72],[.21,.755],[.001,.755]],base,'#91b7a8',34);
        for(const py of[.10,.67,.745])ring(0,py,0,py===.10?.275:.205,'#c1cfac',0,34);
        for(let k=0;k<5;k++){const a=k*TAU/5;wire('porcelain-wave-'+k,[[Math.cos(a)*.255,.15,Math.sin(a)*.255],[Math.cos(a+.18)*.253,.19,Math.sin(a+.18)*.253],[Math.cos(a+.37)*.243,.205,Math.sin(a+.37)*.243]],.006,'#557f76',34);}
        draw('rounded',part(0,.22,.244,.055,.09,.014),'#42635b',1,0,null,34);ring(0,.21,.255,.064,'#bcc9a7',Math.PI/2,34);
        for(let k=0;k<4;k++){const a=k*TAU/4;draw('cylinder',matMul(base,segment([Math.cos(a)*.155,.76,Math.sin(a)*.155],[Math.cos(a)*.155,.97,Math.sin(a)*.155],.013)),gold,1,0,null,29);}
        draw('sphere',part(0,.86,0,.065,.083,.065),'#e1d3a4',1,0,null,24);
        propLathe('lighthouse-cap',[[.001,1.15],[.045,1.11],[.10,1.045],[.21,.99],[.27,.96],[.275,.945],[.19,.95]],base,'#6b998c',34);
        draw('sphere',part(0,1.16,0,.026,.030,.026),gold,1,0,null,29);
        gl.depthMask(false);propLathe('lighthouse-glass',[[.163,.76],[.163,.96]],base,'#bfd8c8',35,.65);gl.depthMask(true);
      }else if(id==='ribbon_jellyfish'){
        propLathe('jelly-foot',[[.001,0],[.27,0],[.29,.04],[.23,.075],[.001,.08]],base,'#9ca78b',34);
        wire('jelly-arm',[[.16,.045,-.05],[.34,.24,-.12],[.34,.89,-.09],[.18,1.20,0],[0,1.18,0]],.013,'#b0b995',29);
        const bob=Math.sin(t*.66)*.022,sway=Math.sin(t*.49)*.065,bell=part(0,.81+bob,0,1,1,1,0,0,sway);
        if(!mesh.jellyBell)mesh.jellyBell=upload(fishSurface((u,v)=>{const a=v*TAU,r=.29*Math.sin(u*Math.PI/2)*(1+.032*Math.cos(a*12));return[Math.cos(a)*r,.24*Math.cos(u*Math.PI/2)-.027*Math.sin(a*6)**2*Math.pow(u,8),Math.sin(a)*r];},24,48));
        wire('jelly-thread',[[0,1.18,0],[0,1.03,0]],.004,'#d4dfc8',29);
        for(let k=0;k<7;k++){const a=k*TAU/7,rotation=a+Math.sin(t*.38+k)*.08;propWire('jelly-ribbon-'+k,[[Math.cos(a)*.17,0,Math.sin(a)*.17],[Math.cos(a+.18)*.14,-.14,Math.sin(a+.18)*.14],[Math.cos(a+.65)*.17,-.32,Math.sin(a+.65)*.17],[Math.cos(a+.95)*.13,-.49-k%2*.045,Math.sin(a+.95)*.13]],.010,matMul(bell,model(0,0,0,1,1,1,rotation-a)),k%2?'#b9cfc3':'#bcb9d1',24,.83);}
        draw('sphere',matMul(bell,model(0,.10,0,.079,.058,.079)),'#d5c1d2',.62,0,null,24);
        gl.depthMask(false);draw('jellyBell',bell,'#b7d6d7',.96,0,null,35);gl.depthMask(true);
        propRing(matMul(bell,model(0,-.008,0,.287,.19,.287)),'#d4cfbb',29,.75);
      }
    }
    function aquariumProps(){
      const selected=aquariumDecorations(),slots=selected.length===1?[[-1.30,-.48]]:selected.length===2?[[-1.56,-.47],[1.41,-.42]]:[[-1.61,-.47],[.07,-.62],[1.46,-.49]];
      for(let index=0;index<selected.length;index++){
        const id=selected[index],[x,z]=slots[index],y=aquariumSandHeight(x,z)+.015,s=id==='jade_arch'?.74:id==='moon_crystal'?.73:.83,base=model(x,y,z,s,s,s,.10-index*.09),part=(px,py,pz,sx,sy,sz,ry=0,rx=0,rz=0)=>matMul(base,matMul(model(px,py,pz,sx,sy,sz,ry),tilt(rx,rz))),tone=id==='pebble_garden'?'#626a5b':'#6d7663';
        gl.depthMask(false);draw('disc',model(x,y-.004,z,.59,1,.35),'#192921',.19,0,null,9);gl.depthMask(true);
        if(id==='water_grass'){
          for(let k=0;k<15;k++){const a=k*2.399,h=.56+(k%5)*.105,px=Math.cos(a)*(.06+(k%4)*.036),pz=Math.sin(a)*(.07+(k%3)*.032),sway=Math.sin(time*.46+k*.63)*.028;draw('leaf',part(px,h*.46,pz,.18+(k%3)*.019,h,.45,a,.09*Math.sin(a),.12*Math.cos(a)+sway),k%3===0?'#79936a':k%3===1?'#4a775b':'#5b8966',1,0,null,6);}
          for(let k=0;k<4;k++)draw('organic',part((k-1.5)*.13,.035,.08+Math.sin(k*2)*.08,.12,.07,.095,k*1.6),k%2?'#797b68':'#96937d',1,0,null,7);
        }else if(id==='pebble_garden'){
          const stones=[[-.19,.21,.02,.31,.29,.25,-.3],[.26,.12,.12,.25,.17,.21,.7],[.13,.36,-.16,.20,.43,.20,-.2],[-.38,.063,.24,.15,.09,.13,.4],[.39,.043,.31,.14,.068,.11,.9]];
          for(let k=0;k<stones.length;k++){const a=stones[k];draw('organic',part(a[0],a[1],a[2],a[3],a[4],a[5],a[6],.1,k%2*.16),k===2?'#596b68':k%2?'#829080':'#68766b',1,0,null,7);}
          for(let k=0;k<7;k++){const a=k*2.4;draw('leaf',part(-.37+Math.cos(a)*.055,.10+k%3*.015,-.16+Math.sin(a)*.06,.055,.22,.20,a,0,.18),tone,1,0,null,6);}
        }else if(id==='pearl_shell'){
          draw('shell',part(0,.04,.02,1.05,.75,1.1),'#d8c5b7',1,0,null,37);
          draw('shell',part(0,.29,-.18,1.07,1.12,1.10,0,-1.12,0),'#d8c8bd',1,0,null,37);
          draw('sphere',part(.015,.215,.055,.135,.135,.135),'#eadfd1',1,0,null,24);
          draw('sphere',part(-.017,.262,.138,.026,.020,.008),'#fcf5de',.8,0,null,11);
        }else if(id==='jade_arch'){
          draw('arch',base,'#739584',1,0,null,22);
          for(const px of[-.515,.515]){draw('rounded',part(px,.045,0,.16,.049,.20),'#70897c',1,0,null,22);draw('box',part(px,.085,0,.153,.012,.19),'#c9b58a',1,0,null,29);}
          for(let k=0;k<5;k++){const a=.18+Math.PI*k/4*.89,px=Math.cos(a)*.524,py=.49+Math.sin(a)*.524;draw('sphere',part(px,py,.124,.025,.029,.012),'#d7cba8',1,0,null,29);}
        }else if(id==='moon_crystal'){
          draw('organic',part(0,.035,0,.42,.06,.27),'#9ba89c',1,0,null,7);
          for(const [px,py,pz,sx,sy,sz,rz]of[[-.08,.32,-.025,.14,.31,.13,-.13],[-.29,.17,.11,.10,.17,.10,.19],[.21,.23,.10,.11,.23,.12,-.22],[.10,.14,-.16,.09,.15,.09,.17]])draw('crystal',part(px,py,pz,sx,sy,sz,.3,.06,rz),'#aecbcc',1,0,null,23);
          draw('crescent',part(.28,.72,-.015,.12,.12,.025,.12,0,-.18),'#d6c494',1,0,null,29);
        }else if(id==='sunken_chest'){
          const box=part(0,.21,0,.40,.20,.25,.05);draw('rounded',box,'#695844',1,0,null,5);draw('rounded',part(0,.475,-.18,.405,.16,.265,.05,-.67),'#806a4e',1,0,null,5);draw('box',part(0,.421,.02,.34,.012,.19,.05),'#303b32',1,0,null,4);
          for(const px of[-.255,.255]){draw('box',part(px,.215,.252,.035,.178,.01,.05),'#aa9164',1,0,null,29);draw('box',part(px,.436,-.045,.037,.024,.208,.05,-.67),'#bfa572',1,0,null,29);}
          draw('rounded',part(0,.25,.258,.060,.063,.018),'#c6ad79',1,0,null,29);draw('sphere',part(0,.255,.280,.012,.019,.007),'#3b4438',1,0,null,4);
          for(let k=0;k<7;k++)draw('sphere',part((k%3-1)*.11,.44+(k%2)*.016,.075-Math.floor(k/3)*.09,.071,.017,.067,k*.8),'#d2b16b',1,0,null,29);
        }
        aquariumArtDetails(id,part,base,index);
      }
    }
    function aquariumScene(){
      const selected=aquariumDecorations();host.dataset.fishCount=String(fish.length);host.dataset.decorations=JSON.stringify(selected);host.dataset.aquariumFishCount=String(fish.length);host.dataset.aquariumDecorations=selected.join(',');host.dataset.aquariumMotion=reducedAquarium?'reduced':'live';host.dataset.aquariumArt='volume';
      aquariumTransparent=shadowPass?null:[];
      gl.uniform3fv(u.Eye,aquariumView.eye);gl.uniform1f(u.Species,-1);gl.uniform1f(u.FishFeed,0);gl.uniform1f(u.MotionEnabled,0);
      // Shadow catcher lies on the same tabletop as the four recessed feet.
      // It has no opaque colour and never participates in native mouse hits.
      gl.depthMask(false);draw('disc',model(.22,-1.719,.18,3.35,1,2.24),'#061510',1,0,null,40);gl.depthMask(true);
      // Recessed feet and solid, low-profile walnut plinth keep the glass itself
      // visually light. Thin champagne anodised edges catch the studio light.
      for(const x of[-1.80,1.80])for(const z of[-1.00,1.00])draw('rounded',model(x,-1.635,z,.27,.082,.20),'#272b27',1,0,null,4);
      draw('box',model(0,-1.405,0,2.42,.17,1.42),'#49392c',1,0,null,28);
      draw('box',model(0,-1.245,0,2.435,.018,1.435),'#bdad8b',1,0,null,29);
      draw('box',model(0,-1.574,0,2.402,.012,1.405),'#655b4b',1,0,null,29);
      draw('box',model(0,-1.224,0,2.30,.007,1.32),'#adbaa6',1,0,null,29);
      draw('rounded',model(0,-1.415,1.426,.31,.043,.006),'#a99874',1,0,null,29);
      // A small engraved emblem is part of the hardware, not a floating label.
      draw('sphere',model(0,-1.413,1.434,.014,.014,.002),'#4b4c3e',1,0,null,4);
      draw('box',model(0,-1.157,0,2.24,.057,1.26),'#8d8b74',1,0,null,27);draw('sand',model(0,0,0,1,1,1),'#c2bda7',1,0,null,27);
      // Fine pebbles lie in the same graded bed, with small natural variation.
      for(let k=0;k<61;k++){const seed=hash('aquarium-grain-'+k),x=-2.12+(seed%1000)/1000*4.24,z=-1.20+(Math.floor(seed/1000)%1000)/1000*2.39,r=.014+(seed%9)*.0034;draw('organic',model(x,aquariumSandHeight(x,z)+r*.27,z,r,r*.52,r*.82,k*2.4),['#9c9a83','#c1bba2','#777e70','#b0ac95'][k%4],1,0,null,7);}
      aquariumProps();
      points=fish.map((f,i)=>{const pose=drawFish(f,i),p=project(pose.x,pose.y,pose.z);return{x:p.x,y:p.y,fish:f};});
      gl.uniform1f(u.Species,-1);gl.uniform1f(u.FishFeed,0);gl.uniform1f(u.MotionEnabled,0);
      if(feeding&&time-feedStart<4.8)for(let k=0;k<9;k++){const t=time-feedStart,fall=Math.min(1,t*.40),x=(k%3-1)*.63,z=(Math.floor(k/3)-1)*.21;draw('sphere',model(x,1.10-fall*1.91,z,.016,.014,.016),'#bcaa7c',Math.max(.1,1-t/5));}
      gl.depthMask(false);
      draw('waterSurface',model(0,1.14,0,2.255,1,1.256),'#86bcb0',1,0,null,26);
      // Four real panes and the water volume remain correct from every side.
      // Their draw calls join glass ornaments, bubbles and edge highlights in
      // one depth-sorted transparent pass after all opaque inhabitants.
      for(const sign of[-1,1]){
        const frontZ=sign*aquariumView.eye[2]>0,frontX=sign*aquariumView.eye[0]>0;
        draw('panel',model(0,.065,sign*1.295,2.29,1.285,1),'#c3ded2',.84,0,null,25);
        draw('panel',model(sign*2.29,.065,0,1.295,1.285,1,Math.PI/2),'#c3ded2',.84,0,null,25);
        draw('panel',model(0,.015,sign*1.275,2.25,1.125,1),'#86bcb0',frontZ?.038:.24,0,null,32);
        draw('panel',model(sign*2.265,.015,0,1.255,1.125,1,Math.PI/2),'#86bcb0',frontX?.038:.24,0,null,32);
      }
      // Water rises slightly at the pane; two closely spaced highlights provide
      // the meniscus and polished glass thickness without a heavy top frame.
      for(const z of[-1.29,1.29]){
        draw('cylinder',segment([-2.29,1.35,z],[2.29,1.35,z],.012),'#c2d8c7',.69,0,null,29);
        draw('cylinder',segment([-2.27,1.325,z-.011],[2.27,1.325,z-.011],.006),'#4f827b',.44,0,null,29);
        draw('cylinder',segment([-2.25,1.14,z*.973],[2.25,1.14,z*.973],.008),'#c5e6d6',.54,0,null,29);
      }
      for(const x of[-2.29,2.29]){
        draw('cylinder',segment([x,1.35,-1.29],[x,1.35,1.29],.013),'#d3e6d7',.68,0,null,29);
        for(const z of[-1.29,1.29]){draw('box',model(x,.065,z,.013,1.285,.012),'#89b4a5',.35,0,null,29);draw('cylinder',segment([x-.013,-1.19,z+.012],[x-.013,1.34,z+.012],.005),'#ebf6e6',.58,0,null,29);}
        draw('cylinder',segment([x*.985,1.14,-1.255],[x*.985,1.14,1.255],.008),'#b7d9c7',.45,0,null,29);
      }
      // An unobtrusive capillary stream tucked into the planted corner.
      for(let k=0;k<4;k++){const age=(time*.13+k*.26)%1,y=-.58+age*1.62,r=.010+(k%3)*.004;draw('sphere',model(-2.025+Math.sin(age*5+k)*.026,y,-.96,r,r*1.08,r),'#dbece0',(Math.sin(age*Math.PI))*.48,0,null,18);}
      const layers=aquariumTransparent;aquariumTransparent=null;
      if(layers){layers.sort((a,b)=>a.depth-b.depth);gl.depthMask(false);for(const layer of layers)draw(...layer.args);}
      gl.depthMask(true);
    }
    function sampleAquariumTurn(now){
      if(!aquariumTurn)return;
      const progress=Math.max(0,(now-aquariumTurn.at)/280);
      aquariumYaw=progress>=1?aquariumTargetYaw:aquariumTurnAt(aquariumTurn.from,aquariumTargetYaw,progress);
      if(progress>=1)aquariumTurn=null;
    }
    function setAquariumYaw(value){
      if(!aquarium||!Number.isFinite(value))return;
      const target=normalizeAquariumYaw(value);if(target===aquariumTargetYaw)return;
      const now=win.performance.now();sampleAquariumTurn(now);aquariumTargetYaw=target;
      if(reducedAquarium){aquariumYaw=target;aquariumTurn=null;}else aquariumTurn={from:aquariumYaw,at:now};
      resume();
    }
    function getAquariumBounds(){
      if(!aquarium||!projection)return null;
      const box=(xs,ys,zs)=>{const corners=[];for(const x of xs)for(const y of ys)for(const z of zs)corners.push(project(x,y,z));const left=Math.min(...corners.map(p=>p.x))/projection.width,top=Math.min(...corners.map(p=>p.y))/projection.height,right=Math.max(...corners.map(p=>p.x))/projection.width,bottom=Math.max(...corners.map(p=>p.y))/projection.height;return{left,top,width:right-left,height:bottom-top};};
      return{tank:box([-2.31,2.31],[-1.22,1.365],[-1.31,1.31]),base:box([-2.44,2.44],[-1.66,-1.22],[-1.44,1.44])};
    }
    function scene(){
      if(destroyed||gl.isContextLost()||doc.hidden||!host.isConnected||!visible)return;
      if(aquarium){sampleAquariumTurn(win.performance.now());host.dataset.aquariumYaw=String(Number(aquariumYaw.toFixed(5)));}
      host.dataset.fishCount=String(fish.length);
      if(feeding&&time-feedStart>4.8){feeding=null;delete host.dataset.feeding;}
      const bounds=host.getBoundingClientRect(),w=Math.max(1,bounds.width),h=Math.max(1,bounds.height||250),dpr=Math.min(1.75,Math.max(1.5,win.devicePixelRatio||1));if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);if(aquarium)aquariumView=aquariumCamera(w/h,aquariumYaw);const vp=aquarium?aquariumView.view:viewProjection(w/h,yaw,zoom,options.figureOnly);gl.uniformMatrix4fv(u.View,false,vp);gl.uniform1f(u.Time,time);gl.uniform1f(u.Aquarium,aquarium?1:0);
      gl.uniform3fv(u.Eye,[Math.sin(yaw)*6.8*zoom,7.8*zoom,Math.cos(yaw)*6.8*zoom]);
      projection={view:vp,width:w,height:h};
      if(shadowMap){shadowPass=true;shadowMap.begin();gl.uniformMatrix4fv(u.View,false,shadowMap.matrix);renderContents();shadowPass=false;shadowMap.end(canvas.width,canvas.height,options.shadows!==false);gl.enable(gl.BLEND);gl.uniformMatrix4fv(u.View,false,vp);}
      renderContents();
      if(aquarium){const key=[aquariumYaw,w,h].join(':');if(key!==aquariumBoundsKey||options.onBoundsChange!==aquariumBoundsCallback){aquariumBoundsKey=key;aquariumBoundsCallback=options.onBoundsChange;if(typeof aquariumBoundsCallback==='function')aquariumBoundsCallback(getAquariumBounds());}}
      function renderContents(){if(aquarium){aquariumScene();return;}if(options.figureOnly){gl.uniform3fv(u.Eye,[Math.sin(yaw)*2.3,.66,Math.cos(yaw)*2.3]);points=fish.map((f,i)=>{drawFish(f,i);return{...project(0,0,0),fish:f};});host.dataset.figureArt='volume';return;}const style=pondStyle(options.pond);pondStructure(style);drawDecorations();
      waterEvents=waterEvents.filter(e=>time-e.birth<4);if(!waterEvents.length)delete host.dataset.waterEffect;
      for(let i=0;i<8;i++){const e=waterEvents[i];rippleData.set(e?[e.x,e.z,e.birth,e.strength]:[0,0,-100,0],i*4);}gl.uniform4fv(u.Ripples,rippleData);
      for(let i=0;i<5;i++){const pose=fish[i]&&fishPose(fish[i],i);swimmerData.set(pose?[pose.x,pose.z,1]:[0,0,0],i*3);}gl.uniform3fv(u.Swimmers,swimmerData);
      gl.depthMask(false);for(let i=0;i<fish.length;i++){const p=fishPose(fish[i],i);draw('disc',model(p.x,-.649,p.z,.33,1,.18,p.angle),'#2b493e',.12,0,null,9);}gl.depthMask(true);
      points=fish.map((f,i)=>{const pose=drawFish(f,i),p=project(pose.x,pose.y,pose.z);return{x:p.x,y:p.y,fish:f};});
      aquaticDetails();
      gl.depthMask(false);draw('water',model(0,0,0,1,1,1),palette.water,.40,1);gl.depthMask(true);
      pondRim(style);
      if(feeding&&time-feedStart<4.8)for(let i=0;i<12;i++){const t=time-feedStart,fall=Math.min(1,t*1.3),a=i*2.399,r=.35+(i%4)*.29;draw('sphere',model(Math.cos(a)*r,.65-fall*.86,Math.sin(a)*r,.019,.017,.019),'#e3bc78',Math.max(.1,1-t/5));}
    }
    }
    function tick(stamp){raf=0;if(destroyed||!visible||doc.hidden)return;if(stamp-last>=32){time+=Math.min(.1,(stamp-last)/1000||0);last=stamp;scene();}raf=win.requestAnimationFrame(tick);}
    function resume(){if(!destroyed&&visible&&!doc.hidden&&!raf&&!reducedAquarium){last=win.performance.now();raf=win.requestAnimationFrame(tick);}}
    function visibility(){if(doc.hidden&&raf){win.cancelAnimationFrame(raf);raf=0;}else{if(aquarium)scene();resume();}}
    function aquariumMotion(){if(!aquarium||destroyed)return;reducedAquarium=options.reducedMotion===undefined?!!motionQuery?.matches:!!options.reducedMotion;host.dataset.aquariumMotion=reducedAquarium?'reduced':'live';if(reducedAquarium){aquariumYaw=aquariumTargetYaw;aquariumTurn=null;if(raf){win.cancelAnimationFrame(raf);raf=0;}feeding=null;delete host.dataset.feeding;}scene();resume();}
    function down(event){if(!options.interactive)return;const hit=options.editing?decorationAt(event):null;drag={x:event.clientX,y:event.clientY,yaw,moved:false,hit};if(hit){localDecorations=decorations().map(d=>({...d}));const b=canvas.getBoundingClientRect();drag.offset={x:event.clientX-b.left-hit.x,y:event.clientY-b.top-hit.y};}canvas.setPointerCapture?.(event.pointerId);}
    function move(event){if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.moved=drag.moved||Math.hypot(dx,dy)>4;if(drag.hit){const b=canvas.getBoundingClientRect(),target=worldAt(event.clientX-b.left-drag.offset.x,event.clientY-b.top-drag.offset.y,drag.hit.ground,drag.hit.decoration),row=localDecorations.find(d=>d.id===drag.hit.id);Object.assign(row,target);scene();}else if(!options.editing)yaw=drag.yaw+dx*.008;}
    function up(event){const gesture=drag;drag=null;if(gesture?.hit){const row=localDecorations?.find(d=>d.id===gesture.hit.id);if(gesture.moved&&row&&typeof options.onDecorationMove==='function')options.onDecorationMove({id:row.id,x:Math.round(row.x*100)/100,z:Math.round(row.z*100)/100});else if(typeof options.onDecorationSelect==='function')options.onDecorationSelect(gesture.hit.id);return;}if(!gesture?.moved&&!options.editing&&typeof options.onSelect==='function'){const b=canvas.getBoundingClientRect(),x=event.clientX-b.left,y=event.clientY-b.top,closest=points.slice().sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(closest&&Math.hypot(closest.x-x,closest.y-y)<45)options.onSelect(closest.fish);}}
    function lost(){drag=null;}
    function wheel(event){if(!options.interactive)return;event.preventDefault();zoom=Math.max(.76,Math.min(1.38,zoom+event.deltaY*.00065));scene();}
    function feed(value){if(!value)return;const key=String(value.at||value.id||'');if(key&&key===feedingKey||Number.isFinite(value.at)&&Date.now()-value.at>12000)return;feedingKey=key;if(reducedAquarium){feeding=null;delete host.dataset.feeding;scene();return;}feeding=value;feedStart=time;host.dataset.feeding='true';resume();}
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',lost);canvas.addEventListener('wheel',wheel,{passive:false});doc.addEventListener('visibilitychange',visibility);
    // Native desktop scaling changes CSS zoom without changing layout-box
    // dimensions. Refresh the drawing buffer even when motion is disabled.
    if(aquarium){motionQuery?.addEventListener?.('change',aquariumMotion);win.addEventListener('resize',scene);}
    const aquariumResize=aquarium&&win.ResizeObserver?new win.ResizeObserver(()=>scene()):null;aquariumResize?.observe(host);
    if(win.IntersectionObserver){observer=new win.IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible&&raf){win.cancelAnimationFrame(raf);raf=0;}else{if(aquarium)scene();resume();}});observer.observe(host);}
    if(options.feeding)feed(options.feeding);if(options.waterEvent)waterEvent(options.waterEvent);scene();resume();
    return{kind:'webgl',feed,waterEvent,getWaterPosition,getAquariumBounds,getDecorationPosition(id){const p=decorPoints.find(d=>d.id===id);if(!p)return null;const b=canvas.getBoundingClientRect();return{id,x:b.left+p.x,y:b.top+(p.top+p.bottom)/2,worldX:p.decoration.x,worldZ:p.decoration.z};},update(next){if(destroyed)return;next=next||{};options={...options,...next};if(aquarium&&Object.hasOwn(next,'aquariumYaw'))setAquariumYaw(next.aquariumYaw);if(next.pond){localDecorations=null;rebuildBank();}fish=resolveFish(options);if(aquarium)fish=fish.slice(0,3);palette=theme(options.pond);if(Number.isFinite(next.zoom))zoom=Math.max(.65,Math.min(1.5,next.zoom));if(next.feeding)feed(next.feeding);if(next.waterEvent)waterEvent(next.waterEvent);if(aquarium&&Object.hasOwn(next,'reducedMotion'))aquariumMotion();else scene();},destroy(){if(destroyed)return;destroyed=true;if(raf)win.cancelAnimationFrame(raf);observer?.disconnect();aquariumResize?.disconnect();if(aquarium)win.removeEventListener('resize',scene);motionQuery?.removeEventListener?.('change',aquariumMotion);doc.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',lost);canvas.removeEventListener('wheel',wheel);if(atlas){atlas.onload=null;atlas.onerror=null;}shadowMap?.destroy();buffers.forEach(b=>gl.deleteBuffer(b));gl.deleteTexture(texture);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();host.classList.remove('fishing-pond-host','fishing-fish-figure-host','fishing-aquarium-volume-host');delete host.dataset.feeding;delete host.dataset.decorArt;delete host.dataset.decorations;delete host.dataset.decorRenderer;delete host.dataset.figureArt;delete host.dataset.waterEffect;delete host.dataset.fishCount;delete host.dataset.aquariumFishCount;delete host.dataset.aquariumDecorations;delete host.dataset.aquariumMotion;delete host.dataset.aquariumArt;delete host.dataset.aquariumYaw;delete host.dataset.shadows;}};
  }
  function createFishFigure(host,options={}){const figure=createPond(host,{...options,figureOnly:true,interactive:false,fish:options.fish?[options.fish]:[],zoom:1});return{kind:figure.kind,update(next={}){figure.update(next.fish!==undefined?{...next,fish:next.fish?[next.fish]:[]}:next);},destroy(){figure.destroy();}};}
  function createAquarium(host,options={}){return createPond(host,{...options,aquariumOnly:true,figureOnly:false,interactive:false,fish:(options.fish||[]).slice(0,3)});}
  function createPondFallback(host,options){
    const doc=host.ownerDocument,win=doc.defaultView||globalThis,element=doc.createElement('div'),script=Array.from(doc.scripts).find(s=>/\/fishing-art\.js(?:\?|$)/.test(s.src)),atlasUrl=options.decorAtlasUrl||new URL('fishing-art/pond-decor-v2.png',script?.src||doc.baseURI).href;
    if(options.figureOnly){let current={...options},disposed=false;function paint(){if(disposed)return;const specimen=resolveFish(current)[0];element.innerHTML=specimen?fishMarkup(specimen):'';const svg=element.firstElementChild;if(svg)Object.assign(svg.style,{width:'100%',height:'100%',display:'block'});host.dataset.figureArt='illustration';}element.className='fishing-fish-figure-fallback';Object.assign(element.style,{width:'100%',height:'100%',pointerEvents:'none'});host.appendChild(element);paint();return{kind:'css3d',update(next){current={...current,...next};paint();},destroy(){disposed=true;element.remove();host.classList.remove('fishing-pond-host','fishing-fish-figure-host');delete host.dataset.figureArt;}};}
    element.className='fishing-pond-fallback';host.classList.add('fishing-pond-host');host.appendChild(element);let current={...options},disposed=false,timer=0;const waveTimers=new Set();
    function render(){
      const palette=theme(current.pond),fish=resolveFish(current),decorations=current.pond&&Array.isArray(current.pond.decorations)?current.pond.decorations:defaultDecorations(pondStyle(current.pond));
      element.style.setProperty('--pond-rim',palette.rim);element.style.setProperty('--pond-water',palette.water);element.style.setProperty('--pond-grass',palette.grass);element.style.setProperty('--pond-earth',palette.edge);
      element.innerHTML=`<div class="fishing-fallback-ground"><div class="fishing-fallback-water">${fish.map((f,i)=>`<span class="fishing-fallback-swimmer" data-fish-id="${esc(f.id)}" style="--fish-i:${i};--fish-delay:${-i*3}s">${fishMarkup(f)}</span>`).join('')}</div></div>`+decorations.map(d=>{const index=DECOR_KINDS.indexOf(d.kind);if(index<0)return'';const b=DECOR_BOUNDS[index],h=DECOR_SIZE[d.kind][1]*(Number(d.scale)||1),width=h*(b[2]-b[0])/(b[3]-b[1])*12.5;return `<span class="fishing-fallback-decor${d.id===current.selectedDecorationId?' is-selected':''}" data-decor-id="${esc(d.id)}" style="left:${50+(Number(d.x)||0)*12.5}%;top:${55+(Number(d.z)||0)*8}%;width:${width}%;aspect-ratio:${b[2]-b[0]}/${b[3]-b[1]}"${current.editing?' tabindex="0" role="button"':''}>${decorationMarkup(d,atlasUrl)}</span>`;}).join('');
      host.dataset.decorArt='css';host.dataset.decorations=String(decorations.length);visibility();
    }
    function click(event){const decor=event.target.closest('[data-decor-id]'),fish=event.target.closest('[data-fish-id]');if(decor&&current.editing&&typeof current.onDecorationSelect==='function')current.onDecorationSelect(decor.dataset.decorId);else if(fish&&!current.editing&&typeof current.onSelect==='function')current.onSelect(resolveFish(current).find(f=>f.id===fish.dataset.fishId));}
    function key(event){if(event.code==='Space'||event.code==='Enter'){event.preventDefault();click(event);}}
    function visibility(){element.classList.toggle('is-paused',doc.hidden);}
    function feed(value){if(disposed)return;host.dataset.feeding='true';element.classList.remove('is-feeding');void element.offsetWidth;element.classList.add('is-feeding');if(timer)win.clearTimeout(timer);timer=win.setTimeout(()=>{element.classList.remove('is-feeding');delete host.dataset.feeding;},4500);}
    function getWaterPosition(point={}){if(disposed)return null;const b=element.querySelector('.fishing-fallback-water').getBoundingClientRect();return{x:b.left+b.width*(.5+(Number(point.x)||0)*.17),y:b.top+b.height*(.5+(Number(point.z)||0)*.17)};}
    function waterEvent(value){if(disposed||!value)return;const water=element.querySelector('.fishing-fallback-water'),wave=doc.createElement('span'),strength=Math.max(.2,Math.min(1.5,Number(value.strength)||1));wave.className='fishing-fallback-wave';wave.style.left=50+Math.max(-2.2,Math.min(2.2,Number(value.x)||0))*17+'%';wave.style.top=50+Math.max(-2.2,Math.min(2.2,Number(value.z)||0))*17+'%';wave.style.width=8*strength+'%';wave.style.height=9*strength+'%';water.appendChild(wave);host.dataset.waterEffect=value.type||'cast';if(water.querySelectorAll('.fishing-fallback-wave').length>8)water.querySelector('.fishing-fallback-wave').remove();const id=win.setTimeout(()=>{waveTimers.delete(id);wave.remove();if(!element.querySelector('.fishing-fallback-wave'))delete host.dataset.waterEffect;},2100);waveTimers.add(id);}
    element.addEventListener('click',click);element.addEventListener('keydown',key);doc.addEventListener('visibilitychange',visibility);render();
    return{kind:'css3d',feed,waterEvent,getWaterPosition,update(next){if(disposed)return;next=next||{};current={...current,...next};render();if(next.feeding)feed(next.feeding);if(next.waterEvent)waterEvent(next.waterEvent);},destroy(){if(disposed)return;disposed=true;if(timer)win.clearTimeout(timer);waveTimers.forEach(id=>win.clearTimeout(id));doc.removeEventListener('visibilitychange',visibility);element.removeEventListener('click',click);element.removeEventListener('keydown',key);element.remove();host.classList.remove('fishing-pond-host');delete host.dataset.feeding;delete host.dataset.decorArt;delete host.dataset.decorations;delete host.dataset.waterEffect;}};
  }
  return Object.freeze({rodMarkup,fishMarkup,baitMarkup,decorationMarkup,createPond,createFishFigure,createAquarium,aquariumCamera,normalizeAquariumYaw,aquariumTurnAt,createRodFlex,rodFlexPoint,escape:esc});
});



