# 锻造·装备 设计 spec

日期：2026-09-03
所属：键盘农场 RPG 化第 3 个子系统（钓鱼、打怪已完成）。
**标杆：Melvor Idle**——拿不准的机制/数值/UI 结构按 Melvor 惯例来（技能化挂机、配方 smithing、装备槽+属性+等级、怪物掉落表、统一背包）。
后续（不在本 spec）：开采（矿石来源）、魔法。

## 1. 目标与范围

- **装备系统**（现在能玩）：5 槽（武器/防具/饰品/鞋/特殊），穿脱，属性汇总进战斗；可升级。
- **怪物掉装**（现在能玩）：怪按特性概率掉一件**主题贴合**的装备——这是现在获取装备的主路。
- **锻造脚手架**（矿石留空）：配方 = 打怪材料 + 金币 + **矿石**；矿石要等开采系统，所以配方现在**显示但按钮禁用**（缺矿石）。开采做好即激活。
- 沿用：严格伪装 🌱 双套名；共用等级；离线；材料在背包。
- **不做**：开采/矿石来源、魔法、随机属性 roll（装备属性固定）。

## 2. 装备模型

### 2.1 槽位（5）
| slot | 游戏名 | 黑话 job | 主属性倾向 |
|---|---|---|---|
| weapon | 武器 | executor | 攻击、暴击 |
| armor | 防具 | pool | 防御、HP、魔防 |
| accessory | 饰品 | extension | 魔攻、幸运、魔防 |
| shoes | 鞋 | scheduler | 敏捷、闪避 |
| special | 特殊 | trigger | 混合（各来一点） |

### 2.2 属性派生（系统化，紧凑好平衡）
每件装备属性 = `SLOT_BASE[slot]`（该槽 1 档基线）× `TIER_SCALE[tier]`，各项四舍五入；升级级别 L 再 ×`(1 + 0.15*L)`（L=0 起，L 上限 10）。

SLOT_BASE（1 档基线）：
| slot | atk | matk | def | mdef | hp | agi | luk | crit | eva |
|---|---|---|---|---|---|---|---|---|---|
| weapon | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 |
| armor | 0 | 0 | 5 | 2 | 30 | 0 | 0 | 0 | 0 |
| accessory | 0 | 5 | 0 | 3 | 0 | 0 | 3 | 0 | 0 |
| shoes | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 3 |
| special | 2 | 0 | 2 | 0 | 15 | 0 | 2 | 1 | 0 |

TIER_SCALE：`{ 1:1, 2:2.2, 3:4, 4:7, 5:11, 6:16 }`（贴合怪物/主角战力增长）。

`equipStats(key, level)` → 属性对象（只含非零项）。

### 2.3 穿戴汇总进战斗
新增 `equipBonus(equipped)`：把 5 个已穿槽的 `equipStats` 各项相加成一个加成对象。
`combat.js` 的 `playerStats(level, bonus)` 改为**接受一个属性加成对象**（而非单把武器），基础属性 + bonus 各项。战斗各处（battleTick / settleOffline / battleView / 副本卡牌预览）改为传入 `equipBonus(state.equipped)`。
- 空手（无武器）= 纯基础属性（Melvor 起手即弱，逼你去搞装备）。
- 旧 `DEFAULT_WEAPON`（atk+6）作为一件**起手武器**默认已穿（保证新手能打），或列为 T1 武器之一；实现时二选一（见计划）。

## 3. 装备目录（30 件：5 槽 × 6 档）

字段：`key`（存档键永不改）｜游戏名｜`job`｜slot｜tier。属性由 §2.2 派生，稀有度由档位定（1常见/2少见/3稀有/4稀有/5史诗/6传说）。

### 武器 executor
`wpn1` 生锈短刃 `rusty_executor` T1 · `wpn2` 索引之刺 `index_probe` T2 · `wpn3` 并行战斧 `parallel_axe` T3 · `wpn4` 向量长枪 `vector_lance` T4 · `wpn5` 编译者巨剑 `jit_greatsword` T5 · `wpn6` 湮灭之刃 `vacuum_blade` T6
### 防具 pool
`arm1` 连接布甲 `conn_cloak` T1 · `arm2` 缓存链甲 `cache_mail` T2 · `arm3` 池化胸甲 `pool_plate` T3 · `arm4` 屏障重铠 `barrier_armor` T4 · `arm5` 副本护壁 `replica_bulwark` T5 · `arm6` 不朽栈甲 `durable_aegis` T6
### 饰品 extension
`acc1` 加密护符 `pgcrypto_charm` T1 · `acc2` 统计之戒 `stat_ring` T2 · `acc3` 几何吊坠 `gist_pendant` T3 · `acc4` 全文项链 `gin_amulet` T4 · `acc5` 物化宝珠 `matview_orb` T5 · `acc6` 万象之核 `omni_core` T6
### 鞋 scheduler
`shoe1` 轮询草鞋 `roundrobin_sandals` T1 · `shoe2` 疾风靴 `scheduler_tuned` T2 · `shoe3` 亲和缓靴 `affinity_boots` T3 · `shoe4` 抢占战靴 `preempt_greaves` T4 · `shoe5` 光速跃履 `lightpath_striders` T5 · `shoe6` 时隙之翼 `timeslot_wings` T6
### 特殊 trigger
`spc1` 心跳护身 `heartbeat_ward` T1 · `spc2` 钩子饰环 `hook_band` T2 · `spc3` 级联符文 `cascade_rune` T3 · `spc4` 断言之瞳 `assert_eye` T4 · `spc5` 事务图腾 `xact_totem` T5 · `spc6` 归墟法典 `void_codex` T6

## 4. 怪物掉装（主题贴合，系统化）

怪的 `role` 决定它掉哪个槽、`tier` 决定档位——所以「特性相符」：
`roleToSlot`：normal→weapon，swift→shoes，brute→armor，caster→accessory，boss→special。
一只怪掉的装备 = 目录里 `slot=roleToSlot(role), tier=怪.tier` 的那件。
- 掉率：小怪 5%（`luk` 每点 +0.05%），boss 25%。
- boss 除了本档 special，另有一半概率多掉一件本档随机槽的装备。
- 掉落进入 `owned`（装备栏），也堆进战斗的战利品堆、结束时一起拾取（复用现有 loot 流）。

> 因此 36 只怪天然覆盖了 30 件目录（每档 5 role → 5 槽），迅捷怪掉鞋、蛮力怪掉甲、施法怪掉饰、普通怪掉武器、boss 掉特殊。

## 5. 锻造（脚手架·矿石留空）

### 5.1 配方
每件装备一条配方 `RECIPE[key] = { mats:{...}, ore: N, coins: N, level: 解锁等级 }`：
- `mats`：该档对应的打怪材料若干（按 tier 取 1–2 种、数量随档升）。
- `ore`：矿石数量（>0）——**矿石来源是开采系统，本期无处可得**，故配方永远「缺矿石」，造/升按钮禁用。
- `coins`：金币。
- `level`：角色等级需求（= 该档怪的解锁等级，Melvor 式等级门槛）。

### 5.2 升级
`upgrade(key)`：把已有装备 +1 级（`equipStats` 的 L+1），消耗材料 + **矿石** + 金币（随当前级递增）。同样矿石留空 → 暂锁。

> 本期锻造是**可见但点不动的脚手架**：配方列表、产出预览、需求（材料/金币/矿石）都渲染，矿石那栏显示「待开采」，按钮 disabled。开采子系统落地后，把矿石接上即全部激活——本期不写矿石获取逻辑。

## 6. UI

### 6.1 背包 tab 扩成「装备/背包」（`inv`，job `objects`）
- **角色面板**：5 个装备槽（显示已穿件/空位，点击穿脱）+ **8 属性面板**（基础 + 装备汇总，分别显示或合并显示）+ HP。
- **已有装备**：`owned` 列表，按槽分组；每件显示名/属性/升级级别 + 「穿戴 / 升级(锁) / 分解」。
- **材料**：现有材料清单（state.mats）保留在此页下方。
- 立绘：装备图标 `equip/<key>.webp`（缺图回退 emoji，伪装模式不出图）。

### 6.2 锻造 tab（新，`forge`，job `smithy`）
- 配方列表（按槽/档），每条：产出装备立绘+名、所需材料/金币/**矿石（灰显·待开采）**、等级门槛；「锻造」按钮因缺矿石 disabled，hover 提示「需矿石，开采系统开发中」。

> 标签栏渐长（农场/仓库/钓鱼/副本/装备背包/锻造/统计），若过宽，标签栏允许换行（CSS flex-wrap）。

## 7. 数据模型

### 7.1 模块 `skins/db-console/equip.js`（UMD，仿 fishing/combat）
纯数据：`SLOTS`、`SLOT_BASE`、`TIER_SCALE`、`EQUIP`（30 件）、`EQUIP_KEYS`、`RARITY`（复用/自带）、`RECIPE`、`roleToSlot`。
纯逻辑（可单测）：`equipStats(key, level)`、`equipBonus(equipped)`、`dropForMonster(mobKey)`（返回该怪对应的装备 key）、`rollEquipDrop(mob, luk, rng)`（返回掉落的 key 或 null）、`recipeAffordable(key, state)`（材料/金币够不够，矿石永远缺）、`migrateEquip(state)`。

### 7.2 存档新增（farm v3，load 补默认）
- `state.equipped`：`{ weapon:null, armor:null, accessory:null, shoes:null, special:null }`，每槽为 `{ key, level }` 或 null。
- `state.owned`：`[{ key, level }, ...]` 已拥有装备列表。
- `state.oreCount`：矿石数量（标量 number，本期恒 0，开采系统填）。

> **v1 简化（有意，不是遗漏）**：① boss 额外随机掉一件（§4 那条）v1 不做——先单件掉落；② 显式稀有度字段/RARITY 导出 v1 不做——UI 用档位/Lv 表达装备强弱，稀有度点推迟；③ 配方 v1 每档 1 种材料（非 1–2 种）。这三条都属打磨，锻造又整体锁着，等开采落地时再一起补。

### 7.3 combat.js 改动
`playerStats(level, bonus)` 语义从「单把武器」改为「属性加成对象」（向后兼容：`DEFAULT_WEAPON` 仍可作 bonus 传入，atk 加成不变，现有测试仍绿）。farm.js 战斗各处传 `Equip.equipBonus(state.equipped)`。

## 8. 迁移 / 兼容
- `migrateEquip(state)` 补 `equipped/owned/ore` 默认。旧存档无影响。
- 不动钓鱼/farm-data.js。combat.js 仅改 playerStats 语义（保测试绿）。

## 9. 美术资源
- 装备图标 `skins/db-console/equip/<key>.webp` ×30（物品图标，风格同材料；缺图回退 emoji）。出图 prompt 待 spec 通过后另出。
- 本期无怪物/塘等新美术。

## 10. 测试要点（equip.js 纯逻辑）
- `equipStats`：槽×档派生正确、升级 ×(1+0.15L)、只含非零项。
- `equipBonus`：多槽求和；空槽跳过；空手为空。
- `dropForMonster`/`roleToSlot`：迅捷→鞋、蛮力→甲、施法→饰、普通→武器、boss→特殊，档位匹配。
- `rollEquipDrop`：掉率随 luk、boss 更高；注入 rng 命中/不命中。
- `recipeAffordable`：矿石恒缺 → 永远 false（本期锁死）；材料/金币判定正确。
- `migrateEquip`：补默认不丢旧数据。
- `playerStats(level, bonus)`：加成对象正确叠加，DEFAULT_WEAPON 兼容（现有 combat 测试不回归）。

## 11. Melvor 对齐备忘
- 配方 smithing 用矿石、等级门槛：Melvor smithing 用 ore/bar + level。
- 装备槽 + 固定属性 + 等级需求：Melvor equipment。
- 怪物掉落表出装备：Melvor combat drops。
- 统一背包（bank）：本作背包 = 材料 + 装备 + 角色面板。
- 拿不准的数值/流程，按 Melvor 惯例补默认。
