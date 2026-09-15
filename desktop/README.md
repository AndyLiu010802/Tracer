# Tracer 0.3.1 桌面版

Tracer 将任务管理、完成历史、番茄钟、音频、笔记和参考浏览器放在独立 Windows 应用中。0.3.1 默认以无边框全屏启动，使用黑底金色星月 Logo。

**[下载 Windows x64 安装包](https://github.com/AndyLiu010802/Tracer/releases/latest)**：在发布附件中选择 `Tracer-Setup-0.3.1-x64.exe`。安装后通过桌面或开始菜单的「Tracer」打开；终端用户不需要安装 Node.js。升级前从托盘退出旧版，安装到原位置可保留任务、设置与完成历史。

应用依赖和打包配置统一放在**仓库根**的 `package.json` 中，包括 Electron、`uiohook-napi`、PDF/Word 提取依赖和 electron-builder。`desktop/main.js` 会加载上层目录的服务代码，因此构建必须从仓库根开始。本目录的 `package.json` 只是说明性指针，不是独立 npm 项目。

## 窗口操作

- 按 **F11** 或点击右上角全屏按钮进入、退出全屏；任务弹窗及内置参考浏览器获得焦点时也能使用 F11。
- 窗口模式下可拖动应用顶栏。**Esc** 继续关闭弹窗。
- 右上角可最小化窗口，或隐藏到托盘。点击托盘图标恢复窗口；完全退出使用托盘菜单「退出」。
- 重复打开快捷方式会恢复已有窗口。

## AI 计划助手

桌面版在本地提取 PDF、Word 和文本内容，用户同意发送后才向配置的服务请求计划。**真实 AI 服务尚未开通**；运营者还需要部署服务并配置服务器端密钥。安装包没有真实 AI 密钥，自动化测试的可控响应不代表真实模型已连接。

独立部署包沿用 `Tracer-AI-Service-0.3.0.zip`，见 [AI 服务开通指南](../docs/ai-service-setup.md)。AI 账号与各电脑本地工作区分别管理，当前不自动进行跨电脑任务同步。

## 全局输入计数

- **做**：用全局钩子在系统层面**数**「按了一次键 / 点了一次鼠标」，喂给农场。
- **不做**：绝不记录你按了哪个键、拼成什么字、鼠标在哪。种地只要「有一次输入」这个事实，
  从来不需要内容。唯一接触输入的 [`pulse.js`](pulse.js) 只吐 `{ kind: 'key' | 'click' }`，
  `main.js` 的钩子处理器连事件对象都不接收——键位、坐标从源头就够不到。
  这条底线由 `test/pulse.test.js` 守着。

两条闸门保证不重复计数、不越界：

- 窗口**聚焦**时全局脉冲不计——此刻页内输入已由 `farm.js` 自己的监听在数；
  全局钩子只补「窗口失焦、你在别的程序里」的那部分。
- 全局钩子只认 `keydown` / `mousedown`，`keyup`、`mousemove`、`wheel`、`scroll` 都不算。

## 运行

依赖与脚本都在**仓库根**，不是本目录：

```sh
npm ci          # 在仓库根安装锁定版本的依赖
npm start
```

`npm start` 会起一份**专属端口**（默认 `127.0.0.1:8137`，避开浏览器版的 8080）的本地服务，
用 tracer 皮肤打开窗口。桌面参考浏览器使用独立的 Chromium WebContentsView，可以运行页面脚本并保存自己的登录会话；网页开发模式仍使用代理阅读面板。远程网页不拥有主窗口控制或本地 Node.js 权限。

### 存档位置：跟网页版是分开的

**桌面版的存档不落在仓库的 `data/` / `bookmarks.json` 里**，而是 `app.getPath('userData')`
下（Windows 上是 `%APPDATA%\tracer-desktop\`），具体是：

- `<userData>/data/`（任务、项目、笔记、完成历史等工作区数据，对应网页版的 `data/`）
- `<userData>/bookmarks.json`（阅读进度/书签，对应网页版仓库根的 `bookmarks.json`）
- Electron 的本地存储目录（界面偏好、番茄钟、Garden 存档等）及独立浏览器会话目录

安装目录和用户数据目录分开，更新应用时保留工作区。测试应指定独立用户目录，避免与正在使用的桌面工作区混用。

**开发时 `npm start` 默认也使用桌面用户目录**。浏览器模式（`node server.js`）的数据保存在仓库目录，首次启动桌面版不会自动复制浏览器工作区。需要迁移时应先备份，再通过明确的迁移流程处理。

PowerShell 中可为测试使用独立用户目录：

```powershell
$env:TRACER_USER_DATA_DIR = Join-Path (Get-Location) '.cache\desktop-dev-profile'
npm start
```

这会把本次桌面工作区和偏好都放入测试目录。关闭当前 PowerShell 后，后续正常启动仍使用默认用户目录。

### 存档目录名改过一次：`podmatrix-desktop` → `tracer-desktop`

早期桌面壳使用 `podmatrix-desktop` 作为应用目录名，旧的本地存储位于 `%APPDATA%\podmatrix-desktop\`。当前版本固定使用 `%APPDATA%\tracer-desktop\`。

单纯改名会让 Electron 去新目录找存档、找不到就以为「进度全没了」——旧存档其实还在旧目录，
只是没人指过去。`desktop/migrate.js` 处理这件事：应用启动时若新目录（`tracer-desktop`）还没有
存档、且旧目录（`podmatrix-desktop`）存在，就把 `Local Storage` / `Session Storage` **复制**
（不是移动）过去，全程幂等——迁过一次之后不会重复迁移，也不会用旧存档覆盖新存档。**从旧版本
升上来的机器会在下次启动时自动迁移一次**，用户不需要手动做任何事；迁移失败也不会让应用起不来，
只会在控制台留一条错误日志，旧存档原样留在原地等人工处理。

### 后台常驻（托盘）

- **关闭窗口 ≠ 退出**：关掉画面只是缩进系统托盘，服务和全局钩子继续在后台跑，照常计数。
- 托盘使用金色星月图标：左键打开面板；右键菜单提供「打开面板」和「退出」。
- **真正退出**只走托盘菜单的「退出」——那才会停掉钩子和服务。
- 只允许一个实例：重复启动不会再开一个，只会把已在跑的窗口顶到前台（否则会有两个钩子重复计数）。

只跑内容无关性测试（不需要装 Electron）：

```sh
node --test        # 在 desktop/ 下
```

## 构建安装包

从源码出一个可双击安装的 `Setup.exe`（NSIS，Windows）：

```sh
npm ci          # 仓库根，如果还没安装依赖
npm run dist    # electron-builder --win nsis --x64
```

产物在仓库根的 `dist/`（该目录已进 `.gitignore`，不进版本库）：

- `dist/Tracer-Setup-0.3.1-x64.exe` —— 安装程序本身，双击运行
- `dist/Tracer-Setup-0.3.1-x64.exe.blockmap` —— electron-builder 生成的增量更新索引，当前没有配置自动更新
- `dist/win-unpacked/` —— 未打包的调试版应用，供本地核对用，不用来发给别人

安装程序不是一路下一步：`oneClick: false` 会让你选安装目录，默认装到当前用户的
`%LOCALAPPDATA%\Programs\Tracer\`（每用户安装，不需要管理员权限，也不影响同一台机器上的其他账户）。
装完会建开始菜单项和桌面快捷方式，都叫「Tracer」。

**卸载**：控制面板「程序和功能」（或系统设置的「应用」列表）里找到「Tracer」，走系统卸载即可；
NSIS 卸载程序会清掉安装目录和开始菜单/桌面快捷方式，但**不会**动 `%APPDATA%\tracer-desktop\`
里的存档——那是用户数据，跟程序本体分开清理是故意的（多数正经软件也这么做）。要连存档一起清，
手动删这个目录。

### 发布文件与校验

安装包目前未签名。正式下载附件提供 `SHA256SUMS-0.3.1.txt`，可用 PowerShell 的 `Get-FileHash` 核对文件 SHA-256。Windows 是否显示安装提示取决于系统配置和文件来源。

```powershell
Get-FileHash -Algorithm SHA256 .\Tracer-Setup-0.3.1-x64.exe
```

共享安装包包含应用与音频，不包含开发机的工作区、登录令牌或 AI 服务密钥。用户数据和运行缓存不应加入源码仓库或安装程序。
