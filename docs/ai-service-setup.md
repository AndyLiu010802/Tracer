# Tracer 0.3.0：AI 服务开通指南

## 现在已经准备好什么

桌面版包含中英双语 AI 计划助手、资料文字提取、账号登录、计划预览与按工时自动排程。部署包包含独立账号服务、AI 调用、邀请码注册、调用额度、HTTPS 反向代理配置和账号管理命令。

**当前还没有公网服务器、域名和真实 AI 密钥，所以暂不能向真实 AI 生成计划。** 本次自动化测试使用可控的测试提供商，测试数据不会作为产品答案出现。用户无需购买个人 AI 密钥；你作为软件运营者，在服务端统一配置账号并承担服务器、域名和模型调用费用。ChatGPT 中的助手不提供代付账户或永久托管。

这是邀请制初版，适合先让少量用户试用。账号集中管理；任务和资料草稿仍保存在各自电脑。此功能不会自动把不同电脑的任务同步到云端。

## 你接下来做什么：按顺序完成

### 第 1 步：安装桌面版

从系统托盘退出旧版 Tracer，再运行 `Tracer-Setup-0.3.0-x64.exe`。选择原来的安装位置，保留应用数据。安装程序会创建星月 Logo 的桌面快捷方式。安装包不含你的任务、登录信息或 AI 密钥，可以分享。

打开 **AI 计划 → 目标与资料**，先填写目标、截止日期和工时。没有服务器时可以保存草稿，生成会提示尚未配置服务。

### 第 2 步：准备云服务器

注册你选用的云厂商账号，开通一台能运行 Docker Compose、带固定公网 IP 的 Linux 服务器。初期按单实例部署，内存至少 2 GB 作为部署起点，最终规格以实际负载测试为准。选购之前核对当地可用性与价格。

你只需要向协作助手提供：**云厂商名称、服务器系统版本、服务器公网 IP**。密码、SSH 私钥不要发到聊天。下一轮可以从云厂商控制台的实际页面开始，一步步协助你操作。

不要把桌面版 `server.js` 直接开放到公网。公网运行的是这个部署包中的 `ai-service/server.js`。

### 第 3 步：准备域名

使用已有域名或注册一个域名，创建例如 `ai.你的域名` 的 A 记录，指向服务器 IP。将 `80/tcp`、`443/tcp` 开放到公网；SSH 端口仅允许你的管理 IP。**8787 不需要对公网开放。**

本包的 Caddy 在域名解析正确、80/443 可访问后自动申请和续期 HTTPS 证书。见 [Caddy HTTPS 官方指南](https://caddyserver.com/docs/quick-starts/https)。

### 第 4 步：准备 AI 账号

在 [OpenAI 开发者平台](https://platform.openai.com/) 创建运营用的项目和 API 密钥，并在平台设置预算提醒和使用限制。先以小范围邀请测试为主。

把密钥直接写入服务器秘密文件或云平台的秘密管理界面，**不要发到聊天、前端、安装包或代码仓库**。

默认模型配置为 `gpt-5-mini`，可在 `.env` 中更改为你的账号可用且支持结构化输出的模型。本服务使用 Responses API 的严格 JSON 输出，并设置 `store:false`；这不代表提供商不处理请求或不存在其他数据留存政策。参见 [结构化输出](https://developers.openai.com/api/docs/guides/structured-outputs) 与 [模型说明](https://developers.openai.com/api/docs/models/gpt-5-mini)。

### 第 5 步：把部署包放到服务器

把 `Tracer-AI-Service-0.3.0.zip` 上传到服务器，解压到你专门创建的目录，例如 `/opt/tracer-ai`。通过云控制台终端或 SSH 操作。按照 [Docker 官方安装指南](https://docs.docker.com/engine/install/) 安装 Docker Engine 和 Compose 插件；先确认以下命令成功：

```sh
docker --version
docker compose version
```

在解压后的目录中执行：

```sh
cp .env.example .env
nano .env
```

填写 `AI_DOMAIN` 为真实域名（不要加 `https://`）。初次建议保留默认额度：每人每天 10 次，全站每天 100 次，最多 100 个用户。

然后创建秘密文件。以下是服务器 Bash 命令，会隐藏密钥和邀请码输入：

```sh
mkdir -p secrets
chmod 700 secrets
read -r -s -p 'OpenAI API key: ' tracer_key
printf '\n'
printf '%s' "$tracer_key" > secrets/openai_key.txt
unset tracer_key
read -r -s -p 'Private invitation code: ' tracer_invite
printf '\n'
printf '%s' "$tracer_invite" > secrets/invite_code.txt
unset tracer_invite
chmod 644 secrets/openai_key.txt secrets/invite_code.txt
```

秘密目录的 `700` 权限保护宿主机文件；两个文件需要容器内的非 root 用户能够读取，因此文件设为 `644`，并以只读 Docker secrets 挂载。不要更改秘密目录的保护权限。不要分享配置后的目录。Docker secrets 的配置依据见 [官方文档](https://docs.docker.com/reference/compose-file/secrets/)。

### 第 6 步：启动并检查

```sh
docker compose up -d --build
docker compose ps
```

浏览器打开 `https://你的AI域名/health`。预期返回：

```json
{"ok":true,"service":"tracer-ai","version":"0.3.0","configured":true}
```

如果 `configured:false`，检查秘密文件是否为空。如果访问失败，按顺序检查域名 A 记录、80/443 防火墙、容器状态和以下日志：

```sh
docker compose logs --tail=80 ai caddy
```

应用不记录目标、资料正文、密码和密钥。不要把带有秘密值的终端内容直接截图分享。

### 第 7 步：在桌面版连接

1. 打开 **AI 计划 → 账号与服务**。
2. 服务地址填 `https://你的AI域名`，点击「保存服务地址」。
3. 填写用户名、至少 12 位密码、邀请码，点击「创建账号」。
4. 回到「目标与资料」，输入目标并添加资料。
5. 在「时间与工时」设置开始日、截止日、每周工时、每日上限、单次时长和可工作日。
6. 勾选本次发送资料的同意框，点击「生成计划」。
7. 检查摘要、追问、任务和估时。可以回答追问后重新生成，也可直接修改任务并重新计算排程。
8. 有工时缺口时调整日期、工时或任务范围。检查无误后点击「确认并创建任务」。

分享给朋友时发送 **安装包、服务地址和邀请码**。不要发送服务器密钥或完整数据目录。所有用户登录自己的账号；服务未内置固定域名，初次需要填写地址。

## 规则与限制

- 每次模型生成尝试消耗一次调用额度，失败尝试也计入，UTC 零点重置。每用户同时只允许一个生成，全站最多四个生成并发；登录入口有短期频率限制。
- 文件最多 6 个、单个 10 MB、提取文字总计 12 万字符；PDF 最多 150 页。不含 OCR，扫描文件需先转换为文字。文本文件需 UTF-8。资料在本机提取，生成时才发送所选文字。
- 日期按天分配，周从周一开始；不是具体到几点的日历约会。已有未完成排期的剩余估时占用容量，无估时按 1 小时预留。工时以 15 分钟为粒度，弹性时间从周容量扣除。长任务拆成工作段，依赖按工作段顺序保存，同一天可按依赖顺序执行。
- 任务估时来自模型，需由用户审核。AI 无权自行执行任务或直接覆盖已有任务。确认时再次检查当前工作区容量。
- 账号密码以 scrypt 哈希保存；会话为随机令牌，云端只存哈希。桌面令牌由 Windows 安全存储加密，浏览器脚本拿不到原始令牌。纯 Node 开发模式无安全存储时仅在内存保持登录。
- 本版本采用单进程账号文件数据库，**只运行一个 AI 服务实例**，不要横向扩容或同时运行管理员写入命令。扩大服务前迁移到支持事务的数据库、增加监控和正式的账号恢复流程。
- Docker 镜像配置与压缩包已生成；本机若没有 Docker，则不能声称已在真实云服务器验证 TLS。上线需要实际执行第 6、7 步验收。

## 运维：备份、恢复、密码重置

### 备份账号

在部署目录执行（短暂停止 AI 服务，桌面已有任务仍可使用）：

```sh
docker compose stop ai
mkdir -p backups
chmod 700 backups
docker compose cp ai:/app/data/accounts.json ./backups/accounts.json
docker compose start ai
```

请将备份存到安全的异地位置。它含账号哈希和会话哈希，不能公开。首次尚未注册账号时没有文件，备份命令会报不存在。

恢复时先停止 AI 服务，再将备份复制到容器数据目录，确保文件归 `node` 用户（UID 1000）所有，然后启动。不要执行 `docker compose down -v`，该命令会删除账号数据卷和证书数据。

### 重置密码 / 删除账号

先验证用户身份。以下操作会撤销该用户所有会话。必须在服务停止时执行，避免两个进程同时写账号文件。

```sh
docker compose stop ai
read -r -s -p 'New password (12+ characters): ' tracer_password
printf '\n'
printf '%s' "$tracer_password" | docker compose run --rm -T ai node ai-service/admin.js reset-password 用户名
unset tracer_password
docker compose start ai
```

列出账号可用 `docker compose run --rm ai node ai-service/admin.js list`。删除账号将上述管理动作替换为 `delete-user 用户名`，无需输入密码。此操作只删除云端 AI 账号，不删除用户电脑里的任务。

## English quick start

This bundle provides an invitation-only shared AI backend. You operate and pay for the hosting and provider account. End users sign in with individual accounts; they do not supply provider keys. Cloud hosting and real model calls have not yet been activated.

1. Install the desktop application. Existing local tasks are retained.
2. Prepare a Linux server with Docker Compose and a domain pointing to its public IP.
3. Extract the deployment ZIP. Copy `.env.example` to `.env` and set `AI_DOMAIN`.
4. Create `secrets/openai_key.txt` and `secrets/invite_code.txt`; keep the parent directory private and files readable by the container's non-root user.
5. Run `docker compose up -d --build`. Expose ports 80/443, keep 8787 private, and verify `/health` reports `configured:true`.
6. Enter the service HTTPS origin in **AI plan → Account & service**. Register with an invitation code.
7. Add the brief, optional documents and weekly capacity. Explicitly agree to sending these materials, generate a draft, review estimates, then confirm task creation.

Deploy exactly one service replica. Back up the `ai_data` volume. Stop the service before using `ai-service/admin.js`. Generated task history stays on each computer; this AI service is not cross-device workspace sync.
