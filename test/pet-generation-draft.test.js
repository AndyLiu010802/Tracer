'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Draft = require('../skins/tracer/pet-generation-draft');
const asset = number => '/api/pet-art/' + number.toString(16).padStart(32, '0') + '.png';
const png = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64');
const profile = extra => ({ name: 'Moss', kind: 'creature', personality: 'Quiet\nCurious', distinctiveFeatures: 'Round glasses', imageSource: 'codex', imageModel: '', photo: png,
  pages: [asset(1), asset(2)], pageAttempts: Array(16).fill(0), animationVersion: 2, recordId: 'custom_' + 'a'.repeat(32), generationId: 'b'.repeat(32), wasBusy: true,
  generationIdentity: asset(1), pendingReplacement: null, editingId: '', editingSignature: '', retainedFrames: Array(16).fill(16), ...extra });
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
  assert.equal(storage.record.version, 2);
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
  for (const mutate of [record => record.version = 3, record => record.savedAt = 'yesterday', record => record.draft.pages.push('https://example.test/image.png'),
    record => delete record.draft.photo, record => record.draft.wasBusy = 1, record => record.draft.apiKey = 'unexpected',
    record => delete record.draft.generationIdentity, record => delete record.draft.pendingReplacement, record => record.draft.generationIdentity = undefined,
    record => delete record.draft.editingId, record => delete record.draft.editingSignature, record => record.draft.editingId = undefined,
    record => delete record.draft.retainedFrames, record => record.draft.retainedFrames = undefined]) {
    storage.record = structuredClone(valid); mutate(storage.record); const before = structuredClone(storage.record), calls = storage.calls.length;
    await assert.rejects(draft.load(), { code: 'pet-draft-corrupt' });
    assert.deepEqual(storage.record, before); assert.deepEqual(storage.calls.slice(calls), ['get']);
  }
  storage.record = valid; assert.deepEqual(await draft.load(), profile());
});

test('legacy drafts migrate their original idle identity without rewriting storage or discarding completed progress', async () => {
  for (const pages of [[], [asset(1)], Array.from({ length: 16 }, (_, i) => asset(i + 1))]) {
    const legacy = profile({ pages });
    for (const key of ['generationIdentity', 'pendingReplacement', 'editingId', 'editingSignature', 'retainedFrames']) delete legacy[key];
    const record = { version: 1, savedAt: 123, draft: legacy }, storage = memory(record), draft = Draft.create({ storage });
    const restored = await draft.load();
    assert.deepEqual(restored, profile({ pages, generationIdentity: pages[0] || '' }));
    assert.deepEqual(storage.record, record, 'read migration preserves the original record until a successful save');
    assert.deepEqual(storage.calls, ['get']);
    await draft.save(restored);
    assert.equal(storage.record.version, 2); assert.deepEqual(await draft.load(), restored);
  }
});

test('pending single-action replacement restores its attempt and keeps the old sheet until a durable successful replacement', async () => {
  const storage = memory(), draft = Draft.create({ storage }), original = profile({ pages: Array.from({ length: 16 }, (_, i) => asset(i + 1)) });
  await draft.save(original);
  const pending = structuredClone(original); pending.pageAttempts[3] = 1;
  pending.pendingReplacement = { pageIndex: 3, attempt: 1, identityImage: asset(1) };
  const written = await draft.save(pending);
  pending.pendingReplacement.attempt = 9; written.pendingReplacement.identityImage = asset(99);
  const restored = await Draft.create({ storage }).load();
  assert.deepEqual(restored.pages, original.pages);
  assert.deepEqual(restored.pendingReplacement, { pageIndex: 3, attempt: 1, identityImage: asset(1) });
  assert.equal(restored.pageAttempts[3], 1);

  const complete = structuredClone(restored); complete.pages[3] = asset(50); complete.pendingReplacement = null; complete.wasBusy = false;
  const put = storage.put; storage.put = async () => { throw new Error('quota exceeded'); };
  await assert.rejects(draft.save(complete), { code: 'pet-draft-save-failed' });
  assert.deepEqual(await Draft.create({ storage }).load(), restored, 'a failed replacement save still restores the old action and exact retry request');
  storage.put = put; await draft.save(complete);
  const finished = await Draft.create({ storage }).load();
  assert.deepEqual(finished.pages, original.pages.map((page, index) => index === 3 ? asset(50) : page));
  assert.equal(finished.pendingReplacement, null); assert.equal(finished.pageAttempts[3], 1);
  assert.equal(finished.generationIdentity, asset(1));
});

test('partial drafts can replace idle without changing the fixed identity or rewinding an abandoned attempt', async () => {
  const storage = memory(), draft = Draft.create({ storage }), pending = profile(); pending.pageAttempts[0] = 2;
  pending.pendingReplacement = { pageIndex: 0, attempt: 2, identityImage: asset(1) };
  await draft.save(pending);
  const restored = await draft.load();
  restored.pendingReplacement = null;
  await draft.save(restored);
  assert.deepEqual((await draft.load()).pages, [asset(1), asset(2)], 'keeping the old action clears only the pending operation');
  assert.equal((await draft.load()).pageAttempts[0], 2, 'an abandoned request must not reuse its paid generation attempt');
  restored.pages[0] = asset(90); await draft.save(restored);
  assert.equal((await draft.load()).generationIdentity, asset(1), 'replacing idle does not redirect other action cache identities');
  assert.deepEqual((await draft.load()).pages, [asset(90), asset(2)]);
});

test('replacement metadata rejects malformed, inconsistent and out-of-range retry requests before storage', async () => {
  const storage = memory(), draft = Draft.create({ storage }), valid = profile(); valid.pageAttempts[1] = 1;
  valid.pendingReplacement = { pageIndex: 1, attempt: 1, identityImage: asset(1) };
  await draft.save(valid); const count = storage.calls.length;
  const invalid = [
    { generationIdentity: '' }, { generationIdentity: null }, { generationIdentity: 'https://example.test/photo.png' },
    { pages: [], generationIdentity: asset(1), pendingReplacement: null }, { generationId: '' },
    ...[false, [], {}, { pageIndex: 1, attempt: 1 },
      { pageIndex: 1, attempt: 1, identityImage: asset(1), apiKey: 'private' },
      { pageIndex: -1, attempt: 1, identityImage: asset(1) }, { pageIndex: 2, attempt: 1, identityImage: asset(1) },
      { pageIndex: 1.5, attempt: 1, identityImage: asset(1) }, { pageIndex: '1', attempt: 1, identityImage: asset(1) },
      { pageIndex: 1, attempt: 0, identityImage: asset(1) }, { pageIndex: 1, attempt: 2, identityImage: asset(1) },
      { pageIndex: 1, attempt: 1001, identityImage: asset(1) }, { pageIndex: 1, attempt: 1.5, identityImage: asset(1) },
      { pageIndex: 1, attempt: 1, identityImage: asset(2) }, { pageIndex: 1, attempt: 1, identityImage: 'https://example.test/photo.png' }
    ].map(pendingReplacement => ({ pendingReplacement }))
  ];
  for (const extra of invalid) await assert.rejects(draft.save({ ...valid, ...extra }), { code: 'pet-draft-invalid' });
  assert.equal(storage.calls.length, count); assert.deepEqual(await draft.load(), valid);
  storage.record.draft.pendingReplacement.attempt = 2;
  const corrupt = structuredClone(storage.record);
  await assert.rejects(draft.load(), { code: 'pet-draft-corrupt' }); assert.deepEqual(storage.record, corrupt);
});

test('editing a saved companion retains its ID and original artwork signature across replacement recovery', async () => {
  const storage = memory(), draft = Draft.create({ storage }), editing = profile({ editingId: 'custom_' + 'a'.repeat(32), editingSignature: 'f'.repeat(64) });
  editing.pageAttempts[1] = 3; editing.pendingReplacement = { pageIndex: 1, attempt: 3, identityImage: asset(1) };
  await draft.save(editing);
  assert.deepEqual(await Draft.create({ storage }).load(), editing);
  const replaced = structuredClone(editing); replaced.pages[1] = asset(90); replaced.pendingReplacement = null;
  await draft.save(replaced);
  const restored = await Draft.create({ storage }).load();
  assert.equal(restored.recordId, editing.recordId); assert.equal(restored.editingId, editing.editingId);
  assert.equal(restored.editingSignature, editing.editingSignature, 'the source signature survives completed replacements for the eventual save conflict check');
  const count = storage.calls.length;
  for (const extra of [{ editingId: 'sprout' }, { editingId: 'custom_bad' }, { editingId: 'custom_' + 'b'.repeat(32) },
    { editingId: '' }, { editingId: null }, { editingSignature: '' }, { editingSignature: 'F'.repeat(64) },
    { editingSignature: 'f'.repeat(63) }, { editingSignature: null }, { recordId: '' }])
    await assert.rejects(draft.save({ ...editing, ...extra }), { code: 'pet-draft-invalid' });
  assert.equal(storage.calls.length, count);
  assert.deepEqual(await draft.load(), replaced);
});

test('drafts retain original frame counts through pending replacement and upgrade only the completed action', async () => {
  const storage = memory(), draft = Draft.create({ storage }), raw = profile({ pages: Array.from({ length: 16 }, (_, i) => asset(i + 1)), retainedFrames: Array(16).fill(4) });
  raw.retainedFrames[0] = 1; raw.pageAttempts[5] = 1; raw.pendingReplacement = { pageIndex: 5, attempt: 1, identityImage: asset(1) };
  await draft.save(raw); raw.retainedFrames[1] = 16;
  const restored = await Draft.create({ storage }).load();
  assert.deepEqual(restored.retainedFrames, [1, ...Array(15).fill(4)]);
  restored.pages[5] = asset(80); restored.retainedFrames[5] = 16; restored.pendingReplacement = null;
  await draft.save(restored);
  const saved = await Draft.create({ storage }).load();
  assert.deepEqual(saved.retainedFrames, [1, 4, 4, 4, 4, 16, ...Array(10).fill(4)]);
  const count = storage.calls.length;
  for (const retainedFrames of [null, [], Array(15).fill(4), Array(17).fill(4), Array(16), Array(16).fill(0), Array(16).fill(2), Array(16).fill('4')])
    await assert.rejects(draft.save({ ...restored, retainedFrames }), { code: 'pet-draft-invalid' });
  await assert.rejects(draft.save(profile({ retainedFrames: Array(16).fill(4) })), { code: 'pet-draft-invalid' }, 'missing action pages cannot claim retained frames');
  assert.equal(storage.calls.length, count);
  const omitted = profile(); delete omitted.retainedFrames;
  await draft.save(omitted); assert.deepEqual((await draft.load()).retainedFrames, Array(16).fill(16));
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
