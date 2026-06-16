# GlanceFive - Start script
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

function Step { param($n, $m) Write-Host "  [$n/5] $m" -ForegroundColor Cyan }
function OK   { param($m)    Write-Host "  [OK]  $m" -ForegroundColor Green }
function Warn { param($m)    Write-Host "  [!!]  $m" -ForegroundColor Yellow }
function Fail { param($m)    Write-Host "  [ERR] $m" -ForegroundColor Red }
function Line {               Write-Host "  --------------------------------------------" -ForegroundColor DarkGray }

Clear-Host
Write-Host ""
Write-Host "  GlanceFive - Launcher" -ForegroundColor DarkCyan
Write-Host ""

# Step 1: Validate .env.local
Step 1 "Checking .env.local ..."

if (-not (Test-Path ".env.local")) {
    Fail ".env.local not found!"
    Write-Host "  See LOCAL_SETUP.md to create it." -ForegroundColor DarkGray
    Read-Host "`n  Press Enter to exit"
    exit 1
}

$envContent = Get-Content ".env.local" -Raw
if ($envContent -match "REPLACE_ME") {
    Warn ".env.local has unfilled values. Opening in Notepad..."
    Start-Process notepad ".env.local" -Wait
    $envContent = Get-Content ".env.local" -Raw
    if ($envContent -match "REPLACE_ME") {
        Fail "Still has REPLACE_ME values. Fix them and try again."
        Read-Host "`n  Press Enter to exit"
        exit 1
    }
}
OK ".env.local is ready"

# Step 2: Docker Desktop
Step 2 "Checking Docker Desktop ..."

$dockerRunning = $false
try { $null = & docker info 2>&1; if ($LASTEXITCODE -eq 0) { $dockerRunning = $true } } catch {}

if (-not $dockerRunning) {
    Warn "Docker Desktop is not running. Starting it..."

    $dockerPaths = @(
        "C:\Program Files\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    )
    $dockerExe = $dockerPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $dockerExe) {
        Fail "Docker Desktop not found. Please install it."
        Read-Host "`n  Press Enter to exit"
        exit 1
    }

    Start-Process $dockerExe
    Write-Host "  Waiting for Docker to start (up to 90s)..." -ForegroundColor DarkGray

    $waited = 0
    do {
        Start-Sleep -Seconds 5
        $waited += 5
        try { $null = & docker info 2>&1; if ($LASTEXITCODE -eq 0) { $dockerRunning = $true; break } } catch {}
        Write-Host "    ... ${waited}s" -ForegroundColor DarkGray
    } while ($waited -lt 90)

    if (-not $dockerRunning) {
        Fail "Docker did not start. Please start it manually and try again."
        Read-Host "`n  Press Enter to exit"
        exit 1
    }
}
OK "Docker Desktop is running"

# Step 3: Start containers
Step 3 "Preparing containers ..."

$volumes = & docker volume ls --format "{{.Name}}" 2>&1
$isFirstRun = ($volumes | Where-Object { $_ -match "pg_data" }).Count -eq 0

if ($isFirstRun) {
    Write-Host "  First run - building images (5-10 min, only once)." -ForegroundColor DarkGray
    & docker compose -f docker-compose.local.yml --env-file .env.local up -d --build
} else {
    Write-Host "  Existing install - starting quickly." -ForegroundColor DarkGray
    & docker compose -f docker-compose.local.yml --env-file .env.local up -d
}

if ($LASTEXITCODE -ne 0) {
    Fail "docker compose failed. Run LOGS.bat to see why."
    Read-Host "`n  Press Enter to exit"
    exit 1
}
OK "Containers started"

# Step 4: Wait for API health
Step 4 "Waiting for API to be ready ..."

$ready = $false
$attempts = 0
do {
    Start-Sleep -Seconds 5
    $attempts++
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Write-Host "    ... $($attempts * 5)s" -ForegroundColor DarkGray
} while ($attempts -lt 36)

if ($ready) { OK "API is healthy" }
else { Warn "API not responding after 3 min - check LOGS.bat" }

# Step 5: Check Cloudflare Tunnel
Step 5 "Checking Cloudflare Tunnel ..."

$tunnelOk = $false
try {
    $t = Invoke-WebRequest -Uri "https://api.glancefive.com/api/health" -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
    if ($t.StatusCode -eq 200) { $tunnelOk = $true }
} catch {}

if ($tunnelOk) { OK "Tunnel connected - clients can reach the app" }
else {
    Warn "Tunnel not reachable yet (api.glancefive.com)"
    Write-Host "  Usually connects in 30s - check cloudflared in LOGS.bat" -ForegroundColor DarkGray
}

# Summary
Write-Host ""
Line
Write-Host ""
Write-Host "  GlanceFive is RUNNING" -ForegroundColor Green
Write-Host ""
Write-Host "  Client app  ->  https://app.glancefive.com" -ForegroundColor White
Write-Host "  API         ->  https://api.glancefive.com" -ForegroundColor White
Write-Host "  Health      ->  http://localhost:8000/api/health" -ForegroundColor DarkGray
Write-Host "  Tasks       ->  http://localhost:5555" -ForegroundColor DarkGray
Write-Host "  API docs    ->  http://localhost:8000/api/docs" -ForegroundColor DarkGray
Write-Host ""
Line
Write-Host ""
Write-Host "  STOP.bat = stop  |  LOGS.bat = logs  |  REBUILD.bat = after code changes" -ForegroundColor DarkGray
Write-Host ""

Start-Process "http://localhost:8000/api/health"
Read-Host "  Press Enter to close"
