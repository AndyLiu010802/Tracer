(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var L = window.TracerLocale.t;
  var sec = document.getElementById('sec-board');
  var COLS = [
    { key: 'todo', label: 'Todo' },
    { key: 'doing', label: 'In Progress' },
    { key: 'review', label: 'In Review' },
    { key: 'done', label: 'Done' },
  ];
  var filters = { query: '', priority: '', due: '' };
  function text(zh, en) { return window.TracerLocale.language() === 'zh' ? zh : en; }
  function activeWorkspace(ws) {
    var archived = new Set(ws.projects.filter(function (p) { return p.status === 'completed'; }).map(function (p) { return p.id; }));
    return Object.assign({}, ws, { tasks: ws.tasks.filter(function (t) { return !archived.has(t.projectId); }) });
  }

  function projById(ws, id) {
    var p = null; ws.projects.forEach(function (x) { if (x.id === id) p = x; }); return p;
  }

  function cardHtml(ws, t) {
    var p = projById(ws, t.projectId);
    var tags = '', progress = '', labels = '', priority = '';
    if (p) tags += '<span class="card-proj"><i style="background:' + p.color + '"></i>' + M.esc(p.name) + '</span>';
    if (t.priority) priority = '<span class="card-pri priority-' + M.esc(t.priority) + '"><i aria-hidden="true"></i>' + L(t.priority === 'high' ? 'highBadge' : t.priority) + '</span>';
    (t.labels || []).slice(0, 3).forEach(function (label) { labels += '<span class="card-label">' + M.esc(label) + '</span>'; });
    if ((t.labels || []).length > 3) labels += '<span class="card-label" title="' + M.esc(t.labels.slice(3).join(', ')) + '">+' + (t.labels.length - 3) + '</span>';
    if ((t.checklist || []).length) {
      var complete = t.checklist.filter(function (c) { return c.done; }).length, total = t.checklist.length;
      progress = '<div class="card-progress"><div class="card-progress-caption"><span>' + L('checklist') + '</span><span class="card-checks">' + complete + ' / ' + total + '</span></div><progress value="' + complete + '" max="' + total + '" aria-label="' + L('checklistProgress', { done: complete, total: total }) + '"></progress></div>';
    }
    if (t.estimate != null) tags += '<span class="card-hours">◷ ' + (t.spent || 0) + ' / ' + t.estimate + ' h</span>';
    var blockers = M.blockers(ws, t);
    if (blockers.length) tags += '<span class="card-blocked" title="' + M.esc(blockers.map(function (v) { return v.seq + ' ' + v.title; }).join('\n')) + '">⊘ ' + L('blocked', { count: blockers.length }) + '</span>';
    var dueState = M.taskDueState(t);
    if (t.due) tags += '<span class="card-due ' + dueState + '">' + L(dueState === 'overdue' ? 'overdue' : dueState === 'today' ? 'todayBadge' : 'due') + ' · ' + M.esc(t.due) + '</span>';
    if (t.scheduled) tags += '<span class="card-scheduled">' + L('planned') + ' · ' + M.esc(t.scheduled) + '</span>';
    var owner = t.assignee ? '<span class="card-owner" title="' + L('assignee') + ': ' + M.esc(t.assignee) + '"><span class="card-avatar" aria-hidden="true">' + M.esc(Array.from(t.assignee.trim()).slice(0, 2).join('').toUpperCase()) + '</span><span>' + M.esc(t.assignee) + '</span></span>' : '';
    var type = t.type || 'task';
    return '<div class="card" data-status="' + M.esc(t.status) + '" data-id="' + t.id + '" tabindex="0" role="group" aria-label="' + M.esc(t.seq + ': ' + t.title) + '" aria-describedby="board-drag-hint">'
      + '<div class="card-actions"><div class="card-identity"><span class="card-type-icon" aria-hidden="true">' + ({ task: '◇', bug: '!', feature: '✧', research: '⌕' }[type] || '◇') + '</span><span class="card-seq">' + M.esc(t.seq) + '</span>' + priority + '</div><span class="drag-handle" role="button" tabindex="0" title="' + L('dragHandle') + '" aria-label="' + L('dragHandle') + '">⋮⋮</span></div>'
      + '<div class="card-title">' + M.esc(t.title) + '</div>'
      + (t.notes ? '<p class="card-preview">' + M.esc(t.notes.replace(/[#*`>]/g, '').slice(0, 180)) + '</p>' : '')
      + (labels ? '<div class="card-labels">' + labels + '</div>' : '')
      + (tags ? '<div class="card-meta">' + tags + '</div>' : '') + progress
      + '<div class="card-footer"><label class="card-status"><span class="card-status-dot" aria-hidden="true"></span><select class="card-move" aria-label="' + L('moveTo') + '">' + COLS.map(function (c) { return '<option value="' + c.key + '"' + (c.key === t.status ? ' selected' : '') + '>' + L(c.key) + '</option>'; }).join('') + '</select></label>' + (owner || '<span class="card-kind">' + L(type) + '</span>') + '</div>'
      + '</div>';
  }

  function render() {
    var ws = T.store.data;
    var filter = T.projectFilter ? T.projectFilter() : null;
    var active = activeWorkspace(ws);
    var visible = M.filterTasks(active, { query: filters.query, priority: filters.priority, due: filters.due, projectId: filter });
    var scope = M.filterTasks(active, { projectId: filter });
    var open = scope.filter(function (t) { return t.status !== 'done'; });
    var project = filter && M.findProject(ws, filter), completed = scope.length - open.length;
    var html = '<header class="sec-head board-heading"><div><h1>' + M.esc(project ? project.name : L('board')) + '</h1>'
      + '<span class="sec-sub">' + L('boardSummary', { open: open.length, overdue: open.filter(function (t) { return M.taskDueState(t) === 'overdue'; }).length, done: completed }) + '</span></div>'
      + '<div class="board-heading-actions">' + (project ? '<button type="button" class="btn btn-primary" id="board-complete-project">' + text('完成并归档项目', 'Complete and archive') + '</button>' : '')
      + '<button type="button" class="btn" id="board-clear-completed"' + (completed ? '' : ' disabled') + '>' + text('清除已完成', 'Clear completed') + (completed ? ' · ' + completed : '') + '</button></div></header>'
      + '<div class="board-tools"><input type="search" id="board-search" aria-label="' + L('search') + '" placeholder="' + L('search') + '" value="' + M.esc(filters.query) + '">'
      + '<select id="board-priority" aria-label="' + L('priority') + '"><option value="">' + L('allPriorities') + '</option>' + ['urgent', 'high', 'medium', 'low'].map(function (k) { return '<option value="' + k + '">' + L(k) + '</option>'; }).join('') + '</select>'
      + '<select id="board-due" aria-label="' + L('dueDate') + '"><option value="">' + L('anyDue') + '</option><option value="overdue">' + L('overdue') + '</option><option value="today">' + L('today') + '</option><option value="upcoming">' + L('upcoming') + '</option></select>'
      + '<button class="btn" id="board-clear">' + L('clearFilters') + '</button></div>'
      + '<p class="board-results" aria-live="polite">' + L('boardResults', { count: visible.length, total: scope.length }) + '</p>'
      + '<p class="board-drag-hint" id="board-drag-hint">' + L('dragHint') + '</p>'
      + '<div class="board">';
    COLS.forEach(function (c) {
      var cards = visible.filter(function (t) { return t.status === c.key; });
      html += '<div class="col" data-col="' + c.key + '">'
        + '<div class="col-head"><span>' + L(c.key) + '</span>'
        + '<span class="col-count">' + cards.length + '</span></div>'
        + '<div class="col-body" data-col="' + c.key + '">';
      cards.forEach(function (t) { html += cardHtml(ws, t); });
      if (!cards.length) html += '<p class="col-empty">' + L('empty') + '</p>';
      html += '</div>'
        + '<button class="col-add" data-col="' + c.key + '">' + L('add') + '</button>'
        + '</div>';
    });
    html += '</div>';
    sec.innerHTML = html;
    sec.querySelector('#board-priority').value = filters.priority;
    sec.querySelector('#board-due').value = filters.due;
    wire(ws);
  }

  function wire(ws) {
    function focusCard(id) { var c = sec.querySelector('.card[data-id="' + id + '"]'); if (c) c.focus(); }
    function editable(task) { var project = task && task.projectId && M.findProject(T.store.data, task.projectId); return task && (!project || project.status !== 'completed'); }
    function move(id, status, beforeId) {
      var task = M.findTask(ws, id); if (!task) return;
      var old = { status: task.status, order: task.order, doneAt: task.doneAt };
      T.confirmTaskGardenChange(ws, id, { status: status }, function () {
        var latest = M.findTask(T.store.data, id);
        if (!editable(latest) || latest.status !== old.status || latest.order !== old.order || latest.doneAt !== old.doneAt) { render(); T.ui.notice(L('undoChanged')); return; }
        M.moveTask(T.store.data, id, status, beforeId); var expected = { status: latest.status, order: latest.order, doneAt: latest.doneAt };
        T.touch(); render(); focusCard(id);
        T.ui.notice(old.status === status ? L('reordered') : L('moved', { target: L(status) }), function () {
          function unchanged() { var value = M.findTask(T.store.data, id); return editable(value) && value.status === expected.status && value.order === expected.order && value.doneAt === expected.doneAt; }
          if (!unchanged()) { T.ui.notice(L('undoChanged')); return; }
          T.confirmTaskGardenChange(T.store.data, id, { status: old.status }, function () {
            if (!unchanged()) { T.ui.notice(L('undoChanged')); return; }
            M.updateTask(T.store.data, id, { status: old.status });
            if (old.status !== 'done' && expected.status === 'done') window.TaskHistory.undo(T.store.data, id, expected.doneAt);
            var current = M.findTask(T.store.data, id);
            if (old.status === 'done' && expected.status !== 'done') window.TaskHistory.undo(T.store.data, id, current.doneAt);
            current.order = old.order; current.doneAt = old.doneAt; current.updatedAt = Date.now();
            T.touch(); render(); focusCard(id); T.ui.notice(L('undone'));
          });
        });
      }, function () {
        render(); focusCard(id);
      });
    }
    sec.querySelector('#board-clear-completed').onclick = function () { T.clearCompletedTasksDialog(T.projectFilter ? T.projectFilter() : null); };
    var archiveButton = sec.querySelector('#board-complete-project');
    if (archiveButton) archiveButton.onclick = function () { T.completeProjectDialog(T.projectFilter()); };
    sec.querySelector('#board-search').oninput = function (e) {
      if (e.isComposing) return;
      var pos = e.target.selectionStart;
      filters.query = e.target.value; render();
      var input = sec.querySelector('#board-search'); input.focus();
      input.setSelectionRange(pos, pos);
    };
    sec.querySelector('#board-search').oncompositionend = function (e) { this.oninput(e); };
    ['priority', 'due'].forEach(function (key) {
      sec.querySelector('#board-' + key).onchange = function (e) { filters[key] = e.target.value; render(); sec.querySelector('#board-' + key).focus(); };
    });
    sec.querySelector('#board-clear').onclick = function () { filters = { query: '', priority: '', due: '' }; render(); sec.querySelector('#board-search').focus(); };
    // 建卡
    sec.querySelectorAll('.col-add').forEach(function (btn) {
      btn.addEventListener('click', function () { quickAdd(ws, btn.dataset.col); });
    });
    // 点卡片开编辑
    sec.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('click', function (e) { if (!e.target.closest('select,.drag-handle')) editTask(ws, card.dataset.id); });
      card.querySelector('.card-move').onchange = function (e) { move(card.dataset.id, e.target.value, null); };
      card.addEventListener('keydown', function (e) {
        if (e.target.closest('select')) return;
        if (e.altKey && /^Arrow/.test(e.key)) {
          e.preventDefault(); var task = M.findTask(ws, card.dataset.id), idx = M.STATUSES.indexOf(task.status);
          if (e.key === 'ArrowLeft' && idx > 0) move(task.id, M.STATUSES[idx - 1], null);
          if (e.key === 'ArrowRight' && idx < 3) move(task.id, M.STATUSES[idx + 1], null);
          var ordered = M.tasksByStatus(ws, task.status), pos = ordered.indexOf(task);
          if (e.key === 'ArrowUp' && pos > 0) move(task.id, task.status, ordered[pos - 1].id);
          if (e.key === 'ArrowDown' && pos < ordered.length - 1) move(task.id, task.status, ordered[pos + 2] ? ordered[pos + 2].id : null);
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editTask(ws, card.dataset.id); }
      });
    });
    // 拖拽
    T.ui.dragList(sec.querySelector('.board'), {
      itemSelector: '.card',
      colSelector: '.col-body',
      targetLabel: function (col) { return L(col.dataset.col); },
      onDrop: function (el, col, before) {
        move(el.dataset.id, col.dataset.col, before ? before.dataset.id : null);
      },
      // 取消（在看板外松手/pointercancel）时整列重绘，把 onHover 期间挪动的
      // DOM 还原到数据真相，否则卡片会停在预览落点直到下次 render。
      onCancel: function () { render(); },
    });
  }

  function quickAdd(ws, status) {
    editTask(ws, null, null, status);
  }

  // after：可选回调，Save/Delete 后额外触发（除 board 自己的 render 外）。
  // Planner/Timeline 从别的分区打开时传自己的 render，编辑完就地刷新。
  function editTask(ws, id, after, status) { T.taskEditor(ws, id, after, status); }

  T.onShow('board', render);
  // 顶栏 +New 和项目过滤会调它
  T.renderBoard = render;
  T.newTask = function (status) { quickAdd(T.store.data, status || 'todo'); };
  // 顶栏 +New 建卡后打开编辑弹层
  T.editLastTask = function (id) { editTask(T.store.data, id); };
  // 供 Planner/Timeline 等复用：打开任务编辑弹层。after 传自己的 render，编辑后就地刷新。
  T.openTask = function (id, after) { editTask(T.store.data, id, after); };
})();
