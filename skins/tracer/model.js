(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./task-history') : root.TaskHistory,
    typeof module === 'object' && module.exports ? require('./project-deletion') : root.ProjectDeletion);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerModel = api;
})(typeof self !== 'undefined' ? self : this, function (History, Deletion) {
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
  // 锚点取 2000-01-06 18:14 UTC 的新月，朔望月固定用 29.530588853 天的平均值。
  // 真实朔望月有 ±0.3 天左右的周期性摆动，长期累积后误差可达约 0.7 天，界面用途够用。
  var SYNODIC = 29.530588853;
  var NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);
  function moonPhase(date) {
    var days = (date.getTime() - NEW_MOON_EPOCH) / 86400000;
    var t = days / SYNODIC;
    t = t - Math.floor(t);
    // t-floor(t) 在 t 为极小负数时可能舍入到 1；整毫秒时间戳下不可达，留作不变量保险
    if (t >= 1) t = 0;
    return t;
  }

  // 月相/进度图标的亮面路径：pct 是亮面（面积）比例，不是角度或直径比例。
  // 双语义：进度图标直接传完成度；真实月相传 moonIllum(moonPhase(now))。
  // 圆心 (0,0) 半径 r。0 返回空串（调用方只画描边圆），1 返回整圆。
  // 其余：亮面固定从右缘长出——右缘外弧 + 明暗界线椭圆弧围出闭合区域。
  // 界线横向半径 rx = |1-2·pct|·r。pct=0.5 时 rx=0，界线退化成过圆心的直线、
  // 亮面恰是半圆，这只是这个构造的一个特例；这条公式在整个 (0,1) 区间都保证
  // 亮面面积占比严格等于 pct（见 test/tracer-model.test.js 按 0.1~0.9 多点的面积断言）。
  function moonPathD(pct, r) {
    if (!(pct > 0)) return ''; // 挡掉 NaN / undefined / 负数
    if (pct >= 1) {
      return 'M 0 ' + (-r) + ' A ' + r + ' ' + r + ' 0 1 1 0 ' + r
        + ' A ' + r + ' ' + r + ' 0 1 1 0 ' + (-r) + ' Z';
    }
    var k = 1 - 2 * pct;
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
  // 时间戳 + 随机尾巴：按创建毫秒可排序，同毫秒内顺序不保证（需要严格顺序请用 meta.seqCounter）。
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function emptyWorkspace() {
    return {
      projects: [], tasks: [], notes: [], inbox: [],
      meta: { seqCounter: 0, rev: 0 },
    };
  }

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
  var PRIORITIES = ['', 'low', 'medium', 'high', 'urgent'];
  var TASK_TYPES = ['task', 'bug', 'feature', 'research'];
  function taskFields(ws, id, fields) {
    var out = {};
    ['assignee', 'acceptance'].forEach(function (k) { if (fields[k] !== undefined) out[k] = String(fields[k] || '').trim(); });
    if (fields.priority !== undefined) { if (PRIORITIES.indexOf(fields.priority || '') < 0) throw new Error('Invalid priority'); out.priority = fields.priority || null; }
    if (fields.type !== undefined) { if (TASK_TYPES.indexOf(fields.type) < 0) throw new Error('Invalid task type'); out.type = fields.type; }
    ['estimate', 'spent'].forEach(function (k) {
      if (fields[k] === undefined) return;
      var n = fields[k] === '' || fields[k] === null ? null : Number(fields[k]);
      if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100000)) throw new Error('Invalid hours');
      out[k] = n;
    });
    if (fields.labels !== undefined) out.labels = fields.labels.map(function (v) { return String(v).trim(); }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
    if (fields.checklist !== undefined) out.checklist = fields.checklist.map(function (c) { return { id: c.id || uid(), text: String(c.text).trim(), done: !!c.done }; }).filter(function (c) { return c.text; });
    if (fields.links !== undefined) out.links = fields.links.map(function (v) { v = String(v).trim(); if (!/^https?:\/\/[^\s]+$/i.test(v)) throw new Error('Invalid resource link'); return v; });
    if (fields.dependsOn !== undefined) {
      out.dependsOn = fields.dependsOn.filter(function (v, i, a) { return a.indexOf(v) === i; });
      function reaches(current, seen) {
        if (current === id) return true;
        if (seen[current]) return false;
        seen[current] = true;
        var t = findTask(ws, current);
        return t && (t.dependsOn || []).some(function (v) { return reaches(v, seen); });
      }
      if (out.dependsOn.some(function (v) { return !findTask(ws, v) || reaches(v, Object.create(null)); })) throw new Error('Invalid dependency');
    }
    ['labels', 'links', 'dependsOn', 'checklist'].forEach(function (key) {
      if (out[key] && out[key].length > 100) throw new Error('Too many task items');
    });
    if (out.labels && out.labels.some(function (s) { return s.length > 100; })) throw new Error('Task item too long');
    if (out.links && out.links.some(function (s) { return s.length > 2048; })) throw new Error('Task item too long');
    if (out.checklist && out.checklist.some(function (c) { return c.text.length > 1000; })) throw new Error('Task item too long');
    return out;
  }
  function blockers(ws, task) { return (task.dependsOn || []).map(function (id) { return findTask(ws, id); }).filter(function (t) { return t && t.status !== 'done'; }); }

  function addTask(ws, fields) {
    var title = (fields && fields.title || '').trim();
    if (!title) return null;
    var extras = taskFields(ws, null, fields);
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
      updatedAt: Date.now(),
      doneAt: fields.status === 'done' ? Date.now() : null,
    };
    Object.assign(task, extras);
    ws.tasks.push(task);
    if (task.status === 'done') History.record(ws, task);
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
    if (!task || STATUSES.indexOf(status) < 0) return;
    var wasDone = task.status === 'done';
    if (wasDone) History.record(ws, task);
    task.status = status;
    if (status === 'done' && !wasDone) {
      task.doneAt = Math.max(Date.now(), (ws.completionHistory || []).filter(function (h) { return h.taskId === id; }).reduce(function (max, h) { return Math.max(max, h.completedAt); }, 0) + 1);
      History.record(ws, task);
    }
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
    task.updatedAt = Date.now();
  }

  function updateTask(ws, id, fields) {
    var task = findTask(ws, id);
    if (!task) return null;
    var extras = taskFields(ws, id, fields);
    if (task.status === 'done') History.record(ws, task);
    ['title', 'notes', 'projectId', 'priority', 'scheduled', 'due'].forEach(function (k) {
      if (fields[k] === undefined) return;
      if (k === 'title') { var v = String(fields[k]).trim(); if (v) task[k] = v; }
      else task[k] = fields[k];
    });
    Object.assign(task, extras);
    if (fields.status !== undefined && fields.status !== task.status) moveTask(ws, id, fields.status, null);
    task.updatedAt = Date.now();
    return task;
  }

  // Date-only comparisons use local calendar dates, matching Planner.
  function taskDueState(task, today) {
    if (!task.due || task.status === 'done') return '';
    today = today || todayISO();
    return task.due < today ? 'overdue' : task.due === today ? 'today' : 'upcoming';
  }

  function filterTasks(ws, options) {
    options = options || {};
    var query = String(options.query || '').trim().toLowerCase();
    return ws.tasks.filter(function (t) {
      if (options.projectId && t.projectId !== options.projectId) return false;
      if (options.priority && t.priority !== options.priority) return false;
      if (options.due && taskDueState(t, options.today) !== options.due) return false;
      return !query || [t.title, t.notes, t.seq, t.assignee, (t.labels || []).join(' '), t.acceptance].join(' ').toLowerCase().indexOf(query) >= 0;
    }).sort(function (a, b) { return a.order - b.order; });
  }

  function deleteTask(ws, id) {
    var task = findTask(ws, id); if (task && task.status === 'done') History.record(ws, task);
    ws.tasks = ws.tasks.filter(function (t) { return t.id !== id; });
    ws.tasks.forEach(function (t) { if ((t.dependsOn || []).indexOf(id) >= 0) { t.dependsOn = t.dependsOn.filter(function (v) { return v !== id; }); t.updatedAt = Date.now(); } });
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

  // ---------- Markdown 安全渲染 ----------
  // 安全第一：整体思路是「先切成块，再逐块把纯文本 esc 转义，最后只在转义后的
  // 文本上套白名单标签」。任何时候都不会把未转义的用户输入塞进 innerHTML。
  // 支持：# 标题、- / 1. 列表、> 引用、``` 围栏代码块、**粗** *斜* `码`、[文](url)。
  // 未覆盖的语法原样按普通段落走（已转义），不会破坏页面。

  // 行内规则用的占位符哨兵：Unicode 私用区字符 U+E000，正常文本、用户输入都不会
  // 出现，也不是正则特殊字符，可以直接拼进 RegExp 源串。renderMarkdown 入口会把
  // 输入里可能存在的哨兵先剥掉，防止用户粘贴 U+E000 和占位符撞车。
  var TOK = '\uE000';

  // 行内：在已 esc 的文本上做粗/斜/码/链接替换。用占位符把「行内代码」和「链接」
  // 抠出来存进 stash，避免它们的内容被后面的粗/斜规则污染（URL 里的 *、代码里的
  // [ 等），也保证行内代码内部不再解析 markdown。最后把占位符换回真实片段。
  function inlineMd(escaped) {
    var stash = [];
    function hold(html) { stash.push(html); return TOK + (stash.length - 1) + TOK; }
    var s = escaped;
    // 行内代码：内容已 esc，直接包 <code>，整体占位（内部不再被 link/粗/斜命中）
    s = s.replace(/`([^`]+)`/g, function (_, c) { return hold('<code>' + c + '</code>'); });
    // 链接 [text](url)：text 已 esc；url 需校验协议。生成的 <a> 整体占位，
    // URL 和 text 都不再被后续粗/斜规则污染。
    s = s.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, text, url) {
      return hold('<a href="' + safeUrl(url) + '" target="_blank" rel="noopener">' + text + '</a>');
    });
    // 粗 **x**（先于斜体，避免 * 冲突）
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 斜 *x*
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // 还原占位符
    s = s.replace(new RegExp(TOK + '(\\d+)' + TOK, 'g'), function (_, i) { return stash[+i]; });
    return s;
  }

  // 链接协议白名单，防 javascript:/data: 注入。判定用「去掉控制字符再小写」的
  // 副本（挡 `java\tscript:` 之类的绕过）。u 已经是 inlineMd 收到的、经
  // renderMarkdown 逐行 esc 过的文本，这里不再 esc，否则 & 会变成 &amp;amp;。
  // 规则：① http(s)/mailto 绝对链接放行；② 不含冒号的一律视作相对链接放行
  // （/path、#anchor、page.html）；③ 含冒号但非白名单协议 → 降级为 #。
  function safeUrl(url) {
    var u = String(url);
    var lower = u.toLowerCase().replace(/[\x00-\x20]/g, '');
    if (/^(https?:|mailto:)/.test(lower)) return u;
    if (lower.indexOf(':') < 0) return u;
    return '#';
  }

  function renderMarkdown(src) {
    var lines = String(src == null ? '' : src).replace(/\uE000/g, '').split(/\r?\n/);
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
    return ws.tasks.filter(function (t) { return t.scheduled === iso && t.status !== 'done'; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function unscheduledTasks(ws) {
    return ws.tasks.filter(function (t) { return !t.scheduled && t.status !== 'done'; })
      .sort(function (a, b) { return a.order - b.order; });
  }

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
    // hasOwnProperty：脏数据里 status 若是 'toString'/'constructor' 等原型键，
    // 用 c[status]!==undefined 判定会命中继承属性、往结果塞 NaN 杂键。
    ws.tasks.forEach(function (t) {
      if (Object.prototype.hasOwnProperty.call(c, t.status)) c[t.status]++;
    });
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

  return {
    SYNODIC: SYNODIC, NEW_MOON_EPOCH: NEW_MOON_EPOCH,
    dayPhase: dayPhase, moonPhase: moonPhase,
    moonPathD: moonPathD, moonIllum: moonIllum,
    uid: uid, emptyWorkspace: emptyWorkspace,
    esc: esc, nextSeq: nextSeq, projectColor: projectColor, STATUSES: STATUSES,
    addTask: addTask, findTask: findTask, tasksByStatus: tasksByStatus,
    moveTask: moveTask, updateTask: updateTask, deleteTask: deleteTask,
    taskDueState: taskDueState, filterTasks: filterTasks, blockers: blockers, PRIORITIES: PRIORITIES, TASK_TYPES: TASK_TYPES,
    addProject: addProject, deleteProject: Deletion.remove,
    addInbox: addInbox, deleteInbox: deleteInbox,
    inboxToTask: inboxToTask, inboxToNote: inboxToNote,
    renderMarkdown: renderMarkdown, safeUrl: safeUrl,
    addNote: addNote, findNote: findNote, updateNote: updateNote,
    deleteNote: deleteNote, togglePin: togglePin, notesSorted: notesSorted,
    toISO: toISO, fromISO: fromISO, todayISO: todayISO, addDays: addDays,
    weekStart: weekStart, weekDays: weekDays, dayParts: dayParts, daysBetween: daysBetween,
    monthList: monthList, datePos: datePos,
    findProject: findProject, updateProject: updateProject, projectProgress: projectProgress,
    tasksOnDay: tasksOnDay, unscheduledTasks: unscheduledTasks,
    mapLayout: mapLayout, statusCounts: statusCounts, weeklyCompletions: weeklyCompletions,
  };
});
