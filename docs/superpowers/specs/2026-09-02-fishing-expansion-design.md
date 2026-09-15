# 钓鱼系统扩充 · 设计 spec

日期：2026-09-02
所属：键盘农场（`skins/db-console/farm.js`）四大扩展中的**第一个子系统**。
后续子系统（不在本 spec 范围）：武器锻造 → 魔法 → 打怪。

## 1. 目标

- 把现有 8 种鱼扩到**几十种、跨 6 个钓点、5 档稀有度**，做到「种类超级丰富奇特」。
- 每条鱼是将来「武器锻造」的材料来源（现在只埋标签，不做分解机制）。
- 全程沿用游戏的灵魂：**输入驱动**（点击捞鱼）+ 一键 🌱 伪装切换。
- 新增**自动回收器**：按墙钟被动出鱼、支持离线结算。
- 鱼有 **AI 生成的统一风格立绘**（游戏模式显示；伪装模式仍是纯文字黑话）。出图 prompt 见 `2026-09-02-fish-art-prompts.md`。

## 2. 命名与伪装原则（关键）

每样东西两套名字，一键 🌱 切换（现有 `state.real`）：

- **游戏名（`real=true`）**：自然、好听、有奇幻感；越稀有越像神话生物。低档就是寻常鱼（鳗鱼、鲫鱼），高档是幻想生物（幽灵行者、湮灭巨鲸）。**绝不用技术黑话当游戏名。**
- **伪装名 `job`（`real=false`）**：数据库/存储技术黑话（`ghost_xact`、`xid_wraparound`）。瞥一眼像在做存储回收运维。

钓鱼整体伪装 = **从各层存储回收被丢弃的数据残片**。鱼 = WAL 段 / 临时文件 / TOAST 块 / 膨胀页 / 幽灵事务……

## 3. 玩法机制

### 3.1 钓点（丰富度主放大器）
6 个钓点，逐级用金币解锁（首个随建鱼塘免费开放）。每个钓点自带鱼池与稀有度分布，越深越贵、越出奇物。你**同时只在一个「当前钓点」**捞鱼，切换即改当前钓点。

| # | 游戏名 | job（伪装） | 解锁 | 单次点击成本 | 自动回收间隔 |
|---|---|---|---|---|---|
| 1 | WAL 缓冲区 | `wal_buffer` | 建鱼塘即开（免费） | 60 | 90s |
| 2 | 临时文件湖 | `temp_lake` | 3,000 | 75 | 110s |
| 3 | TOAST 深湖 | `toast_lake` | 12,000 | 95 | 140s |
| 4 | 冷备份归档 | `cold_archive` | 40,000 | 120 | 180s |
| 5 | 复制流（活水） | `repl_stream` | 90,000 | 150 | 220s |
| 6 | PITR 深渊 | `pitr_abyss` | 200,000 | 200 | 300s |

「单次点击成本」= 累积多少次点击捞一条（猫的「回收速度 +50%」把它按 /1.5）。

### 3.2 点击捞鱼模型
- 维持 `state.clicks` 全局计数；新增 `state.fishProgress`（朝下一条累积的点击数）。
- 每次点击：`fishProgress++`；`fishProgress >= 当前钓点.clickCost` 时，在当前钓点按稀有度权重掷一条鱼，`fishProgress` 归零。
- 取代旧的 `state.clicks % FISH_CLICKS === 0` 定值取模（点击成本随钓点变，取模会错）。
- 桌面版全局点击（窗口失焦时）照样喂进来（沿用现有 `external('click')`）。

### 3.3 稀有度 5 档
| 档 | 游戏名 | 池内权重 | 售价带 | 图鉴表现 |
|---|---|---|---|---|
| 常见 | common | 1000 | 25–50 | 无光 |
| 少见 | uncommon | 350 | 60–120 | 微亮 |
| 稀有 | rare | 90 | 150–340 | 柔和边光 |
| 史诗 | epic | 20 | 500–1300 | 光环+微粒 |
| 传说 | legendary | 3 | 2500–9000 | 神话流光 |

传说鱼仅深钓点专属，给后期挂机留坑。

### 3.4 自动回收器（离线/挂机被动产出）
- 一次性购置 `state.autoReclaim`（金币约 30,000）。购置后在**当前钓点**按该点 `reclaimMs` 被动出一条鱼。
- 离线结算：与作物「下雨」同构——按墙钟差 `now - lastReclaim` 折算补出，`state.lastReclaim` 记账，单次结算封顶（如 24h 对应条数）防溢出。
- 猫的「回收速度 +50%」同样加速 `reclaimMs`（/1.5）。
- 关网页/桌面缩托盘过一夜，回来照样有收成。

### 3.5 材料标签（给锻造留的钩子）
每条鱼带 `mat` 字段（材料类型），本 spec **只写入标签、不实现分解**。锻造子系统落地后再消费。材料类型（伪装名）：

| 材料游戏名 | job | 主要来源 |
|---|---|---|
| 段料 | `seg_scrap` | WAL/段类鱼 |
| 晶体 | `idx_crystal` | 结构/校验类鱼 |
| 精华 | `wal_essence` | 活水/复制流鱼 |
| 甲壳 | `toast_shell` | TOAST/大对象鱼 |
| 尘 | `bloat_dust` | 膨胀/僵尸类鱼 |
| 核心 | `ckpt_core` | 史诗/传说鱼 |

## 4. 全鱼表（48 种，8×6）

字段：`key`（存档内部键，永不改）｜游戏名｜`job` 伪装名｜稀有度｜售价｜`mat`｜emoji 兜底。
标 **【旧】** 的是现有 8 种鱼，键、job 保持不变（熊解锁靠 101 鳗鱼、旧存档鱼数不能丢）。

### 钓点 1 · WAL 缓冲区
| key | 游戏名 | job | 稀有度 | 售价 | mat | emoji |
|---|---|---|---|---|---|---|
| eel | 鳗鱼 **【旧】** | `wal_seg` | 常见 | 30 | 段料 | 🍄 |
| husk | 腐骸鱼 | `dead_tuple` | 常见 | 28 | 尘 | 🐟 |
| chip | 碎屑鳉 | `spill_sort` | 常见 | 26 | 尘 | 🐟 |
| silverdace | 银鲦 | `bgwriter_flush` | 常见 | 34 | 段料 | 🐟 |
| crackcarp | 裂纹鲤 | `checksum_fail` | 少见 | 70 | 晶体 | 🐠 |
| courier | 信使鳗 | `logical_msg` | 少见 | 95 | 精华 | 🐍 |
| lampfish | 灯花鱼 | `notify_signal` | 少见 | 80 | 精华 | 🐟 |
| lurker | 幽灯鮟鱇 | `lock_wait` | 稀有 | 180 | 晶体 | 🎏 |

### 钓点 2 · 临时文件湖
| key | 游戏名 | job | 稀有度 | 售价 | mat | emoji |
|---|---|---|---|---|---|---|
| carp | 鲫鱼 **【旧】** | `temp_file` | 常见 | 45 | 尘 | 🐟 |
| koi | 锦鲤 **【旧】** | `orphan_seg` | 少见 | 90 | 段料 | 🐠 |
| loach | 泥鳅 | `sort_spill` | 常见 | 40 | 尘 | 🐟 |
| overflowcat | 溢流鲶 | `hash_spill` | 常见 | 48 | 尘 | 🐟 |
| glassfish | 玻璃鱼 | `temp_relation` | 少见 | 85 | 晶体 | 🐟 |
| sandturtle | 沉沙鳖 | `stat_temp` | 少见 | 100 | 甲壳 | 🐢 |
| mimicocto | 拟态章鱼 | `temp_toast` | 稀有 | 200 | 甲壳 | 🐙 |
| lakewraith | 湖心游魂 | `abandoned_txn` | 稀有 | 240 | 精华 | 👻 |

### 钓点 3 · TOAST 深湖
| key | 游戏名 | job | 稀有度 | 售价 | mat | emoji |
|---|---|---|---|---|---|---|
| squid | 鱿鱼 **【旧】** | `toast_chunk` | 少见 | 180 | 甲壳 | 🦑 |
| puffer | 河豚 **【旧】** | `bloat_page` | 少见 | 340 | 尘 | 🐡 |
| scaleturtle | 甲鳞龟 | `large_object` | 稀有 | 260 | 甲壳 | 🐢 |
| loneshade | 深渊孤影 | `orphan_lob` | 稀有 | 300 | 甲壳 | 🐙 |
| maw | 巨口鲸鲨 | `detoast_giant` | 史诗 | 600 | 核心 | 🦈 |
| stonefish | 石化古鱼 | `frozen_toast` | 稀有 | 220 | 晶体 | 🐟 |
| hoardclam | 吞盘巨蚌 | `chunk_hoard` | 史诗 | 720 | 核心 | 🦪 |
| inkabyss | 墨渊乌贼 | `compressed_blob` | 稀有 | 250 | 甲壳 | 🦑 |

### 钓点 4 · 冷备份归档
| key | 游戏名 | job | 稀有度 | 售价 | mat | emoji |
|---|---|---|---|---|---|---|
| frostbone | 冻骸鱼 | `freeze_relic` | 稀有 | 210 | 晶体 | 🐟 |
| froststurgeon | 霜鳞鲟 | `archived_wal` | 稀有 | 280 | 段料 | 🐟 |
| asheel | 灰烬鳗 | `vacuum_debris` | 少见 | 110 | 尘 | 🐍 |
| orca | 虎鲸 **【旧】** | `cold_backup` | 史诗 | 2600 | 核心 | 🐋 |
| ancientsturgeon | 千年古鲟 | `ancient_snapshot` | 史诗 | 800 | 核心 | 🐟 |
| sealedclam | 封印巨蚌 | `sealed_backup` | 稀有 | 320 | 甲壳 | 🦪 |
| snowcat | 雪盲白鲇 | `checksum_cold` | 稀有 | 240 | 晶体 | 🐟 |
| voidserpent | 归墟游龙 | `retention_ghost` | 传说 | 3000 | 核心 | 🐉 |

### 钓点 5 · 复制流（活水）
| key | 游戏名 | job | 稀有度 | 售价 | mat | emoji |
|---|---|---|---|---|---|---|
| streamsalmon | 溯流鲑 | `logical_repl` | 少见 | 120 | 精华 | 🐟 |
| twinjack | 双生鲹 | `sync_replica` | 稀有 | 260 | 精华 | 🐟 |
| souljelly | 缠魂水母 | `deadlock_jelly` | 史诗 | 700 | 精华 | 🎐 |
| voltele | 电鳗 | `wal_sender` | 稀有 | 300 | 精华 | 🐍 |
| ghostwalker | 幽灵行者 | `ghost_xact` | 稀有 | 320 | 精华 | 👻 |
| brokenserpent | 断链海蛇 | `broken_slot` | 史诗 | 640 | 核心 | 🐍 |
| tidecourier | 洄游信使 | `decode_stream` | 少见 | 130 | 精华 | 🐟 |
| tidelord | 潮汐主宰 | `streaming_lag` | 传说 | 3400 | 核心 | 🐙 |

### 钓点 6 · PITR 深渊
| key | 游戏名 | job | 稀有度 | 售价 | mat | emoji |
|---|---|---|---|---|---|---|
| dolphin | 海豚 **【旧】** | `lost_xlog` | 稀有 | 900 | 精华 | 🐬 |
| whale | 鲸鱼 **【旧】** | `full_dump` | 传说 | 9000 | 核心 | 🐋 |
| backflow | 溯洄者 | `pitr_snapshot` | 史诗 | 1000 | 核心 | 🐟 |
| timewhale | 时之古鲸 | `point_in_time` | 传说 | 4200 | 核心 | 🐋 |
| annihilator | 湮灭巨鲸 | `xid_wraparound` | 传说 | 6600 | 核心 | 🐋 |
| deepwhale | 深寒古鲸 | `archive_recovery` | 史诗 | 1200 | 核心 | 🐋 |
| voiddragon | 虚空游龙 | `lost_segment` | 史诗 | 1100 | 核心 | 🐉 |
| eyeofages | 万古之眼 | `wal_horizon` | 传说 | 8000 | 核心 | 👁 |

## 5. 数据模型

### 5.1 鱼定义（模块级常量，取代旧 `FISH`）
```
FISH[key] = { name, job, emoji, rarity, spot, price, mat }
```
`weight` 由 `rarity` 查表得出（不逐条写）。派生工具：`fishBySpot(spot)`、`spotPool(spot)`（按权重掷鱼）。

### 5.2 钓点定义
```
SPOTS[id] = { name, job, unlock, clickCost, reclaimMs, order }
```

### 5.3 存档新增字段（farm 存档仍是 v3，靠 load() 补默认，不清档）
- `state.spot`：当前钓点 id，默认 `wal_buffer`。
- `state.spotsOwned`：已解锁钓点集合，建鱼塘后含 `wal_buffer`。
- `state.autoReclaim`：bool，是否购置自动回收器。
- `state.lastReclaim`：上次被动结算墙钟。
- `state.fishProgress`：朝下一条累积的点击数。
- `state.fish{}`、`state.dex{}`、`state.clicks`、`state.pond`：沿用。

## 5.4 实现结构（含 farm-data.js 处置）

- **不碰 `farm-data.js`**：它是一个未接线的数据+功能半成品（扩展/成就/精通/连击等，属于别的子系统），index.html 不加载、farm.js 不引用。钓鱼扩充不激活它，避免范围爆炸。
- **扩正在跑的 `farm.js`**：钓鱼 UI、状态、渲染接进 farm.js（与现有一切一致）。
- **新增可单测模块 `skins/db-console/fishing.js`**（仿 `public/conceal-policy.js` 的 UMD：`module.exports` 兼 `window.Fishing`）。放钓鱼的**纯数据 + 纯逻辑**：`FISH` 全表、`SPOTS`、`RARITY` 权重、`MATERIALS`，以及纯函数 `rollFish(spotId, rng)`、`settleReclaim(state, now, cfg)`、`advanceCatch(state, spot)`、`fishDefaults()`（补默认字段）。farm.js 引入它、只做状态/DOM/渲染。作物等其余数据仍内联在 farm.js（不动），钓鱼因体量大且要 TDD 才单独抽。
- **index.html**：在 `farm.js` 之前加载 `fishing.js`。
- **新增资源目录**：`skins/db-console/fish/`（48 张鱼立绘）、`skins/db-console/scenes/`（6 张钓点场景），由 AI 生成后放入。

## 6. UI

### 6.1 新增独立分区「钓鱼」
`TABS` 加一项 `{ id:'pond', job:'reclaim', name:'钓鱼' }`（置于「仓库」后）。分区内容：
- **当前钓点条**：显示当前钓点名 + 朝下一条的进度（`fishProgress / clickCost`）。
- **钓点列表**：已解锁的可点选切换；未解锁的显示解锁金币价与按钮。
- **自动回收器**：未购置显示购置按钮；已购置显示「在 <当前钓点> 被动回收中，每 Xs 一条」。
- **鱼护**：当前持有的鱼（带卖出、锁定），从「仓库」迁来。
- **图鉴**：48 种鱼按钓点分组、按稀有度着色；未捕获显示 `???`（伪装模式显示 `job`）。

### 6.2 立绘与场景接入
- **鱼立绘**：游戏模式（`real=true`）鱼显示 AI 立绘 `<img>`（`skins/db-console/fish/<key>.webp`），**图缺失回退 emoji**。正方形、透明底、256px。
- **钓点场景图**：每个钓点一张背景场景图（`skins/db-console/scenes/<spotId>.webp`，共 6 张），游戏模式下作为钓鱼分区顶部的场景横幅，当前钓点即显示对应场景；最近钓起的鱼立绘叠在场景上。**图缺失回退到纯色面板 + 钓点名**。宽横幅比例（如 16:6）。
- **伪装模式**（`real=false`）：不出任何图（保伪装），鱼与钓点都是纯 `job` 文字，场景横幅隐藏。
- 全部美术由 AI 生成、风格锁定，见 `2026-09-02-fish-art-prompts.md`（含鱼与场景两套 prompt）。

### 6.3 「仓库」调整
仓库（`bag`）回归只管作物；鱼行迁入钓鱼分区。`sellall`（一键全卖）仍连鱼一起卖（便利保留）。

## 7. 迁移 / 兼容

- 旧存档 `state.fish` 的 8 种鱼计数、`state.pond`、`state.clicks` 原样保留。
- 旧鱼 key（eel/carp/koi/squid/puffer/dolphin/orca/whale）与其 `job` 不变 → 熊解锁（101 鳗鱼）、猫解锁（靠 pond）继续有效。
- `load()` 为新字段补默认值（现有代码已是这个补齐模式），无需 bump 版本清档。
- 旧的 `FISH_CLICKS` 常量与取模逻辑删除，改走 `fishProgress + clickCost`。

## 8. 范围之外（本次不做）

武器锻造、把鱼分解成材料、鱼竿/回收器的多档升级线、魔法、打怪。材料 `mat` 标签本次只写入不消费。

## 9. 测试要点

- 掷鱼只从「当前钓点的鱼池」里出，且尊重稀有度权重（可注入固定随机种子断言分布倾向）。
- `fishProgress + clickCost` 到点恰好出一条并归零；换钓点后按新 clickCost 计。
- 自动回收器离线结算：给定 `lastReclaim` 与 `now`，补出条数正确且受单次上限约束。
- 迁移：喂一个旧版 v3 存档（无新字段），load 后新字段有默认、旧鱼计数不丢。
- 伪装切换：`real` 两态下鱼名、钓点名、材料名都各有对应文案；伪装模式不出图。
