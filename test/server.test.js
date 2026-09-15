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

test('游戏文件从 GAME_DIR 兜底服务（非 db-console 皮肤也能拿到）', async () => {
  // 当前皮肤是 docs-portal，它目录里没有 farm.js，应回退到 skins/db-console
  for (const p of ['/farm.js', '/fishing.js', '/combat.js', '/equip.js', '/mining.js', '/magic.js', '/farm.css']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p + ' 应能兜底服务');
    assert.ok(r.body.length > 100, p + ' 不应为空');
  }
});

test('游戏资源目录 fish/scenes 兜底服务', async () => {
  // 取目录里第一个真实文件名来验证（避免硬编码某张图）
  const fs = require('node:fs');
  const path = require('node:path');
  const fishDir = path.join(__dirname, '..', 'skins', 'db-console', 'fish');
  const first = fs.readdirSync(fishDir).filter((f) => /\.webp$/.test(f))[0];
  if (first) {
    const r = await get('/fish/' + first);
    assert.strictEqual(r.status, 200, '/fish/' + first + ' 应兜底服务');
  }
});

test('兜底只服务游戏白名单，不泄漏 db-console 的伪装内容', async () => {
  // content.js/skin.css 是 db-console 的皮肤内容，不在游戏白名单，
  // docs-portal 皮肤下请求应拿到 docs-portal 自己的（或 404），绝不回退到 db-console 的。
  const r = await get('/content.js');
  const body = r.body.toString('utf8');
  // db-console 的 content.js 含 Supabase schema 关键词；docs-portal 的不含
  assert.ok(!/podmatrix|keyspace|supabase/i.test(body), 'content.js 不得回退到 db-console 的内容');
});

test('编码路径穿越落到 /content.js 时由当前皮肤接走，不回退 db-console', async () => {
  // 诚实说明这条测试到底证明了什么：只证明「穿越规范化成 /content.js 后，
  // docs-portal 皮肤自己的 content.js 先接走，绝不回退到 db-console 那份」。
  // 它不是入口规范化或白名单的守卫——实测把 server.js 的 pathname 规范化那行
  // 和整个白名单（isGameAsset 恒 true）同时拆掉，这条照样全绿：
  //   · /fish/..%2f..%2fdb-console%2fcontent.js 归一后落到一个不存在的路径，
  //     是「文件不存在」才 404，跟白名单没关系；
  //   · /mobs/..%2fcontent.js 归一成 /content.js，被本皮肤的 content.js 在皮肤
  //     分支接走，根本进不到兜底分支。
  // 真守卫在别处：
  //   · test/game-fallback.test.js（临时 GAME_DIR + 哨兵文件）守入口规范化与白名单本身；
  //   · test/tracer-skin.test.js 的「编码路径穿越不能从 GAME_DIR 掏出 db-console 的
  //     伪装文件」——tracer 皮肤没有 content.js，请求会真的落到兜底分支。

  // 规范化成 /db-console/content.js：既不在皮肤目录、也不在游戏白名单 → 必须 404
  const r404 = await get('/fish/..%2f..%2fdb-console%2fcontent.js');
  assert.strictEqual(r404.status, 404,
    '/fish/..%2f..%2fdb-console%2fcontent.js 规范化后不在白名单，必须 404');

  // 规范化成 /content.js：由当前（docs-portal）皮肤自己的 content.js 接走，
  // 绝不能回退到 db-console 那份含真实项目名的伪装脚本。
  for (const p of ['/mobs/..%2fcontent.js', '/equip/..%5ccontent.js']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p + ' 规范化成 /content.js，应由本皮肤接走');
    assert.ok(!/podmatrix|keyspace|supabase/i.test(r.body.toString('utf8')),
      p + ' 不得回退到 db-console 的 content.js');
  }
});

test('规范化 pathname 后正常游戏资源仍可兜底', async () => {
  const r = await get('/farm.js');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.length > 100);
});
