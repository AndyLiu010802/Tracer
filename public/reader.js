(function () {
  'use strict';

  var CFG = window.__ASIDE_CONFIG__ || { base: location.origin };
  var nativeBrowser = window.TracerBrowser;
  var KEY = 'docsportal.aside.v1';
  // 延迟判定而非立即隐藏：blur 刚触发的一瞬间焦点可能正在移入自家 iframe，
  // 此时读 document.hasFocus() 会读到中间态。等一下再判，顺便让快速切回来的情况自动取消。
  var CONCEAL_DELAY = 250;
  var autoHide = ConcealPolicy.normalizeMode(CFG.autoHide);

  // 挂机判定：失焦/切页签都建立在「用户切走了」上，人直接离开工位时
  // 什么都不会触发。超过 idleMinutes 没有任何鼠标/键盘输入就收起，0 关闭。
  var IDLE_CHECK_MS = 30000;
  var idleMs = Math.max(0, Number(CFG.idleMinutes) || 0) * 60000;
  var lastActivity = Date.now();
  if (nativeBrowser) { autoHide = 'off'; idleMs = 0; }

  var state = {
    url: '',
    mode: 'dock',      // dock | float
    hidden: false,
    fx: false,         // fixture view
    dim: false,        // fixture view 的低对比模式：悬停的行才可读
    float: { x: 0, y: 0, w: 460, h: 620 },
  };

  var el = {};
  var concealTimer = null;
  var saveTimer = null;

  // 指针是否在小窗内。iframe 会吞掉内部的鼠标事件，父页面看不到，
  // 所以外框由本页追踪，内部由注入 iframe 的守卫脚本回报，两者取并集。
  var pointerOnPanel = false;
  var pointerInFrame = false;

  function pointerInside() {
    return pointerOnPanel || pointerInFrame;
  }

  // ---------- 持久化 ----------

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        for (var k in saved) if (k in state) state[k] = saved[k];
      }
    } catch (e) {}
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      // 服务端副本，localStorage 被清也不至于丢进度
      try {
        fetch('/api/state', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(state),
        }).catch(function () {});
      } catch (e) {}
    }, 1200);
  }

  // ---------- 代理地址 ----------

  function toProxy(rawUrl) {
    var u = String(rawUrl || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    var token;
    try {
      token = btoa(unescape(encodeURIComponent(u)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) {
      return '';
    }
    var q = [];
    if (state.fx) {
      q.push('fx=1');
      // dim 只在 fixture view 里有意义：普通视图是源站自己的排版，压不了对比度。
      if (state.dim) q.push('dim=1');
    }
    return '/r/' + token + (q.length ? '?' + q.join('&') : '');
  }

  // 从 iframe 当前路径反解出源站地址。
  // iframe 的真实地址是 /r/<token>，直接拿它当阅读进度存下来会被再编码一层，
  // 地址栏也会显示 localhost 的那串 token。代理页与本页同源，所以这边读得到路径；
  // token 自己解就行，不必让页面把源站地址报上来——那样会把小说站域名写进页面源码。
  function decodeProxyPath(pathname) {
    var m = /^\/r\/([A-Za-z0-9_-]+)/.exec(pathname || '');
    if (!m) return '';
    var b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    try {
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      return '';
    }
  }

  // ---------- 视图 ----------

  function build() {
    var slot = document.getElementById('aside-slot');
    if (!slot) return false;

    var panel = document.createElement('aside');
    panel.className = 'fx-panel';
    panel.setAttribute('data-mode', state.mode);
    panel.innerHTML = [
      '<div class="fx-head">',
      '  <span class="fx-tag">zh-CN</span>',
      '  <span class="fx-title">Localization fixtures</span>',
      '  <button class="fx-icon" data-act="fx" title="Fixture view">&#9776;</button>',
      '  <button class="fx-icon" data-act="dim" title="Glance mode (rows readable on hover)">&#9680;</button>',
      '  <button class="fx-icon" data-act="pop" title="Detach">&#10530;</button>',
      '  <button class="fx-icon" data-act="hide" title="Collapse (right-click outside)">&#8210;</button>',
      '</div>',
      '<div class="fx-bar">',
      '  <button class="fx-nav" data-act="back" title="Back">&#8249;</button>',
      '  <button class="fx-nav" data-act="fwd" title="Forward">&#8250;</button>',
      '  <button class="fx-nav" data-act="reload" title="Reload">&#8635;</button>',
      '  <input class="fx-src" type="text" spellcheck="false" autocomplete="off"',
      '         placeholder="fixture source" aria-label="fixture source">',
      '  <button class="fx-go" data-act="go">Load</button>',
      '</div>',
      '<div class="fx-body"><iframe class="fx-frame" title="fixture preview"',
      '  referrerpolicy="no-referrer"></iframe></div>',
      '<div class="fx-foot"><span class="fx-meta">set zh-CN &middot; utf-8</span>',
      '  <span class="fx-hint">rmb to hide</span></div>',
    ].join('\n');

    slot.appendChild(panel);

    // 可选的皮肤级文案：皮肤可在挂载点上用 data-panel-* 覆盖小窗的标签文字，
    // 让同一块面板在不同伪装语境里都读得通——文档站叫 Localization fixtures，
    // 数据库控制台叫 Collation samples。用 textContent 赋值，写什么都不会被解析成 HTML。
    var panelTag = slot.getAttribute('data-panel-tag');
    var panelTitle = slot.getAttribute('data-panel-title');
    var panelMeta = slot.getAttribute('data-panel-meta');
    if (panelTag) panel.querySelector('.fx-tag').textContent = panelTag;
    if (panelTitle) panel.querySelector('.fx-title').textContent = panelTitle;
    if (panelMeta) panel.querySelector('.fx-meta').textContent = panelMeta;

    el.panel = panel;
    el.head = panel.querySelector('.fx-head');
    el.src = panel.querySelector('.fx-src');
    el.frame = panel.querySelector('.fx-frame');
    el.fxBtn = panel.querySelector('[data-act="fx"]');
    el.dimBtn = panel.querySelector('[data-act="dim"]');
    if (nativeBrowser) setupNativeBrowser();
    return true;
  }

  var layoutKey = '';
  function syncNativeLayout() {
    if (!nativeBrowser || !el.frame) return;
    var r = el.frame.parentElement.getBoundingClientRect();
    var modal = document.querySelector('[aria-modal="true"]');
    var visible = !state.hidden && r.width > 4 && r.height > 4 && !document.hidden
      && !(modal && modal.getClientRects().length) && !document.body.classList.contains('is-resizing');
    var data = { action: 'layout', visible: visible, bounds: { x: r.x, y: r.y, width: r.width, height: r.height } };
    var key = JSON.stringify(data);
    if (key !== layoutKey) { layoutKey = key; nativeBrowser.send(data); }
  }

  function setupNativeBrowser() {
    var zh = localStorage.getItem('tracer.language') !== 'en';
    el.panel.classList.add('fx-native');
    el.frame.hidden = true;
    el.fxBtn.hidden = true; el.dimBtn.hidden = true;
    el.panel.querySelector('.fx-tag').textContent = 'WEB';
    el.panel.querySelector('.fx-title').textContent = zh ? '内置浏览器' : 'Browser';
    el.src.placeholder = zh ? '输入网址' : 'Enter a website address';
    el.src.setAttribute('aria-label', el.src.placeholder);
    el.panel.querySelector('[data-act="go"]').textContent = zh ? '打开' : 'Go';
    el.panel.querySelector('.fx-hint').textContent = 'Chromium';
    var external = document.createElement('button');
    external.className = 'fx-icon'; external.dataset.act = 'external'; external.textContent = '↗';
    external.title = zh ? '用系统浏览器打开' : 'Open in system browser';
    el.head.insertBefore(external, el.head.querySelector('[data-act="hide"]'));
    var message = document.createElement('div'); message.className = 'fx-browser-message';
    message.innerHTML = '<strong></strong><p></p><button class="fx-go" data-act="reload">' + (zh ? '重试' : 'Retry') + '</button>';
    el.frame.parentElement.appendChild(message);
    message.querySelector('strong').textContent = zh ? '在这里浏览网页' : 'Browse alongside your work';
    message.querySelector('p').textContent = zh ? '输入网址，直接访问网站。' : 'Enter an address to open the website directly.';
    message.querySelector('button').hidden = true;
    var meta = el.panel.querySelector('.fx-meta');
    meta.textContent = zh ? '独立浏览器 · 登录状态自动保存' : 'Browser · persistent session';
    nativeBrowser.onState(function (data) {
      if (typeof data.visible === 'boolean') el.panel.dataset.browserVisible = String(data.visible);
      if (data.focusAddress) { el.src.focus(); el.src.select(); return; }
      if (data.url && data.url !== state.url) { state.url = data.url; el.src.value = data.url; save(); }
      if (typeof data.back === 'boolean') el.panel.querySelector('[data-act="back"]').disabled = !data.back;
      if (typeof data.forward === 'boolean') el.panel.querySelector('[data-act="fwd"]').disabled = !data.forward;
      if (data.error) {
        message.hidden = false;
        message.querySelector('strong').textContent = zh ? '暂时无法打开此网页' : 'This page could not load';
        message.querySelector('p').textContent = data.error;
        message.querySelector('button').hidden = false;
        meta.textContent = zh ? '可重试，或点击右上角 ↗ 使用系统浏览器' : 'Retry, or use ↗ to open your system browser';
      } else if (data.error === '') { message.hidden = true; }
      if (!data.error && !data.download) meta.textContent = data.loading ? (zh ? '正在加载…' : 'Loading…') : (zh ? '直接连接 · ' : 'Direct · ') + (data.title || 'Chromium');
      if (data.download) meta.textContent = data.download;
    });
    new ResizeObserver(syncNativeLayout).observe(el.frame.parentElement);
    new MutationObserver(syncNativeLayout).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
    window.addEventListener('resize', syncNativeLayout);
    document.addEventListener('scroll', syncNativeLayout, true);
    document.addEventListener('visibilitychange', syncNativeLayout);
    setInterval(syncNativeLayout, 250);
  }

  function applyMode() {
    el.panel.setAttribute('data-mode', state.mode);
    if (state.mode === 'float') {
      el.panel.style.left = state.float.x + 'px';
      el.panel.style.top = state.float.y + 'px';
      el.panel.style.width = state.float.w + 'px';
      el.panel.style.height = state.float.h + 'px';
    } else {
      el.panel.style.left = '';
      el.panel.style.top = '';
      el.panel.style.width = '';
      el.panel.style.height = '';
    }
  }

  function applyHidden() {
    // display:none 把小窗从布局里彻底拿掉，页面回落成纯文档。
    // iframe 文档本身不会因此卸载，所以恢复时阅读位置还在。
    el.panel.style.display = state.hidden ? 'none' : '';
    if (state.hidden) {
      // 元素被移出布局不会触发 mouseleave，指针状态会永远卡在 true，
      // 于是右键再也唤不回小窗。这里必须手动复位。
      pointerOnPanel = false;
      pointerInFrame = false;
    }
  }

  function applyFx() {
    el.fxBtn.classList.toggle('is-on', !!state.fx);
    el.dimBtn.classList.toggle('is-on', !!(state.fx && state.dim));
  }

  // ---------- 行为 ----------

  function navigate(rawUrl, remember) {
    if (nativeBrowser) {
      nativeBrowser.send({ action: 'navigate', url: String(rawUrl || '') });
      syncNativeLayout();
      return;
    }
    var target = toProxy(rawUrl);
    if (!target) return;
    el.frame.src = target;
    if (remember !== false) {
      state.url = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + String(rawUrl).trim();
      save();
    }
  }

  // 小窗内的前进/后退/刷新。
  // 代理页与本页同源，因此可以直接操作 iframe 的 history——
  // 这是小窗里唯一的导航退路，没有它点进一章就出不来了。
  function frameGo(delta) {
    if (nativeBrowser) { nativeBrowser.send({ action: delta < 0 ? 'back' : 'forward' }); return; }
    try {
      el.frame.contentWindow.history.go(delta);
    } catch (e) {}
  }

  function frameReload() {
    if (nativeBrowser) { nativeBrowser.send({ action: 'reload' }); return; }
    try {
      el.frame.contentWindow.location.reload();
    } catch (e) {
      if (state.url) navigate(state.url, false);
    }
  }

  function toggleHidden() {
    state.hidden = !state.hidden;
    applyHidden();
    save();
  }

  // 收到一个可能意味着「用户走了」的信号，延迟后交给策略判定。
  // 判定必须放在延迟之后：focus/blur 在帧之间会有中间态，立刻读会误判。
  function maybeConceal(reason) {
    if (state.hidden) return;
    clearTimeout(concealTimer);
    concealTimer = setTimeout(function () {
      var verdict = ConcealPolicy.shouldConceal(reason, {
        mode: autoHide,
        hasFocus: document.hasFocus(),
        visible: document.visibilityState !== 'hidden',
        pointerInside: pointerInside(),
      });
      if (!verdict) return;
      state.hidden = true;
      applyHidden();
      save();
    }, CONCEAL_DELAY);
  }

  function cancelConceal() {
    clearTimeout(concealTimer);
  }

  function toggleMode() {
    if (state.mode === 'dock') {
      var r = el.panel.getBoundingClientRect();
      state.float.x = Math.max(12, Math.round(r.left));
      state.float.y = Math.max(12, Math.round(r.top));
      state.mode = 'float';
    } else {
      state.mode = 'dock';
    }
    applyMode();
    save();
  }

  // ---------- 拖拽 ----------

  function startDrag(e) {
    if (state.mode !== 'float') return;
    if (e.target.closest('button, input')) return;
    var startX = e.clientX, startY = e.clientY;
    var originX = state.float.x, originY = state.float.y;

    function move(ev) {
      state.float.x = Math.max(0, originX + ev.clientX - startX);
      state.float.y = Math.max(0, originY + ev.clientY - startY);
      el.panel.style.left = state.float.x + 'px';
      el.panel.style.top = state.float.y + 'px';
    }
    function up() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      save();
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
  }

  function rememberSize() {
    if (state.mode !== 'float') return;
    var r = el.panel.getBoundingClientRect();
    state.float.w = Math.round(r.width);
    state.float.h = Math.round(r.height);
    save();
  }

  // ---------- 事件绑定 ----------

  function bind() {
    el.panel.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'go') navigate(el.src.value);
      else if (act === 'back') frameGo(-1);
      else if (act === 'fwd') frameGo(1);
      else if (act === 'reload') frameReload();
      else if (act === 'hide') toggleHidden();
      else if (act === 'pop') toggleMode();
      else if (act === 'external' && nativeBrowser) nativeBrowser.send({ action: 'external', url: el.src.value });
      else if (act === 'fx') {
        state.fx = !state.fx;
        applyFx();
        save();
        if (state.url) navigate(state.url, false);
      }
      else if (act === 'dim') {
        state.dim = !state.dim;
        // dim 是 fixture view 的子模式，单独开着没有意义，顺手把 fx 也拉起来。
        if (state.dim && !state.fx) state.fx = true;
        applyFx();
        save();
        if (state.url) navigate(state.url, false);
      }
    });

    el.src.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') navigate(el.src.value);
    });

    // 指针进入小窗即取消待执行的隐藏，并在其停留期间禁止隐藏。
    // mouseenter/mouseleave 只在跨越元素边界时触发，移进内部的 iframe 不算离开。
    el.panel.addEventListener('mouseenter', function () {
      pointerOnPanel = true;
      cancelConceal();
    });
    el.panel.addEventListener('mouseleave', function () {
      pointerOnPanel = false;
    });

    // 每次框架内导航完成，从代理路径反解出源站地址，记为当前阅读位置。
    // 用 load 事件而不是让页面上报，理由见 decodeProxyPath 的注释。
    el.frame.addEventListener('load', function () {
      var src;
      try {
        src = decodeProxyPath(el.frame.contentWindow.location.pathname);
      } catch (e) {
        return;
      }
      if (!src || src === state.url) return;
      state.url = src;
      el.src.value = src;
      save();
    });

    el.head.addEventListener('dblclick', toggleMode);
    el.head.addEventListener('mousedown', startDrag);
    if (window.ResizeObserver) {
      new ResizeObserver(rememberSize).observe(el.panel);
    }

    // 老板键：把鼠标移出小窗后单击右键。
    // 指针在小窗内时不但不收起，还要放行原生右键菜单——
    // 复制、在新标签页打开、返回上一页都靠它，堵掉等于把网站功能砍了一半。
    document.addEventListener('contextmenu', function (e) {
      if (!ConcealPolicy.shouldToggleOnRightClick({ pointerInside: pointerInside() })) return;
      e.preventDefault();
      toggleHidden();
    }, true);

    // 注意：点进小窗会让父页面触发 blur（焦点移进了 iframe）。
    // 这不是「用户走了」，策略层用 document.hasFocus() 把这种情况挡掉。
    window.addEventListener('blur', function () { maybeConceal('blur'); });
    window.addEventListener('focus', cancelConceal);
    document.addEventListener('mouseleave', function () { maybeConceal('mouseleave'); });
    document.addEventListener('mouseenter', cancelConceal);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) maybeConceal('hidden'); else cancelConceal();
    });

    // 挂机计时。本页的输入直接记录；iframe 内的输入不冒泡出来，
    // 由守卫脚本节流上报（见 message 监听的 activity 分支）。
    if (idleMs > 0) {
      var noteActivity = function () { lastActivity = Date.now(); };
      var acts = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll'];
      for (var i = 0; i < acts.length; i++) {
        document.addEventListener(acts[i], noteActivity, { passive: true, capture: true });
      }
      setInterval(function () {
        if (!state.hidden && Date.now() - lastActivity >= idleMs) maybeConceal('idle');
      }, IDLE_CHECK_MS);
    }

    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || d.__aside !== 1) return;
      if (d.type === 'bosskey') toggleHidden();
      else if (d.type === 'conceal') maybeConceal(d.reason || 'hidden');
      // 地址不再由页面上报，改为父页面在 iframe load 时自己解码，见 bind() 里的 load 监听。
      else if (d.type === 'pointer') {
        pointerInFrame = !!d.inside;
        if (pointerInFrame) cancelConceal();
      }
      else if (d.type === 'activity') lastActivity = Date.now();
    });
  }

  function init() {
    load();
    if (!build()) return;
    applyMode();
    applyHidden();
    applyFx();
    bind();
    if (state.url) {
      el.src.value = state.url;
      navigate(state.url, false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
