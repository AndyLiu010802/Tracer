(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-map');
  var collapsed = [];        // 折叠的项目 id
  var panX = 0, panY = 0;    // 画布平移

  // 节点尺寸
  var NW = 168, NH = 26;

  function esc(s) { return M.esc(s); }

  function nodeSvg(n) {
    if (n.kind === 'root') {
      return '<g class="mn mn-root" transform="translate(' + n.x + ',' + (n.y - NH / 2) + ')">'
        + '<rect width="120" height="' + NH + '" rx="7"/>'
        + '<text x="12" y="' + (NH / 2 + 4) + '">◆ ' + esc(n.label) + '</text></g>';
    }
    if (n.kind === 'project') {
      // 月相完成度图标
      var d = M.moonPathD(M.moonIllum(n.pct), 6);
      var moon = '<g transform="translate(' + (NW - 20) + ',' + (NH / 2) + ')">'
        + '<circle r="6" fill="none" stroke="' + n.color + '" stroke-width="1"/>'
        + (d ? '<path d="' + d + '" fill="' + n.color + '"/>' : '') + '</g>';
      var caret = n.count ? '<text class="mn-caret" data-toggle="' + n.id + '" x="10" y="' + (NH / 2 + 4) + '">'
        + (n.collapsed ? '▸' : '▾') + '</text>' : '';
      return '<g class="mn mn-proj" transform="translate(' + n.x + ',' + (n.y - NH / 2) + ')">'
        + '<rect width="' + NW + '" height="' + NH + '" rx="6" style="stroke:' + n.color + '"/>'
        + caret
        + '<text x="' + (n.count ? 24 : 12) + '" y="' + (NH / 2 + 4) + '">' + esc(n.label) + '</text>'
        + moon + '</g>';
    }
    // task
    var dotColor = n.status === 'done' ? '#4fbf82' : n.status === 'doing' ? '#e5b567' : 'var(--muted)';
    return '<g class="mn mn-task" data-open="' + n.id + '" transform="translate(' + n.x + ',' + (n.y - NH / 2) + ')">'
      + '<rect width="' + NW + '" height="' + NH + '" rx="6"/>'
      + '<circle cx="12" cy="' + (NH / 2) + '" r="3.5" fill="' + dotColor + '"/>'
      + '<text x="24" y="' + (NH / 2 + 4) + '">' + esc(n.label) + '</text></g>';
  }

  function edgeSvg(g, e) {
    var from = null, to = null;
    g.nodes.forEach(function (n) { if (n.id === e[0]) from = n; if (n.id === e[1]) to = n; });
    if (!from || !to) return '';
    var x1 = from.x + (from.kind === 'root' ? 120 : NW), y1 = from.y;
    var x2 = to.x, y2 = to.y;
    var mx = (x1 + x2) / 2;
    return '<path class="me" d="M ' + x1 + ' ' + y1 + ' C ' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"/>';
  }

  function render() {
    var ws = T.store.data;
    if (!ws.projects.length && !ws.tasks.length) {
      sec.innerHTML = '<header class="sec-head"><h1>Project Map</h1><span class="sec-sub">Workspace at a glance</span></header>'
        + '<div class="empty"><svg class="empty-art" viewBox="0 0 96 72"><use href="#moon-art"/></svg>'
        + '<div class="empty-title">The map is dark</div>'
        + '<div class="empty-sub">Add projects and tasks, then watch the tree light up.</div></div>';
      return;
    }
    var g = M.mapLayout(ws, collapsed);
    var body = '';
    g.edges.forEach(function (e) { body += edgeSvg(g, e); });
    g.nodes.forEach(function (n) { body += nodeSvg(n); });
    sec.innerHTML = '<header class="sec-head"><h1>Project Map</h1>'
      + '<span class="sec-sub">Drag to pan · click a task to open</span></header>'
      + '<div class="map-canvas" id="map-canvas">'
      + '<svg id="map-svg" width="' + g.width + '" height="' + g.height + '" '
      + 'style="transform:translate(' + panX + 'px,' + panY + 'px)">' + body + '</svg></div>';
    wire(ws, g);
  }

  function wire(ws, g) {
    var canvas = document.getElementById('map-canvas');
    // 折叠开关
    sec.querySelectorAll('.mn-caret').forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = c.dataset.toggle;
        var i = collapsed.indexOf(id);
        if (i >= 0) collapsed.splice(i, 1); else collapsed.push(id);
        render();
      });
    });
    // 点任务节点开编辑
    sec.querySelectorAll('.mn-task').forEach(function (t) {
      t.addEventListener('click', function () { if (T.openTask) T.openTask(t.dataset.open, render); });
    });
    // 画布平移（pointer 拖空白处）
    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    canvas.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.mn-task, .mn-caret')) return; // 节点交互不触发平移
      dragging = true; sx = e.clientX; sy = e.clientY; ox = panX; oy = panY;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('grabbing');
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      panX = ox + (e.clientX - sx); panY = oy + (e.clientY - sy);
      document.getElementById('map-svg').style.transform = 'translate(' + panX + 'px,' + panY + 'px)';
    });
    function endPan() { dragging = false; canvas.classList.remove('grabbing'); }
    canvas.addEventListener('pointerup', endPan);
    canvas.addEventListener('pointercancel', endPan);
  }

  T.onShow('map', render);
})();
