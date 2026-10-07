(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports){module.exports=api;return;}
 root.TracerLocalVfxNativePlayer=api;if(!root.document)return;
 try{
  const session=api.create({canvas:root.document.querySelector('canvas'),bridge:root.LocalVfxPlayer,
   texture:root.TracerLocalVfxHauntTexture,fog:root.TracerLocalVfxHauntAtmosphere,
   createCanvas:()=>root.document.createElement('canvas'),createImage:()=>new root.Image(),decodeImage:image=>root.createImageBitmap(image),
   viewport:()=>({width:root.innerWidth,height:root.innerHeight,dpr:root.devicePixelRatio||1}),
   reducedMotion:()=>root.matchMedia('(prefers-reduced-motion: reduce)').matches,
   now:()=>root.performance.now(),raf:callback=>root.requestAnimationFrame(callback),cancelRaf:handle=>root.cancelAnimationFrame(handle),
   schedule:(callback,ms)=>root.setTimeout(callback,ms),unschedule:handle=>root.clearTimeout(handle),
   listen:(name,callback)=>{root.addEventListener(name,callback);return()=>root.removeEventListener(name,callback);}});
  root.TracerLocalVfxSession=Object.freeze({getDiagnostics:session.getDiagnostics});session.initialize();
 }catch(_){try{root.LocalVfxPlayer?.ready({ok:false,error:'local-vfx-assets-failed'});}catch(_){}}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';const RENDERER='haunt-reference-texture-2',DURATION=7000,MAX_PIXELS=12000000;
 const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
 const ASSET_ROOT='skins/tracer/local-vfx/haunt-art/fade-v1/';
 const freeze=Object.freeze;
 const DESCRIPTOR=freeze({version:1,character:'haunt-reference-remake',bundleId:'fade-v1',canvas:freeze({width:1254,height:1254}),
  anchors:freeze({ground:freeze({x:666,y:1195}),neck:freeze({x:624,y:527})}),eyeMode:'intrinsic',
  coreRegions:freeze({head:freeze({x:330,y:42,width:600,height:493}),tendrils:freeze({x:468,y:524,width:329,height:676})}),
  layers:freeze([
   freeze({id:'core',src:ASSET_ROOT+'fade-haunt-core-v1.png'}),
   freeze({id:'smoke-back',src:ASSET_ROOT+'fade-smoke-wisps-v1.png',sourceAnchor:freeze({x:629,y:1233}),targetAnchor:freeze({x:666,y:1195}),scale:freeze({x:1.12,y:0.92}),opacity:0.46,style:freeze({grayscale:0.38,brightness:0.72,blurPx:4})}),
   freeze({id:'smoke-mid',src:ASSET_ROOT+'fade-smoke-billows-v1.png',sourceAnchor:freeze({x:637,y:1248}),targetAnchor:freeze({x:666,y:1195}),scale:freeze({x:0.92,y:1.21}),opacity:0.94,style:freeze({grayscale:0.18,brightness:0.92,blurPx:1.5})}),
   freeze({id:'smoke-front',src:ASSET_ROOT+'fade-smoke-ground-v1.png',sourceAnchor:freeze({x:632,y:1202}),targetAnchor:freeze({x:666,y:1195}),scale:freeze({x:1.06,y:0.59}),opacity:1,style:freeze({grayscale:0.58,brightness:0.49,blurPx:2.5})})])});
 const ASSETS=new Set(DESCRIPTOR.layers.map(layer=>layer.src));
 const KEYS=['id','enabled','effect','strength','atmosphere','size','motion','width','height','target','start','seed'];
 function plain(value,allowed,required=allowed){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const proto=Object.getPrototypeOf(value);if(proto&&Object.getPrototypeOf(proto)!==null)return false;
  for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!allowed.includes(key)||!d||!Object.hasOwn(d,'value'))return false;}
  return required.every(key=>Object.hasOwn(value,key));
 }
 function point(value,width,height){
  if(!plain(value,['x','y'])||![value.x,value.y].every(Number.isFinite)||value.x<0||value.y<0||value.x>width||value.y>height)throw new TypeError('local-vfx-invalid-packet');
  return freeze({x:value.x,y:value.y});
 }
 function validatePacket(value){
  if(!plain(value,KEYS,KEYS.filter(key=>key!=='start'))||typeof value.id!=='string'||!UUID.test(value.id))throw new TypeError('local-vfx-invalid-packet');
  if(value.effect!=='haunt')throw new TypeError('local-vfx-unsupported');
  if(value.enabled!==true||typeof value.atmosphere!=='boolean'||!['system','normal','reduced'].includes(value.motion)
   ||!Number.isFinite(value.strength)||value.strength<0||value.strength>.6||!Number.isFinite(value.size)||value.size<40||value.size>200
   ||![value.width,value.height].every(n=>Number.isFinite(n)&&n>=1&&n<=32768)
   ||!Number.isSafeInteger(value.seed)||value.seed<0||value.seed>4294967295)throw new TypeError('local-vfx-invalid-packet');
  const target=point(value.target,value.width,value.height),start=Object.hasOwn(value,'start')?point(value.start,value.width,value.height):target;
  return freeze({id:value.id,enabled:true,effect:'haunt',strength:value.strength,atmosphere:value.atmosphere,size:value.size,motion:value.motion,width:value.width,height:value.height,target,start,seed:value.seed,localSmoke:true});
 }
 function create(options){
  if(!options?.canvas||!options.bridge||!['ready','done','onStart'].every(name=>typeof options.bridge[name]==='function')
   ||typeof options.texture?.create!=='function'||typeof options.fog?.create!=='function'
   ||!['createCanvas','viewport','now','raf','cancelRaf','schedule','unschedule','listen'].every(name=>typeof options[name]==='function'))throw new TypeError('local-vfx-capability-required');
  if(!options.loadImage&&!['createImage','decodeImage'].every(name=>typeof options[name]==='function'))throw new TypeError('local-vfx-image-capability-required');
  const canvas=options.canvas,ctx=canvas.getContext('2d');
  if(!ctx||!['save','restore','setTransform','clearRect'].every(name=>typeof ctx[name]==='function'))throw new TypeError('local-vfx-canvas-unavailable');
  let dead=false,initialized=false,ready=false,loadEpoch=0,requestToken=0,frameEntry=null,timer=null;
  let texture=null,fog=null,active=null,requested=null,startTime=0,lastDraw=-Infinity,bridgeUnsubscribe=null;
  let phase='new',dpr=1,viewport=null,readyCount=0,doneCount=0,renderCount=0,lastElapsed=0,lastError=null;
  const listeners=new Set(),imageJobs=new Set();
  function cleanJob(job){
   if(job.cleaned)return;job.cleaned=true;job.image.onload=job.image.onerror=null;
   try{job.image.removeAttribute('src');}catch(_){}imageJobs.delete(job);
  }
  function loadFixedImage(src){
   if(!ASSETS.has(src)||dead)return Promise.reject(new TypeError('local-vfx-assets-failed'));
   if(options.loadImage)return options.loadImage(src);
   return new Promise((resolve,reject)=>{
    const image=options.createImage(),job={image,cleaned:false,cancelled:false,settled:false,decoding:false};imageJobs.add(job);
    const fail=()=>{if(job.settled)return;job.settled=true;cleanJob(job);reject(new TypeError('local-vfx-assets-failed'));};
    job.cancel=()=>{job.cancelled=true;fail();};image.onerror=fail;
    image.onload=()=>{
     if(job.settled||job.decoding)return;job.decoding=true;image.onload=image.onerror=null;
     let decoding;try{decoding=options.decodeImage(image);}catch(_){fail();return;}
     Promise.resolve(decoding).then(bitmap=>{
      if(job.cancelled||dead||job.settled){try{bitmap?.close?.();}catch(_){}fail();return;}
      job.settled=true;cleanJob(job);resolve(bitmap);
     },fail);
    };
    // Only four fixed file images; no fetch, arbitrary URLs, or package HTML.
    image.src='../'+src;
   });
  }
  function clearOutput(){ctx.save();try{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);}finally{ctx.restore();}}
  function cancelFrame(){const entry=frameEntry;frameEntry=null;if(entry)options.cancelRaf(entry.handle);}
  function clearTimer(){if(timer!==null)options.unschedule(timer);timer=null;}
  function disposeResources(){
   loadEpoch++;for(const job of imageJobs)job.cancel();
   try{texture?.destroy();}catch(_){}texture=null;try{fog?.destroy();}catch(_){}fog=null;ready=false;
  }
  function destroy(notify=false){
   if(dead)return;const id=requested?.id||active?.id;
   dead=true;phase='destroyed';requestToken++;requested=active=null;cancelFrame();clearTimer();disposeResources();
   try{clearOutput();canvas.width=canvas.height=1;}catch(_){}
   try{bridgeUnsubscribe?.();}catch(_){}bridgeUnsubscribe=null;
   for(const remove of listeners){try{remove();}catch(_){}}listeners.clear();
   if(notify&&id){doneCount++;try{options.bridge.done(id);}catch(_){}}
   try{options.onDestroy?.();}catch(_){}
  }
  function failReady(){if(dead)return;lastError='local-vfx-assets-failed';destroy(false);readyCount++;try{options.bridge.ready(freeze({ok:false,error:'local-vfx-assets-failed'}));}catch(_){}}
  function resize(redraw=true){
   if(dead)return;const view=options.viewport();
   if(!view||![view.width,view.height].every(n=>Number.isFinite(n)&&n>=1&&n<=32768)||!Number.isFinite(view.dpr)||view.dpr<=0||view.dpr>8)throw new TypeError('local-vfx-viewport-invalid');
   viewport={width:view.width,height:view.height};dpr=Math.min(view.dpr,2,Math.sqrt(MAX_PIXELS/(Math.ceil(view.width)*Math.ceil(view.height))));
   const w=Math.max(1,Math.floor(view.width*dpr)),h=Math.max(1,Math.floor(view.height*dpr));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   canvas.style.width=view.width+'px';canvas.style.height=view.height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);
   if(active&&redraw)draw(lastElapsed);
  }
  function draw(elapsed){
   if(dead||!active||!texture||!fog)return;clearOutput();
   // Ambient fog follows the viewport; the actor's local-DIP origin never moves.
   fog.draw(ctx,{...active,width:viewport.width,height:viewport.height},elapsed);texture.render(ctx,active,elapsed);renderCount++;lastElapsed=elapsed;
  }
  function enqueueFrame(){
   if(dead||!active||frameEntry)return;const entry={token:requestToken,handle:null};frameEntry=entry;
   entry.handle=options.raf(now=>{
    if(dead||frameEntry!==entry||entry.token!==requestToken)return;frameEntry=null;
    try{
     if(!Number.isFinite(now))throw new Error();const elapsed=Math.max(0,now-startTime),fps=active.motion==='reduced'?12:30;
     if(elapsed>=DURATION){lastElapsed=DURATION;destroy(true);return;}
     if(now-lastDraw>=1000/fps){draw(elapsed);lastDraw=now;}enqueueFrame();
    }catch(_){lastError='local-vfx-render-failed';destroy(true);}
   });
  }
  function beginRequested(){
   if(dead||!ready||!requested||active?.id===requested.id)return;cancelFrame();
   const reduced=requested.motion==='reduced'||requested.motion==='system'&&!!options.reducedMotion?.();
   active=freeze({...requested,motion:reduced?'reduced':'normal'});phase='playing';startTime=options.now();lastDraw=-Infinity;lastElapsed=0;
   try{resize(false);draw(0);enqueueFrame();}catch(_){lastError='local-vfx-render-failed';destroy(true);}
  }
  function requestStart(value){
   if(dead)return;let packet;
   try{packet=validatePacket(value);}catch(error){
    lastError=error?.message==='local-vfx-unsupported'?'local-vfx-unsupported':'local-vfx-invalid-packet';
    const d=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'id'):null;
    if(d&&Object.hasOwn(d,'value')&&typeof d.value==='string'&&UUID.test(d.value)){
     // A rejected replacement never takes ownership of an accepted request.
     if(!requested&&!active)requested={id:d.value};destroy(true);
    }return;
   }
   if(requested?.id===packet.id)return;requested=packet;requestToken++;cancelFrame();beginRequested();
  }
  function initialize(){
   if(dead||initialized)return;initialized=true;phase='loading';const epoch=++loadEpoch;
   try{
    if(options.texture.metadata?.version!==RENDERER)throw new Error('local-vfx-renderer-mismatch');
    bridgeUnsubscribe=options.bridge.onStart(requestStart);if(typeof bridgeUnsubscribe!=='function')throw new Error();
    listeners.add(options.listen('resize',()=>{try{resize();}catch(_){lastError='local-vfx-render-failed';destroy(true);}}));
    listeners.add(options.listen('pagehide',()=>destroy(false)));listeners.add(options.listen('keydown',event=>{if(event?.key==='Escape')destroy(true);}));
    resize(false);texture=options.texture.create({createCanvas:options.createCanvas,loadImage:loadFixedImage});fog=options.fog.create({createCanvas:options.createCanvas});
    timer=options.schedule(failReady,8000);
    Promise.resolve(texture.load(DESCRIPTOR)).then(result=>{
     if(dead||epoch!==loadEpoch)return;if(result?.status!=='ready'){failReady();return;}
     clearTimer();ready=true;phase='ready';readyCount++;
     try{options.bridge.ready(freeze({ok:true,effect:'haunt',renderer:RENDERER,durationMs:DURATION}));}catch(_){destroy(false);return;}beginRequested();
    },failReady);
   }catch(_){failReady();}
  }
  function getDiagnostics(){return freeze({renderer:RENDERER,phase,destroyed:dead,ready,active:!!active,currentId:requested?.id||null,
   pendingImageJobs:imageJobs.size,rafCount:frameEntry?1:0,listeners:listeners.size,bridgeSubscribed:!!bridgeUnsubscribe,loadTimer:timer!==null,
   readyCount,doneCount,renderCount,lastElapsed,lastError,dpr,backingPixels:canvas.width*canvas.height,canvasWidth:canvas.width,canvasHeight:canvas.height,
   target:active?{x:active.target.x,y:active.target.y}:null,texture:texture?.getDiagnostics?.()||null,fog:fog?.getDiagnostics?.()||null});}
  return freeze({initialize,requestStart,destroy,getDiagnostics});
 }
 return freeze({create,validatePacket,descriptor:DESCRIPTOR,metadata:freeze({renderer:RENDERER,effect:'haunt',durationMs:DURATION,
  localOnly:true,defaultClosed:true,oldDemoFallback:false,maxBackingPixels:MAX_PIXELS,fixedAssetPaths:freeze([...ASSETS]),actorCoordinates:'original local DIP',ownsSingleRAF:true})});
});
