'use strict';

// Fixture view：把小说正文抽出来，重排成「zh-CN 本地化语料清单」的样子。
//
// 这是伪装机制，不是阅读体验优化。中文方块字和英文文本的轮廓密度差异显著，
// 把中文伪装成英文文档段落在视觉上不可能成立；所以不做那种伪装，
// 改为让中文出现在一个「本来就该出现中文」的位置——技术文档里的本地化测试语料。

const rewrite = require('./rewrite.js');

// fixture 视图的标记。必须挂在这个视图产出的每一个链接上，
// 否则点一次「下一章」就退回普通视图，每翻一页都要重新点切换按钮。
// dim（低对比模式）同理：不随链接传递的话翻一页就亮回去了。
function fxQuery(dim) {
  return '?fx=1' + (dim ? '&dim=1' : '');
}

// 中文小说站常见的正文容器。命中其一就不必走密度兜底。
const CONTENT_HINTS = [
  'chaptercontent', 'booktxt', 'showtxt', 'htmlcontent', 'articlecon',
  'content', 'contents', 'chapter-content', 'read-content', 'txtcontent',
  'nr1', 'nr_content', 'articlebody', 'article-content',
];

const NAV_WORDS = [
  { re: /下一[章页篇]|next\s*(chapter|page)?/i, key: 'next', label: 'Next batch' },
  { re: /上一[章页篇]|prev(ious)?\s*(chapter|page)?/i, key: 'prev', label: 'Previous batch' },
  { re: /目\s*录|章节列表|返回列表|index|catalog|contents/i, key: 'index', label: 'Batch index' },
];

function stripNoise(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
}

function countChinese(str) {
  const m = str.match(/[\u4e00-\u9fff]/g);
  return m ? m.length : 0;
}

// 从 openIdx 处的开标签开始，向后扫描配平同名标签，返回该元素的完整片段。
// 正则无法处理嵌套，所以这里手工配平。
function sliceBalanced(html, openIdx, tagName) {
  const openRe = new RegExp('<' + tagName + '\\b', 'gi');
  const closeRe = new RegExp('</' + tagName + '\\s*>', 'gi');
  let depth = 0;
  let cursor = openIdx;
  const limit = html.length;

  while (cursor < limit) {
    openRe.lastIndex = cursor;
    closeRe.lastIndex = cursor;
    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);
    if (!nextClose) return html.slice(openIdx);

    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      cursor = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      cursor = nextClose.index + nextClose[0].length;
      if (depth === 0) return html.slice(openIdx, cursor);
    }
  }
  return html.slice(openIdx);
}

function findByHint(html) {
  let best = null;
  for (const hint of CONTENT_HINTS) {
    const re = new RegExp('<(div|article|section)\\b[^>]*(?:id|class)\\s*=\\s*["\'][^"\']*\\b' + hint + '\\b', 'i');
    const m = re.exec(html);
    if (!m) continue;
    const frag = sliceBalanced(html, m.index, m[1]);
    const score = countChinese(frag);
    if (!best || score > best.score) best = { frag, score };
  }
  return best && best.score >= 100 ? best.frag : null;
}

// 兜底：按中文字符密度挑选最像正文的块级元素。
function findByDensity(html) {
  let best = null;
  const re = /<(div|article|section)\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const frag = sliceBalanced(html, m.index, m[1]);
    const score = countChinese(frag);
    if (score >= 200 && (!best || score > best.score)) best = { frag, score };
    // 已经切走的部分不必重复扫描
    if (frag.length > 400) re.lastIndex = m.index + Math.floor(frag.length / 2);
  }
  return best ? best.frag : null;
}

function toParagraphs(fragment) {
  const text = fragment
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u3000/g, ' ');

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 2);
}

// 剥标签会把正文里的 <a> 一并剥掉，于是 fixture view 里除了硬抽出来的
// 上一章/目录/下一章，其余链接全没了——分页数字、章节跳转、书签统统失效。
// 所以先把链接换成控制字符标记，等剥完标签、转义完实体之后再还原成真正的 <a>。
// 用控制字符是因为它们既不会被 <[^>]+> 匹配掉，也不会被 HTML 转义改动。
const L_START = '\u0001';
const L_SEP = '\u0002';
const L_END = '\u0003';
const MARKER_RE = /[\u0001\u0002\u0003]/g;
const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

function markLinks(fragment, pageUrl, base, hrefs, query) {
  return fragment.replace(ANCHOR_RE, (whole, attrs, inner) => {
    const m = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
    if (!m) return inner;
    const raw = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
    const abs = rewrite.absolutize(raw, pageUrl);
    if (!abs) return inner;
    const idx = hrefs.push(rewrite.proxyHref(abs, base, query)) - 1;
    return L_START + idx + L_SEP + inner + L_END;
  });
}

function restoreLinks(escapedLine, hrefs) {
  const withLinks = escapedLine.replace(
    /\u0001(\d+)\u0002([\s\S]*?)\u0003/g,
    (whole, idx, text) => {
      const href = hrefs[Number(idx)];
      return href ? '<a class="fx-lnk" href="' + escapeHtml(href) + '">' + text + '</a>' : text;
    }
  );
  // 链接文字跨行时标记会被拆散，留下孤立的控制字符，清掉。
  return withLinks.replace(MARKER_RE, '');
}

// 把长段落切成语料条目长度的短行。
// 整段小说文字一眼就是散文；真实的本地化语料几乎都是单句。按句末标点
// 切开后每行只有一两句，行号密度也随之上升，瞥一眼更接近一张字符串表。
// 两个不切的位置：引号内（拆散对话会留下残破的行）和链接标记内
// （.. 拆开后 restoreLinks 会把链接整个丢掉）。
const SENT_END = '。！？；…';
const QUOTE_OPEN = '「『（【“';
const QUOTE_CLOSE = '」』）】”';
const MIN_ROW = 8;
const MAX_UNSPLIT = 60;

function splitRow(line) {
  if (line.length <= MAX_UNSPLIT) return [line];
  const rows = [];
  let cur = '';
  let quote = 0;
  let link = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    cur += ch;
    if (ch === L_START) link++;
    else if (ch === L_END) link = link > 0 ? link - 1 : 0;
    else if (link === 0) {
      if (QUOTE_OPEN.includes(ch)) quote++;
      else if (QUOTE_CLOSE.includes(ch)) quote = quote > 0 ? quote - 1 : 0;
      else if (quote === 0 && SENT_END.includes(ch)) {
        // 连串的省略号/叹问号以及紧随的收尾引号归入当前句
        while (i + 1 < line.length
          && (SENT_END.includes(line[i + 1]) || QUOTE_CLOSE.includes(line[i + 1]))) {
          cur += line[++i];
        }
        if (cur.length >= MIN_ROW) {
          rows.push(cur);
          cur = '';
        }
      }
    }
  }
  if (cur) {
    // 结尾的零碎（半句、孤立标点）并入上一行，不单独成行。
    if (rows.length > 0 && cur.length < MIN_ROW) rows[rows.length - 1] += cur;
    else rows.push(cur);
  }
  return rows;
}

function toLinkedParagraphs(fragment, pageUrl, base, query) {
  const hrefs = [];
  const marked = markLinks(fragment, pageUrl, base, hrefs, query);
  return toParagraphs(marked)
    .flatMap(splitRow)
    .map((line) => restoreLinks(escapeHtml(line), hrefs));
}

function extractTitle(html) {
  const h1 = /<h1\b[^>]*>([\s\S]{1,200}?)<\/h1>/i.exec(html);
  if (h1) {
    const t = h1[1].replace(/<[^>]+>/g, '').trim();
    if (t) return t;
  }
  const title = /<title\b[^>]*>([\s\S]{1,200}?)<\/title>/i.exec(html);
  return title ? title[1].replace(/<[^>]+>/g, '').trim() : '';
}

// 分页控件：页码数字、首页/尾页、第 N 页。
// 只认这些形态，避免把站点导航栏、分类、广告链接一并卷进来。
const PAGER_RE = /^(\d{1,4}|首页|尾页|末页|上一页|下一页|第\s*\d+\s*页)$/;
const MAX_PAGER_LINKS = 12;

// 把 URL 路径拆成「最后一个数字」及其前后缀。
// 很多小说站的上下章不写「上一章/下一章」，而是直接拿章节标题当链接文字，
// 光靠文字匹配一个也抓不到。但它们的 URL 几乎总是同目录、同后缀、数字相邻，
// 这个结构信号比文字可靠得多。
function splitNumeric(u) {
  try {
    const url = new URL(u);
    const m = /^(.*?)(\d+)(\D*)$/.exec(url.pathname);
    if (!m) return null;
    return { origin: url.origin, head: m[1], num: Number(m[2]), tail: m[3] };
  } catch {
    return null;
  }
}

function sameSeries(a, b) {
  return !!a && !!b && a.origin === b.origin && a.head === b.head && a.tail === b.tail;
}

// 在同一编号序列里找紧邻当前页的前一篇和后一篇。
// 取「最接近」而非「差值恰好为 1」：章节编号常有跳号。
function inferAdjacent(candidates, pageUrl) {
  const cur = splitNumeric(pageUrl);
  if (!cur) return {};
  let prev = null;
  let next = null;
  for (const c of candidates) {
    const s = splitNumeric(c.abs);
    if (!sameSeries(cur, s) || s.num === cur.num) continue;
    if (s.num < cur.num && (!prev || s.num > prev.num)) prev = { c, num: s.num };
    if (s.num > cur.num && (!next || s.num < next.num)) next = { c, num: s.num };
  }
  return { prev: prev && prev.c, next: next && next.c };
}

// 目录页通常就是当前页所在的目录本身。
function inferIndex(candidates, pageUrl) {
  let dir;
  try {
    const url = new URL(pageUrl);
    dir = url.origin + url.pathname.replace(/[^/]*$/, '');
  } catch {
    return null;
  }
  const bare = dir.replace(/\/$/, '');
  return candidates.find((c) => c.abs === dir || c.abs === bare) || null;
}

// 判定「是不是同一个页面」用的归一化形式。
// 去掉 fragment 之外还要去掉尾斜杠：站点生成的评论锚点常写成
// ".../40631.htm/#comment-198279"，比当前页地址多一个斜杠，
// 不归一化就漏过去，本页锚点会被当成导航候选。
function canonical(u) {
  const i = u.indexOf('#');
  const noFrag = i < 0 ? u : u.slice(0, i);
  return noFrag.replace(/\/+$/, '');
}

// 收集页面上所有可用链接，附带绝对地址，供后续按文字或按 URL 结构判定。
function collectLinks(html, pageUrl) {
  const out = [];
  const self = canonical(pageUrl);
  const re = /<a\b([^>]*)>([\s\S]{0,80}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const label = m[2].replace(/<[^>]+>/g, '').trim();
    if (!label) continue;
    const hrefMatch = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(m[1]);
    if (!hrefMatch) continue;
    const raw = hrefMatch[2] !== undefined ? hrefMatch[2]
      : (hrefMatch[3] !== undefined ? hrefMatch[3] : hrefMatch[4]);
    const abs = rewrite.absolutize(raw, pageUrl);
    if (!abs) continue;
    // 指向本页的锚点（评论定位之类）不是导航，排掉，否则会污染判定。
    if (canonical(abs) === self) continue;
    out.push({ label, abs });
  }
  return out;
}

// 抽取翻页链接。重排后如果丢了「下一章」，这个视图就没法读下去了。
//
// 两级策略：
//   1. 按文字匹配「上一章/下一章/目录」——站点这么写时最准。
//   2. 匹配不到就按 URL 结构推断。相当多的站直接拿章节标题当链接文字
//      （如 kunnu8），纯文字匹配对这类站一无所获，但它们的 URL 编号是连续的。
function extractNav(html, pageUrl, base, query) {
  const links = collectLinks(html, pageUrl);
  const found = {};
  const claimed = new Set();

  for (const link of links) {
    for (const nav of NAV_WORDS) {
      if (!found[nav.key] && nav.re.test(link.label)) {
        found[nav.key] = { href: rewrite.proxyHref(link.abs, base, query), label: nav.label };
        claimed.add(link.abs);
      }
    }
  }

  if (!found.prev || !found.next) {
    const adj = inferAdjacent(links, pageUrl);
    for (const key of ['prev', 'next']) {
      if (!found[key] && adj[key]) {
        const label = NAV_WORDS.find((n) => n.key === key).label;
        found[key] = { href: rewrite.proxyHref(adj[key].abs, base, query), label };
        claimed.add(adj[key].abs);
      }
    }
  }

  if (!found.index) {
    const idx = inferIndex(links, pageUrl);
    if (idx) {
      found.index = {
        href: rewrite.proxyHref(idx.abs, base, query),
        label: NAV_WORDS.find((n) => n.key === 'index').label,
      };
      claimed.add(idx.abs);
    }
  }

  const pager = [];
  const seen = new Set();
  for (const link of links) {
    if (pager.length >= MAX_PAGER_LINKS) break;
    if (claimed.has(link.abs) || seen.has(link.abs)) continue;
    if (!PAGER_RE.test(link.label)) continue;
    seen.add(link.abs);
    pager.push({ href: rewrite.proxyHref(link.abs, base, query), label: link.label });
  }
  found.pager = pager;

  return found;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// FNV-1a 短哈希。语料集名要稳定（同一站每次显示一致）但不可反读出域名。
function hostTag(host) {
  let h = 2166136261;
  for (let i = 0; i < host.length; i++) {
    h ^= host.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ('000000' + h.toString(36)).slice(-6);
}

function pad(n) {
  return String(n).padStart(4, '0');
}

// 小窗内固定深色。长时间阅读深色底更省眼，
// 且嵌在浅色文档页里的深色面板读起来像日志/控制台区块——文档站里这很常见，不突兀。
const FIXTURE_CSS = `
  /* 背景取控制台的「大背景」灰（#171717，即 db-console 的 --bg / body 底色，
     主内容区 .main 本身透明、透出的就是它）——不再用偏蓝深色，也不用略亮的 --surface，
     嵌进来跟整块控制台是同一个灰，连小窗自己的头/栏/脚（本就是 --bg）也拼成一整片，没有色差。
     文字压着但比默认亮一档以适配灰底：默认对比刚好能读，中文方块字在一步开外糊成灰纹理，
     凑近才成字；指针所在的行再提一点（--fx-hi）。
     亮白正文（#c3cbd6 一档）试过，隔着半个工位都看得清轮廓，太招眼。 */
  :root { color-scheme: dark;
    --fx-bg:#171717; --fx-fg:#9aa3ae; --fx-hi:#ccd3db; --fx-dim:#6b727c;
    --fx-line:#2a2a2a; --fx-key:#565c65; --fx-accent:#6c93c2; --fx-head:#adb5bf; }
  * { box-sizing:border-box; }
  /* 隐藏滚动条但保留滚动。小窗窄，滚动条既占地方又扎眼。 */
  html,body,* { scrollbar-width:none; -ms-overflow-style:none; }
  *::-webkit-scrollbar { width:0; height:0; display:none; }
  body { margin:0; padding:18px 20px 28px; background:var(--fx-bg); color:var(--fx-fg);
    font:13px/1.5 ui-sans-serif,-apple-system,"Segoe UI",sans-serif;
    overflow-x:hidden; }
  header { border-bottom:1px solid var(--fx-line); padding-bottom:10px; margin-bottom:14px; }
  .eyebrow { font:10px/1.4 ui-monospace,"Cascadia Mono",Consolas,monospace;
    letter-spacing:.09em; text-transform:uppercase; color:var(--fx-dim); }
  h1 { font-size:13px; font-weight:600; margin:6px 0 0; color:var(--fx-head); }
  .meta { font:10px/1.4 ui-monospace,"Cascadia Mono",Consolas,monospace;
    color:var(--fx-dim); margin-top:5px; }
  /* table-layout:fixed + 强制换行：没有它，一条长网址或长串不可断字符
     会把表格撑宽，底部就多出一条横向滚动条。 */
  table { border-collapse:collapse; width:100%; table-layout:fixed; }
  td { vertical-align:baseline; padding:3px 0; border-bottom:1px solid transparent;
    overflow-wrap:anywhere; word-break:break-word; }
  td.k { width:5.5em; padding-right:12px; white-space:nowrap;
    font:10.5px/1.75 ui-monospace,"Cascadia Mono",Consolas,monospace;
    color:var(--fx-key); user-select:none; }
  td.v { font-size:13.5px; line-height:1.95; transition:color .13s ease;
    font-family:"Source Han Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif; }
  tr:hover td { background:color-mix(in srgb, var(--fx-accent) 5%, transparent); }
  tr:hover td.v { color:var(--fx-hi); }
  /* 正文里保留下来的原站链接。做得克制些，免得整页蓝字破坏语料表的观感。 */
  a.fx-lnk { color:var(--fx-accent); text-decoration:none;
    border-bottom:1px solid color-mix(in srgb, var(--fx-accent) 35%, transparent); }
  a.fx-lnk:hover { border-bottom-color:var(--fx-accent); }
  nav { margin-top:20px; padding-top:12px; border-top:1px solid var(--fx-line);
    display:flex; gap:14px; flex-wrap:wrap;
    font:11px/1.4 ui-monospace,"Cascadia Mono",Consolas,monospace; }
  nav a { color:var(--fx-accent); text-decoration:none; }
  nav a:hover { text-decoration:underline; }
  nav .pgs { display:flex; gap:7px; flex-wrap:wrap; margin-left:auto; }
  nav .pgs a { color:var(--fx-dim); padding:0 3px; }
  nav .pgs a:hover { color:var(--fx-accent); text-decoration:none; }
  .empty { color:var(--fx-dim); font-style:italic; padding:16px 0; }
  /* 低对比模式：正文压到近底色，只有指针所在的行升到可读对比度。
     隔一步瞥见是一块几乎没内容的暗面板，凑近把鼠标放上去才读得出字。 */
  body.dim td.v { color:#34373b; transition:color .13s ease; }
  body.dim td.v a.fx-lnk { color:inherit; border-bottom-color:transparent; }
  body.dim tr:hover td.v { color:var(--fx-fg); }
  body.dim tr:hover td.v a.fx-lnk { color:var(--fx-accent);
    border-bottom-color:color-mix(in srgb, var(--fx-accent) 35%, transparent); }
  body.dim h1, body.dim .eyebrow, body.dim .meta { color:#3d4147; }
  body.dim nav a { color:#3d4147; transition:color .13s ease; }
  body.dim nav a:hover { color:var(--fx-accent); }
`;

/**
 * 把一页 HTML 转成 fixture 视图。
 * 抽不到正文时退回普通重写视图，宁可显示原页也不给一个空白框架。
 */
function toFixture(html, options) {
  const { pageUrl, base, dim } = options;
  const query = fxQuery(dim);
  const cleaned = stripNoise(html);
  const fragment = findByHint(cleaned) || findByDensity(cleaned);

  if (!fragment) {
    // 抽取失败退回普通视图，但仍带上视图标记：
    // 否则中间有一页抽不出正文，就会把你永久踢出 fixture 模式。
    return rewrite.rewriteHtml(html, { ...options, linkQuery: query });
  }

  // 已经是转义过、且把 <a> 还原成代理链接的 HTML，下面直接用，不要再转义一次。
  const paragraphs = toLinkedParagraphs(fragment, pageUrl, base, query);
  if (paragraphs.length === 0) {
    // 抽取失败退回普通视图，但仍带上视图标记：
    // 否则中间有一页抽不出正文，就会把你永久踢出 fixture 模式。
    return rewrite.rewriteHtml(html, { ...options, linkQuery: query });
  }

  const title = extractTitle(cleaned);
  const nav = extractNav(cleaned, pageUrl, base, query);
  const host = (() => {
    try { return new URL(pageUrl).hostname; } catch { return 'local'; }
  })();

  // 章节名往往是整个面板上最扎眼的一行大号中文，且「第 N 章」的字样一眼就穿帮。
  // 标题栏只放从 URL 编号推出的英文批次名；真实章节名降级为第一条语料——
  // 读的人照样找得到，瞥的人看不出它是标题。
  const sn = splitNumeric(pageUrl);
  const batchNo = String(sn ? sn.num : paragraphs.length).slice(-4).padStart(4, '0');
  const headTitle = 'Strings batch ' + batchNo;
  // 只有像章节名的标题（带编号或「章/节/卷/回/话」）才值得降级保留。
  // 不少站拿站名当页面 h1（如「鲲弩小说」），原样塞进语料行等于把品牌名带进面板。
  const chapterish = /[0-9０-９一二三四五六七八九十百千零两]|[章节卷回话集幕篇]/;
  if (title && countChinese(title) > 0 && chapterish.test(title)) {
    const escaped = escapeHtml(title);
    if (!(paragraphs[0] && paragraphs[0].includes(escaped))) paragraphs.unshift(escaped);
  }

  const rows = paragraphs
    .map((p, i) => '<tr><td class="k">L.' + pad(i + 1) + '</td><td class="v">' + p + '</td></tr>')
    .join('\n');

  const primary = ['prev', 'index', 'next']
    .filter((k) => nav[k])
    .map((k) => '<a href="' + escapeHtml(nav[k].href) + '">' + escapeHtml(nav[k].label) + '</a>')
    .join('');

  // 页码等次级翻页控件。原样保留标签文字——它们本来就是数字或短词，
  // 混在语料表的行号里毫不违和。
  const pager = (nav.pager || [])
    .map((p) => '<a class="pg" href="' + escapeHtml(p.href) + '">' + escapeHtml(p.label) + '</a>')
    .join('');

  const navLinks = primary + (pager ? '<span class="pgs">' + pager + '</span>' : '');

  // 语料集名用主机名的短哈希代替真实域名。
  // 曾直接截取域名主体（kunnu8 原样可见），与「任何位置不出现源站名字」相悖。
  const setId = 'zh-CN.' + hostTag(host);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Localization fixtures</title>
<style>${FIXTURE_CSS}</style>
${rewrite.guardScript()}
</head><body${dim ? ' class="dim"' : ''}>
<header>
  <div class="eyebrow">Localization fixtures &middot; zh-CN</div>
  <h1>${escapeHtml(headTitle)}</h1>
  <div class="meta">set ${escapeHtml(setId)} &middot; ${paragraphs.length} entries &middot; encoding utf-8</div>
</header>
<table>
${rows}
</table>
${navLinks ? '<nav>' + navLinks + '</nav>' : ''}
</body></html>`;
}

module.exports = {
  stripNoise, countChinese, sliceBalanced, findByHint, findByDensity,
  toParagraphs, toLinkedParagraphs, extractTitle, extractNav, toFixture,
  collectLinks, splitNumeric, sameSeries, inferAdjacent, inferIndex,
  splitRow, fxQuery, hostTag,
};
