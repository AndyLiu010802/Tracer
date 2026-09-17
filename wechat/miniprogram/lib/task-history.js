(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./project-deletion') : root.ProjectDeletion);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TaskHistory = api;
})(typeof self !== 'undefined' ? self : this, function (Deletion) {
  'use strict';
  function snapshot(ws, task) {
    if (!task || !Number.isFinite(task.doneAt) || task.doneAt <= 0) return null;
    var project = (ws.projects || []).find(function (p) { return p.id === task.projectId; });
    return { id: 'done_' + task.id + '_' + task.doneAt, kind: 'completed', taskId: task.id, completedAt: task.doneAt,
      title: task.title || '', seq: task.seq || '', projectId: task.projectId || '', projectName: project ? project.name : '', assignee: task.assignee || '', due: task.due || '' };
  }
  function union() {
    var found = Object.create(null);
    Array.prototype.forEach.call(arguments, function (rows) { (rows || []).forEach(function (row) { if (!found[row.id]) found[row.id] = row; }); });
    return Object.keys(found).map(function (id) { return found[id]; }).sort(function (a, b) { return a.completedAt - b.completedAt || a.id.localeCompare(b.id); });
  }
  function all(ws) {
    return union(ws.completionHistory, (ws.tasks || []).filter(function (t) { return t.status === 'done'; }).map(function (t) { return snapshot(ws, t); }).filter(Boolean));
  }
  function ensure(ws) { var rows = all(ws), changed = rows.length !== (ws.completionHistory || []).length; if (rows.length || ws.completionHistory) ws.completionHistory = rows; return changed; }
  function record(ws, task) { var row = snapshot(ws, task); if (row) ws.completionHistory = union(ws.completionHistory, [row]); }
  function undo(ws, taskId, time) {
    var target = 'done_' + taskId + '_' + time;
    if (!(ws.completionHistory || []).some(function (h) { return h.id === target; })) return;
    ws.completionHistory = union(ws.completionHistory, [{ id: 'void_' + target, kind: 'void', taskId: taskId, completedAt: time, target: target }]);
  }
  function completed(ws) {
    var rows = all(ws), voids = new Set(rows.filter(function (h) { return h.kind === 'void'; }).map(function (h) { return h.target; }));
    return rows.filter(function (h) { return h.kind === 'completed' && !voids.has(h.id); });
  }
  function preserve(previous, next) {
    if (!next || !Array.isArray(next.tasks)) return next;
    var deletions = Deletion.merge(previous, next);
    if (deletions.length) next.projectDeletions = deletions;
    next.completionHistory = union(previous && all(previous), all(next));
    if (!next.completionHistory.length && !(previous && previous.completionHistory)) delete next.completionHistory;
    return Deletion.apply(next);
  }
  function validate(rows) {
    if (rows === undefined) return [];
    if (!Array.isArray(rows) || rows.length > 50000) throw new Error('Invalid completion history');
    var ids = new Set();
    return rows.map(function (r) {
      if (!r || typeof r.taskId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.taskId) || !Number.isFinite(r.completedAt) || r.completedAt <= 0 || r.completedAt > 8640000000000000) throw new Error('Invalid completion record');
      var target = 'done_' + r.taskId + '_' + r.completedAt;
      if (!['completed', 'void'].includes(r.kind) || r.id !== (r.kind === 'completed' ? target : 'void_' + target) || ids.has(r.id)) throw new Error('Invalid completion record ID');
      ids.add(r.id);
      var row = { id: r.id, kind: r.kind, taskId: r.taskId, completedAt: r.completedAt };
      if (r.kind === 'void') { if (r.target !== target) throw new Error('Invalid history cancellation'); row.target = r.target; }
      else ['title', 'seq', 'projectId', 'projectName', 'assignee', 'due'].forEach(function (k) { if (typeof r[k] !== 'string' || r[k].length > 100000) throw new Error('Invalid history snapshot'); row[k] = r[k]; });
      return row;
    });
  }
  return { ensure: ensure, record: record, undo: undo, all: all, completed: completed, union: union, preserve: preserve, validate: validate };
});
