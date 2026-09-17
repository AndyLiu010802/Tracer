(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-notes');
  var currentId = null;   // 当前打开的笔记 id
  var preview = false;    // false=编辑，true=渲染预览
  var layoutKey = 'tracer.notesLayout.v1';
  var layout = { width: 240, collapsed: false }, narrowOpen = false, layoutObserver;
  try {
    var savedLayout = JSON.parse(localStorage.getItem(layoutKey));
    if (savedLayout && Number.isFinite(savedLayout.width)) layout.width = Math.max(168, Math.min(360, savedLayout.width));
    if (savedLayout) layout.collapsed = savedLayout.collapsed === true;
  } catch (e) {}
  function L(zh, en) { return window.TracerLocale && TracerLocale.language() === 'en' ? en : zh; }
  function saveLayout() { try { localStorage.setItem(layoutKey, JSON.stringify(layout)); } catch (e) {} }
  function compact() { var wrap = sec.querySelector('.notes-wrap'); return wrap && wrap.clientWidth < 640; }
  function applyLayout() {
    var wrap = sec.querySelector('.notes-wrap');
    if (!wrap || !wrap.clientWidth) return;
    var narrow = compact();
    if (!narrow) narrowOpen = false;
    var hidden = layout.collapsed || (narrow && !narrowOpen);
    wrap.dataset.compact = String(narrow); wrap.dataset.listHidden = String(hidden);
    var list = sec.querySelector('.note-list'), grip = sec.querySelector('.notes-grip');
    var toggle = document.getElementById('note-list-toggle');
    if (hidden && (list.contains(document.activeElement) || document.activeElement === grip)) toggle.focus();
    list.hidden = hidden; grip.hidden = hidden || narrow;
    var maximum = Math.max(168, Math.min(360, wrap.clientWidth - 338));
    var width = Math.min(layout.width, maximum);
    wrap.style.setProperty('--notes-list-width', width + 'px');
    grip.setAttribute('aria-valuemax', maximum); grip.setAttribute('aria-valuenow', width);
    toggle.setAttribute('aria-expanded', String(!hidden));
    toggle.textContent = hidden ? L('展开列表', 'Show pages') : L('收起列表', 'Hide pages');
  }
  function wireLayout() {
    if (layoutObserver) layoutObserver.disconnect();
    var wrap = sec.querySelector('.notes-wrap'), grip = sec.querySelector('.notes-grip');
    document.getElementById('note-list-toggle').onclick = function () {
      var show = wrap.dataset.listHidden === 'true';
      layout.collapsed = !show; narrowOpen = compact() && show; saveLayout(); applyLayout();
    };
    var drag = null;
    function finish(cancel) {
      if (!drag) return;
      if (cancel) layout.width = drag.width;
      var pointer = drag.pointer; drag = null;
      if (grip.hasPointerCapture(pointer)) grip.releasePointerCapture(pointer);
      document.body.classList.remove('notes-resizing', 'is-resizing');
      applyLayout(); saveLayout();
    }
    grip.onpointerdown = function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); grip.focus();
      drag = { x: e.clientX, width: parseFloat(wrap.style.getPropertyValue('--notes-list-width')), pointer: e.pointerId };
      // The shared resize flag temporarily hides the native reference view,
      // so it cannot swallow pointer-up while the divider is being dragged.
      grip.setPointerCapture(e.pointerId); document.body.classList.add('notes-resizing', 'is-resizing');
    };
    grip.onpointermove = function (e) {
      if (!drag) return;
      layout.width = Math.max(168, Math.min(Number(grip.getAttribute('aria-valuemax')), drag.width + e.clientX - drag.x));
      applyLayout();
    };
    grip.onpointerup = function () { finish(false); };
    grip.onpointercancel = function () { finish(true); };
    grip.onlostpointercapture = function () { finish(false); };
    grip.ondblclick = function () { layout.width = 240; saveLayout(); applyLayout(); };
    grip.onkeydown = function (e) {
      if (e.key === 'Escape' && drag) { e.preventDefault(); finish(true); return; }
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
      e.preventDefault();
      var max = Number(grip.getAttribute('aria-valuemax')), width = Number(grip.getAttribute('aria-valuenow'));
      layout.width = e.key === 'Home' ? 168 : e.key === 'End' ? max : Math.max(168, Math.min(max, width + (e.key === 'ArrowRight' ? 16 : -16)));
      saveLayout(); applyLayout();
    };
    layoutObserver = new ResizeObserver(applyLayout); layoutObserver.observe(wrap); applyLayout();
  }

  function render() {
    var ws = T.store.data;
    var notes = M.notesSorted(ws);
    // 当前笔记失效（被删/首次进入）时选第一条
    if (currentId && !M.findNote(ws, currentId)) currentId = null;
    if (!currentId && notes.length) currentId = notes[0].id;

    var listHtml = '';
    notes.forEach(function (n) {
      var active = n.id === currentId ? ' active' : '';
      var snippet = (n.body || '').replace(/[#*`>\-\d.]/g, '').replace(/\s+/g, ' ').trim().slice(0, 48);
      listHtml += '<button type="button" class="note-item' + active + '" data-id="' + M.esc(n.id) + '" aria-pressed="' + (n.id === currentId) + '">'
        + (n.pinned ? '<span class="note-pin">●</span>' : '')
        + '<div class="note-item-title">' + M.esc(n.title) + '</div>'
        + '<div class="note-item-snip">' + M.esc(snippet || L('暂无内容', 'No content')) + '</div>'
        + '</button>';
    });

    var html = '<header class="sec-head"><h1>' + L('笔记', 'Notes') + '</h1>'
      + '<span class="sec-sub">' + L('页面与草稿', 'Pages and drafts') + '</span>'
      + '<div class="notes-head-actions"><button class="btn" id="note-list-toggle" aria-controls="note-list"></button>'
      + '<button class="btn btn-primary" id="note-new">' + L('＋ 新建笔记', '+ New page') + '</button></div></header>'
      + '<div class="notes-wrap">'
      + '<div class="note-list" id="note-list" aria-label="' + L('笔记列表', 'Pages') + '">' + (listHtml || '<div class="note-empty">' + L('暂无笔记', 'No pages yet') + '</div>') + '</div>'
      + '<div class="notes-grip" tabindex="0" role="separator" aria-orientation="vertical" aria-controls="note-list" aria-valuemin="168" aria-label="' + L('调整笔记列表宽度', 'Resize page list') + '" title="' + L('拖动调整宽度 · 方向键微调 · 双击重置', 'Drag to resize · Arrow keys to adjust · Double-click to reset') + '"></div>'
      + '<div class="note-editor" id="note-editor"></div>'
      + '</div>';
    sec.innerHTML = html;
    wireLayout();

    document.getElementById('note-new').addEventListener('click', function () {
      var n = M.addNote(ws, { title: 'Untitled' });
      currentId = n.id; preview = false; T.touch(); render();
      if (compact()) { narrowOpen = false; applyLayout(); }
      document.getElementById('note-title').focus();
    });
    sec.querySelector('.note-list').addEventListener('click', function (e) {
      var item = e.target.closest('.note-item');
      if (!item) return;
      currentId = item.dataset.id; preview = false; renderEditor();
      // 只更新列表高亮，不整体重绘
      sec.querySelectorAll('.note-item').forEach(function (el) {
        el.classList.toggle('active', el.dataset.id === currentId);
        el.setAttribute('aria-pressed', String(el.dataset.id === currentId));
      });
      if (compact()) { narrowOpen = false; applyLayout(); document.getElementById('note-title').focus(); }
    });
    renderEditor();
  }

  function renderEditor() {
    var ws = T.store.data;
    var box = document.getElementById('note-editor');
    if (!box) return;
    var n = currentId ? M.findNote(ws, currentId) : null;
    if (!n) { box.innerHTML = '<div class="note-empty">' + L('选择或新建笔记', 'Select or create a page') + '</div>'; return; }

    if (preview) {
      box.innerHTML = '<div class="note-toolbar">'
        + '<input class="note-title" id="note-title" value="' + M.esc(n.title) + '" readonly>'
        + '<button class="chip" id="note-edit">' + L('✎ 编辑', '✎ Edit') + '</button>'
        + '<button class="chip" id="note-pin">' + (n.pinned ? L('★ 已置顶', '★ Pinned') : L('☆ 置顶', '☆ Pin')) + '</button>'
        + '<button class="chip chip-del" id="note-del">' + L('删除', 'Delete') + '</button></div>'
        + '<div class="note-rendered">' + M.renderMarkdown(n.body) + '</div>';
    } else {
      box.innerHTML = '<div class="note-toolbar">'
        + '<input class="note-title" id="note-title" value="' + M.esc(n.title) + '" placeholder="' + L('未命名', 'Untitled') + '">'
        + '<button class="chip" id="note-preview">' + L('◱ 预览', '◱ Preview') + '</button>'
        + '<button class="chip" id="note-pin">' + (n.pinned ? L('★ 已置顶', '★ Pinned') : L('☆ 置顶', '☆ Pin')) + '</button>'
        + '<button class="chip chip-del" id="note-del">' + L('删除', 'Delete') + '</button></div>'
        + '<textarea class="note-body" id="note-body" placeholder="' + L('用 Markdown 记录…（Ctrl/Cmd+E 切换预览）', 'Write in Markdown… (Ctrl/Cmd+E toggles preview)') + '"></textarea>';
      document.getElementById('note-body').value = n.body;
    }
    wireEditor(ws, n);
  }

  function wireEditor(ws, n) {
    var title = document.getElementById('note-title');
    var pinBtn = document.getElementById('note-pin');
    var delBtn = document.getElementById('note-del');
    var prevBtn = document.getElementById('note-preview');
    var editBtn = document.getElementById('note-edit');
    var body = document.getElementById('note-body');

    if (title && !preview) title.addEventListener('input', function () {
      M.updateNote(ws, n.id, { title: title.value }); T.touch();
      // 同步左列标题
      var item = sec.querySelector('.note-item[data-id="' + n.id + '"] .note-item-title');
      if (item) item.textContent = title.value || 'Untitled';
    });
    if (body) body.addEventListener('input', function () {
      M.updateNote(ws, n.id, { body: body.value }); T.touch();
    });
    if (pinBtn) pinBtn.addEventListener('click', function () { M.togglePin(ws, n.id); T.touch(); render(); });
    if (delBtn) delBtn.addEventListener('click', function () {
      T.ui.confirm(L('删除这篇笔记？', 'Delete this page?'), function () { M.deleteNote(ws, n.id); currentId = null; T.touch(); render(); });
    });
    if (prevBtn) prevBtn.addEventListener('click', function () { preview = true; renderEditor(); });
    if (editBtn) editBtn.addEventListener('click', function () { preview = false; renderEditor(); });
  }

  // Ctrl/Cmd+E 切换编辑/预览（仅当 Notes 分区激活且有选中笔记）
  document.addEventListener('keydown', function (e) {
    if (!((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E'))) return;
    if (T.currentSec() !== 'notes' || !currentId) return;
    e.preventDefault();
    preview = !preview;
    renderEditor();
  });

  T.onShow('notes', render);
})();
