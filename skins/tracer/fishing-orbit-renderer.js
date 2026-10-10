(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./fishing-orbit-art'):root.TracerFishingOrbitArt||{});if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingOrbitRenderer=api;})(typeof globalThis!=='undefined'?globalThis:this,function(art){
  'use strict';
  const caches=new WeakMap(),TAU=Math.PI*2,clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
  function asset(id){return art[id]||{src:'/fishing-art/orbit-prestige-'+id+'-v2.png',width:512,height:512,cells:[[0,0,256,256],[256,0,256,256],[0,256,256,256],[256,256,256,256]]};}
  function request(id,doc){
    let cache=caches.get(doc);if(!cache){cache=new Map();caches.set(doc,cache);}if(cache.has(id)){const e=cache.get(id);cache.delete(id);cache.set(id,e);return e;}
    const image=new (doc.defaultView||globalThis).Image(),entry={image,ready:false,error:false,promise:null};image.decoding='async';entry.promise=new Promise(resolve=>{const fail=()=>{entry.error=true;resolve(entry);};image.onload=async()=>{try{if(image.decode)await image.decode();entry.ready=true;resolve(entry);}catch(_){fail();}};image.onerror=fail;});image.src=asset(id).src;cache.set(id,entry);while(cache.size>6)cache.delete(cache.keys().next().value);return entry;
  }
  function preload(rod,doc){return rod?.rarity==='legendary'&&doc?request(rod.id,doc).promise:Promise.resolve(null);}
  function sprite(ctx,image,id,cell,x,y,size,angle=0,squash=1){const a=asset(id),[sx,sy,sw,sh]=a.cells[cell],factor=size*2/Math.max(sw,sh);ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(squash,1);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(image,sx,sy,sw,sh,-sw*factor/2,-sh*factor/2,sw*factor,sh*factor);ctx.restore();}
  function signatureParts(q,id){
    if(!q||q.alpha===0)return[];const t=q.turn,s=q.scale,r=q.quiet?.66:1,hero=(x,y,size,angle=0,depth=1,cell=3)=>({x:q.x+x*s,y:q.y+y*s,size:size*s*r,angle,depth,cell});
    if(q.kind==='treasury')return[hero(-28,-2-Math.sin(t*2)*3,20,-.12),hero(20,12,11,t,Math.sin(t),2)];
    if(q.kind==='singularity')return[hero(-24,-3,22,-t*.32,-1),...[0,1,2].map(i=>{const a=-t*2+i*TAU/3;return hero(Math.cos(a)*(22+q.open*5)-24,Math.sin(a)*13-3,8,a,Math.sin(a),1);})];
    if(q.kind==='clones')return[hero(-29,-8,21,Math.sin(t)*.07,-1),...[0,1,2].map(i=>{const a=t+i*TAU/3;return hero(Math.cos(a)*27,Math.sin(a)*12+11,10,-.1,Math.sin(a),1);})];
    if(q.kind==='mandate')return[hero(-28,-4,23,-.12+Math.sin(t)*.04,1)];
    if(q.kind==='truth_orbs')return[hero(-31,-4,21,Math.sin(t)*.04,-1)];
    if(q.kind==='liberation'){const beat=1+.04*Math.sin(t*14)**8;return[hero(-29,-4-Math.sin(t*3)*2,23*beat,Math.sin(t)*.06,-1),hero(24,12,10,-.2,1,1)];}
    if(q.kind==='radianite')return[hero(-25,-3,20,-t*.25,-1),...[0,1,2].map(i=>{const a=t+i*TAU/3;return hero(Math.cos(a)*(18+q.open*8),Math.sin(a)*11,9,a,Math.sin(a),1);})];
    return[];
  }
  function create(stage,design){
    if(!stage?.ownerDocument?.createElement)return null;const doc=stage.ownerDocument,win=doc.defaultView||globalThis;
    const layers=['back','front'].map(depth=>{const canvas=doc.createElement('canvas');canvas.className='fishing-prestige-layer fishing-prestige-'+depth;canvas.setAttribute('aria-hidden','true');stage.appendChild(canvas);return{canvas,ctx:canvas.getContext('2d',{alpha:true}),front:depth==='front'};});
    let last=-Infinity,key='',disposed=false,entry=null,transition=1;
    function draw(rod,time,g,phase,age,reduced=false,opacity=1,values={}){
      if(disposed||!g?.curve)return;const spec=design.get(rod?.id),next=spec&&rod.rarity==='legendary'?rod.id:'';const changed=next!==key;
      if(!changed&&time-last<1000/30-1)return;
      const dt=Math.min(100,Math.max(0,time-last));last=time;key=next;if(changed){entry=next?request(next,doc):null;transition=1;}
      const quiet=phase==='reeling'||phase==='bite';transition=transition+((quiet?.72:1)-transition)*(reduced?1:1-Math.exp(-dt/150));
      let visible=!!next&&opacity>.03&&!(phase==='escaped'&&age>=600)&&!(phase==='caught'&&age>=2000);
      if(next==='valorant_spike'){
        const size=Math.max(26,Math.min(66,g.width*.145,g.height*.23)),grip=g.grip||g.curve(0),water=g.water||{x:g.width*.7,y:g.height*.6};let x=grip.x,y=grip.y-size*.55;
        if(phase==='charging')y-=(reduced?0:clamp(values.castPower))*size*.25;
        if(phase==='cast'){const u=clamp(age/650),p=u*u*u*(10+u*(-15+6*u));x=grip.x+(water.x-grip.x)*p;y=grip.y-size*.55+(water.y-grip.y+size*.24)*p-(reduced?0:Math.sin(Math.PI*u)*Math.min(g.height*.26,110));}
        if(['waiting','detonating','caught'].includes(phase)){x=water.x;y=water.y-size*.4;}
        if(phase==='detonating'&&age>150)visible=false;
        g={...g,curve:u=>({x:x+(u-.5)*24,y:y-(u-.5)*24})};
      }
      const points=visible?design.field(rod,time,g,phase,age,reduced):[],sig=visible?design.signature(rod,time,g,phase,age,reduced):null,dpr=Math.min(2,win.devicePixelRatio||1);
      for(const {canvas,ctx,front}of layers){canvas.hidden=!visible;if(!ctx||!visible)continue;const width=Math.ceil(g.width*dpr),height=Math.ceil(g.height*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,g.width,g.height);ctx.globalAlpha=1;ctx.save();ctx.beginPath();ctx.rect(0,0,Math.max(1,g.width-42),g.height);ctx.clip();canvas.dataset.theme=next;canvas.dataset.signature=spec.signature||'';canvas.dataset.art=entry?.ready?'imagegen':'loading';canvas.dataset.opacity='solid';
        if(entry?.ready){
          for(const q of signatureParts(sig&&{...sig,quiet},next)){if((q.depth>=0)!==front)continue;sprite(ctx,entry.image,next,q.cell,q.x,q.y,q.size*transition,q.angle);}
          for(const p of points){if((p.depth>=0)!==front)continue;const cell=['anime_sixpaths','wukong','emperorjade','anime_nika','valorant_spike'].includes(next)?0:p.index%3;const turn=next==='anime_sixpaths'?0:Math.sin(p.angle)*.22+p.angle*.12;sprite(ctx,entry.image,next,cell,p.x,p.y,p.size*transition,turn,.86+.14*(p.depth+1)/2);}
        }
        ctx.restore();
      }
    }
    return{draw,destroy(){disposed=true;entry=null;for(const l of layers){l.canvas.width=l.canvas.height=1;l.canvas.remove();}}};
  }
  function markupSprite(id,cell,size){const a=asset(id),[x,y,w,h]=a.cells[cell];return '<svg x="'+(-size)+'" y="'+(-size)+'" width="'+(size*2)+'" height="'+(size*2)+'" viewBox="'+[x,y,w,h].join(' ')+'" overflow="hidden" preserveAspectRatio="xMidYMid meet"><image href="'+a.src+'" width="'+a.width+'" height="'+a.height+'"/></svg>';}
  function catalogMarkup(rod,id,curve,theme,liveColor,design){
    const spec=design.get(rod?.id);if(!spec||rod.rarity!=='legendary')return'';const g={width:380,height:418,curve},sprites=design.field(rod,1800,g,'idle',0,false),out=[];
    if(rod.id==='valorant_spike'){
      // The folded device has no rod spine: orbit its actual portrait bounds.
      for(let i=0;i<3;i++){const path=[];for(let j=0;j<=64;j++){const a=j/64*TAU+i*TAU/3;path.push((j?'L':'M')+(125.4+Math.cos(a)*105).toFixed(2)+' '+(209+Math.sin(a)*120).toFixed(2));}out.push('<g class="fishing-prestige-orbit" style="offset-path:path(\''+path.join(' ')+'\');offset-rotate:0deg;--prestige-duration:18s">'+markupSprite(rod.id,i,15)+'</g>');}
      out.push('<g transform="translate(125.4 66)"><g class="fishing-prestige-signature" data-signature="radianite">'+markupSprite(rod.id,3,25)+'</g></g>');
      return '<g class="fishing-catalog-fx fishing-catalog-fluid fishing-prestige-catalog" data-fx-theme="valorant_spike" data-fx-variant="valorant_spike" data-prestige-signature="radianite" data-prestige-art="imagegen" aria-hidden="true">'+out.join('')+'</g>';
    }
    for(const p of sprites){const path=[],duration=(TAU/Math.abs(spec.speed)).toFixed(2);for(let j=0;j<=48;j++){const t=j/48*TAU/Math.abs(spec.speed)*1000,point=design.field(rod,t,g,'idle',0,false)[p.index];path.push((j?'L':'M')+point.x.toFixed(2)+' '+point.y.toFixed(2));}const cell=['anime_sixpaths','wukong','emperorjade','anime_nika','valorant_spike'].includes(rod.id)?0:p.index%3;out.push('<g class="fishing-prestige-orbit" style="offset-path:path(\''+path.join(' ')+'\');offset-rotate:0deg;--prestige-duration:'+duration+'s;--prestige-delay:-'+(p.index*.47).toFixed(2)+'s">'+markupSprite(rod.id,cell,p.size)+'</g>');}
    if(spec.signature){const c=curve(.48);out.push('<g transform="translate('+(c.x-30)+' '+(c.y-5)+')"><g class="fishing-prestige-signature" data-signature="'+spec.signature+'">'+markupSprite(rod.id,3,23)+'</g></g>');}
    return '<g class="fishing-catalog-fx fishing-catalog-fluid fishing-prestige-catalog" data-fx-theme="'+(theme||spec.motif)+'" data-fx-variant="'+rod.id+'" data-prestige-signature="'+(spec.signature||'')+'" data-prestige-art="imagegen" aria-hidden="true">'+out.join('')+'</g>';
  }
  return Object.freeze({asset,preload,create,catalogMarkup,signatureParts});
});
