# GlanceFive — Rebuild script
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor DarkCyan
Write-Host "  ║       GlanceFive  —  Rebuild             ║" -ForegroundColor DarkCyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Use this after:" -ForegroundColor DarkGray
Write-Host "    - Pulling new code (git pull)" -ForegroundColor DarkGray
Write-Host "    - Adding Python packages to requirements.txt" -ForegroundColor DarkGray
Write-Host "    - Adding new database migrations" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  This will:" -ForegroundColor DarkGray
Write-Host "    1. Stop running containers" -ForegroundColor DarkGray
Write-Host "    2. Rebuild images (uses cache — usually 1-2 min)" -ForegroundColor DarkGray
Write-Host "    3. Run any new database migrations automatically" -ForegroundColor DarkGray
Write-Host "    4. Restart everything" -ForegroundColor DarkGray
Write-Host ""

$confirm = Read-Host "  Type YES to continue"
if ($confirm -ne "YES") {
    Write-Host "  Cancelled." -ForegroundColor DarkGray
    Read-Host "  Press Enter to close"
    exit 0
}

Write-Host ""
Write-Host "  [1/2] Rebuilding and restarting..." -ForegroundColor Cyan
& docker compose -f docker-compose.local.yml --env-file .env.local up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  [ERR] Rebuild failed. Check output above." -ForegroundColor Red
    Write-Host "        Run LOGS.bat to see container logs." -ForegroundColor DarkGray
    Read-Host "  Press Enter to close"
    exit 1
}

Write-Host ""
Write-Host "  [2/2] Waiting for API health check..." -ForegroundColor Cyan

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 5
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Write-Host ("    ... {0}s" -f (($i + 1) * 5)) -ForegroundColor DarkGray
}

Write-Host ""
if ($ready) {
    Write-Host "  [OK] Rebuild complete — GlanceFive is running." -ForegroundColor Green
} else {
    Write-Host "  [!!] API not responding yet. Check LOGS.bat for errors." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "  Press Enter to close"
