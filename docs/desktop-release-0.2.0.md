# Tracer 0.2.0 Windows 桌面版

## 下载安装

安装文件：`dist/Tracer-Setup-0.2.0-x64.exe`。

适用于 Windows 10 / 11 64 位。双击安装，选择安装位置；安装器会创建开始菜单和桌面快捷方式。无需另装 Node.js、Electron 或浏览器。分享时只需发送这个安装文件。

图标使用简约金色星月设计。可单独使用 `output/desktop-brand/Tracer-Moon.ico`。

## 包含内容

- 任务看板、日程、任务详情、中英双语。
- 水晶玻璃界面、自然风景名言卡片、番茄钟。
- 35 首解压音频，离线循环或按指定时长播放。
- 完成历史、趋势、日历、筛选和 CSV 导出。
- 原生 Chromium 参考浏览器：直接访问网站、前进后退、刷新、登录 Cookie、弹出窗口、下载、系统浏览器打开入口。

任务数据保存在 `%APPDATA%\tracer-desktop\data`；专注记录和偏好保存在同一用户目录的浏览器存储中。关闭窗口会缩至托盘，右键托盘图标选择“退出”可彻底关闭。卸载默认保留用户数据。

## 浏览器说明

内核为 Electron 44.3.0。外部网页在独立的持久会话中加载，不经过原来的页面代理，不拥有任务页面的 Node 或应用桥接权限。摄像头、麦克风、定位和通知请求会提示用户选择。网页无法加载时显示错误原因，可重试或用系统浏览器打开。

不能保证所有网站可访问：网络限制、站点故障、部分登录风控和 DRM 服务可能仍需系统浏览器。

参考：[Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)、[安全建议](https://www.electronjs.org/docs/latest/tutorial/security)、[稳定版内核](https://releases.electronjs.org/release?channel=stable)。

## 本机迁移与分享

迁移浏览器工作区前，先备份原工作区、浏览器设置及已有桌面数据。备份存放在本机私有目录中，请勿随安装包或源码分享。

安装包中不包含个人任务、完成记录、书签、浏览器登录信息或同步凭证。其他人首次使用会创建自己的空白工作区。

## 构建与验证

```powershell
npm install
npm run dist
# 已有运行时的本地构建：
node node_modules/electron-builder/cli.js --win nsis --x64 --publish never --config.electronDist=node_modules/electron/dist
node --test test/*.test.js desktop/test/*.test.js
# 测试工具路径通过环境变量指定；所有测试使用隔离数据目录。
node dev/qa-desktop.cjs dist/win-unpacked/Tracer.exe
```

当前安装包未配置发布者数字签名，Windows 下载后可能显示未知发布者提示。最终 SHA-256 校验值见安装包旁的 `SHA256SUMS.txt`。本次没有发布公网托管链接，可将安装文件自行发送或上传到网盘供下载。
