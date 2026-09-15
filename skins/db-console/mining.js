(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Mining = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 煤是通用燃料，不属于任何档位；单独常量，冶炼与 UI 都引用它而非硬编码。
  var COAL_KEY = 'burn_seg';

  // 矿石：key 永不改。tier 0 = 煤。emoji 避开 Combat.MATERIALS 已占用的那几个。
  // price 整体比最初版本低 6 倍——最初按单价对齐鱼价，但开采吞吐（挂机产出/小时）是
  // 钓鱼的 18~90 倍且零前置投入（钓鱼要先付鱼塘/回收器/钓点），按单价对齐的结果是
  // 开采金币效率压倒钓鱼 7.5~10 倍，与 spec 「金币收益与钓鱼可比但不压倒」的意图不符。
  // 按「每小时产出 × 单价」对齐才是正确量级，见 docs/superpowers/specs/2026-09-04-mining-economy-design.md。
  var ORES = {
    heap_ore:   { name: '铜矿',   job: 'heap_ore',   emoji: '\u{1F7E0}', tier: 1, price: 2 },
    fsm_ore:    { name: '铁矿',   job: 'fsm_ore',    emoji: '\u{1F529}', tier: 2, price: 5 },
    vm_ore:     { name: '秘银矿', job: 'vm_ore',     emoji: '\u{1F4A0}', tier: 3, price: 10 },
    brin_ore:   { name: '精金矿', job: 'brin_ore',   emoji: '\u{1F7E3}', tier: 4, price: 20 },
    tblspc_ore: { name: '陨铁矿', job: 'tblspc_ore', emoji: '\u{1FAA8}', tier: 5, price: 40 },
    void_ore:   { name: '虚空矿', job: 'void_ore',   emoji: '\u{1F573}', tier: 6, price: 75 },
    burn_seg:   { name: '煤',     job: 'burn_seg',   emoji: '\u{2B1B}',  tier: 0, price: 1 },
  };

  // 锭：ore 指向本档原矿，冶炼配方由此派生。price 高于原料成本（3 矿 + tier 煤），
  // 让炼锭本身就是一条有正收益的产业链，而不只是锻造的中间步骤——与 Melvor 一致。
  // key 被 Equip.TIER_BAR 镜像了一份（equip 不 require mining），改这里要同步改那边；
  // 漏改由 equip.test.js 的一致性测试兜底，但别等测试报红才发现。
  var BARS = {
    heap_bar:   { name: '铜锭',   job: 'heap_bar',   emoji: '\u{1F7E7}', tier: 1, ore: 'heap_ore',   price: 10 },
    fsm_bar:    { name: '铁锭',   job: 'fsm_bar',    emoji: '\u{2B1C}',  tier: 2, ore: 'fsm_ore',    price: 24 },
    vm_bar:     { name: '秘银锭', job: 'vm_bar',     emoji: '\u{1F7E6}', tier: 3, ore: 'vm_ore',     price: 46 },
    brin_bar:   { name: '精金锭', job: 'brin_bar',   emoji: '\u{1F7EA}', tier: 4, ore: 'brin_ore',   price: 88 },
    tblspc_bar: { name: '陨铁锭', job: 'tblspc_bar', emoji: '\u{1F7E8}', tier: 5, ore: 'tblspc_ore', price: 172 },
    void_bar:   { name: '虚空锭', job: 'void_bar',   emoji: '\u{1F7E5}', tier: 6, ore: 'void_ore',   price: 318 },
  };
  var BAR_KEYS = ['heap_bar', 'fsm_bar', 'vm_bar', 'brin_bar', 'tblspc_bar', 'void_bar'];

  // 矿脉：tickMs 挖一次的基线间隔，hp 耐久（挖 hp 次枯竭），respawnMs 枯竭后的再生 CD。
  // unlock 与 Combat.TIER_BASE / Equip.TIER_UNLOCK 的档位门槛严格一致，三处必须同步改。
  var VEINS = {
    burn_seam:   { name: '燃料层',     job: 'burn_seam',   tier: 0, unlock: 1,  ore: COAL_KEY,     tickMs: 3200, hp: 12, respawnMs: 24000,  xp: 2 },
    heap_seam:   { name: '堆表矿脉',   job: 'heap_seam',   tier: 1, unlock: 1,  ore: 'heap_ore',   tickMs: 3000, hp: 10, respawnMs: 20000,  xp: 2 },
    fsm_seam:    { name: '空闲空间图', job: 'fsm_seam',    tier: 2, unlock: 5,  ore: 'fsm_ore',    tickMs: 3600, hp: 12, respawnMs: 30000,  xp: 5 },
    vm_seam:     { name: '可见性图',   job: 'vm_seam',     tier: 3, unlock: 10, ore: 'vm_ore',     tickMs: 4200, hp: 14, respawnMs: 45000,  xp: 10 },
    brin_seam:   { name: 'BRIN 块区',  job: 'brin_seam',   tier: 4, unlock: 16, ore: 'brin_ore',   tickMs: 5000, hp: 16, respawnMs: 70000,  xp: 18 },
    tblspc_deep: { name: '表空间深层', job: 'tblspc_deep', tier: 5, unlock: 23, ore: 'tblspc_ore', tickMs: 6000, hp: 18, respawnMs: 100000, xp: 32 },
    block_void:  { name: '数据块虚空', job: 'block_void',  tier: 6, unlock: 31, ore: 'void_ore',   tickMs: 7200, hp: 20, respawnMs: 140000, xp: 55 },
  };
  // 煤脉排最前——先有煤才炼得出第一块锭，列表顺序就是引导顺序。
  var VEIN_KEYS = ['burn_seam', 'heap_seam', 'fsm_seam', 'vm_seam', 'brin_seam', 'tblspc_deep', 'block_void'];

  var SMELT_XP = { 1: 3, 2: 7, 3: 14, 4: 25, 5: 44, 6: 75 };
  var OFFLINE_CAP = 2000;

  function veinUnlocked(key, level) {
    var v = VEINS[key];
    return !!v && (level || 0) >= v.unlock;
  }

  // agi 缩短挖矿间隔，最多减半（agi 100 封顶）。stats 由调用方从 Combat.playerStats 算好传入。
  function tickMs(key, stats) {
    var v = VEINS[key]; if (!v) return 0;
    var agi = (stats && stats.agi) || 0;
    return Math.round(v.tickMs * (1 - Math.min(0.5, agi * 0.005)));
  }

  // luk 触发双产，最多 50%（luk 125 封顶）。与 combat.js 里 luk 影响掉落的用法一致。
  function yieldPer(stats, rng) {
    rng = rng || Math.random;
    var luk = (stats && stats.luk) || 0;
    return rng() < Math.min(0.5, luk * 0.004) ? 2 : 1;
  }

  // 配方由档位统一派生，不逐条写死：1 锭 = 同档矿 × 3 + 煤 × 档位。
  function smeltRecipe(barKey) {
    var b = BARS[barKey]; if (!b) return null;
    var ores = {};
    ores[b.ore] = 3;
    return { ores: ores, coal: b.tier, xp: SMELT_XP[b.tier] };
  }

  // 矿石与煤的需求合并成同一份 need（而不是分两条路径分别判断/扣减）：
  // 目前每档锭的原矿与 COAL_KEY 必然是两个不同的 key，合不合并结果一样；
  // 但一旦分开算，「够矿」「够煤」两次独立检查、以及扣减时两次分别命中同一个 key，
  // 在原矿恰好等于 COAL_KEY 的情况下会彼此看不见对方的需求量，判定和扣减都可能出错。
  // 合并成一份 need 从写法上直接排除这类隐患，不依赖「反正现在不会撞」这个假设。
  // smeltCheck / settleSmelt / smeltRounds 三处共用这一份需求计算，避免各自重复合并。
  function smeltNeed(barKey) {
    var r = smeltRecipe(barKey); if (!r) return null;
    var need = {};
    for (var o in r.ores) need[o] = (need[o] || 0) + r.ores[o];
    need[COAL_KEY] = (need[COAL_KEY] || 0) + r.coal;
    return need;
  }

  function smeltCheck(barKey, state) {
    var r = smeltRecipe(barKey); if (!r) return null;
    var need = smeltNeed(barKey);
    var have = (state && state.ores) || {};
    var oresOk = true;
    for (var o in r.ores) if ((have[o] || 0) < need[o]) oresOk = false;
    var coalOk = (have[COAL_KEY] || 0) >= need[COAL_KEY];
    return { recipe: r, oresOk: oresOk, coalOk: coalOk, ok: oresOk && coalOk };
  }

  // 当前库存够炼几整轮——与 settleSmelt 用同一份 smeltNeed，「显示的剩余轮数」与
  // 「结算真正炼出的数量」锁在一起，不会各算各的算出两个不一致的数字。
  // 未知 key、state 为空、state.ores 缺失都优雅返回 0，不崩。
  function smeltRounds(barKey, state) {
    var need = smeltNeed(barKey); if (!need) return 0;
    var have = (state && state.ores) || {};
    var rounds = Infinity;
    for (var k in need) {
      var r = Math.floor((have[k] || 0) / need[k]);
      if (r < rounds) rounds = r;
    }
    return isFinite(rounds) ? rounds : 0;
  }

  // 冶炼间隔。固定值、不吃 agi——agi 是开采的效率维度，冶炼保持固定节奏，两边的加成不叠在一起。
  var SMELT_MS = 2000;

  // 冶炼挂机结算：从 smelt.last 推进到 now，每 SMELT_MS 消耗一份配方产 1 锭。
  // 纯函数：既不改 smelt 也不改 state，只返回「炼出多少、消耗多少」，由调用方落账。
  // 材料不够就停（stopped=true 且把 bar 清空），不空转。
  function settleSmelt(smelt, state, now) {
    var out = {
      bars: {}, ores: {}, xp: 0, ticks: 0, stopped: false,
      smelt: { bar: smelt.bar, last: smelt.last },
    };
    var r = smeltRecipe(smelt.bar);
    // 没在炼、或存档里 bar 损坏 → 优雅无操作。last 仍推进，否则下次又从头算一遍。
    if (!r) { out.smelt.last = now; return out; }
    // 需求合并计算见 smeltNeed 上的注释；与 smeltCheck / smeltRounds 共用同一份，
    // 避免各自重复合并、算出两份可能不一致的「够不够」。
    var need = smeltNeed(smelt.bar);
    // 库存副本：边算边扣，用来判断还够炼几轮，不碰真正的 state。
    var have = {}, src = (state && state.ores) || {};
    for (var k in src) have[k] = src[k];
    var t = (smelt.last == null) ? now : smelt.last;
    var guard = 0;
    while (t + SMELT_MS <= now && guard < OFFLINE_CAP) {
      guard++;
      var enough = true;
      for (var n in need) if ((have[n] || 0) < need[n]) enough = false;
      if (!enough) { out.stopped = true; out.smelt.bar = null; break; }
      for (var n2 in need) {
        have[n2] -= need[n2];
        // 负数：out.ores 与 settleMining 的 out.ores 是同一种语义——都是「state.ores 该
        // 加上的增量」，挖矿是正的（产出），冶炼是负的（消耗）。farm.js 落账时两边都能写
        // `state.ores[k] = (state.ores[k] || 0) + out.ores[k]`，不用记「这个字段该加、
        // 那个字段该减」；如果字段叫 spent 却存正数，照抄旁边挖矿的接线代码会误写成 +=，
        // 结果是炼锭不消耗矿石反而倒贴。
        out.ores[n2] = (out.ores[n2] || 0) - need[n2];
      }
      t += SMELT_MS;
      out.bars[smelt.bar] = (out.bars[smelt.bar] || 0) + 1;
      out.xp += r.xp;
      out.ticks++;
    }
    // guard 顶到上限、或材料耗尽被迫 stopped，都是「这次结算到此为止」——三条早退路径
    // （!r 优雅无操作 / 材料不足 stopped / guard 顶限）现在统一把 last 丢到 now，不留
    // 半格的补偿时间，语义一致；只有正常挖满 now 或余数不够一格时才保留精确的 t。
    out.smelt.last = (guard >= OFFLINE_CAP || out.stopped) ? now : t;
    return out;
  }

  // 切矿脉：耐久（hp）与再生 CD（until）按矿脉各自记账，存进 mine.pool——
  // 否则切走一条正在冷却的矿脉再切回来，会被当成「新矿脉」直接给满耐久、清空 CD，
  // 玩家点两下就能把节流机制废掉（实测收益能翻 1.7~2.2 倍）。
  // 纯函数：不改入参 mine（含其 pool），返回一个新的 mine 对象。
  function switchVein(mine, key, now) {
    if (!VEINS[key]) return mine;      // 非法矿脉 key，防御性原样返回，不动状态
    if (mine.vein === key) return mine; // 本来就在挖这条脉，无需切换
    var pool = {};
    for (var k in mine.pool) pool[k] = mine.pool[k];
    // 当前矿脉的进度存进 pool；vein 为 null（还没挖过任何矿脉）时没有东西可存。
    if (mine.vein) pool[mine.vein] = { hp: mine.hp, until: mine.until };
    // 目标矿脉之前挖过 → 从 pool 取回原样的 hp/until；没挖过才给满耐久（第一次挖）。
    var rec = pool[key] || { hp: VEINS[key].hp, until: 0 };
    return { vein: key, last: now, hp: rec.hp, until: rec.until, pool: pool };
  }

  // 停矿脉（不切到另一条，单纯停下——冶炼与开采互斥时用）：与 switchVein 是一对，
  // 都必须把当前矿脉的 hp/until 存进 pool 再清 vein，不能在调用方裸置 mine.vein = null。
  // 裸置会让这份进度既不在 pool 里、也不在当前 mine 上，凭空丢失——下次 switchVein 回
  // 同一条矿脉时，pool 里查不到记录，只能当成「没挖过」给满耐久、清空再生 CD，
  // 等于把 switchVein 本来要堵的那个漏洞（点两下刷新耐久/CD）从另一个入口放了回来。
  // 纯函数：不改入参 mine（含其 pool），返回一个新的 mine 对象。
  function stopVein(mine, now) {
    if (!mine.vein) return mine; // 本来就没在挖，无需停
    var pool = {};
    for (var k in mine.pool) pool[k] = mine.pool[k];
    pool[mine.vein] = { hp: mine.hp, until: mine.until };
    return { vein: null, last: now, hp: mine.hp, until: mine.until, pool: pool };
  }

  // 挂机结算：从 mine.last 推进到 now，模拟「挖满耐久 → 进再生 CD → 补满 → 继续挖」。
  // 纯函数：不改入参，返回产出增量与新的 mine 状态，由调用方落到 state 上。
  function settleMining(mine, stats, now, rng) {
    rng = rng || Math.random;
    var out = {
      ores: {}, xp: 0, ticks: 0,
      // pool 必须原样带出——它不参与本次结算，但 farm.js 每秒 render 都会用
      // out.mine 整个覆盖 state.mine，漏带 pool 等于每秒把切脉记账擦掉一次。
      mine: { vein: mine.vein, last: mine.last, hp: mine.hp, until: mine.until, pool: mine.pool },
    };
    var v = VEINS[mine.vein];
    // vein 为空、或存档里 key 损坏 → 优雅无操作。last 仍推进，否则下次又从头算一遍。
    if (!v) { out.mine.last = now; return out; }
    var step = tickMs(mine.vein, stats);
    if (step <= 0) { out.mine.last = now; return out; }

    // last 可能合法为 0（首次挂机），用 || 会把它误判为「无记录」而跳到 now，导致整段白挖；
    // 只在 null/undefined（真正没记录过）时才回退到 now。
    var t = (mine.last == null) ? now : mine.last, hp = mine.hp, until = mine.until || 0;
    // guard 计的是 while 循环迭代次数，不等于 ticks（产出次数）：进/出再生 CD 各消耗一次
    // 迭代但不产出。同样 OFFLINE_CAP 预算下，矿脉枯竭-再生越频繁，能结算出的 ticks 就越少
    // ——这与 combat.js 用「回合数=输出数」的口径不同，那边一次截断就等于产出上限。
    var guard = 0;
    while (t < now && guard < OFFLINE_CAP) {
      guard++;
      if (until > t) {                    // 再生中
        if (until > now) { t = now; break; }
        t = until; until = 0; hp = v.hp;  // CD 结束，耐久补满
        continue;
      }
      if (hp <= 0) { until = t + v.respawnMs; continue; }
      if (t + step > now) break;          // 这一格还没挖完，余数留到下次
      t += step;
      var n = yieldPer(stats, rng);
      out.ores[v.ore] = (out.ores[v.ore] || 0) + n;
      out.xp += v.xp;
      out.ticks++;
      hp--;
    }
    // guard 顶到上限时把 last 直接丢到 now、放弃剩余时间的补偿（对齐 combat 的离线截断思路，
    // 避免回来后连着好几秒疯狂补矿）；正常退出（时间挖完/余数不够一格）则保留精确的 t，
    // 让不足一格的时间留到下次结算，见上面 guard 的注释。
    out.mine.last = (guard >= OFFLINE_CAP) ? now : t;
    out.mine.hp = hp;
    out.mine.until = until;
    return out;
  }

  // 存档迁移：补齐新字段，老存档跨版本不崩。
  function migrateMining(s, now) {
    // typeof [] === 'object'，光判 typeof 兜不住数组：s.ores 被写成数组时会被当作
    // 合法对象放过，具名属性（如 s.ores.heap_ore）在内存里读得到，但 JSON.stringify
    // 一个数组会把它们全部丢掉——存盘一次矿石清零。equip.js 的 migrateEquip 已经用
    // Array.isArray 兜过 owned，这里一并补齐，避免两边写法不一致埋雷。
    if (!s.ores || typeof s.ores !== 'object' || Array.isArray(s.ores)) s.ores = {};
    if (!s.bars || typeof s.bars !== 'object' || Array.isArray(s.bars)) s.bars = {};
    if (!s.mine || typeof s.mine !== 'object' || Array.isArray(s.mine)) {
      s.mine = { vein: null, last: now, hp: 0, until: 0 };
    }
    if (!('vein' in s.mine)) s.mine.vein = null;
    // 存档里的 vein 是未知/损坏 key：settleMining 对它优雅无操作，但迁移不清理的话，
    // 这个死值会永久留在存档里。对齐 fishing.js 的 migrateFishing 对 spot 的同类处理。
    if (s.mine.vein && !VEINS[s.mine.vein]) s.mine.vein = null;
    // 不用 `|| now` 是因为 last/hp/until 都可能合法为 0，`||` 会把合法的 0 误判成「没有」；
    // typeof !== 'number' 兜住 undefined/字符串等写坏的情况，但 typeof NaN 也是 'number'，
    // 单靠 typeof 兜不住 NaN（结算循环里 t < now 对 NaN 恒为 false，会悄悄卡死不产出），
    // 所以额外用 isNaN 补一道。
    if (typeof s.mine.last !== 'number' || isNaN(s.mine.last)) s.mine.last = now;
    if (typeof s.mine.hp !== 'number' || isNaN(s.mine.hp)) s.mine.hp = 0;
    if (typeof s.mine.until !== 'number' || isNaN(s.mine.until)) s.mine.until = 0;
    // pool 记的是「非当前矿脉」各自的 hp/until，没有就补空对象——首次切脉时
    // switchVein 取不到记录会给满耐久，行为等价于老存档从未有过 pool 字段。
    if (!s.mine.pool || typeof s.mine.pool !== 'object' || Array.isArray(s.mine.pool)) s.mine.pool = {};
    // 冶炼状态。老存档没有这个字段 → 视为没在冶炼，行为不退化。
    if (!s.smelt || typeof s.smelt !== 'object' || Array.isArray(s.smelt)) {
      s.smelt = { bar: null, last: now };
    }
    if (!('bar' in s.smelt)) s.smelt.bar = null;
    if (typeof s.smelt.last !== 'number' || isNaN(s.smelt.last)) s.smelt.last = now;
    // 存档里的锭 key 损坏 → 清成 null，别让它永久留着（对齐上面 mine.vein 的处理）。
    if (s.smelt.bar && !BARS[s.smelt.bar]) s.smelt.bar = null;
    // 开采与冶炼互斥（Melvor：同时只能训练一个非战斗技能）。存档被改坏、或将来某处
    // 漏清对方时，在加载这一层统一裁决——保留开采（主线），停掉冶炼，别让两块结算同时跑。
    if (s.mine.vein && s.smelt.bar) s.smelt.bar = null;
    if (!s.stats || typeof s.stats !== 'object' || Array.isArray(s.stats)) s.stats = {};
    if (typeof s.stats.mined !== 'number' || isNaN(s.stats.mined)) s.stats.mined = 0;
    // oreCount 是开采做出来之前的占位字段（恒 0，equip.js 拿它当矿石库存判配方，一直卡死）。
    // 万一有玩家存档里它 > 0，折成等量一档铜矿后清零；清零让这一步天然幂等——
    // 第二次调用时它已经是 0，不会重复转换，此后该字段不再被任何代码读写。
    if (typeof s.oreCount === 'number' && s.oreCount > 0) {
      s.ores.heap_ore = (s.ores.heap_ore || 0) + s.oreCount;
      s.oreCount = 0;
    }
  }

  return {
    ORES: ORES, BARS: BARS, BAR_KEYS: BAR_KEYS, VEINS: VEINS, VEIN_KEYS: VEIN_KEYS,
    COAL_KEY: COAL_KEY, SMELT_XP: SMELT_XP, OFFLINE_CAP: OFFLINE_CAP, SMELT_MS: SMELT_MS,
    veinUnlocked: veinUnlocked, tickMs: tickMs, yieldPer: yieldPer,
    smeltRecipe: smeltRecipe, smeltNeed: smeltNeed, smeltCheck: smeltCheck, smeltRounds: smeltRounds,
    settleMining: settleMining,
    switchVein: switchVein, stopVein: stopVein, migrateMining: migrateMining, settleSmelt: settleSmelt,
  };
});
