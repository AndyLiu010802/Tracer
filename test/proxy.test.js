'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const zlib = require('node:zlib');

const proxy = require('../lib/proxy.js');
const rewrite = require('../lib/rewrite.js');

const BASE = 'http://127.0.0.1:8080';

// "第一章" 的 GBK 字节。Node 只带解码器不带 GBK 编码器，用固定样本构造上游响应。
const GBK_TITLE = Buffer.from([0xB5, 0xDA, 0xD2, 0xBB, 0xD5, 0xC2]);

function collectRes() {
  const out = { status: null, headers: null, body: null };
  return {
    out,
    writeHead(status, headers) { out.status = status; out.headers = headers || {}; return this; },
    end(body) { out.body = Buffer.isBuffer(body) ? body : String(body == null ? '' : body); },
    get headersSent() { return out.status !== null; },
  };
}

// 起一个假上游，模拟真实小说站的敌意行为：框架限制头 + gzip + GBK。
function startUpstream(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => {
      resolve({ srv, origin: 'http://127.0.0.1:' + srv.address().port });
    });
  });
}

test('代理剥掉框架限制头并重写导航链接', async (t) => {
  const { srv, origin } = await startUpstream((req, res) => {
    res.writeHead(200, {
      'content-type': 'text/html; charset=gbk',
      'x-frame-options': 'SAMEORIGIN',
      'content-security-policy': "frame-ancestors 'none'; script-src 'self'",
      'x-custom-keep': 'yes',
    });
    res.end(Buffer.concat([
      Buffer.from('<html><head></head><body><h1>'),
      GBK_TITLE,
      Buffer.from('</h1><a href="/next" target="_blank">n</a></body></html>'),
    ]));
  });
  t.after(() => srv.close());

  const r = collectRes();
  await proxy.handle(origin + '/book/1', { base: BASE, fixtureView: false }, r);

  assert.strictEqual(r.out.status, 200);
  const headerKeys = Object.keys(r.out.headers).map((k) => k.toLowerCase());
  assert.ok(!headerKeys.includes('x-frame-options'), 'x-frame-options 必须剥掉');
  assert.ok(!headerKeys.includes('content-security-policy'),
    'CSP 必须整条剥掉，否则 script-src 会拦掉注入的老板键脚本');
  assert.ok(headerKeys.includes('x-custom-keep'), '无关响应头应保留');

  assert.ok(r.out.body.includes('第一章'), 'GBK 正文应被解码为 UTF-8');
  assert.ok(!/target=/i.test(r.out.body), 'target 必须移除');
  assert.ok(r.out.body.includes(BASE + '/r/'), '导航链接应指向代理');
  assert.ok(r.out.body.includes('__aside'), '守卫脚本应注入');
});

test('代理处理 gzip 压缩响应', async (t) => {
  const { srv, origin } = await startUpstream((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-encoding': 'gzip' });
    res.end(zlib.gzipSync(Buffer.from('<html><body><p>压缩正文</p></body></html>', 'utf8')));
  });
  t.after(() => srv.close());

  const r = collectRes();
  await proxy.handle(origin + '/x', { base: BASE, fixtureView: false }, r);
  assert.ok(r.out.body.includes('压缩正文'));
  assert.ok(!Object.keys(r.out.headers).map((k) => k.toLowerCase()).includes('content-encoding'),
    '已解压就不能再声明 content-encoding');
});

test('代理跟随重定向，浏览器侧不留跳转痕迹', async (t) => {
  const { srv, origin } = await startUpstream((req, res) => {
    if (req.url === '/old') {
      res.writeHead(302, { location: '/new' });
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<html><body><p>最终页</p></body></html>');
  });
  t.after(() => srv.close());

  const r = collectRes();
  await proxy.handle(origin + '/old', { base: BASE, fixtureView: false }, r);
  assert.strictEqual(r.out.status, 200, '重定向在服务端跟完，浏览器只看到 200');
  assert.ok(r.out.body.includes('最终页'));
});

test('非 HTML 资源原样透传', async (t) => {
  const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const { srv, origin } = await startUpstream((req, res) => {
    res.writeHead(200, { 'content-type': 'image/png', 'x-frame-options': 'DENY' });
    res.end(png);
  });
  t.after(() => srv.close());

  const r = collectRes();
  await proxy.handle(origin + '/a.png', { base: BASE, fixtureView: false }, r);
  assert.ok(Buffer.isBuffer(r.out.body), '二进制应保持 Buffer');
  assert.deepStrictEqual(r.out.body, png, '图片字节不应被改动');
});

test('上游 5xx 转成伪装提示，不泄露任何来源信息', async (t) => {
  const { srv, origin } = await startUpstream((req, res) => {
    res.writeHead(503, { 'content-type': 'text/html' });
    res.end('<html><body>Backend down at novelsite.example</body></html>');
  });
  t.after(() => srv.close());

  const r = collectRes();
  await proxy.handle(origin + '/x', { base: BASE, fixtureView: false }, r);
  assert.strictEqual(r.out.status, 200, '不能把 5xx 透出去，浏览器会显示自己的错误页');
  assert.ok(r.out.body.includes('Reference unavailable'));
  assert.ok(!r.out.body.includes('novelsite.example'), '不得泄露源站内容');
  assert.ok(!/127\.0\.0\.1:\d+/.test(r.out.body), '不得泄露上游地址');
});

test('连接失败也走伪装提示，不抛异常', async () => {
  const r = collectRes();
  // 指向一个必然拒绝连接的端口
  await proxy.handle('http://127.0.0.1:1/nope', { base: BASE, fixtureView: false }, r);
  assert.strictEqual(r.out.status, 200);
  assert.ok(r.out.body.includes('Reference unavailable'));
});

test('errorPage 不含任何 Node 堆栈或调试信息', () => {
  for (const reason of ['timeout', 'bad-url', 'upstream-error', 'weird-unknown']) {
    const page = proxy.errorPage(reason);
    assert.ok(!/at\s+\w+\s+\(/.test(page), '不得出现堆栈行');
    assert.ok(!/node:internal/.test(page));
    assert.ok(page.includes('<title>Reference unavailable</title>'));
  }
});

test('Cookie 罐按主机名隔离', () => {
  proxy.jar.clear();
  proxy.absorbCookies('a.example', ['sid=111; Path=/; HttpOnly', 'lang=zh']);
  proxy.absorbCookies('b.example', ['sid=222']);
  assert.strictEqual(proxy.cookieHeaderFor('a.example'), 'sid=111; lang=zh');
  assert.strictEqual(proxy.cookieHeaderFor('b.example'), 'sid=222');
  assert.strictEqual(proxy.cookieHeaderFor('c.example'), null);
  proxy.jar.clear();
});

test('STRIP_HEADERS 覆盖所有会阻止框架渲染的头', () => {
  for (const h of ['x-frame-options', 'content-security-policy', 'cross-origin-opener-policy',
    'cross-origin-embedder-policy', 'cross-origin-resource-policy']) {
    assert.ok(proxy.STRIP_HEADERS.has(h), h + ' 必须在剥离列表内');
  }
});

test('decodeTarget 拒绝构造出的本地文件访问', () => {
  assert.strictEqual(rewrite.decodeTarget(rewrite.encodeTarget('file:///c:/windows/win.ini')), null);
});
