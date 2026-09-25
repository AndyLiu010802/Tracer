(function (root) {
  'use strict';
  const landscape = `<svg class="garden-world-land" viewBox="0 0 900 520" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="garden-grass" x1="300" y1="150" x2="500" y2="470" gradientUnits="userSpaceOnUse"><stop stop-color="#8fba80"/><stop offset="1" stop-color="#477b64"/></linearGradient>
      <linearGradient id="garden-earth" x1="450" y1="300" x2="450" y2="510" gradientUnits="userSpaceOnUse"><stop stop-color="#806849"/><stop offset="1" stop-color="#344f43"/></linearGradient>
      <linearGradient id="garden-water"><stop stop-color="#7ccac1"/><stop offset="1" stop-color="#417e84"/></linearGradient>
      <radialGradient id="garden-halo"><stop stop-color="#dce8a1" stop-opacity=".13"/><stop offset="1" stop-color="#dce8a1" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="450" cy="260" rx="440" ry="255" fill="url(#garden-halo)"/>
    <g fill="#c7d9b7" opacity=".6"><circle cx="173" cy="118" r="2"/><circle cx="740" cy="95" r="1.5"/><circle cx="695" cy="51" r="2"/><path d="m254 54 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/></g>
    <circle cx="743" cy="76" r="24" fill="#f4df9f" opacity=".14"/><circle cx="743" cy="76" r="14" fill="#e8dfb5" opacity=".8"/>
    <ellipse cx="450" cy="460" rx="330" ry="37" fill="#071b19" opacity=".3"/>
    <path d="m70 283 355-178 405 177v37L456 498 70 321Z" fill="url(#garden-earth)"/>
    <path d="m70 283 386 181 374-182v37L456 498v-34L70 283Z" fill="#233f36" opacity=".35"/>
    <path d="m70 283 355-178 405 177-374 182Z" fill="url(#garden-grass)" stroke="#a6c68c" stroke-width="3"/>
    <path d="m88 286 368 174 355-172" stroke="#bfd297" stroke-opacity=".4" stroke-width="3"/>
    <path d="m425 125 361 158-58 28-362-159Z" fill="#b8c493" opacity=".25"/>
    <path d="M553 219q-70 38-40 65t102 29q45 15 4 43" stroke="#d8c999" stroke-width="25" stroke-linecap="round" opacity=".75"/>
    <path d="m206 253 53-25m264 176 40-20m-421-88 30 14" stroke="#c9d29b" stroke-width="4" stroke-linecap="round" opacity=".35"/>
    <g class="garden-world-pond"><path d="M655 323q29-28 76-14t-2 48q-41 25-77 5t3-39" fill="#b7be8e"/><path d="M661 326q32-26 66-12t-2 38q-38 22-65 4t1-30" fill="url(#garden-water)"/><path d="m676 329 22-8m-11 31 25-9" stroke="#c3e3d0" stroke-width="3" stroke-linecap="round"/><ellipse cx="717" cy="328" rx="10" ry="5" fill="#749e68"/><path d="m715 323 3-7 5 5-3 5" fill="#eab7b5"/></g>
    <g class="garden-world-cottage"><path d="m566 202 59-30 66 33-58 31Z" fill="#203f35" opacity=".25"/><path d="m567 134 60-30v84l-60 30Z" fill="#b0bb8b"/><path d="m627 104 61 32v82l-61-30Z" fill="#829a79"/><path d="m552 138 46-68 46 34-16 14Z" fill="#506f66"/><path d="m598 70 48-20 60 85-62-31Z" fill="#324f49"/><path d="m551 137 47-67 48-20 61 85" stroke="#93af8b" stroke-width="5" stroke-linejoin="round"/><path d="m582 161 25-13v48l-25 12Z" fill="#395d51"/><path d="m642 140 26 13v25l-26-13Z" fill="#efcc8b"/><path d="m655 147v26m-12-21 25 13" stroke="#6a8265" stroke-width="3"/><circle cx="602" cy="174" r="2" fill="#e5c588"/><path d="m576 216 34-17 16 8-34 18Z" fill="#cdc496"/></g>
    <g fill="#466f55"><path d="M196 226v-67" stroke="#526747" stroke-width="9"/><ellipse cx="196" cy="138" rx="38" ry="43"/><ellipse cx="173" cy="162" rx="28" ry="30" fill="#729663"/><ellipse cx="215" cy="159" rx="30" ry="35" fill="#5e895c"/><ellipse cx="189" cy="123" rx="26" ry="28" fill="#86aa71"/></g>
    <g class="garden-world-bench"><image class="garden-world-prop" href="/garden-art/garden-bench-v2.png" x="252" y="153" width="88" height="84" preserveAspectRatio="xMidYMid meet"/></g>
    <g class="garden-world-lanterns"><image class="garden-world-prop" href="/garden-art/garden-lantern-v2.png" x="113" y="205" width="50" height="90" preserveAspectRatio="xMidYMid meet"/><image class="garden-world-prop" href="/garden-art/garden-lantern-v2.png" x="788" y="232" width="50" height="90" preserveAspectRatio="xMidYMid meet"/></g>
    <g class="garden-world-flowers" fill="#efc6b9"><circle cx="343" cy="424" r="4"/><circle cx="355" cy="428" r="3"/><circle cx="327" cy="417" r="3"/><circle cx="772" cy="300" r="4"/><circle cx="783" cy="295" r="3"/></g>
    <g stroke="#bad19a" stroke-width="2" stroke-linecap="round" opacity=".75"><path d="m119 285-3-8m3 8 5-5m585 119-3-8m3 8 5-5m-395-57-3-8m3 8 5-5m541-56-3-8m3 8 5-5"/></g>
    <g class="garden-world-fireflies" fill="#ecdf9a"><circle cx="301" cy="247" r="2.5"/><circle cx="535" cy="175" r="2"/><circle cx="644" cy="287" r="2.5"/><circle cx="471" cy="423" r="2"/></g>
  </svg>`;
  root.TracerGardenWorldView = function (host, plantArt, onAction) {
    const doc = host.ownerDocument, careArt=root.TracerGardenCareArt;
    const el = (tag, cls, parent) => { const node=doc.createElement(tag); node.className=cls; parent?.appendChild(node); return node; };
    const set = (node, value) => { if(node.textContent!==String(value))node.textContent=String(value); };
    const world=el('section','garden-world',host),heading=el('div','garden-world-heading',world);
    const level=el('strong','garden-world-level',heading),levelText=el('span','garden-world-level-text',heading),xp=el('span','garden-world-xp',heading);
    const levelBar=el('progress','garden-world-level-progress',world);levelBar.max=1;
    const surface=el('div','garden-world-surface',world);surface.innerHTML=landscape;
    const backdrop=el('img','garden-world-backdrop',surface);backdrop.alt='';backdrop.draggable=false;backdrop.src='/garden-art/spring-garden-v1.png';
    backdrop.onload=()=>{world.dataset.art='ready';};backdrop.onerror=()=>{world.dataset.art='fallback';};
    const layoutEditor=root.TracerGardenLayoutEditor(world,surface,onAction);
    const plaques=el('div','garden-world-plaques',world);plaques.hidden=true;
    const weather=el('div','garden-world-weather',surface);weather.setAttribute('aria-hidden','true');
    for(let i=0;i<7;i++){const speck=el('i','garden-world-pollen',weather);speck.style.setProperty('--i',String(i));}
    const perch=el('span','garden-world-companion-perch',surface);perch.setAttribute('aria-hidden','true');perch.hidden=true;
    const perchArt=el('img','garden-world-perch-art',perch);perchArt.alt='';perchArt.draggable=false;
    perchArt.onload=()=>{perch.hidden=false;};perchArt.onerror=()=>{perch.hidden=true;};
    const hint=el('p','garden-world-hint',world);
    const detail=el('section','garden-world-detail garden-task-plants',world),plantHeading=el('div','garden-task-plants-heading',detail);
    const plantHeadingCopy=el('div','',plantHeading),plantTitle=el('h2','garden-task-plants-title',plantHeadingCopy),plantHelp=el('p','garden-task-plants-help',plantHeadingCopy),plantCount=el('span','garden-task-plants-count',plantHeading);
    const care=el('div','garden-world-care garden-task-care-summary',detail),careTitle=el('span','garden-world-care-title',care),careHint=el('span','garden-task-care-hint',care);
    const plantGrid=el('ul','garden-task-plant-grid',detail),plantEmpty=el('p','garden-task-plants-empty',detail);
    const harvestHelp=el('p','garden-world-harvest-help',world),harvestStats=el('p','garden-world-harvest-stats',world);
    const collection=el('div','garden-world-collection',world),collectionTitle=el('h2','garden-home-section-title',collection),badges=el('ul','garden-world-badges',collection);
    const rules=el('details','garden-world-rules',collection),rulesTitle=el('summary','garden-world-rules-title',rules),rulesText=el('p','garden-world-rules-text',rules);
    const toast=el('p','garden-world-toast',world);toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
    // Coordinates are ground centers in spring-garden-v1.png, not the top of
    // a sprite. The same aspect ratio and root anchor apply at every viewport.
    const slots=[[40.5,44.1],[51.7,53.1],[62.1,61.7],[29.3,53.2],[40.5,62.3],[51.0,71.3]].map(([x,y],i)=>{
      const node=el('button','garden-world-plot',surface);node.type='button';node.style.left=x+'%';node.style.top=y+'%';node.style.zIndex=String(i<3?3+i:6+i);
      const ground=el('span','garden-world-ground',node);ground.setAttribute('aria-hidden','true');ground.innerHTML=careArt.ground;
      const art=el('span','garden-world-plant',node),label=el('span','garden-world-plot-label',node);
      const celebration=el('span','garden-world-celebration',node);celebration.setAttribute('aria-hidden','true');
      const effects=el('span','garden-world-effects',node);effects.setAttribute('aria-hidden','true');
      return {node,art,label,celebration,effects,signature:'',timer:null,interactionTimer:null,player:null};
    });
    let selected=null,last=null,language='zh',lastLevel=null,timer=null,destroyed=false;
    const receipts=new Map(),plantCards=new Map();
    const tr=(zh,en)=>language==='zh'?zh:en;
    const species=kind=>({wildflower:tr('野花','Wildflower'),sunflower:tr('向日葵','Sunflower'),lavender:tr('薰衣草','Lavender'),apple:tr('苹果树','Apple tree'),peach:tr('桃树','Peach tree'),cherry:tr('樱桃树','Cherry tree'),neon_orchid:tr('霓虹兰','Neon orchid'),volt_berry:tr('电光莓','Volt berry'),crystal_tree:tr('晶芯树','Crystal tree')})[kind]||tr('植物','Plant');
    const rarity=item=>item.harvest?.rarity||'normal';
    const companionNames=kind=>({wildflower:tr('花团','Petal'),sunflower:tr('小葵','Sunny'),lavender:tr('绒绒','Violet'),apple:tr('苹宝','Pippin'),peach:tr('桃桃','Peaches'),cherry:tr('樱丸','Cherry'),neon_orchid:tr('霓霓','Lumi'),volt_berry:tr('莓光','Berryglow'),crystal_tree:tr('晶芽','Prism')})[kind];
    const tiers=()=>language==='zh'?['初见','熟悉','默契','挚友']:['New friend','Getting closer','In harmony','Kindred spirits'];
    const levels=()=>language==='zh'?['初生之庭','林间小憩','微光花园','繁花居所','星光绿洲','四季秘境']:['A new beginning','Woodland retreat','A little glow','House of blooms','Starlit oasis','Evergreen sanctuary'];
    const reward=()=>language==='zh'?['长椅','暖光路灯','花境','萤火虫','星光小径']:['a garden bench','warm lanterns','flower borders','fireflies','a starlit path'];
    function createPlantCard(id){
      const node=el('li','garden-task-plant-card');node.dataset.taskId=id;node.dataset.projectId=id;
      const top=el('div','garden-task-plant-top',node),serial=el('span','garden-task-plant-number',top),status=el('span','garden-task-plant-status',top);
      const well=el('div','garden-task-plant-art-wrap',node),choose=el('button','garden-task-plant-select',well);choose.type='button';choose.dataset.plantAction='select';
      const portrait=el('span','garden-world-portrait',choose),chosen=el('span','garden-task-plant-chosen',choose);chosen.setAttribute('aria-hidden','true');
      const effects=el('span','garden-card-effects',portrait);effects.setAttribute('aria-hidden','true');
      const localCare=el('div','garden-task-plant-care',well),careActions=new Map();localCare.setAttribute('role','group');
      for(const [action,icon]of [['water','♧'],['breeze','❧'],['music','♪'],['greet','☀'],['pet','♡']]){const button=el('button','garden-task-plant-care-button',localCare);button.type='button';button.dataset.plantCare=action;button.innerHTML=careArt.icon(action)||icon;careActions.set(action,button);}
      const identity=el('div','garden-task-plant-identity',node),name=el('h3','garden-world-name',identity),bond=el('span','garden-world-bond',identity);
      const task=el('p','garden-world-project',node),meter=el('div','garden-task-plant-stages',node);meter.setAttribute('aria-hidden','true');
      const stages=Array.from({length:5},()=>el('i','',meter));
      const next=el('p','garden-world-next',node),buttons=el('div','garden-task-plant-actions',node);
      const action=(cls,type)=>{const button=el('button','garden-home-button '+cls,buttons);button.type='button';button.dataset.plantAction=type;return button;};
      const open=action('garden-task-plant-open','open-task'),focus=action('garden-world-focus','focus-task'),harvest=action('garden-world-harvest','harvest');
      return {node,effects,interactionTimer:null,serial,status,choose,portrait,chosen,localCare,careActions,name,bond,task,stages,next,open,focus,harvest,signature:'',player:null};
    }
    function renderPlants(items,celebrating){
      set(plantTitle,tr('正在生长的每一份努力','Every little effort, growing'));
      set(plantHelp,tr('所有在种的植物都在这里。选一株陪它片刻，或收下已经盛放的成果。','All your growing plants, together. Choose one for a little care, or gather a finished bloom.'));
      set(plantCount,items.length+tr(' 株植物',' plants'));set(plantEmpty,tr('还没有在种的植物。开始一项任务，让第一颗种子在这里安家。','No plants growing yet. Start a task to give your first seed a home.'));
      plantEmpty.hidden=items.length>0;plantGrid.hidden=!items.length;
      const present=new Set(items.map(item=>item.projectId));
      for(const [id,entry]of plantCards)if(!present.has(id)){clearCare(entry);entry.player?.destroy();entry.node.remove();plantCards.delete(id);}
      items.forEach((item,index)=>{
        let entry=plantCards.get(item.projectId);if(!entry){entry=createPlantCard(item.projectId);plantCards.set(item.projectId,entry);}
        // Keyed inserts preserve focused controls and running animation instances.
        if(plantGrid.children[index]!==entry.node)plantGrid.insertBefore(entry.node,plantGrid.children[index]||null);
        const stage=Math.max(0,Math.min(4,Number(item.stage)||0)),rare=rarity(item)!=='normal',shiny=rarity(item)==='shiny';
        const signature=JSON.stringify([item.plant,stage,rarity(item)]),label=stage===0?tr('随机种子','Mystery seed'):rare?(shiny?tr('闪光 · ','Shiny '):'')+companionNames(item.plant):species(item.plant);
        if(signature!==entry.signature){clearCare(entry);entry.player?.destroy();entry.portrait.replaceChildren(entry.effects);entry.player=doc.defaultView.TracerGardenPlantAnimation.create({document:doc,kind:item.plant,stage,rare,shiny,label,phase:index*470});entry.portrait.appendChild(entry.player.element);entry.signature=signature;}
        entry.player?.element.setAttribute('aria-label',label);
        if(item.activeFocus)clearCare(entry);
        entry.player?.setAction(item.activeFocus?'focus':'idle');
        if(celebrating.has(item.projectId))entry.player?.play('celebrate');
        entry.node.dataset.rarity=rarity(item);entry.node.dataset.stage=String(stage);entry.node.dataset.activeFocus=String(!!item.activeFocus);
        set(entry.serial,String(index+1).padStart(2,'0'));set(entry.status,item.activeFocus?tr('专注陪伴中','Focusing together'):(language==='zh'?['一颗新种子','嫩芽初生','舒展新叶','含苞待放','已成熟 · 可收获']:['A new seed','First sprout','Growing leaves','Ready to bloom','Ready to harvest'])[stage]);
        set(entry.name,label);set(entry.bond,rare?tr('羁绊 · ','Bond · ')+tiers()[Math.min(3,item.growth?.bond||0)]:tr('自然生长','Growing naturally'));set(entry.task,item.name);
        entry.choose.setAttribute('aria-label',tr('选择照料：','Choose to care for: ')+label+' · '+item.name);
        entry.stages.forEach((node,i)=>node.dataset.reached=String(i<=stage));
        set(entry.next,stage===4?tr('这次完成，值得留下一朵花。','A finished task, a flower to keep.'):stage===3?tr('完成这项任务，花朵就会盛放。','Finish this task and let it bloom.'):tr('随着任务与专注，慢慢长大。','Growing gently with your task and focus.'));
        set(entry.open,tr('查看任务','View task'));entry.open.hidden=item.taskExists===false;
        set(entry.focus,item.activeFocus?tr('查看专注','View focus'):tr('一起专注','Focus together'));entry.focus.hidden=stage===4||item.taskExists===false;
        const claimed=item.harvest?.harvestedAt!==null&&item.harvest?.harvestedAt!==undefined;
        entry.harvest.hidden=stage!==4;entry.harvest.disabled=claimed||!item.harvest||!!last?.busy;
        entry.harvest.dataset.projectId=item.projectId;set(entry.harvest,claimed?tr('已收获','Harvested'):rare?tr('收获伙伴','Welcome companion'):tr('收获花朵','Harvest'));
      });
    }
    function inspect(items){
      const item=items.find(item=>item.projectId===selected);care.hidden=!item;detail.dataset.projectId=item?.projectId||'';
      slots.forEach(slot=>slot.node.setAttribute('aria-pressed',String(!!item&&slot.node.dataset.projectId===selected)));
      for(const slot of slots)if(slot.node.dataset.projectId!==selected)clearCare(slot);
      for(const [id,entry]of plantCards){if(id!==selected)clearCare(entry);entry.node.dataset.selected=String(id===selected);entry.choose.setAttribute('aria-pressed',String(id===selected));set(entry.chosen,id===selected?tr('正在照料','Selected for care'):tr('点选照料','Choose to care'));}
      if(!item)return;
      set(careTitle,tr('照料 · ','Care · ')+item.name);
      set(careHint,item.activeFocus?tr('专注时，安静陪伴就很好。','Quiet company while you focus.'):tr('在选中的植物下方，留一点照料时光。','A little care, beneath your selected plant.'));
      const labels={water:tr('浇水','Water'),breeze:tr('微风','Breeze'),music:tr('音乐','Music'),greet:tr('招呼','Wave'),pet:tr('轻抚','Pet')};
      for(const [id,entry]of plantCards){
        entry.localCare.hidden=id!==selected;entry.localCare.setAttribute('aria-label',tr('照料当前植物','Care for this plant'));
        for(const [action,button]of entry.careActions){button.hidden=rarity(item)==='normal'&&['greet','pet'].includes(action);button.disabled=!!item.activeFocus;button.title=labels[action];button.setAttribute('aria-label',labels[action]);}
      }
    }
    function clearCare(entry){
      clearTimeout(entry.interactionTimer);entry.interactionTimer=null;
      delete entry.node.dataset.interaction;entry.effects.replaceChildren();
    }
    function showCare(entry,action){
      clearCare(entry);entry.node.dataset.interaction=action;
      entry.effects.innerHTML=careArt.effect(action);
      const reduced=doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
      entry.interactionTimer=setTimeout(()=>clearCare(entry),reduced?1400:3600);
    }
    function interact(action){
      const item=last?.plots?.find(item=>item.projectId===selected),slot=slots.find(slot=>slot.node.dataset.projectId===selected),entry=plantCards.get(selected);if(!item||item.activeFocus||(doc.hidden || doc.tracerHidden))return;
      if(!careArt.effect(action))return;
      if(entry?.node.dataset.interaction===action||slot?.node.dataset.interaction===action)return;
      entry?.player?.play(action);slot?.player?.play(action);
      if(entry)showCare(entry,action);if(slot)showCare(slot,action);
      onAction?.('companion-activity',action);
    }
    function click(event){
      const node=event.target.closest('button');if(!node||node.disabled||destroyed)return;
      const card=node.closest('.garden-task-plant-card');
      if(card&&node.dataset.plantCare){selected=card.dataset.taskId;interact(node.dataset.plantCare);return;}
      if(card&&node.dataset.plantAction){
        const action=node.dataset.plantAction,id=card.dataset.taskId;
        if(action!=='select'){onAction?.(action,id);return;}
        selected=id;onAction?.('select-plant',id);inspect(last?.plots||[]);interact(rarity(last.plots.find(item=>item.projectId===id))==='normal'?'breeze':'greet');return;
      }
      const slot=slots.find(slot=>slot.node===node);if(!slot)return;
      if(!node.dataset.projectId){onAction?.('open-board');return;}
      selected=node.dataset.projectId;inspect(last?.plots||[]);interact(rarity(last.plots.find(item=>item.projectId===selected))==='normal'?'breeze':'greet');
    }
    world.addEventListener('click',click);
    function update(snapshot){
      if(destroyed)return;last=snapshot;language=snapshot.language==='en'?'en':'zh';
      const treasures=snapshot.collectibles;layoutEditor.update(snapshot);
      const earnedSets=treasures?.sets.filter(set=>set.owned===set.total)||[];plaques.hidden=!earnedSets.length;set(plaques,earnedSets.map(set=>set.title[language==='en'?1:0]).join(' ? '));
      const farm=snapshot.economy?.equippedFarmId==='cyber'?'cyber':'meadow';
      if(world.dataset.farm!==farm){
        world.dataset.farm=farm;world.dataset.art='loading';backdrop.src='/garden-art/'+(farm==='cyber'?'cyber-garden-v1.png':'spring-garden-v1.png');
        perch.hidden=true;perchArt.src='/garden-art/garden-perch-'+farm+'-v2.png';
        const anchors=farm==='cyber'?[[41.02,42.38],[52.02,50.78],[61.85,58.59],[29.43,50.78],[40.17,59.96],[51.43,69.04]]:[[40.5,44.1],[51.7,53.1],[62.1,61.7],[29.3,53.2],[40.5,62.3],[51.0,71.3]];
        slots.forEach((slot,i)=>{slot.node.style.left=anchors[i][0]+'%';slot.node.style.top=anchors[i][1]+'%';});
      }
      const allItems=snapshot.plots||[],items=(snapshot.scenePlots||allItems).slice(0,6),j=snapshot.journey||{level:1,xp:0,next:30,progress:0,milestones:[]};
      world.dataset.level=String(j.level);world.setAttribute('aria-label',tr('可互动的立体花园','Interactive garden'));
      set(level,'Lv. '+j.level);set(levelText,levels()[j.level-1]);set(xp,j.next===null?j.xp+' XP':j.xp+' / '+j.next+' XP');
      levelBar.value=j.progress;levelBar.setAttribute('aria-label',tr('花园等级进度','Garden level progress'));
      set(hint,farm==='cyber'?tr('霓虹温室 · 新开始的任务，将种下来自霓虹花境的种子','Neon conservatory · New tasks plant seeds from the neon garden'):tr('林间花园 · 点击花朵或果树，享受一小段田园时光','Woodland garden · Choose a flower or fruit tree for a little garden time'));
      set(harvestHelp,tr('基础概率：普通植物 99% · 精灵 0.99% · 闪光精灵 0.01%。首次完成种植任务累计保底：30 个内必出精灵，150 个内必出闪光；出精灵重置 30 次计数，出闪光同时重置两项。重复完成不重复计数。','Base odds: plant 99% · companion 0.99% · shiny 0.01%. First completions of planted tasks guarantee a companion within 30 and a shiny within 150. Companions reset the 30-task count; shinies reset both. Repeated completions do not count again.'));
      set(harvestStats,tr('已收获 ','Harvested ')+(snapshot.harvests?.total||0)+tr(' 次 · 植物已收入仓库，稀有伙伴可在桌宠小屋选择',' times · Plants go to the warehouse; rare companions join companion home'));
      set(rulesTitle,tr('种子与收获规则','Seeds and harvests'));
      set(rulesText,tr('任务开始进行时自动种下当前农场的随机种子，完成任务后成熟。退回待办会在确认后销毁植物，再次开始沿用原种子；每项任务最多收获一次。清除已完成任务只移除任务卡片，成熟花朵会留在花园，手动收获后才收入仓库并记入图鉴。出售可积攒金币收藏新的农场；项目完成归档后，它的花朵会在收藏星球留下各自花境。','Starting a task plants a random seed from the equipped farm; completing it makes the plant mature. Returning to Todo destroys the plant after confirmation. Restarting keeps the original seed, with one harvest per task. Clearing completed tasks only removes task cards. Mature flowers stay in the garden until you harvest them into your warehouse and collection. Sell harvests to collect new farms. Archiving a project preserves its flowers and habitats on a memory planet.'));
      levelText.title=tr('积累完成、收获与专注，慢慢装点家园。','Completed tasks, harvests and focus gently enrich your garden.');
      if(j.next!==null)set(xp,j.xp+' / '+j.next+' XP · '+tr('下级解锁','Next:')+' '+reward()[j.level-1]);
      if(!snapshot.error){if(lastLevel!==null&&j.level>lastLevel){set(toast,tr('花园升级了 · ','Garden grew to · ')+levels()[j.level-1]);clearTimeout(timer);timer=setTimeout(()=>{toast.textContent='';},5000);}if(snapshot.journey)lastLevel=j.level;}
      if(!allItems.some(item=>item.projectId===selected))selected=allItems.find(item=>item.activeFocus)?.projectId||allItems[0]?.projectId||null;
      const celebrating=new Set(),growth=new Map();
      for(const item of allItems){
        const receipt={tasks:item.completedCount||0,minutes:item.focusMinutes||0,stage:item.stage},previous=receipts.get(item.projectId),earned=!!(!snapshot.error&&previous),newTask=earned&&receipt.tasks>previous.tasks;
        growth.set(item.projectId,{receipt,previous,earned,newTask});
        if(newTask&&item.plant==='wildflower'&&item.stage===4&&['rare','shiny'].includes(rarity(item))&&!item.activeFocus)celebrating.add(item.projectId);
      }
      slots.forEach((slot,index)=>{
        const item=items[index],signature=item?JSON.stringify([item.projectId,item.plant,item.stage,rarity(item)]):'empty';
        const {receipt,previous,earned,newTask}=item?growth.get(item.projectId):{};
        const changedProject=slot.node.dataset.projectId!==(item?.projectId||'');
        if(changedProject||signature!==slot.signature||item?.activeFocus)clearCare(slot);
        if(changedProject){clearTimeout(slot.timer);delete slot.node.dataset.celebrating;slot.celebration.textContent='';}
        if(earned&&(newTask||receipt.minutes>previous.minutes||receipt.stage>previous.stage)){
          slot.node.dataset.celebrating='true';set(slot.celebration,receipt.stage===4&&previous.stage<4?tr('首次盛放！','First bloom!'):tr('一起长大了','Growing together'));
          clearTimeout(slot.timer);slot.timer=setTimeout(()=>{delete slot.node.dataset.celebrating;slot.celebration.textContent='';},4200);
        }
        slot.node.dataset.projectId=item?.projectId||'';slot.node.dataset.empty=String(!item);slot.node.dataset.activeFocus=String(!!item?.activeFocus);
        if(signature!==slot.signature){slot.player?.destroy();slot.player=null;slot.art.replaceChildren();if(item){slot.player=doc.defaultView.TracerGardenPlantAnimation.create({document:doc,kind:item.plant,stage:item.stage,rare:rarity(item)!=='normal',shiny:rarity(item)==='shiny',label:species(item.plant),phase:index*470});slot.art.appendChild(slot.player.element);}else slot.art.innerHTML='<span class="garden-world-seed-plus">+</span>';slot.signature=signature;}
        slot.node.dataset.rarity=item?rarity(item):'normal';slot.player?.setAction(item?.activeFocus?'focus':'idle');
        if(celebrating.has(item?.projectId))slot.player?.play('celebrate');
        set(slot.label,item?item.name:tr('等待种子','A place for a seed'));
        slot.node.setAttribute('aria-label',item?(item.stage===0?tr('随机种子','Mystery seed'):species(item.plant))+' · '+item.name:tr('空花圃 '+(index+1)+'：前往任务，开始后自动播种','Empty plot '+(index+1)+': start a task to plant automatically'));
        slot.node.title='';
      });
      renderPlants(allItems,celebrating);
      // Keep every task's committed baseline while the scenery turns its pages.
      if(!snapshot.error){const present=new Set(allItems.map(item=>item.projectId));for(const id of receipts.keys())if(!present.has(id))receipts.delete(id);for(const [id,value]of growth)receipts.set(id,value.receipt);}
      collectionTitle.hidden=true;badges.hidden=true;
      const titles={'first-seed':tr('第一颗种子','First seed'),'first-bloom':tr('第一次盛放','First bloom'),'plant-family':tr('三位植物伙伴','Plant family'),'quiet-hours':tr('两小时静心','Quiet hours'),'small-steps':tr('25 个小成就','25 small steps')};
      const signature=JSON.stringify([language,j.milestones]);
      if(badges.dataset.signature!==signature){badges.dataset.signature=signature;badges.replaceChildren();for(const mark of j.milestones){
        const badge=el('li','garden-world-badge',badges);badge.dataset.earned=String(mark.earned);
        const icon=el('span','garden-world-badge-mark',badge);icon.textContent=mark.earned?'✦':'◇';icon.setAttribute('aria-hidden','true');
        const text=el('span','garden-world-badge-title',badge);text.textContent=titles[mark.id];
        const count=el('span','garden-world-badge-count',badge);count.textContent=mark.earned?tr('已达成','Earned'):Math.min(Math.floor(mark.current),mark.target)+' / '+mark.target;
      }}
      inspect(allItems);
    }
    return {surface,update,attachCompanion:layoutEditor.attachCompanion,select(id){selected=id;inspect(last?.plots||[]);},destroy(){destroyed=true;layoutEditor.destroy();clearTimeout(timer);plantCards.forEach(entry=>{clearCare(entry);entry.player?.destroy();});plantCards.clear();receipts.clear();slots.forEach(slot=>{clearTimeout(slot.timer);clearCare(slot);slot.player?.destroy();});backdrop.onload=backdrop.onerror=perchArt.onload=perchArt.onerror=null;world.removeEventListener('click',click);world.remove();}};
  };
})(typeof window!=='undefined'?window:globalThis);
