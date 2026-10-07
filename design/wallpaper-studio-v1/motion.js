'use strict';
// Scene paintings with local, depth-aware motion. Offline, silent and capped at 30 fps.
(function(){
  const W=1600,H=1000,TAU=Math.PI*2,cache=new Map(),pending=new WeakMap();
  const scriptURL=document.currentScript?.src||location.href;
  let seed=24681357;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const points=Array.from({length:160},()=>({x:random(),y:random(),r:random(),speed:random(),phase:random()*TAU}));
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const fract=v=>v-Math.floor(v);
  function noise(x,key=0){const i=Math.floor(x),f=fract(x),a=fract(Math.sin(i*127.1+key*311.7)*43758.5453),b=fract(Math.sin((i+1)*127.1+key*311.7)*43758.5453);return a+(b-a)*f*f*(3-2*f);}
  function sourceURL(item){return item.sceneAsset||new URL('wallpapers/dynamic-'+String(Number(item.id?.slice(1))||1).padStart(2,'0')+'-v2.png',scriptURL).href;}
  function resource(item){
    const url=sourceURL(item);if(cache.has(url))return cache.get(url);
    const image=new Image(),record={image,ready:false,error:false,url};
    record.promise=new Promise(resolve=>{
      image.onload=()=>{const ratio=W/H,actual=image.naturalWidth/image.naturalHeight;record.sw=actual>ratio?image.naturalHeight*ratio:image.naturalWidth;record.sh=actual>ratio?image.naturalHeight:image.naturalWidth/ratio;record.sx=(image.naturalWidth-record.sw)/2;record.sy=(image.naturalHeight-record.sh)/2;record.ready=true;resolve(record);};
      image.onerror=()=>{record.error=true;resolve(record);};
    });image.decoding='async';image.src=url;cache.set(url,record);return record;
  }
  function part(c,s,x,y,w,h,dx=x,dy=y,dw=w,dh=h){c.drawImage(s.image,s.sx+x/W*s.sw,s.sy+y/H*s.sh,w/W*s.sw,h/H*s.sh,dx,dy,dw,dh);}
  function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
  function clip(c,vertices){c.beginPath();vertices.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();}
  const sprites=new Map();
  function glow(c,x,y,r,color,opacity){
    let sprite=sprites.get(color);if(!sprite){sprite=document.createElement('canvas');sprite.width=sprite.height=96;const ctx=sprite.getContext('2d'),g=ctx.createRadialGradient(48,48,0,48,48,48);g.addColorStop(0,color);g.addColorStop(.13,color+'b0');g.addColorStop(.42,color+'32');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(0,0,96,96);sprites.set(color,sprite);}
    const alpha=c.globalAlpha;c.globalAlpha=opacity;c.drawImage(sprite,x-r,y-r,r*2,r*2);c.globalAlpha=alpha;
  }
  function stars(c,t,count=45){for(const p of points.slice(0,count)){const a=(.15+.75*Math.pow((Math.sin(t*1.1+p.phase)+1)/2,3))*p.r;glow(c,p.x*W,p.y*H*.43,3+p.r*5,'#d0e5ff',a);}}
  function water(c,s,t,start,vertices,strength=1){
    c.save();if(vertices)clip(c,vertices);
    if(!window.TracerWallpaperFlow?.draw(c,s,t,0,start,strength)){
      // No-GPU fallback: expanding surface wavelets, with an anchored backdrop.
      for(const p of points.slice(0,90)){const age=fract(p.y+t*(.12+p.speed*.08)),depth=age*age,y=start+depth*(H-start),x=p.x*W,r=8+depth*65;c.beginPath();c.ellipse(x,y,r,r*.09,0,Math.PI*.05,Math.PI*.95);c.strokeStyle='rgba(195,232,239,'+(Math.sin(age*Math.PI)*.20*strength)+')';c.lineWidth=.5+depth;c.stroke();}
    }c.restore();
  }
  const auroraLayers=new WeakMap();
  function aurora(c,s,t){
    let light=auroraLayers.get(s);
    if(!light){
      light=document.createElement('canvas');light.width=800;light.height=500;const q=light.getContext('2d');q.drawImage(s.image,s.sx,s.sy,s.sw,s.sh,0,0,800,500);
      try{const data=q.getImageData(0,0,800,500);for(let y=0;y<500;y++)for(let x=0;x<800;x++){const i=(y*800+x)*4,r=data.data[i],g=data.data[i+1],b=data.data[i+2],chroma=Math.max(r,g,b)-Math.min(r,g,b),sky=clamp((215-y)/45,0,1);data.data[i+3]=Math.round(255*sky*clamp((chroma-25)/65,0,1)*clamp((Math.max(r,g,b)-65)/90,0,1));}q.putImageData(data,0,0);}catch{q.clearRect(0,0,800,500);}auroraLayers.set(s,light);
    }
    // Energy travels through existing coloured curtains; geometry and stars stay put.
    c.save();c.globalCompositeOperation='screen';for(let x=0;x<800;x+=4){c.globalAlpha=.1+.85*Math.pow(noise(x*.018-t*.8,7),2);c.drawImage(light,x,0,4,500,x*2,0,8,1000);}c.restore();
    stars(c,t,32);water(c,s,t,660,[[220,660],[1390,660],[1210,865],[465,865]],.8);
  }
  function rain(c,s,t){
    // Each bead refracts the actual city behind it; the buildings never slide.
    for(const p of points.slice(0,62)){
      const cycle=fract(p.y+t*(.055+p.speed*.07)),fall=cycle*cycle,y=fall*(H+80)-40,x=p.x*W+(noise(fall*6,p.phase)-.5)*3,r=3+p.r*5.5;if(y<20||y>H-20)continue;
      c.beginPath();c.moveTo(x-.8,y-r*10);c.bezierCurveTo(x-2,y-r*6,x+1,y-r*3,x,y);c.strokeStyle='rgba(214,234,249,.28)';c.lineWidth=1+p.r*.9;c.stroke();
      c.save();c.beginPath();c.ellipse(x,y,r,r*(1.3+p.speed),0,0,TAU);c.clip();part(c,s,clamp(x-r*2,0,W-r*4),clamp(y-r*3,0,H-r*6),r*4,r*6,x-r,y-r*2,r*2,r*4);c.fillStyle='rgba(130,181,221,.07)';c.fillRect(x-r,y-r*2,r*2,r*4);c.restore();
      c.beginPath();c.ellipse(x,y,r,r*1.55,0,.2,Math.PI);c.strokeStyle='rgba(7,25,42,.46)';c.lineWidth=.75;c.stroke();ellipse(c,x-r*.34,y-r*.8,.45+p.r*.6,.7+p.r*.5,'rgba(229,246,255,.65)');
    }
    for(const p of points){const y=(p.y*H+t*(320+p.speed*300))%H;c.beginPath();c.moveTo(p.x*W,y);c.lineTo(p.x*W-6,y+19+p.r*22);c.strokeStyle='rgba(177,211,232,'+(.13+p.r*.13)+')';c.lineWidth=.8+p.r*.7;c.stroke();}
  }
  function fireflies(c,s,t){
    water(c,s,t,620,[[740,635],[975,635],[1060,700],[920,740],[710,710]],.9);
    for(const p of points.slice(0,55)){const z=.55+p.r*1.2,x=(.1+p.x*.8)*W+(noise(t*.55,p.phase)-.5)*220*z,y=(.24+p.y*.64)*H+(noise(t*.43,p.phase+20)-.5)*120*z,a=clamp((.18+Math.pow(noise(t*1.3,p.phase+40),3))*z,0,1);glow(c,x,y,23*z,'#d3ed95',a*.75);ellipse(c,x,y,1.9*z,2*z,'rgba(241,255,194,'+a+')');}
  }
  function petals(c,s,t){
    water(c,s,t,570,[[930,570],[1300,570],[W,920],[1060,H],[800,750]],.8);
    for(const p of points.slice(0,76)){
      const cycle=fract(p.y+t*(.028+p.speed*.04)),depth=.6+p.r*1.3,x=fract(p.x+t*(.024+depth*.013))*(W+140)-70+(noise(t*.5,p.phase)-.5)*12,y=cycle*(H+90)-45,r=(3.5+p.r*6)*depth,fade=clamp(Math.sin(cycle*Math.PI)*2,0,1),face=Math.cos(t*1.4+p.phase);
      c.save();c.translate(x,y);c.rotate(p.phase+t*(.6+p.speed*.4));c.scale(.3+Math.abs(face)*.7,1);c.globalAlpha=fade*(.6+p.r*.38);c.fillStyle=face>0?'#f9d9e3':'#c382a3';c.beginPath();c.moveTo(0,-r);c.bezierCurveTo(r*1.2,-r*.8,r*1.1,r*.6,0,r*1.2);c.bezierCurveTo(-r*.65,r*.4,-r,-r*.5,0,-r);c.fill();c.strokeStyle='#ffffff65';c.lineWidth=.55;c.beginPath();c.moveTo(0,-r*.5);c.quadraticCurveTo(r*.2,0,0,r*.8);c.stroke();c.restore();
    }
  }
  function tide(c,s,t){
    water(c,s,t,395,[[0,395],[W,395],[W,725],[1230,860],[740,960],[330,780],[0,570]],1.5);
    stars(c,t,24);
  }
  function nebula(c,s,t){window.TracerWallpaperFlow?.draw(c,s,t,2);stars(c,t,100);for(const p of points.slice(0,35)){const x=fract(p.x+t*(.004+p.r*.006))*W,y=fract(p.y-t*.003)*H;glow(c,x,y,4+p.r*5,'#e5c6ff',.25+p.r*.35);}}
  function snow(c,s,t){
    for(const p of points){const z=.3+p.r*p.r*1.4,cycle=fract(p.y+t*(.03+z*.045)),x=fract(p.x+t*(.009+z*.012))*(W+60)-30+(noise(t*.8,p.phase)-.5)*9*z,y=cycle*(H+40)-20,r=1.1+z*3.4,a=clamp((.4+z*.36)*Math.sin(cycle*Math.PI)*4,0,.95);glow(c,x,y,r*2.1,'#e9f4fa',a*.45);ellipse(c,x,y,r*.6,r*.6,'rgba(243,249,253,'+a+')');if(z>1.3){c.save();c.translate(x,y);c.rotate(t*.6+p.phase);c.strokeStyle='rgba(230,244,252,.65)';c.lineWidth=.8;for(let k=0;k<3;k++){c.rotate(Math.PI/3);c.beginPath();c.moveTo(-r,0);c.lineTo(r,0);c.stroke();}c.restore();}}
  }
  function embers(c,s,t){
    window.TracerWallpaperFlow?.draw(c,s,t,3);
    glow(c,800,720,310,'#ffad54',.05+noise(t*3.1,9)*.07);
    for(const p of points.slice(0,40)){const progress=fract(p.y+t*(.14+p.speed*.12)),x=800+(p.x-.5)*(170+progress*150)+(noise(progress*3,p.phase)-.5)*18,y=800-progress*(250+p.r*230),a=Math.pow(Math.sin(progress*Math.PI),2)*.9;glow(c,x,y,7+p.r*6,'#ffc47a',a*.65);ellipse(c,x,y,1.1+p.r,2+p.r*2,'rgba(255,222,161,'+a+')');}
  }
  function clouds(c,s,t){if(!window.TracerWallpaperFlow?.draw(c,s,t,1)){for(const p of points.slice(0,20)){const x=fract(p.x+t*(.009+p.y*.015))*(W+300)-150;glow(c,x,350+p.y*650,100+p.r*180,'#fff1df',.04);}}}
  function orbits(c,s,t){
    stars(c,t,70);c.save();c.translate(920,450);c.rotate(-.45);
    // Highlights travel on ring dust; no synthetic diagram lines are painted.
    for(const p of points.slice(0,90)){const a=p.phase+t*(.12+p.speed*.10),radius=.83+p.r*.15,x=Math.cos(a)*825*radius,y=Math.sin(a)*148*radius;if(x*x+y*y<300*300)continue;const fade=.35+.6*Math.pow((Math.sin(t*1.1+p.phase)+1)/2,2);glow(c,x,y,5+p.r*7,'#ead2a5',fade);ellipse(c,x,y,1+p.r*1.5,1+p.r*.8,'rgba(255,235,189,'+fade+')');if(p.r>.65){c.beginPath();c.ellipse(0,0,825*radius,148*radius,0,a-.055,a);c.strokeStyle='rgba(236,211,161,'+fade*.3+')';c.lineWidth=1.5;c.stroke();}}c.restore();
  }
  const effects={aurora,rain,fireflies,petals,tide,nebula,snow,embers,clouds,orbits};
  function draw(canvas,item,time=0){
    if(!item)return false;const c=canvas.getContext('2d');if(!c)return false;const s=resource(item);
    if(!s.ready){c.fillStyle=item.colors?.[0]||'#101923';c.fillRect(0,0,canvas.width,canvas.height);canvas.dataset.sceneReady=s.error?'error':'loading';if(!s.error&&pending.get(canvas)!==s){pending.set(canvas,s);s.promise.then(()=>{if(pending.get(canvas)!==s)return;pending.delete(canvas);if(canvas.isConnected)draw(canvas,item,time);});}return false;}
    pending.delete(canvas);canvas.dataset.sceneReady='true';canvas.dataset.sceneId=item.id;
    const scale=Math.max(canvas.width/W,canvas.height/H);c.save();c.setTransform(scale,0,0,scale,(canvas.width-W*scale)/2,(canvas.height-H*scale)/2);part(c,s,0,0,W,H);effects[item.effect]?.(c,s,time);c.restore();return true;
  }
  function player(canvas){
    let item=null,raf=0,last=0,elapsed=0,paused=false,inView=true,alive=true,generation=0,paintedAt=0,rate=1;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    function resize(){if(!alive)return;const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5),width=Math.max(1,Math.min(2560,Math.round(rect.width*dpr))),height=Math.max(1,Math.round(width*rect.height/Math.max(1,rect.width)));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}if(item)draw(canvas,item,elapsed);}
    function canRun(){return alive&&item&&!paused&&!document.hidden&&!reduced.matches&&inView;}
    function tick(now){raf=0;if(!canRun()){last=0;return;}if(!paintedAt||now-paintedAt>=1000/30){if(last)elapsed+=Math.min((now-last)/1000,.12)*rate;last=now;paintedAt=now;draw(canvas,item,elapsed);}raf=requestAnimationFrame(tick);}
    function sync(){if(raf)cancelAnimationFrame(raf);raf=0;last=paintedAt=0;if(canRun())raf=requestAnimationFrame(tick);}
    const ro=new ResizeObserver(resize);ro.observe(canvas);const io=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();});io.observe(canvas);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
    return{set(next){item=next;elapsed=0;const own=++generation;pending.delete(canvas);if(!item){canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);delete canvas.dataset.sceneReady;delete canvas.dataset.sceneId;}resize();sync();if(item)resource(item).promise.then(()=>{if(alive&&own===generation){resize();sync();}});},speed(value){rate=clamp(Number(value)||1,.4,2);canvas.dataset.motionSpeed=String(rate);},pause(value){paused=!!value;sync();},get reduced(){return reduced.matches;},destroy(){alive=false;generation++;pending.delete(canvas);cancelAnimationFrame(raf);ro.disconnect();io.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);}};
  }
  window.TracerWallpaperMotion={version:4,draw,player,load:item=>resource(item).promise};
})();
