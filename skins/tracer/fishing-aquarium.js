(function(root){
  'use strict';
  const A=root.TracerFishingArt;
  const defaultDecorations=['water_grass','pebble_garden'];
  let serial=0;
  function decorationMarkup(id){
    const uid='aquarium-prop-'+(++serial),fill=name=>'url(#'+uid+'-'+name+')';
    const shapes={
      water_grass:'<path d="M57 99C23 83 48 54 25 29C67 41 44 78 57 99Z" fill="'+fill('leaf')+'"/><path d="M63 101C43 72 79 42 68 8C96 43 62 78 63 101Z" fill="'+fill('leaf')+'"/><path d="M64 101C62 70 95 74 99 43C119 75 75 90 64 101Z" fill="'+fill('leaf')+'"/><path d="M48 102C21 92 30 67 13 57C42 62 41 88 48 102Z" fill="#69a990"/><path d="M56 98Q44 61 30 39M63 98Q74 52 70 24M65 99Q86 74 96 55" fill="none" stroke="#d6efb5" stroke-opacity=".4"/><ellipse cx="60" cy="104" rx="28" ry="8" fill="'+fill('stone')+'"/>',
      pebble_garden:'<path d="M10 95Q8 73 33 70Q60 65 66 92Q57 107 20 104Z" fill="'+fill('stone')+'"/><path d="M49 96Q42 53 69 45Q98 48 99 90Q85 111 49 96Z" fill="'+fill('stone')+'"/><path d="M75 105Q74 85 96 82Q116 84 115 101Q100 112 75 105Z" fill="'+fill('stone')+'"/><path d="M55 59Q67 50 81 56M17 82Q28 75 39 78M83 91Q97 85 105 91" fill="none" stroke="#e4e6cf" stroke-opacity=".45" stroke-width="2"/><path d="M17 98Q27 89 40 97M55 94Q67 88 77 96" fill="none" stroke="#658e72" stroke-width="4" stroke-linecap="round"/>',
      pearl_shell:'<path d="M18 82Q1 52 24 51Q19 29 40 36Q47 11 60 32Q81 15 87 40Q111 34 105 59Q124 76 100 89L63 100Z" fill="'+fill('shell')+'" stroke="#e6cdb8" stroke-width="1.5"/><path d="M61 91L25 53M62 91L41 39M63 91L60 35M64 91L86 43M65 92L103 61" fill="none" stroke="#bc899e" stroke-opacity=".6" stroke-width="2"/><path d="M15 88Q60 65 107 88Q98 112 60 114Q25 111 15 88Z" fill="'+fill('shell')+'" stroke="#eccfc0"/><ellipse cx="63" cy="95" rx="30" ry="9" fill="#967fa4" opacity=".5"/><circle cx="63" cy="80" r="16" fill="'+fill('pearl')+'"/><circle cx="58" cy="73" r="3.5" fill="#fffceb" opacity=".85"/><path d="M26 96Q60 114 96 96" fill="none" stroke="#f4e7cb" stroke-width="2"/>',
      jade_arch:'<path d="M15 106V60C15 7 105 7 105 60V106H81V61C81 35 39 35 39 61V106Z" fill="'+fill('jade')+'" stroke="#b0d4b2" stroke-width="1.5"/><path d="M23 99V60C23 18 97 18 97 60V99M34 61C34 27 86 27 86 61" fill="none" stroke="#d9ce97" stroke-width="2"/><path d="M21 77L32 70L21 63M98 77L88 70L98 63" fill="none" stroke="#d9ce97"/><path d="M8 103H45V113H8ZM76 103H112V113H76Z" fill="'+fill('gold')+'"/><circle cx="60" cy="28" r="6" fill="'+fill('pearl')+'"/><path d="M15 56L20 51M98 94L103 90M32 91L36 87" stroke="#356f6a" stroke-width="2"/>',
      moon_crystal:'<path d="M36 102L29 42L48 13L70 45L63 105Z" fill="'+fill('crystal')+'" stroke="#c6e6ed"/><path d="M48 13L46 96L63 105L70 45Z" fill="#94aaca" opacity=".6"/><path d="M13 105L9 69L23 46L40 75L36 110Z" fill="'+fill('crystal')+'" stroke="#acd9d6"/><path d="M69 107L72 68L94 44L104 77L92 114Z" fill="'+fill('crystal')+'" stroke="#c2d7ef"/><path d="M48 24L44 81M23 55L20 94M92 53L78 96" stroke="#f4f6e8" stroke-opacity=".65" stroke-width="2"/><ellipse cx="58" cy="110" rx="49" ry="6" fill="#94b5a6"/><path d="M92 18Q78 26 92 34Q70 34 77 20Q82 13 92 18Z" fill="'+fill('gold')+'"/>',
      sunken_chest:'<path d="M21 62L80 50L107 67L101 104L38 114L18 97Z" fill="'+fill('wood')+'" stroke="#d2ad73"/><path d="M20 64Q14 34 36 30L88 25Q107 31 107 65L81 50Z" fill="'+fill('wood')+'" stroke="#bca875" stroke-width="2"/><path d="M35 33Q49 39 48 57M86 28Q99 34 96 58M38 73L36 108M83 63L81 105" fill="none" stroke="'+fill('gold')+'" stroke-width="7"/><path d="M28 62L81 52L100 63L40 76Z" fill="#344f4d"/><g fill="'+fill('gold')+'"><ellipse cx="48" cy="63" rx="10" ry="4"/><ellipse cx="66" cy="60" rx="10" ry="4"/><ellipse cx="79" cy="62" rx="9" ry="4"/></g><path d="M55 60L63 48L71 60L63 69Z" fill="'+fill('jade')+'"/><path d="M49 85L67 82V96L49 99Z" fill="'+fill('gold')+'"/><circle cx="58" cy="90" r="2" fill="#36504c"/><path d="M44 104L73 99M24 83L33 87M53 40L76 36" stroke="#3d5750" stroke-opacity=".5"/>'
    };
    Object.assign(shapes,{
      glass_observatory:'<ellipse cx="60" cy="100" rx="37" ry="11" fill="'+fill('gold')+'"/><path d="M23 92V57C23 1 97 1 97 57V92Q60 112 23 92Z" fill="'+fill('crystal')+'" fill-opacity=".23" stroke="#bfddd2" stroke-width="2"/><path d="M29 87Q60 101 91 87L91 96Q60 110 29 96Z" fill="'+fill('gold')+'"/><ellipse cx="60" cy="88" rx="28" ry="7" fill="'+fill('stone')+'"/><path d="M68 39C43 37 34 70 62 76C42 56 68 39 68 39Z" fill="'+fill('gold')+'"/><path d="M61 75V86" stroke="#d8c28e" stroke-width="3"/><ellipse cx="58" cy="60" rx="25" ry="12" transform="rotate(-32 58 60)" fill="none" stroke="#a8c4ba" stroke-width="1.5"/><path d="M34 78V51Q35 32 47 26" fill="none" stroke="#eef6e4" stroke-opacity=".72" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="17" r="4" fill="'+fill('gold')+'"/><g fill="#e7d6a1"><path d="M42 83l2-5 2 5 5 1-5 2-2 5-2-5-5-2Z"/><path d="M76 80l1-4 2 4 4 2-4 1-2 4-1-4-4-1Z"/></g>',
      jade_koi_seal:'<ellipse cx="60" cy="101" rx="35" ry="11" fill="#436e61"/><path d="M25 86Q60 72 95 86V100Q60 118 25 100Z" fill="'+fill('jade')+'" stroke="#aad0ad"/><ellipse cx="60" cy="85" rx="35" ry="11" fill="'+fill('jade')+'"/><path d="M27 95Q60 109 93 95" fill="none" stroke="#d0bd8a" stroke-width="2"/><path d="M37 74C13 43 42 15 67 24C94 31 97 60 78 77C83 55 69 42 57 47C44 52 46 65 37 74Z" fill="'+fill('jade')+'" stroke="#b8d7ab" stroke-width="1.3"/><path d="M57 26Q63 12 73 18L71 35M33 62L16 65 24 75 37 75" fill="'+fill('jade')+'" stroke="#d4dcbc"/><path d="M66 38Q80 35 83 47L77 54Q72 42 66 38ZM39 43Q44 38 49 45M46 35Q51 30 56 38M55 30Q61 27 65 35" fill="none" stroke="#477e6b" stroke-width="1.5"/><circle cx="83" cy="58" r="3" fill="#d4c594"/><circle cx="84" cy="58" r="1.5" fill="#284f42"/><circle cx="78" cy="83" r="7" fill="'+fill('pearl')+'"/><path d="M32 91q4-5 8 0t8 0M67 96q5-5 10-2t9-2" fill="none" stroke="#d2c48e"/>',
      sunken_astrolabe:'<path d="M30 98Q45 94 50 84L54 71H66L69 84Q75 96 89 99L87 107H32Z" fill="'+fill('gold')+'" stroke="#789587"/><ellipse cx="60" cy="103" rx="28" ry="7" fill="'+fill('gold')+'"/><circle cx="60" cy="48" r="32" fill="none" stroke="#a7986c" stroke-width="5"/><circle cx="60" cy="48" r="32" fill="none" stroke="#d4c594" stroke-width="1"/><ellipse cx="60" cy="48" rx="28" ry="12" transform="rotate(-33 60 48)" fill="none" stroke="#7bada1" stroke-width="3"/><ellipse cx="60" cy="48" rx="15" ry="25" transform="rotate(-33 60 48)" fill="none" stroke="#d5bc80" stroke-width="2.5"/><path d="M60 9V89M25 48h6M89 48h6M60 16v6M60 74v6M36 25l4 5M80 67l4 5M36 71l4-4M80 30l4-5" stroke="#e7ce90" stroke-width="2"/><circle cx="60" cy="48" r="6" fill="'+fill('pearl')+'"/><circle cx="60" cy="10" r="4" fill="'+fill('gold')+'"/><path d="M33 48q0-16 11-24M76 103l8-3M37 96l9-1" stroke="#548a7d" stroke-width="2" fill="none"/>',
      coral_conch:'<ellipse cx="61" cy="101" rx="41" ry="11" fill="'+fill('stone')+'"/><g fill="none" stroke-linecap="round"><path d="M34 94Q24 68 30 41M29 68Q15 59 17 49M30 56Q42 47 41 32M81 93Q88 65 81 44M86 73Q103 61 100 48M83 59Q71 48 75 36" stroke="#c8979c" stroke-width="6"/><path d="M34 94Q26 72 29 46M83 91Q89 65 82 48" stroke="#e4bcad" stroke-width="2"/></g><path d="M42 88C19 66 41 38 62 40C95 42 109 70 89 90C76 103 51 105 43 87C37 71 48 59 60 62C74 66 73 81 63 84C55 87 51 77 57 74" fill="'+fill('shell')+'" stroke="#eedbc1" stroke-width="3"/><path d="M64 44q-9 4-10 10M79 50q-7 3-9 11M90 62q-8 1-13 9M47 48q-3 6-2 10" stroke="#b99594" stroke-width="1.5" fill="none"/><ellipse cx="82" cy="88" rx="11" ry="15" transform="rotate(33 82 88)" fill="#987984" stroke="#eccfbc" stroke-width="4"/><circle cx="39" cy="101" r="3" fill="'+fill('pearl')+'"/><circle cx="47" cy="104" r="2" fill="'+fill('pearl')+'"/>',
      porcelain_pagoda:'<path d="M31 107L39 94 46 40H74L81 94 89 107Q60 117 31 107Z" fill="'+fill('jade')+'" stroke="#c4dac4"/><path d="M38 95Q60 101 82 95M44 50Q60 55 76 50" fill="none" stroke="#d9d8b0" stroke-width="3"/><path d="M48 44V24H72V44" fill="'+fill('crystal')+'" fill-opacity=".45" stroke="#bfcaae"/><path d="M48 24V44M72 24V44M59 24V44" stroke="#d0bd8d" stroke-width="2"/><circle cx="60" cy="35" r="6" fill="'+fill('pearl')+'"/><path d="M30 27Q53 23 60 8Q66 21 90 27Q60 37 30 27Z" fill="'+fill('jade')+'"/><path d="M30 27Q60 39 90 27" stroke="#c3d4b8" stroke-width="2" fill="none"/><circle cx="60" cy="8" r="3" fill="'+fill('gold')+'"/><path d="M53 94V83Q60 73 67 83V94" fill="#457569" stroke="#c1d0ae" stroke-width="2"/><path d="M43 65q5-6 10 0t11 0t11 0M44 69q5-6 10 0t11 0t10 0" fill="none" stroke="#578d7c" stroke-width="1.2"/>',
      ribbon_jellyfish:'<ellipse cx="60" cy="105" rx="29" ry="8" fill="'+fill('jade')+'"/><path d="M75 103C101 80 100 28 81 15C72 9 62 13 60 22" fill="none" stroke="#bac5a3" stroke-width="3"/><path d="M60 21V34" stroke="#d7dfc9"/><path d="M31 55C30 23 87 24 89 55Q82 64 74 58Q67 65 60 59Q51 64 45 58Q37 65 31 55Z" fill="'+fill('crystal')+'" fill-opacity=".58" stroke="#d1e7dc" stroke-width="1.5"/><path d="M38 47Q45 31 56 34" fill="none" stroke="#f1f6e8" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="60" cy="49" rx="9" ry="5" fill="#d9bbd3" opacity=".65"/><g fill="none" stroke-width="2" stroke-linecap="round"><path d="M41 60C54 75 34 85 47 94M56 60C46 73 65 89 58 98M72 60C83 74 59 85 72 95" stroke="#bdc7d5"/><path d="M48 59C64 73 46 85 54 93M65 61C55 77 78 81 65 97M80 60C88 75 74 80 82 87" stroke="#c8d9c6"/></g><path d="M38 107Q60 115 83 107" stroke="#d0cca9" fill="none"/>'
    });
    if(!shapes[id])return '';
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><defs>'+Object.entries({leaf:['#d0e5a4','#4b987f','#306d6e'],stone:['#cdd1b7','#829b91','#496f73'],shell:['#fff0d9','#d6b2c5','#8e789b'],pearl:['#ffffe9','#e8dbd9','#9db6c1'],jade:['#c6e4bd','#70b39f','#377c77'],gold:['#f5df9b','#c3a66b','#797c5e'],crystal:['#e6f7f5','#aec2e4','#739eae'],wood:['#bdab7d','#8f805f','#426664']}).map(([key,c])=>'<radialGradient id="'+uid+'-'+key+'" cx="30%" cy="22%" r="90%"><stop stop-color="'+c[0]+'"/><stop offset=".5" stop-color="'+c[1]+'"/><stop offset="1" stop-color="'+c[2]+'"/></radialGradient>').join('')+'</defs><ellipse cx="60" cy="111" rx="49" ry="6" fill="#123e4e" opacity=".18"/>'+shapes[id]+'</svg>';
  }
  function create(host,options={}){
    const scene=host.ownerDocument.createElement('div');scene.className='fishing-aquarium-scene'+(options.compact?' is-compact':'');scene.setAttribute('role','img');host.appendChild(scene);
    const normalizeYaw=value=>Number.isFinite(value)?((value%360+540)%360)-180:0;
    let renderers=[],volume=null,volumeAttempted=false,signature='',disposed=false,yaw=normalizeYaw(options.yaw),boundsSignature='',feedingAccount='',residents=new Map(),feedReceipts=new Map(),activeFeeding=null,activeFeedingAt=0;
    function accountKey(value,view){const account=root.TracerAccount;return JSON.stringify([view.accountScope??value.accountScope??account?.scope??'guest',view.accountGeneration??value.accountGeneration??account?.context?.generation??0,view.accountRestoreId??value.accountRestoreId??account?.context?.restoreId??'']);}
    function recentFeeding(fish){
      // Keep receipt history separate from the displayed snapshot: a late update
      // must still render, but must not replay a feeding or maturity effect.
      const now=Date.now(),recent=[],grown=[],next=new Map();
      for(const f of fish){
        const fedAt=Number(f.fedAt)||0,updatedAt=Number(f.updatedAt)||0,growth=Math.max(0,Math.min(100,Number(f.growth==null?100:f.growth)||0)),previous=residents.get(f.id),seen=feedReceipts.get(f.id)||0,stale=previous&&(fedAt<previous.fedAt||updatedAt<previous.updatedAt);
        if(!stale&&fedAt>seen&&now-fedAt>=-1000&&now-fedAt<5000){recent.push(f);if(previous&&previous.growth<100&&growth>=100)grown.push(f.id);}
        feedReceipts.set(f.id,Math.max(seen,fedAt));next.set(f.id,stale?previous:{growth,fedAt,updatedAt});
      }
      residents=next;return recent.length?{at:Math.max(...recent.map(f=>f.fedAt)),fishIds:recent.map(f=>f.id),grownFishIds:grown}:undefined;
    }
    function activeFeed(){if(activeFeeding&&Date.now()-activeFeedingAt>=4800)activeFeeding=null;return activeFeeding;}
    function retainFeed(value){activeFeeding=value;activeFeedingAt=Number.isFinite(Number(value.at))&&Number(value.at)>0?Number(value.at):Date.now();}
    function clear(){for(const renderer of renderers)renderer.destroy();renderers=[];}
    function syncBounds(bounds){
      if(disposed||!volume)return;
      bounds=bounds||volume.getAquariumBounds?.();
      const key=JSON.stringify(bounds);if(key===boundsSignature)return;boundsSignature=key;
      for(const part of ['tank','base']){
        const box=bounds?.[part],hit=scene.querySelector('.fishing-aquarium-'+part);
        if(box&&hit)for(const field of ['left','top','width','height'])if(Number.isFinite(box[field]))hit.style[field]=box[field]*100+'%';
      }
      options.onBoundsChange?.(bounds);
    }
    function update(value,language='zh',view={}){
      if(disposed||!value)return;const en=language==='en',label=item=>Array.isArray(item?.name)?item.name[en?1:0]:item?.name||'',fish=(value.fish||[]).filter(f=>f.rarity==='legendary').slice(0,3);
      const decorations=(value.selection?.decorationIds||defaultDecorations).filter(id=>root.TracerFishingModel.catalog.aquariumDecorations.some(d=>d.id===id)).slice(0,3);
      if(Object.hasOwn(view,'yaw'))yaw=normalizeYaw(view.yaw);
      const account=accountKey(value,view);if(account!==feedingAccount){feedingAccount=account;residents.clear();feedReceipts.clear();activeFeeding=null;}
      const key=JSON.stringify([fish,language,decorations,yaw,account]);if(key===signature)return;signature=key;scene.dataset.count=fish.length;scene.dataset.decorations=JSON.stringify(decorations);
      scene.setAttribute('aria-label',(en?'Legendary aquarium: ':'传奇水族箱：')+(fish.length?fish.map(label).join('、'):en?'A glass aquarium awaiting legendary residents':'等待传奇住客入住的玻璃水族箱'));
      const feeding=recentFeeding(fish);if(feeding)retainFeed(feeding);
      const settings={fish,aquariumDecorations:decorations,language,feeding,aquariumYaw:yaw,onBoundsChange:syncBounds};
      // Fish, ornaments, water and glass share depth and lighting in one scene.
      // Changing residents or decorations keeps its GPU context alive.
      if(!volumeAttempted){
        volumeAttempted=true;
        if(A.createAquarium){
          const mount=host.ownerDocument.createElement('div');mount.className='fishing-aquarium-volume';scene.appendChild(mount);
          volume=A.createAquarium(mount,settings);
          if(volume){
            scene.dataset.renderer='webgl';
            for(const part of ['tank','base']){const hit=host.ownerDocument.createElement('div');hit.className='fishing-aquarium-'+part;hit.setAttribute('aria-hidden','true');scene.appendChild(hit);}
          }else mount.remove();
        }
      }
      if(volume){
        volume.update(settings);
        syncBounds();
        return;
      }
      // A committed growth snapshot can replace figures after an explicit feed.
      // Keep its original timestamp so replacement figures resume the remaining
      // reaction instead of losing the celebration or starting it again.
      const fallbackFeeding=activeFeed();scene.dataset.renderer='fallback';clear();
      scene.innerHTML='<div class="fishing-aquarium-shadow"></div><div class="fishing-aquarium-lid"><i></i><span>✦</span></div><div class="fishing-aquarium-tank"><div class="fishing-aquarium-water"></div><div class="fishing-aquarium-sand"></div><div class="fishing-aquarium-bubbles"><i></i><i></i><i></i></div>'+fish.map((f,i)=>'<div class="fishing-aquarium-specimen specimen-'+i+'" title="'+A.escape(label(f))+'"><div data-specimen="'+i+'"></div></div>').join('')+(!fish.length?'<div class="fishing-aquarium-empty"><b>✧</b><span>'+A.escape(en?'A home for your legends':'等待传奇住客入住')+'</span><small>'+A.escape(en?'Move a legendary fingerling into your aquarium':'从育养箱选一条传奇鱼放入这里')+'</small></div>':'')+'<div class="fishing-aquarium-glass"></div></div><div class="fishing-aquarium-base"><span>'+A.escape(en?'Legendary aquarium':'传奇水族箱')+'</span><small>'+A.escape(en?'WONDERS BELOW THE WATER':'珍藏水下奇遇')+'</small><i></i></div><div class="fishing-aquarium-feet"><i></i><i></i></div>';
      const decor=host.ownerDocument.createElement('div');decor.className='fishing-aquarium-decorations';decor.dataset.count=decorations.length;
      decor.innerHTML=decorations.map((id,i)=>'<div class="fishing-aquarium-decoration" data-aquarium-decoration="'+id+'" style="--slot:'+i+'">'+decorationMarkup(id)+'</div>').join('');
      scene.querySelector('.fishing-aquarium-sand').after(decor);
      for(let i=0;i<fish.length;i++){const mount=scene.querySelector('[data-specimen="'+i+'"]');if(A.createFishFigure){const renderer=A.createFishFigure(mount,{fish:fish[i]});renderers.push(renderer);if(fallbackFeeding?.fishIds.includes(fish[i].id))renderer.update({feeding:{...fallbackFeeding,fishIds:[fish[i].id],grownFishIds:fallbackFeeding.grownFishIds.filter(id=>id===fish[i].id)}});}else mount.innerHTML=A.fishMarkup(fish[i]);}
    }
    return {update,feed(value){
      if(disposed||!value)return;const at=Number(value.at),ids=value.fishIds||[...residents.keys()],fresh=Number.isFinite(at)&&at>0?ids.filter(id=>at>(feedReceipts.get(id)||0)):ids;
      if(ids.length&&!fresh.length)return;const feeding={...value,fishIds:fresh,grownFishIds:(value.grownFishIds||[]).filter(id=>fresh.includes(id))};
      for(const id of fresh)if(Number.isFinite(at)&&at>0)feedReceipts.set(id,at);retainFeed(feeding);volume?.feed(feeding);for(const renderer of renderers)renderer.update({feeding});
    },destroy(){if(disposed)return;disposed=true;activeFeeding=null;volume?.destroy();volume=null;clear();scene.remove();}};
  }
  root.TracerFishingAquariumArt={create,decorationMarkup,defaultDecorations};
})(typeof window!=='undefined'?window:globalThis);
