(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./fishing-vfx-tween'):root.TracerFishingVFXTween);if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingPaintedVFX=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Tween){
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,Number(x)||0)),mix=(a,b,t)=>a+(b-a)*t,smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
  const moving=new Set(['projectile','beam','orb','bird','volley','double','triple','dragon','punch','threads','teleport','thrust','creature','leaf','ribbon','wind','flame']);
  // Wrist sockets in each original cel: x, y and full wrist diameter, normalized
  // to a cell. The same sockets constrain background morphing and arm geometry.
  const wrists={
    anime_luffy:[[.17,.575,.225],[.18,.585,.230],[.18,.593,.235],[.17,.538,.228],[.14,.526,.223],[.11,.527,.220]],
    anime_nika:[[.36,.565,.213],[.36,.565,.220],[.36,.557,.214],[.36,.511,.203],[.34,.514,.207],[.35,.556,.219]]
  };
  function socket(id,frame){const keys=wrists[id]||wrists.anime_luffy,a=Math.min(5,Math.floor(frame)),b=Math.min(5,a+1),t=clamp(frame-a);return keys[a].map((v,i)=>mix(v,keys[b][i],t));}
  function wrist(id,q){const [u,v,width]=socket(id,q.frame),dx=(u-.5)*q.size*q.scale,dy=(v-.5)*q.size*q.scale,c=Math.cos(q.rotation),s=Math.sin(q.rotation);return{x:q.x+dx*c-dy*s,y:q.y+dx*s+dy*c,width:width*q.size*q.scale};}
  function armGeometry(id,q,tip,quiet){
    const end=wrist(id,q),length=Math.hypot(end.x-tip.x,end.y-tip.y),c=Math.cos(q.rotation),s=Math.sin(q.rotation),bend=quiet?0:Math.sin(q.progress*Math.PI)*Math.min(9,length*.04),handle=Math.min(length*.36,32);
    const p1={x:tip.x+(end.x-tip.x)*.32-s*bend,y:tip.y+(end.y-tip.y)*.32+c*bend},p2={x:end.x-c*handle,y:end.y-s*handle},left=[],right=[],shade=[];
    const root=Math.min(end.width*.45,Math.max(2,end.width*.29));
    for(let i=0;i<=24;i++){
      const t=i/24,u=1-t,x=u*u*u*tip.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*end.x,y=u*u*u*tip.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*end.y;
      const dx=3*u*u*(p1.x-tip.x)+6*u*t*(p2.x-p1.x)+3*t*t*(end.x-p2.x),dy=3*u*u*(p1.y-tip.y)+6*u*t*(p2.y-p1.y)+3*t*t*(end.y-p2.y),d=Math.hypot(dx,dy),nx=d>1e-9?-dy/d:-s,ny=d>1e-9?dx/d:c,r=mix(root,end.width*.5,smooth(t));
      left.push({x:x-nx*r,y:y-ny*r});right.push({x:x+nx*r,y:y+ny*r});shade.push({x:x+nx*r*.48,y:y+ny*r*.48});
    }
    return{end,length,left,right,shade};
  }
  function drawArm(ctx,id,q,tip,quiet){
    const rig=armGeometry(id,q,tip,quiet);if(rig.length<1)return rig;
    const path=points=>{ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);};
    ctx.globalAlpha=q.alpha;path([...rig.left,...rig.right.slice().reverse()]);ctx.closePath();ctx.fillStyle=id==='anime_nika'?'#ffdcaf':'#f6b37d';ctx.fill();
    path([...rig.shade,...rig.right.slice().reverse()]);ctx.closePath();ctx.fillStyle=id==='anime_nika'?'#dfa086':'#b87954';ctx.fill();
    ctx.lineWidth=Math.max(.48,q.size*q.scale*.007);ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#38251e';
    // Only the sides are inked: a transverse end-cap would draw a seam through
    // the painted wrist. The hand is composited over this short overlap.
    path(rig.left);ctx.stroke();path(rig.right);ctx.stroke();return rig;
  }
  function createCollection(specs,renderer){
    const documents=new WeakMap(),durations=Object.freeze({cast:680,bite:300,caught:820,summon:1050});
    const has=id=>Object.hasOwn(specs,id),duration=(id,phase)=>specs[id]?.motion==='rubber'&&phase==='caught'?1940:durations[phase]||0;
    const visible=(phase,age,id)=>has(id)&&Number.isFinite(age)&&age>=0&&age<duration(id,phase);
    function surface(doc,image){
      const c=doc.createElement('canvas');c.width=768;c.height=512;const ctx=c.getContext('2d');ctx.drawImage(image,0,0,c.width,c.height);
      ctx.globalCompositeOperation='destination-in';
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const x=col*256,y=row*256;ctx.save();ctx.beginPath();ctx.rect(x,y,256,256);ctx.clip();
        for(const vertical of [false,true]){const gradient=ctx.createLinearGradient(x,y,vertical?x:x+256,vertical?y+256:y);gradient.addColorStop(0,'#fff0');gradient.addColorStop(.075,'#fff');gradient.addColorStop(.925,'#fff');gradient.addColorStop(1,'#fff0');ctx.fillStyle=gradient;ctx.fillRect(x,y,256,256);}ctx.restore();
      }return c;
    }
    function cache(doc){let m=documents.get(doc);if(!m){m=new Map();documents.set(doc,m);}return m;}
    function load(doc,id){
      if(!doc||!has(id))return Promise.resolve(null);const m=cache(doc);
      if(m.has(id)){const r=m.get(id);m.delete(id);m.set(id,r);return r.promise;}
      const r={entry:null,promise:null};m.set(id,r);
      r.promise=new Promise(resolve=>{const ImageClass=doc.defaultView?.Image;if(!ImageClass){resolve(null);return;}const image=new ImageClass();image.onload=async()=>{try{r.entry={image:surface(doc,image),width:256,height:256,joints:wrists[id]};}catch(_){r.entry=null;}if(r.entry)await Tween?.prepare(doc,r.entry.image,r.entry);resolve(r.entry);};image.onerror=()=>resolve(null);image.src=specs[id].src+'?v='+specs[id].revision;});
      while(m.size>8)m.delete(m.keys().next().value);return r.promise;
    }
    function get(doc,id){return documents.get(doc)?.get(id)?.entry||null;}
    function pose(id,phase,age,g,tip,point,quiet=false,energy=1){
      if(!visible(phase,age,id))return null;
      const spec=specs[id],t=clamp(age/duration(id,phase)),p=quiet?.53:t,hit=phase==='caught'?point:g.water||point;
      const r=Math.max(16,Math.min(50,g.width*.12,g.height*.18))*(phase==='bite'?.60:1)*(quiet?.72:1),angle=Math.atan2(hit.y-tip.y,hit.x-tip.x),release=smooth((p-.17)/.37),settle=smooth((p-.67)/.33),kind=spec.motion;
      let x=hit.x,y=hit.y,rotation=0,scale=.78+.22*release,frame=p*5,alpha=smooth(t/.085)*(1-smooth((t-.76)/.24))*clamp(energy)*(quiet?.7:1),size=r*2.3;
      if(moving.has(kind)){
        const travel=r*(kind==='thrust'?1.5:1.05)*(1-release);x-=Math.cos(angle)*travel;y-=Math.sin(angle)*travel;rotation=angle;
        if(['bird','dragon','leaf','creature'].includes(kind))y-=Math.sin(release*Math.PI)*r*.16;
        if(kind==='thrust')scale=.86+.14*release;
        if(kind==='threads')rotation*=.35;
      }else if(kind==='lightning'){y-=r*.15;scale=.87+.13*release;}
      else if(kind==='hammer'||kind==='fall'||kind==='kick'){x-=r*.27*(1-release);y-=r*.60*(1-release);rotation=-.10+.10*release;}
      else if(kind==='slash'){rotation=-.18+.36*release;scale=.70+.30*release;}
      else if(kind==='staff'){rotation=-.08+.16*release;scale=.85+.15*release;}
      else if(kind==='radial'||kind==='vortex'){scale=.62+.45*release-.08*settle;rotation=kind==='vortex'?.24*p:0;}
      else if(kind==='surface'||kind==='water'){scale=.74+.26*release;y+=r*.10;}
      else if(kind==='roots'||kind==='bloom'){scale=.61+.39*release;y+=r*.15*(1-release);}
      else if(kind==='seal'){y-=r*.45*(1-release);scale=.87+.13*release;}
      if(kind==='rubber'){
        size=r*1.65;rotation=angle;scale=.86+.14*release;
        if(phase==='caught'){
          const reach=smooth(age/260),grip=smooth((age-270)/240)*(1-smooth((age-1320)/210));
          x=mix(tip.x,point.x,reach);y=mix(tip.y,point.y,reach);frame=age<1320?grip*3:3+2*smooth((age-1320)/360);
          alpha=smooth(t/.055)*(1-smooth((t-.88)/.12))*clamp(energy)*(quiet?.7:1);
        }else{x=mix(tip.x,hit.x,release);y=mix(tip.y,hit.y,release);frame=mix(0,3,release);}
        // Start with the wrist at the rod tip; a centered hand would put its
        // wrist behind the arm origin for the first few frames.
        const [u,v]=socket(id,frame),reach=phase==='caught'?smooth(age/260):release,dx=(.5-u)*size*scale*(1-reach),dy=(.5-v)*size*scale*(1-reach);
        x+=dx*Math.cos(rotation)-dy*Math.sin(rotation);y+=dx*Math.sin(rotation)+dy*Math.cos(rotation);
      }
      const a=Math.min(5,Math.floor(frame)),b=Math.min(5,a+1),blend=smooth(frame-a);
      return{x,y,rotation,scale,size,alpha,frame,a,b,blend,phase,progress:p,age,stage:p<.23?'anticipation':p<.61?'strike':'fade',presentation:kind,impactPoint:hit,renderer};
    }
    function draw(ctx,id,phase,age,values,g,tip,point,quiet=false,energy=1){
      if(!visible(phase,age,id))return null;const doc=ctx.canvas?.ownerDocument;if(!doc)return null;const entry=get(doc,id);if(!entry){load(doc,id);return null;}
      const q=pose(id,phase,age,g,tip,point,quiet,energy);ctx.save();
      if(specs[id].motion==='rubber'){
        drawArm(ctx,id,q,tip,quiet);
      }
      ctx.translate(q.x,q.y);ctx.rotate(q.rotation);ctx.scale(q.scale,q.scale);
      const paint=(f,w)=>{if(w<.002)return;ctx.globalAlpha=q.alpha*w;ctx.drawImage(entry.image,(f%3)*256,Math.floor(f/3)*256,256,256,-q.size/2,-q.size/2,q.size,q.size);};
      if(!Tween?.draw(ctx,entry,q.frame,-q.size/2,-q.size/2,q.size,q.size,q.alpha)){paint(q.a,1-q.blend);paint(q.b,q.blend);}ctx.restore();return q;
    }
    return{specs,durations,duration,has,visible,load,get,pose,draw,preload:(doc,ids=[])=>Promise.all(ids.map(id=>load(doc,id)))};
  }
  return{createCollection,wrists,socket,wrist,armGeometry};
});
