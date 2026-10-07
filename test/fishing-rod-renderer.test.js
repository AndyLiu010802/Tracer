'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Rod=require('../skins/tracer/fishing-rod-renderer'),Motion=require('../skins/tracer/fishing-motion');
const ids=require('../public/fishing-model').catalog.rods.map(r=>r.id);
test('live rods use finite smooth 3D geometry and distinct themed materials for every design',()=>{
  const themes=[];for(const id of ids){const mesh=Rod.buildMesh({id});assert(mesh.triangles>10000&&mesh.triangles<25000);assert.equal(mesh.vertices.length,mesh.triangles*42);assert(mesh.vertices.every(Number.isFinite));themes.push(JSON.stringify(mesh.profile));for(let at=0;at<mesh.vertices.length;at+=14){const n=Math.hypot(mesh.vertices[at+3],mesh.vertices[at+4],mesh.vertices[at+5]);assert(Math.abs(n-1)<1e-5);for(const offset of [6,7,8,9,10])assert(mesh.vertices[at+offset]>=0&&mesh.vertices[at+offset]<=1);}}
  assert.equal(new Set(themes).size,ids.length);assert.equal(Rod.profile('unknown').id,'bamboo');
});
test('3D rod shaft and line share the same inextensible cantilever tip at every permitted bend',()=>{
  for(const bend of [-.24,-.1,0,.1,.24])for(let i=0;i<=100;i++){const s=i/100,a=Rod.curvePoint(s,bend),b=Motion.rodCurvePoint(s,bend);assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-8);assert(Math.abs(a.angle-b.angle)<1e-8);if(s<=.3){const fixed=Rod.curvePoint(s,0);assert.equal(a.x,fixed.x);assert.equal(a.y,fixed.y);}}
});
test('3D vertex projection preserves tip and grip while providing real depth to reel and guides',()=>{
  const mesh=Rod.buildMesh('carbon');let minDepth=Infinity,maxDepth=-Infinity;for(let i=0;i<mesh.vertices.length;i+=14){minDepth=Math.min(minDepth,mesh.vertices[i+2]);maxDepth=Math.max(maxDepth,mesh.vertices[i+2]);}
  assert(minDepth<-7&&maxDepth>20,'mesh has tube volume and a raised spinning reel');for(const bend of [-.24,0,.24])for(const s of [0,1]){const center=Rod.curvePoint(s,bend),projected=Rod.deformed([s,0,0],bend);assert.equal(center.x,projected.x);assert.equal(center.y,projected.y);}
  const fallback=Rod.buildMesh('carbon',true);assert(fallback.triangles<mesh.triangles*.65&&fallback.triangles>2000,'noGL fallback keeps dimensional features at a lower mesh cost');
});
