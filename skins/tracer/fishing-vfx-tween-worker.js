'use strict';
importScripts('/fishing-vfx-inbetweens.js');
self.onmessage=event=>{
  const {id,...input}=event.data;
  try{const result=self.TracerFishingVFXInbetweens.bake(input);self.postMessage({id,...result},[result.data.buffer]);}
  catch(error){self.postMessage({id,error:String(error.message||error)});}
};
