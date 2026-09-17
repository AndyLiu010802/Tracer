'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// 只读存储开关：探针/审查脚本起 server 时带上它，就算忘了设 DOCS_PORTAL_DATA_DIR，
// 也写不坏真实的演示数据。环境变量要在 require server 之前设好——常量在 require 时就固定了。
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'store-ro-test-'));
process.env.DOCS_PORTAL_DATA_DIR = TMP;
process.env.DOCS_PORTAL_SKIN = 'docs-portal';
process.env.DOCS_PORTAL_READONLY_STORE = '1';
// bookmarks.json 现在也有独立的覆盖点了（DOCS_PORTAL_STATE_FILE），顺手指到
// 临时目录，跟 DATA_DIR 一样不碰仓库根的真实文件。
process.env.DOCS_PORTAL_STATE_FILE = path.join(TMP, 'bookmarks.json');

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

function req(method, pathname, body, headers) {
  return new Promise((resolve, reject) => {
    const r = http.request(origin + pathname, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    r.on('error', reject);
    r.end(body);
  });
}

test('只读模式下 PUT 被拒且不落盘', async () => {
  const r = await req('PUT', '/api/store/ws-ro', '{"tasks":[{"id":"t1"}]}');
  assert.strictEqual(r.status, 403, 'PUT 应被拒绝');
  assert.ok(!fs.existsSync(path.join(TMP, 'ws-ro.json')), '只读模式绝不能落盘');
});

test('只读模式下 POST 同样被拒（sendBeacon 走 POST）', async () => {
  const r = await req('POST', '/api/store/ws-ro2', '{"v":1}');
  assert.strictEqual(r.status, 403);
  assert.ok(!fs.existsSync(path.join(TMP, 'ws-ro2.json')), '只读模式绝不能落盘');
});

test('同源工作区 beacon 仍遵守只读模式', async () => {
  const original = '{"tasks":[{"id":"existing","title":"Keep me"}],"meta":{}}';
  fs.writeFileSync(path.join(TMP, 'workspace.json'), original, 'utf8');
  const result = await req('POST', '/api/store/workspace', '{"tasks":[],"meta":{}}', { Origin: origin, 'content-type': 'text/plain;charset=UTF-8' });
  assert.strictEqual(result.status, 403);
  assert.deepStrictEqual(JSON.parse(result.body), { ok: false, readonly: true });
  assert.strictEqual((await req('GET', '/api/store/workspace')).body, original);
});

test('只读模式下 GET 照常可读', async () => {
  // 绕过 HTTP 直接铺一份存档，确认只读挡的是写、不是读——
  // 皮肤仍要能把演示数据读出来渲染。
  fs.writeFileSync(path.join(TMP, 'ws-seed.json'), '{"tasks":[{"id":"t9"}]}', 'utf8');
  const r = await req('GET', '/api/store/ws-seed');
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(JSON.parse(r.body), { tasks: [{ id: 't9' }] });
});

test('只读模式不影响 GET /api/state（读永远不受影响）', async () => {
  const r = await req('GET', '/api/state');
  assert.strictEqual(r.status, 200);
});

test('只读模式下 POST /api/state 也被拒（M10：书签/阅读进度不在 DATA_DIR 管辖内，这条守卫是它唯一的写保护）', async () => {
  // STATE_FILE（bookmarks.json）不受 DOCS_PORTAL_DATA_DIR 管，也不属于
  // /api/store/*，是单独一条写保护路径——上面已经把它指到本文件专用的临时
  // 文件（DOCS_PORTAL_STATE_FILE），不再是仓库根共享的真实文件，因此不用
  // 担心被其它测试文件并发改写。这里仍然用一个绝不会自然出现的标记值来断言：
  // 只要守卫生效，这个标记就永远进不了文件，跟文件当下究竟是什么内容无关。
  const marker = 'https://readonly-guard-marker.invalid/should-not-be-written';
  const r = await req('POST', '/api/state', JSON.stringify({ url: marker, mode: 'dock' }));
  assert.strictEqual(r.status, 403, 'POST /api/state 在只读模式下应被拒绝');
  const after = await req('GET', '/api/state');
  assert.ok(!after.body.includes(marker), '被拒的写入不能实际落盘');
});
