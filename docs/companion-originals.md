# 32 帧原画与伙伴爱好

生成范围是默认六位伙伴，以及九种花精灵的普通、闪光形态。默认伙伴各 16 个动作；花精灵保留原来 16 个动作，另增独立的玩耍、手作，不再用音乐和专注代替已完成的新动作。完整目标为 420 组动作、840 张分镜页、13,440 帧原画。

2026-09-25 已补齐全部 420 组动作、840 张分镜页、13,440 帧原画；`node dev/companion-original-frames.cjs --complete` 检查通过，没有缺页或拒收项。运行 `--summary` 可重新核对实际素材，不能只依据播放器的时间轴帧数判断原画完整性。续补过程与验证记录见 `companion-images-2026-09-25.md`。

每个动作使用两张 4×4 透明 PNG，前页为第 1–16 帧，后页为第 17–32 帧。后页继续前页末尾的同一个核心动作；增加帧数只细分动作过程，不增加活动。准备、接触和收尾轻缓连贯，完成的拼装、翻页、钓鱼结果不能在收尾时撤销。

| 伙伴 | 玩耍的核心动作 | 手作的核心动作 |
| --- | --- | --- |
| 芽芽 Sprout | 轻推载着幼苗的园艺小车 | 轻压育苗陶盆的盆沿 |
| 米酥 Miso | 轻拍小鱼布偶 | 将拼布软垫的布角收好 |
| 溪溪 Brook | 将一颗鹅卵石叠到小石堆上 | 压好纸船最后一道折边 |
| 小焰 Ember | 滑动路线拼图的一块木片 | 将矿石饰片压入指南针吊饰 |
| 月芽 Luna | 缓缓转动怀里的月光石 | 收紧香草香囊的丝带 |
| 星芽 Nova | 转动小齿轮玩具 | 将晶石装入小发明的插槽 |
| 野花 | 轻拨雏菊风车 | 将压花贴入叶片书签 |
| 向日葵 | 在手中缓缓转动太阳陀螺 | 将一颗种子压入种子拼画 |
| 薰衣草 | 轻拨叶片琴的一根弦 | 将一枝薰衣草插入香草花环 |
| 苹果 | 将苹果木拼片推入凹槽 | 将果篮最后一根编条收好 |
| 桃花 | 手腕带动短丝带划过小弧线 | 压好纸扇的一道折纹 |
| 樱桃 | 轻轻倾转樱桃铃铛 | 将一颗樱桃珠滑到绳结旁 |
| 霓虹兰 | 转动透明棱镜拼玩具 | 将一块彩色片嵌入兰花拼画 |
| 电光莓 | 轻压一次弹簧玩具的按键 | 将蓝色接头压入迷你电路板 |
| 晶芯树 | 扶着平衡晶石缓缓倾转并归位 | 将一颗矿石放入迷你砂庭 |

默认伙伴依据 `pet-personalities.js` 已有设定设计；花精灵的爱好依据其植物主题补充。普通和闪光形态共享同一种爱好，但分别保留自己的颜色、细节与原画。完整英文动作说明在 `dev/companion-action-direction.cjs`，分镜提示模板在 `dev/companion-original-frames.cjs`，实际使用的提示词与生成来源记录在 `dev/companion-original-sources.json`。

使用内置 `image_gen`，素材保存到 `skins/tracer/pet-art/*-v2-p1.png` / `*-v2-p2.png` 和 `skins/tracer/garden-art/*-v3-p1.png` / `*-v3-p2.png`。原始工具输出保留在 Codex 的 generated_images 中。只有两页齐全、透明边界完整且 32 帧指纹不同的素材才能进入图集，不能用重复页面充数。

播放器在两页都加载成功后开始动作。默认伙伴按主体内部厚度的中位值校准原图尺寸，排除细柄、长尾和小道具造成的包围盒变化；花精灵优先使用脸部宽度，避免花瓣开合影响人物大小。每页使用固定比例，避免逐帧缩放导致呼吸或关节动作变形。主体中心与脚底对齐统一站位。尚未完成两页的动作继续使用原有素材，元数据 `sourceFrames` 明确区分 16 张旧原画和 32 张新原画。

```powershell
node dev/companion-original-frames.cjs --summary
node dev/build-pet-illustrated-atlas.cjs --complete
node dev/build-garden-companion-atlas.cjs
node dev/qa-companion-originals.cjs
node dev/qa-pet-illustrated.cjs
node dev/qa-garden-companion-motion.cjs
```

`qa-companion-originals.cjs` 逐帧验证已接入的新动作，检查两页顺序、独立源帧、主体比例与站位，并将待机→动作首帧→跨页→末帧→待机的截图分批保存在 `.cache/companion-originals-qa/transitions-*.png`。这类几何检查不能代替对五官、道具与动作自然程度的视觉检查。
