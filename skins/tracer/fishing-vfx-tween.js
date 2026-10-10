(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingVFXTween=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const documents=new WeakMap(),limit=8;
  function manager(doc){
    if(documents.has(doc))return documents.get(doc);
    const m={entries:new Map(),pending:new Map(),queue:[],active:0,serial:0,worker:null,failed:false};documents.set(doc,m);
    const stop=()=>{m.worker?.terminate();m.worker=null;m.active=0;m.queue=[];for(const pending of m.pending.values())pending.done(null);m.pending.clear();};
    doc.defaultView?.addEventListener?.('pagehide',stop,{once:true});
    m.start=()=>{
      if(m.worker||m.failed)return;
      try{
        m.worker=new doc.defaultView.Worker('/fishing-vfx-tween-worker.js');
        m.worker.onmessage=event=>{const result=event.data,job=m.pending.get(result.id);m.active=0;m.pending.delete(result.id);job?.done(result.error?null:result);m.pump();};
        m.worker.onerror=()=>{m.failed=true;stop();};
      }catch(_){m.failed=true;}
    };
    m.pump=()=>{
      if(m.active||!m.worker)return;
      while(m.queue.length){const id=m.queue.shift(),job=m.pending.get(id);if(!job)continue;
        try{m.active=id;m.worker.postMessage(job.payload,[job.payload.data.buffer]);job.payload=null;}
        catch(_){m.active=0;m.pending.delete(id);job.done(null);continue;}break;
      }
    };
    return m;
  }
  function trim(m){
    while(m.entries.size>limit){const key=m.entries.keys().next().value,old=m.entries.get(key);m.entries.delete(key);old.evicted=true;old.cancel?.();if(old.canvas){old.canvas.width=old.canvas.height=1;old.canvas=null;}}
  }
  function prepare(doc,source,options={}){
    if(!doc?.defaultView?.Worker||!source?.getContext)return Promise.resolve(null);
    const m=manager(doc),known=m.entries.get(source);
    if(known){m.entries.delete(source);m.entries.set(source,known);return known.promise;}
    m.start();if(!m.worker)return Promise.resolve(null);
    const record={canvas:null,evicted:false,promise:null};m.entries.set(source,record);trim(m);
    record.promise=new Promise(resolve=>{
      try{
        const pixels=source.getContext('2d').getImageData(0,0,source.width,source.height),id=++m.serial;
        const done=result=>{
          if(!result||record.evicted){resolve(null);return;}
          try{
            const canvas=doc.createElement('canvas');canvas.width=result.width;canvas.height=result.height;
            const ctx=canvas.getContext('2d'),image=ctx.createImageData(result.width,result.height);image.data.set(result.data);ctx.putImageData(image,0,0);
            Object.assign(record,{canvas,size:result.size,columns:result.columns,count:result.count,steps:result.steps});resolve(record);
          }catch(_){resolve(null);}
        };
        record.cancel=()=>{m.pending.delete(id);m.queue=m.queue.filter(queued=>queued!==id);resolve(null);};
        m.pending.set(id,{done,payload:{id,data:pixels.data,width:source.width,height:source.height,joints:options.joints}});m.queue.push(id);m.pump();
      }catch(_){resolve(null);}
    });return record.promise;
  }
  function draw(ctx,entry,frame,x,y,w,h,alpha=1){
    const source=entry.display||entry.image,doc=ctx.canvas?.ownerDocument,m=documents.get(doc),record=m?.entries.get(source);
    if(!record?.canvas){if(record?.evicted||(!record&&m&&!m.failed))prepare(doc,source,entry);return false;}
    // Adjacent cached shapes are already deformed. Linear time never pauses at
    // the original key poses, and blends also cover refresh rates above 30 Hz.
    m.entries.delete(source);m.entries.set(source,record);
    const index=Math.max(0,Math.min(record.count-1,frame*record.steps)),a=Math.floor(index),b=Math.min(record.count-1,a+1),t=index-a;
    // Additive premultiplied blending in a tiny scratch surface avoids the
    // half-opacity dip of two source-over draws at every interpolation midpoint.
    if(!m.scratch){m.scratch=doc.createElement('canvas');m.scratch.width=m.scratch.height=record.size;}
    const scratch=m.scratch,sc=scratch.getContext('2d');sc.clearRect(0,0,record.size,record.size);sc.globalCompositeOperation='lighter';
    for(const [f,weight]of [[a,1-t],[b,t]])if(weight>.001){sc.globalAlpha=weight;sc.drawImage(record.canvas,f%record.columns*record.size,Math.floor(f/record.columns)*record.size,record.size,record.size,0,0,record.size,record.size);}
    ctx.globalAlpha=alpha;ctx.drawImage(scratch,x,y,w,h);return true;
  }
  function stats(doc){const m=documents.get(doc);return{cached:m?.entries.size||0,ready:m?[...m.entries.values()].filter(x=>x.canvas).length:0,pending:m?.pending.size||0,failed:!!m?.failed,limit};}
  return{prepare,draw,stats};
});
