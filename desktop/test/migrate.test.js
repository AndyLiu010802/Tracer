'use strict';

// 存档迁移（改名 podmatrix-desktop → tracer-desktop 导致 userData 路径漂移）的回归测试。
// migrate.js 是纯函数（同 pulse.js 的理由：脱离 Electron 才能单测），这里只摆弄真实
// 文件系统的临时目录，不起 Electron。
//
// 这是整套打包计划里唯一会碰用户真实存档的一步，历史上本项目已经出过两次「回归测试
// 假绿」的事故，所以幂等那条（test 2）额外做了「新目录内容逐字节快照不变」的强校验，
// 不能只看返回值。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { migrateUserData } = require('../migrate');

function mkTmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-migrate-test-'));
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

// 目录内容的逐字节快照：相对路径 + base64 内容，排序后比较，用来断言
// 「一个字节都没变」，而不是只看几个代表性文件。
function snapshot(dir) {
  if (!fs.existsSync(dir)) return null;
  const out = [];
  (function walk(rel) {
    const abs = path.join(dir, rel);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      fs.readdirSync(abs).forEach(function (child) {
        walk(rel === '.' ? child : path.join(rel, child));
      });
    } else {
      out.push({ rel: rel.split(path.sep).join('/'), content: fs.readFileSync(abs).toString('base64') });
    }
  })('.');
  out.sort(function (a, b) { return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0; });
  return out;
}

test('旧目录有存档、新目录空 → 复制过去，且旧目录仍然完好（复制不是移动）', function (t) {
  const root = mkTmpRoot();
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });

  const oldDir = path.join(root, 'podmatrix-desktop');
  const newDir = path.join(root, 'tracer-desktop');
  writeFile(path.join(oldDir, 'Local Storage', 'leveldb', 'CURRENT'), 'leveldb-marker');
  writeFile(path.join(oldDir, 'Session Storage', 'sess.ldb'), 'sess-marker');
  writeFile(path.join(oldDir, 'data', 'notes.json'), '{"a":1}');
  writeFile(path.join(oldDir, 'bookmarks.json'), '{"real":true}');

  const oldBefore = snapshot(oldDir);

  const result = migrateUserData(oldDir, newDir);

  assert.strictEqual(result.status, 'ok');
  assert.deepStrictEqual(result.migrated.sort(), ['Local Storage', 'Session Storage', 'bookmarks.json', 'data'].sort());
  assert.deepStrictEqual(result.errors, []);

  // 新目录里确实有了这些内容。
  assert.strictEqual(fs.readFileSync(path.join(newDir, 'Local Storage', 'leveldb', 'CURRENT'), 'utf8'), 'leveldb-marker');
  assert.strictEqual(fs.readFileSync(path.join(newDir, 'Session Storage', 'sess.ldb'), 'utf8'), 'sess-marker');
  assert.strictEqual(fs.readFileSync(path.join(newDir, 'data', 'notes.json'), 'utf8'), '{"a":1}');
  assert.strictEqual(fs.readFileSync(path.join(newDir, 'bookmarks.json'), 'utf8'), '{"real":true}');

  // 旧目录一个字节都没少——证明是复制，不是移动。
  assert.deepStrictEqual(snapshot(oldDir), oldBefore);
});

test('新目录已有存档 → 跳过，新目录内容逐字节不变（幂等，最重要的一条）', function (t) {
  const root = mkTmpRoot();
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });

  const oldDir = path.join(root, 'podmatrix-desktop');
  const newDir = path.join(root, 'tracer-desktop');
  // 旧目录有「旧进度」，而且还多一项新目录完全没有的 bookmarks.json——
  // 用来验证"任意一项命中就整体跳过"，而不是"逐项判断，缺的那项照样补"。
  // 如果实现退化成逐项判断，这里的 bookmarks.json 会被误"补"进新目录。
  writeFile(path.join(oldDir, 'Local Storage', 'leveldb', 'CURRENT'), 'OLD-PROGRESS');
  writeFile(path.join(oldDir, 'bookmarks.json'), '{"from":"old"}');
  // 新目录已经有「新进度」——如果被旧的盖掉，这条测试要能抓到。
  writeFile(path.join(newDir, 'Local Storage', 'leveldb', 'CURRENT'), 'NEW-PROGRESS');

  const newBefore = snapshot(newDir);
  const oldBefore = snapshot(oldDir);

  const result = migrateUserData(oldDir, newDir);

  assert.strictEqual(result.status, 'already-migrated');
  assert.deepStrictEqual(result.migrated, []);
  assert.deepStrictEqual(result.errors, []);

  // 新目录的内容跟迁移前逐字节一致：没有被覆盖，也没有被「补齐」成其它条目。
  assert.deepStrictEqual(snapshot(newDir), newBefore);
  assert.strictEqual(fs.readFileSync(path.join(newDir, 'Local Storage', 'leveldb', 'CURRENT'), 'utf8'), 'NEW-PROGRESS');
  assert.strictEqual(fs.existsSync(path.join(newDir, 'bookmarks.json')), false, '不该逐项补齐缺的条目——命中一项就整体跳过');
  // 旧目录也没被动过。
  assert.deepStrictEqual(snapshot(oldDir), oldBefore);
});

test('旧目录不存在 → 安静跳过，不抛错，也不会凭空创建新目录', function (t) {
  const root = mkTmpRoot();
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });

  const oldDir = path.join(root, 'podmatrix-desktop'); // 从未创建
  const newDir = path.join(root, 'tracer-desktop');

  let result;
  assert.doesNotThrow(function () { result = migrateUserData(oldDir, newDir); });

  assert.strictEqual(result.status, 'no-old-dir');
  assert.deepStrictEqual(result.migrated, []);
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(fs.existsSync(newDir), false, '全新安装不该凭空造出新 userData 目录');
});

test('复制中途出错（目标路径被同名文件占住）→ 不抛出，返回失败标记', function (t) {
  const root = mkTmpRoot();
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });

  const oldDir = path.join(root, 'podmatrix-desktop');
  writeFile(path.join(oldDir, 'Local Storage', 'leveldb', 'CURRENT'), 'leveldb-marker');
  writeFile(path.join(oldDir, 'bookmarks.json'), '{"real":true}');
  const oldBefore = snapshot(oldDir);

  // 制造一个真实的失败：newDir 的上级路径本该是目录，却被一个同名文件占住，
  // 导致新目录本身都创建不出来（ENOTDIR），而不是靠人为 mock 抛错。
  const blockerFile = path.join(root, 'blocker');
  fs.writeFileSync(blockerFile, 'i am a file, not a directory');
  const newDir = path.join(blockerFile, 'tracer-desktop');

  let result;
  assert.doesNotThrow(function () { result = migrateUserData(oldDir, newDir); });

  assert.strictEqual(result.status, 'failed');
  assert.ok(result.errors.length > 0, '应该记录到出错信息');
  assert.deepStrictEqual(result.migrated, []);

  // 旧目录完好无损。
  assert.deepStrictEqual(snapshot(oldDir), oldBefore);
});

test('旧目录只有部分条目 → 存在的迁过去，不存在的跳过，不报错', function (t) {
  const root = mkTmpRoot();
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });

  const oldDir = path.join(root, 'podmatrix-desktop');
  const newDir = path.join(root, 'tracer-desktop');
  // 只有 Local Storage，没有 Session Storage / data / bookmarks.json。
  writeFile(path.join(oldDir, 'Local Storage', 'leveldb', 'CURRENT'), 'leveldb-marker');

  const result = migrateUserData(oldDir, newDir);

  assert.strictEqual(result.status, 'ok');
  assert.deepStrictEqual(result.migrated, ['Local Storage']);
  assert.deepStrictEqual(result.errors, []);
  const skippedNames = result.skipped.map(function (s) { return s.name; }).sort();
  assert.deepStrictEqual(skippedNames, ['Session Storage', 'bookmarks.json', 'data'].sort());
  result.skipped.forEach(function (s) {
    assert.strictEqual(s.reason, 'not-found');
  });

  assert.strictEqual(fs.readFileSync(path.join(newDir, 'Local Storage', 'leveldb', 'CURRENT'), 'utf8'), 'leveldb-marker');
  assert.strictEqual(fs.existsSync(path.join(newDir, 'Session Storage')), false);
  assert.strictEqual(fs.existsSync(path.join(newDir, 'data')), false);
  assert.strictEqual(fs.existsSync(path.join(newDir, 'bookmarks.json')), false);
});
