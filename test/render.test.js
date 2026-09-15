'use strict';

const test = require('node:test');
const assert = require('node:assert');
const render = require('../lib/render.js');

const PAGE = 'https://site.example/book/1/c42.html';
const BASE = 'http://127.0.0.1:8080';

// 自动生成的中文填充文本，用来触达密度阈值。
function filler(n) {
  const cell = '窗外的雨下了整夜，屋檐上的水珠一颗接着一颗落下来，敲在青石板上。';
  return cell.repeat(n);
}

function novelPage(opts) {
  const o = opts || {};
  const containerAttr = o.containerAttr || 'id="chaptercontent"';
  return '<html><head><title>' + (o.title || '第四十二章 夜雨') + '</title>'
    + '<script>var ads=1;</script><style>.x{}</style></head><body>'
    + '<div class="header">导航栏</div>'
    + '<h1>' + (o.h1 || '第四十二章 夜雨') + '</h1>'
    + '<div ' + containerAttr + '>'
    + filler(3) + '<br><br>' + filler(3) + '<br><br>' + filler(3)
    + '</div>'
    + '<div class="nav">'
    + '<a href="c41.html">上一章</a>'
    + '<a href="/book/1/">目录</a>'
    + '<a href="c43.html">下一章</a>'
    + '</div>'
    + '</body></html>';
}

test('stripNoise 清掉脚本样式与注释', () => {
  const out = render.stripNoise('<div>a<script>bad()</script><style>.x{}</style><!-- c -->b</div>');
  assert.ok(!out.includes('bad()'));
  assert.ok(!out.includes('.x{}'));
  assert.ok(!out.includes('c -->'));
  assert.ok(out.includes('a') && out.includes('b'));
});

test('countChinese 只统计汉字', () => {
  assert.strictEqual(render.countChinese('abc123'), 0);
  assert.strictEqual(render.countChinese('夜雨'), 2);
  assert.strictEqual(render.countChinese('a夜b雨c'), 2);
});

test('sliceBalanced 正确配平嵌套标签', () => {
  const html = 'xx<div id="a">1<div>2</div>3</div>yy';
  const out = render.sliceBalanced(html, html.indexOf('<div id="a">'), 'div');
  assert.strictEqual(out, '<div id="a">1<div>2</div>3</div>', '嵌套的内层 </div> 不能提前收尾');
});

test('findByHint 命中常见正文容器', () => {
  const frag = render.findByHint(render.stripNoise(novelPage()));
  assert.ok(frag, '应命中 #chaptercontent');
  assert.ok(render.countChinese(frag) > 100);
  assert.ok(!frag.includes('导航栏'), '不应把页头一起圈进来');
});

test('findByDensity 在无已知容器时兜底', () => {
  const html = render.stripNoise(novelPage({ containerAttr: 'class="mystery-box-9x"' }));
  assert.strictEqual(render.findByHint(html), null, '前提：命中不了 hint');
  const frag = render.findByDensity(html);
  assert.ok(frag && render.countChinese(frag) >= 200, '密度兜底应找到正文');
});

test('toParagraphs 拆段并解实体', () => {
  const paras = render.toParagraphs('<p>第一段&nbsp;文字</p><br>第二段&amp;符号');
  assert.ok(paras.length >= 2);
  assert.ok(paras.some((p) => p.includes('第一段')));
  assert.ok(paras.some((p) => p.includes('&') && !p.includes('&amp;')), '实体应还原');
});

test('extractNav 抽出上一章/下一章/目录', () => {
  const nav = render.extractNav(novelPage(), PAGE, BASE);
  assert.ok(nav.next, '缺了下一章就没法往下读，这个视图等于废掉');
  assert.ok(nav.prev);
  assert.ok(nav.index);
  assert.ok(nav.next.href.startsWith(BASE + '/r/'), '导航也要走代理');
});

test('toFixture 输出语料表且不泄露源站信息', () => {
  const out = render.toFixture(novelPage(), { pageUrl: PAGE, base: BASE });
  assert.ok(out.includes('Localization fixtures'), '应呈现为本地化语料面板');
  assert.ok(/L\.0001/.test(out), '条目应带行号前缀');
  assert.ok(out.includes('窗外的雨'), '正文应保留');
  assert.ok(!out.includes('site.example'), '任何位置都不得出现源站域名');
  assert.ok(out.includes('Next batch'), '翻页应保留');
  assert.ok(out.includes('__aside'), '守卫脚本应注入');
  assert.ok(out.includes("'pointer'"), '必须回报指针进出，否则父页面看不到 iframe 内的鼠标');
});

test('toFixture 页面语言标记为 en，与伪装页一致', () => {
  const out = render.toFixture(novelPage(), { pageUrl: PAGE, base: BASE });
  assert.ok(/<html lang="en">/.test(out));
});

test('抽不到正文时退回普通视图，而不是给一个空白框架', () => {
  const thin = '<html><head><title>t</title></head><body><p>short</p></body></html>';
  const out = render.toFixture(thin, { pageUrl: PAGE, base: BASE });
  assert.ok(out.includes('<base href='), '应退回 rewriteHtml 的结果');
  assert.ok(!out.includes('Localization fixtures'));
});

test('fixture view 保留正文内的原站链接', () => {
  // 剥标签会顺手把 <a> 也剥掉，正文里的章节跳转、分页链接就全失效了。
  const page = novelPage({
    containerAttr: 'id="chaptercontent"',
  }).replace('<br><br>' + filler(3), '<br><br><a href="/c99.html">本章说</a>' + filler(3));

  const out = render.toFixture(page, { pageUrl: PAGE, base: BASE });
  const m = /<a class="fx-lnk" href="([^"]+)"[^>]*>本章说<\/a>/.exec(out);
  assert.ok(m, '正文里的链接应保留下来');
  assert.ok(m[1].startsWith(BASE + '/r/'), '且必须走代理，否则点了会跳出小窗');
});

// 相当多的站不写「上一章/下一章」，直接拿章节标题当链接文字。
// 纯文字匹配对这类站一无所获，必须靠 URL 编号推断。
const SERIES_PAGE = 'https://site.example/book/40631.htm';
const SERIES_HTML = [
  '<a href="https://site.example">站点首页</a>',
  '<a href="https://site.example/book/">书名</a>',
  '<a href="https://site.example/book/40631.htm">当前这一章</a>',
  '<a href="#anchor">直达底部</a>',
  '<a href="https://site.example/book/40630.htm">某章标题（一）</a>',
  '<a href="https://site.example/book/40632.htm">某章标题（三）</a>',
  '<a href="https://site.example/book/40631.htm/#comment-198279">2018-12-22 21:36</a>',
].join('');

test('splitNumeric 切出路径里最后一个数字', () => {
  const s = render.splitNumeric('https://site.example/book/40631.htm');
  assert.strictEqual(s.num, 40631);
  assert.strictEqual(s.head, '/book/');
  assert.strictEqual(s.tail, '.htm');
  assert.strictEqual(render.splitNumeric('https://site.example/book/'), null, '无数字应返回 null');
  assert.strictEqual(render.splitNumeric('not a url'), null);
});

test('sameSeries 只认同源同目录同后缀', () => {
  const a = render.splitNumeric('https://site.example/book/40631.htm');
  assert.ok(render.sameSeries(a, render.splitNumeric('https://site.example/book/40632.htm')));
  assert.ok(!render.sameSeries(a, render.splitNumeric('https://other.example/book/40632.htm')), '跨域不算');
  assert.ok(!render.sameSeries(a, render.splitNumeric('https://site.example/other/40632.htm')), '跨目录不算');
  assert.ok(!render.sameSeries(a, render.splitNumeric('https://site.example/book/40632.html')), '后缀不同不算');
});

test('回归：链接文字是章节标题时，仍能抽出上下章', () => {
  const nav = render.extractNav(SERIES_HTML, SERIES_PAGE, BASE);
  const target = (k) => decodeURIComponent(
    Buffer.from(nav[k].href.slice((BASE + '/r/').length), 'base64url').toString('utf8')
  );
  assert.ok(nav.prev, '上一章必须抽到，否则这类站在 fixture view 里没法翻页');
  assert.ok(nav.next, '下一章必须抽到');
  assert.strictEqual(target('prev'), 'https://site.example/book/40630.htm');
  assert.strictEqual(target('next'), 'https://site.example/book/40632.htm');
  assert.strictEqual(target('index'), 'https://site.example/book/', '目录应推断为所在目录');
});

test('编号有跳号时取最接近的一篇', () => {
  const html = [
    '<a href="https://site.example/book/40600.htm">早前某章</a>',
    '<a href="https://site.example/book/40628.htm">紧邻的上一章</a>',
    '<a href="https://site.example/book/40640.htm">紧邻的下一章</a>',
    '<a href="https://site.example/book/40700.htm">很后面某章</a>',
  ].join('');
  const nav = render.extractNav(html, SERIES_PAGE, BASE);
  const target = (k) => Buffer.from(nav[k].href.slice((BASE + '/r/').length), 'base64url').toString('utf8');
  assert.strictEqual(target('prev'), 'https://site.example/book/40628.htm', '章节编号常跳号，要取最接近的');
  assert.strictEqual(target('next'), 'https://site.example/book/40640.htm');
});

test('URL 推断不跨站、不跨目录', () => {
  const html = [
    '<a href="https://other.example/book/40632.htm">别站同编号</a>',
    '<a href="https://site.example/elsewhere/40632.htm">同站别目录</a>',
  ].join('');
  const nav = render.extractNav(html, SERIES_PAGE, BASE);
  assert.ok(!nav.next, '不同源或不同目录的链接不能被当成下一章');
});

test('文字匹配优先于 URL 推断', () => {
  const html = [
    '<a href="https://site.example/book/40632.htm">某章标题（三）</a>',
    '<a href="https://site.example/book/99999.htm">下一章</a>',
  ].join('');
  const nav = render.extractNav(html, SERIES_PAGE, BASE);
  const target = Buffer.from(nav.next.href.slice((BASE + '/r/').length), 'base64url').toString('utf8');
  assert.strictEqual(target, 'https://site.example/book/99999.htm', '站点明确写了「下一章」时应以它为准');
});

test('指向本页的锚点不参与导航判定', () => {
  const links = render.collectLinks(SERIES_HTML, SERIES_PAGE);
  assert.ok(!links.some((l) => l.abs.includes('#comment')), '评论锚点是本页内定位，不是导航');
  assert.ok(!links.some((l) => l.label === '当前这一章'), '指向自己的链接应排除');
});

// fixture 模式必须跟着导航一起走。链接上不带标记的话，
// 点一次「下一章」就退回普通视图，每翻一页都得重新点切换按钮。
test('回归：fixture view 的翻页链接带 fx 标记', () => {
  const out = render.toFixture(novelPage(), { pageUrl: PAGE, base: BASE });
  const hrefs = [...out.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const proxied = hrefs.filter((h) => h.startsWith(BASE + '/r/'));
  assert.ok(proxied.length > 0, '前提：应有代理链接');
  for (const h of proxied) {
    assert.ok(h.endsWith('?fx=1'), '每个链接都要带 fx，否则翻一页就掉出 fixture 模式：' + h);
  }
});

test('回归：正文内保留的链接同样带 fx 标记', () => {
  const page = novelPage().replace(
    '<div id="chaptercontent">',
    '<div id="chaptercontent"><a href="/c99.html">本章说</a>'
  );
  const out = render.toFixture(page, { pageUrl: PAGE, base: BASE });
  const m = /<a class="fx-lnk" href="([^"]+)"/.exec(out);
  assert.ok(m, '正文链接应保留');
  assert.ok(m[1].endsWith('?fx=1'), '正文里的链接也要留在 fixture 模式内');
});

test('回归：抽取失败退回普通视图时仍带 fx 标记', () => {
  // 中间夹一页抽不出正文，不能就此把人永久踢出 fixture 模式
  const thin = '<html><head><title>t</title></head><body><a href="/next.html">下一章</a></body></html>';
  const out = render.toFixture(thin, { pageUrl: PAGE, base: BASE });
  assert.ok(!out.includes('Localization fixtures'), '前提：走的是回退路径');
  const m = /href="([^"]+\/r\/[^"]+)"/.exec(out);
  assert.ok(m && m[1].endsWith('?fx=1'), '回退页的链接也要带 fx');
});

test('extractNav 默认不加 query，只有 fixture view 才加', () => {
  const nav = render.extractNav(novelPage(), PAGE, BASE);
  assert.ok(!nav.next.href.includes('?'), '普通视图的链接不该带 fx');
});

test('fixture view 抽取分页控件', () => {
  const page = novelPage().replace(
    '<div class="nav">',
    '<div class="pager"><a href="/p1.html">1</a><a href="/p2.html">2</a>'
    + '<a href="/p9.html">尾页</a><a href="/cat/xuanhuan">玄幻小说</a></div><div class="nav">'
  );
  const nav = render.extractNav(page, PAGE, BASE);
  const labels = nav.pager.map((p) => p.label);
  assert.ok(labels.includes('1') && labels.includes('2'), '页码应被抽出');
  assert.ok(labels.includes('尾页'), '首页/尾页应被抽出');
  assert.ok(!labels.includes('玄幻小说'), '站点分类导航不该混进来');
});

test('分页链接去重且有数量上限', () => {
  let links = '';
  for (let i = 1; i <= 30; i++) links += '<a href="/p' + i + '.html">' + i + '</a>';
  links += '<a href="/p1.html">1</a>';   // 重复
  const page = novelPage().replace('<div class="nav">', '<div class="pager">' + links + '</div><div class="nav">');
  const nav = render.extractNav(page, PAGE, BASE);
  assert.ok(nav.pager.length <= 12, '不能把整页页码都堆上去，实际 ' + nav.pager.length);
  const hrefs = nav.pager.map((p) => p.href);
  assert.strictEqual(new Set(hrefs).size, hrefs.length, '同一目标不应重复出现');
});

test('正文内的 javascript: 链接被丢弃而非变成可点链接', () => {
  const page = novelPage().replace(
    '<div id="chaptercontent">',
    '<div id="chaptercontent"><a href="javascript:alert(1)">点我</a>'
  );
  const out = render.toFixture(page, { pageUrl: PAGE, base: BASE });
  assert.ok(!out.includes('javascript:'), '不该产出 javascript: 链接');
  assert.ok(out.includes('点我'), '但文字本身应保留');
});

test('还原链接后不残留控制字符标记', () => {
  const out = render.toFixture(novelPage(), { pageUrl: PAGE, base: BASE });
  for (const c of ['\u0001', '\u0002', '\u0003']) {
    assert.ok(!out.includes(c), '标记字符必须清理干净');
  }
});

test('toFixture 转义正文中的 HTML，防止排版被打乱', () => {
  const page = novelPage().replace('窗外的雨下了整夜', '<img src=x onerror=alert(1)>窗外的雨下了整夜');
  const out = render.toFixture(page, { pageUrl: PAGE, base: BASE });
  assert.ok(!out.includes('onerror=alert'), '正文里的标签必须转义后再输出');
});

// ---- 正文切短行（伪装排版的一部分：散文式长段一眼就是小说，短行才像字符串表）----

test('splitRow 把长段按句末标点切成短行', () => {
  const line = filler(3); // 三个 32 字的句子连成一段
  const rows = render.splitRow(line);
  assert.strictEqual(rows.length, 3, '应按句号切成三行');
  assert.strictEqual(rows.join(''), line, '切分不得增删一个字');
  assert.ok(rows.every((r) => r.endsWith('。')));
});

test('splitRow 不碰本来就短的行', () => {
  const line = '短句。也是短句。';
  assert.deepStrictEqual(render.splitRow(line), [line]);
});

test('splitRow 不在引号内切分', () => {
  const line = '他说：「今晚别回来了。明天再说。」说完就走了，头也不回，'
    + '脚步声消失在楼道尽头的黑暗里。窗外的雨还在下，一直下到天亮。'
    + '楼下的灯一盏一盏熄灭，最后只剩他自己的影子还留在原地。';
  assert.ok(line.length > 60, '前提：样例必须长到触发切分');
  const rows = render.splitRow(line);
  assert.strictEqual(rows.join(''), line);
  for (const r of rows) {
    const opens = (r.match(/「/g) || []).length;
    const closes = (r.match(/」/g) || []).length;
    assert.strictEqual(opens, closes, '对话被拆散了：' + r);
  }
});

test('splitRow 不拆链接标记，链接整体留在同一行', () => {
  const line = '前面的句子说了很多话，一直说到这里才停。'.repeat(2)
    + '0第十章。完'
    + '后面的句子又接着说了很多别的话。'.repeat(2);
  const rows = render.splitRow(line);
  assert.strictEqual(rows.join(''), line);
  for (const r of rows) {
    const starts = (r.match(//g) || []).length;
    const ends = (r.match(//g) || []).length;
    assert.strictEqual(starts, ends, '链接标记被拆到两行，restoreLinks 会把链接整个丢掉');
  }
});

// ---- 章节名遮蔽 ----

test('fixture 标题栏只出现英文批次名，不出现中文章节名', () => {
  const out = render.toFixture(novelPage(), { pageUrl: PAGE, base: BASE });
  const h1 = /<h1>([^<]*)<\/h1>/.exec(out);
  assert.ok(h1, '应有标题行');
  assert.ok(!/[一-鿿]/.test(h1[1]),
    '「第 N 章」是整个面板上最扎眼的一行大号中文，不得出现在标题栏');
  assert.ok(/batch \d{4}/.test(h1[1]), '批次名应从 URL 编号推出');
});

test('真实章节名降级为第一条语料行，读的人仍找得到', () => {
  const out = render.toFixture(novelPage(), { pageUrl: PAGE, base: BASE });
  const firstRow = /<td class="k">L\.0001<\/td><td class="v">([^<]*)</.exec(out);
  assert.ok(firstRow, '应有 L.0001 行');
  assert.ok(firstRow[1].includes('第四十二章'), '章节名应保留在语料行里');
});

// ---- 低对比（瞥视）模式 ----

test('dim 模式：body 压暗且标记随所有链接传递', () => {
  const out = render.toFixture(novelPage(), { pageUrl: PAGE, base: BASE, dim: true });
  assert.ok(out.includes('<body class="dim">'));
  const hrefs = [...out.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((h) => h.startsWith(BASE + '/r/'));
  assert.ok(hrefs.length > 0, '前提：应有代理链接');
  for (const h of hrefs) {
    assert.ok(h.endsWith('?fx=1&amp;dim=1'), '不带 dim 的话翻一页就亮回去了：' + h);
  }
});

test('dim 未开启时不产出 dim 标记', () => {
  const out = render.toFixture(novelPage(), { pageUrl: PAGE, base: BASE });
  assert.ok(!out.includes('dim=1'));
  assert.ok(!out.includes('<body class="dim">'));
});

test('语料集名是域名哈希，不含源站域名片段', () => {
  const out = render.toFixture(novelPage(), { pageUrl: PAGE, base: BASE });
  assert.ok(/set zh-CN\.[a-z0-9]{6}/.test(out), '应有稳定的六位哈希集名');
  assert.ok(!out.includes('zh-CN.site'), '曾直接截取域名主体，kunnu8 一类的站名原样可见');
  assert.strictEqual(render.hostTag('www.kunnu8.com'), render.hostTag('www.kunnu8.com'),
    '同一站的集名必须稳定，否则反复被瞥见时数据在变');
  assert.notStrictEqual(render.hostTag('www.kunnu8.com'), render.hostTag('www.example.com'));
});

test('站名式标题不注入语料行', () => {
  // 不少站拿站名当页面 h1。它不像章节名（无编号、无「章/节」），
  // 塞进语料行等于把小说站品牌名带进面板。
  const page = novelPage({ title: '鲲弩小说', h1: '鲲弩小说' });
  const out = render.toFixture(page, { pageUrl: PAGE, base: BASE });
  assert.ok(!out.includes('鲲弩小说'), '站名不得出现在面板任何位置');
});

test('dim 模式抽取失败的回退页也带 dim 标记', () => {
  const thin = '<html><head><title>t</title></head><body><a href="/next.html">下一章</a></body></html>';
  const out = render.toFixture(thin, { pageUrl: PAGE, base: BASE, dim: true });
  const m = /href="([^"]+\/r\/[^"]+)"/.exec(out);
  assert.ok(m && m[1].includes('dim=1'), '回退页丢了标记，翻回正常页时 dim 就掉了');
});
