(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingAnime=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ValorantVFX=typeof module==='object'&&module.exports?require('./fishing-valorant-vfx'):globalThis.TracerFishingValorantVFX;
  const OnePieceVFX=typeof module==='object'&&module.exports?require('./fishing-onepiece-vfx'):globalThis.TracerFishingOnePieceVFX;
  const NarutoVFX=typeof module==='object'&&module.exports?require('./fishing-naruto-vfx'):globalThis.TracerFishingNarutoVFX;
  const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,Number(x)||0)),mix=(a,b,t)=>a+(b-a)*t,smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
  // BEGIN ANIME EFFECT CATALOG
  const entries={"anime_iruka":{"action":"kunai","color":"#536c60","accent":"#bac3c1","rarity":"common","collection":"naruto"},"anime_tenten":{"action":"scroll","color":"#a04a45","accent":"#e7cfaa","rarity":"common","collection":"naruto"},"anime_shikamaru":{"action":"shadow","color":"#454b53","accent":"#aab7a2","rarity":"common","collection":"naruto"},"anime_kiba":{"action":"fang","color":"#786b60","accent":"#e6d7be","rarity":"common","collection":"naruto"},"anime_shino":{"action":"swarm","color":"#54606b","accent":"#b3ac83","rarity":"common","collection":"naruto"},"anime_asuma":{"action":"chakrablade","color":"#667653","accent":"#c0de9c","rarity":"common","collection":"naruto"},"anime_sai":{"action":"inkbird","color":"#3e4850","accent":"#d7d3c7","rarity":"common","collection":"naruto"},"anime_ino":{"action":"mindthread","color":"#aa7ab0","accent":"#eed8ec","rarity":"common","collection":"naruto"},"anime_sakura":{"action":"impact","color":"#bf718b","accent":"#f4cad3","rarity":"rare","collection":"naruto"},"anime_hinata":{"action":"lion","color":"#8a86b4","accent":"#d7e9f3","rarity":"rare","collection":"naruto"},"anime_neji":{"action":"rotation","color":"#c7c1b5","accent":"#b5e5e6","rarity":"rare","collection":"naruto"},"anime_lee":{"action":"lotuskick","color":"#437557","accent":"#e4b172","rarity":"rare","collection":"naruto"},"anime_temari":{"action":"fan","color":"#ddd2b7","accent":"#a678af","rarity":"rare","collection":"naruto"},"anime_kankuro":{"action":"puppet","color":"#694c62","accent":"#c4a277","rarity":"rare","collection":"naruto"},"anime_choji":{"action":"giantpalm","color":"#b76755","accent":"#f0c9a6","rarity":"rare","collection":"naruto"},"anime_yamato":{"action":"woodcage","color":"#707e55","accent":"#d9c28d","rarity":"rare","collection":"naruto"},"anime_suigetsu":{"action":"waterbody","color":"#91bcc2","accent":"#dbf1e9","rarity":"rare","collection":"naruto"},"anime_gaara":{"action":"sand","color":"#a67b49","accent":"#ead3a1","rarity":"epic","collection":"naruto"},"anime_kakashi":{"action":"lightning","color":"#5b7386","accent":"#cfedf3","rarity":"epic","collection":"naruto"},"anime_itachi":{"action":"raven","color":"#522f39","accent":"#df7168","rarity":"epic","collection":"naruto"},"anime_jiraiya":{"action":"toad","color":"#944c45","accent":"#e9ce9b","rarity":"epic","collection":"naruto"},"anime_minato":{"action":"teleport","color":"#c4a149","accent":"#fbebb1","rarity":"epic","collection":"naruto"},"anime_deidara":{"action":"claybird","color":"#c9bd9e","accent":"#fff0c3","rarity":"epic","collection":"naruto"},"anime_konan":{"action":"paper","color":"#8289ad","accent":"#e5e6f1","rarity":"epic","collection":"naruto"},"anime_obito":{"action":"kamui","color":"#b47349","accent":"#edd0a3","rarity":"epic","collection":"naruto"},"anime_naruto":{"action":"rasengan","color":"#e9953f","accent":"#91ddeb","rarity":"legendary","collection":"naruto"},"anime_sasuke":{"action":"susanoo","color":"#625080","accent":"#c3a1ed","rarity":"legendary","collection":"naruto"},"anime_hashirama":{"action":"wooddragon","color":"#697957","accent":"#ccb989","rarity":"legendary","collection":"naruto"},"anime_madara":{"action":"meteor","color":"#7a4856","accent":"#adcde7","rarity":"legendary","collection":"naruto"},"anime_sixpaths":{"action":"sixpaths","color":"#e4b752","accent":"#fff0b8","rarity":"legendary","collection":"naruto"},"anime_usopp":{"action":"slingshot","color":"#618b38","accent":"#ffd25b","rarity":"common","collection":"onepiece"},"anime_chopper":{"action":"hoof","color":"#f366a7","accent":"#63cdf2","rarity":"common","collection":"onepiece"},"anime_brook":{"action":"soul","color":"#e9f4ff","accent":"#62d6f5","rarity":"common","collection":"onepiece"},"anime_franky":{"action":"cannon","color":"#ec4748","accent":"#6edafa","rarity":"common","collection":"onepiece"},"anime_buggy":{"action":"split","color":"#ee534f","accent":"#82d5fa","rarity":"epic","collection":"onepiece"},"anime_perona":{"action":"ghost","color":"#ed63aa","accent":"#fceaf7","rarity":"common","collection":"onepiece"},"anime_crocodile":{"action":"sandhook","color":"#d1a32c","accent":"#fff1ac","rarity":"epic","collection":"onepiece"},"anime_kuma":{"action":"paw","color":"#233655","accent":"#f6c2da","rarity":"epic","collection":"onepiece"},"anime_nami":{"action":"weather","color":"#35c4e8","accent":"#ffc850","rarity":"rare","collection":"onepiece"},"anime_sanji":{"action":"firekick","color":"#242944","accent":"#ffba46","rarity":"rare","collection":"onepiece"},"anime_robin":{"action":"bloom","color":"#8c55b8","accent":"#ffbedc","rarity":"rare","collection":"onepiece"},"anime_jinbe":{"action":"current","color":"#178fd1","accent":"#ffa24e","rarity":"epic","collection":"onepiece"},"anime_smoker":{"action":"smoke","color":"#dcefe8","accent":"#569c9f","rarity":"rare","collection":"onepiece"},"anime_vivi":{"action":"peacock","color":"#48d4e8","accent":"#fee765","rarity":"rare","collection":"onepiece"},"anime_aokiji":{"action":"icebird","color":"#79cdf5","accent":"#eefeff","rarity":"rare","collection":"onepiece"},"anime_kizaru":{"action":"lightbeads","color":"#ffcb3d","accent":"#fff8b4","rarity":"rare","collection":"onepiece"},"anime_doflamingo":{"action":"strings","color":"#fa6bba","accent":"#f9e4e9","rarity":"epic","collection":"onepiece"},"anime_zoro":{"action":"threesword","color":"#3d9b58","accent":"#e9e4cf","rarity":"epic","collection":"onepiece"},"anime_ace":{"action":"flame","color":"#ff682b","accent":"#ffdb55","rarity":"epic","collection":"onepiece"},"anime_sabo":{"action":"dragonclaw","color":"#265da8","accent":"#ffbe5a","rarity":"epic","collection":"onepiece"},"anime_law":{"action":"room","color":"#e8c344","accent":"#a3eff4","rarity":"epic","collection":"onepiece"},"anime_hancock":{"action":"stone","color":"#de2c69","accent":"#fff0c2","rarity":"epic","collection":"onepiece"},"anime_enel":{"action":"thunderdragon","color":"#f7c445","accent":"#a9e9ff","rarity":"epic","collection":"onepiece"},"anime_katakuri":{"action":"mochi","color":"#8d284f","accent":"#fff0df","rarity":"epic","collection":"onepiece"},"anime_marco":{"action":"phoenixbird","color":"#1ebeea","accent":"#ffe367","rarity":"epic","collection":"onepiece"},"anime_luffy":{"action":"rubber","color":"#ef3b35","accent":"#ffd45b","rarity":"legendary","collection":"onepiece"},"anime_shanks":{"action":"haki","color":"#98213e","accent":"#f6db8c","rarity":"legendary","collection":"onepiece"},"anime_whitebeard":{"action":"quake","color":"#f5eee2","accent":"#ffbf56","rarity":"legendary","collection":"onepiece"},"anime_mihawk":{"action":"blackblade","color":"#24243a","accent":"#f1cb56","rarity":"legendary","collection":"onepiece"},"anime_nika":{"action":"nika","color":"#fdf4e7","accent":"#ffca57","rarity":"legendary","collection":"onepiece"},"anime_alvida":{"action":"ironmace","color":"#a64065","accent":"#f2c990","rarity":"common","collection":"onepiece"},"anime_kuro":{"action":"catclaw","color":"#303d46","accent":"#c6e4e5","rarity":"common","collection":"onepiece"},"anime_jango":{"action":"hypnotic","color":"#4b967b","accent":"#ebc978","rarity":"common","collection":"onepiece"},"anime_wapol":{"action":"munch","color":"#71658d","accent":"#d7d7bd","rarity":"common","collection":"onepiece"},"anime_koby":{"action":"shave","color":"#df97ac","accent":"#e5f3ef","rarity":"rare","collection":"onepiece"},"anime_tashigi":{"action":"shigure","color":"#396898","accent":"#d2edf1","rarity":"rare","collection":"onepiece"},"anime_bartolomeo":{"action":"barrier","color":"#52b99b","accent":"#bdf2b3","rarity":"rare","collection":"onepiece"},"anime_bellamy":{"action":"spring","color":"#a46c4d","accent":"#e6d295","rarity":"rare","collection":"onepiece"},"anime_moria":{"action":"shadowcut","color":"#544666","accent":"#d09dc5","rarity":"epic","collection":"onepiece"},"anime_weevil":{"action":"heavyglaive","color":"#657793","accent":"#efdfa0","rarity":"epic","collection":"onepiece"},"anime_yamatooni":{"action":"iceclub","color":"#53959a","accent":"#d5f7ee","rarity":"epic","collection":"onepiece"},"anime_bonney":{"action":"futurepunch","color":"#d878a6","accent":"#f9d2a3","rarity":"epic","collection":"onepiece"},"anime_blackbeard":{"action":"darkquake","color":"#3d304e","accent":"#c8a0d4","rarity":"legendary","collection":"onepiece"},"anime_kaido":{"action":"thunderbagua","color":"#44415d","accent":"#d695d2","rarity":"legendary","collection":"onepiece"},"anime_bigmom":{"action":"emperorsword","color":"#b64069","accent":"#ffd18e","rarity":"legendary","collection":"onepiece"},"anime_konohamaru":{"action":"smallrasengan","color":"#426998","accent":"#aed8ed","rarity":"common","collection":"naruto"},"anime_ebisu":{"action":"trainingkunai","color":"#384c66","accent":"#d5ddd4","rarity":"common","collection":"naruto"},"anime_genma":{"action":"senbon","color":"#66764d","accent":"#e1e3cc","rarity":"common","collection":"naruto"},"anime_izumo":{"action":"syrup","color":"#506d6b","accent":"#b5dcd0","rarity":"common","collection":"naruto"},"anime_kurenai":{"action":"illusiontree","color":"#953b4a","accent":"#e3cfba","rarity":"rare","collection":"naruto"},"anime_anko":{"action":"snakes","color":"#6b5882","accent":"#d8c9ac","rarity":"rare","collection":"naruto"},"anime_haku":{"action":"icemirrors","color":"#6dabb0","accent":"#e4f6ee","rarity":"rare","collection":"naruto"},"anime_zabuza":{"action":"executioner","color":"#74868b","accent":"#d6e0dc","rarity":"rare","collection":"naruto"},"anime_kisame":{"action":"shark","color":"#425c83","accent":"#adc8dc","rarity":"epic","collection":"naruto"},"anime_hidan":{"action":"triplescythe","color":"#a72d39","accent":"#e1c7ba","rarity":"epic","collection":"naruto"},"anime_sasori":{"action":"hundredpuppets","color":"#8d4a3b","accent":"#e0bc88","rarity":"epic","collection":"naruto"},"anime_tsunade":{"action":"heavenkick","color":"#42785b","accent":"#e9cc91","rarity":"epic","collection":"naruto"},"anime_pain":{"action":"almightypush","color":"#46384f","accent":"#c6a9df","rarity":"legendary","collection":"naruto"},"anime_tobirama":{"action":"waterdragon","color":"#416c9d","accent":"#d6edf4","rarity":"legendary","collection":"naruto"},"anime_orochimaru":{"action":"kusanagi","color":"#76638a","accent":"#e5dbc4","rarity":"legendary","collection":"naruto"},"valorant_astra":{"action":"valorant_astra","color":"#5f3d92","accent":"#ebbc6c","rarity":"legendary","collection":"valorant"},"valorant_breach":{"action":"valorant_breach","color":"#815530","accent":"#efb964","rarity":"legendary","collection":"valorant"},"valorant_brimstone":{"action":"valorant_brimstone","color":"#5c6470","accent":"#ea873b","rarity":"legendary","collection":"valorant"},"valorant_chamber":{"action":"valorant_chamber","color":"#26334b","accent":"#d7b163","rarity":"legendary","collection":"valorant"},"valorant_clove":{"action":"valorant_clove","color":"#806398","accent":"#ed9ac3","rarity":"legendary","collection":"valorant"},"valorant_cypher":{"action":"valorant_cypher","color":"#b9b4a2","accent":"#78cee7","rarity":"legendary","collection":"valorant"},"valorant_deadlock":{"action":"valorant_deadlock","color":"#6b7787","accent":"#acdce6","rarity":"legendary","collection":"valorant"},"valorant_fade":{"action":"valorant_fade","color":"#343a49","accent":"#90b5c5","rarity":"legendary","collection":"valorant"},"valorant_gekko":{"action":"valorant_gekko","color":"#93833e","accent":"#afdf75","rarity":"legendary","collection":"valorant"},"valorant_harbor":{"action":"valorant_harbor","color":"#3c766f","accent":"#d5bc79","rarity":"legendary","collection":"valorant"},"valorant_iso":{"action":"valorant_iso","color":"#62628e","accent":"#b9a5f4","rarity":"legendary","collection":"valorant"},"valorant_jett":{"action":"valorant_jett","color":"#639eae","accent":"#d2edf1","rarity":"legendary","collection":"valorant"},"valorant_kayo":{"action":"valorant_kayo","color":"#49566b","accent":"#b596f3","rarity":"legendary","collection":"valorant"},"valorant_killjoy":{"action":"valorant_killjoy","color":"#c5a539","accent":"#63cbb7","rarity":"legendary","collection":"valorant"},"valorant_miks":{"action":"valorant_miks","color":"#9c713e","accent":"#a9e465","rarity":"legendary","collection":"valorant"},"valorant_neon":{"action":"valorant_neon","color":"#335dac","accent":"#ebde78","rarity":"legendary","collection":"valorant"},"valorant_omen":{"action":"valorant_omen","color":"#41375b","accent":"#70d4ed","rarity":"legendary","collection":"valorant"},"valorant_phoenix":{"action":"valorant_phoenix","color":"#bd6b3f","accent":"#ffce78","rarity":"legendary","collection":"valorant"},"valorant_raze":{"action":"valorant_raze","color":"#b36732","accent":"#e4ca68","rarity":"legendary","collection":"valorant"},"valorant_reyna":{"action":"valorant_reyna","color":"#52305e","accent":"#db86df","rarity":"legendary","collection":"valorant"},"valorant_sage":{"action":"valorant_sage","color":"#609e95","accent":"#c7f0dd","rarity":"legendary","collection":"valorant"},"valorant_skye":{"action":"valorant_skye","color":"#6c8145","accent":"#c5d593","rarity":"legendary","collection":"valorant"},"valorant_sova":{"action":"valorant_sova","color":"#597e98","accent":"#b7d9e9","rarity":"legendary","collection":"valorant"},"valorant_tejo":{"action":"valorant_tejo","color":"#8b6444","accent":"#e69d4f","rarity":"legendary","collection":"valorant"},"valorant_veto":{"action":"valorant_veto","color":"#434c4b","accent":"#b2d88e","rarity":"legendary","collection":"valorant"},"valorant_viper":{"action":"valorant_viper","color":"#315740","accent":"#9ce667","rarity":"legendary","collection":"valorant"},"valorant_vyse":{"action":"valorant_vyse","color":"#564b68","accent":"#d3b1e0","rarity":"legendary","collection":"valorant"},"valorant_waylay":{"action":"valorant_waylay","color":"#977655","accent":"#f6e69d","rarity":"legendary","collection":"valorant"},"valorant_yoru":{"action":"valorant_yoru","color":"#3d5394","accent":"#a8c9ed","rarity":"legendary","collection":"valorant"},"valorant_spike":{"action":"valorant_spike","color":"#343e48","accent":"#97e0e7","rarity":"legendary","collection":"valorant"}};
  // END ANIME EFFECT CATALOG
  const has=id=>Object.prototype.hasOwnProperty.call(entries,id);
  const designs=Object.fromEntries(Object.entries(entries).map(([id,s])=>[id,{theme:s.action,frequency:1.6,speed:.3,spread:.22,colors:[s.color,s.accent,'#fff4dc']}]));
  const scenes=Object.fromEntries(Object.entries(entries).map(([id,s])=>[id,{kind:'anime-'+s.action,duration:700}]));
  const spells=Object.fromEntries(Object.entries(entries).map(([id,s])=>[id,[s.action,s.color,s.accent,'#fff4dc']]));
  const cleanDurations={cast:620,bite:280,caught:760};
  const duration=(id,phase)=>OnePieceVFX?.has(id)?OnePieceVFX.duration(id,phase):cleanDurations[phase]||0;
  const presentation={rubber:'punch',nika:'punch',hoof:'punch',paw:'punch',mochi:'punch',split:'punch',bloom:'punch',dragonclaw:'claw',threesword:'slash',blackblade:'slash',haki:'slash',quake:'slash',peacock:'slash',soul:'slash',strings:'slash',stone:'slash',weather:'lightning',thunderdragon:'lightning',lightbeads:'beam',cannon:'beam',flame:'fire',firekick:'fire',phoenixbird:'fire',current:'wave',icebird:'ice',smoke:'mist',ghost:'mist',sandhook:'sand',room:'ring',slingshot:'shot'};
  Object.assign(presentation,{paw:'paw-pressure',split:'split-knives',strings:'five-threads',sandhook:'sand-blade',current:'water-punch',stone:'petrifying-kick',ironmace:'mace-impact',catclaw:'five-claws',hypnotic:'hypnotic-ring',munch:'jaw-impact',shave:'shave-strike',shigure:'steel-slash',barrier:'barrier-impact',spring:'spring-strike',shadowcut:'shadow-scissors',heavyglaive:'heavy-slash',iceclub:'ice-strike',futurepunch:'future-punch',darkquake:'dark-quake',thunderbagua:'thunder-strike',emperorsword:'emperor-slash'});
  function visible(phase,age,id){if(OnePieceVFX?.has(id))return OnePieceVFX.visible(phase,age,id);if(id?.startsWith('valorant_'))return ValorantVFX?.visible(phase,age,id)||false;return Number.isFinite(age)&&age>=0&&(has(id)?age<(cleanDurations[phase]||0):!id&&(phase==='cast'&&age<650||phase==='bite'&&age<560||phase==='caught'&&age<1940));}
  function timeline(phase,age,quiet=false){
    if(!visible(phase,age))return null;
    const duration=phase==='caught'?1940:phase==='bite'?560:650,p=clamp(age/duration),q=quiet?.52:p;
    return{phase,progress:q,age,alpha:smooth(p/.08)*(1-smooth((p-.81)/.19)),windup:1-smooth(q/.22),release:smooth((q-.15)/.38),contact:smooth((q-.48)/.15),settle:smooth((q-.7)/.3),stage:q<.18?'anticipation':q<.48?'release':q<.68?'contact':'follow-through'};
  }
  // This is also the actual flying fish's trajectory. The hand does not chase a
  // separate decorative fish. Catch and finger rig share one deterministic clock.
  function rubberCatch(age,g,quiet=false){
    const t=Math.max(0,age),water=g.water,end=g.ground||{x:g.width*.43,y:g.height*.88},travel=smooth((t-540)/770),settle=smooth((t-1390)/300);
    return{x:mix(water.x,end.x,travel),y:mix(water.y,end.y,travel)-Math.sin(travel*Math.PI)*g.height*(quiet?.06:.20),travel,grip:smooth((t-270)/240)*(1-smooth((t-1320)/210)),reach:smooth(t/260),release:settle,fishAlpha:smooth(t/100)*(1-smooth((t-1690)/250)),fishScale:mix(.45,.72,travel),fishAngle:mix(-8,0,travel),fishSquash:1,lineAlpha:0,floatAlpha:1-smooth(t/140),sag:0};
  }
  function catchPose(id,age,g,quiet){return ['rubber','nika'].includes(entries[id]?.action)?rubberCatch(age,g,quiet):null;}
  // Five digits, each with a palm socket and two articulated phalanges. Closure
  // rolls from little finger to thumb instead of swapping open/closed sprites.
  function handRig(close=0,spread=1){
    const fingers=[];for(let j=0;j<5;j++){
      const thumb=j===0,root={x:thumb?-.10:.20,y:thumb?.25:(j-2.5)*.19},length=thumb?.37:.58-Math.abs(j-2.5)*.06,c=clamp(close*1.16-(4-j)*.04),angle=(thumb?1.05:(j-2.5)*.22*spread)+c*(thumb?-1.4:1.85),middle={x:root.x+Math.cos(angle)*length*.58,y:root.y+Math.sin(angle)*length*.58},tip={x:middle.x+Math.cos(angle+c*1.45)*length*.42,y:middle.y+Math.sin(angle+c*1.45)*length*.42};fingers.push({root,middle,tip,thumb,length});
    }return fingers;
  }
  function drawClean(ctx,id,phase,age,values,g,tip,point,quiet=false,energy=1){
    if(!visible(phase,age,id))return null;
    const spec=entries[id],kind=presentation[spec.action],span=duration(id,phase),time=clamp(age/span),p=quiet?.52:time,alpha=smooth(time/.08)*(1-smooth((time-.65)/.35))*Math.min(1,energy),power=spec.rarity==='legendary'?1.12:spec.rarity==='epic'?1.05:spec.rarity==='rare'?1:.88,r=Math.max(12,Math.min(52,g.width*.13,g.height*.18))*power*(phase==='bite'?.62:1)*(quiet?.7:1),target=phase==='caught'?point:(g.water||point),travel=smooth((p-.06)/.49),origin={x:mix(tip.x,target.x,travel),y:mix(tip.y,target.y,travel)-Math.sin(travel*Math.PI)*r*.12},angle=Math.atan2(target.y-tip.y,target.x-tip.x),ink='#3c2934';
    const bounded=q=>({x:Math.max(r*.9,Math.min(g.width-r*.9,q.x)),y:Math.max(r*.45,Math.min(g.height-r*.4,q.y))}),hit={x:target.x,y:target.y},at=bounded(origin),accent=spec.action==='blackblade'?'#8ee9b4':spec.action==='haki'?'#e54c61':spec.action==='phoenixbird'?'#66def0':spec.accent;
    ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';
    const stroke=(points,color,width,opacity=1)=>{ctx.save();ctx.globalAlpha*=opacity;ctx.beginPath();for(let i=0;i<points.length;i++)i?ctx.lineTo(...points[i]):ctx.moveTo(...points[i]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.restore();};
    const fill=(points,color,opacity=1)=>{ctx.save();ctx.globalAlpha*=opacity;ctx.beginPath();for(let i=0;i<points.length;i++)i?ctx.lineTo(...points[i]):ctx.moveTo(...points[i]);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore();};
    const oval=(x,y,rx,ry,color,opacity=1,line=0)=>{ctx.save();ctx.globalAlpha*=opacity;ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);ctx.fillStyle=ctx.strokeStyle=color;if(line){ctx.lineWidth=line;ctx.stroke();}else ctx.fill();ctx.restore();};
    const impact=(color=accent)=>{const t=smooth((p-.38)/.40),fade=1-smooth((p-.55)/.42);if(t<=0)return;oval(hit.x,hit.y,r*(.18+t*.6),r*(.09+t*.22),color,.65*fade,1.2);for(let j=0;j<5;j++){const a=j/5*TAU+.35,near=r*(.22+t*.3),far=near+r*.24*(1-t*.4);fill([[hit.x+Math.cos(a-.06)*near,hit.y+Math.sin(a-.06)*near],[hit.x+Math.cos(a)*far,hit.y+Math.sin(a)*far],[hit.x+Math.cos(a+.06)*near,hit.y+Math.sin(a+.06)*near]],color,.8*fade);}};
    function fist(x,y,size,opacity=1){
      const white=['nika','mochi','split'].includes(spec.action),base=white?'#fff7e7':spec.action==='futurepunch'?'#f5d2d9':spec.action==='dragonclaw'?'#353343':'#f2b88c',shadow=white?'#c2b5d5':spec.action==='futurepunch'?'#cc90ac':spec.action==='dragonclaw'?'#1b2030':'#ba7257';ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size,size);ctx.globalAlpha*=opacity;
      ctx.beginPath();ctx.moveTo(-.48,-.22);ctx.lineTo(-.21,-.27);ctx.quadraticCurveTo(-.19,-.43,-.06,-.43);ctx.quadraticCurveTo(.03,-.43,.05,-.36);ctx.quadraticCurveTo(.11,-.50,.22,-.42);ctx.quadraticCurveTo(.28,-.47,.36,-.35);ctx.quadraticCurveTo(.47,-.37,.51,-.24);ctx.lineTo(.48,.06);ctx.quadraticCurveTo(.53,.26,.36,.34);ctx.lineTo(-.12,.32);ctx.lineTo(-.29,.20);ctx.lineTo(-.48,.18);ctx.closePath();ctx.fillStyle=base;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=1.2/size;ctx.stroke();
      fill([[-.46,.09],[-.18,.16],[.11,.20],[.39,.14],[.43,.28],[.31,.33],[-.12,.30],[-.29,.19],[-.47,.17]],shadow);
      stroke([[-.11,-.36],[-.10,-.14]],ink,.85/size);stroke([[.10,-.37],[.10,-.13]],ink,.85/size);stroke([[.29,-.34],[.28,-.12]],ink,.85/size);
      ctx.beginPath();ctx.moveTo(-.06,.05);ctx.quadraticCurveTo(.17,-.13,.43,-.02);ctx.quadraticCurveTo(.49,.06,.39,.13);ctx.lineTo(.08,.17);ctx.strokeStyle=shadow;ctx.lineWidth=1.4/size;ctx.stroke();stroke([[-.16,-.26],[.32,-.27]],'#fff0cf',.9/size,.7);
      if(spec.action==='paw'){oval(.04,.08,.12,.09,'#d184a4');for(let j=0;j<3;j++)oval(-.09+j*.14,-.17,.045,.05,'#d184a4');}
      ctx.restore();
    }
    function slash(index=0,count=1,color=accent){
      const lag=index*.085,progress=clamp((p-lag)/(1-lag)),swing=smooth((progress-.04)/.56),fade=1-smooth((progress-.69)/.31),turn=-1.2+swing*2.6+(index-(count-1)/2)*.38,rad=r*(spec.action==='blackblade'?1.0:.78),cx=hit.x+(index-(count-1)/2)*r*.18,cy=hit.y-r*.15;
      const ribbon=(offset,thickness)=>{const a=[],b=[];for(let j=0;j<=32;j++){const t=j/32,theta=turn-t*1.48,wide=Math.pow(Math.sin(t*Math.PI),.72)*r*thickness*(.25+.75*swing),rr=rad+offset;a.push([cx+Math.cos(theta)*(rr+wide),cy+Math.sin(theta)*(rr+wide)*.72]);b.push([cx+Math.cos(theta)*rr,cy+Math.sin(theta)*rr*.72]);}return[...a,...b.reverse()];};
      fill(ribbon(0,.18),spec.action==='haki'?'#341b2e':color,.72*fade);fill(ribbon(r*.035,.065),'#fff9e8',.95*fade);if(spec.action==='haki')stroke([[cx-r*.15,cy-r*.32],[cx+r*.12,cy-r*.46],[cx+r*.07,cy-r*.24],[cx+r*.34,cy-r*.38]],'#de5464',1.3,fade*.6);
    }
    // Short attack silhouettes: build anticipation, a single contact, then a wake.
    // Local coordinates keep every technique anchored to the actual catch.
    const path=(d,color,opacity=1,width=0)=>{ctx.save();ctx.globalAlpha*=opacity;traceShape(ctx,d);ctx.fillStyle=ctx.strokeStyle=color;ctx.lineWidth=width;if(width)ctx.stroke();else ctx.fill();ctx.restore();};
    const local=(x,y,turn,scale,fn)=>{ctx.save();ctx.translate(x,y);ctx.rotate(turn);ctx.scale(scale,scale);fn();ctx.restore();};
    const wake=(color,count=7,spread=.7)=>{const t=smooth((p-.34)/.45),fade=1-smooth((p-.55)/.42);if(!t)return;for(let j=0;j<count;j++){const a=angle+Math.PI+(j-(count-1)/2)*spread/count,near=r*(.20+t*.20),far=near+r*(.12+(j%3)*.08)*t;stroke([[hit.x+Math.cos(a)*near,hit.y+Math.sin(a)*near],[hit.x+Math.cos(a)*far,hit.y+Math.sin(a)*far]],color,j%2?1:1.8,fade*.8);}};
    if(kind==='paw-pressure'){
      const grow=.55+.45*travel;local(at.x,at.y,angle,r*grow,()=>{oval(0,0,.58,.48,'#edd9ee',.12);oval(0,0,.58,.48,'#fff5fa',.95,.024);path('M -.25 .04 C -.27 -.12 -.10 -.19 0 -.16 C .15 -.24 .31 -.09 .28 .08 C .29 .24 .13 .26 0 .20 C -.14 .29 -.29 .21 -.25 .04 Z','#eec8df',.88);for(const q of[[-.35,-.17],[-.15,-.34],[.13,-.35],[.35,-.17]])oval(q[0],q[1],.085,.115,'#fff1f8',.95);});impact('#f3ddec');wake('#f5e0f0',8,2.4);
    }else if(kind==='five-threads'){
      for(let j=0;j<5;j++){const t=smooth(clamp((p-.035*j-.05)/.44)),y=(j-2)*r*.13;ctx.save();ctx.globalAlpha*=1-smooth((p-.65)/.35);ctx.beginPath();ctx.moveTo(tip.x,tip.y+y*.35);ctx.bezierCurveTo(mix(tip.x,hit.x,.45),tip.y-r*(.3+j*.07),hit.x-r*.2,hit.y+y-r*.25,mix(tip.x,hit.x+r*.42,t),mix(tip.y,hit.y+y,t));ctx.strokeStyle='#522e50';ctx.lineWidth=2.7;ctx.stroke();ctx.strokeStyle=j%2?'#ffd4ed':'#fff8ff';ctx.lineWidth=1.15;ctx.stroke();ctx.restore();}wake('#f1a5d4',5,1.8);
    }else if(kind==='sand-blade'){
      slash(0,1,'#ceaa67');for(let j=0;j<19;j++){const t=clamp(p*1.35-j*.019),a=angle+2.2+j*.27,rr=r*(.12+t*.72),x=at.x+Math.cos(a)*rr,y=at.y+Math.sin(a)*rr*.65;fill([[x,y-1.8],[x+2.5,y],[x,y+1.4],[x-1.3,y]],j%3?'#d9ba7b':'#fff0bb',.85*(1-t));}impact('#ecd49b');
    }else if(kind==='water-punch'){
      fist(at.x,at.y,r*.62,.65);for(let j=0;j<3;j++){const t=clamp((p-.08*j)/.68);oval(at.x-Math.cos(angle)*r*j*.22,at.y-Math.sin(angle)*r*j*.22,r*(.22+t*.28),r*(.12+t*.15),j===0?'#ecffff':'#5dbedb',.9-j*.22,2.4-j*.55);}for(let j=0;j<8;j++){const a=j/8*TAU,t=smooth((p-.3)/.45);local(hit.x+Math.cos(a)*r*.68*t,hit.y+Math.sin(a)*r*.50*t,a,r*.10,()=>path('M -1 0 Q .7 -.65 1 0 Q .7 .65 -1 0 Z','#b7f4ff',.8*(1-p*.6)));}impact('#d4faff');
    }else if(['split-knives','five-claws','shadow-scissors','steel-slash','heavy-slash','petrifying-kick'].includes(kind)){
      const count=kind==='five-claws'?5:['split-knives','shadow-scissors'].includes(kind)?2:1;for(let j=0;j<count;j++){ctx.save();if(kind==='shadow-scissors'&&j===1){ctx.translate(hit.x*2,0);ctx.scale(-1,1);}slash(j,count,kind==='shadow-scissors'?'#b995d7':kind==='petrifying-kick'?'#ef9dc9':kind==='steel-slash'?'#9ed5ed':accent);ctx.restore();}if(kind==='petrifying-kick')for(let j=0;j<5;j++){const t=smooth((p-.36)/.42),x=hit.x+(j-2)*r*.2*t,y=hit.y+r*(.1+Math.sin(j*2)*.3)*t;fill([[x-2,y-3],[x+3,y-1],[x+2,y+3],[x-3,y+1]],j%2?'#c7bdcf':'#9e8b9e',t*(1-p));}if(kind==='shadow-scissors')for(let j=0;j<3;j++){const t=smooth((p-.3)/.45),a=2+j*1.8;local(hit.x+Math.cos(a)*r*.64*t,hit.y+Math.sin(a)*r*.48*t,a,r*.10,()=>path('M -.9 -.5 L -.2 -.1 L 0 -.3 L .2 -.1 L .9 -.5 L .6 .1 L .2 .1 L 0 .4 L -.2 .1 L -.6 .1 Z','#a783b9',.8*(1-p)));}wake(accent,count+2,1.9);
    }else if(kind==='hypnotic-ring'){
      for(let j=0;j<2;j++){const t=clamp((p-.10*j)/.70);oval(at.x,at.y,r*(.15+t*.44),r*(.09+t*.25),j%2?'#edd585':'#a0daba',.9*(1-t),1.7);}stroke([[at.x-r*.12,at.y],[at.x+r*.12,at.y]],'#fff2c3',1.3);impact('#d1e6ad');
    }else if(kind==='jaw-impact'){
      const close=smooth((p-.18)/.32);for(const side of[-1,1])local(at.x,at.y+side*r*.32*(1-close),side*.12*(1-close),r*.65,()=>{path('M -.6 0 L -.5 -.2 L .48 -.2 L .64 0 Z','#a8aabc',.85);for(let j=0;j<4;j++)fill([[-.45+j*.26,0],[-.32+j*.26,side*.18],[-.19+j*.26,0]],'#f3eedb',.95);});impact('#e2d4ef');
    }else if(['mace-impact','shave-strike','spring-strike','future-punch','thunder-strike','ice-strike'].includes(kind)){
      const heavy=['mace-impact','thunder-strike','ice-strike'].includes(kind),color=kind==='thunder-strike'?'#d294ea':kind==='ice-strike'?'#bceeff':accent;
      if(!heavy){const growth=kind==='future-punch'?(.3+.75*smooth((p-.05)/.4))*(1-.45*smooth((p-.58)/.3)):.64;for(let j=2;j>=0;j--)fist(at.x-Math.cos(angle)*r*j*.28,at.y-Math.sin(angle)*r*j*.28,r*growth*(1-j*.1),j?.12:.94);}else{slash(0,1,color);local(at.x,at.y,angle,r*.68,()=>path('M -.62 -.12 L -.14 -.19 L -.26 -.37 L .01 -.24 L .13 -.50 L .23 -.20 L .60 -.23 L .33 .02 L .67 .21 L .27 .22 L .12 .48 L -.02 .23 L -.43 .37 L -.23 .12 L -.68 .12 Z',color,.62));}
      if(kind==='spring-strike')local(at.x,at.y,angle,r,()=>{const pts=[],length=.24+.58*smooth((p-.12)/.25);for(let j=0;j<42;j++){const t=j/41;pts.push([-.22-length+t*length,Math.sin(t*TAU*4)*.10*(1-t*.5)]);}stroke(pts,'#e2c891',.025,.75);});
      if(kind==='shave-strike')for(let j=0;j<3;j++)stroke([[at.x-r*.7,at.y+(j-1)*r*.16],[at.x-r*.22,at.y+(j-1)*r*.16]],'#dff8f4',1.1,.75);
      if(kind==='thunder-strike')for(let j=0;j<3;j++){const a=j*2.1+p*.5;local(hit.x,hit.y,a,r,()=>stroke([[0,0],[.24,-.12],[.20,-.30],[.50,-.20],[.69,-.4]],j%2?'#f6d4ff':'#a35ec4',.025,.88));}
      if(kind==='ice-strike')for(let j=0;j<6;j++){const a=j/6*TAU;local(hit.x+Math.cos(a)*r*.5*travel,hit.y+Math.sin(a)*r*.45*travel,a,r*.15,()=>path('M -.9 0 L .15 -.30 L .95 0 L .1 .19 Z',j%2?'#defcff':'#7dc6df',.94));}
      impact(color);wake(color,heavy?9:6,heavy?TAU:1.2);
    }else if(kind==='barrier-impact'){
      local(at.x,at.y,angle,r,()=>{path('M -.28 -.48 L .26 -.38 L .34 .35 L -.20 .48 Z','#58d9af',.20);path('M -.28 -.48 L .26 -.38 L .34 .35 L -.20 .48 Z','#b5ffe3',.95,.026);path('M -.19 -.33 L .14 -.26 L .20 .25 L -.13 .33 Z','#e0fff1',.65,.012);path('M -.22 -.39 L .04 -.34 L .25 .29 L .15 .33 Z','#e3fff4',.30);});impact('#d2ffe8');wake('#a4f6ce',7,TAU);
    }else if(kind==='dark-quake'){
      const t=smooth((p-.08)/.40),fade=1-smooth((p-.63)/.37);oval(hit.x,hit.y,r*.55*t,r*.29*t,'#211e34',.8*fade);for(let j=0;j<3;j++){const pts=[];for(let k=0;k<27;k++){const q=k/26,a=q*4.2+j*TAU/3-p*2,rr=r*(.64-q*.53)*t;pts.push([hit.x+Math.cos(a)*rr,hit.y+Math.sin(a)*rr*.57]);}stroke(pts,j%2?'#bc9add':'#796390',2.4-j*.5,fade);}if(p>.36)for(let j=0;j<5;j++){const a=j/5*TAU,reach=smooth((p-.36)/.30);local(hit.x,hit.y,a,r*reach,()=>stroke([[0,0],[.25,-.1],[.43,.06],[.67,-.09],[.82,-.02]],'#eae7fa',.022,fade));}wake('#cfc6e8',8,TAU);
    }else if(kind==='emperor-slash'){
      slash(0,1,'#f0717c');slash(1,2,'#ffc470');for(let j=0;j<5;j++){const a=-1.1+j*.34+p*1.8;local(hit.x+Math.cos(a)*r*.78,hit.y+Math.sin(a)*r*.52,a,r*.18,()=>path('M -.7 0 L -.28 -.25 L -.39 -.05 L .20 -.35 L .69 0 L .11 .19 L -.43 .14 Z',j%2?'#ffdb88':'#f38a57',.86));}stroke([[hit.x-r*.46,hit.y-r*.37],[hit.x-r*.14,hit.y-r*.60],[hit.x-r*.17,hit.y-r*.28],[hit.x+r*.3,hit.y-r*.43]],'#f8c2ef',1.7,.8);impact('#fff0b1');
    }else if(kind==='punch'){
      const count=spec.action==='bloom'?3:spec.action==='nika'?2:1;
      for(let j=0;j<count;j++){const pulse=clamp((p-j*.10)/(1-j*.10)),step=smooth((pulse-.05)/.42),fade=1-smooth((pulse-.64)/.34),x=mix(tip.x,hit.x,step),y=mix(tip.y,hit.y,step)+(j-(count-1)/2)*r*.30,pos=bounded({x,y});for(let k=2;k>=1;k--)fist(pos.x-Math.cos(angle)*r*k*.32,pos.y-Math.sin(angle)*r*k*.32,r*.66,fade*(.15-k*.025));fist(pos.x,pos.y,r*(spec.action==='bloom'?.56:.75),fade);}
      impact(spec.action==='nika'?'#f3d579':'#f8d7a1');
    }else if(kind==='slash'||kind==='claw'){
      const count=spec.action==='threesword'||kind==='claw'?3:spec.action==='peacock'?2:1;for(let j=0;j<count;j++)slash(j,count,spec.action==='threesword'?['#c4b2e5','#d4e4df','#d68a96'][j]:accent);if(spec.action==='quake')for(let j=0;j<4;j++){const a=j/4*TAU+.3,t=smooth((p-.3)/.42);stroke([[hit.x,hit.y],[hit.x+Math.cos(a)*r*.4*t,hit.y+Math.sin(a)*r*.4*t],[hit.x+Math.cos(a+.18)*r*.72*t,hit.y+Math.sin(a+.18)*r*.72*t]],'#e1f0ec',1.2,.75);}impact();
    }else if(kind==='lightning'){
      const reach=smooth((p-.06)/.32),sx=hit.x-r*.24,sy=Math.max(8,hit.y-r*1.45),points=[[sx,sy],[sx+r*.26,sy+r*.39],[sx+r*.03,sy+r*.72],[hit.x+r*.18,hit.y-r*.28],[hit.x,hit.y]],visiblePoints=points.slice(0,Math.max(2,Math.ceil(reach*points.length)));stroke(visiblePoints,spec.action==='weather'?'#ecc760':'#95dcea',4,.5);stroke(visiblePoints,'#fff9e0',1.5,.96);impact();
    }else if(kind==='beam'||kind==='shot'){
      const tail={x:mix(tip.x,at.x,.66),y:mix(tip.y,at.y,.66)};stroke([[tail.x,tail.y],[at.x,at.y]],kind==='shot'?'#809f42':'#eac36a',kind==='shot'?2.4:4,.7);stroke([[tail.x,tail.y],[at.x,at.y]],'#fff8da',kind==='shot'?.7:1.3);oval(at.x,at.y,kind==='shot'?2.6:4,kind==='shot'?2.6:2.4,kind==='shot'?'#cfdd72':'#fff6c5');impact();
    }else if(kind==='fire'){
      const cold=spec.action==='phoenixbird',outer=cold?'#42a8d3':'#eb7134',inner=cold?'#c4f2e2':'#ffe698';ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle);for(let j=0;j<3;j++){const dy=(j-1)*r*.15,len=r*(.68-j*.13);fill([[-len,dy-r*.05],[-len*.60,dy-r*.20],[-len*.70,dy-r*.07],[-len*.20,dy-r*.22],[r*.21,dy],[-len*.22,dy+r*.16],[-len*.61,dy+r*.10],[-len*.44,dy]],outer,.72);fill([[-len*.58,dy],[-len*.22,dy-r*.06],[r*.18,dy],[-len*.28,dy+r*.05]],inner,.94);}ctx.restore();if(spec.action==='firekick')slash(0,1,'#f5a04b');impact(inner);
    }else if(kind==='ice'){
      for(let j=0;j<3;j++){const x=at.x+(j-1)*r*.16,y=at.y+(j-1)*r*.11;fill([[x-r*.45,y-r*.10],[x+r*.22,y],[x-r*.34,y+r*.09],[x-r*.20,y]],j===1?'#f0ffff':'#92cfe6',.86);}impact('#c9edf0');
    }else if(kind==='ring'){
      const open=.18+.82*smooth((p-.04)/.42);oval(hit.x,hit.y,r*.72*open,r*.27*open,'#83d7e2',.78,1.2);oval(hit.x,hit.y,r*.28*open,r*.65*open,'#d9f4ed',.40,.8);stroke([[hit.x-r*.35*open,hit.y],[hit.x+r*.35*open,hit.y]],'#cef1ec',.8,.6);
      if(p>.22)slash(0,1,'#d2fbff');
    }else{
      const color=kind==='sand'?'#d6b576':kind==='wave'?'#87d7df':'#e2e9eb';for(let j=0;j<2;j++){const points=[];for(let k=0;k<24;k++){const t=k/23,a=-1.0+p*2.1-t*1.7;points.push([at.x+Math.cos(a)*r*(.45+j*.15),at.y+Math.sin(a)*r*(.22+j*.06)]);}stroke(points,color,j===0?2.6:1.2,j===0?.74:.4);}if(kind==='sand')for(let j=0;j<4;j++)oval(at.x+(j-1.5)*r*.19,at.y+Math.sin(j*2)*r*.14,1.2,1.2,color,.75);impact(color);
    }
    ctx.restore();return{phase,progress:p,age,alpha,stage:p<.25?'anticipation':p<.58?'strike':'fade',presentation:kind,impactPoint:hit};
  }
  // Technique colours belong to chakra/material, independently of rod rarity.
  const narutoTechniques={
    kunai:['tool','#76858b','#e3f0ee'],scroll:['volley','#a78570','#f3e5c5'],
    shadow:['shadow','#262d3b','#8c93aa'],fang:['fang','#b4c6c6','#f5f8ef'],
    swarm:['swarm','#313e3d','#a5b9a0'],chakrablade:['paired-slash','#67b9d1','#d7faff'],
    inkbird:['ink','#243436','#e0e9e2'],mindthread:['mind','#b199dd','#f2e9ff'],
    impact:['punch','#c76d89','#ffe0c2'],lion:['lion','#42a8db','#c3f4ff'],
    rotation:['rotation','#7dcedf','#f4ffff'],lotuskick:['kick','#478868','#efead1'],
    fan:['wind','#9ecdc2','#f3fff0'],puppet:['threads','#79c9e4','#dffbff'],
    giantpalm:['punch','#af6054','#f3c3a0'],woodcage:['wood','#816443','#dbbd80'],
    waterbody:['water-slash','#68bfcf','#ecfeff'],sand:['sand','#b58d52','#f1d396'],
    lightning:['lightning','#4ab2ee','#e7ffff'],raven:['crow','#292b3b','#d95860'],
    toad:['fire','#d56635','#ffe7a0'],teleport:['teleport','#e7b94b','#fff4b7'],
    claybird:['clay','#cabea7','#fff3d6'],paper:['paper','#a5b3d1','#fcfcff'],
    kamui:['vortex','#635e7d','#c0bad4'],rasengan:['rasengan','#379ce4','#c6f8ff'],
    susanoo:['arrow','#8e5bc9','#f0ccff'],wooddragon:['dragon','#7c704b','#d4bc7c'],
    meteor:['meteor','#746c6b','#d9b898'],sixpaths:['sixpaths','#dcaf44','#fff2b3']
  };
  Object.assign(narutoTechniques,{
    smallrasengan:['rasengan','#438fca','#d0f5ff'],trainingkunai:['tool','#6e8491','#e5edef'],
    senbon:['volley','#85979e','#f2fbff'],syrup:['water-slash','#58958e','#b8ead8'],
    illusiontree:['wood','#5f414b','#d5a7b0'],snakes:['dragon','#928aa9','#e7dded'],
    icemirrors:['paper','#94cfdf','#f4ffff'],executioner:['paired-slash','#90b7c3','#ecffff'],
    shark:['dragon','#4c9fbd','#c5f4ff'],triplescythe:['paired-slash','#b92d41','#f5cdd1'],
    hundredpuppets:['threads','#ab7254','#8edcf3'],heavenkick:['kick','#538068','#eee0bd'],
    almightypush:['rotation','#a9a2ba','#f5f3ff'],waterdragon:['dragon','#4dadd0','#d8fbff'],
    kusanagi:['tool','#bccbc8','#f3fff7']
  });
  Object.assign(presentation,Object.fromEntries(Object.entries(narutoTechniques).map(([key,row])=>[key,row[0]])));
  const canvasShapes=new Map();
  function traceShape(ctx,d){
    // Cached canvas commands also work in the software renderer and geometry audits.
    let commands=canvasShapes.get(d);
    if(!commands){
      const tokens=d.match(/[MLCQZ]|[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi),sizes={M:2,L:2,C:6,Q:4},names={M:'moveTo',L:'lineTo',C:'bezierCurveTo',Q:'quadraticCurveTo'};
      commands=[];let op='',i=0;
      while(i<tokens.length){if(/^[MLCQZ]$/.test(tokens[i]))op=tokens[i++];if(op==='Z'){commands.push(['closePath']);op='';continue;}const count=sizes[op];if(!count||i+count>tokens.length)throw Error('Invalid technique contour');commands.push([names[op],...tokens.slice(i,i+count).map(Number)]);i+=count;if(op==='M')op='L';}
      canvasShapes.set(d,commands);
    }
    ctx.beginPath();for(const [method,...points]of commands)ctx[method](...points);
  }

  function drawNaruto(ctx,id,phase,age,values,g,tip,point,quiet=false,energy=1){
    if(!visible(phase,age,id))return null;
    const painted=NarutoVFX?.draw(ctx,id,phase,age,values,g,tip,point,quiet,energy);if(painted)return painted;
    const spec=entries[id],action=spec.action,[kind,color,light]=narutoTechniques[action];
    const t=clamp(age/cleanDurations[phase]),p=quiet?.52:t;
    const alpha=smooth(t/.10)*(1-smooth((t-.64)/.36))*clamp(energy);
    const r=Math.max(12,Math.min(39,g.width*.098,g.height*.145))*(quiet?.7:1);
    const hit=phase==='caught'?point:(g.water||point),angle=Math.atan2(hit.y-tip.y,hit.x-tip.x);
    // A fixed short approach ends at the real water/fish position. No screen-wide prop.
    const reach=smooth((p-.06)/.48),distance=r*1.48*(1-reach);
    const at={x:hit.x-Math.cos(angle)*distance,y:hit.y-Math.sin(angle)*distance};
    const strike=1-smooth((p-.63)/.30),impact=smooth((p-.43)/.28)*(1-smooth((p-.65)/.32));
    ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';
    const line=(pts,fill,w=1,opacity=1)=>{ctx.save();ctx.globalAlpha*=opacity;ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));ctx.strokeStyle=fill;ctx.lineWidth=w;ctx.stroke();ctx.restore();};
    const poly=(pts,fill,opacity=1)=>{ctx.save();ctx.globalAlpha*=opacity;ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.restore();};
    const ellipse=(x,y,rx,ry,fill,opacity=1,width=0,rotation=0)=>{ctx.save();ctx.globalAlpha*=opacity;ctx.beginPath();ctx.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),rotation,0,TAU);ctx.fillStyle=ctx.strokeStyle=fill;ctx.lineWidth=width;if(width)ctx.stroke();else ctx.fill();ctx.restore();};
    const local=(x,y,turn,scale,fn)=>{ctx.save();ctx.translate(x,y);ctx.rotate(turn);ctx.scale(scale,scale);fn();ctx.restore();};
    const shape=(d,fill,stroke=null,width=.022)=>{traceShape(ctx,d);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}};
    const ribbon=(x,y,rad,start,sweep,wide,fill,flat=.6,opacity=1)=>{
      const a=[],b=[];for(let j=0;j<=28;j++){const u=j/28,theta=start+sweep*u,w=Math.pow(Math.sin(Math.PI*u),.8)*wide;a.push([x+Math.cos(theta)*(rad+w),y+Math.sin(theta)*(rad+w)*flat]);b.push([x+Math.cos(theta)*rad,y+Math.sin(theta)*rad*flat]);}poly([...a,...b.reverse()],fill,opacity);
    };
    const burst=(fill=light,scale=1)=>{if(!impact)return;const s=r*(.32+smooth((p-.43)/.45)*.44)*scale;ellipse(hit.x,hit.y,s,s*.32,fill,impact*.65,1.05);for(let j=0;j<4;j++){const a=.4+j*TAU/4;poly([[hit.x+Math.cos(a-.07)*s*.8,hit.y+Math.sin(a-.07)*s*.8],[hit.x+Math.cos(a)*s*1.18,hit.y+Math.sin(a)*s*1.18],[hit.x+Math.cos(a+.07)*s*.8,hit.y+Math.sin(a+.07)*s*.8]],fill,impact*.8);}};
    const speed=(x,y,length,fill=light)=>{for(let j=0;j<2;j++){const n=(j-.5)*r*.22;line([[x-Math.cos(angle)*length-Math.sin(angle)*n,y-Math.sin(angle)*length+Math.cos(angle)*n],[x-Math.cos(angle)*r*.35-Math.sin(angle)*n,y-Math.sin(angle)*r*.35+Math.cos(angle)*n]],fill,j? .65:1.1,strike*.4);}};
    function blade(x,y,three=false,opacity=1){local(x,y,angle,r*.62,()=>{ctx.globalAlpha*=opacity;shape('M.72 0 L.13-.18 L-.07-.08 L-.07.08 L.13.18 Z','#72838b','#26363c',.028);poly([[.72,0],[.13,-.18],[.12,0]],'#e0eeee');line([[-.07,0],[-.46,0]],'#454b50',.13);for(let j=0;j<3;j++)line([[-.18-j*.08,-.055],[-.15-j*.08,.055]],'#d0c9b2',.025);ellipse(-.57,0,.11,.11,'#8e999d',1,.035);if(three){poly([[.13,-.09],[.05,-.44],[-.12,-.40],[-.08,-.18],[-.17,-.06]],'#d8e0d6');poly([[.13,.09],[.05,.44],[-.12,.40],[-.08,.18],[-.17,.06]],'#72838b');}});}
    function slash(index,count,fill=color,flat=.64){const lag=index*.075,s=smooth((p-lag-.03)/.52),fade=1-smooth((p-lag-.63)/.30);const x=hit.x+(index-(count-1)/2)*r*.12,y=hit.y+(index-(count-1)/2)*r*.25,turn=-2.05+s*2.6;ribbon(x,y,r*.71,turn,-1.8,r*.14,fill,flat,fade);ribbon(x,y,r*.73,turn,-1.65,r*.045,light,flat,fade);}
    function fist(x,y,size,opacity=1,chakra=false){local(x,y,angle,size,()=>{ctx.globalAlpha*=opacity;const body=chakra?'#8fdcff':'#f1ba95',shade=chakra?'#3893cd':'#b77259';shape('M-.47-.21 L-.22-.25 Q-.19-.43-.06-.39 Q.03-.48.13-.39 Q.24-.46.32-.34 Q.47-.37.49-.20 L.46.06 Q.51.25.31.32 L-.11.31 L-.29.18 L-.47.16 Z',body,chakra?'#276ca1':'#614348',.027);shape('M-.46.05 L-.13.15 L.13.18 L.43.10 L.40.26 L.29.32 L-.12.29 L-.30.18 L-.46.16 Z',shade);for(let j=0;j<3;j++)line([[-.10+j*.17,-.34],[-.09+j*.17,-.13]],shade,.025);line([[-.03,.04],[.18,-.035],[.41,.015],[.33,.13],[.09,.16]],shade,.035);line([[-.15,-.27],[.27,-.27]],light,.024,.8);});}
    function orb(x,y,gold=false){const rr=r*(.29+.07*reach),a=quiet?.7:p*4.8;
      const grad=ctx.createRadialGradient(x-rr*.3,y-rr*.4,rr*.06,x,y,rr);grad.addColorStop(0,gold?'#fffce3':'#f1ffff');grad.addColorStop(.5,gold?'#f4d479':'#8de2ff');grad.addColorStop(1,gold?'#b07a2e':'#288ecf');ellipse(x,y,rr,rr,grad,.96);
      // Three non-coplanar bands preserve a spherical volume as the chakra turns.
      local(x,y,a*.45,1,()=>{for(let j=0;j<3;j++){const q=a+j*TAU/3;ctx.save();ctx.rotate(j*1.05);ribbon(0,0,rr*.76,q,4.7,rr*.09,light,.37,.95);ctx.restore();}});
      ellipse(x-rr*.28,y-rr*.32,rr*.14,rr*.20,'#ffffff',.8);speed(x,y,r*.9,gold?'#ecd08b':'#83ccea');
      if(gold)for(let j=0;j<3;j++){const q=2.3+j*.52;ellipse(x+Math.cos(q)*rr*1.5,y+Math.sin(q)*rr*1.5,r*.052,r*.052,'#292c38',strike);}
    }
    // The hook prompt stays unobstructed: a small water cue, never a full attack.
    if(phase==='bite'){
      const size=r*(.16+smooth(p)*.19);ellipse(hit.x,hit.y,size,size*.35,color,.70,1.15);ellipse(hit.x,hit.y-2,1.65,2.0,light,.9);
      line([[hit.x-r*.13,hit.y-r*.15],[hit.x-r*.20,hit.y-r*.27]],light,.9,.6);line([[hit.x+r*.13,hit.y-r*.15],[hit.x+r*.20,hit.y-r*.27]],light,.9,.6);
    }else if(kind==='tool'||kind==='volley'||kind==='teleport'){
      const count=kind==='volley'?3:1;for(let j=0;j<count;j++){const offset=(j-(count-1)/2)*r*.38,step=smooth((p-j*.07-.04)/.42),d=r*1.4*(1-step);const x=hit.x-Math.cos(angle)*d-Math.sin(angle)*offset,y=hit.y-Math.sin(angle)*d+Math.cos(angle)*offset;speed(x,y,r,kind==='teleport'?light:'#c0d6d9');blade(x,y,kind==='teleport',strike);}
      if(kind==='teleport'){line([[hit.x-r*.38,hit.y],[hit.x+r*.38,hit.y]],light,1.6,impact);line([[hit.x,hit.y-r*.43],[hit.x,hit.y+r*.27]],'#e8be63',1.2,impact);}else burst();
    }else if(kind==='punch'||kind==='lion'){
      const count=kind==='lion'?2:1;for(let j=0;j<count;j++){const off=(j-(count-1)/2)*r*.43,x=at.x-Math.sin(angle)*off,y=at.y+Math.cos(angle)*off,size=r*(kind==='lion'?.55:action==='giantpalm'?.96:.78);fist(x-Math.cos(angle)*r*.30,y-Math.sin(angle)*r*.30,size,strike*.17,kind==='lion');
        if(kind==='lion'){fist(x-Math.cos(angle)*r*.12,y-Math.sin(angle)*r*.12,size*.72,strike*.65,true);local(x,y,angle,size,()=>{shape('M.6-.1 L.43-.40 L.12-.37 L-.19-.67 L-.20-.40 L-.65-.48 L-.45-.13 L-.78.02 L-.41.17 L-.48.47 L-.06.32 L.15.46 L.24.22 L.51.17 L.31.05 Z','#479dcf');shape('M.32-.29 L.17-.15 L.35-.13 L.51-.1 L.41-.02 L.25-.02 L.23.14 L.07.20 L-.11.09 L-.22-.14 L-.09-.35 Z','#c2f3ff');poly([[.18,-.17],[.30,-.18],[.25,-.10]],'#286293');line([[.24,.05],[.38,.05]],'#4d9bc2',.022);line([[.21,.08],[.27,.12],[.31,.07]],'#f0feff',.02);});}
        else fist(x,y,size,strike);speed(x,y,r*.86,color);
      }burst(light,action==='giantpalm'?1.08:.85);
    }else if(kind==='paired-slash'||kind==='wind'||kind==='water-slash'){
      const count=kind==='paired-slash'?2:kind==='wind'?3:1;for(let j=0;j<count;j++)slash(j,count);if(kind==='water-slash')for(let j=0;j<4;j++){const a=j*.8-.8;ellipse(hit.x+Math.cos(a)*r*.62,hit.y+Math.sin(a)*r*.5,1.4,2.2,light,impact,0,-a);}burst();
    }else if(kind==='lightning'){
      local(at.x,at.y,angle,1,()=>{const jitter=quiet?0:Math.sin(p*19)*r*.045,pts=[[-r*.85,-r*.05],[-r*.51,r*.13],[-r*.28,-r*.14+jitter],[-r*.04,r*.04],[r*.26,0]];line(pts,color,4.2,strike*.65);line(pts,light,1.45,strike);for(let j=0;j<2;j++)line([[-r*.26,0],[-r*.43,-r*.25*(j? -1:1)],[-r*.34,-r*.41*(j? -1:1)]],light,.8,strike*.7);});burst('#baf1ff',.85);
    }else if(kind==='rasengan'||kind==='sixpaths'){
      orb(at.x,at.y,kind==='sixpaths');burst(light,.85);
    }else if(kind==='arrow'){
      local(at.x,at.y,angle,r,()=>{poly([[-.89,-.043],[.06,-.043],[.04,-.20],[.43,0],[.04,.20],[.06,.043],[-.89,.043]],'#8c58bf',strike);poly([[-.81,-.012],[.16,-.012],[.13,-.08],[.38,0],[.13,.08],[.16,.012],[-.81,.012]],'#eacaff',strike);poly([[-.79,-.025],[-.98,-.14],[-.91,.02],[-.72,.05]],'#a572dd',strike);});speed(at.x,at.y,r*1.1,'#cfa4f1');burst();
    }else if(kind==='rotation'||kind==='vortex'||kind==='fang'){
      const count=kind==='fang'?2:3;for(let j=0;j<count;j++){const spin=quiet?.7:p*4.4,rad=r*(kind==='vortex'?(1-reach*.6)*(.45+j*.10):.30+j*.12),cx=kind==='fang'?at.x+(j-.5)*r*.35:hit.x,cy=kind==='fang'?at.y+(j-.5)*r*.3:hit.y;
        ribbon(cx,cy,rad,spin+j*2.1,4.6,r*.10,j===1?light:color,kind==='rotation'?.65:.42,strike*(kind==='vortex'?.85:.8));}
      if(kind==='vortex')ellipse(hit.x,hit.y,r*.11*(1-reach*.5),r*.09,'#252534',strike*.8);else burst();
    }else if(kind==='kick'){
      const turn=-1.4+smooth((p-.06)/.5)*2.0;local(at.x,at.y,angle+turn,r*.84,()=>{shape('M-.58-.25 L-.33-.32 L.04-.10 L.12.12 L.40.18 Q.51.21.41.33 L.08.35 L-.12.16 Z','#427354','#263b37',.028);shape('M-.15-.08 L.04-.10 L.12.12 L.40.18 Q.51.21.41.33 L.10.30 L.10.14 Z','#d7c5a6');for(let j=0;j<3;j++)line([[-.15+j*.055,-.02+j*.036],[.038+j*.04,-.04+j*.046]],'#f7edcf',.035);});slash(0,1,'#c5d5bc');burst('#f5ecd3');
    }else if(kind==='shadow'){
      const pts=Array.from({length:25},(_,j)=>{const u=j/24;return[hit.x-r*(1-u)*1.5,hit.y+Math.sin(u*6.2)*r*.14*(1-u)];});line(pts,'#202833',r*.095,strike);ribbon(hit.x,hit.y,r*.26,-.4+reach*2,4.5,r*.13,color,.37,strike);line([[hit.x-r*.30,hit.y],[hit.x-r*.2,hit.y+r*.20],[hit.x+r*.17,hit.y+r*.13]],'#404957',1,impact);
    }else if(kind==='mind'||kind==='threads'){
      for(let j=0;j<(kind==='threads'?3:1);j++){const off=(j-1)*r*.16,tail={x:at.x-Math.cos(angle)*r*.84,y:at.y-Math.sin(angle)*r*.84};line([[tail.x,tail.y+off],[at.x,at.y]],color,kind==='threads'?.8:2.3,strike*.75);if(kind==='mind')line([[tail.x,tail.y],[at.x,at.y]],light,.8,strike);}
      if(kind==='threads'){slash(0,1,'#aedee4');}else ellipse(hit.x,hit.y,r*(.12+reach*.22),r*(.16+reach*.24),light,impact,.9,angle);burst(light,.7);
    }else if(kind==='sand'||kind==='wood'||kind==='dragon'){
      if(kind==='sand'){ribbon(at.x,at.y,r*.45,-2+p*2.5,2.6,r*.20,color,.42,strike);ribbon(at.x,at.y-r*.03,r*.45,-2+p*2.5,2.5,r*.06,light,.42,strike);for(let j=0;j<12;j++){const a=j*2.4,x=at.x+Math.cos(a)*r*(.18+j*.036),y=at.y+Math.sin(a)*r*.29;ellipse(x,y,.7+j%3*.26,.65+j%2*.2,j%2?color:light,strike*.72);}}
      else if(kind==='wood'){local(at.x,at.y,angle,r,()=>{for(let j=0;j<3;j++){const y=(j-1)*.19;poly([[-.65,y-.08],[.10-j*.08,y-.07],[.38-j*.10,y],[-.52,y+.09]],color,strike);line([[-.54,y-.025],[.13-j*.08,y-.02]],light,.024,strike*.85);line([[-.34,y+.01],[-.12,y+.015]],'#493b2d',.018,strike);}});}
      else local(at.x,at.y,angle,r,()=>{ctx.globalAlpha*=strike;shape('M-.96.27 Q-.52-.15-.24.02 Q.02.21.13-.04 L.12-.23 L.27-.42 L.30-.17 L.50-.13 L.46-.04 L.60.01 L.40.13 L.16.08 Q-.05.38-.35.21 Q-.60.04-.96.27 Z',color,'#443d2c',.024);line([[-.84,.21],[-.55,.03],[-.34,.08],[-.15,.16],[.03,.08],[.18,-.04],[.41,-.02]],light,.026,.8);ellipse(.28,-.065,.024,.018,'#f4d789');for(let j=0;j<4;j++)line([[-.58+j*.14,.035+j%2*.065],[-.60+j*.14,.14+j%2*.07]],'#5d5335',.022);});burst(light,.88);
    }else if(kind==='fire'){
      local(at.x,at.y,angle,r,()=>{for(let j=0;j<3;j++){const off=(j-1)*.14;poly([[-.93,off-.10],[-.61,off-.27],[-.62,off-.09],[-.31,off-.20],[.31,off],[-.27,off+.16],[-.65,off+.07]],color,strike*.75);poly([[-.58,off],[-.26,off-.065],[.26,off],[-.28,off+.065]],light,strike);}});burst(light,.88);
    }else if(kind==='paper'){
      for(let j=0;j<5;j++){const a=angle+(j-2)*.15,offset=(j-2)*r*.19;local(at.x-Math.sin(angle)*offset,at.y+Math.cos(angle)*offset,a,r*.44,()=>{ctx.globalAlpha*=strike;poly([[-.67,0],[-.25,-.24],[.46,-.08],[.29,.16]],'#d1d9ea');poly([[-.67,0],[-.25,-.24],[.46,-.08],[-.12,-.02]],'#fcffff');line([[-.12,-.02],[.29,.16]],'#8395ba',.025);});}burst(light,.75);
    }else if(kind==='clay'||kind==='ink'||kind==='crow'){
      const count=kind==='crow'?3:kind==='ink'?2:1;for(let j=0;j<count;j++){const off=(j-(count-1)/2)*r*.37,flap=quiet?.2:Math.sin(p*9+j)*.17;local(at.x-Math.sin(angle)*off,at.y+Math.cos(angle)*off,angle,r*(kind==='clay'?.49:.35),()=>{ctx.globalAlpha*=strike;const body=kind==='clay'?'#ebe1c9':'#293439';poly([[-.43,.07],[-.25,-.11],[-.62,-.49-flap],[-.20,-.24],[.09,-.39],[.16,-.13],[.38,-.06],[.62,.005],[.33,.10],[.16,.05],[-.22,.18],[-.57,.25],[-.39,.1]],body);poly([[-.27,-.1],[-.68,.42+flap],[-.17,.21],[.08,.025]],kind==='clay'?'#bcae93':'#48535b');if(kind==='clay'){line([[-.45,-.30],[-.18,-.16],[.05,-.12]],'#fff9e8',.025);ellipse(.26,-.04,.026,.025,'#75614e');}else if(kind==='crow')ellipse(.26,-.04,.026,.025,'#d75965');});}
      if(kind==='clay')burst('#f5d2a0');else for(let j=0;j<4;j++)ellipse(hit.x+(j-1.5)*r*.17,hit.y+Math.sin(j*2)*r*.19,1+j%2,1.2,color,impact*.7);
    }else if(kind==='swarm'){
      for(let j=0;j<7;j++){const a=j*2.4+p*.8,rad=r*(.18+j*.055)*(1-reach*.6),x=at.x+Math.cos(a)*rad,y=at.y+Math.sin(a)*rad*.65;ellipse(x,y,1.05,1.9,'#263b38',strike,0,angle);line([[x-2,y-1],[x+2,y+1]],'#9ea99a',.6,strike*.65);}burst(light,.6);
    }else if(kind==='meteor'){
      const fall=1-smooth((p-.06)/.45),x=hit.x-r*.64*fall,y=hit.y-r*1.1*fall;local(x,y,.6,r*.41,()=>{ctx.globalAlpha*=strike;poly([[-.60,-.47],[-.04,-.73],[.63,-.31],[.70,.27],[.11,.65],[-.57,.41]],'#8b8174');poly([[-.6,-.47],[-.04,-.73],[.12,-.1],[-.57,.41]],'#c1b49b');poly([[.12,-.1],[.63,-.31],[.70,.27],[.11,.65]],'#635e60');line([[-.31,-.40],[.12,-.1],[-.10,.35]],'#e2d5b3',.028);});line([[x-r*.12,y-r*.24],[x-r*.35,y-r*.65]],light,1.7,strike*.6);burst('#d9c4a2',1.12);
    }
    ctx.restore();return{phase,progress:p,age,alpha,stage:p<.23?'anticipation':p<.59?'strike':'fade',presentation:kind,impactPoint:hit};
  }
  function draw(ctx,id,phase,age,values,g,tip,point,quiet=false,energy=1){
    if(!has(id)||!visible(phase,age,id))return null;
    if(entries[id].collection==='valorant')return ValorantVFX?.draw(ctx,id,phase,age,values,g,tip,point,quiet,energy)||null;
    if(OnePieceVFX?.has(id)){const painted=OnePieceVFX.draw(ctx,id,phase,age,values,g,tip,point,quiet,energy);if(painted||ctx.canvas?.ownerDocument)return painted;}
    return entries[id].collection==='naruto'?drawNaruto(ctx,id,phase,age,values,g,tip,point,quiet,energy):drawClean(ctx,id,phase,age,values,g,tip,point,quiet,energy);
  }
  // Miniatures use a restrained shared light direction, real edges and a weighted stem.
  // They remain static artwork; movement comes exclusively from the fishing float rig.
  const floatMaterials={
    sand:['#f3dcad','#c29558','#76502f'],lightning:['#e6f2f3','#728a96','#253746'],
    raven:['#8593aa','#343e53','#171e2d'],toad:['#e2cd98','#9c8750','#574c32'],
    teleport:['#f8f2cf','#91a4ad','#364552'],claybird:['#fffae9','#d6ceb8','#9e907b'],
    paper:['#fcfbff','#afb9dc','#6c7d9f'],kamui:['#f6c278','#d68040','#8c492d'],
    rasengan:['#efffff','#65caf5','#28649f'],susanoo:['#f5d8ff','#b781db','#634280'],
    wooddragon:['#e8d9a7','#a08b53','#584e30'],meteor:['#e8ad9e','#a65554','#4f343e'],
    sixpaths:['#fff6c6','#e6be58','#946123'],threesword:['#f4f0de','#9fafae','#464654'],
    flame:['#fff0a9','#ed9446','#ad4138'],dragonclaw:['#f2d68f','#bf9250','#62493e'],
    room:['#f0e58b','#b7b75d','#607757'],stone:['#ffe9ed','#e25b88','#953855'],
    thunderdragon:['#fff0b7','#d9ae4c','#95713c'],mochi:['#fff8e9','#e0d2c2','#a79a96'],
    phoenixbird:['#ddfff6','#53cce4','#347bae'],rubber:['#fff1b5','#d6b461','#927044'],
    haki:['#fff3d3','#c9a363','#77504a'],quake:['#f6f4e6','#c0c9c2','#617d80'],
    blackblade:['#f3de9c','#b6984d','#5c4439'],nika:['#ffffff','#eee7d5','#baaf9d'],
    split:['#fff2df','#ce6365','#6e394c'],sandhook:['#fff0bd','#ceaa66','#79603b'],
    paw:['#fff0f8','#e0b6d2','#977996'],current:['#e2ffff','#64b8d5','#326982'],
    strings:['#fff4fb','#e997c7','#9d518a'],shadowcut:['#c4b7d7','#6e527b','#332d45'],
    heavyglaive:['#eff5f2','#a7b4c4','#586573'],iceclub:['#f3ffff','#a4dfdf','#54889e'],
    futurepunch:['#fff0d5','#ebc5a7','#ba818e'],darkquake:['#c9addf','#66517d','#292738'],
    thunderbagua:['#d9c4ee','#685b7f','#2c2b3c'],emperorsword:['#fff0d5','#e998b7','#97485f']
  };
  Object.assign(floatMaterials,{
    shark:['#e6f3f8','#6d99b4','#334c6f'],triplescythe:['#f4c3bd','#b53849','#562e3c'],
    hundredpuppets:['#f0d2a7','#ad7953','#613f35'],heavenkick:['#dfefdb','#75a38b','#345447'],
    almightypush:['#e5dff5','#af93c9','#534564'],waterdragon:['#eafcff','#73bcd8','#355c95'],
    kusanagi:['#faf6e9','#c4c1ac','#716579']
  });
  let floatSerial=0;
  function detailedBobber(id){
    if(id?.startsWith('valorant_'))return ValorantVFX?.bobber(id)||'';
    const spec=entries[id];if(!spec||!['epic','legendary'].includes(spec.rarity))return '';
    const action=spec.action,mat=floatMaterials[action];if(!mat)return '';
    const uid='anime-float-'+(++floatSerial),primary='url(#'+uid+'-body)',metal='url(#'+uid+'-metal)',glass='url(#'+uid+'-glass)';
    const path=(d,fill=primary,stroke='#354047',w=.75,extra='')=>'<path d="'+d+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round" '+extra+'/>';
    const line=(d,color='#fff7dc',w=.8,extra='')=>path(d,'none',color,w,extra);
    const oval=(x,y,rx,ry,fill,extra='')=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+fill+'" '+extra+'/>';
    const ring=(x,y,r,fill,stroke,w=.7)=>oval(x,y,r,r,fill,'stroke="'+stroke+'" stroke-width="'+w+'"');
    const tomoe=(x,y,turn,fill)=>'<g transform="translate('+x+' '+y+') rotate('+turn+') scale(.55)">'+path('M0-2.4C-3.6-2.8-4.3 2.1-1.2 3.6C-2.4 1.3 .8 1.1 1.6-.6C2.1-1.5 1.3-2.3 0-2.4Z',fill,'none',0)+'</g>';
    let body='';
    if(action==='shark'){
      body=path('M20 7L24 15L31 19L27 25L29 34L22 32L20 39L17 33L10 35L12 25L8 20L16 15Z')+path('M20 10L17 22L13 28L20 33L26 27L23 21Z',glass)+path('M15 23L20 26L26 22L24 29L20 31L16 28Z','#314458','#253849',.5)+path('M16 24L18 27L20 25L22 28L24 25','#e7f5ec','#799aaf',.4)+line('M11 21L15 23M26 18L28 20M17 13L20 9','#f0faff',.8)+ring(17,20,.8,'#24333e','none');
    }else if(action==='triplescythe'){
      body=path('M17 6H21V38H17Z',metal)+path('M20 8Q32 8 33 18L26 14L21 15ZM20 17Q31 18 32 27L26 23L21 24ZM20 26Q29 28 30 36L24 32L20 32Z')+line('M22 10Q29 10 31 14M22 19Q28 20 30 23M22 28L28 32','#ffe6dc',.8)+path('M16 33H22V38H16Z','#554254','#26323c',.6)+line('M17 34L21 35M17 36L21 37','#d9d9d0',.6);
    }else if(action==='hundredpuppets'){
      body=path('M16 8L24 8L28 17L25 29L28 36L21 39L14 36L15 28L11 18Z')+path('M13 17L18 20L17 28L14 25ZM25 17L22 21L23 28L26 24Z',metal)+ring(20,16,3.8,primary,'#604633')+ring(20,27,3.4,metal,'#71513b')+line('M14 12L18 10M15 32L23 36','#fff0cd',.7)+line('M12 18L8 28L13 32M28 18L33 28L27 33','#71c6e6',.85)+ring(12,18,1.4,'#ecd1a1','#664e3d',.4)+ring(28,18,1.4,'#ecd1a1','#664e3d',.4);
    }else if(action==='heavenkick'){
      body=path('M14 9Q20 6 26 9L28 19L25 30L27 36Q20 40 13 36L15 29L12 18Z')+path('M17 10L23 10L25 20L22 30H17L15 20Z','#f0e5c9','#637364',.55)+path('M20 13L23 18L20 23L17 18Z','#9477b7','#675388',.5)+line('M13 25L18 31M27 25L23 31','#dcead5',.8)+path('M16 32H24V36H16Z',metal)+oval(17,11,1.4,.6,'#fff9df');
    }else if(action==='almightypush'){
      body=path('M15 8L25 8L29 17L27 31L23 38H17L13 31L11 17Z')+ring(20,22,9,glass,'#504557',.6)+[7,5.4,3.8,2.1].map(r=>ring(20,22,r,'none','#6f5489',.55)).join('')+ring(20,22,.9,'#40364c','none')+line('M13 16L16 12M14 28L16 32','#f2edff',.8)+[12,20,28].map(y=>ring(12.5,y+1,1,metal,'#41404c',.4)+ring(27.5,y+1,1,metal,'#41404c',.4)).join('');
    }else if(action==='waterdragon'){
      body=path('M13 35Q28 34 23 27Q10 23 16 15L12 10L19 12L25 8L25 14L30 18L24 21Q33 31 25 37L17 39Z')+path('M17 34Q24 31 19 27Q11 22 18 16L24 16L26 18L20 20Q18 22 24 26Q29 34 22 37Z',glass)+line('M13 11L18 16M25 9L22 16M15 35Q24 34 23 30','#e7ffff',.8)+ring(23,17,.9,'#263b69','none')+line('M25 20L31 24M20 21L14 25','#aadfed',.6)+path('M14 35L18 36L17 39L13 38Z',metal);
    }else if(action==='kusanagi'){
      body=path('M20 5L23 28L20 32L17 28Z',metal)+path('M20 6V29L18 27Z','#f6fbef','none')+path('M14 32Q9 28 13 23Q16 20 23 24Q29 27 25 32Q20 35 16 30Q13 27 18 26L22 28L20 30L17 28Q16 31 20 31Q26 31 23 27Q16 23 14 26Q12 30 17 33Z')+path('M17 33H23V39H17Z','#817190','#514760',.5)+line('M18 34L22 35M18 37L22 38','#e5d9e1',.6)+ring(19,27,.65,'#5f4f65','none');
    }else if(action==='sand'){
      body=path('M15 9C12 12 13 17 17 20C10 21 7 28 10 34C13 40 28 40 31 33C33 27 29 21 24 20C28 16 27 10 24 9Z')+path('M17 6H23L24 10Q20 12 16 10Z','#976a42','#614a35')+oval(20,6,3.2,1.1,'#d1ad75')+path('M16 18Q20 20 25 18L25 21Q20 23 15 21Z','#983e39','#753c32',.5)+line('M11 29Q19 33 30 28','#a9443d',2)+line('M12 27Q18 29 28 26','#fbe7b9',.7)+line('M16 23Q11 26 12 30M16 12Q15 14 17 16','#fff3ca',1.2)+path('M22 24L26 23L25 28L21 29Z','#ead09d','#775638',.45)+line('M22 25L25 25M22 27L24 26','#896344',.55);
    }else if(action==='lightning'){
      body=path('M20 6L28 23L22 28V34H18V28L12 23Z')+path('M20 6V25L13 23Z','#c8d9df','none')+path('M20 8L22 23L20 25Z','#465d6b','none')+line('M19 12L16 20L20 19L18 24','#a0eeff',1.3)+path('M17 27H23V35H17Z','#3c4b57','#26363f',.55)+line('M17 29L23 30M17 32L23 33','#b9c8cc',.7)+ring(20,37,2.4,'none','#a9bbc1',1.1);
    }else if(action==='raven'){
      body=path('M20 13Q16 7 13 10L8 7L10 18L6 17Q10 29 17 33L20 39L23 32Q31 28 34 17L29 18L32 8L24 11Q24 7 21 8Z')+path('M10 14L16 18L19 31L14 26Z','#63728b','none')+path('M30 14L24 18L21 31L26 25Z','#232c3e','none')+line('M10 15L15 22M12 21L16 26M29 15L25 22','#a2afc4',.65)+ring(20,21,4.1,'#9d353e','#d69985',.7)+ring(20,21,1.2,'#232631','#262631',.5)+tomoe(20,18.8,0,'#252734')+tomoe(22,22,120,'#252734')+tomoe(18,22,240,'#252734')+line('M19 11L21 10','#dce9eb',.8);
    }else if(action==='toad'){
      body=path('M11 18Q7 8 14 9Q18 9 20 13Q22 9 27 9Q34 11 29 19Q35 27 30 33Q21 39 10 33Q5 28 11 18Z')+oval(14,13,3.3,3,'#d8b670')+oval(26,13,3.3,3,'#d8b670')+line('M12 13H16M24 13H28','#2d3530',1.1)+path('M12 24Q20 28 29 24L27 32Q20 35 13 31Z','#e8dcb4','#857447',.6)+line('M11 22Q20 25 30 22','#625630',.8)+path('M18 28H23V35L20 33L18 35Z','#a73f38','#7b3b31',.5)+line('M10 28L8 31M30 28L32 31','#e7d9a3',1.1)+oval(12,19,1.2,.8,'#c1875f')+oval(28,19,1.2,.8,'#c1875f');
    }else if(action==='teleport'){
      body=path('M20 4L25 19L23 23L29 21L29 13L33 17L34 26L24 29L23 35H17L16 29L6 26L7 17L11 13L11 21L17 23L15 19Z')+path('M20 5V25L16 19Z','#eef6ee','none')+path('M20 5L25 19L22 24L20 25Z','#657b85','none')+line('M8 18L8 24L16 26M31 18L32 24L25 26','#e9efd9',.7)+path('M17 26H23V36H17Z','#cdb379','#66543d',.55)+line('M18 28L22 29M18 31L22 32M18 34L22 34','#f5e7bc',.7)+line('M20 28V34M19 30H21M19 33H21','#685234',.45)+ring(20,38,2.2,'none','#e6d39b',1.3);
    }else if(action==='claybird'){
      body=path('M18 20L6 9L7 24L16 29L15 35L20 32L25 36L24 28L33 24L34 9L23 19L24 15L21 12L18 15Z')+path('M8 12L10 22L17 26L17 22Z','#e2d8c0','none')+path('M32 12L28 22L23 26L23 21Z','#b2a991','none')+path('M20 17Q16 24 20 29Q24 25 22 18Z','#fff9e5','#b3a28a',.5)+line('M11 17L16 23M10 21L15 25M29 17L25 23','#fffbee',.8)+oval(20,16,1.1,.9,'#645749')+path('M22 16L26 18L22 19Z','#c2b499','#938875',.4)+line('M18 29L17 33M22 29L23 33','#b09c80',.7);
    }else if(action==='paper'){
      body=path('M20 7L29 9L33 17L31 28L23 35L13 32L7 24L8 14Z')+path('M20 7L19 17L8 14Z','#f7f4ff','#94a2c2',.55)+path('M29 9L25 21L19 17Z','#c6cce5','#8d9abd',.55)+path('M33 17L25 21L31 28Z','#f8f8ff','#8d9abd',.55)+path('M31 28L19 27L23 35Z','#a9b6d1','#7d90b0',.55)+path('M23 35L13 32L16 23L19 27Z','#e3e8f7','#8d9abd',.55)+path('M7 24L16 23L8 14Z','#bec8e2','#8493b4',.55)+path('M16 16L25 17L26 25L20 29L14 24Z','#f1f2fc','#7f90b4',.6)+path('M16 16L21 19L25 17L22 24L17 25Z','#b0bcda','#8e9fbb',.5)+path('M18 20L22 20L23 23L19 25Z','#fcfbff','#a2aecb',.5)+line('M10 15L14 17M25 10L23 15','#ffffff',.9);
    }else if(action==='kamui'){
      body=path('M20 7C30 7 33 15 32 24C31 34 26 38 20 38C12 37 8 31 8 23C7 13 12 7 20 7Z')+line('M25 17C31 24 25 34 17 32C9 29 12 18 19 16C25 15 29 20 27 25C25 31 17 30 16 25C14 20 19 17 23 19C28 22 22 29 19 25C16 23 21 19 23 22','#a15631',1.1)+line('M14 12Q21 8 27 13M11 18Q9 25 14 30','#ffe0a0',.9)+oval(21,22,2.4,3.2,'#342b31')+oval(21,22,1.3,1.8,'#d84d43')+oval(21,22,.6,.9,'#251e29')+line('M29 13Q33 25 26 34','#7c452e',.7);
    }else if(action==='rasengan'){
      body=path('M20 8C29 8 33 15 33 23C33 31 27 36 20 36C12 36 7 30 7 23C7 14 12 8 20 8Z',glass,'#579fc5',.75)+path('M9 25Q12 37 24 32Q33 28 29 17Q22 7 14 16Q10 23 18 28Q25 31 27 23Q27 15 19 17Q14 20 18 24','none','#d4fcff',1.25)+line('M12 14Q24 8 28 22Q30 31 18 33M11 19Q17 10 24 18Q31 26 20 29','#4ca9da',.7)+oval(15,15,3,1.4,'#fff','transform="rotate(-35 15 15)" opacity=".85"')+path('M16 35H24L23 39H17Z',metal,'#74765c',.55)+line('M18 36H22','#fff1bf',.75);
    }else if(action==='susanoo'){
      body=path('M20 6L32 24L24 21V31L20 37L16 31V21L8 24Z')+path('M20 6L20 31L16 29V18L12 20Z','#efd1fb','none')+path('M20 6L28 21L23 18V30L20 34Z','#8255a9','none')+line('M20 10V29','#fbecff',.8)+path('M16 25L20 28L24 25V28L20 32L16 28Z','#ad83c9','#654782',.5)+line('M14 18L17 15M23 15L26 18','#dcbcf0',.7);
    }else if(action==='wooddragon'){
      body=path('M10 33Q5 24 12 21Q16 19 20 24Q27 29 29 21L24 20L24 14L21 10L27 12L30 6L31 14L35 17L32 21Q33 31 26 35Q16 41 10 33Z')+path('M11 25Q9 31 15 33Q25 38 29 29L27 33Q18 41 10 33Q6 28 11 25Z','#736135','none')+line('M12 25Q17 23 20 29Q25 33 29 26M14 32L16 29M18 34L20 31M23 34L24 31','#e3c991',.8)+path('M25 14L30 15L33 17L29 18L25 17Z','#c1b174','#6c613d',.5)+oval(29,15.7,1.1,.65,'#293c37')+line('M24 11L26 14M31 10L31 14','#f4e3b5',.8)+line('M25 20L20 22','#9e8852',1.1);
    }else if(action==='meteor'){
      body=path('M20 7C11 6 8 12 9 18C10 22 13 23 13 25C7 29 11 36 20 37C29 36 33 30 27 25C27 23 31 22 31 17C32 11 28 6 20 7Z')+path('M20 9V34M11 22Q20 26 29 22','none','#543942',1)+line('M12 14Q12 10 18 10M12 29Q11 32 17 34','#f6c0a6',.8)+tomoe(15,15,10,'#322a34')+tomoe(25,15,170,'#322a34')+tomoe(15,20,100,'#322a34')+tomoe(25,20,270,'#322a34')+tomoe(15,29,-15,'#322a34')+tomoe(25,29,165,'#322a34')+path('M18 37H22V41H18Z',metal,'#66553f',.5);
    }else if(action==='sixpaths'){
      body=path('M20 6L24 10L30 12L32 20L29 29L23 34L20 39L17 34L11 29L8 20L10 12L16 10Z')+ring(20,21,10.2,glass,'#f6dda1',.8)+ring(20,21,5.5,'#242b35','#a68548',.7)+oval(18.6,19,1.7,.8,'#838d9b','transform="rotate(-35 18.6 19)" opacity=".8"')+Array.from({length:6},(_,j)=>{const a=j*TAU/6-Math.PI/2;return ring((20+Math.cos(a)*8.1).toFixed(2),(21+Math.sin(a)*8.1).toFixed(2),1.5,'#303139','#e7c774',.45);}).join('')+line('M14 11L17 9M11 15L10 20M25 30L22 34','#fff6c9',.9);
    }else if(action==='split'){
      body=path('M10 12L14 7L20 11L26 7L30 12L28 31Q20 39 12 31Z')+path('M11 13L16 17L19 12L23 17L29 13L28 24H12Z','#efe9d5','#9a6860',.5)+path('M12 26H28L27 31Q20 35 13 31Z','#81b6d1','#557b98',.5)+oval(20,23,4.2,3.5,'#bd454b','stroke="#733449" stroke-width=".6"')+oval(18.8,21.8,1.2,.7,'#ffd7ba')+line('M14 18L17 20M23 20L26 18','#3f4052',1)+path('M15 28L17 32L20 28L23 32L25 28','none','#fff0d3',.9)+line('M12 12L14 10M28 12L26 10','#fff8df',1);
    }else if(action==='sandhook'){
      body=path('M15 36V23Q7 19 10 11Q12 5 20 6Q30 7 30 15Q29 20 24 19L22 16Q27 17 26 12Q23 7 17 11Q12 15 19 20L23 23V36Z',metal,'#715a37',.75)+path('M14 28H24V37H14Z','#496653','#293f3b',.6)+line('M15 29L23 32M15 33L23 36','#acc3a1',.7)+line('M13 11Q18 5 25 10M12 15Q12 19 16 21','#fff1bc',.9)+path('M18 25L20 23L22 25L20 27Z','#edce80','#8b703e',.5);
    }else if(action==='paw'){
      body=path('M20 7C30 7 34 16 33 25C32 34 27 38 20 38C12 38 7 32 7 23C7 14 11 7 20 7Z',glass,'#997d9b',.65)+path('M13 25Q12 21 16 21Q18 16 21 20Q26 18 28 23Q30 29 25 30Q21 28 18 30Q12 31 13 25Z','#e2b1c9','#ab789d',.65)+oval(12,18,2.1,2.7,'#f7d5e3')+oval(17,14,2.2,2.7,'#f7d5e3')+oval(24,14,2.2,2.7,'#f7d5e3')+oval(29,18,2.1,2.7,'#f7d5e3')+line('M11 20Q8 29 16 34M16 10Q22 8 27 13','#fff9ff',.9)+oval(18,23,1.5,.9,'#fff0f6');
    }else if(action==='current'){
      body=path('M22 6Q19 13 27 17Q36 23 30 33Q23 40 12 34Q5 29 10 21Q11 31 18 28Q23 25 18 22Q10 16 22 6Z',glass,'#3f879e',.7)+path('M23 13Q23 18 28 22Q33 30 25 34Q18 38 12 31Q20 35 25 29Q29 25 23 23Z','#b4f2f2','#68b3c7',.5)+line('M17 13Q13 18 20 22Q28 26 19 31M12 25Q10 29 15 32','#efffff',1)+path('M17 35H25L24 39H18Z',metal,'#6f795e',.5);
    }else if(action==='strings'){
      body=path('M20 6L24 12L31 9L29 19L35 23L28 28L29 35L22 33L20 39L16 33L9 35L11 27L5 23L12 18L9 9L17 12Z')+path('M13 18L19 20L20 16L22 20L28 18L26 25L22 26L20 23L18 26L14 25Z','#633e68','#ffe2eb',.7)+line('M12 29Q20 33 28 29','#ffdce8',1)+line('M14 28V34M17 29V36M20 28V36M23 29V35M26 28V33','#fff1fa',.55)+line('M10 12L14 17M27 12L25 16','#fff0fa',.9);
    }else if(action==='shadowcut'){
      body=path('M10 8L20 21L30 8L27 24L22 28L27 32L26 38L20 36L14 38L13 32L18 28L13 24Z')+path('M10 8L20 23L18 25L14 22Z','#c0b5d0','none')+path('M30 8L22 25L20 23L26 21Z','#8d799e','none')+ring(20,26,2,metal,'#403344',.7)+oval(15.7,33.9,2,2.8,'#242333','stroke="#bf91c1" stroke-width="1"')+oval(24.3,33.9,2,2.8,'#242333','stroke="#bf91c1" stroke-width="1"')+line('M13 14L17 20M27 14L24 20','#eee4f2',.6);
    }else if(action==='heavyglaive'){
      body=path('M17 7L23 6Q32 9 33 18L27 16L25 23L22 28V39H17V26L14 22L17 18Z')+path('M20 8L25 9L29 13L24 13L22 21L19 24Z','#eef8ef','#7c919b',.45)+path('M17 26H22V38H17Z','#495c80','#323e55',.5)+line('M17 28L22 30M17 32L22 34M17 36L22 38','#d3c597',.75)+line('M18 12V20','#a9c7d2',.7)+path('M22 26L28 28L24 30L29 34L24 33L20 28Z','#e7cf83','#987b47',.5);
    }else if(action==='iceclub'){
      body=path('M16 7Q20 5 24 7L26 26L22 29V38H18V29L14 26Z')+path('M16 8H24L25 25L21 28L16 25Z','#536575','#a4d7df',.6)+Array.from({length:4},(_,j)=>ring(17+j%2*5,11+j*4,1.2,'#d2edf0','#344954',.4)).join('')+path('M18 29H22V38H18Z','#f0e8d8','#819b9d',.5)+line('M18 30L22 32M18 34L22 36','#b66070',.75)+path('M14 25L10 28L12 34L16 29L18 31L17 26Z','#aa86bb','#685479',.6)+path('M24 25L30 22L28 30L24 32L26 26Z',glass,'#9bd4e1',.5)+line('M27 25L26 29','#efffff',.8);
    }else if(action==='futurepunch'){
      body=path('M11 22L10 16Q10 12 14 13Q13 8 17 8Q20 7 20 11Q24 7 26 12Q31 9 31 15L30 29L26 35H14L9 30L8 24Z')+line('M15 13V21M20 12V20M26 14V21','#a8777a',.7)+path('M12 23Q18 19 26 22L28 25L23 28L15 27Z','#f7dcb8','#b37e84',.6)+path('M13 31H28L26 37H15Z','#cc618e','#873654',.6)+line('M15 33L26 34M15 36H25','#f8d3dc',.8)+oval(15,15,1.1,2,'#fff4de')+ring(22,34.4,1.4,metal,'#a57957',.45);
    }else if(action==='darkquake'){
      body=path('M20 6L27 9L32 17L30 30L24 37L16 37L10 30L8 17L13 9Z',glass,'#5f5071',.7)+path('M13 19Q12 10 23 12Q33 17 26 27Q18 34 13 27Q8 20 18 17Q26 15 26 23Q24 29 18 26Q14 22 20 21','none','#d1a9e7',1.2)+path('M9 28L14 25L16 29L20 27L24 32L30 29','none','#eee0ff',.7)+path('M15 35H25V39H15Z',metal,'#61523d',.5)+ring(15,10,1.3,'#b74954','#e2c782',.45)+ring(20,8,1.3,'#608fa2','#e2c782',.45)+ring(25,10,1.3,'#87994c','#e2c782',.45)+line('M11 17L12 14M28 21L27 28','#ede0ff',.8);
    }else if(action==='thunderbagua'){
      body=path('M16 7H24L25 11L30 10L28 17L32 20L27 24L27 28L23 31V39H17V31L13 28L13 24L8 20L12 17L10 10L15 11Z')+path('M17 10H23L25 27L21 30L16 26Z','#444657','#a18daf',.55)+path('M12 12L16 15L13 18ZM28 12L24 15L27 18ZM10 21L15 20L14 24ZM30 21L25 20L26 24Z','#b6a3c9','#52425f',.5)+path('M17 32H23V39H17Z','#8772a0','#493c5a',.5)+line('M18 33L22 35M18 36L22 38','#d4bbd6',.65)+path('M22 12L18 20H22L18 27','none','#e5baf8',1);
    }else if(action==='emperorsword'){
      body=path('M18 6Q30 11 27 25L23 29V38H17V29L13 25Q20 19 18 6Z')+path('M20 10Q27 16 24 23L20 27L17 24Q23 19 20 10Z','#fff5df','#aa8599',.55)+path('M9 28L12 21L17 23L20 21L24 23L29 21L32 28L27 32L13 32Z','#de8ba8','#8c4c6d',.6)+line('M11 28Q20 25 30 28','#f4d591',1.3)+oval(16,28,1.2,.7,'#512d42')+oval(24,28,1.2,.7,'#512d42')+line('M18 30Q20 31 22 30','#fff0d9',.6)+path('M17 33H23V39H17Z',metal,'#886341',.5)+line('M20 34V38','#fff3c4',.7);
    }else if(action==='threesword'){
      body=path('M11 10L14 6L16 10V31H12ZM18 8L21 4L23 8V34H19ZM26 11L29 7L31 11V31H27Z',primary,'#37474d',.6)+line('M14 10V29M21 8V31M29 11V29','#f5faf4',.75)+line('M10 29H17M17 32H25M25 29H33','#d0aa57',1.6)+path('M12 31H16V38H12Z','#eee6c7','#787962',.5)+path('M19 34H23V41H19Z','#705087','#483b58',.5)+path('M27 31H31V38H27Z','#9e4148','#563738',.5)+line('M12 33L16 35M12 36L16 38M19 36L23 38M27 33L31 35','#d5bc85',.6);
    }else if(action==='flame'){
      body=path('M22 6Q22 13 29 17Q35 22 30 31Q24 39 14 35Q5 31 10 20L14 25Q12 15 22 6Z')+path('M21 15Q19 21 24 23L27 20Q30 32 21 34Q11 33 15 26L18 28Q17 20 21 15Z','#ffd574','#de9650',.5)+path('M21 23Q25 28 22 32Q18 34 17 30Z','#fff1bb','none')+line('M11 26Q9 31 15 33M24 14L27 18','#ffecc0',.75);
    }else if(action==='dragonclaw'){
      body=path('M13 37V15Q13 10 19 10H29V16H20V37Z',metal,'#604c3f',.8)+oval(28,13,3.2,4,'#82736c','stroke="#ead394" stroke-width=".8"')+oval(28,13,1.4,2.4,'#33424a')+path('M12 25H21V33H12Z','#354f72','#26334b',.6)+line('M14 26L19 28M14 29L19 31','#7496ad',.7)+path('M21 22Q29 23 28 31Q23 36 20 32Q23 29 21 22Z','#e8a64e','#a5663d',.6)+line('M23 26Q26 30 23 32','#ffedac',.9);
    }else if(action==='room'){
      body=path('M20 8Q32 8 32 22Q32 34 20 36Q8 34 8 22Q8 8 20 8Z')+ring(20,22,9,'#dacc63','#788462',.65)+path('M20 13V31M11 22H29','none','#506863',1.05)+line('M14 14Q8 23 15 30M25 14Q32 23 25 30','#f7f5be',.8)+ring(20,22,3.4,glass,'#477c85',.55)+oval(18.8,20.5,1,.6,'#fffef1')+path('M17 36H23V39H17Z',metal,'#71817b',.5);
    }else if(action==='stone'){
      body=path('M20 13Q13 5 9 12Q5 21 20 35Q35 21 31 12Q27 5 20 13Z')+path('M20 15Q14 9 11 15Q8 20 20 30Q29 23 28 17Q26 11 20 15Z','#dc5381','#9a355a',.55)+path('M13 13L19 15L14 21L10 18Z','#ffd5df','none')+path('M20 17L27 14L26 23L20 29L15 22Z','#ee82a5','none')+line('M8 20Q3 25 10 29L13 28M32 20Q37 25 30 29L27 28','#e9d084',1.6)+oval(9,28,.9,.65,'#493c3e')+oval(31,28,.9,.65,'#493c3e');
    }else if(action==='thunderdragon'){
      body=path('M10 12Q20 7 30 12V31Q20 37 10 31Z',metal,'#80673d',.65)+oval(20,13,10,4.5,'#fff0c0','stroke="#b89850" stroke-width=".8"')+oval(20,13,7.8,3.1,'#dfc180')+tomoe(16,13,10,'#544740')+tomoe(21,11,125,'#544740')+tomoe(24,14,240,'#544740')+path('M12 17V30Q20 34 28 30V17Q20 21 12 17Z','#bf9444','#7d663d',.5)+line('M14 19V30M26 19V30','#fae5a1',.85)+path('M21 20L17 27H21L19 32L25 25H21L24 20Z','#a6e8f5','#f0fff7',.5);
    }else if(action==='mochi'){
      body=path('M10 19Q7 11 14 10Q18 7 21 10Q26 7 30 13L29 29Q24 38 14 34Q8 31 10 19Z')+path('M10 24Q20 28 30 23L29 31Q19 37 11 31Z','#80334f','#572e43',.5)+line('M13 13Q12 17 13 20M17 11V19M23 11V18','#fffdf4',.85)+path('M12 28L15 26L15 31ZM19 30L21 27L23 31ZM26 28L28 25L29 29Z',metal,'#785960',.4)+line('M16 20Q22 17 27 20L26 23L18 24','#ba9c91',.75);
    }else if(action==='phoenixbird'){
      body=path('M20 15L8 6L10 20L5 17L9 29L16 27L14 37L20 32L26 37L24 27L31 29L35 17L30 20L32 6L22 15L24 12L21 9L18 12Z')+path('M9 10L15 18L18 24L14 24L12 19ZM31 10L25 18L22 24L26 24L28 19Z','#9aeee9','none')+path('M20 15Q15 25 20 31Q25 25 22 17Z','#e6e796','#fff4c8',.5)+line('M11 25L16 25M29 25L24 25M19 32L17 35M21 32L23 35','#d5fbeb',.8)+oval(21,14,.8,.65,'#2d6478');
    }else if(action==='rubber'||action==='nika'){
      body=path(action==='nika'?'M9 27Q5 23 10 20Q7 14 14 14Q13 8 20 10Q26 6 28 14Q34 14 31 20Q36 25 30 28L29 33Q20 39 10 32Z':'M8 25Q9 20 13 20L13 16Q13 10 20 10Q27 10 27 16V20Q33 20 33 26Q32 32 20 34Q8 32 8 25Z')+path('M8 25Q20 19 33 25Q34 31 21 33Q9 32 8 28Z',action==='nika'?'#f5efdf':primary,'#997b51',.7)+path('M13 23V17Q13 12 20 12Q27 12 27 17V23Q20 27 13 23Z',primary,'#a38b65',.55)+path('M13 21Q20 24 27 21V24Q20 28 13 24Z',action==='nika'?'#dca89a':'#b84f48','#945342',.45)+line('M12 28Q22 32 30 27M16 15L16 19M20 14V20M24 15V20',action==='nika'?'#fff':'#ffedb2',.7)+(action==='nika'?line('M11 17Q9 13 14 15M22 11Q26 8 27 13M31 19Q34 20 30 23','#fff',1):'');
    }else if(action==='haki'){
      body=path('M20 5L23 10V28L26 30L25 33H16L15 30L18 28V10Z')+path('M20 6V27L18 27V11Z','#f8f7e9','none')+path('M18 33H23V39H18Z','#983d48','#62313c',.6)+line('M18 35L23 36M18 38L23 39','#d1a874',.55)+path('M25 30Q33 21 27 15L26 17Q30 23 23 30Z',metal,'#907241',.6)+line('M21 11V26','#79858b',.55);
    }else if(action==='quake'){
      body=path('M19 7Q31 5 33 15Q29 11 27 15L26 24L22 29V39H18V28L14 24L19 20Z')+path('M21 8Q29 7 31 12Q26 10 25 17L24 23L21 25Z','#f6f7ec','none')+path('M18 28H23V37H18Z','#ad744f','#624a3c',.6)+line('M18 30H23M18 33H23M18 36H23','#e2b883',.7)+line('M21 12L20 24','#70898b',.8)+path('M15 17L12 23L15 24L12 29','none','#afdae0',1);
    }else if(action==='blackblade'){
      body=path('M20 5L23 9V17H33V22H23V39H17V22H7V17H17V9Z',metal,'#66513e',.65)+path('M20 5L22 10V29L20 32L18 29V10Z','#28313b','#565960',.55)+line('M20 7V28','#819494',.65)+path('M7 18H33V21H7Z',metal,'#97783b',.5)+ring(20,19.5,2,'#3c8981','#fae5a7',.65)+ring(9,19.5,1.05,'#975954','#e7cb84',.5)+ring(31,19.5,1.05,'#975954','#e7cb84',.5)+path('M18 31H22V38H18Z','#64323e','#402e35',.45)+line('M18 33L22 34M18 36L22 37','#b88858',.55);
    }
    if(!body)return '';
    return '<svg xmlns="http://www.w3.org/2000/svg" class="fishing-themed-float fishing-themed-float--anime" data-float-theme="'+id+'" data-float-material="'+action+'" viewBox="0 0 40 54" aria-hidden="true" focusable="false"><defs>'+
      '<linearGradient id="'+uid+'-body" x1="0" y1="0" x2="1" y2=".6"><stop stop-color="'+mat[0]+'"/><stop offset=".35" stop-color="'+mat[1]+'"/><stop offset="1" stop-color="'+mat[2]+'"/></linearGradient>'+
      '<linearGradient id="'+uid+'-metal" x1="0" y1="0" x2="1" y2=".35"><stop stop-color="#80714e"/><stop offset=".29" stop-color="#ffedbc"/><stop offset=".48" stop-color="#dfc384"/><stop offset=".70" stop-color="#a48b52"/><stop offset="1" stop-color="#e8d2a1"/></linearGradient>'+
      '<radialGradient id="'+uid+'-glass" cx=".32" cy=".26" r=".8"><stop stop-color="#f6ffff"/><stop offset=".24" stop-color="'+mat[0]+'"/><stop offset=".64" stop-color="'+mat[1]+'"/><stop offset="1" stop-color="'+mat[2]+'"/></radialGradient></defs>'+
      '<g class="fishing-float-water">'+oval(20,41,10,2,'#172f35','opacity=".16"')+oval(20,41,13.5,3.2,'none','stroke="#deefdf" stroke-width=".75" opacity=".62"')+'</g>'+
      path('M20 3V8M20 38V49','none','#655948',1.3)+body+line('M19.65 41V46','#e4c992',.65)+
      oval(20,40,2.2,1.1,'#ead39a','stroke="#7f7150" stroke-width=".45"')+line('M19.5 46V49','#514e41',.8)+'</svg>';
  }
  const floatGlyphs={
    sand:'M9 5Q14 1 19 5L17 11Q24 15 21 23Q14 28 7 23Q4 15 11 11ZM8 18Q14 21 20 18',
    lightning:'M12 3L7 12H13L9 22L22 10H16L19 3ZM4 24H24M14 22V28',
    raven:'M14 13L2 5L5 18L12 22L14 27L16 22L23 18L26 5ZM12 12L14 8L17 12',
    toad:'M5 13Q3 3 10 5L14 9L18 5Q25 3 23 13Q28 22 20 25H8Q0 22 5 13ZM7 17Q14 22 21 17',
    teleport:'M12 26V12L7 20L3 17L11 8L14 2L17 8L25 17L21 20L16 12V26ZM10 26H18',
    rasengan:'M14 3A11 11 0 1 1 3 14Q3 6 13 6Q23 6 23 14Q23 22 14 22Q7 22 7 14Q7 10 14 10Q18 10 18 14Q18 18 14 18',
    susanoo:'M8 3Q24 14 8 27L13 14ZM3 14H25L20 10M25 14L20 18',
    wooddragon:'M4 23Q3 13 12 15Q21 18 20 8L17 4L23 6L25 13Q24 26 13 22Q7 19 4 23ZM20 8L23 3',
    claybird:'M12 13L3 6L5 20L13 24L22 20L25 6L15 13L17 9L14 6L11 9ZM10 22L7 27L14 25L21 27L18 22',
    paper:'M3 7L22 3L25 22L7 27ZM3 7L15 15L22 3M15 15L7 27M15 15L25 22',
    kamui:'M14 3A11 11 0 1 1 3 14Q4 5 14 6Q24 7 21 17Q17 25 9 20Q3 15 11 11Q18 7 18 15Q17 21 13 17Q10 13 14 13',
    meteor:'M7 3L2 7L7 10L4 17L9 25L18 27L25 20L24 12L18 7L10 9ZM10 10L16 14L11 20M16 14L22 15',
    sixpaths:'M14 5A9 9 0 1 0 14 23A9 9 0 1 0 14 5ZM14 9L18 14L14 19L10 14ZM3 3H5V5H3ZM23 3H25V5H23ZM2 23H5V26H2ZM23 23H26V26H23',
    threesword:'M4 25V5L7 2V25ZM12 27V7L15 4V27ZM20 25V5L23 2V25M2 20H25',
    flame:'M14 2Q17 9 23 14Q27 25 14 27Q1 25 5 14L9 19Q7 9 14 2ZM14 12Q10 19 14 23Q19 20 14 12',
    dragonclaw:'M4 25L5 12L10 3L9 16L14 22L15 9L20 2L18 20L24 12L26 8L25 24L15 28Z',
    room:'M14 3A11 11 0 1 1 14 25A11 11 0 1 1 14 3ZM6 14H22M14 6V22M10 4Q3 14 10 24M18 4Q25 14 18 24',
    stone:'M14 9Q3-1 3 10Q3 16 14 25Q25 16 25 10Q25-1 14 9ZM8 25H20L23 28H5Z',
    thunderdragon:'M4 4H12L8 11L20 8L14 16L25 14L18 24L10 26L4 21L8 17L8 22L15 21L18 17L8 18L12 12L3 14Z',
    mochi:'M4 25L3 13L6 8L10 12V4L14 3V12L17 4L21 5L20 13L24 10L26 13L23 24L15 28Z',
    phoenixbird:'M14 12L3 2L6 17L1 14L6 24L12 20L9 28L14 24L19 28L16 20L22 24L27 14L22 17L25 2ZM12 11L14 6L17 11',
    rubber:'M4 17Q14 12 24 17L25 20Q14 25 3 20ZM8 16V10Q14 4 20 10V16M8 14Q14 17 20 14',
    haki:'M6 26L6 6L9 2L10 25ZM3 20H14M16 4L14 12L21 10L17 18L25 15L21 25',
    quake:'M13 28V4H16V28ZM14 4Q23 1 25 7Q21 4 19 10L17 18L11 22L9 19L13 12ZM3 10L7 13L3 18',
    blackblade:'M12 28V4L14 1L16 4V28ZM2 9H26V13H2ZM5 8V14M23 8V14',
    nika:'M7 15Q5 9 10 8Q10 2 16 5Q23 1 23 9Q28 13 22 17ZM4 17Q14 12 24 17L25 20Q14 26 3 20ZM9 15V11Q14 7 19 11V15'
  };
  function bobber(id){const s=entries[id];if(!s)return null;const action=s.action;if(floatGlyphs[action])return floatGlyphs[action];
    if(['rubber','nika'].includes(action))return'M5 16Q14 11 23 16L24 19Q14 24 4 19ZM8 15V10Q14 5 20 10V15M8 14Q14 17 20 14';
    if(['rasengan','sixpaths','kamui','rotation'].includes(action))return'M14 5A10 10 0 1 1 5 14Q5 8 13 8Q20 8 20 14Q20 20 14 20Q9 20 9 14Q9 11 14 11Q17 11 17 14';
    if(['raven','paper','claybird','phoenixbird','icebird'].includes(action))return'M14 15L3 7L7 20L14 24L21 20L25 7ZM14 15V24M12 15L14 10L17 15';
    if(['room','lightning','weather','teleport'].includes(action))return'M17 3L6 16H13L10 27L23 12H16Z';
    if(['threesword','blackblade','susanoo','haki'].includes(action))return'M9 26L9 5L12 2L12 26ZM16 26L16 8L19 5L19 26M5 21H23';
    if(['sand','sandhook','woodcage','wooddragon'].includes(action))return'M8 6Q14 1 20 6L18 11Q25 17 20 24Q14 29 8 24Q3 17 10 11Z';
    return'M14 4Q21 7 21 14Q21 22 14 26Q7 22 7 14Q7 7 14 4ZM10 12L14 8L18 12L14 20Z';
  }
  return{entries,designs,scenes,spells,presentation,cleanDurations,duration,narutoTechniques,floatMaterials,has,visible,timeline,handRig,rubberCatch,catchPose,draw,bobber,detailedBobber};
});
