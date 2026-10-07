'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { ipcMain, dialog } = require('electron');
const Portable = require('../lib/portable-backup');
const Backup = require('../lib/workspace-backup');

function attachBackupFiles(win, origin, accounts, options = {}) {
  const readonly = options.readonly ?? process.env.DOCS_PORTAL_READONLY_STORE === '1';
  let job = null, committing = false, selection = null;
  const trusted = event => event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === origin + '/';
  const progress = value => {
    if (value.phase === 'commit') committing = true;
    if (!win.isDestroyed()) win.webContents.send('tracer-backup-progress', value);
  };
  const expected = request => ({ scope: request.scope, generation: request.generation, restoreId: request.restoreId });
  const generation = request => String(request.generation || 0);

  async function request(event, value) {
    if (!trusted(event) || !value || typeof value !== 'object' || Array.isArray(value) || !['export', 'choose', 'restore', 'cancel'].includes(value.action)) {
      return { ok: false, error: 'backup-forbidden' };
    }
    if (value.action === 'cancel') {
      if (committing) return { ok: false, error: 'backup-busy' };
      job?.abort();
      return { ok: true };
    }
    if (readonly && value.action === 'restore') return { ok: false, error: 'readonly' };
    if (job) return { ok: false, error: 'backup-busy' };
    try { if (JSON.stringify(value).length > 2 * 1024 * 1024) return { ok: false, error: 'backup-too-large' }; }
    catch { return { ok: false, error: 'backup-forbidden' }; }
    const controller = new AbortController();
    committing = false;
    job = controller;
    try {
      const cookies = await win.webContents.session.cookies.get({ url: origin, name: accounts.cookieName });
      const token = cookies[0]?.value || '';
      const operation = { signal: controller.signal, onProgress: progress };
      if (value.action === 'export') {
        const pick = await dialog.showOpenDialog(win, { title: 'Choose backup destination', properties: ['openDirectory', 'createDirectory'] });
        if (pick.canceled) return { ok: true, cancelled: true };
        const name = 'Tracer-backup-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8);
        const incomplete = path.join(pick.filePaths[0], name + '.incomplete'), output = path.join(pick.filePaths[0], name);
        const result = await accounts.portableFileOperation(token, expected(value), directory => Portable.exportDirectory(directory, value.preferences, incomplete, {
          ...operation, finalize: from => fs.rename(from, output)
        }));
        return { ok: true, ...result, output };
      }
      if (value.action === 'choose') {
        const pick = await dialog.showOpenDialog(win, { title: 'Choose Tracer backup folder (contains manifest.json)', properties: ['openDirectory'] });
        if (pick.canceled) return { ok: true, cancelled: true };
        const input = pick.filePaths[0], payload = await Portable.inspectDirectory(input, operation);
        return await accounts.portableFileOperation(token, expected(value), (_directory, workspace) => {
          selection = {
            id: crypto.randomUUID(), input, checksum: Backup.hash(payload), expected: Backup.hash(workspace),
            scope: value.scope, generation: generation(value), restoreId: value.restoreId
          };
          return {
            ok: true, id: selection.id, source: input, tasks: payload.workspace.tasks.length,
            rods: payload.workspace.fishing ? new Set(['bamboo', ...payload.workspace.fishing.boxes.map(box => box.rodId)]).size : 0,
            fish: payload.workspace.fishing?.catches.length || 0,
            ponds: payload.workspace.fishing?.ponds.length || 0,
            companions: JSON.parse(payload.preferences['tracer.pet.v1'] || '{"customs":[]}').customs.length,
            images: payload.assets.length, pngBytes: payload.assets.reduce((total, asset) => total + asset.bytes, 0)
          };
        });
      }
      if (!selection || selection.id !== value.id || selection.scope !== value.scope ||
          selection.generation !== generation(value) || selection.restoreId !== value.restoreId || value.confirm !== true) {
        throw Error('backup-confirmation-required');
      }
      const selected = selection;
      const payload = await Portable.inspectDirectory(selected.input, operation);
      if (Backup.hash(payload) !== selected.checksum) throw Error('backup-stale');
      const result = await accounts.portableFileOperation(token, expected(value), directory => Portable.restoreDirectory(selected.input, directory, value.preferences, {
        ...operation, confirm: true, expected: selected.expected
      }));
      selection = null;
      return { ok: true, ...result };
    } catch (error) {
      return {
        ok: false,
        error: typeof error.code === 'string' && error.code.startsWith('backup-') ? error.code :
          (/^[a-z-]+$/.test(error.message) ? error.message : 'backup-storage-unavailable')
      };
    } finally { job = null; committing = false; }
  }

  ipcMain.handle('tracer-backup-files', request);
  win.once('closed', () => { job?.abort(); ipcMain.removeHandler('tracer-backup-files'); });
  return { request };
}

module.exports = { attachBackupFiles };
