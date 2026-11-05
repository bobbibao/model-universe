# Moves the live shop off this machine (scripts/host/README.md), step 1 of 2.
# Stops this machine's tunnel connector and web (no more writes here), dumps the database and packs it with the uploads,
# every env file (web, agent service, infra) and the Cloudflare tunnel credentials into ONE file encrypted with AES-256.
# Copy that file to the new host (USB stick, Google Drive...) and run setup-host.ps1 there with the same key.
#   -OutFile  where to write the bundle (default: Desktop\model-universe-host.enc)
#   -DryRun   build and verify the bundle without stopping the site
param([string]$OutFile = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'model-universe-host.enc'), [switch]$DryRun)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$app = Join-Path $root 'apps\web-ecommerce'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$openssl = 'C:\Program Files\Git\usr\bin\openssl.exe'
$keyFile = Join-Path $env:USERPROFILE '.model-universe-bundle-key'
function Log($message) { Write-Host "$(Get-Date -Format 'HH:mm:ss') $message" }

# The bundle key: MU_BUNDLE_KEY, else the one saved on this machine, else a new random one (saved).
$key = $env:MU_BUNDLE_KEY
if (-not $key -and (Test-Path $keyFile)) { $key = (Get-Content $keyFile -Raw).Trim() }
if (-not $key) {
  $key = -join ((1..48) | ForEach-Object { 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[(Get-Random -Maximum 55)] })
  Set-Content -Path $keyFile -Value $key -NoNewline
}
Log "Bundle key: $keyFile (copy it to the new host separately from the bundle)."
$env:MU_BUNDLE_KEY = $key

$envValues = @{}
foreach ($line in Get-Content (Join-Path $app '.env')) {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') { $envValues[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'") }
}

if (-not $DryRun) {
  Log 'Stopping the tunnel connector and the web here (the site is down until the new host starts).'
  Get-ScheduledTask -TaskName 'ModelUniverse Host' -ErrorAction SilentlyContinue | Disable-ScheduledTask | Out-Null
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'run-host\.ps1' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match '\.next[^\s''"]*[\\/]server\.js' } |
    ForEach-Object { taskkill /PID $_.ProcessId /T /F | Out-Null }
}

$stage = Join-Path $env:TEMP "mu-export-$(Get-Date -Format yyyyMMddHHmmss)"
try {
  New-Item -ItemType Directory -Path "$stage\bundle\env\web", "$stage\bundle\env\agent", "$stage\bundle\env\infra", "$stage\bundle\cloudflared" -Force | Out-Null
  Log 'Dumping the database.'
  $env:PGPASSWORD = $envValues['DB_PASSWORD']
  & "$pgBin\pg_dump.exe" -h $envValues['DB_HOST'] -p $envValues['DB_PORT'] -U $envValues['DB_USERNAME'] -d $envValues['DB_NAME'] `
    --no-owner --no-privileges --encoding=UTF8 -f "$stage\bundle\db.sql"
  if ($LASTEXITCODE) { throw 'pg_dump failed' }
  Remove-Item Env:PGPASSWORD
  Copy-Item (Join-Path $app '.env'), (Join-Path $app '.env.production.local') "$stage\bundle\env\web\"
  foreach ($pair in @(@('apps\agent-service\.env', 'agent'), @('infra\.env', 'infra'))) {
    $file = Join-Path $root $pair[0]
    if (Test-Path $file) { Copy-Item $file "$stage\bundle\env\$($pair[1])\" }
  }
  Copy-Item "$env:USERPROFILE\.cloudflared\*" "$stage\bundle\cloudflared\"
  Copy-Item (Join-Path $app 'uploads') "$stage\bundle\uploads" -Recurse
  @{ createdAt = (Get-Date).ToUniversalTime().ToString('o'); commit = (git -C $root rev-parse --short HEAD); source = $env:COMPUTERNAME } |
    ConvertTo-Json | Set-Content "$stage\bundle\meta.json"

  Log 'Packing and encrypting.'
  tar -czf "$stage\bundle.tar.gz" -C "$stage\bundle" .
  & $openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:MU_BUNDLE_KEY -in "$stage\bundle.tar.gz" -out "$stage\bundle.enc"
  if ($LASTEXITCODE) { throw 'encryption failed' }
  & $openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:MU_BUNDLE_KEY -in "$stage\bundle.enc" -out "$stage\check.tar.gz"
  if ((Get-FileHash "$stage\check.tar.gz").Hash -ne (Get-FileHash "$stage\bundle.tar.gz").Hash) { throw 'decryption check failed' }
  if ($DryRun) { Log "Dry run: bundle verified ($([math]::Round((Get-Item "$stage\bundle.enc").Length / 1MB, 1)) MB); nothing stopped or written."; return }
  Copy-Item "$stage\bundle.enc" $OutFile -Force
  Log "Wrote $OutFile ($([math]::Round((Get-Item $OutFile).Length / 1MB, 1)) MB). Copy it to the new host and run setup-host.ps1 -Step restore there."
} finally {
  Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
}
