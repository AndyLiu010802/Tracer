'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ipcMain } = require('electron');

// Optional one-time, local-only migration file. Never distributed in the installer.
function attachPreferencesImport(win, userData, origin) {
  const file = path.join(userData, 'browser-preferences.pending.json');
  let preferences = null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    preferences = Object.fromEntries(Object.entries(raw).filter(([key, value]) =>
      (key.startsWith('tracer.') || key === 'dbconsole.farm.v3' || key === 'docsportal.aside.v1') && typeof value === 'string'));
  } catch (e) { if (e.code !== 'ENOENT') console.error('[preferences] Import could not be read: ' + e.message); }
  function trusted(event) {
    return event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame
      && event.senderFrame.url.startsWith(origin + '/') && !event.senderFrame.url.startsWith(origin + '/r/');
  }
  function read(event) { event.returnValue = trusted(event) ? preferences : null; }
  function done(event) {
    if (!trusted(event) || !preferences) return;
    try { fs.renameSync(file, path.join(userData, 'browser-preferences.imported-' + Date.now() + '.json')); preferences = null; }
    catch (e) { console.error('[preferences] Could not finalize import: ' + e.message); }
  }
  ipcMain.on('tracer-preferences-read', read); ipcMain.on('tracer-preferences-imported', done);
  win.on('closed', () => { ipcMain.removeListener('tracer-preferences-read', read); ipcMain.removeListener('tracer-preferences-imported', done); });
}
module.exports = { attachPreferencesImport };
