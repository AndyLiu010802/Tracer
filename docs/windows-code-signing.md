# Windows 代码签名

状态：已接入本地 Windows 证书库签名构建和签后验证；尚无签发证书，因此尚未生成可信签名安装包。GitHub 上已发布的 0.4.5 仍未签名。

## 澳大利亚个人申请

截至 2026-10-12，Microsoft Artifact Signing 的 Public Trust 个人申请仅支持美国、加拿大；澳大利亚在组织申请地区列表内，不适用于当前个人身份。[微软申请条件](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)

可考察 Certum **Standard Code Signing in the Cloud**：官方列明支持个人，使用 SimplySign Desktop 将云端密钥接入 Windows 签名工具。商店页面当前显示起价 €209；具体期限、含税总额、供货情况及澳大利亚身份材料能否受理应在下单前确认。官方不同页面存在起价差异，不应直接按营销页价格付款。[产品页面](https://shop.certum.eu/standard-code-signing-in-the-cloud.html?___store=certum_en)

申请时使用真实个人姓名和地址，提交签发方要求的有效身份证明及本人地址证明。材料应上传到签发机构的账户页面；不要提交到本仓库或聊天。Certum 普通个人证书需要本人名下账单等材料，最终以审核要求为准。[材料要求](https://support.certum.eu/en/code-signing-required-documents/)

签名验证发布者和文件完整性。新签名应用仍可能出现 SmartScreen 提示，不能承诺签名后立即消除所有提示。[微软签名方案](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)

## 获批后接入

1. 根据签发方指引安装并登录云证书客户端，或连接硬件令牌，使证书和私钥提供程序可从 Windows 证书库访问。
2. 读取证书指纹（不会导出私钥）：

```powershell
Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
  Select-Object Subject, Thumbprint, NotAfter, HasPrivateKey
```

3. 设置本次构建的证书指纹，先检查，再生成安装包：

```powershell
$env:TRACER_WINDOWS_CERT_SHA1 = '替换为证书的40位指纹'
npm run sign:check
npm run dist:win:signed
```

私钥保留在签发方云端或硬件内，项目仅使用公开证书指纹定位它。指纹中的 SHA1 是证书标识；文件签名使用 SHA-256 和 RFC 3161 时间戳。

`sign:check` 检查私钥访问、有效期、代码签名用途及在线证书链验证。签名构建启用 `forceCodeSigning`，失败即停止；应用、安装器和卸载器经过 electron-builder 签名路径。官方 Codex 运行时保持原始字节及其发布者身份，仅当哈希与固定清单一致时跳过重签。

构建后必须确认主程序和安装包的 Authenticode 状态为 `Valid`、签名证书指纹匹配且带时间戳，再执行包内源文件、隐私、运行时校验并生成 SHA-256。输出为 `dist/signed/<版本>/`，已有目录会拒绝覆盖，验证记录保存在 `signing-verification.json`。

发布签名版时递增版本，重新进行打包实测并上传完整 EXE、blockmap 和 SHA256SUMS。不能直接替换 0.4.5 的 EXE 而沿用旧校验文件。

此入口适配当前 electron-builder 26.15.3；升级构建工具时需要重跑 `test/windows-signing.test.js`。现有 `npm run dist` 是原普通构建入口，GitHub Actions 尚未接入云证书登录；不要把普通构建或现有 CI 输出宣称为已签名。
