# Covenant NOC - Development Server Startup Script
# Kills any existing processes on ports 3000 and 3001, then starts fresh

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  COVENANT NOC - Development Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to kill processes on a specific port
function Kill-Port {
    param([int]$Port)
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connections) {
        $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $processIds) {
            try {
                $process = Get-Process -Id $procId -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "  Killing $($process.ProcessName) (PID: $procId) on port $Port" -ForegroundColor Yellow
                    Stop-Process -Id $procId -Force -ErrorAction Stop
                }
            } catch {
                Write-Host "  Process $procId already terminated" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "  Port $Port is free" -ForegroundColor Green
    }
}

# Kill any existing node processes that might be stuck
Write-Host "[1/4] Cleaning up existing processes..." -ForegroundColor Magenta
Kill-Port -Port 3000
Kill-Port -Port 3001

# Also kill any orphaned node processes running our scripts
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "covenant-noc" -or $_.CommandLine -match "vite" -or $_.CommandLine -match "server/index.js"
}
if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        Write-Host "  Killing orphaned node process (PID: $($proc.Id))" -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 1

# Verify ports are free
Write-Host ""
Write-Host "[2/4] Verifying ports are free..." -ForegroundColor Magenta
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue

if ($port3000 -or $port3001) {
    Write-Host "  WARNING: Some ports still in use. Waiting..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}

Write-Host "  Ports 3000 and 3001 are ready" -ForegroundColor Green

# Check Docker database
Write-Host ""
Write-Host "[3/4] Checking Docker database..." -ForegroundColor Magenta
$dockerContainer = docker ps --filter "name=covenant_noc_db" --format "{{.Names}}" 2>$null
if ($dockerContainer) {
    Write-Host "  Database container is running" -ForegroundColor Green
} else {
    Write-Host "  Starting database container..." -ForegroundColor Yellow
    docker-compose up -d 2>$null
    Start-Sleep -Seconds 2
    Write-Host "  Database container started" -ForegroundColor Green
}

# Start the development servers
Write-Host ""
Write-Host "[4/4] Starting development servers..." -ForegroundColor Magenta
Write-Host ""
Write-Host "  Backend:  http://localhost:3000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop all servers" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Run npm dev (which runs both servers concurrently)
npm run dev

