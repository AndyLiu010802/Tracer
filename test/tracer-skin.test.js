'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

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

test('tracer 九个分区（含 Garden 与收藏星球）与静态资源齐全', async () => {
  const html = (await get('/')).body;
  for (const sec of ['inbox', 'notes', 'board', 'map', 'planner', 'timeline', 'insights', 'garden', 'planets']) {
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
  assert.ok(html.includes('id="garden-home-root"'), '项目花园应保留自己的挂载点');
  for (const id of ['garden-leisure-wrapper', 'garden-back-home', 'garden-main', 'garden-shop']) {
    assert.ok(!html.includes('id="' + id + '"'), '旧休闲区挂载点应移除：' + id);
  }
});

test('Tracer project garden has no legacy leisure navigation or farm mount', async () => {
  const controller = (await get('/garden.js')).body;
  const view = (await get('/garden-home-view.js')).body;
  assert.ok(controller.includes('TracerGardenHomeView'), 'the new garden remains connected');
  assert.doesNotMatch(controller, /\bDBFarm\b|open-leisure|garden-leisure-wrapper/);
  assert.doesNotMatch(view, /open-leisure/);
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

test('Tracer loads the new garden modules in dependency order without legacy game engines', async () => {
  const html = (await get('/')).body;
  for (const name of ['fishing', 'combat', 'equip', 'mining', 'magic', 'farm', 'farm-data']) {
    assert.ok(!html.includes('src="/' + name + '.js"'), 'must not load ' + name);
  }
  assert.ok(!html.includes('href="/farm.css"'), 'must not load legacy game styles');
  const order = ['task-garden', 'model', 'workspace-sync', 'app', 'task-garden-actions', 'garden-plant-atlas', 'garden-plant-art', 'garden-wildflower-atlas', 'garden-wildflower-motion', 'garden-plant-animation', 'garden-harvest-model', 'pet-model', 'garden-world-view', 'garden-home-view', 'garden-planets-view', 'garden'];
  let previous = -1;
  for (const name of order) {
    const index = html.indexOf('src="/' + name + '.js"');
    assert.ok(index > previous, name + ' must be present after its dependencies');
    previous = index;
  }
  // Every referenced module must remain available after disabling the old
  // cross-skin fallback; this catches accidental removal of new garden code.
  for (const m of html.matchAll(/src="(\/[a-z0-9-]+\.js)"/g)) {
    const r = await get(m[1]);
    assert.strictEqual(r.status, 200, m[1] + ' is referenced by index.html and must be served');
    assert.ok(r.bytes > 100, m[1] + ' must not be empty');
  }
});

test('四段调色板都定义了 accent', async () => {
  const css = (await get('/skin.css')).body;
  for (const ph of ['dawn', 'day', 'dusk', 'night']) {
    const m = new RegExp('data-phase="' + ph + '"\\s*\\]\\s*\\{([^}]*)\\}').exec(css);
    assert.ok(m && /--accent\s*:/.test(m[1]), '时段 ' + ph + ' 必须定义 accent');
  }
});

test('编码路径穿越不能通过旧游戏路径取得 db-console 的文件', async () => {
  // Keep both separator encodings covered even when the legacy game routes are
  // disabled: decoded traversal must not expose another skin's source files.
  for (const p of ['/fish/..%2fcontent.js', '/fish/..%5ccontent.js',
    '/scenes/..%2fcontent.js']) {
    const r = await get(p);
    assert.ok(!/podmatrix|keyspace|supabase/i.test(r.body),
      p + ' 不得泄漏 db-console 伪装内容（status=' + r.status + '）');
    assert.strictEqual(r.status, 404, p + ' 应 404');
  }
});

test('Tracer no longer serves legacy game scripts or styles through the shared fallback', async () => {
  for (const p of ['/farm.js', '/farm.css', '/farm-data.js', '/fishing.js', '/combat.js', '/equip.js', '/mining.js', '/magic.js']) {
    const r = await get(p);
    assert.strictEqual(r.status, 404, p + ' must not be exposed from Tracer');
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

test('Tracer does not expose retired game artwork', async () => {
  for (const p of ['/fish/carp.webp', '/scenes/temp_lake.webp', '/hero.webp', '/arena.webp', '/mobs/deadlock.webp', '/mats/lock_fang.webp', '/equip/wpn1.webp']) {
    assert.strictEqual((await get(p)).status, 404, p);
  }
});

test('new garden backdrop and plant companion animation art remain available', async () => {
  for (const file of ['spring-garden-v1.png', 'wildflower-v2.png', 'wildflower-normal-idle-v1.png', 'wildflower-shiny-celebrate-v1.png']) {
    const r = await get('/garden-art/' + file);
    assert.strictEqual(r.status, 200, file + ' must remain available');
    assert.strictEqual(r.headers['content-type'], 'image/png');
    assert.ok(r.bytes > 10000, file + ' must contain the actual illustration');
  }
});
