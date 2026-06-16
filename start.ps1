# GlanceFive - Start All Services
# Run from project root: .\start.ps1
# Or double-click -> right-click -> Run with PowerShell

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir  = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

$BackendPort  = 8000
$FrontendPort = 5173

function Info { param($m) Write-Host "  $m" -ForegroundColor Cyan }
function OK   { param($m) Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn { param($m) Write-Host "  [!]  $m" -ForegroundColor Yellow }

Clear-Host
Write-Host ""
Write-Host "  ======================================" -ForegroundColor Magenta
Write-Host "     GlanceFive  -  Starting Services   " -ForegroundColor Magenta
Write-Host "  ======================================" -ForegroundColor Magenta
Write-Host ""

# Kill anything already on our ports
function Kill-Port {
    param([int]$Port)
    $lines = netstat -ano | Select-String ":$Port\s"
    foreach ($line in $lines) {
        $parts = ($line.ToString() -split '\s+') | Where-Object { $_ -ne '' }
        $pid2  = $parts[-1]
        if ($pid2 -match '^\d+$' -and $pid2 -ne '0') {
            try { Stop-Process -Id ([int]$pid2) -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
}

Info "Clearing ports $BackendPort and $FrontendPort ..."
Kill-Port $BackendPort
Kill-Port $FrontendPort
Start-Sleep -Milliseconds 800

# -----------------------------------------------------------------------
# 1. Backend - FastAPI / uvicorn
# -----------------------------------------------------------------------
Info "Starting backend (FastAPI on port $BackendPort) ..."

$backendCmd = "cd '$BackendDir'; python -m uvicorn main:app --host 0.0.0.0 --port $BackendPort --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "`$host.UI.RawUI.WindowTitle = 'GlanceFive - Backend :$BackendPort'; $backendCmd"

# Wait up to 40s for backend health (--reload mode takes ~25s to start)
$backendReady = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$BackendPort/api/health" `
             -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $backendReady = $true; break }
    } catch {}
}

if ($backendReady) {
    OK "Backend ready   ->  http://localhost:$BackendPort"
} else {
    Warn "Backend window opened - check its terminal if there are errors."
}

# -----------------------------------------------------------------------
# 2. Frontend - Vite dev server
# -----------------------------------------------------------------------
Info "Starting frontend (Vite on port $FrontendPort) ..."

$frontendCmd = "cd '$FrontendDir'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "`$host.UI.RawUI.WindowTitle = 'GlanceFive - Frontend :$FrontendPort'; $frontendCmd"

# Wait up to 30s for Vite
$frontendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$FrontendPort" `
             -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -lt 500) { $frontendReady = $true; break }
    } catch {}
}

if ($frontendReady) {
    OK "Frontend ready  ->  http://localhost:$FrontendPort"
} else {
    Warn "Frontend window opened - check its terminal if there are errors."
}

# -----------------------------------------------------------------------
# 3. Redis + Celery (optional - skipped if Redis not installed)
# -----------------------------------------------------------------------
$redisExe = @(
    "C:\Program Files\Redis\redis-server.exe",
    "C:\tools\redis\redis-server.exe",
    "C:\redis\redis-server.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($redisExe) {
    Info "Starting Redis ..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", `
        "`$host.UI.RawUI.WindowTitle = 'GlanceFive - Redis'; & '$redisExe'"

    Start-Sleep -Seconds 2

    Info "Starting Celery worker + beat ..."
    $celeryCmd = "cd '$BackendDir'; python -m celery -A celery_app worker --beat --loglevel=info"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", `
        "`$host.UI.RawUI.WindowTitle = 'GlanceFive - Celery'; $celeryCmd"

    OK "Redis + Celery started"
} else {
    Warn "Redis not installed - async fetch queue (Celery) skipped."
    Warn "Install Redis for Windows to enable scheduled fetches:"
    Warn "  https://github.com/microsoftarchive/redis/releases"
}

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------
Write-Host ""
Write-Host "  ======================================" -ForegroundColor Magenta
Write-Host "     All Services Status" -ForegroundColor Magenta
Write-Host "  ======================================" -ForegroundColor Magenta
Write-Host ""

if ($backendReady)  { OK "Backend   http://localhost:$BackendPort/docs" }
else                { Warn "Backend   http://localhost:$BackendPort  (check terminal)" }

if ($frontendReady) { OK "Frontend  http://localhost:$FrontendPort" }
else                { Warn "Frontend  http://localhost:$FrontendPort  (check terminal)" }

if ($redisExe)      { OK "Redis     localhost:6379" }
else                { Warn "Redis     not installed (Celery disabled)" }

Write-Host ""
Info "Open your browser:  http://localhost:$FrontendPort"
Write-Host ""
Write-Host "  Press any key to close this window ..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
