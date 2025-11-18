# PowerShell Script for Windows
# Save as: setup-yap-cursor.ps1
# Run in PowerShell: .\setup-yap-cursor.ps1

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Yap for Cursor - Automated Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clone the repository
Write-Host "Step 1: Cloning Yap for Cursor repository..." -ForegroundColor Green
$installDir = "$HOME\yap-for-cursor"

if (Test-Path $installDir) {
    Write-Host "Directory already exists. Pulling latest changes..." -ForegroundColor Yellow
    Set-Location $installDir
    git pull
} else {
    git clone https://github.com/avarayr/yap-for-cursor.git $installDir
    Set-Location $installDir
}

Write-Host "✓ Repository cloned successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Install Custom CSS and JS Loader extension
Write-Host "Step 2: Installing Custom CSS and JS Loader extension..." -ForegroundColor Green

# Try installing to Cursor directly
$cursorPath = "${env:LOCALAPPDATA}\Programs\Cursor\resources\app\bin\cursor.cmd"
if (Test-Path $cursorPath) {
    & $cursorPath --install-extension be5invis.vscode-custom-css
} else {
    # Fallback to code command
    code --install-extension be5invis.vscode-custom-css
}

Write-Host "✓ Extension installed" -ForegroundColor Green
Write-Host ""

# Step 3: Configure settings.json
Write-Host "Step 3: Configuring Cursor settings..." -ForegroundColor Green

$settingsPath = "$env:APPDATA\Cursor\User\settings.json"
$jsFilePath = "$installDir\dist\yap-for-cursor.js"

# Convert to file:/// URI with forward slashes
$jsFilePath = $jsFilePath -replace '\\', '/'
$jsFilePath = "file:///$jsFilePath"

Write-Host "JavaScript file path: $jsFilePath" -ForegroundColor Blue
Write-Host ""

# Create config directory if it doesn't exist
$configDir = Split-Path -Parent $settingsPath
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

# Check if settings.json exists
if (-not (Test-Path $settingsPath)) {
    "{}" | Out-File -FilePath $settingsPath -Encoding utf8
}

# Backup existing settings
Copy-Item $settingsPath "$settingsPath.backup" -Force
Write-Host "✓ Created backup: $settingsPath.backup" -ForegroundColor Blue

# Read and update settings
$settings = Get-Content $settingsPath -Raw | ConvertFrom-Json

# Add the configuration
if (-not $settings.'vscode_custom_css.imports') {
    $settings | Add-Member -MemberType NoteProperty -Name 'vscode_custom_css.imports' -Value @($jsFilePath) -Force
} else {
    Write-Host "vscode_custom_css.imports already exists. Adding to array..." -ForegroundColor Yellow
    $settings.'vscode_custom_css.imports' = @($jsFilePath)
}

# Save settings
$settings | ConvertTo-Json -Depth 10 | Out-File -FilePath $settingsPath -Encoding utf8
Write-Host "✓ Settings updated successfully" -ForegroundColor Green
Write-Host ""

Write-Host "=========================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Next Steps:" -ForegroundColor Yellow
Write-Host "1. Close Cursor completely (all windows)"
Write-Host "2. Reopen Cursor"
Write-Host "3. Press Ctrl+Shift+P"
Write-Host "4. Type 'Enable Custom CSS and JS'"
Write-Host "5. Select the command and restart Cursor again"
Write-Host ""
Write-Host "After that, you'll see a microphone button in the Cursor chat!" -ForegroundColor Blue
Write-Host ""
Write-Host "If you see a warning about Cursor being corrupted, that's normal." -ForegroundColor Yellow
Write-Host "Click 'Don't Show Again' - it's just because we modified the UI." -ForegroundColor Yellow
Write-Host ""
Write-Host "Installation directory: $installDir"
Write-Host "Settings file: $settingsPath"
Write-Host ""
Write-Host "Enjoy voice-to-text coding! 🎤" -ForegroundColor Cyan