/**
 * Integration tests for audit blocking behavior
 * Tests that analysis cannot proceed until required inputs are complete
 */

import { checkAuditGating } from '../../src/modules/dailyCoach/logic/auditGating';

// Test helper functions
function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Test that missing niggle blocks analysis
 */
export function testNiggleBlocking(): void {
  console.log('Testing: Missing niggle blocks analysis...');
  
  const missingNiggle = {
    niggleScore: null,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 60,
    fuelingTarget: null,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  
  const result = checkAuditGating(missingNiggle);
  
  assertTrue(result.auditRequired, 'Missing niggle should block analysis');
  assertEqual(result.auditType, 'NIGGLE', 'Audit type should be NIGGLE');
  assertTrue(result.missingInputs.includes('Niggle score'), 'Should flag niggle as missing');
  
  console.log('✓ Missing niggle correctly blocks analysis');
}

/**
 * Test that missing strength blocks analysis
 */
export function testStrengthBlocking(): void {
  console.log('Testing: Missing strength blocks analysis...');
  
  const missingStrength = {
    niggleScore: 2,
    strengthTier: null,
    lastRunDuration: 60,
    fuelingTarget: null,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  
  const result = checkAuditGating(missingStrength);
  
  assertTrue(result.auditRequired, 'Missing strength should block analysis');
  assertEqual(result.auditType, 'STRENGTH', 'Audit type should be STRENGTH');
  assertTrue(result.missingInputs.includes('Strength tier'), 'Should flag strength as missing');
  
  console.log('✓ Missing strength correctly blocks analysis');
}

/**
 * Test that missing fueling blocks analysis for long runs
 */
export function testFuelingBlocking(): void {
  console.log('Testing: Missing fueling blocks analysis for long runs...');
  
  const longRunNoFueling = {
    niggleScore: 2,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 120,
    fuelingTarget: null,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  
  const result = checkAuditGating(longRunNoFueling);
  
  assertTrue(result.auditRequired, 'Long run without fueling should block analysis');
  assertEqual(result.auditType, 'FUELING', 'Audit type should be FUELING');
  assertTrue(result.missingInputs.includes('Fueling carbs per hour'), 'Should flag carbs as missing');
  assertTrue(result.missingInputs.includes('Fueling GI distress'), 'Should flag GI distress as missing');
  
  console.log('✓ Missing fueling correctly blocks analysis for long runs');
}

/**
 * Test that all inputs present allows analysis
 */
export function testAllInputsPresent(): void {
  console.log('Testing: All inputs present allows analysis...');
  
  const allPresent = {
    niggleScore: 2,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 60,
    fuelingTarget: null,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  
  const result = checkAuditGating(allPresent);
  
  assertTrue(!result.auditRequired, 'All inputs present should allow analysis');
  assertEqual(result.missingInputs.length, 0, 'Should have no missing inputs');
  
  console.log('✓ All inputs present correctly allows analysis');
}

/**
 * Test that fueling not required for short runs
 */
export function testFuelingNotRequiredShortRun(): void {
  console.log('Testing: Fueling not required for short runs...');
  
  const shortRun = {
    niggleScore: 2,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 60,
    fuelingTarget: 60,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  
  const result = checkAuditGating(shortRun);
  
  assertTrue(!result.auditRequired, 'Short run should not require fueling audit');
  
  console.log('✓ Fueling correctly not required for short runs');
}

/**
 * Run all audit blocking tests
 */
export function runAuditBlockingTests(): void {
  console.log('Running audit blocking integration tests...\n');
  
  try {
    testNiggleBlocking();
    testStrengthBlocking();
    testFuelingBlocking();
    testAllInputsPresent();
    testFuelingNotRequiredShortRun();
    
    console.log('\n✅ All audit blocking tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests if executed directly
if (require.main === module) {
  try {
    runAuditBlockingTests();
    console.log('\n✅ All integration tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

