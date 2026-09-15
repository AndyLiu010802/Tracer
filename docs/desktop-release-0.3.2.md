# Tracer 0.3.2

## Notes：可调节的笔记列表

- 点击「收起列表 / Hide pages」让正文占满笔记区域；点击「展开列表 / Show pages」恢复。
- 拖动列表与正文之间的手柄调节宽度；方向键微调，Home / End 调到最窄 / 最宽，双击恢复默认宽度。
- 记住手动选择的列表宽度与收起状态。
- 笔记区域不足 640px 时自动收起列表。需要切换笔记时可展开，列表放在正文上方；选中笔记后恢复全宽编辑。
- 标题和操作按钮自适应换行，中英文正文、Markdown 预览和图片适应可用空间。
- 拖动和收起列表不会清空已输入的笔记内容。

保留 0.3.1 的无边框全屏、F11 切换、每日名言响应式卡片和星月 Logo。

## 下载与更新

Windows x64：`Tracer-Setup-0.3.2-x64.exe`。从系统托盘退出旧版后安装到原位置，安装程序创建桌面快捷方式。现有任务和笔记保留在 `%APPDATA%\tracer-desktop`，不会打进分享的安装包。

安装包未签名，`SHA256SUMS-0.3.2.txt` 提供下载校验。AI 在线服务尚未开通；独立部署包仍为 `Tracer-AI-Service-0.3.0.zip`，见[开通指南](ai-service-setup.md)。

## 验证

隔离工作区验证了拖动、键盘调宽、收起与刷新后的偏好记忆、正文保存、Markdown 预览，以及 900–1920px 窗口下的中英文布局和窄宽切换。

桌面原生浏览器在拖动分隔线期间让出鼠标事件，跨入参考面板后松开鼠标也能正常结束拖动并恢复页面。

## English

The Notes page list can now collapse and resize. Drag the divider or use its arrow keys to adjust the width; double-click to reset. Your width and collapse preference persist. Narrow workspaces give the editor the full width, with the page list available above it when needed. Draft content is retained across layout changes.
