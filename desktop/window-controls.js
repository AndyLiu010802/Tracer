'use strict';

const { ipcMain } = require('electron');

// Native window actions are available only to the trusted main application page.
// Remote reference pages and child frames never receive this capability.
function attachWindowControls(win, appOrigin, extraContents = []) {
  function trusted(event) {
    if (win.isDestroyed() || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) return false;
    try { const url = new URL(event.senderFrame.url); return url.origin === appOrigin && !url.pathname.startsWith('/r/'); } catch { return false; }
  }
  function report() {
    if (win.isDestroyed() || win.webContents.isDestroyed() || win.webContents.mainFrame.isDestroyed()) return;
    win.webContents.send('tracer-window-state', { fullscreen: win.isFullScreen(), maximized: win.isMaximized(), visible: win.isVisible() && !win.isMinimized() });
  }
  function toggle() { if (!win.isDestroyed()) { win.setFullScreen(!win.isFullScreen()); setImmediate(report); } }
  function input(event, key) {
    if (key.type === 'keyDown' && key.key === 'F11' && !key.isAutoRepeat && !key.control && !key.meta && !key.alt && !key.shift) {
      event.preventDefault(); toggle();
    }
  }
  function command(event, action) {
    if (!trusted(event)) return;
    if (action === 'toggle-fullscreen') toggle();
    else if (action === 'minimize') win.minimize();
    else if (action === 'close') win.close();
    else if (action === 'state') report();
  }
  const contents = [win.webContents, ...extraContents];
  contents.forEach(wc => wc.on('before-input-event', input));
  const events = ['enter-full-screen', 'leave-full-screen', 'maximize', 'unmaximize', 'restore', 'show', 'hide', 'minimize'];
  // On Windows the event may fire before isFullScreen() reflects the transition.
  events.forEach(name => win.on(name, () => setImmediate(report)));
  win.webContents.on('did-finish-load', report);
  ipcMain.on('tracer-window-action', command);
  win.once('closed', () => {
    ipcMain.removeListener('tracer-window-action', command);
    contents.forEach(wc => { if (!wc.isDestroyed()) wc.removeListener('before-input-event', input); });
  });
}

module.exports = { attachWindowControls };
