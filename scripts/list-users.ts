/**
 * Helper script to list all users in the database
 * Useful for finding your user_id to use with debug-garmin-duration.ts
 * 
 * Usage:
 *   npx tsx scripts/list-users.ts
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

async function listUsers() {
  // Check environment variables
  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ Error: Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
    console.error('   Please set environment variables in .env.local');
    process.exit(1);
  }
  
  if (!process.env.SUPABASE_SECRET_DEFAULT_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing Supabase server key');
    console.error('   Please set SUPABASE_SECRET_DEFAULT_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  
  const supabase = createServerClient();
  
  // Query auth.users table (requires service role key)
  const { data: users, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('❌ Failed to list users:', error);
    console.error('\n💡 Alternative: Query session_logs to find user_ids:');
    console.error('   SELECT DISTINCT user_id FROM session_logs;');
    process.exit(1);
  }
  
  if (!users || users.users.length === 0) {
    console.log('ℹ️  No users found');
    process.exit(0);
  }
  
  console.log(`\n✅ Found ${users.users.length} user(s):\n`);
  
  users.users.forEach((user, index) => {
    console.log(`${'='.repeat(60)}`);
    console.log(`User ${index + 1}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email ?? 'N/A'}`);
    console.log(`Created: ${user.created_at}`);
    console.log(`Last Sign In: ${user.last_sign_in_at ?? 'Never'}`);
    console.log();
  });
  
  console.log(`\n💡 Copy a user_id above and use it with:`);
  console.log(`   npx tsx scripts/debug-garmin-duration.ts <user_id>`);
}

listUsers().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});

