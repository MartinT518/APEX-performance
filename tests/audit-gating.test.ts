/**
 * Unit tests for audit gating logic
 * Tests blocking behavior for required inputs
 */

import { checkAuditGating } from '../src/modules/dailyCoach/logic/auditGating';

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

// Test cases
export function runAuditGatingTests(): void {
  console.log('Running audit gating tests...');

  // Test 1: All inputs present -> No audit required
  const allPresent = {
    niggleScore: 2,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 60,
    fuelingTarget: null,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  const result1 = checkAuditGating(allPresent);
  assertTrue(!result1.auditRequired, 'All required inputs present should not require audit');
  assertEqual(result1.missingInputs.length, 0, 'No missing inputs when all present');
  console.log('✓ Test 1: All inputs present -> No audit required');

  // Test 2: Missing niggle -> Audit required
  const missingNiggle = {
    niggleScore: null,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 60,
    fuelingTarget: null,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  const result2 = checkAuditGating(missingNiggle);
  assertTrue(result2.auditRequired, 'Missing niggle should require audit');
  assertTrue(result2.missingInputs.includes('Niggle score'), 'Missing inputs should include niggle');
  assertEqual(result2.auditType, 'NIGGLE', 'Audit type should be NIGGLE');
  console.log('✓ Test 2: Missing niggle -> Audit required');

  // Test 3: Missing strength tier -> Audit required
  const missingStrength = {
    niggleScore: 2,
    strengthTier: null,
    lastRunDuration: 60,
    fuelingTarget: null,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  const result3 = checkAuditGating(missingStrength);
  assertTrue(result3.auditRequired, 'Missing strength tier should require audit');
  assertTrue(result3.missingInputs.includes('Strength tier'), 'Missing inputs should include strength');
  assertEqual(result3.auditType, 'STRENGTH', 'Audit type should be STRENGTH');
  console.log('✓ Test 3: Missing strength tier -> Audit required');

  // Test 4: Strength tier 'NONE' -> Audit required
  const strengthNone = {
    niggleScore: 2,
    strengthTier: 'NONE',
    lastRunDuration: 60,
    fuelingTarget: null,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  const result4 = checkAuditGating(strengthNone);
  assertTrue(result4.auditRequired, "Strength tier 'NONE' should require audit");
  console.log('✓ Test 4: Strength tier NONE -> Audit required');

  // Test 5: Long run (>90min) without fueling -> Audit required
  const longRunNoFueling = {
    niggleScore: 2,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 120,
    fuelingTarget: null,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  const result5 = checkAuditGating(longRunNoFueling);
  assertTrue(result5.auditRequired, 'Long run without fueling should require audit');
  assertTrue(result5.missingInputs.includes('Fueling carbs per hour'), 'Missing fueling carbs');
  assertTrue(result5.missingInputs.includes('Fueling GI distress'), 'Missing GI distress');
  assertEqual(result5.auditType, 'FUELING', 'Audit type should be FUELING');
  console.log('✓ Test 5: Long run without fueling -> Audit required');

  // Test 6: Long run with partial fueling (missing carbs) -> Audit required
  const longRunPartialFueling1 = {
    niggleScore: 2,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 120,
    fuelingTarget: null,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: 3
  };
  const result6 = checkAuditGating(longRunPartialFueling1);
  assertTrue(result6.auditRequired, 'Long run with missing carbs should require audit');
  assertTrue(result6.missingInputs.includes('Fueling carbs per hour'), 'Should flag missing carbs');
  console.log('✓ Test 6: Long run missing carbs -> Audit required');

  // Test 7: Long run with partial fueling (missing GI distress) -> Audit required
  const longRunPartialFueling2 = {
    niggleScore: 2,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 120,
    fuelingTarget: null,
    fuelingCarbsPerHour: 60,
    fuelingGiDistress: null
  };
  const result7 = checkAuditGating(longRunPartialFueling2);
  assertTrue(result7.auditRequired, 'Long run with missing GI distress should require audit');
  assertTrue(result7.missingInputs.includes('Fueling GI distress'), 'Should flag missing GI distress');
  console.log('✓ Test 7: Long run missing GI distress -> Audit required');

  // Test 8: Long run with complete fueling -> No audit required
  const longRunWithFueling = {
    niggleScore: 2,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 120,
    fuelingTarget: null,
    fuelingCarbsPerHour: 60,
    fuelingGiDistress: 3
  };
  const result8 = checkAuditGating(longRunWithFueling);
  assertTrue(!result8.auditRequired, 'Long run with complete fueling should not require audit');
  console.log('✓ Test 8: Long run with complete fueling -> No audit required');

  // Test 9: High fueling target (>90) without fueling -> Audit required
  const highTargetNoFueling = {
    niggleScore: 2,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 60,
    fuelingTarget: 95,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  const result9 = checkAuditGating(highTargetNoFueling);
  assertTrue(result9.auditRequired, 'High fueling target without fueling should require audit');
  assertEqual(result9.auditType, 'FUELING', 'Audit type should be FUELING');
  console.log('✓ Test 9: High fueling target without fueling -> Audit required');

  // Test 10: Short run (<90min) with low target -> No fueling audit required
  const shortRun = {
    niggleScore: 2,
    strengthTier: 'Hypertrophy',
    lastRunDuration: 60,
    fuelingTarget: 60,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  const result10 = checkAuditGating(shortRun);
  assertTrue(!result10.auditRequired, 'Short run should not require fueling audit');
  console.log('✓ Test 10: Short run -> No fueling audit required');

  // Test 11: Multiple missing inputs -> All flagged
  const multipleMissing = {
    niggleScore: null,
    strengthTier: null,
    lastRunDuration: 120,
    fuelingTarget: null,
    fuelingCarbsPerHour: null,
    fuelingGiDistress: null
  };
  const result11 = checkAuditGating(multipleMissing);
  assertTrue(result11.auditRequired, 'Multiple missing inputs should require audit');
  assertTrue(result11.missingInputs.length >= 4, 'Should flag all missing inputs');
  assertEqual(result11.auditType, 'NIGGLE', 'First missing input should determine audit type');
  console.log('✓ Test 11: Multiple missing inputs -> All flagged');

  console.log('All audit gating tests passed!');
}

// Run tests if executed directly
if (require.main === module) {
  try {
    runAuditGatingTests();
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

