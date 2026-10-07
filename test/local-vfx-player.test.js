'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=path.join(__dirname,'../desktop/local-vfx-player.js'),source=fs.readFileSync(file,'utf8');
const sandbox={module:{exports:{}}};
for(const name of ['document','Image','fetch','requestAnimationFrame','setTimeout','addEventListener'])Object.defineProperty(sandbox,name,{get(){throw new Error('ambient '+name);}});
vm.runInNewContext(source,sandbox,{filename:file});const API=sandbox.module.exports;
const ID1='11111111-1111-4111-8111-111111111111',ID2='22222222-2222-4222-8222-222222222222';
const packet=(id=ID1)=>({id,enabled:true,effect:'haunt',strength:.35,atmosphere:true,size:100,motion:'normal',width:1280,height:720,target:{x:777.25,y:666.5},start:{x:10,y:20},seed:73});
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function bitmap(src){return{src,width:1254,height:1254,closes:0,close(){this.closes++;assert.equal(this.closes,1);}};}
function fixture(extra={}){
 const listeners=new Map(),frames=new Map(),history=new Map(),timers=new Map(),loaded=[],images=[],decoding=[],owned=[],draws=[],fogDraws=[],ready=[],done=[];
 let bridgeListener=null,clock=1000,serial=0,view={width:1280,height:720,dpr:1},destroyCalls=0;
 const ctx={matrix:[1,0,0,1,0,0],stack:[],calls:[],save(){this.stack.push([...this.matrix]);},restore(){assert(this.stack.length);this.matrix=this.stack.pop();},setTransform(...args){assert(args.every(Number.isFinite));this.matrix=args;},clearRect(...args){assert(args.every(Number.isFinite));this.calls.push(args);}};
 const canvas={width:1,height:1,style:{},getContext:kind=>{assert.equal(kind,'2d');return ctx;}};
 const texture={metadata:{version:'haunt-reference-texture-2'},create({loadImage}){
  const state={dead:false,bitmaps:new Set()};owned.push(state);
  return{load:descriptor=>Promise.all(descriptor.layers.map(layer=>loadImage(layer.src).then(image=>{if(state.dead)image.close();else state.bitmaps.add(image);}))).then(()=>({status:state.dead?'disposed':'ready'})),
   render(_ctx,config,elapsed){assert(!state.dead);draws.push({config,elapsed,matrix:[...ctx.matrix]});return{finished:elapsed>=7000};},
   destroy(){if(state.dead)return;state.dead=true;for(const image of state.bitmaps)image.close();state.bitmaps.clear();},
   getDiagnostics:()=>({ownedImages:state.bitmaps.size,destroyed:state.dead})};
 }};
 const fog={create(){const state={dead:false};owned.push(state);return{draw(_ctx,config,time){assert(!state.dead);fogDraws.push({config,time});},destroy(){state.dead=true;},getDiagnostics:()=>({layers:state.dead?0:3})};}};
 const opts={canvas,bridge:{onStart(callback){bridgeListener=callback;return()=>{bridgeListener=null;};},ready:value=>ready.push(clone(value)),done:id=>done.push(id)},texture,fog,
  createCanvas:()=>({}),viewport:()=>view,reducedMotion:()=>false,now:()=>clock,
  raf:callback=>{const id=++serial;frames.set(id,callback);history.set(id,callback);return id;},cancelRaf:id=>frames.delete(id),
  schedule:(callback,ms)=>{const id=++serial;timers.set(id,{callback,ms});return id;},unschedule:id=>timers.delete(id),
  listen:(name,callback)=>{listeners.set(name,callback);return()=>listeners.delete(name);},onDestroy:()=>destroyCalls++,
  loadImage:async src=>{loaded.push(src);const image=bitmap(src);images.push(image);return image;},...extra};
 if(extra.useDOM){delete opts.useDOM;delete opts.loadImage;
  opts.createImage=()=>{const image={onload:null,onerror:null,removed:0,removeAttribute(name){assert.equal(name,'src');this.removed++;}};images.push(image);return image;};
  opts.decodeImage=image=>{const d=deferred();decoding.push({image,d});return d.promise;};
 }
 const session=API.create(opts);
 return{session,ctx,canvas,ready,done,draws,fogDraws,frames,history,timers,listeners,loaded,images,decoding,owned,
  get destroyCalls(){return destroyCalls;},get bridgeListener(){return bridgeListener;},
  setView:value=>{view=value;},start:value=>bridgeListener?.(value),event:(name,value)=>listeners.get(name)?.(value),
  frame(now,id=[...frames.keys()][0]){clock=now;const callback=frames.get(id);assert(callback,'pending frame');frames.delete(id);callback(now);},
  forceFrame:(id,now)=>history.get(id)?.(now),timeout(){const entry=[...timers.values()][0];assert(entry);entry.callback();}};
}

test('module evaluation uses no ambient DOM, IO or loops; explicit APIs are frozen',()=>{
 assert(Object.isFrozen(API));assert.equal(API.metadata.oldDemoFallback,false);assert.equal(API.metadata.defaultClosed,true);
 assert.equal(API.metadata.durationMs,7000);assert.equal(API.metadata.fixedAssetPaths.length,4);
 assert.throws(()=>API.create({}),/capability-required/);
});
test('native descriptor names exactly the validated 4 PNGs and carries original source offsets',()=>{
 assert.equal(API.descriptor.canvas.width,1254);assert.equal(API.descriptor.anchors.ground.x,666);assert.equal(API.descriptor.anchors.neck.x,624);
 assert.equal(API.descriptor.eyeMode,'intrinsic');assert(API.metadata.fixedAssetPaths.every(p=>p.startsWith('skins/tracer/local-vfx/haunt-art/fade-v1/')&&p.endsWith('.png')));
});
test('native typed descriptor and renderer version match the public renderer contract',()=>{
 const referenceRoot=process.env.DOCS_PORTAL_REFERENCE_ROOT||path.join(__dirname,'..');
 const renderer=require(path.join(referenceRoot,'desktop/local-vfx-haunt-texture.js'));
 assert.equal(API.metadata.renderer,renderer.metadata.version);assert.equal(renderer.metadata.usesGeometryHead,false);
 assert.equal(API.metadata.durationMs,renderer.durationMs);
});
test('optional local reference artwork descriptor matches the native typed descriptor',t=>{
 const referenceRoot=process.env.DOCS_PORTAL_REFERENCE_ROOT||path.join(__dirname,'..');
 const file=path.join(referenceRoot,'skins/tracer/local-vfx/haunt-art/fade-v1/runtime-descriptor.json');
 if(!fs.existsSync(file)){t.skip('Private reference artwork is not included in public source checkouts');return;}
 assert.deepEqual(clone(API.descriptor),JSON.parse(fs.readFileSync(file,'utf8')));
});
test('packet validation copies exact local DIP origin without launch, re-centering or viewport clamp',()=>{
 const raw=packet(),value=API.validatePacket(raw);assert.equal(value.target.x,777.25);assert.equal(value.target.y,666.5);assert.equal(value.start.x,10);
 assert(Object.isFrozen(value.target));raw.target.x=1;assert.equal(value.target.x,777.25);
 const edge=packet();edge.target={x:0,y:720};assert.equal(API.validatePacket(edge).target.x,0);assert.equal(API.validatePacket(edge).target.y,720);
 const fractional=packet();fractional.width=1280.5;assert.equal(API.validatePacket(fractional).width,1280.5);
});
test('packet rejects arbitrary files, URLs, old Leer, malformed numeric schema and accessors without executing them',()=>{
 for(const mutate of [p=>p.url='file:///secret',p=>p.file='C:\\a.png',p=>p.effect='leer',p=>p.width=NaN,p=>p.height=0,
  p=>p.target.x=-1,p=>p.target.y=721,p=>p.target.x=Infinity,p=>p.motion='fast',p=>p.strength=.7,p=>p.seed=1.2,p=>p.id='-'.repeat(36),p=>p.enabled=false,
  p=>p.atmosphere='yes',p=>p.target.url='https://host',p=>p[Symbol('extra')]=1]){
  const raw=packet();mutate(raw);assert.throws(()=>API.validatePacket(raw),/local-vfx-(invalid-packet|unsupported)/);
 }
 let reads=0;const raw=packet();Object.defineProperty(raw,'target',{get(){reads++;throw new Error();}});assert.throws(()=>API.validatePacket(raw),/invalid-packet/);assert.equal(reads,0);
 class Foreign{constructor(){Object.assign(this,packet());}}assert.throws(()=>API.validatePacket(new Foreign()),/invalid-packet/);
});
test('all assets are ready before one exact ready handshake; nothing plays without a start',async()=>{
 const f=fixture();f.session.initialize();f.session.initialize();assert.equal(f.ready.length,0);assert.equal(f.draws.length,0);await tick();
 assert.deepEqual(f.ready,[{ok:true,effect:'haunt',renderer:'haunt-reference-texture-2',durationMs:7000}]);
 assert.equal(f.loaded.length,4);assert.equal(f.frames.size,0);assert.equal(f.session.getDiagnostics().ready,true);assert.equal(f.timers.size,0);f.session.destroy();
});
test('renderer metadata mismatch fails closed before loading assets or registering a start handler',()=>{
 let creates=0;const f=fixture({texture:{metadata:{version:'haunt-reference-texture-1'},create(){creates++;throw new Error();}}});
 f.session.initialize();assert.deepEqual(f.ready,[{ok:false,error:'local-vfx-assets-failed'}]);assert.equal(creates,0);
 assert.equal(f.loaded.length,0);assert.equal(f.bridgeListener,null);assert.equal(f.listeners.size,0);assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);
 assert.equal(f.session.getDiagnostics().destroyed,true);
});
test('two early start requests queue only the newest until readiness and preserve its selected origin',async()=>{
 const waiting=[];const f=fixture({loadImage:src=>{const d=deferred();waiting.push({src,d});return d.promise;}});f.session.initialize();
 f.start(packet());const latest=packet(ID2);latest.target={x:50.5,y:100.25};f.start(latest);assert.equal(f.frames.size,0);assert.equal(f.draws.length,0);
 for(const{src,d}of waiting)d.resolve(bitmap(src));await tick();
 assert.equal(f.frames.size,1);assert.equal(f.session.getDiagnostics().currentId,ID2);assert(f.draws.every(row=>row.config.target.x===50.5&&row.config.target.y===100.25));f.session.destroy();
});
test('duplicate start id is ignored and replacement has a single RAF; a cancelled old callback cannot clobber it',async()=>{
 const f=fixture();f.session.initialize();await tick();f.start(packet());const old=[...f.frames.keys()][0];
 f.start(packet());assert.equal([...f.frames.keys()][0],old);f.start(packet(ID2));const newer=[...f.frames.keys()][0];assert.notEqual(newer,old);assert.equal(f.frames.size,1);
 const before=f.draws.length;f.forceFrame(old,1200);assert.equal(f.draws.length,before);assert.equal(f.session.getDiagnostics().rafCount,1);assert.equal(f.frames.size,1);
 f.frame(1200,newer);assert.equal(f.frames.size,1);assert.equal(f.session.getDiagnostics().currentId,ID2);assert.equal(f.done.length,0);f.session.destroy();
});
test('7000ms normal completion emits done once after clearing RAF, listeners, owned bitmaps and canvas',async()=>{
 const f=fixture();f.session.initialize();await tick();f.start(packet());f.frame(7999);const last=[...f.frames.keys()][0];f.frame(8000,last);
 assert.deepEqual(f.done,[ID1]);assert.equal(f.frames.size,0);assert.equal(f.listeners.size,0);assert.equal(f.bridgeListener,null);assert.equal(f.timers.size,0);
 assert(f.images.every(image=>image.closes===1));assert(f.owned.every(state=>state.dead));assert.equal(f.canvas.width,1);assert.equal(f.canvas.height,1);
 f.forceFrame(last,9000);f.session.destroy(true);assert.equal(f.done.length,1);assert.equal(f.destroyCalls,1);assert.equal(f.session.getDiagnostics().lastElapsed,7000);
});
test('window Escape cancels and destroys once; pagehide does not send an extra done',async()=>{
 const f=fixture();f.session.initialize();await tick();f.start(packet());f.event('keydown',{key:'Escape'});
 assert.deepEqual(f.done,[ID1]);assert.equal(f.frames.size,0);assert.equal(f.listeners.size,0);f.event('pagehide');assert.equal(f.done.length,1);assert.equal(f.destroyCalls,1);
});
test('pagehide cancellation cleans the instance without notifying a parent that already closed it',async()=>{
 const f=fixture();f.session.initialize();await tick();f.start(packet());f.event('pagehide');assert.equal(f.done.length,0);assert.equal(f.frames.size,0);assert(f.images.every(image=>image.closes===1));
});
test('backing DPR changes repaint immediately but never convert or relocate the original local DIP origin',async()=>{
 const f=fixture();f.session.initialize();await tick();f.start(packet());f.frame(1200);
 for(const dpr of [1,1.25,1.5,2]){const before=f.draws.length;f.setView({width:1280,height:720,dpr});f.event('resize');
  assert.equal(f.draws.length,before+1);const draw=f.draws.at(-1);assert.equal(draw.config.target.x,777.25);assert.equal(draw.config.target.y,666.5);
  assert.equal(draw.elapsed,200);assert.equal(draw.matrix[0],dpr);assert.equal(draw.matrix[3],dpr);assert.equal(f.frames.size,1);
 }
 f.setView({width:1100,height:700,dpr:1.25});f.event('resize');assert.equal(f.draws.at(-1).config.width,1280);assert.equal(f.draws.at(-1).config.target.y,666.5);
 assert.equal(f.fogDraws.at(-1).config.width,1100);assert.equal(f.ctx.stack.length,0);f.session.destroy();
});
test('large viewport DPR is bounded by the backing pixel budget and leaves target coordinates unchanged',async()=>{
 const f=fixture();f.setView({width:7680,height:4320,dpr:2});f.session.initialize();await tick();f.start(packet());
 assert(f.canvas.width*f.canvas.height<=12000000);assert.equal(f.draws.at(-1).config.target.x,777.25);assert(f.session.getDiagnostics().dpr<1);f.session.destroy();
});
test('system reduced motion uses the reduced path without changing readiness or duration',async()=>{
 const f=fixture({reducedMotion:()=>true});f.session.initialize();await tick();const p=packet();p.motion='system';f.start(p);
 assert.equal(f.draws.at(-1).config.motion,'reduced');const first=f.draws.length;f.frame(1016);assert.equal(f.draws.length,first+1);f.frame(1050);assert.equal(f.draws.length,first+1);f.frame(1110);assert.equal(f.draws.length,first+2);f.session.destroy();
});
test('failed asset loading sends only the fixed failed-ready payload and disposes partial engines',async()=>{
 const f=fixture({loadImage:src=>src.endsWith('core-v1.png')?Promise.reject(new Error('private failure detail')):Promise.resolve(bitmap(src))});f.session.initialize();await tick();
 assert.deepEqual(f.ready,[{ok:false,error:'local-vfx-assets-failed'}]);assert.equal(f.draws.length,0);assert(f.owned.every(state=>state.dead));assert.equal(f.listeners.size,0);assert.equal(f.session.getDiagnostics().lastError,'local-vfx-assets-failed');
});
test('load timeout never marks ready; later assets cannot resurrect the disposed renderer',async()=>{
 const waiting=[];const f=fixture({loadImage:src=>{const d=deferred();waiting.push({src,d});return d.promise;}});f.session.initialize();assert.equal([...f.timers.values()][0].ms,8000);f.timeout();
 assert.deepEqual(f.ready,[{ok:false,error:'local-vfx-assets-failed'}]);const late=[];for(const{src,d}of waiting){const image=bitmap(src);late.push(image);d.resolve(image);}await tick();
 assert(late.every(image=>image.closes===1));assert.equal(f.ready.length,1);assert.equal(f.frames.size,0);assert.equal(f.listeners.size,0);
});
test('native DOM image loader uses only the four relative file paths; handlers and bitmaps release on success',async()=>{
 const f=fixture({useDOM:true});f.session.initialize();assert.equal(f.images.length,4);
 assert(f.images.every(image=>image.src.startsWith('../skins/tracer/local-vfx/haunt-art/fade-v1/')&&image.src.endsWith('.png')));
 for(const image of f.images)image.onload();assert.equal(f.decoding.length,4);const bitmaps=[];for(const{image,d}of f.decoding){const b=bitmap(image.src);bitmaps.push(b);d.resolve(b);}await tick();
 assert.equal(f.ready[0].ok,true);assert.equal(f.session.getDiagnostics().pendingImageJobs,0);assert(f.images.every(image=>image.onload===null&&image.onerror===null&&image.removed===1));
 f.session.destroy();assert(bitmaps.every(image=>image.closes===1));
});
test('DOM decoder resolution after cancellation closes each late bitmap and cannot send ready',async()=>{
 const f=fixture({useDOM:true});f.session.initialize();for(const image of f.images)image.onload();f.session.destroy();
 assert.equal(f.session.getDiagnostics().pendingImageJobs,0);const late=[];for(const{image,d}of f.decoding){const b=bitmap(image.src);late.push(b);d.resolve(b);}await tick();
 assert(late.every(image=>image.closes===1));assert.equal(f.ready.length,0);assert.equal(f.frames.size,0);
});
test('unsupported Leer is rejected with no old art render or fallback even after preload readiness',async()=>{
 const f=fixture();f.session.initialize();await tick();const p=packet();p.effect='leer';f.start(p);
 assert.equal(f.draws.length,0);assert.deepEqual(f.done,[ID1]);assert.equal(f.session.getDiagnostics().lastError,'local-vfx-unsupported');assert.equal(f.frames.size,0);
});
test('malformed unknown-id request cannot invoke done; a valid-id invalid request is safely terminated',async()=>{
 const f=fixture();f.session.initialize();await tick();f.start({id:'not-an-id'});assert.equal(f.done.length,0);assert.equal(f.session.getDiagnostics().destroyed,false);
 const bad=packet();bad.target.x=NaN;f.start(bad);assert.deepEqual(f.done,[ID1]);assert.equal(f.draws.length,0);
});
test('invalid replacement terminates the last accepted active request, never taking its completion id',async()=>{
 const f=fixture();f.session.initialize();await tick();f.start(packet());const old=[...f.frames.keys()][0];
 const bad=packet(ID2);bad.target.x=NaN;f.start(bad);
 assert.deepEqual(f.done,[ID1]);assert.equal(f.frames.size,0);assert.equal(f.listeners.size,0);assert.equal(f.bridgeListener,null);
 assert.equal(f.session.getDiagnostics().lastError,'local-vfx-invalid-packet');assert(f.images.every(image=>image.closes===1));
 const count=f.draws.length;f.forceFrame(old,1200);assert.equal(f.draws.length,count);assert.equal(f.done.length,1);
});
test('invalid replacement while loading preserves the accepted queued id and closes late assets',async()=>{
 const waiting=[];const f=fixture({loadImage:src=>{const d=deferred();waiting.push({src,d});return d.promise;}});
 f.session.initialize();f.start(packet());const bad=packet(ID2);bad.effect='leer';f.start(bad);
 assert.deepEqual(f.done,[ID1]);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
 const late=[];for(const{src,d}of waiting){const image=bitmap(src);late.push(image);d.resolve(image);}await tick();
 assert(late.every(image=>image.closes===1));assert.equal(f.ready.length,0);assert.equal(f.done.length,1);
});
test('after destroy, saved bridge callbacks cannot restart or allocate resources',async()=>{
 const f=fixture();f.session.initialize();await tick();const saved=f.bridgeListener;f.session.destroy();saved(packet());f.session.initialize();
 assert.equal(f.loaded.length,4);assert.equal(f.ready.length,1);assert.equal(f.frames.size,0);assert.equal(f.session.getDiagnostics().listeners,0);
});
test('preload exposes only fixed ready/start/done channels and an idempotent unsubscribe',()=>{
 const sends=[],events=new Map();let api;
 const preload=fs.readFileSync(path.join(__dirname,'../desktop/local-vfx-preload.js'),'utf8');
 vm.runInNewContext(preload,{process:{isMainFrame:true},require:name=>{assert.equal(name,'electron');return{contextBridge:{exposeInMainWorld(name,value){assert.equal(name,'LocalVfxPlayer');api=value;}},ipcRenderer:{send:(...args)=>sends.push(args),on:(name,callback)=>events.set(name,callback),removeListener:(name,callback)=>{if(events.get(name)===callback)events.delete(name);}}};}});
 api.ready({ok:true,effect:'haunt',renderer:'haunt-reference-texture-2',durationMs:7000});api.ready({ok:false,error:'local-vfx-assets-failed'});api.ready({ok:true,effect:'leer',renderer:'old',durationMs:3300});
 api.ready({ok:true,effect:'haunt',renderer:'haunt-reference-texture-1',durationMs:7000});
 assert.equal(sends.length,2);assert(sends.every(row=>row[0]==='tracer-local-vfx-ready'));api.done(ID1);api.done('-'.repeat(36));assert.equal(sends.length,3);
 let starts=0;const remove=api.onStart(()=>starts++),saved=events.get('tracer-local-vfx-start');saved({},packet());assert.equal(starts,1);remove();remove();saved({},packet());assert.equal(starts,1);assert.equal(events.size,0);
});
test('native page allows only same-origin image loading and contains no rejected old-art scripts',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../desktop/local-vfx.html'),'utf8');assert(html.includes("img-src 'self'"));assert(html.includes("connect-src 'none'"));
 assert(!html.includes('local-vfx-art.js'));assert(!html.includes('local-vfx-haunt-smoke.js'));assert(!html.includes("'unsafe-inline'"));assert(html.includes('local-vfx-haunt-texture.js'));
});
