param([string]$DesktopDirectory = [Environment]::GetFolderPath('Desktop'))
$ErrorActionPreference = 'Stop'
$taskShortcutPath = Join-Path $DesktopDirectory 'Tracer Tasks.lnk'
$taskLauncher = Join-Path $PSScriptRoot 'start-tasks.ps1'
if (-not (Test-Path -LiteralPath $taskLauncher)) { throw 'Task launcher is missing.' }
$taskShell = New-Object -ComObject WScript.Shell
$taskShortcut = $taskShell.CreateShortcut($taskShortcutPath)
$taskArgs = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $taskLauncher + '"'
if ((Test-Path -LiteralPath $taskShortcutPath) -and $taskShortcut.Arguments -ne $taskArgs) {
    throw "A different shortcut already exists at $taskShortcutPath. Choose another DesktopDirectory."
}
$taskShortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
$taskShortcut.Arguments = $taskArgs
$taskShortcut.WorkingDirectory = $PSScriptRoot
$taskShortcut.IconLocation = (Join-Path $PSScriptRoot 'build\icon.ico') + ',0'
$taskShortcut.Description = 'Open the Tracer task board'
$taskShortcut.WindowStyle = 7
$taskShortcut.Save()
Write-Output $taskShortcutPath
