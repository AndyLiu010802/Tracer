'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

process.env.DOCS_PORTAL_SKIN = 'tracer';

const { server } = require('../server.js');

let origin;

test.before(() => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    origin = 'http://127.0.0.1:' + server.address().port;
    resolve();
  });
}));

test.after(() => new Promise((resolve) => server.close(resolve)));

function get(pathname) {
  return new Promise((resolve, reject) => {
    http.get(origin + pathname, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        // body 仍是 utf8 字符串（已有断言都按字符串写）；headers/bytes 是额外补的，
        // 给二进制资源（webp）验证 content-type 与真实字节数用，不影响老调用方。
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: buf.toString('utf8'),
          bytes: buf.length,
        });
      });
    }).on('error', reject);
  });
}

test('tracer 首页伪装完整并注入小窗', async () => {
  const r = await get('/');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.includes('<title>Tracer — Engineering</title>'), '标签页标题');
  assert.ok(r.body.includes('id="aside-slot"'), '挂载点');
  assert.ok(r.body.includes('data-panel-title="Reference"'), '面板文案定位为参考资料');
  assert.ok(r.body.includes('/reader.js'), '小窗脚本已注入');
  assert.ok(!/novel|小说/i.test(r.body), '不得出现暴露性词汇');
});

test('tracer 八个分区（含 Garden）与静态资源齐全', async () => {
  const html = (await get('/')).body;
  for (const sec of ['inbox', 'notes', 'board', 'map', 'planner', 'timeline', 'insights', 'garden']) {
    assert.ok(html.includes('data-sec="' + sec + '"'), '导航应有 ' + sec);
    assert.ok(html.includes('id="sec-' + sec + '"'), '应有分区 ' + sec);
  }
  // 导航项与分区必须一一对应，缺哪个都会让点击导航后主区空白
  const navCount = (html.match(/class="nav-item/g) || []).length;
  const secCount = (html.match(/class="sec[" ]/g) || []).length;
  assert.strictEqual(navCount, secCount, '导航项与分区必须一一对应');
  for (const p of ['/skin.css', '/model.js', '/app.js', '/garden.js', '/garden.css']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p + ' 应可访问');
    assert.ok(r.body.length > 100, p + ' 不应为空');
  }
  // garden.js:11-13 在这两个 id 缺失时静默 return（不挂载也不报错），挂载点
  // 本身必须存在，否则整个 Garden 分区悄无声息地不干活。
  assert.ok(html.includes('id="garden-main"'), '应有 farm.js 挂载点 garden-main');
  assert.ok(html.includes('id="garden-shop"'), '应有 farm.js 挂载点 garden-shop');
  // farm.js:renderRail() 的契约点：选中作物详情靠这两个 id，必须存在且不能是
  // hidden 桩——桩会让 renderRail() 写进去的内容彻底不可见（I2 回归的靶子）。
  assert.ok(html.includes('id="rail-label"'), '应有 farm.js 契约点 rail-label');
  assert.ok(html.includes('id="definition"'), '应有 farm.js 契约点 definition');
  assert.ok(!/id="rail-label"[^>]*\bhidden\b/.test(html), 'rail-label 不应是 hidden 桩');
  assert.ok(!/id="definition"[^>]*\bhidden\b/.test(html), 'definition 不应是 hidden 桩');
  // I2 的承重点：#rail-label/#definition 必须是 #garden-shop 的兄弟节点，不能
  // 是它的子节点——子节点会被 farm.js renderShop() 的 sideEl.innerHTML= 整体
  // 重写冲掉，详情面板等于白做。用「#garden-shop 是不是紧跟着自己关闭的空标签」
  // 来判断：一旦有人把 .garden-rail 挪进去，这个精确子串就不会再出现。
  assert.ok(html.includes('<div class="garden-shop" id="garden-shop"></div>'),
    '#garden-shop 必须是空标签（.garden-rail 是兄弟节点而非子节点）');
});

test('Garden provides a visible appearance switch as requested by the user', async () => {
  const css = (await get('/garden.css')).body;
  assert.ok(/\.btn\[data-act="skin"\]\s*\{[^}]*display\s*:\s*inline-flex/.test(css));
  const farm = (await get('/farm.js')).body;
  assert.ok(farm.includes('Show farm') && farm.includes('Disguise'));
});

test('garden.css 藏掉 farm.js 硬编码的 "role: postgres" 状态栏残留（db-console 装饰）', async () => {
  // farm.js 往状态栏塞了 <span class="role">role: postgres</span>，在没有任何
  // 数据库语境的 Tracer 工程工作台里冒出一句数据库角色是 db-console 的残留装饰，
  // 跟 🌱 按钮是同一类「引擎产出了皮肤不该有的东西」，只在 Tracer 侧藏掉。
  const css = (await get('/garden.css')).body;
  assert.ok(/\.statusline\s+\.role\s*\{[^}]*display\s*:\s*none/.test(css),
    'garden.css 必须隐藏 .statusline .role（"role: postgres" 残留）');
});

test('garden.css 保护 boss-key 的可见效果（.nav-item[hidden] 覆盖 display:flex）', async () => {
  // 整个「Ctrl+Alt+G 隐藏导航项」的可见效果只吊在这一条规则上：.nav-item 平时
  // display:flex，UA 默认的 [hidden]{display:none} 特异性不够盖过它，
  // 少了这条规则 nav.hidden=true 在视觉上完全不生效（但 JS 状态看着仍是对的，
  // 很容易被当成「已经修好」而漏掉）。
  const css = (await get('/garden.css')).body;
  assert.ok(/\.nav-item\[hidden\]\s*\{[^}]*display\s*:\s*none/.test(css),
    'garden.css 必须有 .nav-item[hidden]{display:none} 压过 .nav-item 的 flex');
});

test('Garden 的游戏引擎脚本齐全且顺序正确（fishing→combat→equip→mining→magic→farm，均在 app.js 之后）', async () => {
  const html = (await get('/')).body;
  // 一律用 src="..." 定位而非裸路径：index.html 的注释里会用裸文件名提到这些脚本，
  // 裸路径可能先命中注释、量出错误的顺序。
  const idxApp = html.indexOf('src="/app.js"');
  const idxFishing = html.indexOf('src="/fishing.js"');
  const idxCombat = html.indexOf('src="/combat.js"');
  const idxEquip = html.indexOf('src="/equip.js"');
  const idxMining = html.indexOf('src="/mining.js"');
  const idxMagic = html.indexOf('src="/magic.js"');
  const idxFarm = html.indexOf('src="/farm.js"');
  assert.ok(idxApp >= 0, '应引用 app.js');
  assert.ok(idxFishing >= 0, '应引用 fishing.js');
  assert.ok(idxCombat >= 0, '应引用 combat.js');
  assert.ok(idxEquip >= 0, '应引用 equip.js');
  assert.ok(idxMining >= 0, '应引用 mining.js');
  assert.ok(idxMagic >= 0, '应引用 magic.js');
  assert.ok(idxFarm >= 0, '应引用 farm.js');
  // boss-key 依赖 app.js 的 keydown 处理器先于 farm.js 的注册，顺序错了就会失效
  assert.ok(idxApp < idxFishing, 'app.js 必须先于 fishing.js（boss-key 先注册）');
  assert.ok(idxFishing < idxCombat, 'fishing.js 必须先于 combat.js');
  assert.ok(idxCombat < idxEquip, 'combat.js 必须先于 equip.js');
  assert.ok(idxEquip < idxMining, 'equip.js 必须先于 mining.js');
  assert.ok(idxMining < idxMagic, 'mining.js 必须先于 magic.js');
  assert.ok(idxMagic < idxFarm, 'magic.js 必须先于 farm.js（farm.js 顶部就取 window.Magic）');
  // index.html 引用的每个 /xxx.js 都必须真能取到（含从 GAME_DIR 兜底的引擎脚本）——
  // 农场新增引擎脚本没同步 server.js 的 GAME_FILES，这里立刻红。
  for (const m of html.matchAll(/src="(\/[a-z0-9-]+\.js)"/g)) {
    const r = await get(m[1]);
    assert.strictEqual(r.status, 200, m[1] + ' 被 index.html 引用，必须可取（GAME_FILES 漏配？）');
  }
});

test('四段调色板都定义了 accent', async () => {
  const css = (await get('/skin.css')).body;
  for (const ph of ['dawn', 'day', 'dusk', 'night']) {
    const m = new RegExp('data-phase="' + ph + '"\\s*\\]\\s*\\{([^}]*)\\}').exec(css);
    assert.ok(m && /--accent\s*:/.test(m[1]), '时段 ' + ph + ' 必须定义 accent');
  }
});

test('编码路径穿越不能从 GAME_DIR 掏出 db-console 的伪装文件', async () => {
  // tracer 皮肤目录里没有 content.js，请求会一路落到「游戏资源兜底」分支。
  // ..%2f / ..%5c 熬过 URL 解析、decode 后才变 ../：不在入口重新规范化 pathname 的话，
  // GAME_DIRS.some(...) 的前缀判断依旧成立，safeJoin 又只把结果夹在 GAME_DIR 内，
  // 于是 db-console 的 content.js（含真实项目名 podmatrix、Supabase schema）被服务出去。
  for (const p of ['/fish/..%2fcontent.js', '/fish/..%5ccontent.js',
    '/scenes/..%2fcontent.js']) {
    const r = await get(p);
    assert.ok(!/podmatrix|keyspace|supabase/i.test(r.body),
      p + ' 不得泄漏 db-console 伪装内容（status=' + r.status + '）');
    assert.strictEqual(r.status, 404, p + ' 应 404');
  }
});

test('规范化 pathname 后 tracer 仍能兜底拿到游戏资源', async () => {
  for (const p of ['/farm.js', '/farm.css']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p + ' 应 200');
    assert.ok(r.body.length > 100, p + ' 不应为空');
  }
});

test('右栏宽度走 CSS 变量，且有收起态的网格规则', async () => {
  const css = (await get('/skin.css')).body;
  assert.ok(/var\(--rail-w/.test(css), 'skin.css 应引用 var(--rail-w...) 作为第三列宽度');
  assert.ok(/\.shell\[data-rail="collapsed"\]\s*\{[^}]*grid-template-columns\s*:[^};]*\b6px\b/.test(css), '.shell[data-rail="collapsed"] 的 grid-template-columns 规则必须把右栏收到 6px');
});

test('index.html 含拖拽把手，带 role=separator', async () => {
  const html = (await get('/')).body;
  assert.ok(html.includes('class="rail-grip"'), '应有 .rail-grip 把手');
  assert.ok(/class="rail-grip"[^>]*role="separator"/.test(html), '把手应带 role="separator"');
});

test('rail.js 可访问且实现宽度持久化，脚本顺序排在 app.js 之后', async () => {
  const r = await get('/rail.js');
  assert.strictEqual(r.status, 200, '/rail.js 应 200');
  assert.ok(r.body.includes('tracer.railWidth'), 'rail.js 应使用 tracer.railWidth 持久化键');
  const html = (await get('/')).body;
  const idxApp = html.indexOf('src="/app.js"');
  const idxRail = html.indexOf('src="/rail.js"');
  assert.ok(idxApp >= 0, '应引用 app.js');
  assert.ok(idxRail >= 0, '应引用 rail.js');
  assert.ok(idxApp < idxRail, 'rail.js 必须排在 app.js 之后');
});

test('GAME_DIR 里所有美术目录与顶层立绘都能兜底到 tracer（白名单漏配守卫）', async () => {
  // tracer 的 Garden 跑的是 db-console 那份 farm.js，它引用的顶层立绘和各套目录图
  // 都物理住在 GAME_DIR。白名单漏掉哪一类，Garden 里就是一片 404——而 farm.js 的
  // onerror 会把破图静默换成 emoji，界面上根本看不出是服务端没给图，只会以为
  // 「美术就长这样」。
  //
  // 所以这里不硬编码目录名，而是现场枚举文件系统：GAME_DIR 下每个含 .webp 的子目录
  // 各取一张、外加所有顶层 .webp，逐个请求。农场新增一个美术目录或一张顶层立绘却
  // 没同步 server.js 的 GAME_DIRS / GAME_FILES，这条会立刻红——它是 server.js:64-66
  // 那句「加新美术目录要同步这里」注释的可执行版本。
  const gameDir = process.env.DOCS_PORTAL_GAME_DIR || path.join(__dirname, '..', 'skins', 'db-console');
  const entries = fs.readdirSync(gameDir, { withFileTypes: true });
  const targets = [];
  // 顶层立绘（hero/arena 之类）走 GAME_FILES 白名单
  for (const e of entries) {
    if (e.isFile() && /\.webp$/.test(e.name)) targets.push('/' + e.name);
  }
  // 子目录走 GAME_DIRS 前缀白名单；目录里现取第一张真实的图，不硬编码文件名
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const first = fs.readdirSync(path.join(gameDir, e.name)).filter((f) => /\.webp$/.test(f))[0];
    // 只认直接子级的 .webp，不递归：没有直接子 .webp 的目录这条不覆盖
    if (!first) continue;
    targets.push('/' + e.name + '/' + first);
  }
  assert.ok(targets.length >= 3, 'GAME_DIR 里应枚举到美术资源（枚举到 ' + targets.length + ' 个）');
  for (const p of targets) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p + ' 应能从 GAME_DIR 兜底服务');
    assert.strictEqual(r.headers['content-type'], 'image/webp',
      p + ' 的 content-type 应为 image/webp');
    assert.ok(r.bytes > 100, p + ' 不应为空（bytes=' + r.bytes + '）');
  }
});
