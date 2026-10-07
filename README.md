# Tracer

当前版本以任务花园与桌面钓鱼组成休闲系统。人物桌宠、花精灵、伙伴聊天和生成界面已移除；花园、植物图鉴与花朵星球继续保留。现有 18 款鱼竿（含黄金隐藏款）、盲盒、7 种鱼饵、24 种鱼、传奇水族箱和六种 3D 鱼塘。水族箱展示已钓获的传奇鱼，也可摆到桌面，拖动、缩放及左右旋转；鱼、植被与鱼竿均采用非像素美术。完整规则见[桌面钓鱼与鱼塘](docs/desktop-fishing.md)。

鱼塘永久免费：珍稀、史诗鱼捕获后额外获得鱼苗，每池最多五条，组建中可以放生换鱼。确认五条后，鱼塘成为可随时查看和投喂的永久收藏，并自动开启下一座。传奇鱼苗入住独立水族箱，最多三条。旧工作区的任务、花园与历史备份继续兼容。

Tracer 是中英双语的桌面任务管理与专注工作台。用收集箱、看板、项目、日程和笔记整理工作，保留任务完成历史；番茄钟、循环音频和星月主题帮助你保持专注。

**[Tracer 0.4.2：Windows 下载](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.4.2)** · [Mac 0.4.0 下载](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.4.0) · **[Mac 安装与构建](docs/macos-install.md)** · [0.4.2 更新说明](docs/desktop-release-0.4.2.md) · [ChatGPT 套餐登录指南](docs/chatgpt-ai-setup.md) · [个人 API 设置](docs/personal-ai-setup.md)

## 下载与安装

**0.4.2 本次先提供 Windows x64。** 新版包含桌面钓鱼、独立主题鱼竿动作、六种鱼塘、可旋转的传奇水族箱、鱼苗育养与专属神秘礼包，详见 [0.4.2 更新与验证说明](docs/desktop-release-0.4.2.md)。

Mac 继续提供已验证的 0.4.0：Apple 芯片和 Intel 版本均可从 [0.4.0 发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.4.0)下载。[0.4.0 三平台构建记录](https://github.com/AndyLiu010802/Tracer/actions/runs/35834504837)。

| 电脑类型 | 安装包 | 备用压缩包 |
| --- | --- | --- |
| Windows x64 | [Tracer-Setup-0.4.2-x64.exe](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.2/Tracer-Setup-0.4.2-x64.exe) | — |
| Mac：Apple 芯片（M 系列） | [Tracer-0.4.0-mac-arm64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.0/Tracer-0.4.0-mac-arm64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.0/Tracer-0.4.0-mac-arm64.zip) |
| Mac：Intel | [Tracer-0.4.0-mac-x64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.0/Tracer-0.4.0-mac-x64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.0/Tracer-0.4.0-mac-x64.zip) |

Windows 运行安装程序，按提示安装；会创建桌面和开始菜单快捷方式。Mac 打开对应芯片的 DMG，将 Tracer 拖入「应用程序」。两者均无需另装 Node.js 或 Codex。更新前彻底退出旧版，再安装到原来的位置。Windows 0.4.2 分发版使用独立工作区，旧版存档保留在原目录，不会自动迁移；详见[安装说明](docs/desktop-release-0.4.2.md#安装)。


Windows 安装包目前未签名；Mac 包使用 ad-hoc 签名，尚未获得 Apple Developer ID 签名与公证。真实账号 AI 登录、后台输入授权及未覆盖的界面操作仍需实机验收，详见 [Mac 安装指南](docs/macos-install.md)。

- **无边框全屏**：启动进入全屏，隐藏 Windows 系统标题栏。按 **F11** 或点击右上角全屏按钮切换；窗口模式下可拖动应用顶栏。
- **托盘运行**：右上角关闭按钮将窗口隐藏到托盘。点击托盘图标恢复，彻底退出使用托盘菜单「退出」。Esc 仍用于关闭任务弹窗。
- **本地数据**：Windows 0.4.2 分发版使用 `%APPDATA%\tracer-desktop-commercial\`；源码与历史版本使用 `%APPDATA%\tracer-desktop\`。两个目录独立，旧数据不自动迁入；正常卸载保留用户数据，分享的安装包使用接收者自己的工作区。
- **核对下载**：Windows 使用 [SHA256SUMS-0.4.2.txt](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.2/SHA256SUMS-0.4.2.txt)，覆盖 EXE 和 [blockmap 索引](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.2/Tracer-Setup-0.4.2-x64.exe.blockmap)；blockmap 无需单独安装。Mac 0.4.0 使用其发布页的 [SHA256SUMS-0.4.0.txt](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.0/SHA256SUMS-0.4.0.txt)。

## 功能

- 本地账户与资料、头像和星座图案；账户隔离工作区、金币、收藏与偏好，保留云服务接口。
- 种植金币购买静态壁纸、动态壁纸及材质外观各 10 款；笔记专属贴纸与悬浮背包。
- 桌面钓鱼覆盖蓄力抛竿、等待咬钩、及时提竿、控竿收线和捕获结算；鱼饵决定鱼种范围。
- 任务搜索、状态与优先级筛选、拖拽看板；任务支持截止日期、计划日期、估时、依赖、清单和验收要求。
- 项目、日程、时间线、笔记与完成历史统计。
- 笔记列表支持收起、拖动调宽并记住偏好；窄布局自动为正文留出完整宽度。
- 番茄钟、随机循环音频、自选音频与定时播放组合。
- 可隐藏的每日名言与自然风景玻璃卡片，中英文界面切换。
- 独立 Chromium 参考浏览器，支持页面脚本、登录、后退前进和下载；网站自身的访问限制与网络条件仍然适用。
- AI 计划助手：读取本地 PDF、Word 和文本资料，根据截止日期和可投入工时预览任务拆解与排程。
- 鱼竿盲盒公开概率和保底，重复鱼竿返还金币；鱼塘包含六种免费场景，每种鱼有不同的投喂反馈。

### 任务花园与鱼塘

开始一项任务，自动种下一颗随机种子，任务完成后成熟。植物包括野花、向日葵、薰衣草、苹果树、桃树和樱桃树，不再由用户手选。每页显示六块花圃，可翻页浏览其他任务；同一个项目可以种出多株植物。收获后，图鉴记录各类植物的次数，未解锁种类显示黑色轮廓。

种类在同一任务首次种植时固定。撤回任务前提示销毁当前植物，重新开始不能重抽；每项任务最多收获一次。新种植不再产生花精灵，收获金币可以购买鱼竿盲盒和鱼饵。

看板支持清除已完成任务：只移除任务卡片，成熟植物留在花园等待手动收获，已有图鉴和完成历史保留。项目全部任务完成后可以归档，花朵汇成独立收藏区域中的 3D 星球，支持旋转浏览。此前清理过任务卡片的花朵同样会进入星球；用户也可删除不再想保留的收藏项目。

任务花园、星球、鱼竿、捕获记录、鱼塘和水族箱随账户工作区一起保存。鱼塘和水族箱入口位于花园下方；商店提供鱼竿盲盒与鱼饵分类。捕获的成鱼可以出售，额外获得的鱼苗独立留在育养箱；珍稀和史诗鱼可放入鱼塘，传奇鱼可放入水族箱。鱼塘确认珍藏后固定居民，仍可投喂和观看成长。

### AI 服务状态

支持两种个人接入方式：**ChatGPT 套餐登录**使用官方 Codex 组件和账号包含的 Codex 额度；**自己的 API**支持 OpenAI、兼容接口及本机模型。无需部署 Tracer 云服务。已完成真实 ChatGPT Pro 授权及模型响应验证；其他用户仍需登录自己的账号并测试。安装包不含账号或密钥。

生成前检查套餐额度，额度耗尽或无法确认时停止，不购买额度或自动切换 API。个人 API 按服务商规则计费。任务保存在本机，不自动跨设备同步；可选的自建 AI 服务需另行配置。

## 从源码运行与构建

在仓库根目录安装依赖后启动桌面版：

```sh
npm ci
npm start
```

在 Windows 上构建 x64 安装程序：

```sh
npm run dist
```

产物为 `dist/Tracer-Setup-<版本>-x64.exe`。Electron、音频、PDF/Word 提取依赖及官方 Codex 运行时会随安装包分发。首次构建下载并校验锁定版本的 Codex，需要访问官方 npm 注册表。桌面启动、存档、输入计数和构建细节见 [desktop/README.md](desktop/README.md)。

在 Mac 上构建与本机芯片匹配的 DMG / ZIP：

```sh
npm run dist:mac
node dev/verify-macos-release.cjs
```

统一发布使用仓库的 **Actions → Desktop release**（`.github/workflows/desktop-release.yml`）：推送到 `codex/release-*` 分支默认构建并验证 Windows x64，手动运行可选择 Windows 或全部平台。所选平台全部通过后，才发布安装包和 SHA-256 校验文件；全部平台模式包含 Apple 芯片和 Intel Mac 的原生构建。独立 Mac 签名、公证测试仍可使用 **macOS desktop** 工作流，配置见 [Mac 发布流程](docs/macos-install.md#维护者构建与发布)。

### 浏览器开发模式

完成 `npm ci` 后运行 `node server.js`，默认地址为 `http://127.0.0.1:8080/`，也可双击 `start.bat`。PDF/Word 提取使用 npm 依赖，完整功能不能按零依赖方式运行。

`powershell -NoProfile -ExecutionPolicy Bypass -File .\start-tasks.ps1` 使用 `127.0.0.1:8081` 打开任务看板；可加 `-Port 8082` 更换端口。`create-task-shortcut.ps1` 创建的是浏览器开发模式快捷方式，与安装程序创建的 Tracer 桌面应用快捷方式不同。项目移动后需重建开发模式快捷方式。

浏览器开发模式的数据在仓库 `data/` 和 `bookmarks.json` 中，与桌面用户目录独立。以下阅读器、皮肤和代理说明保留供浏览器模式及开发使用；桌面版的原生参考浏览器不使用 fixture view 和网页代理。

修改 `public/` 中的任务历史、项目删除或任务翻译共享模块后，运行 `node dev/sync-shared-modules.js` 更新 Tracer 皮肤中的副本。历史设计与旧版发布说明统一保存在 [文档归档](docs/archive/README.md)。

## 浏览器模式：阅读面板

- 右栏面板的输入框填网址，回车或点 `Load` 加载。
- 站内链接（下一章、目录等）都留在面板内，不会跳出去。
- 阅读位置自动记住，下次打开直接回到上次那一页。

### 手势

| 操作 | 效果 |
|---|---|
| 鼠标移出面板后单击右键 | 收起 / 弹出面板，保留阅读位置 |
| `‹` `›` `⟳` | 面板内的后退 / 前进 / 刷新 |
| 双击面板标题栏 | 在右栏卡片和可拖拽浮窗之间切换 |
| 拖动浮窗右下角 | 调整尺寸 |
| 拖动右栏左缘的把手（tracer 皮肤） | 调整右栏宽度，会记住；面板隐藏或切成浮窗时右栏自动收成一条细边，恢复后宽度不变 |
| 把手拖到很窄 | 收起面板；反向拖不回来，展开用下面的双击或 `Enter` |
| 双击把手 | 收起 / 弹出面板，和右键效果相同 |
| 把手上按 `Enter` `Space` / `←` `→` / `Home` `End` | 切换面板 / 微调宽度 / 拉到最窄最宽（先用 Tab 移到把手，全程不用鼠标） |
| `☰` 按钮 | 切换 fixture view（正文重排为语料清单样式，原站链接与分页保留）。开启后一直有效，翻页不会退回普通视图 |
| `◐` 按钮 | fixture view 的低对比模式：正文压到近底色，鼠标悬停的那一行才升到可读对比度。隔一步瞥见是一块几乎空白的暗面板。开启时若 fixture view 未开会顺带打开，翻页同样保持 |

fixture view 还做了几层排版伪装：正文默认就是**贴近背景色的低调灰**（指针所在的行轻微提亮，`◐` 是更极端的一档）；长段落按句末标点切成一两句的短行（散文式长段一眼就是故事文本，短行才像字符串表）；面板标题栏只显示从 URL 编号推出的英文批次名——「第 N 章 xxx」那行大号中文降级成第一条语料，站名式标题（如源站自己的品牌名）直接丢弃；语料集名是域名的哈希，不含源站域名片段。

**指针停在面板内时右键不生效**，正在读的时候不会误收；此时右键菜单是浏览器原生的，复制、在新标签页打开、返回上一页都照常可用。指针移到面板外，右键才收起面板，那里的菜单被屏蔽掉。

面板收起后指针不可能在其范围内，所以右键随时能把它唤回来。

面板内容区固定深色，具体读起来像什么取决于当前皮肤：默认的 tracer（以及 db-console）本身就是深色界面，面板嵌进去颜色对齐，几乎消失进背景；换成浅色的 docs-portal 时，深色面板会和周围形成对比，看起来就是文档站里嵌了一块日志/控制台面板。

### 自动隐藏

默认只在**整个浏览器窗口或标签页失去焦点**时收起——切到别的程序、切标签页、最小化。点击面板、鼠标在页面上移动都不会触发。

改 `local.config.json` 的 `autoHide`：

| 值 | 行为 |
|---|---|
| `"blur"` | 整窗/标签页失焦时收起（默认） |
| `"off"` | 从不自动收起，只靠右键手势 |
| `"aggressive"` | 额外在鼠标移出浏览器视口时收起（误报较多） |

另有 `idleMinutes`（默认 `5`）：连续这么多分钟没有任何鼠标/键盘输入就收起面板，设 `0` 关闭。失焦类信号都建立在「你切走了」上；人直接离开工位、浏览器还开着时它们一个都不会触发，这条时间判据补的就是这个洞。

判定逻辑在 [public/conceal-policy.js](public/conceal-policy.js)，里面记录了两个曾经的误判以及为什么那样判是错的。

## 配置

复制 `local.config.example.json` 为 `local.config.json` 后修改：

```json
{
  "port": 8080,
  "host": "127.0.0.1",
  "skin": "tracer",
  "autoHide": "blur",
  "idleMinutes": 5
}
```

`DOCS_PORTAL_PORT`、`DOCS_PORTAL_HOST`、`DOCS_PORTAL_SKIN` 三个环境变量优先级高于配置文件，临时换端口或试一套皮肤时不用改文件。

服务只绑定回环地址，局域网内其他机器访问不到。

## 结构

```
server.js              入口与路由
lib/proxy.js           反向代理：取页、解压、转码、剥响应头
lib/encoding.js        字符编码探测（GBK/GB18030 → UTF-8）
lib/rewrite.js         链接重写与守卫脚本注入
lib/render.js          fixture view 的正文抽取与重排
public/reader.*        面板组件（与皮肤无关）
public/conceal-policy.js  自动隐藏与右键手势的判定规则
skins/tracer/          伪装皮肤（默认）
skins/db-console/      伪装皮肤
skins/docs-portal/     伪装皮肤
dev/verify.js          端到端验证脚本
desktop/               桌面版（Electron 壳），见上文「桌面版安装包」与 desktop/README.md
package.json           应用依赖（含资料提取）与 electron-builder 打包配置
build/                 安装包图标素材（build/app-icon.ico），构建安装包时用
```

### 换皮肤

`skins/<name>/` 放一套就是一套，改 `local.config.json` 的 `skin` 字段切换（或用 `DOCS_PORTAL_SKIN` 环境变量临时覆盖）。**默认皮肤是 `tracer`**，自带三套：

| 皮肤 | 外观 |
|---|---|
| `tracer` | Linear 风深色工程工作台，主题「日月轮回」——accent 随当前时刻在琥珀/鎏金/绛紫/靛银四段轮转，顶栏日晷+真实月相。**默认皮肤。** Inbox / Notes / Board / Project Map / Planner / Timeline / Insights / Garden 八个分区全部真实可用，不是摆设界面 |
| `db-console` | Supabase Studio 风格的控制台（深色 + 绿色 accent），表结构来自一套真实的房产项目 schema，面板定位为 i18n 种子语料。面板内容区本来就是固定深色，嵌进深色界面里完全消失于背景 |
| `docs-portal` | 浅色英文技术文档站，面板定位为 i18n 本地化语料 |

三套都能正常切换、正常用，db-console 和 docs-portal 只是不再是默认打开的那一个。

`db-console` 的图标竖栏可以切换分区：Home 概览、Table Editor（主视图）、SQL Editor、Database、Auth、Storage、Project Settings 都是可信的假界面。停在哪个分区、哪张表会被记住。

### 旧玩法兼容与家园快捷键

旧农场、钓鱼、采矿、战斗、装备和魔法的代码、样式及专用美术资源已从项目删除，所有皮肤均不再提供旧游戏入口或资源兜底。`db-console` 保留控制台界面；本机旧 `dbconsole.farm.v3` 存档静置保留。新任务花园使用工作区的 `taskGarden` 记录，旧 `tracer.garden.v1` 与旧收获存档保留。

Tracer 中 `Ctrl+Alt+G` 一键隐藏 Garden：导航栏入口消失，如果正停在 Garden 会自动返回上一个分区，隐藏状态会记住；再次按下可恢复入口。

### 阅读面板适配

皮肤与阅读面板引擎的契约只有两条：

1. 提供挂载点 `<div id="aside-slot">`。
2. 在 `:root` 定义 `--fg` `--bg` `--muted` `--border` `--accent` `--surface` `--font-body` `--font-mono` `--radius`。面板只通过这些变量取色取字体，因此会自动融进任何皮肤。

可选的第三条：挂载点上写 `data-panel-tag` / `data-panel-title` / `data-panel-meta`，可以覆盖面板标题栏和页脚的文案，让同一块面板在不同伪装语境里都读得通（文档站叫 `Localization fixtures`，数据库控制台叫 `Collation samples`）。不写就用默认值。

引擎不需要知道皮肤长什么样，新增皮肤不用改引擎代码。

## 测试

任务管理的交互、字段和竞品对照见[任务管理改进说明](docs/task-management-review.md)。
顶部番茄钟、每日名言和随机背景的用法见[专注与外观说明](docs/focus-and-appearance.md)。

```
node --test test/*.test.js     # 单元测试，数量以运行时的实际输出为准（持续增加中）
node dev/verify.js             # 端到端链路验证
cd desktop && node --test      # 桌面壳的内容无关性测试（纯函数，不需要装 Electron）
```

`dev/verify.js` 会起一个模拟的外部站点（GBK 编码 + `X-Frame-Options` + CSP），验证代理、翻页、fixture view 和失败降级是否都正常。

## 已知限制

- **上一章/下一章按两级策略识别。** 先按链接文字匹配「上一章/下一章/目录」；不少站点直接
  拿章节标题当链接文字，文字匹配抓不到，就退回按 URL 编号推断——同源、同目录、同后缀、
  编号最接近的那两篇。两级都落空的站点（比如编号不连续又不写方位词）仍会丢失翻页。
- **重度 JS 驱动的站点可能不工作。** 链接重写作用于服务端返回的 HTML；如果站点用客户端路由直接给 `location.href` 赋值跳转，框架会试图加载源站原页，此时源站的 `X-Frame-Options` 会让它显示空白。传统的服务端渲染站点（绝大多数被代理的中文内容站属此类）不受影响。
- **子资源直连源站。** 图片和样式通过注入的 `<base>` 直接从源站加载，不走代理。这样省去了重写 `srcset`、CSS `url()` 等一堆易错情况，代价是浏览器会与源站建立直接连接。
- **Cookie 只存在内存里。** 进程退出即清空，磁盘不留痕。需要登录的站点每次启动后要重新登录。
