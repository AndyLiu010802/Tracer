'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const actions = new Set(['cast-start', 'cast-release', 'hook', 'reel-start', 'reel-release', 'cancel', 'cast', 'hold', 'release', 'catch', 'open-home', 'open-tackle', 'start-motor', 'pause-motor']);
const commands = new Set(['ready', 'hide', 'open-bait-box', 'resize', 'context-menu', 'input-regions', 'pointer-pass-through', 'drag-start', 'drag-move', 'drag-end']);
let snapshot = null, sequence = 0, pendingCast = null;
const castSession = value => value?.fishing?.sessionId || value?.sessionId || value?.session?.id || '';
const accountKey = value => JSON.stringify([value?.accountScope || 'guest', value?.accountGeneration || 0, value?.accountRestoreId || '']);
function credentials() {
  if (!snapshot) return null;
  return { accountScope: snapshot.accountScope || 'guest', accountGeneration: snapshot.accountGeneration || 0,
    accountRestoreId: snapshot.accountRestoreId || '', nativeSessionId: snapshot.nativeSessionId,
    sessionId: castSession(snapshot) };
}
function sendAction(type, extra = {}) {
  const auth = credentials();
  if (auth) ipcRenderer.send('tracer-fishing-action', { type, ...auth, sequence: ++sequence, ...extra });
}
if (process.isMainFrame) {
  ipcRenderer.on('tracer-fishing-snapshot', (_event, value) => {
    if (!value || typeof value !== 'object' || typeof value.nativeSessionId !== 'string') return;
    if (snapshot?.nativeSessionId !== value.nativeSessionId) sequence = 0;
    snapshot = value;
    // Starting a cast rotates native credentials. A fast physical key-up can
    // beat that acknowledgement; retain only this gesture's terminal action
    // until the authoritative charging snapshot supplies the new credentials.
    // Never carry an action across an account, restore, navigation or failed cast.
    if (pendingCast) {
      const pending = pendingCast, nextSession = castSession(value);
      if (accountKey(value) !== pending.account
          || nextSession === pending.session && value.nativeSessionId !== pending.native) pendingCast = null;
      else if (nextSession !== pending.session) {
        pendingCast = null;
        // An accepted cast may arrive while an unrelated workspace save keeps
        // controls disabled. Its release/cancel still belongs to this gesture.
        if (nextSession && value.session?.phase === 'charging' && pending.terminal) sendAction(pending.terminal, pending.extra);
      } else if (value.error || value.disabled) pendingCast = null;
    }
  });
  contextBridge.exposeInMainWorld('FishingDesktop', {
    send: message => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ready') { ipcRenderer.send('tracer-fishing-command', { type: 'ready' }); return; }
      const auth = credentials(); if (!auth) return;
      if (actions.has(message.type)) {
        if (message.type === 'cast-start') {
          if (pendingCast) return;
          if (['idle', 'caught', 'escaped'].includes(snapshot.session?.phase || 'idle'))
            pendingCast = { account: accountKey(snapshot), session: castSession(snapshot), native: snapshot.nativeSessionId, terminal: null };
        }
        if (pendingCast && ['cast-release', 'cancel'].includes(message.type)) {
          if (pendingCast.terminal !== 'cancel') { pendingCast.terminal = message.type; pendingCast.extra = message.type === 'cast-release' && Number.isFinite(message.heldMs) && message.heldMs >= 0 && message.heldMs <= 8000 ? { heldMs: message.heldMs } : {}; }
          return;
        }
        sendAction(message.type, message.type === 'cast-start' && message.entranceReady === true ? { entranceReady: true } : message.type === 'cast-release' && Number.isFinite(message.heldMs) && message.heldMs >= 0 && message.heldMs <= 8000 ? { heldMs: message.heldMs } : {});
        return;
      }
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
