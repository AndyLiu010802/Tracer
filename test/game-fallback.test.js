'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// 这个文件专门守「游戏资源兜底」（server.js 的 isGameAsset + GAME_DIR 分支）的两条
// 安全不变量：① 白名单之外的 GAME_DIR 文件不得被服务出去；② 编码穿越（..%2f/..%5c）
// 必须在入口按规范化后的 pathname 查白名单。
//
// 为什么要造夹具而不是直接拿真实的 db-console 当 GAME_DIR：docs-portal 皮肤下构造
// 不出真实泄漏。db-console 里非白名单的文件只有 content.js / index.html / skin.css，
// 这三个名字 docs-portal 皮肤自己也有，皮肤分支会先接走，请求根本进不到兜底分支；
// 而穿越到 /db-console/content.js 这种路径是「文件不存在」才 404，把规范化和白名单
// 一起拆掉也照样绿——零守护力。所以这里用临时 GAME_DIR：种一个当前皮肤里绝对没有
// 同名文件的哨兵 disguise.js，泄漏与否用哨兵字符串直接判定，拆掉修复必然变红。
process.env.DOCS_PORTAL_SKIN = 'docs-portal';

// 状态落盘指到临时文件，别写脏仓库根的真实 bookmarks.json（同 server.test.js）。
const TMP_STATE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'game-fallback-state-')), 'bookmarks.json');
process.env.DOCS_PORTAL_STATE_FILE = TMP_STATE_FILE;

// 临时 GAME_DIR 夹具。文件内容随便，但要 >200 字节，才能和「空文件/破图」区分开。
const SENTINEL = 'SENTINEL_DISGUISE_7f3a';
const TMP_GAME_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'game-fallback-dir-'));
const filler = 'x'.repeat(300);
fs.mkdirSync(path.join(TMP_GAME_DIR, 'fish'));
fs.mkdirSync(path.join(TMP_GAME_DIR, 'mobs'));
fs.writeFileSync(path.join(TMP_GAME_DIR, 'fish', 'a.webp'), filler);
fs.writeFileSync(path.join(TMP_GAME_DIR, 'mobs', 'b.webp'), filler);
fs.writeFileSync(path.join(TMP_GAME_DIR, 'hero.webp'), filler);
// 哨兵：白名单外的 GAME_DIR 文件。任何响应正文里出现这个字符串都意味着兜底漏了。
fs.writeFileSync(path.join(TMP_GAME_DIR, 'disguise.js'), '// ' + SENTINEL + '\n' + filler + '\n');
process.env.DOCS_PORTAL_GAME_DIR = TMP_GAME_DIR;

const { server } = require('../server.js');

let origin;

test.before(() => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    origin = 'http://127.0.0.1:' + server.address().port;
    resolve();
  });
}));

test.after(() => new Promise((resolve) => server.close(() => {
  fs.rmSync(TMP_GAME_DIR, { recursive: true, force: true });
  fs.rmSync(path.dirname(TMP_STATE_FILE), { recursive: true, force: true });
  resolve();
})));

function get(pathname) {
  return new Promise((resolve, reject) => {
    http.get(origin + pathname, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    }).on('error', reject);
  });
}

test('白名单内的游戏资源能从 GAME_DIR 兜底服务', async () => {
  for (const p of ['/fish/a.webp', '/mobs/b.webp', '/hero.webp']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p + ' 应能从 GAME_DIR 兜底服务');
    assert.ok(r.body.length > 200, p + ' 不应为空（bytes=' + r.body.length + '）');
  }
});

test('白名单之外的 GAME_DIR 文件不得被服务出去', async () => {
  // 守的是白名单本身：把 isGameAsset 改成恒 true，这条立刻变红。
  const r = await get('/disguise.js');
  const body = r.body.toString('utf8');
  assert.ok(!body.includes(SENTINEL), '/disguise.js 不得泄漏 GAME_DIR 哨兵内容（status=' + r.status + '）');
  assert.strictEqual(r.status, 404, '/disguise.js 不在白名单，应 404');
});

test('编码路径穿越规范化后不得掏出白名单外的 GAME_DIR 文件', async () => {
  // 守的是入口那行 pathname 规范化（server.js 的 posix.normalize + 反斜杠归一）。
  // 拆掉它：pathname 仍是 /fish/../disguise.js，前缀判断照样命中 '/fish/'，
  // 而 safeJoin 内部会自己归一，正好落到 GAME_DIR/disguise.js —— 200 泄漏。
  // 注：..%5c 这条的红只在 win32 成立（path.resolve 把 \ 当分隔符）；另两条跨平台。
  for (const p of ['/fish/..%2fdisguise.js', '/mobs/..%5cdisguise.js', '/fish/..%2f..%2fdisguise.js']) {
    const r = await get(p);
    const body = r.body.toString('utf8');
    assert.ok(!body.includes(SENTINEL), p + ' 不得泄漏 GAME_DIR 哨兵内容（status=' + r.status + '）');
    assert.strictEqual(r.status, 404, p + ' 规范化后不在白名单，应 404');
  }
});

test('白名单目录本身不可列目录', async () => {
  for (const p of ['/fish/']) {
    const r = await get(p);
    assert.strictEqual(r.status, 404, p + ' 是目录，不应返回内容');
  }
});
