(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerFocus = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MODES = ['focus', 'short', 'long'];
  function dayKey(time) { var d = new Date(time); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function config(input) {
    input = input || {};
    var defaults = { focus: 25, short: 5, long: 15, rounds: 4 };
    Object.keys(defaults).forEach(function (k) { var n = Number(input[k]); if (Number.isInteger(n) && n >= 1 && n <= (k === 'rounds' ? 12 : k === 'focus' ? 180 : 60)) defaults[k] = n; });
    defaults.sound = input.sound !== false; defaults.notifications = input.notifications === true;
    return defaults;
  }
  function fresh() { return { v: 1, settings: config(), mode: 'focus', duration: 1500000, remaining: 1500000, running: false, endAt: null, runId: '', task: null, completed: false, alarm: null, lastNotifiedId: '', roundsDone: 0, totalMinutes: 0, activity: { keys: {}, clicks: 0, unknown: 0 }, history: [] }; }
  function read(input) {
    if (!input || input.v !== 1) return fresh();
    var s = fresh(); s.settings = config(input.settings);
    s.mode = MODES.indexOf(input.mode) >= 0 ? input.mode : 'focus';
    s.duration = Number.isFinite(input.duration) && input.duration > 0 && input.duration <= 10800000 ? input.duration : s.settings[s.mode] * 60000;
    s.remaining = Number.isFinite(input.remaining) ? Math.max(0, Math.min(s.duration, input.remaining)) : s.duration;
    s.running = !!input.running && Number.isFinite(input.endAt) && input.endAt > 0;
    s.endAt = s.running ? input.endAt : null; s.runId = typeof input.runId === 'string' ? input.runId : '';
    if (s.running && !s.runId) { s.running = false; s.endAt = null; }
    s.task = input.task && typeof input.task.id === 'string' && typeof input.task.title === 'string' ? { id: input.task.id, title: input.task.title,
      ...(Object.prototype.hasOwnProperty.call(input.task, 'projectId') ? { projectId: typeof input.task.projectId === 'string' ? input.task.projectId : null } : {}) } : null;
    s.completed = !!input.completed && !s.running;
    s.roundsDone = Number.isSafeInteger(input.roundsDone) && input.roundsDone >= 0 ? input.roundsDone : 0;
    s.history = Array.isArray(input.history) ? input.history.filter(function (h) { return h && typeof h.id === 'string' && Number.isFinite(h.endedAt) && Number.isFinite(h.minutes) && h.minutes > 0; }).slice(-500) : [];
    s.totalMinutes = Number.isFinite(input.totalMinutes) && input.totalMinutes >= 0 ? input.totalMinutes : s.history.reduce(function (sum, h) { return sum + h.minutes; }, 0);
    var activity = input.activity || {};
    ['clicks', 'unknown'].forEach(function (k) { if (Number.isSafeInteger(activity[k]) && activity[k] >= 0) s.activity[k] = activity[k]; });
    Object.keys(activity.keys || {}).forEach(function (k) { if (/^(?:[a-z0-9]|SPC|LMB)$/.test(k) && Number.isSafeInteger(activity.keys[k]) && activity.keys[k] >= 0) s.activity.keys[k] = activity.keys[k]; });
    s.alarm = input.alarm && typeof input.alarm.id === 'string' && MODES.indexOf(input.alarm.mode) >= 0 ? input.alarm : null;
    s.lastNotifiedId = typeof input.lastNotifiedId === 'string' ? input.lastNotifiedId : '';
    return s;
  }
  function removeTasks(s, ids) {
    var removed = s.history.filter(function (h) { return h.task && ids.has(h.task.id); });
    if (s.task && ids.has(s.task.id)) { reset(s); s.task = null; }
    s.history = s.history.filter(function (h) { return !h.task || !ids.has(h.task.id); });
    s.totalMinutes = Math.max(0, s.totalMinutes - removed.reduce(function (sum, h) { return sum + h.minutes; }, 0));
    s.roundsDone = Math.max(0, s.roundsDone - removed.length);
  }
  function remaining(s, now) { return s.running ? Math.min(s.duration, Math.max(0, s.endAt - now)) : s.remaining; }
  function settle(s, now) {
    if (!s.running || now < s.endAt) return false;
    var endedAt = s.endAt; s.running = false; s.endAt = null; s.remaining = 0; s.completed = true;
    if (s.mode === 'focus' && !s.history.some(function (h) { return h.id === s.runId; })) {
      s.history.push({ id: s.runId, endedAt: endedAt, minutes: s.duration / 60000, task: s.task }); s.history = s.history.slice(-500); s.roundsDone++; s.totalMinutes += s.duration / 60000;
    }
    s.alarm = { id: s.runId, mode: s.mode, endedAt: endedAt };
    return true;
  }
  function reset(s, mode) {
    s.mode = MODES.indexOf(mode) >= 0 ? mode : s.mode;
    s.duration = s.settings[s.mode] * 60000; s.remaining = s.duration;
    s.running = false; s.endAt = null; s.runId = ''; s.completed = false; s.alarm = null;
  }
  function start(s, now, id) {
    settle(s, now);
    if (s.running || s.completed) return false;
    if (!s.runId) s.runId = id;
    s.running = true; s.endAt = now + s.remaining; s.alarm = null; return true;
  }
  function pause(s, now) { if (settle(s, now)) return; if (!s.running) return; s.remaining = remaining(s, now); s.running = false; s.endAt = null; }
  function nextMode(s) { return s.mode === 'focus' ? (s.roundsDone > 0 && s.roundsDone % s.settings.rounds === 0 ? 'long' : 'short') : 'focus'; }
  function today(s, now) { var key = dayKey(now), rows = s.history.filter(function (h) { return dayKey(h.endedAt) === key; }); return { count: rows.length, minutes: rows.reduce(function (sum, h) { return sum + h.minutes; }, 0) }; }
  function format(ms) { var seconds = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); }
  return { fresh: fresh, read: read, config: config, dayKey: dayKey, removeTasks: removeTasks, remaining: remaining, settle: settle, reset: reset, start: start, pause: pause, nextMode: nextMode, today: today, format: format };
});
