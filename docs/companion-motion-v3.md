# 伙伴动作与自动活动

已完成：六个内置伙伴，以及九种植物精灵的普通、闪光形态。每个角色形态 16 个动作，每个动作 16 帧；共 384 张动作图、6,144 帧。

内置伙伴保留原有像素角色特征，使用独立绘制的待机、摸摸、吃点心、玩耍、睡觉、醒来、专注、拖动、钓鱼、锻炼、种植、采矿、阅读、写字、手作和喝茶动作。原有 SVG 角色仍作为图片加载失败或素材不完整时的后备显示。

植物精灵保留挥手、散步、跳跃、浇水等现有 16 个动作。自动钓鱼、锻炼、种植和采矿会同时显示本地活动场景，不依赖已删除的农场、战斗系统，也不产生资源或奖励。休息、专注、互动和拖动时暂停，解除后等待原有的安静间隔再恢复。

素材通过内置 image_gen 工具生成，原始 PNG 与透明通道直接保存，不通过复制四张图、整体平移或程序补帧来凑满十六帧。普通、闪光形态分别绘制。提示词见 `dev/companion-art-generation-v3.json`、`skins/tracer/pet-art/GENERATION-V1.json` 和 `skins/tracer/garden-art/COMPANION-MOTION-V3-PROMPTS.json`。最终动作图位于 `skins/tracer/pet-art/` 与 `skins/tracer/garden-art/`。

图集构建读取实际 PNG 尺寸、透明间隔和每帧边界，并从最大的连通主体识别身体中心和脚底。所有动作都对齐同一站位，跳跃和散步也原地表现；同一角色在切换动作时保持统一像素比例，不按道具大小重新缩放。原 PNG 像素不改写。图集只收录通过检查的素材，内置角色只有全部十六组齐备时才切换到新播放器。

两个窗口共用播放器。图片按需加载，隐藏、离开可见范围或减少动态效果时停止计时；图鉴重绘和窗口关闭时释放播放器引用。动作预览可直接从伙伴面板展开，不改变需求或奖励。

动作按正序循环，不往返倒放。六个内置伙伴的旧钓鱼图包含放回水中的收尾，因此播放在各自提起收获的帧结束，停留 1.2 秒后开始下一轮；预览也使用相同终点。植物精灵附加场景中的鱼和晶石在抬起后淡出，再于隐藏状态重置。其他动作保留完整的正序帧；生成新动作时明确要求收尾不能撤销钓鱼、采矿、翻页或手作的成果。

内置角色待机先静置约 6 秒，短动作在起止姿势分别停留约 2.2 秒和 1.8 秒，中间帧以 180–200 毫秒推进。取消额外的整只平移、摇晃和跳动叠加，后备植物绘制也只保留轻微局部动作。

验证命令：

```powershell
node dev/audit-garden-companion-assets.cjs --complete
node dev/build-garden-companion-atlas.cjs
node dev/build-pet-illustrated-atlas.cjs --complete
node dev/qa-garden-companion-motion.cjs --complete
node dev/qa-pet-illustrated.cjs
node dev/qa-pet-idle.cjs
npm test
npm run test:desktop
```

浏览器验证使用隔离数据目录；`TRACER_QA_PLAYWRIGHT` 可指向已安装的 Playwright。逐帧检查及窗口截图写入 `.cache/companion-motion-*`、`.cache/pet-illustrated-*`、`.cache/pet-idle-*`。

已通过的验证：754 项功能测试、19 项桌面测试；植物图集 288/288 张、4,608 帧，内置伙伴图集 96/96 张、1,536 帧，全部通过裁切和浏览器加载检查。主窗口和桌宠的自动活动、互动中断、专注/睡眠后的恢复均已验证。最终浏览器结果分别位于 `.cache/companion-motion-ksJcYC`、`.cache/pet-illustrated-PhmMYh` 和 `.cache/pet-idle-hUY4ay`。

[查看全部植物普通／闪光形态](companion-motion-v3-plants.png)。

[查看默认小羊的全部 16 个动作首帧](companion-motion-v3-sprout.png)。
