(function () {
  'use strict';
  var bridge = window.TracerWindow;
  var controls = document.getElementById('window-controls');
  if (!bridge || !controls || typeof bridge.send !== 'function' || typeof bridge.onState !== 'function') return;

  var root = document.documentElement;
  var minimize = document.getElementById('window-minimize');
  var fullscreen = document.getElementById('window-fullscreen');
  var close = document.getElementById('window-close');
  var icon = document.getElementById('window-fullscreen-icon');
  var state = { fullscreen: true, maximized: false };
  var labels = {
    en: { group: 'Window controls', minimize: 'Minimize', enter: 'Enter full screen (F11)', exit: 'Exit full screen (F11)', close: 'Hide to system tray' },
    zh: { group: '窗口控制', minimize: '最小化', enter: '进入全屏（F11）', exit: '退出全屏（F11）', close: '隐藏到系统托盘' },
  };

  function label(button, text) {
    button.title = text;
    button.setAttribute('aria-label', text);
  }
  function render() {
    var text = labels[root.lang.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'];
    controls.setAttribute('aria-label', text.group);
    label(minimize, text.minimize);
    label(fullscreen, state.fullscreen ? text.exit : text.enter);
    label(close, text.close);
    fullscreen.setAttribute('aria-keyshortcuts', 'F11');
    icon.setAttribute('d', state.fullscreen
      ? 'M2 6h4V2m4 0v4h4M2 10h4v4m4 0v-4h4'
      : 'M6 2H2v4m8-4h4v4M2 10v4h4m4 0h4v-4');
    root.dataset.windowFullscreen = String(state.fullscreen);
    root.dataset.windowMaximized = String(state.maximized);
  }

  minimize.addEventListener('click', function () { bridge.send('minimize'); });
  fullscreen.addEventListener('click', function () { bridge.send('toggle-fullscreen'); });
  close.addEventListener('click', function () { bridge.send('close'); });
  bridge.onState(function (next) {
    if (!next || typeof next.fullscreen !== 'boolean' || typeof next.maximized !== 'boolean') return;
    state = next;
    render();
  });
  new MutationObserver(render).observe(root, { attributes: true, attributeFilter: ['lang'] });
  root.classList.add('desktop-window');
  controls.hidden = false;
  render();
  bridge.send('state');
})();
