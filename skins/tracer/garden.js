(function () {
  'use strict';
  const T=window.Tracer,M=window.TracerModel,G=window.TaskGarden;
  const home=document.getElementById('garden-home-root'),planetHost=document.getElementById('garden-planets-root');
  let view=null,planetView=null,storeView=null,initialized=false,error='',busy=false;
  const tr=(zh,en)=>TracerLocale.language()==='zh'?zh:en;
  const accepted=()=>T.store.base||T.store.data;
  function failure(){return tr('更改尚未保存。请保持窗口打开并重试，已有花朵和收藏不会被重新抽取。','Changes have not been saved. Keep this window open and retry. Existing seeds and collections keep their original draw.');}
  async function persist(){
    T.touch();clearTimeout(T.store.timer);T.saveNow();
    const deadline=Date.now()+20000;
    while(T.store.inflight&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,40));
    if(T.store.dirty||T.store.inflight||T.store.conflict||T.store.lost)throw new Error('garden-save-pending');
  }
  async function change(callback){
    if(busy||!T.store.data||T.store.lost)return;
    busy=true;
    try{callback(T.store.data);render();await persist();error='';T.pet?.refresh(true);T.renderProjects?.();}
    catch{error=failure();}
    finally{busy=false;render();}
  }
  function initialize(){
    if(initialized||!T.store.data||T.store.lost)return;
    initialized=true;
    try{
      const before=JSON.stringify(T.store.data.taskGarden);
      // Import memories without overwriting the original local garden save.
      const raw=localStorage.getItem(TracerGardenHarvest.key);
      if(raw){try{G.importLegacy(T.store.data,TracerGardenHarvest.read(JSON.parse(raw)).records);}catch{error=tr('旧花园记录暂时无法读取，原存档已保留。','The old garden record could not be read. Its original save is kept.');}}
      G.reconcile(T.store.data);
      if(before!==JSON.stringify(T.store.data.taskGarden))persist().then(()=>{T.pet?.refresh(true);render();}).catch(()=>{error=failure();render();});
    }catch{error=failure();}
  }
  function snapshot(){
    const ws=accepted(),focus=T.focus.read(),now=Date.now(),data=G.read(ws),collection=G.collection(ws);
    const archived=new Set(data.planets.map(p=>p.projectId));
    const plots=G.active(ws).filter(seed=>!archived.has(seed.projectId)).map(seed=>{
      const task=M.findTask(ws,seed.taskId),minutes=focus.history.filter(row=>row.task?.id===seed.taskId).reduce((sum,row)=>sum+row.minutes,0);
      const checks=task?.checklist||[],ratio=checks.length?checks.filter(row=>row.done).length/checks.length:0;
      const stage=seed.state==='mature'?4:task?.status==='review'?3:minutes>=10||ratio>=.5?2:minutes>0||ratio>0?1:0;
      return {projectId:seed.taskId,taskId:seed.taskId,parentProjectId:seed.projectId,taskExists:!!task,name:seed.title,plant:seed.plantKind,stage,
        color:M.findProject(ws,seed.projectId)?.color,done:stage===4?1:0,total:1,completedCount:stage===4?1:0,focusMinutes:minutes,
        growth:{bond:Math.min(3,Math.floor(minutes/25)),progress:stage/4,remaining:1},bloomAt:seed.completedAt,
        harvest:{...seed,rarity:stage===4?seed.variant:'normal'},activeFocus:focus.running&&focus.mode==='focus'&&focus.task?.id===seed.taskId};
    });
    const collected=data.seeds.filter(seed=>seed.harvestedAt),completed=data.seeds.filter(seed=>seed.completedAt);
    const xp=completed.length*10+collected.length*30+Math.floor(focus.totalMinutes/5),thresholds=[0,30,100,250,500,1000];
    const index=thresholds.findLastIndex(value=>xp>=value),next=thresholds[index+1]??null;
    const pets=T.pet?.read(),pet=pets&&TracerPetModel.catalog(pets).find(item=>item.id===pets.selected);
    const today=TracerFocus.dayKey(now),todayTasks=TaskHistory.completed(ws).filter(row=>TracerFocus.dayKey(row.completedAt)===today).length;
    const deletedProjects=new Set((ws.projectDeletions||[]).map(row=>row.id));
    const events=data.seeds.filter(seed=>!seed.forgottenAt&&seed.title&&!deletedProjects.has(seed.projectId)&&(seed.harvestedAt||seed.completedAt||seed.state==='growing')).map(seed=>({type:seed.harvestedAt?'harvest':seed.completedAt?'bloom':'seed',title:seed.title,at:seed.harvestedAt||seed.completedAt||seed.plantedAt,projectName:M.findProject(ws,seed.projectId)?.name||''})).sort((a,b)=>b.at-a.at).slice(0,5);
    return {language:TracerLocale.language(),plots,collection,harvests:{total:collected.length},events,
      inventory:G.inventory(ws),economy:G.economy(ws),farms:G.farms(ws),collectibles:G.collectibles(ws),stickers:G.stickers(ws),wallpapers:data.market.wallpapers||null,companionPlacement:G.companionPlacement(ws),
      journey:{level:index+1,xp,next,progress:next===null?1:(xp-thresholds[index])/(next-thresholds[index]),milestones:[]},
      today:{tasks:todayTasks,minutes:focus.history.filter(row=>TracerFocus.dayKey(row.endedAt)===today).reduce((sum,row)=>sum+row.minutes,0)},
      pet,petSleeping:!!(pets&&TracerPetModel.current(pets).sleeping),focus:{running:focus.running&&focus.mode==='focus',clock:TracerFocus.format(TracerFocus.remaining(focus,now))},
      error:error||(T.store.dirty&&!T.store.inflight?tr('有更改等待保存，收藏以已保存的记录为准。','Some changes await saving. Collections reflect saved records.') :''),busy:busy||T.store.inflight};
  }
  function render(){
    if((document.hidden || document.tracerHidden)||!T.store.data||!T.focus)return;
    try{
      if(T.currentSec()==='garden'){
        if(!view)view=TracerGardenHomeView(home,action);
        view.update(snapshot());
      }else if(T.currentSec()==='shop'){
        if(!storeView)storeView=TracerGardenStoreView(document.getElementById('garden-store-root'),action);
        storeView.update(snapshot());
      }else if(T.currentSec()==='planets'){
        if(!planetView)planetView=TracerGardenPlanetsView(planetHost,planetAction);
        planetView.update({language:TracerLocale.language(),planets:G.read(accepted()).planets,error:error||(T.store.dirty&&!T.store.inflight?failure():'')});
      }
    }catch(err){error=failure();console.error('[task garden]',err);}
  }
  function refresh(){initialize();if(error===failure()&&!busy&&!T.store.dirty&&!T.store.inflight&&!T.store.conflict&&!T.store.lost)error='';render();return Promise.resolve();}
  function stop(){view?.destroy();view=null;planetView?.destroy();planetView=null;storeView?.destroy();storeView=null;}
  function open(taskId){T.show('garden');if(taskId)view?.selectTask?.(taskId);}
  function action(type,value){
    if(type==='open-shop')return T.show('shop');
    if(type==='open-garden')return T.show('garden');
    if(type==='open-companion')return T.pet?.open();
    if(type==='open-planets')return T.show('planets');
    if(type==='open-board'||type==='add-plot')return T.show('board');
    if(type==='open-task'||type==='open-project'){if(M.findTask(T.store.data,value))T.openTask?.(value);return;}
    if(type==='focus-task'||type==='focus-project'){if(M.findTask(T.store.data,value))T.focus.openForTask(value);return;}
    if(type==='retry-save')return change(()=>{});
    if(type==='harvest')return change(ws=>G.harvest(ws,value));
    if(['sell-plants','buy-farm','equip-farm','buy-collectible','equip-collectible','wish-collectible','layout-collectible','layout-companion','buy-sticker'].includes(type)){
      if(busy||T.store.inflight||T.store.dirty||T.store.conflict||T.store.lost){error=failure();render();return;}
      return change(ws=>{
        const result=type==='buy-sticker'?G.buySticker(ws,value.itemId):type==='sell-plants'?G.sell(ws,value.plantKind,value.quantity):type==='buy-farm'?G.buyFarm(ws,value.farmId):type==='equip-farm'?G.equipFarm(ws,value.farmId):type==='buy-collectible'?G.buyCollectible(ws,value.itemId):type==='equip-collectible'?G.equipCollectible(ws,value.itemId):type==='layout-collectible'?G.layoutCollectible(ws,value):type==='layout-companion'?G.layoutCompanion(ws,value):G.wishCollectible(ws,value.itemId);
        if(!result?.ok)throw new Error(result?.reason||'market-action-failed');
      });
    }
  }
  function planetAction(type,value){
    if(type==='open-board')return T.show('board');
    if(type==='retry-save')return change(()=>{});
    if(type==='open-project'){
      const ws=accepted(),planet=G.read(ws).planets.find(row=>row.projectId===value);if(!planet)return;
      T.ui.modal((box,close)=>{
        box.classList.add('garden-memory-dialog');box.setAttribute('aria-labelledby','garden-memory-title');const heading=document.createElement('h2');heading.id='garden-memory-title';heading.textContent=planet.name;box.appendChild(heading);
        const info=document.createElement('p');info.textContent=tr('项目已完成归档 · ','Completed and archived · ')+planet.taskCount+tr(' 项任务 · ',' tasks · ')+planet.flowers.length+tr(' 朵纪念花',' memory flowers');box.appendChild(info);
        const list=document.createElement('ul');list.className='garden-memory-tasks';box.appendChild(list);
        const records=new Map();TaskHistory.completed(ws).filter(row=>row.projectId===value).forEach(row=>records.set(row.taskId,row.title));planet.flowers.forEach(row=>records.set(row.taskId,row.title));
        for(const title of records.values()){const item=document.createElement('li');item.textContent='✓ '+title;list.appendChild(item);}
        if(!records.size){const empty=document.createElement('p');empty.textContent=tr('这里珍藏着项目完成的这一刻。','This planet remembers the moment your project was completed.');box.appendChild(empty);}
        const actions=document.createElement('div');actions.className='modal-actions';const done=document.createElement('button');done.type='button';done.className='btn';done.textContent=tr('返回星球','Back to planet');done.onclick=close;actions.appendChild(done);box.appendChild(actions);
      });return;
    }
    if(type==='delete-planet'){
      const planet=G.read(T.store.data).planets.find(row=>row.id===value);if(!planet)return;
      T.confirmTaskAction({title:tr('删除这颗收藏星球？','Delete this memory planet?'),
        body:tr('“'+planet.name+'”的星球及已归档项目、任务、笔记将被删除，无法撤销。','The planet, archived project, its tasks and notes for “'+planet.name+'” will be deleted. This cannot be undone.'),
        detail:tr('已获得的植物伙伴和图鉴收获次数会保留。','Earned plant companions and collection harvest counts are kept.'),confirmText:tr('删除收藏','Delete collection'),danger:true},
        ()=>change(ws=>{G.removePlanet(ws,value);M.deleteProject(ws,value);}));
    }
  }
  T.garden={refresh,read:()=>G.read(accepted()),open,harvest:id=>action('harvest',id)};
  T.onShow('shop',refresh);T.onShow('garden',refresh);T.onShow('planets',refresh);
  T.sections.forEach(name=>T.onShow(name,()=>{if(name!=='garden'){view?.destroy();view=null;}if(name!=='planets'){planetView?.destroy();planetView=null;}if(name!=='shop'){storeView?.destroy();storeView=null;}}));
  document.addEventListener('tracer-visibilitychange',()=>{if((document.hidden || document.tracerHidden))stop();else refresh();});
  T.ready.then(ws=>{if(ws)refresh();});
})();
