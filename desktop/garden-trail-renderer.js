(function(){
  'use strict';
  const canvas=document.querySelector('canvas'),media=matchMedia('(prefers-reduced-motion: reduce)');
  // Small soft sprites do not need an unbounded Retina-sized full-screen buffer.
  const player=TracerGardenTrails.create(canvas,{maxDpr:1.5,maxPixels:3840*2160});
  function resize(){player.resize(innerWidth,innerHeight,devicePixelRatio);}
  function motion(){player.clear();window.GardenTrail?.motion(!media.matches);}
  window.GardenTrail?.onFrame(point=>{if(!media.matches)player.point(point);});
  addEventListener('resize',resize);media.addEventListener('change',motion);
  addEventListener('beforeunload',()=>{player.destroy();media.removeEventListener('change',motion);});
  resize();motion();
})();
