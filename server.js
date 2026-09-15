'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');

const rewrite = require('./lib/rewrite.js');
const proxy = require('./lib/proxy.js');
const store = require('./lib/store.js');

const ROOT = __dirname;
const serveMusic = require('./lib/music').createMusic(process.env.DOCS_PORTAL_MUSIC_DIR || path.join(ROOT, 'music'));
// autoHide 取值：
//   'off'        不自动隐藏，只留老板键
//   'blur'       仅在整个浏览器窗口/标签页失去焦点时隐藏（默认）
//   'aggressive' 额外在鼠标移出视口时隐藏（误报多，见 public/conceal-policy.js）
// idleMinutes：连续多少分钟没有任何鼠标/键盘输入就收起小窗，0 关闭。
//   失焦类信号都建立在「用户切走了」上；人直接离开工位时什么都不会触发，
//   这是唯一覆盖那个场景的判据。
const DEFAULTS = {
  port: 8080, skin: 'tracer', host: '127.0.0.1',
  autoHide: 'blur', idleMinutes: 5,
};

const PANEL_ASSETS = new Set(['/reader.js', '/reader.css', '/conceal-policy.js']);

// root/env 可注入，默认取真实的 ROOT 目录和真实的 process.env——生产路径不变，
// 测试则可以把 root 指到一个空临时目录、env 传 {}，走真实的合并逻辑断言
// DEFAULTS/优先级，而不必受这台机器上 local.config.json 实际配的是哪套皮肤摆布。
function loadConfig(root = ROOT, env = process.env) {
  let fromFile;
  try {
    fromFile = JSON.parse(fs.readFileSync(path.join(root, 'local.config.json'), 'utf8'));
  } catch {
    fromFile = {};
  }
  // 环境变量优先级最高。验证脚本靠它换端口，才不会和正在使用的实例撞车；
  // 测试靠 SKIN 固定皮肤，否则断言会被 local.config.json 里配的皮肤左右。
  const fromEnv = {};
  if (env.DOCS_PORTAL_PORT) fromEnv.port = Number(env.DOCS_PORTAL_PORT);
  if (env.DOCS_PORTAL_HOST) fromEnv.host = env.DOCS_PORTAL_HOST;
  if (env.DOCS_PORTAL_SKIN) fromEnv.skin = env.DOCS_PORTAL_SKIN;
  return { ...DEFAULTS, ...fromFile, ...fromEnv };
}

const config = loadConfig();
const SKIN_DIR = path.join(ROOT, 'skins', config.skin);
const PUBLIC_DIR = path.join(ROOT, 'public');
// 阅读进度/书签落盘位置。打包后安装目录（app.asar 所在的 Program Files 下）
// 运行时只读，桌面版要把它指到 app.getPath('userData') 之类的可写目录；
// DOCS_PORTAL_STATE_FILE 就是那个覆盖点，写法与上面 DATA_DIR 保持一致。
// 顺带修掉一个既有的测试污染问题：以前没有覆盖点时，跑测试会直接写仓库根
// 的真实 bookmarks.json（gitignored 但是真实文件），多个测试文件并发改写
// 它会相互干扰；现在测试可以各自把它指到独立的临时文件，互不影响。
const STATE_FILE = process.env.DOCS_PORTAL_STATE_FILE || path.join(ROOT, 'bookmarks.json');

// 游戏引擎（键盘农场+钓鱼+战斗+装备）物理住在 db-console 皮肤目录，
// 但作为「共享一份源」同时供 tracer 的 Garden 分区加载——当前皮肤目录里
// 没有的游戏文件，从这里兜底服务。这样两个皮肤跑的是同一份 farm.js，
// 农场那边的迭代 tracer 自动拿到，无需复制。GAME_DIR 可用环境变量覆盖，
// 将来把游戏搬到中立目录时只改这一行。
const GAME_DIR = process.env.DOCS_PORTAL_GAME_DIR || path.join(ROOT, 'skins', 'db-console');
// 白名单必须跟着农场的美术走：farm.js 新加一个美术目录（如 mobs/、mats/、equip/）
// 或一张顶层立绘（hero/arena），就得同步加进下面两处，否则该资源在 tracer 的 Garden
// 里一律 404——而 farm.js 的 onerror 把破图静默换成 emoji，界面上看不出是服务端没给。
const GAME_FILES = new Set([
  '/farm.js', '/fishing.js', '/combat.js', '/equip.js', '/mining.js', '/magic.js', '/farm-data.js', '/farm.css',
  '/hero.webp', '/arena.webp',
]);
const GAME_DIRS = ['/fish/', '/scenes/', '/mobs/', '/mats/', '/equip/'];
function isGameAsset(pathname) {
  return GAME_FILES.has(pathname) || GAME_DIRS.some((d) => pathname.indexOf(d) === 0);
}

// 皮肤无关的通用 JSON 存储。皮肤用它放自己的持久数据（如 tracer 的 workspace），
// 引擎不关心内容结构。名字白名单挡住路径注入；测试用 DATA_DIR 环境变量改落点。
// 实际的读写（写队列、原子替换、.bak 回退）在 lib/store.js 里，方便脱离 HTTP 单测。
const DATA_DIR = process.env.DOCS_PORTAL_DATA_DIR || path.join(ROOT, 'data');
const cloudSync = require('./lib/cloud-sync').createBridge(DATA_DIR);
const aiGateway = require('./lib/ai-gateway').createGateway(DATA_DIR);
const STORE_NAME_RE = /^[a-z][a-z0-9-]{0,31}$/;
// 只读存储开关：置 1 时 /api/store/* 和 /api/state 的写操作一律拒写（读不受影响）。
// 给探针、审查脚本、自动化冒烟用——它们该设 DOCS_PORTAL_DATA_DIR 指向临时目录，
// 但那是「记得设」才生效的纪律；这个开关是「忘了设也写不坏」的兜底。演示数据被
// 这么写坏过一次，代价是 5 个任务 / 2 条笔记 / 2 个收集项（.bak 只留一代，同样是
// 污染后的状态，救不回来）。/api/state 落的 STATE_FILE 在 ROOT 下、不受
// DOCS_PORTAL_DATA_DIR 管，这个开关是它唯一的写保护，因此两个端点都要接进来，
// 兜底的承诺才是真的。
const READONLY_STORE = process.env.DOCS_PORTAL_READONLY_STORE === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

// 路径穿越防护：解析后必须仍在允许目录内。
function safeJoin(dir, rel) {
  const target = path.resolve(dir, '.' + path.posix.normalize('/' + rel));
  if (target !== dir && !target.startsWith(dir + path.sep)) return null;
  return target;
}

// 图片/字体等二进制资源可缓存，否则农场每秒重绘会把整屏鱼类立绘反复重拉。
// HTML/CSS/JS 仍走 no-store，保证改动即时可见。
const CACHEABLE_EXT = new Set(['.webp', '.png', '.jpg', '.svg', '.woff2']);

async function serveFile(res, filePath, fallbackType) {
  try {
    const buf = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || fallbackType || 'application/octet-stream';
    const cache = CACHEABLE_EXT.has(ext) ? 'public, max-age=86400' : 'no-store';
    res.writeHead(200, { 'content-type': type, 'cache-control': cache });
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}

// 把小窗组件注入皮肤页面。皮肤本身不知道小窗的存在，
// 二者唯一的约定是皮肤提供 #aside-slot 挂载点和一组 CSS 变量。
function injectReader(html, cfg) {
  // 策略模块必须排在 reader 之前。defer 脚本按文档顺序执行，所以这样就够了。
  const tags = '\n<link rel="stylesheet" href="/reader.css">\n'
    + '<script>window.__ASIDE_CONFIG__ = ' + JSON.stringify(cfg) + ';</script>\n'
    + '<script src="/conceal-policy.js" defer></script>\n'
    + '<script src="/reader.js" defer></script>\n';
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, tags + '</body>');
  return html + tags;
}

async function readState() {
  try {
    return JSON.parse(await fsp.readFile(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function writeState(next) {
  await fsp.writeFile(STATE_FILE, JSON.stringify(next, null, 2), 'utf8');
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (c) => {
      if (tooLarge) return; // 已经决定丢弃，剩下的数据只管排干，不再攒进 chunks
      size += c.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0; // 超限的数据不需要保留
        req.resume(); // 把剩余的请求体排干，不然客户端可能卡在写这一端
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      // 不主动 destroy 连接：destroy 会让客户端只看到连接被重置，
      // 而不是一个能读出状态码的正常响应。排干数据后正常 reject，
      // 由调用方决定回什么状态码（超限该回 413，不是笼统的连接错误）。
      if (tooLarge) {
        const err = new Error('too-large');
        err.code = 'too-large';
        reject(err);
        return;
      }
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

async function handleRequest(req, res) {
  const base = 'http://' + config.host + ':' + config.port;
  let url;
  try {
    url = new URL(req.url, base);
  } catch {
    res.writeHead(400).end();
    return;
  }
  let pathname = decodeURIComponent(url.pathname);
  // decode 之后可能重新冒出 ../ 或 Windows 反斜杠——前缀白名单/路由必须看规范化后的
  // 形态，否则 /fish/..%2fcontent.js、/fish/..%5ccontent.js 会绕过游戏白名单从 GAME_DIR
  // 掏 db-console 的伪装文件（content.js 含真实项目名）。先把 \ 归一成 /，再 posix 规范化。
  pathname = path.posix.normalize(pathname.replace(/\\/g, '/'));
  if (pathname[0] !== '/') pathname = '/' + pathname;
  const loopbackHost = /^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(req.headers.host || '');

  if (pathname.startsWith('/api/ai/')) {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (!loopbackHost || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || req.headers['x-tracer-ai'] !== '1' || (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)) { send(403, { error: 'forbidden' }); return; }
    const action = pathname.slice('/api/ai/'.length);
    try {
      if (['status', 'personal-status', 'codex-status'].includes(action) && req.method === 'GET') { send(200, await aiGateway.handle(action)); return; }
      if (READONLY_STORE || req.method !== 'POST' || !String(req.headers['content-type']).startsWith('application/json')) { send(403, { error: 'forbidden' }); return; }
      const data = JSON.parse(await readBody(req, action === 'extract' ? 14500000 : 900000));
      send(200, action === 'extract' ? await require('./lib/ai-extract').extract(data) : await aiGateway.handle(action, data));
    } catch (e) { send(400, { error: /^[a-z-]{3,50}$/.test(e.message) ? e.message : 'request-failed' }); }
    return;
  }

  if (pathname === '/api/music' || pathname.startsWith('/api/music/')) {
    if (!loopbackHost || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) { res.writeHead(403).end(); return; }
    await serveMusic(req, res, pathname); return;
  }

  // Desktop-to-cloud bridge. Device tokens stay on disk and never enter browser storage.
  if (pathname.startsWith('/api/sync/')) {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    const remote = req.socket.remoteAddress;
    if (!loopbackHost || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) { send(403, { ok: false }); return; }
    try {
      if (pathname === '/api/sync/status' && req.method === 'GET') { send(200, await cloudSync.status()); return; }
      if (READONLY_STORE || req.method !== 'POST' || req.headers['x-tracer-sync'] !== '1' || !String(req.headers['content-type']).startsWith('application/json')) { send(403, { ok: false }); return; }
      if (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) { send(403, { ok: false }); return; }
      let result;
      if (pathname === '/api/sync/pair') {
        const input = JSON.parse(await readBody(req, 8192));
        result = await cloudSync.pair(input.endpoint, input.code);
      } else if (pathname === '/api/sync/disconnect') result = await cloudSync.disconnect();
      else { send(404, { ok: false }); return; }
      send(result.status || 200, result);
    } catch { send(503, { ok: false, error: '连接失败，请检查云函数地址、网络与配对码后重试' }); }
    return;
  }

  // 代理端点
  if (pathname.startsWith('/r/')) {
    const target = rewrite.decodeTarget(pathname.slice(3));
    if (!target) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(proxy.errorPage('bad-url'));
      return;
    }
    await proxy.handle(target, {
      base,
      fixtureView: url.searchParams.get('fx') === '1',
      dimView: url.searchParams.get('dim') === '1',
    }, res);
    return;
  }

  // 阅读进度 / 书签
  if (pathname === '/api/state') {
    if (req.method === 'POST') {
      // 与 /api/store 同语义：只读开关下一律拒写，回 403 而不是静默假装成功。
      // STATE_FILE 在 ROOT 下、不受 DOCS_PORTAL_DATA_DIR 管，这条守卫是它唯一的写保护。
      if (READONLY_STORE) {
        res.writeHead(403, { 'content-type': 'application/json' })
          .end('{"ok":false,"readonly":true}');
        return;
      }
      try {
        await writeState(JSON.parse(await readBody(req)));
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
      } catch (err) {
        // readBody 超限时不再 destroy 连接、而是正常 reject 一个 too-large 错误，
        // 跟 /api/store 保持同样的语义：超限回 413，其余（非法 JSON 等）回 400。
        const status = err.code === 'too-large' ? 413 : 400;
        res.writeHead(status, { 'content-type': 'application/json' }).end('{"ok":false}');
      }
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(await readState()));
    return;
  }

  // 皮肤持久数据
  if (pathname.startsWith('/api/store/')) {
    const name = pathname.slice('/api/store/'.length);
    if (!STORE_NAME_RE.test(name)) {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"ok":false}');
      return;
    }
    if (name === 'workspace' && await cloudSync.connected()) {
      const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
      if (!loopbackHost) { res.writeHead(403, headers).end('{"ok":false}'); return; }
      if (!['GET', 'HEAD', 'PUT', 'POST'].includes(req.method)) { res.writeHead(405, headers).end('{"ok":false}'); return; }
      const writing = req.method === 'PUT' || req.method === 'POST';
      if (writing && (READONLY_STORE || req.headers['x-tracer-sync'] !== '1' ||
          (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host))) { res.writeHead(403, headers).end('{"ok":false}'); return; }
      try {
        const input = writing ? JSON.parse(await readBody(req, 600 * 1024)) : null;
        const result = await cloudSync.workspace(req.method, input);
        if (!result) { res.writeHead(409, headers).end('{"ok":false,"error":"同步连接已变化，请刷新页面"}'); return; }
        res.writeHead(result.status || 200, headers).end(JSON.stringify(!writing && result.ok ? result.workspace : result));
      } catch (err) {
        res.writeHead(err.code === 'too-large' ? 413 : 503, headers).end('{"ok":false,"error":"云端暂时不可用，改动尚未同步"}');
      }
      return;
    }
    // sendBeacon 只能发 POST，所以 POST 与 PUT 同义
    if (req.method === 'PUT' || req.method === 'POST') {
      // 拒写要赶在读 body、更赶在落盘之前。回 403 而不是静默假装成功——
      // 静默会让「探针以为写进去了」这种事更难查。
      if (READONLY_STORE) {
        res.writeHead(403, { 'content-type': 'application/json' })
          .end('{"ok":false,"readonly":true}');
        return;
      }
      let body;
      try {
        body = await readBody(req, 4 * 1024 * 1024);
      } catch (err) {
        const status = err.code === 'too-large' ? 413 : 400;
        res.writeHead(status, { 'content-type': 'application/json' }).end('{"ok":false}');
        return;
      }
      try {
        JSON.parse(body); // 只验证是合法 JSON，结构由皮肤自理
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' }).end('{"ok":false}');
        return;
      }
      try {
        await store.writeStore(DATA_DIR, name, body, name === 'workspace' ? (previous, next) => {
          const history = require('./public/task-history');
          if (next && next.completionHistory !== undefined) next.completionHistory = history.validate(next.completionHistory);
          return history.preserve(previous, next);
        } : undefined);
      } catch (err) {
        // 落盘失败（磁盘满、权限等）不是客户端的错，打日志方便排查，回 500。
        process.stderr.write('[store] 写入 ' + name + ' 失败：' + err.message + '\n');
        res.writeHead(500, { 'content-type': 'application/json' }).end('{"ok":false}');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      // HEAD 走同一个分支：Node 会自动省略 body，不用额外处理。
      let data;
      try {
        data = await store.readStore(DATA_DIR, name);
      } catch (err) {
        if (err.code === 'store-corrupt') {
          // 坏档不能装成 200+null 的空工作区——客户端会以为从没写过，
          // 下次保存直接覆盖掉这些可能还救得回来的字节。用 409 让客户端锁死保存、亮灯等人处理。
          res.writeHead(409, { 'content-type': 'application/json' }).end('{"ok":false,"corrupt":true}');
          return;
        }
        throw err;
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(data === null ? 'null' : JSON.stringify(data));
      return;
    }
    res.writeHead(405, { 'content-type': 'application/json', allow: 'GET, HEAD, PUT, POST' }).end('{"ok":false}');
    return;
  }

  // 小窗组件
  if (PANEL_ASSETS.has(pathname) || ['/workspace-sync.js', '/ai-planner.js', '/tracer-logo.png'].includes(pathname)) {
    const f = safeJoin(PUBLIC_DIR, pathname);
    if (f && await serveFile(res, f)) return;
  }

  // 皮肤首页
  if (pathname === '/' || pathname === '/index.html') {
    try {
      const html = await fsp.readFile(path.join(SKIN_DIR, 'index.html'), 'utf8');
      const body = injectReader(html, {
        base, skin: config.skin,
        autoHide: config.autoHide, idleMinutes: config.idleMinutes,
      });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
      res.end(proxy.errorPage('upstream-error'));
    }
    return;
  }

  // 皮肤静态资源
  const skinFile = safeJoin(SKIN_DIR, pathname);
  if (skinFile && await serveFile(res, skinFile)) return;

  // 游戏资源兜底：当前皮肤没有、但属于游戏白名单的文件，从 GAME_DIR 服务。
  // 白名单挡住「tracer 意外拿到 db-console 伪装内容」；编码穿越（..%2f/..%5c）由
  // 入口处的 pathname 规范化挡住（见上），safeJoin 再把结果夹在 GAME_DIR 内。
  if (isGameAsset(pathname)) {
    const gameFile = safeJoin(GAME_DIR, pathname);
    if (gameFile && await serveFile(res, gameFile)) return;
  }

  // 404 也要保持文档站的样子，不能露出 Node 默认响应。
  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
  res.end(proxy.errorPage('bad-url'));
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(proxy.errorPage('upstream-error'));
  });
});

if (require.main === module) {
  // 只绑定回环地址，局域网内其他机器访问不到。
  server.listen(config.port, config.host, () => {
    process.stdout.write('Docs portal running at http://' + config.host + ':' + config.port + '/\n');
  });
}

server.on('close', () => require('./lib/ai-gateway').closeCodex());
module.exports = { server, handleRequest, config, injectReader, safeJoin, loadConfig };
