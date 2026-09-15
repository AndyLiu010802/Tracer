'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('../skins/db-console/magic.js');
const C = require('../skins/db-console/combat.js');
const E = require('../skins/db-console/equip.js');
const M = require('../skins/db-console/mining.js');
const F = require('../skins/db-console/fishing.js');

// 伪装下 tab 的 job（farm.js TABS 里的字面量；Task 5 接线时用源码断言锁住两边一致）。
const TAB_JOB = 'functions';

test('6 条法术、6 种符文：key 与 *_KEYS 一致、按 tier 升序、job 是 snake_case、游戏名含中文', () => {
  assert.strictEqual(G.SPELL_KEYS.length, 6);
  assert.strictEqual(Object.keys(G.SPELLS).length, 6);
  assert.strictEqual(G.RUNE_KEYS.length, 6);
  assert.strictEqual(Object.keys(G.RUNES).length, 6);
  assert.deepStrictEqual(G.SPELL_KEYS.map((k) => G.SPELLS[k].tier), [1, 2, 3, 4, 5, 6]);
  assert.deepStrictEqual(G.RUNE_KEYS.map((k) => G.RUNES[k].tier), [1, 2, 3, 4, 5, 6]);
  G.SPELL_KEYS.forEach((k) => {
    const sp = G.SPELLS[k];
    assert.strictEqual(sp.job, k, k + ' 的 job 应等于 key');
    assert.ok(/^[a-z][a-z0-9_]*$/.test(sp.job), k + ' job 不是 snake_case');
    assert.ok(/[\u{4e00}-\u{9fff}]/u.test(sp.name), k + ' 游戏名应含中文');
    assert.ok(sp.emoji, k + ' 缺 emoji');
  });
  G.RUNE_KEYS.forEach((k) => {
    const rn = G.RUNES[k];
    assert.strictEqual(rn.job, k, k + ' 的 job 应等于 key');
    assert.ok(/^[a-z][a-z0-9_]*$/.test(rn.job), k + ' job 不是 snake_case');
    assert.ok(/[\u{4e00}-\u{9fff}]/u.test(rn.name), k + ' 游戏名应含中文');
    assert.ok(rn.emoji, k + ' 缺 emoji');
  });
});

test('档位门槛四方一致：Magic.TIER_UNLOCK = Equip.TIER_UNLOCK = Combat.TIER_BASE.unlock = Mining.VEINS.unlock', () => {
  assert.deepStrictEqual(G.TIER_UNLOCK, E.TIER_UNLOCK);
  for (let t = 1; t <= 6; t++) {
    assert.strictEqual(G.TIER_UNLOCK[t], C.TIER_BASE[t].unlock, 'T' + t + ' 与 combat 不一致');
    const vein = M.VEIN_KEYS.find((k) => M.VEINS[k].tier === t);
    assert.strictEqual(G.TIER_UNLOCK[t], M.VEINS[vein].unlock, 'T' + t + ' 与 mining 不一致');
  }
  G.SPELL_KEYS.forEach((k) => assert.strictEqual(G.SPELLS[k].unlock, G.TIER_UNLOCK[G.SPELLS[k].tier], k + ' unlock 与档位不符'));
  G.RUNE_KEYS.forEach((k) => assert.strictEqual(G.RUNES[k].unlock, G.TIER_UNLOCK[G.RUNES[k].tier], k + ' unlock 与档位不符'));
});

test('符文原料指向 Mining 同档矿与锭；法术的符文同档；COAL_KEY / RUNE_XP / CRAFT_MS / OFFLINE_CAP 镜像 mining', () => {
  G.RUNE_KEYS.forEach((k) => {
    const rn = G.RUNES[k];
    assert.ok(M.ORES[rn.ore], k + ' 的矿 ' + rn.ore + ' 不在 Mining.ORES');
    assert.strictEqual(M.ORES[rn.ore].tier, rn.tier, k + ' 矿档位错位');
    assert.ok(M.BARS[rn.bar], k + ' 的锭 ' + rn.bar + ' 不在 Mining.BARS');
    assert.strictEqual(M.BARS[rn.bar].tier, rn.tier, k + ' 锭档位错位');
  });
  G.SPELL_KEYS.forEach((k) => {
    const sp = G.SPELLS[k];
    assert.ok(G.RUNES[sp.rune], k + ' 的符文 ' + sp.rune + ' 不在 RUNES');
    assert.strictEqual(G.RUNES[sp.rune].tier, sp.tier, k + ' 符文档位错位');
  });
  assert.strictEqual(G.COAL_KEY, M.COAL_KEY);
  assert.deepStrictEqual(G.RUNE_XP, M.SMELT_XP, '刻符与冶炼同为 2s/次的二次加工，xp/次必须相同');
  assert.strictEqual(G.CRAFT_MS, M.SMELT_MS);
  assert.strictEqual(G.OFFLINE_CAP, M.OFFLINE_CAP);
});

test('法书价：T1 为 0、严格递增、合计 424,000；power 与 INSCRIBE_COINS 递增；RUNE_BATCH = {ore:20, bar:80}', () => {
  const books = G.SPELL_KEYS.map((k) => G.SPELLS[k].book);
  assert.strictEqual(books[0], 0, 'T1 法书免费（新手自动拥有）');
  for (let i = 1; i < books.length; i++) assert.ok(books[i] > books[i - 1], '法书价应严格递增');
  assert.strictEqual(books.reduce((a, b) => a + b, 0), 424000);
  const powers = G.SPELL_KEYS.map((k) => G.SPELLS[k].power);
  for (let i = 1; i < powers.length; i++) assert.ok(powers[i] > powers[i - 1], 'power 应递增');
  for (let t = 2; t <= 6; t++) assert.ok(G.INSCRIBE_COINS[t] > G.INSCRIBE_COINS[t - 1], 'INSCRIBE_COINS 应递增');
  assert.deepStrictEqual(G.RUNE_BATCH, { ore: 20, bar: 80 });
});

test('power 对齐：同档全套刚到解锁级，法术总攻 = 近战总攻（spec 三.1 表）', () => {
  for (let t = 1; t <= 6; t++) {
    const lv = G.TIER_UNLOCK[t];
    const melee = C.playerStats(lv, E.equipBonus({ weapon: { key: 'wpn' + t, level: 0 }, special: { key: 'spc' + t, level: 0 } })).atk;
    const magic = C.playerStats(lv, E.equipBonus({ accessory: { key: 'acc' + t, level: 0 } })).matk + G.SPELLS[G.SPELL_KEYS[t - 1]].power;
    assert.strictEqual(magic, melee, 'T' + t + '：法术总攻 ' + magic + ' ≠ 近战总攻 ' + melee + '（combat/equip/magic 三处有一处改了）');
  }
});

test('跨模块撞词：SPELLS/RUNES job 与 tab job 两两不重复，且不与 mining/equip/combat/fishing 任何 job 重复', () => {
  const mine = [TAB_JOB].concat(G.SPELL_KEYS.map((k) => G.SPELLS[k].job), G.RUNE_KEYS.map((k) => G.RUNES[k].job));
  assert.strictEqual(new Set(mine).size, mine.length, 'Magic 自己的 job 有重复');
  const others = [];
  Object.keys(M.ORES).forEach((k) => others.push(M.ORES[k].job));
  M.BAR_KEYS.forEach((k) => others.push(M.BARS[k].job));
  M.VEIN_KEYS.forEach((k) => others.push(M.VEINS[k].job));
  E.EQUIP_KEYS.forEach((k) => others.push(E.EQUIP[k].job));
  E.SLOTS.forEach((k) => others.push(E.SLOT_META[k].job));
  C.MON_KEYS.forEach((k) => others.push(C.MONSTERS[k].job));
  Object.keys(C.MATERIALS).forEach((k) => others.push(C.MATERIALS[k].job));
  F.SPOT_KEYS.forEach((k) => others.push(F.SPOTS[k].job));
  F.FISH_KEYS.forEach((k) => others.push(F.FISH[k].job));
  Object.keys(F.MATERIALS).forEach((k) => others.push(F.MATERIALS[k].job));
  // 非空哨兵：将来某模块重构把 .job 字段改名，others 会悄悄变空、下面的撞词断言永远绿——先在这里红。当前实测 157 条。
  assert.ok(others.length > 100, '来源数组不该为空或过短，实际 ' + others.length);
  assert.strictEqual(others.filter((j) => j === undefined).length, 0, '有模块的 .job 字段读出 undefined');
  const clash = mine.filter((j) => others.indexOf(j) >= 0);
  assert.deepStrictEqual(clash, [], '与其他模块撞词：' + clash.join(','));
});

test('emoji 不与 Combat.MATERIALS / Mining.ORES / Mining.BARS 已占用的重复（spec 七）', () => {
  const strip = (s) => String(s).replace(/\u{FE0F}/gu, '');   // 去掉 emoji 的变体选择符再比较
  const used = [];
  Object.keys(C.MATERIALS).forEach((k) => used.push(strip(C.MATERIALS[k].emoji)));
  Object.keys(M.ORES).forEach((k) => used.push(strip(M.ORES[k].emoji)));
  M.BAR_KEYS.forEach((k) => used.push(strip(M.BARS[k].emoji)));
  // 非空哨兵：同上——.emoji 字段被改名时 used 变空，撞词断言就成了永远绿。当前实测 19 条。
  assert.ok(used.length > 10, '来源数组不该为空或过短，实际 ' + used.length);
  assert.strictEqual(used.filter((e) => e === 'undefined').length, 0, '有模块的 .emoji 字段读出 undefined（strip 会把它变成字符串 "undefined"）');
  const mine = G.SPELL_KEYS.map((k) => strip(G.SPELLS[k].emoji)).concat(G.RUNE_KEYS.map((k) => strip(G.RUNES[k].emoji)));
  assert.strictEqual(new Set(mine).size, mine.length, 'Magic 自己的 emoji 有重复');
  const clash = mine.filter((e) => used.indexOf(e) >= 0);
  assert.deepStrictEqual(clash, [], '与材料/矿石/锭 emoji 重复：' + clash.join(' '));
});

test('spellUnlocked / spellOwned：按等级门槛；T1 恒拥有；未知 key 为 false', () => {
  assert.strictEqual(G.spellUnlocked('vacuum_full', 1), true);
  assert.strictEqual(G.spellUnlocked('truncate_cascade', 30), false);
  assert.strictEqual(G.spellUnlocked('truncate_cascade', 31), true);
  assert.strictEqual(G.spellUnlocked('nope', 99), false);
  assert.strictEqual(G.spellOwned('vacuum_full', {}), true, 'T1 法书价 0，恒拥有');
  assert.strictEqual(G.spellOwned('vacuum_full', undefined), true);
  assert.strictEqual(G.spellOwned('reindex_concurrently', {}), false);
  assert.strictEqual(G.spellOwned('reindex_concurrently', { reindex_concurrently: true }), true);
  assert.strictEqual(G.spellOwned('nope', { nope: true }), false);
});

test('bookCheck：已购 → ok=false owned=true；等级/金币各自不足对应 flag 为 false；T1 恒 owned；未知 key 为 null', () => {
  const rich = { coins: 1e9, books: {} };
  const c1 = G.bookCheck('reindex_concurrently', rich, 5);
  assert.deepStrictEqual(c1, { price: 4000, owned: false, levelOk: true, coinsOk: true, ok: true });
  const c2 = G.bookCheck('reindex_concurrently', { coins: 3999, books: {} }, 5);
  assert.strictEqual(c2.coinsOk, false); assert.strictEqual(c2.levelOk, true); assert.strictEqual(c2.ok, false);
  const c3 = G.bookCheck('reindex_concurrently', rich, 4);
  assert.strictEqual(c3.levelOk, false); assert.strictEqual(c3.coinsOk, true); assert.strictEqual(c3.ok, false);
  const c4 = G.bookCheck('reindex_concurrently', { coins: 1e9, books: { reindex_concurrently: true } }, 99);
  assert.strictEqual(c4.owned, true); assert.strictEqual(c4.ok, false, '已购不能再买');
  const c5 = G.bookCheck('vacuum_full', { coins: 0, books: {} }, 1);
  assert.strictEqual(c5.owned, true); assert.strictEqual(c5.price, 0); assert.strictEqual(c5.ok, false);
  assert.strictEqual(G.bookCheck('nope', rich, 99), null);
  assert.strictEqual(G.bookCheck('reindex_concurrently', {}, 5).coinsOk, false, '空存档不崩');
});

test('castable：none / level / book / runes / ok 五态', () => {
  assert.deepStrictEqual(G.castable({ spell: null }, 99), { spell: null, rune: null, power: 0, ok: false, reason: 'none' });
  assert.strictEqual(G.castable({ spell: 'corrupted' }, 99).reason, 'none', '未知法术等同没选');
  assert.strictEqual(G.castable({}, 99).reason, 'none');
  const lv = G.castable({ spell: 'reindex_concurrently', books: { reindex_concurrently: true }, runes: { fsm_glyph: 9 } }, 4);
  assert.strictEqual(lv.reason, 'level'); assert.strictEqual(lv.ok, false);
  const bk = G.castable({ spell: 'reindex_concurrently', books: {}, runes: { fsm_glyph: 9 } }, 5);
  assert.strictEqual(bk.reason, 'book'); assert.strictEqual(bk.ok, false);
  const rn = G.castable({ spell: 'reindex_concurrently', books: { reindex_concurrently: true }, runes: { fsm_glyph: 0 } }, 5);
  assert.strictEqual(rn.reason, 'runes'); assert.strictEqual(rn.ok, false);
  assert.strictEqual(G.castable({ spell: 'reindex_concurrently', books: { reindex_concurrently: true } }, 5).reason, 'runes', '没有 runes 字段等同 0');
  const ok = G.castable({ spell: 'reindex_concurrently', books: { reindex_concurrently: true }, runes: { fsm_glyph: 1 } }, 5);
  assert.deepStrictEqual(ok, { spell: 'reindex_concurrently', rune: 'fsm_glyph', power: 15, ok: true, reason: null });
  const t1 = G.castable({ spell: 'vacuum_full', books: {}, runes: { heap_glyph: 3 } }, 1);
  assert.strictEqual(t1.ok, true, 'T1 不需要法书');
});

test('preserveChance：mdef × 0.004，上限 0.4；stats 缺失不抛', () => {
  assert.strictEqual(G.preserveChance({ mdef: 0 }), 0);
  assert.strictEqual(G.preserveChance({ mdef: 100 }), 0.4);
  assert.strictEqual(G.preserveChance({ mdef: 999 }), 0.4, '上限必须生效');
  assert.ok(Math.abs(G.preserveChance({ mdef: 54 }) - 0.216) < 1e-9, 'L31 裸装 mdef 54 → 21.6%');
  assert.strictEqual(G.preserveChance({}), 0);
  assert.strictEqual(G.preserveChance(undefined), 0);
  assert.strictEqual(G.PRESERVE_PER_MDEF, 0.004);
  assert.strictEqual(G.PRESERVE_CAP, 0.4);
});

// ---- 刻符：配方 / 校验 / 剩余次数 / 挂机结算（对齐 Mining.smeltRecipe / smeltCheck / smeltRounds / settleSmelt） ----

test('craftRecipe：矿路线 1 同档矿 + 1 煤 → 20，免费；锭路线 1 同档锭 + INSCRIBE_COINS[tier] 金币 → 80；两路 xp 相同', () => {
  const o1 = G.craftRecipe('heap_glyph', 'ore');
  assert.deepStrictEqual(o1, { ores: { heap_ore: 1, burn_seg: 1 }, bars: {}, coins: 0, out: 20, xp: G.RUNE_XP[1] });
  const b1 = G.craftRecipe('heap_glyph', 'bar');
  assert.deepStrictEqual(b1, { ores: {}, bars: { heap_bar: 1 }, coins: 10, out: 80, xp: G.RUNE_XP[1] });
  const b6 = G.craftRecipe('void_glyph', 'bar');
  assert.strictEqual(b6.coins, 60);
  assert.strictEqual(b6.bars.void_bar, 1);
  assert.strictEqual(b6.xp, G.RUNE_XP[6]);
  assert.strictEqual(G.craftRecipe('void_glyph', 'ore').xp, b6.xp, '两条路线每次 xp 相同（锭在冶炼时已给过 xp）');
});

test('craftRecipe：未知符文 / 非法 src → null', () => {
  assert.strictEqual(G.craftRecipe('nope', 'ore'), null);
  assert.strictEqual(G.craftRecipe('heap_glyph', 'coal'), null);
  assert.strictEqual(G.craftRecipe('heap_glyph', undefined), null);
  assert.strictEqual(G.craftRecipe(null, 'ore'), null);
});

test('craftCheck 矿路线：矿够煤不够 / 煤够矿不够 / 都够；空存档不崩；未知 rune 或 src 为 null', () => {
  const noCoal = G.craftCheck('heap_glyph', 'ore', { ores: { heap_ore: 9, burn_seg: 0 }, coins: 0 }, 1);
  assert.strictEqual(noCoal.oresOk, false); assert.strictEqual(noCoal.ok, false);
  assert.strictEqual(noCoal.barsOk, true, '矿路线不看锭'); assert.strictEqual(noCoal.coinsOk, true, '矿路线不花钱');
  const noOre = G.craftCheck('heap_glyph', 'ore', { ores: { heap_ore: 0, burn_seg: 9 } }, 1);
  assert.strictEqual(noOre.oresOk, false); assert.strictEqual(noOre.ok, false);
  const rich = G.craftCheck('heap_glyph', 'ore', { ores: { heap_ore: 1, burn_seg: 1 } }, 1);
  assert.strictEqual(rich.oresOk, true); assert.strictEqual(rich.ok, true, '刚好够也算够');
  assert.strictEqual(G.craftCheck('heap_glyph', 'ore', {}, 1).ok, false);
  assert.strictEqual(G.craftCheck('nope', 'ore', {}, 1), null);
  assert.strictEqual(G.craftCheck('heap_glyph', 'x', {}, 1), null);
});

test('craftCheck 锭路线：锭够金币不够 / 金币够锭不够 / 都够；等级不够单独报 levelOk', () => {
  const noCoin = G.craftCheck('heap_glyph', 'bar', { bars: { heap_bar: 5 }, coins: 9 }, 1);
  assert.strictEqual(noCoin.barsOk, true); assert.strictEqual(noCoin.coinsOk, false); assert.strictEqual(noCoin.ok, false);
  assert.strictEqual(noCoin.oresOk, true, '锭路线不看矿');
  const noBar = G.craftCheck('heap_glyph', 'bar', { bars: {}, coins: 999 }, 1);
  assert.strictEqual(noBar.barsOk, false); assert.strictEqual(noBar.coinsOk, true); assert.strictEqual(noBar.ok, false);
  const rich = G.craftCheck('heap_glyph', 'bar', { bars: { heap_bar: 1 }, coins: 10 }, 1);
  assert.strictEqual(rich.ok, true, '刚好够也算够');
  const low = G.craftCheck('void_glyph', 'bar', { bars: { void_bar: 9 }, coins: 1e9 }, 30);
  assert.strictEqual(low.levelOk, false); assert.strictEqual(low.ok, false);
  assert.strictEqual(low.barsOk && low.coinsOk, true, '只差等级');
  assert.strictEqual(G.craftCheck('void_glyph', 'bar', { bars: { void_bar: 9 }, coins: 1e9 }, 31).ok, true);
});

test('craftRounds：矿路线取矿与煤的更小者；锭路线取锭与金币的更小者（向下取整）；未知/空为 0', () => {
  assert.strictEqual(G.craftRounds('heap_glyph', 'ore', { ores: { heap_ore: 7, burn_seg: 3 } }), 3);
  assert.strictEqual(G.craftRounds('heap_glyph', 'ore', { ores: { heap_ore: 2, burn_seg: 99 } }), 2);
  assert.strictEqual(G.craftRounds('heap_glyph', 'bar', { bars: { heap_bar: 9 }, coins: 45 }), 4, '45 金币 / 10 = 4 次');
  assert.strictEqual(G.craftRounds('heap_glyph', 'bar', { bars: { heap_bar: 2 }, coins: 1e9 }), 2);
  assert.strictEqual(G.craftRounds('nope', 'ore', { ores: { heap_ore: 9 } }), 0);
  assert.strictEqual(G.craftRounds('heap_glyph', 'x', { ores: { heap_ore: 9 } }), 0);
  assert.strictEqual(G.craftRounds('heap_glyph', 'ore', {}), 0);
  assert.strictEqual(G.craftRounds('heap_glyph', 'ore', null), 0);
});

test('settleCraft 矿路线：ticks = floor(Δt/CRAFT_MS)，矿与煤负增量、符文正增量 ticks×20、xp，余数留到下次', () => {
  const s = { ores: { heap_ore: 10, burn_seg: 10 }, bars: {}, coins: 0 };
  const out = G.settleCraft({ rune: 'heap_glyph', src: 'ore', last: 0 }, s, G.CRAFT_MS * 3 + 700);
  assert.strictEqual(out.ticks, 3);
  assert.deepStrictEqual(out.ores, { heap_ore: -3, burn_seg: -3 }, '负增量——与 settleSmelt.ores 同语义，farm.js 一律 +=');
  assert.deepStrictEqual(out.bars, {});
  assert.strictEqual(out.coins, 0);
  assert.deepStrictEqual(out.runes, { heap_glyph: 60 });
  assert.strictEqual(out.xp, G.RUNE_XP[1] * 3);
  assert.strictEqual(out.stopped, false);
  assert.deepStrictEqual(out.craft, { rune: 'heap_glyph', src: 'ore', last: G.CRAFT_MS * 3 }, '余下 700ms 留到下次');
});

test('settleCraft 锭路线：锭负增量、金币负增量 ticks×INSCRIBE_COINS、符文 ticks×80', () => {
  const s = { ores: {}, bars: { void_bar: 5 }, coins: 1000 };
  const out = G.settleCraft({ rune: 'void_glyph', src: 'bar', last: 0 }, s, G.CRAFT_MS * 2);
  assert.strictEqual(out.ticks, 2);
  assert.deepStrictEqual(out.ores, {});
  assert.deepStrictEqual(out.bars, { void_bar: -2 });
  assert.strictEqual(out.coins, -2 * G.INSCRIBE_COINS[6]);
  assert.deepStrictEqual(out.runes, { void_glyph: 160 });
  assert.strictEqual(out.xp, G.RUNE_XP[6] * 2);
});

test('settleCraft：料尽自停——stopped=true、rune=null、src 保留、last=now；金币也是一种库存', () => {
  const coalShort = G.settleCraft({ rune: 'heap_glyph', src: 'ore', last: 0 }, { ores: { heap_ore: 99, burn_seg: 2 } }, G.CRAFT_MS * 10);
  assert.strictEqual(coalShort.ticks, 2, '煤只够 2 次');
  assert.strictEqual(coalShort.stopped, true);
  assert.strictEqual(coalShort.craft.rune, null, '停了就把 rune 清空，不空转');
  assert.strictEqual(coalShort.craft.src, 'ore', 'src 保留，下次再点同路线');
  assert.strictEqual(coalShort.craft.last, G.CRAFT_MS * 10, '料尽提前终止也是「到此为止」，last 推进到 now，不留半格补偿');
  const coinShort = G.settleCraft({ rune: 'heap_glyph', src: 'bar', last: 0 }, { bars: { heap_bar: 99 }, coins: 25 }, G.CRAFT_MS * 10);
  assert.strictEqual(coinShort.ticks, 2, '25 金币只够 2 次（每次 10）');
  assert.strictEqual(coinShort.coins, -20);
  assert.strictEqual(coinShort.stopped, true);
  assert.strictEqual(coinShort.craft.rune, null);
  const barShort = G.settleCraft({ rune: 'heap_glyph', src: 'bar', last: 0 }, { bars: { heap_bar: 1 }, coins: 1e9 }, G.CRAFT_MS * 10);
  assert.strictEqual(barShort.ticks, 1);
  assert.strictEqual(barShort.stopped, true);
});

test('settleCraft 不改入参 craft 与 state（深比较）', () => {
  const craft = { rune: 'heap_glyph', src: 'bar', last: 0 };
  const s = { ores: { heap_ore: 3 }, bars: { heap_bar: 3 }, coins: 100, runes: { heap_glyph: 1 } };
  const c0 = JSON.parse(JSON.stringify(craft)), s0 = JSON.parse(JSON.stringify(s));
  G.settleCraft(craft, s, G.CRAFT_MS * 5);
  assert.deepStrictEqual(craft, c0);
  assert.deepStrictEqual(s, s0);
});

test('settleCraft：超长离线被 OFFLINE_CAP 截断，last 跳到 now', () => {
  const s = { ores: { heap_ore: 1e9, burn_seg: 1e9 } };
  const out = G.settleCraft({ rune: 'heap_glyph', src: 'ore', last: 0 }, s, 1000 * 60 * 60 * 24 * 30);
  assert.strictEqual(out.ticks, G.OFFLINE_CAP);
  assert.strictEqual(out.runes.heap_glyph, G.OFFLINE_CAP * 20);
  assert.strictEqual(out.stopped, false);
  assert.strictEqual(out.craft.last, 1000 * 60 * 60 * 24 * 30, '截断后 last 跳到 now，不留补偿');
});

test('settleCraft：rune 为 null / 损坏、src 非法 → 无操作、ticks=0、last=now、不报 stopped', () => {
  const s = { ores: { heap_ore: 99, burn_seg: 99 }, bars: { heap_bar: 99 }, coins: 1e9 };
  const none = G.settleCraft({ rune: null, src: 'ore', last: 0 }, s, 99999);
  assert.strictEqual(none.ticks, 0);
  assert.deepStrictEqual(none.runes, {});
  assert.strictEqual(none.craft.last, 99999, 'last 仍推进，避免下次重复结算');
  const bad = G.settleCraft({ rune: 'corrupted', src: 'ore', last: 0 }, s, 99999);
  assert.strictEqual(bad.ticks, 0, '损坏的存档不能让每秒 render 崩掉');
  assert.strictEqual(bad.craft.last, 99999);
  const badSrc = G.settleCraft({ rune: 'heap_glyph', src: 'coal', last: 0 }, s, 99999);
  assert.strictEqual(badSrc.ticks, 0);
  assert.strictEqual(badSrc.craft.last, 99999);
  assert.strictEqual(badSrc.stopped, false, '不是料尽，不该报 stopped');
});

test('craftRounds 与 settleCraft 交叉性质：极大 now 时 ticks === min(craftRounds, OFFLINE_CAP)', () => {
  const hugeNow = 1e13;
  const cases = [
    { rune: 'heap_glyph', src: 'ore', s: { ores: { heap_ore: 7, burn_seg: 3 } } },
    { rune: 'heap_glyph', src: 'ore', s: { ores: { heap_ore: 0, burn_seg: 9 } } },
    { rune: 'void_glyph', src: 'bar', s: { bars: { void_bar: 9 }, coins: 125 } },
    { rune: 'void_glyph', src: 'bar', s: { bars: { void_bar: 1 }, coins: 1e9 } },
    { rune: 'heap_glyph', src: 'ore', s: { ores: { heap_ore: 1e9, burn_seg: 1e9 } } },
  ];
  cases.forEach((c) => {
    const expected = Math.min(G.craftRounds(c.rune, c.src, c.s), G.OFFLINE_CAP);
    const actual = G.settleCraft({ rune: c.rune, src: c.src, last: 0 }, c.s, hugeNow).ticks;
    assert.strictEqual(actual, expected, c.rune + '/' + c.src + ' ' + JSON.stringify(c.s) + '：显示的剩余次数应与实际刻出的次数一致');
  });
});

// ---- 存档迁移 ----------------------------------------------------------

test('migrateMagic：空对象 → 全默认，不动无关字段', () => {
  const s = { coins: 5 };
  G.migrateMagic(s, 1000);
  assert.deepStrictEqual(s.runes, {});
  assert.deepStrictEqual(s.books, {});
  assert.strictEqual(s.spell, null);
  assert.deepStrictEqual(s.craft, { rune: null, src: 'ore', last: 1000 });
  assert.strictEqual(s.stats.casts, 0);
  assert.strictEqual(s.coins, 5);
});

test('migrateMagic：不覆盖合法数据、不重置进行中的刻符', () => {
  const s = { runes: { heap_glyph: 12 }, books: { reindex_concurrently: true }, spell: 'reindex_concurrently',
    craft: { rune: 'fsm_glyph', src: 'bar', last: 500 }, stats: { taps: 9, casts: 4 } };
  G.migrateMagic(s, 1000);
  assert.deepStrictEqual(s.runes, { heap_glyph: 12 });
  assert.deepStrictEqual(s.books, { reindex_concurrently: true });
  assert.strictEqual(s.spell, 'reindex_concurrently');
  assert.deepStrictEqual(s.craft, { rune: 'fsm_glyph', src: 'bar', last: 500 });
  assert.strictEqual(s.stats.taps, 9); assert.strictEqual(s.stats.casts, 4);
});

test('migrateMagic：损坏清理——runes 数组/未知 key/NaN/负数/小数/字符串/Infinity，books 未知 key/值统一 true，spell 未知，craft 数组/src 非法/last NaN，stats 数组', () => {
  const s1 = { runes: [1, 2], books: ['x'], spell: 'corrupted', craft: [], stats: [] };
  G.migrateMagic(s1, 1000);
  assert.deepStrictEqual(s1.runes, {}); assert.deepStrictEqual(s1.books, {});
  assert.strictEqual(s1.spell, null);
  assert.deepStrictEqual(s1.craft, { rune: null, src: 'ore', last: 1000 });
  assert.ok(!Array.isArray(s1.stats)); assert.strictEqual(s1.stats.casts, 0);

  const s2 = { runes: { heap_glyph: 3.7, fsm_glyph: -2, vm_glyph: NaN, brin_glyph: '9', nope: 5, void_glyph: Infinity },
    books: { reindex_concurrently: 1, nope: true },
    craft: { rune: 'corrupted', src: 'coal', last: NaN }, stats: { casts: NaN } };
  G.migrateMagic(s2, 1000);
  assert.deepStrictEqual(s2.runes, { heap_glyph: 3 }, '小数 floor；负数/NaN/字符串/未知 key/Infinity 全删');
  assert.deepStrictEqual(s2.books, { reindex_concurrently: true }, '未知 key 删，值统一 true');
  assert.strictEqual(s2.spell, null, '缺 spell 字段补 null');
  assert.deepStrictEqual(s2.craft, { rune: null, src: 'ore', last: 1000 });
  assert.strictEqual(s2.stats.casts, 0);

  const s3 = { craft: { src: 'bar', last: 0 } };
  G.migrateMagic(s3, 1000);
  assert.deepStrictEqual(s3.craft, { rune: null, src: 'bar', last: 0 }, '缺 rune 键补 null；合法的 src 与 last=0 不动（不用 ||）');
});

test('migrateMagic 幂等：两次调用深等', () => {
  const s = { runes: { heap_glyph: 3.7, nope: 1 }, books: { reindex_concurrently: 1 }, spell: 'vacuum_full',
    craft: { rune: 'heap_glyph', src: 'ore', last: 500 }, mine: { vein: null }, smelt: { bar: null } };
  G.migrateMagic(s, 1000);
  const once = JSON.parse(JSON.stringify(s));
  G.migrateMagic(s, 2000);
  assert.deepStrictEqual(s, once);
});

test('migrateMagic 裁决：mine.vein 与 craft.rune 同时非空 → 保留开采、停刻符（只清 rune）', () => {
  const s = { mine: { vein: 'heap_seam', last: 500, hp: 4, until: 0, pool: {} }, smelt: { bar: null, last: 500 },
    craft: { rune: 'heap_glyph', src: 'ore', last: 500 } };
  G.migrateMagic(s, 1000);
  assert.strictEqual(s.craft.rune, null, '刻符应被停下');
  assert.strictEqual(s.mine.vein, 'heap_seam', '开采保留');
  assert.deepStrictEqual([s.craft.src, s.craft.last], ['ore', 500], '只清 rune，不动 src/last');
});

test('migrateMagic 裁决：smelt.bar 与 craft.rune 同时非空 → 保留冶炼、停刻符', () => {
  const s = { mine: { vein: null, last: 500, hp: 0, until: 0, pool: {} }, smelt: { bar: 'heap_bar', last: 500 },
    craft: { rune: 'heap_glyph', src: 'ore', last: 500 } };
  G.migrateMagic(s, 1000);
  assert.strictEqual(s.craft.rune, null);
  assert.strictEqual(s.smelt.bar, 'heap_bar', '冶炼保留');
});

test('migrateMagic 裁决：只有刻符在跑时不误伤；老存档没有 mine/smelt 字段也不崩', () => {
  const s = { mine: { vein: null }, smelt: { bar: null }, craft: { rune: 'heap_glyph', src: 'ore', last: 500 } };
  G.migrateMagic(s, 1000);
  assert.strictEqual(s.craft.rune, 'heap_glyph', '刻符不应被误停');
  const s2 = { craft: { rune: 'heap_glyph', src: 'ore', last: 500 } };
  G.migrateMagic(s2, 1000);
  assert.strictEqual(s2.craft.rune, 'heap_glyph');
});

// ---- 闭环集成（纯模块，不依赖 farm.js）：迁移 → 挖煤/挖铜 → 矿路线刻符 → castable → 施法伤害 -------
// 锁住跨模块数值链路：谁改了 Mining 的矿脉节奏、Magic 的配方、Combat 的魔法公式，这条链断了测试立刻红。

test('闭环集成：Lv1 裸装挖 2 煤 2 铜 → 刻 2 次得 40 铜符 → vacuum_full 打 dead_tuple 伤害 = matk 8 + power 8 − mdef 3 = 13', () => {
  const FLAT = { agi: 0, luk: 0 }, NEVER = () => 0.99;
  const s = { coins: 0 };
  M.migrateMining(s, 1000);
  G.migrateMagic(s, 1000);
  s.mine = M.switchVein(s.mine, 'burn_seam', 1000);
  const coal = M.settleMining(s.mine, FLAT, 1000 + 3200 * 2, NEVER);
  s.ores[M.COAL_KEY] = (s.ores[M.COAL_KEY] || 0) + coal.ores[M.COAL_KEY]; s.mine = coal.mine;
  s.mine = M.switchVein(s.mine, 'heap_seam', s.mine.last);
  const ore = M.settleMining(s.mine, FLAT, s.mine.last + 3000 * 2, NEVER);
  s.ores.heap_ore = (s.ores.heap_ore || 0) + ore.ores.heap_ore; s.mine = ore.mine;
  assert.deepStrictEqual([s.ores[M.COAL_KEY], s.ores.heap_ore], [2, 2]);
  // 刻符（farm.js 的 startCraft 会先 stopVein；这里只验数值链路）
  s.mine = M.stopVein(s.mine, s.mine.last);
  s.craft = { rune: 'heap_glyph', src: 'ore', last: 0 };
  const co = G.settleCraft(s.craft, s, G.CRAFT_MS * 2);
  for (const k in co.ores) s.ores[k] = (s.ores[k] || 0) + co.ores[k];
  for (const k in co.runes) s.runes[k] = (s.runes[k] || 0) + co.runes[k];
  s.craft = co.craft;
  assert.deepStrictEqual([s.ores.heap_ore, s.ores[M.COAL_KEY], s.runes.heap_glyph], [0, 0, 40]);
  // 施法（spec 九.4 的验收数字）
  s.spell = 'vacuum_full';
  const cs = G.castable(s, 1);
  assert.strictEqual(cs.ok, true);
  const ps = C.playerStats(1, {}); ps.castPower = cs.power;
  const hit = C.attack(ps, C.monsterStats('dead_tuple'), NEVER);
  assert.deepStrictEqual([hit.dmg, hit.magic], [13, true]);
});

// ---- farm.js 源码断言：farm.js 是 DOM 层、无单测，沿 mining.test.js 的做法用正则锁约束 ---------------
const fs = require('node:fs');
const path = require('node:path');
const FARM_SRC = fs.readFileSync(path.join(__dirname, '..', 'skins', 'db-console', 'farm.js'), 'utf8');

// 粗粒度切函数体：从 `function name(` 切到下一个顶层（2 空格缩进）function 声明之前。与 mining.test.js 同一份写法。
function fnBody(src, name) {
  const marker = 'function ' + name + '(';
  const startIdx = src.indexOf(marker);
  assert.ok(startIdx >= 0, 'farm.js 里找不到 function ' + name);
  const nextIdx = src.indexOf('\n  function ', startIdx + marker.length);
  return nextIdx === -1 ? src.slice(startIdx) : src.slice(startIdx, nextIdx);
}
// 同上，但返回在整个源码里的 [start, end) 下标区间——用来判断某个正则命中落在哪个函数里。
function fnRange(src, name) {
  const marker = 'function ' + name + '(';
  const start = src.indexOf(marker);
  assert.ok(start >= 0, 'farm.js 里找不到 function ' + name);
  const next = src.indexOf('\n  function ', start + marker.length);
  return { start: start, end: next === -1 ? src.length : next };
}

test('farm.js 接线：引用 Magic；TABS 里 magic tab 的 job 与测试里的 TAB_JOB 一致；load 里 migrateMagic 排在 migrateMining 之后', () => {
  assert.ok(FARM_SRC.indexOf('var Magic = window.Magic;') >= 0, 'farm.js 顶部应取 window.Magic');
  assert.ok(FARM_SRC.indexOf("{ id: 'magic', job: '" + TAB_JOB + "'") >= 0, 'TABS 里应有 magic tab 且 job 为 ' + TAB_JOB);
  const load = fnBody(FARM_SRC, 'load');
  const iMining = load.indexOf('Mining.migrateMining(');
  const iMagic = load.indexOf('Magic.migrateMagic(');
  assert.ok(iMining >= 0 && iMagic >= 0, 'load 里应调用两个迁移');
  assert.ok(iMining < iMagic, 'migrateMagic 的三方裁决依赖 mine/smelt 已修好，必须排在 migrateMining 之后');
});

test('farm.js render：刻符结算块位于冶炼结算之后、钓鱼回收之前', () => {
  const body = fnBody(FARM_SRC, 'render');
  const iSmelt = body.indexOf('Mining.settleSmelt(');
  const iCraft = body.indexOf('Magic.settleCraft(');
  const iFish = body.indexOf('Fishing.settleReclaim(');
  assert.ok(iSmelt >= 0 && iCraft >= 0 && iFish >= 0, 'render 里应有三块结算');
  assert.ok(iSmelt < iCraft && iCraft < iFish, 'settleCraft 应严格位于 settleSmelt 之后、settleReclaim 之前');
});

test('farm.js 不得裸改 state.craft.rune；state.craft 只能整体替换为 { rune: … } 字面量或 co.craft', () => {
  // =(?!=) 只匹配赋值，排除 === 之类的比较。
  const bare = FARM_SRC.match(/state\.craft\.rune\s*=(?!=)/g);
  assert.strictEqual(bare, null, '发现裸改 state.craft.rune：' + (bare || []).join(' , '));
  const assigns = FARM_SRC.match(/state\.craft\s*=(?!=)([^;\n]*);/g) || [];
  // 先断言确实抓到了几处，否则正则失效时这条测试永远绿灯（假阳性）。
  assert.ok(assigns.length >= 5, '至少应找到 5 处 state.craft = 赋值（render/selectVein/startSmelt/startCraft/stopCraft），实际 ' + assigns.length);
  assigns.forEach((line) => {
    const rhs = line.replace(/^state\.craft\s*=(?!=)/, '').replace(/;$/, '').trim();
    assert.ok(/^\{ rune: .*\}$/.test(rhs) || rhs === 'co.craft', '发现不受信任的 state.craft 整体替换：' + line.trim());
  });
});

test('farm.js 符文只有三个写入站点：render 2 处（刻符产出、离线施法扣减）+ battleTick 1 处（在线施法扣减）', () => {
  // 符文只进不出（不可售/不可锁/无商店），没有第二个来源；写入站点一多就是有人开了后门。
  // 同时抓 state.runes[k] = 与 state.runes.k = 两种写法，否则点号写法就是一个现成的后门。
  const re = /state\.runes(\[[^\]]*\]|\.[A-Za-z_$][\w$]*)\s*[+-]?=(?!=)/g;
  const sites = [];
  let m;
  while ((m = re.exec(FARM_SRC)) !== null) sites.push(m.index);
  assert.strictEqual(sites.length, 3, '符文写入站点应恰为 3 处，实际 ' + sites.length);
  const render = fnRange(FARM_SRC, 'render'), tick = fnRange(FARM_SRC, 'battleTick');
  const inRender = sites.filter((i) => i >= render.start && i < render.end).length;
  const inTick = sites.filter((i) => i >= tick.start && i < tick.end).length;
  assert.strictEqual(inRender, 2, 'render 里应有 2 处（刻符产出 + 离线施法扣减）');
  assert.strictEqual(inTick, 1, 'battleTick 里应有 1 处（在线施法扣减）');
});
