# 桌面版打包：从「npm start」到可下载安装的 Setup.exe 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `desktop/` 那个 Electron 壳变成一个真正可下载、可双击安装的 Windows 应用（NSIS `Setup.exe`：进开始菜单、可建桌面快捷方式、能从控制面板卸载），而不是只能 `cd desktop && npm start` 的开发态。

**用户已拍板**：先做完阶段 6（已完成），再做打包；安装包形式选 **NSIS 安装包 Setup.exe**（不要 portable 绿色版）。

**Tech Stack:** electron-builder（NSIS target）+ 现有的 Electron 壳。核心服务仍是零 npm 依赖的纯 Node。

---

## 为什么这不是「加个配置就完事」

打包会把整个应用塞进 `app.asar` 并装到 `C:\Program Files\...`（或 `%LOCALAPPDATA%`），**那里在运行时是只读的**。而 `server.js` 有三处路径钉死在 `ROOT = __dirname` 上：

| 路径 | 用途 | 现状 | 打包后 |
|---|---|---|---|
| `ROOT/data/` | 皮肤持久数据（tracer 的 workspace） | 有 `DOCS_PORTAL_DATA_DIR` 环境变量可覆盖 | ✅ 在 main.js 里指到 userData 即可 |
| `ROOT/bookmarks.json` | 阅读进度 / 书签 | **没有任何覆盖机制**（`server.js:47`、写在 `:131`） | ❌ **必须给 server.js 加一个覆盖点** |
| `ROOT/local.config.json` | 用户配置 | 读不到就退回 DEFAULTS，不崩（`server.js:30-34`） | ⚠️ 不崩，但打包后用户无处配置 |

读取路径（`skins/`、`public/`、`lib/`）在 asar 里可以正常读，Electron 的 fs 对 asar 是透明的，**不是问题**。

另外 `uiohook-napi` 是**原生模块**（.node 二进制），不能留在 asar 里，必须 `asarUnpack`。

---

## 已定的三个决定（用户已拍板，不要再改动或征询）

**1. 应用根目录 = 仓库根。**

electron-builder 的 `files` 只能收应用目录**以内**的东西，而 Electron 应用现在在 `desktop/` 却 `require('../server.js')`——核心在它外面。选定的做法：仓库根加 `package.json`（`main: "desktop/main.js"`，含 electron / electron-builder / uiohook-napi 依赖与 build 配置），`desktop/package.json` 移除或退化成指针。

- `files` 天然覆盖全部核心，`require('../server.js')` **无需改动**，不引入「只在打包后才触发的代码分支」。
- 代价：仓库根出现 `package.json` 和 `node_modules/`。**README 里「核心零依赖、装不装随你」那句话要改口径**，改成诚实的说法：核心运行时仍不需要任何 npm 包，`node server.js` 裸跑即可；根 `package.json` 只服务于桌面壳与打包。**这一改动用户已同意**，但措辞要保持 README 既有的坦率风格，不要粉饰。

（被否掉的方案：把核心走 `extraResources` 复制进 `resources/app-core/`、main.js 按 `app.isPackaged` 分支 require。保住了 desktop/ 的隔离，但代价是一个只在生产暴露的双路径分支，以及 filter 写漏一个皮肤文件要到装完才发现。）

**2. `productName` = `Tracer`。**

与皮肤名、窗口标题 `Tracer — Engineering`、托盘 tooltip 完全一致。**不要用 `podmatrix`** —— 那是用户的真实项目名、旧 db-console 伪装的一部分，皮肤已切 tracer，它既过时又会把真实项目名摆进安装列表和任务管理器。`appId` 也据此取（反域名式，不含 podmatrix）。

> ### 🚨 改名会弄丢农场存档 —— 这是本计划最容易造成真实损失的一步
>
> Task 3 的质量审查实测确认：**Electron 用 `package.json` 的 `name` 字段推导 `app.getPath('userData')`**。当前 `name` 是 `podmatrix-desktop`，用户的农场存档就实实在在躺在
> `%APPDATA%\podmatrix-desktop\Local Storage\leveldb`
> 里（审查字节扫描确认了 `dbconsole.farm.v3` 与 origin `8137` 都在其中；实测存档里有 26915 次按键、394 次收获）。
>
> **把 `name` 改成 Tracer 相关的值，userData 就换了目录，那份存档会变成孤儿——桌面版看起来像是「进度全没了」。**
>
> **用户已选定：带迁移的真改名**（`name` → `tracer-desktop`，加一次性存档迁移）。
> 被否掉的零风险方案是「只改 `productName` 显示名、`name` 留着不动」——那会在 `%APPDATA%` 里
> 永久留下一个与真实项目同名的目录，与本项目的伪装诉求冲突。
>
> **存档已备份**（2026-09-04 由协调者执行，逐字节校验一致）：
> `<private-backup-directory>`（113 文件 / 10,328,645 字节）。
> 迁移出任何问题，从这里复制回 `%APPDATA%\podmatrix-desktop\` 即可复原。
>
> 迁移的具体做法见下面的 **Task 3：存档迁移**——它被单独拆成一个 Task，因为它是本计划里
> 唯一会造成**不可逆真实损失**的一步，必须独立实现、独立验证，不能混在打包配置里顺手做。

**3. 图标：先生成一套占位素材。**

按 Tracer 的「日月轮回」主题做一个简单的月相/日晷几何图形，生成多尺寸 `build/icon.ico`（Windows 需要 256×256 的多尺寸 ico）和替换 `desktop/assets/tray.png`。纯几何、不追求精美，但要与主题一致、不能留 Electron 默认原子标志（那在开始菜单里一眼就是 Electron 小工具，对伪装不利）。用户之后可自行替换。

---

## 文件结构

```
package.json          新：Electron 应用清单 + electron-builder 配置（main 指向 desktop/main.js）
server.js             + bookmarks 路径覆盖点（DOCS_PORTAL_STATE_FILE）
desktop/main.js       + 把 DATA_DIR / STATE_FILE 指向 app.getPath('userData')；调用存档迁移
desktop/migrate.js    新：存档迁移纯函数（不依赖 Electron，可单测）
desktop/package.json  移除（内容并入根 package.json）或退化成 README 指针
build/                新：安装包图标素材（icon.ico，Task 4 里生成占位素材）
README.md             + 桌面版安装包一节；「零依赖」口径调整
desktop/README.md     + 从源码构建安装包的步骤
```

---

## Task 1：给 bookmarks 加路径覆盖点

**Files:** `server.js`、`test/`（新增测试）

- [ ] **Step 1**：`server.js:47` 的 `STATE_FILE` 改成可被环境变量覆盖，与 `DATA_DIR`（`:66`）保持完全一致的写法与风格：

```js
const STATE_FILE = process.env.DOCS_PORTAL_STATE_FILE || path.join(ROOT, 'bookmarks.json');
```

加中文注释说明为什么需要它（打包后安装目录只读，桌面版要把它指到 userData）。

- [ ] **Step 2**：TDD 补测试（先红后绿）。参照 `test/store-readonly.test.js` 的写法——**环境变量必须在 require server.js 之前设**，因为常量在 require 时就固定了，所以要单开一个测试文件。断言：设了 `DOCS_PORTAL_STATE_FILE` 后，`POST /api/state` 写的是那个文件、仓库根的 `bookmarks.json` 不被创建；`GET /api/state` 读的也是它。

- [ ] **Step 3**：负向验证（把覆盖点改回硬编码 → 测试必须变红 → 复原 → 变绿）。**本项目已出现过两次「回归测试其实是假绿」的事故，这一步不能省。**

- [ ] **Step 4**：`node --test test/*.test.js` 0 fail；`node dev/verify.js` 全通过。Commit。

---

## Task 2：桌面版把可写路径指向 userData

**Files:** `desktop/main.js`

- [ ] **Step 1**：在 `require('../server.js')` **之前**（`main.js:16`，因为 server.js 在模块加载时就固定了常量）设好三个环境变量，指向 `app.getPath('userData')`：

```js
const userData = app.getPath('userData');
process.env.DOCS_PORTAL_DATA_DIR = process.env.DOCS_PORTAL_DATA_DIR || path.join(userData, 'data');
process.env.DOCS_PORTAL_STATE_FILE = process.env.DOCS_PORTAL_STATE_FILE || path.join(userData, 'bookmarks.json');
```

保持 `process.env.X || 默认值` 的既有写法——外部环境变量仍能覆盖（审查/冒烟要靠它）。

⚠️ **`app.getPath()` 在 `app` ready 之前就能调**（getPath 不需要 ready），但请实测确认；若不行，改用 `app.setPath` 或把 server require 推迟到 whenReady 之后（后者要重构 main.js 的启动顺序，代价大，优先前者）。

- [ ] **Step 2**：**开发态与打包态都要验**。开发态（`npm start`）现在也会写 userData 而不是仓库 `data/`——**这是好事**（消除了「开发时污染演示数据」这个本阶段真实发生过的事故），但要在注释和 `desktop/README.md` 里写清楚，否则开发者会困惑「我的存档去哪了」。

- [ ] **Step 3**：实测启动，确认 userData 下真的生成了 `data/` 与 `bookmarks.json`，仓库根**没有**新增这两个东西。Commit。

---

## Task 3：存档迁移（改名前必须先做完并验证）

**Files:** `desktop/main.js`、`desktop/test/`（新增测试）

> 这是本计划里**唯一会造成不可逆真实损失**的一步，所以单独成 Task：独立实现、独立验证，
> 不许混在打包配置里顺手做。安全网：`<private-backup-directory>`。

**背景**：Electron 从 `package.json` 的 `name` 推导 `app.getPath('userData')`。当前 `name` 是
`podmatrix-desktop`，农场存档（localStorage 键 `dbconsole.farm.v3`）实际躺在
`%APPDATA%\podmatrix-desktop\Local Storage\leveldb`。`name` 一改，Electron 就去新目录找，
旧存档变孤儿——**表现为「农场进度全没了」**。

- [ ] **Step 1：写迁移函数（先测后写）**

在 `desktop/main.js` 里加一个迁移函数，在 `app.whenReady()` 之后、`createWindow()` **之前**调用
（必须赶在渲染进程加载页面、farm.js 读 localStorage 之前）。语义：

- 若**新** userData 的 `Local Storage` 已存在 → 直接返回（**幂等**，迁过就不再迁）
- 若**旧**目录（`%APPDATA%\podmatrix-desktop`）不存在 → 直接返回（全新安装，无需迁移）
- 否则把旧目录的 `Local Storage`（以及 `Session Storage`，如果存在）**复制**到新 userData
  —— **复制，不是移动**。移动一旦中途失败就两头都没有；复制失败了旧的还在。
- 全程 try/catch 兜住：迁移失败**绝不能让应用起不来**，打 `console.error` 并继续（用户至少能用，
  存档还在旧目录里等人工处理）
- 成功/跳过/失败各打一行日志，方便事后判断到底发生了什么

**把迁移逻辑写成一个不依赖 Electron 的纯函数**（接收 `旧目录`、`新目录` 两个路径参数），
放进 `desktop/` 下一个独立模块（例如 `migrate.js`），`main.js` 只负责把 `app.getPath` 算出的
真实路径喂给它。理由与 `pulse.js` 完全一致：这样才能脱离 Electron 单测。

- [ ] **Step 2：TDD 测试**（`desktop/test/`，`node --test` 跑得起来，不需要装 Electron）

用临时目录构造四种情形，逐一断言：
1. 旧目录有存档、新目录空 → 文件被复制过去，**旧目录仍然完好**（证明是复制不是移动）
2. 新目录已有存档 → 跳过，新目录内容**不被覆盖**（幂等；这条最重要——重复迁移覆盖掉新存档
   就等于用旧进度盖掉新进度）
3. 旧目录不存在 → 安静跳过，不抛错
4. 复制过程出错（例如目标路径不可写）→ 不抛出，返回失败标记

**每条都做负向验证**（把实现改坏 → 必须变红 → 复原 → 变绿）。

- [ ] **Step 3：改名**

`package.json` 的 `name` → `tracer-desktop`（连同 `description` 里的 podmatrix 残留一并清掉）。

- [ ] **Step 4：真机实测（不能靠推理）**

改名前先记下当前农场的**具体数字**（按键数、收获数、金币、若干作物等级——从运行中的窗口读，
或直接解析旧的 leveldb）。改名 + 迁移后启动，逐项核对**完全一致**。

⚠️ 启动桌面版会挂全局输入钩子并监听 8137，验完确认进程退干净。
⚠️ 起之前设 `DOCS_PORTAL_DATA_DIR` 到临时目录，别写仓库 `data/`。

- [ ] **Step 5**：迁移代码**保留**（至少一个版本周期），不要做完就删——它要为所有从旧版本升上来的
  安装负责。加注释写明「什么时候可以删」。Commit。

---

## Task 4：electron-builder 配置 + 出包

**Files:** 根 `package.json`、`build/icon.ico`、`desktop/assets/tray.png`、`.gitignore`

- [ ] **Step 1**：装 `electron-builder`（devDependency）。

- [ ] **Step 2**：写 build 配置。要点：
  - `appId`：一个稳定的反域名标识（**不要**用 `podmatrix` —— 那是已废弃的伪装品牌，且是用户真实项目名）
  - `productName`：`Tracer`（已定）。决定安装目录名、开始菜单项名、安装包文件名。
  - ⚠️ **动 `package.json` 的 `name` 字段之前，回头读「已定的三个决定」第 2 条里那个红框**——`name` 决定 userData 路径，改错会把用户的农场存档变成孤儿。那里给了迁移步骤和一个零风险替代方案，**要先让用户选**。
  - `target: nsis`；`oneClick: false`（给用户选安装目录）、`allowToChangeInstallationDirectory: true`、`createDesktopShortcut`、`createStartMenuShortcut`
  - `asar: true` + `asarUnpack` 收 `uiohook-napi`（原生 .node 必须在 asar 外）
  - `files` 按选定方案收全 `server.js`/`lib`/`public`/`skins`/`desktop`，**排除** `data/`、`bookmarks.json`、`local.config.json`、`docs/`、`test/`、`dev/`、`.git`
  - `win.icon` 指向 `build/icon.ico`

- [ ] **Step 3**：`.gitignore` 加 `dist/`（electron-builder 输出目录）和根 `node_modules/`（若走方案 A）。

- [ ] **Step 4**：出包 `npx electron-builder --win nsis`，**实际安装一次**，确认：
  - 安装程序能跑完，进开始菜单、桌面快捷方式在
  - 双击图标能起来，窗口标题 `Tracer — Engineering`，加载的是 **tracer 皮肤**
  - **Garden 分区正常**（游戏引擎经 `GAME_DIR` 兜底从 asar 里的 `skins/db-console/` 服务出来——**这条链路在 asar 下必须实测，不能推理**）
  - 农场存档、workspace 存档能写进 userData 并在重启后还在
  - 托盘常驻、关窗口缩托盘、托盘菜单「退出」能真正退干净
  - 全局输入钩子工作（`uiohook-napi` 的原生模块从 asar 外正确加载）
  - 从控制面板能卸载干净

- [ ] **Step 5**：Commit。

---

## Task 5：README / desktop/README 更新

- [ ] 主 `README.md`：加「桌面版安装包」一节（下载/安装、数据存在 userData、卸载）；若走方案 A，调整「零依赖」的口径。
- [ ] `desktop/README.md`：加「从源码构建安装包」步骤；说明开发态存档也已挪到 userData。
- [ ] 保持中文与既有行文风格（务实、会讲「为什么」和「先掂量清楚」，不要写成宣传稿）。
- [ ] **不要引入禁词**（`novel`/`小说`/源站域名）。

---

## 已知缺口与必须提醒用户的事

**1. 图标素材要现做**（已定：生成占位素材，见上「已定的三个决定」第 3 条）。托盘图标 `desktop/assets/tray.png` 至今仍是 db-console 时代的 Supabase 绿点（`desktop/main.js:96-97` 有 TODO），安装包另需 `build/icon.ico`。两者都在 Task 3 里一并产出。

**2. 未签名的安装包会被 SmartScreen 拦。** 没有代码签名证书的话，Windows 会弹「Windows 已保护你的电脑」，用户要点「更多信息 → 仍要运行」。个人自用可以接受，但要**明确告知用户**，别让他以为是打包坏了。买证书是每年几百到上千的事，对自用工具不值当。

**3. 这与 README 里已有的告诫一脉相承。** `desktop/README.md` 已经很坦率地写了三条：全局钩子用的正是键盘记录器那套 API，公司 EDR 很可能报警；装软件本身可能违反 IT 政策；网页版「只是个浏览器标签页」的无痕优势，做成桌面程序就没了。**打包成正式安装包会把这三条的代价再放大一档**（安装痕迹、注册表项、卸载记录）。这不是反对做，是做之前该跟用户复述一遍。

**4. 伪装面已定为 `Tracer`**（见上「已定的三个决定」第 2 条）。执行时注意 `podmatrix` 这个真实项目名在 `desktop/package.json` 的 `name`/`description` 里还有残留，一并清掉——它决定别人在这台机器上看到什么。

**5. 桌面版的皮肤切换。** 打包后没有 `local.config.json` 可改，用户想切回 db-console 只能靠环境变量——对一个双击启动的应用不现实。若需要，得在托盘菜单里加一个「切换皮肤」子菜单（要重启服务或至少重载窗口）。**本计划不含**，作为后续项记录。

---

## 阶段边界

本计划**不含**：macOS / Linux 打包（用户只要 Windows）、portable 绿色版（用户明确只要 NSIS）、代码签名、自动更新、托盘皮肤切换菜单、图标素材制作。

---

## 验证纪律（沿用本项目既有约定）

- 起 web 版 server 冒烟：**必须**同时设 `DOCS_PORTAL_DATA_DIR`（临时目录）和 `DOCS_PORTAL_READONLY_STORE=1`；**绝不碰仓库 `data/`**（阶段 6 期间被写坏过一次，丢了演示数据，`.bak` 只留一代救不回来；已有 `dev/seed.js` 可重灌）。
- 启动桌面版会挂**全局输入钩子**并监听 8137，验完**务必确认进程退干净**。
- **绝不改 `skins/db-console/` 任何文件**（另一个会话正在那里开发农场）。
- 不 `git add -A`（工作区常有并行会话的脏文件）；`git add` 与 `git commit` 紧挨着执行（出现过跨会话 git 索引竞态）。
- 每条新增断言都要做负向验证（改坏 → 变红 → 复原 → 变绿）。
- 提交信息中文、`type(scope): 说明`。
