# Switches the live site (named Cloudflare tunnel "model-universe" -> 127.0.0.1:6050) to the release published by
# `yarn build:production` (MODEL_UNIVERSE_RUNTIME_DIR\release.json) without dropping requests, keeping the rule that
# real commerce runs as a single web process on port 6050 (StartupValidation):
#   1. a holding proxy on 6049 -> 6050 (scripts/hold-proxy.cjs) and a second tunnel connector routed to it; the old
#      connector is retired, so all traffic flows through the proxy;
#   2. the web on 6050 is replaced; the proxy holds requests meanwhile instead of failing them;
#   3. the usual connector (~/.cloudflared/config.yml, direct to 6050) comes back; the proxy path is retired.
# Requests in flight on a connector when it is force-stopped can still fail (Windows offers no graceful stop).
# Build first with: $env:MODEL_UNIVERSE_BUILD_SNAPSHOT = 'true'; yarn build:production
$ErrorActionPreference = 'Stop'
$app = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtime = (Select-String -LiteralPath (Join-Path $app '.env.production.local') -Pattern '^MODEL_UNIVERSE_RUNTIME_DIR=(.+)$' |
  Select-Object -First 1).Matches[0].Groups[1].Value.Trim().Trim('"').Trim("'")
$work = Join-Path $runtime 'deploy'
New-Item -ItemType Directory -Path $work -Force | Out-Null
$cloudflared = if ($env:CLOUDFLARED_PATH) { $env:CLOUDFLARED_PATH } else { 'C:\Program Files (x86)\cloudflared\cloudflared.exe' }
$release = Get-Content (Join-Path $runtime 'release.json') -Raw | ConvertFrom-Json
$dist = $release.nextDist
if (-not (Test-Path (Join-Path $app "$dist\server.js"))) { throw "Release $dist has no server.js" }
function Log($message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff') $message"
  Add-Content -Path (Join-Path $work 'deploy.log') -Value $line
  Write-Host $line
}

# netstat may report PID 0 for the web's socket: find the web by its command line instead.
function Web-Processes {
  @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '\.next[^\s''"]*[\\/]server\.js' })
}
function Healthy($port) {
  try {
    $api = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/api/products/filters" -TimeoutSec 10
    $page = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/vi" -TimeoutSec 30
    return $api.StatusCode -eq 200 -and $page.StatusCode -eq 200
  } catch { return $false }
}
function Start-Connector($name, $config) {
  $logFile = Join-Path $work "cloudflared-$name.log"
  Remove-Item $logFile -ErrorAction SilentlyContinue
  $arguments = @('--logfile', $logFile) + $(if ($config) { @('--config', $config) } else { @() }) + @('tunnel', 'run', 'model-universe')
  $process = Start-Process -WindowStyle Hidden -FilePath $cloudflared -ArgumentList $arguments -PassThru
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) { throw "connector $name exited; see $logFile" }
    $registered = @(Select-String -Path $logFile -Pattern 'Registered tunnel connection' -ErrorAction SilentlyContinue).Count
    if ($registered -ge 4) { Start-Sleep -Seconds 3; Log "connector $name registered $registered connections (pid $($process.Id))"; return $process.Id }
  }
  throw "connector $name did not register 4 connections; see $logFile"
}

Log "release $($release.commit) $dist"
$oldWeb = @(Web-Processes)
if ($oldWeb.Count -ne 1) { throw "expected one web process, found $($oldWeb.Count)" }
$oldConnectors = @(Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" | ForEach-Object { $_.ProcessId })
Log "old web pid $($oldWeb[0].ProcessId), old connectors $($oldConnectors -join ',')"
if (-not (Healthy 6050)) { throw 'the current web is not healthy; not touching it' }

# 1. Holding proxy and its connector.
$proxy = Start-Process -WindowStyle Hidden -FilePath node -ArgumentList "`"$app\scripts\hold-proxy.cjs`"", '6049', '6050', "`"$work\hold-proxy.log`"" -PassThru
Start-Sleep -Seconds 2
if (-not (Healthy 6049)) { throw 'holding proxy is not forwarding' }
$holdConfig = Join-Path $work 'cloudflared-hold.yml'
(Get-Content "$env:USERPROFILE\.cloudflared\config.yml" -Raw) -replace '127\.0\.0\.1:6050', '127.0.0.1:6049' | Set-Content $holdConfig
$holdConnector = Start-Connector 'hold' $holdConfig
foreach ($connector in $oldConnectors) { Stop-Process -Id $connector -Force }
Log 'old connector stopped; all traffic goes through the holding proxy'
Start-Sleep -Seconds 5

# 2. Replace the web on 6050 (same environment as before: .env and .env.production.local, NODE_ENV and PORT).
$script = Join-Path $work 'web-6050.ps1'
@"
Set-Location '$app'
`$env:NODE_ENV = 'production'
`$env:PORT = '6050'
`$env:NEXT_DIST_DIR = '$dist'
node '$dist\server.js' *>> '$work\web-6050.log'
"@ | Set-Content -Path $script -Encoding UTF8
taskkill /PID $oldWeb[0].ProcessId /T /F | Out-Null
for ($i = 0; $i -lt 30 -and @(Web-Processes).Count; $i++) { Start-Sleep -Milliseconds 200 }
Log 'old web stopped'
Start-Process -WindowStyle Hidden powershell -ArgumentList '-ExecutionPolicy', 'Bypass', '-File', $script | Out-Null
$up = $false
for ($i = 0; $i -lt 120 -and -not $up; $i++) { Start-Sleep -Milliseconds 500; $up = Healthy 6050 }
if (-not $up) { throw "new web did not become healthy; see $work\web-6050.log (the proxy keeps holding)" }
Log "new web healthy (pid $((Web-Processes | ForEach-Object ProcessId) -join ','))"

# 3. Back to the direct connector; retire the proxy path.
$connector = Start-Connector 'direct' $null
Stop-Process -Id $holdConnector -Force
Log 'holding connector stopped'
Start-Sleep -Seconds 15
Stop-Process -Id $proxy.Id -Force
Log "done: connector pid $connector"
