(function(){
  'use strict';
  const T=window.Tracer,F=window.TracerFishingModel,B=window.TracerFishing,C=window.TracerFishingAquarium,A=window.TracerAccount;
  let aquariumPreview=null,aquariumPreviewPlayer=null,unsubCabin=null;
  const views=new Map();let initialized=false,busy=false,error='',notice='',cached=null,session=null,holding=false,timer=null,previous=0,lastPush=0,lastCatch=null,pendingResult=null,unsub=null,castSaving=false,recording=null;
  let catchPauseUntil=0,catchPauseTimer=null;
  let desktopPondChoice=null;
  let motorRun=null,motorChanging=false,motorReason='paused';

  const weather=window.TracerFishingWeather?.create({onChange:()=>refresh()});
  const liveExpedition=()=>F.expedition(T.store.data,weather?.snapshot()||{timeId:(new Date(Date.now()).getHours()>=6&&new Date(Date.now()).getHours()<18)?'day':'night',weatherId:'unknown'});
  const tr=(zh,en)=>TracerLocale.language()==='en'?en:zh;
  const active=()=>session&&!['caught','escaped'].includes(session.phase);
  const playable=()=>session&&['waiting','bite','reeling'].includes(session.phase);
  const recastRemaining=()=>session?.phase==='caught'?Math.max(0,Math.ceil(catchPauseUntil-performance.now())):0;
  const context=()=>({accountScope:A?.scope||'guest',accountGeneration:A?.context.generation||0,accountRestoreId:A?.context.restoreId||''});
  const sameAccount=account=>account&&Object.keys(account).every(key=>context()[key]===account[key]);
  const failure=reason=>({
    'ground-locked':tr('请先用金币解锁这个鱼塘。','Unlock this fishing ground with coins first.'),
    'previous-ground-locked':tr('请先解锁上一鱼塘。','Unlock the previous ground first.'),
    'insufficient-coins':tr('金币不够，先出售花园收获或鱼篓中的鱼。','Not enough coins. Sell garden harvests or fish from your basket.'),
    'no-bait':tr('这种鱼饵用完了，打开桌面饵料盒，右键补充或更换。','This bait is empty. Right-click bait in your desktop bait box to restock or equip another.'),
    'aquarium-full':tr('水族箱最多住三条传奇鱼，先取回一条到育养箱吧。','Your aquarium holds three legendary fish. Return one to the nursery first.'),
    'fish-in-aquarium':tr('这条鱼已在水族箱中。','This fish already lives in your aquarium.'),
    'pond-full':tr('每个鱼塘最多五条。收获成熟的鱼，或先取回一条到育养箱。','Each pond holds five fish. Harvest an adult or return a resident to the nursery.'),
    'fish-not-mature':tr('成长达到 100% 后才能收获售卖。','Fish can be harvested at 100% growth.'),
    'automatic-weather':tr('天气和时段自动跟随设备定位与当前时间。','Weather and time follow device location and the current clock.'),
    'pond-legendary':tr('传奇鱼请入住水族箱，鱼塘接收珍稀和史诗鱼苗。','Legendary fish live in the aquarium. Ponds take rare and epic fingerlings.'),
    'fish-already-placed':tr('这条鱼已经有住处，请先取回育养箱。','This fish already has a home. Return it to the nursery first.'),
    'no-hungry-fish':tr('鱼儿刚吃过，稍等一分钟再来。','The fish have just eaten. Come back in a minute.'),
    'decoration-limit':tr('每座鱼塘最多摆放 16 件装饰，先收起一件吧。','Each pond holds up to 16 decorations. Put one away first.'),
    'save-pending':tr('更改还没有保存。请重试保存，抽取结果和收获会保留，不会重复扣费。','Changes are not saved yet. Retry saving to keep the same draw or catch without paying again.'),
    'sale-changed':tr('鱼篓或账户已变化，请重新选择要出售的收获。','Your basket or account has changed. Choose the catches to sell again.'),
    'account-changed':tr('账户已变化，请回到当前账户后重试。','Your account has changed. Return to the current account and try again.'),
    'bundle-not-sellable':tr('神秘大礼包不能出售，在收获中打开它吧。','Mystery bundles cannot be sold. Open yours from the catch basket.'),
    'not-a-bundle':tr('只有神秘大礼包可以开启礼物。','Only a mystery bundle can reveal a gift.'),
    'motor-not-owned':tr('还没有获得自动钓鱼马达。','You have not obtained the automatic fishing motor.'),
    'motor-not-installed':tr('先安装自动钓鱼马达。','Install the automatic fishing motor first.'),
    'gift-not-owned':tr('这件礼物还没有解锁，或不能佩戴在这个位置。','This gift has not been unlocked or does not fit this slot.'),
    'invalid-gift-slot':tr('请选择头像框或背景板。','Choose an avatar frame or a background.'),
    'fishing-active':tr('先完成或收起这一竿，再更换装备。','Finish or cancel this cast before changing equipment.'),
    'invalid-showcase':tr('请选择有效的水族箱布置，每次最多三件装饰。','Choose a valid aquarium layout with up to three decorations.'),
    'showcase-not-legendary':tr('水族箱只陈列传奇鱼。','This aquarium displays legendary fish.'),
    'showcase-not-unlocked':tr('这件收藏还没有解锁。','This collectible is not unlocked yet.')
  })[reason]||tr('暂时未能完成，请重试。','That could not be completed. Please try again.');
  function desktopTackle(state,coins=F.economy(T.store.data).balance){
    return {coins,pondSkinId:state.pondAppearance?.skinId||null,equippedBaitId:state.equippedBaitId,
      busy:!!(busy||T.store.inflight||recording||T.store.lost||A?.locked||A?.switching),locked:!!active(),pendingSave:!!(pendingResult||error===failure('save-pending')||T.store.conflict),
      baits:F.catalog.baits.map(({id,name,role,price,quantity})=>({id,name,role,price,quantity,count:state.baits[id]||0}))};
  }
  function snapshot(){
    if(!T.store.data)return null;
    const state=F.read(T.store.data);state.equippedBaitId=F.activeBaitId(state.equippedBaitId);
    // Keep the uncommitted gift out of collection thumbnails as well as the
    // reveal dialog. The authoritative opening stays intact for a save retry.
    if(pendingResult?.type==='open-bundle'&&sameAccount(pendingResult.account)&&!pendingResult.result.alreadyOpened){
      const pending=pendingResult.result;
      if(!pending.duplicate)state.giftUnlocks=state.giftUnlocks.filter(g=>g.id!==pending.gift.id);
      state.mysteryOpenings=state.mysteryOpenings.filter(o=>o.id!==pending.opening.id);
      const bundle=state.catches.find(c=>c.id===pending.opening.catchId);if(bundle)bundle.openedAt=null;
    }
    const pond=state.ponds.find(p=>desktopPondChoice?.scope===JSON.stringify(context())&&p.id===desktopPondChoice.id)||state.ponds.find(p=>p.id===state.activePondId)||state.ponds[0];
    const expedition=liveExpedition(),groundStyle=expedition.spot.style;
    const desktopPond={pond:{...pond,skinId:state.pondAppearance?.skinId||null,style:groundStyle,styleId:groundStyle,decorations:pond.styleId===groundStyle?pond.decorations:F.defaultPondDecorations(groundStyle,0)},fish:state.fry.filter(f=>f.pondId===pond.id&&f.releasedAt===null).slice(0,5).map(f=>({...F.catalog.fish.find(x=>x.id===f.fishId),...f,speciesId:f.fishId}))};
    const autoMotor=motorSnapshot(state),progression=F.progression(T.store.data),fortune=progression.achievements.find(a=>a.id==='fortune_child');
    if(fortune){fortune.current=autoMotor.owned?1:0;fortune.complete=autoMotor.owned;}
    return {...context(),autoMotor,tackle:desktopTackle(state),expedition,weather:weather?.snapshot(),progression,spot:{...expedition.spot,pondStyle:expedition.spot.style},desktopPond,language:TracerLocale.language(),state,catalog:F.catalog,showcase:F.aquarium(T.store.data),economy:F.economy(T.store.data),rod:F.catalog.rods.find(r=>r.id===state.equippedRodId),bait:F.catalog.baits.find(b=>b.id===state.equippedBaitId),session,sessionId:session?.id||'',lastCatch,fish:session&&F.catchItem(session),busy:!!(busy||T.store.inflight),loadoutLocked:!!active(),disabled:!!(busy||T.store.inflight||recording)&&!playable(),recastRemaining:recastRemaining(),error,notice};
  }
  function publish(force=false){
    if(!cached)return;
    const remaining=recastRemaining();
    if(force){

      const ui={...cached,session,recastRemaining:remaining,loadoutLocked:!!active(),busy:!!(busy||T.store.inflight||active())};
      for(const [section,view] of views)if(T.currentSec()===section)view.update(ui);
      if(T.currentSec()==='shop')T.garden?.refresh();
      C?.update({...context(),language:cached.language,showcase:cached.showcase});
      aquariumPreviewPlayer?.update(cached.showcase,cached.language);
    }
    const blocked=!!(busy||T.store.inflight||recording)&&!playable();
    const value={...cached,autoMotor:motorSnapshot(cached.state),tackle:desktopTackle(cached.state,cached.economy.balance),session,sessionId:session?.id||'',fishing:{sessionId:session?.id||''},lastCatch,fish:session&&F.catchItem(session),busy:blocked,disabled:blocked,recastRemaining:remaining};

    const now=performance.now();if(force||now-lastPush>48){lastPush=now;if(B){
      // Project BEFORE Electron's structured clone. The desktop renders only
      // this cast; sending the collection ledger/catalog first defeats the
      // native process's otherwise bounded projection on large saves.
      const desktop={};for(const key of ['accountScope','accountGeneration','accountRestoreId','language','session','sessionId','fishing','rod','bait','spot','lastCatch','fish','disabled','recastRemaining','error','notice','busy','autoMotor','tackle','desktopPond'])desktop[key]=value[key];
      B.update(desktop);
    }}
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
    }catch(e){if(['commit-cast','record-catch'].includes(type)&&motorRun)stopMotor('save');error=failure(changed?'save-pending':e.message);return null;}
    finally{busy=false;refresh();T.garden?.refresh();}
  }
  function complete(type,result){
    if(type==='buy-box')reveal(result);
    else if(type==='buy-ten-boxes')revealBatch(result);
    else if(type==='buy-bait'||type==='buy-equip-bait')notice=tr('已补充 '+result.quantity+' 份鱼饵'+(type==='buy-equip-bait'?'并装备':'')+'，花费 '+result.spent+' 金币。','Restocked '+result.quantity+' bait'+(type==='buy-equip-bait'?' and equipped':'')+' for '+result.spent+' coins.');
    else if(type==='unlock-ground')notice=tr('新鱼塘已解锁，花费 '+result.spent+' 金币。','Fishing ground unlocked for '+result.spent+' coins.');
    else if(type==='buy-pond-skin')notice=tr('鱼塘与钓鱼箱皮肤已购入，花费 '+result.spent+' 金币，可在预览中装备。','Pond and tackle chest skin purchased for '+result.spent+' coins. Equip it from the preview.');
    else if(type==='equip-pond-skin')notice=tr(result.itemId?'鱼塘与钓鱼箱已换装。':'已恢复钓场原始外观。',result.itemId?'Pond and tackle chest equipped.':'Original ground appearance restored.');
    else if(type==='equip-bait')notice=tr('鱼饵已装备。','Bait equipped.');
    else if(type==='install-motor'){motorRun=context();motorReason='running';notice=tr('马达已安装，开始自动钓鱼。','Motor installed. Automatic fishing started.');}
    else if(type==='remove-motor'){motorRun=null;motorReason='paused';notice=tr('马达已卸下。','Motor removed.');}
    else if(type==='open-bundle'){
      window.TracerFishingRewards?.reveal(result);
      notice=result.gift.id==='auto_fishing_motor'?tr('什么！？躺着也能赚钱了！！','What!? I can earn while lying down!!'):result.duplicate?tr('重复礼物已转为 '+result.earned+' 金币。','Duplicate gift exchanged for '+result.earned+' coins.'):tr('专属礼物已保存，可以在「礼物收藏」中使用。','Your exclusive gift is saved. Use it from Gift collection.');
    }
    else if(type==='feed-pond'||type==='feed-aquarium'){
      const target=type==='feed-aquarium'?'cabin':'ponds',account=context(),feeding={at:Date.now(),fishIds:result.fishIds||result.reactions?.map(r=>r.id)||[],reactions:result.reactions||[],grownFishIds:result.grownFishIds||[],maturation:result.maturation||[]};views.get(target)?.feed(feeding);
      if(type==='feed-aquarium')aquariumPreviewPlayer?.feed?.(feeding);
      if(feeding.maturation.length){
        const labels=feeding.maturation.map(fish=>{
          const lang=TracerLocale.language()==='en'?1:0,label=value=>Array.isArray(value)?value[lang]:value||'';
          return label(fish.name)+tr('（',' (')+[label(fish.formName),fish.actionName?tr('新动作：','New move: ')+label(fish.actionName):''].filter(Boolean).join(' · ')+tr('）',')');
        });
        notice=tr('✦ '+labels.join('、')+' 成长至 100%，体型变大，成年形态已解锁，可按基础售价的 150% 收获售卖。','✦ '+labels.join(', ')+' reached 100% growth. Larger adult forms unlocked. Harvest for 150% of the base price.');
      }else notice=tr('投喂成功，看看它们的小动作。','Fed! Watch how each fish responds.');
      setTimeout(()=>{if(sameAccount(account)&&!T.store.lost&&!A?.locked&&!A?.switching)views.get(target)?.feed(feeding);},50);
    }else if(type==='record-catch'){
      lastCatch={...result.catch,catches:result.catches,count:result.count||1,instant:result.instant,hiddenSkill:result.hiddenSkill,baitReturned:result.baitReturned,fryGrowth:result.fry?.growth,fish:result.fish,fingerlingId:result.fry?.id,perfect:result.catch?.quality==='perfect'};
      const skill=window.TracerFishingArt?.hiddenSkillInfo?.(result.hiddenSkill,TracerLocale.language()==='en');
      notice=(skill?skill.name+' · '+(result.baitReturned?tr('已返还 1 份鱼饵。','One bait returned.'):skill.detail+'。'):'')+(result.catch?.blastPercent!==undefined?tr('爆能器收获 '+result.count+' 条鱼，每条售价已固定，不获得鱼苗。', 'Spike caught '+result.count+' fish. Each value is fixed; no fingerlings. '):result.instant?tr('归墟引渡触发：直接上鱼！','Eclipse passage: instant catch! '):result.count>1?tr('身外身触发：一竿 '+result.count+' 条！','Myriad selves: '+result.count+' fish in one cast! '):'')+tr('收获已保存。','Catch saved.')+(result.fry?(result.fish.rarity==='legendary'?tr(' 传奇鱼苗已放入水族箱育养箱。',' A legendary fingerling is waiting in the aquarium nursery.'):tr(' 额外获得的鱼苗已放入「我的鱼塘」待放养列表。',' Your bonus fingerling is waiting in My Ponds.')):'');
    }else if(type==='add-decoration'||type==='set-decoration'){if(result.decoration)views.get('ponds')?.selectDecoration(result.decoration.id);notice=tr('布局已保存。','Layout saved.');}
    else if(type==='place-pond-fish')notice=tr('鱼苗已入住这座鱼塘，桌面上的同一座鱼塘也会显示。','Your fingerling has moved in and will appear in this pond on the desktop.');
    else if(type==='take-pond-fish')notice=tr('已取回育养箱，成长和投喂记录保留。','Returned to the nursery, keeping growth and feeding history.');
    else if(type==='harvest-fish')notice=tr('已收获成年鱼，获得 '+result.earned+' 金币，养殖位置已空出。','Adult fish harvested for '+result.earned+' coins. Its space is now available.');
    else if(type==='release-fish')notice=tr('鱼儿回到了自然，位置已经空出来了。','The fish has returned to the wild. There is room for a new arrival.');
    else if(type==='sell-fish'||type==='sell-all-fish')notice=tr('已出售 '+result.sold+' 件收获，获得 ','Sold '+result.sold+' catches. Earned ')+result.earned+tr(' 金币。',' coins.');
    else if(type!=='commit-cast')notice=tr('已保存。','Saved.');
  }
  async function retry(){if(busy||T.store.lost||A?.locked||A?.switching)return;const account=context();if(pendingResult&&!sameAccount(pendingResult.account)){pendingResult=null;window.TracerFishingRewards?.clear();return;}busy=true;refresh();try{await flush();error='';if(pendingResult){const saved=pendingResult;pendingResult=null;if(sameAccount(account)&&sameAccount(saved.account)&&!T.store.lost&&!A?.locked&&!A?.switching)complete(saved.type,saved.result);else window.TracerFishingRewards?.clear();}}catch{error=failure('save-pending');}finally{busy=false;refresh();T.garden?.refresh();}}
  function motorSnapshot(state){
    const owned=!!state?.giftUnlocks?.some(g=>g.id==='auto_fishing_motor'),installed=owned&&!!state.motorInstallation?.installed;
    return{owned,installed,running:!!motorRun&&sameAccount(motorRun)&&installed,reason:motorReason,baitCount:F.catalog.baits.reduce((n,b)=>n+Math.max(0,state?.baits?.[b.id]||0),0),saving:!!(pendingResult||castSaving||recording)};
  }
  function stopMotor(reason='paused'){motorRun=null;motorReason=reason;}
  function startMotor(){
    if(busy||recording||pendingResult||T.store.lost||T.store.conflict||A?.locked||A?.switching||active())return;
    const state=F.read(T.store.data);if(!state.motorInstallation?.installed){error=failure('motor-not-installed');refresh();return;}
    if(!state.giftUnlocks.some(g=>g.id==='auto_fishing_motor'))return;
    motorRun=context();motorReason='running';error='';refresh();void motorPulse();
  }
  async function motorPulse(){
    if(!initialized||!motorRun||motorChanging)return;
    if(!sameAccount(motorRun)||T.store.lost||A?.locked||A?.switching){cancel();return;}
    if(active()||busy||recording||castSaving||pendingResult||T.store.dirty||T.store.inflight||T.store.conflict||recastRemaining()>0)return;
    const account=motorRun,state=F.read(T.store.data);
    if(!state.motorInstallation?.installed||!state.giftUnlocks.some(g=>g.id==='auto_fishing_motor')){stopMotor();refresh();return;}
    const bait=F.motorBait(state);
    if(!bait){stopMotor('empty');notice=tr('全部饵料已用完，自动钓鱼马达已停机。','All bait used. The automatic fishing motor has stopped.');refresh();return;}
    motorChanging=true;
    try{
      if(F.activeBaitId(state.equippedBaitId)!==bait){const result=await change('equip-bait',ws=>F.equipBait(ws,bait));if(!result)return;}
      if(motorRun===account&&sameAccount(account))input('cast-start',{},true);
    }catch{stopMotor('error');error=failure('save-pending');refresh();}
    finally{motorChanging=false;}
  }
  function stopTimer(){if(timer)clearInterval(timer);timer=null;holding=false;}
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
  function cancel(){stopMotor();if(session&&active()){F.stepSession(session,{cancel:true},0);}stopTimer();clearCatchPause();if(T.store.lost||A?.locked||A?.switching)window.TracerFishingRewards?.clear();publish(true);}
  async function finishCatch(caught){
    if(recording)return;recording=caught;const account=context();
    const valid=()=>session===caught&&!T.store.lost&&!A?.locked&&!A?.switching&&Object.keys(account).every(key=>context()[key]===account[key]);
    try{while(busy&&valid())await new Promise(resolve=>setTimeout(resolve,40));if(!valid())return;if(pendingResult){await retry();if(pendingResult||!valid())return;}await change('record-catch',ws=>F.recordCatch(ws,caught));}
    finally{if(recording===caught)recording=null;refresh();}
  }
  function tick(){
    const now=performance.now(),delta=now-previous;previous=now;
    if(!session||!active()){stopTimer();return;}
    if(T.store.lost||A?.locked||A?.switching||motorRun&&!sameAccount(motorRun)){cancel();return;}
    if(delta>10000){cancel();return;}
    // Only the initial bait receipt waits for saving. A retry or unrelated
    // workspace save must never pause a live bite/reeling deadline.
    if(castSaving)return;

    const phase=session.phase,automatic=!!(motorRun&&session.automatic);
    if(automatic&&phase==='charging'){
      F.stepSession(session,{},delta);const charge=[330,650,950][session.seed%3];
      if(session.phase==='charging'&&session.phaseTime>=charge){releaseCast(0,charge);return;}
    }else if(automatic){F.stepAutoSession(session,delta);holding=session.holding;}
    else F.stepSession(session,{holding},delta);
    if(session.phase==='caught'){stopTimer();pauseAfterCatch();publish(true);void finishCatch(session);}
    else{publish(session.phase!==phase);if(session.phase==='escaped')stopTimer();}
  }
  function releaseCast(delta,heldMs){
    F.stepSession(session,{release:true,heldMs},delta);previous=performance.now();
    if(session.phase==='cast'){castSaving=true;void change('commit-cast',ws=>F.commitCast(ws,session)).then(result=>{castSaving=false;previous=performance.now();if(!result)cancel();});}
    else if(session.phase==='escaped')stopTimer();publish(true);
  }
  function input(type,gesture={},automatic=false){
    if(type==='start-motor'||type==='pause-motor')return action(type);
    if(motorRun&&!automatic&&['cast-start','cast','hook','reel-start','hold'].includes(type))stopMotor('manual');
    if(type==='cancel'){cancel();return;}
    if(type==='reel-release'||type==='release'){holding=false;if(type==='reel-release')return;}
    if((busy&&!playable()&&!(type==='cast-release'&&session?.phase==='charging'))||T.store.lost||A?.locked||A?.switching)return;
    if(type==='cast-start'||type==='cast'){
      if(recastRemaining()>0)return;
      if(pendingResult){void retry();return;}
      if(active()||recording)return;if(T.store.dirty||T.store.inflight||T.store.conflict){error=failure('save-pending');refresh();return;}
      weather?.start();const result=F.beginCast(T.store.data,{expedition:liveExpedition().selection,autoMotor:automatic});if(!result.ok){error=failure(result.reason);refresh();return;}
      clearCatchPause();session=result.session;lastCatch=null;holding=false;error='';notice='';previous=performance.now();
      // Entrance art belongs to the preview; it never gates a physical release.
      timer=setInterval(tick,32);publish(true);return;
    }
    if(!session)return;
    if(type==='cast-release'&&session.phase==='charging'){
      const now=performance.now(),heldMs=gesture?.heldMs;
      // Use the originating gesture clock, excluding IPC and acknowledgement delay.
      if(Number.isFinite(heldMs)&&heldMs>=0&&heldMs<=8000){releaseCast(0,heldMs);}
      else releaseCast(Math.max(0,now-previous));return;
    }
    if(type==='hook'&&['waiting','bite'].includes(session.phase)){const now=performance.now();F.stepSession(session,{hook:true},Math.max(0,now-previous));previous=now;if(session.phase==='escaped')stopTimer();publish(true);return;}
    if((type==='reel-start'||type==='hold')&&session.phase==='reeling')holding=true;
  }
  function openTackle(){openShop(cached?.state.equippedBaitId);}
  function open(){
    if(!initialized)return;
    if(B){weather?.start();publish(true);B.show();}
    else{notice=tr('桌面钓鱼请在桌面客户端打开。','Open desktop fishing in the desktop app.');T.show('ponds');refresh();}
  }
  function pinAquarium(){
    if(!initialized)return;refresh();if(C){C.show();return;}
    if(aquariumPreview){aquariumPreview.focus();return;}
    const modal=document.createElement('dialog');modal.className='fishing-modal fishing-aquarium-preview';modal.setAttribute('aria-label',tr('桌面水族箱预览','Desktop legendary aquarium preview'));
    modal.innerHTML='<div class="fishing-modal-header"><strong>'+tr('桌面上的传奇水族箱','A legendary aquarium for your desk')+'</strong><button type="button" data-close>'+tr('关闭','Close')+'</button></div><div data-aquarium-preview></div><p>'+tr('在桌面客户端点击「摆到桌面」，即可独立摆放、拖动和收起。','In the desktop app, choose Place on desktop to keep, move and hide this standalone ornament.')+'</p>';
    document.body.append(modal);aquariumPreview=modal;aquariumPreviewPlayer=TracerFishingAquariumArt.create(modal.querySelector('[data-aquarium-preview]'));aquariumPreviewPlayer.update(cached.showcase,cached.language);
    modal.querySelector('[data-close]').onclick=()=>modal.close();modal.addEventListener('close',()=>{aquariumPreviewPlayer?.destroy();aquariumPreviewPlayer=null;aquariumPreview=null;modal.remove();});modal.showModal();
  }
  function openShop(baitId){T.show('shop');T.garden?.department?.('fishing',baitId);}
  function openPool(poolId){if(!F.catalog.rodPools.some(pool=>pool.id===poolId))return;T.show('shop');T.garden?.department?.('fishing',{poolId});}
  function reveal(result){
    const modal=document.createElement('dialog');modal.className='fishing-modal';modal.setAttribute('aria-label',tr('鱼竿盲盒结果','Rod box result'));
    const rod=result.rod,tier=rod.hidden?'hidden':rod.rarity,tierName=({common:tr('普通','Common'),rare:tr('稀有','Rare'),epic:tr('史诗','Epic'),legendary:tr('传说','Legendary'),hidden:tr('隐藏款','Secret')})[tier];modal.innerHTML='<div class="fishing-reveal" data-rarity="'+tier+'"><div class="fishing-reveal-flare" aria-hidden="true"></div><span class="fishing-reveal-tier">'+tierName+'</span><span class="fishing-eyebrow">'+(rod.hidden?tr('隐藏款揭晓 · 0.5%','SECRET DISCOVERED · 0.5%'):tr('获得鱼竿','ROD ACQUIRED'))+'</span><div class="fishing-reveal-art">'+TracerFishingArt.rodMarkup(rod)+'</div><h2>'+rod.name[TracerLocale.language()==='en'?1:0]+'</h2>'+(rod.hidden?'<p>'+rod.effectDescription[TracerLocale.language()==='en'?1:0]+'</p>':'')+'<p>'+(result.duplicate?tr('重复收藏，已返还 '+result.compensation+' 金币。','Already collected. '+result.compensation+' coins returned.'):rod.blastFishing?tr('爆能器已加入收藏。','The Spike has joined your collection.'):tr('新的鱼竿已加入收藏。','A new rod has joined your collection.'))+'</p><button type="button" data-equip>'+(rod.blastFishing?tr('装备爆能器','Equip Spike'):tr('装备这根鱼竿','Equip this rod'))+'</button> <button type="button" data-close>'+tr('收好','Keep it')+'</button></div>';
    document.body.append(modal);modal.querySelector('[data-close]').onclick=()=>modal.close();modal.querySelector('[data-equip]').onclick=()=>{modal.close();action('equip-rod',rod.id);};modal.addEventListener('close',()=>modal.remove());modal.showModal();
  }
  function revealBatch(result){
    const modal=document.createElement('dialog'),account=context(),lang=TracerLocale.language()==='en'?1:0,art=window.TracerFishingArt;
    const labels={common:tr('普通','Common'),rare:tr('稀有','Rare'),epic:tr('史诗','Epic'),legendary:tr('传说','Legendary'),hidden:tr('隐藏款','Secret')};
    const fresh=result.results.filter(r=>!r.duplicate).length;
    modal.className='fishing-modal fishing-batch-modal';modal.setAttribute('aria-labelledby','fishing-batch-title');
    modal.innerHTML='<header class="fishing-batch-heading"><div><h2 id="fishing-batch-title">'+tr('十连抽结果','Ten rod boxes')+'</h2><p>'+tr('花费 '+result.spent+' 金币 · 新获得 '+fresh+' 款 · 重复返还 '+result.compensation+' 金币','Spent '+result.spent+' coins · '+fresh+' new rods · '+result.compensation+' coins returned')+'</p></div><button type="button" data-close aria-label="'+tr('关闭','Close')+'">×</button></header><div class="fishing-batch-grid">'+result.results.map((r,i)=>{
      const rod=r.rod,tier=rod.hidden?'hidden':rod.rarity;
      return '<article class="fishing-batch-card" data-rarity="'+tier+'" style="--draw-index:'+i+'"><div class="fishing-batch-meta"><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+labels[tier]+'</strong></div><div class="fishing-batch-art">'+art.rodMarkup(rod)+'</div><h3>'+art.escape(rod.name[lang])+'</h3><p class="fishing-batch-status">'+(r.duplicate?tr('重复 · 返还 '+r.compensation+' 金币','Duplicate · +'+r.compensation+' coins'):tr('新获得','New'))+'</p><button type="button" data-equip-rod="'+rod.id+'">'+tr('装备','Equip')+'</button></article>';
    }).join('')+'</div><footer class="fishing-batch-footer"><p>'+tr('全部鱼竿已存入收藏','All rods saved to your collection')+'</p><button type="button" data-close autofocus>'+tr('收好','Keep all')+'</button></footer>';
    modal.addEventListener('click',event=>{
      const close=event.target.closest('[data-close]'),equip=event.target.closest('[data-equip-rod]');
      if(close)modal.close();
      if(equip){modal.close();if(sameAccount(account))void action('equip-rod',equip.dataset.equipRod);}
    });
    modal.addEventListener('close',()=>modal.remove());document.body.append(modal);modal.showModal();
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
  function harvestResident(id){
    if(busy||A?.locked||A?.switching||T.store.lost)return;
    if(pendingResult)return retry();
    const state=F.read(T.store.data),resident=state.fry.find(f=>f.id===id);
    if(!resident||resident.releasedAt!==null)return;
    if(resident.growth!==100){error=failure('fish-not-mature');refresh();return;}
    const fish=F.catalog.fish.find(f=>f.id===resident.fishId),earned=F.harvestValue(resident,state),account=context();
    let accepted=false;
    const harvest=()=>{if(accepted)return;accepted=true;return change('harvest-fish',ws=>{
      if(!sameAccount(account))return{ok:false,reason:'sale-changed'};
      const current=F.read(ws).fry.find(f=>f.id===id);
      if(!current||current.releasedAt!==null||current.fishId!==resident.fishId||current.growth!==100)return{ok:false,reason:'sale-changed'};
      return F.harvestFish(ws,id);
    });};
    if(fish.rarity!=='legendary')return harvest();
    return confirm({title:tr('收获并出售传说鱼？','Harvest this legendary fish?'),body:tr(fish.name[0]+' 已成熟，出售获得 '+earned+' 金币（基础售价 +50%）。',fish.name[1]+' is mature. Sell for '+earned+' coins (base price +50%).'),detail:tr('这条成年鱼会离开养殖位置，无法找回；图鉴记录保留。','This adult fish leaves its home permanently. Your journal record stays.'),confirmText:tr('确认收获 · '+earned+' 金币','Harvest for '+earned+' coins')},harvest);
  }
  function action(type,value,extra={}){
    if(type==='start-motor')return startMotor();
    if(type==='pause-motor'){cancel();refresh();return;}
    if(type==='remove-motor')cancel();
    if(type==='refresh-weather'){weather?.retry();return;}
    if(type==='harvest-fish')return harvestResident(value);
    if(type==='hide-aquarium'){C?.hide();return;}
    if(type==='pin-pond'){desktopPondChoice={id:extra.pondId,scope:JSON.stringify(context())};refresh();B?.show();return;}
    if(['cast-start','cast-release','hook','reel-start','reel-release','cancel'].includes(type))return input(type,extra);
    if(type==='open-aquarium')return T.show('cabin');if(type==='open-ponds')return T.show('ponds');if(type==='open-tackle')return openTackle();if(type==='open-shop')return openShop(value);if(type==='open-pool')return openPool(value);if(type==='retry-save')return retry();if(type==='pin-aquarium')return pinAquarium();
    if(type==='sell-fish'||type==='sell-all-fish')return sellCatches(type,value);
    if(type==='release-request'){
      const fry=F.read(T.store.data).fry.find(f=>f.id===value);if(!fry)return;
      const fish=F.catalog.fish.find(f=>f.id===fry.fishId);
      return confirm({title:tr('放生 '+fish.name[0]+'？','Release '+fish.name[1]+'?'),body:tr('这条鱼将永久离开鱼塘，无法找回。','This fish will permanently leave your pond and cannot be recovered.'),detail:tr('空出的位置可以添加新鱼，图鉴记录仍会保留。','You can add a new fish to the empty space. Your journal record stays.'),confirmText:tr('确认放生','Release fish'),danger:true},()=>change('release-fish',ws=>F.releaseFish(ws,value)));
    }
    const calls={
      'set-expedition':ws=>extra.patch&&Object.keys(extra.patch).length===1&&typeof extra.patch.spotId==='string'?F.setExpedition(ws,{spotId:extra.patch.spotId}):{ok:false,reason:'automatic-weather'},
      'unlock-ground':ws=>{const result=F.unlockGround(ws,value);if(result.ok)F.setExpedition(ws,{spotId:value});return result;},
      'buy-pond-skin':ws=>F.buyPondSkin(ws,value),'equip-pond-skin':ws=>F.equipPondSkin(ws,value||null),
      'buy-box':ws=>F.buyBox(ws,{poolId:value||'basic'}),'buy-ten-boxes':ws=>F.buyBoxes(ws,{poolId:value||'basic'}),'buy-bait':ws=>F.catalog.baits.some(b=>b.id===value)?F.buyBait(ws,value,1):{ok:false,reason:'unknown-bait'},'equip-rod':ws=>F.equipRod(ws,value),'equip-bait':ws=>F.equipBait(ws,F.activeBaitId(value)),
      'buy-equip-bait':ws=>{if(!F.catalog.baits.some(b=>b.id===value))return{ok:false,reason:'unknown-bait'};const bought=F.buyBait(ws,value,1);if(!bought.ok)return bought;F.equipBait(ws,value);return bought;},
      'open-bundle':ws=>F.openMysteryBundle(ws,value),
      'install-motor':ws=>F.installMotor(ws,true),'remove-motor':ws=>F.installMotor(ws,false),
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
    if(!['ponds','cabin','rods'].includes(section)||!initialized)return;weather?.start();
    if(!views.has(section))views.set(section,TracerFishingView.create(document.getElementById('fishing-'+section+'-root'),{section,onAction:action}));refresh();
  }
  T.fishing={refresh,snapshot,decorationPosition:id=>views.get('ponds')?.getDecorationPosition?.(id),open,openTackle,openShop,action,cancel,prepareAccountSwitch:async()=>{window.TracerFishingRewards?.clear();cancel();await flush();window.TracerFishingRewards?.clear();}};
  T.sections.forEach(section=>T.onShow(section,()=>show(section)));
  document.getElementById('fishing-open').addEventListener('click',open);
  window.addEventListener('tracer-workspace-saved',refresh);
  const motorClock=setInterval(()=>{void motorPulse();},100);
  const feedingClock=setInterval(()=>{if(T.currentSec()==='ponds'&&!document.hidden&&!document.tracerHidden&&!active())refresh();},2000);
  if(B)unsub=B.onAction(message=>{const c=context();if(Object.keys(c).some(k=>message[k]!==c[k])||message.sessionId!==(session?.id||''))return;if(['start-motor','pause-motor'].includes(message.type))return action(message.type);if(['buy-bait','buy-equip-bait','equip-bait','retry-save'].includes(message.type)){if(message.type!=='retry-save'&&!F.catalog.baits.some(b=>b.id===message.value))return;return action(message.type,message.value);}if(message.type==='open-home'){T.show('ponds');return;}if(message.type==='open-tackle'){openTackle();return;}input(message.type,message);});
  if(C)unsubCabin=C.onAction(message=>{const c=context();if(Object.keys(c).some(k=>message[k]!==c[k])||A?.locked||A?.switching||T.store.lost)return;if(message.type==='open-aquarium')T.show('cabin');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!B)cancel();});
  window.addEventListener('beforeunload',()=>{weather?.destroy();clearInterval(motorClock);clearInterval(feedingClock);cancel();window.TracerFishingRewards?.clear();unsub?.();unsubCabin?.();aquariumPreviewPlayer?.destroy();for(const view of views.values())view.destroy();});
  T.ready.then(async ws=>{if(!ws)return;try{const before=JSON.stringify([ws.fishing,ws.taskGarden]);F.ensure(ws);initialized=true;show(T.currentSec());refresh();if(before!==JSON.stringify([ws.fishing,ws.taskGarden]))await persist();if(F.read(ws).motorInstallation?.installed)startMotor();}catch{error=failure('save-pending');}finally{refresh();}});
})();
