(function () {
  'use strict';
  var lang = 'zh';
  try { var saved = localStorage.getItem('tracer.language'); if (saved === 'en' || saved === 'zh') lang = saved; } catch (e) {}
  var I = window.TaskI18n;
  function t(key, values) { return I.t(lang, key, values); }
  function apply() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    var picker = document.getElementById('language-select'); picker.value = lang; picker.setAttribute('aria-label', t('language'));
    var newButton = document.getElementById('new-btn'); newButton.textContent = lang === 'zh' ? '＋ 新建' : '+ New'; newButton.title = t('newTask');
    document.querySelectorAll('.nav-item[data-sec]').forEach(function (a) {
      var key = a.dataset.sec === 'notes' ? 'notesSection' : a.dataset.sec;
      Array.prototype.forEach.call(a.childNodes, function (node) { if (node.nodeType === 3 && node.nodeValue.trim()) node.nodeValue = ' ' + t(key); });
    });
    var projectsLabel = document.getElementById('projects-label'); if (projectsLabel) projectsLabel.textContent = t('projects');
    var saveDot = document.getElementById('save-dot'); if (saveDot) saveDot.title = I.message(lang, saveDot.title);
    if (window.Tracer) {
      if (window.Tracer.store.data) { window.Tracer.redraw(); if (window.Tracer.renderBoard) window.Tracer.renderBoard(); }
      if (window.Tracer.refreshSyncLabel) window.Tracer.refreshSyncLabel();
      if (window.Tracer.refreshWellness) window.Tracer.refreshWellness();
    }
  }
  window.TracerLocale = { t: t, message: function (text) { return I.message(lang, text); }, language: function () { return lang; } };
  document.getElementById('language-select').onchange = function () {
    lang = this.value === 'en' ? 'en' : 'zh';
    try { localStorage.setItem('tracer.language', lang); } catch (e) {}
    apply();
  };
  apply();
})();
