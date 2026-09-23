(function(){
  'use strict';
  const A=window.TracerAccount,T=window.Tracer;if(!A||!T)return;
  const tr=(zh,en)=>window.TracerLocale?.language()==='en'?en:zh;
  const root=document.documentElement,layer=document.createElement('div');layer.id='account-wallpaper';layer.setAttribute('aria-hidden','true');document.body.prepend(layer);
  let current=null,player=null,materialPlayer=null,materialLayer=null,signature='',refreshing=false;
  const errors={'insufficient-coins':['金币不足，先去花园出售收获吧。','Not enough coins. Sell harvests in your garden to earn more.'],'wallpaper-not-owned':['请先购买这款壁纸。','Purchase this wallpaper first.'],'invalid-wallpaper':['这款壁纸暂不可用。','This wallpaper is unavailable.']};
  const el=(tag,cls,parent,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;};
  const button=(parent,label,fn)=>{const b=el('button','account-button',parent,label);b.type='button';b.onclick=fn;return b;};
  const DEFAULT_OPACITY=85;
  function opacity(){const saved=localStorage.getItem('tracer.wallpaperOpacity'),value=Number(saved);return saved===null||!Number.isFinite(value)?DEFAULT_OPACITY:Math.max(0,Math.min(100,value));}
  function setOpacity(value,persist=true){
    value=Number(value);if(!Number.isFinite(value))value=DEFAULT_OPACITY;value=Math.round(Math.max(0,Math.min(100,value)));
    if(persist)localStorage.setItem('tracer.wallpaperOpacity',String(value));layer.style.opacity=String(value/100);player?.pause(value===0||localStorage.getItem('tracer.wallpaperPaused')==='1');
    document.querySelectorAll('[data-wallpaper-opacity]').forEach(n=>{n.value=String(value);n.setAttribute('aria-valuetext',value+'%');});
    document.querySelectorAll('[data-wallpaper-opacity-value]').forEach(n=>n.textContent=value+'%');
    document.querySelectorAll('.wallpaper-opacity-scene').forEach(n=>n.style.opacity=String(value/100));
  }
  function paintOpacityPreviews(){
    const item=current?.catalog?.find(i=>i.id===current.appearance?.backgroundItemId);
    document.querySelectorAll('.wallpaper-opacity-preview').forEach(host=>{
      host.hidden=!item;host.replaceChildren();if(!item)return;
      host.setAttribute('aria-label',tr('当前壁纸：','Current wallpaper: ')+tr(item.name,item.en));
      const scene=el('div','wallpaper-opacity-scene',host);scene.style.opacity=String(opacity()/100);
      if(item.type==='dynamic'){const canvas=el('canvas','',scene);canvas.width=400;canvas.height=250;TracerWallpaperMotion.draw(canvas,item,6);}else scene.style.backgroundImage='url("'+item.asset+'")';
      el('span','wallpaper-opacity-caption',host,tr('当前壁纸','Current wallpaper'));
    });
  }
  function opacityControl(host){
    const box=el('div','wallpaper-opacity-control',host);el('div','wallpaper-opacity-preview',box);
    const label=el('label','wallpaper-opacity-label',box),caption=el('span','',label,tr('壁纸不透明度','Wallpaper opacity')),value=el('span','',label,opacity()+'%');value.dataset.wallpaperOpacityValue='';
    const slider=el('input','',label);slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=String(opacity());slider.dataset.wallpaperOpacity='';slider.setAttribute('aria-label',caption.textContent);slider.setAttribute('aria-valuetext',opacity()+'%');slider.oninput=()=>setOpacity(slider.value);
    button(box,tr('恢复 85%','Reset to 85%'),()=>setOpacity(DEFAULT_OPACITY));el('small','',box,tr('即时生效 · 仅调整背景，文字与卡片保持清晰','Live adjustment · text and cards stay crisp'));
    paintOpacityPreviews();return box;
  }
  setOpacity(opacity(),false);
  function apply(collection){
    window.TracerFrames?.apply(collection);
    current=collection;const appearance=collection?.appearance||{},catalog=collection?.catalog||[],bg=catalog.find(i=>i.id===appearance.backgroundItemId),material=catalog.find(i=>i.id===appearance.materialItemId),next=JSON.stringify([bg?.id,material?.id]);
    if(signature===next)return;signature=next;paintOpacityPreviews();if(player){player.destroy();player=null;}materialPlayer?.destroy();materialPlayer=null;materialLayer?.remove();materialLayer=null;layer.replaceChildren();layer.style.backgroundImage='';
    root.toggleAttribute('data-account-wallpaper',!!bg);if(material)root.dataset.wallpaperMaterial=material.material;else delete root.dataset.wallpaperMaterial;
    root.toggleAttribute('data-wallpaper-motion',bg?.type==='dynamic');
    if(bg?.type==='static')layer.style.backgroundImage='url("'+bg.asset+'")';
    if(bg?.type==='dynamic'){player=TracerWallpaperMotion.player(el('canvas','',layer));player.speed(localStorage.getItem('tracer.wallpaperSpeed'));player.set(bg);player.pause(opacity()===0||localStorage.getItem('tracer.wallpaperPaused')==='1');}
    if(material&&window.TracerMaterialOptics){
      materialLayer=el('div','account-material-optics',document.body);materialLayer.setAttribute('aria-hidden','true');
      const rects=()=>['.top','.side','.rail'].map(selector=>{const n=document.querySelector(selector),r=n?.getBoundingClientRect();return r&&r.width>0?{x:r.x,y:r.y,w:r.width,h:r.height,width:material.material==='glass'?4:3,radius:material.material==='glass'?9:3}:{x:0,y:0,w:0,h:0,width:0};});
      materialPlayer=TracerMaterialOptics.mount(materialLayer,{material:material.material,workspace:true,edge:4,imageURL:bg?.asset||bg?.sceneAsset,source:bg?.type==='dynamic'?()=>layer.querySelector('canvas'):undefined,rects});materialPlayer.pause(localStorage.getItem('tracer.wallpaperPaused')==='1');
    }
  }
  async function refresh(){if(refreshing||A.locked||A.switching||!A.context.user)return;refreshing=true;try{const result=await A.api('collection');if(!A.locked)apply(result);}catch{}finally{refreshing=false;}}
  function synchronize(collection){
    for(const ws of [T.store.data,T.store.base])if(ws?.taskGarden?.market)ws.taskGarden.market.wallpapers=structuredClone(collection.ledger);
    T.garden?.refresh();apply(collection);
  }
  function thumbnail(host,item,live=false){
    host.replaceChildren();delete host.dataset.wallpaperMaterial;host.style.background='';
    if(['avatarFrame','taskFrame'].includes(item.type))return window.TracerFrames.preview(host,item);
    if(item.type==='static'){const img=el('img','',host);img.src=item.asset;img.alt='';img.loading='lazy';return()=>{};}
    if(item.type==='dynamic'){const canvas=el('canvas','',host);canvas.width=640;canvas.height=360;if(live){const p=TracerWallpaperMotion.player(canvas);p.speed(localStorage.getItem('tracer.wallpaperSpeed'));p.set(item);p.pause(localStorage.getItem('tracer.wallpaperPaused')==='1');return Object.assign(()=>p.destroy(),{pause:value=>p.pause(value),speed:value=>p.speed(value)});}TracerWallpaperMotion.draw(canvas,item,4);return()=>{};}
    const cleanup=window.TracerMaterialOptics?.preview(host,item.material,live)||(()=>{});cleanup.pause?.(localStorage.getItem('tracer.wallpaperPaused')==='1');return cleanup;
  }
  async function mount(host,{flush,run,notice}){
    let state=null,type='static',selected=null,dispose=()=>{};
    const observer=new MutationObserver(()=>{if(!host.isConnected){dispose();observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});
    host.classList.add('wallpaper-shop');el('h3','',host,tr('把努力，换成喜欢的风景。','Turn progress into a view you love.'));el('p','account-help',host,tr('壁纸、材质、头像框与任务框，购买后永久收藏在当前本地账户中。任务框优先应用于任务卡片。','Wallpapers, materials, avatar frames and task frames stay in this local account. Task frames take priority on task cards.'));
    const status=el('p','account-help',host,tr('正在打开商店…','Opening the shop…'));
    async function load(){try{state=await A.api('collection');if(!host.isConnected)return;status.remove();apply(state);render();}catch{if(host.isConnected){status.textContent=tr('暂时无法打开商店。','The shop is unavailable.');button(host,tr('重试','Retry'),load);}}}await load();
    function render(){
      dispose();host.querySelector('.wallpaper-shop-body')?.remove();const body=el('div','wallpaper-shop-body',host),owned=new Set(state.items.map(p=>p.itemId));
      const wallet=el('div','wallpaper-wallet',body);el('strong','',wallet,'◈ '+state.balance+tr(' 金币',' coins')).id='wallpaper-balance';el('span','',wallet,owned.size+' / '+state.catalog.length+' '+tr('已收藏','collected'));
      const settings=el('div','wallpaper-settings',body);button(settings,tr('恢复默认背景','Default background'),()=>mutate('wallpaper-equip',{slot:'background',itemId:null})).disabled=!state.appearance.backgroundItemId;button(settings,tr('恢复默认材质','Default material'),()=>mutate('wallpaper-equip',{slot:'material',itemId:null})).disabled=!state.appearance.materialItemId;
      opacityControl(body);
      for(const [slot,zh,en]of [['avatarFrame','收起头像框','Remove avatar frame'],['taskFrame','收起任务框','Remove task frame']])button(settings,tr(zh,en),()=>mutate('wallpaper-equip',{slot,itemId:null})).disabled=!state.appearance[slot+'ItemId'];
      const pause=button(settings,'',()=>{const value=localStorage.getItem('tracer.wallpaperPaused')!=='1';localStorage.setItem('tracer.wallpaperPaused',value?'1':'0');player?.pause(value||opacity()===0);materialPlayer?.pause(value);dispose.pause?.(value);pause.textContent=value?tr('播放动态','Play motion'):tr('暂停动态','Pause motion');});pause.textContent=localStorage.getItem('tracer.wallpaperPaused')==='1'?tr('播放动态','Play motion'):tr('暂停动态','Pause motion');
      const speedLabel=el('label','wallpaper-speed',settings,tr('动态速度','Motion speed')),speed=el('select','',speedLabel);speed.id='wallpaper-speed';[[.5,'舒缓','Gentle'],[1,'标准','Standard'],[1.6,'活跃','Lively']].forEach(([value,zh,en])=>{const option=el('option','',speed,tr(zh,en));option.value=String(value);});speed.value=localStorage.getItem('tracer.wallpaperSpeed')||'1';if(!speed.value)speed.value='1';speed.onchange=()=>{localStorage.setItem('tracer.wallpaperSpeed',speed.value);player?.speed(speed.value);dispose.speed?.(speed.value);};
      const tabs=el('div','wallpaper-tabs',body);[['static','静态','Static'],['dynamic','动态','Animated'],['material','材质','Materials'],['avatarFrame','头像框','Avatar frames'],['taskFrame','任务框','Task frames'],['owned','我的收藏','Owned']].forEach(([id,zh,en])=>{const b=button(tabs,tr(zh,en),()=>{type=id;selected=null;render();});b.dataset.wallpaperFilter=id;b.setAttribute('aria-pressed',String(type===id));});
      const items=state.catalog.filter(i=>type==='owned'?owned.has(i.id):i.type===type);
      if(!items.length){el('p','account-collection-empty',body,tr('还没有收藏。挑选一款喜欢的壁纸，先看看效果吧。','Your collection is empty. Preview a wallpaper to get started.'));return;}
      const item=items.find(i=>i.id===selected)||items[0];selected=item.id;
      const hero=el('section','wallpaper-detail',body),visual=el('div','wallpaper-hero',hero);dispose=thumbnail(visual,item,true);
      const details=el('div','wallpaper-detail-copy',hero);el('h4','',details,tr(item.name,item.en));el('p','account-help',details,tr(item.description,item.descriptionEn||item.en+' · '+(item.type==='material'?'A complete material and frame style.':item.type==='dynamic'?'A gently animated view for your workspace.':'A quiet view for your workspace.')));
      if(item.type==='dynamic')el('p','account-help',details,tr('跟随系统“减少动态效果”设置；切到后台会自动暂停。','Respects reduced motion and pauses when the app is hidden.'));
      if(item.type==='material')el('p','account-help',details,tr('在预览上移动鼠标，查看材质反光。水晶边缘会折射壁纸；支持暂停与系统减少动态效果。','Move across the preview to explore the light. Crystal edges refract the wallpaper. Respects pause and reduced motion.'));
      const slot=window.TracerFrames.slot(item),equipped=state.appearance[slot+'ItemId']===item.id;
      const action=button(details,owned.has(item.id)?equipped?tr('正在使用','In use'):tr('应用到我的空间','Apply to my space'):tr('确认购买 · ','Buy for ')+item.price+tr(' 金币',' coins'),()=>mutate(owned.has(item.id)?'wallpaper-equip':'wallpaper-purchase',owned.has(item.id)?{slot,itemId:item.id}:{itemId:item.id}));action.id='wallpaper-action';action.classList.add('account-primary');action.disabled=equipped||!owned.has(item.id)&&state.balance<item.price;
      if(!owned.has(item.id)&&state.balance<item.price)el('p','account-help',details,tr('还差 ','Earn ')+(item.price-state.balance)+tr(' 金币，可通过出售花园收获获得。',' more coins by selling garden harvests.'));
      const grid=el('div','wallpaper-grid',body);items.forEach(row=>{const card=el('button','wallpaper-card',grid);card.type='button';card.dataset.wallpaperId=row.id;card.setAttribute('aria-label',tr('预览 ','Preview ')+tr(row.name,row.en));card.setAttribute('aria-pressed',String(row.id===selected));card.onclick=()=>{selected=row.id;render();host.querySelector('.wallpaper-detail').scrollIntoView({block:'start'});};thumbnail(el('div','wallpaper-card-image',card),row);const info=el('div','wallpaper-card-info',card);el('strong','',info,tr(row.name,row.en));el('span','',info,owned.has(row.id)?tr('已收藏','Owned'):'◈ '+row.price);});
    }
    async function mutate(action,input){await run(async()=>{
      await flush();let result;try{result=await A.api(action,input);}catch(error){const pair=errors[error.message];if(pair){notice(tr(...pair),'error');state=await A.api('collection');if(host.isConnected)render();return;}throw error;}
      state=result.collection;synchronize(state);if(host.isConnected)render();notice(action==='wallpaper-purchase'?tr('已加入当前账户收藏。点击「应用到我的空间」即可更换。','Added to your collection. Apply it to use it.'):tr('外观已保存到当前账户。','Appearance saved to this account.'));
    });}
  }
  window.TracerWallpapers={mount,refresh,thumbnail,synchronize,opacityControl,opacity,setOpacity};
  T.ready.then(refresh);addEventListener('focus',refresh);document.addEventListener('tracer-visibilitychange',()=>{if(!(document.hidden || document.tracerHidden))refresh();});setInterval(()=>{if(!(document.hidden || document.tracerHidden))refresh();},15000);
})();
