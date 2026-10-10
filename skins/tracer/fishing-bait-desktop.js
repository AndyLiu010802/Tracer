(function(){
  'use strict';
  const bridge=window.FishingBaitDesktop;if(!bridge)return;
  const byId=id=>document.getElementById(id),root=byId('bait-box'),slots=byId('bait-slots');
  const ids=['earthworm','dough','prawn','cutbait','lotusmeal'],cards=new Map();let snapshot=null,hovered='',renderKey='',regionsKey='',noticeKey='',noticeUntil=0,noticeTimer=null;
  const text=(zh,en)=>snapshot?.language==='en'?en:zh;
  function message(){
    const t=snapshot?.tackle;if(!t)return;
    const bait=t.baits.find(b=>b.id===(hovered||t.equippedBaitId)),lang=snapshot.language==='en'?1:0;
    const status=t.busy?text('正在保存…','Saving…'):(t.pendingSave?text('保存未完成，请重试。','Not saved. Please retry.'):snapshot.error||t.locked?text('垂钓中 · 收竿后可补充或更换','Fishing · finish this cast to restock or change bait'):snapshot.notice&&Date.now()<noticeUntil?snapshot.notice:hovered?bait?.role?.[lang]:text('已装备：','Equipped: ')+(bait?.name?.[lang]||'—'));
    byId('box-message').textContent=status||'';byId('box-message').title=status||'';
    byId('box-message').parentElement.dataset.error=String(!!snapshot.error);
    byId('box-retry').hidden=!t.pendingSave;byId('box-retry').disabled=t.busy;
  }
  for(const id of ids){
    const card=document.createElement('button');card.type='button';card.className='bait-slot';card.dataset.bait=id;
    card.innerHTML='<span class="bait-equipped" aria-hidden="true" hidden>✓</span><span class="bait-count"></span><span class="bait-figure"><img src="/fishing-art/bait-'+id+'-v2.png" alt="" draggable="false"></span><span class="bait-name"></span><span class="bait-price"></span>';
    const menu=event=>{event.preventDefault();if(!snapshot)return;card.focus({preventScroll:true});bridge.send({type:'context-menu',baitId:id});};
    card.addEventListener('contextmenu',menu);card.addEventListener('click',menu);
    card.addEventListener('keydown',event=>{
      if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey)menu(event);
      if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();cards.get(ids[(ids.indexOf(id)+(event.key==='ArrowRight'?1:4))%5]).focus();}
    });
    card.addEventListener('pointerenter',()=>{hovered=id;message();});card.addEventListener('pointerleave',()=>{hovered='';message();});
    card.addEventListener('focus',()=>{hovered=id;message();});card.addEventListener('blur',()=>{hovered='';message();});
    cards.set(id,card);slots.appendChild(card);
  }
  function fit(){
    root.style.zoom=String(Math.min(window.innerWidth/320,window.innerHeight/208));
    const key=JSON.stringify([snapshot?.nativeSessionId,window.innerWidth,window.innerHeight]);
    if(snapshot&&key!==regionsKey){
      regionsKey=key;const region=root.getBoundingClientRect(),x=(region.left+7*region.width/320)/window.innerWidth,y=(region.top+3*region.height/208)/window.innerHeight;
      bridge.send({type:'input-regions',value:[{x,y,width:308*region.width/320/window.innerWidth,height:200*region.height/208/window.innerHeight}]});
    }
  }
  const off=bridge.onSnapshot(next=>{
    if(!next?.tackle)return;snapshot=next;fit();const key=JSON.stringify([next.language,next.tackle,next.error,next.notice]);if(key===renderKey)return;renderKey=key;
    if(next.notice!==noticeKey){noticeKey=next.notice;noticeUntil=Date.now()+3000;clearTimeout(noticeTimer);noticeTimer=setTimeout(message,3100);}
    const t=next.tackle,lang=next.language==='en'?1:0;
    window.TracerFishingPondSkins?.applyBox(root,t.pondSkinId);
    document.documentElement.lang=lang?'en':'zh-CN';root.setAttribute('aria-label',text('桌面饵料盒','Desktop bait box'));
    byId('box-title').textContent=text('饵料盒','Bait box');byId('box-hint').textContent=text('右键补充 / 装备','Right-click to buy / equip');
    byId('box-coins').textContent=t.coins.toLocaleString();byId('box-coins').parentElement.setAttribute('aria-label',text('金币：','Coins: ')+t.coins);
    byId('box-close').title=text('收起饵料盒','Close bait box');byId('box-close').setAttribute('aria-label',byId('box-close').title);byId('box-retry').textContent=text('重试保存','Retry save');
    for(const bait of t.baits){
      const card=cards.get(bait.id);if(!card)continue;
      const equipped=t.equippedBaitId===bait.id,name=bait.name[lang],price=text(bait.price+' 金币 / '+bait.quantity+' 份',bait.price+' coins / '+bait.quantity);
      card.dataset.equipped=String(equipped);card.dataset.empty=String(bait.count===0);card.setAttribute('aria-pressed',String(equipped));
      card.querySelector('.bait-equipped').hidden=!equipped;card.querySelector('.bait-count').textContent=bait.count?'× '+bait.count:text('用完','Empty');
      card.querySelector('.bait-name').textContent=name;card.querySelector('.bait-price').textContent=bait.price+' / '+bait.quantity+text('份','');card.querySelector('.bait-price').title=price;
      card.setAttribute('aria-label',name+text('，库存 ','; stock ')+bait.count+'; '+price+(equipped?text('，已装备','; equipped'):'')+text('，右键购买或装备','; right-click to buy or equip'));
      card.title=name+' · '+bait.role[lang];
    }
    message();fit();
  });
  byId('box-close').addEventListener('click',()=>bridge.send({type:'close'}));
  byId('box-retry').addEventListener('click',()=>bridge.send({type:'retry-save'}));
  window.addEventListener('contextmenu',event=>event.preventDefault());
  window.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();bridge.send({type:'close'});}});
  window.addEventListener('resize',fit);window.addEventListener('beforeunload',()=>{off?.();clearTimeout(noticeTimer);window.removeEventListener('resize',fit);});
  fit();bridge.send({type:'ready'});
})();
