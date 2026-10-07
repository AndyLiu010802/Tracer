'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const Sync = require('../public/workspace-sync');
const Store = require('../lib/store');
const Portable = require('../lib/portable-backup');
const execute = promisify(execFile);

function nearLimitWorkspace(bytes) {
  let workspace = Sync.empty();
  workspace.notes = Array.from({ length: 42 }, (_, index) => ({
    id: 'synthetic_note_' + index,
    title: 'Synthetic boundary note',
    body: index < 41 ? 'x'.repeat(100000) : '',
    pinned: false
  }));
  workspace = Sync.validate(workspace);
  workspace.notes.at(-1).body = 'x'.repeat(bytes - Buffer.byteLength(JSON.stringify(workspace)));
  assert.equal(Buffer.byteLength(JSON.stringify(workspace)), bytes);
  return workspace;
}

test('a successful near-limit full backup remains inspectable and restorable including control metadata', async t => {
  const temporary = path.resolve(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temporary, 'tracer-backup-budget-'));
  assert.equal(path.dirname(root), temporary);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const limit = 4 * 1024 * 1024;
  let accepted = 0;
  for (const headroom of [24, 256, 1024]) {
    const source = path.join(root, 'source-' + headroom);
    const target = path.join(root, 'target-' + headroom);
    const output = path.join(root, 'export-' + headroom);
    await fs.mkdir(source);
    await fs.mkdir(target);
    const workspace = nearLimitWorkspace(limit - headroom);
    await Store.writeStore(source, 'workspace', JSON.stringify(workspace));
    await Store.writeStore(target, 'workspace', JSON.stringify(Sync.empty()));
    const preferences = { 'tracer.language': 'en' };
    let exported;
    try {
      exported = await Portable.exportDirectory(source, preferences, output);
    } catch (error) {
      assert.equal(error.code, 'backup-too-large', 'only an explicit size rejection is acceptable for valid input');
      await assert.rejects(fs.lstat(output), { code: 'ENOENT' }, 'size rejection cannot leave an unusable partial backup');
      continue;
    }
    accepted++;
    assert.ok(exported.output);
    const payload = await Portable.inspectDirectory(output);
    assert.deepEqual(payload.workspace.notes, workspace.notes);
    assert.deepEqual(payload.preferences, preferences);
    const result = await Portable.restoreDirectory(output, target, {}, { confirm: true });
    const restored = await Store.readStore(target, 'workspace');
    assert.deepEqual(restored.notes, workspace.notes, 'accepted export must preserve complete records on restoration');
    assert.deepEqual(restored.meta.backupRestore.preferences, preferences);
    assert.equal(restored.meta.backupRestore.id, result.restoreId);
    assert.ok(Buffer.byteLength(JSON.stringify(restored)) <= limit, 'restore marker and preferences must fit the persisted workspace budget');
  }
  assert.ok(accepted >= 1, 'safe headroom must support a complete round trip, not reject every boundary case');
});

test('workspace plus legal focus preferences cannot exceed the shared restored-store budget', async t => {
  const temporary = path.resolve(os.tmpdir()), root = await fs.mkdtemp(path.join(temporary, 'tracer-backup-preference-budget-'));
  assert.equal(path.dirname(root), temporary);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), output = path.join(root, 'export');
  await fs.mkdir(source);
  await Store.writeStore(source, 'workspace', JSON.stringify(nearLimitWorkspace(4 * 1024 * 1024 - 50000)));
  const focus = require('../skins/tracer/focus-model').fresh();
  focus.history = Array.from({ length: 300 }, (_, i) => ({ id: 'history-' + i, endedAt: i + 1, minutes: 25, task: { id: 'task-' + i, title: 'Synthetic '.repeat(100) } }));
  await assert.rejects(Portable.exportDirectory(source, { 'tracer.focus.v1': JSON.stringify(focus) }, output), { code: 'backup-too-large' });
  await assert.rejects(fs.lstat(output), { code: 'ENOENT' });
  assert.equal((await Store.readStore(source, 'workspace')).notes.length, 42);
});

test('read-only desktop mode rejects file restore before entering the mutating engine', async () => {
  // A child process makes the readonly environment and Electron/module mocks
  // independent of other test files. All paths are fictitious; no FS calls run.
  const script = String.raw`
    const Module = require('node:module');
    const Portable = require('./lib/portable-backup');
    const Sync = require('./public/workspace-sync');
    const originalLoad = Module._load;
    let mutations = 0;
    const origin = 'http://127.0.0.1:12961';
    const contents = {
      mainFrame: { url: origin + '/' },
      session: { cookies: { get: async () => [] } },
      send: () => {}
    };
    const win = { webContents: contents, isDestroyed: () => false, once: () => {} };
    Module._load = function (name, ...args) {
      if (name === 'electron') return {
        ipcMain: { handle: () => {}, removeHandler: () => {} },
        dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: ['synthetic-not-a-real-path'] }) }
      };
      return originalLoad.call(this, name, ...args);
    };
    Portable.inspectDirectory = async () => ({
      format: 'tracer-portable-directory', version: 1, workspace: Sync.empty(), preferences: {}, assets: []
    });
    Portable.restoreDirectory = async () => { mutations++; return { restoreId: 'synthetic-commit' }; };
    const accounts = {
      cookieName: 'synthetic',
      portableFileOperation: async (_token, _expected, operation) => operation('synthetic-target', Sync.empty())
    };
    const { request } = require('./desktop/backup-files').attachBackupFiles(win, origin, accounts);
    Module._load = originalLoad;
    const event = { sender: contents, senderFrame: contents.mainFrame };
    (async () => {
      const selected = await request(event, { action: 'choose', scope: 'guest', generation: 0, restoreId: '' });
      const result = await request(event, {
        action: 'restore', id: selected.id || 'synthetic-selection', scope: 'guest', generation: 0,
        restoreId: '', confirm: true, preferences: {}
      });
      console.log(JSON.stringify({ result, mutations, readonly: process.env.DOCS_PORTAL_READONLY_STORE }));
    })().catch(error => { console.error(error.message); process.exitCode = 1; });
  `;
  const { stdout } = await execute(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DOCS_PORTAL_READONLY_STORE: '1' },
    timeout: 10000,
    maxBuffer: 64 * 1024,
    windowsHide: true
  });
  const proof = JSON.parse(stdout.trim());
  assert.equal(proof.readonly, '1');
  assert.deepEqual(proof.result, { ok: false, error: 'readonly' });
  assert.equal(proof.mutations, 0, 'readonly rejection must not call the restore engine');
});

test('desktop selection binds generation and rejects iframe or non-app-origin requests', async () => {
  const script = String.raw`
    const Module = require('node:module'), Portable = require('./lib/portable-backup'), Sync = require('./public/workspace-sync');
    const originalLoad = Module._load, origin = 'http://127.0.0.1:12961';
    let mutations = 0, inspections = 0;
    const contents = { mainFrame: { url: origin + '/' }, session: { cookies: { get: async () => [] } }, send: () => {} };
    const win = { webContents: contents, isDestroyed: () => false, once: () => {} };
    Module._load = function(name, ...args) {
      if(name === 'electron') return { ipcMain: { handle: () => {}, removeHandler: () => {} }, dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: ['synthetic-not-a-real-path'] }) } };
      return originalLoad.call(this, name, ...args);
    };
    Portable.inspectDirectory = async () => { inspections++; return { format: 'tracer-portable-directory', version: 1, workspace: Sync.empty(), preferences: {}, assets: [] }; };
    Portable.restoreDirectory = async () => { mutations++; return { restoreId: 'synthetic' }; };
    const accounts = { cookieName: 'synthetic', portableFileOperation: async (_t, _e, operation) => operation('synthetic-target', Sync.empty()) };
    const { request } = require('./desktop/backup-files').attachBackupFiles(win, origin, accounts);
    Module._load = originalLoad;
    const event = { sender: contents, senderFrame: contents.mainFrame };
    (async () => {
      const selected = await request(event, { action: 'choose', scope: 'guest', generation: 0, restoreId: '' });
      const args = { action: 'restore', id: selected.id, scope: 'guest', generation: 1, restoreId: '', confirm: true, preferences: {} };
      const stale = await request(event, args);
      const iframe = await request({ sender: contents, senderFrame: { url: origin + '/' } }, args);
      contents.mainFrame.url = 'https://example.invalid/';
      const external = await request(event, args);
      console.log(JSON.stringify({ stale, iframe, external, mutations, inspections }));
    })().catch(error => { console.error(error.message); process.exitCode = 1; });
  `;
  const { stdout } = await execute(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, DOCS_PORTAL_READONLY_STORE: '0' },
    timeout: 10000, maxBuffer: 64 * 1024, windowsHide: true
  });
  const proof = JSON.parse(stdout.trim());
  assert.deepEqual(proof.stale, { ok: false, error: 'backup-confirmation-required' });
  assert.deepEqual(proof.iframe, { ok: false, error: 'backup-forbidden' });
  assert.deepEqual(proof.external, { ok: false, error: 'backup-forbidden' });
  assert.equal(proof.mutations, 0);
  assert.equal(proof.inspections, 1, 'stale selection must be rejected before any second backup read');
});

test('desktop export finalization disables cancellation and keeps rename inside the engine lifecycle', async () => {
  const script = String.raw`
    const Module = require('node:module'), Portable = require('./lib/portable-backup'), fs = require('node:fs/promises'), origin = 'http://127.0.0.1:12961';
    const originalLoad = Module._load;
    let request, event, cancel, finalizationEntered = false, renamed = false;
    const contents = { mainFrame: { url: origin + '/' }, session: { cookies: { get: async () => [] } }, send: () => {} };
    const win = { webContents: contents, isDestroyed: () => false, once: () => {} };
    Module._load = function(name, ...args) {
      if(name === 'electron') return { ipcMain: { handle: () => {}, removeHandler: () => {} }, dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: ['synthetic-destination'] }) } };
      return originalLoad.call(this, name, ...args);
    };
    Portable.exportDirectory = async (_directory, _preferences, output, options) => {
      if(typeof options.finalize !== 'function') throw Error('missing-finalization');
      options.onProgress({ phase: 'commit', done: 1, total: 1 });
      cancel = await request(event, { action: 'cancel' });
      finalizationEntered = true;
      await options.finalize(output);
      return { output, images: 0, pngBytes: 0, aborted: options.signal.aborted };
    };
    fs.rename = async () => { if(!finalizationEntered) throw Error('rename-outside-lifecycle'); renamed = true; };
    const accounts = { cookieName: 'synthetic', portableFileOperation: async (_t, _e, operation) => operation('synthetic-target') };
    ({ request } = require('./desktop/backup-files').attachBackupFiles(win, origin, accounts));
    Module._load = originalLoad;
    event = { sender: contents, senderFrame: contents.mainFrame };
    (async () => {
      const result = await request(event, { action: 'export', scope: 'guest', generation: 0, restoreId: '', preferences: {} });
      console.log(JSON.stringify({ result, cancel, renamed }));
    })().catch(error => { console.error(error.message); process.exitCode = 1; });
  `;
  const { stdout } = await execute(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, DOCS_PORTAL_READONLY_STORE: '0' },
    timeout: 10000, maxBuffer: 64 * 1024, windowsHide: true
  });
  const proof = JSON.parse(stdout.trim());
  assert.equal(proof.result.ok, true);
  assert.equal(proof.result.aborted, false);
  assert.equal(proof.result.output.endsWith('.incomplete'), false);
  assert.deepEqual(proof.cancel, { ok: false, error: 'backup-busy' });
  assert.equal(proof.renamed, true);
});
