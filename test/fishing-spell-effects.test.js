'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const S=require('../skins/tracer/fishing-spell-effects'),J=require('../skins/tracer/fishing-journey-effects'),E=require('../skins/tracer/fishing-rod-effects');
test('spell cues follow real cast, landing, bite and catch boundaries without timers',()=>{
  for(const phase of ['idle','waiting','reeling','escaped'])assert.equal(S.timeline(phase,200),null);
  assert.equal(S.timeline('waiting',821),null);assert.equal(S.timeline('bite',561),null);assert.equal(S.timeline('caught',559),null);assert.equal(S.timeline('caught',1901),null);
  assert.equal(S.timeline('charging',900,{castPower:.8}).stage,'gather');assert.equal(S.timeline('cast',300).stage,'travel');assert.equal(S.timeline('waiting',230),null);assert.equal(S.timeline('reeling',3600),null);assert.equal(S.timeline('caught',1200).stage,'finish');
  for(const count of [1,2,3,4])assert.equal(S.timeline('caught',1200,{catchCount:count}).clones,Math.min(count,3));
  for(const phase of ['cast','bite','caught']){const age=phase==='caught'?1200:230;assert(S.timeline(phase,age,{},true).alpha<=.18);}
});
test('every spell renders finite geometry in panel, desktop and quiet modes',()=>{
  const names=new Set();let paints=0;const gradient={addColorStop(at){assert(Number.isFinite(at));}};
  const ctx=new Proxy({},{get(target,key){if(key in target)return target[key];return (...args)=>{for(const x of args)if(typeof x==='number')assert(Number.isFinite(x),key);if(key==='ellipse')assert(args[2]>=0&&args[3]>=0);if(key==='fill'||key==='stroke')paints++;return key.startsWith('create')?gradient:undefined;};},set(target,key,value){if(['lineWidth','globalAlpha'].includes(key))assert(Number.isFinite(value)&&value>=0);target[key]=value;return true;}});
  // VALORANT uses cached bitmap atlases, covered by real browser QA on both game surfaces.
  for(const [id,[name]]of Object.entries(S.spells).filter(([id])=>!id.startsWith('valorant_'))){names.add(name);for(const width of [240,304,720])for(const quiet of [false,true])for(const [phase,sampleAge]of [['charging',900],['cast',260],['bite',180],['caught',1140]]){const age=id.startsWith('anime_')&&phase==='caught'?430:sampleAge,height=width*.68,g={width,height,water:{x:width*.68,y:height*.71}},tip={x:width*.31,y:height*.15};const result=S.draw(ctx,id,phase,age,{castPower:.8,tension:.7,catchCount:3},g,tip,g.water,quiet);if(id.startsWith('anime_')&&phase==='charging')assert.equal(result,null);else assert(result,id+'/'+phase);}}
  assert(names.size>=16,'themes have distinct geometry families');assert(paints>1000);assert.equal(S.draw(ctx,'bamboo','cast',230,{},{}),null);
});
test('thirteen illustrated spirits have complete finite rig controls and deterministic quiet poses',()=>{
  assert.equal(Object.keys(J.scenes).length,13);
  for(const id of Object.keys(J.scenes))for(const phase of ['summon','cast','bite','reeling','caught']){
    const a=J.pose(id,{phase,progress:.23}),b=J.pose(id,{phase,progress:.61});for(const value of Object.values(a))assert(Number.isFinite(value));for(const field of ['x','y','wing','opening','orbit','draw'])assert(Number.isFinite(a[field]),id+'/'+field);
    assert.notDeepEqual(a,b);assert.deepEqual(J.pose(id,{phase,progress:.2,reduced:true}),J.pose(id,{phase,progress:.8,reduced:true}));
  }
});
test('every illustrated spirit is bundled from a documented transparent source',()=>{
  const root=path.resolve(__dirname,'..'),manifest=require('../docs/fishing-journey-vfx-art.json');assert.equal(manifest.assets.length,13);
  const files=new Set();for(const item of manifest.assets){const bytes=fs.readFileSync(path.join(root,item.file));assert.equal(bytes[25],6,'RGBA source '+item.id);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);assert.equal(path.basename(item.file),E.summonScene(item.id).art);assert(item.prompt.length>400);files.add(item.file);}
  assert.equal(files.size,13);
  for(const file of ['index.html','fishing-desktop.html']){const html=fs.readFileSync(path.join(root,'skins/tracer',file),'utf8');assert(html.indexOf('/fishing-spell-effects.js')<html.indexOf('/fishing-rod-effects.js'));}
  const retained=require('../dev/desktop-pack-assets.cjs').verifyAssets(root);for(const file of files)assert(retained.includes(file));
});

test('the live Ruyi spell renders the same rotating red-iron staff, including software and quiet paths',()=>{
  const frames=[],g={width:380,height:260,water:{x:270,y:192}},tip={x:135,y:34};
  const capture=(phase,age,quiet=false)=>{
    const commands=[],gradient={addColorStop:(...args)=>commands.push(['color',...args])};
    const ctx=new Proxy({},{get:(_,key)=>(...args)=>{commands.push([key,...args]);return key.startsWith('create')?gradient:undefined;},set:()=>true});
    const state=S.draw(ctx,'ruyi',phase,age,{},g,tip,g.water,quiet);return {state,commands};
  };
  for(const age of [140,290,460,610]){const result=capture('cast',age);assert(result.commands.some(c=>c.includes('#9e2925')),'red iron survives the live spell dispatcher');assert(result.commands.some(c=>c.includes('#d29b3e')),'gold end sleeves');frames.push(JSON.stringify(result.commands));}
  assert.equal(new Set(frames).size,4,'the real render path spins instead of retaining the old fixed pillar');
  assert.equal(capture('cast',610).state.stage,'settle');assert.equal(capture('reeling',1280+640).state,null);assert.deepEqual(capture('reeling',1280+640).commands,[]);
  assert.deepEqual(capture('cast',200,true).commands,capture('cast',440,true).commands,'quiet mode freezes geometry');
});

test('decorative effects stay off throughout waiting and reeling, and end before the catch result',()=>{
  const noPaint=new Proxy({},{get:(_,key)=>()=>assert.fail('unexpected decorative draw: '+key)});
  for(const phase of ['waiting','reeling','escaped'])for(const age of [0,230,1280,1800,5000,60000]){
    assert.equal(E.effectVisible(phase,age),false);
    for(const id of Object.keys(S.spells))assert.equal(S.draw(noPaint,id,phase,age,{},{}),null);
  }
  assert(E.effectVisible('idle',60000));assert(E.effectVisible('cast',280));assert(E.effectVisible('bite',200));assert(E.effectVisible('caught',1150));
  assert.equal(E.effectVisible('cast',700),false);assert.equal(E.effectVisible('bite',560),false);assert.equal(E.effectVisible('caught',1940),false);
});
