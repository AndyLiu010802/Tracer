(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./task-history') : root.TaskHistory);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.TracerInsights = api;
})(typeof self !== 'undefined' ? self : this, function (H) {
  'use strict';
  function day(time) { var d = new Date(time); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function add(date, amount) { var d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + amount); return day(d); }
  function range(days, today) { return { from: days ? add(today, 1 - days) : '', to: today }; }
  var ID = /^[a-zA-Z0-9_-]{1,100}$/;
  function validTime(value) { return Number.isFinite(value) && value > 0 && value <= 8640000000000000; }
  function projectKey(value) { return value === null || value === '' ? null : typeof value === 'string' && ID.test(value) ? value : undefined; }
  function tasks(ws) {
    var seen = new Set();
    return (Array.isArray(ws && ws.tasks) ? ws.tasks : []).filter(function (task) {
      if (!task || typeof task.id !== 'string' || !ID.test(task.id) || seen.has(task.id) || ['todo', 'doing', 'review', 'done'].indexOf(task.status) < 0) return false;
      seen.add(task.id); return true;
    });
  }
  function completed(ws, current) {
    var history = [];
    (Array.isArray(ws && ws.completionHistory) ? ws.completionHistory : []).forEach(function (row) {
      try { history.push(H.validate([row])[0]); } catch (_) { /* Ignore unusable retained rows without repairing storage. */ }
    });
    return H.completed({ tasks: current.filter(function (task) { return task.status !== 'done' || validTime(task.doneAt); }),
      projects: (Array.isArray(ws && ws.projects) ? ws.projects : []).filter(function (project) { return project && typeof project.id === 'string'; }), completionHistory: history });
  }
  // This view reads completed, retained sessions only. It never settles a timer
  // or writes inferred project ownership back into the user's history.
  function focusData(ws, focus, current, completions) {
    current = current || tasks(ws); completions = completions || completed(ws, current);
    var currentById = new Map(current.map(function (task) { return [task.id, task]; })), historicalProjects = new Map();
    completions.forEach(function (row) {
      if (!historicalProjects.has(row.taskId)) historicalProjects.set(row.taskId, new Set());
      historicalProjects.get(row.taskId).add(projectKey(row.projectId));
    });
    var history = focus && Array.isArray(focus.history) ? focus.history : [], sessions = new Map(), conflicting = new Set(), invalidCount = 0, duplicateCount = 0;
    history.forEach(function (row) {
      if (!row || typeof row.id !== 'string' || !row.id.trim() || row.id.length > 200 || !validTime(row.endedAt) || !Number.isFinite(row.minutes) || row.minutes <= 0 || row.minutes > 180) { invalidCount++; return; }
      var task = row.task && typeof row.task === 'object' && !Array.isArray(row.task) ? row.task : null;
      var taskId = task && typeof task.id === 'string' && ID.test(task.id) ? task.id : null;
      var explicit = !!task && Object.prototype.hasOwnProperty.call(task, 'projectId');
      var projectId = explicit ? projectKey(task.projectId) : undefined, attribution = explicit && projectId !== undefined ? 'direct' : 'unassigned';
      if (!explicit && taskId) {
        if (currentById.has(taskId)) {
          var present = currentById.get(taskId);
          projectId = projectKey(present.projectId === undefined ? null : present.projectId);
        } else {
          var candidates = historicalProjects.get(taskId);
          if (candidates && candidates.size === 1) projectId = candidates.values().next().value;
        }
        if (projectId !== undefined) attribution = 'inferred';
      }
      var session = { id: row.id, endedAt: row.endedAt, minutes: row.minutes, taskId: taskId, projectId: projectId, attribution: attribution };
      if (sessions.has(row.id)) {
        duplicateCount++;
        // Conflicting copies of a session are not evidence for either project.
        if (JSON.stringify(sessions.get(row.id)) !== JSON.stringify(session)) conflicting.add(row.id);
      } else sessions.set(row.id, session);
    });
    var rows = Array.from(sessions.values()).filter(function (row) { return !conflicting.has(row.id); });
    var minutes = rows.reduce(function (sum, row) { return sum + row.minutes; }, 0), reasons = [];
    if (history.length >= 500) reasons.push('history-cap');
    if (Number.isFinite(focus && focus.totalMinutes) && focus.totalMinutes > minutes + 0.000001) reasons.push('total-exceeds-retained');
    return { rows: rows, limited: reasons.length > 0, limitReasons: reasons, invalidCount: invalidCount + conflicting.size, duplicateCount: duplicateCount,
      unassignedCount: rows.filter(function (row) { return !row.projectId; }).length };
  }
  function focusSummary(data, rows) {
    return { sessionCount: rows.length, minutes: rows.reduce(function (sum, row) { return sum + row.minutes; }, 0),
      directCount: rows.filter(function (row) { return row.attribution === 'direct'; }).length,
      inferredCount: rows.filter(function (row) { return row.attribution === 'inferred'; }).length,
      firstEndedAt: rows.length ? Math.min.apply(null, rows.map(function (row) { return row.endedAt; })) : null,
      lastEndedAt: rows.length ? Math.max.apply(null, rows.map(function (row) { return row.endedAt; })) : null,
      limited: data.limited, limitReasons: data.limitReasons.slice(), unassignedCount: data.unassignedCount };
  }
  function hours(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100000; }
  function projectReview(ws, projectId, focus) {
    var allTasks = tasks(ws), completionRows = completed(ws, allTasks), validProject = typeof projectId === 'string' && ID.test(projectId);
    var current = validProject ? allTasks.filter(function (task) { return task.projectId === projectId; }) : [];
    var retained = validProject ? completionRows.filter(function (row) { return row.projectId === projectId; }) : [];
    var completedIds = new Set(retained.map(function (row) { return row.taskId; })), existingIds = new Set(allTasks.map(function (task) { return task.id; }));
    var clearedCount = Array.from(completedIds).filter(function (id) { return !existingIds.has(id); }).length;
    function total(key) { var filled = current.filter(function (task) { return hours(task[key]); }); return { hours: filled.reduce(function (sum, task) { return sum + task[key]; }, 0), filledCount: filled.length }; }
    var data = focusData(ws, focus, allTasks, completionRows), rows = validProject ? data.rows.filter(function (row) { return row.projectId === projectId; }) : [];
    var summary = focusSummary(data, rows), byTask = new Map();
    rows.forEach(function (row) { if (row.taskId) byTask.set(row.taskId, (byTask.get(row.taskId) || 0) + row.minutes); });
    var matched = current.filter(function (task) { return hours(task.estimate) && byTask.has(task.id); }), comparison = null;
    if (matched.length) {
      var estimateMinutes = matched.reduce(function (sum, task) { return sum + task.estimate * 60; }, 0), focusMinutes = matched.reduce(function (sum, task) { return sum + byTask.get(task.id); }, 0);
      comparison = { matchedTaskCount: matched.length, estimateMinutes: estimateMinutes, focusMinutes: focusMinutes, deltaMinutes: focusMinutes - estimateMinutes };
    }
    var warnings = [];
    if (clearedCount) warnings.push('cleared-task-hours-unavailable');
    if (summary.inferredCount) warnings.push('focus-project-inferred');
    if (summary.unassignedCount) warnings.push('focus-project-unassigned');
    if (summary.limited) warnings.push('focus-history-limited');
    if (data.invalidCount) warnings.push('focus-invalid-records');
    return { projectId: projectId, current: { total: current.length, done: current.filter(function (task) { return task.status === 'done'; }).length, remaining: current.filter(function (task) { return task.status !== 'done'; }).length },
      completions: { uniqueCount: completedIds.size, clearedCount: clearedCount, eventCount: retained.length }, estimate: total('estimate'), spent: total('spent'), focus: summary, comparison: comparison, warnings: warnings };
  }
  function analyze(ws, options, focus) {
    options = options || {}; var today = options.today || day(Date.now());
    var query = String(options.query || '').trim().toLowerCase();
    var allTasks = tasks(ws), completionRows = completed(ws, allTasks);
    var scope = completionRows.filter(function (h) { return (!options.project || h.projectId === options.project) && (!query || [h.title, h.seq, h.assignee, h.projectName].join(' ').toLowerCase().includes(query)); });
    var rows = scope.filter(function (h) { var date = day(h.completedAt); return (!options.from || date >= options.from) && (!options.to || date <= options.to); }).sort(function (a, b) { return b.completedAt - a.completedAt || a.id.localeCompare(b.id); });
    var end = options.to || today, start = options.from || (rows.length ? day(rows[rows.length - 1].completedAt) : add(end, -29));
    var span = Math.max(1, Math.round((Date.parse(end + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 86400000) + 1);
    var step = Math.ceil(span / 12), buckets = [];
    for (var i = 0; i < span; i += step) buckets.push({ from: add(start, i), to: add(start, Math.min(span - 1, i + step - 1)), count: 0 });
    rows.forEach(function (h) { var date = day(h.completedAt), bucket = buckets.find(function (b) { return date >= b.from && date <= b.to; }); if (bucket) bucket.count++; });
    var counts = { todo: 0, doing: 0, review: 0, done: 0 }, current = allTasks.filter(function (t) { return !options.project || t.projectId === options.project; });
    current.forEach(function (t) { if (counts[t.status] !== undefined) counts[t.status]++; });
    var retainedFocus = focusData(ws, focus, allTasks, completionRows);
    var focusRows = retainedFocus.rows.filter(function (h) { var date = day(h.endedAt); return (!options.project || h.projectId === options.project) && (!options.from || date >= options.from) && (!options.to || date <= options.to); });
    var focusStats = focusSummary(retainedFocus, focusRows);
    var heat = [], heatStart = add(today, -90), byDay = Object.create(null);
    scope.forEach(function (h) { var date = day(h.completedAt); byDay[date] = (byDay[date] || 0) + 1; });
    for (var n = 0; n < 91; n++) { var d = add(heatStart, n); heat.push({ date: d, count: byDay[d] || 0 }); }
    return { rows: rows, buckets: buckets, heat: heat, total: current.length, counts: counts, unique: new Set(rows.map(function (h) { return h.taskId; })).size,
      unknown: current.filter(function (t) { return t.status === 'done' && !validTime(t.doneAt); }).length,
      focusCount: focusStats.sessionCount, focusMinutes: focusStats.minutes, focusDirectCount: focusStats.directCount, focusInferredCount: focusStats.inferredCount,
      focusLimited: focusStats.limited, focusLimitReasons: focusStats.limitReasons };
  }
  function csv(rows, headers) {
    function cell(value) { value = String(value == null ? '' : value); if (/^[\s]*[=+@-]/.test(value)) value = "'" + value; return '"' + value.replace(/"/g, '""') + '"'; }
    return '\uFEFF' + [headers].concat(rows.map(function (h) { return [new Date(h.completedAt).toISOString(), h.seq, h.title, h.projectName, h.assignee]; })).map(function (row) { return row.map(cell).join(','); }).join('\r\n');
  }
  return { day: day, add: add, range: range, analyze: analyze, projectReview: projectReview, csv: csv };
});
