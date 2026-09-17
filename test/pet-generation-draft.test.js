'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Draft = require('../skins/tracer/pet-generation-draft');
const asset = number => '/api/pet-art/' + number.toString(16).padStart(32, '0') + '.png';
const png = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64');
const profile = extra => ({ name: 'Moss', kind: 'creature', personality: 'Quiet\nCurious', distinctiveFeatures: 'Round glasses', imageSource: 'codex', imageModel: '', photo: png,
  pages: [asset(1), asset(2)], pageAttempts: Array(16).fill(0), animationVersion: 2, recordId: 'custom_' + 'a'.repeat(32), generationId: 'b'.repeat(32), wasBusy: true, ...extra });
function memory(record = null) {
  return { record, calls: [], async get() { this.calls.push('get'); return structuredClone(this.record); },
    async put(value) { this.calls.push('put:' + value.draft.name); this.record = structuredClone(value); }, async delete() { this.calls.push('delete'); this.record = null; } };
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('generation drafts retain all completed pages and recovery IDs without persisting source files or credentials', async () => {
  const storage = memory(), draft = Draft.create({ storage }), raw = profile({ pages: Array.from({ length: 16 }, (_, i) => asset(i + 1)), source: { name: 'private-photo.png' }, apiKey: 'PRIVATE_KEY', account: 'PRIVATE_ACCOUNT', image: asset(1) });
  const saved = await draft.save(raw);
  assert.deepEqual(saved, profile({ pages: raw.pages }));
  assert.deepEqual(Object.keys(storage.record), ['version', 'savedAt', 'draft']);
  assert.ok(Number.isSafeInteger(storage.record.savedAt));
  assert.doesNotMatch(JSON.stringify(storage.record), /PRIVATE_|private-photo|"source"|"apiKey"|"account"/);
  raw.pages[0] = asset(99); saved.pages[1] = asset(98); raw.pageAttempts[0] = 9;
  const restored = await Draft.create({ storage }).load();
  assert.equal(restored.pages.length, 16); assert.equal(restored.pages[0], asset(1)); assert.equal(restored.pages[1], asset(2));
  assert.equal(restored.generationId, 'b'.repeat(32)); assert.equal(restored.wasBusy, true); assert.equal(restored.photo, png);
  assert.deepEqual(restored.pageAttempts, Array(16).fill(0));
  restored.pages.pop(); assert.equal((await draft.load()).pages.length, 16);
});

test('queued snapshots cannot overtake each other and clear waits behind every earlier save across instances', async () => {
  const storage = memory(), gate = deferred(), entered = deferred(), put = storage.put;
  storage.put = async function(record) { if (!this.calls.length) { entered.resolve(); await gate.promise; } return put.call(this, record); };
  const first = Draft.create({ storage }), second = Draft.create({ storage });
  const original = profile({ name: 'First' }), next = profile({ name: 'Second' });
  const saveFirst = first.save(original); await entered.promise;
  const saveSecond = second.save(next), read = first.load(), clear = second.clear();
  original.name = 'Mutated first'; next.name = 'Mutated second'; next.pages[0] = asset(99);
  assert.deepEqual(storage.calls, []);
  gate.resolve();
  assert.equal((await saveFirst).name, 'First'); assert.equal((await saveSecond).name, 'Second');
  assert.deepEqual((await read).pages, [asset(1), asset(2)]);
  await clear; await first.flush();
  assert.deepEqual(storage.calls, ['put:First', 'put:Second', 'get', 'delete']);
  assert.equal(storage.record, null); assert.equal(await Draft.create({ storage }).load(), null);
});

test('write, read and clear failures reject their callers while later operations can recover', async () => {
  const storage = memory(), draft = Draft.create({ storage }), write = storage.put, read = storage.get, remove = storage.delete;
  const quota = new Error('QuotaExceededError'); let failed = false;
  storage.put = async function(record) { if (!failed) { failed = true; throw quota; } return write.call(this, record); };
  const first = draft.save(profile({ name: 'Failed' })), retry = draft.save(profile({ name: 'Recovered' }));
  await assert.rejects(first, error => error.code === 'pet-draft-save-failed' && error.cause === quota);
  await retry; assert.equal((await draft.load()).name, 'Recovered');
  storage.get = async () => { throw new Error('read unavailable'); };
  await assert.rejects(draft.load(), { message: 'pet-draft-read-failed' });
  storage.get = read;
  storage.delete = async () => { throw new Error('transaction aborted'); };
  const clearing = draft.clear();
  await assert.rejects(clearing, { code: 'pet-draft-clear-failed' });
  await assert.rejects(draft.flush(), { code: 'pet-draft-clear-failed' });
  assert.equal((await draft.load()).name, 'Recovered', 'failed deletion leaves a recoverable draft');
  storage.delete = remove;
  await draft.clear(); assert.equal(await draft.load(), null);
});

test('corrupt stored records are reported distinctly without automatic deletion or replacement', async () => {
  const storage = memory(), draft = Draft.create({ storage });
  await draft.save(profile()); const valid = structuredClone(storage.record);
  for (const mutate of [record => record.version = 2, record => record.savedAt = 'yesterday', record => record.draft.pages.push('https://example.test/image.png'),
    record => delete record.draft.photo, record => record.draft.wasBusy = 1, record => record.draft.apiKey = 'unexpected']) {
    storage.record = structuredClone(valid); mutate(storage.record); const before = structuredClone(storage.record), calls = storage.calls.length;
    await assert.rejects(draft.load(), { code: 'pet-draft-corrupt' });
    assert.deepEqual(storage.record, before); assert.deepEqual(storage.calls.slice(calls), ['get']);
  }
  storage.record = valid; assert.deepEqual(await draft.load(), profile());
});

test('draft input bounds permit resized photos above 5.5 million characters and reject malformed data before storage', async () => {
  const storage = memory(), draft = Draft.create({ storage });
  const bytes = Buffer.alloc(4125000); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  const largePhoto = 'data:image/png;base64,' + bytes.toString('base64'); assert.ok(largePhoto.length > 5500000);
  await draft.save(profile({ photo: largePhoto })); assert.equal((await draft.load()).photo, largePhoto);
  const count = storage.calls.length, sparse = [asset(1)]; sparse.length = 2;
  for (const extra of [{ name: 'x'.repeat(41) }, { personality: 'x'.repeat(601) }, { distinctiveFeatures: 'x'.repeat(401) }, { imageModel: 'x'.repeat(201) },
    { name: 'bad\0name' }, { kind: 'other' }, { imageSource: 'unknown' }, { photo: { name: 'file.png' } }, { photo: 'data:image/svg+xml;base64,PHN2Zy8+' },
    { photo: 'data:image/png;base64,YmFk' }, { photo: png + ' ' }, { photo: 'x'.repeat(6 * 1024 * 1024 + 1) }, { pages: sparse },
    { pages: Array.from({ length: 17 }, () => asset(1)) }, { pages: ['https://example.test/photo.png'] }, { animationVersion: 1 },
    { pageAttempts: [] }, { pageAttempts: Array(16).fill(-1) }, { pageAttempts: Array(16).fill(1001) }, { pageAttempts: Array(16).fill(1.5) },
    { recordId: 'custom_bad' }, { generationId: '../private' }, { wasBusy: 'true' }]) await assert.rejects(draft.save(profile(extra)), { code: 'pet-draft-invalid' });
  assert.equal(storage.calls.length, count, 'invalid input never reaches storage');
  assert.equal((await draft.load()).photo, largePhoto, 'invalid saves preserve the previous recoverable draft');
  const attempts = Array(16).fill(0); attempts[3] = 1000;
  await draft.save(profile({ pageAttempts: attempts })); assert.deepEqual((await draft.load()).pageAttempts, attempts);
  const omitted = profile(); delete omitted.pageAttempts; await draft.save(omitted); assert.deepEqual((await draft.load()).pageAttempts, Array(16).fill(0));
});

test('missing IndexedDB rejects without touching localStorage and remains retryable', async () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), module = { exports: {} };
  const context = { module, get localStorage() { throw new Error('localStorage fallback is forbidden'); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../skins/tracer/pet-generation-draft.js'), 'utf8'), context);
  const draft = module.exports.create();
  await assert.rejects(draft.load(), { code: 'pet-draft-unavailable' });
  await assert.rejects(draft.save({ name: 'Retry' }), { code: 'pet-draft-unavailable' });
  await assert.rejects(draft.clear(), { code: 'pet-draft-unavailable' });
});
