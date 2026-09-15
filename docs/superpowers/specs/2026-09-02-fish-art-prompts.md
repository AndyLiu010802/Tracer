# 鱼类立绘 · 出图 Prompt（风格统一）

配套 spec：`2026-09-02-fishing-expansion-design.md`。

## 怎么用

1. 每条鱼 = **【风格圣经】+【该鱼稀有度处理】+【该鱼主体描述】** 三段拼成一条完整 prompt，丢给 GPT 图像（gpt-image-1 / DALL·E 3）。
2. **【风格圣经】逐字不变地放在每一条前面**——这是风格一致的关键，别改写。
3. 出图设置：正方形 `1024×1024`、**透明背景**（gpt-image-1 设 `background: transparent`）。
4. 命名：按每条鱼的 `key` 存成 `<key>.webp`（如 `ghostwalker.webp`），放进 `skins/db-console/fish/`。
5. 出好丢进目录后**接图进游戏交给我**（我做降采样到 256、emoji 兜底、伪装模式不出图的接线）。

> 提示：一次出一条最稳。若批量，务必每条都带完整【风格圣经】，否则风格会飘。

---

## 【风格圣经】（每条前面逐字照抄）

```
Flat vector game-icon illustration of a single sea creature, centered, full body in frame with even margin, strict side profile facing left. Clean thick dark outline, smooth cel-shaded flat color fills, soft top-left key light with a subtle rim light. Cohesive muted palette with one accent hue. Simple bold readable silhouette that stays legible when shrunk to 48 pixels. Pure transparent background — no ground, no cast shadow, no scenery, no text, no border, no frame. Square 1:1 composition, the creature filling about 80% of the frame at a consistent scale. The art style must be identical across the entire set.
Negative: no photorealism, no 3D render, no background, no text or letters or watermark, no multiple creatures, no human hands, no UI, not cropped.
```

## 【稀有度处理】（按该鱼档位，接在风格圣经后）

- **常见 common**：`Matte muted colors, no glow — plain and humble.`
- **少见 uncommon**：`Slightly brighter accent hue and a faint highlight sheen.`
- **稀有 rare**：`A soft colored rim glow tracing the silhouette.`
- **史诗 epic**：`A stronger luminous aura with a few floating light particles; more detailed.`
- **传说 legendary**：`An ornate mythical creature with a luminous ethereal aura, faint drifting light motes and subtle glowing markings — grander and more detailed, while keeping the exact same flat-vector style.`

## 【主体描述】48 条（接在最后）

格式：`key` — 游戏名（稀有度）→ 英文主体描述。

### 钓点 1 · WAL 缓冲区
- `eel` — 鳗鱼（常见）→ `a plain slender river eel, smooth olive-grey body.`
- `husk` — 腐骸鱼（常见）→ `a small drab decaying husk-fish with tattered fins and faintly hollow ribs, ashen grey-green.`
- `chip` — 碎屑鳉（常见）→ `a tiny angular minnow that looks built from chipped fragments, dull slate colour, jagged edges.`
- `silverdace` — 银鲦（常见）→ `a quick slim dace with a pale metallic silver sheen, plain.`
- `crackcarp` — 裂纹鲤（少见）→ `a carp with thin glowing crack-lines running across its scales, muted teal with faint cyan cracks.`
- `courier` — 信使鳗（少见）→ `a sleek eel trailing a faint ribbon of light along its body, soft blue-green.`
- `lampfish` — 灯花鱼（少见）→ `a small deep-water lantern fish with a single glowing bud-light on its brow, muted indigo.`
- `lurker` — 幽灯鮟鱇（稀有）→ `an eerie anglerfish with a spectral pale lantern, dark ink-blue body and a wide toothy grin.`

### 钓点 2 · 临时文件湖
- `carp` — 鲫鱼（常见）→ `an ordinary plump crucian carp, muddy bronze, plain.`
- `koi` — 锦鲤（少见）→ `an elegant koi with orange-and-white patches.`
- `loach` — 泥鳅（常见）→ `a slippery whiskered brown loach, muddy tone, plain.`
- `overflowcat` — 溢流鲶（常见）→ `a big-whiskered catfish spilling a trickle of water from its gills, murky grey-green.`
- `glassfish` — 玻璃鱼（少见）→ `a translucent glass-fish revealing its faint skeleton, pale clear blue.`
- `sandturtle` — 沉沙鳖（少见）→ `a small soft-shell turtle half-buried in settling sand, dusty tan.`
- `mimicocto` — 拟态章鱼（稀有）→ `a shape-mimicking octopus mid-transform, shifting mottled violet, extra suckered arms.`
- `lakewraith` — 湖心游魂（稀有）→ `a translucent ghostly lake-spirit fish with a wispy tail fading into mist, faint green.`

### 钓点 3 · TOAST 深湖
- `squid` — 鱿鱼（少见）→ `a common reef squid, pale pink-grey, long tentacles.`
- `puffer` — 河豚（少见）→ `a round inflated pufferfish with blunt spines, sandy yellow.`
- `scaleturtle` — 甲鳞龟（稀有）→ `a heavy armoured turtle with overlapping plate-scales, deep bronze-green.`
- `loneshade` — 深渊孤影（稀有）→ `a lone deep-sea octopus silhouette drifting in shadow, dark violet with a single glowing eye.`
- `maw` — 巨口鲸鲨（史诗）→ `a colossal whale-shark with an enormous gaping mouth, slate blue with pale spots, imposing.`
- `stonefish` — 石化古鱼（稀有）→ `a petrified ancient fish encased in cracked grey stone with moss accents.`
- `hoardclam` — 吞盘巨蚌（史诗）→ `a giant maw-clam brimming with swallowed treasure-shells, pearl and gold.`
- `inkabyss` — 墨渊乌贼（稀有）→ `a compact ink-black cuttlefish wreathed in dark ink clouds, faint teal edge.`

### 钓点 4 · 冷备份归档
- `frostbone` — 冻骸鱼（稀有）→ `a fish frozen to the bone in pale ice, translucent frost-white with cold blue shadows.`
- `froststurgeon` — 霜鳞鲟（稀有）→ `a long sturgeon rimed with frost along its ridged back, steel-grey and icy white.`
- `asheel` — 灰烬鳗（少见）→ `a charred ash-grey eel trailing faint embers, sooty tone.`
- `orca` — 虎鲸（史诗）→ `a powerful orca, glossy black-and-white, sleek and majestic.`
- `ancientsturgeon` — 千年古鲟（史诗）→ `an immense ancient sturgeon covered in age-worn bony plates, dark jade and gold, venerable.`
- `sealedclam` — 封印巨蚌（稀有）→ `a great clam bound by a glowing seal-ribbon, deep indigo shell.`
- `snowcat` — 雪盲白鲇（稀有）→ `a ghostly snow-white catfish with blind milky eyes, pale frost tone.`
- `voidserpent` — 归墟游龙（传说）→ `a serpentine dragon-fish coiling into a swirling abyssal vortex, deep void-blue scales flecked with cold starlight, glowing whiskers.`

### 钓点 5 · 复制流（活水）
- `streamsalmon` — 溯流鲑（少见）→ `a salmon leaping upstream mid-jump, silver-pink with water droplets.`
- `twinjack` — 双生鲹（稀有）→ `a pair of mirrored jack-fish fused into one linked silhouette, bright chrome-blue. (treat as a single subject)`
- `souljelly` — 缠魂水母（史诗）→ `an ethereal jellyfish with two intertwined glowing bells and long tangled soul-threads, luminous magenta-cyan.`
- `voltele` — 电鳗（稀有）→ `an electric eel crackling with arcs of lightning along its body, dark navy with electric-yellow sparks.`
- `ghostwalker` — 幽灵行者（稀有）→ `a translucent spectral fish, ghostly pale-blue, with a wispy trailing tail like fading smoke.`
- `brokenserpent` — 断链海蛇（史诗）→ `a long sea-serpent whose body breaks into floating disconnected segments held by faint light-links, teal and broken silver.`
- `tidecourier` — 洄游信使（少见）→ `a swift courier-fish carrying a faint glowing sigil on its flank, bright aqua.`
- `tidelord` — 潮汐主宰（传说）→ `a colossal regal octopus crowned with swirling tidal currents, deep ocean-teal, many majestic arms trailing luminous water.`

### 钓点 6 · PITR 深渊
- `dolphin` — 海豚（稀有）→ `a graceful leaping dolphin, sleek silver-grey.`
- `whale` — 鲸鱼（传说）→ `a vast serene blue whale, deep ocean-blue, immense and awe-inspiring.`
- `backflow` — 溯洄者（史诗）→ `a time-worn fish swimming against a swirl of reversed clock-current, dusky bronze with a faint spiral of light.`
- `timewhale` — 时之古鲸（传说）→ `an ancient cosmic whale with constellations and slow drifting clock-runes across its flanks, deep indigo, timeless.`
- `annihilator` — 湮灭巨鲸（传说）→ `a colossal void-whale, deep-void indigo body flecked with dying starlight and cracks of white annihilating light along its flanks, apocalyptic.`
- `deepwhale` — 深寒古鲸（史诗）→ `a hoary deep-cold whale crusted with pale frost and hanging icicles, dark slate-blue.`
- `voiddragon` — 虚空游龙（史诗）→ `a sinuous void dragon-fish dissolving into wisps of dark energy at its tail, black-violet with a faint purple glow.`
- `eyeofages` — 万古之眼（传说）→ `a mythic leviathan-eye entity — one great luminous eye ringed by ethereal fins and slow-drifting light, deep abyssal gold-on-black, otherworldly.`

---

## 一条拼好的完整示例（`ghostwalker` 幽灵行者 · 稀有）

```
Flat vector game-icon illustration of a single sea creature, centered, full body in frame with even margin, strict side profile facing left. Clean thick dark outline, smooth cel-shaded flat color fills, soft top-left key light with a subtle rim light. Cohesive muted palette with one accent hue. Simple bold readable silhouette that stays legible when shrunk to 48 pixels. Pure transparent background — no ground, no cast shadow, no scenery, no text, no border, no frame. Square 1:1 composition, the creature filling about 80% of the frame at a consistent scale. The art style must be identical across the entire set.
Negative: no photorealism, no 3D render, no background, no text or letters or watermark, no multiple creatures, no human hands, no UI, not cropped.
A soft colored rim glow tracing the silhouette.
Subject: a translucent spectral fish, ghostly pale-blue, with a wispy trailing tail like fading smoke.
```

---

# 钓点场景 · 出图 Prompt（6 张横幅）

和鱼同一美术方向，但做成**宽横幅环境背景**，暗调、无生物、下部留空给鱼立绘叠放。
出图设置：横向 `1536×1024`（后期裁成横幅）。命名 `<spotId>.webp` 放进 `skins/db-console/scenes/`。

页面里这块显示为一条 150px 高的横幅（`background-size:cover` 裁切），钓上鱼后鱼立绘会叠在塘面上，所以**下部中间要留出空白水面**。

## 【场景风格圣经】（每条前面逐字照抄）

```
Wide atmospheric game background of a fishing pond / body of water, painterly flat-vector style matching the creature set, moody and dark so bright fish sprites read clearly on top of it. A water surface with gentle ripples and soft reflections, subtle depth haze, simple layered shapes, cohesive limited palette. Seen looking slightly down onto the water. No creatures, no fish, no characters, no text, no letters, no watermark, no UI, no border, no frame. Horizontal 3:2 composition with open empty water in the lower-center foreground for a sprite to sit. The art direction must be identical across all six ponds.
```

## 【六个鱼塘描述】（接在风格圣经后）

- `wal_buffer` — WAL 缓冲区（起点·暖塘）→ `a small warm shallow pond at golden hour, amber-and-green water, a few lily pads and drifting light motes along the edges, cozy and inviting.`
- `temp_lake` — 临时文件湖 → `a murky green freshwater lake, misty reeds along the banks, soft silt-clouded water, dim overcast light from above.`
- `toast_lake` — TOAST 深湖 → `a vast deep teal lake inside a cavern, huge looming rock formations at the sides, cold shafts of light piercing the dark water, a sense of great depth.`
- `cold_archive` — 冷备份归档（冰塘）→ `a frozen pond beneath pale ice, a cracked ice surface with frost and hanging icicles, still cold blue water showing through, wintry and quiet.`
- `repl_stream` — 复制流（活水）→ `fast flowing luminous rapids, electric teal-and-cyan currents and glowing ripples streaking across the water, energetic living water.`
- `pitr_abyss` — PITR 深渊（深渊之潭）→ `a bottomless black abyssal pool, near-black deep-indigo water, faint starlight reflections and drifting cold motes on the surface, immense dread and legendary depth.`
