# Tracer 0.3.10 — 伙伴家园

伙伴家园把项目、专注与当前伙伴放在同一个地方。为项目种一株植物，已保存的工作成果会带动花圃成长；无需额外打卡或每日照料。

## 项目花圃

- 最多为 6 个项目种植野花、向日葵或薰衣草。初次种植吸收已有历史，不弹出批量通知。
- 每项不同的已完成任务与每累计 25 分钟关联专注积累成长。同一任务反复完成、同一轮专注重复读取不重复计入。
- 植物经历种子、发芽、成长和花苞；项目至少有一项当前任务，且当前任务全部完成或项目已标为完成时，首次盛放并记录日期。
- 花圃另外显示真实的当前完成数与任务总数。之后新增或重开任务、历史截断、休息和逾期不会让成长倒退，也不会抹去首次盛放日期。
- 家园沿用当前选择的内置或自定义伙伴。可以从项目打开花圃、从花圃返回项目，或为下一项任务打开专注计时器；本轮专注开始后保留任务的项目归属。
- 「本次进展」只显示本次打开应用期间的新任务、专注和盛放反馈。阶段、累计完成数、专注分钟和首次盛放日期保存在本机，重启后仍保留。

移除花圃保留项目与任务；删除项目会清理对应花圃。原农场、仓库、钓鱼、收藏和冒险保留在「休闲区」，沿用原存档，与项目花圃独立。

## 保留的功能

主窗口与原生桌宠继续支持伙伴聊天、追问、方案预览和确认创建任务或项目；日期与工时可留空，本地会话与待确认方案可恢复，同一创建请求可以安全重试。

伙伴生成进度、后台继续、本机草稿恢复和单动作重生成继续保留。6 个内置伙伴的 16 种动作各有 16 帧；新生成伙伴每动作 16 帧，共 256 帧。旧照片、旧 4 帧动作和保留旧帧的编辑结果继续兼容，混合旧帧与新动作的导出文件最低需 Tracer 0.3.8。安装更新不会自动调用 AI 或重绘已有伙伴。

## 发布与安装

**0.3.10 已发布并完成验证。** [统一下载页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.10)提供 Windows x64、Apple 芯片 Mac 与 Intel Mac 安装包。三个平台均通过 **647 项核心测试、16 项桌面测试**，以及实际打包应用中的伙伴动画、家园种植、任务盛放和重启去重验收；七项公开附件、下载地址与统一 SHA-256 校验值已核验。[查看本次构建记录](https://github.com/AndyLiu010802/Tracer/actions/runs/35178952827)。

已在 [Tracer 0.3.10 统一发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.10)提供以下七项附件：

| 用途 | 文件 |
| --- | --- |
| Windows x64 安装 | `Tracer-Setup-0.3.10-x64.exe` |
| Windows 安装包索引，无需单独安装 | `Tracer-Setup-0.3.10-x64.exe.blockmap` |
| Apple 芯片 Mac 安装 | `Tracer-0.3.10-mac-arm64.dmg` |
| Apple 芯片 Mac 备用压缩包 | `Tracer-0.3.10-mac-arm64.zip` |
| Intel Mac 安装 | `Tracer-0.3.10-mac-x64.dmg` |
| Intel Mac 备用压缩包 | `Tracer-0.3.10-mac-x64.zip` |
| 六个安装附件的 SHA-256 校验值 | `SHA256SUMS-0.3.10.txt` |

Windows 运行 EXE；Mac 打开对应芯片的 DMG，将 Tracer 拖入「应用程序」。无需另装 Node.js 或 Codex。更新前彻底退出旧版，再安装到原位置，任务、设置、伙伴和个人工作区保留。

Windows 安装包目前未签名；Mac 包使用 ad-hoc 签名，尚未获得 Apple Developer ID 签名与公证。真实账号 AI 登录、后台输入授权及未覆盖的界面操作仍需实机验收。

本地 Windows 安装包的 259 个源码文件已与发布源码逐字节核对；三平台使用同一提交 [d7d3fb72dc52a2ed32a1b4fec0d5a7f3dfa5e253](https://github.com/AndyLiu010802/Tracer/commit/d7d3fb72dc52a2ed32a1b4fec0d5a7f3dfa5e253)。家园的保存失败重试、多窗口保护、旧农场存档保留和中英文窄屏检查均已通过。自动化 AI 场景使用模拟响应与本地合成图，不消耗真实 AI 额度。

操作说明见 [Mac 安装指南](https://github.com/AndyLiu010802/Tracer/blob/codex/release-0.3.10/docs/macos-install.md)、[Mac 测试包说明](https://github.com/AndyLiu010802/Tracer/blob/codex/release-0.3.10/docs/macos-preview-notes.md)和[专注与家园说明](https://github.com/AndyLiu010802/Tracer/blob/codex/release-0.3.10/docs/focus-and-appearance.md)。
