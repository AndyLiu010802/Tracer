'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// 验证 DOCS_PORTAL_STATE_FILE 覆盖点：桌面版打包后安装目录只读，需要把
// bookmarks.json 的落点改到别处（如 app.getPath('userData')）。
// 环境变量要在 require server 之前设好——STATE_FILE 常量在 require 时就固定了，
// 这也是本文件必须独立于其它测试文件存在的原因（node --test 每个文件是独立进程）。
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'state-file-override-test-'));
const OVERRIDE_STATE_FILE = path.join(TMP, 'bookmarks.json');
process.env.DOCS_PORTAL_STATE_FILE = OVERRIDE_STATE_FILE;
process.env.DOCS_PORTAL_DATA_DIR = TMP;
process.env.DOCS_PORTAL_SKIN = 'docs-portal';

const { server } = require('../server.js');

// 仓库根目录的真实 bookmarks.json——覆盖点生效的话，这份文件绝不能被创建/改动。
const REAL_STATE_FILE = path.join(__dirname, '..', 'bookmarks.json');
const realFileExistedBefore = fs.existsSync(REAL_STATE_FILE);
const realFileSnapshotBefore = realFileExistedBefore
  ? fs.readFileSync(REAL_STATE_FILE, 'utf8')
  : null;

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
    const r = http.request(origin + pathname, {
      method,
      headers: body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {},
    }, (res) => {
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

test('POST /api/state 写的是 DOCS_PORTAL_STATE_FILE 指向的文件，不是仓库根的 bookmarks.json', async () => {
  const marker = 'https://state-file-override-marker.invalid/x';
  const r = await req('POST', '/api/state', JSON.stringify({ url: marker, mode: 'dock' }));
  assert.strictEqual(r.status, 200, 'POST /api/state 应成功');

  assert.ok(fs.existsSync(OVERRIDE_STATE_FILE), '覆盖点指向的文件应被写出');
  const written = JSON.parse(fs.readFileSync(OVERRIDE_STATE_FILE, 'utf8'));
  assert.strictEqual(written.url, marker, '写入内容应落在覆盖点文件里');

  // 仓库根的真实文件不应被创建，也不应被改动。
  if (realFileExistedBefore) {
    assert.strictEqual(
      fs.readFileSync(REAL_STATE_FILE, 'utf8'),
      realFileSnapshotBefore,
      '仓库根的真实 bookmarks.json 不应被改动'
    );
  } else {
    assert.ok(!fs.existsSync(REAL_STATE_FILE), '仓库根不应凭空冒出 bookmarks.json');
  }
});

test('GET /api/state 读的也是 DOCS_PORTAL_STATE_FILE 指向的文件', async () => {
  const marker2 = 'https://state-file-override-marker.invalid/y';
  await req('POST', '/api/state', JSON.stringify({ url: marker2, mode: 'panel' }));

  const r = await req('GET', '/api/state');
  assert.strictEqual(r.status, 200);
  const body = JSON.parse(r.body);
  assert.strictEqual(body.url, marker2, 'GET 应读到覆盖点文件里刚写入的内容');

  if (realFileExistedBefore) {
    assert.strictEqual(
      fs.readFileSync(REAL_STATE_FILE, 'utf8'),
      realFileSnapshotBefore,
      '仓库根的真实 bookmarks.json 不应被改动'
    );
  } else {
    assert.ok(!fs.existsSync(REAL_STATE_FILE), '仓库根不应凭空冒出 bookmarks.json');
  }
});
