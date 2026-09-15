# 打怪·战斗核心 设计 spec

日期：2026-09-02
所属：键盘农场 RPG 化扩展的**第 2 个子系统**（第 1 个「钓鱼」已完成）。
后续（不在本 spec）：装备 → 锻造 → 开采 → 魔法。本子系统只做**战斗核心 + 属性面板**。

## 1. 目标

- 新增独立「副本」分区：怪物形象卡牌墙，点卡进入 1v1 **挂机自动回合制**战斗。
- 8 项属性面板（攻/魔攻/防/魔防/敏捷/幸运/暴击/闪避）+ 生命，本期属性来自**角色等级**（共用现有 XP/等级）+ 一把默认武器。
- 怪物/boss 按**等级解锁**，做到「种类丰富奇特」（初定 6 档 × 6 只 = 36，含 6 boss）。
- 杀怪掉 XP+金币+**材料**（囤仓库给以后锻造，本期只囤不用）。
- 沿用灵魂：战斗纯墙钟后台跑 + 离线结算；一键 🌱 双套名（游戏名/DB 黑话）。

## 2. 命名与伪装（🌱 双套名）

打怪 = 清理数据库故障。怪 = 各类 DB 异常；boss = 大事故。主角 = 维护进程。
每只怪像鱼一样两套名：奇幻怪名（`real=true`） + 技术黑话 `job`（`real=false`）。
分区名：`副本` / `advisories`。属性、材料同样双套。

## 3. UI

### 3.1 副本分区（卡牌墙）
`TABS` 加 `{ id:'raid', job:'advisories', name:'副本' }`（置于「统计」前或「钓鱼」后）。
- 卡牌网格：每只怪一张卡 = 形象图（游戏模式立绘 `mobs/<key>.webp`，缺图回退 emoji）+ 名字 + 解锁等级 + 掉落预览（材料/金币）。boss 卡有醒目边框。
- 未解锁：灰显 + 「Lv.N」要求，不可点。
- 点已解锁卡 → 进入**对战视图**（替换分区内容）。

### 3.2 对战视图
- 顶部：主角侧（名/HP 条/8 属性简读） vs 怪侧（形象/名/HP 条）。
- 中部：逐回合战斗日志（最近若干行，滚动）。
- 底部：`退出` 按钮（回满血、回到卡牌墙）；显示本轮累计击杀/掉落。
- 伪装模式：不出形象图，只黑话文字；日志用黑话（"resolved deadlock (-N health)")。

## 4. 属性模型

### 4.1 主角属性（本期来源）
`playerStats(level, weapon)`，level = 现有 `levelInfo().lvl`（共用 XP），weapon = 默认武器：
```
hp   = 60 + level*22
atk  = 10 + round(level*3.2) + weapon.atk
matk = 6  + round(level*2.2) + weapon.matk
def  = 5  + round(level*2.1) + weapon.def
mdef = 4  + round(level*1.6)
agi  = 6  + round(level*1.1)
luk  = 4  + round(level*0.5)
crit = min(60, 5 + level*0.25)   // %
eva  = min(50, 3 + level*0.18)   // %
```
默认武器 `DEFAULT_WEAPON = { name:'维护脚本', job:'maint_script', atk:6, matk:0, def:0 }`。
魔攻/魔防本期只显示、暂不参与（无技能，普攻走物理）；魔法子系统落地后启用。

### 4.2 怪物属性（tier + role 派生，数据紧凑好平衡）
`monsterStats(mob)` = `TIER_BASE[mob.tier]` 各项 × `ROLE_MULT[mob.role]`（四舍五入）：

TIER_BASE（tier: 解锁等级 unlock, hp, atk, def, agi）：
| tier | unlock | hp | atk | def | agi |
|---|---|---|---|---|---|
| 1 | 1  | 40   | 8   | 3  | 5  |
| 2 | 5  | 90   | 16  | 7  | 8  |
| 3 | 10 | 180  | 28  | 13 | 12 |
| 4 | 16 | 340  | 46  | 22 | 17 |
| 5 | 23 | 620  | 74  | 36 | 23 |
| 6 | 31 | 1100 | 118 | 58 | 30 |

ROLE_MULT（role: hp, atk, def, agi）：
| role | hp | atk | def | agi |
|---|---|---|---|---|
| normal | 1.0 | 1.0 | 1.0 | 1.0 |
| swift  | 0.7 | 0.9 | 0.8 | 1.6 |
| brute  | 1.6 | 1.25 | 1.2 | 0.6 |
| caster | 0.85 | 1.1 | 0.9 | 1.1 |
| boss   | 4.0 | 1.6 | 1.5 | 1.1 |

怪的 crit/eva 简化为固定小值（crit 4%、eva 3%；boss crit 8%、eva 5%），不进 role 表。

## 5. 战斗规则（自动回合制）

- **出手顺序**：每回合 AGI 高者先手；两边各出手一次；AGI 相等主角先。
- **命中/伤害**（物理普攻）：
  - 闪避：防守方按 `eva%` 掷骰，命中则本次伤害 0（日志 "miss/dodged"）。
  - 伤害 `dmg = max(0, atk - def)`。
  - 暴击：攻击方按 `crit%`（+ `luk*0.2%`）掷骰，暴击则 `dmg = round(dmg*1.75)`。
  - **纯减法 + 0 下限是核心可玩性**：你打远低于等级的怪，其 `atk - 你def ≤ 0` → 你每回合掉 0 血 → 安全无限挂机；打接近/高于等级的怪才真掉血。
- **僵局保护**：若某方 atk ≤ 对方 def（打不动），battle 每 300 回合无人倒下则判为"打不过"，强制退出（不结算）。正常等级区间不会触发。
- **击杀**：怪 HP≤0 → 掉落入账（见 §6），**同种怪立刻满血重生**，主角 HP **不回**（跨杀累积）。
- **战死**：主角 HP≤0 → 自动退出、回满血、回卡牌墙。**几乎无惩罚**（不扣金币/经验，仅结束本轮）。
- **主动退出**：回满血、回卡牌墙。
- **节奏**：对战视图挂载时开一个 `BATTLE_TICK_MS = 400ms` 定时器，每 tick 结算一回合并刷新血条/日志；退出/战死清除。

## 6. 掉落

每击杀一只 `rollDrops(mob, luk, rng)`：
- **XP**：`DROP_XP[tier]`（喂共用等级），boss ×5。
- **金币**：`DROP_COIN[tier]` 上下浮动 ±20%，boss ×6。
- **材料**：按 `mob.mat` 掉 1 个（boss 掉 2–3 个 + 额外 core 类），基础掉率 60%，`luk` 每点 +0.3%。材料进 `state.mats`（新的共享材料袋，锻造子系统再消费；本期只囤）。

DROP_XP / DROP_COIN 按 tier：
| tier | xp | coin |
|---|---|---|
| 1 | 3   | 8   |
| 2 | 7   | 20  |
| 3 | 14  | 48  |
| 4 | 26  | 110 |
| 5 | 46  | 240 |
| 6 | 78  | 520 |

材料类型 `MATERIALS`（游戏名/`job`，6 种；给锻造留口）：
页料/`page_scrap`、锁齿/`lock_fang`、熵尘/`entropy_dust`、索晶/`index_shard`、日志核/`wal_core`、事务魂/`txn_soul`。

## 7. 怪物全表（36：6 档 × 5 小怪 + 1 boss）

字段：`key`（存档键，永不改）｜游戏名｜`job` 黑话｜role｜mat。tier 见分组，stats 由 §4.2 派生。

### 档 1（Lv1）
| key | 名 | job | role | mat |
|---|---|---|---|---|
| deadlock | 死锁蛛 | `deadlock` | swift | lock_fang |
| dead_tuple | 僵尸元组 | `dead_tuple` | normal | entropy_dust |
| table_bloat | 膨胀史莱姆 | `table_bloat` | brute | page_scrap |
| slow_query | 慢查询幽魂 | `slow_query` | caster | index_shard |
| cache_miss | 缓存食客 | `cache_miss` | normal | page_scrap |
| lock_lord | 锁之领主 | `lock_contention` | boss | lock_fang |

### 档 2（Lv5）
| key | 名 | job | role | mat |
|---|---|---|---|---|
| torn_page | 碎页蝠 | `torn_page` | swift | page_scrap |
| disk_spill | 溢出巨蟾 | `disk_spill` | brute | entropy_dust |
| bloat_swarm | 死元组群 | `bloat_swarm` | normal | entropy_dust |
| index_rot | 索引蛀虫 | `index_rot` | normal | index_shard |
| stale_stats | 统计妖 | `stale_stats` | caster | index_shard |
| vacuum_storm | 真空吞噬者 | `autovacuum_storm` | boss | wal_core |

### 档 3（Lv10）
| key | 名 | job | role | mat |
|---|---|---|---|---|
| repl_lag | 复制延迟鬼 | `repl_lag` | caster | wal_core |
| conn_leak | 连接泄漏体 | `conn_leak` | normal | lock_fang |
| wal_flood | WAL 洪流兽 | `wal_flood` | brute | wal_core |
| phantom_read | 幻读魅影 | `phantom_read` | swift | txn_soul |
| checkpoint_spike | 检查点巨像 | `checkpoint_spike` | brute | page_scrap |
| long_txn | 长事务之影 | `long_txn` | boss | txn_soul |

### 档 4（Lv16）
| key | 名 | job | role | mat |
|---|---|---|---|---|
| dirty_pages | 脏页风暴 | `dirty_pages` | caster | page_scrap |
| disk_full | 磁盘饕餮 | `disk_full` | brute | entropy_dust |
| race_condition | 竞态双子 | `race_condition` | swift | lock_fang |
| entropy_creep | 熵增之蚀 | `entropy_creep` | normal | entropy_dust |
| freeze_ghost | 冻结幽灵 | `freeze_ghost` | caster | txn_soul |
| crash_recovery | 崩溃恢复魔 | `crash_recovery` | boss | wal_core |

### 档 5（Lv23）
| key | 名 | job | role | mat |
|---|---|---|---|---|
| partition_rift | 分区裂隙 | `partition_rift` | swift | index_shard |
| checksum_error | 校验和恶鬼 | `checksum_error` | normal | index_shard |
| oom_killer | 内存吞噬兽 | `oom_killer` | brute | entropy_dust |
| dead_letter | 死信使者 | `dead_letter` | caster | txn_soul |
| logical_corrupt | 逻辑损毁体 | `logical_corrupt` | normal | wal_core |
| split_brain | 主从断裂君 | `split_brain` | boss | txn_soul |

### 档 6（Lv31）
| key | 名 | job | role | mat |
|---|---|---|---|---|
| page_corruption | 页损坏巨兽 | `page_corruption` | brute | page_scrap |
| infinite_bloat | 无尽膨胀神 | `infinite_bloat` | brute | entropy_dust |
| clock_skew | 时序错乱者 | `clock_skew` | swift | index_shard |
| silent_dataloss | 静默丢数魔 | `silent_dataloss` | caster | wal_core |
| storage_void | 存储湮灭 | `storage_void` | normal | txn_soul |
| xid_wraparound | 湮灭之王·XID回卷 | `xid_wraparound` | boss | txn_soul |

## 8. 离线结算

只有**离开页面时正处于对战中**（`state.battle` 存着当前怪与主角当前 HP）才结算。`settleOffline(state, now)`：按墙钟 `elapsed` / `BATTLE_TICK_MS` 折算应打回合数（封顶 `OFFLINE_CAP` 回合），逐回合模拟：
- 累计击杀 → 掉落入账（XP/金币/材料）。
- 主角掉血；若某次战死 → 停在"战死"态（HP=0，标记 `dead`），剩余时间作废，等玩家回来点任意键复活（回满血、留在卡牌墙）。
- 安全怪（0 伤害）→ 一路刷到 cap，纯离线收成。
封顶防止长期离线一次结算爆炸。

## 9. 数据模型

### 9.1 模块 `skins/db-console/combat.js`（UMD，仿 conceal-policy/fishing）
纯数据：`TIER_BASE`、`ROLE_MULT`、`MONSTERS`、`MON_KEYS`、`MATERIALS`、`DEFAULT_WEAPON`、`DROP_XP`、`DROP_COIN`、`BATTLE_TICK_MS`、`OFFLINE_CAP`。
纯逻辑（全部可单测，注入 rng）：
- `playerStats(level, weapon)` → 属性对象
- `monsterStats(mobKey)` → 属性对象（含 level=unlock、role 派生）
- `monsterUnlocked(mobKey, level)` → bool
- `attack(attacker, defender, rng)` → `{ dmg, crit, dodged }`（纯）
- `resolveRound(atkStats, defHp, monStats, playerHp, rng)` → `{ playerHp, monHp, log:[...], playerDead, monDead }`（一回合双方各出手）
- `rollDrops(mobKey, luk, rng)` → `{ xp, coins, mats:{key:qty} }`
- `settleOffline(battle, playerLevel, weapon, now, rng)` → `{ kills, xp, coins, mats, hp, dead, last }`

### 9.2 存档新增字段（farm v3，load 补默认，不清档）
- `state.mats`：共享材料袋 `{ matKey: count }`。
- `state.battle`：`null` 或 `{ mob, hp, kills, mats, coins, xp, last }`（当前对战；hp=主角当前血）。
- `state.mobDex`：`{ mobKey: killCount }`（图鉴/统计）。
（属性不存，每次由 level 现算。）

## 10. 迁移 / 兼容

- `migrateCombat(state, now)`：补 `mats/battle/mobDex` 默认（空对象/null）。旧存档无影响。
- 共用现有 XP/等级（`state.xp` / `levelInfo`）——打怪给的 XP 走同一条，会一并解锁作物/按键，属预期（统一成长）。
- 不动 farm-data.js，不动钓鱼。

## 11. 美术资源

- **怪物形象卡** `skins/db-console/mobs/<key>.webp` ×36（含 boss）。风格同鱼：扁平矢量、暗调、透明底；怪物做**正面半身/威慑立绘**（区别于鱼的侧面）。缺图回退 emoji。
- **主角立绘** `skins/db-console/hero.webp` ×1（对战里你这边）。
- **对战背景** `skins/db-console/arena.webp` ×1（暗色机房/竞技场；缺图用渐变占位）。
出图 prompt 待 spec 通过后另出（同鱼/塘流程，AI 生成 + ffmpeg 降采样接入）。

## 12. UI 挂载与节奏

- 副本卡牌墙、对战视图都在 farm.js `render()` 的 tab 分派里（`raid` → `raidTab()` / `battleView()`）。
- `state.battle` 存在时渲染对战视图，否则卡牌墙。
- 对战视图挂载时启 `BATTLE_TICK_MS` 定时器逐回合推进；`render()` 每秒仍在跑（结算离线、刷新非战斗 UI）。避免每秒整屏重绘打断战斗定时器——战斗定时器独立于 render 定时器。

## 13. 范围之外（本期不做）

装备槽/穿脱、锻造消费材料、开采、魔法/技能（魔攻魔防暂只显示不生效）、多敌同屏/群战（本期严格 1v1）。材料只囤不消费。

## 14. 测试要点（combat.js 纯逻辑）

- `playerStats`/`monsterStats` 随等级/tier/role 正确派生（抽样断言）。
- `attack`：注入 rng 命中暴击/闪避分支；`dmg = max(0, atk-def)`；暴击 ×1.75。
- 过等级碾压：高 def 主角 vs 低 tier 怪，`resolveRound` 后主角 HP 不变（0 伤害），怪掉血 → 可安全刷。
- 势均力敌：双方都真掉血，能分出胜负。
- 僵局：atk≤def 双方 300 回合判定退出。
- `rollDrops`：掉率随 luk 上升；boss 掉更多 + core 类材料。
- `settleOffline`：安全怪跑满 cap 且不死；危险怪打到战死即停、剩余作废、标 dead。
- `migrateCombat`：旧档补齐 mats/battle/mobDex，不丢旧数据。
