(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./garden-plant-art'):root.TracerGardenPlantArt,typeof module==='object'&&module.exports?require('./garden-wildflower-motion'):root.TracerGardenWildflowerMotion,typeof module==='object'&&module.exports?require('./garden-companion-motion'):root.TracerGardenCompanionMotion);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerGardenPlantAnimation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Art,Wildflower,Companion){
  'use strict';
  const actions=Object.freeze(['idle','greet','walk','hop','water','pet','music','celebrate','rest','focus','breeze','stretch','look','shy','eat','thanks','play','crafting']);
  const durations={idle:10000,greet:6500,walk:6500,hop:6500,water:6500,pet:6500,music:6500,celebrate:6500,rest:7000,focus:9800,breeze:6500,stretch:6500,look:6500,shy:6500,eat:6500,thanks:6500,play:7900,crafting:7900};
  const frames=32,hubs=new WeakMap(),round=n=>Math.round(n*1000)/1000;
  const turn=(angle,x=0,y=0,sx=1,sy=1)=>`translate(${round(x)}px,${round(y)}px) rotate(${round(angle)}deg) scale(${round(sx)},${round(sy)})`;
  function sample(action,frame=0){
    if(action==='rest')frame=0;
    action=actions.includes(action)?action:'idle';frame=Number.isFinite(frame)?frame:0;
    const p=((frame%frames)+frames)%frames/frames,w=Math.sin(p*Math.PI*2),e=Math.sin(p*Math.PI),fast=Math.sin(p*Math.PI*6);
    let head=w*1.4,left=w*3,right=-w*3,y=-e*e*.7,sy=1,eyes=1;
    if(action==='greet'){head=fast*e*4;left=-Math.abs(fast)*e*25;right=e*9;}
    if(action==='water'){head=-e*6;left=e*17;right=-e*17;y=e*2;sy=1-e*.025;}
    if(action==='pet'){head=w*e*8;left=-e*12;right=e*12;y=e*3;sy=1-e*.04;eyes=1-e*.92;}
    if(action==='music'){head=Math.sin(p*Math.PI*8)*e*7;left=fast*e*23;right=-fast*e*23;y=-Math.abs(Math.sin(p*Math.PI*4))*e*7;}
    if(action==='celebrate'){head=w*e*6;left=-e*32;right=e*32;y=-Math.pow(e,4)*15;sy=1+Math.sin(p*Math.PI*4)*e*.04;}
    if(action==='rest'){head=7+w;left=10+w;right=-10-w;y=3+e;sy=.95+e*.015;eyes=.12;}
    if(action==='focus'){head=2+w;left=4+w*2;right=-4-w*2;}
    if(action==='breeze'){head=fast*e*10;left=fast*e*16;right=fast*e*12;}
    if(!['pet','rest'].includes(action)&&p>.72&&p<.83)eyes=Math.max(.12,Math.abs(p-.775)/.055);
    return {body:turn(0),illustration:turn(0),head:turn(head*.35),'leaf-left':turn(left*.35),'leaf-right':turn(right*.35),face:turn(0,0,0,1,eyes),frame:Math.floor(p*frames)};
  }
  function hubFor(doc){
    if(hubs.has(doc))return hubs.get(doc);
    const win=doc.defaultView,media=win.matchMedia('(prefers-reduced-motion: reduce)'),players=new Set();let raf=null,previous=null;
    const runnable=()=>!(doc.hidden || doc.tracerHidden)&&!media.matches&&Array.from(players).some(p=>p.visible);
    function cancel(){if(raf!==null)win.cancelAnimationFrame(raf);raf=null;previous=null;}
    function tick(at){
      raf=null;if(!runnable()){previous=null;return;}
      const delta=previous===null?0:Math.min(80,Math.max(0,at-previous));previous=at;
      for(const p of players)if(p.visible)p.advance(delta);
      if(runnable())raf=win.requestAnimationFrame(tick);else previous=null;
    }
    function refresh(){
      for(const p of players)p.element.dataset.playback=(doc.hidden || doc.tracerHidden)?'hidden':media.matches?'reduced':!p.visible?'offscreen':'playing';
      for(const p of players)if((doc.hidden || doc.tracerHidden)||media.matches||!p.visible)p.suspend();
      if(!runnable())cancel();
      else if(raf===null)raf=win.requestAnimationFrame(tick);
    }
    const observer=typeof win.IntersectionObserver==='function'?new win.IntersectionObserver(entries=>{
      for(const entry of entries)for(const p of players)if(p.element===entry.target)p.visible=entry.isIntersecting;
      refresh();
    },{rootMargin:'60px'}):null;
    ['visibilitychange','tracer-visibilitychange'].forEach(event=>doc.addEventListener(event,refresh));media.addEventListener('change',refresh);
    const hub={media,refresh,add(p){players.add(p);observer?.observe(p.element);refresh();},remove(p){
      observer?.unobserve(p.element);players.delete(p);
      if(players.size)refresh();else{cancel();observer?.disconnect();['visibilitychange','tracer-visibilitychange'].forEach(event=>doc.removeEventListener(event,refresh));media.removeEventListener('change',refresh);hubs.delete(doc);}
    }};hubs.set(doc,hub);return hub;
  }
  function create(options={}){
    const doc=options.document||(typeof document!=='undefined'?document:null);if(!doc)throw new Error('Plant animation requires a document');
    const element=doc.createElement('span');element.className='garden-plant-sprite'+(options.pet?' pet-sprite pet-builtin-sprite':'');element.dataset.frames=String(frames);
    element.innerHTML=Art.markup(options.kind,options.stage,options.rare,options.shiny);element.setAttribute('role','img');element.setAttribute('aria-label',options.label||'Plant');
    element.dataset.shiny=String(!!options.shiny);
    const parts=Array.from(element.querySelectorAll('[data-plant-part]'));
    const motion=Companion?.supports(options)?Companion:Wildflower?.supports(options)?Wildflower:null;
    const illustrated=options.animated!==false&&motion?motion.create(element,{...options,onReady:()=>render(!hub||hub.media.matches||(doc.hidden || doc.tracerHidden)||!player.visible)}):null;
    const clipDuration=action=>illustrated&&Object.hasOwn(motion.timings,action)?motion.duration(action):durations[action];
    let action='idle',base='idle',elapsed=Number(options.phase)||0,dead=false,finish=null,oneShot=false;
    const hub=options.animated===false?null:hubFor(doc);
    const player={element,visible:true,advance(delta){if(!illustrated?.waiting?.(action))elapsed+=delta;if(oneShot&&elapsed>=clipDuration(action))settle();else render();},suspend(){cancelShot();render(true);}};
    function render(still=false){
      if(dead)return;const pose=sample(action,still?0:elapsed/clipDuration(action)*frames);
      if(!illustrated?.render(action,elapsed,still,pose.illustration,!oneShot)){
        for(const node of parts)if(node.tagName.toLowerCase()!=='image')node.style.transform=pose[node.dataset.plantPart]||'none';
        element.dataset.frame=String(pose.frame);
      }
      element.dataset.action=action;
    }
    function cancelShot(){if(!oneShot)return;finish=null;oneShot=false;action=base;elapsed=0;}
    function settle(){const done=finish;finish=null;oneShot=false;action=base;elapsed=0;render(hub?.media.matches);done?.();}
    function map(value){
      if((value==='play'||value==='crafting')&&illustrated?.available().includes(value))return value;
      return ({feed:'eat',play:'music',sleep:'rest',wake:'stretch',farming:'water',exercise:'hop',drag:'greet',fishing:'look',reading:'focus',writing:'focus',mining:'celebrate',crafting:'focus',tea:'rest'})[value]||value;
    }
    render();if(hub)hub.add(player);else element.dataset.playback='static';
    return {element,
      availableActions(){return illustrated?.available?.()||[];},
      play(value,callback){if(dead||!actions.includes(value)||['focus','rest'].includes(base)||(doc.hidden || doc.tracerHidden)||!player.visible||hub?.media.matches)return false;if(oneShot&&action===value)return false;action=value;elapsed=0;oneShot=true;finish=typeof callback==='function'?callback:null;render();if(!hub)settle();return true;},
      preview(value,callback){if(!this.availableActions().includes(value))return false;illustrated?.retry?.(value);return this.play(value,callback);},
      setAction(value){if(dead)return;value=map(value);value=actions.includes(value)?value:'idle';base=value;const interrupted=oneShot&&['focus','rest'].includes(value);if(interrupted)cancelShot();if(oneShot||action===value&&!interrupted)return;action=value;elapsed=0;render(hub?.media.matches);},
      reset(){if(dead)return;finish=null;oneShot=false;action=base;elapsed=0;render(hub?.media.matches);},
      destroy(){if(dead)return;dead=true;finish=null;illustrated?.destroy();hub?.remove(player);element.dataset.playback='destroyed';}
    };
  }
  return {actions,durations,frames,sample,create};
});
