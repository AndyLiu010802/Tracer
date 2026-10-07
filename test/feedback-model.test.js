'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../skins/tracer/feedback-model');

function input(overrides) {
  return Object.assign({ id: 'fb_43d2f0cf-153b-4390-851d-93a7ba967fda', createdAt: 1790596800000, description: 'The timer did not start.' }, overrides);
}
function details() {
  return {
    app: { version: '0.4.1', runtime: 'desktop', language: 'zh', platform: 'windows', browser: 'chrome', viewport: { width: 1200, height: 800 } },
    workspace: { loaded: true, pendingSave: false, saving: true, conflict: false, loadFailed: false, taskCount: 4, projectCount: 2, noteCount: 0, inboxCount: 1 },
    account: { mode: 'account', switching: false },
    focus: { available: true, mode: 'short', running: true, completed: false, historyCount: 500 }
  };
}
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
function code(overrides, expected) {
  assert.throws(() => M.build(input(overrides)), error => error.code === expected && error.message === expected);
}

test('build creates a versioned report, ISO timestamp, and default bug type', () => {
  const report = M.build(input());
  assert.deepEqual(report, {
    format: 'tracer-feedback', version: 1, id: input().id, createdAt: new Date(input().createdAt).toISOString(),
    type: 'bug', description: input().description, steps: '', expected: ''
  });
  for (const type of ['bug', 'idea', 'question']) assert.equal(M.build(input({ type })).type, type);
});

test('diagnostic opt-out omits the property entirely from both report and JSON', () => {
  for (const diagnostics of [undefined, null]) {
    const report = M.build(input({ diagnostics }));
    assert.equal(Object.hasOwn(report, 'diagnostics'), false);
    assert.equal(JSON.stringify(report).includes('diagnostics'), false);
  }
});

test('freeform preserves internal text, markup, line breaks, and optional field whitespace exactly', () => {
  const description = '中文 emoji 🌸\n<script>alert("x")</script>\n  text `\\n`';
  const steps = '\n  1. Start timer\n  2. Wait\n';
  const expected = '  Stay open.\r\n';
  const report = M.build(input({ description: ' \n' + description + ' \n', steps, expected }));
  assert.equal(report.description, description);
  assert.equal(report.steps, steps);
  assert.equal(report.expected, expected);
  assert.deepEqual(JSON.parse(JSON.stringify(report)).description, description);
});

test('description is required and whitespace-only descriptions are rejected', () => {
  for (const description of [undefined, null, '', ' \t\r\n ']) code({ description }, 'DESCRIPTION_REQUIRED');
});

test('freeform accepts exact limits and rejects over-limit values without truncation', () => {
  for (const field of ['description', 'steps', 'expected']) {
    assert.equal(M.build(input({ [field]: 'x'.repeat(4000) }))[field].length, 4000);
    code({ [field]: 'x'.repeat(4001) }, field.toUpperCase() + '_TOO_LONG');
  }
  code({ description: ' '.repeat(4000) + 'x' }, 'DESCRIPTION_TOO_LONG');
});

test('wrong freeform types use stable errors rather than coercing potentially sensitive objects', () => {
  for (const field of ['description', 'steps', 'expected']) {
    for (const value of [false, 3, [], {}, new String('text')]) code({ [field]: value }, 'INVALID_' + field.toUpperCase());
  }
  assert.equal(M.build(input({ steps: null, expected: undefined })).steps, '');
});

test('input, ID, timestamp and category validation use stable errors', () => {
  for (const value of [undefined, null, false, '', []]) assert.throws(() => M.build(value), { code: 'INVALID_INPUT' });
  for (const id of ['', 'a'.repeat(101), '../report', 'secret@example.com', 34, {}, 'a b', '\nfb_1']) code({ id }, 'INVALID_ID');
  for (const createdAt of [undefined, null, '123', Infinity, -Infinity, NaN, 8640000000000001, {}, new Date()]) code({ createdAt }, 'INVALID_CREATED_AT');
  for (const type of ['other', 'BUG', 1, false, {}, []]) code({ type }, 'INVALID_TYPE');
  assert.equal(M.build(input({ createdAt: 0 })).createdAt, '1970-01-01T00:00:00.000Z');
  assert.equal(M.build(input({ id: 'x'.repeat(100) })).id.length, 100);
});

test('known diagnostics retain only approved scalar fields and nested viewport', () => {
  assert.deepEqual(M.diagnostics(details()), details());
  for (const mode of ['focus', 'short', 'long']) assert.equal(M.diagnostics({ focus: { mode } }).focus.mode, mode);
  for (const mode of ['guest', 'account', 'locked']) assert.equal(M.diagnostics({ account: { mode } }).account.mode, mode);
});

test('malicious and extra properties cannot enter reports, even during JSON serialization', () => {
  const secret = 'CANARY_PRIVATE_TASK_SECRET_37';
  const d = details();
  Object.assign(d, { title: secret, data: { tasks: [secret] }, logs: secret, token: secret });
  Object.assign(d.app, { userAgent: secret, url: secret, path: secret, toJSON() { throw new Error('unsafe serialization'); } });
  Object.assign(d.app.viewport, { screen: secret });
  Object.assign(d.workspace, { tasks: [secret], title: secret, notes: secret, id: secret });
  Object.assign(d.account, { email: secret, id: secret, session: secret });
  Object.assign(d.focus, { task: { title: secret }, history: [secret], id: secret });
  const report = M.build(input({ diagnostics: d, email: secret, token: secret }));
  assert.deepEqual(report.diagnostics, details());
  assert.equal(JSON.stringify(report).includes(secret), false);
});

test('diagnostics use strict booleans and bounded integer counts without coercion', () => {
  for (const value of [undefined, null, '', '1', 1.5, -1, 1000001, Infinity, NaN, {}, true]) {
    const d = M.diagnostics({ workspace: { loaded: value, taskCount: value, projectCount: value, noteCount: value, inboxCount: value }, focus: { historyCount: value } });
    assert.equal(d.workspace.loaded, value === true);
    for (const field of ['taskCount', 'projectCount', 'noteCount', 'inboxCount']) assert.equal(d.workspace[field], null);
    assert.equal(d.focus.historyCount, null);
  }
  for (const value of [0, 1000000]) assert.equal(M.diagnostics({ workspace: { taskCount: value } }).workspace.taskCount, value);
  const d = M.diagnostics({ workspace: { loaded: 1, pendingSave: 'true', saving: true, conflict: {}, loadFailed: [] }, account: { switching: true }, focus: { available: 'true', running: true, completed: 1 } });
  assert.deepEqual([d.workspace.loaded, d.workspace.pendingSave, d.workspace.saving, d.workspace.conflict, d.workspace.loadFailed, d.account.switching, d.focus.available, d.focus.running, d.focus.completed], [false, false, true, false, false, true, false, true, false]);
});

test('unknown enums, null records and malformed viewport values normalize safely', () => {
  for (const value of [undefined, null, [], 'private', 2, false]) {
    const d = M.diagnostics(value);
    assert.equal(d.app.version, 'unknown');
    assert.equal(d.app.platform, 'unknown');
    assert.equal(d.app.runtime, 'browser');
    assert.equal(d.app.language, 'en');
    assert.equal(d.app.browser, 'other');
    assert.equal(d.account.mode, 'guest');
    assert.equal(d.focus.mode, 'focus');
  }
  const d = M.diagnostics({ app: { runtime: 'private', language: 'private', platform: 'private', browser: 'private', viewport: { width: '1200', height: 32769 } }, account: { mode: 'private' }, focus: { mode: 'private' } });
  assert.equal(JSON.stringify(d).includes('private'), false);
  assert.deepEqual(d.app.viewport, { width: null, height: null });
  assert.deepEqual(M.diagnostics({ app: { viewport: { width: 0, height: 32768 } } }).app.viewport, { width: 0, height: 32768 });
});

test('version sanitizer allows release versions without arbitrary metadata or private strings', () => {
  for (const version of ['0.4.1', '1.0.0', '12.20.300', '1.0.0-alpha', '1.2.3-beta.2', '2.0.0-rc.0']) {
    assert.equal(M.diagnostics({ app: { version } }).app.version, version);
  }
  for (const version of ['', 'v0.4.1', '01.2.3', '1.2', '1.2.3+private', '1.2.3-person@example.com', '1.2.3-localname', '1.2.3-rc.01', '1.2.3\n', '1'.repeat(10000), 1, {}]) {
    assert.equal(M.diagnostics({ app: { version } }).app.version, 'unknown');
  }
});

test('build re-normalizes caller diagnostics instead of trusting already-sanitized objects', () => {
  const d = M.diagnostics(details());
  d.account.email = 'MUST_NOT_LEAK';
  d.workspace.taskCount = 'MUST_NOT_LEAK';
  d.app.version = 'MUST_NOT_LEAK';
  const report = M.build(input({ diagnostics: d }));
  assert.equal(report.diagnostics.workspace.taskCount, null);
  assert.equal(report.diagnostics.app.version, 'unknown');
  assert.equal(JSON.stringify(report).includes('MUST_NOT_LEAK'), false);
});

test('frozen input is untouched and output owns new detached diagnostic records', () => {
  const source = deepFreeze(input({ diagnostics: details() }));
  const before = JSON.stringify(source);
  const report = M.build(source);
  assert.equal(JSON.stringify(source), before);
  assert.notEqual(report.diagnostics, source.diagnostics);
  assert.notEqual(report.diagnostics.app, source.diagnostics.app);
  assert.notEqual(report.diagnostics.app.viewport, source.diagnostics.app.viewport);
  report.diagnostics.app.viewport.width = 390;
  assert.equal(source.diagnostics.app.viewport.width, 1200);
});

test('whitelist ignores inherited values and does not execute input accessors or recurse', () => {
  const d = Object.create({ account: { mode: 'account' } });
  d.app = Object.create({ version: '9.9.9' });
  Object.defineProperty(d.app, 'platform', { get() { throw new Error('accessor called'); } });
  Object.defineProperty(d, 'secrets', { get() { throw new Error('extra accessor called'); } });
  d.unknownCycle = d;
  const result = M.diagnostics(d);
  assert.equal(result.account.mode, 'guest');
  assert.equal(result.app.version, 'unknown');
  assert.equal(result.app.platform, 'unknown');
  assert.doesNotThrow(() => JSON.stringify(M.build(input({ diagnostics: d }))));
});

test('browser UMD exposes the same API without requiring node globals', () => {
  const sandbox = { self: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../skins/tracer/feedback-model.js'), 'utf8'), sandbox);
  const api = sandbox.self.TracerFeedbackModel;
  assert.equal(typeof api.build, 'function');
  assert.equal(typeof api.diagnostics, 'function');
  assert.equal(JSON.stringify(api.build(input({ diagnostics: details() }))), JSON.stringify(M.build(input({ diagnostics: details() }))));
});
