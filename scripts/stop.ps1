# GlanceFive — Stop script
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor DarkCyan
Write-Host "  ║       GlanceFive  —  Stopping            ║" -ForegroundColor DarkCyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor DarkCyan
Write-Host ""

Write-Host "  Stopping all containers..." -ForegroundColor Cyan

& docker compose -f docker-compose.local.yml --env-file .env.local down

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "  [OK] All services stopped." -ForegroundColor Green
    Write-Host "       Your data is safe — PostgreSQL volume is preserved." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  To start again: double-click START.bat" -ForegroundColor DarkGray
} else {
    Write-Host ""
    Write-Host "  [!!] Something went wrong. Is Docker Desktop running?" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "  Press Enter to close"
