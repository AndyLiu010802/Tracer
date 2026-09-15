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
  // 角色倍率（hp/atk/def/mdef/agi）。mdef 是魔法 spec 新加的列：brute 高 def 低 mdef（怕法术），
  // caster 反过来（抗法术、怕物理），boss 略怕法术——两角克制，见 spec 三.3。
  var ROLE_MULT = {
    normal: { hp: 1.0,  atk: 1.0,  def: 1.0, mdef: 1.0, agi: 1.0 },
    swift:  { hp: 0.7,  atk: 0.9,  def: 0.8, mdef: 0.8, agi: 1.6 },
    brute:  { hp: 1.6,  atk: 1.25, def: 1.2, mdef: 0.5, agi: 0.6 },
    caster: { hp: 0.85, atk: 1.1,  def: 0.9, mdef: 1.6, agi: 1.1 },
    boss:   { hp: 4.0,  atk: 1.6,  def: 1.5, mdef: 1.2, agi: 1.1 },
  };
  // 材料（游戏名/黑话），给锻造留口，本期只囤。
  var MATERIALS = {
    page_scrap:   { name: '页料',   job: 'page_scrap',   emoji: '\u{1F9F1}' },
    lock_fang:    { name: '锁齿',   job: 'lock_fang',    emoji: '\u{1F9B7}' },
    entropy_dust: { name: '熵尘',   job: 'entropy_dust', emoji: '✨' },
    index_shard:  { name: '索晶',   job: 'index_shard',  emoji: '\u{1F537}' },
    wal_core:     { name: '日志核', job: 'wal_core',     emoji: '\u{1F4BF}' },
    txn_soul:     { name: '事务魂', job: 'txn_soul',     emoji: '\u{1F47B}' },
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
  function monsterStats(key) {
    var m = MONSTERS[key]; if (!m) return null;
    var b = TIER_BASE[m.tier], r = ROLE_MULT[m.role], boss = m.role === 'boss';
    var atk = Math.round(b.atk * r.atk);
    var st = {
      key: key, tier: m.tier, boss: boss, level: b.unlock,
      hp:  Math.round(b.hp * r.hp),
      atk: atk,
      def: Math.round(b.def * r.def),
      mdef: Math.round(b.def * r.mdef),
      agi: Math.round(b.agi * r.agi),
      crit: boss ? 8 : 4, eva: boss ? 5 : 3, luk: 0,
    };
    // caster 用魔攻打玩家的 mdef：matk 就是它现有的 atk 列（1.1×，不加新倍率），castPower 0 只是切到魔法路径的开关。
    // 其他角色不带 castPower → attack 走物理路径，行为与改动前完全一致。
    if (m.role === 'caster') { st.matk = atk; st.castPower = 0; }
    return st;
  }
  function monsterUnlocked(key, level) {
    var m = MONSTERS[key]; return !!m && level >= TIER_BASE[m.tier].unlock;
  }
  // castPower != null（数值，可为 0）→ 魔法路径：matk + castPower − 对方 mdef；否则物理路径 atk − def。
  // 闪避掷、暴击（crit + luk×0.2，×1.75）两路共用；返回值多一个 magic 标记（farm.js 靠它计数扣符文、日志画 ~N）。
  // 闪避也标 magic：符文在出手时就已经烧掉了。castPower 未设时与改动前逐位相同。
  function attack(attacker, defender, rng) {
    rng = rng || Math.random;
    var magic = attacker.castPower != null;
    if (rng() * 100 < (defender.eva || 0)) return { dmg: 0, crit: false, dodged: true, magic: magic };
    var dmg = magic
      ? Math.max(0, (attacker.matk || 0) + attacker.castPower - (defender.mdef || 0))
      : Math.max(0, (attacker.atk || 0) - (defender.def || 0));
    var crit = rng() * 100 < ((attacker.crit || 0) + (attacker.luk || 0) * 0.2);
    if (crit) dmg = Math.round(dmg * 1.75);
    return { dmg: dmg, crit: crit, dodged: false, magic: magic };
  }
  function resolveRound(player, playerHp, mon, monHp, rng) {
    rng = rng || Math.random;
    var log = [];
    var order = (player.agi >= mon.agi) ? ['p', 'm'] : ['m', 'p'];
    for (var i = 0; i < order.length; i++) {
      if (playerHp <= 0 || monHp <= 0) break;
      if (order[i] === 'p') {
        var a = attack(player, mon, rng);
        monHp -= a.dmg; log.push({ who: 'p', dmg: a.dmg, crit: a.crit, dodged: a.dodged, magic: a.magic });
      } else {
        var b = attack(mon, player, rng);
        playerHp -= b.dmg; log.push({ who: 'm', dmg: b.dmg, crit: b.crit, dodged: b.dodged, magic: b.magic });
      }
    }
    return { playerHp: playerHp, monHp: monHp, log: log, monDead: monHp <= 0, playerDead: playerHp <= 0 };
  }
  function rollDrops(key, luk, rng) {
    rng = rng || Math.random;
    var m = MONSTERS[key];
    if (!m) return { xp: 0, coins: 0, mats: {} };   // 存档里怪 key 损坏也不崩
    var boss = m.role === 'boss';
    var xp = DROP_XP[m.tier] * (boss ? 5 : 1);
    var coins = Math.round(DROP_COIN[m.tier] * (boss ? 6 : 1) * (0.8 + rng() * 0.4));
    var mats = {};
    var chance = 0.6 + (luk || 0) * 0.003;
    var n = boss ? 2 + Math.floor(rng() * 2) : 1;
    for (var i = 0; i < n; i++) if (rng() < chance) mats[m.mat] = (mats[m.mat] || 0) + 1;
    if (boss) mats.txn_soul = (mats.txn_soul || 0) + 1;
    return { xp: xp, coins: coins, mats: mats };
  }
  // 第 6 参 cast = { power, runes, preserve } | null：离线施法。每回合前按符文预算设/删 ps.castPower，
  // 玩家每次魔法出手（闪避也算）先计 1 次施法（casts），再掷 rng() >= preserve 则烧 1 枚（runes）；预算烧完自动退回普攻（与 battleTick 同一规则）。
  // 不传 cast → runes / casts 恒 0、不多消耗任何一次 rng，结果与改动前完全一致。
  // 返回值多两个：runes = 实际扣掉的枚数（farm.js 用它扣库存），casts = 施法次数、被保留率保住的也算（farm.js 用它累加 stats.casts，
  // 与 battleTick 里「每条 who==='p' && magic 的日志 +1」同一口径）。
  function settleOffline(battle, playerLevel, weapon, now, rng, cast) {
    rng = rng || Math.random;
    var rounds = Math.min(OFFLINE_CAP, Math.floor((now - (battle.last || 0)) / BATTLE_TICK_MS));
    var ps = playerStats(playerLevel, weapon);
    var mon = monsterStats(battle.mob);
    // 存档里 battle.mob 损坏（未知 key）→ 优雅无操作，别让每秒的 render 结算崩掉。
    if (!mon) return { kills: 0, xp: 0, coins: 0, mats: {}, hp: battle.hp, dead: false, last: now, runes: 0, casts: 0 };
    // 怪血从存档续打：玩家在别的 tab 时 render 每秒都走这条离线结算，若每次从满血起，后台永远打不死怪。
    // 缺字段 / 损坏 / ≤0（老存档或刚击杀）才从满血起。
    var hp = battle.hp, monHp = battle.monHp > 0 ? battle.monHp : mon.hp;
    var kills = 0, xp = 0, coins = 0, mats = {}, dead = false;
    var runes = cast ? (cast.runes || 0) : 0, used = 0, casts = 0;
    var preserve = (cast && cast.preserve) || 0;
    for (var r = 0; r < rounds; r++) {
      if (cast && runes > 0) ps.castPower = cast.power; else delete ps.castPower;
      var res = resolveRound(ps, hp, mon, monHp, rng);
      hp = res.playerHp; monHp = res.monHp;
      for (var li = 0; li < res.log.length; li++) {
        var lg = res.log[li];
        if (lg.who !== 'p' || !lg.magic) continue;
        casts++;
        if (rng() >= preserve) { runes--; used++; }
      }
      if (res.playerDead) { dead = true; hp = 0; break; }
      if (res.monDead) {
        kills++;
        var d = rollDrops(battle.mob, ps.luk, rng);
        xp += d.xp; coins += d.coins;
        for (var k in d.mats) mats[k] = (mats[k] || 0) + d.mats[k];
        monHp = mon.hp;
      }
    }
    return { kills: kills, xp: xp, coins: coins, mats: mats, hp: hp, monHp: monHp, dead: dead, last: now, runes: used, casts: casts };
  }
  function migrateCombat(s) {
    if (!s.mats || typeof s.mats !== 'object') s.mats = {};
    if (typeof s.battle === 'undefined') s.battle = null;
    // 改动前存下的进行中战斗没有掉落堆字段，补上，否则对战视图会崩。
    if (s.battle && !s.battle.drops) s.battle.drops = { xp: 0, coins: 0, mats: {} };
    if (!s.mobDex || typeof s.mobDex !== 'object') s.mobDex = {};
  }

  return {
    TIER_BASE: TIER_BASE, ROLE_MULT: ROLE_MULT, MATERIALS: MATERIALS,
    DEFAULT_WEAPON: DEFAULT_WEAPON, MONSTERS: MONSTERS, MON_KEYS: MON_KEYS,
    DROP_XP: DROP_XP, DROP_COIN: DROP_COIN,
    BATTLE_TICK_MS: BATTLE_TICK_MS, OFFLINE_CAP: OFFLINE_CAP,
    playerStats: playerStats, monsterStats: monsterStats, monsterUnlocked: monsterUnlocked,
    attack: attack, resolveRound: resolveRound, rollDrops: rollDrops,
    settleOffline: settleOffline, migrateCombat: migrateCombat,
  };
});
