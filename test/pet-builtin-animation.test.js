'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Art=require('../skins/tracer/pet-art'),Animation=require('../skins/tracer/pet-builtin-animation'),Idle=require('../skins/tracer/pet-idle'),Personalities=require('../skins/tracer/pet-personalities');

test('all six built-ins have sixteen distinct articulated poses for each of sixteen actions',()=>{
  assert.equal(Animation.actions.length,16);assert.equal(Animation.frames,16);
  for(const id of Object.keys(Art.rigs))for(const action of Animation.actions){
    const frames=Array.from({length:16},(_,frame)=>Animation.snapshot(id,action,frame));
    assert.equal(new Set(frames).size,16,id+':'+action+' must not pad the sequence with duplicates');
    for(const svg of frames){
      assert.match(svg,new RegExp('data-species="'+Art.rigs[id].species+'"'));
      assert.match(svg,/animation:none!important;transform:none!important;overflow:hidden/);
      assert.doesNotMatch(svg,/NaN|undefined|Infinity/);
      assert.equal((svg.match(/<svg\b/g)||[]).length,1);
      assert.equal((svg.match(/<g\b/g)||[]).length,(svg.match(/<\/g>/g)||[]).length);
      assert.match(svg,/class="rig-part rig-posture"[^>]+transform:translate\(0px,0px\) rotate\(0deg\) scale\(1,1\)/,'no whole-character motion');
    }
    const components=frames.map(svg=>[...svg.matchAll(/<g class="[^"]*rig-(head|arm-left|arm-right|tail|ear-left|body)"[^>]*>/g)].map(match=>match[0]).join(''));
    assert.equal(new Set(components).size,16,id+':'+action+' must change the articulated character, not only a prop');
  }
});

test('pose loops and bounded action timings preserve rest while adding fluid in-betweens',()=>{
  for(const action of Animation.actions){
    assert.equal(Animation.snapshot('miso',action,16),Animation.snapshot('miso',action,0));
    assert.equal(Animation.snapshot('miso',action,-1),Animation.snapshot('miso',action,15));
    const times=Array.from({length:16},(_,frame)=>Animation.duration(action,frame));
    assert.ok(times.every(time=>time>=180&&time<=6000));
    if(action!=='sleep'){
      assert.ok(times[0]>=2200,'an action starts with a quiet resting pause');
      assert.ok(times[15]>=1800,'a completed gesture is not immediately repeated');
      assert.ok(times.slice(1,15).every(time=>time<=200),'in-between drawings retain a steady cadence');
    }
    assert.ok(action==='sleep'||times[0]>times[1]);
    assert.ok(times.reduce((sum,time)=>sum+time,0)>=1800);
  }
  assert.equal(Animation.snapshot('constructor','unknown',NaN),Animation.snapshot('sprout','idle',0));
});

function browser(){
  const timers=new Map(),listeners=new Map(),motionListeners=new Set();let next=0;
  class Element{constructor(){this.dataset={};this.attributes={};}setAttribute(key,value){this.attributes[key]=value;}set innerHTML(value){this.html=value;if(value.startsWith('<svg'))this.firstElementChild=new Element();}get innerHTML(){return this.html;}}
  const document={hidden:false,createElement:()=>new Element(),addEventListener:(name,listener)=>listeners.set(name,listener),removeEventListener:(name,listener)=>{if(listeners.get(name)===listener)listeners.delete(name);}};
  const media={matches:false,addEventListener:(_,listener)=>motionListeners.add(listener),removeEventListener:(_,listener)=>motionListeners.delete(listener)};
  const window={TracerPetArt:Art};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../skins/tracer/pet-builtin-animation.js'),'utf8'),{window,document,matchMedia:()=>media,setTimeout:(callback,delay)=>{timers.set(++next,{callback,delay});return next;},clearTimeout:id=>timers.delete(id)});
  return {api:window.TracerPetBuiltinAnimation,document,media,timers,listeners,motionListeners,tick(){const [id,task]=timers.entries().next().value;timers.delete(id);task.callback();},visibility(hidden){document.hidden=hidden;listeners.get('visibilitychange')?.();},reduced(value){media.matches=value;for(const listener of motionListeners)listener();}};
}

test('player progresses through all poses, switches actions once, and releases listeners and cached frames',()=>{
  const b=browser(),p=b.api.create({pet:{id:'luna'},label:'Luna'}),el=p.element;
  assert.equal(el.attributes['aria-label'],'Luna');assert.equal(el.dataset.frames,'16');
  for(const action of Animation.actions){p.setAction(action);assert.equal(el.dataset.frame,'0');for(let frame=1;frame<16;frame++){b.tick();assert.equal(el.dataset.frame,String(frame));p.setAction(action);assert.equal(el.dataset.frame,String(frame));}b.tick();assert.equal(el.dataset.frame,'0');assert.equal(b.timers.size,1);}
  p.setAction('writing');const old=el.innerHTML;p.destroy();p.destroy();p.setAction('tea');
  assert.equal(el.innerHTML,old);assert.equal(el.dataset.playback,'destroyed');assert.equal(b.timers.size,0);assert.equal(b.listeners.size,0);assert.equal(b.motionListeners.size,0);
});

test('hidden, reduced-motion, and collection players cannot run background animation timers',()=>{
  const b=browser(),p=b.api.create({pet:'nova'});b.tick();b.visibility(true);
  assert.equal(b.timers.size,0);assert.equal(p.element.dataset.playback,'hidden');
  b.visibility(false);assert.equal(b.timers.size,1);b.reduced(true);assert.equal(b.timers.size,0);assert.equal(p.element.dataset.frame,'0');
  p.setAction('crafting');assert.equal(p.element.dataset.action,'crafting');assert.equal(b.timers.size,0);
  b.reduced(false);assert.equal(b.timers.size,1);p.destroy();
  const q=b.api.create({pet:'brook',animated:false});q.setAction('reading');assert.equal(q.element.dataset.playback,'static');assert.equal(b.timers.size,0);assert.equal(b.listeners.size,0);assert.equal(b.motionListeners.size,0);q.destroy();
});

test('complete built-in libraries alternate their original favorite activities with all four quiet work actions',()=>{
  for(const id of Object.keys(Art.rigs)){
    const idle=Idle.create(),seen=[],cycle=Idle.quietTime+Idle.activeTime;
    for(let now=0;now<8*cycle;now+=1000){const action=idle.update({petId:id,kind:'creature',workActivities:true},now);if(now%cycle===Idle.quietTime)seen.push(action);}
    assert.equal(new Set(seen).size,8);assert.deepEqual(seen.filter((_,index)=>index%2===0),Personalities.get(id).activityOrder);assert.deepEqual(seen.filter((_,index)=>index%2===1),['reading','writing','crafting','tea']);
  }
});
