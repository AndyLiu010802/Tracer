'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(crypto.scrypt);
const store = require('./store');
const Backup = require('./workspace-backup');
const DAY = 86400000;
const COLORS = ['#c7d7a8', '#9ccad9', '#c2ade2', '#e4b0bc', '#e5c58d', '#abb7c7'];
const AVATARS = ['moon', 'leaf', 'star', 'flower', 'mountain', 'cat', 'sun', 'cloud', 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function failure(code, status = 400) { return Object.assign(new Error(code), { code, status }); }
function populatedWorkspace(source){
  const fishing=source?.fishing;
  return ['tasks','projects','notes','inbox'].some(k=>source?.[k]?.length)||!!source?.taskGarden?.seeds?.length||!!source?.taskGarden?.planets?.length||!!source?.completionHistory?.length||!!fishing&&(!!fishing.showcase||!!fishing.boxes?.length||!!fishing.casts?.length||!!fishing.catches?.length||!!fishing.fry?.length||!!fishing.transactions?.length||fishing.ponds?.some(p=>p.archivedAt!==null||p.styleId!=='meadow'||p.decorationLayoutAt>p.createdAt));
}
function email(value) {
  if (typeof value !== 'string') throw failure('invalid-email');
  const next = value.trim().toLowerCase();
  if (next.length > 254 || !/^[^\s@<>\x00-\x1f]+@[^\s@<>\x00-\x1f]+\.[^\s@<>\x00-\x1f]+$/.test(next)) throw failure('invalid-email');
  return next;
}
function password(value) {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128 || Buffer.byteLength(value) > 512) throw failure('invalid-password');
  return value;
}
function string(value, maximum, required = false) {
  if (typeof value !== 'string' || value.length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value) || required && !value.trim()) throw failure('invalid-profile');
  return value.trim();
}
function avatar(value) {
  if (!value || typeof value !== 'object') throw failure('invalid-avatar');
  if (value.kind === 'preset' && AVATARS.includes(value.value) && COLORS.includes(value.color) && /^#[0-9a-f]{6}$/i.test(value.iconColor || '#000000')) return { kind: 'preset', value: value.value, color: value.color, iconColor: (value.iconColor || '#000000').toLowerCase() };
  if (value.kind === 'image' && typeof value.value === 'string' && value.value.length < 180000 && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value.value)) {
    const bytes = Buffer.from(value.value.split(',')[1], 'base64');
    if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16) === 'IHDR' && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(16) <= 256 && bytes.readUInt32BE(20) > 0 && bytes.readUInt32BE(20) <= 256) return { kind: 'image', value: value.value };
  }
  throw failure('invalid-avatar');
}
function profile(value = {}) {
  return { nickname: string(value.nickname, 32, true), bio: string(value.bio || '', 160), workspaceName: string(value.workspaceName || '', 48), avatar: avatar(value.avatar || { kind: 'preset', value: 'moon', color: COLORS[0] }) };
}
async function digest(value, salt = crypto.randomBytes(16).toString('hex')) {
  const key = await derive(value, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return { algorithm: 'scrypt-v1', salt, key: key.toString('hex') };
}
async function matches(value, stored) {
  const input = typeof value === 'string' && value.length <= 128 ? value : '';
  const candidate = await digest(input, stored?.salt || '0'.repeat(32));
  const target = Buffer.from(stored?.key || '0'.repeat(128), 'hex');
  return target.length === 64 && crypto.timingSafeEqual(Buffer.from(candidate.key, 'hex'), target) && !!stored;
}
function recoveryCode() { return crypto.randomBytes(24).toString('hex').match(/.{1,6}/g).join('-'); }
function recoveryHash(value) { return hash(typeof value === 'string' ? value.replace(/[-\s]/g, '').toLowerCase() : ''); }
function publicUser(account) { return { id: account.id, email: account.email, emailVerified: false, profile: account.profile, createdAt: account.createdAt, updatedAt: account.updatedAt }; }
function sessionLabel(agent) {
  const os = /Windows/i.test(agent) ? 'Windows' : /Macintosh|Mac OS/i.test(agent) ? 'Mac' : /Linux/i.test(agent) ? 'Linux' : 'Browser';
  return os + ' · ' + (/Electron/i.test(agent) ? 'Tracer Desktop' : /Edg\//i.test(agent) ? 'Edge' : /Chrome\//i.test(agent) ? 'Chrome' : /Firefox\//i.test(agent) ? 'Firefox' : /Safari\//i.test(agent) ? 'Safari' : 'Session');
}

// Provider boundary: the HTTP/UI layer depends on this contract, not on files.
// A future cloud provider must implement the same methods and enforce ownership remotely.
function createLocalAccounts(dataDir, { now = Date.now, sessionLifetime = 30 * DAY, beforeClear = async () => {} } = {}) {
  const root = path.resolve(dataDir, '.accounts'), file = path.join(root, 'identity.json');
  const cookieName = 'tracer_session_' + hash(path.resolve(dataDir)).slice(0, 12);
  let tail = Promise.resolve();
  const attempts = new Map();
  const activeRequests = new Map();
  function serial(work) { const next = tail.catch(() => {}).then(work); tail = next; return next; }
  async function read() {
    let value;
    try { value = JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { version: 1, accounts: [], sessions: [], guestClaim: null }; throw failure('account-storage-unavailable', 503); }
    if (value?.version !== 1 || !Array.isArray(value.accounts) || !Array.isArray(value.sessions) || value.accounts.some(a => !UUID.test(a.id) || !a.password || !a.profile)) throw failure('account-storage-unavailable', 503);
    return value;
  }
  async function write(value) {
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const temp = file + '.' + crypto.randomUUID() + '.tmp';
    try { await fs.writeFile(temp, JSON.stringify(value), { mode: 0o600 }); await fs.rename(temp, file); }
    catch (error) { await fs.unlink(temp).catch(() => {}); throw failure('account-storage-unavailable', 503); }
  }
  function accountDirectory(id) {
    if (!UUID.test(id)) throw failure('invalid-account', 403);
    return path.join(root, id, 'data');
  }
  function tokenFrom(req) {
    const values = String(req.headers.cookie || '').split(';').map(x => x.trim()).filter(x => x.startsWith(cookieName + '='));
    return values.length === 1 ? values[0].slice(cookieName.length + 1) : values.length ? 'invalid' : '';
  }
  function session(value, token) {
    if (!token) return null;
    const row = /^[a-f0-9]{64}$/.test(token) ? value.sessions.find(s => s.tokenHash === hash(token) && s.expiresAt > now()) : null;
    return row && value.accounts.some(a => a.id === row.accountId) ? row : null;
  }
  function required(value, token) {
    const current = session(value, token);
    if (!current) throw failure('session-expired', 401);
    return { account: value.accounts.find(a => a.id === current.accountId), current };
  }
  function newSession(value, id, agent) {
    const token = crypto.randomBytes(32).toString('hex'), time = now();
    value.sessions = value.sessions.filter(s => s.expiresAt > time);
    const own = value.sessions.filter(s => s.accountId === id).sort((a,b) => a.createdAt-b.createdAt);
    if (own.length >= 20) value.sessions = value.sessions.filter(s => !own.slice(0, own.length-19).includes(s));
    value.sessions.push({ id: crypto.randomUUID(), tokenHash: hash(token), accountId: id, createdAt: time, expiresAt: time + sessionLifetime, label: sessionLabel(agent || '') });
    return token;
  }
  function limit(key, maximum = 12) {
    const time = now();
    for (const [name,row] of attempts) if (row.until <= time) attempts.delete(name);
    if (attempts.size > 2000) throw failure('try-again-later', 429);
    const row = attempts.get(key) || { count: 0, until: time + 15 * 60000 };
    if (++row.count > maximum) throw failure('try-again-later', 429);
    attempts.set(key, row);
  }
  async function dataContext(value, token, expected) {
    const current = session(value, token), scope = current?.accountId || (token ? 'locked' : 'guest');
    if (scope === 'locked') throw failure('account-changed', 401);
    const account = current && value.accounts.find(a => a.id === scope), directory = account ? accountDirectory(scope) : dataDir;
    const workspace = await store.readStore(directory, 'workspace'), restoreId = workspace?.meta?.backupRestore?.id || '';
    if (expected && (expected.scope !== scope || String(expected.generation || 0) !== String(account?.generation || 0) || String(expected.restoreId || '') !== restoreId)) throw failure('account-changed', 409);
    return { scope, directory, workspace, restoreId };
  }
  async function backupSecret(value, create = false) {
    if (value.backupSecret === undefined && create) { value.backupSecret = crypto.randomBytes(32).toString('hex'); await write(value); }
    if (value.backupSecret !== undefined && !/^[a-f0-9]{64}$/.test(value.backupSecret)) throw failure('account-storage-unavailable', 503);
    return value.backupSecret;
  }
  function backupInput(input, keys) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key)) || keys.some(key => !Object.prototype.hasOwnProperty.call(input, key))) throw failure('backup-invalid');
  }
  const capabilities = Object.freeze({ version: 1, mode: 'local', cloudSync: false, emailVerification: false, passwordRecovery: 'recovery-code', collections: true, wallpaperPurchases: true });
  return {
    capabilities, cookieName, tokenFrom, directory: accountDirectory,
    cookie(token) { return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? Math.floor(sessionLifetime/1000) : 0}`; },
    async context(token, bootstrap = false) {
      await tail.catch(() => {});
      const value = await read(), current = session(value, token);
      if (token && !current) return { scope: 'locked', user: null, capabilities, restoreId: '', restoreRevision: 0 };
      const account = current && value.accounts.find(a => a.id === current.accountId);
      let workspace, workspaceCorrupt = false;
      try { workspace = await store.readStore(account ? accountDirectory(account.id) : dataDir, 'workspace'); }
      catch (error) { if (error.code !== 'store-corrupt') throw error; workspaceCorrupt = true; }
      const marker = workspace?.meta?.backupRestore;
      const context = { scope: account?.id || 'guest', generation: account?.generation || 0, user: account ? publicUser(account) : null, capabilities, restoreId: marker?.id || '', restoreRevision: marker?.revision || 0 };
      if (workspaceCorrupt) context.workspaceCorrupt = true;
      if (bootstrap && marker) context.restorePreferences = marker.preferences;
      return context;
    },
    async beginDataRequest(token, expectedScope, generation, allowUnscoped = false, expectedRestoreId = '') {
      return serial(async () => {
        const value = await read(), current = session(value, token);
        const scope = current?.accountId || (token ? 'locked' : 'guest');
        const account = current && value.accounts.find(a => a.id === scope);
        if (scope === 'locked' || (expectedScope && expectedScope !== scope) ||
            (!expectedScope && scope !== 'guest' && !allowUnscoped) ||
            (!allowUnscoped && String(generation || 0) !== String(account?.generation || 0))) throw failure('account-changed', scope === 'locked' ? 401 : 409);
        let workspace;
        try { workspace = await store.readStore(account ? accountDirectory(scope) : dataDir, 'workspace'); }
        catch (error) { if (error.code === 'store-corrupt') throw failure('store-corrupt', 409); throw error; }
        if (!allowUnscoped && String(expectedRestoreId || '') !== (workspace?.meta?.backupRestore?.id || '')) throw failure('account-changed', 409);
        activeRequests.set(scope, (activeRequests.get(scope) || 0) + 1);
        let released = false;
        return { scope, release() { if (!released) { released = true; const count = activeRequests.get(scope) - 1; if (count) activeRequests.set(scope, count); else activeRequests.delete(scope); } } };
      });
    },
    async portableFileOperation(token,expected,operation){return serial(async()=>{const value=await read(),context=await dataContext(value,token,expected);if(activeRequests.get(context.scope))throw failure('account-data-busy',409);return operation(context.directory,context.workspace);});},
    async backupExport(token, input, expected) {
      backupInput(input, ['preferences']);
      return serial(async () => {
        const value = await read(), context = await dataContext(value, token, expected), secret = await backupSecret(value, true);
        const prefs=require('../public/backup-preferences').clean(input.preferences);
          const assets=prefs['tracer.pet.v1']?await require('./companion-backup').collect(context.directory,prefs):undefined;
          return { backup: Backup.sign(context.scope, context.workspace, prefs, secret, now(),assets) };
      });
    },
    async backupInspect(token, input, expected) {
      backupInput(input, ['backup']);
      return serial(async () => {
        const value = await read(), context = await dataContext(value, token, expected), secret = await backupSecret(value);
        return { preview: Backup.inspect(input.backup, context.scope, secret), expected: Backup.hash(context.workspace) };
      });
    },
    async backupRestore(token, input, expected) {
      backupInput(input, ['backup', 'expected', 'currentPreferences', 'confirm']);
      return serial(async () => {
        const value = await read(), context = await dataContext(value, token, expected), secret = await backupSecret(value);
        if (activeRequests.get(context.scope)) throw failure('account-data-busy', 409);
        return Backup.restore(context.directory, context.scope, secret, input, now());
      });
    },
    async backupList(token, expected) {
      return serial(async () => {
        const value = await read(), context = await dataContext(value, token, expected), secret = await backupSecret(value);
        return { snapshots: await Backup.list(context.directory, context.scope, secret) };
      });
    },
    async backupDownload(token, input, expected) {
      backupInput(input, ['id']);
      return serial(async () => {
        const value = await read(), context = await dataContext(value, token, expected), secret = await backupSecret(value);
        return { backup: await Backup.download(context.directory, input.id, context.scope, secret) };
      });
    },
    async clearData(token, input, agent, expected) {
      limit('clear-data:' + hash(token));
      return serial(async () => {
        const value = await read(), { account } = required(value, token);
        if (expected) await dataContext(value, token, expected);
        if (input.confirm !== true) throw failure('confirmation-required');
        if (!await matches(input.password, account.password)) throw failure('invalid-credentials', 401);
        if (activeRequests.get(account.id)) throw failure('account-data-busy', 409);
        const directory = accountDirectory(account.id);
        // The UUID and resolved parent check keep deletion inside this account only.
        if (path.dirname(path.dirname(directory)) !== root) throw failure('invalid-account', 403);
        await beforeClear(directory);
        await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        account.profile = profile({ nickname: 'Tracer' });
        account.generation = (account.generation || 0) + 1;
        account.updatedAt = now();
        // Keep credentials and the guest claim, but invalidate every old session/request.
        value.sessions = value.sessions.filter(s => s.accountId !== account.id);
        const next = newSession(value, account.id, agent);
        await write(value);
        return { ok: true, token: next, generation: account.generation, user: publicUser(account) };
      });
    },
    async register(input, agent) {
      const address = email(input.email), pass = password(input.password), details = profile(input.profile);
      limit('register');
      return serial(async () => {
        const value = await read();
        if (value.accounts.some(a => a.email === address)) throw failure('email-in-use', 409);
        if (value.accounts.length >= 100) throw failure('account-limit', 409);
        const code = recoveryCode(), time = now(), account = { id: crypto.randomUUID(), email: address, profile: details, password: await digest(pass), recoveryHash: recoveryHash(code), createdAt: time, updatedAt: time };
        value.accounts.push(account); const token = newSession(value, account.id, agent); await write(value);
        return { user: publicUser(account), token, recoveryCode: code };
      });
    },
    async login(input, agent) {
      const address = email(input.email); limit('login:' + hash(address)); limit('login-global',120);
      return serial(async () => {
        const value = await read(), account = value.accounts.find(a => a.email === address);
        if (!await matches(input.password, account?.password)) throw failure('invalid-credentials', 401);
        const token = newSession(value, account.id, agent); await write(value); attempts.delete('login:' + hash(address));
        return { user: publicUser(account), token };
      });
    },
    async logout(token) { return serial(async () => { const value = await read(); if (token) { value.sessions = value.sessions.filter(s => s.tokenHash !== hash(token)); await write(value); } return { ok: true }; }); },
    async updateProfile(token, input) { const details = profile(input); return serial(async () => { const value = await read(), { account } = required(value, token); account.profile = details; account.updatedAt = now(); await write(value); return { user: publicUser(account) }; }); },
    async sessions(token) { await tail.catch(() => {}); const value = await read(), { current, account } = required(value, token); return { sessions: value.sessions.filter(s => s.accountId === account.id && s.expiresAt > now()).map(s => ({ id: s.id, label: s.label, createdAt: s.createdAt, expiresAt: s.expiresAt, current: s.id === current.id })) }; },
    async revoke(token, id) { return serial(async () => { const value = await read(), { current, account } = required(value, token); value.sessions = value.sessions.filter(s => s.accountId !== account.id || (id === 'others' ? s.id === current.id : s.id !== id)); await write(value); return { ok: true, signedOut: current.id === id }; }); },
    async changePassword(token, input, agent) {
      password(input.newPassword); limit('change:' + hash(token));
      return serial(async () => { const value = await read(), { account } = required(value, token); if (!await matches(input.currentPassword, account.password)) throw failure('invalid-credentials', 401); account.password = await digest(input.newPassword); account.updatedAt = now(); value.sessions = value.sessions.filter(s => s.accountId !== account.id); const next = newSession(value, account.id, agent); await write(value); return { ok: true, token: next }; });
    },
    async rotateRecovery(token, input) { limit('recovery-rotate:' + hash(token)); return serial(async () => { const value = await read(), { account } = required(value, token); if (!await matches(input.password, account.password)) throw failure('invalid-credentials', 401); const code = recoveryCode(); account.recoveryHash = recoveryHash(code); account.updatedAt = now(); await write(value); return { recoveryCode: code }; }); },
    async recover(input) {
      const address = email(input.email), next = password(input.newPassword); limit('recover:' + hash(address)); limit('recover-global',120);
      return serial(async () => {
        const value = await read(), account = value.accounts.find(a => a.email === address), actual = Buffer.from(recoveryHash(input.recoveryCode),'hex'), expected = Buffer.from(account?.recoveryHash || '0'.repeat(64),'hex');
        if (!crypto.timingSafeEqual(actual, expected) || !account) throw failure('invalid-recovery', 401);
        const code = recoveryCode(); account.password = await digest(next); account.recoveryHash = recoveryHash(code); account.updatedAt = now(); value.sessions = value.sessions.filter(s => s.accountId !== account.id); await write(value);
        return { ok: true, recoveryCode: code };
      });
    },
    async guestPreview(token) {
      await tail.catch(() => {}); const value = await read(), { account } = required(value, token), workspace = await store.readStore(dataDir, 'workspace'), current = await store.readStore(accountDirectory(account.id), 'workspace');
      const populated = populatedWorkspace;
      const pendingImport = value.guestClaim === account.id && value.guestImport?.state === 'pending';
      return { available: pendingImport || !!workspace && !populated(current) && !value.guestClaim, pendingImport, alreadyImported: value.guestClaim === account.id && !pendingImport, claimed: !!value.guestClaim, targetHasData: populated(current), counts: Object.fromEntries(['tasks','projects','notes','inbox'].map(k => [k, Array.isArray(workspace?.[k]) ? workspace[k].length : 0])) };
    },
    async importGuest(token, expected) {
      return serial(async () => {
        const value = await read(), { account } = required(value, token);
        if (expected) await dataContext(value, token, expected);
        if (value.guestClaim && value.guestClaim !== account.id) throw failure('guest-already-imported',409);
        if (value.guestClaim === account.id && value.guestImport?.state !== 'pending') return { ok: true, alreadyImported: true };
        if(value.guestClaim===account.id&&value.guestImport?.state==='pending'){
          const accepted=await store.readStore(accountDirectory(account.id),'workspace');
          if(accepted?.meta?.accountImport===value.guestImport.marker){value.guestImport.state='complete';await write(value);return{ok:true,alreadyImported:true};}
        }
        const source = await store.readStore(dataDir,'workspace'); if (!source) throw failure('guest-empty',409);
        const marker = value.guestImport?.accountId === account.id && value.guestImport.state === 'pending' ? value.guestImport.marker : crypto.randomUUID();
        // Claim first so a crash can never duplicate the same guest economy into two accounts.
        value.guestClaim = account.id; value.guestImport = { accountId: account.id, marker, state: 'pending' }; await write(value);
        try {
          await store.writeStore(accountDirectory(account.id),'workspace',JSON.stringify(source),(previous,next) => {
            if(previous?.meta?.accountImport===marker)return previous;
            if (populatedWorkspace(previous)) throw failure('account-not-empty',409);
            next.meta = { ...(next.meta || {}), accountImport: marker };
            delete next.meta.backupRestore;
            if (previous?.meta?.backupRestore) next.meta.backupRestore = previous.meta.backupRestore;
            return next;
          });
        } catch (error) {
          // Only a known pre-write validation error can release the claim.
          // An uncertain I/O result must remain retryable by this same account.
          if(error.code==='account-not-empty'){value.guestClaim=null;value.guestImport=null;await write(value);}
          throw error;
        }
        value.guestImport.state = 'complete'; await write(value); return { ok: true };
      });
    },
    async collection(token) { await tail.catch(() => {}); const value = await read(), { account } = required(value, token); return require('./account-wallpapers').project(await store.readStore(accountDirectory(account.id),'workspace'),account.id); },
    async purchaseWallpaper(token,input,expected) { return serial(async()=>{const value=await read(),{account}=required(value,token);if(expected)await dataContext(value,token,expected);return require('./account-wallpapers').mutate(accountDirectory(account.id),account.id,'purchase',input,now());}); },
    async equipWallpaper(token,input,expected) { return serial(async()=>{const value=await read(),{account}=required(value,token);if(expected)await dataContext(value,token,expected);return require('./account-wallpapers').mutate(accountDirectory(account.id),account.id,'equip',input,now());}); },
    async exportData(token) { await tail.catch(() => {}); const value = await read(), { account } = required(value, token), workspace=await store.readStore(accountDirectory(account.id),'workspace'); return { version: 1, provider: 'local', exportedAt: new Date(now()).toISOString(), user: publicUser(account), workspace, collection: require('./account-wallpapers').project(workspace,account.id) }; }
  };
}
module.exports = { createLocalAccounts, profile, email, avatar, COLORS, AVATARS };
