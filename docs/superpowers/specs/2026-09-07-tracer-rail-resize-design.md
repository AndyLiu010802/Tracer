# Tracer 皮肤：右栏可拖宽 + 随阅读面板显隐自动收起

日期：2026-09-07
状态：**已交付**（含 1 条待用户拍板的默认行为，见文末）

本文是事后补记的设计定稿——当时设计写在工作流脚本里，没有独立 spec 文件。

已落地提交：

| SHA | 内容 |
|---|---|
| `d026060` | feat：右栏可拖宽 + 随阅读面板显隐自动收起（`index.html` / `skin.css` / 新建 `rail.js` / `test/tracer-skin.test.js` 补 3 个测试块 / 4 个守护点） |
| `9e71a60` | fix：收起态下拖拽/键盘不再用渲染宽度当基准，避免污染存值与 inline |
| `caa2321` | fix：拖拽 capture 丢失时补挂 `lostpointercapture` 兜底结束 |
| `86ed1bc` | test：收紧收起态网格规则断言，堵住假绿 |
| `a6a67cb` | test：收起态断言补锚定值 `6px`，堵住第二轮假绿 |

注：`9e71a60` 与 `caa2321` 之间还夹着 `3d93d5a`（另一会话的魔法子系统 spec），**不属于本功能**——
上表是逐条点名，不要按提交区间取。

## 背景与目标

tracer 是三栏骨架：左导航 + 主区 + 右栏（`.rail`，内含阅读面板挂载点 `#aside-slot`）。
右栏宽度此前是写死的常量，读长文嫌窄、只当参考面板时又嫌占地方。本功能给右栏加两件事：

1. **手动拖宽**：右栏左缘一条把手，横向拖拽改宽度，宽度记住。
2. **自动收起**：阅读面板隐藏或切成浮窗时，右栏自己收成一条 6px 细边，把空间还给主区；
   面板回到停靠且可见时恢复原宽度。

新增文件只有一个：`skins/tracer/rail.js`（ES5，纯前端，零依赖）。阅读面板本身（`public/reader.js`
创建的 `.fx-panel`）**不改**——本功能单向读它的状态，不反向驱动它的实现。

## 设计

### 布局与网格

- `.shell` 网格第三列为 `var(--rail-w, 392px)`：
  `grid-template-columns: 236px minmax(0, 1fr) var(--rail-w, 392px)`。
- 窄视口断点 `@media (max-width: 1100px)` **在 `.shell` 上声明 `--rail-w: 320px`**，
  而不是硬改 `grid-template-columns`。这样用户拖出来的 inline `--rail-w`（写在 `.shell`
  的 style 上）天然以 inline 优先级盖过断点，两者不打架。
- 收起态：`.shell[data-rail="collapsed"] { grid-template-columns: 236px minmax(0, 1fr) 6px; }`，
  同时 `.rail` 去掉 padding 与左边框、`.rail-grip` 铺满那 6px（否则收起后会多出一条缝，
  且把手会窄到点不着）。

### 把手 `.rail-grip`

- 标记：`role="separator"`、`aria-orientation="vertical"`、`tabindex="0"`、
  `title="Drag to resize &middot; double-click to toggle"`。
- 定位 `position:absolute; left:0; top:0; bottom:0; width:6px; touch-action:none`。
  **贴在右栏左缘内侧，不用负偏移**：`.rail` 是 `overflow-y:auto`，纵向 auto 会把横向也
  变成裁剪轴，负 `left` 的把手要么被裁掉要么催生横向滚动条。
- 视觉上默认几乎不可见，只在 hover / `.is-dragging` / `:focus-visible` 时用 `::after`
  画一条 2px 的 accent 细线。

### 拖动改宽

- 钳位区间 `[MIN, getMax()]`，`MIN = 320`，
  `getMax() = Math.max(320, Math.min(760, innerWidth - 236 - 420))`
  （236 = 左导航列宽，420 = 主区可用宽度底线，760 = 封顶，不让参考面板反客为主）。
- `resize` 事件重新走一遍 `applyWidth()`，视口变窄时已存宽度跟着重新钳位。
- 持久化：localStorage `tracer.railWidth`（只存宽度这一个偏好）。
- 拖动期间给 `document.body` 加 `.is-resizing`：
  `cursor: col-resize; user-select: none;` 外加
  `body.is-resizing #aside-slot iframe { pointer-events: none; }`
  ——iframe 会截获落进自己范围的 `pointermove`，只靠把手的 `setPointerCapture` 不够，
  指针一划进面板拖拽就断。
- `pointerdown` 只认主键（`if (e.button) return`）。
- `dragMoved` 标志区分「纯点击」与「真拖拽」：没有发生过 `pointermove` 就松手，
  不算一次改宽度操作，也不触发收起判定。

### 「想收起」判定与键盘

- 拖到很窄松手 → 视为想收起：判定看**未经钳位的原始宽度** `dragRawWidth < 200`。
  此时**不落地这个宽度**（否则下次展开卡在极窄），而是 `applyWidth()` 复原到 `curWidth`；
  `curWidth` 为 null（用户从未拖过）则**清掉 inline 变量**，把决定权交还 CSS 默认值/断点。
  收起动作本身走 `postMessage({ __aside: 1, type: 'bosskey' }, '*')` 切换阅读面板显隐，
  收起态由下面的 observer 联动推导出来。
- **双击把手**、把手聚焦后 **Enter / Space** 走同一个入口（`postBosskey()`）。
- 方向键 ±16px：**← 变宽 / → 变窄**——把手在右栏左缘，指针左移让右栏变宽，按键跟手感对齐。
- **Home** → `MIN`（320），**End** → `getMax()`。两者都落地并持久化。

### 收起态：从面板真实状态推导，不另设开关

- 收起态**没有自己的持久化开关**，它整个是从 `#aside-slot` 里阅读面板的真实状态推导出来的：
  `MutationObserver` 监听 `#aside-slot`，
  `{ childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'data-mode'] }`；
  回调里取 `.fx-panel`，
  `panel.style.display === 'none' || panel.getAttribute('data-mode') === 'float'`
  → `.shell[data-rail="collapsed"]`，否则 `data-rail="open"`。
- **面板未插入时（`.fx-panel` 不存在）直接 return，维持缓存值不写**——rail.js 执行时
  reader.js（defer）还没跑，`#aside-slot` 是空的，此刻不能下判断。
- **首帧闪烁**：rail.js 同步执行阶段先读 localStorage `tracer.railCollapsed` 应用上一次结果，
  避免面板插入前先按默认展开画 392px、插入后又突然收起闪一下。缓存既不是 `'1'` 也不是 `'0'`
  （第一次访问）时不写 `data-rail`，交给 observer 的第一次真实判定，不用瞎猜的默认值污染偏好。

### `curWidth`：宽度的唯一事实来源

`curWidth` 是模块内单一变量：`null` = 用户从未设置过（交给 CSS 默认值/断点，不写 inline），
否则就是用户选定的偏好值。**它未必等于当前渲染宽度**——收起态渲染宽度是 6px。

因此拖拽/键盘的「起点宽度」一律读 `curWidth`（为 null 时才回退 `rail.getBoundingClientRect()`），
并且**收起态下 `pointerdown` / 方向键 / Home / End 直接不作为**：那 6px 不是可用基准，
拿它当起点会把「无意义的 6」当成用户想要的宽度写回存储和 inline。收起态只认双击 / Enter / Space
展开，展开之后再来一次才是合法的拖拽起点。（这一条是 `9e71a60` 修的。）

### 拖拽结束的兜底

pointer capture 可能在没有 `pointerup` / `pointercancel` 的情况下丢失（例如拖动中窗口失去输入焦点）。
只监听 up/cancel 会让 `dragging` 与 `body.is-resizing` **永久卡住**——iframe 一直没有 pointer-events、
整页不可选中，且此后仅悬停把手就会用过期的 `dragStartX` 改宽度。
所以 `lostpointercapture` 也挂同一个 `endDrag`；`endDrag` 开头有 `!dragging` 早退，幂等，
多绑一次不影响正常路径。（`caa2321`。）

### 加载顺序与工程约束

- `rail.js` 以**普通（非 defer）脚本**在 `app.js` 之后加载。它依赖的 `.shell` / `.rail` /
  `.rail-grip` / `#aside-slot` 都是静态标记且排在该 `<script>` 之前，执行时已在 DOM。
- 它天然早于 `reader.js`：后者由 `server.js` 以 `<script src="/reader.js" defer>` 注入在
  `</body>` 前，defer 脚本要等文档解析完才执行（tracer 的 `index.html` 里没有 reader.js 标签）。
- 皮肤 JS 一律 ES5：`var` / `function`，不用箭头函数、`let/const`、模板串。
- 四个静态标记任一缺失就整体 `return`，不抛错。

## 两处对原设计文字的偏离（已定稿）

两处都经两轮审查独立验证为必要，作为定稿写入本文：

1. **收起态不给 `#aside-slot` 加 `display:none`。**
   float 模式的浮动面板仍然是 `#aside-slot` 的子节点。祖先 `display:none` 会把
   `position:fixed` 的浮窗也一并从渲染树摘掉（fixed 逃不开这个），浮窗会跟着右栏一起消失，
   违背「浮动态本该独立于右栏可见」的初衷。dock 态的隐藏则已经由面板自己的
   `style.display:none`（reader.js 的 `applyHidden`）盖住，这里再扣一层没有必要；
   dock + hidden 场景实测无可见瑕疵。

2. **`<200` 判定用未经钳位的原始宽度。**
   钳过的宽度最小就是 320，永远到不了 200，按字面写是死代码。

## 审查实证摘要

质量审查三轮 + spec 符合性两轮（均 ✅）：质量第 1 轮 2 条 important（同一根因：收起态拿渲染宽度
当基准）→ `9e71a60` 修；第 2 轮 1 条 important（capture 丢失卡死）→ `caa2321` 修；
第 3 轮独立复核：53 条 Playwright 断言全过，但查出一处守护断言假绿（见下文「测试」注），
`86ed1bc` / `a6a67cb` 收紧。实证覆盖：拖动经过 iframe 不中断；
四个分区 × {900, 1000, 1100, 1400} 视口 × {展开到 MAX, 收起} 无横向溢出；
缓存 collapsed 在面板插入前生效、全程无 open 闪烁；拖右栏 40 步期间 observer 0 次触发；
钳位 / 断点 / resize 往返不丢偏好；把手 Tab 可达、键盘行为全部正确。

## 测试

`test/tracer-skin.test.js` 末尾 3 个测试块、4 个守护点（第三个块内含多条 assert：
状态码、持久化键、脚本顺序），逐个守护点做过「改坏必须变红」的负向验证：

| 守护点 | 内容 |
|---|---|
| 右栏宽度走 CSS 变量，且有收起态的网格规则 | `skin.css` 引用 `var(--rail-w`；有 `.shell[data-rail="collapsed"]` 的 `grid-template-columns` 规则，且锁住 `6px` |
| index.html 含拖拽把手，带 role=separator | `class="rail-grip"` 存在，且同一标签上带 `role="separator"` |
| rail.js 可访问且实现宽度持久化 | `/rail.js` 返回 200 且包含 `tracer.railWidth` |
| 脚本顺序 | `index.html` 里 `src="/app.js"` 的位置早于 `src="/rail.js"` |

注：其中「收起态网格规则」那条原本是**全文件子串匹配** `/\[data-rail="collapsed"\]/`
（连 `.shell` 前缀都不带）——`[data-rail="collapsed"]` 在 `skin.css` 中出现 3 次
（第 164 行的网格规则、296/297 行的 `.rail` / `.rail-grip` 收起样式），
只改坏关键的那条网格规则并不会变红（假绿）。第三轮复核发现后
先由 `86ed1bc` **收紧为锚定规则体**，再由 `a6a67cb` **锁住 `6px` 这个值**（否则把 6px 改成 392px
仍然绿）。

## 记入后续的 minor（照实列，未修）

- `applyCollapsed` 每次 observer 回调都无条件 `setAttribute` + 写 localStorage。
  浮动面板拖动 40 步 → 40 次写。应记住上次值，未变则直接返回。
- `getMax()` 的主区 420 底线对 **Garden**（190px 固定左列）与 **Board** 四列偏紧：
  1400 视口下右栏拉到 744 时，Garden 内层横向溢出、键盘只剩 3 列，Board 卡片断词。
  建议把主区底线提到 ~560 或把封顶降到 ~700。属设计常量问题，不是实现错误。
- 把手缺 `aria-valuenow` / `aria-valuemin` / `aria-valuemax`（可聚焦的 separator 按 ARIA 应当提供）；
  可达名称只靠 `title` 兜底（accname 的最后一档），没有 `aria-label`。
- 收起态 `pointerdown` 的 `return` 排在 `e.preventDefault()` 之前 → 拖那 6px 把手会起页面文字选区。
  （拖开本身是 YAGNI，见「明确不做」。）
- `body.is-resizing { cursor: col-resize }` 盖不过页内元素级 `cursor`（pointer / grab）：
  拖到极值钉住后指针落到卡片上，光标会变回卡片自己的。可用
  `body.is-resizing * { cursor: col-resize !important }`。
- 慢脚本下的理论闪烁：收起缓存由排在 `model.js` / `app.js` 之后的同步脚本应用，
  前面的脚本阻塞解析时可能先画 392px 再收起（人为把 `/app.js` 延迟 1200ms 可复现）。
  可选加固：在 `.shell` 开标签之后内联两行读缓存。
- 既有问题（**非本功能引入**）：timeline 首月 `.tl-month` 标签用负百分比定位；
  右栏收起后时间轴变宽，标签向左探出主区左缘，露出被裁的「026」。

## 待用户拍板

「阅读面板**自动**隐藏（失焦 / 空闲）时右栏跟着收成 6px」这条联动，是按伪装效果最优推荐的默认行为，
用户尚未表态。

若嫌切窗回来布局跳，改成「只有手动收起才收右栏」**不是 `onSlotChange` 里加个判定这么简单**：
`reader.js` 的 `applyHidden()` 只写 `el.panel.style.display`，`toggleHidden()`（手动）与
`maybeConceal(reason)`（失焦 / 空闲）两条路径落到 DOM 上的写入**完全一样**，没有任何原因标记，
观察者现在只看得到 `display:none`。要区分就得让 `applyHidden()` 额外在面板上写一个
`data-hidden-reason`（`bosskey` / `blur` / `idle` 等——`maybeConceal(reason)` 已有 reason 参数可透传），
`onSlotChange` 把它加进 `attributeFilter` 之后才分得清。这会破掉本功能「不改阅读面板」的约束
（见上文「背景与目标」），需一并确认。

## 明确不做（YAGNI）

- 从收起态直接拖开（用双击 / Enter / Space 展开代替）。
- 右栏拖到 0 隐藏（用面板 toggle 代替，语义更单一）。
- 宽度偏好同步到其它皮肤（`tracer.railWidth` 只属于 tracer）。
