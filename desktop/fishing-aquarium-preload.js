'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const PREFIX = 'tracer-fishing-aquarium-';
const commands = new Set(['hide', 'context-menu', 'input-regions', 'pointer-pass-through', 'drag-start', 'drag-move', 'drag-end', 'resize']);
let snapshot = null, sequence = 0;
if (process.isMainFrame) {
  ipcRenderer.on(PREFIX + 'snapshot', (_event, value) => {
    if (!value || typeof value !== 'object' || typeof value.nativeSessionId !== 'string') return;
    if (snapshot?.nativeSessionId !== value.nativeSessionId) sequence = 0;
    snapshot = value;
  });
  ipcRenderer.on(PREFIX + 'visibility', (_event, value) => { if (value?.clear) snapshot = null; });
  contextBridge.exposeInMainWorld('FishingAquariumDesktop', {
    send(message) {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ready') { ipcRenderer.send(PREFIX + 'command', { type: 'ready' }); return; }
      if (!snapshot) return;
      const auth = { accountScope: snapshot.accountScope || 'guest', accountGeneration: snapshot.accountGeneration || 0, accountRestoreId: snapshot.accountRestoreId || '', nativeSessionId: snapshot.nativeSessionId };
      if (message.type === 'open-aquarium') { ipcRenderer.send(PREFIX + 'action', { type: message.type, ...auth, sequence: ++sequence }); return; }
      if (!commands.has(message.type)) return;
      let value;
      if (message.type === 'input-regions') {
        const v = message.value;
        if (!Array.isArray(v) || !v.length || v.length > 8 || v.some(r => !r || !['x','y','width','height'].every(k => Number.isFinite(r[k])))) return;
        value = v.map(({x,y,width,height}) => ({x,y,width,height}));
      }
      if (message.type === 'pointer-pass-through') { if (typeof message.value !== 'boolean') return; value = message.value; }
      if (message.type === 'resize') { if (!Number.isFinite(message.value)) return; value = Math.max(.75, Math.min(2.5, message.value)); }
      if (message.type.startsWith('drag-')) {
        const v = message.value;
        if (!v || !Number.isFinite(v.screenX) || !Number.isFinite(v.screenY) || Math.abs(v.screenX) > 1000000 || Math.abs(v.screenY) > 1000000) return;
        value = { screenX: v.screenX, screenY: v.screenY };
      }
      ipcRenderer.send(PREFIX + 'command', { type: message.type, ...auth, ...(value === undefined ? {} : { value }) });
    },
    onSnapshot(callback) {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, value) => { if (value && typeof value.nativeSessionId === 'string') callback(value); };
      ipcRenderer.on(PREFIX + 'snapshot', listener); return () => ipcRenderer.removeListener(PREFIX + 'snapshot', listener);
    },
    onVisibility(callback) {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, value) => { if (typeof value?.visible === 'boolean') callback({ visible: value.visible, clear: value.clear === true }); };
      ipcRenderer.on(PREFIX + 'visibility', listener); return () => ipcRenderer.removeListener(PREFIX + 'visibility', listener);
    },
    onMenuAction(callback) {
      if(typeof callback!=='function')return()=>{};
      const listener=(_event,value)=>{if(snapshot&&value?.nativeSessionId===snapshot.nativeSessionId&&value.type==='move')callback({type:value.type});};
      ipcRenderer.on(PREFIX+'menu-action',listener);return()=>ipcRenderer.removeListener(PREFIX+'menu-action',listener);
    },
  });
}
