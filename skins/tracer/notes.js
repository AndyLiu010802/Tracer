(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-notes');
  var currentId = null;   // 当前打开的笔记 id
  var preview = false;    // false=编辑，true=渲染预览

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
      listHtml += '<div class="note-item' + active + '" data-id="' + n.id + '">'
        + (n.pinned ? '<span class="note-pin">●</span>' : '')
        + '<div class="note-item-title">' + M.esc(n.title) + '</div>'
        + '<div class="note-item-snip">' + M.esc(snippet || 'No content') + '</div>'
        + '</div>';
    });

    var html = '<header class="sec-head"><h1>Notes</h1>'
      + '<span class="sec-sub">Pages and drafts</span>'
      + '<span style="flex:1"></span>'
      + '<button class="btn btn-primary" id="note-new">+ New page</button></header>'
      + '<div class="notes-wrap">'
      + '<div class="note-list">' + (listHtml || '<div class="note-empty">No pages yet</div>') + '</div>'
      + '<div class="note-editor" id="note-editor"></div>'
      + '</div>';
    sec.innerHTML = html;

    document.getElementById('note-new').addEventListener('click', function () {
      var n = M.addNote(ws, { title: 'Untitled' });
      currentId = n.id; preview = false; T.touch(); render();
    });
    sec.querySelector('.note-list').addEventListener('click', function (e) {
      var item = e.target.closest('.note-item');
      if (!item) return;
      currentId = item.dataset.id; preview = false; renderEditor();
      // 只更新列表高亮，不整体重绘
      sec.querySelectorAll('.note-item').forEach(function (el) {
        el.classList.toggle('active', el.dataset.id === currentId);
      });
    });
    renderEditor();
  }

  function renderEditor() {
    var ws = T.store.data;
    var box = document.getElementById('note-editor');
    if (!box) return;
    var n = currentId ? M.findNote(ws, currentId) : null;
    if (!n) { box.innerHTML = '<div class="note-empty">Select or create a page</div>'; return; }

    if (preview) {
      box.innerHTML = '<div class="note-toolbar">'
        + '<input class="note-title" id="note-title" value="' + M.esc(n.title) + '" readonly>'
        + '<button class="chip" id="note-edit">✎ Edit</button>'
        + '<button class="chip" id="note-pin">' + (n.pinned ? '★ Pinned' : '☆ Pin') + '</button>'
        + '<button class="chip chip-del" id="note-del">Delete</button></div>'
        + '<div class="note-rendered">' + M.renderMarkdown(n.body) + '</div>';
    } else {
      box.innerHTML = '<div class="note-toolbar">'
        + '<input class="note-title" id="note-title" value="' + M.esc(n.title) + '" placeholder="Untitled">'
        + '<button class="chip" id="note-preview">◱ Preview</button>'
        + '<button class="chip" id="note-pin">' + (n.pinned ? '★ Pinned' : '☆ Pin') + '</button>'
        + '<button class="chip chip-del" id="note-del">Delete</button></div>'
        + '<textarea class="note-body" id="note-body" placeholder="Write in Markdown…  (Ctrl+E toggles preview)"></textarea>';
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
      T.ui.confirm('Delete this page?', function () { M.deleteNote(ws, n.id); currentId = null; T.touch(); render(); });
    });
    if (prevBtn) prevBtn.addEventListener('click', function () { preview = true; renderEditor(); });
    if (editBtn) editBtn.addEventListener('click', function () { preview = false; renderEditor(); });
  }

  // Ctrl+E 切换编辑/预览（仅当 Notes 分区激活且有选中笔记）
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey && (e.key === 'e' || e.key === 'E'))) return;
    if (T.currentSec() !== 'notes' || !currentId) return;
    e.preventDefault();
    preview = !preview;
    renderEditor();
  });

  T.onShow('notes', render);
})();
