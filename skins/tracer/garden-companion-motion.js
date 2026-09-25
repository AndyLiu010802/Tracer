(function(root,factory){
  const api=factory(root.TracerCompanionInbetweens||(typeof module==='object'&&module.exports?require('./companion-inbetweens'):null),typeof module==='object'&&module.exports?require('./garden-companion-atlas'):root.TracerGardenCompanionAtlas);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerGardenCompanionMotion=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Inbetweens,Atlas){
  'use strict';
  const actions=Object.freeze(['idle','greet','walk','hop','water','pet','music','celebrate','rest','focus','breeze','stretch','look','shy','eat','thanks','play','crafting']);
  const timings=Object.freeze(Object.fromEntries(actions.map(action=>[action,Object.freeze(
    action==='idle'?[6000,...Array(30).fill(120),1800]:
    action==='rest'?Array(32).fill(240):
    action==='focus'?[5000,...Array(30).fill(140),2000]:
    [2200,...Array(30).fill(130),1800])])));
  const durations=Object.freeze(Object.fromEntries(actions.map(action=>[action,timings[action].reduce((sum,ms)=>sum+ms,0)])));
  const caches=new WeakMap(),MAX_CACHE=16;
  function duration(action){return Object.hasOwn(durations,action)?durations[action]:durations.idle;}
  function sample(action,elapsed=0,still=false,loop=true){
    action=actions.includes(action)?action:'idle';const total=duration(action);
    if(still)return{clip:action==='rest'?'rest':'idle',frame:action==='rest'?24:0,frames:32};
    let at=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
    // A sustained rest holds its settled pose; explicit previews retain every drawing.
    if(loop&&action==='rest')return{clip:'rest',frame:24,frames:32};
    at=loop?at%total:Math.min(at,total-Number.EPSILON);
    let frame=0,passed=0;while(frame<31&&at>=passed+timings[action][frame])passed+=timings[action][frame++];
    return{clip:action,frame,frames:32};
  }
  const sheetsFor=options=>(options?.atlas||Atlas)?.kinds?.[options?.kind]?.[options?.shiny?'shiny':'normal'];
  const supports=options=>options?.rare===true&&Number(options.stage)===4&&!!sheetsFor(options)&&Object.keys(sheetsFor(options)).length>0;
  const available=options=>(options?.actions||actions).filter(action=>!!sheetsFor(options)?.[action]);
  function cacheFor(doc){let cache=caches.get(doc);if(!cache){cache=new Map();caches.set(doc,cache);}return cache;}
  function trim(cache){for(const[key,entry]of cache){if(cache.size<=MAX_CACHE)break;if(!entry.users.size&&entry.state!=='loading')cache.delete(key);}}
  const pagesOf=sheet=>sheet.pages||[sheet];
  const cacheKey=sheet=>pagesOf(sheet).map(page=>page.src).join('|');
  function entryFor(doc,sheet){
    const cache=cacheFor(doc),key=cacheKey(sheet);let entry=cache.get(key);
    if(entry){cache.delete(key);cache.set(key,entry);return entry;}
    entry={state:'loading',users:new Set(),image:null,images:[],promise:null};cache.set(key,entry);
    entry.promise=Promise.all(pagesOf(sheet).map((page,index)=>new Promise(resolve=>{
      const image=new doc.defaultView.Image();entry.images[index]=image;
      image.onload=()=>resolve(image.naturalWidth===page.width&&image.naturalHeight===page.height);
      image.onerror=()=>resolve(false);image.src=page.src;
    }))).then(ready=>{entry.state=ready.every(Boolean)?'ready':'failed';entry.image=entry.state==='ready'?entry.images[0]:null;trim(cache);return entry;});return entry;
  }
  function create(element,options={}){
    if(!supports(options))return null;
    const doc=element.ownerDocument,sheets=sheetsFor(options),held=new Map(),owner={},fallback=[...(element.childNodes||element.children||[])];
    const supported=options.actions||actions,sampleClip=options.sample||sample;
    // Generated pages can draw the same character at different native sizes.
    // Normalize its measured solid-body diameter once per page, not the prop bounding box
    // and never per frame, so contact poses and tool changes cannot cause pulses.
    const pages=Object.values(sheets).flatMap(pagesOf),metric=pages.every(page=>page.identitySize>0)?'identitySize':pages.every(page=>page.bodySize>0)?'bodySize':'width';
    const scaleBasis=Math.min(...pages.map(page=>page.scale*page[metric]));
    const scaleFor=page=>scaleBasis/page[metric];
    let dead=false,installed=false,previous='',wanted='idle';
    const ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg'),shadow=doc.createElementNS(ns,'ellipse'),body=doc.createElementNS(ns,'g'),crop=doc.createElementNS(ns,'svg'),image=doc.createElementNS(ns,'image');
    svg.setAttribute('class','garden-home-plant-art garden-pixel-plant garden-illustrated-plant garden-companion-motion');svg.setAttribute('viewBox','0 0 160 176');svg.setAttribute('aria-hidden','true');
    for(const[key,value]of Object.entries({cx:80,cy:151,rx:30,ry:5,fill:'#27402a',opacity:.18}))shadow.setAttribute(key,String(value));
    crop.setAttribute('overflow','hidden');image.setAttribute('preserveAspectRatio','none');crop.appendChild(image);body.appendChild(crop);svg.appendChild(shadow);svg.appendChild(body);
    function release(action){const entry=held.get(action);if(entry){entry.users.delete(owner);held.delete(action);trim(cacheFor(doc));}}
    function acquire(action){
      if(!sheets[action]||held.has(action))return;
      const entry=entryFor(doc,sheets[action]);held.set(action,entry);entry.users.add(owner);
      if(entry.state==='loading')entry.promise.then(()=>{if(dead||held.get(action)!==entry)return;options.onReady?.();});
    }
    function request(action){wanted=supported.includes(action)?action:'idle';for(const action of held.keys())if(action!==wanted&&action!=='idle')release(action);acquire('idle');acquire(wanted);}
    function render(action,elapsed=0,still=false,_transform,loop=true){
      if(dead)return false;
      const pose=sampleClip(action,elapsed,still,loop);request(pose.clip);
      let clip=pose.clip,frame=pose.frame,entry=held.get(clip);
      const requested=entry;
      if(entry?.state!=='ready'){clip='idle';frame=0;entry=held.get('idle');}
      element.dataset.motionRequested=supported.includes(action)?action:'idle';
      if(entry?.state!=='ready'){
        if(installed){element.replaceChildren(...fallback);installed=false;previous='';}
        element.dataset.motion=requested?.state==='loading'||held.get('idle')?.state==='loading'?'loading':'fallback';delete element.dataset.motionClip;delete element.dataset.sourceFrames;return false;
      }
      if(!installed){element.replaceChildren(svg);installed=true;}
      const sheet=sheets[clip],renderFrame=frame;
      const playbackFrames=pose.frames||sheet.frames||16;
      const sourcePosition=clip===pose.clip&&Number.isFinite(pose.sourcePosition)?pose.sourcePosition:frame*(sheet.frames||16)/playbackFrames;
      frame=Math.floor(sourcePosition);
      const between=sourcePosition%1!==0,cell=sheet.cells[frame],page=pagesOf(sheet)[cell.page||0],scale=scaleFor(page),key=cacheKey(sheet)+':'+renderFrame+':'+playbackFrames;
      if(key!==previous&&between&&Inbetweens){
        if(!entry.tweens)entry.tweens=new Map();
        const basis=scale*page.width;
        if(!entry.tweens.has(basis))entry.tweens.set(basis,Inbetweens.create(doc,entry.image,sheet,basis));
        const tween=entry.tweens.get(basis);
        if(tween){
          for(const[k,v]of Object.entries({x:0,y:0,width:160,height:176,viewBox:'0 0 192 212'}))crop.setAttribute(k,String(v));
          image.setAttribute('href',tween.url(frame,(frame+1)%(sheet.frames||16),sourcePosition%1));image.setAttribute('width','192');image.setAttribute('height','212');previous=key;
        }else previous='';
      }
      if(key!==previous){
        for(const[key,value]of Object.entries({x:80+(cell.x-cell.rootX)*scale,y:151+(cell.y-cell.rootY)*scale,width:cell.w*scale,height:cell.h*scale,viewBox:[cell.x,cell.y,cell.w,cell.h].join(' ')}))crop.setAttribute(key,String(value));
        image.setAttribute('href',page.src);image.setAttribute('width',String(page.width));image.setAttribute('height',String(page.height));previous=key;
      }
      // Authored drawings and local articulated in-betweens share one fixed ground and scale.
      body.setAttribute('transform','translate(0 0)');body.style.transform='';
      element.dataset.motion=clip===pose.clip?'ready':'fallback';element.dataset.frames=String(playbackFrames);element.dataset.sourceFrames=String(sheet.frames||16);element.dataset.frame=String(renderFrame);element.dataset.motionClip=clip;return true;
    }
    request('idle');element.dataset.motion='loading';
    return{render,duration,available:()=>available(options),waiting:action=>held.get(action)?.state==='loading',
      retry(action){if(dead)return;const sheet=sheets[action],cache=cacheFor(doc),key=sheet&&cacheKey(sheet);if(sheet&&(held.get(action)?.state==='failed'||cache.get(key)?.state==='failed')){release(action);if(cache.get(key)?.state==='failed')cache.delete(key);acquire(action);}},
      destroy(){if(dead)return;dead=true;for(const action of [...held.keys()])release(action);}};
  }
  return{actions,durations,timings,duration,sample,supports,available,create};
});
