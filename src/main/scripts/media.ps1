# Polls Windows' global media session (Spotify, browsers, etc.) and prints one JSON line per tick.
# Commands are read from the file passed as -CmdFile (play/next/prev), written by the Electron main process.
param([string]$CmdFile)
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) {
  $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $t.Wait(-1) | Out-Null
  $t.Result
}
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStreamWithContentType,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IInputStream,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null
# PowerShell can't bind the WinRT stream to AsStreamForRead directly, so call it via reflection.
$asStreamForRead = [System.IO.WindowsRuntimeStreamExtensions].GetMethod('AsStreamForRead', [type[]]@([Windows.Storage.Streams.IInputStream]))
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$lastKey = ''
while ($true) {
  $s = $mgr.GetCurrentSession()
  if ($CmdFile -and (Test-Path $CmdFile)) {
    $cmd = (Get-Content $CmdFile -Raw).Trim()
    Remove-Item $CmdFile -Force
    if ($s) {
      switch ($cmd) {
        'play' { Await ($s.TryTogglePlayPauseAsync()) ([bool]) | Out-Null }
        'next' { Await ($s.TrySkipNextAsync()) ([bool]) | Out-Null }
        'prev' { Await ($s.TrySkipPreviousAsync()) ([bool]) | Out-Null }
      }
      Start-Sleep -Milliseconds 300
    }
  }
  if (-not $s) {
    [Console]::Out.WriteLine('{"active":false}'); [Console]::Out.Flush()
    Start-Sleep -Seconds 2; continue
  }
  $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $tl = $s.GetTimelineProperties()
  $out = [ordered]@{
    active   = $true
    app      = $s.SourceAppUserModelId
    title    = $p.Title
    artist   = $p.Artist
    album    = $p.AlbumTitle
    status   = $s.GetPlaybackInfo().PlaybackStatus.ToString()
    position = $tl.Position.TotalSeconds
    duration = $tl.EndTime.TotalSeconds
    updated  = $tl.LastUpdatedTime.ToUnixTimeMilliseconds()
  }
  $key = "$($p.Title)|$($p.Artist)"
  if ($key -ne $lastKey -and $p.Thumbnail) {
    try {
      $stream = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
      $net = $asStreamForRead.Invoke($null, @($stream))
      $ms = New-Object IO.MemoryStream
      $net.CopyTo($ms)
      $out.thumb = 'data:image/png;base64,' + [Convert]::ToBase64String($ms.ToArray())
    } catch {}
    $lastKey = $key
  }
  [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress)); [Console]::Out.Flush()
  Start-Sleep -Milliseconds 1000
}
