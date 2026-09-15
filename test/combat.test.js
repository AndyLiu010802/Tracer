'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('../skins/db-console/combat.js');
const E = require('../skins/db-console/equip.js');

test('36 只怪，6 档各 6 只（含每档 1 boss）', () => {
  assert.strictEqual(C.MON_KEYS.length, 36);
  for (let t = 1; t <= 6; t++) {
    const inTier = C.MON_KEYS.filter((k) => C.MONSTERS[k].tier === t);
    assert.strictEqual(inTier.length, 6, '档 ' + t + ' 应 6 只');
    const bosses = inTier.filter((k) => C.MONSTERS[k].role === 'boss');
    assert.strictEqual(bosses.length, 1, '档 ' + t + ' 应恰 1 boss');
  }
});

test('每只怪字段合法', () => {
  C.MON_KEYS.forEach((k) => {
    const m = C.MONSTERS[k];
    assert.ok(m.name && m.job, k + ' 缺名/黑话');
    assert.ok(C.TIER_BASE[m.tier], k + ' tier 非法');
    assert.ok(C.ROLE_MULT[m.role], k + ' role 非法');
    assert.ok(C.MATERIALS[m.mat], k + ' mat 非法');
  });
});

test('常量表齐全', () => {
  assert.ok(C.DEFAULT_WEAPON && C.DEFAULT_WEAPON.atk > 0);
  [1,2,3,4,5,6].forEach((t) => { assert.ok(C.DROP_XP[t] > 0 && C.DROP_COIN[t] > 0); });
  assert.ok(C.BATTLE_TICK_MS > 0 && C.OFFLINE_CAP > 0);
});

test('playerStats 随等级增长、含默认武器加成', () => {
  const s1 = C.playerStats(1, C.DEFAULT_WEAPON);
  const s9 = C.playerStats(9, C.DEFAULT_WEAPON);
  assert.ok(s9.hp > s1.hp && s9.atk > s1.atk && s9.def > s1.def);
  assert.strictEqual(s1.atk, 10 + Math.round(1 * 3.2) + 6);
  assert.ok(s1.crit <= 60 && s1.eva <= 50);
});
test('monsterStats 由 tier×role 派生', () => {
  const boss = C.monsterStats('lock_lord');
  const mob = C.monsterStats('dead_tuple');
  assert.ok(boss.hp > mob.hp * 3, 'boss 血远超小怪');
  assert.strictEqual(boss.boss, true);
  assert.strictEqual(mob.boss, false);
  const swift = C.monsterStats('deadlock');
  assert.ok(swift.agi > mob.agi, 'swift 更敏捷');
});
test('monsterUnlocked 看等级门槛', () => {
  assert.strictEqual(C.monsterUnlocked('dead_tuple', 1), true);
  assert.strictEqual(C.monsterUnlocked('repl_lag', 5), false);
  assert.strictEqual(C.monsterUnlocked('repl_lag', 10), true);
});

test('attack：伤害=max(0,atk-def)，暴击×1.75，闪避为 0', () => {
  const A = { atk: 30, crit: 0, luk: 0 };
  const D = { def: 10, eva: 0 };
  let r = C.attack(A, D, () => 0.99);
  assert.deepStrictEqual([r.dmg, r.crit, r.dodged], [20, false, false]);
  r = C.attack({ atk: 30, crit: 100, luk: 0 }, D, () => 0);
  assert.strictEqual(r.crit, true);
  assert.strictEqual(r.dmg, Math.round(20 * 1.75));
  r = C.attack(A, { def: 10, eva: 100 }, () => 0);
  assert.deepStrictEqual([r.dmg, r.dodged], [0, true]);
  assert.strictEqual(C.attack({ atk: 5, crit: 0 }, { def: 99, eva: 0 }, () => 0.99).dmg, 0);
});

test('resolveRound：敏捷高者先手，双方各一击', () => {
  const p = { atk: 100, def: 50, agi: 20, crit: 0, eva: 0, luk: 0 };
  const m = { atk: 10, def: 5, agi: 5, crit: 0, eva: 0, luk: 0 };
  const r = C.resolveRound(p, 200, m, 30, () => 0.99);
  assert.strictEqual(r.log[0].who, 'p', '玩家敏捷高先手');
  assert.strictEqual(r.monDead, true);
  assert.strictEqual(r.playerHp, 200);
});
test('resolveRound：碾压时玩家 0 伤害（安全刷）', () => {
  const p = { atk: 100, def: 999, agi: 20, crit: 0, eva: 0, luk: 0 };
  const m = { atk: 10, def: 5, agi: 5, crit: 0, eva: 0, luk: 0 };
  const r = C.resolveRound(p, 200, m, 1000, () => 0.99);
  assert.strictEqual(r.playerHp, 200);
});

test('rollDrops：XP/金币按档，boss 更多且掉 core 类', () => {
  const mob = C.rollDrops('dead_tuple', 0, () => 0);
  assert.strictEqual(mob.xp, C.DROP_XP[1]);
  assert.strictEqual(mob.mats.entropy_dust, 1);
  const boss = C.rollDrops('lock_lord', 0, () => 0);
  assert.strictEqual(boss.xp, C.DROP_XP[1] * 5);
  assert.ok(boss.coins > mob.coins);
  assert.ok(boss.mats.txn_soul >= 1);
});
test('rollDrops：低幸运可能不掉材料', () => {
  const r = C.rollDrops('dead_tuple', 0, () => 0.99);
  assert.ok(!r.mats.entropy_dust);
});

test('settleOffline：安全怪跑满不死并累计击杀', () => {
  const battle = { mob: 'dead_tuple', hp: 9999, last: 0 };
  const r = C.settleOffline(battle, 40, C.DEFAULT_WEAPON, C.BATTLE_TICK_MS * 50, () => 0.5);
  assert.ok(r.kills > 0);
  assert.strictEqual(r.dead, false);
  assert.ok(r.xp > 0 && r.hp > 0);
  assert.strictEqual(r.last, C.BATTLE_TICK_MS * 50);
});
test('settleOffline：危险怪打到战死即停', () => {
  const battle = { mob: 'xid_wraparound', hp: 30, last: 0 };
  const r = C.settleOffline(battle, 1, C.DEFAULT_WEAPON, C.BATTLE_TICK_MS * 5000, () => 0.5);
  assert.strictEqual(r.dead, true);
  assert.strictEqual(r.hp, 0);
});
test('settleOffline：回合数受 OFFLINE_CAP 约束', () => {
  const battle = { mob: 'dead_tuple', hp: 999999, last: 0 };
  const huge = C.BATTLE_TICK_MS * (C.OFFLINE_CAP + 10000);
  const r = C.settleOffline(battle, 60, C.DEFAULT_WEAPON, huge, () => 0.5);
  assert.ok(r.kills <= C.OFFLINE_CAP);
});

test('migrateCombat 补默认、不丢旧数据', () => {
  const s = { coins: 100 };
  C.migrateCombat(s);
  assert.deepStrictEqual(s.mats, {});
  assert.strictEqual(s.battle, null);
  assert.deepStrictEqual(s.mobDex, {});
  assert.strictEqual(s.coins, 100);
  const s2 = { mats: { page_scrap: 3 }, battle: { mob: 'deadlock', hp: 5, last: 1 }, mobDex: { deadlock: 2 } };
  C.migrateCombat(s2);
  assert.strictEqual(s2.mats.page_scrap, 3);
  assert.strictEqual(s2.battle.mob, 'deadlock');
});

test('未知 mob key 不崩：rollDrops/settleOffline 优雅返回', () => {
  assert.deepStrictEqual(C.rollDrops('__nope__', 0, () => 0), { xp: 0, coins: 0, mats: {} });
  const s = C.settleOffline({ mob: '__nope__', hp: 50, last: 0 }, 5, C.DEFAULT_WEAPON, 1e9, () => 0.5);
  assert.strictEqual(s.dead, false);
  assert.strictEqual(s.kills, 0);
  assert.strictEqual(s.hp, 50);
});

test('settleOffline 返回当前 monHp', () => {
  // 安全怪(高等级碾压)：一路刷，返回的 monHp 是最后一只的当前血（0<monHp<=满血）
  const r = C.settleOffline({ mob: 'dead_tuple', hp: 99999, last: 0 }, 40, C.DEFAULT_WEAPON, C.BATTLE_TICK_MS * 3, () => 0.5);
  assert.ok(typeof r.monHp === 'number');
});

test('playerStats 吃属性加成对象（装备）', () => {
  const base = C.playerStats(1, {});
  const withGear = C.playerStats(1, { atk: 10, def: 5, hp: 100, crit: 3 });
  assert.strictEqual(withGear.atk, base.atk + 10);
  assert.strictEqual(withGear.def, base.def + 5);
  assert.strictEqual(withGear.hp, base.hp + 100);
  assert.strictEqual(withGear.crit, Math.min(60, base.crit + 3));
  // 兼容：DEFAULT_WEAPON 作为加成仍加 atk 6
  assert.strictEqual(C.playerStats(1, C.DEFAULT_WEAPON).atk, base.atk + 6);
});

test('migrateCombat 给旧的进行中战斗补 drops 堆、不覆盖已有', () => {
  const s = { battle: { mob: 'deadlock', hp: 5, last: 1 } };
  C.migrateCombat(s);
  assert.deepStrictEqual(s.battle.drops, { xp: 0, coins: 0, mats: {} });
  const s2 = { battle: { mob: 'deadlock', hp: 5, last: 1, drops: { xp: 7, coins: 0, mats: {} } } };
  C.migrateCombat(s2);
  assert.strictEqual(s2.battle.drops.xp, 7);
});

// ---- 魔法分支（magic spec）：以上旧用例一字不改，以下全部是追加 ------------------

test('ROLE_MULT 每行有 mdef；monsterStats 派生 mdef = round(TIER_BASE.def × mdef 倍率)，抽查 T6 brute 29 / caster 93 / boss 70', () => {
  Object.keys(C.ROLE_MULT).forEach((r) => assert.ok(typeof C.ROLE_MULT[r].mdef === 'number', r + ' 缺 mdef 倍率'));
  assert.deepStrictEqual(
    { normal: C.ROLE_MULT.normal.mdef, swift: C.ROLE_MULT.swift.mdef, brute: C.ROLE_MULT.brute.mdef, caster: C.ROLE_MULT.caster.mdef, boss: C.ROLE_MULT.boss.mdef },
    { normal: 1.0, swift: 0.8, brute: 0.5, caster: 1.6, boss: 1.2 });
  assert.strictEqual(C.monsterStats('page_corruption').mdef, 29);   // T6 brute
  assert.strictEqual(C.monsterStats('silent_dataloss').mdef, 93);   // T6 caster
  assert.strictEqual(C.monsterStats('xid_wraparound').mdef, 70);    // T6 boss
  assert.strictEqual(C.monsterStats('storage_void').mdef, 58);      // T6 normal
  assert.strictEqual(C.monsterStats('dead_tuple').mdef, 3);         // T1 normal
  C.MON_KEYS.forEach((k) => {
    const st = C.monsterStats(k), m = C.MONSTERS[k];
    assert.strictEqual(st.mdef, Math.round(C.TIER_BASE[m.tier].def * C.ROLE_MULT[m.role].mdef), k + ' mdef 派生错');
  });
});

test('只有 caster 带 castPower: 0 与 matk（= 现有 atk 列，不加新倍率），其他角色不带', () => {
  C.MON_KEYS.forEach((k) => {
    const st = C.monsterStats(k), isCaster = C.MONSTERS[k].role === 'caster';
    assert.strictEqual('castPower' in st, isCaster, k + (isCaster ? ' 应带 castPower' : ' 不应带 castPower'));
    assert.strictEqual('matk' in st, isCaster, k + (isCaster ? ' 应带 matk' : ' 不应带 matk'));
    if (isCaster) { assert.strictEqual(st.castPower, 0); assert.strictEqual(st.matk, st.atk); }
  });
  assert.strictEqual(C.monsterStats('silent_dataloss').matk, 130, 'T6 caster 魔攻 round(118×1.1)');
  assert.strictEqual(C.monsterStats('slow_query').matk, 9, 'T1 caster 魔攻 round(8×1.1)');
});

test('attack 魔法路径：castPower != null → matk + castPower − mdef，忽略 def，下限 0，返回 magic:true；闪避/暴击两路共用', () => {
  const r = C.attack({ matk: 20, castPower: 5, crit: 0, luk: 0 }, { mdef: 10, def: 999, eva: 0 }, () => 0.99);
  assert.deepStrictEqual([r.dmg, r.crit, r.dodged, r.magic], [15, false, false, true]);
  assert.strictEqual(C.attack({ matk: 20, castPower: 5 }, { def: 999, mdef: 0, eva: 0 }, () => 0.99).dmg, 25, 'def 999 挡不住法术');
  assert.strictEqual(C.attack({ matk: 1, castPower: 0 }, { mdef: 99, eva: 0 }, () => 0.99).dmg, 0, 'max(0,…) 下限');
  assert.strictEqual(C.attack({ atk: 999, matk: 0, castPower: 0 }, { mdef: 5, def: 0, eva: 0 }, () => 0.99).dmg, 0, '走魔法路径时 atk 不参与');
  const dodged = C.attack({ matk: 20, castPower: 5 }, { mdef: 0, eva: 100 }, () => 0);
  assert.deepStrictEqual([dodged.dmg, dodged.dodged, dodged.magic], [0, true, true], '闪避也标 magic——符文已经扔出去了');
  const crit = C.attack({ matk: 20, castPower: 5, crit: 100, luk: 0 }, { mdef: 10, eva: 0 }, () => 0);
  assert.deepStrictEqual([crit.dmg, crit.crit], [Math.round(15 * 1.75), true], '暴击两路共用 ×1.75');
});

test('attack 无 castPower 时与旧结果逐位相同，只多 magic:false；matk 不参与', () => {
  const A = { atk: 30, crit: 0, luk: 0 }, D = { def: 10, eva: 0 };
  assert.deepStrictEqual(C.attack(A, D, () => 0.99), { dmg: 20, crit: false, dodged: false, magic: false });
  assert.deepStrictEqual(C.attack({ atk: 30, crit: 100, luk: 0 }, D, () => 0), { dmg: 35, crit: true, dodged: false, magic: false });
  assert.deepStrictEqual(C.attack(A, { def: 10, eva: 100 }, () => 0), { dmg: 0, crit: false, dodged: true, magic: false });
  assert.strictEqual(C.attack({ atk: 30, matk: 999, crit: 0 }, D, () => 0.99).dmg, 20, '没设 castPower 时 matk 不参与');
});

test('resolveRound：log 条目透传 magic；玩家带 castPower 时打怪 mdef，怪没带则物理', () => {
  const p = { matk: 50, castPower: 10, atk: 1, def: 50, agi: 20, crit: 0, eva: 0, luk: 0 };
  const m = { atk: 10, def: 999, mdef: 5, agi: 5, crit: 0, eva: 0, luk: 0 };
  const r = C.resolveRound(p, 200, m, 100, () => 0.99);
  assert.deepStrictEqual([r.log[0].who, r.log[0].magic, r.log[0].dmg], ['p', true, 55], '50 + 10 − 5');
  assert.deepStrictEqual([r.log[1].who, r.log[1].magic, r.log[1].dmg], ['m', false, 0], '怪没带 castPower，物理 10 − 50 → 0');
  assert.strictEqual(r.monHp, 45);
});

test('caster 怪用魔攻打玩家的 mdef：def 999 / mdef 0 的玩家被打满伤，normal 怪打不动；同档全套 mdef 抵消 caster 魔攻', () => {
  const tank = { atk: 1, def: 999, mdef: 0, agi: 0, crit: 0, eva: 0, luk: 0 };
  const caster = C.monsterStats('slow_query');   // T1 caster：matk 9, castPower 0
  const r1 = C.resolveRound(tank, 500, caster, 999, () => 0.99);
  const hitByCaster = r1.log.find((l) => l.who === 'm');
  assert.deepStrictEqual([hitByCaster.magic, hitByCaster.dmg], [true, 9], 'caster 魔攻 9 − 玩家 mdef 0');
  const normal = C.monsterStats('dead_tuple');   // T1 normal：atk 8
  const r2 = C.resolveRound(tank, 500, normal, 999, () => 0.99);
  const hitByNormal = r2.log.find((l) => l.who === 'm');
  assert.deepStrictEqual([hitByNormal.magic, hitByNormal.dmg], [false, 0], '物理 8 − def 999 → 0');
  // spec 三.3：同档全套（arm1 + acc1）mdef 11 ≥ T1 caster 魔攻 9 → 0 伤
  const full = C.playerStats(1, E.equipBonus({ armor: { key: 'arm1', level: 0 }, accessory: { key: 'acc1', level: 0 } }));
  assert.strictEqual(full.mdef, 11);
  assert.strictEqual(C.attack(caster, full, () => 0.99).dmg, 0);
  assert.strictEqual(C.attack(caster, C.playerStats(1, {}), () => 0.99).dmg, 3, '裸装 mdef 6 → 受伤 3');
});

test('三角断言：Lv31 全套 T6（atk 237 / matk 154 / power 83）对 T6 各角色——brute/boss 魔法 > 物理，caster 物理 > 魔法，normal/swift 相等', () => {
  const ps = C.playerStats(31, E.equipBonus({
    weapon: { key: 'wpn6', level: 0 }, armor: { key: 'arm6', level: 0 }, accessory: { key: 'acc6', level: 0 },
    shoes: { key: 'shoe6', level: 0 }, special: { key: 'spc6', level: 0 } }));
  assert.strictEqual(ps.atk, 237); assert.strictEqual(ps.matk, 154);
  const magicPs = Object.assign({}, ps, { castPower: 83 });
  const flat = () => 0.99;   // 不闪避、不暴击
  const dmg = (attacker, mobKey) => C.attack(attacker, C.monsterStats(mobKey), flat).dmg;
  assert.deepStrictEqual([dmg(ps, 'storage_void'), dmg(magicPs, 'storage_void')], [179, 179], 'normal def 58 / mdef 58');
  assert.deepStrictEqual([dmg(ps, 'clock_skew'), dmg(magicPs, 'clock_skew')], [191, 191], 'swift def 46 / mdef 46');
  assert.deepStrictEqual([dmg(ps, 'page_corruption'), dmg(magicPs, 'page_corruption')], [167, 208], 'brute def 70 / mdef 29：法术 +25%');
  assert.deepStrictEqual([dmg(ps, 'silent_dataloss'), dmg(magicPs, 'silent_dataloss')], [185, 144], 'caster def 52 / mdef 93：法术 −22%');
  assert.deepStrictEqual([dmg(ps, 'xid_wraparound'), dmg(magicPs, 'xid_wraparound')], [150, 167], 'boss def 87 / mdef 70：法术 +11%');
});

test('settleOffline cast：符文预算内走魔法、烧完退回普攻；返回 runes = 实际扣掉数、casts = 施法次数', () => {
  // Lv1 裸装（atk 13）打 T6 brute page_corruption（def 70 / mdef 29 / hp 1760）：物理 0 伤，魔法 power 1000 → 979/击。
  // battle.hp 给 1e9 保证不死；rng 恒 0.5：不闪避、不暴击；保留率 0 时每次出手必烧符。怪先手（agi 18 > 7），每回合双方各出手一次。
  const rng = () => 0.5;
  const mk = () => ({ mob: 'page_corruption', hp: 1e9, last: 0 });
  const now = C.BATTLE_TICK_MS * 10;
  const three = C.settleOffline(mk(), 1, {}, now, rng, { power: 1000, runes: 3, preserve: 0 });
  assert.strictEqual(three.runes, 3, '预算 3 枚全烧掉');
  assert.strictEqual(three.casts, 3, '前 3 回合各施法一次，第 4 回合起预算为 0 退回普攻、不再计施法');
  assert.strictEqual(three.kills, 1, '第 1 击 781、第 2 击击杀、第 3 击 781，之后物理 0 伤');
  assert.strictEqual(three.monHp, 1760 - 979, '预算用尽后怪血不再变');
  const many = C.settleOffline(mk(), 1, {}, now, rng, { power: 1000, runes: 999, preserve: 0 });
  assert.strictEqual(many.runes, 10, '10 回合 10 次出手全烧');
  assert.strictEqual(many.casts, 10, '保留率 0 时施法次数 = 烧掉数');
  assert.strictEqual(many.kills, 5, '979 × 10 = 9790 → 5 杀');
  const none = C.settleOffline(mk(), 1, {}, now, rng, null);
  assert.deepStrictEqual([none.runes, none.casts], [0, 0]);
  assert.strictEqual(none.kills, 0, '不施法 → 物理 13 − 70 → 0 伤');
  const bad = C.settleOffline({ mob: '__nope__', hp: 50, last: 0 }, 5, {}, 1e9, rng, { power: 1, runes: 9, preserve: 0 });
  assert.deepStrictEqual([bad.runes, bad.casts], [0, 0], '坏 mob 优雅返回也带 runes: 0 / casts: 0');
});

test('settleOffline cast：preserve 1 → 全程魔法、casts 10 但 runes 0；cast=null 与不传第 6 参结果相同（同 rng 种子，不多消耗 rng）', () => {
  const rng = () => 0.5;
  const now = C.BATTLE_TICK_MS * 10;
  const keep = C.settleOffline({ mob: 'page_corruption', hp: 1e9, last: 0 }, 1, {}, now, rng, { power: 1000, runes: 1, preserve: 1 });
  assert.strictEqual(keep.runes, 0, '保留率 1：每次都保留，一枚都不扣');
  assert.strictEqual(keep.casts, 10, '保留不影响施法计数：10 回合 10 次施法');
  assert.strictEqual(keep.kills, 5, '预算永不耗尽，10 击全魔法');
  const lcg = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const a = C.settleOffline({ mob: 'dead_tuple', hp: 9999, last: 0 }, 40, C.DEFAULT_WEAPON, C.BATTLE_TICK_MS * 50, lcg(7));
  const b = C.settleOffline({ mob: 'dead_tuple', hp: 9999, last: 0 }, 40, C.DEFAULT_WEAPON, C.BATTLE_TICK_MS * 50, lcg(7), null);
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual([a.runes, a.casts], [0, 0], '不施法时 runes / casts 恒 0');
  assert.ok(a.kills > 0);
});

test('settleOffline cast：保留率部分生效时 casts（施法次数）> runes（实际烧掉）——两个口径必须分开返回', () => {
  // rng 在 0.1 / 0.5 之间交替。两个值都不触发闪避（怪 eva 3、L1 玩家 eva 3.18）与暴击（怪 crit 4、L1 玩家 crit 5.25），
  // 只有保留掷骰受影响：0.1 < preserve 0.4 → 保留，0.5 >= 0.4 → 烧掉。
  // 每回合 rng 恰被调用 5 次（怪先手：怪 eva/crit、玩家 eva/crit、保留掷骰），击杀回合 rollDrops 再调 2 次（coins + 1 个 mats 掷骰），
  // 奇偶性不变，所以保留掷骰逐回合交替落在 0.1 / 0.5 上：10 回合 → 施法 10 次、保留 5 次、烧 5 枚。
  // 这条用例存在的意义：用 rng 恒 0.5 + 低保留率的用例里 casts === runes 恒成立，测不出「离线按 bo.runes 计施法次数」这种口径错。
  let i = 0;
  const alt = () => (i++ % 2 === 0 ? 0.1 : 0.5);
  const now = C.BATTLE_TICK_MS * 10;
  const r = C.settleOffline({ mob: 'page_corruption', hp: 1e9, last: 0 }, 1, {}, now, alt, { power: 1000, runes: 99, preserve: 0.4 });
  assert.strictEqual(r.casts, 10, '10 回合每回合出手一次，全部是魔法');
  assert.strictEqual(r.runes, 5, '保留 5 次、烧 5 枚');
  assert.ok(r.casts > r.runes, '有保留发生时施法次数必须大于烧掉的符文数');
  assert.strictEqual(r.kills, 5, '979 × 10 → 5 杀，保留与否不影响伤害');
});

test('settleOffline 从存档里的 monHp 续打，不从满血重来（玩家在别的 tab 时 render 每秒结算一次，满血重来会让后台永远打不死怪）', () => {
  const now = 1000000;
  const mk = (monHp, agoMs) => ({ mob: 'dead_tuple', hp: 82, monHp: monHp, kills: 0, log: [], last: now - agoMs, drops: { xp: 0, coins: 0, mats: {} } });
  const full = C.monsterStats('dead_tuple').hp;
  // 0 回合：怪血原样返回，不能悄悄变满血
  const zero = C.settleOffline(mk(4, 0), 1, {}, now, () => 0.5);
  assert.strictEqual(zero.monHp, 4, '0 回合应原样返回存档怪血');
  // 1 回合（400ms）：怪血 4、Lv1 普攻 10 → 这一回合就击杀，怪血回满等下一只
  const one = C.settleOffline(mk(4, C.BATTLE_TICK_MS), 1, {}, now, () => 0.5);
  assert.strictEqual(one.kills, 1, '续打 4 血的怪一回合就该击杀');
  assert.strictEqual(one.monHp, full, '击杀后下一只满血');
  // 老存档缺 monHp / 损坏 → 从满血起，不出 NaN
  const bad = C.settleOffline(mk(undefined, 0), 1, {}, now, () => 0.5);
  assert.strictEqual(bad.monHp, full, '缺 monHp 应从满血起');
  const nan = C.settleOffline(mk(NaN, 0), 1, {}, now, () => 0.5);
  assert.strictEqual(nan.monHp, full, 'NaN monHp 应从满血起');
});
