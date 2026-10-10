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
  const win=new Target(),doc=new Target(),nodes=new Map(),actions=[],figures=[],fishPreviews=[],pondUpdates=[];
  doc.defaultView=win;doc.hidden=false;doc.createElement=tag=>new Element(doc,tag);doc.body=new Element(doc,'body');doc.documentElement=new Element(doc,'html');doc.activeElement=doc.body;doc.elementFromPoint=()=>null;
  doc.dialogs=[];doc.querySelectorAll=selector=>selector==='dialog[open]'?doc.dialogs.filter(dialog=>dialog.open):[];
  doc.getElementById=id=>{if(!nodes.has(id)){const node=new Element(doc);node.id=id;nodes.set(id,node);}return nodes.get(id);};
  const art={escape:value=>String(value??''),rodMarkup:()=>'',fishMarkup:fish=>{fishPreviews.push(fish);return '';},createPond:(_host,initial)=>{if(kind==='desktop')pondUpdates.push(structuredClone(initial));return{update(value){pondUpdates.push(structuredClone(value));},destroy(){}};}};
  art.createFishFigure=(_host,{fish})=>{const figure={kind:'fish',fish,updates:[],destroyed:0,update(next){this.fish=next.fish;this.updates.push(next);},destroy(){this.destroyed++;}};figures.push(figure);return figure;};
  win.TracerFishingRewards={markup:()=>'',createFigure:(_host,{fish})=>{const figure={kind:'product',fish,destroyed:0,setFish(value){this.fish=value;},destroy(){this.destroyed++;}};figures.push(figure);return figure;}};
  const record=type=>{actions.push(type);onAction?.(type);};
  let update,surface,button,keydown,scope,menu; const commands=[]; let entranceReady=options.entranceReady!==false;
    surface=doc.getElementById('desktop-fishing');button=doc.getElementById('fishing-rod');surface.appendChild(button);surface.appendChild(doc.getElementById('fishing-tools'));
    win.TracerFishingArt=art;win.TracerFishingMotion={create:()=>({update(){},preview(){return true;},engagePreview:()=>entranceReady,touchPreview(){},dismissPreview(){},destroy(){}})};win.FishingDesktop={onMenuAction:callback=>{menu=callback;return()=>{};},send:message=>{commands.push(message);if(['cast-start','cast-release','hook','reel-start','reel-release','cancel'].includes(message.type))record(message.type);},onSnapshot:callback=>{update=callback;return()=>{};}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/fishing-desktop.js'),'utf8'),{window:win,document:doc,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn()});keydown=win;
  const set=(phase,extra={})=>update({language:'en',session:{id:'input-test',phase},...extra});set('idle');if(kind==='desktop'&&options.summoned!==false)menu({type:'summon-rod'});
  const down=(code='KeyF',options={})=>keydown.emit('keydown',{code,target:button,...options});
  const up=(code='KeyF',options={})=>win.emit('keyup',{code,target:button,...options});
  const destroy=()=>win.emit('beforeunload');
  return{win,doc,surface,scope:scope||surface,button,actions,commands,figures,fishPreviews,pondUpdates,set,down,up,destroy,summon:()=>menu({type:'summon-rod'}),finishEntrance:()=>entranceReady=true};
}

test('desktop: motor pause stays clickable during a bite and manual input cannot steal automatic control',()=>{
  const f=fixture('desktop'),motor=f.doc.getElementById('fishing-motor');
  f.set('bite',{autoMotor:{owned:true,installed:true,running:true,baitCount:2}});
  const pointer=f.win.emit('pointerdown',{button:0,target:motor});assert.equal(pointer.defaultPrevented,false);
  f.down();f.up();f.doc.getElementById('fishing-float').emit('pointerdown',{button:0});assert.deepEqual(f.actions,[]);
  assert.equal(motor.disabled,false);motor.emit('click');assert.equal(f.commands.at(-1).type,'pause-motor');
  f.set('escaped',{autoMotor:{owned:true,installed:true,running:false,baitCount:2}});motor.emit('click');assert.equal(f.commands.at(-1).type,'start-motor');f.destroy();
});

for(const kind of ['desktop']){
  test(`${kind}: live input and immediate catch presentation never create a second fish GPU context`,()=>{
    const f=fixture(kind),fish=F.catalog.fish.find(value=>value.id==='dreamray');
    f.down();f.set('charging',{fish});assert.equal(f.figures.length,0);f.up();assert.deepEqual(f.actions,['cast-start','cast-release']);
    for(const phase of ['cast','waiting','bite','reeling','escaped'])f.set(phase,{fish});
    assert.equal(f.figures.length,0,'no invisible WebGL allocation can block the playable phases');
    assert.equal(f.fishPreviews.length,0);f.set('caught',{fish});f.set('caught',{fish});assert.equal(f.figures.length,0);assert.deepEqual(f.fishPreviews,[fish]);
    const nextFish=F.catalog.fish.find(value=>value.id==='dragonkoi');f.set('charging',{fish:nextFish});assert.equal(f.fishPreviews.length,1);
    f.set('caught',{fish:nextFish});assert.equal(f.figures.length,0);assert.deepEqual(f.fishPreviews,[fish,nextFish]);
    const junk={id:'junk',kind:'junk',variant:'boots',name:['旧靴子','Old boot']};f.set('charging',{fish:junk});assert.equal(f.figures.length,0);
    f.set('caught',{fish:junk});assert.equal(f.figures.length,1);assert.equal(f.figures[0].kind,'product');
    f.destroy();assert.equal(f.figures[0].destroyed,1);
  });
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

test('desktop preserves held F through an accepted charging snapshot disabled by a background save',()=>{
  for(const status of [{disabled:true},{error:'Background save pending'},{disabled:true,error:'Background save pending'}]){
    const f=fixture('desktop');f.down();f.set('charging',{session:{id:'fresh-cast',phase:'charging'},...status});
    assert.deepEqual(f.actions,['cast-start']);f.up();f.up();assert.deepEqual(f.actions,['cast-start','cast-release']);f.destroy();
  }
});

test('desktop blur cancels a held accepted cast while new input is temporarily disabled',()=>{
  const f=fixture('desktop');f.down();f.set('charging',{session:{id:'fresh-cast',phase:'charging'},disabled:true});
  f.win.emit('blur');f.up();assert.deepEqual(f.actions,['cast-start','cancel']);f.destroy();
});

test('desktop charging acknowledgements cannot carry held F across account, restore or native-only reload changes',()=>{
  const initial={accountScope:'active',accountGeneration:2,accountRestoreId:'restore-a',nativeSessionId:'native-idle'};
  for(const change of [{accountScope:'other'},{accountGeneration:3},{accountRestoreId:'restore-b'}]){
    const f=fixture('desktop');f.set('idle',initial);f.down();
    f.set('charging',{...initial,...change,nativeSessionId:'other-native',session:{id:'other-cast',phase:'charging'},disabled:true});
    f.up();assert.deepEqual(f.actions,['cast-start']);f.destroy();
  }
  const f=fixture('desktop');f.set('idle',initial);f.down();f.set('idle',{...initial,nativeSessionId:'native-reload',disabled:true});
  f.set('charging',{...initial,nativeSessionId:'new-native',session:{id:'new-cast',phase:'charging'}});f.up();assert.deepEqual(f.actions,['cast-start']);f.destroy();
});


test('desktop pond forwards fresh feeding and celebrates only a resident crossing 100 percent',()=>{
  const f=fixture('desktop'),now=Date.now(),pond={id:'growth-pond',style:'meadow'},fish=(growth,fedAt,updatedAt=fedAt)=>({id:'resident',speciesId:'clownfish',growth,fedAt,updatedAt});
  f.set('idle',{desktopPond:{pond,fish:[fish(94,now-60001)]}});assert.equal(f.pondUpdates.at(-1).feeding,undefined);
  f.set('idle',{desktopPond:{pond,fish:[fish(100,now)]}});
  assert.deepEqual(f.pondUpdates.at(-1).feeding,{at:now,fishIds:['resident'],grownFishIds:['resident']});
  const count=f.pondUpdates.length;f.set('idle',{desktopPond:{pond,fish:[fish(100,now)]},notice:'Fed'});assert.equal(f.pondUpdates.length,count,'button and notice updates keep the live pond');
  f.set('idle',{desktopPond:{pond:{...pond,style:'moon'},fish:[fish(100,now)]}});assert.equal(f.pondUpdates.at(-1).feeding,undefined,'decorative updates cannot replay the same receipt');
  assert.equal(f.pondUpdates.at(-1).fish[0].growth,100);assert.equal(f.pondUpdates.at(-1).language,'en');f.destroy();
});

test('desktop pond treats initial adult residents and changed account contexts as fresh baselines',()=>{
  const now=Date.now(),pond={id:'growth-pond',style:'meadow'},fish=(growth,fedAt)=>({id:'same-resident',speciesId:'clownfish',growth,fedAt,updatedAt:fedAt});
  for(const change of [{accountScope:'other'},{accountGeneration:2},{accountRestoreId:'restore-b'}]){
    const f=fixture('desktop'),account={accountScope:'active',accountGeneration:1,accountRestoreId:'restore-a'};
    f.set('idle',{...account,desktopPond:{pond,fish:[fish(99,now-60001)]}});
    f.set('idle',{...account,...change,desktopPond:{pond,fish:[fish(100,now)]}});assert.deepEqual(f.pondUpdates.at(-1).feeding.grownFishIds,[],'account baselines never celebrate another account fish');
    f.destroy();
  }
  const f=fixture('desktop');f.set('idle',{desktopPond:{pond,fish:[fish(100,now)]}});assert.deepEqual(f.pondUpdates.at(-1).feeding.grownFishIds,[]);f.destroy();
});

test('desktop pond ignores stale growth celebrations while still rendering every changed snapshot',()=>{
  const f=fixture('desktop'),now=Date.now(),pond={id:'growth-pond',style:'meadow'},fish=(growth,fedAt)=>({id:'resident',speciesId:'clownfish',growth,fedAt,updatedAt:fedAt});
  f.set('idle',{desktopPond:{pond,fish:[fish(99,now-60001)]}});f.set('idle',{desktopPond:{pond,fish:[fish(100,now)]}});
  f.set('idle',{desktopPond:{pond,fish:[fish(99,now-60001)]}});assert.equal(f.pondUpdates.at(-1).fish[0].growth,99,'stale data does not swallow renderer updates');assert.equal(f.pondUpdates.at(-1).feeding,undefined);
  f.set('idle',{desktopPond:{pond,fish:[fish(100,now)]}});assert.equal(f.pondUpdates.length,4);assert.equal(f.pondUpdates.at(-1).feeding,undefined,'a stale snapshot cannot rewind the feeding receipt');f.destroy();
});
