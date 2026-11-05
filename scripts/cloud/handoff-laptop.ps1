# Hands the live shop from this laptop to a cloud session (scripts/cloud/README.md).
# Stops the laptop's web and tunnel connector (no more writes here), dumps the database, packs it with the uploads,
# the env files and the tunnel credentials, encrypts the bundle (AES-256, key MU_BUNDLE_KEY) and force-pushes it to
# the PRIVATE hand-off repository (MU_HANDOFF_REPO, branch `handoff`). The cloud session restores it and takes over.
#   -DryRun   build, encrypt and decrypt-verify the bundle without stopping anything or pushing.
param([switch]$DryRun)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$app = Join-Path $root 'apps\web-ecommerce'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$openssl = 'C:\Program Files\Git\usr\bin\openssl.exe'
$keyFile = Join-Path $env:USERPROFILE '.model-universe-bundle-key'
$repo = if ($env:MU_HANDOFF_REPO) { $env:MU_HANDOFF_REPO } else { (Get-Content (Join-Path $env:USERPROFILE '.model-universe-handoff-repo') -ErrorAction Stop).Trim() }
function Log($message) { Write-Host "$(Get-Date -Format 'HH:mm:ss') $message" }

# The bundle key: MU_BUNDLE_KEY, else the one saved on this laptop, else a new random one (saved, printed once).
$key = $env:MU_BUNDLE_KEY
if (-not $key -and (Test-Path $keyFile)) { $key = (Get-Content $keyFile -Raw).Trim() }
if (-not $key) {
  $key = -join ((1..48) | ForEach-Object { 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[(Get-Random -Maximum 55)] })
  Set-Content -Path $keyFile -Value $key -NoNewline
  Log "New bundle key saved to $keyFile. Put it in the cloud environment as MU_BUNDLE_KEY."
}
$env:MU_BUNDLE_KEY = $key

# Database settings from the web's .env.
$envValues = @{}
foreach ($line in Get-Content (Join-Path $app '.env')) {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') { $envValues[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'") }
}

if (-not $DryRun) {
  Log 'Stopping the laptop tunnel connector and web (the site is down until the cloud takes over).'
  Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match '\.next[^\s''"]*[\\/]server\.js' } |
    ForEach-Object { taskkill /PID $_.ProcessId /T /F | Out-Null }
}

$stage = Join-Path $env:TEMP "mu-handoff-$(Get-Date -Format yyyyMMddHHmmss)"
try {
  New-Item -ItemType Directory -Path "$stage\bundle\env", "$stage\bundle\cloudflared" -Force | Out-Null
  Log 'Dumping the database.'
  $env:PGPASSWORD = $envValues['DB_PASSWORD']
  & "$pgBin\pg_dump.exe" -h $envValues['DB_HOST'] -p $envValues['DB_PORT'] -U $envValues['DB_USERNAME'] -d $envValues['DB_NAME'] `
    --no-owner --no-privileges --encoding=UTF8 -f "$stage\bundle\db.sql"
  if ($LASTEXITCODE) { throw 'pg_dump failed' }
  Remove-Item Env:PGPASSWORD
  Copy-Item (Join-Path $app '.env'), (Join-Path $app '.env.production.local') "$stage\bundle\env\"
  Copy-Item "$env:USERPROFILE\.cloudflared\*" "$stage\bundle\cloudflared\"
  Copy-Item (Join-Path $app 'uploads') "$stage\bundle\uploads" -Recurse
  $epoch = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  @{ createdAt = (Get-Date).ToUniversalTime().ToString('o'); epoch = $epoch; commit = (git -C $root rev-parse --short HEAD); source = 'laptop' } |
    ConvertTo-Json | Set-Content "$stage\bundle\meta.json"

  Log 'Packing and encrypting.'
  tar -czf "$stage\bundle.tar.gz" -C "$stage\bundle" .
  & $openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:MU_BUNDLE_KEY -in "$stage\bundle.tar.gz" -out "$stage\bundle.enc"
  if ($LASTEXITCODE) { throw 'encryption failed' }
  & $openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:MU_BUNDLE_KEY -in "$stage\bundle.enc" -out "$stage\check.tar.gz"
  if ((Get-FileHash "$stage\check.tar.gz").Hash -ne (Get-FileHash "$stage\bundle.tar.gz").Hash) { throw 'decryption check failed' }
  Log "Bundle: $([math]::Round((Get-Item "$stage\bundle.enc").Length / 1MB, 1)) MB, verified."

  if ($DryRun) { Log 'Dry run: nothing stopped, nothing pushed.'; return }

  Log "Pushing to the private repository $repo (branch handoff)."
  $git = Join-Path $stage 'git'
  New-Item -ItemType Directory -Path $git | Out-Null
  Copy-Item "$stage\bundle.enc" $git
  Set-Content "$git\READY" $epoch -NoNewline
  git -C $git init -q -b handoff
  git -C $git add bundle.enc READY
  git -C $git -c user.name=handoff -c user.email=handoff@localhost commit -q -m "handoff $epoch"
  git -C $git push -q --force "git@github.com:$repo.git" handoff
  if ($LASTEXITCODE) { throw 'push failed' }
  Log 'Done. The cloud session restores this bundle and brings modeluniverse.vn back in about 2 minutes.'
} finally {
  Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
}
