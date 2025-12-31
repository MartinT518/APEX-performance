/**
 * Get User ID Script
 * 
 * Helper script to get your user ID for use with import scripts.
 * 
 * Usage:
 *   npx tsx scripts/get-user-id.ts
 */

// Load environment variables from .env.local FIRST
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Verify Supabase env vars are set
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     process.env.SUPABASE_ANON_KEY ||
                     process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase environment variables');
  process.exit(1);
}

// Create client directly to avoid module-level checks
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

async function main() {
  try {
    // Create client directly (avoiding module-level checks in supabase.ts)
    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // CLI script doesn't need session persistence
        autoRefreshToken: false
      }
    });
    
    // Try to get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('\n⚠️  No active session found.');
      console.log('\nTo get your user ID:');
      console.log('1. Log in to the application at http://localhost:3000');
      console.log('2. Open browser console (F12)');
      console.log('3. Run: (await supabase.auth.getUser()).data.user.id');
      console.log('\nOr query from database:');
      console.log('   SELECT id, email FROM auth.users LIMIT 1;');
      process.exit(1);
    }
    
    console.log('\n✅ Your User ID:');
    console.log(`   ${user.id}\n`);
    console.log('Use this with the import script:');
    console.log(`   npx tsx scripts/import-historical-data.ts --user-id=${user.id}\n`);
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
