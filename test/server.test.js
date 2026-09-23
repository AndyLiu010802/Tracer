'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// 固定皮肤再加载 server：下面的断言认的是 docs-portal 的页面，
// 不能被 local.config.json 里恰好配着哪套皮肤左右。
process.env.DOCS_PORTAL_SKIN = 'docs-portal';

// 下面「状态接口可读写」那条测试会真的 POST /api/state，写的内容落进
// DOCS_PORTAL_STATE_FILE 指向的文件——不设的话会写到仓库根的真实 bookmarks.json，
// 污染那份共享的真实存档。这里指到临时文件，跑测试不再有副作用。
const TMP_STATE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'server-test-state-')), 'bookmarks.json');
process.env.DOCS_PORTAL_STATE_FILE = TMP_STATE_FILE;

const { server, injectReader, safeJoin } = require('../server.js');
const rewrite = require('../lib/rewrite.js');

let origin;

test.before(() => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    origin = 'http://127.0.0.1:' + server.address().port;
    resolve();
  });
}));

test.after(() => new Promise((resolve) => server.close(() => {
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

test('首页返回伪装文档站并注入小窗', async () => {
  const r = await get('/');
  assert.strictEqual(r.status, 200);
  const html = r.body.toString('utf8');
  assert.ok(html.includes('<title>Market Data Platform — Engineering Docs</title>'), '标签页标题应为文档站');
  assert.ok(html.includes('id="aside-slot"'), '挂载点必须存在');
  assert.ok(html.includes('/reader.js'), '小窗脚本应被注入');
  assert.ok(html.includes('/reader.css'), '小窗样式应被注入');
  assert.ok(html.includes('__ASIDE_CONFIG__'), '配置应被注入');
  assert.ok(!/novel|小说|reader panel/i.test(html.replace(/reader\.(js|css)/g, '')),
    '页面源码里不应出现暴露性词汇');
});

test('皮肤静态资源可访问', async () => {
  for (const p of ['/skin.css', '/content.js']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p + ' 应可访问');
    assert.ok(r.body.length > 100, p + ' 不应为空');
  }
});

test('小窗组件资源可访问', async () => {
  for (const p of ['/reader.js', '/reader.css', '/conceal-policy.js']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p + ' 应可访问');
  }
});

test('策略模块注入顺序必须早于 reader', async () => {
  const html = (await get('/')).body.toString('utf8');
  const policyAt = html.indexOf('/conceal-policy.js');
  const readerAt = html.indexOf('/reader.js');
  assert.ok(policyAt > 0 && readerAt > 0, '两个脚本都应注入');
  assert.ok(policyAt < readerAt, 'conceal-policy 必须在 reader 之前，否则 reader 启动时拿不到它');
});

test('autoHide 配置随页面下发', async () => {
  const html = (await get('/')).body.toString('utf8');
  const m = /__ASIDE_CONFIG__ = (\{.*?\});/.exec(html);
  assert.ok(m, '配置应被注入');
  assert.strictEqual(JSON.parse(m[1]).autoHide, 'blur', '默认只在整窗失焦时隐藏');
});

test('每套皮肤都定义小窗消费的全部 CSS 变量', async () => {
  const reader = (await get('/reader.css')).body.toString('utf8');
  const vars = ['--fg', '--bg', '--muted', '--border', '--accent', '--surface',
    '--font-body', '--font-mono', '--radius'];
  // 契约：皮肤定义变量，小窗只消费变量。任何一方缺失都会导致小窗视觉脱节。
  // 扫描 skins/ 下的每一套，新皮肤漏定义变量在这里就会被抓住，而不是装上才发现。
  const skinsDir = path.join(__dirname, '..', 'skins');
  const names = fs.readdirSync(skinsDir).filter((n) =>
    fs.existsSync(path.join(skinsDir, n, 'skin.css')));
  assert.ok(names.length >= 1, 'skins/ 下至少应有一套皮肤');
  for (const name of names) {
    const skin = fs.readFileSync(path.join(skinsDir, name, 'skin.css'), 'utf8');
    for (const v of vars) {
      assert.ok(skin.includes(v + ':'), '皮肤 ' + name + ' 必须定义 ' + v);
    }
    // 停靠态靠父链撑高：#aside-slot 必须是能长高的 flex 容器，否则小窗塌成 min-height
    assert.ok(/#aside-slot[^{}]*\{[^}]*flex\s*:\s*1/.test(skin), '皮肤 ' + name + ' 的 #aside-slot 必须 flex:1');
  }
  for (const v of vars) {
    assert.ok(reader.includes('var(' + v), '小窗必须消费 ' + v);
  }
});

test('无效代理 token 返回伪装提示而非报错', async () => {
  const r = await get('/r/!!!invalid!!!');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.toString('utf8').includes('Reference unavailable'));
});

test('未知路径返回伪装 404，不露出 Node 默认响应', async () => {
  const r = await get('/definitely-not-here');
  assert.strictEqual(r.status, 404);
  const body = r.body.toString('utf8');
  assert.ok(body.includes('Reference unavailable'));
  assert.ok(!/cannot get/i.test(body));
});

test('safeJoin 把任何输入都夹在目录内', () => {
  const dir = path.resolve('/tmp/skins/x');
  // 契约是「结果要么为 null，要么落在 dir 内」，而不是「一定返回 null」：
  // posix normalize 会把前导 .. 直接吃掉，穿越因此变成目录内的不存在路径。
  const attempts = [
    '/../../etc/passwd',
    '/../../../secret',
    '/..\\..\\server.js',      // Windows 反斜杠分隔符
    '/./../../server.js',
    '/%2e%2e/server.js',
  ];
  for (const rel of attempts) {
    const out = safeJoin(dir, rel);
    if (out !== null) {
      assert.ok(
        out === dir || out.startsWith(dir + path.sep),
        rel + ' 逃出了目录：' + out
      );
    }
  }
  assert.ok(safeJoin(dir, '/skin.css'));
});

test('穿越型 URL 拿不到仓库文件', async () => {
  const r = await get('/../../server.js');
  assert.notStrictEqual(r.status, 200, '不得读到目录之外的文件');
});

test('injectReader 在缺 body 闭合标签时仍能注入', () => {
  const out = injectReader('<html><p>x</p>', { base: 'http://x' });
  assert.ok(out.includes('/reader.js'));
});

test('状态接口可读写', async () => {
  const payload = JSON.stringify({ url: 'https://example.com/x', mode: 'dock' });
  await new Promise((resolve, reject) => {
    const req = http.request(origin + '/api/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
    }, resolve);
    req.on('error', reject);
    req.end(payload);
  });
  const r = await get('/api/state');
  assert.strictEqual(JSON.parse(r.body.toString('utf8')).url, 'https://example.com/x');
});

test('代理端点接受合法 token', async () => {
  // 指向一个必然连不上的地址，验证的是路由分发而非网络
  const token = rewrite.encodeTarget('http://127.0.0.1:1/x');
  const r = await get('/r/' + token);
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.toString('utf8').includes('Reference unavailable'));
});

test('retired game scripts, styles and artwork return 404 for docs-portal', async () => {
  for (const p of ['/farm.js', '/farm-data.js', '/fishing.js', '/combat.js', '/equip.js', '/mining.js', '/magic.js', '/farm.css', '/fish/carp.webp', '/scenes/temp_lake.webp', '/hero.webp', '/arena.webp', '/mobs/deadlock.webp', '/mats/lock_fang.webp', '/equip/wpn1.webp']) {
    assert.strictEqual((await get(p)).status, 404, p);
  }
});

test('encoded paths stay within the current skin', async () => {
  assert.strictEqual((await get('/fish/..%2f..%2fdb-console%2fcontent.js')).status, 404);
  const expected = await get('/content.js');
  for (const p of ['/mobs/..%2fcontent.js', '/equip/..%5ccontent.js']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p);
    assert.deepStrictEqual(r.body, expected.body, p);
  }
});
