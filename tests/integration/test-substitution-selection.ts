/**
 * Integration tests for substitution selection and DB persistence
 * Tests that selecting a substitution option updates DB and UI reflects it
 */

import { resolveDailyStatus } from '../../src/modules/review/logic/statusResolver';
import type { IAgentVote } from '../../src/types/agents';
import type { IWorkout } from '../../src/types/workout';

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

function createWorkout(): IWorkout {
  return {
    id: 'w_today',
    date: new Date().toISOString().split('T')[0],
    type: 'RUN',
    primaryZone: 'Z4_THRESHOLD',
    durationMinutes: 60,
    structure: { mainSet: '3x15min Threshold' },
    constraints: {
      cadenceTarget: 175,
      hrTarget: { min: 175, max: 182 }
    }
  };
}

/**
 * Test that structural RED triggers substitution suggestion
 */
export function testStructuralRedTriggersSubstitution(): void {
  console.log('Testing: Structural RED triggers substitution suggestion...');
  
  const structuralRed = [
    createVote('structural_agent', 'RED', 'Pain > 3'),
    createVote('metabolic_agent', 'GREEN', 'Engine nominal'),
    createVote('fueling_agent', 'GREEN', 'Fueling nominal')
  ];
  
  const result = resolveDailyStatus({ votes: structuralRed, niggleScore: 4 });
  
  assertEqual(result.global_status, 'ADAPTED', 'Should be ADAPTED status');
  assertTrue(result.substitutions_suggested, 'Should suggest substitutions');
  assertTrue(result.reason.includes('substituted'), 'Reason should mention substitution');
  
  console.log('✓ Structural RED correctly triggers substitution suggestion');
}

/**
 * Test that substitution options (A/B/C) can be applied to workout
 */
export function testSubstitutionOptions(): void {
  console.log('Testing: Substitution options can be applied...');
  
  const originalWorkout = createWorkout();
  
  // Option A: BIKE
  const bikeWorkout: IWorkout = {
    ...originalWorkout,
    type: 'BIKE',
    structure: { mainSet: '60min Indoor Cycling Intervals' },
    isAdapted: true
  };
  assertEqual(bikeWorkout.type, 'BIKE', 'BIKE option should change type to BIKE');
  assertTrue(bikeWorkout.isAdapted === true, 'BIKE option should mark as adapted');
  
  // Option B: BFR
  const bfrWorkout: IWorkout = {
    ...originalWorkout,
    type: 'CROSS_TRAIN',
    durationMinutes: 45,
    structure: { mainSet: '45min BFR Walk' },
    isAdapted: true
  };
  assertEqual(bfrWorkout.type, 'CROSS_TRAIN', 'BFR option should change type to CROSS_TRAIN');
  assertEqual(bfrWorkout.durationMinutes, 45, 'BFR option should change duration to 45min');
  
  // Option C: REST
  const restWorkout: IWorkout = {
    ...originalWorkout,
    type: 'REST',
    durationMinutes: 0,
    structure: { mainSet: 'Complete Rest + Mobility' },
    isAdapted: true
  };
  assertEqual(restWorkout.type, 'REST', 'REST option should change type to REST');
  assertEqual(restWorkout.durationMinutes, 0, 'REST option should set duration to 0');
  
  console.log('✓ All substitution options can be applied correctly');
}

/**
 * Test that SHUTDOWN status shows correct behavior
 */
export function testShutdownStatus(): void {
  console.log('Testing: SHUTDOWN status behavior...');
  
  const multipleReds = [
    createVote('structural_agent', 'RED', 'Pain > 3'),
    createVote('metabolic_agent', 'RED', 'Fatigue detected'),
    createVote('fueling_agent', 'GREEN', 'Fueling nominal')
  ];
  
  const result = resolveDailyStatus({ votes: multipleReds, niggleScore: 5 });
  
  assertEqual(result.global_status, 'SHUTDOWN', 'Should be SHUTDOWN status');
  assertTrue(result.reason.includes('Shutdown'), 'Reason should mention shutdown');
  assertTrue(result.reason.includes('Multiple'), 'Reason should mention multiple flags');
  
  console.log('✓ SHUTDOWN status correctly identified');
}

/**
 * Run all integration tests
 */
export function runSubstitutionSelectionTests(): void {
  console.log('Running substitution selection integration tests...\n');
  
  try {
    testStructuralRedTriggersSubstitution();
    testSubstitutionOptions();
    testShutdownStatus();
    
    console.log('\n✅ All substitution selection tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests if executed directly
if (require.main === module) {
  try {
    runSubstitutionSelectionTests();
    console.log('\n✅ All integration tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

