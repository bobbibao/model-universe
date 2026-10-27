$ErrorActionPreference = 'Stop'
$appDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeDirectory = if ($env:MODEL_UNIVERSE_RUNTIME_DIR) { $env:MODEL_UNIVERSE_RUNTIME_DIR } else { Join-Path $appDirectory '.runtime' }
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$nodePath = (Get-Command node -ErrorAction Stop).Source
Start-Process -FilePath $nodePath -ArgumentList @('scripts/production-runtime.cjs', 'run') -WorkingDirectory $appDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDirectory 'supervisor.log') -RedirectStandardError (Join-Path $runtimeDirectory 'supervisor-error.log')
Write-Output 'Production runtime starting. Run yarn production:status to see the public URL.'
