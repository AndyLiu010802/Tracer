param([int]$Port = 8081, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskUrl = "http://127.0.0.1:$Port/"
$taskMutex = New-Object System.Threading.Mutex($false, "Local\TracerTaskLauncher-$Port")
$taskLocked = $false
try {
    if ($Port -lt 1 -or $Port -gt 65535) { throw 'Invalid port.' }
    try { $taskLocked = $taskMutex.WaitOne(25000) }
    catch [System.Threading.AbandonedMutexException] { $taskLocked = $true }
    if (-not $taskLocked) { throw 'Another Tracer launch is still in progress. Please try again.' }
    function Test-TaskServer {
        try { $response = Invoke-WebRequest -UseBasicParsing -Uri $taskUrl -TimeoutSec 2 }
        catch { return $false }
        if ($response.Content -notmatch 'id="sec-board"' -or $response.Content -notmatch '<title>Tracer') {
            throw "Port $Port is used by another application. Start with -Port to choose another port."
        }
        return $true
    }
    if (-not (Test-TaskServer)) {
        $taskNode = (Get-Command node.exe -ErrorAction Stop).Source
        $env:DOCS_PORTAL_PORT = "$Port"
        $env:DOCS_PORTAL_HOST = '127.0.0.1'
        $env:DOCS_PORTAL_SKIN = 'tracer'
        $taskProcess = Start-Process -FilePath $taskNode -ArgumentList ('"' + (Join-Path $taskRoot 'server.js') + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRoot 'tasks-server.log') -RedirectStandardError (Join-Path $taskRoot 'tasks-server-error.log')
        $taskReady = $false
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            if (Test-TaskServer) { $taskReady = $true; break }
            if ($taskProcess.HasExited) { throw 'Tracer could not start. See tasks-server-error.log in the project folder.' }
            Start-Sleep -Milliseconds 250
        }
        if (-not $taskReady) { throw 'Tracer startup timed out. See tasks-server-error.log in the project folder.' }
    }
    if (-not $NoBrowser) { Start-Process -FilePath ($taskUrl + '?sec=board') }
    Write-Output ($taskUrl + '?sec=board')
} catch {
    if (-not $NoBrowser) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Tracer Tasks') | Out-Null
    }
    Write-Error $_
    exit 1
} finally {
    if ($taskLocked) { $taskMutex.ReleaseMutex() }
    $taskMutex.Dispose()
}
