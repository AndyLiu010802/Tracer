param([Parameter(Mandatory=$true)][string]$Source)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'output/desktop-brand'
Copy-Item -LiteralPath $Source -Destination (Join-Path $out 'tracer-logo-approved.png') -Force
$original = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source))
$frames = @()
try {
  foreach ($size in @(16,32,48,64,128,256,512)) {
    $bitmap = New-Object System.Drawing.Bitmap($size,$size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.Clear([System.Drawing.Color]::Black)
    $graphics.DrawImage($original,0,0,$size,$size)
    $destination = Join-Path $out "tracer-logo-$size.png"
    $bitmap.Save($destination,[System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose()
    if ($size -le 256) { $frames += ,@($size,[IO.File]::ReadAllBytes($destination)) }
  }
} finally { $original.Dispose() }
$ico = Join-Path $root 'build/app-icon.ico'
$stream = [IO.File]::Create($ico)
$writer = New-Object IO.BinaryWriter($stream)
try {
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
  $offset = 6 + 16 * $frames.Count
  foreach ($frame in $frames) {
    $side = if ($frame[0] -eq 256) { 0 } else { $frame[0] }
    $writer.Write([byte]$side); $writer.Write([byte]$side); $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$frame[1].Length); $writer.Write([uint32]$offset)
    $offset += $frame[1].Length
  }
  foreach ($frame in $frames) { $writer.Write([byte[]]$frame[1]) }
} finally { $writer.Dispose(); $stream.Dispose() }
Copy-Item (Join-Path $out 'tracer-logo-512.png') (Join-Path $root 'desktop/assets/app-icon.png') -Force
Copy-Item (Join-Path $out 'tracer-logo-512.png') (Join-Path $root 'build/app-icon.png') -Force
Copy-Item (Join-Path $out 'tracer-logo-128.png') (Join-Path $root 'public/tracer-logo.png') -Force
Copy-Item (Join-Path $out 'tracer-logo-32.png') (Join-Path $root 'desktop/assets/tray.png') -Force
Copy-Item (Join-Path $out 'tracer-logo-16.png') (Join-Path $root 'desktop/assets/tray-16.png') -Force
Copy-Item $ico (Join-Path $out 'Tracer-Approved.ico') -Force
Write-Output 'Approved logo converted to PNG sizes and multi-resolution ICO.'
