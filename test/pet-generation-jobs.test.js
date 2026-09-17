'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), fsp = require('node:fs/promises'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib');
const { createJobs } = require('../lib/pet-generation-jobs'), Images = require('../lib/pet-image');
function crc(bytes) { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; } return (value ^ 0xffffffff) >>> 0; }
function chunk(name, data) { const bytes = Buffer.alloc(data.length + 12); bytes.writeUInt32BE(data.length); bytes.write(name, 4); data.copy(bytes, 8); bytes.writeUInt32BE(crc(bytes.subarray(4, -4)), bytes.length - 4); return bytes; }
function png(edge = 1) { const header = Buffer.alloc(13); header.writeUInt32BE(edge); header.writeUInt32BE(edge, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.alloc((edge * 4 + 1) * edge))), chunk('IEND', Buffer.alloc(0))]); }
const sheet = png(768), photo = 'data:image/png;base64,' + png().toString('base64');
const action = 'codex-pet-image', id = 'a'.repeat(32);
const request = extra => ({ generationId: id, generationAttempt: 0, animationVersion: 2, animationPage: 0, name: 'Moss', kind: 'creature', personality: 'Patient', photo, ...extra });
function room(t) {
  // Production uses promise-based native realpath for journal I/O. Match that
  // spelling so injected failures hit on Darwin /var and Windows 8.3 TEMP paths.
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-pet-jobs-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir;
}
const result = async (dir, page = 0) => ({ image: await Images.storeGenerated(dir, sheet), animationVersion: 2, animationPage: page });
const journal = (dir, page = 0, attempt = 0) => path.join(dir, '.pet-generation-jobs', id + '-' + page + '-' + attempt + '.json');
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('identical concurrent generation requests share one provider call and completed results survive a fresh module instance', async t => {
  const dir = room(t), jobs = createJobs(dir), entered = deferred(), finish = deferred(); let calls = 0;
  const generate = async () => { calls++; entered.resolve(); await finish.promise; return { ...await result(dir), model: 'ignored-provider-model', apiKey: 'PRIVATE_RESULT_KEY' }; };
  const first = jobs.run(action, request({ apiKey: 'PRIVATE_REQUEST_KEY' }), generate); await entered.promise;
  const concurrent = createJobs(dir).run(action, request(), generate); assert.equal(first, concurrent, 'in-flight callers receive the same promise');
  finish.resolve(); const completed = await first; assert.deepEqual(await concurrent, completed); assert.equal(calls, 1);
  const text = fs.readFileSync(journal(dir), 'utf8'), record = JSON.parse(text);
  assert.deepEqual(Object.keys(record), ['version', 'requestHash', 'result']);
  assert.deepEqual(Object.keys(record.result), ['image', 'animationVersion', 'animationPage']);
  assert.doesNotMatch(text, /PRIVATE_|data:image|Patient|Moss|model|apiKey/); assert.match(record.requestHash, /^[a-f0-9]{64}$/);
  delete require.cache[require.resolve('../lib/pet-generation-jobs')];
  const reopened = require('../lib/pet-generation-jobs').createJobs(dir);
  assert.deepEqual(await reopened.run(action, request(), () => { throw new Error('must not generate again'); }), completed);
  completed.image = '/altered'; assert.equal((await reopened.run(action, request(), generate)).image, record.result.image); assert.equal(calls, 1);
});

test('provider and request changes cannot reuse a generation key, while explicit attempts can replace a rejected frame sheet', async t => {
  const dir = room(t), jobs = createJobs(dir); let calls = 0;
  const generate = async () => { calls++; return result(dir); };
  const first = await jobs.run(action, request(), generate);
  assert.deepEqual(await jobs.run(action, request({ name: 'Renamed', personality: 'Lively' }), generate), first, 'metadata edits reuse the already generated artwork');
  assert.equal(calls, 1);
  for (const changed of [{ kind: 'humanoid' }, { imageModel: 'another-model' }, { distinctiveFeatures: 'Round glasses' }, { photo: 'data:image/png;base64,' + png(2).toString('base64') }, { animationVersion: 1 }])
    await assert.rejects(createJobs(dir).run(action, request(changed), generate), /pet-generation-conflict/);
  await assert.rejects(jobs.run('personal-pet-image', request(), generate), /pet-generation-conflict/);
  const second = await jobs.run(action, request({ generationAttempt: 1 }), generate);
  assert.notEqual(second.image, first.image); assert.equal(calls, 2);
  assert.deepEqual(await jobs.run(action, request(), generate), first);
  assert.deepEqual(await jobs.run(action, request({ generationAttempt: 1 }), generate), second); assert.equal(calls, 2);
  assert.ok(fs.existsSync(journal(dir, 0, 1)));
});

test('replacing one action preserves the other fifteen journals and the first idle identity across reloads and idle redraws', async t => {
  const dir = room(t), jobs = createJobs(dir), initial = []; let calls = 0;
  const generate = page => async () => { calls++; return result(dir, page); };
  for (let page = 0; page < 16; page++) {
    initial.push(await jobs.run(action, request({ animationPage: page, ...(page ? { identityImage: initial[0].image } : {}) }), generate(page)));
  }
  const identity = initial[0].image;
  const originals = initial.map((_, page) => ({ bytes: fs.readFileSync(journal(dir, page)), modified: fs.statSync(journal(dir, page)).mtimeMs }));
  const assertOriginals = () => originals.forEach((original, page) => {
    assert.deepEqual(fs.readFileSync(journal(dir, page)), original.bytes, 'original page ' + page + ' journal is preserved');
    assert.equal(fs.statSync(journal(dir, page)).mtimeMs, original.modified, 'original page ' + page + ' journal is not rewritten');
  });

  const replacementRequest = request({ animationPage: 7, generationAttempt: 1, identityImage: identity });
  const entered = deferred(), finish = deferred();
  const replacement = jobs.run(action, replacementRequest, async () => { calls++; entered.resolve(); await finish.promise; return result(dir, 7); });
  await entered.promise;
  const concurrent = createJobs(dir).run(action, replacementRequest, () => { throw new Error('concurrent replacement must share provider work'); });
  assert.equal(concurrent, replacement);
  finish.resolve();
  const replaced = await replacement;
  assert.deepEqual(await concurrent, replaced); assert.notEqual(replaced.image, initial[7].image); assert.equal(calls, 17);
  assertOriginals();
  assert.equal(fs.readdirSync(path.join(dir, '.pet-generation-jobs')).length, 17, 'only the selected action gains a replacement journal');

  delete require.cache[require.resolve('../lib/pet-generation-jobs')];
  const reopened = require('../lib/pet-generation-jobs').createJobs(dir);
  const noGenerate = () => { calls++; throw new Error('completed action must be restored without another provider call'); };
  assert.deepEqual(await reopened.run(action, replacementRequest, noGenerate), replaced);
  const idleRequest = request({ generationAttempt: 1, identityImage: identity });
  const redrawnIdle = await reopened.run(action, idleRequest, generate(0));
  assert.notEqual(redrawnIdle.image, identity);
  assert.deepEqual(await reopened.run(action, request(), noGenerate), initial[0]);
  for (let page = 1; page < 16; page++) {
    assert.deepEqual(await reopened.run(action, request({ animationPage: page, identityImage: identity }), noGenerate), initial[page]);
  }
  const nextRequest = request({ animationPage: 12, generationAttempt: 1, identityImage: identity });
  const nextReplacement = await reopened.run(action, nextRequest, generate(12));
  assert.notEqual(nextReplacement.image, initial[12].image); assert.equal(calls, 19);
  for (const originalRequest of [replacementRequest, idleRequest, nextRequest, request({ animationPage: 1, identityImage: identity })]) {
    await assert.rejects(reopened.run(action, { ...originalRequest, identityImage: redrawnIdle.image }, noGenerate), /pet-generation-conflict/);
  }
  assert.deepEqual(await reopened.run(action, replacementRequest, noGenerate), replaced, 'a conflicting identity does not poison the original replacement');
  assert.deepEqual(await reopened.run(action, nextRequest, noGenerate), nextReplacement);
  assert.equal(calls, 19); assertOriginals();
  assert.equal(fs.readdirSync(path.join(dir, '.pet-generation-jobs')).length, 19);
});

test('a failed action replacement keeps the accepted action available and retries only the replacement attempt', async t => {
  const dir = room(t), jobs = createJobs(dir); let calls = 0;
  const generate = page => async () => { calls++; return result(dir, page); };
  const idle = await jobs.run(action, request(), generate(0));
  const originalRequest = request({ animationPage: 5, identityImage: idle.image });
  const original = await jobs.run(action, originalRequest, generate(5));
  const originalJournal = fs.readFileSync(journal(dir, 5));
  const replacementRequest = { ...originalRequest, generationAttempt: 1 }, unavailable = new Error('replacement-provider-unavailable');
  await assert.rejects(jobs.run(action, replacementRequest, () => { calls++; throw unavailable; }), failure => failure === unavailable);
  assert.equal(fs.existsSync(journal(dir, 5, 1)), false);
  const noGenerate = () => { calls++; throw new Error('accepted action must not be regenerated'); };
  assert.deepEqual(await createJobs(dir).run(action, originalRequest, noGenerate), original);
  assert.deepEqual(await createJobs(dir).run(action, request(), noGenerate), idle);
  assert.equal(calls, 3);
  const replacement = await createJobs(dir).run(action, replacementRequest, generate(5));
  assert.notEqual(replacement.image, original.image); assert.equal(calls, 4);
  assert.deepEqual(await createJobs(dir).run(action, replacementRequest, noGenerate), replacement);
  assert.deepEqual(await createJobs(dir).run(action, originalRequest, noGenerate), original);
  assert.deepEqual(fs.readFileSync(journal(dir, 5)), originalJournal);
  assert.equal(calls, 4);
});

test('provider failures retry but a journal write failure retains the paid result for persistence retry', async t => {
  const dir = room(t), jobs = createJobs(dir); let calls = 0;
  const unavailable = new Error('provider-unreachable');
  const generate = async () => { if (++calls === 1) throw unavailable; return result(dir); };
  await assert.rejects(jobs.run(action, request(), generate), failure => failure === unavailable);
  const original = fsp.rename; let failed = false;
  t.mock.method(fsp, 'rename', async (from, to) => {
    if (!failed && to === journal(dir)) { failed = true; throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); }
    return original.call(fsp, from, to);
  });
  await assert.rejects(jobs.run(action, request(), generate), /pet-generation-journal-save-failed/);
  assert.equal(failed, true, 'the write-failure injection must hit the canonical journal destination');
  assert.equal(calls, 2); assert.equal(fs.existsSync(journal(dir)), false); assert.deepEqual(fs.readdirSync(path.join(dir, '.pet-generation-jobs')), []);
  const savedFiles = fs.readdirSync(path.join(dir, '.pet-art'));
  const recovered = await createJobs(dir).run(action, request(), () => { throw new Error('must only retry persistence'); });
  assert.equal(recovered.image.split('/').pop(), savedFiles[0]); assert.ok(fs.existsSync(journal(dir))); assert.equal(calls, 2);
});

test('missing or unusable saved artwork never silently starts another paid generation', async t => {
  for (const invalid of ['missing', 'small', 'hardlink']) {
    const dir = room(t); let calls = 0;
    const generate = async () => { calls++; return result(dir); }, jobs = createJobs(dir);
    const saved = await jobs.run(action, request(), generate), file = path.join(dir, '.pet-art', path.basename(saved.image));
    if (invalid === 'missing') fs.unlinkSync(file);
    else if (invalid === 'small') fs.writeFileSync(file, png());
    else fs.linkSync(file, path.join(dir, 'linked.png'));
    await assert.rejects(createJobs(dir).run(action, request(), generate), /pet-generation-art-missing/);
    assert.equal(calls, 1);
  }
});

test('malicious generation keys and unsupported attempts fail before files or provider calls', async t => {
  const dir = room(t), jobs = createJobs(dir); let calls = 0;
  const generate = async () => { calls++; return result(dir); };
  for (const generationId of ['../outside', 'A'.repeat(32), 'a'.repeat(33), '', null, {}, ['a'.repeat(32)]])
    await assert.rejects(jobs.run(action, request({ generationId }), generate), /invalid-generation-id/);
  for (const generationAttempt of [-1, 1001, 1.5, '1', null]) await assert.rejects(jobs.run(action, request({ generationAttempt }), generate), /invalid-generation-attempt/);
  for (const animationPage of [undefined, -1, 16, '0']) await assert.rejects(jobs.run(action, request({ animationPage, ...(animationPage === undefined ? { animationVersion: undefined } : {}) }), generate), /invalid-(generation|animation)-page/);
  await assert.rejects(jobs.run(action, request({ photo: 'https://example.test/photo.png' }), generate), /invalid-pet-photo/);
  assert.equal(calls, 0); assert.deepEqual(fs.readdirSync(dir), []);
});

test('corrupt, oversized and linked journals fail closed, rather than becoming new paid requests', async t => {
  for (const kind of ['json', 'schema', 'oversized', 'hardlink', 'folder-link']) {
    const dir = room(t), folder = path.join(dir, '.pet-generation-jobs'), outside = path.join(dir, 'outside'); let calls = 0;
    fs.mkdirSync(outside);
    if (kind === 'folder-link') fs.symlinkSync(outside, folder, process.platform === 'win32' ? 'junction' : 'dir');
    else {
      fs.mkdirSync(folder);
      fs.writeFileSync(journal(dir), kind === 'schema' ? JSON.stringify({ version: 1, requestHash: 'x', result: {} }) : kind === 'oversized' ? 'x'.repeat(4097) : '{broken');
      if (kind === 'hardlink') fs.linkSync(journal(dir), path.join(outside, 'copy.json'));
    }
    await assert.rejects(createJobs(dir).run(action, request(), async () => { calls++; return result(dir); }), /pet-generation-journal-corrupt/);
    assert.equal(calls, 0); assert.equal(fs.existsSync(path.join(dir, '.pet-art')), false);
    if (kind === 'folder-link') assert.deepEqual(fs.readdirSync(outside), []);
  }
});

test('journal read errors do not appear as absent records and old requests retain their original behavior', async t => {
  const dir = room(t), jobs = createJobs(dir), original = fsp.lstat; let calls = 0, fail = true, failedReads = 0;
  t.mock.method(fsp, 'lstat', async file => {
    if (fail && file === journal(dir)) { failedReads++; throw Object.assign(new Error('permission denied'), { code: 'EACCES' }); }
    return original.call(fsp, file);
  });
  const generate = async () => { calls++; return result(dir); };
  await assert.rejects(jobs.run(action, request(), generate), /pet-generation-journal-read-failed/); assert.equal(calls, 0);
  assert.equal(failedReads, 1, 'the read-failure injection must hit the canonical journal filename');
  fail = false; await jobs.run(action, request(), generate); assert.equal(calls, 1);
  const untouched = room(t), legacy = createJobs(untouched), rawResult = { arbitrary: 'unchanged', model: 'legacy-model' };
  for (const [name, data] of [[action, {}], ['personal-chat', { generationId: '../ignored' }]]) assert.equal(await legacy.run(name, data, () => rawResult), rawResult);
  assert.deepEqual(fs.readdirSync(untouched), []);
});

test('system temporary path spellings and canonical paths recover the same completed journal', async t => {
  const supplied = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-pet-jobs-alias-')), canonical = fs.realpathSync.native(supplied);
  t.after(() => fs.rmSync(canonical, { recursive: true, force: true }));
  let calls = 0;
  const saved = await createJobs(supplied).run(action, request(), async () => { calls++; return result(supplied); });
  assert.ok(fs.existsSync(journal(canonical)));
  const recovered = await createJobs(canonical).run(action, request(), () => { calls++; throw new Error('completed result must be recovered'); });
  assert.deepEqual(recovered, saved); assert.equal(calls, 1);
  assert.deepEqual(await Images.readAsset(supplied, recovered.image), sheet);
  assert.deepEqual(await Images.readAsset(canonical, recovered.image), sheet);
});
