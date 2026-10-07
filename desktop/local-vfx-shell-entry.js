'use strict';

const M = require('./local-vfx-shell-model');
const { createRegistration } = require('./local-vfx-shell-registry');
const CHANNEL = 'tracer-local-vfx-menu';
const ERRORS = new Set(['registry-read-failed', 'registry-access-denied', 'registry-parent-missing', 'local-menu-conflict', 'local-menu-rollback-blocked', 'registry-operation-failed', 'registry-protocol-invalid', 'parents-receipt-invalid', 'parents-receipt-read-failed', 'parents-receipt-write-failed', 'parents-receipt-busy', 'parents-receipt-path-invalid', 'parents-read-failed', 'parents-read-invalid', 'parents-create-conflict', 'parents-create-outcome-unknown', 'parents-create-response-invalid', 'parents-create-changed', 'parents-cleanup-failed', 'parents-operation-failed']);

// Only the existing main page can request one of these fixed operations. The
// renderer never chooses a registry key, command, path, launch target or token.
function attachShellMenu(main, { app, profile, platform, origin, userData, ipcMain,
  execute = (...args) => require('node:child_process').spawnSync(...args),
  registrationFactory = createRegistration } = {}) {
  const contents = main.webContents;
  let dead = false, busy = false, registration = null;
  const allowed = M.allowed(app, profile, platform);
  function trusted(event) {
    try { return !dead && !main.isDestroyed() && event?.sender === contents &&
      event.senderFrame === contents.mainFrame && event.senderFrame?.url === origin + '/'; }
    catch { return false; }
  }
  function valid(value) {
    try {
      if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
      const names = Reflect.ownKeys(value), descriptor = Object.getOwnPropertyDescriptor(value, 'action');
      return names.length === 1 && names[0] === 'action' && descriptor && Object.hasOwn(descriptor, 'value') &&
        ['status', 'install', 'remove'].includes(descriptor.value);
    } catch { return false; }
  }
  function capability() {
    if (!registration) registration = registrationFactory({ app, profile, platform,
      launch: M.fixedSourceLaunch(), execute, userData });
    return registration;
  }
  async function request(event, value) {
    if (!allowed || !trusted(event)) return { ok: false, error: 'local-menu-forbidden' };
    if (!valid(value)) return { ok: false, error: 'local-menu-invalid-request' };
    if (busy) return { ok: false, error: 'local-menu-busy' };
    busy = true;
    try {
      const menu = capability();
      const operation = value.action === 'status' ? null : menu[value.action]();
      if (operation && !operation.ok) return operation;
      const status = menu.status();
      if (!status.ok) return status;
      return { ...status, allowed: true, ...(operation ? { operation } : {}) };
    } catch (error) { return { ok: false, error: ERRORS.has(error?.message) ? error.message : 'registry-operation-failed' }; }
    finally { busy = false; }
  }
  function destroy() {
    if (dead) return;
    dead = true;
    ipcMain.removeHandler(CHANNEL);
    main.removeListener('closed', destroy);
  }
  ipcMain.handle(CHANNEL, request);
  main.once('closed', destroy);
  return Object.freeze({ request, destroy });
}

module.exports = { attachShellMenu, CHANNEL };
