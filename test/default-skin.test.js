'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 之前这个文件直接断言 server.js 里的 DEFAULTS 字面量等于测试里写的另一个
// 字面量——同义反复：哪怕 loadConfig 完全不读 DEFAULTS、把皮肤硬编码回
// docs-portal，这个断言照样是绿的，压根没走到真正该测的合并逻辑。
//
// 真正没法测的不是「默认值是什么」，而是 loadConfig 内部写死的
// path.join(ROOT, 'local.config.json')——本机的 local.config.json 恰好配着
// db-console，会盖住 DEFAULTS 本身有没有改对。把 root/env 变成可注入参数后，
// 测试就能把 root 指到一个干净的临时目录、env 传 {}，走 loadConfig 真实的
// 「环境变量 > 文件 > DEFAULTS」合并路径断言，不再受这台机器的本地配置摆布，
// 顺带把这条优先级顺序也纳入了覆盖（此前完全没有测试碰过它）。
process.env.DOCS_PORTAL_SKIN = 'docs-portal';
const { loadConfig } = require('../server.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'loadconfig-test-'));

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('loadConfig 裸跑（空目录、无环境变量）默认皮肤是 tracer', () => {
  const cfg = loadConfig(TMP, {});
  assert.strictEqual(cfg.skin, 'tracer');
  // 顺带确认走的确实是 DEFAULTS 整体合并，不是只硬编码了 skin 这一个字段。
  assert.strictEqual(cfg.port, 8080);
  assert.strictEqual(cfg.host, '127.0.0.1');
});

test('loadConfig 优先级：local.config.json 能覆盖 DEFAULTS', () => {
  fs.writeFileSync(path.join(TMP, 'local.config.json'), JSON.stringify({ skin: 'db-console' }), 'utf8');
  const cfg = loadConfig(TMP, {});
  assert.strictEqual(cfg.skin, 'db-console', '文件里配的皮肤应该盖过 DEFAULTS');
});

test('loadConfig 优先级：环境变量能覆盖 local.config.json（同一份文件仍在）', () => {
  // 复用上一条测试留下的、skin 配成 db-console 的 local.config.json，
  // 验证的正是「环境变量 > 文件」这一级，而不是「文件 > DEFAULTS」。
  const cfg = loadConfig(TMP, { DOCS_PORTAL_SKIN: 'docs-portal' });
  assert.strictEqual(cfg.skin, 'docs-portal', '环境变量应该盖过文件里配的皮肤');
});

test('loadConfig 端口/主机环境变量同样遵循「环境变量 > 文件 > DEFAULTS」', () => {
  const cfg = loadConfig(TMP, { DOCS_PORTAL_PORT: '9999', DOCS_PORTAL_HOST: '0.0.0.0' });
  assert.strictEqual(cfg.port, 9999);
  assert.strictEqual(cfg.host, '0.0.0.0');
});
