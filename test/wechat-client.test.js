'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../public/workspace-sync');
const M = require('../skins/tracer/model');
const { createService } = require('../wechat/cloudfunctions/tracer/core');
const repository = require('./helpers/cloud-repository');
function client(service, storage, network, envId = 'test-env') {
  const context = { module: { exports: {} }, require: name => name === '../config' ? { envId, functionName: 'tracer' } : name === './model' ? M : S,
    wx: { getStorageSync: key => S.clone(storage.get(key)), setStorageSync: (key, value) => storage.set(key, S.clone(value)), removeStorageSync: key => storage.delete(key),
      cloud: { callFunction: async ({ data }) => { if (network.offline) throw new Error('offline'); return { result: await service(data, { openid: 'a', appid: 'wx' }) }; } } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../wechat/miniprogram/lib/store.js'), 'utf8'), context);
  return context.module.exports;
}
test('phone offline draft survives restart and retries without duplicate tasks', async () => {
  const service = createService(repository()), storage = new Map(), network = { offline: false };
  let c = client(service, storage, network); await c.load();
  network.offline = true;
  await assert.rejects(c.mutate(ws => M.addTask(ws, { title: 'offline draft' })));
  assert.equal(c.snapshot().dirty, true);
  network.offline = false; c = client(service, storage, network); await c.load();
  assert.equal(c.snapshot().data.tasks[0].title, 'offline draft');
  await c.flush(); await c.flush();
  assert.equal(c.snapshot().dirty, false); assert.equal(storage.size, 0);
  assert.equal((await service({ action: 'read' }, { openid: 'a', appid: 'wx' })).workspace.tasks.length, 1);
});
test('phone and desktop merge different fields and ask about same-field conflicts', async () => {
  const service = createService(repository()), user = { openid: 'a', appid: 'wx' };
  const c = client(service, new Map(), {}); await c.load();
  await c.mutate(ws => M.addTask(ws, { title: 'original' }));
  let remote = (await service({ action: 'read' }, user)).workspace;
  remote.tasks[0].notes = 'desktop notes'; await service({ action: 'write', workspace: remote, version: remote.meta.syncVersion }, user);
  await c.mutate(ws => { ws.tasks[0].due = '2026-10-01'; });
  assert.equal(c.snapshot().data.tasks[0].notes, 'desktop notes');
  remote = (await service({ action: 'read' }, user)).workspace; remote.tasks[0].title = 'desktop title';
  await service({ action: 'write', workspace: remote, version: remote.meta.syncVersion }, user);
  await assert.rejects(c.mutate(ws => { ws.tasks[0].title = 'phone title'; }));
  const conflicts = c.getConflicts(); assert.equal(conflicts.length, 1);
  await c.resolve({ [conflicts[0].key]: 'remote' });
  assert.equal(c.snapshot().data.tasks[0].title, 'desktop title'); assert.equal(c.snapshot().dirty, false);
});
test('demo data never contacts cloud, and mutation errors do not alter the workspace', async () => {
  let calls = 0; const storage = new Map();
  const c = client(async () => { calls++; }, storage, {}, '');
  await c.load(); await c.mutate(ws => M.addTask(ws, { title: 'demo' }));
  assert.equal(calls, 0); assert.equal(c.snapshot().demo, true);
  await assert.rejects(c.mutate(ws => { ws.tasks = []; throw new Error('failed'); }));
  assert.equal(c.snapshot().data.tasks.length, 1);
});
