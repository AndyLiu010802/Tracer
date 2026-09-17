(function () {
  'use strict';
  const T=window.Tracer, P=window.TracerPetModel, KEY='tracer.pet.v1';
  let state, view=null, closeHome=null, reminder=null, lastSaved=0, lastSnapshot=null, creatorDraft=null, feedback=null, feedbackSequence=0, settingsChat=null;
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
    if(force || now-lastSaved>30000) save();
  }
  function open() {
    if(creatorDraft) { create(); return; }
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
  function create() {
    if(state.customs.length>=P.customLimit) { T.ui.notice(TracerLocale.language()==='zh'?'已保存 12 位自定义伙伴，请先从图鉴移除一位。':'You have 12 custom companions. Remove one from your collection first.'); return; }
    if(closeHome) closeHome();
    T.ui.modal((box,close)=>{
      box.classList.add('pet-dialog','pet-create-dialog');
      box.setAttribute('aria-label',TracerLocale.language()==='zh'?'创造伙伴':'Create a companion');
      const host=document.createElement('div'); box.appendChild(host); closeHome=close;
      const creator=TracerPetCreator(host,{language:TracerLocale.language(),draft:creatorDraft,onClose:()=>{close();open();},onAI:source=>{creatorDraft=creator.read();action('open-ai',source);},onAdopt:record=>{
        const next=P.read(state); P.addCustom(next,record);
        localStorage.setItem(KEY,JSON.stringify(next)); state=next; lastSaved=Date.now();
        close(); open(); refresh(true);
      }});
      creatorDraft=null;
      box.beforeClose=()=>{creator.destroy();closeHome=null;return true;};
    });
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
  if(window.TracerPet) window.TracerPet.onAction(message=>{ if(message) action(message.type,message.value); });
  window.addEventListener('storage',event=>{if(event.key===KEY){try{state=P.read(JSON.parse(event.newValue));refresh();}catch{}}});
  window.addEventListener('beforeunload',save);
  T.ready.then(()=>{refresh(true);setInterval(refresh,1000);});
})();
