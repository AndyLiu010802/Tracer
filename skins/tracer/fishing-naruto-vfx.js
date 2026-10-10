(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./fishing-vfx-tween'):root.TracerFishingVFXTween);if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingNarutoVFX=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Tween){
  'use strict';
  const specs={"anime_iruka":{"src":"/fishing-art/fx-naruto-iruka-v2.png","motion":"projectile","revision":"a37fe93983bb"},"anime_tenten":{"src":"/fishing-art/fx-naruto-tenten-v2.png","motion":"volley","revision":"05303da09afd"},"anime_shikamaru":{"src":"/fishing-art/fx-naruto-shikamaru-v2.png","motion":"surface","revision":"97d35d9ded35"},"anime_kiba":{"src":"/fishing-art/fx-naruto-kiba-v2.png","motion":"double","revision":"49f97080cb66"},"anime_shino":{"src":"/fishing-art/fx-naruto-shino-v2.png","motion":"swarm","revision":"ccb23bec3994"},"anime_asuma":{"src":"/fishing-art/fx-naruto-asuma-v2.png","motion":"slash","revision":"a714afd6ac3a"},"anime_sai":{"src":"/fishing-art/fx-naruto-sai-v2.png","motion":"bird","revision":"dab10593627f"},"anime_ino":{"src":"/fishing-art/fx-naruto-ino-v2.png","motion":"beam","revision":"5c3cf6e32c15"},"anime_sakura":{"src":"/fishing-art/fx-naruto-sakura-v2.png","motion":"punch","revision":"71f8e468203e"},"anime_hinata":{"src":"/fishing-art/fx-naruto-hinata-v2.png","motion":"double","revision":"dce7697a945f"},"anime_neji":{"src":"/fishing-art/fx-naruto-neji-v2.png","motion":"radial","revision":"318391d13ae6"},"anime_lee":{"src":"/fishing-art/fx-naruto-lee-v2.png","motion":"kick","revision":"7b1bcc70b5ce"},"anime_temari":{"src":"/fishing-art/fx-naruto-temari-v2.png","motion":"wind","revision":"9827f81b0f45"},"anime_kankuro":{"src":"/fishing-art/fx-naruto-kankuro-v2.png","motion":"threads","revision":"43768a55ecbd"},"anime_choji":{"src":"/fishing-art/fx-naruto-choji-v2.png","motion":"punch","revision":"d246fe1a1c8c"},"anime_yamato":{"src":"/fishing-art/fx-naruto-yamato-v2.png","motion":"surface","revision":"e92dcdfcdff6"},"anime_suigetsu":{"src":"/fishing-art/fx-naruto-suigetsu-v2.png","motion":"slash","revision":"3b54f3df84a8"},"anime_gaara":{"src":"/fishing-art/fx-naruto-gaara-v2.png","motion":"surface","revision":"22c2922b2361"},"anime_kakashi":{"src":"/fishing-art/fx-naruto-kakashi-v2.png","motion":"beam","revision":"d49aa4c8bc4f"},"anime_itachi":{"src":"/fishing-art/fx-naruto-itachi-v2.png","motion":"bird","revision":"cd0b1f75a7ad"},"anime_jiraiya":{"src":"/fishing-art/fx-naruto-jiraiya-v2.png","motion":"flame","revision":"6d2a64041491"},"anime_minato":{"src":"/fishing-art/fx-naruto-minato-v2.png","motion":"teleport","revision":"2bb1f30a5a85"},"anime_deidara":{"src":"/fishing-art/fx-naruto-deidara-v2.png","motion":"bird","revision":"6afebeb20435"},"anime_konan":{"src":"/fishing-art/fx-naruto-konan-v2.png","motion":"volley","revision":"00737b0bd6ef"},"anime_obito":{"src":"/fishing-art/fx-naruto-obito-v2.png","motion":"vortex","revision":"b7fdc0ea3f4a"},"anime_naruto":{"src":"/fishing-art/fx-naruto-naruto-v2.png","motion":"orb","revision":"89ddcf306abe"},"anime_sasuke":{"src":"/fishing-art/fx-naruto-sasuke-v2.png","motion":"beam","revision":"28f2c10e2cd3"},"anime_hashirama":{"src":"/fishing-art/fx-naruto-hashirama-v2.png","motion":"dragon","revision":"68ed16242a1d"},"anime_madara":{"src":"/fishing-art/fx-naruto-madara-v2.png","motion":"fall","revision":"96b9f2924007"},"anime_sixpaths":{"src":"/fishing-art/fx-naruto-sixpaths-v2.png","motion":"orb","revision":"c8ab9e979ad2"},"anime_konohamaru":{"src":"/fishing-art/fx-naruto-konohamaru-v2.png","motion":"orb","revision":"2a8bd833dd54"},"anime_ebisu":{"src":"/fishing-art/fx-naruto-ebisu-v2.png","motion":"projectile","revision":"31df0a65f319"},"anime_genma":{"src":"/fishing-art/fx-naruto-genma-v2.png","motion":"volley","revision":"f4c684841edf"},"anime_izumo":{"src":"/fishing-art/fx-naruto-izumo-v2.png","motion":"surface","revision":"d1fe40e514d5"},"anime_kurenai":{"src":"/fishing-art/fx-naruto-kurenai-v2.png","motion":"surface","revision":"478131b73902"},"anime_anko":{"src":"/fishing-art/fx-naruto-anko-v2.png","motion":"double","revision":"0955e83eecee"},"anime_haku":{"src":"/fishing-art/fx-naruto-haku-v2.png","motion":"radial","revision":"9b0ff72a595e"},"anime_zabuza":{"src":"/fishing-art/fx-naruto-zabuza-v2.png","motion":"slash","revision":"8f34d7871572"},"anime_kisame":{"src":"/fishing-art/fx-naruto-kisame-v2.png","motion":"dragon","revision":"fe117fc34ffc"},"anime_hidan":{"src":"/fishing-art/fx-naruto-hidan-v2.png","motion":"slash","revision":"feae397a8386"},"anime_sasori":{"src":"/fishing-art/fx-naruto-sasori-v2.png","motion":"threads","revision":"7692be80b225"},"anime_tsunade":{"src":"/fishing-art/fx-naruto-tsunade-v2.png","motion":"kick","revision":"1722d18f1b32"},"anime_pain":{"src":"/fishing-art/fx-naruto-pain-v2.png","motion":"radial","revision":"fe0548a70e05"},"anime_tobirama":{"src":"/fishing-art/fx-naruto-tobirama-v2.png","motion":"dragon","revision":"c35461e29f7e"},"anime_orochimaru":{"src":"/fishing-art/fx-naruto-orochimaru-v2.png","motion":"beam","revision":"3b20994daa5e"}}; // GENERATED NARUTO VFX SPECS
  const durations={cast:620,bite:280,caught:760},documents=new WeakMap();
  const clamp=x=>Math.max(0,Math.min(1,Number(x)||0)),smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
  function surface(doc,image){
    if(!doc.createElement)return null;
    // Cache a render-sized atlas once. Feather cell borders during compositing,
    // so the generated translucent glow cannot reveal rotated square corners.
    const c=doc.createElement('canvas');c.width=768;c.height=512;const ctx=c.getContext('2d');
    ctx.drawImage(image,0,0,c.width,c.height);ctx.globalCompositeOperation='destination-in';
    for(let row=0;row<2;row++)for(let col=0;col<3;col++){
      const x=col*256,y=row*256;ctx.save();ctx.beginPath();ctx.rect(x,y,256,256);ctx.clip();
      for(const vertical of [false,true]){const gradient=ctx.createLinearGradient(x,y,vertical?x:x+256,vertical?y+256:y);gradient.addColorStop(0,'rgba(255,255,255,0)');gradient.addColorStop(.10,'#fff');gradient.addColorStop(.90,'#fff');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(x,y,256,256);}
      ctx.restore();
    }return c;
  }
  function cache(doc){let m=documents.get(doc);if(!m){m=new Map();documents.set(doc,m);}return m;}
  function load(doc,id){
    if(!doc||!Object.hasOwn(specs,id))return Promise.resolve(null);
    const m=cache(doc);if(m.has(id)){const value=m.get(id);m.delete(id);m.set(id,value);return value.promise;}
    const record={entry:null,promise:null};m.set(id,record);
    record.promise=new Promise(resolve=>{const ImageClass=doc.defaultView?.Image;if(!ImageClass){resolve(null);return;}const image=new ImageClass();image.onload=async()=>{let display=null;try{display=surface(doc,image);}catch(_){}record.entry={image,display,width:image.naturalWidth/3,height:image.naturalHeight/2};await Tween?.prepare(doc,record.entry.display);resolve(record.entry);};image.onerror=()=>resolve(null);image.src=specs[id].src+'?v='+specs[id].revision;});
    // Warm only the equipped technique; old collections must not retain 45 atlases.
    while(m.size>8)m.delete(m.keys().next().value);return record.promise;
  }
  function get(doc,id){return documents.get(doc)?.get(id)?.entry||null;}
  function pose(id,phase,age,g,tip,point,quiet=false,energy=1){
    const spec=Object.hasOwn(specs,id)&&specs[id],duration=durations[phase];if(!spec||!duration||!Number.isFinite(age)||age<0||age>=duration)return null;
    const t=clamp(age/duration),p=quiet?.53:t,hit=phase==='caught'?point:g.water||point;
    const radius=Math.max(16,Math.min(49,g.width*.12,g.height*.18))*(phase==='bite'?.65:1)*(quiet?.75:1);
    const angle=Math.atan2(hit.y-tip.y,hit.x-tip.x),release=smooth((p-.12)/.40),settle=smooth((p-.66)/.34),kind=spec.motion;
    let x=hit.x,y=hit.y,rotation=0,scale=.74+.26*release;
    if(['projectile','beam','orb','bird','volley','double','dragon','punch','threads','teleport'].includes(kind)){
      const distance=radius*1.30*(1-release);x-=Math.cos(angle)*distance;y-=Math.sin(angle)*distance;
      if(kind==='bird'||kind==='dragon')y-=Math.sin(release*Math.PI)*radius*.19;
      rotation=angle;if(kind==='orb')rotation+=Math.sin(p*Math.PI)*.13;
      if(kind==='double')rotation+=Math.sin(p*Math.PI*2)*.08;
      if(kind==='teleport')scale=.80+.20*smooth((p-.22)/.14);
    }else if(kind==='fall'||kind==='kick'){x-=radius*.40*(1-release);y-=radius*.7*(1-release);rotation=-.2+.2*release;}
    else if(kind==='slash'){rotation=-.48+.96*smooth((p-.13)/.49);scale=.66+.34*release;}
    else if(kind==='radial'||kind==='vortex'){scale=.55+.57*release-.08*settle;rotation=kind==='vortex'?p*1.8:0;}
    else if(kind==='surface'){scale=.62+.38*release;y+=radius*.09;}
    const alpha=smooth(t/.09)*(1-smooth((t-.78)/.22))*clamp(energy)*(quiet?.7:1);
    // Continuous authored time through the cached deformation inbetweens.
    const frame=(quiet?.53:p)*5,a=Math.min(5,Math.floor(frame)),b=Math.min(5,a+1),blend=smooth(frame-a);
    return{x,y,rotation,scale,size:radius*2.35,alpha,frame,a,b,blend,phase,progress:p,age,stage:p<.23?'anticipation':p<.59?'strike':'fade',presentation:kind,impactPoint:hit,renderer:'painted-ninjutsu'};
  }
  function draw(ctx,id,phase,age,values,g,tip,point,quiet=false,energy=1){
    if(!Object.hasOwn(specs,id)||!durations[phase]||!Number.isFinite(age)||age<0||age>=durations[phase])return null;
    const doc=ctx.canvas?.ownerDocument;if(!doc)return null;const entry=get(doc,id);if(!entry){load(doc,id);return null;}
    const q=pose(id,phase,age,g,tip,point,quiet,energy);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.rotation);ctx.scale(q.scale,q.scale);
    const source=entry.display||entry.image,w=entry.display?256:entry.width,h=entry.display?256:entry.height;
    const paint=(frame,weight)=>{if(weight<.002)return;ctx.globalAlpha=q.alpha*weight;ctx.drawImage(source,(frame%3)*w,Math.floor(frame/3)*h,w,h,-q.size/2,-q.size/2,q.size,q.size);};
    if(!Tween?.draw(ctx,entry,q.frame,-q.size/2,-q.size/2,q.size,q.size,q.alpha)){paint(q.a,1-q.blend);paint(q.b,q.blend);}ctx.restore();return q;
  }
  return{specs,durations,load,get,pose,draw,preload:(doc,ids=[])=>Promise.all(ids.map(id=>load(doc,id)))};
});
