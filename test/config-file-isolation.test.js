'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadServerAtRoot } = require('../dev/test-server-fixture.cjs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'config-override-test-'));
const sourceRoot = path.join(TMP, 'synthetic-source');
fs.mkdirSync(sourceRoot);
const selectedConfig = path.join(TMP, 'selected-config.json');
fs.writeFileSync(selectedConfig, JSON.stringify({ skin: 'docs-portal', port: 8123 }));
const settings = { DOCS_PORTAL_CONFIG_FILE: selectedConfig, DOCS_PORTAL_DATA_DIR: path.join(TMP, 'data'),
  DOCS_PORTAL_STATE_FILE: path.join(TMP, 'bookmarks.json') };
const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
Object.assign(process.env, settings);
const { loadConfig } = loadServerAtRoot(sourceRoot);
test.after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('no override preserves explicit source-root configuration and defaults', () => {
  assert.equal(loadConfig(sourceRoot, {}).skin, 'tracer');
  assert.equal(loadConfig(sourceRoot, {}).port, 8080);
  fs.writeFileSync(path.join(sourceRoot, 'local.config.json'), JSON.stringify({ skin: 'db-console', port: 8081 }));
  assert.equal(loadConfig(sourceRoot, {}).skin, 'db-console');
  assert.equal(loadConfig(sourceRoot, {}).port, 8081);
});

test('an absolute override selects only that synthetic file; explicit environment still wins', () => {
  fs.writeFileSync(path.join(sourceRoot, 'local.config.json'), JSON.stringify({ skin: 'unselected-synthetic', marker: 'must not merge' }));
  const config = loadConfig(sourceRoot, { DOCS_PORTAL_CONFIG_FILE: selectedConfig });
  assert.equal(config.skin, 'docs-portal'); assert.equal(config.port, 8123);
  assert.equal(config.marker, undefined);
  assert.equal(loadConfig(sourceRoot, { DOCS_PORTAL_CONFIG_FILE: selectedConfig, DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_PORT: '9191' }).port, 9191);
});

test('empty, relative and unavailable explicit paths fail closed with a fixed error', () => {
  for (const file of ['', 'local.config.json', path.join(TMP, 'missing.json')]) {
    assert.throws(() => loadConfig(sourceRoot, { DOCS_PORTAL_CONFIG_FILE: file }),
      error => error.code === 'DOCS_PORTAL_CONFIG_OVERRIDE' && error.message === 'DOCS_PORTAL_CONFIG_FILE must select a readable absolute JSON object file');
  }
});

test('malformed or non-object explicit JSON fails closed without revealing its contents', () => {
  const bad = path.join(TMP, 'bad-config.json');
  for (const contents of ['{"synthetic-private-marker":', 'null', '[]', '"text"']) {
    fs.writeFileSync(bad, contents);
    assert.throws(() => loadConfig(sourceRoot, { DOCS_PORTAL_CONFIG_FILE: bad }),
      error => error.code === 'DOCS_PORTAL_CONFIG_OVERRIDE' && !error.message.includes('synthetic-private-marker'));
  }
});
