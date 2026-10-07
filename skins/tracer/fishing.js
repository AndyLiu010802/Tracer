(function(){
  'use strict';
  const T=window.Tracer,F=window.TracerFishingModel,B=window.TracerFishing,C=window.TracerFishingAquarium,A=window.TracerAccount;
  let aquariumPreview=null,aquariumPreviewPlayer=null,unsubCabin=null;
  const views=new Map();let initialized=false,busy=false,error='',notice='',cached=null,session=null,holding=false,timer=null,previous=0,lastPush=0,lastCatch=null,pendingResult=null,game=null,dialog=null,unsub=null,castSaving=false,recording=null,tackle=null,rigPanel='';
  let catchPauseUntil=0,catchPauseTimer=null;
  let desktopPondChoice=null;
  let summonUntil=0,queuedCastRelease=false;
  const tr=(zh,en)=>TracerLocale.language()==='en'?en:zh;
  const active=()=>session&&!['caught','escaped'].includes(session.phase);
  const playable=()=>session&&['waiting','bite','reeling'].includes(session.phase);
  const recastRemaining=()=>session?.phase==='caught'?Math.max(0,Math.ceil(catchPauseUntil-performance.now())):0;
  const context=()=>({accountScope:A?.scope||'guest',accountGeneration:A?.context.generation||0,accountRestoreId:A?.context.restoreId||''});
  const sameAccount=account=>account&&Object.keys(account).every(key=>context()[key]===account[key]);
  const failure=reason=>({
    'insufficient-coins':tr('金币不够，先出售花园收获或鱼篓中的鱼。','Not enough coins. Sell garden harvests or fish from your basket.'),
    'no-bait':tr('这种鱼饵用完了，打开钓具盒换一种或在商店补充。','This bait is empty. Equip another bait in the tackle box or visit the shop.'),
    'aquarium-full':tr('水族箱最多住三条传奇鱼，先取回一条到育养箱吧。','Your aquarium holds three legendary fish. Return one to the nursery first.'),
    'fish-in-aquarium':tr('这条鱼已在水族箱中。','This fish already lives in your aquarium.'),
    'pond-full':tr('每个鱼塘最多五条。可以先取回一条到育养箱，或珍藏后开启下一座。','Each pond holds five fish. Return one to the nursery, or archive the pond to start another.'),
    'pond-legendary':tr('传奇鱼请入住水族箱，鱼塘接收珍稀和史诗鱼苗。','Legendary fish live in the aquarium. Ponds take rare and epic fingerlings.'),
    'fish-already-placed':tr('这条鱼已经有住处，请先取回育养箱。','This fish already has a home. Return it to the nursery first.'),
    'no-hungry-fish':tr('鱼儿刚吃过，稍等一分钟再来。','The fish have just eaten. Come back in a minute.'),
    'pond-archived':tr('这座鱼塘已经珍藏，五条鱼会一直住在这里。','This pond is a permanent collection of five fish.'),
    'pond-not-full':tr('选好五条鱼后，再确认珍藏。','Choose five fish before confirming the collection.'),
    'requires-five-fish':tr('选好五条鱼后，再确认珍藏。','Choose five fish before confirming the collection.'),
    'decoration-limit':tr('每座鱼塘最多摆放 16 件装饰，先收起一件吧。','Each pond holds up to 16 decorations. Put one away first.'),
    'save-pending':tr('更改还没有保存。请重试保存，抽取结果和收获会保留，不会重复扣费。','Changes are not saved yet. Retry saving to keep the same draw or catch without paying again.'),
    'sale-changed':tr('鱼篓或账户已变化，请重新选择要出售的收获。','Your basket or account has changed. Choose the catches to sell again.'),
    'account-changed':tr('账户已变化，请回到当前账户后重试。','Your account has changed. Return to the current account and try again.'),
    'bundle-not-sellable':tr('神秘大礼包不能出售，在收获中打开它吧。','Mystery bundles cannot be sold. Open yours from the catch basket.'),
    'not-a-bundle':tr('只有神秘大礼包可以开启礼物。','Only a mystery bundle can reveal a gift.'),
    'gift-not-owned':tr('这件礼物还没有解锁，或不能佩戴在这个位置。','This gift has not been unlocked or does not fit this slot.'),
    'invalid-gift-slot':tr('请选择头像框或背景板。','Choose an avatar frame or a background.'),
    'fishing-active':tr('先完成或收起这一竿，再更换装备。','Finish or cancel this cast before changing equipment.'),
    'invalid-showcase':tr('请选择有效的水族箱布置，每次最多三件装饰。','Choose a valid aquarium layout with up to three decorations.'),
    'showcase-not-legendary':tr('水族箱只陈列传奇鱼。','This aquarium displays legendary fish.'),
    'showcase-not-unlocked':tr('这件收藏还没有解锁。','This collectible is not unlocked yet.')
  })[reason]||tr('暂时未能完成，请重试。','That could not be completed. Please try again.');
  function snapshot(){
    if(!T.store.data)return null;
    const state=F.read(T.store.data);
    // Keep the uncommitted gift out of collection thumbnails as well as the
    // reveal dialog. The authoritative opening stays intact for a save retry.
    if(pendingResult?.type==='open-bundle'&&sameAccount(pendingResult.account)&&!pendingResult.result.alreadyOpened){
      const pending=pendingResult.result;
      if(!pending.duplicate)state.giftUnlocks=state.giftUnlocks.filter(g=>g.id!==pending.gift.id);
      state.mysteryOpenings=state.mysteryOpenings.filter(o=>o.id!==pending.opening.id);
      const bundle=state.catches.find(c=>c.id===pending.opening.catchId);if(bundle)bundle.openedAt=null;
    }
    const pond=state.ponds.find(p=>desktopPondChoice?.scope===JSON.stringify(context())&&p.id===desktopPondChoice.id)||state.ponds.find(p=>p.id===state.activePondId)||state.ponds[0];
    const desktopPond={pond:{...pond,style:pond.styleId},fish:state.fry.filter(f=>f.pondId===pond.id&&f.releasedAt===null).slice(0,5).map(f=>({...F.catalog.fish.find(x=>x.id===f.fishId),...f,speciesId:f.fishId}))};
    return {...context(),desktopPond,language:TracerLocale.language(),state,catalog:F.catalog,showcase:F.aquarium(T.store.data),economy:F.economy(T.store.data),rod:F.catalog.rods.find(r=>r.id===state.equippedRodId),bait:F.catalog.baits.find(b=>b.id===state.equippedBaitId),session,sessionId:session?.id||'',lastCatch,fish:session&&F.catchItem(session),busy:!!(busy||T.store.inflight),loadoutLocked:!!active(),disabled:!!(busy||T.store.inflight||recording)&&!playable(),recastRemaining:recastRemaining(),error,notice};
  }
  function publish(force=false){
    if(!cached)return;
    const remaining=recastRemaining();
    if(force){
      updateSelectors();
      const ui={...cached,session,recastRemaining:remaining,loadoutLocked:!!active(),busy:!!(busy||T.store.inflight||active())};
      for(const [section,view] of views)if(T.currentSec()===section)view.update(ui);
      if(T.currentSec()==='shop')T.garden?.refresh();
      C?.update({...context(),language:cached.language,showcase:cached.showcase});
      aquariumPreviewPlayer?.update(cached.showcase,cached.language);
    }
    const blocked=!!(busy||T.store.inflight||recording)&&!playable();
    const value={...cached,session,sessionId:session?.id||'',fishing:{sessionId:session?.id||''},lastCatch,fish:session&&F.catchItem(session),busy:blocked,disabled:blocked,recastRemaining:remaining};
    game?.update(value);
    const now=performance.now();if(force||now-lastPush>48){lastPush=now;B?.update(value);}
  }
  function refresh(){
    if(T.store.lost||A?.locked||A?.switching){window.TracerFishingRewards?.clear();return;}
    if(!initialized||!T.store.data)return;
    cached=snapshot();
    window.TracerFishingRewards?.apply(cached.state);
    document.getElementById('fishing-open').textContent=tr('⌁ 桌面钓鱼','⌁ Desktop fishing');
    publish(true);
  }
  async function flush(){
    await T.ready;if(T.store.lost||T.store.conflict||A?.locked||A?.switching)throw new Error('save-pending');
    if(T.store.dirty){clearTimeout(T.store.timer);T.saveNow();}
    const deadline=Date.now()+20000;while(T.store.inflight&&Date.now()<deadline)await new Promise(r=>setTimeout(r,40));
    if(T.store.dirty||T.store.inflight||T.store.conflict||T.store.lost)throw new Error('save-pending');
  }
  async function persist(){T.touch();clearTimeout(T.store.timer);T.saveNow();await flush();}
  async function change(type,callback){
    if(busy||A?.locked||A?.switching||T.store.lost)return null;
    if(pendingResult){await retry();return null;}
    if(active()&&!['commit-cast','record-catch'].includes(type)){error=failure('fishing-active');refresh();return null;}
    const account=context(),valid=()=>sameAccount(account)&&!T.store.lost&&!A?.locked&&!A?.switching;
    busy=true;error='';notice='';refresh();let result=null,changed=false;
    try{
      await flush();if(!valid())throw new Error('account-changed');result=callback(T.store.data);if(!result?.ok)throw new Error(result?.reason||'failed');
      changed=true;pendingResult={type,result,account};await persist();pendingResult=null;if(!valid()){window.TracerFishingRewards?.clear();return null;}complete(type,result);return result;
    }catch(e){error=failure(changed?'save-pending':e.message);return null;}
    finally{busy=false;refresh();T.garden?.refresh();}
  }
  function complete(type,result){
    if(type==='buy-box')reveal(result);
    else if(type==='open-bundle'){
      window.TracerFishingRewards?.reveal(result);
      notice=result.duplicate?tr('重复礼物已转为 '+result.earned+' 金币。','Duplicate gift exchanged for '+result.earned+' coins.'):tr('专属礼物已保存，可以在「我的水下珍礼」中使用。','Your exclusive gift is saved. Use it from Gifts from the deep.');
    }
    else if(type==='feed-pond'||type==='feed-aquarium'){
      const target=type==='feed-aquarium'?'cabin':'ponds',feeding={at:Date.now(),fishIds:result.fishIds||result.reactions?.map(r=>r.id)||[],reactions:result.reactions||[]};views.get(target)?.feed(feeding);
      notice=tr('投喂成功，看看它们的小动作。','Fed! Watch how each fish responds.');
      setTimeout(()=>views.get(target)?.feed(feeding),50);
    }else if(type==='record-catch'){
      lastCatch={...result.catch,fish:result.fish,fingerlingId:result.fry?.id,perfect:result.catch?.quality==='perfect'};
      notice=tr('收获已保存。','Catch saved.')+(result.fry?(result.fish.rarity==='legendary'?tr(' 传奇鱼苗已放入水族箱育养箱。',' A legendary fingerling is waiting in the aquarium nursery.'):tr(' 额外获得的鱼苗已放入「我的鱼塘」待放养列表。',' Your bonus fingerling is waiting in My Ponds.')):'');
    }else if(type==='add-decoration'||type==='set-decoration'){if(result.decoration)views.get('ponds')?.selectDecoration(result.decoration.id);notice=tr('布局已保存。','Layout saved.');}
    else if(type==='place-pond-fish')notice=tr('鱼苗已入住这座鱼塘，桌面上的同一座鱼塘也会显示。','Your fingerling has moved in and will appear in this pond on the desktop.');
    else if(type==='take-pond-fish')notice=tr('已取回育养箱，成长和投喂记录保留。','Returned to the nursery, keeping growth and feeding history.');
    else if(type==='archive-pond')notice=tr('鱼塘已珍藏，新的免费鱼塘已经准备好了。','Pond collected. Your next free pond is ready.');
    else if(type==='release-fish')notice=tr('鱼儿回到了自然，位置已经空出来了。','The fish has returned to the wild. There is room for a new arrival.');
    else if(type==='sell-fish'||type==='sell-all-fish')notice=tr('已出售 '+result.sold+' 件收获，获得 ','Sold '+result.sold+' catches. Earned ')+result.earned+tr(' 金币。',' coins.');
    else if(type!=='commit-cast')notice=tr('已保存。','Saved.');
  }
  async function retry(){if(busy||T.store.lost||A?.locked||A?.switching)return;const account=context();if(pendingResult&&!sameAccount(pendingResult.account)){pendingResult=null;window.TracerFishingRewards?.clear();return;}busy=true;refresh();try{await flush();error='';if(pendingResult){const saved=pendingResult;pendingResult=null;if(sameAccount(account)&&sameAccount(saved.account)&&!T.store.lost&&!A?.locked&&!A?.switching)complete(saved.type,saved.result);else window.TracerFishingRewards?.clear();}}catch{error=failure('save-pending');}finally{busy=false;refresh();T.garden?.refresh();}}
  function stopTimer(){if(timer)clearInterval(timer);timer=null;holding=false;queuedCastRelease=false;summonUntil=0;}
  function clearCatchPause(){if(catchPauseTimer)clearInterval(catchPauseTimer);catchPauseTimer=null;catchPauseUntil=0;}
  function pauseAfterCatch(){
    clearCatchPause();catchPauseUntil=performance.now()+2000;const caught=session;
    // Keep the result visible without advancing the finished simulation or
    // delaying its save. Inputs during this pause are discarded, never queued.
    catchPauseTimer=setInterval(()=>{
      if(session!==caught||recastRemaining()===0||T.store.lost||A?.locked||A?.switching){clearCatchPause();publish(true);}
      else publish();
    },100);
  }
  function cancel(){if(session&&active()){F.stepSession(session,{cancel:true},0);}stopTimer();clearCatchPause();if(T.store.lost||A?.locked||A?.switching)window.TracerFishingRewards?.clear();publish(true);}
  async function finishCatch(caught){
    if(recording)return;recording=caught;const account=context();
    const valid=()=>session===caught&&!T.store.lost&&!A?.locked&&!A?.switching&&Object.keys(account).every(key=>context()[key]===account[key]);
    try{while(busy&&valid())await new Promise(resolve=>setTimeout(resolve,40));if(!valid())return;if(pendingResult){await retry();if(pendingResult||!valid())return;}await change('record-catch',ws=>F.recordCatch(ws,caught));}
    finally{if(recording===caught)recording=null;refresh();}
  }
  function tick(){
    const now=performance.now(),delta=now-previous;previous=now;
    if(!session||!active()){stopTimer();return;}
    if(A?.locked||A?.switching){cancel();return;}
    if(delta>10000){cancel();return;}
    // Only the initial bait receipt waits for saving. A retry or unrelated
    // workspace save must never pause a live bite/reeling deadline.
    if(castSaving)return;
    if(queuedCastRelease){if(now>=summonUntil){queuedCastRelease=false;releaseCast(0);}else publish();return;}
    const phase=session.phase;F.stepSession(session,{holding},delta);
    if(session.phase==='caught'){stopTimer();pauseAfterCatch();publish(true);void finishCatch(session);}
    else{publish(session.phase!==phase);if(session.phase==='escaped')stopTimer();}
  }
  function releaseCast(delta){
    F.stepSession(session,{release:true},delta);previous=performance.now();
    if(session.phase==='cast'){castSaving=true;void change('commit-cast',ws=>F.commitCast(ws,session)).then(result=>{castSaving=false;previous=performance.now();if(!result)cancel();});}
    else if(session.phase==='escaped')stopTimer();publish(true);
  }
  function input(type,desktop=false,entranceReady=false){
    if(type==='cancel'){cancel();return;}
    if(type==='reel-release'||type==='release'){holding=false;if(type==='reel-release')return;}
    if((busy&&!playable())||T.store.lost||A?.locked||A?.switching)return;
    if(type==='cast-start'||type==='cast'){
      if(recastRemaining()>0)return;
      if(pendingResult){void retry();return;}
      if(active()||recording)return;if(T.store.dirty||T.store.inflight||T.store.conflict){error=failure('save-pending');refresh();return;}
      const result=F.beginCast(T.store.data);if(!result.ok){error=failure(result.reason);refresh();return;}
      clearCatchPause();session=result.session;lastCatch=null;holding=false;error='';notice='';previous=performance.now();
      const rod=F.catalog.rods.find(r=>r.id===F.read(T.store.data).equippedRodId),entrance=desktop&&!entranceReady&&window.TracerFishingRodEffects?.summonScene(rod?.id);
      summonUntil=entrance?previous+(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?260:entrance.duration):0;queuedCastRelease=false;
      timer=setInterval(tick,32);publish(true);return;
    }
    if(!session)return;
    if(type==='cast-release'&&session.phase==='charging'){
      if(queuedCastRelease)return;
      const now=performance.now(),delta=Math.max(0,now-previous);
      if(now<summonUntil){F.stepSession(session,{},delta);previous=now;queuedCastRelease=true;publish(true);return;}
      releaseCast(delta);return;
    }
    if(type==='hook'&&['waiting','bite'].includes(session.phase)){const now=performance.now();F.stepSession(session,{hook:true},Math.max(0,now-previous));previous=now;if(session.phase==='escaped')stopTimer();publish(true);return;}
    if((type==='reel-start'||type==='hold')&&session.phase==='reeling')holding=true;
  }
  function updateSelectors(){
    if(!dialog||!cached)return;
    const state=cached.state,esc=TracerFishingArt.escape,label=item=>item.name[cached.language==='en'?1:0],blocked=!!(busy||active()),rod=F.catalog.rods.find(r=>r.id===state.equippedRodId),bait=F.catalog.baits.find(b=>b.id===state.equippedBaitId),strip=dialog.querySelector('[data-rig-strip]');
    const sig=JSON.stringify([cached.language,state.equippedRodId,state.equippedBaitId,state.rods,state.baits,blocked]);
    if(strip.dataset.signature!==sig){
      strip.dataset.signature=sig;
      strip.innerHTML='<button type="button" class="fishing-rig-choice" data-rig="rod" aria-expanded="'+(rigPanel==='rod')+'"><span class="fishing-rig-art">'+TracerFishingArt.rodMarkup(rod)+'</span><span><small>'+tr('手中的鱼竿','YOUR ROD')+'</small><strong>'+esc(label(rod))+'</strong><em>'+tr('查看竿架','Open rod rack')+' ›</em></span></button><i class="fishing-rig-knot" aria-hidden="true">⌁</i><button type="button" class="fishing-rig-choice" data-rig="bait" aria-expanded="'+(rigPanel==='bait')+'"><span class="fishing-rig-art">'+TracerFishingArt.baitMarkup(bait)+'</span><span><small>'+tr('钩上的鱼饵','ON THE HOOK')+'</small><strong>'+esc(label(bait))+' <b>×'+state.baits[bait.id]+'</b></strong><em>'+tr('打开钓具盒','Open tackle box')+' ›</em></span></button>';
      dialog.querySelector('[data-rod-rack]').innerHTML=F.catalog.rods.filter(r=>state.rods.includes(r.id)).map(r=>'<button type="button" data-rig-rod="'+r.id+'" aria-pressed="'+(r.id===rod.id)+'" '+(blocked||r.id===rod.id?'disabled':'')+'>'+TracerFishingArt.rodMarkup(r)+'<span>'+esc(label(r))+'</span><small>'+tr('控竿区间 ','Control zone ')+Math.round(r.barSize*100)+'%</small></button>').join('');
    }
    dialog.querySelector('[data-rig-status]').textContent=active()?tr('这一竿结束后，就能重新装饵。','Finish this cast before changing your rig.'):tr('选好鱼饵，再等一次真正的咬钩。','Choose your bait. Wait for a committed bite.');
    tackle?.update({...cached,busy:blocked,disabled:blocked});
  }
  function setRigPanel(kind){
    if(!dialog)return;rigPanel=kind;
    dialog.querySelector('[data-rig-drawer]').hidden=!kind;
    dialog.querySelector('[data-bait-tackle]').hidden=kind!=='bait';dialog.querySelector('[data-rod-rack]').hidden=kind!=='rod';
    dialog.querySelector('[data-rig-title]').textContent=kind==='rod'?tr('岸边竿架','The rod rack'):tr('打开钓具盒','Your tackle box');
    for(const node of dialog.querySelectorAll('[data-rig]'))node.setAttribute('aria-expanded',String(node.dataset.rig===kind));
    updateSelectors();
    if(kind){dialog.querySelector('[data-rig-drawer]').scrollIntoView({block:'nearest'});dialog.querySelector(kind==='rod'?'[data-rod-rack] button:not(:disabled)':'[data-bait-tackle] button')?.focus({preventScroll:true});}
  }
  function openTackle(){
    openGame();if(B)dialog.dataset.handoff='true';setRigPanel('bait');
  }
  function openGame(){
    if(dialog?.open){game?.focus();return;}
    dialog=document.createElement('dialog');dialog.className='fishing-modal';dialog.setAttribute('aria-label',tr('水边垂钓','Waterside fishing'));
    dialog.innerHTML='<div class="fishing-modal-header"><strong>'+tr('留一刻，在水边。','A moment by the water.')+'</strong><div>'+(B?'<button type="button" data-desktop>'+tr('放到桌面 ↗','Move to desktop ↗')+'</button> ':'')+'<button type="button" data-close aria-label="'+tr('关闭','Close')+'">×</button></div></div><div class="fishing-rig-strip" data-rig-strip></div><section class="fishing-rig-drawer" data-rig-drawer hidden><header><div><strong data-rig-title></strong><p data-rig-status></p></div><button type="button" data-close-rig>'+tr('合上','Close')+' ×</button></header><div data-bait-tackle></div><div class="fishing-rod-rack" data-rod-rack hidden></div></section><div data-game-host></div><div class="fishing-modal-header"><small>'+tr('每次成功抛竿消耗 1 份鱼饵。轻啄先等，咬钩再提竿。','One bait per cast. Wait through nibbles; hook on a bite.')+'</small><button type="button" data-cancel>'+tr('收竿','Cancel cast')+'</button></div>';
    document.body.append(dialog);game=TracerFishingGame.create(dialog.querySelector('[data-game-host]'),{onAction:input,keyboardScope:dialog});
    rigPanel='';tackle=TracerFishingTackle.create(dialog.querySelector('[data-bait-tackle]'),{mode:'equip',compact:true,onAction:(type,id)=>{if(type==='open-shop'){dialog.dataset.handoff='true';dialog.close();return openShop(id);}return action(type,id);}});
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-cancel]').onclick=cancel;
    dialog.querySelector('[data-desktop]')?.addEventListener('click',()=>{dialog.dataset.handoff='true';dialog.close();open();});
    dialog.addEventListener('click',event=>{const choice=event.target.closest('[data-rig]'),rod=event.target.closest('[data-rig-rod]');if(choice)setRigPanel(rigPanel===choice.dataset.rig?'':choice.dataset.rig);if(rod&&!rod.disabled)void action('equip-rod',rod.dataset.rigRod);});
    dialog.querySelector('[data-close-rig]').onclick=()=>{const kind=rigPanel;setRigPanel('');dialog.querySelector('[data-rig="'+kind+'"]')?.focus();};
    dialog.addEventListener('close',()=>{const old=dialog,handoff=old.dataset.handoff==='true';if(!handoff)cancel();tackle?.destroy();tackle=null;rigPanel='';game?.destroy();game=null;dialog=null;old.remove();});
    dialog.showModal();refresh();game.focus();
  }
  function open(){if(!initialized)return;if(B){publish(true);B.show();}else openGame();}
  function pinAquarium(){
    if(!initialized)return;refresh();if(C){C.show();return;}
    if(aquariumPreview){aquariumPreview.focus();return;}
    const modal=document.createElement('dialog');modal.className='fishing-modal fishing-aquarium-preview';modal.setAttribute('aria-label',tr('桌面水族箱预览','Desktop legendary aquarium preview'));
    modal.innerHTML='<div class="fishing-modal-header"><strong>'+tr('桌面上的传奇水族箱','A legendary aquarium for your desk')+'</strong><button type="button" data-close>'+tr('关闭','Close')+'</button></div><div data-aquarium-preview></div><p>'+tr('在桌面客户端点击「摆到桌面」，即可独立摆放、拖动和收起。','In the desktop app, choose Place on desktop to keep, move and hide this standalone ornament.')+'</p>';
    document.body.append(modal);aquariumPreview=modal;aquariumPreviewPlayer=TracerFishingAquariumArt.create(modal.querySelector('[data-aquarium-preview]'));aquariumPreviewPlayer.update(cached.showcase,cached.language);
    modal.querySelector('[data-close]').onclick=()=>modal.close();modal.addEventListener('close',()=>{aquariumPreviewPlayer?.destroy();aquariumPreviewPlayer=null;aquariumPreview=null;modal.remove();});modal.showModal();
  }
  function openShop(baitId){T.show('shop');T.garden?.department?.('fishing',baitId);}
  function reveal(result){
    const modal=document.createElement('dialog');modal.className='fishing-modal';modal.setAttribute('aria-label',tr('鱼竿盲盒结果','Rod box result'));
    const rod=result.rod;modal.innerHTML='<div class="fishing-reveal" data-rarity="'+rod.rarity+'"><span class="fishing-eyebrow">'+(rod.hidden?tr('隐藏款揭晓 · 0.5%','SECRET DISCOVERED · 0.5%'):tr('水边来信 / YOUR NEW DISCOVERY','A WATERSIDE DISCOVERY'))+'</span><div class="fishing-reveal-art">'+TracerFishingArt.rodMarkup(rod)+'</div><h2>'+rod.name[TracerLocale.language()==='en'?1:0]+'</h2>'+(rod.hidden?'<p>'+rod.effectDescription[TracerLocale.language()==='en'?1:0]+'</p>':'')+'<p>'+(result.duplicate?tr('重复收藏，已返还 '+result.compensation+' 金币。','Already collected. '+result.compensation+' coins returned.'):tr('新的鱼竿已加入收藏。','A new rod has joined your collection.'))+'</p><button type="button" data-equip>'+tr('装备这根鱼竿','Equip this rod')+'</button> <button type="button" data-close>'+tr('收好','Keep it')+'</button></div>';
    document.body.append(modal);modal.querySelector('[data-close]').onclick=()=>modal.close();modal.querySelector('[data-equip]').onclick=()=>{modal.close();action('equip-rod',rod.id);};modal.addEventListener('close',()=>modal.remove());modal.showModal();
  }
  function confirm(options,callback){T.confirmTaskAction(options,callback);}
  function sellCatches(type,catchId){
    if(busy||A?.locked||A?.switching||T.store.lost)return null;
    if(pendingResult)return retry();
    if(active()){error=failure('fishing-active');refresh();return null;}
    const saleState=F.read(T.store.data),selected=saleState.catches.filter(c=>c.soldAt===null&&!F.catchItem(c)?.openable&&(type==='sell-all-fish'||c.id===catchId));
    if(!selected.length)return null;
    const account=context(),ids=selected.map(c=>c.id),species=new Map(F.catalog.fish.map(f=>[f.id,f])),legends=selected.filter(c=>species.get(c.fishId)?.rarity==='legendary'),earned=selected.reduce((sum,c)=>sum+F.catchValue(saleState,c),0);
    let accepted=false;
    const sell=()=>{if(accepted)return null;accepted=true;return change(type,ws=>{
      if(Object.keys(account).some(key=>context()[key]!==account[key]))return{ok:false,reason:'sale-changed'};
      const current=new Map(F.read(ws).catches.map(c=>[c.id,c]));
      if(selected.some(c=>!current.has(c.id)||current.get(c.id).soldAt!==null||current.get(c.id).fishId!==c.fishId))return{ok:false,reason:'sale-changed'};
      return F.sellFishBatch(ws,ids);
    });};
    if(!legends.length)return sell();
    const counts=new Map();for(const c of legends)counts.set(c.fishId,(counts.get(c.fishId)||0)+1);
    const names=[...counts].map(([id,count])=>species.get(id).name[TracerLocale.language()==='en'?1:0]+' × '+count).join('、');
    return confirm({title:tr('这份收获中有传奇鱼','This sale includes legendary fish'),body:tr('出售 '+selected.length+' 件收获，其中传奇鱼 '+legends.length+' 条，共获得 '+earned+' 金币。','Sell '+selected.length+' catches, including '+legends.length+' legendary, for '+earned+' coins.'),detail:tr('传奇鱼：','Legendary fish: ')+names+tr('。只出售鱼篓中的收获，育养箱、水族箱住客和图鉴记录都会保留。','. Only catches in your basket are sold. Nursery fish, aquarium residents and journal records stay.'),confirmText:tr('确认出售 · '+earned+' 金币','Sell for '+earned+' coins')},sell);
  }
  function action(type,value,extra={}){
    if(type==='hide-aquarium'){C?.hide();return;}
    if(type==='pin-pond'){desktopPondChoice={id:extra.pondId,scope:JSON.stringify(context())};refresh();B?.show();return;}
    if(['cast-start','cast-release','hook','reel-start','reel-release','cancel'].includes(type))return input(type);
    if(type==='open-aquarium')return T.show('cabin');if(type==='open-ponds')return T.show('ponds');if(type==='open-game')return openGame();if(type==='open-tackle')return openTackle();if(type==='open-shop')return openShop(value);if(type==='retry-save')return retry();if(type==='pin-aquarium')return pinAquarium();
    if(type==='sell-fish'||type==='sell-all-fish')return sellCatches(type,value);
    if(type==='release-request'){
      const fry=F.read(T.store.data).fry.find(f=>f.id===value);if(!fry)return;
      const fish=F.catalog.fish.find(f=>f.id===fry.fishId);
      return confirm({title:tr('放生 '+fish.name[0]+'？','Release '+fish.name[1]+'?'),body:tr('这条鱼将永久离开鱼塘，无法找回。','This fish will permanently leave your pond and cannot be recovered.'),detail:tr('空出的位置可以添加新鱼，图鉴记录仍会保留。','You can add a new fish to the empty space. Your journal record stays.'),confirmText:tr('确认放生','Release fish'),danger:true},()=>change('release-fish',ws=>F.releaseFish(ws,value)));
    }
    if(type==='archive-request')return confirm({title:tr('珍藏这五条鱼？','Keep this collection of five?'),body:tr('确认后，这座鱼塘的五条鱼会固定保存。你可以随时回来查看、旋转欣赏和投喂。','These five fish will become a permanent pond collection. Visit, rotate the view and feed them whenever you like.'),detail:tr('系统会免费开启下一座鱼塘。','Your next pond opens for free.'),confirmText:tr('珍藏鱼塘','Keep this pond')},()=>change('archive-pond',ws=>F.archivePond(ws,value)));
    const calls={
      'buy-box':ws=>F.buyBox(ws,{poolId:value||'basic'}),'buy-bait':ws=>F.buyBait(ws,value,1),'equip-rod':ws=>F.equipRod(ws,value),'equip-bait':ws=>F.equipBait(ws,value),
      'open-bundle':ws=>F.openMysteryBundle(ws,value),
      'equip-gift':ws=>F.equipGift(ws,value,extra.slot||F.catalog.gifts.find(g=>g.id===value)?.slot),
      'remove-gift':ws=>F.equipGift(ws,null,extra.slot||value),
      'set-showcase':ws=>F.setShowcase(ws,extra.patch),
      'feed-pond':ws=>F.feedPond(ws,value),'pond-style':ws=>F.selectPondStyle(ws,extra.pondId,value),
      'add-decoration':ws=>F.setPondDecoration(ws,extra.pondId,{kind:value}),
      'set-decoration':ws=>F.setPondDecoration(ws,extra.pondId,{...extra.patch,id:value}),
      'reset-decorations':ws=>F.resetPondDecorations(ws,extra.pondId),
      'place-pond-fish':ws=>{const state=F.read(ws),fry=state.fry.find(f=>f.id===value),fish=F.catalog.fish.find(f=>f.id===fry?.fishId),pondId=extra.pondId||state.activePondId;if(!fry)return{ok:false,reason:'unknown-fry'};if(fish?.rarity==='legendary')return{ok:false,reason:'pond-legendary'};if(fry.pondId!==null&&fry.pondId!==pondId)return{ok:false,reason:'fish-already-placed'};return F.placeFry(ws,value,pondId);},
      'take-pond-fish':ws=>{const fry=F.read(ws).fry.find(f=>f.id===value);if(!fry||fry.pondId!==extra.pondId)return{ok:false,reason:'fish-already-placed'};return F.placeFry(ws,value,null);},
      'place-aquarium-fish':ws=>F.placeAquariumFish(ws,value,true),
      'take-aquarium-fish':ws=>F.placeAquariumFish(ws,value,false),
      'feed-aquarium':ws=>F.feedAquarium(ws)
    };if(calls[type])return change(type,calls[type]);
  }
  function show(section){
    for(const [key,view] of views)if(key!==section){view.destroy();views.delete(key);}
    if(!['ponds','cabin','rods'].includes(section)||!initialized)return;
    if(!views.has(section))views.set(section,TracerFishingView.create(document.getElementById('fishing-'+section+'-root'),{section,onAction:action}));refresh();
  }
  T.fishing={refresh,snapshot,decorationPosition:id=>views.get('ponds')?.getDecorationPosition?.(id),open,openGame,openTackle,openShop,action,cancel,prepareAccountSwitch:async()=>{window.TracerFishingRewards?.clear();cancel();await flush();window.TracerFishingRewards?.clear();}};
  T.sections.forEach(section=>T.onShow(section,()=>show(section)));
  document.getElementById('fishing-open').addEventListener('click',open);
  window.addEventListener('tracer-workspace-saved',refresh);
  const feedingClock=setInterval(()=>{if(T.currentSec()==='ponds'&&!document.hidden&&!document.tracerHidden&&!active())refresh();},2000);
  if(B)unsub=B.onAction(message=>{const c=context();if(Object.keys(c).some(k=>message[k]!==c[k])||message.sessionId!==(session?.id||''))return;if(message.type==='open-home'){T.show('ponds');return;}if(message.type==='open-tackle'){openTackle();return;}input(message.type,true,message.entranceReady===true);});
  if(C)unsubCabin=C.onAction(message=>{const c=context();if(Object.keys(c).some(k=>message[k]!==c[k])||A?.locked||A?.switching||T.store.lost)return;if(message.type==='open-aquarium')T.show('cabin');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!B)cancel();});
  window.addEventListener('beforeunload',()=>{clearInterval(feedingClock);cancel();window.TracerFishingRewards?.clear();unsub?.();unsubCabin?.();aquariumPreviewPlayer?.destroy();for(const view of views.values())view.destroy();tackle?.destroy();game?.destroy();});
  T.ready.then(async ws=>{if(!ws)return;try{const before=JSON.stringify([ws.fishing,ws.taskGarden]);F.ensure(ws);initialized=true;show(T.currentSec());refresh();if(before!==JSON.stringify([ws.fishing,ws.taskGarden]))await persist();}catch{error=failure('save-pending');}finally{refresh();}});
})();
