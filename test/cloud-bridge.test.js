'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createBridge, endpointUrl } = require('../lib/cloud-sync');
const S = require('../public/workspace-sync');
test('cloud bridge rejects insecure endpoints and unintended hosts', () => {
  for (const u of ['http://env.service.tcloudbase.com/tracer', 'https://127.0.0.1', 'https://evil.tcloudbase.com.example.org', 'https://user:secret@env.service.tcloudbase.com', 'https://env.service.tcloudbase.com/?token=x']) assert.throws(() => endpointUrl(u));
  assert.equal(endpointUrl('https://env.service.tcloudbase.com/tracer'), 'https://env.service.tcloudbase.com/tracer');
});
test('desktop pairing keeps token private, backs up local data, forwards CAS and handles disconnect', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cloud-bridge-'));
  const secret = 'a'.repeat(48); const calls = []; let offline = false;
  const ws = S.empty(); ws.meta.syncAccount = 'account';
  const bridge = createBridge(dir, { request: async (url, options) => {
    calls.push(options); if (offline) throw new Error('offline');
    return { text: async () => JSON.stringify({ ok: true, workspace: ws, token: secret, expiresAt: 99999 }) };
  } });
  try {
    await fs.writeFile(path.join(dir, 'workspace.json'), JSON.stringify(S.empty()));
    const pair = await bridge.pair('https://env.service.tcloudbase.com/tracer', 'b'.repeat(48));
    assert.ok(pair.ok); assert.equal(pair.token, undefined);
    assert.equal((await bridge.status()).token, undefined);
    await fs.access(path.join(dir, '.sync', 'before-pairing.json'));
    const result = await bridge.workspace('PUT', ws); assert.ok(result.ok);
    assert.equal(calls[1].headers.authorization, 'Bearer ' + secret);
    assert.equal(JSON.parse(calls[1].body).version, 0);
    offline = true; await assert.rejects(bridge.workspace('GET'));
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'workspace.json'))), ws);
    await bridge.disconnect(); assert.equal(await bridge.connected(), false);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
