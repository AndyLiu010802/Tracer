# Tracer 0.4.4 — Windows x64

本版包含鱼塘场景背景、逐级金币解锁、礼包集齐常规款后开启的隐藏款 100 抽保底，以及生成原画结合有厚度三维网格的游动鱼。

鱼获倍率已调低为 `1 / 1.2 / 1.5 / 1.8 / 2.2 / 2.6`；解锁价格为 `免费 / 400 / 1,000 / 2,200 / 4,500 / 8,500` 金币。新鱼苗成年后按出生鱼塘的基础价值加 50%。已有旧版交易和捕获继续按当时的经济规则校验，不改写余额。完整规则见 [渔场说明](fishing-ground-progression.md)。

使用原 Windows x64 分发配置，数据目录继续为 `%APPDATA%\tracer-desktop-commercial\`。本地构建，不自动发布或安装；旧版安装包保留。安装前从托盘完全退出旧程序，再安装到原位置。

本机未配置 Windows 代码签名证书；构建校验与文件 SHA-256 不能替代发布者数字签名。

构建命令：

```powershell
npm.cmd run dist -- --publish never --config.directories.output=dist/0.4.4 --config.electronDist=.cache/electron-dist-44.3.0-release
node dev/verify-ai-release.cjs dist/0.4.4/win-unpacked/resources/app.asar
node dev/qa-packaged-fishing.cjs dist/0.4.4/win-unpacked/Tracer.exe
```

调整后完整隔离回归：1,472 项核心测试、62 项桌面测试全部通过，报告位于 `.cache/release-tests-0.4.4-balanced/result.json`。渔场 UI 在 390px 与 1440px 下验证，支持逐级解锁、重复进入不扣款和不足余额提示。

打包程序原生验收通过：桌面真实 F 键抛竿、鱼塘及水族馆三维原画、窗口旋转缩放保存、重载恢复、隐藏时释放渲染并在再次显示时恢复、IPC 窗口与账户隔离均正常。使用独立测试账户和数据目录。首次工具沙箱内启动时 GPU 子进程失败，解除工具沙箱限制后使用相同隔离数据验收通过。
