'use strict';

// HTML 重写。策略是混合式：
//   - <base href> 指向原始页面，让图片/CSS/JS 等子资源直接从源站加载，
//     省去重写 srcset、CSS url() 等一堆易错的边角情况。
//   - 只把 <a href> 和 <form action> 改写成指向本地代理的【绝对】地址。
//     必须是绝对地址：base 存在时，"/r/xxx" 这种根路径会被解析到源站域名上去。
// 不做重写的话，点一次「下一章」就跳出 iframe，伪装当场失效。

const SKIP_SCHEME = /^(javascript:|mailto:|tel:|data:|about:|blob:|#)/i;

function encodeTarget(url) {
  return Buffer.from(String(url), 'utf8').toString('base64url');
}

function decodeTarget(token) {
  let url;
  try {
    url = Buffer.from(String(token), 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

function absolutize(value, pageUrl) {
  if (!value || SKIP_SCHEME.test(value.trim())) return null;
  try {
    return new URL(value.trim(), pageUrl).href;
  } catch {
    return null;
  }
}

// query 用来让视图模式跟着导航一起传下去。
// 不带的话，在 fixture view 里点「下一章」会退回普通视图，
// 每翻一页都得重新点一次切换按钮。
function proxyHref(absUrl, base, query) {
  return base + '/r/' + encodeTarget(absUrl) + (query || '');
}

// 匹配带引号或不带引号的属性值。不带引号在真实站点里少见但确实存在。
function attrPattern(attr) {
  return new RegExp(
    '(\\s' + attr + '\\s*=\\s*)("([^"]*)"|\'([^\']*)\'|([^\\s"\'>]+))',
    'i'
  );
}

function replaceAttr(tag, attr, mapper) {
  const m = attrPattern(attr).exec(tag);
  if (!m) return tag;
  const raw = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]);
  const next = mapper(raw);
  if (next == null) return tag;
  const quoted = '"' + String(next).replace(/"/g, '&quot;') + '"';
  return tag.slice(0, m.index) + m[1] + quoted + tag.slice(m.index + m[0].length);
}

function stripAttr(tag, attr) {
  return tag.replace(attrPattern(attr), '');
}

function rewriteLinks(html, pageUrl, base, query) {
  return html.replace(/<(a|form)\b[^>]*>/gi, (tag, name) => {
    const attr = name.toLowerCase() === 'a' ? 'href' : 'action';
    let out = replaceAttr(tag, attr, (raw) => {
      const abs = absolutize(raw, pageUrl);
      return abs ? proxyHref(abs, base, query) : null;
    });
    // target="_blank" 会把小说站开进新标签页，那是最糟的暴露方式。
    out = stripAttr(out, 'target');
    return out;
  });
}

// 页面内嵌的 CSP meta 同样能阻止框架内加载，响应头剥干净了这里也得清。
function stripSecurityMeta(html) {
  return html.replace(
    /<meta[^>]+http-equiv\s*=\s*["']?(content-security-policy|x-frame-options)["']?[^>]*>/gi,
    ''
  );
}

function stripExistingBase(html) {
  return html.replace(/<base\b[^>]*>/gi, '');
}

function injectHead(html, snippet) {
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (m) => m + snippet);
  }
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b[^>]*>/i, (m) => m + '<head>' + snippet + '</head>');
  }
  return snippet + html;
}

// 注入到被代理页面内部的守卫脚本。
// 关键点：iframe 内部按下的键不会冒泡到父页面，所以老板键必须在这里也监听一份，
// 否则焦点一旦落在小说正文上，老板键就失灵了——而那恰恰是最需要它的时候。
const GUARD_BODY = `
var post = function (type, payload) {
  try {
    var msg = { __aside: 1, type: type };
    if (payload) for (var k in payload) msg[k] = payload[k];
    parent.postMessage(msg, '*');
  } catch (e) {}
};
// iframe 在小窗内部，这里的右键按定义就是「指针在小窗内」，不触发隐藏。
// 也不屏蔽菜单：复制、在新标签页打开、返回上一页都要靠原生右键菜单，
// 堵掉就等于把源站的一半功能砍了。这里什么都不做，交给浏览器原生行为。
// 指针进出内部框架要回报，否则父页面看不到 iframe 内的鼠标，
// 会误以为指针已经离开小窗。
document.addEventListener('mouseenter', function () { post('pointer', { inside: true }); });
document.addEventListener('mouseleave', function () { post('pointer', { inside: false }); });
window.addEventListener('mouseover', function () { post('pointer', { inside: true }); }, { once: true });
// 挂机判定需要知道 iframe 内有没有输入活动——事件不冒泡出框架，
// 这里节流上报一份心跳。只报「有活动」这个事实，不带任何内容。
var lastAct = 0;
function act() {
  var now = Date.now();
  if (now - lastAct > 4000) { lastAct = now; post('activity'); }
}
var actEvents = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'];
for (var i = 0; i < actEvents.length; i++) {
  document.addEventListener(actEvents[i], act, true);
}
// 键盘农场取用：iframe 里小说站的按键/点击也算进游戏。事件不冒泡出框架，
// 所以在这里各上报一份——但只报「发生了一次按键/点击」这个事实，
// 绝不带按键内容或坐标：报的是次数不是内容，源站里输入的任何字符都不会离开这个框架。
// 父页面的农场据此推进（见 farm.js 的 external 分支）；读小说大多是点击翻页，偶尔按键。
document.addEventListener('keydown', function (e) {
  if (e.repeat) return;              // 长按自动重复不重复计
  post('farm', { kind: 'key' });
}, true);
document.addEventListener('click', function () { post('farm', { kind: 'click' }); }, true);
// 这里只上报「标签页真的被切走」。
// 曾经还上报过 mouseleave 和 blur，两者都是误报源：
//   mouseleave —— 鼠标从小窗移到页面别处就触发，可用户根本没走；
//   blur       —— 点一下小窗外的任何地方就触发，同样不代表用户离开。
// 父页面自己监听 blur 已经足够，且那边会用 document.hasFocus() 排除焦点在自家框架内的情况。
document.addEventListener('visibilitychange', function () {
  if (document.hidden) post('conceal', { reason: 'hidden' });
});
// 新窗口一律拉回当前框架内
window.open = function (url) { if (url) location.href = url; return window; };
document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest ? e.target.closest('a[target]') : null;
  if (a) a.removeAttribute('target');
}, true);
// 这里不上报当前地址。iframe 的真实地址是代理地址（/r/<token>），报上去没用；
// 而把源站地址注入进来又会让小说站域名出现在页面源码里，违反「任何位置都不得
// 出现源站域名」。父页面自己解码 iframe 路径里的 token 就能拿到源站地址，
// 不需要页面告诉它。
`;

// 隐藏滚动条但保留滚动能力。小窗本来就窄，几条滚动条叠在一起既占地方又扎眼。
// 三个属性分别对付 Firefox、旧 Edge/IE 和 WebKit 系。
const SCROLLBAR_CSS = '<style>'
  + 'html,body,*{scrollbar-width:none!important;-ms-overflow-style:none!important;}'
  + '*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important;}'
  + '</style>';

function guardScript() {
  return '<script>(function(){' + GUARD_BODY + '})();<' + '/script>';
}

function rewriteHtml(html, options) {
  const { pageUrl, base, extraHead = '', linkQuery = '' } = options;
  let out = stripSecurityMeta(stripExistingBase(html));
  out = rewriteLinks(out, pageUrl, base, linkQuery);
  const head = '<base href="' + pageUrl.replace(/"/g, '&quot;') + '">'
    + guardScript()
    + SCROLLBAR_CSS
    + extraHead;
  return injectHead(out, head);
}

module.exports = {
  encodeTarget, decodeTarget, absolutize, proxyHref,
  replaceAttr, stripAttr, rewriteLinks, stripSecurityMeta,
  stripExistingBase, injectHead, guardScript, rewriteHtml,
};
