# Keeps modeluniverse.vn up on this host, 24/7 (scripts/host/README.md). Started at boot by the scheduled task
# "ModelUniverse Host" (as SYSTEM, so no login is needed); checks every 30 s that one web process serves the published
# release on 6050 and that a tunnel connector runs, and restarts whichever is missing. A web that is briefly absent
# (e.g. during deploy-zero-downtime.ps1) gets 60 s of grace before the supervisor starts one itself.
$ErrorActionPreference = 'Continue'
$app = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\apps\web-ecommerce'))
$runtime = (Select-String -LiteralPath (Join-Path $app '.env.production.local') -Pattern '^MODEL_UNIVERSE_RUNTIME_DIR=(.+)$').Matches[0].Groups[1].Value.Trim().Trim('"').Trim("'")
$hostDir = Join-Path $runtime 'host'
New-Item -ItemType Directory -Path $hostDir -Force | Out-Null
$config = Get-Content (Join-Path $hostDir 'host.json') -Raw | ConvertFrom-Json  # node, cloudflared, tunnelConfig
function Log($message) { Add-Content -Path (Join-Path $hostDir 'host.log') -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message" }
function Web-Processes {
  @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '\.next[^\s''"]*[\\/]server\.js' })
}
function Healthy {
  try { (Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:6050/api/products/filters' -TimeoutSec 15).StatusCode -eq 200 } catch { $false }
}
function Start-Web {
  $release = Get-Content (Join-Path $runtime 'release.json') -Raw | ConvertFrom-Json
  $env:NODE_ENV = 'production'; $env:PORT = '6050'; $env:NEXT_DIST_DIR = $release.nextDist
  $stamp = Get-Date -Format yyyyMMdd-HHmmss
  Start-Process -FilePath $config.node -ArgumentList "$($release.nextDist)\server.js" -WorkingDirectory $app -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $hostDir "web-$stamp.log") -RedirectStandardError (Join-Path $hostDir "web-$stamp.err.log") | Out-Null
  Log "web started (release $($release.commit))"
}
function Start-Tunnel {
  Start-Process -FilePath $config.cloudflared -WindowStyle Hidden -ArgumentList '--no-autoupdate', '--logfile', (Join-Path $hostDir 'cloudflared.log'),
    '--config', $config.tunnelConfig, 'tunnel', 'run', 'model-universe' | Out-Null
  Log 'tunnel connector started'
}

Log 'supervisor started'
$missing = 0; $unhealthy = 0; $noTunnel = 0
while ($true) {
  $webs = Web-Processes
  if ($webs.Count -eq 0) {
    $missing++; $unhealthy = 0
    if ($missing -ge 2) { Start-Web; $missing = 0; Start-Sleep -Seconds 60 }
  } else {
    $missing = 0
    if (Healthy) { $unhealthy = 0 } else {
      $unhealthy++
      if ($unhealthy -ge 5) {  # 2.5 minutes without an answer: restart it
        Log 'web not answering: restarting'
        $webs | ForEach-Object { taskkill /PID $_.ProcessId /T /F | Out-Null }
        Start-Sleep -Seconds 3; Start-Web; $unhealthy = 0; Start-Sleep -Seconds 60
      }
    }
  }
  if (@(Get-Process cloudflared -ErrorAction SilentlyContinue).Count -eq 0) {
    $noTunnel++
    if ($noTunnel -ge 2) { Start-Tunnel; $noTunnel = 0 }
  } else { $noTunnel = 0 }
  Start-Sleep -Seconds 30
}
