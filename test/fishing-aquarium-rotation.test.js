'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {aquariumCamera,normalizeAquariumYaw,aquariumTurnAt}=require('../skins/tracer/fishing-art');
const close=(actual,expected,tolerance=1e-6)=>assert(Math.abs(actual-expected)<tolerance,actual+' != '+expected);
const project=(m,p)=>[0,1,2].map(row=>m[12+row]+p.reduce((sum,n,i)=>sum+n*m[i*4+row],0));

test('aquarium degrees cycle without restricting the available left or right views',()=>{
 for(const [input,expected]of[[0,0],[15,15],[-15,-15],[180,-180],[-180,-180],[360,0],[-360,0],[735,15],[-735,-15],[Infinity,0],[NaN,0],[undefined,0]])assert.equal(normalizeAquariumYaw(input),expected);
 for(const angle of[-1e100,-999999,999999,1e100]){const value=normalizeAquariumYaw(angle);assert(Number.isFinite(value)&&value>=-180&&value<180);}
});

test('camera yaw orbits real geometry at a constant distance and elevation',()=>{
 const zero=aquariumCamera(1.3),quarter=aquariumCamera(1.3,90),cycle=aquariumCamera(1.3,360);
 assert.deepEqual(zero.eye,[4,2.8,12.5]);close(quarter.eye[0],12.5);close(quarter.eye[1],2.8);close(quarter.eye[2],-4);
 zero.view.forEach((n,i)=>close(n,cycle.view[i]));
 for(let angle=-180;angle<180;angle+=5){const camera=aquariumCamera(1.3,angle);close(Math.hypot(camera.eye[0],camera.eye[2]),Math.hypot(4,12.5));assert([...camera.view,...camera.direction].every(Number.isFinite));close(Math.hypot(...camera.direction),1);}
 assert.notDeepEqual(Array.from(zero.view),Array.from(quarter.view));
});

test('all tank and plinth corners remain inside tiny and wide views through a full turn',()=>{
 for(const aspect of[210/161,630/483,1100/700])for(let angle=-180;angle<180;angle+=3){
  const {view}=aquariumCamera(aspect,angle);
  for(const x of[-2.44,2.44])for(const y of[-1.719,1.365])for(const z of[-1.44,1.44]){
   const p=project(view,[x,y,z]);assert(Math.abs(p[0])<.93&&Math.abs(p[1])<.93,'tank at '+angle+' degrees should retain transparent padding');
  }
 }
});

test('rotation eases along the short arc and stays continuous across the signed boundary',()=>{
 close(aquariumTurnAt(170,-175,0),170);close(aquariumTurnAt(170,-175,.5),177.5);close(aquariumTurnAt(170,-175,1),-175);
 close(aquariumTurnAt(-170,175,.5),-177.5);close(aquariumTurnAt(0,15,2),15);close(aquariumTurnAt(0,15,-1),0);
 for(const [from,to]of[[170,-175],[-170,175],[15,-15],[105,120]]){
  let prior=from,total=0;for(let i=1;i<=100;i++){const next=aquariumTurnAt(from,to,i/100),step=normalizeAquariumYaw(next-prior);assert(Math.abs(step)<.6);total+=step;prior=next;}
  close(total,normalizeAquariumYaw(to-from));
 }
 const start=aquariumTurnAt(0,15,.1),middle=aquariumTurnAt(0,15,.6)-aquariumTurnAt(0,15,.5),end=15-aquariumTurnAt(0,15,.9);assert(start<middle&&end<middle,'speed eases at both ends');
});
