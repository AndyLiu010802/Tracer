# 基础鱼竿重绘与入场提速

> 旧弹窗验证入口已退役；本文中的相关命令为历史记录。当前验证方式见 [桌面与原画验证](fishing-live-species-upgrade.md)。

基础、西游、三国三套共 103 款鱼竿使用短入场。普通 220 ms、稀有 320 ms、史诗 620 ms、传说 780 ms；三个隐藏款为 920 ms。鱼竿本体最迟在 300 ms 完全显现。保留各自的招牌入场动作和配套鱼漂、环绕光效，使用连续时间进度驱动。

这三套在入场的第一帧就允许按住蓄力：立即结束展示、恢复完整竿身，并沿用原来的抛竿输入时间和距离。收起展示缩短到 200 ms。其他奖池的入场规则保持原样。品质、抽奖概率、售价加成、隐藏能力、抛竿力度和溜鱼计算没有变动。

基础奖池全部 28 款（初始竹竿、26 款普通奖池鱼竿及隐藏黄金竿）使用 **built-in imagegen** 单独生成透明原画。每款具有自己的材质、握柄、轮座和装饰设计，竿梢沿现有连续骨架弯曲；青龙偃月的刀头区域固定，只有上段钓竿受力弯曲。运行时仅加载所装备鱼竿的独立图像，目录使用统一预生成图集。

- 最终素材：`skins/tracer/fishing-art/rod-basic-<id>-v1.png`
- 全部提示词、生成源文件、最终路径及校验值：[fishing-basic-art-manifest.json](fishing-basic-art-manifest.json)
- 可维护设计说明：[fishing-basic-art-specs.cjs](../dev/fishing-basic-art-specs.cjs)
- 原画与实际游戏渲染预览：`output/fishing-basic-upgrade/review.html`

验证脚本：

```text
node --test test/fishing-basic-art.test.js test/fishing-rod-effects.test.js test/fishing-motion.test.js
node dev/qa-fishing-basic-art.cjs
node dev/qa-fishing-entrance.cjs
node dev/qa-fishing-cast-input.cjs
node dev/build-fishing-catalog-art.cjs
node --test test/fishing-catalog-art.test.js
node dev/desktop-pack-assets.cjs
```

验证结果：28 款鱼竿在 WebGL 与 Canvas 下各检查原位、正向及反向最大弯曲，共 168 次渲染，没有空图、裁切或脚本错误。桌面窗口中 12 款跨品质、跨奖池的代表鱼竿（含三个隐藏款）在入场 16 ms 时接受真实键盘输入，下一帧进入蓄力，按住 300 ms 后释放仍保留精确蓄力时间；收起后也正确隐藏。新原画资源、目录图集、原有主题和运动逻辑的相关回归检查通过。

此改动写入开发项目；没有重新打包安装程序。桌面交互验证运行于 Edge 中加载实际桌面页面和模拟原生通信桥，并非已安装的 Electron 客户端。
