'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('../public/fishing-model'),Effects=require('../skins/tracer/fishing-rod-effects'),Motion=require('../skins/tracer/fishing-motion'),Art=require('../skins/tracer/fishing-art');
const rods=F.catalog.rods.filter(r=>['epic','legendary'].includes(r.rarity));

test('summoning has bounded tier-specific timing, quiet reduced motion, and continuous rod-local geometry',()=>{
  const ends=[];
  for(const tier of ['common','rare','epic','legendary']){
    const rod=F.catalog.rods.find(r=>r.rarity===tier);let end=0;
    while(Effects.summonState(rod,end))end+=10;ends.push(end);
    assert.equal(Effects.summonState(rod,-1),null);assert.equal(Effects.summonState(rod,Infinity),null);
    assert.equal(Effects.summonState(rod,end),null);
    assert.equal(Effects.summonState(rod,260,true),null);
    const quiet=Effects.summonState(rod,100,true);assert(quiet.alpha<=.18);assert(quiet.reveal>0);
  }
  assert.deepEqual(ends,[440,680,2400,2800]);
  for(const rod of F.catalog.rods)for(const reduced of [false,true]){
    const state=Effects.summonState(rod,160,reduced),g={width:380,height:260,curve:u=>({x:70+u*60,y:230-u*150})},field=Effects.summonField(rod,state,g);
    assert(field.length>0&&field.length<=16);
    for(const strand of field)for(const p of strand.points){assert([p.x,p.y,p.w].every(Number.isFinite));assert(p.w>=0);assert(p.x>0&&p.x<300&&p.y>0&&p.y<260,'entrance remains around the shaft, clear of the reel meter');}
    if(reduced)assert.equal(field.length,1);
  }
  const gold=F.catalog.rods.find(r=>r.id==='golden');assert.equal(Effects.summonField(gold,Effects.summonState(gold,200),{width:380,height:260,curve:u=>({x:90,y:230-u*150})}).length,1,'one shaft highlight supports the Caishen apparition');
});

test('all advanced summons have unique scenes and finite, accessible transformation timing',()=>{
  const kinds=new Set();
  for(const rod of rods){const scene=Effects.summonScene(rod.id);assert(scene);kinds.add(scene.kind);assert(scene.duration>=2400&&scene.duration<=3400);
    for(const age of [0,180,600,1100,1400]){const state=Effects.summonState(rod,age);assert(state);assert(state.reveal>=0&&state.reveal<=1);assert(state.alpha>=0&&state.alpha<=1);}
    assert.equal(Effects.summonState(rod,scene.duration),null);assert.equal(Effects.summonState(rod,260,true),null);
    if(scene.art){assert(fs.existsSync(path.join(__dirname,'../skins/tracer/fishing-art',scene.art)));for(const age of [0,400,1000,1800]){const state=Effects.summonState(rod,age),pose=Effects.caishenPose(state,{width:380,height:260,curve:u=>({x:90,y:230-u*150})},1,rod.id);assert(Object.values(pose).every(Number.isFinite));assert(pose.x-pose.width/2>=0);assert(pose.x+pose.width/2<300);assert(pose.y-pose.height/2>=0);assert(pose.y+pose.height/2<260);}}
  }
  assert.equal(kinds.size,rods.length);assert.equal(Effects.summonScene('__proto__'),null);
  const blade=F.catalog.rods.find(r=>r.id==='katana');assert.equal(Effects.summonState(blade,100).reveal,0);assert(Effects.summonState(blade,Effects.summonScene(blade.id).duration*.88).reveal>.5);
});

test('summon placement follows the rod and keeps spirits inside the frame and clear of the water controls',()=>{
  for(const width of [280,380,600])for(const angle of [-.2,.3,.9]){
    const height=width*.684,grip={x:width*.2,y:height*.86},g={width,height,grip,water:{x:width*.7,y:height*.6},curve:u=>({x:grip.x+Math.sin(angle)*height*.65*u,y:grip.y-Math.cos(angle)*height*.65*u})};
    for(const id of ['golden','guandao','dragon','phoenix'])for(const t of [250,750,1300,1900]){
      const rod=F.catalog.rods.find(r=>r.id===id),state=Effects.summonState(rod,t),pose=Effects.caishenPose(state,g,1,id),safe=Effects.summonPlacement(id,g,pose.width,pose.height);
      assert(pose.x-pose.width/2>=5.99);assert(pose.x+pose.width/2<=safe.right+.01);assert(pose.y-pose.height/2>=7.99);assert(pose.y+pose.height/2<=height-12.99);assert(pose.alpha<=.86);
    }
    const moon=Effects.summonPlacement('moon',g,60,60),lotus=Effects.summonPlacement('lotus',g,60,60);assert(moon.y<lotus.y,'moon is above the shaft; lotus opens near its base');
  }
});

test('manifestation holds a readable spirit before a continuous transformation and material reveal',()=>{
  for(const rod of rods){const duration=Effects.summonScene(rod.id).duration;
    const awake=Effects.summonState(rod,duration*.4);assert.equal(awake.stage,'awaken');assert.equal(awake.reveal,0);assert.equal(awake.gather,0);assert(awake.alpha>=.8);
    let previous=Effects.summonState(rod,0);
    for(let ms=16;ms<duration;ms+=16){const state=Effects.summonState(rod,ms);assert(state.reveal>=previous.reveal);assert(state.gather>=previous.gather);assert(Math.abs(state.reveal-previous.reveal)<.07);assert(Math.abs(state.gather-previous.gather)<.06);previous=state;}
    const settled=Effects.summonState(rod,duration*.97);assert.equal(settled.reveal,1);assert.equal(settled.gather,1);assert.equal(settled.stage,'settle');
  }
});
test('every epic and legendary rod has a distinct continuous light field instead of assembled icon overlays',()=>{
  assert.equal(rods.length,22);
  const themes=new Set(),fields=new Set();
  for(const rod of rods){const design=Effects.design(rod.id),profile=Motion.fxProfile(rod);assert(design,rod.id);themes.add(design.theme);fields.add(JSON.stringify(Effects.flow(rod.id,.8,.4)));
    assert.equal(profile.theme,design.theme);assert(rod.effectDescription.every(s=>s.length>15));
    const markup=Art.rodMarkup(rod);assert(markup.includes('fishing-catalog-fluid'));assert(!/rod-spirit|fishing-catalog-mote|fishing-catalog-signature/.test(markup));
  }
  assert.equal(themes.size,rods.length);assert.equal(fields.size,rods.length);
  assert.equal(Effects.design('__proto__'),null);assert.deepEqual(Effects.flow('unknown'), []);
});
test('all light surfaces remain finite, tapered and continuous over time at compact scales',()=>{
  for(const rod of rods)for(const time of [0,.2,.7,1.1,1.8]){
    const now=Effects.flow(rod.id,time,.4),next=Effects.flow(rod.id,time+1/60,.4);assert(now.length<=13);
    for(let s=0;s<now.length;s++){
      const points=now[s].points;assert(points.length>=32&&points.length<=109);
      assert(points.at(-1).w<.00001,'every wake dissolves at the end');
      for(let i=0;i<points.length;i++){const p=points[i],q=next[s].points[i];assert([p.x,p.y,p.w].every(Number.isFinite));assert(p.w>=0);assert(Math.hypot(p.x-q.x,p.y-q.y)<.035,'one frame never jumps at 60fps');}
      assert.equal(Effects.envelope(points).length,points.length*2);
    }
  }
});
test('signatures trigger once per cast/hook/catch, finish before results and are faint under reduced motion',()=>{
  for(const rod of rods){
    for(const phase of ['idle','charging','waiting','escaped'])assert.equal(Effects.eventState(rod.id,phase,100),null);
    assert.equal(Effects.eventState(rod.id,'caught',500),null,'wait for landing');
    assert.equal(Effects.eventState(rod.id,'caught',2050),null,'clear the result UI');
    for(const phase of ['cast','reeling','caught']){
      const t=phase==='caught'?1100:250,state=Effects.eventState(rod.id,phase,t),quiet=Effects.eventState(rod.id,phase,t,true);
      assert(state.alpha>.5);assert(quiet.alpha<=.18);assert(quiet.alpha<state.alpha);assert.equal(Effects.eventState(rod.id,phase,5000),null);
    }
  }
});
test('signature placement is finite and keeps the compact right-hand reel meter clear',()=>{
  for(const rod of rods)for(const width of [280,380,760])for(const phase of ['cast','reeling','caught'])for(const reduced of [false,true])for(const age of [35,190,760,1050,1800]){
    const state=Effects.eventState(rod.id,phase,age,reduced);if(!state)continue;
    const g={width,height:width*.6},shape=Effects.layout(rod.id,state,g,{x:width*.24,y:20},{x:width*.84,y:g.height*.9});
    for(const key of ['x','y','size'])assert(Number.isFinite(shape[key]));assert(!/NaN|Infinity/.test(shape.transform));
    assert(shape.x+shape.size<=width-42+.01,'right control gutter');assert(shape.x>=shape.size,'left edge');assert(shape.y>=shape.size,'top edge');
  }
});
test('both production entry points load the shared signature module before motion',()=>{
  for(const file of ['index.html','fishing-desktop.html']){
    const source=fs.readFileSync(path.join(__dirname,'../skins/tracer',file),'utf8');
    const effects=source.indexOf('src="/fishing-rod-effects.js"'),motion=source.indexOf('src="/fishing-motion.js"');
    assert(effects>0&&effects<motion,file);
  }
  assert(fs.readFileSync(path.join(__dirname,'../public/fishing-model.js')).equals(fs.readFileSync(path.join(__dirname,'../skins/tracer/fishing-model.js'))));
});

test('themed actions articulate geometry throughout the readable stage and stop all articulation under reduced motion',()=>{
  const signatures=new Set();
  for(const rod of rods){
    const start=Effects.themePose(rod.id,{progress:.24}),middle=Effects.themePose(rod.id,{progress:.48}),end=Effects.themePose(rod.id,{progress:.7});
    assert.notDeepEqual(start,middle,rod.id+' has a physical action while fully visible');assert.notDeepEqual(middle,end,rod.id+' follows through instead of only fading');signatures.add(JSON.stringify(middle));
    assert.deepEqual(Effects.themePose(rod.id,{progress:.2,reduced:true}),Effects.themePose(rod.id,{progress:.8,reduced:true}),rod.id+' reduced motion fixes its complete pose');
    let previous=Effects.themePose(rod.id,{progress:0});for(let i=1;i<=240;i++){const next=Effects.themePose(rod.id,{progress:i/240});for(const key of Object.keys(next)){assert(Number.isFinite(next[key]),rod.id+' '+key);assert(Math.abs(next[key]-previous[key])<(key==='impact'?.11:.07),rod.id+' '+key+' stays continuous');}previous=next;}
  }
  assert.equal(signatures.size,rods.length);
  assert.equal(Effects.themePose('katana',{progress:.18}).draw,0,'rift opens before blade is drawn');assert(Effects.themePose('katana',{progress:.5}).draw>.9,'tip crosses the space after anticipation');
  assert(Effects.themePose('lotus',{progress:.55}).opening>Effects.themePose('lotus',{progress:.18}).opening,'petals open');assert(Effects.themePose('lotus',{progress:.98}).opening<Effects.themePose('lotus',{progress:.55}).opening,'petals cup together at the finish');
});

test('stellar rings use continuous depth and perspective across front and back segments',()=>{
  for(const tilt of [.4,.95,1.3])for(const angle of [0,.4,1.7,3.4,5.8]){
    const point=Effects.orbitalPoint(angle,tilt,.43,.8),next=Effects.orbitalPoint(angle+.001,tilt,.43,.8);assert(Object.values(point).every(Number.isFinite));assert(Math.hypot(point.x-next.x,point.y-next.y)<.002);
  }
  assert(Effects.orbitalPoint(Math.PI/2,1,0).z>0);assert(Effects.orbitalPoint(3*Math.PI/2,1,0).z<0);
});

test('spirit images load only for the equipped rod, share across layers, and evict unreferenced art',()=>{
  const requests=[];class Image{set src(value){requests.push(value);}}
  const doc={defaultView:{Image},createElement:()=>({getContext:()=>({}),setAttribute(){},remove(){},dataset:{}})},host={ownerDocument:doc,appendChild(){}};
  const first=Effects.createSummon(host),second=Effects.createSummon(host),flow=Effects.create(host);
  assert.equal(requests.length,0,'creating an unequipped host never fetches every spirit');
  const rod=id=>F.catalog.rods.find(r=>r.id===id);
  assert.strictEqual(first.preload(rod('katana')),second.preload(rod('katana')),'summon layers share one decoded image');assert.equal(requests.length,1);
  first.preload(rod('katana'));assert.equal(requests.length,1);
  second.destroy();first.preload(rod('foxfire'));first.preload(rod('abysswhale'));first.preload(rod('lilybell'));first.preload(rod('sunforge'));
  assert.equal(requests.length,5);first.preload(rod('katana'));assert.equal(requests.length,6,'old unused entries are evicted from the bounded cache');
  first.destroy();first.destroy();flow.destroy();assert.equal(first.preload(rod('eclipse')),null,'disposed layers cannot reacquire images');
});

test('all new themes have finite depth geometry, stable quiet poses, and short bite cues; low tiers remain quiet',()=>{
  const ids=['katana','candlewyrm','thunderdrum','abysswhale','foxfire','lilybell','sandscript','frostwolf','rosevow','inkjudge','butterfly','sunforge','leviathan','eclipse'];
  for(const id of ids){
    for(const phase of ['summon','cast','bite','reeling','caught']){
      for(const progress of [.04,.18,.32,.46,.64,.82,.96])for(const form of Effects.mythicGeometry(id,{phase,progress})){
        assert(Number.isFinite(form.alpha)&&form.alpha>=0);for(const point of form.points)assert([point.x,point.y,point.z||0].every(Number.isFinite),id+' finite vertices');
      }
      assert.deepEqual(Effects.mythicGeometry(id,{phase,progress:.2,reduced:true}),Effects.mythicGeometry(id,{phase,progress:.8,reduced:true}),id+' quiet surface');
    }
    assert(Effects.eventState(id,'bite',200));assert.equal(Effects.eventState(id,'bite',600),null);
  }
  for(const id of ['walnut','porcelain','citrus','amber','vinyl','nautilus','alpine']){const rod=F.catalog.rods.find(r=>r.id===id);assert(rod);assert.equal(Effects.summonScene(id),null);assert.equal(Motion.fxProfile(rod),null);assert(Effects.summonState(rod,120));}
  assert(Effects.mythicPose('katana',{progress:.40}).reach>Effects.mythicPose('katana',{progress:.24}).reach,'blade extends after anticipation');
  assert(Effects.mythicPose('katana',{progress:.97}).reach<.2,'blade returns into its sheath');
});

test('Canvas fallback attempts WebGL only once per effect layer instead of reallocating every frame',()=>{
  let attempts=0;const gradient={addColorStop(){}},context=new Proxy({globalAlpha:1},{get:(object,key)=>key in object?object[key]:key.startsWith('create')?()=>gradient:()=>{}});
  class Image{constructor(){this.complete=true;this.naturalWidth=this.naturalHeight=1024;}set src(value){this.url=value;}}
  const doc={defaultView:{Image,devicePixelRatio:1},createElement:()=>({getContext:type=>{if(type==='webgl'){attempts++;return null;}return context;},setAttribute(){},remove(){},dataset:{}})},host={ownerDocument:doc,appendChild(){}},rod=F.catalog.rods.find(r=>r.id==='butterfly'),summon=Effects.createSummon(host),flow=Effects.create(host),g={width:380,height:260,grip:{x:60,y:220},tip:{x:130,y:45},water:{x:260,y:180},curve:u=>({x:60+u*70,y:220-u*175})};
  for(let frame=0;frame<60;frame++){summon.draw(rod,Effects.summonState(rod,300+frame*20),g);flow.draw({variant:rod.id,energy:1},'caught',750+frame*10,{},g,g.tip,g.water,g.tip,g.water);}
  assert.equal(attempts,2,'one failed attempt for summon, one for catch layer');summon.destroy();flow.destroy();
});

test('cloud is a continuous three-dimensional tornado with a narrow root and separate live stage motions',()=>{
 const rod=F.catalog.rods.find(r=>r.id==='cloud');assert.equal(Effects.design('cloud').theme,'tornado');assert.equal(Motion.fxProfile(rod).theme,'tornado');assert.deepEqual(Effects.summonScene('cloud'),{duration:2600,kind:'wind-vortex'});
 const pose=Effects.tornadoPose({progress:.42}),root=Effects.tornadoPoint(0,0,pose),mouth=Effects.tornadoPoint(1,0,pose);
 assert(mouth.x-root.x>.65,'the funnel has a broad mouth rather than a thin spring');assert(root.y-mouth.y>1.6,'full height reads as a rising wind column');
 assert(Effects.tornadoPoint(.6,Math.PI/2,pose).z>0);assert(Effects.tornadoPoint(.6,Math.PI*1.5,pose).z<0);
 for(const strand of Effects.tornadoField(.8,.42)){
  assert(strand.points.some(p=>p.z>.1)&&strand.points.some(p=>p.z<-.1),'each ribbon passes continuously in front of and behind the core');
  assert(strand.points.at(-1).h-strand.points[0].h>.99,'each spiral climbs the full funnel instead of stacking independent horizontal rings');
  for(let i=1;i<strand.points.length;i++){assert(strand.points[i].h>strand.points[i-1].h);assert(Math.hypot(strand.points[i].x-strand.points[i-1].x,strand.points[i].y-strand.points[i-1].y)<.24);}
 }
 const phases=['summon','cast','reeling','caught'].map(phase=>Effects.tornadoPose({phase,progress:.5},.4));assert.equal(new Set(phases.map(p=>JSON.stringify(p))).size,4);
 assert(phases[2].height<phases[3].height*.55,'the hook whirlpool stays low while the catch winds upward');
 assert(Effects.tornadoPose({progress:.15}).height<pose.height*.6,'wind gathers at the root before the tall vortex rises');
 assert.deepEqual(Effects.tornadoPose({progress:.2,reduced:true},.1),Effects.tornadoPose({progress:.8,reduced:true},5),'reduced motion fixes the full volume and spin');
 assert.deepEqual(Effects.tornadoField(.2,.1,{reduced:true}),Effects.tornadoField(5,.9,{reduced:true}));
 const before=Effects.summonState(rod,1200),during=Effects.summonState(rod,2050);assert.equal(before.gather,0);assert(during.gather>.8&&during.reveal>.3,'same authoritative timeline hands the vortex into the real rod');
});

test('the cloud catalogue uses the same tapered wind volume with real front and back ribbons',()=>{
 const rod=F.catalog.rods.find(r=>r.id==='cloud'),markup=Art.rodMarkup(rod);
 assert(markup.includes('data-fx-surface="tapered-vortex"'));assert(markup.includes('data-wind-volume="true"'));assert(markup.includes('data-wind-depth="front"'));assert(markup.includes('data-wind-depth="back"'));
 assert(!/NaN|Infinity|cloud-gate|zephyr|crane/.test(markup));assert.equal((markup.match(/<image\b/g)||[]).length,1,'only the existing rod model atlas is a bitmap; tornado artwork is procedural');
});
