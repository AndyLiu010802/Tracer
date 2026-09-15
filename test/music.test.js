'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createMusic, byteRange } = require('../lib/music');
const M = require('../skins/tracer/music-model');

test('audio byte ranges support seeks, suffixes and reject invalid ranges', () => {
  assert.deepEqual(byteRange('bytes=2-5', 10), { start: 2, end: 5 });
  assert.deepEqual(byteRange('bytes=7-', 10), { start: 7, end: 9 });
  assert.deepEqual(byteRange('bytes=-3', 10), { start: 7, end: 9 });
  assert.deepEqual(byteRange('bytes=0-99', 10), { start: 0, end: 9 });
  for (const range of ['bytes=20-', 'bytes=5-2', 'bytes=-0', 'bytes=-', 'bytes=1-2,4-5', 'bytes=foo']) assert.equal(byteRange(range, 10), false);
});

test('music catalogue and streaming serve only supported local files, including Chinese names', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracer-music-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dir, '颂钵 & 雨声.mp3'), '0123456789');
  await fs.writeFile(path.join(dir, 'private.txt'), 'secret');
  const handle = createMusic(dir);
  const server = http.createServer((req, res) => handle(req, res, new URL(req.url, 'http://localhost').pathname));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections(); return new Promise(r => server.close(r)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const list = await (await fetch(base + '/api/music')).json();
  assert.equal(list.tracks.length, 1); assert.equal(list.tracks[0].name, '颂钵 & 雨声');
  assert.deepEqual(Object.keys(list.tracks[0]).sort(), ['id', 'name', 'url']);
  const url = base + list.tracks[0].url;
  const response = await fetch(url, { headers: { range: 'bytes=3-6' } });
  assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), 'bytes 3-6/10');
  assert.equal(response.headers.get('content-type'), 'audio/mpeg'); assert.equal(await response.text(), '3456');
  const head = await fetch(url, { method: 'HEAD' }); assert.equal(head.headers.get('content-length'), '10'); assert.equal(await head.text(), '');
  assert.equal((await fetch(url, { headers: { range: 'bytes=10-' } })).status, 416);
  assert.equal((await fetch(base + '/api/music/private.txt')).status, 404);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
  await fs.unlink(path.join(dir, '颂钵 & 雨声.mp3')); assert.equal((await fetch(url)).status, 404);
  assert.deepEqual((await (await fetch(base + '/api/music')).json()).tracks, []);
});

test('playlists sanitize saved data and wrap while random selection avoids immediate repetition', () => {
  assert.deepEqual(M.read({ volume: 5, sequence: [{ id: 'a', minutes: -3 }, { id: 'a' }, null, { id: 'b', minutes: 500 }] }), {
    mode: 'single', volume: 1, selected: '', sequence: [{ id: 'a', minutes: .1 }, { id: 'b', minutes: 180 }]
  });
  const plan = [{ id: 'a' }, { id: 'b' }];
  assert.equal(M.next(plan, 'b'), 'a'); assert.equal(M.next([], 'a'), '');
  assert.equal(M.randomTrack(plan, 'a', .5), 'b'); assert.equal(M.randomTrack([{ id: 'a' }], 'a', 0), 'a');
});

test('playlist allocations count media playback including a file loop, not paused wall time', () => {
  assert.equal(M.mediaElapsed(2, 2, 10), 0);
  assert.equal(M.mediaElapsed(2, 3.5, 10), 1.5);
  assert.equal(M.mediaElapsed(9.8, .2, 10), .3999999999999993);
  assert.equal(M.mediaElapsed(0, 0, NaN), 0);
});
