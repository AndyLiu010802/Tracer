'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const Sync = require('../public/workspace-sync');
const Preferences = require('../public/backup-preferences');
const store = require('./store'), Companions=require('./companion-backup');
const FORMAT = 'tracer-workspace-backup', VERSION = 1, LIMIT = 8 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HEX = /^[a-f0-9]{64}$/;
function failure(code, status = 400) { return Object.assign(new Error(code), { code, status }); }
function record(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function schema(value, keys) { if (!record(value) || Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) throw failure('backup-invalid'); }
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function hash(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }
function mac(value, secret) { return crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(canonical(value)).digest('hex'); }
function equalDigest(a, b) { return typeof a === 'string' && HEX.test(a) && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); }
function preferences(input, restore = false) {
  try { return restore ? Preferences.forRestore(input) : Preferences.clean(input); }
  catch (_) { throw failure('backup-invalid-preferences'); }
}
function workspace(input) {
  try {
    const source = input ? { ...input, meta: { ...input.meta } } : Sync.empty();
    delete source.meta.backupRestore;
    if (Buffer.byteLength(JSON.stringify(source)) > 4 * 1024 * 1024) throw new Error();
    const clean = Sync.validate(source);
    // Control metadata is never a user-supplied extension point.
    if (UUID.test(input?.meta?.accountImport)) clean.meta.accountImport = input.meta.accountImport;
    return clean;
  } catch (_) { throw failure('backup-invalid-workspace'); }
}
function counts(backup) {
  const payload = backup.payload, result = {};
  for (const key of ['tasks', 'projects', 'notes', 'inbox']) result[key] = payload.workspace[key].length;
  result.focusSessions = payload.preferences['tracer.focus.v1'] ? JSON.parse(payload.preferences['tracer.focus.v1']).history.length : 0;
  result.preferences = Object.keys(payload.preferences).length;
  const fishing=payload.workspace.fishing;
  result.rods=fishing?1+new Set(fishing.boxes.map(box=>box.rodId)).size:0;
  result.fish=fishing?.catches.length||0;result.fry=fishing?.fry.filter(fry=>fry.releasedAt===null).length||0;result.ponds=fishing?.ponds.length||0;
  return result;
}
function sign(scope, source, prefs, secret, now = Date.now(), assets) {
  const payload = { format: FORMAT, version: VERSION, createdAt: new Date(now).toISOString(), scope, workspace: workspace(source), preferences: preferences(prefs) };
  if(assets!==undefined){payload.version=2;payload.assets=assets;Companions.validate(assets,payload.preferences);}
  if(Buffer.byteLength(JSON.stringify(payload))>LIMIT)throw failure('backup-too-large',413);
  const result={ payload, checksum: hash(payload), signature: mac(payload, secret) };
  if(Buffer.byteLength(JSON.stringify(result))>LIMIT)throw failure('backup-too-large',413);return result;
}
function inspect(backup, scope, secret) {
  if (!record(backup) || !record(backup.payload) || backup.payload.format !== FORMAT || ![1,2].includes(backup.payload.version)) throw failure('backup-version-unsupported');
  schema(backup, ['payload', 'checksum', 'signature']);
  schema(backup.payload, ['format', 'version', 'createdAt', 'scope', 'workspace', 'preferences',...(backup.payload.version===2?['assets']:[])]);
  if (Buffer.byteLength(JSON.stringify(backup)) > LIMIT || typeof backup.payload.createdAt !== 'string' || !Number.isFinite(Date.parse(backup.payload.createdAt)) || (backup.payload.scope !== 'guest' && !UUID.test(backup.payload.scope))) throw failure('backup-invalid');
  if (!equalDigest(backup.checksum, hash(backup.payload))) throw failure('backup-checksum-mismatch');
  if (backup.payload.scope !== scope) throw failure('backup-scope-mismatch', 409);
  if (!HEX.test(secret || '') || !equalDigest(backup.signature, mac(backup.payload, secret))) throw failure('backup-untrusted', 403);
  if(backup.payload.version===2){try{Companions.validate(backup.payload.assets,backup.payload.preferences);}catch{throw failure('backup-invalid-assets');}}
  const cleanWorkspace = workspace(backup.payload.workspace), cleanPreferences = preferences(backup.payload.preferences);
  if (canonical(cleanWorkspace) !== canonical(backup.payload.workspace) || canonical(cleanPreferences) !== canonical(backup.payload.preferences)) throw failure('backup-invalid');
  return { format: FORMAT, version: backup.payload.version, createdAt: backup.payload.createdAt, scope, counts: counts(backup), included: ['workspace', 'preferences',...(backup.payload.version===2?['companion-images']:[])], excluded: ['identity', 'ai',...(backup.payload.version===1?['companion-images']:[]), 'licenses'], warnings: [] };
}
async function snapshot(directory, backup) {
  const id = crypto.randomUUID(), folder = path.join(directory, '.backups'), file = path.join(folder, id + '.json'), temp = file + '.tmp';
  try {
    await fs.mkdir(folder, { recursive: true, mode: 0o700 });
    await fs.writeFile(temp, JSON.stringify(backup), { flag: 'wx', mode: 0o600 });
    await fs.rename(temp, file);
    return id;
  } catch (_) { await fs.unlink(temp).catch(() => {}); throw failure('backup-storage-unavailable', 503); }
}
async function download(directory, id, scope, secret) {
  if (!UUID.test(id)) throw failure('backup-not-found', 404);
  let backup;
  try {
    const file = path.join(directory, '.backups', id + '.json');
    if ((await fs.stat(file)).size > LIMIT) throw failure('backup-invalid');
    backup = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) { throw error.status ? error : failure(error.code === 'ENOENT' ? 'backup-not-found' : 'backup-storage-unavailable', error.code === 'ENOENT' ? 404 : 503); }
  inspect(backup, scope, secret); return backup;
}
async function list(directory, scope, secret) {
  let files;
  try { files = await fs.readdir(path.join(directory, '.backups')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw failure('backup-storage-unavailable', 503); }
  const rows = [];
  for (const file of files.filter(file => file.endsWith('.json') && UUID.test(file.slice(0, -5)))) {
    const id = file.slice(0, -5), backup = await download(directory, id, scope, secret);
    rows.push({ id, createdAt: backup.payload.createdAt, ...counts(backup) });
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
async function restore(directory, scope, secret, input, now = Date.now()) {
  if (input.confirm !== true) throw failure('backup-confirmation-required');
  inspect(input.backup, scope, secret);
  if (!HEX.test(input.expected || '')) throw failure('backup-stale', 409);
  const currentPreferences = preferences(input.currentPreferences), restoredPreferences = preferences(input.backup.payload.preferences, true);
  const current = await store.readStore(directory, 'workspace');
  if (hash(current) !== input.expected) throw failure('backup-stale', 409);
  const restoreId = crypto.randomUUID();
  function prepare(previous, next) {
    if (hash(previous) !== input.expected) throw failure('backup-stale', 409);
    delete next.meta.accountImport;
    if (UUID.test(previous?.meta?.accountImport)) next.meta.accountImport = previous.meta.accountImport;
    next.meta.backupRestore = { id: restoreId, revision: (previous?.meta?.backupRestore?.revision || 0) + 1, preferences: restoredPreferences };
    if (Buffer.byteLength(JSON.stringify(next)) > 4 * 1024 * 1024) throw failure('backup-too-large', 413);
    return next;
  }
  prepare(current, JSON.parse(JSON.stringify(input.backup.payload.workspace)));
  const currentAssets=currentPreferences['tracer.pet.v1']?await Companions.collect(directory,currentPreferences):undefined;
  const snapshotId = await snapshot(directory, sign(scope, current, currentPreferences, secret, now,currentAssets));
  let rollback=async()=>{};
  if(input.backup.payload.version===2)rollback=await Companions.stage(directory,input.backup.payload.assets,restoredPreferences);
  try {
    await store.writeStore(directory, 'workspace', JSON.stringify(input.backup.payload.workspace), prepare);
  } catch (error) { await rollback();throw error.status ? error : failure('backup-storage-unavailable', 503); }
  return { ok: true, restoreId, snapshotId };
}
module.exports = { FORMAT, VERSION, LIMIT, hash, sign, inspect, restore, list, download, failure };
