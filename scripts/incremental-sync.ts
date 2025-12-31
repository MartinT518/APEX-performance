/**
 * Incremental Sync Script
 * 
 * Only syncs new data from Garmin API for days that pass (not historical).
 * Checks last imported date from database and fetches only data after that date.
 * 
 * Usage:
 *   tsx scripts/incremental-sync.ts
 */

// Load environment variables from .env.local FIRST
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Verify Supabase env vars are set before importing supabase.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     process.env.SUPABASE_ANON_KEY ||
                     process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase environment variables');
  console.error('   Please set in .env.local:');
  console.error('     - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)');
  console.error('     - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

// Now safe to import supabase
import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { syncGarminWellnessToDatabaseMCP } from '@/modules/monitor/ingestion/garminSyncMCP';
import { syncGarminSessionsToDatabaseMCP } from '@/modules/monitor/ingestion/garminSyncMCP';

/**
 * Gets the last imported date from database
 */
async function getLastImportedDate(userId: string): Promise<string | null> {
  const supabase = await createServerClient();
  
  // Get last date from daily_monitoring
  const { data: lastMonitoring } = await supabase
    .from('daily_monitoring')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  // Get last date from session_logs
  const { data: lastSession } = await supabase
    .from('session_logs')
    .select('session_date')
    .eq('user_id', userId)
    .order('session_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  // Use the most recent date
  const dates = [
    lastMonitoring?.date,
    lastSession?.session_date
  ].filter((d): d is string => d !== null && d !== undefined);
  
  if (dates.length === 0) {
    return null; // No data imported yet
  }
  
  // Return most recent date
  return dates.sort().reverse()[0];
}

/**
 * Performs incremental sync
 */
async function incrementalSync() {
  logger.info('Starting incremental sync...');
  
  const supabase = await createServerClient();
  
  // Get user ID
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    logger.error('Not authenticated. Please log in first.');
    process.exit(1);
  }
  
  const userId = user.id;
  
  // Get last imported date
  const lastImportedDate = await getLastImportedDate(userId);
  
  if (!lastImportedDate) {
    logger.warn('No historical data found. Use import-historical-data.ts first to import existing data.');
    logger.info('Syncing last 30 days as fallback...');
    
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    // Sync wellness
    logger.info('Syncing wellness data...');
    const wellnessResult = await syncGarminWellnessToDatabaseMCP(startDateStr, endDate, userId);
    logger.info(`Wellness: ${wellnessResult.synced} synced, ${wellnessResult.errors} errors`);
    
    // Sync sessions
    logger.info('Syncing activity data...');
    const sessionResult = await syncGarminSessionsToDatabaseMCP(startDateStr, endDate, userId);
    logger.info(`Sessions: ${sessionResult.synced} synced, ${sessionResult.errors} errors`);
    
    return;
  }
  
  // Calculate date range: from day after last imported to today
  const lastDate = new Date(lastImportedDate);
  lastDate.setDate(lastDate.getDate() + 1); // Start from next day
  const startDate = lastDate.toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];
  
  // Check if there's new data to sync
  if (startDate > endDate) {
    logger.info('No new data to sync. Last imported date is today or later.');
    return;
  }
  
  logger.info(`Syncing data from ${startDate} to ${endDate}...`);
  
  // Sync wellness data
  logger.info('Syncing wellness data...');
  const wellnessResult = await syncGarminWellnessToDatabaseMCP(startDate, endDate, userId);
  logger.info(`Wellness: ${wellnessResult.synced} synced, ${wellnessResult.errors} errors`);
  
  // Sync sessions
  logger.info('Syncing activity data...');
  const sessionResult = await syncGarminSessionsToDatabaseMCP(startDate, endDate, userId);
  logger.info(`Sessions: ${sessionResult.synced} synced, ${sessionResult.errors} errors`);
  
  logger.info('Incremental sync complete!');
}

// Run if executed directly
if (require.main === module) {
  incrementalSync().catch(error => {
    logger.error('Incremental sync failed:', error);
    process.exit(1);
  });
}

export { incrementalSync, getLastImportedDate };
