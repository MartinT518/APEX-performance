# PowerShell script to sync Garmin credentials from .env.local to garmin-connect-mcp-main/.env

Write-Host "🔄 Syncing Garmin credentials to MCP server..." -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "❌ .env.local not found!" -ForegroundColor Red
    Write-Host "   Please create .env.local first with Garmin credentials" -ForegroundColor Yellow
    exit 1
}

# Read .env.local
$envLocal = Get-Content ".env.local" -Raw

# Extract Garmin credentials
$garminEmail = ""
$garminPassword = ""

if ($envLocal -match "GARMIN_EMAIL=(.+)") {
    $garminEmail = $matches[1].Trim()
    # Remove quotes if present
    $garminEmail = $garminEmail -replace '^["'']|["'']$', ''
}

if ($envLocal -match "GARMIN_PASSWORD=(.+)") {
    $garminPassword = $matches[1].Trim()
    # Remove quotes if present
    $garminPassword = $garminPassword -replace '^["'']|["'']$', ''
}

# Check if credentials were found
if (-not $garminEmail -or $garminEmail -eq "your-email@example.com" -or $garminEmail -eq "") {
    Write-Host "⚠️  GARMIN_EMAIL not found or not configured in .env.local" -ForegroundColor Yellow
    Write-Host "   Skipping sync..." -ForegroundColor Yellow
    exit 0
}

if (-not $garminPassword -or $garminPassword -eq "your-password-here" -or $garminPassword -eq "") {
    Write-Host "⚠️  GARMIN_PASSWORD not found or not configured in .env.local" -ForegroundColor Yellow
    Write-Host "   Skipping sync..." -ForegroundColor Yellow
    exit 0
}

# Check if garmin-connect-mcp-main directory exists
if (-not (Test-Path "garmin-connect-mcp-main")) {
    Write-Host "❌ garmin-connect-mcp-main directory not found!" -ForegroundColor Red
    Write-Host "   Make sure the MCP server is in the project root" -ForegroundColor Yellow
    exit 1
}

# Create or update .env file in garmin-connect-mcp-main
$mcpEnvPath = "garmin-connect-mcp-main\.env"

# Check if .env already exists
$existingContent = ""
if (Test-Path $mcpEnvPath) {
    $existingContent = Get-Content $mcpEnvPath -Raw
    Write-Host "📝 Updating existing .env file..." -ForegroundColor Yellow
}
else {
    Write-Host "📝 Creating new .env file..." -ForegroundColor Yellow
}

# Create/update .env content
$envContent = @"
# Garmin Connect MCP Server Configuration
# Auto-generated from .env.local - DO NOT EDIT MANUALLY
# Run scripts/sync-garmin-env.ps1 to update

GARMIN_EMAIL=$garminEmail
GARMIN_PASSWORD=$garminPassword
"@

$envContent | Out-File -FilePath $mcpEnvPath -Encoding utf8 -NoNewline

Write-Host "✅ Successfully synced Garmin credentials to garmin-connect-mcp-main/.env" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Navigate to garmin-connect-mcp-main directory" -ForegroundColor White
Write-Host "2. Run: uv run garmin-connect-mcp-auth (first time only)" -ForegroundColor White
Write-Host "3. The MCP server will use these credentials automatically" -ForegroundColor White

