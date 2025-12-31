/**
 * Walk-Forward Backtesting Script
 * 
 * Tests the system's ability to predict injury gaps.
 * 
 * Methodology:
 * 1. Train on data up to Time T
 * 2. Predict T+7 (whether system would veto)
 * 3. Compare against actual injury gaps
 * 
 * Roadmap requirement: "Accuracy exceeds 'Always Go' baseline by >20%"
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
import { runWalkForwardBacktest } from '@/app/actions';

/**
 * Main backtest function
 * 
 * Uses shared logic from server action to avoid duplication
 */
async function main() {
  const supabase = await createServerClient();
  
  // Get user ID
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    logger.error('Not authenticated. Please log in first.');
    process.exit(1);
  }
  
  const userId = user.id;
  
  // Default to last 365 days, or use command line arguments
  const args = process.argv.slice(2);
  let startDate: string;
  let endDate: string;
  
  if (args.length >= 2) {
    startDate = args[0];
    endDate = args[1];
  } else {
    endDate = new Date().toISOString().split('T')[0];
    const start = new Date();
    start.setDate(start.getDate() - 365);
    startDate = start.toISOString().split('T')[0];
  }
  
  logger.info(`Running backtest for user ${userId} from ${startDate} to ${endDate}`);
  
  // Use shared server action logic
  const result = await runWalkForwardBacktest(userId, startDate, endDate);
  
  if (!result.success) {
    logger.error(`Backtest failed: ${result.error}`);
    process.exit(1);
  }
  
  const improvement = result.improvement || 0;
  
  // Check if improvement meets roadmap requirement (>20%)
  if (improvement > 20) {
    logger.info(`✅ Backtest PASSED: Improvement (${improvement.toFixed(1)}%) exceeds 20% threshold`);
    logger.info(`  System accuracy: ${result.accuracy?.toFixed(1)}%`);
    logger.info(`  Baseline accuracy: ${result.baselineAccuracy?.toFixed(1)}%`);
  } else {
    logger.warn(`⚠️ Backtest FAILED: Improvement (${improvement.toFixed(1)}%) does not meet 20% threshold`);
    logger.warn(`  System accuracy: ${result.accuracy?.toFixed(1)}%`);
    logger.warn(`  Baseline accuracy: ${result.baselineAccuracy?.toFixed(1)}%`);
  }
  
  process.exit(improvement > 20 ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Backtest failed:', error);
    process.exit(1);
  });
}

// Re-export server action for convenience
export { runWalkForwardBacktest as runBacktest };
