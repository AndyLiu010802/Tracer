# Tracer 0.3.8 — 单独重新生成伙伴动作

## 使用方式

在生成预览中选择不满意的动作，点击 **重新生成此动作**。确认后只重新生成该动作的 16 帧，其余动作继续保留。也可以在「桌宠小屋 → 图鉴」选中已保存的自定义伙伴，点击 **调整当前伙伴动作**。

新图完成检查前，原动作始终保留。失败后可重试同一组，或选择「保留原动作」。只有点击「保存动作修改」才会更新已保存的伙伴；伙伴编号、养成进度和其他动作保持不变。

## 进度与误触保护

- 重画可在后台继续，导航栏显示单组进度，完成后提醒预览并保存。
- 重试编号和身份参考会随草稿保存。网络、图片读取或本机暂存失败时保留已有结果；恢复草稿不会自动调用 AI。
- 每次开始新的单组重画需要确认，通常使用一次图像生成额度。生成内容不合格时，下一次明确重试会为这一组请求新图。
- 如果原伙伴已在别处被修改或移除，保存会停止并保留当前草稿，避免覆盖或意外重新创建伙伴。

## 旧伙伴兼容

支持已有的 16 帧伙伴、旧 4 帧伙伴和静态自定义伙伴。旧动作在本机转为可编辑格式，不调用 AI，保留原有姿态、顺序和播放节奏；仅选中的动作重新生成 16 帧。

编辑已保存伙伴时，使用现有伙伴形象作为参考，不需要重新上传原始照片。新生成动作继续执行透明背景、帧边界和真实动作变化检查；旧图转换复用原来的裁边方式，避免重新显示其他帧的残片。

**含保留旧帧与新动作的导出文件，需要 Tracer 0.3.8 或更新版本打开。** 原有未编辑的导出格式继续兼容。

## 下载与验证

[统一发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.8)提供 Windows x64、Apple 芯片 Mac 和 Intel Mac 的同版本安装包。

| 平台 | 安装包 | 备用格式 |
| --- | --- | --- |
| Windows x64 | [EXE](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.8/Tracer-Setup-0.3.8-x64.exe) | — |
| Mac Apple 芯片 | [DMG](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.8/Tracer-0.3.8-mac-arm64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.8/Tracer-0.3.8-mac-arm64.zip) |
| Mac Intel | [DMG](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.8/Tracer-0.3.8-mac-x64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.8/Tracer-0.3.8-mac-x64.zip) |

发布前，三个平台均须通过核心测试、桌面测试、实际安装包运行检查和浏览器生成恢复测试；统一工作流随后发布附件与 [SHA-256 校验文件](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.8/SHA256SUMS-0.3.8.txt)。[查看构建记录](https://github.com/AndyLiu010802/Tracer/actions/workflows/desktop-release.yml)。生成测试使用本地合成图及模拟服务，不消耗真实 AI 额度。

Windows 安装包目前未签名；Mac 包为 ad-hoc 签名，尚未进行 Apple Developer ID 签名与公证。首次安装说明见 [Mac 安装指南](https://github.com/AndyLiu010802/Tracer/blob/codex/release-0.3.8/docs/macos-install.md)。
