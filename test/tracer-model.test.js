'use strict';

const test = require('node:test');
const assert = require('node:assert');
const M = require('../skins/tracer/model.js');

// ---- SVG 路径面积测量 helper：把 M/A/A/Z 路径按 SVG 规范 F.6.5 转成中心参数化，
// 密集采样折线后用鞋带公式求面积。不对 moonPathD 的解析式做任何假设，
// 纯粹从"画出来的图形实际盖住多少面积"这个行为角度验证。
function arcPoints(x1, y1, rx, ry, largeArc, sweep, x2, y2, n) {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (rx === 0 || ry === 0) {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
    }
    return out;
  }
  const x1p = (x1 - x2) / 2, y1p = (y1 - y2) / 2;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  let num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  if (num < 0) num = 0;
  let coef = Math.sqrt(num / den);
  if (largeArc === sweep) coef = -coef;
  const cxp = coef * (rx * y1p) / ry;
  const cyp = coef * (-ry * x1p) / rx;
  const cx = cxp + (x1 + x2) / 2;
  const cy = cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const d = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    let a = Math.acos(Math.min(1, Math.max(-1, d)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dth > 0) dth -= 2 * Math.PI;
  if (sweep && dth < 0) dth += 2 * Math.PI;
  const out = [];
  for (let i = 1; i <= n; i++) {
    const th = th1 + dth * (i / n);
    out.push([cx + rx * Math.cos(th), cy + ry * Math.sin(th)]);
  }
  return out;
}

function pathToPolygon(d, n) {
  n = n || 2000;
  const toks = d.trim().split(/\s+/);
  const pts = [];
  let i = 0, cur = null;
  while (i < toks.length) {
    const c = toks[i++];
    if (c === 'M') { cur = [parseFloat(toks[i++]), parseFloat(toks[i++])]; pts.push(cur.slice()); }
    else if (c === 'A') {
      const rx = parseFloat(toks[i++]), ry = parseFloat(toks[i++]);
      const rot = parseFloat(toks[i++]);
      const laf = parseInt(toks[i++], 10), sf = parseInt(toks[i++], 10);
      const x2 = parseFloat(toks[i++]), y2 = parseFloat(toks[i++]);
      if (rot !== 0) throw new Error('不支持 rotation != 0');
      for (const p of arcPoints(cur[0], cur[1], rx, ry, laf, sf, x2, y2, n)) pts.push(p);
      cur = [x2, y2];
    } else if (c === 'Z') { /* noop */ }
    else throw new Error('未知指令 ' + c);
  }
  return pts;
}

function shoelaceArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

// 亮面面积占圆盘面积的比例——不依赖 moonPathD 内部用了什么公式
function litFraction(pct, r) {
  const d = M.moonPathD(pct, r);
  if (d === '') return 0;
  const poly = pathToPolygon(d);
  return Math.abs(shoelaceArea(poly)) / (Math.PI * r * r);
}

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

test('moonPhase 以 2000-01-06 新月为锚（用导出的 NEW_MOON_EPOCH）', () => {
  const epoch = M.NEW_MOON_EPOCH;
  assert.strictEqual(M.moonPhase(new Date(epoch)), 0, '锚点应精确是新月 (=0)');
  const halfCycle = epoch + M.SYNODIC / 2 * 86400000;
  assert.ok(Math.abs(M.moonPhase(new Date(halfCycle)) - 0.5) < 0.001, '半个朔望月后应是满月 (≈0.5)');
  const fullCycle = epoch + M.SYNODIC * 86400000;
  const t = M.moonPhase(new Date(fullCycle));
  // 毫秒级取整可能让浮点结果从 0 侧或 1 侧逼近整周期边界，两侧都算"回到新月"
  assert.ok(Math.min(t, 1 - t) < 0.001, '整周期后应回到新月附近，实际 t=' + t);
});

test('moonPhase golden：2026-08-12 17:46 UTC 日全食（定义上是新月）', () => {
  const t = M.moonPhase(new Date(Date.UTC(2026, 7, 12, 17, 46)));
  assert.ok(Math.min(t, 1 - t) < 0.034, '应落在新月附近（0 或 1 侧，容差约 1 天对应的周期比例），实际 t=' + t);
});

test('moonPhase 对海量随机时间戳与锚点/周期边界邻域毫秒扫描都落在 [0,1)', () => {
  const lo = Date.UTC(1900, 0, 1), hi = Date.UTC(2100, 0, 1);
  for (let i = 0; i < 5000; i++) {
    const ms = lo + Math.floor(Math.random() * (hi - lo));
    const t = M.moonPhase(new Date(ms));
    assert.ok(t >= 0 && t < 1, ms + ' → ' + t);
  }
  // 锚点邻域逐毫秒扫描：跨越 0 边界最容易暴露浮点取整问题
  for (let dms = -2000; dms <= 2000; dms++) {
    const t = M.moonPhase(new Date(M.NEW_MOON_EPOCH + dms));
    assert.ok(t >= 0 && t < 1, 'epoch+' + dms + 'ms → ' + t);
  }
  // 若干整周期边界附近也扫一遍：这里最容易触发临界舍入
  for (let k = -3; k <= 3; k++) {
    const boundary = Math.round(M.NEW_MOON_EPOCH + k * M.SYNODIC * 86400000);
    for (let dms = -5; dms <= 5; dms++) {
      const t = M.moonPhase(new Date(boundary + dms));
      assert.ok(t >= 0 && t < 1, 'cycle ' + k + ' boundary+' + dms + 'ms → ' + t);
    }
  }
});

test('moonPathD 亮面面积占比线性等于 pct（弧展平 + 鞋带公式实测）', () => {
  const R = 6;
  for (const pct of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const frac = litFraction(pct, R);
    assert.ok(Math.abs(frac - pct) < 1e-6, 'pct=' + pct + ' 实测面积占比=' + frac);
  }
});

test('moonPathD 单调递增', () => {
  const R = 6;
  let prev = -1;
  for (let p = 0.02; p < 1; p += 0.02) {
    const f = litFraction(p, R);
    assert.ok(f > prev - 1e-9, 'pct=' + p.toFixed(2) + ' 面积占比非单调: ' + f + ' <= ' + prev);
    prev = f;
  }
});

test('moonPathD 两端：0 空串、1 整圆（面积占比≈1）', () => {
  assert.strictEqual(M.moonPathD(0, 6), '', '0 全暗，无亮面路径');
  const frac1 = litFraction(1, 6);
  assert.ok(Math.abs(frac1 - 1) < 1e-6, '1 应是整圆，面积占比≈1，实为 ' + frac1);
});

test('moonPathD 对 NaN / 负数 / undefined 也返回空串', () => {
  assert.strictEqual(M.moonPathD(NaN, 6), '');
  assert.strictEqual(M.moonPathD(-0.1, 6), '');
  assert.strictEqual(M.moonPathD(undefined, 6), '');
});

test('moonPathD 半月的界线是过圆心直线（rx=0）', () => {
  const half = M.moonPathD(0.5, 6);
  const rx = parseFloat(half.split('A')[2].trim().split(/\s+/)[0]);
  assert.ok(Math.abs(rx) < 1e-9, '半月的界线 rx 应为 0，实为 ' + rx);
});

test('moonPathD 盈亏两侧的界线弧向相反', () => {
  // 界线弧（第二段 A）的 sweep 位：未过半 0，过半 1
  const sweepOf = (d) => d.split('A')[2].trim().split(/\s+/)[4];
  assert.strictEqual(sweepOf(M.moonPathD(0.25, 6)), '0');
  assert.strictEqual(sweepOf(M.moonPathD(0.75, 6)), '1');
});

test('moonPathD 亮面路径闭合', () => {
  const R = 6;
  for (const pct of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const poly = pathToPolygon(M.moonPathD(pct, R));
    const first = poly[0], last = poly[poly.length - 1];
    const gap = Math.hypot(first[0] - last[0], first[1] - last[1]);
    assert.ok(gap < 1e-6, 'pct=' + pct + ' 路径不闭合，gap=' + gap);
  }
});

test('moonIllum 四个主相位定点', () => {
  assert.ok(Math.abs(M.moonIllum(0) - 0) < 1e-9, '新月应全暗');
  assert.ok(Math.abs(M.moonIllum(0.25) - 0.5) < 1e-9, '上弦应半亮');
  assert.ok(Math.abs(M.moonIllum(0.5) - 1) < 1e-9, '满月应全亮');
  assert.ok(Math.abs(M.moonIllum(0.75) - 0.5) < 1e-9, '下弦应半亮');
});

test('moonIllum 对称性 moonIllum(t) === moonIllum(1-t)', () => {
  for (const t of [0.05, 0.2, 0.33, 0.6, 0.87, 0.99]) {
    assert.ok(Math.abs(M.moonIllum(t) - M.moonIllum(1 - t)) < 1e-9, 't=' + t);
  }
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

test('updateTask 空标题保持原值', () => {
  const ws = M.emptyWorkspace();
  const t = M.addTask(ws, { title: 'Keep' });
  M.updateTask(ws, t.id, { title: '   ' });
  assert.strictEqual(t.title, 'Keep');
  M.updateTask(ws, t.id, { title: 'New' });
  assert.strictEqual(t.title, 'New');
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

test('renderMarkdown 链接查询参数的 & 不被双重转义', () => {
  const h = M.renderMarkdown('[t](https://x.com/?a=1&b=2)');
  assert.ok(/href="https:\/\/x\.com\/\?a=1&amp;b=2"/.test(h), '& 应恰好一层转义，实际：' + h);
  assert.ok(h.indexOf('&amp;amp;') < 0, '不得出现双重转义');
});

test('renderMarkdown URL 里的 * 不被斜体规则污染', () => {
  const h = M.renderMarkdown('[t](https://a*b*c.com)');
  assert.ok(h.indexOf('<em>') < 0, 'URL 里不该冒出 <em>');
  assert.ok(/a\*b\*c\.com/.test(h), 'URL 原样保留');
});

test('renderMarkdown 行内代码隔离：内部不解析链接/粗体', () => {
  const link = M.renderMarkdown('`[a](https://x.com)`');
  assert.ok(link.indexOf('<a ') < 0, '行内代码里不生成链接');
  assert.ok(/<code>\[a\]\(https:\/\/x\.com\)<\/code>/.test(link));
  const bold = M.renderMarkdown('`**b**`');
  assert.ok(bold.indexOf('<strong>') < 0, '行内代码里不加粗');
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
  // 给该天再加一个 done 任务，tasksOnDay 应仍是 2（done 不计）
  const e = M.addTask(ws, { title: 'e', scheduled: '2026-09-03' });
  M.moveTask(ws, e.id, 'done', null);
  assert.strictEqual(M.tasksOnDay(ws, '2026-09-03').length, 2);
});

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
