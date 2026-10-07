'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const actions = new Set(['cast-start', 'cast-release', 'hook', 'reel-start', 'reel-release', 'cancel', 'cast', 'hold', 'release', 'catch', 'open-home', 'open-tackle']);
const commands = new Set(['ready', 'hide', 'resize', 'context-menu', 'input-regions', 'pointer-pass-through', 'drag-start', 'drag-move', 'drag-end']);
let snapshot = null, sequence = 0;
function credentials() {
  if (!snapshot) return null;
  return { accountScope: snapshot.accountScope || 'guest', accountGeneration: snapshot.accountGeneration || 0,
    accountRestoreId: snapshot.accountRestoreId || '', nativeSessionId: snapshot.nativeSessionId,
    sessionId: snapshot.fishing?.sessionId || snapshot.sessionId || snapshot.session?.id || '' };
}
if (process.isMainFrame) {
  ipcRenderer.on('tracer-fishing-snapshot', (_event, value) => {
    if (!value || typeof value !== 'object' || typeof value.nativeSessionId !== 'string') return;
    if (snapshot?.nativeSessionId !== value.nativeSessionId) sequence = 0;
    snapshot = value;
  });
  contextBridge.exposeInMainWorld('FishingDesktop', {
    send: message => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ready') { ipcRenderer.send('tracer-fishing-command', { type: 'ready' }); return; }
      const auth = credentials(); if (!auth) return;
      if (actions.has(message.type)) { ipcRenderer.send('tracer-fishing-action', { type: message.type, ...auth, sequence: ++sequence, ...(message.type === 'cast-start' && message.entranceReady === true ? { entranceReady: true } : {}) }); return; }
      if (!commands.has(message.type)) return;
      let value;
      if (message.type === 'input-regions') {
        const v = message.value;
        if (!Array.isArray(v) || !v.length || v.length > 8 || v.some(r => !r || !['x','y','width','height'].every(k => Number.isFinite(r[k])))) return;
        value = v.map(({x,y,width,height}) => ({x,y,width,height}));
      }
      if (message.type === 'resize') { if (!Number.isFinite(message.value)) return; value = Math.max(.5, Math.min(2.5, message.value)); }
      if (message.type === 'pointer-pass-through') { if (typeof message.value !== 'boolean') return; value = message.value; }
      if (message.type.startsWith('drag-')) {
        const v = message.value;
        if (!v || !Number.isFinite(v.screenX) || !Number.isFinite(v.screenY) || Math.abs(v.screenX) > 1000000 || Math.abs(v.screenY) > 1000000) return;
        value = { screenX: v.screenX, screenY: v.screenY };
      }
      ipcRenderer.send('tracer-fishing-command', { type: message.type, ...auth, ...(value !== undefined ? { value } : {}) });
    },
    onSnapshot: callback => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, value) => { if (value && typeof value.nativeSessionId === 'string') callback(value); };
      ipcRenderer.on('tracer-fishing-snapshot', listener);
      return () => ipcRenderer.removeListener('tracer-fishing-snapshot', listener);
    },
    onMenuAction: callback => {
      if(typeof callback!=='function')return()=>{};
      const listener=(_event,value)=>{if(snapshot&&value?.nativeSessionId===snapshot.nativeSessionId&&['move','summon-rod','dismiss-rod'].includes(value.type))callback({type:value.type});};
      ipcRenderer.on('tracer-fishing-menu-action',listener);return()=>ipcRenderer.removeListener('tracer-fishing-menu-action',listener);
    },
  });
}
