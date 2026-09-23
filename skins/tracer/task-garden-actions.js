(function () {
  'use strict';
  var T = window.Tracer, M = window.TracerModel;
  function text(zh, en) { return window.TracerLocale.language() === 'zh' ? zh : en; }

  // The editor and confirmations share one accessible modal. Temporarily hide its
  // fields instead of opening a second modal, so cancelling keeps the entire draft.
  T.confirmTaskAction = function (options, onConfirm, onCancel) {
    var current = document.querySelector('#modal-root:not([hidden]) > .modal');
    function build(box, close, embedded) {
      var previousFocus = document.activeElement, previousClose = box.beforeClose;
      var previousLabel = box.getAttribute('aria-labelledby');
      var children = embedded ? Array.prototype.slice.call(box.children) : [];
      children.forEach(function (child) { child.classList.add('task-action-underlay'); });
      var panel = document.createElement('div'); panel.className = 'task-action-confirm';
      panel.innerHTML = '<span class="task-action-eyebrow">' + text('留住每一份进展', 'Every step matters') + '</span>'
        + '<h2 id="task-action-title">' + M.esc(options.title) + '</h2>'
        + '<p>' + M.esc(options.body) + '</p>'
        + (options.detail ? '<p class="task-action-detail">' + M.esc(options.detail) + '</p>' : '')
        + '<div class="modal-actions"><button type="button" class="btn" data-task-action="cancel">' + text('取消', 'Cancel') + '</button>'
        + '<button type="button" class="btn ' + (options.danger ? 'btn-danger' : 'btn-primary') + '" data-task-action="confirm">' + M.esc(options.confirmText || text('确认', 'Confirm')) + '</button></div>';
      box.appendChild(panel); box.setAttribute('aria-labelledby', 'task-action-title');
      var finished = false;
      function restore() {
        panel.remove(); children.forEach(function (child) { child.classList.remove('task-action-underlay'); });
        box.beforeClose = previousClose;
        if (previousLabel) box.setAttribute('aria-labelledby', previousLabel); else box.removeAttribute('aria-labelledby');
        if (previousFocus && previousFocus.isConnected) previousFocus.focus();
      }
      function settle(accepted, fromClose) {
        if (finished) return; finished = true;
        if (embedded) restore(); else if (!fromClose) close(true);
        if (accepted) onConfirm(); else if (onCancel) onCancel();
      }
      box.beforeClose = function () { settle(false, true); return !embedded; };
      panel.querySelector('[data-task-action="cancel"]').onclick = function () { settle(false); };
      panel.querySelector('[data-task-action="confirm"]').onclick = function () { settle(true); };
      setTimeout(function () { if (!finished) panel.querySelector('[data-task-action="cancel"]').focus(); }, 0);
    }
    if (current) build(current, null, true); else T.ui.modal(function (box, close) { build(box, close, false); });
  };

  T.confirmTaskGardenChange = function (ws, id, fields, onConfirm, onCancel) {
    var G = window.TaskGarden;
    if (!G || !G.willDestroy(ws, id, fields)) { onConfirm(); return; }
    T.confirmTaskAction({
      title: text('撤销任务并销毁这株植物？', 'Withdraw this task and its plant?'),
      body: text('任务退回待办后，这次种植会被销毁。重新开始同一任务会沿用原来的随机种子，不能重新抽取植物或稀有度。', 'Returning this task to Todo destroys its current plant. Restarting this task keeps the same random seed, species and rarity.'),
      detail: text('已经收获的图鉴记录和植物伙伴会保留。', 'Your harvested collection records and plant companions are kept.'),
      confirmText: text('销毁并撤销', 'Destroy and withdraw'), danger: true
    }, onConfirm, onCancel);
  };
  T.confirmTaskGardenDelete = function (ws, id, onConfirm, onCancel) {
    var G = window.TaskGarden, destroys = G && G.willDestroy(ws, id, { delete: true });
    T.confirmTaskAction({
      title: destroys ? text('删除任务并销毁植物？', 'Delete this task and its plant?') : text('删除这项任务？', 'Delete this task?'),
      body: destroys ? text('这项任务尚未收获的植物也会被销毁，删除后无法撤销。', 'Its unharvested plant will also be destroyed. This deletion cannot be undone.') : text('任务将从列表中删除，已有的收获、图鉴与完成历史会保留。', 'The task leaves your list. Existing harvests, collection records and completion history are kept.'),
      confirmText: text('删除任务', 'Delete task'), danger: true
    }, onConfirm, onCancel);
  };
})();
