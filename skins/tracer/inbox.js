(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-inbox');

  function render() {
    var ws = T.store.data;
    var items = ws.inbox.slice().reverse(); // 新的在上
    var html = '<header class="sec-head"><h1>Inbox</h1>'
      + '<span class="sec-sub">Capture first, sort later</span></header>'
      + '<form class="inbox-add" id="inbox-add">'
      + '<input type="text" id="inbox-input" placeholder="Type a thought and press Enter…" autocomplete="off">'
      + '</form>';
    if (!items.length) {
      html += '<div class="empty"><svg class="empty-art" viewBox="0 0 96 72"><use href="#moon-art"/></svg>'
        + '<div class="empty-title">Inbox zero</div>'
        + '<div class="empty-sub">Capture a thought with one line — sort it later.</div></div>';
    } else {
      html += '<ul class="inbox-list">';
      items.forEach(function (it) {
        html += '<li class="inbox-item" data-id="' + it.id + '">'
          + '<span class="inbox-text">' + M.esc(it.text) + '</span>'
          + '<span class="inbox-acts">'
          + '<button class="chip" data-act="task">→ Task</button>'
          + '<button class="chip" data-act="note">→ Note</button>'
          + '<button class="chip chip-del" data-act="del" title="Delete">✕</button>'
          + '</span></li>';
      });
      html += '</ul>';
    }
    sec.innerHTML = html;

    document.getElementById('inbox-add').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = document.getElementById('inbox-input');
      if (M.addInbox(ws, inp.value)) { T.touch(); render(); }
    });
    sec.querySelector('.inbox-list') && sec.querySelector('.inbox-list').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var id = btn.closest('.inbox-item').dataset.id;
      var act = btn.dataset.act;
      if (act === 'task') M.inboxToTask(ws, id);
      else if (act === 'note') M.inboxToNote(ws, id);
      else if (act === 'del') M.deleteInbox(ws, id);
      T.touch(); render();
    });
  }

  T.onShow('inbox', render);
})();
