# Tracer for macOS

## 当前状态

**[Tracer 0.3.6 统一发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.6)**同时分发 Windows、Apple Silicon 和 Intel 的安装包。两种 Mac 架构各提供 DMG、ZIP，五个下载文件共用 `SHA256SUMS-0.3.6.txt`。

0.3.6 Mac 包使用与 Windows 相同版本的功能，包括内置伙伴的 16 帧动作、更新后生成伙伴的 256 帧格式，以及旧照片和旧 4 帧动作包的兼容支持。安装更新不会自动调用 AI 或重绘已有伙伴。

**Desktop release** 工作流会在三个平台分别原生构建与验证，并且只有全部成功后才发布附件；发布页尚未出现附件时，表示构建或发布还未完成。本次云端验证结果以工作流记录为准，本说明不代表 0.3.6 Mac 云端检查已经运行通过。本地 Windows 0.3.6 的真实打包应用已通过全新用户目录启动与交互检查。

**Mac 包为 ad-hoc 签名，尚未经过 Apple Developer ID 签名与公证。** GUI 实机操作、真实账号 AI 和后台输入权限仍待验收。首次打开的系统提示见 [测试包说明](macos-preview-notes.md)。Windows 的 `.exe` 不能用于 Mac。

## 选择下载文件

在苹果菜单 →「关于本机」查看芯片类型，在 [0.3.6 发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.6)中选择：

| Mac 类型 | 安装包 | 备用压缩包 |
| --- | --- | --- |
| Apple 芯片（M 系列） | [Tracer-0.3.6-mac-arm64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-arm64.dmg) | [Tracer-0.3.6-mac-arm64.zip](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-arm64.zip) |
| Intel 处理器 | [Tracer-0.3.6-mac-x64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-x64.dmg) | [Tracer-0.3.6-mac-x64.zip](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-x64.zip) |

打开 DMG，将 **Tracer 拖入 Applications（应用程序）**，弹出磁盘映像，再从「应用程序」或 Spotlight 启动。ZIP 需解压后将 `Tracer.app` 放入「应用程序」。终端用户无需安装 Node.js 或 Codex。

更新前用 **Command+Q** 退出旧版，再替换「应用程序」中的 Tracer。工作区保存在 `~/Library/Application Support/tracer-desktop/`，替换程序不会删除该目录；不同电脑之间的数据不会自动迁移。

0.3.6 统一发布中的 Mac 附件与未启用正式签名的独立 `preview` 附件均为 ad-hoc 签名，不能视为已公证正式版。若 macOS 阻止打开，按下方测试包说明处理，或等待 Developer ID 签名并经过 Apple 公证的版本；不需要关闭系统安全保护。

统一发布附有 [SHA256SUMS-0.3.6.txt](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/SHA256SUMS-0.3.6.txt)，同时覆盖 Windows EXE 和两种 Mac 架构的 DMG、ZIP。在下载目录执行以下命令，与校验文件中对应文件名的条目比较：

```sh
shasum -a 256 Tracer-0.3.6-mac-*.dmg
```

## Mac 上的功能与操作

0.3.6 包含任务、项目、笔记、完成历史、番茄钟、音频、参考浏览器、PDF/Word 提取、个人 AI 和桌面伙伴。6 个内置伙伴的 16 种动作各有 16 个不同姿态；新生成的伙伴为每动作 16 张连续图像、总计 256 帧，导入导出同时兼容新旧动作包。创建完整新伙伴需要 16 次图像生成，失败重试保留当前创建会话内已完成的动作，不会在安装或升级时自动生成。

AI 运行时会随芯片架构一起打包，登录凭据使用当前 Mac 的用户环境。真实账号登录、音频及系统权限仍需在 Mac 上完成最终验收。

- **Command+C / V / X / Z / A**：通过原生「编辑」菜单复制、粘贴、剪切、撤销、全选。
- **Control+Command+F**、F11 或右上角全屏按钮：切换全屏。
- **Command+E**：笔记编辑与预览切换；Ctrl+E 仍可用。
- **Command+W** 或右上角关闭按钮：隐藏主窗口并继续后台运行。
- 点击 **Dock** 中的 Tracer 图标，或菜单栏图标 →「打开面板」：恢复窗口。
- **Command+Q** 或 Tracer 菜单 →「退出」：完全退出应用。

花园的后台输入计数需要 macOS 系统权限。首次启动不会自动弹出授权请求；未授权时仅统计窗口内输入，任务和其他核心功能仍可用。需要后台计数时，选择 Tracer 菜单 →「启用后台输入计数」，在系统设置的「隐私与安全性 → 辅助功能」中授权 Tracer；如系统要求，也检查「输入监控」，然后重新启动应用。计数器只使用匿名的按键/点击次数，不保存输入内容。

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

统一发布使用 `.github/workflows/desktop-release.yml`，在 **Actions → Desktop release → Run workflow** 手动运行，或推送到 `codex/release-*` 分支触发。它会在 Windows x64、Apple 芯片 Mac 和 Intel Mac 的原生构建机上分别安装依赖、测试、构建并验证安装包。三个平台全部通过后，才在 `v<版本>` 的同一个公开 Release 中发布 Windows EXE、两个 Mac DMG、两个 Mac ZIP，以及合并后的 `SHA256SUMS-<版本>.txt`。0.3.6 的 Mac 产物使用 ad-hoc 签名，工作流的自动检查不等于 Developer ID 签名或 Apple 公证。

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
