# Tracer 阶段 5：Project Map + Insights 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project Map 分区成为脑图树（workspace 根 → 项目 → 任务叶，从左向右自动布局，SVG 连线，分支可折叠，画布可平移，节点带月相完成度）；Insights 分区成为全真数据仪表盘（统计卡片 + 每周完成柱状图 + 任务状态条形列表，全部由 workspace 实时算）。

**Architecture:** 树布局与统计聚合是 `model.js` 的纯函数（可单测——布局坐标、周聚合是易错点）；视图 `map.js`/`insights.js` 通过 `Tracer.onShow` 注册；Map 用手写 SVG + pointer 平移，节点点击复用 `Tracer.openTask`；Insights 用手写 SVG 图表（单色 accent + 墨色文字，直接标注，无分类配色，天然无障碍）。样式各自 `map.css`/`insights.css`。

**Tech Stack:** 纯 Node 标准库 + 原生 DOM/SVG，ES5 皮肤 JS，`node --test`。

**Spec:** `docs/superpowers/specs/2026-09-02-tracer-skin-design.md`（Project Map：脑图树，workspace 根→项目→任务叶，左→右自动布局，SVG 连线，分支折叠，画布平移，节点显示完成度，点任务节点弹详情；Insights：全真数据仪表盘，键盘热力图/番茄钟等——但见下「数据源说明」）。

**数据源说明（重要）：** spec 的 Insights 列了「键盘热力图（复用农场按键计数）」和「番茄钟轮数」——这两项的数据源是农场游戏，农场要到**阶段 6** 才移植进 Tracer。**本阶段 Insights 只做 workspace 已有真实数据能支撑的部分**：任务统计卡片、每周完成柱状图、任务状态分布、笔记/项目计数。键盘热力图与番茄钟留一块占位卡「Unlocks with Garden」，阶段 6 游戏落地后再接数据。这是有意的范围裁剪，不是遗漏。

**上下文（给零背景的执行者）：**
- Tracer 是本地伪装工作台皮肤（`skins/tracer/`，零 npm 依赖纯 Node）。阶段 1-4 已交付（壳+主题+存储、Board+Inbox+项目、Notes、Planner+Timeline）。
- **数据模型**：`store.data` = `{projects:[{id,name,color,status,start?,end?}], tasks:[{id,seq,projectId,title,status(todo/doing/review/done),priority,scheduled,due,order,createdAt,doneAt}], notes:[{...,updatedAt}], inbox:[], meta}`。`doneAt` 是任务标 done 时的 `Date.now()` 时间戳（number）或 null。
- **装配 API**（`window.Tracer`）：`store.data`、`touch()`、`onShow(sec,fn)`、`currentSec()`、`ready`、`ui:{modal,confirm,dragList}`、`openTask(id, after)`（打开任务编辑弹层，after 是可选的编辑后回调）。
- model：`window.TracerModel`（esc、findProject、projectProgress、moonPathD/moonIllum（月相图标路径）、todayISO/weekStart/addDays/toISO 等日期函数）。
- 皮肤 JS 用 ES5（`var`/`function`），注释中文、界面英文、禁「novel/小说」。用 Write/Edit 写文件，写完查裸 NUL。新脚本挂 index.html 末尾已有脚本之后。
- **只 add 自己的文件**，工作区有其他会话脏文件别碰。**冒烟/审查起 server 务必设 `DOCS_PORTAL_DATA_DIR` 到临时目录**，别写演示用 data/workspace.json。

## 文件结构

```
skins/tracer/
  model.js     + mapLayout（树布局，纯函数）+ weeklyCompletions/statusCounts（统计聚合），扩充导出
  map.js       新：脑图树 SVG + 平移 + 折叠 + 点节点开任务
  map.css      新
  insights.js  新：统计卡片 + 每周柱状图 + 状态条形列表（手写 SVG）
  insights.css 新
  index.html   + link 两个 css、挂两个 js
```

---

### Task 1: model.js —— mapLayout（树布局）+ 统计聚合

**Files:**
- Modify: `skins/tracer/model.js`（在排期查询之后、`return {` 之前加；导出补键）
- Test: `test/tracer-model.test.js`（追加）

- [ ] **Step 1: 写失败的测试**

在 `test/tracer-model.test.js` 末尾追加：

```js
// ---------- 阶段 5：Map 布局与统计 ----------

test('mapLayout 空 workspace 只有 root', () => {
  const ws = M.emptyWorkspace();
  const g = M.mapLayout(ws, []);
  assert.strictEqual(g.nodes.length, 1);
  assert.strictEqual(g.nodes[0].id, '__root');
  assert.strictEqual(g.nodes[0].kind, 'root');
  assert.strictEqual(g.edges.length, 0);
});

test('mapLayout 项目+任务：root→项目→任务，坐标分层', () => {
  const ws = M.emptyWorkspace();
  const p = M.addProject(ws, { name: 'P' });
  const a = M.addTask(ws, { title: 'a', projectId: p.id });
  const b = M.addTask(ws, { title: 'b', projectId: p.id });
  const g = M.mapLayout(ws, []);
  const root = g.nodes.filter((n) => n.kind === 'root')[0];
  const proj = g.nodes.filter((n) => n.kind === 'project')[0];
  const tasks = g.nodes.filter((n) => n.kind === 'task');
  assert.strictEqual(tasks.length, 2);
  // x 分层：root < project < task
  assert.ok(root.x < proj.x && proj.x < tasks[0].x);
  // 项目 y 居中于其任务
  assert.ok(Math.abs(proj.y - (tasks[0].y + tasks[1].y) / 2) < 1e-9);
  // 边：root→proj，proj→每个 task
  assert.ok(g.edges.some((e) => e[0] === '__root' && e[1] === p.id));
  assert.ok(g.edges.some((e) => e[0] === p.id && e[1] === a.id));
  assert.ok(g.edges.some((e) => e[0] === p.id && e[1] === b.id));
});

test('mapLayout 折叠的项目不展开任务', () => {
  const ws = M.emptyWorkspace();
  const p = M.addProject(ws, { name: 'P' });
  M.addTask(ws, { title: 'a', projectId: p.id });
  const g = M.mapLayout(ws, [p.id]); // 折叠 p
  assert.strictEqual(g.nodes.filter((n) => n.kind === 'task').length, 0);
  const proj = g.nodes.filter((n) => n.kind === 'project')[0];
  assert.strictEqual(proj.collapsed, true);
});

test('mapLayout 项目节点带完成度 pct', () => {
  const ws = M.emptyWorkspace();
  const p = M.addProject(ws, { name: 'P' });
  const a = M.addTask(ws, { title: 'a', projectId: p.id });
  M.addTask(ws, { title: 'b', projectId: p.id });
  M.moveTask(ws, a.id, 'done', null);
  const g = M.mapLayout(ws, []);
  const proj = g.nodes.filter((n) => n.kind === 'project')[0];
  assert.ok(Math.abs(proj.pct - 0.5) < 1e-9);
  assert.strictEqual(proj.count, 2);
});

test('mapLayout 无项目的任务归入 Unassigned 分支', () => {
  const ws = M.emptyWorkspace();
  M.addTask(ws, { title: 'loose' }); // 无 projectId
  const g = M.mapLayout(ws, []);
  const un = g.nodes.filter((n) => n.id === '__unassigned')[0];
  assert.ok(un, '应有 Unassigned 分支');
  assert.strictEqual(un.count, 1);
  assert.ok(g.edges.some((e) => e[0] === '__root' && e[1] === '__unassigned'));
});

test('statusCounts 统计四状态', () => {
  const ws = M.emptyWorkspace();
  const a = M.addTask(ws, { title: 'a' });
  const b = M.addTask(ws, { title: 'b' });
  const c = M.addTask(ws, { title: 'c' });
  M.moveTask(ws, a.id, 'doing', null);
  M.moveTask(ws, b.id, 'done', null);
  const sc = M.statusCounts(ws);
  assert.deepStrictEqual(sc, { todo: 1, doing: 1, review: 0, done: 1 });
});

test('weeklyCompletions 按 doneAt 落周计数', () => {
  const ws = M.emptyWorkspace();
  const a = M.addTask(ws, { title: 'a' });
  const b = M.addTask(ws, { title: 'b' });
  M.moveTask(ws, a.id, 'done', null);
  M.moveTask(ws, b.id, 'done', null);
  // 两个都在本周完成
  const wc = M.weeklyCompletions(ws, 4);
  assert.strictEqual(wc.length, 4);
  // 最后一格是本周，应含 2 个
  assert.strictEqual(wc[wc.length - 1].count, 2);
  // 每格有 weekStart 字段（ISO）
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(wc[0].weekStart));
  // 未完成的不计
  const c = M.addTask(ws, { title: 'c' });
  const wc2 = M.weeklyCompletions(ws, 4);
  assert.strictEqual(wc2[wc2.length - 1].count, 2, '未完成的 c 不计入');
});
```

- [ ] **Step 2: 跑红**

Run: `node --test test/tracer-model.test.js`
Expected: FAIL —— `M.mapLayout is not a function` 等。

- [ ] **Step 3: 实现**

在 `skins/tracer/model.js` 的 `unscheduledTasks` 之后、`return {` 之前插入：

```js
  // ---------- Project Map 树布局 ----------
  // 从左向右三层：workspace 根 → 项目 → 任务叶。叶子按出现顺序纵向排队，
  // 每个内部节点纵坐标居中于其子节点（经典 tidy-tree 的最简版）。
  // collapsedIds 里的项目当作叶子（不展开任务）。返回 {nodes, edges, width, height}。
  var MAP_ROW = 34, MAP_COL = 210, MAP_OX = 24, MAP_OY = 24;

  function mapLayout(ws, collapsedIds) {
    var collapsed = {};
    (collapsedIds || []).forEach(function (id) { collapsed[id] = true; });
    var nodes = [], edges = [];
    var slot = 0;            // 下一个叶子行
    var projYs = [];

    function branch(pid, label, color, tasks) {
      var done = 0;
      tasks.forEach(function (t) { if (t.status === 'done') done++; });
      var node = {
        id: pid, kind: 'project', label: label, color: color,
        x: MAP_OX + MAP_COL, count: tasks.length,
        pct: tasks.length ? done / tasks.length : 0,
        collapsed: !!collapsed[pid],
      };
      if (collapsed[pid] || tasks.length === 0) {
        node.y = MAP_OY + slot * MAP_ROW; slot++;
      } else {
        var ys = [];
        tasks.forEach(function (t) {
          var tn = {
            id: t.id, kind: 'task', label: t.title, seq: t.seq, status: t.status,
            x: MAP_OX + MAP_COL * 2, y: MAP_OY + slot * MAP_ROW,
          };
          nodes.push(tn); edges.push([pid, t.id]); ys.push(tn.y); slot++;
        });
        var sum = 0; ys.forEach(function (y) { sum += y; });
        node.y = sum / ys.length;
      }
      nodes.push(node); edges.push(['__root', pid]); projYs.push(node.y);
    }

    ws.projects.forEach(function (p) {
      branch(p.id, p.name, p.color, ws.tasks.filter(function (t) { return t.projectId === p.id; }));
    });
    var loose = ws.tasks.filter(function (t) { return !t.projectId; });
    if (loose.length) branch('__unassigned', 'Unassigned', '#7a7d85', loose);

    var rsum = 0; projYs.forEach(function (y) { rsum += y; });
    var root = {
      id: '__root', kind: 'root', label: 'Workspace',
      x: MAP_OX, y: projYs.length ? rsum / projYs.length : MAP_OY,
    };
    nodes.push(root);
    var height = Math.max(MAP_OY + slot * MAP_ROW, MAP_OY + MAP_ROW) + MAP_OY;
    return { nodes: nodes, edges: edges, width: MAP_OX + MAP_COL * 2 + 200, height: height };
  }

  // ---------- Insights 聚合 ----------
  function statusCounts(ws) {
    var c = { todo: 0, doing: 0, review: 0, done: 0 };
    ws.tasks.forEach(function (t) { if (c[t.status] !== undefined) c[t.status]++; });
    return c;
  }
  // 最近 nWeeks 周（含本周），每周完成（doneAt 落在该周）的任务数。
  function weeklyCompletions(ws, nWeeks) {
    var out = [];
    var anchor = todayISO();
    for (var i = nWeeks - 1; i >= 0; i--) {
      var ws0 = weekStart(addDays(anchor, -i * 7));
      var ws1 = addDays(ws0, 7);
      var count = 0;
      ws.tasks.forEach(function (t) {
        if (!t.doneAt) return;
        var d = toISO(new Date(t.doneAt));
        if (d >= ws0 && d < ws1) count++;   // ISO 日期串可直接字典序比较
      });
      out.push({ weekStart: ws0, count: count });
    }
    return out;
  }
```

然后在 `return {` 对象里，`unscheduledTasks: unscheduledTasks,` 之后加：

```js
    mapLayout: mapLayout, statusCounts: statusCounts, weeklyCompletions: weeklyCompletions,
```

- [ ] **Step 4: 跑绿**

Run: `node --test test/tracer-model.test.js`（原有 + 新增 7 条）→ PASS。
Run: `node --test test/*.test.js` → 全绿。

- [ ] **Step 5: 无裸 NUL + Commit**

```bash
node -e "process.exit(require('fs').readFileSync('skins/tracer/model.js').includes(0)?1:0)" && echo "no NUL"
git add skins/tracer/model.js test/tracer-model.test.js
git commit -m "feat(tracer): model.js 脑图树布局 + Insights 统计聚合（状态/每周完成）"
```

---

### Task 2: Project Map 视图（SVG 脑图树 + 平移 + 折叠）

**Files:**
- Create: `skins/tracer/map.js`
- Create: `skins/tracer/map.css`
- Modify: `skins/tracer/index.html`（link map.css；挂 map.js）

- [ ] **Step 1: map.js**

新建 `skins/tracer/map.js`：

```js
(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-map');
  var collapsed = [];        // 折叠的项目 id
  var panX = 0, panY = 0;    // 画布平移

  // 节点尺寸
  var NW = 168, NH = 26;

  function esc(s) { return M.esc(s); }

  function nodeSvg(n) {
    if (n.kind === 'root') {
      return '<g class="mn mn-root" transform="translate(' + n.x + ',' + (n.y - NH / 2) + ')">'
        + '<rect width="120" height="' + NH + '" rx="7"/>'
        + '<text x="12" y="' + (NH / 2 + 4) + '">◆ ' + esc(n.label) + '</text></g>';
    }
    if (n.kind === 'project') {
      // 月相完成度图标
      var d = M.moonPathD(M.moonIllum(n.pct), 6);
      var moon = '<g transform="translate(' + (NW - 20) + ',' + (NH / 2) + ')">'
        + '<circle r="6" fill="none" stroke="' + n.color + '" stroke-width="1"/>'
        + (d ? '<path d="' + d + '" fill="' + n.color + '"/>' : '') + '</g>';
      var caret = n.count ? '<text class="mn-caret" data-toggle="' + n.id + '" x="10" y="' + (NH / 2 + 4) + '">'
        + (n.collapsed ? '▸' : '▾') + '</text>' : '';
      return '<g class="mn mn-proj" transform="translate(' + n.x + ',' + (n.y - NH / 2) + ')">'
        + '<rect width="' + NW + '" height="' + NH + '" rx="6" style="stroke:' + n.color + '"/>'
        + caret
        + '<text x="' + (n.count ? 24 : 12) + '" y="' + (NH / 2 + 4) + '">' + esc(n.label) + '</text>'
        + moon + '</g>';
    }
    // task
    var dotColor = n.status === 'done' ? '#4fbf82' : n.status === 'doing' ? '#e5b567' : 'var(--muted)';
    return '<g class="mn mn-task" data-open="' + n.id + '" transform="translate(' + n.x + ',' + (n.y - NH / 2) + ')">'
      + '<rect width="' + NW + '" height="' + NH + '" rx="6"/>'
      + '<circle cx="12" cy="' + (NH / 2) + '" r="3.5" fill="' + dotColor + '"/>'
      + '<text x="24" y="' + (NH / 2 + 4) + '">' + esc(n.label) + '</text></g>';
  }

  function edgeSvg(g, e) {
    var from = null, to = null;
    g.nodes.forEach(function (n) { if (n.id === e[0]) from = n; if (n.id === e[1]) to = n; });
    if (!from || !to) return '';
    var x1 = from.x + (from.kind === 'root' ? 120 : NW), y1 = from.y;
    var x2 = to.x, y2 = to.y;
    var mx = (x1 + x2) / 2;
    return '<path class="me" d="M ' + x1 + ' ' + y1 + ' C ' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"/>';
  }

  function render() {
    var ws = T.store.data;
    if (!ws.projects.length && !ws.tasks.length) {
      sec.innerHTML = '<header class="sec-head"><h1>Project Map</h1><span class="sec-sub">Workspace at a glance</span></header>'
        + '<div class="empty"><svg class="empty-art" viewBox="0 0 96 72"><use href="#moon-art"/></svg>'
        + '<div class="empty-title">The map is dark</div>'
        + '<div class="empty-sub">Add projects and tasks, then watch the tree light up.</div></div>';
      return;
    }
    var g = M.mapLayout(ws, collapsed);
    var body = '';
    g.edges.forEach(function (e) { body += edgeSvg(g, e); });
    g.nodes.forEach(function (n) { body += nodeSvg(n); });
    sec.innerHTML = '<header class="sec-head"><h1>Project Map</h1>'
      + '<span class="sec-sub">Drag to pan · click a task to open</span></header>'
      + '<div class="map-canvas" id="map-canvas">'
      + '<svg id="map-svg" width="' + g.width + '" height="' + g.height + '" '
      + 'style="transform:translate(' + panX + 'px,' + panY + 'px)">' + body + '</svg></div>';
    wire(ws, g);
  }

  function wire(ws, g) {
    var canvas = document.getElementById('map-canvas');
    // 折叠开关
    sec.querySelectorAll('.mn-caret').forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = c.dataset.toggle;
        var i = collapsed.indexOf(id);
        if (i >= 0) collapsed.splice(i, 1); else collapsed.push(id);
        render();
      });
    });
    // 点任务节点开编辑
    sec.querySelectorAll('.mn-task').forEach(function (t) {
      t.addEventListener('click', function () { if (T.openTask) T.openTask(t.dataset.open, render); });
    });
    // 画布平移（pointer 拖空白处）
    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    canvas.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.mn-task, .mn-caret')) return; // 节点交互不触发平移
      dragging = true; sx = e.clientX; sy = e.clientY; ox = panX; oy = panY;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('grabbing');
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      panX = ox + (e.clientX - sx); panY = oy + (e.clientY - sy);
      document.getElementById('map-svg').style.transform = 'translate(' + panX + 'px,' + panY + 'px)';
    });
    function endPan() { dragging = false; canvas.classList.remove('grabbing'); }
    canvas.addEventListener('pointerup', endPan);
    canvas.addEventListener('pointercancel', endPan);
  }

  T.onShow('map', render);
})();
```

- [ ] **Step 2: map.css**

新建 `skins/tracer/map.css`：

```css
/* Tracer Project Map：脑图树，SVG 节点+贝塞尔连线，画布可平移。 */
.map-canvas { overflow: hidden; height: calc(100vh - 150px); cursor: grab; position: relative; }
.map-canvas.grabbing { cursor: grabbing; }
#map-svg { transition: none; }
.me { fill: none; stroke: var(--border); stroke-width: 1.5; }
.mn text { font-size: 12.5px; fill: var(--fg); font-family: var(--font-body); }
.mn rect { fill: var(--surface); stroke: var(--border); stroke-width: 1; }
.mn-root rect { fill: var(--accent-soft); stroke: var(--accent); }
.mn-root text { fill: var(--fg); font-weight: 600; }
.mn-proj rect { fill: var(--panel); }
.mn-proj text { font-weight: 550; }
.mn-caret { cursor: pointer; fill: var(--muted); }
.mn-caret:hover { fill: var(--fg); }
.mn-task { cursor: pointer; }
.mn-task:hover rect { stroke: var(--accent); }
.mn-task text { fill: var(--muted); }
.mn-task:hover text { fill: var(--fg); }
```

- [ ] **Step 3: index.html link + 挂脚本**

`<link rel="stylesheet" href="/timeline.css">` 之后加 `<link rel="stylesheet" href="/map.css">`。
`<script src="/timeline.js"></script>` 之后加 `<script src="/map.js"></script>`。

- [ ] **Step 4: 检查 + 冒烟 + Commit**

```bash
node --check skins/tracer/map.js
node -e "process.exit(require('fs').readFileSync('skins/tracer/map.js').includes(0)?1:0)" && echo "no NUL"
node --test test/*.test.js
```

冒烟（设临时 DATA_DIR）：`DOCS_PORTAL_DATA_DIR=$(mktemp -d) DOCS_PORTAL_SKIN=tracer DOCS_PORTAL_PORT=8105 node server.js`，curl 确认 /map.js /map.css 200。

```bash
git add skins/tracer/map.js skins/tracer/map.css skins/tracer/index.html
git commit -m "feat(tracer): Project Map 脑图树——SVG 节点/连线、月相完成度、折叠、画布平移"
```

---

### Task 3: Insights 仪表盘（统计卡片 + 每周柱状图 + 状态条形列表）

**设计依据（dataviz）：** 单系列柱状图用单色 `--accent`、不需图例（标题即系列名）；状态分布用「条形列表」（每状态一行：名称+计数+比例条），全部直接标注、不靠颜色区分身份，天然无障碍；总量用统计卡片（数字本身即最佳形式）。文字一律用墨色 token（`--fg`/`--muted`），不用系列色。柱子 4px 圆角顶、细网格、每根柱带原生 `<title>` 悬浮。

**Files:**
- Create: `skins/tracer/insights.js`
- Create: `skins/tracer/insights.css`
- Modify: `skins/tracer/index.html`（link insights.css；挂 insights.js）

- [ ] **Step 1: insights.js**

新建 `skins/tracer/insights.js`：

```js
(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-insights');

  function tile(label, value, sub) {
    return '<div class="ins-tile"><div class="ins-num">' + value + '</div>'
      + '<div class="ins-label">' + label + '</div>'
      + (sub ? '<div class="ins-sub">' + sub + '</div>' : '') + '</div>';
  }

  // 每周完成柱状图：单系列 accent，直接在柱顶标数（非零），x 轴周标签，细基线。
  function weeklyChart(weeks) {
    var W = 460, H = 150, padB = 24, padT = 16, padL = 6, padR = 6;
    var n = weeks.length;
    var max = 1;
    weeks.forEach(function (w) { if (w.count > max) max = w.count; });
    var bw = (W - padL - padR) / n;
    var barW = Math.min(38, bw * 0.6);
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ins-chart" preserveAspectRatio="xMidYMid meet">';
    // 基线
    svg += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" class="ins-axis"/>';
    weeks.forEach(function (w, i) {
      var cx = padL + bw * i + bw / 2;
      var h = (H - padB - padT) * (w.count / max);
      var y = H - padB - h;
      svg += '<rect x="' + (cx - barW / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" rx="4" class="ins-bar">'
        + '<title>' + w.weekStart + ': ' + w.count + ' done</title></rect>';
      if (w.count > 0) svg += '<text x="' + cx.toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" class="ins-bar-val">' + w.count + '</text>';
      // x 轴：周起始的「月/日」
      var dp = M.dayParts(w.weekStart);
      svg += '<text x="' + cx.toFixed(1) + '" y="' + (H - padB + 14) + '" class="ins-xtick">' + dp.mon + ' ' + dp.dom + '</text>';
    });
    svg += '</svg>';
    return svg;
  }

  // 状态条形列表：todo/doing/review/done 各一行，比例条 + 计数，直接标注。
  function statusList(sc, total) {
    var rows = [
      ['Todo', sc.todo], ['In Progress', sc.doing], ['In Review', sc.review], ['Done', sc.done],
    ];
    var html = '<div class="ins-statuslist">';
    rows.forEach(function (r) {
      var frac = total ? r[1] / total : 0;
      html += '<div class="ins-strow">'
        + '<span class="ins-stname">' + r[0] + '</span>'
        + '<span class="ins-stbar"><span class="ins-stfill" style="width:' + (frac * 100).toFixed(1) + '%"></span></span>'
        + '<span class="ins-stcount">' + r[1] + '</span></div>';
    });
    html += '</div>';
    return html;
  }

  function render() {
    var ws = T.store.data;
    var sc = M.statusCounts(ws);
    var total = ws.tasks.length;
    var doneAll = sc.done;
    var activeProjects = ws.projects.length;
    var pages = ws.notes.length;
    var weeks = M.weeklyCompletions(ws, 8);
    var thisWeek = weeks[weeks.length - 1].count;

    sec.innerHTML = '<header class="sec-head"><h1>Insights</h1><span class="sec-sub">Work rhythms</span></header>'
      + '<div class="ins-tiles">'
      + tile('Tasks', total, doneAll + ' done')
      + tile('Done this week', thisWeek, '')
      + tile('Projects', activeProjects, '')
      + tile('Pages', pages, '')
      + '</div>'
      + '<div class="ins-grid">'
      + '<div class="ins-card"><div class="ins-card-title">Completed per week</div>' + weeklyChart(weeks) + '</div>'
      + '<div class="ins-card"><div class="ins-card-title">Task status</div>' + statusList(sc, total) + '</div>'
      + '<div class="ins-card ins-locked"><div class="ins-card-title">Keyboard heatmap · Focus rounds</div>'
      + '<div class="ins-lockmsg"><svg class="empty-art" viewBox="0 0 96 72" style="width:56px"><use href="#moon-art"/></svg>'
      + '<div>Unlocks with Garden</div></div></div>'
      + '</div>';
  }

  T.onShow('insights', render);
})();
```

- [ ] **Step 2: insights.css**

新建 `skins/tracer/insights.css`：

```css
/* Tracer Insights：统计卡片 + 手写 SVG 图表。单色 accent + 墨色文字。 */
.ins-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.ins-tile { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
.ins-num { font-size: 26px; font-weight: 700; color: var(--fg); letter-spacing: .2px; }
.ins-label { font-size: 12px; color: var(--muted); margin-top: 3px; }
.ins-sub { font-size: 11px; color: var(--muted); opacity: .8; margin-top: 2px; }

.ins-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 12px; align-items: start; }
.ins-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
.ins-card-title { font-size: 12.5px; font-weight: 600; color: var(--muted); margin-bottom: 10px; letter-spacing: .3px; }
.ins-chart { width: 100%; height: auto; display: block; }
.ins-axis { stroke: var(--border); stroke-width: 1; }
.ins-bar { fill: var(--accent); }
.ins-bar-val { fill: var(--fg); font-size: 11px; text-anchor: middle; font-family: var(--font-body); }
.ins-xtick { fill: var(--muted); font-size: 10px; text-anchor: middle; font-family: var(--font-body); }

.ins-statuslist { display: flex; flex-direction: column; gap: 10px; }
.ins-strow { display: grid; grid-template-columns: 78px minmax(0, 1fr) 28px; align-items: center; gap: 8px; }
.ins-stname { font-size: 12px; color: var(--muted); }
.ins-stbar { height: 8px; background: var(--panel); border-radius: 4px; overflow: hidden; }
.ins-stfill { display: block; height: 100%; background: var(--accent); border-radius: 4px; min-width: 0; transition: width .3s ease; }
.ins-stcount { font-size: 12px; color: var(--fg); text-align: right; font-family: var(--font-mono); }

.ins-locked { grid-column: 1 / -1; }
.ins-lockmsg { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--muted); padding: 20px 0; }
.ins-lockmsg > div { font-size: 12.5px; }
```

- [ ] **Step 3: index.html link + 挂脚本**

`<link rel="stylesheet" href="/map.css">` 之后加 `<link rel="stylesheet" href="/insights.css">`。
`<script src="/map.js"></script>` 之后加 `<script src="/insights.js"></script>`。

- [ ] **Step 4: 检查 + 全量测试**

```bash
node --check skins/tracer/insights.js
node -e "process.exit(require('fs').readFileSync('skins/tracer/insights.js').includes(0)?1:0)" && echo "no NUL"
node --test test/*.test.js
```

- [ ] **Step 5: 手工验证（浏览器）**

起 `DOCS_PORTAL_SKIN=tracer node server.js`，`http://127.0.0.1:8080/`：

**Project Map**（`?sec=map` 直达）：
1. 显示 workspace 根 → 各项目 → 任务叶的脑图树，从左向右三层，贝塞尔连线；项目节点右侧月相图标反映完成度（满月=100%）；无项目的任务在「Unassigned」分支下。
2. 项目节点前的 ▾/▸ 折叠/展开该项目的任务分支。
3. 拖空白处平移画布；点任务节点开编辑弹层，改完就地刷新。
4. 空 workspace → 月亮空状态。

**Insights**（`?sec=insights` 直达）：
5. 四张统计卡片（Tasks/Done this week/Projects/Pages）数字与数据一致。
6. 「Completed per week」8 周柱状图，柱顶标非零计数，x 轴周标签，悬浮柱子有 tooltip；把任务标 done 后回来该周柱子长高。
7. 「Task status」四行条形列表，比例条宽度与计数对应。
8. 「Keyboard heatmap · Focus rounds」卡显示「Unlocks with Garden」占位（数据源在阶段 6 游戏）。

9. 全程无 `novel/小说`；控制台无报错；回归其他分区正常。

- [ ] **Step 6: Commit**

```bash
git add skins/tracer/insights.js skins/tracer/insights.css skins/tracer/index.html
git commit -m "feat(tracer): Insights 仪表盘——统计卡片、每周完成柱状图、任务状态条形列表"
```

---

## 阶段边界

本计划**不含**（后续阶段）：游戏移植（农场+钓鱼进 Garden 分区）+ 默认皮肤切 tracer + 桌面版托盘品牌（阶段 6）、`Ctrl+K` 命令面板（阶段 7）。Insights 的键盘热力图与番茄钟轮数留占位，等阶段 6 游戏落地接数据。

## 已知偏差与提醒

- Project Map 的树布局是最简 tidy-tree（叶子顺序排队 + 父节点居中），不做节点重叠消解的高级算法；任务很多时纵向会很长（画布可平移，可接受）。子项目（parentId）本阶段不支持——spec 提到 parentId 但当前 addProject 不设它，Map 只做两层项目→任务；真需要嵌套项目时另加。
- Map 画布平移用 CSS transform，不做缩放（YAGNI，可平移够用）。
- Insights 只用 workspace 真实数据；键盘热力图/番茄钟占位到阶段 6。图表是手写 SVG，单色 accent + 墨色文字 + 直接标注，不引入分类配色（无需 CVD 校验）。
- 冒烟/审查起 server 务必设 `DOCS_PORTAL_DATA_DIR` 到临时目录，别污染演示用 data/workspace.json。
- 键盘可达性（Map 节点、Insights 无交互）与全局遗留项一致，某阶段统一补。
