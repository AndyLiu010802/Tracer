'use strict';

// lib/store.js 的纯单测，不起 HTTP：直接验证写队列、原子替换、
// 备份校验这些机制本身，出问题时不用先怀疑是不是路由层的锅。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const store = require('../lib/store.js');

let dir;

test.beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-lib-test-'));
});

test.afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

test('未写过返回 null', async () => {
  assert.strictEqual(await store.readStore(dir, 'foo'), null);
});

test('曾写过但主文件与 .bak 全不可读时 reject，err.code 为 store-corrupt', async () => {
  // 先正常写一次再写坏，制造「写过但读不出来」的场景（此时没有 .bak）。
  await store.writeStore(dir, 'bad', '{"v":1}');
  fs.writeFileSync(path.join(dir, 'bad.json'), '{BROKEN', 'utf8');
  await assert.rejects(
    () => store.readStore(dir, 'bad'),
    (err) => err.code === 'store-corrupt',
    '坏档不该被当成「从没写过」而 resolve 成 null',
  );
});

test('写后读回同一份数据', async () => {
  await store.writeStore(dir, 'foo', '{"a":1}');
  assert.deepStrictEqual(await store.readStore(dir, 'foo'), { a: 1 });
});

test('并发写入同一个 name 会排队，不互相截断', async () => {
  // 一大一小两份 payload 反复并发写同一个 name：只要写队列生效，
  // 每一轮落盘的都应该是完整的某一份，不会是拼接出来的垃圾。
  const big = '{"who":"BIG","pad":"' + 'A'.repeat(200 * 1024) + '"}';
  const small = '{"who":"small"}';
  const file = path.join(dir, 'race.json');
  for (let i = 0; i < 20; i++) {
    await Promise.all([
      store.writeStore(dir, 'race', big),
      store.writeStore(dir, 'race', small),
    ]);
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content === big || content === small,
      '第 ' + i + ' 轮：主文件应完整等于其中一份，不应被截断拼接，实际长度 ' + content.length);
  }
});

test('写入前验证上一版，损坏的上一版不会覆盖 .bak', async () => {
  const bakFile = path.join(dir, 'guard.json.bak');
  await store.writeStore(dir, 'guard', '{"v":1}');
  assert.ok(!fs.existsSync(bakFile), '首次写没有上一版，不应产生 .bak');

  // 手动写坏主文件，模拟上一次写入没走完就崩溃
  fs.writeFileSync(path.join(dir, 'guard.json'), '{BROKEN', 'utf8');
  await store.writeStore(dir, 'guard', '{"v":2}');
  assert.ok(!fs.existsSync(bakFile), '上一版已损坏，这次写入不应该把垃圾抄进 .bak');

  // 这次上一版（v2）合法，备份应该生效
  await store.writeStore(dir, 'guard', '{"v":3}');
  assert.strictEqual(fs.readFileSync(bakFile, 'utf8'), '{"v":2}', '上一版合法时备份应正常生效');
});

test('落盘失败会 reject，对应路由层的 500 分支', async () => {
  // dataDir 本身被一个普通文件占了位置，writeStore 里的 mkdir(dataDir, {recursive:true})
  // 无法把一个已存在的文件变成目录，必然失败——用它模拟磁盘写失败之类的场景，
  // 确认 writeStore 会把错误 reject 出来，而不是吞掉或者误判成别的状态码。
  const fileAsDir = path.join(dir, 'not-a-dir');
  fs.writeFileSync(fileAsDir, 'i am a file, not a directory', 'utf8');
  await assert.rejects(() => store.writeStore(fileAsDir, 'x', '{"a":1}'));
});
