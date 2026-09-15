(function () {
  'use strict';

  // 键盘农场的全部数值表。和 farm.js 分开放：那边是状态机和渲染，
  // 这边是纯数据——调平衡不用碰逻辑，加内容也不用在 700 行里翻页找地方。

  // ---------- 作物 ----------
  // taps 成熟所需按键数，cost 种子价，price 售价，xp 经验，lvl 解锁等级。
  // 金币/按键的效率梯度照搬原作社区那张表：胡萝卜垫底、小麦棉花中坚、
  // 彩虹花上层、摇钱树断层第一；四叶草故意做成低收益——它的价值在订单里。
  var CROPS = {
    carrot:    { job: 'idx_scan',      name: '胡萝卜', emoji: '\u{1F955}', taps: 12,  cost: 2,    price: 12,   xp: 1,  lvl: 1 },
    clover:    { job: 'seq_scan',      name: '四叶草', emoji: '\u{1F340}', taps: 25,  cost: 6,    price: 20,   xp: 2,  lvl: 1 },
    potato:    { job: 'idx_bloat',     name: '土豆',   emoji: '\u{1F954}', taps: 20,  cost: 4,    price: 22,   xp: 2,  lvl: 1 },
    cabbage:   { job: 'idx_hash',      name: '卷心菜', emoji: '\u{1F96C}', taps: 30,  cost: 8,    price: 36,   xp: 3,  lvl: 2 },
    tomato:    { job: 'idx_gin',       name: '番茄',   emoji: '\u{1F345}', taps: 40,  cost: 12,   price: 52,   xp: 4,  lvl: 2 },
    sunflower: { job: 'idx_brin',      name: '向日葵', emoji: '\u{1F33B}', taps: 45,  cost: 14,   price: 56,   xp: 4,  lvl: 3 },
    strawberry:{ job: 'idx_gist',      name: '草莓',   emoji: '\u{1F353}', taps: 55,  cost: 18,   price: 77,   xp: 6,  lvl: 3 },
    lavender:  { job: 'idx_partial',   name: '薰衣草', emoji: '\u{1FAB7}', taps: 60,  cost: 20,   price: 78,   xp: 6,  lvl: 4 },
    wheat:     { job: 'idx_btree',     name: '小麦',   emoji: '\u{1F33E}', taps: 80,  cost: 30,   price: 150,  xp: 9,  lvl: 4 },
    watermelon:{ job: 'idx_covering',  name: '西瓜',   emoji: '\u{1F349}', taps: 120, cost: 50,   price: 204,  xp: 13, lvl: 5 },
    banana:    { job: 'idx_expr',      name: '香蕉',   emoji: '\u{1F34C}', taps: 140, cost: 60,   price: 245,  xp: 15, lvl: 5 },
    coffee:    { job: 'idx_unique',    name: '咖啡',   emoji: '☕',    taps: 180, cost: 80,   price: 324,  xp: 19, lvl: 6 },
    cotton:    { job: 'idx_cluster',   name: '棉花',   emoji: '\u{1F9F5}', taps: 220, cost: 100,  price: 429,  xp: 23, lvl: 6 },
    rainbow:   { job: 'idx_composite', name: '彩虹花', emoji: '\u{1F308}', taps: 320, cost: 180,  price: 784,  xp: 34, lvl: 7 },
    moneytree: { job: 'idx_materia',   name: '摇钱树', emoji: '\u{1F4B0}', taps: 600, cost: 2000, price: 6600, xp: 80, lvl: 8 },
  };
  var CROP_KEYS = ['carrot', 'clover', 'potato', 'cabbage', 'tomato', 'sunflower', 'strawberry',
    'lavender', 'wheat', 'watermelon', 'banana', 'coffee', 'cotton', 'rainbow', 'moneytree'];

  // 作物精通：同一种收够这么多，永久加成它的售价。
  // 存在的意义是给「一直种同一种」一个正当理由，和订单逼你换种形成拉扯。
  var MASTERY = [
    { at: 100, mul: 0.05 },
    { at: 500, mul: 0.10 },
    { at: 2000, mul: 0.20 },
  ];

  // ---------- 键盘布局 ----------
  // 显示按真实键盘排，解锁按等级——从 home row 开始，
  // 因为那本来就是敲得最多的一排，新手期就能感到东西在长。
  var KB_ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
    ['SPC', 'LMB'],
  ];
  var KEY_LVL = {};
  'asdfghjkl'.split('').forEach(function (k) { KEY_LVL[k] = 1; });
  'qwertyuiop'.split('').forEach(function (k) { KEY_LVL[k] = 2; });
  'zxcvbnm'.split('').forEach(function (k) { KEY_LVL[k] = 3; });
  '1234567890'.split('').forEach(function (k) { KEY_LVL[k] = 4; });
  KEY_LVL.SPC = 5;
  KEY_LVL.LMB = 5;
  var ALL_KEYS = Object.keys(KEY_LVL);

  // ---------- 动物 ----------
  // 多数靠「收够它喜欢的作物 → 收到来信 → 回信 → 入住」解锁，
  // 猫/鸡/熊走特殊条件，和原作一致。每只带一个实打实的增益，
  // 好感度每级再叠 +1% 售价，喂食才是长线目标。
  var ANIMALS = {
    sheep:   { job: 'wal_writer',      name: '羊',   emoji: '\u{1F411}', like: 'wheat',      need: 0,   perk: '雨水覆盖 +1 块地', ejob: 'sweep width +1' },
    rabbit:  { job: 'autovacuum',      name: '兔子', emoji: '\u{1F430}', like: 'carrot',     need: 200, perk: '下雨间隔 -20%',    ejob: 'sweep interval -20%' },
    pig:     { job: 'checkpointer',    name: '猪',   emoji: '\u{1F416}', like: 'potato',     need: 150, perk: '售价 +5%',         ejob: 'flush value +5%' },
    dog:     { job: 'bgwriter',        name: '狗',   emoji: '\u{1F415}', like: 'cabbage',    need: 120, perk: '售价 +5%',         ejob: 'flush value +5%' },
    cow:     { job: 'logical_rep',     name: '牛',   emoji: '\u{1F404}', like: 'strawberry', need: 180, perk: '订单栏位 +1',      ejob: 'request slot +1' },
    cat:     { job: 'archiver',        name: '猫',   emoji: '\u{1F408}', like: 'coffee',     need: -1,  perk: '捞鱼速度 +50%',    ejob: 'reclaim rate +50%' },
    chicken: { job: 'stats_collector', name: '鸡',   emoji: '\u{1F414}', like: 'banana',     need: -1,  perk: '售价 +10%',        ejob: 'flush value +10%' },
    bear:    { job: 'parallel_worker', name: '熊',   emoji: '\u{1F43B}', like: 'watermelon', need: -1,  perk: '5% 双倍收获',      ejob: '5% double flush' },
  };
  var ANIMAL_KEYS = ['sheep', 'rabbit', 'pig', 'dog', 'cow', 'cat', 'chicken', 'bear'];

  // ---------- 鱼 ----------
  // 权重差得极大——海豚虎鲸鲸鱼就是给后期挂机留的坑。
  var FISH = {
    eel:     { job: 'wal_seg',     name: '鳗鱼', emoji: '\u{1F344}', w: 340, price: 30 },
    carp:    { job: 'temp_file',   name: '鲫鱼', emoji: '\u{1F41F}', w: 300, price: 45 },
    koi:     { job: 'orphan_seg',  name: '锦鲤', emoji: '\u{1F420}', w: 180, price: 90 },
    squid:   { job: 'toast_chunk', name: '鱿鱼', emoji: '\u{1F991}', w: 100, price: 180 },
    puffer:  { job: 'bloat_page',  name: '河豚', emoji: '\u{1F421}', w: 55,  price: 340 },
    dolphin: { job: 'lost_xlog',   name: '海豚', emoji: '\u{1F42C}', w: 18,  price: 900 },
    orca:    { job: 'cold_backup', name: '虎鲸', emoji: '\u{1F40B}', w: 6,   price: 2600 },
    whale:   { job: 'full_dump',   name: '鲸鱼', emoji: '\u{1F40B}', w: 1,   price: 9000 },
  };
  var FISH_KEYS = ['eel', 'carp', 'koi', 'squid', 'puffer', 'dolphin', 'orca', 'whale'];

  // ---------- 扩展（永久升级） ----------
  // 伪装得最省事的一块：Supabase 本来就有 Extensions 页，装扩展 = 买道具，
  // 名字全是真实存在的 Postgres 扩展。金币的主要去处。
  var EXTS = {
    pg_cron:             { name: '任务板',   cost: 500,   perk: '解锁待办清单，完成一条给奖励', ejob: 'unlocks scheduled jobs' },
    pg_prewarm:          { name: '洒水壶',   cost: 800,   perk: '雨水覆盖 +2 块地',             ejob: 'sweep width +2' },
    pg_stat_statements:  { name: '化肥',     cost: 1200,  perk: '所有作物所需按键 -10%',        ejob: 'all jobs -10% taps' },
    pg_partman:          { name: '自动喷灌', cost: 1500,  perk: '下雨间隔 -25%',                ejob: 'sweep interval -25%' },
    pgcrypto:            { name: '金种子',   cost: 3000,  perk: '金色收获概率 +5%',             ejob: 'golden flush +5%' },
    timescaledb:         { name: '温室',     cost: 6000,  perk: '离线结算上限 24h → 72h',       ejob: 'offline cap 24h → 72h' },
    postgis:             { name: '好土',     cost: 10000, perk: '售价 +15%',                    ejob: 'flush value +15%' },
    pg_repack:           { name: '粮仓',     cost: 25000, perk: '解锁自动出售（锁定的不卖）',   ejob: 'unlocks auto-flush' },
    plv8:                { name: '双持键盘', cost: 50000, perk: '每次按键推进 ×2',              ejob: 'tap throughput ×2' },
  };
  var EXT_KEYS = ['pg_cron', 'pg_prewarm', 'pg_stat_statements', 'pg_partman', 'pgcrypto',
    'timescaledb', 'postgis', 'pg_repack', 'plv8'];

  // ---------- 邻居 ----------
  // 订单的下单方。给订单一个署名，顺便多一条收集线。
  var NEIGHBORS = [
    { id: 'replica-syd', name: '阿雅' }, { id: 'replica-fra', name: '老周' },
    { id: 'replica-iad', name: '小林' }, { id: 'replica-nrt', name: '田中' },
    { id: 'replica-lhr', name: '玛丽' }, { id: 'replica-gru', name: '卡洛' },
    { id: 'replica-sin', name: '阿德' },
  ];

  // ---------- 成就 ----------
  // ctx 由 farm.js 每次检查前算好，避免每条成就自己再去遍历一遍状态。
  var ACHS = [
    { id: 'first',    name: '第一次收获',   job: 'first flush',        coins: 50,    test: function (s) { return s.stats.harvested >= 1; } },
    { id: 'earn10k',  name: '小有积蓄',     job: '10k earned',         coins: 200,   test: function (s) { return s.stats.earned >= 10000; } },
    { id: 'earn100k', name: '不错的储蓄',   job: '100k earned',        coins: 2000,  test: function (s) { return s.stats.earned >= 100000; } },
    { id: 'earn1m',   name: '富有农夫',     job: '1M earned',          coins: 20000, test: function (s) { return s.stats.earned >= 1000000; } },
    { id: 'animal6',  name: '动物伙伴',     job: '6 subscribers',      coins: 1000,  test: function (s, c) { return c.animals >= 6; } },
    { id: 'animalAll',name: '人气农夫',     job: 'all subscribers',    coins: 5000,  test: function (s, c) { return c.animals >= ANIMAL_KEYS.length; } },
    { id: 'affAll',   name: '动物之友',     job: 'all aff maxed',      coins: 10000, test: function (s, c) { return c.animals >= ANIMAL_KEYS.length && c.affMax; } },
    { id: 'cropDex',  name: '种植大师',     job: 'object dex',         coins: 3000,  test: function (s, c) { return c.cropDex >= CROP_KEYS.length; } },
    { id: 'fishDex',  name: '钓鱼大师',     job: 'segment dex',        coins: 5000,  test: function (s, c) { return c.fishDex >= FISH_KEYS.length; } },
    { id: 'order50',  name: '七色花羁绊',   job: '50 requests served', coins: 1500,  test: function (s) { return s.stats.orders >= 50; } },
    { id: 'extAll',   name: '全套家当',     job: 'all extensions',     coins: 10000, test: function (s, c) { return c.exts >= EXT_KEYS.length; } },
    { id: 'hotkey',   name: '手指冒烟',     job: 'one shard 10k',      coins: 800,   test: function (s, c) { return c.topKey >= 10000; } },
    { id: 'carrot',   name: '胡萝卜大亨',   job: '100k carrots',       coins: 50000, test: function (s) { return (s.dex.carrot || 0) >= 100000; } },
  ];

  var TABS = [
    { id: 'farm',  job: 'keyspace',     name: '农场' },
    { id: 'bag',   job: 'flush_buffer', name: '仓库' },
    { id: 'order', job: 'requests',     name: '订单' },
    { id: 'zoo',   job: 'subscribers',  name: '动物' },
    { id: 'ext',   job: 'extensions',   name: '扩展' },
    { id: 'cron',  job: 'cron.job',     name: '待办', needs: 'pg_cron' },
    { id: 'stats', job: 'io_stats',     name: '统计' },
  ];

  window.FarmData = {
    CROPS: CROPS, CROP_KEYS: CROP_KEYS, MASTERY: MASTERY,
    KB_ROWS: KB_ROWS, KEY_LVL: KEY_LVL, ALL_KEYS: ALL_KEYS,
    ANIMALS: ANIMALS, ANIMAL_KEYS: ANIMAL_KEYS,
    FISH: FISH, FISH_KEYS: FISH_KEYS,
    EXTS: EXTS, EXT_KEYS: EXT_KEYS,
    NEIGHBORS: NEIGHBORS, ACHS: ACHS, TABS: TABS,

    RAIN_MS: 120000,          // 每 2 分钟一场雨
    RAIN_PLOTS: 6,            // 每场雨浇进度最低的几块地
    RAIN_CAP: 720,            // 单次结算最多补 720 场（24h），温室扩展抬到 72h
    FISH_CLICKS: 60,          // 每多少次点击摸一条鱼
    ORDER_SLOTS: 3,
    ORDER_REFRESH_MS: 4 * 3600000,
    FEED_PER_DAY: 5,
    POND_COST: 5000,
    COOP_COST: 20000,
    BEAR_EELS: 101,
    GOLD_BASE: 0.02,          // 金色收获基础概率
    STREAK_GAP: 3000,         // 超过这么久没按键，连击断
    STREAK_FULL: 200,         // 连击到这个数吃满 ×2
  };
})();
