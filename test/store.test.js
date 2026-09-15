'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// 存储必须落进临时目录，不能污染仓库的 data/。
// 环境变量要在 require server 之前设好——config 和常量在 require 时就固定了。
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'store-test-'));
process.env.DOCS_PORTAL_DATA_DIR = TMP;
process.env.DOCS_PORTAL_SKIN = 'docs-portal';

const { server } = require('../server.js');

let origin;

test.before(() => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    origin = 'http://127.0.0.1:' + server.address().port;
    resolve();
  });
}));

test.after(() => new Promise((resolve) => server.close(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  resolve();
})));

function req(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(origin + pathname, { method }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    r.on('error', reject);
    r.end(body);
  });
}

test('PUT 后 GET 取回同一份数据', async () => {
  const put = await req('PUT', '/api/store/ws-a', '{"tasks":[{"id":"t1"}]}');
  assert.strictEqual(put.status, 200);
  const get = await req('GET', '/api/store/ws-a');
  assert.strictEqual(get.status, 200);
  assert.deepStrictEqual(JSON.parse(get.body), { tasks: [{ id: 't1' }] });
});

test('未写过的名字返回 null', async () => {
  const r = await req('GET', '/api/store/never-written');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body, 'null');
});

test('非法名字一律 404', async () => {
  // 大写、空格、下划线、点都不在白名单里；
  // 穿越型的 ../ 会被 URL 规范化吃掉，落到别的路由自然 404。
  for (const bad of ['/api/store/UPPER', '/api/store/a%20b',
    '/api/store/a_b', '/api/store/x.y', '/api/store/']) {
    const r = await req('PUT', bad, '{}');
    assert.strictEqual(r.status, 404, bad + ' 应 404');
  }
});

test('编码的斜杠混不进名字', async () => {
  // %2F 解码后名字带 /，正则拒绝
  const nested = await req('PUT', '/api/store/x%2Fy', '{}');
  assert.strictEqual(nested.status, 404, '名字里的 / 必须拒绝');
  // 穿越型在入口就被 pathname 规范化吃掉，整段掉出 /api/store/ 前缀
  const escaped = await req('PUT', '/api/store/..%2F..%2Fescaped', '{}');
  assert.strictEqual(escaped.status, 404, '穿越型名字不得命中 store 路由');
  // x/../y 规范化成 y：是个合法名字，写得进去，但只能落在 DATA_DIR 里
  const norm = await req('PUT', '/api/store/x%2F..%2Fy', '{"v":1}');
  assert.strictEqual(norm.status, 200);
  assert.ok(fs.existsSync(path.join(TMP, 'y.json')), '应落在 DATA_DIR 内');
  assert.ok(!fs.existsSync(path.join(TMP, 'x')), '不得建出嵌套目录');
});

test('非 JSON body 拒收', async () => {
  const r = await req('PUT', '/api/store/ws-bad', 'not json at all');
  assert.strictEqual(r.status, 400);
  const g = await req('GET', '/api/store/ws-bad');
  assert.strictEqual(g.body, 'null', '坏数据不应落盘');
});

test('主文件损坏时回退上一版 .bak', async () => {
  await req('PUT', '/api/store/ws-crash', '{"v":1}');
  await req('PUT', '/api/store/ws-crash', '{"v":2}');
  // 第二次写之前，v1 被留成了 .bak。现在把主文件写坏：
  fs.writeFileSync(path.join(TMP, 'ws-crash.json'), '{"v":2,,,BROKEN', 'utf8');
  const r = await req('GET', '/api/store/ws-crash');
  assert.deepStrictEqual(JSON.parse(r.body), { v: 1 }, '应回退到上一版');
});

test('POST 与 PUT 等效（sendBeacon 只会发 POST）', async () => {
  await req('POST', '/api/store/ws-post', '{"ok":true}');
  const r = await req('GET', '/api/store/ws-post');
  assert.deepStrictEqual(JSON.parse(r.body), { ok: true });
});

test('同名并发 PUT 不写坏主文件', async () => {
  // 模拟真实客户端的时序：500ms 防抖 PUT 与 beforeunload sendBeacon 可能撞在一起，
  // 一大一小两份 payload 同时到达。旧实现共用一个 .tmp 文件名，
  // 两个写请求会交错写入同一个 fd，产出「大小payload 拼接 + NUL 填充」的垃圾。
  const big = JSON.stringify({ who: 'BIG', pad: 'A'.repeat(200 * 1024) });
  const small = JSON.stringify({ who: 'small' });
  for (let i = 0; i < 20; i++) {
    const [putBig, putSmall] = await Promise.all([
      req('PUT', '/api/store/ws-race', big),
      req('PUT', '/api/store/ws-race', small),
    ]);
    assert.ok([200].includes(putBig.status) && [200].includes(putSmall.status),
      '第 ' + i + ' 轮：两个并发 PUT 都应成功');
    const get = await req('GET', '/api/store/ws-race');
    assert.strictEqual(get.status, 200);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(get.body); },
      '第 ' + i + ' 轮：主文件不应被并发写坏，实际内容：' + get.body.slice(0, 80));
    assert.ok(get.body === big || get.body === small,
      '第 ' + i + ' 轮：应完整等于其中一份 payload，不能是二者拼接');
  }
});

test('超限 body 返回 413 而不是连接被重置', async () => {
  // 存储上限是 4MB；旧实现超限时 req.destroy()，连响应都送不出去，
  // 客户端只会看到连接被重置而不是一个正常的 4xx。
  const huge = JSON.stringify({ pad: 'A'.repeat(5 * 1024 * 1024) });
  const r = await req('PUT', '/api/store/ws-huge', huge);
  assert.strictEqual(r.status, 413);
  // 顺带确认连接还活着，能接着发下一个请求（真被 destroy 的话这里会连不上）。
  const g = await req('GET', '/api/store/ws-huge');
  assert.strictEqual(g.status, 200);
});

test('损坏的主文件不会在下次保存时覆盖好的 .bak', async () => {
  // 时序（这条要点是"备份前必须验证上一版"，而不是无条件 copyFile）：
  //   1. 写 v1、写 v2：v2 落盘前，上一版 v1 合法，正常备份 -> .bak = v1。
  //   2. 手动写坏主文件——模拟 v2 写完之后磁盘/进程出了问题，主文件变成垃圾。
  //      这时 .bak 仍然 = v1（好的）。
  //   3. 写 v3：备份步骤读到的"上一版"是垃圾，解析失败 -> 跳过备份，
  //      .bak 保持 v1 不变（旧实现会在这里无条件把垃圾抄进 .bak，
  //      直接销毁掉唯一能用的备份）。写完之后主文件 = v3。
  //   4. 再次手动写坏主文件，模拟 v3 也崩溃了。
  //   5. GET：主文件解析失败，回退 .bak。
  //      新实现应该拿到 v1（备份从未被垃圾污染过）；
  //      旧实现在步骤 3 就已经把 .bak 覆盖成垃圾，这里会连不出任何版本，只能返回 null。
  const file = path.join(TMP, 'ws-guard.json');
  await req('PUT', '/api/store/ws-guard', '{"v":1}');
  await req('PUT', '/api/store/ws-guard', '{"v":2}');
  fs.writeFileSync(file, '{BROKEN', 'utf8');
  await req('PUT', '/api/store/ws-guard', '{"v":3}');
  fs.writeFileSync(file, '{BROKEN', 'utf8');
  const r = await req('GET', '/api/store/ws-guard');
  assert.deepStrictEqual(JSON.parse(r.body), { v: 1 }, '应回退到最后一份没被污染的好备份');
});

test('首写后损坏主文件（无 .bak 可退）时 GET 返回 409 corrupt', async () => {
  await req('PUT', '/api/store/ws-corrupt-nobak', '{"v":1}');
  // 只写过一次，还没有 .bak；现在把唯一的一份写坏。
  fs.writeFileSync(path.join(TMP, 'ws-corrupt-nobak.json'), '{BROKEN', 'utf8');
  const r = await req('GET', '/api/store/ws-corrupt-nobak');
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.headers['content-type'], 'application/json');
  assert.deepStrictEqual(JSON.parse(r.body), { ok: false, corrupt: true });
});

test('主文件与 .bak 都写坏时 GET 返回 409 corrupt', async () => {
  await req('PUT', '/api/store/ws-corrupt-both', '{"v":1}');
  await req('PUT', '/api/store/ws-corrupt-both', '{"v":2}');
  // 此时 .bak = v1；把主文件和 .bak 都写坏，模拟两份都救不回来的最坏情况。
  fs.writeFileSync(path.join(TMP, 'ws-corrupt-both.json'), '{BROKEN', 'utf8');
  fs.writeFileSync(path.join(TMP, 'ws-corrupt-both.json.bak'), '{ALSO BROKEN', 'utf8');
  const r = await req('GET', '/api/store/ws-corrupt-both');
  assert.strictEqual(r.status, 409);
  assert.deepStrictEqual(JSON.parse(r.body), { ok: false, corrupt: true });
});

test('不支持的方法返回 405，并带 Allow 头', async () => {
  const r = await req('DELETE', '/api/store/ws-x');
  assert.strictEqual(r.status, 405);
  assert.strictEqual(r.headers.allow, 'GET, HEAD, PUT, POST');
});

test('HEAD 走读取分支而不是被 405 误伤', async () => {
  await req('PUT', '/api/store/ws-head', '{"ok":true}');
  const r = await req('HEAD', '/api/store/ws-head');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body, '', 'HEAD 不应带 body');
});
