# 本地账户（第一版）

点击侧栏头像进入账户面板。支持邮箱标识 + 密码注册、登录、退出、修改密码、恢复码重置密码、会话撤销，以及昵称、空间名称、简介和头像编辑。邮箱目前只作为本机登录标识，不验证邮箱、不发送邮件、不连接云账户。

头像提供 8 个基础图案和 12 个星座，默认黑色图案；背景色与图案色独立设置。上传 PNG、JPEG 或 WebP（最大 5 MB）后，可拖动、用方向键微调、缩放至 300%，确认裁剪后保存资料。保存的是 192 × 192 PNG 裁剪结果，原图不保留。

## 数据与恢复

- 每个账户有独立工作区、花园资产和浏览器偏好；AI 配置、生成任务、宠物资源与生成草稿也按账户隔离。
- 游客工作区继续保留。用户可在「我的数据」中将游客的任务、笔记、项目及花园记录导入空账户。同一份游客存档只允许认领一次，防止重复复制金币；不会覆盖已有账户数据。
- 切换账户前等待工作区和伙伴草稿保存。其他已打开的旧账户页面会锁定，避免跨账户写入；桌面伙伴随账户重新加载。
- 注册时显示恢复码，确认保存后进入空间。密码重置会替换恢复码并撤销旧会话。没有邮箱找回功能，请保管恢复码。
- JSON 导出包含个人资料、工作区和浏览器偏好，不包含密码、会话凭据或恢复码，也不是 AI 文件和伙伴图片的完整备份。
- 「壁纸商店」提供静态、动态、材质边框各 10 款，共 30 款。先预览，再用花园出售收获所得的金币购买。购买后进入当前账户收藏，点击「应用到我的空间」即可使用。背景和材质槽位独立，可组合使用或分别恢复默认。
- 壁纸、农场和花园摆件共用金币余额。重复购买同款不会再次扣款；购买与收据在同一工作区原子写入，旧页面保存不能删除收藏或重复花费余额。金币仅为本地游戏资产。
- 动态壁纸支持手动暂停，并遵循系统减少动态效果设置及后台暂停。切换账户时，收藏和所选外观随账户切换。设计源文件位于 `design/wallpaper-studio-v1/`，运行资产位于 `skins/tracer/wallpapers/`。
- 动态壁纸第二版采用 10 张独立高清场景，配合水面扰动、雨滴折射、花瓣、飘雪与火光等局部动画。保持原有商品 ID 与价格，已购收藏直接使用新外观；独立预览位于 `design/dynamic-wallpapers-v2/index.html`。
- 动效第三版增大了 10 个场景的位移、速度、粒子尺寸与光照变化，增加多层极光和环尘光迹。商店提供舒缓（0.5 倍）、标准（默认 1 倍）、活跃（1.6 倍）三档速度，同步影响预览与已应用的壁纸，按账户保存。动态壁纸主内容区的深色遮罩从 62% 降至 44%，卡片与侧栏保留独立底色。暂停、减少动态效果和后台停止仍生效。
- 动效第四版移除了照片条带的往返平移：水面使用二维行进波法线计算局部折射，云雾使用单向流动与双阶段渐变衔接，火焰提取暖色发光区域后向上输运，极光只改变光帘亮度，保留固定景物。雨滴加速下滑，雨雪与花瓣持续下落，萤火采用不规则路径。`wallpaper-flow.js` 复用一个 WebGL 画布与最多四张纹理；不可用时回退到静止底景上的波纹和粒子。新增固定景物像素及流动循环连续性检查；临时对比视频已清理，可运行 `dev/record-wallpaper-comparison.cjs` 重新录制。
- 材质边框第二版使用实时 WebGL 光照：水晶切面采样当前壁纸模拟折射与色散，钛金属使用方向性反射，胡桃木使用程序木纹、表面法线和漆面高光。整窗边框、栏位边缘与商店预览同步升级，商品 ID、价格和所有权不变；原「冰晶磨砂」改名为「冰晶切面」。鼠标控制光源，暂停和系统减少动态效果会固定光照。静态材质在光源停止后不继续渲染；动态背景采样上限 24 fps，画布宽度最多 2200 像素、DPR 最多 1.5。无 WebGL 时使用 CSS 倒角外观。

## 服务接口

`lib/accounts.js` 提供本地 provider；`lib/account-http.js` 负责 HTTP 协议，`skins/tracer/account-storage.js` 封装页面会话与存储范围。云服务接入点是 provider 契约和版本化能力信息，目前 `cloudSync: false`、`emailVerification: false`。

| 请求 | 路径（前缀 `/api/account/`） |
| --- | --- |
| GET | `session`, `capabilities`, `sessions`, `guest-preview`, `collection`, `export` |
| POST | `register`, `login`, `logout`, `profile`, `password`, `recover`, `recovery-code`, `revoke-session`, `import-guest`, `wallpaper-purchase`, `wallpaper-equip` |

`wallpaper-purchase` 接受 `{itemId}`，价格只读取内置目录；`wallpaper-equip` 接受 `{slot: "background" | "material", itemId: string | null}`，仅允许装备已购买的对应类型。两者返回最新 `collection`，包含余额、收据和外观槽位。收据存于 `workspace.taskGarden.market.wallpapers`，通用工作区保存接口不能直接创建壁纸收据或更改外观。第一版目录与收据价格固定；新增定价须使用新商品 ID。

API 要求 `X-Tracer-Account: 1`。除读取 session/capabilities 外，还要求 `X-Tracer-Scope` 匹配当前账户 UUID 或 guest/locked。工作区、AI 和伙伴资源请求携带 `__tracer_account`；不匹配的旧页面请求被拒绝。会话使用 HttpOnly、SameSite=Strict 的本地 HTTP cookie。账户服务仅接受可信回环地址请求。

账户索引保存在 `DATA_DIR/.accounts/identity.json`，独立账户文件保存在 `.accounts/<uuid>/data/`。密码使用加盐 scrypt，恢复码和会话令牌保存 SHA-256 摘要。写入由单个服务进程串行化并原子替换；身份索引损坏会拒绝访问，不自动清空。工作区 JSON 本身不加密，本地账户隔离不代替操作系统用户权限。

将来接入云服务时需实现远端身份、邮箱验证、工作区存储与同步冲突处理，并在服务端裁定金币余额和壁纸所有权；不能把本机文件余额直接视为云端可信余额。现有 provider 边界是接入点，并非已完成的云同步实现。

## 验证

`test/accounts.test.js`、`test/account-http.test.js` 和原生伙伴测试覆盖身份、恢复、会话、数据隔离与请求边界。`test/account-wallpapers.test.js` 覆盖重复购买、并发扣款、目录价格、收据保护和外观归属。`dev/qa-accounts.cjs` 验证账户与头像；`dev/qa-wallpaper-shop.cjs` 验证购买、外观组合、动态效果及 320–1440 px 布局；`dev/qa-account-desktop.cjs` 验证 Electron 主窗与桌面伙伴切换。所有 QA 使用独立临时数据。

运行浏览器或桌面 QA 时，将 `TRACER_QA_PLAYWRIGHT` 指向可用的 Playwright 包目录；项目内工具目录为 `.cache/desktop-qa-tools/node_modules/playwright`。

`dev/qa-wallpaper-materials.cjs` 验证 10 款材质的实时光照、壁纸变色后的折射更新、中心透明、暂停、减少动态效果、离屏停止、尺寸变化、释放资源及无 WebGL 回退。水晶的折射对象是壁纸图像/动画画布，不包括界面文字；这是一套实时光学近似，不是对整个 DOM 进行光线追踪。

## 清空账户本地资料

「我的账户 → 我的数据 → 清空账户本地资料」要求输入当前密码并勾选不可撤销确认。操作删除当前账户数据目录（含备份、AI 配置/凭据、伙伴资源与生成记录），重置昵称、头像、简介和空间名称，清除该账户浏览器偏好及 IndexedDB 伙伴草稿。邮箱、密码、恢复码、账户 ID 和当前登录保留；其他会话失效，游客与其他账户不受影响。已认领的游客存档仍保持认领，避免重复导入金币。用户另行导出的文件不在清理范围内。

`POST /api/account/clear-data` 接受 `{password, confirm: true}`。清理前检查正在执行的数据请求，有操作未完成时返回 `account-data-busy`，不删除文件；关闭该账户 AI 运行时后再删除目录。成功后递增 `generation` 并刷新当前会话。账户请求通过 `X-Tracer-Generation`、工作区请求通过 `__tracer_generation` 校验版本，旧窗口不能恢复已清除的数据。其他浏览器在下次载入该账户时清理其旧偏好及草稿，桌面伙伴按版本重新加载。

验证：`test/accounts.test.js`、`test/account-http.test.js`、`test/store-readonly.test.js`、`test/pet-desktop.test.js`；`dev/qa-account-clear.cjs` 使用独立临时数据验证确认/取消、错误密码、保留登录、清理范围、旧窗口写入保护及窄屏布局。
