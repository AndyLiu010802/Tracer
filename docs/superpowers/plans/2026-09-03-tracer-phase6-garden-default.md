# Tracer 阶段 6：游戏移植进 Garden + Tracer 转正 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 键盘农场（含钓鱼/战斗/装备）以「共享一份源」的方式挂进 Tracer 的新分区 **Garden**（不复制、不 fork——两个皮肤加载同一份 farm.js）；`Ctrl+Alt+G` 一键隐藏 Garden（导航项消失、正停在游戏则跳回上一分区、持久化）；默认皮肤从 docs-portal 切成 tracer；桌面版托盘从 podmatrix 品牌换成 Tracer；README 更新。

**Architecture（共享一份源，关键）：** 游戏文件（farm.js/fishing.js/combat.js/equip.js/farm.css + fish/scenes 资源）**物理留在 `skins/db-console/`**（那是农场当前的开发地，另一个会话正在高强度迭代锻造/装备）。server.js 加一个「游戏资源从 GAME_DIR 兜底服务」的回退——当前皮肤目录里没有的游戏文件，从 `GAME_DIR`（=skins/db-console）服务。于是 db-console 照旧从自己目录服务（不变），tracer 请求 `/farm.js` 等就回退到 GAME_DIR。**本阶段零改动 db-console 任何文件**，那个并行会话继续在原地开发农场，Tracer 自动拿到最新版。localStorage 存档键 `dbconsole.farm.v3` 同源共享——一份农场进度，两皮肤通用。物理搬到中立 `games/` 目录（唯一会与并行会话冲突的一步）留到农场那边告一段落再做（本阶段不做）。

**Tech Stack:** 纯 Node 标准库 + 原生 DOM，ES5 皮肤 JS，`node --test`。

**Spec:** `docs/superpowers/specs/2026-09-02-tracer-skin-design.md`（游戏分区 Garden；`Ctrl+Alt+G` 一键隐藏：导航项消失、正停在游戏则跳回上一分区、隐藏状态持久化；默认皮肤切 tracer + server.js DEFAULTS 与 local.config.example.json 同步改）。

**上下文（给零背景的执行者）：**
- Tracer 是本地伪装工作台皮肤（`skins/tracer/`，零 npm 依赖纯 Node）。阶段 1-5 已交付七个分区里的六个（Inbox/Notes/Board/Project Map/Planner/Timeline/Insights）。
- **农场引擎契约**：`window.DBFarm = { mount(main, side), unmount() }`（定义在 skins/db-console/farm.js）。`mount(main, side)`：把游戏板渲染进 `main` 元素、把作物商店渲染进 `side` 元素，并装上点击监听。`unmount()`：清理。farm.js 在脚本加载时就 `boot()`——装上全局按键/点击监听（数按键喂农场，只记次数不记内容），从 localStorage `dbconsole.farm.v3` 读存档。它还 null-safe 地借用 `#rail-label`/`#definition` 放作物详情（没有就跳过）。
- **farm.js 自带 `Ctrl+Alt+G`**：绑成「切换伪装文案（keyspace 黑话 ↔ 农场文案）」，`document.addEventListener('keydown', onKeyDown, true)` 捕获阶段。**Tracer 要用 Ctrl+Alt+G 做 boss-key 隐藏 Garden**，所以 Tracer 的处理器必须在 farm.js 之前注册 + `stopImmediatePropagation` 抢先屏蔽 farm 的文案切换。农场自己 UI 里的 🌱 按钮仍可切文案，不受影响。
- **游戏脚本固定 URL**：`/fishing.js` `/combat.js` `/equip.js` `/farm.js` `/farm.css`，资源 `/fish/*.webp`（48 张）`/scenes/*.webp`（6 张）。db-console 的 index.html 就按这个顺序加载 fishing→combat→equip→farm。farm-data.js 未被加载（数据内联在 farm.js）。
- **farm.css 用引擎 CSS 变量**（--accent/--fg/--surface/--border/--muted/--radius/--font-mono），进 Tracer 自动主题化；少量硬编码灰色可接受。
- **装配 API**（`window.Tracer`）：`store`、`onShow(sec,fn)`、`currentSec()`、`show(sec)`。app.js 里有 `SECTIONS` 数组、`show()` 路由、导航点击/keydown 委托。
- 皮肤 JS 用 ES5，注释中文、界面英文、禁「novel/小说」。用 Write/Edit 写文件，写完查裸 NUL。
- **只 add 自己改的文件，绝不碰 skins/db-console/ 里任何文件**（那是并行会话的开发地）。冒烟/审查起 server 设 `DOCS_PORTAL_DATA_DIR` 到临时目录。

## 文件结构

```
server.js       + 游戏资源兜底服务（GAME_DIR 回退，只服务游戏文件白名单）
skins/tracer/
  index.html    + Garden 导航项 + #sec-garden 分区（shop 侧 + 游戏主区）+ 游戏脚本 + garden.js/css
  app.js        + SECTIONS 加 garden、boss-key Ctrl+Alt+G（隐藏 Garden，在 farm.js 前注册）
  garden.js     新：进 Garden 时 DBFarm.mount(gameMain, shopSide)、离开时 unmount
  garden.css    新：Garden 分区的 shop 侧 + 游戏主区两栏布局
local.config.example.json  skin 改 tracer
desktop/main.js  托盘品牌 podmatrix→Tracer、默认皮肤 db-console→tracer、favicon/tray 半月
README.md       更新皮肤表、默认皮肤、Garden 说明
```

---

### Task 1: server.js —— 游戏资源共享服务（GAME_DIR 兜底）

**Files:**
- Modify: `server.js`（加 GAME_DIR 常量 + 游戏文件白名单 + 皮肤静态资源回退）
- Test: `test/server.test.js`（追加）

- [ ] **Step 1: 写失败的测试**

在 `test/server.test.js` 末尾追加（注意该文件顶部已 `process.env.DOCS_PORTAL_SKIN = 'docs-portal'`，所以这些测试验证的是「docs-portal 皮肤下也能拿到游戏文件」，即回退生效）：

```js
test('游戏文件从 GAME_DIR 兜底服务（非 db-console 皮肤也能拿到）', async () => {
  // 当前皮肤是 docs-portal，它目录里没有 farm.js，应回退到 skins/db-console
  for (const p of ['/farm.js', '/fishing.js', '/combat.js', '/equip.js', '/farm.css']) {
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
```

- [ ] **Step 2: 跑红**

Run: `node --test test/server.test.js`
Expected: FAIL —— `/farm.js` 等在 docs-portal 下 404（还没有回退）。

- [ ] **Step 3: 实现**

`server.js` 改两处。

第一处，`const SKIN_DIR = ...` 附近加 GAME_DIR 常量与游戏文件白名单：

```js
// 游戏引擎（键盘农场+钓鱼+战斗+装备）物理住在 db-console 皮肤目录，
// 但作为「共享一份源」同时供 tracer 的 Garden 分区加载——当前皮肤目录里
// 没有的游戏文件，从这里兜底服务。这样两个皮肤跑的是同一份 farm.js，
// 农场那边的迭代 tracer 自动拿到，无需复制。GAME_DIR 可用环境变量覆盖，
// 将来把游戏搬到中立目录时只改这一行。
const GAME_DIR = process.env.DOCS_PORTAL_GAME_DIR || path.join(ROOT, 'skins', 'db-console');
const GAME_FILES = new Set([
  '/farm.js', '/fishing.js', '/combat.js', '/equip.js', '/farm-data.js', '/farm.css',
]);
function isGameAsset(pathname) {
  return GAME_FILES.has(pathname)
    || pathname.indexOf('/fish/') === 0 || pathname.indexOf('/scenes/') === 0;
}
```

第二处，`handleRequest` 里「皮肤静态资源」那段——现在是：

```js
  // 皮肤静态资源
  const skinFile = safeJoin(SKIN_DIR, pathname);
  if (skinFile && await serveFile(res, skinFile)) return;
```

改成先试皮肤目录、游戏文件再回退 GAME_DIR：

```js
  // 皮肤静态资源
  const skinFile = safeJoin(SKIN_DIR, pathname);
  if (skinFile && await serveFile(res, skinFile)) return;

  // 游戏资源兜底：当前皮肤没有、但属于游戏白名单的文件，从 GAME_DIR 服务。
  // 白名单挡住「tracer 意外拿到 db-console 伪装内容」，也挡路径穿越（safeJoin）。
  if (isGameAsset(pathname)) {
    const gameFile = safeJoin(GAME_DIR, pathname);
    if (gameFile && await serveFile(res, gameFile)) return;
  }
```

- [ ] **Step 4: 跑绿**

Run: `node --test test/server.test.js`（新增 3 条 + 原有）→ PASS。
Run: `node --test test/*.test.js` → 全绿。

- [ ] **Step 5: 无裸 NUL + Commit**

```bash
node -e "process.exit(require('fs').readFileSync('server.js').includes(0)?1:0)" && echo "no NUL"
git add server.js test/server.test.js
git commit -m "feat(server): 游戏资源共享服务——farm/fishing/combat/equip 从 GAME_DIR 兜底"
```

---

### Task 2: Tracer Garden 分区 + Ctrl+Alt+G boss-key 隐藏

**Files:**
- Modify: `skins/tracer/index.html`（Garden 导航项 + 分区 + 游戏脚本 + garden 脚本/样式）
- Modify: `skins/tracer/app.js`（SECTIONS 加 garden、boss-key）
- Create: `skins/tracer/garden.js`
- Create: `skins/tracer/garden.css`

- [ ] **Step 1: index.html —— Garden 导航项**

`skins/tracer/index.html` 的 `#nav-secs` 里，Insights 那个 `<a>` 之后加：

```html
      <a class="nav-item" data-sec="garden" role="tab" tabindex="0" id="nav-garden"><svg viewBox="0 0 16 16"><path d="M8 14V7M8 7C8 4 6 2 3 2c0 3 2 5 5 5M8 7c0-2.5 1.7-4.5 4.5-4.5C12.5 5 10.5 7 8 7"/></svg>Garden</a>
```

（芽图标：一株从下往上长的苗。）

- [ ] **Step 2: index.html —— Garden 分区（shop 侧 + 游戏主区）**

`#sec-insights` 那个 `</section>` 之后、`</main>` 之前加：

```html
    <section class="sec" id="sec-garden">
      <div class="garden-wrap">
        <aside class="garden-shop" id="garden-shop"></aside>
        <div class="garden-main" id="garden-main"></div>
      </div>
      <!-- farm.js 借这两个 id 放作物详情（null-safe，没有就跳过） -->
      <div id="rail-label" hidden></div>
      <div id="definition" hidden></div>
    </section>
```

- [ ] **Step 3: index.html —— 游戏脚本 + garden 脚本/样式**

`<link rel="stylesheet" href="/insights.css">` 之后加 `<link rel="stylesheet" href="/farm.css">` 和 `<link rel="stylesheet" href="/garden.css">`：

```html
<link rel="stylesheet" href="/farm.css">
<link rel="stylesheet" href="/garden.css">
```

body 末尾脚本：`<script src="/app.js"></script>` 之后、其余视图脚本之前，插入游戏引擎脚本（顺序必须 fishing→combat→equip→farm，且在 app.js 之后以保证 app.js 的 boss-key 先于 farm 的 onKeyDown 注册）；garden.js 放在最后（它用 window.DBFarm）：

```html
<!-- 共享游戏引擎：从 db-console 目录兜底服务（server GAME_DIR 回退）。
     必须在 app.js 之后（Tracer 的 Ctrl+Alt+G 先注册以屏蔽 farm 自带的文案切换），
     顺序 fishing→combat→equip→farm 与 db-console 一致。 -->
<script src="/fishing.js"></script>
<script src="/combat.js"></script>
<script src="/equip.js"></script>
<script src="/farm.js"></script>
```

（这几行加在现有 `<script src="/app.js"></script>` 之后、`<script src="/model.js">`…等视图脚本之前。注意 model.js 当前在 app.js 之前，视图脚本在 app.js 之后——把游戏脚本插在 app.js 与第一个视图脚本 inbox.js 之间。）

最后，所有视图脚本之后（`<script src="/insights.js"></script>` 之后）加：

```html
<script src="/garden.js"></script>
```

**执行提示**：动手前先 Read 当前 index.html 的脚本区，确认插入位置（app.js 后、inbox.js 前放游戏引擎；insights.js 后放 garden.js）。

- [ ] **Step 4: app.js —— SECTIONS 加 garden + boss-key**

`skins/tracer/app.js` 里 `var SECTIONS = [...]` 加 `'garden'`：

```js
  var SECTIONS = ['inbox', 'notes', 'board', 'map', 'planner', 'timeline', 'insights', 'garden'];
```

app.js 顶部（`show` 定义之后、游戏脚本尚未加载时就要注册 boss-key，所以放在 app.js 主体里即可——app.js 早于 farm.js 加载）加 Garden 隐藏逻辑：

```js
  // ---------- Garden boss-key ----------
  // Ctrl+Alt+G 一键隐藏 Garden：导航项消失、正停在游戏则跳回上一分区、持久化。
  // farm.js 也把 Ctrl+Alt+G 绑成「切换伪装文案」并在 document 捕获阶段监听；
  // 本处理器在 app.js 加载时注册（早于 farm.js），用 stopImmediatePropagation
  // 抢先屏蔽 farm 的文案切换，让这个键在 Tracer 里只做隐藏。
  var LS_GARDEN = 'tracer.gardenHidden';
  var gardenHidden = false;
  try { gardenHidden = localStorage.getItem(LS_GARDEN) === '1'; } catch (e) {}
  var lastNonGarden = 'board';

  function applyGardenHidden() {
    var nav = document.getElementById('nav-garden');
    if (nav) nav.hidden = gardenHidden;
    if (gardenHidden && current === 'garden') show(lastNonGarden);
  }

  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey && e.altKey && (e.code === 'KeyG' || e.key === 'g' || e.key === 'G'))) return;
    e.preventDefault();
    e.stopImmediatePropagation();   // 屏蔽 farm.js 的同键文案切换
    gardenHidden = !gardenHidden;
    try { localStorage.setItem(LS_GARDEN, gardenHidden ? '1' : '0'); } catch (e2) {}
    applyGardenHidden();
  }, true);   // 捕获阶段，且本处理器先于 farm 注册
```

在 `show(sec)` 函数里，记录最近的非 garden 分区（供隐藏时跳回）——找到 `current = sec;` 那一行，其后加：

```js
    if (sec !== 'garden') lastNonGarden = sec;
```

app.js 末尾 `show(initial || 'board')` 之后加一句应用初始隐藏态：

```js
  applyGardenHidden();
```

- [ ] **Step 5: garden.js**

新建 `skins/tracer/garden.js`：

```js
(function () {
  'use strict';
  var T = window.Tracer;
  var mounted = false;

  // 进 Garden 时把农场挂进来，离开时卸载。农场引擎（DBFarm）由共享的
  // farm.js 提供；main=游戏主区、side=作物商店。farm 自己吃全局按键喂农场，
  // 常驻计数与分区无关，这里只负责「可见时把它渲染出来」。
  function show() {
    if (!window.DBFarm) return;    // 游戏脚本没加载（理论不会）
    var main = document.getElementById('garden-main');
    var side = document.getElementById('garden-shop');
    if (!main || !side) return;
    if (mounted) window.DBFarm.unmount();
    window.DBFarm.mount(main, side);
    mounted = true;
  }

  // 切走时卸载（farm 的 unmount 会 save + 摘监听）。用 onShow 拿不到「离开」事件，
  // 所以监听导航点击：切到别的分区时若之前在 garden 就卸载。
  function maybeUnmount(toSec) {
    if (mounted && toSec !== 'garden') {
      window.DBFarm.unmount();
      mounted = false;
    }
  }

  T.onShow('garden', show);

  // 包一层 show 路由：Tracer.show 切分区时，先判断是否要卸载 garden。
  var origShow = T.show;
  T.show = function (sec) {
    maybeUnmount(sec);
    return origShow(sec);
  };
})();
```

**执行注意**：`T.show` 包装要确认 app.js 的导航点击委托调的是 `show`（app.js 内部局部函数）还是 `T.show`。app.js 内部导航用的是局部 `show`，`T.show` 是暴露给外部的同一函数引用。若 app.js 内部导航不经过 `T.show`，则 maybeUnmount 收不到内部切换——**改用 onShow 的对称方案**：给每个非 garden 分区也注册一个 onShow 钩子来卸载 garden。执行时先 Read app.js 确认 `T.show` 与内部 `show` 是否同一路径；若不是，改成：在 garden.js 里对所有其他分区 `['inbox','notes','board','map','planner','timeline','insights']` 各 `T.onShow(sec, function(){ maybeUnmount(sec); })`。这个对称方案更稳，**优先用它**：

```js
  // 更稳的卸载：给每个非 garden 分区挂一个卸载钩子（onShow 只在数据就绪后触发，
  // 但 garden 的卸载不依赖数据，直接判 mounted）。
  ['inbox', 'notes', 'board', 'map', 'planner', 'timeline', 'insights'].forEach(function (s) {
    T.onShow(s, function () { maybeUnmount(s); });
  });
```

用这个对称方案替换上面的 `T.show` 包装。

- [ ] **Step 6: garden.css**

新建 `skins/tracer/garden.css`：

```css
/* Tracer Garden：作物商店侧 + 游戏主区两栏。农场自身样式来自共享的 farm.css。 */
.garden-wrap { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 12px; height: calc(100vh - 90px); }
.garden-shop { overflow-y: auto; }
.garden-main { overflow-y: auto; min-width: 0; }
/* boss-key 隐藏导航项：.nav-item 有 display:flex，会盖过 UA 的 [hidden]{display:none}，
   必须用更高特异性的属性选择器把它压回去，否则 nav.hidden=true 不生效。 */
.nav-item[hidden] { display: none; }
```

- [ ] **Step 7: 检查 + 冒烟 + Commit**

```bash
node --check skins/tracer/app.js skins/tracer/garden.js
node -e "process.exit(require('fs').readFileSync('skins/tracer/garden.js').includes(0)||require('fs').readFileSync('skins/tracer/app.js').includes(0)?1:0)" && echo "no NUL"
node --test test/*.test.js
```

冒烟（临时 DATA_DIR）：`DOCS_PORTAL_DATA_DIR=$(mktemp -d) DOCS_PORTAL_SKIN=tracer DOCS_PORTAL_PORT=8110 node server.js`，curl 确认 `/garden.js` `/garden.css` `/farm.js`（兜底）`/farm.css`（兜底）均 200；index.html 含 Garden 导航项、游戏脚本、garden 脚本。若环境有 Playwright，实测：切到 Garden 看农场板+商店渲染、敲键盘看地块生长、Ctrl+Alt+G 隐藏 Garden（导航项消失、跳回上一分区）再按恢复、确认 farm 的文案没被 Ctrl+Alt+G 切换（被屏蔽）。**记住 workspace.json 的 tracer 存档和 dbconsole.farm.v3 农场存档不同，farm 用后者。** 验完杀进程、删临时目录。

```bash
git add skins/tracer/index.html skins/tracer/app.js skins/tracer/garden.js skins/tracer/garden.css
git commit -m "feat(tracer): Garden 分区——共享农场引擎挂载、Ctrl+Alt+G boss-key 隐藏"
```

---

### Task 3: 默认皮肤切 tracer + 桌面版托盘品牌 + README

**Files:**
- Modify: `server.js`（DEFAULTS.skin）
- Modify: `local.config.example.json`（skin）
- Modify: `dev/verify.js`（若它依赖默认皮肤，显式设 docs-portal）
- Modify: `desktop/main.js`（托盘品牌 + 默认皮肤 + favicon/tray 半月）
- Modify: `README.md`

- [ ] **Step 1: 默认皮肤切 tracer**

`server.js` 的 `DEFAULTS`：`skin: 'docs-portal'` → `skin: 'tracer'`。
`local.config.example.json`：`"skin": "docs-portal"` → `"skin": "tracer"`。

**注意**：改默认皮肤后，任何没显式设 `DOCS_PORTAL_SKIN` 也没 local.config.json 的地方会变成 tracer。测试文件都显式设了皮肤（`test/server.test.js` 设 docs-portal 等），不受影响。**但 `dev/verify.js` 要确认**——先 Read 它，若它假设默认是 docs-portal（起 server 不设 SKIN），在它起 server 的地方显式加 `DOCS_PORTAL_SKIN=docs-portal`（verify 验证的是代理链路，与 docs-portal 绑定）。若它本就显式设了皮肤，不动。

- [ ] **Step 2: 桌面版托盘品牌**

`desktop/main.js` 改（先 Read 全文确认行号）：
- `process.env.DOCS_PORTAL_SKIN = process.env.DOCS_PORTAL_SKIN || 'db-console';` → `|| 'tracer';`（桌面版默认也用 tracer，农场现在在 Garden 分区里）。
- `BrowserWindow` 的 `title: 'podmatrix | Supabase'` → `title: 'Tracer — Engineering'`。
- `tray.setToolTip('podmatrix')` → `tray.setToolTip('Tracer')`。
- 托盘图标：`assets/tray.png` 是 Supabase 绿点。**不改图片文件**（可能没有替换素材），但把 tooltip 和标题改掉即可；若想换图标留 TODO 注释。托盘菜单文案「打开面板」「退出」保持中文（原样）。
- 注释里提到「农场就挂在它的 Queues 分区」的地方更新为「Garden 分区」。

（桌面版 desktop/ 是隔离的 Electron 壳，改它不影响网页版；不需要 `npm install` 就能改代码，测试 `node --test`（desktop/ 下）不涉及这些字符串。）

- [ ] **Step 3: README 更新**

`README.md`：
- 皮肤表加一行 `tracer`（Linear 深色工作台，七分区真实可用 + Garden 游戏分区，默认皮肤）。
- 「换皮肤」小节说明默认已是 tracer；db-console/docs-portal 仍可切。
- 加一段 Garden：农场从 db-console 共享而来（同一份 farm.js、同一份存档），`Ctrl+Alt+G` 一键隐藏。
- 保持中文、不出现「novel/小说」。

- [ ] **Step 4: 全量回归 + 手工验证**

```bash
node --test test/*.test.js          # 全绿
node dev/verify.js                  # 端到端 OK（若 Step 1 给它加了显式皮肤）
node --check server.js desktop/main.js
```

手工：双击 start.bat 或 `node server.js`（不带 SKIN 环境变量）→ 应默认打开 **Tracer**（不再是 docs-portal）。切到 Garden 玩农场；Ctrl+Alt+G 隐藏。切 db-console（改 local.config.json 或环境变量）确认农场在 Queues 仍正常、且与 Tracer Garden 是同一份存档。

- [ ] **Step 5: Commit**

```bash
git add server.js local.config.example.json dev/verify.js desktop/main.js README.md
git commit -m "feat(tracer): 默认皮肤切 tracer + 桌面版品牌换 Tracer + README 更新"
```

---

## 阶段边界

本计划**不含**（后续）：`Ctrl+K` 命令面板（阶段 7）。

## 已知偏差与提醒

- **零改动 db-console**：游戏文件物理留在 skins/db-console/，两皮肤共享。物理搬到中立 `games/` 目录（会与并行会话冲突）留到农场那边告一段落再做。
- **Insights 的键盘热力图/番茄钟**接农场数据留到后续小任务——农场把按键计数存在 localStorage `dbconsole.farm.v3`，Insights 读它需要跨模块约定，本阶段不做，Garden 落地后另议。
- **农场在 Tracer 里可能显示 keyspace 黑话文案**（farm 默认伪装态）——农场自己 UI 的 🌱 按钮可切成农场文案；Ctrl+Alt+G 在 Tracer 里被改成隐藏 Garden，不再切文案。若默认文案观感违和，是农场侧的一行默认值改动，等能碰 farm.js 时再调，本阶段不动。
- **farm.css 少量硬编码灰色**在 Tracer 深色下可接受；大部分走引擎变量自动主题化。
- 游戏脚本在每次 Tracer 加载时就 boot（装全局按键监听、开始计数）——与 db-console 同款「常驻计数」设计，即使不开 Garden，敲字也在喂农场（伪装工具「工作即种地」的原意）。Ctrl+Alt+G 是视觉隐藏，不卸载引擎。
- 冒烟/审查起 server 设 `DOCS_PORTAL_DATA_DIR` 到临时目录。农场存档是 localStorage（`dbconsole.farm.v3`），不是 workspace.json。
