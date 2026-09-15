# 锻造·装备 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 加装备系统（5 槽、属性进战斗、可升级）、怪物按特性掉装、锻造脚手架（矿石留空待开采）。以 Melvor Idle 为标杆。

**Architecture:** 装备纯数据+逻辑放进可单测 UMD 模块 `skins/db-console/equip.js`（仿 fishing/combat）；combat.js 只改 `playerStats` 吃「属性加成对象」；farm.js 做穿戴汇总、怪掉装、角色面板、锻造 UI。不碰钓鱼/farm-data.js。

**Tech Stack:** 原生 JS、`node --test`、无构建。webp 服务/缓存已就绪。

配套 spec：`docs/superpowers/specs/2026-09-03-forge-equipment-design.md`；出图：`docs/.../2026-09-03-equipment-art-prompts.md`。

---

## 文件结构
- **新建** `skins/db-console/equip.js` — 数据（SLOTS/SLOT_META/SLOT_BASE/TIER_SCALE/EQUIP/EQUIP_KEYS/ROLE_SLOT/TIER_MAT/TIER_UNLOCK）+ 纯逻辑（equipStats/equipBonus/dropForMonster/rollEquipDrop/recipe/recipeCheck/migrateEquip）。UMD 导出 `module.exports` 兼 `window.Equip`。
- **新建** `test/equip.test.js`。
- **改** `skins/db-console/combat.js` — `playerStats(level, bonus)` 语义改为吃属性加成对象（向后兼容）。
- **改** `skins/db-console/index.html` — 在 farm.js 前加载 equip.js（combat.js 之后）。
- **改** `skins/db-console/farm.js` — 引入 Equip；状态字段；战斗各处 playerStats 传 equipBonus；怪掉装；装备/背包角色面板；锻造 tab。
- **改** `skins/db-console/farm.css` — 角色面板/装备槽/锻造/标签换行。
- **新建目录** `skins/db-console/equip/`（30 图，AI 生成后放入，缺图回退 emoji）。

约定：EQUIP 的 key 永不改。

---

## Task 1: equip.js 数据模块

**Files:** Create `skins/db-console/equip.js`, Test `test/equip.test.js`

- [ ] **Step 1: 写失败测试** `test/equip.test.js`:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../skins/db-console/equip.js');

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
```

- [ ] **Step 2: 运行确认失败** `node --test test/equip.test.js`

- [ ] **Step 3: 写模块** `skins/db-console/equip.js`:
```js
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Equip = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SLOTS = ['weapon', 'armor', 'accessory', 'shoes', 'special'];
  var SLOT_META = {
    weapon:    { name: '武器', job: 'executor' },
    armor:     { name: '防具', job: 'pool' },
    accessory: { name: '饰品', job: 'extension' },
    shoes:     { name: '鞋',   job: 'scheduler' },
    special:   { name: '特殊', job: 'trigger' },
  };
  // 各槽 1 档基线属性（只列非零项）。
  var SLOT_BASE = {
    weapon:    { atk: 6, crit: 2 },
    armor:     { def: 5, mdef: 2, hp: 30 },
    accessory: { matk: 5, mdef: 3, luk: 3 },
    shoes:     { agi: 4, eva: 3 },
    special:   { atk: 2, def: 2, hp: 15, luk: 2, crit: 1 },
  };
  var TIER_SCALE = { 1: 1, 2: 2.2, 3: 4, 4: 7, 5: 11, 6: 16 };
  var ROLE_SLOT = { normal: 'weapon', swift: 'shoes', brute: 'armor', caster: 'accessory', boss: 'special' };
  // 配方用：该档主材料、金币门槛、等级门槛（与打怪档位一致）。
  var TIER_MAT = { 1: 'page_scrap', 2: 'entropy_dust', 3: 'index_shard', 4: 'lock_fang', 5: 'wal_core', 6: 'txn_soul' };
  var TIER_UNLOCK = { 1: 1, 2: 5, 3: 10, 4: 16, 5: 23, 6: 31 };

  // 30 件：key 永不改。属性由 slot×tier 派生。
  var EQUIP = {
    wpn1: { name: '生锈短刃', job: 'rusty_executor', slot: 'weapon', tier: 1 },
    wpn2: { name: '索引之刺', job: 'index_probe', slot: 'weapon', tier: 2 },
    wpn3: { name: '并行战斧', job: 'parallel_axe', slot: 'weapon', tier: 3 },
    wpn4: { name: '向量长枪', job: 'vector_lance', slot: 'weapon', tier: 4 },
    wpn5: { name: '编译者巨剑', job: 'jit_greatsword', slot: 'weapon', tier: 5 },
    wpn6: { name: '湮灭之刃', job: 'vacuum_blade', slot: 'weapon', tier: 6 },
    arm1: { name: '连接布甲', job: 'conn_cloak', slot: 'armor', tier: 1 },
    arm2: { name: '缓存链甲', job: 'cache_mail', slot: 'armor', tier: 2 },
    arm3: { name: '池化胸甲', job: 'pool_plate', slot: 'armor', tier: 3 },
    arm4: { name: '屏障重铠', job: 'barrier_armor', slot: 'armor', tier: 4 },
    arm5: { name: '副本护壁', job: 'replica_bulwark', slot: 'armor', tier: 5 },
    arm6: { name: '不朽栈甲', job: 'durable_aegis', slot: 'armor', tier: 6 },
    acc1: { name: '加密护符', job: 'pgcrypto_charm', slot: 'accessory', tier: 1 },
    acc2: { name: '统计之戒', job: 'stat_ring', slot: 'accessory', tier: 2 },
    acc3: { name: '几何吊坠', job: 'gist_pendant', slot: 'accessory', tier: 3 },
    acc4: { name: '全文项链', job: 'gin_amulet', slot: 'accessory', tier: 4 },
    acc5: { name: '物化宝珠', job: 'matview_orb', slot: 'accessory', tier: 5 },
    acc6: { name: '万象之核', job: 'omni_core', slot: 'accessory', tier: 6 },
    shoe1: { name: '轮询草鞋', job: 'roundrobin_sandals', slot: 'shoes', tier: 1 },
    shoe2: { name: '疾风靴', job: 'scheduler_tuned', slot: 'shoes', tier: 2 },
    shoe3: { name: '亲和缓靴', job: 'affinity_boots', slot: 'shoes', tier: 3 },
    shoe4: { name: '抢占战靴', job: 'preempt_greaves', slot: 'shoes', tier: 4 },
    shoe5: { name: '光速跃履', job: 'lightpath_striders', slot: 'shoes', tier: 5 },
    shoe6: { name: '时隙之翼', job: 'timeslot_wings', slot: 'shoes', tier: 6 },
    spc1: { name: '心跳护身', job: 'heartbeat_ward', slot: 'special', tier: 1 },
    spc2: { name: '钩子饰环', job: 'hook_band', slot: 'special', tier: 2 },
    spc3: { name: '级联符文', job: 'cascade_rune', slot: 'special', tier: 3 },
    spc4: { name: '断言之瞳', job: 'assert_eye', slot: 'special', tier: 4 },
    spc5: { name: '事务图腾', job: 'xact_totem', slot: 'special', tier: 5 },
    spc6: { name: '归墟法典', job: 'void_codex', slot: 'special', tier: 6 },
  };
  var EQUIP_KEYS = Object.keys(EQUIP);

  var BY_SLOT_TIER = {};
  EQUIP_KEYS.forEach(function (k) {
    var e = EQUIP[k];
    (BY_SLOT_TIER[e.slot] = BY_SLOT_TIER[e.slot] || {})[e.tier] = k;
  });

  return {
    SLOTS: SLOTS, SLOT_META: SLOT_META, SLOT_BASE: SLOT_BASE, TIER_SCALE: TIER_SCALE,
    ROLE_SLOT: ROLE_SLOT, TIER_MAT: TIER_MAT, TIER_UNLOCK: TIER_UNLOCK,
    EQUIP: EQUIP, EQUIP_KEYS: EQUIP_KEYS, BY_SLOT_TIER: BY_SLOT_TIER,
  };
});
```

- [ ] **Step 4: 通过** `node --test test/equip.test.js`
- [ ] **Step 5: 提交** `git add skins/db-console/equip.js test/equip.test.js && git commit -m "feat(farm): 装备数据模块 equip.js（30 件/5 槽/6 档）"`

---

## Task 2: equipStats / equipBonus

- [ ] **Step 1: 追加失败测试**:
```js
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
```

- [ ] **Step 2: 失败**
- [ ] **Step 3: 实现**（导出）:
```js
  function equipStats(key, level) {
    var e = EQUIP[key]; if (!e) return {};
    var base = SLOT_BASE[e.slot], scale = TIER_SCALE[e.tier] * (1 + 0.15 * (level || 0));
    var out = {};
    for (var s in base) { var v = Math.round(base[s] * scale); if (v) out[s] = v; }
    return out;
  }
  function equipBonus(equipped) {
    var sum = {};
    if (!equipped) return sum;
    for (var i = 0; i < SLOTS.length; i++) {
      var e = equipped[SLOTS[i]];
      if (!e || !e.key) continue;
      var st = equipStats(e.key, e.level || 0);
      for (var s in st) sum[s] = (sum[s] || 0) + st[s];
    }
    return sum;
  }
```
导出加 `equipStats: equipStats, equipBonus: equipBonus,`。
- [ ] **Step 4: 通过** ; **Step 5: 提交** `git commit -m "feat(farm): equipStats/equipBonus 装备属性派生与汇总"`

---

## Task 3: dropForMonster / rollEquipDrop

- [ ] **Step 1: 追加失败测试**:
```js
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
```

- [ ] **Step 2: 失败**
- [ ] **Step 3: 实现**（导出）:
```js
  function dropForMonster(role, tier) {
    var slot = ROLE_SLOT[role]; if (!slot) return null;
    return (BY_SLOT_TIER[slot] || {})[tier] || null;
  }
  // 掉装：小怪 5% / boss 25%，luk 每点 +0.05%。命中返回装备 key，否则 null。
  function rollEquipDrop(role, tier, luk, rng) {
    rng = rng || Math.random;
    var chance = (role === 'boss' ? 0.25 : 0.05) + (luk || 0) * 0.0005;
    if (rng() >= chance) return null;
    return dropForMonster(role, tier);
  }
```
导出加 `dropForMonster: dropForMonster, rollEquipDrop: rollEquipDrop,`。
- [ ] **Step 4: 通过** ; **Step 5: 提交** `git commit -m "feat(farm): 怪物掉装映射 dropForMonster/rollEquipDrop"`

---

## Task 4: recipe / recipeCheck（矿石恒缺→锁）

- [ ] **Step 1: 追加失败测试**:
```js
test('recipe：按档派生材料/矿石/金币/等级', () => {
  const r = E.recipe('wpn1'); // T1
  assert.ok(r.mats.page_scrap > 0);
  assert.ok(r.ore > 0, '需矿石');
  assert.strictEqual(r.level, 1);
  const r6 = E.recipe('wpn6');
  assert.ok(r6.coins > r.coins && r6.ore > r.ore);
});
test('recipeCheck：矿石恒缺 → ok 永远 false', () => {
  const rich = { coins: 1e9, mats: { page_scrap: 999 }, oreCount: 0 };
  const c = E.recipeCheck('wpn1', rich, 99);
  assert.strictEqual(c.oreOk, false);
  assert.strictEqual(c.ok, false);
  assert.strictEqual(c.matsOk, true);   // 材料/金币/等级都够，只差矿石
  assert.strictEqual(c.coinsOk, true);
  assert.strictEqual(c.levelOk, true);
});
```

- [ ] **Step 2: 失败**
- [ ] **Step 3: 实现**（导出）:
```js
  function recipe(key) {
    var e = EQUIP[key]; if (!e) return null;
    var t = e.tier, mats = {};
    mats[TIER_MAT[t]] = 4 + t * 2;
    return { mats: mats, ore: 1 + t, coins: 40 * t * t, level: TIER_UNLOCK[t] };
  }
  // 配方可否满足。oreOk 因本期无矿石来源恒为 false → ok 恒 false（锻造暂锁）。
  function recipeCheck(key, state, level) {
    var r = recipe(key); if (!r) return null;
    var matsOk = true;
    for (var m in r.mats) if (((state.mats || {})[m] || 0) < r.mats[m]) matsOk = false;
    var levelOk = level >= r.level;
    var coinsOk = (state.coins || 0) >= r.coins;
    var oreOk = (state.oreCount || 0) >= r.ore;
    return { recipe: r, matsOk: matsOk, levelOk: levelOk, coinsOk: coinsOk, oreOk: oreOk,
      ok: matsOk && levelOk && coinsOk && oreOk };
  }
```
导出加 `recipe: recipe, recipeCheck: recipeCheck,`。
- [ ] **Step 4: 通过** ; **Step 5: 提交** `git commit -m "feat(farm): 锻造配方 recipe/recipeCheck（矿石恒缺暂锁）"`

---

## Task 5: migrateEquip

- [ ] **Step 1: 追加失败测试**:
```js
test('migrateEquip 补默认、不丢旧数据', () => {
  const s = { coins: 5 };
  E.migrateEquip(s);
  assert.deepStrictEqual(Object.keys(s.equipped).sort(), E.SLOTS.slice().sort());
  E.SLOTS.forEach((sl) => assert.strictEqual(s.equipped[sl], null));
  assert.deepStrictEqual(s.owned, []);
  assert.strictEqual(s.oreCount, 0);
  assert.strictEqual(s.coins, 5);
  const s2 = { equipped: { weapon: { key: 'wpn1', level: 0 } }, owned: [{ key: 'arm1', level: 0 }], oreCount: 3 };
  E.migrateEquip(s2);
  assert.strictEqual(s2.equipped.weapon.key, 'wpn1');   // 不覆盖
  assert.strictEqual(s2.equipped.armor, null);          // 补缺槽
  assert.strictEqual(s2.owned.length, 1);
  assert.strictEqual(s2.oreCount, 3);
});
```

- [ ] **Step 2: 失败**
- [ ] **Step 3: 实现**（导出）:
```js
  function migrateEquip(s) {
    if (!s.equipped || typeof s.equipped !== 'object') s.equipped = {};
    for (var i = 0; i < SLOTS.length; i++) if (!(SLOTS[i] in s.equipped)) s.equipped[SLOTS[i]] = null;
    if (!Array.isArray(s.owned)) s.owned = [];
    if (typeof s.oreCount !== 'number') s.oreCount = 0;
  }
```
导出加 `migrateEquip: migrateEquip,`。
- [ ] **Step 4: 通过** ; **Step 5: 提交** `git commit -m "feat(farm): migrateEquip 存档迁移"`

---

## Task 6: combat.js playerStats 吃「属性加成对象」

**Files:** Modify `skins/db-console/combat.js`, Test `test/combat.test.js`

- [ ] **Step 1: 追加失败测试** `test/combat.test.js`:
```js
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
```

- [ ] **Step 2: 失败**（旧 playerStats 不叠 hp/def/... 加成）
- [ ] **Step 3: 实现** —— 把 combat.js 的 `playerStats` 替换为：
```js
  function playerStats(level, bonus) {
    bonus = bonus || {};
    function b(k) { return bonus[k] || 0; }
    return {
      hp:   60 + level * 22 + b('hp'),
      atk:  10 + Math.round(level * 3.2) + b('atk'),
      matk: 6  + Math.round(level * 2.2) + b('matk'),
      def:  5  + Math.round(level * 2.1) + b('def'),
      mdef: 4  + Math.round(level * 1.6) + b('mdef'),
      agi:  6  + Math.round(level * 1.1) + b('agi'),
      luk:  4  + Math.round(level * 0.5) + b('luk'),
      crit: Math.min(60, 5 + level * 0.25 + b('crit')),
      eva:  Math.min(50, 3 + level * 0.18 + b('eva')),
    };
  }
```
（导出不变；旧测试 `playerStats(1, C.DEFAULT_WEAPON)` 因 DEFAULT_WEAPON.atk=6 仍绿。）

- [ ] **Step 4: 通过** `node --test test/combat.test.js`（含旧全部）
- [ ] **Step 5: 提交** `git add skins/db-console/combat.js test/combat.test.js && git commit -m "refactor(farm): combat.playerStats 吃属性加成对象（装备接入）"`

---

## Task 7: 接入 index.html + farm.js（引用/状态/迁移/战斗吃装备）

**Files:** Modify `skins/db-console/index.html`, `skins/db-console/farm.js`

**先读 farm.js** 定位锚点。

- [ ] **Step 1: index.html** 在 `combat.js` 后、`farm.js` 前加：`<script src="/equip.js"></script>`
- [ ] **Step 2: farm.js 顶部** 加 `var Equip = window.Equip;`（`var Combat` 附近）
- [ ] **Step 3: freshState** 加字段：`equipped: { weapon: null, armor: null, accessory: null, shoes: null, special: null }, owned: [], oreCount: 0,`
- [ ] **Step 4: load() 末尾** 迁移（`Combat.migrateCombat(state)` 之后）加 `Equip.migrateEquip(state);`
- [ ] **Step 5: 战斗各处 playerStats 传入装备加成** —— 把 farm.js 里所有 `Combat.playerStats(levelInfo().lvl, Combat.DEFAULT_WEAPON)` 改为 `Combat.playerStats(levelInfo().lvl, Equip.equipBonus(state.equipped))`；`Combat.settleOffline(..., Combat.DEFAULT_WEAPON, ...)`（render 离线块）里的 `Combat.DEFAULT_WEAPON` 改为 `Equip.equipBonus(state.equipped)`。用 `grep -n "Combat.DEFAULT_WEAPON" skins/db-console/farm.js` 确认全部替换。
- [ ] **Step 6: 验证** `node --check`；起服务 `curl / | grep -c equip.js`（≥1）；`node --test "test/*.test.js"` 全绿。
- [ ] **Step 7: 提交** `git add skins/db-console/index.html skins/db-console/farm.js && git commit -m "feat(farm): 接入 equip 模块，战斗吃装备加成"`

---

## Task 8: 怪物掉装（进战利品堆、结束入 owned）

**Files:** Modify `skins/db-console/farm.js`

- [ ] **Step 1: enterBattle 的 drops 加 equip 数组**：`drops: { xp: 0, coins: 0, mats: {}, equip: [] }`。并在 battleView 的战利品堆里显示 equip 件（见 Step 4）。
- [ ] **Step 2: battleTick 击杀处**（`if (res.monDead) {` 里，材料掉落之后）加装备掉落 roll：
```js
      var mdef = Combat.MONSTERS[b.mob];
      var eq = Equip.rollEquipDrop(mdef.role, mdef.tier, ps.luk, Math.random);
      if (eq) b.drops.equip.push({ key: eq, level: 0 });
```
- [ ] **Step 3: render 离线块**（`if (bo.kills > 0)` 里）按击杀数补掉装：
```js
        var md = Combat.MONSTERS[state.battle.mob];
        for (var ei = 0; ei < bo.kills; ei++) {
          var eq2 = Equip.rollEquipDrop(md.role, md.tier, Combat.playerStats(levelInfo().lvl, Equip.equipBonus(state.equipped)).luk, Math.random);
          if (eq2) state.battle.drops.equip.push({ key: eq2, level: 0 });
        }
```
- [ ] **Step 4: collectDrops 收装备入 owned**（`collectDrops` 里，材料之后）：
```js
    if (d.equip) for (var ei = 0; ei < d.equip.length; ei++) state.owned.push(d.equip[ei]);
```
- [ ] **Step 5: battleView 战利品堆显示装备件**（loot 区，在材料 span 之后）：
```js
    if (b.drops.equip) for (var qi = 0; qi < b.drops.equip.length; qi++) {
      var ek = b.drops.equip[qi].key;
      lootItems += '<span class="loot-i loot-eq">' + esc(state.real ? Equip.EQUIP[ek].name : Equip.EQUIP[ek].job) + '</span>';
    }
```
（`collectDrops`/`b.drops` 的 equip 字段对老存档可能不存在——migrateCombat 已给旧 battle 补 drops，但那份 drops 无 equip；在 battleTick/battleView 用 `b.drops.equip = b.drops.equip || []` 兜底，或在 migrateCombat 补。**实现时在 battleTick 开头加 `if (b.drops && !b.drops.equip) b.drops.equip = [];`**）
- [ ] **Step 6: 验证** `node --check`；起服务人工/静态确认无报错；测试全绿。
- [ ] **Step 7: 提交** `git add skins/db-console/farm.js && git commit -m "feat(farm): 怪物按特性掉装，进战利品堆、结束入背包"`

---

## Task 9: 装备/背包 角色面板（背包 tab 扩展）

**Files:** Modify `skins/db-console/farm.js`, `skins/db-console/farm.css`

- [ ] **Step 1: 装备图标助手 + 属性文案**（`invTab` 附近）:
```js
  function equipFace(key) {
    if (!state.real) return '';
    return '<img class="eq-face" src="/equip/' + key + '.webp" alt="" loading="lazy" decoding="async"'
      + ' onerror="this.replaceWith(document.createTextNode(\'\u{1F9F0}\'))"> ';
  }
  var STAT_LABEL = { hp: '生命', atk: '攻击', matk: '魔攻', def: '防御', mdef: '魔防', agi: '敏捷', luk: '幸运', crit: '暴击', eva: '闪避' };
  var STAT_JOB = { hp: 'hp', atk: 'atk', matk: 'matk', def: 'def', mdef: 'mdef', agi: 'agi', luk: 'luk', crit: 'crit', eva: 'eva' };
  function statLabel(k) { return state.real ? STAT_LABEL[k] : STAT_JOB[k]; }
  function equipName(key) { var e = Equip.EQUIP[key]; return state.real ? e.name : e.job; }
```

- [ ] **Step 2: 重写 invTab 为角色面板**：
```js
  function invTab() {
    var lvl = levelInfo().lvl;
    var ps = Combat.playerStats(lvl, Equip.equipBonus(state.equipped));
    // 属性面板
    var statOrder = ['hp', 'atk', 'matk', 'def', 'mdef', 'agi', 'luk', 'crit', 'eva'];
    var stats = statOrder.map(function (k) {
      return '<div class="col"><span>' + esc(statLabel(k)) + '</span><span class="typ">' + ps[k] + '</span></div>';
    }).join('');
    // 装备槽
    var slots = Equip.SLOTS.map(function (sl) {
      var e = state.equipped[sl], meta = Equip.SLOT_META[sl];
      var body = e
        ? equipFace(e.key) + esc(equipName(e.key)) + (e.level ? ' +' + e.level : '')
          + ' <a class="mini" data-uneq="' + sl + '">' + (state.real ? '卸下' : 'unequip') + '</a>'
        : '<span class="eq-empty">' + (state.real ? '空' : '—') + '</span>';
      return '<div class="eq-slot"><span class="eq-slot-nm">' + esc(state.real ? meta.name : meta.job) + '</span>' + body + '</div>';
    }).join('');
    // 已有装备
    var owned = state.owned.map(function (o, i) {
      var e = Equip.EQUIP[o.key];
      return '<tr><td>' + equipFace(o.key) + esc(equipName(o.key)) + (o.level ? ' +' + o.level : '')
        + '</td><td>' + esc(state.real ? Equip.SLOT_META[e.slot].name : Equip.SLOT_META[e.slot].job) + '</td>'
        + '<td><a class="mini" data-eq="' + i + '">' + (state.real ? '穿戴' : 'equip') + '</a></td></tr>';
    }).join('');
    // 材料
    var M = Combat.MATERIALS;
    var mats = Object.keys(M).filter(function (k) { return (state.mats[k] || 0) > 0; }).map(function (k) {
      return '<tr><td>' + matFace(k) + esc(state.real ? M[k].name : M[k].job) + '</td><td class="num">' + state.mats[k] + '</td></tr>';
    }).join('');
    return '<div class="pad">'
      + '<div class="rail-label">' + (state.real ? '角色' : 'stats') + '</div>'
      + '<div class="eq-slots">' + slots + '</div>'
      + '<div class="statgrid">' + stats + '</div>'
      + '<div class="rail-label">' + (state.real ? '装备' : 'gear') + '</div>'
      + (owned ? '<table class="grid"><tr><th>' + (state.real ? '装备' : 'item') + '</th><th>' + (state.real ? '槽' : 'slot') + '</th><th></th></tr>' + owned + '</table>'
        : '<div class="kb-hint">' + (state.real ? '还没有装备——去副本打怪掉落。' : 'no gear yet.') + '</div>')
      + '<div class="rail-label">' + (state.real ? '材料' : 'objects') + '</div>'
      + (mats ? '<table class="grid"><tr><th>' + (state.real ? '材料' : 'object') + '</th><th>' + (state.real ? '数量' : 'count') + '</th></tr>' + mats + '</table>'
        : '<div class="kb-hint">' + (state.real ? '暂无材料。' : 'no materials.') + '</div>')
      + '</div>';
  }
```

- [ ] **Step 3: onMainClick 穿脱**（`data-fight` 之后）:
```js
    var eqi = e.target.closest ? e.target.closest('[data-eq]') : null;
    if (eqi) { equipItem(parseInt(eqi.getAttribute('data-eq'), 10)); return; }
    var uneq = e.target.closest ? e.target.closest('[data-uneq]') : null;
    if (uneq) { unequipSlot(uneq.getAttribute('data-uneq')); return; }
```
并加函数：
```js
  function equipItem(ownedIdx) {
    var o = state.owned[ownedIdx]; if (!o) return;
    var slot = Equip.EQUIP[o.key].slot;
    var cur = state.equipped[slot];
    state.equipped[slot] = o;
    state.owned.splice(ownedIdx, 1);
    if (cur) state.owned.push(cur);   // 换下的回到背包
    redraw();
  }
  function unequipSlot(slot) {
    var cur = state.equipped[slot]; if (!cur) return;
    state.equipped[slot] = null;
    state.owned.push(cur);
    redraw();
  }
```

- [ ] **Step 4: farm.css 追加**:
```css
/* ---- 角色/装备 ---- */
.eq-slots { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 10px; }
.eq-slot { flex: 1 1 130px; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; background: var(--surface); font: 11px/1.5 var(--font-mono); }
.eq-slot-nm { display: block; color: var(--muted); font-size: 10px; margin-bottom: 3px; }
.eq-empty { color: #4a4a4a; }
.eq-face { width: 20px; height: 20px; vertical-align: middle; object-fit: contain; }
```

- [ ] **Step 5: 验证**：起服务进背包分区，看角色面板（属性=基础+装备）、装备槽、已有装备穿/脱切换属性、材料仍在。`node --test "test/*.test.js"` 全绿。
- [ ] **Step 6: 提交** `git add skins/db-console/farm.js skins/db-console/farm.css && git commit -m "feat(farm): 背包扩成装备/角色面板（穿脱+属性汇总）"`

---

## Task 10: 锻造 tab（脚手架·矿石留空）

**Files:** Modify `skins/db-console/farm.js`, `skins/db-console/farm.css`

- [ ] **Step 1: TABS 加锻造**（`inv` 之后、`stats` 之前）：`{ id: 'forge', job: 'smithy', name: '锻造' },`
- [ ] **Step 2: forgeTab()**（`invTab` 附近）:
```js
  function forgeTab() {
    var lvl = levelInfo().lvl;
    var rows = Equip.EQUIP_KEYS.map(function (k) {
      var c = Equip.recipeCheck(k, state, lvl), r = c.recipe, e = Equip.EQUIP[k];
      var need = Object.keys(r.mats).map(function (m) {
        return esc(state.real ? Combat.MATERIALS[m].name : Combat.MATERIALS[m].job) + '×' + r.mats[m];
      }).join(' ');
      return '<tr><td>' + equipFace(k) + esc(equipName(k)) + '</td>'
        + '<td>' + (state.real ? 'Lv.' : 'lv ') + r.level + '</td>'
        + '<td class="rec-need">' + need + ' · ◈' + r.coins
        + ' · <span class="rec-ore">' + (state.real ? '矿石×' + r.ore + '（待开采）' : 'ore×' + r.ore + ' (locked)') + '</span></td>'
        + '<td><button class="btn btn-dim" disabled>' + (state.real ? '锻造' : 'forge') + '</button></td></tr>';
    }).join('');
    return '<div class="pad"><div class="kb-hint">'
      + (state.real ? '配方需要矿石，矿石来自开采系统（开发中）——目前锻造暂锁，装备靠打怪掉落。' : 'recipes need ore (mining WIP) — locked.')
      + '</div><table class="grid"><tr><th>' + (state.real ? '产出' : 'item') + '</th><th>' + (state.real ? '等级' : 'lv')
      + '</th><th>' + (state.real ? '需求' : 'cost') + '</th><th></th></tr>' + rows + '</table></div>';
  }
```
- [ ] **Step 3: render 分派**加 `: state.tab === 'forge' ? forgeTab()`
- [ ] **Step 4: farm.css**：标签栏允许换行（避免 8 个标签撑爆）——把 `.ftabs` 加 `flex-wrap: wrap;`。加：
```css
.rec-need { font: 10px/1.5 var(--font-mono); color: var(--muted); }
.rec-ore { color: #a06b3e; }
```
- [ ] **Step 5: 验证**：进锻造分区，配方列表显示、矿石列灰显「待开采」、锻造按钮禁用；标签栏不溢出。测试全绿。
- [ ] **Step 6: 提交** `git add skins/db-console/farm.js skins/db-console/farm.css && git commit -m "feat(farm): 锻造分区脚手架（配方展示·矿石留空暂锁）"`

---

## Task 11: 装备图标接入（放图，缺图已回退）

> `equipFace` 缺图回退（🧰 emoji）已在 Task 9 写好。本任务放图。webp MIME/缓存已就绪。

**Files:** Create `skins/db-console/equip/<key>.webp` ×30（AI 生成后放入）

- [ ] **Step 1** 按 `docs/superpowers/specs/2026-09-03-equipment-art-prompts.md` 出图，存 `skins/db-console/equip/<key>.webp`（key 见 equip.js）。
- [ ] **Step 2** 起服务 `curl -sI http://127.0.0.1:8099/equip/wpn1.webp` → 200 + image/webp。
- [ ] **Step 3** 游戏模式看背包/锻造：有图显图、无图 🧰；伪装模式无图。
- [ ] **Step 4: 提交** `git add skins/db-console/equip && git commit -m "assets(farm): 30 件装备图标 (webp)"`

---

## 全量回归
- [ ] `node --test test/equip.test.js` 全绿；`node --test "test/*.test.js"` 无回归。
- [ ] `node --check` equip.js/combat.js/farm.js。
- [ ] 人工：打怪掉装→背包穿戴→属性变化→再打怪更强；锻造分区配方展示但锁；伪装切换；离线掉装。

## 自检对照 spec
- 30 件 5 槽×6 档：Task 1。属性派生+升级+汇总：Task 2。怪掉装 role→slot：Task 3。配方矿石恒缺锁：Task 4。迁移：Task 5。
- playerStats 吃装备加成：Task 6 + Task 7 战斗各处替换。
- 怪按特性掉装、进战利品堆结束入背包：Task 8。
- 装备/角色面板（穿脱+8属性=基础+装备）：Task 9。锻造脚手架（矿石留空暂锁）：Task 10。
- 装备立绘+缺图回退+伪装不出图：Task 9/11。
