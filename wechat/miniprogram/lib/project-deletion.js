(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProjectDeletion = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function validate(rows) {
    if (rows === undefined) return [];
    if (!Array.isArray(rows) || rows.length > 10000) throw new Error('Invalid project deletions');
    var valid = function (id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id); };
    return rows.map(function (row) {
      if (!row || !valid(row.id) || !Array.isArray(row.taskIds) || row.taskIds.length > 50000 || !row.taskIds.every(valid)) throw new Error('Invalid project deletion');
      return { id: row.id, taskIds: Array.from(new Set(row.taskIds)) };
    });
  }
  function merge() {
    var rows = new Map();
    Array.prototype.forEach.call(arguments, function (ws) {
      validate(ws ? ws.projectDeletions : undefined).forEach(function (row) {
        rows.set(row.id, Array.from(new Set((rows.get(row.id) || []).concat(row.taskIds))));
      });
    });
    return Array.from(rows, function (pair) { return { id: pair[0], taskIds: pair[1] }; });
  }
  // Only IDs are retained so a stale client cannot restore deleted content.
  function apply(ws) {
    if (!ws || !(ws.projectDeletions || []).length) return ws;
    var rows = merge(ws), byProject = new Map(rows.map(function (r) { return [r.id, new Set(r.taskIds)]; }));
    var currentTasks = new Map((ws.tasks || []).map(function (task) { return [task.id, task]; }));
    (ws.tasks || []).concat(ws.completionHistory || []).forEach(function (item) {
      // A past completion in this project does not make a task that has since
      // moved to another project part of the deletion.
      if (byProject.has(item.projectId) && (!item.taskId || !currentTasks.has(item.taskId))) byProject.get(item.projectId).add(item.taskId || item.id);
    });
    var ids = new Set();
    ws.projectDeletions = Array.from(byProject, function (pair) {
      pair[1].forEach(function (id) { ids.add(id); });
      return { id: pair[0], taskIds: Array.from(pair[1]) };
    });
    ['projects', 'tasks', 'notes', 'inbox', 'completionHistory'].forEach(function (name) {
      if (!ws[name]) return;
      ws[name] = ws[name].filter(function (item) {
        return !byProject.has(name === 'projects' ? item.id : item.projectId)
          && !(name === 'tasks' && ids.has(item.id)) && !(name === 'completionHistory' && ids.has(item.taskId));
      });
    });
    (ws.tasks || []).forEach(function (task) {
      if ((task.dependsOn || []).some(function (id) { return ids.has(id); })) {
        task.dependsOn = task.dependsOn.filter(function (id) { return !ids.has(id); });
      }
    });
    return ws;
  }
  function remove(ws, id) {
    if (!(ws.projects || []).some(function (p) { return p.id === id; })) return false;
    ws.projectDeletions = merge(ws, { projectDeletions: [{ id: id, taskIds: [] }] });
    apply(ws);
    return true;
  }
  return { validate: validate, merge: merge, apply: apply, remove: remove };
});
