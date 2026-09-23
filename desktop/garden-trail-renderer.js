(function(){
  'use strict';
  const canvas=document.querySelector('canvas'),context=canvas.getContext('2d'),media=matchMedia('(prefers-reduced-motion: reduce)');
  const colors=['#ffe6a0','#d9c3ff','#bce8d2','#fff1c8'];let particles=[],last=null,raf=null,serial=0;
  function resize(){const ratio=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);context.setTransform(ratio,0,0,ratio,0,0);particles=[];last=null;}
  function clear(){particles=[];last=null;if(raf!==null)cancelAnimationFrame(raf);raf=null;context.clearRect(0,0,innerWidth,innerHeight);}
  function draw(at){
    raf=null;context.clearRect(0,0,innerWidth,innerHeight);particles=particles.filter(p=>at-p.at<650);
    for(const p of particles){const age=(at-p.at)/650,size=p.size*(1-age*.5),x=p.x+p.dx*age,y=p.y+age*13;context.globalAlpha=(1-age)*.72;context.fillStyle=colors[p.color];
      context.fillRect(Math.round(x-size/2),Math.round(y-size*1.5),Math.max(1,size),size*3);context.fillRect(Math.round(x-size*1.5),Math.round(y-size/2),size*3,Math.max(1,size));
    }context.globalAlpha=1;if(particles.length)raf=requestAnimationFrame(draw);
  }
  window.GardenTrail?.onFrame(point=>{
    if(media.matches)return;if(point.reset){clear();resize();}
    const at=performance.now();
    if(last){const distance=Math.hypot(point.x-last.x,point.y-last.y),count=Math.min(8,Math.floor(distance/7));for(let i=1;i<=count;i++){serial++;const t=i/count;particles.push({x:last.x+(point.x-last.x)*t,y:last.y+(point.y-last.y)*t,at,dx:(serial%5-2)*7,size:1.1+(serial%3)*.65,color:serial%colors.length});}}
    last=point;if(particles.length>96)particles.splice(0,particles.length-96);if(raf===null&&particles.length)raf=requestAnimationFrame(draw);
  });
  function motion(){clear();window.GardenTrail?.motion(!media.matches);}
  addEventListener('resize',resize);media.addEventListener('change',motion);resize();motion();
})();
