'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { createPersonal, endpoint } = require('../lib/ai-personal');
const constraints = { start: '2026-09-15', deadline: '2026-10-15', weekly: 10, daily: 3, session: 1, buffer: 15, days: [1,2,3,4,5] };
const plan = { title: 'Report', summary: 'Write a report.', assumptions: [], risks: [], questions: [], tasks: [
  { key: 't1', title: 'Draft', notes: '', acceptance: 'Reviewed', hours: 2, priority: 'medium', dependsOn: [], checklist: [] }
] };
function temp(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-personal-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; }
const settings = { url: 'https://api.example.com/v1', protocol: 'chat', model: 'my-model', apiKey: 'private-test-key' };
const chat = content => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }));

test('personal API secrets persist only with secure storage; status never returns the key', async t => {
  const dir = temp(t), file = path.join(dir, '.ai/personal.json');
  const a = createPersonal(dir); const status = await a.handle('personal-configure', settings);
  assert.equal(status.configured, true); assert.equal(status.tested, false);
  assert.ok(!JSON.stringify(status).includes(settings.apiKey));
  assert.ok(!fs.readFileSync(file, 'utf8').includes(settings.apiKey));
  assert.equal((await createPersonal(dir).handle('personal-status')).configured, false);
  const secure = { isEncryptionAvailable: () => true, encryptString: s => Buffer.from(s).reverse(), decryptString: b => Buffer.from(b).reverse().toString() };
  const b = createPersonal(dir, { getSecureStorage: () => secure });
  await b.handle('personal-configure', settings);
  assert.ok(JSON.parse(fs.readFileSync(file)).encrypted);
  assert.equal((await createPersonal(dir, { getSecureStorage: () => secure }).handle('personal-status')).configured, true);
  await b.handle('personal-forget'); assert.equal(fs.existsSync(file), false);
  assert.equal((await b.handle('personal-status')).configured, false);
});

test('changing destinations cannot reuse a saved secret; unsafe addresses are rejected', async t => {
  for (const url of ['http://remote.example/v1', 'https://user:pass@example.com/v1', 'https://example.com/v1?key=x', 'https://example.com/v1#x', 'https://example.com/v1/chat/completions']) assert.throws(() => endpoint(url));
  const api = createPersonal(temp(t)); await api.handle('personal-configure', settings);
  await assert.rejects(api.handle('personal-configure', { ...settings, url: 'https://different.example/v1', apiKey: '' }), /api-key-required/);
  assert.equal((await api.handle('personal-status')).url, settings.url);
  await api.handle('personal-configure', { ...settings, apiKey: '', model: 'another-model' });
  assert.equal((await api.handle('personal-status')).hasKey, true);
  await api.handle('personal-configure', { url: 'http://localhost:11434/v1', protocol: 'chat', model: 'local-model', apiKey: '' });
  const status = await api.handle('personal-status'); assert.equal(status.hasKey, false); assert.equal(status.configured, true);
});

test('chat connection test uses the selected model and plan generation validates JSON before returning', async t => {
  const calls = [], api = createPersonal(temp(t), { request: async (url, opts) => { calls.push({ url, ...opts }); return chat(calls.length === 1 ? 'OK' : '```json\n' + JSON.stringify({ ...plan, questions: ['a','b','c'] }) + '\n```'); } });
  await api.handle('personal-configure', settings);
  assert.equal((await api.handle('personal-test')).tested, true);
  assert.equal(JSON.parse(calls[0].body).messages[0].content, 'Reply with only the word OK.');
  const result = await api.handle('personal-plan', { goal: 'Write the report', constraints });
  assert.equal(result.plan.title, 'Report'); assert.equal(result.plan.questions.length, 2);
  assert.equal(calls[1].url, settings.url + '/chat/completions');
  assert.equal(calls[1].redirect, 'error'); assert.equal(calls[1].headers.Authorization, 'Bearer ' + settings.apiKey);
  assert.equal(JSON.parse(calls[1].body).model, 'my-model');
  assert.ok(JSON.parse(calls[1].body).messages[0].content.includes('at most two'));
});

test('Responses protocol uses strict plan schema, respects refusal, and rejects malformed plans', async t => {
  let reply = { output: [{ content: [{ type: 'output_text', text: JSON.stringify(plan) }] }] }, captured;
  const api = createPersonal(temp(t), { request: async (url, opts) => { captured = { url, ...opts }; return new Response(JSON.stringify(reply)); } });
  await api.handle('personal-configure', { ...settings, protocol: 'responses' });
  await api.handle('personal-plan', { goal: 'Report', constraints });
  const body = JSON.parse(captured.body); assert.equal(body.store, false); assert.equal(body.text.format.strict, true); assert.ok(captured.url.endsWith('/responses'));
  reply = { output: [{ content: [{ type: 'refusal' }] }] };
  await assert.rejects(api.handle('personal-plan', { goal: 'Report', constraints }), /plan-refused/);
  reply = { output: [{ content: [{ type: 'output_text', text: '{"tasks":[]}' }] }] };
  await assert.rejects(api.handle('personal-plan', { goal: 'Report', constraints }), /invalid-plan/);
});

test('provider errors cannot leak credentials; oversized replies and concurrent calls are rejected', async t => {
  let finish, response = new Response('secret-error-' + settings.apiKey, { status: 401 });
  const api = createPersonal(temp(t), { request: async () => response });
  await api.handle('personal-configure', settings);
  await assert.rejects(api.handle('personal-test'), { message: 'invalid-api-key' });
  response = new Response('x'.repeat(1000001)); await assert.rejects(api.handle('personal-test'), /invalid-response/);
  const pending = createPersonal(temp(t), { request: () => new Promise(r => { finish = r; }) });
  await pending.handle('personal-configure', settings); const running = pending.handle('personal-test');
  await assert.rejects(pending.handle('personal-configure', settings), /service-busy/);
  finish(chat('OK')); await running;
});
