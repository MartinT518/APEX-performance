/**
 * Debug script to verify Garmin duration extraction and storage
 * 
 * This script:
 * 1. Loads existing session logs from database
 * 2. Checks duration_minutes values
 * 3. Logs raw metadata to see what's stored
 * 4. Helps identify where duration is being lost
 * 
 * Usage:
 *   npx tsx scripts/debug-garmin-duration.ts
 * 
 * Requires .env.local with Supabase credentials:
 *   SUPABASE_URL=...
 *   SUPABASE_SECRET_DEFAULT_KEY=... (or SUPABASE_SERVICE_ROLE_KEY)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

// Also try .env as fallback
if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  config({ path: resolve(process.cwd(), '.env') });
}

import { createServerClient } from '../src/lib/supabase';
import { logger } from '../src/lib/logger';

async function debugGarminDuration() {
  // Check environment variables
  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ Error: Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
    console.error('   Please set environment variables in .env.local');
    console.error('   Expected file: .env.local');
    console.error('   Required variables:');
    console.error('     - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)');
    console.error('     - SUPABASE_SECRET_DEFAULT_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }
  
  if (!process.env.SUPABASE_SECRET_DEFAULT_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing Supabase server key');
    console.error('   Please set SUPABASE_SECRET_DEFAULT_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    console.error('   Note: Do NOT use client-side keys (NEXT_PUBLIC_*) for this script');
    process.exit(1);
  }
  
  const supabase = createServerClient();
  
  // For server-side script, we need to query by user_id directly
  // Since we can't authenticate as a user, we'll need to either:
  // 1. Query all sessions (if using service role key)
  // 2. Or accept user_id as command line argument
  
  const userId = process.argv[2]; // Allow user_id as command line argument
  
  if (!userId) {
    console.error('❌ Error: No user ID provided');
    console.error('   Usage: npx tsx scripts/debug-garmin-duration.ts <user_id>');
    console.error('   Or modify script to query all users (if using service role key)');
    process.exit(1);
  }
  
  console.log(`\n🔍 Debugging Garmin duration for user: ${userId}\n`);
  
  // Load recent session logs
  const { data: sessions, error } = await supabase
    .from('session_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('source', 'garmin_health')
    .order('session_date', { ascending: false })
    .limit(20); // Increased limit for better debugging
  
  if (error) {
    console.error('❌ Failed to load sessions:', error);
    process.exit(1);
  }
  
  if (!sessions || sessions.length === 0) {
    console.log('ℹ️  No Garmin sessions found in database');
    console.log('   This could mean:');
    console.log('   1. No Garmin sync has been performed yet');
    console.log('   2. Sessions are stored with a different source value');
    console.log('   3. User ID is incorrect');
    process.exit(0);
  }
  
  console.log(`\n✅ Found ${sessions.length} Garmin sessions\n`);
  
  sessions.forEach((session, index) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Session ${index + 1} of ${sessions.length}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`ID: ${session.id}`);
    console.log(`Date: ${session.session_date}`);
    console.log(`Sport: ${session.sport_type}`);
    console.log(`Duration (minutes): ${session.duration_minutes}`);
    console.log(`Source: ${session.source}`);
    
    // Check metadata for duration-related fields
    const metadata = session.metadata as Record<string, unknown> | null;
    if (metadata) {
      console.log(`\n📊 Metadata duration-related fields:`);
      console.log(`   durationMinutes: ${metadata.durationMinutes ?? 'N/A'}`);
      console.log(`   durationInSeconds: ${metadata.durationInSeconds ?? 'N/A'}`);
      console.log(`   elapsedDurationInSeconds: ${metadata.elapsedDurationInSeconds ?? 'N/A'}`);
      console.log(`   duration: ${JSON.stringify(metadata.duration ?? 'N/A')}`);
      
      // Check activity ID and name
      console.log(`\n🏃 Activity info:`);
      console.log(`   activityId: ${metadata.activityId ?? 'N/A'}`);
      console.log(`   activityName: ${metadata.activityName ?? 'N/A'}`);
      console.log(`   dataSource: ${metadata.dataSource ?? 'N/A'}`);
      
      // Check if requiresManualDuration flag is set
      if (metadata.requiresManualDuration) {
        console.log(`   ⚠️  REQUIRES MANUAL DURATION FLAG SET`);
      }
    } else {
      console.log(`\n⚠️  No metadata found`);
    }
    
    // Check if duration is 0
    if (session.duration_minutes === 0) {
      console.log(`\n❌ DURATION IS ZERO - This is the problem!`);
    } else {
      const hours = Math.floor(session.duration_minutes / 60);
      const minutes = session.duration_minutes % 60;
      console.log(`\n✅ Duration is valid: ${session.duration_minutes} minutes (${hours}h ${minutes}m)`);
    }
  });
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Summary`);
  console.log(`${'='.repeat(60)}`);
  const zeroDurationCount = sessions.filter(s => s.duration_minutes === 0).length;
  const validDurationCount = sessions.filter(s => s.duration_minutes > 0).length;
  console.log(`✅ Valid durations: ${validDurationCount}`);
  console.log(`❌ Zero durations: ${zeroDurationCount}`);
  
  if (zeroDurationCount > 0) {
    console.log(`\n⚠️  ${zeroDurationCount} sessions have zero duration - this needs to be fixed!`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Check Python script logs for duration extraction failures`);
    console.log(`   2. Re-sync Garmin activities to populate correct durations`);
    console.log(`   3. If still 0, check Garmin API response structure`);
  } else {
    console.log(`\n✅ All sessions have valid durations!`);
  }
}

debugGarminDuration().catch(err => {
  logger.error('Debug script failed', err);
  process.exit(1);
});

