# Tracer 皮肤开发 · 接手文档（阶段 6 + 桌面打包 已完成）

> 上一个会话被安全分类器卡住（无法执行命令），换新会话继续。本文件是冷启动接手说明。

## 仓库

`<repository>` —— 本地「上班摸鱼阅读器」，零 npm 依赖纯 Node。
把小说站代理进一个伪装页面的右栏小窗；伪装可信度与快速隐藏能力和阅读功能同级重要。

---

## 已完成：编码路径穿越安全修复（commit `f64d61e`）

`GET /fish/..%2fcontent.js` 曾在 tracer 皮肤下返回 `skins/db-console/content.js`（含真实项目名与
Supabase schema）。根因：`pathname` 在 `decodeURIComponent` 之后从未重新规范化——`new URL()` 只折叠
**字面** `../`，`..%2f` / `..%5c` 解码后才变成 `../`，此时前缀判断 `indexOf('/fish/')===0` 仍成立，
`safeJoin` 又只把结果夹在 GAME_DIR 内。修复：decode 后把  归一成 /，再 `path.posix.normalize`。

**收这个修复时发现的坑（值得记住）**：原本写好的两条回归测试是**假绿**的——它们跑在 docs-portal 皮肤下，
而 docs-portal 自带 `content.js`/`skin.css`，请求被皮肤分支先接走，根本走不到兜底分支，把修复注释掉
照样全绿。泄漏回归测试已挪到 **tracer 皮肤**（tracer 没有 content.js，正是漏洞现场），
并做过「注释掉修复必须变红」的实证。`server.test.js` 另用只有 db-console 才有的 hero.webp/arena.webp
守白名单边界。**今后每条安全回归测试都要做这个负向验证。**

附带：`store.test.js` 的「编码的斜杠混不进名字」随规范化调整——`x%2F..%2Fy` 现在规范化成合法名字 `y`
（仍夹在 DATA_DIR 内），改为断言 `x%2Fy` 与 `..%2F..%2Fescaped` 各自被拒 + 落盘位置没跑出 DATA_DIR。

---

## 项目现状

Tracer 是新的伪装皮肤（`skins/tracer/`）：Linear 风深色**工程工作台**，设计主题「日月轮回·晨昏流转」
（accent 随真实时刻在琥珀/鎏金/绛紫/靛银四段轮转，顶栏日晷+真实月相，进度用月相图标）。
与旧的 db-console（Supabase 伪装，已冻结）根本不同：**分区全部真实可用**，屏幕上是真实工作痕迹。

**阶段 1–5 已交付**（全部经 spec 审查 + 质量审查，多轮探针/Playwright 实证）：

| 阶段 | 内容 |
|---|---|
| 1 | 壳 + 主题引擎 + `/api/store` 存储（lib/store.js：写队列串行化、`.bak` 校验备份、坏档 409）+ model.js + app.js（inflight/failed/lost 状态机、onShow dataReady 契约） |
| 2 | Board 四列看板（建卡/编辑/删除/pointer 拖拽换列换序）+ Inbox 速记 + 侧栏项目列表与过滤 + 顶栏 `+ New` |
| 3 | Notes（清单 + 手写 Markdown 编辑器、`Ctrl+E` 编辑/预览、自动保存）；渲染器安全（整行 esc 后套白名单标签 + 占位符 tokenizer + 协议白名单），40 payload 真实浏览器 0 XSS |
| 4 | Planner（本周 7 天 + 未安排托盘、拖拽排期、翻周）+ Timeline（项目横条铺月刻度、进度叠加、今天竖线、点横条设起止） |
| 5 | Project Map（SVG 脑图树：workspace 根→项目→任务叶、贝塞尔连线、月相完成度、折叠、画布平移）+ Insights（统计卡片、每周完成柱状图、任务状态条形列表） |

七个分区全部真实可用；**Garden（游戏）分区已落地**（阶段 6 Task 2）。
右栏（阅读面板所在列）**可拖宽、随面板显隐自动收起**（2026-09-07，rail.js），设计定稿见
`docs/superpowers/specs/2026-09-07-tracer-rail-resize-design.md`。

**演示数据**：`data/workspace.json`（gitignored）已灌了 2 项目 / 5 任务 / 2 笔记 / 2 收集项，
项目带起止日期、任务带排期，方便直接看效果。深链参数：`?sec=board|notes|planner|timeline|map|insights`、
`?phase=dawn|day|dusk|night`（预览时段）。

---

## 阶段 6 计划与架构决策

计划文件：**`docs/superpowers/plans/2026-09-03-tracer-phase6-garden-default.md`**（已提交，含逐字代码）。

### 核心架构决策（用户已拍板：共享一份源）

农场游戏（farm.js 74KB + fishing/combat/equip + farm.css + fish/scenes 资源）**物理留在
`skins/db-console/`** —— 那是**另一个会话正在高强度开发**农场的地方（最近提交全是锻造/装备/掉装）。
server.js 加了「游戏文件从 GAME_DIR（=skins/db-console）兜底服务」的回退，于是两个皮肤加载
**同一份** farm.js，Tracer 的 Garden 自动拿到农场那边的最新迭代，**零复制、零 fork**。

- **本阶段绝不碰 `skins/db-console/` 任何文件**（并行会话的开发地，动了会冲突）。
- localStorage 存档键 `dbconsole.farm.v3` 同源共享 —— 一份农场进度，两个皮肤通用。
- 物理搬到中立 `games/` 目录（唯一会与并行会话冲突的一步）**留到农场那边告一段落再做，本阶段不做**。

### Task 1 —— 已完成（`2a7775f`），安全修复已收（`f64d61e`，见上）

### Task 2 —— Garden 分区 ✅ 已完成（`6afa5db` 实现 + `1d68ac6` 审查后修复）

- `skins/tracer/index.html`：加 Garden 导航项（`data-sec="garden"`、`id="nav-garden"`、芽图标）；
  加 `#sec-garden` 分区（内含 `#garden-shop` 商店侧 + `#garden-main` 游戏主区，外加 hidden 的
  `#rail-label`/`#definition` 占位供 farm 的 renderRail null-safe 使用）；
  link `/farm.css` + `/garden.css`；**在 `app.js` 之后、其余视图脚本之前**插入游戏引擎脚本
  （顺序 `fishing → combat → equip → farm`，与 db-console 一致）；最后挂 `/garden.js`。
- `skins/tracer/app.js`：`SECTIONS` 加 `'garden'`；加 **Ctrl+Alt+G boss-key**（隐藏 Garden：
  导航项消失、正停在游戏则跳回上一分区、`localStorage` 持久化）。
  **关键**：farm.js 自己也把 Ctrl+Alt+G 绑成「切换伪装文案」并在 document 捕获阶段监听；
  Tracer 的处理器必须在 app.js 里注册（app.js 早于 farm.js 加载，捕获阶段按注册顺序触发），
  并 `e.stopImmediatePropagation()` 抢先屏蔽 farm 的文案切换。
- `skins/tracer/garden.js`（新）：`T.onShow('garden', mount)` 挂 `window.DBFarm.mount(gardenMain, gardenShop)`；
  给其余七个分区各注册一个 `T.onShow(sec, unmountIfMounted)` 做对称卸载（**别用包装 `T.show` 的方案**，
  app.js 内部导航不一定经过 `T.show`）。
- `skins/tracer/garden.css`（新）：`.garden-wrap` 两栏（190px 商店 + 1fr 主区）；
  **必须包含** `.nav-item[hidden] { display: none; }` —— `.nav-item` 有 `display:flex`，
  会盖过 UA 的 `[hidden]{display:none}`，不加这条 boss-key 隐藏不生效（计划里已写明）。

### Task 3 —— Tracer 转正 ✅ 已完成（`7568697` 实现 + `09dd997` 审查后修复）

- `server.js` 的 `DEFAULTS.skin` → `tracer`；`local.config.example.json` 同步。
- **`dev/verify.js` 无需改动**（核实：第 90 行已写死 `DOCS_PORTAL_SKIN='docs-portal'`，在 require server.js 之前）。
  所有测试文件也都显式设了皮肤，改 DEFAULTS 不影响它们。
- `desktop/main.js`：默认皮肤 → tracer；窗口标题 → `'Tracer — Engineering'`；tooltip → `'Tracer'`；
  托盘图标素材未换（留了 TODO 注释）；两处过时注释更新。
- `README.md`：皮肤表加 tracer 并标默认；开头的身份描述与第 40 行的伪装论证按「默认是深色工作台」重写
  （原文按 docs-portal 写的，论证正好反过来）；结构块补上三套皮肤；农场小节覆盖两个入口；
  新增共享一份源与 `Ctrl+Alt+G` 两段；清掉 4 处禁词。
- `loadConfig` 改成可注入 `(root, env)`，测试从「同义反复」改成测真实合并路径 + 优先级顺序。
- `/api/state` 的 POST 纳入 `DOCS_PORTAL_READONLY_STORE` 守卫（原先只读开关的注释在过度承诺）。
- `garden.css` 藏掉农场状态栏硬编码的 `role: postgres`（db-console 残留装饰漏进默认皮肤）。

**⚠️ 本机注意**：`local.config.json`（gitignored 个人配置）仍写死 `"skin": "db-console"`，
而优先级是 `环境变量 > local.config.json > DEFAULTS`，所以**这台机器上裸跑 `node server.js` /
双击 start.bat 打开的仍是 db-console**。这是预期行为，没动那份配置——它很可能正被并行开发农场的
会话使用。要在本机看到 tracer：改那份配置的 skin，或 `DOCS_PORTAL_SKIN=tracer node server.js`。

**桌面版首次真实启动验证通过**（此前只做过语法检查）：窗口标题、tracer 皮肤（8137 端口、
8 个导航项、零处 "Supabase"）、Garden 可玩、托盘 tooltip、关窗缩托盘、单实例锁，六项全过；
`GAME_DIR` 兜底链路在 Electron 下同样成立。

---

## 阶段 6 已全部完成

| Task | 内容 | 提交 |
|---|---|---|
| 安全修复 | 编码路径穿越（含假绿测试修正） | `f64d61e` |
| Task 1 | 游戏资源 GAME_DIR 兜底服务 | `2a7775f` |
| Task 2 | Garden 分区 + Ctrl+Alt+G boss-key | `6afa5db` `1d68ac6` `f01e78b` |
| Task 3 | 默认皮肤转正 + 桌面版品牌 + README | `7568697` `09dd997` |
| 配套 | 演示数据种子脚本 + 只读存储开关 | `0fa66b1` |

## 下一步

阶段 7：`Ctrl+K` 命令面板（搜任务/笔记标题、跳分区）。

---

## 桌面打包 ✅ 已完成（2026-09-04）

计划：`docs/superpowers/plans/2026-09-04-desktop-packaging.md`（五个 Task 全部完成）。
桌面版从「只能 `cd desktop && npm start` 的开发态」变成了**可安装的 NSIS 安装包**。

| Task | 提交 | 内容 |
|---|---|---|
| 1 | `ff96ea2` | `server.js` 加 `DOCS_PORTAL_STATE_FILE` 覆盖点（顺带修掉「跑测试污染真实 bookmarks.json」） |
| 2 | `95eb999` | `desktop/main.js` 把 DATA_DIR/STATE_FILE 指向 `app.getPath('userData')` |
| 3 | `3165ed2` | `desktop/migrate.js` 存档迁移；`name` → `tracer-desktop` |
| 4 | `afb8686` | **应用根挪到仓库根** + electron-builder 配置，产出 `dist/Tracer Setup 0.1.0.exe` |
| 5 | `32616b8` | README ×2 更新；`appId` 去掉真名；`author` 设为 Tracer |

### 结构变化（重要）

- **依赖树在仓库根**，不再在 `desktop/`。`desktop/node_modules` 与 `desktop/package-lock.json` 已删，
  `desktop/package.json` 退化成说明性指针。根目录 `npm install` / `npm start` / `npm run dist`。
- **核心仍是零依赖**：`node server.js` 裸跑不需要任何 npm 包；根 `package.json` 只服务桌面壳与打包。
- 桌面版存档在 `%APPDATA%\tracer-desktop\`（含 `Local Storage`、`data/`、`bookmarks.json`），**与网页版分开**。

### 🚨 动 `package.json` 的 name/productName 之前必读

**`app.getPath('userData')` = `appData/app.getName()`，而 `app.getName()` 取自应用根 package.json 的
`productName`（若有）否则 `name`。** 实测三组对照确认：

| package.json 写法 | `app.getName()` | userData |
|---|---|---|
| 只有 `name` | = name | `%APPDATA%\<name>` |
| 顶层加 `productName` | **被它覆盖** | `%APPDATA%\<productName>` ⚠️ |
| `name` + 嵌套 `build.productName` | 仍 = name | `%APPDATA%\<name>` ✅ |

所以根 `package.json` **只有顶层 `name: "tracer-desktop"`，绝不能加顶层 `productName`** ——
一加，userData 就漂走，农场存档立刻变孤儿。显示名走 `build.productName`（只影响安装包与 exe 命名）。

`desktop/migrate.js` 负责从旧名字（`podmatrix-desktop`）一次性搬迁：幂等、复制不移动、失败不阻塞启动。
**保留至少一个版本周期**，文件里有 TODO 写明何时可删。

### 验收实证（都是真机跑出来的，不是推理）

装完核对：开始菜单/桌面快捷方式/卸载列表全显示 **Tracer**；窗口标题 `Tracer — Engineering`；
加载 tracer 皮肤（8 导航项、无 "Supabase"）；**userData 仍是 `%APPDATA%\tracer-desktop`**；
**农场存档完好**（coins 98 / xp 8976 / harvested 394 / earned 36294 / day 2026-9-4 逐字段一致）；
Garden 游戏资源经 asar 内 `GAME_DIR` 兜底全部 200（`skins/db-console/` 144 个条目都在包里）；
`uiohook-napi` 正确 unpack 到 asar 外；卸载后安装痕迹全清、两个存档目录原封不动。

**存档备份**（迁移前，逐字节校验）：`<private-backup-directory>`
同目录有 `farm-fingerprint-before.json` 是正确基线。
⚠️ 核对存档时**只比 coins/xp/harvested/earned/day** —— `taps`/`clicks`/`keys` 会随时间增长，
因为全局输入钩子在后台一直数你敲的键，那是功能不是异常（曾因此误判过一次）。

### 遗留项

- **托盘菜单「退出」没做端到端点击验证**（环境无 GUI 点击自动化）。用代码走查 +
  CDP 触发 `window.close()` 确认「关窗只隐藏不退出」做了等价验证。首次实际使用时留意。
- **SmartScreen 的准确说法**：本地构建产物**不带** Mark-of-the-Web，本机构建本机安装大概率**不弹**；
  那个警告由「从网上下载」标记触发，不是「未签名」本身。传上网再下回来运行才会弹。
- `npm audit` 报 2 个 high，都在 electron-builder 的**构建期**工具链间接依赖里，不进最终 asar。
- 打包后无法改 `local.config.json` 切皮肤（双击启动的应用改不了环境变量）。要切得在托盘菜单加子菜单，未做。
- 代码签名、自动更新、macOS/Linux 打包、portable 绿色版：均未做（用户只要 Windows NSIS）。

---

## ✅ 2026-09-07 收尾 —— 已完成（原「🔴 待收尾」四项，按 1→3→2→4 做完）

| # | 项 | 结果 | 提交 |
|---|---|---|---|
| 1 | 右栏可拖宽 + 随阅读面板显隐自动收起：补文档 | 设计定稿写成独立 spec **`docs/superpowers/specs/2026-09-07-tracer-rail-resize-design.md`**（设计、两处定稿偏离、审查实证、测试、后续 minor、待拍板项、明确不做）；`README.md`「手势」表加 4 行（把手拖宽 / 拖窄收起 / 双击切换 / 键盘）。journal 复核：无 `refuted:true`，但第 3 轮质量复核有 1 条 important 未处理——「收起态网格规则」断言假绿（字面串在 skin.css 出现 3 次，只改坏关键规则不变红），已收紧两次 | 文档随本节提交；`86ed1bc`（锚定规则体）+ `a6a67cb`（锁住 `6px` 值） |
| 3 | 仓库根三个杂散 PNG | `git status` 确认 `??` 后删除，未动其它文件 | 无需提交 |
| 2 | `isGameAsset()` 白名单补全 | 按「先改夹具再改 server」顺序做完，带负向验证（撤全部 / 只撤目录 / 只撤顶层，三组各自变红）与 tracer 冒烟（七类 200 `image/webp`，`/content.js` 与各编码穿越变体仍 404）。**质量审查发现交接方案第 2 步规定的 server.test.js 用例是零守护力**（规范化与白名单同时拆掉仍绿：`..%2f..%2fdb-console%2fcontent.js` 是文件不存在才 404，`/mobs/..%2fcontent.js` 被 docs-portal 自己的 content.js 在皮肤分支接走）——docs-portal 皮肤下拿真实 db-console 构造不出泄漏。补了 `test/game-fallback.test.js`（`DOCS_PORTAL_GAME_DIR` 指临时目录 + 哨兵文件，规范化/白名单单拆、双拆都红），tracer 的正向测试改成**文件系统漂移守卫**（枚举 GAME_DIR 所有含 .webp 的子目录与顶层 .webp，农场新增美术目录没同步白名单会立刻红——server.js:64-66 那句注释的可执行版本）。审查建议的 `isGameAsset` 加 `.endsWith('.webp')` 收窄**未采纳**：会再造一个要与农场同步的清单，正是本 bug 的成因。注：`..%5c` 那条穿越断言的变红依赖 win32 路径语义，POSIX 上退化为冗余覆盖，另两条跨平台有效 | `543b9c2`（白名单 + 夹具）+ `7ad5173`（哨兵夹具 + 美术漂移守卫）+ `27aea54`（引擎脚本轴漂移守卫：index.html 引用的每个 .js 必须可取，`GAME_FILES` 漏配立刻红） |
| 4 | 本节改「已完成」并提交文档 | 本节 | 随文档提交 |

**右栏功能仍开着的一个决定（用户尚未表态）**：「面板自动隐藏（失焦 / 空闲）时右栏跟着收成 6px 细边」是协调者按伪装最优推荐的默认行为。
交接原文说改成「只有手动收才收」是 `onSlotChange` 一个判定条件的事，**这个估计是错的**：`public/reader.js` 的 `applyHidden()`
只写 `style.display`，手动 `toggleHidden()` 与自动 `maybeConceal(reason)` 落到 DOM 上完全一样，观察者分不出原因；
要区分得让 `applyHidden()` 写 `data-hidden-reason` 并加进 rail.js 的 `attributeFilter`，会破掉「本功能不改阅读面板」的约束。
拍板改法时 `README.md` 手势表新增的第一行「面板隐藏或切成浮窗时右栏自动收成一条细边」要同步改。细节见 spec 末尾「待用户拍板」。

右栏的 7 条后续 minor（observer 无变更守卫、主区 420 底线偏紧、aria-value*、收起态拖把手起文字选区、`is-resizing` 光标、慢脚本闪烁、timeline 首月标签既有问题）已全部移入该 spec，本文件不再重复。

---

## 其他已记录的后续项

- **Insights 的「Keyboard heatmap · Focus rounds」占位卡**（现显示 "Unlocks with Garden"）：
  数据源是农场的按键计数/番茄钟（localStorage `dbconsole.farm.v3`），Garden 落地后另做小任务接上。
- **键盘可达性**：导航项/卡片/Map 节点有 `tabindex` 但缺 Enter/Space 处理，全局遗留项，某阶段统一补。
- 农场在 Tracer 里可能显示 keyspace 黑话文案（farm 默认伪装态）；农场自己 UI 的 🌱 按钮可切成农场文案。
  改默认值要碰 farm.js，等能碰时再说。

### 阶段 6 Task 2 质量审查记入后续的项（审查报告有逐条实证，编号沿用报告）

- **M2 AltGr 误触发 boss-key**：Windows 上 AltGr **就是** Ctrl+Alt，所以 `ctrlKey && altKey && code==='KeyG'`
  会被 AltGr+G 命中（已用合成事件实测翻转）。在 AltGr+G 是合法字符的布局（德语/波兰语/US-International）上，
  boss-key 会误触发且 `preventDefault()` 吃掉字符，隐藏状态还会持久化。修法：加 `!e.getModifierState('AltGraph')`。
  注：这是 `farm.js:1439` 就有的问题（那里注释写「不受键盘布局/AltGr 影响」，在 AltGr 这半句上是错的），Tracer 继承了它。
- **M3 `key`/`code` 并集在非 QWERTY 上多造一个热键**：Tracer 判据 `code==='KeyG' || key==='g'|'G'` 是 farm 判据
  `code==='KeyG'` 的严格超集——**这正是抢占在任何键盘布局下都成立的原因**（好事），但 Dvorak 上因此有两个物理键
  能隐藏 Garden，且与 farm 的判据静默分叉。要么去掉 `e.key`（只靠 `code` 抢占依然成立），要么写注释声明超集是刻意的。
- **M5 🌱 按钮 tooltip 在 Tracer 里撒谎**：`farm.js:1196` 渲染 `title="Switch labels (Ctrl+Alt+G)"`，
  而这个键在 Tracer 里是隐藏 Garden。不动 db-console 就没法根治，可在 Tracer 侧覆写 title。
  **对伪装本身不利**（一个自曝式的文案矛盾）。
- **M6 重复点 Garden 会做一次完整拆装**而不是空操作：`farm.js:1522 unmount()` 会 `save()`（整个 state 序列化 +
  localStorage 写），mount 再重建 innerHTML、重启定时器。而 `DBFarm.mount` 本身已自保（`farm.js:1510`），
  `garden.js` 那道守卫是重复的。改成 `if (mounted) return;` 更便宜也更简单。
- **M7 卸载后农场 DOM 残留**：切走后 `#garden-main.children.length === 4`（`farm.js:1522` 不清 DOM）。
  因为 `.sec` 是 `display:none` 所以不可见无害，但游戏面板实打实躺在「工作台」的 DOM 里。
  `maybeUnmount` 里加一行 `main.innerHTML = ''` 即可。
- **M8 窄窗口塌陷**：`#garden-main` 宽度 1440→554、1100→286、900→86（横向溢出 31）、760→0（溢出 117）。
  固定 190px 的商店轨道压过 `minmax(0,1fr)`。与 `notes.css:5` 是同一既有模式，但游戏有 textarea 没有的硬性最小宽度。
  `minmax(360px,1fr)` 或给 `.garden-main` 加 `min-width` 就能退化成滚动而不是塌陷。
- **M4（已补注释，行为未改）**：`stopImmediatePropagation()` 顺带打掉了 `reader.js:411` 的 `noteActivity`
  （自动隐藏的挂机计时）。影响可忽略，但**今后任何在 app.js 之后注册的全局快捷键都会静默失去这个键**。
- **CSS 撞车需要定期重做交叉核对**：`#sec-garden` 下那批「防撞车」规则（`.col`/`.grid`/`.statgrid` 等）是一次性
  交叉核对的产物——把 farm/fishing/combat/equip 实际发出的 class 与 Tracer 各 CSS 文件比对。
  **db-console 那边或 Tracer 这边任一新增类名，都需要重做一次这个核对**。这是「共享一份源」架构的持续成本。

### 演示数据事故与防复发（阶段 6 期间发生）

- 某个子代理起 server 时没设 `DOCS_PORTAL_DATA_DIR`，用真实浏览器点了「+ New」，把 `data/workspace.json`
  写坏了——丢了 5 个任务 / 2 条笔记 / 2 个收集项。它被 gitignore 挡在版本控制外，store 的 `.bak` 只保留一代
  且同样是污染后的状态，**没有任何恢复点**。
- 已补两条措施（commit `0fa66b1`）：
  - **`dev/seed.js`** —— 那个缺失的恢复点。`node dev/seed.js --force` 重灌演示数据；数据全走
    `skins/tracer/model.js` 的真实 API 生成，日期相对「今天」算，所以随便哪天跑 Planner/Timeline/Insights 都是满的。
  - **`DOCS_PORTAL_READONLY_STORE=1`** —— `/api/store/*` 一律拒写（读不受影响，回 403）。
    **今后派探针/审查子代理，起 server 一律要求同时带 `DOCS_PORTAL_DATA_DIR` 和这个开关**：
    前者是纪律，后者是「忘了设也写不坏」的兜底。


### 阶段 6 Task 3 审查记入后续的项

- **`desktop/main.js:63` 的 `title:` 选项在页面加载后就失效**。审查实测：改 `document.title` 会立即改掉
  操作系统窗口标题，所以实际生效的是 `skins/tracer/index.html:7`，只是两者字符串恰好相同。
  今天无害（它还覆盖了页面加载前的一瞬），但这是一处**未声明的重复**——改了皮肤的 `<title>`，
  `main.js` 就会静默地跟它不一致。要么加注释说明「页面赢」，要么去掉这个选项。
- **README 皮肤表之后的信息架构**：表格现在以 tracer 打头（读起来顺），但紧接着 db-console 有一整段
  专门讲它的分区，默认皮肤反而只有表格里一个格子；再往下农场小节又把非默认的 Queues 放在前面。
  十行之内顺序信号翻转两次。另外「Garden 是从 db-console 共享过来的」那段落在「没做原作的装修、
  动物服装和联机」这句收尾话之后，读起来像附言，挪到两个入口刚介绍完的位置更自然。
- **测试会写仓库根的真实 `bookmarks.json`**。`STATE_FILE`（`server.js:47`）钉死在 `ROOT`，
  不受 `DOCS_PORTAL_DATA_DIR` 重定向，所以跑测试会改动这个 gitignored 的真实文件
  （`test/store-readonly.test.js` 的注释里已记下「其它测试文件也在并发改写它」）。
  **桌面打包计划的 Task 1 正好要给它加 `DOCS_PORTAL_STATE_FILE` 覆盖点**，做完这个坑一并消失。

### 禁词规则的真实边界（重要澄清）

接手文档原先写的是「**任何文件**不得出现 `novel`/`小说`」，**这与实际不符**。全仓约有 **30 处**源码
注释含「小说」，分布在 `lib/proxy.js`、`lib/render.js`、`lib/rewrite.js`、`lib/encoding.js`、
`public/reader.js`、`desktop/main.js`、`desktop/preload.js`、`dev/verify.js`、`skins/db-console/farm.js`。

**真正被测试守住的不变量是「服务出去的页面内容不得含禁词」**（`test/server.test.js:50`、
`test/tracer-skin.test.js:42` 断言的都是 HTTP 响应体），这条一直是绿的——**伪装本身没有漏**。

源码注释从不在测试范围内。要不要全仓清理是个**独立决定**：清理会碰到 `skins/db-console/`
（并行会话的开发地）和一批 lib 文件，是个单独的活。风险场景不是页面暴露，而是有人从背后瞟编辑器、
或在公司机器上打开这个仓库时注释比页面更显眼。**尚未决定，未做。**

---

## 开发约定（务必遵守）

- **语言**：与用户中文沟通；仓库注释中文、界面文案英文。
- **皮肤 JS 用 ES5**（`var`/`function`，无箭头/let/const/模板串），与 `skins/db-console/fishing.js` 同风格；
  `lib/`、`server.js`、测试用现代 Node 语法。
- **禁词**：任何文件不得出现 `novel` / `小说` / 小说站域名（测试有断言）。
- **无裸 NUL 字节**：写完文件跑
  `node -e "process.exit(require('fs').readFileSync(F).includes(0)?1:0)"`。
  （踩过坑：Edit 里打 `\uXXXX` 会被中间层解码成真实字符，导致 git 判二进制。）
- **只 add 自己改的文件**：工作区常有另一个会话的脏文件（`docs/superpowers/*forge-equipment*`、
  `skins/db-console/*` 等）—— 绝不 `git add -A`，绝不碰它们。
- **起 server 冒烟务必设 `DOCS_PORTAL_DATA_DIR` 到临时目录**，否则会污染演示用的
  `data/workspace.json`（踩过坑：审查 agent 的探针把演示数据写乱过，出现过乱码项目）。
- **提交信息**：中文、`type(scope): 说明` 格式。末尾按当前会话的 attribution 要求加 Co-Authored-By。

## 工作流（上五个阶段一直这么做，效果很好）

用 **superpowers:subagent-driven-development**：每个 Task 派一个全新子代理照计划逐字实现（TDD 先红后绿），
然后派 **spec 审查**（逐字节比对计划）+ **质量审查**（要求用探针/Playwright 实证，不接受纯推理）。
两关都过才进下一个 Task。这套流程在前五个阶段抓出了大量真问题：计划级月相公式错误、并发写文件损坏、
保存失败热循环、拖拽点击丢失、Markdown 链接双转义、Timeline 今天线错位、以及本次这个编码路径穿越。
**审查发现的问题按严重度分「现在修 / 记入后续」，Critical 必须当轮修掉。**

## 环境提示

- Windows；Bash 工具是 Git Bash（POSIX sh），另有 PowerShell 工具。
- 测试：`node --test test/*.test.js`（当前基线 228，收掉安全修复后应为 230）。
- 端到端：`node dev/verify.js`。
- 本机有 Edge 可做无头截图；Playwright 在子代理环境里可用（主会话不一定有）。
- 演示服务器：`DOCS_PORTAL_SKIN=tracer node server.js` → `http://127.0.0.1:8080/`。
