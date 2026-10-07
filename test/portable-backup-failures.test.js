'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const Images = require('../lib/pet-image');
const Pet = require('../skins/tracer/pet-model');
const Model = require('../skins/tracer/model');
const Store = require('../lib/store');
const Portable = require('../lib/portable-backup');
const Backup = require('../lib/workspace-backup');

// Every path belongs to a newly created synthetic test room. Fault injection is
// restricted to that room, so it cannot read or alter a running user's data.
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, value) {
  const result = Buffer.alloc(value.length + 12);
  result.writeUInt32BE(value.length);
  result.write(type, 4);
  value.copy(result, 8);
  result.writeUInt32BE(crc(result.subarray(4, -4)), result.length - 4);
  return result;
}

function png(color) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.from([0, color, 160, 140, 255]))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function preferences(customs) {
  const state = Pet.fresh(1);
  state.customs = customs;
  state.unlocked.push(...customs.map(row => row.id), 'garden_neon_orchid_shiny');
  state.selected = customs[0].id;
  for (const row of customs) state.pets[row.id] = { food: 62, energy: 81, joy: 73, bond: 68, sleeping: false };
  return { 'tracer.pet.v1': JSON.stringify(state) };
}

const custom = (index, image) => ({ id: 'custom_' + index.toString(16).padStart(32, '0'), name: 'Synthetic ' + index, kind: 'creature', image, personality: '' });
const assetPath = (directory, url) => path.join(directory, '.pet-art', url.split('/').at(-1));
const imagePath = (directory, url) => path.join(directory, 'images', url.split('/').at(-1));
const ioFailure = code => Object.assign(new Error('synthetic ' + code), { code });

async function exists(file) {
  try { await fs.lstat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function setup(t) {
  const temporary = path.resolve(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temporary, 'tracer-portable-failures-'));
  assert.equal(path.dirname(root), temporary);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), target = path.join(root, 'target'), backup = path.join(root, 'export');
  await fs.mkdir(source);
  await fs.mkdir(target);
  const resources = [];
  for (let i = 0; i < 3; i++) {
    const bytes = png(100 + i * 20);
    resources.push({ url: await Images.storeGenerated(source, bytes), bytes });
  }
  resources.sort((a, b) => a.url.localeCompare(b.url));
  const sourcePreferences = preferences(resources.map((row, i) => custom(i + 1, row.url)));
  const sourceWorkspace = Model.emptyWorkspace();
  Model.addTask(sourceWorkspace, { title: 'Synthetic incoming task' });
  await Store.writeStore(source, 'workspace', JSON.stringify(sourceWorkspace));

  // The first incoming resource already exists; an unrelated target resource
  // must survive cancellation/rollback too. Only resources[1..2] are new.
  await fs.mkdir(path.join(target, '.pet-art'));
  await fs.copyFile(assetPath(source, resources[0].url), assetPath(target, resources[0].url));
  const unrelated = { bytes: png(230) };
  unrelated.url = await Images.storeGenerated(target, unrelated.bytes);
  const targetPreferences = preferences([custom(1, resources[0].url), custom(4, unrelated.url)]);
  const targetWorkspace = Model.emptyWorkspace();
  Model.addTask(targetWorkspace, { title: 'Synthetic existing task' });
  await Store.writeStore(target, 'workspace', JSON.stringify(targetWorkspace));
  const targetText = await fs.readFile(path.join(target, 'workspace.json'), 'utf8');
  await Portable.exportDirectory(source, sourcePreferences, backup);
  return { root, source, target, backup, resources, unrelated, sourcePreferences, targetPreferences, targetWorkspace, targetText };
}

async function assertTargetUntouched(f, expectedText = f.targetText) {
  assert.equal(await fs.readFile(path.join(f.target, 'workspace.json'), 'utf8'), expectedText);
  assert.deepEqual(await Images.readAsset(f.target, f.resources[0].url), f.resources[0].bytes);
  assert.deepEqual(await Images.readAsset(f.target, f.unrelated.url), f.unrelated.bytes);
  for (const row of f.resources.slice(1)) assert.equal(await exists(assetPath(f.target, row.url)), false);
  assert.deepEqual((await fs.readdir(path.join(f.target, '.pet-art'))).sort(), [f.resources[0].url, f.unrelated.url].map(url => url.split('/').at(-1)).sort());
}

function failWriting(t, file, code = 'ENOSPC') {
  const originalOpen = fs.open;
  t.mock.method(fs, 'open', async function (pathname, ...args) {
    const handle = await originalOpen.call(fs, pathname, ...args);
    if (path.resolve(pathname) === path.resolve(file)) {
      const originalWrite = handle.writeFile.bind(handle);
      handle.writeFile = async function (bytes) {
        await originalWrite(bytes.subarray ? bytes.subarray(0, 16) : String(bytes).slice(0, 16));
        throw ioFailure(code);
      };
    }
    return handle;
  });
}

test('export cancellation removes only its files, retaining a concurrently created unrelated file', async t => {
  const f = await setup(t), output = path.join(f.root, 'cancelled-export'), controller = new AbortController();
  const sentinel = path.join(output, 'images', 'unrelated.txt');
  await assert.rejects(Portable.exportDirectory(f.source, f.sourcePreferences, output, {
    signal: controller.signal,
    onProgress(p) {
      if (p.phase === 'export' && p.done === 1) {
        syncFs.writeFileSync(sentinel, 'belongs to another operation');
        controller.abort();
      }
    }
  }), { code: 'backup-cancelled' });
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'belongs to another operation');
  assert.deepEqual(await fs.readdir(path.join(output, 'images')), ['unrelated.txt']);
  assert.equal(await exists(path.join(output, 'manifest.json')), false);
  for (const row of f.resources) assert.deepEqual(await Images.readAsset(f.source, row.url), row.bytes);
});

test('export image ENOSPC cleans partial and prior owned files without touching source', async t => {
  const f = await setup(t), output = path.join(f.root, 'full-disk-export');
  failWriting(t, imagePath(output, f.resources[1].url));
  await assert.rejects(Portable.exportDirectory(f.source, f.sourcePreferences, output), { code: 'ENOSPC' });
  assert.equal(await exists(output), false);
  for (const row of f.resources) assert.deepEqual(await Images.readAsset(f.source, row.url), row.bytes);
});

test('export manifest ENOSPC removes its completed images and partial manifest', async t => {
  const f = await setup(t), output = path.join(f.root, 'manifest-full-disk-export');
  failWriting(t, path.join(output, 'manifest.json'));
  await assert.rejects(Portable.exportDirectory(f.source, f.sourcePreferences, output), { code: 'ENOSPC' });
  assert.equal(await exists(output), false);
});

test('export racing image conflict never overwrites or deletes the other file', async t => {
  const f = await setup(t), output = path.join(f.root, 'conflicting-export');
  const conflict = imagePath(output, f.resources[1].url), originalOpen = fs.open;
  t.mock.method(fs, 'open', async function (file, ...args) {
    if (path.resolve(file) === path.resolve(conflict)) await fs.writeFile(conflict, 'unrelated raced file', { flag: 'wx' });
    return originalOpen.call(fs, file, ...args);
  });
  await assert.rejects(Portable.exportDirectory(f.source, f.sourcePreferences, output), { code: 'EEXIST' });
  assert.equal(await fs.readFile(conflict, 'utf8'), 'unrelated raced file');
  assert.deepEqual(await fs.readdir(path.join(output, 'images')), [path.basename(conflict)]);
  assert.equal(await exists(path.join(output, 'manifest.json')), false);
});

test('restore validation cancellation leaves resources/tasks unchanged and creates no snapshot', async t => {
  const f = await setup(t), controller = new AbortController();
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, {
    confirm: true, signal: controller.signal,
    onProgress(p) { if (p.phase === 'validate' && p.done === 1) controller.abort(); }
  }), { code: 'backup-cancelled' });
  await assertTargetUntouched(f);
  assert.equal(await exists(path.join(f.target, '.backups')), false);
});

test('restore cancellation after a new resource rolls back only additions and retains a usable snapshot', async t => {
  const f = await setup(t), controller = new AbortController();
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, {
    confirm: true, signal: controller.signal,
    onProgress(p) { if (p.phase === 'restore' && p.done === 2) controller.abort(); }
  }), { code: 'backup-cancelled' });
  await assertTargetUntouched(f);
  const snapshots = await fs.readdir(path.join(f.target, '.backups'));
  assert.equal(snapshots.length, 1);
  const snapshot = await Portable.inspectDirectory(path.join(f.target, '.backups', snapshots[0]));
  assert.equal(snapshot.assets.length, 2);
  assert.equal(snapshot.workspace.tasks[0].title, 'Synthetic existing task');
  assert.equal(JSON.parse(snapshot.preferences['tracer.pet.v1']).selected, 'custom_' + '1'.padStart(32, '0'));
});

test('restore cancellation immediately before commit does not change workspace or retain staged additions', async t => {
  const f = await setup(t), controller = new AbortController();
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, {
    confirm: true, signal: controller.signal,
    onProgress(p) { if (p.phase === 'commit') controller.abort(); }
  }), { code: 'backup-cancelled' });
  await assertTargetUntouched(f);
});

test('restore resource write failure rolls back partial and earlier additions, retaining preexisting resources', async t => {
  const f = await setup(t), failed = assetPath(f.target, f.resources[2].url), originalOpen = fs.open;
  let reachedFailure = false;
  t.mock.method(fs, 'open', async function (file, ...args) {
    const handle = await originalOpen.call(fs, file, ...args);
    if (path.resolve(file) === path.resolve(failed) && args[0] === 'wx') {
      const originalWrite = handle.writeFile.bind(handle);
      handle.writeFile = async function (bytes) {
        assert.equal(await exists(assetPath(f.target, f.resources[1].url)), true, 'first new resource must already have been staged');
        reachedFailure = true;
        await originalWrite(bytes.subarray(0, 16));
        throw ioFailure('ENOSPC');
      };
    }
    return handle;
  });
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, { confirm: true }), { code: 'ENOSPC' });
  assert.equal(reachedFailure, true);
  await assertTargetUntouched(f);
});

test('cancellation during the final manifest write removes only owned output, including that manifest', async t => {
  const f = await setup(t), output = path.join(f.root, 'late-cancel-export'), controller = new AbortController();
  const originalOpen = fs.open, manifest = path.join(output, 'manifest.json');
  const sentinel = path.join(output, 'images', 'another-operation.txt');
  t.mock.method(fs, 'open', async function (file, ...args) {
    const handle = await originalOpen.call(fs, file, ...args);
    if (path.resolve(file) === path.resolve(manifest) && args[0] === 'wx') {
      const originalWrite = handle.writeFile.bind(handle);
      handle.writeFile = async function (bytes) {
        await originalWrite(bytes);
        await fs.writeFile(sentinel, 'preserve outside ownership');
        controller.abort();
      };
    }
    return handle;
  });
  await assert.rejects(Portable.exportDirectory(f.source, f.sourcePreferences, output, { signal: controller.signal }), { code: 'backup-cancelled' });
  assert.equal(await exists(manifest), false);
  assert.deepEqual(await fs.readdir(path.join(output, 'images')), ['another-operation.txt']);
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'preserve outside ownership');
});

test('finalization failure cleans the owned incomplete backup and preserves an unrelated file', async t => {
  const f = await setup(t), output = path.join(f.root, 'failed-finalize-export');
  const sentinel = path.join(output, 'images', 'another-operation.txt');
  await assert.rejects(Portable.exportDirectory(f.source, f.sourcePreferences, output, {
    finalize: async () => { await fs.writeFile(sentinel, 'unowned finalization file'); throw ioFailure('EIO'); }
  }), { code: 'EIO' });
  assert.equal(await exists(path.join(output, 'manifest.json')), false);
  assert.deepEqual(await fs.readdir(path.join(output, 'images')), ['another-operation.txt']);
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'unowned finalization file');
});

test('source artwork changed after inspection is revalidated before restoration', async t => {
  const f = await setup(t);
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, {
    confirm: true,
    onProgress(p) {
      if (p.phase === 'validate' && p.done === f.resources.length) syncFs.writeFileSync(imagePath(f.backup, f.resources[1].url), png(55));
    }
  }), { code: 'backup-invalid-assets' });
  await assertTargetUntouched(f);
});

test('image descriptor size over the per-file limit is rejected before reading image bytes', async t => {
  const f = await setup(t), source = imagePath(f.backup, f.resources[0].url), originalOpen = fs.open;
  let reads = 0, inspected = false;
  t.mock.method(fs, 'open', async function (file, ...args) {
    const handle = await originalOpen.call(fs, file, ...args);
    if (path.resolve(file) === path.resolve(source) && args[0] === 'r') {
      const originalStat = handle.stat.bind(handle), originalRead = handle.read.bind(handle);
      handle.stat = async () => { const stat = await originalStat(); stat.size = Images.IMAGE_LIMIT + 1; inspected = true; return stat; };
      handle.read = (...values) => { reads++; return originalRead(...values); };
    }
    return handle;
  });
  await assert.rejects(Portable.inspectDirectory(f.backup), { code: 'backup-invalid-assets' });
  assert.equal(inspected, true);
  assert.equal(reads, 0);
  await assertTargetUntouched(f);
});

test('hardlinked image resources are rejected without touching target data', async t => {
  const f = await setup(t), file = imagePath(f.backup, f.resources[0].url);
  await fs.unlink(file);
  await fs.link(assetPath(f.source, f.resources[0].url), file);
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, { confirm: true }), { code: 'backup-invalid-assets' });
  await assertTargetUntouched(f);
});

test('manifest descriptor size over its limit is rejected before reading manifest bytes', async t => {
  const f = await setup(t), file = path.join(f.backup, 'manifest.json'), originalOpen = fs.open;
  let reads = 0, inspected = false;
  t.mock.method(fs, 'open', async function (pathname, ...args) {
    const handle = await originalOpen.call(fs, pathname, ...args);
    if (path.resolve(pathname) === path.resolve(file) && args[0] === 'r') {
      const originalStat = handle.stat.bind(handle), originalRead = handle.read.bind(handle);
      handle.stat = async () => { const stat = await originalStat(); stat.size = 4 * 1024 * 1024 + 1; inspected = true; return stat; };
      handle.read = (...values) => { reads++; return originalRead(...values); };
    }
    return handle;
  });
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, { confirm: true }), { code: 'backup-too-large' });
  assert.equal(inspected, true);
  assert.equal(reads, 0);
  await assertTargetUntouched(f);
});

test('a redirected backup images directory is rejected before restoration', async t => {
  const f = await setup(t), images = path.join(f.backup, 'images'), redirected = path.join(f.root, 'redirected-images');
  await fs.rename(images, redirected);
  try { await fs.symlink(redirected, images, 'junction'); }
  catch (error) { if (['EPERM', 'ENOSYS'].includes(error.code)) { t.skip('directory links unavailable in this executor'); return; } throw error; }
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, { confirm: true }), { code: 'backup-invalid-assets' });
  await assertTargetUntouched(f);
});

test('a redirected target snapshot directory cannot receive backup files outside its data root', async t => {
  const f = await setup(t), outside = path.join(f.root, 'outside-target');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'unrelated.txt'), 'keep unrelated files');
  try { await fs.symlink(outside, path.join(f.target, '.backups'), 'junction'); }
  catch (error) { if (['EPERM', 'ENOSYS'].includes(error.code)) { t.skip('directory links unavailable in this executor'); return; } throw error; }
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, { confirm: true }), { code: 'backup-art-conflict' });
  assert.deepEqual(await fs.readdir(outside), ['unrelated.txt']);
  assert.equal(await fs.readFile(path.join(outside, 'unrelated.txt'), 'utf8'), 'keep unrelated files');
  await assertTargetUntouched(f);
});

test('restore snapshot write failure aborts before staging and cleans the incomplete snapshot only', async t => {
  const f = await setup(t), backups = path.join(f.target, '.backups'), originalOpen = fs.open;
  await fs.mkdir(backups);
  const sentinel = path.join(backups, 'unrelated.txt');
  await fs.writeFile(sentinel, 'previous unrelated file');
  let reachedFailure = false;
  t.mock.method(fs, 'open', async function (file, ...args) {
    const handle = await originalOpen.call(fs, file, ...args);
    if (path.resolve(file).startsWith(path.resolve(backups) + path.sep) && path.basename(file) === 'manifest.json') {
      const originalWrite = handle.writeFile.bind(handle);
      handle.writeFile = async function (bytes) {
        reachedFailure = true;
        await originalWrite(String(bytes).slice(0, 16));
        throw ioFailure('ENOSPC');
      };
    }
    return handle;
  });
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, { confirm: true }), { code: 'ENOSPC' });
  assert.equal(reachedFailure, true);
  await assertTargetUntouched(f);
  assert.deepEqual(await fs.readdir(backups), ['unrelated.txt']);
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'previous unrelated file');
});

test('actual atomic commit rename failure preserves prior workspace/assets and removes staged additions', async t => {
  const f = await setup(t), main = path.join(f.target, 'workspace.json'), originalRename = fs.rename;
  t.mock.method(fs, 'rename', async function (from, to) {
    if (path.resolve(to) === path.resolve(main)) throw ioFailure('EIO');
    return originalRename.call(fs, from, to);
  });
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, { confirm: true }), { code: 'EIO' });
  await assertTargetUntouched(f);
  assert.equal(await fs.readFile(main + '.bak', 'utf8'), f.targetText);
  assert.equal((await fs.readdir(f.target)).some(name => name.endsWith('.tmp')), false);
});

test('concurrent task edit wins over stale restore and rollback preserves that edit', async t => {
  const f = await setup(t), edited = structuredClone(f.targetWorkspace);
  Model.addTask(edited, { title: 'Synthetic concurrent task' });
  const editedText = JSON.stringify(edited);
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, {
    confirm: true,
    onProgress(p) { if (p.phase === 'commit') syncFs.writeFileSync(path.join(f.target, 'workspace.json'), editedText); }
  }), { code: 'backup-stale' });
  await assertTargetUntouched(f, editedText);
  assert.equal((await Store.readStore(f.target, 'workspace')).tasks.length, 2);
});

test('truncated manifest JSON is rejected as backup-invalid before writing target', async t => {
  const f = await setup(t);
  await fs.writeFile(path.join(f.backup, 'manifest.json'), '{"payload":');
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, { confirm: true }), { code: 'backup-invalid' });
  await assertTargetUntouched(f);
  assert.equal(await exists(path.join(f.target, '.backups')), false);
});

test('valid JSON with a stale checksum is rejected before writing target', async t => {
  const f = await setup(t), file = path.join(f.backup, 'manifest.json'), manifest = JSON.parse(await fs.readFile(file, 'utf8'));
  manifest.payload.workspace.tasks[0].title = 'Tampered task';
  await fs.writeFile(file, JSON.stringify(manifest));
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, { confirm: true }), { code: 'backup-invalid' });
  await assertTargetUntouched(f);
});

test('rehashed path-traversal asset is rejected without reading or writing the escaped path', async t => {
  const f = await setup(t), file = path.join(f.backup, 'manifest.json'), manifest = JSON.parse(await fs.readFile(file, 'utf8'));
  const sentinel = path.join(f.root, 'outside.png');
  await fs.writeFile(sentinel, 'not a backup resource');
  manifest.payload.assets[0].url = '../../outside.png';
  manifest.checksum = Backup.hash(manifest.payload);
  await fs.writeFile(file, JSON.stringify(manifest));
  const originalRead = fs.readFile;
  t.mock.method(fs, 'readFile', async function (pathname, ...args) {
    assert.notEqual(path.resolve(pathname), path.resolve(sentinel), 'invalid URL must be rejected before opening the escaped file');
    return originalRead.call(fs, pathname, ...args);
  });
  await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, { confirm: true }), { code: 'backup-invalid-assets' });
  t.mock.restoreAll();
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'not a backup resource');
  await assertTargetUntouched(f);
});

test('portable workflow rejects old signed JSON format and unsupported directory versions', async t => {
  const f = await setup(t), file = path.join(f.backup, 'manifest.json'), original = JSON.parse(await fs.readFile(file, 'utf8'));
  for (const alteration of [{ format: 'tracer-workspace-backup' }, { version: 0 }, { version: 2 }]) {
    const payload = { ...original.payload, ...alteration };
    await fs.writeFile(file, JSON.stringify({ payload, checksum: Backup.hash(payload) }));
    await assert.rejects(Portable.restoreDirectory(f.backup, f.target, f.targetPreferences, { confirm: true }), { code: 'backup-invalid' });
    await assertTargetUntouched(f);
  }
  assert.equal(await exists(path.join(f.target, '.backups')), false);
});
