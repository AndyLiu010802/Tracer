'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const scopeA = '11111111-1111-4111-8111-111111111111';
const scopeB = '22222222-2222-4222-8222-222222222222';
const scopedKey = (scope, key) => scope === 'guest' ? key : 'tracer.account.' + scope + '.' + key;

function createTab({ scope = scopeA, restoreId = '', restoreRevision = restoreId ? 1 : 0, preferences, data = new Map(), fail, fetchImpl } = {}) {
  const listeners = new Map(), requests = [], beacons = [], deletedDatabases = [];
  const raw = {
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { if (fail) fail('set', String(key)); data.set(String(key), String(value)); },
    removeItem(key) { if (fail) fail('remove', String(key)); data.delete(String(key)); },
    key(index) { return [...data.keys()][index] ?? null; },
    get length() { return data.size; },
    clear() { data.clear(); }
  };
  const document = {
    body: null, hidden: false,
    addEventListener() {},
    querySelectorAll() { return []; }
  };
  const sandbox = {
    __TRACER_ACCOUNT__: { scope, generation: 0, restoreId, restoreRevision, user: null, capabilities: { mode: 'local' }, ...(preferences === undefined ? {} : { restorePreferences: preferences }) },
    localStorage: raw, document,
    location: { href: 'http://127.0.0.1:8099/', origin: 'http://127.0.0.1:8099', reload() {} },
    URL, Request, Response, Headers, console,
    setTimeout, clearTimeout, setInterval() { return 1; }, clearInterval() {},
    Tracer: { store: { lost: false, timer: null } },
    indexedDB: { deleteDatabase(name) { deletedDatabases.push(name); const request = {}; queueMicrotask(() => request.onsuccess?.()); return request; } },
    navigator: { sendBeacon(url, body) { beacons.push({ url: String(url), body }); return true; } },
    async fetch(input, options) {
      requests.push({ input, options, url: String(input instanceof Request ? input.url : input) });
      if (fetchImpl) return fetchImpl(input, options);
      return new Response(JSON.stringify({ scope, generation: 0, restoreId, restoreRevision }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
    addEventListener(type, listener, capture) {
      const rows = listeners.get(type) || [];
      rows.push({ listener, capture: !!capture }); listeners.set(type, rows);
    }
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve('../skins/tracer/focus-model'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../skins/tracer/pet-animation'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../skins/tracer/pet-model'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../public/backup-preferences'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../skins/tracer/account-storage'), 'utf8'), context);
  return {
    window: sandbox, raw, data, requests, beacons, deletedDatabases,
    async ready() { await sandbox.TracerAccount.ready; },
    async storageEvent(key, newValue = raw.getItem(key)) {
      let stopped = false;
      const event = { type: 'storage', key, newValue, storageArea: raw, stopImmediatePropagation() { stopped = true; } };
      for (const row of (listeners.get('storage') || []).slice().sort((a, b) => Number(b.capture) - Number(a.capture))) {
        if (stopped) break;
        await row.listener(event);
      }
      await Promise.resolve();
    }
  };
}

test('bootstrap restores only declared preferences before consumers read the scoped store', async () => {
  const data = new Map([
    [scopedKey(scopeA, 'tracer.language'), 'en'],
    [scopedKey(scopeA, 'tracer.pet.v1'), 'keep-companion-assets'],
    [scopedKey(scopeA, 'tracer.petGenerationDraft'), 'keep-unrelated-generation-draft'],
    [scopedKey(scopeB, 'tracer.language'), 'en']
  ]);
  const tab = createTab({ data, restoreId: 'restore-1', preferences: { 'tracer.language': 'zh' } });
  assert.equal(tab.window.localStorage.getItem('tracer.language'), 'zh', 'application modules see restored language synchronously');
  await tab.ready();
  assert.equal(data.get(scopedKey(scopeB, 'tracer.language')), 'en');
  assert.equal(data.get(scopedKey(scopeA, 'tracer.pet.v1')), 'keep-companion-assets');
  assert.equal(data.get(scopedKey(scopeA, 'tracer.petGenerationDraft')), 'keep-unrelated-generation-draft');
  assert.deepEqual(tab.deletedDatabases, []);
});

test('reopening an already applied restore does not overwrite subsequent user preferences', async () => {
  const data = new Map(), preferences = { 'tracer.language': 'zh' };
  const first = createTab({ data, restoreId: 'restore-once', preferences }); await first.ready();
  first.window.localStorage.setItem('tracer.language', 'en');
  const reopened = createTab({ data, restoreId: 'restore-once', preferences }); await reopened.ready();
  assert.equal(reopened.window.localStorage.getItem('tracer.language'), 'en');
});

test('clearing an account also removes its quarantined restore drafts but leaves other accounts intact', async () => {
  const own = 'tracer.account.backup-quarantine.' + scopeA + '.old', other = 'tracer.account.backup-quarantine.' + scopeB + '.old';
  const data = new Map([[own, 'private old draft'], [other, 'another account draft']]);
  const tab = createTab({ data, restoreId: 'restore-clear', preferences: { 'tracer.language': 'zh' } });
  await tab.ready(); await tab.window.TracerAccount.clearLocalData(1);
  assert.equal([...data.keys()].some(key => key.startsWith('tracer.account.backup-quarantine.' + scopeA + '.')), false);
  assert.equal(data.get(other), 'another account draft');
  assert.equal(data.has('tracer.account.restore.applied.' + scopeA), false);
  assert.equal(data.has(scopedKey(scopeA, 'tracer.language')), false);
});

test('workspace drafts are quarantined so they cannot automatically merge over a restored snapshot', async () => {
  const draft = JSON.stringify({ base: { meta: { rev: 1 } }, data: { tasks: [{ id: 'pending-local-edit' }] } });
  const data = new Map([
    [scopedKey(scopeA, 'tracer.workspaceDraft'), draft],
    [scopedKey(scopeA, 'tracer.cloudDraft'), 'legacy-draft-that-must-be-retained'],
    [scopedKey(scopeB, 'tracer.workspaceDraft'), 'other-account-draft']
  ]);
  const tab = createTab({ data, restoreId: 'restore-drafts', preferences: {} }); await tab.ready();
  assert.equal(tab.window.localStorage.getItem('tracer.workspaceDraft'), null);
  assert.equal(tab.window.localStorage.getItem('tracer.cloudDraft'), null);
  assert.equal(data.get(scopedKey(scopeB, 'tracer.workspaceDraft')), 'other-account-draft');
  const retained = [...data.values()].join('\n');
  assert.ok(retained.includes('pending-local-edit'), 'the unsubmitted local edit remains recoverable');
  assert.ok(retained.includes('legacy-draft-that-must-be-retained'), 'the legacy draft remains recoverable');
});

test('an older window cannot mutate restored preferences or send another workspace write', async () => {
  const data = new Map(), old = createTab({ data }); await old.ready();
  const restored = createTab({ data, restoreId: 'restore-new', preferences: { 'tracer.language': 'zh' } }); await restored.ready();
  assert.equal(old.window.TracerAccount.locked, true);
  old.window.localStorage.setItem('tracer.language', 'en');
  old.window.localStorage.removeItem('tracer.language');
  old.window.localStorage.clear();
  assert.equal(restored.window.localStorage.getItem('tracer.language'), 'zh');
  const response = await old.window.fetch('/api/store/workspace', { method: 'PUT', body: '{}' });
  assert.equal(response.status, 409);
  assert.equal(old.window.navigator.sendBeacon('/api/store/workspace', '{}'), false);
  assert.equal(old.requests.length, 0);
  assert.equal(old.beacons.length, 0);
  await old.storageEvent('tracer.account.restore.' + scopeA);
  assert.equal(old.window.Tracer.store.lost, true, 'the real storage notification also locks active workspace consumers');
});

test('another account restore does not obsolete the current account and new requests carry the restore epoch', async () => {
  const data = new Map(), own = createTab({ data, restoreId: 'own-restore', preferences: {} }); await own.ready();
  const other = createTab({ data, scope: scopeB, restoreId: 'other-restore', preferences: {} }); await other.ready();
  assert.equal(own.window.TracerAccount.locked, false);
  await own.window.fetch('/api/store/workspace');
  const requestURL = new URL(own.requests.at(-1).url);
  assert.equal(requestURL.searchParams.get('__tracer_account'), scopeA);
  assert.equal(requestURL.searchParams.get('__tracer_restore'), 'own-restore');
  assert.equal(own.window.navigator.sendBeacon('/api/store/workspace', '{}'), true);
  assert.equal(new URL(own.beacons.at(-1).url).searchParams.get('__tracer_restore'), 'own-restore');
  await own.window.TracerAccount.api('collection');
  assert.equal(own.requests.at(-1).options.headers['x-tracer-restore'], 'own-restore');
});

test('a delayed older bootstrap cannot revert a newer restore marker or its preferences', async () => {
  const data = new Map(), newest = createTab({ data, restoreId: 'newest', restoreRevision: 7, preferences: { 'tracer.language': 'zh' } }); await newest.ready();
  const old = createTab({ data, restoreId: 'older', restoreRevision: 6, preferences: { 'tracer.language': 'en' } }); await old.ready();
  assert.equal(old.window.TracerAccount.locked, true);
  assert.equal(newest.window.localStorage.getItem('tracer.language'), 'zh');
  assert.equal(JSON.parse(data.get('tracer.account.restore.' + scopeA)).id, 'newest');
});

test('a restore storage failure rolls back preferences, retains drafts and can be retried safely', async () => {
  const draft = '{"pending":"keep-me"}', data = new Map([
    [scopedKey(scopeA, 'tracer.language'), 'en'],
    [scopedKey(scopeA, 'tracer.workspaceDraft'), draft]
  ]);
  let failOnce = true;
  const broken = createTab({ data, restoreId: 'retryable', preferences: { 'tracer.language': 'zh' }, fail(operation, key) {
    if (operation === 'set' && key === 'tracer.account.restore.applied.' + scopeA && failOnce) { failOnce = false; throw new Error('synthetic-quota-failure'); }
  } });
  await assert.rejects(broken.ready(), /synthetic-quota-failure/);
  assert.equal(broken.window.TracerAccount.locked, true);
  assert.equal(data.get(scopedKey(scopeA, 'tracer.language')), 'en');
  assert.equal(data.get(scopedKey(scopeA, 'tracer.workspaceDraft')), draft);
  const retried = createTab({ data, restoreId: 'retryable', preferences: { 'tracer.language': 'zh' } }); await retried.ready();
  assert.equal(retried.window.localStorage.getItem('tracer.language'), 'zh');
  assert.equal(retried.window.localStorage.getItem('tracer.workspaceDraft'), null);
  assert.ok(data.get('tracer.account.backup-quarantine.' + scopeA + '.retryable').includes('keep-me'));
});

test('quarantine allocation failure preserves original state and never marks restore applied', async () => {
  const data = new Map([[scopedKey(scopeA, 'tracer.language'), 'en'], [scopedKey(scopeA, 'tracer.workspaceDraft'), 'unsubmitted-work']]);
  const tab = createTab({ data, restoreId: 'no-journal-space', preferences: { 'tracer.language': 'zh' }, fail(operation, key) {
    if (operation === 'set' && key.startsWith('tracer.account.backup-quarantine.')) throw new Error('synthetic-full-storage');
  } });
  await assert.rejects(tab.ready(), /synthetic-full-storage/);
  assert.equal(tab.window.TracerAccount.locked, true);
  assert.equal(data.get(scopedKey(scopeA, 'tracer.language')), 'en');
  assert.equal(data.get(scopedKey(scopeA, 'tracer.workspaceDraft')), 'unsubmitted-work');
  assert.equal(data.has('tracer.account.restore.applied.' + scopeA), false);
});

test('invalid bootstrap preferences fail closed before deleting any current preference or draft', async () => {
  const data = new Map([[scopedKey(scopeA, 'tracer.language'), 'en'], [scopedKey(scopeA, 'tracer.workspaceDraft'), 'keep-invalid-preview-draft']]);
  const tab = createTab({ data, restoreId: 'invalid-preferences', preferences: { 'tracer.language': 'zh', 'tracer.focus.v1': '{broken' } });
  await assert.rejects(tab.ready(), /backup-invalid-preferences/);
  assert.equal(tab.window.TracerAccount.locked, true);
  assert.equal(data.get(scopedKey(scopeA, 'tracer.language')), 'en');
  assert.equal(data.get(scopedKey(scopeA, 'tracer.workspaceDraft')), 'keep-invalid-preview-draft');
  assert.equal(data.has('tracer.account.restore.applied.' + scopeA), false);
});

test('guest restoration uses its own epoch while preserving named-account data', async () => {
  const data = new Map([['tracer.language', 'en'], [scopedKey(scopeA, 'tracer.language'), 'en']]);
  const old = createTab({ data, scope: 'guest' }); await old.ready();
  const restored = createTab({ data, scope: 'guest', restoreId: 'guest-restored', preferences: { 'tracer.language': 'zh' } }); await restored.ready();
  assert.equal(restored.window.localStorage.getItem('tracer.language'), 'zh');
  assert.equal(old.window.TracerAccount.locked, true);
  assert.equal(data.get(scopedKey(scopeA, 'tracer.language')), 'en');
  assert.deepEqual(restored.deletedDatabases, []);
});

test('a pre-restore in-flight response is rejected even before the old window handles its storage event', async () => {
  const data = new Map(); let deliver;
  const old = createTab({ data, fetchImpl: () => new Promise(resolve => { deliver = resolve; }) }); await old.ready();
  const responsePromise = old.window.fetch('/api/store/workspace');
  for (let turn = 0; turn < 5 && !deliver; turn++) await Promise.resolve();
  assert.equal(typeof deliver, 'function');
  const restored = createTab({ data, restoreId: 'replacement', preferences: {} }); await restored.ready();
  deliver(new Response('{"tasks":[{"id":"stale-server-result"}]}', { status: 200, headers: { 'content-type': 'application/json' } }));
  const response = await responsePromise;
  assert.equal(response.status, 409, 'do not let a delayed response revive a pre-restore workspace');
  assert.equal((await response.json()).error, 'account-changed');
});

test('v2 bootstrap restores companion unlocks and care before scoped consumers read',async()=>{const M=require('../skins/tracer/pet-model'),state=M.fresh(1);state.unlocked.push('miso');state.selected='miso';state.pets.miso={food:62,energy:81,joy:73,bond:68,sleeping:false};const tab=createTab({restoreId:'companion-restore',preferences:{'tracer.pet.v1':JSON.stringify(state)}});await tab.ready();const current=JSON.parse(tab.window.localStorage.getItem('tracer.pet.v1'));assert.equal(current.selected,'miso');assert.equal(current.pets.miso.bond,68);});
