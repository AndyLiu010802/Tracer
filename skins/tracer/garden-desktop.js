(function(){
  'use strict';
  const bridge=window.GardenDesktop,regions=window.TracerGardenRegions;if(!bridge||!regions)return;
  const frame=document.getElementById('desktop-garden'),scene=document.getElementById('garden-scene'),handle=document.getElementById('garden-drag'),label=document.getElementById('garden-label'),announcement=document.getElementById('garden-announcement'),open=document.getElementById('garden-open'),hide=document.getElementById('garden-hide');
  let world=null;
  let snapshot=null,visible=false,disposed=false,drag=null,signature='',pendingId=null,lastRegions='';const point=e=>({screenX:e.screenX,screenY:e.screenY});
  function clear(){world?.destroy();world=null;scene.replaceChildren();signature='';}
  function select(id){const p=snapshot?.garden.plants.find(p=>p.id===id);if(!p||!visible||snapshot.busy||pendingId)return;if(p.canHarvest){pendingId=p.id;bridge.send({type:'harvest',id:p.id});paint();}else bridge.send({type:'open-garden'});}
  function publishRegions(){if(!snapshot)return;const r=frame.getBoundingClientRect(),value=[{x:r.x/innerWidth,y:r.y/innerHeight,width:r.width/innerWidth,height:r.height/innerHeight}],key=JSON.stringify([snapshot.nativeSessionId,value]);if(key!==lastRegions){lastRegions=key;bridge.send({type:'input-regions',value});}}
  function paint(){
    if(disposed)return;if(!visible||document.hidden||!snapshot){clear();document.body.dataset.paused='true';return;}document.body.dataset.paused='false';
    const en=snapshot.language==='en',t=(zh,english)=>en?english:zh,g=snapshot.garden,region=regions[g.farmId]||regions.meadow;
    document.documentElement.lang=en?'en':'zh-CN';label.textContent=region.name[en?1:0];open.title=open.ariaLabel=t('打开花园','Open garden');hide.title=hide.ariaLabel=t('收回桌面花园','Bring garden back');
    if(pendingId&&!g.plants.some(p=>p.id===pendingId&&p.canHarvest))pendingId=null;
    if(snapshot.error)pendingId=null;
    const key=JSON.stringify([g,en,snapshot.busy,pendingId]);
    if(signature!==key){signature=key;
        scene.classList.add('garden-home');
        if(!world)world=window.TracerGardenWorldView(scene,window.TracerGardenPlantArt.markup,(type,id)=>{if(type==='select-plant')select(id);else bridge.send({type:'open-garden'});},{compact:true});
        const catalog=window.TaskGarden.collectibles({});
        const plots=g.plants.map(p=>({projectId:p.id,taskId:p.id,name:p.title,plant:p.kind,stage:p.stage,harvest:{harvestedAt:null},completedCount:p.canHarvest?1:0}));
        world.update({language:snapshot.language,plots,scenePlots:plots,economy:{equippedFarmId:g.farmId},collectibles:{...catalog,placements:g.placements||[],items:catalog.items.map(i=>({...i,owned:(g.placements||[]).some(p=>p.itemId===i.id)}))},busy:snapshot.busy||!!pendingId,journey:{level:g.level||1,xp:0,next:null,progress:0,milestones:[]}});
        world.surface.querySelectorAll('.garden-world-plot').forEach((b,i)=>{const p=g.plants[i];b.disabled=!p||!!snapshot.busy||!!pendingId;b.dataset.mature=String(!!p?.canHarvest);if(p){b.title=p.title+' · '+(p.canHarvest?t('点击收获','Click to harvest'):t('正在生长，点击查看任务','Growing · Open task garden'));b.setAttribute('aria-label',b.title);}});
    }
    announcement.textContent=snapshot.error?t('尚未保存，请打开花园重试。','Not saved. Open garden to retry.'):'';
    open.dataset.error=String(!!snapshot.error);if(snapshot.error)open.title=open.ariaLabel=announcement.textContent;
    publishRegions();
  }
  function end(e){if(!drag||drag.id!==e.pointerId)return;const p=drag;drag=null;delete frame.dataset.dragging;bridge.send({type:'drag-end',value:e.type==='pointerup'?point(e):p.last});if(handle.hasPointerCapture?.(p.id))handle.releasePointerCapture(p.id);}
  handle.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button')||!visible||!snapshot)return;drag={id:e.pointerId,last:point(e)};frame.dataset.dragging='true';handle.setPointerCapture(e.pointerId);bridge.send({type:'drag-start',value:drag.last});e.preventDefault();});
  handle.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){drag.last=point(e);bridge.send({type:'drag-move',value:drag.last});}});for(const name of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(name,end);
  frame.addEventListener('contextmenu',e=>{e.preventDefault();bridge.send({type:'context-menu'});});frame.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();bridge.send({type:'resize',value:(snapshot?.desktopScale||1)*(e.deltaY<0?1.08:1/1.08)});},{passive:false});

  open.onclick=()=>bridge.send({type:'open-garden'});hide.onclick=()=>bridge.send({type:'hide'});
  const offSnapshot=bridge.onSnapshot(value=>{if(snapshot?.nativeSessionId!==value.nativeSessionId){pendingId=null;clear();}snapshot=value;visible=value.desktopVisible===true;paint();});
  const offVisibility=bridge.onVisibility(value=>{visible=value.visible;if(value.clear){snapshot=null;pendingId=null;}if(!visible){drag=null;delete frame.dataset.dragging;}paint();});
  const hit=e=>{if(drag)return;const r=frame.getBoundingClientRect();bridge.send({type:'pointer-pass-through',value:e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom});};
  window.addEventListener('mousemove',hit);window.addEventListener('resize',publishRegions);document.addEventListener('visibilitychange',paint);
  window.addEventListener('beforeunload',()=>{disposed=true;offSnapshot();offVisibility();clear();window.removeEventListener('mousemove',hit);window.removeEventListener('resize',publishRegions);document.removeEventListener('visibilitychange',paint);});bridge.send({type:'ready'});
})();
