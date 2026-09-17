(function () {
  'use strict';
  window.TracerPetCreator = function (root, options) {
    const tr = (zh,en) => options.language === 'zh' ? zh : en;
    const find = selector => root.querySelector(selector);
    let photo = '', image = '', source, busy = false, saving = false, destroyed = false, photoVersion = 0, controller, providerVersion=0;
    let pages = [], previewPlayer = null, previewAction = 'idle', previewBroken = false, previewVersion = 0;
    let initialized = false, confirming = false, photoLoading = false, restartSuggested = false, errorMessage = '', completedGeneration = '', lastDraft;
    const newId = () => crypto.randomUUID().replaceAll('-','');
    const recordId = /^custom_[a-f0-9]{32}$/.test(options.draft?.recordId) ? options.draft.recordId : 'custom_'+newId();
    let editingId=options.draft?.editingId===recordId?recordId:'', editingSignature=editingId?options.draft.editingSignature:'';
    let generationId = /^[a-f0-9]{32}$/.test(options.draft?.generationId) ? options.draft.generationId : newId();
    const acceptedFields = new Map();
    const actions = TracerPetAnimation.actions, groupCount = actions.length, animationVersion = 2;
    let pageAttempts=Array.from({length:groupCount},(_,index)=>Number.isInteger(options.draft?.pageAttempts?.[index])&&options.draft.pageAttempts[index]>=0&&options.draft.pageAttempts[index]<=1000?options.draft.pageAttempts[index]:0);
    let generationIdentity='', pendingReplacement=null, retainedFrames=Array(groupCount).fill(16);
    const actionLabels = {idle:['待机','Idle'],pet:['互动','Greeting'],feed:['吃饭','Eating'],play:['玩耍','Playing'],sleep:['睡觉','Sleeping'],wake:['起床','Waking up'],focus:['专注','Focusing'],drag:['被提起','Being picked up'],fishing:['钓鱼','Fishing'],exercise:['锻炼','Exercising'],farming:['种地','Gardening'],mining:['挖矿','Mining'],reading:['阅读','Reading'],writing:['记录','Writing'],crafting:['手作','Crafting'],tea:['喝茶休息','Tea break']};
    const safeImage = value => typeof value === 'string' && /^\/api\/pet-art\/[a-f0-9]{32}\.png$/.test(value);
    const error = message => { errorMessage = message; find('.pet-create-error').textContent = message; notifyChange(); };
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
    find('.pet-result-frame').insertAdjacentHTML('afterend','<div class="pet-animation-preview" hidden><label for="pet-preview-action">'+tr('动作','Action')+'</label><select id="pet-preview-action"></select><button type="button" class="pet-regenerate-action" data-act="regenerate-action"></button><button type="button" class="pet-keep-action" data-act="keep-action" hidden>'+tr('保留原动作','Keep original action')+'</button><small class="pet-action-regeneration-help">'+tr('不满意时可只重画当前动作的 16 帧，其他动作保持不变。','Regenerate only this action’s 16 frames; keep all other actions.')+'</small></div>');
    find('.pet-create-status').insertAdjacentHTML('beforebegin','<progress class="pet-animation-progress" max="'+groupCount+'" value="0" hidden aria-label="'+tr('动作生成进度','Actions completed')+'"></progress>');
    find('#pet-preview-action').innerHTML=actions.map(action=>'<option value="'+action+'">'+tr(...actionLabels[action])+'</option>').join('');
    find('#pet-preview-action').onchange=event=>showPreview(event.target.value);
    find('.pet-generate').insertAdjacentHTML('beforebegin','<button type="button" class="pet-restart-generation" data-act="restart-generation" hidden>'+tr('重新开始','Start over')+'</button>');
    find('.pet-restart-generation').textContent=tr('重新生成全部动作','Regenerate all actions');
    find('.pet-restart-generation').insertAdjacentHTML('beforebegin','<button type="button" class="pet-reload-preview" data-act="reload-preview" hidden>'+tr('重新加载预览','Reload preview')+'</button>');
    find('.pet-restart-generation').insertAdjacentHTML('beforebegin','<button type="button" class="pet-discard-draft" data-act="discard-draft" hidden>'+tr('放弃草稿','Discard draft')+'</button>');
    find('.pet-top [data-act="cancel-create"]').setAttribute('aria-label',tr('收起生成窗口','Minimize generation'));
    find('.pet-create-actions [data-act="cancel-create"]').textContent=tr('暂时收起','Minimize');
    find('.pet-create-intro').insertAdjacentHTML('beforeend','<p>'+tr('可以暂时收起窗口，生成会继续。导航栏可查看进度，完成后会提醒你保存。','You can minimize this window while generation continues. Check progress in navigation; we will remind you to save when it is ready.')+'</p>');
    find('.pet-create-intro p').textContent=tr('保留熟悉的特征，生成 16 种行为，每个动作 16 帧，共 256 帧，包含阅读、记录、手作和喝茶休息。','A familiar face with 16 behaviors, 16 frames per action and 256 frames in total, including reading, writing, crafting and tea breaks.');
    function showEditingMode() {
      root.classList.add('is-editing-companion');
      find('.pet-drag').textContent=tr('调整伙伴动作','REFINE COMPANION ACTIONS');
      find('.pet-create-intro h2').textContent=tr('调整伙伴的动作','Refine your companion’s actions');
      find('.pet-create-intro p').textContent=tr('选择想改进的动作，单独重新生成。保存修改前，原伙伴和养成进度保持不变。','Choose an action to regenerate. Your saved companion and care progress stay unchanged until you save these edits.');
      find('.pet-create-field[for="pet-photo"] small').textContent=tr('使用已保存的伙伴形象作为参考，无需重新上传原始照片。','Uses the saved companion as the reference; no original photo is needed.');
      find('.pet-create-field[for="pet-photo"]').hidden=true;
      find('.pet-create-field[for="pet-custom-kind"]').hidden=true;
      find('.pet-create-preview figure figcaption').textContent=tr('已有伙伴形象','Existing companion');
      find('.pet-features-field').hidden=true;
    }
    if(editingId)showEditingMode();
    find('.pet-generation-info').insertAdjacentHTML('afterbegin','<p>'+tr('创建完整新伙伴需要 16 次图像生成；单组重画只请求选中的一个动作。生成失败时保留已有动作，重试不会重新生成其他组。','Creating a complete new companion uses 16 image generations. Regenerating one action requests only that group. Existing actions are kept if generation fails; retries do not regenerate other groups.')+'</p>');
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
        ? tr('点击生成后，照片、名字、类型、性格及特征说明会通过本地 Codex 发送给 OpenAI，使用已登录 ChatGPT 账号的订阅额度；不使用 API 密钥，不自动购买额度。处理后的参考照片和已完成动作会暂存在本机草稿中，便于恢复；保存伙伴或明确丢弃草稿后会删除参考照片，生成形象保存在本机。','Generate sends your photo, name, type, personality and feature notes to OpenAI through local Codex using your signed-in ChatGPT allowance. No API key or automatic credit purchases. The processed reference photo and completed actions are kept in a local recovery draft. Saving the companion or explicitly discarding the draft removes the reference photo; generated artwork stays on this device.')
        : tr('点击生成后，照片及伙伴设置会发送给“我的 AI”中配置的个人 API，可能产生单独费用。处理后的参考照片和已完成动作会暂存在本机草稿中，便于恢复；保存伙伴或明确丢弃草稿后会删除参考照片，生成形象保存在本机。','Generate sends your photo and character preferences to the personal API configured in My AI and may incur separate charges. The processed reference photo and completed actions are kept in a local recovery draft. Saving the companion or explicitly discarding the draft removes the reference photo; generated artwork stays on this device.');
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
      previewVersion++;
      previewPlayer?.destroy(); previewPlayer?.element.remove(); previewPlayer=null;
      const still=find('img.pet-generated-preview'); still.hidden=true; still.removeAttribute('src');
    }
    function showPreview(action = previewAction) {
      const pageIndex = actions.indexOf(action);
      if (!pages[pageIndex]) return;
      clearPreview(); previewAction=action; previewBroken=false;
      const version=previewVersion;
      previewPlayer=TracerPetAnimation.createPage(pages[pageIndex],pageIndex,{version:animationVersion,retainedFrames:retainedFrames[pageIndex],label:values().name,onError:()=>{
        if (destroyed || version!==previewVersion) return;
        previewBroken=true; find('.pet-adopt').hidden=true;
        error(tr('动作预览暂时无法读取，已生成的动作仍然保留。请检查连接后重新加载预览，无需重新生成。','The preview could not be loaded. Your generated actions are still here. Check the connection and reload the preview; there is no need to regenerate.'));
        find('.pet-create-status').textContent='';
        renderControls();
      }});
      previewPlayer.element.classList.add('pet-generated-preview');
      find('.pet-result-frame').appendChild(previewPlayer.element); previewPlayer.setAction(action);
      find('.pet-result-empty').hidden=true; find('.pet-animation-preview').hidden=false;
      find('#pet-preview-action').value=action;
      for (const option of find('#pet-preview-action').options) option.disabled=!pages[actions.indexOf(option.value)];
      renderControls();
    }
    function invalidate() {
      pages=[]; image=''; clearPreview(); previewAction='idle'; previewBroken=false;
      generationId=newId(); pageAttempts=Array(groupCount).fill(0); completedGeneration=''; restartSuggested=false;
      generationIdentity=''; pendingReplacement=null;
      retainedFrames=Array(groupCount).fill(16);
      find('.pet-animation-preview').hidden=true; find('.pet-animation-progress').hidden=true; find('.pet-animation-progress').value=0;
      find('.pet-result-empty').hidden = false; find('.pet-adopt').hidden = true; find('.pet-create-status').textContent = '';
      renderControls();
    }
    function renderControls() {
      const locked=busy||photoLoading||confirming, complete=pages.length===groupCount;
      root.setAttribute('aria-busy', String(busy||photoLoading));
      root.querySelectorAll('input,textarea,select,.pet-generate,.pet-adopt,.pet-restart-generation,.pet-reload-preview,.pet-discard-draft,.pet-regenerate-action,.pet-keep-action,details').forEach(el => { if ('disabled' in el) el.disabled = locked; });
      find('#pet-preview-action').disabled=false;
      if(editingId) for(const selector of ['#pet-photo','#pet-custom-kind','#pet-distinctive-features'])find(selector).disabled=true;
      const currentIndex=actions.indexOf(previewAction), retryCurrent=pendingReplacement?.pageIndex===currentIndex;
      find('.pet-regenerate-action').disabled=locked||!pages[currentIndex]||!!pendingReplacement&&!retryCurrent;
      find('.pet-regenerate-action').textContent=retryCurrent?tr('重试此动作','Retry this action'):tr('重新生成此动作','Regenerate this action');
      find('.pet-keep-action').hidden=!pendingReplacement||locked;
      find('.pet-action-regeneration-help').textContent=pendingReplacement
        ? tr('正在重画：','Replacing: ')+tr(...actionLabels[actions[pendingReplacement.pageIndex]])+tr('。原动作保留，重试会继续同一组；也可以选择保留原动作。','. The original stays available. Retry this group or keep the original action.')
        : tr('不满意时可只重画当前动作的 16 帧，其他动作保持不变。','Regenerate only this action’s 16 frames; keep all other actions.');
      find('.pet-restart-generation').hidden=!!editingId||busy||(!pages.length&&!restartSuggested);
      find('.pet-reload-preview').hidden=!previewBroken;
      find('.pet-discard-draft').hidden=!options.onDiscard||locked||!status().hasDraft;
      find('.pet-adopt').hidden=!complete||previewBroken;
      find('.pet-adopt').disabled=busy||photoLoading||confirming||!!pendingReplacement;
      find('.pet-adopt').textContent=saving?tr('保存中…','Saving…'):editingId?tr('保存动作修改','Save action changes'):tr('保存并陪伴我','Save & bring to life');
      find('.pet-generate').textContent = busy&&!saving ? tr('生成中…','Generating…') : pendingReplacement ? tr('重试单组动作','Retry action')+' · '+tr(...actionLabels[actions[pendingReplacement.pageIndex]]) : complete ? tr('查看动作预览','Preview actions') : pages.length ? tr('继续生成','Continue generation')+' · '+pages.length+'/'+groupCount : tr('生成像素伙伴','Generate pixel companion');
    }
    function setBusy(value, isSaving = false) {
      busy=value; saving=value&&isSaving; renderControls(); notifyChange();
    }
    function status() {
      const data=destroyed ? lastDraft || {} : values();
      const hasSettings=(data.kind&&data.kind!=='creature')||(data.imageSource&&data.imageSource!=='codex')||(data.imageModel!==undefined&&data.imageModel!=='gpt-image-2.5-flare');
      return {busy:busy||photoLoading,completed:pages.length,total:groupCount,ready:pages.length===groupCount&&!previewBroken&&!pendingReplacement,hasDraft:!!(photo||pages.length||data.name||data.personality||data.distinctiveFeatures||hasSettings),...(pendingReplacement?{replacementAction:actions[pendingReplacement.pageIndex],replacementLabel:tr(...actionLabels[actions[pendingReplacement.pageIndex]])}:{}),...(errorMessage?{error:errorMessage}:{})};
    }
    function read() {
      if (destroyed) return lastDraft;
      return {...values(),recordId,editingId,editingSignature,generationId,generationIdentity,retainedFrames:[...retainedFrames],pendingReplacement:pendingReplacement?{...pendingReplacement}:null,pageAttempts:[...pageAttempts],photo,image,animationVersion,pages:[...pages],source,wasBusy:busy,previewAction,...(errorMessage?{error:errorMessage}:{})};
    }
    function notifyChange() {
      if (!initialized || destroyed) return;
      try { Promise.resolve(options.onChange?.(read(),status())).catch(()=>{}); } catch {}
    }
    async function checkpoint() {
      if (!options.onCheckpoint) return;
      try { await options.onCheckpoint(read(),status()); }
      catch { throw new Error('draft-checkpoint-failed'); }
    }
    async function confirmAction(message) {
      if (destroyed || busy || confirming) return false;
      confirming=true; renderControls();
      try { return !!(await (options.confirmDiscard ? options.confirmDiscard(message) : window.confirm(message))); }
      catch { return false; }
      finally { confirming=false; if (!destroyed) renderControls(); }
    }
    function confirmReplacement(message) { return pages.length ? confirmAction(message) : Promise.resolve(true); }
    const replacementMessage = () => tr('这会清除已生成的 ','This will clear the ')+pages.length+tr(' 个动作，重新生成将再次消耗图像额度。确定继续吗？',' completed actions. Generating them again will use your image allowance. Continue?');
    function syncSourceInput() {
      const input=find('#pet-photo');
      try {
        const transfer=new DataTransfer();
        if (source instanceof File) transfer.items.add(source);
        input.files=transfer.files;
      } catch { input.value=''; }
      input.required=!photo;
    }
    async function loadPhoto(event) {
      const file=event.target.files[0];
      syncSourceInput();
      if (!file || busy || confirming || photoLoading || destroyed || editingId) return;
      const version=++photoVersion;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) { error(tr('请选择不超过 10 MB 的 JPG、PNG 或 WebP 图片。','Choose a JPG, PNG or WebP image under 10 MB.')); return; }
      photoLoading=true; renderControls(); error('');
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
        if (destroyed || version !== photoVersion) return;
        if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 36000000) throw new Error('invalid-photo');
        const canvas = document.createElement('canvas'), scale = Math.min(1,1024 / Math.max(bitmap.width,bitmap.height));
        canvas.width = Math.max(1,Math.round(bitmap.width*scale)); canvas.height = Math.max(1,Math.round(bitmap.height*scale));
        canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
        let nextPhoto=canvas.toDataURL('image/png');
        if (nextPhoto.length > 5500000) nextPhoto=canvas.toDataURL('image/jpeg',.9);
        if (!await confirmReplacement(replacementMessage()) || destroyed || version!==photoVersion) return;
        invalidate(); photo=nextPhoto; source=file; syncSourceInput();
        find('.pet-photo-preview').src = photo; find('.pet-photo-preview').hidden = false; find('.pet-photo-empty').hidden = true;
      } catch { if (!destroyed && version === photoVersion) error(tr('无法读取这张图片，请换一张试试。','This image could not be read. Please choose another.')); }
      finally {
        if (bitmap) bitmap.close();
        if (!destroyed && version===photoVersion) { photoLoading=false; renderControls(); notifyChange(); }
      }
    }
    function values() { return { name: find('#pet-custom-name').value.trim(), kind: find('#pet-custom-kind').value, personality: find('#pet-custom-personality').value.trim(), distinctiveFeatures:find('#pet-distinctive-features').value.trim(), imageSource:find('#pet-image-source').value, imageModel: find('#pet-image-model').value.trim() }; }
    const errors = {
      'animation-load-failed':['暂时无法读取已生成的动作图片。原动作仍保留，请检查连接后重试，将继续读取本次结果。','The generated action image could not be loaded. Your original action is kept. Check the connection and retry to retrieve this result.'],
      'custom-edit-missing':['原伙伴已被移除，当前修改草稿仍然保留；未重新创建伙伴或覆盖其他伙伴。','The original companion was removed. This editing draft is kept; no companion was recreated or overwritten.'],
      'custom-edit-conflict':['原伙伴已在别处被修改。为避免覆盖，当前修改草稿仍然保留，尚未保存到伙伴。','The original companion was changed elsewhere. This draft is kept, and its edits have not overwritten the companion.'],
      'pet-draft-clear-failed':['伙伴已保存，但本机恢复草稿还未清理。请再次点击保存重试清理，无需重新生成。','Your companion is saved, but its recovery draft could not be removed. Save again to retry cleanup; no regeneration is needed.'],
      'draft-checkpoint-failed':['无法保存本机恢复草稿，已暂停后续生成以免继续消耗额度。照片和已完成动作仍保留在当前窗口，请检查本机存储后重试。','The recovery draft could not be saved on this device. Generation has paused to avoid using more allowance. Your photo and completed actions are still in this window. Check local storage and retry.'],
      'generation-attempt-limit':['当前动作已达到重试上限，已完成动作仍保留。请检查生成设置，或在确认后重新生成全部动作。','This action has reached its retry limit. Completed actions are still here. Review your generation settings or explicitly choose to regenerate all actions.'],
      'pet-generation-conflict':['这份草稿与本机生成记录不一致，已停止请求并保留现有动作。请检查设置；如需重新生成，请明确点击“重新生成全部动作”并确认。','This draft does not match the local generation record. Requests have stopped and existing actions are kept. Review your settings; to regenerate, explicitly choose Regenerate all actions and confirm.'],
      'pet-generation-journal-corrupt':['本机生成记录无法解析，已停止请求并保留现有动作。请保留当前窗口；如需重新生成，请明确点击“重新生成全部动作”并确认。','The local generation record could not be read correctly. Requests have stopped and existing actions are kept. Keep this window open; to regenerate, explicitly choose Regenerate all actions and confirm.'],
      'pet-generation-read-failed':['暂时无法读取本机生成记录。已完成动作已保留，请检查本机存储后重试，将继续使用同一份生成记录。','The local generation record could not be loaded. Completed actions are kept. Check local storage and retry using the same generation record.'],
      'pet-generation-save-failed':['图像已返回，但本机生成记录未能保存。请保持应用打开，检查本机存储后重试，以接回本次结果。','The image was returned but its local generation record could not be saved. Keep the app open, check local storage and retry to recover this result.'],
      'pet-generation-art-missing':['生成记录中的动作图片已无法读取，现有草稿和其他动作仍保留。请检查本机图片文件；如需重新生成，请明确点击“重新生成全部动作”并确认。','An action image in the generation record is no longer available. Your draft and other actions are kept. Check the local image files; to regenerate, explicitly choose Regenerate all actions and confirm.'],
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
      'invalid-identity-image': ['作为参考的伙伴图像无法读取，照片和已完成动作仍保留。请检查本机图片文件；如需重新生成，请明确点击“重新生成全部动作”并确认。','The companion reference could not be read. Your photo and completed actions are kept. Check the local image files; to regenerate, explicitly choose Regenerate all actions and confirm.'],
      'custom-limit': ['最多保存 12 位自定义伙伴。请先从图鉴移除一位。','You can keep up to 12 custom companions. Remove one from your collection first.']
    };
    async function requestPage(data,pageIndex,attempt,identityImage) {
      controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),330000);
      try {
        const response=await fetch('/api/ai/'+data.imageSource+'-pet-image',{method:'POST',headers:{'Content-Type':'application/json','x-tracer-ai':'1'},body:JSON.stringify({...data,photo,animationVersion,animationPage:pageIndex,generationId,generationAttempt:attempt,...(identityImage?{identityImage}:{})}),signal:controller.signal});
        const result=await response.json(); if(!response.ok)throw new Error(result.error||'generation-failed');
        if(!safeImage(result.image)||result.animationPage!==pageIndex||result.animationVersion!==animationVersion)throw new Error('invalid-animation-response');
        if(destroyed)return;
        await TracerPetAnimation.validatePage(result.image,{version:animationVersion});
        return result;
      } finally {clearTimeout(timeout);controller=undefined;}
    }
    async function regenerateAction() {
      if(busy||confirming||photoLoading||destroyed)return;
      const pageIndex=pendingReplacement?.pageIndex??actions.indexOf(previewAction), data=values();
      if(!pages[pageIndex])return;
      if(!photo||!data.name||(data.imageSource==='personal'&&!data.imageModel)){error(tr('请先填写伙伴名字并确认图像服务设置。','Enter a companion name and check the image provider settings first.'));return;}
      if(pageAttempts[pageIndex]>=1000){error(tr(...errors['generation-attempt-limit']));return;}
      const label=tr(...actionLabels[actions[pageIndex]]);
      if(!pendingReplacement) {
        if(!await confirmAction(tr('只重新生成「','Regenerate only “')+label+tr('」的 16 帧动作，将使用一次图像生成额度。其他动作保持不变，当前动作会保留到新图生成成功。继续吗？','” (16 frames), using one image generation? Other actions stay unchanged, and the original remains until its replacement succeeds.'))||destroyed)return;
        pageAttempts[pageIndex]++;
        pendingReplacement={pageIndex,attempt:pageAttempts[pageIndex],identityImage:generationIdentity};
      }
      showPreview(actions[pageIndex]);error('');setBusy(true);
      find('.pet-create-status').textContent=tr('正在单独重画：','Regenerating: ')+label+tr('。原动作和其他动作仍然保留。','. The original and all other actions are kept.');
      let complete=false;
      try {
        await checkpoint();
        const result=await requestPage(data,pageIndex,pendingReplacement.attempt,pendingReplacement.identityImage);
        if(destroyed)return;
        pages[pageIndex]=result.image;retainedFrames[pageIndex]=16;image=pages.length===groupCount?pages[0]:'';pendingReplacement=null;
        showPreview(actions[pageIndex]);notifyChange();await checkpoint();
        find('.pet-create-status').textContent=tr('已更新「','Updated “')+label+tr('」。其他动作保持不变，请预览后保存。','”. Other actions are unchanged. Preview and save your changes.');
        complete=true;
      } catch(e) {
        if(destroyed)return;
        if(pendingReplacement&&['invalid-animation-image','invalid-animation-sheet','invalid-animation-response'].includes(e.message)) {
          pendingReplacement.attempt=pageAttempts[pageIndex]=Math.min(1000,pageAttempts[pageIndex]+1);
          notifyChange();try {await checkpoint();}catch(checkpointError){e=checkpointError;}
        }
        find('.pet-create-status').textContent=pendingReplacement
          ?tr('原动作和其他动作都已保留。可以重试这一组，或保留原动作。','The original and all other actions are kept. Retry this group or keep the original action.')
          :tr('新动作已生成，草稿暂存需要重试。请保持应用打开后重试保存。','The new action is ready, but draft backup needs a retry. Keep the app open and retry saving.');
        error(['pet-generation-conflict','pet-generation-journal-corrupt','pet-generation-art-missing','invalid-identity-image'].includes(e.message)
          ?tr('此动作的本机生成记录暂时无法复用。可以先保留原动作，再重新选择单组重画；其他动作不会改变。','The local record for this replacement could not be reused. Keep the original action, then start a new replacement for this group; other actions will not change.')
          :errors[e.message]?tr(...errors[e.message]):tr('此动作暂未重新生成成功，请检查连接、图像服务或额度后重试。','This action could not be regenerated. Check your connection, image provider or allowance and retry.'));
      } finally {
        if(!destroyed) {
          setBusy(false);
          if(complete)try {Promise.resolve(options.onComplete?.(read(),status(),{type:'replacement',action:actions[pageIndex],label})).catch(()=>{});}catch{}
        }
      }
    }
    async function generate(event) {
      event.preventDefault(); if (busy || confirming || photoLoading || destroyed) return;
      if(pendingReplacement){await regenerateAction();return;}
      if (pages.length===groupCount) { error(''); showPreview(previewAction); find('#pet-preview-action').focus(); return; }
      if (!photo) { error(tr('请先上传可用的参考照片。','Upload a readable reference photo first.')); return; }
      const data = values();
      if (!data.name || (data.imageSource==='personal'&&!data.imageModel)) { error(tr('请填写伙伴名字和图像模型。','Enter a companion name and image model.')); return; }
      if (pageAttempts[pages.length]>=1000) { error(tr(...errors['generation-attempt-limit'])); return; }
      error(''); setBusy(true);
      find('.pet-animation-progress').hidden=false;
      let complete=false;
      try {
        await checkpoint();
        for (let pageIndex=pages.length; pageIndex<groupCount; pageIndex++) {
          if (destroyed) return;
          const names=tr(...actionLabels[actions[pageIndex]]);
          find('.pet-create-status').textContent=tr('正在生成动作 ','Generating action ')+(pageIndex+1)+'/'+groupCount+' — '+names;
          let result;
          try {
            result=await requestPage(data,pageIndex,pageAttempts[pageIndex],pageIndex?generationIdentity:'');
          } catch (e) {
            if (!destroyed && ['invalid-animation-image','invalid-animation-sheet','invalid-animation-response'].includes(e.message)) {
              pageAttempts[pageIndex]=Math.min(1000,pageAttempts[pageIndex]+1);
              notifyChange(); await checkpoint();
            }
            throw e;
          }
          if (destroyed) return;
          pages.push(result.image); image=pages.length===groupCount?pages[0]:''; find('.pet-animation-progress').value=pages.length;
          if(pageIndex===0)generationIdentity=result.image;
          showPreview(actions[pageIndex]);
          notifyChange(); await checkpoint();
        }
        if (destroyed) return;
        image=pages[0]; find('.pet-adopt').hidden=previewBroken; showPreview('idle');
        if (!previewBroken) find('.pet-create-status').textContent=tr('16 种动作已就绪。切换预览，检查形象和动作后保存。','All 16 behaviors are ready. Preview each action and check the likeness before saving.');
        complete=true;
      } catch (e) {
        if (['pet-generation-conflict','pet-generation-journal-corrupt','pet-generation-art-missing','invalid-identity-image'].includes(e.message)) restartSuggested=true;
        if (!destroyed) { find('.pet-create-status').textContent=pages.length?tr('已完成 ','Completed ')+pages.length+'/'+groupCount+tr(' 个动作；继续时只生成剩余动作。',' actions; continue to generate the remaining actions.'):''; error(errors[e.message] ? tr(...errors[e.message]) : data.imageSource==='codex'?tr('订阅生成未完成，请稍后重试或检查“我的 AI”。照片和已完成动作已保留，未改用 API。','Subscription generation did not finish. Retry later or check My AI. Your photo and completed actions remain; no API was used.'):tr('没有生成成功。请检查 API 的图像编辑权限、模型或额度后重试；照片和已完成动作已保留。','Generation did not finish. Check your API image editing access, model or balance. Your photo and completed actions are still here.')); }
      } finally {
        if (!destroyed) {
          setBusy(false);
          if (!destroyed && complete && completedGeneration!==generationId) {
            completedGeneration=generationId;
            try { Promise.resolve(options.onComplete?.(read(),status())).catch(()=>{}); } catch {}
          }
        }
      }
    }
    root.onclick = async event => {
      const b = event.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'cancel-create') { options.onClose?.(); return; }
      if (b.dataset.act === 'open-ai') { options.onAI?.(find('#pet-image-source').value); return; }
      if (busy || confirming || photoLoading || destroyed) return;
      if(b.dataset.act==='regenerate-action') {await regenerateAction();return;}
      if(b.dataset.act==='keep-action'&&pendingReplacement) {
        const previous=pendingReplacement;pendingReplacement=null;error('');setBusy(true,true);
        try {await checkpoint();find('.pet-create-status').textContent=tr('已保留原动作，其他动作也没有改变。','Kept the original action. All other actions are unchanged.');}
        catch {pendingReplacement=previous;error(tr(...errors['draft-checkpoint-failed']));}
        finally {if(!destroyed)setBusy(false);}
        return;
      }
      if (b.dataset.act === 'restart-generation') {
        if(editingId)return;
        if (await confirmAction(replacementMessage()) && !destroyed) { invalidate(); error(''); }
        return;
      }
      if (b.dataset.act === 'reload-preview') { error(''); showPreview(previewAction); notifyChange(); return; }
      if (b.dataset.act === 'discard-draft' && options.onDiscard) {
        if (!await confirmAction(editingId?tr('放弃本次动作修改吗？原伙伴和养成进度会保留，只移除这份编辑草稿。','Discard these action edits? Your saved companion and care progress stay unchanged; only this editing draft is removed.'):tr('确定放弃这份草稿吗？本机暂存的参考照片、设置和全部生成进度都将移除。','Discard this draft? The locally stored reference photo, settings and all generation progress will be removed.')) || destroyed) return;
        let discarded=false;
        setBusy(true,true);
        try { await options.onDiscard(); discarded=true; }
        catch { if (!destroyed) error(tr('未能清除本机草稿，请检查本机存储后重试。照片和动作仍然保留。','Could not remove the local draft. Check local storage and retry. Your photo and actions are still here.')); }
        finally {
          if (!destroyed) { busy=false; saving=false; renderControls(); if (!discarded) notifyChange(); }
        }
        return;
      }
      if (b.classList.contains('pet-adopt') && image && pages.length===groupCount && !previewBroken && !pendingReplacement) {
        if (!values().name) { error(tr('请填写伙伴名字。','Enter a companion name.')); find('#pet-custom-name').focus(); return; }
        let adopted=false;
        error(''); setBusy(true,true);
        try {
          await options.onAdopt({ id:recordId,...values(),image,animation:{version:animationVersion,pages:[...pages],...(retainedFrames.some(count=>count!==16)?{retainedFrames:[...retainedFrames]}:{})} });
          adopted=true;
        } catch (e) {
          if (!destroyed) error(errors[e.message] ? tr(...errors[e.message]) : tr('未能保存伙伴，照片和全部动作已保留。请检查本机存储后再次点击保存。','Could not save your companion. Your photo and all actions are still here. Check local storage, then save again.'));
        } finally {
          if (!destroyed) {
            busy=false; saving=false; renderControls();
            if (!adopted) notifyChange();
          }
        }
      }
    };
    find('.pet-create-form').onsubmit = generate;
    find('#pet-photo').onchange = loadPhoto;
    async function fieldChanged(selector, affectsImages) {
      const input=find(selector), before=acceptedFields.get(selector), next=input.value;
      if (destroyed) return;
      if (busy || confirming || photoLoading) { input.value=before; return; }
      if (next===before) return;
      if(editingId&&['#pet-custom-kind','#pet-distinctive-features'].includes(selector)){input.value=before;return;}
      if(editingId&&['#pet-image-source','#pet-image-model'].includes(selector)) {
        input.value=before;
        if(pendingReplacement&&!await confirmAction(tr('更换图像服务会结束当前待重试的请求，已经生成的所有动作仍会保留。继续吗？','Changing image settings ends the pending retry. All existing actions will be kept. Continue?')))return;
        if(destroyed)return;
        input.value=next;generationId=newId();pageAttempts=Array(groupCount).fill(0);pendingReplacement=null;affectsImages=false;
      }
      if (affectsImages) {
        input.value=before;
        if (!await confirmReplacement(replacementMessage()) || destroyed) return;
        input.value=next; invalidate();
      }
      acceptedFields.set(selector,next);
      renderControls();
      error('');
      if (selector==='#pet-custom-kind') kindHelp();
      if (selector==='#pet-image-source') providerStatus();
    }
    const fieldSelectors=['#pet-custom-name','#pet-custom-kind','#pet-custom-personality','#pet-distinctive-features','#pet-image-model','#pet-image-source'];
    for (const selector of fieldSelectors) find(selector).addEventListener(selector==='#pet-image-source'?'change':'input',()=>fieldChanged(selector,!['#pet-custom-name','#pet-custom-personality'].includes(selector)));
    if (options.draft) {
      const draft=options.draft;
      for (const [selector,key] of [['#pet-custom-name','name'],['#pet-custom-kind','kind'],['#pet-custom-personality','personality'],['#pet-distinctive-features','distinctiveFeatures'],['#pet-image-source','imageSource'],['#pet-image-model','imageModel']]) if (typeof draft[key]==='string') find(selector).value=draft[key];
      if (draft.source instanceof File) source=draft.source;
      if (draft.photo) { photo=draft.photo; find('.pet-photo-preview').src=photo; find('.pet-photo-preview').hidden=false; find('.pet-photo-empty').hidden=true; }
      if (draft.animationVersion===animationVersion && Array.isArray(draft.pages) && draft.pages.length<=groupCount && draft.pages.every(safeImage)) {
        pages=[...draft.pages]; image=pages.length===groupCount?pages[0]:'';
        generationIdentity=safeImage(draft.generationIdentity)?draft.generationIdentity:pages[0]||'';
        if(Array.isArray(draft.retainedFrames)&&draft.retainedFrames.length===groupCount&&draft.retainedFrames.every(count=>[1,4,16].includes(count)))retainedFrames=[...draft.retainedFrames];
        const pending=draft.pendingReplacement;
        if(pending&&Number.isInteger(pending.pageIndex)&&pages[pending.pageIndex]&&pending.attempt===pageAttempts[pending.pageIndex]&&pending.attempt>0&&pending.identityImage===generationIdentity)pendingReplacement={pageIndex:pending.pageIndex,attempt:pending.attempt,identityImage:pending.identityImage};
        if (pages.length) {
          showPreview(pendingReplacement?actions[pendingReplacement.pageIndex]:pages[actions.indexOf(draft.previewAction)]?draft.previewAction:'idle');
          find('.pet-animation-progress').value=pages.length; find('.pet-animation-progress').hidden=false;
          find('.pet-create-status').textContent=pages.length===groupCount
            ? tr('全部动作已恢复，可以预览并保存伙伴。','All actions have been restored. Preview them and save your companion.')
            : tr('已恢复 ','Restored ')+pages.length+'/'+groupCount+tr(' 个动作；点击继续生成剩余动作。',' actions. Continue to generate the remaining actions.');
          if (pages.length===groupCount) completedGeneration=generationId;
          if(pendingReplacement)find('.pet-create-status').textContent=tr('单组重画尚未完成，原动作和其他动作已恢复。可继续重试，或保留原动作。','The action replacement is unfinished. The original and all other actions are restored. Retry or keep the original action.');
        }
      }
      if (typeof draft.error==='string' && draft.error) error(draft.error);
    }
    syncSourceInput();
    for (const selector of fieldSelectors) acceptedFields.set(selector,find(selector).value);
    kindHelp();
    renderControls();
    providerStatus();
    initialized=true;
    return {
      read, status,
      markSaved(signature) {
        if(destroyed||!/^[a-f0-9]{64}$/.test(signature))return;
        editingId=recordId;editingSignature=signature;showEditingMode();renderControls();
      },
      focus() { if (!destroyed) (find('.pet-adopt').hidden ? find('#pet-custom-name').value ? find('.pet-generate') : find('#pet-custom-name') : find('.pet-adopt')).focus(); },
      destroy() {
        if (destroyed) return;
        lastDraft=read(); destroyed=true; photoVersion++; previewVersion++; busy=false; photoLoading=false; photo=''; source=undefined;
        controller?.abort(); previewPlayer?.destroy(); root.onclick=null; root.replaceChildren();
      }
    };
  };
})();
