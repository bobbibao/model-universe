# Sets this Windows machine up as the 24/7 host of modeluniverse.vn (scripts/host/README.md). Run as Administrator,
# from a clone of the repository, one step at a time:
#   -Step check     report what is installed and what is missing (Git, Node 22, PostgreSQL 18, cloudflared)
#   -Step build     install packages and build a release (the old host keeps serving meanwhile)
#   -Step restore   -Bundle <file>: decrypt the bundle from export-host.ps1 and restore the database, uploads,
#                   env files and tunnel credentials (refuses while modeluniverse.vn still answers, unless -Force)
#   -Step service   register and start the "ModelUniverse Host" boot task (run-host.ps1), keep the machine awake
# The bundle key comes from MU_BUNDLE_KEY or %USERPROFILE%\.model-universe-bundle-key (copy it from the old host).
param(
  [Parameter(Mandatory)][ValidateSet('check', 'build', 'restore', 'service')][string]$Step,
  [string]$Bundle,
  [string]$Runtime = $(if (Test-Path 'D:\') { 'D:\ModelUniverseRuntime' } else { 'C:\ModelUniverseRuntime' }),
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$app = Join-Path $root 'apps\web-ecommerce'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$openssl = 'C:\Program Files\Git\usr\bin\openssl.exe'
$machineTunnel = 'C:\ProgramData\ModelUniverse\cloudflared'
function Log($message) { Write-Host "$(Get-Date -Format 'HH:mm:ss') $message" }
function Find-Cloudflared {
  foreach ($candidate in @((Get-Command cloudflared -ErrorAction SilentlyContinue).Source, 'C:\Program Files (x86)\cloudflared\cloudflared.exe', 'C:\Program Files\cloudflared\cloudflared.exe')) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
}
function Env-Values($file) {
  $values = @{}
  foreach ($line in Get-Content $file) { if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') { $values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'") } }
  $values
}
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

switch ($Step) {
  'check' {
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    $checks = [ordered]@{
      'Administrator shell' = $admin
      'Git (with openssl)' = [bool](Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path $openssl)
      'Node 22+' = [bool]$node -and ((& node -v) -match '^v(2[2-9]|[3-9]\d)\.')
      'PostgreSQL 18 (service running)' = (Test-Path "$pgBin\psql.exe") -and [bool](Get-Service 'postgresql*18*' -ErrorAction SilentlyContinue | Where-Object Status -eq 'Running')
      'cloudflared' = [bool](Find-Cloudflared)
      'Bundle key file' = [bool]$env:MU_BUNDLE_KEY -or (Test-Path "$env:USERPROFILE\.model-universe-bundle-key")
    }
    $checks.GetEnumerator() | ForEach-Object { Write-Host ("{0,-34} {1}" -f $_.Key, $(if ($_.Value) { 'ok' } else { 'MISSING' })) }
    Write-Host "Runtime folder: $Runtime"
    if ($checks.Values -contains $false) {
      Write-Host @'
Install hints (winget, in an Administrator shell):
  winget install --id Git.Git -e
  winget install --id OpenJS.NodeJS.22 -e            (or nvm-windows, then: nvm install 22 && nvm use 22)
  winget install --id PostgreSQL.PostgreSQL.18 -e    (superuser "postgres" password = DB_PASSWORD of the old host)
  winget install --id Cloudflare.cloudflared -e
'@
      exit 1
    }
  }
  'build' {
    Set-Location $app
    corepack enable
    yarn install --immutable
    if ($LASTEXITCODE) { throw 'yarn install failed' }
    $env:MODEL_UNIVERSE_RUNTIME_DIR = $Runtime
    $env:MODEL_UNIVERSE_BUILD_SNAPSHOT = 'true'
    $env:SHOP_PUBLIC_URL = 'https://modeluniverse.vn'
    New-Item -ItemType Directory -Path $Runtime -Force | Out-Null
    node scripts/build-production.cjs
    if ($LASTEXITCODE) { throw 'build failed' }
    Log "Release built: $(Get-Content (Join-Path $Runtime 'release.json') -Raw)"
  }
  'restore' {
    if (-not $Bundle -or -not (Test-Path $Bundle)) { throw 'Pass -Bundle <path to model-universe-host.enc>' }
    $alive = try { (Invoke-WebRequest -UseBasicParsing https://modeluniverse.vn/api/products/filters -TimeoutSec 15).StatusCode -eq 200 } catch { $false }
    if ($alive -and -not $Force) { throw 'modeluniverse.vn still answers: the old host is still serving. Run export-host.ps1 there first (or pass -Force).' }
    $key = if ($env:MU_BUNDLE_KEY) { $env:MU_BUNDLE_KEY } else { (Get-Content "$env:USERPROFILE\.model-universe-bundle-key" -Raw).Trim() }
    $env:MU_BUNDLE_KEY = $key
    $stage = Join-Path $env:TEMP "mu-restore-$(Get-Date -Format yyyyMMddHHmmss)"
    try {
      New-Item -ItemType Directory -Path "$stage\bundle" -Force | Out-Null
      & $openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:MU_BUNDLE_KEY -in $Bundle -out "$stage\bundle.tar.gz"
      if ($LASTEXITCODE) { throw 'decryption failed (wrong key?)' }
      tar -xzf "$stage\bundle.tar.gz" -C "$stage\bundle"
      Log "Bundle from $((Get-Content "$stage\bundle\meta.json" -Raw | ConvertFrom-Json).source)"

      # Env files; the runtime folder is this machine's, the agent runtime stays off (not part of this host yet).
      Copy-Item "$stage\bundle\env\web\.env" (Join-Path $app '.env') -Force
      (Get-Content "$stage\bundle\env\web\.env.production.local") |
        Where-Object { $_ -notmatch '^(TEMP|TMP)=' } |
        ForEach-Object { $_ -replace '^MODEL_UNIVERSE_RUNTIME_DIR=.*', "MODEL_UNIVERSE_RUNTIME_DIR=$($Runtime -replace '\\', '/')" -replace '^START_AGENT_RUNTIME=.*', 'START_AGENT_RUNTIME=false' } |
        Set-Content (Join-Path $app '.env.production.local')
      if (Test-Path "$stage\bundle\env\agent\.env") { Copy-Item "$stage\bundle\env\agent\.env" (Join-Path $root 'apps\agent-service\.env') -Force }
      if (Test-Path "$stage\bundle\env\infra\.env") { Copy-Item "$stage\bundle\env\infra\.env" (Join-Path $root 'infra\.env') -Force }
      robocopy "$stage\bundle\uploads" (Join-Path $app 'uploads') /E /NFL /NDL /NJH /NJS | Out-Null

      # Tunnel credentials: for this user, and a machine copy the SYSTEM boot task reads.
      foreach ($target in @("$env:USERPROFILE\.cloudflared", $machineTunnel)) {
        New-Item -ItemType Directory -Path $target -Force | Out-Null
        Copy-Item "$stage\bundle\cloudflared\*" $target -Force
        $cred = (Get-ChildItem $target -Filter '*.json' | Select-Object -First 1).FullName
        (Get-Content "$target\config.yml") -replace '^credentials-file:.*', "credentials-file: $cred" | Set-Content "$target\config.yml"
      }
      icacls $machineTunnel /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null

      # Database: same name and credentials as the old host.
      $db = Env-Values (Join-Path $app '.env')
      $env:PGPASSWORD = $db['DB_PASSWORD']
      $conn = @('-h', '127.0.0.1', '-p', $db['DB_PORT'], '-U', $db['DB_USERNAME'])
      & "$pgBin\psql.exe" @conn -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS `"$($db['DB_NAME'])`" WITH (FORCE)" -c "CREATE DATABASE `"$($db['DB_NAME'])`" ENCODING 'UTF8' TEMPLATE template0"
      if ($LASTEXITCODE) { throw "could not create the database (is the postgres password = DB_PASSWORD?)" }
      & "$pgBin\psql.exe" @conn -d $db['DB_NAME'] -v ON_ERROR_STOP=1 -q -f "$stage\bundle\db.sql" | Out-Null
      if ($LASTEXITCODE) { throw 'database restore failed' }
      $products = & "$pgBin\psql.exe" @conn -d $db['DB_NAME'] -tA -c 'select count(*) from product'
      Remove-Item Env:PGPASSWORD
      Log "Restored: database ($products products), uploads, env files, tunnel credentials."
    } finally {
      Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
    }
  }
  'service' {
    if (-not $admin) { throw 'Run this step in an Administrator shell.' }
    $hostDir = Join-Path $Runtime 'host'
    New-Item -ItemType Directory -Path $hostDir -Force | Out-Null
    @{ node = (Get-Command node).Source; cloudflared = (Find-Cloudflared); tunnelConfig = "$machineTunnel\config.yml" } |
      ConvertTo-Json | Set-Content (Join-Path $hostDir 'host.json')
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$root\scripts\host\run-host.ps1`""
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
      -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName 'ModelUniverse Host' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Start-ScheduledTask -TaskName 'ModelUniverse Host'
    Log 'Boot task "ModelUniverse Host" registered and started.'

    # Stay awake on mains power, also with the lid closed.
    powercfg /change standby-timeout-ac 0
    powercfg /change hibernate-timeout-ac 0
    powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
    powercfg /setactive SCHEME_CURRENT
    Log 'Power: no sleep or hibernate on mains power; closing the lid does nothing.'

    $up = $false
    for ($i = 0; $i -lt 60 -and -not $up; $i++) {
      Start-Sleep -Seconds 5
      $up = try { (Invoke-WebRequest -UseBasicParsing https://modeluniverse.vn/api/products/filters -TimeoutSec 15).StatusCode -eq 200 } catch { $false }
    }
    if ($up) { Log 'https://modeluniverse.vn answers from this host.' } else { throw "No public answer yet: see $hostDir\host.log, web-*.log, cloudflared.log" }
  }
}
