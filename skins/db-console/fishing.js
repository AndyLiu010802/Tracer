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

  // 自动回收器：按墙钟差在「当前钓点」补出若干鱼。纯函数。
  // st: { auto, last, spotId }；cfg: { rng, cat }。返回 { caught:[key...], last }。
  function settleReclaim(st, now, cfg) {
    cfg = cfg || {};
    if (!st.auto) return { caught: [], last: st.last };
    var spotId = SPOTS[st.spotId] ? st.spotId : 'wal_buffer';
    var spot = SPOTS[spotId];
    var iv = spot.reclaimMs / (cfg.cat ? 1.5 : 1);
    var elapsed = now - (st.last || 0);
    var n = Math.floor(elapsed / iv);
    if (n <= 0) return { caught: [], last: st.last };
    var last;
    if (n > RECLAIM_CAP) { n = RECLAIM_CAP; last = now; } // 溢出则把时钟对齐到现在，丢弃超额
    else last = (st.last || 0) + n * iv;
    var caught = [];
    for (var i = 0; i < n; i++) caught.push(rollFish(spotId, cfg.rng));
    return { caught: caught, last: last };
  }

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

  return {
    RARITY: RARITY, MATERIALS: MATERIALS, SPOTS: SPOTS, SPOT_KEYS: SPOT_KEYS,
    FISH: FISH, FISH_KEYS: FISH_KEYS, RECLAIM_CAP: RECLAIM_CAP,
    poolOf: poolOf, rollFish: rollFish, advanceCatch: advanceCatch,
    settleReclaim: settleReclaim, migrateFishing: migrateFishing,
  };
});
