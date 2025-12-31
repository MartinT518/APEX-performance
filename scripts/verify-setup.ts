/**
 * Setup Verification Script
 * 
 * Verifies that all prerequisites are met before running the import:
 * - Environment variables are set
 * - Database migrations are applied
 * - JSON files exist and are valid
 * - User is authenticated
 */

// Load environment variables from .env.local FIRST, before any other imports
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { logger } from '@/lib/logger';
import * as fs from 'fs';

// Use console for CLI output (logger might not be configured for scripts)
const log = {
  info: (...args: any[]) => console.log(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
  debug: (...args: any[]) => console.debug(...args)
};

// Import supabase client only when needed (after env vars are loaded)
// We'll dynamically import it to avoid the module-level error check
let createServerClient: typeof import('@/lib/supabase').createServerClient;

interface VerificationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

async function verifyEnvironmentVariables(): Promise<VerificationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required env vars
  if (!process.env.GEMINI_API_KEY) {
    errors.push('GEMINI_API_KEY is not set');
  }
  
  if (!process.env.HEALTH_DATA_PATH) {
    errors.push('HEALTH_DATA_PATH is not set in .env.local');
  }
  
  if (!process.env.ACTIVITY_DATA_PATH) {
    errors.push('ACTIVITY_DATA_PATH is not set in .env.local');
  }
  
  if (!process.env.ACTIVITY_DETAILS_PATH) {
    warnings.push('ACTIVITY_DETAILS_PATH is not set (optional, but recommended)');
  }
  
  // Check Supabase vars
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    errors.push('Supabase URL is not set (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL)');
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY && 
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('Supabase API key is not set');
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

async function verifyJsonFiles(): Promise<VerificationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const healthPath = process.env.HEALTH_DATA_PATH;
  const activityPath = process.env.ACTIVITY_DATA_PATH;
  const detailsPath = process.env.ACTIVITY_DETAILS_PATH;
  
  // Check health data file
  if (healthPath) {
    if (!fs.existsSync(healthPath)) {
      errors.push(`Health data file not found: ${healthPath}`);
    } else {
      try {
        const content = fs.readFileSync(healthPath, 'utf-8');
        const data = JSON.parse(content);
        if (!Array.isArray(data)) {
          errors.push('Health data file must be a JSON array');
        } else {
          log.info(`✅ Health data file valid: ${data.length} records`);
        }
      } catch (e: any) {
        errors.push(`Health data file is not valid JSON: ${e.message}`);
      }
    }
  }
  
  // Check activity data file
  if (activityPath) {
    if (!fs.existsSync(activityPath)) {
      errors.push(`Activity data file not found: ${activityPath}`);
    } else {
      try {
        const content = fs.readFileSync(activityPath, 'utf-8');
        const data = JSON.parse(content);
        if (!Array.isArray(data)) {
          errors.push('Activity data file must be a JSON array');
        } else {
          log.info(`✅ Activity data file valid: ${data.length} records`);
        }
      } catch (e: any) {
        errors.push(`Activity data file is not valid JSON: ${e.message}`);
      }
    }
  }
  
  // Check activity details file (optional)
  if (detailsPath) {
    if (!fs.existsSync(detailsPath)) {
      warnings.push(`Activity details file not found: ${detailsPath} (optional)`);
    } else {
      try {
        const content = fs.readFileSync(detailsPath, 'utf-8');
        const data = JSON.parse(content);
        if (typeof data !== 'object' || Array.isArray(data)) {
          warnings.push('Activity details should be a JSON object (not array)');
        } else {
          const count = Object.keys(data).length;
          log.info(`✅ Activity details file valid: ${count} records`);
        }
      } catch (e: any) {
        warnings.push(`Activity details file is not valid JSON: ${e.message}`);
      }
    }
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

async function verifyDatabaseMigrations(): Promise<VerificationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Skip if Supabase not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    warnings.push('Skipping database check - Supabase not configured');
    return { passed: true, errors, warnings };
  }
  
  try {
    if (!createServerClient) {
      createServerClient = (await import('@/lib/supabase')).createServerClient;
    }
    const supabase = await createServerClient();
    
    // Check if new columns exist
    const { data: monitoringColumns, error: monitoringError } = await supabase
      .from('daily_monitoring')
      .select('hrv_method, body_battery, training_readiness, stress_score')
      .limit(1);
    
    if (monitoringError) {
      // Check if it's a column error
      if (monitoringError.message.includes('column') && monitoringError.message.includes('does not exist')) {
        errors.push('Database migrations not applied. Missing columns in daily_monitoring table.');
        errors.push('Please run migrations 006, 007, 008, 009 in Supabase SQL Editor.');
      } else {
        errors.push(`Database error: ${monitoringError.message}`);
      }
    } else {
      log.info('✅ daily_monitoring table has new columns');
    }
    
    // Check session_logs columns
    const { data: sessionColumns, error: sessionError } = await supabase
      .from('session_logs')
      .select('hr_source, device')
      .limit(1);
    
    if (sessionError) {
      if (sessionError.message.includes('column') && sessionError.message.includes('does not exist')) {
        errors.push('Database migrations not applied. Missing columns in session_logs table.');
      }
    } else {
      log.info('✅ session_logs table has new columns');
    }
    
  } catch (error: any) {
    errors.push(`Failed to verify database: ${error.message}`);
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

async function verifyAuthentication(): Promise<VerificationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Skip if Supabase not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    warnings.push('Skipping authentication check - Supabase not configured');
    return { passed: true, errors, warnings };
  }
  
  try {
    // Check env vars before importing (supabase.ts throws on import if missing)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
                         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                         process.env.SUPABASE_ANON_KEY ||
                         process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      errors.push('Supabase environment variables not set');
      return { passed: false, errors, warnings };
    }
    
    if (!createServerClient) {
      createServerClient = (await import('@/lib/supabase')).createServerClient;
    }
    const supabase = await createServerClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // For CLI scripts, authentication is optional (user can log in via app)
    // This is just a warning, not an error
    if (userError || !user) {
      warnings.push('Not authenticated in CLI context (this is normal)');
      warnings.push('You will need to log in via the web app before running import');
      warnings.push('Or use SUPABASE_SECRET_DEFAULT_KEY for service role access');
    } else {
      log.info(`✅ Authenticated as user: ${user.id}`);
    }
  } catch (error: any) {
    // Authentication errors are warnings for CLI scripts
    warnings.push(`Authentication check failed: ${error.message}`);
    warnings.push('This is normal for CLI scripts - you can log in via the web app');
  }
  
  return {
    passed: true, // Don't fail verification on auth - it's expected for CLI
    errors,
    warnings
  };
}

async function main() {
  log.info('🔍 Verifying setup...\n');
  
  const results: VerificationResult[] = [];
  
  // 1. Check environment variables
  log.info('1. Checking environment variables...');
  const envResult = await verifyEnvironmentVariables();
  results.push(envResult);
  
  // 2. Check JSON files
  log.info('\n2. Checking JSON files...');
  const jsonResult = await verifyJsonFiles();
  results.push(jsonResult);
  
  // 3. Check database migrations
  log.info('\n3. Checking database migrations...');
  const dbResult = await verifyDatabaseMigrations();
  results.push(dbResult);
  
  // 4. Check authentication
  log.info('\n4. Checking authentication...');
  const authResult = await verifyAuthentication();
  results.push(authResult);
  
  // Summary
  log.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log.info('Verification Summary:');
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  
  results.forEach(result => {
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  });
  
  if (allErrors.length === 0) {
    log.info('✅ All checks passed! Ready to import data.\n');
    log.info('Next step: Run the import script:');
    log.info('  npx tsx scripts/import-historical-data.ts\n');
    log.info('Note: You may need to log in via the web app first, or use:');
    log.info('  npx tsx scripts/import-historical-data.ts --user-id=<your-user-id>\n');
    process.exit(0);
  } else {
    log.error('❌ Found errors:\n');
    allErrors.forEach(error => {
      log.error(`  - ${error}`);
    });
    
    if (allWarnings.length > 0) {
      log.warn('\n⚠️  Warnings:\n');
      allWarnings.forEach(warning => {
        log.warn(`  - ${warning}`);
      });
    }
    
    log.info('\nPlease fix the errors above before running the import.\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    logger.error('Verification failed:', error);
    process.exit(1);
  });
}

export { verifyEnvironmentVariables, verifyJsonFiles, verifyDatabaseMigrations, verifyAuthentication };
