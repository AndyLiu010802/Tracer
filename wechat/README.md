# Tracer 微信小程序

原生微信小程序 + 微信云开发云函数 + 现有电脑版。当前源码可以导入开发者工具；尚未提供 AppID、云环境，也未发布或进行真机云端联调。

## 中英文切换 / Language

任务详情现支持负责人姓名、类型、4 档优先级、标签、预计/实际工时、验收标准、执行清单、参考链接和前置任务。详情与范围见[任务管理改进说明](../docs/task-management-review.md)。升级云端时需重新上传 `tracer` 云函数，以保留新增字段。

小程序「任务」「同步与设备」页右上角可切换 **中文 / EN**；电脑版任务看板顶部可选择 **中文 / English**。两端各自记住语言偏好，任务标题、项目名称和备注保持原文。小程序三个页面、电脑版看板与任务/项目编辑、配对及冲突处理界面支持双语。

Use **中文 / EN** at the top of the Mini Program, or **中文 / English** in the desktop task board toolbar. Each device remembers its own language. Task titles, project names and notes are preserved exactly as entered. A WeChat AppID and Cloud Development environment are required for live sync; an empty `envId` runs a clearly labelled offline demo.

## 你现在只需要做的事

1. 用电脑打开 [微信公众平台](https://mp.weixin.qq.com/)，点击「立即注册」，选择「小程序」。
2. 完成邮箱激活，按实际情况填写主体信息、管理员微信和身份验证。
3. 在后台「开发管理 → 开发设置」找到 AppID。
4. 把 AppID 发给协助配置的人即可。不要发送 AppSecret、密码、验证码或云账号密钥。本项目使用微信云开发身份，不需要把 AppSecret 放进代码。

官方参考：[注册流程](https://cloud.tencent.com/document/product/1598/80508)、[查找 AppID](https://cloud.tencent.com/document/product/1081/47685)。具体菜单以后台当前显示为准。

## 第一步：先在电脑预览

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)，使用管理员微信扫码登录。
2. 点击「导入项目」，目录选择本仓库的 **wechat** 文件夹，不要选仓库根目录。
3. 尚无 AppID 时，使用工具提供的测试号/游客模式查看界面；不能用它验证云同步。
4. 点击「编译」。任务页会明确显示「离线演示 · 尚未连接微信云开发」。可以新增项目、创建任务、编辑状态/备注/日期和使用筛选。

演示数据仅存于开发者工具或当前设备中。演示数据不会自动导入正式账号，也不会显示为已云同步。

## 第二步：有 AppID 后开通云环境

1. 在 `project.config.json` 中把 `touristappid` 换成你的 AppID。
2. 在微信开发者工具中打开「云开发」，按提示创建环境。若显示套餐/费用，先确认价格和用量再选择；没有自动购买步骤。
3. 复制环境 ID，填入 `miniprogram/config.js` 的 `envId`。
4. 在云数据库中创建以下三个集合：
   - `tracer_accounts`
   - `tracer_pairs`
   - `tracer_devices`
5. 三个集合都设置为**仅管理端可读写**（客户端读写规则均为 `false`）。小程序通过云函数访问，不直接读写集合。
6. 右键 `cloudfunctions/tracer` →「上传并部署：云端安装依赖」。选择支持 Node.js 18 或更高版本的普通/事件云函数运行环境。
7. 重新编译小程序。演示提示应消失；创建任务后退出重进，确认仍能读到。

官方参考：[小程序调用云函数](https://docs.cloudbase.net/recipes/add-cloud-function-wechat-miniprogram)。

## 第三步：连接电脑版

1. 在云开发控制台为刚部署的**同一个普通云函数 `tracer`** 配置「HTTP 访问服务 / HTTP 网关」，路径例如 `/tracer`，允许 POST。
2. 复制控制台生成的完整 HTTPS URL。电脑版支持腾讯云开发的 `*.tcloudbase.com`、`*.tcloudbaseapp.com` 地址，不要自行拼接地址。此入口由本项目校验一次性配对码和设备令牌。
3. 不要把函数改成使用 `context.httpContext` 的新式 HTTP 云函数。当前适配的是普通云函数的 HTTP 网关事件（`event.httpMethod`、`event.body`）；微信调用仍使用 `wx.cloud.callFunction`。
4. 小程序打开「同步与设备」→「生成配对码」→「复制配对码」。配对码 5 分钟失效，仅可使用一次；重新生成会使旧码失效。
5. 电脑双击桌面的 **Tracer Tasks** → 顶栏「微信同步」。填写 HTTPS URL 和配对码，点击「连接并合并」。
6. 等到显示「微信已连接」。已有任务、项目、笔记和收集箱会与云端合并；有相同记录冲突时，按提示选择保留哪一版。
7. 在手机修改一项任务，回到电脑版，等约 15 秒或点「立即同步」。再在电脑改一项，回小程序验证。

官方参考：[为普通云函数配置 HTTP 访问](https://docs.cloudbase.net/service/access-cloud-function)。控制台默认域名可用范围及生产域名要求，以开通环境时的平台说明为准。

## 第四步：手机体验和发布

1. 开发者工具点击「预览」，用管理员微信扫码体验。
2. 需要让其他人测试时，在公众平台「成员管理」添加体验成员，上传开发版本后设置体验版。每个微信身份的数据独立。
3. 自己真机验证：新增任务、电脑同步、状态/日期修改、删除、断网重试、解绑。
4. 需要正式发布时，再按微信后台要求完善名称、类目、隐私说明及其他必填项，上传代码、提交审核，审核通过后发布。

手机通过云开发访问云端，所以电脑关闭后仍可使用。小程序退到后台不会持续轮询，回到前台时再刷新。

## 同步行为

- 四类工作区记录使用同一份云端快照，手机界面先提供任务和项目管理；笔记和收集箱内容会完整保留。
- 每次写入校验云端版本。不同记录/字段的并发改动会合并；相同字段、编辑与删除之间的冲突需人工选择。
- 已完成状态与完成时间作为一个整体合并。并发新建的任务会由云端分配不重复的 TRC 编号。
- 手机网络失败时保留本设备草稿；在「同步与设备」重试。电脑保留未同步浏览器草稿，状态显示为未同步。
- 设备令牌只保存在电脑版 `data/.sync/connection.json`，不发送给前端。不要分享这个文件。
- 配对前的本机快照保存在 `data/.sync/before-pairing.json`；同步成功会更新 `data/workspace.json` 缓存。本地断开连接后使用最近的缓存。
- 小程序可以解除电脑绑定；授权默认 90 天，到期需重新配对。解除授权不会远程清除电脑上已有的缓存。
- 每份云工作区上限 512KB，每类最多 2000 条记录；超限会拒绝保存并保留草稿，不会假装成功。

## 开发与验证

在仓库根目录运行：

```powershell
node dev/prepare-wechat.js
node --test test/workspace-sync.test.js test/wechat-cloud.test.js test/cloud-bridge.test.js test/wechat-client.test.js test/tracer-sync-client.test.js
```

`prepare-wechat.js` 将共享模型与合并逻辑复制到小程序/云函数包内。修改共享逻辑后先运行它，再上传云函数。不要直接修改生成的 `miniprogram/lib/model.js`、两个 `workspace-sync.js` 副本。

云函数依赖锁定为核实过的 `wx-server-sdk@4.0.2`，锁文件随源码提交。安装时 npm 审计仍报告上游传递依赖问题（包含旧版 axios、lodash.set/unset）；当前查询路径和字段均由服务端固定或白名单处理，未强制降级 SDK 或替换其依赖。正式部署前需复查上游修复与审计结果，并完成真实环境验证。

本地自动化覆盖的是客户端逻辑、云业务事务、HTTP 桥接与冲突恢复；不等同于微信开发者工具编译、真机测试或正式审核通过。
