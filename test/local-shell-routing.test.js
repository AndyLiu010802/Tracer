'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const M = require('../desktop/local-vfx-shell-model');
const { createRouter } = require('../desktop/local-vfx-shell-router');

const launch = M.fixedSourceLaunch();
const options = Object.freeze({ app: { isPackaged: false }, profile: { channel: 'local' }, platform: 'win32', launch });
const argv = action => [launch.executable, launch.appPath, '--tracer-local-action=' + action];
const electronArgv = action => [launch.executable, '--tracer-local-action=' + action, '--allow-file-access-from-files', launch.appPath];

// The registry is an in-memory tree. These tests never read or modify Windows
// registry keys and never launch a child process or a user application.
function registryFixture({ failWriteAt = 0, failRemoveAt = 0 } = {}) {
  const nodes = new Map();
  const calls = [];
  let writes = 0, removes = 0, writeFailed = false, removeFailed = false;
  const snapshot = () => [...nodes.entries()].map(([key, value]) => [key, { values: { ...value.values }, children: [...value.children] }])
    .sort((a, b) => a[0].localeCompare(b[0]));
  return {
    nodes, calls, snapshot,
    seed(key, values = {}, children = []) { nodes.set(key, { values: { ...values }, children: [...children] }); },
    read(key) {
      const node = nodes.get(key);
      if (!node) return null;
      const children = new Set(node.children);
      const prefix = key + '\\';
      for (const childKey of nodes.keys()) {
        if (childKey.startsWith(prefix)) children.add(childKey.slice(prefix.length).split('\\')[0]);
      }
      return { values: { ...node.values }, children: [...children].sort() };
    },
    write(key, values) {
      calls.push(['write', key, { ...values }]);
      if (++writes === failWriteAt && !writeFailed) { writeFailed = true; throw Error('synthetic registry write failed'); }
      const previous = nodes.get(key);
      nodes.set(key, { values: { ...previous?.values, ...values }, children: [...previous?.children || []] });
    },
    remove(key) {
      calls.push(['remove', key]);
      if (++removes === failRemoveAt && !removeFailed) { removeFailed = true; throw Error('synthetic registry removal failed'); }
      for (const childKey of [...nodes.keys()]) if (childKey === key || childKey.startsWith(key + '\\')) nodes.delete(childKey);
    }
  };
}

function rejectedPlan(candidate) {
  let plan;
  try { plan = M.buildPlan(candidate); } catch { return; }
  assert(plan == null || plan.allowed === false, 'unapproved environments cannot mint an installable registry plan');
}

function seedPlan(registry, plan) {
  for (const entry of plan.entries) {
    // Child names come from the tree, just as a registry read enumerates actual
    // subkeys. Do not retain a stale 'command' child after that key is removed.
    registry.seed(entry.key, entry.parent.values);
    registry.seed(entry.command.key, entry.command.values, entry.command.children);
  }
}

function routerFixture(overrides = {}) {
  const calls = [];
  const results = [];
  const router = createRouter({
    ...options,
    release: () => { calls.push('release'); return { ok: true }; },
    cancel: () => { calls.push('cancel'); return { ok: true }; },
    configure: () => { calls.push('configure'); return { ok: true }; },
    onResult: result => results.push(result),
    ...overrides
  });
  return { router, calls, results };
}

// The real main entry point and pure router execute inside this VM. Every
// Electron, profile and service boundary is replaced with a controlled fake.
// Unexpected imports fail; no profile, network or registry is consulted.
function mainFixture(overrides = {}) {
  const required = [], calls = [], windows = [], attachments = [];
  const app = new EventEmitter();
  app.isPackaged = Object.hasOwn(overrides, 'isPackaged') ? overrides.isPackaged : false;
  const paths = { appData: 'C:\\Synthetic Profiles', userData: 'C:\\Synthetic Profiles\\Tracer fixture' };
  app.getPath = name => paths[name];
  app.setPath = (name, value) => { paths[name] = value; };
  app.getAppPath = () => launch.appPath;
  app.requestSingleInstanceLock = () => overrides.lock !== false;
  app.quit = () => calls.push('quit');
  let resolveReady;
  const applicationReady = new Promise(resolve => { resolveReady = resolve; });
  app.whenReady = () => applicationReady;
  const server = new EventEmitter();
  let listening;
  server.listen = (port, host, callback) => { calls.push(['listen', port, host]); listening = callback; };
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: 'about:blank' };
      this.webContents.isLoadingMainFrame = () => !!this.webContents.loading;
      this.webContents.isDestroyed = () => !!this.webContents.destroyed;
      this.webContents.setWindowOpenHandler = handler => { this.openHandler = handler; };
      this.webContents.send = (...message) => calls.push(['send', ...message]);
      windows.push(this);
    }
    isDestroyed() { return !!this.destroyed; }
    isMinimized() { return false; }
    isFocused() { return false; }
    restore() { calls.push('restore'); }
    show() { calls.push('show'); }
    focus() { calls.push('focus'); }
    hide() { calls.push('hide'); }
    destroy() { this.destroyed = true; this.webContents.destroyed = true; this.emit('closed'); }
    loadURL(url) { this.webContents.mainFrame.url = url; this.webContents.loading = true; return Promise.resolve(); }
  }
  class Tray extends EventEmitter {
    setToolTip() {}
    setContextMenu() {}
  }
  const profile = {
    userData: paths.userData, dataDir: paths.userData + '\\data', stateFile: paths.userData + '\\bookmarks.json',
    migrateLegacy: false, migrationStatus: 'synthetic',
    channel: Object.hasOwn(overrides, 'channel') ? overrides.channel : 'local'
  };
  const electron = {
    app, BrowserWindow, Tray, Menu: { buildFromTemplate: template => template },
    nativeImage: { createFromPath: () => ({ resize() { return this; }, setTemplateImage() {} }) },
    dialog: { showErrorBox: () => calls.push('error-dialog') }, systemPreferences: {}, safeStorage: {}
  };
  const localController = {
    play() { throw Error('legacy immediate playback forbidden'); },
    beginPlacement() { calls.push('release'); if (overrides.releaseError) throw Error(overrides.releaseError); },
    cancel() { calls.push('cancel'); },
    configure(reason = '') { calls.push(['configure', reason]); attachments[0].showMain(); return { ok: true }; }
  };
  function fixtureRequire(id) {
    required.push(id);
    if (overrides.forbidLocal && /^\.\/local-(?:vfx|shell)/.test(id)) throw Error('forbidden local import: ' + id);
    if (id === 'node:path') return path;
    if (id === 'electron') return electron;
    if (id === './platform-integration') return { installApplicationMenu() {}, canStartInputHook: () => false };
    if (id === './pulse') return { pulseFor: () => null };
    if (id === './migrate') return { migrateUserData: () => { calls.push('migrate'); return { status: 'synthetic' }; } };
    if (id === './release-profile') return { resolveDesktopProfile: () => profile };
    if (id === '../server.js') return { server, config: { host: '127.0.0.1', port: 18743 }, accounts: {} };
    if (id === '../lib/ai-gateway') return { setSecureStorage() {}, closeCodex() {} };
    if (id === './backup-files') return { attachBackupFiles() {} };
    if (id === './preferences-import') return { attachPreferencesImport() {} };
    if (id === './browser') return { attachBrowser: () => ({ contents: new EventEmitter() }) };
    if (id === './window-controls') return { attachWindowControls() {} };
    if (id === './fishing') return { attachFishing: () => ({ show() {} }) };
    if (id === './fishing-aquarium') return { attachFishingAquarium: () => ({ show() {} }) };
    if (id === './local-vfx') return { attachLocalVfx: (win, settings) => { attachments.push(settings); return localController; } };
    if (id === './local-vfx-shell-model') return M;
    if (id === './local-vfx-shell-router') return { createRouter };
    if (id === './local-vfx-shell-entry') return { attachShellMenu: () => ({ destroy() {} }) };
    throw Error('unexpected entrypoint import: ' + id);
  }
  const filename = path.join(__dirname, '..', 'desktop', 'main.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: fixtureRequire, __dirname: path.dirname(filename),
    process: {
      platform: 'win32', env: { TRACER_DISABLE_INPUT_HOOK: '1' }, argv: overrides.argv || [launch.executable, launch.appPath],
      execPath: launch.executable, resourcesPath: 'C:\\Synthetic Resources'
    },
    console: { log() {}, error() {} }
  }, { filename });
  return {
    app, server, required, calls, windows, attachments,
    async appReady() { resolveReady(); await Promise.resolve(); },
    serverReady() { assert(listening, 'app readiness must request server startup'); listening(); },
    rendererReady(index = 0) {
      assert(windows[index]);
      windows[index].webContents.loading = false;
      windows[index].webContents.emit('did-finish-load');
    }
  };
}

test('source argv accepts exactly one fixed local action and requires its own launch paths', () => {
  for (const action of ['release', 'cancel', 'configure']) {
    assert.deepEqual(M.parseArgv(argv(action), launch), { kind: 'command', action });
  }
  for (const args of [[], [launch.executable, launch.appPath], [launch.executable, launch.appPath, '--ordinary-switch'], [launch.executable, 'C:\\Other App'], [launch.executable, launch.appPath, 'https://example.test/?--tracer-local-action=release']]) {
    assert.equal(M.parseArgv(args, launch), null);
  }
});

test('related but malformed local argv cannot dispatch arbitrary actions or extra arguments', () => {
  const invalid = { kind: 'invalid', error: 'invalid-local-command' };
  const actions = ['', 'Release', 'haunt', 'release&calc.exe', 'release;Write-Host x', 'release\n--ordinary', 'release\0', '"release"', 'release=haunt'];
  for (const action of actions) assert.deepEqual(M.parseArgv(argv(action), launch), invalid, action);
  for (const args of [
    [...argv('release'), 'https://example.test/'],
    [...argv('release'), '--tracer-local-action=cancel'],
    [launch.executable, launch.appPath, '--tracer-local-effect=haunt'],
    [launch.executable, launch.appPath, '--tracer-local-action', 'release'],
    ['C:\\Other Tools\\electron.exe', launch.appPath, '--tracer-local-action=release'],
    [launch.executable, 'C:\\Other App', '--tracer-local-action=release'],
    [launch.executable, launch.appPath, '--tracer-local-action=release', 'C:\\Other App']
  ]) assert.deepEqual(M.parseArgv(args, launch), invalid);
});

test('the explicit second-instance parser accepts Electron argument reordering and its one fixed internal flag', () => {
  for (const action of ['release', 'cancel', 'configure']) {
    const flag = '--tracer-local-action=' + action, internal = '--allow-file-access-from-files';
    for (const tail of [
      [launch.appPath, flag], [flag, launch.appPath],
      [flag, internal, launch.appPath], [flag, launch.appPath, internal],
      [internal, flag, launch.appPath], [internal, launch.appPath, flag],
      [launch.appPath, internal, flag], [launch.appPath, flag, internal]
    ]) {
      assert.deepEqual(M.parseArgv([launch.executable, ...tail], launch, true), { kind: 'command', action });
    }
  }
});

test('ordinary startup preserves argument order and non-boolean mode values are rejected', () => {
  const invalid = { kind: 'invalid', error: 'invalid-local-command' };
  for (const mode of [undefined, false, null, 0, 1, 'true', 'second-instance', {}, new Boolean(true)]) {
    assert.deepEqual(M.parseArgv(electronArgv('configure'), launch, mode), invalid);
    assert.deepEqual(M.parseArgv([launch.executable, '--tracer-local-action=configure', launch.appPath], launch, mode), invalid);
    assert.deepEqual(M.parseArgv(argv('configure'), launch, mode), mode === undefined || mode === false ? { kind: 'command', action: 'configure' } : invalid);
  }
});

test('second-instance parsing requires unique executable, app path, action and optional exact internal flag', () => {
  const invalid = { kind: 'invalid', error: 'invalid-local-command' };
  const flag = '--tracer-local-action=configure', internal = '--allow-file-access-from-files';
  for (const args of [
    [launch.executable, flag, launch.appPath, launch.appPath],
    [launch.executable, flag, launch.appPath, launch.appPath.toUpperCase()],
    [launch.executable, flag, launch.appPath, launch.appPath.replaceAll('\\', '/')],
    [launch.executable, flag, '--tracer-local-action=cancel', launch.appPath],
    [launch.executable, flag, flag, launch.appPath],
    [launch.executable, flag, internal, internal, launch.appPath],
    [launch.executable, flag, '--ALLOW-FILE-ACCESS-FROM-FILES', launch.appPath],
    [launch.executable, flag, internal + '=true', launch.appPath],
    [launch.executable, flag, internal + '=', launch.appPath],
    [launch.executable, flag, internal, launch.appPath, 'https://example.test/'],
    [launch.executable, flag, internal, launch.appPath, 'C:\\Unrelated\\script.js'],
    [launch.executable, flag, '--user-data-dir=C:\\Unrelated', launch.appPath],
    [launch.executable, flag, '-e', 'process.exit(0)', launch.appPath],
    [launch.executable, flag, internal, launch.executable, launch.appPath],
    ['C:\\Other Tools\\electron.exe', flag, internal, launch.appPath],
    [launch.executable, flag, internal, 'C:\\Other App'],
    [launch.executable, flag, internal],
    [flag, launch.executable, internal, launch.appPath],
    [launch.executable, '--tracer-local-effect=haunt', internal, launch.appPath],
    [launch.executable, '--tracer-local-action=configure&calc.exe', internal, launch.appPath]
  ]) assert.deepEqual(M.parseArgv(args, launch, true), invalid, args.join(' '));
});

test('registry plans require explicitly unpackaged local Windows source launches', () => {
  for (const candidate of [
    { ...options, app: undefined }, { ...options, app: {} }, { ...options, app: { isPackaged: true } },
    { ...options, app: { isPackaged: 0 } }, { ...options, app: { isPackaged: 'false' } },
    { ...options, profile: undefined }, { ...options, profile: {} }, { ...options, profile: { channel: 'commercial' } },
    { ...options, profile: { channel: 'LOCAL' } }, { ...options, platform: 'darwin' }, { ...options, platform: 'linux' }
  ]) rejectedPlan(candidate);
});

test('minted registry plans own only fixed DesktopBackground action subtrees and use quoted direct launch commands', () => {
  const plan = M.buildPlan(options);
  assert.equal(M.OWNER, 'Tracer.LocalEffects.v1');
  assert.equal(M.ROOT, 'HKCU\\Software\\Classes\\DesktopBackground\\Shell');
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.entries), true);
  assert.deepEqual(plan.entries.map(entry => entry.action).sort(), ['cancel', 'configure', 'release']);
  for (const entry of plan.entries) {
    assert(entry.key.startsWith(M.ROOT + '\\Tracer.LocalEffects.'));
    assert.notEqual(entry.key, M.ROOT);
    assert.equal(entry.parent.values.TracerOwner, M.OWNER);
    assert.equal(entry.command.values.TracerOwner, M.OWNER);
    assert.deepEqual(entry.parent.children, ['command']);
    assert.deepEqual(entry.command.children, []);
    assert.equal(entry.command.key, entry.key + '\\command');
    const command = entry.command.values[''];
    assert.equal(entry.parent.values.TracerCommand, command);
    assert.equal(command, '"' + launch.executable + '" "' + launch.appPath + '" "--tracer-local-action=' + entry.action + '"');
    assert(!/cmd(?:\.exe)?\s+\/c|powershell|%[1vV*]/i.test(command));
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(Object.isFrozen(entry.parent.values), true);
    assert.equal(Object.isFrozen(entry.command.values), true);
  }
});

test('launch paths reject relative, quoted and control-character input', () => {
  for (const field of ['executable', 'appPath']) {
    for (const value of ['', 'relative-path', '.\\relative', 'C:\\path"quoted', 'C:\\path\nnext', 'C:\\path\0next']) {
      rejectedPlan({ ...options, launch: { ...launch, [field]: value } });
    }
  }
  rejectedPlan({ ...options, launch: { ...launch, kind: 'packaged' } });
});

test('plan-shaped forgeries cannot authorize registry writes or removals', () => {
  const plan = M.buildPlan(options);
  const registry = registryFixture();
  for (const forged of [undefined, null, {}, JSON.parse(JSON.stringify(plan)), { ...plan }, { ...plan, entries: [{ key: 'HKCU\\Software', parent: { values: {} }, command: { key: 'HKCU\\Software', values: {} } }] }]) {
    assert.throws(() => M.install(forged, registry));
    assert.throws(() => M.remove(forged, registry));
  }
  assert.equal(registry.calls.length, 0);
});

test('installation preflights every action before any write and preserves foreign registrations', () => {
  const plan = M.buildPlan(options);
  for (const conflict of ['owner', 'command', 'children', 'unknown-value']) {
    const registry = registryFixture();
    const last = plan.entries.at(-1);
    registry.seed(last.key, { ...last.parent.values });
    registry.seed(last.command.key, { ...last.command.values });
    if (conflict === 'owner') registry.nodes.get(last.key).values.TracerOwner = 'Other.Application';
    if (conflict === 'command') registry.nodes.get(last.command.key).values[''] = '"C:\\Other Tools\\app.exe"';
    if (conflict === 'children') registry.nodes.get(last.key).children.push('other-app');
    if (conflict === 'unknown-value') registry.nodes.get(last.key).values.OtherApplicationData = 'keep me';
    const before = registry.snapshot();
    assert.throws(() => M.install(plan, registry), conflict);
    assert.deepEqual(registry.snapshot(), before, conflict);
    assert.equal(registry.calls.length, 0, conflict);
  }
});

test('install and remove touch only owned action keys and remain safe when repeated', () => {
  const plan = M.buildPlan(options);
  const registry = registryFixture();
  registry.seed('HKCU\\Software\\Classes\\DesktopBackground\\Shell\\OtherApplication', { '': 'Keep other app' });
  M.install(plan, registry);
  M.install(plan, registry);
  for (const entry of plan.entries) assert.deepEqual(registry.read(entry.command.key).values, entry.command.values);
  M.remove(plan, registry);
  M.remove(plan, registry);
  assert.deepEqual(registry.read('HKCU\\Software\\Classes\\DesktopBackground\\Shell\\OtherApplication').values, { '': 'Keep other app' });
  for (const [operation, key] of registry.calls) {
    assert(['write', 'remove'].includes(operation));
    assert(plan.entries.some(entry => key === entry.key || key === entry.command.key), key);
    assert.notEqual(key, 'HKCU\\Software\\Classes\\DesktopBackground\\Shell');
    assert.notEqual(key, 'HKCU\\Software\\Classes');
  }
});

test('uninstall refuses changed ownership, command strings or additional child registrations before deleting', () => {
  const plan = M.buildPlan(options);
  for (const tamper of [
    (registry, entry) => { registry.nodes.get(entry.key).values.TracerOwner = 'Other.Application'; },
    (registry, entry) => { registry.nodes.get(entry.command.key).values[''] = '"C:\\Other Tools\\app.exe"'; },
    (registry, entry) => { registry.nodes.get(entry.key).values.TracerCommand = '"C:\\Other Tools\\app.exe"'; },
    (registry, entry) => { registry.nodes.get(entry.command.key).children.push('keep-child'); }
  ]) {
    const registry = registryFixture();
    seedPlan(registry, plan);
    tamper(registry, plan.entries.at(-1));
    const before = registry.snapshot();
    assert.throws(() => M.remove(plan, registry));
    assert.deepEqual(registry.snapshot(), before);
    assert.equal(registry.calls.length, 0);
  }
});

test('a failed install rolls back its own writes and a failed uninstall restores removed registrations', () => {
  const plan = M.buildPlan(options);
  const installRegistry = registryFixture({ failWriteAt: 4 });
  installRegistry.seed('HKCU\\Software\\Classes\\DesktopBackground\\Shell\\OtherApplication', { '': 'Preserve' });
  const beforeInstall = installRegistry.snapshot();
  assert.deepEqual(M.install(plan, installRegistry), { ok: false, error: 'local-menu-operation-failed', mode: 'install' });
  assert.deepEqual(installRegistry.snapshot(), beforeInstall);

  const removeRegistry = registryFixture({ failRemoveAt: 2 });
  seedPlan(removeRegistry, plan);
  const beforeRemove = removeRegistry.snapshot();
  assert.deepEqual(M.remove(plan, removeRegistry), { ok: false, error: 'local-menu-operation-failed', mode: 'remove' });
  assert.deepEqual(removeRegistry.snapshot(), beforeRemove);
});

test('rollback preserves a child command whose ownership changes during a failed write', () => {
  const plan = M.buildPlan(options);
  const registry = registryFixture();
  const first = plan.entries[0];
  const write = registry.write.bind(registry);
  registry.write = (key, values) => {
    write(key, values);
    if (key === first.command.key) {
      registry.nodes.get(key).values = { '': '"C:\\Other Tools\\app.exe"', TracerOwner: 'Other.Application' };
      throw Error('synthetic concurrent ownership change');
    }
  };
  assert.deepEqual(M.install(plan, registry), { ok: false, error: 'local-menu-rollback-blocked', mode: 'install' });
  assert.deepEqual(registry.read(first.command.key)?.values, { '': '"C:\\Other Tools\\app.exe"', TracerOwner: 'Other.Application' });
  assert(!registry.calls.some(([operation, key]) => operation === 'remove' && key === first.key), 'a parent deletion would recursively delete the foreign child');
});

test('cold-start commands wait for readiness and the most recent valid request wins', async t => {
  const f = routerFixture();
  t.after(() => f.router.destroy());
  assert.equal(f.router.receive(argv('release')), true);
  assert.equal(f.router.receive(argv('cancel')), true);
  assert.deepEqual(f.calls, []);
  f.router.ready();
  await Promise.resolve();
  assert.deepEqual(f.calls, ['cancel']);
  f.router.ready();
  assert.deepEqual(f.calls, ['cancel']);
});

test('normal argv is left to application routing and malformed local argv never invokes an action', async t => {
  const f = routerFixture();
  t.after(() => f.router.destroy());
  assert.equal(f.router.receive([launch.executable, launch.appPath]), false);
  assert.equal(f.router.receive(argv('unknown')), true);
  f.router.ready();
  await Promise.resolve();
  assert.deepEqual(f.calls, []);
});

test('second-instance commands dispatch only their fixed action after readiness', async t => {
  const f = routerFixture();
  t.after(() => f.router.destroy());
  f.router.ready();
  for (const action of ['release', 'cancel', 'configure']) {
    assert.equal(f.router.receive(argv(action)), true);
    await Promise.resolve();
  }
  assert.deepEqual(f.calls, ['release', 'cancel', 'configure']);
});

test('router second-instance mode queues and dispatches the exact Electron event argv', t => {
  const f = routerFixture();
  t.after(() => f.router.destroy());
  assert.equal(f.router.receive(electronArgv('configure'), true), true);
  assert.deepEqual(f.calls, []);
  f.router.ready();
  assert.deepEqual(f.calls, ['configure']);
  assert.equal(f.router.receive(electronArgv('cancel'), true), true);
  assert.deepEqual(f.calls, ['configure', 'cancel']);
});

test('router mode requires boolean true and rejects extra second-instance arguments without actions', t => {
  for (const mode of [undefined, false, null, 0, 1, 'true', {}, new Boolean(true)]) {
    const f = routerFixture();
    t.after(() => f.router.destroy());
    f.router.ready();
    assert.equal(f.router.receive(electronArgv('release'), mode), true);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.results, [{ ok: false, error: 'invalid-local-command' }]);
    if (mode !== undefined && mode !== false) {
      assert.equal(f.router.receive(argv('release'), mode), true);
      assert.deepEqual(f.calls, []);
      assert.deepEqual(f.results, [{ ok: false, error: 'invalid-local-command' }, { ok: false, error: 'invalid-local-command' }]);
    }
  }
  const f = routerFixture();
  t.after(() => f.router.destroy());
  f.router.ready();
  assert.equal(f.router.receive([...electronArgv('release'), 'https://example.test/'], true), true);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.results, [{ ok: false, error: 'invalid-local-command' }]);
});

test('commercial, packaged-local and unsupported platforms never execute local shell callbacks', async t => {
  for (const overrides of [
    { app: { isPackaged: true } }, { app: {} }, { app: { isPackaged: 0 } },
    { profile: { channel: 'commercial' } }, { profile: {} }, { platform: 'darwin' }, { platform: 'linux' }
  ]) {
    const f = routerFixture(overrides);
    t.after(() => f.router.destroy());
    f.router.receive(argv('release'));
    f.router.ready();
    f.router.receive(argv('cancel'));
    f.router.receive(argv('configure'));
    await Promise.resolve();
    assert.deepEqual(f.calls, []);
  }
});

test('destroy drops pending work and blocks future commands without invoking callbacks', async () => {
  const f = routerFixture();
  f.router.receive(argv('release'));
  f.router.destroy();
  f.router.destroy();
  f.router.ready();
  f.router.receive(argv('configure'));
  await Promise.resolve();
  assert.deepEqual(f.calls, []);
});

const settle = () => new Promise(resolve => setImmediate(resolve));

test('destroyed routers suppress delayed handler resolution, rejection and future result callbacks', async () => {
  for (const outcome of ['resolve', 'reject']) {
    let finish;
    const pending = new Promise((resolve, reject) => { finish = outcome === 'resolve' ? resolve : reject; });
    const f = routerFixture({ release: () => pending });
    f.router.ready();
    f.router.receive(argv('release'));
    f.router.destroy();
    finish(outcome === 'resolve' ? { ok: true } : Error('synthetic late failure'));
    await settle();
    f.router.receive(argv('configure'));
    assert.deepEqual(f.results, [], outcome);
    assert.deepEqual(f.calls, [], outcome);
  }
});

test('the most recent valid command suppresses older asynchronous resolution and rejection', async t => {
  for (const outcome of ['resolve', 'reject']) {
    let finish;
    const pending = new Promise((resolve, reject) => { finish = outcome === 'resolve' ? resolve : reject; });
    const f = routerFixture({ release: () => pending });
    t.after(() => f.router.destroy());
    f.router.ready();
    f.router.receive(argv('release'));
    f.router.receive(argv('cancel'));
    assert.deepEqual(f.results, [{ action: 'cancel', ok: true }]);
    finish(outcome === 'resolve' ? { ok: true } : Error('synthetic old failure'));
    await settle();
    assert.deepEqual(f.results, [{ action: 'cancel', ok: true }], outcome);
    assert.deepEqual(f.calls, ['cancel']);
  }
});

test('missing handlers and null handler failures report failure without dispatching another action', t => {
  for (const action of ['release', 'cancel', 'configure']) {
    const missing = routerFixture({ [action]: undefined });
    t.after(() => missing.router.destroy());
    missing.router.ready();
    assert.equal(missing.router.receive(argv(action)), true);
    assert.deepEqual(missing.results, [{ action, ok: false, error: 'local-command-failed' }]);
    assert.deepEqual(missing.calls, []);

    const throwing = routerFixture({ [action]: () => { throw null; } });
    t.after(() => throwing.router.destroy());
    throwing.router.ready();
    assert.doesNotThrow(() => throwing.router.receive(argv(action)));
    assert.deepEqual(throwing.results, [{ action, ok: false, error: 'local-command-failed' }]);
  }
});

test('a process that loses the instance lock does not load services, migrate, attach controllers or create windows', async () => {
  const f = mainFixture({ lock: false, argv: argv('release') });
  await f.appReady();
  f.app.emit('second-instance', {}, argv('configure'));
  assert.deepEqual(f.calls, ['quit']);
  assert.equal(f.windows.length, 0);
  assert.equal(f.app.listenerCount('second-instance'), 0);
  assert(!f.required.includes('../server.js'));
  assert(!f.required.includes('../lib/ai-gateway'));
  assert(!f.required.includes('./local-vfx'));
  assert(!f.required.includes('./local-vfx-shell-router'));
  assert.equal(f.attachments.length, 0);
});

test('main queues cold-start and early second-instance commands until server and renderer readiness', async () => {
  const f = mainFixture({ argv: argv('release') });
  f.app.emit('second-instance', {}, argv('cancel'));
  assert.equal(f.windows.length, 0);
  assert.deepEqual(f.calls, []);
  await f.appReady();
  assert.equal(f.windows.length, 0);
  f.serverReady();
  assert.equal(f.windows.length, 1);
  assert.equal(f.attachments[0].visualsReady, true);
  assert(!f.calls.includes('release'));
  assert(!f.calls.includes('cancel'));
  f.rendererReady();
  assert.deepEqual(f.calls.filter(call => ['release', 'cancel', 'show', 'focus'].includes(call)), ['cancel']);
});

test('main preserves the last valid queued command when ordinary or malformed argv arrives during startup', async () => {
  for (const phase of ['before-app-ready', 'before-server-ready', 'before-renderer-ready']) {
    for (const later of [[launch.executable, launch.appPath], argv('unknown'), argv('cancel')]) {
      const f = mainFixture();
      if (phase !== 'before-app-ready') await f.appReady();
      if (phase === 'before-renderer-ready') f.serverReady();
      f.app.emit('second-instance', {}, argv('release'));
      f.app.emit('second-instance', {}, later);
      assert(!f.calls.includes('release'));
      assert(!f.calls.includes('cancel'));
      if (phase === 'before-app-ready') await f.appReady();
      if (phase !== 'before-renderer-ready') f.serverReady();
      f.rendererReady();
      const expected = later[2] === '--tracer-local-action=cancel' ? 'cancel' : 'release';
      assert.deepEqual(f.calls.filter(call => ['release', 'cancel'].includes(call)), [expected], phase + ': ' + later.join(' '));
      assert.equal(f.windows.length, 1);
    }
  }
});

test('main sends existing-instance release and cancel without show/focus and consumes malformed local commands', async () => {
  const f = mainFixture();
  await f.appReady();
  f.serverReady();
  f.rendererReady();
  f.app.emit('second-instance', {}, argv('release'));
  f.app.emit('second-instance', {}, argv('cancel'));
  f.app.emit('second-instance', {}, [...argv('release'), 'https://example.test/']);
  assert.deepEqual(f.calls.filter(call => ['release', 'cancel', 'show', 'focus'].includes(call)), ['release', 'cancel']);
  f.app.emit('second-instance', {}, electronArgv('configure'));
  assert.deepEqual(f.calls.filter(call => ['show', 'focus'].includes(call)), ['show', 'focus']);
  assert.equal(f.windows.length, 1);
});

test('main normalizes actual Electron second-instance argv while app, server or renderer readiness is pending', async () => {
  for (const phase of ['before-app-ready', 'before-server-ready', 'before-renderer-ready']) {
    const f = mainFixture();
    if (phase !== 'before-app-ready') await f.appReady();
    if (phase === 'before-renderer-ready') f.serverReady();
    f.app.emit('second-instance', {}, electronArgv('configure'));
    assert(!f.calls.some(call => Array.isArray(call) && call[0] === 'configure'));
    if (phase === 'before-app-ready') await f.appReady();
    if (phase !== 'before-renderer-ready') f.serverReady();
    f.rendererReady();
    assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'configure').length, 1, phase);
    assert.equal(f.windows.length, 1, phase);
  }
});

test('main routes an unavailable effect to configuration while the reviewed Haunt renderer is connected', async () => {
  const f = mainFixture({ argv: argv('release'), releaseError: 'local-vfx-assets-pending' });
  await f.appReady();
  f.serverReady();
  f.rendererReady();
  assert.equal(f.attachments[0].visualsReady, true);
  assert.equal(f.windows.length, 1);
  assert(f.calls.some(call => Array.isArray(call) && call[0] === 'configure' && call[1] === 'local-vfx-assets-pending'));
  assert.deepEqual(f.calls.filter(call => ['release', 'show', 'focus'].includes(call)), ['release', 'show', 'focus']);
});

test('a local configure command recreates a destroyed main window and dispatches after its renderer is ready', async () => {
  const f = mainFixture();
  await f.appReady();
  f.serverReady();
  f.rendererReady();
  f.windows[0].destroy();
  f.app.emit('second-instance', {}, electronArgv('configure'));
  assert.equal(f.windows.length, 2);
  assert(!f.calls.some(call => Array.isArray(call) && call[0] === 'configure'));
  f.rendererReady(1);
  assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'configure').length, 1);
});

test('ordinary reopening after main-window destruction cannot replay the original startup command', async () => {
  const f = mainFixture({ argv: argv('release') });
  await f.appReady();
  f.serverReady();
  f.rendererReady();
  assert.equal(f.calls.filter(call => call === 'release').length, 1);
  f.windows[0].destroy();
  f.app.emit('second-instance', {}, [launch.executable, launch.appPath]);
  assert.equal(f.windows.length, 2);
  f.rendererReady(1);
  assert.equal(f.calls.filter(call => call === 'release').length, 1);
});

test('quitting blocks second-instance actions and prevents a destroyed main window from being recreated', async () => {
  const f = mainFixture();
  await f.appReady();
  f.serverReady();
  f.rendererReady();
  f.app.emit('before-quit');
  const before = f.calls.slice();
  for (const args of [electronArgv('release'), electronArgv('cancel'), electronArgv('configure'), [launch.executable, launch.appPath]]) {
    f.app.emit('second-instance', {}, args);
  }
  assert.deepEqual(f.calls, before);
  f.windows[0].destroy();
  f.app.emit('second-instance', {}, electronArgv('configure'));
  f.app.emit('second-instance', {}, [launch.executable, launch.appPath]);
  assert.equal(f.windows.length, 1);
  assert.deepEqual(f.calls, before);
});

test('a late server-listen callback cannot launch windows once quitting begins', async () => {
  const f = mainFixture({ argv: argv('release') });
  await f.appReady();
  f.app.emit('before-quit');
  f.serverReady();
  assert.equal(f.windows.length, 0);
  assert.equal(f.attachments.length, 0);
  assert(!f.calls.includes('release'));
});

test('late renderer readiness waits through quitting and resumes only when the page cancels exit', async () => {
  const f = mainFixture({ argv: argv('release') });
  await f.appReady();
  f.serverReady();
  f.app.emit('before-quit');
  f.rendererReady();
  assert(!f.calls.includes('release'));
  let prevented = 0;
  f.windows[0].webContents.emit('will-prevent-unload', { preventDefault() { prevented++; } });
  assert.equal(prevented, 0, 'respect the renderer veto instead of overriding it');
  assert.equal(f.calls.filter(call => call === 'release').length, 1);
  f.rendererReady();
  assert.equal(f.calls.filter(call => call === 'release').length, 1);
});

test('a canceled quit before the first renderer load cannot dispatch until that load finishes', async () => {
  const f = mainFixture({ argv: argv('release') });
  await f.appReady();
  f.serverReady();
  f.app.emit('before-quit');
  let prevented = 0;
  f.windows[0].webContents.emit('will-prevent-unload', { preventDefault() { prevented++; } });
  assert.equal(prevented, 0, 'respect the renderer veto instead of overriding it');
  assert(!f.calls.includes('release'), 'canceling exit does not establish renderer readiness');
  assert(!f.calls.some(call => ['show', 'focus'].includes(call)));
  f.rendererReady();
  assert.equal(f.calls.filter(call => call === 'release').length, 1);
  f.rendererReady();
  assert.equal(f.calls.filter(call => call === 'release').length, 1);
});

test('a canceled quit restores configure and ordinary show routing without overriding the page veto', async () => {
  const f = mainFixture();
  await f.appReady();
  f.serverReady();
  f.rendererReady();
  f.app.emit('before-quit');
  f.app.emit('second-instance', {}, electronArgv('configure'));
  assert(!f.calls.some(call => Array.isArray(call) && call[0] === 'configure'));
  let prevented = 0;
  f.windows[0].webContents.emit('will-prevent-unload', { preventDefault() { prevented++; } });
  assert.equal(prevented, 0);
  f.app.emit('second-instance', {}, electronArgv('configure'));
  f.app.emit('second-instance', {}, [launch.executable, launch.appPath]);
  assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'configure').length, 1);
  assert.deepEqual(f.calls.filter(call => ['show', 'focus'].includes(call)), ['show', 'focus', 'show', 'focus']);
  assert.equal(f.windows.length, 1);
});

test('main never imports local controller, parser or shell modules for commercial or uncertain release gates', async () => {
  for (const gate of [
    { isPackaged: true, channel: 'commercial' }, { isPackaged: false, channel: 'commercial' },
    { isPackaged: true, channel: 'local' }, { isPackaged: undefined, channel: 'local' },
    { isPackaged: 0, channel: 'local' }, { isPackaged: 'false', channel: 'local' },
    { isPackaged: false, channel: undefined }, { isPackaged: false, channel: 'LOCAL' }
  ]) {
    const f = mainFixture({ ...gate, argv: argv('release'), forbidLocal: true });
    await f.appReady();
    f.serverReady();
    f.rendererReady();
    f.app.emit('second-instance', {}, electronArgv('release'));
    assert(!f.required.some(id => /local-(?:vfx|shell)/.test(id)));
    assert(!f.calls.includes('release'));
    assert.equal(f.attachments.length, 0);
  }
});

test('source launch paths with trailing separators are rejected before command quoting', () => {
  for (const appPath of [launch.appPath + '\\', launch.appPath + '/', 'C:\\']) {
    assert.throws(() => M.buildPlan({ ...options, launch: { ...launch, appPath } }), /local-menu-invalid-path/);
    assert.equal(M.parseArgv([launch.executable, appPath, '--tracer-local-action=configure'], { ...launch, appPath }).kind, 'invalid');
  }
});


test('main Shell Release begins one-shot placement without an original context-menu point or cursor fallback', async () => {
  const f=mainFixture({argv:argv('release')});await f.appReady();f.serverReady();f.rendererReady();
  assert.equal(f.attachments[0].visualsReady,true);assert.equal(f.attachments[0].getOrigin(),null);
  assert.deepEqual(f.calls.filter(call=>['release','show','focus'].includes(call)),['release']);
  assert(!f.calls.some(call=>Array.isArray(call)&&call[0]==='configure'));
});

test('router preserves known asset and missing-origin failures instead of reporting a successful release',t=>{
 for(const error of ['local-vfx-assets-failed','local-vfx-invoke-point-unavailable','local-vfx-placement-unavailable']){
  const f=routerFixture({release(){throw Error(error);}});t.after(()=>f.router.destroy());
  f.router.ready();f.router.receive(argv('release'));
  assert.deepEqual(f.results,[{action:'release',ok:false,error}]);
 }
});
