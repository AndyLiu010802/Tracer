# 打怪·战斗 美术出图 Prompt（风格统一）

配套 spec：`2026-09-02-combat-core-design.md`。共 **36 怪物卡 + 1 主角 + 1 背景 = 38 张**。
和鱼/塘同一美术方向，AI 生成后我用 ffmpeg 降采样接入（缺图自动回退 emoji/渐变）。

## 怎么用
1. 每张 = **【风格圣经】+【档位/boss 处理】+【主体】** 拼一条，丢 gpt-image。
2. 怪物：正方形 `1024×1024`、**透明背景**；命名 `<key>.webp` 放 `skins/db-console/mobs/`。
3. 主角：同上，存 `skins/db-console/hero.webp`。
4. 背景：`1536×1024` 横图，存 `skins/db-console/arena.webp`。

---

## 一、怪物卡（36 张）

### 【风格圣经】（每条前逐字照抄）
```
Flat vector game monster portrait of a single creature, centered, facing the viewer in a menacing bust / upper-body framing. Clean thick dark outline, smooth cel-shaded flat color fills, soft top light with a subtle rim light. Cohesive muted palette with one accent hue. Bold, readable silhouette that stays legible when shrunk to 64 pixels. Pure transparent background — no ground, no cast shadow, no scenery, no text, no letters, no watermark, no UI, no border, no frame. Square 1:1 composition, the creature filling about 85% of the frame. The art style must be identical across the entire roster.
Negative: no photorealism, no 3D render, no background, no text, no multiple creatures, no human bystanders, not cropped.
```
### 【档位/boss 处理】（接在风格圣经后）
- **小怪**：`An ordinary-sized monster, matte muted colors.`
- **boss**：`A large ornate boss monster with a menacing luminous aura and a few floating embers/motes, more detailed and imposing.`
- 越高档越阴森（调色越暗、越诡异），但**保持同一扁平矢量画风**。

### 【各怪主体】（接在最后）`key` — 名 → 主体
**档1**
- `deadlock` 死锁蛛 → `a small many-legged spider hopelessly tangled in its own crossing chains and threads, dark grey-violet, tense.`
- `dead_tuple` 僵尸元组 → `a shambling little zombie built from decayed data-blocks, ashen grey-green, hollow glowing eyes.`
- `table_bloat` 膨胀史莱姆 → `a swollen bloated slime blob, sickly pale green, distended and overfull.`
- `slow_query` 慢查询幽魂 → `a slow drifting ghost dragging a heavy hourglass, translucent pale blue, weary.`
- `cache_miss` 缓存食客 → `a hungry little gremlin gnawing on glowing memory shards, dull orange.`
- `lock_lord` 锁之领主 (boss) → `an imposing armored warlord wielding a great padlock-headed mace, dark iron and gold.`

**档2**
- `torn_page` 碎页蝠 → `a bat whose wings are made of torn paper pages, jagged edges, grey and ink-blue, darting.`
- `disk_spill` 溢出巨蟾 → `a huge bloated toad overflowing with spilling black liquid, murky green-black.`
- `bloat_swarm` 死元组群 → `a swarm-cluster of tiny decayed data-mites massed into a vaguely humanoid shape, grey-green.`
- `index_rot` 索引蛀虫 → `a segmented worm boring through a glowing crystalline index-lattice, rusty brown.`
- `stale_stats` 统计妖 → `a spectral fortune-teller sprite clutching a faded outdated chart, dusty teal.`
- `vacuum_storm` 真空吞噬者 (boss) → `a towering vortex elemental sucking in debris, a swirling grey storm around a glowing core.`

**档3**
- `repl_lag` 复制延迟鬼 → `a lagging shadow-double that trails behind itself in blue afterimages, translucent.`
- `conn_leak` 连接泄漏体 → `a humanoid made of leaking dripping cables and pipes, teal fluid, frayed.`
- `wal_flood` WAL 洪流兽 → `a massive water-beast surging as a roaring flood, deep blue torrent, powerful.`
- `phantom_read` 幻读魅影 → `a flickering phantom that appears only half-there, pale ghostly white-cyan, elusive.`
- `checkpoint_spike` 检查点巨像 → `a heavy stone golem with spiked fists slamming down, grey granite, glowing seams.`
- `long_txn` 长事务之影 (boss) → `a tall shadowy specter wrapped in an endless unspooling scroll and chains, deep indigo.`

**档4**
- `dirty_pages` 脏页风暴 → `a storm-sprite hurling smudged ink-stained pages, dark smoky grey with orange streaks.`
- `disk_full` 磁盘饕餮 → `an enormous gluttonous maw-beast stuffed to bursting, dark red-brown, overfull.`
- `race_condition` 竞态双子 → `twin fast mirror-sprites mid-collision, electric yellow and violet, blurred motion.`
- `entropy_creep` 熵增之蚀 → `a creeping corrosion-creature dissolving whatever it touches, sickly grey-purple decay.`
- `freeze_ghost` 冻结幽灵 → `an icy wraith exhaling freezing mist, pale frost-blue, crystalline.`
- `crash_recovery` 崩溃恢复魔 (boss) → `a shattered titan reassembling itself from glowing fragments, cracked red-and-gold.`

**档5**
- `partition_rift` 分区裂隙 → `a rift-being split across a glowing dimensional crack, teal-black, fragmented.`
- `checksum_error` 校验和恶鬼 → `a glitching demon covered in mismatched broken symbols, magenta-and-black corruption.`
- `oom_killer` 内存吞噬兽 → `a ravenous massive beast devouring glowing memory-cores, dark crimson, brutal.`
- `dead_letter` 死信使者 → `a hooded postal wraith carrying undeliverable sealed black letters, ashen grey, grim.`
- `logical_corrupt` 逻辑损毁体 → `a twisted humanoid whose form is logically impossible and escher-like, dark violet, warped.`
- `split_brain` 主从断裂君 (boss) → `a two-headed lord split down the middle, each half fighting the other, silver and dark.`

**档6**
- `page_corruption` 页损坏巨兽 → `a colossal corrupted beast riddled with glitching block-shaped holes, black-red static, monstrous.`
- `infinite_bloat` 无尽膨胀神 → `a god-sized ever-swelling mass endlessly bloating outward, pale sickly green, vast.`
- `clock_skew` 时序错乱者 → `a fractured time-sprite surrounded by out-of-sync clock hands, deep indigo, disorienting.`
- `silent_dataloss` 静默丢数魔 → `a silent faceless void-mage quietly erasing pieces of reality, near-black with faint white voids.`
- `storage_void` 存储湮灭 → `a hollow void-creature that swallows light, a pure black silhouette with a glowing rim.`
- `xid_wraparound` 湮灭之王·XID回卷 (boss) → `a colossal cosmic doom-lord of annihilation, deep-void indigo flecked with dying starlight and cracks of white annihilating light, apocalyptic — the final boss.`

---

## 二、主角立绘（1 张，`hero.webp`）
风格圣经（怪物那条）后接：
```
Subject: a determined database-guardian hero, a lone figure in practical teal-and-steel armor holding a glowing wrench-blade / terminal-sword, calm and resolute, heroic bust facing the viewer. (this is the player's own character, not a monster — no menacing aura)
```

## 三、对战背景（1 张，`arena.webp`，1536×1024 横图）
```
Wide atmospheric game background of a dim server-room / data-realm arena, painterly flat-vector style matching the creature set, moody and dark so bright character sprites read clearly on top. Rows of dark server racks and faint glowing cables receding into teal-black haze, a soft glow from below, subtle depth haze. No creatures, no characters, no text, no letters, no watermark, no UI, no border, no frame. Horizontal 3:2 composition with an open empty floor across the lower-center foreground for two combatants to stand.
```

---

# 材料/战利品图标（6 张）

打怪掉落的材料，显示在战利品堆和背包里（很小，18px 起）。做成**单个物品图标**。
出图：正方形 `1024×1024`、**透明背景**；命名 `<key>.webp` 放 `skins/db-console/mats/`。

## 【物品风格圣经】（每条前逐字照抄）
```
Flat vector game item / loot icon of a single object, centered, on a pure transparent background. Clean thick dark outline, smooth cel-shaded flat color fills, soft top light with a subtle inner glow. Cohesive muted palette with one accent hue. Bold, readable silhouette that stays legible when shrunk to 24 pixels. No ground, no cast shadow, no scenery, no text, no letters, no watermark, no UI, no border, no frame. Square 1:1 composition, the object filling about 70% of the frame. The art style must be identical across all six items.
Negative: no photorealism, no 3D render, no background, no text, no multiple objects, no hands, not cropped.
```

## 【各材料主体】（接在风格圣经后）`key` — 名 → 主体
- `page_scrap` 页料 → `a jagged shard torn from a metallic data-page, dull steel-blue with faint grid lines, sharp broken edges.`
- `lock_fang` 锁齿 → `a curved fang/tooth forged from a broken padlock shackle, dark iron with a cold metallic sheen.`
- `entropy_dust` 熵尘 → `a small swirling cluster of glowing decay-dust motes, sickly grey-purple, dissolving at the edges.`
- `index_shard` 索晶 → `a faceted crystal shard with a fine glowing lattice inside, translucent teal.`
- `wal_core` 日志核 → `a small glowing orb-core wrapped in ribbons of write-ahead log tape, warm amber-green.`
- `txn_soul` 事务魂 → `a wisp of captured spirit sealed in a tiny glass vial, ghostly pale-blue, ethereal.`
