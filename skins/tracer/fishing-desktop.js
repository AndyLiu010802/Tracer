(function(){
  'use strict';
  const bridge=window.FishingDesktop,Art=window.TracerFishingArt,root=document.getElementById('desktop-fishing');
  if(!bridge||!Art)return;
  const byId=id=>document.getElementById(id),rod=byId('fishing-rod'),pondHost=byId('fishing-pond'),float=byId('fishing-float'),power=byId('fishing-power'),reel=byId('fishing-reel'),toast=byId('fishing-toast');
  // Wait for the selected fishing ground. Building meadow first allocated and
  // uploaded an entire unused scene before the account's first snapshot.
  let pondRenderer=null;
  const pond={update(value){if(pondRenderer)pondRenderer.update(value);else pondRenderer=Art.createPond(pondHost,{...value,interactive:false,zoom:1.12});},getWaterPosition(point){return pondRenderer?.getWaterPosition?.(point);},waterEvent(event){pondRenderer?.waterEvent?.(event);},destroy(){pondRenderer?.destroy();pondRenderer=null;}};
  const flightFish=byId('fishing-flight-fish'),line=byId('fishing-line'),status=byId('fishing-status'),motion=window.TracerFishingMotion?.create({stage:root,summonOnReveal:true,onPreviewEnd:()=>{previewing=false;if(['idle','caught','escaped'].includes(phase)&&!recastPaused())summoned=false;root.dataset.rodVisible=String(['charging','cast','waiting','bite','reeling'].includes(phase)||recastPaused());rod.setAttribute('aria-hidden',String(root.dataset.rodVisible!=='true'));rod.tabIndex=root.dataset.rodVisible==='true'?0:-1;publishRegions();},rod,createRodFlex:host=>window.TracerFishingRodRenderer?.create(host)||Art.createRodFlex?.(host),bobber:float,line,path:line.querySelector('path'),bite:byId('fishing-bite'),flightFish,catchShadow:byId('fishing-catch-shadow'),pond,castTarget:byId('fishing-cast-target'),nibbleCue:byId('fishing-nibble'),stamina:status.querySelector('b'),power:power.querySelector('i'),target:reel.querySelector('.desktop-reel-target'),fish:reel.querySelector('.desktop-reel-fish'),progress:reel.querySelector('.desktop-reel-progress i'),waterPoint:{x:269/380,y:155/260},onFrame:frame=>{power.hidden=frame.phase!=='charging';float.hidden=snapshot?.rod?.id==='valorant_spike'||!['cast','waiting','bite','reeling'].includes(frame.phase);if(frame.phase==='charging'){power.setAttribute('aria-valuenow',Math.round(frame.values.castPower*100));root.style.setProperty('--cast-power',String(frame.values.castPower));}if(flightKind==='product'){flightFigure?.setVisible?.(frame.pose.fishAlpha>=.005);flightFigure?.setPose?.({phase:frame.phase,age:frame.age,angle:frame.pose.fishAngle,scale:frame.pose.fishScale,opacity:frame.pose.fishAlpha});}}});
  let snapshot=null,phase='idle',pressed=null,dragging=false,rodKey='',fishKey='',warmFishKey='',lastPhase='',lastCatch='',toastTimer=null,passThrough=false,lastPointer=null,flightFigure=null,flightKind='';const keysDown=new Set();
  let awaitingCast=null,castInputAt=null;
  const inputNow=()=>window.performance?.now?.()??Date.now();
  const accountKey=value=>JSON.stringify([value?.accountScope||'guest',value?.accountGeneration||0,value?.accountRestoreId||'']);
  const send=type=>{let extra={};if(type==='cast-start'){castInputAt=inputNow();awaitingCast={account:accountKey(snapshot),native:snapshot?.nativeSessionId,session:snapshot?.session?.id||''};motion?.startCastInput?.();extra={entranceReady:true};}else if(type==='cast-release'&&castInputAt!==null){extra={heldMs:Math.max(0,inputNow()-castInputAt)};castInputAt=null;motion?.releaseCastInput?.(extra.heldMs);}else if(type==='cancel'){castInputAt=null;motion?.cancelCastInput?.();}bridge.send({type,...extra});},point=event=>({screenX:event.screenX,screenY:event.screenY}),clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
  let pondKey='',previewing=false,moveMode=false,summoned=false,pondAccount='',pondResidents=new Map(),pondFeedReceipts=new Map();
  function recentPondFeeding(fish){
    // Keep receipt history separate from the displayed snapshot: a late update
      // must still render, but must not replay a feeding or maturity effect.
      const now=Date.now(),recent=[],grown=[],next=new Map();
    for(const f of fish){
      const fedAt=Number(f.fedAt)||0,updatedAt=Number(f.updatedAt)||0,growth=Math.max(0,Math.min(100,Number(f.growth==null?100:f.growth)||0)),previous=pondResidents.get(f.id),seen=pondFeedReceipts.get(f.id)||0,stale=previous&&(fedAt<previous.fedAt||updatedAt<previous.updatedAt);
      if(!stale&&fedAt>seen&&now-fedAt>=-1000&&now-fedAt<5000){recent.push(f);if(previous&&previous.growth<100&&growth>=100)grown.push(f.id);}
      pondFeedReceipts.set(f.id,Math.max(seen,fedAt));next.set(f.id,stale?previous:{growth,fedAt,updatedAt});
    }
    pondResidents=next;return recent.length?{at:Math.max(...recent.map(f=>f.fedAt)),fishIds:recent.map(f=>f.id),grownFishIds:grown}:undefined;
  }
  let lastRegionsKey = null;
  function publishRegions() {
    if (!snapshot) return;
    const nodes = [pondHost, byId('fishing-tools'), ...(!byId('fishing-motor').hidden?[byId('fishing-motor')]:[]), ...(root.dataset.rodVisible === 'true' ? [rod] : [])];
    const regions = nodes.map(node => {
      const b = node.getBoundingClientRect(), x = Math.max(0, b.left / window.innerWidth), y = Math.max(0, b.top / window.innerHeight);
      return { x, y, width: Math.max(0, Math.min(1, b.right / window.innerWidth) - x), height: Math.max(0, Math.min(1, b.bottom / window.innerHeight) - y) };
    }).filter(r => r.width > 0 && r.height > 0);
    const key = JSON.stringify([snapshot.nativeSessionId, regions]);
    if (regions.length && key !== lastRegionsKey) { lastRegionsKey = key; bridge.send({type:'input-regions', value:regions}); }
  }
  function fitFrame(){root.style.zoom=String(Math.min(window.innerWidth/380,window.innerHeight/260));publishRegions();}
  fitFrame();window.addEventListener('resize',fitFrame);
  const copy=(zh,en)=>snapshot?.language==='en'?en:zh;
  const recastPaused=()=>phase==='caught'&&snapshot?.recastRemaining>0;
  function pointerMode(ignore){ignore=ignore&&!pressed&&!dragging&&phase!=='bite';if(ignore===passThrough)return;passThrough=ignore;bridge.send({type:'pointer-pass-through',value:ignore});}
  function updatePointerHit(point){
    if(!point){pointerMode(true);return;}
    const hit=document.elementFromPoint(point.x,point.y),inside=hit?.closest('#fishing-rod,#fishing-float,#fishing-tools,#fishing-motor'),rect=pondHost.getBoundingClientRect(),px=(point.x-rect.left)/rect.width,py=(point.y-rect.top)/rect.height;
    const overPond=px>=0&&px<=1&&py>=0&&py<=1;
    root.classList.toggle('is-near',!!inside||overPond||pressed||dragging);pointerMode(!inside&&!overPond);
  }
  function prepareCast(){if(!summoned||awaitingCast)return false;if(previewing){if(!motion?.engagePreview())return false;previewing=false;}return true;}
  function start(event){
    if(event.button!==0||!snapshot||snapshot.disabled||snapshot.autoMotor?.running||recastPaused()||pressed||dragging)return;
    if(moveMode){beginDrag(event);return;}
    if(!['idle','caught','escaped','waiting','bite','reeling'].includes(phase))return;
    (root.dataset.rodVisible==='true'?rod:pondHost).focus({preventScroll:true});
    if(['idle','caught','escaped'].includes(phase)){if(!prepareCast())return;pressed={source:'pointer',id:event.pointerId,kind:'cast',host:event.currentTarget};send('cast-start');}
    else if(['waiting','bite'].includes(phase)){send('hook');event.preventDefault();return;}
    else if(phase==='reeling'){pressed={source:'pointer',id:event.pointerId,kind:'reel',host:event.currentTarget};send('reel-start');}
    else return;
    pointerMode(false);event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
  }
  function release(event,cancel=false,source){
    if(!pressed||source&&pressed.source!==source||event?.pointerId!==undefined&&(pressed.source!=='pointer'||pressed.id!==event.pointerId))return;const hold=pressed;pressed=null;
    if(hold.kind!=='hook')send(hold.kind==='cast'?(cancel?'cancel':'cast-release'):'reel-release');
    if(hold.id!==undefined&&hold.host.hasPointerCapture?.(hold.id))hold.host.releasePointerCapture(hold.id);
    event?.preventDefault();
  }
  function beginDrag(event){
    if(event.button!==0||!snapshot||pressed)return;
    motion?.touchPreview();dragging=true;pointerMode(false);event.currentTarget.setPointerCapture(event.pointerId);bridge.send({type:'drag-start',value:point(event)});event.preventDefault();
  }
  function moveDrag(event){if(dragging){motion?.touchPreview();bridge.send({type:'drag-move',value:point(event)});}}
  function endDrag(event){if(!dragging)return;dragging=false;moveMode=false;root.dataset.moving='false';bridge.send({type:'drag-end',value:point(event)});if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
  byId('fishing-motor').addEventListener('click',()=>send(snapshot?.autoMotor?.running?'pause-motor':'start-motor'));
  byId('fishing-tools').addEventListener('click',()=>{pointerMode(false);bridge.send({type:'open-bait-box'});});
  rod.addEventListener('pointerdown',start);rod.addEventListener('pointerup',event=>dragging?endDrag(event):release(event));rod.addEventListener('pointermove',moveDrag);rod.addEventListener('pointercancel',event=>release(event,true));rod.addEventListener('lostpointercapture',event=>release(event,true));
  float.addEventListener('pointerdown',event=>{if(event.button===0&&!snapshot?.disabled&&!snapshot?.autoMotor?.running&&['waiting','bite'].includes(phase)){rod.focus({preventScroll:true});send('hook');event.preventDefault();}});
  pondHost.addEventListener('pointerdown',beginDrag);
  pondHost.addEventListener('pointerup',event=>{if(dragging)endDrag(event);else release(event);});pondHost.addEventListener('pointermove',moveDrag);pondHost.addEventListener('pointercancel',event=>{if(dragging)endDrag(event);else release(event,true);});pondHost.addEventListener('lostpointercapture',event=>release(event,true));
  const offMenu=bridge.onMenuAction?.(value=>{
    if(value.type==='move'){moveMode=true;root.dataset.moving='true';pointerMode(false);}
    if(value.type==='summon-rod'&&!pressed&&!dragging&&!recastPaused()&&['idle','caught','escaped'].includes(phase)){
      previewing=motion?.preview()===true;summoned=previewing;if(previewing){root.dataset.rodVisible='true';rod.tabIndex=0;rod.setAttribute('aria-hidden','false');publishRegions();}
    }
    if(value.type==='dismiss-rod'){summoned=false;motion?.dismissPreview();}
  });
  window.addEventListener('mousemove',event=>{lastPointer={x:event.clientX,y:event.clientY};updatePointerHit(lastPointer);});
  window.addEventListener('pointermove',event=>{lastPointer={x:event.clientX,y:event.clientY};updatePointerHit(lastPointer);if(previewing&&event.target.closest?.('#fishing-rod'))motion?.touchPreview();});
  // A bite may move under a stationary cursor while the transparent window is
  // passing input through. Keep the brief hook window clickable, including !.
  window.addEventListener('pointerdown',event=>{if(event.button===0&&phase==='bite'&&!snapshot?.autoMotor?.running&&!dragging&&!event.defaultPrevented&&!event.target.closest?.('#fishing-tools')){rod.focus({preventScroll:true});send('hook');event.preventDefault();}});
  window.addEventListener('contextmenu',event=>{event.preventDefault();if(dragging)return;motion?.touchPreview();pointerMode(false);bridge.send({type:event.target.closest?.('#fishing-tools')?'open-bait-box':'context-menu'});});
  function keyCode(event){return event.code==='KeyF'||event.code==='Space'?event.code:!event.code&&String(event.key).toLowerCase()==='f'?'KeyF':'';}
  function editing(target){return !!(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));}
  function resetInput(){keysDown.clear();release(null,true);}
  function keyDown(event){
    if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||editing(event.target))return;
    if(event.code==='Escape'&&previewing){event.preventDefault();summoned=false;motion?.dismissPreview();return;}
    if(event.code==='Escape'){event.preventDefault();if(event.repeat)return;const cancellingCast=pressed?.kind==='cast';resetInput();if(!cancellingCast)send('cancel');return;}
    const code=keyCode(event);if(!code||!snapshot||snapshot.autoMotor?.running||snapshot.disabled&&!recastPaused()||code==='Space'&&(event.target.closest?.('#fishing-tools')||event.target.closest?.('#fishing-motor')))return;event.preventDefault();
    if(event.repeat||keysDown.has(code))return;keysDown.add(code);if(recastPaused()||pressed||dragging)return;
    if(['waiting','bite'].includes(phase)){pressed={source:'keyboard:'+code,kind:'hook',host:rod};send('hook');}
    else if(phase==='reeling'){pressed={source:'keyboard:'+code,kind:'reel',host:rod};send('reel-start');}
    else if(['idle','caught','escaped'].includes(phase)){if(!prepareCast())return;pressed={source:'keyboard:'+code,kind:'cast',host:rod};send('cast-start');}
  }
  function keyUp(event){const code=keyCode(event);if(!code||!keysDown.delete(code))return;release(event,false,'keyboard:'+code);event.preventDefault();}
  function focusOut(event){if(!root.contains(event.relatedTarget)||editing(event.relatedTarget)||event.relatedTarget?.closest?.('#fishing-tools'))resetInput();}
  function visibility(){if(document.hidden)resetInput();}
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',resetInput);root.addEventListener('focusout',focusOut);document.addEventListener('visibilitychange',visibility);
  const off=bridge.onSnapshot(value=>{
    const account=accountKey(value);if(account!==pondAccount){pondAccount=account;pondResidents.clear();pondFeedReceipts.clear();}
    if(value.desktopPond){const key=JSON.stringify([account,value.desktopPond,value.language]);if(key!==pondKey){const feeding=recentPondFeeding(value.desktopPond.fish||[]);pond.update({...value.desktopPond,language:value.language,feeding});pondKey=key;}}
    const previousPhase=phase;snapshot=value;phase=value.session?.phase||'idle';root.dataset.phase=phase;const english=value.language==='en';
    const motor=value.autoMotor,control=byId('fishing-motor');control.hidden=!motor?.installed;control.dataset.running=String(!!motor?.running);control.disabled=!motor?.running&&(!!value.busy||!motor?.baitCount);control.querySelector('span').textContent=motor?.running?copy('自动钓鱼 · 暂停','Auto fishing · Pause'):copy('马达 · 继续','Motor · Resume');control.querySelector('small').textContent=motor?.baitCount?copy('剩余 '+motor.baitCount+' 份饵料',motor.baitCount+' bait left'):copy('饵料已用完','Bait exhausted');control.setAttribute('aria-label',control.textContent);document.documentElement.lang=english?'en':'zh-CN';
    if(awaitingCast){
      const changedAccount=accountKey(value)!==awaitingCast.account,newSession=(value.session?.id||'')!==awaitingCast.session;
      if(changedAccount||!newSession&&value.nativeSessionId!==awaitingCast.native){awaitingCast=null;pressed=null;keysDown.clear();}
      // Charging acknowledges the held gesture even when a background save
      // temporarily disables new input; its physical key-up must still release.
      else if(newSession||phase==='charging')awaitingCast=null;
      else if(value.error||value.disabled){awaitingCast=null;pressed=null;keysDown.clear();}
    }
    // Keep the catch animation visible, then put away the complete rod and glow.
    if(['charging','cast','waiting','detonating','bite','reeling'].includes(phase))summoned=true;
    const rodVisible=summoned||previewing||['charging','cast','waiting','bite','reeling'].includes(phase)||recastPaused();
    if(!rodVisible&&document.activeElement===rod)pondHost.focus({preventScroll:true});
    root.dataset.rodVisible=String(rodVisible);
    rod.tabIndex=rodVisible?0:-1;rod.setAttribute('aria-hidden',String(!rodVisible));
    if(phase==='bite')pointerMode(false);
    else if(previousPhase==='bite')requestAnimationFrame(()=>updatePointerHit(lastPointer));
    const item=value.rod||{id:'bamboo'},key=JSON.stringify([item.id,item.art,item.style]);if(key!==rodKey){rod.innerHTML=window.TracerFishingRodRenderer?.liveMarkup?.(item)||Art.rodMarkup(item);rodKey=key;}
    const spike=value.rod?.id==='valorant_spike',controlHint=spike?copy(phase==='waiting'?'爆能器正在升起 · 等待自动引爆':phase==='detonating'?'冲击波释放中':phase==='cast'?'爆能器投掷中':'按住 F / 空格调整距离，松开投掷',phase==='waiting'?'Spike deploying · automatic detonation':phase==='detonating'?'Shockwave releasing':phase==='cast'?'Throwing the Spike':'Hold F / Space to aim; release to throw'):copy(phase==='reeling'?'F 按住上提 · 松开下落 · 点按微调':phase==='bite'?'按 F 或点击提竿':phase==='waiting'?'F 提竿 · 等咬钩再按':phase==='cast'?'等浮漂落水，再留意咬钩':phase==='charging'?'松开 F 或鼠标抛竿':'F / 空格：按住蓄力，松开抛竿',phase==='reeling'?'Hold F ↑ · Release ↓ · Tap to adjust':phase==='bite'?'Press F or click to hook':phase==='waiting'?'F to hook · Wait for a bite':phase==='cast'?'Let the float settle; watch for a bite':phase==='charging'?'Release F or the mouse to cast':'F / Space: hold, release to cast');
    const hint=recastPaused()?copy('收获展示 · '+Math.ceil(value.recastRemaining/1000)+' 秒后重新按下抛竿','Catch display · Press again in '+Math.ceil(value.recastRemaining/1000)+'s'):controlHint;
    rod.setAttribute('aria-label',hint);pondHost.setAttribute('aria-label',hint);
    window.TracerFishingPondSkins?.applyBox(byId('fishing-tools'),value.tackle?.pondSkinId);
    byId('fishing-tools').title=copy('饵料盒 · 右键购买或装备','Bait box · right-click to buy or equip');byId('fishing-tools').setAttribute('aria-label',copy('打开饵料盒','Open bait box'));byId('fishing-tools').querySelector('.desktop-bait-label').textContent=copy('饵料','Bait');

    const session=value.session||{},castPower=clamp(session.castPower);root.style.setProperty('--cast-power',String(castPower));power.hidden=phase!=='charging';power.setAttribute('aria-valuenow',Math.round(castPower*100));
    const floating=!spike&&['cast','waiting','bite','reeling'].includes(phase);float.hidden=!floating;byId('fishing-bite').hidden=phase!=='bite';
    reel.hidden=phase!=='reeling';reel.setAttribute('aria-valuenow',Math.round(clamp(session.progress)*100));
    const behavior=['cruise','surge','rest'].includes(session.fishBehavior)?session.fishBehavior:'cruise';status.hidden=phase!=='reeling';status.querySelector('span').textContent=clamp(session.tension)>.8?copy('松线卸力','Ease the line'):copy(({cruise:'游弋',surge:'冲刺',rest:'回气'})[behavior],({cruise:'Cruising',surge:'Surging',rest:'Resting'})[behavior]);status.title=copy('鱼的体力','Fish stamina')+' '+Math.round(clamp(session.stamina===undefined?1:session.stamina)*100)+'%';
    if(phase==='reeling'&&session.specialEffectAt!==undefined&&session.phaseTime-session.specialEffectAt<950)status.querySelector('span').textContent=session.specialEffect==='clone-rescue'?copy('分身接力','Clone support'):copy('橡胶回弹','Elastic rescue');
    const skill=Art.hiddenSkillInfo?.(session.hiddenSkill??(value.lastCatch?.sessionId===session.id?value.lastCatch?.hiddenSkill:''),english),skillBadge=byId('fishing-skill');skillBadge.hidden=!skill||!['waiting','bite','reeling'].includes(phase)||(session.phaseTime||0)>1600;if(skill){skillBadge.textContent=skill.name;skillBadge.title=skill.detail;skillBadge.setAttribute('aria-label',skill.name+' · '+skill.detail);}
    byId('fishing-nibble').textContent=copy('试探，先等一等','A nibble. Wait.');
    const resolved=window.TracerFishingModel?.catchItem?.(session.fishId?session:value.lastCatch?.catch||value.lastCatch),currentFish=resolved?.kind?resolved:value.fish||value.lastCatch?.fish||resolved,product=currentFish?.kind==='junk'||currentFish?.kind==='mystery',flightHaul=product?[currentFish]:Art.catchFlightFish?.(value,currentFish)||[currentFish],figureKey=JSON.stringify([currentFish?.id||'',currentFish?.kind||'',currentFish?.variant||'',flightHaul.map(f=>f?.id)]),rewards=window.TracerFishingRewards;
    if(warmFishKey!==figureKey){warmFishKey=figureKey;Art.preloadFishPortraits?.(flightHaul,document);}
    // The catch-only flight uses the same painted species atlas as the collection.
    // A second fish WebGL context can block input or the whole catch reveal.
    if(phase==='caught'&&figureKey!==fishKey){
      const nextKind=product?'product':'fish';if(nextKind!==flightKind){flightFigure?.destroy();flightFigure=null;flightFish.replaceChildren();flightKind=nextKind;}
      if(product){if(!flightFigure&&rewards?.createFigure)flightFigure=rewards.createFigure(flightFish,{fish:currentFish});else if(flightFigure)flightFigure.setFish?.(currentFish);else flightFish.innerHTML=rewards?.markup?.(currentFish)||'';}
      else{flightFigure?.destroy();flightFigure=null;flightFish.innerHTML=Art.catchFlightMarkup?Art.catchFlightMarkup(flightHaul):currentFish?Art.fishMarkup(currentFish):'';}
      flightFish.dataset.haul=String(product?1:flightHaul.length);flightFish.dataset.catchKind=currentFish?.kind||'fish';flightFish.dataset.catchVariant=currentFish?.variant||'';fishKey=figureKey;
    }
    motion?.update(currentFish?{...value,fish:currentFish}:value);
    if(summoned&&!previewing&&['idle','caught','escaped'].includes(phase)&&!recastPaused())previewing=motion?.preview(true)===true;
    publishRegions();
    if(phase!==lastPhase){lastPhase=phase;byId('fishing-live').textContent=copy(({idle:'按住鱼塘抛竿',charging:spike?'松开投掷爆能器':'松开抛竿',detonating:'爆能器引爆，正在收取鱼获',waiting:spike?'爆能器正在展开，等待自动引爆':'等待咬钩',bite:'咬钩了，点击浮漂提竿',reeling:'按住收线，让鱼留在绿色区域',caught:'鱼儿已收获',escaped:'鱼儿游走了'})[phase]||'',({idle:'Hold the pond to cast',charging:spike?'Release to throw the Spike':'Release to cast',detonating:'Spike detonating, collecting the catch',waiting:spike?'Spike deploying; automatic detonation':'Waiting for a bite',bite:'A bite! Click the float to hook',reeling:'Hold to reel. Keep the fish in green',caught:'Catch saved',escaped:'The fish escaped'})[phase]||'');}
    const result=value.lastCatch,catchKey=result?JSON.stringify([result.id,result.fishId,result.variant,result.fingerlingId]):'';
    if(phase==='caught'&&result&&catchKey!==lastCatch){
      lastCatch=catchKey;const fish=currentFish||result.fish||value.fish,junkNames={boots:['旧靴子','Old boots'],broken_watch:['破手表','Broken watch'],trash_bag:['垃圾袋','Trash bag']},isJunk=fish?.kind==='junk',isBundle=fish?.kind==='mystery',name=isJunk?junkNames[fish.variant]?.[english?1:0]:fish?.name?.[english?1:0],caption=spike?copy('爆能器 · 收获 '+result.count+' 条鱼','SPIKE · '+result.count+' FISH'):result.instant?(value.rod?.id==='anime_nika'?copy('解放之鼓 · 直接上鱼','DRUMS OF LIBERATION · INSTANT CATCH'):copy('归墟引渡 · 直接上鱼','ECLIPSE · INSTANT CATCH')):result.count>1?copy('身外身 · 一竿 '+result.count+' 条','MYRIAD SELVES · '+result.count+' FISH'):isJunk?copy('水中杂物 · 1 金币','SALVAGE · 1 COIN'):isBundle?copy('钓到神秘大礼包','A MYSTERIOUS FIND'):copy('已收入鱼篓','IN YOUR BASKET'),detail=spike?copy('每条售价 50%–150% · 不获得鱼苗','Value 50–150% each · no fingerlings'):isBundle?copy('前往水族馆打开礼物','Open your gift in the aquarium'):!isJunk&&result.fingerlingId?copy('获得鱼苗','Fingerling earned'):'';
      const shownDetail=skill?(result.baitReturned?copy('已返还 1 份鱼饵','One bait returned'):skill.detail):!isJunk&&!isBundle&&result.fingerlingId?(fish?.rarity==='legendary'?copy('鱼苗 · 水族箱育养箱','Fingerling · Aquarium nursery'):copy('鱼苗 · 我的鱼塘待放养','Fingerling · My Ponds nursery')):detail;
      toast.innerHTML='<span><small>'+Art.escape(skill?.name||caption)+'</small>'+Art.escape(name||fish?.id||copy('收获已保存','Catch saved'))+(shownDetail?'<small>'+Art.escape(shownDetail)+'</small>':'')+'</span>';toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,3500);
      if(isJunk||isBundle)byId('fishing-live').textContent=caption+'，'+(name||'')+(detail?'。'+detail:'');
    }
    if(value.error){toast.textContent=value.error;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,3500);}
    // Keep a held hook key responsive once the main window confirms reeling.
    // Change ownership before sending because a bridge can publish synchronously.
    if(phase==='reeling'&&pressed?.kind==='hook'){pressed.kind='reel';send('reel-start');}
    // A late idle snapshot can arrive after the physical press but before the
    // controller acknowledges it. It must not turn that valid gesture into cancel.
    if(!floating&&phase!=='charging'&&pressed&&!awaitingCast)release(null,true);
  });
  window.addEventListener('beforeunload',()=>{resetInput();off();offMenu?.();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',resetInput);root.removeEventListener('focusout',focusOut);document.removeEventListener('visibilitychange',visibility);clearTimeout(toastTimer);motion?.destroy();flightFigure?.destroy();pond.destroy();});bridge.send({type:'ready'});
})();
