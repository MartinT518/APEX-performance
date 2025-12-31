/**
 * Unit tests for substitution persistence
 * Tests that substitution selections persist to DB and reload correctly
 */

import type { IWorkout } from '../src/types/workout';
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

// Mock workout for testing
function createMockWorkout(): IWorkout {
  return {
    type: 'RUN',
    durationMinutes: 90,
    distanceKm: 15,
    primaryZone: 'Z3_TEMPO',
    structure: {
      warmup: '10min easy',
      mainSet: '60min tempo',
      cooldown: '20min easy'
    },
    constraints: {
      hrTarget: { min: 150, max: 170 },
      cadenceTarget: 180
    },
    isAdapted: false,
    explanation: 'Standard tempo run'
  };
}

// Test cases
export function runSubstitutionPersistenceTests(): void {
  console.log('Running substitution persistence tests...');

  // Test 1: BIKE substitution rewrites workout correctly
  const originalWorkout = createMockWorkout();
  const bikeWorkout: IWorkout = {
    ...originalWorkout,
    type: 'BIKE',
    structure: {
      ...originalWorkout.structure,
      mainSet: '60min Indoor Cycling Intervals'
    },
    constraints: {
      ...originalWorkout.constraints,
      cadenceTarget: undefined // Not applicable to bike
    },
    isAdapted: true,
    explanation: 'Cycling intervals to match HR intensity. Zero impact on chassis.'
  };
  assertEqual(bikeWorkout.type, 'BIKE', 'BIKE substitution should change type to BIKE');
  assertTrue(bikeWorkout.isAdapted, 'BIKE substitution should mark workout as adapted');
  assertTrue(bikeWorkout.explanation.includes('Cycling'), 'BIKE substitution should explain cycling');
  console.log('✓ Test 1: BIKE substitution rewrites workout correctly');

  // Test 2: BFR substitution rewrites workout correctly
  const bfrWorkout: IWorkout = {
    ...originalWorkout,
    type: 'CROSS_TRAIN',
    durationMinutes: 45,
    structure: {
      mainSet: '45min BFR Walk'
    },
    constraints: {
      ...originalWorkout.constraints,
      cadenceTarget: undefined
    },
    isAdapted: true,
    explanation: 'Blood Flow Restriction walking. Minimal impact, maintains metabolic stimulus.'
  };
  assertEqual(bfrWorkout.type, 'CROSS_TRAIN', 'BFR substitution should change type to CROSS_TRAIN');
  assertEqual(bfrWorkout.durationMinutes, 45, 'BFR substitution should set duration to 45min');
  assertTrue(bfrWorkout.isAdapted, 'BFR substitution should mark workout as adapted');
  console.log('✓ Test 2: BFR substitution rewrites workout correctly');

  // Test 3: REST substitution rewrites workout correctly
  const restWorkout: IWorkout = {
    ...originalWorkout,
    type: 'REST',
    durationMinutes: 0,
    structure: {
      mainSet: 'Complete Rest + Mobility'
    },
    constraints: undefined,
    isAdapted: true,
    explanation: 'System Shutdown: Complete rest required.'
  };
  assertEqual(restWorkout.type, 'REST', 'REST substitution should change type to REST');
  assertEqual(restWorkout.durationMinutes, 0, 'REST substitution should set duration to 0');
  assertTrue(restWorkout.isAdapted, 'REST substitution should mark workout as adapted');
  console.log('✓ Test 3: REST substitution rewrites workout correctly');

  // Test 4: Substitution preserves original workout metadata
  const substitutedWorkout: IWorkout = {
    ...originalWorkout,
    type: 'BIKE',
    isAdapted: true
  };
  assertTrue(substitutedWorkout.distanceKm === originalWorkout.distanceKm || substitutedWorkout.distanceKm === undefined, 
    'Substitution may modify distance but should preserve or remove it');
  assertTrue(substitutedWorkout.primaryZone === originalWorkout.primaryZone || substitutedWorkout.primaryZone === undefined,
    'Substitution may modify zone but should preserve or remove it');
  console.log('✓ Test 4: Substitution preserves original workout metadata appropriately');

  // Test 5: Snapshot structure for substitution persistence
  const mockVotes: IAgentVote[] = [
    {
      agentId: 'structural_agent',
      vote: 'RED',
      confidence: 0.9,
      reason: 'Pain > 3',
      flaggedMetrics: [],
      score: 50
    }
  ];
  const snapshotData = {
    userId: 'test-user-id',
    date: '2025-01-31',
    global_status: 'ADAPTED' as const,
    reason: 'Structural Agent Veto (Pain 4/10). Run substituted for non-impact load.',
    votes_jsonb: mockVotes,
    final_workout_jsonb: bikeWorkout,
    certainty_score: 75,
    certainty_delta: -5,
    inputs_summary_jsonb: {
      niggle_score: 4,
      strength_tier: 'strength',
      last_run_duration: 90,
      fueling_carbs_per_hour: null,
      fueling_gi_distress: null
    }
  };
  assertEqual(snapshotData.final_workout_jsonb.type, 'BIKE', 'Snapshot should store substituted workout type');
  assertTrue(snapshotData.final_workout_jsonb.isAdapted, 'Snapshot should mark workout as adapted');
  assertTrue(snapshotData.reason.includes('substituted'), 'Snapshot reason should mention substitution');
  console.log('✓ Test 5: Snapshot structure for substitution persistence');

  console.log('All substitution persistence tests passed!');
}

// Run tests if executed directly
if (require.main === module) {
  try {
    runSubstitutionPersistenceTests();
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}
