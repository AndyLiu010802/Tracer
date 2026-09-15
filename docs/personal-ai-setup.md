# 配置自己的 AI / Bring your own AI

Tracer 0.3.3 使用你自己的 AI 接口，无需 Tracer 账号、邀请码或 Render 服务器。AI 请求从本机发送到你填写的服务地址；服务商的费用和额度由你自行管理。

## 一次性设置

1. 打开 **AI 计划 → 我的 AI**。
2. 选择 OpenAI、兼容接口或本机模型。
3. 填写 API 基础地址、模型名称和自己的 API 密钥。地址应类似 `https://api.example.com/v1`，不是聊天网页，也不要包含 `/chat/completions` 或 `/responses`。本机无需鉴权的服务可以不填密钥。
4. 点击 **保存**仅保存设置；点击 **保存并测试**会发送一次简短模型请求，可能产生服务商费用。测试不会发送任务资料。

OpenAI 预设使用 Responses 接口；兼容接口使用 Chat Completions。其他服务商需要实际支持所选接口和模型，不支持所有聊天网站。本机预设地址为 `http://localhost:11434/v1`，还需自己启动服务并填写已安装的模型名称。

桌面版可用系统加密时，密钥加密保存在当前用户的本机数据目录。不能安全加密时只留在本次进程内存，退出后重新填写。密钥不会写入计划草稿、任务或安装包，也不会显示在状态接口中。更改服务地址时必须重新提供密钥；“删除配置”会清除保存的密钥。

## 每次只回答三个问题

- 想完成什么？
- 最晚什么时候完成？
- 每周能投入几小时？

文件资料和工作日等设置均为可选项，默认折叠。点击生成会发送当前目标、时间要求及你选择的资料；参考已有任务需要主动勾选。AI 先给出草案，只有关键缺失信息才追问，最多两条。预览后可修改任务和估时，确认后才创建日程。

**已配置不等于已连通。** “模型测试成功”说明当前运行期间收到过所选接口的模型回复；配置或重启后需重新测试。真实计划仍可能因余额、模型权限或返回格式失败。

## English

Open **AI plan → My AI**. Enter your API base URL, model and key. OpenAI Responses and compatible Chat Completions are supported. Local servers without authentication can leave the key blank. Save does not contact the provider; Save & test sends a short model request and may incur a charge.

Answer only three questions: your goal, deadline and weekly hours. Attachments and detailed availability are optional. Review the proposed tasks and schedule before confirming. Keys use system encryption when available, otherwise they remain in memory for the current run only. Changing the API URL requires re-entering the key.

API format reference: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
