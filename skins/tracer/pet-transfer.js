(function () {
  'use strict';
  window.TracerPetTransfer = function (root, options) {
    const tr = (zh, en) => options.language === 'zh' ? zh : en;
    const find = selector => root.querySelector(selector), exporting = !!options.profile;
    let destroyed = false, busy = false, controller, pack = null, inspected = null, player = null, imported = null;
    const errors = {
      'invalid-pet-package': ['这不是有效的伙伴文件。', 'This is not a valid companion file.'],
      'unsupported-pet-package': ['此文件来自更新的版本，请先更新 Tracer。', 'Update Tracer to open this newer companion format.'],
      'damaged-pet-package': ['图像校验失败，文件可能不完整。请重新获取导出文件。', 'An image checksum failed. Please get a fresh export.'],
      'pet-package-too-large': ['伙伴文件不能超过 257 MB。', 'Companion files must be no larger than 257 MB.'],
      'invalid-animation-sheet': ['动作图存在缺帧、透明背景或分格边界问题，请让分享者检查并修复动作图。', 'The artwork has frame, transparency, or boundary problems. Ask the sender to check and repair the animation sheets.'],
      'pet-art-missing': ['本机有动作图缺失，无法完整导出。', 'Some local artwork is missing. A complete export could not be made.'],
      'pet-package-save-failed': ['未能保存图像，请检查磁盘空间后重试。', 'Could not save the artwork. Check disk space and retry.'],
      'custom-limit': ['已保存 12 位自定义伙伴，请先移除一位。', 'You have 12 custom companions. Remove one before importing.'],
      'readonly': ['当前为只读模式，不能导入伙伴。', 'Companions cannot be imported in read-only mode.']
    };
    root.className = 'pet-home pet-transfer';
    root.innerHTML = '<div class="pet-top"><span>'+tr(exporting?'导出伙伴':'导入伙伴',exporting?'Export companion':'Import companion')+'</span><button type="button" data-transfer-close aria-label="'+tr('关闭','Close')+'">×</button></div>'
      + '<div class="pet-transfer-body">'+(!exporting?'<label for="pet-package-file">'+tr('伙伴文件','Companion file')+'</label><input id="pet-package-file" type="file" accept=".tracer-pet,application/json">':'')
      + '<div class="pet-transfer-preview" hidden><div class="pet-transfer-art"></div><div class="pet-transfer-info"><h2></h2><p class="pet-transfer-kind"></p><p class="pet-transfer-personality"></p></div></div>'
      + '<p class="pet-transfer-privacy">'+tr('仅包含名字、类型、性格与形象动作图。不含原照片、聊天、账号或养成进度。导入和日常陪伴无需 AI 账号；AI 聊天需另行配置。','Includes name, type, personality and artwork only. No source photo, chat, account or care progress. Import and everyday companionship need no AI account; AI chat requires a connection.')+'</p>'
      + '<p class="pet-transfer-status" role="status"></p><p class="pet-transfer-error" role="alert"></p>'
      + '<div class="pet-transfer-actions"><button type="button" data-transfer-close>'+tr('返回','Back')+'</button><button type="button" class="pet-transfer-submit"'+(!exporting?' disabled':'')+'>'+tr(exporting?'下载伙伴文件':'导入到图鉴',exporting?'Download companion file':'Import to collection')+'</button></div></div>';
    function setBusy(value) {
      busy = value; root.setAttribute('aria-busy', String(value));
      if (find('#pet-package-file')) find('#pet-package-file').disabled = value;
      find('.pet-transfer-submit').disabled = value || (!exporting && !inspected);
    }
    function error(e) {
      find('.pet-transfer-error').textContent = errors[e.message] ? tr(...errors[e.message]) : tr('操作未完成，请检查本地连接或存储后重试。','Could not complete this operation. Check the local connection or storage and retry.');
      find('.pet-transfer-status').textContent = '';
    }
    async function request(action, data) {
      controller = new AbortController();
      const response = await fetch('/api/pet-package/'+action, { method:'POST', headers:{'content-type':'application/json','x-tracer-pet':'1'}, body:JSON.stringify(data), signal:controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'request-failed');
      return result;
    }
    function describe(profile, animated, behaviors) {
      find('.pet-transfer-preview').hidden = false;
      find('h2').textContent = profile.name;
      find('.pet-transfer-kind').textContent = tr(profile.kind==='humanoid'?'人型伙伴':'生物伙伴',profile.kind==='humanoid'?'Humanoid companion':'Creature companion')+' · '+(animated?behaviors+tr(' 种动作',' behaviors'):tr('静态形象','Still portrait'));
      find('.pet-transfer-personality').textContent = profile.personality;
    }
    async function loadFile() {
      const file = find('#pet-package-file').files[0];
      pack = null; inspected = null; imported = null; find('.pet-transfer-preview').hidden = true; find('.pet-transfer-art').replaceChildren();
      find('.pet-transfer-error').textContent = ''; find('.pet-transfer-status').textContent = ''; setBusy(false);
      if (!file) return;
      setBusy(true); find('.pet-transfer-status').textContent = tr('正在检查伙伴文件…','Checking companion file…');
      try {
        if (file.size > 257 * 1024 * 1024) throw new Error('pet-package-too-large');
        let candidate;
        try { candidate = JSON.parse(await file.text()); } catch { throw new Error('invalid-pet-package'); }
        if (destroyed) return;
        const summary = await request('inspect', candidate);
        if (destroyed) return;
        let thumbnail;
        for (const [index, item] of candidate.artwork.images.entries()) {
          const binary = atob(item.data), bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
          const blob = new Blob([bytes], {type:'image/png'});
          if (summary.animated) await TracerPetAnimation.validateBlob(blob, { version: summary.animationVersion });
          if (destroyed) return;
          // Validation already decodes each animated sheet; only the thumbnail needs a bitmap.
          if (index === 0) {
            const bitmap = await createImageBitmap(blob);
            try {
              thumbnail = document.createElement('canvas'); thumbnail.width = thumbnail.height = 240;
              const context = thumbnail.getContext('2d'); context.imageSmoothingEnabled = false;
              const width = bitmap.width / (summary.animated ? 4 : 1), height = bitmap.height / (summary.animated ? 4 : 1);
              const scale = 240 / Math.max(width, height);
              context.drawImage(bitmap, 0, 0, width, height, (240-width*scale)/2, (240-height*scale)/2, width*scale, height*scale);
              thumbnail.setAttribute('role','img'); thumbnail.setAttribute('aria-label',summary.profile.name);
            } finally { bitmap.close(); }
          }
        }
        if (destroyed) return;
        pack = candidate; inspected = summary;
        describe(summary.profile, summary.animated, summary.behaviors); find('.pet-transfer-art').replaceChildren(thumbnail);
        find('.pet-transfer-status').textContent = options.has(summary.profile.id) ? tr('图鉴中已有这位伙伴，继续将打开已有伙伴。','Already in your collection. Continue to open the existing companion.') : tr('文件已就绪，养成进度将从新伙伴开始。','Ready to import with fresh care progress.');
        find('.pet-transfer-submit').textContent = options.has(summary.profile.id) ? tr('打开已有伙伴','Open existing companion') : tr('导入到图鉴','Import to collection');
      } catch (e) { if (!destroyed) error(e); }
      finally { if (!destroyed) setBusy(false); }
    }
    async function submit() {
      if (busy || (!exporting && !inspected)) return;
      setBusy(true); find('.pet-transfer-error').textContent = '';
      find('.pet-transfer-status').textContent = tr(exporting?'正在打包全部形象…':'正在保存伙伴…',exporting?'Packing the complete artwork…':'Saving companion…');
      try {
        if (exporting) {
          const result = await request('export', options.profile);
          if (destroyed) return;
          const url = URL.createObjectURL(new Blob([JSON.stringify(result)], {type:'application/json'})), link = document.createElement('a');
          link.href = url; link.download = (options.profile.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'') || 'companion')+'.tracer-pet';
          root.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
          find('.pet-transfer-status').textContent = tr('已发起下载，可将伙伴文件发给朋友。','Download started. The companion file is ready to share.');
        } else {
          if (options.has(inspected.profile.id)) { options.onAdopt(inspected.profile); return; }
          if (!options.canAdd()) throw new Error('custom-limit');
          if (!imported) imported = await request('import', pack);
          if (!destroyed) options.onAdopt(imported);
        }
      } catch (e) { if (!destroyed) error(e); }
      finally { if (!destroyed) setBusy(false); }
    }
    root.querySelectorAll('[data-transfer-close]').forEach(button=>button.onclick=options.onClose);
    find('.pet-transfer-submit').onclick = submit;
    if (!exporting) find('#pet-package-file').onchange = loadFile;
    else {
      const profile = options.profile;
      describe(profile, !!profile.animation, profile.animation ? profile.animation.pages.length*(profile.animation.version === 2 ? 1 : 4) : 1);
      if (profile.animation) { player = TracerPetAnimation.create({...profile, label:profile.name, animated:false}); find('.pet-transfer-art').appendChild(player.element); }
      else { const img=document.createElement('img'); img.src=profile.image; img.alt=profile.name; find('.pet-transfer-art').appendChild(img); }
    }
    return { destroy() { destroyed=true; controller?.abort(); player?.destroy(); pack=null; inspected=null; imported=null; root.replaceChildren(); } };
  };
})();
