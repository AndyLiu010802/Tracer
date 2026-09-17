# Tracer

0.3.9 支持与伙伴聊出任务或项目：伙伴会补问关键缺口，整理成可预览的方案，只有你确认后才写入工作区。主窗口和原生桌宠都能使用；日期和工时可留空，对话与待确认方案保存在本机，创建结果未确认时可重试同一请求，避免重复添加。

仍可单独重新生成不满意的伙伴动作，保存前保留原动作和养成进度；含保留旧帧与新动作的导出文件，最低仍需 Tracer 0.3.8 打开。

Tracer 是中英双语的桌面任务管理与专注工作台。用收集箱、看板、项目、日程和笔记整理工作，保留任务完成历史；番茄钟、循环音频和星月主题帮助你保持专注。

**[下载 Tracer 0.3.9：Windows / Mac](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.9)** · **[Mac 安装与构建](docs/macos-install.md)** · [0.3.9 更新说明](docs/desktop-release-0.3.9.md) · [ChatGPT 套餐登录指南](docs/chatgpt-ai-setup.md) · [个人 API 设置](docs/personal-ai-setup.md)

## 下载与安装

0.3.9 已在[统一发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.9)发布 Windows x64、Apple 芯片 Mac 与 Intel Mac 安装包。三平台原生构建与验收全部通过，七项公开附件及统一 SHA-256 校验文件已核验。

0.3.9 使用[同一个发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.9)分发 Windows、Apple 芯片 Mac 和 Intel Mac 安装包，包含相同版本的桌宠与任务管理功能。附件在三个平台的原生云端构建与验证全部通过后发布，共用一份 SHA-256 校验文件。

| 电脑类型 | 安装包 | 备用压缩包 |
| --- | --- | --- |
| Windows x64 | [Tracer-Setup-0.3.9-x64.exe](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-Setup-0.3.9-x64.exe) | — |
| Mac：Apple 芯片（M 系列） | [Tracer-0.3.9-mac-arm64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-arm64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-arm64.zip) |
| Mac：Intel | [Tracer-0.3.9-mac-x64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-x64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-x64.zip) |

Windows 运行安装程序，按提示安装；会创建桌面和开始菜单快捷方式。Mac 打开对应芯片的 DMG，将 Tracer 拖入「应用程序」。两者均无需另装 Node.js 或 Codex。更新前彻底退出旧版，再安装到原来的位置；任务、设置、桌宠和个人工作区保留。

Windows x64、Mac arm64 与 Mac x64 均通过 **631 项核心测试、16 项桌面测试**。真实打包应用的主窗口与原生桌宠已通过 16 帧播放、新格式导入导出、旧格式导入，以及桌宠通过 IPC 确认创建任务和同请求重试检查。模拟 AI 的伙伴生成、草稿恢复、任务与项目方案确认和工作区恢复 QA 也已通过。[查看本次 Desktop release 构建记录](https://github.com/AndyLiu010802/Tracer/actions/runs/35174730636)。

本地 Windows 安装包已通过 256 个打包源码文件的逐字节一致性核验及原生运行 QA；三平台 CI 均来自同一提交 [a5ca3c007bc990878fc8d6c2fa2abbbd92fc95ef](https://github.com/AndyLiu010802/Tracer/commit/a5ca3c007bc990878fc8d6c2fa2abbbd92fc95ef)。AI 自动化场景使用模拟响应与本地合成图，不消耗真实 AI 额度，也不代表本次已验证真实 AI 账号登录与服务响应。

Windows 安装包目前未签名；Mac 包使用 ad-hoc 签名，尚未获得 Apple Developer ID 签名与公证。真实账号 AI 登录、后台输入授权及未覆盖的界面操作仍需实机验收，详见 [Mac 安装指南](docs/macos-install.md)。

- **无边框全屏**：启动进入全屏，隐藏 Windows 系统标题栏。按 **F11** 或点击右上角全屏按钮切换；窗口模式下可拖动应用顶栏。
- **托盘运行**：右上角关闭按钮将窗口隐藏到托盘。点击托盘图标恢复，彻底退出使用托盘菜单「退出」。Esc 仍用于关闭任务弹窗。
- **本地数据**：任务、完成历史和设置保存在 `%APPDATA%\tracer-desktop\`。升级及正常卸载保留用户数据；分享的安装包使用接收者自己的工作区。
- **核对下载**：Windows 安装程序目前未签名，Mac 包为 ad-hoc 签名。发布附件提供统一的 [SHA256SUMS-0.3.9.txt](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/SHA256SUMS-0.3.9.txt)，覆盖 Windows EXE、[blockmap 索引](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-Setup-0.3.9-x64.exe.blockmap)和两种 Mac 架构的 DMG、ZIP；blockmap 无需单独安装。

## 功能

- 任务搜索、状态与优先级筛选、拖拽看板；任务支持截止日期、计划日期、估时、依赖、清单和验收要求。
- 项目、日程、时间线、笔记与完成历史统计。
- 笔记列表支持收起、拖动调宽并记住偏好；窄布局自动为正文留出完整宽度。
- 番茄钟、随机循环音频、自选音频与定时播放组合。
- 可隐藏的每日名言与自然风景玻璃卡片，中英文界面切换。
- 独立 Chromium 参考浏览器，支持页面脚本、登录、后退前进和下载；网站自身的访问限制与网络条件仍然适用。
- AI 计划助手：读取本地 PDF、Word 和文本资料，根据截止日期和可投入工时预览任务拆解与排程。
- 桌面伙伴：6 个内置伙伴的 16 种动作各有 16 帧；更新后新生成的伙伴每个动作也使用 16 张连续图像，共 256 帧。旧照片与旧 4 帧动作包继续兼容，安装更新不会自动调用 AI 或重绘已有伙伴。

### 与伙伴创建任务或项目

在主窗口或原生桌宠的「聊天」中描述新任务或项目，伙伴会在需要时追问，再给出方案预览。可继续聊天修改方案或取消；只有确认后才会保存到本机工作区。日期与工时均可留空，普通聊天不会自动创建任务。

每个窗口分别保存各伙伴的本地对话、未发送文字与待确认方案，关闭、刷新或重启后可恢复。创建结果未确认时，请先重试同一请求；它会检查本机保存记录，避免重复创建，确认保存前不能改成新请求。向 AI 发送的内容限于当前对话、当天日期、待完善方案和伙伴资料，不会自动发送已有工作区或照片。

0.3.9 已移除微信小程序和配对、云同步模块；本机工作区、旧恢复草稿和本地保存能力继续保留。

### 伙伴生成与恢复

生成窗口可以暂时收起，应用保持运行时会在后台继续。导航栏显示已完成动作数，点击即可返回；完成后会提醒保存并重新打开预览。如果你正在编辑任务或其他弹窗，预览会等该窗口关闭后再出现。收起未保存的结果会保留照片、设置和全部动作，并提醒从导航栏返回保存。

参考照片会先缩放，连同设置和已完成动作暂存于本机 IndexedDB 恢复草稿。刷新或重新启动后可以继续剩余动作，恢复草稿不会自动调用 AI。每页动作会先保存进度，再请求下一页；暂存失败会暂停生成。保存伙伴或确认「放弃草稿」后，会清除草稿中的参考照片。

改名字或性格保留已有动作；更换照片、修改会影响形象的设置或重新生成全部动作，需要确认后才清除结果。完整结果的主按钮只打开预览，保存失败可直接重试。生成中、完整伙伴尚未保存或草稿暂存异常时，刷新或真正退出应用会先提醒确认；普通收起窗口不会取消生成。

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

统一发布使用仓库的 **Actions → Desktop release**（`.github/workflows/desktop-release.yml`）：推送到 `codex/release-*` 分支或手动运行，会在 Windows、Apple 芯片 Mac 和 Intel Mac 上分别原生构建与验证；三个平台全部通过后，才发布同一个版本的安装包和合并后的 SHA-256 文件。独立 Mac 签名、公证测试仍可使用 **macOS desktop** 工作流，配置见 [Mac 发布流程](docs/macos-install.md#维护者构建与发布)。

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

### 键盘农场（db-console 的 Queues 分区 / tracer 的 Garden 分区）

**Queues（db-console）和 Garden（tracer）是同一个挂机游戏的两个入口**，玩法取自《Typing Farmer / 指尖农场》的核心创意：**键盘就是农田**。

每个按键是一块地，在这个控制台里敲一下字，对应的地块就长一格；成熟后自动收进仓库并续种。农场标签页下方带一块便签，是最顺手的输入面（看着就是个 scratch 查询框）。由此产生一层很轻的策略：把高价值作物放在常敲的键上，把便宜快熟的放在冷门键上。

| 系统 | 说明 |
|---|---|
| 作物 | 15 种，按等级解锁。金币/按键的效率梯度照搬原作：胡萝卜垫底、小麦棉花中坚、彩虹花上层、摇钱树断层第一 |
| 地块 | 整块键盘，按等级逐排解锁（home row → qwerty → zxcv → 数字 → 空格/左键） |
| 下雨 | 每 2 分钟浇进度最低的几块地。这是离线收益的唯一来源，也是原作里用来拉平冷门按键的机制 |
| 仓库 | 分别出售、一键全卖、锁定不卖 |
| 订单 | 价高于直接卖，是换种子的主要动力。4 小时自动刷新，也可花钱刷 |
| 动物 | 8 只。收够它爱吃的作物 → 邮箱来信 → 回信 → 入住，各带一个实打实的增益；喂食涨好感，每级 +1% 售价 |
| 钓鱼 | 修好鱼塘后，鼠标点击自动捞鱼，稀有度差距极大（鲸鱼是后期坑） |
| 番茄钟 | 25/5 分钟。完成一轮额外浇一轮水并给金币——工作和农场是同一件事 |
| 图鉴与统计 | 按键热力图、作物/鱼/动物图鉴、生涯计数 |

花园顶部的 **🌱 显示农场 / Show farm** 可关闭工程伪装，显示农场名称与图标；切换后按钮变为 **工程伪装 / Disguise**，可随时恢复。两种皮肤均显示此按钮，偏好随农场存档保存。灰暗并标注等级的地块仍需达到对应等级才能使用。

三条实现原则写在 [skins/db-console/farm.js](skins/db-console/farm.js) 顶部：**只吃本控制台内的输入**（阅读面板 `.fx-panel` 里的按键一律不计——那是 iframe 里的外部站点，把它的键盘事件接进游戏既无必要也不体面）；按键只记次数、不记顺序也不碰内容；输入监听在脚本加载时就装好，切到别的分区照样记账。

没做原作的装修、动物服装和联机——前两个在一块侧栏面板里价值不大，联机需要服务器。

**Garden 是从 db-console 共享过来的，不是复制或 fork。** 游戏引擎（`farm.js`/`fishing.js`/`combat.js`/`equip.js`/`mining.js`/`magic.js`/`farm.css`）物理上仍然只放在 `skins/db-console/` 一份，`server.js` 里的 `GAME_DIR` 兜底逻辑让 tracer 缺文件时直接从 db-console 目录取——两套皮肤加载的是完全同一份代码，改一处两边同时生效。存档也共用同一个 localStorage 键（`dbconsole.farm.v3`），在 db-console 种的地，切到 tracer 的 Garden 照样在，反过来也一样。

tracer 里 `Ctrl+Alt+G` 是老板键：一键隐藏 Garden——导航栏里的入口消失，如果正停在 Garden 会自动跳回上一个分区，隐藏状态会记住。同一组合键在游戏内部还绑了「切换伪装文案」（上面提到的 🌱），两个监听会抢；tracer 的老板键处理器注册得更早并用 `stopImmediatePropagation` 挡住后注册的同键监听，因此 `Ctrl+Alt+G` 在 tracer 里只做「隐藏」，不会跟文案切换混在一起触发两次。

皮肤与引擎的契约只有两条：

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
