(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('../skins/tracer/focus-model') : root.TracerFocus);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerBackupPreferences = api;
})(typeof self !== 'undefined' ? self : this, function (Focus) {
  'use strict';
  var KEYS = ['tracer.language', 'tracer.focus.v1', 'tracer.ambient.v1', 'tracer.gettingStarted.v1',
    'tracer.gardenHidden', 'tracer.railCollapsed', 'tracer.railWidth', 'tracer.wallpaperOpacity', 'tracer.wallpaperPaused', 'tracer.wallpaperSpeed', 'tracer.pet.v1'];
  function fail() { throw new Error('backup-invalid-preferences'); }
  function record(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  function task(value) {
    if (!value) return null;
    if (!record(value) || typeof value.id !== 'string' || value.id.length > 100 || typeof value.title !== 'string' || value.title.length > 2000) fail();
    return { id: value.id, title: value.title, projectId: typeof value.projectId === 'string' ? value.projectId.slice(0, 100) : null };
  }
  function clean(input) {
    if (!record(input) || JSON.stringify(input).length > 1024 * 1024) fail();
    var out = {};
    KEYS.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) return;
      var raw = input[key], value;
      if (typeof raw !== 'string' || raw.length > 900000) fail();
      if (key === 'tracer.pet.v1') {
        try { value=JSON.parse(raw); } catch (_) { fail(); }
        if(!record(value)||value.v!==1||!Number.isFinite(value.updatedAt))fail();
        var Pet=typeof module==='object'&&module.exports?require('../skins/tracer/pet-model'):globalThis.TracerPetModel;
        if(!Pet)fail();out[key]=JSON.stringify(Pet.read(value));
      } else if (key === 'tracer.focus.v1') {
        try { value = JSON.parse(raw); } catch (_) { fail(); }
        if (!record(value) || value.v !== 1) fail();
        var focus = Focus.read(value);
        focus.task = task(focus.task);
        focus.history = focus.history.map(function (row) {
          if (row.id.length > 200) fail();
          return { id: row.id, endedAt: row.endedAt, minutes: row.minutes, task: task(row.task) };
        });
        focus.alarm = focus.alarm ? { id: focus.alarm.id.slice(0, 200), mode: focus.alarm.mode, endedAt: Number(focus.alarm.endedAt) || 0 } : null;
        out[key] = JSON.stringify(focus);
      } else if (key === 'tracer.gettingStarted.v1') {
        try { value = JSON.parse(raw); } catch (_) { fail(); }
        if (!record(value) || value.version !== 1 || ['active', 'dismissed'].indexOf(value.mode) < 0) fail();
        out[key] = JSON.stringify({ version: 1, mode: value.mode, taskId: typeof value.taskId === 'string' ? value.taskId.slice(0, 100) : '', focused: value.focused === true });
      } else if (key === 'tracer.ambient.v1') {
        try { value = JSON.parse(raw); } catch (_) { fail(); }
        if (!record(value)) fail();
        out[key] = JSON.stringify({ scene: typeof value.scene === 'string' ? value.scene.slice(0, 80) : '', enabled: value.enabled !== false, collapsed: value.collapsed === true, day: typeof value.day === 'string' ? value.day.slice(0, 32) : '' });
      } else if (key === 'tracer.language') {
        if (['en', 'zh'].indexOf(raw) < 0) fail(); out[key] = raw;
      } else if (['tracer.gardenHidden', 'tracer.railCollapsed', 'tracer.wallpaperPaused'].indexOf(key) >= 0) {
        if (['0', '1'].indexOf(raw) < 0) fail(); out[key] = raw;
      } else {
        var number = Number(raw);
        if (!raw.trim() || !Number.isFinite(number)) fail();
        if (key === 'tracer.wallpaperSpeed' && [.5, 1, 1.6].indexOf(number) < 0) fail();
        if (key === 'tracer.wallpaperOpacity' && (number < 0 || number > 100)) fail();
        if (key === 'tracer.railWidth' && (number < 0 || number > 4000)) fail();
        out[key] = String(number);
      }
    });
    return out;
  }
  function forRestore(input) {
    var out = clean(input);
    if (out['tracer.focus.v1']) {
      var focus = JSON.parse(out['tracer.focus.v1']);
      // A backup is a snapshot, not a schedule: never start, ring, or settle it.
      focus.running = false; focus.endAt = null; focus.alarm = null; focus.lastNotifiedId = '';
      out['tracer.focus.v1'] = JSON.stringify(focus);
    }
    return out;
  }
  return { KEYS: KEYS, clean: clean, forRestore: forRestore };
});
