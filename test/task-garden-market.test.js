'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../public/task-garden');
const S = require('../public/workspace-sync');
const M = require('../skins/tracer/model');
const clone = value => JSON.parse(JSON.stringify(value));
function ws() { return M.emptyWorkspace(); }
function plant(workspace, id, kind = 0, ticket = 1234, projectId = null, now = 100) {
  const task = { id, title: id, projectId, status: 'doing', createdAt: now, updatedAt: now, doneAt: null, order: now };
  workspace.tasks.push(task);
  G.taskChanged(workspace, task, now, limit => limit === 10000 ? ticket : kind);
  return task;
}
function complete(workspace, task, now = 200) {
  task.status = 'done'; task.doneAt = now; task.updatedAt = now; G.taskChanged(workspace, task, now);
}
function harvest(workspace, id, kind = 0, ticket = 1234, projectId = null, now = 100) {
  const task = plant(workspace, id, kind, ticket, projectId, now);
  complete(workspace, task, now + 10); G.harvest(workspace, id, now + 20); return task;
}
function funded() {
  const workspace = ws();
  for (let i = 0; i < 8; i++) harvest(workspace, 'fund_' + i, 4, 1234, null, 100 + i);
  assert.equal(G.sell(workspace, 'peach', 8, 300).earned, 240);
  return workspace;
}
function cyber() {
  const workspace = funded();
  assert.equal(G.buyFarm(workspace, 'cyber', 400).ok, true);
  assert.equal(G.equipFarm(workspace, 'cyber', 500).ok, true);
  return workspace;
}
function row(workspace, kind) { return G.inventory(workspace).find(p => p.plantKind === kind); }

test('market projections are read-only and expose nine species with a free equipped meadow', () => {
  const workspace = ws(), original = clone(workspace);
  assert.deepEqual(G.KINDS, ['wildflower', 'sunflower', 'lavender', 'apple', 'peach', 'cherry', 'neon_orchid', 'volt_berry', 'crystal_tree']);
  assert.deepEqual(G.CATALOG.map(p => p.unitPrice), [12, 18, 20, 25, 30, 28, 32, 36, 40]);
  assert.deepEqual(G.economy(workspace), { balance: 0, earned: 0, spent: 0, equippedFarmId: 'meadow', ownedFarmIds: ['meadow'] });
  assert.equal(G.inventory(workspace).length, 9);
  assert.ok(G.inventory(workspace).every(p => p.available === 0 && p.harvested === 0 && p.sold === 0));
  assert.deepEqual(G.farms(workspace), [
    { id: 'meadow', price: 0, plantKinds: G.KINDS.slice(0, 6), owned: true, equipped: true },
    { id: 'cyber', price: 240, plantKinds: G.KINDS.slice(6), owned: false, equipped: false }
  ]);
  assert.deepEqual(workspace, original);
  const farms = G.farms(workspace); farms[0].plantKinds.pop();
  assert.equal(G.farms(workspace)[0].plantKinds.length, 6);
});

test('old harvested seeds and legacy project receipts become stock exactly once without a migration reward', () => {
  const workspace = ws(); harvest(workspace, 'old_task', 1);
  const legacy = [{ projectId: 'old_project', plantKind: 'apple', ticket: 0, maturedAt: 50, harvestedAt: 60 }];
  G.importLegacy(workspace, legacy);
  delete workspace.taskGarden.market;
  workspace.taskGarden.seeds.forEach(seed => { delete seed.farmId; });
  for (let i = 0; i < 3; i++) {
    assert.equal(row(workspace, 'sunflower').available, 1); assert.equal(row(workspace, 'apple').available, 1);
    assert.equal(G.importLegacy(workspace, legacy).imported, 0);
    workspace.taskGarden = G.validate(JSON.parse(JSON.stringify(workspace.taskGarden)));
  }
  assert.equal(G.economy(workspace).earned, 0);
  assert.equal(G.sell(workspace, 'apple', 1, 500).earned, 25);
  G.importLegacy(workspace, legacy);
  assert.equal(row(workspace, 'apple').available, 0); assert.equal(row(workspace, 'apple').harvested, 1);
  assert.equal(G.collection(workspace).find(p => p.plantKind === 'apple').shiny, 1);
  assert.ok(G.read(workspace).seeds.every(seed => seed.farmId === 'meadow'));
});

test('unharvested and destroyed plants cannot be sold; failures leave workspace bytes unchanged', () => {
  const workspace = ws(), growing = plant(workspace, 'growing', 1), mature = plant(workspace, 'mature', 1), destroyed = plant(workspace, 'destroyed', 1);
  complete(workspace, mature); destroyed.status = 'todo'; G.taskChanged(workspace, destroyed, 200);
  const before = JSON.stringify(workspace);
  for (const quantity of [0, -1, 1.5, '1', NaN, Infinity, 50001, Number.MAX_SAFE_INTEGER]) {
    assert.equal(G.sell(workspace, 'sunflower', quantity).reason, 'invalid-quantity');
  }
  assert.equal(G.sell(workspace, 'missing', 1).reason, 'unknown-plant');
  assert.equal(G.sell(workspace, 'sunflower', 1).reason, 'insufficient-stock');
  assert.equal(JSON.stringify(workspace), before);
  assert.equal(row(workspace, 'sunflower').available, 0); assert.equal(growing.status, 'doing');
});

test('quantity sales choose normal plants first, then oldest receipts, while rare companions and collection survive', () => {
  const workspace = ws();
  harvest(workspace, 'shiny_old', 2, 0, null, 100); harvest(workspace, 'rare_old', 2, 70, null, 110);
  harvest(workspace, 'normal_new', 2, 9000, null, 200); harvest(workspace, 'normal_old', 2, 100, null, 190);
  const collection = G.collection(workspace), seeds = clone(workspace.taskGarden.seeds);
  const sale = G.sell(workspace, 'lavender', 2, 500);
  assert.deepEqual(sale.taskIds, ['normal_old', 'normal_new']); assert.equal(sale.earned, 40); assert.equal(sale.balance, 40);
  assert.equal(row(workspace, 'lavender').normal, 0); assert.equal(row(workspace, 'lavender').rare, 1); assert.equal(row(workspace, 'lavender').shiny, 1);
  assert.equal(G.sell(workspace, 'lavender', 1, 510).taskIds[0], 'rare_old');
  assert.equal(G.sell(workspace, 'lavender', 1, 520).taskIds[0], 'shiny_old');
  assert.equal(G.sell(workspace, 'lavender', 1, 530).reason, 'insufficient-stock');
  assert.deepEqual(G.collection(workspace), collection); assert.deepEqual(workspace.taskGarden.seeds, seeds);
  assert.deepEqual(row(workspace, 'lavender'), { plantKind: 'lavender', farmId: 'meadow', unitPrice: 20, available: 0, harvested: 4, sold: 4, normal: 0, rare: 0, shiny: 0 });
});

test('a sale is all-or-nothing and reloading a sold task cannot generate additional stock or coins', () => {
  const workspace = ws(), task = harvest(workspace, 'single', 5);
  const before = JSON.stringify(workspace);
  assert.deepEqual(G.sell(workspace, 'cherry', 2, 300), { ok: false, reason: 'insufficient-stock', available: 1 });
  assert.equal(JSON.stringify(workspace), before);
  assert.equal(G.sell(workspace, 'cherry', 1, 300).earned, 28);
  const reloaded = S.validate(clone(workspace));
  const reloadedTask = reloaded.tasks.find(t => t.id === task.id);
  reloadedTask.status = 'todo'; G.taskChanged(reloaded, reloadedTask, 400);
  reloadedTask.status = 'doing'; G.taskChanged(reloaded, reloadedTask, 500);
  complete(reloaded, reloadedTask, 600); G.harvest(reloaded, reloadedTask.id, 700);
  assert.equal(G.sell(reloaded, 'cherry', 1, 800).ok, false);
  assert.equal(G.economy(reloaded).earned, 28); assert.equal(row(reloaded, 'cherry').harvested, 1);
});

test('farm purchase requires earned coins, is permanent and idempotent, and does not silently equip', () => {
  const empty = ws(), before = clone(empty);
  assert.equal(G.buyFarm(empty, 'cyber', 200).reason, 'insufficient-coins');
  assert.equal(G.buyFarm(empty, 'missing', 200).reason, 'unknown-farm');
  assert.equal(G.equipFarm(empty, 'cyber', 200).reason, 'not-owned');
  assert.equal(G.equipFarm(empty, 'missing', 200).reason, 'unknown-farm');
  assert.deepEqual(empty, before);
  assert.equal(G.buyFarm(empty, 'meadow', 200).alreadyOwned, true);
  assert.deepEqual(empty, before);
  const workspace = funded();
  assert.deepEqual(G.buyFarm(workspace, 'cyber', 400), { ok: true, changed: true, alreadyOwned: false, farmId: 'cyber', spent: 240, balance: 0 });
  assert.equal(G.economy(workspace).equippedFarmId, 'meadow');
  const purchased = clone(workspace);
  assert.deepEqual(G.buyFarm(workspace, 'cyber', 500), { ok: true, changed: false, alreadyOwned: true, farmId: 'cyber', spent: 0, balance: 0 });
  assert.deepEqual(workspace, purchased);
  assert.equal(G.buyFarm(S.validate(clone(workspace)), 'cyber', 600).spent, 0);
  assert.equal(G.farms(workspace)[1].owned, true);
});

test('equip is persistent, switching is free, and logical timestamps withstand a clock moving backwards', () => {
  const workspace = cyber(), before = clone(workspace);
  assert.deepEqual(G.equipFarm(workspace, 'cyber', 700), { ok: true, changed: false, farmId: 'cyber' });
  assert.deepEqual(workspace, before);
  assert.equal(G.equipFarm(workspace, 'meadow', 10).changed, true);
  assert.equal(workspace.taskGarden.market.equipped.updatedAt, 501);
  assert.equal(G.equipFarm(workspace, 'cyber', 11).changed, true);
  assert.equal(workspace.taskGarden.market.equipped.updatedAt, 502);
  assert.deepEqual(G.economy(S.validate(clone(workspace))), { balance: 0, earned: 240, spent: 240, equippedFarmId: 'cyber', ownedFarmIds: ['meadow', 'cyber'] });
});

test('new cyber seeds use only the selected farm pool with unchanged independent rarity draws', () => {
  const workspace = cyber();
  for (let i = 0; i < 3; i++) {
    for (const ticket of [0, 99, 100, 9999]) {
      const id = 'cyber_' + i + '_' + ticket, draws = [];
      const task = { id, title: id, status: 'doing', projectId: null, updatedAt: 600, createdAt: 600 };
      workspace.tasks.push(task);
      const seed = G.taskChanged(workspace, task, 600, limit => { draws.push(limit); return limit === 3 ? i : ticket; });
      assert.deepEqual(draws, [3, 10000]); assert.equal(seed.plantKind, G.KINDS[6 + i]); assert.equal(seed.farmId, 'cyber');
      assert.equal(seed.variant, G.variant(ticket));
    }
  }
  G.equipFarm(workspace, 'meadow', 700);
  const task = plant(workspace, 'meadow_again', 5, 0, null, 800);
  assert.equal(G.read(workspace).seeds.find(s => s.taskId === task.id).plantKind, 'cherry');
});

test('withdrawing and restarting after farm changes never rerolls species, rarity or original farm', () => {
  const workspace = funded(), old = plant(workspace, 'old', 3, 0, null, 310);
  G.buyFarm(workspace, 'cyber', 400); G.equipFarm(workspace, 'cyber', 500);
  const fresh = plant(workspace, 'fresh', 1, 77, null, 600);
  old.status = 'todo'; G.taskChanged(workspace, old, 700);
  old.status = 'doing'; G.taskChanged(workspace, old, 800, () => { throw new Error('must not draw'); });
  assert.deepEqual([G.active(workspace).find(s => s.taskId === 'old').plantKind, G.active(workspace).find(s => s.taskId === 'old').farmId], ['apple', 'meadow']);
  G.equipFarm(workspace, 'meadow', 900);
  fresh.status = 'todo'; G.taskChanged(workspace, fresh, 1000);
  fresh.status = 'doing'; G.taskChanged(workspace, fresh, 1100, () => { throw new Error('must not draw'); });
  const seed = G.active(workspace).find(s => s.taskId === 'fresh');
  assert.deepEqual([seed.plantKind, seed.farmId, seed.ticket, seed.variant], ['volt_berry', 'cyber', 77, 'rare']);
});

test('mixed project planets preserve farm identities, sold blossoms and unlocked companions after collection deletion', () => {
  const workspace = funded();
  workspace.projects.push({ id: 'project', name: 'A little world', color: '#abcdef', status: 'active', createdAt: 100 });
  const meadowTask = harvest(workspace, 'meadow_flower', 1, 0, 'project', 310);
  G.sell(workspace, 'sunflower', 1, 350);
  G.buyFarm(workspace, 'cyber', 400); G.equipFarm(workspace, 'cyber', 500);
  const cyberTask = plant(workspace, 'cyber_flower', 2, 45, 'project', 600); complete(workspace, cyberTask, 700);
  const archived = G.archiveProject(workspace, 'project', 800);
  assert.equal(archived.ok, true); assert.deepEqual(archived.planet.flowers.map(s => s.farmId), ['meadow', 'cyber']);
  assert.ok(archived.planet.flowers.some(s => s.taskId === meadowTask.id));
  const planet = clone(archived.planet), collection = G.collection(workspace);
  assert.equal(G.sell(workspace, 'crystal_tree', 1, 900).earned, 40);
  assert.deepEqual(G.read(workspace).planets[0], planet); assert.deepEqual(G.collection(workspace), collection);
  const money = G.economy(workspace), stock = G.inventory(workspace);
  M.deleteProject(workspace, 'project');
  assert.equal(G.read(workspace).planets.length, 0);
  assert.deepEqual(G.economy(workspace), money); assert.deepEqual(G.inventory(workspace), stock);
  assert.deepEqual(G.collection(workspace), collection);
});

test('overlapping multi-window sales credit each harvest receipt once during three-way sync', () => {
  const base = ws(); for (let i = 0; i < 4; i++) harvest(base, 'receipt_' + i, 1);
  const local = clone(base), remote = clone(base);
  G.sell(local, 'sunflower', 2, 400); G.sell(remote, 'sunflower', 3, 500);
  for (const pair of [[local, remote], [remote, local]]) {
    const merged = S.merge(base, ...pair).workspace;
    assert.equal(G.economy(merged).balance, 54); assert.equal(row(merged, 'sunflower').available, 1);
    assert.equal(merged.taskGarden.market.sales.length, 3);
    assert.deepEqual(G.collection(merged), G.collection(base));
    const reload = S.validate(clone(merged)); G.preserve(merged, reload);
    assert.equal(G.economy(reload).earned, 54);
  }
});

test('independent sales merge without losing either earning and older tabs cannot restore sold stock', () => {
  const base = ws(); harvest(base, 'a', 1); harvest(base, 'b', 3);
  const local = clone(base), remote = clone(base); G.sell(local, 'sunflower', 1, 300); G.sell(remote, 'apple', 1, 400);
  const merged = S.merge(base, local, remote).workspace;
  assert.equal(G.economy(merged).earned, 43); assert.equal(merged.taskGarden.market.sales.length, 2);
  for (const stale of [clone(base), Object.assign(clone(base), { taskGarden: undefined })]) {
    G.preserve(merged, stale); assert.equal(G.economy(stale).balance, 43); assert.equal(row(stale, 'apple').available, 0);
  }
});

test('simultaneous farm purchases charge once; accepted ownership and newer equipment survive old saves', () => {
  const base = funded(), local = clone(base), remote = clone(base);
  G.buyFarm(local, 'cyber', 400); G.equipFarm(local, 'cyber', 500);
  G.buyFarm(remote, 'cyber', 450); G.equipFarm(remote, 'cyber', 550); G.equipFarm(remote, 'meadow', 600);
  const merged = S.merge(base, local, remote).workspace;
  assert.equal(G.economy(merged).spent, 240); assert.equal(G.economy(merged).balance, 0);
  assert.equal(G.economy(merged).equippedFarmId, 'meadow'); assert.equal(merged.taskGarden.market.purchases.length, 1);
  G.preserve(merged, local);
  assert.equal(G.economy(local).equippedFarmId, 'meadow'); assert.equal(G.economy(local).spent, 240);
  const absent = clone(base); delete absent.taskGarden.market; G.preserve(merged, absent);
  assert.equal(G.farms(absent)[1].owned, true); assert.equal(G.economy(absent).balance, 0);
});

test('tampered coin totals and prices cannot mint money, and malformed receipts are rejected before persistence', () => {
  const workspace = funded(), raw = clone(workspace.taskGarden);
  raw.market.balance = 999999; raw.market.earned = 999999; raw.market.sales[0].unitPrice = 999999;
  assert.equal(G.economy({ taskGarden: G.validate(raw) }).balance, 240);
  const invalid = [
    g => g.market.sales.push(clone(g.market.sales[0])),
    g => g.market.sales[0].taskId = 'not_harvested',
    g => g.market.sales[0].soldAt = 1,
    g => g.market.purchases.push({ farmId: 'meadow', purchasedAt: 400 }),
    g => g.market.purchases.push({ farmId: 'missing', purchasedAt: 400 }),
    g => g.market.purchases.push({ farmId: 'cyber', purchasedAt: 0 }),
    g => g.market.purchases.push({ farmId: 'cyber', purchasedAt: 400 }, { farmId: 'cyber', purchasedAt: 500 }),
    g => g.market.equipped = { farmId: 'cyber', updatedAt: 400 },
    g => g.market.equipped.updatedAt = -1,
    g => g.market.version = 2,
    g => g.market.sales = null,
    g => g.market = null,
    g => g.seeds[0].farmId = 'cyber'
  ];
  for (const mutate of invalid) { const bad = clone(workspace.taskGarden); mutate(bad); assert.throws(() => G.validate(bad), /Invalid task garden/); }
  const unfunded = G.empty(); unfunded.market.purchases.push({ farmId: 'cyber', purchasedAt: 400 });
  assert.throws(() => G.validate(unfunded), /Invalid task garden/);
  const unharvested = ws(); plant(unharvested, 'fresh');
  unharvested.taskGarden.market.sales.push({ taskId: 'fresh', soldAt: 400 });
  assert.throws(() => G.validate(unharvested.taskGarden), /Invalid task garden/);
});

test('authoritative seed identities reject a purchase funded by a concurrent reroll instead of overdrawing', () => {
  const accepted = ws(); for (let i = 0; i < 8; i++) harvest(accepted, 't_' + i, 0);
  const incoming = clone(accepted);
  incoming.taskGarden.seeds.forEach(seed => { seed.plantKind = 'peach'; });
  assert.equal(G.sell(incoming, 'peach', 8, 300).earned, 240); assert.equal(G.buyFarm(incoming, 'cyber', 400).ok, true);
  G.equipFarm(incoming, 'cyber', 500);
  assert.throws(() => G.preserve(accepted, incoming), error => error.code === 'workspace-stale');
  assert.equal(G.economy(accepted).balance, 0);
  const reconciled = S.merge(accepted, incoming, accepted).workspace;
  assert.equal(G.economy(reconciled).balance, 96); assert.equal(G.economy(reconciled).spent, 0);
  assert.equal(G.economy(reconciled).equippedFarmId, 'meadow'); assert.equal(G.farms(reconciled)[1].owned, false);
  assert.ok(reconciled.taskGarden.seeds.every(seed => seed.plantKind === 'wildflower'));
});
