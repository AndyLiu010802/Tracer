# Tracer 阶段 4：Planner + Timeline 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Planner 分区成为本周日程视图（7 天列 + 未安排托盘，拖任务到某天设 `scheduled`，可翻周）；Timeline 分区把项目横条铺在月刻度上（用项目 `start`/`end`，横条叠完成度进度，点横条设/改起止日期）。都经统一数据模型持久化。

**Architecture:** 日期数学与项目/进度查询是 `model.js` 的纯函数（可单测——时区/周边界是易错点，必须测）；视图 `planner.js`/`timeline.js` 通过 `Tracer.onShow` 注册、改数据调 `Tracer.touch()`；Planner 拖拽复用 `Tracer.ui.dragList`；任务编辑弹层复用 board.js 暴露的共享入口 `Tracer.openTask`。样式各自 `planner.css`/`timeline.css`。

**Tech Stack:** 纯 Node 标准库 + 原生 DOM，ES5 皮肤 JS，`node --test`。

**Spec:** `docs/superpowers/specs/2026-09-02-tracer-skin-design.md`（Planner：本周 7 天一列一天，有 scheduled 的任务落对应天，可跨天拖拽，左侧未安排托盘，日级粒度；Timeline：项目横条 start→end 铺月刻度，今天竖线，横条叠进度=项目 done 占比，点横条改起止日期，拖拽调边留后续）。

**上下文（给零背景的执行者）：**
- Tracer 是本地伪装工作台皮肤（`skins/tracer/`，零 npm 依赖纯 Node）。阶段 1-3 已交付（壳+主题+存储、Board+Inbox+项目、Notes）。
- **数据模型**：`store.data.tasks` 每项含 `{id, seq, projectId, title, status, priority, scheduled, due, order, createdAt, doneAt}`——`scheduled`/`due` 是 `'YYYY-MM-DD'` 字符串或 null，`updateTask` 已支持改它们。`store.data.projects` 每项 `{id, name, color, status, createdAt}`——**本阶段给它加可选 `start`/`end`（'YYYY-MM-DD' 或缺省）**。
- **装配 API**（`window.Tracer`）：`store.data`、`touch()`、`onShow(sec,fn)`（只在数据就绪后触发）、`currentSec()`、`ready`、`show(sec)`、`ui:{modal, confirm, dragList}`、`renderBoard`。board.js 会在本阶段 Task 2 追加暴露 `Tracer.openTask(id)`（打开任务编辑弹层，供 Planner 复用）。
- 皮肤 JS 用 ES5（`var`/`function`），注释中文、界面英文、禁「novel/小说」。用 Write/Edit 写文件，写完查裸 NUL。新脚本挂在 index.html 末尾已有脚本之后。
- **只 add 自己的文件**，工作区有其他会话脏文件别碰。
- **日期一律用本地时区构造**（`new Date(y, m-1, d)`，不要 `new Date(iso)` 那样按 UTC 解析），否则跨时区/夏令时会算错一天。

## 文件结构

```
skins/tracer/
  model.js     + 日期数学（toISO/fromISO/todayISO/addDays/weekStart/weekDays/dayParts/daysBetween/monthList/datePos）
               + updateProject（含 start/end）+ projectProgress + tasksOnDay/unscheduledTasks，扩充导出
  board.js     + 暴露 Tracer.openTask（打开任务编辑弹层）
  planner.js   新：本周 7 天 + 未安排托盘 + 拖拽排期 + 翻周
  timeline.js  新：项目横条铺月刻度 + 点横条设起止 + 进度叠加
  planner.css  新
  timeline.css 新
  index.html   + link 两个 css、挂两个 js
```

---

### Task 1: model.js —— 日期数学 + 项目日期/进度 + 排期查询

**Files:**
- Modify: `skins/tracer/model.js`（在 notesSorted 之后、`return {` 之前加；导出补键）
- Test: `test/tracer-model.test.js`（追加）

- [ ] **Step 1: 写失败的测试**

在 `test/tracer-model.test.js` 末尾追加：

```js
// ---------- 阶段 4：日期与排期 ----------

test('toISO / fromISO 本地时区往返', () => {
  const d = new Date(2026, 8, 3); // 2026-09-03 本地
  assert.strictEqual(M.toISO(d), '2026-09-03');
  const back = M.fromISO('2026-09-03');
  assert.strictEqual(back.getFullYear(), 2026);
  assert.strictEqual(back.getMonth(), 8);
  assert.strictEqual(back.getDate(), 3);
});

test('addDays 跨月跨年', () => {
  assert.strictEqual(M.addDays('2026-09-30', 1), '2026-10-01');
  assert.strictEqual(M.addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(M.addDays('2026-03-01', -1), '2026-02-28');
});

test('weekStart 返回周一（含跨月）', () => {
  // 2026-09-03 是周四 → 周一是 2026-08-31
  assert.strictEqual(M.weekStart('2026-09-03'), '2026-08-31');
  // 周一自己
  assert.strictEqual(M.weekStart('2026-08-31'), '2026-08-31');
  // 周日 2026-09-06 → 周一仍是 08-31
  assert.strictEqual(M.weekStart('2026-09-06'), '2026-08-31');
});

test('weekDays 返回周一到周日 7 天', () => {
  const days = M.weekDays('2026-09-03');
  assert.strictEqual(days.length, 7);
  assert.strictEqual(days[0], '2026-08-31');
  assert.strictEqual(days[6], '2026-09-06');
});

test('dayParts 星期与日号', () => {
  const p = M.dayParts('2026-09-03');
  assert.strictEqual(p.dow, 'Thu');
  assert.strictEqual(p.dom, 3);
  assert.strictEqual(p.mon, 'Sep');
});

test('daysBetween 有向天数', () => {
  assert.strictEqual(M.daysBetween('2026-09-03', '2026-09-10'), 7);
  assert.strictEqual(M.daysBetween('2026-09-10', '2026-09-03'), -7);
  assert.strictEqual(M.daysBetween('2026-09-03', '2026-09-03'), 0);
});

test('monthList 覆盖起止的每个月', () => {
  const ms = M.monthList('2026-08-15', '2026-11-02');
  assert.deepStrictEqual(ms.map((m) => m.label), ['Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026']);
  assert.strictEqual(ms[0].iso, '2026-08-01');
  assert.strictEqual(ms[1].iso, '2026-09-01');
});

test('datePos 归一化位置 [0,1]', () => {
  assert.strictEqual(M.datePos('2026-09-01', '2026-09-01', '2026-09-11'), 0);
  assert.strictEqual(M.datePos('2026-09-11', '2026-09-01', '2026-09-11'), 1);
  assert.ok(Math.abs(M.datePos('2026-09-06', '2026-09-01', '2026-09-11') - 0.5) < 1e-9);
});

test('updateProject 改名/起止/状态', () => {
  const ws = M.emptyWorkspace();
  const p = M.addProject(ws, { name: 'API redesign' });
  M.updateProject(ws, p.id, { start: '2026-09-01', end: '2026-10-15' });
  assert.strictEqual(p.start, '2026-09-01');
  assert.strictEqual(p.end, '2026-10-15');
  M.updateProject(ws, p.id, { name: 'Auth service' });
  assert.strictEqual(p.name, 'Auth service');
  assert.ok(/^#[0-9a-f]{6}$/i.test(p.color));
});

test('projectProgress = done 占比', () => {
  const ws = M.emptyWorkspace();
  const p = M.addProject(ws, { name: 'X' });
  assert.strictEqual(M.projectProgress(ws, p.id), 0, '无任务时 0');
  const a = M.addTask(ws, { title: 'a', projectId: p.id });
  const b = M.addTask(ws, { title: 'b', projectId: p.id });
  M.moveTask(ws, a.id, 'done', null);
  assert.ok(Math.abs(M.projectProgress(ws, p.id) - 0.5) < 1e-9);
});

test('tasksOnDay / unscheduledTasks', () => {
  const ws = M.emptyWorkspace();
  const a = M.addTask(ws, { title: 'a', scheduled: '2026-09-03' });
  const b = M.addTask(ws, { title: 'b', scheduled: '2026-09-03' });
  const c = M.addTask(ws, { title: 'c' }); // 未安排
  const d = M.addTask(ws, { title: 'd' });
  M.moveTask(ws, d.id, 'done', null); // done 的不进未安排
  assert.strictEqual(M.tasksOnDay(ws, '2026-09-03').length, 2);
  assert.strictEqual(M.tasksOnDay(ws, '2026-09-04').length, 0);
  const un = M.unscheduledTasks(ws);
  assert.strictEqual(un.length, 1);
  assert.strictEqual(un[0].title, 'c');
});
```

- [ ] **Step 2: 跑红**

Run: `node --test test/tracer-model.test.js`
Expected: FAIL —— `M.toISO is not a function` 等。

- [ ] **Step 3: 实现**

在 `skins/tracer/model.js` 的 `notesSorted` 之后、`return {` 之前插入：

```js
  // ---------- 日期数学 ----------
  // 一律用本地时区构造，避免 new Date(iso) 按 UTC 解析导致差一天。
  function pad2d(n) { return (n < 10 ? '0' : '') + n; }
  function toISO(d) { return d.getFullYear() + '-' + pad2d(d.getMonth() + 1) + '-' + pad2d(d.getDate()); }
  function fromISO(iso) {
    var p = String(iso).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function todayISO() { return toISO(new Date()); }
  function addDays(iso, n) {
    var d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  // 周一为一周起点。JS getDay() 周日=0，(getDay()+6)%7 把周一映射成 0。
  function weekStart(iso) {
    var d = fromISO(iso);
    var mondayOffset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - mondayOffset);
    return toISO(d);
  }
  function weekDays(iso) {
    var s = weekStart(iso);
    var out = [];
    for (var i = 0; i < 7; i++) out.push(addDays(s, i));
    return out;
  }
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dayParts(iso) {
    var d = fromISO(iso);
    return { dow: DOW[(d.getDay() + 6) % 7], dom: d.getDate(), mon: MON[d.getMonth()] };
  }
  function daysBetween(a, b) {
    return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
  }
  // 覆盖 [start,end] 的每个自然月，返回 [{label:'Sep 2026', iso:'2026-09-01'}]。
  function monthList(startISO, endISO) {
    var s = fromISO(startISO), e = fromISO(endISO);
    var out = [];
    var y = s.getFullYear(), m = s.getMonth();
    while (y < e.getFullYear() || (y === e.getFullYear() && m <= e.getMonth())) {
      out.push({ label: MON[m] + ' ' + y, iso: y + '-' + pad2d(m + 1) + '-01' });
      m++; if (m > 11) { m = 0; y++; }
    }
    return out;
  }
  // iso 在 [rangeStart,rangeEnd] 上的归一化位置 0..1（超界不裁剪，调用方按需 clamp）。
  function datePos(iso, rangeStartISO, rangeEndISO) {
    var total = daysBetween(rangeStartISO, rangeEndISO);
    if (total === 0) return 0;
    return daysBetween(rangeStartISO, iso) / total;
  }

  // ---------- 项目日期/进度 ----------
  function findProject(ws, id) {
    for (var i = 0; i < ws.projects.length; i++) if (ws.projects[i].id === id) return ws.projects[i];
    return null;
  }
  function updateProject(ws, id, fields) {
    var p = findProject(ws, id);
    if (!p) return null;
    if (fields.name !== undefined) {
      var nm = String(fields.name).trim();
      if (nm) { p.name = nm; p.color = projectColor(nm); }
    }
    if (fields.start !== undefined) p.start = fields.start;
    if (fields.end !== undefined) p.end = fields.end;
    if (fields.status !== undefined) p.status = fields.status;
    return p;
  }
  function projectProgress(ws, projectId) {
    var ts = ws.tasks.filter(function (t) { return t.projectId === projectId; });
    if (!ts.length) return 0;
    var done = 0;
    ts.forEach(function (t) { if (t.status === 'done') done++; });
    return done / ts.length;
  }

  // ---------- 排期查询 ----------
  function tasksOnDay(ws, iso) {
    return ws.tasks.filter(function (t) { return t.scheduled === iso; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function unscheduledTasks(ws) {
    return ws.tasks.filter(function (t) { return !t.scheduled && t.status !== 'done'; })
      .sort(function (a, b) { return a.order - b.order; });
  }
```

然后在 `return {` 对象里，`notesSorted: notesSorted,` 之后加：

```js
    toISO: toISO, fromISO: fromISO, todayISO: todayISO, addDays: addDays,
    weekStart: weekStart, weekDays: weekDays, dayParts: dayParts, daysBetween: daysBetween,
    monthList: monthList, datePos: datePos,
    findProject: findProject, updateProject: updateProject, projectProgress: projectProgress,
    tasksOnDay: tasksOnDay, unscheduledTasks: unscheduledTasks,
```

- [ ] **Step 4: 跑绿**

Run: `node --test test/tracer-model.test.js`
Expected: PASS（原有 + 新增 11 条）。

Run: `node --test test/*.test.js`
Expected: 全绿。

- [ ] **Step 5: 无裸 NUL + Commit**

```bash
node -e "process.exit(require('fs').readFileSync('skins/tracer/model.js').includes(0)?1:0)" && echo "no NUL"
git add skins/tracer/model.js test/tracer-model.test.js
git commit -m "feat(tracer): model.js 日期数学 + 项目起止/进度 + 排期查询（本地时区）"
```

---

### Task 2: board.js 暴露 openTask + Planner 视图

**Files:**
- Modify: `skins/tracer/board.js`（暴露 `Tracer.openTask`）
- Modify: `skins/tracer/model.js`（`tasksOnDay` 滤掉 done——见下）
- Modify: `test/tracer-model.test.js`（补 tasksOnDay 滤 done 的断言）
- Create: `skins/tracer/planner.js`
- Create: `skins/tracer/planner.css`
- Modify: `skins/tracer/index.html`（link planner.css；挂 planner.js）

- [ ] **Step 0: `tasksOnDay` 滤掉 done（Task 1 质量审查决策）**

Task 1 审查指出 `tasksOnDay` 不排除 done、与 `unscheduledTasks` 不对称——Planner 天列会混入已完成卡片且无 done 视觉。决定：天列与托盘一致，滤掉 done。改 `skins/tracer/model.js` 的 `tasksOnDay`：

```js
  function tasksOnDay(ws, iso) {
    return ws.tasks.filter(function (t) { return t.scheduled === iso && t.status !== 'done'; })
      .sort(function (a, b) { return a.order - b.order; });
  }
```

`test/tracer-model.test.js` 的 `tasksOnDay / unscheduledTasks` 测试里补一句：给 2026-09-03 那天再加一个 done 任务，断言 `tasksOnDay` 仍是 2（done 不计）。先让新断言在改前跑红，再改绿。

- [ ] **Step 1: board.js 暴露 openTask**

board.js 已有私有 `editTask(ws, id)` 和导出 `T.editLastTask`。追加一个通用入口，让 Planner 点任务能开同一个编辑弹层。在 `T.editLastTask = ...` 那一行附近加：

```js
  // 供 Planner/Timeline 等复用：打开任务编辑弹层，关闭后各视图自行重绘。
  T.openTask = function (id) { editTask(T.store.data, id); };
```

（`editTask` 内部 Save/Delete 后调的是 board 的 `render()`——从 Planner 打开时，改动仍 `T.touch()` 落库，切回 Board 会重绘；Planner 自身的即时刷新由 Planner 在 modal 关闭后不强求，做法见 Step 2 注释。若要 Planner 改完立即刷新，Planner 在调用前后不易挂钩，故本阶段 Planner 的任务编辑以「拖拽排期」为主，点任务打开编辑弹层作为便捷入口，编辑后的即时重绘不作硬性要求——拖拽路径才是 Planner 的核心，它有自己的 render。）

- [ ] **Step 2: planner.js**

新建 `skins/tracer/planner.js`：

```js
(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-planner');
  var anchor = null; // 当前显示的周里的某一天 ISO，null=本周

  function projDot(ws, t) {
    var p = t.projectId ? M.findProject(ws, t.projectId) : null;
    return p ? '<i class="pl-dot" style="background:' + p.color + '"></i>' : '';
  }
  function cardHtml(ws, t) {
    return '<div class="pl-card" data-id="' + t.id + '" tabindex="0">'
      + '<div class="pl-card-title">' + M.esc(t.title) + '</div>'
      + '<div class="pl-card-meta"><span class="pl-seq">' + M.esc(t.seq) + '</span>' + projDot(ws, t) + '</div>'
      + '</div>';
  }

  function render() {
    var ws = T.store.data;
    var base = anchor || M.todayISO();
    var days = M.weekDays(base);
    var today = M.todayISO();
    var weekLabel = M.dayParts(days[0]).mon + ' ' + M.dayParts(days[0]).dom
      + ' – ' + M.dayParts(days[6]).mon + ' ' + M.dayParts(days[6]).dom;

    var html = '<header class="sec-head"><h1>Planner</h1>'
      + '<span class="sec-sub">' + weekLabel + '</span>'
      + '<span style="flex:1"></span>'
      + '<button class="chip" id="pl-prev">‹</button>'
      + '<button class="chip" id="pl-today">Today</button>'
      + '<button class="chip" id="pl-next">›</button></header>'
      + '<div class="planner">'
      + '<div class="pl-tray" data-day=""><div class="pl-col-head">Unscheduled</div>'
      + '<div class="pl-body" data-day="">';
    M.unscheduledTasks(ws).forEach(function (t) { html += cardHtml(ws, t); });
    html += '</div></div>';
    days.forEach(function (iso) {
      var dp = M.dayParts(iso);
      var isToday = iso === today ? ' pl-is-today' : '';
      html += '<div class="pl-day' + isToday + '" data-day="' + iso + '">'
        + '<div class="pl-col-head"><span class="pl-dow">' + dp.dow + '</span> <span class="pl-dom">' + dp.dom + '</span></div>'
        + '<div class="pl-body" data-day="' + iso + '">';
      M.tasksOnDay(ws, iso).forEach(function (t) { html += cardHtml(ws, t); });
      html += '</div></div>';
    });
    html += '</div>';
    sec.innerHTML = html;
    wire(ws, base);
  }

  function wire(ws, base) {
    document.getElementById('pl-prev').addEventListener('click', function () { anchor = M.addDays(base, -7); render(); });
    document.getElementById('pl-next').addEventListener('click', function () { anchor = M.addDays(base, 7); render(); });
    document.getElementById('pl-today').addEventListener('click', function () { anchor = null; render(); });
    // 点卡片开编辑（复用 board 的任务编辑弹层）
    sec.querySelectorAll('.pl-card').forEach(function (card) {
      card.addEventListener('click', function () { if (T.openTask) { T.openTask(card.dataset.id); } });
    });
    // 拖拽：把任务拖到某天/托盘 → 设/清 scheduled
    T.ui.dragList(sec.querySelector('.planner'), {
      itemSelector: '.pl-card',
      colSelector: '.pl-body',
      onHover: function (col, before, dragged) {
        if (before) col.insertBefore(dragged, before); else col.appendChild(dragged);
      },
      onDrop: function (el, col) {
        var day = col.dataset.day || null; // 托盘的 data-day="" → null
        M.updateTask(ws, el.dataset.id, { scheduled: day });
        T.touch(); render();
      },
      onCancel: function () { render(); },
    });
  }

  T.onShow('planner', render);
})();
```

- [ ] **Step 3: planner.css**

新建 `skins/tracer/planner.css`：

```css
/* Tracer Planner：未安排托盘 + 本周 7 天列，横向排布，可拖任务排期。 */
.planner { display: grid; grid-template-columns: 200px repeat(7, minmax(0, 1fr)); gap: 8px; align-items: start; }
.pl-tray, .pl-day { display: flex; flex-direction: column; min-height: 120px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px; }
.pl-tray { background: transparent; border-style: dashed; }
.pl-is-today { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent-soft); }
.pl-col-head { font-size: 11.5px; font-weight: 600; color: var(--muted); margin-bottom: 8px; display: flex; align-items: baseline; gap: 5px; }
.pl-dow { text-transform: uppercase; letter-spacing: .5px; }
.pl-dom { color: var(--fg); font-size: 14px; }
.pl-is-today .pl-dom { color: var(--accent); }
.pl-body { display: flex; flex-direction: column; gap: 6px; min-height: 32px; flex: 1; }
.pl-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 7px 9px; cursor: pointer; }
.pl-card:hover { border-color: #34373f; }
.pl-card:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.pl-card.dragging { opacity: .55; }
.pl-card-title { font-size: 12.5px; line-height: 1.35; margin-bottom: 5px; }
.pl-card-meta { display: flex; align-items: center; gap: 6px; }
.pl-seq { font-family: var(--font-mono); font-size: 10.5px; color: var(--muted); }
.pl-dot { width: 7px; height: 7px; border-radius: 2px; display: inline-block; }
```

- [ ] **Step 4: index.html link + 挂脚本**

`<link rel="stylesheet" href="/notes.css">` 之后加 `<link rel="stylesheet" href="/planner.css">`。
`<script src="/notes.js"></script>` 之后加 `<script src="/planner.js"></script>`。

- [ ] **Step 5: 检查 + 冒烟 + Commit**

```bash
node --check skins/tracer/planner.js skins/tracer/board.js
node -e "process.exit(require('fs').readFileSync('skins/tracer/planner.js').includes(0)?1:0)" && echo "no NUL"
node --test test/*.test.js
```

冒烟：起 `DOCS_PORTAL_SKIN=tracer DOCS_PORTAL_PORT=8101 node server.js`（**注意：起 server 前设 `DOCS_PORTAL_DATA_DIR` 指到临时目录，别写演示用的 data/workspace.json**，如 `DOCS_PORTAL_DATA_DIR=$(mktemp -d)`），curl 确认 `/planner.js` `/planner.css` 200。交互留手工验证。

```bash
git add skins/tracer/board.js skins/tracer/planner.js skins/tracer/planner.css skins/tracer/index.html
git commit -m "feat(tracer): Planner 视图——本周 7 天+未安排托盘、拖拽排期、翻周"
```

---

### Task 3: Timeline 视图 + 手工验证

**Files:**
- Create: `skins/tracer/timeline.js`
- Create: `skins/tracer/timeline.css`
- Modify: `skins/tracer/index.html`（link timeline.css；挂 timeline.js）

- [ ] **Step 1: timeline.js**

新建 `skins/tracer/timeline.js`：

```js
(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-timeline');

  // 时间轴范围：所有带 start&end 的项目的最早/最晚，向外各留 15 天余量；
  // 无任何日期项目时，默认显示今天所在月起 3 个月。
  function range(ws) {
    var dated = ws.projects.filter(function (p) { return p.start && p.end; });
    if (!dated.length) {
      var t = M.todayISO();
      return { start: M.weekStart(t), end: M.addDays(t, 90) };
    }
    var min = dated[0].start, max = dated[0].end;
    dated.forEach(function (p) {
      if (M.daysBetween(p.start, min) > 0) min = p.start;
      if (M.daysBetween(max, p.end) > 0) max = p.end;
    });
    return { start: M.addDays(min, -15), end: M.addDays(max, 15) };
  }

  function pct(x) { return (x * 100).toFixed(2) + '%'; }

  function render() {
    var ws = T.store.data;
    var r = range(ws);
    var months = M.monthList(r.start, r.end);
    var today = M.todayISO();

    var html = '<header class="sec-head"><h1>Timeline</h1>'
      + '<span class="sec-sub">Project ranges</span></header>'
      + '<div class="tl">'
      + '<div class="tl-axis">';
    months.forEach(function (m, i) {
      var left = M.datePos(m.iso, r.start, r.end);
      var next = months[i + 1] ? M.datePos(months[i + 1].iso, r.start, r.end) : 1;
      html += '<div class="tl-month" style="left:' + pct(left) + ';width:' + pct(next - left) + '">' + m.label + '</div>';
    });
    html += '</div><div class="tl-rows">';
    // 今天竖线（在范围内才画）
    if (M.daysBetween(r.start, today) >= 0 && M.daysBetween(today, r.end) >= 0) {
      html += '<div class="tl-today" style="left:' + pct(M.datePos(today, r.start, r.end)) + '"></div>';
    }
    ws.projects.forEach(function (p) {
      html += '<div class="tl-row" data-id="' + p.id + '">'
        + '<div class="tl-label"><i style="background:' + p.color + '"></i>' + M.esc(p.name) + '</div>'
        + '<div class="tl-track">';
      if (p.start && p.end) {
        var left = Math.max(0, M.datePos(p.start, r.start, r.end));
        var right = Math.min(1, M.datePos(p.end, r.start, r.end));
        var w = Math.max(0.01, right - left);
        var prog = M.projectProgress(ws, p.id);
        html += '<div class="tl-bar" data-id="' + p.id + '" style="left:' + pct(left) + ';width:' + pct(w) + ';background:' + p.color + '22;border-color:' + p.color + '">'
          + '<div class="tl-bar-fill" style="width:' + pct(prog) + ';background:' + p.color + '"></div>'
          + '<span class="tl-bar-label">' + Math.round(prog * 100) + '%</span></div>';
      } else {
        html += '<button class="tl-set" data-id="' + p.id + '">Set dates</button>';
      }
      html += '</div></div>';
    });
    if (!ws.projects.length) {
      html += '<div class="empty" style="grid-column:1/-1"><svg class="empty-art" viewBox="0 0 96 72"><use href="#moon-art"/></svg>'
        + '<div class="empty-title">No projects yet</div>'
        + '<div class="empty-sub">Create projects in the sidebar, then set their date ranges here.</div></div>';
    }
    html += '</div></div>';
    sec.innerHTML = html;
    wire(ws);
  }

  function wire(ws) {
    sec.querySelectorAll('.tl-bar, .tl-set').forEach(function (el) {
      el.addEventListener('click', function () { editDates(ws, el.dataset.id); });
    });
  }

  function editDates(ws, id) {
    var p = M.findProject(ws, id);
    if (!p) return;
    T.ui.modal(function (box, close) {
      box.innerHTML = '<h2>' + M.esc(p.name) + ' — dates</h2>'
        + '<label>Start</label><input type="date" id="d-start" value="' + (p.start || '') + '">'
        + '<label>End</label><input type="date" id="d-end" value="' + (p.end || '') + '">'
        + '<div class="modal-actions">'
        + (p.start || p.end ? '<button class="btn btn-danger" id="d-clear">Clear</button>' : '')
        + '<span style="flex:1"></span>'
        + '<button class="btn" id="d-cancel">Cancel</button>'
        + '<button class="btn btn-primary" id="d-save">Save</button></div>';
      box.querySelector('#d-cancel').onclick = close;
      box.querySelector('#d-save').onclick = function () {
        var s = box.querySelector('#d-start').value || null;
        var e = box.querySelector('#d-end').value || null;
        // 起止都填时保证 start<=end，填反了自动交换
        if (s && e && M.daysBetween(s, e) < 0) { var tmp = s; s = e; e = tmp; }
        M.updateProject(ws, id, { start: s, end: e });
        T.touch(); close(); render();
      };
      var clr = box.querySelector('#d-clear');
      if (clr) clr.onclick = function () { M.updateProject(ws, id, { start: null, end: null }); T.touch(); close(); render(); };
    });
  }

  T.onShow('timeline', render);
})();
```

- [ ] **Step 2: timeline.css**

新建 `skins/tracer/timeline.css`：

```css
/* Tracer Timeline：项目横条铺在月刻度上，横条叠完成度进度，点横条改起止。 */
.tl { position: relative; }
.tl-axis { position: relative; height: 26px; margin-left: 180px; border-bottom: 1px solid var(--border); }
.tl-month { position: absolute; top: 0; font-size: 11px; color: var(--muted); padding: 4px 0 0 6px; border-left: 1px solid var(--border); height: 100%; box-sizing: border-box; white-space: nowrap; overflow: hidden; }
.tl-rows { position: relative; padding-top: 8px; }
.tl-today { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--accent); opacity: .55; margin-left: 180px; z-index: 1; }
.tl-row { display: grid; grid-template-columns: 180px minmax(0, 1fr); align-items: center; height: 40px; }
.tl-label { display: flex; align-items: center; gap: 8px; font-size: 13px; padding-right: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl-label i { width: 9px; height: 9px; border-radius: 3px; flex: none; }
.tl-track { position: relative; height: 100%; }
.tl-bar { position: absolute; top: 8px; height: 22px; border: 1px solid; border-radius: 5px; cursor: pointer; overflow: hidden; display: flex; align-items: center; }
.tl-bar:hover { filter: brightness(1.15); }
.tl-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; opacity: .45; }
.tl-bar-label { position: relative; font-size: 10.5px; font-weight: 600; color: var(--fg); padding-left: 7px; }
.tl-set { font: inherit; font-size: 11.5px; color: var(--muted); background: transparent; border: 1px dashed var(--border); border-radius: 5px; padding: 3px 10px; cursor: pointer; }
.tl-set:hover { color: var(--accent); border-color: var(--accent); }
```

- [ ] **Step 3: index.html link + 挂脚本**

`<link rel="stylesheet" href="/planner.css">` 之后加 `<link rel="stylesheet" href="/timeline.css">`。
`<script src="/planner.js"></script>` 之后加 `<script src="/timeline.js"></script>`。

- [ ] **Step 4: 检查 + 全量测试**

```bash
node --check skins/tracer/timeline.js
node -e "process.exit(require('fs').readFileSync('skins/tracer/timeline.js').includes(0)?1:0)" && echo "no NUL"
node --test test/*.test.js
```

- [ ] **Step 5: 手工验证（浏览器）**

起 `DOCS_PORTAL_SKIN=tracer node server.js`，`http://127.0.0.1:8080/`：

**Planner**（`?sec=planner` 直达）：
1. 顶部显示本周日期区间；7 天列 + 左侧「Unscheduled」托盘；今天那列高亮。
2. 从托盘把任务拖到某天 → 落在该天、刷新后保持（scheduled 已设）；从某天拖回托盘 → 清除排期。
3. 跨天拖 → scheduled 改成新的一天。
4. `‹`/`›` 翻上/下周，`Today` 回本周。
5. 点任务卡 → 打开编辑弹层。

**Timeline**（`?sec=timeline` 直达）：
6. 每个项目一行；有起止的项目显示横条（长度对应 start→end，落在对应月刻度下），横条里进度条=该项目 done 任务占比 + 百分比标签；今天一条竖线。
7. 没设日期的项目显示「Set dates」；点它或点横条 → 弹层设 Start/End（填反自动交换），Save 后横条出现/更新；Clear 清除。
8. 切回 Board/Planner 看 scheduled/日期数据一致。

9. 全程无 `novel/小说`；控制台无报错；回归 Board/Inbox/Notes/项目仍正常。

- [ ] **Step 6: Commit**

```bash
git add skins/tracer/timeline.js skins/tracer/timeline.css skins/tracer/index.html
git commit -m "feat(tracer): Timeline 视图——项目横条铺月刻度、进度叠加、点横条设起止"
```

---

## 阶段边界

本计划**不含**（后续阶段）：Project Map 脑图 + Insights（阶段 5）、游戏移植 + 默认皮肤切 tracer（阶段 6）、`Ctrl+K` 命令面板（阶段 7）。

## 已知偏差与提醒

- Timeline 拖拽调横条边（改起止）不做，只支持点开弹层改日期（spec 明确「拖拽调边留后续」）。
- Planner 拖拽只改 `scheduled`，不保证同一天内的排序（同天按 order 展示）；日级粒度，不做小时。
- Planner 点任务开的是 board 的编辑弹层，编辑后 Planner 不即时重绘（拖拽路径才是核心，编辑弹层是便捷入口）——若手工验证发现体验割裂，作为阶段内小改：让 openTask 接一个可选的关闭回调触发调用方 render，届时再加。
- 冒烟/审查起 server 时**务必设 `DOCS_PORTAL_DATA_DIR` 到临时目录**，否则会写脏演示用的 `data/workspace.json`（阶段 3 踩过这个坑）。
- `datePos` 不 clamp（Timeline 里横条 left/width 各自 Math.max/min clamp 过）；月刻度最后一格宽度用「到范围末尾」补齐。
