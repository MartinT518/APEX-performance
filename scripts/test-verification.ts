#!/usr/bin/env tsx
/**
 * Test Verification Script
 * 
 * Verifies that all critical features are working correctly.
 * Run with: npx tsx scripts/test-verification.ts
 */

import { createServerClient } from '../src/lib/supabase';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function testSupabaseConnection() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.from('phenotype_profiles').select('count').limit(1);
    
    if (error) throw error;
    
    results.push({ name: 'Supabase Connection', passed: true });
    return true;
  } catch (err) {
    results.push({ 
      name: 'Supabase Connection', 
      passed: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    });
    return false;
  }
}

async function testDatabaseSchema() {
  try {
    const supabase = createServerClient();
    const tables = [
      'phenotype_profiles',
      'daily_monitoring',
      'baseline_metrics',
      'session_logs',
      'agent_votes'
    ];
    
    for (const table of tables) {
      const { error } = await supabase.from(table).select('*').limit(0);
      if (error && error.code !== 'PGRST116') { // PGRST116 = table exists but empty
        throw new Error(`Table ${table} not accessible: ${error.message}`);
      }
    }
    
    results.push({ name: 'Database Schema', passed: true });
    return true;
  } catch (err) {
    results.push({ 
      name: 'Database Schema', 
      passed: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    });
    return false;
  }
}

async function testEnvironmentVariables() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY'
  ];
  
  const missing: string[] = [];
  
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    results.push({ 
      name: 'Environment Variables', 
      passed: false, 
      error: `Missing: ${missing.join(', ')}` 
    });
    return false;
  }
  
  results.push({ name: 'Environment Variables', passed: true });
  return true;
}

function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST VERIFICATION RESULTS');
  console.log('='.repeat(60) + '\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('-'.repeat(60) + '\n');
  
  return failed === 0;
}

async function main() {
  console.log('Starting test verification...\n');
  
  await testEnvironmentVariables();
  await testSupabaseConnection();
  await testDatabaseSchema();
  
  const allPassed = printResults();
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);

