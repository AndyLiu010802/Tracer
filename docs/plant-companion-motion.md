# 植物伙伴逐帧动作

2026-09-23 更新：植物范围已扩展为九种，普通／闪光共 18 个形态、288 张动作图、4,608 帧，并恢复独立的钓鱼等自动活动场景。后续内置伙伴动作与验收记录见 [伙伴动作与自动活动](companion-motion-v3.md)。以下保留原六种植物阶段的制作记录。

本轮范围是现有六种植物伙伴：野花、向日葵、薰衣草、苹果、桃子和樱桃。每种分别制作普通奇幻形态与闪光形态，每个形态 16 个动作、每个动作 16 帧，共 192 张动作图、3,072 帧。未变异的花朵和果树继续保持自然植物外观，没有表情。

## 动作与入口

动作包括发呆眨眼、挥手问好、散步、轻轻跳跃、浇水、享受摸摸、随音乐摇摆、开心庆祝、安静休息、陪伴专注、迎着微风、伸个懒腰、好奇张望、有点害羞、吃点心和表达感谢。

在伙伴小屋选择已解锁的植物伙伴，展开「伙伴动作」即可选择并预览。桌宠展开面板也使用同一入口。预览只播放动作，不增加货币、亲密度、植物或收获次数；正在休息、专注或拖动时不会打断当前状态。

## 源图与播放器

- 源图位于 `skins/tracer/garden-art/<植物>-<normal|shiny>-<动作>-v2.png`。野花已有的待机、问好与庆祝可使用通过验收的 v1 原图。
- 使用内置 imagegen 逐张生成。保留原始透明 PNG，不用程序合成新动作，不修改源图像素。实际尺寸由解码器读取，不将提示词中要求的尺寸当作输出尺寸。
- `dev/build-garden-companion-atlas.cjs` 检查透明通道、16 帧内容与来源摘要，再生成 `garden-companion-atlas.js`。清单只收入已存在并通过检查的图，缺失图不会被当成完成。
- `garden-companion-motion.js` 逐帧显示真实绘制内容；跳跃保留画出来的高度，休息坐姿单独按脚底接地，整张图始终使用统一缩放比例。休息动作入睡后仅循环后半段呼吸，不重复站起。
- 按需加载当前动作与待机图，复用图片缓存。切出窗口、滚动离开可视区或开启减少动态效果时暂停；销毁视图时释放播放器。加载失败保留原有角色外观，可从预览入口重试。

## 生成提示词

- `skins/tracer/garden-art/WILDFLOWER-CHERRY-MOTION-V2.md`
- `skins/tracer/garden-art/SUNFLOWER-LAVENDER-MOTION-V2.md`
- `skins/tracer/garden-art/APPLE-PEACH-MOTION-V2.md`
- `skins/tracer/garden-art/SHINY-LAVENDER-PEACH-MOTION-V2.md`
- `skins/tracer/garden-art/PEACH-NORMAL-EXTRA-MOTION-V2.md`
- `skins/tracer/garden-art/SUNFLOWER-LAVENDER-MOTION-CORRECTIONS.md`
- `skins/tracer/garden-art/FINAL-ROOT-MOTION-CORRECTIONS.md`

这些记录包括角色身份约束、每个动作的连续变化、透明背景与留白要求。裁切不合格的图单独重画，原始输出保留在工具默认生成目录。

## 验收

现有六种植物阶段已完成验收：192/192 张图、3,072 个不同帧裁切、源图审计 0 个问题，725 项功能测试及 19 项桌面测试通过。最终预览保存在 `.cache/companion-motion-mwPr0G/`（全部形态的待机、休息、庆祝及主窗口/桌宠预览）。随后开始仓库与赛博农场开发。

运行源图审计与构建：

```powershell
node dev/audit-garden-companion-assets.cjs
node dev/build-garden-companion-atlas.cjs
```

完成全部源图后，运行 `dev/qa-garden-companion-motion.cjs --complete`。完整模式必须实际载入 192 张 PNG、逐一检查 3,072 个源图帧区域，并验证主窗口与桌宠预览、状态保护和视图销毁。报告与截图保存在 `.cache/companion-motion-*`。源图审计的边界提示必须结合原图复核，不能仅以文件数量代替视觉验收。

动作资产与播放器验收完成后，再进入仓库、植物出售、农场样式购买和赛博农场阶段。本轮不制作安装包，也不更新安装链接。
