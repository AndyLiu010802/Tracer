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
  // 档位 → 锭。key 必须与 Mining.BARS 对齐（equip 不 require mining，靠测试保证一致）。
  var TIER_BAR = { 1: 'heap_bar', 2: 'fsm_bar', 3: 'vm_bar', 4: 'brin_bar', 5: 'tblspc_bar', 6: 'void_bar' };

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

  function recipe(key) {
    var e = EQUIP[key]; if (!e) return null;
    var t = e.tier, mats = {}, bars = {};
    mats[TIER_MAT[t]] = 4 + t * 2;
    bars[TIER_BAR[t]] = 1 + t;
    return { mats: mats, bars: bars, coins: 40 * t * t, level: TIER_UNLOCK[t] };
  }
  // 配方可否满足。锭由开采→冶炼产出（见 mining.js）。
  function recipeCheck(key, state, level) {
    var r = recipe(key); if (!r) return null;
    var matsOk = true;
    for (var m in r.mats) if (((state.mats || {})[m] || 0) < r.mats[m]) matsOk = false;
    var barsOk = true;
    for (var b in r.bars) if (((state.bars || {})[b] || 0) < r.bars[b]) barsOk = false;
    var levelOk = level >= r.level;
    var coinsOk = (state.coins || 0) >= r.coins;
    return { recipe: r, matsOk: matsOk, levelOk: levelOk, coinsOk: coinsOk, barsOk: barsOk,
      ok: matsOk && levelOk && coinsOk && barsOk };
  }

  function migrateEquip(s) {
    if (!s.equipped || typeof s.equipped !== 'object') s.equipped = {};
    for (var i = 0; i < SLOTS.length; i++) if (!(SLOTS[i] in s.equipped)) s.equipped[SLOTS[i]] = null;
    if (!Array.isArray(s.owned)) s.owned = [];
  }

  return {
    SLOTS: SLOTS, SLOT_META: SLOT_META, SLOT_BASE: SLOT_BASE, TIER_SCALE: TIER_SCALE,
    ROLE_SLOT: ROLE_SLOT, TIER_MAT: TIER_MAT, TIER_UNLOCK: TIER_UNLOCK, TIER_BAR: TIER_BAR,
    EQUIP: EQUIP, EQUIP_KEYS: EQUIP_KEYS, BY_SLOT_TIER: BY_SLOT_TIER,
    equipStats: equipStats, equipBonus: equipBonus,
    dropForMonster: dropForMonster, rollEquipDrop: rollEquipDrop,
    recipe: recipe, recipeCheck: recipeCheck,
    migrateEquip: migrateEquip,
  };
});
