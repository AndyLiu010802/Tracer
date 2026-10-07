(function () {
  'use strict';
  var T = window.Tracer, M = window.TracerModel, G = window.TracerGettingStarted;
  var KEY = 'tracer.gettingStarted.v1', DRAFT = 'tracer.gettingStartedDraft';
  var state = null, initialized = false, draft = '', host = null, signature = '', storageError = false;
  var externalTaskId = '', creating = false, pendingFocusId = '';
  var advancing = false, focusNextInput = false;
  function text(zh, en) { return window.TracerLocale.language() === 'zh' ? zh : en; }
  function stale() { return !!(externalTaskId && !M.findTask(T.store.data, externalTaskId)); }
  function locked() { return !T.store.data || T.store.lost || T.store.conflict || stale() || (window.TracerAccount && (TracerAccount.locked || TracerAccount.switching)); }
  function pending() { return T.store.dirty || T.store.inflight; }
  function writeState() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageError = false; }
    catch (error) { storageError = true; }
  }
  function initialize() {
    if (initialized || !T.store.data) return;
    initialized = true;
    try { state = G.read(JSON.parse(localStorage.getItem(KEY))); draft = (localStorage.getItem(DRAFT) || '').slice(0, 200); } catch (error) {}
    if (!state) {
      state = { version: 1, mode: G.isNewWorkspace(T.store.data) ? 'active' : 'dismissed', taskId: '', focused: false };
      writeState();
    }
  }
  function rememberDraft(value) {
    draft = value;
    try { if (draft) localStorage.setItem(DRAFT, draft); else localStorage.removeItem(DRAFT); }
    catch (error) { storageError = true; }
  }
  function saveNow() {
    if (locked()) return;
    T.touch(); clearTimeout(T.store.timer); T.saveNow(); refresh();
  }
  function snapshot() { return G.progress(T.store.data, T.store.base, state, T.focus ? T.focus.read() : null); }
  function creationLock(callback) {
    var name = window.TracerAccount ? TracerAccount.storageName('tracer-getting-started-create') : 'tracer-getting-started-create';
    return navigator.locks ? navigator.locks.request(name, callback) : Promise.resolve().then(callback);
  }
  async function advanceAfterHarvest(returnToBoard) {
    if (advancing || !state || state.mode !== 'active' || locked() || pending() || !snapshot().harvested) return;
    advancing = true;
    try {
      await creationLock(function () {
        if (!state || state.mode !== 'active' || locked() || pending() || !snapshot().harvested) return;
        // A new task or dismissal from another window takes precedence over this
        // old harvest. Use the same lock as creation so a reset cannot erase it.
        try {
          var latest = G.read(JSON.parse(localStorage.getItem(KEY)));
          if (latest && (latest.taskId !== state.taskId || latest.mode !== state.mode)) {
            state = latest; externalTaskId = latest.taskId; return;
          }
        } catch (error) {}
        state.taskId = ''; state.focused = false;
        externalTaskId = ''; pendingFocusId = ''; rememberDraft(''); writeState();
        focusNextInput = returnToBoard || T.currentSec() === 'board';
        if (returnToBoard && T.currentSec() === 'garden') T.show('board');
      });
    } finally { advancing = false; refresh(true); }
  }
  async function create(event) {
    event.preventDefault();
    if (creating || advancing || locked() || pending() || state.taskId && snapshot().task) return;
    var input = host.querySelector('#getting-started-title'), title = input.value.trim();
    if (!title || title.length > 200) { input.setCustomValidity(text('请写下一个可以开始的小步骤。', 'Write one small step you can start.')); input.reportValidity(); return; }
    creating = true;
    function commit() {
      if (locked() || pending() || state.taskId && snapshot().task) return;
      // Check again under a shared account-scoped lock: a second window may not
      // have received the first window's storage event or workspace snapshot yet.
      try {
        var latest = G.read(JSON.parse(localStorage.getItem(KEY)));
        if (latest && latest.taskId && latest.taskId !== state.taskId) {
          state = latest; externalTaskId = latest.taskId; refresh(true); return;
        }
      } catch (error) {}
      var task = M.addTask(T.store.data, { title: title, status: 'doing' });
      state.taskId = task.id; state.focused = false; writeState(); rememberDraft('');
      saveNow(); T.renderBoard();
      var message = host && host.querySelector('#getting-started-message'); if (message) message.focus();
    }
    try {
      await creationLock(commit);
    } finally { creating = false; }
  }
  function complete() {
    if (locked() || pending()) return;
    var progress = snapshot(), task = progress.task;
    if (!task || progress.archived || !progress.saved || ['doing', 'review'].indexOf(task.status) < 0) return;
    T.confirmTaskGardenChange(T.store.data, task.id, { status: 'done' }, function () {
      if (locked() || pending()) return;
      var latest = snapshot();
      if (!latest.task || latest.archived || !latest.saved || ['doing', 'review'].indexOf(latest.task.status) < 0) return;
      M.updateTask(T.store.data, task.id, { status: 'done' }); saveNow(); T.renderBoard();
    });
  }
  function step(number, title, detail, done, current) {
    return '<li class="getting-started-step' + (done ? ' is-done' : '') + (current ? ' is-current' : '') + '"' + (current ? ' aria-current="step"' : '') + '>'
      + '<span class="getting-started-number" aria-hidden="true">' + (done ? '✓' : number) + '</span><div><strong>' + title + '</strong><p>' + detail + '</p></div></li>';
  }
  function refresh(force) {
    initialize();
    if (!state || !host || !host.isConnected) return;
    host.hidden = state.mode !== 'active';
    if (host.hidden) return;
    var progress = snapshot();
    if (progress.harvested && !advancing && !locked() && !pending()) advanceAfterHarvest(false);
    if (progress.focused && !state.focused) { state.focused = true; writeState(); }
    var blocked = !!locked(), saving = !!pending(), task = progress.task;
    var next = JSON.stringify([window.TracerLocale.language(), state, task && [task.id, task.title, task.status], progress.saved, progress.complete, progress.archived, blocked, saving, T.store.inflight, storageError]);
    if (!force && signature === next) return;
    signature = next;
    var focused = host.contains(document.activeElement) ? document.activeElement.id : '';
    var selection = focused === 'getting-started-title' ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    var message = stale() ? text('另一窗口已更新入门任务。请先保存其他编辑，再重新载入工作区。', 'Your first task changed in another window. Save other edits, then reload the workspace.')
      : blocked ? text('请先处理工作区的保存或账户状态，再继续。', 'Resolve the workspace or account issue before continuing.')
      : saving ? (T.store.inflight ? text('正在保存这一步…', 'Saving this step…') : text('尚未保存。请重试；会保留同一任务和种子。', 'Not saved yet. Retry to keep this same task and seed.'))
      : progress.complete ? text('任务已完成并保存。去花园收获这份进展。', 'Your completed task is saved. Visit the garden to harvest your progress.')
      : task ? text('任务已保存。专注帮助你开始；完成实际工作后，再标记完成。', 'Your task is saved. Focus to get started, then mark it done when the work is finished.')
      : state.taskId ? text('之前的任务已不在看板中。你可以写下新的下一步。', 'The previous task is no longer on your board. You can choose a new next step.')
      : text('任务保存在本机。开始这一步无需注册或配置 AI。', 'Tasks stay on this device. No sign-up or AI setup needed to begin.');
    host.innerHTML = '<section id="getting-started" class="getting-started" aria-labelledby="getting-started-heading">'
      + '<div class="getting-started-heading"><div><span class="getting-started-eyebrow">' + text('从一小步开始', 'YOUR FIRST SMALL STEP') + '</span>'
      + '<h2 id="getting-started-heading">' + text('推进一点，让花园生长。', 'Make progress. Grow your world.') + '</h2>'
      + '<p>' + text('选一件今天想做的小事，让花园记住每一份进展。', 'Choose one small thing to do today. Your garden remembers every step.') + '</p></div>'
      + '<button type="button" class="btn" id="getting-started-dismiss">' + text('收起引导', 'Dismiss guide') + '</button></div>'
      + '<ol class="getting-started-steps">'
      + step(1, text('写下下一步', 'Choose a next step'), text('开始任务，种下一颗种子。', 'Start a task and plant a seed.'), !!task || progress.complete, !task && !progress.complete)
      + step(2, text('留一点专注时间', 'Make time to focus'), text('打开计时器，按自己的节奏开始。', 'Open the timer and start at your own pace.'), progress.focused, !!task && !progress.focused && !progress.complete)
      + step(3, text('完成并收获', 'Finish and harvest'), text('收获后，回来写下新的下一步。', 'Harvest, then come back for your next step.'), progress.complete, !!task && progress.focused && !progress.complete) + '</ol>';
    var panel = host.querySelector('#getting-started');
    if (!task && !progress.complete) {
      panel.insertAdjacentHTML('beforeend', '<form id="getting-started-form" class="getting-started-form"><label for="getting-started-title">' + text('你的下一步是什么？', 'What is your next small step?') + '</label>'
        + '<div><input id="getting-started-title" type="text" required maxlength="200" autocomplete="off" aria-describedby="getting-started-message" placeholder="' + text('例如：写下作品介绍的第一段', 'e.g. Write the first paragraph of my project intro') + '" value="' + M.esc(draft) + '"' + (blocked || saving ? ' disabled' : '') + '>'
        + '<button class="btn btn-primary" id="getting-started-create" type="submit"' + (blocked || saving ? ' disabled' : '') + '>' + text('创建并开始任务', 'Create & start task') + '</button></div></form>');
      var input = host.querySelector('#getting-started-title');
      input.oninput = function () { this.setCustomValidity(''); rememberDraft(this.value); };
      host.querySelector('form').onsubmit = create;
    } else {
      if (task) panel.insertAdjacentHTML('beforeend', '<p class="getting-started-task">' + M.esc(task.title) + '</p>');
      var unavailable = blocked || saving || !progress.saved || progress.archived;
      var actions = '<div class="getting-started-actions">';
      if (progress.complete) actions += '<button type="button" class="btn btn-primary" id="getting-started-garden"' + (blocked || saving ? ' disabled' : '') + '>' + text('去花园收获', 'Visit your garden') + '</button>';
      else if (task) {
        actions += '<button type="button" class="btn btn-primary" id="getting-started-focus"' + (unavailable || task.status === 'done' ? ' disabled' : '') + '>' + text('打开专注计时器', 'Open focus timer') + '</button>'
          + '<button type="button" class="btn" id="getting-started-complete"' + (unavailable || ['doing', 'review'].indexOf(task.status) < 0 ? ' disabled' : '') + '>' + text('我已完成这项任务', 'Mark task done') + '</button>';
      }
      panel.insertAdjacentHTML('beforeend', actions + '</div>');
    }
    panel.insertAdjacentHTML('beforeend', '<p id="getting-started-message" class="getting-started-message" role="status" tabindex="-1">' + message + '</p>'
      + (stale() ? '<button type="button" class="btn" id="getting-started-reload"' + (pending() || T.store.conflict || T.store.lost ? ' disabled' : '') + '>' + text('重新载入工作区', 'Reload workspace') + '</button>' : '')
      + (saving && !T.store.inflight && !blocked ? '<button type="button" class="btn" id="getting-started-retry">' + text('重试保存', 'Retry save') + '</button>' : '')
      + (storageError ? '<p class="getting-started-message">' + text('暂时无法保存引导偏好，请保持窗口打开。任务保存状态以上方提示为准。', 'Guide preferences could not be saved. Keep this window open; the message above shows your task save status.') + '</p>' : ''));
    host.querySelector('#getting-started-dismiss').onclick = function () { state.mode = 'dismissed'; pendingFocusId = ''; writeState(); refresh(); document.getElementById('getting-started-open').focus(); };
    var focusButton = host.querySelector('#getting-started-focus');
    if (focusButton) focusButton.onclick = async function () {
      if (locked() || pending() || !snapshot().saved || snapshot().archived) return;
      var current = snapshot().task;
      if (!current || current.status === 'done') return;
      // A user may have moved this task back to Todo outside the guide.
      if (current.status === 'todo') { pendingFocusId = current.id; M.moveTask(T.store.data, current.id, 'doing', null); saveNow(); T.renderBoard(); return; }
      await T.focus.openForTask(current.id); refresh();
    };
    var doneButton = host.querySelector('#getting-started-complete'); if (doneButton) doneButton.onclick = complete;
    var gardenButton = host.querySelector('#getting-started-garden');
    if (gardenButton) gardenButton.onclick = function () { if (!locked() && !pending() && snapshot().complete) T.garden.open(state.taskId); };
    var retry = host.querySelector('#getting-started-retry'); if (retry) retry.onclick = saveNow;
    var reload = host.querySelector('#getting-started-reload');
    if (reload) reload.onclick = function () {
      if (!pending() && !T.store.conflict && !T.store.lost && document.getElementById('modal-root').hidden) location.reload();
    };
    if (focused) {
      var replacement = document.getElementById(focused);
      if (replacement && !replacement.disabled) { replacement.focus(); if (selection) replacement.setSelectionRange(selection[0], selection[1]); }
    }
    if (focusNextInput && T.currentSec() === 'board' && document.getElementById('modal-root').hidden) {
      var nextInput = host.querySelector('#getting-started-title');
      if (nextInput && !nextInput.disabled) { focusNextInput = false; nextInput.focus(); nextInput.scrollIntoView({ block: 'nearest' }); }
    }
  }
  T.gettingStarted = {
    mount: function (element) { host = element; signature = ''; refresh(true); },
    refresh: refresh,
    open: function () { initialize(); if (!state) return; state.mode = 'active'; writeState(); refresh(true); var input = host && host.querySelector('#getting-started-title'); if (input && !input.disabled) input.focus(); }
  };
  window.addEventListener('tracer-workspace-saved', function () {
    advanceAfterHarvest(T.currentSec() === 'garden');
    refresh();
    if (pendingFocusId && state && state.mode === 'active' && !locked() && !pending() && snapshot().saved) {
      var id = pendingFocusId; pendingFocusId = '';
      if (T.currentSec() === 'board' && document.getElementById('modal-root').hidden) T.focus.openForTask(id);
    }
  });
  window.addEventListener('tracer-focus-change', function () { refresh(); });
  window.addEventListener('storage', function (event) {
    if (event.key === KEY) {
      try {
        var next = G.read(JSON.parse(event.newValue));
        if (next) { if (next.taskId && (!state || next.taskId !== state.taskId)) externalTaskId = next.taskId; state = next; }
      } catch (error) {}
      refresh(true);
    }
  });
})();
