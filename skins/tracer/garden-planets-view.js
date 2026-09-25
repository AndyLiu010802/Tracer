(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./garden-plant-atlas'):root.TracerGardenPlantAtlas);if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerGardenPlanetsView=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Atlas){
  'use strict';
  const TAU=Math.PI*2,CAMERA=4.2,MAX_SPRITES=72,PAGE_SIZE=24,CARD_PAGE=12;
  const KINDS=['wildflower','sunflower','lavender','apple','peach','cherry','neon_orchid','volt_berry','crystal_tree'];
  const NAMES={wildflower:['野花','Wildflower'],sunflower:['向日葵','Sunflower'],lavender:['薰衣草','Lavender'],apple:['苹果树','Apple tree'],peach:['桃树','Peach tree'],cherry:['樱桃树','Cherry tree'],neon_orchid:['霓虹兰','Neon orchid'],volt_berry:['电光莓','Volt berry'],crystal_tree:['晶芯树','Crystal tree']};
  const imagesByDocument=new WeakMap();
  const texturesByDocument=new WeakMap();
  function hash(value){let h=2166136261;for(const c of String(value||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function rotate(p,yaw,pitch){const c=Math.cos(yaw),s=Math.sin(yaw),a=Math.cos(pitch),b=Math.sin(pitch),x=p.x*c+p.z*s,z=-p.x*s+p.z*c;return{x,y:p.y*a-z*b,z:p.y*b+z*a};}
  function unrotate(p,yaw,pitch){const a=Math.cos(pitch),b=Math.sin(pitch),c=Math.cos(yaw),s=Math.sin(yaw),y=p.y*a+p.z*b,z=-p.y*b+p.z*a;return{x:p.x*c-z*s,y,z:p.x*s+z*c};}
  function project(p,radius){const f=radius*Math.sqrt(CAMERA*CAMERA-1),scale=f/(CAMERA-p.z);return{x:p.x*scale,y:-p.y*scale,scale,visible:CAMERA*p.z>1};}
  function flowerView(p){return{yaw:-Math.atan2(p.x,p.z),pitch:Math.max(.42,Math.min(1.24,Math.atan2(p.y,Math.hypot(p.x,p.z))))};}
  // A landscaped crown, rather than an even distribution of stickers over a ball.
  // Plants share one world-up direction, and their roots lie on the same surface
  // as the paths, beds, stones and pond. Yaw reveals the other side of the garden.
  const BEDS=[{x:.48,z:.32,r:.22},{x:.43,z:-.36,r:.23},{x:-.12,z:-.65,r:.22},{x:-.60,z:-.33,r:.19},{x:-.13,z:.68,r:.19},{x:.73,z:-.04,r:.12}];
  const isCyber=f=>f.farmId==='cyber'||['neon_orchid','volt_berry','crystal_tree'].includes(kind(f));
  function biomes(flowers){
    const cyber=flowers.filter(isCyber).length,total=flowers.length;
    const count=cyber===0?0:cyber===total?6:Math.max(1,Math.min(5,Math.round(cyber/total*6)));
    const order=[0,1,5,2,4,3],neon=new Set(order.slice(0,count));
    return {cyber,meadow:total-cyber,key:String(count),beds:BEDS.map((bed,index)=>({...bed,index,cyber:neon.has(index)}))};
  }
  function biomeMix(p,layout){
    if(!layout.cyber)return 0;if(!layout.meadow)return 1;
    let neon=10,green=10;
    for(const b of layout.beds){const d=Math.hypot(p.x-b.x,p.z-b.z);if(b.cyber)neon=Math.min(neon,d);else green=Math.min(green,d);}
    const edge=Math.sin(p.x*13+p.z*8)*.016+Math.sin(p.z*15-p.x*6)*.013;
    const t=Math.max(0,Math.min(1,.5+(green-neon+edge)/.16));return t*t*(3-2*t);
  }
  function surfacePoint(x,z){return{x,y:Math.sqrt(Math.max(.001,1-x*x-z*z)),z};}
  function pathX(z,seed){return .19+Math.cos(z*3.2)*.115;}
  function terrain(p,seed){
    const lon=Math.atan2(p.x,p.z),edge=.32+Math.sin(lon*5+seed)*.026+Math.sin(lon*11)*.012;
    const pond=Math.min(Math.hypot((p.x+.33)/.225,(p.z+.22)/.29),Math.hypot((p.x+.13)/.27,(p.z-.12)/.235));
    const water=p.y>.46?(pond-1)*.22:1;
    const path=Math.abs(p.x-pathX(p.z,seed));
    let bed=9;for(const b of BEDS)bed=Math.min(bed,Math.hypot((p.x-b.x)/b.r,(p.z-b.z)/(b.r*.82)));
    return{water,path,edge,bed};
  }
  function rarity(f){return f.rarity==='shiny'||f.shiny===true||f.ticket===0?'shiny':f.rarity==='rare'||f.rare===true||Number.isInteger(f.ticket)&&f.ticket>0&&f.ticket<100?'rare':'normal';}
  function kind(f){return KINDS.includes(f.plantKind)?f.plantKind:KINDS.includes(f.kind)?f.kind:'wildflower';}
  function positions(flowers,seed){
    const count=flowers.length,occupied=new Set(),layout=biomes(flowers),mixed=layout.cyber>0&&layout.meadow>0,counters={cyber:0,meadow:0};
    return flowers.map((flower,i)=>{
      const biome=isCyber(flower)?'cyber':'meadow',beds=mixed?layout.beds.filter(b=>b.cyber===isCyber(flower)):BEDS,ordinal=mixed?counters[biome]++:i,total=mixed?layout[biome]:count;
      const b=beds[ordinal%beds.length],row=Math.floor(ordinal/beds.length),n=Math.ceil((total-ordinal%beds.length)/beds.length);
      const a=row*2.399963229728653+seed*.13,r=n<=1?0:Math.sqrt((row+.5)/n)*b.r*.78;
      let p=surfacePoint(b.x+Math.sin(a)*r,b.z+Math.cos(a)*r*.82);
      // Keep every receipt, but never put its roots in water or on a walkway.
      const key=q=>q.x.toFixed(8)+':'+q.z.toFixed(8);
      for(let attempt=0;attempt<32;attempt++){
        const t=terrain(p,seed),mix=biomeMix(p,layout);if(t.water>=.025&&t.path>=.068&&!occupied.has(key(p))&&(!mixed||(biome==='cyber'?mix>=.9:mix<=.1)))break;
        const angle=a+(attempt+1)*2.399963229728653,spread=Math.max(.0001,r)*Math.pow(.88,Math.floor(attempt/4));
        p=surfacePoint(b.x+Math.sin(angle)*spread,b.z+Math.cos(angle)*spread*.82);
      }
      occupied.add(key(p));
      return{flower,index:i,point:p};
    });
  }
  // Every receipt remains in the memorial list. A bounded, representative planting
  // keeps even very large project worlds responsive; selecting any receipt reveals it.
  function samplePositions(all,selected=-1){
    if(all.length<=MAX_SPRITES)return all;
    const indices=new Set();
    for(let i=0;i<MAX_SPRITES-1;i++)indices.add(Math.floor(i*all.length/(MAX_SPRITES-1)));
    if(selected>=0&&selected<all.length)indices.add(selected);else indices.add(all.length-1);
    return [...indices].sort((a,b)=>a-b).map(i=>all[i]);
  }
  function sprite(doc,plantKind,redraw){
    let cache=imagesByDocument.get(doc);if(!cache){cache=new Map();imagesByDocument.set(doc,cache);}
    if(!cache.has(plantKind)){
      const image=new doc.defaultView.Image(),entry={image,ready:false,failed:false,waiters:new Set()};cache.set(plantKind,entry);
      image.onload=()=>{entry.ready=true;for(const fn of entry.waiters)fn();entry.waiters.clear();};
      image.onerror=()=>{entry.failed=true;for(const fn of entry.waiters)fn();entry.waiters.clear();};
      image.src='/garden-art/'+plantKind+'-v2.png';
    }
    const entry=cache.get(plantKind);if(!entry.ready&&!entry.failed&&redraw)entry.waiters.add(redraw);return entry;
  }
  function removeImageWaiter(doc,fn){for(const entry of imagesByDocument.get(doc)?.values()||[])entry.waiters.delete(fn);}
  function meadow(doc,redraw,biome='meadow'){
    let cache=imagesByDocument.get(doc);if(!cache){cache=new Map();imagesByDocument.set(doc,cache);}
    const key='$'+biome;
    if(!cache.has(key)){
      const image=new doc.defaultView.Image(),entry={image,ready:false,failed:false,pixels:null,waiters:new Set()};cache.set(key,entry);
      image.onload=()=>{try{const sheet=doc.createElement('canvas');sheet.width=sheet.height=1024;const c=sheet.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0,1024,1024);entry.pixels=c.getImageData(0,0,1024,1024);entry.ready=true;}catch(_){entry.failed=true;}for(const fn of entry.waiters)fn();entry.waiters.clear();};
      image.onerror=()=>{entry.failed=true;for(const fn of entry.waiters)fn();entry.waiters.clear();};image.src='/garden-art/planet-'+biome+'-v1.png';
    }
    const entry=cache.get(key);if(!entry.ready&&!entry.failed&&redraw)entry.waiters.add(redraw);return entry;
  }
  function randomSource(seed){let state=(seed*1000000)>>>0;return()=>{state+=0x6D2B79F5;let x=state;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return((x^x>>>14)>>>0)/4294967296;};}
  function texture(seed,material,cyberMaterial,layout){
    const width=1024,height=512,data=new Uint8ClampedArray(width*height*3);
    const grain=(x,y)=>(((Math.imul(x+31,73856093)^Math.imul(y+17,19349663))>>>0)%101)/100;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const lat=Math.PI*(y/(height-1)-.5),lon=x/width*TAU,p={x:Math.sin(lon)*Math.cos(lat),y:Math.sin(lat),z:Math.cos(lon)*Math.cos(lat)},t=terrain(p,seed);
      const fine=grain(x,y)-.5,brush=Math.sin(p.x*36+p.y*18)*Math.cos(p.z*29-p.y*17),patch=Math.sin(p.x*8+seed)*Math.cos(p.z*9+seed)*8;
      let rgb;
      if(p.y<t.edge){
        const stratum=Math.sin(p.y*49+Math.sin(lon*7)*.6)+Math.sin(p.y*91+Math.cos(lon*9)*.45)*.28;
        const stone=Math.sin(lon*23+p.y*15)*Math.cos(p.y*35+lon*4)*6;
        const moss=Math.max(0,Math.min(1,(p.y-t.edge+.115+Math.sin(lon*17)*.027+brush*.012)/.08));
        rgb=[142+stratum*7+stone+fine*11,118+stratum*6+stone+fine*9,91+stratum*4+stone+fine*7];
        const leaf=[83+brush*8,109+brush*10,61+brush*6];for(let c=0;c<3;c++)rgb[c]=rgb[c]*(1-moss)+leaf[c]*moss;
        if(p.y<-.76)rgb=rgb.map((v,i)=>v*.94+[3,5,6][i]);
      }else if(t.water<0){
        const depth=Math.min(1,-t.water*7),ripple=Math.sin(p.z*115+p.x*29)*Math.sin(p.x*73-p.z*19);
        rgb=[77-depth*36+fine*2,172-depth*31+ripple*2,165-depth*15+ripple*3];
        if(t.water>-.014)rgb=[128+fine*5,194+fine*5,168+fine*4];
      }else if(t.water<.014){rgb=[178+fine*8,183+fine*7,125+fine*6];}
      else if(t.path<.050&&Math.abs(p.z)<.83){
        const speck=fine>.43?9:0;rgb=[197+brush*3+fine*6+speck,181+brush*3+fine*5+speck,140+brush*2+fine*5+speck];
      }else{
        const bed=t.bed<.95?5:0,edge=t.path<.066?8:0;
        rgb=[112+patch+brush*3+fine*5-bed+edge,153+patch+brush*4+fine*5-bed,73+patch*.5+brush*2+fine*3-bed*.6];
        if(fine>.46&&brush>.4)rgb=[150+patch,177+patch,97];
      }
      if(material&&p.y>t.edge-.025){
        const mx=Math.min(material.width-1,Math.max(0,Math.round((p.x*.5+.5)*(material.width-1)))),my=Math.min(material.height-1,Math.max(0,Math.round((p.z*.5+.5)*(material.height-1)))),mi=(my*material.width+mx)*4;
        const blend=Math.max(0,Math.min(1,(p.y-t.edge+.025)/.08));
        for(let c=0;c<3;c++)rgb[c]=rgb[c]*(1-blend)+material.data[mi+c]*blend;
      }
      const neon=biomeMix(p,layout);
      if(neon){
        let cyber;
        if(p.y>=t.edge-.025){
          if(cyberMaterial){const mx=Math.min(cyberMaterial.width-1,Math.max(0,Math.round((p.x*.5+.5)*(cyberMaterial.width-1)))),my=Math.min(cyberMaterial.height-1,Math.max(0,Math.round((p.z*.5+.5)*(cyberMaterial.height-1)))),mi=(my*cyberMaterial.width+mx)*4;cyber=[cyberMaterial.data[mi],cyberMaterial.data[mi+1],cyberMaterial.data[mi+2]];}
          else if(t.water<0)cyber=[38+fine*3,129+fine*8,149+fine*9];
          else if(t.path<.05)cyber=[63+fine*6,104+fine*7,121+fine*8];
          else cyber=[35+brush*4+fine*6,76+patch*.4+fine*6,86+patch*.4+fine*8];
        }else{
          const layers=Math.sin(p.y*49+Math.sin(lon*7)*.6),seam=Math.abs(Math.sin(lon*9+p.y*2))<.025&&p.y<.28&&p.y>-.7;
          cyber=seam?[65,167,177]:[55+layers*5+fine*8,79+layers*6+fine*8,90+layers*7+fine*9];
        }
        for(let c=0;c<3;c++)rgb[c]=rgb[c]*(1-neon)+cyber[c]*neon;
      }
      const at=(y*width+x)*3;for(let c=0;c<3;c++)data[at+c]=rgb[c];
    }
    return{width,height,data};
  }
  // Turning to another keepsake reuses its material; twelve gallery thumbnails
  // must not rebuild millions of texture pixels on every flower selection.
  function cachedTexture(doc,seed,material,cyberMaterial,layout){
    let cache=texturesByDocument.get(doc);if(!cache){cache=new Map();texturesByDocument.set(doc,cache);}
    const key=String(seed)+(material?':painted':':fallback')+':'+layout.key+(cyberMaterial?':cyber':'');let value=cache.get(key);
    if(value){cache.delete(key);cache.set(key,value);return value;}
    value=texture(seed,material,cyberMaterial,layout);cache.set(key,value);
    while(cache.size>16)cache.delete(cache.keys().next().value);return value;
  }
  function renderer(canvas,planet,options={}){
    const doc=canvas.ownerDocument,win=doc.defaultView,ctx=canvas.getContext('2d'),seed=hash(planet.id)/4294967296*TAU,all=positions(planet.flowers||[],seed),layout=biomes(planet.flowers||[]),random=randomSource(seed+1);
    let tex=null,groundReady=meadow(doc).ready,cyberReady=layout.cyber?meadow(doc,null,'cyber').ready:false;
    canvas.dataset.biome=layout.cyber?(layout.meadow?'mixed':'cyber'):'meadow';
    // Decorative vegetation is ground cover, never an extra harvestable plant.
    const cover=[];for(let i=0;i<180;i++){const a=random()*TAU,r=Math.sqrt(random())*.96,p=surfacePoint(Math.sin(a)*r,Math.cos(a)*r),t=terrain(p,seed);if(p.y>t.edge+.02&&t.water>.022&&t.path>.064)cover.push({point:p,size:.012+random()*.014,tone:random(),phase:random()*TAU});}
    const rocks=[];for(let i=0;i<43;i++){const a=i/43*TAU,rx=.29+Math.sin(a*3+seed)*.023,rz=.395+Math.sin(a*3+seed)*.025,x=-.36+Math.sin(a)*rx,z=.10+Math.cos(a)*rz;rocks.push({point:surfacePoint(x,z),size:.022+random()*.017,tone:random()});}
    const steps=[];for(let z=-.76;z<.79;z+=.12){steps.push({point:surfacePoint(pathX(z,seed)+(random()-.5)*.022,z),size:.040+random()*.009,tone:random()});}
    const lights=layout.beds.filter(b=>b.cyber).map(b=>({point:surfacePoint(b.x-b.r*.42,b.z+b.r*.73),size:.06}));
    const vines=[];for(let i=0;i<13;i++){const a=i/13*TAU+(random()-.5)*.22+seed*.1,chain=[],length=4+Math.floor(random()*8);for(let j=0;j<length;j++){const y=.38-j*.044,ring=Math.sqrt(1-y*y),turn=a+Math.sin(j*.85+i)*.023;chain.push({x:Math.sin(turn)*ring,y,z:Math.cos(turn)*ring});}vines.push(chain);}
    const initialYaw=((hash(planet.id+'-view')%1000)/1000-.5)*.90;
    let yaw=initialYaw,pitch=.90,selected=-1,dead=false,inView=!win.IntersectionObserver,raf=0,wake=0,last=0,drag=null,moved=false,width=0,height=0,radius=0,hitAreas=[],surface=null,rays=null,buffer=null;
    if(options.view){yaw=options.view.yaw;pitch=options.view.pitch;}
    let spinning=!!options.interactive,gestureUntil=0,dirty=true;
    const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const request=()=>{if(dead)return;dirty=true;if(!raf&&inView&&!(doc.hidden || doc.tracerHidden))raf=win.requestAnimationFrame(frame);};
    const loaded=()=>{if(dead)return;const ground=meadow(doc);if(ground.ready&&!groundReady){tex=null;groundReady=true;}if(layout.cyber){const neon=meadow(doc,null,'cyber');if(neon.ready&&!cyberReady){tex=null;cyberReady=true;}}request();};
    meadow(doc,loaded);
    if(layout.cyber)meadow(doc,loaded,'cyber');
    for(const k of new Set(all.map(p=>kind(p.flower))))sprite(doc,k,loaded);
    function makeRays(size){
      surface=doc.createElement('canvas');surface.width=surface.height=size;const context=surface.getContext('2d');buffer=context.createImageData(size,size);rays=[];
      const rad=(size-2)/2,f=rad*Math.sqrt(CAMERA*CAMERA-1);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const dx=(x+.5-size/2)/f,dy=-(y+.5-size/2)/f,a=1+dx*dx+dy*dy,disc=CAMERA*CAMERA-a*(CAMERA*CAMERA-1);if(disc<0)continue;
        const distance=(CAMERA-Math.sqrt(disc))/a,p={x:dx*distance,y:dy*distance,z:CAMERA-distance};
        const light=Math.max(0,p.x*-.44+p.y*.60+p.z*.66),rim=Math.pow(1-p.z,3);
        rays.push({offset:(y*size+x)*4,p,light:.63+light*.40,rim});
      }
    }
    function resize(){
      if(dead)return;const rect=canvas.getBoundingClientRect();width=options.size||Math.max(1,rect.width||360);height=options.size||Math.max(1,rect.height||360);const dpr=options.size?1:Math.min(2,win.devicePixelRatio||1);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);radius=Math.min(width*.355,height*.318);
      surface=null;buffer=null;rays=null;request();
    }
    function paintTerrain(cx,cy){
      const cyaw=Math.cos(yaw),syaw=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),out=buffer.data;
      for(const ray of rays){const p=ray.p,y=p.y*cp+p.z*sp,z=-p.y*sp+p.z*cp,x=p.x*cyaw-z*syaw,wz=p.x*syaw+z*cyaw;
        let u=Math.atan2(x,wz)/TAU;if(u<0)u+=1;const v=Math.asin(Math.max(-1,Math.min(1,y)))/Math.PI+.5;
        const ti=(Math.min(tex.height-1,Math.floor(v*tex.height))*tex.width+Math.min(tex.width-1,Math.floor(u*tex.width)))*3,oi=ray.offset;
        out[oi]=tex.data[ti]*ray.light+ray.rim*12;out[oi+1]=tex.data[ti+1]*ray.light+ray.rim*17;out[oi+2]=tex.data[ti+2]*ray.light+ray.rim*17;out[oi+3]=255;
      }
      surface.getContext('2d').putImageData(buffer,0,0);ctx.drawImage(surface,cx-radius,cy-radius,radius*2,radius*2);
    }
    function screen(point,cx,cy){const world=rotate(point,yaw,pitch),p=project(world,radius);return{x:cx+p.x,y:cy+p.y,scale:p.scale,visible:p.visible,z:world.z};}
    function onGround(p,dx,dz){const x=p.x+dx,z=p.z+dz;if(x*x+z*z>.99)return p;return surfacePoint(x,z);}
    function patch(point,rx,rz,fill,cx,cy){
      ctx.beginPath();for(let i=0;i<=20;i++){const a=i/20*TAU,q=screen(onGround(point,Math.cos(a)*rx,Math.sin(a)*rz),cx,cy);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);}ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    }
    function stone(item,cx,cy,stepping=false){
      const p=screen(item.point,cx,cy);if(!p.visible)return;const s=item.size*p.scale;
      patch(item.point,item.size*1.12,item.size*.78,'#25382b35',cx,cy);
      ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle=stepping?'#c8bfa2':item.tone>.5?'#a7ad91':'#969e84';ctx.beginPath();ctx.ellipse(0,-s*.18,s,s*.59,-.17,0,TAU);ctx.fill();ctx.strokeStyle=stepping?'#e4d6b589':'#dce0bb70';ctx.lineWidth=Math.max(.6,s*.13);ctx.beginPath();ctx.ellipse(-s*.05,-s*.30,s*.84,s*.43,-.17,Math.PI,TAU);ctx.stroke();ctx.restore();
    }
    function grass(item,cx,cy,foreground=false){
      const p=screen(item.point,cx,cy);if(!p.visible)return;const s=p.scale*item.size;
      ctx.save();ctx.translate(p.x,p.y);ctx.lineCap='round';ctx.lineWidth=Math.max(.7,s*.18);
      const neon=biomeMix(item.point,layout)>.5;
      for(let j=-1;j<=1;j++){ctx.strokeStyle=neon?(j===0?'#8ecec9':item.tone>.48?'#519d9e':'#486f85'):j===0?'#adc269':item.tone>.48?'#779b4c':'#668d48';ctx.beginPath();ctx.moveTo(j*s*.25,0);ctx.quadraticCurveTo(j*s*.7,-s*.7,j*s*.8+Math.sin(item.phase)*s*.25,-s*(j===0?1:.75));ctx.stroke();}
      if(!foreground&&item.tone>.94){ctx.fillStyle=item.tone>.98?'#e9bfae':'#e9e1b1';ctx.beginPath();ctx.arc(0,-s,Math.max(.6,s*.19),0,TAU);ctx.fill();}ctx.restore();
    }
    function fence(cx,cy){
      const posts=[];for(let i=0;i<8;i++){const a=-.78+i*.20;posts.push(surfacePoint(Math.sin(a)*.90,-Math.cos(a)*.90));}
      for(let i=0;i<posts.length;i++){
        const p=posts[i],root=screen(p,cx,cy);if(!root.visible)continue;const top=screen({...p,y:p.y+.13},cx,cy);
        if(i&&screen(posts[i-1],cx,cy).visible){for(const lift of [.052,.105]){const a=screen({...posts[i-1],y:posts[i-1].y+lift},cx,cy),b=screen({...p,y:p.y+lift},cx,cy);ctx.strokeStyle='#76633d';ctx.lineWidth=root.scale*.018;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='#c3a76b';ctx.lineWidth=root.scale*.006;ctx.stroke();}}
        ctx.strokeStyle='#725d37';ctx.lineWidth=root.scale*.027;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(root.x,root.y);ctx.lineTo(top.x,top.y);ctx.stroke();ctx.strokeStyle='#c4a86d';ctx.lineWidth=root.scale*.010;ctx.beginPath();ctx.moveTo(root.x-1,root.y-1);ctx.lineTo(top.x-1,top.y);ctx.stroke();
      }
    }
    function beacon(item,cx,cy){
      const p=screen(item.point,cx,cy);if(!p.visible)return;
      const h=p.scale*.078,w=p.scale*.014;
      patch(item.point,.021,.016,'#182f464f',cx,cy);
      ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle='#375d6d';ctx.lineWidth=Math.max(1,w*.8);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-h);ctx.stroke();
      const glow=ctx.createRadialGradient(0,-h,0,0,-h,w*4.8);glow.addColorStop(0,'#85ecf683');glow.addColorStop(1,'#80d7ee00');ctx.fillStyle=glow;ctx.fillRect(-w*5,-h-w*5,w*10,w*10);
      ctx.fillStyle='#26394f';ctx.fillRect(-w,-h-w*.6,w*2,w*1.7);ctx.fillStyle='#a6e8e6';ctx.fillRect(-w*.6,-h-w*.3,w*1.2,w);ctx.fillStyle='#d6e3f4';ctx.fillRect(-w*.9,-h-w*.8,w*1.8,Math.max(.6,w*.25));ctx.restore();
    }
    function flower(item,cx,cy){
      const p=screen(item.point,cx,cy),f=item.flower,k=kind(f),r=rarity(f),entry=sprite(doc,k,loaded),cell=Atlas?.[k]?.cells[r==='shiny'?5:r==='rare'?4:3];
      const tree=['apple','peach','cherry','crystal_tree'].includes(k),density=all.length>35?.79:all.length>16?.9:1;
      const size=p.scale*(tree?.35:k==='sunflower'?.31:.25)*density,rootX=p.x,rootY=p.y;
      // Soft, foreshortened contact shadows bind roots to the actual terrain.
      patch(item.point,tree?.092:.063,tree?.060:.043,'#283e2826',cx,cy);patch(item.point,tree?.053:.038,.026,'#20352428',cx,cy);
      ctx.save();ctx.translate(rootX,rootY);
      if(r==='shiny'||item.index===selected){const halo=ctx.createRadialGradient(0,-size*.46,2,0,-size*.46,size*.65);halo.addColorStop(0,r==='shiny'?'#f9e4b63a':'#fff9d31c');halo.addColorStop(1,'#fff8d100');ctx.fillStyle=halo;ctx.fillRect(-size*.7,-size*1.15,size*1.4,size*1.4);}
      if(entry.ready&&cell){const s=size/(cell.rootY-cell.y),h=Math.min(cell.h,cell.rootY-cell.y+1);ctx.drawImage(entry.image,cell.x,cell.y,cell.w,h,(cell.x-cell.rootX)*s,-size,cell.w*s,h*s);}
      else{ctx.strokeStyle='#718f49';ctx.lineWidth=size*.035;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-size*.55);ctx.stroke();ctx.fillStyle='#d9c98b';for(let j=0;j<5;j++){ctx.beginPath();ctx.ellipse(Math.sin(j*TAU/5)*size*.10,-size*.58+Math.cos(j*TAU/5)*size*.10,size*.065,size*.10,-j*TAU/5,0,TAU);ctx.fill();}}
      if(item.index===selected){ctx.strokeStyle='#e9d49a';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,2,size*.25,size*.09,0,0,TAU);ctx.stroke();ctx.fillStyle='#f3e2ae';ctx.font=Math.max(9,size*.16)+'px serif';ctx.textAlign='center';ctx.fillText('✧',0,-size-7);}
      ctx.restore();
      for(let j=0;j<3;j++)grass({point:onGround(item.point,(j-1)*.025,.014+Math.abs(j-1)*.009),size:.021+(.006*(j%2)),tone:.6,phase:j},cx,cy,true);
      hitAreas.push({index:item.index,x:rootX,y:rootY-size*.48,r:Math.max(9,size*.34)});
    }
    function paint(){
      if(dead||!ctx)return;
      // Offscreen collection cards allocate their ray buffers and material only
      // when revealed. Opening a shelf with twelve worlds stays responsive.
      if(!surface)makeRays(Math.max(4,Math.round(Math.min(options.size?900:options.interactive?440:220,radius*2*Math.min(2,win.devicePixelRatio||1)))));
      if(!tex)tex=cachedTexture(doc,seed,meadow(doc).pixels,layout.cyber?meadow(doc,null,'cyber').pixels:null,layout);
      ctx.clearRect(0,0,width,height);const cx=width/2,cy=height*.57;
      const glow=ctx.createRadialGradient(cx,cy-radius*.3,radius*.2,cx,cy,radius*1.65);glow.addColorStop(0,'#b8c38915');glow.addColorStop(.7,'#a4b48206');glow.addColorStop(1,'#a4b48200');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
      ctx.save();ctx.translate(cx,cy+radius*1.14);ctx.scale(1,.14);const shadow=ctx.createRadialGradient(0,0,1,0,0,radius*.89);shadow.addColorStop(0,'#060d0990');shadow.addColorStop(1,'#060d0900');ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,radius*.89,0,TAU);ctx.fill();ctx.restore();
      paintTerrain(cx,cy);hitAreas=[];
      // Moss trails belong to the sphere and therefore turn with its geology.
      for(const chain of vines){const start=screen(chain[0],cx,cy);if(!start.visible)continue;ctx.strokeStyle='#496b3f';ctx.lineWidth=Math.max(1,radius*.009);ctx.beginPath();let begun=false;for(let i=0;i<chain.length;i++){const q=screen(chain[i],cx,cy);if(!q.visible)continue;if(!begun){ctx.moveTo(q.x,q.y);begun=true;}else ctx.lineTo(q.x,q.y);}ctx.stroke();for(let i=1;i<chain.length;i++){const q=screen(chain[i],cx,cy);if(!q.visible)continue;const s=q.scale*.020*(1-i*.035);ctx.fillStyle=i%2?'#789447':'#8fa257';ctx.beginPath();ctx.ellipse(q.x+(i%2?1:-1)*s*.6,q.y,s,s*.55,i%2?-.4:.4,0,TAU);ctx.fill();}}
      if(!groundReady){for(const stoneItem of steps)stone(stoneItem,cx,cy,true);for(const stoneItem of rocks)stone(stoneItem,cx,cy);}
      // A few pale water glints and lily leaves, all projected onto the pond.
      if(!groundReady)for(let i=0;i<7;i++){const p=surfacePoint(-.32+Math.sin(i*1.9)*.12,-.10+Math.cos(i*2.3)*.19),q=screen(p,cx,cy);if(q.visible){patch(p,.020+i%2*.008,.013,i%3===0?'#8da966':'#c6e4c247',cx,cy);}}
      fence(cx,cy);
      const items=[...cover.map(item=>({...item,type:'grass'})),...lights.map(item=>({...item,type:'beacon'})),...samplePositions(all,selected).map(item=>({...item,type:'flower'}))].map(item=>({...item,world:rotate(item.point,yaw,pitch)})).filter(item=>CAMERA*item.world.z>1).sort((a,b)=>a.world.z-b.world.z);
      for(const item of items)if(item.type==='flower')flower(item,cx,cy);else if(item.type==='beacon')beacon(item,cx,cy);else grass(item,cx,cy);
      // Quiet firefly points sit around the keepsake, not over its flowers.
      for(let i=0;i<5;i++){const a=seed+i*1.24,x=cx+Math.sin(a)*radius*1.24,y=cy+Math.cos(a)*radius*.89;ctx.fillStyle=i%2?'#d6d6a570':'#acc7a760';ctx.beginPath();ctx.arc(x,y,i%2?1.2:.85,0,TAU);ctx.fill();}
    }
    function frame(at){raf=0;if(dead||!inView||(doc.hidden || doc.tracerHidden))return;const animate=spinning&&!reduced?.matches&&!drag&&at>gestureUntil;
      if(animate){yaw+=Math.min(40,Math.max(0,at-(last||at)))*.000028;dirty=true;}last=at;
      if(dirty){paint();dirty=false;}if(animate)raf=win.requestAnimationFrame(frame);else if(spinning&&!reduced?.matches&&!drag){win.clearTimeout(wake);wake=win.setTimeout(request,Math.max(20,gestureUntil-at+5));}
    }
    function down(e){if(!options.interactive||e.button!==0)return;drag={x:e.clientX,y:e.clientY,yaw,pitch,id:e.pointerId};moved=false;canvas.setPointerCapture?.(e.pointerId);canvas.classList.add('is-dragging');}
    function move(e){if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;moved=moved||Math.hypot(dx,dy)>5;yaw=drag.yaw+dx*.008;pitch=Math.max(.42,Math.min(1.24,drag.pitch+dy*.006));gestureUntil=win.performance.now()+6000;request();}
    function up(e){if(!drag||drag.id!==e.pointerId)return;const wasMoved=moved;drag=null;canvas.classList.remove('is-dragging');if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!wasMoved&&e.type!=='pointercancel'){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,hit=[...hitAreas].reverse().find(h=>Math.hypot(x-h.x,y-h.y)<h.r);if(hit)options.onSelect?.(hit.index);}request();}
    function key(e){const directions={ArrowLeft:[-.17,0],ArrowRight:[.17,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]};if(!directions[e.key])return;e.preventDefault();yaw+=directions[e.key][0];pitch=Math.max(.42,Math.min(1.24,pitch+directions[e.key][1]));gestureUntil=win.performance.now()+6000;request();}
    function visibility(){if((doc.hidden || doc.tracerHidden)||!inView){if(raf)win.cancelAnimationFrame(raf);win.clearTimeout(wake);raf=0;last=0;}else request();}
    const observer=win.IntersectionObserver?new win.IntersectionObserver(entries=>{inView=entries.some(e=>e.isIntersecting);visibility();},{rootMargin:'80px'}):null;observer?.observe(canvas);
    const resizeObserver=win.ResizeObserver?new win.ResizeObserver(resize):null;resizeObserver?.observe(canvas);if(!resizeObserver)win.addEventListener('resize',resize);
    ['visibilitychange','tracer-visibilitychange'].forEach(event=>doc.addEventListener(event,visibility));reduced?.addEventListener?.('change',request);
    if(options.interactive){canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('keydown',key);}
    resize();
    return{
      drawNow(){paint();},
      async snapshot(size=1300){
        const view={yaw,pitch};
        const entries=[meadow(doc),...(layout.cyber?[meadow(doc,null,'cyber')]:[]),...new Set(all.map(p=>kind(p.flower)))].map(e=>typeof e==='string'?sprite(doc,e):e);
        let timeout;
        try{await Promise.race([Promise.all(entries.map(e=>e.image.decode())),new Promise((_,reject)=>{timeout=win.setTimeout(()=>reject(new Error('planet-assets-timeout')),15000);})]);}
        finally{win.clearTimeout(timeout);}
        if(dead)throw new Error('planet-closed');
        const output=doc.createElement('canvas'),still=renderer(output,planet,{size,view});
        try{still.drawNow();return output;}finally{still.destroy();}
      },
      pause(value){spinning=!value;if(value)win.clearTimeout(wake);request();},
      reset(){yaw=initialYaw;pitch=.90;selected=-1;gestureUntil=win.performance.now()+2000;request();},
      select(index,orient=true){const item=all[index];if(!item)return;selected=index;if(orient){const view=flowerView(item.point);yaw=view.yaw;pitch=view.pitch;}gestureUntil=win.performance.now()+8000;request();},
      destroy(){dead=true;if(raf)win.cancelAnimationFrame(raf);win.clearTimeout(wake);observer?.disconnect();resizeObserver?.disconnect();win.removeEventListener('resize',resize);['visibilitychange','tracer-visibilitychange'].forEach(event=>doc.removeEventListener(event,visibility));reduced?.removeEventListener?.('change',request);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('keydown',key);removeImageWaiter(doc,loaded);surface=null;buffer=null;rays=null;hitAreas=[];}
    };
  }

  function View(root,onAction){
    const doc=root.ownerDocument,win=doc.defaultView;let planets=[],language='zh',selectedId=null,selectedFlower=-1,flowerPage=0,cardPage=0,paused=false,lastSignature='',mainRenderer=null,cardRenderers=[],destroyed=false;
    const zh=()=>language!=='en',t=(cn,en)=>zh()?cn:en;
    function el(tag,cls,text){const node=doc.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
    function button(label,action,value,cls=''){const b=el('button','garden-planets-button '+cls,label);b.type='button';b.dataset.planetAction=action;if(value!==undefined)b.dataset.value=String(value);return b;}
    function date(value){const stamp=new Date(value);if(!Number.isFinite(stamp.getTime()))return t('纪念日未记录','Date not recorded');return stamp.toLocaleDateString(zh()?'zh-CN':'en-US',{year:'numeric',month:'short',day:'numeric'});}
    function name(f){return NAMES[kind(f)][zh()?0:1];}
    function flowerLabel(f){return (rarity(f)==='shiny'?t('闪光 · ','Shiny · '):rarity(f)==='rare'?t('奇幻 · ','Magical · '):'')+name(f);}
    function current(){return planets.find(p=>p.id===selectedId)||planets[0];}
    function dispose(){mainRenderer?.destroy();mainRenderer=null;for(const r of cardRenderers)r.destroy();cardRenderers=[];}
    function addImage(parent,flower){const k=kind(flower),cell=Atlas?.[k]?.cells[rarity(flower)==='shiny'?5:rarity(flower)==='rare'?4:3];if(!cell)return;const ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg'),image=doc.createElementNS(ns,'image');svg.setAttribute('viewBox',`${cell.x} ${cell.y} ${cell.w} ${cell.h}`);svg.setAttribute('aria-hidden','true');image.setAttribute('href','/garden-art/'+k+'-v2.png');image.setAttribute('width',Atlas[k].width);image.setAttribute('height',Atlas[k].height);svg.append(image);parent.append(svg);}
    function pick(index,orient=true){selectedFlower=index;const p=current();if(!p?.flowers[index])return;const focus=doc.activeElement?.dataset.planetAction==='select-flower';flowerPage=Math.floor(index/PAGE_SIZE);mainRenderer?.select(index,orient);renderFlowerList();renderMemory();if(focus)root.querySelector('[data-planet-action="select-flower"][data-value="'+index+'"]')?.focus({preventScroll:true});}
    function renderMemory(){const target=root.querySelector('.garden-planets-memory');if(!target)return;target.replaceChildren();const f=current()?.flowers[selectedFlower];
      if(!f){target.append(el('span','garden-planets-memory-icon','✧'),el('p','',t('轻轻转动，找到每一次努力留下的花。','Turn gently to find a flower for every effort.')));return;}
      const art=el('span','garden-planets-memory-art');addImage(art,f);const body=el('div','garden-planets-memory-copy');body.append(el('span','garden-planets-kicker',flowerLabel(f)),el('strong','',f.title||t('已完成的任务','Completed task')),el('span','garden-planets-muted',t('收获于 ','Harvested ')+date(f.harvestedAt)));target.append(art,body);
    }
    function renderFlowerList(){const target=root.querySelector('.garden-planets-records');if(!target)return;const p=current(),flowers=p?.flowers||[];flowerPage=Math.min(flowerPage,Math.max(0,Math.ceil(flowers.length/PAGE_SIZE)-1));target.replaceChildren();
      const heading=el('div','garden-planets-subhead');heading.append(el('h3','',t('这颗星球的花朵','Flowers on this world')),el('span','garden-planets-muted',t('共 '+flowers.length+' 次收获',flowers.length+' harvests')));target.append(heading);
      if(!flowers.length){target.append(el('p','garden-planets-records-empty',t('这是一个尚未收获花朵的项目纪念。它依然属于你的星系。','A project keepsake without harvested flowers. It still belongs in your constellation.')));return;}
      const list=el('div','garden-planets-flower-list');
      for(let index=flowerPage*PAGE_SIZE;index<Math.min(flowers.length,(flowerPage+1)*PAGE_SIZE);index++){const f=flowers[index],b=button('','select-flower',index,'garden-planets-flower');b.setAttribute('aria-pressed',String(index===selectedFlower));b.title=(f.title||t('已完成的任务','Completed task'))+' · '+flowerLabel(f);b.dataset.rarity=rarity(f);const art=el('span','garden-planets-flower-art');addImage(art,f);const copy=el('span','garden-planets-flower-copy');copy.append(el('span','',f.title||t('已完成的任务','Completed task')),el('small','',flowerLabel(f)));b.append(art,copy);list.append(b);}target.append(list);
      if(flowers.length>PAGE_SIZE){const pager=el('div','garden-planets-pager'),prev=button(t('上一页','Previous'),'flowers-prev'),next=button(t('下一页','Next'),'flowers-next');prev.disabled=flowerPage===0;next.disabled=(flowerPage+1)*PAGE_SIZE>=flowers.length;pager.append(prev,el('span','garden-planets-muted',`${flowerPage+1} / ${Math.ceil(flowers.length/PAGE_SIZE)}`),next);target.append(pager);}
    }
    function render(){
      dispose();root.replaceChildren();root.classList.add('garden-planets');const p=current();
      const header=el('header','garden-planets-heading'),titles=el('div');titles.append(el('span','garden-planets-kicker',t('每一份努力，都有归处','A HOME FOR EVERY EFFORT')),el('h2','',t('花朵星系','Your flower constellation')),el('p','',t('把完成的项目，珍藏成一颗可以慢慢欣赏的小星球。','Finished projects become little worlds to keep and explore.')));const total=planets.reduce((sum,item)=>sum+(item.flowers||[]).length,0),summary=el('div','garden-planets-totals');summary.append(el('strong','',String(planets.length)),el('span','',t('颗项目星球','project worlds')),el('strong','',String(total)),el('span','',t('朵纪念花','keepsake flowers')));header.append(titles,summary);root.append(header);
      if(!p){const empty=el('div','garden-planets-empty');const orb=el('div','garden-planets-empty-orb');orb.setAttribute('aria-hidden','true');empty.append(orb,el('h3','',t('第一颗星球，正在你的日常里生长','Your first world is growing in your everyday work')),el('p','',t('开始任务种下随机种子，完成后收获花朵。完成并归档项目时，这些花朵会一起成为专属星球。','Start tasks to plant surprise seeds, then finish and harvest. Complete and archive the project to gather its flowers into a keepsake world.')),button(t('去任务看板','Open task board'),'open-board'));root.append(empty);return;}
      selectedId=p.id;const detail=el('section','garden-planets-detail');detail.setAttribute('aria-label',t('星球观景台','World observatory'));
      const stage=el('div','garden-planets-stage');for(let i=0;i<18;i++){const star=el('i','garden-planets-star');star.style.left=(8+(i*37)%86)+'%';star.style.top=(8+(i*23)%77)+'%';star.style.opacity=String(.15+(i%4)*.11);stage.append(star);}
      const serial=el('div','garden-planets-serial','NO. '+String(planets.indexOf(p)+1).padStart(3,'0'));stage.append(serial);
      const canvas=el('canvas','garden-planets-canvas');canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',t(`${p.name}的三维花朵星球，可拖动或用方向键旋转`,`${p.name}, a 3D flower world. Drag or use arrow keys to rotate.`));stage.append(canvas);
      stage.append(el('span','garden-planets-touch-hint',t('拖动旋转 · 方向键微调 · 点击花朵','Drag to turn · Arrow keys to refine · Select a flower')));
      const toolbar=el('div','garden-planets-tools'),toggle=button(paused?t('继续转动','Resume rotation'):t('暂停转动','Pause rotation'),'pause');toggle.setAttribute('aria-pressed',String(paused));toolbar.append(toggle,button(t('回到初始视角','Reset view'),'reset'));stage.append(toolbar);
      const plaque=el('div','garden-planets-plaque');plaque.append(el('span','',t('项目完成纪念','A FINISHED CHAPTER')),el('h3','',p.name||t('未命名项目','Untitled project')),el('span','',date(p.completedAt)));stage.append(plaque);
      const aside=el('aside','garden-planets-story'),badge=el('span','garden-planets-badge',t('永久珍藏','A WORLD TO KEEP'));aside.append(badge,el('h3','',t('你完成的事，开成了花。','What you finished has blossomed.')),el('p','garden-planets-story-text',t('每一朵花都来自这个项目里真正完成的一项任务。它们会留在这里，记得这段认真生活的时光。','Each flower remembers a task you completed in this project. Together they keep a small record of the time and care you gave.')));
      const stats=el('div','garden-planets-facts'),types=new Set((p.flowers||[]).map(kind)),shiny=(p.flowers||[]).filter(f=>rarity(f)==='shiny').length;for(const[value,label]of [[p.taskCount??p.flowers.length,t('完成任务','finished tasks')],[p.flowers.length,t('收获花朵','harvested flowers')],[types.size,t('植物种类','plant species')]]){const fact=el('div');fact.append(el('strong','',String(value)),el('span','',label));stats.append(fact);}aside.append(stats);
      const habitats=biomes(p.flowers||[]);if(habitats.cyber){const habitatsNote=el('div','garden-planets-biomes');habitatsNote.append(el('span','garden-planets-biome-neon',t('◈ 霓虹花境 · '+habitats.cyber,'◈ Neon garden · '+habitats.cyber)));if(habitats.meadow)habitatsNote.append(el('span','',t('❧ 林间花境 · '+habitats.meadow,'❧ Woodland garden · '+habitats.meadow)));aside.append(habitatsNote,el('p','garden-planets-biome-help',t('植物记得它生长的地方。霓虹花境会随星球一起转动，出售植物也不会改变这份纪念。','Plants remember where they grew. Neon terrain turns with this world, and selling plants keeps this memory intact.')));}
      if(shiny)aside.append(el('div','garden-planets-shiny-note',t('✧ 珍藏了 '+shiny+' 位闪光伙伴','✧ Home to '+shiny+' shiny companions')));
      aside.append(el('div','garden-planets-memory'));
      if(p.flowers.length>MAX_SPRITES)aside.append(el('p','garden-planets-density-note',t('星球展示代表性的花丛。下方保留全部 '+p.flowers.length+' 条花朵纪念，点选任意一朵即可定位。','The world shows representative flower beds. All '+p.flowers.length+' keepsakes remain below; select any flower to find it.')));
      const actions=el('div','garden-planets-project-actions');if(win.TracerPostcards)actions.append(button(t('制作明信片 ↗','Create a postcard ↗'),'postcard'));if(p.projectId)actions.append(button(t('查看归档项目','View archived project'),'open-project',p.projectId));actions.append(button(t('删除这颗星球','Delete this world'),'delete-planet',p.id,'garden-planets-delete'));aside.append(actions);detail.append(stage,aside);root.append(detail,el('section','garden-planets-records'));
      mainRenderer=renderer(canvas,p,{interactive:true,onSelect:index=>pick(index,false)});mainRenderer.pause(paused);if(selectedFlower>=0&&selectedFlower<p.flowers.length)mainRenderer.select(selectedFlower);renderMemory();renderFlowerList();
      const gallery=el('section','garden-planets-gallery'),heading=el('div','garden-planets-subhead');heading.append(el('h3','',t('收藏陈列室','Your collection')),el('span','garden-planets-muted',t('每一颗，都有自己的故事','Every world has its own story')));gallery.append(heading);const grid=el('div','garden-planets-grid');cardPage=Math.min(cardPage,Math.max(0,Math.ceil(planets.length/CARD_PAGE)-1));
      for(const item of planets.slice(cardPage*CARD_PAGE,(cardPage+1)*CARD_PAGE)){const card=button('','select-planet',item.id,'garden-planets-card');card.setAttribute('aria-pressed',String(item.id===selectedId));card.setAttribute('aria-label',t('浏览星球：','Explore world: ')+item.name);const preview=el('canvas','garden-planets-preview');preview.setAttribute('aria-hidden','true');const copy=el('span','garden-planets-card-copy');copy.append(el('strong','',item.name||t('未命名项目','Untitled project')),el('span','',t(item.flowers.length+' 朵花 · ',item.flowers.length+' flowers · ')+date(item.completedAt)));card.append(preview,copy);grid.append(card);cardRenderers.push({pending:[preview,item],destroy(){}});}gallery.append(grid);
      if(planets.length>CARD_PAGE){const pager=el('div','garden-planets-pager'),prev=button(t('上一页','Previous'),'planets-prev'),next=button(t('下一页','Next'),'planets-next');prev.disabled=cardPage===0;next.disabled=(cardPage+1)*CARD_PAGE>=planets.length;pager.append(prev,el('span','garden-planets-muted',`${cardPage+1} / ${Math.ceil(planets.length/CARD_PAGE)}`),next);gallery.append(pager);}root.append(gallery);
      cardRenderers=cardRenderers.map(item=>renderer(item.pending[0],item.pending[1]));
    }
    function click(e){const b=e.target.closest('[data-planet-action]');if(!b||!root.contains(b)||b.disabled)return;const action=b.dataset.planetAction,value=b.dataset.value;
      if(action==='postcard'){onAction?.('create-postcard',{planet:current(),snapshot:()=>mainRenderer.snapshot()});return;}
      if(action==='select-planet'){if(selectedId===value)return;selectedId=value;selectedFlower=-1;flowerPage=0;render();root.querySelector('.garden-planets-canvas')?.focus({preventScroll:true});return;}
      if(action==='select-flower'){pick(Number(value));return;}
      if(action==='pause'){paused=!paused;mainRenderer?.pause(paused);b.textContent=paused?t('继续转动','Resume rotation'):t('暂停转动','Pause rotation');b.setAttribute('aria-pressed',String(paused));return;}
      if(action==='reset'){selectedFlower=-1;mainRenderer?.reset();renderMemory();renderFlowerList();return;}
      if(action==='flowers-prev'||action==='flowers-next'){flowerPage+=action==='flowers-next'?1:-1;renderFlowerList();return;}
      if(action==='planets-prev'||action==='planets-next'){cardPage+=action==='planets-next'?1:-1;render();return;}
      if(['delete-planet','open-project','open-board','retry-save'].includes(action))onAction?.(action,value);
    }
    root.addEventListener('click',click);
    return{
      update(input={}){if(destroyed)return;const next=(input.planets||[]).map(p=>({...p,flowers:Array.isArray(p.flowers)?p.flowers:[]})),nextLanguage=input.language||'zh';const signature=JSON.stringify([nextLanguage,next]);if(signature!==lastSignature){lastSignature=signature;planets=next;language=nextLanguage;render();}let error=root.querySelector('.garden-planets-error');if(input.error){if(!error){error=el('div','garden-planets-error');error.setAttribute('role','alert');error.append(el('span','garden-planets-error-text'),button(t('重试保存','Retry save'),'retry-save',undefined,'garden-planets-retry'));root.prepend(error);}const message=error.querySelector('.garden-planets-error-text');if(message.textContent!==String(input.error))message.textContent=String(input.error);const retry=error.querySelector('.garden-planets-retry'),label=t('重试保存','Retry save');if(retry.textContent!==label)retry.textContent=label;}else error?.remove();},
      destroy(){if(destroyed)return;destroyed=true;dispose();root.removeEventListener('click',click);root.replaceChildren();root.classList.remove('garden-planets');}
    };
  }
  View.snapshot=async function(doc,planet,size=1300){const still=renderer(doc.createElement('canvas'),planet,{size});try{return await still.snapshot(size);}finally{still.destroy();}};
  View.geometry={rotate,unrotate,project,flowerView,positions,samplePositions,rarity,hash,terrain,biomes,biomeMix,isCyber,MAX_SPRITES};
  return View;
});
