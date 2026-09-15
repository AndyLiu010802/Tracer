(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var L = window.TracerLocale.t;
  var list = document.getElementById('proj-list');
  var filterId = null; // 当前过滤的项目 id，null = 全部

  T.projectFilter = function () { return filterId; };

  function render() {
    var ws = T.store.data;
    var html = '<a class="proj-item proj-all' + (filterId === null ? ' active' : '') + '" data-id="">' + L('allTasks') + '</a>';
    ws.projects.forEach(function (p) {
      html += '<a class="proj-item' + (filterId === p.id ? ' active' : '') + '" data-id="' + p.id + '">'
        + '<i style="background:' + p.color + '"></i>' + M.esc(p.name) + '</a>';
    });
    html += '<button class="proj-add" id="proj-add">+ ' + L('newProject') + '</button>';
    list.innerHTML = html;

    list.querySelectorAll('.proj-item').forEach(function (a) {
      a.addEventListener('click', function () {
        filterId = a.dataset.id || null;
        render();
        T.show('board');
        if (T.renderBoard) T.renderBoard();
      });
    });
    document.getElementById('proj-add').addEventListener('click', addProjectDialog);
  }

  function addProjectDialog() {
    T.ui.modal(function (box, close) {
      box.innerHTML = '<h2>' + L('newProject') + '</h2>'
        + '<label for="p-name">' + L('name') + '</label><input type="text" id="p-name" placeholder="' + L('projectName') + '">'
        + '<div class="modal-actions"><button class="btn" id="p-cancel">' + L('cancel') + '</button>'
        + '<button class="btn btn-primary" id="p-save">' + L('create') + '</button></div>';
      box.querySelector('#p-cancel').onclick = close;
      box.querySelector('#p-save').onclick = function () {
        if (M.addProject(T.store.data, { name: box.querySelector('#p-name').value })) {
          T.touch(); close(); render();
        }
      };
      box.querySelector('#p-name').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') box.querySelector('#p-save').click();
      });
    });
  }

  T.renderProjects = render;
  T.ready.then(function (ws) { if (ws) render(); });
})();
