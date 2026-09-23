'use strict';
// Ten individually composed motion studies. All paths are time-continuous;
// particles fade at wrap boundaries and cached light sprites avoid per-frame blur.
(function(){
  const W=1600,H=1000,TAU=Math.PI*2,sprites=new Map();let seed=24681357;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const points=Array.from({length:720},()=>({x:random(),y:random(),r:random(),speed:random(),phase:random()*TAU}));
  const fract=v=>v-Math.floor(v),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,u)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-u)+parseInt(b.slice(i,i+2),16)*u).toString(16).padStart(2,'0')).join('');
  function glow(c,x,y,rx,ry,color,alpha){
    let s=sprites.get(color);if(!s){s=document.createElement('canvas');s.width=s.height=128;const q=s.getContext('2d'),g=q.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,color);g.addColorStop(.24,color+'b0');g.addColorStop(.58,color+'38');g.addColorStop(1,color+'00');q.fillStyle=g;q.fillRect(0,0,128,128);sprites.set(color,s);}
    c.globalAlpha=alpha;c.drawImage(s,x-rx,y-ry,rx*2,ry*2);c.globalAlpha=1;
  }
  function dot(c,x,y,r,color,alpha){c.globalAlpha=clamp(alpha,0,1);c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.globalAlpha=1;}
  function line(c,xy,color,alpha,width=1){c.globalAlpha=clamp(alpha,0,1);c.strokeStyle=color;c.lineWidth=width;c.beginPath();xy.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.globalAlpha=1;}
  function curve(fn,n=80){return Array.from({length:n+1},(_,i)=>fn(i/n));}
  // Translucent volume, a satin highlight, then a fine edge: not a stack of wire outlines.
  function ribbon(c,fn,width,a,b,alpha){
    const xy=curve(fn),normals=xy.map((p,i)=>{const q=xy[Math.min(i+1,xy.length-1)],r=xy[Math.max(0,i-1)],dx=q[0]-r[0],dy=q[1]-r[1],d=Math.hypot(dx,dy)||1;return[-dy/d,dx/d];});
    const edge=u=>xy.map(([x,y],i)=>{const w=width*Math.sin(i/(xy.length-1)*Math.PI)**.55;return[x+normals[i][0]*u*w,y+normals[i][1]*u*w];});
    const xs=xy.map(p=>p[0]),ys=xy.map(p=>p[1]),g=c.createLinearGradient(Math.min(...xs),Math.min(...ys)-width/2,Math.max(...xs),Math.max(...ys)+width/2);
    g.addColorStop(0,a+'00');g.addColorStop(.19,a+'a0');g.addColorStop(.43,b+'e0');g.addColorStop(.61,a+'a0');g.addColorStop(.82,b+'b0');g.addColorStop(1,b+'00');
    // Overlapping translucent folds avoid visible bands at full-screen resolution.
    for(let k=0;k<6;k++){const u=k/6,front=edge(-.5+u*.7),back=edge(.5-u*.2);c.globalAlpha=alpha*(k===0?.38:.16);c.fillStyle=g;c.beginPath();front.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));back.reverse().forEach(([x,y])=>c.lineTo(x,y));c.closePath();c.fill();}
    c.globalAlpha=1;line(c,edge(.24),mix(b,'#ffffff',.32),alpha*.5,1.2);line(c,edge(-.43),a,alpha*.2,.7);
  }
  function dust(c,t,color,count=100,drift=1){for(let i=0;i<count;i++){const p=points[i],u=fract(p.x+t*.002*drift*(.4+p.speed)),v=fract(p.y-t*.001*drift),fade=Math.sin(u*Math.PI)*Math.sin(v*Math.PI);dot(c,u*W,v*H,.6+p.r*1.35,color,fade*(.12+.4*p.r));}}
  function aurora(c,t,a,b){
    glow(c,510,470,890,650,a,.37);glow(c,1190,560,730,640,b,.42);
    for(let k=0;k<4;k++){
      const path=u=>{const x=-160+u*1920;return[x,470+Math.sin(u*6.1+t*.13+k*.44)*178+Math.sin(u*11-t*.075)*48+(k-1.5)*80];};
      ribbon(c,path,175+k*27,k%2?b:a,k%2?a:'#b0f5de',.35);
      for(let j=0;j<80;j++){const u=(j+points[j].r*.7)/80,[x,y]=path(u),h=45+95*(.5+.5*Math.sin(u*14+t*.12)),color=k%2?b:a,g=c.createLinearGradient(x,y-h,x,y+30);g.addColorStop(0,color+'00');g.addColorStop(.75,color+'28');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x,y-h,.6+points[j].speed*1.2,h+30);}
      for(let j=0;j<35;j++){const p=points[j+k*35],u=fract(p.x+t*.008),[x,y]=path(u);dot(c,x,y+(p.y-.5)*95,1+p.r*1.3,'#d8fff1',Math.sin(u*Math.PI)*.58);}
    }dust(c,t,'#b4cae7',90,.3);
  }
  function rain(c,t,a,b){
    glow(c,480,220,670,800,a,.65);glow(c,1160,840,650,350,b,.25);
    for(let k=0;k<12;k++){const x=90+k*137;glow(c,x,470,25,620,k%4===0?b:a,.06);}
    for(const p of points.slice(0,175)){
      const u=fract(p.y+t*(.023+p.speed*.043)),x=p.x*W+(p.r-.5)*15,y=u*1240-120,len=28+p.r**3*165,fade=Math.sin(u*Math.PI),color=p.speed>.84?b:a;
      const g=c.createLinearGradient(x,y-len,x,y);g.addColorStop(0,color+'00');g.addColorStop(.8,color+'70');g.addColorStop(1,color+'e0');c.globalAlpha=fade*(.3+p.r*.65);c.fillStyle=g;c.fillRect(x,y-len,.8+p.r*2.3,len);c.globalAlpha=1;
      if(p.r>.64){glow(c,x,y,7,18,color,fade*.48);dot(c,x,y,1.3,'#e2f1ff',fade*.78);}
    }
    for(let k=0;k<9;k++){const p=points[k+190],u=fract(p.y+t*.085),r=15+u*95;c.globalAlpha=Math.sin(u*Math.PI)*.19;c.strokeStyle=k%3?a:b;c.lineWidth=1.2;c.beginPath();c.ellipse(160+p.x*1300,710+p.r*200,r,r*.19,0,0,TAU);c.stroke();}c.globalAlpha=1;
  }
  function fireflies(c,t,a,b){
    glow(c,480,660,660,560,a,.65);glow(c,1120,370,650,530,a,.28);
    for(let k=0;k<3;k++)ribbon(c,u=>{const ang=-2.4+u*5.4;return[800+Math.cos(ang)*560,520+Math.sin(ang)*240+Math.sin(u*9+t*.11+k)*55+k*17];},34,a,b,.12);
    for(const p of points.slice(0,380)){
      const ang=p.phase+t*(.025+p.speed*.024),r=110+Math.sqrt(p.r)*560,x=800+Math.cos(ang)*r+Math.sin(t*.09+p.phase)*40,y=510+Math.sin(ang)*r*.58+Math.sin(ang*2+t*.16)*48;
      const pulse=.45+.55*(.5+.5*Math.sin(t*.62+p.phase))**2,alpha=(.23+p.speed*.66)*pulse;
      if(p.r>.72)glow(c,x,y,10+p.speed*17,10+p.speed*17,b,alpha*.36);
      dot(c,x,y,.7+p.speed*2.2,p.speed>.3?b:a,alpha);if(p.speed>.91)dot(c,x,y,.9,'#f4f4c6',alpha);
    }
    for(const p of points.slice(400,415))glow(c,p.x*W+Math.sin(t*.07+p.phase)*40,p.y*H,22+p.r*36,22+p.r*36,a,.12);
  }
  function petals(c,t,a,b){
    glow(c,420,300,830,620,a,.58);glow(c,1140,710,810,620,b,.33);
    for(let k=0;k<5;k++)ribbon(c,u=>{const x=-180+u*1980;return[x,890-u*780+Math.sin(u*7.5+t*.085+k*.47)*155+k*58-120];},90+k*24,k%2?a:'#825376',b,.32);
    for(const p of points.slice(0,100)){
      const u=fract(p.x+t*.007),x=u*1840-120,y=p.y*H+Math.sin(t*.18+p.phase)*35-80*u,fade=Math.sin(u*Math.PI)*(.2+p.r*.35),s=2+p.r*5;
      c.save();c.translate(x,y);c.rotate(p.phase+t*.065);c.scale(.3+.7*Math.abs(Math.sin(t*.12+p.phase)),1);c.globalAlpha=fade;c.fillStyle=b;c.beginPath();c.moveTo(-s,0);c.quadraticCurveTo(0,-s*1.1,s,0);c.quadraticCurveTo(0,s*.6,-s,0);c.fill();c.restore();
    }
  }
  function tide(c,t,a,b){
    glow(c,1140,650,810,750,a,.53);glow(c,400,190,610,530,b,.16);
    const path=(u,k)=>{const x=-100+u*1800;return[x,40+k*21+Math.sin(u*7+t*.105+k*.072)*(78+Math.sin(k*.08)*52)+Math.sin(u*13-t*.075+k*.09)*28];};
    for(let k=0;k<46;k++){const major=k%7===0;line(c,curve(u=>path(u,k)),major?b:a,major?.53:.23,major?1.8:1);}
    for(let k=0;k<4;k++)ribbon(c,u=>path(u,9+k*10),36,a,b,.15);
    for(const p of points.slice(0,120)){const u=fract(p.x+t*.007),[x,y]=path(u,Math.floor(p.y*45));dot(c,x,y,.75+p.r,b,Math.sin(u*Math.PI)*(.3+p.r*.5));}dust(c,t,b,45,.4);
  }
  function nebula(c,t,a,b){
    glow(c,840,480,760,590,a,.58);glow(c,1070,540,490,400,b,.38);glow(c,810,490,230,180,'#d2bce9',.3);
    const spiral=(u,arm,offset=0)=>{const r=45+u*650,angle=u*5.7+t*.035+arm*Math.PI+offset;return[830+Math.cos(angle)*r,490+Math.sin(angle)*r*.54];};
    for(let k=0;k<2;k++)ribbon(c,u=>spiral(u,k),115,a,b,.28);
    for(const p of points){const arm=p.y>.5?1:0,u=p.r,[x,y]=spiral(u,arm,(p.x-.5)*(.38+u*.65)),scatter=(p.speed-.5)*60*u;dot(c,x,y+scatter,.55+p.speed*1.65,p.speed>.65?'#e7d3f7':p.x>.5?b:a,.22+p.speed*.66);if(p.speed>.976)glow(c,x,y,13,13,'#e7d3f7',.27);}
    dust(c,t,'#bbc8ed',90,.17);
  }
  function snow(c,t,a,b){
    glow(c,400,250,1000,680,a,.57);glow(c,1290,710,700,580,b,.22);
    // Broad translucent bevels suggest frosted crystal rather than literal scenery.
    for(let k=0;k<4;k++){const drift=Math.sin(t*.04+k)*30,x=100+k*430+drift;c.globalAlpha=.07;c.fillStyle=b;c.beginPath();c.moveTo(x-180,-100);c.lineTo(x+40,-100);c.lineTo(x+540,1100);c.lineTo(x+100,1100);c.closePath();c.fill();line(c,[[x+40,-100],[x+540,1100]],b,.11,1);}
    c.globalAlpha=1;
    for(const p of points.slice(0,175)){const u=fract(p.y+t*(.008+p.speed*.013)),x=p.x*W+Math.sin(t*.14+p.phase)*46,y=u*1180-90,alpha=Math.sin(u*Math.PI)*(.2+p.r*.55);if(p.r>.86)glow(c,x,y,18+p.speed*30,18+p.speed*30,b,alpha*.38);else dot(c,x,y,.7+p.r*2.1,b,alpha);if(p.speed>.95){line(c,[[x-4,y],[x+4,y]],b,alpha*.8,.7);line(c,[[x,y-4],[x,y+4]],b,alpha*.8,.7);}}
  }
  function embers(c,t,a,b){
    glow(c,760,1010,980,640,a,.78);glow(c,1050,700,600,650,b,.21);
    for(let k=0;k<3;k++)ribbon(c,u=>[600+k*160+Math.sin(u*6-t*.12+k*.9)*(50+u*145),1150-u*1080],80-k*15,a,b,.21);
    for(const p of points.slice(0,245)){
      const u=fract(p.y+t*(.014+p.speed*.017)),y=H+80-u*1220,x=800+(p.x-.5)*(360+u*560)+Math.sin(u*7+p.phase+t*.1)*(40+u*130),alpha=Math.sin(u*Math.PI)*(.3+p.r*.6);
      if(p.r>.67){line(c,[[x-4,y+16+p.speed*14],[x,y]],a,alpha*.54,1.1);glow(c,x,y,9+p.r*6,9+p.r*6,b,alpha*.26);}
      dot(c,x,y,.7+p.r*1.75,p.r>.4?b:a,alpha);if(p.speed>.96)dot(c,x,y,.8,'#fff0bd',alpha);
    }
  }
  function clouds(c,t,a,b){
    // Low-frequency pearlescent colour fields, with folded edges and drifting glass beads.
    glow(c,320+Math.sin(t*.055)*150,330,920,720,a,.75);glow(c,1260+Math.cos(t*.047)*120,640,920,730,b,.67);glow(c,840,80,620,580,'#b2b5ed',.38);
    for(let k=0;k<3;k++)ribbon(c,u=>{const angle=-2.9+u*5.3;return[800+Math.cos(angle)*(570+k*60),530+Math.sin(angle)*(240+k*35)+Math.sin(u*8+t*.085+k)*90];},125,k%2?a:'#bcb3e5',b,.2);
    for(const p of points.slice(0,65)){const u=fract(p.x+t*.003),x=u*W,y=p.y*H+Math.sin(t*.1+p.phase)*25,r=2+p.r**3*15,alpha=Math.sin(u*Math.PI)*(.12+p.r*.2);glow(c,x,y,r*2,r*2,b,alpha);if(p.r>.83){c.globalAlpha=alpha;c.strokeStyle='#fff1df';c.lineWidth=.9;c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();c.globalAlpha=1;}}
    dust(c,t,'#fff4e4',100,.25);
  }
  function orbits(c,t,a,b){
    glow(c,800,500,710,620,a,.37);glow(c,800,500,260,260,b,.18);
    for(let k=0;k<7;k++){
      const angle=-.62+k*.16+Math.sin(t*.024+k)*.025,rx=235+k*63,ry=rx*(.36+k*.032);
      const pos=u=>{const x=Math.cos(u)*rx,y=Math.sin(u)*ry;return[800+x*Math.cos(angle)-y*Math.sin(angle),500+x*Math.sin(angle)+y*Math.cos(angle)];};
      line(c,curve(u=>pos(u*TAU),130),k%2?a:b,k%2?.28:.48,k%2?.85:1.35);
      const head=t*(.035+k*.004)+k*.86;for(let j=0;j<28;j++)line(c,[pos(head-j*.015),pos(head-(j+1)*.015)],b,(1-j/28)*.7,2.2);
      const [x,y]=pos(head);glow(c,x,y,18,18,b,.45);dot(c,x,y,2.2,'#fff2d1',.95);
      for(let j=0;j<20;j++){const p=points[k*20+j],[px,py]=pos(p.phase+t*(.02+p.speed*.03));dot(c,px,py,.6+p.r,b,.25+p.r*.48);}
    }dust(c,t,b,100,.15);
  }
  const effects={aurora,rain,fireflies,petals,tide,nebula,snow,embers,clouds,orbits};
  function draw(canvas,item,time=0){
    if(!item)return false;const c=canvas.getContext('2d');if(!c)return false;const palette=(item.colors||['#08182b','#53d2b5','#9472dc']).map(x=>/^#[a-f0-9]{6}$/i.test(x)?x:'#203443');
    const t=Number.isFinite(time)?Math.max(0,time):0,scale=Math.max(canvas.width/W,canvas.height/H);c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.fillStyle=palette[0];c.fillRect(0,0,canvas.width,canvas.height);c.setTransform(scale,0,0,scale,(canvas.width-W*scale)/2,(canvas.height-H*scale)/2);
    (effects[item.effect]||aurora)(c,t,palette[1]||palette[0],palette[2]||palette[0]);
    const vignette=c.createRadialGradient(800,500,250,800,500,1050);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#00000030');c.fillStyle=vignette;c.fillRect(0,0,W,H);c.restore();canvas.dataset.sceneReady='true';canvas.dataset.sceneId=item.id;canvas.dataset.renderer='particles';return true;
  }
  function player(canvas){
    let item=null,raf=0,last=0,elapsed=0,paused=false,inView=true,alive=true,paintedAt=0,rate=1;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    function resize(){if(!alive)return;const r=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5,1920/Math.max(1,r.width),1600/Math.max(1,r.height)),w=Math.max(1,Math.round(r.width*ratio)),h=Math.max(1,Math.round(r.height*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}if(item)draw(canvas,item,elapsed);}
    function canRun(){return alive&&item&&!paused&&!(document.hidden || document.tracerHidden)&&!reduced.matches&&inView;}
    function tick(now){raf=0;if(!canRun()){last=0;return;}if(!paintedAt||now-paintedAt>=1000/30){if(last)elapsed+=Math.min((now-last)/1000,.12)*rate;last=now;paintedAt=now;draw(canvas,item,elapsed);}raf=requestAnimationFrame(tick);}
    function sync(){if(raf)cancelAnimationFrame(raf);raf=0;last=paintedAt=0;if(canRun())raf=requestAnimationFrame(tick);}
    const ro=new ResizeObserver(resize);ro.observe(canvas);const io=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();});io.observe(canvas);['visibilitychange','tracer-visibilitychange'].forEach(event=>document.addEventListener(event,sync));reduced.addEventListener('change',sync);
    return{set(next){if(!alive)return;item=next;elapsed=0;if(!item){canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);delete canvas.dataset.sceneReady;delete canvas.dataset.sceneId;}resize();sync();},speed(value){rate=clamp(Number(value)||1,.4,2);canvas.dataset.motionSpeed=String(rate);},pause(value){paused=!!value;sync();},get reduced(){return reduced.matches;},destroy(){alive=false;cancelAnimationFrame(raf);ro.disconnect();io.disconnect();['visibilitychange','tracer-visibilitychange'].forEach(event=>document.removeEventListener(event,sync));reduced.removeEventListener('change',sync);}};
  }
  window.TracerWallpaperMotion={version:6,draw,player,load:item=>Promise.resolve({ready:true,procedural:true,id:item.id})};
})();
