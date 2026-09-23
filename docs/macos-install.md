# Tracer for macOS

当前开发源码使用 Electron 44，要求 **macOS 13 Ventura 或更新版本**；Apple Silicon 使用 `arm64`，Intel 使用 `x64`。此要求已写入打包配置。参见 [Electron 44 系统支持说明](https://www.electronjs.org/blog/electron-44-0)。下方 0.4.0 发布记录对应已通过云端原生运行环境验收的源码。

新增 `.github/workflows/desktop-checks.yml`：PR 或手动触发后，在 Windows、Mac arm64、Mac x64 上运行测试。Mac 还会构建并检查实际安装包，再测试笔记快捷键、保存与重载、最小化后视觉暂停、后台专注结算及 Dock 恢复；不发布安装包。运行中的 AI 登录、真实设备系统权限及签名公证仍按下方发布流程验收。

0.4.0 加入本地账户、种植金币商店、30 款壁纸与材质、笔记贴纸及九款异色伙伴专属拖尾。任务完成后花朵成熟；清除已完成卡片仍保留花朵，项目归档后可收藏花朵星球。旧休闲区存档保留在本机。

仍可单独重新生成不满意的伙伴动作，保存前保留原动作和养成进度；含保留旧帧与新动作的导出文件，最低仍需 Tracer 0.3.8 打开。

## 当前状态

**[Tracer 0.4.0 统一发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.4.0)**同时分发 Windows、Apple Silicon 和 Intel 的安装包。两种 Mac 架构各提供 DMG、ZIP，另有 Windows blockmap 索引，六个附件共用 `SHA256SUMS-0.4.0.txt`。

0.4.0 Mac 包使用与 Windows 相同版本的功能，包含本地账户、外观收藏与异色伙伴专属拖尾。伙伴聊天追问、方案预览、确认创建，生成进度、后台继续、本机草稿恢复和误触保护继续保留；内置伙伴的 16 帧动作、新生成伙伴的 256 帧格式、旧照片和旧 4 帧动作包也继续兼容。安装更新不会自动调用 AI 或重绘已有伙伴。

**0.4.0 已发布并完成验证。** [统一下载页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.4.0)提供 Windows x64、Apple 芯片 Mac 与 Intel Mac 安装包。三个平台均通过 **654 项核心测试、23 项桌面测试**，以及实际打包应用中的账户隔离、九款拖尾、伙伴动画、保存恢复和后台计时验收；七项公开附件、下载地址与统一 SHA-256 校验值已核验。[查看本次构建记录](https://github.com/AndyLiu010802/Tracer/actions/runs/35834504837)。


**Mac 包为 ad-hoc 签名，尚未经过 Apple Developer ID 签名与公证。** 真实账号 AI 登录、后台输入授权及未覆盖的界面操作仍需实机验收。首次打开的系统提示见 [测试包说明](macos-preview-notes.md)。Windows 的 `.exe` 不能用于 Mac。

## 选择下载文件

在苹果菜单 →「关于本机」查看芯片类型，在 [0.4.0 发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.4.0)中选择：

| Mac 类型 | 安装包 | 备用压缩包 |
| --- | --- | --- |
| Apple 芯片（M 系列） | [Tracer-0.4.0-mac-arm64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.0/Tracer-0.4.0-mac-arm64.dmg) | [Tracer-0.4.0-mac-arm64.zip](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.0/Tracer-0.4.0-mac-arm64.zip) |
| Intel 处理器 | [Tracer-0.4.0-mac-x64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.0/Tracer-0.4.0-mac-x64.dmg) | [Tracer-0.4.0-mac-x64.zip](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.0/Tracer-0.4.0-mac-x64.zip) |

打开 DMG，将 **Tracer 拖入 Applications（应用程序）**，弹出磁盘映像，再从「应用程序」或 Spotlight 启动。ZIP 需解压后将 `Tracer.app` 放入「应用程序」。终端用户无需安装 Node.js 或 Codex。

更新前用 **Command+Q** 退出旧版，再替换「应用程序」中的 Tracer。工作区保存在 `~/Library/Application Support/tracer-desktop/`，替换程序不会删除该目录；不同电脑之间的数据不会自动迁移。

0.4.0 统一发布中的 Mac 附件与未启用正式签名的独立 `preview` 附件均为 ad-hoc 签名，不能视为已公证正式版。若 macOS 阻止打开，按下方测试包说明处理，或等待 Developer ID 签名并经过 Apple 公证的版本；不需要关闭系统安全保护。

统一发布附有 [SHA256SUMS-0.4.0.txt](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.0/SHA256SUMS-0.4.0.txt)，同时覆盖 Windows EXE、[blockmap 索引](https://github.com/AndyLiu010802/Tracer/releases/download/v0.4.0/Tracer-Setup-0.4.0-x64.exe.blockmap)和两种 Mac 架构的 DMG、ZIP；blockmap 无需单独安装。在下载目录执行以下命令，与校验文件中对应文件名的条目比较：

```sh
shasum -a 256 Tracer-0.4.0-mac-*.dmg
```

## Mac 上的功能与操作

伙伴家园按任务种植：任务开始进行时自动种下随机种子，完成后成熟。每页六块花圃，同一项目可以拥有多株植物。清除已完成卡片后，成熟花朵仍留在花园等待手动收获；收获累计植物图鉴和种植金币，可购买外观并保存在当前本地账户。

项目完成归档后可收藏并旋转查看花朵星球。当前选择的内置或自定义伙伴继续住在家园；九款异色伙伴可分别开启专属鼠标拖尾。任务花园随工作区按账户隔离保存。详见[任务花园与花朵星球](task-garden-and-planets.md)和[专注与家园说明](focus-and-appearance.md)。

0.4.0 包含任务、项目、笔记、完成历史、番茄钟、音频、参考浏览器、PDF/Word 提取、个人 AI 和桌面伙伴。6 个内置伙伴的 16 种动作各有 16 个不同姿态；新生成的伙伴为每动作 16 张连续图像、总计 256 帧，导入导出同时兼容新旧动作包。创建完整新伙伴需要 16 次图像生成，失败重试保留已完成动作，不会在安装、升级或恢复草稿时自动生成。

主窗口和原生桌宠的聊天都可以整理新任务或项目：需要时先追问，预览后由你确认创建，日期和工时可留空。对话、未发送文字和待确认方案保存在各窗口的本机记录中；刷新或重启后可恢复。创建结果未确认时重试同一请求，避免重复添加。不会自动向 AI 发送已有工作区或照片。微信小程序及其配对、云同步入口已移除，本地工作区仍保留。

生成窗口可以暂时收起，应用运行时会继续生成，导航栏显示动作进度并提供返回入口。完成后会提醒保存并打开预览；若正在编辑其他弹窗，会等它关闭后再出现。未保存时收起窗口，照片、设置和结果仍然保留。

参考照片先缩放，再连同设置和已完成动作暂存于本机 IndexedDB 草稿；刷新或重新启动后可以继续剩余动作。每页动作先保存进度，再开始下一页，暂存失败会暂停生成。保存伙伴或确认「放弃草稿」后清除草稿中的照片。名字和性格可直接修改；更换照片、形象设置或重新生成全部动作需先确认，完整结果的主按钮只预览。

AI 运行时会随芯片架构一起打包，登录凭据使用当前 Mac 的用户环境。真实账号登录、音频及系统权限仍需在 Mac 上完成最终验收。

- **Command+C / V / X / Z / A**：通过原生「编辑」菜单复制、粘贴、剪切、撤销、全选。
- **Control+Command+F**、F11 或右上角全屏按钮：切换全屏。
- **Command+E**：笔记编辑与预览切换；Ctrl+E 仍可用。
- **Command+W** 或右上角关闭按钮：隐藏主窗口并继续后台运行。
- 点击 **Dock** 中的 Tracer 图标，或菜单栏图标 →「打开面板」：恢复窗口。
- **Command+Q** 或 Tracer 菜单 →「退出」：完全退出应用。生成中、完整伙伴尚未保存或草稿暂存异常时会先提醒确认；选择留下会继续运行。

可选的后台输入计数需要 macOS 系统权限，任务花园不使用输入次数。首次启动不会自动弹出授权请求；未授权时仅统计窗口内输入，任务和其他核心功能仍可用。需要后台计数时，选择 Tracer 菜单 →「启用后台输入计数」，在系统设置的「隐私与安全性 → 辅助功能」中授权 Tracer；如系统要求，也检查「输入监控」，然后重新启动应用。计数器只使用匿名的按键/点击次数，不保存输入内容。

## 维护者构建与发布

### 在 Mac 本机构建

仓库根目录使用 Node.js 22.12 或更新的兼容版本：

```sh
npm ci
npm test
npm run test:desktop
npm run dist:mac
node dev/verify-macos-release.cjs
```

`dist:mac` 默认按本机 Node 进程架构构建；请在 Apple 芯片 Mac 上使用原生 arm64 Node，在 Intel Mac 上使用 x64 Node。显式命令为 `npm run dist:mac:arm64`、`npm run dist:mac:x64`。每个架构输出 `dist/Tracer-<版本>-mac-<架构>.dmg` 和 `.zip`。验证脚本必须在对应原生架构上运行，成功后生成 SHA-256 文件。

构建钩子从官方 npm 注册表下载锁定版本的 Codex，校验固定 SHA-512 后再解包。Mac 与 Windows 运行时使用独立缓存和打包路径；缓存、个人存档、开发配置及账号凭据不进入安装包。开发模式如需使用 AI，可先执行 `node dev/prepare-codex-runtime.cjs`，再运行 `npm start`。

默认 Mac 构建使用 ad-hoc 签名用于本地测试。正式构建设置 `TRACER_MAC_SIGNED=1`，提供 Developer ID Application 证书与公证凭据后再次构建；缺少有效证书会让正式构建失败，不会悄悄降级为未签名版本。

### GitHub 云端构建

统一发布使用 `.github/workflows/desktop-release.yml`，在 **Actions → Desktop release → Run workflow** 手动运行，或推送到 `codex/release-*` 分支触发。它会在 Windows x64、Apple 芯片 Mac 和 Intel Mac 的原生构建机上分别安装依赖、测试、构建并验证安装包。三个平台全部通过后，才在 `v<版本>` 的同一个公开 Release 中发布 Windows EXE 及 blockmap 索引、两个 Mac DMG、两个 Mac ZIP，以及合并后的 `SHA256SUMS-<版本>.txt`。0.4.0 的 Mac 产物使用 ad-hoc 签名，工作流的自动检查不等于 Developer ID 签名或 Apple 公证。

### 独立 Mac 签名与公证测试

保留的 `.github/workflows/macos-desktop.yml` 用于独立 Mac 测试和正式签名、公证流程。在 **Actions → macOS desktop → Run workflow** 运行，使用 `macos-15`（arm64）和 `macos-15-intel`（x64）两台原生构建机。这个流程与上述三平台统一发布分开。

不勾选 `signed` 时生成 ad-hoc 签名测试附件。推送代码到 `codex/macos-support` 分支也会自动构建；两种架构都通过后，发布带独立版本标签的公开 preview 下载，不覆盖统一发布。仅修改 Markdown 不触发这个独立流程重新构建。正式构建前，在仓库 **Settings → Secrets and variables → Actions** 中配置以下 Secrets；不要将它们写进代码或聊天：

| Secret | 内容 |
| --- | --- |
| `CSC_LINK` | Developer ID Application `.p12` 证书的 Base64 内容 |
| `CSC_KEY_PASSWORD` | 证书导出密码 |
| `APPLE_ID` | Apple 开发者账号 |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple 应用专用密码 |
| `APPLE_TEAM_ID` | Apple 开发者团队 ID |

勾选 `signed` 后会签名、公证，并验证签名、公证票据和 Gatekeeper。构建及验证通过后，两种架构的 DMG、ZIP、SHA-256 文件分别保存在工作流 Artifacts 中，可供有仓库访问权限的测试者下载。

同时勾选 `release_draft`，会在两种架构都成功后生成 `v<版本>-mac` 的 **GitHub Release 草稿**，供维护者验收后发布。草稿发布后，普通用户才能在 Releases 中直接下载。重复运行同版本时，已有标签/Release 会导致创建步骤失败；请使用新的版本号或人工管理既有草稿，流程不会自动覆盖旧附件。

自动验证覆盖安装包隐私检查、源码一致性、AI 可执行文件架构及运行、签名、应用主进程和本地服务启动。它不代替 GUI 实机验收。正式发布前检查：任务与笔记编辑、复制粘贴、全屏/Dock 恢复、升级保留数据、资料导入、音频、权限拒绝与授权，以及真实账号 AI 登录。

参考：[electron-builder v26 Mac 配置](https://www.electron.build/v26/docs/mac/)、[Electron 签名与公证](https://www.electronjs.org/docs/latest/tutorial/code-signing)、[GitHub 原生构建机](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)。
