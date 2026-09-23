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
  contextBridge.exposeInMainWorld('TracerPet', {
    send: message => ipcRenderer.send('tracer-pet-command', message),
    onAction: callback => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('tracer-pet-action', (_event,message) => callback(message));
    },
    onWorkRequest: callback => {
      if (typeof callback !== 'function') return;
      ipcRenderer.on('tracer-pet-work-request', (_event, message) => callback(message));
    },
    workResult: result => ipcRenderer.send('tracer-pet-work-result', result),
  });
  contextBridge.exposeInMainWorld('TracerWindow', {
    send: action => { if (windowActions.has(action)) ipcRenderer.send('tracer-window-action', action); },
    onState: callback => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, state) => {
        if (!state || typeof state.fullscreen !== 'boolean' || typeof state.maximized !== 'boolean') return;
        callback({ fullscreen: state.fullscreen, maximized: state.maximized, visible: state.visible });
      };
      ipcRenderer.on('tracer-window-state', listener);
      return () => ipcRenderer.removeListener('tracer-window-state', listener);
    },
  });
}

// 全局输入和内置阅读浏览器只上报匿名次数，转交 wellness.js 的专注统计。
// 沿用与阅读 iframe 相同的历史协议（{ __aside:1, type:'farm', kind }），
// farm-pulse / farm 是兼容消息名，不会加载或推进旧农场。
ipcRenderer.on('farm-pulse', function (_event, pulse) {
  if (!pulse || (pulse.kind !== 'key' && pulse.kind !== 'click')) return;
  window.postMessage({ __aside: 1, type: 'farm', kind: pulse.kind }, '*');
});
