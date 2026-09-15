(function () {
  'use strict';

  var Fishing = window.Fishing;
  var Combat = window.Combat;
  var Equip = window.Equip;
  var Mining = window.Mining;
  var Magic = window.Magic;

  // 键盘农场，伪装成 Supabase 的 keyspace 分片面板。
  //
  // 玩法取自《Typing Farmer / 指尖农场》的核心创意：**键盘就是农田**。
  // 每个按键是一块地，按一下推进一格生长；成熟后自动收进仓库并续种。
  // 你在这个控制台里敲字（假 SQL 编辑器、搜索框、便签），农场就在长。
  //
  // 伪装映射：
  //   地块=keyspace 分片   作物=索引任务   生长=fill%   收获=flush
  //   仓库=flush_buffer    订单=replica 请求  动物=subscriber  钓鱼=WAL 回收
  //   下雨=autovacuum sweep    番茄钟=maintenance window
  // 右上角 🌱 一键切回农场文案。
  //
  // 三条设计原则：
  // 1. 吃下这个标签页里的每一次按键与点击：控制台自身、阅读面板的边框控件，
  //    以及阅读面板 iframe 里小说站的输入，全都算数——看小说本就是这个工具的主业，
  //    读着读着农场就在长。iframe 的事件不冒泡出框架，由注入的守卫脚本回报，
  //    且只报「发生了一次按键/点击」这个事实，绝不带按键内容（见 external）；
  //    因此外部按键不落到某个具体地块，而像下雨一样浇给进度最低的那块地。
  //    注意浏览器看不到本标签页以外的输入——别的窗口、别的程序、失焦的标签页
  //    都收不到任何键鼠事件，这是浏览器的安全边界，不是这里漏做了。
  // 2. 后台运行：离线期间靠「下雨」推进（原作里雨就是用来补偿冷门按键的），
  //    按墙钟结算，关掉浏览器过一夜回来照样有收成。
  // 3. 常驻：输入监听在脚本加载时就装好，切到别的分区照样记账，
  //    不需要停在这个页面上。

  var KEY = 'dbconsole.farm.v3';
  var OLD_KEY = 'dbconsole.farm.v2';

  var RAIN_MS = 120000;      // 每 2 分钟一场雨
  var RAIN_PLOTS = 6;        // 每场雨浇进度最低的几块地
  var RAIN_CAP = 720;        // 单次结算最多补 720 场（24h），防御性上限
  // 被动生长：作物不打字也随时间慢慢长。每 GROW_MS 给所有种着的地 +1 格，按墙钟结算（离线也长）。
  var GROW_MS = 60000;       // 每 60 秒被动长 1 格
  var GROW_CAP = 1440;       // 单次结算最多补 1440 次（24h），防离线一次补爆
  var ORDER_SLOTS = 3;
  var ORDER_REFRESH_MS = 4 * 3600000;
  var FEED_PER_DAY = 5;

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

  // 键盘布局。显示按真实键盘排，解锁按等级——从home row开始，
  // 因为那本来就是敲得最多的一排，新手期就能感到东西在长。
  var KB_ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
    ['SPC', 'LMB'],
  ];
  var KEY_LVL = {};
  (function () {
    'asdfghjkl'.split('').forEach(function (k) { KEY_LVL[k] = 1; });
    'qwertyuiop'.split('').forEach(function (k) { KEY_LVL[k] = 2; });
    'zxcvbnm'.split('').forEach(function (k) { KEY_LVL[k] = 3; });
    '1234567890'.split('').forEach(function (k) { KEY_LVL[k] = 4; });
    KEY_LVL.SPC = 5;
    KEY_LVL.LMB = 5;
  })();
  var ALL_KEYS = Object.keys(KEY_LVL);

  // 动物。多数靠「收够它喜欢的作物 → 收到来信 → 回信 → 入住」解锁，
  // 猫/鸡/熊走特殊条件，和原作一致。每只带一个实打实的增益，
  // 好感度每级再叠 +1% 售价，喂食才是长线目标。
  var ANIMALS = {
    sheep:   { job: 'wal_writer',    name: '羊',   emoji: '\u{1F411}', like: 'wheat',      need: 0,   perk: '雨水覆盖 +1 块地', ejob: 'sweep width +1' },
    rabbit:  { job: 'autovacuum',    name: '兔子', emoji: '\u{1F430}', like: 'carrot',     need: 200, perk: '下雨间隔 -20%',    ejob: 'sweep interval -20%' },
    pig:     { job: 'checkpointer',  name: '猪',   emoji: '\u{1F416}', like: 'potato',     need: 150, perk: '售价 +5%',         ejob: 'flush value +5%' },
    dog:     { job: 'bgwriter',      name: '狗',   emoji: '\u{1F415}', like: 'cabbage',    need: 120, perk: '售价 +5%',         ejob: 'flush value +5%' },
    cow:     { job: 'logical_rep',   name: '牛',   emoji: '\u{1F404}', like: 'strawberry', need: 180, perk: '订单栏位 +1',      ejob: 'request slot +1' },
    cat:     { job: 'archiver',      name: '猫',   emoji: '\u{1F408}', like: 'coffee',     need: -1,  perk: '捞鱼速度 +50%',    ejob: 'reclaim rate +50%' },
    chicken: { job: 'stats_collector', name: '鸡', emoji: '\u{1F414}', like: 'banana',     need: -1,  perk: '售价 +10%',        ejob: 'flush value +10%' },
    bear:    { job: 'parallel_worker', name: '熊', emoji: '\u{1F43B}', like: 'watermelon', need: -1,  perk: '5% 双倍收获',      ejob: '5% double flush' },
  };
  var ANIMAL_KEYS = ['sheep', 'rabbit', 'pig', 'dog', 'cow', 'cat', 'chicken', 'bear'];

  var POND_COST = 5000;
  var COOP_COST = 20000;
  var BEAR_EELS = 101;
  var RECLAIM_COST = 30000;

  // 鱼/钓点常量来自 fishing.js（见文件头 Fishing 引用）。
  var FISH = Fishing.FISH;
  var FISH_KEYS = Fishing.FISH_KEYS;
  var SPOTS = Fishing.SPOTS;
  var SPOT_KEYS = Fishing.SPOT_KEYS;
  var RARITY = Fishing.RARITY;
  var MATERIALS = Fishing.MATERIALS;

  var TABS = [
    { id: 'farm',  job: 'keyspace',    name: '农场' },
    { id: 'bag',   job: 'flush_buffer', name: '仓库' },
    { id: 'pond',  job: 'reclaim',     name: '钓鱼' },
    { id: 'order', job: 'requests',    name: '订单' },
    { id: 'zoo',   job: 'subscribers', name: '动物' },
    { id: 'raid',  job: 'advisories',  name: '副本' },
    { id: 'mine',  job: 'storage',     name: '开采' },
    { id: 'inv',   job: 'objects',     name: '背包' },
    { id: 'forge', job: 'smithy',      name: '锻造' },
    { id: 'magic', job: 'functions',   name: '魔法' },
    { id: 'stats', job: 'io_stats',    name: '统计' },
  ];

  var state = null;
  var mainEl = null;
  var sideEl = null;
  var timer = null;
  var saveTimer = null;
  var msg = null;              // 瞬时提示，不持久化
  var booted = false;
  var focusSnapshot = null;
  function focusLabel(zh, en) { return window.TracerLocale && window.TracerLocale.language() === 'en' ? en : zh; }
  function syncFocus(snapshot) {
    if (!state || !snapshot) return;
    focusSnapshot = snapshot;
    if (!state.focusLink) state.focusLink = { legacyDone: state.pomo.done || 0, credited: [], allKeys: false };
    var link = state.focusLink, changed = false;
    snapshot.history.forEach(function (h) {
      if (link.credited.indexOf(h.id) >= 0) return;
      earn(60); for (var i = 0; i < 8; i++) settleRainBurst();
      link.credited.push(h.id); changed = true;
    });
    state.pomo.done = link.legacyDone + snapshot.roundsDone;
    if (changed) { link.credited = link.credited.slice(-1000); save(); }
  }

  // ---------- 存取 ----------

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function freshState() {
    var s = {
      v: 3, coins: 40, xp: 0, real: false, tab: 'farm', sel: 'carrot', autoReplant: true,
      plots: {}, bag: {}, lock: {}, fish: {}, dex: {}, keys: {},
      clicks: 0, pond: false, coop: false,
      spot: 'wal_buffer', spotsOwned: {}, autoReclaim: false,
      lastReclaim: Date.now(), fishProgress: 0, lastCatch: null,
      mats: {}, battle: null, mobDex: {},
      equipped: { weapon: null, armor: null, accessory: null, shoes: null, special: null },
      owned: [],
      ores: {}, bars: {}, mine: { vein: null, last: Date.now(), hp: 0, until: 0 },
      smelt: { bar: null, last: Date.now() },
      runes: {}, books: {}, spell: null, craft: { rune: null, src: 'ore', last: Date.now() },
      orders: [], ordersAt: 0,
      animals: { sheep: { aff: 0, fed: 0, day: today() } }, mail: [],
      stats: { taps: 0, harvested: 0, earned: 0, orders: 0, fish: 0, ext: 0, mined: 0, casts: 0 },
      lastRain: Date.now(), lastGrow: Date.now(), day: today(),
      pomo: { mode: 'idle', until: 0, done: 0 },
    };
    ALL_KEYS.forEach(function (k) { s.plots[k] = { c: null, t: 0 }; });
    // 送三块地的胡萝卜，开局就有东西在动
    ['f', 'j', 'd'].forEach(function (k) { s.plots[k] = { c: 'carrot', t: 0 }; });
    return s;
  }

  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (s && s.v === 3 && s.plots) {
      state = s;
      // 补齐可能缺失的字段，老存档跨版本不至于崩
      ALL_KEYS.forEach(function (k) { if (!state.plots[k]) state.plots[k] = { c: null, t: 0 }; });
      ['bag', 'lock', 'fish', 'dex', 'keys', 'animals'].forEach(function (f) {
        if (!state[f]) state[f] = {};
      });
      if (!state.stats) state.stats = { taps: 0, harvested: 0, earned: 0, orders: 0, fish: 0, ext: 0 };
      if (typeof state.stats.ext !== 'number') state.stats.ext = 0;
      if (!state.pomo) state.pomo = { mode: 'idle', until: 0, done: 0 };
      if (!state.orders) state.orders = [];
      if (!state.mail) state.mail = [];
      if (typeof state.lastGrow !== 'number') state.lastGrow = Date.now();
    } else {
      // v2（按时间生长的旧农场）迁移：机制完全换了，只把家底带过来。
      state = freshState();
      var old = null;
      try { old = JSON.parse(localStorage.getItem(OLD_KEY)); } catch (e) {}
      if (old && typeof old.coins === 'number') {
        state.coins = old.coins;
        state.xp = old.xp || 0;
        state.real = !!old.real;
        if (old.stats) {
          state.stats.harvested = old.stats.harvest || 0;
          state.stats.earned = old.stats.earned || 0;
        }
      }
    }
    // 补齐钓鱼相关字段（新字段、v2 迁移出来的旧存档都要走这一步）。
    Fishing.migrateFishing(state, Date.now());
    // 补齐战斗相关字段（新字段、老存档都要走这一步）。
    Combat.migrateCombat(state);
    // 补齐装备相关字段（新字段、老存档都要走这一步）。
    Equip.migrateEquip(state);
    // 补齐开采相关字段（新字段、老存档都要走这一步；作废的 oreCount 也在这里折算）。
    Mining.migrateMining(state, Date.now());
    // 补齐魔法相关字段。必须在 migrateMining 之后：三方互斥的加载裁决（开采 > 冶炼 > 刻符）
    // 依赖 mine.vein / smelt.bar 已经被修成合法值。
    Magic.migrateMagic(state, Date.now());
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // 输入是高频事件，不能每次按键都写 localStorage。
  function saveSoon() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () { saveTimer = null; save(); }, 2000);
  }

  // ---------- 数值 ----------

  function levelInfo() {
    var lvl = 1, need = 50, rem = state.xp;
    while (rem >= need && lvl < 99) { rem -= need; lvl++; need = Math.floor(50 * Math.pow(lvl, 1.6)); }
    return { lvl: lvl, rem: rem, need: need };
  }

  function has(a) { return !!state.animals[a]; }

  function affTotal() {
    var n = 0;
    for (var k in state.animals) n += affLevel(k);
    return n;
  }

  function affLevel(a) {
    var r = state.animals[a];
    if (!r) return 0;
    return Math.min(5, Math.floor((r.aff || 0) / 10) + 1);
  }

  // 售价加成：动物增益 + 每级好感 1%
  function priceMul() {
    var m = 1;
    if (has('pig')) m += 0.05;
    if (has('dog')) m += 0.05;
    if (has('chicken')) m += 0.10;
    m += affTotal() * 0.01;
    return m;
  }

  function sellPrice(cropKey) {
    return Math.max(1, Math.round(CROPS[cropKey].price * priceMul()));
  }

  function rainMs() { return has('rabbit') ? RAIN_MS * 0.8 : RAIN_MS; }
  function rainWidth() { return RAIN_PLOTS + (has('sheep') ? 1 : 0); }
  function orderSlots() { return ORDER_SLOTS + (has('cow') ? 1 : 0); }

  function unlocked(k) { return levelInfo().lvl >= (KEY_LVL[k] || 99); }

  function earn(n) {
    state.coins += n;
    if (n > 0) state.stats.earned += n;
    if (state.coins < 0) state.coins = 0;
  }

  // ---------- 生长与收获 ----------

  function harvest(cropKey) {
    var crop = CROPS[cropKey];
    var qty = (has('bear') && Math.random() < 0.05) ? 2 : 1;
    state.bag[cropKey] = (state.bag[cropKey] || 0) + qty;
    state.dex[cropKey] = (state.dex[cropKey] || 0) + qty;
    state.stats.harvested += qty;
    state.xp += crop.xp;
    checkMail();
  }

  // 给一块地推进 n 格。成熟即收，能续种就续种；续不起就空出来。
  function grow(k, n) {
    var p = state.plots[k];
    if (!p || !p.c || !unlocked(k)) return false;
    var crop = CROPS[p.c];
    if (!crop) { p.c = null; p.t = 0; return true; }
    p.t += n;
    var guard = 0;
    while (p.t >= crop.taps && guard++ < 5000) {
      p.t -= crop.taps;
      harvest(p.c);
      if (!state.autoReplant || state.coins < crop.cost) { p.c = null; p.t = 0; break; }
      earn(-crop.cost);
    }
    return true;
  }

  // 真实输入。keys 只记次数，不记顺序，也不碰内容。
  function press(k) {
    state.keys[k] = (state.keys[k] || 0) + 1;
    state.stats.taps++;
    grow(k, 1);
    saveSoon();
  }

  // 下雨：补进度最低的几块地。原作里雨就是用来拉平冷门按键的，
  // 这里顺便成了离线收益的唯一来源——不下雨的话关掉页面农场就冻住了。
  function settleRain(now) {
    var iv = rainMs();
    var elapsed = now - state.lastRain;
    if (elapsed < iv) return false;
    var drops = Math.floor(elapsed / iv);
    if (drops > RAIN_CAP) { drops = RAIN_CAP; state.lastRain = now; }
    else state.lastRain += drops * iv;

    var width = rainWidth();
    for (var d = 0; d < drops; d++) {
      var live = [];
      for (var i = 0; i < ALL_KEYS.length; i++) {
        var k = ALL_KEYS[i];
        var p = state.plots[k];
        if (!p || !p.c || !unlocked(k)) continue;
        live.push({ k: k, r: p.t / CROPS[p.c].taps });
      }
      if (!live.length) break;
      live.sort(function (a, b) { return a.r - b.r; });
      for (var j = 0; j < Math.min(width, live.length); j++) grow(live[j].k, 1);
    }
    return true;
  }

  // 被动生长：不依赖按键，所有种着且解锁的地按墙钟慢慢长。
  // 和下雨分开——下雨只浇进度最低的几块用来拉平冷门按键，这条是普惠的时间流逝。
  function settleGrow(now) {
    var elapsed = now - state.lastGrow;
    if (elapsed < GROW_MS) return false;
    var ticks = Math.floor(elapsed / GROW_MS);
    if (ticks > GROW_CAP) { ticks = GROW_CAP; state.lastGrow = now; }
    else state.lastGrow += ticks * GROW_MS;
    // grow(k, ticks) 一次推进多格，内部处理成熟/续种；没种或没解锁的地会自行跳过。
    for (var i = 0; i < ALL_KEYS.length; i++) grow(ALL_KEYS[i], ticks);
    return true;
  }

  function settleDay() {
    var d = today();
    if (state.day === d) return false;
    state.day = d;
    for (var a in state.animals) state.animals[a].fed = 0;
    return true;
  }

  // ---------- 钓鱼 ----------

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
    state.lastCatch = key;   // 钓鱼分区在鱼塘里展示最近钓到的这条
    var f = FISH[key];
    if (f && (f.rarity === 'epic' || f.rarity === 'legendary')) {
      toast((state.real ? '钓到稀有的 ' : 'rare reclaim: ') + L(f));
    }
    checkMail();
  }

  // ---------- 动物来信 ----------

  function eligible(a) {
    if (has(a) || state.mail.indexOf(a) >= 0) return false;
    var def = ANIMALS[a];
    if (a === 'cat') return state.pond;
    if (a === 'chicken') return state.coop;
    if (a === 'bear') return (state.fish.eel || 0) >= BEAR_EELS;
    return (state.dex[def.like] || 0) >= def.need;
  }

  function checkMail() {
    for (var i = 0; i < ANIMAL_KEYS.length; i++) {
      var a = ANIMAL_KEYS[i];
      if (eligible(a)) {
        state.mail.push(a);
        toast(state.real
          ? '邮箱有新信：' + L(ANIMALS[a]) + ' 想搬来住'
          : 'new subscriber request: ' + ANIMALS[a].job);
      }
    }
  }

  // ---------- 订单 ----------

  function makeOrder(lvl) {
    var pool = CROP_KEYS.filter(function (k) { return CROPS[k].lvl <= lvl && k !== 'moneytree'; });
    var crop = pool[Math.floor(Math.random() * pool.length)];
    var qty = Math.max(3, Math.round((3 + Math.random() * 9) * Math.min(4, 1 + lvl * 0.25)));
    return {
      id: Date.now() + ':' + Math.floor(Math.random() * 1e6),
      crop: crop, qty: qty,
      reward: Math.round(CROPS[crop].price * qty * 1.6),
      xp: Math.round(CROPS[crop].xp * qty * 0.8),
    };
  }

  function refreshOrders(force) {
    var now = Date.now();
    var lvl = levelInfo().lvl;
    if (force || now - state.ordersAt >= ORDER_REFRESH_MS) {
      state.orders = [];
      state.ordersAt = now;
    }
    while (state.orders.length < orderSlots()) state.orders.push(makeOrder(lvl));
  }

  function deliver(id) {
    for (var i = 0; i < state.orders.length; i++) {
      var o = state.orders[i];
      if (o.id !== id) continue;
      if ((state.bag[o.crop] || 0) < o.qty) return;
      state.bag[o.crop] -= o.qty;
      earn(o.reward);
      state.xp += o.xp;
      state.stats.orders++;
      state.orders.splice(i, 1);
      state.orders.push(makeOrder(levelInfo().lvl));
      toast(state.real ? '订单完成，+' + o.reward + ' 金币' : 'request served — +' + o.reward);
      return;
    }
  }

  // ---------- 番茄钟 ----------

  var POMO_FOCUS = 25 * 60000;
  var POMO_BREAK = 5 * 60000;

  function pomoTick(now) {
    if (window.Tracer && window.Tracer.focus) return false;
    var p = state.pomo;
    if (p.mode === 'focus' && now >= p.until) {
      p.mode = 'break';
      p.until = now + POMO_BREAK;
      p.done++;
      earn(60);
      for (var i = 0; i < 8; i++) settleRainBurst();
      toast(state.real ? '专注结束，农场加浇了一轮水，+60 金币' : 'window closed — sweep applied, +60');
      return true;
    }
    if (p.mode === 'break' && now >= p.until) {
      p.mode = 'idle';
      p.until = 0;
      return true;
    }
    return false;
  }

  function settleRainBurst() {
    var live = [];
    for (var i = 0; i < ALL_KEYS.length; i++) {
      var k = ALL_KEYS[i];
      var p = state.plots[k];
      if (p && p.c && unlocked(k)) live.push({ k: k, r: p.t / CROPS[p.c].taps });
    }
    live.sort(function (a, b) { return a.r - b.r; });
    for (var j = 0; j < Math.min(rainWidth(), live.length); j++) grow(live[j].k, 1);
  }

  // ---------- 文案 ----------

  function L(def) { return state.real ? def.emoji + ' ' + def.name : def.job; }
  function tabName(t) { return state.real ? t.name : t.job; }
  function coinsWord() { return state.real ? '金币' : 'tokens'; }
  function toast(t) { msg = { text: t, until: Date.now() + 5000 }; }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtMs(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    // 订单刷新是 4 小时一轮，不分出小时位就会显示成「240:00」。
    if (h) return h + 'h ' + String(m).padStart(2, '0') + 'm';
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  function keyCap(k) {
    if (k === 'SPC') return state.real ? '空格' : 'spc';
    if (k === 'LMB') return state.real ? '左键' : 'lmb';
    return k;
  }

  // ---------- 渲染：农场 ----------

  function plotCell(k) {
    var p = state.plots[k];
    var lvl = KEY_LVL[k];
    var wide = (k === 'SPC') ? ' pk-wide' : '';
    if (!unlocked(k)) {
      return '<div class="pk pk-lock' + wide + '" title="level ' + lvl + '">'
        + '<span class="pk-cap">' + esc(keyCap(k)) + '</span>'
        + '<span class="pk-lv">L' + lvl + '</span></div>';
    }
    if (!p.c) {
      return '<div class="pk pk-empty' + wide + '" data-plot="' + k + '">'
        + '<span class="pk-cap">' + esc(keyCap(k)) + '</span>'
        + '<span class="pk-sub">+</span></div>';
    }
    var crop = CROPS[p.c];
    var pct = Math.min(100, p.t / crop.taps * 100);
    var face = state.real ? crop.emoji : String(Math.round(pct)) + '%';
    return '<div class="pk pk-live' + wide + '" data-plot="' + k + '" title="' + esc(crop.job) + ' · ' + p.t + '/' + crop.taps + '">'
      + '<span class="pk-cap">' + esc(keyCap(k)) + '</span>'
      + '<span class="pk-face">' + face + '</span>'
      + '<span class="pk-bar"><span class="pk-fill" style="width:' + pct.toFixed(0) + '%"></span></span></div>';
  }

  function farmTab() {
    var rows = KB_ROWS.map(function (row) {
      return '<div class="kb-row">' + row.map(plotCell).join('') + '</div>';
    }).join('');
    var sel = CROPS[state.sel];
    return '<div class="kb-hint">'
      + (state.real
        ? '在这个页面里打字就是在种地——每敲一个键，对应地块长一格。离线时靠下雨补。'
        : 'each shard advances on its own key. sweep fills the coldest shards while idle.')
      + '</div>'
      + '<div class="kb">' + rows + '</div>'
      + '<div class="kb-tools">'
      + '<button class="btn" data-act="fill">' + (state.real ? '全田种满 ' : 'fill all · ') + L(sel) + '</button>'
      + '<button class="btn" data-act="clear">' + (state.real ? '铲除空闲' : 'drop idle') + '</button>'
      + '<button class="btn' + (state.autoReplant ? ' btn-on' : '') + '" data-act="replant">'
      + (state.real ? '自动续种：' : 'auto-reseed: ') + (state.autoReplant ? 'on' : 'off') + '</button>'
      + '</div>'
      + '<div class="kb-scratch"><div class="rail-label">'
      + (state.real ? '便签（在这里敲字最省事）' : 'scratch buffer') + '</div>'
      + '<textarea class="scratch" spellcheck="false" placeholder="'
      + (state.real ? '随便敲点什么…' : '-- scratch, not executed') + '"></textarea></div>';
  }

  // ---------- 渲染：仓库 ----------

  function bagTab() {
    var rows = CROP_KEYS.filter(function (k) { return (state.bag[k] || 0) > 0; }).map(function (k) {
      var n = state.bag[k];
      return '<tr><td>' + esc(L(CROPS[k])) + '</td><td class="num">' + n + '</td>'
        + '<td class="num">' + sellPrice(k) + '</td><td class="num">' + (n * sellPrice(k)) + '</td>'
        + '<td><a class="mini" data-act="sell" data-c="' + k + '">' + (state.real ? '卖出' : 'flush') + '</a> '
        + '<a class="mini' + (state.lock[k] ? ' on' : '') + '" data-act="lock" data-c="' + k + '">'
        + (state.lock[k] ? '\u{1F512}' : '\u{1F513}') + '</a></td></tr>';
    });
    var head = '<tr><th>' + (state.real ? '物品' : 'object') + '</th><th>' + (state.real ? '数量' : 'count')
      + '</th><th>' + (state.real ? '单价' : 'unit') + '</th><th>' + (state.real ? '合计' : 'total') + '</th><th></th></tr>';
    return '<div class="pad">'
      + '<div class="kb-tools"><button class="btn btn-primary" data-act="sellall">'
      + (state.real ? '一键全卖（锁定的除外）' : 'flush all unlocked') + '</button></div>'
      + (rows.length
        ? '<table class="grid">' + head + rows.join('') + '</table>'
        : '<div class="kb-hint">' + (state.real ? '仓库是空的。' : 'buffer empty.') + '</div>')
      + '</div>';
  }

  // ---------- 渲染：钓鱼 ----------

  // 鱼的「脸」：游戏模式优先立绘 <img>（onerror 回退 emoji），伪装模式不出图。
  function fishFace(key) {
    if (!state.real) return '';
    var f = FISH[key];
    return '<img class="fish-face" src="/fish/' + key + '.webp" alt="" loading="lazy" decoding="async"'
      + ' onerror="this.replaceWith(document.createTextNode(\'' + f.emoji + '\'))">';
  }

  // 场景横幅：游戏模式用钓点场景图；缺图时背景为空，退化成纯边框条。
  // 鱼塘场景面板：钓点背景图（缺图用水塘渐变占位）+ 钓点名 + 最近钓获展示。
  // 双层背景：真图在上、渐变在下——图 404 时自动露出渐变，一看就是个塘。
  function sceneBanner(spotId) {
    var k = state.lastCatch;
    var catchHtml = '';
    if (k && FISH[k]) {
      var f = FISH[k];
      catchHtml = '<div class="catch"><img class="catch-img" src="/fish/' + k + '.webp" alt="" decoding="async"'
        + ' onerror="this.replaceWith(document.createTextNode(\'' + f.emoji + '\'))">'
        + '<div class="catch-info">' + rarityDot(f.rarity) + esc(f.name)
        + '<span class="catch-tag">刚钓到</span></div></div>';
    }
    return '<div class="scene" style="background-image:url(/scenes/' + spotId + '.webp),'
      + ' linear-gradient(160deg,#1b3b31,#0e2a3a)">'
      + '<span class="scene-name">' + esc(SPOTS[spotId].name) + '</span>'
      + catchHtml + '</div>';
  }

  function rarityDot(rarity) {
    var r = RARITY[rarity];
    return '<span class="rz rz-' + rarity + '" title="' + esc(state.real ? r.name : r.job) + '"></span>';
  }

  function spotName(id) { var s = SPOTS[id]; return state.real ? s.name : s.job; }

  // 鱼护首列：稀有度点 + 立绘/emoji + 名字。
  function rarityCell(k) {
    // 名字不带 emoji：图形由 fishFace 立绘负责，再拼个 emoji 就重复了。
    return '<td>' + rarityDot(FISH[k].rarity) + fishFace(k) + ' '
      + esc(state.real ? FISH[k].name : FISH[k].job) + '</td>';
  }

  // 图鉴：按钓点分组，未捕获显示 ??? / job。
  function fishDex() {
    return SPOT_KEYS.map(function (sp) {
      var cells = Fishing.poolOf(sp).map(function (k) {
        var got = (state.dex[k] || 0) > 0;
        var label = got ? (state.real ? FISH[k].name : FISH[k].job) : (state.real ? '???' : FISH[k].job);
        // 伪装模式下 fishFace 返回空串，绝不能 fall through 到真实鱼 emoji（会露馅）；
        // 已捕获在伪装态用一个中性方块占位，看着就是个填充的数据单元格。
        return '<span class="dexf rz-' + FISH[k].rarity + (got ? '' : ' dexf-off') + '" title="' + esc(label) + '">'
          + (got ? fishFace(k) || '▪' : '?') + '</span>';
      }).join('');
      return '<div class="dex-row"><span class="dex-sp">' + esc(spotName(sp)) + '</span><span class="dex-cells">' + cells + '</span></div>';
    }).join('');
  }

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

  // ---------- 渲染：副本 ----------

  // 怪物「脸」：游戏模式立绘 <img>（onerror 回退 emoji），伪装模式不出图。
  function mobFace(key) {
    if (!state.real) return '';
    var m = Combat.MONSTERS[key];
    var emoji = m.role === 'boss' ? '\u{1F479}' : '\u{1F47E}';
    return '<img class="mob-face" src="/mobs/' + key + '.webp" alt="" loading="lazy" decoding="async"'
      + ' onerror="this.replaceWith(document.createTextNode(\'' + emoji + '\'))">';
  }
  function mobName(key) { var m = Combat.MONSTERS[key]; return state.real ? m.name : m.job; }

  // 材料图标：游戏模式立绘 <img>（缺图回退 emoji），伪装模式不出图。
  function matFace(key) {
    if (!state.real) return '';
    var m = Combat.MATERIALS[key];
    return '<img class="mat-face" src="/mats/' + key + '.webp" alt="" loading="lazy" decoding="async"'
      + ' onerror="this.replaceWith(document.createTextNode(\'' + m.emoji + '\'))"> ';
  }

  // 开采本期不出图，真实模式给 emoji、伪装模式留空——和 matFace 的伪装行为保持一致。
  function oreFace(key) {
    var o = Mining.ORES[key];
    return (state.real && o) ? o.emoji + ' ' : '';
  }
  function barFace(key) {
    var b = Mining.BARS[key];
    return (state.real && b) ? b.emoji + ' ' : '';
  }

  // 魔法本期不出图（符文是背包小图标、法术没有立绘位置），真实模式 emoji、伪装留空——对齐 oreFace / barFace。
  function runeFace(key) {
    var r = Magic.RUNES[key];
    return (state.real && r) ? r.emoji + ' ' : '';
  }
  function spellFace(key) {
    var sp = Magic.SPELLS[key];
    return (state.real && sp) ? sp.emoji + ' ' : '';
  }

  function raidTab() {
    var lvl = levelInfo().lvl;
    var cards = Combat.MON_KEYS.map(function (k) {
      var m = Combat.MONSTERS[k], st = Combat.monsterStats(k);
      var unlocked = Combat.monsterUnlocked(k, lvl);
      var mat = Combat.MATERIALS[m.mat];
      if (!unlocked) {
        return '<div class="mob-card mob-lock"><div class="mob-pic">?</div>'
          + '<div class="mob-nm">' + esc(mobName(k)) + '</div>'
          + '<div class="mob-sub">Lv.' + st.level + '</div></div>';
      }
      return '<div class="mob-card' + (m.role === 'boss' ? ' mob-boss' : '') + '" data-fight="' + k + '">'
        + '<div class="mob-pic">' + (state.real ? (mobFace(k) || (m.role === 'boss' ? '\u{1F479}' : '\u{1F47E}')) : '▪') + '</div>'
        + '<div class="mob-nm">' + esc(mobName(k)) + '</div>'
        + '<div class="mob-sub">Lv.' + st.level + ' · HP ' + st.hp
        + ' · ' + esc(state.real ? mat.name : mat.job) + '</div></div>';
    }).join('');
    return '<div class="pad"><div class="kb-hint">'
      + (state.real ? '点一张怪卡进入挂机战斗；打远低于自己等级的怪最安全。' : 'select an advisory to auto-resolve.')
      + '</div><div class="mob-grid">' + cards + '</div></div>';
  }

  // 装备图标：游戏模式立绘 <img>（缺图回退 emoji），伪装模式不出图。
  function equipFace(key) {
    if (!state.real) return '';
    return '<img class="eq-face" src="/equip/' + key + '.webp" alt="" loading="lazy" decoding="async"'
      + ' onerror="this.replaceWith(document.createTextNode(\'\u{1F9F0}\'))"> ';
  }
  var STAT_LABEL = { hp: '生命', atk: '攻击', matk: '魔攻', def: '防御', mdef: '魔防', agi: '敏捷', luk: '幸运', crit: '暴击', eva: '闪避' };
  var STAT_JOB = { hp: 'hp', atk: 'atk', matk: 'matk', def: 'def', mdef: 'mdef', agi: 'agi', luk: 'luk', crit: 'crit', eva: 'eva' };
  function statLabel(k) { return state.real ? STAT_LABEL[k] : STAT_JOB[k]; }
  function equipName(key) { var e = Equip.EQUIP[key]; return state.real ? e.name : e.job; }

  // 背包：扩成角色面板——装备槽（穿脱）+ 属性汇总（基础+装备）+ 已有装备 + 材料。
  function invTab() {
    var lvl = levelInfo().lvl;
    var ps = Combat.playerStats(lvl, Equip.equipBonus(state.equipped));
    // 属性面板
    var statOrder = ['hp', 'atk', 'matk', 'def', 'mdef', 'agi', 'luk', 'crit', 'eva'];
    var stats = statOrder.map(function (k) {
      return '<div class="col"><span>' + esc(statLabel(k)) + '</span><span class="typ">' + ps[k] + '</span></div>';
    }).join('');
    // 装备槽
    var slots = Equip.SLOTS.map(function (sl) {
      var e = state.equipped[sl], meta = Equip.SLOT_META[sl];
      var body = e
        ? equipFace(e.key) + esc(equipName(e.key)) + (e.level ? ' +' + e.level : '')
          + ' <a class="mini" data-uneq="' + sl + '">' + (state.real ? '卸下' : 'unequip') + '</a>'
        : '<span class="eq-empty">' + (state.real ? '空' : '—') + '</span>';
      return '<div class="eq-slot"><span class="eq-slot-nm">' + esc(state.real ? meta.name : meta.job) + '</span>' + body + '</div>';
    }).join('');
    // 已有装备
    var owned = state.owned.map(function (o, i) {
      var e = Equip.EQUIP[o.key];
      return '<tr><td>' + equipFace(o.key) + esc(equipName(o.key)) + (o.level ? ' +' + o.level : '')
        + '</td><td>' + esc(state.real ? Equip.SLOT_META[e.slot].name : Equip.SLOT_META[e.slot].job) + '</td>'
        + '<td><a class="mini" data-eq="' + i + '">' + (state.real ? '穿戴' : 'equip') + '</a></td></tr>';
    }).join('');
    // 材料
    var M = Combat.MATERIALS;
    var mats = Object.keys(M).filter(function (k) { return (state.mats[k] || 0) > 0; }).map(function (k) {
      return '<tr><td>' + matFace(k) + esc(state.real ? M[k].name : M[k].job) + '</td><td class="num">' + state.mats[k] + '</td></tr>';
    }).join('');
    return '<div class="pad">'
      + '<div class="rail-label">' + (state.real ? '角色' : 'stats') + '</div>'
      + '<div class="eq-slots">' + slots + '</div>'
      + '<div class="statgrid">' + stats + '</div>'
      + '<div class="rail-label">' + (state.real ? '装备' : 'gear') + '</div>'
      + (owned ? '<table class="grid"><tr><th>' + (state.real ? '装备' : 'item') + '</th><th>' + (state.real ? '槽' : 'slot') + '</th><th></th></tr>' + owned + '</table>'
        : '<div class="kb-hint">' + (state.real ? '还没有装备——去副本打怪掉落，或在锻造页自己打一件。' : 'no gear yet.') + '</div>')
      + '<div class="rail-label">' + (state.real ? '材料' : 'objects') + '</div>'
      + (mats ? '<table class="grid"><tr><th>' + (state.real ? '材料' : 'object') + '</th><th>' + (state.real ? '数量' : 'count') + '</th></tr>' + mats + '</table>'
        : '<div class="kb-hint">' + (state.real ? '暂无材料。' : 'no materials.') + '</div>')
      + '</div>';
  }

  // 开采：矿脉列表（选中即挂机）+ 矿石库存。冶炼在锻造 tab。
  function mineTab() {
    var lvl = levelInfo().lvl;
    var ps = Combat.playerStats(lvl, Equip.equipBonus(state.equipped));
    var now = Date.now();
    var rows = Mining.VEIN_KEYS.map(function (k) {
      var v = Mining.VEINS[k];
      if (!Mining.veinUnlocked(k, lvl)) {
        // 解锁等级并进名字列：第二列的表头是「间隔」，把等级塞那儿会让同一列出现两种量纲。
        return '<tr class="vein-locked"><td>' + esc(state.real ? '???' : v.job)
          + ' · ' + (state.real ? 'Lv.' : 'lv ') + v.unlock
          + '</td><td></td><td></td><td></td></tr>';
      }
      var cur = state.mine.vein === k;
      var status = '';
      if (cur) {
        status = (state.mine.until > now)
          ? '<span class="vein-cd">' + (state.real ? '再生中 ' : 'respawn ')
              + Math.ceil((state.mine.until - now) / 1000) + 's</span>'
          : hpBar(state.mine.hp, v.hp, 'hp-ore');
      }
      return '<tr' + (cur ? ' class="is-active"' : '') + '>'
        + '<td>' + oreFace(v.ore) + esc(state.real ? v.name : v.job) + '</td>'
        + '<td>' + (Mining.tickMs(k, ps) / 1000).toFixed(1) + 's</td>'
        + '<td>' + status + '</td>'
        + '<td>' + (cur
            ? '<span class="mini on">' + (state.real ? '开采中' : 'active') + '</span>'
            : '<a class="mini" data-vein="' + k + '">' + (state.real ? '开采' : 'mine') + '</a>')
        + '</td></tr>';
    }).join('');
    var have = Object.keys(Mining.ORES).filter(function (k) { return (state.ores[k] || 0) > 0; })
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
    return '<div class="pad">'
      + '<div class="kb-hint">' + (state.smelt.bar
          ? (state.real
              ? '正在锻造页冶炼' + Mining.BARS[state.smelt.bar].name + '；挂矿脉会把熔炉停下（同时只能做一件事）。'
              : 'smelting ' + Mining.BARS[state.smelt.bar].job + ' in the forge tab — picking a seam stops it.')
          : state.craft.rune
            ? (state.real
                ? '正在魔法页刻' + Magic.RUNES[state.craft.rune].name + '；挂矿脉会把刻符停下（同时只能做一件事）。'
                : 'compiling ' + Magic.RUNES[state.craft.rune].job + ' in the functions tab — picking a seam stops it.')
            : (state.real
                ? '选一条矿脉挂着自动开采；耐久挖空后自行再生。冶炼在锻造页。'
                : 'pick one seam; it drains and respawns on its own.')) + '</div>'
      + '<table class="grid mine-grid"><tr><th>' + (state.real ? '矿脉' : 'seam') + '</th>'
      + '<th>' + (state.real ? '间隔' : 'every') + '</th>'
      + '<th>' + (state.real ? '耐久' : 'left') + '</th><th></th></tr>' + rows + '</table>'
      + '<div class="rail-label">' + (state.real ? '矿石' : 'objects') + '</div>'
      + (have ? '<table class="grid"><tr><th>' + (state.real ? '矿石' : 'object') + '</th>'
          + '<th>' + (state.real ? '数量' : 'count') + '</th>'
          + '<th>' + (state.real ? '单价' : 'unit') + '</th>'
          + '<th>' + (state.real ? '合计' : 'total') + '</th><th></th></tr>' + have + '</table>'
        : '<div class="kb-hint">' + (state.real ? '还没有矿石。' : 'no ore yet.') + '</div>')
      + '</div>';
  }

  // 锻造：上半部熔炉（矿石→锭），下半部装备配方（吃锭）。
  function forgeTab() {
    var lvl = levelInfo().lvl;
    var coal = Mining.ORES[Mining.COAL_KEY];
    // 冶炼是挂机活动（与开采互斥），操作列要区分「正在炼这个」「能炼但没在炼」「炼不了」三态。
    var smeltingNow = state.smelt.bar;
    var smelt = Mining.BAR_KEYS.map(function (bk) {
      var b = Mining.BARS[bk], c = Mining.smeltCheck(bk, state), o = Mining.ORES[b.ore];
      var haveBar = state.bars[bk] || 0;
      var need = '<span class="' + (c.oresOk ? '' : 'rec-miss') + '">' + oreFace(b.ore)
          + esc(state.real ? o.name : o.job) + '×' + c.recipe.ores[b.ore] + '</span>'
        + ' · <span class="' + (c.coalOk ? '' : 'rec-miss') + '">' + oreFace(Mining.COAL_KEY)
          + esc(state.real ? coal.name : coal.job) + '×' + c.recipe.coal + '</span>';
      return '<tr><td>' + barFace(bk) + esc(state.real ? b.name : b.job) + '</td>'
        + '<td class="num">' + haveBar + '</td>'
        + '<td class="num">' + b.price + '</td>'
        + '<td class="rec-need">' + need + '</td>'
        + '<td>' + (smeltingNow === bk
            ? '<span class="mini on">' + (state.real ? '冶炼中' : 'smelting') + '</span> '
              + '<a class="mini" data-smeltstop="1">' + (state.real ? '停' : 'stop') + '</a>'
            : c.ok
              ? '<a class="mini" data-smelt="' + bk + '">' + (state.real ? '开炼' : 'smelt') + '</a>'
              : '<button class="btn btn-dim" disabled>' + (state.real ? '开炼' : 'smelt') + '</button>')
        + '</td>'
        // 卖/锁单独一列：开炼/停炼是控制挂机活动、卖/锁是处置库存，两者语义不同且误触代价不对称
        // （点错「停」只是暂停冶炼，点错「卖」会把攒的锭清空换钱），不该挤在同一格里靠空格分隔。
        // 没库存就不渲染卖/锁——否则新玩家一进锻造页就看到 6 个点了没反应的死控件（sellbar 本身
        // 有 n>0 保护，不会误卖，但空按钮很碍眼），与矿石表 mineTab 只渲染有库存的行口径一致。
        + (haveBar > 0
            ? '<td><a class="mini" data-act="sellbar" data-c="' + bk + '">' + (state.real ? '卖' : 'sell') + '</a> '
              + '<a class="mini' + (state.lock['b:' + bk] ? ' on' : '') + '" data-act="lockbar" data-c="' + bk + '">'
              + (state.lock['b:' + bk] ? '\u{1F512}' : '\u{1F513}') + '</a></td>'
            : '<td></td>')
        + '</tr>';
    }).join('');
    var rows = Equip.EQUIP_KEYS.map(function (k) {
      var c = Equip.recipeCheck(k, state, lvl), r = c.recipe;
      var need = Object.keys(r.mats).map(function (m) {
        return esc(state.real ? Combat.MATERIALS[m].name : Combat.MATERIALS[m].job) + '×' + r.mats[m];
      }).join(' ');
      var barNeed = Object.keys(r.bars).map(function (b) {
        return barFace(b) + esc(state.real ? Mining.BARS[b].name : Mining.BARS[b].job) + '×' + r.bars[b];
      }).join(' ');
      // 等级不够是「阶段未到」，整行弱化；料/锭/金币不够是「差一点」，保留正常对比度让玩家看清还差什么。
      return '<tr' + (c.levelOk ? '' : ' class="forge-lock"') + '><td>' + equipFace(k) + esc(equipName(k)) + '</td>'
        + '<td class="' + (c.levelOk ? '' : 'rec-miss') + '">' + (state.real ? 'Lv.' : 'lv ') + r.level + '</td>'
        + '<td class="rec-need"><span class="' + (c.matsOk ? '' : 'rec-miss') + '">' + need + '</span>'
        + ' · <span class="' + (c.barsOk ? '' : 'rec-miss') + '">' + barNeed + '</span>'
        + ' · <span class="' + (c.coinsOk ? '' : 'rec-miss') + '">&#x25C8;' + r.coins + '</span></td>'
        + '<td>' + (c.ok
            ? '<a class="mini" data-forge="' + k + '">' + (state.real ? '锻造' : 'forge') + '</a>'
            : '<button class="btn btn-dim" disabled>' + (state.real ? '锻造' : 'forge') + '</button>')
        + '</td></tr>';
    }).join('');
    return '<div class="pad"><div class="kb-hint">' + (smeltingNow
          ? (state.real
              ? '正在冶炼' + Mining.BARS[smeltingNow].name + '，材料还够炼 '
                + Mining.smeltRounds(smeltingNow, state) + ' 个——用尽会自动停。'
              : 'smelting ' + Mining.BARS[smeltingNow].job + ' — stock lasts '
                + Mining.smeltRounds(smeltingNow, state) + ' more, then it halts.')
          : state.mine.vein
            ? (state.real
                ? '正在开采' + Mining.VEINS[state.mine.vein].name + '；开炼会把矿脉停下（同时只能做一件事）。'
                : 'mining ' + Mining.VEINS[state.mine.vein].job + ' — starting a smelt stops it.')
            : state.craft.rune
              ? (state.real
                  ? '正在魔法页刻' + Magic.RUNES[state.craft.rune].name + '；开炼会把刻符停下（同时只能做一件事）。'
                  : 'compiling ' + Magic.RUNES[state.craft.rune].job + ' in the functions tab — starting a smelt stops it.')
              : (state.real
                  ? '矿石来自开采页；炼成锭后回这里锻造装备。'
                  : 'ore comes from the mine tab — smelt it into bars, then forge here.'))
      + '</div>'
      + '<div class="rail-label">' + (state.real ? '熔炉' : 'furnace') + '</div>'
      + '<table class="grid"><tr><th>' + (state.real ? '锭' : 'bar') + '</th>'
      + '<th>' + (state.real ? '存量' : 'have') + '</th>'
      + '<th>' + (state.real ? '单价' : 'unit') + '</th>'
      + '<th>' + (state.real ? '需求' : 'cost') + '</th><th></th><th></th></tr>' + smelt + '</table>'
      + '<div class="rail-label">' + (state.real ? '锻造' : 'smithy') + '</div>'
      + '<table class="grid"><tr><th>' + (state.real ? '产出' : 'item') + '</th>'
      + '<th>' + (state.real ? '等级' : 'lv') + '</th>'
      + '<th>' + (state.real ? '需求' : 'cost') + '</th><th></th></tr>' + rows + '</table></div>';
  }

  // 刻符表的一格（矿路线或锭路线）：需求 → 产出 + 操作。三态：正在刻这格（compiling + halt + 剩余次数）/
  // 能刻（compile）/ 料不够或等级不够（灰按钮）。正在刻的格加 is-active，让玩家一眼看到活动落在哪条路线上。
  function craftCell(runeKey, src, chk, needHtml) {
    var active = state.craft.rune === runeKey && state.craft.src === src;
    var btn;
    if (active) {
      btn = '<span class="mini on">' + (state.real ? '刻符中' : 'compiling') + '</span> '
        + '<a class="mini" data-craftstop="1">' + (state.real ? '停止' : 'halt') + '</a> '
        + '<span class="rec-need">' + Magic.craftRounds(runeKey, src, state) + (state.real ? ' 次' : ' more') + '</span>';
    } else if (chk.ok) {
      btn = '<a class="mini" data-craft="' + runeKey + '" data-src="' + src + '">' + (state.real ? '刻符' : 'compile') + '</a>';
    } else {
      btn = '<button class="btn btn-dim" disabled>' + (state.real ? '刻符' : 'compile') + '</button>';
    }
    return '<td class="rec-need' + (active ? ' is-active' : '') + '">' + needHtml + ' &rarr; ' + chk.recipe.out + '<br>' + btn + '</td>';
  }

  // 魔法：伪装成 Supabase 的 Database → Functions。法术 = 维护函数（列头用 pg_proc 真实列名 proname/procost/proargtypes/proacl），
  // 法书 = 该函数的 EXECUTE 权限（grant / granted），符文 = 编译产物 glyph（compile / halt）。
  // 伪装等级写 'lv ' / 'lv'，与开采页矿脉行（mineTab 的 'lv ' + v.unlock）、锻造页配方表（forgeTab 的 'lv ' + r.level、表头 'lv'）同一写法——
  // RPG 各页统一 'lv'；spec 写的 lvl 不采用（老农场右栏 renderRail 的种子信息行写的是 lvl，那是更早的写法，不作为 RPG 页的参照）。
  // 法术全局单选：点当前施放行的 stop 即回普攻，不放「普攻」行。每秒 innerHTML 全量重绘、data-* 委托，无持久控件。
  function magicTab() {
    var lvl = levelInfo().lvl;
    var ps = Combat.playerStats(lvl, Equip.equipBonus(state.equipped));
    var coal = Mining.ORES[Mining.COAL_KEY];
    var crafting = state.craft.rune;
    var spellRows = Magic.SPELL_KEYS.map(function (k) {
      var sp = Magic.SPELLS[k], rn = Magic.RUNES[sp.rune];
      if (!Magic.spellUnlocked(k, lvl)) {
        return '<tr class="vein-locked"><td>' + esc(state.real ? '???' : sp.job) + '</td>'
          + '<td>' + (state.real ? 'Lv.' : 'lv ') + sp.unlock + '</td><td></td><td></td><td></td></tr>';
      }
      var bc = Magic.bookCheck(k, state, lvl);
      var cur = state.spell === k;
      var action;
      if (!bc.owned) {
        var grant = (state.real ? '购买法书 · ' : 'grant · ') + bc.price + ' ' + coinsWord();
        action = bc.ok
          ? '<a class="mini" data-book="' + k + '">' + grant + '</a>'
          : '<button class="btn btn-dim" disabled>' + grant + '</button>';
      } else if (cur) {
        action = '<span class="mini on">' + (state.real ? '施放中' : 'invoking') + '</span> '
          + '<a class="mini" data-spell="' + k + '">' + (state.real ? '停用' : 'stop') + '</a>';
      } else {
        action = (state.real ? '已拥有' : 'granted') + ' · <a class="mini" data-spell="' + k + '">' + (state.real ? '施放' : 'invoke') + '</a>';
      }
      return '<tr' + (cur ? ' class="is-active"' : '') + '>'
        + '<td>' + spellFace(k) + esc(state.real ? sp.name : sp.job) + '</td>'
        + '<td>' + (state.real ? 'Lv.' : 'lv ') + sp.unlock + '</td>'
        + '<td class="num">' + sp.power + '</td>'
        + '<td>' + runeFace(sp.rune) + esc(state.real ? rn.name : rn.job) + ' <span class="num">' + (state.runes[sp.rune] || 0) + '</span></td>'
        + '<td>' + action + '</td></tr>';
    }).join('');
    var runeRows = Magic.RUNE_KEYS.map(function (k) {
      var rn = Magic.RUNES[k];
      if (lvl < rn.unlock) {
        return '<tr class="vein-locked"><td>' + esc(state.real ? '???' : rn.job)
          + ' · ' + (state.real ? 'Lv.' : 'lv ') + rn.unlock + '</td><td></td><td></td><td></td></tr>';
      }
      var ore = Mining.ORES[rn.ore], bar = Mining.BARS[rn.bar];
      var co = Magic.craftCheck(k, 'ore', state, lvl), cb = Magic.craftCheck(k, 'bar', state, lvl);
      // 需求数量与「够不够」都从 craftCheck 的 recipe 取，不在这里写死 ×1：配方是 magic.js 的知识，
      // 那边改了这里要自动跟上（同 forgeTab 用 smeltCheck 的 recipe 一样，farm.js 不重复断言数值）。
      var needOre = co.recipe.ores[rn.ore], needCoal = co.recipe.ores[Mining.COAL_KEY], needBar = cb.recipe.bars[rn.bar];
      var oreNeed = '<span class="' + ((state.ores[rn.ore] || 0) >= needOre ? '' : 'rec-miss') + '">' + oreFace(rn.ore)
          + esc(state.real ? ore.name : ore.job) + '×' + needOre + '</span>'
        + ' · <span class="' + ((state.ores[Mining.COAL_KEY] || 0) >= needCoal ? '' : 'rec-miss') + '">' + oreFace(Mining.COAL_KEY)
          + esc(state.real ? coal.name : coal.job) + '×' + needCoal + '</span>';
      var barNeed = '<span class="' + (cb.barsOk ? '' : 'rec-miss') + '">' + barFace(rn.bar)
          + esc(state.real ? bar.name : bar.job) + '×' + needBar + '</span>'
        + ' · <span class="' + (cb.coinsOk ? '' : 'rec-miss') + '">' + cb.recipe.coins + ' ' + coinsWord() + '</span>';
      return '<tr><td>' + runeFace(k) + esc(state.real ? rn.name : rn.job) + '</td>'
        + '<td class="num">' + (state.runes[k] || 0) + '</td>'
        + craftCell(k, 'ore', co, oreNeed)
        + craftCell(k, 'bar', cb, barNeed)
        + '</tr>';
    }).join('');
    // kb-hint 四态：正在刻符 / 开采中 / 冶炼中 / 空闲（spec 五.2）。
    var hint = crafting
      ? (state.real
          ? '正在用' + (state.craft.src === 'bar' ? '锭' : '矿石') + '刻' + Magic.RUNES[crafting].name + '，材料还够 '
            + Magic.craftRounds(crafting, state.craft.src, state) + ' 次——用尽自动停。'
          : 'compiling ' + Magic.RUNES[crafting].job + ' from ' + state.craft.src + ' — stock lasts '
            + Magic.craftRounds(crafting, state.craft.src, state) + ' more, then it halts.')
      : state.mine.vein
        ? (state.real
            ? '正在开采' + Mining.VEINS[state.mine.vein].name + '；刻符会把矿脉停下（同时只能做一件事）。'
            : 'mining ' + Mining.VEINS[state.mine.vein].job + ' — compiling stops it.')
        : state.smelt.bar
          ? (state.real
              ? '正在冶炼' + Mining.BARS[state.smelt.bar].name + '；刻符会把熔炉停下（同时只能做一件事）。'
              : 'smelting ' + Mining.BARS[state.smelt.bar].job + ' — compiling stops it.')
          : (state.real
              ? '选一条法术在副本里施放；用矿石或锭刻符文当弹药。'
              : 'pick a function to invoke in raids; compile glyphs from ore or bars.');
    return '<div class="pad">'
      + '<div class="kb-hint">' + hint + '</div>'
      + '<table class="grid magic-grid"><tr><th>' + (state.real ? '法术' : 'proname') + '</th>'
      + '<th>' + (state.real ? '等级' : 'lv') + '</th>'
      + '<th>' + (state.real ? '威力' : 'procost') + '</th>'
      + '<th>' + (state.real ? '符文' : 'proargtypes') + '</th>'
      + '<th>' + (state.real ? '法书' : 'proacl') + '</th></tr>' + spellRows + '</table>'
      // 让 mdef 的作用可见：保留率 = min(40%, mdef × 0.4%)，换上防具/饰品这里会涨。
      + '<div class="rec-need">' + (state.real ? '符文保留 ' : 'preserve ') + Math.round(Magic.preserveChance(ps) * 100) + '%'
      + (state.real ? '（魔防 ' + ps.mdef + '，每点 +0.4%，上限 40%）' : ' · mdef ' + ps.mdef) + '</div>'
      + '<div class="rail-label">' + (state.real ? '符文' : 'glyphs') + '</div>'
      + '<table class="grid magic-grid"><tr><th>' + (state.real ? '符文' : 'glyph') + '</th>'
      + '<th>' + (state.real ? '库存' : 'stock') + '</th>'
      + '<th>' + (state.real ? '矿路线' : 'from ore') + '</th>'
      + '<th>' + (state.real ? '锭路线' : 'from bar') + '</th></tr>' + runeRows + '</table>'
      + '</div>';
  }

  function hpBar(cur, max, cls) {
    var pct = Math.max(0, Math.min(100, cur / max * 100));
    return '<div class="hpbar"><span class="hpfill ' + cls + '" style="width:' + pct.toFixed(1) + '%"></span>'
      + '<span class="hptxt">' + Math.max(0, Math.round(cur)) + '/' + max + '</span></div>';
  }
  // 受击/暴击/击杀的动画类与飘字。fx 由 battleTick 每回合算好，这里消费一次。
  function fxClass(dmg, crit, died) {
    if (died) return ' is-kill';
    if (dmg > 0) return crit ? ' is-hit is-crit' : ' is-hit';
    return '';
  }
  function fxFloat(dmg, crit) {
    if (!dmg) return '';
    return '<span class="dmg-float' + (crit ? ' is-crit' : '') + '">-' + dmg + '</span>';
  }

  function battleView() {
    if (!state.battle || !Combat.MONSTERS[state.battle.mob]) { state.battle = null; return raidTab(); }
    var b = state.battle, lvl = levelInfo().lvl;
    var ps = Combat.playerStats(lvl, Equip.equipBonus(state.equipped));
    var mon = Combat.monsterStats(b.mob);
    var fx = battleFx; battleFx = null;   // 消费一次，避免每秒 render 重放
    var scene = state.real ? '<div class="arena" style="background-image:url(/arena.webp),linear-gradient(160deg,#141821,#0c0f16)"></div>' : '';
    var logHtml = (b.log || []).slice(-8).map(function (l) {
      var who = l.who === 'p' ? (state.real ? '你' : 'job') : mobName(b.mob);
      var t;
      if (l.dodged) t = state.real ? ' 未命中' : ' miss';
      else if (l.magic) {
        // 法术命中：真身「施放 造成 N」/ 怪「法术 造成 N」；伪装 `~N`（~ 是 PG 的正则匹配运算符），物理仍是 -N。
        t = (state.real ? (l.who === 'p' ? ' 施放 造成 ' : ' 法术 造成 ') : ' ~') + l.dmg + (l.crit ? (state.real ? ' 暴击!' : '!') : '');
      } else t = (state.real ? ' 造成 ' : ' -') + l.dmg + (l.crit ? (state.real ? ' 暴击!' : '!') : '');
      return '<div class="blog-line">' + esc(who + t) + '</div>';
    }).join('');
    // 副本页只加一句施法状态，不放风格条：法术在魔法页全局单选。没选法术 / 等级法书不满足时不加。
    var cs = Magic.castable(state, lvl);
    var castHint = '';
    if (cs.ok) {
      castHint = ' · ' + (state.real
        ? '施放 ' + Magic.SPELLS[cs.spell].name + '，剩 ' + (state.runes[cs.rune] || 0) + ' ' + Magic.RUNES[cs.rune].name
        : 'invoking ' + Magic.SPELLS[cs.spell].job + ' · ' + (state.runes[cs.rune] || 0) + ' ' + Magic.RUNES[cs.rune].job + ' left');
    } else if (cs.reason === 'runes') {
      castHint = ' · ' + (state.real
        ? Magic.SPELLS[cs.spell].name + ' 缺 ' + Magic.RUNES[cs.rune].name + '，普攻中'
        : Magic.SPELLS[cs.spell].job + ' needs ' + Magic.RUNES[cs.rune].job + ' — plain attacks');
    }

    var heroCls = fx ? fxClass(fx.pDmg, fx.pCrit, false) : '';
    var monCls = fx ? fxClass(fx.mDmg, fx.mCrit, fx.monDied) : '';
    var heroFloat = fx ? fxFloat(fx.pDmg, fx.pCrit) : '';
    var monFloat = fx ? fxFloat(fx.mDmg, fx.mCrit) : '';

    // 战利品堆：战斗中不入账，只在这里显示；退出/结束时一起收取。
    var lootItems = '';
    if (b.drops.coins) lootItems += '<span class="loot-i">◈ ' + b.drops.coins + '</span>';
    if (b.drops.xp) lootItems += '<span class="loot-i">xp+' + b.drops.xp + '</span>';
    for (var mk in b.drops.mats) lootItems += '<span class="loot-i">'
      + matFace(mk) + esc(state.real ? Combat.MATERIALS[mk].name : Combat.MATERIALS[mk].job) + ' ×' + b.drops.mats[mk] + '</span>';
    var bEquip = b.drops.equip || [];
    for (var qi = 0; qi < bEquip.length; qi++) {
      var ek = bEquip[qi].key;
      lootItems += '<span class="loot-i loot-eq">' + esc(state.real ? Equip.EQUIP[ek].name : Equip.EQUIP[ek].job) + '</span>';
    }

    return '<div class="pad">' + scene
      + '<div class="battle">'
      + '<div class="fighter"><div class="f-pic hero' + heroCls + '">' + heroFloat
      + (state.real ? '<img src="/hero.webp" alt="" decoding="async" onerror="this.replaceWith(document.createTextNode(\'\u{1F9B8}\'))">' : 'me')
      + '</div>'
      + '<div class="f-nm">' + (state.real ? '维护者 Lv.' + lvl : 'worker') + '</div>' + hpBar(b.hp, ps.hp, 'hp-p') + '</div>'
      + '<div class="vs">VS</div>'
      + '<div class="fighter"><div class="f-pic' + monCls + '">' + monFloat
      + (state.real ? (mobFace(b.mob) || '\u{1F47E}') : '▪') + '</div>'
      + '<div class="f-nm">' + esc(mobName(b.mob)) + '</div>' + hpBar(b.monHp, mon.hp, 'hp-m') + '</div>'
      + '</div>'
      + '<div class="blog">' + logHtml + '</div>'
      + '<div class="loot"><span class="loot-lbl">' + (state.real ? '战利品' : 'pending') + '</span>'
      + (lootItems || '<span class="loot-none">' + (state.real ? '暂无' : '—') + '</span>') + '</div>'
      + '<div class="kb-hint">' + (state.real ? '击杀 ' : 'resolved ') + b.kills
      + ' · ' + (state.real ? '血不回；退出回满血并收取战利品' : 'hp persists; loot on exit') + castHint + '</div>'
      + '<div class="kb-tools"><button class="btn" data-act="flee">' + (state.real ? '退出（回满血·收取战利品）' : 'exit') + '</button></div>'
      + '</div>';
  }

  // 战斗定时器：一回合/400ms，独立于 render 的 1s tick，负责顺滑推进战斗。
  var battleTimer = null;
  function startBattleTimer() {
    stopBattleTimer();
    battleTimer = setInterval(battleTick, Combat.BATTLE_TICK_MS);
  }
  function stopBattleTimer() { if (battleTimer) { clearInterval(battleTimer); battleTimer = null; } }

  var STALL_ROUNDS = 300;
  var battleFx = null;   // 本回合瞬时特效，battleView 消费一次即清（受击/暴击/击杀的动画与飘字）

  // 只重绘对战容器，避免每 tick 整屏重画。
  function paintBattle() {
    if (!mainEl) return;
    var host = mainEl.querySelector('.farm-wrap');
    if (host) host.innerHTML = battleView();
  }

  // 结束当前战斗：把掉落堆一次性收取、清空 battle、停定时器、回卡牌墙。
  // defeat=true（战死）时补一记全屏红闪。这是所有「战斗结束」路径的统一出口。
  function endBattle(msg, defeat) {
    battleFx = null;   // 清掉这一回合可能残留的特效，别泄漏到下一场战斗的第一帧
    collectDrops(state.battle);
    state.battle = null;
    stopBattleTimer();
    if (msg) toast(msg);
    save(); redraw();
    if (defeat && mainEl) {
      mainEl.classList.add('defeat-flash');
      setTimeout(function () { if (mainEl) mainEl.classList.remove('defeat-flash'); }, 500);
    }
  }

  function battleTick() {
    var b = state.battle;
    if (!b || !mainEl || state.tab !== 'raid') { stopBattleTimer(); return; }
    // 老存档的 drops 可能没有 equip 字段（migrateCombat 只补了 drops 本身，没补这个子字段）——这里兜底。
    if (b.drops && !b.drops.equip) b.drops.equip = [];
    var ps = Combat.playerStats(levelInfo().lvl, Equip.equipBonus(state.equipped));
    var mon = Combat.monsterStats(b.mob);
    if (!mon) { endBattle('', false); return; }   // 坏 mob key 也走统一出口（顺带收下已堆的掉落）
    // 施法：选了法术且等级/法书/符文都满足才给 ps 挂 castPower（走魔法路径）；否则 ps 不带它，resolveRound 按普攻算。
    // 每回合现算，所以符文烧完自动退回普攻、刻出新符文又自动接上，战斗永远不会停下来（有意偏离 Melvor 的「打不出法术」）。
    var cs = Magic.castable(state, levelInfo().lvl);
    if (cs.ok) { ps.castPower = cs.power; b.runesOutToasted = false; }
    var prevMonHp = b.monHp;
    var res = Combat.resolveRound(ps, b.hp, mon, b.monHp, Math.random);
    b.hp = res.playerHp; b.monHp = res.monHp;
    b.log = (b.log || []).concat(res.log).slice(-20);
    // 烧符文：每次魔法出手掷一次保留率（闪避也算——符文已经扔出去了），不保留就扣 1 枚。
    // 一回合玩家最多出手一次，回合开始时 castable 已保证 ≥1 枚，所以扣完不会负。
    if (cs.ok) {
      var preserve = Magic.preserveChance(ps);
      for (var ci = 0; ci < res.log.length; ci++) {
        var cl = res.log[ci];
        if (cl.who !== 'p' || !cl.magic) continue;
        state.stats.casts += 1;
        if (Math.random() >= preserve) state.runes[cs.rune] -= 1;
      }
      // 扣到 0 只 toast 一次（标志存在 battle 对象上），直到符文再次补上才会再提示。
      if ((state.runes[cs.rune] || 0) <= 0 && !b.runesOutToasted) {
        b.runesOutToasted = true;
        toast(state.real ? '符文耗尽，已改为普攻' : 'out of glyphs — plain attacks');
      }
    }

    // 本回合特效：谁受了多少伤、有没有暴击、怪有没有被击杀。
    var fx = { mDmg: 0, mCrit: false, pDmg: 0, pCrit: false, monDied: res.monDead };
    for (var li = 0; li < res.log.length; li++) {
      var lg = res.log[li];
      if (lg.dodged) continue;
      if (lg.who === 'p') { fx.mDmg += lg.dmg; if (lg.crit) fx.mCrit = true; }
      else { fx.pDmg += lg.dmg; if (lg.crit) fx.pCrit = true; }
    }
    battleFx = fx;

    // 僵局保护：连续 STALL_ROUNDS 回合打不动怪（monHp 没降且没死）＝打不过，自动撤离。
    if (!res.monDead && b.monHp >= prevMonHp) b.stall = (b.stall || 0) + 1; else b.stall = 0;
    if (b.stall >= STALL_ROUNDS) { endBattle(state.real ? '打不动，已撤离' : 'stalemate — evicted', false); return; }
    // 主角战死：结束、收取掉落、回满血、回卡牌墙、红闪。
    if (res.playerDead) { endBattle(state.real ? '主角战死，掉落已收' : 'evicted', true); return; }

    if (res.monDead) {
      b.kills++;
      // 掉落不即时入账，只堆进 b.drops，退出/结束时一起拾取（见 collectDrops/endBattle）。
      var d = Combat.rollDrops(b.mob, ps.luk, Math.random);
      b.drops.xp += d.xp; b.drops.coins += d.coins;
      for (var k in d.mats) b.drops.mats[k] = (b.drops.mats[k] || 0) + d.mats[k];
      var mdef = Combat.MONSTERS[b.mob];
      var eq = Equip.rollEquipDrop(mdef.role, mdef.tier, ps.luk, Math.random);
      if (eq) b.drops.equip.push({ key: eq, level: 0 });
      state.mobDex[b.mob] = (state.mobDex[b.mob] || 0) + 1;
      b.monHp = mon.hp; // 同种重生
    }
    b.last = Date.now();
    saveSoon();
    paintBattle();
  }

  // ---------- 渲染：订单 ----------

  function orderTab() {
    var cards = state.orders.map(function (o) {
      var have = state.bag[o.crop] || 0;
      var ok = have >= o.qty;
      return '<div class="od' + (ok ? ' od-ok' : '') + '">'
        + '<div class="od-title">' + esc(L(CROPS[o.crop])) + ' × ' + o.qty + '</div>'
        + '<div class="od-sub">' + have + ' / ' + o.qty + ' &middot; +' + o.reward + ' ' + coinsWord() + ' &middot; +' + o.xp + ' xp</div>'
        + '<button class="btn' + (ok ? ' btn-primary' : '') + '" data-act="deliver" data-id="' + o.id + '"'
        + (ok ? '' : ' disabled') + '>' + (state.real ? '交付' : 'serve') + '</button></div>';
    }).join('');
    var next = Math.max(0, ORDER_REFRESH_MS - (Date.now() - state.ordersAt));
    return '<div class="pad"><div class="kb-hint">'
      + (state.real ? '订单价高于直接卖，是换种子的主要来源。' : 'replicas pay above flush value.')
      + '</div><div class="od-grid">' + cards + '</div>'
      + '<div class="kb-tools"><button class="btn" data-act="reroll">'
      + (state.real ? '刷新（-50）' : 'reroll -50') + '</button>'
      + '<span class="kb-hint inline">' + (state.real ? '自动刷新还有 ' : 'auto reroll in ')
      + fmtMs(next) + '</span></div></div>';
  }

  // ---------- 渲染：动物 ----------

  function zooTab() {
    var mail = state.mail.map(function (a) {
      var d = ANIMALS[a];
      return '<div class="an an-mail"><div class="an-face">✉</div>'
        + '<div class="an-body"><div class="an-name">' + esc(L(d)) + '</div>'
        + '<div class="an-sub">' + (state.real ? '想搬来你的农场' : 'requests subscription') + '</div></div>'
        + '<button class="btn btn-primary" data-act="reply" data-a="' + a + '">'
        + (state.real ? '回信' : 'accept') + '</button></div>';
    }).join('');

    var owned = ANIMAL_KEYS.filter(has).map(function (a) {
      var d = ANIMALS[a];
      var rec = state.animals[a];
      var lv = affLevel(a);
      var canFeed = (state.bag[d.like] || 0) > 0 && rec.fed < FEED_PER_DAY;
      return '<div class="an"><div class="an-face">' + (state.real ? d.emoji : '◉') + '</div>'
        + '<div class="an-body"><div class="an-name">' + esc(L(d))
        + ' <span class="an-lv">' + (state.real ? '好感 ' : 'aff ') + lv + '/5</span></div>'
        + '<div class="an-sub">' + esc(state.real ? d.perk : d.ejob)
        + ' &middot; ' + (state.real ? '爱吃 ' : 'feeds on ') + esc(L(CROPS[d.like])) + '</div></div>'
        + '<button class="btn' + (canFeed ? '' : ' btn-dim') + '" data-act="feed" data-a="' + a + '"'
        + (canFeed ? '' : ' disabled') + '>' + (state.real ? '喂食' : 'feed') + ' '
        + (FEED_PER_DAY - rec.fed) + '</button></div>';
    }).join('');

    var locked = ANIMAL_KEYS.filter(function (a) { return !has(a) && state.mail.indexOf(a) < 0; })
      .map(function (a) {
        var d = ANIMALS[a];
        var cond;
        if (a === 'cat') cond = state.real ? '修好鱼塘' : 'enable reclaim daemon';
        else if (a === 'chicken') cond = (state.real ? '建鸡舍 -' : 'build coop -') + COOP_COST;
        else if (a === 'bear') cond = (state.real ? '攒 ' : 'hold ') + BEAR_EELS + ' × ' + L(FISH.eel)
          + ' (' + (state.fish.eel || 0) + ')';
        else cond = (state.real ? '收获 ' : 'flush ') + d.need + ' × ' + L(CROPS[d.like])
          + ' (' + (state.dex[d.like] || 0) + ')';
        var btn = (a === 'chicken' && !state.coop)
          ? '<button class="btn" data-act="coop">' + (state.real ? '建造' : 'build') + '</button>' : '';
        return '<div class="an an-off"><div class="an-face">?</div>'
          + '<div class="an-body"><div class="an-name">' + esc(state.real ? d.name : d.job) + '</div>'
          + '<div class="an-sub">' + esc(cond) + '</div></div>' + btn + '</div>';
      }).join('');

    return '<div class="pad">' + (mail ? '<div class="rail-label">'
      + (state.real ? '邮箱' : 'pending') + '</div>' + mail : '')
      + '<div class="rail-label">' + (state.real ? '已入住' : 'active') + '</div>' + owned
      + '<div class="rail-label">' + (state.real ? '未解锁' : 'available') + '</div>' + locked + '</div>';
  }

  // ---------- 渲染：统计 ----------

  function statsTab() {
    var linked = window.Tracer && window.Tracer.focus;
    if (linked) syncFocus(linked.read());
    var focusKeys = linked && !state.focusLink.allKeys;
    var keys = focusKeys ? focusSnapshot.activity.keys : state.keys;
    var max = 1;
    ALL_KEYS.forEach(function (k) { max = Math.max(max, keys[k] || 0); });
    var heat = KB_ROWS.map(function (row) {
      return '<div class="kb-row">' + row.map(function (k) {
        var n = keys[k] || 0;
        var a = n / max;
        return '<div class="pk pk-heat' + (k === 'SPC' ? ' pk-wide' : '') + '" title="' + n + '"'
          + ' style="background:rgba(62,207,142,' + (0.05 + a * 0.7).toFixed(3) + ')">'
          + '<span class="pk-cap">' + esc(keyCap(k)) + '</span>'
          + '<span class="pk-sub">' + n + '</span></div>';
      }).join('') + '</div>';
    }).join('');

    var cdex = CROP_KEYS.filter(function (k) { return state.dex[k]; }).length;
    var fdex = FISH_KEYS.filter(function (k) { return state.fish[k]; }).length;
    var adex = ANIMAL_KEYS.filter(has).length;
    var p = state.pomo;
    var pomoBtn = p.mode === 'idle'
      ? '<button class="btn btn-primary" data-act="pomo">' + (state.real ? '开始专注 25:00' : 'start window 25:00') + '</button>'
      : '<button class="btn" data-act="pomostop">' + (p.mode === 'focus' ? (state.real ? '专注中 ' : 'focus ') : (state.real ? '休息中 ' : 'break '))
        + fmtMs(p.until - Date.now()) + ' &middot; ' + (state.real ? '停止' : 'stop') + '</button>';
    if (linked) pomoBtn = '<button class="btn btn-primary" data-act="pomo">' + focusLabel('打开番茄钟', 'Open Pomodoro') + ' · ' + window.TracerFocus.format(window.TracerFocus.remaining(focusSnapshot, Date.now())) + '</button>';

    var rows = [
      [state.real ? '总按键' : 'key events', state.stats.taps],
      [state.real ? '鼠标点击' : 'clicks', state.clicks],
      [state.real ? '阅读面板输入' : 'panel input', state.stats.ext],
      [state.real ? '收获总数' : 'objects flushed', state.stats.harvested],
      [state.real ? '累计金币' : 'tokens earned', state.stats.earned],
      [state.real ? '完成订单' : 'requests served', state.stats.orders],
      [state.real ? '钓到的鱼' : 'segments reclaimed', state.stats.fish],
      [state.real ? '开采总数' : 'blocks mined', state.stats.mined],
      [state.real ? '施法次数' : 'invocations', state.stats.casts],
      [state.real ? '专注次数' : 'windows completed', p.done],
      [state.real ? '作物图鉴' : 'object dex', cdex + ' / ' + CROP_KEYS.length],
      [state.real ? '鱼类图鉴' : 'segment dex', fdex + ' / ' + FISH_KEYS.length],
      [state.real ? '动物图鉴' : 'subscriber dex', adex + ' / ' + ANIMAL_KEYS.length],
    ].map(function (r) {
      return '<div class="col"><span>' + esc(r[0]) + '</span><span class="typ">' + esc(r[1]) + '</span></div>';
    }).join('');

    var linkedStats = linked ? '<div class="statgrid focus-garden-stats"><div class="col"><span>' + focusLabel('累计专注分钟', 'Focus minutes') + '</span><span class="typ" data-focus-stat="minutes">' + focusSnapshot.totalMinutes + '</span></div><div class="col"><span>' + focusLabel('专注期间点击', 'Clicks during focus') + '</span><span class="typ" data-focus-stat="clicks">' + focusSnapshot.activity.clicks + '</span></div><div class="col"><span>' + focusLabel('外部键盘输入次数', 'External key events') + '</span><span class="typ">' + focusSnapshot.activity.unknown + '</span></div></div>' : '';
    return '<div class="pad"><div class="rail-label">'
      + (linked ? focusKeys ? focusLabel('专注按键热力', 'Focus key heatmap') : focusLabel('全部按键热力', 'All key activity') : state.real ? '按键热力（越绿敲得越多）' : 'per-shard access') + '</div>'
      + (linked ? '<button class="btn" data-act="focuskeys">' + (focusKeys ? focusLabel('查看全部按键', 'Show all activity') : focusLabel('只看专注期间', 'Show focus activity')) + '</button><p class="kb-hint">' + focusLabel('专注时自动累计；暂停和休息不计入。浏览器只统计应用内输入，外部按键仅记次数。', 'Counts during focus; paused sessions and breaks are excluded. The browser counts in-app input; external keys are counted without key identity.') + '</p>' : '')
      + '<div class="kb">' + heat + '</div>'
      + '<div class="rail-label">' + (state.real ? '番茄钟' : 'maintenance window') + '</div>'
      + '<div class="kb-tools">' + pomoBtn + '<span class="kb-hint inline">'
      + (linked ? focusLabel('与顶部番茄钟共用计时；完成专注自动浇水并奖励 60 金币。', 'Uses the same timer as the top card. Each completed focus session waters the garden and earns 60 coins.') : state.real ? '专注一轮结束会额外浇一轮水并给 60 金币' : 'completing a window applies a sweep burst, +60')
      + '</span></div>'
      + linkedStats
      + '<div class="rail-label">' + (state.real ? '生涯' : 'counters') + '</div>'
      + '<div class="statgrid">' + rows + '</div></div>';
  }

  // ---------- 主渲染 ----------

  // 整页重绘会把两样东西连根换掉，都得在重绘前后搬回去：
  //   1. 便签（.scratch）的内容、选区和焦点——它是主要的输入面，每秒被踢出输入框没法用。
  //   2. 滚动容器（.farm-wrap）的滚动位置——它就在被重写的 innerHTML 里，每次重绘都是新元素，
  //      不还原的话每秒把 scrollTop 冲回 0，表现为「往下滚一下又自动弹回顶部」。
  function keepScratch(fn) {
    var old = mainEl.querySelector('.scratch');
    var keep = old ? {
      v: old.value, s: old.selectionStart, e: old.selectionEnd,
      f: document.activeElement === old,
    } : null;
    var wrap = mainEl.querySelector('.farm-wrap');
    var scroll = wrap ? { top: wrap.scrollTop, left: wrap.scrollLeft } : null;

    fn();

    var nextWrap = mainEl.querySelector('.farm-wrap');
    if (nextWrap && scroll) {
      nextWrap.scrollTop = scroll.top;
      nextWrap.scrollLeft = scroll.left;
    }
    if (!keep) return;
    var next = mainEl.querySelector('.scratch');
    if (!next) return;
    next.value = keep.v;
    if (keep.f) {
      next.focus();
      try { next.setSelectionRange(keep.s, keep.e); } catch (e) {}
    }
  }

  // 按键时只改动那一格的进度条，不整页重绘：
  // 全量重绘既浪费，又会把正在打字的便签焦点弄丢。结构变化交给每秒的 tick。
  function touchCell(k) {
    if (!mainEl) return;
    var cell = mainEl.querySelector('.pk[data-plot="' + k + '"]');
    if (!cell) return;
    var p = state.plots[k];
    if (!p || !p.c) return;
    var pct = Math.min(100, p.t / CROPS[p.c].taps * 100);
    var fill = cell.querySelector('.pk-fill');
    if (fill) fill.style.width = pct.toFixed(0) + '%';
    var face = cell.querySelector('.pk-face');
    if (face && !state.real) face.textContent = Math.round(pct) + '%';
  }

  function render() {
    if (!mainEl) return;
    var now = Date.now();
    var dirty = settleDay();
    if (settleRain(now)) dirty = true;
    if (settleGrow(now)) dirty = true;
    // 开采挂机结算：分钟级节奏，跟着每秒 render 走即可，不像战斗那样另开定时器。
    if (state.mine.vein) {
      var mps = Combat.playerStats(levelInfo().lvl, Equip.equipBonus(state.equipped));
      var mo = Mining.settleMining(state.mine, mps, now);
      if (mo.ticks > 0) {
        for (var mok in mo.ores) state.ores[mok] = (state.ores[mok] || 0) + mo.ores[mok];
        state.xp += mo.xp;
        state.stats.mined += mo.ticks;
        dirty = true;
      }
      state.mine = mo.mine;
    }
    // 冶炼挂机结算：与开采互斥，同一时刻只有一个在跑（见 startSmelt / selectVein）。
    // so.ores 是负增量（冶炼消耗矿石），与 settleMining 的正增量同语义，都用加法落账。
    if (state.smelt.bar) {
      var so = Mining.settleSmelt(state.smelt, state, now);
      if (so.ticks > 0) {
        for (var sk in so.ores) state.ores[sk] = (state.ores[sk] || 0) + so.ores[sk];
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
    // 刻符挂机结算：与开采、冶炼三方互斥（见 startCraft / selectVein / startSmelt），同一时刻只有一个在跑。
    // co.ores / co.bars / co.coins 是负增量（消耗），co.runes 是正增量（产出）——与冶炼块一样全部用加法落账；
    // 金币走 earn()（负数下限 0；结算前已逐轮判够，不会触到下限；负数不计 stats.earned，现有语义）。
    if (state.craft.rune) {
      var co = Magic.settleCraft(state.craft, state, now);
      if (co.ticks > 0) {
        for (var ck in co.ores) state.ores[ck] = (state.ores[ck] || 0) + co.ores[ck];
        for (var cb in co.bars) state.bars[cb] = (state.bars[cb] || 0) + co.bars[cb];
        for (var cr in co.runes) state.runes[cr] = (state.runes[cr] || 0) + co.runes[cr];
        if (co.coins) earn(co.coins);
        state.xp += co.xp;
        dirty = true;
      }
      if (co.stopped) {
        toast(state.real ? '材料用尽，刻符已停' : 'out of stock — compile halted');
        dirty = true;
      }
      state.craft = co.craft;
    }
    var rc = Fishing.settleReclaim(
      { auto: state.autoReclaim, last: state.lastReclaim, spotId: state.spot },
      now, { cat: has('cat') });
    state.lastReclaim = rc.last;
    if (rc.caught.length) {
      for (var ri = 0; ri < rc.caught.length; ri++) gainFish(rc.caught[ri]);
      dirty = true;
    }
    // 只有「本活战斗定时器没在跑」时才离线结算——否则和 battleTick(400ms) 会重复推进同一场战斗
    // （后台标签页节流时尤甚），造成击杀/掉落重复入账。定时器在跑时由 battleTick 独占推进。
    if (state.battle && !battleTimer) {
      // 老存档的 drops 可能没有 equip 字段（migrateCombat 只补了 drops 本身，没补这个子字段）——这里兜底。
      if (state.battle.drops && !state.battle.drops.equip) state.battle.drops.equip = [];
      // 离线施法：与 battleTick 同一套 castable 判定；符文预算 = 当前库存，保留率按当前 mdef。
      // bo.casts 是施法次数（被保留率保住的也算——与 battleTick 的 stats.casts += 1 同口径），bo.runes 是实际扣掉的枚数；
      // settleOffline 内部烧完自动退回普攻。casts > 0 必然 cs.ok（cast 传了 null 时两者都是 0），所以块内可以放心用 cs.rune。
      var blvl = levelInfo().lvl, bbonus = Equip.equipBonus(state.equipped);
      var cs = Magic.castable(state, blvl);
      var bps = Combat.playerStats(blvl, bbonus);
      var bo = Combat.settleOffline(state.battle, blvl, bbonus, now, undefined,
        cs.ok ? { power: cs.power, runes: state.runes[cs.rune] || 0, preserve: Magic.preserveChance(bps) } : null);
      if (bo.casts > 0) {
        state.stats.casts += bo.casts;
        if (bo.runes > 0) state.runes[cs.rune] -= bo.runes;   // 全部被保留时 runes 为 0，库存不动但施法照计
        dirty = true;
      }
      // 耗尽只 toast 一次，与 battleTick 同一个标志：玩家在别的 tab 看时战斗走的就是这条路径（battleTimer 不在），
      // 不补这段就会在背景里悄悄退回普攻、永远不提示。结算前 castable 为真、结算后库存归零 = 这一轮耗尽；
      // 之后 cs.ok 为假不再进来，刻出新符文再耗尽时才会再提示一次。
      if (cs.ok) {
        state.battle.runesOutToasted = (state.runes[cs.rune] || 0) <= 0;
        if (state.battle.runesOutToasted) {
          toast(state.real ? '符文耗尽，已改为普攻' : 'out of glyphs — plain attacks');
          dirty = true;
        }
      }
      if (bo.kills > 0) {
        // 离线击杀同样只堆进掉落堆、不即时入账（回来退出时一起拾取）。
        state.battle.drops.xp += bo.xp; state.battle.drops.coins += bo.coins;
        for (var mk in bo.mats) state.battle.drops.mats[mk] = (state.battle.drops.mats[mk] || 0) + bo.mats[mk];
        state.battle.kills += bo.kills;
        state.mobDex[state.battle.mob] = (state.mobDex[state.battle.mob] || 0) + bo.kills;
        var md = Combat.MONSTERS[state.battle.mob];
        var offLuk = Combat.playerStats(levelInfo().lvl, Equip.equipBonus(state.equipped)).luk;
        for (var ei = 0; ei < bo.kills; ei++) {
          var eq2 = Equip.rollEquipDrop(md.role, md.tier, offLuk, Math.random);
          if (eq2) state.battle.drops.equip.push({ key: eq2, level: 0 });
        }
      }
      if (bo.dead) {
        collectDrops(state.battle); state.battle = null;   // 离线战死也算结束，收取掉落
        toast(state.real ? '主角战死，掉落已收' : 'instance evicted');
      } else {
        state.battle.hp = bo.hp;            // 未致死的掉血也要写回，别丢
        state.battle.monHp = bo.monHp;      // 怪血同步，回来血条才不是旧的
        state.battle.last = bo.last;
      }
      if (bo.kills > 0 || bo.dead) dirty = true;
    }
    if (pomoTick(now)) dirty = true;
    refreshOrders(false);
    if (dirty) save();

    var li = levelInfo();
    var tabs = TABS.map(function (t) {
      return '<a class="ftab' + (state.tab === t.id ? ' is-active' : '') + '" data-tab="' + t.id + '">'
        + esc(tabName(t)) + '</a>';
    }).join('');

    var body = state.tab === 'bag' ? bagTab()
      : state.tab === 'pond' ? pondTab()
      : state.tab === 'order' ? orderTab()
      : state.tab === 'zoo' ? zooTab()
      : state.tab === 'raid' ? (state.battle ? battleView() : raidTab())
      : state.tab === 'mine' ? mineTab()
      : state.tab === 'inv' ? invTab()
      : state.tab === 'forge' ? forgeTab()
      : state.tab === 'magic' ? magicTab()
      : state.tab === 'stats' ? statsTab()
      : farmTab();

    var note = (msg && now < msg.until)
      ? '<span class="farm-msg">' + esc(msg.text) + '</span>'
      : '<span>' + (state.real ? '按键 ' : 'events ') + state.stats.taps + '</span>'
        + '<span>' + (state.real ? '收获 ' : 'flushed ') + state.stats.harvested + '</span>'
        + '<span>' + (state.real ? '下场雨 ' : 'next sweep ')
        + fmtMs(state.lastRain + rainMs() - now) + '</span>';

    var html =
      '<div class="toolbar">'
      + '<span class="tname">' + (state.real ? 'typing_farm' : 'keyspace') + '</span>'
      + '<span class="farm-bal">&#x2B21; ' + state.coins + ' ' + coinsWord() + '</span>'
      + '<span class="farm-lvl" title="' + li.rem + ' / ' + li.need + ' xp">'
      + (state.real ? 'Lv.' : 'tier ') + li.lvl
      + '<span class="lvl-bar"><span class="lvl-fill" style="width:'
      + Math.min(100, li.rem / li.need * 100).toFixed(0) + '%"></span></span></span>'
      + '<span class="toolbar-gap"></span>'
      + '<button class="btn" data-act="skin" title="切换农场与工程显示 / Switch appearance" aria-pressed="' + (!state.real) + '">&#x1F331; ' + (state.real ? '工程伪装 / Disguise' : '显示农场 / Show farm') + '</button>'
      + '</div>'
      + '<div class="ftabs">' + tabs + '</div>'
      + '<div class="farm-wrap">' + body + '</div>'
      + '<footer class="statusline">' + note + '<span class="role">role: postgres</span></footer>';

    keepScratch(function () { mainEl.innerHTML = html; });
    renderRail();

    // 防呆：战斗定时器该跑不跑 / 该停不停都在这里兜底纠正。
    if (state.tab === 'raid' && state.battle && !battleTimer) startBattleTimer();
    if ((state.tab !== 'raid' || !state.battle) && battleTimer) stopBattleTimer();
  }

  // 右栏 Definition 区借来放当前选中的作物说明。
  function renderRail() {
    var lab = document.getElementById('rail-label');
    var def = document.getElementById('definition');
    if (!lab || !def) return;
    var c = CROPS[state.sel];
    lab.textContent = state.real ? '当前种子' : 'Selected job';
    def.innerHTML =
      '<div class="col"><span>' + esc(L(c)) + '</span><span class="typ">lvl ' + c.lvl + '</span></div>'
      + '<div class="col"><span>' + (state.real ? '需按键' : 'taps') + '</span><span class="typ">' + c.taps + '</span></div>'
      + '<div class="col"><span>' + (state.real ? '种子价' : 'cost') + '</span><span class="typ">' + c.cost + '</span></div>'
      + '<div class="col"><span>' + (state.real ? '售价' : 'value') + '</span><span class="typ">' + sellPrice(state.sel) + '</span></div>'
      + '<div class="col"><span>' + (state.real ? '每次按键' : 'per tap') + '</span><span class="typ">'
      + (sellPrice(state.sel) / c.taps).toFixed(2) + '</span></div>'
      + '<div class="col"><span>' + (state.real ? '已收获' : 'flushed') + '</span><span class="typ">'
      + (state.dex[state.sel] || 0) + '</span></div>';
  }

  // 种子商店。不参与每秒 tick——秒级重绘会把 hover 每秒抹一次，手感很差。
  function renderShop() {
    if (!sideEl) return;
    var lvl = levelInfo().lvl;
    var items = CROP_KEYS.map(function (k) {
      var c = CROPS[k];
      if (lvl < c.lvl) {
        return '<a class="shop-item shop-locked"><span class="shop-name">' + esc(state.real ? '???' : c.job)
          + '</span><span class="shop-meta">' + (state.real ? '等级 ' : 'level ') + c.lvl + '</span></a>';
      }
      return '<a class="shop-item' + (state.sel === k ? ' is-active' : '') + '" data-crop="' + k + '">'
        + '<span class="shop-name">' + esc(L(c)) + '</span>'
        + '<span class="shop-meta">' + c.taps + (state.real ? ' 击' : ' taps') + ' &middot; -' + c.cost
        + ' &middot; +' + sellPrice(k) + ' &middot; ' + (sellPrice(k) / c.taps).toFixed(2) + '/tap</span></a>';
    }).join('');
    sideEl.innerHTML = '<div class="side-head">' + (state.real ? '种子商店' : 'Job types') + '</div>'
      + '<div class="side-schema">' + (state.real ? '选中后点地块种下' : 'select, then assign to a shard')
      + ' <span>' + CROP_KEYS.length + '</span></div>'
      + '<div class="side-list">' + items + '</div>';
  }

  function redraw() { save(); render(); renderShop(); }

  // ---------- 交互 ----------

  function plant(k) {
    var p = state.plots[k];
    if (!p || !unlocked(k)) return;
    // 点已经种着同一种作物的地：什么都不做。
    // 直接铲掉的话，误点一下就把一株快熟的摇钱树清零了，代价太大。
    // 想换种就先在左边选另一种（那是明确的意图），想空出来用「铲除空闲」。
    if (p.c === state.sel) return;
    var c = CROPS[state.sel];
    if (levelInfo().lvl < c.lvl || state.coins < c.cost) return;
    earn(-c.cost);
    p.c = state.sel;
    p.t = 0;
  }

  // 进入副本：满血重建战斗态（血不回、但退出/进场都是满血——见 Task 10 的 flee）。
  function enterBattle(key) {
    var ps = Combat.playerStats(levelInfo().lvl, Equip.equipBonus(state.equipped));
    state.battle = { mob: key, hp: ps.hp, monHp: Combat.monsterStats(key).hp,
      kills: 0, log: [], last: Date.now(), drops: { xp: 0, coins: 0, mats: {}, equip: [] } };
    save(); redraw();
    startBattleTimer();
  }

  // 结束战斗时把掉落堆一次性入账：经验进等级、金币进钱包、材料进背包。
  // 战斗中的击杀只往 b.drops 堆里累加、不入账（掉落物置于下方，退出/结束时一起拾取）。
  function collectDrops(b) {
    if (!b || !b.drops) return;
    var d = b.drops;
    if (d.xp) state.xp += d.xp;
    if (d.coins) earn(d.coins);
    for (var k in d.mats) state.mats[k] = (state.mats[k] || 0) + d.mats[k];
    if (d.equip) for (var ei = 0; ei < d.equip.length; ei++) state.owned.push(d.equip[ei]);
  }

  // 穿戴：从 owned 挪进对应槽；原槽里换下的（若有）回到 owned，不丢件。
  function equipItem(ownedIdx) {
    var o = state.owned[ownedIdx]; if (!o) return;
    var slot = Equip.EQUIP[o.key].slot;
    var cur = state.equipped[slot];
    state.equipped[slot] = o;
    state.owned.splice(ownedIdx, 1);
    if (cur) state.owned.push(cur);   // 换下的回到背包
    redraw();
  }
  function unequipSlot(slot) {
    var cur = state.equipped[slot]; if (!cur) return;
    state.equipped[slot] = null;
    state.owned.push(cur);
    redraw();
  }

  function selectVein(key) {
    if (!Mining.veinUnlocked(key, levelInfo().lvl)) return;
    if (state.mine.vein === key) return;
    // 耐久与再生 CD 按矿脉各自记账（存在 mine.pool 里），切走再切回不会重置——
    // 否则玩家点一下别的脉再点回来就能抹掉再生 CD，收益能翻倍。
    state.mine = Mining.switchVein(state.mine, key, Date.now());
    state.smelt = { bar: null, last: Date.now() };   // 与冶炼互斥，选矿脉就把熔炉停下
    state.craft = { rune: null, src: state.craft.src, last: Date.now() };   // 与刻符互斥，选矿脉就把刻符停下
    redraw();
  }

  // 冶炼：与开采互斥的挂机活动（Melvor 惯例：Smithing 和 Mining 一样同时只能训练一个）。
  // 开炼/停炼只切换 state.smelt.bar，真正的产出与耗料结算在 render() 里按 tick 推进。
  function startSmelt(barKey) {
    // check 必须在两处 mutation 之前：材料不够时直接 return，不能碰 state.smelt / state.mine——
    // 否则一次失败的开炼会把正在挖的矿脉停掉，等于「点一下失败的按钮也打断挂机」。
    var c = Mining.smeltCheck(barKey, state);
    if (!c || !c.ok) return;
    // 与开采互斥：同一时刻只做一件事（Melvor 惯例）。开炼就把矿脉停下——
    // 走 stopVein 而不是裸置 vein=null，否则被打断矿脉的 hp/until 不会存进 pool，
    // 下次切回来会被当成没挖过，白刷满耐久、跳过再生 CD（见 mining.js stopVein 的注释）。
    state.smelt = { bar: barKey, last: Date.now() };
    state.mine = Mining.stopVein(state.mine, Date.now());
    state.craft = { rune: null, src: state.craft.src, last: Date.now() };   // 与刻符互斥，开炼就把刻符停下
    var b = Mining.BARS[barKey];
    toast(state.real ? '开始冶炼' + b.name : 'smelting ' + b.job);
    redraw();
  }

  function stopSmelt() {
    state.smelt = { bar: null, last: Date.now() };
    redraw();
  }

  // 刻符：第三个非战斗挂机活动，与开采 / 冶炼三方互斥（Melvor：同时只训练一个非战斗技能）。
  // 开刻/停刻只切换 state.craft，真正的产出与耗料结算在 render() 里按 tick 推进。
  // check 必须先于任何 mutation：料不够直接 return，不能碰 state.craft / state.smelt / state.mine——
  // 否则一次失败的点击会把正在跑的矿脉或熔炉停掉（同 startSmelt 的约束，mining.test.js 有源码断言守着）。
  function startCraft(runeKey, src) {
    var c = Magic.craftCheck(runeKey, src, state, levelInfo().lvl);
    if (!c || !c.ok) return;
    var now = Date.now();
    state.craft = { rune: runeKey, src: src, last: now };
    state.smelt = { bar: null, last: now };
    // 停矿脉必须走 stopVein 而非裸置 vein=null：被打断矿脉的 hp/until 要存进 pool（见 mining.js stopVein 的注释）。
    state.mine = Mining.stopVein(state.mine, now);
    var rn = Magic.RUNES[runeKey];
    toast(state.real ? '开始刻' + rn.name : 'compiling ' + rn.job);
    redraw();
  }

  // 停刻：只清 rune，src 保留（下次再点默认还是这条路线）。整体替换而不裸改 rune 字段——magic.test.js 有源码断言。
  function stopCraft() {
    state.craft = { rune: null, src: state.craft.src, last: Date.now() };
    redraw();
  }

  // 选法术：全局单选（state.spell），点当前施放的那条 = 停用（回普攻）。等级/法书不满足的点了不生效。
  // 符文够不够不在这里判——castable 每回合现算，选了没符文的法术就先普攻，符文到账自动接上。
  function selectSpell(key) {
    if (state.spell === key) { state.spell = null; redraw(); return; }
    if (!Magic.spellUnlocked(key, levelInfo().lvl) || !Magic.spellOwned(key, state.books)) return;
    state.spell = key;
    redraw();
  }

  // 买法书：等级 + 金币双门槛，已购/不够直接 return。法书不可售、不重复购买（一次性 sink）。
  function buyBook(key) {
    var bc = Magic.bookCheck(key, state, levelInfo().lvl);
    if (!bc || !bc.ok) return;
    earn(-bc.price);
    state.books[key] = true;
    var sp = Magic.SPELLS[key];
    toast(state.real ? '购得法书：' + sp.name : 'granted ' + sp.job);
    redraw();
  }

  // 锻造：材料+锭+金币 → 装备。同上，check 不过直接 return。
  function forgeItem(key) {
    var c = Equip.recipeCheck(key, state, levelInfo().lvl);
    if (!c || !c.ok) return;
    for (var m in c.recipe.mats) state.mats[m] -= c.recipe.mats[m];
    for (var b in c.recipe.bars) state.bars[b] -= c.recipe.bars[b];
    earn(-c.recipe.coins);
    state.owned.push({ key: key, level: 0 });
    toast(state.real ? '锻成' + Equip.EQUIP[key].name : 'forged ' + Equip.EQUIP[key].job);
    redraw();
  }

  function onMainClick(e) {
    var t = e.target.closest ? e.target.closest('[data-tab]') : null;
    if (t) { state.tab = t.getAttribute('data-tab'); redraw(); return; }

    var pk = e.target.closest ? e.target.closest('[data-plot]') : null;
    if (pk) { plant(pk.getAttribute('data-plot')); redraw(); return; }

    var fb = e.target.closest ? e.target.closest('[data-fight]') : null;
    if (fb) { enterBattle(fb.getAttribute('data-fight')); return; }

    var eqi = e.target.closest ? e.target.closest('[data-eq]') : null;
    if (eqi) { equipItem(parseInt(eqi.getAttribute('data-eq'), 10)); return; }
    var uneq = e.target.closest ? e.target.closest('[data-uneq]') : null;
    if (uneq) { unequipSlot(uneq.getAttribute('data-uneq')); return; }

    var vn = e.target.closest ? e.target.closest('[data-vein]') : null;
    if (vn) { selectVein(vn.getAttribute('data-vein')); return; }

    var sm = e.target.closest ? e.target.closest('[data-smelt]') : null;
    if (sm) { startSmelt(sm.getAttribute('data-smelt')); return; }
    var sst = e.target.closest ? e.target.closest('[data-smeltstop]') : null;
    if (sst) { stopSmelt(); return; }
    var fg = e.target.closest ? e.target.closest('[data-forge]') : null;
    if (fg) { forgeItem(fg.getAttribute('data-forge')); return; }

    var spl = e.target.closest ? e.target.closest('[data-spell]') : null;
    if (spl) { selectSpell(spl.getAttribute('data-spell')); return; }
    var bk = e.target.closest ? e.target.closest('[data-book]') : null;
    if (bk) { buyBook(bk.getAttribute('data-book')); return; }
    var cf = e.target.closest ? e.target.closest('[data-craft]') : null;
    if (cf) { startCraft(cf.getAttribute('data-craft'), cf.getAttribute('data-src')); return; }
    var cst = e.target.closest ? e.target.closest('[data-craftstop]') : null;
    if (cst) { stopCraft(); return; }

    var sp = e.target.closest ? e.target.closest('[data-spot]') : null;
    if (sp) { state.spot = sp.getAttribute('data-spot'); redraw(); return; }
    var spb = e.target.closest ? e.target.closest('[data-spotbuy]') : null;
    if (spb) {
      var buyId = spb.getAttribute('data-spotbuy');
      if (state.coins >= SPOTS[buyId].unlock) { earn(-SPOTS[buyId].unlock); state.spotsOwned[buyId] = true; state.spot = buyId; }
      redraw(); return;
    }

    var b = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b) return;
    var act = b.getAttribute('data-act');
    var c = b.getAttribute('data-c');
    var a = b.getAttribute('data-a');

    if (act === 'skin') state.real = !state.real;
    else if (act === 'replant') state.autoReplant = !state.autoReplant;
    else if (act === 'fill') {
      var crop = CROPS[state.sel];
      if (levelInfo().lvl >= crop.lvl) {
        for (var i = 0; i < ALL_KEYS.length; i++) {
          var k = ALL_KEYS[i], p = state.plots[k];
          if (!unlocked(k) || p.c) continue;
          if (state.coins < crop.cost) break;   // 钱花光就停，不要把余额算成负数
          earn(-crop.cost);
          p.c = state.sel; p.t = 0;
        }
      }
    } else if (act === 'clear') {
      ALL_KEYS.forEach(function (k) {
        var p = state.plots[k];
        if (p.c && p.t === 0) p.c = null;
      });
    } else if (act === 'sell') {
      var n = state.bag[c] || 0;
      if (n > 0) { earn(n * sellPrice(c)); state.bag[c] = 0; }
    } else if (act === 'sellfish') {
      var fn = state.fish[c] || 0;
      if (fn > 0) { earn(fn * FISH[c].price); state.fish[c] = 0; }
    } else if (act === 'sellore') {
      var orn = state.ores[c] || 0;
      if (orn > 0) { earn(orn * Mining.ORES[c].price); state.ores[c] = 0; }
    } else if (act === 'sellbar') {
      var brn = state.bars[c] || 0;
      if (brn > 0) { earn(brn * Mining.BARS[c].price); state.bars[c] = 0; }
    } else if (act === 'lock') state.lock[c] = !state.lock[c];
    else if (act === 'lockfish') state.lock['f:' + c] = !state.lock['f:' + c];
    else if (act === 'lockore') state.lock['o:' + c] = !state.lock['o:' + c];
    else if (act === 'lockbar') state.lock['b:' + c] = !state.lock['b:' + c];
    else if (act === 'sellall') {
      var got = 0;
      CROP_KEYS.forEach(function (k) {
        if (state.lock[k]) return;
        var q = state.bag[k] || 0;
        if (q) { got += q * sellPrice(k); state.bag[k] = 0; }
      });
      FISH_KEYS.forEach(function (k) {
        if (state.lock['f:' + k]) return;
        var q = state.fish[k] || 0;
        if (q) { got += q * FISH[k].price; state.fish[k] = 0; }
      });
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
      if (got) { earn(got); toast((state.real ? '卖出，+' : 'flushed +') + got); }
    } else if (act === 'deliver') deliver(b.getAttribute('data-id'));
    else if (act === 'reroll') {
      if (state.coins >= 50) { earn(-50); refreshOrders(true); }
    } else if (act === 'pond') {
      if (state.coins >= POND_COST) {
        earn(-POND_COST); state.pond = true; state.spotsOwned.wal_buffer = true; checkMail();
      }
    } else if (act === 'reclaimer') {
      if (!state.autoReclaim && state.coins >= RECLAIM_COST) {
        earn(-RECLAIM_COST); state.autoReclaim = true; state.lastReclaim = Date.now();
      }
    } else if (act === 'coop') {
      if (state.coins >= COOP_COST) { earn(-COOP_COST); state.coop = true; checkMail(); }
    } else if (act === 'reply') {
      var idx = state.mail.indexOf(a);
      if (idx >= 0) {
        state.mail.splice(idx, 1);
        state.animals[a] = { aff: 0, fed: 0, day: today() };
        toast((state.real ? '' : 'subscriber active: ') + L(ANIMALS[a]) + (state.real ? ' 住进来了' : ''));
      }
    } else if (act === 'feed') {
      var rec = state.animals[a];
      var like = ANIMALS[a].like;
      if (rec && rec.fed < FEED_PER_DAY && (state.bag[like] || 0) > 0) {
        state.bag[like]--;
        rec.fed++;
        rec.aff = (rec.aff || 0) + 3;
        state.xp += 2;
      }
    } else if (act === 'focuskeys' && state.focusLink) {
      state.focusLink.allKeys = !state.focusLink.allKeys;
    } else if (act === 'pomo' && window.Tracer && window.Tracer.focus) {
      window.Tracer.focus.open(); return;
    } else if (act === 'pomo') {
      state.pomo = { mode: 'focus', until: Date.now() + POMO_FOCUS, done: state.pomo.done };
    } else if (act === 'pomostop') {
      state.pomo = { mode: 'idle', until: 0, done: state.pomo.done };
    } else if (act === 'flee') { endBattle(state.real ? '已撤离，战利品已收' : 'exited', false); return; }
    else return;

    redraw();
  }

  function onSideClick(e) {
    var t = e.target.closest ? e.target.closest('[data-crop]') : null;
    if (!t) return;
    state.sel = t.getAttribute('data-crop');
    redraw();
  }

  // ---------- 全局输入（常驻，不依赖界面挂载） ----------

  function keyOf(ev) {
    var k = ev.key;
    if (k === ' ' || k === 'Spacebar') return 'SPC';
    if (typeof k === 'string' && k.length === 1) {
      var lower = k.toLowerCase();
      if (KEY_LVL[lower]) return lower;
    }
    return null;
  }

  // 本页面（父文档）里的按键。阅读面板的边框控件（地址框、导航按钮）也在这层，
  // 一并算进农场——它们是本页 DOM，按了哪个键这边知道，照常落到对应地块。
  // 面板 iframe 里小说站的按键走的是另一条路：事件不冒泡到这里，由守卫脚本回报，
  // 只知道「按了一次」不知道按了什么，因此走 external 的匀灌逻辑而非落具体地块。
  function onKeyDown(ev) {
    // 伪装快捷键：Ctrl+Alt+G 一键切换游戏/黑话文案（等同点右上角 🌱）。
    // 用组合键而非单键：单键都在种地，且工位上误触单键就暴露了；用 ev.code 判物理键，
    // 不受键盘布局/AltGr 影响。命中就切换并吃掉事件，不让它再被当成一次种地按键。
    if (ev.ctrlKey && ev.altKey && ev.code === 'KeyG') {
      ev.preventDefault();
      state.real = !state.real;
      redraw();
      return;
    }
    var k = keyOf(ev);
    if (!k) return;
    press(k);
    if (state.tab === 'farm') touchCell(k);
  }

  function onDocClick() {
    click();
    // 左键也是一块地。计数走 keys，热力图上那一格才不会永远是 0。
    state.keys.LMB = (state.keys.LMB || 0) + 1;
    state.stats.taps++;
    grow('LMB', 1);
    if (state.tab === 'farm') touchCell('LMB');
  }

  // 阅读面板 iframe 里小说站的输入。守卫脚本只报「按了一次键 / 点了一次」的事实，
  // 不带按键内容，所以这里拿不到也不需要具体是哪个键。
  //   点击：和本页点击同等对待——推进钓鱼、长左键地块。
  //   按键：不知道键位，落不到具体地块，于是像下雨一样浇给进度最低的那块地。
  function growColdest(n) {
    var best = null, bestR = 2;
    for (var i = 0; i < ALL_KEYS.length; i++) {
      var k = ALL_KEYS[i], p = state.plots[k];
      if (!p || !p.c || !unlocked(k)) continue;
      var r = p.t / CROPS[p.c].taps;
      if (r < bestR) { bestR = r; best = k; }
    }
    if (best) grow(best, n);
    return best;
  }

  function external(kind) {
    state.stats.ext++;
    if (kind === 'click') {
      onDocClick();
      return;
    }
    state.stats.taps++;
    var k = growColdest(1);
    if (k && mainEl && state.tab === 'farm') touchCell(k);
    saveSoon();
  }

  function boot() {
    if (booted) return;
    booted = true;
    load();
    refreshOrders(false);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('click', onDocClick, true);
    // 阅读面板 iframe 里的输入：事件进不到本文档，靠守卫脚本 postMessage 过来。
    // reader.js 也监听 message，但不认 'farm' 这个类型，两边互不干扰。
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || d.__aside !== 1 || d.type !== 'farm') return;
      external(d.kind === 'click' ? 'click' : 'key');
    });
    // 关页面/切走时立刻落盘，别把最后两秒的进度丢掉
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
  }

  // ---------- 装卸 ----------

  function mount(main, side) {
    if (timer || mainEl) unmount();
    boot();
    mainEl = main;
    sideEl = side;
    render();
    renderShop();
    mainEl.addEventListener('click', onMainClick);
    sideEl.addEventListener('click', onSideClick);
    timer = setInterval(render, 1000);
    if (state.battle && state.tab === 'raid') startBattleTimer();
  }

  function unmount() {
    clearInterval(timer);
    timer = null;
    stopBattleTimer();
    if (mainEl) mainEl.removeEventListener('click', onMainClick);
    if (sideEl) sideEl.removeEventListener('click', onSideClick);
    mainEl = null;
    sideEl = null;
    save();
  }

  boot();
  window.DBFarm = { mount: mount, unmount: unmount, syncFocus: syncFocus };
})();
