param(
  [int]$Port = 3000,
  [switch]$Force,
  [switch]$VerboseOutput
)

function Write-Info($message) {
  if ($VerboseOutput) { Write-Host $message }
}

try {
  $connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop
} catch {
  Write-Warning "No listener found on port $Port."
  exit 0
}

$targets = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $targets) {
  try {
    $proc = Get-Process -Id $processId -ErrorAction Stop
    Write-Info "Killing PID $processId ($($proc.ProcessName))."
    if ($Force) {
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } else {
      Stop-Process -Id $processId -ErrorAction Stop
    }
    Write-Host "Released port $Port from PID $processId."
  } catch {
    Write-Warning "Failed to terminate PID $processId`: $($_.Exception.Message)"
  }
}
