'use strict';
(function(){
  const items=window.WALLPAPERS,$=id=>document.getElementById(id),grid=$('catalog-grid');
  const types={static:['STILL / 静态壁纸','静态','背景画面'],dynamic:['MOTION / 动态壁纸','动态','背景画面与动态效果'],material:['MATERIAL / 整体材质','材质','背景、顶栏、侧栏、卡片、边框']};
  const materialBackgrounds={obsidian:'radial-gradient(ellipse at 75% 20%,#444035,#16171a 65%)',porcelain:'radial-gradient(ellipse at 80% 20%,#fbfcf8,#ccddd2)',linen:'linear-gradient(125deg,#eee4cf,#c9baa0)',walnut:'repeating-linear-gradient(94deg,#402c20 0 3px,#483022 3px 8px,#503728 8px 16px)',glass:'radial-gradient(ellipse at 75% 20%,#a5d7e2,transparent 50%),linear-gradient(140deg,#375a76,#2f707f)',titanium:'linear-gradient(130deg,#3b4653,#7a858e 45%,#35414e)',velvet:'radial-gradient(ellipse at 80% 10%,#925774,#362431 70%)',paper:'linear-gradient(130deg,#f2efde,#d9dccd)',cyber:'radial-gradient(ellipse at 80% 5%,#61538c,#192640 60%)',celadon:'linear-gradient(120deg,#e4ead4,#b3c59a)'};
  let filter='all',paused=false,selected=items.find(x=>x.id===location.hash.slice(1))||items[0],favorites=new Set();
  try{const saved=JSON.parse(localStorage.getItem('tracer.wallpaper-studio.v1.favorites')||'[]');if(Array.isArray(saved))favorites=new Set(saved.filter(id=>items.some(x=>x.id===id)));}catch{}
  const motion=TracerWallpaperMotion.player($('motion'));
  function miniMaterial(item){const wrap=document.createElement('div');wrap.className='mini-material stage';wrap.dataset.material=item.material;wrap.style.cssText='aspect-ratio:auto;min-height:0;border-radius:0';wrap.innerHTML='<div class="mini-top"><i></i><i></i><i></i></div><div class="mini-side"><i></i><i></i><i></i></div><div class="mini-cards"><i></i><i></i><i></i></div>';return wrap;}
  function render(){grid.replaceChildren();const shown=items.filter(x=>filter==='all'||filter==='favorites'&&favorites.has(x.id)||x.type===filter);$('result-count').textContent=shown.length+' 款设计';$('empty-state').hidden=shown.length>0;
    shown.forEach(item=>{const button=document.createElement('button');button.type='button';button.className='wallpaper-card'+(selected.id===item.id?' selected':'');button.dataset.id=item.id;button.setAttribute('aria-label','预览 '+item.name+'，'+types[item.type][1]+'，'+item.price+' 金币');button.setAttribute('aria-pressed',String(selected.id===item.id));const art=document.createElement('div');art.className='card-art';
      if(item.type==='static'){const img=document.createElement('img');img.src=item.asset;img.alt=item.name;img.loading='lazy';img.decoding='async';art.append(img);}
      else if(item.type==='dynamic'){const canvas=document.createElement('canvas');canvas.width=440;canvas.height=275;canvas.setAttribute('aria-hidden','true');TracerWallpaperMotion.draw(canvas,item,6);art.append(canvas);}
      else art.append(miniMaterial(item));
      const label=document.createElement('span');label.className='card-label';label.textContent=item.id.toUpperCase()+' / '+types[item.type][1]+(item.type==='dynamic'?' ▷':'');art.append(label);
      if(favorites.has(item.id)){const heart=document.createElement('span');heart.className='card-heart';heart.textContent='♥';art.append(heart);}
      const copy=document.createElement('div');copy.className='card-copy';const name=document.createElement('span');name.className='card-name';name.textContent=item.name;const price=document.createElement('span');price.className='card-price';price.textContent='◈ '+item.price;copy.append(name,price);const english=document.createElement('span');english.className='card-en';english.textContent=item.en;button.append(art,copy,english);button.addEventListener('click',()=>{select(item);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)$('stage').scrollIntoView({behavior:'smooth',block:'center'});else $('stage').scrollIntoView({block:'center'});});grid.append(button);
    });
  }
  function select(item){selected=item;$('detail-type').textContent=types[item.type][0];$('detail-name').textContent=item.name;$('detail-en').textContent=item.en;$('detail-description').textContent=item.description;$('detail-style').textContent=item.style;$('detail-scope').textContent=types[item.type][2];$('detail-price').textContent=item.price;$('scene-badge').textContent=item.id.toUpperCase()+' · '+item.name;
    $('swatches').replaceChildren(...item.colors.map(color=>{const el=document.createElement('span');el.style.background=color;el.title=color;return el;}));
    $('stage').dataset.material=item.material||'default';$('wallpaper').style.backgroundImage=item.asset?`url("${item.asset}")`:item.type==='material'?materialBackgrounds[item.material]:'none';$('motion').hidden=item.type!=='dynamic';motion.set(item.type==='dynamic'?item:null);
    $('pause').disabled=item.type!=='dynamic'||motion.reduced;$('pause').textContent=motion.reduced?'系统已减少动态':paused?'播放动态':'暂停动态';
    const owned=favorites.has(item.id);$('favorite').textContent=owned?'♥ 已加入心愿单':'♡ 加入心愿单';$('favorite').setAttribute('aria-pressed',String(owned));
    $('download').hidden=item.type==='material';$('download').href=item.asset||'wallpaper.html#'+item.id;$('download').textContent=item.asset?'下载原图 ↗':'打开纯动态壁纸 ↗';
    if(item.asset){$('download').setAttribute('download',item.id+'-'+item.en.replace(/[^a-z0-9]+/gi,'-')+'.png');$('download').removeAttribute('target');}else{$('download').removeAttribute('download');$('download').target='_blank';$('download').rel='noopener';}
    $('delivery-note').textContent=item.type==='static'?'已生成独立 PNG 原图，可下载使用。':item.type==='dynamic'?'这是实时运行的动态效果，可暂停；系统减少动态时显示静帧。':'当前直接预览完整材质、卡片和边框效果。';
    $('announcement').textContent='正在预览 '+item.name+'，'+types[item.type][1];try{history.replaceState(null,'','#'+item.id);}catch{}render();
  }
  document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;document.querySelectorAll('.filter').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});render();}));
  $('show-ui').addEventListener('change',e=>$('workspace').classList.toggle('ui-hidden',!e.target.checked));
  $('dimmer').addEventListener('input',e=>{$('shade').style.opacity=Number(e.target.value)/100;$('dimmer-value').textContent=e.target.value+'%';});
  $('pause').addEventListener('click',()=>{paused=!paused;motion.pause(paused);$('pause').textContent=paused?'播放动态':'暂停动态';});
  $('favorite').addEventListener('click',()=>{favorites.has(selected.id)?favorites.delete(selected.id):favorites.add(selected.id);try{localStorage.setItem('tracer.wallpaper-studio.v1.favorites',JSON.stringify([...favorites]));}catch{}select(selected);});
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}catch{$('announcement').textContent='当前浏览器不支持全屏，可以使用浏览器缩放查看。';}});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{$('pause').disabled=selected.type!=='dynamic'||motion.reduced;$('pause').textContent=motion.reduced?'系统已减少动态':paused?'播放动态':'暂停动态';});
  addEventListener('hashchange',()=>{const next=items.find(x=>x.id===location.hash.slice(1));if(next)select(next);});
  select(selected);
})();
