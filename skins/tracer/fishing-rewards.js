(function(root){
  'use strict';
  const products={boots:'/fishing-art/catch-boots-v1.png',broken_watch:'/fishing-art/catch-broken_watch-v1.png',trash_bag:'/fishing-art/catch-trash_bag-v1.png',mystery_bundle:'/fishing-art/catch-mystery_bundle-v1.png'};
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const language=()=>root.Tracer?.fishing?.snapshot?.()?.language||root.document?.documentElement.lang||'zh';
  const name=(item,lang=language())=>Array.isArray(item?.name)?item.name[lang.startsWith('en')?1:0]:item?.name||'';
  let activeDialog=null,background=null,activeGifts={avatarFrame:null,background:null};
  function asset(item){return products[item?.kind==='mystery'||item?.id==='mystery_bundle'?'mystery_bundle':item?.variant]||products.boots;}
  function markup(item){return '<img class="fishing-catch-item" src="'+asset(item)+'" alt="" draggable="false">';}
  function createFigure(host,options={}){
    const img=host.ownerDocument.createElement('img');img.className='fishing-catch-item';img.alt='';img.draggable=false;host.append(img);
    const setFish=item=>{const src=asset(item);if(img.getAttribute('src')!==src)img.src=src;};setFish(options.fish);
    return{setFish,setVisible(value){img.hidden=!value;},setPose(){},destroy(){img.remove();}};
  }
  function giftMarkup(gift){
    if(!gift)return '';
    if(gift.slot==='background')return '<div class="fishing-gift-scene"><img src="'+escape(gift.asset)+'" alt="" loading="lazy"></div>';
    const avatar=root.document?.querySelector('.account-trigger>img')?.getAttribute('src');
    return '<div class="fishing-gift-portrait"><span class="fishing-gift-portrait-center">'+(avatar?'<img src="'+escape(avatar)+'" alt="">':'✦')+'</span><img class="fishing-gift-frame" src="'+escape(gift.asset)+'" alt="" loading="lazy"></div>';
  }
  function apply(state){
    const doc=root.document;if(!doc)return;const html=doc.documentElement,owned=state?.giftUnlocks||[],appearance=state?.giftAppearance||{};
    const frame=owned.find(g=>g.id===appearance.avatarFrameId&&g.slot==='avatarFrame'),scene=owned.find(g=>g.id===appearance.backgroundId&&g.slot==='background');
    activeGifts={avatarFrame:frame||null,background:scene||null};
    if(frame){html.dataset.fishingAvatar=frame.id;html.style.setProperty('--fishing-gift-avatar-image','url("'+frame.asset+'")');const aperture=frame.aperture||{cx:.5,cy:.5,r:.32},scale=1/(2*aperture.r);html.style.setProperty('--fishing-gift-avatar-size',scale*100+'%');html.style.setProperty('--fishing-gift-avatar-x',(0.5-aperture.cx*scale)*100+'%');html.style.setProperty('--fishing-gift-avatar-y',(0.5-aperture.cy*scale)*100+'%');}
    else{delete html.dataset.fishingAvatar;for(const key of ['image','size','x','y'])html.style.removeProperty('--fishing-gift-avatar-'+key);}
    if(scene){html.dataset.fishingBackground=scene.id;if(!background){background=doc.createElement('div');background.id='fishing-gift-background';background.setAttribute('aria-hidden','true');doc.body.prepend(background);}background.hidden=false;background.style.backgroundImage='url("'+scene.asset+'")';setOpacity(root.TracerWallpapers?.opacity?.()??85);}
    else{delete html.dataset.fishingBackground;background?.remove();background=null;}
  }
  function clear(){if(activeDialog){activeDialog.close();activeDialog.remove();activeDialog=null;}apply(null);}
  function setOpacity(value){if(background)background.style.opacity=String(Math.max(0,Math.min(100,Number.isFinite(Number(value))?Number(value):85))/100);}
  async function clearSlotForSelection(slot){
    if(!activeGifts[slot])return true;
    const result=await root.Tracer?.fishing?.action?.('remove-gift',slot);
    return !!result?.ok&&!activeGifts[slot];
  }
  function reveal(result){
    const gift=result?.gift,doc=root.document;if(!gift||!doc)return;
    if(activeDialog){activeDialog.close();activeDialog.remove();}
    const english=language().startsWith('en'),tr=(zh,en)=>english?en:zh,modal=doc.createElement('dialog');activeDialog=modal;
    modal.className='fishing-gift-reveal';modal.setAttribute('aria-label',tr('神秘礼包揭晓','Mystery gift revealed'));
    modal.innerHTML='<button type="button" class="fishing-gift-close" data-close aria-label="'+tr('关闭','Close')+'">×</button><div class="fishing-gift-unwrapping" aria-hidden="true">'+markup({kind:'mystery'})+'</div><div class="fishing-gift-reveal-content"><span class="fishing-eyebrow">'+tr('水下的秘密 · 钓鱼限定','A SECRET FROM THE WATER · FISHING EXCLUSIVE')+'</span><div class="fishing-gift-reveal-art">'+giftMarkup(gift)+'</div><span class="fishing-gift-kind">'+(gift.slot==='avatarFrame'?tr('典藏头像框','Collectible avatar frame'):tr('典藏背景板','Collectible background'))+'</span><h2>'+escape(name(gift))+'</h2><p>'+escape(name({name:gift.description}))+'</p><p class="fishing-gift-receipt" role="status">'+(result.duplicate?tr('已经收藏 · 获得 '+result.earned+' 金币','Already collected · Received '+result.earned+' coins'):tr('已加入你的礼物收藏','Added to your gift collection'))+'</p><div class="fishing-gift-reveal-actions"><button type="button" class="fishing-button" data-close>'+tr('收进收藏','Keep in collection')+'</button><button type="button" class="fishing-button primary" data-equip>'+tr('立即使用','Use now')+'</button></div></div>';
    modal.addEventListener('click',event=>{if(event.target.closest('[data-close]'))modal.close();if(event.target.closest('[data-equip]')){modal.close();void root.Tracer?.fishing?.action?.('equip-gift',gift.id,{slot:gift.slot});}});
    modal.addEventListener('close',()=>{modal.remove();if(activeDialog===modal)activeDialog=null;},{once:true});doc.body.append(modal);modal.showModal();modal.querySelector('[data-close]').focus();
  }
  root.TracerFishingRewards={products,asset,markup,createFigure,giftMarkup,apply,clear,reveal,setOpacity,clearSlotForSelection,activeGift:slot=>activeGifts[slot]||null};
})(typeof window!=='undefined'?window:globalThis);
