'use strict';
const test = require('node:test');
const assert = require('node:assert');
const F = require('../skins/db-console/fishing.js');

test('48 种鱼，6 钓点各 8 种', () => {
  assert.strictEqual(F.FISH_KEYS.length, 48);
  F.SPOT_KEYS.forEach((sp) => {
    const n = F.FISH_KEYS.filter((k) => F.FISH[k].spot === sp).length;
    assert.strictEqual(n, 8, sp + ' 应有 8 种鱼，实为 ' + n);
  });
});

test('每条鱼字段合法', () => {
  F.FISH_KEYS.forEach((k) => {
    const f = F.FISH[k];
    assert.ok(f.name && f.job && f.emoji, k + ' 缺名字/黑话/emoji');
    assert.ok(F.SPOTS[f.spot], k + ' 的 spot 非法');
    assert.ok(F.RARITY[f.rarity], k + ' 的 rarity 非法');
    assert.ok(F.MATERIALS[f.mat], k + ' 的 mat 非法');
    assert.ok(f.price > 0, k + ' 售价应为正');
  });
});

test('旧 8 鱼的 key/job/price 原样保留（存档兼容）', () => {
  const legacy = {
    eel: ['wal_seg', 30], carp: ['temp_file', 45], koi: ['orphan_seg', 90],
    squid: ['toast_chunk', 180], puffer: ['bloat_page', 340],
    dolphin: ['lost_xlog', 900], orca: ['cold_backup', 2600], whale: ['full_dump', 9000],
  };
  Object.keys(legacy).forEach((k) => {
    assert.ok(F.FISH[k], '旧鱼 ' + k + ' 不能丢');
    assert.strictEqual(F.FISH[k].job, legacy[k][0], k + ' job 变了');
    assert.strictEqual(F.FISH[k].price, legacy[k][1], k + ' price 变了');
  });
});

test('rollFish 只从该钓点鱼池出，且按稀有度权重', () => {
  // rng 恒返回 0 → 命中权重区间的第一条（池内 FISH_KEYS 顺序里第一条）
  const first = F.rollFish('wal_buffer', () => 0);
  assert.strictEqual(F.FISH[first].spot, 'wal_buffer');
  assert.strictEqual(first, F.poolOf('wal_buffer')[0], 'rng=0 应命中池内第一条');
  // 大样本：只会出该钓点的鱼
  let rng = mulberry32(42);
  for (let i = 0; i < 500; i++) {
    assert.strictEqual(F.FISH[F.rollFish('toast_lake', rng)].spot, 'toast_lake');
  }
  // 常见远多于传说
  rng = mulberry32(7);
  const cnt = {};
  for (let i = 0; i < 4000; i++) {
    const r = F.FISH[F.rollFish('pitr_abyss', rng)].rarity;
    cnt[r] = (cnt[r] || 0) + 1;
  }
  assert.ok((cnt.rare || 0) > (cnt.legendary || 0), '稀有应多于传说');
});

test('advanceCatch 累积到 clickCost 出一条并归零', () => {
  const spot = F.SPOTS.wal_buffer; // clickCost 60
  let prog = 0, caught = null, calls = 0;
  for (let i = 0; i < 60; i++) {
    const r = F.advanceCatch(prog, spot, { rng: () => 0 });
    prog = r.progress;
    if (r.caught) { caught = r.caught; calls++; }
  }
  assert.strictEqual(calls, 1, '60 次点击恰好出 1 条');
  assert.strictEqual(prog, 0, '出鱼后进度归零');
  assert.strictEqual(F.FISH[caught].spot, 'wal_buffer');
});

test('advanceCatch 未到点不出鱼', () => {
  const r = F.advanceCatch(10, F.SPOTS.wal_buffer, { rng: () => 0 });
  assert.strictEqual(r.caught, null);
  assert.strictEqual(r.progress, 11);
});

test('advanceCatch 猫加成：更少点击就出鱼', () => {
  const spot = F.SPOTS.wal_buffer; // 60 → 猫 /1.5 = 40
  const r = F.advanceCatch(39, spot, { cat: true, rng: () => 0 });
  assert.ok(r.caught, '猫在第 40 次点击出鱼');
});

test('settleReclaim 按墙钟补出条数，受上限约束，猫加速', () => {
  const spot = F.SPOTS.wal_buffer; // reclaimMs 90000
  // 未购置自动回收器 → 不产
  let r = F.settleReclaim({ auto: false, last: 0, spotId: 'wal_buffer' }, 1e9, {});
  assert.strictEqual(r.caught.length, 0);
  // 购置后，elapsed = 3 个间隔 → 3 条，last 前移 3 个间隔
  r = F.settleReclaim({ auto: true, last: 0, spotId: 'wal_buffer' }, spot.reclaimMs * 3 + 10, { rng: () => 0 });
  assert.strictEqual(r.caught.length, 3);
  assert.strictEqual(r.last, spot.reclaimMs * 3);
  // 上限
  r = F.settleReclaim({ auto: true, last: 0, spotId: 'wal_buffer' }, spot.reclaimMs * 100000, { rng: () => 0 });
  assert.strictEqual(r.caught.length, F.RECLAIM_CAP);
  // 猫 +50% 速度 → 间隔 /1.5，同样时长补更多
  const base = F.settleReclaim({ auto: true, last: 0, spotId: 'wal_buffer' }, spot.reclaimMs * 4, { rng: () => 0 }).caught.length;
  const withCat = F.settleReclaim({ auto: true, last: 0, spotId: 'wal_buffer' }, spot.reclaimMs * 4, { rng: () => 0, cat: true }).caught.length;
  assert.ok(withCat > base, '猫应补更多');
});

test('migrateFishing 补默认字段、不丢旧鱼数据', () => {
  // 旧存档：有 pond 与旧鱼计数，但无新字段
  const s = { pond: true, fish: { eel: 5, whale: 1 }, clicks: 300 };
  F.migrateFishing(s, 12345);
  assert.strictEqual(s.spot, 'wal_buffer');
  assert.deepStrictEqual(s.spotsOwned, { wal_buffer: true }); // 建过鱼塘 → 首钓点已解锁
  assert.strictEqual(s.autoReclaim, false);
  assert.strictEqual(s.lastReclaim, 12345);
  assert.strictEqual(s.fishProgress, 0);
  assert.strictEqual(s.fish.eel, 5, '旧鱼计数不能丢');
  assert.strictEqual(s.fish.whale, 1);

  // 没建过鱼塘 → 不预解锁钓点
  const s2 = { pond: false, fish: {} };
  F.migrateFishing(s2, 1);
  assert.deepStrictEqual(s2.spotsOwned, {});
});

// 确定性 PRNG，供测试用
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('settleReclaim 未知钓点回退 wal_buffer，不产 undefined', () => {
  const r = F.settleReclaim({ auto: true, last: 0, spotId: 'nope' }, F.SPOTS.wal_buffer.reclaimMs * 3, { rng: () => 0 });
  assert.strictEqual(r.caught.length, 3);
  r.caught.forEach((k) => {
    assert.ok(F.FISH[k], 'caught 应是合法鱼 key，不能是 undefined');
    assert.strictEqual(F.FISH[k].spot, 'wal_buffer');
  });
});
