(function(){
  'use strict';
  const T=window.Tracer,G=window.TaskGarden,doc=document,surfaces=new Map();
  const el=(tag,cls,parent)=>{const n=doc.createElement(tag);n.className=cls;parent?.appendChild(n);return n;},text=(n,s)=>{if(n.textContent!==String(s))n.textContent=s;};
  const tr=(zh,en)=>TracerLocale.language()==='en'?en:zh,local=a=>a?.[TracerLocale.language()==='en'?1:0]||'';
  const button=(parent,action)=>{const n=el('button','sticker-control',parent);n.type='button';n.dataset.stickerControl=action;return n;};
  const icon='<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M18 12V9a6 6 0 0 1 12 0v3" stroke="#f0d598" stroke-width="3"/><path d="M11 19c0-6 5-10 13-10s13 4 13 10l3 19c.6 4-3 6-7 6H15c-4 0-7-2-7-6z" fill="#93ab76" stroke="#e9d7a7" stroke-width="1.5"/><path d="M12 19h24l-3 10H15z" fill="#426b4d" stroke="#f0dca4" stroke-width="1.2"/><path d="M16 33h16v7H16z" fill="#547c56" stroke="#c9d3a0"/><path d="M22 24h4v8h-4z" fill="#c59b5b" stroke="#f2d698"/><circle cx="32" cy="16" r="4" fill="#f1dba4"/><path d="m30 16 1.4 1.2L34 14" stroke="#6b8153" stroke-width="1.3"/></svg>';
  const fab=button(doc.body,'bag');fab.id='sticker-backpack-button';fab.className='sticker-backpack-button';fab.hidden=true;fab.innerHTML=icon;const badge=el('span','sticker-backpack-badge',fab);
  const bag=el('section','sticker-backpack',doc.body);bag.id='sticker-backpack';bag.hidden=true;bag.setAttribute('role','dialog');bag.setAttribute('aria-labelledby','sticker-backpack-title');fab.setAttribute('aria-controls',bag.id);
  const head=el('header','sticker-bag-head',bag),mark=el('div','sticker-bag-mark',head);mark.innerHTML=icon;
  const copy=el('div','',head),title=el('h2','',copy),count=el('p','',copy),close=button(head,'close');title.id='sticker-backpack-title';
  const help=el('p','sticker-bag-help',bag),filters=el('div','sticker-bag-filters',bag),filterButtons=new Map();
  for(const id of ['all','garden','slow','stars','celebrate']){const b=button(filters,'filter');b.dataset.filter=id;filterButtons.set(id,b);}
  const grid=el('div','sticker-bag-grid',bag),empty=el('p','sticker-bag-empty',bag),footer=el('footer','sticker-bag-footer',bag),edit=button(footer,'edit'),shop=button(footer,'shop');
  const bar=el('div','sticker-modebar',doc.body),status=el('span','',bar),undo=button(bar,'undo'),retry=button(bar,'retry'),done=button(bar,'done');bar.hidden=true;status.setAttribute('role','status');
  const hud=el('div','sticker-transform',doc.body),hudName=el('span','sticker-transform-name',hud);hud.hidden=true;hud.setAttribute('role','group');
  for(const action of ['left','right','smaller','larger','front','remove'])button(hud,action);
  const frame=el('div','sticker-selection',doc.body);frame.hidden=true;frame.setAttribute('role','group');
  for(const [name,x,y]of [['nw',-1,-1],['n',0,-1],['ne',1,-1],['e',1,0],['se',1,1],['s',0,1],['sw',-1,1],['w',-1,0],['rotate',0,-1]]){const h=el('button','sticker-handle',frame);h.type='button';h.dataset.stickerHandle=name;h.dataset.axisX=x;h.dataset.axisY=y;h.style.setProperty('--handle-x',(x+1)*50+'%');h.style.setProperty('--handle-y',(y+1)*50+'%');if(name==='rotate')h.textContent='↻';}
  const ghost=el('img','sticker-placement-ghost',doc.body);ghost.alt='';ghost.hidden=true;
  let opened=false,editing=false,armed=null,selected=null,selectedSurface=null,drag=null,busy=false,error='',filter='all',queued=false,undoStack=[],pendingOp=null;
  const inNotes=()=>T.currentSec()==='notes';
  let catalogue={items:[],placements:[],owned:0,total:8},ledgerRef=null,language='',bagSignature='';
  const accepted=()=>T.store.base||T.store.data,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),allRows=()=>accepted()?.taskGarden?.market?.stickers?.placements||[],row=id=>allRows().find(p=>p.id===id);
  let orb={side:'right',y:1},orbDrag=null,suppressOrbClick=false;
  try{const saved=JSON.parse(localStorage.getItem('tracer.stickerOrb'));if(saved&&['left','right'].includes(saved.side)&&Number.isFinite(saved.y))orb={side:saved.side,y:clamp(saved.y,0,1)};}catch{}
  function orbBounds(){const area=doc.querySelector('.main')?.getBoundingClientRect(),main=area?.width>=280?area:null,size=fab.offsetWidth||56,left=Math.max(12,main?.left+12||12),right=Math.max(left,Math.min(innerWidth-12,main?.right-12||innerWidth-12)-size),top=Math.max(64,main?.top+12||64),bottom=Math.max(top,Math.min(innerHeight-12,main?.bottom-12||innerHeight-12)-size);return{left,right,top,bottom,size};}
  function positionOrb(){if(fab.hidden)return;const b=orbBounds();if(!orbDrag){fab.style.left=(orb.side==='left'?b.left:b.right)+'px';fab.style.top=(b.top+(b.bottom-b.top)*orb.y)+'px';fab.style.right=fab.style.bottom='auto';}bar.style.left=b.left+'px';bar.style.right='auto';bar.style.bottom='84px';bar.style.maxWidth=(b.right+b.size-b.left)+'px';if(opened){const r=fab.getBoundingClientRect(),width=Math.min(350,b.right+b.size-b.left),above=r.top-76,below=innerHeight-r.bottom-24,up=above>=below;bag.style.width=width+'px';bag.style.maxHeight=Math.max(150,Math.min(innerHeight-90,up?above:below))+'px';const height=bag.getBoundingClientRect().height;bag.style.left=clamp(orb.side==='left'?r.left:r.right-width,b.left,Math.max(b.left,b.right+b.size-width))+'px';bag.style.top=clamp(up?r.top-height-12:r.bottom+12,64,innerHeight-height-12)+'px';bag.style.right=bag.style.bottom='auto';}}
  fab.addEventListener('pointerdown',e=>{if(e.button!==0||busy)return;suppressOrbClick=false;const r=fab.getBoundingClientRect();orbDrag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};fab.setPointerCapture(e.pointerId);});
  fab.addEventListener('pointermove',e=>{if(!orbDrag||orbDrag.id!==e.pointerId)return;const d=orbDrag,dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)<5&&!d.moved)return;d.moved=true;suppressOrbClick=true;fab.classList.add('is-dragging');const b=orbBounds();fab.style.left=clamp(d.left+dx,b.left,b.right)+'px';fab.style.top=clamp(d.top+dy,b.top,b.bottom)+'px';if(opened){opened=false;bag.hidden=true;fab.setAttribute('aria-expanded','false');}e.preventDefault();});
  function endOrb(e){if(!orbDrag||orbDrag.id!==e.pointerId)return;const d=orbDrag;orbDrag=null;fab.classList.remove('is-dragging');try{fab.releasePointerCapture(e.pointerId);}catch{}if(d.moved){const b=orbBounds(),r=fab.getBoundingClientRect();orb={side:r.left<(b.left+b.right)/2?'left':'right',y:clamp((r.top-b.top)/Math.max(1,b.bottom-b.top),0,1)};try{localStorage.setItem('tracer.stickerOrb',JSON.stringify(orb));}catch{}}positionOrb();}
  fab.addEventListener('pointerup',endOrb);fab.addEventListener('pointercancel',e=>{suppressOrbClick=false;endOrb(e);});fab.addEventListener('keydown',()=>{suppressOrbClick=false;});
  function getData(){const ref=accepted()?.taskGarden?.market?.stickers,lang=TracerLocale.language();if(ref!==ledgerRef||lang!==language||!catalogue.items.length){ledgerRef=ref;language=lang;catalogue=G.stickers(accepted()||{tasks:[],notes:[]});}return catalogue;}
  function liveTarget(node){if(!inNotes()||!node?.isConnected||node.dataset.stickerKind!=='note')return false;return !!T.store.data?.notes?.some(p=>p.id===node.dataset.stickerTarget);}
  function selectedNode(){return surfaces.get(selectedSurface)?.nodes.get(selected);}
  function geometry(surface,value){const w=surface.clientWidth,h=surface.clientHeight,size=Math.max(12,Math.min(value.size,w*.7,h*.7)),margin=size*.72+2;return{size,x:clamp(value.x,Math.min(50,margin/w*100),Math.max(50,100-margin/w*100)),y:clamp(value.y,Math.min(50,margin/h*100),Math.max(50,100-margin/h*100))};}
  function paint(node,surface,value){const g=geometry(surface,value);Object.assign(node.style,{left:g.x+'%',top:g.y+'%',width:g.size+'px',height:g.size+'px',transform:'translate(-50%,-50%) rotate('+value.rotation+'deg)'});}
  function updateHud(){
    const node=selectedNode(),p=drag&&drag.node===node?drag.value:row(selected);frame.hidden=hud.hidden=!inNotes()||!editing||!!armed||!node?.isConnected||!p?.visible;if(frame.hidden)return;
    const b=node.getBoundingClientRect(),surface=selectedSurface.getBoundingClientRect();if(b.bottom<Math.max(48,surface.top)||b.top>Math.min(innerHeight,surface.bottom)){frame.hidden=hud.hidden=true;return;}
    const sx=surface.width/Math.max(1,selectedSurface.offsetWidth),sy=surface.height/Math.max(1,selectedSurface.offsetHeight);
    Object.assign(frame.style,{left:(b.x+b.width/2)+'px',top:(b.y+b.height/2)+'px',width:parseFloat(node.style.width)*sx+'px',height:parseFloat(node.style.height)*sy+'px',transform:'translate(-50%,-50%) rotate('+p.rotation+'deg)'});
    frame.setAttribute('aria-label',tr('贴纸变换框','Sticker transform frame'));
    const names={nw:['左上','top left'],n:['上方','top'],ne:['右上','top right'],e:['右侧','right'],se:['右下','bottom right'],s:['下方','bottom'],sw:['左下','bottom left'],w:['左侧','left']};
    for(const h of frame.children){const kind=h.dataset.stickerHandle;h.disabled=busy;h.setAttribute('aria-label',kind==='rotate'?tr('拖动旋转贴纸','Drag to rotate sticker'):tr('拖动'+names[kind][0]+'缩放贴纸','Drag '+names[kind][1]+' to resize sticker'));h.title=kind==='rotate'?tr('拖动旋转 · Shift 按 15° 对齐','Drag to rotate · Shift snaps to 15°'):tr('拖动等比缩放','Drag to resize proportionally');}
    hud.hidden=!!drag;const width=Math.min(300,innerWidth-24);hud.style.width=width+'px';hud.style.left=clamp(b.x+b.width/2-width/2,12,innerWidth-width-12)+'px';
    // Keep the toolbar away from every resize handle. Clamping the below-sticker
    // position at the viewport bottom otherwise puts it over the right/bottom handles.
    const bottomLimit=innerHeight-hud.offsetHeight-108,below=b.bottom+30;
    hud.style.top=clamp(below<=bottomLimit?below:b.top-hud.offsetHeight-48,60,bottomLimit)+'px';
  }
  function refresh(){
    queued=false;if(!T.store.data)return;
    if(drag&&(!drag.node.isConnected||!liveTarget(drag.surface)||drag.surface.dataset.stickerTarget!==drag.original.targetId)){cancelDrag();return;}
    if(!inNotes()){opened=false;editing=false;armed=null;selected=null;selectedSurface=null;ghost.hidden=true;}
    // A later text autosave may successfully carry the retained sticker draft.
    if(pendingOp&&!busy&&!T.store.dirty&&!T.store.inflight&&!T.store.conflict&&!T.store.lost){completeOperation();error='';}
    const data=getData();
    for(const [surface,entry]of surfaces)if(!liveTarget(surface)||!entry.layer.isConnected||entry.id!==surface.dataset.stickerTarget){entry.layer.remove();surfaces.delete(surface);}
    for(const surface of doc.querySelectorAll('[data-sticker-kind][data-sticker-target]')){
      if(!liveTarget(surface))continue;let entry=surfaces.get(surface);if(!entry){surface.classList.add('sticker-surface');const layer=el('div','sticker-layer',surface);entry={layer,nodes:new Map(),id:surface.dataset.stickerTarget};surfaces.set(surface,entry);}
      surface.dataset.stickerEditing=String(editing);entry.layer.setAttribute('aria-hidden',String(!editing));if(surface.dataset.stickerKind==='note')surface.tabIndex=editing?0:-1;
      const rows=data.placements.filter(p=>p.targetType===surface.dataset.stickerKind&&p.targetId===surface.dataset.stickerTarget).sort((a,b)=>a.updatedAt-b.updatedAt||a.id.localeCompare(b.id)),ids=new Set(rows.map(p=>p.id));
      for(const [id,n]of entry.nodes)if(!ids.has(id)){n.remove();entry.nodes.delete(id);}
      for(const [index,p]of rows.entries()){let n=entry.nodes.get(p.id);if(!n){n=el('button','sticker-instance',entry.layer);n.type='button';n.dataset.stickerPlacement=p.id;const img=el('img','',n);img.src='/sticker-art/'+p.itemId+'-v1.png';img.alt='';img.draggable=false;entry.nodes.set(p.id,n);}
        n.tabIndex=editing?0:-1;n.setAttribute('aria-disabled',String(busy));const item=data.items.find(i=>i.id===p.itemId);n.setAttribute('aria-label',local(item?.name));n.setAttribute('aria-pressed',String(selected===p.id&&selectedSurface===surface));n.style.zIndex=index+1;if(drag?.node!==n)paint(n,surface,p);
      }
    }
    doc.body.classList.toggle('sticker-decorating',editing);doc.body.classList.toggle('sticker-bag-open',opened);fab.hidden=!inNotes()||!!T.store.lost;fab.disabled=busy;fab.setAttribute('aria-label',tr('打开贴纸背包','Open sticker backpack'));fab.title=tr('贴纸背包 · 拖动可贴边','Sticker backpack · Drag to dock');fab.setAttribute('aria-expanded',String(opened));badge.hidden=!data.owned;text(badge,data.owned);
    bag.hidden=!inNotes()||!opened;text(title,tr('我的小背包','My little backpack'));text(count,data.owned+' / '+data.total+tr(' 款已收藏',' collected'));text(close,'×');close.setAttribute('aria-label',tr('关闭背包','Close backpack'));text(help,tr('选一张，再点笔记里想贴的位置。贴纸仅用于 Note，正文照常编辑。','Pick a sticker, then click your note to place it. Stickers belong in Notes; text stays editable.'));
    const labels={all:tr('全部','All'),garden:tr('花园','Garden'),slow:tr('日常','Daily'),stars:tr('星光','Stars'),celebrate:tr('庆祝','Joy')};for(const [id,b]of filterButtons){text(b,labels[id]);b.setAttribute('aria-pressed',String(id===filter));}
    const items=data.items.filter(i=>i.owned&&(filter==='all'||filter===i.setId)),signature=JSON.stringify([language,items.map(i=>i.id)]);
    if(signature!==bagSignature){bagSignature=signature;grid.replaceChildren();for(const item of items){const b=button(grid,'use');b.className='sticker-bag-item';b.dataset.itemId=item.id;const img=el('img','',b);img.src='/sticker-art/'+item.id+'-v1.png';img.alt='';img.draggable=false;const name=el('span','',b);text(name,local(item.name));b.title=local(item.name);}}
    grid.querySelectorAll('button').forEach(b=>b.disabled=busy);empty.hidden=!!items.length;text(empty,tr('这一格还空着。去贴纸铺挑一点喜欢的吧。','This pocket is empty. Find something lovely at the sticker stall.'));text(edit,editing?tr('完成装饰','Finish decorating'):tr('调整已有贴纸','Arrange stickers'));edit.disabled=busy;text(shop,tr('逛贴纸铺 ↗','Visit sticker stall ↗'));shop.disabled=busy;
    bar.hidden=!inNotes()||!editing&&!error;text(status,error||(busy?tr('正在保存贴纸…','Saving sticker…'):armed?tr('点笔记贴下 · Esc 取消','Click your note to place · Esc cancels'):tr('装饰模式 · 拖动贴纸，方向键微调 · Esc 完成','Decorate · Drag stickers or use arrow keys · Esc finishes')));text(done,tr('完成','Done'));done.disabled=busy;text(undo,tr('撤销','Undo'));undo.disabled=busy||!undoStack.length;text(retry,tr('重试保存','Retry save'));retry.hidden=!error||!T.store.dirty;retry.disabled=busy;
    const p=row(selected),item=p&&data.items.find(i=>i.id===p.itemId);text(hudName,local(item?.name));const names={left:tr('↶ 旋转','↶ Turn'),right:tr('旋转 ↷','Turn ↷'),smaller:'−',larger:'＋',front:tr('置顶','Front'),remove:tr('取下','Remove')};for(const b of hud.querySelectorAll('button')){const action=b.dataset.stickerControl;text(b,names[action]);b.disabled=busy||!p||(action==='smaller'&&p.size<=36)||(action==='larger'&&p.size>=180);b.setAttribute('aria-label',action==='smaller'?tr('缩小贴纸','Shrink sticker'):action==='larger'?tr('放大贴纸','Enlarge sticker'):names[action]);}updateHud();positionOrb();
  }
  function schedule(){if(!queued&&inNotes()&&!doc.hidden&&!doc.tracerHidden){queued=true;requestAnimationFrame(refresh);}}
  async function flush(){if(T.store.lost||T.store.conflict)throw Error('save');clearTimeout(T.store.timer);if(T.store.dirty)T.saveNow();const until=Date.now()+20000;while(T.store.inflight&&Date.now()<until)await new Promise(r=>setTimeout(r,40));if(T.store.dirty||T.store.inflight||T.store.lost||T.store.conflict)throw Error('save');}
  function completeOperation(){if(!pendingOp)return;const p=row(pendingOp.value.id);if(p&&pendingOp.history){undoStack.push({before:pendingOp.before||{...p,visible:false},expected:p.updatedAt});if(undoStack.length>30)undoStack.shift();}pendingOp=null;}
  async function save(value,history=true){if(busy||error&&T.store.dirty)return;busy=true;error='';refresh();try{await flush();const before=row(value.id);const result=G.layoutSticker(T.store.data,value);if(!result.ok){const reasons={'page-full':tr('这一页最多贴 24 张，先取下一张吧。','This page holds 24 stickers. Remove one first.'),'target-missing':tr('这篇笔记已被删除。','This note was deleted.'),'notes-only':tr('贴纸只能放在 Note 笔记里。','Stickers can only be placed in Notes.')};error=reasons[result.reason]||tr('暂时无法摆放这张贴纸。','This sticker cannot be placed here.');return;}
      pendingOp={value,before:before?{...before}:null,history};T.touch();await flush();completeOperation();
    }catch{error=tr('贴纸还没保存成功。原位置已保留，请重试。','Sticker not saved. The last saved position is shown. Please retry.');}finally{busy=false;ledgerRef=null;refresh();T.garden?.refresh();}}
  async function retrySave(){if(busy)return;busy=true;refresh();try{await flush();completeOperation();error='';}catch{error=tr('仍未保存，请检查连接后重试。','Still not saved. Check the connection and retry.');}finally{busy=false;ledgerRef=null;refresh();}}
  function finish(){if(busy)return;cancelDrag();editing=false;armed=null;selected=null;selectedSurface=null;ghost.hidden=true;refresh();}
  function open(){if(!inNotes())return;opened=true;refresh();positionOrb();close.focus();}
  function choose(id){if(busy||!getData().items.some(i=>i.id===id&&i.owned))return;if(!inNotes())T.show('notes');opened=false;editing=true;armed=id;selected=null;ghost.src='/sticker-art/'+id+'-v1.png';ghost.hidden=true;refresh();requestAnimationFrame(()=>{const target=doc.querySelector('#sec-notes [data-sticker-kind=note]');if(target){if(!target.hasAttribute('tabindex'))target.tabIndex=0;target.focus({preventScroll:true});}});}
  function undoLast(){if(busy||error&&T.store.dirty||!undoStack.length)return;const item=undoStack.pop(),current=row(item.before.id);if(!current||current.updatedAt!==item.expected){error=tr('这张贴纸已在别处修改，保留最新位置。','This sticker changed elsewhere. Keeping its latest position.');refresh();return;}void save(item.before,false);}
  function click(e){const b=e.target.closest('[data-sticker-control]');if(!inNotes()||!b||b.disabled)return;const action=b.dataset.stickerControl;
    if(action==='bag'){if(suppressOrbClick){suppressOrbClick=false;return;}opened=!opened;refresh();positionOrb();if(opened)close.focus();return;}if(action==='close'){opened=false;refresh();fab.focus();return;}if(action==='filter'){filter=b.dataset.filter;refresh();positionOrb();return;}if(action==='use'){choose(b.dataset.itemId);return;}
    if(action==='shop'){finish();opened=false;T.show('shop');doc.querySelector('.store-navigation [data-store-action=stickers]')?.click();refresh();return;}if(action==='edit'){opened=false;editing=!editing;armed=null;selected=null;refresh();return;}if(action==='done'){finish();return;}if(action==='retry'){void retrySave();return;}if(action==='undo'){undoLast();return;}
    const p=row(selected);if(!p)return;const patch=action==='left'?{rotation:(p.rotation+165+360)%360-180}:action==='right'?{rotation:(p.rotation+195+360)%360-180}:action==='smaller'?{size:Math.max(36,p.size-12)}:action==='larger'?{size:Math.min(180,p.size+12)}:action==='remove'?{visible:false}:{};void save({...p,...patch});
  }
  for(const root of [fab,bag,bar,hud])root.addEventListener('click',click);
  function targetAt(event){const n=event.target.closest?.('[data-sticker-kind][data-sticker-target]');return n&&liveTarget(n)?n:null;}
  function place(surface,x,y){if(!armed||busy)return;const id='st_'+crypto.randomUUID().replace(/-/g,''),value={id,itemId:armed,targetType:surface.dataset.stickerKind,targetId:surface.dataset.stickerTarget,x:clamp(x,0,100),y:clamp(y,0,100),size:96,rotation:-6};armed=null;ghost.hidden=true;selected=id;selectedSurface=surface;void save(value);}
  function down(e){if(!editing||e.button!==0||busy||e.target.closest('.sticker-control,.chip,#f-close,#f-save,#f-cancel'))return;
    const handle=e.target.closest('[data-sticker-handle]');
    if(handle){const n=selectedNode(),surface=selectedSurface,p=row(selected);if(!n||!liveTarget(surface)||!p||armed)return;e.preventDefault();e.stopImmediatePropagation();const r=surface.getBoundingClientRect(),b=n.getBoundingClientRect(),g=geometry(surface,p),angle=p.rotation*Math.PI/180,hx=Number(handle.dataset.axisX),hy=Number(handle.dataset.axisY);
      drag={kind:handle.dataset.stickerHandle==='rotate'?'rotate':'resize',node:n,surface,capture:handle,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,bounds:r,original:p,value:{...p,x:g.x,y:g.y},size:g.size,centerX:b.x+b.width/2,centerY:b.y+b.height/2,axisX:hx*Math.cos(angle)-hy*Math.sin(angle),axisY:hx*Math.sin(angle)+hy*Math.cos(angle),axisLength:hx*hx+hy*hy,scale:r.width/Math.max(1,surface.offsetWidth),startAngle:Math.atan2(e.clientY-b.y-b.height/2,e.clientX-b.x-b.width/2)};handle.setPointerCapture(e.pointerId);handle.focus({preventScroll:true});updateHud();return;}
    const surface=targetAt(e);if(!surface)return;const n=e.target.closest('.sticker-instance');
    if(armed){e.preventDefault();e.stopImmediatePropagation();const r=surface.getBoundingClientRect();place(surface,(e.clientX-r.x)/r.width*100,(e.clientY-r.y)/r.height*100);return;}
    if(!n)return;const p=row(n.dataset.stickerPlacement);if(!p)return;e.preventDefault();e.stopImmediatePropagation();selected=p.id;selectedSurface=surface;const r=surface.getBoundingClientRect(),g=geometry(surface,p);drag={kind:'move',node:n,capture:n,surface,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,bounds:r,original:p,value:{...p,x:g.x,y:g.y}};n.setPointerCapture(e.pointerId);n.focus({preventScroll:true});refresh();
  }
  function move(e){if(drag&&drag.pointer===e.pointerId){const d=drag,g=geometry(d.surface,d.original),dx=e.clientX-d.startX,dy=e.clientY-d.startY;
      if(d.kind==='rotate'){const angle=Math.atan2(e.clientY-d.centerY,e.clientX-d.centerX),delta=angle-d.startAngle;let degrees=d.original.rotation+delta*180/Math.PI;if(e.shiftKey)degrees=Math.round(degrees/15)*15;d.value.rotation=((degrees+180)%360+360)%360-180;}
      else if(d.kind==='resize'){const limit=Math.min(180,d.surface.clientWidth*.7,d.surface.clientHeight*.7),size=clamp(d.size+(dx*d.axisX+dy*d.axisY)/(d.axisLength*d.scale),Math.min(36,limit),limit),change=(size-d.size)*d.scale;d.value.size=clamp(size,36,180);d.value.x=g.x+d.axisX*change/2/d.bounds.width*100;d.value.y=g.y+d.axisY*change/2/d.bounds.height*100;}
      else{d.value.x=clamp(g.x+dx/d.bounds.width*100,0,100);d.value.y=clamp(g.y+dy/d.bounds.height*100,0,100);}
      const bounded=geometry(d.surface,d.value);d.value.x=bounded.x;d.value.y=bounded.y;paint(d.node,d.surface,d.value);updateHud();e.preventDefault();e.stopImmediatePropagation();return;}
    if(editing&&armed){ghost.hidden=!targetAt(e);ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';}
  }
  function end(e){if(!drag||drag.pointer!==e.pointerId)return;const d=drag;drag=null;try{d.capture.releasePointerCapture(e.pointerId);}catch{}e.preventDefault();e.stopImmediatePropagation();if(Math.abs(e.clientX-d.startX)+Math.abs(e.clientY-d.startY)>2&&['x','y','size','rotation'].some(k=>Math.abs(d.value[k]-d.original[k])>.001))void save(d.value);else refresh();}
  function cancelDrag(){if(!drag)return;const d=drag;drag=null;try{d.capture.releasePointerCapture(d.pointer);}catch{}refresh();}
  doc.addEventListener('pointerdown',down,true);doc.addEventListener('pointermove',move,true);doc.addEventListener('pointerup',end,true);doc.addEventListener('pointercancel',cancelDrag,true);
  doc.addEventListener('click',e=>{if(editing&&targetAt(e)&&!e.target.closest('.sticker-control,.chip,#f-close,#f-save,#f-cancel')){e.preventDefault();e.stopImmediatePropagation();}},true);
  doc.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&(opened||editing)){e.preventDefault();e.stopImmediatePropagation();if(drag)cancelDrag();else if(armed){armed=null;ghost.hidden=true;refresh();}else if(opened){opened=false;refresh();fab.focus();}else finish();return;}
    if(!editing||busy)return;const surface=targetAt(e);if(armed&&surface&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopImmediatePropagation();place(surface,50,50);return;}
    const handle=e.target.closest('[data-sticker-handle]');if(handle&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){const p=row(selected);if(!p)return;e.preventDefault();e.stopImmediatePropagation();const sign=['ArrowLeft','ArrowDown'].includes(e.key)?-1:1;if(handle.dataset.stickerHandle==='rotate'){const angle=p.rotation+sign*(e.shiftKey?15:1);void save({...p,rotation:((angle+180)%360+360)%360-180});}else void save({...p,size:clamp(p.size+sign*(e.shiftKey?10:2),36,180)});return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea,[contenteditable=true]')){e.preventDefault();e.stopImmediatePropagation();undoLast();return;}
    const node=e.target.closest('.sticker-instance');if(!node)return;const p=row(node.dataset.stickerPlacement);if(!p)return;selected=p.id;selectedSurface=surface;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopImmediatePropagation();refresh();return;}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();const step=e.shiftKey?5:1;void save({...p,...(['Delete','Backspace'].includes(e.key)?{visible:false}:{x:clamp(p.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),0,100),y:clamp(p.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0),0,100)})});}
  },true);
  doc.addEventListener('scroll',()=>{if(drag)cancelDrag();else updateHud();},true);addEventListener('resize',()=>{cancelDrag();schedule();});addEventListener('blur',cancelDrag);doc.addEventListener('lostpointercapture',e=>{if(drag?.pointer===e.pointerId)cancelDrag();},true);
  const observer=new MutationObserver(schedule);observer.observe(doc.getElementById('sec-notes'),{childList:true,subtree:true,attributes:true,attributeFilter:['data-sticker-target','data-sticker-kind']});
  T.sections.forEach(section=>T.onShow(section,()=>{cancelDrag();orbDrag=null;fab.classList.remove('is-dragging');if(section!=='notes'){opened=false;editing=false;armed=null;ghost.hidden=true;}selected=null;refresh();positionOrb();}));
  doc.addEventListener('tracer-visibilitychange',()=>{if(doc.tracerHidden)cancelDrag();else schedule();});
  T.ready.then(()=>{refresh();setInterval(()=>{if(ledgerRef!==accepted()?.taskGarden?.market?.stickers||language!==TracerLocale.language())schedule();},750);});
  T.stickers={open,choose,refresh:schedule};
})();
