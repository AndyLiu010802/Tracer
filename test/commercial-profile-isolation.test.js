'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const profile = require('../desktop/release-profile');
const root = path.resolve(__dirname, '..');
const marker = { version: 1, channel: 'commercial' };
const missingPath = () => { const error = new Error('synthetic path not present'); error.code = 'ENOENT'; throw error; };
function resolve(extra = {}) {
  return profile.resolveDesktopProfile({ appData: 'C:\\fixture\\Roaming', appPath: 'C:\\fixture\\app.asar',
    isPackaged: true, platform: 'win32', readPackage: () => ({ tracerRelease: marker }), realpath: missingPath, ...extra });
}

test('only packaged metadata chooses commercial; development and old personal packages retain local defaults', () => {
  const local = resolve({ isPackaged: false, env: { TRACER_RELEASE_MODE: 'commercial' }, readPackage: () => { throw Error('must not read'); } });
  assert.equal(local.channel, 'local'); assert.equal(local.userData, 'C:\\fixture\\Roaming\\tracer-desktop'); assert.equal(local.migrateLegacy, true);
  const existing = resolve({ readPackage: () => ({ name: 'tracer-desktop' }) });
  assert.equal(existing.channel, 'local'); assert.equal(existing.migrateLegacy, true);
  const commercial = resolve();
  assert.equal(commercial.userData, 'C:\\fixture\\Roaming\\tracer-desktop-commercial');
  assert.equal(commercial.dataDir, commercial.userData + '\\data');
  assert.equal(commercial.stateFile, commercial.userData + '\\bookmarks.json');
  assert.equal(commercial.migrateLegacy, false); assert.equal(commercial.migrationStatus, 'commercial-profile');
});

test('commercial uses bundled metadata path and fails closed on corrupt or unsupported markers', () => {
  let read;
  assert.equal(resolve({ readPackage: file => { read = file; return { tracerRelease: marker }; } }).channel, 'commercial');
  assert.equal(read, path.join('C:\\fixture\\app.asar', 'package.json'));
  for (const invalid of [null, [], {}, { version: 2, channel: 'commercial' }, { version: 1, channel: 'local' }, { ...marker, profile: 'tracer-desktop' }]) {
    assert.throws(() => resolve({ readPackage: () => ({ tracerRelease: invalid }) }), /reviewed tracerRelease metadata marker/);
  }
  assert.throws(() => resolve({ readPackage: () => null }), /Invalid packaged application metadata/);
  assert.throws(() => resolve({ readPackage: () => { throw Error('corrupt packaged JSON'); } }), /corrupt packaged JSON/);
});

test('commercial profile overrides retain isolated QA locations but reject all personal and legacy overlaps', () => {
  const env = { TRACER_USER_DATA_DIR: 'D:\\QA\\profile', DOCS_PORTAL_DATA_DIR: 'D:\\QA\\data', DOCS_PORTAL_STATE_FILE: 'D:\\QA\\state.json' };
  const result = resolve({ env });
  assert.equal(result.userData, env.TRACER_USER_DATA_DIR); assert.equal(result.dataDir, env.DOCS_PORTAL_DATA_DIR);
  assert.equal(result.stateFile, env.DOCS_PORTAL_STATE_FILE); assert.equal(result.migrateLegacy, false);
  assert.deepEqual(env, { TRACER_USER_DATA_DIR: 'D:\\QA\\profile', DOCS_PORTAL_DATA_DIR: 'D:\\QA\\data', DOCS_PORTAL_STATE_FILE: 'D:\\QA\\state.json' });
  for (const name of ['TRACER_USER_DATA_DIR', 'DOCS_PORTAL_DATA_DIR', 'DOCS_PORTAL_STATE_FILE']) {
    for (const target of ['C:\\fixture\\Roaming\\tracer-desktop', 'C:\\fixture\\Roaming\\tracer-desktop\\nested',
      'C:\\fixture\\Roaming\\podmatrix-desktop\\data', 'C:\\fixture\\Roaming']) {
      assert.throws(() => resolve({ env: { [name]: target } }), error => error.code === 'TRACER_PROFILE_ISOLATION' && error.message.includes(name));
    }
  }
  assert.equal(resolve({ env: { TRACER_USER_DATA_DIR: 'C:\\fixture\\Roaming\\tracer-desktop-qa' } }).channel, 'commercial', 'sibling prefix is not containment');
});

test('Windows case, dot segments, trailing aliases and extended paths cannot enter the local profile', () => {
  for (const target of ['C:\\FIXTURE\\ROAMING\\TRACER-DESKTOP\\data', 'C:\\fixture\\Roaming\\qa\\..\\tracer-desktop\\data',
    'C:\\fixture\\Roaming\\tracer-desktop. \\data', '\\\\?\\C:\\fixture\\Roaming\\tracer-desktop\\data']) {
    assert.throws(() => resolve({ env: { TRACER_USER_DATA_DIR: target } }), error => error.code === 'TRACER_PROFILE_ISOLATION');
  }
});

test('existing directory aliases and new children below aliases fail closed without reading profile contents', () => {
  const visited = [];
  const realpath = value => {
    visited.push(value);
    if (value === 'D:\\QA\\alias') return 'C:\\fixture\\Roaming\\tracer-desktop';
    return missingPath();
  };
  assert.throws(() => resolve({ realpath, env: { TRACER_USER_DATA_DIR: 'D:\\QA\\alias\\new-child' } }), error => error.code === 'TRACER_PROFILE_ISOLATION');
  assert(visited.includes('D:\\QA\\alias'));
  assert.throws(() => resolve({ realpath: value => value === 'C:\\fixture\\Roaming\\tracer-desktop-commercial' ? 'C:\\fixture\\Roaming\\tracer-desktop' : missingPath() }), error => error.code === 'TRACER_PROFILE_ISOLATION', 'default commercial directory cannot be a junction into personal data');
  assert.throws(() => resolve({ realpath: () => { const error = Error('permission denied'); error.code = 'EACCES'; throw error; } }), /permission denied/);
});

test('local explicit profile and storage overrides preserve existing behavior and never auto-migrate', () => {
  const env = { TRACER_USER_DATA_DIR: 'C:\\fixture\\Roaming\\tracer-desktop', DOCS_PORTAL_DATA_DIR: 'relative-data', DOCS_PORTAL_STATE_FILE: 'relative-state' };
  const value = resolve({ isPackaged: false, env, realpath: () => { throw Error('must not check local profile'); } });
  assert.equal(value.userData, env.TRACER_USER_DATA_DIR); assert.equal(value.dataDir, 'relative-data');
  assert.equal(value.stateFile, 'relative-state'); assert.equal(value.migrateLegacy, false); assert.equal(value.migrationStatus, 'custom-profile');
});

test('macOS commercial profile is distinct without Windows case normalization', () => {
  const value = resolve({ platform: 'darwin', appData: '/fixture/Library/Application Support', appPath: '/fixture/Tracer.app/Contents/Resources/app.asar' });
  assert.equal(value.userData, '/fixture/Library/Application Support/tracer-desktop-commercial'); assert.equal(value.migrateLegacy, false);
  assert.throws(() => resolve({ platform: 'darwin', appData: '/fixture/Library/Application Support', env: { DOCS_PORTAL_DATA_DIR: '/fixture/Library/Application Support/tracer-desktop/data' } }), /must not overlap/);
});

test('commercial build guard requires exact marker and refuses relabeling a commercial config as a personal build', () => {
  const release = require('../dev/commercial-release.cjs'), guard = require('../dev/release-mode.cjs');
  const config = release.config(root);
  assert.deepEqual(config.extraMetadata.tracerRelease, marker); assert.equal(guard.assertBuildMode(config, root, {}), 'commercial');
  for (const value of [undefined, null, { version: 2, channel: 'commercial' }]) {
    assert.throws(() => guard.assertBuildMode({ ...config, extraMetadata: { ...config.extraMetadata, tracerRelease: value } }, root, {}), /metadata marker/);
  }
  assert.throws(() => guard.assertBuildMode(config, root, { TRACER_LOCAL_BUILD: '1' }), /Local build must not contain commercial metadata/);
  assert.equal(guard.assertBuildMode(require('../package.json').build, root, { TRACER_LOCAL_BUILD: '1' }), 'local-only');
});

async function mainFixture({ packaged, metadata, env = {}, observed = {} }) {
  const app = new EventEmitter(), server = new EventEmitter(), calls = Object.assign(observed, { migrations: [], paths: [], serverLoads: 0 });
  let userData;
  Object.assign(app, { isPackaged: packaged, getAppPath: () => 'C:\\fixture\\app.asar',
    getPath: name => name === 'appData' ? 'C:\\fixture\\Roaming' : userData,
    setPath(name, value) { calls.paths.push([name, value]); userData = value; },
    requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(), quit() {} });
  server.listen = (_port, _host, callback) => callback();
  class BrowserWindow extends EventEmitter {
    constructor() { super(); this.webContents = new EventEmitter(); this.webContents.setWindowOpenHandler = () => {}; }
    loadURL() {} isDestroyed() { return false; } hide() {} isMinimized() { return false; } show() {} focus() {}
  }
  class Tray extends EventEmitter { setToolTip() {} setContextMenu() {} }
  const electron = { app, BrowserWindow, Tray, Menu: { buildFromTemplate: value => value },
    nativeImage: { createFromPath: () => ({ resize() { return this; }, setTemplateImage() {} }) }, dialog: {}, systemPreferences: {}, safeStorage: {} };
  const dependencies = {
    electron, './release-profile': { resolveDesktopProfile: options => profile.resolveDesktopProfile({ ...options, readPackage: () => metadata, realpath: missingPath }) },
    './local-vfx': { attachLocalVfx: () => ({ menuItems: () => [], cancel() {}, destroy() {} }) },
    './local-vfx-shell-router': { createRouter: () => ({ receive: () => false, ready() {}, destroy() {} }) },
    './local-vfx-shell-model': require('../desktop/local-vfx-shell-model'),
    './local-vfx-shell-entry': { attachShellMenu: () => ({ destroy() {} }) },
    './platform-integration': { installApplicationMenu() {}, canStartInputHook: () => false }, './pulse': { pulseFor() {} },
    './migrate': { migrateUserData(...args) { calls.migrations.push(args); return { status: 'synthetic-only' }; } },
    '../lib/ai-gateway': { setSecureStorage() {} }, './backup-files': { attachBackupFiles() {} }, './preferences-import': { attachPreferencesImport() {} },
    './browser': { attachBrowser: () => ({ contents: {} }) }, './window-controls': { attachWindowControls() {} }, './fishing': { attachFishing: () => ({ show() {} }) },
    './fishing-aquarium': { attachFishingAquarium: () => ({ show() {} }) }
  };
  const processStub = { platform: 'win32', execPath: 'C:\\fixture\\node.exe', argv: ['C:\\fixture\\node.exe', 'C:\\fixture\\app\\desktop\\main.js'], resourcesPath: 'C:\\fixture\\resources', env: { TRACER_DISABLE_INPUT_HOOK: '1', ...env } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'desktop/main.js'), 'utf8'), {
    require(name) { if (name === '../server.js') { calls.serverLoads++; return { server, config: { host: '127.0.0.1', port: 12999 }, accounts: {} }; }
      return Object.hasOwn(dependencies, name) ? dependencies[name] : require(name); },
    __dirname: path.join(root, 'desktop'), process: processStub, console: { log() {}, error() {} }
  });
  await Promise.resolve(); return { calls, env: processStub.env };
}

test('main fixture configures commercial profile before loading services and never invokes legacy migration', async () => {
  const value = await mainFixture({ packaged: true, metadata: { tracerRelease: marker } });
  assert.deepEqual(value.calls.paths, [['userData', 'C:\\fixture\\Roaming\\tracer-desktop-commercial']]);
  assert.equal(value.calls.serverLoads, 1); assert.equal(value.calls.migrations.length, 0);
  assert.equal(value.env.DOCS_PORTAL_DATA_DIR, 'C:\\fixture\\Roaming\\tracer-desktop-commercial\\data');
  assert.equal(value.env.DOCS_PORTAL_STATE_FILE, 'C:\\fixture\\Roaming\\tracer-desktop-commercial\\bookmarks.json');
  const local = await mainFixture({ packaged: false });
  assert.equal(local.calls.migrations.length, 1);
  assert.deepEqual(local.calls.migrations[0], ['C:\\fixture\\Roaming\\podmatrix-desktop', 'C:\\fixture\\Roaming\\tracer-desktop']);
  const custom = await mainFixture({ packaged: false, env: { TRACER_USER_DATA_DIR: 'D:\\QA\\profile' } });
  assert.equal(custom.calls.migrations.length, 0);
});

test('main rejects commercial personal-storage overrides before creating a profile or loading services', async () => {
  for (const name of ['TRACER_USER_DATA_DIR', 'DOCS_PORTAL_DATA_DIR', 'DOCS_PORTAL_STATE_FILE']) {
    const observed = {};
    await assert.rejects(mainFixture({ packaged: true, metadata: { tracerRelease: marker }, observed, env: { [name]: 'C:\\fixture\\Roaming\\tracer-desktop\\data' } }), /must not overlap/);
    assert.deepEqual(observed.paths, []); assert.equal(observed.serverLoads, 0); assert.deepEqual(observed.migrations, []);
  }
});
