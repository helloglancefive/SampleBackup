# GlanceFive — Logs script
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor DarkCyan
Write-Host "  ║       GlanceFive  —  Live Logs           ║" -ForegroundColor DarkCyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop tailing." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Filter by service?  Examples:" -ForegroundColor DarkGray
Write-Host "    api          = API server" -ForegroundColor DarkGray
Write-Host "    worker       = Celery worker" -ForegroundColor DarkGray
Write-Host "    beat         = Celery beat scheduler" -ForegroundColor DarkGray
Write-Host "    cloudflared  = Tunnel status" -ForegroundColor DarkGray
Write-Host "    db           = PostgreSQL" -ForegroundColor DarkGray
Write-Host "    redis        = Redis" -ForegroundColor DarkGray
Write-Host "    flower       = Task monitor" -ForegroundColor DarkGray
Write-Host ""

$svc = (Read-Host "  Service name (or press Enter for all)").Trim()

Write-Host ""
Write-Host "  ── Logs ─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

if ($svc -eq "") {
    & docker compose -f docker-compose.local.yml --env-file .env.local logs -f --tail=50
} else {
    & docker compose -f docker-compose.local.yml --env-file .env.local logs -f --tail=50 $svc
}
