'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const actions = new Set(['hide','expand','set-size','ready','drag-start','drag-move','drag-end','feed','play','sleep','pet','toggle-trail','select','reminders','snooze','focus-toggle','open-task','open-ai','open-home','open-create','open-remove','open-import','open-export']);
if (process.isMainFrame) contextBridge.exposeInMainWorld('PetDesktop', {
  createWork: async value => {
    const response = await ipcRenderer.invoke('tracer-pet-create-work', value);
    if (!response || !response.ok) throw new Error(response?.error || 'companion-save-pending');
    return response.result;
  },
  send: message => {
    if (!message || !actions.has(message.type)) return;
    if (message.type === 'set-size') {
      if (!Number.isFinite(message.value)) return;
      ipcRenderer.send('tracer-pet-command',{type:message.type,value:Math.max(70,Math.min(180,Math.round(message.value)))}); return;
    }
    if (message.type.startsWith('drag-')) {
      if (message.value === undefined) { ipcRenderer.send('tracer-pet-command',{type:message.type}); return; }
      const value=message.value;
      if (!value || !Number.isFinite(value.screenX) || !Number.isFinite(value.screenY)) return;
      ipcRenderer.send('tracer-pet-command',{type:message.type,value:{screenX:value.screenX,screenY:value.screenY}}); return;
    }
    const value=typeof message.value==='boolean'?message.value:typeof message.value==='string'?message.value.slice(0,100):undefined;
    ipcRenderer.send('tracer-pet-command',{type:message.type,value});
  },
  onState: callback => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('tracer-pet-snapshot', (_event,value) => callback(value));
  }
});
