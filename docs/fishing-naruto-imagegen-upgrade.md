# 火影鱼竿原画重制

> 旧弹窗验证入口已退役；本文中的相关命令为历史记录。当前验证方式见 [桌面与原画验证](fishing-live-species-upgrade.md)。

火影礼包由 30 款扩展到 45 款。原有 30 款与新增 15 款均使用内置 `image_gen` 独立生成鱼竿原画和专属忍术图集，共 90 份原始 PNG。原始透明图保存在 `skins/tracer/fishing-art/rod-naruto-*-v2.png` 和 `fx-naruto-*-v2.png`。

| 品质 | 原有 | 新增 | 完成后 |
|---|---:|---:|---:|
| 普通 | 8 | 4 | 12 |
| 稀有 | 9 | 4 | 13 |
| 史诗 | 8 | 4 | 12 |
| 传说 | 4 | 3 | 7 |
| 隐藏 | 1 | 0 | 1 |

新增普通款：木叶丸、惠比寿、玄间、出云。新增稀有款：红、红豆、白、再不斩。新增史诗款：鬼鲛、飞段、蝎、纲手。新增传说款：佩恩、扉间、大蛇丸。

抽取价格、各品质概率及保底规则保持原有规则；隐藏六道仙人的 0.5% 概率、每竿一次恢复到 35% 进度、张力增长减少 20% 均保留。图鉴仍按隐藏、传说、史诗、稀有、普通排列。

## 美术与动作

每款分别编写结构与忍术说明，使用独立生成调用。鸣人的橙黑护柄与螺旋卷线器、水门的三叉苦无、我爱罗的砂葫芦、迪达拉的黏土鸟、蝎的傀儡关节等在实体结构上区分。

佐助直刀、水月与再不斩的斩首大刀、鲛肌、三月镰和草薙剑采用完整武器轮廓，保持刚性；其余竿型使用原有 64 段连续受力曲线。握柄和卷线器保留刚性连接，鱼线连接点与物理竿尖共用骨架。

每套忍术图集包含六张独立动作画面，按蓄势、聚形、释放、主攻击、命中和余迹排列。运行时连续计算位置、旋转、大小与相邻画面混合；按投射、拳击、双重突进、挥斩、龙形前冲、地表扩展、回旋等动作分别编排。鱼竿出场也使用同一角色的短忍术。

抛竿 620 ms、咬钩 280 ms、收鱼 760 ms；等待、蓄力、遛鱼和失败时不播放。减少动态效果模式固定内部动作形态，仅短暂淡入淡出。新增七款史诗、传说鱼漂各有独立造型和自包含材质渐变。

## 流畅度与资源

原画复用上一轮的轻量绘制路径；完整武器单面绘制，普通竿型复用顶点和显卡缓冲。忍术只预载当前装备款，按文档保留最多八套近期图集；载入时缓存较小的显示图集并柔化帧边界，正常动作每帧最多采样两张相邻画面。原始 PNG 不做破坏性修改。

浏览器、桌面钓鱼窗口、离线资源清单和图鉴生成器均接入同一套原画注册表。原画用 SHA-256 修订号更新缓存。

## 检查与复验

最终验证：全量测试 1408 / 1408、桌面测试 57 / 57；45 款鱼竿共 270 次弯曲与软件回退渲染；忍术 2160 个动作采样和 5040 个静止、过期采样；实际钓鱼界面 196 个状态、45 款高品质鱼漂均通过。修订后的纲手素材另行通过 5 项资产与动作测试。可播放预览已用本地文件方式验证，45 张原画全部正常载入。

原画与动态展示：[可播放预览](../output/fishing-naruto-imagegen/review.html)。骨架、弯曲和显卡回退：[渲染预览](../output/fishing-naruto-cel/review.html)。

- [全部生成提示词](fishing-naruto-imagegen-prompts.json)
- [原始图片与修订清单](fishing-naruto-art-manifest.json)
- [特效运行检查](../output/fishing-naruto-imagegen/qa.json)
- [鱼竿渲染检查](../output/fishing-naruto-cel/qa.json)

```text
node dev/finalize-fishing-naruto-art.cjs
node dev/build-fishing-catalog-art.cjs
node dev/qa-fishing-naruto-cel.cjs
node dev/qa-fishing-naruto-painted-vfx.cjs
node dev/qa-fishing-painted-regression.cjs
node dev/qa-fishing-anime-runtime.cjs
npm test
npm run test:desktop
```

参考核对包括官方的[水门与飞雷神苦无](https://naruto-official.com/en/news/01_2536)、[鬼鲛与鲛肌](https://naruto-official.com/en/news/01_2348)、[佩恩的黑棒与轮回眼](https://naruto-official.com/en/news/01_1799)、[蝎的傀儡与核心](https://naruto-official.com/en/news/01_1641)、[扉间角色介绍](https://naruto-official.com/en/news/01_1694)及[纲手踢击造型](https://naruto-official.com/en/news/01_1851)。鱼竿是据角色特征重新设计的游戏道具，官方参考用于核对视觉元素和技能关系。
