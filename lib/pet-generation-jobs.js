'use strict';
const fs = require('node:fs/promises'), { constants } = require('node:fs');
const path = require('node:path'), crypto = require('node:crypto');
const Images = require('./pet-image');
const actions = new Set(['personal-pet-image', 'codex-pet-image']);
const scopes = new Map(), JOURNAL_LIMIT = 4096;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const error = (code, cause) => Object.assign(new Error(code), { code, ...(cause ? { cause } : {}) });
const samePath = (left, right) => !path.relative(left, right);
function systemPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'darwin' ? resolved.replace(/^\/(var|tmp)(?=\/|$)/, '/private/$1') : resolved;
}
function keys(value, names) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}
function resultOf(value, profile, code = 'invalid-animation-response') {
  const version = profile.animationVersion || 1;
  if (!value || typeof value.image !== 'string' || !Images.ASSET_RE.test(value.image) || value.animationPage !== profile.animationPage ||
      (value.animationVersion === undefined ? 1 : value.animationVersion) !== version) throw error(code);
  return { image: value.image, animationVersion: version, animationPage: profile.animationPage };
}

// Walk the supplied ancestors, not just their resolved destination. This accepts
// Windows short names while still rejecting junctions, symlinks and non-directories.
async function directory(value) {
  const resolved = systemPath(value), base = path.parse(resolved).root;
  let cursor = base;
  for (const component of ['', ...path.relative(base, resolved).split(path.sep).filter(Boolean)]) {
    if (component) cursor = path.join(cursor, component);
    let stat;
    try { stat = await fs.lstat(cursor); }
    catch (failure) {
      if (failure.code !== 'ENOENT') throw failure;
      try { await fs.mkdir(cursor, { mode: 0o700 }); } catch (failure) { if (failure.code !== 'EEXIST') throw failure; }
      stat = await fs.lstat(cursor);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw error('pet-generation-journal-corrupt');
  }
  return fs.realpath(resolved);
}
async function journalFolder(dir) {
  const base = await directory(dir), folder = await directory(path.join(dir, '.pet-generation-jobs'));
  if (!samePath(folder, path.join(base, '.pet-generation-jobs'))) throw error('pet-generation-journal-corrupt');
  return folder;
}
async function readJournal(file, profile) {
  let initial;
  try { initial = await fs.lstat(file); }
  catch (failure) { if (failure.code === 'ENOENT') return null; throw error('pet-generation-journal-read-failed', failure); }
  let handle;
  try {
    if (!initial.isFile() || initial.isSymbolicLink() || initial.nlink !== 1 || initial.size < 1 || initial.size > JOURNAL_LIMIT || !samePath(await fs.realpath(file), file)) throw error('pet-generation-journal-corrupt');
    handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.ino !== initial.ino || stat.dev !== initial.dev || stat.size !== initial.size) throw error('pet-generation-journal-corrupt');
    const bytes = Buffer.alloc(stat.size); let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) throw error('pet-generation-journal-corrupt');
      offset += bytesRead;
    }
    const after = await handle.stat(), current = await fs.lstat(file);
    if (after.nlink !== 1 || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs || current.isSymbolicLink() || current.ino !== stat.ino || current.dev !== stat.dev) throw error('pet-generation-journal-corrupt');
    let record;
    try { record = JSON.parse(bytes.toString('utf8')); } catch { throw error('pet-generation-journal-corrupt'); }
    if (!keys(record, ['version', 'requestHash', 'result']) || record.version !== 1 || typeof record.requestHash !== 'string' || !/^[a-f0-9]{64}$/.test(record.requestHash) ||
        !keys(record.result, ['image', 'animationVersion', 'animationPage']) || ![1, 2, 3].includes(record.result.animationVersion) || !Number.isInteger(record.result.animationPage) ||
        record.result.animationPage !== profile.animationPage || record.result.animationPage < 0 || record.result.animationPage >= (record.result.animationVersion >= 2 ? 16 : 4)) throw error('pet-generation-journal-corrupt');
    return { version: 1, requestHash: record.requestHash, result: resultOf(record.result, record.result, 'pet-generation-journal-corrupt') };
  } catch (failure) {
    if (failure.code === 'pet-generation-journal-corrupt') throw failure;
    throw error('pet-generation-journal-read-failed', failure);
  } finally { await handle?.close().catch(() => {}); }
}
async function writeJournal(dir, filename, record, profile) {
  let temporary, handle;
  try {
    const folder = await journalFolder(dir), file = path.join(folder, filename), previous = await readJournal(file, profile);
    if (previous) {
      if (previous.requestHash !== record.requestHash || JSON.stringify(previous.result) !== JSON.stringify(record.result)) throw error('pet-generation-conflict');
      return;
    }
    temporary = path.join(folder, filename + '.' + crypto.randomBytes(12).toString('hex') + '.tmp');
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(record), 'utf8'); await handle.sync(); await handle.close(); handle = null;
    if (!samePath(await journalFolder(dir), folder)) throw error('pet-generation-journal-corrupt');
    await fs.rename(temporary, file); temporary = null;
  } catch (failure) {
    if (['pet-generation-conflict', 'pet-generation-journal-corrupt', 'pet-generation-journal-read-failed'].includes(failure.code)) throw failure;
    throw error('pet-generation-journal-save-failed', failure);
  } finally {
    await handle?.close().catch(() => {});
    if (temporary) await fs.unlink(temporary).catch(() => {});
  }
}
async function verifyArtwork(dir, result) {
  const bytes = await Images.readAsset(dir, result.image);
  if (!bytes) throw error('pet-generation-art-missing');
  try { Images.generatedBytes(bytes, { animation: true, animationVersion: result.animationVersion }); } catch (failure) { throw error('pet-generation-art-missing', failure); }
}

function createJobs(dir) {
  const location = systemPath(dir), scope = process.platform === 'win32' ? location.toLowerCase() : location;
  if (!scopes.has(scope)) scopes.set(scope, new Map());
  const jobs = scopes.get(scope);
  return {
    run(action, data, generateFn) {
      if (!actions.has(action) || data?.generationId === undefined) return Promise.resolve().then(() => generateFn());
      let profile, requestHash, key;
      try {
        if (typeof data.generationId !== 'string' || !/^[a-f0-9]{32}$/.test(data.generationId)) throw error('invalid-generation-id');
        const attempt = data.generationAttempt === undefined ? 0 : data.generationAttempt;
        if (!Number.isInteger(attempt) || attempt < 0 || attempt > 1000) throw error('invalid-generation-attempt');
        profile = Images.input(data);
        if (profile.animationPage === undefined) throw error('invalid-generation-page');
        // Name and personality may be edited as collection metadata without redrawing
        // completed artwork. Explicitly starting over gives artwork a new generation ID.
        requestHash = hash(JSON.stringify({ action, photoHash: hash(profile.bytes), mime: profile.mime, kind: profile.kind,
          distinctiveFeatures: profile.distinctiveFeatures, model: profile.model, ...(profile.actionDescription ? { actionDescription: profile.actionDescription } : {}),
          animationVersion: profile.animationVersion || 1, animationPage: profile.animationPage, identityImage: profile.identityImage || '' }));
        key = data.generationId + '-' + profile.animationPage + '-' + attempt;
      } catch (failure) { return Promise.reject(failure); }
      let state = jobs.get(key);
      if (state && state.requestHash !== requestHash) return Promise.reject(error('pet-generation-conflict'));
      if (!state) { state = { requestHash, result: null, persisted: false, started: false, pending: null }; jobs.set(key, state); }
      if (state.pending) return state.pending;
      const operation = (async () => {
        if (!state.result) {
          let folder;
          try { folder = await journalFolder(dir); }
          catch (failure) { throw failure.code === 'pet-generation-journal-corrupt' ? failure : error('pet-generation-journal-read-failed', failure); }
          const previous = await readJournal(path.join(folder, key + '.json'), profile);
          if (previous) {
            if (previous.requestHash !== requestHash) throw error('pet-generation-conflict');
            state.result = resultOf(previous.result, profile, 'pet-generation-journal-corrupt'); state.persisted = true;
          } else {
            // Retain a successful provider result before any further disk operation.
            // A journal failure must never turn a retry into another paid generation.
            state.started = true;
            state.result = resultOf(await generateFn(), profile);
          }
        }
        await verifyArtwork(dir, state.result);
        if (!state.persisted) {
          await writeJournal(dir, key + '.json', { version: 1, requestHash, result: state.result }, profile);
          state.persisted = true;
        }
        return { ...state.result };
      })();
      state.pending = operation;
      operation.then(() => { state.pending = null; jobs.delete(key); }, () => {
        state.pending = null;
        if (!state.result && !state.started) jobs.delete(key);
      });
      return operation;
    }
  };
}
module.exports = { createJobs };
