(function () {
  'use strict';
  const T = window.Tracer, A = window.TracerAccount;
  const tr = (zh, en) => TracerLocale.language() === 'zh' ? zh : en;
  const dialog = document.createElement('dialog');
  dialog.id = 'backup-dialog'; dialog.className = 'account-dialog backup-dialog';
  dialog.setAttribute('aria-labelledby', 'backup-heading'); document.body.append(dialog);
  let portableSelection=null,committing=false;
  const fileRequest=async value=>{const result=await TracerBackupFiles.request({...value,scope:A.scope,generation:A.context.generation||0,restoreId:A.context.restoreId||''});if(!result.ok)throw new Error(result.error);return result;};
  window.TracerBackupFiles?.onProgress(p=>{committing=p.phase==='commit';const labels={export:tr('正在复制资源','Copying images'),validate:tr('正在校验资源','Checking images'),snapshot:tr('正在保存恢复前快照','Saving pre-restore snapshot'),restore:tr('正在恢复资源','Restoring images'),commit:tr('正在提交数据，请勿关闭','Committing data; keep this window open')};notice((labels[p.phase]||tr('正在处理','Working'))+' '+p.done+'/'+p.total);const cancel=dialog.querySelector('#backup-files-cancel');if(cancel)cancel.disabled=!busy||committing;});
  let busy = false, selected = null, expected = '', preview = null;
  const errors = {
    'backup-cancelled':['操作已取消，当前数据未更改。','Cancelled. Current data is unchanged.'],
    'backup-busy':['另一个文件操作仍在进行。','Another file operation is in progress.'],
    'backup-art-missing': ['历史资源缺失，未创建不完整备份。','A legacy resource is missing. No incomplete backup was created.'],
    'backup-invalid-assets': ['备份资源校验失败，当前数据未更改。','Backup resource validation failed. Your current data is unchanged.'],
    'backup-art-conflict': ['备份资源路径冲突，已停止恢复。','A backup resource conflicts with an existing file. Restore stopped.'],
    'backup-invalid': ['这不是可恢复的 Tracer 备份。旧版资料导出仅供查阅。', 'This is not a restorable Tracer backup. Legacy profile exports are for reference only.'],
    'backup-invalid-workspace': ['备份中的工作区格式无效，原数据未更改。', 'The workspace in this backup is invalid. Your current data is unchanged.'],
    'backup-invalid-preferences': ['备份设置无法读取，原数据未更改。', 'Backup preferences could not be read. Your current data is unchanged.'],
    'backup-version-unsupported': ['当前版本不支持此备份格式。请使用创建备份时或更新的 Tracer。', 'This backup version is not supported. Use the version of Tracer that created it or a newer one.'],
    'backup-checksum-mismatch': ['备份内容损坏或被修改，不能恢复。', 'The backup is damaged or has been modified and cannot be restored.'],
    'backup-untrusted': ['备份无法通过来源校验。仅支持当前安装创建的未修改备份。', 'The backup could not be verified. Use an unmodified backup from this installation.'],
    'backup-scope-mismatch': ['备份属于另一个空间。请切换到原账户；暂不支持跨账户迁移。', 'This backup belongs to another space. Switch to its original account. Cross-account migration is not supported yet.'],
    'backup-stale': ['预览后工作区发生了变化。请重新选择文件并核对预览。', 'Your workspace changed after the preview. Select the file again to review a fresh preview.'],
    'backup-not-found': ['找不到这份快照。', 'This snapshot could not be found.'],
    'backup-confirmation-required': ['请先确认恢复范围。', 'Confirm the restore scope first.'],
    'account-data-busy': ['还有保存或生成操作正在进行，请稍后重试。', 'Saving or generation is still in progress. Try again when it finishes.'],
    'backup-storage-unavailable': ['无法完成本地备份或恢复。请检查磁盘空间和权限后重试。', 'The local backup or restore could not finish. Check disk space and permissions, then retry.'],
    'request-too-large': ['请选择小于 8 MB 的备份。', 'Choose a backup smaller than 8 MB.'],
    'backup-too-large': ['恢复后的工作区超出容量限制，原数据未更改。请先减少记录或联系支持。', 'The workspace or legacy resources exceed this backup size limit. No partial backup or restore was created. Reduce records or use a full file backup.'],
    'save-pending': ['工作区尚未保存，请先处理保存提示。', 'Save your workspace before continuing.'],
    'account-changed': ['空间已改变，请重新打开应用。', 'Your space changed. Reopen the app.'],
    'readonly': ['当前为只读模式，无法恢复。', 'This instance is read only and cannot restore data.']
  };
  function node(tag, parent, text, className) {
    const element = document.createElement(tag); if (text !== undefined) element.textContent = text;
    if (className) element.className = className; if (parent) parent.append(element); return element;
  }
  function button(parent, id, text, action, primary) {
    const element = node('button', parent, text, 'account-button' + (primary ? ' account-primary' : ''));
    element.type = 'button'; element.id = id; element.onclick = action; return element;
  }
  function notice(text, error) {
    const element = dialog.querySelector('#backup-notice'); if(!element)return; element.hidden = !text;
    element.textContent = text; element.classList.toggle('error', !!error);
  }
  function controls() {
    dialog.querySelectorAll('button,input').forEach(element => element.disabled = busy);
    const restore = dialog.querySelector('#backup-restore'), check = dialog.querySelector('#backup-confirm');
    if (restore) restore.disabled = busy || !selected || !expected || !check.checked;
    const cancel=dialog.querySelector('#backup-files-cancel');if(cancel)cancel.disabled=!busy||committing;
    const portableRestore=dialog.querySelector('#backup-files-restore'),portableConfirm=dialog.querySelector('#backup-files-confirm');if(portableRestore)portableRestore.disabled=busy||!portableSelection||!portableConfirm?.checked;
    dialog.setAttribute('aria-busy', String(busy));
  }
  async function run(callback) {
    if (busy) return; committing=false;busy = true; controls(); notice('');
    try { await callback(); }
    catch (error) {
      A.resume();
      if (error.message === 'backup-stale') { expected = ''; selected = null; }
      notice(errors[error.message] ? tr(...errors[error.message]) : tr('操作未完成。请稍后重试。', 'The operation did not finish. Please try again.'), true);
    } finally { busy = false; controls(); }
  }
  async function flush() {
    await T.ready; await A.ready;
    if (A.locked || A.switching || T.store.lost || T.store.conflict) throw new Error('save-pending');
    if (T.fishing?.prepareAccountSwitch) await T.fishing.prepareAccountSwitch();
    if (T.store.dirty) { clearTimeout(T.store.timer); T.saveNow(); }
    const deadline = Date.now() + 12000;
    while (T.store.inflight && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 40));
    if (T.store.dirty || T.store.inflight || T.store.lost || T.store.conflict) throw new Error('save-pending');
  }
  function preferences() {
    const value = A.backupPreferences(), focus = T.focus?.read();
    if (focus) { focus.remaining = TracerFocus.remaining(focus, Date.now()); value['tracer.focus.v1'] = JSON.stringify(focus); }
    return TracerBackupPreferences.clean(value);
  }
  function download(backup, prefix) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const link = node('a', document.body); link.href = url;
    link.download = (prefix || 'tracer-backup-') + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function showPreview() {
    const host = dialog.querySelector('#backup-preview'); host.replaceChildren(); host.hidden = !preview;
    if (!preview) return;
    node('h3', host, tr('恢复预览', 'Restore preview'));
    node('p', host, tr('备份时间：', 'Created: ') + new Date(preview.createdAt).toLocaleString(), 'account-help');
    const table = node('dl', host, undefined, 'backup-counts');
    const current = T.store.base || T.store.data;
    [['tasks', '任务', 'Tasks'], ['projects', '项目', 'Projects'], ['notes', '笔记', 'Notes'], ['inbox', '收集项', 'Inbox items']].forEach(([key, zh, en]) => {
      node('dt', table, tr(zh, en));
      node('dd', table, (current[key] || []).length + ' → ' + (preview.counts[key] || 0));
    });
    node('dt', table, tr('备份中的专注记录', 'Focus sessions in backup')); node('dd', table, String(preview.counts.focusSessions || 0));
    [['rods','鱼竿','Rods'],['fish','渔获','Catches'],['fry','鱼苗与养鱼记录','Fry and fish care'],['ponds','鱼塘','Ponds']].forEach(([key,zh,en])=>{node('dt',table,tr(zh,en));node('dd',table,String(preview.counts[key]||0));});
    node('p', host, tr('任务、笔记、完成历史、花园和钓鱼收藏将一起回到备份时点，包括金币、鱼竿盲盒记录、鱼饵、渔获、鱼苗、成长、放生、已珍藏鱼塘和小屋，不与当前资产叠加。专注恢复为暂停状态。', 'Tasks, notes, history, garden and fishing collections return to this snapshot, including coins, rod box receipts, bait, catches, fry, growth, releases, collected ponds and cabins. Assets are replaced, not added. Focus resumes paused.'), 'account-help');
    node('p', host, tr('账户资料、登录和 AI 配置保留。旧版备份资源仍可校验与保存。音乐文件、阅读书签、草稿、AI 对话和许可证不包含在内。', 'Account profile, sign-in and AI settings stay as they are. Legacy backup resources remain supported. Music files, reader bookmarks, drafts, AI chats and licenses are excluded.'), 'account-help');
    node('p', host, tr('恢复前会先保存一份可下载的快照。其他已打开窗口将停止保存；旧工作区草稿会隔离保留，不自动合并。', 'A downloadable snapshot is saved before restoring. Other open windows stop saving; old workspace drafts are kept separately and are not merged automatically.'), 'account-help');
    const label = node('label', host, undefined, 'account-check-label'), check = node('input', label);
    check.type = 'checkbox'; check.id = 'backup-confirm';
    node('span', label, tr('我已核对范围，确认用这份备份替换当前工作区。', 'I reviewed the scope and want to replace this workspace with the backup.'));
    check.onchange = controls;
    button(host, 'backup-restore', tr('保存快照并恢复', 'Save snapshot & restore'), () => run(restore), true);
    controls();
  }
  async function restore() {
    if (!selected || !expected || !dialog.querySelector('#backup-confirm').checked) return;
    await flush(); const currentPreferences = preferences(); A.suspend();
    try {
      await A.api('backup-restore', { backup: selected, expected, currentPreferences, confirm: true });
    } catch (error) {
      // A disconnected response may follow a successful atomic commit. Check
      // the server before allowing this old view to resume writing.
      try {
        const latest = await A.api('session');
        if (latest.scope === A.scope && (latest.restoreId || '') !== (A.context.restoreId || '')) { A.signal(); location.reload(); return; }
      } catch (_) { A.lock(); }
      throw error;
    }
    A.signal(); location.reload();
  }
  function open() {
    if (busy || A.locked) return;
    selected = null; expected = ''; preview = null; portableSelection=null;committing=false;dialog.replaceChildren();
    const header = node('div', dialog, undefined, 'account-heading'), titles = node('div', header);
    node('p', titles, tr('保留进展', 'KEEP YOUR PROGRESS'), 'account-eyebrow');
    node('h2', titles, tr('备份与恢复', 'Back up & restore')).id = 'backup-heading';
    button(header, 'backup-close', '×', () => dialog.close()).setAttribute('aria-label', tr('关闭', 'Close'));
    const status = node('p', dialog, '', 'account-notice'); status.id = 'backup-notice'; status.setAttribute('role', 'status'); status.hidden = true;
    const content = node('div', dialog, undefined, 'backup-content');
    node('p', content, tr('当前空间：', 'Current space: ') + (A.context.user?.profile.workspaceName || A.context.user?.profile.nickname || tr('游客', 'Guest')), 'backup-space');
    node('p', content, tr('JSON快照用于原安装的同一空间。完整文件备份可迁移到另一安装的当前空间，不导入登录身份或产品授权。请另存一份；备份文件未加密。', 'JSON snapshots require the original installation and space. Full file backups can migrate to the current space in another installation without importing sign-in or licenses. Keep a separate copy; files are not encrypted.'), 'account-help');
    node('p', content, tr('包含任务、项目、笔记、花园、专注记录和完整钓鱼进展：鱼竿、鱼饵、盲盒、渔获、鱼苗、成长、放生、鱼塘珍藏和小屋。工作区及恢复设置最多4 MiB；JSON备份总计最多8 MiB，旧版图片最多6 MiB。完整文件备份支持最多512 MiB历史图片。超限会明确拒绝，不会漏存。音乐、阅读书签、草稿、AI聊天及配置、登录身份和产品授权不包含在内。', 'Includes tasks, projects, notes, garden, focus records and all fishing progress: rods, bait, boxes, catches, fry, growth, releases, pond collections and cabins. Workspace and restore settings allow 4 MiB. JSON backups allow 8 MiB total and 6 MiB of legacy images; full file backups allow 512 MiB of legacy images. Oversized data is rejected explicitly. Music, bookmarks, drafts, AI chats/settings, sign-in and licenses are excluded.'), 'account-help');
    const actions = node('div', content, undefined, 'backup-actions');
    button(actions, 'backup-export', tr('下载备份', 'Download backup'), () => run(async () => {
      await flush(); const result = await A.api('backup-export', { preferences: preferences() });
      download(result.backup); notice(tr('备份已准备好。请保存下载文件。', 'Backup prepared. Save the downloaded file.'));
    }), true);
    if(window.TracerBackupFiles){
      button(actions,'backup-files-export',tr('导出完整文件备份','Export full file backup'),()=>run(async()=>{await flush();const result=await fileRequest({action:'export',preferences:preferences()});notice(result.cancelled?tr('已取消','Cancelled'):tr('完整备份已保存：','Complete backup saved: ')+result.output);}),true);
      button(actions,'backup-files-choose',tr('选择完整备份文件夹','Choose full backup folder'),()=>run(async()=>{
        await flush();const result=await fileRequest({action:'choose'});if(result.cancelled)return;portableSelection=result;
        const panel=dialog.querySelector('#backup-files-preview');panel.replaceChildren();node('p',panel,tr('恢复来源：','Restore source: ')+result.source);
        node('p',panel,result.tasks+' '+tr('任务','tasks')+' / '+(result.rods||0)+' '+tr('鱼竿','rods')+' / '+(result.fish||0)+' '+tr('渔获','catches')+' / '+(result.ponds||0)+' '+tr('鱼塘','ponds'));
        node('p',panel,tr('将替换当前空间的任务、花园、金币与完整钓鱼进展，包括鱼竿、鱼饵、渔获、鱼苗、放生、魚塘珍藏和小屋。不会导入账号、密码或AI密钥。恢复前保留快照。','Replaces this space’s tasks, garden, coins and all fishing progress, including rods, bait, catches, fry, releases, pond collections and cabins. No identity, passwords or AI keys imported. A snapshot is saved first.'));
        const label=node('label',panel),check=node('input',label);check.type='checkbox';check.id='backup-files-confirm';node('span',label,tr('确认替换当前空间的数据','Confirm replacing this space’s data'));
        const restore=button(panel,'backup-files-restore',tr('保存快照并恢复','Save snapshot & restore'),()=>run(async()=>{if(!check.checked||!portableSelection)return;await flush();A.suspend();try{await fileRequest({action:'restore',id:portableSelection.id,confirm:true,preferences:preferences()});A.signal();location.reload();}catch(e){A.resume();throw e;}}),true);
        restore.disabled=true;check.onchange=controls;button(panel,'backup-files-back',tr('返回选择','Back to selection'),()=>{portableSelection=null;panel.replaceChildren();controls();});
      }));
      button(actions,'backup-files-cancel',tr('取消文件操作','Cancel file operation'),async()=>{if(!busy||committing)return;try{await TracerBackupFiles.request({action:'cancel'});notice(tr('正在取消，请稍候。','Cancelling. Please wait.'));}catch{notice(tr('取消请求未完成，请等待操作结果。','Cancel request did not finish. Wait for the operation result.'),true);}});
      node('section',content,undefined,'backup-preview').id='backup-files-preview';
    }
    button(actions, 'backup-snapshots', tr('恢复前的快照', 'Pre-restore snapshots'), () => run(async () => {
      const result = await A.api('backup-list'), host = dialog.querySelector('#backup-snapshot-list'); host.replaceChildren();
      if (!result.snapshots.length) node('p', host, tr('尚无恢复前快照。首次恢复时会自动创建。', 'No snapshots yet. One will be created before your first restore.'), 'account-help');
      result.snapshots.forEach(item => button(host, 'backup-snapshot-' + item.id, new Date(item.createdAt).toLocaleString() + tr(' · 下载', ' · Download'), () => run(async () => {
        const result = await A.api('backup-download', { id: item.id }); download(result.backup, 'tracer-before-restore-');
      })));
    }));
    node('div', content, undefined, 'backup-snapshot-list').id = 'backup-snapshot-list';
    node('h3', content, tr('选择备份并预览', 'Choose a backup to preview'));
    const label = node('label', content, tr('Tracer 备份文件（JSON，最大 8 MB）', 'Tracer backup file (JSON, up to 8 MB)'), 'account-field');
    const input = node('input', label); input.type = 'file'; input.accept = '.json,application/json'; input.id = 'backup-file';
    input.onchange = () => {
      const file = input.files[0]; selected = null; expected = ''; preview = null; showPreview();
      if (!file) return;
      run(async () => {
        if (file.size > 8 * 1024 * 1024) throw new Error('request-too-large');
        let backup; try { backup = JSON.parse(await file.text()); } catch (_) { throw new Error('backup-invalid'); }
        await flush(); const result = await A.api('backup-inspect', { backup });
        selected = backup; expected = result.expected; preview = result.preview; showPreview();
      });
    };
    const host = node('section', content, undefined, 'backup-preview'); host.id = 'backup-preview'; host.hidden = true;
    dialog.showModal(); controls(); dialog.querySelector('#backup-export').focus();
  }
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  T.backup = { open };
})();




