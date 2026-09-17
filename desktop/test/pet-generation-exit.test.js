'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), { EventEmitter } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { attachPetGenerationExit } = require('../pet-generation-exit');
function window() {
  const win = new EventEmitter();
  Object.assign(win, { webContents: new EventEmitter(), shown: 0, focused: 0, restored: 0, minimized: true,
    isMinimized() { return this.minimized; }, restore() { this.restored++; this.minimized = false; }, show() { this.shown++; }, focus() { this.focused++; } });
  return win;
}

test('companion unload confirmation defaults to staying and only an explicit Leave permits unloading', () => {
  for (const choice of [0, undefined, -1, 1]) {
    const win = window(); let options, parent, stayed = 0, unloaded = 0;
    attachPetGenerationExit(win, { dialog: { showMessageBoxSync(owner, value) { parent = owner; options = value; return choice; } }, onStay() { stayed++; } });
    win.webContents.emit('will-prevent-unload', { preventDefault() { unloaded++; } });
    assert.equal(parent, win); assert.equal(options.defaultId, 0); assert.equal(options.cancelId, 0);
    assert.match(options.buttons[0], /Stay/); assert.match(options.buttons[1], /Leave/);
    assert.match(options.detail, /interrupt the current action/); assert.match(options.detail, /Saved draft progress/); assert.match(options.detail, /storage failed/);
    assert.equal(unloaded, choice === 1 ? 1 : 0); assert.equal(stayed, choice === 1 ? 0 : 1);
    assert.equal(win.restored, 1); assert.equal(win.shown, 1); assert.equal(win.focused, 1);
  }
});

test('a failed dialog preserves work and closed windows remove their unload listener', () => {
  const win = window(); let stayed = 0, unloaded = 0;
  attachPetGenerationExit(win, { dialog: { showMessageBoxSync() { throw new Error('dialog unavailable'); } }, onStay() { stayed++; } });
  win.webContents.emit('will-prevent-unload', { preventDefault() { unloaded++; } });
  assert.equal(stayed, 1); assert.equal(unloaded, 0);
  win.emit('closed'); assert.equal(win.webContents.listenerCount('will-prevent-unload'), 0);
});

test('main quit flow leaves Codex alive when Stay cancels quitting and preserves normal close-to-tray behavior', async () => {
  const app = new EventEmitter(), server = new EventEmitter(), windows = [], counts = { closedCodex: 0 }, choices = [];
  Object.assign(app, { isPackaged: false, setPath() {}, getPath: () => '/isolated-profile', requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(), quit() {} });
  server.listen = (_port, _host, callback) => callback();
  class BrowserWindow extends EventEmitter {
    constructor() { super(); Object.assign(this, window()); this.hidden = 0; this.webContents.setWindowOpenHandler = () => {}; windows.push(this); }
    isDestroyed() { return false; }
    hide() { this.hidden++; }
    loadURL() {}
  }
  class Tray extends EventEmitter { setToolTip() {} setContextMenu() {} }
  const gateway = { setSecureStorage() {}, closeCodex() { counts.closedCodex++; } };
  const electron = { app, BrowserWindow, Tray, Menu: { buildFromTemplate: menu => menu }, nativeImage: { createFromPath: () => ({ resize() { return this; }, setTemplateImage() {} }) },
    dialog: { showMessageBoxSync: () => choices.shift() }, systemPreferences: {}, safeStorage: {} };
  const dependencies = {
    electron,
    './platform-integration': { installApplicationMenu() {}, canStartInputHook: () => false },
    './pulse': { pulseFor() {} }, './migrate': { migrateUserData() {} },
    '../server.js': { server, config: { host: '127.0.0.1', port: 8137 } }, '../lib/ai-gateway': gateway,
    './pet-generation-exit': { attachPetGenerationExit }, './preferences-import': { attachPreferencesImport() {} },
    './browser': { attachBrowser: () => ({ contents: {} }) }, './window-controls': { attachWindowControls() {} }, './pet': { attachPet: () => ({ show() {} }) }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8'), {
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), __dirname: path.resolve(__dirname, '..'),
    process: { platform: 'win32', env: { TRACER_USER_DATA_DIR: '/isolated-profile', TRACER_DISABLE_INPUT_HOOK: '1' } }, console: { log() {}, error() {} }
  });
  await Promise.resolve();
  assert.equal(windows.length, 1); const win = windows[0]; let prevented = 0, allowedUnload = 0;
  const closing = () => win.emit('close', { preventDefault() { prevented++; } });
  closing(); assert.equal(prevented, 1); assert.equal(win.hidden, 1); assert.equal(counts.closedCodex, 0);
  app.emit('before-quit'); closing(); assert.equal(prevented, 1); assert.equal(counts.closedCodex, 0, 'starting quit must not interrupt generation');
  choices.push(0); win.webContents.emit('will-prevent-unload', { preventDefault() { allowedUnload++; } });
  assert.equal(allowedUnload, 0); assert.equal(counts.closedCodex, 0); assert.ok(win.shown > 0);
  closing(); assert.equal(prevented, 2); assert.equal(win.hidden, 2, 'Stay resets the quitting flag so the close button still hides to tray');
  app.emit('before-quit'); choices.push(1); win.webContents.emit('will-prevent-unload', { preventDefault() { allowedUnload++; } });
  assert.equal(allowedUnload, 1); assert.equal(counts.closedCodex, 0, 'the decision alone does not stop Codex before will-quit');
  app.emit('will-quit'); assert.equal(counts.closedCodex, 1);
});
