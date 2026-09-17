# Tracer 0.3.10 for macOS — 伙伴家园

0.3.10 为最多 6 个项目提供花圃，可选野花、向日葵和薰衣草。已保存的不同完成任务与每累计 25 分钟关联专注积累成长，重复完成或重读记录不重复计入。当前任务全部完成且至少有一项时首次盛放，记录日期；后续新增任务、休息或逾期不会让成长倒退。

家园沿用当前的内置或自定义伙伴。「本次进展」只展示本次打开应用中的新增反馈；阶段、累计记录和首次盛放日期保存在本机。原农场、收藏与冒险在休闲区保留原存档。伙伴聊天创建、生成草稿恢复和单动作重生成继续保留。

**0.3.10 已发布并完成验证。** [统一下载页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.10)提供 Windows x64、Apple 芯片 Mac 与 Intel Mac 安装包。三个平台均通过 **647 项核心测试、16 项桌面测试**，以及实际打包应用中的伙伴动画、家园种植、任务盛放和重启去重验收；七项公开附件、下载地址与统一 SHA-256 校验值已核验。[查看本次构建记录](https://github.com/AndyLiu010802/Tracer/actions/runs/35178952827)。

- [0.3.10 统一发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.10)已提供 Windows、Apple Silicon 与 Intel 的同版本安装包。
- Apple 芯片（M 系列）：`Tracer-0.3.10-mac-arm64.dmg`。
- Intel 芯片：`Tracer-0.3.10-mac-x64.dmg`。
- 打开 DMG，将 Tracer 拖入 Applications（应用程序），再启动 Tracer。无需另装 Node.js 或 Codex。
- 本地任务、笔记、完成历史与设置保存在 `~/Library/Application Support/tracer-desktop/`。
- 支持 Command+C/V/X/Z/A、Command+Q、Control+Command+F；点击 Dock 图标可恢复已隐藏的窗口。
- 休闲区农场的后台输入计数是可选功能。在 Tracer 菜单中启用，并按系统提示授予辅助功能权限；按需检查输入监控权限，重新启动应用。未授权时仍可使用任务、笔记、专注与窗口内计数。项目花圃不依赖输入次数。
- 各架构另有 ZIP，统一使用 `SHA256SUMS-0.3.10.txt` 核验。

Mac 包使用 ad-hoc 签名，尚未获得 Apple Developer ID 签名与公证。真实账号 AI 登录、系统输入权限及未覆盖的界面操作仍需实机验收。安装与首次打开说明见 [Mac 安装指南](macos-install.md)。
