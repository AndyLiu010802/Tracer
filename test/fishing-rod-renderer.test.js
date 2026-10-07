'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Rod=require('../skins/tracer/fishing-rod-renderer'),Motion=require('../skins/tracer/fishing-motion');
const ids=require('../public/fishing-model').catalog.rods.map(r=>r.id);
const expansion=['walnut','porcelain','citrus','amber','vinyl','nautilus','alpine','candlewyrm','thunderdrum','abysswhale','foxfire','lilybell','sandscript','frostwolf','rosevow','inkjudge','butterfly','sunforge','leviathan','eclipse'];
test('live rods use finite smooth 3D geometry and distinct themed materials for every design',()=>{
  const themes=[];for(const id of ids){const mesh=Rod.buildMesh({id}),newIndex=expansion.indexOf(id),budget=newIndex<0?25000:newIndex<7?32000:65000;assert(mesh.triangles>10000&&mesh.triangles<budget,id+' retains its geometry budget');assert.equal(mesh.vertices.length,mesh.triangles*42);assert(mesh.vertices.every(Number.isFinite));themes.push(JSON.stringify(mesh.profile));for(let at=0;at<mesh.vertices.length;at+=14){const n=Math.hypot(mesh.vertices[at+3],mesh.vertices[at+4],mesh.vertices[at+5]);assert(Math.abs(n-1)<1e-5,id+' has a unit surface normal');for(const offset of [6,7,8,9,10])assert(mesh.vertices[at+offset]>=0&&mesh.vertices[at+offset]<=1);}}
  assert.equal(new Set(themes).size,ids.length);assert.equal(Rod.profile('unknown').id,'bamboo');
});
test('all twenty expansion rods have independent geometry and meaningful upper silhouettes',()=>{
  const crypto=require('node:crypto'),shapes=new Set();
  for(const [index,id]of expansion.entries()){
    const mesh=Rod.buildMesh(id),positions=[],bins=new Set();assert.equal(mesh.profile.id,id);assert.equal(mesh.design.collection,'myriad');assert.equal(mesh.design.rarity,index<3?'common':index<7?'rare':index<17?'epic':'legendary');
    for(let at=0;at<mesh.vertices.length;at+=14){const s=mesh.vertices[at],y=mesh.vertices[at+1];positions.push(s,y,mesh.vertices[at+2]);if(s>.42&&s<.9&&Math.abs(y)>12)bins.add(Math.floor(s*10));}
    const digest=crypto.createHash('sha256').update(Buffer.from(new Float32Array(positions).buffer)).digest('hex');assert(!shapes.has(digest),id+' cannot be a recolour of another mesh');shapes.add(digest);
    if(index>=7)assert(bins.size>=3,id+' has a silhouette extending beyond a single collar ornament');
    const fallback=Rod.buildMesh(id,true);assert(fallback.triangles<mesh.triangles*.6,id+' has a substantially cheaper no-WebGL model');assert(fallback.triangles<28000,id+' respects the software renderer budget');assert(fallback.vertices.every(Number.isFinite));
  }
});
test('transmitting rod surfaces form a back-to-front batch after opaque hardware',()=>{
  const transparent=new Set([10,14,17,19]),expected=new Set(['amber','alpine','candlewyrm','abysswhale','sandscript','frostwolf','rosevow','butterfly','sunforge','leviathan','eclipse']);
  for(const id of expansion){
    const mesh=Rod.buildMesh(id),end=mesh.opaqueVertices*14;assert.equal(mesh.opaqueVertices%3,0);assert.equal(end<mesh.vertices.length,expected.has(id),id+' glass availability');let previous=-Infinity;
    for(let at=0;at<mesh.vertices.length;at+=42){assert.equal(transparent.has(mesh.vertices[at+11]),at>=end,id+' material batch');if(at>=end){const z=(mesh.vertices[at+2]+mesh.vertices[at+16]+mesh.vertices[at+30])/3;assert(z>=previous-1e-5,id+' sorted transmission');previous=z;}}
  }
});
test('all expansion details stay inside the padded live canvas through both maximum bends',()=>{
  for(const id of expansion){const mesh=Rod.buildMesh(id,true);for(const bend of [-.24,.24])for(let at=0;at<mesh.vertices.length;at+=14){const point=Rod.deformed([mesh.vertices[at],mesh.vertices[at+1],mesh.vertices[at+2]],bend);assert(point.x>-126&&point.x<376.8&&point.y>-126&&point.y<544,id+' stays clear of the canvas edge');}}
});
test('3D rod shaft and line share the same inextensible cantilever tip at every permitted bend',()=>{
  for(const bend of [-.24,-.1,0,.1,.24])for(let i=0;i<=100;i++){const s=i/100,a=Rod.curvePoint(s,bend),b=Motion.rodCurvePoint(s,bend);assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-8);assert(Math.abs(a.angle-b.angle)<1e-8);if(s<=.3){const fixed=Rod.curvePoint(s,0);assert.equal(a.x,fixed.x);assert.equal(a.y,fixed.y);}}
});
test('3D vertex projection preserves tip and grip while providing real depth to reel and guides',()=>{
  const mesh=Rod.buildMesh('carbon');let minDepth=Infinity,maxDepth=-Infinity;for(let i=0;i<mesh.vertices.length;i+=14){minDepth=Math.min(minDepth,mesh.vertices[i+2]);maxDepth=Math.max(maxDepth,mesh.vertices[i+2]);}
  assert(minDepth<-7&&maxDepth>20,'mesh has tube volume and a raised spinning reel');for(const bend of [-.24,0,.24])for(const s of [0,1]){const center=Rod.curvePoint(s,bend),projected=Rod.deformed([s,0,0],bend);assert.equal(center.x,projected.x);assert.equal(center.y,projected.y);}
  const fallback=Rod.buildMesh('carbon',true);assert(fallback.triangles<mesh.triangles*.65&&fallback.triangles>2000,'noGL fallback keeps dimensional features at a lower mesh cost');
});
