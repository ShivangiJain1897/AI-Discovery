# One-command setup for the AI Product Discovery Platform (Windows).
#
# Windows has neither bash nor make, so this runs the same steps natively.
# Written for someone who does not work in a terminal.

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Write-Step  { param($m) Write-Host "`n$m" -ForegroundColor White }
function Write-Ok    { param($m) Write-Host "  [ok] $m" -ForegroundColor Green }
function Write-Warn  { param($m) Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Write-Info  { param($m) Write-Host "    $m" -ForegroundColor DarkGray }

function Stop-Missing {
    param($What, $Why, $Url)
    Write-Host "`n  Stopped: $What is not installed.`n" -ForegroundColor Red
    Write-Host "  $Why`n"
    Write-Host "  What to do:" -ForegroundColor White
    Write-Host "    1. Open this link:  $Url" -ForegroundColor Cyan
    Write-Host "    2. Download and install it (accept all the defaults)."
    Write-Host "    3. Run this setup again.`n"
    Read-Host "  Press Enter to close"
    exit 1
}

Write-Host "`n  AI Product Discovery Platform" -ForegroundColor Cyan
Write-Host "  Setting up on this computer. This takes about 5 minutes.`n" -ForegroundColor DarkGray

# ── 1. Prerequisites ─────────────────────────────────────────

Write-Step "Step 1 of 6 - Checking what this computer already has"

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $python) {
    Stop-Missing "Python" `
        "Python is the programming language the research engine runs on." `
        "https://www.python.org/downloads/"
}
$pyOk = & $python.Source -c "import sys; print(1 if sys.version_info >= (3,11) else 0)" 2>$null
$pyVer = & $python.Source -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
if ($pyOk -ne "1") {
    Stop-Missing "a recent enough Python" `
        "You have Python $pyVer, but this needs 3.11 or newer." `
        "https://www.python.org/downloads/"
}
Write-Ok "Python $pyVer"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Stop-Missing "Node" `
        "Node runs the part of the app you see in your browser." `
        "https://nodejs.org/"
}
$nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) {
    Stop-Missing "a recent enough Node" `
        "You have Node $(& node -v), but this needs version 20 or newer." `
        "https://nodejs.org/"
}
Write-Ok "Node $(& node -v)"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Stop-Missing "Docker Desktop" `
        "Docker runs the database that stores your research evidence." `
        "https://www.docker.com/products/docker-desktop/"
}

& docker info *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n  Stopped: Docker Desktop is installed but not running.`n" -ForegroundColor Red
    Write-Host "  What to do:" -ForegroundColor White
    Write-Host "    1. Open the Docker Desktop app from your Start menu."
    Write-Host "    2. Wait until its whale icon stops animating - about 30 seconds."
    Write-Host "    3. Run this setup again.`n"
    Read-Host "  Press Enter to close"
    exit 1
}
Write-Ok "Docker Desktop (running)"

# ── 2. Settings file ─────────────────────────────────────────

Write-Step "Step 2 of 6 - Preparing your settings file"

if (Test-Path .env) {
    Write-Ok "Settings file already exists (keeping your keys)"
} else {
    Copy-Item .env.example .env
    Write-Ok "Created your settings file"
}

function Get-EnvKey {
    param($Name)
    $line = Select-String -Path .env -Pattern "^$Name=(.*)$" | Select-Object -First 1
    if ($line) { return $line.Matches[0].Groups[1].Value.Trim() }
    return ""
}

function Set-EnvKey {
    param($Name, $Value)
    $content = Get-Content .env -Raw
    if ($content -match "(?m)^$Name=") {
        $content = [regex]::Replace($content, "(?m)^$Name=.*$", "$Name=$Value", 1)
    } else {
        $content = $content.TrimEnd("`n") + "`n$Name=$Value`n"
    }
    Set-Content .env -Value $content -NoNewline
}

# ── 3. AI key ────────────────────────────────────────────────

Write-Step "Step 3 of 6 - Connecting the AI"

if (Get-EnvKey "ANTHROPIC_API_KEY") {
    Write-Ok "AI key already saved"
} else {
    Write-Host "`n  The platform needs one key to do its research and analysis.`n"
    Write-Host "  Where to get it:" -ForegroundColor White
    Write-Host "    1. Open  https://console.anthropic.com" -ForegroundColor Cyan
    Write-Host "    2. Sign in, then click API Keys in the left sidebar"
    Write-Host "    3. Click Create Key, then copy it"
    Write-Host "       (it is a long string starting with sk-ant-)" -ForegroundColor DarkGray
    Write-Host "`n  Paste it below and press Enter."
    Write-Host "  Or just press Enter to skip - the app will still run, but it will" -ForegroundColor DarkGray
    Write-Host "  say 'Not established' instead of doing real analysis.`n" -ForegroundColor DarkGray
    $key = Read-Host "  Paste your key"

    if ([string]::IsNullOrWhiteSpace($key)) {
        Write-Warn "Skipped - you can add it later by running this setup again"
    } elseif (-not $key.StartsWith("sk-ant-")) {
        Write-Warn "That does not look like an Anthropic key (they start with sk-ant-)"
        Write-Info "Saving it anyway. If the app says 'Deterministic mode' later,"
        Write-Info "run this setup again and re-paste it."
        Set-EnvKey "ANTHROPIC_API_KEY" $key.Trim()
    } else {
        Set-EnvKey "ANTHROPIC_API_KEY" $key.Trim()
        Write-Ok "AI key saved"
    }
}

# ── 4. Search key ────────────────────────────────────────────

Write-Step "Step 4 of 6 - Connecting web research (optional)"

if (Get-EnvKey "TAVILY_API_KEY") {
    Write-Ok "Web search key already saved"
} else {
    Write-Host "`n  This lets the platform actually read the web. Without it, research"
    Write-Host "  returns placeholder results instead of real sources.`n"
    Write-Host "  Where to get it (free):" -ForegroundColor White
    Write-Host "    1. Open  https://tavily.com" -ForegroundColor Cyan
    Write-Host "    2. Sign up, then copy the key from your dashboard"
    Write-Host "       (it starts with tvly-)`n" -ForegroundColor DarkGray
    $searchKey = Read-Host "  Paste your key (or press Enter to skip)"

    if ([string]::IsNullOrWhiteSpace($searchKey)) {
        Write-Warn "Skipped - research will use placeholder sources"
    } else {
        Set-EnvKey "TAVILY_API_KEY" $searchKey.Trim()
        Write-Ok "Web search key saved"
    }
}

# ── 5. Install ───────────────────────────────────────────────

Write-Step "Step 5 of 6 - Installing the app"
Write-Info "This is the slow part - about 3 minutes. Please leave it running."

$log = "setup-log.txt"
"" | Set-Content $log

function Invoke-Quietly {
    param($Label, [scriptblock]$Action)
    Write-Host "  ...$Label" -ForegroundColor DarkGray -NoNewline

    # Each step gets its own file as well as the combined log, so a failure
    # report shows the step that actually failed rather than warnings left
    # over from the step before it.
    $stepLog = [System.IO.Path]::GetTempFileName()
    try {
        & $Action *> $stepLog
        if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { throw "exit code $LASTEXITCODE" }
        Add-Content $log "`n===== $Label ====="
        Get-Content $stepLog | Add-Content $log
        Remove-Item $stepLog -Force -ErrorAction SilentlyContinue
        Write-Host "`r  [ok] $Label                                        " -ForegroundColor Green
    } catch {
        Add-Content $log "`n===== FAILED: $Label ====="
        Get-Content $stepLog -ErrorAction SilentlyContinue | Add-Content $log
        Write-Host "`r  [x]  $Label                                        " -ForegroundColor Red
        Write-Host "`n  Setup could not finish.`n" -ForegroundColor Red
        Write-Host "  It got stuck on:  $Label`n" -ForegroundColor White
        Write-Host "  What to do: paste the lines below to Claude and ask what"
        Write-Host "  went wrong. The full details are also in $log.`n"
        Write-Host "  ------------------------------------------------------" -ForegroundColor DarkGray
        Get-Content $stepLog -ErrorAction SilentlyContinue |
            Where-Object { $_ -notmatch '^\s*$|npm (warn|notice)|vulnerabilities|npm audit|npm fund' } |
            Select-Object -Last 8 |
            ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Write-Host "  ------------------------------------------------------`n" -ForegroundColor DarkGray
        Remove-Item $stepLog -Force -ErrorAction SilentlyContinue
        Read-Host "  Press Enter to close"
        exit 1
    }
}

$venvPython = Join-Path $PSScriptRoot "apps\api\.venv\Scripts\python.exe"

Invoke-Quietly "Installing the research engine" {
    & $python.Source -m venv apps/api/.venv
    & $venvPython -m pip install --quiet --upgrade pip
    & $venvPython -m pip install --quiet -r apps/api/requirements.txt
}
Invoke-Quietly "Installing the web interface" {
    Push-Location apps/web; & npm install --no-audit --no-fund; Pop-Location
}
Invoke-Quietly "Starting the database" {
    & docker compose up -d db
    $ready = $false
    foreach ($i in 1..60) {
        & docker compose exec -T db pg_isready -U discovery -d discovery *>$null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw "the database did not become ready" }
}
Invoke-Quietly "Creating the database tables" {
    Push-Location apps/api; & $venvPython -m app.cli migrate; Pop-Location
}
Invoke-Quietly "Loading the example project" {
    Push-Location apps/api; & $venvPython -m app.cli seed; Pop-Location
}

# ── 6. Done ──────────────────────────────────────────────────

Write-Step "Step 6 of 6 - Ready"

if (-not (Get-EnvKey "ANTHROPIC_API_KEY")) {
    Write-Host ""
    Write-Warn "No AI key was set, so the app will run in limited mode."
    Write-Info "Run this setup again any time to add one."
}

Write-Host "`n  Setup is complete.`n" -ForegroundColor Green
Write-Host "  To use the platform:" -ForegroundColor White
Write-Host "    Double-click  start.bat  in this folder."
Write-Host "`n  It will open http://localhost:3000 in your browser." -ForegroundColor Cyan
Write-Host "`n  You only need to run setup once. After this, just start it.`n" -ForegroundColor DarkGray

$startNow = Read-Host "  Start it now? [Y/n]"
if ([string]::IsNullOrWhiteSpace($startNow) -or $startNow -match '^[Yy]') {
    & (Join-Path $PSScriptRoot "start.ps1")
}
