(function () {
  'use strict';

  // Tracer 的装配层：分区路由、日月轮回主题钟、存储客户端。
  // 各分区的功能模块（board.js 等）在后续阶段挂到 window.Tracer 上。
  var M = window.TracerModel;
  var I = window.TracerLocale || { message: function (s) { return s; }, t: function (s) { return s; } };

  // ---------- 分区路由 ----------
  var SECTIONS = ['inbox', 'notes', 'board', 'map', 'planner', 'timeline', 'insights', 'garden', 'shop', 'planets'];
  var LS_SEC = 'tracer.sec';
  var current = null;
  var hooks = {};                       // {sec: [fn]}
  // 工作区数据是否已经就绪（ready 结算且 store.data 非空）。true 之后 onShow/runHooks
  // 才允许直接同步触发；true 之前的所有触发需求都攒到 ready 结算时统一补一次
  // （见装配处 ready 链末尾），不能各自独立挂 ready.then——否则同一个 sec 若既有
  // 页面启动时的默认 show() 又有模块自己的 onShow 注册，两条 then 都会在结算后各摸一遍
  // hooks[sec]，同一个钩子就被触发两次（实测复现：默认分区的模块首屏渲染两次）。
  var dataReady = false;

  function fireHook(fn) {
    try { fn(); } catch (e) { console.error('[tracer] onShow hook', e); }
  }

  function fireAll(sec) {
    (hooks[sec] || []).forEach(fireHook);
  }

  function onShow(sec, fn) {
    (hooks[sec] = hooks[sec] || []).push(fn);
    // 数据已就绪：这是就绪之后才挂载的模块（懒加载等），错过了 ready 结算时的统一
    // 补触发，自己单独追一次。数据未就绪时什么都不用做——那次统一补触发会在结算后
    // 巡检当时的 current 分区，这里刚 push 进去的 fn 自然也在内，不会漏。
    if (dataReady && sec === current) fireHook(fn);
  }

  function runHooks(sec) {
    // 数据未就绪时空转：页面启动时的默认分区、或用户在数据到达前就点了导航切走，
    // 都交给 ready 结算时的统一补触发处理，这里重复触发会和它撞上。
    if (dataReady) fireAll(sec);
  }

  function show(sec) {
    if (SECTIONS.indexOf(sec) < 0) sec = 'board';
    current = sec;
    if (sec !== 'garden') lastNonGarden = sec;
    document.querySelectorAll('.nav-item[data-sec]').forEach(function (a) {
      a.classList.toggle('active', a.dataset.sec === sec);
    });
    document.querySelectorAll('.sec').forEach(function (s) {
      s.classList.toggle('active', s.id === 'sec-' + sec);
    });
    try { localStorage.setItem(LS_SEC, sec); } catch (e) {}
    // 分区模块的进场钩子（后续阶段用：切进来时重绘）
    runHooks(sec);
  }

  // ---------- Garden boss-key ----------
  // Ctrl+Alt+G 一键隐藏家园：隐藏导航项，返回上一分区，并记住偏好。
  var LS_GARDEN = 'tracer.gardenHidden';
  var gardenHidden = false;
  try { gardenHidden = localStorage.getItem(LS_GARDEN) === '1'; } catch (e) {}
  // 初值 'board' 是刻意的，不是随手写的占位：board 是最像「正在干活」的分区，
  // 也是 show() 对未知分区名的兜底目标——两处保持一致，用户还没切换过分区就
  // 触发隐藏时，跳回去的地方和路由兜底的地方是同一个，不会显得突兀。
  var lastNonGarden = 'board';

  function applyGardenHidden() {
    var nav = document.getElementById('nav-garden');
    if (nav) nav.hidden = gardenHidden;
    if (gardenHidden && current === 'garden') show(lastNonGarden);
  }

  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey && e.altKey && (e.code === 'KeyG' || e.key === 'g' || e.key === 'G'))) return;
    e.preventDefault();
    gardenHidden = !gardenHidden;
    try { localStorage.setItem(LS_GARDEN, gardenHidden ? '1' : '0'); } catch (e2) {}
    applyGardenHidden();
  }, true);

  document.getElementById('nav-secs').addEventListener('click', function (e) {
    var a = e.target.closest('.nav-item[data-sec]');
    if (a) show(a.dataset.sec);
  });

  document.getElementById('nav-secs').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var a = e.target.closest('.nav-item[data-sec]');
    if (a) { e.preventDefault(); show(a.dataset.sec); }
  });

  // ---------- 晨昏流转 ----------
  // 每分钟对时：把时段写在 <html data-phase>，CSS 变量随之切换（天光带 2s 过渡）。
  // 顶栏日晷：白天太阳沿弧线走（6:00-18:00 映射弧上 0→1），夜里换真实月相。
  var ARC = { x0: 6, y0: 16.5, cx: 38, cy: -6, x1: 70, y1: 16.5 };

  function arcPoint(t) {
    // 二次贝塞尔 B(t)，与日晷里画的 Q 弧同一条线
    var u = 1 - t;
    return {
      x: u * u * ARC.x0 + 2 * u * t * ARC.cx + t * t * ARC.x1,
      y: u * u * ARC.y0 + 2 * u * t * ARC.cy + t * t * ARC.y1,
    };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function renderSundial(now, dialHour) {
    var h = dialHour != null ? dialHour : now.getHours() + now.getMinutes() / 60;
    var daytime = h >= 6 && h < 18;
    // 仪器化的日晷：地平线 + 两端渐隐的弧线 + 晨/午/昏三个刻度 + 带光晕的日或月。
    // 渐变 defs 内嵌在这块 SVG 里，stop-color 走 CSS 变量，随时段轮转。
    var svg = '<svg viewBox="0 0 76 20">'
      + '<defs><linearGradient id="sd-arc" x1="0" y1="0" x2="1" y2="0">'
      + '<stop offset="0" stop-color="var(--accent)" stop-opacity="0"/>'
      + '<stop offset=".5" stop-color="var(--accent)" stop-opacity=".55"/>'
      + '<stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>'
      + '</linearGradient></defs>'
      + '<line x1="2" y1="16.5" x2="74" y2="16.5" stroke="var(--border)" stroke-width="1"/>'
      + '<path d="M ' + ARC.x0 + ' ' + ARC.y0 + ' Q ' + ARC.cx + ' ' + ARC.cy
      + ' ' + ARC.x1 + ' ' + ARC.y1 + '" fill="none" stroke="url(#sd-arc)" stroke-width="1.2"/>'
      + '<line x1="6" y1="16.5" x2="6" y2="18.5" stroke="var(--border)" stroke-width="1"/>'
      + '<line x1="38" y1="14" x2="38" y2="15.6" stroke="var(--border)" stroke-width="1"/>'
      + '<line x1="70" y1="16.5" x2="70" y2="18.5" stroke="var(--border)" stroke-width="1"/>';
    if (daytime) {
      var p = arcPoint((h - 6) / 12);
      svg += '<g transform="translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')">'
        + '<circle r="5.4" fill="var(--accent)" opacity=".14"/>'
        + '<circle r="3.6" fill="var(--accent)" opacity=".22"/>'
        + '<circle r="2.3" fill="var(--accent)"/>'
        + '<circle cx="-.7" cy="-.7" r=".8" fill="var(--accent2)" opacity=".9"/>'
        + '</g>';
    } else {
      // 夜段跨午夜：18 点在弧起点，次日 6 点在弧终点
      var t = h >= 18 ? (h - 18) / 12 : (h + 6) / 12;
      var q = arcPoint(t);
      var phase = M.moonPhase(now);
      var d = M.moonPathD(M.moonIllum(phase), 3.1);
      svg += '<g transform="translate(' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ')">'
        + '<circle r="5.4" fill="var(--accent)" opacity=".12"/>'
        + '<circle r="3.1" fill="none" stroke="var(--accent)" stroke-width="1" opacity=".85"/>'
        + (d ? '<path d="' + d + '" fill="var(--accent)"/>' : '')
        + '</g>';
    }
    svg += '</svg>';
    document.getElementById('sundial').innerHTML = svg;
    document.getElementById('clock').textContent =
      pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  }

  // 开发预览：?phase=dusk 固定时段。首帧内联脚本认它，这里也要认，
  // 否则一分钟后对时就把预览盖回真实时段。预览时日晷也摆到该时段的
  // 代表性时刻（时间文字仍是真实时间）。
  var PHASE_OVERRIDE = (function () {
    var m = /[?&]phase=(dawn|day|dusk|night)\b/.exec(location.search);
    return m ? m[1] : null;
  })();
  var PHASE_DEMO_HOUR = { dawn: 7, day: 13, dusk: 19.5, night: 23 };

  function applyTheme() {
    var now = new Date();
    document.documentElement.setAttribute('data-phase',
      PHASE_OVERRIDE || M.dayPhase(now.getHours()));
    renderSundial(now, PHASE_OVERRIDE ? PHASE_DEMO_HOUR[PHASE_OVERRIDE] : null);
  }

  // ---------- 存储客户端 ----------
  // 改动 → touch() → 500ms 防抖 → PUT /api/store/workspace。
  // 失败：圆点变橙、内存数据保留，下一次 touch 自然重试。
  var STORE_URL = '/api/store/workspace';
  var store = { data: null, timer: 0, dirty: false, lost: false, inflight: false };
  var Sync = window.WorkspaceSync;
  store.base = null; store.conflict = null;
  store.epoch = 0;
  var DRAFT_KEY = 'tracer.workspaceDraft';
  // Read-only compatibility source until recovered edits are saved locally.
  var LEGACY_DRAFT_KEY = 'tracer.cloudDraft', legacySource = null, localDraftSource = null, draftBlocked = false;
  var dot = document.getElementById('save-dot');

  function setDot(cls, title) {
    dot.className = 'save-dot' + (cls ? ' ' + cls : '');
    dot.title = I.message(title);
    dot.setAttribute('aria-label', dot.title);
  }

  function save() {
    if (store.conflict || store.lost || !store.data) return;
    if (store.inflight) { store.dirty = true; return; } // 在途时只标脏，等回来再补发
    store.inflight = true;
    store.dirty = false;
    var failed = false;
    setDot('saving', 'Saving…');
    store.data.meta.rev++;
    var sent = Sync.clone(store.data);
    fetch(STORE_URL, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sent),
    }).then(function (r) { return r.json().then(function (body) {
      if (!r.ok) { var err = new Error(body.error || '保存失败'); err.status = r.status; throw err; }
      var accepted = body.workspace || sent;
      // Edits made during an in-flight save stay on top of the accepted snapshot.
      var savedMerge = Sync.merge(sent, store.data, accepted);
      adopt(savedMerge.workspace);
      if (notifyArchivedRecovery(savedMerge)) store.dirty = true;
      var previousAccepted = store.base;
      store.base = Sync.clone(accepted);
      if (window.Tracer.celebrations) window.Tracer.celebrations.accepted(previousAccepted, store.base);
      if (window.Tracer.garden) window.Tracer.garden.refresh();
      if (!store.dirty) adopt(Sync.clone(accepted));
      persistDraft();
      setDot('', 'Saved locally');
    });
    }).catch(async function (err) {
      failed = true;
      store.dirty = true; // 数据还在内存里，下次 touch 重试
      persistDraft();
      if (err.status === 409 && err.message === 'workspace-stale') {
        try {
          var latestResponse = await fetch(STORE_URL);
          if (!latestResponse.ok) throw new Error('workspace-reload-failed');
          var latest = Sync.validate(await latestResponse.json());
          var reconciled = Sync.merge(store.base, store.data, latest);
          notifyArchivedRecovery(reconciled);
          store.base = reconciled.conflicts.length ? store.base : Sync.clone(latest);
          adopt(Sync.assignSequences(reconciled.workspace, latest));
          store.conflict = reconciled.conflicts.length ? latest : null;
          persistDraft();
          setDot('err', I.t(store.conflict ? 'draftConflictTip' : 'workspaceMerged'));
          return;
        } catch (recoveryError) {
          setDot('err', I.t('workspaceChanged'));
          return;
        }
      }
      setDot('err', err.status === 413 ? I.t('tooLarge') : I.t('savePending') + ': ' + I.message(err.message));
    }).then(function () {
      store.inflight = false;
      persistDraft();
      // Keyed garden controls must leave their saving state even when an input
      // or task dialog is focused and the broader workspace redraw is deferred.
      if (window.Tracer.garden) window.Tracer.garden.refresh();
      if (!store.dragging && !store.dirty && modalRoot.hidden && !document.body.classList.contains('sticker-decorating') && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) redraw();
      // 只补发「在途期间新产生的」改动。失败本身不在这里重试——catch 也会把 dirty
      // 置回 true，不加区分就是一个按往返延迟空转的热循环（实测持续 500 时 2 秒 52 个 PUT）。
      if (store.dirty && !failed) { clearTimeout(store.timer); store.timer = setTimeout(save, 0); }
    });
  }

  function touch() {
    // 加载失败时锁死保存：拿空工作区顶上再保存，会覆盖服务端仅存的一份
    if (store.lost || !store.data) return;
    store.dirty = true;
    store.epoch++;
    persistDraft();
    clearTimeout(store.timer);
    store.timer = setTimeout(save, 500);
  }

  window.addEventListener('beforeunload', function () {
    // inflight 也要兜底：去掉 keepalive 后卸载会掐断在途 PUT，而 save() 开头已把 dirty
    // 置 false，只看 dirty 的话这一格什么都不会发。重复写入无害（服务端按名串行化）。
    if ((!store.dirty && !store.inflight) || !store.data || store.lost) return;
    persistDraft();
    if (store.conflict) return;
    // sendBeacon 只能 POST，端点两个动词等效；超 64KiB 会静默 false
    if (!navigator.sendBeacon(STORE_URL, JSON.stringify(store.data))) {
      setDot('err', 'Not saved');
    }
  });

  function persistDraft() {
    if (!store.data || draftBlocked) return;
    try {
      var currentSource = localStorage.getItem(DRAFT_KEY);
      if (currentSource !== null && currentSource !== localDraftSource) {
        setDot('err', I.t('otherDraftKept')); return;
      }
      if (store.dirty || store.inflight || store.conflict) {
        var draft = { base: store.base, data: store.data };
        // Preserve exact provenance across reloads. Never delete a legacy draft
        // that another window has changed since this recovery began.
        if (legacySource !== null) draft.legacySource = legacySource;
        var serialized = JSON.stringify(draft);
        localStorage.setItem(DRAFT_KEY, serialized); localDraftSource = serialized;
      } else {
        if (legacySource !== null && localStorage.getItem(LEGACY_DRAFT_KEY) === legacySource) localStorage.removeItem(LEGACY_DRAFT_KEY);
        if (currentSource === localDraftSource) localStorage.removeItem(DRAFT_KEY);
        legacySource = null; localDraftSource = null;
      }
    } catch (e) { setDot('err', I.t('localDraftFailed')); }
  }
  // Existing section handlers retain workspace and record references while editing.
  function notifyArchivedRecovery(result) {
    var recovered = (result.relocatedArchivedTasks || []).length + (result.recoveredArchivedTasks || []).length;
    if (!recovered) return false;
    notice(TracerLocale.language() === 'zh'
      ? '项目已经归档。未保存的新任务或修改已保留到未分组任务，收藏星球保持原样。'
      : 'This project was archived. Unsaved tasks and edits were kept as unassigned tasks; its memory planet is unchanged.');
    return true;
  }
  function adopt(next) {
    window.TaskHistory.preserve(store.data, next);
    if (!store.data) { store.data = next; return; }
    ['tasks', 'projects', 'notes', 'inbox'].forEach(function (name) {
      var previous = Object.create(null);
      store.data[name].forEach(function (x) { previous[x.id] = x; });
      store.data[name] = next[name].map(function (x) {
        var target = previous[x.id]; if (!target) return x;
        Object.keys(target).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(x, k)) delete target[k]; });
        Object.keys(x).forEach(function (k) { target[k] = x[k]; }); return target;
      });
    });
    store.data.completionHistory = next.completionHistory;
    store.data.projectDeletions = next.projectDeletions;
    store.data.taskGarden = next.taskGarden;
    store.data.meta = next.meta; store.epoch++;
  }
  function redraw() {
    if (window.Tracer.garden) window.Tracer.garden.refresh();
    if (window.Tracer.renderProjects) window.Tracer.renderProjects();
    if (window.Tracer.refreshWellness) window.Tracer.refreshWellness();
    if (window.Tracer.pet) window.Tracer.pet.refresh();
    fireAll(current);
  }
  function restoreDraft() {
    var localSource;
    try {
      localSource = localStorage.getItem(DRAFT_KEY);
      localDraftSource = localSource;
      var source = localSource || localStorage.getItem(LEGACY_DRAFT_KEY);
      if (!source) return;
      var draft = JSON.parse(source);
      if (!draft || !draft.base || !draft.data) throw new Error('invalid-draft');
      Sync.validate(draft.base); Sync.validate(draft.data);
      if (!localSource) {
        if (!draft.base.meta || !draft.data.meta || !draft.base.meta.syncAccount || draft.data.meta.syncAccount !== draft.base.meta.syncAccount || draft.base.meta.syncAccount !== store.data.meta.syncAccount) {
          setDot('err', I.t('oldDraftKept')); return;
        }
        legacySource = source;
      } else if (typeof draft.legacySource === 'string' && draft.legacySource === localStorage.getItem(LEGACY_DRAFT_KEY)) legacySource = draft.legacySource;
      var remote = Sync.clone(store.data);
      var merged = Sync.merge(draft.base, draft.data, remote);
      notifyArchivedRecovery(merged);
      store.base = merged.conflicts.length ? draft.base : remote;
      adopt(Sync.assignSequences(merged.workspace, remote)); store.dirty = true;
      persistDraft();
      if (merged.conflicts.length) { store.conflict = remote; setDot('err', I.t('draftConflictTip')); }
      else store.timer = setTimeout(save, 500);
    } catch (e) {
      draftBlocked = !!localSource;
      setDot('err', I.t('oldDraftKept'));
    }
  }
  function resolveDraft(choices) {
    if (!store.conflict) return false;
    var merged = Sync.merge(store.base, store.data, store.conflict, choices);
    if (merged.conflicts.length) return false;
    notifyArchivedRecovery(merged);
    store.base = Sync.clone(store.conflict); adopt(Sync.assignSequences(merged.workspace, store.conflict)); store.conflict = null;
    store.dirty = true; persistDraft(); redraw(); save(); return true;
  }
  dot.onclick = function () {
    if (!store.conflict) { if (store.lost) location.reload(); else if (store.dirty) save(); return; }
    modal(function (box, close) {
      var list = Sync.merge(store.base, store.data, store.conflict).conflicts;
      box.innerHTML = '<h2>' + I.t('conflictTitle') + '</h2><p>' + I.t('draftConflictHelp') + '</p>'
        + list.map(function (c, i) { return '<div class="draft-conflict"><b>' + M.esc(c.title) + '</b><label for="draft-choice-' + i + '">' + M.esc(I.t(c.field)) + '</label><pre>' + I.t('draftVersion') + ': ' + M.esc(c.local === undefined ? I.t('deleted') : JSON.stringify(c.local)) + '\n' + I.t('diskVersion') + ': ' + M.esc(c.remote === undefined ? I.t('deleted') : JSON.stringify(c.remote)) + '</pre><select id="draft-choice-' + i + '" data-choice="' + i + '"><option value="">' + I.t('choose') + '</option><option value="local">' + I.t('keepDraft') + '</option><option value="remote">' + I.t('keepDisk') + '</option></select></div>'; }).join('')
        + '<div class="modal-actions"><button class="btn" id="draft-later">' + I.t('later') + '</button><button class="btn btn-primary" id="draft-resolve">' + I.t('mergeSave') + '</button></div>';
      box.querySelector('#draft-later').onclick = close;
      box.querySelector('#draft-resolve').onclick = function () {
        var choices = {}, complete = true;
        box.querySelectorAll('[data-choice]').forEach(function (el) { if (!el.value) complete = false; else choices[list[+el.dataset.choice].key] = el.value; });
        if (complete && resolveDraft(choices)) close();
      };
    });
  };
  window.addEventListener('online', function () { if (store.dirty) save(); });

  // ---------- 共享 UI 原语 ----------
  // modal(render) 打开一个弹层：render(close) 返回内容 DOM，close([result]) 关闭。
  // 视图模块用它做建卡/编辑/建项目对话框，样式在 board.css。
  var modalRoot = document.getElementById('modal-root');
  var modalBox = null, modalFocus = null;

  function closeModal(force) {
    if (force !== true && modalBox && modalBox.beforeClose && !modalBox.beforeClose()) return;
    modalRoot.hidden = true;
    modalRoot.innerHTML = '';
    modalRoot.onclick = null; // 清掉上一次 modal() 挂的遮罩点击 handler，纯整洁
    document.removeEventListener('keydown', modalEsc);
    if (modalFocus && modalFocus.isConnected) modalFocus.focus();
    modalBox = null;
  }
  function modalEsc(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    if (e.key === 'Tab' && modalBox) {
      var items = Array.prototype.filter.call(modalBox.querySelectorAll('button,input,textarea,select,a[href],[tabindex="0"]'), function (el) { return !el.disabled && el.getClientRects().length; });
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function modal(build) {
    var previousNotice = document.getElementById('task-notice'); if (previousNotice) previousNotice.hidden = true;
    modalRoot.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'modal';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    modalBox = box; modalFocus = document.activeElement;
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    build(box, closeModal);
    modalRoot.appendChild(box);
    modalRoot.hidden = false;
    // 点遮罩关闭；Esc 关闭。
    modalRoot.onclick = closeModal;
    document.addEventListener('keydown', modalEsc);
    // 自动聚焦第一个输入
    var first = box.querySelector('input, textarea, select');
    if (first) first.focus();
  }

  var noticeTimer;
  function notice(message, action) {
    var el = document.getElementById('task-notice');
    if (!el) { el = document.createElement('div'); el.id = 'task-notice'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    clearTimeout(noticeTimer); el.innerHTML = ''; el.hidden = false; if (el.dataset) delete el.dataset.projectArchive;
    var label = document.createElement('span'); label.textContent = message; el.appendChild(label);
    if (action) { var button = document.createElement('button'); button.className = 'btn'; button.textContent = I.t('undo'); button.onclick = function () { el.hidden = true; action(); }; el.appendChild(button); }
    noticeTimer = setTimeout(function () { el.hidden = true; }, 12000);
  }

  // 危险确认框：confirm(msg, onYes)
  function confirmModal(msg, onYes) {
    modal(function (box, close) {
      var h = document.createElement('h2'); h.textContent = msg;
      var acts = document.createElement('div'); acts.className = 'modal-actions';
      var cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = I.t('cancel');
      cancel.onclick = close;
      var ok = document.createElement('button'); ok.className = 'btn btn-danger'; ok.textContent = I.t('delete');
      ok.onclick = function () { close(); onYes(); };
      acts.appendChild(cancel); acts.appendChild(ok);
      box.appendChild(h); box.appendChild(acts);
    });
  }

  // Pointer drag uses a detached visual clone and an insertion placeholder.
  // The real task stays unchanged until drop; Escape, pointer cancellation and blur clean up.
  // Document listeners keep working when the pointer leaves a card or column.
  function dragList(container, opts) {
    var dragging, ghost, placeholder, target, before, pointerId, moved, startX, startY, offsetX, offsetY, columnHeights = [];
    function locate(e) {
      var hit = document.elementFromPoint(e.clientX, e.clientY);
      var col = hit && hit.closest(opts.colSelector);
      if (!col || !container.contains(col)) return null;
      return col;
    }
    function preview(e) {
      container.querySelectorAll('.drop-target').forEach(function (c) { c.classList.remove('drop-target'); });
      target = locate(e); before = null;
      if (!target) { placeholder.remove(); ghost.classList.add('drop-invalid'); ghost.querySelector('.drag-caption').textContent = I.t('dragCancel'); return; }
      ghost.classList.remove('drop-invalid'); target.classList.add('drop-target');
      var cards = Array.prototype.filter.call(target.querySelectorAll(opts.itemSelector), function (c) { return c !== dragging; });
      for (var i = 0; i < cards.length; i++) { var r = cards[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { before = cards[i]; break; } }
      target.insertBefore(placeholder, before);
      var label = opts.targetLabel ? opts.targetLabel(target) : target.dataset.day || I.t('plannedDate');
      ghost.querySelector('.drag-caption').textContent = I.t('dropHere', { target: label });
    }
    function onMove(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      if (!container.isConnected) { finish(null, true); return; }
      if (!moved) {
        if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 6) return;
        moved = true; store.dragging = true; store.epoch++;
        columnHeights = Array.prototype.map.call(container.querySelectorAll(opts.colSelector), function (col) {
          var previous = col.style.minHeight;
          col.style.minHeight = Math.max(120, col.getBoundingClientRect().height) + 'px';
          return { col: col, previous: previous };
        });
        var rect = dragging.getBoundingClientRect();
        ghost = dragging.cloneNode(true); ghost.classList.add('drag-ghost'); ghost.removeAttribute('id'); ghost.setAttribute('aria-hidden', 'true');
        ghost.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
        // Drag coordinates belong to the viewport, regardless of a theme's card layout.
        ghost.style.position = 'fixed';
        ghost.style.width = rect.width + 'px';
        var caption = document.createElement('div'); caption.className = 'drag-caption'; ghost.appendChild(caption); document.body.appendChild(ghost);
        placeholder = document.createElement('div'); placeholder.className = 'drag-placeholder'; placeholder.style.height = rect.height + 'px';
        placeholder.setAttribute('aria-hidden', 'true'); dragging.classList.add('drag-source');
        container.classList.add('is-dragging'); document.body.classList.add('task-dragging');
      }
      e.preventDefault();
      // Pointer coordinates and the fixed preview share the viewport coordinate
      // space. Clamping the card to the viewport would detach the grab point.
      ghost.style.left = (e.clientX - offsetX) + 'px';
      ghost.style.top = (e.clientY - offsetY) + 'px';
      preview(e);
      var scroller = container.closest('.main');
      if (scroller) { var bounds = scroller.getBoundingClientRect(); if (e.clientY > bounds.bottom - 60) scroller.scrollTop += 18; else if (e.clientY < bounds.top + 60) scroller.scrollTop -= 18; }
    }
    function suppressClick(e) { e.preventDefault(); e.stopImmediatePropagation(); }
    function finish(e, cancelled) {
      if (!dragging) return;
      if (e && e.pointerId !== pointerId) return;
      var el = dragging, wasMoved = moved;
      if (wasMoved && !cancelled) preview(e);
      var col = cancelled ? null : target, next = before;
      dragging = null; moved = false; store.dragging = false;
      el.classList.remove('drag-source'); container.classList.remove('is-dragging'); document.body.classList.remove('task-dragging');
      columnHeights.forEach(function (entry) { entry.col.style.minHeight = entry.previous; }); columnHeights = [];
      container.querySelectorAll('.drop-target').forEach(function (c) { c.classList.remove('drop-target'); });
      if (ghost) ghost.remove(); if (placeholder) placeholder.remove(); ghost = placeholder = null;
      document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('keydown', onKey); window.removeEventListener('blur', cancel);
      if (!wasMoved) return;
      document.addEventListener('click', suppressClick, true); setTimeout(function () { document.removeEventListener('click', suppressClick, true); }, 0);
      if (col) opts.onDrop(el, col, next); else { if (opts.onCancel) opts.onCancel(); notice(I.t('moveCancelled')); }
    }
    function onUp(e) { finish(e, false); }
    function cancel() { finish(null, true); }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } }
    container.addEventListener('pointerdown', function (e) {
      var card = e.target.closest(opts.itemSelector);
      if (dragging || !card || e.button !== 0 || !container.contains(card) || e.target.closest('button,input,textarea,select,a')) return;
      if (e.pointerType === 'touch' && !e.target.closest('.drag-handle')) return;
      dragging = card; moved = false; target = before = null; pointerId = e.pointerId; startX = e.clientX; startY = e.clientY;
      var rect = card.getBoundingClientRect(); offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
      document.addEventListener('pointermove', onMove, { passive: false }); document.addEventListener('pointerup', onUp); document.addEventListener('pointercancel', cancel);
      document.addEventListener('keydown', onKey); window.addEventListener('blur', cancel);
    });
  }

  // ---------- 装配 ----------
  // 后续分区模块的接入点：ready 成功兑现工作区对象（store.data 同步就绪）；
  // 失败则兑现 null 且 store.lost=true。onShow 注册的钩子只在工作区就绪后触发，
  // 模块不用自查 store.data 是否为空——ready 前注册、lost 路径都不会触发。
  var companionWrite = null;
  function applyCompanionWork(request) {
    var Work = window.TracerCompanionWork;
    if (!request || !Work.validRequestId(request.requestId)) return Promise.reject(new Error('invalid-companion-request-id'));
    var proposal;
    try { proposal = Work.normalize(request.proposal); } catch (error) { return Promise.reject(error); }
    var fingerprint = JSON.stringify(proposal);
    if (companionWrite) {
      if (companionWrite.id === request.requestId && companionWrite.fingerprint === fingerprint) return companionWrite.promise;
      return Promise.reject(new Error('workspace-busy'));
    }
    var operation = { id: request.requestId, fingerprint: fingerprint };
    companionWrite = operation;
    operation.promise = (async function () {
      await window.Tracer.ready;
      if (store.lost || !store.data || store.conflict || store.inflight) throw new Error('workspace-busy');
      var result = Work.apply(store.data, proposal, request.requestId, M);
      if (!result.duplicate) adopt(result.workspace);
      var receipt = store.data.meta.companionReceipts.find(function (entry) { return entry.requestId === request.requestId; });
      function persisted() {
        return (store.base && store.base.meta.companionReceipts || []).some(function (entry) {
          return entry.requestId === receipt.requestId && entry.signature === receipt.signature;
        });
      }
      if (!persisted()) {
        touch(); clearTimeout(store.timer); save();
        var until = Date.now() + 20000;
        while (store.inflight && Date.now() < until) await new Promise(function (resolve) { setTimeout(resolve, 50); });
        if (!persisted()) throw new Error('companion-save-pending');
      }
      redraw();
      return { duplicate: result.duplicate, projectId: result.projectId, taskIds: result.taskIds, noteId: result.noteId };
    })().finally(function () { if (companionWrite === operation) companionWrite = null; });
    return operation.promise;
  }
  window.Tracer = {
    store: store,
    touch: touch,
    show: show,
    onShow: onShow,
    currentSec: function () { return current; },
    saveNow: save,
    applyCompanionWork: applyCompanionWork,
    applyAIPlan: async function (plan, constraints, id) {
      if (store.lost || !store.data || store.conflict || store.inflight) throw new Error('workspace-busy');
      var result = window.TracerAIPlanner.apply(store.data, plan, constraints, id, M);
      if (!result.duplicate) adopt(result.workspace);
      touch(); clearTimeout(store.timer); save();
      var until = Date.now() + 20000;
      while (store.inflight && Date.now() < until) await new Promise(function (resolve) { setTimeout(resolve, 100); });
      if (store.dirty || store.inflight || store.conflict) throw new Error('plan-save-pending');
      redraw(); return result;
    },
    redraw: redraw,
    resolveDraft: resolveDraft,
    // 分区清单的唯一事实来源：garden.js 靠它推导「除 garden 外的所有分区」
    // 来挂卸载钩子，不用另抄一份列表——抄的那份加分区时最容易忘改，忘改的
    // 后果是切换分区时遗漏花园视图的卸载。导出 .slice() 副本而不是活引用：
    // SECTIONS 本身还要拿去做 show() 的路由校验（indexOf 判断合法分区名），
    // 导出活引用的话外部一次 push/pop 就能连路由一起弄坏。
    sections: SECTIONS.slice(),
    ui: { modal: modal, closeModal: closeModal, confirm: confirmModal, dragList: dragList, notice: notice },
    ready: fetch(STORE_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('load failed ' + r.status);
        return r.json();
      })
      .then(function (data) {
        // 字面 null（HTTP 200）= 确实从没写过，才允许用空工作区起步
        if (data === null) { store.data = M.emptyWorkspace(); return store.data; }
        // 结构完全不认识时宁可锁死保存（落到 catch 的 lost 分支），也不能覆盖服务端那份
        if (typeof data !== 'object' || Array.isArray(data)) throw new Error('bad shape');
        // 缺字段就地补齐：meta 必须在，否则 save() 里 meta.rev++ 会同步抛错、静默停摆
        ['projects', 'tasks', 'notes', 'inbox'].forEach(function (k) {
          if (!Array.isArray(data[k])) data[k] = [];
        });
        if (!data.meta || typeof data.meta !== 'object') data.meta = { seqCounter: 0, rev: 0 };
        if (typeof data.meta.rev !== 'number') data.meta.rev = 0;
        store.data = data;
        return store.data;
      })
      .catch(function () {
        // 读不到已有数据绝不能拿空工作区顶上——下次保存会把服务端
        // 仅存的一份覆盖掉。锁死保存（见 touch），亮灯等人处理。
        store.lost = true;
        setDot('err', 'Load failed — saving disabled');
        return null;
      })
      .then(function (result) {
        // 无论成败都走到这一步，统一翻牌 dataReady 并补触发一次：
        // 成功时 store.data 非空，把「当前分区」已经注册的钩子（不管是启动时的
        // 默认分区，还是用户在数据到达前就点导航切走的分区）一次性摸一遍；
        // lost 时 store.data 仍是 null，dataReady 保持 false，什么都不触发。
        dataReady = !!store.data;
        if (store.data) { store.base = Sync.clone(store.data); restoreDraft(); }
        if (dataReady) fireAll(current);
        return result;
      }),
  };

  applyTheme();
  // 对齐分钟边界再进入固定间隔：顶栏时钟慢半分钟对一个「工作台」是破绽。
  // 休眠/切后台会让定时器漂移，回前台时立刻对一次时。
  setTimeout(function () {
    applyTheme();
    setInterval(applyTheme, 60000);
  }, 60000 - (Date.now() % 60000));
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) applyTheme();
  });

  // 顶栏 +New：任意分区都先切到 board，打开草稿，保存时才建卡。
  var newBtn = document.getElementById('new-btn');
  if (newBtn) newBtn.addEventListener('click', function () {
    if (!store.data) return;
    show('board');
    if (window.Tracer.newTask) window.Tracer.newTask('todo');
  });

  // 初始分区：?sec=notes 深链优先（截图/分享用），其次上次停留，最后 board。
  var initial = null;
  var sm = /[?&]sec=([a-z]+)\b/.exec(location.search);
  if (sm && SECTIONS.indexOf(sm[1]) >= 0) initial = sm[1];
  if (!initial) { try { initial = localStorage.getItem(LS_SEC); } catch (e) {} }
  show(initial || 'board');
  applyGardenHidden();
})();
