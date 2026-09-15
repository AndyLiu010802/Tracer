# 开采 Mining 子系统设计

日期：2026-09-04
皮肤：`skins/db-console/`（键盘农场，伪装成 Supabase 控制台）
标杆：Melvor Idle（Mining + Smithing 的 smelt 环节）

## 背景与目标

锻造·装备（`equip.js`）代码层已完成，但 `Equip.recipeCheck()` 里的 `oreOk` 依赖
`state.oreCount`，而该字段无任何产出来源、恒为 0，导致全部 30 件装备配方恒锁、
`forgeTab()` 的锻造按钮全部 `disabled`。装备目前只能靠打怪掉落。

本期做开采，填掉这个洞，让「打怪 → 装备 → 挖得更快 → 冶炼 → 锻更好的装备」闭环真正转起来。

## 一、玩法循环

Melvor 式挂机矿脉：

1. 玩家在「开采」tab 选一条矿脉
2. 每 `tickMs` 自动产 1 矿，同时给全局 xp
3. 矿脉耐久 `hp` 每产一次减 1，归零后进入再生 CD（`respawnMs`）
4. CD 结束自动恢复满耐久，继续挖，无需玩家干预
5. 同一时刻只能挂一条矿脉（含煤脉）

**唯一的决策点**：煤脉与矿脉互斥。冶炼必须烧煤，所以玩家要在「这段时间要矿还是要煤」
之间分配挂机时间。没有这一层，开采就退化成「选最高档矿脉挂着」而无任何选择。

**装备属性接入**（复用现有 5 槽装备，不加新槽、不动 `Equip.SLOTS` 与 30 件表）：

- 挖矿间隔：`tickMs × (1 - min(0.5, agi × 0.005))`，即 agi 100 点封顶减半
- 双产几率：`min(0.5, luk × 0.004)`，命中则该次产 2 个（与 `combat.js` 里 luk 影响
  掉落的用法一致）

这里的 `agi` / `luk` 取**完整角色属性**，即 `Combat.playerStats(level,
Equip.equipBonus(state.equipped))` 的结果 —— 与战斗用的是同一个数，等级成长与装备
加成都算进去。`mining.js` 不自己算属性，由 `farm.js` 把算好的 `stats` 传进来，
所以 `mining.js` 无需依赖 `combat.js` / `equip.js`。

## 二、数据表

矿脉档位与 `Combat.TIER_BASE` 的 `unlock`、`Equip.TIER_UNLOCK` 严格对齐
（1 / 5 / 10 / 16 / 23 / 31），三个子系统的档位门槛必须永远同步。

双套名沿用现有惯例：`name` 为游戏名（真实模式），`job` 为数据库黑话（伪装模式）。
矿脉选存储层黑话，与钓点（WAL / TOAST / PITR）、怪物（锁、膨胀、XID 回卷）不撞词。

### 矿脉 VEINS

| key | 游戏名 | job | tier | unlock | 产出 | tickMs | hp | respawnMs | xp |
|---|---|---|---|---|---|---|---|---|---|
| `heap_seam` | 堆表矿脉 | `heap_seam` | 1 | 1 | `heap_ore` | 3000 | 10 | 20000 | 2 |
| `fsm_seam` | 空闲空间图 | `fsm_seam` | 2 | 5 | `fsm_ore` | 3600 | 12 | 30000 | 5 |
| `vm_seam` | 可见性图 | `vm_seam` | 3 | 10 | `vm_ore` | 4200 | 14 | 45000 | 10 |
| `brin_seam` | BRIN 块区 | `brin_seam` | 4 | 16 | `brin_ore` | 5000 | 16 | 70000 | 18 |
| `tblspc_deep` | 表空间深层 | `tblspc_deep` | 5 | 23 | `tblspc_ore` | 6000 | 18 | 100000 | 32 |
| `block_void` | 数据块虚空 | `block_void` | 6 | 31 | `void_ore` | 7200 | 20 | 140000 | 55 |
| `burn_seam` | 燃料层 | `burn_seam` | 0 | 1 | `burn_seg` | 3200 | 12 | 24000 | 2 |

煤脉 `tier: 0`，开局即解锁 —— 否则新玩家有矿无煤、炼不出第一块锭。

### 矿石 ORES

| key | 游戏名 | job | tier | emoji |
|---|---|---|---|---|
| `heap_ore` | 铜矿 | `heap_ore` | 1 | 🟠 |
| `fsm_ore` | 铁矿 | `fsm_ore` | 2 | 🔩 |
| `vm_ore` | 秘银矿 | `vm_ore` | 3 | 💠 |
| `brin_ore` | 精金矿 | `brin_ore` | 4 | 🟣 |
| `tblspc_ore` | 陨铁矿 | `tblspc_ore` | 5 | 🪨 |
| `void_ore` | 虚空矿 | `void_ore` | 6 | 🕳️ |
| `burn_seg` | 煤 | `burn_seg` | 0 | ⬛ |

`COAL_KEY = 'burn_seg'`，导出为常量，冶炼与 UI 都引用它而非硬编码字符串。

emoji 避开 `Combat.MATERIALS` 已占用的 🧱 ✨ 🔷 💿 👻 🦷。

### 锭 BARS

| key | 游戏名 | job | tier | emoji |
|---|---|---|---|---|
| `heap_bar` | 铜锭 | `heap_bar` | 1 | 🟧 |
| `fsm_bar` | 铁锭 | `fsm_bar` | 2 | ⬜ |
| `vm_bar` | 秘银锭 | `vm_bar` | 3 | 🟦 |
| `brin_bar` | 精金锭 | `brin_bar` | 4 | 🟪 |
| `tblspc_bar` | 陨铁锭 | `tblspc_bar` | 5 | 🟨 |
| `void_bar` | 虚空锭 | `void_bar` | 6 | 🟥 |

### 冶炼配方

统一公式，不逐条写死（所以模块只导出 xp 表 `SMELT_XP`，配方由 `smeltRecipe()` 派生）：

```
1 个 tier T 的锭 = 同档矿 × 3 + 煤 × T
冶炼 xp：{1:3, 2:7, 3:14, 4:25, 5:44, 6:75}
```

冶炼是瞬时动作（点一下炼一个），不挂机 —— 挂机时间已经全部给了矿脉，
再让熔炉抢占挂机位会让两者互相饿死。

## 三、模块边界

`mining.js` 独占「矿石 → 煤 → 锭」的全部知识；`equip.js` 只消费 `state.bars`，
不需要知道锭从哪来。UI 位置（熔炉画在锻造 tab）不影响模块归属。

### 新增 `skins/db-console/mining.js`（UMD，可 node --test）

```js
// 数据
ORES, BARS, VEINS, VEIN_KEYS, COAL_KEY, SMELT_XP, OFFLINE_CAP
// 纯逻辑（stats = Combat.playerStats(...) 的结果，由调用方算好传入）
veinUnlocked(veinKey, level) -> bool
tickMs(veinKey, stats) -> number           // 吃 stats.agi
yieldPer(stats, rng) -> 1 | 2              // 吃 stats.luk
smeltRecipe(barKey) -> { ores: {k:n}, coal: n, xp: n } | null
smeltCheck(barKey, state) -> { recipe, oresOk, coalOk, ok }
settleMining(mine, stats, now, rng) -> { ores: {k:n}, xp, ticks, mine }
migrateMining(s, now)
```

`settleMining` 是纯函数，完整模拟「挖满耐久 → 进 CD → 再生 → 继续挖」的循环，
带 `OFFLINE_CAP = 2000` 次上限（对齐 `Combat.OFFLINE_CAP` 的做法）。
返回新的 `mine` 状态与本次结算的增量，由 `farm.js` 落到 `state` 上。

### 修改 `skins/db-console/equip.js`

- `recipe(key)` 的 `ore: 1 + tier`（数字）改为 `bars: { <该档锭key>: 1 + tier }`，
  与 `mats` 同形。数量不变（T1 要 2 锭，T6 要 7 锭），语义从「矿石」变为「同档锭」
- `recipeCheck()` 的 `oreOk` 改为 `barsOk`，`ok` 的合取项同步替换
- `migrateEquip()` 里的 `oreCount` 兜底移交给 `migrateMining()`

档位 → 锭 key 的映射表 `TIER_BAR` 写在 `equip.js` 内（与已有的 `TIER_MAT` 并列），
避免 `equip.js` 反向 require `mining.js`；两边靠 key 字符串对齐，测试覆盖一致性。

### 修改 `skins/db-console/farm.js`

只做 DOM 与状态，不含数值逻辑：

- `TABS` 新增 `{ id: 'mine', job: 'storage', name: '开采' }`，插在 `raid` 与 `inv` 之间
- `mineTab()`：矿脉列表（名 / 档 / 间隔 / 耐久 / 状态 / 选中态）、当前矿脉进度条、
  矿石库存表
- `forgeTab()` 上半部新增熔炉区：6 条锭配方 + 冶炼按钮；下半部现有配方表的
  「矿石×n（待开采）」占位换成真实锭需求，按钮按 `barsOk` 解禁
- 每秒 render tick 里调 `settleMining` 并消费返回值（不新开定时器 —— 开采是分钟级
  节奏，不需要战斗那种 400ms 独立定时器）
- `freshState()` 与 `load()` 接上 `Mining.migrateMining(state, Date.now())`
- `index.html` 引入 `mining.js`

## 四、存档迁移

`migrateMining(s, now)`：

- 补 `s.ores = {}`、`s.bars = {}`
- 补 `s.mine = { vein: null, last: now, hp: 0, until: 0 }`
- 补 `s.stats.mined = 0`（`state.stats` 是存档里的累计统计对象，与上文表示角色属性的
  `stats` 是两回事，实现时注意别在同一作用域里同名）
- 老存档的 `s.oreCount > 0` 时，转成等量 `heap_ore` 后置 0（该字段此后不再被读写）
- 必须幂等：重复调用不重复转换、不重置进行中的挖矿

## 五、伪装与美术

- 伪装模式（`state.real === false`）下矿脉、矿石、锭全部走 `job` 黑话，不出中文
- 本期矿石/锭只用 emoji 兜底，**不出图** —— 与 `Combat.MATERIALS` 的做法一致
- 矿石立绘留给后续单独的 art prompts 任务（走 AI webp → ffmpeg 降采样 →
  `skins/db-console/mats/` 管线），本期不做

## 六、测试

新建 `test/mining.test.js`（node --test）：

- 矿脉解锁门槛与 `Combat.TIER_BASE` / `Equip.TIER_UNLOCK` 三方一致
- `tickMs` 吃 agi：0 加成为基线值，agi 100 减半，agi 999 仍不低于半（上限生效）
- `yieldPer` 吃 luk：注入确定性 rng 验证边界（luk 0 恒 1，luk 125+ 上限 0.5）
- `settleMining` 耐久-再生循环：连续挖空进 CD、CD 内不产出、CD 结束恢复满耐久
- `settleMining` 离线上限：超长离线被 `OFFLINE_CAP` 截断，不死循环
- `settleMining` 容错：`mine.vein` 为未知 key 时优雅无操作（对齐 `settleOffline`
  对损坏 `battle.mob` 的处理），不让每秒 render 崩掉
- `smeltCheck`：矿够煤不够 / 煤够矿不够 / 都够 三种情形
- `migrateMining` 幂等 + `oreCount` 转换

改 `test/equip.test.js`：4 处 `oreOk` / `oreCount` 断言改为 `barsOk` / `bars`；
新增一条「`TIER_BAR` 的 6 个 key 与 `Mining.BARS` 完全一致」的跨模块一致性断言。

## 七、验收

- 全量测试绿（现有 181 条 + 新增）
- 伪装模式下开采 tab 无中文泄漏
- 老存档（含 `oreCount > 0`）加载不崩，矿石正确转换
- 从零开始：挂煤脉 + 铜矿脉 → 炼出铜锭 → 锻出 T1 装备，全流程可走通
