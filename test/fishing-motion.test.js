'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Motion=require('../skins/tracer/fishing-motion');
const geometry={width:380,height:260,baseAngle:0,water:{x:269,y:155},launch:{x:126,y:34},grip:{x:24,y:231}};
const values={castPower:.8,tension:.5,fishPosition:.6};
test('salvage and mystery bundles land as solid objects without fish flopping or squashing',()=>{
  for(const kind of ['junk','mystery'])for(const reduced of [false,true])for(const age of [0,160,450,760,830,1000,1400,1800]){
    const p=Motion.pose('caught',age,{...values,catchKind:kind},geometry,reduced);assert.equal(p.fishSquash,1);assert(Math.abs(p.fishAngle)<=9);assert(Object.values(p).every(Number.isFinite));if(reduced)assert.equal(Math.abs(p.fishAngle),0);
  }
  const fish=Motion.pose('caught',830,values,geometry,false);assert(fish.fishSquash<1,'normal fish retains its landing flop');
});
test('advanced rods have distinct effects while ordinary rods stay quiet',()=>{
  for(const id of ['bamboo','willow','carbon','copper','rosewood'])assert.equal(Motion.fxProfile({id,rarity:'common'}),null);
  const themes=['tide','jade','phoenix','cloud','astral'].map(id=>Motion.fxProfile({id,rarity:'legendary',color:'#123456',accent:'#fedcba'}));
  assert.equal(new Set(themes.map(p=>p.theme)).size,5,'water, vines, flame, clouds and stars look distinct');
  for(const p of themes){const material=require('../skins/tracer/fishing-rod-effects').design(p.variant);assert.equal(p.color,material?.colors[1]||'#fedcba');assert.equal(p.accent,material?.colors[0]||'#123456');}
  assert.equal(Motion.fxProfile({id:'jade',rarity:'rare',color:'url(bad)',accent:'invalid'}).color,'#c7e8d4');
  assert.equal(Motion.fxProfile({id:'clockwork',rarity:'rare'}).theme,'clockwork');
  assert.equal(Motion.fxProfile({id:'frost',rarity:'rare'}).theme,'ice');
  assert.equal(Motion.fxProfile({id:'__proto__',rarity:'legendary'}),null);
});

test('tornado fallback twists a continuous narrow-footed funnel instead of fading a static icon',()=>{
  const initial=Motion.tornadoGeometry(0),turning=Motion.tornadoGeometry(480),next=Motion.tornadoGeometry(496);
  assert.equal(initial.length,3);let changed=0;
  for(let strand=0;strand<initial.length;strand++){
    const points=initial[strand],foot=points.slice(0,8),mouth=points.slice(-16);
    assert(Math.max(...mouth.map(p=>Math.abs(p.x)))>6*Math.max(...foot.map(p=>Math.abs(p.x))),'the mouth is substantially wider than the rooted foot');
    assert(points[0].y-points.at(-1).y>1.7,'the vortex is vertically elongated');
    assert(points.some(p=>p.depth>.9)&&points.some(p=>p.depth<-.9),'each helix turns through front and back');
    for(let i=0;i<points.length;i++){
      const p=points[i];assert(Object.values(p).every(Number.isFinite));assert(p.width>=0);assert(Math.abs(p.x)<.82&&p.y>=-1.25&&p.y<=1.1);
      if(i)assert(Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y)<.17,'each wind band is continuous');
      changed+=Math.abs(turning[strand][i].x-p.x);assert(Math.hypot(next[strand][i].x-turning[strand][i].x,next[strand][i].y-turning[strand][i].y)<.05,'frame-to-frame twisting stays smooth');
    }
  }
  assert(changed>30,'time materially articulates wind positions, rather than changing only opacity');
  const charged=Motion.tornadoGeometry(0,1),maxRadius=rows=>Math.max(...rows.flat().map(p=>Math.abs(p.x)));assert(maxRadius(charged)>maxRadius(initial),'charging opens the rotating mouth');
});

test('tornado fallback freezes geometry for reduced motion and never changes dragon cloud styling',()=>{
  assert.deepEqual(Motion.tornadoGeometry(10,.2,true),Motion.tornadoGeometry(20000,.9,true));
  for(const age of [NaN,Infinity,-10,0,60000])assert(Motion.tornadoGeometry(age).flat().every(p=>Object.values(p).every(Number.isFinite)));
  const context={};vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/fishing-motion'),'utf8'),context);const fallback=context.TracerFishingMotion;
  const wind=fallback.fxProfile({id:'cloud',rarity:'epic',color:'#000',accent:'#000'}),dragon=fallback.fxProfile({id:'dragon',rarity:'legendary'});
  assert.equal(wind.theme,'tornado');assert.equal(wind.color,'#b7e4ee');assert.equal(wind.accent,'#f1ffff');assert.equal(dragon.theme,'cloud');assert.notEqual(fallback.effectShape(wind),fallback.effectShape(dragon));
  const preview=fallback.catalogEffectsMarkup({id:'cloud',rarity:'epic'});assert(preview.includes('data-fx-theme="tornado"'));assert(!preview.includes('fishing-catalog-mote'));assert(!preview.includes(fallback.effectShape(dragon)),'the cloud-shaped icon is absent from the wind rod fallback card');assert(!/NaN|undefined|Infinity/.test(preview));
  const again=fallback.catalogEffectsMarkup({id:'cloud',rarity:'epic'});assert.notEqual(preview.match(/radialGradient id="([^"]+)"/)[1],again.match(/radialGradient id="([^"]+)"/)[1]);
});
test('advanced catalogue rods share live themes and safe continuous material colours',()=>{
  const {catalog}=require('../public/fishing-model');
  for(const rod of catalog.rods){
    const profile=Motion.fxProfile(rod),markup=Motion.catalogEffectsMarkup(rod);
    if(!profile){assert.equal(markup,'');continue;}
    if(profile.theme==='painted'){assert.equal(markup,'','subtle painted attacks do not add idle catalogue particles');continue;}
    assert(markup.includes('data-fx-theme="'+profile.theme+'"'),rod.id+' shares its live effect theme');
    const organic=rod.animeAction||rod.expansion===2||['epic','legendary'].includes(rod.rarity)||catalog.rodPools.find(p=>p.id==='journey').rodIds.includes(rod.id);
    if(organic){assert(markup.includes(rod.rarity==='legendary'?'fishing-prestige-orbit':'fishing-catalog-flow'));assert(!markup.includes('fishing-catalog-mote'));}
    else{assert(markup.includes(Motion.effectShape(profile)),rod.id+' shares its live particle shape');assert(markup.includes('--rod-glow:'+profile.color)&&markup.includes('--rod-accent:'+profile.accent));assert(markup.includes('fishing-catalog-wisp'));}
    if(rod.rarity==='legendary'){assert(markup.includes('data-prestige-art="imagegen"'));assert(!markup.includes('fishing-catalog-halo'));assert(!markup.includes('radialGradient'));}else assert(markup.includes('fishing-catalog-halo'));
    assert(!markup.includes('NaN')&&!markup.includes('undefined'));
  }
  const a=Motion.catalogEffectsMarkup(catalog.rods.find(rod=>rod.id==='astral')),b=Motion.catalogEffectsMarkup(catalog.rods.find(rod=>rod.id==='astral'));
  assert(!a.includes('<defs>')&&!b.includes('<defs>'),'painted cards need no shared gradient IDs');
  assert(!Motion.catalogEffectsMarkup({id:'astral',rarity:'legendary',accent:'url(https://example.test)',color:'" onload="bad'}).includes('example.test'));
});
test('rod effects respond to action, settle after a hook and respect reduced motion',()=>{
  const idle=Motion.effectState('idle',1000,values,false),charge=Motion.effectState('charging',1000,values,false);
  assert(charge.wrap>idle.wrap&&charge.strength>idle.strength);
  assert(Motion.effectState('cast',80,values,false).trail>Motion.effectState('cast',1000,values,false).trail);
  assert(Motion.effectState('reeling',0,values,false).burst>0);
  assert.equal(Motion.effectState('reeling',1000,values,false).burst,0);
  assert(Motion.effectState('reeling',1000,values,false).pulse>0);
  for(const phase of ['idle','charging','cast','waiting','bite','reeling','caught','escaped']){
    const full=Motion.effectState(phase,100,values,false),quiet=Motion.effectState(phase,100,values,true);
    assert(quiet.particles<=full.particles&&quiet.strength<=full.strength);
    for(const [key,value] of Object.entries(full))assert(Number.isFinite(value)&&value>=0&&(key==='particles'?value<=16:value<=1),phase+' '+key);
  }
});
test('blade action effects trigger on cast and hook and stop before the catch result',()=>{
  for(const id of ['katana','guandao']){
    const profile=Motion.fxProfile({id,rarity:'legendary'});
    assert.equal(profile.action,id);
    for(const phase of ['cast','reeling']){
      const start=Motion.actionEffectState(profile,phase,180),late=Motion.actionEffectState(profile,phase,1200);
      assert.equal(start.kind,'slash');assert(start.alpha>.5);assert.equal(late,null);
    }
    for(const phase of ['idle','charging','waiting','bite','escaped'])assert.equal(Motion.actionEffectState(profile,phase,180),null);
    assert.equal(Motion.actionEffectState(profile,'caught',400),null,'finish waits for the landed fish');
    assert.equal(Motion.actionEffectState(profile,'caught',2050),null,'finish clears before result controls appear');
  }
  assert.equal(Motion.actionEffectState(Motion.fxProfile({id:'katana',rarity:'epic'}),'caught',1000).kind,'slash');
  for(const id of ['jade','guandao','dragon'])assert.equal(Motion.actionEffectState(Motion.fxProfile({id,rarity:'legendary'}),'caught',1000).kind,'dragon');
});
test('action effect geometry follows the fish and reduced motion keeps a fixed faint cue',()=>{
  const tip={x:90,y:35},fish={x:170,y:218};
  for(const id of ['katana','guandao','jade'])for(const phase of ['cast','reeling','caught']){
    const profile=Motion.fxProfile({id,rarity:'legendary'}),age=phase==='caught'?1000:230;
    const active=Motion.actionEffectState(profile,phase,age),quiet=Motion.actionEffectState(profile,phase,age,true);if(!active)continue;
    assert(quiet.alpha<=.22);assert.equal(quiet.sweep,.72,'quiet cue has no sweeping slash or dragon orbit');
    const shape=Motion.actionEffectGeometry(active,geometry,tip,fish);
    for(const [key,value]of Object.entries(shape))if(typeof value==='string')assert(!/NaN|Infinity|undefined/.test(value),id+' '+key);
    if(phase==='caught'){
      assert.equal(shape.center.x,fish.x);
      const moved=Motion.actionEffectGeometry(active,geometry,tip,{x:fish.x+12,y:fish.y-4});
      assert.equal(moved.center.x-shape.center.x,12);assert.equal(moved.center.y-shape.center.y,-4,'dragon tracks the actual landed fish');
      if(shape.kind==='dragon')assert(shape.spikes&&shape.headTransform,'jade dragon has a head and dorsal silhouette');
    }
  }
});
test('cast leaves the rod tip, follows a continuous arc and lands exactly at the water',()=>{
  const start=Motion.pose('cast',0,values,geometry,false),end=Motion.pose('cast',650,values,geometry,false),middle=Motion.pose('cast',325,values,geometry,false);
  assert.equal(start.x,geometry.launch.x);assert.equal(start.y,geometry.launch.y);
  assert.equal(end.x,geometry.water.x);assert(Math.abs(end.y-geometry.water.y)<1e-6);
  assert(middle.y<(geometry.launch.y+geometry.water.y)/2-30,'visible overhead arc');
  let previous=start;
  for(let t=16;t<=660;t+=16){const next=Motion.pose('cast',t,values,geometry,false);assert(Math.hypot(next.x-previous.x,next.y-previous.y)<14,'no per-frame position jump');assert(Math.abs(next.angle-previous.angle)<9,'no per-frame rod jump');previous=next;}
});

test('casting distance changes the real landing point and stays inside the small pond',()=>{
  const near=Motion.castLanding(.15,geometry),far=Motion.castLanding(1,geometry);assert(far.x>near.x&&far.y<near.y,'longer casts reach away from the rod into deeper water');
  assert(Math.hypot(far.x-near.x,far.y-near.y)>30,'distance is visible rather than a label');
  for(const distance of [-2,0,.15,.5,1,4]){const world=Motion.castWorld(distance);assert(Math.hypot(world.x,world.z)<1.7,'all cast endpoints stay in the pool');const water=Motion.castLanding(distance,geometry),end=Motion.pose('cast',650,{...values,castDistance:distance},{...geometry,water},false);assert(Math.abs(end.x-water.x)<1e-6&&Math.abs(end.y-water.y)<1e-6);}
});

test('nibbles are shallow waiting cues and surges pull harder while stamina fades',()=>{
  const still=Motion.pose('waiting',200,{...values,nibble:0},geometry,false),nibble=Motion.pose('waiting',200,{...values,nibble:1},geometry,false),bite=Motion.pose('bite',200,values,geometry,true);
  assert(nibble.y>still.y&&nibble.y-still.y<3,'a nibble nudges the float but does not sink it');assert(bite.y>nibble.y,'the true bite is a deeper dip');assert.equal(nibble.floatAlpha,1);
  const cruise=Motion.pose('reeling',1800,{...values,fishBehavior:'cruise',stamina:1},geometry,false),surge=Motion.pose('reeling',1800,{...values,fishBehavior:'surge',stamina:1},geometry,false),tired=Motion.pose('reeling',1800,{...values,fishBehavior:'surge',stamina:0},geometry,false);
  assert(surge.angle<cruise.angle,'a surge has a small handle reaction while the shaft carries most of the bend');assert.equal(tired.angle,cruise.angle,'exhausted fish cannot create a full-strength lunge');
  for(const fishBehavior of ['cruise','surge','rest'])for(const stamina of [0,.5,1]){const p=Motion.pose('reeling',1800,{...values,fishBehavior,stamina},geometry,false);assert.equal(p.sag,0);for(const v of Object.values(p))assert(Number.isFinite(v));}
});

test('cantilever bend fixes the grip and lower shaft and preserves centreline length',()=>{
  const anchor=Motion.rodGeometry({width:250.8,height:418}),length=Math.hypot(anchor.tip.x-anchor.grip.x,anchor.tip.y-anchor.grip.y);
  for(const bend of [-.24,-.1,0,.1,.24]){
    for(const along of [0,.1,.3]){const bent=Motion.rodCurvePoint(along,bend,anchor),straight=Motion.rodCurvePoint(along,0,anchor);assert.equal(bent.x,straight.x);assert.equal(bent.y,straight.y);assert.equal(bent.angle,0,'the grip and reel have no local rotation');}
    let arc=0,previous=Motion.rodCurvePoint(0,bend,anchor);for(let i=1;i<=500;i++){const next=Motion.rodCurvePoint(i/500,bend,anchor);arc+=Math.hypot(next.x-previous.x,next.y-previous.y);previous=next;}assert(Math.abs(arc/length-1)<.005,'bending does not visibly stretch the rod');
  }
  assert.deepEqual(Motion.rodCurvePoint(1,10,anchor),Motion.rodCurvePoint(1,.24,anchor));
  const bent=Motion.rodCurvePoint(1,.2,anchor),normal={x:-(anchor.tip.y-anchor.grip.y)/length,y:(anchor.tip.x-anchor.grip.x)/length};assert(Math.abs((bent.x-anchor.tip.x)*normal.x+(bent.y-anchor.tip.y)*normal.y-length*.2)<1e-6);assert(bent.angle>20,'upper shaft is visibly curved');
});

test('shaft load follows transverse line force, rod stiffness, fish size and actual reel control',()=>{
  const box={x:42,y:77,width:102,height:170},anchor=Motion.rodGeometry(box),grip={x:box.x+anchor.grip.x,y:box.y+anchor.grip.y},tip=Motion.rotatedTip(box,anchor,0),g={box,anchor,grip},axis={x:tip.x-grip.x,y:tip.y-grip.y},along={x:tip.x+axis.x,y:tip.y+axis.y},across={x:tip.x-axis.y,y:tip.y+axis.x},rod={id:'bamboo',control:1};
  const load=v=>Motion.rodLoad('reeling',2000,v,g,across,0,rod),base={tension:0,holding:0,stamina:1,fishBehavior:'cruise',fishLoad:1};
  assert(Math.abs(Motion.rodLoad('reeling',2000,{...base,tension:1,holding:1},g,along,0,rod))<1e-10,'pure axial pull cannot cause a large bend');
  assert(load(base)>.05,'a fighting fish leaves a mild bend even at zero tension');assert(load({...base,holding:1})>load(base));assert(load({...base,fishBehavior:'surge'})>load(base));assert(load({...base,fishBehavior:'rest'})<load(base));assert(load({...base,fishLoad:1.6})>load({...base,fishLoad:.45}));
  assert(load({...base,stamina:0})<load(base),'a tired fish pulls less strongly');assert(Motion.rodLoad('reeling',65,base,g,across,0,rod)>load(base),'hook lift briefly loads the shaft');
  assert(Motion.rodLoad('reeling',2000,base,g,across,0,{id:'carbon',control:1})<load(base),'stiff carbon and flexible bamboo react differently');assert(load({...base,tension:1,holding:1,fishBehavior:'surge'})<=.22);
});

test('released rod springs back with damping instead of snapping or growing unstable',()=>{
  const state={bend:.18,velocity:0};Motion.stepRodSpring(state,0,16,.68);assert(state.bend>.15&&state.bend<.18,'first release frame preserves continuity');let max=.18,min=.18;
  for(let i=0;i<90;i++){Motion.stepRodSpring(state,0,16,.68);max=Math.max(max,state.bend);min=Math.min(min,state.bend);assert(Number.isFinite(state.velocity)&&Math.abs(state.bend)<=.24);}assert(max<=.18);assert(min<0&&min>-.02,'small elastic rebound');assert(Math.abs(state.bend)<.0001);
  const quiet={bend:.18,velocity:0};for(let i=0;i<90;i++){Motion.stepRodSpring(quiet,0,16,.68,true);assert(quiet.bend>=0,'reduced motion removes the rebound but keeps deflection');}
});

test('rendered flexible shaft and taut line share one actual tip and release resources on rod changes',()=>{
  let now=0,serial=0,svg={},created=0,destroyed=0;const frames=new Map(),shapes=[],poses=[];
  const win={performance:{now:()=>now},requestAnimationFrame:cb=>{frames.set(++serial,cb);return serial;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:false})},doc={defaultView:win,hidden:false,addEventListener(){},removeEventListener(){}};
  const node=()=>({style:{},setAttribute(){}}),stage={ownerDocument:doc,clientWidth:380,clientHeight:260,classList:{add(){},remove(){}},dataset:{}},box={x:42,y:77,width:102,height:170},rod={...node(),offsetLeft:box.x,offsetTop:box.y,offsetWidth:box.width,offsetHeight:box.height,querySelector:()=>svg,dataset:{}},path={...node(),d:'',setAttribute(key,value){if(key==='d')this.d=value;}};
  const player=Motion.create({stage,rod,bobber:node(),line:node(),path,createRodFlex:()=>{created++;return{update:shape=>shapes.push(shape),destroy:()=>destroyed++};},onFrame:pose=>poses.push(pose)}),step=ms=>{now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(now));};
  const snapshot={rod:{id:'bamboo',control:1},session:{id:'flex',phase:'reeling',holding:true,tension:.4,stamina:1,fishBehavior:'surge',fishPosition:.7}};player.update(snapshot);for(let i=0;i<45;i++)step(16);const frame=poses.at(-1),anchor=Motion.rodGeometry(box),expected=Motion.rotatedRodPoint(box,anchor,Motion.rodCurvePoint(1,shapes.at(-1).bend,anchor),frame.pose.angle);assert(frame.pose.bend>.12);assert.equal(frame.tip.x,expected.x);assert.equal(frame.tip.y,expected.y);
  const coords=path.d.match(/-?\d+(?:\.\d+)?/g).map(Number);assert(Math.hypot(coords[0]-expected.x,coords[1]-expected.y)<.01,'line leaves the deformed image tip');const straight=Motion.rotatedTip(box,anchor,frame.pose.angle);assert(Math.hypot(frame.tip.x-straight.x,frame.tip.y-straight.y)>20,'test detects a shaft bend rather than only rotation');
  const end=coords.slice(-2);for(let i=2;i<coords.length-2;i+=2)assert(Math.abs((coords[i]-coords[0])*(end[1]-coords[1])-(coords[i+1]-coords[1])*(end[0]-coords[0]))<3,'reeling line remains straight after bending');
  svg={};player.update(snapshot);step(16);assert.equal(created,2);assert.equal(destroyed,1);const before=JSON.stringify(snapshot);for(let i=0;i<5;i++)step(16);assert.equal(JSON.stringify(snapshot),before);player.destroy();assert.equal(destroyed,2);assert.equal(frames.size,0);
});

test('water projection respects desktop CSS zoom and each nibble pulse emits only one subtle ripple',()=>{
  let now=0,serial=0;const frames=new Map(),events=[],poses=[];
  const win={performance:{now:()=>now},requestAnimationFrame:cb=>{frames.set(++serial,cb);return serial;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:false})},doc={defaultView:win,hidden:false,addEventListener(){},removeEventListener(){}};
  const node=()=>({style:{},setAttribute(){}}),stage={ownerDocument:doc,clientWidth:380,clientHeight:260,classList:{add(){},remove(){}},dataset:{},getBoundingClientRect:()=>({left:10,top:20,width:304,height:208})};
  const pond={getWaterPosition:world=>({x:10+(.55+world.x*.04)*304,y:20+(.6+world.z*.03)*208}),waterEvent:event=>events.push(event)},rod={...node(),offsetLeft:42,offsetTop:77,offsetWidth:102,offsetHeight:170};
  const player=Motion.create({stage,rod,bobber:node(),line:node(),path:node(),pond,onFrame:frame=>poses.push(frame.pose)}),step=ms=>{now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(now));};
  const session={id:'live',phase:'waiting',castDistance:1,nibble:0};player.update({session});step(500);const world=Motion.castWorld(1),pose=poses.at(-1);assert(Math.abs(pose.x-(.55+world.x*.04)*380)<1e-6,'client projection converts back to unscaled logical coordinates');
  session.nibble=.4;player.update({session});session.nibble=1;player.update({session});session.nibble=.1;player.update({session});assert.equal(events.filter(e=>e.type==='nibble').length,1);session.nibble=0;player.update({session});session.nibble=.5;player.update({session});assert.equal(events.filter(e=>e.type==='nibble').length,2);
  for(const event of events.filter(e=>e.type==='nibble')){assert.equal(event.x,world.x);assert.equal(event.z,world.z);assert(event.strength<.2,'a test nibble does not play the hook splash');}
  session.phase='reeling';session.fishBehavior='cruise';player.update({session});session.fishBehavior='surge';player.update({session});player.update({session});assert.equal(events.filter(e=>e.type==='surge').length,1,'mutable authoritative session still produces one surge entry event');const before=JSON.stringify(session);step(200);assert.equal(JSON.stringify(session),before);player.destroy();assert.equal(frames.size,0);
});
test('reeling keeps the line taut at every tension and a catch lands, flops briefly then fades',()=>{
  for(const tension of [0,.5,1])assert.equal(Motion.pose('reeling',1800,{...values,tension},geometry,false).sag,0);
  assert.notEqual(Motion.pose('reeling',1800,{...values,tension:1},geometry,false).angle,Motion.pose('reeling',1800,{...values,tension:0},geometry,false).angle,'tension still moves the rod');
  const start=Motion.pose('caught',0,values,geometry,false),mid=Motion.pose('caught',380,values,geometry,false),land=Motion.pose('caught',760,values,geometry,false),flop=Motion.pose('caught',840,values,geometry,false),end=Motion.pose('caught',2300,values,geometry,false);
  assert.equal(start.x,geometry.water.x);assert.equal(start.y,geometry.water.y);assert(mid.fishAlpha>.9);assert(mid.y<Math.min(start.y,end.y));
  assert.equal(land.x,geometry.width*.43);assert.equal(land.y,geometry.height*.88);assert.equal(land.fishAlpha,1);assert.equal(land.lineAlpha,0,'line releases before the landed fish struggles');
  assert(flop.y<land.y&&Math.abs(flop.fishAngle)>8,'fish makes a small sideways hop on the ground');assert(flop.fishSquash<1,'body flexes during a flop');
  assert(Motion.pose('caught',1700,values,geometry,false).fishAlpha>.99,'fish stays visible for the brief struggle');assert.equal(end.fishAlpha,0);assert.equal(end.lineAlpha,0);
  const quiet=Motion.pose('caught',840,values,geometry,true);assert.equal(quiet.y,land.y);assert.equal(quiet.fishAngle,0,'reduced motion keeps a calm landing before fade');
  assert.equal(Motion.pose('escaped',1000,values,geometry,false).lineAlpha,0);
});
test('reduced motion keeps interaction cues and suppresses large arcs; every phase stays finite',()=>{
  const normal=Motion.pose('cast',225,values,geometry,false),reduced=Motion.pose('cast',225,values,geometry,true);
  assert(reduced.y>normal.y,'reduced motion removes the high cast arc');
  assert(Motion.pose('bite',200,values,geometry,true).floatAlpha>0,'bite remains visible');
  for(const phase of ['idle','charging','cast','waiting','bite','reeling','caught','escaped'])for(const reduced of [false,true])for(const t of [0,16,120,450,650,1000,45000,240000]){
    const result=Motion.pose(phase,t,{castPower:2,tension:-2,fishPosition:4},geometry,reduced);
    for(const value of Object.values(result))assert(Number.isFinite(value),phase+' must remain finite');
    for(const key of ['lineAlpha','floatAlpha','fishAlpha'])assert(result[key]>=0&&result[key]<=1,phase+' alpha range');
  }
});
test('line anchor follows the visible rod art in both narrow and wide containers',()=>{
  for(const box of [{x:4,y:23,width:136,height:226},{x:10,y:8,width:380,height:190}]){
    const anchor=Motion.rodGeometry(box),tip=Motion.rotatedTip(box,anchor,0);
    assert(Math.abs(tip.x-box.x-anchor.tip.x)<1e-8);assert(Math.abs(tip.y-box.y-anchor.tip.y)<1e-8);
    assert(anchor.tip.x>=0&&anchor.tip.x<=box.width&&anchor.tip.y>=0&&anchor.tip.y<=box.height);
    const turned=Motion.rotatedTip(box,anchor,30),center={x:box.x+anchor.grip.x,y:box.y+anchor.grip.y};
    assert(Math.abs(Math.hypot(turned.x-center.x,turned.y-center.y)-Math.hypot(tip.x-center.x,tip.y-center.y))<1e-8,'rotation keeps the grip fixed');
  }
});
test('renderer emits one landing, leaves authoritative state untouched and releases animation on hide/destroy',()=>{
  let now=0,nextId=0;const frames=new Map(),listeners=new Map(),events=[];
  const win={performance:{now:()=>now},requestAnimationFrame:cb=>{frames.set(++nextId,cb);return nextId;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})};
  const doc={defaultView:win,hidden:false,addEventListener:(key,cb)=>listeners.set(key,cb),removeEventListener:key=>listeners.delete(key)};
  const node=()=>({style:{},attributes:{},setAttribute(key,value){this.attributes[key]=String(value);},hidden:false});
  const stage={ownerDocument:doc,clientWidth:380,clientHeight:260,classList:{add(){},remove(){}}},rod={...node(),offsetLeft:4,offsetTop:23,offsetWidth:136,offsetHeight:226};
  const linePath=node();
  const player=Motion.create({stage,rod,bobber:node(),line:node(),path:linePath,pond:{waterEvent:event=>events.push(event)}});
  const step=ms=>{now+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(now));};
  const snapshot={session:{id:'cast1',phase:'charging',castPower:.8,tension:0}};
  player.update(snapshot);step(16);const original=JSON.stringify(snapshot);step(64);assert.equal(JSON.stringify(snapshot),original);
  player.update({session:{...snapshot.session,phase:'cast'}});for(let i=0;i<42;i++)step(16);
  player.update({session:{...snapshot.session,phase:'waiting'}});step(16);assert.equal(events.filter(e=>e.type==='cast').length,1);
  player.update({session:{...snapshot.session,phase:'bite'}});step(16);player.update({session:{...snapshot.session,phase:'reeling'}});step(16);
  assert.equal(events.filter(e=>e.type==='bite').length,1);assert.equal(events.filter(e=>e.type==='hook').length,1);
  step(180);
  const coords=linePath.attributes.d.match(/-?\d+(?:\.\d+)?/g).map(Number),start=coords.slice(0,2),end=coords.slice(-2);
  for(let i=2;i<coords.length-2;i+=2){const cross=(coords[i]-start[0])*(end[1]-start[1])-(coords[i+1]-start[1])*(end[0]-start[0]);assert(Math.abs(cross)<3,'every rendered control point lies on the taut line after the hook');}
  doc.hidden=true;listeners.get('visibilitychange')();assert.equal(frames.size,0);doc.hidden=false;listeners.get('visibilitychange')();assert.equal(frames.size,1);
  player.destroy();assert.equal(frames.size,0);assert.equal(listeners.size,0);player.update(snapshot);assert.equal(frames.size,0);
});

test('cast responds in one frame and keeps its exact aim through 200ms acknowledgements',()=>{
  let now=0,serial=0;const frames=new Map(),poses=[];
  const win={performance:{now:()=>now},requestAnimationFrame:cb=>{frames.set(++serial,cb);return serial;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:false})},doc={defaultView:win,hidden:false,addEventListener(){},removeEventListener(){}};
  const node=()=>({style:{},setAttribute(){}}),stage={ownerDocument:doc,clientWidth:380,clientHeight:260,classList:{add(){},remove(){}},dataset:{}},rod={...node(),offsetLeft:42,offsetTop:77,offsetWidth:102,offsetHeight:170,dataset:{}},aim=node();
  const player=Motion.create({stage,rod,bobber:node(),line:node(),path:node(),castTarget:aim,onFrame:p=>poses.push(p)});
  const step=ms=>{now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(now));};
  const base={rod:{id:'bamboo'},nativeSessionId:'idle-native',session:{id:'',phase:'idle'}};
  player.update(base);step(16);player.startCastInput();step(16);
  assert.equal(poses.at(-1).phase,'charging');assert.equal(aim.hidden,false);assert(Math.abs(poses.at(-1).values.castPower-16/1100)<1e-10);
  step(384);const aim400={x:aim.style.left,y:aim.style.top};player.releaseCastInput(400);step(16);
  assert.equal(poses.at(-1).phase,'cast');assert.equal(poses.at(-1).age,16);assert(Math.abs(poses.at(-1).values.castPower-400/1100)<1e-10);
  player.update({...base,nativeSessionId:'cast-native',sessionId:'new',session:{id:'new',phase:'charging',phaseTime:200,castPower:200/1100}});step(184);
  assert.equal(poses.at(-1).phase,'cast');assert.equal(poses.at(-1).age,200);
  const distance=.15+.85*400/1100;player.update({...base,nativeSessionId:'cast-native',disabled:true,session:{id:'new',phase:'cast',phaseTime:0,castPower:400/1100,castDistance:distance}});step(450);
  const result=poses.at(-1);assert.equal(result.age,650);assert(Math.abs(result.pose.x-parseFloat(aim400.x))<1e-8);assert(Math.abs(result.pose.y-parseFloat(aim400.y))<1e-8);
  player.destroy();
});

test('high refresh screens cap visual work without delaying cast input and an unsummoned desktop rod sleeps',()=>{
  let now=0,id=0,renders=0,last;const frames=new Map(),node=()=>({style:{},setAttribute(){}});
  const win={performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:false})};
  const doc={defaultView:win,hidden:false,addEventListener(){},removeEventListener(){}},stage={ownerDocument:doc,clientWidth:380,clientHeight:260,classList:{add(){},remove(){}},dataset:{rodVisible:'true'}};
  const player=Motion.create({stage,rod:{...node(),offsetLeft:4,offsetTop:23,offsetWidth:136,offsetHeight:226},onFrame:p=>{renders++;last=p;}});
  const step=ms=>{now+=ms;const callbacks=[...frames.values()];frames.clear();for(const fn of callbacks)fn(now);};
  player.update({session:{id:'one',phase:'waiting'}});for(let i=0;i<144;i++)step(1000/144);
  assert(renders>=59&&renders<=62,'render near 60 Hz instead of 144 Hz: '+renders);
  player.update({session:{id:'',phase:'idle'}});stage.dataset.rodVisible='false';step(20);assert.equal(frames.size,0,'no hidden rod animation loop');
  player.startCastInput();step(1000/144);assert.equal(last.phase,'charging');assert(last.values.castPower>0,'local input wakes before the native acknowledgement');
  player.destroy();assert.equal(frames.size,0);
});
