'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createService } = require('../wechat/cloudfunctions/tracer/core');
const S = require('../public/workspace-sync');
const M = require('../skins/tracer/model');
const memoryRepository = require('./helpers/cloud-repository');
const user = { openid: 'wechat-user-a', appid: 'wx-test' };

test('cloud retains completion history when an older client deletes the task and omits history', async () => {
  const service = createService(memoryRepository());
  const ws = (await service({ action: 'read' }, user)).workspace;
  M.addTask(ws, { title: 'Historical delivery', status: 'done' });
  const first = await service({ action: 'write', workspace: ws, version: 0 }, user); assert.ok(first.ok);
  const older = S.clone(first.workspace); delete older.completionHistory; older.tasks = [];
  const second = await service({ action: 'write', workspace: older, version: 1 }, user); assert.ok(second.ok);
  assert.equal(second.workspace.completionHistory.length, 1); assert.equal(second.workspace.completionHistory[0].title, 'Historical delivery');
});
test('pairing is one-use, scoped to an account, expires, and can be revoked', async () => {
  let time = 1000000; const service = createService(memoryRepository(), { now: () => time });
  assert.equal((await service({ action: 'read' }, {})).status, 401);
  const code = await service({ action: 'pairCode' }, user);
  const results = await Promise.all([service({ action: 'pair', code: code.code }), service({ action: 'pair', code: code.code })]);
  assert.equal(results.filter(r => r.ok).length, 1); assert.equal(results.filter(r => r.status === 401).length, 1);
  const pair = results.find(r => r.ok), desktop = { token: pair.token };
  const ws = pair.workspace; M.addTask(ws, { title: 'Desktop task' });
  assert.ok((await service({ action: 'write', workspace: ws, version: 0 }, desktop)).ok);
  assert.equal((await service({ action: 'read' }, user)).workspace.tasks.length, 1);
  assert.equal((await service({ action: 'read' }, { ...user, openid: 'another' })).workspace.tasks.length, 0);
  assert.equal((await service({ action: 'pairCode' }, desktop)).status, 403);
  const devices = await service({ action: 'devices' }, user);
  await service({ action: 'revoke', id: devices.devices[0].id }, user);
  assert.equal((await service({ action: 'read' }, desktop)).status, 401);
  time += 60000; const expired = await service({ action: 'pairCode' }, user);
  time += 5 * 60000;
  assert.equal((await service({ action: 'pair', code: expired.code })).status, 401);
});
test('concurrent cloud writes cannot overwrite each other; rebase preserves both', async () => {
  const service = createService(memoryRepository());
  const initial = (await service({ action: 'read' }, user)).workspace;
  const a = S.clone(initial), b = S.clone(initial);
  M.addTask(a, { title: 'desktop' }); M.addTask(b, { title: 'phone' });
  const results = await Promise.all([service({ action: 'write', workspace: a, version: 0 }, user), service({ action: 'write', workspace: b, version: 0 }, user)]);
  assert.equal(results.filter(r => r.ok).length, 1);
  const conflict = results.find(r => r.status === 409); assert.ok(conflict);
  const merged = S.merge(initial, b, conflict.workspace);
  const saved = await service({ action: 'write', workspace: merged.workspace, version: conflict.workspace.meta.syncVersion }, user);
  assert.ok(saved.ok); assert.equal(saved.workspace.tasks.length, 2); assert.equal(new Set(saved.workspace.tasks.map(t => t.seq)).size, 2);
});
test('invalid snapshots and oversized data never replace valid cloud data', async () => {
  const service = createService(memoryRepository());
  const initial = (await service({ action: 'read' }, user)).workspace;
  assert.equal((await service({ action: 'write', workspace: { tasks: [] }, version: 0 }, user)).status, 400);
  assert.equal((await service({ action: 'write', workspace: initial }, user)).status, 400);
  const large = S.clone(initial); M.addTask(large, { title: 'large', notes: 'x'.repeat(600000) });
  assert.equal((await service({ action: 'write', workspace: large, version: 0 }, user)).status, 413);
  assert.equal((await service({ action: 'read' }, user)).workspace.meta.syncVersion, 0);
});
