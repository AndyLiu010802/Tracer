# Tracer macOS 测试版

本版本增加 Apple Silicon 与 Intel 原生 Mac 安装包。下载与自己芯片匹配的 DMG，打开后将 Tracer 拖入 Applications（应用程序）。无需安装 Node.js 或 Codex。

- Apple 芯片（M 系列）：`Tracer-<版本>-mac-arm64.dmg`
- Intel：`Tracer-<版本>-mac-x64.dmg`
- ZIP 为备用分发格式；每种架构均附有 SHA-256 校验文件。

**这是 ad-hoc 签名测试版，尚未获得 Apple Developer ID 签名与公证。** macOS 可能阻止首次打开。请只从本仓库下载并核对校验值；如确认要测试，可按 macOS「系统设置 → 隐私与安全性」中的「仍要打开」提示处理。无需关闭 Gatekeeper，也不需要执行移除隔离标记的命令。希望正常首次打开的用户应等待正式签名版本。

两种架构均经过原生云端构建、自动测试、安装包检查和本地服务启动检查。界面实机操作、真实账号 AI 登录及后台输入权限仍待用户验收。

Mac 操作：Command+Q 退出，Control+Command+F 全屏，Command+E 切换笔记预览，点击 Dock 图标恢复隐藏窗口。后台输入计数可在 Tracer 菜单中选择启用；未授权时核心任务功能照常使用。

数据保存在 `~/Library/Application Support/tracer-desktop/`，与程序安装目录分开。
