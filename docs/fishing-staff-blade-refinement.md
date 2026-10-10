# 如意定海与二郎照雪

> 旧弹窗验证入口已退役；本文中的相关命令为历史记录。当前验证方式见 [桌面与原画验证](fishing-live-species-upgrade.md)。

- 如意定海：长赤铁棍身、对称金箍，金属箍沿圆柱包覆；浅浮雕云纹、端帽和铜金线轮保留近看细节。
- 二郎照雪：玄钢长柄、锻造刀颈、长中锋与两个较短侧锋。刀身使用有厚度的棱面、明暗刃面和凹槽，刀颈嵌天眼。
- 如意特效：出场完整旋棍；抛竿双周旋棍后挑出；收鱼反向双周回旋后立棍。等待与遛鱼不播放装饰特效。残影与两端金色尾迹采样同一连续刚体轨迹，末段保留可读的收势。
- 实际法术入口 `fishing-spell-effects.js` 调用共享的 `staffState / staffPose / paint`，替代原固定角度的金色棍影；出场图片仅用于出场，不覆盖抛竿或收鱼动作。
- 竿尖、握点、竿体弯曲、鱼线和数值保持共享物理模型；装饰同样跟随弯曲。减少动态效果模式固定棍姿并取消残影。
- 如意鱼漂采用小祥云造型：暖白云体、淡金轮廓、卷云纹与底部水纹。鱼漂容器尺寸和钓鱼锚点保持原值。
- 三朵半透明祥云仅在空闲时沿竿身缓慢漂浮，位置采样实际弯曲曲线；采用连续效果时钟，阶段切换不重置云朵位置，减少动态效果模式固定云姿。鱼漂与云朵共用矢量轮廓，无新增位图资源。

新出场素材使用内置 imagegen 生成，透明 PNG 保存为 `skins/tracer/fishing-art/summon-journey-ruyi-v2.png`。完整提示词、参考素材和 SHA-256 记录在 [素材清单](fishing-journey-vfx-art.json) 的 `ruyi` 条目中。

验证入口：

- `dev/qa-fishing-staff-blade.cjs`：两种模型、正反最大弯曲、出场与四阶段法术、WebGL / Canvas，共 120 个画面检查。
- `dev/qa-fishing-journey-vfx.cjs`：西游全部出场与天雷鼓回归、透明素材、减少动态效果及 WebGL 资源释放。
- `test/fishing-journey-art.test.js` / `test/fishing-spell-effects.test.js`：完整转数、旋转方向、刚体长度、收势、真实绘制分发与静态降级。
- `dev/build-fishing-catalog-art.cjs`：使用最新实体模型重建图鉴。

画面见 `output/fishing-staff-blade/review.png`；可播放预览见 `output/fishing-staff-blade/motion.html`。
