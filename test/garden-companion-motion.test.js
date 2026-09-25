'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib'),crypto=require('node:crypto');
const Motion=require('../skins/tracer/garden-companion-motion'),Animation=require('../skins/tracer/garden-plant-animation'),Preview=require('../skins/tracer/garden-companion-preview');
const Atlas=require('../skins/tracer/garden-companion-atlas'),Builder=require('../dev/build-garden-companion-atlas.cjs');
function fixtureAtlas(){
  const kinds={};for(const kind of Builder.KINDS){kinds[kind]={};for(const variant of ['normal','shiny']){kinds[kind][variant]={};for(const action of Motion.actions)kinds[kind][variant][action]={src:`/garden-art/${kind}-${variant}-${action}-test.png`,width:1025,height:1027,scale:.5,frames:16,cells:Array.from({length:16},(_,i)=>{const x=Math.floor(i%4*1025/4),y=Math.floor(Math.floor(i/4)*1027/4)-(action==='hop'&&i===7?16:0);return{x:x+40,y:y+24,w:170,h:220,rootX:x+128,rootY:y+248};})};}}
  return{version:1,frames:16,kinds};
}
function browser(atlas=fixtureAtlas(),autoLoad=true){
  const listeners=new Map(),motionListeners=new Set(),raf=new Map(),observers=[],images=[],pending=[];let next=0,now=0;
  const sheets=new Map(Object.values(atlas.kinds).flatMap(v=>Object.values(v)).flatMap(v=>Object.values(v)).flatMap(s=>s.pages||[s]).map(s=>[s.src,s]));
  const media={matches:false,addEventListener(_event,fn){motionListeners.add(fn);},removeEventListener(_event,fn){motionListeners.delete(fn);}};
  class Element{
    constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes={};this.dataset={};this.style={};this.events=new Map();this.value='';this.textContent='';}
    setAttribute(name,value){this.attributes[name]=String(value);}getAttribute(name){return this.attributes[name]??null;}removeAttribute(name){delete this.attributes[name];}
    appendChild(child){this.children.push(child);child.parentNode=this;return child;}replaceChildren(...children){this.children=children;children.forEach(child=>child.parentNode=this);}querySelectorAll(){return [];}
    addEventListener(name,fn){this.events.set(name,fn);}removeEventListener(name,fn){if(this.events.get(name)===fn)this.events.delete(name);}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);}
    click(){this.events.get('click')?.({stopPropagation(){}});}
  }
  const doc={hidden:false,createElement(tag){return new Element(tag,doc);},createElementNS(_ns,tag){return new Element(tag,doc);},addEventListener(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},removeEventListener(event,fn){listeners.get(event)?.delete(fn);}};
  class Image{set src(url){const data=sheets.get(url);assert.ok(data,'only inspected atlas sources can load');this.naturalWidth=data.width;this.naturalHeight=data.height;images.push(url);const load=()=>this.onload?.();pending.push({image:this,url,load});if(autoLoad)queueMicrotask(load);}}
  class IntersectionObserver{constructor(callback){this.callback=callback;this.elements=new Set();observers.push(this);}observe(element){this.elements.add(element);}unobserve(element){this.elements.delete(element);}disconnect(){this.elements.clear();}}
  doc.defaultView={Image,IntersectionObserver,matchMedia:()=>media,requestAnimationFrame(fn){raf.set(++next,fn);return next;},cancelAnimationFrame(id){raf.delete(id);}};
  return{doc,atlas,raf,images,pending,motionListeners,observers,listeners:()=>[...listeners.values()].reduce((sum,set)=>sum+set.size,0),async ready(){await new Promise(resolve=>setImmediate(resolve));},
    advance(milliseconds){const end=now+milliseconds;while(now<end){now=Math.min(end,now+10);for(const[id,fn]of [...raf]){raf.delete(id);fn(now);}}},
    reduced(value){media.matches=value;for(const fn of motionListeners)fn();},hidden(value){doc.hidden=value;for(const fn of listeners.get('visibilitychange')||[])fn();},visible(element,value){for(const observer of observers)if(observer.elements.has(element))observer.callback([{target:element,isIntersecting:value}]);}};
}
const options=(env,kind='wildflower',shiny=false)=>({document:env.doc,kind,stage:4,rare:true,shiny,atlas:env.atlas});
const cropOf=element=>element.children[0].children[1].children[0];

test('six normal and shiny companions draw all sixteen independent source cells for every action',async()=>{
  assert.deepEqual(Motion.actions,Builder.ACTIONS);assert.equal(Motion.actions.length,18);
  const env=browser();
  for(const kind of Builder.KINDS)for(const shiny of [false,true]){
    const element=env.doc.createElement('span'),layer=Motion.create(element,options(env,kind,shiny));await env.ready();
    assert.deepEqual(layer.available(),Motion.actions);
    for(const action of Motion.actions){
      layer.render(action,0);await env.ready();let at=0;const seen=new Set();
      for(let frame=0;frame<32;frame++){
        layer.render(action,at+1,false,null,false);const crop=cropOf(element);seen.add(crop.getAttribute('viewBox'));
        assert.equal(element.dataset.motionClip,action);assert.equal(element.dataset.frame,String(frame));assert.equal(element.dataset.sourceFrames,'16');
        assert.match(crop.children[0].getAttribute('href'),new RegExp(`${kind}-${shiny?'shiny':'normal'}-${action}-test.png$`));
        assert.equal(element.children[0].children[1].getAttribute('transform'),'translate(0 0)','drawing changes cannot be replaced by a whole-image transform');at+=Motion.timings[action][frame];
      }
      assert.equal(seen.size,16);assert.equal(Motion.sample(action,Motion.duration(action)+100,false,false).frame,31,'a one-shot clamps to its final drawing');
      assert.equal(Motion.sample(action,Motion.duration(action),false,true).frame,action==='rest'?24:0);
    }
    layer.destroy();
  }
});

test('rest holds a settled pose and preserves a complete explicit one-shot',async()=>{
  const total=Motion.duration('rest'),step=total/32;
  assert.deepEqual(Motion.sample('rest',0,true),{clip:'rest',frame:24,frames:32});
  assert.deepEqual(Motion.sample('rest',total*3,true),{clip:'rest',frame:24,frames:32});
  for(let frame=0;frame<32;frame++)assert.equal(Motion.sample('rest',frame*step+1,false,false).frame,frame);
  for(let frame=0;frame<32;frame++)assert.equal(Motion.sample('rest',total+frame*step+1).frame,24);
  assert.equal(Motion.sample('rest',total*4,false,false).frame,31,'one-shot never loops back into sleep');
  const env=browser(),player=Animation.create(options(env));await env.ready();player.setAction('rest');await env.ready();
  env.advance(total+step);assert.ok(Number(player.element.dataset.frame)>=8);
  env.reduced(true);assert.equal(player.element.dataset.motionClip,'rest');assert.equal(player.element.dataset.frame,'24');assert.equal(env.raf.size,0);
  env.reduced(false);env.advance(total*2);assert.ok(Number(player.element.dataset.frame)>=8,'resuming reduced motion cannot replay the introduction');
  player.setAction('idle');let finished=0;assert.equal(player.preview('rest',()=>finished++),true);await env.ready();
  const seen=new Set();for(let i=0;i<total+30;i+=10){if(player.element.dataset.motionClip==='rest')seen.add(player.element.dataset.frame);env.advance(10);}
  assert.equal(seen.size,32);assert.equal(finished,1);assert.equal(player.element.dataset.action,'idle');player.destroy();
});

test('in-place actions compensate for displaced drawings and keep the same ground position',async()=>{
  const env=browser(),element=env.doc.createElement('span'),layer=Motion.create(element,options(env));layer.render('hop',0);await env.ready();
  layer.render('hop',0);const grounded=Number(cropOf(element).getAttribute('y'));
  layer.render('hop',Motion.duration('hop')*7/16+1);const raised=Number(cropOf(element).getAttribute('y'));
  assert.equal(grounded,raised);assert.equal(cropOf(element).getAttribute('height'),'110');layer.destroy();
});

test('lazy loading shares idle and requested clips, and skips absent actions honestly',async()=>{
  const atlas=fixtureAtlas();delete atlas.kinds.wildflower.normal.water;const env=browser(atlas),a=Animation.create(options(env)),b=Animation.create(options(env));await env.ready();
  assert.equal(env.images.length,1,'two players share the idle PNG');assert.equal(env.raf.size,1);
  assert.equal(a.preview('water'),false);assert.equal(a.availableActions().includes('water'),false);a.setAction('water');assert.equal(a.element.dataset.motion,'fallback');assert.equal(a.element.dataset.motionClip,'idle');assert.equal(env.images.length,1);
  a.setAction('idle');assert.equal(a.preview('greet'),true);assert.equal(b.preview('greet'),true);await env.ready();assert.equal(env.images.length,2);
  a.destroy();b.destroy();assert.equal(env.raf.size,0);assert.equal(env.listeners(),0);assert.equal(env.motionListeners.size,0);
});

test('switching actions keeps one character scale instead of refitting each prop or pose',async()=>{
  const atlas=fixtureAtlas();atlas.kinds.wildflower.normal.water.scale=.9;
  const env=browser(atlas),element=env.doc.createElement('span'),layer=Motion.create(element,options(env));await env.ready();
  layer.render('idle',0);const height=cropOf(element).getAttribute('height');
  layer.render('water',0);await env.ready();layer.render('water',0);
  assert.equal(cropOf(element).getAttribute('height'),height);layer.destroy();
});

test('smaller native action drawings keep the same apparent body size through idle, play and idle',async()=>{
  const atlas=fixtureAtlas(),sheets=atlas.kinds.wildflower.normal;
  for(const sheet of Object.values(sheets))sheet.bodySize=100;
  const play=sheets.play;play.bodySize=75;
  play.cells=play.cells.map(cell=>({...cell,w:cell.w*.75,h:cell.h*.75,x:cell.rootX+(cell.x-cell.rootX)*.75,y:cell.rootY+(cell.y-cell.rootY)*.75}));
  const env=browser(atlas),element=env.doc.createElement('span'),layer=Motion.create(element,options(env));await env.ready();
  layer.render('idle');const first={...cropOf(element).attributes};
  layer.render('play');await env.ready();layer.render('play');
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(Number(cropOf(element).getAttribute(key))-Number(first[key]))<1e-6,key);
  layer.render('idle');assert.deepEqual(cropOf(element).attributes,first);layer.destroy();
});

test('both original pages load before playback and all 32 source drawings play in order',async()=>{
  const atlas=fixtureAtlas(),sheets=atlas.kinds.wildflower.normal,first=sheets.play;
  const second={...first,src:'/garden-art/play-page-2.png',width:2050,height:2054,cells:first.cells.map(c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,v*2])))};
  for(const sheet of Object.values(sheets))sheet.bodySize=100;second.bodySize=200;
  sheets.play={...first,frames:32,pages:[first,second],cells:[...first.cells.map(c=>({...c,page:0})),...second.cells.map(c=>({...c,page:1}))]};
  const env=browser(atlas,false),element=env.doc.createElement('span'),layer=Motion.create(element,options(env));env.pending[0].load();await env.ready();
  layer.render('play');env.pending.find(p=>p.url===first.src).load();await env.ready();
  assert.equal(layer.waiting('play'),true);layer.render('play');assert.equal(element.dataset.motionClip,'idle');
  env.pending.find(p=>p.url===second.src).load();await env.ready();assert.equal(layer.waiting('play'),false);
  let at=0;const seen=new Set();for(let i=0;i<32;i++){
    layer.render('play',at+1,false,null,false);const crop=cropOf(element),src=crop.children[0].getAttribute('href');
    assert.equal(src,i<16?first.src:second.src);assert.equal(element.dataset.sourceFrames,'32');
    assert.equal(crop.getAttribute('height'),'110');seen.add(src+crop.getAttribute('viewBox'));at+=Motion.timings.play[i];
  }
  assert.equal(seen.size,32);layer.destroy();
});

test('slow PNG loading does not consume or skip a one-shot; completion fires once',async()=>{
  const env=browser(fixtureAtlas(),false),player=Animation.create(options(env));env.pending[0].load();await env.ready();let finished=0;
  assert.equal(player.preview('thanks',()=>finished++),true);env.advance(20000);assert.equal(finished,0);assert.equal(player.element.dataset.action,'thanks');assert.equal(player.element.dataset.motion,'fallback');
  env.pending.find(p=>p.url.includes('-thanks-')).load();await env.ready();assert.equal(player.element.dataset.frame,'0');
  const seen=new Set();for(let i=0;i<Motion.duration('thanks')+30;i+=10){if(player.element.dataset.motionClip==='thanks')seen.add(player.element.dataset.frame);env.advance(10);}
  assert.equal(seen.size,32);assert.equal(finished,1);assert.equal(player.element.dataset.action,'idle');env.advance(10000);assert.equal(finished,1);player.destroy();
});

test('failed or wrong-sized PNGs keep a safe fallback and explicit retry can recover',async()=>{
  const env=browser(fixtureAtlas(),false),player=Animation.create(options(env));env.pending[0].load();await env.ready();
  player.preview('shy');const first=env.pending.at(-1);first.image.naturalWidth=2048;first.load();await env.ready();assert.equal(player.element.dataset.motion,'fallback');assert.equal(player.element.dataset.motionClip,'idle');
  env.advance(4000);const before=env.images.length;player.preview('shy');assert.equal(env.images.length,before+1);env.pending.at(-1).load();await env.ready();assert.equal(player.element.dataset.motionClip,'shy');player.destroy();
});

for(const boundary of ['focus','rest','reduced','hidden','offscreen','destroy'])test(`${boundary} cancels preview and late image loads cannot replay it`,async()=>{
  const env=browser(fixtureAtlas(),false),player=Animation.create(options(env));env.pending[0].load();await env.ready();let finished=0;player.preview('celebrate',()=>finished++);
  if(boundary==='focus'||boundary==='rest')player.setAction(boundary);else if(boundary==='reduced')env.reduced(true);else if(boundary==='hidden')env.hidden(true);else if(boundary==='offscreen')env.visible(player.element,false);else player.destroy();
  const previous={...player.element.dataset};env.pending.forEach(p=>p.load());await env.ready();env.advance(10000);assert.equal(finished,0);if(boundary==='destroy')assert.deepEqual(player.element.dataset,previous,'destroyed DOM must stay untouched');else assert.notEqual(player.element.dataset.action,'celebrate');
  if(!['focus','rest'].includes(boundary))assert.equal(env.raf.size,0);if(boundary==='destroy')assert.equal(player.element.dataset.playback,'destroyed');player.destroy();assert.equal(env.raf.size,0);assert.equal(env.listeners(),0);
});

test('compact preview exposes distinct garden activities, disables missing clips and never dispatches rewards',()=>{
  const env=browser(),host=env.doc.createElement('div');let before=0,done,played=[],destroyed=false;
  const player={availableActions:()=>['idle','hop'],preview(action,callback){played.push(action);done=callback;return true;}},view=Preview.create(host,{beforePlay:()=>before++});
  view.update({player,pet:{id:'garden_apple_shiny'},language:'zh'});const details=view.element,controls=details.children[1],select=controls.children[0].children[0],button=controls.children[1],status=details.children[2];
  assert.equal(details.hidden,false);assert.equal(select.children.length,18);assert.equal(select.children.filter(c=>!c.disabled).length,2);select.value='hop';button.click();assert.deepEqual(played,['hop']);assert.equal(before,1);assert.match(status.textContent,/正在预览/);done();assert.match(status.textContent,/结束/);
  view.update({player,pet:{id:'garden_apple_shiny'},language:'zh',blocked:true});button.click();assert.equal(played.length,1);assert.equal(button.disabled,true);
  const builtin={availableActions:()=>require('../skins/tracer/pet-builtin-animation').actions,preview:player.preview};
  view.update({player:builtin,pet:{id:'luna'},language:'zh'});assert.equal(details.hidden,false);assert.equal(select.children.length,16);select.value='fishing';button.click();assert.equal(played.at(-1),'fishing');assert.match(status.textContent,/钓鱼/);
  view.update({player:{},pet:{id:'luna'},language:'zh'});assert.equal(details.hidden,true,'the original fallback rig has no source-sheet preview');
  view.update({player:builtin,pet:{id:'custom_example',custom:true},language:'zh'});assert.equal(details.hidden,true,'custom packs retain their existing editor');
  view.destroy();destroyed=true;done();assert.equal(host.children.length,0);assert.ok(destroyed);
});

function pngFixture({width=256,height=256,identical=false,opaque=false,empty=-1,rowOffsets=[0,0,0,0],columnOffsets=[0,0,0,0]}={}){
  const scan=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const ownerColumn=columnOffsets.findIndex((offset,index)=>x>=Math.floor(index*width/4)+offset+15&&x<Math.floor(index*width/4)+offset+47),ownerRow=rowOffsets.findIndex((offset,index)=>y>=Math.floor(index*height/4)+offset+14&&y<Math.floor(index*height/4)+offset+55);
    const col=ownerColumn<0?Math.min(3,Math.floor(x*4/width)):ownerColumn,row=ownerRow<0?Math.min(3,Math.floor(y*4/height)):ownerRow,frame=row*4+col,localX=x-Math.floor(col*width/4)-columnOffsets[col],localY=y-Math.floor(row*height/4)-rowOffsets[row],at=y*(width*4+1)+1+x*4;
    const visible=frame!==empty&&localX>=15&&localX<47&&localY>=14&&localY<55;scan[at]=identical?120:40+frame*11;scan[at+1]=180;scan[at+2]=90;scan[at+3]=opaque||visible?255:0;
  }
  function chunk(type,data){const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4);data.copy(out,8);let crc=0xffffffff;for(const byte of out.subarray(4,8+data.length)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}out.writeUInt32BE((crc^0xffffffff)>>>0,data.length+8);return out;}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
test('manifest builder uses real odd dimensions, one baseline, distinct frames, and never changes PNG pixels',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-companion-atlas-'));
  try{
    const file=path.join(dir,'apple-normal-hop-v2.png'),bytes=pngFixture({width:1025,height:1027});fs.writeFileSync(file,bytes);
    const result=Builder.build({directory:dir,output:null}),sheet=result.manifest.kinds.apple.normal.hop;assert.equal(result.count,1);assert.equal(result.expected,Builder.KINDS.length*2*Builder.ACTIONS.length);assert.equal(result.missing.length,result.expected-1);assert.deepEqual(result.rejected,[]);assert.equal(sheet.width,1025);assert.equal(sheet.height,1027);assert.equal(new Set(sheet.frameHashes).size,16);
    assert.equal(new Set(sheet.cells.map((c,i)=>c.rootY-Math.floor(Math.floor(i/4)*sheet.height/4))).size,1);assert.deepEqual(fs.readFileSync(file),bytes);
    for(const [name,options,message]of [['opaque',{opaque:true},'missing-transparent'],['repeated',{identical:true},'repeated-frame'],['empty',{empty:7},'empty-frame-7']]){const target=path.join(dir,name+'.png');fs.writeFileSync(target,pngFixture(options));assert.throws(()=>Builder.inspectSheet(target),new RegExp(message));}
  }finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});

test('measured frame gutters preserve crossing toes without rewriting pixels or moving the shared ground',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-companion-gutters-'));
  try{
    const file=path.join(dir,'shifted.png'),bytes=pngFixture({rowOffsets:[12,9,5,0],columnOffsets:[23,19,15,0]});fs.writeFileSync(file,bytes);
    const result=Builder.inspectSheet(file);assert.deepEqual(result.grid,{x:[0,71,131,192,256],y:[0,68,129,192,256]});
    for(let index=0;index<16;index++)assert.deepEqual({rootX:result.cells[index].rootX,rootY:result.cells[index].rootY},Builder.bodyAnchor(Builder.decode(bytes),result.grid.x[index%4],result.grid.y[Math.floor(index/4)],result.grid.x[index%4+1],result.grid.y[Math.floor(index/4)+1]));
    assert.equal(result.cells[0].y+result.cells[0].h,68,'the first root foot remains inside its complete crop');
    assert.equal(new Set(result.frameHashes).size,16);assert.deepEqual(fs.readFileSync(file),bytes);
    const decoded=Builder.decode(bytes);decoded.data[(10*decoded.width)*4+3]=255;assert.throws(()=>Builder.frameGrid(decoded),/outer-edge-clipping/);
    const blocked=Builder.decode(bytes);for(let y=48;y<82;y++)for(let x=10;x<246;x++)blocked.data[(y*blocked.width+x)*4+3]=255;
    assert.throws(()=>Builder.frameGrid(blocked),/missing-frame-gutter/,'a missing common gutter cannot be guessed through artwork');
  }finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});

test('rest and moving actions both keep their character feet fixed despite shifted source cells',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-companion-ground-'));
  try{
    const bytes=pngFixture({rowOffsets:[5,0,-4,-8]}),rest=path.join(dir,'apple-normal-rest-v2.png'),hop=path.join(dir,'apple-normal-hop-v2.png');
    fs.writeFileSync(rest,bytes);fs.writeFileSync(hop,bytes);const seated=Builder.inspectSheet(rest),jumping=Builder.inspectSheet(hop);
    assert.equal(seated.scale,jumping.scale,'changing an anchor must not resize a sleeping character');
    for(let index=0;index<16;index++){
      const row=Math.floor(index/4),sourceFoot=row*64+[5,0,-4,-8][row]+55;
      assert.equal(151+(sourceFoot-seated.cells[index].rootY)*seated.scale,151,'every seated frame meets the same ground');
      assert.equal(seated.cells[index].rootX,jumping.cells[index].rootX);
    }
    assert.deepEqual(jumping.cells,seated.cells,'all actions use the same grounded character anchors');
    assert.deepEqual(fs.readFileSync(rest),bytes);
  }finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});

test('a taller standing introduction uses actual row gutters without clipping sleeping frames',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-companion-tall-row-'));
  try{
    const file=path.join(dir,'volt_berry-normal-rest-v2.png'),bytes=pngFixture({rowOffsets:[20,14,6,0]});fs.writeFileSync(file,bytes);
    const sheet=Builder.inspectSheet(file);assert.deepEqual(sheet.grid.y,[0,76,134,192,256]);
    assert.equal(sheet.frameHashes.length,16);assert.equal(new Set(sheet.frameHashes).size,16);
    for(let frame=0;frame<16;frame++)assert.equal(sheet.cells[frame].rootY,Math.floor(frame/4)*64+[20,14,6,0][Math.floor(frame/4)]+55);
    assert.deepEqual(fs.readFileSync(file),bytes);
  }finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});

test('every production manifest entry describes real pages with unique original drawings',()=>{
  let count=0;for(const [kind,variants]of Object.entries(Atlas.kinds))for(const [variant,actions]of Object.entries(variants))for(const [action,sheet]of Object.entries(actions)){
    assert.ok(Builder.KINDS.includes(kind)&&['normal','shiny'].includes(variant)&&Motion.actions.includes(action));
    const pages=sheet.pages||[sheet],files=pages.map(page=>path.join(__dirname,'../skins/tracer',page.src.slice(1)));
    const actual=sheet.pages?Builder.inspectPages(files,pages.map(page=>page.src)):Builder.inspectSheet(files[0]);
    assert.equal(sheet.sha256,actual.sha256);assert.deepEqual(sheet.cells,actual.cells);assert.equal(sheet.width,actual.width);assert.equal(sheet.height,actual.height);assert.equal(new Set(sheet.frameHashes).size,sheet.frames);count++;
  }
  assert.ok(count>=6&&count<=Builder.KINDS.length*2*Builder.ACTIONS.length,'only completed, inspected files belong in the manifest');
});

test('body size measurement ignores an attached narrow handle and a small solid prop',()=>{
  const decoded={width:256,height:256,data:Buffer.alloc(256*256*4)};
  const rect=(x0,y0,x1,y1)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)decoded.data[(y*256+x)*4+3]=255;};
  rect(40,30,120,130);const before=Builder.bodyAnchor(decoded,0,0,256,256,true).bodySize;
  rect(119,90,175,96);rect(174,65,220,120);
  assert.equal(Builder.bodyAnchor(decoded,0,0,256,256,true).bodySize,before,'grasping a prop must not shrink the character');
});

test('a second page cannot pass as 32 originals by copying the first page',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-original-pages-'));
  try{
    const first=path.join(dir,'p1.png'),second=path.join(dir,'p2.png');fs.writeFileSync(first,pngFixture());fs.writeFileSync(second,pngFixture());
    assert.throws(()=>Builder.inspectPages([first,second],['/p1.png','/p2.png']),/repeated-frame-drawings-across-pages/);
    assert.throws(()=>Builder.inspectPages([first,path.join(dir,'missing.png')],['/p1.png','/missing.png']),/incomplete-original-pages/);
  }finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});

test('botanical face calibration ignores changing leaves and an attached colored toy',()=>{
  const decoded={width:256,height:256,data:Buffer.alloc(256*256*4)};
  const rect=(x0,y0,x1,y1,color)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)decoded.data.set([...color,255],(y*256+x)*4);};
  rect(40,20,180,180,[70,130,65]);rect(80,55,140,100,[245,220,175]);
  const before=Builder.botanicalFaceSize(decoded,0,0,256,256);assert.equal(before,60);
  rect(10,10,75,220,[90,155,80]);rect(150,100,245,180,[175,105,50]);
  assert.equal(Builder.botanicalFaceSize(decoded,0,0,256,256),before);
});

test('stable facial proportions take precedence over a denser flower silhouette',async()=>{
  const atlas=fixtureAtlas(),sheets=atlas.kinds.wildflower.normal;
  for(const sheet of Object.values(sheets)){sheet.identitySize=80;sheet.bodySize=100;}
  sheets.play.bodySize=140;const env=browser(atlas),element=env.doc.createElement('span'),layer=Motion.create(element,options(env));await env.ready();
  layer.render('idle');const before={...cropOf(element).attributes};
  layer.render('play');await env.ready();layer.render('play');
  for(const key of ['x','y','width','height'])assert.equal(cropOf(element).getAttribute(key),before[key]);layer.destroy();
});

for(const action of ['peach-shiny-walk','wildflower-shiny-thanks'])test(`${action} keeps its visible silhouette size across the page transition`,()=>{
  const pages=[1,2].map(part=>Builder.inspectSheet(path.join(__dirname,`../skins/tracer/garden-art/${action}-v3-p${part}.png`),{botanical:true}));
  const before=pages[0].cells[15],after=pages[1].cells[0];
  for(const dimension of ['w','h']){
    const ratio=(after[dimension]/pages[1].identitySize)/(before[dimension]/pages[0].identitySize);
    assert.ok(Math.abs(ratio-1)<.05,`visible ${dimension} must not jump at frame 17: ${ratio}`);
  }
});

test('cream orchid petals larger than the face cannot change its size calibration',()=>{
  const decoded={width:256,height:256,data:Buffer.alloc(256*256*4)};
  const rect=(x0,y0,x1,y1,color)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)decoded.data.set([...color,255],(y*256+x)*4);};
  rect(80,95,140,140,[245,220,175]);
  rect(89,108,97,119,[70,40,20]);rect(122,108,130,119,[70,40,20]);
  assert.equal(Builder.botanicalFaceSize(decoded,0,0,256,256),60);
  rect(35,30,195,75,[245,220,175]);
  assert.equal(Builder.botanicalFaceSize(decoded,0,0,256,256),60,'larger warm petals must not make idle smaller than play');
});
