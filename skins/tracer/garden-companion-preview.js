(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./garden-companion-motion'):root.TracerGardenCompanionMotion);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerGardenCompanionPreview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Motion){
  'use strict';
  const labels={idle:['发呆眨眼','Idle & blink'],greet:['挥手问好','Say hello'],walk:['散步','Walk'],hop:['轻轻跳跃','Hop'],water:['浇水','Water'],pet:['享受摸摸','Enjoy a pat'],music:['随音乐摇摆','Dance'],celebrate:['开心庆祝','Celebrate'],rest:['安静休息','Rest'],focus:['陪伴专注','Focus'],breeze:['迎着微风','Feel the breeze'],stretch:['伸个懒腰','Stretch'],look:['好奇张望','Look around'],shy:['有点害羞','Feel shy'],eat:['吃点心','Have a snack'],thanks:['表达感谢','Say thanks']};
  function create(host,options={}){
    Object.assign(labels,{feed:['吃点心','Have a snack'],play:['玩耍','Play'],sleep:['睡觉','Sleep'],wake:['醒来伸展','Wake & stretch'],drag:['轻轻提起','Picked up'],fishing:['钓鱼','Fishing'],exercise:['锻炼','Exercise'],farming:['种植','Gardening'],mining:['采矿','Mining'],reading:['阅读','Reading'],writing:['写字','Writing'],crafting:['手作','Crafting'],tea:['喝茶','Tea']});
    const doc=host.ownerDocument,details=doc.createElement('details'),summary=doc.createElement('summary'),controls=doc.createElement('div'),label=doc.createElement('label'),select=doc.createElement('select'),button=doc.createElement('button'),status=doc.createElement('p');
    details.className='garden-companion-preview';controls.className='garden-companion-preview-controls';button.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');label.appendChild(select);controls.appendChild(label);controls.appendChild(button);details.appendChild(summary);details.appendChild(controls);details.appendChild(status);host.appendChild(details);
    let player=null,language='zh',key='',dead=false,revision=0,blocked=false;
    const tr=(zh,en)=>language==='zh'?zh:en;
    function play(event){
      event?.stopPropagation();if(dead||blocked||options.isBlocked?.()||!player)return;
      options.beforePlay?.();const version=++revision,action=select.value;
      const accepted=player.preview?.(action,()=>{if(!dead&&version===revision)status.textContent=tr('这一小段结束啦。','That little moment is complete.');});
      status.textContent=accepted?tr('正在预览：','Previewing: ')+(labels[action]?.[language==='zh'?0:1]||action):tr('伙伴正在忙，稍后再试一下。','Your companion is busy. Try again in a moment.');
    }
    button.addEventListener('click',play);
    return{
      element:details,
      update(value={}){
        if(dead)return;const changed=player!==value.player;player=value.player;language=value.language||'zh';blocked=!!value.blocked;
        const available=player?.availableActions?.()||[],enabled=new Set(available),garden=/^garden_(wildflower|sunflower|lavender|apple|peach|cherry|neon_orchid|volt_berry|crystal_tree)(?:_shiny)?$/.test(value.pet?.id||''),visible=garden||(!value.pet?.custom&&available.length>0);
        details.hidden=!visible;if(!visible)return;
        const next=language+':'+(garden?'garden':'builtin')+':'+available.join(',');if(changed||next!==key){
          revision++;key=next;const chosen=select.value;select.replaceChildren();
          for(const action of garden?Motion.actions:available){const item=doc.createElement('option');item.value=action;item.disabled=!enabled.has(action);item.textContent=(labels[action]?.[language==='zh'?0:1]||action)+(item.disabled?tr(' · 暂不可用',' · unavailable'):'');select.appendChild(item);}
          select.value=enabled.has(chosen)?chosen:available[0]||'idle';status.textContent='';
        }
        summary.textContent=tr('伙伴动作','Companion movements');select.setAttribute('aria-label',tr('选择想看的动作','Choose a movement'));button.textContent=tr('预览','Preview');button.disabled=blocked||!available.length;select.disabled=!available.length;
        if(blocked){revision++;status.textContent=tr('休息或专注结束后，再来看看小动作。','Explore movements after resting or focusing.');}
        else if(changed||status.textContent===tr('休息或专注结束后，再来看看小动作。','Explore movements after resting or focusing.'))status.textContent=tr('选择一个动作，看看伙伴的小习惯。','Choose a movement to discover a little habit.');
      },
      destroy(){if(dead)return;dead=true;revision++;player=null;button.removeEventListener('click',play);details.remove();}
    };
  }
  return{create,labels};
});
