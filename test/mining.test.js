'use strict';
const test = require('node:test');
const assert = require('node:assert');
const M = require('../skins/db-console/mining.js');
const C = require('../skins/db-console/combat.js');
const E = require('../skins/db-console/equip.js');

test('7 条矿脉：6 档矿 + 1 条煤脉，key 与 VEIN_KEYS 一致', () => {
  assert.strictEqual(M.VEIN_KEYS.length, 7);
  M.VEIN_KEYS.forEach((k) => assert.ok(M.VEINS[k], k + ' 应在 VEINS 里'));
  assert.strictEqual(Object.keys(M.VEINS).length, 7);
  const tiers = M.VEIN_KEYS.map((k) => M.VEINS[k].tier).sort((a, b) => a - b);
  assert.deepStrictEqual(tiers, [0, 1, 2, 3, 4, 5, 6]);
});

test('矿脉产出的矿石都在 ORES 里，煤脉产煤', () => {
  M.VEIN_KEYS.forEach((k) => {
    const v = M.VEINS[k];
    assert.ok(M.ORES[v.ore], k + ' 的产出 ' + v.ore + ' 不在 ORES 里');
    assert.ok(v.name && v.job, k + ' 缺名/黑话');
    assert.ok(v.tickMs > 0 && v.hp > 0 && v.respawnMs > 0 && v.xp > 0, k + ' 数值非法');
  });
  assert.strictEqual(M.VEINS.burn_seam.ore, M.COAL_KEY);
  assert.strictEqual(M.ORES[M.COAL_KEY].tier, 0);
});

test('6 种锭各对一档矿，档位与矿石 tier 对齐', () => {
  assert.strictEqual(M.BAR_KEYS.length, 6);
  M.BAR_KEYS.forEach((bk) => {
    const b = M.BARS[bk];
    assert.ok(b.name && b.job, bk + ' 缺名/黑话');
    assert.ok(M.ORES[b.ore], bk + ' 的原矿 ' + b.ore + ' 不在 ORES 里');
    assert.strictEqual(M.ORES[b.ore].tier, b.tier, bk + ' 档位应与原矿一致');
  });
  const tiers = M.BAR_KEYS.map((k) => M.BARS[k].tier).sort((a, b) => a - b);
  assert.deepStrictEqual(tiers, [1, 2, 3, 4, 5, 6]);
});

test('矿脉解锁门槛与 combat / equip 的档位三方一致', () => {
  for (let t = 1; t <= 6; t++) {
    const vein = M.VEIN_KEYS.find((k) => M.VEINS[k].tier === t);
    assert.strictEqual(M.VEINS[vein].unlock, C.TIER_BASE[t].unlock, 'T' + t + ' 与 combat 不一致');
    assert.strictEqual(M.VEINS[vein].unlock, E.TIER_UNLOCK[t], 'T' + t + ' 与 equip 不一致');
  }
  assert.strictEqual(M.VEINS.burn_seam.unlock, 1, '煤脉必须开局解锁，否则炼不出第一块锭');
});

test('veinUnlocked：按等级门槛，未知 key 为 false', () => {
  assert.strictEqual(M.veinUnlocked('heap_seam', 1), true);
  assert.strictEqual(M.veinUnlocked('block_void', 30), false);
  assert.strictEqual(M.veinUnlocked('block_void', 31), true);
  assert.strictEqual(M.veinUnlocked('nope', 99), false);
});

test('tickMs：agi 缩短间隔，50% 封顶，未知 key 为 0', () => {
  const base = M.VEINS.heap_seam.tickMs;
  assert.strictEqual(M.tickMs('heap_seam', { agi: 0 }), base);
  assert.strictEqual(M.tickMs('heap_seam', { agi: 100 }), Math.round(base * 0.5));
  assert.strictEqual(M.tickMs('heap_seam', { agi: 9999 }), Math.round(base * 0.5), '上限必须生效');
  assert.strictEqual(M.tickMs('heap_seam', null), base, '无属性时按基线');
  assert.strictEqual(M.tickMs('nope', { agi: 0 }), 0);
});

test('yieldPer：luk 触发双产，50% 封顶', () => {
  assert.strictEqual(M.yieldPer({ luk: 0 }, () => 0), 1, 'luk 0 恒单产');
  assert.strictEqual(M.yieldPer({ luk: 50 }, () => 0.1), 2, '0.1 < 0.2 命中');
  assert.strictEqual(M.yieldPer({ luk: 50 }, () => 0.5), 1, '0.5 > 0.2 未命中');
  assert.strictEqual(M.yieldPer({ luk: 9999 }, () => 0.49), 2, '上限 0.5 内命中');
  assert.strictEqual(M.yieldPer({ luk: 9999 }, () => 0.5), 1, '上限必须生效');
});

test('SMELT_XP 与 OFFLINE_CAP 合法', () => {
  [1, 2, 3, 4, 5, 6].forEach((t) => assert.ok(M.SMELT_XP[t] > 0, 'T' + t + ' 缺冶炼 xp'));
  assert.strictEqual(Object.keys(M.SMELT_XP).length, 6);
  assert.ok(M.OFFLINE_CAP > 0);
});

test('smeltRecipe：同档矿×3 + 煤×档位，未知 key 为 null', () => {
  const r1 = M.smeltRecipe('heap_bar');
  assert.strictEqual(r1.ores.heap_ore, 3);
  assert.strictEqual(r1.coal, 1);
  assert.strictEqual(r1.xp, M.SMELT_XP[1]);
  const r6 = M.smeltRecipe('void_bar');
  assert.strictEqual(r6.ores.void_ore, 3);
  assert.strictEqual(r6.coal, 6);
  assert.ok(r6.xp > r1.xp);
  assert.strictEqual(M.smeltRecipe('nope'), null);
});

test('smeltNeed：矿与煤合并成同一份需求映射，未知 key 为 null', () => {
  const n1 = M.smeltNeed('heap_bar');
  assert.deepStrictEqual(n1, { heap_ore: 3, burn_seg: 1 });
  const n6 = M.smeltNeed('void_bar');
  assert.deepStrictEqual(n6, { void_ore: 3, burn_seg: 6 });
  assert.strictEqual(M.smeltNeed('nope'), null);
});

test('smeltCheck：矿够煤不够 / 煤够矿不够 / 都够', () => {
  const noCoal = { ores: { heap_ore: 99, burn_seg: 0 } };
  const c1 = M.smeltCheck('heap_bar', noCoal);
  assert.strictEqual(c1.oresOk, true);
  assert.strictEqual(c1.coalOk, false);
  assert.strictEqual(c1.ok, false);

  const noOre = { ores: { heap_ore: 2, burn_seg: 99 } };
  const c2 = M.smeltCheck('heap_bar', noOre);
  assert.strictEqual(c2.oresOk, false);
  assert.strictEqual(c2.coalOk, true);
  assert.strictEqual(c2.ok, false);

  const rich = { ores: { heap_ore: 3, burn_seg: 1 } };
  assert.strictEqual(M.smeltCheck('heap_bar', rich).ok, true, '刚好够也算够');
});

test('smeltCheck：空存档不崩', () => {
  assert.strictEqual(M.smeltCheck('heap_bar', {}).ok, false);
  assert.strictEqual(M.smeltCheck('nope', { ores: {} }), null);
});

const FLAT = { agi: 0, luk: 0 };          // 无加成：间隔取基线，产出恒 1
const NEVER = () => 0.99;                 // rng 恒不命中双产

test('settleMining：按间隔产矿并给 xp，不足一格的时间保留到下次', () => {
  const v = M.VEINS.heap_seam;            // tickMs 3000, hp 10
  const mine = { vein: 'heap_seam', last: 0, hp: v.hp, until: 0 };
  const out = M.settleMining(mine, FLAT, 3000 * 3 + 500, NEVER);
  assert.strictEqual(out.ticks, 3);
  assert.strictEqual(out.ores.heap_ore, 3);
  assert.strictEqual(out.xp, v.xp * 3);
  assert.strictEqual(out.mine.hp, v.hp - 3);
  assert.strictEqual(out.mine.last, 9000, '余下 500ms 不结算，留到下次');
});

test('settleMining 不改入参（纯函数）', () => {
  const mine = { vein: 'heap_seam', last: 0, hp: 10, until: 0 };
  M.settleMining(mine, FLAT, 60000, NEVER);
  assert.strictEqual(mine.last, 0);
  assert.strictEqual(mine.hp, 10);
});

test('settleMining：挖空进再生 CD，CD 内不产出，CD 满自动补满耐久', () => {
  const v = M.VEINS.heap_seam;            // hp 10, tickMs 3000, respawn 20000
  const mine = { vein: 'heap_seam', last: 0, hp: v.hp, until: 0 };
  // 刚好挖空：10 次 × 3000ms
  const dug = M.settleMining(mine, FLAT, 30000, NEVER);
  assert.strictEqual(dug.ticks, 10);
  assert.strictEqual(dug.mine.hp, 0);

  // CD 中途：不再产出
  const inCd = M.settleMining(dug.mine, FLAT, 30000 + 10000, NEVER);
  assert.strictEqual(inCd.ticks, 0, '再生中不产出');
  assert.ok(inCd.mine.until > 30000 + 10000, '仍在 CD 内');

  // CD 结束后再挖一格：50000 = 挖空(30000) + CD(20000)，之后 3000ms 出一格
  const after = M.settleMining(dug.mine, FLAT, 30000 + 20000 + 3000, NEVER);
  assert.strictEqual(after.ticks, 1, 'CD 结束后恢复开采');
  assert.strictEqual(after.mine.hp, v.hp - 1, '再生后耐久补满再扣 1');
  assert.strictEqual(after.mine.until, 0, 'CD 已清');
});

test('settleMining：luk 双产写进产出', () => {
  const mine = { vein: 'heap_seam', last: 0, hp: 10, until: 0 };
  const out = M.settleMining(mine, { agi: 0, luk: 9999 }, 3000 * 2, () => 0);
  assert.strictEqual(out.ticks, 2);
  assert.strictEqual(out.ores.heap_ore, 4, '两格各双产');
});

test('settleMining：超长离线被 OFFLINE_CAP 截断且不死循环', () => {
  const mine = { vein: 'heap_seam', last: 0, hp: 10, until: 0 };
  const out = M.settleMining(mine, FLAT, 1000 * 60 * 60 * 24 * 30, NEVER);  // 30 天
  assert.ok(out.ticks <= M.OFFLINE_CAP, '产出不得超过上限');
  assert.ok(out.ticks > 0, '应该有产出');
  assert.strictEqual(out.mine.last, 1000 * 60 * 60 * 24 * 30, '截断后 last 跳到 now，不留补偿');
});

test('settleMining：vein 为 null 或未知 key 时优雅无操作', () => {
  const none = M.settleMining({ vein: null, last: 0, hp: 0, until: 0 }, FLAT, 99999, NEVER);
  assert.strictEqual(none.ticks, 0);
  assert.deepStrictEqual(none.ores, {});
  assert.strictEqual(none.mine.last, 99999, 'last 仍推进，避免下次重复结算');

  const bad = M.settleMining({ vein: 'corrupted', last: 0, hp: 5, until: 0 }, FLAT, 99999, NEVER);
  assert.strictEqual(bad.ticks, 0, '损坏的存档不能让每秒 render 崩掉');
});

test('settleMining：agi 缩短的间隔在结算循环里真正生效，不止在 tickMs 单测里', () => {
  // hp 给够大（远超本次会产出的次数），避免中途枯竭进 CD 干扰对比。
  const dur = 3000 * 10; // 30000ms，基线间隔下够出 10 次
  const base = M.settleMining({ vein: 'heap_seam', last: 0, hp: 999, until: 0 }, FLAT, dur, NEVER);
  const fast = M.settleMining({ vein: 'heap_seam', last: 0, hp: 999, until: 0 }, { agi: 100, luk: 0 }, dur, NEVER);
  assert.strictEqual(base.ticks, 10, '基线 3000ms/tick，30000ms 出 10 次');
  assert.strictEqual(fast.ticks, 20, 'agi 100 间隔减半（1500ms/tick），同样时长出 20 次');
});

test('settleMining：单次调用横跨 2 个完整的挖空-CD-补满周期，ticks 精确翻倍结算', () => {
  // heap_seam：hp 10、tickMs 3000、respawnMs 20000。
  // 1 个完整周期 = 挖空(10 ticks × 3000ms = 30000ms) + 等 CD(20000ms) = 50000ms，
  // CD 满后自动补满耐久、无缝进入下一轮同样的挖空。2 个周期 = 100000ms。
  // 用 node -e 对着实现实测过边界：ticks 在 now ∈ [80000, 103000) 这段区间稳定为 20，
  // 100000 落在区间中段（离两端都有万毫秒级余量），不是卡在某个 > / >= 分支切换的瞬间，
  // 所以下面这个断言不会因为「CD 是否已经在这一刻满」这种一次性巧合而变脆。
  const now = 2 * (3000 * 10 + 20000); // 100000
  const mine = { vein: 'heap_seam', last: 0, hp: 10, until: 0 };
  const out = M.settleMining(mine, FLAT, now, NEVER);
  assert.strictEqual(out.ticks, 20, '2 个周期各挖空一次矿脉（10 ticks），共产出 20 次');
  assert.strictEqual(out.mine.hp, 10, '第 2 次 CD 在 now 这一刻已经结束并补满耐久');
  assert.strictEqual(out.mine.until, 0, 'CD 已清零，不是仍在等待中的状态');
});

test('migrateMining：补默认字段，不覆盖已有数据', () => {
  const s = { coins: 5 };
  M.migrateMining(s, 1000);
  assert.deepStrictEqual(s.ores, {});
  assert.deepStrictEqual(s.bars, {});
  assert.deepStrictEqual(s.mine, { vein: null, last: 1000, hp: 0, until: 0, pool: {} });
  assert.strictEqual(s.stats.mined, 0);
  assert.strictEqual(s.coins, 5, '不动无关字段');

  const s2 = { ores: { heap_ore: 7 }, bars: { fsm_bar: 2 },
    mine: { vein: 'heap_seam', last: 500, hp: 4, until: 0 }, stats: { taps: 9 } };
  M.migrateMining(s2, 1000);
  assert.strictEqual(s2.ores.heap_ore, 7);
  assert.strictEqual(s2.bars.fsm_bar, 2);
  assert.strictEqual(s2.mine.hp, 4, '不重置进行中的开采');
  assert.strictEqual(s2.mine.last, 500);
  assert.strictEqual(s2.stats.taps, 9, '不覆盖已有统计');
  assert.strictEqual(s2.stats.mined, 0, '补上缺的统计项');
});

test('migrateMining：老存档的 oreCount 折成铜矿后清零', () => {
  const s = { oreCount: 3 };
  M.migrateMining(s, 1000);
  assert.strictEqual(s.ores.heap_ore, 3);
  assert.strictEqual(s.oreCount, 0);
});

test('migrateMining 幂等：重复调用不重复转换、不重置进度', () => {
  const s = { oreCount: 3 };
  M.migrateMining(s, 1000);
  s.mine = { vein: 'heap_seam', last: 800, hp: 6, until: 0 };
  s.ores.heap_ore += 5;
  M.migrateMining(s, 2000);
  assert.strictEqual(s.ores.heap_ore, 8, '不得二次转换 oreCount');
  assert.strictEqual(s.mine.hp, 6, '不得重置进行中的开采');
  assert.strictEqual(s.mine.last, 800);
});

test('migrateMining：mine 字段被写坏也能修回来', () => {
  const s = { mine: { vein: 'heap_seam' } };
  M.migrateMining(s, 1000);
  assert.strictEqual(s.mine.last, 1000);
  assert.strictEqual(s.mine.hp, 0);
  assert.strictEqual(s.mine.until, 0);
});

test('migrateMining：mine 对象缺 vein 键（不是 vein 存在但为其他值）也补 null', () => {
  // 与上一条的区别：上一条的 mine 自带 vein: 'heap_seam'，走的是 last/hp/until 缺省分支，
  // 从没碰过 `!('vein' in s.mine)` 这一行——这里给一个完全没有 vein 键的 mine 才会命中它。
  const s = { mine: { last: 1, hp: 1, until: 0 } };
  M.migrateMining(s, 1000);
  assert.strictEqual(s.mine.vein, null);
  assert.strictEqual(s.mine.last, 1, '不覆盖已有的 last');
  assert.strictEqual(s.mine.hp, 1, '不覆盖已有的 hp');
  assert.strictEqual(s.mine.until, 0);
});

test('migrateMining → settleMining 组合路径：全新存档迁移后可直接喂给 settleMining', () => {
  // 这是 farm.js load() 的真实调用链：先 migrateMining 补字段，再把 state.mine
  // 喂给每秒一次的 settleMining。全新存档 vein 为 null，只需保证不崩、无产出。
  const s = {};
  M.migrateMining(s, 1000);
  const out = M.settleMining(s.mine, FLAT, 5000, NEVER);
  assert.strictEqual(out.ticks, 0);
  assert.deepStrictEqual(out.ores, {});
});

test('migrateMining → settleMining 组合路径：老存档缺 last/hp/until，迁移后能正常挖出矿', () => {
  const v = M.VEINS.heap_seam;
  const s = { mine: { vein: 'heap_seam' } };
  M.migrateMining(s, 0);
  assert.deepStrictEqual(s.mine, { vein: 'heap_seam', last: 0, hp: 0, until: 0, pool: {} });
  // 迁移把 hp 补成 0，settleMining 把 hp<=0 当「已挖空」处理，会先完整烧一轮
  // respawnMs 才补满耐久开始挖，不是立刻可挖——这里特意跨过整个 CD（respawnMs）
  // 再多给 1 格 tickMs 的时间，验证 CD 结束后确实能正常产出。
  const out = M.settleMining(s.mine, FLAT, v.respawnMs + v.tickMs, NEVER);
  assert.strictEqual(out.ticks, 1, 'CD 结束后应挖出 1 格');
  assert.strictEqual(out.ores[v.ore], 1);
  assert.strictEqual(out.mine.hp, v.hp - 1, '补满耐久后再扣 1');
  assert.strictEqual(out.mine.until, 0, 'CD 已清');
});

// ---- switchVein：R-1 修复本体 ----------------------------------------

test('switchVein：切到新矿脉——存走当前矿脉的 hp/until，目标矿脉没挖过则给满耐久', () => {
  const mine = { vein: 'heap_seam', last: 1000, hp: 4, until: 0, pool: {} };
  const next = M.switchVein(mine, 'fsm_seam', 5000);
  assert.strictEqual(next.vein, 'fsm_seam');
  assert.strictEqual(next.last, 5000);
  assert.strictEqual(next.hp, M.VEINS.fsm_seam.hp, '新矿脉第一次挖，满耐久');
  assert.strictEqual(next.until, 0);
  assert.deepStrictEqual(next.pool.heap_seam, { hp: 4, until: 0 }, '旧矿脉的记录应被存进 pool');
});

test('switchVein：核心漏洞回归——挖空进 CD 后切走再切回，hp/until 必须原样保留', () => {
  // 复现审查报告里的手法：矿脉挖空进入再生 CD 后，点一下别的脉再点回来，
  // 修复前会被当成「换了个新矿脉」直接满耐久、清 CD，等于免费刷新节流。
  const v = M.VEINS.heap_seam;
  const drained = { vein: 'heap_seam', last: 30000, hp: 0, until: 30000 + v.respawnMs, pool: {} };
  const away = M.switchVein(drained, 'fsm_seam', 31000);
  assert.strictEqual(away.vein, 'fsm_seam');
  const back = M.switchVein(away, 'heap_seam', 31500);
  assert.strictEqual(back.vein, 'heap_seam');
  assert.strictEqual(back.hp, 0, '切回后耐久必须仍是挖空时的 0，不能被刷成满耐久');
  assert.strictEqual(back.until, 30000 + v.respawnMs, '切回后 CD 时间戳必须原样保留，不能被抹掉');
});

test('switchVein：非法矿脉 key 原样返回（防御）', () => {
  const mine = { vein: 'heap_seam', last: 0, hp: 5, until: 0, pool: {} };
  const next = M.switchVein(mine, 'nope', 9999);
  assert.strictEqual(next, mine, '非法 key 应原样返回同一个引用，不产生新对象');
});

test('switchVein：目标就是当前矿脉，原样返回', () => {
  const mine = { vein: 'heap_seam', last: 0, hp: 5, until: 0, pool: {} };
  const next = M.switchVein(mine, 'heap_seam', 9999);
  assert.strictEqual(next, mine);
});

test('switchVein：从未挖过任何矿脉（vein 为 null）时不会往 pool 塞无意义的记录', () => {
  const mine = { vein: null, last: 0, hp: 0, until: 0, pool: {} };
  const next = M.switchVein(mine, 'heap_seam', 1000);
  assert.strictEqual(next.vein, 'heap_seam');
  assert.strictEqual(next.hp, M.VEINS.heap_seam.hp);
  assert.deepStrictEqual(next.pool, {}, '没有旧矿脉可存');
});

test('switchVein 不改入参（纯函数），也不会就地修改 mine.pool', () => {
  const mine = { vein: 'heap_seam', last: 0, hp: 4, until: 0, pool: { fsm_seam: { hp: 9, until: 0 } } };
  const snapshot = JSON.parse(JSON.stringify(mine));
  M.switchVein(mine, 'fsm_seam', 1000);
  assert.deepStrictEqual(mine, snapshot);
});

test('switchVein：mine 没有 pool 字段也不崩（防御；正常应由 migrateMining 先补齐）', () => {
  const mine = { vein: 'heap_seam', last: 0, hp: 4, until: 0 };
  const next = M.switchVein(mine, 'fsm_seam', 1000);
  assert.strictEqual(next.vein, 'fsm_seam');
  assert.deepStrictEqual(next.pool.heap_seam, { hp: 4, until: 0 });
});

// ---- stopVein：R-1 的另一个入口——冶炼与开采互斥时用来停矿脉 -------------
// 起因：farm.js 的 startSmelt 曾经直接裸置 state.mine.vein = null 来停矿脉，
// 绕开了 switchVein 的 pool 记账，等于从另一个入口把 R-1 刚堵上的漏洞放了回来
// （挖到一半开炼再切回会被当成没挖过，白刷满耐久/跳过再生 CD）。stopVein 补上
// 这条路径，和 switchVein 一样必须先把当前矿脉的 hp/until 存进 pool。

test('stopVein：挖到一半开炼（stopVein）再切回同一条矿脉，hp 必须保留被打断时的值，不能刷满', () => {
  const mine = { vein: 'heap_seam', last: 10000, hp: 4, until: 0, pool: {} };
  const stopped = M.stopVein(mine, 12000);
  assert.strictEqual(stopped.vein, null, '停下后 vein 应为 null');
  assert.strictEqual(stopped.last, 12000);
  assert.deepStrictEqual(stopped.pool.heap_seam, { hp: 4, until: 0 }, '被打断的矿脉必须先存进 pool');
  const back = M.switchVein(stopped, 'heap_seam', 12500);
  assert.strictEqual(back.hp, 4, '切回后耐久必须仍是被打断时的 4，不能被刷成满耐久');
  assert.strictEqual(back.until, 0);
});

test('stopVein：挖空进 CD 时开炼（stopVein）再切回，until 必须原样保留，CD 不能被抹掉', () => {
  const v = M.VEINS.heap_seam;
  const drained = { vein: 'heap_seam', last: 30000, hp: 0, until: 30000 + v.respawnMs, pool: {} };
  const stopped = M.stopVein(drained, 31000);
  assert.strictEqual(stopped.vein, null);
  assert.deepStrictEqual(stopped.pool.heap_seam, { hp: 0, until: 30000 + v.respawnMs });
  const back = M.switchVein(stopped, 'heap_seam', 31500);
  assert.strictEqual(back.hp, 0, '切回后耐久必须仍是挖空时的 0，不能被刷成满耐久');
  assert.strictEqual(back.until, 30000 + v.respawnMs, '切回后 CD 时间戳必须原样保留，不能被抹掉');
});

test('stopVein：mine.vein 为 null（本来就没在挖）时原样返回（防御）', () => {
  const mine = { vein: null, last: 0, hp: 0, until: 0, pool: {} };
  const next = M.stopVein(mine, 9999);
  assert.strictEqual(next, mine, '没在挖时应原样返回同一个引用，不产生新对象');
});

test('stopVein 不改入参（纯函数），也不会就地修改 mine.pool', () => {
  const mine = { vein: 'heap_seam', last: 0, hp: 4, until: 0, pool: { fsm_seam: { hp: 9, until: 0 } } };
  const snapshot = JSON.parse(JSON.stringify(mine));
  M.stopVein(mine, 1000);
  assert.deepStrictEqual(mine, snapshot);
});

// ---- settleMining：pool 必须原样带出 ----------------------------------

test('settleMining：结算要原样带出 mine.pool，否则每秒 render 会把切脉记账擦掉', () => {
  const pool = { fsm_seam: { hp: 3, until: 12345 } };
  const mine = { vein: 'heap_seam', last: 0, hp: 10, until: 0, pool: pool };
  const out = M.settleMining(mine, FLAT, 3000, NEVER);
  assert.deepStrictEqual(out.mine.pool, pool, 'pool 必须原样带出，不能在结算里被丢掉');
});

test('settleMining：vein 为空提前返回时也要带出 pool', () => {
  const pool = { heap_seam: { hp: 3, until: 0 } };
  const mine = { vein: null, last: 0, hp: 0, until: 0, pool: pool };
  const out = M.settleMining(mine, FLAT, 5000, NEVER);
  assert.deepStrictEqual(out.mine.pool, pool);
});

// ---- migrateMining：pool 默认值 + O-1 数组防御 + O-3 损坏 vein 清理 ----

test('migrateMining：老存档没有 pool，补空对象——首次切脉仍是满耐久，行为不退化', () => {
  const s = { mine: { vein: 'heap_seam', last: 500, hp: 4, until: 0 } };
  M.migrateMining(s, 1000);
  assert.deepStrictEqual(s.mine.pool, {});
});

test('migrateMining：pool 不是对象（含数组/undefined）时补成空对象', () => {
  const s1 = { mine: { vein: 'heap_seam', pool: [1, 2, 3] } };
  M.migrateMining(s1, 1000);
  assert.deepStrictEqual(s1.mine.pool, {});

  const s2 = { mine: { vein: 'heap_seam', pool: undefined } };
  M.migrateMining(s2, 1000);
  assert.deepStrictEqual(s2.mine.pool, {});
});

test('O-1：ores/bars/stats 是数组时（typeof 兜不住数组）也要被兜成对象', () => {
  const s = { ores: [1, 2, 3], bars: ['a'], stats: [] };
  M.migrateMining(s, 1000);
  assert.ok(!Array.isArray(s.ores));
  assert.deepStrictEqual(s.ores, {});
  assert.ok(!Array.isArray(s.bars));
  assert.deepStrictEqual(s.bars, {});
  assert.ok(!Array.isArray(s.stats));
  assert.strictEqual(s.stats.mined, 0);
});

test('O-1：mine 是数组时也要被兜成默认对象（含 pool）', () => {
  const s = { mine: [] };
  M.migrateMining(s, 1000);
  assert.ok(!Array.isArray(s.mine));
  assert.strictEqual(s.mine.vein, null);
  assert.strictEqual(s.mine.hp, 0);
  assert.deepStrictEqual(s.mine.pool, {});
});

test('O-3：mine.vein 是未知/损坏 key 时清成 null（对齐 fishing.js 对 spot 的同类处理）', () => {
  const s = { mine: { vein: 'corrupted', last: 100, hp: 5, until: 0 } };
  M.migrateMining(s, 1000);
  assert.strictEqual(s.mine.vein, null, '损坏的 vein key 不能永久留在存档里');
});

test('O-3：mine.vein 是合法矿脉 key 时不受影响', () => {
  const s = { mine: { vein: 'fsm_seam', last: 100, hp: 5, until: 0 } };
  M.migrateMining(s, 1000);
  assert.strictEqual(s.mine.vein, 'fsm_seam');
});

// ---- 闭环集成测试：挖矿 → 冶炼 → 锻造 ----------------------------------

test('闭环集成：零存档迁移 → 挖煤+挖铜矿（含 switchVein）→ 冶炼成锭 → 满足锻造配方', () => {
  // 只用 mining.js + equip.js 两个纯模块，不依赖 farm.js，锁住跨模块的数值链路：
  // 以后谁改了 smeltRecipe 的配方公式，或 equip.recipe() 的 `1 + tier`，
  // 这条链断了测试会立刻红，而不是等人工在浏览器里点出来。
  const s = {};
  M.migrateMining(s, 1000);

  // 1) 蹲煤脉挖煤：burn_seam tickMs 3200，挖 2 格够冶炼 2 块铜锭用的煤（每块耗煤 1 档=1）。
  s.mine = M.switchVein(s.mine, 'burn_seam', 1000);
  const coalOut = M.settleMining(s.mine, FLAT, 1000 + 3200 * 2, NEVER);
  s.ores[M.COAL_KEY] = (s.ores[M.COAL_KEY] || 0) + (coalOut.ores[M.COAL_KEY] || 0);
  s.mine = coalOut.mine;
  assert.strictEqual(s.ores[M.COAL_KEY], 2, '应该挖到 2 块煤');

  // 2) 切到铜矿脉（heap_seam）挖铜矿：tickMs 3000，挖 6 格够冶炼 2 块铜锭（每块耗矿 3）。
  s.mine = M.switchVein(s.mine, 'heap_seam', s.mine.last);
  const oreOut = M.settleMining(s.mine, FLAT, s.mine.last + 3000 * 6, NEVER);
  s.ores.heap_ore = (s.ores.heap_ore || 0) + (oreOut.ores.heap_ore || 0);
  s.mine = oreOut.mine;
  assert.strictEqual(s.ores.heap_ore, 6, '应该挖到 6 块铜矿');

  // 3) smeltCheck 确认可炼，手动扣料模拟两次冶炼（doSmelt 在 farm.js 里，这里只验数值）。
  for (let i = 0; i < 2; i++) {
    const c = M.smeltCheck('heap_bar', s);
    assert.strictEqual(c.ok, true, '第 ' + (i + 1) + ' 次冶炼前材料应该足够');
    s.ores.heap_ore -= c.recipe.ores.heap_ore;
    s.ores[M.COAL_KEY] -= c.recipe.coal;
    s.bars.heap_bar = (s.bars.heap_bar || 0) + 1;
  }
  assert.strictEqual(s.bars.heap_bar, 2, '应该炼出 2 块铜锭');
  assert.strictEqual(s.ores.heap_ore, 0, '矿石应刚好耗尽');
  assert.strictEqual(s.ores[M.COAL_KEY], 0, '煤应刚好耗尽');

  // 4) 给足 wpn1（tier 1）配方所需的 mats/coins，断言锻造配方满足。
  s.mats = { page_scrap: E.recipe('wpn1').mats.page_scrap };
  s.coins = E.recipe('wpn1').coins;
  const rc = E.recipeCheck('wpn1', s, 1);
  assert.strictEqual(rc.ok, true, '挖矿→冶炼产出的锭应足以满足锻造配方');
});

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

test('settleSmelt：按间隔产锭，ores 是对 state.ores 的负增量，不改入参 state', () => {
  const s = { ores: { heap_ore: 10, burn_seg: 5 } };
  const smelt = { bar: 'heap_bar', last: 0 };
  const out = M.settleSmelt(smelt, s, M.SMELT_MS * 2);
  assert.strictEqual(out.ticks, 2);
  assert.strictEqual(out.bars.heap_bar, 2);
  assert.strictEqual(out.ores.heap_ore, -6, '每轮 3 矿，负增量——与 settleMining.ores 同语义，调用方统一用 +=');
  assert.strictEqual(out.ores.burn_seg, -2, '每轮 1 煤（T1），负增量');
  assert.strictEqual(out.xp, M.SMELT_XP[1] * 2);
  assert.strictEqual(out.stopped, false);
  assert.strictEqual(s.ores.heap_ore, 10, '不得改入参 state');
  assert.strictEqual(smelt.last, 0, '不得改入参 smelt');
});

test('settleSmelt：材料耗尽自动停止并置 stopped，last 也推进到 now', () => {
  const s = { ores: { heap_ore: 7, burn_seg: 5 } };   // 只够炼 2 轮（每轮 3 矿）
  const out = M.settleSmelt({ bar: 'heap_bar', last: 0 }, s, M.SMELT_MS * 10);
  assert.strictEqual(out.ticks, 2, '只能炼 2 个');
  assert.strictEqual(out.stopped, true);
  assert.strictEqual(out.smelt.bar, null, '停了就把 bar 清空，不空转');
  assert.strictEqual(out.smelt.last, M.SMELT_MS * 10, '材料耗尽提前终止也是「这次结算到此为止」，last 推进到 now，不留半格补偿');
});

test('settleSmelt：煤不够也会停，last 也推进到 now', () => {
  const s = { ores: { void_ore: 99, burn_seg: 6 } };  // T6 每轮要 6 煤，只够 1 轮
  const out = M.settleSmelt({ bar: 'void_bar', last: 0 }, s, M.SMELT_MS * 5);
  assert.strictEqual(out.ticks, 1);
  assert.strictEqual(out.stopped, true);
  assert.strictEqual(out.smelt.last, M.SMELT_MS * 5, 'last 同样推进到 now');
});

test('settleSmelt：矿石数量恰好整除时，边界判断不空转也不提前停', () => {
  const s = { ores: { heap_ore: 9, burn_seg: 3 } };  // 恰好够炼 3 轮，无余量
  const exact = M.settleSmelt({ bar: 'heap_bar', last: 0 }, s, M.SMELT_MS * 3);
  assert.strictEqual(exact.ticks, 3, '时间只够 3 轮，材料也恰好够 3 轮');
  assert.strictEqual(exact.stopped, false, '是时间到点自然停止，不是材料不够，不该误判 stopped');
  assert.strictEqual(exact.ores.heap_ore, -9);
  assert.strictEqual(exact.ores.burn_seg, -3);

  // 材料在恰好用尽后再给时间：第 4 轮 have 已经是 0，enough 判断得正确识别「不够」而停止，
  // 不能因为「差一点点」的边界写反而空转或多算一轮。
  const more = M.settleSmelt({ bar: 'heap_bar', last: 0 }, s, M.SMELT_MS * 4);
  assert.strictEqual(more.ticks, 3, '第 4 轮材料恰好耗尽，应正确停在 3 而不是空转成 4');
  assert.strictEqual(more.stopped, true);
  assert.strictEqual(more.smelt.last, M.SMELT_MS * 4, 'stopped 时 last 推进到 now');
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

test('smeltRounds：未知 key 为 0，空库存/无 ores 字段也为 0', () => {
  const rich = { ores: { heap_ore: 99, burn_seg: 99 } };
  assert.strictEqual(M.smeltRounds('nope', rich), 0, '未知锭 key');
  assert.strictEqual(M.smeltRounds('heap_bar', {}), 0, 'state 没有 ores 字段');
  assert.strictEqual(M.smeltRounds('heap_bar', null), 0, 'state 为空');
});

test('smeltRounds：矿限制——矿够 2 轮、煤够 10 轮，取更小的矿', () => {
  const s = { ores: { heap_ore: 6, burn_seg: 10 } };  // 每轮 3 矿 + 1 煤
  assert.strictEqual(M.smeltRounds('heap_bar', s), 2);
});

test('smeltRounds：煤限制——T6 每轮 6 煤，矿 99 煤 6，取更小的煤', () => {
  const s = { ores: { void_ore: 99, burn_seg: 6 } };  // 每轮 3 矿 + 6 煤
  assert.strictEqual(M.smeltRounds('void_bar', s), 1);
});

test('smeltRounds：恰好整除——矿 9 煤 3，T1 每轮 3 矿 1 煤，正好 3 轮', () => {
  const s = { ores: { heap_ore: 9, burn_seg: 3 } };
  assert.strictEqual(M.smeltRounds('heap_bar', s), 3);
});

test('smeltRounds：不整除——矿 7 需向下取整到 2 轮，不能算成 3', () => {
  // 每轮 3 矿 + 1 煤：矿 7 只够 2 轮整（第 3 轮差 2 个），煤 100 远超需求、不构成限制。
  // 这里专门卡在「不整除」上——floor(7/3)=2 与误写成 ceil(7/3)=3 在此处结果不同，
  // 能单独揪出「向下取整」被笔误改成「向上取整」的回归（恰好整除的库存做不到这一点）。
  const s = { ores: { heap_ore: 7, burn_seg: 100 } };
  assert.strictEqual(M.smeltRounds('heap_bar', s), 2);
});

test('smeltRounds 与 settleSmelt 交叉性质：极大 now 时，settleSmelt.ticks === min(smeltRounds, OFFLINE_CAP)', () => {
  const hugeNow = 1e13;  // 时间远超材料能撑到的轮数，时间不是限制因素
  const cases = [
    { bar: 'heap_bar', ores: { heap_ore: 6, burn_seg: 10 } },       // 矿限制，2 轮
    { bar: 'void_bar', ores: { void_ore: 99, burn_seg: 6 } },       // 煤限制，1 轮
    { bar: 'heap_bar', ores: { heap_ore: 9, burn_seg: 3 } },        // 恰好整除，3 轮
    { bar: 'heap_bar', ores: { heap_ore: 0, burn_seg: 0 } },        // 空库存，0 轮
    { bar: 'heap_bar', ores: { heap_ore: 1e9, burn_seg: 1e9 } },    // 会被 OFFLINE_CAP 截断
    { bar: 'heap_bar', ores: { heap_ore: 7, burn_seg: 100 } },      // 不整除，floor(7/3)=2 轮
  ];
  cases.forEach((c) => {
    const s = { ores: c.ores };
    const expected = Math.min(M.smeltRounds(c.bar, s), M.OFFLINE_CAP);
    const actual = M.settleSmelt({ bar: c.bar, last: 0 }, s, hugeNow).ticks;
    assert.strictEqual(actual, expected,
      c.bar + ' ' + JSON.stringify(c.ores) + '：显示的剩余轮数应与实际能炼出的数量一致');
  });
});

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

// ---- 开采与冶炼互斥：加载层裁决非法状态 --------------------------------
// selectVein/startSmelt 各自会清对方，但存档被手改坏、或将来某处漏清对方时，
// migrateMining（已经是把状态修回合法的那一层）必须兜底，不能让两块结算同时跑。

test('migrateMining：mine.vein 与 smelt.bar 同时非空——裁决保留开采（主线），停冶炼', () => {
  const s = { mine: { vein: 'heap_seam', last: 500, hp: 4, until: 0 },
    smelt: { bar: 'heap_bar', last: 500 } };
  M.migrateMining(s, 1000);
  assert.strictEqual(s.smelt.bar, null, '冶炼应被停下');
  assert.strictEqual(s.mine.vein, 'heap_seam', '开采保留不受影响');
});

test('migrateMining：只有开采在跑时，互斥裁决不误伤', () => {
  const s = { mine: { vein: 'heap_seam', last: 500, hp: 4, until: 0 },
    smelt: { bar: null, last: 500 } };
  M.migrateMining(s, 1000);
  assert.strictEqual(s.mine.vein, 'heap_seam');
  assert.strictEqual(s.smelt.bar, null);
});

test('migrateMining：只有冶炼在跑时，互斥裁决不误伤', () => {
  const s = { mine: { vein: null, last: 500, hp: 0, until: 0 },
    smelt: { bar: 'heap_bar', last: 500 } };
  M.migrateMining(s, 1000);
  assert.strictEqual(s.mine.vein, null);
  assert.strictEqual(s.smelt.bar, 'heap_bar', '冶炼不应被误停');
});

test('migrateMining：互斥裁决幂等，重复调用不再变化', () => {
  const s = { mine: { vein: 'heap_seam', last: 500, hp: 4, until: 0 },
    smelt: { bar: 'heap_bar', last: 500 } };
  M.migrateMining(s, 1000);
  M.migrateMining(s, 2000);
  assert.strictEqual(s.smelt.bar, null);
  assert.strictEqual(s.mine.vein, 'heap_seam');
});

// farm.js 是 DOM 层、没有单测覆盖，但「耐久记账」这条约束值得用源码断言锁住：
// 只要有人绕过 switchVein / stopVein 裸改 mine 的字段，「挖到一半切走再切回」
// 就能白刷满耐久、跳过再生 CD。这个洞已经换了两个入口复活过两次（切矿脉、开炼），
// 靠人工 review 守不住，这里用一条静态断言兜底。
test('farm.js 不得裸改 state.mine 的字段，必须走 switchVein / stopVein', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'skins', 'db-console', 'farm.js'), 'utf8');
  // =(?!=) 只匹配赋值，排除 === 之类的比较。
  const bare = src.match(/state\.mine\.(vein|hp|until|pool)\s*=(?!=)/g);
  assert.strictEqual(bare, null,
    '发现裸改 mine 字段（绕过 pool 耐久记账）：' + (bare || []).join(' , '));
});

// ---- 互斥本身的守卫：selectVein / startSmelt 必须真的清对方 -------------
// 互斥是本轮的招牌机制，但此前没有任何测试盯着它——把两处清对方的代码分别删掉，
// 全量测试依然 307 pass。这里用源码断言把「函数体内必须出现某个调用」锁住，
// 比只测 mining.js 的纯函数更接近事故现场：纯函数正确不代表 farm.js 真的调用了它。

const fs_ = require('node:fs');
const path_ = require('node:path');
const FARM_SRC = fs_.readFileSync(path_.join(__dirname, '..', 'skins', 'db-console', 'farm.js'), 'utf8');

// 粗粒度切函数体：从 `function name(` 开始，切到下一个顶层（2 空格缩进）function 声明之前。
// 够用就好——farm.js 里所有顶层函数都是 `^  function xxx(` 这个写法，见文件通读时的抽样统计。
function fnBody(src, name) {
  const marker = 'function ' + name + '(';
  const startIdx = src.indexOf(marker);
  assert.ok(startIdx >= 0, 'farm.js 里找不到 function ' + name);
  const nextIdx = src.indexOf('\n  function ', startIdx + marker.length);
  return nextIdx === -1 ? src.slice(startIdx) : src.slice(startIdx, nextIdx);
}

test('farm.js startSmelt 必须调用 Mining.stopVein 停矿脉（互斥的另一半）', () => {
  const body = fnBody(FARM_SRC, 'startSmelt');
  assert.ok(body.indexOf('Mining.stopVein(') >= 0,
    'startSmelt 应调用 Mining.stopVein 停下矿脉，否则开炼时开采会继续跑');
});

test('farm.js selectVein 必须清空 state.smelt（互斥的另一半）', () => {
  const body = fnBody(FARM_SRC, 'selectVein');
  assert.ok(body.indexOf('state.smelt =') >= 0,
    'selectVein 应清空 state.smelt，否则选矿脉时冶炼会继续跑');
});

// ---- 补上盲区：state.mine = {...} 整体替换抓不到 ------------------------
// 上面「不得裸改字段」那条测试的正则是 state\.mine\.(vein|hp|...)\s*=，只认逐字段赋值，
// 抓不到 state.mine = { ... } 这种整体替换——而这正是最现实的绕过路径：写法上跟旁边
// 合法的 `state.mine = Mining.switchVein(...)` 长得一样，靠眼睛扫代码容易放过。
test('farm.js 里所有 state.mine = 的整体替换，右侧必须是 switchVein/stopVein/mo.mine 之一', () => {
  const assigns = FARM_SRC.match(/state\.mine\s*=(?!=)([^;\n]*);/g) || [];
  // 先断言确实抓到了几处，否则正则本身失效时这条测试会永远绿灯（假阳性）。
  assert.ok(assigns.length >= 4, '至少应找到 4 处 state.mine = 赋值（render/selectVein/startSmelt/startCraft），实际 ' + assigns.length);
  assigns.forEach((line) => {
    const rhs = line.replace(/^state\.mine\s*=(?!=)/, '').replace(/;$/, '').trim();
    // 要求右侧整体就是这三种受信任表达式之一——而不是「行内某处出现过这个子串」。
    // 后者会被 `{ vein: key, pool: mo.mine.pool }` 这类手搓对象字面量绕过：它引用了
    // mo.mine 的某个字段当门面，但 vein/hp/until 仍是没经过 switchVein/stopVein 校验的
    // 裸值，跟旁边合法的整体替换长得像，实测这个坑注入后不锁 ^...$ 真的会被放过。
    const trusted = /^Mining\.switchVein\(.*\)$/.test(rhs)
      || /^Mining\.stopVein\(.*\)$/.test(rhs)
      || /^mo\.mine$/.test(rhs);
    assert.ok(trusted, '发现不受信任的 state.mine 整体替换：' + line.trim());
  });
});

// ---- 第三个挂机活动：刻符（magic spec）。三方互斥的守卫沿用上面 startSmelt / selectVein 那两条的写法 -------

test('farm.js startCraft 必须调用 Mining.stopVein 停矿脉、并清空 state.smelt（三方互斥）', () => {
  const body = fnBody(FARM_SRC, 'startCraft');
  assert.ok(body.indexOf('Mining.stopVein(') >= 0, 'startCraft 应调用 Mining.stopVein，否则开刻时开采会继续跑（且裸置 vein 会丢 pool 记账）');
  assert.ok(body.indexOf('state.smelt =') >= 0, 'startCraft 应清空 state.smelt，否则开刻时冶炼会继续跑');
});

test('farm.js startCraft：craftCheck 必须先于任何 mutation（失败的点击不能打断正在跑的矿脉/熔炉）', () => {
  const body = fnBody(FARM_SRC, 'startCraft');
  const iCheck = body.indexOf('Magic.craftCheck(');
  const iCraft = body.indexOf('state.craft =');
  const iSmelt = body.indexOf('state.smelt =');
  const iMine = body.indexOf('state.mine =');
  assert.ok(iCheck >= 0, 'startCraft 应调用 Magic.craftCheck');
  assert.ok(iCraft > iCheck && iSmelt > iCheck && iMine > iCheck, 'check 必须排在 state.craft / state.smelt / state.mine 三处赋值之前');
});

test('farm.js selectVein 必须清空 state.craft（三方互斥）', () => {
  assert.ok(fnBody(FARM_SRC, 'selectVein').indexOf('state.craft =') >= 0, 'selectVein 应清空 state.craft，否则选矿脉时刻符会继续跑');
});

test('farm.js startSmelt 必须清空 state.craft（三方互斥）', () => {
  assert.ok(fnBody(FARM_SRC, 'startSmelt').indexOf('state.craft =') >= 0, 'startSmelt 应清空 state.craft，否则开炼时刻符会继续跑');
});
