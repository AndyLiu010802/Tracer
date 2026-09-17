# Tracer 0.3.9 — 与伙伴聊出任务和项目

## 先聊清楚，再确认创建

在主窗口或原生桌宠的「聊天」中，请伙伴帮你整理一个任务或项目。缺少关键目标、交付物或时间信息时，伙伴会先追问；已经说明的内容无需重复填写，没有期限或工时要求也可以留空。

信息足够后，聊天会显示方案预览，列出项目与任务内容。可以继续聊天修改方案、取消，或点击确认创建。**只有确认后才写入本机工作区**；普通聊天和 AI 回复本身不会创建任务。

## 本地恢复与重试

- 主窗口与原生桌宠分别保存各伙伴的本地对话、未发送文字和待确认方案。关闭面板、刷新或重新启动后可以恢复。
- 创建前先保存可恢复的确认记录。创建结果未确认时，保留方案并重试同一个请求，不会因为再次点击而重复新增；此时先完成重试，再到工作区修改已创建内容。
- 只有收到本机工作区的保存确认，界面才显示创建成功。本机存储失败时保留可恢复内容并显示错误。
- AI 仅收到当前对话、当天日期、待完善方案及伙伴资料，不会自动收到已有任务、工作区文件或照片。使用 ChatGPT 套餐或个人 API 的额度规则保持不变。

## 整理旧模块

移除微信小程序、配对与云同步模块，继续使用本机工作区。已有本地任务、设置、伙伴、完成历史及恢复草稿保留；更新前退出旧版，再安装到原位置。

单动作重新生成与旧伙伴兼容功能继续保留。含保留旧帧与新动作的伙伴导出文件，最低仍需 Tracer 0.3.8 打开。

## 下载与验证

以下为 [0.3.9 统一发布页](https://github.com/AndyLiu010802/Tracer/releases/tag/v0.3.9)的目标附件。**本次三平台构建与安装包验收尚待完成**；全部通过后才发布，不以此前版本的构建结果代替本次验证。

| 平台 | 安装包 | 备用格式 |
| --- | --- | --- |
| Windows x64 | [Tracer-Setup-0.3.9-x64.exe](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-Setup-0.3.9-x64.exe) | [blockmap 索引](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-Setup-0.3.9-x64.exe.blockmap)，无需单独安装 |
| Mac Apple 芯片 | [Tracer-0.3.9-mac-arm64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-arm64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-arm64.zip) |
| Mac Intel | [Tracer-0.3.9-mac-x64.dmg](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-x64.dmg) | [ZIP](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/Tracer-0.3.9-mac-x64.zip) |

第七项附件为统一的 [SHA256SUMS-0.3.9.txt](https://github.com/AndyLiu010802/Tracer/releases/download/v0.3.9/SHA256SUMS-0.3.9.txt)，覆盖上面的六个文件。

本地已通过 **631 项核心测试、16 项桌面测试**，以及伙伴聊天创建和工作区恢复两项浏览器 QA。聊天验证覆盖追问、方案预览、确认创建、本地会话恢复、存储失败与同请求重试。自动化 AI 场景使用模拟服务，不消耗真实 AI 额度。

Windows 实际安装包正在构建，原生运行验收尚未完成；三平台云端构建尚未启动。后续还需验证打包应用的主窗口和原生桌宠 16 帧播放、伙伴导入导出、生成草稿恢复及动画资源与源码一致性，再补充安装包验收结果和本次 CI 构建链接。

Windows 安装包目前未签名；Mac 包为 ad-hoc 签名，尚未经过 Apple Developer ID 签名与公证。真实账号登录、后台输入权限和未覆盖的界面操作仍需实机验收。详见 [Mac 安装指南](https://github.com/AndyLiu010802/Tracer/blob/codex/release-0.3.9/docs/macos-install.md)与 [Mac 测试包说明](https://github.com/AndyLiu010802/Tracer/blob/codex/release-0.3.9/docs/macos-preview-notes.md)。
