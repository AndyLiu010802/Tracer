(function () {
  'use strict';
  var T = window.Tracer, M = window.TracerModel, F = window.TracerFocus, D = window.TracerDaily, L = window.TracerLocale.t;
  var KEY = 'tracer.focus.v1', APPEARANCE = 'tracer.ambient.v1';
  var state = load(), appearance = loadAppearance(), box = null, busy = false, audio = null, alertBusy = false;
  var baseTitle = document.title, lastDay = '', lastQuoteLanguage = '';
  var dailySignature = '', drawSignature = '', drawnBox = null;
  var pendingActivity = { keys: {}, clicks: 0, unknown: 0 };
  function flushActivity(s) {
    Object.keys(pendingActivity.keys).forEach(function (k) { s.activity.keys[k] = (s.activity.keys[k] || 0) + pendingActivity.keys[k]; });
    s.activity.clicks += pendingActivity.clicks; s.activity.unknown += pendingActivity.unknown;
    pendingActivity = { keys: {}, clicks: 0, unknown: 0 };
  }
  function recordActivity(k) {
    // Storage events keep this snapshot in sync across windows. Parsing the
    // entire focus history on every keystroke blocks note/task typing.
    var current = state;
    if (!current.running || current.mode !== 'focus' || Date.now() >= current.endAt) return;
    if (k === 'unknown') pendingActivity.unknown++;
    else { pendingActivity.keys[k] = (pendingActivity.keys[k] || 0) + 1; if (k === 'LMB') pendingActivity.clicks++; }
  }
  document.addEventListener('keydown', function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    var k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : /^Digit[0-9]$/.test(e.code) ? e.code.slice(5) : e.code === 'Space' ? 'SPC' : '';
    if (k) recordActivity(k);
  }, true);
  document.addEventListener('click', function () { recordActivity('LMB'); }, true);
  // The desktop input bridge and reference reader share this historical
  // message name. It records anonymous focus activity, not game rewards.
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.__aside !== 1 || e.data.type !== 'farm' || (e.data.kind !== 'key' && e.data.kind !== 'click')) return;
    var frame = Array.prototype.some.call(document.querySelectorAll('iframe'), function (f) { return f.contentWindow === e.source; });
    if (!frame && e.source !== window) return;
    recordActivity(e.data.kind === 'click' ? 'LMB' : 'unknown');
  });
  function load() { try { return F.read(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return F.fresh(); } }
  function loadAppearance() {
    var a; try { a = JSON.parse(localStorage.getItem(APPEARANCE)); } catch (e) {}
    return a && D.scenes.indexOf(a.scene) >= 0 ? { scene: a.scene, enabled: a.enabled !== false, collapsed: a.collapsed === true, day: a.day || '' } : { scene: D.nextScene('', Math.random()), enabled: true, collapsed: false, day: '' };
  }
  function showError(message) {
    if (box && box.isConnected) { var el = box.querySelector('#focus-error'); el.textContent = message; el.hidden = false; }
    else T.ui.notice(message);
  }
  function locked(callback) { return navigator.locks ? navigator.locks.request(window.TracerAccount ? TracerAccount.storageName('tracer-focus-state') : 'tracer-focus-state', callback) : Promise.resolve().then(callback); }
  function change(callback) {
    return locked(function () {
      state = load(); pruneDeletedTasks(state); flushActivity(state); F.settle(state, Date.now()); callback(state); pruneDeletedTasks(state);
      localStorage.setItem(KEY, JSON.stringify(state));
    }).then(function () { draw(); maybeAlert(); }).catch(function () { showError(L('timerStorageError')); });
  }
  function unlockSound() {
    try {
      if (!audio) { var Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return Promise.resolve(false); audio = new Audio(); }
      return audio.resume().then(function () { return audio.state === 'running'; }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  function chime() {
    if (!audio || audio.state !== 'running') return false;
    try {
      [523.25, 659.25, 783.99].forEach(function (frequency, i) {
        var oscillator = audio.createOscillator(), volume = audio.createGain(), start = audio.currentTime + i * .23;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        volume.gain.setValueAtTime(0, start); volume.gain.linearRampToValueAtTime(.12, start + .02); volume.gain.exponentialRampToValueAtTime(.001, start + .65);
        oscillator.connect(volume); volume.connect(audio.destination); oscillator.start(start); oscillator.stop(start + .7);
        oscillator.onended = function () { oscillator.disconnect(); volume.disconnect(); };
      }); return true;
    } catch (e) { return false; }
  }
  function maybeAlert() {
    if (!state.alarm || state.lastNotifiedId === state.alarm.id || alertBusy) return;
    var canSound = state.settings.sound && audio && audio.state === 'running';
    var canNotify = state.settings.notifications && 'Notification' in window && Notification.permission === 'granted';
    if (!canSound && !canNotify) return;
    alertBusy = true;
    locked(function () {
      var current = load();
      if (!current.alarm || current.lastNotifiedId === current.alarm.id) return;
      // Claim the alert under the same cross-tab lock; opening another tab will not ring twice.
      current.lastNotifiedId = current.alarm.id; localStorage.setItem(KEY, JSON.stringify(current)); state = current;
      if (canSound) chime();
      if (canNotify) {
        try { var n = new Notification(L('timerDone', { mode: L(current.alarm.mode) }), { body: L(current.alarm.mode === 'focus' ? 'focusAlarm' : 'breakAlarm'), tag: 'tracer-focus-' + current.alarm.id }); n.onclick = function () { window.focus(); n.close(); }; } catch (e) {}
      }
    }).catch(function () {}).finally(function () { alertBusy = false; });
  }
  function advance() {
    unlockSound();
    return change(function (s) { if (!s.completed) return; F.reset(s, F.nextMode(s)); snapshotTask(s); F.start(s, Date.now(), M.uid()); });
  }
  function snapshotTask(s) {
    if(s.mode!=='focus'||s.runId||!s.task)return;
    var task=M.findTask(T.store.data,s.task.id);
    s.task=task?{id:task.id,title:task.title,projectId:task.projectId||null}:null;
  }
  function startPause() {
    unlockSound();
    return change(function (s) {
      if (s.running) F.pause(s, Date.now());
      else { if (s.completed) F.reset(s, F.nextMode(s)); snapshotTask(s); F.start(s, Date.now(), M.uid()); }
    });
  }
  function reset(mode) {
    if ((state.running || (!state.completed && state.remaining < state.duration)) && !window.confirm(L('timerResetConfirm'))) return;
    change(function (s) { F.reset(s, mode); });
  }
  function openTimer() {
    T.ui.modal(function (modal, close) {
      box = modal; box.classList.add('focus-modal'); box.setAttribute('aria-labelledby', 'focus-heading');
      var tasks = T.store.data ? T.store.data.tasks.filter(function (t) { return t.status !== 'done'; }) : [];
      if (state.task && !tasks.some(function (t) { return t.id === state.task.id; })) tasks = tasks.concat(state.task);
      box.innerHTML = '<header class="focus-modal-head"><h2 id="focus-heading">◷ ' + L('pomodoro') + '</h2><button class="btn" id="focus-close" aria-label="' + L('cancel') + '">×</button></header>'
        + '<div class="focus-modes">' + ['focus', 'short', 'long'].map(function (mode) { return '<button class="btn" data-focus-mode="' + mode + '">' + L(mode) + '</button>'; }).join('') + '</div>'
        + '<div class="focus-ring" id="focus-ring"><div class="focus-ring-inner"><strong id="focus-large-clock"></strong><span id="focus-state-label"></span></div></div>'
        + '<div class="focus-controls"><button class="btn btn-primary" id="focus-start"></button><button class="btn" id="focus-reset">' + L('timerReset') + '</button></div>'
        + '<div class="focus-stats"><span>' + L('focusToday') + '</span><strong id="focus-count"></strong><strong id="focus-minutes"></strong></div>'
        + '<label for="focus-task">' + L('timerTask') + '</label><select id="focus-task"><option value="">' + L('timerNoTask') + '</option>' + tasks.map(function (t) { return '<option value="' + M.esc(t.id) + '">' + M.esc((t.seq ? t.seq + ' · ' : '') + t.title) + '</option>'; }).join('') + '</select>'
        + '<section id="focus-music" class="focus-music" aria-label="' + L('musicTitle') + '"></section>'
        + '<details class="focus-settings"><summary>' + L('timerSettings') + '</summary><div class="focus-settings-grid">'
        + ['focus', 'short', 'long', 'rounds'].map(function (key) { return '<div><label for="focus-setting-' + key + '">' + L(key + 'Duration') + '</label><input type="number" id="focus-setting-' + key + '" data-focus-setting="' + key + '" min="1" max="' + (key === 'rounds' ? 12 : key === 'focus' ? 180 : 60) + '" step="1" value="' + state.settings[key] + '"></div>'; }).join('')
        + '</div><p class="focus-help">' + L('timerSettingsHelp') + '</p><div class="focus-sound-row"><label><input type="checkbox" id="focus-sound"' + (state.settings.sound ? ' checked' : '') + '>' + L('timerSound') + '</label><button class="btn" id="focus-test">' + L('soundTest') + '</button></div>'
        + '<button class="btn" id="focus-notifications"></button><p id="focus-notification-status" class="focus-help"></p></details>'
        + '<p class="focus-help">' + L('timerHelp') + '</p><p id="focus-error" class="focus-help" role="alert" hidden></p>';
      box.querySelector('#focus-close').onclick = close;
      if (T.music) T.music.mount(box.querySelector('#focus-music'));
      box.querySelector('#focus-start').onclick = startPause; box.querySelector('#focus-reset').onclick = function () { reset(state.mode); };
      box.querySelectorAll('[data-focus-mode]').forEach(function (button) { button.onclick = function () { if (state.mode !== button.dataset.focusMode) reset(button.dataset.focusMode); }; });
      box.querySelector('#focus-task').value = state.task ? state.task.id : '';
      box.querySelector('#focus-task').onchange = function () { var id = this.value, task = tasks.find(function (t) { return t.id === id; }); change(function (s) { if (!s.running && !(s.runId && !s.completed)) s.task = task ? { id: task.id, title: task.title, projectId: task.projectId || null } : null; }); };
      box.querySelectorAll('[data-focus-setting]').forEach(function (input) {
        input.onchange = function () {
          if (!input.value || !input.reportValidity()) { input.value = state.settings[input.dataset.focusSetting]; return; }
          var key = input.dataset.focusSetting, value = Number(input.value);
          change(function (s) { s.settings[key] = value; if (!s.running && !s.completed && s.remaining === s.duration) F.reset(s, s.mode); });
        };
      });
      box.querySelector('#focus-sound').onchange = function () { var enabled = this.checked; if (enabled) unlockSound(); change(function (s) { s.settings.sound = enabled; }); };
      box.querySelector('#focus-test').onclick = function () { unlockSound().then(function (ready) { if (!ready || !chime()) showError(L('audioUnavailable')); }); };
      box.querySelector('#focus-notifications').onclick = function () {
        if (state.settings.notifications) { change(function (s) { s.settings.notifications = false; }); return; }
        if (!('Notification' in window)) { showError(L('notificationUnsupported')); return; }
        Notification.requestPermission().then(function (permission) {
          if (permission === 'granted') change(function (s) { s.settings.notifications = true; });
          else showError(L('notificationBlocked'));
        }).catch(function () { showError(L('notificationUnsupported')); });
      };
      draw();
    });
    draw();
    box.querySelector('#focus-start').focus({ preventScroll: true }); box.scrollTop = 0;
  }
  function draw(force) {
    if (document.hidden || document.tracerHidden) return;
    var now = Date.now(), ms = F.remaining(state, now), text = F.format(ms);
    var next = JSON.stringify([text, F.dayKey(now), window.TracerLocale.language(), state.mode, state.running, state.completed, state.remaining, state.alarm, state.task, state.settings, state.history.length, state.totalMinutes]);
    var currentBox = box && box.isConnected ? box : null;
    if (!force && next === drawSignature && currentBox === drawnBox) return;
    drawSignature = next; drawnBox = currentBox;
    if (T.garden) T.garden.refresh();
    if (T.refreshInsightsFocus) T.refreshInsightsFocus(state);
    var stats = F.today(state, now);
    var pill = document.getElementById('focus-open');
    pill.dataset.running = String(state.running); pill.dataset.complete = String(state.completed);
    pill.setAttribute('aria-label', L('pomodoro') + ' · ' + L(state.mode) + ' · ' + text);
    document.getElementById('focus-label').textContent = state.running || state.completed ? L(state.mode) : L('pomodoro');
    document.getElementById('focus-clock').textContent = text;
    var compact = document.getElementById('focus-open-compact');
    compact.textContent = '◷ ' + text; compact.title = L('pomodoro'); compact.setAttribute('aria-label', L('pomodoro') + ' · ' + text);
    var alarm = document.getElementById('focus-alarm'); alarm.hidden = !state.alarm;
    document.title = state.alarm ? '◷ ' + L('timerDone', { mode: L(state.alarm.mode) }) + ' · Tracer' : baseTitle;
    if (state.alarm) {
      document.getElementById('focus-alarm-title').textContent = L('timerDone', { mode: L(state.alarm.mode) });
      document.getElementById('focus-alarm-text').textContent = L(state.alarm.mode === 'focus' ? 'focusAlarm' : 'breakAlarm');
      document.getElementById('focus-alarm-next').textContent = L('timerNext', { mode: L(F.nextMode(state)) });
      document.getElementById('focus-alarm-dismiss').textContent = L('timerDismiss');
    }
    if (!box || !box.isConnected) return;
    box.querySelector('#focus-large-clock').textContent = text;
    box.querySelector('#focus-ring').style.setProperty('--progress', Math.min(360, Math.max(0, (1 - ms / state.duration) * 360)) + 'deg');
    box.querySelector('#focus-state-label').textContent = state.completed ? L('timerDone', { mode: L(state.mode) }) : state.running ? L(state.mode) : state.remaining < state.duration ? L('timerPaused') : L('timerReady');
    box.querySelector('#focus-start').textContent = state.running ? L('timerPause') : state.completed ? L('timerNext', { mode: L(F.nextMode(state)) }) : L(state.remaining < state.duration ? 'timerResume' : 'timerStart');
    box.querySelector('#focus-count').textContent = L('focusCount', { count: stats.count });
    box.querySelector('#focus-minutes').textContent = L('focusMinutes', { minutes: stats.minutes });
    box.querySelector('#focus-task').disabled = state.running || !!(state.runId && !state.completed) || state.mode !== 'focus';
    var taskPicker = box.querySelector('#focus-task');
    if (document.activeElement !== taskPicker) {
      if (state.task && !Array.prototype.some.call(taskPicker.options, function (option) { return option.value === state.task.id; })) { var option = document.createElement('option'); option.value = state.task.id; option.textContent = state.task.title; taskPicker.appendChild(option); }
      taskPicker.value = state.task ? state.task.id : '';
    }
    box.querySelectorAll('[data-focus-setting]').forEach(function (input) { if (document.activeElement !== input) input.value = state.settings[input.dataset.focusSetting]; });
    box.querySelector('#focus-sound').checked = state.settings.sound;
    box.querySelectorAll('[data-focus-mode]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.focusMode === state.mode)); });
    box.querySelector('#focus-notifications').textContent = L(state.settings.notifications ? 'notificationOff' : 'notificationEnable');
    box.querySelector('#focus-notification-status').textContent = state.settings.notifications ? L(!('Notification' in window) ? 'notificationUnsupported' : Notification.permission === 'granted' ? 'notificationOn' : 'notificationBlocked') : '';
  }
  function saveAppearance() { try { localStorage.setItem(APPEARANCE, JSON.stringify(appearance)); } catch (e) {} }
  function drawDaily() {
    if (document.hidden || document.tracerHidden) return;
    var now = new Date(), key = F.dayKey(now.getTime()), lang = window.TracerLocale.language();
    if (appearance.day !== key) { appearance.scene = D.nextScene(appearance.scene, Math.random()); appearance.day = key; saveAppearance(); }
    var next = JSON.stringify([key, lang, appearance.scene, appearance.enabled, appearance.collapsed]);
    if (next === dailySignature) return;
    dailySignature = next;
    if (lastDay !== key || lastQuoteLanguage !== lang) {
      var quote = D.quote(now); lastDay = key; lastQuoteLanguage = lang;
      document.getElementById('daily-label').textContent = L('dailyQuote');
      document.getElementById('daily-date').textContent = now.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { month: 'long', day: 'numeric', weekday: 'long' });
      document.getElementById('daily-text').textContent = quote[lang];
      var source = document.getElementById('daily-source'); source.textContent = '— ' + quote[lang === 'zh' ? 'authorZh' : 'authorEn'] + ' ↗'; source.href = quote.source; source.title = L('quoteTranslation');
    }
    document.querySelector('.daily-bar').setAttribute('aria-label', L('dailyQuote') + ' · ' + L('pomodoro'));
    document.querySelector('.daily-bar').hidden = appearance.collapsed;
    document.getElementById('focus-open-compact').hidden = !appearance.collapsed;
    var cardToggle = document.getElementById('daily-card-toggle');
    cardToggle.textContent = L(appearance.collapsed ? 'dailyCardShow' : 'dailyCardHide'); cardToggle.setAttribute('aria-expanded', String(!appearance.collapsed));
    document.getElementById('daily-card-hide').textContent = L('dailyCardHide');
    var background = document.getElementById('ambient-background'); background.hidden = !appearance.enabled;
    background.style.backgroundImage = 'url("/backgrounds/' + appearance.scene + '.jpg")';
    document.body.dataset.ambient = appearance.enabled ? 'on' : 'off';
    document.getElementById('ambient-name').textContent = L(appearance.scene);
    document.getElementById('ambient-shuffle').title = L('backgroundShuffle'); document.getElementById('ambient-shuffle').setAttribute('aria-label', L('backgroundShuffle'));
    var toggle = document.getElementById('ambient-toggle'); toggle.textContent = L(appearance.enabled ? 'backgroundOff' : 'backgroundOn'); toggle.setAttribute('aria-pressed', String(appearance.enabled));
  }
  document.getElementById('focus-open').onclick = openTimer;
  document.getElementById('focus-open-compact').onclick = openTimer;
  function toggleCard() { appearance.collapsed = !appearance.collapsed; saveAppearance(); drawDaily(); document.getElementById('daily-card-toggle').focus(); }
  document.getElementById('daily-card-toggle').onclick = toggleCard;
  document.getElementById('daily-card-hide').onclick = toggleCard;
  document.getElementById('focus-alarm-next').onclick = advance;
  document.getElementById('focus-alarm-dismiss').onclick = function () { change(function (s) { s.alarm = null; }); };
  document.getElementById('ambient-shuffle').onclick = function () { appearance.scene = D.nextScene(appearance.scene, Math.random()); appearance.enabled = true; saveAppearance(); drawDaily(); };
  document.getElementById('ambient-toggle').onclick = function () { appearance.enabled = !appearance.enabled; saveAppearance(); drawDaily(); };
  function pruneDeletedTasks(value) {
    var ids = new Set();
    ((T.store.data || {}).projectDeletions || []).forEach(function (row) { row.taskIds.forEach(function (id) { ids.add(id); }); });
    F.removeTasks(value, ids);
  }
  T.refreshWellness = function () { pruneDeletedTasks(state); change(function () {}); drawDaily(); draw(true); if (T.music) T.music.refreshLabels(); };
  T.ready.then(function () { T.refreshWellness(); });
  async function openForTask(id) {
    var task=M.findTask(T.store.data,id);if(!task||task.status==='done')return false;
    var kept=false;
    await change(function(s){
      var started=s.running||!!(s.runId&&!s.completed);
      if(started){kept=!s.task||s.task.id!==id;return;}
      F.reset(s,'focus');s.task={id:task.id,title:task.title,projectId:task.projectId||null};
    });
    openTimer();
    if(kept)showError(TracerLocale.language()==='zh'?'当前一轮仍未结束，已保留原任务。结束或重置后可为其他项目专注。':'Your current session is kept. Finish or reset it before focusing on another project.');
    return !kept;
  }
  T.focus = { open: openTimer, openForTask: openForTask, toggle: startPause, read: function () { return F.read(state); } };
  window.addEventListener('storage', function (event) { if (event.key === KEY || !event.key) { state = load(); draw(true); } if (event.key === APPEARANCE || !event.key) { appearance = loadAppearance(); drawDaily(); } });
  function tick() {
    drawDaily();
    if (!busy && ((state.running && Date.now() >= state.endAt) || Object.keys(pendingActivity.keys).length || pendingActivity.unknown)) { busy = true; change(function () {}).finally(function () { busy = false; }); }
    else { draw(); maybeAlert(); }
  }
  document.addEventListener('visibilitychange', tick); window.addEventListener('focus', tick);
  document.addEventListener('tracer-visibilitychange', function () { drawSignature = dailySignature = ''; tick(); });
  setInterval(tick, 500); tick();
})();
