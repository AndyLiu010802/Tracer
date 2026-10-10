'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Motion=require('../skins/tracer/fishing-aquarium-motion');
const species=['dragonkoi','galaxywhale','gulpuffer','grumpangler','flopray','snagglefin','clownfish','bluebetta','pearljelly','crownray'];
const resident=id=>({id:'resident-'+id,speciesId:id,growth:100});
const pose=(id,time,options={})=>Motion.sample(resident(id),{time,...options});
function states(id){const result={};for(let t=0;t<22;t+=.04){const p=pose(id,t);if(p.weights[p.mode]>.995&&!result[p.mode])result[p.mode]={time:t,pose:p};}return result;}
function numbers(value,prefix=''){for(const [key,field]of Object.entries(value)){if(typeof field==='number')assert(Number.isFinite(field),prefix+key+' is finite');else if(field&&typeof field==='object')numbers(field,prefix+key+'.');}}

test('original and new fish reach swimming, hovering and their own play action within twenty seconds',()=>{
  const play=new Set();for(const id of species){const phases=states(id);assert.deepEqual(Object.keys(phases).sort(),['idle','play','swim']);assert(phases.play.pose.cycle.duration<20);play.add(phases.play.pose.play);
    for(const phase of Object.values(phases)){const w=phase.pose.weights;assert(Math.abs(w.swim+w.idle+w.play-1)<1e-12);for(const value of Object.values(w))assert(value>=0&&value<=1);}
    assert(phases.idle.pose.articulation.bodyAmplitude<phases.swim.pose.articulation.bodyAmplitude*.4,id+' relaxes its body while hovering');assert(phases.play.pose.articulation.bodyAmplitude>phases.swim.pose.articulation.bodyAmplitude,id+' moves expressively during play');
  }assert.equal(play.size,species.length,'play actions are specific to each fish species');
});

test('idle fish keep breathing, paddling and moving their eyes without rigidly freezing',()=>{
  for(const id of species){const t=states(id).idle.time,a=pose(id,t).articulation,b=pose(id,t+.22).articulation;
    assert.notEqual(a.breath,b.breath,id+' breath');assert.notEqual(a.paddle,b.paddle,id+' fins');assert.notEqual(a.gaze,b.gaze,id+' gaze');assert(a.bodyAmplitude>0);
  }
});

test('whales flex their flukes, rays wave and cup their wings, puffers breathe, and anglers wag their lure',()=>{
  for(const [id,field]of[['galaxywhale','tailLift'],['flopray','wingAmplitude'],['gulpuffer','bodyPuff'],['grumpangler','lureSwing']]){const s=states(id),a=pose(id,s.play.time).articulation,b=pose(id,s.play.time+.20).articulation;assert(Math.abs(a[field])>0);if(field!=='wingAmplitude')assert.notEqual(a[field],b[field]);}
  assert(states('flopray').play.pose.articulation.wingFold>.08);assert.equal(states('flopray').swim.pose.articulation.wingFold,0);
  assert(states('snagglefin').swim.pose.articulation.bodyAmplitude>states('gulpuffer').swim.pose.articulation.bodyAmplitude*4,'eel undulation differs from a hovering puffer');
  assert(states('gulpuffer').play.pose.articulation.bodyPuff>states('gulpuffer').swim.pose.articulation.bodyPuff);
  for(const id of species.filter(id=>id!=='galaxywhale'))assert.equal(pose(id,3).articulation.tailLift,0);
});

test('continuous pose and articulation do not pop at state boundaries or cycle rollover',()=>{
  for(const id of species){const duration=pose(id,0).cycle.duration;let previous=pose(id,0);
    for(let t=1/60;t<duration*2.05;t+=1/60){const next=pose(id,t);assert(Math.hypot(next.x-previous.x,next.y-previous.y,next.z-previous.z)<.025,id+' position jump at '+t);assert(Math.abs(next.angle-previous.angle)<.045,id+' heading jump at '+t);assert(Math.abs(next.pitch-previous.pitch)<.012);assert(Math.abs(next.roll-previous.roll)<.012);
      for(const key of ['bodyPhase','finPhase','wingPhase'])assert(Math.abs(next.articulation[key]-previous.articulation[key])<.23,id+' phase jump '+key);
      for(const key of ['bodyAmplitude','finAmplitude','wingAmplitude','wingFold','bodyPuff'])assert(Math.abs(next.articulation[key]-previous.articulation[key])<.006,id+' deformation jump '+key);
      previous=next;
    }
  }
});

test('the entire rotating fish envelope stays below water, above sand and inside glass during feeding',()=>{
  const b=Motion.tank;for(const count of [1,2,3])for(let index=0;index<count;index++)for(const id of species)for(const feeding of [false,true]){
    let scale;for(let t=0;t<=42;t+=.13){const p=pose(id,t,{count,index,scale:count===1?.66:.45,feed:feeding?{strength:Math.sin((t%4.6)/4.6*Math.PI),progress:(t%4.6)/4.6}:undefined});numbers(p);
      if(scale===undefined)scale=p.scale;assert.equal(p.scale,scale,'fitting the tank never changes fish size as it turns');
      assert(p.x-p.extent.x>=-b.x&&p.x+p.extent.x<=b.x,id+' x');assert(p.z-p.extent.z>=-b.z&&p.z+p.extent.z<=b.z,id+' glass');assert(p.y-p.extent.y>=b.bottom&&p.y+p.extent.y<=b.top,id+' sand/water');
      assert(Math.abs(p.roll)<.23&&Math.abs(p.pitch)<=.30,id+' restrained posture');
    }
  }
});

test('two and three residents keep separate centre lanes even with different sizes and phases',()=>{
  for(const count of [2,3])for(let t=0;t<60;t+=.1)for(const id of species){const left=pose(id,t,{count,index:0}),right=pose(id,t+1.2,{count,index:1});assert(left.x<-.64);assert(right.x>.64);assert(right.x-left.x>1.28);
    if(count===3){const middle=pose(id,t+2.3,{count,index:2});assert(Math.abs(middle.x)<.19);assert(middle.y<left.y&&middle.y<right.y,'third lane sits below the upper residents');assert(middle.z>left.z&&middle.z>right.z,'third lane is nearer the front glass');}
  }
});

test('turning large fish never slides them backwards to compensate for a changing silhouette',()=>{
  for(const count of [1,2,3])for(let index=0;index<count;index++)for(const id of species)for(let t=0;t<40;t+=.08){const p=pose(id,t,{count,index}),next=pose(id,t+.002,{count,index}),dx=next.x-p.x,dz=next.z-p.z;
    if(Math.hypot(dx,dz)>.00001)assert(dx*Math.cos(p.angle)-dz*Math.sin(p.angle)>0,id+' swims forwards through its turn in lane '+index);
  }
});

test('rays gently bank to keep their decorated upper disc readable from the aquarium camera',()=>{
  const camera=[4,2.87,12.5],length=Math.hypot(...camera);let visible=0,samples=0;
  for(const id of ['flopray','crownray'])for(const count of [1,3])for(let t=0;t<100;t+=.04){const p=pose(id,t,{count,index:count-1}),c=Math.cos(p.angle),s=Math.sin(p.angle),a=Math.cos(p.pitch),b=Math.sin(p.pitch),d=Math.cos(p.roll),e=Math.sin(p.roll),normal=[-c*e+s*b*d,a*d,s*e+c*b*d];
    const incidence=normal.reduce((sum,value,i)=>sum+value*camera[i]/length,0);assert(incidence>.3,'ray never becomes an edge-on sliver or shows only its underside');if(incidence>.35)visible++;samples++;
    assert(Math.abs(p.pitch)<=.30&&Math.abs(p.roll)<=.22,'the display bank stays restrained');
  }assert(visible/samples>.95);
});

test('individual resident seeds desynchronise behaviour and fin beats, preserving stable poses after reordering',()=>{
  const f={id:'first',speciesId:'gulpuffer'},g={id:'second',speciesId:'gulpuffer'},a=Motion.sample(f,{time:5}),b=Motion.sample(g,{time:5});assert.notEqual(a.seed,b.seed);assert.notEqual(a.cycle.progress,b.cycle.progress);assert.notEqual(a.articulation.finPhase,b.articulation.finPhase);
  const moved=Motion.sample(f,{time:5,index:1,count:3});assert.equal(moved.seed,a.seed);assert.deepEqual(moved.articulation,a.articulation,'changing lane keeps the same individual rhythm');
  assert.equal(new Set(species.map(id=>pose(id,2).seed)).size,species.length);
});

test('feeding adds a bounded reaction without resetting phases or displacing residents to the surface',()=>{
  for(const id of species){const before=pose(id,5),start=pose(id,5,{feed:{strength:0,progress:0}}),fed=pose(id,5,{feed:{strength:1,progress:.5}}),end=pose(id,5,{feed:{strength:0,progress:1}});assert.deepEqual(before,start);assert.deepEqual(before,end);assert(fed.y>=before.y);assert(fed.y-before.y<.08);assert.equal(fed.articulation.bodyPhase,before.articulation.bodyPhase);assert.equal(fed.mode,before.mode);}
});

test('reduced motion is one deterministic frame, including feeding and shader articulation',()=>{
  for(const id of species){const fixed=pose(id,0,{reducedMotion:true});assert.equal(fixed.mode,'idle');for(const t of [1,6,20,500])assert.deepEqual(pose(id,t,{reducedMotion:true,feed:{strength:1,progress:.5}}),fixed);}
});

test('sampling is pure and finite for missing fish, strange IDs and invalid timing/layout inputs',()=>{
  const fish=Object.freeze(resident('dragonkoi')),feed=Object.freeze({strength:.5,progress:.3}),options=Object.freeze({time:3,index:1,count:3,feed});const a=Motion.sample(fish,options);assert.deepEqual(Motion.sample(fish,options),a);
  for(const f of [null,{}, {id:'__proto__'},{id:'constructor'}])for(const opts of [null,{}, {time:NaN,count:0,index:-4,scale:-1},{time:Infinity,count:Infinity,index:Infinity,scale:NaN},{time:-99,count:6,index:12},{time:1e8,feed:{strength:Infinity,progress:NaN}}])numbers(Motion.sample(f,opts));
});

test('the browser module has no renderer or timer dependency and matches the CommonJS API',()=>{
  const context={};vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/fishing-aquarium-motion'),'utf8'),context);assert(context.TracerAquariumMotion);
  assert.equal(JSON.stringify(context.TracerAquariumMotion.sample(resident('flopray'),{time:9})),JSON.stringify(pose('flopray',9)));
});


test('growth reserves adult fitting space and makes every fish visibly larger from fry to maturity',()=>{
  for(const count of [1,3])for(const id of species)for(const time of [0,5,18]){
    const size=growth=>Motion.sample({...resident(id),growth},{time,count,index:count-1,scale:.66});
    const fry=size(0),juvenile=size(40),almost=size(99),adult=size(100);
    assert(fry.scale<juvenile.scale&&juvenile.scale<almost.scale&&almost.scale<adult.scale,id+' grows through every stage');
    assert(Math.abs(fry.scale/adult.scale-.64/1.18)<1e-12,id+' retains the full growth range even when adult tank fitting caps its size');
    assert(Math.abs(almost.scale/adult.scale-(.64+.54*.99)/1.18)<1e-12,id+' size grows continuously before maturity');
    for(const p of [fry,juvenile,almost,adult]){const b=Motion.tank;assert(p.x-p.extent.x>=-b.x&&p.x+p.extent.x<=b.x);assert(p.z-p.extent.z>=-b.z&&p.z+p.extent.z<=b.z);assert(p.y-p.extent.y>=b.bottom&&p.y+p.extent.y<=b.top);}
  }
});

test('reaching 100 percent unlocks the appropriate mature trick and more expressive play',()=>{
  const expected={dragonkoi:'leap',galaxywhale:'bubble',gulpuffer:'bubble',grumpangler:'glow',flopray:'flutter',snagglefin:'twirl',clownfish:'orbit',bluebetta:'flutter',pearljelly:'bubble',crownray:'flutter'};
  for(const id of species){const time=states(id).play.time,juvenile=Motion.sample({...resident(id),growth:99},{time}),adult=pose(id,time);
    assert.equal(juvenile.mature,false);assert.equal(juvenile.extraMotion,null);assert.equal(adult.mature,true);assert.equal(adult.extraMotion,expected[id]);
    assert(adult.articulation.bodyAmplitude>juvenile.articulation.bodyAmplitude,id+' mature play moves its body more expressively');
    assert(adult.articulation.finAmplitude>juvenile.articulation.finAmplitude,id+' mature play adds a fin flourish');
    assert.equal(adult.articulation.bodyPhase,juvenile.articulation.bodyPhase,'maturity preserves individual motor timing');
    assert.equal(adult.cycle.progress,juvenile.cycle.progress,'maturity preserves individual behaviour timing');
  }
});
