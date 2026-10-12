param(
  [Parameter(Mandatory=$true)][ValidateSet('certificate','artifacts')][string]$Mode,
  [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{40}$')][string]$Thumbprint,
  [string]$Application,
  [string]$Installer
)
$ErrorActionPreference = 'Stop'
if ($Mode -eq 'certificate') {
  $matches = @(Get-ChildItem Cert:\CurrentUser\My, Cert:\LocalMachine\My -CodeSigningCert | Where-Object { $_.Thumbprint -eq $Thumbprint })
  $cert = $matches | Where-Object { $_.HasPrivateKey } | Select-Object -First 1
  if (-not $cert) { throw 'The selected code-signing certificate and accessible private key were not found. Connect the hardware token or sign in to the cloud certificate client first.' }
  if ($cert.NotBefore -gt (Get-Date) -or $cert.NotAfter -le (Get-Date)) { throw 'The code-signing certificate is not currently valid.' }
  if ($cert.Subject -eq $cert.Issuer) { throw 'A self-signed certificate is not accepted for public releases.' }
  $chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
  try {
    $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::Online
    $chain.ChainPolicy.UrlRetrievalTimeout = [TimeSpan]::FromSeconds(20)
    $null = $chain.ChainPolicy.ApplicationPolicy.Add((New-Object System.Security.Cryptography.Oid('1.3.6.1.5.5.7.3.3')))
    if (-not $chain.Build($cert)) { throw ('Certificate trust validation failed: ' + (($chain.ChainStatus | ForEach-Object { $_.Status.ToString() }) -join ', ')) }
    [pscustomobject]@{ valid=$true; subject=$cert.Subject; thumbprint=$cert.Thumbprint; expires=$cert.NotAfter.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress
  } finally { $chain.Dispose() }
} else {
  $records = @()
  foreach ($file in @($Application, $Installer)) {
    if (-not $file -or -not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'Application or installer is missing.' }
    $sig = Get-AuthenticodeSignature -LiteralPath $file
    if ($sig.Status -ne 'Valid') { throw ('Invalid Authenticode signature on ' + [IO.Path]::GetFileName($file) + ': ' + $sig.Status) }
    if ($sig.SignerCertificate.Thumbprint -ne $Thumbprint) { throw 'The signed file has a different publisher certificate.' }
    if (-not $sig.TimeStamperCertificate) { throw 'A trusted timestamp is required.' }
    $records += [pscustomobject]@{ file=[IO.Path]::GetFullPath($file); status=$sig.Status.ToString(); thumbprint=$sig.SignerCertificate.Thumbprint; subject=$sig.SignerCertificate.Subject; timestampSubject=$sig.TimeStamperCertificate.Subject }
  }
  ConvertTo-Json -InputObject $records -Depth 4 -Compress
}
