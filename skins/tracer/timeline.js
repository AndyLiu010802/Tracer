(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer, L = window.TracerLocale.t;
  var sec = document.getElementById('sec-timeline'), collapsed = new Set();
  function text(zh, en) { return window.TracerLocale.language() === 'zh' ? zh : en; }
  function pct(value) { return (value * 100).toFixed(4) + '%'; }
  function dateLabel(dates) { return dates ? dates.start + ' / ' + dates.end : L('unscheduled'); }
  function color(value) { return /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#7c8fe8'; }

  function range(groups) {
    var dates = [];
    groups.forEach(function (group) {
      if (group.dates) dates.push(group.dates);
      group.tasks.forEach(function (task) { var span = M.taskTimelineRange(task); if (span) dates.push(span); });
    });
    if (!dates.length) return { start: M.weekStart(M.todayISO()), end: M.addDays(M.todayISO(), 30) };
    var start = dates[0].start, end = dates[0].end;
    dates.forEach(function (span) { if (span.start < start) start = span.start; if (span.end > end) end = span.end; });
    return { start: M.addDays(start, -7), end: M.addDays(end, 8) };
  }

  function bar(dates, r, action, id, shade, label, title, progress) {
    var attrs = ' data-' + action + '="' + M.esc(id) + '"';
    if (!dates) return '<button type="button" class="tl-set"' + attrs + '>' + text('设置日期', 'Set dates') + '</button>';
    var left = M.datePos(dates.start, r.start, r.end);
    var width = M.datePos(M.addDays(dates.end, 1), r.start, r.end) - left;
    return '<button type="button" class="tl-bar"' + attrs + ' data-start="' + dates.start + '" data-end="' + dates.end + '"'
      + ' title="' + M.esc(title + ' · ' + dateLabel(dates)) + '" aria-label="' + M.esc(title + ' · ' + dateLabel(dates)) + '"'
      + ' style="left:' + pct(left) + ';width:' + pct(width) + ';--tl-color:' + shade + ';background:' + shade + '22">'
      + (progress == null ? '' : '<span class="tl-bar-fill" style="width:' + pct(progress) + '"></span>')
      + '<span class="tl-bar-label">' + M.esc(label) + '</span></button>';
  }

  function render() {
    var previous = sec.querySelector('.tl-scroll'), scrollLeft = previous ? previous.scrollLeft : 0;
    var ws = T.store.data;
    var groups = ws.projects.filter(function (p) { return p.status !== 'completed'; }).map(function (p) {
      return { id: p.id, project: p, name: p.name, color: color(p.color), dates: M.projectTimelineRange(ws, p.id), tasks: ws.tasks.filter(function (task) { return task.projectId === p.id; }) };
    });
    var loose = ws.tasks.filter(function (task) { return !task.projectId || !M.findProject(ws, task.projectId); });
    if (loose.length) groups.push({ id: '__unassigned', name: L('noProject'), color: '#82868f', dates: null, tasks: loose });
    var r = range(groups), days = M.daysBetween(r.start, r.end), today = M.todayISO();
    var html = '<header class="sec-head"><h1>' + L('timeline') + '</h1><span class="sec-sub">' + text('项目与任务', 'Projects & tasks') + '</span></header>';
    if (!groups.length) {
      sec.innerHTML = html + '<div class="empty"><div class="empty-title">' + text('暂无项目或任务', 'No projects or tasks') + '</div></div>';
      return;
    }
    html += '<div class="tl-scroll" tabindex="0" role="region" aria-label="' + L('timeline') + '"><div class="tl" style="min-width:' + Math.max(880, Math.min(4200, days * 18 + 240)) + 'px">'
      + '<div class="tl-head"><div class="tl-corner" aria-hidden="true"></div><div class="tl-axis">';
    var months = M.monthList(r.start, r.end);
    months.forEach(function (month, i) {
      var left = Math.max(0, M.datePos(month.iso, r.start, r.end));
      var next = months[i + 1] ? Math.min(1, M.datePos(months[i + 1].iso, r.start, r.end)) : 1;
      var label = M.fromISO(month.iso).toLocaleDateString(window.TracerLocale.language() === 'zh' ? 'zh-CN' : 'en', { month: 'short', year: 'numeric' });
      html += '<div class="tl-month" style="left:' + pct(left) + ';width:' + pct(next - left) + '">' + M.esc(label) + '</div>';
    });
    if (days <= 120) {
      for (var day = r.start; day < r.end; day = M.addDays(day, 7)) {
        html += '<span class="tl-day" style="left:' + pct(M.datePos(day, r.start, r.end)) + '">' + day.slice(5).replace('-', '/') + '</span>';
      }
    }
    html += '</div></div><div class="tl-rows">';
    if (today >= r.start && today < r.end) html += '<div class="tl-today" title="' + M.esc(today) + '" style="left:calc(var(--tl-label-width) + ' + M.datePos(today, r.start, r.end).toFixed(6) + ' * (100% - var(--tl-label-width)))"></div>';
    groups.forEach(function (group) {
      var folded = collapsed.has(group.id), count = group.tasks.length;
      html += '<div class="tl-row tl-project" data-id="' + M.esc(group.id) + '"><div class="tl-label">'
        + '<button type="button" class="tl-toggle" data-toggle="' + M.esc(group.id) + '" aria-expanded="' + !folded + '" title="' + text(folded ? '展开任务' : '折叠任务', folded ? 'Expand tasks' : 'Collapse tasks') + '"' + (!count ? ' disabled' : '') + '>' + (folded ? '&#9656;' : '&#9662;') + '</button>'
        + '<i class="tl-dot" style="background:' + group.color + '"></i><div class="tl-label-content">'
        + (group.project ? '<button type="button" class="tl-name" data-project="' + M.esc(group.id) + '" title="' + M.esc(group.name) + '">' + M.esc(group.name) + '</button>' : '<span class="tl-name">' + M.esc(group.name) + '</span>')
        + '<span class="tl-meta">' + count + ' ' + text('项任务', count === 1 ? 'task' : 'tasks')
        + (group.project ? ' · ' + (group.dates && group.dates.mode === 'manual' ? text('手动', 'Manual') : text('自动', 'Auto')) : '') + '</span></div></div><div class="tl-track">';
      if (group.project) {
        var progress = M.projectProgress(ws, group.id);
        html += bar(group.dates, r, 'project', group.id, group.color, Math.round(progress * 100) + '%', group.name, progress);
      }
      html += '</div></div>';
      if (!folded) group.tasks.slice().sort(function (a, b) {
        var da = M.taskTimelineRange(a), db = M.taskTimelineRange(b);
        return (da ? da.start : '9999').localeCompare(db ? db.start : '9999') || (a.order || 0) - (b.order || 0);
      }).forEach(function (task) {
        var dates = M.taskTimelineRange(task);
        var shade = task.status === 'done' ? '#4fbf82' : task.status === 'doing' ? '#e5b567' : task.status === 'review' ? '#bc93d8' : '#82868f';
        html += '<div class="tl-row tl-task" data-id="' + M.esc(task.id) + '"><div class="tl-label">'
          + '<i class="tl-dot" style="background:' + shade + '" title="' + L(task.status) + '"></i><div class="tl-label-content">'
          + '<button type="button" class="tl-name" data-task="' + M.esc(task.id) + '" title="' + M.esc(task.title) + '">' + M.esc(task.title) + '</button>'
          + '<span class="tl-meta">' + M.esc(dates ? dateLabel(dates) : L('unscheduled')) + '</span></div></div><div class="tl-track">'
          + bar(dates, r, 'task', task.id, shade, L(task.status), task.title, null) + '</div></div>';
      });
    });
    sec.innerHTML = html + '</div></div></div>';
    sec.querySelector('.tl-scroll').scrollLeft = scrollLeft;
    sec.querySelectorAll('[data-project]').forEach(function (el) { el.onclick = function () { editDates(el.dataset.project); }; });
    sec.querySelectorAll('[data-task]').forEach(function (el) { el.onclick = function () { if (T.openTask) T.openTask(el.dataset.task, render); }; });
    sec.querySelectorAll('[data-toggle]').forEach(function (el) { el.onclick = function () { var id = el.dataset.toggle; if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id); render(); }; });
  }

  function editDates(id) {
    var ws = T.store.data, project = M.findProject(ws, id);
    if (!project || project.status === 'completed') return;
    var dates = M.projectTimelineRange(ws, id), automatic = !dates || dates.mode === 'auto';
    T.ui.modal(function (box, close) {
      box.classList.add('tl-date-dialog'); box.setAttribute('aria-labelledby', 'tl-date-title');
      box.innerHTML = '<h2 id="tl-date-title">' + M.esc(project.name) + '</h2>'
        + '<label class="tl-auto"><input type="checkbox" id="d-auto"' + (automatic ? ' checked' : '') + '>' + text('根据任务自动计算', 'Calculate from tasks') + '</label>'
        + '<label for="d-start">' + text('开始日期', 'Start date') + '</label><input type="date" id="d-start">'
        + '<label for="d-end">' + text('结束日期', 'End date') + '</label><input type="date" id="d-end">'
        + '<p id="d-error" role="alert" hidden></p><div class="modal-actions"><button type="button" class="btn" id="d-cancel">' + L('cancel') + '</button><button type="button" class="btn btn-primary" id="d-save">' + L('save') + '</button></div>';
      var auto = box.querySelector('#d-auto'), start = box.querySelector('#d-start'), end = box.querySelector('#d-end');
      var manual = dates || { start: '', end: '' };
      function updateInputs() {
        var span = auto.checked ? M.projectTimelineRange({ projects: [{ id: id, timelineMode: 'auto' }], tasks: T.store.data.tasks }, id) : manual;
        start.value = span ? span.start : ''; end.value = span ? span.end : '';
        start.disabled = end.disabled = auto.checked;
        start.required = end.required = !auto.checked;
        box.querySelector('#d-error').hidden = true;
      }
      updateInputs();
      auto.onchange = function () { if (auto.checked) manual = { start: start.value, end: end.value }; updateInputs(); };
      box.querySelector('#d-cancel').onclick = close;
      box.querySelector('#d-save').onclick = function () {
        var current = M.findProject(T.store.data, id);
        if (!current || current.status === 'completed') { close(); render(); T.ui.notice(text('项目已归档或删除。', 'This project was archived or deleted.')); return; }
        if (!auto.checked && (!start.reportValidity() || !end.reportValidity())) return;
        if (!auto.checked && start.value > end.value) { var error = box.querySelector('#d-error'); error.textContent = L('dateOrder'); error.hidden = false; return; }
        M.updateProject(T.store.data, id, { start: auto.checked ? null : start.value, end: auto.checked ? null : end.value, timelineMode: auto.checked ? 'auto' : 'manual' });
        T.touch(); close(); render();
      };
    });
  }

  T.onShow('timeline', render);
})();
