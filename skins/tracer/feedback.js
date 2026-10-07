(function () {
  'use strict';
  const T = window.Tracer, M = window.TracerFeedbackModel, trigger = document.getElementById('feedback-open');
  if (!T || !M || !trigger) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'feedback-dialog'; dialog.className = 'feedback-dialog'; dialog.setAttribute('aria-labelledby', 'feedback-heading'); document.body.append(dialog);
  const tr = (zh, en) => window.TracerLocale?.language() === 'zh' ? zh : en;
  let reportId = '', createdAt = 0, diagnostic = null, session = 0, busy = false, monitor = null, scope = null, accountContext = null;
  const query = id => dialog.querySelector('#feedback-' + id);
  function node(tag, parent, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; if (parent) parent.append(n); return n; }
  function button(parent, id, text, action, primary) { const n = node('button', parent, text, 'btn' + (primary ? ' btn-primary' : '')); n.type = 'button'; n.id = 'feedback-' + id; n.onclick = action; return n; }
  function status(text, error = false) { const n = query('status'); if (!n) return; n.textContent = text; n.classList.toggle('error', error); }
  function sameSpace() { const A = window.TracerAccount; return !A?.locked && !A?.switching && (A?.scope ?? null) === scope && (A?.context ?? null) === accountContext; }
  function collect() {
    if (!sameSpace()) return null;
    const A = window.TracerAccount, store = T.store || {}, ws = store.data, ua = navigator.userAgent || '';
    let focus = null; try { focus = T.focus?.read(); } catch (_) { /* An unavailable timer is reported without reading its storage. */ }
    const platform = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Windows/i.test(ua) ? 'windows' : /Macintosh|Mac OS/i.test(ua) ? 'macos' : /Linux/i.test(ua) ? 'linux' : 'unknown';
    const browser = /Edg\//.test(ua) ? 'edge' : /Chrome\//.test(ua) ? 'chrome' : /Firefox\//.test(ua) ? 'firefox' : /Safari\//.test(ua) ? 'safari' : 'other';
    const count = key => Array.isArray(ws?.[key]) ? ws[key].length : null;
    return M.diagnostics({
      app: { version: document.querySelector('meta[name="tracer-version"]')?.content, runtime: window.TracerWindow ? 'desktop' : 'browser', language: window.TracerLocale.language(), platform, browser, viewport: { width: window.innerWidth, height: window.innerHeight } },
      workspace: { loaded: !!ws, pendingSave: !!store.dirty, saving: !!store.inflight, conflict: !!store.conflict, loadFailed: !!store.lost, taskCount: count('tasks'), projectCount: count('projects'), noteCount: count('notes'), inboxCount: count('inbox') },
      account: { mode: A?.context?.user ? 'account' : 'guest', switching: !!A?.switching },
      focus: { available: !!focus, mode: focus?.mode, running: !!focus?.running, completed: !!focus?.completed, historyCount: Array.isArray(focus?.history) ? focus.history.length : null }
    });
  }
  function refreshAccess() {
    if (!dialog.open) return false;
    const allowed = sameSpace(), consent = query('diagnostics'); consent.disabled = !allowed;
    query('refresh').disabled = !allowed || !consent.checked;
    if (!allowed && (diagnostic || consent.checked)) {
      diagnostic = null; consent.checked = false; updatePreview();
      status(tr('空间状态已改变，诊断信息已移除。请核对预览后再复制或下载。', 'Your space changed. Diagnostics were removed. Review the preview before copying or downloading.'), true);
      return true;
    }
    return false;
  }
  function report() {
    return M.build({ id: reportId, createdAt, type: query('type').value, description: query('description').value, steps: query('steps').value, expected: query('expected').value, diagnostics: query('diagnostics').checked && sameSpace() ? diagnostic : null });
  }
  function updatePreview() {
    let valid = false;
    try { query('preview').value = JSON.stringify(report(), null, 2); valid = true; }
    catch (_) { query('preview').value = ''; }
    query('copy').disabled = busy || !valid; query('download').disabled = busy || !valid;
    return valid;
  }
  function readyReport() {
    if (refreshAccess()) return null;
    if (!updatePreview()) { status(tr('请填写问题描述，并将每项内容限制在 4000 字符以内。', 'Describe your feedback and keep each field within 4,000 characters.'), true); query('description').focus(); return null; }
    return query('preview').value;
  }
  async function copy() {
    if (busy || !dialog.open) return;
    const content = readyReport(); if (!content) return;
    const token = session; busy = true; updatePreview();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(content);
      if (token !== session || !dialog.open) return;
      status(content === query('preview').value ? tr('报告已复制。请粘贴到你与开发者联系的渠道。', 'Report copied. Paste it into your conversation with the developer.') : tr('已复制点击时的报告。你已修改内容，可再次复制最新预览。', 'The report from your click was copied. You have since edited it; copy again for the latest preview.'));
    } catch (_) {
      if (token !== session || !dialog.open) return;
      query('preview').focus(); query('preview').select();
      status(tr('自动复制不可用。预览已选中，请使用 Ctrl+C 或 ⌘C 复制，也可下载报告。', 'Automatic copying is unavailable. The preview is selected; use Ctrl+C or ⌘C, or download the report.'), true);
    } finally { if (token === session && dialog.open) { busy = false; updatePreview(); } }
  }
  function download() {
    if (busy || !dialog.open) return;
    const content = readyReport(); if (!content) return;
    let url, link;
    try {
      url = URL.createObjectURL(new Blob([content], { type: 'application/json' })); link = node('a', document.body); link.href = url;
      link.download = 'tracer-feedback-' + new Date(createdAt).toISOString().replace(/[:.]/g, '-') + '.json'; link.click();
      status(tr('已发起报告下载。文件尚未发送给开发者。', 'Report download started. The file has not been sent to the developer.'));
    } catch (_) { status(tr('无法下载报告，请使用复制或手动复制预览。', 'The download could not start. Copy the report or select the preview manually.'), true); }
    finally { link?.remove(); if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  function field(parent, id, label, required) {
    const wrap = node('label', parent, undefined, 'feedback-field'); node('span', wrap, label);
    const input = node('textarea', wrap); input.id = 'feedback-' + id; input.maxLength = 4000; input.rows = 3; input.required = !!required;
    input.oninput = () => { refreshAccess(); updatePreview(); status(''); }; return input;
  }
  function open() {
    if (dialog.open) { query('description').focus(); return; }
    session++; busy = false; diagnostic = null; createdAt = Date.now();
    reportId = 'fb_' + crypto.randomUUID(); scope = window.TracerAccount?.scope ?? null; accountContext = window.TracerAccount?.context ?? null;
    dialog.replaceChildren(); const content = node('div', dialog, undefined, 'feedback-content'), head = node('div', content, undefined, 'feedback-heading');
    node('h2', head, tr('反馈与诊断', 'Feedback & diagnostics')).id = 'feedback-heading';
    const close = button(head, 'close', '×', () => dialog.close()); close.setAttribute('aria-label', tr('关闭反馈面板', 'Close feedback panel'));
    node('p', content, tr('描述你遇到的问题或建议，检查报告后复制或下载，再通过你与开发者联系的渠道分享。这里不会自动发送。', 'Describe a problem or idea, review your report, then copy or download it to share through your conversation with the developer. Nothing is sent automatically.'), 'feedback-help');
    const typeLabel = node('label', content, undefined, 'feedback-field'); node('span', typeLabel, tr('反馈类型', 'Feedback type')); const type = node('select', typeLabel); type.id = 'feedback-type';
    [['bug', '问题', 'Problem'], ['idea', '功能建议', 'Feature idea'], ['question', '使用疑问', 'Question']].forEach(([value, zh, en]) => { const option = node('option', type, tr(zh, en)); option.value = value; });
    type.onchange = () => { refreshAccess(); updatePreview(); status(''); };
    field(content, 'description', tr('问题或建议描述（必填）', 'Describe your feedback (required)'), true);
    const details = node('details', content, undefined, 'feedback-details'); details.id = 'feedback-details'; node('summary', details, tr('补充复现步骤与预期结果（可选）', 'Add steps and expected behavior (optional)'));
    field(details, 'steps', tr('如何复现？', 'Steps to reproduce')); field(details, 'expected', tr('你期望发生什么？', 'What did you expect?'));
    const consent = node('label', content, undefined, 'feedback-consent'), check = node('input', consent); check.type = 'checkbox'; check.id = 'feedback-diagnostics';
    node('span', consent, tr('附带基础诊断信息（可选）', 'Include basic diagnostics (optional)'));
    node('p', content, tr('包含版本、系统与浏览器类型、窗口大小、任务等数量、保存与计时状态。不自动读取正文、账户身份、密钥或日志。你的手写描述会按预览保留，请先检查。', 'Includes app version, system and browser type, window size, record counts, and save/timer status. It does not automatically read content, account identity, keys or logs. Your written feedback is kept as previewed; review it before sharing.'), 'feedback-help');
    check.onchange = () => { if (!sameSpace()) check.checked = false; diagnostic = check.checked ? collect() : null; refreshAccess(); updatePreview(); status(''); };
    button(content, 'refresh', tr('刷新诊断快照', 'Refresh diagnostics'), () => { if (refreshAccess() || !query('diagnostics').checked) return; diagnostic = collect(); updatePreview(); status(tr('诊断快照已更新，请核对预览。', 'Diagnostics refreshed. Review the preview.')); });
    const label = node('label', content, tr('完整报告预览', 'Full report preview'), 'feedback-preview-label'); label.htmlFor = 'feedback-preview';
    const preview = node('textarea', content, undefined, 'feedback-preview'); preview.id = 'feedback-preview'; preview.readOnly = true; preview.rows = 8; preview.spellcheck = false; preview.placeholder = tr('填写描述后会在这里生成完整报告。', 'Add a description to generate the full report here.');
    const actions = node('div', content, undefined, 'feedback-actions'); button(actions, 'copy', tr('复制报告', 'Copy report'), copy, true); button(actions, 'download', tr('下载 JSON', 'Download JSON'), download);
    const notice = node('p', content, '', 'feedback-status'); notice.id = 'feedback-status'; notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
    node('p', content, tr('关闭面板会清空本次反馈；不会在应用中保存副本。', 'Closing this panel clears your feedback. No copy is saved in the app.'), 'feedback-help');
    dialog.showModal(); refreshAccess(); updatePreview(); query('description').focus(); dialog.scrollTop = 0;
    monitor = setInterval(refreshAccess, 500);
  }
  dialog.addEventListener('close', () => { session++; clearInterval(monitor); monitor = null; diagnostic = null; reportId = ''; createdAt = 0; busy = false; scope = accountContext = null; dialog.replaceChildren(); if (!window.TracerAccount?.locked && !window.TracerAccount?.switching) trigger.focus(); });
  function labelTrigger() { trigger.textContent = tr('反馈', 'Feedback'); trigger.setAttribute('aria-label', tr('反馈与诊断', 'Feedback & diagnostics')); }
  labelTrigger(); new MutationObserver(labelTrigger).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  trigger.onclick = open; T.feedback = { open };
})();
