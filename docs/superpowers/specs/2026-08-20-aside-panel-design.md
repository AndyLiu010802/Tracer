# Aside Panel Reader — 设计文档

日期：2026-08-20
分支：feature/reader-core

## 1. 目标

一个在本机运行的网页应用。主页面外观是一个英文的内部技术文档站；页面右栏有一个类似广告位的小窗，小窗内可以打开并浏览任意小说网站，支持翻页、点章节目录等站内跳转。

使用场景是工作时间的私人阅读，因此外观可信度和快速隐藏能力与阅读功能同等重要。

## 2. 约束与前提

- 运行环境：个人 Windows 11，可自由运行 node、开本地端口。
- Node 24 已安装。
- **零第三方依赖**。`node_modules` 里一堆与"文档站"无关的包名是最大的破绽，且 `npm install` 会在磁盘和 lockfile 留下痕迹。仅使用标准库：`node:http`、`node:https`、`node:zlib`、`node:fs`、`node:buffer`。
- 伪装页语言：英文。
- 阅读内容语言：中文（需处理 GBK 编码）。

### 核心技术障碍

绝大多数小说站返回 `X-Frame-Options: SAMEORIGIN` 或 `Content-Security-Policy: frame-ancestors`，浏览器会硬性拒绝在 iframe 中渲染。纯静态页面无法绕过。因此必须有一个能改写响应头的本地反向代理——这是整个架构存在本地服务的唯一原因。

## 3. 架构

```
engineering-docs-portal/
  server.js              入口，监听 127.0.0.1:8080
  lib/proxy.js           反向代理：取页、解压、转码、剥头、重写链接
  lib/encoding.js        字符编码探测与转换（GBK/GB18030 → UTF-8）
  lib/rewrite.js         HTML 链接重写
  lib/render.js          正文抽取与重排，服务于伪装而非阅读体验
  public/reader.js       小窗组件（与皮肤无关）
  public/reader.css      小窗样式，继承皮肤 CSS 变量
  skins/docs-portal/     第一套伪装皮肤
    index.html
    skin.css
    content.js           文档正文数据
  local.config.json      本地配置（gitignore）
  bookmarks.json         书签与阅读进度（gitignore）
  start.bat              双击启动
```

服务只绑定 `127.0.0.1`，不监听外部网卡。

### 皮肤可插拔

`skins/<name>/` 放一套即为一套伪装。`server.js` 读 `local.config.json` 的 `skin` 字段决定加载哪套。

引擎与皮肤的唯一契约：

1. 皮肤 HTML 必须提供挂载点 `<div id="aside-slot">`，小窗注入此处。
2. 皮肤 CSS 必须定义一组 CSS 变量（`--fg`、`--bg`、`--border`、`--font-body`、`--font-mono`、`--radius` 等），小窗只使用这些变量取色取字体，从而自动与任何皮肤融为一体。

引擎不知道皮肤长什么样，皮肤不知道小窗内部实现。新增皮肤无需改动引擎代码。

## 4. 数据流

```
小窗地址栏输入 https://example-novel-site.com/book/123
        ↓
前端请求 /r/<base64url(url)>
        ↓  server.js 路由至 lib/proxy.js
1. 以伪装的 UA / Referer 请求目标页
2. lib/encoding.js：按 Content-Type charset → <meta charset> → 字节特征
   依次探测，GBK/GB18030 转为 UTF-8
3. 剥离响应头：x-frame-options、content-security-policy（整条，见下）、
   cross-origin-opener-policy、cross-origin-embedder-policy、
   cross-origin-resource-policy

   CSP 是整条删除而非只删 frame-ancestors。注入的守卫脚本是内联脚本，
   源站只要带 script-src 就会把它拦下，导致焦点落在小说正文上时老板键失灵——
   而那恰恰是最需要它的时刻。页面在本机框架内渲染，源站 CSP 在此保护不了任何东西。
4. lib/rewrite.js：<a href>、相对资源路径重写为 /r/... 形式
5. 按小窗内的 Fixture view 开关注入 lib/render.js 的正文抽取与重排
        ↓
iframe 正常渲染；翻页、点目录均留在小窗内
```

链接重写是必需的：不做的话点一次「下一章」就会跳出 iframe，整个伪装当场失效。

## 5. 小窗

### 两种形态

默认：嵌在右栏的固定卡片，标题为 `zh-CN localization fixtures`，边框圆角字体全部取自皮肤 CSS 变量，与页面浑然一体。

双击标题栏：脱出为可拖拽、可缩放的浮窗，需要细读时拉大。再次双击收回右栏。

形态、位置、尺寸持久化到 `localStorage`。

### 伪装定位（关键设计决策）

中文方块字与英文文本的轮廓密度差异显著，把中文正文伪装成英文文档段落在视觉上不可能成立。

因此不做这种伪装，改为把小窗定位为 **i18n 本地化样例面板**。技术文档中出现中文测试语料、本地化字符串样本是完全正常且常见的，中文出现在这个位置比英文更合理。

具体呈现：正文以 `zh-CN` 语言标签包裹，段落带序号前缀（形如 `L.0142`），整体排版模仿测试夹具清单。被瞥见时读到的信息是「一份中文本地化语料」，而非小说。

## 6. 隐蔽机制

1. **老板键** `Alt+\`：一键收起/弹出。收起时小窗完全从 DOM 布局中移除，页面回落为纯文档；弹出时恢复原阅读位置、滚动位置与形态。选用 `Alt+\` 是因为它不与常用浏览器快捷键冲突，且不易误触。
2. **失焦自动隐藏**：监听 `blur`、`visibilitychange`、`mouseleave` 三个信号，任一触发即收起。切到别的程序再切回来，屏幕是干净的。
3. **正文伪装排版**：见上节 i18n 面板定位。
4. **标签页伪装**：固定 `<title>` 为文档站名称，内联 SVG favicon。浏览器历史记录中仅出现 `localhost:8080`，不出现任何小说站域名。

失焦隐藏覆盖「你切走」的场景，老板键覆盖「你没切走但有人靠近」的场景，两者互补，缺一不可。

## 7. 错误处理

目标站返回 4xx/5xx、连接超时、编码探测失败、HTML 解析异常——小窗内一律呈现为一条符合文档站语气的英文提示，例如 `Unable to load referenced resource.`，并附一个 `Retry` 链接。

原则：页面上任何时候都不得出现能看出这是代理失败的痕迹——不出现浏览器默认错误页、不出现空白 iframe、不出现目标站域名、不出现 Node 的堆栈信息。所有异常在服务端捕获并转换为伪装后的响应。

## 8. 测试

使用 `node --test`（标准库自带，符合零依赖约束）覆盖纯逻辑部分：

- URL 的 base64url 编解码往返
- 链接重写：绝对路径、相对路径、协议相对路径、锚点、`javascript:` 与 `mailto:` 的跳过
- 编码探测：UTF-8、GBK、GB18030 样本，以及无 charset 声明时的字节特征判定
- 响应头剥离：确认 `x-frame-options` 与 `content-security-policy` 被整条移除，无关响应头保留
- 错误路径：目标返回 500 时代理输出伪装提示而非抛出

小窗交互、皮肤视觉、老板键行为为手动验证项。

## 9. 非目标（YAGNI）

明确不做：

- 不做多用户、不做账号系统、不监听外部网卡
- 不做付费内容绕过、不做 DRM 破解、不做登录态窃取。代理仅转发公开可访问的页面
- 不做小说站内容抓取入库，只做实时代理浏览
- 不做移动端适配
- 首个版本只做 `docs-portal` 一套皮肤，其余皮肤留待架构验证后再加
- 不做自动翻页、TTS 朗读、字体主题切换等阅读增强功能。`lib/render.js` 的正文重排
  是伪装机制的一部分（把正文变成 i18n 语料的样子），不是为了读得更舒服，两者
  不要混为一谈

## 10. 交付判定

- `start.bat` 双击后浏览器打开 `localhost:8080`，呈现一个可信的英文技术文档站
- 右栏小窗输入任一中文小说站网址可正常加载并阅读，点「下一章」不跳出小窗
- `Alt+\` 收放正常且保留进度
- 切走再切回，小窗自动隐藏
- `node --test` 全绿
