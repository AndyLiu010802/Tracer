# Tracer 阶段 2：Board + Inbox 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Tracer 的 Board（四列看板，卡片可拖拽换列换序、可建可编辑可删）与 Inbox（一行速记，可转任务/转笔记/删除）成为真实可用的视图；侧栏 PROJECTS 列表可建项目、可过滤；顶栏 `+ New` 快速建卡。全部改动经统一数据模型持久化到 `data/workspace.json`。

**Architecture:** 数据操作是 `model.js` 的纯函数（可单测）；视图模块 `board.js`/`inbox.js`/`projects.js` 通过 `Tracer.onShow(sec, render)` 注册、改数据后调 `Tracer.touch()`；共享 UI 原语（弹层 modal、pointer 拖拽、`+ New`）放 `app.js` 暴露到 `Tracer.ui`。拖拽用 pointer 事件自研（不用 HTML5 DnD）。

**Tech Stack:** 纯 Node 标准库 + 原生 DOM，ES5 皮肤 JS，`node --test`。

**Spec:** `docs/superpowers/specs/2026-09-02-tracer-skin-design.md`

**上下文（给零背景的执行者）：**
- Tracer 是一个本地伪装工作台皮肤（`skins/tracer/`），阶段 1 已交付壳 + 主题 + 存储。数据模型见 `skins/tracer/model.js` 的 `emptyWorkspace()`：`{projects:[], tasks:[], notes:[], inbox:[], meta:{seqCounter, rev}}`。
- **装配 API**（`window.Tracer`，app.js 暴露）：
  - `Tracer.store.data` —— 工作区对象（就绪后非空）。
  - `Tracer.touch()` —— 改完数据调它，500ms 防抖保存。
  - `Tracer.onShow(sec, fn)` —— 注册分区进场钩子；**只在工作区就绪后触发**，模块不用自查 `store.data` 是否为空。
  - `Tracer.currentSec()` —— 当前分区名。
  - `Tracer.ready` —— Promise，成功兑现工作区对象，失败兑现 null（且 `store.lost=true`）。
- 皮肤 JS 用 ES5（`var`/`function`），注释中文、界面英文、禁「novel/小说」。用 Write/Edit 写文件，**写完检查无裸 NUL 字节**（`node -e "process.exit(require('fs').readFileSync(F).includes(0)?1:0)"`）。
- 有其他会话在并行改 `skins/db-console/farm.js` 等——**只 add 自己的文件**，别碰工作区其他脏文件。
- HTML 渲染任何用户输入前必须转义（见 Task 1 的 `esc`），防止标题里的 `<` 破坏 DOM。
- 新脚本要在 `skins/tracer/index.html` 末尾 `<script src="/app.js">` **之后**加 `<script src="/board.js">` 等（app.js 先建好 `window.Tracer`）。

## 文件结构

```
skins/tracer/
  model.js      + 数据操作纯函数（建/改/删/流转/查询/索引），扩充导出
  app.js        + Tracer.ui（modal、confirm、pointer 拖拽原语、+New）扩充
  board.js      新：四列看板视图
  inbox.js      新：收集箱视图
  projects.js   新：侧栏项目列表 + 建项目 + 当前过滤
  board.css     新：看板/卡片/弹层/inbox 的样式（index.html 再 link 一个）
```

分成 board.css 而不是塞进 skin.css：skin.css 是「壳与主题」，阶段 2+ 的组件样式独立成文件，避免 skin.css 膨胀。

---

### Task 1: model.js 数据操作纯函数

**Files:**
- Modify: `skins/tracer/model.js`（在 `emptyWorkspace` 之后、`return` 之前加一组函数，并加进导出对象）
- Test: `test/tracer-model.test.js`（在现有用例后追加）

- [ ] **Step 1: 写失败的测试**

在 `test/tracer-model.test.js` 末尾（最后一个 `test(...)` 之后）追加：

```js
// ---------- 阶段 2：数据操作 ----------

function freshWs() { return M.emptyWorkspace(); }

test('esc 转义 HTML 特殊字符', () => {
  assert.strictEqual(M.esc('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
  assert.strictEqual(M.esc('plain text'), 'plain text');
  assert.strictEqual(M.esc(''), '');
});

test('nextSeq 递增并写回 meta', () => {
  const ws = freshWs();
  assert.strictEqual(M.nextSeq(ws), 1);
  assert.strictEqual(M.nextSeq(ws), 2);
  assert.strictEqual(ws.meta.seqCounter, 2);
});

test('addTask 建卡：默认 todo、seq 连续、order 末尾、有时间戳', () => {
  const ws = freshWs();
  const t = M.addTask(ws, { title: 'Fix auth' });
  assert.strictEqual(t.title, 'Fix auth');
  assert.strictEqual(t.status, 'todo');
  assert.strictEqual(t.seq, 'TRC-1');
  assert.ok(t.id && typeof t.id === 'string');
  assert.ok(typeof t.createdAt === 'number');
  assert.strictEqual(ws.tasks.length, 1);
  // order 单调递增，末尾追加
  const t2 = M.addTask(ws, { title: 'Second' });
  assert.ok(t2.order > t.order);
});

test('addTask 空白标题被拒（返回 null，不入库）', () => {
  const ws = freshWs();
  assert.strictEqual(M.addTask(ws, { title: '   ' }), null);
  assert.strictEqual(M.addTask(ws, {}), null);
  assert.strictEqual(ws.tasks.length, 0);
});

test('moveTask 改状态并置于目标列末尾、记 doneAt', () => {
  const ws = freshWs();
  const a = M.addTask(ws, { title: 'A' });
  const b = M.addTask(ws, { title: 'B' });
  M.moveTask(ws, a.id, 'done', null);           // a → done 末尾
  assert.strictEqual(a.status, 'done');
  assert.ok(typeof a.doneAt === 'number', 'done 时记 doneAt');
  M.moveTask(ws, a.id, 'todo', null);           // 移回 todo，doneAt 清空
  assert.strictEqual(a.doneAt, null);
  // b 仍在 todo
  assert.strictEqual(b.status, 'todo');
});

test('moveTask 插到指定卡之前（beforeId）时 order 落在区间内', () => {
  const ws = freshWs();
  const a = M.addTask(ws, { title: 'A' });
  const b = M.addTask(ws, { title: 'B' });
  const c = M.addTask(ws, { title: 'C' });
  // 把 c 移到 a 之前（同列 todo）：order 应小于 a
  M.moveTask(ws, c.id, 'todo', a.id);
  assert.ok(c.order < a.order, 'c 应排在 a 前');
  // 把 a 移到 b 之前：a 落在原 a..b 之间——但 a 就是起点，改成移 c 到 b 前更清晰
  M.moveTask(ws, c.id, 'todo', b.id);
  assert.ok(c.order > a.order && c.order < b.order, 'c 应落在 a 与 b 之间');
});

test('tasksByStatus 按 order 升序分组', () => {
  const ws = freshWs();
  const a = M.addTask(ws, { title: 'A' });
  const b = M.addTask(ws, { title: 'B' });
  M.moveTask(ws, b.id, 'todo', a.id);           // b 排到 a 前
  const todo = M.tasksByStatus(ws, 'todo');
  assert.deepStrictEqual(todo.map((t) => t.title), ['B', 'A']);
});

test('updateTask 改字段，deleteTask 移除', () => {
  const ws = freshWs();
  const t = M.addTask(ws, { title: 'X' });
  M.updateTask(ws, t.id, { title: 'Y', priority: 'high' });
  assert.strictEqual(t.title, 'Y');
  assert.strictEqual(t.priority, 'high');
  M.deleteTask(ws, t.id);
  assert.strictEqual(ws.tasks.length, 0);
});

test('addProject 建项目：有 id/name/color，slug 化', () => {
  const ws = freshWs();
  const p = M.addProject(ws, { name: 'API redesign' });
  assert.ok(p.id);
  assert.strictEqual(p.name, 'API redesign');
  assert.ok(/^#[0-9a-f]{6}$/i.test(p.color), 'color 是 hex');
  assert.strictEqual(ws.projects.length, 1);
  assert.strictEqual(M.addProject(ws, { name: '  ' }), null, '空名被拒');
});

test('addInbox / inboxToTask / inboxToNote / deleteInbox', () => {
  const ws = freshWs();
  const it = M.addInbox(ws, 'a quick thought');
  assert.strictEqual(it.text, 'a quick thought');
  assert.strictEqual(ws.inbox.length, 1);
  assert.strictEqual(M.addInbox(ws, '   '), null, '空白被拒');

  const task = M.inboxToTask(ws, it.id);          // 转任务：入 tasks、出 inbox
  assert.strictEqual(task.title, 'a quick thought');
  assert.strictEqual(ws.inbox.length, 0);
  assert.strictEqual(ws.tasks.length, 1);

  const it2 = M.addInbox(ws, 'note idea');
  const note = M.inboxToNote(ws, it2.id);          // 转笔记
  assert.strictEqual(note.title, 'note idea');
  assert.strictEqual(ws.notes.length, 1);
  assert.strictEqual(ws.inbox.length, 0);

  const it3 = M.addInbox(ws, 'trash');
  M.deleteInbox(ws, it3.id);
  assert.strictEqual(ws.inbox.length, 0);
});

test('projectColor 对同名稳定、不同名多样', () => {
  const c1 = M.projectColor('API redesign');
  const c2 = M.projectColor('API redesign');
  assert.strictEqual(c1, c2, '同名同色');
  assert.ok(/^#[0-9a-f]{6}$/i.test(c1));
});
```

- [ ] **Step 2: 跑红**

Run: `node --test test/tracer-model.test.js`
Expected: FAIL —— `M.esc is not a function` 等。

- [ ] **Step 3: 实现**

在 `skins/tracer/model.js` 的 `emptyWorkspace` 函数之后、`return {` 之前插入：

```js
  // ---------- HTML 转义 ----------
  // 所有用户输入渲染进 innerHTML 前必走这里，挡住标题里的 < 破坏 DOM。
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------- 序号 ----------
  function nextSeq(ws) {
    ws.meta.seqCounter += 1;
    return ws.meta.seqCounter;
  }

  // ---------- 项目色 ----------
  // 名字哈希到一组柔和的深色友好色板，同名恒同色（反复被瞥见不变）。
  var PROJ_COLORS = ['#7c8fe8', '#4fbf82', '#e5b567', '#b07ce8', '#e8975a',
    '#5cc2c9', '#e86a8a', '#8bc34a'];
  function projectColor(name) {
    var h = 0, s = String(name);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return PROJ_COLORS[h % PROJ_COLORS.length];
  }

  // ---------- 任务 ----------
  var STATUSES = ['todo', 'doing', 'review', 'done'];
  var ORDER_STEP = 1000;

  function addTask(ws, fields) {
    var title = (fields && fields.title || '').trim();
    if (!title) return null;
    var maxOrder = 0;
    ws.tasks.forEach(function (t) { if (t.order > maxOrder) maxOrder = t.order; });
    var task = {
      id: uid(),
      seq: 'TRC-' + nextSeq(ws),
      projectId: fields.projectId || null,
      title: title,
      notes: fields.notes || '',
      status: fields.status && STATUSES.indexOf(fields.status) >= 0 ? fields.status : 'todo',
      priority: fields.priority || null,
      scheduled: fields.scheduled || null,
      due: fields.due || null,
      order: maxOrder + ORDER_STEP,
      createdAt: Date.now(),
      doneAt: null,
    };
    ws.tasks.push(task);
    return task;
  }

  function findTask(ws, id) {
    for (var i = 0; i < ws.tasks.length; i++) if (ws.tasks[i].id === id) return ws.tasks[i];
    return null;
  }

  function tasksByStatus(ws, status) {
    return ws.tasks.filter(function (t) { return t.status === status; })
      .sort(function (a, b) { return a.order - b.order; });
  }

  // 移动/重排：把 id 放进 status 列，落在 beforeId 那张卡之前；beforeId 为 null 放末尾。
  // order 取相邻两卡的中点，避免整列重排（经典的间隙排序）。
  function moveTask(ws, id, status, beforeId) {
    var task = findTask(ws, id);
    if (!task) return;
    var wasDone = task.status === 'done';
    task.status = status;
    if (status === 'done' && !wasDone) task.doneAt = Date.now();
    if (status !== 'done') task.doneAt = null;
    // 目标列里除自己以外的卡，按 order 升序
    var col = ws.tasks.filter(function (t) { return t.status === status && t.id !== id; })
      .sort(function (a, b) { return a.order - b.order; });
    var before = beforeId ? findTask(ws, beforeId) : null;
    var idx = before ? col.indexOf(before) : col.length;
    if (idx < 0) idx = col.length;
    var prev = idx > 0 ? col[idx - 1].order : (col.length ? col[0].order - 2 * ORDER_STEP : 0);
    var next = idx < col.length ? col[idx].order : prev + 2 * ORDER_STEP;
    task.order = (prev + next) / 2;
  }

  function updateTask(ws, id, fields) {
    var task = findTask(ws, id);
    if (!task) return null;
    ['title', 'notes', 'projectId', 'priority', 'scheduled', 'due'].forEach(function (k) {
      if (fields[k] !== undefined) task[k] = k === 'title' ? String(fields[k]).trim() : fields[k];
    });
    return task;
  }

  function deleteTask(ws, id) {
    ws.tasks = ws.tasks.filter(function (t) { return t.id !== id; });
  }

  // ---------- 项目 ----------
  function addProject(ws, fields) {
    var name = (fields && fields.name || '').trim();
    if (!name) return null;
    var p = { id: uid(), name: name, color: projectColor(name), status: 'active', createdAt: Date.now() };
    ws.projects.push(p);
    return p;
  }

  // ---------- 收集箱 ----------
  function addInbox(ws, text) {
    var t = (text || '').trim();
    if (!t) return null;
    var it = { id: uid(), text: t, createdAt: Date.now() };
    ws.inbox.push(it);
    return it;
  }
  function deleteInbox(ws, id) {
    ws.inbox = ws.inbox.filter(function (it) { return it.id !== id; });
  }
  function inboxToTask(ws, id) {
    var it = null;
    ws.inbox.forEach(function (x) { if (x.id === id) it = x; });
    if (!it) return null;
    var task = addTask(ws, { title: it.text });
    deleteInbox(ws, id);
    return task;
  }
  function inboxToNote(ws, id) {
    var it = null;
    ws.inbox.forEach(function (x) { if (x.id === id) it = x; });
    if (!it) return null;
    var note = { id: uid(), title: it.text, body: '', projectId: null, pinned: false,
      createdAt: Date.now(), updatedAt: Date.now() };
    ws.notes.push(note);
    deleteInbox(ws, id);
    return note;
  }
```

然后在 `return {` 的对象里，`emptyWorkspace: emptyWorkspace,` 之后加：

```js
    esc: esc, nextSeq: nextSeq, projectColor: projectColor, STATUSES: STATUSES,
    addTask: addTask, findTask: findTask, tasksByStatus: tasksByStatus,
    moveTask: moveTask, updateTask: updateTask, deleteTask: deleteTask,
    addProject: addProject,
    addInbox: addInbox, deleteInbox: deleteInbox,
    inboxToTask: inboxToTask, inboxToNote: inboxToNote,
```

- [ ] **Step 4: 跑绿**

Run: `node --test test/tracer-model.test.js`
Expected: PASS（原有 + 新增 11 条）。

Run: `node --test test/*.test.js`
Expected: 全绿。

- [ ] **Step 5: 无裸 NUL 检查 + Commit**

```bash
node -e "process.exit(require('fs').readFileSync('skins/tracer/model.js').includes(0)?1:0)" && echo "no NUL"
git add skins/tracer/model.js test/tracer-model.test.js
git commit -m "feat(tracer): model.js 数据操作——任务/项目/收集箱的建改删、间隙排序、HTML 转义"
```

---

### Task 2: app.js 加共享 UI 原语（Tracer.ui：modal、confirm、拖拽）

**Files:**
- Modify: `skins/tracer/app.js`（在 `window.Tracer = {` 之前定义 `ui`，并加进对象）
- Modify: `skins/tracer/index.html`（body 末尾加一个 `<div id="modal-root"></div>`；再 link `board.css`）
- Modify: `skins/tracer/board.css`（新建，先放 modal 样式）
- Test: 无（UI 原语靠后续视图的手工验证；此任务不引入可单测的纯逻辑）

- [ ] **Step 1: index.html 挂载点与样式链接**

`skins/tracer/index.html` 里 `<link rel="stylesheet" href="/skin.css">` 之后加一行：

```html
<link rel="stylesheet" href="/board.css">
```

`</div>`（shell 结束）之后、`<script src="/model.js">` 之前加：

```html
<div id="modal-root" hidden></div>
```

- [ ] **Step 2: 新建 board.css（先放 modal 样式）**

新建 `skins/tracer/board.css`：

```css
/* Tracer 阶段 2 组件样式：弹层、看板、卡片、收集箱。与 skin.css（壳+主题）分开。 */

/* ---------- 弹层 ---------- */
#modal-root {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  background: rgba(6, 7, 9, .55);
  backdrop-filter: blur(2px);
}
#modal-root[hidden] { display: none; }
.modal {
  width: 420px; max-width: calc(100vw - 40px);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, .5), 0 0 0 1px rgba(255,255,255,.02);
  padding: 18px 18px 16px;
  animation: modal-in .16s ease;
}
@keyframes modal-in { from { opacity: 0; transform: translateY(6px) scale(.985); } to { opacity: 1; transform: none; } }
.modal h2 { margin: 0 0 14px; font-size: 15px; font-weight: 650; }
.modal label { display: block; font-size: 11px; color: var(--muted); margin: 10px 0 4px; letter-spacing: .3px; }
.modal input[type=text], .modal textarea, .modal select {
  width: 100%; box-sizing: border-box;
  background: var(--bg); color: var(--fg);
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 8px 10px; font: inherit; font-size: 13px;
}
.modal input:focus, .modal textarea:focus, .modal select:focus {
  outline: none; border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.modal textarea { resize: vertical; min-height: 60px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.btn {
  font: inherit; font-size: 12.5px; font-weight: 550;
  padding: 7px 13px; border-radius: var(--radius);
  border: 1px solid var(--border); background: var(--surface); color: var(--fg);
  cursor: pointer;
}
.btn:hover { background: var(--border); }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #0d0e10; }
.btn-primary:hover { filter: brightness(1.08); }
.btn-danger { color: #e86a8a; }
.btn-danger:hover { background: rgba(232, 106, 138, .12); }
```

- [ ] **Step 3: app.js 里定义 ui 并挂上 Tracer**

在 `app.js` 里 `window.Tracer = {` 这一行**之前**插入：

```js
  // ---------- 共享 UI 原语 ----------
  // modal(render) 打开一个弹层：render(close) 返回内容 DOM，close([result]) 关闭。
  // 视图模块用它做建卡/编辑/建项目对话框，样式在 board.css。
  var modalRoot = document.getElementById('modal-root');

  function closeModal() {
    modalRoot.hidden = true;
    modalRoot.innerHTML = '';
    document.removeEventListener('keydown', modalEsc);
  }
  function modalEsc(e) { if (e.key === 'Escape') closeModal(); }

  function modal(build) {
    modalRoot.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'modal';
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    build(box, closeModal);
    modalRoot.appendChild(box);
    modalRoot.hidden = false;
    // 点遮罩关闭；Esc 关闭。
    modalRoot.onclick = closeModal;
    document.addEventListener('keydown', modalEsc);
    // 自动聚焦第一个输入
    var first = box.querySelector('input, textarea, select');
    if (first) first.focus();
  }

  // 危险确认框：confirm(msg, onYes)
  function confirmModal(msg, onYes) {
    modal(function (box, close) {
      var h = document.createElement('h2'); h.textContent = msg;
      var acts = document.createElement('div'); acts.className = 'modal-actions';
      var cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancel';
      cancel.onclick = close;
      var ok = document.createElement('button'); ok.className = 'btn btn-danger'; ok.textContent = 'Delete';
      ok.onclick = function () { close(); onYes(); };
      acts.appendChild(cancel); acts.appendChild(ok);
      box.appendChild(h); box.appendChild(acts);
    });
  }

  // pointer 拖拽原语：makeDraggable(el, opts)
  // opts.onDrop(draggedEl, targetCol, beforeEl) 在松手时调用。
  // 拖拽用 pointermove 计算最近的插入位，视图负责实际数据移动 + 重绘。
  // 详见 board.js 的用法；这里只暴露一个薄封装。
  function dragList(container, opts) {
    var dragging = null, ghostBefore = null;
    container.addEventListener('pointerdown', function (e) {
      var card = e.target.closest(opts.itemSelector);
      if (!card || e.button !== 0) return;
      // 输入框/按钮上的按压不触发拖拽
      if (e.target.closest('button, input, textarea, a')) return;
      dragging = card;
      card.setPointerCapture(e.pointerId);
      card.classList.add('dragging');
    });
    container.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var col = document.elementFromPoint(e.clientX, e.clientY);
      col = col && col.closest(opts.colSelector);
      if (!col) return;
      // 找该列中鼠标下方最近的卡片，插到它前面
      var cards = Array.prototype.slice.call(col.querySelectorAll(opts.itemSelector))
        .filter(function (c) { return c !== dragging; });
      ghostBefore = null;
      for (var i = 0; i < cards.length; i++) {
        var r = cards[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { ghostBefore = cards[i]; break; }
      }
      opts.onHover && opts.onHover(col, ghostBefore, dragging);
    });
    container.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      var el = dragging; dragging = null;
      el.classList.remove('dragging');
      var col = document.elementFromPoint(e.clientX, e.clientY);
      col = col && col.closest(opts.colSelector);
      if (col) opts.onDrop(el, col, ghostBefore);
      else opts.onCancel && opts.onCancel();
      ghostBefore = null;
    });
    container.addEventListener('pointercancel', function () {
      if (dragging) { dragging.classList.remove('dragging'); dragging = null; }
    });
  }
```

然后把这些加进 `window.Tracer = {` 对象（在 `currentSec: ...` 之后）：

```js
    ui: { modal: modal, closeModal: closeModal, confirm: confirmModal, dragList: dragList },
```

- [ ] **Step 4: 语法检查 + 冒烟 + Commit**

```bash
node --check skins/tracer/app.js
node --test test/*.test.js   # 应仍全绿（没动测试，只加了 UI 代码）
node -e "process.exit(require('fs').readFileSync('skins/tracer/app.js').includes(0)?1:0)" && echo "no NUL"
git add skins/tracer/app.js skins/tracer/index.html skins/tracer/board.css
git commit -m "feat(tracer): Tracer.ui 共享 UI 原语——modal/confirm/pointer 拖拽 + 弹层样式"
```

（手工验证放到 Task 5 一起做——单独现在起服务看不到 modal，它要视图触发。）

> **执行后记（Task 2 质量审查，已用无头浏览器实测）**：modal/confirm 半边验证干净，
> z-index 被小窗盖住的担忧经实测证伪（`.shell` 的 `z-index:1` 层叠上下文把小窗 9999
> 关在内部，modal-root 是 body 级别稳压其上）。需要修的：
> ① **dragList 的 pointer capture 会在 onHover 重挂 DOM 时被释放**，导致在 `.board`
> 外松手时 `pointerup` 收不到 → onDrop/onCancel 不触发、卡片卡住半透明。修法：把
> `pointermove`/`pointerup`/`pointercancel` 挂到 `document` 上（拖拽开始时 add、结束时
> remove），不依赖 capture 存活——参照 `public/reader.js` 自己的拖拽写法。
> ② `pointercancel` 分支要和 `pointerup` 的 miss 分支走同一个 finalize：调 onCancel、
> 清 ghostBefore。③ 保险：给 `#modal-root` 显式 `z-index: 10000`（别只依赖 shell 陷阱）；
> `closeModal` 里 `modalRoot.onclick = null`。这些在 Task 3 落地后作为一个 dragList 修复提交。

---

### Task 3: Inbox 视图

**Files:**
- Create: `skins/tracer/inbox.js`
- Modify: `skins/tracer/index.html`（`<script src="/app.js">` 之后加 `<script src="/inbox.js">`）
- Modify: `skins/tracer/board.css`（加 inbox 样式）

- [ ] **Step 1: inbox.js**

新建 `skins/tracer/inbox.js`：

```js
(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-inbox');

  function render() {
    var ws = T.store.data;
    var items = ws.inbox.slice().reverse(); // 新的在上
    var html = '<header class="sec-head"><h1>Inbox</h1>'
      + '<span class="sec-sub">Capture first, sort later</span></header>'
      + '<form class="inbox-add" id="inbox-add">'
      + '<input type="text" id="inbox-input" placeholder="Type a thought and press Enter…" autocomplete="off">'
      + '</form>';
    if (!items.length) {
      html += '<div class="empty"><svg class="empty-art" viewBox="0 0 96 72"><use href="#moon-art"/></svg>'
        + '<div class="empty-title">Inbox zero</div>'
        + '<div class="empty-sub">Capture a thought with one line — sort it later.</div></div>';
    } else {
      html += '<ul class="inbox-list">';
      items.forEach(function (it) {
        html += '<li class="inbox-item" data-id="' + it.id + '">'
          + '<span class="inbox-text">' + M.esc(it.text) + '</span>'
          + '<span class="inbox-acts">'
          + '<button class="chip" data-act="task">→ Task</button>'
          + '<button class="chip" data-act="note">→ Note</button>'
          + '<button class="chip chip-del" data-act="del" title="Delete">✕</button>'
          + '</span></li>';
      });
      html += '</ul>';
    }
    sec.innerHTML = html;

    document.getElementById('inbox-add').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = document.getElementById('inbox-input');
      if (M.addInbox(ws, inp.value)) { T.touch(); render(); }
    });
    sec.querySelector('.inbox-list') && sec.querySelector('.inbox-list').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var id = btn.closest('.inbox-item').dataset.id;
      var act = btn.dataset.act;
      if (act === 'task') M.inboxToTask(ws, id);
      else if (act === 'note') M.inboxToNote(ws, id);
      else if (act === 'del') M.deleteInbox(ws, id);
      T.touch(); render();
    });
  }

  T.onShow('inbox', render);
})();
```

- [ ] **Step 2: board.css 加 inbox 样式**

追加到 `skins/tracer/board.css`：

```css
/* ---------- 收集箱 ---------- */
.inbox-add { margin-bottom: 16px; }
#inbox-input {
  width: 100%; box-sizing: border-box;
  background: var(--surface); color: var(--fg);
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 11px 14px; font: inherit; font-size: 14px;
}
#inbox-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.inbox-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.inbox-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: var(--radius);
  background: var(--surface); border: 1px solid var(--border);
}
.inbox-item:hover { border-color: #34373f; }
.inbox-text { flex: 1; font-size: 13.5px; word-break: break-word; }
.inbox-acts { display: flex; gap: 5px; flex: none; }
.chip {
  font: inherit; font-size: 11.5px; padding: 4px 9px;
  border-radius: 5px; border: 1px solid var(--border);
  background: var(--panel); color: var(--muted); cursor: pointer;
}
.chip:hover { color: var(--fg); border-color: var(--accent); }
.chip-del:hover { color: #e86a8a; border-color: #e86a8a; }
```

- [ ] **Step 3: index.html 挂脚本**

`<script src="/app.js"></script>` 之后加：

```html
<script src="/inbox.js"></script>
```

- [ ] **Step 4: 检查 + Commit**

```bash
node --check skins/tracer/inbox.js
node -e "process.exit(require('fs').readFileSync('skins/tracer/inbox.js').includes(0)?1:0)" && echo "no NUL"
node --test test/*.test.js
git add skins/tracer/inbox.js skins/tracer/index.html skins/tracer/board.css
git commit -m "feat(tracer): Inbox 视图——一行速记、转任务/转笔记/删除"
```

---

### Task 4: Board 视图 + 拖拽

**Files:**
- Create: `skins/tracer/board.js`
- Modify: `skins/tracer/index.html`（`<script src="/inbox.js">` 之后加 `<script src="/board.js">`）
- Modify: `skins/tracer/board.css`（加看板/卡片样式）

- [ ] **Step 1: board.js**

新建 `skins/tracer/board.js`：

```js
(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-board');
  var COLS = [
    { key: 'todo', label: 'Todo' },
    { key: 'doing', label: 'In Progress' },
    { key: 'review', label: 'In Review' },
    { key: 'done', label: 'Done' },
  ];

  function projById(ws, id) {
    var p = null; ws.projects.forEach(function (x) { if (x.id === id) p = x; }); return p;
  }

  function cardHtml(ws, t) {
    var p = projById(ws, t.projectId);
    var tags = '';
    if (p) tags += '<span class="card-proj"><i style="background:' + p.color + '"></i>' + M.esc(p.name) + '</span>';
    if (t.priority === 'high') tags += '<span class="card-pri">High</span>';
    return '<div class="card" data-id="' + t.id + '" tabindex="0">'
      + '<div class="card-title">' + M.esc(t.title) + '</div>'
      + '<div class="card-meta"><span class="card-seq">' + M.esc(t.seq) + '</span>' + tags + '</div>'
      + '</div>';
  }

  function render() {
    var ws = T.store.data;
    var filter = T.projectFilter ? T.projectFilter() : null;
    var html = '<header class="sec-head"><h1>Board</h1>'
      + '<span class="sec-sub">Todo · In Progress · In Review · Done</span></header>'
      + '<div class="board">';
    COLS.forEach(function (c) {
      var cards = M.tasksByStatus(ws, c.key).filter(function (t) {
        return !filter || t.projectId === filter;
      });
      html += '<div class="col" data-col="' + c.key + '">'
        + '<div class="col-head"><span>' + c.label + '</span>'
        + '<span class="col-count">' + cards.length + '</span></div>'
        + '<div class="col-body" data-col="' + c.key + '">';
      cards.forEach(function (t) { html += cardHtml(ws, t); });
      html += '</div>'
        + '<button class="col-add" data-col="' + c.key + '">+ Add</button>'
        + '</div>';
    });
    html += '</div>';
    sec.innerHTML = html;
    wire(ws);
  }

  function wire(ws) {
    // 建卡
    sec.querySelectorAll('.col-add').forEach(function (btn) {
      btn.addEventListener('click', function () { quickAdd(ws, btn.dataset.col); });
    });
    // 点卡片开编辑
    sec.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('click', function () { editTask(ws, card.dataset.id); });
    });
    // 拖拽
    T.ui.dragList(sec.querySelector('.board'), {
      itemSelector: '.card',
      colSelector: '.col-body',
      onHover: function (col, before, dragged) {
        if (before) col.insertBefore(dragged, before); else col.appendChild(dragged);
      },
      onDrop: function (el, col, before) {
        M.moveTask(ws, el.dataset.id, col.dataset.col, before ? before.dataset.id : null);
        T.touch(); render();
      },
      // 取消（在看板外松手/pointercancel）时整列重绘，把 onHover 期间挪动的
      // DOM 还原到数据真相，否则卡片会停在预览落点直到下次 render。
      onCancel: function () { render(); },
    });
  }

  function quickAdd(ws, status) {
    var t = M.addTask(ws, { title: 'New task', status: status });
    T.touch();
    render();
    // 建完直接进编辑，方便改标题
    editTask(ws, t.id);
  }

  function editTask(ws, id) {
    var t = M.findTask(ws, id);
    if (!t) return;
    T.ui.modal(function (box, close) {
      var projOpts = '<option value="">No project</option>';
      ws.projects.forEach(function (p) {
        projOpts += '<option value="' + p.id + '"' + (p.id === t.projectId ? ' selected' : '') + '>' + M.esc(p.name) + '</option>';
      });
      box.innerHTML =
        '<h2>' + M.esc(t.seq) + '</h2>'
        + '<label>Title</label><input type="text" id="f-title" value="' + M.esc(t.title) + '">'
        + '<label>Notes</label><textarea id="f-notes">' + M.esc(t.notes) + '</textarea>'
        + '<label>Project</label><select id="f-proj">' + projOpts + '</select>'
        + '<label>Priority</label><select id="f-pri">'
        + '<option value="">Normal</option><option value="high"' + (t.priority === 'high' ? ' selected' : '') + '>High</option></select>'
        + '<div class="modal-actions">'
        + '<button class="btn btn-danger" id="f-del">Delete</button>'
        + '<span style="flex:1"></span>'
        + '<button class="btn" id="f-cancel">Cancel</button>'
        + '<button class="btn btn-primary" id="f-save">Save</button></div>';
      box.querySelector('#f-cancel').onclick = close;
      box.querySelector('#f-save').onclick = function () {
        M.updateTask(ws, id, {
          title: box.querySelector('#f-title').value,
          notes: box.querySelector('#f-notes').value,
          projectId: box.querySelector('#f-proj').value || null,
          priority: box.querySelector('#f-pri').value || null,
        });
        T.touch(); close(); render();
      };
      box.querySelector('#f-del').onclick = function () {
        close();
        T.ui.confirm('Delete this task?', function () { M.deleteTask(ws, id); T.touch(); render(); });
      };
    });
  }

  T.onShow('board', render);
  // 顶栏 +New 和项目过滤会调它
  T.renderBoard = render;
  // 顶栏 +New 建卡后打开编辑弹层
  T.editLastTask = function (id) { editTask(T.store.data, id); };
})();
```

- [ ] **Step 2: board.css 加看板样式**

追加到 `skins/tracer/board.css`：

```css
/* ---------- 看板 ---------- */
.board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: start; }
.col { display: flex; flex-direction: column; min-height: 120px; }
.col-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 2px 6px 8px; font-size: 12px; font-weight: 600; color: var(--muted);
  letter-spacing: .3px;
}
.col-count {
  font-size: 11px; font-weight: 600; color: var(--muted);
  background: var(--surface); border-radius: 10px; padding: 1px 7px; min-width: 18px; text-align: center;
}
.col-body { display: flex; flex-direction: column; gap: 7px; min-height: 24px; }
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 9px 11px; cursor: pointer;
  transition: border-color .12s ease, transform .06s ease;
}
.card:hover { border-color: #34373f; }
.card:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.card.dragging { opacity: .55; }
.card-title { font-size: 13.5px; line-height: 1.4; margin-bottom: 7px; word-break: break-word; }
.card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.card-seq { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
.card-proj { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--muted); }
.card-proj i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.card-pri { font-size: 10.5px; font-weight: 600; color: #e86a8a; background: rgba(232,106,138,.12); padding: 1px 6px; border-radius: 4px; }
.col-add {
  margin-top: 7px; font: inherit; font-size: 12px; color: var(--muted);
  background: transparent; border: 1px dashed var(--border); border-radius: var(--radius);
  padding: 6px; cursor: pointer;
}
.col-add:hover { color: var(--fg); border-color: var(--accent); }
```

- [ ] **Step 3: index.html 挂脚本**

`<script src="/inbox.js"></script>` 之后加：

```html
<script src="/board.js"></script>
```

- [ ] **Step 4: 检查 + Commit**

```bash
node --check skins/tracer/board.js
node -e "process.exit(require('fs').readFileSync('skins/tracer/board.js').includes(0)?1:0)" && echo "no NUL"
node --test test/*.test.js
git add skins/tracer/board.js skins/tracer/index.html skins/tracer/board.css
git commit -m "feat(tracer): Board 视图——四列看板、建卡/编辑/删除、pointer 拖拽换列换序"
```

---

### Task 5: 项目列表 + 顶栏 +New + 手工验证

**Files:**
- Create: `skins/tracer/projects.js`
- Modify: `skins/tracer/index.html`（顶栏加 `+ New`；末尾挂 `projects.js`）
- Modify: `skins/tracer/app.js`（`+ New` 事件 + `Tracer.projectFilter`）
- Modify: `skins/tracer/board.css`（项目列表 + +New 按钮样式）

- [ ] **Step 1: 顶栏 +New 按钮**

`skins/tracer/index.html` 顶栏 `.top-right` 里，`<span class="dial">` **之前**加：

```html
    <button class="new-btn" id="new-btn" title="New task">+ New</button>
```

- [ ] **Step 2: projects.js**

新建 `skins/tracer/projects.js`：

```js
(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var list = document.getElementById('proj-list');
  var filterId = null; // 当前过滤的项目 id，null = 全部

  T.projectFilter = function () { return filterId; };

  function render() {
    var ws = T.store.data;
    var html = '<a class="proj-item proj-all' + (filterId === null ? ' active' : '') + '" data-id="">All tasks</a>';
    ws.projects.forEach(function (p) {
      html += '<a class="proj-item' + (filterId === p.id ? ' active' : '') + '" data-id="' + p.id + '">'
        + '<i style="background:' + p.color + '"></i>' + M.esc(p.name) + '</a>';
    });
    html += '<button class="proj-add" id="proj-add">+ New project</button>';
    list.innerHTML = html;

    list.querySelectorAll('.proj-item').forEach(function (a) {
      a.addEventListener('click', function () {
        filterId = a.dataset.id || null;
        render();
        T.show('board');
        if (T.renderBoard) T.renderBoard();
      });
    });
    document.getElementById('proj-add').addEventListener('click', addProjectDialog);
  }

  function addProjectDialog() {
    T.ui.modal(function (box, close) {
      box.innerHTML = '<h2>New project</h2>'
        + '<label>Name</label><input type="text" id="p-name" placeholder="e.g. API redesign">'
        + '<div class="modal-actions"><button class="btn" id="p-cancel">Cancel</button>'
        + '<button class="btn btn-primary" id="p-save">Create</button></div>';
      box.querySelector('#p-cancel').onclick = close;
      box.querySelector('#p-save').onclick = function () {
        if (M.addProject(T.store.data, { name: box.querySelector('#p-name').value })) {
          T.touch(); close(); render();
        }
      };
      box.querySelector('#p-name').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') box.querySelector('#p-save').click();
      });
    });
  }

  T.renderProjects = render;
  T.ready.then(function (ws) { if (ws) render(); });
})();
```

- [ ] **Step 3: app.js +New 接线**

`board.js` 的 `editLastTask` 已在 Task 4 Step 1 导出（`T.editLastTask = ...`），本步只在 app.js 接线。

在 `app.js` 尾部（`show(saved || 'board')` 之前）加。注意 app.js 自身就是定义 `window.Tracer` 的地方，回调里一律用 `window.Tracer`（`M` 用顶部已有的 `window.TracerModel`，`store`/`touch`/`show` 是 app.js 内部已有的局部量）：

```js
  // 顶栏 +New：任意分区都先切到 board，建一张卡并打开编辑弹层
  var newBtn = document.getElementById('new-btn');
  if (newBtn) newBtn.addEventListener('click', function () {
    if (!store.data) return;
    var t = M.addTask(store.data, { title: 'New task', status: 'todo' });
    touch();
    show('board');
    if (window.Tracer.renderBoard) window.Tracer.renderBoard();
    if (window.Tracer.editLastTask) window.Tracer.editLastTask(t.id);
  });
```

- [ ] **Step 4: board.css 项目列表 + +New 样式**

追加：

```css
/* ---------- 侧栏项目列表 ---------- */
.proj-item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 11px; border-radius: var(--radius);
  color: var(--muted); font-size: 13px; cursor: pointer; user-select: none;
}
.proj-item i { width: 9px; height: 9px; border-radius: 3px; flex: none; }
.proj-item.proj-all { color: var(--muted); }
.proj-item:hover { background: var(--surface); color: var(--fg); }
.proj-item.active { background: var(--accent-soft); color: var(--fg); }
.proj-add {
  margin: 6px 6px 0; font: inherit; font-size: 12px; color: var(--muted);
  background: transparent; border: none; cursor: pointer; padding: 5px;
  text-align: left;
}
.proj-add:hover { color: var(--accent); }

/* ---------- 顶栏 +New ---------- */
.new-btn {
  font: inherit; font-size: 12.5px; font-weight: 550;
  padding: 5px 12px; border-radius: 14px;
  border: 1px solid var(--accent-soft);
  background: var(--accent-soft); color: var(--accent);
  cursor: pointer; transition: background-color 2s ease, color 2s ease;
}
.new-btn:hover { filter: brightness(1.15); }
```

- [ ] **Step 5: index.html 挂脚本**

`<script src="/board.js"></script>` 之后加：

```html
<script src="/projects.js"></script>
```

- [ ] **Step 6: 全量测试 + 手工验证（浏览器）**

```bash
node --test test/*.test.js       # 全绿
node --check skins/tracer/projects.js
```

起服务 `DOCS_PORTAL_SKIN=tracer node server.js`，浏览器 `http://127.0.0.1:8080/` 核对：

1. **Inbox**：输入框打字回车 → 出现在列表顶部；`→ Task` 把它变成 Board 上的卡片、从 Inbox 消失；`→ Note` 同理；`✕` 删除。刷新后仍在（已存盘）。
2. **Board**：每列 `+ Add` 建卡并弹出编辑；改标题/项目/优先级/备注保存后卡片更新；拖卡片到别的列、拖到列内不同位置都生效且刷新后保持；`Delete` 走确认框。
3. **项目**：侧栏 `+ New project` 建项目 → 出现在列表且有色点；点某项目 → Board 只显示该项目的卡；点 All tasks 复位。编辑卡片时能把它归到某项目，卡片上显示项目色点+名。
4. **+New**（顶栏）：任意分区点它 → 跳到 Board 并弹出新卡编辑。
5. **保存状态点**：任何改动后头像角标闪灰→回绿；`data/workspace.json` 里能看到数据。
6. 全程无 `novel/小说`；控制台无报错。

- [ ] **Step 7: Commit**

```bash
node -e "process.exit(require('fs').readFileSync('skins/tracer/projects.js').includes(0)?1:0)" && echo "no NUL"
git add skins/tracer/projects.js skins/tracer/board.js skins/tracer/app.js skins/tracer/index.html skins/tracer/board.css
git commit -m "feat(tracer): 项目列表与过滤、顶栏 +New；Board/Inbox 阶段 2 完成"
```

---

## 阶段边界

本计划**不含**（后续阶段）：Notes 的 markdown 编辑器（阶段 3）、Planner/Timeline（阶段 4）、Project Map 脑图/Insights（阶段 5）、游戏移植与默认皮肤切换（阶段 6）、`Ctrl+K` 命令面板（阶段 7）。任务的 `scheduled`/`due` 字段本阶段已建模但只在编辑弹层里可改，Planner/Timeline 消费它们留到阶段 4。

## 已知的阶段 2 内偏差与收尾提醒

- Task 5 的 `+New` 依赖 `board.js` 暴露 `editLastTask`——执行 Task 4 时若未加，Task 5 Step 3 补上并说明。
- 拖拽 `dragList` 在触屏/极窄列下未测；本阶段只保桌面鼠标路径。
- **阶段 2 终审 Critical（已修）**：dragList 无移动阈值导致真实鼠标点击卡片触发 onDrop、销毁 DOM、编辑器打不开——加 4px 阈值后点击开编辑、拖动才移动。
- **记入阶段 3 清理**：① `+New` 触发 Board 双重渲染（app.js 里 `show('board')` 已 runHooks 一次，紧接着又显式 `renderBoard()`）——去掉显式那次。② 连点 `+Add` 会连建多张 New task 卡（遮罩挡着风险低，可加建卡节流或建后不立即再允许建）。
- 项目暂不可删/改色（YAGNI，等有需求再加）。
- `moveTask` 的间隙排序在极端多次「反复插同一位」后 order 可能精度耗尽（质量审查实测：只往同一条缝反复塞不同卡，第 53 次出现首个 order 相等；碰撞后只是该缝内相对顺序不稳，不产 NaN 不抛错）。阶段可接受；真需要时加整列 renormalize（相邻 order 差 <1 时把该列重排成 STEP,2·STEP…）。
- **Task 4 执行时顺手修**：`updateTask` 对 title 只 trim 不校验非空，用户清空标题点 Save 会得到空标题卡（Task 1 质量审查 Minor）。在 model.js 的 `updateTask` 里对 title 改成「trim 后为空则跳过该字段」：`if (k === 'title') { var v = String(fields[k]).trim(); if (v) task[k] = v; } else if (fields[k] !== undefined) task[k] = fields[k];`。改完给 tracer-model.test.js 补一条「updateTask 空标题保持原值」的断言。
