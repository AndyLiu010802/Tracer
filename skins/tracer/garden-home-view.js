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
    remove: svg('<path d="m8 8 8 8m0-8-8 8"/>'),
    leisure: svg('<path d="M3 11 12 4l9 7M6 9v11h12V9M10 20v-6h4v6"/>')
  };
  const number = value => Math.max(0, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0);
  const safeColor = value => typeof value === 'string' && /^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(value) ? value : '#94ae8e';
  function plantArt(kind, stage) {
    const palettes = { wildflower:['#dccfae','#efe3c5','#b49262'], sunflower:['#c3a054','#e5c679','#776248'], lavender:['#9285ae','#c2b0d6','#655e83'] };
    const [petal, light, center] = palettes[kind];
    const stem = (x,y,end) => `<path d="M${x} 135Q${x-7} ${y+26} ${end} ${y}" fill="none" stroke="#779777" stroke-width="3" stroke-linecap="round"/>`;
    const leaf = (x,y,flip=1) => `<path d="M${x} ${y}q${flip*20} -21 ${flip*30} -13q${-flip*3} 22 ${-flip*30} 13" fill="#789774"/><path d="M${x} ${y}l${flip*21} -11" stroke="#a2b397" stroke-width="1" opacity=".6"/>`;
    const flower = (x,y,size=1,bud=false) => {
      if(bud)return `<g transform="translate(${x} ${y}) scale(${size})"><path d="M-7 5Q-13-12 0-17Q13-12 7 5L0 11Z" fill="${petal}"/><path d="M-9 4 0 9 9 4 4 13H-4Z" fill="#799577"/><path d="M0-13V3" stroke="${light}" opacity=".6"/></g>`;
      if(kind==='lavender')return `<g transform="translate(${x} ${y}) scale(${size})"><path d="M0 16V-28" stroke="#81947c" stroke-width="2"/>${[-23,-15,-7,1,9].map((v,i)=>`<ellipse cx="-${i<2?3:5}" cy="${v}" rx="${i<2?4:6}" ry="4" fill="${i%2?petal:light}" transform="rotate(25 -4 ${v})"/><ellipse cx="${i<2?3:5}" cy="${v+3}" rx="${i<2?4:6}" ry="4" fill="${petal}" transform="rotate(-25 4 ${v+3})"/>`).join('')}</g>`;
      const petals=kind==='sunflower'?11:7;
      return `<g transform="translate(${x} ${y}) scale(${size})">${Array.from({length:petals},(_,i)=>`<ellipse cx="0" cy="-13" rx="${kind==='sunflower'?5:7}" ry="12" fill="${i%2?petal:light}" transform="rotate(${i*360/petals})"/>`).join('')}<circle r="${kind==='sunflower'?11:7}" fill="${center}"/><circle cx="-2" cy="-2" r="2" fill="${light}" opacity=".6"/>${kind==='sunflower'?'<path d="m-5 3 2 2m6-1 2-2M0-6v2" stroke="#b29760" stroke-width="1.4"/>':''}</g>`;
    };
    let growth='';
    if(stage===0)growth='<path d="M82 132c-13-11-5-22 8-21 7 10 5 17-8 21Z" fill="#bca581"/><path d="m83 129 5-14" stroke="#e2c9a0" stroke-width="1.5"/><path d="M60 133h7m32 1h8M75 145h5" stroke="#8e8570" stroke-width="2" stroke-linecap="round"/>';
    if(stage===1)growth=stem(85,101,86)+leaf(85,115,-.55)+leaf(85,106,.55);
    if(stage===2)growth=stem(84,73,87)+leaf(83,117,-.9)+leaf(84,95,.9)+'<path d="M87 82q-8-15 3-23q11 15-3 23" fill="#a1b88d"/>';
    if(stage>=3){
      growth=stem(84,kind==='lavender'?61:56,89)+leaf(83,117,-.9)+leaf(84,96,.9);
      if(stage===4){growth+=stem(82,84,56)+stem(86,88,119)+leaf(104,117,.6);growth+=flower(56,84,.6)+flower(119,88,.55);}
      growth+=flower(89,kind==='lavender'?64:57,kind==='sunflower'?1.02:1,stage===3);
    }
    return `<svg class="garden-home-plant-art" viewBox="0 0 176 162" fill="none" aria-hidden="true"><ellipse cx="88" cy="139" rx="66" ry="13" fill="#000" opacity=".15"/><path d="M24 138q60-23 127 0q-59 21-127 0" fill="#526046" opacity=".32"/><path d="M40 140h9m72-1h12" stroke="#809074" opacity=".4" stroke-linecap="round"/>${growth}${stage===4?'<path d="m137 46 1.5 4.5L143 52l-4.5 1.5L137 58l-1.5-4.5L131 52l4.5-1.5Z" fill="#d9ca96" opacity=".65"/><circle cx="39" cy="65" r="1.8" fill="#a8b593"/>':''}</svg>`;
  }
  const scene = '<svg class="garden-home-landscape" viewBox="0 0 460 250" fill="none" aria-hidden="true"><circle cx="345" cy="47" r="23" fill="#d9d2b2" opacity=".13"/><path d="M351 29a19 19 0 1 0 13 31 20 20 0 0 1-13-31" fill="#ded6b7" opacity=".8"/><g fill="#c7d0b6" opacity=".45"><circle cx="278" cy="37" r="1.2"/><circle cx="403" cy="88" r="1.1"/><circle cx="310" cy="91" r="1"/><path d="m225 61 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/></g><path d="M8 193Q99 148 190 177T460 173v77H8Z" fill="#25372f"/><path d="M0 220Q91 170 221 199T460 193v57H0Z" fill="#304236"/><ellipse cx="256" cy="223" rx="124" ry="14" fill="#8a9772" opacity=".13"/><path d="M74 111h108v95H74Z" fill="#576155"/><path d="m56 115 72-65 76 65H56Z" fill="#343f38"/><path d="m60 117 68-58 71 58" stroke="#8c9475" stroke-width="4" stroke-linejoin="round"/><path d="M113 154h28v52h-28Z" fill="#27392f"/><path d="M83 134h21v26H83Zm67 0h20v26h-20Z" fill="#c3aa6f"/><path d="M93 135v23m-9-12h19m57-11v23m-9-12h19" stroke="#5f6652" stroke-width="2"/><path d="M66 207h124" stroke="#9a9a75" stroke-width="5" stroke-linecap="round"/><path d="M419 190v-58m0 29-22-18m22 2 18-19" stroke="#4d6150" stroke-width="6" stroke-linecap="round"/><g fill="#49654d"><ellipse cx="407" cy="116" rx="25" ry="34"/><ellipse cx="438" cy="133" rx="20" ry="29"/></g><path d="M37 224q-15-17-8-34 16 9 16 26m0 8q4-27 21-28 0 20-21 28" fill="#71866a"/><path d="M373 229q-13-16-9-28 17 6 18 28m0 0q7-20 21-16-3 15-21 16" fill="#82916f"/><path d="M58 232h21m283 7h14M193 239h28" stroke="#899375" stroke-width="2" stroke-linecap="round" opacity=".4"/></svg>';

  function TracerGardenHomeView(host, onAction) {
    if(!host || !host.ownerDocument)throw new TypeError('Garden home requires a host element');
    const doc=host.ownerDocument, realm=doc.defaultView || root;
    let destroyed=false, language='zh', player=null, petSignature='', eventSignature='', currentAction='';
    const plots=new Map();
    const home=doc.createElement('div');home.className='garden-home';
    const el=(tag,cls,parent,text)=>{const item=doc.createElement(tag);item.className=cls;if(text!==undefined)item.textContent=text;if(parent)parent.appendChild(item);return item;};
    const set=(node,value)=>{const text=String(value??'');if(node.textContent!==text)node.textContent=text;};
    const tr=(zh,en)=>language==='zh'?zh:en;
    const button=(parent,cls,action,icon)=>{const node=el('button',cls,parent);node.type='button';node.dataset.homeAction=action;if(icon){const image=el('span','garden-home-icon',node);image.innerHTML=icons[icon];}const label=el('span','garden-home-button-label',node);return {node,label};};
    const top=el('div','garden-home-top',home),eyebrow=el('span','garden-home-eyebrow',top),leisure=button(top,'garden-home-button garden-home-secondary','open-leisure','leisure');
    const hero=el('section','garden-home-hero',home),intro=el('div','garden-home-intro',hero),title=el('h1','garden-home-title',intro),description=el('p','garden-home-description',intro);
    const stats=el('div','garden-home-today',intro);stats.setAttribute('role','group');
    const stat=(icon)=>{const item=el('div','garden-home-stat',stats),mark=el('span','garden-home-icon',item);mark.innerHTML=icons[icon];return {value:el('strong','garden-home-stat-value',item),label:el('span','garden-home-stat-label',item)};};
    const todayTasks=stat('check'),todayFocus=stat('clock');
    const residence=el('div','garden-home-residence',hero);residence.innerHTML=scene;
    const companion=button(residence,'garden-home-companion','open-companion');companion.label.hidden=true;
    const companionArt=el('span','garden-home-companion-art',companion.node),companionCaption=el('div','garden-home-companion-caption',residence),companionName=el('strong','garden-home-companion-name',companionCaption),companionState=el('span','garden-home-companion-state',companionCaption);
    const error=el('div','garden-home-error',home);error.hidden=true;error.setAttribute('role','alert');const errorText=el('span','garden-home-error-text',error),retry=button(error,'garden-home-button garden-home-retry','retry-save');
    const body=el('div','garden-home-body',home),garden=el('section','garden-home-garden',body),sectionHead=el('div','garden-home-section-head',garden),sectionTitles=el('div','garden-home-section-titles',sectionHead),gardenTitle=el('h2','garden-home-section-title',sectionTitles),gardenHelp=el('p','garden-home-section-help',sectionTitles),add=button(sectionHead,'garden-home-button garden-home-add','add-plot','plus'),grid=el('div','garden-home-plots',garden);
    const empty=el('div','garden-home-empty',grid),emptyArt=el('div','garden-home-empty-art',empty);emptyArt.innerHTML=plantArt('wildflower',1);
    const emptyTitle=el('h3','garden-home-empty-title',empty),emptyText=el('p','garden-home-empty-text',empty),emptyAdd=button(empty,'garden-home-button garden-home-primary','add-plot','plus');
    const journal=el('aside','garden-home-journal',body),journalHeading=el('div','garden-home-journal-heading',journal),journalIcon=el('span','garden-home-icon',journalHeading);journalIcon.innerHTML=icons.leaf;
    const journalTitle=el('h2','garden-home-section-title',journalHeading),journalHelp=el('p','garden-home-section-help',journal),eventList=el('ol','garden-home-events',journal),journalEmpty=el('p','garden-home-journal-empty',journal),journalFoot=el('div','garden-home-journal-foot',journal);
    const stamp=el('span','garden-home-stamp',journalFoot);stamp.innerHTML=icons.bloom;const footnote=el('p','garden-home-footnote',journalFoot);
    host.appendChild(home);
    function click(event){const node=event.target.closest?.('[data-home-action]');if(!node||!home.contains(node)||node.disabled||destroyed)return;if(typeof onAction==='function')onAction(node.dataset.homeAction,node.dataset.projectId||undefined);}
    home.addEventListener('click',click);
    function date(value,includeTime=false){const at=new Date(value);if(!value||!Number.isFinite(at.getTime()))return '';try{return new Intl.DateTimeFormat(language==='zh'?'zh-CN':'en',{month:'short',day:'numeric',...(includeTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(at);}catch{return '';}}
    function createPlot(id){
      const card=el('article','garden-home-plot');card.dataset.projectId=id;
      const head=el('div','garden-home-plot-head',card),name=button(head,'garden-home-project-link','open-project'),remove=button(head,'garden-home-remove','remove-plot','remove');remove.label.hidden=true;
      name.node.dataset.projectId=remove.node.dataset.projectId=id;
      const meta=el('div','garden-home-plot-meta',card),plantName=el('span','garden-home-plant-name',meta),stageName=el('span','garden-home-stage-name',meta),art=el('div','garden-home-plant',card),stages=el('div','garden-home-stages',card);stages.setAttribute('aria-hidden','true');
      const dots=Array.from({length:5},()=>el('span','garden-home-stage-dot',stages));
      const counts=el('div','garden-home-counts',card),taskCount=el('span','garden-home-task-count',counts),focusTotal=el('span','garden-home-focus-total',counts),progress=el('progress','garden-home-task-progress',card),bloom=el('p','garden-home-bloom',card),focus=button(card,'garden-home-button garden-home-focus','focus-project','clock');focus.node.dataset.projectId=id;
      return {card,name,remove,plantName,stageName,art,dots,taskCount,focusTotal,progress,bloom,focus,artSignature:''};
    }
    function updatePet(pet,snapshot){
      const label=pet ? (language==='zh'?pet.zh:pet.en)||pet.name||pet.id : tr('选择一位伙伴','Choose a companion');
      const signature=pet?JSON.stringify([pet.id,pet.image||'',pet.animation||null]):'none';
      if(signature!==petSignature){
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
      const action=snapshot.petSleeping?'sleep':snapshot.focus?.running?'focus':'idle';
      if(player&&action!==currentAction){player.setAction(action);currentAction=action;}
      if(player)player.element.setAttribute('aria-label',label);
      const portrait=companionArt.querySelector('img.garden-home-static-companion');if(portrait)portrait.alt=label;
      set(companionName,label);set(companionState,!pet?tr('让家园多一份陪伴','A little company for your garden'):snapshot.petSleeping?tr('正睡得香甜','Resting peacefully'):snapshot.focus?.running?tr('陪你专注 · ','Focusing with you · ')+(snapshot.focus.clock||''):tr('在这里，陪你慢慢来','Here for your next small step'));
      companion.node.setAttribute('aria-label',tr('打开伙伴小屋：','Open companion home: ')+label);
      home.dataset.petAction=action;
    }
    function update(snapshot={}){
      if(destroyed)return;language=snapshot.language==='en'?'en':'zh';home.lang=language==='zh'?'zh-CN':'en';
      set(eyebrow,tr('每一点进展，都在生长','SMALL STEPS, GROWING THINGS'));set(leisure.label,tr('休闲区','Leisure area'));
      set(title,tr('伙伴家园','Companion garden'));set(description,tr('把手上的项目，种成一座慢慢盛放的小花园。','A quiet home for your companion. A little garden for the work that matters.'));
      stats.setAttribute('aria-label',tr('今天的进展','Today’s progress'));set(todayTasks.value,number(snapshot.today?.tasks));set(todayTasks.label,tr('今天完成','tasks today'));set(todayFocus.value,number(snapshot.today?.minutes));set(todayFocus.label,tr('专注分钟','focus minutes'));
      set(gardenTitle,tr('项目花圃','Your project plots'));set(gardenHelp,tr('完成任务与专注时光，都让这里长大一点。','Finished tasks and focused time help each plot grow.'));
      set(add.label,tr('种下项目','Plant a project'));set(emptyAdd.label,tr('选择一个项目','Choose a project'));set(emptyTitle,tr('为正在做的事，留一块花圃','Make room for something you’re working on'));set(emptyText,tr('选一个项目，种下第一颗种子。之后的每一点进展，都会在这里留下痕迹。','Choose a project and plant its first seed. Every bit of progress will leave something growing here.'));
      set(journalTitle,tr('本次进展','This session'));set(journalHelp,tr('每一小步，都值得被看见','Small steps worth noticing'));set(journalEmpty,tr('花圃会记住你的积累。接下来完成的任务和专注，会在这里显示。','Your plots remember your progress. New task completions and focused time will appear here.'));set(footnote,tr('不用赶路。\n按自己的节奏，也会开花。','No need to hurry.\nGood things grow at your pace.'));
      const items=[],seen=new Set();for(const item of Array.isArray(snapshot.plots)?snapshot.plots:[]){if(items.length===6)break;if(!item||typeof item.projectId!=='string'||!item.projectId||seen.has(item.projectId))continue;seen.add(item.projectId);items.push(item);}
      for(const [id,entry]of plots)if(!seen.has(id)){entry.card.remove();plots.delete(id);}
      empty.hidden=items.length>0;add.node.hidden=items.length===0;add.node.disabled=items.length>=6;add.node.title=items.length>=6?tr('最多照料 6 块花圃','You can tend up to 6 plots'):'';
      items.forEach((item,index)=>{
        let entry=plots.get(item.projectId);if(!entry){entry=createPlot(item.projectId);plots.set(item.projectId,entry);}
        // Keep existing elements in place so timer updates preserve focus/scroll.
        const slot=grid.children[index+1];if(slot!==entry.card)grid.insertBefore(entry.card,slot||null);
        const kind=['wildflower','sunflower','lavender'].includes(item.plant)?item.plant:'wildflower',stage=Math.min(4,number(item.stage)),total=number(item.total),done=number(item.done),name=String(item.name||tr('未命名项目','Untitled project'));
        entry.card.dataset.plant=kind;entry.card.dataset.stage=String(stage);entry.card.dataset.activeFocus=String(!!item.activeFocus);entry.card.style.setProperty('--plot-color',safeColor(item.color));
        set(entry.name.label,name);entry.name.node.title=name;entry.name.node.setAttribute('aria-label',tr('打开项目：','Open project: ')+name);entry.remove.node.setAttribute('aria-label',tr('移除花圃：','Remove plot: ')+name);entry.remove.node.title=tr('移除花圃，保留项目','Remove plot; keep project');
        set(entry.plantName,({wildflower:tr('野花','Wildflowers'),sunflower:tr('向日葵','Sunflower'),lavender:tr('薰衣草','Lavender')})[kind]);set(entry.stageName,(language==='zh'?['种子','萌芽','生长','含苞','盛放']:['Seed','Sprouting','Growing','Budding','In bloom'])[stage]);
        const artSignature=kind+':'+stage;if(entry.artSignature!==artSignature){entry.art.innerHTML=plantArt(kind,stage);entry.artSignature=artSignature;}
        entry.dots.forEach((dot,i)=>{dot.dataset.reached=String(i<=stage);dot.dataset.current=String(i===stage);});
        set(entry.taskCount,tr('已完成 ','Done ')+done+' / '+total);set(entry.focusTotal,number(item.focusMinutes)+tr(' 分钟专注',' min focused'));entry.progress.max=Math.max(1,total);entry.progress.value=Math.min(done,total);entry.progress.setAttribute('aria-label',name+tr('：当前任务完成进度 ',': current tasks completed ')+done+' / '+total);
        const bloomDate=date(item.bloomAt);entry.bloom.hidden=!item.bloomAt;set(entry.bloom,tr('✧ 盛放纪念','✧ First bloom')+(bloomDate?' · '+bloomDate:''));
        set(entry.focus.label,item.activeFocus?tr('专注中 · ','Focusing · ')+(snapshot.focus?.clock||''):tr('为此项目专注','Focus on this project'));entry.focus.node.setAttribute('aria-label',item.activeFocus?tr('查看专注：','View focus: ')+name:tr('为项目专注：','Focus on project: ')+name);
      });
      const events=(Array.isArray(snapshot.events)?snapshot.events:[]).filter(item=>item&&['task','focus','bloom'].includes(item.type)).slice(0,5),signature=JSON.stringify([language,events]);
      if(signature!==eventSignature){eventSignature=signature;eventList.replaceChildren();for(const event of events){const row=el('li','garden-home-event',eventList);row.dataset.eventType=event.type;const mark=el('span','garden-home-event-icon',row);mark.innerHTML=icons[event.type==='task'?'check':event.type==='focus'?'clock':'bloom'];const content=el('div','garden-home-event-content',row);el('span','garden-home-event-title',content,event.type==='task'?String(event.title||tr('完成一项任务','Finished a task')):event.type==='focus'?tr('专注了 ','Focused for ')+number(event.minutes)+tr(' 分钟',' minutes'):tr('花圃第一次盛放','A first bloom'));const details=el('span','garden-home-event-details',content);const parts=[String(event.projectName||''),date(event.at,true)].filter(Boolean);set(details,parts.join(' · '));}journalEmpty.hidden=events.length>0;}
      set(errorText,typeof snapshot.error==='string'?snapshot.error:'');set(retry.label,tr('重试保存','Retry save'));error.hidden=!errorText.textContent;updatePet(snapshot.pet||null,snapshot);
    }
    function destroy(){if(destroyed)return;destroyed=true;player?.destroy();player=null;plots.clear();home.removeEventListener('click',click);home.remove();}
    update();return {update,destroy};
  }
  TracerGardenHomeView.plant=function(kind,stage){
    const doc=root.document;if(!doc)throw new Error('Plant artwork requires a document');
    const holder=doc.createElement('span');holder.innerHTML=plantArt(['wildflower','sunflower','lavender'].includes(kind)?kind:'wildflower',Math.min(4,number(stage)));return holder.firstElementChild;
  };
  return TracerGardenHomeView;
});
