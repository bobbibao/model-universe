param([switch]$LocalOnly)
$ErrorActionPreference = 'Stop'
$appDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeDirectory = $env:MODEL_UNIVERSE_RUNTIME_DIR
if (-not $runtimeDirectory) {
    $configuration = Join-Path $appDirectory '.env.production.local'
    if (Test-Path -LiteralPath $configuration) {
        $setting = Select-String -LiteralPath $configuration -Pattern '^MODEL_UNIVERSE_RUNTIME_DIR=(.+)$' | Select-Object -First 1
        if ($setting) { $runtimeDirectory = $setting.Matches[0].Groups[1].Value.Trim().Trim('"').Trim("'") }
    }
}
if (-not $runtimeDirectory) { $runtimeDirectory = Join-Path $appDirectory '.runtime' }
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$lockFile = Join-Path $runtimeDirectory 'lock'
if (Test-Path -LiteralPath $lockFile) {
    $supervisorId = 0
    if ([int]::TryParse((Get-Content -LiteralPath $lockFile -Raw).Trim(), [ref]$supervisorId)) {
        if (Get-Process -Id $supervisorId -ErrorAction SilentlyContinue) {
            Write-Output 'Production runtime is already running. Use yarn production:status.'
            return
        }
    }
}
$nodePath = (Get-Command node -ErrorAction Stop).Source
$runtimeMode = if ($LocalOnly) { 'run-local' } else { 'run' }
Start-Process -FilePath $nodePath -ArgumentList @('scripts/production-runtime.cjs', $runtimeMode) -WorkingDirectory $appDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDirectory 'supervisor.log') -RedirectStandardError (Join-Path $runtimeDirectory 'supervisor-error.log')
Write-Output 'Production runtime starting. Run yarn production:status to see the runtime URL.'
