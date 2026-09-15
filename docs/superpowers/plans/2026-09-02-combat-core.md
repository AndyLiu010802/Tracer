# 打怪·战斗核心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给键盘农场加战斗核心：副本卡牌墙选怪、1v1 挂机自动回合制战斗、8 属性面板、掉落材料、离线结算。

**Architecture:** 战斗纯数据+纯逻辑放进可单测 UMD 模块 `skins/db-console/combat.js`（仿 `fishing.js`/`conceal-policy.js`）；`farm.js` 引入它做状态/DOM/渲染/战斗定时器。不碰 farm-data.js、不碰钓鱼。

**Tech Stack:** 原生 JS（浏览器 IIFE + UMD 模块）、Node 内置 `node --test`、无构建。webp 资源服务与缓存已在钓鱼阶段就绪（server.js 无需改）。

配套 spec：`docs/superpowers/specs/2026-09-02-combat-core-design.md`
出图 prompt：`docs/superpowers/specs/2026-09-02-combat-art-prompts.md`

---

## 文件结构
- **新建** `skins/db-console/combat.js` — 数据（TIER_BASE/ROLE_MULT/MONSTERS/MATERIALS/DEFAULT_WEAPON/DROP_*/常量）+ 纯逻辑（playerStats/monsterStats/monsterUnlocked/attack/resolveRound/rollDrops/settleOffline/migrateCombat），UMD 导出 `module.exports` 兼 `window.Combat`。
- **新建** `test/combat.test.js` — 上述单测。
- **改** `skins/db-console/index.html` — 在 farm.js 前加载 combat.js。
- **改** `skins/db-console/farm.js` — 引入 Combat；状态字段；副本卡牌墙；对战视图 + 战斗定时器；onMainClick 交互；render 离线结算。
- **改** `skins/db-console/farm.css` — 卡牌网格、对战视图、血条。
- **新建目录（图由 AI 生成后放入，缺图回退）** `skins/db-console/mobs/`；文件 `skins/db-console/hero.webp`、`skins/db-console/arena.webp`。

约定：`combat.js` 的 monster key 永不改。

---

## Task 1: combat.js 数据模块 + 全数据表

**Files:** Create `skins/db-console/combat.js`, Test `test/combat.test.js`

- [ ] **Step 1: 写失败测试** `test/combat.test.js`:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('../skins/db-console/combat.js');

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
```

- [ ] **Step 2: 运行确认失败** `node --test test/combat.test.js` → FAIL (module not found)

- [ ] **Step 3: 写模块** `skins/db-console/combat.js`:
```js
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Combat = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 档位基线：解锁等级 + 该档基础属性。
  var TIER_BASE = {
    1: { unlock: 1,  hp: 40,   atk: 8,   def: 3,  agi: 5 },
    2: { unlock: 5,  hp: 90,   atk: 16,  def: 7,  agi: 8 },
    3: { unlock: 10, hp: 180,  atk: 28,  def: 13, agi: 12 },
    4: { unlock: 16, hp: 340,  atk: 46,  def: 22, agi: 17 },
    5: { unlock: 23, hp: 620,  atk: 74,  def: 36, agi: 23 },
    6: { unlock: 31, hp: 1100, atk: 118, def: 58, agi: 30 },
  };
  // 角色倍率（hp/atk/def/agi）。
  var ROLE_MULT = {
    normal: { hp: 1.0,  atk: 1.0,  def: 1.0, agi: 1.0 },
    swift:  { hp: 0.7,  atk: 0.9,  def: 0.8, agi: 1.6 },
    brute:  { hp: 1.6,  atk: 1.25, def: 1.2, agi: 0.6 },
    caster: { hp: 0.85, atk: 1.1,  def: 0.9, agi: 1.1 },
    boss:   { hp: 4.0,  atk: 1.6,  def: 1.5, agi: 1.1 },
  };
  // 材料（游戏名/黑话），给锻造留口，本期只囤。
  var MATERIALS = {
    page_scrap:   { name: '页料',   job: 'page_scrap' },
    lock_fang:    { name: '锁齿',   job: 'lock_fang' },
    entropy_dust: { name: '熵尘',   job: 'entropy_dust' },
    index_shard:  { name: '索晶',   job: 'index_shard' },
    wal_core:     { name: '日志核', job: 'wal_core' },
    txn_soul:     { name: '事务魂', job: 'txn_soul' },
  };
  var DEFAULT_WEAPON = { name: '维护脚本', job: 'maint_script', atk: 6, matk: 0, def: 0 };

  // 怪物：{name, job, tier, role, mat}。key 永不改。stats 由 tier×role 派生。
  var MONSTERS = {
    deadlock:        { name: '死锁蛛',   job: 'deadlock',          tier: 1, role: 'swift',  mat: 'lock_fang' },
    dead_tuple:      { name: '僵尸元组', job: 'dead_tuple',        tier: 1, role: 'normal', mat: 'entropy_dust' },
    table_bloat:     { name: '膨胀史莱姆', job: 'table_bloat',     tier: 1, role: 'brute',  mat: 'page_scrap' },
    slow_query:      { name: '慢查询幽魂', job: 'slow_query',      tier: 1, role: 'caster', mat: 'index_shard' },
    cache_miss:      { name: '缓存食客', job: 'cache_miss',        tier: 1, role: 'normal', mat: 'page_scrap' },
    lock_lord:       { name: '锁之领主', job: 'lock_contention',   tier: 1, role: 'boss',   mat: 'lock_fang' },
    torn_page:       { name: '碎页蝠',   job: 'torn_page',         tier: 2, role: 'swift',  mat: 'page_scrap' },
    disk_spill:      { name: '溢出巨蟾', job: 'disk_spill',        tier: 2, role: 'brute',  mat: 'entropy_dust' },
    bloat_swarm:     { name: '死元组群', job: 'bloat_swarm',       tier: 2, role: 'normal', mat: 'entropy_dust' },
    index_rot:       { name: '索引蛀虫', job: 'index_rot',         tier: 2, role: 'normal', mat: 'index_shard' },
    stale_stats:     { name: '统计妖',   job: 'stale_stats',       tier: 2, role: 'caster', mat: 'index_shard' },
    vacuum_storm:    { name: '真空吞噬者', job: 'autovacuum_storm', tier: 2, role: 'boss',  mat: 'wal_core' },
    repl_lag:        { name: '复制延迟鬼', job: 'repl_lag',        tier: 3, role: 'caster', mat: 'wal_core' },
    conn_leak:       { name: '连接泄漏体', job: 'conn_leak',       tier: 3, role: 'normal', mat: 'lock_fang' },
    wal_flood:       { name: 'WAL洪流兽', job: 'wal_flood',        tier: 3, role: 'brute',  mat: 'wal_core' },
    phantom_read:    { name: '幻读魅影', job: 'phantom_read',      tier: 3, role: 'swift',  mat: 'txn_soul' },
    checkpoint_spike:{ name: '检查点巨像', job: 'checkpoint_spike', tier: 3, role: 'brute', mat: 'page_scrap' },
    long_txn:        { name: '长事务之影', job: 'long_txn',        tier: 3, role: 'boss',   mat: 'txn_soul' },
    dirty_pages:     { name: '脏页风暴', job: 'dirty_pages',       tier: 4, role: 'caster', mat: 'page_scrap' },
    disk_full:       { name: '磁盘饕餮', job: 'disk_full',         tier: 4, role: 'brute',  mat: 'entropy_dust' },
    race_condition:  { name: '竞态双子', job: 'race_condition',    tier: 4, role: 'swift',  mat: 'lock_fang' },
    entropy_creep:   { name: '熵增之蚀', job: 'entropy_creep',     tier: 4, role: 'normal', mat: 'entropy_dust' },
    freeze_ghost:    { name: '冻结幽灵', job: 'freeze_ghost',      tier: 4, role: 'caster', mat: 'txn_soul' },
    crash_recovery:  { name: '崩溃恢复魔', job: 'crash_recovery',  tier: 4, role: 'boss',   mat: 'wal_core' },
    partition_rift:  { name: '分区裂隙', job: 'partition_rift',    tier: 5, role: 'swift',  mat: 'index_shard' },
    checksum_error:  { name: '校验和恶鬼', job: 'checksum_error',  tier: 5, role: 'normal', mat: 'index_shard' },
    oom_killer:      { name: '内存吞噬兽', job: 'oom_killer',      tier: 5, role: 'brute',  mat: 'entropy_dust' },
    dead_letter:     { name: '死信使者', job: 'dead_letter',       tier: 5, role: 'caster', mat: 'txn_soul' },
    logical_corrupt: { name: '逻辑损毁体', job: 'logical_corrupt', tier: 5, role: 'normal', mat: 'wal_core' },
    split_brain:     { name: '主从断裂君', job: 'split_brain',     tier: 5, role: 'boss',   mat: 'txn_soul' },
    page_corruption: { name: '页损坏巨兽', job: 'page_corruption', tier: 6, role: 'brute',  mat: 'page_scrap' },
    infinite_bloat:  { name: '无尽膨胀神', job: 'infinite_bloat',  tier: 6, role: 'brute',  mat: 'entropy_dust' },
    clock_skew:      { name: '时序错乱者', job: 'clock_skew',      tier: 6, role: 'swift',  mat: 'index_shard' },
    silent_dataloss: { name: '静默丢数魔', job: 'silent_dataloss', tier: 6, role: 'caster', mat: 'wal_core' },
    storage_void:    { name: '存储湮灭', job: 'storage_void',      tier: 6, role: 'normal', mat: 'txn_soul' },
    xid_wraparound:  { name: '湮灭之王·XID回卷', job: 'xid_wraparound', tier: 6, role: 'boss', mat: 'txn_soul' },
  };
  var MON_KEYS = Object.keys(MONSTERS);

  var DROP_XP   = { 1: 3, 2: 7, 3: 14, 4: 26, 5: 46, 6: 78 };
  var DROP_COIN = { 1: 8, 2: 20, 3: 48, 4: 110, 5: 240, 6: 520 };
  var BATTLE_TICK_MS = 400;
  var OFFLINE_CAP = 2000;

  return {
    TIER_BASE: TIER_BASE, ROLE_MULT: ROLE_MULT, MATERIALS: MATERIALS,
    DEFAULT_WEAPON: DEFAULT_WEAPON, MONSTERS: MONSTERS, MON_KEYS: MON_KEYS,
    DROP_XP: DROP_XP, DROP_COIN: DROP_COIN,
    BATTLE_TICK_MS: BATTLE_TICK_MS, OFFLINE_CAP: OFFLINE_CAP,
  };
});
```

- [ ] **Step 4: 运行确认通过** `node --test test/combat.test.js` → 3 pass
- [ ] **Step 5: 提交**
```bash
git add skins/db-console/combat.js test/combat.test.js
git commit -m "feat(farm): 战斗数据模块 combat.js（36 怪/6 档/6 材料）"
```

---

## Task 2: 属性派生 playerStats / monsterStats / monsterUnlocked

**Files:** Modify `skins/db-console/combat.js`, Test `test/combat.test.js`

- [ ] **Step 1: 追加失败测试**:
```js
test('playerStats 随等级增长、含默认武器加成', () => {
  const s1 = C.playerStats(1, C.DEFAULT_WEAPON);
  const s9 = C.playerStats(9, C.DEFAULT_WEAPON);
  assert.ok(s9.hp > s1.hp && s9.atk > s1.atk && s9.def > s1.def);
  assert.strictEqual(s1.atk, 10 + Math.round(1 * 3.2) + 6); // 含武器 atk 6
  assert.ok(s1.crit <= 60 && s1.eva <= 50);
});

test('monsterStats 由 tier×role 派生', () => {
  const boss = C.monsterStats('lock_lord'); // 档1 boss
  const mob = C.monsterStats('dead_tuple'); // 档1 normal
  assert.ok(boss.hp > mob.hp * 3, 'boss 血远超小怪');
  assert.strictEqual(boss.boss, true);
  assert.strictEqual(mob.boss, false);
  const swift = C.monsterStats('deadlock');
  assert.ok(swift.agi > mob.agi, 'swift 更敏捷');
});

test('monsterUnlocked 看等级门槛', () => {
  assert.strictEqual(C.monsterUnlocked('dead_tuple', 1), true);   // 档1 Lv1
  assert.strictEqual(C.monsterUnlocked('repl_lag', 5), false);    // 档3 需 Lv10
  assert.strictEqual(C.monsterUnlocked('repl_lag', 10), true);
});
```

- [ ] **Step 2: 运行确认失败** → `C.playerStats is not a function`

- [ ] **Step 3: 实现**（加在 `return {...}` 前，并加入导出）:
```js
  function playerStats(level, weapon) {
    weapon = weapon || DEFAULT_WEAPON;
    return {
      hp:   60 + level * 22,
      atk:  10 + Math.round(level * 3.2) + (weapon.atk || 0),
      matk: 6  + Math.round(level * 2.2) + (weapon.matk || 0),
      def:  5  + Math.round(level * 2.1) + (weapon.def || 0),
      mdef: 4  + Math.round(level * 1.6),
      agi:  6  + Math.round(level * 1.1),
      luk:  4  + Math.round(level * 0.5),
      crit: Math.min(60, 5 + level * 0.25),
      eva:  Math.min(50, 3 + level * 0.18),
    };
  }
  function monsterStats(key) {
    var m = MONSTERS[key]; if (!m) return null;
    var b = TIER_BASE[m.tier], r = ROLE_MULT[m.role], boss = m.role === 'boss';
    return {
      key: key, tier: m.tier, boss: boss, level: b.unlock,
      hp:  Math.round(b.hp * r.hp),
      atk: Math.round(b.atk * r.atk),
      def: Math.round(b.def * r.def),
      agi: Math.round(b.agi * r.agi),
      crit: boss ? 8 : 4, eva: boss ? 5 : 3, luk: 0,
    };
  }
  function monsterUnlocked(key, level) {
    var m = MONSTERS[key]; return !!m && level >= TIER_BASE[m.tier].unlock;
  }
```
导出加 `playerStats: playerStats, monsterStats: monsterStats, monsterUnlocked: monsterUnlocked,`。

- [ ] **Step 4: 通过** `node --test test/combat.test.js`
- [ ] **Step 5: 提交** `git add skins/db-console/combat.js test/combat.test.js && git commit -m "feat(farm): 属性派生 playerStats/monsterStats"`

---

## Task 3: attack —— 单次攻击（伤害/暴击/闪避）

- [ ] **Step 1: 追加失败测试**:
```js
test('attack：伤害=max(0,atk-def)，暴击×1.75，闪避为 0', () => {
  const A = { atk: 30, crit: 0, luk: 0 };
  const D = { def: 10, eva: 0 };
  // rng 恒 0.99 → 不闪不暴
  let r = C.attack(A, D, () => 0.99);
  assert.deepStrictEqual([r.dmg, r.crit, r.dodged], [20, false, false]);
  // rng 恒 0 → 先判闪避(0<eva? eva=0 不闪)，再判暴击(0<crit? 用高 crit 触发)
  r = C.attack({ atk: 30, crit: 100, luk: 0 }, D, () => 0);
  assert.strictEqual(r.crit, true);
  assert.strictEqual(r.dmg, Math.round(20 * 1.75));
  // 高闪避必闪
  r = C.attack(A, { def: 10, eva: 100 }, () => 0);
  assert.deepStrictEqual([r.dmg, r.dodged], [0, true]);
  // 过防御：atk<def → 0
  assert.strictEqual(C.attack({ atk: 5, crit: 0 }, { def: 99, eva: 0 }, () => 0.99).dmg, 0);
});
```

- [ ] **Step 2: 失败** → `C.attack is not a function`
- [ ] **Step 3: 实现**（导出）:
```js
  // 攻击方对防守方一击。纯函数。判定序：闪避 → 伤害 → 暴击。
  function attack(attacker, defender, rng) {
    rng = rng || Math.random;
    if (rng() * 100 < (defender.eva || 0)) return { dmg: 0, crit: false, dodged: true };
    var dmg = Math.max(0, (attacker.atk || 0) - (defender.def || 0));
    var crit = rng() * 100 < ((attacker.crit || 0) + (attacker.luk || 0) * 0.2);
    if (crit) dmg = Math.round(dmg * 1.75);
    return { dmg: dmg, crit: crit, dodged: false };
  }
```
导出加 `attack: attack,`。
- [ ] **Step 4: 通过**
- [ ] **Step 5: 提交** `git commit -m "feat(farm): attack 伤害/暴击/闪避"`（先 `git add` 两文件）

---

## Task 4: resolveRound —— 一回合双方出手

- [ ] **Step 1: 追加失败测试**:
```js
test('resolveRound：敏捷高者先手，双方各一击', () => {
  const p = { atk: 100, def: 50, agi: 20, crit: 0, eva: 0, luk: 0 };
  const m = { atk: 10, def: 5, agi: 5, crit: 0, eva: 0, luk: 0 };
  const r = C.resolveRound(p, 200, m, 30, () => 0.99);
  assert.strictEqual(r.log[0].who, 'p', '玩家敏捷高先手');
  assert.strictEqual(r.monDead, true, '100-5=95 一击秒 30 血怪');
  // 怪先死则不再挨怪的反击
  assert.strictEqual(r.playerHp, 200);
});

test('resolveRound：碾压时玩家 0 伤害（安全刷）', () => {
  const p = { atk: 100, def: 999, agi: 20, crit: 0, eva: 0, luk: 0 };
  const m = { atk: 10, def: 5, agi: 5, crit: 0, eva: 0, luk: 0 };
  const r = C.resolveRound(p, 200, m, 1000, () => 0.99);
  assert.strictEqual(r.playerHp, 200, '怪 atk<玩家 def → 0 伤害');
});
```

- [ ] **Step 2: 失败**
- [ ] **Step 3: 实现**（导出）:
```js
  // 一回合：敏捷高者先手，双方各出手一次；先手打死对方则后手不出。纯函数。
  // 返回 { playerHp, monHp, log:[{who,dmg,crit,dodged}], monDead, playerDead }。
  function resolveRound(player, playerHp, mon, monHp, rng) {
    rng = rng || Math.random;
    var log = [];
    var order = (player.agi >= mon.agi) ? ['p', 'm'] : ['m', 'p'];
    for (var i = 0; i < order.length; i++) {
      if (playerHp <= 0 || monHp <= 0) break;
      if (order[i] === 'p') {
        var a = attack(player, mon, rng);
        monHp -= a.dmg; log.push({ who: 'p', dmg: a.dmg, crit: a.crit, dodged: a.dodged });
      } else {
        var b = attack(mon, player, rng);
        playerHp -= b.dmg; log.push({ who: 'm', dmg: b.dmg, crit: b.crit, dodged: b.dodged });
      }
    }
    return { playerHp: playerHp, monHp: monHp, log: log, monDead: monHp <= 0, playerDead: playerHp <= 0 };
  }
```
导出加 `resolveRound: resolveRound,`。
- [ ] **Step 4: 通过**
- [ ] **Step 5: 提交** `git commit -m "feat(farm): resolveRound 一回合结算"`

---

## Task 5: rollDrops —— 击杀掉落

- [ ] **Step 1: 追加失败测试**:
```js
test('rollDrops：XP/金币按档，boss 更多且掉 core 类', () => {
  const mob = C.rollDrops('dead_tuple', 0, () => 0); // 档1 normal, rng=0 必掉材料
  assert.strictEqual(mob.xp, C.DROP_XP[1]);
  assert.strictEqual(mob.mats.entropy_dust, 1);
  const boss = C.rollDrops('lock_lord', 0, () => 0); // 档1 boss
  assert.strictEqual(boss.xp, C.DROP_XP[1] * 5);
  assert.ok(boss.coins > mob.coins);
  assert.ok(boss.mats.txn_soul >= 1, 'boss 额外掉事务魂');
});

test('rollDrops：低幸运可能不掉材料', () => {
  const r = C.rollDrops('dead_tuple', 0, () => 0.99); // rng 高 → 不过掉率
  assert.ok(!r.mats.entropy_dust);
});
```

- [ ] **Step 2: 失败**
- [ ] **Step 3: 实现**（导出）:
```js
  // 击杀掉落。纯函数。boss XP×5、金币×6、材料 2-3 个 + 额外 txn_soul。
  function rollDrops(key, luk, rng) {
    rng = rng || Math.random;
    var m = MONSTERS[key], boss = m.role === 'boss';
    var xp = DROP_XP[m.tier] * (boss ? 5 : 1);
    var coins = Math.round(DROP_COIN[m.tier] * (boss ? 6 : 1) * (0.8 + rng() * 0.4));
    var mats = {};
    var chance = 0.6 + (luk || 0) * 0.003;
    var n = boss ? 2 + Math.floor(rng() * 2) : 1;
    for (var i = 0; i < n; i++) if (rng() < chance) mats[m.mat] = (mats[m.mat] || 0) + 1;
    if (boss) mats.txn_soul = (mats.txn_soul || 0) + 1;
    return { xp: xp, coins: coins, mats: mats };
  }
```
导出加 `rollDrops: rollDrops,`。
- [ ] **Step 4: 通过**
- [ ] **Step 5: 提交** `git commit -m "feat(farm): rollDrops 击杀掉落"`

---

## Task 6: settleOffline —— 离线战斗结算

- [ ] **Step 1: 追加失败测试**:
```js
test('settleOffline：安全怪跑满不死并累计击杀', () => {
  // 高等级主角 vs 档1 怪 → 0 伤害，安全刷
  const battle = { mob: 'dead_tuple', hp: 9999, last: 0 };
  const r = C.settleOffline(battle, 40, C.DEFAULT_WEAPON, C.BATTLE_TICK_MS * 50, () => 0.5);
  assert.ok(r.kills > 0, '应有击杀');
  assert.strictEqual(r.dead, false);
  assert.ok(r.xp > 0 && r.hp > 0);
  assert.strictEqual(r.last, C.BATTLE_TICK_MS * 50);
});

test('settleOffline：危险怪打到战死即停', () => {
  // 低等级主角 vs 档6 boss → 必死
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
```

- [ ] **Step 2: 失败**
- [ ] **Step 3: 实现**（导出）:
```js
  // 离线结算：按墙钟补打回合（封顶 OFFLINE_CAP），累计击杀掉落；战死则停。纯函数。
  // battle = { mob, hp, last }（hp=主角当前血）。返回增量 { kills, xp, coins, mats, hp, dead, last }。
  function settleOffline(battle, playerLevel, weapon, now, rng) {
    rng = rng || Math.random;
    var rounds = Math.min(OFFLINE_CAP, Math.floor((now - (battle.last || now)) / BATTLE_TICK_MS));
    var ps = playerStats(playerLevel, weapon);
    var mon = monsterStats(battle.mob);
    var hp = battle.hp, monHp = mon.hp;
    var kills = 0, xp = 0, coins = 0, mats = {}, dead = false;
    for (var r = 0; r < rounds; r++) {
      var res = resolveRound(ps, hp, mon, monHp, rng);
      hp = res.playerHp; monHp = res.monHp;
      if (res.playerDead) { dead = true; hp = 0; break; }
      if (res.monDead) {
        kills++;
        var d = rollDrops(battle.mob, ps.luk, rng);
        xp += d.xp; coins += d.coins;
        for (var k in d.mats) mats[k] = (mats[k] || 0) + d.mats[k];
        monHp = mon.hp;
      }
    }
    return { kills: kills, xp: xp, coins: coins, mats: mats, hp: hp, dead: dead, last: now };
  }
```
导出加 `settleOffline: settleOffline,`。
- [ ] **Step 4: 通过**
- [ ] **Step 5: 提交** `git commit -m "feat(farm): settleOffline 离线战斗结算"`

---

## Task 7: migrateCombat —— 存档字段

- [ ] **Step 1: 追加失败测试**:
```js
test('migrateCombat 补默认、不丢旧数据', () => {
  const s = { coins: 100 };
  C.migrateCombat(s);
  assert.deepStrictEqual(s.mats, {});
  assert.strictEqual(s.battle, null);
  assert.deepStrictEqual(s.mobDex, {});
  assert.strictEqual(s.coins, 100);
  const s2 = { mats: { page_scrap: 3 }, battle: { mob: 'deadlock', hp: 5, last: 1 }, mobDex: { deadlock: 2 } };
  C.migrateCombat(s2);
  assert.strictEqual(s2.mats.page_scrap, 3, '不覆盖已有');
  assert.strictEqual(s2.battle.mob, 'deadlock');
});
```
- [ ] **Step 2: 失败**
- [ ] **Step 3: 实现**（导出）:
```js
  function migrateCombat(s) {
    if (!s.mats || typeof s.mats !== 'object') s.mats = {};
    if (typeof s.battle === 'undefined') s.battle = null;
    if (!s.mobDex || typeof s.mobDex !== 'object') s.mobDex = {};
  }
```
导出加 `migrateCombat: migrateCombat,`。
- [ ] **Step 4: 通过**
- [ ] **Step 5: 提交** `git commit -m "feat(farm): migrateCombat 存档迁移"`

---

## Task 8: 接入 index.html + farm.js（引用/状态/迁移/离线结算）

**Files:** Modify `skins/db-console/index.html`, `skins/db-console/farm.js`

**先读 farm.js** 定位锚点。复用：`state`、`freshState()`、`load()`、`render()`（有 `now`/`dirty`）、`earn(n)`、`levelInfo()`、`gainFish` 附近的 `save`/`saveSoon`、`Fishing` 引用（作参照）。

- [ ] **Step 1: index.html 在 farm.js 前加载 combat.js**
把 `<script src="/fishing.js"></script>` 之后、`<script src="/farm.js"></script>` 之前插入：
```html
<script src="/combat.js"></script>
```

- [ ] **Step 2: farm.js 顶部引用**（`var Fishing = window.Fishing;` 附近）加：
```js
  var Combat = window.Combat;
```

- [ ] **Step 3: freshState 增字段**（在钓鱼字段附近）：
```js
      mats: {}, battle: null, mobDex: {},
```

- [ ] **Step 4: load() 末尾迁移**（现有 `Fishing.migrateFishing(...)` 之后）加：
```js
    Combat.migrateCombat(state);
```

- [ ] **Step 5: render() 里离线结算**（现有 `Fishing.settleReclaim(...)` 块之后）加：
```js
    if (state.battle) {
      var bo = Combat.settleOffline(state.battle, levelInfo().lvl, Combat.DEFAULT_WEAPON, now);
      if (bo.kills > 0 || bo.dead) {
        state.xp += bo.xp; earn(bo.coins);
        for (var mk in bo.mats) state.mats[mk] = (state.mats[mk] || 0) + bo.mats[mk];
        state.mobDex[state.battle.mob] = (state.mobDex[state.battle.mob] || 0) + bo.kills;
        if (bo.dead) { state.battle = null; toast(state.real ? '主角战死，已撤离' : 'instance evicted'); }
        else { state.battle.hp = bo.hp; }
        state.battle && (state.battle.last = bo.last);
        dirty = true;
      } else {
        state.battle.last = bo.last;
      }
    }
```
> 说明：`levelInfo()` 是现有等级函数；`toast` 现有。离线只在存在 `state.battle` 时结算；战死清空 battle（回卡牌墙）。

- [ ] **Step 6: 验证**
```bash
node --check skins/db-console/farm.js && node --check skins/db-console/combat.js
DOCS_PORTAL_SKIN=db-console DOCS_PORTAL_PORT=8099 node server.js  # 另起
```
`curl -s http://127.0.0.1:8099/combat.js | head -c 40`（UMD 头）、`curl -s http://127.0.0.1:8099/ | grep -c combat.js`（≥1）。杀掉服务。
`node --test "test/*.test.js"` 全绿。
- [ ] **Step 7: 提交** `git add skins/db-console/index.html skins/db-console/farm.js && git commit -m "feat(farm): 接入 combat 模块 + 离线战斗结算"`

---

## Task 9: 副本卡牌墙（选怪）

**Files:** Modify `skins/db-console/farm.js`, `skins/db-console/farm.css`

- [ ] **Step 1: TABS 加副本分区**（`stats` 之前）：
```js
    { id: 'raid',  job: 'advisories', name: '副本' },
```

- [ ] **Step 2: 加渲染函数**（`pondTab` 附近）：
```js
  // 怪物「脸」：游戏模式立绘 <img>（onerror 回退 emoji），伪装模式不出图。
  function mobFace(key) {
    if (!state.real) return '';
    var m = Combat.MONSTERS[key];
    var emoji = m.role === 'boss' ? '\u{1F479}' : '\u{1F47E}';
    return '<img class="mob-face" src="/mobs/' + key + '.webp" alt="" loading="lazy" decoding="async"'
      + ' onerror="this.replaceWith(document.createTextNode(\'' + emoji + '\'))">';
  }
  function mobName(key) { var m = Combat.MONSTERS[key]; return state.real ? m.name : m.job; }

  function raidTab() {
    var lvl = levelInfo().lvl;
    var cards = Combat.MON_KEYS.map(function (k) {
      var m = Combat.MONSTERS[k], st = Combat.monsterStats(k);
      var unlocked = Combat.monsterUnlocked(k, lvl);
      var mat = Combat.MATERIALS[m.mat];
      if (!unlocked) {
        return '<div class="mob-card mob-lock"><div class="mob-pic">?</div>'
          + '<div class="mob-nm">' + esc(mobName(k)) + '</div>'
          + '<div class="mob-sub">Lv.' + st.level + '</div></div>';
      }
      return '<div class="mob-card' + (m.role === 'boss' ? ' mob-boss' : '') + '" data-fight="' + k + '">'
        + '<div class="mob-pic">' + (state.real ? (mobFace(k) || (m.role === 'boss' ? '\u{1F479}' : '\u{1F47E}')) : '▪') + '</div>'
        + '<div class="mob-nm">' + esc(mobName(k)) + '</div>'
        + '<div class="mob-sub">Lv.' + st.level + ' · HP ' + st.hp
        + ' · ' + esc(state.real ? mat.name : mat.job) + '</div></div>';
    }).join('');
    return '<div class="pad"><div class="kb-hint">'
      + (state.real ? '点一张怪卡进入挂机战斗；打远低于自己等级的怪最安全。' : 'select an advisory to auto-resolve.')
      + '</div><div class="mob-grid">' + cards + '</div></div>';
  }
```

- [ ] **Step 3: render() 分派**（body 三元链里，`raid` 分支）：
```js
      : state.tab === 'raid' ? (state.battle ? battleView() : raidTab())
```
> `battleView` 在 Task 10 定义；本任务可先临时 `function battleView(){return raidTab();}` 占位，Task 10 替换。

- [ ] **Step 4: onMainClick 选怪进战斗**（`data-plot` 之后）：
```js
    var fb = e.target.closest ? e.target.closest('[data-fight]') : null;
    if (fb) { enterBattle(fb.getAttribute('data-fight')); return; }
```
并加进战斗的函数（Task 10 会用到 startBattleTimer；本任务先建立 state.battle）：
```js
  function enterBattle(key) {
    var ps = Combat.playerStats(levelInfo().lvl, Combat.DEFAULT_WEAPON);
    state.battle = { mob: key, hp: ps.hp, monHp: Combat.monsterStats(key).hp,
      kills: 0, log: [], last: Date.now() };
    save(); redraw();
  }
```

- [ ] **Step 5: farm.css 追加**：
```css
/* ---- 副本卡牌 ---- */
.mob-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin-top: 6px; }
.mob-card { border: 1px solid var(--border); border-radius: 8px; padding: 8px 6px; text-align: center; cursor: pointer;
  background: var(--surface); transition: border-color .12s; }
.mob-card:hover { border-color: var(--accent); }
.mob-card.mob-lock { opacity: .45; cursor: default; }
.mob-card.mob-boss { border-color: #b06bff; }
.mob-pic { height: 56px; display: flex; align-items: center; justify-content: center; font-size: 34px; }
.mob-face { max-width: 56px; max-height: 56px; object-fit: contain; }
.mob-nm { font-size: 12px; color: var(--fg); margin-top: 4px; }
.mob-sub { font-size: 10px; color: var(--muted); margin-top: 2px; }
```

- [ ] **Step 6: 验证** `node --check skins/db-console/farm.js`；起服务进副本分区，看卡牌墙渲染、未解锁灰显、点已解锁卡进入（占位）战斗视图、无控制台报错（UI 细节 Task 10 完善）。
- [ ] **Step 7: 提交** `git add skins/db-console/farm.js skins/db-console/farm.css && git commit -m "feat(farm): 副本卡牌墙选怪"`

---

## Task 10: 对战视图 + 战斗定时器 + 退出/战死

**Files:** Modify `skins/db-console/farm.js`, `skins/db-console/farm.css`

- [ ] **Step 1: battleView 渲染**（替换 Task 9 的占位）：
```js
  function hpBar(cur, max, cls) {
    var pct = Math.max(0, Math.min(100, cur / max * 100));
    return '<div class="hpbar"><span class="hpfill ' + cls + '" style="width:' + pct.toFixed(1) + '%"></span>'
      + '<span class="hptxt">' + Math.max(0, Math.round(cur)) + '/' + max + '</span></div>';
  }
  function battleView() {
    var b = state.battle, lvl = levelInfo().lvl;
    var ps = Combat.playerStats(lvl, Combat.DEFAULT_WEAPON);
    var mon = Combat.monsterStats(b.mob);
    var scene = state.real ? '<div class="arena" style="background-image:url(/arena.webp),linear-gradient(160deg,#141821,#0c0f16)"></div>' : '';
    var logHtml = (b.log || []).slice(-8).map(function (l) {
      var who = l.who === 'p' ? (state.real ? '你' : 'job') : mobName(b.mob);
      var t = l.dodged ? (state.real ? ' 未命中' : ' miss')
        : (state.real ? ' 造成 ' : ' -') + l.dmg + (l.crit ? (state.real ? ' 暴击!' : '!') : '');
      return '<div class="blog-line">' + esc(who + t) + '</div>';
    }).join('');
    return '<div class="pad">' + scene
      + '<div class="battle">'
      + '<div class="fighter"><div class="f-pic hero">' + (state.real ? '\u{1F9B8}' : 'me') + '</div>'
      + '<div class="f-nm">' + (state.real ? '维护者 Lv.' + lvl : 'worker') + '</div>' + hpBar(b.hp, ps.hp, 'hp-p') + '</div>'
      + '<div class="vs">VS</div>'
      + '<div class="fighter"><div class="f-pic">' + (state.real ? (mobFace(b.mob) || '\u{1F47E}') : '▪') + '</div>'
      + '<div class="f-nm">' + esc(mobName(b.mob)) + '</div>' + hpBar(b.monHp, mon.hp, 'hp-m') + '</div>'
      + '</div>'
      + '<div class="blog">' + logHtml + '</div>'
      + '<div class="kb-hint">' + (state.real ? '击杀 ' : 'resolved ') + b.kills
      + ' · ' + (state.real ? '血不回，退出才回满' : 'hp persists') + '</div>'
      + '<div class="kb-tools"><button class="btn" data-act="flee">' + (state.real ? '退出（回满血）' : 'exit') + '</button></div>'
      + '</div>';
  }
```

- [ ] **Step 2: 战斗定时器**（一回合/400ms，独立于 render 的 1s tick）：
```js
  var battleTimer = null;
  function startBattleTimer() {
    stopBattleTimer();
    battleTimer = setInterval(battleTick, Combat.BATTLE_TICK_MS);
  }
  function stopBattleTimer() { if (battleTimer) { clearInterval(battleTimer); battleTimer = null; } }

  var STALL_ROUNDS = 300;
  function battleTick() {
    var b = state.battle;
    if (!b || !mainEl || state.tab !== 'raid') { stopBattleTimer(); return; }
    var ps = Combat.playerStats(levelInfo().lvl, Combat.DEFAULT_WEAPON);
    var mon = Combat.monsterStats(b.mob);
    var prevMonHp = b.monHp;
    var res = Combat.resolveRound(ps, b.hp, mon, b.monHp, Math.random);
    b.hp = res.playerHp; b.monHp = res.monHp;
    b.log = (b.log || []).concat(res.log).slice(-20);
    // 僵局保护：连续 STALL_ROUNDS 回合打不动怪（monHp 没降且没死）＝打不过，自动退出。
    if (!res.monDead && b.monHp >= prevMonHp) b.stall = (b.stall || 0) + 1; else b.stall = 0;
    if (b.stall >= STALL_ROUNDS) {
      state.battle = null; toast(state.real ? '打不动，已撤离' : 'stalemate — evicted');
      stopBattleTimer(); save(); redraw(); return;
    }
    if (res.playerDead) { // 战死：回满、撤回卡牌墙
      state.battle = null; toast(state.real ? '主角战死，已撤离' : 'evicted');
      stopBattleTimer(); save(); redraw(); return;
    }
    if (res.monDead) {
      b.kills++;
      var d = Combat.rollDrops(b.mob, ps.luk, Math.random);
      state.xp += d.xp; earn(d.coins);
      for (var k in d.mats) state.mats[k] = (state.mats[k] || 0) + d.mats[k];
      state.mobDex[b.mob] = (state.mobDex[b.mob] || 0) + 1;
      b.monHp = mon.hp; // 同种重生
    }
    b.last = Date.now();
    saveSoon();
    // 只重绘对战容器，避免每 tick 整屏重画
    var host = mainEl.querySelector('.farm-wrap');
    if (host) host.innerHTML = battleView();
  }
```
> 注：`render()` 每秒也会重绘（渲染 battleView 当前态），二者都从 `state.battle` 出发，数据一致；战斗定时器负责 400ms 的顺滑推进。

- [ ] **Step 3: 挂载/卸载与进入/退出接线**
- `enterBattle`（Task 9）末尾加：`startBattleTimer();`
- `onMainClick` 的 `data-act` 链加：
```js
    else if (act === 'flee') { state.battle = null; stopBattleTimer(); }
```
（其后现有 `redraw()` 会回卡牌墙、回满血——因为 HP 每次 `enterBattle` 用满血重建。）
- farm 的 `unmount()`（切离 Queues 分区）里加 `stopBattleTimer();`，`mount()` 里若 `state.battle && state.tab==='raid'` 则 `startBattleTimer();`。
- render() 里：进入 raid 且有 battle 时若定时器没跑则启动（防呆）：在 render 末尾加
```js
    if (state.tab === 'raid' && state.battle && !battleTimer) startBattleTimer();
    if ((state.tab !== 'raid' || !state.battle) && battleTimer) stopBattleTimer();
```

- [ ] **Step 4: farm.css 追加**：
```css
/* ---- 对战 ---- */
.arena { height: 84px; border-radius: 6px; margin-bottom: 8px; background-size: cover; background-position: center; border: 1px solid var(--border); }
.battle { display: flex; align-items: center; justify-content: space-around; gap: 8px; }
.fighter { flex: 1; text-align: center; }
.f-pic { height: 64px; display: flex; align-items: center; justify-content: center; font-size: 40px; }
.f-pic img { max-width: 64px; max-height: 64px; object-fit: contain; }
.f-nm { font-size: 12px; color: var(--fg); margin: 2px 0 4px; }
.vs { color: var(--muted); font-size: 12px; }
.hpbar { position: relative; height: 12px; border-radius: 6px; background: #2a2a2a; overflow: hidden; }
.hpfill { position: absolute; inset: 0 auto 0 0; height: 100%; }
.hpfill.hp-p { background: #3ecf8e; } .hpfill.hp-m { background: #e0603e; }
.hptxt { position: relative; font-size: 9px; line-height: 12px; color: #eaeaea; text-shadow: 0 0 2px #000; }
.blog { margin: 8px 0; max-height: 130px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; padding: 6px; }
.blog-line { font: 11px/1.6 var(--font-mono); color: var(--muted); }
```

- [ ] **Step 5: 验证**：起服务，副本→点怪进战斗：血条动、日志滚、杀怪重生、金币/材料涨（看 localStorage `dbconsole.farm.v3` 的 `mats`）、退出回满回卡牌墙、切走分区战斗定时器停（不再后台跑到崩）。切 🌱 伪装：无图、黑话日志。`node --test "test/*.test.js"` 全绿。
- [ ] **Step 6: 提交** `git add skins/db-console/farm.js skins/db-console/farm.css && git commit -m "feat(farm): 对战视图 + 回合定时器 + 退出/战死"`

---

## Task 11: 美术接入（放图 + 主角/背景，缺图已回退）

> `mobFace`/`arena`/`hero` 的缺图回退已在 Task 9/10 写好（emoji / 渐变）。本任务放实际图并验证。

**Files:** Create `skins/db-console/mobs/<key>.webp` ×36、`hero.webp`、`arena.webp`（AI 生成后放入）

- [ ] **Step 1** 按 `docs/superpowers/specs/2026-09-02-combat-art-prompts.md` 出图；怪存 `skins/db-console/mobs/<key>.webp`（key 见 combat.js），主角 `skins/db-console/hero.webp`，背景 `skins/db-console/arena.webp`。
- [ ] **Step 2** 起服务确认 `curl -sI http://127.0.0.1:8099/mobs/deadlock.webp` → 200 + `image/webp`（webp MIME/缓存已在钓鱼阶段就绪）。
- [ ] **Step 3** 游戏模式看副本卡牌与对战：有图显图、无图 emoji/渐变；伪装模式无图。控制台无报错。
- [ ] **Step 4: 提交** `git add skins/db-console/mobs skins/db-console/hero.webp skins/db-console/arena.webp && git commit -m "assets(farm): 怪物/主角/背景立绘"`
> 注：主角对战立绘目前只用 emoji 占位（battleView 的 hero 处用了 🦸）；如需换成 hero.webp，可在 battleView 的 `.f-pic.hero` 处替换为 `<img onerror>`——本期先 emoji，图到了再接（小改，可并入本任务）。

---

## 全量回归
- [ ] `node --test test/combat.test.js` 全绿；`node --test "test/*.test.js"` 无回归（含钓鱼/lib/server）。
- [ ] `node --check` farm.js/combat.js/server.js。
- [ ] 人工过：选怪→战斗→掉落→退出→战死→离线结算→伪装切换→切分区停定时器。

## 自检对照 spec
- 36 怪 6 档×6：Task 1 + 测试。
- 属性派生 + 8 属性：Task 2。伤害/暴击/闪避：Task 3。回合/先手/秒杀不反击：Task 4。
- 碾压 0 伤害安全刷 / 势均力敌分胜负：Task 4 测试。
- 掉落 XP/金币/材料、boss 加成：Task 5。离线结算 + cap + 战死停：Task 6。
- 副本卡牌墙 + 选怪 + 解锁灰显：Task 9。对战视图 + 血条 + 日志 + 退出 + 战死几乎无惩罚（回满）：Task 10。
- 血不回跨杀、退出回满：Task 10（enterBattle 满血、flee 清 battle）。
- 材料只囤（state.mats）：Task 5/8/10。共用等级：Task 8（state.xp）。
- 立绘/背景 + 缺图回退 + 伪装不出图：Task 9/10/11。
- 迁移：Task 7 + Task 8 Step 4。
