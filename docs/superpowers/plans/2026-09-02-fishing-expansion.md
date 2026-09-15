# 钓鱼系统扩充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把键盘农场的钓鱼从 8 种鱼扩成 6 钓点 × 5 稀有度共 48 种，独立成分区，加自动回收器与离线结算，并接入 AI 立绘/场景图。

**Architecture:** 钓鱼的纯数据+纯逻辑放进新的可单测 UMD 模块 `skins/db-console/fishing.js`（仿 `public/conceal-policy.js`）；`farm.js` 引入它，只做状态/DOM/渲染。不碰未接线的 `farm-data.js`。

**Tech Stack:** 原生 JS（浏览器 IIFE + UMD 模块）、Node 内置 `node --test`（现有测试风格，见 `test/conceal-policy.test.js`）、无构建。

配套 spec：`docs/superpowers/specs/2026-09-02-fishing-expansion-design.md`
出图 prompt：`docs/superpowers/specs/2026-09-02-fish-art-prompts.md`

---

## 文件结构

- **新建** `skins/db-console/fishing.js` — 纯数据（`FISH`/`SPOTS`/`RARITY`/`MATERIALS`）+ 纯逻辑（`rollFish`/`advanceCatch`/`settleReclaim`/`migrateFishing`），UMD 导出 `module.exports` 兼 `window.Fishing`。
- **新建** `test/fishing.test.js` — 上述模块的单测。
- **改** `skins/db-console/index.html` — 在 `farm.js` 前加载 `fishing.js`。
- **改** `skins/db-console/farm.js` — 引入 `Fishing`；替换旧 `FISH`/`FISH_CLICKS`；状态字段与默认；重写点击捞鱼；新增钓鱼分区渲染；仓库移除鱼行；立绘/场景渲染。
- **改** `skins/db-console/farm.css` — 钓鱼分区、钓点列表、图鉴、立绘、场景横幅样式。
- **新建目录** `skins/db-console/fish/`、`skins/db-console/scenes/` — 放 AI 生成的图（本计划不产图，接入时缺图有回退）。

约定：`fishing.js` 里的键（`eel`/`carp`/…/`eyeofages`）永不改；旧 8 鱼的 `job` 与 `price` 保持不变。

---

## Task 1: fishing.js 数据模块骨架 + 全数据表

**Files:**
- Create: `skins/db-console/fishing.js`
- Test: `test/fishing.test.js`

- [ ] **Step 1: 写失败测试**（数据完整性）

`test/fishing.test.js`:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const F = require('../skins/db-console/fishing.js');

test('48 种鱼，6 钓点各 8 种', () => {
  assert.strictEqual(F.FISH_KEYS.length, 48);
  F.SPOT_KEYS.forEach((sp) => {
    const n = F.FISH_KEYS.filter((k) => F.FISH[k].spot === sp).length;
    assert.strictEqual(n, 8, sp + ' 应有 8 种鱼，实为 ' + n);
  });
});

test('每条鱼字段合法', () => {
  F.FISH_KEYS.forEach((k) => {
    const f = F.FISH[k];
    assert.ok(f.name && f.job && f.emoji, k + ' 缺名字/黑话/emoji');
    assert.ok(F.SPOTS[f.spot], k + ' 的 spot 非法');
    assert.ok(F.RARITY[f.rarity], k + ' 的 rarity 非法');
    assert.ok(F.MATERIALS[f.mat], k + ' 的 mat 非法');
    assert.ok(f.price > 0, k + ' 售价应为正');
  });
});

test('旧 8 鱼的 key/job/price 原样保留（存档兼容）', () => {
  const legacy = {
    eel: ['wal_seg', 30], carp: ['temp_file', 45], koi: ['orphan_seg', 90],
    squid: ['toast_chunk', 180], puffer: ['bloat_page', 340],
    dolphin: ['lost_xlog', 900], orca: ['cold_backup', 2600], whale: ['full_dump', 9000],
  };
  Object.keys(legacy).forEach((k) => {
    assert.ok(F.FISH[k], '旧鱼 ' + k + ' 不能丢');
    assert.strictEqual(F.FISH[k].job, legacy[k][0], k + ' job 变了');
    assert.strictEqual(F.FISH[k].price, legacy[k][1], k + ' price 变了');
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `node --test test/fishing.test.js`
Expected: FAIL（`Cannot find module '../skins/db-console/fishing.js'`）

- [ ] **Step 3: 写模块**（数据部分）

`skins/db-console/fishing.js`:
```js
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Fishing = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 稀有度：池内权重 + 文案。越稀有权重越低。
  var RARITY = {
    common:    { name: '常见', job: 'common',    weight: 1000 },
    uncommon:  { name: '少见', job: 'uncommon',  weight: 350 },
    rare:      { name: '稀有', job: 'rare',      weight: 90 },
    epic:      { name: '史诗', job: 'epic',      weight: 20 },
    legendary: { name: '传说', job: 'legendary', weight: 3 },
  };

  // 材料类型（给锻造留的钩子，本期只带标签）。
  var MATERIALS = {
    seg:   { name: '段料', job: 'seg_scrap' },
    crys:  { name: '晶体', job: 'idx_crystal' },
    ess:   { name: '精华', job: 'wal_essence' },
    shell: { name: '甲壳', job: 'toast_shell' },
    dust:  { name: '尘',   job: 'bloat_dust' },
    core:  { name: '核心', job: 'ckpt_core' },
  };

  // 钓点：解锁金币、单次点击成本、自动回收间隔。order 决定展示与解锁顺序。
  var SPOTS = {
    wal_buffer:   { name: 'WAL 缓冲区', job: 'wal_buffer',   order: 1, unlock: 0,      clickCost: 60,  reclaimMs: 90000 },
    temp_lake:    { name: '临时文件湖', job: 'temp_lake',    order: 2, unlock: 3000,   clickCost: 75,  reclaimMs: 110000 },
    toast_lake:   { name: 'TOAST 深湖', job: 'toast_lake',   order: 3, unlock: 12000,  clickCost: 95,  reclaimMs: 140000 },
    cold_archive: { name: '冷备份归档', job: 'cold_archive', order: 4, unlock: 40000,  clickCost: 120, reclaimMs: 180000 },
    repl_stream:  { name: '复制流',     job: 'repl_stream',  order: 5, unlock: 90000,  clickCost: 150, reclaimMs: 220000 },
    pitr_abyss:   { name: 'PITR 深渊',  job: 'pitr_abyss',   order: 6, unlock: 200000, clickCost: 200, reclaimMs: 300000 },
  };
  var SPOT_KEYS = ['wal_buffer', 'temp_lake', 'toast_lake', 'cold_archive', 'repl_stream', 'pitr_abyss'];

  // 鱼：{name, job(黑话), emoji(兜底), spot, rarity, price, mat}。key 永不改。
  var FISH = {
    // 钓点 1 · WAL 缓冲区
    eel:        { name: '鳗鱼',     job: 'wal_seg',        emoji: '\u{1F344}', spot: 'wal_buffer', rarity: 'common',   price: 30,  mat: 'seg' },
    husk:       { name: '腐骸鱼',   job: 'dead_tuple',     emoji: '\u{1F41F}', spot: 'wal_buffer', rarity: 'common',   price: 28,  mat: 'dust' },
    chip:       { name: '碎屑鳉',   job: 'spill_sort',     emoji: '\u{1F41F}', spot: 'wal_buffer', rarity: 'common',   price: 26,  mat: 'dust' },
    silverdace: { name: '银鲦',     job: 'bgwriter_flush', emoji: '\u{1F41F}', spot: 'wal_buffer', rarity: 'common',   price: 34,  mat: 'seg' },
    crackcarp:  { name: '裂纹鲤',   job: 'checksum_fail',  emoji: '\u{1F420}', spot: 'wal_buffer', rarity: 'uncommon', price: 70,  mat: 'crys' },
    courier:    { name: '信使鳗',   job: 'logical_msg',    emoji: '\u{1F40D}', spot: 'wal_buffer', rarity: 'uncommon', price: 95,  mat: 'ess' },
    lampfish:   { name: '灯花鱼',   job: 'notify_signal',  emoji: '\u{1F41F}', spot: 'wal_buffer', rarity: 'uncommon', price: 80,  mat: 'ess' },
    lurker:     { name: '幽灯鮟鱇', job: 'lock_wait',      emoji: '\u{1F38F}', spot: 'wal_buffer', rarity: 'rare',     price: 180, mat: 'crys' },
    // 钓点 2 · 临时文件湖
    carp:        { name: '鲫鱼',     job: 'temp_file',     emoji: '\u{1F41F}', spot: 'temp_lake', rarity: 'common',   price: 45,  mat: 'dust' },
    koi:         { name: '锦鲤',     job: 'orphan_seg',    emoji: '\u{1F420}', spot: 'temp_lake', rarity: 'uncommon', price: 90,  mat: 'seg' },
    loach:       { name: '泥鳅',     job: 'sort_spill',    emoji: '\u{1F41F}', spot: 'temp_lake', rarity: 'common',   price: 40,  mat: 'dust' },
    overflowcat: { name: '溢流鲶',   job: 'hash_spill',    emoji: '\u{1F41F}', spot: 'temp_lake', rarity: 'common',   price: 48,  mat: 'dust' },
    glassfish:   { name: '玻璃鱼',   job: 'temp_relation', emoji: '\u{1F41F}', spot: 'temp_lake', rarity: 'uncommon', price: 85,  mat: 'crys' },
    sandturtle:  { name: '沉沙鳖',   job: 'stat_temp',     emoji: '\u{1F422}', spot: 'temp_lake', rarity: 'uncommon', price: 100, mat: 'shell' },
    mimicocto:   { name: '拟态章鱼', job: 'temp_toast',    emoji: '\u{1F419}', spot: 'temp_lake', rarity: 'rare',     price: 200, mat: 'shell' },
    lakewraith:  { name: '湖心游魂', job: 'abandoned_txn', emoji: '\u{1F47B}', spot: 'temp_lake', rarity: 'rare',     price: 240, mat: 'ess' },
    // 钓点 3 · TOAST 深湖
    squid:       { name: '鱿鱼',     job: 'toast_chunk',     emoji: '\u{1F991}', spot: 'toast_lake', rarity: 'uncommon', price: 180, mat: 'shell' },
    puffer:      { name: '河豚',     job: 'bloat_page',      emoji: '\u{1F421}', spot: 'toast_lake', rarity: 'uncommon', price: 340, mat: 'dust' },
    scaleturtle: { name: '甲鳞龟',   job: 'large_object',    emoji: '\u{1F422}', spot: 'toast_lake', rarity: 'rare',     price: 260, mat: 'shell' },
    loneshade:   { name: '深渊孤影', job: 'orphan_lob',      emoji: '\u{1F419}', spot: 'toast_lake', rarity: 'rare',     price: 300, mat: 'shell' },
    maw:         { name: '巨口鲸鲨', job: 'detoast_giant',   emoji: '\u{1F988}', spot: 'toast_lake', rarity: 'epic',     price: 600, mat: 'core' },
    stonefish:   { name: '石化古鱼', job: 'frozen_toast',    emoji: '\u{1F41F}', spot: 'toast_lake', rarity: 'rare',     price: 220, mat: 'crys' },
    hoardclam:   { name: '吞盘巨蚌', job: 'chunk_hoard',     emoji: '\u{1F9AA}', spot: 'toast_lake', rarity: 'epic',     price: 720, mat: 'core' },
    inkabyss:    { name: '墨渊乌贼', job: 'compressed_blob', emoji: '\u{1F991}', spot: 'toast_lake', rarity: 'rare',     price: 250, mat: 'shell' },
    // 钓点 4 · 冷备份归档
    frostbone:       { name: '冻骸鱼',   job: 'freeze_relic',     emoji: '\u{1F41F}', spot: 'cold_archive', rarity: 'rare',      price: 210,  mat: 'crys' },
    froststurgeon:   { name: '霜鳞鲟',   job: 'archived_wal',     emoji: '\u{1F41F}', spot: 'cold_archive', rarity: 'rare',      price: 280,  mat: 'seg' },
    asheel:          { name: '灰烬鳗',   job: 'vacuum_debris',    emoji: '\u{1F40D}', spot: 'cold_archive', rarity: 'uncommon',  price: 110,  mat: 'dust' },
    orca:            { name: '虎鲸',     job: 'cold_backup',      emoji: '\u{1F40B}', spot: 'cold_archive', rarity: 'epic',      price: 2600, mat: 'core' },
    ancientsturgeon: { name: '千年古鲟', job: 'ancient_snapshot', emoji: '\u{1F41F}', spot: 'cold_archive', rarity: 'epic',      price: 800,  mat: 'core' },
    sealedclam:      { name: '封印巨蚌', job: 'sealed_backup',    emoji: '\u{1F9AA}', spot: 'cold_archive', rarity: 'rare',      price: 320,  mat: 'shell' },
    snowcat:         { name: '雪盲白鲇', job: 'checksum_cold',    emoji: '\u{1F41F}', spot: 'cold_archive', rarity: 'rare',      price: 240,  mat: 'crys' },
    voidserpent:     { name: '归墟游龙', job: 'retention_ghost',  emoji: '\u{1F409}', spot: 'cold_archive', rarity: 'legendary', price: 3000, mat: 'core' },
    // 钓点 5 · 复制流
    streamsalmon:  { name: '溯流鲑',   job: 'logical_repl', emoji: '\u{1F41F}', spot: 'repl_stream', rarity: 'uncommon',  price: 120,  mat: 'ess' },
    twinjack:      { name: '双生鲹',   job: 'sync_replica', emoji: '\u{1F41F}', spot: 'repl_stream', rarity: 'rare',      price: 260,  mat: 'ess' },
    souljelly:     { name: '缠魂水母', job: 'deadlock_jelly', emoji: '\u{1F390}', spot: 'repl_stream', rarity: 'epic',    price: 700,  mat: 'ess' },
    voltele:       { name: '电鳗',     job: 'wal_sender',   emoji: '\u{1F40D}', spot: 'repl_stream', rarity: 'rare',      price: 300,  mat: 'ess' },
    ghostwalker:   { name: '幽灵行者', job: 'ghost_xact',   emoji: '\u{1F47B}', spot: 'repl_stream', rarity: 'rare',      price: 320,  mat: 'ess' },
    brokenserpent: { name: '断链海蛇', job: 'broken_slot',  emoji: '\u{1F40D}', spot: 'repl_stream', rarity: 'epic',      price: 640,  mat: 'core' },
    tidecourier:   { name: '洄游信使', job: 'decode_stream', emoji: '\u{1F41F}', spot: 'repl_stream', rarity: 'uncommon', price: 130,  mat: 'ess' },
    tidelord:      { name: '潮汐主宰', job: 'streaming_lag', emoji: '\u{1F419}', spot: 'repl_stream', rarity: 'legendary', price: 3400, mat: 'core' },
    // 钓点 6 · PITR 深渊
    dolphin:     { name: '海豚',     job: 'lost_xlog',        emoji: '\u{1F42C}', spot: 'pitr_abyss', rarity: 'rare',      price: 900,  mat: 'ess' },
    whale:       { name: '鲸鱼',     job: 'full_dump',        emoji: '\u{1F40B}', spot: 'pitr_abyss', rarity: 'legendary', price: 9000, mat: 'core' },
    backflow:    { name: '溯洄者',   job: 'pitr_snapshot',    emoji: '\u{1F41F}', spot: 'pitr_abyss', rarity: 'epic',      price: 1000, mat: 'core' },
    timewhale:   { name: '时之古鲸', job: 'point_in_time',    emoji: '\u{1F40B}', spot: 'pitr_abyss', rarity: 'legendary', price: 4200, mat: 'core' },
    annihilator: { name: '湮灭巨鲸', job: 'xid_wraparound',   emoji: '\u{1F40B}', spot: 'pitr_abyss', rarity: 'legendary', price: 6600, mat: 'core' },
    deepwhale:   { name: '深寒古鲸', job: 'archive_recovery', emoji: '\u{1F40B}', spot: 'pitr_abyss', rarity: 'epic',      price: 1200, mat: 'core' },
    voiddragon:  { name: '虚空游龙', job: 'lost_segment',     emoji: '\u{1F409}', spot: 'pitr_abyss', rarity: 'epic',      price: 1100, mat: 'core' },
    eyeofages:   { name: '万古之眼', job: 'wal_horizon',      emoji: '\u{1F441}', spot: 'pitr_abyss', rarity: 'legendary', price: 8000, mat: 'core' },
  };
  var FISH_KEYS = Object.keys(FISH);

  // 单次结算离线补的条数上限（防长期离线一次补爆）。
  var RECLAIM_CAP = 200;

  return {
    RARITY: RARITY, MATERIALS: MATERIALS, SPOTS: SPOTS, SPOT_KEYS: SPOT_KEYS,
    FISH: FISH, FISH_KEYS: FISH_KEYS, RECLAIM_CAP: RECLAIM_CAP,
  };
});
```

- [ ] **Step 4: 运行，确认通过**

Run: `node --test test/fishing.test.js`
Expected: PASS（3 个测试）

- [ ] **Step 5: 提交**

```bash
git add skins/db-console/fishing.js test/fishing.test.js
git commit -m "feat(farm): 钓鱼数据模块 fishing.js（48 鱼/6 钓点/5 稀有度）"
```

---

## Task 2: rollFish —— 按钓点鱼池的加权掷鱼

**Files:**
- Modify: `skins/db-console/fishing.js`
- Test: `test/fishing.test.js`

- [ ] **Step 1: 写失败测试**

在 `test/fishing.test.js` 追加：
```js
test('rollFish 只从该钓点鱼池出，且按稀有度权重', () => {
  // rng 恒返回 0 → 命中权重区间的第一条（池内 FISH_KEYS 顺序里第一条）
  const first = F.rollFish('wal_buffer', () => 0);
  assert.strictEqual(F.FISH[first].spot, 'wal_buffer');
  // 大样本：只会出该钓点的鱼
  let rng = mulberry32(42);
  for (let i = 0; i < 500; i++) {
    assert.strictEqual(F.FISH[F.rollFish('toast_lake', rng)].spot, 'toast_lake');
  }
  // 常见远多于传说
  rng = mulberry32(7);
  const cnt = {};
  for (let i = 0; i < 4000; i++) {
    const r = F.FISH[F.rollFish('pitr_abyss', rng)].rarity;
    cnt[r] = (cnt[r] || 0) + 1;
  }
  assert.ok((cnt.rare || 0) > (cnt.legendary || 0), '稀有应多于传说');
});

// 确定性 PRNG，供测试用
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 2: 运行，确认失败**

Run: `node --test test/fishing.test.js`
Expected: FAIL（`F.rollFish is not a function`）

- [ ] **Step 3: 实现 rollFish**

在 `fishing.js` 的 `return {...}` 之前加：
```js
  // 该钓点的鱼池（保持 FISH_KEYS 声明顺序，rng=0 稳定命中第一条）。
  function poolOf(spotId) {
    return FISH_KEYS.filter(function (k) { return FISH[k].spot === spotId; });
  }

  // 按稀有度权重从钓点鱼池掷一条，返回 fish key。rng 默认 Math.random，可注入。
  function rollFish(spotId, rng) {
    rng = rng || Math.random;
    var pool = poolOf(spotId);
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += RARITY[FISH[pool[i]].rarity].weight;
    var roll = rng() * total;
    for (i = 0; i < pool.length; i++) {
      roll -= RARITY[FISH[pool[i]].rarity].weight;
      if (roll < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
```
并在导出对象里加入 `poolOf: poolOf, rollFish: rollFish,`。

- [ ] **Step 4: 运行，确认通过**

Run: `node --test test/fishing.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add skins/db-console/fishing.js test/fishing.test.js
git commit -m "feat(farm): rollFish 按钓点鱼池加权掷鱼"
```

---

## Task 3: advanceCatch —— 点击累积到点出鱼

**Files:**
- Modify: `skins/db-console/fishing.js`
- Test: `test/fishing.test.js`

- [ ] **Step 1: 写失败测试**

```js
test('advanceCatch 累积到 clickCost 出一条并归零', () => {
  const spot = F.SPOTS.wal_buffer; // clickCost 60
  let prog = 0, caught = null, calls = 0;
  for (let i = 0; i < 60; i++) {
    const r = F.advanceCatch(prog, spot, { rng: () => 0 });
    prog = r.progress;
    if (r.caught) { caught = r.caught; calls++; }
  }
  assert.strictEqual(calls, 1, '60 次点击恰好出 1 条');
  assert.strictEqual(prog, 0, '出鱼后进度归零');
  assert.strictEqual(F.FISH[caught].spot, 'wal_buffer');
});

test('advanceCatch 未到点不出鱼', () => {
  const r = F.advanceCatch(10, F.SPOTS.wal_buffer, { rng: () => 0 });
  assert.strictEqual(r.caught, null);
  assert.strictEqual(r.progress, 11);
});

test('advanceCatch 猫加成：更少点击就出鱼', () => {
  const spot = F.SPOTS.wal_buffer; // 60 → 猫 /1.5 = 40
  const r = F.advanceCatch(39, spot, { cat: true, rng: () => 0 });
  assert.ok(r.caught, '猫在第 40 次点击出鱼');
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `node --test test/fishing.test.js`
Expected: FAIL（`F.advanceCatch is not a function`）

- [ ] **Step 3: 实现 advanceCatch**

在 `fishing.js` 加（并加入导出）：
```js
  // 一次点击推进钓鱼进度。到（受猫加成的）clickCost 就掷一条鱼、进度归零。
  // 纯函数：进出都用值，不碰全局状态。cfg: { rng, cat }。返回 { progress, caught }。
  // SPOTS 里每个钓点的 job 与其 key 相同（如 'wal_buffer'），故用 spot.job 当 spotId。
  function advanceCatch(progress, spot, cfg) {
    cfg = cfg || {};
    var per = spot.clickCost / (cfg.cat ? 1.5 : 1);
    var next = (progress || 0) + 1;
    if (next >= per) return { progress: 0, caught: rollFish(spot.job, cfg.rng) };
    return { progress: next, caught: null };
  }
```
导出加 `advanceCatch: advanceCatch,`。

- [ ] **Step 4: 运行，确认通过**

Run: `node --test test/fishing.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add skins/db-console/fishing.js test/fishing.test.js
git commit -m "feat(farm): advanceCatch 点击累积出鱼"
```

---

## Task 4: settleReclaim —— 自动回收器离线/被动结算

**Files:**
- Modify: `skins/db-console/fishing.js`
- Test: `test/fishing.test.js`

- [ ] **Step 1: 写失败测试**

```js
test('settleReclaim 按墙钟补出条数，受上限约束，猫加速', () => {
  const spot = F.SPOTS.wal_buffer; // reclaimMs 90000
  // 未购置自动回收器 → 不产
  let r = F.settleReclaim({ auto: false, last: 0, spotId: 'wal_buffer' }, 1e9, {});
  assert.strictEqual(r.caught.length, 0);
  // 购置后，elapsed = 3 个间隔 → 3 条，last 前移 3 个间隔
  r = F.settleReclaim({ auto: true, last: 0, spotId: 'wal_buffer' }, spot.reclaimMs * 3 + 10, { rng: () => 0 });
  assert.strictEqual(r.caught.length, 3);
  assert.strictEqual(r.last, spot.reclaimMs * 3);
  // 上限
  r = F.settleReclaim({ auto: true, last: 0, spotId: 'wal_buffer' }, spot.reclaimMs * 100000, { rng: () => 0 });
  assert.strictEqual(r.caught.length, F.RECLAIM_CAP);
  // 猫 +50% 速度 → 间隔 /1.5，同样时长补更多
  const base = F.settleReclaim({ auto: true, last: 0, spotId: 'wal_buffer' }, spot.reclaimMs * 4, { rng: () => 0 }).caught.length;
  const withCat = F.settleReclaim({ auto: true, last: 0, spotId: 'wal_buffer' }, spot.reclaimMs * 4, { rng: () => 0, cat: true }).caught.length;
  assert.ok(withCat > base, '猫应补更多');
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `node --test test/fishing.test.js`
Expected: FAIL（`F.settleReclaim is not a function`）

- [ ] **Step 3: 实现 settleReclaim**

在 `fishing.js` 加（并导出）：
```js
  // 自动回收器：按墙钟差在「当前钓点」补出若干鱼。纯函数。
  // st: { auto, last, spotId }；cfg: { rng, cat }。返回 { caught:[key...], last }。
  function settleReclaim(st, now, cfg) {
    cfg = cfg || {};
    if (!st.auto) return { caught: [], last: st.last };
    var spot = SPOTS[st.spotId] || SPOTS.wal_buffer;
    var iv = spot.reclaimMs / (cfg.cat ? 1.5 : 1);
    var elapsed = now - (st.last || 0);
    var n = Math.floor(elapsed / iv);
    if (n <= 0) return { caught: [], last: st.last };
    var last;
    if (n > RECLAIM_CAP) { n = RECLAIM_CAP; last = now; } // 溢出则把时钟对齐到现在，丢弃超额
    else last = (st.last || 0) + n * iv;
    var caught = [];
    for (var i = 0; i < n; i++) caught.push(rollFish(st.spotId, cfg.rng));
    return { caught: caught, last: last };
  }
```
导出加 `settleReclaim: settleReclaim,`。

- [ ] **Step 4: 运行，确认通过**

Run: `node --test test/fishing.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add skins/db-console/fishing.js test/fishing.test.js
git commit -m "feat(farm): settleReclaim 自动回收器离线结算"
```

---

## Task 5: migrateFishing —— 存档字段默认与迁移

**Files:**
- Modify: `skins/db-console/fishing.js`
- Test: `test/fishing.test.js`

- [ ] **Step 1: 写失败测试**

```js
test('migrateFishing 补默认字段、不丢旧鱼数据', () => {
  // 旧存档：有 pond 与旧鱼计数，但无新字段
  const s = { pond: true, fish: { eel: 5, whale: 1 }, clicks: 300 };
  F.migrateFishing(s, 12345);
  assert.strictEqual(s.spot, 'wal_buffer');
  assert.deepStrictEqual(s.spotsOwned, { wal_buffer: true }); // 建过鱼塘 → 首钓点已解锁
  assert.strictEqual(s.autoReclaim, false);
  assert.strictEqual(s.lastReclaim, 12345);
  assert.strictEqual(s.fishProgress, 0);
  assert.strictEqual(s.fish.eel, 5, '旧鱼计数不能丢');
  assert.strictEqual(s.fish.whale, 1);

  // 没建过鱼塘 → 不预解锁钓点
  const s2 = { pond: false, fish: {} };
  F.migrateFishing(s2, 1);
  assert.deepStrictEqual(s2.spotsOwned, {});
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `node --test test/fishing.test.js`
Expected: FAIL（`F.migrateFishing is not a function`）

- [ ] **Step 3: 实现 migrateFishing**

在 `fishing.js` 加（并导出）：
```js
  // 给存档补齐钓鱼新字段（就地修改）。旧鱼计数/pond 原样保留。
  function migrateFishing(s, now) {
    if (!s.spot || !SPOTS[s.spot]) s.spot = 'wal_buffer';
    if (!s.spotsOwned || typeof s.spotsOwned !== 'object') s.spotsOwned = {};
    if (s.pond && !s.spotsOwned.wal_buffer) s.spotsOwned.wal_buffer = true; // 建过鱼塘=首钓点已开
    if (typeof s.autoReclaim !== 'boolean') s.autoReclaim = false;
    if (typeof s.lastReclaim !== 'number') s.lastReclaim = now;
    if (typeof s.fishProgress !== 'number') s.fishProgress = 0;
    if (!s.fish || typeof s.fish !== 'object') s.fish = {};
    if (!s.dex || typeof s.dex !== 'object') s.dex = {};
  }
```
导出加 `migrateFishing: migrateFishing,`。

- [ ] **Step 4: 运行，确认通过**

Run: `node --test test/fishing.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add skins/db-console/fishing.js test/fishing.test.js
git commit -m "feat(farm): migrateFishing 存档迁移"
```

---

## Task 6: 接入 index.html + farm.js 引用 Fishing、重写点击捞鱼

**Files:**
- Modify: `skins/db-console/index.html`
- Modify: `skins/db-console/farm.js`

- [ ] **Step 1: index.html 加载 fishing.js（在 farm.js 之前）**

把
```html
<script src="/farm.js"></script>
```
改为
```html
<script src="/fishing.js"></script>
<script src="/farm.js"></script>
```

- [ ] **Step 2: farm.js 引用 Fishing，替换旧 FISH/常量**

在 farm.js 顶部（`'use strict';` 之后）加：
```js
  var Fishing = window.Fishing;
```
删除 farm.js 里内联的 `var FISH = { ... }` 整块与其后的 `var FISH_KEYS = [...]`，替换为：
```js
  var FISH = Fishing.FISH;
  var FISH_KEYS = Fishing.FISH_KEYS;
  var SPOTS = Fishing.SPOTS;
  var SPOT_KEYS = Fishing.SPOT_KEYS;
  var RARITY = Fishing.RARITY;
  var MATERIALS = Fishing.MATERIALS;
```
删除旧常量 `var FISH_CLICKS = 60;`（点击成本改由钓点决定）。若 `POND_COST`、`BEAR_EELS` 等仍在 farm.js 内联则保留不动。新增自动回收器价：
```js
  var RECLAIM_COST = 30000;
```

- [ ] **Step 3: 重写 click()（点击捞鱼走钓点模型）**

把 farm.js 现有的 `function click() { ... }` 整体替换为：
```js
  // 一次鼠标点击：先记全局点击数（钓鱼进度、图鉴等都用它），
  // 再按当前钓点推进钓鱼进度，到点掷一条鱼入护。
  function click() {
    state.clicks++;
    if (!state.pond) { saveSoon(); return; }
    var spot = SPOTS[state.spot] || SPOTS.wal_buffer;
    var r = Fishing.advanceCatch(state.fishProgress, spot, { cat: has('cat') });
    state.fishProgress = r.progress;
    if (r.caught) gainFish(r.caught);
    saveSoon();
  }

  // 入护一条鱼：计数、图鉴、稀有播报、触发动物来信检查。
  function gainFish(key) {
    state.fish[key] = (state.fish[key] || 0) + 1;
    state.dex[key] = (state.dex[key] || 0) + 1;
    state.stats.fish++;
    var f = FISH[key];
    if (f && (f.rarity === 'epic' || f.rarity === 'legendary')) {
      toast((state.real ? '钓到稀有的 ' : 'rare reclaim: ') + L(f));
    }
    checkMail();
  }
```
> 说明：旧 `click()` 里的 `FISH_CLICKS`、按权重内联掷鱼、`state.stats.fish++` 等逻辑被上面两个函数取代；`checkMail` 的熊解锁仍读 `state.fish.eel`，`eel` 仍存在，无碍。

- [ ] **Step 4: freshState 增字段；load 调 migrateFishing**

在 `freshState()` 返回的对象里，把 `pond`/`fish` 附近补上新字段（若已有 `pond: false` 保留）：
```js
      spot: 'wal_buffer', spotsOwned: {}, autoReclaim: false,
      lastReclaim: Date.now(), fishProgress: 0,
```
在 `load()` 里，`state` 赋值完成后（现有那段「补齐可能缺失的字段」附近）加一行：
```js
      Fishing.migrateFishing(state, Date.now());
```
确保 `freshState()` 分支与老档分支都会经过 migrate（若 load 结构是「命中则 return」，两条路径都要调用一次；简单做法：在 `load()` 末尾统一 `Fishing.migrateFishing(state, Date.now());`）。

- [ ] **Step 5: render() 里跑自动回收结算**

在 `render()` 开头结算区（`settleRain(now)` 附近）加：
```js
    var rc = Fishing.settleReclaim(
      { auto: state.autoReclaim, last: state.lastReclaim, spotId: state.spot },
      now, { cat: has('cat') });
    if (rc.caught.length) {
      for (var ri = 0; ri < rc.caught.length; ri++) gainFish(rc.caught[ri]);
      state.lastReclaim = rc.last;
      dirty = true;
    } else {
      state.lastReclaim = rc.last;
    }
```

- [ ] **Step 6: 手动验证（起服务，看不报错、能捞鱼）**

```bash
DOCS_PORTAL_SKIN=db-console DOCS_PORTAL_PORT=8099 node server.js
```
浏览器开 `http://127.0.0.1:8099/`，Queues 分区进农场：
- 控制台无报错（F12）。
- 若尚无鱼塘，先攒够金币在（现有）仓库里建鱼塘（后续 Task 7 会把入口挪到钓鱼分区，此步用现状即可）。
- 疯狂点鼠标，`state.stats.fish` 增长；`localStorage` 的 `dbconsole.farm.v3` 里出现 `spot`/`fishProgress` 字段。
关掉服务：Ctrl+C。

- [ ] **Step 7: 提交**

```bash
git add skins/db-console/index.html skins/db-console/farm.js
git commit -m "feat(farm): farm.js 接入 fishing 模块，点击捞鱼走钓点模型"
```

---

## Task 7: 独立「钓鱼」分区（钓点/进度/回收器/鱼护/图鉴）

**Files:**
- Modify: `skins/db-console/farm.js`
- Modify: `skins/db-console/farm.css`

- [ ] **Step 1: TABS 增加钓鱼分区**

在 farm.js 的 `TABS` 数组里，`bag` 之后插入：
```js
    { id: 'pond', job: 'reclaim', name: '钓鱼' },
```

- [ ] **Step 2: 写 pondTab() 渲染函数**

在 farm.js（`bagTab` 附近）新增。先加两个「出图/缺图回退」辅助（Task 9 只负责放图，不再定义它们）：
```js
  // 鱼的「脸」：游戏模式优先立绘 <img>（onerror 回退 emoji），伪装模式不出图。
  function fishFace(key) {
    if (!state.real) return '';
    var f = FISH[key];
    return '<img class="fish-face" src="/fish/' + key + '.webp" alt=""'
      + ' onerror="this.replaceWith(document.createTextNode(\'' + f.emoji + '\'))">';
  }

  // 场景横幅：游戏模式用钓点场景图；缺图时背景为空，退化成纯边框条。
  function sceneBanner(spotId) {
    return '<div class="scene" style="background-image:url(/scenes/' + spotId + '.webp)"></div>';
  }

  function rarityDot(rarity) {
    var r = RARITY[rarity];
    return '<span class="rz rz-' + rarity + '" title="' + esc(state.real ? r.name : r.job) + '"></span>';
  }

  function spotName(id) { var s = SPOTS[id]; return state.real ? s.name : s.job; }

  function pondTab() {
    if (!state.pond) {
      return '<div class="pad"><div class="kb-tools"><button class="btn" data-act="pond">'
        + (state.real ? '修复鱼塘 -' + POND_COST : 'enable reclaim daemon -' + POND_COST)
        + '</button></div><div class="kb-hint">'
        + (state.real ? '修好鱼塘后即可在各存储层回收数据残片（点鼠标）。' : 'build the pond to start reclaiming segments (click).')
        + '</div></div>';
    }
    var spot = SPOTS[state.spot] || SPOTS.wal_buffer;
    var per = has('cat') ? Math.round(spot.clickCost / 1.5) : spot.clickCost;
    var pct = Math.min(100, (state.fishProgress || 0) / per * 100);

    // 钓点列表：已解锁可切换；未解锁显示解锁价。
    var spots = SPOT_KEYS.map(function (id) {
      var s = SPOTS[id];
      var owned = !!state.spotsOwned[id];
      if (owned) {
        return '<a class="spot' + (id === state.spot ? ' is-active' : '') + '" data-spot="' + id + '">'
          + esc(spotName(id)) + '</a>';
      }
      return '<a class="spot spot-lock" data-spotbuy="' + id + '">' + esc(spotName(id))
        + ' <span class="spot-cost">-' + s.unlock + '</span></a>';
    }).join('');

    // 鱼护（有货的鱼）
    var frows = FISH_KEYS.filter(function (k) { return (state.fish[k] || 0) > 0; }).map(function (k) {
      var n = state.fish[k];
      return '<tr>' + rarityCell(k) + '<td class="num">' + n + '</td>'
        + '<td class="num">' + FISH[k].price + '</td><td class="num">' + (n * FISH[k].price) + '</td>'
        + '<td><a class="mini" data-act="sellfish" data-c="' + k + '">' + (state.real ? '卖出' : 'flush') + '</a> '
        + '<a class="mini' + (state.lock['f:' + k] ? ' on' : '') + '" data-act="lockfish" data-c="' + k + '">'
        + (state.lock['f:' + k] ? '\u{1F512}' : '\u{1F513}') + '</a></td></tr>';
    }).join('');

    var reclaimer = state.autoReclaim
      ? '<div class="kb-hint">' + (state.real
          ? '自动回收器运行中：在「' + spotName(state.spot) + '」每 ' + Math.round(spot.reclaimMs / (has('cat') ? 1500 : 1000)) + 's 自动回收一条（离线也算）。'
          : 'reclaim daemon active on ' + spotName(state.spot) + '.')
      + '</div>'
      : '<div class="kb-tools"><button class="btn" data-act="reclaimer">'
          + (state.real ? '购置自动回收器 -' + RECLAIM_COST : 'buy reclaim daemon -' + RECLAIM_COST) + '</button></div>';

    return '<div class="pad">'
      + (state.real ? sceneBanner(state.spot) : '')
      + '<div class="rail-label">' + (state.real ? '钓点' : 'storage tiers') + '</div>'
      + '<div class="spot-list">' + spots + '</div>'
      + '<div class="kb-hint">' + (state.real ? '当前：' : 'active: ') + esc(spotName(state.spot))
      + ' · ' + (state.real ? '下一条 ' : 'next ') + Math.round(pct) + '%'
      + '<span class="pk-bar" style="display:inline-block;width:80px;vertical-align:middle;margin-left:6px">'
      + '<span class="pk-fill" style="width:' + pct.toFixed(0) + '%"></span></span></div>'
      + reclaimer
      + '<div class="rail-label">' + (state.real ? '鱼护' : 'reclaimed') + '</div>'
      + (frows ? '<table class="grid"><tr><th>' + (state.real ? '鱼' : 'segment') + '</th><th>'
          + (state.real ? '数量' : 'count') + '</th><th>' + (state.real ? '单价' : 'unit') + '</th><th>'
          + (state.real ? '合计' : 'total') + '</th><th></th></tr>' + frows + '</table>'
          : '<div class="kb-hint">' + (state.real ? '鱼护是空的，点鼠标开钓。' : 'empty — click to reclaim.') + '</div>')
      + '<div class="rail-label">' + (state.real ? '图鉴' : 'segment dex') + '</div>'
      + fishDex() + '</div>';
  }

  // 鱼护首列：游戏模式显示 emoji/立绘 + 名字，伪装模式只 job。
  function rarityCell(k) {
    return '<td>' + rarityDot(FISH[k].rarity) + fishFace(k) + ' ' + esc(L(FISH[k])) + '</td>';
  }

  // 图鉴：按钓点分组，未捕获显示 ??? / job。
  function fishDex() {
    return SPOT_KEYS.map(function (sp) {
      var cells = Fishing.poolOf(sp).map(function (k) {
        var got = (state.dex[k] || 0) > 0;
        var label = got ? (state.real ? FISH[k].name : FISH[k].job) : (state.real ? '???' : FISH[k].job);
        return '<span class="dexf rz-' + FISH[k].rarity + (got ? '' : ' dexf-off') + '" title="' + esc(label) + '">'
          + (got ? fishFace(k) : '?') + '</span>';
      }).join('');
      return '<div class="dex-row"><span class="dex-sp">' + esc(spotName(sp)) + '</span><span class="dex-cells">' + cells + '</span></div>';
    }).join('');
  }
```

- [ ] **Step 3: render() 分派 pondTab**

在 farm.js `render()` 里选择 body 的三元链中加入 `pond` 分支：
```js
    var body = state.tab === 'bag' ? bagTab()
      : state.tab === 'pond' ? pondTab()
      : state.tab === 'order' ? orderTab()
      : state.tab === 'zoo' ? zooTab()
      : state.tab === 'stats' ? statsTab()
      : farmTab();
```

- [ ] **Step 4: onMainClick 处理钓点切换/解锁/购置回收器**

在 farm.js `onMainClick(e)` 顶部（读 `data-tab`/`data-plot` 之后）加钓点交互：
```js
    var sp = e.target.closest ? e.target.closest('[data-spot]') : null;
    if (sp) { state.spot = sp.getAttribute('data-spot'); redraw(); return; }
    var spb = e.target.closest ? e.target.closest('[data-spotbuy]') : null;
    if (spb) {
      var id = spb.getAttribute('data-spotbuy');
      if (state.coins >= SPOTS[id].unlock) { earn(-SPOTS[id].unlock); state.spotsOwned[id] = true; state.spot = id; }
      redraw(); return;
    }
```
并在其 `data-act` 分支里加 `reclaimer`：
```js
    else if (act === 'reclaimer') {
      if (!state.autoReclaim && state.coins >= RECLAIM_COST) {
        earn(-RECLAIM_COST); state.autoReclaim = true; state.lastReclaim = Date.now();
      }
    }
```
> 现有 `pond`（建鱼塘）分支保留；建鱼塘后要顺手解锁首钓点，在其分支里加：`state.spotsOwned.wal_buffer = true;`

- [ ] **Step 5: farm.css 加样式**

在 `skins/db-console/farm.css` 末尾追加：
```css
/* ---- 钓鱼分区 ---- */
.spot-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 8px; }
.spot { padding: 4px 10px; border: 1px solid var(--border); border-radius: 5px;
  color: var(--muted); font-size: 12px; cursor: pointer; }
.spot:hover { color: var(--fg); border-color: #3a3a3a; text-decoration: none; }
.spot.is-active { color: var(--accent); border-color: var(--accent); }
.spot-lock { opacity: .6; }
.spot-cost { color: var(--accent); }
.rz { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
.rz-common { background: #6b6b6b; } .rz-uncommon { background: #4fa3ff; }
.rz-rare { background: #b06bff; } .rz-epic { background: #ff8f3e; } .rz-legendary { background: #ffd23e; }
.dex-row { display: flex; gap: 8px; align-items: baseline; margin: 3px 0; }
.dex-sp { width: 6.5em; color: var(--muted); font-size: 11px; flex: none; }
.dex-cells { display: flex; flex-wrap: wrap; gap: 4px; }
.dexf { width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--border); border-radius: 5px; font-size: 15px; }
.dexf-off { color: #4a4a4a; }
.fish-face { width: 20px; height: 20px; vertical-align: middle; object-fit: contain; }
/* 场景横幅 */
.scene { width: 100%; height: 92px; border-radius: 6px; margin-bottom: 8px;
  background-size: cover; background-position: center; border: 1px solid var(--border); }
```

- [ ] **Step 6: 手动验证**

起服务（同 Task 6 Step 6），进钓鱼分区：
- 钓点列表显示；点未解锁的钓点扣金币并切过去；点已解锁的切换当前钓点。
- 点鼠标进度条走，到点鱼护里出鱼。
- 购置自动回收器后，等一两个间隔（或改小 `reclaimMs` 临时测），鱼护自动增鱼。
- 图鉴按钓点分组，未捕获灰问号、已捕获显 emoji。
- 🌱 切伪装：钓点/鱼名变 job，图鉴问号处显 job，场景横幅消失。

- [ ] **Step 7: 提交**

```bash
git add skins/db-console/farm.js skins/db-console/farm.css
git commit -m "feat(farm): 独立钓鱼分区（钓点/进度/回收器/鱼护/图鉴）"
```

---

## Task 8: 仓库分区移除鱼行（鱼归钓鱼分区）

**Files:**
- Modify: `skins/db-console/farm.js`

- [ ] **Step 1: bagTab 去掉鱼相关行与鱼塘按钮**

在 farm.js `bagTab()` 中：删除构造 `frows`（鱼行）的整段、删除底部「修复鱼塘」`pond` 按钮区块；表格 `rows` 只保留作物。`sellall`（一键全卖）保留，仍连鱼一起卖（便利）。若 `bagTab` 里对空判断用到 `rows.length + frows.length`，改成只看 `rows.length`。

- [ ] **Step 2: 手动验证**

起服务，进仓库：只剩作物行、无鱼、无「修复鱼塘」按钮；`sellall` 仍会把鱼一起卖掉。钓鱼分区功能不受影响。

- [ ] **Step 3: 提交**

```bash
git add skins/db-console/farm.js
git commit -m "refactor(farm): 鱼从仓库迁入钓鱼分区，仓库只管作物"
```

---

## Task 9: 放置立绘/场景图 + webp MIME（缺图已回退）

> `fishFace`/`sceneBanner` 已在 Task 7 定义并接入，缺图时自动回退 emoji/纯边框条。本任务只负责让服务能正确返回 webp、并放入实际图片。

**Files:**
- Modify: `server.js`（MIME 补 webp）
- Create（图片由 AI 生成后放入）: `skins/db-console/fish/<key>.webp` ×48, `skins/db-console/scenes/<spotId>.webp` ×6

- [ ] **Step 1: server.js MIME 补 webp**

在 `server.js` 的 `MIME` 表里（`'.png': 'image/png'` 一行附近）加：
```js
  '.webp': 'image/webp',
```
> `safeJoin(SKIN_DIR, pathname)` 已能提供皮肤目录下子目录的静态文件，无需另加路由。

- [ ] **Step 2: 验证子目录静态图可访问**

把任意图片临时存成 `skins/db-console/fish/eel.webp`，起服务：
```bash
DOCS_PORTAL_SKIN=db-console DOCS_PORTAL_PORT=8099 node server.js
```
访问 `http://127.0.0.1:8099/fish/eel.webp`，应返回 200 且 `content-type: image/webp`。

- [ ] **Step 3: 放图**

按 `docs/superpowers/specs/2026-09-02-fish-art-prompts.md` 出图：鱼存 `skins/db-console/fish/<key>.webp`（48 张，key 见 Task 1），场景存 `skins/db-console/scenes/<spotId>.webp`（6 张，spotId 见 `SPOT_KEYS`）。**缺图不报错**——`<img>` onerror 回退 emoji，场景退化为纯边框条，可分批补齐。

- [ ] **Step 4: 手动验证**

游戏模式看钓鱼分区：有图的鱼/场景显示图，没图的显示 emoji/空边框条；伪装模式全无图、只文字。控制台无报错。

- [ ] **Step 5: 提交**

```bash
git add server.js skins/db-console/fish skins/db-console/scenes
git commit -m "feat(farm): webp MIME 与鱼/场景图资源"
```

---

## 全量回归

- [ ] `node --test test/fishing.test.js` 全绿。
- [ ] `for f in test/*.test.js; do node "$f"; done` 现有测试无回归（钓鱼改动不碰 lib/server）。
- [ ] `node --check skins/db-console/farm.js && node --check skins/db-console/fishing.js` 语法通过。
- [ ] 起服务人工过一遍：捞鱼、切钓点、解锁、自动回收器、图鉴、伪装切换、仓库、立绘回退。

## 自检对照 spec

- 6 钓点 × 8 鱼 = 48：Task 1 数据 + 测试覆盖。
- 5 稀有度权重：Task 1 `RARITY` + Task 2 分布测试。
- 点击捞鱼（钓点 clickCost、猫加速）：Task 3 + Task 6 `click()`。
- 自动回收器 + 离线结算 + 上限 + 猫加速：Task 4 + Task 6 render 结算。
- 材料标签：Task 1 `mat` 字段（本期不消费）。
- 独立分区 + 钓点/鱼护/解锁/图鉴：Task 7。
- 仓库只管作物：Task 8。
- 立绘 + 场景图 + 缺图回退 + 伪装不出图：Task 9。
- 存档迁移不丢旧鱼、熊/猫解锁仍有效：Task 5 + Task 6 Step 4。
