# Database Backup Script for APEX Performance
# Exports Supabase schema and optionally data

param(
    [string]$OutputDir = "backups",
    [switch]$IncludeData = $false,
    [string]$SupabaseProjectId = ""
)

$ErrorActionPreference = "Stop"

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$schemaFile = Join-Path $OutputDir "schema_$timestamp.sql"
$dataFile = Join-Path $OutputDir "data_$timestamp.sql"

Write-Host "Starting database backup..." -ForegroundColor Green

# Export schema
Write-Host "Exporting schema..." -ForegroundColor Yellow
$schemaContent = Get-Content "supabase\migrations\001_initial_schema.sql" -Raw
$schemaContent | Out-File -FilePath $schemaFile -Encoding UTF8
Write-Host "Schema exported to: $schemaFile" -ForegroundColor Green

if ($IncludeData) {
    Write-Host "Data export requires Supabase CLI or direct database access." -ForegroundColor Yellow
    Write-Host "To export data:" -ForegroundColor Yellow
    Write-Host "1. Use Supabase Dashboard > Database > Backups" -ForegroundColor Yellow
    Write-Host "2. Or use Supabase CLI: supabase db dump" -ForegroundColor Yellow
    Write-Host "3. Or use pg_dump with connection string" -ForegroundColor Yellow
    
    if ($SupabaseProjectId) {
        Write-Host "`nSupabase Project ID: $SupabaseProjectId" -ForegroundColor Cyan
        Write-Host "Access your project at: https://supabase.com/dashboard/project/$SupabaseProjectId" -ForegroundColor Cyan
    }
}

Write-Host "`nBackup complete!" -ForegroundColor Green
Write-Host "Schema file: $schemaFile" -ForegroundColor Cyan

if ($IncludeData) {
    Write-Host "Data file: $dataFile (requires manual export)" -ForegroundColor Cyan
}

Write-Host "`nTo restore:" -ForegroundColor Yellow
Write-Host "1. Go to Supabase SQL Editor" -ForegroundColor Yellow
Write-Host "2. Copy contents of $schemaFile" -ForegroundColor Yellow
Write-Host "3. Execute in SQL Editor" -ForegroundColor Yellow

