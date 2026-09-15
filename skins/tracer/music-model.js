(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerMusicModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function read(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var seen = new Set();
    return { mode: raw.mode === 'sequence' ? 'sequence' : 'single', volume: typeof raw.volume === 'number' && isFinite(raw.volume) ? Math.max(0, Math.min(1, raw.volume)) : .35,
      selected: typeof raw.selected === 'string' ? raw.selected : '',
      sequence: (Array.isArray(raw.sequence) ? raw.sequence : []).filter(function (row) { if (!row || typeof row.id !== 'string' || seen.has(row.id)) return false; seen.add(row.id); return true; }).slice(0, 200).map(function (row) { return { id: row.id, minutes: typeof row.minutes === 'number' && isFinite(row.minutes) ? Math.max(.1, Math.min(180, row.minutes)) : 5 }; }) };
  }
  function randomTrack(tracks, previous, random) {
    var pool = tracks.filter(function (t) { return t.id !== previous; });
    if (!pool.length) pool = tracks;
    return pool.length ? pool[Math.min(pool.length - 1, Math.floor(Math.max(0, random) * pool.length))].id : '';
  }
  // Real media time drives the allocation; pausing/buffering contributes no time.
  function mediaElapsed(previous, current, duration) {
    if (![previous, current].every(Number.isFinite)) return 0;
    if (current >= previous) return current - previous;
    return Number.isFinite(duration) && duration > 0 ? duration - previous + current : 0;
  }
  function next(sequence, id) { return sequence.length ? sequence[(sequence.findIndex(function (r) { return r.id === id; }) + 1) % sequence.length].id : ''; }
  return { read: read, randomTrack: randomTrack, mediaElapsed: mediaElapsed, next: next };
});
