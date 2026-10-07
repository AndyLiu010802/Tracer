'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../public/fishing-model');

// Run the production input bindings with a small DOM/event host. Rendering is
// deliberately stubbed: these tests exercise ownership and lifecycle of input.
class Target{
  constructor(){this.listeners=new Map();}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type,options={}){const event={type,target:this,currentTarget:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...options};for(const fn of [...(this.listeners.get(type)||[])])fn(event);return event;}
}
class Element extends Target{
  constructor(doc,tag='div'){super();this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.children=[];this.nodes=new Map();this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.attributes=new Map();this.captures=new Set();this.disabled=false;this.hidden=false;this.textContent='';}
  appendChild(node){node.parent=this;this.children.push(node);return node;}
  insertBefore(node){return this.appendChild(node);}
  replaceChildren(){this.children=[];}
  remove(){this.removed=true;}
  setAttribute(key,value){this.attributes.set(key,String(value));}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,this.appendChild(new Element(this.ownerDocument)));return this.nodes.get(selector);}
  contains(node){for(let current=node;current;current=current.parent)if(current===this)return true;return false;}
  closest(selector){for(let current=this;current;current=current.parent){if(selector==='dialog'&&current.tagName==='DIALOG')return current;if(selector==='#fishing-tools'&&current.id==='fishing-tools')return current;if(selector.includes('input,textarea,select')&&(['INPUT','TEXTAREA','SELECT'].includes(current.tagName)||current.attributes.has('contenteditable')&&current.attributes.get('contenteditable')!=='false'||current.attributes.get('role')==='textbox'))return current;}return null;}
  matches(selector){return selector===':modal'&&this.modal===true;}
  focus(){this.ownerDocument.activeElement=this;}
  setPointerCapture(id){this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);}
  getBoundingClientRect(){return{left:0,top:0,width:380,height:260};}
}
function fixture(kind,onAction,options={}){
  const win=new Target(),doc=new Target(),nodes=new Map(),actions=[];
  doc.defaultView=win;doc.hidden=false;doc.createElement=tag=>new Element(doc,tag);doc.body=new Element(doc,'body');doc.documentElement=new Element(doc,'html');doc.activeElement=doc.body;doc.elementFromPoint=()=>null;
  doc.dialogs=[];doc.querySelectorAll=selector=>selector==='dialog[open]'?doc.dialogs.filter(dialog=>dialog.open):[];
  doc.getElementById=id=>{if(!nodes.has(id)){const node=new Element(doc);node.id=id;nodes.set(id,node);}return nodes.get(id);};
  const art={escape:value=>String(value??''),rodMarkup:()=>'',fishMarkup:()=>'',createPond:()=>({update(){},destroy(){}})};
  const record=type=>{actions.push(type);onAction?.(type);};
  let update,game,surface,button,keydown,scope,menu; const commands=[]; let entranceReady=options.entranceReady!==false;
  if(kind==='game'){
    const context={TracerFishingArt:art,document:doc};vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/fishing-game.js'),'utf8'),context);
    const host=new Element(doc);if(options.dialog){scope=doc.body.appendChild(new Element(doc,'dialog'));scope.open=true;scope.modal=true;doc.dialogs.push(scope);scope.appendChild(host);}else doc.body.appendChild(host);
    game=context.TracerFishingGame.create(host,{onAction:record});surface=host.children[0];scope=scope||surface;button=surface.querySelector('.fishing-game-action');keydown=win;update=next=>game.update(next);
  }else{
    surface=doc.getElementById('desktop-fishing');button=doc.getElementById('fishing-rod');surface.appendChild(button);surface.appendChild(doc.getElementById('fishing-tools'));
    win.TracerFishingArt=art;win.TracerFishingMotion={create:()=>({update(){},preview(){return true;},engagePreview:()=>entranceReady,touchPreview(){},dismissPreview(){},destroy(){}})};win.FishingDesktop={onMenuAction:callback=>{menu=callback;return()=>{};},send:message=>{commands.push(message);if(['cast-start','cast-release','hook','reel-start','reel-release','cancel'].includes(message.type))record(message.type);},onSnapshot:callback=>{update=callback;return()=>{};}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/fishing-desktop.js'),'utf8'),{window:win,document:doc,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn()});keydown=win;
  }
  const set=(phase,extra={})=>update({language:'en',session:{id:'input-test',phase},...extra});set('idle');if(kind==='desktop'&&options.summoned!==false)menu({type:'summon-rod'});
  const down=(code='KeyF',options={})=>keydown.emit('keydown',{code,target:button,...options});
  const up=(code='KeyF',options={})=>win.emit('keyup',{code,target:button,...options});
  const destroy=()=>kind==='game'?game.destroy():win.emit('beforeunload');
  return{win,doc,surface,scope:scope||surface,button,actions,commands,set,down,up,destroy,summon:()=>menu({type:'summon-rod'}),finishEntrance:()=>entranceReady=true};
}

for(const kind of ['game','desktop']){
  test(`${kind}: F charges and casts once; repeat cannot hook or recast`,()=>{
    const f=fixture(kind);f.down();f.set('charging');f.down('KeyF',{repeat:true});f.down();
    assert.deepEqual(f.actions,['cast-start']);f.up();f.up();assert.deepEqual(f.actions,['cast-start','cast-release']);
    f.set('bite');f.down();f.down('KeyF',{repeat:true});f.down();assert.equal(f.actions.filter(type=>type==='hook').length,1);
    f.set('reeling');f.set('reeling');f.down('KeyF',{repeat:true});assert.equal(f.actions.at(-1),'reel-start');f.up();
    assert.deepEqual(f.actions.slice(-3),['hook','reel-start','reel-release']);f.destroy();
  });
  test(`${kind}: releasing or blurring before the hook snapshot does not leave the bar held`,()=>{
    for(const end of ['keyup','blur']){
      const f=fixture(kind);f.set('bite');f.down();end==='keyup'?f.up():f.win.emit('blur');f.set('reeling');
      assert.deepEqual(f.actions,['hook']);f.up();f.down();f.up();assert.deepEqual(f.actions,['hook','reel-start','reel-release']);f.destroy();
    }
  });
  test(`${kind}: a held hook survives synchronous snapshots without duplicate reel starts`,()=>{
    let f;f=fixture(kind,type=>{if(type==='hook'||type==='reel-start')f.set('reeling');});f.set('bite');f.down();
    assert.deepEqual(f.actions,['hook','reel-start']);f.up();assert.equal(f.actions.at(-1),'reel-release');f.destroy();
  });
  test(`${kind}: holding through a catch or an early hook escape cannot start another cast`,()=>{
    for(const phase of ['caught','escaped']){
      const f=fixture(kind);f.set(phase==='caught'?'bite':'waiting');f.down();if(phase==='caught')f.set('reeling');f.set(phase);
      const count=f.actions.length;f.down('KeyF',{repeat:true});f.down();f.up();assert.equal(f.actions.length,count);
      f.down();assert.equal(f.actions.at(-1),'cast-start');f.destroy();
    }
  });
  test(`${kind}: catch display ignores rapid keys and clicks, then requires a fresh press`,()=>{
    const f=fixture(kind);f.set('caught',{recastRemaining:2000});
    for(let i=0;i<4;i++){f.down();f.up();f.button.emit('pointerdown',{button:0,pointerId:7});f.button.emit('pointerup',{button:0,pointerId:7});}
    assert.deepEqual(f.actions,[]);f.down();f.set('caught',{recastRemaining:0});f.down('KeyF',{repeat:true});f.down();assert.deepEqual(f.actions,[]);
    f.up();f.down();f.set('charging');f.up();assert.deepEqual(f.actions,['cast-start','cast-release']);f.destroy();
  });
  test(`${kind}: releasing another key or the mouse cannot drop an F hold`,()=>{
    const f=fixture(kind);f.set('reeling');f.down();f.down('Space');f.up('Space');f.button.emit('pointerup',{button:0,pointerId:7});
    assert.deepEqual(f.actions,['reel-start']);f.up();assert.deepEqual(f.actions,['reel-start','reel-release']);f.destroy();
  });
  test(`${kind}: mouse remains available and keyboard releases cannot steal its hold`,()=>{
    const f=fixture(kind);f.set('reeling');f.button.emit('pointerdown',{button:0,pointerId:7});f.down();f.up();
    assert.deepEqual(f.actions,['reel-start']);f.button.emit('pointerup',{button:0,pointerId:7});assert.deepEqual(f.actions,['reel-start','reel-release']);
    f.down('Space');f.up('Space');assert.deepEqual(f.actions.slice(-2),['reel-start','reel-release']);f.destroy();
  });
  test(`${kind}: typing, IME composition and browser shortcuts do not operate fishing`,()=>{
    const f=fixture(kind);f.set('reeling');
    for(const tag of ['input','textarea','select']){const target=new Element(f.doc,tag);assert.equal(f.down('KeyF',{target}).defaultPrevented,false);}
    const editor=new Element(f.doc);editor.setAttribute('contenteditable','');const nested=editor.appendChild(new Element(f.doc));f.down('KeyF',{target:nested});
    const plainEditor=new Element(f.doc);plainEditor.setAttribute('contenteditable','plaintext-only');f.down('KeyF',{target:plainEditor});
    const textRole=new Element(f.doc);textRole.setAttribute('role','textbox');f.down('KeyF',{target:textRole});
    for(const key of ['ctrlKey','altKey','metaKey','isComposing','defaultPrevented'])f.down('KeyF',{[key]:true});
    assert.deepEqual(f.actions,[]);f.down();f.up();assert.deepEqual(f.actions,['reel-start','reel-release']);f.destroy();
  });
  test(`${kind}: blur, editing focus, hiding and disposal all release held input`,()=>{
    const f=fixture(kind);f.set('reeling');f.down();f.win.emit('blur');f.up();assert.deepEqual(f.actions,['reel-start','reel-release']);
    f.down();const editor=f.surface.appendChild(new Element(f.doc,'input'));f.surface.emit('focusout',{relatedTarget:editor});f.up();assert.deepEqual(f.actions.slice(-2),['reel-start','reel-release']);
    f.down();f.doc.hidden=true;f.doc.emit('visibilitychange');f.up();assert.deepEqual(f.actions.slice(-2),['reel-start','reel-release']);
    f.doc.hidden=false;f.down();f.surface.emit('focusout',{relatedTarget:new Element(f.doc)});f.up();assert.deepEqual(f.actions.slice(-2),['reel-start','reel-release']);
    f.down();f.destroy();assert.deepEqual(f.actions.slice(-2),['reel-start','reel-release']);const count=f.actions.length;f.down();f.up();assert.equal(f.actions.length,count);
  });
  test(`${kind}: losing focus while charging cancels instead of throwing a rod`,()=>{
    const f=fixture(kind);f.down();f.set('charging');f.win.emit('blur');f.up();assert.deepEqual(f.actions,['cast-start','cancel']);f.destroy();
  });
  test(`${kind}: F hold raises the real control bar, release lowers it and taps give small adjustments`,()=>{
    let holding=false;const f=fixture(kind,type=>{if(type==='reel-start')holding=true;else if(type==='reel-release')holding=false;});
    const session=F.createSession(null,{seed:0,now:1000});F.stepSession(session,{release:true},900);F.stepSession(session,{},650);F.stepSession(session,{},session.waitDuration);F.stepSession(session,{hook:true},0);
    assert.equal(session.phase,'reeling');f.set('reeling');const initial=session.barPosition;
    f.down();F.stepSession(session,{holding},200);const raised=session.barPosition;assert(raised>initial);
    f.up();F.stepSession(session,{holding},200);assert(session.barPosition<raised);assert(Math.abs(session.barPosition-initial)<1e-10);
    f.down();F.stepSession(session,{holding},32);f.up();assert(session.barPosition>initial&&session.barPosition-initial<raised-initial);f.destroy();
  });
}

test('game: F remains available after tackle, cancel and disabled cast button focus changes',()=>{
  const f=fixture('game',null,{dialog:true}),toolbar=f.scope.appendChild(new Element(f.doc,'button'));
  f.button.focus();f.set('cast');assert.equal(f.doc.activeElement,f.surface,'focus moves before disabling the cast button');
  for(const target of [toolbar,f.doc.body,f.doc.documentElement]){
    f.set('bite');f.down('KeyF',{target});f.set('reeling');f.up('KeyF',{target});assert.deepEqual(f.actions.slice(-3),['hook','reel-start','reel-release']);
  }
  f.set('idle');const count=f.actions.length;assert.equal(f.down('Space',{target:toolbar}).defaultPrevented,false);assert.equal(f.actions.length,count);
  toolbar.focus();f.down('KeyF',{target:toolbar});assert.equal(f.doc.activeElement,f.surface,'focus leaves the replaceable rig selector before casting');f.set('charging');f.scope.emit('focusout',{relatedTarget:f.surface});f.up();assert.deepEqual(f.actions.slice(-2),['cast-start','cast-release']);f.destroy();
});

test('game: F belongs only to the active fishing dialog and never to editors or other dialogs',()=>{
  const f=fixture('game',null,{dialog:true}),outside=f.doc.body.appendChild(new Element(f.doc,'button')),editor=f.scope.appendChild(new Element(f.doc,'input'));
  f.set('reeling');assert.equal(f.down('KeyF',{target:outside}).defaultPrevented,false);assert.equal(f.down('KeyF',{target:editor}).defaultPrevented,false);
  const other=f.doc.body.appendChild(new Element(f.doc,'dialog'));other.open=true;other.modal=true;f.doc.dialogs.push(other);
  assert.equal(f.down('KeyF',{target:f.doc.body}).defaultPrevented,false);assert.equal(f.down().defaultPrevented,false);assert.deepEqual(f.actions,[]);
  other.open=false;f.down('KeyF',{target:f.doc.body});f.up();assert.deepEqual(f.actions,['reel-start','reel-release']);
  f.scope.open=false;const count=f.actions.length;assert.equal(f.down('KeyF',{target:f.doc.body}).defaultPrevented,false);assert.equal(f.actions.length,count);f.destroy();
});

test('desktop: F works from toolbar focus; Space retains native button activation',()=>{
  const f=fixture('desktop'),toolbar=f.doc.getElementById('fishing-tools').appendChild(new Element(f.doc,'button'));f.set('reeling');
  assert.equal(f.down('Space',{target:toolbar}).defaultPrevented,false);assert.deepEqual(f.actions,[]);
  f.down('KeyF',{target:toolbar});f.up('KeyF',{target:toolbar});assert.deepEqual(f.actions,['reel-start','reel-release']);
  toolbar.focus();f.button.emit('pointerdown',{button:0,pointerId:7});assert.equal(f.doc.activeElement,f.button);f.button.emit('pointerup',{button:0,pointerId:7});f.destroy();
});


test('desktop requires summoning and a completed entrance before F or rod clicks can charge',()=>{
  const f=fixture('desktop',null,{summoned:false,entranceReady:false});
  f.down();f.up();f.button.emit('pointerdown',{button:0,pointerId:1});assert.deepEqual(f.actions,[]);
  f.summon();f.down();f.up();f.button.emit('pointerdown',{button:0,pointerId:2});assert.deepEqual(f.actions,[]);
  f.finishEntrance();f.down();f.up();assert.deepEqual(f.actions,['cast-start','cast-release']);
  assert.equal(f.commands.find(m=>m.type==='cast-start').entranceReady,true);f.destroy();
});

test('desktop left pond press drags without a summon or menu selection and never casts',()=>{
  const f=fixture('desktop',null,{summoned:false}),pond=f.doc.getElementById('fishing-pond');
  pond.emit('pointerdown',{button:0,pointerId:5,screenX:200,screenY:100});
  pond.emit('pointermove',{pointerId:5,screenX:240,screenY:120});
  pond.emit('pointerup',{button:0,pointerId:5,screenX:240,screenY:120});
  assert.deepEqual(f.commands.filter(m=>m.type.startsWith('drag-')).map(m=>m.type),['drag-start','drag-move','drag-end']);
  assert.deepEqual(f.actions,[]);f.destroy();
});

test('desktop preserves an F gesture while an old idle snapshot precedes its cast acknowledgement',()=>{
  const f=fixture('desktop');f.down();f.set('idle');
  assert.deepEqual(f.actions,['cast-start'],'late idle updates cannot cancel a held cast');
  f.up();assert.deepEqual(f.actions,['cast-start','cast-release']);
  f.down();f.up();assert.deepEqual(f.actions,['cast-start','cast-release'],'rapid repeat cannot start a second unacknowledged cast');
  f.set('charging',{session:{id:'fresh-cast',phase:'charging'}});
  f.set('escaped',{session:{id:'fresh-cast',phase:'escaped'}});
  f.down();assert.equal(f.actions.at(-1),'cast-start');f.destroy();
});

test('desktop discards pending input on account change without cancelling the new account',()=>{
  const f=fixture('desktop');f.down();f.set('idle',{accountScope:'other-account'});f.up();
  assert.deepEqual(f.actions,['cast-start']);f.destroy();
});
