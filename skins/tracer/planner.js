(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var L = window.TracerLocale.t;
  var sec = document.getElementById('sec-planner');
  var anchor = null; // 当前显示的周里的某一天 ISO，null=本周

  function projDot(ws, t) {
    var p = t.projectId ? M.findProject(ws, t.projectId) : null;
    return p ? '<i class="pl-dot" style="background:' + p.color + '"></i>' : '';
  }
  function cardHtml(ws, t) {
    return '<div class="pl-card" data-id="' + t.id + '" tabindex="0">'
      + '<div class="card-actions"><span class="card-seq">' + M.esc(t.seq) + '</span><span class="drag-handle" role="button" tabindex="0" title="' + L('dragHandle') + '" aria-label="' + L('dragHandle') + '">⋮⋮</span></div>'
      + '<div class="pl-card-title">' + M.esc(t.title) + '</div>'
      + '<div class="pl-card-meta"><span class="pl-seq">' + L(t.status) + '</span>' + projDot(ws, t) + '</div>'
      + '</div>';
  }

  function render() {
    var ws = T.store.data;
    var base = anchor || M.todayISO();
    var days = M.weekDays(base);
    var today = M.todayISO();
    var weekLabel = M.dayParts(days[0]).mon + ' ' + M.dayParts(days[0]).dom
      + ' – ' + M.dayParts(days[6]).mon + ' ' + M.dayParts(days[6]).dom;

    var html = '<header class="sec-head"><h1>Planner</h1>'
      + '<span class="sec-sub">' + weekLabel + '</span>'
      + '<span style="flex:1"></span>'
      + '<button class="chip" id="pl-prev">‹</button>'
      + '<button class="chip" id="pl-today">Today</button>'
      + '<button class="chip" id="pl-next">›</button></header>'
      + '<div class="planner">'
      + '<div class="pl-tray" data-day=""><div class="pl-col-head">Unscheduled</div>'
      + '<div class="pl-body" data-day="">';
    M.unscheduledTasks(ws).forEach(function (t) { html += cardHtml(ws, t); });
    html += '</div></div>';
    days.forEach(function (iso) {
      var dp = M.dayParts(iso);
      var isToday = iso === today ? ' pl-is-today' : '';
      html += '<div class="pl-day' + isToday + '" data-day="' + iso + '">'
        + '<div class="pl-col-head"><span class="pl-dow">' + dp.dow + '</span> <span class="pl-dom">' + dp.dom + '</span></div>'
        + '<div class="pl-body" data-day="' + iso + '">';
      M.tasksOnDay(ws, iso).forEach(function (t) { html += cardHtml(ws, t); });
      html += '</div></div>';
    });
    html += '</div>';
    sec.innerHTML = html;
    wire(ws, base);
  }

  function wire(ws, base) {
    document.getElementById('pl-prev').addEventListener('click', function () { anchor = M.addDays(base, -7); render(); });
    document.getElementById('pl-next').addEventListener('click', function () { anchor = M.addDays(base, 7); render(); });
    document.getElementById('pl-today').addEventListener('click', function () { anchor = null; render(); });
    // 点卡片开编辑（复用 board 的任务编辑弹层）；传 render 让编辑后就地刷新
    sec.querySelectorAll('.pl-card').forEach(function (card) {
      card.addEventListener('click', function () { if (T.openTask) { T.openTask(card.dataset.id, render); } });
    });
    // 拖拽：把任务拖到某天/托盘 → 设/清 scheduled
    T.ui.dragList(sec.querySelector('.planner'), {
      itemSelector: '.pl-card',
      colSelector: '.pl-body',
      targetLabel: function (col) { return col.dataset.day || L('unscheduled'); },
      onDrop: function (el, col) {
        var day = col.dataset.day || null; // 托盘的 data-day="" → null
        var t = M.findTask(ws, el.dataset.id);
        // 原位放回（排期没变）就不写库、不发多余 PUT，只重绘复位
        if (t && t.scheduled === day) { render(); return; }
        var old = t && t.scheduled;
        M.updateTask(ws, el.dataset.id, { scheduled: day });
        T.touch(); render();
        T.ui.notice(L('scheduledNotice', { target: day || L('unscheduled') }), function () {
          var current = M.findTask(T.store.data, el.dataset.id);
          if (!current || current.scheduled !== day) { T.ui.notice(L('undoChanged')); return; }
          M.updateTask(T.store.data, el.dataset.id, { scheduled: old || null }); T.touch(); render(); T.ui.notice(L('undone'));
        });
      },
      onCancel: function () { render(); },
    });
  }

  T.onShow('planner', render);
})();
