# Tracer 0.3.1

## 无边框全屏桌面版

- 启动后进入无边框全屏，隐藏 Windows 白色系统标题栏。
- 应用右上角提供最小化、全屏切换、隐藏到托盘三个按钮。
- 按 **F11** 进入或退出全屏，在任务弹窗和内置参考浏览器中也可使用。
- 退出全屏后可拖动应用顶栏；Esc 继续用于关闭弹窗。
- 点击关闭后在系统托盘继续运行，从托盘打开可恢复窗口。完全退出使用托盘菜单「退出」。
- 名言卡片按实际卡片宽度自适应；窄布局将番茄钟和操作按钮放到名言下方，避免英文被挤成逐词竖排。

保留中英双语、任务管理、完成历史、番茄钟与音频、星月 Logo 和 AI 计划助手。AI 在线服务仍需单独部署和配置，当前安装包不包含真实 AI 密钥。

## 下载与安装

Windows x64 安装程序：`Tracer-Setup-0.3.1-x64.exe`。

从托盘退出旧版，再运行安装程序并选择原安装位置。工作区保留在用户的 `AppData/Roaming/tracer-desktop` 中；分享的安装包使用接收者自己的工作区。安装程序创建桌面快捷方式。

云端部署包沿用 `Tracer-AI-Service-0.3.0.zip`，见 [开通指南](ai-service-setup.md)。

安装程序尚未签名。下载后可用 `SHA256SUMS-0.3.1.txt` 核对 SHA-256。

## 验证

已在独立桌面测试工作区检查：原生全屏与显示器边界一致、无系统标题栏、按钮/F11 切换、中英文提示、弹窗 Esc、内置浏览器快捷键、最小化恢复、托盘隐藏和重新打开。远程网页不能调用主窗口控制接口。

名言卡片通过 900–2560 像素窗口、布局切换临界宽度、中英双语全部名言及音频按钮显示状态的 112 组排版检查。447 项单元测试通过。

## English

Tracer now opens in frameless fullscreen. Use **F11** or the top-right fullscreen button to return to window mode. The remaining controls minimize the app and hide it to the tray. Drag the app header in window mode; Escape still closes dialogs. The quote card adapts to its own width, moving the timer and controls below the quote in narrow layouts. Existing tasks, settings and completion history are retained. The AI service requires separate deployment.
