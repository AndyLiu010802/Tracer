(function () {
  'use strict';
  window.TracerPetCreator = function (root, options) {
    const tr = (zh,en) => options.language === 'zh' ? zh : en;
    const find = selector => root.querySelector(selector);
    let photo = '', image = '', busy = false, destroyed = false, photoVersion = 0, controller, providerVersion=0;
    let pages = [], previewPlayer = null, previewAction = 'idle', previewBroken = false;
    const actions = TracerPetAnimation.actions, groupCount = actions.length, animationVersion = 2;
    const actionLabels = {idle:['待机','Idle'],pet:['互动','Greeting'],feed:['吃饭','Eating'],play:['玩耍','Playing'],sleep:['睡觉','Sleeping'],wake:['起床','Waking up'],focus:['专注','Focusing'],drag:['被提起','Being picked up'],fishing:['钓鱼','Fishing'],exercise:['锻炼','Exercising'],farming:['种地','Gardening'],mining:['挖矿','Mining'],reading:['阅读','Reading'],writing:['记录','Writing'],crafting:['手作','Crafting'],tea:['喝茶休息','Tea break']};
    const safeImage = value => typeof value === 'string' && /^\/api\/pet-art\/[a-f0-9]{32}\.png$/.test(value);
    const error = message => { find('.pet-create-error').textContent = message; };
    root.className = 'pet-home pet-creator';
    root.innerHTML = '<div class="pet-top"><span class="pet-drag">'+tr('创造自己的伙伴','CREATE YOUR COMPANION')+'</span><button type="button" data-act="cancel-create" aria-label="'+tr('返回伙伴小屋','Back to companions')+'">×</button></div>'
      + '<form class="pet-create-form"><div class="pet-create-intro"><h2>'+tr('一张照片，一位新伙伴','A familiar face. A new little friend.')+'</h2><p>'+tr('把你、宠物或喜欢的角色，变成农场里的像素伙伴。','Turn yourself, a pet, or a favorite character into a pixel companion.')+'</p></div>'
      + '<div class="pet-create-grid"><section class="pet-create-fields"><label class="pet-create-field" for="pet-photo"><span>'+tr('参考照片','Reference photo')+'</span><input id="pet-photo" type="file" accept="image/jpeg,image/png,image/webp" required><small>'+tr('JPG、PNG 或 WebP，最大 10 MB。','JPG, PNG or WebP, up to 10 MB.')+'</small></label>'
      + '<label class="pet-create-field" for="pet-custom-name"><span>'+tr('伙伴名字','Companion name')+'</span><input id="pet-custom-name" maxlength="40" required placeholder="'+tr('例如：小麦','e.g. Sunny')+'"></label>'
      + '<label class="pet-create-field" for="pet-custom-kind"><span>'+tr('伙伴类型','Companion type')+'</span><select id="pet-custom-kind"><option value="creature">'+tr('生物','Creature')+'</option><option value="humanoid">'+tr('人型','Humanoid')+'</option></select><small class="pet-kind-help"></small></label>'
      + '<label class="pet-create-field" for="pet-custom-personality"><span>'+tr('性格 · 可选','Personality · optional')+'</span><textarea id="pet-custom-personality" rows="3" maxlength="600" placeholder="'+tr('例如：安静、好奇，喜欢花朵，说话温柔。','e.g. Quiet, curious, loves flowers, speaks gently.')+'"></textarea><small>'+tr('性格会影响形象细节和聊天风格。留空则使用温暖友善的默认性格。','Shapes the artwork and conversation. Leave blank for a warm, friendly companion.')+'</small></label>'
      + '<label class="pet-create-field pet-features-field" for="pet-distinctive-features"><span>'+tr('希望保留的特征 · 可选','Distinctive features to keep · optional')+'</span><textarea id="pet-distinctive-features" rows="2" maxlength="400" placeholder="'+tr('例如：圆框眼镜、侧分短发、蓝色外套；或左眼周围的白色毛斑。','e.g. Round glasses, short side-parted hair, a blue coat; or the white patch around the left eye.')+'"></textarea><small>'+tr('会优先保留原图中可见的特征。性格主要影响表情和姿态。','Visible details from the photo take priority. Personality mainly shapes expression and pose.')+'</small></label>'
      + '<label class="pet-create-field pet-image-source-field" for="pet-image-source"><span>'+tr('生成方式','Generate with')+'</span><select id="pet-image-source"><option value="codex">'+tr('ChatGPT 订阅 · 本地已登录账号','ChatGPT subscription · signed-in account')+'</option><option value="personal">'+tr('个人 API · 单独计费','Personal API · separate billing')+'</option></select><small>'+tr('默认使用“我的 AI”中已登录的 ChatGPT 账号，不会自动切换到付费 API。','Uses the ChatGPT account signed in through My AI by default. Never switches to a paid API automatically.')+'</small></label>'
      + '<details class="pet-image-settings" hidden><summary>'+tr('图像模型','Image model')+'</summary><label class="pet-create-field" for="pet-image-model"><span>'+tr('服务商支持的图像编辑模型','Image editing model supported by your provider')+'</span><input id="pet-image-model" maxlength="100" value="gpt-image-2.5-flare"></label></details></section>'
      + '<section class="pet-create-preview"><div class="pet-photo-frame"><img class="pet-photo-preview" alt="'+tr('参考照片预览','Reference photo preview')+'" hidden><span class="pet-photo-empty">'+tr('从一张熟悉的照片开始','Start with a familiar photo')+'</span></div><div class="pet-result-frame"><img class="pet-generated-preview" alt="'+tr('生成的像素伙伴预览','Generated pixel companion preview')+'" hidden><span class="pet-result-empty">✦<br>'+tr('你的新伙伴将在这里出现','Your new friend will appear here')+'</span></div><p class="pet-create-status" role="status"></p></section></div>'
      + '<div class="pet-generation-info"><p class="pet-provider-status" role="status">'+tr('正在检查图像服务…','Checking your image provider…')+'</p><p class="pet-generation-privacy"></p><button type="button" class="pet-text-button" data-act="open-ai">'+tr('设置我的 AI','Set up My AI')+'</button></div>'
      + '<p class="pet-create-error" role="alert"></p><div class="pet-create-actions"><button type="button" data-act="cancel-create">'+tr('返回','Back')+'</button><button type="submit" class="pet-generate">'+tr('生成像素伙伴','Generate pixel companion')+'</button><button type="button" class="pet-adopt" hidden>'+tr('保存并陪伴我','Save & bring to life')+'</button></div></form>';
    for (const [selector,label] of [['.pet-photo-frame',tr('你的原图','Your reference')],['.pet-result-frame',tr('像素伙伴预览','Pixel companion preview')]]) {
      const frame=find(selector), figure=document.createElement('figure'), caption=document.createElement('figcaption'); caption.textContent=label;
      frame.before(figure); figure.append(caption,frame);
    }
    find('.pet-result-frame').insertAdjacentHTML('afterend','<div class="pet-animation-preview" hidden><label for="pet-preview-action">'+tr('动作','Action')+'</label><select id="pet-preview-action"></select></div>');
    find('.pet-create-status').insertAdjacentHTML('beforebegin','<progress class="pet-animation-progress" max="'+groupCount+'" value="0" hidden aria-label="'+tr('动作生成进度','Actions completed')+'"></progress>');
    find('#pet-preview-action').innerHTML=actions.map(action=>'<option value="'+action+'">'+tr(...actionLabels[action])+'</option>').join('');
    find('#pet-preview-action').onchange=event=>showPreview(event.target.value);
    find('.pet-generate').insertAdjacentHTML('beforebegin','<button type="button" class="pet-restart-generation" data-act="restart-generation" hidden>'+tr('重新开始','Start over')+'</button>');
    find('.pet-create-intro p').textContent=tr('保留熟悉的特征，生成 16 种行为，每个动作 16 帧，共 256 帧，包含阅读、记录、手作和喝茶休息。','A familiar face with 16 behaviors, 16 frames per action and 256 frames in total, including reading, writing, crafting and tea breaks.');
    find('.pet-generation-info').insertAdjacentHTML('afterbegin','<p>'+tr('每个动作单独生成，共使用 16 次图像生成额度，比旧版耗时更长。可以边生成边预览；失败后只重试未完成的动作。','Each action is generated separately, using 16 image generations and taking longer than older packs. Preview as they arrive; retries keep completed actions.')+'</p>');
    const privacy=find('.pet-generation-privacy'), details=document.createElement('details');
    details.className='pet-generation-details';
    details.innerHTML='<summary>'+tr('使用与隐私说明','Usage & privacy')+'</summary>';
    privacy.before(details); details.appendChild(privacy);
    details.before(Object.assign(document.createElement('p'),{className:'pet-generation-summary'}));
    async function providerStatus() {
      const source=find('#pet-image-source').value, version=++providerVersion;
      find('.pet-image-settings').hidden=source!=='personal';
      find('#pet-image-model').required=source==='personal';
      find('.pet-generation-summary').textContent=source==='codex'
        ? tr('照片和角色设置将发送给 OpenAI，使用当前 ChatGPT 订阅额度。','Sends your photo and character settings to OpenAI using your ChatGPT allowance.')
        : tr('照片和角色设置将发送给你配置的图像服务，按该服务的 API 费用计费。','Sends your photo and character settings to your configured image provider, with its API charges.');
      find('.pet-generation-privacy').textContent=source==='codex'
        ? tr('点击生成后，照片、名字、类型、性格及特征说明会通过本地 Codex 发送给 OpenAI，使用已登录 ChatGPT 账号的订阅额度；不使用 API 密钥，不自动购买额度。原照片不保存在应用中，生成形象保存在本机。','Generate sends your photo, name, type, personality and feature notes to OpenAI through local Codex using your signed-in ChatGPT allowance. No API key or automatic credit purchases. The app does not save your original photo; generated artwork stays on this device.')
        : tr('点击生成后，照片及伙伴设置会发送给“我的 AI”中配置的个人 API，可能产生单独费用。原照片不保存在应用中，生成形象保存在本机。','Generate sends your photo and character preferences to the personal API configured in My AI and may incur separate charges. The app does not save your original photo; generated artwork stays on this device.');
      find('.pet-provider-status').textContent=tr('正在检查账号…','Checking your connection…');
      try {
        const response=await fetch('/api/ai/'+source+'-status',{headers:{'x-tracer-ai':'1'}}), status=await response.json();
        if(destroyed||version!==providerVersion) return;
        if(!response.ok) throw new Error(status.error||'request-failed');
        find('.pet-provider-status').textContent=source==='codex'
          ? !status.account?tr('请先在“我的 AI”中登录 ChatGPT 账号。','Sign in to ChatGPT in My AI first.')
            : status.imageGeneration===false?tr('账号已登录，但当前 Codex 暂未开放图片生成。请检查运行时或账号权限。','Signed in, but image generation is unavailable in this Codex runtime or account.')
            : tr('ChatGPT 订阅已连接','ChatGPT subscription connected')
          : status.configured?tr('图像服务：','Image provider: ')+new URL(status.url).origin:tr('请先在“我的 AI”中配置个人 API。','Configure your personal API in My AI first.');
      } catch { if(!destroyed&&version===providerVersion) find('.pet-provider-status').textContent=tr('无法确认连接状态，请检查“我的 AI”设置。','Could not check the connection. Review My AI settings.'); }
    }
    function kindHelp() {
      find('.pet-kind-help').textContent = find('#pet-custom-kind').value === 'humanoid'
        ? tr('像朋友一样用餐、休息和互动。人像选择人型更容易保留原本特征。','Share meals, rest and hang out like friends. Choose humanoid for a person’s photo to preserve their features.')
        : tr('喂食、睡觉和玩耍。适合宠物和幻想生物；人像转为生物时会改变原本的外形。','Feed, sleep and play. Best for pets and fantasy creatures; turning a person into a creature changes their original shape.');
    }
    function clearPreview() {
      previewPlayer?.destroy(); previewPlayer?.element.remove(); previewPlayer=null;
      const still=find('img.pet-generated-preview'); still.hidden=true; still.removeAttribute('src');
    }
    function showPreview(action = previewAction) {
      const pageIndex = actions.indexOf(action);
      if (!pages[pageIndex]) return;
      clearPreview(); previewAction=action;
      previewPlayer=TracerPetAnimation.createPage(pages[pageIndex],pageIndex,{version:animationVersion,label:values().name,onError:()=>{
        if (destroyed) return;
        previewBroken=true; find('.pet-adopt').hidden=true;
        error(tr('动作图像暂时无法读取。请检查连接，或点击“重新开始”；照片和设置会保留。','An animation image could not be loaded. Check the connection or choose Start over; your photo and settings will remain.'));
        find('.pet-create-status').textContent='';
        if (!busy) find('.pet-restart-generation').hidden=false;
      }});
      previewPlayer.element.classList.add('pet-generated-preview');
      find('.pet-result-frame').appendChild(previewPlayer.element); previewPlayer.setAction(action);
      find('.pet-result-empty').hidden=true; find('.pet-animation-preview').hidden=false;
      find('#pet-preview-action').value=action;
      for (const option of find('#pet-preview-action').options) option.disabled=!pages[actions.indexOf(option.value)];
    }
    function invalidate() {
      pages=[]; image=''; clearPreview(); previewAction='idle'; previewBroken=false;
      find('.pet-animation-preview').hidden=true; find('.pet-animation-progress').hidden=true; find('.pet-animation-progress').value=0;
      find('.pet-result-empty').hidden = false; find('.pet-adopt').hidden = true; find('.pet-create-status').textContent = '';
      find('.pet-restart-generation').hidden=true;
      find('.pet-generate').textContent = tr('生成像素伙伴','Generate pixel companion');
    }
    function setBusy(value) {
      busy = value; root.setAttribute('aria-busy', String(value));
      root.querySelectorAll('input,textarea,select,.pet-generate,.pet-adopt,details').forEach(el => { if ('disabled' in el) el.disabled = value; });
      find('#pet-preview-action').disabled=false;
      find('.pet-restart-generation').hidden=value||(!previewBroken&&(pages.length===0||pages.length===groupCount));
      find('.pet-generate').textContent = value ? tr('生成中…','Generating…') : pages.length===groupCount ? tr('重新生成全部动作','Regenerate all actions') : pages.length ? tr('继续生成','Continue generation')+' · '+pages.length+'/'+groupCount : tr('生成像素伙伴','Generate pixel companion');
    }
    async function loadPhoto(event) {
      const version = ++photoVersion, file = event.target.files[0]; photo = ''; invalidate(); error('');
      find('.pet-photo-preview').hidden = true; find('.pet-photo-preview').removeAttribute('src'); find('.pet-photo-empty').hidden = false;
      if (!file) return;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) { error(tr('请选择不超过 10 MB 的 JPG、PNG 或 WebP 图片。','Choose a JPG, PNG or WebP image under 10 MB.')); return; }
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
        if (destroyed || version !== photoVersion) return;
        if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 36000000) throw new Error('invalid-photo');
        const canvas = document.createElement('canvas'), scale = Math.min(1,1024 / Math.max(bitmap.width,bitmap.height));
        canvas.width = Math.max(1,Math.round(bitmap.width*scale)); canvas.height = Math.max(1,Math.round(bitmap.height*scale));
        canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
        photo = canvas.toDataURL('image/png');
        if (photo.length > 5500000) photo = canvas.toDataURL('image/jpeg',.9);
        find('.pet-photo-preview').src = photo; find('.pet-photo-preview').hidden = false; find('.pet-photo-empty').hidden = true;
      } catch { if (!destroyed && version === photoVersion) error(tr('无法读取这张图片，请换一张试试。','This image could not be read. Please choose another.')); }
      finally { if (bitmap) bitmap.close(); }
    }
    function values() { return { name: find('#pet-custom-name').value.trim(), kind: find('#pet-custom-kind').value, personality: find('#pet-custom-personality').value.trim(), distinctiveFeatures:find('#pet-distinctive-features').value.trim(), imageSource:find('#pet-image-source').value, imageModel: find('#pet-image-model').value.trim() }; }
    const errors = {
      'codex-login-required':['请先在“我的 AI”中登录 ChatGPT 账号，照片和设置已保留。','Sign in to ChatGPT in My AI first. Your photo and settings are still here.'],
      'codex-runtime-unavailable':['本地 Codex 运行时不可用，请检查“我的 AI”设置。','The local Codex runtime is unavailable. Check My AI settings.'],
      'codex-image-unavailable':['当前账号或 Codex 运行时不支持生成图片，不会切换到个人 API。','Image generation is unavailable in this account or Codex runtime. No personal API was used.'],
      'codex-quota-exhausted':['ChatGPT 订阅可用额度不足，请等待额度恢复；不会自动购买额度或改用 API。','Your ChatGPT allowance is exhausted. Wait for it to reset; no credits were purchased and no API was used.'],
      'codex-quota-unavailable':['暂时无法确认订阅额度，请稍后重试。','Your subscription allowance could not be checked. Please try again later.'],
      'codex-timeout':['生成所需时间较长，请稍后重试。照片和设置已保留。','Generation took too long. Please retry later; your photo and settings are still here.'],
      'codex-image-no-result':['本次请求没有返回图片。照片和设置已保留，可以直接重试。','This request returned no image. Your photo and settings are still here; you can retry.'],
      'codex-image-tool-unavailable':['图片生成工具未能启动。照片和设置已保留，请更新或重新启动应用后重试。','The image tool could not start. Your photo and settings are still here. Update or restart the app, then retry.'],
      'codex-image-generation-failed':['图片服务未完成这次生成。照片和设置已保留，可以重试。','The image service did not finish this generation. Your photo and settings are still here; you can retry.'],
      'personal-not-configured': ['请先在“我的 AI”中配置支持图像编辑的个人 API。','Set up a personal API with image editing support in My AI first.'],
      'service-busy': ['AI 正在处理其他请求，请稍后再试。','Your AI is handling another request. Please try again shortly.'],
      'invalid-pet-photo': ['照片无法使用，请选择另一张 JPG、PNG 或 WebP 图片。','This photo could not be used. Choose another JPG, PNG or WebP image.'],
      'pet-photo-too-large': ['处理后的照片仍然太大，请换一张尺寸较小的图片。','This photo is still too large after resizing. Please choose a smaller image.'],
      'image-generation-unsupported': ['当前服务无法使用此图像编辑模型，请检查模型名称、权限和 API 服务。','Your provider could not use this image editing model. Check the model name, access and provider.'],
      'invalid-api-key': ['图像服务拒绝了当前凭据，请在“我的 AI”中检查 API 密钥和图像权限。','The image provider rejected your credentials. Check your API key and image access in My AI.'],
      'provider-busy': ['图像服务繁忙或额度不足，请稍后重试或检查服务额度。','The image provider is busy or a quota was reached. Try later or check your allowance.'],
      'pet-image-save-failed': ['形象已生成，但无法写入本地存储。请检查磁盘空间及写入权限。','Artwork was generated but could not be saved locally. Check disk space and write access.'],
      'invalid-animation-image': ['这个动作的图片尺寸不符合要求。已完成的动作已保留，可以重试当前动作。','This action has the wrong image dimensions. Completed actions are kept; retry this action.'],
      'invalid-animation-sheet': ['这个动作可能缺少过渡姿态、缺少透明背景，或有内容越过分格边界。已完成的动作已保留，请重试当前动作。','This action lacks distinct in-between poses or transparency, or crosses frame boundaries. Completed actions are kept; retry this action.'],
      'invalid-animation-response': ['图像服务未返回所需的动作。已完成的动作已保留，请重试。','The image service did not return the requested action. Completed actions are kept; please retry.'],
      'invalid-identity-image': ['作为参考的伙伴图像无法读取，请点击“重新开始”。照片和设置会保留。','The companion reference could not be read. Choose Start over; your photo and settings will remain.'],
      'custom-limit': ['最多保存 12 位自定义伙伴。请先从图鉴移除一位。','You can keep up to 12 custom companions. Remove one from your collection first.']
    };
    async function generate(event) {
      event.preventDefault(); if (busy) return;
      if (!photo) { error(tr('请先上传可用的参考照片。','Upload a readable reference photo first.')); return; }
      const data = values();
      if (!data.name || (data.imageSource==='personal'&&!data.imageModel)) { error(tr('请填写伙伴名字和图像模型。','Enter a companion name and image model.')); return; }
      if (pages.length===groupCount) invalidate();
      error(''); setBusy(true);
      find('.pet-animation-progress').hidden=false;
      try {
        for (let pageIndex=pages.length; pageIndex<groupCount; pageIndex++) {
          if (destroyed) return;
          const names=tr(...actionLabels[actions[pageIndex]]);
          find('.pet-create-status').textContent=tr('正在生成动作 ','Generating action ')+(pageIndex+1)+'/'+groupCount+' — '+names;
          controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),330000);
          let result;
          try {
            const response = await fetch('/api/ai/'+data.imageSource+'-pet-image', { method:'POST',headers:{'Content-Type':'application/json','x-tracer-ai':'1'},body:JSON.stringify({...data,photo,animationVersion,animationPage:pageIndex,...(pageIndex?{identityImage:pages[0]}:{})}),signal:controller.signal });
            result=await response.json(); if (!response.ok) throw new Error(result.error || 'generation-failed');
            if (!safeImage(result.image)||result.animationPage!==pageIndex||result.animationVersion!==animationVersion) throw new Error('invalid-animation-response');
            if (destroyed) return;
            await TracerPetAnimation.validatePage(result.image,{version:animationVersion});
          } finally { clearTimeout(timeout); }
          if (destroyed) return;
          pages.push(result.image); find('.pet-animation-progress').value=pages.length;
          showPreview(actions[pageIndex]);
        }
        image=pages[0]; find('.pet-adopt').hidden=previewBroken; showPreview('idle');
        if (!previewBroken) find('.pet-create-status').textContent=tr('16 种动作已就绪。切换预览，检查形象和动作后保存。','All 16 behaviors are ready. Preview each action and check the likeness before saving.');
      } catch (e) {
        if (!destroyed) { find('.pet-create-status').textContent=pages.length?tr('已完成 ','Completed ')+pages.length+'/'+groupCount+tr(' 个动作；继续时只生成剩余动作。',' actions; continue to generate the remaining actions.'):''; error(errors[e.message] ? tr(...errors[e.message]) : data.imageSource==='codex'?tr('订阅生成未完成，请稍后重试或检查“我的 AI”。照片和已完成动作已保留，未改用 API。','Subscription generation did not finish. Retry later or check My AI. Your photo and completed actions remain; no API was used.'):tr('没有生成成功。请检查 API 的图像编辑权限、模型或额度后重试；照片和已完成动作已保留。','Generation did not finish. Check your API image editing access, model or balance. Your photo and completed actions are still here.')); }
      } finally { if (!destroyed) setBusy(false); }
    }
    root.onclick = event => {
      const b = event.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'restart-generation' && !busy) { invalidate(); error(''); return; }
      if (b.dataset.act === 'cancel-create') options.onClose();
      if (b.dataset.act === 'open-ai') options.onAI(find('#pet-image-source').value);
      if (b.classList.contains('pet-adopt') && image && !busy && pages.length===groupCount && !previewBroken) {
        try { options.onAdopt({ id:'custom_'+crypto.randomUUID().replaceAll('-',''),...values(),image,animation:{version:animationVersion,pages:[...pages]} }); }
        catch (e) { error(errors[e.message] ? tr(...errors[e.message]) : tr('未能保存伙伴，请检查本地存储后重试。','Could not save your companion. Check local storage and try again.')); }
      }
    };
    find('.pet-create-form').onsubmit = generate;
    find('#pet-photo').onchange = loadPhoto;
    for (const selector of ['#pet-custom-name','#pet-custom-kind','#pet-custom-personality','#pet-distinctive-features','#pet-image-model']) find(selector).addEventListener('input', () => { if (!busy) { invalidate(); kindHelp(); } });
    find('#pet-image-source').onchange=()=>{if(!busy){invalidate();error('');providerStatus();}};
    if (options.draft) {
      const draft=options.draft;
      for (const [selector,key] of [['#pet-custom-name','name'],['#pet-custom-kind','kind'],['#pet-custom-personality','personality'],['#pet-distinctive-features','distinctiveFeatures'],['#pet-image-source','imageSource'],['#pet-image-model','imageModel']]) if (typeof draft[key]==='string') find(selector).value=draft[key];
      if (draft.source instanceof File) { const transfer=new DataTransfer(); transfer.items.add(draft.source); find('#pet-photo').files=transfer.files; }
      if (draft.photo) { photo=draft.photo; find('.pet-photo-preview').src=photo; find('.pet-photo-preview').hidden=false; find('.pet-photo-empty').hidden=true; }
      if (draft.animationVersion===animationVersion && Array.isArray(draft.pages) && draft.pages.length<=groupCount && draft.pages.every(safeImage)) {
        pages=[...draft.pages]; image=pages.length===groupCount?pages[0]:'';
        if (pages.length) { showPreview('idle'); find('.pet-animation-progress').value=pages.length; find('.pet-animation-progress').hidden=false; find('.pet-adopt').hidden=pages.length!==groupCount; setBusy(false); }
      }
    }
    kindHelp();
    providerStatus();
    return { read:()=>({...values(),photo,image,animationVersion,pages:[...pages],source:find('#pet-photo').files[0]}), destroy() { destroyed = true; photoVersion++; photo = ''; controller?.abort(); previewPlayer?.destroy(); root.replaceChildren(); } };
  };
})();
