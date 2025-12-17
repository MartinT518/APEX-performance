# Database Restore Script for APEX Performance
# Validates and provides instructions for restoring from backup

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file not found: $BackupFile"
    exit 1
}

Write-Host "Validating backup file..." -ForegroundColor Yellow

$content = Get-Content $BackupFile -Raw

# Basic validation
$hasCreateTable = $content -match "CREATE TABLE"
$hasCreateType = $content -match "CREATE TYPE"
$hasCreatePolicy = $content -match "CREATE POLICY"

if (-not $hasCreateTable) {
    Write-Warning "Backup file may not contain table definitions"
}

if (-not $hasCreateType) {
    Write-Warning "Backup file may not contain type definitions"
}

Write-Host "`nBackup file validation:" -ForegroundColor Green
Write-Host "  Tables: $(if ($hasCreateTable) { 'Found' } else { 'Not found' })" -ForegroundColor $(if ($hasCreateTable) { 'Green' } else { 'Red' })
Write-Host "  Types: $(if ($hasCreateType) { 'Found' } else { 'Not found' })" -ForegroundColor $(if ($hasCreateType) { 'Green' } else { 'Red' })
Write-Host "  Policies: $(if ($hasCreatePolicy) { 'Found' } else { 'Not found' })" -ForegroundColor $(if ($hasCreatePolicy) { 'Green' } else { 'Red' })

if ($DryRun) {
    Write-Host "`nDry run mode - no changes will be made" -ForegroundColor Cyan
    Write-Host "`nTo restore:" -ForegroundColor Yellow
    Write-Host "1. Go to Supabase Dashboard > SQL Editor" -ForegroundColor Yellow
    Write-Host "2. Copy contents of: $BackupFile" -ForegroundColor Yellow
    Write-Host "3. Paste and execute in SQL Editor" -ForegroundColor Yellow
    Write-Host "4. Verify tables were created successfully" -ForegroundColor Yellow
    exit 0
}

Write-Host "`nWARNING: This will overwrite existing database schema!" -ForegroundColor Red
$confirm = Read-Host "Type 'RESTORE' to confirm"

if ($confirm -ne "RESTORE") {
    Write-Host "Restore cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nManual restore required:" -ForegroundColor Yellow
Write-Host "1. Go to Supabase Dashboard > SQL Editor" -ForegroundColor Yellow
Write-Host "2. Copy contents of: $BackupFile" -ForegroundColor Yellow
Write-Host "3. Paste and execute in SQL Editor" -ForegroundColor Yellow
Write-Host "4. Verify tables were created successfully" -ForegroundColor Yellow
Write-Host "`nNote: This script does not execute SQL directly for safety." -ForegroundColor Cyan

