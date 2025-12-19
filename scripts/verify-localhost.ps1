# PowerShell script to verify localhost setup

Write-Host "🔍 Verifying Localhost Setup..." -ForegroundColor Cyan
Write-Host ""

$errors = @()
$warnings = @()

# Check 1: .env.local exists
Write-Host "1. Checking .env.local..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Write-Host "   ✅ .env.local exists" -ForegroundColor Green
    
    # Check for required variables
    $envContent = Get-Content ".env.local" -Raw
    
    $requiredVars = @(
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
        "SUPABASE_SECRET_DEFAULT_KEY"
    )
    
    foreach ($var in $requiredVars) {
        if ($envContent -match "$var=" -and $envContent -notmatch "$var=your-") {
            Write-Host "   ✅ $var is set" -ForegroundColor Green
        }
        else {
            $errors += "$var is missing or not configured"
            Write-Host "   ❌ $var is missing or not configured" -ForegroundColor Red
        }
    }
    
    # Check for optional Garmin vars
    if ($envContent -match "GARMIN_EMAIL=" -and $envContent -notmatch "GARMIN_EMAIL=your-") {
        Write-Host "   ✅ GARMIN_EMAIL is set" -ForegroundColor Green
    }
    else {
        $warnings += "GARMIN_EMAIL not set (app will run in simulation mode)"
        Write-Host "   ⚠️  GARMIN_EMAIL not set (optional)" -ForegroundColor Yellow
    }
    
}
else {
    $errors += ".env.local file not found"
    Write-Host "   ❌ .env.local not found" -ForegroundColor Red
    Write-Host "   💡 Run: .\scripts\setup-env.ps1" -ForegroundColor Cyan
}

Write-Host ""

# Check 2: node_modules exists
Write-Host "2. Checking npm dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   ✅ node_modules exists" -ForegroundColor Green
}
else {
    $errors += "node_modules not found - run 'npm install'"
    Write-Host "   ❌ node_modules not found" -ForegroundColor Red
    Write-Host "   💡 Run: npm install" -ForegroundColor Cyan
}

Write-Host ""

# Check 3: Garmin MCP server setup
Write-Host "3. Checking Garmin MCP server..." -ForegroundColor Yellow
if (Test-Path "garmin-connect-mcp-main") {
    Write-Host "   ✅ garmin-connect-mcp-main directory exists" -ForegroundColor Green
    
    if (Test-Path "garmin-connect-mcp-main\.env") {
        Write-Host "   ✅ Garmin MCP .env file exists" -ForegroundColor Green
    }
    else {
        $warnings += "Garmin MCP .env not found (optional for MCP server)"
        Write-Host "   ⚠️  Garmin MCP .env not found (optional)" -ForegroundColor Yellow
    }
}
else {
    $warnings += "garmin-connect-mcp-main directory not found (optional)"
    Write-Host "   ⚠️  garmin-connect-mcp-main not found (optional)" -ForegroundColor Yellow
}

Write-Host ""

# Check 4: Python for MCP (optional)
Write-Host "4. Checking Python (for Garmin MCP)..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python 3\.(1[1-9]|[2-9][0-9])") {
        Write-Host "   ✅ Python 3.11+ found: $pythonVersion" -ForegroundColor Green
    }
    else {
        $warnings += "Python version may be too old (need 3.11+)"
        Write-Host "   ⚠️  Python found but version may be too old: $pythonVersion" -ForegroundColor Yellow
    }
}
catch {
    $warnings += "Python not found (optional for Garmin MCP)"
    Write-Host "   ⚠️  Python not found (optional)" -ForegroundColor Yellow
}

Write-Host ""

# Check 5: Supabase migration
Write-Host "5. Checking Supabase migration file..." -ForegroundColor Yellow
if (Test-Path "supabase\migrations\001_initial_schema.sql") {
    Write-Host "   ✅ Migration file exists" -ForegroundColor Green
    Write-Host "   💡 Make sure to run this in Supabase SQL Editor" -ForegroundColor Cyan
}
else {
    $errors += "Migration file not found"
    Write-Host "   ❌ Migration file not found" -ForegroundColor Red
}

Write-Host ""

# Summary
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host ""

if ($errors.Count -eq 0) {
    Write-Host "✅ All required checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Make sure Supabase migration is run" -ForegroundColor White
    Write-Host "2. Start dev server: npm run dev" -ForegroundColor White
    Write-Host "3. Open http://localhost:3000" -ForegroundColor White
}
else {
    Write-Host "❌ Found $($errors.Count) error(s):" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "   - $error" -ForegroundColor Red
    }
}

if ($warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Warnings ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "   - $warning" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "For detailed setup instructions, see LOCALHOST_SETUP.md" -ForegroundColor Cyan


