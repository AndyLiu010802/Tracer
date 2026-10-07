# This fixed helper accepts six Tracer keys and two shared ancestors. It is not
# an arbitrary registry CLI. The caller must opt in with a trusted executor.
# No execution-policy changes, administrator rights or Explorer restart.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$rootName = 'HKCU\Software\Classes\DesktopBackground\Shell'
$rootRelative = 'Software\Classes\DesktopBackground\Shell'
$ownerName = 'Tracer.LocalEffects.v1'
$labels = @{ release = 'Tracer: Release selected local effect'; cancel = 'Tracer: Cancel local effect'; configure = 'Tracer: Local effect settings' }
$wanted = $null
$leafTransaction = [IntPtr]::Zero
$parentKeys = @('HKCU\Software\Classes\DesktopBackground', 'HKCU\Software\Classes\DesktopBackground\Shell')
$parentMarker = 'TracerLocalEffectsParent'

function Initialize-Transactions {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;
public static class TracerRegistryTransaction {
  [DllImport("KtmW32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern IntPtr CreateTransaction(IntPtr attributes, IntPtr unitOfWork, uint options, uint isolation, uint flags, uint timeout, string description);
  [DllImport("KtmW32.dll", SetLastError=true)] static extern bool CommitTransaction(IntPtr transaction);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode)]
  static extern int RegOpenKeyTransacted(SafeRegistryHandle parent, string key, int options, int access, out SafeRegistryHandle result, IntPtr transaction, IntPtr reserved);
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode)]
  static extern int RegCreateKeyTransacted(SafeRegistryHandle parent, string key, int reserved, string cls, int options, int access, IntPtr security, out SafeRegistryHandle result, out int disposition, IntPtr transaction, IntPtr extended);
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode)]
  static extern int RegDeleteKeyTransacted(SafeRegistryHandle parent, string key, int access, int reserved, IntPtr transaction, IntPtr extended);
  public sealed class CreatedKey { public RegistryKey Key; public int Disposition; }
  public static IntPtr Begin() {
    IntPtr result = CreateTransaction(IntPtr.Zero, IntPtr.Zero, 0, 0, 0, 4000, "Tracer local menu shared ancestor");
    if (result == new IntPtr(-1) || result == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    return result;
  }
  public static RegistryKey Open(RegistryKey parent, string key, IntPtr transaction) {
    SafeRegistryHandle result;
    int error = RegOpenKeyTransacted(parent.Handle, key, 0, 0x3001F, out result, transaction, IntPtr.Zero);
    if (error == 2) { if (result != null) result.Dispose(); return null; }
    if (error != 0) { if (result != null) result.Dispose(); throw new System.ComponentModel.Win32Exception(error); }
    return RegistryKey.FromHandle(result, RegistryView.Default);
  }
  public static CreatedKey Create(RegistryKey parent, string leaf, IntPtr transaction) {
    if (leaf.IndexOf('\\') >= 0) throw new InvalidOperationException("registry-protocol-invalid");
    SafeRegistryHandle result; int disposition;
    int error = RegCreateKeyTransacted(parent.Handle, leaf, 0, null, 0, 0x3001F, IntPtr.Zero, out result, out disposition, transaction, IntPtr.Zero);
    if (error != 0) { if (result != null) result.Dispose(); throw new System.ComponentModel.Win32Exception(error); }
    return new CreatedKey { Key = RegistryKey.FromHandle(result, RegistryView.Default), Disposition = disposition };
  }
  public static void Delete(RegistryKey parent, string leaf, IntPtr transaction) {
    int error = RegDeleteKeyTransacted(parent.Handle, leaf, 0, 0, transaction, IntPtr.Zero);
    if (error != 0) throw new System.ComponentModel.Win32Exception(error);
  }
  public static void Commit(IntPtr transaction) {
    if (!CommitTransaction(transaction)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  }
  public static void Close(IntPtr transaction) { CloseHandle(transaction); }
}
'@ | Out-Null
}

function Read-Parent([string] $key, $token) {
  $handle = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($key.Substring(5), $false)
  if ($null -eq $handle) { return $null }
  try {
    $names = @($handle.GetValueNames()); $owned = $false
    # Shared keys disclose counts only. Never read any foreign value data.
    if ($null -ne $token -and $names -ccontains $parentMarker -and $handle.GetValueKind($parentMarker) -eq [Microsoft.Win32.RegistryValueKind]::String) {
      $owned = $handle.GetValue($parentMarker, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -ceq $token
    }
    return [pscustomobject]@{ valueCount = ($names.Count - [int]$owned); childCount = @($handle.GetSubKeyNames()).Count; owned = $owned }
  } finally { $handle.Dispose() }
}

function Invoke-Parent($request) {
  if ($parentKeys -cnotcontains $request.key -or (Has-Property $request 'expected') -or (Has-Property $request 'values')) { Stop-Code 'registry-protocol-invalid' }
  $token = $null
  if (Has-Property $request 'token') {
    if ($request.token -isnot [string] -or $request.token -cnotmatch '^[a-f0-9]{64}$') { Stop-Code 'registry-protocol-invalid' }
    $token = $request.token
  }
  if ($request.action -ceq 'parent-read') {
    $node = Read-Parent $request.key $token
    return [pscustomobject]@{ ok = $true; present = ($null -ne $node); node = $node }
  }
  if ($null -eq $token) { Stop-Code 'registry-protocol-invalid' }
  Initialize-Transactions
  $transaction = [TracerRegistryTransaction]::Begin(); $parent = $null; $handle = $null
  try {
    $split = $request.key.LastIndexOf('\'); $leafName = $request.key.Substring($split + 1)
    # Open an existing direct parent. Neither Software\Classes nor an existing
    # intermediate key is ever implicitly created by a path-shaped subkey.
    $parent = [TracerRegistryTransaction]::Open([Microsoft.Win32.Registry]::CurrentUser, $request.key.Substring(5, $split - 5), $transaction)
    if ($null -eq $parent) {
      if ($request.action -ceq 'parent-remove') { return [pscustomobject]@{ ok = $true; removed = $false; reason = 'missing' } }
      Stop-Code 'registry-parent-missing'
    }
    if ($request.action -ceq 'parent-create') {
      $created = [TracerRegistryTransaction]::Create($parent, $leafName, $transaction); $handle = $created.Key
      if ($created.Disposition -ne 1) { return [pscustomobject]@{ ok = $true; created = $false; disposition = 'opened-existing' } }
      if (@($handle.GetValueNames()).Count -ne 0 -or @($handle.GetSubKeyNames()).Count -ne 0) { Stop-Code 'local-menu-conflict' }
      $handle.SetValue($parentMarker, $token, [Microsoft.Win32.RegistryValueKind]::String)
      [TracerRegistryTransaction]::Commit($transaction)
      return [pscustomobject]@{ ok = $true; created = $true; disposition = 'created-new' }
    }
    $handle = [TracerRegistryTransaction]::Open($parent, $leafName, $transaction)
    if ($null -eq $handle) { return [pscustomobject]@{ ok = $true; removed = $false; reason = 'missing' } }
    $names = @($handle.GetValueNames())
    if ($names -cnotcontains $parentMarker -or $handle.GetValueKind($parentMarker) -ne [Microsoft.Win32.RegistryValueKind]::String -or
        $handle.GetValue($parentMarker, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -cne $token) {
      return [pscustomobject]@{ ok = $true; removed = $false; reason = 'conflict' }
    }
    if ($names.Count -ne 1 -or @($handle.GetSubKeyNames()).Count -ne 0) { return [pscustomobject]@{ ok = $true; removed = $false; reason = 'not-empty' } }
    $handle.DeleteValue($parentMarker, $true)
    if (@($handle.GetValueNames()).Count -ne 0 -or @($handle.GetSubKeyNames()).Count -ne 0) { Stop-Code 'local-menu-conflict' }
    [TracerRegistryTransaction]::Delete($parent, $leafName, $transaction)
    # This commit is the concurrency gate: a competing key/value write makes
    # the transaction fail. Never fall back to non-transacted DeleteSubKey.
    [TracerRegistryTransaction]::Commit($transaction)
    return [pscustomobject]@{ ok = $true; removed = $true }
  } finally {
    if ($null -ne $handle) { $handle.Dispose() }; if ($null -ne $parent) { $parent.Dispose() }
    [TracerRegistryTransaction]::Close($transaction)
  }
}

function Stop-Code([string] $code) { throw (New-Object System.InvalidOperationException($code)) }
function Has-Property($object, [string] $name) { return $null -ne $object.PSObject.Properties[$name] }
function Assert-Properties($object, [string[]] $required, [string[]] $allowed) {
  if ($null -eq $object -or $object -isnot [System.Management.Automation.PSCustomObject]) { Stop-Code 'registry-protocol-invalid' }
  foreach ($property in $object.PSObject.Properties) { if ($allowed -cnotcontains $property.Name) { Stop-Code 'registry-protocol-invalid' } }
  foreach ($property in $required) { if (-not (Has-Property $object $property)) { Stop-Code 'registry-protocol-invalid' } }
}
function Safe-SourcePath($value, [bool] $executable) {
  if ($value -isnot [string] -or $value.Length -gt 30000 -or $value -match '[\x00-\x1f"%]' -or $value -notmatch '^[A-Za-z]:[\\/]' -or $value.StartsWith('\\')) { Stop-Code 'registry-protocol-invalid' }
  $normal = [IO.Path]::GetFullPath($value.Replace('/', '\'))
  if ($normal.EndsWith('\', [StringComparison]::Ordinal)) { Stop-Code 'registry-protocol-invalid' }
  if ($executable -and -not $normal.EndsWith('.exe', [StringComparison]::OrdinalIgnoreCase)) { Stop-Code 'registry-protocol-invalid' }
  return $normal
}
function New-Node($values, $children) {
  return [pscustomobject]@{ values = @($values); children = @($children) }
}
function Copy-Node($node) {
  if ($null -eq $node) { return $null }
  return New-Node @($node.values | ForEach-Object { [pscustomobject]@{ name = $_.name; kind = $_.kind; data = $_.data } }) @($node.children)
}
function Equal-Node($left, $right) {
  if ($null -eq $left -or $null -eq $right) { return $null -eq $left -and $null -eq $right }
  if (@($left.values).Count -ne @($right.values).Count -or @($left.children).Count -ne @($right.children).Count) { return $false }
  foreach ($value in $left.values) {
    $matches = @($right.values | Where-Object { $_.name -ceq $value.name })
    if ($matches.Count -ne 1 -or $matches[0].kind -cne $value.kind -or $matches[0].data -cne $value.data) { return $false }
  }
  foreach ($child in $left.children) { if ($right.children -cnotcontains $child) { return $false } }
  return $true
}
function Assert-Node($node, $schema, [bool] $requireComplete) {
  if ($null -eq $node) { return }
  Assert-Properties $node @('values', 'children') @('values', 'children')
  if ($node.values -isnot [array] -or $node.children -isnot [array]) { Stop-Code 'registry-protocol-invalid' }
  $names = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($value in $node.values) {
    Assert-Properties $value @('name', 'kind', 'data') @('name', 'kind', 'data')
    if ($value.name -isnot [string] -or -not $names.Add($value.name) -or $value.kind -cne 'String' -or $value.data -isnot [string]) { Stop-Code 'registry-protocol-invalid' }
    $matches = @($schema.values | Where-Object { $_.name -ceq $value.name })
    if ($matches.Count -ne 1 -or $matches[0].data -cne $value.data) { Stop-Code 'local-menu-conflict' }
  }
  if ($requireComplete -and $node.values.Count -ne $schema.values.Count) { Stop-Code 'local-menu-conflict' }
  if ($node.children.Count -gt 1) { Stop-Code 'local-menu-conflict' }
  foreach ($child in $node.children) { if ($child -isnot [string] -or $schema.children -cnotcontains $child) { Stop-Code 'local-menu-conflict' } }
}
function Open-Owned([string] $relative, [bool] $write) {
  if ($script:leafTransaction -ne [IntPtr]::Zero) {
    return [TracerRegistryTransaction]::Open([Microsoft.Win32.Registry]::CurrentUser, $relative, $script:leafTransaction)
  }
  return [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($relative, $write)
}
function Begin-OwnedMutation {
  Initialize-Transactions
  $script:leafTransaction = [TracerRegistryTransaction]::Begin()
}
function Read-Node([string] $key) {
  if (@($script:schemas.Keys) -cnotcontains $key) { Stop-Code 'registry-protocol-invalid' }
  $schema = $script:schemas[$key]
  $relative = $key.Substring(5)
  $handle = $null
  try {
    $handle = Open-Owned $relative $false
    if ($null -eq $handle) { return $null }
    # Inspect names and kinds first. An unrelated registration may hold large
    # or private values; do not retrieve any unrecognized value data.
    $names = @($handle.GetValueNames())
    $children = @($handle.GetSubKeyNames())
    if ($names.Count -gt $schema.values.Count -or $children.Count -gt $schema.children.Count) { Stop-Code 'local-menu-conflict' }
    foreach ($child in $children) { if ($schema.children -cnotcontains $child) { Stop-Code 'local-menu-conflict' } }
    foreach ($name in $names) {
      if (@($schema.values | Where-Object { $_.name -ceq $name }).Count -ne 1 -or $handle.GetValueKind($name) -ne [Microsoft.Win32.RegistryValueKind]::String) { Stop-Code 'local-menu-conflict' }
    }
    $values = @()
    foreach ($name in $names) {
      $kind = $handle.GetValueKind($name).ToString()
      $data = $handle.GetValue($name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
      # Unexpected value kinds are returned intact enough to reject them. Never
      # coerce an expandable path, DWORD or binary value into an owned REG_SZ.
      $values += [pscustomobject]@{ name = $name; kind = $kind; data = $data }
    }
    return New-Node $values $children
  } finally { if ($null -ne $handle) { $handle.Dispose() } }
}
function Assert-Current([string] $key, $expected) {
  if (-not (Equal-Node (Read-Node $key) $expected)) { Stop-Code 'local-menu-conflict' }
}
function Assert-CommandParent([string] $key, $expected, [string] $action) {
  if (-not $key.EndsWith('\command', [StringComparison]::Ordinal)) { return }
  $parentKey = $key.Substring(0, $key.Length - 8)
  if (@($script:schemas.Keys) -cnotcontains $parentKey) { Stop-Code 'registry-protocol-invalid' }
  $parentExpected = Copy-Node $script:schemas[$parentKey]
  if ($action -ceq 'write' -and $null -eq $expected) { $parentExpected.children = @() }
  else { $parentExpected.children = @('command') }
  Assert-Current $parentKey $parentExpected
}
function Open-ForWrite([string] $key) {
  $handle = Open-Owned $key.Substring(5) $true
  if ($null -eq $handle) { Stop-Code 'local-menu-conflict' }
  return $handle
}
function Delete-EmptyKey([string] $key) {
  Assert-Current $key (New-Node @() @())
  Assert-CommandParent $key (New-Node @() @()) 'remove'
  $split = $key.LastIndexOf('\')
  $parent = Open-Owned $key.Substring(5, $split - 5) $true
  if ($null -eq $parent) { Stop-Code 'local-menu-conflict' }
  try {
    # Count checks and deletion belong to the same registry transaction.
    # A concurrent value or child addition cannot be lost by path deletion.
    [TracerRegistryTransaction]::Delete($parent, $key.Substring($split + 1), $script:leafTransaction)
  } finally { $parent.Dispose() }
  if ($null -ne (Read-Node $key)) { Stop-Code 'local-menu-conflict' }
}
function Set-TrackedValue([string] $key, $before, $value) {
  Assert-Current $key $before
  Assert-CommandParent $key $before 'write'
  $after = Copy-Node $before
  $existing = @($after.values | Where-Object { $_.name -ceq $value.name })
  if ($existing.Count -gt 0) { $existing[0].data = $value.data; $existing[0].kind = $value.kind }
  else { $after.values = @($after.values) + [pscustomobject]@{ name = $value.name; kind = $value.kind; data = $value.data } }
  # A failed writer stays inside the transaction and is rolled back on close.
  $handle = Open-ForWrite $key
  try { $handle.SetValue($value.name, $value.data, [Microsoft.Win32.RegistryValueKind]::String) } finally { $handle.Dispose() }
  if (-not (Equal-Node (Read-Node $key) $after)) { Stop-Code 'local-menu-conflict' }
  return $after
}
function Invoke-Request {
  $inputText = [Console]::In.ReadToEnd()
  if ($inputText.Length -eq 0 -or $inputText.Length -gt 1048576) { Stop-Code 'registry-protocol-invalid' }
  try { $request = $inputText | ConvertFrom-Json } catch { Stop-Code 'registry-protocol-invalid' }
  Assert-Properties $request @('version', 'action', 'key', 'launch') @('version', 'action', 'key', 'launch', 'expected', 'values', 'token')
  if ($request.version -isnot [int] -or $request.version -ne 1 -or $request.action -isnot [string] -or @('read', 'write', 'remove', 'parent-read', 'parent-create', 'parent-remove') -cnotcontains $request.action -or $request.key -isnot [string]) { Stop-Code 'registry-protocol-invalid' }
  Assert-Properties $request.launch @('kind', 'executable', 'appPath') @('kind', 'executable', 'appPath')
  if ($request.launch.kind -cne 'source') { Stop-Code 'registry-protocol-invalid' }
  $executable = Safe-SourcePath $request.launch.executable $true
  $appPath = Safe-SourcePath $request.launch.appPath $false
  $fixedApp = Safe-SourcePath ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))) $false
  $fixedExe = Safe-SourcePath (Join-Path $fixedApp 'node_modules\electron\dist\electron.exe') $true
  if (-not $appPath.Equals($fixedApp, [StringComparison]::OrdinalIgnoreCase) -or -not $executable.Equals($fixedExe, [StringComparison]::OrdinalIgnoreCase)) { Stop-Code 'registry-protocol-invalid' }
  $appPath = $fixedApp; $executable = $fixedExe
  if ($request.action.StartsWith('parent-', [StringComparison]::Ordinal)) { return Invoke-Parent $request }
  if (Has-Property $request 'token') { Stop-Code 'registry-protocol-invalid' }
  $script:schemas = @{}
  foreach ($action in @('release', 'cancel', 'configure')) {
    $name = 'Tracer.LocalEffects.' + $action.Substring(0, 1).ToUpperInvariant() + $action.Substring(1)
    $key = $rootName + '\' + $name
    $command = '"' + $executable + '" "' + $appPath + '" "--tracer-local-action=' + $action + '"'
    $schemas[$key] = New-Node @(
      [pscustomobject]@{ name = ''; kind = 'String'; data = $labels[$action] },
      [pscustomobject]@{ name = 'Position'; kind = 'String'; data = 'Bottom' },
      [pscustomobject]@{ name = 'TracerOwner'; kind = 'String'; data = $ownerName },
      [pscustomobject]@{ name = 'TracerCommand'; kind = 'String'; data = $command }
    ) @('command')
    $schemas[$key + '\command'] = New-Node @(
      [pscustomobject]@{ name = ''; kind = 'String'; data = $command },
      [pscustomobject]@{ name = 'TracerOwner'; kind = 'String'; data = $ownerName }
    ) @()
  }
  # Hashtable lookup is case-insensitive, so require the exact minted spelling.
  if (@($schemas.Keys) -cnotcontains $request.key) { Stop-Code 'registry-protocol-invalid' }
  $script:wanted = $schemas[$request.key]
  if ($request.action -ceq 'read') {
    if ((Has-Property $request 'expected') -or (Has-Property $request 'values')) { Stop-Code 'registry-protocol-invalid' }
    $node = Read-Node $request.key
    return [pscustomobject]@{ ok = $true; present = ($null -ne $node); node = $node }
  }
  if (-not (Has-Property $request 'expected')) { Stop-Code 'registry-protocol-invalid' }
  Assert-Node $request.expected $wanted $false
  # Snapshot comparison, parent ownership, all value writes and leaf deletion
  # are isolated until commit. Close without commit rolls back a partial write.
  Begin-OwnedMutation
  if ($request.action -ceq 'remove') {
    if ((Has-Property $request 'values') -or $null -eq $request.expected -or @($request.expected.children).Count -ne 0) { Stop-Code 'registry-protocol-invalid' }
    Assert-Node $request.expected $wanted $true
    Assert-Current $request.key $request.expected
    Assert-CommandParent $request.key $request.expected 'remove'
    # Remove owned values individually with checks; never recursively delete.
    $before = Copy-Node $request.expected
    foreach ($value in @($wanted.values)) {
      Assert-Current $request.key $before
      Assert-CommandParent $request.key $before 'remove'
      $after = Copy-Node $before
      $after.values = @($after.values | Where-Object { $_.name -cne $value.name })
      $handle = Open-ForWrite $request.key
      try { $handle.DeleteValue($value.name, $false) } finally { $handle.Dispose() }
      Assert-Current $request.key $after
      $before = $after
    }
    Delete-EmptyKey $request.key
    return [pscustomobject]@{ ok = $true; present = $false; node = $null }
  }
  if (-not (Has-Property $request 'values') -or $request.values -isnot [array]) { Stop-Code 'registry-protocol-invalid' }
  $target = New-Node @($request.values) @()
  Assert-Node $target $wanted $true
  Assert-Current $request.key $request.expected
  Assert-CommandParent $request.key $request.expected 'write'
  $before = Copy-Node $request.expected
  if ($null -eq $before) {
    $split = $request.key.LastIndexOf('\')
    $parentRelative = $request.key.Substring(5, $split - 5)
    $parent = Open-Owned $parentRelative $true
    # Create only this leaf under an existing parent. Disposition distinguishes
    # our new key from a foreign empty key that appeared after preflight.
    if ($null -eq $parent) { Stop-Code 'registry-parent-missing' }
    try {
      $created = [TracerRegistryTransaction]::Create($parent, $request.key.Substring($split + 1), $script:leafTransaction)
      try { if ($created.Disposition -ne 1) { Stop-Code 'local-menu-conflict' } }
      finally { $created.Key.Dispose() }
    } finally { $parent.Dispose() }
    $before = New-Node @() @()
    Assert-Current $request.key $before
  }
  foreach ($value in $wanted.values) { $before = Set-TrackedValue $request.key $before $value }
  Assert-Current $request.key $before
  return [pscustomobject]@{ ok = $true; present = $true; node = $before }
}

try {
  $result = Invoke-Request
  if ($leafTransaction -ne [IntPtr]::Zero) { [TracerRegistryTransaction]::Commit($leafTransaction) }
} catch {
  $failure = $_.Exception
  while ($null -ne $failure.InnerException) { $failure = $failure.InnerException }
  $code = $failure.Message
  if ($code -cnotin @('registry-protocol-invalid', 'registry-parent-missing', 'local-menu-conflict')) {
    if ($failure -is [UnauthorizedAccessException] -or $failure -is [System.Security.SecurityException] -or ($failure -is [System.ComponentModel.Win32Exception] -and $failure.NativeErrorCode -eq 5)) { $code = 'registry-access-denied' }
    else { $code = 'registry-operation-failed' }
  }
  if ($failure -is [System.ComponentModel.Win32Exception] -and $failure.NativeErrorCode -eq 6800) { $code = 'local-menu-conflict' }
  $result = [pscustomobject]@{ ok = $false; error = $code }
} finally {
  if ($leafTransaction -ne [IntPtr]::Zero) { [TracerRegistryTransaction]::Close($leafTransaction) }
}
[Console]::Out.Write(($result | ConvertTo-Json -Depth 12 -Compress))
exit 0
