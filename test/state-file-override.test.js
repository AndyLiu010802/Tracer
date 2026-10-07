'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { loadServerAtRoot } = require('../dev/test-server-fixture.cjs');

// Exercise real filesystem and HTTP handlers without reading the checkout's
// bookmarks or configuration. The default source root is entirely synthetic.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'state-file-override-test-'));
const SYNTHETIC_ROOT = path.join(TMP, 'source-root');
fs.mkdirSync(SYNTHETIC_ROOT);
const DEFAULT_STATE_FILE = path.join(SYNTHETIC_ROOT, 'bookmarks.json');
const DEFAULT_SNAPSHOT = JSON.stringify({ url: 'https://synthetic-default.invalid/', mode: 'panel' }) + '\n';
fs.writeFileSync(DEFAULT_STATE_FILE, DEFAULT_SNAPSHOT);
const CONFIG_FILE = path.join(SYNTHETIC_ROOT, 'local.config.json');
fs.writeFileSync(CONFIG_FILE, '{}\n');
const OVERRIDE_STATE_FILE = path.join(TMP, 'override-bookmarks.json');
const values = { DOCS_PORTAL_STATE_FILE: OVERRIDE_STATE_FILE, DOCS_PORTAL_DATA_DIR: path.join(TMP, 'data'),
  DOCS_PORTAL_CONFIG_FILE: CONFIG_FILE, DOCS_PORTAL_SKIN: 'docs-portal' };
const originalEnv = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
Object.assign(process.env, values);
const { server } = loadServerAtRoot(SYNTHETIC_ROOT);
let origin;

test.before(() => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    origin = 'http://127.0.0.1:' + server.address().port;
    resolve();
  });
}));

test.after(() => new Promise(resolve => server.close(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  resolve();
})));

function req(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const request = http.request(origin + pathname, {
      method, headers: body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {},
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', reject);
    request.end(body);
  });
}

test('POST /api/state writes the explicit override and preserves the synthetic default file byte for byte', async () => {
  const marker = 'https://state-file-override-marker.invalid/x';
  const response = await req('POST', '/api/state', JSON.stringify({ url: marker, mode: 'dock' }));
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(fs.readFileSync(OVERRIDE_STATE_FILE, 'utf8')).url, marker);
  assert.equal(fs.readFileSync(DEFAULT_STATE_FILE, 'utf8'), DEFAULT_SNAPSHOT);
});

test('GET /api/state reads the explicit override and never returns the synthetic default bookmark', async () => {
  const marker = 'https://state-file-override-marker.invalid/y';
  assert.equal((await req('POST', '/api/state', JSON.stringify({ url: marker, mode: 'panel' }))).status, 200);
  const response = await req('GET', '/api/state');
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).url, marker);
  assert.equal(fs.readFileSync(DEFAULT_STATE_FILE, 'utf8'), DEFAULT_SNAPSHOT);
});
