(function(root){
  'use strict';
  // Centre of the left illustration panel (52% of the card), not the PNG canvas.
  const defaults=Object.freeze({x:26,y:50,size:46});
  const clamp=(n,low,high,fallback)=>Number.isFinite(n)?Math.max(low,Math.min(high,n)):fallback;
  function normalize(value){return{x:clamp(value?.x,5,95,defaults.x),y:clamp(value?.y,5,95,defaults.y),size:clamp(value?.size,20,72,defaults.size)};}
  function storageKey(scope,planetId){return 'tracer.postcard-world.v1:'+encodeURIComponent(scope)+':'+encodeURIComponent(planetId);}
  function read(storage,scope,planetId){try{const value=JSON.parse(storage.getItem(storageKey(scope,planetId)));if(value?.x===27&&value?.y===57&&value?.size===46)return{...defaults};return normalize(value);}catch{return{...defaults};}}
  function save(storage,scope,planetId,value){try{storage.setItem(storageKey(scope,planetId),JSON.stringify(normalize(value)));return true;}catch{return false;}}
  function rect(value,width=2400,height=1600){const v=normalize(value),size=v.size/100*width;return{x:v.x/100*width-size/2,y:v.y/100*height-size/2,size};}
  function forStyle(value,centre=defaults){const v=normalize(value);return normalize({...v,x:v.x+centre.x-defaults.x,y:v.y+centre.y-defaults.y});}
  function alphaBounds(pixels,width,height){let left=width,top=height,right=-1,bottom=-1;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>=32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return right<0?{x:0,y:0,width,height}:{x:left,y:top,width:right-left+1,height:bottom-top+1};}
  const boundsCache=new WeakMap();
  function contentBox(image,doc){let box=boundsCache.get(image);if(box)return box;const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height,probe=doc.createElement('canvas'),scale=Math.min(1,384/Math.max(width,height));probe.width=Math.round(width*scale);probe.height=Math.round(height*scale);const ctx=probe.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,probe.width,probe.height);const b=alphaBounds(ctx.getImageData(0,0,probe.width,probe.height).data,probe.width,probe.height);box={width,height,bounds:{x:b.x*width/probe.width,y:b.y*height/probe.height,width:b.width*width/probe.width,height:b.height*height/probe.height}};boundsCache.set(image,box);return box;}
  function fittedRect(value,box,width=2400,height=1600){const v=normalize(value),b=box.bounds,scale=v.size/100*width*.84/Math.max(b.width,b.height);return{x:v.x/100*width-(b.x+b.width/2)*scale,y:v.y/100*height-(b.y+b.height/2)*scale,width:box.width*scale,height:box.height*scale};}
  const api={defaults,normalize,read,save,rect,forStyle,alphaBounds,contentBox,fittedRect};if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerPostcardWorldLayout=api;
})(typeof window!=='undefined'?window:globalThis);
