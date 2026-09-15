# 魔法 Magic 子系统设计

日期：2026-09-07
皮肤：`skins/db-console/`（键盘农场，伪装成 Supabase 控制台；tracer 皮肤经 `window.DBFarm` 复用同一份 farm.js）
标杆：Melvor Idle（Combat 的 Magic 攻击风格 + Standard Spells + Runecrafting 产符文）
所属：键盘农场 RPG 化第 6 个、也是最后一个子系统。前置：打怪（combat.js）、锻造·装备（equip.js）、开采/冶炼（mining.js）均已完成。

> 候选 spec，落库文件名建议 `docs/superpowers/specs/2026-09-07-magic-design.md`。2026-09-07 负责人批准：四个待拍板问题（Q1 锭刻符配方进本期 / Q2 mdef→符文保留率 / Q3 caster 魔攻沿用现有 1.1× 列 / Q4 战斗日志法术命中用 ~N）全部按默认取值定案。

## 背景与目标

九项属性里 `matk` / `mdef` 自 combat-core 起就是「只显示、不参与」的死数字：`playerStats` 产出（combat.js:89,91）、装备基线给（equip.js:20-21）、面板显示（farm.js:748-758），全仓库零消费方。饰品槽（extension）的主属性正是 matk/mdef，等于 30 件装备里有 6 件的主属性没用。36 只怪里 6 只 `caster` 机制上与 normal 无差别。

经济上有两个洞：金币一次性 sink 合计仅 418,200，Lv31 每小时能挣 1.5～2.3 万；矿石/锭除锻造只剩「卖掉」一条出路，30 件锻完之后开采/冶炼的产物只能进 `sellall`。

本期把魔法做成**「一把不占槽的武器 + 一种自己刻的弹药 + 一张一次性门票」**，一次回答四件事：

| 洞 | 本 spec 的答案 |
|---|---|
| matk/mdef 是死数字 | 施法 `dmg = matk + 法术威力 − 怪 mdef`；6 只 caster 怪改用 matk 打玩家 mdef |
| 金币 sink 太薄 | 法书 6 本阶梯 0 / 4,000 / 15,000 / 45,000 / 110,000 / 250,000 = **+424,000** 一次性；锭刻符手续费是随施法吞吐线性流出的**经常性** sink |
| 矿石/锭只有「卖」和「炼」 | 刻符：`1 同档矿 + 1 煤 → 20 符` 或 `1 同档锭 + 少量金币 → 80 符`；符文不可卖，只能被施法烧掉 |
| 没有新挂机活动接入互斥 | 刻符是第三个非战斗挂机活动，形状照抄 `state.smelt`，接入开采/冶炼互斥 |

**一眼认出是 Melvor 魔法的三个特征**：法术按等级解锁、每次施法烧符文、没符文就打不出法术；符文是自己造的，原料来自开采；两角克制——魔法克 brute（高 def 低 mdef），caster 抗魔法、怕物理。

### 不做（每条一句为什么）

| 砍掉 | 为什么 |
|---|---|
| Curses / Auroras | `resolveRound` 是无状态的，做 buff 要加状态机；攻击法术一条线已能让 matk 活起来 |
| 每个法术多种符文组合 | 6 档 × 1 种符文与 ORES/BARS 同构，瞥一眼就懂 |
| 法杖 / 新装备槽 | forge spec 约束 30 件 key 永不改、不加槽；法术自带「威力」就是那把法杖 |
| 独立魔法等级 / Mastery | 全局单一等级是硬约束 |
| Alt. Magic（Superheat / Item Alchemy / Just Learning） | Superheat 免煤会抹掉开采 spec 的唯一决策点「挖矿 vs 挖煤」；Alchemy 与「卖」重叠；刻符本身就是「矿石 → 另一种产物」的转化 |
| 符文精华矿脉 | 直接用煤当「通用精华」，反哺煤脉价值，不加 VEINS 行 |
| 符文商店 / 自动补货 | 金币不能绕过 开采 → 刻符 → 施法 这条技能链（Melvor 商店不卖符文）；零输入靠「符文耗尽退回普攻」达成 |
| 符文可出售 / 进 sellall / 进 lock | 一旦可卖，刻符就是「矿石加价出售」，又变 source |
| 副本页风格条 | 法术在魔法页全局单选，副本页只加一句 kb-hint，少一个 UI 面 |
| 怪物三套 evasion | 现有单一 `eva` 对物理与魔法一视同仁 |
| 刻符吃属性（agi/matk 提速） | 刻符永远是短活（见三、2），提速无感；与冶炼 `SMELT_MS` 固定节奏同口径 |
| 统一离线上限按时长（Melvor 24h） | 刻符沿用 `OFFLINE_CAP = 2000` 次（= 67 分钟，与冶炼一致）；只给魔法改口径会让它成为三方互斥里唯一「过夜不亏」的活动。另开 spec |
| 装备升级入口、mats 出路、出图 | 与魔法无关或另开任务 |

## 一、命名与伪装（双套名）

- **游戏名**（`state.real === true`）：中文、奇幻、顺着已有「铜/铁/秘银/精金/陨铁/虚空」六档材质走。法术用元素名，符文叫「X 符」，让玩家一眼把符文和矿档对上。
- **job 黑话**（`state.real === false`）：全 snake_case 小写、无空格，像真实 PostgreSQL / Supabase 概念。整页伪装成 Supabase 控制台 **Database → Functions**（与 content.js:440 子菜单的 Functions 有意呼应）：
  - tab job = `functions`；
  - **法术 = 维护函数**，列头用 pg_proc 真实列名 `proname`（函数名）、`procost`（估算执行成本 = 威力）、`proargtypes`（参数类型 = 消耗的符文）、`proacl`（访问控制 = 法书）；施法 = `invoke`，停用 = `stop`；
  - **法书 = 该函数的 EXECUTE 权限**：买法书 = `grant · N tokens`，已购 = `granted`。这是 `GRANT EXECUTE ON FUNCTION` 的真实语义，比 RLS policy 更贴 Functions 页；
  - **符文 = glyph**（编译产物），刻符 = `compile`，停刻 = `halt`（与冶炼 toast 的 `halted` 同一动词）。job 前缀镜像矿石 `heap_/fsm_/vm_/brin_/tblspc_/void_`，伪装下也能一眼对上矿档。
- **不撞词核对**（对照设计输入「命名空间」）：`functions` / 6 个法术 job / 6 个 `*_glyph` / `proname procost proargtypes proacl` / `grant granted invoke compile` 全部 grep 0 命中。刻意避开：`rune`、`codex`（装备 `cascade_rune`/`void_codex`）→ 用 `glyph`；`trigger`（special 槽）→ tab 不叫 triggers；`autovacuum`、`checkpointer`（动物）→ 法术用命令形 `vacuum_full`/`checkpoint_force`；`policy`（Auth 菜单 Policies）→ 用 ACL；`plv8`（EXTS）不用。
- 伪装下无中文、无 emoji、无图；`spellFace()` / `runeFace()` 返回空串（对齐 `oreFace` / `barFace`）。

## 二、玩法循环

### 1. Melvor 式一句话

**挖矿 → 刻符（挂机，与开采/冶炼互斥）→ 在魔法页选一条法术 → 打怪时每次出手烧 1 枚符文、按 `matk + 威力 − 怪 mdef` 出伤害；符文烧完自动退回普攻，战斗永远不会「停下来」。**

### 2. 决策点（三个）

1. **矿石去哪**：卖 / 炼锭（→ 锻造或卖）/ 刻符。叠在开采 spec「挖矿 vs 挖煤」之上的第二层；刻符也吃煤，煤脉价值上升而非被抹掉。
2. **这场打谁、用不用法术**：brute 与 boss 用法术更快（mdef 低），caster 用普攻更快且掉饰品（`Equip.ROLE_SLOT.caster → accessory`，饰品是唯一 matk 来源）。形成「先物理打 caster 攒饰品 → 再用魔法刷 boss」的自然引导，不需要教程文字。
3. **刻符走矿还是走锭**：矿路线免费、每矿 20 符；锭路线花金币 + 先冶炼、每矿 26.7 符（+33%）。矿脉产量才是真约束，所以这是「花钱买每小时矿多出三分之一的弹药」。

### 3. 零输入挂机检查

- 刻符：选一条配方后自动跑到料尽自停（同 smelt）。
- 施法：选一次法术后永久生效；符文耗尽自动退回普攻并 toast 一次，不打断战斗（Melvor 是打不出法术；本作场景是「看小说时挂着」，中断是最差体验，这是有意偏离）。
- 瞥一眼：魔法页 kb-hint 一句话四态；副本页 kb-hint 多一句 `invoking X · N glyphs left`；战斗日志法术命中用 `~N`。

### 4. 属性接入（stats 由 farm.js 算好传入，magic.js 不 require combat/equip）

| 属性 | 作用 | 来源 |
|---|---|---|
| `matk` | 法术攻击主值 | 等级基线 + 饰品（acc1→acc6：5/11/20/35/55/80） |
| `mdef` | ① 承受 caster 怪魔攻；② 符文保留率 `preserve = min(0.4, mdef × 0.004)`（已定案） | 等级基线 + 防具 + 饰品 |
| `crit` / `luk` / `eva` / `agi` | 法术与近战共用同一套暴击、闪避、先手判定 | 不变 |

mdef 一身二用与 luk（暴击/掉率/双产/掉装）、agi（先手/开采间隔）的既有做法一致。保留率上限 0.4 需要 mdef 100：L31 裸装 54 → 21.6%，+arm6 → 34.4%，+acc6 → 顶满——防具与饰品都有贡献，不让饰品一枝独秀。

### 5. 战斗公式改动（combat.js）

- `attack(attacker, defender, rng)`：若 `attacker.castPower != null`（数值，可为 0）→ **魔法路径** `dmg = max(0, (attacker.matk||0) + attacker.castPower − (defender.mdef||0))`；否则原物理路径 `max(0, atk − def)`。闪避掷、暴击（`crit + luk×0.2`，×1.75）两路共用；返回值新增 `magic: true/false`。`castPower` 未设时行为与现在**逐位相同**，现有 attack 用例一字不改。
- `resolveRound(player, playerHp, mon, monHp, rng)`：签名不变；log 条目透传 `magic`（`{ who, dmg, crit, dodged, magic }`）——farm.js 靠它计数扣符文。
- `monsterStats(key)`：新增 `mdef = round(TIER_BASE.def × ROLE_MULT.mdef)`；caster 角色额外 `matk = atk`（即 `round(base.atk × 1.1)`，不加新倍率）、`castPower: 0`——**caster 从此用魔攻打玩家的 mdef**。其他角色不带 `castPower`，行为不变。
- `settleOffline(battle, level, bonus, now, rng, cast)`：追加可选第 6 参 `cast = { power, runes, preserve } | null`。每回合前 `runes > 0 ? ps.castPower = power : delete ps.castPower`；玩家每次出手（log 有 `who:'p' && magic`，闪避也算——符文已经扔出去了）掷 `rng() >= preserve` 则 `runes--, used++`；返回值新增 `runes: used`。不传 `cast` → `runes = 0`，行为与现在完全一致。
- **零伤安全挂机与 STALL_ROUNDS = 300 天然覆盖魔法路径**：同为减法零下限，打不动 `monHp` 不降 → 300 回合撤离逻辑原样生效。

## 三、数据表

档位门槛 **1 / 5 / 10 / 16 / 23 / 31** 与 `Combat.TIER_BASE.unlock`、`Equip.TIER_UNLOCK`、`Mining.VEINS.unlock` 严格一致（第四处，测试守）。

### 1. 法术 SPELLS（6 条，一档一条，key 永不改）

| key = job | 游戏名 | tier | unlock | power | rune | 法书价（金币） | emoji(real) | 黑话来源 |
|---|---|---|---|---|---|---|---|---|
| `vacuum_full` | 疾风斩 | 1 | 1 | 8 | heap_glyph | **0**（自动拥有） | 🌪️ | `VACUUM FULL` |
| `reindex_concurrently` | 寒霜箭 | 2 | 5 | 15 | fsm_glyph | 4,000 | ❄️ | `REINDEX CONCURRENTLY` |
| `cluster_table` | 裂地刺 | 3 | 10 | 26 | vm_glyph | 15,000 | 🪨 | `CLUSTER <table>` |
| `checkpoint_force` | 烈焰球 | 4 | 16 | 41 | brin_glyph | 45,000 | 🔥 | `CHECKPOINT_FORCE` |
| `drop_cascade` | 雷霆击 | 5 | 23 | 60 | tblspc_glyph | 110,000 | ⚡ | `DROP … CASCADE` |
| `truncate_cascade` | 虚空湮灭 | 6 | 31 | 83 | void_glyph | 250,000 | 🌌 | `TRUNCATE … CASCADE` |

**power 的来历**（不是拍的）：让「同档全套装备、刚到解锁等级」的法术总攻 = 近战总攻。近战总攻 = 裸装 atk + 同档武器 atk + 同档特殊 atk；法术总攻 = 裸装 matk + 同档饰品 matk + power。

| tier | Lv | 裸 atk | 武器 | 特殊 | **近战总攻** | 裸 matk | 饰品 | power | **法术总攻** |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 13 | 6 | 2 | 21 | 8 | 5 | 8 | 21 |
| 2 | 5 | 26 | 13 | 4 | 43 | 17 | 11 | 15 | 43 |
| 3 | 10 | 42 | 24 | 8 | 74 | 28 | 20 | 26 | 74 |
| 4 | 16 | 61 | 42 | 14 | 117 | 41 | 35 | 41 | 117 |
| 5 | 23 | 84 | 66 | 22 | 172 | 57 | 55 | 60 | 172 |
| 6 | 31 | 109 | 96 | 32 | 237 | 74 | 80 | 83 | 237 |

（裸装按 combat.js:83-97；装备按 equip.js `SLOT_BASE × TIER_SCALE`，+0 级。）近战玩家的饰品 matk 与法术玩家的武器 atk 各浪费一份，对称；谁更强只看怪。这张表就是 magic.test.js 的一条断言。

- 每次施法固定烧 **1 枚**对应符文；命中保留率则不扣。
- 法术选择是全局单选 `state.spell`（`null` = 普攻）。
- 法书：等级 + 金币双门槛（与矿脉、锻造一致，避免新手把钱砸进用不了的法术）；T1 恒拥有；不可售、不重复购买。合计 **424,000**，全游戏一次性 sink 418,200 → **842,200**。阶梯对照钓点：4,000 ≈ temp_lake 3,000；15,000 ≈ toast_lake 12,000；45,000 ≈ cold_archive 40,000；110,000 ≈ repl_stream 90,000；250,000 ≈ pitr_abyss 200,000 × 1.25（Lv31 block_void 23,000/时 → 11 小时）。近战永远免费，法书是可选加速而非门票。

### 2. 符文 RUNES（6 种）与刻符配方

| key = job | 游戏名 | tier | unlock | 矿路线（1 次刻符） | 锭路线（1 次刻符）（已定案） | xp/次 | emoji(real) |
|---|---|---|---|---|---|---|---|
| `heap_glyph` | 铜符 | 1 | 1 | heap_ore ×1 + burn_seg ×1 → 20 | heap_bar ×1 + 10 金币 → 80 | 3 | 🧿 |
| `fsm_glyph` | 铁符 | 2 | 5 | fsm_ore ×1 + burn_seg ×1 → 20 | fsm_bar ×1 + 20 金币 → 80 | 7 | 📿 |
| `vm_glyph` | 秘银符 | 3 | 10 | vm_ore ×1 + burn_seg ×1 → 20 | vm_bar ×1 + 30 金币 → 80 | 14 | 🪬 |
| `brin_glyph` | 精金符 | 4 | 16 | brin_ore ×1 + burn_seg ×1 → 20 | brin_bar ×1 + 40 金币 → 80 | 25 | 🔮 |
| `tblspc_glyph` | 陨铁符 | 5 | 23 | tblspc_ore ×1 + burn_seg ×1 → 20 | tblspc_bar ×1 + 50 金币 → 80 | 44 | 🕯️ |
| `void_glyph` | 虚空符 | 6 | 31 | void_ore ×1 + burn_seg ×1 → 20 | void_bar ×1 + 60 金币 → 80 | 75 | 🌑 |

常量：`CRAFT_MS = 2000`（不吃任何属性，同 `SMELT_MS`）、`RUNE_BATCH = { ore: 20, bar: 80 }`、`INSCRIBE_COINS = {1:10, 2:20, 3:30, 4:40, 5:50, 6:60}`、`OFFLINE_CAP = 2000` 次（= 66.7 分钟，与冶炼同口径）、`COAL_KEY = 'burn_seg'`（镜像 `Mining.COAL_KEY`）。`RUNE_XP` 与 `Mining.SMELT_XP` 完全相同（magic.js 自持一份，测试断言相等，不 require mining——同 `Equip.TIER_BAR` 镜像做法）：刻符与冶炼都是 2s/次的二次加工，xp/时相同才不会让玩家为 xp 在两者间摇摆；两条路线每次刻符 xp 相同（锭路线的锭已经在冶炼时给过 xp）。

**为什么每次只吃 1 矿 1 煤**：刻符 1,800 次/时会吃掉 1,800 矿 + 1,800 煤，而 heap_seam 只产 720 矿/时、burn_seam 692 煤/时。所以**刻符永远是短活**（把一上午的矿在十几分钟里刻完），矿石库存才是真约束，符文不会泛滥。

**为什么锭路线是 80 而不是 40**：80 符按矿路线折算的价值（12/24/44/84/164/304 金币）恰与锭售价（10/24/46/88/172/318）持平——「卖锭」与「锭刻符」价值中立，金币手续费就是净 sink；每矿多出 33% 符文是花钱买的。若取 40，每矿只有 13 符，永远被矿路线压制，没人用。

**符文用量与吞吐**：施法 2.5 次/s = 9,000 符/时（仅副本页在前台时；离线 2,000 回合封顶）。

| tier | 矿/时（agi0） | 矿路线符/时 | 够施法 | 锭路线符/时 | 手续费/时 | 够施法 |
|---|---|---|---|---|---|---|
| 1 | 720 | 14,400 | 96 min | 19,200 | 2,400 | 128 min |
| 3 | 486 | 9,720 | 65 min | 12,960 | 4,860 | 86 min |
| 6 | 254 | 5,080 | 34 min | 6,720 | 5,040 | 45 min |

「挖一小时、打半小时到一个半小时」是 Melvor Runecrafting ↔ Magic 的典型比例。

**矿石机会成本**（按矿价折算）：铜符 0.15 金币/符 → 1,350/时；虚空符 3.8/符 → 34,200/时，相当于 block_void 一个多小时的产出——只有当法术带来的击杀提速（对 brute +25%、boss +11%）划得来时玩家才会烧高档符，符合「可选风格」而非「必选升级」。

### 3. 怪物新增列：mdef 与魔攻（combat.js `ROLE_MULT`）

| role | def 倍率（现有） | **mdef 倍率（新）** | 攻击方式 | 对法术 | 每档只数 |
|---|---|---|---|---|---|
| normal | 1.0 | **1.0** | 物理 atk → def | 中立 | 1~2 |
| swift | 0.8 | **0.8** | 物理 | 中立 | 1 |
| brute | 1.2 | **0.5** | 物理 | **弱**（法术 +25%） | 1~2 |
| caster | 0.9 | **1.6** | **魔法 matk → mdef** | **抗**（法术 −22%） | 1（T4 两只） |
| boss | 1.5 | **1.2** | 物理 | 略弱（法术 +11%） | 1 |

派生表 `round(TIER_BASE.def × 倍率)`（括号内为现有 def）：

| tier | normal | swift | brute (def) | caster (def) | boss (def) | caster 魔攻 = atk |
|---|---|---|---|---|---|---|
| 1 | 3 | 2 | 2 (4) | 5 (3) | 4 (5) | 9 |
| 2 | 7 | 6 | 4 (8) | 11 (6) | 8 (11) | 18 |
| 3 | 13 | 10 | 7 (16) | 21 (12) | 16 (20) | 31 |
| 4 | 22 | 18 | 11 (26) | 35 (20) | 26 (33) | 51 |
| 5 | 36 | 29 | 18 (43) | 58 (32) | 43 (54) | 81 |
| 6 | 58 | 46 | 29 (70) | 93 (52) | 70 (87) | 130 |

**Lv31 全套 T6(+0)**（atk 237 / matk 154，power 83）对 T6 各角色每击伤害（未计暴击/闪避）：

| role | def / mdef | 物理 | 魔法 | 差 |
|---|---|---|---|---|
| normal | 58 / 58 | 179 | 179 | 0 |
| swift | 46 / 46 | 191 | 191 | 0 |
| brute | 70 / 29 | 167 | 208 | **+25%** |
| caster | 52 / 93 | 185 | 144 | **−22%** |
| boss | 87 / 70 | 150 | 167 | **+11%** |

Lv1 裸装（atk 13；matk 8 + power 8 = 16）对 T1：normal 物理 10 / 魔法 13；brute 9 / 14；caster 10 / 11；boss 8 / 12——裸装法术略强于裸装普攻，因为法术自带 power 而普攻没有武器，这正是 Lv1 免费法书的新手体验（Melvor Wind Strike）。

**caster 对玩家**（已定案）：caster 魔攻就是它现有的 atk 列（1.1×），只是目标从 def 换成 mdef。

| Lv | 裸装 mdef | 同档全套 mdef（+arm +acc） | 同档 caster 魔攻 | 全套受伤 | 裸装受伤（改前物理） |
|---|---|---|---|---|---|
| 1 | 6 | 11 | 9 | 0 | 3 (2) |
| 5 | 12 | 23 | 18 | 0 | 6 (2) |
| 10 | 20 | 40 | 31 | 0 | 11 (5) |
| 16 | 30 | 65 | 51 | 0 | 21 (12) |
| 23 | 41 | 96 | 81 | 0 | 40 (28) |
| 31 | 54 | 134 | 130 | 0 | 76 (60) |

同档全套一律 0 伤（与现有物理路径同档全套 0 伤一致）；低两档 caster 对裸装也是 0 伤（如 L31 裸 mdef 54 vs T4 caster 51）。「打低 1~2 档零伤怪」玩法不变，只是打 caster 时看的是 mdef 那一栏——这就是 armor / accessory 的 mdef 的用途。裸装对同档 caster 受伤上升是有意的：caster 本来就是各档里最危险的一只。

### 4. tab

| id | job | 游戏名 | 位置 |
|---|---|---|---|
| `magic` | `functions` | 魔法 | TABS 第 10 位（forge 之后、stats 之前），共 11 个；`.ftabs{flex-wrap:wrap}` 会换行，可接受（伪装下像控制台的二级导航） |

### 5. 界面动词（伪装 / 真实）

| 动作 | 伪装 | 真实 |
|---|---|---|
| 选法术 | invoke | 施放 |
| 取消法术（回普攻） | stop | 停用 |
| 买法书 | grant · 4,000 tokens | 购买法书 · 4,000 金币 |
| 已购 | granted | 已拥有 |
| 开始刻符 | compile | 刻符 |
| 停止刻符 | halt | 停止 |
| 法术表列头 | proname · procost · proargtypes · proacl | 法术 · 威力 · 符文 · 法书 |
| 符文表列头 | glyph · stock · from ore · from bar | 符文 · 库存 · 矿路线 · 锭路线 |

## 四、模块边界

`magic.js` 独占「法术表 / 符文表 / 刻符配方 / 施法可行性 / 刻符结算」的全部知识；`combat.js` 只多一条魔法伤害分支与怪侧 mdef；`farm.js` 只做 DOM 与状态。

### 1. 新增 `skins/db-console/magic.js`（UMD，`root.Magic`，头部照抄 mining.js:1-7，可 `node --test`）

```js
// 数据
SPELLS, SPELL_KEYS            // 三、1，SPELL_KEYS 按 tier 升序；SPELLS[k] = {name, job, tier, unlock, power, rune, book, emoji}
RUNES, RUNE_KEYS              // 三、2，RUNES[k] = {name, job, tier, unlock, ore, bar, emoji}
RUNE_XP                       // 镜像 Mining.SMELT_XP
TIER_UNLOCK                   // {1:1, 2:5, 3:10, 4:16, 5:23, 6:31} 镜像
INSCRIBE_COINS, RUNE_BATCH, CRAFT_MS, OFFLINE_CAP, COAL_KEY
PRESERVE_PER_MDEF = 0.004, PRESERVE_CAP = 0.4

// 纯逻辑（level / stats 由 farm.js 算好传入；不读全局 state、不 require 兄弟模块）
spellUnlocked(key, level)                  -> bool
spellOwned(key, books)                     -> bool        // book 价 0 恒 true
bookCheck(key, state, level)               -> { price, owned, levelOk, coinsOk, ok }   // ok = !owned && levelOk && coinsOk
castable(state, level)                     -> { spell, rune, power, ok, reason }       // reason: null | 'none' | 'level' | 'book' | 'runes'
preserveChance(stats)                      -> number      // min(0.4, mdef × 0.004)；stats 缺 mdef 视为 0
craftRecipe(runeKey, src)                  -> { ores:{k:n}, bars:{k:n}, coins:n, out:n, xp:n } | null   // src: 'ore' | 'bar'
craftCheck(runeKey, src, state, level)     -> { recipe, oresOk, barsOk, coinsOk, levelOk, ok }
craftRounds(runeKey, src, state)           -> number      // 还能刻几次，供 kb-hint
settleCraft(craft, state, now)             -> { craft:{rune, src, last}, ticks, ores:{k:-n}, bars:{k:-n}, coins:-n, runes:{k:+n}, xp, stopped }
migrateMagic(s, now)                       -> void
```

`settleCraft` 逐条对齐 `Mining.settleSmelt`（mining.js:129-169）：
- 纯函数，不改入参 `craft` 与 `state`；`while (t + CRAFT_MS <= now && guard < OFFLINE_CAP)`。
- 每轮先查库存（矿 + 煤，或 锭 + 金币），不够 → `stopped = true, craft.rune = null, break`。**金币当作一种库存**：`have.coins` 从 `state.coins` 复制，边算边扣。
- 消耗写成**负增量**（`out.ores[k] -= n`、`out.bars[k] -= n`、`out.coins -= n`），产出正增量（`out.runes[k] += RUNE_BATCH[src]`）；farm.js 一律加法落账，金币走 `earn(co.coins)`（负数下限 0；因结算前已逐轮判够，不会触到下限）。
- 早退路径（rune 非法/未知、src 非法、stopped、guard 顶限）统一 `last = now`；正常挖满或余数不够一格才保留精确 `t`。

### 2. `combat.js` 改动点（≈25 行）

| 位置 | 改动 |
|---|---|
| `ROLE_MULT` combat.js:19-25 | 每行加 `mdef`（normal 1.0 / swift 0.8 / brute 0.5 / caster 1.6 / boss 1.2） |
| `monsterStats` 98-109 | 返回值加 `mdef`；caster 加 `matk: atk`、`castPower: 0` |
| `attack` 113-120 | 分支 `attacker.castPower != null`；返回值加 `magic` |
| `resolveRound` 121-136 | log.push 透传 `magic: a.magic` / `magic: b.magic` |
| `settleOffline` 151-173 | 第 6 参 `cast`，回合前设/删 `ps.castPower`，按玩家出手数掷保留率递减，返回加 `runes` |
| 导出 | 不新增 |

`rollDrops`、`playerStats`、`migrateCombat`、`DEFAULT_WEAPON` 不动。

### 3. `farm.js` 改动点（≈250 行，只 DOM/状态）

| 位置（现行号） | 改动 |
|---|---|
| 4-7 引擎引用 | 加 `var Magic = root.Magic` |
| `TABS` 118-129 | forge 之后插入 `{ id:'magic', job:'functions', name:'魔法' }` |
| `freshState()` 146-168 | 加 `runes:{}, books:{}, spell:null, craft:{ rune:null, src:'ore', last:Date.now() }`；`stats` 加 `casts:0` |
| `load()` 202-208 | 末尾加 `Magic.migrateMagic(state, Date.now())`（**必须在 `Mining.migrateMining` 之后**，裁决依赖 mine/smelt 已修好） |
| 新 `runeFace()` / `spellFace()` | 伪装空串；真身 emoji |
| 新 `magicTab()` | 五、1 布局，kb-hint 四态 |
| `mineTab` kb-hint 839-845 | 二态 → 三态：加「正在刻符 X；选矿脉会停下」 |
| `forgeTab` kb-hint 912-922 | 三态 → 四态：加「正在刻符 X；开炼会停下」 |
| `render()` 1273-1286 冶炼块之后、1287 钓鱼回收之前 | 刻符结算块（下方代码） |
| `render()` 离线战斗 1297-1323 | `var cs = Magic.castable(state, lvl)`，`settleOffline(..., now, undefined, cs.ok ? { power: cs.power, runes: state.runes[cs.rune] || 0, preserve: Magic.preserveChance(ps) } : null)`；结算后 `state.runes[cs.rune] -= bo.runes; state.stats.casts += bo.casts`（bo.casts 计施法次数、被保留率保住的也算，与 battleTick 同口径；bo.runes 是实际扣掉的符文数，只用来扣库存）；离线路径同样维护 `runesOutToasted`——玩家在别的 tab 时战斗走的就是这条路径，耗尽也要 toast 一次 |
| `battleTick` 1035-1079 | 回合前 `cs = Magic.castable(state, lvl)`，`cs.ok → ps.castPower = cs.power`；回合后遍历 `res.log`，每条 `who==='p' && magic` 掷 `Math.random() >= preserve` 则 `state.runes[cs.rune] -= 1`；`state.stats.casts += 1`；扣到 0 时 toast 一次（`castRunesToast` 标志存在 battle 对象上：`b.runesOutToasted = true`，避免每回合重复） |
| `battleView` 954-1000 | 日志行：`l.magic && l.who==='p'` → 真身「你 施放 造成 N」/ 伪装 `job ~N`；`l.magic && l.who==='m'` → 真身「<怪> 法术 造成 N」/ 伪装 `<job> ~N`（`~` 是 PG 正则匹配运算符；物理仍 `-N`）（已定案）。kb-hint 追加 `invoking <job> · N <glyph> left` / `<job> needs <glyph> — plain attacks` / 无法术时不加 |
| `statsTab` 1181-1188 | 加一行 `[state.real ? '施法次数' : 'invocations', state.stats.casts]` |
| `selectVein` 1469-1477 | 加 `state.craft = { rune:null, src:state.craft.src, last:Date.now() };` |
| `startSmelt` 1481-1494 | check 之后加同一行 |
| 新 `selectSpell(key)` | 点已选中 → `state.spell = null`；否则 `spellUnlocked && spellOwned` 后设值 |
| 新 `buyBook(key)` | `Magic.bookCheck(...)` 不 ok 直接 return；`earn(-price)`、`state.books[key] = true` |
| 新 `startCraft(runeKey, src)` | **check 先于 mutation**：`craftCheck` 不 ok 直接 return；然后 `state.craft = { rune, src, last }`、`state.smelt = { bar:null, last }`、`state.mine = Mining.stopVein(state.mine, now)`；toast |
| 新 `stopCraft()` | `state.craft = { rune:null, src:state.craft.src, last }` |
| `onMainClick` 1513-1647 | 在 `[data-smelt]/[data-smeltstop]/[data-forge]` 之后加 `[data-spell]` / `[data-book]` / `[data-craft]`（带 `data-src`）/ `[data-craftstop]` |
| `sellall` 1587-1609 / lock | **不动**（符文不可售不可锁） |

render() 刻符块：

```js
// 刻符挂机结算：与开采、冶炼三方互斥（见 startCraft / selectVein / startSmelt）。
// co.ores / co.bars / co.coins 是负增量（消耗），co.runes 是正增量（产出），与冶炼一样全部用加法落账。
if (state.craft.rune) {
  var co = Magic.settleCraft(state.craft, state, now);
  if (co.ticks > 0) {
    for (var ck in co.ores)  state.ores[ck]  = (state.ores[ck]  || 0) + co.ores[ck];
    for (var cb in co.bars)  state.bars[cb]  = (state.bars[cb]  || 0) + co.bars[cb];
    for (var cr in co.runes) state.runes[cr] = (state.runes[cr] || 0) + co.runes[cr];
    if (co.coins) earn(co.coins);
    state.xp += co.xp;
    dirty = true;
  }
  if (co.stopped) { toast(state.real ? '材料用尽，刻符已停' : 'out of stock — compile halted'); dirty = true; }
  state.craft = co.craft;
}
```

### 4. 互斥与加载裁决（三方：开采 > 冶炼 > 刻符）

| 事件 | `state.mine` | `state.smelt` | `state.craft` |
|---|---|---|---|
| `selectVein` | `Mining.switchVein(...)` | `{bar:null}` 已有 | **`{rune:null}` 新增** |
| `startSmelt` | `Mining.stopVein(...)` 已有 | `{bar:key}` | **`{rune:null}` 新增** |
| `startCraft`（新增） | **`Mining.stopVein(...)`** | **`{bar:null}`** | `{rune:key, src}` |
| 加载 `migrateMining` | 保留 | `vein && bar → bar=null`（现有 282-284） | — |
| 加载 `migrateMagic`（新增） | — | — | **`(mine.vein || smelt.bar) && craft.rune → craft.rune=null`** |

- **绝不裸改 `state.mine.*`**：`startCraft` 里 `state.mine =` 右侧必须是 `Mining.stopVein(...)`，由 mining.test.js 源码断言 ③ 自动覆盖；断言 ② 扩三条（见八、6）；断言 ③ 的 `state.mine =` 下限 3 → 4。
- 刻符没有耐久/pool 一类的记账，`state.craft` 字面量整体替换即可，不需要 `Magic.switchCraft` 包装。
- 战斗不参与互斥（Melvor：战斗独立轨），沿用。

### 5. 三处接线 + 两处测试

| 文件 | 改动 |
|---|---|
| `server.js:64-66 GAME_FILES` | 加 `magic.js` |
| `skins/db-console/index.html:68` 后 | `<script src="magic.js">`（mining 之后、farm 之前） |
| `skins/tracer/index.html:197` 后 | 同上 |
| `test/tracer-skin.test.js:111-128` | 顺序断言加 magic：`fishing → combat → equip → mining → magic → farm → content` |
| `test/server.test.js:188` | 白名单遍历自动覆盖 |

## 五、界面

### 1. 魔法页 `magicTab()`（每秒 innerHTML 全量重绘，data-* 委托，无持久控件）

```
kb-hint（一句话，四态见 2）
[法术表]  proname | lvl | procost | proargtypes(stock) | proacl / action
  6 行：未到级 → 灰字 job + 'lvl N'
        未购法书 → <a data-book>grant · 4,000 tokens</a>（金币不够则 btn-dim disabled）
        已购未选 → granted · <a data-spell>invoke</a>
        当前施放 → 行 class=is-active，按钮变 <a data-spell>stop</a>
[符文表]  glyph | stock | from ore | from bar
  6 行：未到级 → 灰
        from ore 格：'heap_ore ×1 · burn_seg ×1 → 20' + <a data-craft data-src="ore">compile</a>（料不够 disabled）
        from bar 格：'heap_bar ×1 · 10 tokens → 80' + <a data-craft data-src="bar">compile</a>
        正在刻的格：is-active + <a data-craftstop>halt</a> + 'N more'
表头下一行小字：`preserve N%`（真身「符文保留 N%」）——让 mdef 的作用可见
```

不放「普攻」行：点当前施放行的 stop 即回普攻，少一行。

### 2. kb-hint 四态（魔法页）

| 状态 | 伪装 | 真实 |
|---|---|---|
| 正在刻符 | `compiling heap_glyph from ore — stock lasts 37 more, then it halts.` | `正在用矿石刻铜符，材料还够 37 次——用尽自动停。` |
| 开采中 | `mining heap_seam — compiling stops it.` | `正在开采堆表矿脉；刻符会把矿脉停下（同时只能做一件事）。` |
| 冶炼中 | `smelting heap_bar — compiling stops it.` | `正在冶炼铜锭；刻符会把熔炉停下（同时只能做一件事）。` |
| 空闲 | `pick a function to invoke in raids; compile glyphs from ore or bars.` | `选一条法术在副本里施放；用矿石或锭刻符文当弹药。` |

副本页 battleView kb-hint 追加：`invoking vacuum_full · 812 heap_glyph left` / `vacuum_full needs heap_glyph — plain attacks` / 无法术时不加。

## 六、存档迁移

`Magic.migrateMagic(s, now)`，幂等，接在 farm.js:208 `Mining.migrateMining` 之后：

```
runes : 非对象或数组 → {}；未知 key → 删；值非有限数或 <0 → 删；小数 → floor
books : 非对象或数组 → {}；key 不在 SPELLS → 删；值统一 true
spell : 不在 SPELLS → null（等级/法书不在这里判，castable 运行时判）
craft : 非对象或数组 → { rune:null, src:'ore', last:now }
        !('rune' in craft) → null；rune 不在 RUNES → null
        src 不是 'ore' | 'bar' → 'ore'
        last 非 number 或 NaN → now（不用 ||，0 合法）
stats : 非对象 → {}；casts 非 number/NaN → 0
裁决  : (s.mine && s.mine.vein) || (s.smelt && s.smelt.bar) → craft.rune = null
```

老存档无任何魔法字段 → 全默认，行为不退化；`state.battle` 不加字段（施法与否每回合由 `castable` 现算，进行中的旧战斗加载后自然按当前风格继续）。存档 key `dbconsole.farm.v3` 不升版本（只加字段）。`freshState()` 同步加默认。

## 七、伪装与美术

- `state.real === false` 下魔法页只出现：`functions` / `proname procost proargtypes proacl` / `glyph stock` / 6 法术 job / 6 符文 job / `invoke stop grant granted compile halt tokens lvl` / 矿、锭、煤的 job——全英文小写，无中文、无 emoji、无图。
- toast 双套：`开始刻铜符` / `compiling heap_glyph`；`材料用尽，刻符已停` / `out of stock — compile halted`；`符文耗尽，已改为普攻` / `out of glyphs — plain attacks`；`购得法书` / `granted <job>`。
- `spellFace()` / `runeFace()` 伪装返回空串；真身用三、1 / 三、2 的 emoji（法术 🌪️❄️🪨🔥⚡🌌、符文 🧿📿🪬🔮🕯️🌑，避开 MATERIALS / ORES / BARS 已占用的）。**本期不出图**——符文是背包小图标，与材料一致先用 emoji；法术无立绘位置。
- 战斗日志伪装下法术命中 `~N`，物理 `-N`；真身「施放 造成 N」。
- 已知例外沿用：锁 🔒 与本 tab 无关（符文不参与锁定/出售）。

## 八、测试

新建 `test/magic.test.js`（node --test）+ `test/combat.test.js` 追加 + `test/mining.test.js` 源码断言扩展：

1. **门槛一致性**：`Magic.TIER_UNLOCK` 深等于 `Equip.TIER_UNLOCK`，且每档等于 `Combat.TIER_BASE[t].unlock` 与对应 `Mining.VEINS` 的 unlock；`SPELLS[k].unlock === TIER_UNLOCK[tier]`；`RUNES[k].ore` 在 `Mining.ORES` 且 tier 同、`RUNES[k].bar` 在 `Mining.BARS` 且 tier 同；`Magic.COAL_KEY === Mining.COAL_KEY`；`RUNE_XP` deepEqual `Mining.SMELT_XP`；`SPELLS[k].rune` 在 RUNES 且同档。
2. **数值对齐**：对每档 t，`Combat.playerStats(unlockLv, Equip.equipBonus({weapon:wpn_t, special:spc_t})).atk === Combat.playerStats(unlockLv, Equip.equipBonus({accessory:acc_t})).matk + SPELLS[t].power`（三、1 表即测试，三处一改就报红）。
3. **表完整性**：6 法术 6 符文；job 匹配 `/^[a-z][a-z0-9_]*$/`；`name` 含 CJK；法书价严格递增、T1 为 0、合计 424,000；power 递增；`INSCRIBE_COINS` 递增。
4. **跨模块撞词**：Magic 的 SPELLS/RUNES job 与 tab job `functions` 两两不重复，且不与 `Mining.ORES/BARS/VEINS`、`Equip.EQUIP/SLOT_META`、`Combat.MONSTERS/MATERIALS`、`Fishing.SPOTS/FISH` 的任何 job 重复。
5. **combat 公式**（追加，现有用例不改）：`monsterStats` 含 `mdef`，抽查 T6 brute 29 / caster 93 / boss 70；只有 caster 带 `castPower: 0` 与 `matk`；`attack` 有 `castPower` 时 `{matk:20, castPower:5}` vs `{mdef:10}` → 15、对 def 999 / mdef 0 的目标满伤、`max(0,…)` 下限；无 `castPower` 时与旧结果逐位相同；`resolveRound` log 带 `magic`；caster 对玩家走 mdef（def 999 / mdef 0 的玩家被打满伤）；三角断言：Lv31 全套对 T6 brute/boss 魔法 > 物理、对 caster 物理 > 魔法、对 normal 相等（三、3 表数值写死）。
6. **settleOffline cast**：`{power, runes:3, preserve:0}` 打 10 回合 → 前 3 次玩家出手走魔法、之后物理，返回 `runes === 3`；`preserve:1` → `runes === 0` 且全程魔法；`cast = null` 与不传第 6 参结果相同（同 rng 种子）；budget 用尽后续回合按近战（构造 mdef 0 / def 999 的怪：预算内有伤、预算外零伤）。
7. **preserveChance**：mdef 0 → 0；mdef 100 → 0.4；mdef 999 → 0.4；stats 为空对象/undefined 不抛。
8. **castable**：无法术 → `reason 'none'`；等级不够 → `'level'`；无法书 → `'book'`；符文 0 → `'runes'`；全满足 → `ok`。`bookCheck`：已购 → `ok=false, owned=true`；等级/金币各自不足对应 flag 为 false；T1 恒 owned。
9. **craftCheck / craftRecipe**：矿路线矿够煤不够 / 煤够矿不够 / 都够；锭路线锭够金币不够 / 金币够锭不够 / 都够；未知 src → null。
10. **settleCraft**：`ticks = floor(Δt/2000)` 封顶 2000 且 `last === now`；料尽 `stopped=true, rune=null, last=now`；矿路线负增量矿石/煤与正增量符文匹配（`ticks × 20`）；锭路线 bars 负、coins 负（`ticks × INSCRIBE_COINS`）、runes `ticks × 80`；不改入参 `craft` 与 `state`（深比较）；`rune` 损坏 / `src` 非法 → 无操作、`ticks=0`、`last=now`。
11. **迁移**：空对象 → 全默认；损坏（数组/NaN/未知 key/负数符文）→ 清理；`src` 非法 → 'ore'；两次调用深等（幂等）；裁决三组：`{mine.vein + craft.rune}` → craft 清空、`{smelt.bar + craft.rune}` → craft 清空、`{craft.rune 单独}` → 保留。
12. **源码断言**（沿 mining.test.js:716-775 的 `fnBody` 写法）：
    - mining.test.js ② 扩：`fnBody('startCraft')` 含 `Mining.stopVein(` 与 `state.smelt =`；`fnBody('selectVein')`、`fnBody('startSmelt')` 各含 `state.craft =`；`fnBody('startCraft')` 中 `Magic.craftCheck(` 的下标 < `state.craft =` 的下标（check 先于 mutation）。
    - mining.test.js ③：`state.mine =` 计数下限 3 → 4。
    - magic.test.js：`render` 中 `Magic.settleCraft(` 的下标严格位于 `Mining.settleSmelt(` 之后、`Fishing.settleReclaim(` 之前；farm.js 不得出现 `state\.craft\.rune\s*=(?!=)` 裸改（整体替换 `state.craft = {...}` 允许）；`state\.runes\[.*\]\s*[+-]?=` 的命中处 ≤ 3，且全部落在 `fnBody('render')`（2 处）与 `fnBody('battleTick')`（1 处）内——符文只进不出、没有第二个来源。
13. **接线**：tracer-skin.test 顺序 `mining < magic < farm`；server.test 白名单含 `magic.js`。

## 九、验收

1. `node --test test/*.test.js` 全绿（现有 324 条零改语义地通过 + 新增）。
2. 伪装模式下魔法页、副本页新增文案、mine/forge 新 kb-hint 分支、全部 toast 无中文无 emoji（Ctrl+Alt+G 切换对照 + 八、3 自动断言）。
3. 老存档（无 runes/books/spell/craft 字段、进行中战斗、任意 tab）加载不崩，默认普攻、开采/冶炼进行中不被打断；存档里同时有 vein 与 craft.rune 时加载后只剩 vein。
4. 从零走通闭环：Lv1 挂 burn_seam 挖煤 → 切 heap_seam 挖矿（煤脉自动停）→ 魔法页 compile heap_glyph（矿脉自动停）→ 符文到账、矿与煤按量扣、xp 涨 → invoke vacuum_full → 副本打 dead_tuple，日志出现 `~N`、伤害 = 8 + 8 − 3、符文数递减 → 符文归零 toast 一次并继续普攻 → 炼出铜锭后 compile from bar，金币按 10/次扣 → 到 Lv5 grant reindex_concurrently。
5. 三方互斥真实成立：任一时刻 `mine.vein`、`smelt.bar`、`craft.rune` 至多一个非空（人工走一遍 + 源码断言）。
6. 克制可感：Lv31 全套 T6 对 T6 brute 法术比近战少约 20% 回合；对 caster 反过来；对 normal 回合数相同。
7. mdef 可见生效：换上防具/饰品后魔法页 `preserve` 百分比上升；穿同档全套后 caster 打不出伤害。
8. 经济：T6 法书 250,000 ≈ Lv31 单一活动 11 小时；符文机会成本 ≤ 34,200/时、锭路线手续费 ≤ 6,750/时，未压倒任何现有活动的每小时产出（种地 17,500、block_void 23,000、pitr_abyss 17,067）；`stats.earned` 不计法书/手续费支出（earn 负数不计，现有语义）。

## 十、实施任务清单（11 个，估 ≈1,000 行含测试）

| # | 任务 | 文件 | 估行 |
|---|---|---|---|
| 1 | magic.js 常量表（SPELLS/RUNES/RUNE_XP/TIER_UNLOCK/INSCRIBE_COINS/RUNE_BATCH）+ spellUnlocked/spellOwned/bookCheck/castable/preserveChance + 门槛一致性、数值对齐、表完整性、撞词测试 | magic.js, test/magic.test.js | 110 + 130 |
| 2 | magic.js craftRecipe/craftCheck/craftRounds/settleCraft（双路线、金币库存、负增量、早退 last=now）+ 测试 | magic.js, test/magic.test.js | 80 + 120 |
| 3 | magic.js migrateMagic（补字段、损坏清理、三方裁决、幂等）+ 测试三组裁决 | magic.js, test/magic.test.js | 35 + 60 |
| 4 | combat.js ROLE_MULT.mdef、monsterStats、attack 魔法分支、resolveRound 透传 magic、settleOffline cast 参数 + combat.test.js 新用例（三角、cast 递减、preserve、旧行为不变） | combat.js, test/combat.test.js | 25 + 90 |
| 5 | 接线：server.js 白名单、两个 index.html、tracer-skin.test 顺序；farm.js 引用/freshState/load 迁移/TABS/faces/tab 分派 | server.js, 2×index.html, test/tracer-skin.test.js, farm.js | 30 |
| 6 | farm.js magicTab 渲染（kb-hint 四态、法术表、符文表双路线、preserve 小字） | farm.js, farm.css（1～2 条） | 100 |
| 7 | farm.js 动作：selectSpell/buyBook/startCraft/stopCraft + onMainClick 四个 data-* + selectVein/startSmelt 互清 | farm.js | 55 |
| 8 | farm.js render() 刻符结算块（冶炼后、钓鱼前）+ toast | farm.js | 20 |
| 9 | farm.js battleTick/离线战斗接 castable、掷保留率扣符文、耗尽 toast、stats.casts；battleView `~N` 与 kb-hint 一句；statsTab 一行 | farm.js | 50 |
| 10 | mineTab/forgeTab kb-hint 加刻符态；mining.test.js 源码断言扩展（startCraft、check 先于 mutation、≥4 处）；magic.test.js 源码断言（settleCraft 位置、runes 写入站点、craft.rune 裸改） | farm.js, test/mining.test.js, test/magic.test.js | 15 + 70 |
| 11 | 伪装扫描 + 从零走通 + 老存档回归 + 数值复核（三、2/三、3 表）+ spec/plan 落到 docs/superpowers、更新 memory「魔法已完成」 | docs, memory | — |

建议顺序 1→4（纯逻辑先绿）→ 5 → 6→9 → 10 → 11。

## Melvor 对齐备忘

| Melvor | 本作 | 差异理由 |
|---|---|---|
| 攻击风格在战斗页选择、随时切换 | 法术在魔法页全局单选，副本页一句 kb-hint | 少一个 UI 面；摸鱼玩家一次选好不再动 |
| Standard 法术按 Magic 等级免费解锁 | 按全局等级 1/5/10/16/23/31 解锁 + 法书金币购买 | 单一等级硬约束；法书补 sink |
| 每法术消耗特定符文组合 | 每法术 1 枚同档符文 | 表少一维，瞥一眼就懂 |
| 命中用 Magic Attack Bonus vs Magic Evasion；怪有 attackType | `matk + power − mdef`；caster 带 `castPower: 0` 用魔攻 | 同一套减法、共用 eva/crit，少一套数值 |
| 法杖免对应符文 | 无法杖；法术自带 power 当武器 | 30 件装备表不加槽 |
| Rune preservation 被动（装备/祈祷） | mdef → 保留率 | 把死属性接上；防具对法术玩家有意义 |
| Runecrafting 用 Rune Essence（专用矿脉） | 刻符用同档矿 + 煤，或同档锭 + 金币 | 不加矿脉；反哺煤的价值；锭多一条出路 |
| 符文耗尽打不出法术、被动挨打 | 自动退回普攻 | 摸鱼场景不能中断挂机（有意偏离） |
| 商店不卖符文 | 同（无符文商店） | 金币不能绕过技能链 |
| 三角 Melee / Ranged / Magic | 两角：魔法克 brute/boss，caster 抗魔法怕物理 | 无 Ranged |
| Alt. Magic 与非战斗互斥、不与战斗互斥 | 刻符与开采/冶炼互斥、不与战斗互斥 | 同 |
| 离线统一 24h 按时长 | 刻符 2000 次 = 67 分钟，战斗 2000 回合 = 13 分钟 | 与冶炼同口径；统一另开 spec |
