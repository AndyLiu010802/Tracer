# 钓鱼生物造型参考与美术约束

核对日期：2026-10-06。对象为 `public/fishing-model.js` 中的 20 个鱼类条目。基线截图：`.cache/fishing-visuals-CSdYZV/fish.png`。下表中的问题是对此基线的视觉审计，不表示新版渲染仍存在这些问题。

游戏名称大多没有指定拉丁学名，因此下面的“生物基底”是本项目为保持形态一致而作出的设计选择，不是野外鉴定结果。幻想鱼保留真实生物的身体结构，再叠加原创颜色、发光与装饰。所有来源只用于形态研究；不把第三方照片直接复制为游戏贴图。

## 共同原则

- 先做对轮廓、鳍的位置和数量、口形、尾形，再增加鳞片、珠光与特效。缩成卡片时，仍应能从轮廓区分海马、鲶、鲟、魟、鲸和普通鱼。
- 可爱化优先采用较饱满的额头、略大的有虹膜眼睛、柔和背腹渐变，以及柔软而有支撑的鳍膜。眼睛、口和鳃盖应嵌入头部曲面，避免眼球像贴上去的玻璃珠、下颌像独立球体。
- 鳞片只覆盖适用的躯干部位。鲶没有鱼鳞；海马用骨环；鲟用骨板；鲸用光滑皮肤。不可给所有身体叠同一种网格鳞纹。
- 多数鱼没有可活动的眼睑。真实鱼的灵动来自眼球轻转、嘴与鳃盖的呼吸、胸鳍维持姿态及躯尾摆动；不使用通用的人类式闭眼动作。鲸作为哺乳动物可保留轻微眨眼。[Shedd Aquarium](https://www.sheddaquarium.org/stories/aquarium-faq-do-fishes-sleep)
- 鱼鳍的膜可以半透明，但鳍基和主鳍条需要可见；末端渐薄，不把整片鳍做成均匀透明的网纱。软鳍边缘随水流弯曲，棘背鳍保持形状。头部与躯干不应像软糖一样整体伸缩。

## 真实鱼与真实形态基底

| 游戏 ID / 名称 | 生物基底与不可省略的结构 | 基线需要改正的地方 | 可爱化及美术亮点 |
| --- | --- | --- | --- |
| `minnow` 银鳞小鱼 | 小型鲤形目鲦类；单一软背鳍、无脂鳍，细长身、清楚的尾柄。这里不指定某个狭义物种。[Missouri Department of Conservation](https://mdc.mo.gov/discover-nature/field-guide/minnows) | 与沙丁、鲭鱼几乎共用同一身体与同一鳍组，只靠颜色区别。 | 小巧亮眼、银色侧线反光、较小而清透的鳍；快速短促尾拍后有滑行停顿。 |
| `crucian` 金背鲫鱼 | 金鲫 `Carassius carassius` 型：高背侧扁、长而外缘微凸的背鳍、无口须、尾浅凹。[USGS](https://nas.er.usgs.gov/queries/greatlakes/FactSheet.aspx?Potential=Y&Species_ID=509&Type=2) | 身体像金色圆球，背鳍短而高，尾叉过深，鳞片与鳃盖读不清。 | 圆润腹部和铜金背部保留，背鳍沿背延长；少量清楚的重叠鳞片给体积感。 |
| `carp` 红尾鲤鱼 | 普通鲤 `Cyprinus carpio` 型：粗壮但前后收束，长背鳍，上颌两侧各两根口须，大鳞边缘组成错列纹理。[Missouri Department of Conservation](https://mdc.mo.gov/discover-nature/field-guide/common-carp) | 与鲫鱼同轮廓；须像小点线，长背鳍和厚唇不突出。 | 保留两对短须和轻微下位厚唇，用红色尾缘和金铜鳞片做主亮点，避免变成鲶鱼长须。 |
| `perch` 斑纹河鲈 | `Perca` 河鲈型，以黄鲈参考：前棘背鳍与后软背鳍明显分开，6–8 条深色竖带，橙红色下部鳍，身体适度延长。[Maryland DNR](https://dnr.maryland.gov/fisheries/pages/fish-facts.aspx?fishname=yellow+perch) | 只有一片软帆背鳍，条纹像等距波浪，身体过于接近鲫鱼。 | 棘尖可磨圆但不能消失；眼睛明亮、橄榄背和浅金腹、橘色胸腹鳍形成温暖配色。 |
| `trout` 虹斑鳟鱼 | 虹鳟 `Oncorhynchus mykiss`：侧面粉红带，背部及背鳍、脂鳍、尾鳍有小暗斑；保留背鳍后方的小脂鳍。[South Carolina DNR](https://www.dnr.sc.gov/aquaticed/trout/species.html) | 粉带已有，但缺小脂鳍；暗点均匀撒满像噪声，尾上缺对应斑点。 | 粉带边缘渐变，暗点采用稀密变化；银腹和冷绿背形成珠光，不能让粉带变成装饰腰带。 |
| `sardine` 蓝脊沙丁 | 太平洋沙丁 `Sardinops` 型：蓝绿背、银白侧面，侧中部一至数排深点；小而流线。[NOAA Fisheries](https://www.fisheries.noaa.gov/species/pacific-sardine/resources) | 与银鳞小鱼仅有背部颜色差，头腹过于尖薄，侧斑缺失。 | 身体略饱满、较清楚的银色鳃盖、侧面一排小暗斑，尾拍节奏整齐。 |
| `mackerel` 青纹鲭鱼 | 鲭 `Scomber` 型：两个分离背鳍；第二背鳍及臀鳍后各有一列小离鳍；细尾柄、深叉尾；背部密集深色波纹。[FAO](https://www.fao.org/4/x5938e/x5938e01.htm)、[NOAA Fisheries](https://www.fisheries.noaa.gov/species/atlantic-mackerel/seafood) | 缺第二背鳍与离鳍，只有几条粗竖纹，接近换皮鲦鱼。 | 头部适当圆化但保持纺锤体；背部青蓝波纹与亮银腹对比鲜明，小离鳍成为辨认点。 |
| `catfish` 胡须鲶鱼 | 明确采用成年鲶 `Silurus asotus`：两对须，上颌长、下颌短；宽扁头、较小且位置偏高的眼、小背鳍、长臀鳍、光滑无鳞、非深叉尾。幼体可有三对须，本项目成年形态不混用。[新潟市水族馆](https://www.marinepia.or.jp/picturebook/fish/entry-11603.html)、[琵琶湖博物馆](https://jmapps.ne.jp/ikimono/det.html?data_id=7960)、[日本国立科学博物馆](https://www.kahaku.go.jp/research/db/zoology/uodas_freshdb/area/siluridae/086.html) | 当前是普通纺锤鱼加须；背鳍大、尾深叉、缺长臀鳍与宽扁头。不要改成八须的北美沟鲶。 | 宽圆吻部、柔软而连续的两长两短须、珍珠灰皮肤、慢速底栖滑行；眼睛可略放大但不能达到金鱼比例。 |
| `koi` 丹顶锦鲤 | 鲤的体型、长背鳍、两对短须；颜色采用丹顶红白型：白身与头顶一块独立红斑，身体不再出现红斑。[鲤结构：Missouri Department of Conservation](https://mdc.mo.gov/discover-nature/field-guide/common-carp)；[丹顶标准：Kloubec Koi Farm，育种者一手说明](https://www.kloubeckoi.com/tancho-koi/) | 现有红斑遍身，不符合“丹顶”视觉；尾像多层蝴蝶尾，与金鱼难区分。 | 温润白瓷身体、头顶朱红圆斑作为唯一焦点，尾鳍可略飘逸但仍是一片正常分叉尾，不能做双尾。 |
| `goldfish` 流金蝶尾 | 采用蝶尾龙睛金鱼的形态语汇：短圆身、对称侧向突出眼、立背鳍、真正分开的双尾，俯看左右张开成蝴蝶。[The Goldfish Council：品种标准制定者](https://www.thegoldfishcouncil.org/post/telescope) | 当前尾部更像同一竖直平面上叠几片花瓣，缺左右两半与四叶层次。 | 不过度夸张突眼；透明金色尾缘与较实的橙金鳍条，游动时双尾向后收拢，停下再展开。 |
| `seahorse` 珊瑚海马 | `Hippocampus`：直立、马形头颈、细长管吻、骨环、可卷握的无尾鳍长尾，小背鳍与鳃后小胸鳍。[Aquarium of the Pacific](https://www.aquariumofpacific.org/onlinelearningcenter/species/longsnout_seahorse) | 身后错误保留了普通鱼的大叉尾；吻短成小喇叭，尾卷很短，身体与头衔接显拼装。 | 长管吻可适度缩短但仍明确是管状；圆润胸腹、连续 S 形脊线、珊瑚色骨环，靠小鳍频振和轻摇移动。 |
| `angelfish` 琉璃神仙鱼 | **海水神仙鱼 Pomacanthidae 基底**，参考半圆神仙 `Pomacanthus semicirculatus`：近圆而侧扁、短吻小口、连续背鳍及臀鳍、圆尾；幼鱼后体半圆条纹。[Smithsonian STRI](https://biogeodb.stri.si.edu/caribbean/en/thefishes/species/5655) | 目前像淡水神仙 `Pterophyllum` 的三角身，与 `habitat: sea` 及虾饵设定冲突。此次保持海洋玩法，重做海水形态，不混加淡水神仙的长丝状腹鳍。 | 玻璃蓝与淡紫环状条纹，背臀鳍柔软延展；身体厚度保持侧扁，不变成正面圆球。 |
| `lantern` 灯笼深海鱼 | 这是以深海鮟鱇为基底的幻想鱼，不是狭义灯笼鱼科。吻上方改造鳍条末端有发光拟饵，宽口，短小尾部。[Monterey Bay Aquarium](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/deep-sea-anglerfish) | 身体虽变圆且有灯，但仍是普通鱼大背鳍与叉尾；嘴几乎不可见，核心鮟鱇特征不够。 | 圆润宽嘴、少数细小圆钝牙、温暖黄灯与深蓝绒面皮肤；避免布满尖长牙破坏亲近感，灯杆柔性小幅摆动。 |

## 幻想鱼的生物结构与原创亮点

| ID / 名称 | 必须保留的真实结构 | 原创亮点与基线改进 |
| --- | --- | --- |
| `lotusfin` 荷灯灵鲤 | 鲤的鳍组、短须、连续尾柄；采用上表鲤参考。 | 荷瓣形鳍缘属于艺术设计，不能把每片鳍变成实体花瓣。粉白身体、淡绿鳍缘、局部荷灯光点；鳍基清晰，尾为单一分叉尾而非金鱼双尾。 |
| `moonfin` 月光鳍鱼 | 选择长鳍观赏鱼体型，保持鱼的胸腹背臀鳍位置与鳞片朝向，不添加海马/鲸结构。 | 月白半透明长鳍、柔紫边缘、两条可追踪根部的延长软鳍条。当前纤细飘带像游离虚线，应从鳍的末端连续长出。 |
| `crystal` 水晶雪鲟 | 鲟型：吻部伸长、口前四根须、沿身五列骨板、后置背鳍，上长下短异尾。[NOAA Fisheries](https://www.fisheries.noaa.gov/species/atlantic-sturgeon) | 当前像小鱼背上装一排圆齿，缺鲟吻须和异尾。冰晶应该来自骨板的半透明棱面，不是额外随机尖刺；吻尖可磨圆、骨板降低，仍需一眼像鲟。 |
| `phoenixfish` 朱羽凤尾鱼 | 鱼身加延长的鳍条与膜，不是鸟羽毛直接插在躯干。 | 金橙鳍基、朱红中段、淡金末梢；分束长尾逐渐变细，躯干不能一直复用金鱼球体；慢速尾波带出凤凰意象。 |
| `dreamray` 星梦魟鱼 | 扁平、左右胸鳍与躯体连成盘；眼与喷水孔位于背侧，嘴与鳃裂在腹侧，长鞭尾。参考蝠魟的宽盘与胸鳍游泳。[Aquarium of the Pacific](https://www.aquariumofpacific.org/onlinelearningcenter/species/bat_ray) | 基线像倾斜的纸风筝，两眼位置显孤立。补出柔软有厚度的躯体中央与眼后喷水孔，双翼宽柔波动；腹部奶白，星点只在背面，不把腹面鳃裂画成笑脸眼睛。 |
| `dragonkoi` 九霄龙鲤 | 幻想龙与鲤的混合体；保留可解释的鱼鳃、胸鳍、连续躯尾曲线与实际口部，鲤须应有明确根部。 | 当前背部像一排厚花瓣，细长身像软管。以头宽到尾细的连续体积、扇状鱼尾、低矮渐变背鬃、玉金鳞片组织龙感，角和鬃为明确幻想装饰。 |
| `galaxywhale` 星河幼鲸 | 哺乳动物：水平展开的尾叶与上下尾拍、胸部一对鳍肢、后置小背鳍、头顶气孔；无鱼鳞、鳃盖、腹鳍和臀鳍。形态可参考小须鲸/座头鲸幼体，但不声称对应特定物种。[NOAA Fisheries](https://www.fisheries.noaa.gov/species/humpback-whale?page=1)、[Whale and Dolphin Conservation](https://uk.whales.org/whales-dolphins/why-do-whale-and-dolphin-tails-go-up-and-down/) | 基线头身已经圆润，但尾叶仍读作普通鱼尾，腹面结构不清楚。应在略俯三分之四视角露出水平双尾叶；大圆额、细小嘴线、奶白腹部与稀疏星云光点做主亮点。 |

## 视觉验收

1. 单色轮廓检查：无需文字即可区分鲫、鲈、鲶、海马、神仙、鲟、魟、鲸；鲭的离鳍、鳟的脂鳍在近景可以辨认。
2. 侧视与三分之四视角检查：鱼的远侧鳍不能误读成第二条尾；蝶尾金鱼有真实左右双尾；鲸的尾叶平面明确水平。
3. 动态检查：普通鱼侧向尾拍、鲸上下拍尾、魟胸鳍起伏、海马小鳍频振；眼球轻转与鳃呼吸替代普通鱼的人类式眨眼。
4. 生物特征优先：提高细节不能只靠增加点、线、随机鳞纹。头部保持干净，亮点集中在眼神、品种标志和一处材质主题。
5. 图鉴、钓起近景与鱼塘应使用同一模型和同一形态参数；缩小后仍保留主要种类特征。
