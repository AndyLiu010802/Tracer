(function (root, factory) {
  const create = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = create;
  else root.TracerGardenHomeView = create;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const svg = body => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  const icons = {
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    arrow: svg('<path d="M5 12h14m-5-5 5 5-5 5"/>'),
    clock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'),
    leaf: svg('<path d="M19 4c-9-1-15 3-13 10 2 7 11 5 13-10Z"/><path d="M5 20 15 9"/>'),
    check: svg('<path d="m5 12 4 4L19 6"/>'),
    bloom: svg('<path d="M12 8c-7-9-12 3-4 4-9 7 3 12 4 4 7 9 12-3 4-4 9-7-3-12-4-4Z"/><circle cx="12" cy="12" r="2"/>'),
    remove: svg('<path d="m8 8 8 8m0-8-8 8"/>')
  };
  const number = value => Math.max(0, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0);
  const safeColor = value => typeof value === 'string' && /^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(value) ? value : '#94ae8e';
  function plantArt(kind,stage,rare=false,shiny=false){return root.TracerGardenPlantArt.markup(kind,stage,rare,shiny);}


  function TracerGardenHomeView(host, onAction) {
    if(!host || !host.ownerDocument)throw new TypeError('Garden home requires a host element');
    const doc=host.ownerDocument, realm=doc.defaultView || root;
    let destroyed=false, language='zh', player=null, petSignature='', eventSignature='', currentAction='',pageIndex=0,lastSnapshot=null;
    let activity='',activityTimer=null,lastPetSnapshot=null,activitySerial=0;
    const plots=new Map(),taskCounts=new Map();
    const isGardenCompanion=pet=>!!pet&&!pet.custom&&/^garden_(wildflower|sunflower|lavender|apple|peach|cherry|neon_orchid|volt_berry|crystal_tree)(?:_shiny)?$/.test(pet.id);
    const home=doc.createElement('div');home.className='garden-home';
    const el=(tag,cls,parent,text)=>{const item=doc.createElement(tag);item.className=cls;if(text!==undefined)item.textContent=text;if(parent)parent.appendChild(item);return item;};
    const set=(node,value)=>{const text=String(value??'');if(node.textContent!==text)node.textContent=text;};
    const tr=(zh,en)=>language==='zh'?zh:en;
    const button=(parent,cls,action,icon)=>{const node=el('button',cls,parent);node.type='button';node.dataset.homeAction=action;if(icon){const image=el('span','garden-home-icon',node);image.innerHTML=icons[icon];}const label=el('span','garden-home-button-label',node);return {node,label};};
    const top=el('div','garden-home-top',home),eyebrow=el('span','garden-home-eyebrow',top),marketLink=button(top,'garden-home-button garden-home-secondary','open-market','leaf'),planetLink=button(top,'garden-home-button garden-home-secondary','open-planets','bloom');
    const hero=el('section','garden-home-hero',home),intro=el('div','garden-home-intro',hero),title=el('h1','garden-home-title',intro),description=el('p','garden-home-description',intro);
    const stats=el('div','garden-home-today',intro);stats.setAttribute('role','group');
    const stat=(icon)=>{const item=el('div','garden-home-stat',stats),mark=el('span','garden-home-icon',item);mark.innerHTML=icons[icon];return {value:el('strong','garden-home-stat-value',item),label:el('span','garden-home-stat-label',item)};};
    const todayTasks=stat('check'),todayFocus=stat('clock');
    const collectGoal=button(intro,'garden-home-collect-goal','open-market');
    const world=realm.TracerGardenWorldView(hero,plantArt,(type,value)=>{
      if(type==='select-plant'){
        const index=(lastSnapshot?.plots||[]).findIndex(item=>item.projectId===value);
        if(index>=0&&Math.floor(index/6)!==pageIndex){pageIndex=Math.floor(index/6);update(lastSnapshot);}return;
      }
      if(type==='companion-activity'){
        if(lastPetSnapshot?.petSleeping||lastPetSnapshot?.focus?.running)return;
        if(isGardenCompanion(lastPetSnapshot?.pet)){playResident(value);return;}
        activity=({water:'farming',music:'play',pet:'pet',greet:'wake',breeze:'tea'})[value]||'idle';
        if(lastPetSnapshot)updatePet(lastPetSnapshot.pet,lastPetSnapshot);
        clearTimeout(activityTimer);activityTimer=setTimeout(()=>{activity='';if(lastPetSnapshot&&!destroyed)updatePet(lastPetSnapshot.pet,lastPetSnapshot);},3300);return;
      }return onAction?.(type,value);
    }),residence=world.surface;
    const companion=button(residence,'garden-home-companion','open-companion');companion.label.hidden=true;
    const companionArt=el('span','garden-home-companion-art',companion.node),companionCaption=el('div','garden-home-companion-caption',residence),companionName=el('strong','garden-home-companion-name',companionCaption),companionState=el('span','garden-home-companion-state',companionCaption);
    world.attachCompanion(companion.node,companionCaption);
    const pages=el('nav','garden-task-pages',hero),pageInfo=el('span','garden-task-page-info',pages),pagePrev=button(pages,'garden-home-button','previous-page'),pageCount=el('span','garden-task-page-count',pages),pageNext=button(pages,'garden-home-button','next-page');
    world.surface.after(pages);
    pages.setAttribute('aria-label','Garden pages');
    const error=el('div','garden-home-error',home);error.hidden=true;error.setAttribute('role','alert');const errorText=el('span','garden-home-error-text',error),retry=button(error,'garden-home-button garden-home-retry','retry-save');
    const market=null;
    const body=el('div','garden-home-body',home),garden=el('section','garden-home-garden',body),sectionHead=el('div','garden-home-section-head',garden),sectionTitles=el('div','garden-home-section-titles',sectionHead),gardenTitle=el('h2','garden-home-section-title',sectionTitles),gardenHelp=el('p','garden-home-section-help',sectionTitles),add=button(sectionHead,'garden-home-button garden-home-add','open-board','arrow'),grid=el('div','garden-home-plots garden-collection-grid',garden);
    const journal=el('aside','garden-home-journal',body),journalHeading=el('div','garden-home-journal-heading',journal),journalIcon=el('span','garden-home-icon',journalHeading);journalIcon.innerHTML=icons.leaf;
    const journalTitle=el('h2','garden-home-section-title',journalHeading),journalHelp=el('p','garden-home-section-help',journal),eventList=el('ol','garden-home-events',journal),journalEmpty=el('p','garden-home-journal-empty',journal),journalFoot=el('div','garden-home-journal-foot',journal);
    const stamp=el('span','garden-home-stamp',journalFoot);stamp.innerHTML=icons.bloom;const footnote=el('p','garden-home-footnote',journalFoot);
    host.appendChild(home);
    function click(event){const node=event.target.closest?.('[data-home-action]');if(!node||!home.contains(node)||node.disabled||destroyed)return;const action=node.dataset.homeAction;if(action==='open-market'){onAction?.('open-shop');return;}if(action==='previous-page'||action==='next-page'){pageIndex+=action==='previous-page'?-1:1;update(lastSnapshot);return;}if(typeof onAction==='function')onAction(action,node.dataset.projectId||undefined);}
    home.addEventListener('click',click);
    function date(value,includeTime=false){const at=new Date(value);if(!value||!Number.isFinite(at.getTime()))return '';try{return new Intl.DateTimeFormat(language==='zh'?'zh-CN':'en',{month:'short',day:'numeric',...(includeTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(at);}catch{return '';}}
    function createCollection(kind){
      const card=el('article','garden-collection-card');card.dataset.plant=kind;
      const serial=el('span','garden-collection-number',card),art=el('div','garden-collection-art',card),name=el('h3','garden-collection-name',card),count=el('p','garden-collection-count',card),variants=el('p','garden-collection-variants',card);
      art.innerHTML=plantArt(kind,4);art.setAttribute('aria-hidden','true');
      return {card,serial,art,name,count,variants};
    }
    function updateCollection(entry,item,kind){
      const names={wildflower:tr('野花','Wildflower'),sunflower:tr('向日葵','Sunflower'),lavender:tr('薰衣草','Lavender'),apple:tr('苹果树','Apple tree'),peach:tr('桃树','Peach tree'),cherry:tr('樱桃树','Cherry tree'),neon_orchid:tr('霓虹兰','Neon orchid'),volt_berry:tr('电光莓','Volt berry'),crystal_tree:tr('晶芯树','Crystal tree')};
      set(entry.name,item.total?names[kind]:tr('尚未发现','Undiscovered'));
      set(entry.count,item.total?tr('已收获 ','Harvested ')+item.total+tr(' 次',' times'):tr('等待一颗种子带来惊喜','A seed holds a little surprise'));
      set(entry.variants,item.total?tr('奇幻伙伴 ','Companions ')+number(item.rare)+tr(' · 闪光 ',' · Shiny ')+number(item.shiny):'???');
      entry.card.setAttribute('aria-label',item.total?names[kind]+tr('，已收获 ','; harvested ')+item.total:tr('尚未发现的植物轮廓','Silhouette of an undiscovered plant'));
    }
    function updatePageLabels(items){
      set(pageInfo,items.length?tr('正在照料 ','Tending ')+items.length+tr(' 株 · 完成任务即可收获',' plants · Complete their tasks to harvest'):tr('把一项任务设为“进行中”，这里就会落下一颗随机种子。','Move a task to Doing and a random seed will find a home here.'));
      set(pagePrev.label,tr('← 上一片','← Previous'));set(pageNext.label,tr('下一片 →','Next →'));
      pages.setAttribute('aria-label',tr('任务花圃翻页','Task garden pages'));
    }
    function clearActivity(){clearTimeout(activityTimer);activityTimer=null;activity='';activitySerial++;}
    function playResident(action){
      const snapshot=lastPetSnapshot;
      if(!snapshot||snapshot.petSleeping||snapshot.focus?.running||!isGardenCompanion(snapshot.pet)||typeof player?.play!=='function')return false;
      clearActivity();const activePlayer=player,serial=activitySerial;
      // The plant player owns its clip length. Never loop a greeting with the
      // generic companion timer, or finish a replacement player's old clip.
      return activePlayer.play(action,()=>{if(!destroyed&&player===activePlayer&&serial===activitySerial&&lastPetSnapshot)updatePet(lastPetSnapshot.pet,lastPetSnapshot);});
    }
    function updatePet(pet,snapshot){
      lastPetSnapshot=snapshot;
      const label=pet ? (language==='zh'?pet.zh:pet.en)||pet.name||pet.id : tr('选择一位伙伴','Choose a companion');
      const signature=pet?JSON.stringify([pet.id,pet.image||'',pet.animation||null]):'none';
      if(signature!==petSignature){
        clearActivity();
        player?.destroy();player=null;petSignature=signature;currentAction='';companionArt.replaceChildren();
        try{
          if(pet?.custom&&pet.animation&&realm.TracerPetAnimation?.normalize(pet.animation))player=realm.TracerPetAnimation.create({image:pet.image,animation:pet.animation,label,animated:true});
          else if(pet?.custom&&typeof pet.image==='string'&&/^\/api\/pet-art\/[a-f0-9]{32}\.png$/.test(pet.image)){
            const img=el('img','garden-home-static-companion',companionArt);img.src=pet.image;img.alt=label;img.draggable=false;
          }else if(pet&&!pet.custom&&realm.TracerPetBuiltinAnimation)player=realm.TracerPetBuiltinAnimation.create({pet,label,animated:true});
          if(player)companionArt.appendChild(player.element);
        }catch{player?.destroy();player=null;}
        if(!companionArt.firstChild){const fallback=el('span','garden-home-companion-placeholder',companionArt);fallback.innerHTML=icons.leaf;}
      }
      if(snapshot.petSleeping||snapshot.focus?.running)clearActivity();
      const action=snapshot.petSleeping?'sleep':snapshot.focus?.running?'focus':activity||'idle';
      if(player&&action!==currentAction){player.setAction(action);currentAction=action;}
      if(player)player.element.setAttribute('aria-label',label);
      const portrait=companionArt.querySelector('img.garden-home-static-companion');if(portrait)portrait.alt=label;
      set(companionName,label);set(companionState,!pet?tr('让家园多一份陪伴','A little company for your garden'):snapshot.petSleeping?tr('正睡得香甜','Resting peacefully'):snapshot.focus?.running?tr('陪你专注 · ','Focusing with you · ')+(snapshot.focus.clock||''):tr('在这里，陪你慢慢来','Here for your next small step'));
      companion.node.setAttribute('aria-label',tr('打开伙伴小屋：','Open companion home: ')+label);
      home.dataset.petAction=action;
    }
    function update(snapshot={}){
      if(destroyed)return;lastSnapshot=snapshot;language=snapshot.language==='en'?'en':'zh';home.lang=language==='zh'?'zh-CN':'en';
      set(eyebrow,tr('每一点进展，都在生长','SMALL STEPS, GROWING THINGS'));
      set(marketLink.label,tr('商店与收藏','Shop & collection'));
      const nextTreasure=snapshot.collectibles?.target;collectGoal.node.hidden=!nextTreasure;
      if(nextTreasure)set(collectGoal.label,tr('下一件心愿：','Your next treasure: ')+nextTreasure.name[language==='en'?1:0]+' · '+Math.min(snapshot.economy?.balance||0,nextTreasure.price)+' / '+nextTreasure.price+tr(' 金币 →',' coins →'));
      set(title,tr('伙伴家园','Companion garden'));set(description,tr('开始一项任务，种下一颗惊喜。每次完成，都有花朵替你记住。','Begin a task, plant a little surprise. Let each finished step leave a flower.'));set(planetLink.label,tr('花朵星球','Memory planets'));
      stats.setAttribute('aria-label',tr('今天的进展','Today’s progress'));set(todayTasks.value,number(snapshot.today?.tasks));set(todayTasks.label,tr('今天完成','tasks today'));set(todayFocus.value,number(snapshot.today?.minutes));set(todayFocus.label,tr('专注分钟','focus minutes'));
      set(gardenTitle,tr('植物图鉴','Botanical collection'));set(gardenHelp,snapshot.pity
        ? tr('保底：再完成最多 ','Guaranteed within the next ')+number(snapshot.pity.companionRemaining)+tr(' 个任务出精灵，',' completed tasks: a companion; ')+number(snapshot.pity.shinyRemaining)+tr(' 个任务出闪光精灵。出现后重置对应保底。',' tasks: a shiny. Each resets when its companion appears.')
        : tr('每一朵收获都留在这里。未知的轮廓，等待下一次发现。','Every harvest belongs here. Unfamiliar silhouettes await their first discovery.'));
      set(add.label,tr('前往任务','Go to tasks'));
      set(journalTitle,tr('生长手记','Garden journal'));set(journalHelp,tr('开始、盛放、收藏，都是你的足迹','Beginnings, blooms and memories'));set(journalEmpty,tr('第一颗种子，会记住你开始的这一刻。','Your first seed will remember the moment you began.'));set(footnote,tr('不用赶路。\n按自己的节奏，也会开花。','No need to hurry.\nGood things grow at your pace.'));
      const items=[],seen=new Set();for(const item of Array.isArray(snapshot.plots)?snapshot.plots:[]){if(!item||typeof item.projectId!=='string'||!item.projectId||seen.has(item.projectId))continue;seen.add(item.projectId);items.push(item);}
      let completedTask=false;
      if(!snapshot.error){for(const item of items){const count=number(item.completedCount),previous=taskCounts.get(item.projectId);if(previous!==undefined&&count>previous)completedTask=true;taskCounts.set(item.projectId,count);}for(const id of taskCounts.keys())if(!seen.has(id))taskCounts.delete(id);}
      add.node.hidden=false;add.node.disabled=false;
      const kinds=root.TracerGardenPlantArt.kinds;
      kinds.forEach((kind,index)=>{
        const item=(snapshot.collection||[]).find(row=>row.plantKind===kind)||{total:0,rare:0,shiny:0};
        let entry=plots.get(kind);if(!entry){entry=createCollection(kind);plots.set(kind,entry);grid.appendChild(entry.card);}
        entry.card.dataset.unlocked=String(item.total>0);set(entry.serial,String(index+1).padStart(2,'0'));
        updateCollection(entry,item,kind);
      });
      const pageTotal=Math.max(1,Math.ceil(items.length/6));pageIndex=Math.min(Math.max(0,pageIndex),pageTotal-1);
      pagePrev.node.disabled=pageIndex===0;pageNext.node.disabled=pageIndex>=pageTotal-1;
      pagePrev.node.hidden=pageNext.node.hidden=pageCount.hidden=pageTotal===1;
      set(pageCount,(pageIndex+1)+' / '+pageTotal);updatePageLabels(items);
      const events=(Array.isArray(snapshot.events)?snapshot.events:[]).filter(item=>item&&['seed','harvest','bloom'].includes(item.type)).slice(0,5),signature=JSON.stringify([language,events]);
      if(signature!==eventSignature){eventSignature=signature;eventList.replaceChildren();for(const event of events){const row=el('li','garden-home-event',eventList);row.dataset.eventType=event.type;const mark=el('span','garden-home-event-icon',row);mark.innerHTML=icons[event.type==='harvest'?'check':event.type==='seed'?'leaf':'bloom'];const content=el('div','garden-home-event-content',row);el('span','garden-home-event-title',content,(event.type==='seed'?tr('种下 · ','Planted · '):event.type==='harvest'?tr('收藏 · ','Collected · '):tr('盛放 · ','Bloomed · '))+event.title);const details=el('span','garden-home-event-details',content);const parts=[String(event.projectName||''),date(event.at,true)].filter(Boolean);set(details,parts.join(' · '));}journalEmpty.hidden=events.length>0;}
      updatePet(snapshot.pet||null,snapshot);
      world.update({...snapshot,plots:items,scenePlots:items.slice(pageIndex*6,pageIndex*6+6)});
      market?.update({language,collectibles:snapshot.collectibles,inventory:snapshot.inventory||[],economy:snapshot.economy||{},farms:snapshot.farms||[],busy:!!snapshot.busy,error:snapshot.error||''});
      set(errorText,typeof snapshot.error==='string'?snapshot.error:'');set(retry.label,tr('重试保存','Retry save'));error.hidden=!errorText.textContent;
      if(completedTask)playResident('celebrate');
    }
    function destroy(){if(destroyed)return;destroyed=true;clearActivity();world.destroy();market?.destroy();player?.destroy();player=null;plots.clear();taskCounts.clear();home.removeEventListener('click',click);home.remove();}
    update();return {update,destroy,selectTask(id){const index=(lastSnapshot?.plots||[]).findIndex(item=>item.projectId===id);if(index>=0){pageIndex=Math.floor(index/6);update(lastSnapshot);world.select?.(id);}}};
  }
  TracerGardenHomeView.plant=function(kind,stage){
    const doc=root.document;if(!doc)throw new Error('Plant artwork requires a document');
    const holder=doc.createElement('span');holder.innerHTML=plantArt(root.TracerGardenPlantArt.kinds.includes(kind)?kind:'wildflower',Math.min(4,number(stage)));return holder.firstElementChild;
  };
  return TracerGardenHomeView;
});
