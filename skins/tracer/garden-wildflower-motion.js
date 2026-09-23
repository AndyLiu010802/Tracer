(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./garden-wildflower-atlas'):root.TracerGardenWildflowerAtlas);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerGardenWildflowerMotion=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Atlas){
  'use strict';
  const timings=Object.freeze({
    idle:Object.freeze([2500,180,180,180,65,65,85,85,65,65,180,180,180,180,180,600]),
    greet:Object.freeze([180,90,90,90,95,80,65,100,85,80,95,100,130,180,260,390]),
    celebrate:Object.freeze([180,90,90,80,80,70,80,100,100,100,80,100,110,160,240,430])
  });
  const duration=action=>(Object.hasOwn(timings,action)?timings[action]:timings.idle).reduce((a,b)=>a+b,0);
  const supports=options=>options?.kind==='wildflower'&&options.rare===true&&Number(options.stage)===4;
  function sample(action,elapsed=0,still=false){
    const clip=Object.hasOwn(timings,action)?action:'idle',total=duration(clip);
    let at=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
    at=clip==='idle'?at%total:Math.min(at,total-1);
    if(still)return {clip:'idle',frame:action==='rest'?6:0,y:0,shadow:1};
    let frame=0,passed=0;while(frame<15&&at>=passed+timings[clip][frame])passed+=timings[clip][frame++];
    if(action==='rest')return {clip:'idle',frame:6,y:0,shadow:1};
    // Shared neutral drawing at both ends avoids a cross-sheet pose jump.
    const source=clip!=='idle'&&(frame===0||frame===15)?'idle':clip;
    const y=0;
    return {clip:source,frame:source!==clip?0:frame,y,shadow:1+y*.027};
  }
  const caches=new WeakMap();
  function load(doc,url,data){
    let cache=caches.get(doc);if(!cache){cache=new Map();caches.set(doc,cache);}
    if(!cache.has(url))cache.set(url,new Promise((resolve,reject)=>{
      const image=new doc.defaultView.Image();image.onload=()=>image.naturalWidth===data.width&&image.naturalHeight===data.height?resolve(image):reject(new Error('wildflower-atlas-dimensions'));image.onerror=()=>reject(new Error('wildflower-atlas-load'));image.src=url;
    }).catch(error=>{cache.delete(url);throw error;}));
    return cache.get(url);
  }
  function create(element,options){
    if(!supports(options)||!Atlas)return null;
    const doc=element.ownerDocument,variant=options.shiny?'shiny':'normal',sheets=Atlas[variant];
    let dead=false,ready=false,previous='',lastY=null;
    const ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg');
    svg.setAttribute('class','garden-home-plant-art garden-pixel-plant garden-illustrated-plant garden-wildflower-motion');svg.setAttribute('viewBox','0 0 160 176');svg.setAttribute('aria-hidden','true');
    const shadow=doc.createElementNS(ns,'ellipse');for(const [key,value]of Object.entries({cx:80,cy:151,rx:30,ry:5,fill:'#27402a',opacity:.18}))shadow.setAttribute(key,String(value));svg.appendChild(shadow);
    const body=doc.createElementNS(ns,'g'),crop=doc.createElementNS(ns,'svg'),image=doc.createElementNS(ns,'image');
    crop.setAttribute('overflow','hidden');image.setAttribute('data-plant-part','face');image.setAttribute('preserveAspectRatio','none');crop.appendChild(image);body.appendChild(crop);svg.appendChild(body);
    element.dataset.motion='loading';
    const urls=Object.fromEntries(Object.keys(timings).map(action=>[action,'/garden-art/wildflower-'+variant+'-'+action+'-v1.png']));
    Promise.all(Object.entries(sheets).map(([action,data])=>load(doc,urls[action],data))).then(()=>{
      if(dead)return;ready=true;element.replaceChildren(svg);element.dataset.motion='ready';element.dataset.frames='16';
      if(typeof options.onReady==='function')options.onReady();else render('idle',0,true);
    },()=>{if(!dead)element.dataset.motion='fallback';});
    function render(action,elapsed,still,transform){
      if(!ready||dead)return false;
      const pose=sample(action,elapsed,still),data=sheets[pose.clip],cell=data.cells[pose.frame],key=pose.clip+':'+pose.frame;
      if(key!==previous){
        const scale=data.scale,x=80+(cell.x-cell.rootX)*scale,y=151+(cell.y-cell.rootY)*scale;
        for(const [key,value]of Object.entries({x,y,width:cell.w*scale,height:cell.h*scale,viewBox:[cell.x,cell.y,cell.w,cell.h].join(' ')}))crop.setAttribute(key,String(value));
        image.setAttribute('href',urls[pose.clip]);image.setAttribute('width',String(data.width));image.setAttribute('height',String(data.height));previous=key;
      }
      const movement=Object.hasOwn(timings,action)||action==='focus'||still?'translate(0 '+pose.y+')':null;
      if(movement!==null){body.style.transform='';if(lastY!==pose.y){body.setAttribute('transform',movement);lastY=pose.y;}}
      else{body.removeAttribute('transform');body.style.transformOrigin='80px 151px';body.style.transform=transform||'';lastY=null;}
      shadow.setAttribute('rx',String(30*pose.shadow));shadow.setAttribute('opacity',String(.18*pose.shadow));
      element.dataset.frame=String(pose.frame);element.dataset.motionClip=pose.clip;return true;
    }
    return {render,destroy(){dead=true;ready=false;}};
  }
  return {timings,duration,sample,supports,create};
});
