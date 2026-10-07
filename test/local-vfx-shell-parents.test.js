'use strict';
// Isolated files and pure registry mocks. No process or real registry is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const P = require('../desktop/local-vfx-shell-parents');
const launch = Object.freeze({ kind: 'source', executable: 'C:\\QA\\node_modules\\electron\\dist\\electron.exe', appPath: 'C:\\QA' });
const temporaryRoot = process.env.TRACER_ISOLATED_TEST_ROOT || os.tmpdir();
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function harness(options = {}) {
  const nodes = new Map(), calls = [], saved = [];
  let record = options.record || null, counter = 0, writes = 0;
  const seed = (key, token, values = 0, children = 0) => nodes.set(key, { token, values, children });
  const snapshot = (key, token) => {
    const node = nodes.get(key); if (!node) return null;
    const owned = typeof token === 'string' && node.token === token;
    return { valueCount: node.values + (node.token && !owned ? 1 : 0), childCount: node.children + (key === P.PARENTS[0] && nodes.has(P.PARENTS[1]) ? 1 : 0), owned };
  };
  const store = options.store || {
    read: () => clone(record),
    save(value) { writes++; if (options.failSave?.(writes, value)) throw Error('parents-receipt-write-failed'); record = clone(value); saved.push(clone(value)); }
  };
  const parentRegistry = {
    read(key, token) { calls.push(['read', key, token]); return options.read ? options.read(key, token, { seed, snapshot, nodes }) : snapshot(key, token); },
    createEmpty(key, token) {
      calls.push(['create', key, token]);
      if (options.create) return options.create(key, token, { seed, snapshot, nodes });
      if (nodes.has(key)) return { created: false, disposition: 'opened-existing' };
      seed(key, token); return { created: true, disposition: 'created-new' };
    },
    removeEmpty(key, token) {
      calls.push(['remove', key, token]);
      if (options.remove) return options.remove(key, token, { seed, snapshot, nodes });
      const node = snapshot(key, token);
      if (node === null) return { removed: false, reason: 'missing' };
      if (!node.owned) return { removed: false, reason: 'conflict' };
      if (node.valueCount || node.childCount) return { removed: false, reason: 'not-empty' };
      nodes.delete(key); return { removed: true };
    }
  };
  const make = () => P.createParentLifecycle({ parentRegistry, store, launch, randomToken: () => (++counter).toString(16).padStart(64, '0') });
  return { nodes, calls, seed, snapshot, saved, store, make, lifecycle: make(), record: () => clone(record), writes: () => writes };
}
const mutations = h => h.calls.filter(([action]) => action !== 'read');

test('creates exactly two fixed parents with recorded tokens, then removes in reverse order', () => {
  const h = harness(), result = h.lifecycle.prepare();
  assert.deepEqual(result, { ok: true, created: P.PARENTS });
  assert.deepEqual(h.record().claims.map(claim => claim.key), P.PARENTS);
  assert.ok(h.record().claims.every(claim => claim.state === 'created'));
  assert.deepEqual(h.saved.slice(0, 2).map(record => record.claims[0].state), ['pending', 'created']);
  const cleaned = h.lifecycle.cleanup();
  assert.equal(cleaned.ok, true); assert.equal(cleaned.complete, true);
  assert.deepEqual(cleaned.removed, [...P.PARENTS].reverse()); assert.equal(h.nodes.size, 0); assert.deepEqual(h.record().claims, []);
});
test('preexisting shared parents including empty keys are never claimed or changed', () => {
  for (const count of [0, 3]) {
    const h = harness(); for (const key of P.PARENTS) h.seed(key, null, count, count);
    assert.deepEqual(h.lifecycle.prepare(), { ok: true, created: [] });
    assert.equal(h.record(), null); assert.equal(h.lifecycle.cleanup().complete, true);
    assert.equal(mutations(h).length, 0); assert.equal(h.nodes.size, 2);
  }
});
test('only missing Shell is created when DesktopBackground already exists', () => {
  const h = harness(); h.seed(P.PARENTS[0], null, 7);
  assert.deepEqual(h.lifecycle.prepare().created, [P.PARENTS[1]]);
  assert.deepEqual(h.lifecycle.cleanup().removed, [P.PARENTS[1]]);
  assert.equal(h.nodes.size, 1); assert.equal(h.nodes.get(P.PARENTS[0]).values, 7);
});
test('repeated install retains prior persistent creation receipt across new instances', () => {
  const h = harness(); h.lifecycle.prepare(); const before = h.record();
  assert.deepEqual(h.make().prepare(), { ok: true, created: [] }); assert.deepEqual(h.record(), before);
  assert.equal(h.make().cleanup().complete, true); assert.equal(h.nodes.size, 0);
});
test('post-restart cleanup uses persisted tokens and is idempotent', () => {
  const h = harness(); h.lifecycle.prepare(); assert.equal(h.make().cleanup().complete, true);
  h.calls.length = 0; assert.equal(h.make().cleanup().complete, true); assert.equal(mutations(h).length, 0);
  for (const key of P.PARENTS) h.seed(key, null);
  h.make().cleanup(); assert.equal(h.nodes.size, 2); assert.equal(mutations(h).length, 0);
});
test('record write failure before creation prevents any native mutation', () => {
  const h = harness({ failSave: () => true }), result = h.lifecycle.prepare();
  assert.equal(result.ok, false); assert.equal(result.error, 'parents-receipt-write-failed'); assert.equal(mutations(h).length, 0); assert.equal(h.nodes.size, 0);
});
test('failure recording newly created key rolls back token-owned empty creation', () => {
  const h = harness({ failSave: writes => writes === 2 }), result = h.lifecycle.prepare();
  assert.equal(result.error, 'parents-receipt-write-failed'); assert.deepEqual(result.rollback.removed, [P.PARENTS[0]]); assert.equal(h.nodes.size, 0); assert.deepEqual(h.record().claims, []);
});
test('persistent write outage after creation still permits token-checked rollback', () => {
  const h = harness({ failSave: writes => writes >= 2 }), result = h.lifecycle.prepare();
  assert.equal(result.ok, false); assert.deepEqual(result.rollback.removed, [P.PARENTS[0]]); assert.equal(h.nodes.size, 0);
  assert.equal(h.record().claims[0].state, 'pending'); // Recovery checks token, never path alone.
});
test('partial second creation failure rolls back only this invocation and leaves previous claim intact', () => {
  const h = harness({ create(key, token, state) { if (key === P.PARENTS[1]) throw Error('private detail'); state.seed(key, token); return { created: true, disposition: 'created-new' }; } });
  const result = h.lifecycle.prepare(); assert.equal(result.error, 'parents-create-outcome-unknown'); assert.equal(h.nodes.size, 0);
  assert.equal(JSON.stringify(result).includes('private'), false);
});
test('opened-existing race never gains a token or deletion authority', () => {
  const h = harness({ create(key, token, state) { state.seed(key, null); return { created: false, disposition: 'opened-existing' }; } });
  const result = h.lifecycle.prepare(); assert.equal(result.error, 'parents-create-conflict'); assert.deepEqual(h.record().claims, []);
  assert.equal(h.nodes.size, 1); assert.equal(h.calls.some(([action]) => action === 'remove'), false);
});
test('unknown creation without matching marker is preserved', () => {
  const h = harness({ create(key, token, state) { state.seed(key, null); throw Error('unknown'); } });
  const result = h.lifecycle.prepare(); assert.equal(result.ok, false); assert.equal(h.nodes.size, 1);
  assert.deepEqual(result.rollback.preserved, [{ key: P.PARENTS[0], reason: 'conflict' }]); assert.equal(h.record().claims.length, 0);
});
test('unknown creation with matching marker can be safely rolled back', () => {
  const h = harness({ create(key, token, state) { state.seed(key, token); throw Error('unknown'); } });
  assert.deepEqual(h.lifecycle.prepare().rollback.removed, [P.PARENTS[0]]); assert.equal(h.nodes.size, 0);
});
test('foreign values or child keys retain both parent and durable retry receipt', () => {
  for (const field of ['values', 'children']) {
    const h = harness(); h.lifecycle.prepare(); h.nodes.get(P.PARENTS[1])[field] = 1;
    const before = h.record(), result = h.lifecycle.cleanup(); assert.equal(result.ok, true); assert.equal(result.complete, false);
    assert.equal(h.nodes.size, 2); assert.deepEqual(h.record(), before); assert.equal(h.lifecycle.pending(), true);
    assert.equal(h.calls.some(([action]) => action === 'remove'), false);
    h.nodes.get(P.PARENTS[1])[field] = 0; assert.equal(h.make().cleanup().complete, true);
  }
});
test('native final transactional check preserves a value arriving after JavaScript read', () => {
  const h = harness({ remove(key, token, state) { state.nodes.get(key).values++; return { removed: false, reason: 'not-empty' }; } });
  h.lifecycle.prepare(); const result = h.lifecycle.cleanup(); assert.equal(result.complete, false); assert.equal(h.nodes.size, 2);
  assert.equal(h.record().claims.length, 2); assert.equal(h.record().claims[1].key, P.PARENTS[1]);
});
test('replacement marker mismatch revokes old claim without deleting replacement', () => {
  const h = harness(); h.lifecycle.prepare(); h.nodes.get(P.PARENTS[1]).token = 'f'.repeat(64);
  const result = h.make().cleanup(); assert.equal(result.complete, false); assert.equal(h.nodes.has(P.PARENTS[1]), true);
  assert.ok(!h.record().claims.some(claim => claim.key === P.PARENTS[1]));
});
test('unknown remove outcome is persistently revoked before call and cannot replay after restart', () => {
  const h = harness({ remove() { throw Error('secret diagnostic'); } }); h.lifecycle.prepare();
  const result = h.lifecycle.cleanup(); assert.equal(result.ok, false); assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.ok(!h.record().claims.some(claim => claim.key === P.PARENTS[1])); h.calls.length = 0; h.make().cleanup();
  assert.equal(h.calls.some(([action, key]) => action === 'remove' && key === P.PARENTS[1]), false);
});
test('failure persisting deletion revocation prevents native delete', () => {
  const h = harness({ failSave: writes => writes >= 5 }); h.lifecycle.prepare(); h.calls.length = 0;
  const result = h.lifecycle.cleanup(); assert.equal(result.ok, false); assert.equal(h.nodes.size, 2); assert.equal(mutations(h).length, 0);
});
test('a known aborted native deletion preserves its persistent token for retry', () => {
  let failed = false;
  const h = harness({ remove(key, token, state) {
    if (!failed) { failed = true; const error = Error('registry-access-denied'); error.parentRollback = true; throw error; }
    const node = state.snapshot(key, token); if (node.childCount) return { removed: false, reason: 'not-empty' };
    state.nodes.delete(key); return { removed: true };
  } });
  h.lifecycle.prepare(); const before = h.record(), first = h.lifecycle.cleanup();
  assert.equal(first.ok, false); assert.deepEqual(h.record(), before); assert.equal(h.nodes.size, 2);
  assert.equal(h.make().cleanup().complete, true); assert.equal(h.nodes.size, 0);
});
test('status is read-only and does not generate random tokens or records', () => {
  const h = harness(); const result = h.lifecycle.status(); assert.equal(result.length, 2); assert.equal(h.writes(), 0); assert.equal(mutations(h).length, 0);
});
test('invalid receipt launch, key order, tokens, extra fields and getters never authorize registry calls', () => {
  const base = { version: 1, launch, claims: [{ key: P.PARENTS[0], token: '1'.repeat(64), state: 'created' }] };
  let invoked = false; const accessor = { ...base }; Object.defineProperty(accessor, 'claims', { enumerable: true, get() { invoked = true; return []; } });
  for (const record of [{ ...base, version: 2 }, { ...base, launch: { ...launch, executable: 'C:\\evil.exe' } },
    { ...base, claims: [{ ...base.claims[0], key: 'HKCU\\Other' }] }, { ...base, claims: [{ ...base.claims[0], token: 'short' }] },
    { ...base, claims: [{ ...base.claims[0], state: 'forged' }] }, { ...base, extra: true }, accessor]) {
    assert.throws(() => P.validateRecord(record, launch), /parents-receipt-invalid/);
  }
  assert.equal(invoked, false);
});
test('bounded receipt store survives new instances and does not create directories during read', t => {
  const folder = fs.mkdtempSync(path.join(temporaryRoot, 'tracer-parents-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const userData = path.join(folder, 'not-yet-created'), store = P.createReceiptStore(userData, launch);
  assert.equal(store.read(), null); assert.equal(fs.existsSync(userData), false);
  const record = { version: 1, launch, claims: [] }; store.exclusive(() => store.save(record));
  assert.deepEqual(P.createReceiptStore(userData, launch).read(), record);
  assert.equal(fs.readdirSync(userData).some(name => name.endsWith('.tmp') || name.endsWith('.lock')), false);
});
test('exclusive receipt lock rejects competing mutations and remains readable', t => {
  const folder = fs.mkdtempSync(path.join(temporaryRoot, 'tracer-parents-lock-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const first = P.createReceiptStore(folder, launch), second = P.createReceiptStore(folder, launch);
  first.exclusive(() => { assert.equal(second.read(), null); assert.throws(() => second.exclusive(() => assert.fail('lock bypassed')), /parents-receipt-busy/); });
  assert.doesNotThrow(() => second.exclusive(() => {}));
});
test('symlink directories and hardlinked receipt files are rejected without following them', t => {
  const folder = fs.mkdtempSync(path.join(temporaryRoot, 'tracer-parents-links-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const outside = path.join(folder, 'outside'); fs.mkdirSync(outside);
  const link = path.join(folder, 'junction'); fs.symlinkSync(outside, link, 'junction');
  assert.throws(() => P.createReceiptStore(link, launch).read(), /parents-receipt-path-invalid/);
  const record = path.join(folder, P.FILE); fs.writeFileSync(record, '{}'); fs.linkSync(record, path.join(folder, 'second-name'));
  assert.throws(() => P.createReceiptStore(folder, launch).read(), /parents-receipt-path-invalid/);
});
