# Takes the shop back from the cloud session (scripts/cloud/README.md), after handback-cloud.sh has run there.
# Fetches the `handback` bundle (or, with -FromBackup, the last hourly `cloud-backup`) from the private hand-off repo,
# keeps a copy of the laptop's current database, restores the cloud's database and uploads, then starts the web on
# 6050 and the tunnel connector.
param([switch]$FromBackup)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$app = Join-Path $root 'apps\web-ecommerce'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$openssl = 'C:\Program Files\Git\usr\bin\openssl.exe'
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$repo = if ($env:MU_HANDOFF_REPO) { $env:MU_HANDOFF_REPO } else { (Get-Content (Join-Path $env:USERPROFILE '.model-universe-handoff-repo')).Trim() }
$env:MU_BUNDLE_KEY = if ($env:MU_BUNDLE_KEY) { $env:MU_BUNDLE_KEY } else { (Get-Content (Join-Path $env:USERPROFILE '.model-universe-bundle-key') -Raw).Trim() }
$branch = if ($FromBackup) { 'cloud-backup' } else { 'handback' }
function Log($message) { Write-Host "$(Get-Date -Format 'HH:mm:ss') $message" }
$envValues = @{}
foreach ($line in Get-Content (Join-Path $app '.env')) {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') { $envValues[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'") }
}
$runtime = (Select-String -LiteralPath (Join-Path $app '.env.production.local') -Pattern '^MODEL_UNIVERSE_RUNTIME_DIR=(.+)$').Matches[0].Groups[1].Value.Trim()

$stage = Join-Path $env:TEMP "mu-restore-$(Get-Date -Format yyyyMMddHHmmss)"
try {
  Log "Fetching $branch from $repo"
  git clone -q --depth 1 -b $branch "git@github.com:$repo.git" "$stage\git"
  if ($LASTEXITCODE) { throw "no $branch bundle" }
  New-Item -ItemType Directory -Path "$stage\bundle" | Out-Null
  & $openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:MU_BUNDLE_KEY -in "$stage\git\bundle.enc" -out "$stage\bundle.tar.gz"
  if ($LASTEXITCODE) { throw 'decryption failed (wrong MU_BUNDLE_KEY?)' }
  tar -xzf "$stage\bundle.tar.gz" -C "$stage\bundle"

  $env:PGPASSWORD = $envValues['DB_PASSWORD']
  $conn = @('-h', $envValues['DB_HOST'], '-p', $envValues['DB_PORT'], '-U', $envValues['DB_USERNAME'])
  $keep = Join-Path $runtime "laptop-db-before-restore-$(Get-Date -Format yyyyMMddHHmmss).sql"
  Log "Saving the laptop's current database to $keep"
  & "$pgBin\pg_dump.exe" @conn -d $envValues['DB_NAME'] --no-owner --no-privileges -f $keep
  if ($LASTEXITCODE) { throw 'could not save the laptop database' }

  Log 'Restoring the cloud database'
  $db = $envValues['DB_NAME']
  & "$pgBin\psql.exe" @conn -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS `"$db`" WITH (FORCE)" -c "CREATE DATABASE `"$db`" ENCODING 'UTF8' TEMPLATE template0"
  if ($LASTEXITCODE) { throw 'could not recreate the database' }
  & "$pgBin\psql.exe" @conn -d $db -v ON_ERROR_STOP=1 -q -f "$stage\bundle\db.sql" | Out-Null
  if ($LASTEXITCODE) { throw "restore failed; the previous laptop database is in $keep" }
  Remove-Item Env:PGPASSWORD

  Log 'Restoring uploads'
  robocopy "$stage\bundle\uploads" (Join-Path $app 'uploads') /E /NFL /NDL /NJH /NJS | Out-Null

  Log 'Starting the web and the tunnel'
  $release = Get-Content (Join-Path $runtime 'release.json') -Raw | ConvertFrom-Json
  $script = Join-Path $runtime 'deploy\web-6050.ps1'
  New-Item -ItemType Directory -Path (Split-Path $script) -Force | Out-Null
  @"
Set-Location '$app'
`$env:NODE_ENV = 'production'
`$env:PORT = '6050'
`$env:NEXT_DIST_DIR = '$($release.nextDist)'
node '$($release.nextDist)\server.js' *>> '$runtime\deploy\web-6050.log'
"@ | Set-Content -Path $script -Encoding UTF8
  Start-Process -WindowStyle Hidden powershell -ArgumentList '-ExecutionPolicy', 'Bypass', '-File', $script | Out-Null
  $up = $false
  for ($i = 0; $i -lt 90 -and -not $up; $i++) {
    Start-Sleep -Seconds 2
    try { $up = (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:6050/api/products/filters -TimeoutSec 10).StatusCode -eq 200 } catch {}
  }
  if (-not $up) { throw "web did not start; see $runtime\deploy\web-6050.log" }
  Start-Process -WindowStyle Hidden -FilePath $cloudflared -ArgumentList '--logfile', "$runtime\deploy\cloudflared-direct.log", 'tunnel', 'run', 'model-universe'
  Log 'Done: modeluniverse.vn is served from the laptop again.'
} finally {
  Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
}
