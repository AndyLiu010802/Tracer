'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const actions=require('../skins/tracer/pet-builtin-animation').actions;
function setup(complete=true,id='sprout'){
  const timers=new Map(),events=new Map(),changes=new Set(),requested=[],delays=[];let next=0,waiting=false,released=false,ready;
  const sheets=Object.fromEntries(actions.map(action=>[action,{}]));if(!complete)delete sheets.tea;
  const media={matches:false,addEventListener:(_,fn)=>changes.add(fn),removeEventListener:(_,fn)=>changes.delete(fn)};
  const win={matchMedia:()=>media,setTimeout(fn,delay){delays.push(delay);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)};
  const doc={defaultView:win,hidden:false,createElement:()=>({dataset:{},setAttribute(){}}),addEventListener:(event,fn)=>events.set(event,fn),removeEventListener:event=>events.delete(event)};
  const Motion={create(element,options){ready=options.onReady;return{render(action){const pose=options.sample();requested.push(pose);element.dataset.frame=String(pose.frame);},waiting:()=>waiting,retry(){},destroy(){released=true;}};}};
  const root={TracerGardenCompanionMotion:Motion,TracerPetIllustratedAtlas:{kinds:{[id]:{normal:sheets}}},document:doc};
  vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/pet-illustrated-animation'),'utf8'),root);
  const player=root.TracerPetIllustratedAnimation.create({pet:id,actions,duration:()=>100,document:doc});
  return{player,doc,media,timers,events,requested,delays,tick(){const first=timers.entries().next().value;assert.ok(first);timers.delete(first[0]);first[1]();},waiting(value){waiting=value;if(!value)ready();},hidden(value){doc.hidden=value;events.get('visibilitychange')?.();},reduced(value){media.matches=value;for(const fn of changes)fn();},released:()=>released};
}
test('only a complete inspected library replaces the original built-in character',()=>{assert.equal(setup(false).player,null);});
test('actions advance in source order and repeated snapshots do not restart them',()=>{
  const b=setup(),p=b.player;
  for(const action of actions){p.setAction(action);for(let cycle=0;cycle<3;cycle++)for(let frame=0;frame<(action==='fishing'?12:16);frame++){assert.equal(p.element.dataset.frame,String(frame));p.setAction(action);b.tick();}assert.equal(p.element.dataset.frame,'0');}
  p.destroy();assert.equal(b.timers.size,0);assert.equal(b.events.size,0);assert.ok(b.released());
});
test('every built-in catch stops before releasing the fish and previews finish exactly once',()=>{
  for(const [id,end]of Object.entries({sprout:11,miso:9,brook:10,ember:10,luna:8,nova:10})){
    const b=setup(true,id),p=b.player;p.setAction('fishing');
    for(let cycle=0;cycle<3;cycle++){
      for(let frame=0;frame<=end;frame++){assert.equal(p.element.dataset.frame,String(frame),id);if(frame===end)assert.ok(b.delays.at(-1)>=1200);b.tick();}
      assert.equal(p.element.dataset.frame,'0');
    }
    p.setAction('idle');let finished=0;assert.equal(p.preview('fishing',()=>finished++),true);
    for(let frame=0;frame<=end;frame++){assert.equal(p.element.dataset.frame,String(frame));b.tick();}
    assert.equal(finished,1);assert.equal(p.element.dataset.action,'idle');b.tick();assert.equal(finished,1);p.destroy();
  }
});
test('slow loads preserve first frames, previews finish once, and focus interrupts immediately',()=>{
  const b=setup(),p=b.player;let done=0;
  b.waiting(true);p.setAction('fishing');for(let i=0;i<20;i++)b.tick();assert.equal(p.element.dataset.frame,'0');
  b.waiting(false);assert.equal(p.preview('reading',()=>done++),true);
  for(let i=0;i<16;i++){p.setAction('fishing');assert.equal(p.element.dataset.action,'reading');b.tick();}
  assert.equal(done,1);assert.equal(p.element.dataset.action,'fishing');
  p.preview('tea',()=>done++);p.setAction('focus');assert.equal(p.element.dataset.action,'focus');assert.equal(p.preview('play'),false);assert.equal(done,1);p.destroy();
});
test('hidden and reduced-motion views stop timers and cancel previews without late completion',()=>{
  const b=setup(),p=b.player;let done=0;p.preview('mining',()=>done++);b.tick();b.hidden(true);assert.equal(b.timers.size,0);assert.equal(p.element.dataset.action,'idle');
  b.hidden(false);assert.equal(b.timers.size,1);b.reduced(true);assert.equal(b.timers.size,0);p.setAction('sleep');assert.equal(p.element.dataset.frame,'0');assert.equal(p.element.dataset.action,'sleep');
  b.reduced(false);b.tick();assert.equal(p.element.dataset.frame,'1');assert.equal(done,0);p.destroy();
});
