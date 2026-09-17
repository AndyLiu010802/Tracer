# Tracer 0.3.7 — 伙伴生成可以继续与恢复

## 下载与升级

[0.3.7 统一发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.7)提供同一版本的 Windows 和两种 Mac 架构安装包。附件由 **Desktop release** 云端工作流在三个平台的原生构建、测试和安装包检查全部通过后统一发布。

| 平台 | 安装包 | 备用格式 |
| --- | --- | --- |
| Windows x64 | [Tracer-Setup-0.3.7-x64.exe](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.7/Tracer-Setup-0.3.7-x64.exe) | — |
| Mac Apple 芯片 | [Tracer-0.3.7-mac-arm64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.7/Tracer-0.3.7-mac-arm64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.7/Tracer-0.3.7-mac-arm64.zip) |
| Mac Intel | [Tracer-0.3.7-mac-x64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.7/Tracer-0.3.7-mac-x64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.7/Tracer-0.3.7-mac-x64.zip) |

使用统一的 [SHA256SUMS-0.3.7.txt](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.7/SHA256SUMS-0.3.7.txt)核对上述五个下载文件。更新前彻底退出旧版，再覆盖安装或替换「应用程序」中的 Tracer；个人任务、设置和桌宠保存在各自的用户数据目录，正常升级会保留。

## 生成进度与恢复

- **收起后继续生成**：关闭生成弹窗只收起界面。应用仍在运行时，当前生成会继续，导航栏显示动作进度，点击可随时返回原来的照片、设置和预览。
- **完成后提醒保存**：16 个动作全部完成后提醒保存并打开预览。如果你正在编辑任务、AI 设置或其他弹窗，会等该窗口关闭；不会覆盖正在编辑的内容。
- **刷新和重启后恢复**：缩放后的参考照片、设置、已完成动作和重试标识暂存于本机 IndexedDB 草稿。恢复后可以继续剩余动作，不会自动发起图像生成。每页先保存进度，再开始下一页；暂存失败会暂停后续请求。
- **保留已返回的结果**：服务端记录本次生成，重试同一动作时可接回已有的本机结果。网络或本机存储失败会保留重试标识；明确判定图集不合格后才为该动作开始新的尝试。
- **未保存结果不会因收起而消失**：关闭前提醒结果尚未保存，照片、设置和全部动作保留在草稿中；点击导航栏返回后继续检查、保存。

## 防止误操作

- 改名字或性格不清除已生成动作。更换照片、修改会影响形象的设置，或选择「重新生成全部动作」，会明确确认将清除已有动作并再次消耗额度；取消会保留原内容。
- 完整结果的主按钮只打开动作预览。预览图片临时加载失败时，可以重新加载，无需重新生成。
- 保存失败后可以直接重试，使用同一个伙伴标识避免重复新增。保存伙伴或确认「放弃草稿」后清除本机恢复草稿中的照片；普通收起不删除。
- 生成中、完整伙伴尚未保存或草稿暂存异常时，刷新或真正退出会先提醒确认。选择留下时，应用与 AI 运行时继续工作。

保留 6 个内置伙伴的 16 种动作、每动作 16 帧，以及新生成伙伴每动作 16 张连续图像、总计 256 帧。旧照片和旧 4 帧动作包继续兼容，新旧动画格式均支持导入导出。创建完整新伙伴需要 16 次图像生成；**安装、升级或恢复草稿不会自动调用 AI，也不会重绘已有伙伴。**

## 验证与发布状态

云端发布检查分别在 Windows x64、Mac arm64 与 Mac x64 的原生构建机运行，覆盖核心与桌面测试、真实打包应用在全新用户目录中的主窗口、原生桌宠窗口 16 帧播放、新格式导入导出和旧格式导入，以及动画资源、源码一致性、内置运行时校验值和个人数据排除检查。发布需要三个平台全部通过，具体状态见 [Desktop release 构建记录](https://github.com/AndyLiu010802/Tracer/actions/workflows/desktop-release.yml)。

本地最终 Windows 安装包 `dist/0.3.7-final` 已通过包内容、校验值和实际运行验证，包括主窗口与原生桌宠窗口的 16 帧播放、照料操作、新格式导入导出、旧格式导入和伙伴切换。

伙伴生成与恢复 QA 使用本地合成图和模拟服务，未调用真实 AI。后台继续、完成提醒、完整与部分草稿重启恢复、暂存失败停止后续请求、保存失败重试、清除草稿期间的并发写入保护，以及不覆盖其他编辑弹窗均已通过。

统一云端发布由 `.github/workflows/desktop-release.yml` 的 **Desktop release** 工作流执行。推送到 `codex/release-*` 分支或手动运行后，Windows x64、Mac arm64 与 Mac x64 分别原生构建和验证，三个平台全部通过后才生成公开附件与合并校验文件。

Windows 安装程序目前未签名。Mac 安装包使用 ad-hoc 签名，尚未获得 Apple Developer ID 签名与公证；真实账号 AI 登录、后台输入授权及未覆盖的界面操作仍需实机验收。下载、首次启动和权限说明见 [Mac 安装指南](https://github.com/AndyLiu010802/Tracer/blob/codex/release-0.3.7/docs/macos-install.md)与 [Mac 测试包说明](https://github.com/AndyLiu010802/Tracer/blob/codex/release-0.3.7/docs/macos-preview-notes.md)。
