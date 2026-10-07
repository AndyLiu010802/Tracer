'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSuiteEnvironment, runSuite, tapCounts, testFiles } = require('../dev/test-isolated.cjs');

function room(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'isolated-launcher-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('suite environment replaces all application paths and strips inherited credentials and preload code', t => {
  const base = room(t);
  const inherited = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
    OPENAI_API_KEY: 'synthetic-key', CUSTOM_ACCESS_TOKEN: 'synthetic-token', CUSTOM_SECRET: 'synthetic-secret',
    GH_TOKEN: 'synthetic-gh', github_token: 'synthetic-github', NPM_TOKEN: 'synthetic-npm',
    AWS_ACCESS_KEY_ID: 'synthetic-aws', AWS_SESSION_TOKEN: 'synthetic-session',
    INVITE_CODE: 'synthetic-invite', INVITE_CODE_FILE: 'synthetic-invite-path',
    DOCS_PORTAL_CONFIG_FILE: 'synthetic-old-path', TRACER_USER_DATA_DIR: 'synthetic-old-profile',
    NODE_OPTIONS: '--require synthetic-preload', NODE_PATH: 'synthetic-module-path',
    NODE_TEST_CONTEXT: 'child-v8',
    DOCS_PORTAL_READONLY_STORE: '1', TRACER_LOCAL_BUILD: '1' };
  const initial = { ...inherited };
  const isolated = createSuiteEnvironment(base, 'root', inherited);
  assert.deepEqual(inherited, initial);
  for (const name of ['OPENAI_API_KEY', 'CUSTOM_ACCESS_TOKEN', 'CUSTOM_SECRET', 'GH_TOKEN', 'github_token', 'NPM_TOKEN', 'AWS_ACCESS_KEY_ID', 'AWS_SESSION_TOKEN', 'INVITE_CODE', 'INVITE_CODE_FILE', 'NODE_OPTIONS', 'NODE_PATH', 'NODE_TEST_CONTEXT', 'DOCS_PORTAL_READONLY_STORE', 'TRACER_LOCAL_BUILD']) assert.equal(isolated.env[name], undefined);
  for (const name of ['TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'CODEX_HOME', 'TRACER_USER_DATA_DIR', 'DOCS_PORTAL_DATA_DIR', 'DOCS_PORTAL_STATE_FILE', 'DOCS_PORTAL_CONFIG_FILE']) {
    const relative = path.relative(isolated.root, isolated.env[name]);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), name);
  }
  assert.equal(isolated.env.PATH, inherited.PATH);
  assert.equal(JSON.parse(fs.readFileSync(isolated.configFile)).port, 0);
  assert.throws(() => createSuiteEnvironment(base, 'root', inherited), /EEXIST/);
});

test('root and desktop suites run genuine Node tests in separate synthetic roots and keep process/log evidence', async t => {
  const base = room(t), repo = path.join(base, 'synthetic-repo'), output = path.join(base, 'output');
  fs.mkdirSync(repo); fs.mkdirSync(output);
  for (const directory of ['test', 'desktop/test']) fs.mkdirSync(path.join(repo, directory), { recursive: true });
  const probe = `const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
    test('isolated child uses only synthetic files',()=>{
      assert.equal(os.tmpdir(),process.env.TMP);
      assert.equal(process.env.OPENAI_API_KEY,undefined);
      assert.equal(JSON.parse(fs.readFileSync(process.env.DOCS_PORTAL_CONFIG_FILE)).skin,'tracer');
      fs.writeFileSync(path.join(process.env.DOCS_PORTAL_DATA_DIR,'probe.json'),JSON.stringify({home:os.homedir(),temp:os.tmpdir()}));
    });`;
  fs.writeFileSync(path.join(repo, 'test', 'probe.test.js'), probe);
  fs.writeFileSync(path.join(repo, 'desktop', 'test', 'probe.test.js'), probe);
  const results = await Promise.all(['root', 'desktop'].map(suite => runSuite({ repoRoot: repo, base: output, suite,
    inherited: { ...process.env, OPENAI_API_KEY: 'synthetic-not-inherited' } })));
  for (const result of results) {
    assert.equal(result.exitCode, 0, fs.readFileSync(result.stderrLog, 'utf8'));
    assert.equal(result.counts.pass, 1); assert.equal(result.counts.fail, 0);
    assert(result.pid > 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(result.isolationRoot, 'process.json'))).state, 'completed');
    const probeData = JSON.parse(fs.readFileSync(path.join(result.isolationRoot, 'data', 'probe.json')));
    assert.equal(probeData.home, path.join(result.isolationRoot, 'home'));
    assert.equal(probeData.temp, path.join(result.isolationRoot, 'tmp'));
  }
  assert.notEqual(results[0].isolationRoot, results[1].isolationRoot);
});

test('launcher limits selected files to the selected suite and preserves failed test evidence', async t => {
  const base = room(t), repo = path.join(base, 'repo'), output = path.join(base, 'output');
  fs.mkdirSync(path.join(repo, 'test'), { recursive: true }); fs.mkdirSync(output);
  fs.writeFileSync(path.join(repo, 'test', 'failure.test.js'), "require('node:test')('intentional synthetic failure',()=>{throw Error('fixture-only failure')})");
  fs.writeFileSync(path.join(base, 'outside.test.js'), 'throw Error("must not run")');
  assert.throws(() => testFiles(repo, 'root', [path.join(base, 'outside.test.js')]), /inside the selected suite/);
  const result = await runSuite({ repoRoot: repo, base: output, suite: 'root' });
  assert.equal(result.exitCode, 1); assert.equal(result.counts.fail, 1);
  assert.match(fs.readFileSync(result.stdoutLog, 'utf8'), /fixture-only failure/);
});

test('TAP summary uses final counts and missing counts remain unknown', () => {
  assert.deepEqual(tapCounts('# tests 1\n# pass 1\n# fail 0\n# tests 2\n# pass 1\n# fail 1\n'),
    { tests: 2, suites: null, pass: 1, fail: 1, cancelled: null, skipped: null, todo: null });
  assert.equal(tapCounts('').tests, null);
});
