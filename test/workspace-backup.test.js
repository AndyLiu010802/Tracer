'use strict';

const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const { createLocalAccounts } = require('../lib/accounts');
const { createAccountHttp } = require('../lib/account-http');
const Backup = require('../lib/workspace-backup'), store = require('../lib/store');
const M = require('../skins/tracer/model'), F = require('../skins/tracer/focus-model'), G = require('../public/task-garden');
const clone = value => JSON.parse(JSON.stringify(value));
const password = 'Synthetic backup password 123';
function workspace(title = 'Original task') { const value = M.emptyWorkspace(); M.addTask(value, { title }); return value; }
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracer-backup-test-'));
  t.after(async () => { assert.ok(path.basename(dir).startsWith('tracer-backup-test-')); await fs.rm(dir, { recursive: true, force: true }); });
  return { dir, service: createLocalAccounts(dir) };
}
async function saved(service, token = '', preferences = {}) { return (await service.backupExport(token, { preferences })).backup; }
async function restore(service, backup, { token = '', currentPreferences = {}, expected, context } = {}) {
  expected ??= (await service.backupInspect(token, { backup })).expected;
  return service.backupRestore(token, { backup, expected, currentPreferences, confirm: true }, context);
}
async function register(service, name = 'one') { return service.register({ email: name + '@example.com', password, profile: { nickname: name } }); }

test('signed export is limited to validated workspace and preference fields and survives provider restart', async t => {
  const { dir, service } = await fixture(t), value = workspace();
  value.secret = 'DO_NOT_EXPORT'; value.meta.arbitrary = 'DO_NOT_EXPORT';
  value.meta.backupRestore = { id: 'old-restore', revision: 1, preferences: { secret: 'DO_NOT_EXPORT' } };
  await store.writeStore(dir, 'workspace', JSON.stringify(value));
  const backup = await saved(service, '', { 'tracer.language': 'en', 'tracer.ai.key': 'DO_NOT_EXPORT', 'tracer.workspaceDraft': 'DO_NOT_EXPORT' });
  assert.equal(JSON.stringify(backup).includes('DO_NOT_EXPORT'), false);
  assert.equal(backup.payload.workspace.meta.backupRestore, undefined);
  assert.deepEqual(backup.payload.preferences, { 'tracer.language': 'en' });
  const identity = JSON.parse(await fs.readFile(path.join(dir, '.accounts', 'identity.json'), 'utf8'));
  assert.match(identity.backupSecret, /^[a-f0-9]{64}$/); assert.equal(JSON.stringify(backup).includes(identity.backupSecret), false);
  const restarted = createLocalAccounts(dir), inspected = await restarted.backupInspect('', { backup });
  assert.equal(inspected.preview.counts.tasks, 1); assert.equal(inspected.expected, Backup.hash(value));
  await saved(restarted); assert.equal(JSON.parse(await fs.readFile(path.join(dir, '.accounts', 'identity.json'), 'utf8')).backupSecret, identity.backupSecret);
});

test('inspection rejects damage, unsigned legacy files, altered signatures and another installation without writing', async t => {
  const { dir, service } = await fixture(t), other = await fixture(t);
  await store.writeStore(dir, 'workspace', JSON.stringify(workspace()));
  const backup = await saved(service), modified = clone(backup);
  modified.payload.workspace.tasks[0].title = 'Forged';
  await assert.rejects(service.backupInspect('', { backup: modified }), { code: 'backup-checksum-mismatch' });
  modified.checksum = Backup.hash(modified.payload);
  await assert.rejects(service.backupInspect('', { backup: modified }), { code: 'backup-untrusted' });
  await assert.rejects(service.backupInspect('', { backup: { version: 1, workspace: workspace() } }), { code: 'backup-version-unsupported' });
  await assert.rejects(other.service.backupInspect('', { backup }), { code: 'backup-untrusted' });
  await assert.rejects(service.backupInspect('', { backup: { ...backup, extra: true } }), { code: 'backup-invalid' });
  assert.equal((await store.readStore(dir, 'workspace')).tasks[0].title, 'Original task');
  assert.equal(await store.readStore(other.dir, 'workspace'), null);
});

test('same installation backup cannot cross guest or account scopes and does not restore identity', async t => {
  const { dir, service } = await fixture(t), a = await register(service), b = await register(service, 'two');
  await store.writeStore(service.directory(a.user.id), 'workspace', JSON.stringify(workspace()));
  const backup = await saved(service, a.token);
  await assert.rejects(service.backupInspect(b.token, { backup }), { code: 'backup-scope-mismatch' });
  await assert.rejects(service.backupInspect('', { backup }), { code: 'backup-scope-mismatch' });
  await restore(service, backup, { token: a.token });
  const text = JSON.stringify(backup);
  for (const secret of [a.token, a.recoveryCode, a.user.email, password, 'recoveryHash', 'scrypt']) assert.equal(text.includes(secret), false);
  assert.equal((await service.context(a.token)).user.id, a.user.id);
  assert.equal(await store.readStore(dir, 'workspace'), null);
  assert.equal(await store.readStore(service.directory(b.user.id), 'workspace'), null);
});

test('restore replaces exact economy and collection snapshot, saves prior snapshot and pauses focus without new history', async t => {
  const { dir, service } = await fixture(t), value = M.emptyWorkspace();
  for (let i = 0; i < 8; i++) {
    const task = { id: 'harvest' + i, title: 'Harvest', status: 'doing', projectId: null, createdAt: 100, updatedAt: 100 };
    value.tasks.push(task); G.taskChanged(value, task, 100, n => n === 10000 ? 1000 : 4); task.status = 'done'; task.doneAt = task.updatedAt = 101; G.taskChanged(value, task, 101); G.harvest(value, task.id, 102);
  }
  G.sell(value, 'peach', 8, 200);
  value.taskGarden.market.wallpapers = { purchases: [{ itemId: 's01', purchasedAt: 300 }], appearance: { backgroundItemId: 's01', materialItemId: null }, updatedAt: 300 };
  await store.writeStore(dir, 'workspace', JSON.stringify(value));
  const focus = F.fresh(); focus.history = [{ id: 'past', endedAt: 100, minutes: 17, task: null }]; focus.totalMinutes = 17; focus.roundsDone = 1;
  focus.settings.focus = 17; focus.running = true; focus.runId = 'expired'; focus.endAt = 1; focus.alarm = { id: 'alarm', mode: 'focus', endedAt: 1 };
  const backup = await saved(service, '', { 'tracer.focus.v1': JSON.stringify(focus), 'tracer.language': 'en' });
  const later = workspace('Before restore'); await store.writeStore(dir, 'workspace', JSON.stringify(later));
  const result = await restore(service, backup, { currentPreferences: { 'tracer.language': 'zh' } });
  const current = await store.readStore(dir, 'workspace'), marker = current.meta.backupRestore;
  assert.deepEqual(current.taskGarden, backup.payload.workspace.taskGarden); assert.equal(G.economy(current).balance, 160);
  assert.equal(marker.id, result.restoreId); assert.equal(marker.revision, 1);
  const restoredFocus = JSON.parse(marker.preferences['tracer.focus.v1']);
  assert.equal(restoredFocus.running, false); assert.equal(restoredFocus.endAt, null); assert.equal(restoredFocus.alarm, null);
  assert.deepEqual(restoredFocus.history, focus.history); assert.equal(restoredFocus.totalMinutes, 17); assert.equal(restoredFocus.roundsDone, 1);
  const listed = await service.backupList(''); assert.equal(listed.snapshots[0].id, result.snapshotId);
  const snapshot = (await service.backupDownload('', { id: result.snapshotId })).backup;
  assert.equal(snapshot.payload.workspace.tasks[0].title, 'Before restore'); assert.equal(snapshot.payload.preferences['tracer.language'], 'zh');
  await restore(service, snapshot); assert.equal((await store.readStore(dir, 'workspace')).tasks[0].title, 'Before restore');
  assert.equal((await service.context('', true)).restoreRevision, 2);
});

test('restore preserves current account import claim and excludes recurring restore markers from exports', async t => {
  const { dir, service } = await fixture(t), a = await register(service), own = service.directory(a.user.id);
  const backup = await saved(service, a.token);
  await store.writeStore(dir, 'workspace', JSON.stringify(workspace())); await service.importGuest(a.token);
  const marker = (await store.readStore(own, 'workspace')).meta.accountImport;
  await restore(service, backup, { token: a.token });
  assert.equal((await store.readStore(own, 'workspace')).meta.accountImport, marker);
  const next = await saved(service, a.token); assert.equal(next.payload.workspace.meta.backupRestore, undefined); assert.equal(next.payload.workspace.meta.accountImport, marker);
  assert.equal((await service.guestPreview(a.token)).alreadyImported, true);
});

test('stale preview, missing confirmation, invalid preferences and active data leases do not overwrite workspace', async t => {
  const { dir, service } = await fixture(t), backup = await saved(service), inspected = await service.backupInspect('', { backup });
  await store.writeStore(dir, 'workspace', JSON.stringify(workspace('Latest')));
  await assert.rejects(restore(service, backup, { expected: inspected.expected }), { code: 'backup-stale' });
  const expected = (await service.backupInspect('', { backup })).expected;
  await assert.rejects(service.backupRestore('', { backup, expected, currentPreferences: {}, confirm: false }), { code: 'backup-confirmation-required' });
  await assert.rejects(restore(service, backup, { currentPreferences: { 'tracer.language': 'invalid' } }), { code: 'backup-invalid-preferences' });
  const lease = await service.beginDataRequest('', 'guest', 0);
  await assert.rejects(restore(service, backup), { code: 'account-data-busy' }); lease.release();
  assert.equal((await store.readStore(dir, 'workspace')).tasks[0].title, 'Latest'); assert.deepEqual((await service.backupList('')).snapshots, []);
});

test('expected hash is checked inside store write queue after snapshot creation', async t => {
  const { dir, service } = await fixture(t), backup = await saved(service), originalWrite = store.writeStore;
  let intercepted = false;
  store.writeStore = async (...args) => {
    if (!intercepted && args[0] === dir && args[3]) { intercepted = true; await originalWrite(dir, 'workspace', JSON.stringify(workspace('Concurrent save'))); }
    return originalWrite(...args);
  };
  try { await assert.rejects(restore(service, backup), { code: 'backup-stale' }); }
  finally { store.writeStore = originalWrite; }
  assert.equal((await store.readStore(dir, 'workspace')).tasks[0].title, 'Concurrent save');
});

test('snapshot failure and final write failure retain the original workspace; successful snapshot remains downloadable', async t => {
  const { dir, service } = await fixture(t), backup = await saved(service);
  await store.writeStore(dir, 'workspace', JSON.stringify(workspace('Keep me')));
  await fs.writeFile(path.join(dir, '.backups'), 'synthetic obstacle');
  await assert.rejects(restore(service, backup), { code: 'backup-storage-unavailable' });
  assert.equal((await store.readStore(dir, 'workspace')).tasks[0].title, 'Keep me');
  await fs.unlink(path.join(dir, '.backups'));
  const originalWrite = store.writeStore; store.writeStore = async () => { throw Object.assign(new Error('synthetic ENOSPC'), { code: 'ENOSPC' }); };
  try { await assert.rejects(restore(service, backup), { code: 'backup-storage-unavailable' }); }
  finally { store.writeStore = originalWrite; }
  assert.equal((await store.readStore(dir, 'workspace')).tasks[0].title, 'Keep me');
  const rows = (await service.backupList('')).snapshots; assert.equal(rows.length, 1);
  assert.equal((await service.backupDownload('', { id: rows[0].id })).backup.payload.workspace.tasks[0].title, 'Keep me');
});

test('restore epoch blocks stale reads, writes and queued restores but permits current and unscoped art reads', async t => {
  const { service } = await fixture(t), backup = await saved(service), expected = (await service.backupInspect('', { backup })).expected;
  const oldContext = { scope: 'guest', generation: 0, restoreId: '' }, input = { backup, expected, currentPreferences: {}, confirm: true };
  const results = await Promise.allSettled([service.backupRestore('', input, oldContext), service.backupRestore('', input, oldContext)]);
  assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].reason.code, 'account-changed');
  await assert.rejects(service.beginDataRequest('', 'guest', 0), { code: 'account-changed' });
  await assert.rejects(service.backupExport('', { preferences: {} }, oldContext), { code: 'account-changed' });
  const context = await service.context('', true);
  assert.equal(context.restoreId, results[0].value.restoreId); assert.deepEqual(context.restorePreferences, {});
  assert.equal((await service.context('')).restorePreferences, undefined);
  (await service.beginDataRequest('', 'guest', 0, false, context.restoreId)).release();
  (await service.beginDataRequest('', undefined, 0, true)).release();
  await assert.rejects(service.backupDownload('', { id: '../../identity' }), { code: 'backup-not-found' });
});

test('clearing an account retains installation signing trust and explicitly allows its old backup', async t => {
  const { service } = await fixture(t), a = await register(service), backup = await saved(service, a.token);
  const cleared = await service.clearData(a.token, { password, confirm: true });
  await restore(service, backup, { token: cleared.token });
  assert.equal((await service.context(cleared.token)).generation, 1);
  assert.equal((await service.context(a.token)).scope, 'locked');
});

test('corrupt workspace keeps account bootstrap available while data requests fail closed with corrupt status', async t => {
  const { dir, service } = await fixture(t);
  await fs.writeFile(path.join(dir, 'workspace.json'), '{corrupt');
  const context = await service.context('', true); assert.equal(context.scope, 'guest'); assert.equal(context.workspaceCorrupt, true);
  await assert.rejects(service.beginDataRequest('', 'guest', 0), { code: 'store-corrupt', status: 409 });
  assert.equal(await fs.readFile(path.join(dir, 'workspace.json'), 'utf8'), '{corrupt');
});

test('guest import never copies guest restore preferences or epoch into the account and retains account epoch', async t => {
  const { dir, service } = await fixture(t), a = await register(service);
  const ownBackup = await saved(service, a.token), ownRestore = await restore(service, ownBackup, { token: a.token });
  await store.writeStore(dir, 'workspace', JSON.stringify(workspace()));
  const guestBackup = await saved(service, '', { 'tracer.language': 'zh' });
  const guestRestore = await restore(service, guestBackup);
  await service.importGuest(a.token);
  const current = await store.readStore(service.directory(a.user.id), 'workspace');
  assert.equal(current.meta.backupRestore.id, ownRestore.restoreId); assert.notEqual(current.meta.backupRestore.id, guestRestore.restoreId);
  assert.deepEqual(current.meta.backupRestore.preferences, {}); assert.equal(current.tasks.length, 1);
});

async function transport(t, service, readonly = false) {
  const handler = createAccountHttp(service, { readonly, readBody: async (req, limit) => {
    const buffers = []; let length = 0;
    for await (const data of req) { length += data.length; if (length > limit) throw Object.assign(new Error('too large'), { code: 'too-large' }); buffers.push(data); }
    return Buffer.concat(buffers).toString('utf8');
  } });
  const server = http.createServer((req, res) => { handler(req, res, new URL(req.url, 'http://localhost').pathname).catch(error => { res.writeHead(500).end(error.message); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  return async (action, data, headers = {}) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/account/' + action, { method: data === undefined ? 'GET' : 'POST', headers: { 'x-tracer-account': '1', 'x-tracer-scope': 'guest', 'content-type': 'application/json', ...headers }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, body: await response.json() };
  };
}

test('HTTP backup contract enforces confirmation, restore headers, schema, local origin and readonly mode', async t => {
  const { service } = await fixture(t), call = await transport(t, service), readonly = await transport(t, service, true);
  assert.equal((await call('backup-export', { preferences: {} }, { origin: 'https://foreign.example' })).status, 403);
  assert.equal((await readonly('backup-export', { preferences: {} })).status, 403);
  assert.equal((await call('backup-export', { preferences: {}, extra: true })).body.error, 'backup-invalid');
  const backup = (await call('backup-export', { preferences: { 'tracer.language': 'en' } })).body.backup;
  const inspection = await call('backup-inspect', { backup }); assert.equal(inspection.status, 200);
  const input = { backup, expected: inspection.body.expected, currentPreferences: {}, confirm: true };
  assert.equal((await readonly('backup-restore', input)).status, 403);
  const result = await call('backup-restore', input); assert.equal(result.status, 200);
  assert.equal((await call('backup-list')).body.error, 'account-changed');
  const headers = { 'x-tracer-restore': result.body.restoreId };
  const rows = await call('backup-list', undefined, headers); assert.equal(rows.body.snapshots[0].id, result.body.snapshotId);
  assert.equal((await call('backup-download', { id: result.body.snapshotId }, headers)).status, 200);
  assert.equal((await call('backup-inspect', { backup })).body.error, 'account-changed');
});

test('HTTP backup bodies are bounded at eight MiB and signed workspace itself at four MiB', async t => {
  const { service } = await fixture(t), call = await transport(t, service);
  const response = await call('backup-export', { preferences: { ignored: 'x'.repeat(8 * 1024 * 1024) } });
  assert.equal(response.status, 413); assert.equal(response.body.error, 'request-too-large');
  assert.throws(() => Backup.sign('guest', { ...workspace(), ignored: 'x'.repeat(4 * 1024 * 1024) }, {}, 'a'.repeat(64)), { code: 'backup-invalid-workspace' });
});

test('restore refuses a workspace plus embedded preferences over four MiB before saving a snapshot', async t => {
  const { dir, service } = await fixture(t), value = M.emptyWorkspace();
  for (let i = 0; i < 41; i++) value.notes.push({ id: 'note' + i, title: 'Large note', body: 'x'.repeat(100000), pinned: false });
  const focus = F.fresh();
  focus.history = Array.from({ length: 150 }, (_, i) => ({ id: 'focus' + i, endedAt: 100, minutes: 1, task: { id: 'task', title: 'y'.repeat(1500) } }));
  await store.writeStore(dir, 'workspace', JSON.stringify(value));
  const backup = await saved(service, '', { 'tracer.focus.v1': JSON.stringify(focus) });
  await store.writeStore(dir, 'workspace', JSON.stringify(workspace('Keep current')));
  await assert.rejects(restore(service, backup), { code: 'backup-too-large', status: 413 });
  assert.equal((await store.readStore(dir, 'workspace')).tasks[0].title, 'Keep current');
  assert.deepEqual((await service.backupList('')).snapshots, []);
  const repeated = { ...value, meta: { ...value.meta, backupRestore: { id: 'marker', revision: 1, preferences: { ignored: 'x'.repeat(200000) } } } };
  assert.doesNotThrow(() => Backup.sign('guest', repeated, {}, 'a'.repeat(64)));
});
