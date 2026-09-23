# 本机测试金币

测试补款只针对指定工作区，不改变新用户的初始金币，也不创建虚假的任务、收获或成就。款项保存在 `taskGarden.market.testCredit`，购买时正常扣币，关闭或重开软件不会自动补满。

关闭 Tracer 后执行：

```powershell
node dev/set-test-coins.cjs "完整的工作区路径/workspace.json" 100000
```

省略金额时默认将余额补到 100,000。脚本先校验存档，再创建带时间戳的 `.before-test-coins-*.bak` 备份，通过临时文件替换原存档；检测到并发修改会终止，不覆盖更新。已达到目标余额时不会重复补款。

本机账户的工作区通常位于 `%APPDATA%/tracer-desktop/data/.accounts/<账户 ID>/data/workspace.json`，游客工作区为 `%APPDATA%/tracer-desktop/data/workspace.json`。请选择需要测试的账户。

服务器保存保留已接受的补款记录，普通工作区提交不能自行创建或增加测试补款；旧窗口保存也不会清除它。`test/test-coins.test.js` 覆盖备份、重复运行、购买扣费、重新补款、账户隔离及保存校验。
