'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
const F=require('../public/fishing-model'),R=require('../skins/tracer/fishing-rod-renderer'),Motion=require('../skins/tracer/fishing-motion'),J=require('../skins/tracer/fishing-journey-effects'),E=require('../skins/tracer/fishing-rod-effects');
const pool=F.catalog.rodPools.find(p=>p.id==='journey'),ids=[...pool.rodIds,pool.hiddenRodId];
test('Journey models have unique sculpted silhouettes, bounded fallback budgets and unchanged physical anchors',()=>{
  const signatures=new Set();for(const id of ids){const full=R.buildMesh(id),low=R.buildMesh(id,true);assert.equal(full.design.collection,'journey');assert(full.design.continuousBody);assert(low.triangles<full.triangles*.6);assert(low.triangles<28000);assert(low.vertices.every(Number.isFinite));
    const positions=[];for(let at=0;at<full.vertices.length;at+=14)positions.push(...full.vertices.slice(at,at+3));signatures.add(crypto.createHash('sha256').update(Buffer.from(new Float32Array(positions).buffer)).digest('hex'));
    for(const bend of [-.24,0,.24]){for(let at=0;at<low.vertices.length;at+=14){const p=R.deformed([...low.vertices.slice(at,at+3)],bend);assert(p.x>-126&&p.x<376.8&&p.y>-126&&p.y<544,id+' fits at maximum bend');}for(const s of [0,.3,1]){const a=R.curvePoint(s,bend),b=Motion.rodCurvePoint(s,bend);assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-8);}}
  }assert.equal(signatures.size,30);
});
test('Journey apparitions and spell actions differ, freeze under reduced motion and fit their stage',()=>{
  const signatures=new Set();for(const id of Object.keys(J.scenes)){for(const phase of ['summon','cast','bite','reeling','caught']){const a=J.geometry(id,{phase,progress:.24}),b=J.geometry(id,{phase,progress:.58});assert(a.length&&b.length);assert.notDeepEqual(a,b,id+'/'+phase);assert.deepEqual(J.geometry(id,{phase,progress:.2,reduced:true}),J.geometry(id,{phase,progress:.8,reduced:true}));for(const form of b)for(const p of form.points){assert([p.x,p.y,p.w].every(Number.isFinite));assert(Math.abs(p.x)<1.3&&Math.abs(p.y)<1.3);}}
    signatures.add(JSON.stringify(J.geometry(id,{phase:'summon',progress:.48})));assert(E.summonScene(id));
  }assert.equal(signatures.size,13);
});
test('every epic or legendary rod has a themed float without changing bobber geometry',()=>{
  const marks=new Set();for(const rod of F.catalog.rods){const art=E.bobberMarkup(rod);if(['epic','legendary'].includes(rod.rarity)){assert(art.includes('data-float-theme="'+rod.id+'"'));assert(!/NaN|undefined/.test(art));const image=art.match(/<image href="([^"]+)"/);marks.add(image?image[1]:[...art.matchAll(/<path d="([^"]+)" fill=/g)][1]?.[1]);}else assert.equal(art,'');}assert.equal(marks.size,F.catalog.rods.filter(r=>['epic','legendary'].includes(r.rarity)).length);
  for(const file of ['index.html','fishing-desktop.html']){const source=fs.readFileSync(require.resolve('../skins/tracer/'+file),'utf8');assert(source.indexOf('/fishing-journey-effects.js')<source.indexOf('/fishing-rod-effects.js'));}
});

test('Ruyi flourishes make complete rigid turns, reverse for recovery and settle continuously',()=>{
  for(const phase of ['summon','cast','bite','reeling','caught']){
    let previous=J.staffPose({phase,progress:0});
    for(let frame=1;frame<=240;frame++){
      const next=J.staffPose({phase,progress:frame/240});
      assert(Math.abs(Math.hypot(next.tip.x-next.butt.x,next.tip.y-next.butt.y)-1.56)<1e-12,'the staff never stretches or separates');
      assert(Math.abs(next.angle-previous.angle)<.14,'rotation has no angle wrap or discontinuity');
      assert(Math.hypot(next.tip.x-previous.tip.x,next.tip.y-previous.tip.y)<.12,'the tip follows a continuous circular path');
      previous=next;
    }
    assert.deepEqual(J.staffPose({phase,progress:.1,reduced:true}),J.staffPose({phase,progress:.9,reduced:true}));
  }
  const turn=phase=>J.staffPose({phase,progress:.8}).angle-J.staffPose({phase,progress:.16}).angle;
  assert(turn('cast')>Math.PI*4);assert(turn('caught')<-Math.PI*4);
  const end=J.staffPose({phase:'caught',progress:1});assert(Math.abs(end.tip.x)<1e-12);assert(end.tip.y<end.butt.y,'recovery ends upright');
  assert(J.staffState('caught',680+1260*.84).alpha>.95,'the settled staff remains visible before fading');
  assert.equal(J.staffState('cast',670),null);assert.equal(J.staffState('caught',1940),null);assert.equal(J.staffState('cast',Infinity),null);
});

test('Ruyi keeps a plain staff silhouette and Erlang has three separate forward blade tips',()=>{
  const staff=R.buildMesh('ruyi',true).vertices,blade=R.buildMesh('erlang',true).vertices,groups=new Set();
  for(let i=0;i<staff.length;i+=14)if(staff[i]>.3)assert(staff[i+1]>-10&&staff[i+1]<20,'no side coils obscure the staff');
  for(let i=0;i<blade.length;i+=14)if(blade[i]>.925&&blade[i+2]>1){const y=blade[i+1];groups.add(y<-20?'left':y>20?'right':'middle');}
  assert.deepEqual([...groups].sort(),['left','middle','right']);
});
