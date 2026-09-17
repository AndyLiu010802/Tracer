(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var L = window.TracerLocale.t;
  var list = document.getElementById('proj-list');
  var filterId = null; // 当前过滤的项目 id，null = 全部

  T.projectFilter = function () { return filterId; };
  T.openProject = function (id) {
    if (id && !M.findProject(T.store.data,id)) return false;
    filterId=id||null;render();T.show('board');if(T.renderBoard)T.renderBoard();return true;
  };

  function render() {
    var ws = T.store.data;
    if (filterId && !M.findProject(ws, filterId)) filterId = null;
    var html = '<button type="button" class="proj-item proj-all' + (filterId === null ? ' active' : '') + '" data-id="">' + L('allTasks') + '</button>';
    ws.projects.forEach(function (p) {
      html += '<div class="proj-row"><button type="button" class="proj-item' + (filterId === p.id ? ' active' : '') + '" data-id="' + M.esc(p.id) + '">'
        + '<i style="background:' + M.esc(p.color) + '"></i><span class="proj-name">' + M.esc(p.name) + '</span></button>'
        + '<button type="button" class="proj-delete" data-delete-project="' + M.esc(p.id) + '" aria-label="' + M.esc(L('deleteProjectNamed', { name: p.name })) + '" title="' + L('deleteProject') + '">'
        + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button></div>';
    });
    html += '<button class="proj-add" id="proj-add">+ ' + L('newProject') + '</button>';
    list.innerHTML = html;
    if(T.garden&&window.TracerGardenHomeView?.plant){
      T.garden.read().plots.forEach(function(plot){
        var entry=Array.from(list.querySelectorAll('.proj-item')).find(function(item){return item.dataset.id===plot.projectId;});
        if(!entry)return;
        var button=document.createElement('button');button.type='button';button.className='proj-garden';button.dataset.gardenProject=plot.projectId;
        button.title=TracerLocale.language()==='zh'?'查看项目花圃':'View project plot';button.setAttribute('aria-label',button.title+' · '+M.findProject(ws,plot.projectId).name);
        button.appendChild(TracerGardenHomeView.plant(plot.plantKind,plot.stage));button.onclick=function(){T.garden.open(plot.projectId);};entry.after(button);
      });
    }

    list.querySelectorAll('.proj-item').forEach(function (a) {
      a.addEventListener('click', function () {
        filterId = a.dataset.id || null;
        render();
        T.show('board');
        if (T.renderBoard) T.renderBoard();
      });
    });
    document.getElementById('proj-add').addEventListener('click', addProjectDialog);
    list.querySelectorAll('[data-delete-project]').forEach(function (button) {
      button.onclick = function () { deleteProjectDialog(button.dataset.deleteProject); };
    });
  }

  function deleteProjectDialog(id) {
    var ws = T.store.data, project = M.findProject(ws, id);
    if (!project) return;
    var tasks = ws.tasks.filter(function (t) { return t.projectId === id; });
    var ids = new Set(tasks.map(function (t) { return t.id; }));
    var history = window.TaskHistory.completed(ws).filter(function (h) { return h.projectId === id || ids.has(h.taskId); });
    T.ui.modal(function (box, close) {
      box.classList.add('project-delete-dialog');
      box.setAttribute('aria-labelledby', 'project-delete-title');
      box.innerHTML = '<h2 id="project-delete-title">' + L('deleteProject') + '</h2>'
        + '<p class="project-delete-name"></p><p>' + L('deleteProjectContents', {
          tasks: tasks.length, notes: ws.notes.filter(function (n) { return n.projectId === id; }).length, history: history.length
        }) + '</p><p>' + L('deleteProjectWarning') + '</p>'
        + '<div class="modal-actions"><button type="button" class="btn" id="project-delete-cancel">' + L('cancel') + '</button>'
        + '<button type="button" class="btn btn-danger" id="project-delete-confirm">' + L('deleteProject') + '</button></div>';
      box.querySelector('.project-delete-name').textContent = project.name;
      box.querySelector('#project-delete-cancel').onclick = close;
      box.querySelector('#project-delete-confirm').onclick = function () {
        if (M.deleteProject(T.store.data, id)) {
          T.touch(); close(); T.redraw(); T.ui.notice(L('projectDeleted'));
        } else { close(); T.redraw(); }
      };
    });
    document.getElementById('project-delete-cancel').focus();
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
