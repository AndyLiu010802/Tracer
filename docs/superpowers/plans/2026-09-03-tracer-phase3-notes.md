# Tracer 阶段 3：Notes + Markdown 编辑器 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notes 分区成为真实可用的笔记视图：左列笔记清单（置顶 + 按更新时间排），右侧编辑区手写 Markdown，`Ctrl+E` 在编辑/渲染预览间切换，自动保存。渲染只认白名单语法、全程 HTML 转义。顺带收掉阶段 2 遗留的两条清理项。

**Architecture:** Markdown 渲染是 `model.js` 的纯函数 `renderMarkdown(src)`（可单测，安全第一——先转义再套白名单标签）；Notes 视图 `notes.js` 通过 `Tracer.onShow('notes', render)` 注册，改数据调 `Tracer.touch()`；笔记 CRUD 复用/扩充 model 的 notes 操作。样式进 `notes.css`（与 board.css 分离，各分区组件样式独立成文件）。

**Tech Stack:** 纯 Node 标准库 + 原生 DOM，ES5 皮肤 JS，`node --test`。

**Spec:** `docs/superpowers/specs/2026-09-02-tracer-skin-design.md`（Notes 那一行：手写 Markdown，`Ctrl+E` 编辑/渲染预览切换，自动保存，支持标题/粗斜体/列表/代码块/引用/链接，渲染时 HTML 全转义）。

**上下文（给零背景的执行者）：**
- Tracer 是本地伪装工作台皮肤（`skins/tracer/`，零 npm 依赖纯 Node）。阶段 1（壳+主题+存储）、阶段 2（Board+Inbox+项目）已交付。
- **数据模型**（`skins/tracer/model.js` 的 note 形状，已由 inboxToNote 定义）：`{id, title, body(markdown), projectId, pinned, createdAt, updatedAt}`。工作区 `store.data.notes` 是数组。
- **装配 API**（`window.Tracer`）：`store.data`、`touch()`（改完调，防抖存盘）、`onShow(sec, fn)`（分区进场钩子，只在数据就绪后触发）、`currentSec()`、`ready`、`ui:{modal, confirm, ...}`。
- model：`window.TracerModel`（`esc`、`uid`、已有的 notes 相关）。
- 皮肤 JS 用 ES5（`var`/`function`），注释中文、界面英文、禁「novel/小说」。用 Write/Edit 写文件，写完查裸 NUL（`node -e "process.exit(require('fs').readFileSync(F).includes(0)?1:0)"`）。
- 有其他会话并行改 farm 相关文件——**只 add 自己的文件**，别碰工作区其他脏文件。
- **安全第一**：Markdown 渲染绝不能开 XSS 口子。渲染策略必须是「先把整段 esc 转义，再在转义后的文本上套白名单语法」，绝不 innerHTML 未转义的用户输入。链接的 href 要挡 `javascript:` 协议。

## 文件结构

```
skins/tracer/
  model.js   + renderMarkdown（纯函数，安全渲染）+ notes CRUD（addNote/updateNote/deleteNote/togglePin/notesSorted），扩充导出
  notes.js   新：Notes 视图（清单 + 编辑器 + Ctrl+E 切换）
  notes.css  新：Notes 布局与 markdown 渲染样式
  index.html + link notes.css、挂 notes.js
  app.js     清理：+New 双重渲染（删一行）
  board.js   清理：连点 +Add 建卡节流
```

---

### Task 1: model.js —— renderMarkdown（安全渲染）+ notes CRUD

**Files:**
- Modify: `skins/tracer/model.js`（在 inbox 操作之后、`return {` 之前加；导出对象补键）
- Test: `test/tracer-model.test.js`（追加）

- [ ] **Step 1: 写失败的测试**

在 `test/tracer-model.test.js` 末尾追加：

```js
// ---------- 阶段 3：Notes ----------

test('renderMarkdown 转义 HTML 特殊字符（安全第一）', () => {
  const h = M.renderMarkdown('<script>alert(1)</script>');
  assert.ok(h.indexOf('<script>') < 0, '不得出现真实 script 标签');
  assert.ok(h.indexOf('&lt;script&gt;') >= 0, '尖括号应被转义');
});

test('renderMarkdown 标题', () => {
  assert.ok(/<h1>Title<\/h1>/.test(M.renderMarkdown('# Title')));
  assert.ok(/<h2>Sub<\/h2>/.test(M.renderMarkdown('## Sub')));
  assert.ok(/<h3>Deep<\/h3>/.test(M.renderMarkdown('### Deep')));
});

test('renderMarkdown 粗体斜体行内代码', () => {
  assert.ok(/<strong>bold<\/strong>/.test(M.renderMarkdown('**bold**')));
  assert.ok(/<em>it<\/em>/.test(M.renderMarkdown('*it*')));
  assert.ok(/<code>c<\/code>/.test(M.renderMarkdown('`c`')));
});

test('renderMarkdown 无序/有序列表', () => {
  const ul = M.renderMarkdown('- a\n- b');
  assert.ok(/<ul>/.test(ul) && /<li>a<\/li>/.test(ul) && /<li>b<\/li>/.test(ul));
  const ol = M.renderMarkdown('1. x\n2. y');
  assert.ok(/<ol>/.test(ol) && /<li>x<\/li>/.test(ol));
});

test('renderMarkdown 引用与代码块', () => {
  assert.ok(/<blockquote>quote<\/blockquote>/.test(M.renderMarkdown('> quote')));
  const code = M.renderMarkdown('```\nline1\nline2\n```');
  assert.ok(/<pre><code>/.test(code), '围栏代码块');
  assert.ok(code.indexOf('line1') >= 0 && code.indexOf('line2') >= 0);
});

test('renderMarkdown 代码块内不解析 markdown、内容转义', () => {
  const code = M.renderMarkdown('```\n**not bold** <x>\n```');
  assert.ok(code.indexOf('<strong>') < 0, '代码块内不加粗');
  assert.ok(code.indexOf('&lt;x&gt;') >= 0, '代码块内容仍转义');
});

test('renderMarkdown 链接白名单：http/https/相对可，javascript: 挡掉', () => {
  const ok = M.renderMarkdown('[t](https://example.com)');
  assert.ok(/<a href="https:\/\/example\.com"[^>]*>t<\/a>/.test(ok));
  const js = M.renderMarkdown('[x](javascript:alert(1))');
  assert.ok(js.indexOf('javascript:') < 0, 'javascript: 协议必须被剥掉');
  assert.ok(js.indexOf('href="#"') >= 0 || /<a href="#"/.test(js), '危险链接降级为 #');
});

test('renderMarkdown 链接文本仍转义', () => {
  const h = M.renderMarkdown('[<b>](https://e.com)');
  assert.ok(h.indexOf('<b>') < 0 && h.indexOf('&lt;b&gt;') >= 0);
});

test('addNote / updateNote / deleteNote / togglePin', () => {
  const ws = M.emptyWorkspace();
  const n = M.addNote(ws, { title: 'First' });
  assert.strictEqual(n.title, 'First');
  assert.strictEqual(n.body, '');
  assert.strictEqual(n.pinned, false);
  assert.ok(n.id && typeof n.createdAt === 'number' && typeof n.updatedAt === 'number');
  assert.strictEqual(ws.notes.length, 1);

  const before = n.updatedAt;
  M.updateNote(ws, n.id, { title: 'Renamed', body: '# hi' });
  assert.strictEqual(n.title, 'Renamed');
  assert.strictEqual(n.body, '# hi');
  assert.ok(n.updatedAt >= before, 'updatedAt 应刷新');

  M.togglePin(ws, n.id);
  assert.strictEqual(n.pinned, true);
  M.togglePin(ws, n.id);
  assert.strictEqual(n.pinned, false);

  M.deleteNote(ws, n.id);
  assert.strictEqual(ws.notes.length, 0);
});

test('addNote 空标题也允许（笔记可以先建后命名，默认 Untitled）', () => {
  const ws = M.emptyWorkspace();
  const n = M.addNote(ws, {});
  assert.strictEqual(n.title, 'Untitled');
  assert.strictEqual(ws.notes.length, 1);
});

test('notesSorted 置顶在前，其余按 updatedAt 倒序', () => {
  const ws = M.emptyWorkspace();
  const a = M.addNote(ws, { title: 'A' });
  const b = M.addNote(ws, { title: 'B' });
  const c = M.addNote(ws, { title: 'C' });
  // 制造明确的 updatedAt 次序：手动设，避免同毫秒
  a.updatedAt = 100; b.updatedAt = 300; c.updatedAt = 200;
  M.togglePin(ws, a.id); // a 置顶
  const sorted = M.notesSorted(ws);
  assert.strictEqual(sorted[0].title, 'A', '置顶的 A 第一');
  assert.deepStrictEqual(sorted.slice(1).map((n) => n.title), ['B', 'C'], '其余按 updatedAt 倒序');
});
```

- [ ] **Step 2: 跑红**

Run: `node --test test/tracer-model.test.js`
Expected: FAIL —— `M.renderMarkdown is not a function` 等。

- [ ] **Step 3: 实现**

在 `skins/tracer/model.js` 的 `inboxToNote` 函数之后、`return {` 之前插入：

```js
  // ---------- Markdown 安全渲染 ----------
  // 安全第一：整体思路是「先切成块，再逐块把纯文本 esc 转义，最后只在转义后的
  // 文本上套白名单标签」。任何时候都不会把未转义的用户输入塞进 innerHTML。
  // 支持：# 标题、- / 1. 列表、> 引用、``` 围栏代码块、**粗** *斜* `码`、[文](url)。
  // 未覆盖的语法原样按普通段落走（已转义），不会破坏页面。

  // 行内：在已 esc 的文本上做粗/斜/码/链接替换。
  // 注意替换顺序：先行内代码（其内部不再解析粗斜），再链接，再粗，再斜。
  function inlineMd(escaped) {
    var s = escaped;
    // 行内代码：`x` → <code>x</code>（内容已经是 esc 过的，直接包）
    s = s.replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
    // 链接 [text](url)：text 已 esc；url 需校验协议
    s = s.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, text, url) {
      return '<a href="' + safeUrl(url) + '" target="_blank" rel="noopener">' + text + '</a>';
    });
    // 粗 **x**（先于斜体，避免 * 冲突）
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 斜 *x*
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return s;
  }

  // 链接协议白名单，防 javascript:/data: 注入。判定用「去掉控制字符再小写」的
  // 副本（挡 `java\tscript:` 之类的绕过），放行的 href 用 esc(原值) 防属性注入。
  // 规则：① http(s)/mailto 绝对链接放行；② 不含冒号的一律视作相对链接放行
  // （/path、#anchor、page.html）；③ 含冒号但非白名单协议 → 降级为 #。
  function safeUrl(url) {
    var u = String(url);
    var lower = u.toLowerCase().replace(/[\x00-\x20]/g, '');
    if (/^(https?:|mailto:)/.test(lower)) return esc(u);
    if (lower.indexOf(':') < 0) return esc(u);
    return '#';
  }

  function renderMarkdown(src) {
    var lines = String(src == null ? '' : src).split(/\r?\n/);
    var out = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      // 围栏代码块 ```
      if (/^```/.test(line)) {
        var buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(esc(lines[i])); i++; }
        i++; // 跳过收尾 ```
        out.push('<pre><code>' + buf.join('\n') + '</code></pre>');
        continue;
      }
      // 标题 # ## ###
      var hm = /^(#{1,3})\s+(.*)$/.exec(line);
      if (hm) {
        var lvl = hm[1].length;
        out.push('<h' + lvl + '>' + inlineMd(esc(hm[2])) + '</h' + lvl + '>');
        i++;
        continue;
      }
      // 引用 >
      if (/^>\s?/.test(line)) {
        var qbuf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          qbuf.push(inlineMd(esc(lines[i].replace(/^>\s?/, ''))));
          i++;
        }
        out.push('<blockquote>' + qbuf.join('<br>') + '</blockquote>');
        continue;
      }
      // 无序列表 - 或 *（用 - 起头，避免和 *斜体* 混）
      if (/^[-*]\s+/.test(line)) {
        var ubuf = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
          ubuf.push('<li>' + inlineMd(esc(lines[i].replace(/^[-*]\s+/, ''))) + '</li>');
          i++;
        }
        out.push('<ul>' + ubuf.join('') + '</ul>');
        continue;
      }
      // 有序列表 1. 2.
      if (/^\d+\.\s+/.test(line)) {
        var obuf = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          obuf.push('<li>' + inlineMd(esc(lines[i].replace(/^\d+\.\s+/, ''))) + '</li>');
          i++;
        }
        out.push('<ol>' + obuf.join('') + '</ol>');
        continue;
      }
      // 空行跳过
      if (/^\s*$/.test(line)) { i++; continue; }
      // 普通段落：连续非空、非块起始行合并
      var pbuf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i])
        && !/^(#{1,3}\s|>\s?|[-*]\s|\d+\.\s|```)/.test(lines[i])) {
        pbuf.push(inlineMd(esc(lines[i])));
        i++;
      }
      out.push('<p>' + pbuf.join('<br>') + '</p>');
    }
    return out.join('\n');
  }

  // ---------- Notes CRUD ----------
  function addNote(ws, fields) {
    var now = Date.now();
    var note = {
      id: uid(),
      title: (fields && fields.title || '').trim() || 'Untitled',
      body: (fields && fields.body) || '',
      projectId: (fields && fields.projectId) || null,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    ws.notes.push(note);
    return note;
  }
  function findNote(ws, id) {
    for (var i = 0; i < ws.notes.length; i++) if (ws.notes[i].id === id) return ws.notes[i];
    return null;
  }
  function updateNote(ws, id, fields) {
    var n = findNote(ws, id);
    if (!n) return null;
    if (fields.title !== undefined) n.title = String(fields.title).trim() || 'Untitled';
    if (fields.body !== undefined) n.body = String(fields.body);
    if (fields.projectId !== undefined) n.projectId = fields.projectId;
    n.updatedAt = Date.now();
    return n;
  }
  function deleteNote(ws, id) {
    ws.notes = ws.notes.filter(function (n) { return n.id !== id; });
  }
  function togglePin(ws, id) {
    var n = findNote(ws, id);
    if (n) n.pinned = !n.pinned;
    return n;
  }
  // 置顶在前，各组内按 updatedAt 倒序（新的在上）。
  function notesSorted(ws) {
    return ws.notes.slice().sort(function (a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }
```

然后在 `return {` 对象里，`inboxToTask: inboxToTask, inboxToNote: inboxToNote,` 之后加：

```js
    renderMarkdown: renderMarkdown, safeUrl: safeUrl,
    addNote: addNote, findNote: findNote, updateNote: updateNote,
    deleteNote: deleteNote, togglePin: togglePin, notesSorted: notesSorted,
```

- [ ] **Step 4: 跑绿**

Run: `node --test test/tracer-model.test.js`
Expected: PASS（原有 + 新增）。

Run: `node --test test/*.test.js`
Expected: 全绿。

- [ ] **Step 5: 无裸 NUL + Commit**

```bash
node -e "process.exit(require('fs').readFileSync('skins/tracer/model.js').includes(0)?1:0)" && echo "no NUL"
git add skins/tracer/model.js test/tracer-model.test.js
git commit -m "feat(tracer): model.js 加安全 Markdown 渲染 + notes CRUD（置顶/排序）"
```

---

### Task 2: Notes 视图（清单 + 编辑器 + Ctrl+E）

**Files:**
- Create: `skins/tracer/notes.js`
- Create: `skins/tracer/notes.css`
- Modify: `skins/tracer/index.html`（link notes.css；挂 notes.js）

- [ ] **Step 1: notes.js**

新建 `skins/tracer/notes.js`：

```js
(function () {
  'use strict';
  var M = window.TracerModel, T = window.Tracer;
  var sec = document.getElementById('sec-notes');
  var currentId = null;   // 当前打开的笔记 id
  var preview = false;    // false=编辑，true=渲染预览

  function render() {
    var ws = T.store.data;
    var notes = M.notesSorted(ws);
    // 当前笔记失效（被删/首次进入）时选第一条
    if (currentId && !M.findNote(ws, currentId)) currentId = null;
    if (!currentId && notes.length) currentId = notes[0].id;

    var listHtml = '';
    notes.forEach(function (n) {
      var active = n.id === currentId ? ' active' : '';
      var snippet = (n.body || '').replace(/[#*`>\-\d.]/g, '').replace(/\s+/g, ' ').trim().slice(0, 48);
      listHtml += '<div class="note-item' + active + '" data-id="' + n.id + '">'
        + (n.pinned ? '<span class="note-pin">●</span>' : '')
        + '<div class="note-item-title">' + M.esc(n.title) + '</div>'
        + '<div class="note-item-snip">' + M.esc(snippet || 'No content') + '</div>'
        + '</div>';
    });

    var html = '<header class="sec-head"><h1>Notes</h1>'
      + '<span class="sec-sub">Pages and drafts</span>'
      + '<span style="flex:1"></span>'
      + '<button class="btn btn-primary" id="note-new">+ New page</button></header>'
      + '<div class="notes-wrap">'
      + '<div class="note-list">' + (listHtml || '<div class="note-empty">No pages yet</div>') + '</div>'
      + '<div class="note-editor" id="note-editor"></div>'
      + '</div>';
    sec.innerHTML = html;

    document.getElementById('note-new').addEventListener('click', function () {
      var n = M.addNote(ws, { title: 'Untitled' });
      currentId = n.id; preview = false; T.touch(); render();
    });
    sec.querySelector('.note-list').addEventListener('click', function (e) {
      var item = e.target.closest('.note-item');
      if (!item) return;
      currentId = item.dataset.id; preview = false; renderEditor();
      // 只更新列表高亮，不整体重绘
      sec.querySelectorAll('.note-item').forEach(function (el) {
        el.classList.toggle('active', el.dataset.id === currentId);
      });
    });
    renderEditor();
  }

  function renderEditor() {
    var ws = T.store.data;
    var box = document.getElementById('note-editor');
    if (!box) return;
    var n = currentId ? M.findNote(ws, currentId) : null;
    if (!n) { box.innerHTML = '<div class="note-empty">Select or create a page</div>'; return; }

    if (preview) {
      box.innerHTML = '<div class="note-toolbar">'
        + '<input class="note-title" id="note-title" value="' + M.esc(n.title) + '" readonly>'
        + '<button class="chip" id="note-edit">✎ Edit</button>'
        + '<button class="chip" id="note-pin">' + (n.pinned ? '★ Pinned' : '☆ Pin') + '</button>'
        + '<button class="chip chip-del" id="note-del">Delete</button></div>'
        + '<div class="note-rendered">' + M.renderMarkdown(n.body) + '</div>';
    } else {
      box.innerHTML = '<div class="note-toolbar">'
        + '<input class="note-title" id="note-title" value="' + M.esc(n.title) + '" placeholder="Untitled">'
        + '<button class="chip" id="note-preview">◱ Preview</button>'
        + '<button class="chip" id="note-pin">' + (n.pinned ? '★ Pinned' : '☆ Pin') + '</button>'
        + '<button class="chip chip-del" id="note-del">Delete</button></div>'
        + '<textarea class="note-body" id="note-body" placeholder="Write in Markdown…  (Ctrl+E toggles preview)"></textarea>';
      document.getElementById('note-body').value = n.body;
    }
    wireEditor(ws, n);
  }

  function wireEditor(ws, n) {
    var title = document.getElementById('note-title');
    var pinBtn = document.getElementById('note-pin');
    var delBtn = document.getElementById('note-del');
    var prevBtn = document.getElementById('note-preview');
    var editBtn = document.getElementById('note-edit');
    var body = document.getElementById('note-body');

    if (title && !preview) title.addEventListener('input', function () {
      M.updateNote(ws, n.id, { title: title.value }); T.touch();
      // 同步左列标题
      var item = sec.querySelector('.note-item[data-id="' + n.id + '"] .note-item-title');
      if (item) item.textContent = title.value || 'Untitled';
    });
    if (body) body.addEventListener('input', function () {
      M.updateNote(ws, n.id, { body: body.value }); T.touch();
    });
    if (pinBtn) pinBtn.addEventListener('click', function () { M.togglePin(ws, n.id); T.touch(); render(); });
    if (delBtn) delBtn.addEventListener('click', function () {
      T.ui.confirm('Delete this page?', function () { M.deleteNote(ws, n.id); currentId = null; T.touch(); render(); });
    });
    if (prevBtn) prevBtn.addEventListener('click', function () { preview = true; renderEditor(); });
    if (editBtn) editBtn.addEventListener('click', function () { preview = false; renderEditor(); });
  }

  // Ctrl+E 切换编辑/预览（仅当 Notes 分区激活且有选中笔记）
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey && (e.key === 'e' || e.key === 'E'))) return;
    if (T.currentSec() !== 'notes' || !currentId) return;
    e.preventDefault();
    preview = !preview;
    renderEditor();
  });

  T.onShow('notes', render);
})();
```

- [ ] **Step 2: notes.css**

新建 `skins/tracer/notes.css`：

```css
/* Tracer Notes：清单 + 编辑器两栏，以及 markdown 渲染样式。 */
.notes-wrap { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 16px; height: calc(100% - 60px); }
.note-list { overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
.note-item {
  padding: 9px 11px; border-radius: var(--radius); cursor: pointer;
  border: 1px solid transparent; position: relative;
}
.note-item:hover { background: var(--surface); }
.note-item.active { background: var(--surface); border-color: var(--border); }
.note-pin { position: absolute; right: 9px; top: 10px; color: var(--accent); font-size: 9px; }
.note-item-title { font-size: 13.5px; font-weight: 550; color: var(--fg); margin-bottom: 3px; padding-right: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note-item-snip { font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note-empty { color: var(--muted); font-size: 13px; padding: 24px 8px; text-align: center; }

.note-editor { display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--border); padding-left: 16px; }
.note-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.note-title {
  flex: 1; background: transparent; border: none; color: var(--fg);
  font-size: 18px; font-weight: 650; font-family: inherit; padding: 4px 0;
}
.note-title:focus { outline: none; }
.note-body {
  flex: 1; width: 100%; box-sizing: border-box; resize: none;
  background: var(--surface); color: var(--fg);
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px 16px; font-family: var(--font-mono); font-size: 13px; line-height: 1.7;
}
.note-body:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }

/* 渲染预览排版 */
.note-rendered { flex: 1; overflow-y: auto; font-size: 14px; line-height: 1.7; }
.note-rendered h1 { font-size: 22px; margin: 4px 0 12px; }
.note-rendered h2 { font-size: 18px; margin: 20px 0 10px; }
.note-rendered h3 { font-size: 15px; margin: 16px 0 8px; }
.note-rendered p { margin: 0 0 12px; }
.note-rendered ul, .note-rendered ol { margin: 0 0 12px; padding-left: 22px; }
.note-rendered li { margin: 3px 0; }
.note-rendered code { font-family: var(--font-mono); font-size: 12.5px; background: var(--surface); padding: 1px 5px; border-radius: 4px; }
.note-rendered pre { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; overflow-x: auto; margin: 0 0 12px; }
.note-rendered pre code { background: none; padding: 0; }
.note-rendered blockquote { border-left: 3px solid var(--accent); margin: 0 0 12px; padding: 2px 0 2px 14px; color: var(--muted); }
.note-rendered a { color: var(--accent); }
```

- [ ] **Step 3: index.html link + 挂脚本**

`<link rel="stylesheet" href="/board.css">` 之后加：

```html
<link rel="stylesheet" href="/notes.css">
```

`<script src="/projects.js"></script>` 之后加：

```html
<script src="/notes.js"></script>
```

- [ ] **Step 4: 检查 + 冒烟 + Commit**

```bash
node --check skins/tracer/notes.js
node -e "process.exit(require('fs').readFileSync('skins/tracer/notes.js').includes(0)?1:0)" && echo "no NUL"
node --test test/*.test.js
```

冒烟：`DOCS_PORTAL_SKIN=tracer DOCS_PORTAL_PORT=8098 node server.js`，curl 确认 `/notes.js` `/notes.css` 200、index.html 含两处引用。交互留给手工验证。

```bash
git add skins/tracer/notes.js skins/tracer/notes.css skins/tracer/index.html
git commit -m "feat(tracer): Notes 视图——清单+Markdown 编辑器、Ctrl+E 切换预览、自动保存"
```

---

### Task 3: 收阶段 2 遗留清理 + 手工验证

**Files:**
- Modify: `skins/tracer/app.js`（+New 双重渲染）
- Modify: `skins/tracer/board.js`（连点 +Add 节流）

- [ ] **Step 1: 修 +New 双重渲染**

`skins/tracer/app.js` 的 `+New` 回调里，`show('board')` 已经触发 board 的 onShow render，紧接着的显式 `renderBoard()` 是重复的。删掉这一行：

```js
    show('board');
    if (window.Tracer.renderBoard) window.Tracer.renderBoard();   // ← 删这一行
    if (window.Tracer.editLastTask) window.Tracer.editLastTask(t.id);
```

改为：

```js
    show('board');
    if (window.Tracer.editLastTask) window.Tracer.editLastTask(t.id);
```

注意：确认 `show('board')` 确实会重绘 Board（onShow 钩子已注册 render）。若当前已经在 board 分区，`show('board')` 仍会调 runHooks → render（阶段 1 的 show 无论是否同分区都跑 runHooks），所以删除后新卡仍能画出来。执行时起服务点一次 +New 验证新卡出现且只渲染一次。

- [ ] **Step 2: 修连点 +Add 建多卡**

`skins/tracer/board.js` 的 `quickAdd`：建卡后立刻打开编辑弹层，弹层遮罩会挡住 +Add 按钮，但极快连点仍可能在弹层出现前建两张。加一个简单闸门——建卡进行中忽略再次建卡：

在 board.js 顶部（IIFE 内、COLS 定义附近）加：

```js
  var adding = false;
```

`quickAdd` 改为：

```js
  function quickAdd(ws, status) {
    if (adding) return;
    adding = true;
    var t = M.addTask(ws, { title: 'New task', status: status });
    T.touch();
    render();
    editTask(ws, t.id);
    // render() 之后 DOM 重建，adding 用微任务归位即可
    setTimeout(function () { adding = false; }, 0);
  }
```

- [ ] **Step 3: 全量测试 + node --check**

```bash
node --check skins/tracer/app.js skins/tracer/board.js
node --test test/*.test.js    # 193 + 阶段 3 新增，全绿
```

- [ ] **Step 4: 手工验证（浏览器）**

起 `DOCS_PORTAL_SKIN=tracer node server.js`，`http://127.0.0.1:8080/`，切到 Notes 核对：

1. `+ New page` 建笔记 → 出现在左列、右侧编辑区聚焦；标题栏改名 → 左列标题实时同步。
2. 正文写 Markdown（`# 标题`、`**粗**`、`- 列表`、`> 引用`、``` ` ``` 代码块、`[链接](https://…)`）→ `Ctrl+E` 或 `◱ Preview` 切到渲染，排版正确；`✎ Edit` 或再 `Ctrl+E` 切回。
3. **安全**：正文写 `<script>alert(1)</script>` 和 `[x](javascript:alert(1))` → 预览里是纯文本、不弹窗、链接指向 `#`。
4. `☆ Pin` 置顶 → 该笔记排到左列最前、带 ● 标记；再点取消。
5. `Delete` → 确认框 → 笔记消失，自动选中下一条。
6. 刷新后笔记与正文都在（已存盘）。
7. 回归：Board/Inbox/项目/+New 仍正常；+New 建卡只渲染一次；狂点某列 +Add 不会连建多张。
8. 全程无 `novel/小说`；控制台无报错。

- [ ] **Step 5: Commit**

```bash
git add skins/tracer/app.js skins/tracer/board.js
git commit -m "fix(tracer): 收阶段 2 遗留——+New 去重渲染、+Add 建卡加闸门"
```

---

## 阶段边界

本计划**不含**（后续阶段）：Planner/Timeline（阶段 4）、Project Map 脑图/Insights（阶段 5）、游戏移植与默认皮肤切换（阶段 6）、`Ctrl+K` 命令面板（阶段 7）。笔记的 `projectId` 字段本阶段建模但编辑器暂不提供归属项目的入口（YAGNI，Notes 现在按更新时间/置顶组织；真需要按项目筛笔记时再加）。

## 已知偏差与提醒

- Markdown 渲染是精简白名单实现，不追求 CommonMark 完备：不支持嵌套列表、表格、图片、行内 HTML、链接标题、脚注、任务列表勾选框、`_下划线_` 斜体（只认 `*`）。这些不在 spec 范围。安全性（转义 + 协议白名单）比语法完备优先级高。
- `Ctrl+E` 全局监听：已限定 `currentSec()==='notes' && currentId` 才生效，不会干扰其他分区。注意别和浏览器/系统快捷键冲突（Ctrl+E 在部分浏览器是聚焦地址栏，`preventDefault` 已挡）。
- 笔记正文自动保存走 `input` 事件 + `Tracer.touch()` 的 500ms 防抖，与 Board 一致；不另设保存按钮。
- `safeUrl` 的相对链接判断较宽松（放行无协议冒号的一切），对本地个人工具足够；若将来渲染不可信来源的 markdown 需收紧。
