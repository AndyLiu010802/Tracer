'use strict';

function installApplicationMenu({ platform, Menu, showWindow, enableInput }) {
  if (platform !== 'darwin') { Menu.setApplicationMenu(null); return; }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Tracer', submenu: [
      { role: 'about' }, { type: 'separator' },
      { label: '启用后台输入计数 / Enable background input counting', click: enableInput },
      { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [
      { role: 'minimize' }, { role: 'close' },
      { label: '打开 Tracer / Show Tracer', click: showWindow },
      { role: 'front' },
    ] },
  ]));
}

function canStartInputHook(platform, preferences, prompt = false) {
  return platform !== 'darwin' || preferences.isTrustedAccessibilityClient(prompt);
}

module.exports = { installApplicationMenu, canStartInputHook };
