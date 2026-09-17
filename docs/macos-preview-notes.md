# Tracer 0.3.6 macOS 测试包说明

本版本与 Windows 共用 [0.3.6 发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.6)，提供 Apple Silicon 与 Intel 原生 Mac 安装包。下载与自己芯片匹配的 DMG，打开后将 Tracer 拖入 Applications（应用程序）。无需安装 Node.js 或 Codex。

- Apple 芯片（M 系列）：[Tracer-0.3.6-mac-arm64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-arm64.dmg) · [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-arm64.zip)。
- Intel：[Tracer-0.3.6-mac-x64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-x64.dmg) · [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-x64.zip)。
- 两种 Mac 架构与 Windows EXE 共用 [SHA256SUMS-0.3.6.txt](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/SHA256SUMS-0.3.6.txt)。

**这是 ad-hoc 签名测试版，尚未获得 Apple Developer ID 签名与公证。** macOS 可能阻止首次打开。请只从本仓库下载并核对校验值；如确认要测试，可按 macOS「系统设置 → 隐私与安全性」中的「仍要打开」提示处理。无需关闭 Gatekeeper，也不需要执行移除隔离标记的命令。希望正常首次打开的用户应等待正式签名版本。

Windows x64、Mac arm64 与 Mac x64 各自通过 549 项核心测试和 13 项桌面测试（每个平台 562 项），以及真实打包应用在全新用户目录中的主窗口、原生桌宠窗口 16 帧播放、新格式导入导出和旧格式导入、动画资源和源码一致性检查。三个平台使用相同的 252 个应用源码文件。见 [Desktop release 构建记录](https://github.com/AndyLiu010802/Tracer/actions/runs/35165754413)。

本地最终 Windows 产物 `dist/0.3.6-final` 已通过包内容与校验值检查，但本机 Windows Application Control 阻止了它的原生执行；最终版本的启动与交互验证结论来自云端原生检查。Mac 真实账号 AI 登录、后台输入授权及未覆盖的界面操作仍需实机验收。

Mac 包含完整 0.3.6 功能：6 个内置伙伴的 16 种动作各有 16 帧，新生成的伙伴每动作 16 帧、共 256 帧；旧照片和旧 4 帧动画包仍可使用。创建完整新伙伴需要 16 次图像生成，安装或升级不会自动调用 AI，也不会重绘已有伙伴。导入导出兼容新旧动画格式。

Mac 操作：Command+Q 退出，Control+Command+F 全屏，Command+E 切换笔记预览，点击 Dock 图标恢复隐藏窗口。后台输入计数可在 Tracer 菜单中选择启用；未授权时核心任务功能照常使用。

更新前用 Command+Q 彻底退出旧版，再替换「应用程序」中的 Tracer。数据保存在 `~/Library/Application Support/tracer-desktop/`，与程序安装目录分开；正常升级保留任务、设置、桌宠和个人工作区。

维护者的独立签名、公证测试仍使用 **macOS desktop** 工作流；它与此次 **Desktop release** 三平台统一发布流程分开，详见 [Mac 安装与构建指南](macos-install.md)。
