(function () {
  'use strict';
  var T = window.Tracer, M = window.TracerModel, L = window.TracerLocale.t;
  function options(keys, selected) { return keys.map(function (k) { return '<option value="' + k + '"' + (k === (selected || '') ? ' selected' : '') + '>' + L(k || 'noPriority') + '</option>'; }).join(''); }
  function field(key, value, type, hint) {
    return '<div class="task-field"><label for="f-' + key + '">' + L(key) + '</label><input id="f-' + key + '" type="' + (type || 'text') + '" value="' + M.esc(value) + '"' + (type === 'number' ? ' min="0" max="100000" step="0.25"' : '') + (hint ? ' placeholder="' + L(hint) + '"' : '') + '></div>';
  }
  function area(key, value, hint) { return '<label for="f-' + key + '">' + L(key) + '</label><textarea id="f-' + key + '" placeholder="' + (hint ? L(hint) : '') + '">' + M.esc(value) + '</textarea>'; }
  T.taskEditor = function (ws, id, after, status) {
    var t = id ? M.findTask(ws, id) : { title: '', notes: '', status: status || 'todo', projectId: T.projectFilter ? T.projectFilter() : null };
    if (!t) return;
    T.ui.modal(function (box, close) {
      box.classList.add('task-editor'); box.setAttribute('aria-labelledby', 'task-editor-heading');
      var checks = JSON.parse(JSON.stringify(t.checklist || [])), dirty = false;
      var projectOptions = '<option value="">' + L('noProject') + '</option>' + ws.projects.map(function (p) { return '<option value="' + M.esc(p.id) + '"' + (p.id === t.projectId ? ' selected' : '') + '>' + M.esc(p.name) + '</option>'; }).join('');
      box.innerHTML = '<header class="task-editor-head"><div><span class="task-eyebrow">' + M.esc(t.seq || 'TRACER') + '</span><h2 id="task-editor-heading">' + L(id ? 'details' : 'newTask') + '</h2></div><button class="btn" id="f-close" aria-label="' + L('cancel') + '">×</button></header>'
        + '<label for="f-title">' + L('title') + '</label><input id="f-title" type="text" required maxlength="200" value="' + M.esc(t.title) + '" placeholder="' + L('titleHint') + '">'
        + '<div class="task-editor-grid"><div class="task-editor-content"><h3>' + L('detailsSection') + '</h3>'
        + '<label for="f-notes">' + L('description') + '</label><textarea id="f-notes" class="task-description" placeholder="' + L('notesHint') + '">' + M.esc(t.notes) + '</textarea>'
        + area('acceptance', t.acceptance, 'acceptanceHint')
        + '<div class="checklist-heading"><h3>' + L('checklist') + '</h3><span id="check-progress"></span></div><div id="check-list"></div><div class="check-add"><input id="check-new" type="text" maxlength="1000" placeholder="' + L('checklistHint') + '" aria-label="' + L('checklistHint') + '"><button id="check-add" class="btn">' + L('addStep') + '</button></div>'
        + area('links', (t.links || []).join('\n'), 'linksHint') + '<div id="task-link-list"></div>'
        + '<h3>' + L('dependsOn') + '</h3><p class="field-help">' + L('dependencyHint') + '</p><div class="dependency-list">'
        + (ws.tasks.filter(function (v) { return v.id !== id; }).map(function (v) { return '<label class="dependency-item"><input type="checkbox" data-dependency="' + M.esc(v.id) + '"' + ((t.dependsOn || []).indexOf(v.id) >= 0 ? ' checked' : '') + '><span><small>' + M.esc(v.seq) + ' · ' + L(v.status) + '</small>' + M.esc(v.title) + '</span></label>'; }).join('') || '<p>' + L('noDependencies') + '</p>')
        + '</div></div><aside class="task-properties"><h3>' + L('properties') + '</h3>'
        + '<label for="f-status">' + L('status') + '</label><select id="f-status">' + options(M.STATUSES, t.status) + '</select>'
        + '<label for="f-type">' + L('type') + '</label><select id="f-type">' + options(M.TASK_TYPES, t.type || 'task') + '</select>'
        + '<label for="f-pri">' + L('priority') + '</label><select id="f-pri">' + options(M.PRIORITIES, t.priority) + '</select>'
        + '<label for="f-proj">' + L('project') + '</label><select id="f-proj">' + projectOptions + '</select>'
        + field('assignee', t.assignee, 'text', 'ownerHint') + field('labels', (t.labels || []).join(', '), 'text', 'labelsHint')
        + field('scheduled', t.scheduled, 'date') + field('due', t.due, 'date')
        + '<div class="task-hours">' + field('estimate', t.estimate, 'number') + field('spent', t.spent, 'number') + '</div>'
        + (t.createdAt ? '<div class="task-timestamps"><span>' + L('createdAt') + '</span>' + M.esc(new Date(t.createdAt).toLocaleString()) + '<span>' + L('updatedAt') + '</span>' + M.esc(new Date(t.updatedAt || t.createdAt).toLocaleString()) + '</div>' : '')
        + '</aside></div><p id="task-error" role="alert" hidden></p><footer class="modal-actions task-editor-actions">'
        + (id ? '<button class="btn btn-danger" id="f-del">' + L('delete') + '</button>' : '')
        + '<span class="field-help shortcut-hint">' + L('saveShortcut') + '</span><span style="flex:1"></span><button class="btn" id="f-cancel">' + L('cancel') + '</button><button class="btn btn-primary" id="f-save">' + L('save') + '</button></footer>';
      function renderChecks() {
        box.querySelector('#check-progress').textContent = L('checklistProgress', { done: checks.filter(function (c) { return c.done; }).length, total: checks.length });
        box.querySelector('#check-list').innerHTML = checks.map(function (c, i) { return '<div class="check-row"><input type="checkbox" data-check="' + i + '" aria-label="' + M.esc(c.text) + '"' + (c.done ? ' checked' : '') + '><input type="text" maxlength="1000" data-check-text="' + i + '" aria-label="' + L('checklist') + '" value="' + M.esc(c.text) + '"><button class="btn" data-check-remove="' + i + '" aria-label="' + L('removeStep') + '">×</button></div>'; }).join('');
        box.querySelectorAll('[data-check]').forEach(function (el) { el.onchange = function () { checks[+el.dataset.check].done = el.checked; dirty = true; box.querySelector('#check-progress').textContent = L('checklistProgress', { done: checks.filter(function (c) { return c.done; }).length, total: checks.length }); }; });
        box.querySelectorAll('[data-check-text]').forEach(function (el) { el.oninput = function () { checks[+el.dataset.checkText].text = el.value; }; });
        box.querySelectorAll('[data-check-remove]').forEach(function (el) { el.onclick = function () { checks.splice(+el.dataset.checkRemove, 1); dirty = true; renderChecks(); box.querySelector('#check-new').focus(); }; });
      }
      function addCheck() { var input = box.querySelector('#check-new'); if (!input.value.trim()) return; checks.push({ id: M.uid(), text: input.value.trim(), done: false }); input.value = ''; dirty = true; renderChecks(); input.focus(); }
      renderChecks();
      function renderLinks() {
        box.querySelector('#task-link-list').innerHTML = box.querySelector('#f-links').value.split(/\r?\n/).map(function (v) { return v.trim(); }).filter(function (v) { return /^https?:\/\/[^\s]+$/i.test(v); }).map(function (v) { return '<a href="' + M.esc(v) + '" target="_blank" rel="noopener noreferrer">↗ ' + M.esc(v) + '</a>'; }).join('');
      }
      renderLinks(); box.querySelector('#f-links').addEventListener('input', renderLinks);
      box.querySelector('#check-add').onclick = addCheck;
      box.querySelector('#check-new').onkeydown = function (e) { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); addCheck(); } };
      box.addEventListener('input', function () { dirty = true; }); box.addEventListener('change', function () { dirty = true; });
      box.beforeClose = function () { return !dirty || window.confirm(L('unsavedConfirm')); };
      box.querySelector('#f-close').onclick = close; box.querySelector('#f-cancel').onclick = close;
      function value(key) { return box.querySelector('#f-' + key).value; }
      box.querySelector('#f-save').onclick = function () {
        var error = box.querySelector('#task-error'); error.hidden = true;
        var title = box.querySelector('#f-title'); title.setCustomValidity(title.value.trim() ? '' : L('requiredTitle'));
        if (!title.reportValidity()) return;
        var invalid = Array.prototype.find.call(box.querySelectorAll('input'), function (el) { return !el.checkValidity(); });
        if (invalid) { invalid.reportValidity(); return; }
        try {
          if (value('scheduled') && value('due') && value('due') < value('scheduled')) throw new Error(L('dateOrder'));
          if (id && !M.findTask(ws, id)) throw new Error(L('taskDeleted'));
          addCheck();
          var fields = { title: value('title'), notes: value('notes'), status: value('status'), type: value('type'), priority: value('pri') || null, projectId: value('proj') || null,
            scheduled: value('scheduled') || null, due: value('due') || null, assignee: value('assignee'), labels: value('labels').split(/[,，]/).filter(function (v) { return v.trim(); }),
            estimate: value('estimate'), spent: value('spent'), acceptance: value('acceptance'), checklist: checks,
            links: value('links').split(/\r?\n/).filter(function (v) { return v.trim(); }), dependsOn: Array.prototype.map.call(box.querySelectorAll('[data-dependency]:checked'), function (el) { return el.dataset.dependency; }) };
          if (id) M.updateTask(ws, id, fields); else M.addTask(ws, fields);
          T.touch(); dirty = false; close(true); T.redraw(); if (T.renderBoard) T.renderBoard(); if (after) after();
          T.ui.notice(L(id ? 'taskSaved' : 'taskCreated'));
        } catch (e) {
          var known = { 'Invalid dependency': 'dependencyError', 'Invalid hours': 'hoursError', 'Invalid resource link': 'linkError' };
          error.textContent = known[e.message] ? L(known[e.message]) : window.TracerLocale.message(e.message); error.hidden = false; error.scrollIntoView({ block: 'nearest' });
        }
      };
      box.querySelector('#f-title').oninput = function () { this.setCustomValidity(''); };
      box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); box.querySelector('#f-save').click(); } });
      if (id) box.querySelector('#f-del').onclick = function () {
        if (!window.confirm(L('deleteConfirm'))) return;
        M.deleteTask(ws, id); T.touch(); dirty = false; close(true); T.redraw(); if (T.renderBoard) T.renderBoard(); if (after) after();
      };
    });
  };
})();
