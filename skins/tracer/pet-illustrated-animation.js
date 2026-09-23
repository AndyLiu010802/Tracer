(function(root,factory){
  const api=factory(root.TracerGardenCompanionMotion,root.TracerPetIllustratedAtlas);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerPetIllustratedAnimation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Motion,Atlas){
  'use strict';
  // The original fishing sheets draw a release after the catch. End on the
  // successful lift instead of playing that return-to-water sequence.
  const fishingEndFrames=Object.freeze({sprout:11,miso:9,brook:10,ember:10,luna:8,nova:10});
  function create(options={}){
    const id=typeof options.pet==='string'?options.pet:options.pet?.id,actions=options.actions;
    const sheets=Atlas?.kinds?.[id]?.normal;
    if(!Motion||!actions?.every(action=>sheets?.[action]))return null;
    const doc=options.document||document,win=doc.defaultView,element=doc.createElement('span');
    element.className='pet-sprite pet-builtin-sprite pet-illustrated-sprite';
    element.innerHTML=options.fallback||'';element.setAttribute('role','img');element.setAttribute('aria-label',options.label||id);
    const media=win.matchMedia('(prefers-reduced-motion: reduce)');
    let action='idle',base='idle',frame=0,timer=null,dead=false,visible=true,finish=null,oneShot=false;
    const lastFrame=()=>action==='fishing'?(fishingEndFrames[id]??15):15;
    const layer=Motion.create(element,{kind:id,stage:4,rare:true,atlas:Atlas,actions,
      sample:()=>({clip:action,frame}),onReady:()=>{if(!dead){draw();schedule();}}});
    function draw(){layer.render(action);element.dataset.action=action;element.dataset.frames='16';}
    function stop(){if(timer!==null)win.clearTimeout(timer);timer=null;}
    function schedule(){
      stop();const reason=dead?'destroyed':options.animated===false?'static':doc.hidden?'hidden':media.matches?'reduced-motion':!visible?'offscreen':'playing';
      element.dataset.playback=reason;if(reason!=='playing')return;
      timer=win.setTimeout(()=>{timer=null;if(!layer.waiting(action)){
        if(frame===lastFrame()&&oneShot){const done=finish;finish=null;oneShot=false;action=base;frame=0;draw();done?.();}
        else{frame=frame===lastFrame()?0:frame+1;draw();}
      }schedule();},action==='fishing'&&frame===lastFrame()?Math.max(1200,options.duration(action,frame)):options.duration(action,frame));
    }
    function cancelPreview(){finish=null;oneShot=false;action=base;frame=0;}
    function refresh(){if(dead)return;if(doc.hidden||media.matches||!visible)cancelPreview();draw();schedule();}
    const observer=options.animated!==false&&typeof win.IntersectionObserver==='function'?new win.IntersectionObserver(entries=>{
      visible=entries[0]?.isIntersecting!==false;refresh();
    },{rootMargin:'60px'}):null;
    if(options.animated!==false){doc.addEventListener('visibilitychange',refresh);media.addEventListener('change',refresh);observer?.observe(element);}
    draw();schedule();
    return{element,availableActions:()=>actions.slice(),
      setAction(value){if(dead)return;const next=actions.includes(value)?value:'idle';base=next;
        if(oneShot&&!['sleep','focus','drag','feed','pet','play','wake'].includes(next))return;
        if(action===next&&!oneShot)return;cancelPreview();draw();schedule();},
      preview(value,callback){if(dead||!actions.includes(value)||['sleep','focus','drag'].includes(base)||doc.hidden||media.matches||!visible||options.animated===false)return false;
        action=value;frame=0;oneShot=true;finish=callback;layer.retry(value);draw();schedule();return true;},
      reset(){if(dead)return;cancelPreview();draw();schedule();},
      destroy(){if(dead)return;dead=true;stop();finish=null;observer?.disconnect();layer.destroy();doc.removeEventListener('visibilitychange',refresh);media.removeEventListener('change',refresh);element.dataset.playback='destroyed';}
    };
  }
  return{create};
});
