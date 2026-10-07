'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const P = require('../desktop/local-vfx-shell-parents');
const { createRegistration } = require('../desktop/local-vfx-shell-registry.js');
const M = require('../desktop/local-vfx-shell-model.js');

const launch = M.fixedSourceLaunch();
const base = { app: { isPackaged: false }, profile: { channel: 'local' }, platform: 'win32', launch };
const plan = M.buildPlan(base);
const allowedKeys = new Set(plan.entries.flatMap(e => [e.key, e.command.key]));
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const typed = values => Object.entries(values).map(([name, data]) => ({ name, kind: 'String', data }));
const equal = (a, b) => { const normalize = value => value && Array.isArray(value.values) && Array.isArray(value.children) ? { values: [...value.values].sort((x, y) => x.name.localeCompare(y.name)), children: [...value.children].sort() } : value; return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b)); };

function harness(options = {}) {
  const nodes = new Map();
  const calls = [];
  let mutations = 0;
  let responseOverride = options.responseOverride;
  const seed = (key, values, children = []) => nodes.set(key, { values: typed(values), extraChildren: [...children] });
  const snapshot = key => {
    const node = nodes.get(key);
    if (!node) return null;
    const children = new Set(node.extraChildren);
    for (const candidate of nodes.keys()) {
      if (candidate.startsWith(key + '\\')) children.add(candidate.slice(key.length + 1).split('\\')[0]);
    }
    return { values: clone(node.values), children: [...children].sort() };
  };
  const reply = obj => ({ status: 0, stdout: JSON.stringify(obj), stderr: '' });
  const execute = (executable, args, opts) => {
    const payload = JSON.parse(opts.input);
    calls.push({ executable, args: [...args], opts: { ...opts }, payload: clone(payload) });
    assert.equal(path.win32.isAbsolute(executable), true);
    assert.match(executable.replaceAll('/', '\\'), /\\WindowsPowerShell\\v1\.0\\powershell\.exe$/i);
    assert.equal(opts.shell, false);
    assert.equal(opts.windowsHide, true);
    assert.equal(opts.timeout, 5000);
    assert.equal(opts.maxBuffer, 1048576);
    assert.equal(opts.encoding, 'utf8');
    assert.ok(Array.isArray(args) && args.every(a => typeof a === 'string'));
    assert.ok(!args.some(a => /^-(command|encodedcommand|c|ec)$/i.test(a)));
    assert.ok(args.some(a => /^-file$/i.test(a)));
    assert.equal(payload.version, 1);
    assert.ok(allowedKeys.has(payload.key) || (options.userData && P.PARENTS.includes(payload.key)), 'adapter attempted a key outside its fixed eight keys');
    assert.ok(['read', 'write', 'remove', 'parent-read', 'parent-create', 'parent-remove'].includes(payload.action));
    assert.deepEqual(payload.launch, launch);
    if (responseOverride) return responseOverride(payload);
    if (payload.action.startsWith('parent-')) {
      const actual = snapshot(payload.key);
      const marker = actual?.values.find(value => value.name === P.MARKER);
      const owned = typeof payload.token === 'string' && marker?.kind === 'String' && marker.data === payload.token;
      if (payload.action === 'parent-read') return reply({ ok: true, present: actual !== null, node: actual === null ? null : { valueCount: actual.values.length - Number(owned), childCount: actual.children.length, owned } });
      mutations++;
      if (options.failMutation === mutations) return reply({ ok: false, error: 'registry-operation-failed' });
      if (options.baseMissing) return reply({ ok: false, error: 'registry-parent-missing' });
      if (payload.action === 'parent-create') {
        if (actual) return reply({ ok: true, created: false, disposition: 'opened-existing' });
        seed(payload.key, { [P.MARKER]: payload.token });
        return reply({ ok: true, created: true, disposition: 'created-new' });
      }
      if (!actual) return reply({ ok: true, removed: false, reason: 'missing' });
      if (!owned) return reply({ ok: true, removed: false, reason: 'conflict' });
      if (actual.values.length !== 1 || actual.children.length) return reply({ ok: true, removed: false, reason: 'not-empty' });
      nodes.delete(payload.key); return reply({ ok: true, removed: true });
    }
    if (payload.action === 'read') {
      const node = snapshot(payload.key);
      return reply(node ? { ok: true, present: true, node } : { ok: true, present: false });
    }
    mutations++;
    if (options.race && options.race.action === payload.action && options.race.key === payload.key && !options.race.done) {
      options.race.done = true;
      seed(payload.key, { Intruder: 'must remain' });
    }
    if (!equal(snapshot(payload.key), payload.expected)) return reply({ ok: false, error: 'local-menu-conflict' });
    if (options.failMutation === mutations) return reply({ ok: false, error: 'registry-operation-failed' });
    if (options.failAction === payload.action && options.failKey === payload.key && !options.failed) {
      options.failed = true;
      // The native helper's unit-of-mutation rollback is represented as an
      // unchanged node. No fake test invokes PowerShell or the registry.
      return reply({ ok: false, error: 'registry-operation-failed' });
    }
    if (options.reportOnly && options.reportOnly.action === payload.action && options.reportOnly.key === payload.key && !options.reportOnly.done) {
      options.reportOnly.done = true;
      return payload.action === 'write'
        ? reply({ ok: true, present: true, node: { values: clone(payload.values), children: snapshot(payload.key)?.children || [] } })
        : reply({ ok: true, present: false });
    }
    if (payload.action === 'write') {
      assert.ok(Array.isArray(payload.values));
      nodes.set(payload.key, { values: clone(payload.values), extraChildren: snapshot(payload.key)?.children.filter(child => !nodes.has(payload.key + '\\' + child)) || [] });
    } else {
      if (snapshot(payload.key)?.children.length) return reply({ ok: false, error: 'local-menu-conflict' });
      nodes.delete(payload.key);
    }
    const actual = snapshot(payload.key);
    return reply(actual ? { ok: true, present: true, node: actual } : { ok: true, present: false });
  };
  const registration = () => createRegistration({ ...base, execute, ...(options.userData ? { userData: options.userData } : {}) });
  return {
    nodes, calls, execute, registration, snapshot, seed,
    mutationCount: () => mutations,
    override: fn => { responseOverride = fn; },
    seedInstalled: () => {
      for (const entry of plan.entries) {
        seed(entry.key, entry.parent.values);
        seed(entry.command.key, entry.command.values);
      }
    },
  };
}

test('registration exposes the fixed plan and supports install, status, and remove only', () => {
  const h = harness();
  const r = h.registration();
  assert.deepEqual(r.plan.launch, launch);
  assert.deepEqual(r.plan.entries.map(e => e.key), plan.entries.map(e => e.key));
  assert.equal(typeof r.install, 'function');
  assert.equal(typeof r.status, 'function');
  assert.equal(typeof r.remove, 'function');
  assert.equal(r.write, undefined);
  assert.equal(r.read, undefined);
  assert.equal(r.execute, undefined);
  assert.equal(r.install().ok, true);
  assert.equal(h.nodes.size, 6);
  assert.equal(r.install().changed, 0);
  const mutationsBeforeStatus = h.mutationCount();
  r.status();
  assert.equal(h.mutationCount(), mutationsBeforeStatus);
  assert.equal(r.remove().ok, true);
  assert.equal(h.nodes.size, 0);
  assert.equal(r.remove().changed, 0);
});

test('trusted source metadata is sent through JSON stdin and never interpolated into PowerShell arguments', () => {
  const h = harness();
  h.registration().install();
  assert.ok(h.calls.length > 0);
  for (const call of h.calls) {
    // The helper file naturally lives beneath the fixed app root. Payload
    // metadata is still JSON stdin, never a PowerShell command argument.
    assert.ok(!call.args.slice(0, -1).some(arg => arg.includes(launch.executable) || arg.includes(launch.appPath) || arg.includes(M.ROOT)));
    assert.ok(call.args.some(arg => /local-vfx-shell-registry\.ps1$/i.test(arg)));
  }
  const writes = h.calls.filter(call => call.payload.action === 'write');
  assert.equal(writes.length, 6);
  for (const { payload } of writes) {
    const entry = plan.entries.find(e => e.key === payload.key || e.command.key === payload.key);
    assert.deepEqual(payload.values, typed(payload.key === entry.key ? entry.parent.values : entry.command.values));
    assert.equal(payload.expected, null);
  }
});

for (const [name, change] of [
  ['commercial profile', { profile: { channel: 'commercial' } }],
  ['packaged application', { app: { isPackaged: true } }],
  ['missing explicit unpackaged flag', { app: {} }],
  ['non-Windows platform', { platform: 'darwin' }],
  ['packaged-style launch', { launch: { ...launch, kind: 'packaged' } }],
  ['UNC executable', { launch: { ...launch, executable: '\\\\server\\share\\electron.exe' } }],
  ['executable containing a quote', { launch: { ...launch, executable: 'C:\\safe"\\electron.exe' } }],
  ['app path containing an expansion marker', { launch: { ...launch, appPath: 'C:\\%TEMP%\\app' } }],
  ['app path containing a newline', { launch: { ...launch, appPath: 'C:\\app\ninjected' } }],
]) {
  test('rejects ' + name + ' before calling the executor', () => {
    let calls = 0;
    assert.throws(() => createRegistration({ ...base, ...change, execute: () => { calls++; } }));
    assert.equal(calls, 0);
  });
}

for (const execute of [undefined, null, false, {}, Promise.resolve()]) {
  test('requires a synchronous executor function: ' + String(execute), () => {
    assert.throws(() => createRegistration({ ...base, execute }));
  });
}

for (const key of allowedKeys) {
  test('preflights a third-party value at ' + key.split('\\').slice(-2).join('\\') + ' without changing any key', () => {
    const h = harness();
    h.seed(key, { ForeignOwner: 'do not overwrite' });
    const before = [...h.nodes.entries()].map(clone);
    assert.throws(() => h.registration().install(), /conflict/);
    assert.deepEqual([...h.nodes.entries()], before);
    assert.equal(h.mutationCount(), 0);
  });
}

test('an owned-looking entry with an unknown value is not accepted', () => {
  const h = harness();
  h.seedInstalled();
  const entry = plan.entries[1];
  h.nodes.get(entry.key).values.push({ name: 'Foreign', kind: 'String', data: 'private extension' });
  assert.throws(() => h.registration().remove(), /conflict/);
  assert.equal(h.mutationCount(), 0);
});

test('an owned-looking entry with an unknown child is not accepted', () => {
  const h = harness();
  h.seedInstalled();
  h.nodes.get(plan.entries[0].key).extraChildren.push('foreign-child');
  assert.throws(() => h.registration().install(), /conflict/);
  assert.equal(h.mutationCount(), 0);
});

test('an equal-looking non-String value is not accepted as ownership', () => {
  const h = harness();
  h.seedInstalled();
  h.nodes.get(plan.entries[2].key).values.find(value => value.name === 'TracerOwner').kind = 'ExpandString';
  assert.throws(() => h.registration().remove(), /conflict|format|response|registry/);
  assert.equal(h.mutationCount(), 0);
});

for (let failure = 1; failure <= 6; failure++) {
  test('installation failure at mutation ' + failure + ' rolls back all newly installed keys', () => {
    const h = harness({ failMutation: failure });
    const result = h.registration().install();
    assert.equal(result.ok, false);
    assert.equal(h.nodes.size, 0);
  });
  test('uninstallation failure at mutation ' + failure + ' restores the exact owned keys', () => {
    const h = harness({ failMutation: failure });
    h.seedInstalled();
    const before = [...h.nodes.keys()].sort().map(key => [key, h.snapshot(key)]);
    const result = h.registration().remove();
    assert.equal(result.ok, false);
    assert.deepEqual([...h.nodes.keys()].sort().map(key => [key, h.snapshot(key)]), before);
  });
}

test('a write-time race never overwrites or removes a new third-party node', () => {
  const key = plan.entries[1].key;
  const h = harness({ race: { action: 'write', key } });
  const result = h.registration().install();
  assert.equal(result.ok, false);
  assert.match(result.error, /conflict|rollback/);
  assert.deepEqual(h.snapshot(key), { values: [{ name: 'Intruder', kind: 'String', data: 'must remain' }], children: [] });
  assert.deepEqual([...h.nodes.keys()], [key]);
});

test('an uninstall-time race never removes a replacement third-party node', () => {
  const key = plan.entries[0].command.key;
  const h = harness({ race: { action: 'remove', key } });
  h.seedInstalled();
  const result = h.registration().remove();
  assert.equal(result.ok, false);
  assert.match(result.error, /conflict|rollback/);
  assert.equal(h.snapshot(key).values.find(value => value.name === 'Intruder').data, 'must remain');
  assert.equal(h.nodes.size, 6);
});

for (const [name, response] of [
  ['malformed JSON', { status: 0, stdout: 'not JSON', stderr: '' }],
  ['missing success envelope', { status: 0, stdout: '{}', stderr: '' }],
  ['nonzero process status', { status: 1, stdout: '{"ok":true,"present":false}', stderr: 'not echoed' }],
  ['missing node for a present read', { status: 0, stdout: '{"ok":true,"present":true}', stderr: '' }],
  ['false present plus a node', { status: 0, stdout: '{"ok":true,"present":false,"node":{"values":[],"children":[]}}', stderr: '' }],
  ['unknown helper error', { status: 0, stdout: '{"ok":false,"error":"sensitive untrusted error"}', stderr: '' }],
  ['Promise executor response', Promise.resolve({ status: 0, stdout: '{"ok":true,"present":false}', stderr: '' })],
  ['unknown value type', { status: 0, stdout: '{"ok":true,"present":true,"node":{"values":[{"name":"TracerOwner","kind":"DWord","data":1}],"children":[]}}', stderr: '' }],
  ['unbounded stdout', { status: 0, stdout: ' '.repeat(1048577), stderr: '' }],
]) {
  test('rejects ' + name + ' without mutating anything or leaking untrusted diagnostics', () => {
    const h = harness({ responseOverride: () => response });
    const sensitive = 'sensitive untrusted error';
    assert.throws(() => h.registration().install(), error => {
      assert.ok(!error.message.includes(sensitive));
      assert.ok(!error.message.includes('not echoed'));
      return true;
    });
    assert.equal(h.mutationCount(), 0);
  });
}

test('executor exceptions are sanitized instead of copying stderr or arbitrary messages', () => {
  const h = harness();
  h.override(() => { throw Error('provider secret fake diagnostic'); });
  assert.throws(() => h.registration().install(), error => {
    assert.ok(!error.message.includes('provider secret'));
    return true;
  });
  assert.equal(h.mutationCount(), 0);
});

test('caller launch mutation cannot redirect an already minted registration', () => {
  const h = harness();
  const mutableLaunch = { ...launch };
  const r = createRegistration({ ...base, launch: mutableLaunch, execute: h.execute });
  mutableLaunch.executable = 'C:\\Other Program\\other.exe';
  mutableLaunch.appPath = 'C:\\Elsewhere';
  assert.equal(r.install().ok, true);
  assert.ok(h.calls.every(call => equal(call.payload.launch, launch)));
});

function withUserData(t, options = {}) {
  const userData = fs.mkdtempSync(path.join(process.env.TRACER_ISOLATED_TEST_ROOT || os.tmpdir(), 'tracer-registration-'));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  return { ...harness({ ...options, userData }), userData };
}
test('complete registration creates exactly eight keys and has reversible persisted removal', t => {
  const h = withUserData(t), r = h.registration();
  assert.equal(r.status().registered, false); assert.equal(r.status().parentsPending, false); assert.deepEqual(fs.readdirSync(h.userData), []);
  assert.equal(r.install().ok, true); assert.equal(h.nodes.size, 8);
  const before = JSON.parse(fs.readFileSync(path.join(h.userData, P.FILE), 'utf8'));
  assert.deepEqual(before.claims.map(claim => claim.key), P.PARENTS);
  assert.equal(h.registration().install().changed, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(h.userData, P.FILE), 'utf8')), before);
  assert.equal(h.registration().status().parentsPending, true);
  const result = h.registration().remove(); assert.equal(result.ok, true); assert.equal(result.parents.complete, true);
  assert.deepEqual(result.parents.removed, [...P.PARENTS].reverse()); assert.equal(h.nodes.size, 0);
  assert.equal(h.registration().status().parentsPending, false); assert.equal(h.registration().remove().changed, 0);
});
test('complete install never claims preexisting shared parents or their private values', t => {
  const h = withUserData(t); h.seed(P.PARENTS[0], { Private: 'retain' }); h.seed(P.PARENTS[1], { Other: 'retain' }, ['third-party']);
  assert.equal(h.registration().install().ok, true); assert.equal(h.nodes.size, 8);
  assert.equal(h.registration().remove().ok, true); assert.equal(h.nodes.size, 2);
  assert.deepEqual(h.snapshot(P.PARENTS[1]), { values: typed({ Other: 'retain' }), children: ['third-party'] });
});
test('foreign content added after creation retains shared parents and leaves cleanup callable', t => {
  const h = withUserData(t); h.registration().install();
  h.nodes.get(P.PARENTS[1]).values.push({ name: 'Other', kind: 'String', data: 'retain' });
  const result = h.registration().remove(); assert.equal(result.ok, true); assert.equal(result.parents.complete, false); assert.equal(h.nodes.size, 2);
  const status = h.registration().status(); assert.equal(status.registered, false); assert.equal(status.parentsPending, true);
  h.nodes.get(P.PARENTS[1]).values = h.nodes.get(P.PARENTS[1]).values.filter(value => value.name !== 'Other');
  assert.equal(h.registration().remove().parents.complete, true); assert.equal(h.nodes.size, 0);
});
for (let failure = 3; failure <= 8; failure++) {
  test('complete install rolls back ancestors and owned keys at leaf mutation ' + failure, t => {
    const h = withUserData(t, { failMutation: failure }), result = h.registration().install();
    assert.equal(result.ok, false); assert.equal(h.nodes.size, 0); assert.equal(h.registration().status().parentsPending, false);
  });
}
test('complete registration preflights owned conflict before any parent mutation or receipt save', t => {
  const h = withUserData(t); h.seed(plan.entries[0].key, { ThirdParty: 'retain' });
  const result = h.registration().install(); assert.equal(result.ok, false); assert.equal(result.error, 'local-menu-conflict'); assert.equal(h.mutationCount(), 0);
  assert.deepEqual(fs.readdirSync(h.userData), []); assert.equal(h.nodes.size, 1);
});
test('missing Software Classes fails closed and is never implicitly created', t => {
  const h = withUserData(t, { baseMissing: true }), result = h.registration().install();
  assert.equal(result.ok, false); assert.equal(h.nodes.size, 0); assert.ok(h.calls.filter(call => call.payload.action !== 'parent-read').every(call => call.payload.key !== P.BASE));
});
test('competing receipt lock prevents install before registry mutation', t => {
  const h = withUserData(t); fs.writeFileSync(path.join(h.userData, P.FILE + '.lock'), 'other owner');
  assert.deepEqual(h.registration().install(), { ok: false, mode: 'install', error: 'parents-receipt-busy' }); assert.equal(h.mutationCount(), 0); assert.equal(h.calls.length, 0);
});
test('invalid on-disk creation receipt cannot authorize parent deletion', t => {
  const h = withUserData(t); fs.writeFileSync(path.join(h.userData, P.FILE), JSON.stringify({ version: 1, launch, claims: [{ key: 'HKLM\\Software', token: '1'.repeat(64), state: 'created' }] }));
  const result = h.registration().remove(); assert.equal(result.ok, false); assert.equal(result.error, 'parents-receipt-invalid'); assert.equal(h.mutationCount(), 0);
});

test('status distinguishes absent, completely owned, and conflicting registration', () => {
  const h = harness();
  const r = h.registration();
  assert.deepEqual(r.status(), { ok: true, registered: false, entries: M.ACTIONS.map(action => ({ action, registered: false })) });
  r.install();
  assert.deepEqual(r.status(), { ok: true, registered: true, entries: M.ACTIONS.map(action => ({ action, registered: true })) });
  h.nodes.get(plan.entries[0].key).values.push({ name: 'Unrelated', kind: 'String', data: 'other software' });
  assert.deepEqual(r.status(), { ok: false, error: 'local-menu-conflict' });
});

test('uses precisely one fixed helper file and five fixed PowerShell arguments', () => {
  const h = harness();
  h.registration().status();
  for (const call of h.calls) {
    assert.equal(call.executable, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    assert.deepEqual(call.args.slice(0, 4), ['-NoLogo', '-NoProfile', '-NonInteractive', '-File']);
    assert.equal(call.args.length, 5);
    assert.equal(path.resolve(call.args[4]), path.resolve(__dirname, '../desktop/local-vfx-shell-registry.ps1'));
  }
});

for (let failure = 1; failure <= 4; failure++) {
  test('installation rollback preserves an entry already owned before mutation ' + failure, () => {
    const h = harness({ failMutation: failure });
    const keep = plan.entries[1];
    h.seed(keep.key, keep.parent.values);
    h.seed(keep.command.key, keep.command.values);
    const before = [...h.nodes.keys()].sort().map(key => [key, h.snapshot(key)]);
    assert.equal(h.registration().install().ok, false);
    assert.deepEqual([...h.nodes.keys()].sort().map(key => [key, h.snapshot(key)]), before);
  });
}

for (const [name, node] of [
  ['duplicated registry names', { values: [{ name: '', kind: 'String', data: 'x' }, { name: '', kind: 'String', data: 'x' }], children: [] }],
  ['case-insensitive duplicate names', { values: [{ name: 'TracerOwner', kind: 'String', data: M.OWNER }, { name: 'tracerowner', kind: 'String', data: M.OWNER }], children: [] }],
  ['duplicated children', { values: [], children: ['command', 'COMMAND'] }],
  ['path-like child name', { values: [], children: ['command\\foreign'] }],
  ['extra node fields', { values: [], children: [], arbitrarilyTrusted: true }],
  ['malformed value entries', { values: [null], children: [] }],
  ['non-string value data', { values: [{ name: 'TracerOwner', kind: 'String', data: 123 }], children: [] }],
  ['extra value fields', { values: [{ name: 'TracerOwner', kind: 'String', data: M.OWNER, command: 'arbitrary' }], children: [] }],
]) {
  test('rejects ' + name + ' before writes', () => {
    const h = harness({ responseOverride: () => ({ status: 0, stdout: JSON.stringify({ ok: true, present: true, node }), stderr: '' }) });
    assert.throws(() => h.registration().install());
    assert.equal(h.mutationCount(), 0);
  });
}

for (const code of ['registry-access-denied', 'registry-read-failed', 'registry-parent-missing', 'registry-operation-failed']) {
  test('status preserves only a known fixed helper failure: ' + code, () => {
    const h = harness({ responseOverride: () => ({ status: 0, stdout: JSON.stringify({ ok: false, error: code }), stderr: 'private irrelevant stderr' }) });
    assert.deepEqual(h.registration().status(), { ok: false, error: code });
    assert.equal(h.mutationCount(), 0);
  });
}

test('an incomplete existing entry is a conflict and is never silently repaired', () => {
  const h = harness();
  h.seed(plan.entries[0].key, plan.entries[0].parent.values);
  assert.throws(() => h.registration().install(), /conflict/);
  assert.equal(h.mutationCount(), 0);
  assert.equal(h.nodes.size, 1);
});

test('independent readback rejects a final write success envelope when the key was not actually created', () => {
  const h = harness({ reportOnly: { action: 'write', key: plan.entries[2].command.key } });
  const result = h.registration().install();
  assert.equal(result.ok, false);
  assert.equal(h.nodes.size, 0);
});

test('independent readback rejects a final remove success envelope when the key still exists', () => {
  const h = harness({ reportOnly: { action: 'remove', key: plan.entries[2].key } });
  h.seedInstalled();
  const before = [...h.nodes.keys()].sort().map(key => [key, h.snapshot(key)]);
  const result = h.registration().remove();
  assert.equal(result.ok, false);
  assert.deepEqual([...h.nodes.keys()].sort().map(key => [key, h.snapshot(key)]), before);
});

test('a missing shared Shell parent fails closed without creating ancestors or action keys', () => {
  const h = harness({ responseOverride: request => ({ status: 0, stdout: JSON.stringify(request.action === 'write' ? { ok: false, error: 'registry-parent-missing' } : { ok: true, present: false, node: null }), stderr: '' }) });
  const result = h.registration().install();
  assert.equal(result.ok, false);
  assert.equal(result.error, 'registry-parent-missing');
  assert.equal(h.nodes.size, 0);
});


