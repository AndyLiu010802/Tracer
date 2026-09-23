(function () {
  'use strict';

  // 右栏可拖宽 + 随阅读面板显隐自动收起。
  //
  // 收起态不另设持久化开关：它整个是从 #aside-slot 里阅读面板（public/reader.js
  // 创建的 .fx-panel，本文件不改它）的真实状态推导出来的——面板 display:none
  // 或切到 float 态就收起，回到 dock 且可见就展开。宽度则相反，是这里独有的
  // 偏好，单独存一个 key。
  //
  // 本文件在 app.js 之后、reader.js 之前以普通（非 defer）脚本加载：执行时
  // .shell/.rail/.rail-grip/#aside-slot 这些静态标记已经解析完成（都在本
  // <script> 之前），但 reader.js 是 defer 注入在 </body> 前的，此刻还没跑，
  // #aside-slot 里还是空的。因此收起态的推导必须靠 MutationObserver 等面板
  // 真正插入之后再判定，见下方 onSlotChange 的空判断。

  var shell = document.querySelector('.shell');
  var rail = document.querySelector('.rail');
  var grip = document.querySelector('.rail-grip');
  var slot = document.getElementById('aside-slot');
  if (!shell || !rail || !grip || !slot) return;

  var LS_WIDTH = 'tracer.railWidth';
  var LS_COLLAPSED = 'tracer.railCollapsed';
  var MIN = 320;
  var STEP = 16;

  // 右栏不能无限拖宽：左侧导航 236px + 主区至少留 420px 可用，另外封顶 760px
  // 不让参考面板反客为主。视口变窄时上限也跟着降，必要时把已存宽度重新钳位。
  function getMax() {
    return Math.max(MIN, Math.min(760, window.innerWidth - 236 - 420));
  }

  function clampWidth(w) {
    var max = getMax();
    if (w < MIN) return MIN;
    if (w > max) return max;
    return w;
  }

  function setWidth(px) {
    shell.style.setProperty('--rail-w', px + 'px');
  }

  function loadWidth() {
    try { return localStorage.getItem(LS_WIDTH); } catch (e) { return null; }
  }

  // curWidth 是宽度的唯一事实来源：null 表示用户从未设置过（交给 skin.css
  // 的默认值和窄视口断点，不写 inline），否则就是用户选定的偏好值（未必是
  // 当前渲染宽度——收起态时渲染宽度是 6px，两者必须分开，不能互相顶替）。
  // 拖拽/键盘的「起点宽度」一律从这里读，不能用 rail.getBoundingClientRect()：
  // 收起态下那会读到 6，谬以千里（见下方 collapsed 守卫）。
  var curWidth = null;
  (function initWidth() {
    var raw = loadWidth();
    if (raw === null) return;
    var w = parseFloat(raw);
    if (isFinite(w)) curWidth = w;
  })();

  function saveWidth(px) {
    curWidth = px;
    try { localStorage.setItem(LS_WIDTH, String(px)); } catch (e) {}
  }

  // 应用 curWidth 到 inline 变量；curWidth 为 null 时显式清掉 inline，交给
  // CSS 默认值/断点接管——不然「从未拖过」和「拖过又被清空」会分不清。
  function applyWidth() {
    if (curWidth === null) shell.style.removeProperty('--rail-w');
    else setWidth(clampWidth(curWidth));
  }
  applyWidth();
  window.addEventListener('resize', applyWidth);

  function postBosskey() {
    try { window.postMessage({ __aside: 1, type: 'bosskey' }, '*'); } catch (e) {}
  }

  // ---------- 收起态：由阅读面板的真实状态推导 ----------

  function applyCollapsed(collapsed) {
    shell.setAttribute('data-rail', collapsed ? 'collapsed' : 'open');
    try { localStorage.setItem(LS_COLLAPSED, collapsed ? '1' : '0'); } catch (e) {}
  }

  // 加载时先同步应用上一次的缓存结果，避免面板还没插入前的这一小段时间里
  // 右栏先以默认展开态占了 392px 又在面板插入后突然收起、闪一下。
  (function primeCollapsedFromCache() {
    var cached = null;
    try { cached = localStorage.getItem(LS_COLLAPSED); } catch (e) {}
    if (cached === '1') shell.setAttribute('data-rail', 'collapsed');
    else if (cached === '0') shell.setAttribute('data-rail', 'open');
    // 两者都不是（第一次访问）：不写 data-rail，交给下面 observer 的第一次
    // 真实判定来定，避免用一个瞎猜的默认值污染还没发生过的偏好。
  })();

  function onSlotChange() {
    var panel = slot.querySelector('.fx-panel');
    if (!panel) return;   // 面板还没被 reader.js 插入，维持缓存值，等下一次变动
    var collapsed = panel.style.display === 'none' || panel.getAttribute('data-mode') === 'float';
    applyCollapsed(collapsed);
  }

  var mo = new MutationObserver(onSlotChange);
  mo.observe(slot, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'data-mode'] });
  onSlotChange();   // 万一此刻面板已经在（理论上不会，防御性调用一次无害）

  // ---------- 拖拽改宽度 ----------

  var dragging = false;
  var dragMoved = false;   // 是否真的发生过位移（区分「纯点击」和「拖拽」，见 endDrag）
  var dragStartX = 0;
  var dragStartWidth = 0;
  var dragRawWidth = 0;    // 未经 MIN 钳位的原始宽度——视觉上用 clampWidth() 钉在 MIN，
                            // 但「是否想收起」的判定必须看这个原始值，否则钉住之后永远量不出 <200

  grip.addEventListener('pointerdown', function (e) {
    if (e.button) return;   // 只认主键（左键/触控/笔的主接触）
    // In the stacked layout the reader spans the viewport; horizontal resizing is meaningless.
    if (window.matchMedia('(max-width:720px)').matches) return;
    // 收起态下把手渲染宽度是 6px，拿它当拖拽基准会把「无意义的 6」当成用户
    // 想要的宽度写回去。收起态只认双击/键盘展开，不认拖拽——先展开，展开
    // 之后再来一次 pointerdown 才是合法的拖拽起点。
    if (shell.getAttribute('data-rail') === 'collapsed') return;
    dragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartWidth = curWidth !== null ? clampWidth(curWidth) : rail.getBoundingClientRect().width;
    dragRawWidth = dragStartWidth;
    try { grip.setPointerCapture(e.pointerId); } catch (e2) {}
    grip.classList.add('is-dragging');
    document.body.classList.add('is-resizing');
    e.preventDefault();
  });

  grip.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    dragMoved = true;
    // 把手在右栏左边缘：指针左移（clientX 变小）应该让右栏变宽。
    dragRawWidth = dragStartWidth + (dragStartX - e.clientX);
    setWidth(clampWidth(dragRawWidth));
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    grip.classList.remove('is-dragging');
    document.body.classList.remove('is-resizing');
    try { grip.releasePointerCapture(e.pointerId); } catch (e2) {}
    if (!dragMoved) return;   // 没有真的拖动过（比如单纯点了一下）：不算一次改宽度操作
    if (dragRawWidth < 200) {
      // 拖到很窄视为「想收起」：不落地这个宽度（不然下次展开就卡在极窄），
      // 复原到 curWidth——而不是拖动起点的渲染宽度：如果用户从未拖过，
      // 起点宽度只是 CSS 默认值/断点值，不是用户的选择，写成 inline 会
      // 从此钉死这个数字，之后既盖不掉窄视口断点，也躲不过 resize 重新
      // 钳位（钳位只处理已存宽度），主区可能被压到底线以下。curWidth 为
      // null 时索性清掉 inline，把决定权交还给 CSS。收起本身交给面板
      // toggle 之后的 MutationObserver 联动。
      applyWidth();
      postBosskey();
    } else {
      var clamped = clampWidth(dragRawWidth);
      setWidth(clamped);
      saveWidth(clamped);
    }
  }
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);
  // capture 可能在没有 pointerup/pointercancel 的情况下丢失（例如拖动中
  // 窗口失去输入焦点）：只监听 up/cancel 会让 dragging 与 body.is-resizing
  // 永久卡住（iframe 失去 pointer-events、整页不可选中），且此后仅悬停
  // 把手就会用过期的 dragStartX 改宽度。endDrag 本身有 !dragging 早退，
  // 幂等，多绑一次不会重复处理正常路径下的 up。
  grip.addEventListener('lostpointercapture', endDrag);

  // 双击把手：与拖到过窄同一个入口——切换阅读面板显隐。
  grip.addEventListener('dblclick', function () {
    postBosskey();
  });

  // 键盘：把手聚焦时 Enter/Space 切换显隐，方向键微调，Home/End 到极值。
  grip.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      postBosskey();
      return;
    }
    // 收起态下同一个理由：渲染宽度是 6px，不是可用的调整基准。方向键/
    // Home/End 在收起态下直接不作为，Enter/Space 展开之后再调。
    if (shell.getAttribute('data-rail') === 'collapsed') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      var cur = curWidth !== null ? clampWidth(curWidth) : rail.getBoundingClientRect().width;
      var next = clampWidth(cur + (e.key === 'ArrowLeft' ? STEP : -STEP));
      setWidth(next);
      saveWidth(next);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setWidth(MIN);
      saveWidth(MIN);
    } else if (e.key === 'End') {
      e.preventDefault();
      var max = getMax();
      setWidth(max);
      saveWidth(max);
    }
  });
})();
