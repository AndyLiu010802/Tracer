(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./task-history') : root.TaskHistory);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.TracerInsights = api;
})(typeof self !== 'undefined' ? self : this, function (H) {
  'use strict';
  function day(time) { var d = new Date(time); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function add(date, amount) { var d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + amount); return day(d); }
  function range(days, today) { return { from: days ? add(today, 1 - days) : '', to: today }; }
  function analyze(ws, options, focus) {
    options = options || {}; var today = options.today || day(Date.now());
    var query = String(options.query || '').trim().toLowerCase();
    var scope = H.completed(ws).filter(function (h) { return (!options.project || h.projectId === options.project) && (!query || [h.title, h.seq, h.assignee, h.projectName].join(' ').toLowerCase().includes(query)); });
    var rows = scope.filter(function (h) { var date = day(h.completedAt); return (!options.from || date >= options.from) && (!options.to || date <= options.to); }).sort(function (a, b) { return b.completedAt - a.completedAt || a.id.localeCompare(b.id); });
    var end = options.to || today, start = options.from || (rows.length ? day(rows[rows.length - 1].completedAt) : add(end, -29));
    var span = Math.max(1, Math.round((Date.parse(end + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 86400000) + 1);
    var step = Math.ceil(span / 12), buckets = [];
    for (var i = 0; i < span; i += step) buckets.push({ from: add(start, i), to: add(start, Math.min(span - 1, i + step - 1)), count: 0 });
    rows.forEach(function (h) { var date = day(h.completedAt), bucket = buckets.find(function (b) { return date >= b.from && date <= b.to; }); if (bucket) bucket.count++; });
    var counts = { todo: 0, doing: 0, review: 0, done: 0 }, current = ws.tasks.filter(function (t) { return !options.project || t.projectId === options.project; });
    current.forEach(function (t) { if (counts[t.status] !== undefined) counts[t.status]++; });
    var focusRows = focus && Array.isArray(focus.history) ? focus.history.filter(function (h) { var date = day(h.endedAt); return (!options.from || date >= options.from) && (!options.to || date <= options.to); }) : [];
    var heat = [], heatStart = add(today, -90), byDay = Object.create(null);
    scope.forEach(function (h) { var date = day(h.completedAt); byDay[date] = (byDay[date] || 0) + 1; });
    for (var n = 0; n < 91; n++) { var d = add(heatStart, n); heat.push({ date: d, count: byDay[d] || 0 }); }
    return { rows: rows, buckets: buckets, heat: heat, total: current.length, counts: counts, unique: new Set(rows.map(function (h) { return h.taskId; })).size,
      unknown: current.filter(function (t) { return t.status === 'done' && !(t.doneAt > 0); }).length,
      focusCount: focusRows.length, focusMinutes: focusRows.reduce(function (sum, h) { return sum + h.minutes; }, 0) };
  }
  function csv(rows, headers) {
    function cell(value) { value = String(value == null ? '' : value); if (/^[\s]*[=+@-]/.test(value)) value = "'" + value; return '"' + value.replace(/"/g, '""') + '"'; }
    return '\uFEFF' + [headers].concat(rows.map(function (h) { return [new Date(h.completedAt).toISOString(), h.seq, h.title, h.projectName, h.assignee]; })).map(function (row) { return row.map(cell).join(','); }).join('\r\n');
  }
  return { day: day, add: add, range: range, analyze: analyze, csv: csv };
});
