# 使用 Render 部署 Tracer AI

此方式部署集中登录和 AI 计划服务。任务仍保存在用户电脑，尚不提供跨设备任务同步。可以先部署账号服务，再配置 AI 密钥。

## 1. 预览资源和费用

1. 在 Render 控制台选择 **New → Blueprint**。
2. 连接 GitHub 的 `AndyLiu010802/Tracer` 仓库；授权时只选择需要的仓库。
3. Blueprint 名称填写 `tracer-ai`，分支选择 `main`，Blueprint Path 使用 `render.yaml`。
4. 检查资源：一个 Singapore 区域的 Docker Web Service、0.5 CPU / 512 MB 内存、1 GB 持久磁盘。查看控制台实际显示的服务费、磁盘费与计费币种。
5. 确认费用后才点击 **Deploy Blueprint**。这一步会创建付费资源；AI 调用费另计。

配置使用付费实例，因为账号文件需要持久磁盘。不要切换到没有持久磁盘的免费实例：普通容器文件在重启或重新部署时可能丢失。当前账号存储仅支持单实例，不要启用横向扩容。

## 2. 检查首次部署

等待服务显示 Live，复制 Render 分配的 HTTPS 地址，然后打开其 `/health` 路径。预期 `ok` 为 `true`、`configured` 为 `false`；此时服务已运行，但还没有接入 AI。

在服务的 Disks 页面确认磁盘挂载点为 `/app/data`。后续注册测试账号并重启服务，再确认仍可登录，才算验证了实际部署环境中的账号持久化。

服务代码自动部署已关闭。还需进入 **Blueprint → Settings → Auto Sync** 设为 **No**，避免日后修改 Blueprint 自动调整线上资源。更新时手动检查并同步。

## 3. 接入 AI

开通 OpenAI API 账号及 API 计费后，在 Render 服务的 **Environment** 页面私下添加 `OPENAI_API_KEY`，保存并重新部署。不要把密钥写入 GitHub、桌面安装包或聊天。

默认模型为 `gpt-5-mini`。`configured: true` 只表示服务读到了密钥；必须实际生成一份计划，才能确认密钥权限、额度、模型访问和调用结果均正常。

## 4. 连接桌面版

在 Tracer 的 AI 计划助手中填写 Render 的 HTTPS 服务地址。邀请码由 Render 的 `INVITE_CODE` 自动生成，可在 Environment 中查看并私下提供给受邀用户。

注册测试账号，生成一份简短计划，检查任务、截止日期及每周工作量，再应用到任务列表。当前限制为每用户每天 10 次计划、服务每天共 100 次、最多 100 个账号；次数限制不等于固定金额预算。

## 运行范围

Docker 镜像仅复制服务脚本和计划模块，不包含本地工作区、音频或密钥。Render 提供 HTTPS 入口，因此此路径不需要运行部署包中的 Caddy 或购买域名。

部署后仍需检查构建日志、磁盘写入、重启后登录和真实 AI 请求。本地检查不能代替这些线上验收。

参考：[Blueprint 创建流程](https://render.com/docs/infrastructure-as-code)、[配置字段](https://render.com/docs/blueprint-spec)、[持久磁盘](https://render.com/docs/disks)、[HTTPS](https://render.com/docs/tls)。费用以创建时的控制台为准。
