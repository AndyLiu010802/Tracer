# Tracer 皮肤 · 阶段 1：壳 + 主题引擎 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建起 `skins/tracer/` 皮肤的可运行骨架：布局壳、日月轮回主题引擎、`/api/store` 服务端存储、`model.js` 纯函数模块，阅读面板正常挂载。

**Architecture:** 皮肤自包含（引擎只认 `#aside-slot` + 9 个 CSS 变量的契约）；`model.js` 用仓库现成的 UMD 模式让浏览器和 `node --test` 共用；存储是 server.js 上一个皮肤无关的通用 JSON 端点，临时文件 + rename 原子写、留 `.bak` 防损坏。

**Tech Stack:** 纯 Node 标准库（零 npm 依赖），原生 DOM/SVG，`node --test`。

**Spec:** `docs/superpowers/specs/2026-09-02-tracer-skin-design.md`

**上下文（给零背景的执行者）：**
- 这个仓库是本地「摸鱼阅读器」：server.js 服务一套伪装皮肤页面，并把小说站代理进右栏小窗。皮肤在 `skins/<name>/`，由 `DOCS_PORTAL_SKIN` 环境变量或 `local.config.json` 选择，静态文件从皮肤目录按根路径服务（`/skin.css` → `skins/tracer/skin.css`）。
- 引擎与皮肤的契约：皮肤提供 `<div id="aside-slot">` 挂载点（可带 `data-panel-*` 文案覆盖）并在 `:root` 定义 `--fg --bg --muted --border --accent --surface --font-body --font-mono --radius`。`test/server.test.js` 里有一条测试扫描每套皮肤的 skin.css，漏定义任何变量都会挂。
- 测试文件各自独立进程运行，先设环境变量再 `require('../server.js')`。
- 全部代码注释用中文、界面文案用英文；任何文件里不得出现「novel/小说」或小说站域名（有测试断言）。
- 皮肤 JS 走 ES5 风格（`var` + `function`），与 `skins/db-console/fishing.js` 一致。

---

### Task 1: `/api/store/<name>` 服务端存储端点

**Files:**
- Modify: `server.js`（在 `/api/state` 路由后加新路由；在文件顶部常量区加 DATA_DIR）
- Modify: `.gitignore`（加 `data/`）
- Test: `test/store.test.js`（新建）

- [ ] **Step 1: 写失败的测试**

新建 `test/store.test.js`：

```js
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

test.after(() => new Promise((resolve) => server.close(resolve)));

function req(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(origin + pathname, { method }, (res) => {
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
  const r = await req('PUT', '/api/store/x%2F..%2Fy', '{}');
  assert.strictEqual(r.status, 404);
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/store.test.js`
Expected: FAIL —— 全部请求 404（路由不存在）。

- [ ] **Step 3: 实现端点**

`server.js` 改两处。

第一处，`const STATE_FILE = ...` 之后加：

```js
// 皮肤无关的通用 JSON 存储。皮肤用它放自己的持久数据（如 tracer 的 workspace），
// 引擎不关心内容结构。名字白名单挡住路径注入；测试用 DATA_DIR 环境变量改落点。
const DATA_DIR = process.env.DOCS_PORTAL_DATA_DIR || path.join(ROOT, 'data');
const STORE_NAME_RE = /^[a-z][a-z0-9-]{0,31}$/;

async function readStore(name) {
  const file = path.join(DATA_DIR, name + '.json');
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    // 主文件缺失或损坏都走这里：能读到上一版就用上一版，否则视为没写过。
    try {
      return JSON.parse(await fsp.readFile(file + '.bak', 'utf8'));
    } catch {
      return null;
    }
  }
}

async function writeStore(name, text) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, name + '.json');
  // 先把上一版留成 .bak，再临时文件 + rename 原子替换：
  // 任何一步中断都不会同时毁掉两份。
  try { await fsp.copyFile(file, file + '.bak'); } catch {}
  await fsp.writeFile(file + '.tmp', text, 'utf8');
  await fsp.rename(file + '.tmp', file);
}
```

第二处，`handleRequest` 里 `/api/state` 分支之后（`// 小窗组件` 注释之前）加：

```js
  // 皮肤持久数据
  if (pathname.startsWith('/api/store/')) {
    const name = pathname.slice('/api/store/'.length);
    if (!STORE_NAME_RE.test(name)) {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"ok":false}');
      return;
    }
    // sendBeacon 只能发 POST，所以 POST 与 PUT 同义
    if (req.method === 'PUT' || req.method === 'POST') {
      try {
        const body = await readBody(req, 4 * 1024 * 1024);
        JSON.parse(body); // 只验证是合法 JSON，结构由皮肤自理
        await writeStore(name, body);
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' }).end('{"ok":false}');
      }
      return;
    }
    const data = await readStore(name);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(data === null ? 'null' : JSON.stringify(data));
    return;
  }
```

`.gitignore` 末尾加一行：

```
data/
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/store.test.js`
Expected: PASS，7 项全过。

- [ ] **Step 5: 跑全量测试确认没碰坏别的**

Run: `node --test test/*.test.js`
Expected: 全过（原 131 项 + 新 7 项）。

> **执行后记（审查修订）**：本任务落地后经并发实测审查，存储逻辑最终抽到了
> `lib/store.js`：同名写入串行化 + 唯一临时文件名（并发防损坏）、`.bak` 只备份可解析
> 的上一版（损坏不连锁）、超限 body 413、写盘失败 500 并打 stderr、非 GET/PUT/POST
> 回 405。后续任务以仓库实际代码为准，本任务代码块仅是初版。

- [ ] **Step 6: Commit**

```bash
git add server.js .gitignore test/store.test.js
git commit -m "feat(server): /api/store 皮肤无关 JSON 存储（原子写 + .bak 回退）"
```

---

### Task 2: `model.js` 纯函数模块（日月算法 + 工作区骨架）

**Files:**
- Create: `skins/tracer/model.js`
- Test: `test/tracer-model.test.js`（新建）

- [ ] **Step 1: 写失败的测试**

新建 `test/tracer-model.test.js`：

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const M = require('../skins/tracer/model.js');

test('dayPhase 四段边界', () => {
  const cases = [
    [0, 'night'], [4, 'night'], [5, 'dawn'], [8, 'dawn'],
    [9, 'day'], [16, 'day'], [17, 'dusk'], [20, 'dusk'],
    [21, 'night'], [23, 'night'],
  ];
  for (const [h, want] of cases) {
    assert.strictEqual(M.dayPhase(h), want, h + ' 点应是 ' + want);
  }
});

test('moonPhase 以 2000-01-06 新月为锚', () => {
  const epoch = Date.UTC(2000, 0, 6, 18, 14);
  assert.ok(M.moonPhase(new Date(epoch)) < 0.001, '锚点应是新月 (≈0)');
  const halfCycle = epoch + M.SYNODIC / 2 * 86400000;
  assert.ok(Math.abs(M.moonPhase(new Date(halfCycle)) - 0.5) < 0.001, '半个朔望月后应是满月 (≈0.5)');
  const fullCycle = epoch + M.SYNODIC * 86400000;
  assert.ok(M.moonPhase(new Date(fullCycle)) < 0.001, '整周期后回到新月');
});

test('moonPhase 对任何日期都落在 [0,1)', () => {
  for (const d of ['1970-03-01', '1999-12-31', '2026-09-02', '2077-01-01']) {
    const t = M.moonPhase(new Date(d));
    assert.ok(t >= 0 && t < 1, d + ' → ' + t);
  }
});

test('moonPathD 两端与中点', () => {
  assert.strictEqual(M.moonPathD(0, 6), '', '0 全暗，无亮面路径');
  assert.ok(M.moonPathD(1, 6).includes('A 6 6'), '1 是整圆');
  // 半月：明暗界线是过圆心的直线，椭圆横向半径为 0
  const half = M.moonPathD(0.5, 6);
  const rx = parseFloat(half.split('A')[2].trim().split(' ')[0]);
  assert.ok(Math.abs(rx) < 1e-9, '半月的界线 rx 应为 0，实为 ' + rx);
});

test('moonPathD 盈亏两侧的界线弧向相反', () => {
  // 界线弧（第二段 A）的 sweep 位：未过半 0，过半 1
  const sweepOf = (d) => d.split('A')[2].trim().split(/\s+/)[4];
  assert.strictEqual(sweepOf(M.moonPathD(0.25, 6)), '0');
  assert.strictEqual(sweepOf(M.moonPathD(0.75, 6)), '1');
});

test('uid 唯一且只含小写字母数字', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const id = M.uid();
    assert.match(id, /^[a-z0-9]+$/);
    assert.ok(!seen.has(id), '重复 id: ' + id);
    seen.add(id);
  }
});

test('emptyWorkspace 的形状', () => {
  const ws = M.emptyWorkspace();
  assert.deepStrictEqual(ws, {
    projects: [], tasks: [], notes: [], inbox: [],
    meta: { seqCounter: 0, rev: 0 },
  });
  // 每次调用都是新对象，不能共享引用
  assert.notStrictEqual(M.emptyWorkspace().tasks, ws.tasks);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/tracer-model.test.js`
Expected: FAIL —— `Cannot find module '../skins/tracer/model.js'`。

- [ ] **Step 3: 实现 model.js**

新建 `skins/tracer/model.js`（UMD 模式抄 `skins/db-console/fishing.js`）：

```js
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Model = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 日月轮回 ----------
  // 时段边界与 skin.css 的四段调色板一一对应：
  // 拂晓 5-9 琥珀 / 白昼 9-17 鎏金 / 黄昏 17-21 绛紫 / 夜 21-5 靛银。
  function dayPhase(hour) {
    if (hour >= 5 && hour < 9) return 'dawn';
    if (hour >= 9 && hour < 17) return 'day';
    if (hour >= 17 && hour < 21) return 'dusk';
    return 'night';
  }

  // 月相：返回周期位置 0..1（0=新月，0.5=满月）。
  // 锚点取 2000-01-06 18:14 UTC 的新月，朔望月 29.530588853 天。
  // 界面用途误差远小于一天，足够。
  var SYNODIC = 29.530588853;
  var NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);
  function moonPhase(date) {
    var days = (date.getTime() - NEW_MOON_EPOCH) / 86400000;
    var t = (days % SYNODIC) / SYNODIC;
    return t < 0 ? t + 1 : t;
  }

  // 月相/进度图标的亮面路径：pct 0..1，圆心 (0,0) 半径 r。
  // 0 返回空串（调用方只画描边圆），1 返回整圆。
  // 其余：亮面固定从右缘长出——右缘外弧 + 明暗界线椭圆弧围出闭合区域。
  // 界线横向半径 rx = |cos(π·pct)|·r：pct=0.5 时界线是过圆心的直线。
  function moonPathD(pct, r) {
    if (pct <= 0) return '';
    if (pct >= 1) {
      return 'M 0 ' + (-r) + ' A ' + r + ' ' + r + ' 0 1 1 0 ' + r
        + ' A ' + r + ' ' + r + ' 0 1 1 0 ' + (-r) + ' Z';
    }
    var k = Math.cos(Math.PI * pct);
    var rx = Math.abs(k) * r;
    var sweep = k > 0 ? 0 : 1; // 未过半界线凹向右，过半凸向左
    return 'M 0 ' + (-r)
      + ' A ' + r + ' ' + r + ' 0 0 1 0 ' + r
      + ' A ' + rx + ' ' + r + ' 0 0 ' + sweep + ' 0 ' + (-r) + ' Z';
  }

  // 周期位置 → 被照亮比例（进度图标直接吃这个值）
  function moonIllum(t) {
    return 0.5 * (1 - Math.cos(2 * Math.PI * t));
  }

  // ---------- 工作区 ----------
  // 时间戳 + 随机尾巴：单机单人足够，且按创建时间天然可排序。
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function emptyWorkspace() {
    return {
      projects: [], tasks: [], notes: [], inbox: [],
      meta: { seqCounter: 0, rev: 0 },
    };
  }

  return {
    SYNODIC: SYNODIC,
    dayPhase: dayPhase, moonPhase: moonPhase,
    moonPathD: moonPathD, moonIllum: moonIllum,
    uid: uid, emptyWorkspace: emptyWorkspace,
  };
});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/tracer-model.test.js`
Expected: PASS，7 项全过。

- [ ] **Step 5: Commit**

```bash
git add skins/tracer/model.js test/tracer-model.test.js
git commit -m "feat(tracer): model.js 纯函数模块——四段时相、月相算法、月相图标路径"
```

> **执行后记（审查修订）**：上面代码块里 `moonPathD` 的 `k = Math.cos(Math.PI * pct)`
> 是错的——画出的亮面面积等于 (1-cos(π·pct))/2 而非 pct，峰值偏差 10.5 个百分点。
> 实测验证的正确公式是 `k = 1 - 2 * pct`（明暗界线半短轴 = r·|1−2·pct|）。同时：
> 全局名从 `root.Model` 改为 `root.TracerModel`（避撞）；`moonPhase` 用 floor 取模 +
> `t >= 1` 精确保险（原 `%` 式在整周期边界过不了自己的测试）；moonPathD 测试改为
> 弧展平 + 鞋带面积的行为断言。后续任务以仓库实际代码为准。

---

### Task 3: 布局壳 `index.html` + 主题 `skin.css`

**Files:**
- Create: `skins/tracer/index.html`
- Create: `skins/tracer/skin.css`
- Test: `test/tracer-skin.test.js`（新建）

- [ ] **Step 1: 写失败的测试**

新建 `test/tracer-skin.test.js`：

```js
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
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
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

test('tracer 七个分区与静态资源齐全', async () => {
  const html = (await get('/')).body;
  for (const sec of ['inbox', 'notes', 'board', 'map', 'planner', 'timeline', 'insights']) {
    assert.ok(html.includes('data-sec="' + sec + '"'), '导航应有 ' + sec);
  }
  // Task 4 建好 app.js 后会把它加进这个列表
  for (const p of ['/skin.css', '/model.js']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p + ' 应可访问');
    assert.ok(r.body.length > 100, p + ' 不应为空');
  }
});

test('四段调色板都定义了 accent', async () => {
  const css = (await get('/skin.css')).body;
  for (const ph of ['dawn', 'day', 'dusk', 'night']) {
    assert.ok(css.includes('data-phase="' + ph + '"'), '缺少时段 ' + ph);
  }
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/tracer-skin.test.js`
Expected: FAIL —— 首页 500/404（皮肤目录里没有 index.html）。

- [ ] **Step 3: 写 index.html**

新建 `skins/tracer/index.html`：

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- 标签页伪装：内部工程工作台。favicon 是半月，呼应日月轮回主题。 -->
<title>Tracer — Engineering</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='6.5' fill='none' stroke='%238b93a8' stroke-width='1.6'/%3E%3Cpath d='M8 1.5 A6.5 6.5 0 0 1 8 14.5 Z' fill='%238b93a8'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/skin.css">
</head>
<body>

<header class="top">
  <div class="top-left">
    <span class="mark" aria-hidden="true">
      <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 1.5 A6.5 6.5 0 0 1 8 14.5 Z" fill="currentColor"/></svg>
    </span>
    <span class="crumb crumb-strong">Tracer</span>
    <span class="crumb-sep">/</span>
    <span class="crumb">Engineering</span>
  </div>
  <div class="top-mid"></div>
  <div class="top-right">
    <span class="save-dot" id="save-dot" title="Synced"></span>
    <span class="sundial" id="sundial"></span>
    <span class="clock" id="clock"></span>
    <span class="avatar" title="Signed in">AL</span>
  </div>
</header>

<div class="shell">

  <nav class="side" aria-label="Sections">
    <div class="nav-group" id="nav-secs">
      <a class="nav-item" data-sec="inbox"><svg viewBox="0 0 16 16"><path d="M2 9.5 4 3h8l2 6.5V13H2zM2 9.5h3.5l1 2h3l1-2H14"/></svg>Inbox</a>
      <a class="nav-item" data-sec="notes"><svg viewBox="0 0 16 16"><path d="M3.5 2h7L13 4.5V14h-9.5zM10 2v3h3"/><path d="M5.5 8H11M5.5 10.5H9"/></svg>Notes</a>
      <a class="nav-item" data-sec="board"><svg viewBox="0 0 16 16"><path d="M2.5 2.5h3.4v11H2.5zM6.9 2.5h3.4v7H6.9zM11.3 2.5h2.2v9h-2.2z"/></svg>Board</a>
      <a class="nav-item" data-sec="map"><svg viewBox="0 0 16 16"><circle cx="3.5" cy="8" r="1.8"/><circle cx="11.5" cy="3.5" r="1.8"/><circle cx="11.5" cy="12.5" r="1.8"/><path d="M5.2 7.2 9.8 4.3M5.2 8.8l4.6 2.9"/></svg>Project Map</a>
      <a class="nav-item" data-sec="planner"><svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/></svg>Planner</a>
      <a class="nav-item" data-sec="timeline"><svg viewBox="0 0 16 16"><path d="M2 4h7M5 8h8M3 12h6"/><path d="M8 1.5v13" stroke-dasharray="1.5 2"/></svg>Timeline</a>
      <a class="nav-item" data-sec="insights"><svg viewBox="0 0 16 16"><path d="M2.5 13.5V9M6.2 13.5V5M9.9 13.5V7.5M13.5 13.5V3"/></svg>Insights</a>
    </div>
    <div class="nav-label">Projects</div>
    <!-- 阶段 2 起由 app.js 渲染项目清单 -->
    <div class="nav-group" id="proj-list"></div>
  </nav>

  <main class="main" id="main">
    <section class="sec" id="sec-inbox">
      <header class="sec-head"><h1>Inbox</h1><span class="sec-sub">Capture first, sort later</span></header>
      <div class="empty" id="empty-inbox"><span class="empty-moon"></span>Inbox zero. Nothing waiting.</div>
    </section>
    <section class="sec" id="sec-notes">
      <header class="sec-head"><h1>Notes</h1><span class="sec-sub">Pages and drafts</span></header>
      <div class="empty"><span class="empty-moon"></span>No pages yet.</div>
    </section>
    <section class="sec" id="sec-board">
      <header class="sec-head"><h1>Board</h1><span class="sec-sub">Todo · In Progress · In Review · Done</span></header>
      <div class="empty"><span class="empty-moon"></span>No tasks on the board.</div>
    </section>
    <section class="sec" id="sec-map">
      <header class="sec-head"><h1>Project Map</h1><span class="sec-sub">Workspace at a glance</span></header>
      <div class="empty"><span class="empty-moon"></span>The map is dark. Add projects to light it up.</div>
    </section>
    <section class="sec" id="sec-planner">
      <header class="sec-head"><h1>Planner</h1><span class="sec-sub">This week</span></header>
      <div class="empty"><span class="empty-moon"></span>Nothing scheduled this week.</div>
    </section>
    <section class="sec" id="sec-timeline">
      <header class="sec-head"><h1>Timeline</h1><span class="sec-sub">Quarter view</span></header>
      <div class="empty"><span class="empty-moon"></span>No project ranges set.</div>
    </section>
    <section class="sec" id="sec-insights">
      <header class="sec-head"><h1>Insights</h1><span class="sec-sub">Work rhythms</span></header>
      <div class="empty"><span class="empty-moon"></span>Metrics build up as you work.</div>
    </section>
  </main>

  <aside class="rail">
    <!-- 小窗挂载点。在工作台语境下，面板定位为「参考资料」。 -->
    <div class="rail-block" id="aside-slot"
         data-panel-tag="ref"
         data-panel-title="Reference"
         data-panel-meta="cached &middot; utf8"></div>
  </aside>

</div>

<script src="/model.js"></script>
<script src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: 写 skin.css**

新建 `skins/tracer/skin.css`：

```css
/* Tracer —— Linear 风深色工作台，主题「日月轮回」。
   底色四时恒定（伪装依赖深色），随真实时刻轮转的是 accent 与顶部天光：
   拂晓 5-9 琥珀 / 白昼 9-17 鎏金 / 黄昏 17-21 绛紫 / 夜 21-5 靛银。
   时段由 app.js 写在 <html data-phase="..."> 上，缺省按夜。 */

:root {
  /* 引擎契约变量：小窗只通过这 9 个取色取字体 */
  --fg: #d6d9de;
  --bg: #0e0f11;
  --muted: #6e7178;
  --border: #23252a;
  --accent: #7c8fe8;
  --surface: #16171a;
  --font-body: 'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-mono: ui-monospace, 'Cascadia Code', Consolas, monospace;
  --radius: 6px;
  /* 皮肤私有 */
  --panel: #131417;
  --accent-soft: rgba(124, 143, 232, .13);
  --sky: rgba(124, 143, 232, .06);
}
html[data-phase="dawn"]  { --accent: #e8975a; --accent-soft: rgba(232, 151, 90, .13); --sky: rgba(232, 151, 90, .07); }
html[data-phase="day"]   { --accent: #d4b45f; --accent-soft: rgba(212, 180, 95, .12); --sky: rgba(212, 180, 95, .055); }
html[data-phase="dusk"]  { --accent: #b07ce8; --accent-soft: rgba(176, 124, 232, .13); --sky: rgba(176, 124, 232, .07); }
html[data-phase="night"] { --accent: #7c8fe8; --accent-soft: rgba(124, 143, 232, .13); --sky: rgba(124, 143, 232, .06); }

* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--fg);
  background: var(--bg);
  overflow: hidden;
}

/* 天光：一层从顶部渗下来的极淡色。渐变本身不能过渡，
   所以用「纯色 + 固定渐变蒙版」——background-color 可以 2s 过渡。 */
body::before {
  content: '';
  position: fixed;
  inset: 0 0 auto 0;
  height: 240px;
  pointer-events: none;
  z-index: 0;
  background-color: var(--sky);
  -webkit-mask-image: linear-gradient(180deg, #000, transparent);
  mask-image: linear-gradient(180deg, #000, transparent);
  transition: background-color 2s ease;
}

/* ---------- 顶栏 ---------- */
.top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 14px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel) 88%, transparent);
}
.top-left { display: flex; align-items: center; gap: 8px; }
.top-mid { flex: 1; }
.top-right { display: flex; align-items: center; gap: 12px; }
.mark { display: inline-flex; width: 17px; height: 17px; color: var(--accent); transition: color 2s ease; }
.mark svg { width: 100%; height: 100%; }
.crumb { color: var(--muted); }
.crumb-strong { color: var(--fg); font-weight: 600; letter-spacing: .2px; }
.crumb-sep { color: var(--border); }

.save-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #4fbf82;
}
.save-dot.saving { background: var(--muted); }
.save-dot.err { background: #e5b567; }

.sundial { display: inline-flex; width: 64px; height: 16px; }
.sundial svg { width: 100%; height: 100%; }
.clock { color: var(--muted); font-family: var(--font-mono); font-size: 11px; }

.avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--accent-soft); color: var(--accent);
  font-size: 10px; font-weight: 700;
  transition: background-color 2s ease, color 2s ease;
}

/* ---------- 三栏骨架 ---------- */
.shell {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 216px minmax(0, 1fr) 384px;
  height: calc(100% - 44px);
}

/* ---------- 左侧导航 ---------- */
.side {
  padding: 10px 8px;
  border-right: 1px solid var(--border);
  overflow-y: auto;
}
.nav-group { display: flex; flex-direction: column; gap: 1px; }
.nav-item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 8px;
  border-radius: var(--radius);
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}
.nav-item svg {
  width: 15px; height: 15px; flex: none;
  fill: none; stroke: currentColor; stroke-width: 1.3;
  stroke-linecap: round; stroke-linejoin: round;
}
.nav-item:hover { background: var(--surface); color: var(--fg); }
.nav-item.active {
  background: var(--accent-soft);
  color: var(--fg);
}
.nav-item.active svg { color: var(--accent); }
.nav-label {
  margin: 14px 8px 4px;
  font-size: 10px; font-weight: 600; letter-spacing: .8px;
  text-transform: uppercase;
  color: var(--muted);
}

/* ---------- 主区与分区 ---------- */
.main { overflow-y: auto; padding: 18px 22px; }
.sec { display: none; }
.sec.active { display: block; }
.sec-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }
.sec-head h1 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: .2px; }
.sec-sub { color: var(--muted); font-size: 12px; }

/* 空状态：一枚描边月亮 + 一句话。低调但精致。 */
.empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 64px 0;
  color: var(--muted);
}
.empty-moon {
  width: 26px; height: 26px;
  border: 1.5px solid var(--border);
  border-radius: 50%;
  position: relative;
  overflow: hidden;
}
.empty-moon::after {
  content: '';
  position: absolute; inset: 0;
  background: var(--accent-soft);
  clip-path: inset(0 50% 0 0);
  transition: background-color 2s ease;
}

/* ---------- 右栏 ---------- */
.rail {
  border-left: 1px solid var(--border);
  padding: 10px;
  overflow-y: auto;
  background: var(--panel);
}
.rail-block { min-height: 120px; }
```

- [ ] **Step 5: 跑测试**

Run: `node --test test/tracer-skin.test.js`
Expected: PASS，3 项全过。

Run: `node --test test/server.test.js`
Expected: PASS —— 特别是「每套皮肤都定义小窗消费的全部 CSS 变量」现在会扫到 tracer，9 个变量缺一不可。

- [ ] **Step 6: Commit**

```bash
git add skins/tracer/index.html skins/tracer/skin.css test/tracer-skin.test.js
git commit -m "feat(tracer): 布局壳与四段调色板——顶栏/导航/七分区/阅读面板挂载"
```

> **执行后记（审查修订）**：上面代码块漏了三件事，已在后续提交修正——
> ① `.rail` 必须 `display:flex;flex-direction:column` 且 `#aside-slot{flex:1;min-height:0;display:flex}`
> （reader 停靠态靠 `flex:1` 撑高，否则塌成 320px；两套旧皮肤都有这行，新皮肤照此为契约，
> `test/server.test.js` 已加扫描）；② `:root` 要 `color-scheme: dark`（否则原生滚动条是浅色）；
> ③ Board 的导航项与分区在静态 HTML 就带 `active`（app.js 挂了也不至于中列全空）。
> 遗留到阶段收尾的视觉项：--muted 提到 4.5:1 对比度、`.crumb-sep` 用 --muted 而非 --border、
> `.nav-item.active` 补 2s 时段过渡、nav 键盘可达性（role/tabindex/keydown）、<1100px 的
> grid 收窄。后续任务以仓库实际代码为准。

---

### Task 4: `app.js` —— 分区路由、晨昏流转、日晷、存储客户端

**Files:**
- Create: `skins/tracer/app.js`

- [ ] **Step 1: 实现 app.js**

新建 `skins/tracer/app.js`：

```js
(function () {
  'use strict';

  // Tracer 的装配层：分区路由、日月轮回主题钟、存储客户端。
  // 各分区的功能模块（board.js 等）在后续阶段挂到 window.Tracer 上。
  var M = window.TracerModel;

  // ---------- 分区路由 ----------
  var SECTIONS = ['inbox', 'notes', 'board', 'map', 'planner', 'timeline', 'insights'];
  var LS_SEC = 'tracer.sec';
  var current = null;

  function show(sec) {
    if (SECTIONS.indexOf(sec) < 0) sec = 'board';
    current = sec;
    document.querySelectorAll('.nav-item[data-sec]').forEach(function (a) {
      a.classList.toggle('active', a.dataset.sec === sec);
    });
    document.querySelectorAll('.sec').forEach(function (s) {
      s.classList.toggle('active', s.id === 'sec-' + sec);
    });
    try { localStorage.setItem(LS_SEC, sec); } catch (e) {}
    // 分区模块的进场钩子（后续阶段用：切进来时重绘）
    var hooks = window.Tracer.onShow[sec];
    if (hooks) hooks.forEach(function (fn) { fn(); });
  }

  document.getElementById('nav-secs').addEventListener('click', function (e) {
    var a = e.target.closest('.nav-item[data-sec]');
    if (a) show(a.dataset.sec);
  });

  // ---------- 晨昏流转 ----------
  // 每分钟对时：把时段写在 <html data-phase>，CSS 变量随之切换（天光带 2s 过渡）。
  // 顶栏日晷：白天太阳沿弧线走（6:00-18:00 映射弧上 0→1），夜里换真实月相。
  var ARC = { x0: 5, y0: 13.5, cx: 32, cy: -7, x1: 59, y1: 13.5 };

  function arcPoint(t) {
    // 二次贝塞尔 B(t)，与日晷里画的 Q 弧同一条线
    var u = 1 - t;
    return {
      x: u * u * ARC.x0 + 2 * u * t * ARC.cx + t * t * ARC.x1,
      y: u * u * ARC.y0 + 2 * u * t * ARC.cy + t * t * ARC.y1,
    };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function renderSundial(now) {
    var h = now.getHours() + now.getMinutes() / 60;
    var daytime = h >= 6 && h < 18;
    var svg = '<svg viewBox="0 0 64 16">'
      + '<path d="M ' + ARC.x0 + ' ' + ARC.y0 + ' Q ' + ARC.cx + ' ' + ARC.cy
      + ' ' + ARC.x1 + ' ' + ARC.y1 + '" fill="none" stroke="var(--border)" stroke-width="1"/>';
    if (daytime) {
      var p = arcPoint((h - 6) / 12);
      svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1)
        + '" r="2.6" fill="var(--accent)"/>';
    } else {
      // 夜段跨午夜：18 点在弧起点，次日 6 点在弧终点
      var t = h >= 18 ? (h - 18) / 12 : (h + 6) / 12;
      var q = arcPoint(t);
      var phase = M.moonPhase(now);
      var d = M.moonPathD(M.moonIllum(phase), 3.2);
      svg += '<g transform="translate(' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ')">'
        + '<circle r="3.2" fill="none" stroke="var(--accent)" stroke-width="1"/>'
        + (d ? '<path d="' + d + '" fill="var(--accent)"/>' : '')
        + '</g>';
    }
    svg += '</svg>';
    document.getElementById('sundial').innerHTML = svg;
    document.getElementById('clock').textContent =
      pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  }

  function applyTheme() {
    var now = new Date();
    document.documentElement.setAttribute('data-phase', M.dayPhase(now.getHours()));
    renderSundial(now);
  }

  // ---------- 存储客户端 ----------
  // 改动 → touch() → 500ms 防抖 → PUT /api/store/workspace。
  // 失败：圆点变橙、内存数据保留，下一次 touch 自然重试。
  var STORE_URL = '/api/store/workspace';
  var store = { data: null, timer: 0, dirty: false, lost: false };
  var dot = document.getElementById('save-dot');

  function setDot(cls, title) {
    dot.className = 'save-dot' + (cls ? ' ' + cls : '');
    dot.title = title;
  }

  function save() {
    store.dirty = false;
    setDot('saving', 'Saving…');
    store.data.meta.rev++;
    fetch(STORE_URL, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(store.data),
      keepalive: true,
    }).then(function (r) {
      if (r.status === 413) {
        // 超限重试只会无限循环，停下来亮灯等人处理
        setDot('err', 'Too large — not saved');
        return;
      }
      if (!r.ok) throw new Error('put failed');
      setDot('', 'Synced');
    }).catch(function () {
      store.dirty = true; // 数据还在内存里，下次 touch 重试
      setDot('err', 'Offline — will retry');
    });
  }

  function touch() {
    // 加载失败时锁死保存：拿空工作区顶上再保存，会覆盖服务端仅存的一份
    if (store.lost || !store.data) return;
    store.dirty = true;
    clearTimeout(store.timer);
    store.timer = setTimeout(save, 500);
  }

  window.addEventListener('beforeunload', function () {
    if (!store.dirty || !store.data) return;
    // sendBeacon 只能 POST，端点两个动词等效
    navigator.sendBeacon(STORE_URL, JSON.stringify(store.data));
  });

  // ---------- 装配 ----------
  // 后续分区模块的接入点：ready 后拿 store.data 画界面，改完调 touch()。
  window.Tracer = {
    store: store,
    touch: touch,
    show: show,
    onShow: {},           // {sec: [fn]}：切到该分区时的重绘钩子
    ready: fetch(STORE_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('load failed ' + r.status);
        return r.json();
      })
      .then(function (data) {
        // 字面 null（HTTP 200）= 确实从没写过，才允许用空工作区起步
        store.data = data || M.emptyWorkspace();
        return store.data;
      })
      .catch(function () {
        // 读不到已有数据绝不能拿空工作区顶上——下次保存会把服务端
        // 仅存的一份覆盖掉。锁死保存（见 touch），亮灯等人处理。
        store.lost = true;
        setDot('err', 'Load failed — saving disabled');
        return null;
      }),
  };

  applyTheme();
  setInterval(applyTheme, 60000);

  var saved = null;
  try { saved = localStorage.getItem(LS_SEC); } catch (e) {}
  show(saved || 'board');
})();
```

- [ ] **Step 2: 把 /app.js 纳入静态资源测试**

`test/tracer-skin.test.js` 里这一行：

```js
  for (const p of ['/skin.css', '/model.js']) {
```

改为：

```js
  for (const p of ['/skin.css', '/model.js', '/app.js']) {
```

（上面那行「Task 4 建好 app.js 后…」的注释顺手删掉。）

Run: `node --test test/tracer-skin.test.js`
Expected: PASS，3 项全过（`/app.js` 现在可访问了）。

- [ ] **Step 3: 手工验证（唯一需要肉眼的步骤）**

PowerShell 里：

```powershell
$env:DOCS_PORTAL_SKIN='tracer'; node server.js
```

浏览器开 `http://127.0.0.1:8080/`，核对清单：

1. 深色工作台完整呈现：顶栏（半月标记 + Tracer / Engineering + 绿色保存点 + 日晷 + 时钟 + AL 头像）、左侧七个分区、中间空状态、右栏阅读面板可加载网页，**且面板从上到下撑满右栏**（塌成 320px 说明 rail flex 契约破了）。若首屏能看到 accent 从夜色扫到当前时段的 2 秒动画，把 `data-phase` 的初始设置挪到 `<head>` 内联脚本。
2. 点击各分区能切换，刷新后停留在上次的分区。
3. `<html>` 上有 `data-phase` 且与当前时段相符；改系统时间或在控制台跑
   `document.documentElement.setAttribute('data-phase','dawn')` 能看到 accent 变琥珀、顶部天光 2 秒渐变。
4. 白天日晷上是太阳圆点，位置与时刻相称；夜里是月相（控制台跑
   `new Date().getHours()` 对照）。
5. DevTools Network 里 `GET /api/store/workspace` 返回 `null`（首次）且无报错；控制台执行
   `Tracer.store.data.inbox.push({id:'x'}); Tracer.touch()` 后 500ms 内发出 PUT，保存点闪灰后回绿；仓库 `data/workspace.json` 出现。
6. 页面源码（Ctrl+U）搜不到 novel / 小说。

- [ ] **Step 4: 跑全量测试**

Run: `node --test test/*.test.js`
Expected: 全过。

- [ ] **Step 5: Commit**

```bash
git add skins/tracer/app.js test/tracer-skin.test.js
git commit -m "feat(tracer): app.js——分区路由、晨昏流转主题钟、日晷月相、存储客户端"
```

> **执行后记（审查修订）**：上面代码块经探针审查后修正了五处——① ready 补工作区形状
> 校验（缺 meta 的合法 JSON 会让 `meta.rev++` 在 fetch 前同步抛错、保存静默停摆）；
> ② save() 加 `inflight` 防护（单次 PUT >500ms 时并发乱序会旧盖新）；③ 常规保存去掉
> `keepalive: true`（Fetch 规范 64KiB 上限，与离线不可分辨），beacon 返回值接住；
> ④ `onShow` 从裸对象改为注册函数（晚加载模块补触发当前分区）+ `currentSec()`；
> ⑤ 钩子 try/catch。遗留：413 注释与实为「无自动重试」不符（Task 5 处理）、rev 语义是
> 保存尝试数而非版本号、ARC/arcPoint 宜迁入 model.js 换测试覆盖（阶段 2）。
> 后续任务以仓库实际代码为准。

---

### Task 5: 收尾核对

**Files:** `skins/tracer/skin.css`、`skins/tracer/index.html`（视觉收尾小改）

- [ ] **Step 0: 视觉收尾（Task 3 审查遗留项打包一次提交）**

1. `--muted` 从 `#6e7178` 提到 `#7a7d85`（对比度 3.9:1 → 4.7:1）。
2. `.crumb-sep` 文字色改用 `var(--muted)`（`--border` 当文字色几乎不可见）。
3. `.nav-item.active` 补 `transition: background-color 2s ease, color 2s ease`，与 mark/avatar 的时段过渡一致。
4. 导航项键盘可达：`<a>` 加 `role="tab" tabindex="0"`，app.js 的事件委托里接 `keydown`（Enter/Space 触发同 click）。
5. `@media (max-width: 1100px) { .shell { grid-template-columns: 216px minmax(0,1fr) 320px; } }` 兜底小窗口。
6. `test/server.test.js` 的 rail 契约正则收紧为 `/#aside-slot[^{}]*\{[^}]*flex\s*:\s*1/`（现写法 `[^}]*` 可跨 `{`，注释里提到 #aside-slot 也会假阳性）。
7. app.js 主题钟对齐分钟边界（`setTimeout(60000 - Date.now() % 60000)` 后转 interval）+ `visibilitychange` 回前台立即 `applyTheme()`（顶栏时钟慢一分钟对伪装是破绽）。
8. 413 分支的注释改实话或加 `store.tooLarge` 锁（现注释称「停下来」，实测下次 touch 仍会重发超限 body）。
9. 手工验证时确认首屏是否有靛蓝→当前时段的 2 秒扫色；有则把 `data-phase` 初始化挪进 `<head>` 内联脚本（一行：按当前小时设 data-phase）。

提交：`polish(tracer): 对比度、分隔符、时段过渡一致性、键盘可达、小窗口兜底`

- [ ] **Step 1: 全量回归**

Run: `node --test test/*.test.js`
Expected: 全过（131 原有 + store 相关 + 7 model + 3 skin，具体数字以当时套件为准）。

Run: `node dev/verify.js`
Expected: 端到端链路 OK（verify 基于 docs-portal，与本阶段无冲突，跑它是确认引擎没被碰坏）。

- [ ] **Step 2: 确认工作区干净、提交历史成形**

```bash
git status --short   # 应无未跟踪残留（data/ 已被忽略）
git log --oneline -4 # 应看到本计划的 4 个提交
```

---

## 阶段 2 规划输入（终审移交清单）

阶段 1 终审通过（收口后 170/170 + verify 全绿）。两条 Important 已在「阶段 1.5」收口提交处理：
坏档 409 可分辨（服务端 `store-corrupt` → 409，客户端走 lost）、onShow 钩子等工作区就绪。
写阶段 2 计划时纳入：

1. `Tracer.ready` 契约已定死：成功兑现工作区对象；失败兑现 null 且 `store.lost=true`；
   onShow 钩子只在工作区就绪后触发（lost 不触发，分区保持静态空状态）。
2. 提取 `phaseIcon(pct, r)` 成品组件与 `ARC`/`arcPoint` 进 model.js（Map/Insights 复用，
   顺带吃测试覆盖）；日晷重建时的 accent 瞬切（2s 过渡不同步）可一并处理。
3. 组件层语义色令牌：save-dot 的 `#4fbf82`/`#e5b567` 硬编码；优先级 chip、状态列头
   需要成套语义色，先提变量。
4. `model.js` 加 id→对象索引 helper（Board/Planner/Map 都要按 id 查，别每视图一份 O(n)）。
5. `meta.rev` 是「保存尝试计数」不是版本号（PUT 前自增、失败也增）；多标签页冲突检测
   需要服务端参与的真版本号。
6. nav 的 ARIA 半成品：要么补全 tablist/tabpanel/aria-selected，要么退回朴素语义；
   决定后再加 PROJECTS 列表项。顶栏 `+ New` 占位。
7. `index.html` 内联 dayPhase 阈值与 model.js 重复无守护——tracer-skin 测试可抠出内联
   脚本对 0..23 逐时比对 `M.dayPhase`。空状态 `id="empty-inbox"` 孤例，统一或删除。
8. 卸载兜底的 sendBeacon 有 64KiB 上限：阶段 2/3 note 正文变大后，把兜底改到
   `visibilitychange → hidden` 时走一次正常 fetch 保存。
9. onShow 的立即补触发与 runHooks 的 try/catch 行为已统一（收口提交）；新分区模块
   （board.js/inbox.js）只需 `Tracer.onShow(sec, render)` 一行，无需自查数据就绪。
10. 「导航项与分区数量一致」测试依赖静态 HTML；阶段 6 加 Garden 时两边一起加。

## 阶段边界

本计划**不含**（属后续阶段，勿顺手实现）：Board/Inbox 的数据操作与拖拽（阶段 2）、Notes 编辑器（阶段 3）、Planner/Timeline（阶段 4）、Map/Insights 视图（阶段 5）、游戏移植与 `Ctrl+Alt+G`、默认皮肤切换、README 更新（阶段 6）、`Ctrl+K`（阶段 7）。阶段 1 里七个分区显示的空状态即为完成态。
