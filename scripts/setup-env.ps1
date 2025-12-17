# PowerShell script to create .env.local from template

if (Test-Path ".env.local") {
    Write-Host "⚠️  .env.local already exists. Skipping..." -ForegroundColor Yellow
    exit 0
}

Write-Host "📝 Creating .env.local from template..." -ForegroundColor Cyan

@"
# ============================================
# APEX Performance - Environment Variables
# ============================================
# Fill in your actual values below

# Supabase Configuration
# Get these from: https://app.supabase.com/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# New API Key Format (2025+) - Recommended
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key-here

# Legacy format (still supported)
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Secret key for server-side operations (keep secret!)
# New format: SUPABASE_SECRET_DEFAULT_KEY
SUPABASE_SECRET_DEFAULT_KEY=your-secret-key-here
# Legacy format: SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Garmin Connect (Optional - for data ingestion)
GARMIN_EMAIL=your-email@example.com
GARMIN_PASSWORD=your-password-here
"@ | Out-File -FilePath ".env.local" -Encoding utf8

Write-Host "✅ Created .env.local" -ForegroundColor Green
Write-Host "📋 Please edit .env.local and fill in your actual credentials" -ForegroundColor Yellow
Write-Host "📖 See ENV_TEMPLATE.md for detailed documentation" -ForegroundColor Cyan

Write-Host "See ENV_TEMPLATE.md for detailed documentation" -ForegroundColor Cyan

