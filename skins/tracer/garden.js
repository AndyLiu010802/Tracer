(function () {
  'use strict';
  const T=window.Tracer,M=window.TracerModel,G=window.TracerGardenModel,KEY='tracer.garden.v1';
  const home=document.getElementById('garden-home-root'),leisure=document.getElementById('garden-leisure-wrapper');
  let state=G.fresh(),source=null,pending=false,error='',view=null,mode='home',farmMounted=false,stamp='',queue=Promise.resolve(),recent=[];
  const tr=(zh,en)=>TracerLocale.language()==='zh'?zh:en;
  const context=()=>({workspace:T.store.base||T.store.data,focus:T.focus?.read(),now:Date.now()});
  function message(failure){
    const code=failure?.code||failure?.message;
    if(code==='garden-full')return tr('家园最多放置 6 块花圃。','Your home has room for up to 6 plots.');
    if(code==='garden-project-exists')return tr('这个项目已经有花圃了。','This project already has a plot.');
    if(code==='invalid-garden-state')return tr('家园记录暂时无法读取，原记录已保留。请重试。','Your home record could not be read. The original is kept; please retry.');
    if(code==='garden-state-changed')return tr('另一窗口更新了家园。当前未保存的花圃仍在此窗口，请保持打开。','Another window updated your home. Unsaved plots remain in this window; keep it open.');
    if(code==='garden-history-limit')return tr('家园记录已达到容量上限，已有成长和工作区已保留。','Home history has reached its limit. Existing growth and workspace records are kept.');
    if(code==='garden-project-unsaved')return tr('请等待项目保存成功后，再为它种植花圃。','Wait for the project to finish saving before planting its plot.');
    if(code==='garden-workspace-unavailable')return tr('暂时无法读取最新工作记录，花圃已保留。恢复连接后可以重试。','The latest work records are unavailable. Your plots are kept; retry when connected.');
    return tr('家园暂未保存，请保持窗口打开并重试；任务和农场存档不受影响。','Your home has not been saved. Keep this window open and retry; tasks and farm records are unaffected.');
  }
  function loadCurrent(){
    const latest=localStorage.getItem(KEY);
    if(pending){if(latest!==source)throw new Error('garden-state-changed');return state;}
    let next;
    try{next=latest===null?G.fresh():G.read(JSON.parse(latest));}catch{throw new Error('invalid-garden-state');}
    source=latest;state=next;return next;
  }
  try{loadCurrent();}catch(failure){error=message(failure);}
  function labels(){
    document.getElementById('garden-section-title').textContent=mode==='home'?tr('伙伴家园','Companion home'):tr('休闲区','Leisure corner');
    document.getElementById('garden-section-subtitle').textContent=mode==='home'?tr('把在意的工作，慢慢种成风景','A little place for the work you care about'):tr('原来的农场、收藏与冒险都在这里','Your farm, collection and adventures are kept here');
    document.getElementById('garden-back-home').textContent=tr('← 返回家园','← Back home');
    document.getElementById('garden-leisure-help').textContent=tr('原农场存档和收藏完整保留，随时可以回来玩。','Your original farm and collection are kept. Visit whenever you like.');
  }
  function snapshot(){
    const ws=T.store.data,focus=T.focus.read(),now=Date.now(),data=G.snapshot(state,ws,focus,now);
    const pets=T.pet?.read(),pet=pets&&TracerPetModel.catalog(pets).find(item=>item.id===pets.selected);
    return {language:TracerLocale.language(),plots:data.plots.map(plot=>({projectId:plot.projectId,name:plot.projectName,color:M.findProject(ws,plot.projectId)?.color,plant:plot.plantKind,stage:plot.stage,done:plot.done,total:plot.total,focusMinutes:plot.focusMinutes,completedCount:plot.completedTasks,bloomAt:plot.commemoratedAt,activeFocus:focus.running&&focus.mode==='focus'&&(Object.prototype.hasOwnProperty.call(focus.task||{},'projectId')?focus.task.projectId:M.findTask(ws,focus.task?.id)?.projectId)===plot.projectId})),today:{tasks:data.today.completedTasks,minutes:data.today.focusMinutes},pet:pet||null,petSleeping:!!(pets&&TracerPetModel.current(pets).sleeping),focus:{running:focus.running&&focus.mode==='focus',clock:TracerFocus.format(TracerFocus.remaining(focus,now))},events:recent,error};
  }
  function render(){
    if(T.currentSec()!=='garden'||document.hidden)return;
    labels();home.hidden=mode!=='home';leisure.hidden=mode!=='leisure';
    if(mode==='home'&&T.store.data&&T.focus){
      if(!view)view=TracerGardenHomeView(home,action);
      try{view.update(snapshot());}catch(failure){error=message(failure);}
    }
  }
  function remember(events,ws){
    const named=events.map(event=>({...event,projectName:M.findProject(ws,event.projectId)?.name||'',title:event.title||M.findTask(ws,event.taskId)?.title||''}));
    recent=named.concat(recent).filter(event=>M.findProject(ws,event.projectId)).sort((a,b)=>b.at-a.at).slice(0,6);
  }
  function transaction(transform){
    const operation=queue.then(()=>{
      const run=async()=>{
        if(!T.store.base||!T.focus||T.store.lost)throw new Error('invalid-garden-context');
        const current=loadCurrent();
        // A window's last accepted workspace can predate another window's new
        // project. Read the current saved workspace while holding the garden
        // lock before deciding that a plot's project was deleted.
        let saved;
        try{
          const response=await fetch('/api/store/workspace',{cache:'no-store',signal:AbortSignal.timeout(10000)});
          if(!response.ok)throw new Error('workspace-read-failed');
          const raw=await response.json();
          if(raw===null){
            if(current.plots.length||T.store.base.projects.length)throw new Error('workspace-missing');
            saved=M.emptyWorkspace();
          }else saved=WorkspaceSync.validate(raw);
        }catch{throw new Error('garden-workspace-unavailable');}
        const ctx=context();
        if(T.store.lost)throw new Error('invalid-garden-context');
        // Revisions originate in individual windows, so their numeric order
        // cannot overrule a fresh disk read. A concurrent local save queues its
        // own refresh and is reconciled by the next transaction.
        ctx.workspace=saved;
        const changed=transform?transform(current,ctx):current;
        const result=G.reconcile(changed,ctx.workspace,ctx.focus,ctx.now);
        const before=JSON.stringify(current),next=JSON.stringify(result.state);
        state=result.state;
        if(next!==before||pending||source===null&&state.plots.length){
          pending=true;
          if(localStorage.getItem(KEY)!==source)throw new Error('garden-state-changed');
          localStorage.setItem(KEY,next);source=next;pending=false;
        }
        error='';remember(result.events,ctx.workspace);
        if(result.changed||next!==before){if(T.renderProjects)T.renderProjects();}
        return G.read(state);
      };
      return navigator.locks?navigator.locks.request('tracer-garden-state',run):run();
    }).then(result=>{render();return result;},failure=>{error=message(failure);render();throw failure;});
    queue=operation.catch(()=>{});return operation;
  }
  function refresh(force=false){
    if(!T.store.data||!T.focus||T.store.lost)return Promise.resolve();
    const ctx=context(),last=ctx.focus.history.at(-1),next=[ctx.workspace.meta?.rev,ctx.workspace.projects.length,ctx.focus.totalMinutes,ctx.focus.history.length,last?.id,last?.endedAt,TracerFocus.dayKey(ctx.now)].join('|');
    if(!force&&next===stamp){render();return queue;}
    stamp=next;return transaction().catch(()=>{});
  }
  function plant(projectId,kind){
    return transaction((current,ctx)=>{
      if(!M.findProject(ctx.workspace,projectId))throw new Error('garden-project-unsaved');
      if(pending&&current.plots.some(plot=>plot.projectId===projectId&&plot.plantKind===kind))return current;
      return G.plant(current,projectId,kind,ctx.now);
    });
  }
  function remove(projectId){return transaction(current=>G.remove(current,projectId));}
  function stop(){if(view){view.destroy();view=null;}if(farmMounted){window.DBFarm?.unmount();farmMounted=false;}}
  function show(){
    if(mode==='leisure'){
      if(view){view.destroy();view=null;}
      if(window.DBFarm&&!farmMounted){DBFarm.mount(document.getElementById('garden-main'),document.getElementById('garden-shop'));farmMounted=true;}
    }else if(farmMounted){DBFarm.unmount();farmMounted=false;}
    render();refresh();
  }
  function open(projectId){mode='home';T.show('garden');if(projectId)requestAnimationFrame(()=>{
    const card=Array.from(home.querySelectorAll('[data-project-id]')).find(node=>node.dataset.projectId===projectId);card?.scrollIntoView({block:'nearest',behavior:'auto'});
  });}
  function openLeisure(){mode='leisure';T.show('garden');}
  function addDialog(){
    const available=T.store.data.projects.filter(project=>!state.plots.some(plot=>plot.projectId===project.id));
    if(state.plots.length>=6){T.ui.notice(tr('家园最多放置 6 块花圃。','Your home has room for up to 6 plots.'));return;}
    if(!available.length){T.ui.notice(tr('先创建一个项目，就能在家园为它种下一株植物。','Create a project, then plant something for it here.'));return;}
    T.ui.modal((box,close)=>{
      box.classList.add('garden-plot-dialog');box.setAttribute('aria-labelledby','garden-plant-title');
      box.innerHTML='<h2 id="garden-plant-title"></h2><p id="garden-plant-help"></p><label for="garden-project-select"></label><select id="garden-project-select"></select><label for="garden-plant-select"></label><select id="garden-plant-select"></select><p class="garden-dialog-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn" id="garden-plant-cancel"></button><button type="button" class="btn btn-primary" id="garden-plant-save"></button></div>';
      box.querySelector('h2').textContent=tr('为项目种下花圃','Plant a project plot');
      box.querySelector('#garden-plant-help').textContent=tr('选择一个在意的项目。已保存的任务与专注记录会成为它的成长，休息和逾期不会让植物枯萎。','Choose a project you care about. Saved work and focus become its growth. Rest and overdue dates never make it wilt.');
      box.querySelector('[for="garden-project-select"]').textContent=tr('项目','Project');
      box.querySelector('[for="garden-plant-select"]').textContent=tr('植物','Plant');
      for(const project of available){const option=document.createElement('option');option.value=project.id;option.textContent=project.name;box.querySelector('#garden-project-select').appendChild(option);}
      for(const [value,zh,en]of [['wildflower','野花','Wildflowers'],['sunflower','向日葵','Sunflower'],['lavender','薰衣草','Lavender']]){const option=document.createElement('option');option.value=value;option.textContent=tr(zh,en);box.querySelector('#garden-plant-select').appendChild(option);}
      box.querySelector('#garden-plant-cancel').textContent=tr('取消','Cancel');box.querySelector('#garden-plant-cancel').onclick=close;
      const save=box.querySelector('#garden-plant-save');save.textContent=tr('种下花圃','Plant plot');
      save.onclick=async()=>{save.disabled=true;try{await plant(box.querySelector('#garden-project-select').value,box.querySelector('#garden-plant-select').value);close();}catch(failure){box.querySelector('.garden-dialog-error').textContent=message(failure);}finally{save.disabled=false;}};
    });
  }
  function removeDialog(projectId){
    const project=M.findProject(T.store.data,projectId);if(!project)return;
    T.ui.modal((box,close)=>{
      box.classList.add('garden-plot-dialog');const title=document.createElement('h2');title.textContent=tr('移除花圃？','Remove this plot?');box.appendChild(title);
      const help=document.createElement('p');help.textContent=tr('这会移除“'+project.name+'”的花圃与家园成长记录。项目、任务和旧农场不受影响；重新种植时会按仍可用的工作记录生长。','This removes the plot and home growth for “'+project.name+'”. The project, tasks and original farm are kept. Replanting uses work records still available.');box.appendChild(help);
      const failure=document.createElement('p');failure.className='garden-dialog-error';failure.setAttribute('role','alert');box.appendChild(failure);
      const actions=document.createElement('div');actions.className='modal-actions';box.appendChild(actions);
      const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent=tr('保留','Keep');cancel.onclick=close;actions.appendChild(cancel);
      const confirm=document.createElement('button');confirm.type='button';confirm.className='btn btn-danger';confirm.dataset.gardenRemove=projectId;confirm.textContent=tr('移除花圃','Remove plot');confirm.onclick=async()=>{confirm.disabled=true;try{await remove(projectId);close();}catch(err){failure.textContent=message(err);}finally{confirm.disabled=false;}};actions.appendChild(confirm);
    });
  }
  function action(type,value){
    if(type==='add-plot')return addDialog();
    if(type==='open-leisure')return openLeisure();
    if(type==='open-companion')return T.pet?.open();
    if(type==='open-project')return T.openProject?.(value);
    if(type==='remove-plot')return removeDialog(value);
    if(type==='retry-save')return transaction().catch(()=>{});
    if(type==='focus-project'){
      const tasks=T.store.data.tasks.filter(task=>task.projectId===value&&task.status!=='done').sort((a,b)=>Number(b.status==='doing')-Number(a.status==='doing')||a.order-b.order);
      if(!tasks.length){T.ui.notice(tr('这个项目没有待办任务，可以回项目添加下一步。','This project has no open tasks. Add its next step in the project.'));return;}
      return T.focus.openForTask(tasks[0].id);
    }
  }
  T.garden={refresh,read:()=>G.read(state),open,openLeisure,plant,remove};
  document.getElementById('garden-back-home').onclick=()=>open();
  T.onShow('garden',show);T.sections.filter(name=>name!=='garden').forEach(name=>T.onShow(name,stop));
  window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){stamp='';refresh(true);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(view){view.destroy();view=null;}}else if(T.currentSec()==='garden')show();});
  T.ready.then(ws=>{if(ws)refresh(true);});
})();
