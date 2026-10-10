# 鱼竿十连抽

所有鱼竿奖池支持单抽与十连抽。单抽 100 金币，十连抽 1000 金币；开启十连前需要持有完整费用，重复返还另行到账。

十连逐次调用现有抽取规则，保留各奖池独立保底、固定隐藏款概率、同品质优先获得未收藏款及重复补偿。十次抽取先在隔离副本中完成，再一起提交；生成失败不会留下部分扣费。持久化失败时沿用同一批收据重试，不重新抽取。

结果集中显示十张卡片，按抽取顺序排列，标出品质、新获得与重复返还；可直接装备任意一根。桌面宽度采用两行五列，窄窗口为双列，可滚动查看；支持键盘关闭及减少动态效果。

验证涵盖所有奖池与十次单抽的一致性、余额边界、中途失败回滚、保底、重复合并、快速连点、保存重试，以及实际商店的保存、装备和刷新。浏览器检查记录见 [qa.json](../output/fishing-ten-draw/qa.json)，界面见 [宽窗口](../output/fishing-ten-draw/results-wide.png) / [窄窗口](../output/fishing-ten-draw/results-narrow.png)。

```text
node --test test/fishing-ten-draw.test.js test/fishing-pool-view.test.js test/fishing-controller.test.js
node dev/qa-fishing-ten-draw.cjs
```
