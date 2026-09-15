# Tracer 皮肤：note 软件 + 任务管理工作台（替代 Supabase 伪装）

日期：2026-09-02
状态：已与用户确认

## 背景与目标

现有默认伪装 `db-console`（Supabase Studio 风格）退役为备选。新建皮肤 `skins/tracer/`，
伪装成一个叫 **Tracer** 的工程工作台：完整的笔记软件 + 专业任务管理工具。
与 db-console 的「静态假界面」不同，**所有分区真实可用**——它本身就是用户的效率工具，
屏幕上是真实工作痕迹，伪装效果反而最好。

小说阅读面板（`#aside-slot`）原样保留；键盘农场 + 钓鱼游戏整体移植进来。

## 视觉

- **基调**：Linear 风深色。深灰蓝底、紧凑列表、单色几何图标、`TRC-42` 式工单编号。
  阅读面板内容区固定深色，融入背景。
- **设计主题：日月轮回（晨昏流转档）**
  - 四段调色板，按真实时刻轮转，切换带 2s 过渡：
    | 时段 | 名称 | accent 基准 |
    |---|---|---|
    | 5–9 | 拂晓 · 琥珀 | `#e8975a` |
    | 9–17 | 白昼 · 鎏金 | `#d4b45f` |
    | 17–21 | 黄昏 · 绛紫 | `#b07ce8` |
    | 21–5 | 夜 · 靛银 | `#7c8fe8` |
  - 底色永远深色（伪装不受影响），变的是 accent 色相和顶部一层极淡的天光渐变。
  - 顶栏**微型日晷**：白天太阳沿弧线走（6:00–18:00 简化映射），入夜显示**真实月相**。
  - 全局进度组件 `phaseIcon(pct)`：完成度用月相表达，新月 0% → 满月 100%。
- 品牌：标签页标题 `Tracer — Engineering`，几何图形 favicon。

## 架构

### 文件结构（皮肤自包含，引擎不知情）

```
skins/tracer/
  index.html    壳：顶栏 + 左侧导航 + 主区 + 右栏（#aside-slot）
  skin.css      深色主题、四段调色板、引擎约定的 CSS 变量组
  app.js        分区路由、存储客户端、主题时钟、共享 UI 原语（弹层、pointer 拖拽、快捷键）
  model.js      纯函数数据模型（建卡、状态流转、日期计算、树布局、月相、markdown 渲染）
  notes.js  board.js  map.js  planner.js  timeline.js  inbox.js  insights.js
  game/         农场 + 钓鱼移植（db-console 那份冻结不动）
```

### 存储

- `server.js` 新增皮肤无关的通用端点 **`/api/store/<name>`**（GET/PUT 整份 JSON）：
  - name 白名单 `^[a-z][a-z0-9-]{0,31}$`；body 大小限制沿用 `readBody`。
  - 写入 = 临时文件 + rename，写前把上一版留作 `.bak`。
  - 数据落 `data/<name>.json`（`data/` 进 `.gitignore`）。
- 客户端：改动后 500ms 防抖 PUT + `beforeunload` 兜底；顶栏小圆点显示保存状态。
- 游戏存档沿用现有 localStorage 机制，移植时不碰。

### 数据模型（`data/workspace.json`）

```
projects: {id, name, color, status(active|backlog|done), parentId?, start?, end?}
tasks:    {id, seq("TRC-42"), projectId?, title, notes?, status(todo|doing|review|done),
           priority?, scheduled?, due?, order, createdAt, doneAt?}
notes:    {id, title, body(markdown), projectId?, pinned?, createdAt, updatedAt}
inbox:    {id, text, createdAt}
meta:     {seqCounter, rev}
```

七个分区 = 同一份数据的七种视图。同一张任务卡：Board 按 status 分列、Planner 按
scheduled 入周、Timeline 聚合成项目横条、Map 挂在项目节点下、Insights 统计 doneAt。

## 分区明细

左侧导航自上而下：Inbox、Notes、Board、Project Map、Planner、Timeline、Insights、
〔游戏〕；下方 PROJECTS 列表（色点 + 名称，点击 → 按项目过滤的 Board）。
当前分区与停留位置持久记忆。

| 分区 | 行为 |
|---|---|
| Inbox | 顶部输入框回车即记；每条可转任务（选项目/状态）、转笔记、删除。也是农场最顺手的打字面 |
| Notes | 第二列笔记列表（置顶 + 按更新时间）；手写 Markdown 编辑器，`Ctrl+E` 切换编辑/渲染预览，自动保存。支持标题/粗斜体/列表/代码块/引用/链接，渲染全程 HTML 转义 |
| Board | 四列看板 Todo / In Progress / In Review / Done；pointer 拖拽换列换序；卡片显示 seq、项目色点、到期日；列顶快速建卡；点卡弹详情（项目、优先级、scheduled/due）；可按项目过滤 |
| Project Map | 脑图树：workspace 根 → 项目（parentId 支持子项目）→ 任务叶；从左向右自动布局、SVG 连线、分支折叠、画布平移；节点带月相完成度；点任务节点弹详情 |
| Planner | 本周 7 天一列一天，今天高亮；有 scheduled 的任务落对应天，可跨天拖拽；左侧「未安排」托盘可拖入。日级粒度，不做小时格 |
| Timeline | 项目横条（start→end）铺月刻度，今天竖线，横条叠进度（= 该项目 done 任务占比）；点横条弹出改起止日期（拖拽调边留到后续） |
| Insights | 全真数据仪表盘：键盘热力图（复用农场按键计数）、每周完成任务柱状图、笔记活跃度、番茄钟轮数；手写 SVG 图表 |
| 游戏（导航项名 **Garden**，几何芽图标） | 农场 + 钓鱼完整移植，配色换 Tracer 主题变量。`Ctrl+Alt+G` 一键隐藏：导航项消失、正停在游戏则跳回上一分区、状态持久化；再按恢复 |

- **阅读面板**：右栏 `#aside-slot`，皮肤级文案 `data-panel-title="Reference"`、tag `ref`。
- **顶栏**：Tracer 标记 + workspace 面包屑；右侧保存状态点、`+ New`（快速建任务/笔记）、
  日晷、头像。`Ctrl+K` 命令面板（搜任务/笔记标题、跳分区）为最后阶段加分项。

## 交互与快捷键

- `Ctrl+Alt+G` 隐藏/恢复游戏；`Ctrl+E` 笔记编辑/预览；`Ctrl+K` 命令面板。
- 拖拽为 `app.js` 里的共享 pointer 原语，Board / Planner / Map 平移共用。
- 阅读面板 iframe 内按键不进游戏、不触发全局快捷键（沿用 farm.js 首要原则）。

## 错误处理

- PUT 失败：保存点变橙，内存数据不丢，下次改动重试（不自动热重试）。
- 读档损坏：服务端回退 `.bak`；再失败**不给空 workspace**——服务端回 409（坏档不伪装成
  空档），客户端锁死保存 + 顶栏警示，避免下次保存覆盖可能救得回来的原始字节。
  （实现时修订：给空 workspace 会在下次防抖保存时覆盖服务端仅存的一份，已否决。）
- 双标签页并写：last-write-wins + 顶栏提示。注意 `meta.rev` 现语义是「保存尝试计数」，
  落地本条时需要服务端参与的真版本号，勿直接复用。
- Markdown 渲染只认白名单语法，其余原样转义输出。

## 测试

- `model.js` 纯函数全部进 `node --test`：任务流转、seq 生成、周/月刻度计算、
  树布局坐标、月相算法、markdown 渲染器。
- `/api/store` 端点测试：GET/PUT、白名单拒绝、超大拒绝、损坏回退 `.bak`。
- 现有 91 项测试与 `dev/verify.js` 不动；verify 可加一条「tracer 首页可 serve 且含 #aside-slot」。
- UI 拖拽类交互手工验证。

## 实施阶段（每阶段结束都完整可用）

1. 壳 + 主题引擎：布局、四段调色板 + 晨昏流转、路由、阅读面板接入、`/api/store`、
   `model.js` 骨架、日晷 + 月相组件
2. Board + Inbox（含拖拽原语）
3. Notes（markdown 编辑器）
4. Planner + Timeline
5. Project Map + Insights
6. 游戏移植 + `Ctrl+Alt+G` + 默认皮肤切 tracer（`server.js` DEFAULTS 与
   `local.config.example.json` 同步改）+ README 更新
7. 加分项：`Ctrl+K` 命令面板

## 明确不做（YAGNI）

- 昼夜双貌（白天浅色主题）——伪装打折，已否决。
- Planner 小时格、Timeline 拖拽调边——后续迭代。
- 游戏存档迁移到服务端存储——移植阶段不碰，之后另议。
- 多人协作、账号体系、富文本 contenteditable 编辑器、第三方依赖——全部不做，
  仓库保持零依赖纯 Node 标准库。
