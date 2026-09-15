# 开采经济闭合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 按 Melvor 惯例给开采补上经济闭合 —— 矿石与锭可出售，冶炼从「点一次做一个」改成与开采互斥的挂机活动。

**Architecture:** 纯逻辑继续放 `skins/db-console/mining.js`（`price` 字段、`settleSmelt`、迁移），`farm.js` 只做 DOM 与状态。冶炼与开采互斥由 `farm.js` 的状态协调完成（开炼清 `mine.vein`、选脉清 `smelt.bar`）。

**Tech Stack:** 原生 JS、`node --test`、无构建。

配套 spec：`docs/superpowers/specs/2026-09-04-mining-economy-design.md`

---

## 文件结构

- **改** `skins/db-console/mining.js` — `ORES`/`BARS` 加 `price`；新增 `SMELT_MS`、`settleSmelt`；`migrateMining` 补 `smelt`
- **改** `test/mining.test.js` — 追加定价、`settleSmelt`、迁移的测试
- **改** `skins/db-console/farm.js` — 冶炼挂机接线与互斥、`forgeTab()` 熔炉 UI 改造、矿石/锭出售 UI、`sellall` 纳入
- **不碰** `equip.js`、`combat.js`、`fishing.js`、`server.js`、任何 `index.html`、`farm-data.js`

**并发提醒：** 仓库有另一个会话在改 `skins/tracer/*`、`server.js`、`test/server.test.js` 等。**每次提交一律显式带 pathspec**，绝不用不带路径的 `git commit`。

---

## Task 1: 矿石与锭的定价

**Files:** Modify `skins/db-console/mining.js`, Test `test/mining.test.js`

- [ ] **Step 1: 写失败的测试**

在 `test/mining.test.js` 末尾追加：

```js
test('矿石与锭都有正数售价', () => {
  Object.keys(M.ORES).forEach((k) => {
    assert.ok(M.ORES[k].price > 0, k + ' 缺售价');
  });
  M.BAR_KEYS.forEach((k) => {
    assert.ok(M.BARS[k].price > 0, k + ' 缺售价');
  });
});

test('售价随档位递增，煤最便宜', () => {
  const oreByTier = {};
  Object.keys(M.ORES).forEach((k) => { oreByTier[M.ORES[k].tier] = M.ORES[k].price; });
  for (let t = 2; t <= 6; t++) {
    assert.ok(oreByTier[t] > oreByTier[t - 1], 'T' + t + ' 矿应比 T' + (t - 1) + ' 贵');
  }
  assert.ok(oreByTier[0] < oreByTier[1], '煤应比一档矿便宜');
  for (let t = 2; t <= 6; t++) {
    assert.ok(M.BARS[M.BAR_KEYS[t - 1]].price > M.BARS[M.BAR_KEYS[t - 2]].price, 'T' + t + ' 锭应更贵');
  }
});

test('炼锭有正收益：锭价高于其原料成本', () => {
  M.BAR_KEYS.forEach((bk) => {
    const r = M.smeltRecipe(bk);
    let cost = r.coal * M.ORES[M.COAL_KEY].price;
    for (const o in r.ores) cost += r.ores[o] * M.ORES[o].price;
    assert.ok(M.BARS[bk].price > cost,
      bk + ' 锭价 ' + M.BARS[bk].price + ' 应高于原料成本 ' + cost + '，否则炼锭是亏的');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/mining.test.js`
Expected: FAIL，`heap_ore 缺售价`

- [ ] **Step 3: 写实现**

`skins/db-console/mining.js` 的 `ORES` 加 `price`（每行末尾追加字段）：

```js
  var ORES = {
    heap_ore:   { name: '铜矿',   job: 'heap_ore',   emoji: '\u{1F7E0}', tier: 1, price: 12 },
    fsm_ore:    { name: '铁矿',   job: 'fsm_ore',    emoji: '\u{1F529}', tier: 2, price: 28 },
    vm_ore:     { name: '秘银矿', job: 'vm_ore',     emoji: '\u{1F4A0}', tier: 3, price: 60 },
    brin_ore:   { name: '精金矿', job: 'brin_ore',   emoji: '\u{1F7E3}', tier: 4, price: 120 },
    tblspc_ore: { name: '陨铁矿', job: 'tblspc_ore', emoji: '\u{1FAA8}', tier: 5, price: 240 },
    void_ore:   { name: '虚空矿', job: 'void_ore',   emoji: '\u{1F573}', tier: 6, price: 460 },
    burn_seg:   { name: '煤',     job: 'burn_seg',   emoji: '\u{2B1B}',  tier: 0, price: 8 },
  };
```

`BARS` 同样加 `price`。注释里说明定价原则：

```js
  // 锭：ore 指向本档原矿，冶炼配方由此派生。price 高于原料成本（3 矿 + tier 煤），
  // 让炼锭本身就是一条有正收益的产业链，而不只是锻造的中间步骤——与 Melvor 一致。
  // key 被 Equip.TIER_BAR 镜像了一份（equip 不 require mining），改这里要同步改那边；
  // 漏改由 equip.test.js 的一致性测试兜底，但别等测试报红才发现。
  var BARS = {
    heap_bar:   { name: '铜锭',   job: 'heap_bar',   emoji: '\u{1F7E7}', tier: 1, ore: 'heap_ore',   price: 60 },
    fsm_bar:    { name: '铁锭',   job: 'fsm_bar',    emoji: '\u{2B1C}',  tier: 2, ore: 'fsm_ore',    price: 140 },
    vm_bar:     { name: '秘银锭', job: 'vm_bar',     emoji: '\u{1F7E6}', tier: 3, ore: 'vm_ore',     price: 280 },
    brin_bar:   { name: '精金锭', job: 'brin_bar',   emoji: '\u{1F7EA}', tier: 4, ore: 'brin_ore',   price: 540 },
    tblspc_bar: { name: '陨铁锭', job: 'tblspc_bar', emoji: '\u{1F7E8}', tier: 5, ore: 'tblspc_ore', price: 1050 },
    void_bar:   { name: '虚空锭', job: 'void_bar',   emoji: '\u{1F7E5}', tier: 6, ore: 'void_ore',   price: 1950 },
  };
```

- [ ] **Step 4: 跑测试**

Run: `node --test test/mining.test.js`
Expected: PASS

Run: `node --test test/*.test.js`
Expected: 0 fail

- [ ] **Step 5: 提交**

```bash
git commit -m "feat(mining): 矿石与锭定价，炼锭有正收益

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- skins/db-console/mining.js test/mining.test.js
```

---

## Task 2: 冶炼挂机结算 settleSmelt

**Files:** Modify `skins/db-console/mining.js`, Test `test/mining.test.js`

- [ ] **Step 1: 写失败的测试**

追加到 `test/mining.test.js`：

```js
test('settleSmelt：按间隔产锭并记录消耗，不改入参 state', () => {
  const s = { ores: { heap_ore: 10, burn_seg: 5 } };
  const smelt = { bar: 'heap_bar', last: 0 };
  const out = M.settleSmelt(smelt, s, M.SMELT_MS * 2);
  assert.strictEqual(out.ticks, 2);
  assert.strictEqual(out.bars.heap_bar, 2);
  assert.strictEqual(out.spent.heap_ore, 6, '每轮 3 矿');
  assert.strictEqual(out.spent.burn_seg, 2, '每轮 1 煤（T1）');
  assert.strictEqual(out.xp, M.SMELT_XP[1] * 2);
  assert.strictEqual(out.stopped, false);
  assert.strictEqual(s.ores.heap_ore, 10, '不得改入参 state');
  assert.strictEqual(smelt.last, 0, '不得改入参 smelt');
});

test('settleSmelt：材料耗尽自动停止并置 stopped', () => {
  const s = { ores: { heap_ore: 7, burn_seg: 5 } };   // 只够炼 2 轮（每轮 3 矿）
  const out = M.settleSmelt({ bar: 'heap_bar', last: 0 }, s, M.SMELT_MS * 10);
  assert.strictEqual(out.ticks, 2, '只能炼 2 个');
  assert.strictEqual(out.stopped, true);
  assert.strictEqual(out.smelt.bar, null, '停了就把 bar 清空，不空转');
});

test('settleSmelt：煤不够也会停', () => {
  const s = { ores: { void_ore: 99, burn_seg: 6 } };  // T6 每轮要 6 煤，只够 1 轮
  const out = M.settleSmelt({ bar: 'void_bar', last: 0 }, s, M.SMELT_MS * 5);
  assert.strictEqual(out.ticks, 1);
  assert.strictEqual(out.stopped, true);
});

test('settleSmelt：bar 为 null 或未知 key 时优雅无操作', () => {
  const s = { ores: { heap_ore: 99, burn_seg: 99 } };
  const none = M.settleSmelt({ bar: null, last: 0 }, s, 99999);
  assert.strictEqual(none.ticks, 0);
  assert.deepStrictEqual(none.bars, {});
  assert.strictEqual(none.smelt.last, 99999, 'last 仍推进，避免下次重复结算');

  const bad = M.settleSmelt({ bar: 'corrupted', last: 0 }, s, 99999);
  assert.strictEqual(bad.ticks, 0, '损坏的存档不能让每秒 render 崩掉');
});

test('settleSmelt：不足一轮的时间留到下次', () => {
  const s = { ores: { heap_ore: 99, burn_seg: 99 } };
  const out = M.settleSmelt({ bar: 'heap_bar', last: 0 }, s, M.SMELT_MS * 3 + 700);
  assert.strictEqual(out.ticks, 3);
  assert.strictEqual(out.smelt.last, M.SMELT_MS * 3, '余下 700ms 留到下次');
});

test('settleSmelt：超长离线被 OFFLINE_CAP 截断', () => {
  const s = { ores: { heap_ore: 1e9, burn_seg: 1e9 } };
  const out = M.settleSmelt({ bar: 'heap_bar', last: 0 }, s, 1000 * 60 * 60 * 24 * 30);
  assert.ok(out.ticks <= M.OFFLINE_CAP);
  assert.ok(out.ticks > 0);
  assert.strictEqual(out.smelt.last, 1000 * 60 * 60 * 24 * 30, '截断后 last 跳到 now');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/mining.test.js`
Expected: FAIL，`M.settleSmelt is not a function`

- [ ] **Step 3: 写实现**

在 `mining.js` 的 `smeltCheck` 之后、`switchVein` 之前插入：

```js
  // 冶炼间隔。固定值、不吃 agi——agi 是开采的效率维度，两边的加成不叠在一起。
  var SMELT_MS = 2000;

  // 冶炼挂机结算：从 smelt.last 推进到 now，每 SMELT_MS 消耗一份配方产 1 锭。
  // 纯函数：既不改 smelt 也不改 state，只返回「炼出多少、消耗多少」，由调用方落账。
  // 材料不够就停（stopped=true 且把 bar 清空），不空转。
  function settleSmelt(smelt, state, now) {
    var out = {
      bars: {}, spent: {}, xp: 0, ticks: 0, stopped: false,
      smelt: { bar: smelt.bar, last: smelt.last },
    };
    var r = smeltRecipe(smelt.bar);
    // 没在炼、或存档里 bar 损坏 → 优雅无操作。last 仍推进，否则下次又从头算一遍。
    if (!r) { out.smelt.last = now; return out; }
    // 库存副本：边算边扣，用来判断还够炼几轮，不碰真正的 state。
    var have = {}, src = (state && state.ores) || {};
    for (var k in src) have[k] = src[k];
    var t = (smelt.last == null) ? now : smelt.last;
    var guard = 0;
    while (t + SMELT_MS <= now && guard < OFFLINE_CAP) {
      guard++;
      var enough = (have[COAL_KEY] || 0) >= r.coal;
      for (var o in r.ores) if ((have[o] || 0) < r.ores[o]) enough = false;
      if (!enough) { out.stopped = true; out.smelt.bar = null; break; }
      for (var o2 in r.ores) {
        have[o2] -= r.ores[o2];
        out.spent[o2] = (out.spent[o2] || 0) + r.ores[o2];
      }
      have[COAL_KEY] -= r.coal;
      out.spent[COAL_KEY] = (out.spent[COAL_KEY] || 0) + r.coal;
      t += SMELT_MS;
      out.bars[smelt.bar] = (out.bars[smelt.bar] || 0) + 1;
      out.xp += r.xp;
      out.ticks++;
    }
    out.smelt.last = (guard >= OFFLINE_CAP) ? now : t;
    return out;
  }
```

导出里加 `SMELT_MS: SMELT_MS, settleSmelt: settleSmelt,`。

- [ ] **Step 4: 跑测试**

Run: `node --test test/mining.test.js`（PASS）
Run: `node --test test/*.test.js`（0 fail）

- [ ] **Step 5: 提交**

```bash
git commit -m "feat(mining): 冶炼挂机结算——按间隔产锭、料尽自停、离线截断

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- skins/db-console/mining.js test/mining.test.js
```

---

## Task 3: 存档迁移补 smelt

**Files:** Modify `skins/db-console/mining.js`, Test `test/mining.test.js`

- [ ] **Step 1: 写失败的测试**

```js
test('migrateMining：补 smelt 字段，损坏的 bar 清成 null', () => {
  const s = {};
  M.migrateMining(s, 1000);
  assert.deepStrictEqual(s.smelt, { bar: null, last: 1000 });

  const s2 = { smelt: { bar: 'heap_bar', last: 500 } };
  M.migrateMining(s2, 1000);
  assert.strictEqual(s2.smelt.bar, 'heap_bar', '不重置进行中的冶炼');
  assert.strictEqual(s2.smelt.last, 500);

  const s3 = { smelt: { bar: 'corrupted', last: 500 } };
  M.migrateMining(s3, 1000);
  assert.strictEqual(s3.smelt.bar, null, '未知锭 key 清成 null');

  const s4 = { smelt: [] };            // 数组也要修回来
  M.migrateMining(s4, 1000);
  assert.deepStrictEqual(s4.smelt, { bar: null, last: 1000 });

  const s5 = { smelt: { bar: 'fsm_bar', last: NaN } };
  M.migrateMining(s5, 1000);
  assert.strictEqual(s5.smelt.last, 1000, 'NaN 要修回来');
});

test('migrateMining：补 smelt 后仍然幂等', () => {
  const s = { smelt: { bar: 'heap_bar', last: 500 } };
  M.migrateMining(s, 1000);
  M.migrateMining(s, 2000);
  assert.strictEqual(s.smelt.bar, 'heap_bar');
  assert.strictEqual(s.smelt.last, 500);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/mining.test.js`
Expected: FAIL，`s.smelt` 为 undefined

- [ ] **Step 3: 写实现**

在 `migrateMining` 里，`mine` 那几行之后、`oreCount` 折算之前插入：

```js
    // 冶炼状态。老存档没有这个字段 → 视为没在冶炼，行为不退化。
    if (!s.smelt || typeof s.smelt !== 'object' || Array.isArray(s.smelt)) {
      s.smelt = { bar: null, last: now };
    }
    if (!('bar' in s.smelt)) s.smelt.bar = null;
    if (typeof s.smelt.last !== 'number' || isNaN(s.smelt.last)) s.smelt.last = now;
    // 存档里的锭 key 损坏 → 清成 null，别让它永久留着（对齐上面 mine.vein 的处理）。
    if (s.smelt.bar && !BARS[s.smelt.bar]) s.smelt.bar = null;
```

- [ ] **Step 4: 跑测试**

Run: `node --test test/mining.test.js`（PASS）
Run: `node --test test/*.test.js`（0 fail）

- [ ] **Step 5: 提交**

```bash
git commit -m "feat(mining): 存档迁移补冶炼状态，损坏的锭 key 清空

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- skins/db-console/mining.js test/mining.test.js
```

---

## Task 4: farm.js 冶炼挂机接线与互斥

**Files:** Modify `skins/db-console/farm.js`

此任务结束后冶炼会在后台真实产锭，且与开采互斥；UI 还是旧的瞬时按钮，Task 5 才改。

- [ ] **Step 1: 加状态字段**

`freshState()` 里，`mine: { ... }` 那一行之后加：

```js
      smelt: { bar: null, last: Date.now() },
```

- [ ] **Step 2: 每秒 render 里结算**

`render()` 里，开采结算块（`if (state.mine.vein) { ... }`）之后插入：

```js
    // 冶炼挂机结算：与开采互斥，同一时刻只有一个在跑（见 startSmelt/selectVein）。
    if (state.smelt.bar) {
      var so = Mining.settleSmelt(state.smelt, state, now);
      if (so.ticks > 0) {
        for (var sk in so.spent) state.ores[sk] -= so.spent[sk];
        for (var sb in so.bars) state.bars[sb] = (state.bars[sb] || 0) + so.bars[sb];
        state.xp += so.xp;
        dirty = true;
      }
      if (so.stopped) {
        toast(state.real ? '材料用尽，冶炼已停' : 'out of stock — smelt halted');
        dirty = true;
      }
      state.smelt = so.smelt;
    }
```

- [ ] **Step 3: 加开炼/停炼动作，并让两边互斥**

把 `doSmelt()` 整体替换为：

```js
  function startSmelt(barKey) {
    var c = Mining.smeltCheck(barKey, state);
    if (!c || !c.ok) return;
    // 与开采互斥：同一时刻只做一件事（Melvor 惯例）。开炼就把矿脉停下。
    state.smelt = { bar: barKey, last: Date.now() };
    state.mine.vein = null;
    var b = Mining.BARS[barKey];
    toast(state.real ? '开始冶炼' + b.name : 'smelting ' + b.job);
    redraw();
  }

  function stopSmelt() {
    state.smelt = { bar: null, last: Date.now() };
    redraw();
  }
```

`selectVein()` 里，`state.mine = Mining.switchVein(...)` 之后加一行：

```js
    state.smelt = { bar: null, last: Date.now() };   // 与冶炼互斥，选矿脉就停下熔炉
```

- [ ] **Step 4: 点击分发**

`onMainClick()` 里，把原来的 `data-smelt` 那段替换为：

```js
    var sm = e.target.closest ? e.target.closest('[data-smelt]') : null;
    if (sm) { startSmelt(sm.getAttribute('data-smelt')); return; }
    var sst = e.target.closest ? e.target.closest('[data-smeltstop]') : null;
    if (sst) { stopSmelt(); return; }
```

- [ ] **Step 5: 验证**

Run: `node --check skins/db-console/farm.js`（无输出）
Run: `node --test test/*.test.js`（0 fail）
Run: `grep -n "doSmelt" skins/db-console/farm.js`（应无残留）

起服务器确认首页 200：

```bash
DOCS_PORTAL_PORT=8801 DOCS_PORTAL_SKIN=db-console node server.js &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8801/
kill %1
```

- [ ] **Step 6: 提交**

```bash
git commit -m "feat(mining): 冶炼改成挂机活动，与开采互斥

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- skins/db-console/farm.js
```

---

## Task 5: 熔炉 UI 改造

**Files:** Modify `skins/db-console/farm.js`, `skins/db-console/farm.css`

- [ ] **Step 1: 改熔炉表的操作列与顶部提示**

`forgeTab()` 里，把熔炉那段 `.map()` 的操作列改成三态（正在炼这条 / 可以开炼 / 料不够），并在函数顶部算出当前活动状态。

把 `var smelt = Mining.BAR_KEYS.map(function (bk) {` 之前加：

```js
    var smeltingNow = state.smelt.bar;
```

把操作列那段（`'<td>' + (c.ok ? ... : ...) + '</td></tr>'`）替换为：

```js
        + '<td>' + (smeltingNow === bk
            ? '<span class="mini on">' + (state.real ? '冶炼中' : 'smelting') + '</span> '
              + '<a class="mini" data-smeltstop="1">' + (state.real ? '停' : 'stop') + '</a>'
            : c.ok
              ? '<a class="mini" data-smelt="' + bk + '">' + (state.real ? '开炼' : 'smelt') + '</a>'
              : '<button class="btn btn-dim" disabled>' + (state.real ? '开炼' : 'smelt') + '</button>')
        + '</td></tr>';
```

- [ ] **Step 2: 顶部加互斥提示**

把 `forgeTab()` 里那句 `kb-hint` 替换为按当前活动分支的版本：

```js
      + '<div class="kb-hint">' + (smeltingNow
          ? (state.real
              ? '正在冶炼' + Mining.BARS[smeltingNow].name + '——材料用尽会自动停。'
              : 'smelting ' + Mining.BARS[smeltingNow].job + ' — halts when stock runs out.')
          : state.mine.vein
            ? (state.real
                ? '正在开采' + Mining.VEINS[state.mine.vein].name + '；开炼会把矿脉停下（同时只能做一件事）。'
                : 'mining ' + Mining.VEINS[state.mine.vein].job + ' — starting a smelt stops it.')
            : (state.real
                ? '矿石来自开采页；炼成锭后回这里锻造装备。'
                : 'ore comes from the mine tab — smelt it into bars, then forge here.'))
      + '</div>'
```

- [ ] **Step 3: 开采页也提示互斥**

`mineTab()` 里那句 `kb-hint` 替换为：

```js
      + '<div class="kb-hint">' + (state.smelt.bar
          ? (state.real
              ? '正在锻造页冶炼' + Mining.BARS[state.smelt.bar].name + '；挂矿脉会把熔炉停下（同时只能做一件事）。'
              : 'smelting ' + Mining.BARS[state.smelt.bar].job + ' in the forge tab — picking a seam stops it.')
          : (state.real
              ? '选一条矿脉挂着自动开采；耐久挖空后自行再生。冶炼在锻造页。'
              : 'pick one seam; it drains and respawns on its own.'))
      + '</div>'
```

- [ ] **Step 4: 验证**

Run: `node --check skins/db-console/farm.js`
Run: `node --test test/*.test.js`（0 fail）

**伪装泄漏检查**（执行级，方法自己定）：把 `forgeTab`/`mineTab` 抠出来在 Node 沙盒里真的执行，扫 CJK 和扩展平面 emoji。必须覆盖这几种状态：没有任何活动 / 正在冶炼 / 正在开采。`real:false` 零中文零 emoji，`real:true` 有中文。

- [ ] **Step 5: 提交**

```bash
git commit -m "feat(mining): 熔炉 UI 改成开炼/停炼，两页互相提示互斥

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- skins/db-console/farm.js skins/db-console/farm.css
```

---

## Task 6: 矿石与锭的出售

**Files:** Modify `skins/db-console/farm.js`

沿用仓库既有惯例：每类物品在自己的 tab 里卖、可锁定、`sellall` 跨类一键卖。锁定 key 前缀：矿石 `'o:'`、锭 `'b:'`（现有作物是裸 key、鱼是 `'f:'`）。

- [ ] **Step 1: 矿石库存表加售价与操作**

`mineTab()` 里的 `have` 那段 `.map()` 替换为：

```js
      .map(function (k) {
        var o = Mining.ORES[k], n = state.ores[k];
        return '<tr><td>' + oreFace(k) + esc(state.real ? o.name : o.job) + '</td>'
          + '<td class="num">' + n + '</td>'
          + '<td class="num">' + o.price + '</td>'
          + '<td class="num">' + (n * o.price) + '</td>'
          + '<td><a class="mini" data-act="sellore" data-c="' + k + '">'
          + (state.real ? '卖出' : 'flush') + '</a> '
          + '<a class="mini' + (state.lock['o:' + k] ? ' on' : '') + '" data-act="lockore" data-c="' + k + '">'
          + (state.lock['o:' + k] ? '\u{1F512}' : '\u{1F513}') + '</a></td></tr>';
      }).join('');
```

同一函数里矿石表的表头（`'<div class="rail-label">' + (state.real ? '矿石' : 'objects')` 之后那张表）改成五列：

```js
      + (have ? '<table class="grid"><tr><th>' + (state.real ? '矿石' : 'object') + '</th>'
          + '<th>' + (state.real ? '数量' : 'count') + '</th>'
          + '<th>' + (state.real ? '单价' : 'unit') + '</th>'
          + '<th>' + (state.real ? '合计' : 'total') + '</th><th></th></tr>' + have + '</table>'
```

- [ ] **Step 2: 熔炉表加锭的出售**

`forgeTab()` 熔炉那段，把存量列后面接上单价，并在操作列末尾追加卖出与锁。把存量那一列：

```js
        + '<td class="num">' + (state.bars[bk] || 0) + '</td>'
```

替换为：

```js
        + '<td class="num">' + (state.bars[bk] || 0) + '</td>'
        + '<td class="num">' + b.price + '</td>'
```

表头相应加一列（在「存量」之后）：

```js
      + '<th>' + (state.real ? '单价' : 'unit') + '</th>'
```

操作列（Task 5 改过的那段）末尾，在 `</td></tr>` 之前追加：

```js
          + ' <a class="mini" data-act="sellbar" data-c="' + bk + '">' + (state.real ? '卖' : 'sell') + '</a>'
          + '<a class="mini' + (state.lock['b:' + bk] ? ' on' : '') + '" data-act="lockbar" data-c="' + bk + '">'
          + (state.lock['b:' + bk] ? '\u{1F512}' : '\u{1F513}') + '</a>'
```

- [ ] **Step 3: 加出售与锁定的动作处理**

`onMainClick()` 里 `act === 'sellfish'` 那段之后插入：

```js
    } else if (act === 'sellore') {
      var orn = state.ores[c] || 0;
      if (orn > 0) { earn(orn * Mining.ORES[c].price); state.ores[c] = 0; }
    } else if (act === 'sellbar') {
      var brn = state.bars[c] || 0;
      if (brn > 0) { earn(brn * Mining.BARS[c].price); state.bars[c] = 0; }
```

`act === 'lockfish'` 那行之后插入：

```js
    else if (act === 'lockore') state.lock['o:' + c] = !state.lock['o:' + c];
    else if (act === 'lockbar') state.lock['b:' + c] = !state.lock['b:' + c];
```

- [ ] **Step 4: sellall 纳入矿石与锭**

`act === 'sellall'` 那段里，`FISH_KEYS.forEach(...)` 之后插入：

```js
      Object.keys(Mining.ORES).forEach(function (k) {
        if (state.lock['o:' + k]) return;
        var q = state.ores[k] || 0;
        if (q) { got += q * Mining.ORES[k].price; state.ores[k] = 0; }
      });
      Mining.BAR_KEYS.forEach(function (k) {
        if (state.lock['b:' + k]) return;
        var q = state.bars[k] || 0;
        if (q) { got += q * Mining.BARS[k].price; state.bars[k] = 0; }
      });
```

- [ ] **Step 5: 验证**

Run: `node --check skins/db-console/farm.js`
Run: `node --test test/*.test.js`（0 fail）

**执行级验证**（方法自己定）：在 Node 沙盒里把出售逻辑跑一遍 —— 卖矿石金币正确增加且库存清零、锁定的不被 `sellall` 带走、卖空后再卖无副作用。把真实输出写进汇报。

**伪装泄漏检查**：`mineTab`/`forgeTab` 在有库存/无库存、锁定/未锁定各状态下，`real:false` 零中文零 emoji。**注意锁图标 🔒/🔓 是 emoji** —— 去看现有的作物/鱼出售行在伪装模式下是怎么处理它的，照着做（如果现有代码在伪装模式下也显示锁 emoji，那就是既定行为，照抄即可，但要在汇报里说明）。

- [ ] **Step 6: 提交**

```bash
git commit -m "feat(mining): 矿石与锭可出售，纳入一键全卖与锁定保护

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- skins/db-console/farm.js
```

---

## 完成后

全量 `node --test test/*.test.js` 应为绿。`test/mining.test.js` 从 42 条涨到约 53 条。

验收（对照 spec 第六节）：
- 开采与冶炼真正互斥：开炼后矿脉停止产出，选矿脉后冶炼停止
- 矿石与锭能卖出金币，锁定的不被一键全卖带走
- 伪装模式下两个页面无中文泄漏
- 老存档没有 `smelt` 字段时视为未在冶炼，加载不崩
