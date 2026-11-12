param([switch]$Build, [switch]$Stop, [switch]$Status)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$privateRoot = Join-Path $projectRoot '.venv\private-access'
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
$pidFile = Join-Path $privateRoot 'server.pid'
New-Item -ItemType Directory -Path $privateRoot -Force | Out-Null

function Get-PrivateProcess {
    if (Test-Path -LiteralPath $pidFile) {
        $savedPid = 0
        if ([int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(), [ref]$savedPid)) {
            $process = Get-CimInstance Win32_Process -Filter "ProcessId = $savedPid" -ErrorAction SilentlyContinue
            if ($process -and $process.CommandLine -like '*-m scripts.private_app*') { return $process }
        }
    }
}

function Stop-PrivateProcess {
    $process = Get-PrivateProcess
    if ($process) {
        # The command line above verifies this is our private server, not development.
        & taskkill.exe /PID $process.ProcessId /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not stop the private server' }
    }
}

if ($Status) {
    $process = Get-PrivateProcess
    if ($process) { Write-Output "Private datacube process $($process.ProcessId) is running on localhost:8765" }
    else { Write-Output 'Private datacube is stopped' }
    exit 0
}
if ($Stop) { Stop-PrivateProcess; Write-Output 'Private datacube stopped'; exit 0 }
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Project Python environment is missing' }

if ($Build) {
    Stop-PrivateProcess
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        & npm.cmd run build -- --outDir (Join-Path $privateRoot 'site') --emptyOutDir
        if ($LASTEXITCODE -ne 0) { throw 'Private frontend build failed' }
    } finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath (Join-Path $privateRoot 'site\index.html'))) { throw 'Run this script with -Build first' }
if (Get-PrivateProcess) { Write-Output 'Private datacube is already running'; exit 0 }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$process = Start-Process -FilePath $pythonPath -ArgumentList '-m','scripts.private_app' `
    -WorkingDirectory $projectRoot -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $privateRoot "server-$stamp.out.log") `
    -RedirectStandardError (Join-Path $privateRoot "server-$stamp.err.log") -PassThru
Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii
Write-Output "Private datacube started on localhost:8765 with process $($process.Id)"
