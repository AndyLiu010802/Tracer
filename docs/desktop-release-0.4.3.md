# Tracer 0.4.3 — Windows x64 安装包

## 本次内容

- 移除主界面「去钓鱼」按钮与内嵌钓鱼弹窗，保留桌面钓鱼、自动钓鱼、饵料盒、鱼塘及水族馆。
- 全部 156 种鱼类与水生生物的新原画接入水中游动，保留成长、投喂与物种动作区别。
- 鱼纹理按当前住鱼加载，离场后释放；隐藏主窗口暂停场景绘制，减少重复绘制和普通屏幕的额外像素开销。
- 安装包包含工作区现有鱼竿礼包、主题特效、隐藏技能、鱼塘皮肤和配套资源。

## 安装与数据

文件位于 `dist/0.4.3/Tracer-Setup-0.4.3-x64.exe`。从系统托盘完全退出旧版后安装到原位置。无需另装 Node.js 或 Codex。

延续 0.4.2 分发版的数据目录 `%APPDATA%\tracer-desktop-commercial\`。源码开发版仍使用独立目录 `%APPDATA%\tracer-desktop\`，不会把开发账户或测试金币打入安装包，也不会自动迁移两个目录之间的数据。

本地生成，不自动发布或替用户安装。旧安装包保留。Windows 包目前未签名。

## 构建与验证

完整隔离测试：1,465 项核心测试、62 项桌面测试全部通过。报告：`.cache/release-tests-0.4.3/result.json`。

Electron 44.3.0 从本机缓存的 Windows x64 官方归档解压，SHA-256 与已安装 Electron 包提供的校验值一致：`26bf9a617d58d81772b3d68305d59ee48272969c15083c06db634a77358a8d9d`。内置 Codex 0.154.0 归档及文件按项目锁定值校验。

```powershell
npm.cmd run dist -- --publish never --config.directories.output=dist/0.4.3 --config.electronDist=.cache/electron-dist-44.3.0-release
node dev/verify-ai-release.cjs dist/0.4.3/win-unpacked/resources/app.asar
node dev/qa-packaged-fishing.cjs dist/0.4.3/win-unpacked/Tracer.exe
```

最终校验信息见同目录的 `SHA256SUMS-0.4.3.txt` 和 `verification.json`。

打包后的原生程序验收通过：桌面真实按键抛竿、主界面与桌面水族馆的新原画、旋转缩放保存、重载恢复、隐藏后释放渲染及再次显示恢复均正常。验证使用独立测试账户和目录，未修改现有存档。原生验收记录与截图保存在 `dist/0.4.3/qa-fishing/`。

旧弹窗运行代码及用户确认的 20 个历史资料文件已删除，范围见 [清单](fishing-inline-retirement.json)。现用素材、存档和生成记录保留。
