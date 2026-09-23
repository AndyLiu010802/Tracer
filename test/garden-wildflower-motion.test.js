'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Motion=require('../skins/tracer/garden-wildflower-motion');
const Atlas=require('../skins/tracer/garden-wildflower-atlas');
const Animation=require('../skins/tracer/garden-plant-animation');
const {inspect}=require('../dev/inspect-garden-atlas.cjs');

test('drawn wildflower clips apply only to mature rare companions, including shiny companions',()=>{
  for(const shiny of [false,true])assert.equal(Motion.supports({kind:'wildflower',stage:4,rare:true,shiny}),true);
  for(const stage of [0,1,2,3,5,-1,NaN,undefined])assert.equal(Motion.supports({kind:'wildflower',stage,rare:true}),false);
  for(const kind of ['apple','sunflower','lavender','peach','cherry','unknown'])assert.equal(Motion.supports({kind,stage:4,rare:true}),false);
  for(const rare of [false,undefined,1,'true'])assert.equal(Motion.supports({kind:'wildflower',stage:4,rare}),false);
  assert.equal(Motion.supports(),false);
});

test('idle has a quiet hold between brief visible blinks, and rest keeps the closed-eye drawing',()=>{
  const neutral=Motion.sample('idle',0),closed=Motion.sample('rest',0),total=Motion.duration('idle');
  assert.equal(neutral.clip,'idle');assert.equal(neutral.frame,0);
  assert.equal(closed.clip,'idle');assert.notEqual(closed.frame,neutral.frame);
  for(const at of [100,500,1000,1800,2000])assert.deepEqual(Motion.sample('idle',at),neutral,'idle should not twitch continuously');
  let closedTime=0,openTime=0;const frames=new Set();
  for(let at=0;at<total;at+=10){const pose=Motion.sample('idle',at);frames.add(pose.frame);if(pose.frame===closed.frame)closedTime+=10;if(pose.frame===neutral.frame)openTime+=10;}
  assert.ok(frames.size>=8,'the blink includes transitional drawings');
  assert.ok(closedTime>0&&closedTime<300,'closed eyes are a brief blink');
  assert.ok(openTime>closedTime*8,'the companion spends most of its time looking awake');
  assert.deepEqual(Motion.sample('idle',total),neutral);
  assert.deepEqual(Motion.sample('rest',total*3),closed);
});

test('greeting and celebration settle into the shared neutral drawing without looping at their boundary',()=>{
  const neutral=Motion.sample('idle',0);
  for(const action of ['greet','celebrate']){
    const duration=Motion.duration(action),seen=new Set();assert.ok(duration>1000&&duration<5000);
    assert.deepEqual(Motion.sample(action,0),neutral);
    for(let at=0;at<duration;at+=17)seen.add(Motion.sample(action,at).clip);
    assert.ok(seen.has(action),'the middle of the clip uses its own drawings');
    for(const at of [duration-1,duration,duration+500,duration*4,Number.MAX_VALUE])assert.deepEqual(Motion.sample(action,at),neutral,'a late renderer must not restart the action');
    assert.deepEqual(Motion.sample(action,duration/2,true),neutral,'reduced motion uses a neutral drawing');
  }
});

test('all elapsed-time inputs keep the fallback character on its fixed ground',()=>{
  let lowest=0;const actions=['idle','greet','celebrate','focus','rest','unknown','toString'];
  for(const action of actions){
    const values=[-1000,0,NaN,Infinity,-Infinity,Number.MAX_VALUE,...Array.from({length:501},(_,i)=>i*13)];
    for(const at of values){
      const pose=Motion.sample(action,at);
      assert.ok(['idle','greet','celebrate'].includes(pose.clip));
      assert.ok(Number.isInteger(pose.frame)&&pose.frame>=0&&pose.frame<16);
      assert.ok(Number.isFinite(pose.y)&&pose.y>=-7&&pose.y<=0);
      assert.ok(Number.isFinite(pose.shadow)&&pose.shadow>=.8&&pose.shadow<=1);
      if(action==='celebrate')lowest=Math.min(lowest,pose.y);else assert.equal(pose.y,0);
    }
  }
  assert.equal(lowest,0,'celebration must not move the whole character');
  for(const action of ['unknown','toString',undefined,null])assert.equal(Motion.duration(action),Motion.duration('idle'),'unknown action names use a safe idle duration');
});

test('all six animation atlases contain real transparent PNG art with usable independent frame crops',()=>{
  const hashes=new Set();let count=0;
  for(const variant of ['normal','shiny'])for(const action of ['idle','greet','celebrate']){
    const data=Atlas[variant][action],file=path.join(__dirname,'../skins/tracer/garden-art',`wildflower-${variant}-${action}-v1.png`),bytes=fs.readFileSync(file);
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));count++;
    const actual=inspect(file,{columns:4,rows:4});
    assert.equal(actual.width,data.width);assert.equal(actual.height,data.height);
    assert.ok(actual.clearRatio>.1&&actual.clearRatio<.85,'transparent padding and a visible character must both exist');
    assert.ok(actual.maxAlpha>=240,'the drawing must not be almost transparent');
    assert.ok(Math.abs(actual.clearRatio-data.clearRatio)<.01,'alpha metadata must describe the shipped file');
    assert.equal(data.cells.length,16);assert.ok(Number.isFinite(data.scale)&&data.scale>0&&data.scale<1);
    data.cells.forEach((cell,i)=>{
      const left=Math.floor(i%4*data.width/4),right=Math.floor((i%4+1)*data.width/4),top=Math.floor(Math.floor(i/4)*data.height/4),bottom=Math.floor((Math.floor(i/4)+1)*data.height/4);
      assert.ok(Object.values(cell).every(Number.isFinite));
      assert.ok(cell.x>=left&&cell.y>=top&&cell.x+cell.w<=right&&cell.y+cell.h<=bottom,'a crop cannot show a neighboring pose');
      assert.ok(cell.w>0&&cell.h>0&&cell.rootX>=cell.x&&cell.rootX<=cell.x+cell.w&&cell.rootY>=cell.y&&cell.rootY<=cell.y+cell.h,'the foot anchor stays in its drawing');
      const content=actual.cells[i];
      assert.ok(content.w>(right-left)*.3&&content.h>(bottom-top)*.4,'every cell must contain a visible character');
      // A small trim can remove a neighboring pose's edge leakage. It must not
      // crop away a substantial part of this cell or point at the wrong frame.
      const retainedWidth=Math.max(0,Math.min(cell.x+cell.w,content.x+content.w)-Math.max(cell.x,content.x));
      const retainedHeight=Math.max(0,Math.min(cell.y+cell.h,content.y+content.h)-Math.max(cell.y,content.y));
      assert.ok(retainedWidth*retainedHeight/(content.w*content.h)>.94,'the crop must retain the visible pose');
    });
  }
  assert.equal(count,6);assert.equal(hashes.size,6,'variants and actions must not accidentally reuse an identical sheet');
});

// An explicit clock and minimal DOM exercise the real shared player without
// browser timing, user data, paid generation or screenshot-dependent assertions.
function browser(){
  const listeners=new Map(),motionListeners=new Set(),raf=new Map(),observers=[],images=[];let next=0,now=0;
  const media={matches:false,addEventListener(_event,fn){motionListeners.add(fn);},removeEventListener(_event,fn){motionListeners.delete(fn);}};
  class Element{
    constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes={};this.dataset={};this.style={};}
    setAttribute(name,value){this.attributes[name]=String(value);}
    getAttribute(name){return this.attributes[name]??null;}
    removeAttribute(name){delete this.attributes[name];}
    appendChild(child){this.children.push(child);return child;}
    replaceChildren(...children){this.children=children;}
    querySelectorAll(){return [];}
  }
  const doc={hidden:false,createElement(tag){return new Element(tag,doc);},createElementNS(_ns,tag){return new Element(tag,doc);},
    addEventListener(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},
    removeEventListener(event,fn){listeners.get(event)?.delete(fn);}};
  class Image{
    set src(url){const match=/wildflower-(normal|shiny)-(idle|greet|celebrate)-v1\.png$/.exec(url);assert.ok(match);const data=Atlas[match[1]][match[2]];this.naturalWidth=data.width;this.naturalHeight=data.height;images.push(url);queueMicrotask(()=>this.onload?.());}
  }
  class IntersectionObserver{
    constructor(callback){this.callback=callback;this.elements=new Set();observers.push(this);}
    observe(element){this.elements.add(element);}
    unobserve(element){this.elements.delete(element);}
    disconnect(){this.elements.clear();}
  }
  doc.defaultView={Image,IntersectionObserver,matchMedia:()=>media,requestAnimationFrame(fn){raf.set(++next,fn);return next;},cancelAnimationFrame(id){raf.delete(id);}};
  return {doc,raf,images,motionListeners,observers,
    listeners:()=>[...listeners.values()].reduce((sum,set)=>sum+set.size,0),
    async ready(){await new Promise(resolve=>setImmediate(resolve));},
    advance(milliseconds){const end=now+milliseconds;while(now<end){now=Math.min(end,now+20);for(const [id,fn]of [...raf]){raf.delete(id);fn(now);}}},
    reduced(value){media.matches=value;for(const fn of motionListeners)fn();},
    hidden(value){doc.hidden=value;for(const fn of listeners.get('visibilitychange')||[])fn();},
    visible(element,value){for(const observer of observers)if(observer.elements.has(element))observer.callback([{target:element,isIntersecting:value}]);}
  };
}
// Exercise the shipped legacy fallback explicitly; the generic sixteen-action
// player has its own tests and uses new atlases as generation finishes.
const options=env=>({document:env.doc,kind:'wildflower',stage:4,rare:true,atlas:{version:1,frames:16,kinds:{}}});

test('the real player finishes a greeting once and keeps the whole celebration in place',async()=>{
  for(const shiny of [false,true]){
    const env=browser(),player=Animation.create({...options(env),shiny});await env.ready();
    try{
      assert.equal(player.element.dataset.motion,'ready');assert.equal(player.element.dataset.frames,'16');
      let done=0;assert.equal(player.play('greet',()=>done++),true);assert.equal(player.play('greet',()=>done++),false,'repeated input cannot restart the same clip');
      env.advance(Motion.duration('greet')+100);assert.equal(player.element.dataset.action,'idle');assert.equal(done,1);
      env.advance(Motion.duration('greet')+100);assert.equal(done,1);
      assert.equal(player.play('celebrate'),true);let lowest=0;
      for(let at=0;at<Motion.duration('celebrate')+100;at+=20){
        env.advance(20);const svg=player.element.children[0],body=svg.children[1],crop=body.children[0],cell=Atlas[shiny?'shiny':'normal'][player.element.dataset.motionClip].cells[Number(player.element.dataset.frame)];
        const scale=Number(crop.getAttribute('height'))/cell.h;
        assert.ok(Math.abs(Number(crop.getAttribute('x'))+(cell.rootX-cell.x)*scale-80)<1e-6);
        assert.ok(Math.abs(Number(crop.getAttribute('y'))+(cell.rootY-cell.y)*scale-151)<1e-6,'changing drawings cannot move the ground anchor');
        const match=/^translate\(0 (-?[\d.e+]+)\)$/.exec(body.getAttribute('transform'));assert.ok(match);
        const y=Number(match[1]);assert.ok(Number.isFinite(y)&&y>=-7&&y<=0);lowest=Math.min(lowest,y);
      }
      assert.equal(lowest,0);assert.equal(player.element.dataset.action,'idle');
    }finally{player.destroy();}
  }
});

for(const boundary of ['focus','rest','reduced motion','hidden document','offscreen'])test(`interrupting a one-shot for ${boundary} cancels it without a late callback or replay`,async()=>{
  const env=browser(),player=Animation.create(options(env));await env.ready();let finished=0;
  try{
    assert.equal(player.play('celebrate',()=>finished++),true);env.advance(350);assert.equal(player.element.dataset.action,'celebrate');
    if(boundary==='focus'||boundary==='rest')player.setAction(boundary);
    else if(boundary==='reduced motion')env.reduced(true);
    else if(boundary==='hidden document')env.hidden(true);
    else env.visible(player.element,false);
    assert.equal(player.element.dataset.action,['focus','rest'].includes(boundary)?boundary:'idle');
    assert.equal(player.play('greet'),false,'restricted states reject new interactions');
    if(!['focus','rest'].includes(boundary))assert.equal(env.raf.size,0);
    if(boundary==='focus'||boundary==='rest')player.setAction('idle');
    else if(boundary==='reduced motion')env.reduced(false);
    else if(boundary==='hidden document')env.hidden(false);
    else env.visible(player.element,true);
    env.advance(Motion.duration('celebrate')+200);
    assert.equal(player.element.dataset.action,'idle');assert.equal(finished,0);
    assert.equal(player.play('greet',()=>finished++),true,'a fresh explicit interaction remains available');
    env.advance(Motion.duration('greet')+100);assert.equal(finished,1);
  }finally{player.destroy();}
});

test('players share one scheduler and destroying the last player releases listeners and pending work',async()=>{
  const env=browser(),first=Animation.create(options(env)),second=Animation.create({...options(env),shiny:true});await env.ready();let finished=0;
  first.play('greet',()=>finished++);second.play('celebrate',()=>finished++);
  assert.equal(env.raf.size,1);assert.equal(env.listeners(),1);assert.equal(env.motionListeners.size,1);
  first.destroy();assert.equal(env.raf.size,1);assert.equal(env.listeners(),1);
  second.destroy();second.destroy();assert.equal(env.raf.size,0);assert.equal(env.listeners(),0);assert.equal(env.motionListeners.size,0);
  assert.ok(env.observers.every(observer=>observer.elements.size===0));
  env.advance(10000);assert.equal(finished,0);assert.equal(second.play('greet'),false);
  const staticPlayer=Animation.create({...options(env),animated:false});assert.equal(staticPlayer.element.dataset.playback,'static');assert.equal(env.raf.size,0);assert.equal(env.listeners(),0);staticPlayer.destroy();
});

test('late atlas loads cannot revive a player destroyed while its artwork was loading',async()=>{
  const env=browser(),player=Animation.create(options(env));assert.equal(player.element.dataset.motion,'loading');
  player.destroy();await env.ready();
  assert.equal(player.element.dataset.playback,'destroyed');assert.notEqual(player.element.dataset.motion,'ready');
  assert.equal(env.raf.size,0);assert.equal(env.listeners(),0);assert.equal(env.motionListeners.size,0);assert.equal(player.play('greet'),false);
});
