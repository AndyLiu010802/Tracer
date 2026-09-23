'use strict';

const http = require('node:http');
const https = require('node:https');
const zlib = require('node:zlib');
const { URL } = require('node:url');

const encoding = require('./encoding.js');
const rewrite = require('./rewrite.js');
const render = require('./render.js');

const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 12 * 1024 * 1024;

// 伪装成普通桌面 Chrome。不少小说站对陌生 UA 直接返回空页或验证页。
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// 这些响应头会让浏览器拒绝在框架内渲染，或干扰注入的守卫脚本。
//
// CSP 是整条删除而不是只删 frame-ancestors：注入的守卫脚本是内联的，
// 源站只要带 script-src 就会把它拦下，导致焦点落在小说正文时老板键失灵——
// 那恰恰是最需要老板键的时刻。页面是在本机框架内渲染的，源站 CSP 在此保护不了任何东西。
const STRIP_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'set-cookie',
  'strict-transport-security',
  'report-to',
  'nel',
]);

// 按主机名存的内存 Cookie 罐。只在内存里，进程退出即消失，磁盘不留痕。
// 有意简化：忽略 path / domain / expires，对小说站的会话维持足够用。
const jar = new Map();

function cookieHeaderFor(hostname) {
  const bag = jar.get(hostname);
  if (!bag || bag.size === 0) return null;
  return [...bag].map(([k, v]) => k + '=' + v).join('; ');
}

function absorbCookies(hostname, setCookie) {
  if (!setCookie) return;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  let bag = jar.get(hostname);
  if (!bag) {
    bag = new Map();
    jar.set(hostname, bag);
  }
  for (const line of list) {
    const pair = String(line).split(';')[0];
    const idx = pair.indexOf('=');
    if (idx > 0) bag.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

function decompress(buf, contentEncoding) {
  const enc = String(contentEncoding || '').toLowerCase();
  try {
    if (enc.includes('br')) return zlib.brotliDecompressSync(buf);
    if (enc.includes('gzip')) return zlib.gunzipSync(buf);
    if (enc.includes('deflate')) return zlib.inflateSync(buf);
  } catch {
    // 声明与实际不符的站点存在，解压失败就按原始字节处理，
    // 交给下游的编码探测去碰运气，总好过整个请求失败。
    return buf;
  }
  return buf;
}

function requestOnce(targetUrl) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(targetUrl);
    } catch {
      reject(new Error('bad-url'));
      return;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      reject(new Error('bad-scheme'));
      return;
    }

    const mod = u.protocol === 'https:' ? https : http;
    const headers = {
      'user-agent': UA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'accept-encoding': 'gzip, deflate, br',
      'referer': u.origin + '/',
    };
    const cookie = cookieHeaderFor(u.hostname);
    if (cookie) headers.cookie = cookie;

    const req = mod.request(u, { method: 'GET', headers }, (res) => {
      absorbCookies(u.hostname, res.headers['set-cookie']);
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > MAX_BYTES) {
          req.destroy();
          reject(new Error('too-large'));
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
          finalUrl: u.href,
        });
      });
      res.on('error', reject);
    });

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchUpstream(targetUrl) {
  let url = targetUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await requestOnce(url);
    const loc = res.headers.location;
    if (res.status >= 300 && res.status < 400 && loc) {
      // 重定向在服务端跟完，浏览器不必知道跳了几次，
      // 也就不会在地址栏或历史里留下源站痕迹。
      url = new URL(loc, url).href;
      continue;
    }
    return { ...res, finalUrl: url };
  }
  throw new Error('too-many-redirects');
}

function isHtml(contentType) {
  return /text\/html|application\/xhtml/i.test(String(contentType || ''));
}

function passthroughHeaders(src) {
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (!STRIP_HEADERS.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

// 出错时给出一条符合文档站语气的英文提示。
// 绝不能露出浏览器默认错误页、空白框架、目标域名或 Node 堆栈。
function errorPage(reason) {
  const notes = {
    'timeout': 'The upstream reference did not respond within the expected window.',
    'bad-url': 'The reference identifier could not be resolved.',
    'bad-scheme': 'Unsupported reference protocol.',
    'too-large': 'The referenced resource exceeds the inline preview limit.',
    'too-many-redirects': 'The reference chain exceeded the maximum resolution depth.',
    'upstream-error': 'The upstream service returned an unexpected status.',
  };
  const detail = notes[reason] || 'The referenced resource is currently unavailable.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Reference unavailable</title>
<style>
  /* 固定深色，与 fixture view 保持一致，切换时不会闪白 */
  :root { color-scheme: dark; }
  html,body,* { scrollbar-width:none; -ms-overflow-style:none; }
  *::-webkit-scrollbar { width:0; height:0; display:none; }
  body { margin:0; padding:28px 24px; font:13px/1.65 ui-sans-serif,-apple-system,"Segoe UI",sans-serif;
         color:#aab3c0; background:#15181d; }
  .code { font:11px/1.5 ui-monospace,"Cascadia Mono",Consolas,monospace; color:#6b7482;
          letter-spacing:.04em; text-transform:uppercase; margin-bottom:10px; }
  h1 { font-size:15px; font-weight:600; margin:0 0 8px; color:#e6eaf0; }
  p { margin:0 0 14px; max-width:46ch; }
  a { color:#7aa7f0; text-decoration:none; font-weight:500; }
  a:hover { text-decoration:underline; }
</style></head>
<body>
  <div class="code">参考阅读 · Reference reader</div>
  <h1>网页暂时无法加载</h1>
  <p>目标网页未能加载，可能暂时不可用或不允许内嵌读取。可重试、在浏览器中打开原网址，或收起右侧阅读面板。</p>
  <p>Reference unavailable. ${detail}</p>
  <p><a href="javascript:location.reload()">重试 / Retry</a></p>
</body></html>`;
}

/**
 * 处理一次 /r/<token> 代理请求。
 * 任何异常都转成伪装后的响应，绝不向外抛。
 */
async function handle(targetUrl, { base, fixtureView, dimView }, res) {
  let up;
  try {
    up = await fetchUpstream(targetUrl);
  } catch (err) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(errorPage(err && err.message));
    return;
  }

  if (up.status >= 400) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(errorPage('upstream-error'));
    return;
  }

  const raw = decompress(up.body, up.headers['content-encoding']);
  const headers = passthroughHeaders(up.headers);

  if (!isHtml(up.headers['content-type'])) {
    // 图片、样式、脚本等原样透传，只是去掉了框架限制类响应头。
    res.writeHead(200, headers);
    res.end(raw);
    return;
  }

  const { text } = encoding.decode(raw, up.headers['content-type']);
  let html;
  try {
    html = fixtureView
      ? render.toFixture(text, { pageUrl: up.finalUrl, base, dim: dimView })
      : rewrite.rewriteHtml(text, { pageUrl: up.finalUrl, base });
  } catch {
    html = errorPage('upstream-error');
  }

  headers['content-type'] = 'text/html; charset=utf-8';
  res.writeHead(200, headers);
  res.end(html);
}

module.exports = {
  fetchUpstream, requestOnce, decompress, isHtml,
  passthroughHeaders, errorPage, handle,
  STRIP_HEADERS, cookieHeaderFor, absorbCookies, jar,
};
