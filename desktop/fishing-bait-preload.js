'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const baits = new Set(['earthworm', 'dough', 'prawn', 'cutbait', 'lotusmeal']);
let snapshot = null;
if (process.isMainFrame) {
  ipcRenderer.on('tracer-fishing-bait-snapshot', (_event, value) => {
    if (value && typeof value.nativeSessionId === 'string') snapshot = value;
  });
  contextBridge.exposeInMainWorld('FishingBaitDesktop', {
    send(message) {
      if (!message || typeof message !== 'object') return;
      const { type } = message;
      if (type === 'ready') { ipcRenderer.send('tracer-fishing-bait-command', { type }); return; }
      if (!snapshot || !['close', 'context-menu', 'retry-save', 'input-regions'].includes(type)) return;
      const extra = {};
      if (type === 'context-menu') { if (!baits.has(message.baitId)) return; extra.baitId = message.baitId; }
      if (type === 'input-regions') {
        const rows = message.value;
        if (!Array.isArray(rows) || !rows.length || rows.length > 8 || rows.some(r => !r || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(r[k])))) return;
        extra.value = rows.map(({ x, y, width, height }) => ({ x, y, width, height }));
      }
      const { accountScope, accountGeneration, accountRestoreId, sessionId, nativeSessionId } = snapshot;
      ipcRenderer.send('tracer-fishing-bait-command', { type, accountScope, accountGeneration, accountRestoreId, sessionId, nativeSessionId, ...extra });
    },
    onSnapshot(callback) {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, value) => { if (value && typeof value.nativeSessionId === 'string') callback(value); };
      ipcRenderer.on('tracer-fishing-bait-snapshot', listener);
      return () => ipcRenderer.removeListener('tracer-fishing-bait-snapshot', listener);
    }
  });
}
