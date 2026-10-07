(function(root){
  'use strict';
  root.TracerGardenLayoutEditor=function(world,surface,onAction){
    const doc=world.ownerDocument,nodes=new Map(),tiles=new Map();
    const toolbar=doc.createElement('div');toolbar.className='garden-layout-toolbar';world.insertBefore(toolbar,surface);
    const toggle=doc.createElement('button');toggle.type='button';toggle.className='garden-home-button';toolbar.appendChild(toggle);
    const controls=doc.createElement('div');controls.className='garden-layout-controls';toolbar.appendChild(controls);
    const picker=doc.createElement('select');picker.className='garden-layout-picker';controls.appendChild(picker);
    const buttons={};for(const key of ['rotate-left','rotate-right','left','up','down','right','smaller','larger','flip','reset','remove']){const b=doc.createElement('button');b.type='button';b.className='garden-home-button';b.dataset.layoutAction=key;controls.appendChild(b);buttons[key]=b;}
    toolbar.appendChild(picker);controls.classList.add('garden-layout-floating');surface.after(controls);
    const dock=doc.createElement('div');dock.className='garden-layout-dock';world.insertBefore(dock,surface);
    const hint=doc.createElement('p');hint.className='garden-layout-hint';hint.setAttribute('role','status');toolbar.appendChild(hint);
    let state={},editing=false,selected=null,drag=null,pending=false,dead=false,error='',draft=null;
    const tr=(zh,en)=>state.language==='en'?en:zh;
    const rows=()=>state.collectibles?.placements||[];
    const current=()=>rows().find(p=>p.itemId===selected);
    const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
    function paint(node,row){
      node.style.left=row.x+'%';node.style.top=row.y+'%';node.style.width=12*row.scale+'%';
      node.style.zIndex=String(10+Math.round(row.y));node.style.setProperty('--ornament-flip',row.flip?-1:1);
    }
    function localBounds(node,parent){
      const b=node.getBoundingClientRect(),p=parent.getBoundingClientRect(),sx=p.width/parent.offsetWidth||1,sy=p.height/parent.offsetHeight||1;
      return{x:(b.left-p.left)/sx-parent.clientLeft,y:(b.top-p.top)/sy-parent.clientTop,width:b.width/sx,height:b.height/sy};
    }
    function positionControls(){
      if(controls.hidden)return;const node=nodes.get(selected);if(!node||node.hidden)return;
      controls.dataset.docked=String(surface.clientWidth<=540);if(controls.dataset.docked==='true')return;
      const b=localBounds(node,surface),caption=null;
      const left=caption?Math.min(b.x,caption.x):b.x,right=caption?Math.max(b.x+b.width,caption.x+caption.width):b.x+b.width,top=caption?Math.min(b.y,caption.y):b.y,bottom=caption?Math.max(b.y+b.height,caption.y+caption.height):b.y+b.height;
      const w=controls.offsetWidth,h=controls.offsetHeight,gap=12,sw=surface.clientWidth,sh=surface.clientHeight;
      const x=clamp((left+right-w)/2,8,sw-w-8),y=clamp((top+bottom-h)/2,8,sh-h-8);
      const candidates=[{x:right+gap,y},{x:left-w-gap,y},{x,y:bottom+gap},{x,y:top-h-gap}];
      const next=candidates.find(p=>p.x>=8&&p.y>=8&&p.x+w<=sw-8&&p.y+h<=sh-8);
      if(!next){controls.dataset.docked='true';return;}
      const origin=localBounds(surface,world);
      controls.style.left=(origin.x+surface.clientLeft+next.x+w/2)+'px';controls.style.top=(origin.y+surface.clientTop+next.y)+'px';
    }
    function render(){
      if(dead)return;world.dataset.layoutEditing=String(editing);toggle.textContent=editing?tr('完成布置','Finish decorating'):tr('布置花园','Decorate garden');toggle.setAttribute('aria-pressed',String(editing));
      toggle.disabled=pending||!!state.busy;controls.hidden=!editing||!current()?.visible;dock.hidden=!editing;picker.hidden=!editing;
      const owned=state.collectibles?.items.filter(i=>i.owned)||[],signature=JSON.stringify([state.language,owned.map(i=>i.id)]);
      if(picker.dataset.signature!==signature){picker.dataset.signature=signature;picker.replaceChildren();const option=doc.createElement('option');option.value='';option.textContent=tr('选择收藏装饰…','Choose a decoration…');picker.appendChild(option);for(const item of owned){const option=doc.createElement('option');option.value=item.id;option.textContent=item.name[state.language==='en'?1:0];picker.appendChild(option);}}
      picker.value=selected||'';picker.setAttribute('aria-label',tr('添加或选择装饰','Add or select decoration'));picker.disabled=pending||!!state.busy||!!state.error||(!owned.length);
      const labels={'rotate-left':tr('↶ 转向','↶ Turn'),'rotate-right':tr('转向 ↷','Turn ↷'),left:'←',up:'↑',down:'↓',right:'→',smaller:tr('缩小','Smaller'),larger:tr('放大','Larger'),flip:tr('镜像','Mirror'),reset:tr('复位','Reset'),remove:tr('收起','Put away')};
      for(const [key,b]of Object.entries(buttons)){b.textContent=labels[key];b.disabled=!current()||pending||!!state.busy||!!state.error;}
      buttons.smaller.disabled||=current()?.scale<=.6;buttons.larger.disabled||=current()?.scale>=1.8;
      hint.hidden=!editing&&!error;hint.textContent=error||state.error||(pending?tr('正在保存位置…','Saving placement…'):!owned.length?tr('先在商店收藏一件装饰，再来布置花园。','Collect a decoration in the shop to start decorating.'):tr('拖动装饰调整位置 · 方向键微调，Shift 加速 · Esc 取消拖动 · 松手自动保存','Drag a decoration · Arrow keys to adjust, Shift for larger steps · Esc cancels a drag · Saved on release'));
      const present=new Set(rows().map(p=>p.itemId));for(const [id,node]of nodes)if(!present.has(id)){node.remove();nodes.delete(id);}
      for(const row of rows()){
        let node=nodes.get(row.itemId);if(!node){node=doc.createElement('button');node.type='button';node.className='garden-world-ornament';node.dataset.itemId=row.itemId;node.dataset.layoutId=row.itemId;node.innerHTML=root.TracerGardenCollectionArt.markup(row.itemId,row.orientation||0);node.dataset.orientation=String(row.orientation||0);surface.appendChild(node);nodes.set(row.itemId,node);}
        if(node.dataset.orientation!==String(row.orientation||0)){node.dataset.orientation=String(row.orientation||0);node.innerHTML=root.TracerGardenCollectionArt.markup(row.itemId,row.orientation||0);}
        const item=state.collectibles.items.find(i=>i.id===row.itemId);node.setAttribute('aria-label',item.name[state.language==='en'?1:0]);node.setAttribute('aria-pressed',String(selected===row.itemId));node.tabIndex=editing?0:-1;node.disabled=pending||!!state.busy||!!state.error;
        if(drag?.id!==row.itemId)paint(node,draft?.itemId===row.itemId?{...row,...draft}:row);
      }
      buttons['rotate-left'].hidden=buttons['rotate-right'].hidden=false;
      renderDock(owned);
      positionControls();
    }
    function renderDock(owned){
      const entries=owned;
      const ids=new Set(entries.map(i=>i.id));for(const [id,tile]of tiles)if(!ids.has(id)){tile.remove();tiles.delete(id);}
      for(const item of entries){
        let tile=tiles.get(item.id);if(!tile){tile=doc.createElement('button');tile.type='button';tile.className='garden-layout-tile';tile.dataset.layoutToggle=item.id;const art=doc.createElement('span');art.className='garden-layout-tile-art';const name=doc.createElement('span');name.className='garden-layout-tile-name';const action=doc.createElement('span');action.className='garden-layout-tile-action';tile.append(art,name,action);dock.appendChild(tile);tiles.set(item.id,tile);}
        const row=(state.collectibles?.layouts||rows()).find(p=>p.itemId===item.id),shown=!!row?.visible;
        const art=tile.children[0],signature=item.id+':'+(row?.orientation||0);
        if(art.dataset.signature!==signature){art.dataset.signature=signature;art.innerHTML=root.TracerGardenCollectionArt.markup(item.id,row?.orientation||0);}
        tile.children[1].textContent=item.name[state.language==='en'?1:0];tile.children[2].textContent=shown?tr('− 收起','− Put away'):tr('＋ 摆放','＋ Place');tile.dataset.visible=String(shown);tile.setAttribute('aria-pressed',String(shown));tile.disabled=pending||!!state.busy||!!state.error;
      }
    }
    async function save(value){
      if(pending||state.busy||state.error||dead)return;pending=true;draft=value;error='';render();
      try{await onAction('layout-collectible',{farmId:state.economy?.equippedFarmId,...value});}
      catch{error=tr('位置未保存，请重试。','Placement was not saved. Please try again.');}
      finally{pending=false;draft=null;render();}
    }
    function cancel(){if(!drag)return;const old=drag;drag=null;try{old.node.releasePointerCapture(old.pointer);}catch{}render();}
    function down(event){
      const node=event.target.closest('[data-layout-id]');if(!editing||!node||node.disabled||event.button!==0||drag)return;
      selected=node.dataset.layoutId;const row=current(),bounds=surface.getBoundingClientRect();
      drag={id:selected,node,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,bounds,original:{...row},value:{...row}};
      node.setPointerCapture(event.pointerId);node.focus({preventScroll:true});event.preventDefault();event.stopPropagation();render();
    }
    function move(event){if(!drag||drag.pointer!==event.pointerId)return;const d=drag;d.value.x=clamp(d.original.x+(event.clientX-d.startX)/d.bounds.width*100,5,95);d.value.y=clamp(d.original.y+(event.clientY-d.startY)/d.bounds.height*100,20,90);paint(d.node,d.value);positionControls();event.preventDefault();}
    function up(event){if(!drag||drag.pointer!==event.pointerId)return;const d=drag;drag=null;d.node.releasePointerCapture(event.pointerId);if(d.value.x!==d.original.x||d.value.y!==d.original.y)void save(d.value);else render();}
    function key(event){
      if(event.key==='Escape'&&drag){event.preventDefault();cancel();return;}
      const node=event.target.closest('[data-layout-id]');if(!editing||!node||node.disabled||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();selected=node.dataset.layoutId;const row=current(),step=event.shiftKey?5:1;
      void save({...row,x:clamp(row.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),5,95),y:clamp(row.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0),20,90)});
    }
    function click(event){
      const tile=event.target.closest('[data-layout-toggle]');if(tile){selected=tile.dataset.layoutToggle;const row=current();void save({itemId:selected,visible:!row?.visible});return;}
      if(event.target===toggle){cancel();editing=!editing;render();return;}
      const key=event.target.closest('[data-layout-action]')?.dataset.layoutAction,row=current();if(!key||!row)return;
      const patch=key==='rotate-left'?{orientation:((row.orientation||0)+5)%6}:key==='rotate-right'?{orientation:((row.orientation||0)+1)%6}:key==='left'?{x:clamp(row.x-1,5,95)}:key==='right'?{x:clamp(row.x+1,5,95)}:key==='up'?{y:clamp(row.y-1,20,90)}:key==='down'?{y:clamp(row.y+1,20,90)}:key==='smaller'?{scale:Math.max(.6,+(row.scale-.1).toFixed(2))}:key==='larger'?{scale:Math.min(1.8,+(row.scale+.1).toFixed(2))}:key==='flip'?{flip:!row.flip}:key==='remove'?{visible:false}:{x:50,y:78,scale:1,flip:false,orientation:0};
      void save({...row,...patch});
    }
    function choose(){const id=picker.value;if(!id)return;selected=id;picker.value='';if(current()?.visible)render();else void save({itemId:id,visible:true});}
    function preventOpen(event){if(editing&&event.target.closest('[data-layout-id]')){event.preventDefault();event.stopPropagation();}}
    world.addEventListener('click',preventOpen,true);
    controls.addEventListener('click',click);dock.addEventListener('click',click);toolbar.addEventListener('click',click);picker.addEventListener('change',choose);surface.addEventListener('pointerdown',down);surface.addEventListener('pointermove',move);surface.addEventListener('pointerup',up);surface.addEventListener('pointercancel',cancel);surface.addEventListener('lostpointercapture',cancel);world.addEventListener('keydown',key);
    const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>render()):null;resize?.observe(surface);
    return{update(snapshot){if(state.economy?.equippedFarmId!==snapshot.economy?.equippedFarmId)cancel();state=snapshot;render();},destroy(){dead=true;resize?.disconnect();cancel();controls.remove();dock.remove();toolbar.remove();nodes.forEach(n=>n.remove());surface.removeEventListener('pointerdown',down);surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerup',up);surface.removeEventListener('pointercancel',cancel);surface.removeEventListener('lostpointercapture',cancel);world.removeEventListener('keydown',key);world.removeEventListener('click',preventOpen,true);}};
  };
})(typeof window!=='undefined'?window:globalThis);
