# Tracer 0.3.6 — 更完整的伙伴动作

## 下载与升级

[0.3.6 统一发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.6)将提供同一版本的 Windows 和两种 Mac 架构安装包。附件由 **Desktop release** 云端工作流在三个平台的构建、测试和安装包检查全部通过后发布；附件尚未出现时，表示构建或发布仍未完成。

| 平台 | 安装包 | 备用格式 |
| --- | --- | --- |
| Windows x64 | [Tracer-Setup-0.3.6-x64.exe](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-Setup-0.3.6-x64.exe) | — |
| Mac Apple 芯片 | [Tracer-0.3.6-mac-arm64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-arm64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-arm64.zip) |
| Mac Intel | [Tracer-0.3.6-mac-x64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-x64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/Tracer-0.3.6-mac-x64.zip) |

使用统一的 [SHA256SUMS-0.3.6.txt](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.6/SHA256SUMS-0.3.6.txt)核对上述五个下载文件。更新前彻底退出旧版，然后覆盖安装或替换「应用程序」中的 Tracer；个人任务、设置和桌宠仍保存在各自的用户数据目录，不会因升级而清空。

## 动画改进

- 6 个内置伙伴的 16 种行为，每个动作均有 16 个不同姿态帧。头部、表情、四肢和道具有连续过渡，包含阅读、书写、手作和喝茶；保留各物种的外观与睡姿。
- 更新后新生成的伙伴，每个行为使用 16 张连续图像：每动作一张 4×4 图集，共 16 张图集、256 帧。动作按顺序跨图集行播放，过渡帧之间保持短间隔，休息姿态适当停留。
- 创建完整伙伴需要 16 次图像生成。创建会话内保留进度与外观参考，失败后重试只生成尚未完成的动作。**安装更新不会自动生成图像、调用 AI 或重绘已有伙伴。**
- 旧单张照片和每动作 4 帧的动画包继续兼容，保留原始图像与帧数。256 帧格式用于更新后新生成的伙伴。
- 保留动作边界检查，以及对旧图集跨格残片的保守遮罩处理。新图集需要不同的过渡姿态，不能把 4 张图片重复填入 16 个格子。
- 导出与导入保留两种动画格式；播放遵循减少动态效果设置，并在窗口隐藏、静态图鉴预览和图像加载期间正确暂停。

## 验证与发布状态

本地 Windows 0.3.6 已完成真实打包应用在全新用户目录中的启动和交互检查，包括主窗口、桌宠播放及伙伴导入导出。打包检查覆盖源码一致性、内置运行时校验值，以及不包含个人数据；本地产物位于 `dist/0.3.6`。

统一云端发布由 `.github/workflows/desktop-release.yml` 的 **Desktop release** 工作流执行。推送到 `codex/release-*` 分支或手动运行后，Windows x64、Mac arm64 与 Mac x64 分别原生构建和验证，三个平台全部通过后才生成公开附件与合并校验文件。云端是否完成以对应工作流记录为准，本说明不代表本次 Mac 云端检查已经运行通过。

Windows 安装程序目前未签名。Mac 安装包使用 ad-hoc 签名，尚未获得 Apple Developer ID 签名与公证；Mac 真实账号 AI 登录和系统权限界面仍需实机验收。下载、首次启动和权限说明见 [Mac 安装指南](https://github.com/AndyLiu010802/Tracer/blob/v0.3.6/docs/macos-install.md)与 [Mac 测试包说明](https://github.com/AndyLiu010802/Tracer/blob/v0.3.6/docs/macos-preview-notes.md)。
