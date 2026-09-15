(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-timeline');

  // 时间轴范围：所有带 start&end 的项目的最早/最晚，向外各留 15 天余量；
  // 无任何日期项目时，默认显示今天所在月起 3 个月。
  function range(ws) {
    var dated = ws.projects.filter(function (p) { return p.start && p.end; });
    if (!dated.length) {
      var t = M.todayISO();
      return { start: M.weekStart(t), end: M.addDays(t, 90) };
    }
    var min = dated[0].start, max = dated[0].end;
    dated.forEach(function (p) {
      if (M.daysBetween(p.start, min) > 0) min = p.start;
      if (M.daysBetween(max, p.end) > 0) max = p.end;
    });
    return { start: M.addDays(min, -15), end: M.addDays(max, 15) };
  }

  function pct(x) { return (x * 100).toFixed(2) + '%'; }

  function render() {
    var ws = T.store.data;
    var r = range(ws);
    var months = M.monthList(r.start, r.end);
    var today = M.todayISO();

    var html = '<header class="sec-head"><h1>Timeline</h1>'
      + '<span class="sec-sub">Project ranges</span></header>'
      + '<div class="tl">'
      + '<div class="tl-axis">';
    months.forEach(function (m, i) {
      var left = M.datePos(m.iso, r.start, r.end);
      var next = months[i + 1] ? M.datePos(months[i + 1].iso, r.start, r.end) : 1;
      html += '<div class="tl-month" style="left:' + pct(left) + ';width:' + pct(next - left) + '">' + m.label + '</div>';
    });
    html += '</div><div class="tl-rows">';
    // 今天竖线（在范围内才画）
    if (M.daysBetween(r.start, today) >= 0 && M.daysBetween(today, r.end) >= 0) {
      // 今天线挂在含 180px 标签列的满宽 .tl-rows 上，而 datePos 是 track（满宽-180）
      // 内的比例——用 calc 从 180px 起、乘 track 宽(100%-180px)，才和横条/月刻度对齐。
      html += '<div class="tl-today" style="left:calc(180px + '
        + M.datePos(today, r.start, r.end).toFixed(4) + ' * (100% - 180px))"></div>';
    }
    ws.projects.forEach(function (p) {
      html += '<div class="tl-row" data-id="' + p.id + '">'
        + '<div class="tl-label"><i style="background:' + p.color + '"></i>' + M.esc(p.name) + '</div>'
        + '<div class="tl-track">';
      if (p.start && p.end) {
        var left = Math.max(0, M.datePos(p.start, r.start, r.end));
        var right = Math.min(1, M.datePos(p.end, r.start, r.end));
        var w = Math.max(0.01, right - left);
        var prog = M.projectProgress(ws, p.id);
        html += '<div class="tl-bar" data-id="' + p.id + '" style="left:' + pct(left) + ';width:' + pct(w) + ';background:' + p.color + '22;border-color:' + p.color + '">'
          + '<div class="tl-bar-fill" style="width:' + pct(prog) + ';background:' + p.color + '"></div>'
          + '<span class="tl-bar-label">' + Math.round(prog * 100) + '%</span></div>';
      } else {
        html += '<button class="tl-set" data-id="' + p.id + '">Set dates</button>';
      }
      html += '</div></div>';
    });
    if (!ws.projects.length) {
      html += '<div class="empty" style="grid-column:1/-1"><svg class="empty-art" viewBox="0 0 96 72"><use href="#moon-art"/></svg>'
        + '<div class="empty-title">No projects yet</div>'
        + '<div class="empty-sub">Create projects in the sidebar, then set their date ranges here.</div></div>';
    }
    html += '</div></div>';
    sec.innerHTML = html;
    wire(ws);
  }

  function wire(ws) {
    sec.querySelectorAll('.tl-bar, .tl-set').forEach(function (el) {
      el.addEventListener('click', function () { editDates(ws, el.dataset.id); });
    });
  }

  function editDates(ws, id) {
    var p = M.findProject(ws, id);
    if (!p) return;
    T.ui.modal(function (box, close) {
      box.innerHTML = '<h2>' + M.esc(p.name) + ' — dates</h2>'
        + '<label>Start</label><input type="date" id="d-start" value="' + (p.start || '') + '">'
        + '<label>End</label><input type="date" id="d-end" value="' + (p.end || '') + '">'
        + '<div class="modal-actions">'
        + (p.start || p.end ? '<button class="btn btn-danger" id="d-clear">Clear</button>' : '')
        + '<span style="flex:1"></span>'
        + '<button class="btn" id="d-cancel">Cancel</button>'
        + '<button class="btn btn-primary" id="d-save">Save</button></div>';
      box.querySelector('#d-cancel').onclick = close;
      box.querySelector('#d-save').onclick = function () {
        var s = box.querySelector('#d-start').value || null;
        var e = box.querySelector('#d-end').value || null;
        // 起止都填时保证 start<=end，填反了自动交换
        if (s && e && M.daysBetween(s, e) < 0) { var tmp = s; s = e; e = tmp; }
        M.updateProject(ws, id, { start: s, end: e });
        T.touch(); close(); render();
      };
      var clr = box.querySelector('#d-clear');
      if (clr) clr.onclick = function () { M.updateProject(ws, id, { start: null, end: null }); T.touch(); close(); render(); };
    });
  }

  T.onShow('timeline', render);
})();
