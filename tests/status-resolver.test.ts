/**
 * Unit tests for status resolver
 * Tests vote combinations mapping to GO/ADAPTED/SHUTDOWN
 */

import { resolveDailyStatus } from '../src/modules/review/logic/statusResolver';
import type { IAgentVote } from '../src/types/agents';

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

// Test data helpers
function createVote(agentId: string, vote: 'GREEN' | 'AMBER' | 'RED', reason: string): IAgentVote {
  return {
    agentId,
    vote,
    confidence: 0.9,
    reason,
    flaggedMetrics: [],
    score: vote === 'GREEN' ? 90 : vote === 'AMBER' ? 70 : 50
  };
}

// Test cases
export function runStatusResolverTests(): void {
  console.log('Running status resolver tests...');

  // Test 1: All GREEN -> GO
  const allGreen = [
    createVote('structural_agent', 'GREEN', 'Chassis nominal'),
    createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
    createVote('fueling_agent', 'GREEN', 'Fueling nominal')
  ];
  const result1 = resolveDailyStatus({ votes: allGreen, niggleScore: 2 });
  assertEqual(result1.global_status, 'GO', 'All GREEN votes should result in GO status');
  assertTrue(result1.reason.includes('Chassis and Engine are Green'), 'GO reason should mention green systems');
  assertTrue(!result1.substitutions_suggested, 'GO status should not suggest substitutions');
  console.log('✓ Test 1: All GREEN -> GO');

  // Test 2: Single Structural RED -> ADAPTED
  const structuralRed = [
    createVote('structural_agent', 'RED', 'Pain > 3'),
    createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
    createVote('fueling_agent', 'GREEN', 'Fueling nominal')
  ];
  const result2 = resolveDailyStatus({ votes: structuralRed, niggleScore: 4 });
  assertEqual(result2.global_status, 'ADAPTED', 'Single structural RED should result in ADAPTED');
  assertTrue(result2.reason.includes('Structural Agent Veto'), 'ADAPTED reason should mention structural veto');
  assertTrue(result2.substitutions_suggested, 'Structural RED should suggest substitutions');
  assertTrue(result2.reason.includes('4/10'), 'Reason should include niggle score');
  console.log('✓ Test 2: Single Structural RED -> ADAPTED');

  // Test 3: Single Metabolic RED -> ADAPTED
  const metabolicRed = [
    createVote('structural_agent', 'GREEN', 'Chassis nominal'),
    createVote('metabolic_agent', 'RED', 'Fatigue detected'),
    createVote('fueling_agent', 'GREEN', 'Fueling nominal')
  ];
  const result3 = resolveDailyStatus({ votes: metabolicRed, niggleScore: 1 });
  assertEqual(result3.global_status, 'ADAPTED', 'Single metabolic RED should result in ADAPTED');
  assertTrue(result3.reason.includes('Metabolic Agent Veto'), 'ADAPTED reason should mention metabolic veto');
  assertTrue(!result3.substitutions_suggested, 'Metabolic RED should not suggest substitutions (only structural)');
  console.log('✓ Test 3: Single Metabolic RED -> ADAPTED');

  // Test 4: Single Fueling RED -> ADAPTED
  const fuelingRed = [
    createVote('structural_agent', 'GREEN', 'Chassis nominal'),
    createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
    createVote('fueling_agent', 'RED', 'Gut training insufficient')
  ];
  const result4 = resolveDailyStatus({ votes: fuelingRed, niggleScore: 0 });
  assertEqual(result4.global_status, 'ADAPTED', 'Single fueling RED should result in ADAPTED');
  assertTrue(result4.reason.includes('Fueling Agent Veto'), 'ADAPTED reason should mention fueling veto');
  console.log('✓ Test 4: Single Fueling RED -> ADAPTED');

  // Test 5: Multiple REDs -> SHUTDOWN
  const multipleReds = [
    createVote('structural_agent', 'RED', 'Pain > 3'),
    createVote('metabolic_agent', 'RED', 'Fatigue detected'),
    createVote('fueling_agent', 'GREEN', 'Fueling nominal')
  ];
  const result5 = resolveDailyStatus({ votes: multipleReds, niggleScore: 5 });
  assertEqual(result5.global_status, 'SHUTDOWN', 'Multiple RED votes should result in SHUTDOWN');
  assertTrue(result5.reason.includes('System Shutdown'), 'SHUTDOWN reason should mention shutdown');
  assertTrue(result5.reason.includes('Multiple critical flags'), 'SHUTDOWN reason should mention multiple flags');
  console.log('✓ Test 5: Multiple REDs -> SHUTDOWN');

  // Test 6: Structural RED + Metabolic RED -> SHUTDOWN
  const structuralAndMetabolicRed = [
    createVote('structural_agent', 'RED', 'Pain > 3'),
    createVote('metabolic_agent', 'RED', 'Fatigue detected'),
    createVote('fueling_agent', 'GREEN', 'Fueling nominal')
  ];
  const result6 = resolveDailyStatus({ votes: structuralAndMetabolicRed, niggleScore: 4 });
  assertEqual(result6.global_status, 'SHUTDOWN', 'Structural + Metabolic RED should result in SHUTDOWN');
  console.log('✓ Test 6: Structural RED + Metabolic RED -> SHUTDOWN');

  // Test 7: AMBER votes only -> GO
  const allAmber = [
    createVote('structural_agent', 'AMBER', 'Days since lift > 5'),
    createVote('metabolic_agent', 'AMBER', 'Slight decoupling'),
    createVote('fueling_agent', 'GREEN', 'Fueling nominal')
  ];
  const result7 = resolveDailyStatus({ votes: allAmber, niggleScore: 2 });
  assertEqual(result7.global_status, 'GO', 'Only AMBER votes should result in GO');
  assertTrue(result7.reason.includes('cautionary flags'), 'GO with AMBER should mention cautionary flags');
  console.log('✓ Test 7: AMBER votes only -> GO');

  // Test 8: Votes display format
  const result8 = resolveDailyStatus({ votes: structuralRed, niggleScore: 4 });
  assertTrue(result8.votes.structural.vote === 'RED', 'Structural vote should be RED');
  assertTrue(result8.votes.structural.color === 'red', 'RED vote should have red color');
  assertTrue(result8.votes.structural.label === 'Veto', 'RED vote should have Veto label');
  assertTrue(result8.votes.metabolic.vote === 'GREEN', 'Metabolic vote should be GREEN');
  assertTrue(result8.votes.metabolic.color === 'green', 'GREEN vote should have green color');
  console.log('✓ Test 8: Votes display format');

  // Test 9: Z-score shutdown condition (HRV Z-Score < -1.5 AND Sleep Debt > 4h)
  const zScoreShutdown = [
    createVote('structural_agent', 'GREEN', 'Chassis nominal'),
    createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
    createVote('fueling_agent', 'GREEN', 'Fueling nominal')
  ];
  const result9 = resolveDailyStatus({ 
    votes: zScoreShutdown, 
    niggleScore: 2,
    zScoreContext: {
      hrvZScore: -1.8, // Below -1.5
      sleepDebtHours: 5.5 // Above 4h
    }
  });
  assertEqual(result9.global_status, 'SHUTDOWN', 'Z-score shutdown condition should trigger SHUTDOWN');
  assertTrue(result9.reason.includes('HRV Z-Score'), 'SHUTDOWN reason should mention HRV Z-Score');
  assertTrue(result9.reason.includes('Sleep Debt'), 'SHUTDOWN reason should mention Sleep Debt');
  assertTrue(result9.reason.includes('-1.8'), 'SHUTDOWN reason should include Z-score value');
  assertTrue(result9.reason.includes('5.5'), 'SHUTDOWN reason should include sleep debt value');
  console.log('✓ Test 9: Z-score shutdown condition (HRV Z < -1.5 AND Sleep Debt > 4h) -> SHUTDOWN');

  // Test 10: Z-score shutdown - HRV Z-Score < -1.5 but Sleep Debt <= 4h -> GO
  const zScoreNoShutdown1 = [
    createVote('structural_agent', 'GREEN', 'Chassis nominal'),
    createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
    createVote('fueling_agent', 'GREEN', 'Fueling nominal')
  ];
  const result10 = resolveDailyStatus({ 
    votes: zScoreNoShutdown1, 
    niggleScore: 2,
    zScoreContext: {
      hrvZScore: -1.8, // Below -1.5
      sleepDebtHours: 3.5 // Below 4h
    }
  });
  assertEqual(result10.global_status, 'GO', 'Z-score shutdown requires BOTH conditions');
  console.log('✓ Test 10: Z-score shutdown - HRV Z < -1.5 but Sleep Debt <= 4h -> GO');

  // Test 11: Z-score shutdown - Sleep Debt > 4h but HRV Z-Score >= -1.5 -> GO
  const zScoreNoShutdown2 = [
    createVote('structural_agent', 'GREEN', 'Chassis nominal'),
    createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
    createVote('fueling_agent', 'GREEN', 'Fueling nominal')
  ];
  const result11 = resolveDailyStatus({ 
    votes: zScoreNoShutdown2, 
    niggleScore: 2,
    zScoreContext: {
      hrvZScore: -1.2, // Above -1.5
      sleepDebtHours: 5.5 // Above 4h
    }
  });
  assertEqual(result11.global_status, 'GO', 'Z-score shutdown requires BOTH conditions');
  console.log('✓ Test 11: Z-score shutdown - Sleep Debt > 4h but HRV Z >= -1.5 -> GO');

  // Test 12: Confidence score capped at 0.85
  const result12 = resolveDailyStatus({ votes: allGreen, niggleScore: 2 });
  assertTrue(result12.confidenceScore <= 0.85, 'Confidence score should be capped at 0.85');
  assertEqual(result12.confidenceScore, 0.85, 'Confidence score should be exactly 0.85');
  console.log('✓ Test 12: Confidence score capped at 0.85');

  console.log('All status resolver tests passed!');
}

// Run tests if executed directly
if (require.main === module) {
  try {
    runStatusResolverTests();
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

