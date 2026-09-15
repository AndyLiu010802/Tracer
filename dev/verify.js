'use strict';

// 端到端验证。起一个模拟的、有敌意的小说站（GBK 编码 + X-Frame-Options + CSP），
// 跑通 伪装页 → 代理 → 翻页 → fixture view → 失败场景 整条链路。
//
// 单元测试覆盖各个模块，这个脚本覆盖它们接起来之后是否真的能用。
//
//   node dev/verify.js

const http = require('node:http');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const rewrite = require(path.join(REPO, 'lib', 'rewrite.js'));

// Node 只带 GBK 解码器不带编码器，用固定字节样本构造 GBK 响应。
const GBK = {
  ch1: Buffer.from([0xB5, 0xDA, 0xD2, 0xBB, 0xD5, 0xC2]),           // 第一章
  ch2: Buffer.from([0xB5, 0xDA, 0xB6, 0xFE, 0xD5, 0xC2]),           // 第二章
  next: Buffer.from([0xCF, 0xC2, 0xD2, 0xBB, 0xD5, 0xC2]),          // 下一章
  prev: Buffer.from([0xC9, 0xCF, 0xD2, 0xBB, 0xD5, 0xC2]),          // 上一章
  idx: Buffer.from([0xC4, 0xBF, 0xC2, 0xBC]),                       // 目录
  body: Buffer.from([0xB4, 0xB0, 0xCD, 0xE2, 0xB5, 0xC4, 0xD3, 0xEA,
    0xCF, 0xC2, 0xC1, 0xCB, 0xD5, 0xFB, 0xD2, 0xB9, 0xA1, 0xA3]),   // 窗外的雨下了整夜。
};

function chapterPage(n) {
  const title = n === 1 ? GBK.ch1 : GBK.ch2;
  const parts = [Buffer.from('<html><head><meta charset="gbk"><title>')];
  parts.push(title);
  parts.push(Buffer.from('</title></head><body><div class="head">nav</div><h1>'));
  parts.push(title);
  parts.push(Buffer.from('</h1><div id="chaptercontent">'));
  for (let i = 0; i < 40; i++) {
    parts.push(GBK.body);
    parts.push(Buffer.from('<br><br>'));
  }
  parts.push(Buffer.from('</div><div class="nav">'));
  parts.push(Buffer.from('<a href="/c1.html" target="_blank">'));
  parts.push(GBK.prev);
  parts.push(Buffer.from('</a><a href="/index.html">'));
  parts.push(GBK.idx);
  parts.push(Buffer.from('</a><a href="/c2.html">'));
  parts.push(GBK.next);
  parts.push(Buffer.from('</a></div></body></html>'));
  return Buffer.concat(parts);
}

const fake = http.createServer((req, res) => {
  res.writeHead(200, {
    'content-type': 'text/html; charset=gbk',
    'x-frame-options': 'SAMEORIGIN',
    'content-security-policy': "frame-ancestors 'none'; script-src 'self'",
  });
  res.end(chapterPage(req.url.includes('c2') ? 2 : 1));
});

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const c = [];
      res.on('data', (x) => c.push(x));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(c).toString('utf8'),
      }));
    }).on('error', reject);
  });
}

function check(label, ok, extra) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  ' + extra : ''));
  if (!ok) process.exitCode = 1;
}

(async () => {
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  const novelOrigin = 'http://127.0.0.1:' + fake.address().port;
  console.log('模拟小说站: ' + novelOrigin + '  (GBK + X-Frame-Options + CSP)\n');

  // 先探一个空闲端口，再通过环境变量交给 server。
  // 这样验证脚本可以在你正常使用应用的同时跑，不会撞端口。
  const probe = http.createServer();
  await new Promise((r) => probe.listen(0, '127.0.0.1', r));
  const freePort = probe.address().port;
  await new Promise((r) => probe.close(r));
  process.env.DOCS_PORTAL_PORT = String(freePort);
  // 断言认的是 docs-portal 的页面，皮肤必须固定，不随 local.config.json 走。
  process.env.DOCS_PORTAL_SKIN = 'docs-portal';

  const { server, config } = require(path.join(REPO, 'server.js'));
  await new Promise((r) => server.listen(config.port, config.host, r));
  const app = 'http://' + config.host + ':' + config.port;
  console.log('应用: ' + app + '\n');

  console.log('[1] 伪装页');
  const home = await get(app + '/');
  check('返回 200', home.status === 200);
  check('标签页标题伪装', home.body.includes('<title>Market Data Platform — Engineering Docs</title>'));
  check('小窗已注入', home.body.includes('/reader.js') && home.body.includes('id="aside-slot"'));
  check('源码无暴露词汇', !/novel|小说/i.test(home.body));

  console.log('\n[2] 代理加载章节（普通视图）');
  const tok1 = rewrite.encodeTarget(novelOrigin + '/c1.html');
  const ch1 = await get(app + '/r/' + tok1);
  check('返回 200', ch1.status === 200);
  check('框架限制头已剥离',
    !('x-frame-options' in ch1.headers) && !('content-security-policy' in ch1.headers));
  check('GBK 正文已转 UTF-8', ch1.body.includes('窗外的雨下了整夜'));
  check('标题已转码', ch1.body.includes('第一章'));
  check('守卫脚本已注入', ch1.body.includes('__aside'));
  check('指针回报已注入', ch1.body.includes("'pointer'"));
  check('target=_blank 已剥掉', !/target=/i.test(ch1.body));

  console.log('\n[3] 翻页留在小窗内');
  const re = new RegExp('href="' + app.replace(/\./g, '\\.') + '/r/([A-Za-z0-9_-]+)"', 'g');
  const tokens = [...ch1.body.matchAll(re)].map((m) => m[1]);
  check('导航链接已重写为代理地址', tokens.length >= 3, '(' + tokens.length + ' 个)');
  const targets = tokens.map((t) => rewrite.decodeTarget(t));
  const nextIdx = targets.findIndex((t) => t && t.endsWith('/c2.html'));
  check('下一章指向源站真实地址', nextIdx >= 0, targets[nextIdx] || '');
  const ch2 = await get(app + '/r/' + tokens[nextIdx]);
  check('点下一章能加载第二章', ch2.body.includes('第二章'));

  console.log('\n[4] Fixture view（伪装排版）');
  const fx = await get(app + '/r/' + tok1 + '?fx=1');
  check('渲染为本地化语料面板', fx.body.includes('Localization fixtures'));
  check('条目带行号前缀', /L\.0001/.test(fx.body));
  check('正文完整保留', fx.body.includes('窗外的雨下了整夜'));
  check('翻页导航保留', fx.body.includes('Next batch'));
  check('未泄露源站地址', !fx.body.includes(novelOrigin));
  check('页面语言标记为 en', /<html lang="en">/.test(fx.body));

  // fixture 模式必须跟着导航走。链接不带标记的话，点一次「下一章」
  // 就退回普通视图，每翻一页都得重新点切换按钮。
  const fxHrefs = [...fx.body.matchAll(/href="([^"]+\/r\/[^"]+)"/g)].map((m) => m[1]);
  check('fixture 链接均带 fx 标记',
    fxHrefs.length > 0 && fxHrefs.every((h) => h.endsWith('?fx=1')),
    '(' + fxHrefs.length + ' 个)');

  const fxNext = fxHrefs.find((h) => {
    const tok = h.slice(h.indexOf('/r/') + 3, h.indexOf('?'));
    const t = rewrite.decodeTarget(tok);
    return t && t.endsWith('/c2.html');
  });
  check('fixture 下一章可解析', !!fxNext);
  if (fxNext) {
    const fx2 = await get(fxNext.replace(app, app));
    check('翻页后仍停在 fixture 视图', fx2.body.includes('Localization fixtures'));
    check('翻页后内容正确', fx2.body.includes('第二章'));
  }

  console.log('\n[5] 失败场景不露馅');
  const bad = await get(app + '/r/' + rewrite.encodeTarget('http://127.0.0.1:1/x'));
  check('连不上时返回伪装提示', bad.status === 200 && bad.body.includes('Reference unavailable'));
  const notfound = await get(app + '/nope');
  check('404 也是伪装页', notfound.body.includes('Reference unavailable'));

  server.close();
  fake.close();
  console.log('\n' + (process.exitCode ? '有失败项' : '全部通过'));
})().catch((e) => { console.error(e); process.exit(1); });
