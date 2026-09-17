(function () {
  'use strict';
  const T=window.Tracer, P=window.TracerPetModel, KEY='tracer.pet.v1';
  let state, view=null, closeHome=null, reminder=null, lastSaved=0, lastSnapshot=null, creatorDraft=null, feedback=null, feedbackSequence=0, settingsChat=null;
  let creator=null, creatorHost=null, creatorStatus=null, creatorLanguage='', draftError='', recoveryError=false, draftLoadCode='', pendingComplete=false, adopting=false, draftEpoch=0;
  let preparingEdit=false;
  const draftStore=TracerPetGenerationDraft.create(), modalRoot=document.getElementById('modal-root');
  const tr=(zh,en)=>TracerLocale.language()==='zh'?zh:en;
  function generationStatus() {
    return creator?.status()||creatorStatus||{busy:preparingEdit,completed:creatorDraft?.pages?.length||0,total:16,ready:creatorDraft?.pages?.length===16&&!creatorDraft?.pendingReplacement,hasDraft:!!creatorDraft,...(creatorDraft?.pendingReplacement?{replacementAction:TracerPetAnimation.actions[creatorDraft.pendingReplacement.pageIndex]}:{})};
  }
  function renderGeneration() {
    const entry=document.getElementById('pet-generation-status'); if(!entry) return;
    const status=generationStatus(), visible=!!(status.hasDraft||status.busy||status.completed||draftError);
    entry.hidden=!visible;
    entry.dataset.state=draftError?'error':status.busy?'generating':status.ready?'ready':status.completed?'paused':'draft';
    const count=status.replacementAction?'0/1':status.completed+'/'+status.total;
    const label=draftError?tr('伙伴暂存需重试','Retry companion backup'):preparingEdit?tr('正在准备动作编辑','Preparing action editor'):status.replacementAction?(status.busy?tr('单组动作重画中','Regenerating action'):tr('单组动作待重试','Action retry pending'))+(status.replacementLabel?' · '+status.replacementLabel:''):status.busy?tr('伙伴生成中','Creating companion'):status.ready?tr('伙伴已就绪 · 待保存','Companion ready · Save'):status.completed?tr('伙伴生成已暂停','Generation paused'):tr('伙伴草稿','Companion draft');
    entry.querySelector('.pet-generation-label').textContent=label;
    entry.querySelector('.pet-generation-count').textContent=count;
    const progress=entry.querySelector('progress'); progress.max=status.replacementAction?1:status.total; progress.value=status.replacementAction?0:status.completed;
    progress.setAttribute('aria-label',tr('伙伴动作生成进度','Companion action progress'));
    entry.setAttribute('aria-label',label+' '+count+tr('，点击查看','; view progress'));
    entry.title=draftError||tr('点击返回生成窗口；关闭窗口不会取消生成。','Return to generation. Closing the panel does not cancel it.');
    if(creatorHost) {
      let warning=creatorHost.querySelector('.pet-draft-warning');
      if(!warning) { warning=document.createElement('p');warning.className='pet-draft-warning';warning.setAttribute('role','alert');creatorHost.appendChild(warning); }
      warning.textContent=draftError; warning.hidden=!draftError;
    }
  }
  async function persistDraft(draft,status) {
    if(adopting) return;
    creatorDraft=status.hasDraft||status.busy||status.completed?draft:null; creatorStatus=status; renderGeneration();
    const epoch=draftEpoch;
    try {
      if(creatorDraft) await draftStore.save({...draft,wasBusy:status.busy});
      else await draftStore.clear();
      if(epoch===draftEpoch) { draftError='';renderGeneration(); }
    } catch(error) {
      if(epoch===draftEpoch) {
        draftError=tr('草稿暂存失败。生成结果仍在当前窗口，请保持应用打开并重试保存。','Draft backup failed. Your results remain in this window. Keep the app open and retry saving.');
        renderGeneration();
      }
      throw error;
    }
  }
  async function restoreDraft() {
    try {
      const draft=await draftStore.load();
      const saved=draft?.recordId&&!draft.editingId&&state.customs.find(pet=>pet.id===draft.recordId);
      if(saved) {
        const candidate=P.customProfile({id:draft.recordId,name:draft.name,kind:draft.kind,personality:draft.personality,image:draft.pages[0],animation:{version:2,pages:draft.pages,...(draft.retainedFrames?.some(count=>count!==16)?{retainedFrames:draft.retainedFrames}:{})}});
        if(candidate&&await TracerPetEditDraft.signature(candidate)===await TracerPetEditDraft.signature(saved)) {
          await draftStore.clear();creatorDraft=null;creatorStatus=null;recoveryError=false;draftError='';renderGeneration();return;
        }
      }
      creatorDraft=draft; recoveryError=false;draftLoadCode='';draftError='';
      if(draft?.pages?.length===16) { pendingComplete=true;queueCompletion(); }
      renderGeneration();
    } catch (error) {
      recoveryError=true;draftLoadCode=error.code||'';
      draftError=tr('未能读取伙伴草稿。点击此处重试；已有草稿不会被覆盖。','Could not read the companion draft. Click to retry; the existing draft will not be overwritten.');
      renderGeneration();
    }
  }
  function queueCompletion() {
    queueMicrotask(()=>{
      if(!pendingComplete||adopting) return;
      if(creatorHost?.isConnected) { pendingComplete=false;return; }
      // Wait for unrelated editors to close; completing a companion must not erase their draft.
      if(!modalRoot.hidden) return;
      pendingComplete=false;create();
    });
  }
  new MutationObserver(()=>{renderGeneration();queueCompletion();}).observe(modalRoot,{childList:true,attributes:true,attributeFilter:['hidden']});
  try { state=P.read(JSON.parse(localStorage.getItem(KEY))); } catch { state=P.fresh(); }
  function save() {
    try { localStorage.setItem(KEY,JSON.stringify(state)); lastSaved=Date.now(); }
    catch { T.ui.notice(TracerLocale.language()==='zh'?'桌宠状态未能保存，请保持窗口打开。':'Companion state could not be saved. Keep the app open.'); }
  }
  function refresh(force=false) {
    if(!T.store.data || !T.focus) return;
    const now=Date.now(), focus=T.focus.read(), ws=T.store.data;
    P.advance(state,now);
    const metrics=P.metrics(window.DBFarm?.progress()||{},TaskHistory.completed(ws),focus,now);
    const unlocked=P.unlock(state,metrics);
    if(reminder && (!ws.tasks.some(t=>t.id===reminder.id&&t.status!=='done') || now-reminder.at>60000 || focus.running || state.snoozedUntil>now || !state.reminders)) reminder=null;
    const next=P.reminder(state,ws.tasks,focus,now);
    if(next) { reminder={...next,title:next.title.slice(0,200),at:now}; force=true; }
    if(unlocked.length) force=true;
    const catalog=P.catalog(state);
    lastSnapshot={language:TracerLocale.language(),native:!!window.TracerPet,pet:catalog.find(p=>p.id===state.selected),catalog,needs:{...P.current(state)},unlocked:state.unlocked.slice(),metrics,
      mood:P.mood(state,focus.running),focus:{running:focus.running,completed:focus.completed,clock:TracerFocus.format(TracerFocus.remaining(focus,now))},
      task:P.nextTask(ws.tasks),reminder,reminders:state.reminders,snoozedUntil:state.snoozedUntil,lastAction:state.lastAction,lastActionAt:state.lastActionAt,
      feedback:feedback&&now-feedback.at<6500?feedback:null};
    // Native windows only need the reminder's display fields, not task notes.
    if(lastSnapshot.task) { const task=lastSnapshot.task; lastSnapshot.task={id:task.id,title:task.title.slice(0,200),due:task.due,scheduled:task.scheduled}; }
    if(view) view.update(lastSnapshot);
    if(window.TracerPet) window.TracerPet.send({type:'snapshot',value:lastSnapshot});
    const zh=lastSnapshot.language==='zh';
    const entry=document.getElementById('pet-open'); if(entry) entry.textContent=zh?'✦ 桌宠小屋':'✦ Companions';
    const garden=document.getElementById('garden-pet-open'); if(garden) garden.textContent=zh?'✦ 我的桌宠 · '+state.unlocked.length+'/'+catalog.length:'✦ Companions · '+state.unlocked.length+'/'+catalog.length;
    renderGeneration();
    if(force || now-lastSaved>30000) save();
  }
  function open() {
    if(closeHome) closeHome();
    T.ui.modal((box,close)=>{
      box.classList.add('pet-dialog'); box.setAttribute('aria-label',TracerLocale.language()==='zh'?'桌宠小屋':'Companion home');
      const host=document.createElement('div'); box.appendChild(host); closeHome=close;
      if(view) view.destroy();
      view=TracerPetView(host,action,false,settingsChat); settingsChat=null;
      box.beforeClose=()=>{ view.destroy();view=null;closeHome=null;return true; };
      refresh();
    });
  }
  async function create() {
    await draftReady;
    if(preparingEdit){T.ui.notice(tr('正在准备已保存的动作，请稍候。','Preparing saved actions. Please wait.'));return;}
    if(recoveryError) {
      await restoreDraft();
      if(recoveryError) {
        if(draftLoadCode!=='pet-draft-corrupt'||!window.confirm(tr('这份伙伴草稿已损坏，无法自动恢复。放弃它并新建吗？这会移除该草稿及恢复进度；已保存的伙伴不受影响。','This companion draft is damaged and cannot be restored. Discard it and start a new one? Its recovery progress will be removed; saved companions are unaffected.'))) {T.ui.notice(draftError);return;}
        try {await draftStore.clear();creatorDraft=null;creatorStatus=null;recoveryError=false;draftLoadCode='';draftError='';renderGeneration();}
        catch {T.ui.notice(draftError);return;}
      }
    }
    if(draftError&&creator) persistDraft(creator.read(),creator.status()).catch(()=>{});
    if(creatorHost?.isConnected) { creatorHost.querySelector('.pet-adopt:not([hidden]),input')?.focus();return; }
    if(creator&&!creator.status().busy&&creatorLanguage!==TracerLocale.language()) {
      creatorDraft=creator.read();creator.destroy();creator=null;creatorHost=null;
    }
    if(!creatorDraft&&!creator&&state.customs.length>=P.customLimit) { T.ui.notice(TracerLocale.language()==='zh'?'已保存 12 位自定义伙伴，请先从图鉴移除一位。':'You have 12 custom companions. Remove one from your collection first.'); return; }
    if(closeHome) closeHome();
    T.ui.modal((box,close)=>{
      box.classList.add('pet-dialog','pet-create-dialog');
      box.setAttribute('aria-label',creator?.read().editingId||creatorDraft?.editingId?tr('调整伙伴动作','Refine companion actions'):tr('创造伙伴','Create a companion'));
      closeHome=close;
      if(!creator) {
        creatorHost=document.createElement('div');
        creatorLanguage=TracerLocale.language();
        creator=TracerPetCreator(creatorHost,{
          language:TracerLocale.language(),draft:creatorDraft,
          onClose:()=>{if(closeHome)closeHome();},
          onAI:source=>action('open-ai',source),
          onChange:(draft,status)=>{persistDraft(draft,status).catch(()=>{});},
          onCheckpoint:persistDraft,
          onDiscard:async()=>{
            adopting=true;draftEpoch++;
            try {
              await draftStore.clear();
              const visible=creatorHost?.isConnected;
              creator.destroy();creator=null;creatorDraft=null;creatorStatus=null;draftError='';pendingComplete=false;
              if(visible&&closeHome)closeHome();creatorHost=null;renderGeneration();
            } finally {adopting=false;}
          },
          onComplete:(draft,status,detail)=>{
            creatorDraft=draft;creatorStatus=status;pendingComplete=true;renderGeneration();queueCompletion();
            T.ui.notice(detail?.type==='replacement'?tr('单组动作已更新，其他动作保留。请预览并保存修改。','The selected action is updated; all other actions are kept. Preview and save your changes.'):tr('伙伴的 16 种动作已就绪，请预览并保存。','All 16 companion actions are ready. Preview and save your companion.'));
          },
          onAdopt:async record=>{
            adopting=true;draftEpoch++;
            try {
              const draft=creator.read(), candidateSignature=await TracerPetEditDraft.signature(record);
              const existing=state.customs.find(pet=>pet.id===record.id);
              if(draft.editingId||existing) {
                const current=existing;
                if(!current)throw new Error('custom-edit-missing');
                const before=JSON.stringify(current), currentSignature=await TracerPetEditDraft.signature(current);
                if(JSON.stringify(state.customs.find(pet=>pet.id===record.id))!==before||(currentSignature!==draft.editingSignature&&currentSignature!==candidateSignature))throw new Error('custom-edit-conflict');
              }
              const next=P.read(state);
              if(draft.editingId) {
                const index=next.customs.findIndex(pet=>pet.id===draft.editingId), profile=P.customProfile(record);
                if(index<0)throw new Error('custom-edit-missing');
                if(!profile||profile.id!==draft.editingId)throw new Error('invalid-custom');
                next.customs[index]=profile;
              } else if(next.customs.some(pet=>pet.id===record.id)) P.act(next,'select',record.id);
              else P.addCustom(next,record);
              localStorage.setItem(KEY,JSON.stringify(next));state=next;lastSaved=Date.now();
              creator.markSaved(candidateSignature);
              // Collection persistence must succeed before the recoverable draft is removed.
              try {await draftStore.clear();}catch {throw new Error('pet-draft-clear-failed');}
              const visible=creatorHost?.isConnected;
              creator.destroy();creator=null;creatorDraft=null;creatorStatus=null;draftError='';pendingComplete=false;
              if(visible&&closeHome)closeHome();creatorHost=null;renderGeneration();
              if(visible||modalRoot.hidden)open();
              else T.ui.notice(tr('伙伴已保存，可在伙伴小屋中查看。','Companion saved. Find it in your companion collection.'));
              refresh(true);
            } finally {adopting=false;}
          }
        });
      }
      box.appendChild(creatorHost);renderGeneration();
      box.beforeClose=()=>{
        if(creator&&!adopting) {
          const status=creator.status();persistDraft(creator.read(),status).catch(()=>{});
          if(status.hasDraft||status.busy) {
            const message=status.busy?tr('伙伴继续在后台生成，点击导航栏进度可随时返回。','Your companion is still generating. Return through the navigation progress bar.'):
              status.ready?(creator.read().editingId?tr('动作修改尚未保存，原伙伴不受影响。可从导航栏返回并保存修改。','Action changes are not saved yet. The original companion is unchanged. Return through navigation to save your edits.'):tr('伙伴尚未保存，已保留预览和草稿。请从导航栏返回后点击“保存并陪伴我”。','Your companion is not saved yet. Its preview and draft are kept; return through the navigation bar to save it.')):
              tr('照片、设置和已完成动作已保留，可从导航栏继续。','Your photo, settings and completed actions are kept. Continue through the navigation bar.');
            setTimeout(()=>T.ui.notice(draftError||message),0);
          }
        }
        creatorHost?.remove();closeHome=null;renderGeneration();return true;
      };
    });
    if(creator?.read().editingId)creatorHost.querySelector('#pet-preview-action')?.focus({preventScroll:true});
  }
  async function editActions() {
    await draftReady;
    if(preparingEdit){T.ui.notice(tr('动作编辑正在准备中。','The action editor is being prepared.'));return;}
    if(recoveryError||creator?.status().hasDraft||creatorDraft) {
      T.ui.notice(tr('请先处理当前草稿。已有生成进度和动作修改会保留。','Finish or discard the current draft first. Its generation progress and edits are kept.'));
      await create();return;
    }
    const profile=state.customs.find(pet=>pet.id===state.selected);if(!profile)return;
    if(creator){creator.destroy();creator=null;creatorHost=null;creatorStatus=null;}
    if(closeHome)closeHome();
    preparingEdit=true;creatorStatus={busy:true,completed:0,total:16,ready:false,hasDraft:true};renderGeneration();
    let prepared=false;
    try {
      const editingSignature=await TracerPetEditDraft.signature(profile), art=await TracerPetEditDraft.prepare(profile);
      const current=state.customs.find(pet=>pet.id===profile.id);
      if(!current)throw new Error('custom-edit-missing');
      if(await TracerPetEditDraft.signature(current)!==editingSignature)throw new Error('custom-edit-conflict');
      const draft={name:profile.name,kind:profile.kind,personality:profile.personality||'',distinctiveFeatures:'',imageSource:'codex',imageModel:'gpt-image-2.5-flare',recordId:profile.id,editingId:profile.id,editingSignature,generationId:crypto.randomUUID().replaceAll('-',''),pageAttempts:Array(16).fill(0),pendingReplacement:null,wasBusy:false,...art};
      prepared=true;
      await persistDraft(draft,{busy:false,completed:16,total:16,ready:true,hasDraft:true});
    } catch(error) {
      if(!prepared){creatorStatus=null;T.ui.notice(error.message==='custom-edit-missing'?tr('原伙伴已被移除。','The original companion has been removed.'):error.message==='custom-edit-conflict'?tr('伙伴已发生变化，请重新打开动作编辑。','The companion changed. Open the action editor again.'):tr('未能准备动作编辑，请检查本机图片后重试。原伙伴没有改变。','Could not prepare action editing. Check the local artwork and retry. The original companion is unchanged.'));}
    } finally {
      preparingEdit=false;renderGeneration();
      if(prepared){pendingComplete=true;queueCompletion();}
    }
  }
  function transfer(exporting) {
    const profile = exporting ? state.customs.find(p=>p.id===state.selected) : null;
    if (exporting && !profile) return;
    if (closeHome) closeHome();
    T.ui.modal((box,close)=>{
      box.classList.add('pet-dialog','pet-transfer-dialog');
      box.setAttribute('aria-label',TracerLocale.language()==='zh'?(exporting?'导出伙伴':'导入伙伴'):(exporting?'Export companion':'Import companion'));
      const host=document.createElement('div'); box.appendChild(host); closeHome=close;
      const panel=TracerPetTransfer(host,{language:TracerLocale.language(),profile,
        has:id=>state.customs.some(p=>p.id===id),canAdd:()=>state.customs.length<P.customLimit,
        onClose:()=>{close();open();},onAdopt:record=>{
          const next=P.read(state);
          if(next.customs.some(p=>p.id===record.id)) P.act(next,'select',record.id);
          else P.addCustom(next,record);
          localStorage.setItem(KEY,JSON.stringify(next)); state=next; feedback=null; lastSaved=Date.now();
          close();open();refresh(true);
        }});
      box.beforeClose=()=>{panel.destroy();closeHome=null;return true;};
    });
  }
  async function action(type,value) {
    if(type==='close') { if(closeHome) closeHome(); return; }
    if(type==='desktop') { if(window.TracerPet) window.TracerPet.send({type:'show'}); return; }
    if(type==='open-home') { open(); return; }
    if(type==='open-create') { create(); return; }
    if(type==='open-edit-actions') { await editActions();return; }
    if(type==='open-import') { transfer(false); return; }
    if(type==='open-export') { transfer(true); return; }
    if(type==='open-remove') {
      const pet=P.catalog(state).find(p=>p.id===state.selected&&p.custom); if(!pet) return;
      if(closeHome) closeHome();
      T.ui.confirm((TracerLocale.language()==='zh'?'移除自定义伙伴“'+pet.zh+'”及其养成进度？':'Remove “'+pet.en+'” and their care progress?'),()=>{
        P.removeCustom(state,pet.id); refresh(true); open();
      }); return;
    }
    if(type==='open-ai') {
      if(view) settingsChat=view.readChat();
      if(closeHome) closeHome(); document.getElementById('ai-open').click();
      await Promise.resolve();
      const button=document.querySelector('[data-ai-step="3"]'); if(button) button.click();
      if(['codex','personal'].includes(value)) document.getElementById('ai-mode-'+(value==='personal'?'api':'codex'))?.click();
      return;
    }
    if(type==='open-task') {
      const task=TracerModel.findTask(T.store.data,value); if(!task) return;
      if(closeHome) closeHome(); T.taskEditor(T.store.data,value,()=>T.redraw()); return;
    }
    if(type==='focus-toggle') { await T.focus.toggle(); refresh(); return; }
    const result=P.act(state,type,value);
    if(['pet','feed','play','sleep'].includes(type)) feedback={...result,action:result?.action||type,at:Date.now(),id:++feedbackSequence};
    if(type==='select') feedback=null;
    refresh(true);
  }
  T.pet={open,refresh,read:()=>P.read(state),action};
  document.getElementById('pet-open').onclick=open;
  document.getElementById('garden-pet-open').onclick=open;
  document.getElementById('pet-generation-status').onclick=create;
  if(window.TracerPet) window.TracerPet.onAction(message=>{ if(message) action(message.type,message.value); });
  window.addEventListener('storage',event=>{if(event.key===KEY){try{state=P.read(JSON.parse(event.newValue));refresh();}catch{}}});
  window.addEventListener('beforeunload',event=>{
    save();
    const status=generationStatus();
    if(status.busy||status.hasDraft||status.ready||draftError) {event.preventDefault();event.returnValue='';}
  });
  const draftReady=restoreDraft();
  T.ready.then(()=>{refresh(true);setInterval(refresh,1000);});
})();
