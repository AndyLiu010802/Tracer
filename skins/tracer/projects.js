(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var L = window.TracerLocale.t;
  var list = document.getElementById('proj-list');
  var filterId = null; // 当前过滤的项目 id，null = 全部
  function text(zh, en) { return window.TracerLocale.language() === 'zh' ? zh : en; }

  T.projectFilter = function () { return filterId; };
  T.openProject = function (id) {
    var project = id && M.findProject(T.store.data,id);
    if (id && (!project || project.status === 'completed')) return false;
    filterId=id||null;render();T.show('board');if(T.renderBoard)T.renderBoard();return true;
  };

  function render() {
    var ws = T.store.data;
    if (filterId && (!M.findProject(ws, filterId) || M.findProject(ws, filterId).status === 'completed')) filterId = null;
    var html = '<button type="button" class="proj-item proj-all' + (filterId === null ? ' active' : '') + '" data-id="">' + L('allTasks') + '</button>';
    ws.projects.filter(function (p) { return p.status !== 'completed'; }).forEach(function (p) {
      html += '<div class="proj-row"><button type="button" class="proj-item' + (filterId === p.id ? ' active' : '') + '" data-id="' + M.esc(p.id) + '">'
        + '<i style="background:' + M.esc(p.color) + '"></i><span class="proj-name">' + M.esc(p.name) + '</span></button>'
        + '<button type="button" class="proj-complete" data-complete-project="' + M.esc(p.id) + '" aria-label="' + M.esc(text('完成并归档', 'Complete and archive') + ' · ' + p.name) + '" title="' + text('完成并归档项目', 'Complete and archive project') + '"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg></button>'
        + '<button type="button" class="proj-delete" data-delete-project="' + M.esc(p.id) + '" aria-label="' + M.esc(L('deleteProjectNamed', { name: p.name })) + '" title="' + L('deleteProject') + '">'
        + '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button></div>';
    });
    html += '<button class="proj-add" id="proj-add">+ ' + L('newProject') + '</button>';
    if (ws.projects.some(function (p) { return p.status === 'completed'; })) html += '<button type="button" class="proj-add proj-collection" id="proj-collection">◌ ' + text('查看星球收藏', 'View planet collection') + '</button>';
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
    list.querySelectorAll('[data-delete-project]').forEach(function (button) {
      button.onclick = function () { deleteProjectDialog(button.dataset.deleteProject); };
    });
    list.querySelectorAll('[data-complete-project]').forEach(function (button) { button.onclick = function () { completeProjectDialog(button.dataset.completeProject); }; });
    var collection = document.getElementById('proj-collection');
    if (collection) collection.onclick = function () { T.show('planets'); };
  }

  function completeProjectDialog(id) {
    var ws = T.store.data, project = M.findProject(ws, id);
    if (!project || project.status === 'completed') return;
    var unfinished = ws.tasks.filter(function (task) { return task.projectId === id && task.status !== 'done'; });
    if (unfinished.length) {
      T.ui.modal(function (box, close) {
        box.classList.add('project-complete-dialog'); box.setAttribute('aria-labelledby', 'project-complete-title');
        box.innerHTML = '<span class="task-action-eyebrow">' + text('让每一朵花完整盛放', 'Let every flower bloom') + '</span><h2 id="project-complete-title">' + text('还有 ' + unfinished.length + ' 项任务未完成', unfinished.length + ' tasks still in progress') + '</h2>'
          + '<p>' + M.esc(project.name) + '</p><p>' + text('先完成项目中的剩余任务，再把这段旅程珍藏成一颗花朵星球。归档不会替你完成任务。', 'Finish the remaining tasks before preserving this journey as a flower planet. Archiving does not complete tasks for you.') + '</p>'
          + '<div class="modal-actions"><button type="button" class="btn" id="project-complete-cancel">' + L('cancel') + '</button><button type="button" class="btn btn-primary" id="project-complete-continue">' + text('继续完成任务', 'Return to tasks') + '</button></div>';
        box.querySelector('#project-complete-cancel').onclick = close;
        box.querySelector('#project-complete-continue').onclick = function () { close(); T.openProject(id); };
      });
      document.getElementById('project-complete-cancel').focus(); return;
    }
    T.confirmTaskAction({ title: text('完成并珍藏这个项目？', 'Complete and preserve this project?'),
      body: text('「' + project.name + '」将归档到星球收藏。属于这个项目的已完成花朵会一起组成一颗可以转动浏览的小星球。', '“' + project.name + '” will be archived in your planet collection. Its completed flowers become a little planet you can turn and explore.'),
      detail: text('未收获的成熟花朵会自动收获。项目退出进行中的列表，任务、笔记与完成历史会保留。', 'Mature flowers are harvested automatically. The project leaves your active list; its tasks, notes and completion history are kept.'),
      confirmText: text('完成并生成星球', 'Complete and create planet')
    }, function () {
      var result = M.completeProject(T.store.data, id);
      if (!result || !result.ok) { if (result && result.reason === 'unfinished') completeProjectDialog(id); else T.ui.notice(text('项目已变化，请刷新后重试。', 'The project changed. Refresh and try again.')); return; }
      filterId = null; T.touch(); T.redraw(); T.show('planets');
      T.ui.notice(text('正在保存项目归档，保存成功后星球会出现在收藏中。', 'Saving your archived project. Its planet appears in the collection once saved.'));
    });
  }

  function clearCompletedTasksDialog(projectId) {
    var ws = T.store.data, project = projectId && M.findProject(ws, projectId);
    var count = ws.tasks.filter(function (task) { var owner = task.projectId && M.findProject(ws, task.projectId); return task.status === 'done' && (!projectId || task.projectId === projectId) && (!owner || owner.status !== 'completed'); }).length;
    if (!count) return;
    var scope = project ? text('项目「' + project.name + '」', 'project “' + project.name + '”') : text('所有进行中项目和未分组任务', 'all active projects and unassigned tasks');
    T.confirmTaskAction({ title: text('清除 ' + count + ' 项已完成任务？', 'Clear ' + count + ' completed tasks?'),
      body: text('清除范围：' + scope + '。这些任务将从任务列表移除，搜索和优先级筛选不会缩小此范围。', 'Scope: ' + scope + '. These tasks leave the task list; search and priority filters do not narrow this scope.'),
      detail: text('成熟花朵会自动收获到仓库，图鉴次数、植物伙伴、项目花朵与完成历史都会保留。之后仍可完成项目并生成星球。', 'Mature flowers are harvested into your warehouse. Collection counts, companions, project flowers and completion history are kept. You can still archive the project as a planet later.'),
      confirmText: text('清除已完成', 'Clear completed')
    }, function () {
      var result = M.clearCompletedTasks(T.store.data, projectId || undefined);
      if (!result || !result.ok) return;
      T.touch(); T.redraw(); if (T.renderBoard) T.renderBoard();
      T.ui.notice(text('已清除 ' + result.count + ' 项任务，收获与完成记录已保留。', result.count + ' tasks cleared. Harvests and completion records are kept.'));
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
        }) + '</p><p>' + L('deleteProjectWarning') + '</p><p class="task-action-detail">' + text('项目里尚未收获的植物也会销毁；已经收获的植物图鉴与伙伴会保留。', 'Unharvested plants in this project will also be destroyed. Harvested collection records and companions are kept.') + '</p>'
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
  T.completeProjectDialog = completeProjectDialog;
  T.clearCompletedTasksDialog = clearCompletedTasksDialog;
  T.ready.then(function (ws) { if (ws) render(); });
})();
