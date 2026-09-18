# Starts the platform and opens it in the browser (Windows).
# Safe to run every day; setup.ps1 only needs running once.

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$venvPython = Join-Path $PSScriptRoot "apps\api\.venv\Scripts\python.exe"

if (-not (Test-Path .env) -or -not (Test-Path $venvPython)) {
    Write-Host "`n  This has not been set up yet.`n" -ForegroundColor Red
    Write-Host "  Double-click setup.bat first.`n"
    Read-Host "  Press Enter to close"
    exit 1
}

& docker info *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n  Docker Desktop is not running.`n" -ForegroundColor Red
    Write-Host "  Open the Docker Desktop app, wait about 30 seconds, then run this again.`n"
    Read-Host "  Press Enter to close"
    exit 1
}

Write-Host "`n  AI Product Discovery Platform`n" -ForegroundColor Cyan
Write-Host "  Starting the database..." -ForegroundColor DarkGray
& docker compose up -d db *>$null
foreach ($i in 1..60) {
    & docker compose exec -T db pg_isready -U discovery -d discovery *>$null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
}
Write-Host "  [ok] Database ready" -ForegroundColor Green

# Both servers run as background jobs so one window controls the whole app.
$api = Start-Process -PassThru -NoNewWindow -WorkingDirectory (Join-Path $PSScriptRoot "apps\api") `
    -FilePath (Join-Path $PSScriptRoot "apps\api\.venv\Scripts\uvicorn.exe") `
    -ArgumentList "app.main:app", "--host", "127.0.0.1", "--port", "8000"

$web = Start-Process -PassThru -NoNewWindow -WorkingDirectory (Join-Path $PSScriptRoot "apps\web") `
    -FilePath "cmd.exe" -ArgumentList "/c", "npm", "run", "dev"

Write-Host "  Starting the app - this takes about 20 seconds...`n" -ForegroundColor DarkGray

foreach ($i in 1..60) {
    try {
        Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing *>$null
        Start-Process "http://localhost:3000"
        break
    } catch { Start-Sleep -Seconds 2 }
}

Write-Host "  Open at http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Leave this window open while you use it." -ForegroundColor DarkGray
Write-Host "  To stop: press Ctrl+C, or close this window.`n" -ForegroundColor DarkGray

try {
    Wait-Process -Id $api.Id
} finally {
    foreach ($process in @($api, $web)) {
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
}
