# PowerShell script to kill processes on ports 3000 and 3001
# Run this before starting the dev server

Write-Host "🔪 Killing processes on ports 3000 and 3001..." -ForegroundColor Yellow
Write-Host ""

function Kill-Port {
    param([int]$Port)
    
    $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    
    if ($processes) {
        foreach ($pid in $processes) {
            try {
                Stop-Process -Id $pid -Force -ErrorAction Stop
                Write-Host "✓ Killed process $pid on port $Port" -ForegroundColor Green
            } catch {
                Write-Host "  Process $pid already terminated" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "✓ Port $Port is free" -ForegroundColor Green
    }
}

Kill-Port -Port 3000
Kill-Port -Port 3001

Write-Host ""
Write-Host "✅ Done! Ports should be free now." -ForegroundColor Green
Write-Host "You can now run: npm run dev" -ForegroundColor Cyan
Write-Host ""

