(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Magic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 档位门槛：镜像 Combat.TIER_BASE[t].unlock / Equip.TIER_UNLOCK / Mining.VEINS[].unlock——这是第四处。
  // magic 不 require 兄弟模块（同 Equip.TIER_BAR 镜像 Mining.BARS 的做法），四方一致由 magic.test.js 守。
  var TIER_UNLOCK = { 1: 1, 2: 5, 3: 10, 4: 16, 5: 23, 6: 31 };
  // 煤：镜像 Mining.COAL_KEY。刻符矿路线直接拿煤当「通用精华」（反哺煤脉价值，不加 VEINS 行）。
  var COAL_KEY = 'burn_seg';

  // 符文：key 永不改。ore / bar 指向 Mining 同档矿与锭（刻符配方由此派生）。
  // 伪装名叫 glyph（编译产物），刻意避开装备已用的 rune / codex；job 前缀镜像矿石 heap_/fsm_/vm_/brin_/tblspc_/void_，
  // 伪装下也能一眼对上矿档。emoji 避开 Combat.MATERIALS / Mining.ORES / Mining.BARS 已占用的（测试守）。
  var RUNES = {
    heap_glyph:   { name: '铜符',   job: 'heap_glyph',   tier: 1, unlock: 1,  ore: 'heap_ore',   bar: 'heap_bar',   emoji: '\u{1F9FF}' },
    fsm_glyph:    { name: '铁符',   job: 'fsm_glyph',    tier: 2, unlock: 5,  ore: 'fsm_ore',    bar: 'fsm_bar',    emoji: '\u{1F4FF}' },
    vm_glyph:     { name: '秘银符', job: 'vm_glyph',     tier: 3, unlock: 10, ore: 'vm_ore',     bar: 'vm_bar',     emoji: '\u{1FAAC}' },
    brin_glyph:   { name: '精金符', job: 'brin_glyph',   tier: 4, unlock: 16, ore: 'brin_ore',   bar: 'brin_bar',   emoji: '\u{1F52E}' },
    tblspc_glyph: { name: '陨铁符', job: 'tblspc_glyph', tier: 5, unlock: 23, ore: 'tblspc_ore', bar: 'tblspc_bar', emoji: '\u{1F56F}\u{FE0F}' },
    void_glyph:   { name: '虚空符', job: 'void_glyph',   tier: 6, unlock: 31, ore: 'void_ore',   bar: 'void_bar',   emoji: '\u{1F311}' },
  };
  var RUNE_KEYS = ['heap_glyph', 'fsm_glyph', 'vm_glyph', 'brin_glyph', 'tblspc_glyph', 'void_glyph'];

  // 法术：一档一条，key 永不改。job 取 PostgreSQL 维护命令的命令形（VACUUM FULL / REINDEX CONCURRENTLY / …），
  // 刻意不叫 autovacuum / checkpointer（那是动物的 job）。
  // power 不是拍的：让「同档全套、刚到解锁级」的法术总攻（裸 matk + 同档饰品 matk + power）
  // 等于近战总攻（裸 atk + 同档武器 atk + 同档特殊 atk），见 spec 三.1 表；magic.test.js 里那条等式一改就红。
  // book 是法书价（金币，一次性 sink，合计 424,000）；T1 为 0 = 自动拥有（Melvor Wind Strike）。
  // 裂地刺 spec 原写 🪨(U+1FAA8)，但那是 Mining.ORES.tblspc_ore 的 emoji，与 spec 七「避开 ORES 已占用」冲突，改用 🌋。
  var SPELLS = {
    vacuum_full:          { name: '疾风斩',   job: 'vacuum_full',          tier: 1, unlock: 1,  power: 8,  rune: 'heap_glyph',   book: 0,      emoji: '\u{1F32A}\u{FE0F}' },
    reindex_concurrently: { name: '寒霜箭',   job: 'reindex_concurrently', tier: 2, unlock: 5,  power: 15, rune: 'fsm_glyph',    book: 4000,   emoji: '\u{2744}\u{FE0F}' },
    cluster_table:        { name: '裂地刺',   job: 'cluster_table',        tier: 3, unlock: 10, power: 26, rune: 'vm_glyph',     book: 15000,  emoji: '\u{1F30B}' },
    checkpoint_force:     { name: '烈焰球',   job: 'checkpoint_force',     tier: 4, unlock: 16, power: 41, rune: 'brin_glyph',   book: 45000,  emoji: '\u{1F525}' },
    drop_cascade:         { name: '雷霆击',   job: 'drop_cascade',         tier: 5, unlock: 23, power: 60, rune: 'tblspc_glyph', book: 110000, emoji: '\u{26A1}' },
    truncate_cascade:     { name: '虚空湮灭', job: 'truncate_cascade',     tier: 6, unlock: 31, power: 83, rune: 'void_glyph',   book: 250000, emoji: '\u{1F30C}' },
  };
  var SPELL_KEYS = ['vacuum_full', 'reindex_concurrently', 'cluster_table', 'checkpoint_force', 'drop_cascade', 'truncate_cascade'];

  // 刻符 xp/次：与 Mining.SMELT_XP 完全相同（自持一份，测试断言相等）。刻符与冶炼都是 2s/次的二次加工，
  // xp/时相同才不会让玩家为 xp 在两者之间摇摆；两条路线每次 xp 也相同（锭路线的锭已经在冶炼时给过 xp）。
  var RUNE_XP = { 1: 3, 2: 7, 3: 14, 4: 25, 5: 44, 6: 75 };
  // 锭路线手续费（金币/次）：随施法吞吐线性流出的经常性 sink。
  var INSCRIBE_COINS = { 1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60 };
  // 一次刻符的产出。锭路线 80 而非 40：80 符按矿路线折算的价值恰与锭售价持平，「卖锭」与「锭刻符」价值中立，
  // 手续费就是净 sink；每矿多出 33% 符文是花钱买的。取 40 的话每矿只有 13 符，永远被矿路线压制。
  var RUNE_BATCH = { ore: 20, bar: 80 };
  // 刻符间隔：固定值、不吃任何属性（同 Mining.SMELT_MS）。刻符永远是短活——1,800 次/时会吃掉 1,800 矿 + 1,800 煤，
  // 远超任何矿脉的产量，提速无感；矿石库存才是真约束。
  var CRAFT_MS = 2000;
  // 离线上限（次），与冶炼同口径（= 66.7 分钟）。只给刻符改口径会让它成为三方互斥里唯一「过夜不亏」的活动。
  var OFFLINE_CAP = 2000;
  // 符文保留率 = min(PRESERVE_CAP, mdef × PRESERVE_PER_MDEF)。上限 0.4 需要 mdef 100：L31 裸装 54 → 21.6%，
  // +arm6 → 34.4%，+acc6 → 顶满——防具与饰品都有贡献，不让饰品一枝独秀。
  var PRESERVE_PER_MDEF = 0.004;
  var PRESERVE_CAP = 0.4;

  function spellUnlocked(key, level) {
    var sp = SPELLS[key];
    return !!sp && (level || 0) >= sp.unlock;
  }

  // 法书价 0 的法术（T1）恒拥有——新手不用买就能施第一条法术。
  function spellOwned(key, books) {
    var sp = SPELLS[key]; if (!sp) return false;
    if (sp.book === 0) return true;
    return !!(books && books[key]);
  }

  // 法书能不能买：等级 + 金币双门槛（与矿脉、锻造一致，避免新手把钱砸进用不了的法术）；已购不重复卖。
  function bookCheck(key, state, level) {
    var sp = SPELLS[key]; if (!sp) return null;
    var owned = spellOwned(key, state && state.books);
    var levelOk = (level || 0) >= sp.unlock;
    var coinsOk = ((state && state.coins) || 0) >= sp.book;
    return { price: sp.book, owned: owned, levelOk: levelOk, coinsOk: coinsOk, ok: !owned && levelOk && coinsOk };
  }

  // 当前这一击能不能施法。reason 单选，按「不能施法的最根本原因」排序：没选 > 等级 > 法书 > 符文。
  // farm.js 每回合现算：符文烧完自动退回普攻、刻出新符文又自动接上，战斗永远不会「停下来」。
  function castable(state, level) {
    var key = state && state.spell;
    var sp = SPELLS[key];
    if (!sp) return { spell: null, rune: null, power: 0, ok: false, reason: 'none' };
    var out = { spell: key, rune: sp.rune, power: sp.power, ok: false, reason: null };
    if (!spellUnlocked(key, level)) { out.reason = 'level'; return out; }
    if (!spellOwned(key, state.books)) { out.reason = 'book'; return out; }
    if (((state.runes || {})[sp.rune] || 0) <= 0) { out.reason = 'runes'; return out; }
    out.ok = true;
    return out;
  }

  // mdef 一身二用：承受 caster 魔攻 + 符文保留率。stats 由调用方从 Combat.playerStats 算好传入，缺 mdef 视为 0。
  function preserveChance(stats) {
    var mdef = (stats && stats.mdef) || 0;
    return Math.min(PRESERVE_CAP, mdef * PRESERVE_PER_MDEF);
  }

  // 刻符配方按档位与路线统一派生，不逐条写死：
  //   矿路线：1 同档矿 + 1 煤 → RUNE_BATCH.ore(20) 符，免费；
  //   锭路线：1 同档锭 + INSCRIBE_COINS[tier] 金币 → RUNE_BATCH.bar(80) 符。
  // 煤走 (ores[COAL_KEY] || 0) + 1 而不是直接赋 1：目前每档原矿与 COAL_KEY 必然不同 key，
  // 但一旦相同，直接赋值会互相覆盖需求量（与 Mining.smeltNeed 上那段注释同一个隐患）。
  function craftRecipe(runeKey, src) {
    var r = RUNES[runeKey]; if (!r) return null;
    if (src !== 'ore' && src !== 'bar') return null;
    var ores = {}, bars = {}, coins = 0;
    if (src === 'ore') {
      ores[r.ore] = 1;
      ores[COAL_KEY] = (ores[COAL_KEY] || 0) + 1;
    } else {
      bars[r.bar] = 1;
      coins = INSCRIBE_COINS[r.tier];
    }
    return { ores: ores, bars: bars, coins: coins, out: RUNE_BATCH[src], xp: RUNE_XP[r.tier] };
  }

  // 配方可否满足：矿/煤走 oresOk，锭走 barsOk，金币走 coinsOk，等级走 levelOk。level 由 farm.js 算好传入。
  function craftCheck(runeKey, src, state, level) {
    var recipe = craftRecipe(runeKey, src); if (!recipe) return null;
    var haveOres = (state && state.ores) || {}, haveBars = (state && state.bars) || {};
    var oresOk = true, barsOk = true;
    for (var o in recipe.ores) if ((haveOres[o] || 0) < recipe.ores[o]) oresOk = false;
    for (var b in recipe.bars) if ((haveBars[b] || 0) < recipe.bars[b]) barsOk = false;
    var coinsOk = ((state && state.coins) || 0) >= recipe.coins;
    var levelOk = (level || 0) >= RUNES[runeKey].unlock;
    return { recipe: recipe, oresOk: oresOk, barsOk: barsOk, coinsOk: coinsOk, levelOk: levelOk,
      ok: oresOk && barsOk && coinsOk && levelOk };
  }

  // 当前库存还够刻几次（供 kb-hint）——与 settleCraft 用同一份 recipe，「显示的剩余次数」与
  // 「结算真正刻出的次数」锁在一起（同 Mining.smeltRounds 的道理）。金币也算一种库存。
  function craftRounds(runeKey, src, state) {
    var recipe = craftRecipe(runeKey, src); if (!recipe) return 0;
    var haveOres = (state && state.ores) || {}, haveBars = (state && state.bars) || {};
    var rounds = Infinity, k, n;
    for (k in recipe.ores) { n = Math.floor((haveOres[k] || 0) / recipe.ores[k]); if (n < rounds) rounds = n; }
    for (k in recipe.bars) { n = Math.floor((haveBars[k] || 0) / recipe.bars[k]); if (n < rounds) rounds = n; }
    if (recipe.coins > 0) { n = Math.floor(((state && state.coins) || 0) / recipe.coins); if (n < rounds) rounds = n; }
    return isFinite(rounds) ? rounds : 0;
  }

  // 刻符挂机结算：从 craft.last 推进到 now，每 CRAFT_MS 消耗一份配方产 RUNE_BATCH[src] 符。逐条对齐 Mining.settleSmelt：
  //   - 纯函数：不改入参 craft 与 state，只返回增量，由 farm.js 落账；
  //   - 消耗写成负增量（ores / bars / coins），产出写成正增量（runes）——farm.js 一律加法落账，金币走 earn(co.coins)；
  //   - 每轮先查库存（矿+煤 或 锭+金币），不够 → stopped、rune 清空、break，不空转；
  //   - 早退路径（rune 非法/未知、src 非法、stopped、guard 顶限）统一 last = now；正常挖满或余数不够一格才保留精确 t。
  function settleCraft(craft, state, now) {
    var out = {
      ores: {}, bars: {}, coins: 0, runes: {}, xp: 0, ticks: 0, stopped: false,
      craft: { rune: craft.rune, src: craft.src, last: craft.last },
    };
    var recipe = craftRecipe(craft.rune, craft.src);
    // 没在刻、或存档里 rune/src 损坏 → 优雅无操作。last 仍推进，否则下次又从头算一遍。
    if (!recipe) { out.craft.last = now; return out; }
    // 库存副本：边算边扣，判断还够刻几轮，不碰真正的 state。金币从 state.coins 复制，当作一种库存。
    var have = { ores: {}, bars: {}, coins: (state && state.coins) || 0 };
    var srcOres = (state && state.ores) || {}, srcBars = (state && state.bars) || {}, k;
    for (k in srcOres) have.ores[k] = srcOres[k];
    for (k in srcBars) have.bars[k] = srcBars[k];
    // last 可能合法为 0，用 || 会误判成「无记录」跳到 now；只在 null/undefined 时才回退。
    var t = (craft.last == null) ? now : craft.last;
    var guard = 0;
    while (t + CRAFT_MS <= now && guard < OFFLINE_CAP) {
      guard++;
      var enough = have.coins >= recipe.coins;
      for (var o in recipe.ores) if ((have.ores[o] || 0) < recipe.ores[o]) enough = false;
      for (var b in recipe.bars) if ((have.bars[b] || 0) < recipe.bars[b]) enough = false;
      if (!enough) { out.stopped = true; out.craft.rune = null; break; }
      for (var o2 in recipe.ores) { have.ores[o2] -= recipe.ores[o2]; out.ores[o2] = (out.ores[o2] || 0) - recipe.ores[o2]; }
      for (var b2 in recipe.bars) { have.bars[b2] -= recipe.bars[b2]; out.bars[b2] = (out.bars[b2] || 0) - recipe.bars[b2]; }
      have.coins -= recipe.coins;
      out.coins -= recipe.coins;
      t += CRAFT_MS;
      out.runes[craft.rune] = (out.runes[craft.rune] || 0) + recipe.out;
      out.xp += recipe.xp;
      out.ticks++;
    }
    out.craft.last = (guard >= OFFLINE_CAP || out.stopped) ? now : t;
    return out;
  }

  // 存档迁移：补齐新字段、清理损坏值，幂等。老存档没有任何魔法字段 → 全默认，行为不退化。
  // 对 runes 的清理（未知 key 删、负数/NaN 删、小数 floor）比 migrateMining 对 ores/bars 严——有意为之，不是两边不一致：
  // 符文只有「刻符加、施法减」两个整数写入点，没有矿石/锭那样贯穿多个子系统的读写面，逐 key 清洗成本低、收益高。
  // farm.js 必须在 Mining.migrateMining 之后调用它：末尾的三方裁决依赖 mine.vein / smelt.bar 已经是合法值。
  function migrateMagic(s, now) {
    var k;
    // typeof [] === 'object'，光判 typeof 兜不住数组（同 migrateMining 对 ores 的处理）。
    if (!s.runes || typeof s.runes !== 'object' || Array.isArray(s.runes)) s.runes = {};
    for (k in s.runes) {
      var n = s.runes[k];
      // 未知 key / 非有限数 / 负数 → 删；小数 → floor（符文是整数计数，farm.js 只加减整数，小数只可能来自手改存档）。
      if (!RUNES[k] || typeof n !== 'number' || !isFinite(n) || n < 0) { delete s.runes[k]; continue; }
      if (n !== Math.floor(n)) s.runes[k] = Math.floor(n);
    }
    if (!s.books || typeof s.books !== 'object' || Array.isArray(s.books)) s.books = {};
    for (k in s.books) {
      if (!SPELLS[k]) { delete s.books[k]; continue; }
      s.books[k] = true;   // 值统一 true：books 只表达「有没有」，别让 1 / 'yes' 之类混进去
    }
    // spell：不在 SPELLS → null。等级/法书不在这里判，castable 运行时现算（降级只影响这一击）。
    if (!('spell' in s) || !SPELLS[s.spell]) s.spell = null;
    // craft：形状照抄 state.smelt，多一个 src。
    if (!s.craft || typeof s.craft !== 'object' || Array.isArray(s.craft)) s.craft = { rune: null, src: 'ore', last: now };
    if (!('rune' in s.craft) || (s.craft.rune && !RUNES[s.craft.rune])) s.craft.rune = null;
    if (s.craft.src !== 'ore' && s.craft.src !== 'bar') s.craft.src = 'ore';
    // 不用 || now：last 合法可为 0；typeof NaN 也是 'number'，要额外 isNaN。
    if (typeof s.craft.last !== 'number' || isNaN(s.craft.last)) s.craft.last = now;
    if (!s.stats || typeof s.stats !== 'object' || Array.isArray(s.stats)) s.stats = {};
    if (typeof s.stats.casts !== 'number' || isNaN(s.stats.casts)) s.stats.casts = 0;
    // 三方互斥的加载裁决：开采 > 冶炼 > 刻符。startCraft / selectVein / startSmelt 各自会清对方，
    // 但存档被手改坏、或将来某处漏清时，这里兜底——别让三块结算同时跑（migrateMining 已裁决 mine vs smelt）。
    if (((s.mine && s.mine.vein) || (s.smelt && s.smelt.bar)) && s.craft.rune) s.craft.rune = null;
  }

  return {
    SPELLS: SPELLS, SPELL_KEYS: SPELL_KEYS, RUNES: RUNES, RUNE_KEYS: RUNE_KEYS,
    RUNE_XP: RUNE_XP, TIER_UNLOCK: TIER_UNLOCK, INSCRIBE_COINS: INSCRIBE_COINS, RUNE_BATCH: RUNE_BATCH,
    CRAFT_MS: CRAFT_MS, OFFLINE_CAP: OFFLINE_CAP, COAL_KEY: COAL_KEY,
    PRESERVE_PER_MDEF: PRESERVE_PER_MDEF, PRESERVE_CAP: PRESERVE_CAP,
    spellUnlocked: spellUnlocked, spellOwned: spellOwned, bookCheck: bookCheck,
    castable: castable, preserveChance: preserveChance,
    craftRecipe: craftRecipe, craftCheck: craftCheck, craftRounds: craftRounds, settleCraft: settleCraft,
    migrateMagic: migrateMagic,
  };
});
