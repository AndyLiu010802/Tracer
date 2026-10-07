'use strict';

// Explicit local file workflow: one bounded PNG in memory at a time.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const Store = require('./store');
const Sync = require('../public/workspace-sync');
const Preferences = require('../public/backup-preferences');
const Companions = require('./companion-backup');
const Images = require('./pet-image');
const Backup = require('./workspace-backup');

const DATA_LIMIT = 4 * 1024 * 1024;
const PNG_LIMIT = 512 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const RESERVE_ID = '00000000-0000-4000-8000-000000000000';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const failure = code => Object.assign(new Error(code), { code });
const jsonBytes = value => Buffer.byteLength(JSON.stringify(value));

function check(options) {
  if (options.signal?.aborted) throw failure('backup-cancelled');
}

function progress(options, phase, done, total) {
  options.onProgress?.({ phase, done, total });
}

function cleanWorkspace(raw) {
  const data = { ...(raw || Sync.empty()), meta: { ...(raw?.meta || {}) } };
  delete data.meta.backupRestore;
  delete data.meta.accountImport;
  const clean = Sync.validate(data);
  if (jsonBytes(clean) > DATA_LIMIT) throw failure('backup-too-large');
  return clean;
}

function payloadFor(workspace, preferences, assets) {
  return { format: 'tracer-portable-directory', version: 1, workspace, preferences, assets };
}

function checkBudget(workspace, preferences, assets) {
  const payload = payloadFor(workspace, preferences, assets);
  // The backup must fit both its manifest and the restored store. Reserve the
  // largest valid revision and a local account-import marker, never import an
  // identity from the backup. Refuse excess data instead of dropping records.
  const restored = {
    ...workspace,
    meta: {
      ...workspace.meta,
      accountImport: RESERVE_ID,
      backupRestore: { id: RESERVE_ID, revision: Number.MAX_SAFE_INTEGER, preferences: Preferences.forRestore(preferences) }
    }
  };
  if (jsonBytes({ payload, checksum: 'f'.repeat(64) }) > DATA_LIMIT || jsonBytes(restored) > DATA_LIMIT) {
    throw failure('backup-too-large');
  }
}

function animationProfile(preferences, url) {
  const state = preferences['tracer.pet.v1'] ? JSON.parse(preferences['tracer.pet.v1']) : null;
  const profile = state?.customs?.find(p => p.animation?.pages.includes(url));
  return profile ? { animation: true, animationVersion: profile.animation.version } : {};
}

async function readImage(directory, url, preferences) {
  const bytes = await Images.readAsset(directory, url);
  if (!bytes) throw failure('backup-art-missing');
  Images.generatedBytes(bytes, animationProfile(preferences, url));
  return bytes;
}

async function readBackupImage(input, asset, preferences, options) {
  check(options);
  let bytes;
  try {
    const folder = path.join(input, 'images');
    bytes = await Images.generatedFile(folder, path.resolve(folder, asset.url.split('/').at(-1)));
    if (bytes.length !== asset.bytes || sha(bytes) !== asset.sha256) throw failure('backup-invalid-assets');
    Images.generatedBytes(bytes, animationProfile(preferences, asset.url));
  } catch (error) {
    if (options.signal?.aborted) throw failure('backup-cancelled');
    throw failure('backup-invalid-assets');
  }
  check(options);
  return bytes;
}

async function writeOwned(file, bytes, created) {
  const handle = await fs.open(file, 'wx', 0o600);
  created.push(file);
  try { await handle.writeFile(bytes); }
  finally { await handle.close(); }
}

async function assertDirectory(directory, code) {
  const stat = await fs.lstat(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw failure(code);
}

async function localFolder(directory, name) {
  const folder = path.join(directory, name);
  await fs.mkdir(folder, { recursive: true });
  await assertDirectory(folder, 'backup-art-conflict');
  if (path.relative(path.join(await fs.realpath(directory), name), await fs.realpath(folder))) {
    throw failure('backup-art-conflict');
  }
  return folder;
}

async function exportDirectory(directory, preferences, output, options = {}) {
  check(options);
  preferences = Preferences.clean(preferences);
  const workspace = cleanWorkspace(await Store.readStore(directory, 'workspace'));
  const urls = Companions.urls(preferences);
  checkBudget(workspace, preferences, urls.map(url => ({ url, bytes: Images.IMAGE_LIMIT, sha256: 'f'.repeat(64) })));
  check(options);
  await fs.mkdir(output);
  const created = [];
  let imagesCreated = false;
  try {
    await assertDirectory(output, 'backup-invalid-assets');
    await fs.mkdir(path.join(output, 'images'));
    imagesCreated = true;
    const assets = [];
    let total = 0;
    for (const url of urls) {
      check(options);
      const bytes = await readImage(directory, url, preferences);
      total += bytes.length;
      if (total > PNG_LIMIT) throw failure('backup-too-large');
      await writeOwned(path.join(output, 'images', url.split('/').at(-1)), bytes, created);
      assets.push({ url, bytes: bytes.length, sha256: sha(bytes) });
      progress(options, 'export', assets.length, urls.length);
    }
    check(options);
    const payload = payloadFor(workspace, preferences, assets);
    checkBudget(workspace, preferences, assets);
    await writeOwned(path.join(output, 'manifest.json'), JSON.stringify({ payload, checksum: Backup.hash(payload) }), created);
    check(options);
    if (options.finalize) {
      // Rename is the final commit, while this function still owns the cleanup
      // ledger. The desktop controller disables cancellation during this phase.
      progress(options, 'commit', 1, 1);
      check(options);
      await options.finalize(output);
    }
    return { images: assets.length, pngBytes: total, output };
  } catch (error) {
    for (const file of created) await fs.unlink(file).catch(() => {});
    if (imagesCreated) await fs.rmdir(path.join(output, 'images')).catch(() => {});
    await fs.rmdir(output).catch(() => {});
    throw error;
  }
}

async function readManifest(input, options) {
  const file = path.join(input, 'manifest.json');
  let handle;
  try {
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw failure('backup-invalid');
    const root = await fs.realpath(input), target = await fs.realpath(file);
    if (path.relative(root, path.dirname(target))) throw failure('backup-invalid');
    handle = await fs.open(target, 'r');
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.size < 1) throw failure('backup-invalid');
    if (before.size > DATA_LIMIT) throw failure('backup-too-large');
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      check(options);
      const { bytesRead } = await handle.read(bytes, offset, Math.min(65536, bytes.length - offset), offset);
      if (!bytesRead) throw failure('backup-invalid');
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || after.nlink !== 1) {
      throw failure('backup-invalid');
    }
    check(options);
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    if (error.code?.startsWith('backup-')) throw error;
    throw failure('backup-invalid');
  } finally { await handle?.close().catch(() => {}); }
}

async function inspectDirectory(input, options = {}) {
  check(options);
  await assertDirectory(input, 'backup-invalid-assets');
  await assertDirectory(path.join(input, 'images'), 'backup-invalid-assets');
  const manifest = await readManifest(input, options), payload = manifest?.payload;
  if (!payload || payload.format !== 'tracer-portable-directory' || payload.version !== 1 ||
      Backup.hash(payload) !== manifest.checksum || Object.keys(payload).sort().join(',') !== 'assets,format,preferences,version,workspace') {
    throw failure('backup-invalid');
  }
  const preferences = Preferences.clean(payload.preferences), workspace = cleanWorkspace(payload.workspace);
  if (Backup.hash(preferences) !== Backup.hash(payload.preferences) || Backup.hash(workspace) !== Backup.hash(payload.workspace)) {
    throw failure('backup-invalid');
  }
  const urls = Companions.urls(preferences);
  if (!Array.isArray(payload.assets) || payload.assets.length !== urls.length) throw failure('backup-invalid-assets');
  if (payload.assets.reduce((n, a) => n + (Number.isSafeInteger(a?.bytes) ? a.bytes : Infinity), 0) > PNG_LIMIT) {
    throw failure('backup-too-large');
  }
  checkBudget(workspace, preferences, payload.assets);
  for (let i = 0; i < urls.length; i++) {
    const asset = payload.assets[i];
    if (!asset || asset.url !== urls[i] || !Images.ASSET_RE.test(asset.url) ||
        !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > Images.IMAGE_LIMIT || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
      throw failure('backup-invalid-assets');
    }
    await readBackupImage(input, asset, preferences, options);
    progress(options, 'validate', i + 1, urls.length);
  }
  check(options);
  return payload;
}

function restoredWorkspace(previous, workspace, preferences, restoreId) {
  const oldRevision = previous?.meta?.backupRestore?.revision || 0;
  if (!Number.isSafeInteger(oldRevision) || oldRevision < 0 || oldRevision >= Number.MAX_SAFE_INTEGER) throw failure('backup-invalid');
  const next = { ...workspace, meta: { ...workspace.meta } };
  if (UUID.test(previous?.meta?.accountImport || '')) next.meta.accountImport = previous.meta.accountImport;
  next.meta.backupRestore = { id: restoreId, revision: oldRevision + 1, preferences };
  if (jsonBytes(next) > DATA_LIMIT) throw failure('backup-too-large');
  return next;
}

async function restoreDirectory(input, directory, currentPreferences, options = {}) {
  check(options);
  if (options.confirm !== true) throw failure('backup-confirmation-required');
  const payload = await inspectDirectory(input, options), current = await Store.readStore(directory, 'workspace');
  const expected = Backup.hash(current);
  if (options.expected && options.expected !== expected) throw failure('backup-stale');
  const restoreId = crypto.randomUUID(), preferences = Preferences.forRestore(payload.preferences);
  restoredWorkspace(current, payload.workspace, preferences, restoreId);
  const backups = await localFolder(directory, '.backups');
  const snapshot = path.join(backups, 'portable-' + crypto.randomUUID());
  await exportDirectory(directory, currentPreferences, snapshot, { ...options, finalize: undefined, onProgress: p => progress(options, 'snapshot', p.done, p.total) });
  const folder = await localFolder(directory, '.pet-art');
  const created = [];
  try {
    let done = 0;
    for (const asset of payload.assets) {
      check(options);
      const existing = await Images.readAsset(directory, asset.url);
      if (existing) {
        if (sha(existing) !== asset.sha256) throw failure('backup-art-conflict');
        progress(options, 'restore', ++done, payload.assets.length);
        continue;
      }
      const bytes = await readBackupImage(input, asset, payload.preferences, options);
      const file = path.join(folder, asset.url.split('/').at(-1));
      try { await writeOwned(file, bytes, created); }
      catch (error) { if (error.code === 'EEXIST') throw failure('backup-art-conflict'); throw error; }
      check(options);
      progress(options, 'restore', ++done, payload.assets.length);
    }
    check(options);
    progress(options, 'commit', 1, 1);
    await Store.writeStore(directory, 'workspace', JSON.stringify(payload.workspace), (previous, next) => {
      check(options);
      if (Backup.hash(previous) !== expected) throw failure('backup-stale');
      return restoredWorkspace(previous, next, preferences, restoreId);
    });
    return { restoreId, snapshot, images: payload.assets.length };
  } catch (error) {
    for (const file of created) await fs.unlink(file).catch(() => {});
    throw error;
  }
}

module.exports = { exportDirectory, inspectDirectory, restoreDirectory };
