# Tracer 0.3.9 macOS 测试包说明

0.3.9 支持与伙伴聊出任务或项目：伙伴会补问关键缺口，整理成可预览的方案，只有你确认后才写入工作区。主窗口和原生桌宠都能使用；日期和工时可留空，对话与待确认方案保存在本机，创建结果未确认时可重试同一请求，避免重复添加。

仍可单独重新生成不满意的伙伴动作，保存前保留原动作和养成进度；含保留旧帧与新动作的导出文件，最低仍需 Tracer 0.3.8 打开。

本版本与 Windows 共用 [0.3.9 发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.9)，提供 Apple Silicon 与 Intel 原生 Mac 安装包。下载与自己芯片匹配的 DMG，打开后将 Tracer 拖入 Applications（应用程序）。无需安装 Node.js 或 Codex。

- Apple 芯片（M 系列）：[Tracer-0.3.9-mac-arm64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-arm64.dmg) · [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-arm64.zip)。
- Intel：[Tracer-0.3.9-mac-x64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-x64.dmg) · [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-x64.zip)。
- 两种 Mac 架构与 Windows EXE、blockmap 索引共用 [SHA256SUMS-0.3.9.txt](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/SHA256SUMS-0.3.9.txt)。

**这是 ad-hoc 签名测试版，尚未获得 Apple Developer ID 签名与公证。** macOS 可能阻止首次打开。请只从本仓库下载并核对校验值；如确认要测试，可按 macOS「系统设置 → 隐私与安全性」中的「仍要打开」提示处理。无需关闭 Gatekeeper，也不需要执行移除隔离标记的命令。希望正常首次打开的用户应等待正式签名版本。

0.3.9 的三平台云端构建和安装包验收结果待本次发布流程完成后补充。以下为本版本的目标下载地址；附件只在 Windows x64、Mac arm64 与 Mac x64 的原生构建和验证全部通过后发布。

Desktop release 工作流会在 Windows x64、Mac arm64 与 Mac x64 上执行核心与桌面测试，以及打包应用主窗口、原生桌宠窗口 16 帧播放、新格式导入导出和旧格式导入、动画资源与源码一致性检查。伙伴生成恢复与聊天创建使用隔离用户目录、本地合成图及模拟 AI 响应验证，不消耗真实 AI 额度。本次测试数量、安装包验收结果和构建记录待发布验证完成后补充。

Mac 真实账号 AI 登录、后台输入授权及未覆盖的界面操作仍需实机验收。

Mac 包含完整 0.3.9 功能：6 个内置伙伴的 16 种动作各有 16 帧，新生成的伙伴每动作 16 帧、共 256 帧；旧照片和旧 4 帧动画包仍可使用。创建完整新伙伴需要 16 次图像生成，安装或升级不会自动调用 AI，也不会重绘已有伙伴。导入导出兼容新旧动画格式。

主窗口和原生桌宠的聊天都可以整理新任务或项目：需要时先追问，预览后由你确认创建，日期和工时可留空。对话、未发送文字和待确认方案保存在各窗口的本机记录中；刷新或重启后可恢复。创建结果未确认时重试同一请求，避免重复添加。不会自动向 AI 发送已有工作区或照片。微信小程序及其配对、云同步入口已移除，本地工作区仍保留。

0.3.9 的生成窗口可暂时收起，应用运行时继续在后台生成，导航栏显示动作进度并提供返回入口。完成后会提醒保存并打开预览；正在编辑其他弹窗时会等待它关闭。未保存的照片、设置和动作会保留，刷新或重启后可从本机 IndexedDB 草稿继续，恢复不会自动请求 AI。

参考照片先缩放，再暂存到本机恢复草稿；保存伙伴或确认「放弃草稿」后清除。每页完成后先保存进度，暂存失败时暂停后续生成。改名字或性格保留动作；更换照片、形象设置或重新生成全部动作需先确认，完整结果的主按钮只打开预览。保存失败可以直接重试。

Mac 操作：Command+Q 退出，Control+Command+F 全屏，Command+E 切换笔记预览，点击 Dock 图标恢复隐藏窗口。生成中、完整伙伴尚未保存或草稿暂存异常时，刷新和真正退出会先提醒确认；普通收起窗口不取消生成。后台输入计数可在 Tracer 菜单中选择启用；未授权时核心任务功能照常使用。

更新前用 Command+Q 彻底退出旧版，再替换「应用程序」中的 Tracer。数据保存在 `~/Library/Application Support/tracer-desktop/`，与程序安装目录分开；正常升级保留任务、设置、桌宠和个人工作区。

维护者的独立签名、公证测试仍使用 **macOS desktop** 工作流；它与此次 **Desktop release** 三平台统一发布流程分开，详见 [Mac 安装与构建指南](macos-install.md)。
