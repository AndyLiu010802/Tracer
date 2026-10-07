(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerGettingStarted = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function read(value) {
    if (!value || value.version !== 1 || ['active', 'dismissed'].indexOf(value.mode) < 0) return null;
    return { version: 1, mode: value.mode, taskId: typeof value.taskId === 'string' ? value.taskId : '', focused: value.focused === true };
  }
  function isNewWorkspace(ws) {
    if (!ws) return false;
    if (['tasks', 'projects', 'notes', 'inbox', 'completionHistory', 'projectDeletions'].some(function (key) { return (ws[key] || []).length; })) return false;
    if (ws.meta && (ws.meta.seqCounter > 0 || ws.meta.rev > 0)) return false;
    var garden = ws.taskGarden || {};
    return !['seeds', 'planets', 'deletedPlanets'].some(function (key) { return (garden[key] || []).length; });
  }
  function hasFocused(focus, id) {
    if (!focus || !id) return false;
    if ((focus.history || []).some(function (row) { return row.task && row.task.id === id && row.minutes > 0; })) return true;
    return !!(focus.mode === 'focus' && focus.task && focus.task.id === id && focus.runId && (focus.running || focus.remaining < focus.duration || focus.completed));
  }
  function progress(ws, base, state, focus) {
    var id = state && state.taskId;
    var task = id && (ws.tasks || []).find(function (row) { return row.id === id; });
    var saved = id && base && (base.tasks || []).find(function (row) { return row.id === id; });
    var seed = id && base && base.taskGarden && (base.taskGarden.seeds || []).find(function (row) { return row.taskId === id; });
    var complete = !!(saved && task && saved.status === 'done' && task.status === 'done');
    // Clearing a completed card does not delete the flower waiting to be harvested.
    if (!task && seed && seed.completedAt && seed.state !== 'destroyed') complete = true;
    var project = task && (ws.projects || []).find(function (row) { return row.id === task.projectId; });
    return { task: task || null, saved: !!(saved && task && saved.status === task.status), complete: complete,
      harvested: !!(seed && seed.state === 'harvested' && seed.harvestedAt),
      focused: !!(task || complete) && (!!(state && state.focused) || hasFocused(focus, id)), archived: !!(project && project.status === 'completed') };
  }
  return { read: read, isNewWorkspace: isNewWorkspace, hasFocused: hasFocused, progress: progress };
});
