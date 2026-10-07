'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const BASE = 'HKCU\\Software\\Classes';
const PARENTS = Object.freeze([BASE + '\\DesktopBackground', BASE + '\\DesktopBackground\\Shell']);
const MARKER = 'TracerLocalEffectsParent';
const TOKEN = /^[a-f0-9]{64}$/;
const FILE = 'local-vfx-shell-parents.json';
const fail = code => { throw Error(code); };
const copy = value => JSON.parse(JSON.stringify(value));

function exact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const names = Reflect.ownKeys(value);
  return names.length === fields.length && names.every(name => fields.includes(name) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, name), 'value'));
}
function validateRecord(record, launch) {
  if (!exact(record, ['version', 'launch', 'claims']) || record.version !== 1 || !exact(record.launch, ['kind', 'executable', 'appPath']) ||
      ['kind', 'executable', 'appPath'].some(field => record.launch[field] !== launch[field]) || !Array.isArray(record.claims) || Object.getPrototypeOf(record.claims) !== Array.prototype || record.claims.length > 2 ||
      Reflect.ownKeys(record.claims).length !== record.claims.length + 1) fail('parents-receipt-invalid');
  let previous = -1;
  for (let index = 0; index < record.claims.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(record.claims, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('parents-receipt-invalid');
    const claim = descriptor.value;
    const position = exact(claim, ['key', 'token', 'state']) ? PARENTS.indexOf(claim.key) : -1;
    if (position <= previous || typeof claim.token !== 'string' || !TOKEN.test(claim.token) || !['pending', 'created'].includes(claim.state)) fail('parents-receipt-invalid');
    previous = position;
  }
  return copy(record);
}

// Files supply bounded creation records, not arbitrary registry authority.
// Native token matching and transactions are also required for each removal.
function createReceiptStore(userData, launch) {
  if (typeof userData !== 'string' || !path.isAbsolute(userData) || /[\x00-\x1f"%]/.test(userData)) fail('parents-receipt-path-invalid');
  const directory = path.resolve(userData), file = path.join(directory, FILE), lock = file + '.lock';
  function checkedAncestors(target) {
    const root = path.parse(target).root;
    let cursor = root;
    for (const piece of target.slice(root.length).split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, piece);
      try { if (fs.lstatSync(cursor).isSymbolicLink()) fail('parents-receipt-path-invalid'); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    }
  }
  function checkedFile(target) {
    checkedAncestors(path.dirname(target));
    let stat;
    try { stat = fs.lstatSync(target); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 16384) fail('parents-receipt-path-invalid');
    return true;
  }
  function read() {
    try {
      if (!checkedFile(file)) return null;
      const fd = fs.openSync(file, 'r');
      try {
        const stat = fs.fstatSync(fd);
        if (!stat.isFile() || stat.nlink !== 1 || stat.size > 16384) fail('parents-receipt-path-invalid');
        // A concurrent append cannot turn a bounded receipt into an unbounded
        // allocation after the fstat size check.
        const buffer = Buffer.alloc(16385), length = fs.readSync(fd, buffer, 0, buffer.length, 0);
        if (length > 16384) fail('parents-receipt-path-invalid');
        return validateRecord(JSON.parse(buffer.subarray(0, length).toString('utf8')), launch);
      } finally { fs.closeSync(fd); }
    } catch (error) { if (error.message.startsWith('parents-')) throw error; fail('parents-receipt-read-failed'); }
  }
  function save(record) {
    validateRecord(record, launch);
    const temporary = file + '.' + crypto.randomBytes(16).toString('hex') + '.tmp';
    let fd;
    try {
      checkedAncestors(directory);
      fs.mkdirSync(directory, { recursive: true });
      checkedAncestors(directory);
      checkedFile(file);
      fd = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(fd, JSON.stringify(record) + '\n', 'utf8');
      fs.fsyncSync(fd);
      fs.closeSync(fd); fd = undefined;
      fs.renameSync(temporary, file);
    } catch (error) { if (error.message.startsWith('parents-')) throw error; fail('parents-receipt-write-failed'); }
    finally {
      if (fd !== undefined) fs.closeSync(fd);
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') { /* bounded best-effort temporary cleanup */ } }
    }
  }
  function exclusive(work) {
    let fd;
    try {
      checkedAncestors(directory); fs.mkdirSync(directory, { recursive: true }); checkedAncestors(directory);
      fd = fs.openSync(lock, 'wx', 0o600);
    } catch (error) { if (error.message.startsWith('parents-')) throw error; fail(error.code === 'EEXIST' ? 'parents-receipt-busy' : 'parents-receipt-write-failed'); }
    try { return work(); }
    finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  }
  return Object.freeze({ read, save, exclusive });
}

function createParentLifecycle({ parentRegistry, store, launch, randomToken = () => crypto.randomBytes(32).toString('hex') } = {}) {
  if (!parentRegistry || !['read', 'createEmpty', 'removeEmpty'].every(name => typeof parentRegistry[name] === 'function') ||
      !store || !['read', 'save'].every(name => typeof store[name] === 'function')) fail('parents-capability-required');
  const emptyRecord = () => ({ version: 1, launch: { ...launch }, claims: [] });
  const load = () => { const record = store.read(); return record === null ? emptyRecord() : validateRecord(record, launch); };
  const save = record => { try { store.save(copy(record)); } catch (error) { fail(error.message.startsWith('parents-') ? error.message : 'parents-receipt-write-failed'); } };
  function read(key, token) {
    let node;
    try { node = parentRegistry.read(key, token); } catch { fail('parents-read-failed'); }
    if (node === null) return null;
    if (!exact(node, ['valueCount', 'childCount', 'owned']) || ![node.valueCount, node.childCount].every(value => Number.isSafeInteger(value) && value >= 0) || typeof node.owned !== 'boolean') fail('parents-read-invalid');
    return node;
  }
  const empty = node => node !== null && node.valueCount === 0 && node.childCount === 0;
  const drop = (record, key) => { record.claims = record.claims.filter(claim => claim.key !== key); };

  function cleanupRecord(record, claims, rollback = false) {
    const removed = [], missing = [], preserved = [];
    let ok = true;
    for (const claim of [...claims].reverse()) {
      let node;
      try { node = read(claim.key, claim.token); }
      catch (error) { ok = false; preserved.push({ key: claim.key, reason: error.message }); continue; }
      if (node !== null && (!node.owned || !empty(node))) {
        if (!node.owned) { drop(record, claim.key); try { save(record); } catch { ok = false; } }
        preserved.push({ key: claim.key, reason: node.owned ? 'not-empty' : 'conflict' }); continue;
      }
      const before = copy(record); drop(record, claim.key);
      // Revoke persistent authority before deletion. A failed/unknown deletion
      // cannot cause a future invocation to claim a replacement at this path.
      try { save(record); } catch (error) {
        if (!rollback) { record.claims = before.claims; ok = false; preserved.push({ key: claim.key, reason: error.message }); continue; }
        // Creation already has a durable pending token. On a later record-write
        // failure, rollback is safe because native removal also matches token.
        ok = false;
      }
      if (node === null) { missing.push(claim.key); continue; }
      let result;
      try { result = parentRegistry.removeEmpty(claim.key, claim.token); }
      catch (error) {
        ok = false;
        if (error.parentRollback === true) {
          record.claims = before.claims;
          try { save(record); } catch { /* preserve the key even if its retry record cannot be restored */ }
          preserved.push({ key: claim.key, reason: 'remove-failed' });
        } else preserved.push({ key: claim.key, reason: 'remove-outcome-unknown' });
        continue;
      }
      if (exact(result, ['removed']) && result.removed === true) removed.push(claim.key);
      else if (exact(result, ['removed', 'reason']) && result.removed === false && ['missing', 'not-empty', 'conflict'].includes(result.reason)) {
        if (result.reason === 'missing') missing.push(claim.key);
        else {
          preserved.push({ key: claim.key, reason: result.reason });
          if (result.reason === 'not-empty') {
            record.claims = before.claims;
            try { save(record); } catch { ok = false; }
          }
        }
      } else { ok = false; preserved.push({ key: claim.key, reason: 'remove-outcome-unknown' }); }
    }
    return { ok, complete: preserved.length === 0, removed, missing, preserved, ...(ok ? {} : { error: 'parents-cleanup-failed' }) };
  }
  function prepare() {
    const record = load(), created = [];
    try {
      for (const key of PARENTS) {
        const claim = record.claims.find(item => item.key === key), node = read(key, claim?.token);
        if (node !== null) {
          if (claim && !node.owned) { drop(record, key); save(record); }
          continue;
        }
        if (claim) { drop(record, key); save(record); }
        const token = randomToken(); if (typeof token !== 'string' || !TOKEN.test(token)) fail('parents-token-invalid');
        const pending = { key, token, state: 'pending' };
        record.claims.push(pending); record.claims.sort((a, b) => PARENTS.indexOf(a.key) - PARENTS.indexOf(b.key));
        save(record); // No native creation until its token is durably recorded.
        let result;
        try { result = parentRegistry.createEmpty(key, token); }
        catch { created.push(pending); fail('parents-create-outcome-unknown'); }
        if (exact(result, ['created', 'disposition']) && result.created === false && result.disposition === 'opened-existing') {
          drop(record, key); save(record); fail('parents-create-conflict');
        }
        created.push(pending);
        if (!exact(result, ['created', 'disposition']) || result.created !== true || result.disposition !== 'created-new') fail('parents-create-response-invalid');
        pending.state = 'created'; save(record);
        const actual = read(key, token);
        if (!actual || !actual.owned || !empty(actual)) fail('parents-create-changed');
      }
      return { ok: true, created: created.map(claim => claim.key) };
    } catch (error) {
      const rollback = cleanupRecord(record, created, true);
      return { ok: false, error: error.message.startsWith('parents-') ? error.message : 'parents-operation-failed', rollback };
    }
  }
  function cleanup(keys) {
    const record = load();
    return cleanupRecord(record, keys ? record.claims.filter(claim => keys.includes(claim.key)) : record.claims);
  }
  function status() {
    const record = load();
    return PARENTS.map(key => { const claim = record.claims.find(item => item.key === key), node = read(key, claim?.token); return { key, present: node !== null, managed: node?.owned === true, empty: node !== null && empty(node) }; });
  }
  const exclusive = work => typeof store.exclusive === 'function' ? store.exclusive(work) : work();
  return Object.freeze({ prepare, cleanup, status, exclusive, pending: () => load().claims.length > 0 });
}

module.exports = Object.freeze({ createParentLifecycle, createReceiptStore, validateRecord, BASE, PARENTS, MARKER, FILE });
