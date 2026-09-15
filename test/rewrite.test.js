'use strict';

const test = require('node:test');
const assert = require('node:assert');
const r = require('../lib/rewrite.js');

const BASE = 'http://127.0.0.1:8080';
const PAGE = 'https://site.example/book/1/';

test('base64url 编解码往返', () => {
  const urls = [
    'https://site.example/book/1/',
    'https://site.example/搜索?q=剑来&page=2',
    'http://a.b/c?d=1&e=2#f',
  ];
  for (const u of urls) {
    assert.strictEqual(r.decodeTarget(r.encodeTarget(u)), new URL(u).href);
  }
});

test('decodeTarget 拒绝非 http(s) 与畸形输入', () => {
  assert.strictEqual(r.decodeTarget(r.encodeTarget('file:///c:/secret')), null);
  assert.strictEqual(r.decodeTarget(r.encodeTarget('javascript:alert(1)')), null);
  assert.strictEqual(r.decodeTarget('!!!not-base64!!!'), null);
  assert.strictEqual(r.decodeTarget(''), null);
});

test('absolutize 处理各种路径形式', () => {
  assert.strictEqual(r.absolutize('/next', PAGE), 'https://site.example/next');
  assert.strictEqual(r.absolutize('chap2.html', PAGE), 'https://site.example/book/1/chap2.html');
  assert.strictEqual(r.absolutize('//cdn.example/x.js', PAGE), 'https://cdn.example/x.js');
  assert.strictEqual(r.absolutize('https://other.example/y', PAGE), 'https://other.example/y');
});

test('absolutize 跳过不该代理的 scheme', () => {
  for (const v of ['javascript:void(0)', 'mailto:a@b.c', 'tel:123', '#top', 'data:text/html,x', 'about:blank']) {
    assert.strictEqual(r.absolutize(v, PAGE), null, v + ' 不应被重写');
  }
});

test('rewriteLinks 重写 a[href] 为绝对代理地址', () => {
  const out = r.rewriteLinks('<a href="/next">n</a>', PAGE, BASE);
  const m = /href="([^"]+)"/.exec(out);
  assert.ok(m, '应保留 href 属性');
  assert.ok(m[1].startsWith(BASE + '/r/'), '必须是绝对地址，否则会被 <base> 解析到源站');
  assert.strictEqual(r.decodeTarget(m[1].slice((BASE + '/r/').length)), 'https://site.example/next');
});

test('rewriteLinks 处理单引号与无引号属性', () => {
  for (const tag of ["<a href='/next'>n</a>", '<a href=/next>n</a>']) {
    const out = r.rewriteLinks(tag, PAGE, BASE);
    const m = /href="([^"]+)"/.exec(out);
    assert.ok(m, tag + ' 应被重写');
    assert.strictEqual(r.decodeTarget(m[1].slice((BASE + '/r/').length)), 'https://site.example/next');
  }
});

test('rewriteLinks 剥掉 target，避免开进新标签页', () => {
  const out = r.rewriteLinks('<a href="/next" target="_blank">n</a>', PAGE, BASE);
  assert.ok(!/target/i.test(out), 'target 必须移除：新标签页是最糟的暴露方式');
});

test('rewriteLinks 重写 form[action]', () => {
  const out = r.rewriteLinks('<form action="/search" method="get">', PAGE, BASE);
  const m = /action="([^"]+)"/.exec(out);
  assert.ok(m && m[1].startsWith(BASE + '/r/'));
  assert.ok(/method="?get/i.test(out), '其余属性应保留');
});

test('rewriteLinks 不碰跳过型链接', () => {
  const src = '<a href="javascript:void(0)">j</a><a href="#top">t</a>';
  assert.strictEqual(r.rewriteLinks(src, PAGE, BASE), src);
});

test('stripSecurityMeta 只清安全类 meta', () => {
  const src = '<meta http-equiv="Content-Security-Policy" content="x">'
    + '<meta http-equiv="X-Frame-Options" content="DENY">'
    + '<meta charset="utf-8">'
    + '<meta http-equiv="refresh" content="5">';
  const out = r.stripSecurityMeta(src);
  assert.ok(!/content-security-policy/i.test(out));
  assert.ok(!/x-frame-options/i.test(out));
  assert.ok(/charset="utf-8"/.test(out), 'charset meta 必须保留');
  assert.ok(/refresh/i.test(out), '无关 meta 不该被误伤');
});

test('rewriteHtml 注入 base 与守卫脚本，且不动子资源', () => {
  const html = '<html><head></head><body><img src="/img/a.png"><a href="/next">n</a></body></html>';
  const out = r.rewriteHtml(html, { pageUrl: PAGE, base: BASE });
  assert.ok(out.includes('<base href="' + PAGE + '">'), 'base 必须注入');
  assert.ok(out.includes('<img src="/img/a.png">'), '子资源交给 base 解析，不重写');
  assert.ok(out.includes('__aside'), '守卫脚本应注入');
  assert.ok(!out.includes('preventDefault()'), '不得屏蔽源站的原生交互');
  assert.ok(out.includes(BASE + '/r/'), '导航链接应指向代理');
});

test('rewriteHtml 注入隐藏滚动条的样式', () => {
  const out = r.rewriteHtml('<html><head></head><body>x</body></html>', { pageUrl: PAGE, base: BASE });
  assert.ok(out.includes('scrollbar-width'), '需覆盖 Firefox');
  assert.ok(out.includes('-ms-overflow-style'), '需覆盖旧 Edge/IE');
  assert.ok(out.includes('::-webkit-scrollbar'), '需覆盖 WebKit 系');
  // 只隐藏外观，不能把滚动能力也关掉，否则长章节根本翻不下去
  assert.ok(!/overflow\s*:\s*hidden/i.test(out), '不得禁用滚动');
});

test('linkQuery 挂到每个被重写的链接上', () => {
  const html = '<a href="/a">a</a><form action="/s"></form>';
  const out = r.rewriteHtml(html, { pageUrl: PAGE, base: BASE, linkQuery: '?fx=1' });
  const hrefs = [...out.matchAll(/(?:href|action)="([^"]+)"/g)].map((m) => m[1]);
  const proxied = hrefs.filter((h) => h.startsWith(BASE + '/r/'));
  assert.strictEqual(proxied.length, 2);
  for (const h of proxied) assert.ok(h.endsWith('?fx=1'), h);
});

test('不传 linkQuery 时链接保持干净', () => {
  const out = r.rewriteHtml('<a href="/a">a</a>', { pageUrl: PAGE, base: BASE });
  const m = /href="([^"]+)"/.exec(out);
  assert.ok(!m[1].includes('?'), '普通视图不该凭空多出查询串');
});

test('守卫脚本不含源站地址', () => {
  // 注入源站地址会让小说站域名出现在页面源码里。父页面自己解码 /r/<token> 即可。
  const out = r.rewriteHtml('<body>x</body>', { pageUrl: PAGE, base: BASE });
  assert.ok(!out.includes('__asideSrc'), '不该往页面里塞源站地址');
});

test('rewriteHtml 替换已有的 base 标签', () => {
  const html = '<html><head><base href="https://evil.example/"></head><body></body></html>';
  const out = r.rewriteHtml(html, { pageUrl: PAGE, base: BASE });
  assert.ok(!out.includes('evil.example'), '原有 base 会让相对路径解析错，必须清掉');
  assert.strictEqual(out.match(/<base /g).length, 1, '只应有一个 base');
});

test('rewriteHtml 在缺失 head 时仍能注入', () => {
  const out = r.rewriteHtml('<body><a href="/n">n</a></body>', { pageUrl: PAGE, base: BASE });
  assert.ok(out.includes('<base href='), '残缺 HTML 也要能处理，真实站点并不都规范');
});
