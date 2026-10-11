(function(){
  'use strict';
  const bridge=window.GardenDesktop,regions=window.TracerGardenRegions,island=window.TracerGardenIsland3D;if(!bridge||!regions||!island)return;
  const frame=document.getElementById('desktop-garden'),scene=document.getElementById('garden-scene'),handle=document.getElementById('garden-drag'),label=document.getElementById('garden-label'),status=document.getElementById('garden-status'),open=document.getElementById('garden-open'),hide=document.getElementById('garden-hide');
  let snapshot=null,visible=false,disposed=false,drag=null,signature='',pendingId=null,lastRegions='',renderer=null,sceneKey='',failed=false;const point=e=>({screenX:e.screenX,screenY:e.screenY});
  function clear(){renderer?.destroy();renderer=null;scene.replaceChildren();signature='';sceneKey='';failed=false;}
  function select(id){const p=snapshot?.garden.plants.find(p=>p.id===id);if(!p||!visible||snapshot.busy||pendingId)return;if(p.canHarvest){pendingId=p.id;bridge.send({type:'harvest',id:p.id});paint();}else bridge.send({type:'open-garden'});}
  let lastPoints=[];
  function project(points){lastPoints=points;for(const p of points){const b=[...scene.querySelectorAll('.desktop-garden-plant')].find(b=>b.dataset.taskId===p.id);if(b){b.style.left=p.x+'px';b.style.top=(p.y-14)+'px';b.style.zIndex=String(20+Math.round(p.depth*10));}}}
  function publishRegions(){if(!snapshot)return;const r=frame.getBoundingClientRect(),value=[{x:r.x/innerWidth,y:r.y/innerHeight,width:r.width/innerWidth,height:r.height/innerHeight}],key=JSON.stringify([snapshot.nativeSessionId,value]);if(key!==lastRegions){lastRegions=key;bridge.send({type:'input-regions',value});}}
  function paint(){
    if(disposed)return;if(!visible||document.hidden||!snapshot){clear();document.body.dataset.paused='true';return;}document.body.dataset.paused='false';
    const en=snapshot.language==='en',t=(zh,english)=>en?english:zh,g=snapshot.garden,region=regions[g.farmId]||regions.meadow;
    document.documentElement.lang=en?'en':'zh-CN';label.textContent=region.name[en?1:0];open.title=open.ariaLabel=t('打开花园','Open garden');hide.title=hide.ariaLabel=t('收回桌面花园','Bring garden back');
    if(pendingId&&!g.plants.some(p=>p.id===pendingId&&p.canHarvest))pendingId=null;
    if(snapshot.error)pendingId=null;
    const key=JSON.stringify([g,en,snapshot.busy,pendingId]);
    if(signature!==key){signature=key;
      if(!renderer&&!failed){try{renderer=island.create(scene,{onSelect:select,onProject:project});}catch(error){failed=true;const message=document.createElement('p');message.className='garden-3d-error';message.textContent=t('无法启动 3D 显示，请打开花园继续使用。','3D display is unavailable. Open the garden to continue.');scene.append(message);}}
      for(const b of scene.querySelectorAll('.desktop-garden-plant'))b.remove();
      for(const p of g.plants){const b=document.createElement('button');b.className='desktop-garden-plant';b.type='button';b.dataset.taskId=p.id;b.dataset.mature=String(p.canHarvest);b.textContent=p.canHarvest?'✓':'·';b.title=p.title+' · '+(p.canHarvest?t('点击收获','Click to harvest'):t('正在生长，点击查看任务','Growing · Open task garden'));b.setAttribute('aria-label',b.title);b.disabled=!!snapshot.busy||!!pendingId;b.onclick=()=>select(p.id);scene.append(b);}
      const nextKey=JSON.stringify(g);if(renderer){if(sceneKey!==nextKey){sceneKey=nextKey;renderer.update(g);}else project(lastPoints);}
    }
    const mature=g.plants.filter(p=>p.canHarvest).length;
    status.textContent=snapshot.error?t('尚未保存，请打开花园重试。','Not saved. Open the garden to retry.'):snapshot.busy||pendingId?t('正在保存收获…','Saving your harvest…'):mature?t(mature+' 株已成熟 · 点击收获 · 拖动旋转',mature+' ready · Harvest · Drag to rotate'):g.total?t(g.total+' 株正在生长 · 拖动旋转',g.total+' growing · Drag to rotate'):t('开始任务就会播种 · 拖动旋转', 'Start a task to plant · Drag to rotate');publishRegions();
  }
  function end(e){if(!drag||drag.id!==e.pointerId)return;const p=drag;drag=null;bridge.send({type:'drag-end',value:e.type==='pointerup'?point(e):p.last});if(handle.hasPointerCapture?.(p.id))handle.releasePointerCapture(p.id);}
  handle.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button')||!visible||!snapshot)return;drag={id:e.pointerId,last:point(e)};handle.setPointerCapture(e.pointerId);bridge.send({type:'drag-start',value:drag.last});e.preventDefault();});
  handle.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){drag.last=point(e);bridge.send({type:'drag-move',value:drag.last});}});for(const name of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(name,end);
  frame.addEventListener('contextmenu',e=>{e.preventDefault();bridge.send({type:'context-menu'});});frame.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();bridge.send({type:'resize',value:(snapshot?.desktopScale||1)*(e.deltaY<0?1.08:1/1.08)});},{passive:false});
  open.onclick=()=>bridge.send({type:'open-garden'});hide.onclick=()=>bridge.send({type:'hide'});
  const offSnapshot=bridge.onSnapshot(value=>{if(snapshot?.nativeSessionId!==value.nativeSessionId)pendingId=null;snapshot=value;visible=value.desktopVisible===true;paint();});
  const offVisibility=bridge.onVisibility(value=>{visible=value.visible;if(value.clear){snapshot=null;pendingId=null;}if(!visible)drag=null;paint();});
  const hit=e=>{if(drag)return;const r=frame.getBoundingClientRect();bridge.send({type:'pointer-pass-through',value:e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom});};
  window.addEventListener('mousemove',hit);window.addEventListener('resize',publishRegions);document.addEventListener('visibilitychange',paint);
  window.addEventListener('beforeunload',()=>{disposed=true;offSnapshot();offVisibility();clear();window.removeEventListener('mousemove',hit);window.removeEventListener('resize',publishRegions);document.removeEventListener('visibilitychange',paint);});bridge.send({type:'ready'});
})();
