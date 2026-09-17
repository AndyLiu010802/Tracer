(function () {
  'use strict';
  window.TracerPetView = function (root, dispatch, desktop = false, restoredChat = null) {
    let snapshot, language = '', selected = '', tab = 'care', expanded = !desktop, conversation = [], sending = false, generation = 0, chatController, drag=null, suppressClick=false, feedbackKey='', sizeOpen=false, messageKey='', messageUntil=0;
    const idle = TracerPetIdle.create();
    let characterAnimation = null;
    let chatDraft = '', draftRevision = 0, messageSequence = 0, composing = false;
    const tr = (zh,en) => language === 'zh' ? zh : en;
    const find = selector => root.querySelector(selector);
    const text = (selector,value) => { const el=find(selector); if(el) el.textContent=value; };
    function pauseIdle() { idle.reset(); root.dataset.idle=''; syncAnimation(); }
    function syncAnimation() {
      if (!snapshot) return;
      const action = drag?.moved ? 'drag' : snapshot.needs.sleeping ? 'sleep' : root.dataset.action || (snapshot.focus.running ? 'focus' : root.dataset.idle || 'idle');
      root.dataset.behavior=action;
      characterAnimation?.setAction(action);
    }
    function icon(type) {
      const paths={feed:'<path d="M3 12h18l-3 7H6zM8 8V5m4 3V3m4 5V5"/>',play:'<circle cx="12" cy="12" r="8"/><path d="m9 5 3 7 7 3M5 15l7-3 4-7"/>',sleep:'<path d="M19 14A8 8 0 0 1 10 4a8 8 0 1 0 9 10Z"/>','focus-toggle':'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',size:'<path d="M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5M4 4l5 5m11 11-5-5"/>',expand:'<path d="M5 6h14M5 12h14M5 18h14"/><path d="M9 4v4m6 2v4m-5 2v4"/>'};
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[type]+'</svg>';
    }
    function toggleSize(open) {
      sizeOpen=open; root.classList.toggle('is-size-open',open);
      const popup=find('.pet-size-popover'); if(popup) popup.hidden=!open;
      find('[data-quick-act=size]')?.setAttribute('aria-expanded',String(open));
    }
    const blurSize=()=>{if(sizeOpen)toggleSize(false);};
    if(desktop) window.addEventListener('blur',blurSize);
    function art(pet, animated = false) {
      if(pet.custom && /^\/api\/pet-art\/[a-f0-9]{32}\.png$/.test(pet.image)) {
        if (TracerPetAnimation.normalize(pet.animation)) {
          const player = TracerPetAnimation.create({ image:pet.image, animation:pet.animation, label:language==='zh'?pet.zh:pet.en, animated });
          if (animated) characterAnimation = player;
          return player.element;
        }
        const img=document.createElement('img'); img.className='pet-sprite pet-custom-sprite'; img.src=pet.image; img.alt=language==='zh'?pet.zh:pet.en; return img;
      }
      const player=TracerPetBuiltinAnimation.create({pet,label:language==='zh'?pet.zh:pet.en,animated});
      if(animated)characterAnimation=player;
      return player.element;
    }
    function effectLayer(pet) {
      const layer=document.createElement('span'); layer.className='pet-effects'; layer.setAttribute('aria-hidden','true');
      layer.innerHTML='<svg class="pet-food-prop" viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#7fac75" d="M16 3h3v7h-3zM19 3h7v4h-7z"/><path fill="#e6a25d" d="M7 10h19v4h3v11h-4v4H8v-4H4V14h3z"/><path fill="#f8d58b" d="M8 13h5v10H8z"/><path fill="#ac674d" d="M7 25h19v4H9z"/></svg>'
        +'<svg class="pet-ball-prop" viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#85b8d0" d="M9 3h14v4h5v5h3v11h-5v5H9v-4H4V9h5z"/><path fill="#f3d88d" d="M12 3h7v10h12v7H19v8h-7V20H4v-7h8z"/></svg>'
        +'<span class="pet-heart pet-heart-one">♥</span><span class="pet-heart pet-heart-two">♥</span><span class="pet-play-star">✦</span><span class="pet-rest-cloud">Zzz</span>';
      const food={
        sprout:'<path fill="#f0d69e" d="M5 14h22v4H5z"/><path fill="#b4ccb0" d="M3 17h26v6h-4v5H7v-5H3z"/><path fill="#657f62" d="M9 24h14v4H9z"/><path fill="#fff1c7" d="M8 11h4v4H8zM15 12h4v4h-4zM21 10h3v5h-3z"/>',
        miso:'<path fill="#e5ad78" d="M3 12h6V8h12v4h5l5-5v18l-5-5h-5v4H9v-4H3z"/><path fill="#f5d79e" d="M6 13h16v6H6z"/><path fill="#64554a" d="M7 12h3v3H7zM15 11h2v10h-2z"/>',
        brook:'<path fill="#79b7c8" d="M3 12h5V8h13v4h4l6-5v18l-6-5h-4v4H8v-4H3z"/><path fill="#d9e7d9" d="M4 16h20v4H8v2H4z"/><path fill="#334f68" d="M7 12h3v3H7z"/>',
        ember:'<path fill="#7e9d61" d="M15 3h3v10h-3zM8 5h8v4H8zM18 3h7v5h-7z"/><path fill="#ba5965" d="M7 11h8v4h5V9h8v13h-5v7H10v-5H4V15h3z"/><path fill="#ed9b83" d="M8 13h3v4H8zM21 11h3v4h-3zM13 22h3v3h-3z"/>',
        luna:'<path fill="#91ae70" d="M12 2h4v8h-4zM19 3h5v5h-5zM24 8h6v4h-6z"/><path fill="#e9a56a" d="M11 10h13v6h-3v5h-4v5h-5v4H6V18h5z"/><path fill="#bc7954" d="M11 15h6v3h-6zM8 23h5v3H8z"/>',
        nova:'<path fill="#efd586" d="M13 2h6v9h10v6h-6v6h-4v7h-6v-7H9v-6H3v-6h10z"/><path fill="#fff0b1" d="M14 7h3v10h-3zM8 13h15v3H8z"/><path fill="#c99d68" d="M13 24h6v5h-6z"/>'
      };
      const toys={
        sprout:'<path fill="#d9c092" d="M8 12h16v4h4v10h-4v4H8v-4H4V16h4z"/><path fill="#89a76b" d="M15 5h3v12h-3zM8 3h8v6H8zM18 1h8v6h-8z"/>',
        miso:'<path fill="#e4be7e" d="M9 3h14v4h5v16h-5v5H9v-5H4V8h5z"/><path fill="none" stroke="#a3785d" stroke-width="2" d="M9 7l14 17M5 14l11 14M15 4l12 14M10 27l-1 3H2"/>',
        brook:'<path fill="#657f92" d="M9 7h13v4h5v14H6V13h3z"/><path fill="#b0cfce" d="M9 10h12v4H9zM6 14h3v8H6z"/><path fill="#deead9" d="M12 10h7v3h-7z"/>',
        ember:'<path fill="#e3b06c" d="M14 2h5v7h8v10h-5v6h-7v5h-4V20H4v-7h8V6h2z"/><path fill="#a57654" d="M14 12h3v16h-3zM17 15h5v3h-5z"/>',
        luna:'<path fill="#c2b4dc" d="M12 2h10v4h-6v5h-4v10h5v4h7v4H10v-4H5V10h4V5h3z"/><path fill="#f3d999" d="M24 9h3v4h4v3h-4v4h-3v-4h-4v-3h4z"/>',
        nova:'<path fill="#538d91" d="M11 2h10v5h5v17h-5v6H11v-6H6V7h5z"/><path fill="#91d9c0" d="M12 4h7v23h-7z"/><path fill="#dcf0c4" d="M14 5h3v13h-3z"/>'
      };
      if(food[pet.id]) layer.querySelector('.pet-food-prop').innerHTML=food[pet.id];
      if(toys[pet.id]) layer.querySelector('.pet-ball-prop').innerHTML=toys[pet.id];
      return layer;
    }
    function pointerPoint(event) { return {screenX:event.screenX,screenY:event.screenY}; }
    function endDrag(event) {
      if(!drag) return;
      if(drag.moved) { suppressClick=true; dispatch('drag-end',pointerPoint(event)); }
      drag=null; root.classList.remove('is-dragging'); pauseIdle();
    }
    const metrics = { harvested: ['收获作物','Harvest crops'], fish: ['钓到的鱼','Catch fish'], tasks: ['完成任务','Complete tasks'], streak: ['连续完成任务天数','Consecutive task days'], focus: ['专注分钟','Focus minutes'], welcome: ['初次见面','A new beginning'] };
    function shell() {
      characterAnimation?.destroy(); characterAnimation=null;
      pauseIdle();
      sizeOpen=false; messageKey=''; messageUntil=0;
      root.className = 'pet-home' + (desktop ? ' pet-native' : '') + (expanded ? ' is-expanded' : '');
      root.innerHTML = '<div class="pet-top"><span class="pet-drag">✦ '+tr('像素伙伴','PIXEL COMPANION')+'</span><div><button data-act="open-home" class="pet-native-home" aria-label="'+tr('打开主窗口','Open workspace')+'">↗</button><button data-act="close" aria-label="'+tr('关闭','Close')+'">×</button></div></div>'
        + '<div class="pet-layout"><section class="pet-stage"><div class="pet-speech" role="status"></div><button class="pet-character" data-act="pet" aria-label="'+tr('点击互动，按住拖动','Click to interact; hold and drag to move')+'"></button><div class="pet-identity"><strong class="pet-name"></strong><span class="pet-mood"></span></div><div class="pet-quick-actions" aria-label="'+tr('直接照料伙伴','Care for your companion')+'"><button data-quick-act="feed"></button><button data-quick-act="play"></button><button data-quick-act="sleep"></button></div><button class="pet-focus" data-act="focus-toggle"><span>◷</span><strong class="pet-clock">25:00</strong><span class="pet-focus-label"></span></button><div class="pet-stage-footer"><span class="pet-interaction-hint">'+tr('点我互动 · 拖动身体移动','Click to interact · drag to move')+'</span><button class="pet-panel-toggle" data-act="expand" aria-expanded="'+expanded+'">'+tr('面板','Panel')+'</button></div></section>'
        + '<section class="pet-panel"><nav class="pet-tabs" aria-label="'+tr('桌宠面板','Companion panels')+'">'+[['care',tr('照料','Care')],['collection',tr('伙伴图鉴','Collection')],['chat',tr('聊天','Chat')]].map(([id,label])=>'<button data-tab="'+id+'">'+label+'</button>').join('')+'</nav>'
        + '<div data-pane="care"><p class="pet-caption">'+tr('一点照料，一起成长','A little care. A little progress.')+'</p><div class="pet-needs">'+[['food',tr('饱腹','Food')],['energy',tr('精力','Energy')],['joy',tr('心情','Joy')]].map(([key,label])=>'<label><span>'+label+'</span><meter data-need="'+key+'" min="0" max="100"></meter><output data-value="'+key+'"></output></label>').join('')+'</div><div class="pet-care-actions"><button data-act="feed">♧ '+tr('喂食','Feed')+'</button><button data-act="play">✧ '+tr('玩耍','Play')+'</button><button data-act="sleep"></button></div><p class="pet-bond"></p><div class="pet-next"><span class="pet-eyebrow">'+tr('下一件小事','YOUR NEXT SMALL STEP')+'</span><button data-act="open-task" class="pet-task"></button><span class="pet-task-date"></span></div><label class="pet-reminders"><input type="checkbox" id="pet-reminders">'+tr('温柔的任务提醒','Gentle task reminders')+'</label><button class="pet-text-button" data-act="snooze">'+tr('安静 30 分钟','Quiet for 30 minutes')+'</button><p class="pet-care-help">'+tr('需求按时间变化；睡觉可恢复精力。离开不会失去伙伴或已解锁的奖励。','Needs change over time; sleep restores energy. Time away never takes away your companions or unlocks.')+'</p><button class="pet-launch" data-act="desktop"></button></div>'
        + '<div data-pane="collection" hidden><p class="pet-caption">'+tr('把日常进步，变成新的相遇','Turn everyday progress into new friends.')+'</p><div class="pet-collection"></div><p class="pet-care-help">'+tr('成就达标即解锁，之后永久保留。连续天数按本地日期计算；完成同一任务多次只计一项任务。','Unlocks stay with you. Streaks use local calendar days; completing the same task again does not increase the task count.')+'</p></div>'
        + '<div data-pane="chat" hidden><p class="pet-chat-privacy">'+tr('使用“我的 AI”中的服务。仅发送当前对话；不会自动发送任务或文件。每次发送可能使用套餐额度或 API 费用。','Uses your My AI connection. Only this conversation is sent, never your tasks or files automatically. Sending may use plan allowance or incur API charges.')+'</p><div class="pet-chat-log" role="log" aria-live="polite"></div><form class="pet-chat-form"><label for="pet-message">'+tr('想聊点什么？','What’s on your mind?')+'</label><textarea id="pet-message" rows="2" maxlength="2000" placeholder="'+tr('今天想一起完成什么？','What shall we work on today?')+'" required></textarea><div><button type="button" data-act="clear-chat">'+tr('清空','Clear')+'</button><button type="submit" class="pet-send">'+tr('发送','Send')+'</button></div></form><p class="pet-chat-error" role="alert"></p><button class="pet-text-button" data-act="open-ai">'+tr('设置我的 AI','Set up My AI')+'</button></div>'
        + '</section></div>';
      find('[data-pane=collection]').insertAdjacentHTML('afterbegin','<button class="pet-create-entry" data-act="open-create">✦ '+tr('用照片创造伙伴','Create from a photo')+'</button><p class="pet-custom-count"></p>');
      find('.pet-custom-count').insertAdjacentHTML('beforebegin','<div class="pet-share-actions"><button type="button" data-act="open-import">↓ '+tr('导入伙伴','Import companion')+'</button><button type="button" data-act="open-export" hidden>↑ '+tr('导出当前伙伴','Export current companion')+'</button></div>');
      find('[data-pane=collection]').insertAdjacentHTML('beforeend','<button class="pet-text-button pet-remove-custom" data-act="open-remove" hidden>'+tr('移除当前自定义伙伴','Remove this custom companion')+'</button>');
      find('.pet-bond').insertAdjacentHTML('afterend','<details class="pet-traits" hidden><summary>'+tr('伙伴性格','Personality')+'</summary><p></p></details>');
      find('.pet-bond').insertAdjacentHTML('afterend','<details class="pet-personality-card" hidden><summary class="pet-personality-title"></summary><p class="pet-personality-bio"></p><dl><dt>'+tr('喜欢','Loves')+'</dt><dd class="pet-personality-likes"></dd><dt>'+tr('小习惯','Little ritual')+'</dt><dd class="pet-personality-habit"></dd></dl></details>');
      text('.pet-chat-privacy',tr('使用“我的 AI”中的服务。发送当前对话、伙伴名字、类型及可选性格；不会自动发送任务或照片。每次发送可能使用套餐额度或 API 费用。','Uses your My AI connection. Sends this conversation, companion name, type and optional personality. Tasks and photos are never sent automatically. Sending may use plan allowance or incur API charges.'));
      text('.pet-care-help',tr('醒着且空闲时，伙伴会自己钓鱼、锻炼、种地和挖矿。人型和生物各有一套动作。需求按时间变化；睡觉可恢复精力，离开不会失去伙伴或奖励。','While awake and idle, companions fish, exercise, garden and mine, with different moves for humanoids and creatures. Needs change over time; sleep restores energy. Time away never takes away companions or unlocks.'));
      if(desktop) {
        find('.pet-stage-footer').remove();
        find('.pet-quick-actions').innerHTML=['feed','play','sleep','focus-toggle','size','expand'].map(type=>'<button data-quick-act="'+type+'"'+(type==='expand'?' class="pet-panel-toggle" aria-expanded="'+expanded+'"':type==='size'?' class="pet-size-toggle" aria-expanded="false" aria-controls="pet-size-popover"':'')+'>'+icon(type)+'</button>').join('');
        find('.pet-stage').insertAdjacentHTML('beforeend','<div class="pet-size-popover" id="pet-size-popover" hidden><label for="pet-size-slider">'+tr('宠物大小','Pet size')+'<output class="pet-size-value">100%</output></label><input id="pet-size-slider" type="range" min="70" max="180" step="5" value="100"><button data-act="reset-size">'+tr('恢复默认','Reset size')+'</button></div>');
        const slider=find('#pet-size-slider');
        slider.oninput=()=>text('.pet-size-value',slider.value+'%');
        slider.onchange=()=>dispatch('set-size',Number(slider.value));
        root.onkeydown=event=>{if(event.key==='Escape'&&sizeOpen){event.preventDefault();event.stopPropagation();toggleSize(false);find('[data-quick-act=size]').focus();}};
      }
      root.onclick = event => {
        const b = event.target.closest('button'); if (!b) return;
        pauseIdle();
        if (b.dataset.tab) { tab = b.dataset.tab; tabs(); return; }
        const action = b.dataset.act||b.dataset.quickAct; if (!action) return;
        if(action==='pet'&&suppressClick) { suppressClick=false;return; }
        if (action === 'expand') { if (desktop) { toggleSize(false); expanded=!expanded; root.classList.toggle('is-expanded',expanded); b.setAttribute('aria-expanded',String(expanded)); dispatch('expand',expanded); } else { tab='care'; tabs(); } return; }
        if (action === 'size') { toggleSize(!sizeOpen); return; }
        if (action === 'reset-size') { find('#pet-size-slider').value='100'; text('.pet-size-value','100%'); dispatch('set-size',100); return; }
        if(sizeOpen) toggleSize(false);
        if (action === 'clear-chat') { cancelChat(); conversation=[]; chatDraft=''; draftRevision++; find('#pet-message').value=''; drawChat(); text('.pet-chat-error',''); return; }
        if (action === 'retry-chat') {
          const failed=conversation.at(-1);
          if (!sending && failed?.status==='failed') sendMessage(failed);
          return;
        }
        if (action === 'close') { dispatch(desktop ? 'hide' : 'close'); return; }
        if (action === 'open-task') { if(snapshot.task) dispatch(action,snapshot.task.id); return; }
        dispatch(action,b.dataset.value);
      };
      find('#pet-reminders').onchange = event => dispatch('reminders',event.target.checked);
      find('.pet-chat-form').onsubmit = send;
      const messageInput=find('#pet-message'); messageInput.value=chatDraft;
      messageInput.setAttribute('enterkeyhint','send'); messageInput.setAttribute('aria-describedby','pet-chat-hint');
      messageInput.insertAdjacentHTML('afterend','<small id="pet-chat-hint" class="pet-chat-hint">'+tr('Enter 发送 · Shift+Enter 换行','Enter to send · Shift+Enter for a new line')+'</small>');
      composing=false;
      messageInput.oninput=()=>{chatDraft=messageInput.value;draftRevision++;};
      messageInput.addEventListener('compositionstart',()=>{composing=true;});
      messageInput.addEventListener('compositionend',()=>{composing=false;});
      messageInput.onkeydown=event=>{
        if(event.key!=='Enter'||event.shiftKey||event.isComposing||composing||event.keyCode===229) return;
        event.preventDefault();
        if(!event.repeat&&!sending) find('.pet-chat-form').requestSubmit();
      };
      const character=find('.pet-character');
      character.ondragstart=event=>event.preventDefault();
      character.onpointerdown=event=>{
        if(event.button!==0||!desktop) return;
        pauseIdle();
        suppressClick=false; drag={x:event.screenX,y:event.screenY,id:event.pointerId,moved:false}; character.setPointerCapture(event.pointerId);
      };
      character.onpointermove=event=>{
        if(!drag||drag.id!==event.pointerId) return;
        if(!drag.moved&&Math.hypot(event.screenX-drag.x,event.screenY-drag.y)>=5) {
          drag.moved=true; dispatch('drag-start',{screenX:drag.x,screenY:drag.y}); root.classList.add('is-dragging'); syncAnimation();
        }
        if(drag.moved) dispatch('drag-move',pointerPoint(event));
      };
      character.onpointerup=endDrag; character.onpointercancel=endDrag; character.onlostpointercapture=endDrag;
      tabs(); drawChat();
    }
    function tabs() {
      root.querySelectorAll('[data-pane]').forEach(el=>el.hidden=el.dataset.pane!==tab);
      root.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.tab===tab)));
    }
    function drawChat() {
      const log=find('.pet-chat-log'); log.replaceChildren();
      for(const msg of conversation) {
        const el=document.createElement('p'); el.className='pet-chat-'+msg.role; el.textContent=msg.content;
        el.dataset.messageId=String(msg.id); if(msg.status) el.dataset.status=msg.status; log.appendChild(el);
        if(msg.status==='failed') {
          const delivery=document.createElement('div'); delivery.className='pet-chat-delivery';
          const label=document.createElement('span'); label.textContent=tr('未收到回复','No reply received'); delivery.appendChild(label);
          if(msg===conversation.at(-1)) {
            const retry=document.createElement('button'); retry.type='button'; retry.className='pet-chat-retry'; retry.dataset.act='retry-chat'; retry.textContent=tr('重试','Retry'); retry.disabled=sending; delivery.appendChild(retry);
          }
          log.appendChild(delivery);
        }
      }
      if(sending) {
        const thinking=document.createElement('p'); thinking.className='pet-chat-thinking'; thinking.setAttribute('role','status');
        thinking.textContent=(language==='zh'?snapshot.pet.zh:snapshot.pet.en)+tr('正在想…',' is thinking…'); log.appendChild(thinking);
      }
      if(!conversation.length) { const el=document.createElement('p'); el.className='pet-chat-empty'; el.textContent=tr('小伙伴在这里，等你开口。','Your little companion is ready to listen.'); log.appendChild(el); }
      find('.pet-send').disabled=sending; text('.pet-send',tr('发送','Send'));
      log.scrollTop=log.scrollHeight;
    }
    function cancelChat() {
      generation++; chatController?.abort(); chatController=null; sending=false;
      find('.pet-send').disabled=false; find('#pet-message').disabled=false; text('.pet-send',tr('发送','Send'));
    }
    function send(event) {
      event.preventDefault(); if(sending) return;
      const input=find('#pet-message'), message=input.value.trim(); if(!message || message.length>2000) return;
      const last=conversation.at(-1);
      const entry=last?.status==='failed'&&last.content===message?last:{id:++messageSequence,role:'user',content:message};
      if(entry!==last) { conversation.push(entry); conversation=conversation.slice(-31); }
      sendMessage(entry);
    }
    async function sendMessage(entry) {
      if(sending) return;
      const input=find('#pet-message');
      if(input.value.trim()===entry.content) { input.value=''; chatDraft=''; draftRevision++; }
      const sentRevision=draftRevision;
      pauseIdle();
      const version=generation;
      const controller=new AbortController(); chatController=controller;
      const timeout=setTimeout(()=>controller.abort(),150000);
      const messages=conversation.slice(-15).map(({role,content})=>({role,content}));
      entry.status='pending'; sending=true; text('.pet-chat-error',''); drawChat();
      input.focus({preventScroll:true});
      try {
        const mode=localStorage.getItem('tracer.ai.mode')==='api'?'personal':'codex';
        const companion=snapshot.pet.custom?{name:snapshot.pet.en,personality:snapshot.pet.personality||'',kind:snapshot.pet.kind}:undefined;
        const result=await fetch('/api/ai/'+mode+'-chat',{method:'POST',headers:{'Content-Type':'application/json','x-tracer-ai':'1'},signal:controller.signal,body:JSON.stringify({messages,pet:snapshot.pet.id,language,companion})});
        const data=await result.json();
        if(!result.ok) throw new Error(data.error || 'request-failed');
        if(typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>2000) throw new Error('invalid-response');
        if(version===generation) { entry.status='sent'; conversation.push({id:++messageSequence,role:'assistant',content:data.reply}); conversation=conversation.slice(-32); }
      } catch(error) {
        const missing=['personal-not-configured','codex-login-required','codex-runtime-unavailable'].includes(error.message);
        if(version===generation) {
          entry.status='failed';
          const currentInput=find('#pet-message');
          if(draftRevision===sentRevision&&!currentInput.value) { currentInput.value=entry.content; chatDraft=entry.content; draftRevision++; }
          text('.pet-chat-error',missing ? tr('请先在“我的 AI”中登录或配置服务，再重试这条消息。','Connect your account or provider in My AI, then retry this message.') : tr('暂时没有收到回复，可以重试。消息和新输入的内容都已保留。','No reply yet. You can retry; your message and any new draft are still here.'));
        }
      } finally {
        clearTimeout(timeout);
        if(version===generation) { sending=false; chatController=null; if(root.isConnected) drawChat(); }
      }
    }
    function update(value) {
      snapshot=value; if(!snapshot || !snapshot.pet) return;
      if(restoredChat) {
        if(restoredChat.petId===snapshot.pet.id) {
          conversation=restoredChat.conversation.map(message=>({...message,status:message.status==='pending'?'failed':message.status}));
          messageSequence=conversation.reduce((max,message)=>Math.max(max,message.id),0);
          chatDraft=restoredChat.draft||''; tab='chat';
          if(!chatDraft&&conversation.at(-1)?.status==='failed') chatDraft=conversation.at(-1).content;
        }
        restoredChat=null;
      }
      if(language!==snapshot.language) { language=snapshot.language; shell(); }
      const p=snapshot.pet, state=snapshot.needs;
      const personality=TracerPetPersonalities.get(p.id);
      if(selected && selected!==p.id) { cancelChat(); conversation=[]; chatDraft=''; draftRevision++; drawChat(); find('#pet-message').value=''; text('.pet-chat-error',''); }
      if(selected!==p.id || !find('.pet-character .pet-sprite')) {
        characterAnimation?.destroy(); characterAnimation=null; selected=p.id;
        find('.pet-character').replaceChildren(art(p,true),effectLayer(p),TracerPetIdleArt());
        root.classList.toggle('has-animation-pack',!!p.custom&&!!characterAnimation);
        root.classList.toggle('has-builtin-animation',!p.custom&&!!characterAnimation);
      }
      const humanoid=p.kind==='humanoid'; root.dataset.kind=humanoid?'humanoid':'creature';
      root.dataset.pet=p.id;
      root.dataset.mood=snapshot.mood;
      root.style.setProperty('--pet-accent',p.color);
      const name=language==='zh'?p.zh:p.en;
      text('.pet-name',name);
      const moods={sleeping:['睡个好觉','Resting'],focusing:['陪你专注','Focusing with you'],hungry:['该吃点东西了','Ready for a snack'],tired:['有点困了','A little sleepy'],bored:['一起玩一会儿吧','Time for some play'],happy:['今天也在你身边','Happy to be here']};
      if(humanoid) { moods.hungry=['一起吃点东西吧','Shall we share a meal?']; moods.bored=['一起聊聊或做点什么吧','Let’s spend some time together']; }
      text('.pet-mood',tr(...moods[snapshot.mood]));
      if (personality&&snapshot.mood==='happy') text('.pet-mood',TracerPetPersonalities.text(p.id,'tagline',language));
      let speech=snapshot.mood==='sleeping'?tr('Zzz… 醒来再一起冒险。','Zzz… more adventures after a nap.'):
        snapshot.focus.running?tr('我陪着你，一次只做一件事。','I’m right here. One small step at a time.'):
        snapshot.reminder?tr('小提醒：','A gentle nudge: ')+snapshot.reminder.title:
        snapshot.focus.completed?tr('这一轮完成啦，起来伸个懒腰吧！','Round complete. Time for a stretch!'):tr('种下好习惯，收获小伙伴。','Grow good habits. Find little friends.');
      const feedback=snapshot.feedback;
      const action=feedback?.accepted?feedback.action:Date.now()-snapshot.lastActionAt<4500?snapshot.lastAction:'';
      if(action) speech=(humanoid?{pet:tr('击个掌！有你在真好。','High five! Good to have you here.'),feed:tr('一起吃饭真好，谢谢你。','Thanks for sharing a meal with me.'),play:tr('一起玩一会儿，心情好多了！','A little fun together makes the day brighter!'),sleep:tr('我休息一会儿，待会儿见。','Time for a little rest. See you soon.'),wake:tr('休息好了，我们一起安排接下来吧。','Feeling refreshed. Let’s plan our next little step.')}:{pet:tr('蹭蹭你的手 ♥ 好喜欢摸摸！','Nuzzle, nuzzle… more pats, please! ♥'),feed:tr('嚼嚼…好吃！谢谢你的点心。','Munch, munch… yum! Thank you for the snack.'),play:tr('追到球啦！再来一局！','Caught the ball! Let’s play again!'),sleep:tr('蜷起来睡一觉，醒来见。','Curling up for a nap. See you soon.'),wake:tr('伸个懒腰～又有精神啦！','A big stretch… ready for another little adventure!')})[action]||speech;
      if(feedback&&!feedback.accepted) speech=({sleeping:tr('Zzz… 我还在睡觉，点“起床”再一起玩。','Zzz… still sleeping. Tap Wake to play together.'),full:tr('已经吃饱啦，晚点再吃吧 ♥','My tummy is full. A snack later? ♥'),tired:tr('有点累了，先让我休息一会儿吧。','A little tired. Let me rest before we play.'),content:tr('刚刚玩得很开心！摸摸我也可以哦。','That was fun! A little pat would be lovely, too.'),cooldown:tr('等一下下～我还在享受刚才的互动。','Just a moment… still enjoying that!')})[feedback.reason]||speech;
      const nextFeedbackKey=feedback?String(feedback.id)+':'+feedback.at:action+':'+snapshot.lastActionAt;
      root.dataset.feedback=feedback?.reason||'';
      if(nextFeedbackKey!==feedbackKey) { feedbackKey=nextFeedbackKey;root.dataset.action='';void root.offsetWidth;root.dataset.action=feedback&&!feedback.accepted?'':action; }
      if(!feedback&&!action) root.dataset.action='';
      const activity=idle.update({petId:p.id,kind:p.kind,workActivities:!!characterAnimation&&(!p.custom||p.animation?.pages.length>3),blocked:!!(drag||action||feedback||state.sleeping||snapshot.focus.running||snapshot.reminder||state.food<25||state.energy<25||sending||sizeOpen||(tab==='chat'&&(!desktop||expanded)))});
      root.dataset.idle=activity;
      syncAnimation();
      if(activity) {
        const labels={fishing:['钓鱼中','Fishing'],exercise:['锻炼中','Exercising'],farming:['种地中','Gardening'],mining:['挖矿中','Mining']};
        const lines=humanoid?{
          fishing:['浮漂动了……今天会钓到什么呢？','A little ripple… wonder what I’ll catch.'],
          exercise:['再举一下！休息时也要活动活动。','One more lift! A little movement feels good.'],
          farming:['松松土，浇点水，等小苗慢慢长大。','A little digging, a little water. Grow, little sprouts.'],
          mining:['叮，叮！石头里藏着亮晶晶的矿石。','Clink, clink! There’s something shiny in this rock.']
        }:{
          fishing:['小鱼游过来啦，让我用爪爪试试！','A fish! Let me try a little paw splash.'],
          exercise:['跳一跳，伸伸爪，再绕一圈！','Hop, stretch, and one more little lap!'],
          farming:['刨个小坑，埋下种子，拍拍土。','Dig a little hole, tuck in a seed, pat the soil.'],
          mining:['嗅嗅，挠挠……这里有亮晶晶！','Sniff, scratch… found a little sparkle!']
        };
        Object.assign(labels,{reading:['阅读中','Reading'],writing:['记录中','Writing'],crafting:['手作中','Crafting'],tea:['喝茶休息','Tea break']});
        Object.assign(lines,{
          reading:['慢慢翻一页，看看接下来发生什么。','One quiet page at a time.'],
          writing:['把刚想到的小点子记下来。','Writing down a little idea.'],
          crafting:['仔细拼好，再看看哪里需要打磨。','A careful fit, then a little polish.'],
          tea:['喝一小口，慢慢休息一会儿。','A small sip and a quiet moment.']
        });
        text('.pet-mood',tr(...labels[activity])); speech=tr(...lines[activity]);
      }
      if(personality) {
        const key=feedback&&!feedback.accepted?feedback.reason:state.sleeping?'sleep':action||activity||(snapshot.focus.running?'focus':snapshot.reminder?'':snapshot.focus.completed?'focusComplete':'idle');
        speech=TracerPetPersonalities.text(p.id,key,language)||speech;
      }
      text('.pet-speech',speech);
      if(desktop) {
        const now=Date.now(), eventKey=feedback?'feedback:'+nextFeedbackKey:action?'action:'+snapshot.lastActionAt:snapshot.reminder?'reminder:'+snapshot.reminder.id+':'+snapshot.reminder.at:snapshot.focus.completed?'focus-completed':'';
        if(eventKey!==messageKey) { messageKey=eventKey; messageUntil=now+(snapshot.reminder&&!feedback&&!action?8000:6500); }
        root.classList.toggle('has-message',!!eventKey&&now<messageUntil);
        const size=Number.isFinite(snapshot.desktopSize)?Math.max(70,Math.min(180,snapshot.desktopSize)):100;
        root.style.setProperty('--pet-scale',String(size/100));
        const slider=find('#pet-size-slider');
        if(document.activeElement!==slider) { slider.value=String(size); text('.pet-size-value',size+'%'); }
      }
      text('.pet-clock',snapshot.focus.clock);
      text('.pet-focus-label',snapshot.focus.running?tr('暂停','Pause'):snapshot.focus.completed?tr('下一轮','Next round'):tr('一起专注','Focus with me'));
      for(const key of ['food','energy','joy']) { find('[data-need="'+key+'"]').value=state[key]; text('[data-value="'+key+'"]',Math.round(state[key])+'%'); }
      find('[data-act=feed]').disabled=false;
      find('[data-act=play]').disabled=false;
      text('[data-act=feed]',humanoid?tr('♧ 用餐','♧ Share a meal'):tr('♧ 喂食','♧ Feed'));
      text('[data-act=play]',humanoid?tr('✧ 互动','✧ Hang out'):tr('✧ 玩耍','✧ Play'));
      text('[data-act=sleep]',state.sleeping?tr('☀ 起床','☀ Wake'):humanoid?tr('☾ 休息','☾ Rest'):tr('☾ 睡觉','☾ Sleep'));
      if(desktop) {
        const labels={feed:humanoid?tr('用餐','Share a meal'):tr('喂食','Feed'),play:humanoid?tr('互动','Hang out'):tr('玩耍','Play'),sleep:state.sleeping?tr('起床','Wake'):humanoid?tr('休息','Rest'):tr('睡觉','Sleep'),'focus-toggle':(snapshot.focus.running?tr('暂停专注','Pause focus'):tr('开始专注','Start focus'))+' · '+snapshot.focus.clock,size:tr('调节大小','Adjust size'),expand:expanded?tr('收起面板','Close panel'):tr('打开面板','Open panel')};
        for(const [type,label] of Object.entries(labels)) { const button=find('[data-quick-act="'+type+'"]'); button.title=label;button.setAttribute('aria-label',label); }
        find('[data-quick-act=focus-toggle]').dataset.running=String(snapshot.focus.running);
        find('.pet-character').setAttribute('aria-label',name+' · '+tr('点击互动，按住拖动','Click to interact; hold and drag to move'));
      } else {
        text('[data-quick-act=feed]',humanoid?tr('♧ 用餐','♧ Meal'):tr('♧ 喂食','♧ Feed'));
        text('[data-quick-act=play]',humanoid?tr('✦ 互动','✦ Hang out'):tr('✦ 玩耍','✦ Play'));
        text('[data-quick-act=sleep]',state.sleeping?tr('☀ 起床','☀ Wake'):humanoid?tr('☾ 休息','☾ Rest'):tr('☾ 睡觉','☾ Sleep'));
      }
      text('.pet-interaction-hint',desktop?tr('点我互动 · 拖动身体移动','Click to interact · drag to move'):humanoid?tr('点我击掌，一起放松一下','Click for a high five'):tr('点我摸摸，我会回应你','Click for a little pat'));
      find('.pet-traits').hidden=!p.personality; text('.pet-traits p',p.personality||'');
      find('.pet-personality-card').hidden=!personality;
      text('.pet-personality-title',personality?TracerPetPersonalities.text(p.id,'tagline',language):'');
      for(const field of ['bio','likes','habit']) text('.pet-personality-'+field,personality?TracerPetPersonalities.text(p.id,field,language):'');
      text('.pet-bond',tr('默契值 ','Bond ')+Math.round(state.bond)+' / 100');
      text('.pet-task',snapshot.task?snapshot.task.title:tr('今天没有待提醒的任务','No tasks need a nudge today'));
      find('.pet-task').disabled=!snapshot.task;
      text('.pet-task-date',snapshot.task?(snapshot.task.due||snapshot.task.scheduled||''):'');
      find('#pet-reminders').checked=snapshot.reminders;
      text('[data-act=snooze]',snapshot.snoozedUntil>Date.now()?tr('提醒已暂停 30 分钟','Reminders are snoozed'):tr('安静 30 分钟','Quiet for 30 minutes'));
      text('.pet-launch',desktop?tr('打开桌宠小屋','Open companion home'):snapshot.native?tr('带到桌面 ↗','Bring to desktop ↗'):tr('桌面悬浮模式需使用桌面版','Desktop mode is available in the desktop app'));
      find('.pet-launch').disabled=!desktop&&!snapshot.native;
      find('.pet-launch').dataset.act=desktop?'open-home':'desktop';
      const collection=find('.pet-collection');
      const catalog=snapshot.catalog||TracerPetModel.pets, customCount=catalog.filter(pet=>pet.custom).length;
      find('[data-act=open-create]').disabled=customCount>=TracerPetModel.customLimit;
      text('.pet-custom-count',tr('自定义伙伴 ','Custom companions ')+customCount+' / '+TracerPetModel.customLimit);
      find('.pet-remove-custom').hidden=!p.custom;
      find('[data-act=open-export]').hidden=!p.custom;
      const key=JSON.stringify([snapshot.unlocked,snapshot.metrics,p.id,language,catalog]);
      if(collection.dataset.key!==key) {
        collection.dataset.key=key; collection.replaceChildren();
        for(const pet of catalog) {
          const unlocked=snapshot.unlocked.includes(pet.id), item=document.createElement('button');
          item.className='pet-unlock'+(unlocked?' unlocked':''); item.disabled=!unlocked; item.dataset.act='select'; item.dataset.value=pet.id;
          item.setAttribute('aria-pressed',String(p.id===pet.id));
          item.innerHTML='<span><strong></strong><small></small><em></em></span>'; item.prepend(art(pet));
          item.querySelector('strong').textContent=language==='zh'?pet.zh:pet.en;
          item.querySelector('small').textContent=pet.custom?tr(...pet.species):TracerPetPersonalities.text(pet.id,'tagline',language);
          item.querySelector('em').textContent=unlocked?(p.id===pet.id?tr('正在陪伴','With you'):tr('已解锁 · 选择','Unlocked · choose')):tr(...metrics[pet.metric])+' · '+Math.min(pet.target,snapshot.metrics[pet.metric]||0)+' / '+pet.target;
          collection.appendChild(item);
        }
      }
    }
    return { update, readChat:()=>({petId:selected,conversation:conversation.map(message=>({...message})),draft:chatDraft}), destroy:()=>{ generation++; chatController?.abort();characterAnimation?.destroy();if(desktop)window.removeEventListener('blur',blurSize);if(drag?.moved)dispatch('drag-end');drag=null;root.replaceChildren(); } };
  };
})();
