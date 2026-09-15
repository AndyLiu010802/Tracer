'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../skins/db-console/equip.js');
const M = require('../skins/db-console/mining.js');

test('30 件装备，5 槽各 6 档', () => {
  assert.strictEqual(E.EQUIP_KEYS.length, 30);
  E.SLOTS.forEach((sl) => {
    const inSlot = E.EQUIP_KEYS.filter((k) => E.EQUIP[k].slot === sl);
    assert.strictEqual(inSlot.length, 6, sl + ' 应 6 件');
    const tiers = inSlot.map((k) => E.EQUIP[k].tier).sort();
    assert.deepStrictEqual(tiers, [1, 2, 3, 4, 5, 6]);
  });
});
test('字段合法', () => {
  E.EQUIP_KEYS.forEach((k) => {
    const e = E.EQUIP[k];
    assert.ok(e.name && e.job, k + ' 缺名/黑话');
    assert.ok(E.SLOT_META[e.slot], k + ' slot 非法');
    assert.ok(E.TIER_SCALE[e.tier], k + ' tier 非法');
  });
});
test('role→slot 映射齐全', () => {
  ['normal','swift','brute','caster','boss'].forEach((r) => assert.ok(E.ROLE_SLOT[r]));
});

test('equipStats：槽×档派生 + 升级放大 + 只含非零', () => {
  const s1 = E.equipStats('wpn1', 0);   // weapon T1: atk6 crit2
  assert.strictEqual(s1.atk, 6);
  assert.strictEqual(s1.crit, 2);
  assert.ok(!('def' in s1), '不含零项');
  const s1u = E.equipStats('wpn1', 2);  // ×(1+0.15*2)=1.3 → atk round(7.8)=8
  assert.strictEqual(s1u.atk, Math.round(6 * 1.3));
  const w3 = E.equipStats('wpn3', 0);   // T3 scale 4 → atk 24
  assert.strictEqual(w3.atk, 24);
});
test('equipBonus：多槽求和，空槽跳过', () => {
  const eq = { weapon: { key: 'wpn1', level: 0 }, armor: { key: 'arm1', level: 0 }, accessory: null, shoes: null, special: null };
  const b = E.equipBonus(eq);
  assert.strictEqual(b.atk, 6);            // 来自武器
  assert.strictEqual(b.def, 5);            // 来自防具
  assert.strictEqual(b.hp, 30);
  assert.deepStrictEqual(E.equipBonus(null), {});
});

test('dropForMonster：role→slot、tier 对齐', () => {
  assert.strictEqual(E.dropForMonster('swift', 2), E.BY_SLOT_TIER.shoes[2]); // 迅捷掉鞋
  assert.strictEqual(E.dropForMonster('brute', 3), E.BY_SLOT_TIER.armor[3]); // 蛮力掉甲
  assert.strictEqual(E.dropForMonster('boss', 6), E.BY_SLOT_TIER.special[6]);
  assert.strictEqual(E.dropForMonster('nope', 1), null);
});
test('rollEquipDrop：boss 掉率更高，rng 决定命中', () => {
  assert.strictEqual(E.rollEquipDrop('normal', 1, 0, () => 0.99), null);  // 未命中
  assert.strictEqual(E.rollEquipDrop('normal', 1, 0, () => 0), E.BY_SLOT_TIER.weapon[1]); // 命中
  assert.ok(E.rollEquipDrop('boss', 1, 0, () => 0.2), 'boss 25% > 0.2 命中');
  assert.strictEqual(E.rollEquipDrop('normal', 1, 0, () => 0.2), null, '小怪 5% < 0.2 不中');
});

test('recipe：按档派生材料/锭/金币/等级', () => {
  const r = E.recipe('wpn1'); // T1
  assert.ok(r.mats.page_scrap > 0);
  assert.strictEqual(r.bars[E.TIER_BAR[1]], 2, 'T1 需 1+tier = 2 锭');
  assert.strictEqual(r.level, 1);
  const r6 = E.recipe('wpn6');
  assert.ok(r6.coins > r.coins);
  assert.strictEqual(r6.bars[E.TIER_BAR[6]], 7, 'T6 需 7 锭');
  assert.ok(!('ore' in r), 'ore 字段已废弃');
});
test('recipeCheck：锭不够则锁，锭够则可锻', () => {
  const noBars = { coins: 1e9, mats: { page_scrap: 999 }, bars: {} };
  const c = E.recipeCheck('wpn1', noBars, 99);
  assert.strictEqual(c.barsOk, false);
  assert.strictEqual(c.ok, false);
  assert.strictEqual(c.matsOk, true);   // 材料/金币/等级都够，只差锭
  assert.strictEqual(c.coinsOk, true);
  assert.strictEqual(c.levelOk, true);

  const rich = { coins: 1e9, mats: { page_scrap: 999 }, bars: { heap_bar: 2 } };
  const c2 = E.recipeCheck('wpn1', rich, 99);
  assert.strictEqual(c2.barsOk, true);
  assert.strictEqual(c2.ok, true, '锭补齐后锻造解锁');

  const lowLevel = E.recipeCheck('wpn6', { coins: 1e9, mats: { txn_soul: 999 }, bars: { void_bar: 99 } }, 1);
  assert.strictEqual(lowLevel.levelOk, false);
  assert.strictEqual(lowLevel.ok, false);
});

test('TIER_BAR 的 6 个 key 与 Mining.BARS 完全一致', () => {
  for (let t = 1; t <= 6; t++) {
    const bk = E.TIER_BAR[t];
    assert.ok(M.BARS[bk], 'T' + t + ' 的锭 ' + bk + ' 不在 Mining.BARS 里');
    assert.strictEqual(M.BARS[bk].tier, t, bk + ' 档位错位');
  }
  assert.strictEqual(Object.keys(E.TIER_BAR).length, M.BAR_KEYS.length);
});

test('migrateEquip 补默认、不丢旧数据', () => {
  const s = { coins: 5 };
  E.migrateEquip(s);
  assert.deepStrictEqual(Object.keys(s.equipped).sort(), E.SLOTS.slice().sort());
  E.SLOTS.forEach((sl) => assert.strictEqual(s.equipped[sl], null));
  assert.deepStrictEqual(s.owned, []);
  assert.strictEqual(s.coins, 5);
  const s2 = { equipped: { weapon: { key: 'wpn1', level: 0 } }, owned: [{ key: 'arm1', level: 0 }] };
  E.migrateEquip(s2);
  assert.strictEqual(s2.equipped.weapon.key, 'wpn1');   // 不覆盖
  assert.strictEqual(s2.equipped.armor, null);          // 补缺槽
  assert.strictEqual(s2.owned.length, 1);
});
