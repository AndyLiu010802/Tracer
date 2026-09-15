# 魔法子系统 · 方案提案（给项目负责人）

日期：2026-09-07 · 仓库 `engineering-docs-portal` · 皮肤 `skins/db-console/`
输入：侦察员设计输入文档、三份候选 spec（A 战斗魔法优先 / B 技能型 Alt Magic 优先 / C 最小混合）、三位评委（melvor / eng / product）的评审 JSON。
本轮只做设计，不改仓库任何文件。配套的候选 spec 全文：`scratchpad/magic-spec-draft.md`。

---

## 一句话结论

**采用方案 C「最小混合」为骨架，嫁接 A 的数值对齐与战斗日志记号、B 的符文保留率与 pg_proc 伪装词表、以及「锭 → 符文」第二条刻符配方**——法术是一把不占槽的武器（`matk + 威力 − 怪 mdef`），符文是矿石或锭刻出来的弹药（第三个非战斗挂机活动，接入开采/冶炼互斥），法书是一次性金币门票；一个新 tab `functions`、一个新模块 `magic.js`、约 11 个实施任务。

---

## 推荐方案是什么、为什么

### 评分

| 方案 | melvor | eng | product | 合计 | fatal_flaws |
|---|---|---|---|---|---|
| A 战斗魔法优先 | 36 | 36 | 36 | 108 | 无 |
| B 技能型 Alt Magic 优先 | 35 | 37 | 36 | 108 | **1 条**（melvor：作为最后一个子系统却不做战斗魔法） |
| **C 最小混合** | **37** | **39** | 35 | **111** | 无 |

三位评委两位选 C（melvor、eng），一位选 B（product）。

### 分歧点与裁决

product 评委选 B 的理由是伪装最强（pg_proc 列名、过程语言、真实类型名）和「不依赖副本页前台 400ms 定时器、最贴挂着不盯」。但 B 被 melvor 评委判了 fatal flaw：**任务明确说魔法是最后一个未做的子系统**，B 把攻击法术、怪侧 mdef、caster 改魔攻整个留给「后续 spec」，等于承诺一个不存在的第 7 期；matk/mdef 在战斗里仍是零消费方、36 只怪机制不变。eng 评委也指出 B 的两期合计工程量高于 C 一次做完。

因此裁决为 C，理由三条：
1. **五个洞的闭合度最高**：matk/mdef 双双落地（施法打怪 mdef、caster 打玩家 mdef）；矿石有第三条出路（刻符）；新增第三个挂机活动接入互斥框架；法书 424,000 一次性 sink（三份里最大，正好落在任务给的「再加 30~50 万」区间上沿）。
2. **Melvor 贴合最高**（melvor 9/10）：复现的正是 Mining → Runecrafting → Magic 三段，且没有金币可以跳过的后门；「先物理打 caster 攒饰品 → 再用魔法刷 boss」是不需要教程的自然引导。
3. **工程上每一半都是现成模式的直接复制**（eng 39 是三份最高）：combat 侧是 A 的同构但砍掉了最难的 castBudget/payCasts/autoBuy 三件套；刻符侧是 settleSmelt/startSmelt/fnBody 断言的一比一照抄。

C 的两个已知短板——**没有经常性金币 sink、锭没有新出路**（三位评委都点了）——用下面的嫁接补上。product 给 C 伪装只有 7 分的两个具体点（`policy` 语义错位、`glyph` 不是 PG 概念）也在嫁接里处理了一半。

---

## 嫁接了什么（逐条：要 / 不要，为什么）

### 要

| # | 来源 | 嫁接内容 | 为什么要 |
|---|---|---|---|
| G1 | A（melvor 评委） | **power 精确对齐**：法术威力 5/11/19/34/53/77 → **8/15/26/41/60/83**，使「同档全套、刚解锁」的 `matk + 饰品 + power` 恰等于 `atk + 武器 + 特殊`（21/43/74/117/172/237）；配套 mdef 倍率表 normal 1.0 / swift 0.8 / brute 0.5 / caster 1.6 / boss 1.2；对齐等式写进 magic.test.js | 胜负只由怪的 mdef/def 之差决定，normal/swift 完全中立、brute +25%、boss +11%、caster −22%——比 C 的「0.8×武器 atk 恒弱 3%」干净，且三处一改就报红 |
| G2 | B（eng 评委） | **mdef → 符文保留率** `preserve = min(0.4, mdef × 0.004)`，rng 可注入，在线 battleTick 与离线 settleOffline 用同一个掷法 | 替代 A 的「饰品档位 ≥ 法术档位减半」：不需要 carry 奇偶状态，一行进扣符文逻辑；让 armor（mdef 2×scale）对法术玩家也有意义，不让饰品一枝独秀。mdef 一身二用（抗 caster + 省符文）与 luk 一身四用、agi 一身二用的既有做法一致 |
| G3 | A（melvor 评委）+ product 评委 | **锭 → 符文第二条刻符配方**：`1 同档锭 + INSCRIBE_COINS(10/20/30/40/50/60) 金币 → 80 符`，与 C 的 `1 矿 + 1 煤 → 20 符` 同在 settleCraft 循环里（金币当作一种库存做 craftCheck，不够就像料尽一样 stopped） | 补 C 唯一缺的两格：锭的出路 + 随施法吞吐线性流出的经常性金币 sink（满速 T6 ≈ 5,000 金币/时）。80 而不是 40：80 符的矿石路线价值（12/24/44/84/164/304）恰与锭售价（10/24/46/88/172/318）持平，所以「卖锭」与「锭刻符」价值中立、金币手续费就是净 sink；每矿多出 33% 符文是花钱买的（真正的决策），若取 40 则每矿只有 13 符、永远被矿路线压制、没人用 |
| G4 | A（eng + melvor 评委） | **战斗日志 `magic` 透传 + `~N` 记号**：resolveRound 的 log.push 加 `magic: a.magic`（C spec 漏写，battleTick 按它计数扣符文必需）；battleView 伪装下法术命中写 `~N`（PG 正则匹配运算符），真身「施放」 | 前者是功能必需的 1 行；后者成本 1 个三元，让「正在施法」在副本页每回合可见（瞥一眼就懂），也让 caster 改走魔攻这件事对玩家可感 |
| G5 | B（melvor 评委） | **pg_proc 伪装词表**：魔法页法术表列头 `proname / procost / proargtypes / proacl`；法书不再叫 `policy`，改为该函数的 ACL——按钮 `grant · N tokens`，已购显示 `granted` | `GRANT EXECUTE ON FUNCTION` 正是 PG 里「允许调用函数」的真实语义，修掉 product 指出的「policy 管的是行」错位；`procost`（pg_proc 真实列）恰好是「威力」的伪装。不采 B 的过程语言法书（VACUUM 不是用 plpgsql 写的）与 `oid/tid/cid` 符文名（丢掉 C 那个「符文前缀镜像矿档」的伪装态可读性） |
| G6 | B（eng 评委） | **跨模块撞词测试**：Magic 的 SPELLS/RUNES/tab job 两两不重复，且不与 Mining/Equip/Combat/Fishing 任何 job 重复 | 把「grep 0 命中」从人工承诺变成守卫 |
| G7 | A（eng 评委） | **`state.runes` 写入站点源码断言**：只允许出现在 render 刻符落账、battleTick 扣符文、render 离线块扣符文三处（fnBody 判定） | 守住「符文只进不出、没有第二个来源」这条经济约束 |
| G8 | B（eng 评委） | **migrateMagic 裁决三组显式用例**：{vein + craft} → craft 清空；{smelt + craft} → craft 清空；{craft 单独} → 保留；两次调用幂等 | 与 mining.test.js 现有「只有冶炼在跑时不误伤」对称 |

### 不要

| 来源 | 建议 | 为什么不要 |
|---|---|---|
| A / B（product 评委） | 符文商店按包购买 + autoBuy（或 eng 的「买包不 autoBuy」） | 允许用金币绕过整条 Mining → 刻符 → 施法 技能链（melvor 评委的核心反对），且 C 的「符文耗尽退回普攻」已经满足零输入；G3 的锭配方已提供经常性 sink，不需要第二个 |
| A（melvor 评委） | 饰品即法器（tier ≥ 法术 tier 减半，carry 奇偶） | 被 G2 替代：多一个跨场次/离线一致的 carry 状态，且 magic.js 要读 `equipped.accessory.key` 查 Equip 表，打破「不 require 兄弟模块」约定（eng 评委点名） |
| B（melvor 评委） | matk → 刻符提速 `2000 × (1 − min(0.5, matk×0.004))` | 刻符永远是短活（1,800 次/时 vs 矿脉 254~720 矿/时），提速几乎无感；冶炼刻意不吃任何属性，刻符保持同一口径；matk 已在战斗里活了，不需要硬找第二份工 |
| B（product 评委） | 战斗魔法预留 FAMILIES 第四族 | 本方案战斗魔法已在本期，无需预留 |
| product 评委 | T1 免费、6 行折表、emoji 兜底 | C 已经全有，不是嫁接 |

---

## 有意不做什么

- **Curses / Auroras**：resolveRound 是无状态的，做 buff 要加状态机；攻击法术一条线已让 matk 活起来。
- **法杖 / 新装备槽 / 30 件表改 key**：forge spec 硬约束。
- **独立魔法等级 / Mastery**：全局单一等级硬约束。
- **Alt. Magic（Superheat / Item Alchemy / Just Learning）**：Superheat 免煤会抹掉开采 spec 明写的唯一决策点「挖矿 vs 挖煤」；Alchemy 与「卖」重叠。刻符本身就是「矿石 → 另一种产物」的转化。
- **符文精华矿脉**：直接用煤当通用精华，反哺煤脉价值，不加 VEINS 行。
- **符文可售 / 进 sellall / 进 lock**：一旦可卖，刻符就是「矿石加价出售」，又变 source。
- **符文商店**：见上表。
- **副本页风格条**：法术在魔法页全局单选 `state.spell`，副本页只加一句 kb-hint，少一个 UI 面。
- **统一离线上限按时长（Melvor 24h）**：刻符沿用 `OFFLINE_CAP = 2000` 次（= 67 分钟，与冶炼同口径）；战斗仍 2000 回合。只给魔法改口径会让它成为三方互斥里唯一「过夜不亏」的活动。另开 spec。
- **装备升级入口、mats 出路、本期出图**：与魔法无关或另开任务。

---

## 与现有系统怎么接

### 互斥（开采 / 冶炼 / 刻符 三方）
- 状态形状 `state.craft = { rune, src: 'ore'|'bar', last }`，与 `state.smelt` 同构。
- 互清矩阵：`selectVein` 加 `state.craft = {...null}`；`startSmelt` 加同一行（check 之后）；新 `startCraft` **check 先于 mutation**，然后 `state.craft = {...}`、`state.smelt = {bar:null}`、`state.mine = Mining.stopVein(...)`（绝不裸改 `state.mine.*`）。
- 加载裁决 `migrateMagic`：`(mine.vein || smelt.bar) && craft.rune → craft.rune = null`，优先级 **开采 > 冶炼 > 刻符**；必须在 `Mining.migrateMining` 之后调用。
- render() 刻符结算块放冶炼块之后、钓鱼回收之前。
- mining.test.js 源码断言：③ `state.mine =` 下限 3 → 4；② 新增 `fnBody('startCraft')` 含 `Mining.stopVein(` 与 `state.smelt =`、`selectVein`/`startSmelt` 含 `state.craft =`；新增 `craftCheck` 出现位置 < `state.craft =`。
- 战斗与非战斗不互斥，沿用（Melvor 同）。

### 等级门槛
1/5/10/16/23/31 第四处，法术、符文、法书同档同值；`Magic.TIER_UNLOCK` 与 `Combat.TIER_BASE.unlock`、`Equip.TIER_UNLOCK`、`Mining.VEINS.unlock` 一致性断言。法书购买也按等级门槛（与矿脉/锻造一致，避免新手把钱砸进用不了的法术）。

### 经济量级
- 一次性 sink：418,200 → **842,200**（法书 0 / 4,000 / 15,000 / 45,000 / 110,000 / 250,000）。
- 经常性 sink：锭刻符手续费。满速施法 9,000 符/时全走锭路线 = 112 锭/时 → T1 1,125 / T6 6,750 金币/时；实际受矿供给约束，T6 一小时的矿（254）走锭路线 ≈ 5,040 金币。
- 矿石机会成本：铜符 0.15 金币/符（1,350/时）→ 虚空符 3.8/符（34,200/时，相当于 block_void 一个多小时产出）；高档法术是真消耗。
- 不新增任何金币 source；不改任何现有活动的每小时产出。

### 战斗公式
- `attack()`：`attacker.castPower != null` → `max(0, matk + castPower − defender.mdef)`；否则原路径逐位不变。闪避、暴击共用。
- `monsterStats()`：加 `mdef = round(TIER_BASE.def × ROLE_MULT.mdef)`；caster 加 `matk = atk`、`castPower: 0`（改走魔攻打玩家 mdef）。
- `settleOffline(..., cast = {power, runes, preserve})` 第 6 参，返回 `runes`（已耗数）；不传行为不变。
- 零伤安全挂机与 STALL_ROUNDS=300 天然覆盖魔法路径：同档全套 mdef（11/23/40/65/96/134）对同档 caster 魔攻（9/18/31/51/81/130）一律 0 伤。

---

## 风险

1. **两条回归前线同时开**（combat.test + mining.test）。缓解：combat 改动是并行分支（旧用例不带 castPower 逐位不变）；刻符是 settleSmelt 照抄；任务顺序「纯逻辑先绿 → 接线 → farm.js」。
2. **金币进 settleCraft 循环**是新东西（冶炼只有材料）。缓解：金币当作与 ores/bars 同形的库存，负增量落账走 `earn(co.coins)`（负数已下限 0）；测试覆盖「锭够金币不够 → stopped」。
3. **裸装玩家对 caster 受伤上升**：T6 caster 打 L31 裸装 76/击（改前物理 60）。这是 mdef 成为「打 caster 该穿什么」答案的代价，同档全套仍 0 伤，低两档仍 0 伤。见待拍板 Q3。
4. **法术对裸装新手偏强**：L1 裸装法术 16 vs 普攻 13（法术自带 power、普攻没武器）。可接受：这正是 Lv1 免费法书的新手体验，与 Melvor Wind Strike 同。
5. **UI 密度**：第 11 个 tab 换行；魔法页两张 6 行表（符文表每行两个刻符按钮）。伪装下像控制台二级导航，可接受。
6. **farm.js 估算偏乐观**：eng 评委按 A 的 combat 半份 + B 的互斥半份折算应为 900~1,000 行含测试；本提案按 1,000 行预算。

---

## 待拍板问题（4 个）

| # | 问题 | 建议答案 | 理由 |
|---|---|---|---|
| Q1 | **锭 → 符文第二条刻符配方（G3）进不进本期？** 若不进，符文表回到 6 行单配方、无经常性 sink、锭仍只有锻造/卖两个出路 | **进**（默认取值：`1 锭 + 10·t 金币 → 80 符`） | 同一个 settleCraft 循环多一种库存，工程增量约 40 行；一次性关掉三位评委都点的两个洞。80 符与锭售价价值持平，不会让「炼锭再刻」变成白赚 |
| Q2 | **省符文机制选哪个：** mdef → 保留率（G2）/ 饰品即法器减半 / 不做 | **mdef → 保留率** `min(0.4, mdef×0.004)` | 无状态、一行、在线离线同掷法；让防具对法术玩家有意义。反对理由「因果故事弱」可用真身文案「魔防越高，符文越不易散逸」化解 |
| Q3 | **caster 改走魔攻是否接受「裸装对同档 caster 受伤上升 27%」？** 备选：caster 魔攻倍率降到 1.0×base.atk（T6 118 → 裸装 64/击） | **接受 1.1×（= 现有 atk 列）** | 不加新倍率、表少一列；同档全套与低两档裸装仍零伤，「打低 1~2 档零伤怪」玩法不变；caster 本来就是各档里最危险的一只 |
| Q4 | **战斗日志伪装下法术命中用 `~N` 还是保持 `-N`？** | **用 `~N`** | 唯一每回合可见的「正在施法」信号，成本 1 个三元；`~` 是真实 PG 运算符，比 kb-hint 一句更「瞥一眼就懂」。product 担心像坏日志——但 `job ~14` 在正则语境下是合法读法 |

---

## 评分表（三方案 × 三评委，breakdown）

| 方案 | 评委 | melvor_fit | loop_closure | disguise | eng_cost_risk | tension | 总分 |
|---|---|---|---|---|---|---|---|
| A 战斗魔法优先 | melvor | 8 | 8 | 8 | 6 | 6 | 36 |
| A 战斗魔法优先 | eng | 7 | 8 | 8 | 6 | 7 | 36 |
| A 战斗魔法优先 | product | 8 | 8 | 6 | 6 | 8 | 36 |
| B 技能型 Alt Magic | melvor | 6 | 7 | 9 | 7 | 6 | 35 (fatal) |
| B 技能型 Alt Magic | eng | 6 | 7 | 9 | 9 | 6 | 37 |
| B 技能型 Alt Magic | product | 5 | 8 | 9 | 8 | 6 | 36 |
| **C 最小混合** | melvor | 9 | 7 | 8 | 5 | 8 | **37** |
| **C 最小混合** | eng | 8 | 8 | 8 | 7 | 8 | **39** |
| **C 最小混合** | product | 8 | 7 | 7 | 5 | 8 | 35 |

嫁接后预期改善：C 的 loop_closure（锭出路 + 经常性 sink 补齐）与 disguise（pg_proc 列头、`grant`/`granted` 替代 `policy`）两项各 +1；eng_cost_risk 因 G3 略降但被 G6~G8 的守卫抵消。
