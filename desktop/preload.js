'use strict';

const { ipcRenderer, contextBridge } = require('electron');

if (process.isMainFrame) {
  const preferences = ipcRenderer.sendSync('tracer-preferences-read');
  if (preferences) {
    try {
      for (const [key, value] of Object.entries(preferences)) localStorage.setItem(key, value);
      ipcRenderer.send('tracer-preferences-imported');
    } catch (e) { console.error('Preferences import failed', e); }
  }
}

if (process.isMainFrame) contextBridge.exposeInMainWorld('TracerBrowser', {
  send: message => ipcRenderer.send('tracer-browser-command', message),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('tracer-browser-state', listener);
    return () => ipcRenderer.removeListener('tracer-browser-state', listener);
  },
});

// Only the local app document receives window controls. The main process also
// checks the exact app origin and sender frame before accepting these actions.
if (process.isMainFrame && location.protocol === 'http:'
    && ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)
    && !location.pathname.startsWith('/r/')) {
  const windowActions = new Set(['state', 'toggle-fullscreen', 'minimize', 'close']);
  contextBridge.exposeInMainWorld('TracerWindow', {
    send: action => { if (windowActions.has(action)) ipcRenderer.send('tracer-window-action', action); },
    onState: callback => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, state) => {
        if (!state || typeof state.fullscreen !== 'boolean' || typeof state.maximized !== 'boolean') return;
        callback({ fullscreen: state.fullscreen, maximized: state.maximized });
      };
      ipcRenderer.on('tracer-window-state', listener);
      return () => ipcRenderer.removeListener('tracer-window-state', listener);
    },
  });
}

// 主进程把全局输入压成的脉冲送过来，这里原样转成 farm.js 已经在监听的那条消息，
// 形状和小说 iframe 里守卫脚本回报的完全一致（{ __aside:1, type:'farm', kind }）。
// 于是「你在别的程序里打字」和「你在小说面板里打字」走的是同一条汇入路径，farm.js 无需改动。
ipcRenderer.on('farm-pulse', function (_event, pulse) {
  if (!pulse || (pulse.kind !== 'key' && pulse.kind !== 'click')) return;
  window.postMessage({ __aside: 1, type: 'farm', kind: pulse.kind }, '*');
});
