(function () {
  'use strict';
  var T = window.Tracer, M = window.TracerMusicModel, esc = window.TracerModel.esc, L = window.TracerLocale.t;
  var KEY = 'tracer.music.v1', settings;
  try { settings = M.read(JSON.parse(localStorage.getItem(KEY))); } catch (e) { settings = M.read(); }
  var tracks = [], panel = null, element = new Audio(), active = '', wanted = false, loading = false, error = '', elapsed = 0, previous = 0, generation = 0;
  element.id = 'focus-audio'; element.preload = 'none'; element.loop = true; element.volume = settings.volume; document.body.appendChild(element);
  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { error = L('musicStorageError'); } }
  function track(id) { return tracks.find(function (t) { return t.id === id; }); }
  function availablePlan() { return settings.sequence.filter(function (r) { return !!track(r.id); }); }
  function account() { if (active) elapsed += M.mediaElapsed(previous, element.currentTime, element.duration); previous = element.currentTime; }
  function pause() { account(); wanted = false; generation++; element.pause(); draw(); }
  function choose(id) {
    if (!track(id)) return;
    generation++; element.pause(); active = id; settings.selected = id; elapsed = 0; previous = 0; element.src = track(id).url; element.load(); save();
  }
  async function play() {
    error = '';
    if (settings.mode === 'sequence') {
      var plan = availablePlan();
      if (!plan.length) { error = L('musicEmptyPlan'); draw(); return; }
      if (!plan.some(function (r) { return r.id === active; })) choose(plan[0].id);
    } else if (!track(active)) choose(track(settings.selected) ? settings.selected : M.randomTrack(tracks, '', Math.random()));
    if (!active) { error = L('musicEmpty'); draw(); return; }
    wanted = true; var token = ++generation; draw();
    try { await element.play(); if (token === generation) draw(); }
    catch (e) { if (token !== generation) return; wanted = false; error = L('musicPlayError'); draw(); }
  }
  function switchTo(id) { var resume = wanted; choose(id); if (resume) play(); else draw(); }
  function random() { settings.mode = 'single'; switchTo(M.randomTrack(tracks, active || settings.selected, Math.random())); save(); draw(); }
  function step() { switchTo(settings.mode === 'sequence' ? M.next(availablePlan(), active) : M.randomTrack(tracks, active || settings.selected, Math.random())); }
  async function refresh() {
    loading = true; error = ''; draw();
    try {
      var response = await fetch('/api/music', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      var data = await response.json();
      if (!Array.isArray(data.tracks)) throw new Error();
      tracks = data.tracks.filter(function (t) { return typeof t.id === 'string' && typeof t.name === 'string' && t.url === '/api/music/' + t.id; });
      if (active && !track(active)) { pause(); active = ''; element.removeAttribute('src'); element.load(); error = L('musicRemoved'); }
      if (!track(settings.selected)) settings.selected = M.randomTrack(tracks, '', Math.random());
      save();
    } catch (e) { error = L('musicLoadError'); }
    loading = false; render();
  }
  function renderPlan() {
    if (!panel || !panel.isConnected) return;
    panel.querySelector('#music-plan-list').innerHTML = settings.sequence.map(function (row, i) {
      var t = track(row.id);
      return '<div class="music-plan-row"><span>' + (i + 1) + '. ' + esc(t ? t.name : L('musicMissing')) + '</span><label><input aria-label="' + esc((t ? t.name : '') + ' · ' + L('musicMinutes')) + '" type="number" min="0.1" max="180" step="0.1" value="' + row.minutes + '" data-music-duration="' + i + '">' + L('musicMinutes') + '</label><button class="btn" data-music-up="' + i + '" aria-label="' + L('musicUp') + '"' + (i ? '' : ' disabled') + '>↑</button><button class="btn" data-music-remove="' + i + '" aria-label="' + L('musicRemove') + '">×</button></div>';
    }).join('');
    panel.querySelectorAll('[data-music-duration]').forEach(function (input) { input.onchange = function () {
      if (!input.value || !input.reportValidity()) { input.value = settings.sequence[Number(input.dataset.musicDuration)].minutes; return; }
      settings.sequence[Number(input.dataset.musicDuration)].minutes = Number(input.value); save(); draw();
    }; });
    panel.querySelectorAll('[data-music-up]').forEach(function (b) { b.onclick = function () { var i = Number(b.dataset.musicUp), row = settings.sequence.splice(i, 1)[0]; settings.sequence.splice(i - 1, 0, row); save(); renderPlan(); }; });
    panel.querySelectorAll('[data-music-remove]').forEach(function (b) { b.onclick = function () {
      var row = settings.sequence.splice(Number(b.dataset.musicRemove), 1)[0];
      if (settings.mode === 'sequence' && active === row.id) { pause(); active = ''; element.removeAttribute('src'); element.load(); }
      save(); renderPlan(); draw();
    }; });
  }
  function render() {
    if (!panel || !panel.isConnected) return;
    var expanded = panel.querySelector('details') && panel.querySelector('details').open;
    panel.innerHTML = '<div class="music-heading"><h3>♫ ' + L('musicTitle') + '</h3><button id="music-refresh" class="btn">' + L('musicRefresh') + '</button></div>'
      + '<label for="music-track">' + L('musicTrack') + '</label><div class="music-picker"><select id="music-track">' + tracks.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; }).join('') + '</select><button id="music-random" class="btn">' + L('musicRandom') + '</button></div>'
      + '<div class="music-controls"><button id="music-play" class="btn btn-primary"></button><button id="music-next" class="btn">' + L('musicNext') + '</button><label class="music-volume" for="music-volume">' + L('musicVolume') + '<input type="range" id="music-volume" min="0" max="100" step="1"><output id="music-volume-value"></output></label></div>'
      + '<p id="music-status" class="focus-help" role="status"></p><p id="music-error" class="focus-help" role="alert" hidden></p>'
      + '<details class="music-plan"' + (expanded ? ' open' : '') + '><summary>' + L('musicPlan') + '</summary><label for="music-mode">' + L('musicMode') + '</label><select id="music-mode"><option value="single">' + L('musicSingle') + '</option><option value="sequence">' + L('musicSequence') + '</option></select>'
      + '<p class="focus-help">' + L('musicPlanHelp') + '</p><div class="music-picker"><select id="music-add-track" aria-label="' + L('musicTrack') + '">' + tracks.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; }).join('') + '</select><button class="btn" id="music-add">' + L('musicAdd') + '</button></div><div id="music-plan-list"></div></details>'
      + '<p class="focus-help">' + L('musicHelp') + '</p>';
    panel.querySelector('#music-refresh').onclick = refresh;
    panel.querySelector('#music-track').onchange = function () { settings.mode = 'single'; switchTo(this.value); save(); draw(); };
    panel.querySelector('#music-random').onclick = random;
    panel.querySelector('#music-play').onclick = function () { if (wanted) pause(); else play(); };
    panel.querySelector('#music-next').onclick = step;
    panel.querySelector('#music-volume').oninput = function () { settings.volume = Number(this.value) / 100; element.volume = settings.volume; save(); draw(); };
    panel.querySelector('#music-mode').onchange = function () { var mode = this.value; pause(); settings.mode = mode; if (settings.mode === 'sequence' && availablePlan().length) choose(availablePlan()[0].id); save(); draw(); };
    panel.querySelector('#music-add').onclick = function () { var id = panel.querySelector('#music-add-track').value; if (!track(id)) return; if (!settings.sequence.some(function (r) { return r.id === id; })) { settings.sequence.push({ id: id, minutes: 5 }); save(); renderPlan(); } };
    renderPlan(); draw();
  }
  function draw() {
    var quick = document.getElementById('music-quick-pause');
    if (quick) { quick.hidden = !wanted; quick.textContent = '♫ ' + L('musicPause'); quick.title = track(active) ? track(active).name : ''; }
    if (!panel || !panel.isConnected || !panel.querySelector('#music-play')) return;
    panel.querySelector('#music-play').textContent = L(wanted ? 'musicPause' : 'musicPlay');
    ['music-play', 'music-random', 'music-next', 'music-track', 'music-add'].forEach(function (id) { panel.querySelector('#' + id).disabled = loading || !tracks.length; });
    panel.querySelector('#music-refresh').disabled = loading;
    panel.querySelector('#music-track').value = active || settings.selected;
    panel.querySelector('#music-mode').value = settings.mode;
    panel.querySelector('#music-volume').value = Math.round(settings.volume * 100); panel.querySelector('#music-volume-value').textContent = Math.round(settings.volume * 100) + '%';
    var row = settings.sequence.find(function (r) { return r.id === active; });
    var left = row ? Math.max(0, Math.ceil(row.minutes * 60 - elapsed)) : 0;
    var timing = settings.mode === 'sequence' && row ? ' · ' + L('musicTimeLeft', { time: Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') }) : ' · ' + L('musicSingle');
    panel.querySelector('#music-status').textContent = loading ? L('musicLoading') : !tracks.length ? L('musicEmpty') : L(wanted ? element.paused || element.readyState < 3 ? 'musicBuffering' : 'musicPlaying' : 'musicStopped') + (track(active) ? ' · ' + track(active).name : '') + timing;
    panel.querySelector('#music-error').hidden = !error; panel.querySelector('#music-error').textContent = error;
  }
  element.addEventListener('timeupdate', function () {
    account();
    var row = settings.sequence.find(function (r) { return r.id === active; });
    if (wanted && settings.mode === 'sequence' && row && elapsed >= row.minutes * 60) {
      var id = M.next(availablePlan(), active); choose(id); play();
    } else draw();
  });
  ['playing', 'waiting', 'pause'].forEach(function (event) { element.addEventListener(event, draw); });
  element.addEventListener('error', function () { if (!active) return; wanted = false; generation++; error = L('musicPlayError'); draw(); });
  // Another tab only stops this player when it actually begins playback.
  var channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(window.TracerAccount ? TracerAccount.storageName('tracer-ambient-audio') : 'tracer-ambient-audio') : null;
  if (channel) { channel.onmessage = function () { if (wanted) pause(); }; element.addEventListener('playing', function () { channel.postMessage('playing'); }); }
  T.music = { mount: function (host) { panel = host; render(); refresh(); }, pause: pause, refreshLabels: function () { render(); draw(); } };
  document.getElementById('music-quick-pause').onclick = pause;
})();
