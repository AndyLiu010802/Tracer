'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../desktop/local-vfx-shell-model');
const launch = M.fixedSourceLaunch();
const base = { app: { isPackaged: false }, profile: { channel: 'local' }, platform: 'win32' };
const argv = (action, target = launch) => [target.executable, target.appPath, M.PREFIX + action];
const invalid = { kind: 'invalid', error: 'invalid-local-command' };

function registry() {
  const nodes = new Map(), calls = [];
  return {
    nodes, calls,
    read(key) {
      const node = nodes.get(key);
      if (!node) return null;
      const children = new Set(node.children || []);
      for (const candidate of nodes.keys()) if (candidate.startsWith(key + '\\')) children.add(candidate.slice(key.length + 1).split('\\')[0]);
      return { values: { ...node.values }, children: [...children] };
    },
    write(key, values) { calls.push(['write', key]); nodes.set(key, { values: { ...values }, children: [] }); },
    remove(key) { assert.equal(this.read(key)?.children.length, 0); calls.push(['remove', key]); nodes.delete(key); },
    seed(plan) { for (const entry of plan.entries) { nodes.set(entry.key, { values: { ...entry.parent.values }, children: [] }); nodes.set(entry.command.key, { values: { ...entry.command.values }, children: [] }); } }
  };
}

test('the public launch helper and default plan derive their immutable target from the project directory', () => {
  const appPath = path.resolve(__dirname, '..');
  assert.deepEqual(launch, { kind: 'source', executable: path.join(appPath, 'node_modules', 'electron', 'dist', 'electron.exe'), appPath });
  assert.equal(Object.isFrozen(launch), true);
  assert.deepEqual(M.fixedSourceLaunch({ appPath: 'C:\\foreign', executable: 'C:\\foreign\\tool.exe' }), launch);
  assert.deepEqual(M.buildPlan(base).launch, launch);
  assert.deepEqual(M.buildPlan({ ...base, launch }).launch, launch);
  for (const entry of M.buildPlan(base).entries) {
    assert.equal(entry.command.values[''], '"' + launch.executable + '" "' + launch.appPath + '" "' + M.PREFIX + entry.action + '"');
    assert.equal(entry.parent.values.TracerCommand, entry.command.values['']);
  }
});

for (const [name, supplied] of [
  ['arbitrary safe executable', { ...launch, executable: 'C:\\Safe Program\\safe.exe' }],
  ['another Electron installation', { ...launch, executable: 'C:\\Other Project\\node_modules\\electron\\dist\\electron.exe' }],
  ['arbitrary safe application', { ...launch, appPath: 'C:\\Other Application' }],
  ['switch appended to executable', { ...launch, executable: launch.executable + ' --inspect' }],
  ['switch appended to application', { ...launch, appPath: launch.appPath + ' --inspect' }],
  ['executable argument injection', { ...launch, executable: launch.executable + '" "--eval=process.exit()' }],
  ['app argument injection', { ...launch, appPath: launch.appPath + '" "--user-data-dir=C:\\Other' }],
  ['an extra source launch property', { ...launch, args: ['--inspect'] }],
  ['a packaged launch kind', { ...launch, kind: 'packaged' }],
  ['a missing launch kind', { executable: launch.executable, appPath: launch.appPath }],
  ['null launch', null],
]) {
  test('a registration plan refuses ' + name, () => {
    assert.throws(() => M.buildPlan({ ...base, launch: supplied }), /local-menu-(?:fixed-launch-required|invalid-path|source-only)/);
  });
}

for (const value of ['\0', '\n', '\r', '\t', '\x1f', '\x7f', '"', '%TEMP%', '<', '>', '|', '?', '*', ':stream']) {
  test('unsafe path input cannot mint a command: ' + JSON.stringify(value), () => {
    for (const field of ['executable', 'appPath']) {
      const supplied = { ...launch, [field]: 'C:\\unsafe' + value + (field === 'executable' ? '\\electron.exe' : '\\app') };
      assert.throws(() => M.buildPlan({ ...base, launch: supplied }), /local-menu-invalid-path/);
      assert.deepEqual(M.parseArgv(argv('release', supplied), supplied), invalid);
    }
  });
}

test('an unsafe project directory also fails closed rather than quoting unsafe fixed targets', () => {
  const filename = path.resolve(__dirname, '../desktop/local-vfx-shell-model.js');
  const source = fs.readFileSync(filename, 'utf8');
  for (const dirname of ['C:\\%TEMP%\\desktop', 'C:\\bad"dir\\desktop', 'C:\\bad\ndir\\desktop', 'C:\\bad\x7fdir\\desktop']) {
    const module = { exports: {} };
    vm.runInNewContext(source, { require(id) { assert.equal(id, 'node:path'); return path; }, __dirname: dirname, module, exports: module.exports }, { filename });
    assert.throws(() => module.exports.fixedSourceLaunch(), /local-menu-invalid-path/);
    assert.throws(() => module.exports.buildPlan(base), /local-menu-invalid-path/);
  }
});

test('a parser requires trusted source metadata and only exact actions and internal transport flags', () => {
  for (const candidate of [undefined, null, { ...launch, kind: 'packaged' }, { executable: launch.executable, appPath: launch.appPath }]) {
    assert.deepEqual(M.parseArgv(argv('release'), candidate), invalid);
  }
  for (const action of ['release ', 'release%20', 'release\x7f', 'release --inspect', 'release&calc.exe', 'cancel;exit', 'configure\n--eval', 'Configure']) {
    assert.deepEqual(M.parseArgv(argv(action), launch), invalid);
    assert.deepEqual(M.parseArgv([launch.executable, M.PREFIX + action, '--allow-file-access-from-files', launch.appPath], launch, true), invalid);
  }
  for (const arg of ['--inspect', '--eval=process.exit()', '--allow-file-access-from-files=true', '--user-data-dir=C:\\Other', '--tracer-local-action=cancel']) {
    assert.deepEqual(M.parseArgv([...argv('release'), arg], launch), invalid);
    assert.deepEqual(M.parseArgv([launch.executable, M.PREFIX + 'release', launch.appPath, arg], launch, true), invalid);
  }
});

for (const field of ['parent owner', 'child owner', 'parent command', 'child command']) {
  test('full ownership preflight refuses an altered ' + field + ' for both install and removal', () => {
    const plan = M.buildPlan(base), r = registry(); r.seed(plan);
    const entry = plan.entries.at(-1), key = field.startsWith('parent') ? entry.key : entry.command.key;
    const name = field.endsWith('owner') ? 'TracerOwner' : field.startsWith('parent') ? 'TracerCommand' : '';
    r.nodes.get(key).values[name] = field.endsWith('owner') ? 'Other.Application' : entry.command.values[''] + ' --inspect';
    const before = JSON.stringify([...r.nodes]);
    for (const method of ['install', 'remove']) assert.throws(() => M[method](plan, r), /local-menu-conflict/);
    assert.equal(JSON.stringify([...r.nodes]), before);
    assert.equal(r.calls.length, 0);
  });
}

for (let failed = 1; failed <= 6; failed++) {
  for (const method of ['install', 'remove']) {
    test('pure model ' + method + ' rollback restores its initial state at step ' + failed, () => {
      const plan = M.buildPlan(base), r = registry();
      if (method === 'remove') r.seed(plan);
      const before = JSON.stringify([...r.nodes].sort(([a], [b]) => a.localeCompare(b)));
      let count = 0, didFail = false;
      const mutation = method === 'install' ? 'write' : 'remove', original = r[mutation].bind(r);
      r[mutation] = (...args) => { if (++count === failed && !didFail) { didFail = true; throw Error('mock unit failure'); } return original(...args); };
      assert.deepEqual(M[method](plan, r), { ok: false, error: 'local-menu-operation-failed', mode: method });
      assert.equal(JSON.stringify([...r.nodes].sort(([a], [b]) => a.localeCompare(b))), before);
    });
  }
}

test('rollback retains a competing command even when it copies the same owner marker', () => {
  const plan = M.buildPlan(base), r = registry(), first = plan.entries[0], original = r.write.bind(r);
  r.write = (key, values) => {
    original(key, values);
    if (key === first.command.key) {
      r.nodes.get(key).values[''] += ' --inspect';
      throw Error('mock competing command');
    }
  };
  assert.deepEqual(M.install(plan, r), { ok: false, error: 'local-menu-rollback-blocked', mode: 'install' });
  assert.equal(r.read(first.command.key).values.TracerOwner, M.OWNER);
  assert.equal(r.read(first.command.key).values[''], first.command.values[''] + ' --inspect');
  assert.equal(r.calls.some(([action, key]) => action === 'remove' && [first.key, first.command.key].includes(key)), false);
});
