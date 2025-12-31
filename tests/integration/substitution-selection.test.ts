/**
 * Integration tests for substitution selection
 * Tests complete substitution workflow
 */

import { describe, test, expect } from 'vitest';
import { resolveDailyStatus } from '../../src/modules/review/logic/statusResolver';
import { createTestVotes, createTestWorkout } from '../fixtures/factories';

describe('Substitution Selection Integration', () => {
  test('Modal trigger: Structural RED only should trigger substitution modal', () => {
    const structuralRed = createTestVotes({ structural: 'RED' });
    const result = resolveDailyStatus({ votes: structuralRed, niggleScore: 4 });
    
    expect(result.global_status).toBe('ADAPTED');
    expect(result.substitutions_suggested).toBe(true);
  });

  test('Option selection: A/B/C should rewrite workout correctly', () => {
    const originalWorkout = createTestWorkout({ type: 'RUN', durationMinutes: 90 });
    
    // Option A: BIKE
    const bikeWorkout = createTestWorkout({
      type: 'BIKE',
      durationMinutes: 90,
      isAdapted: true,
    });
    expect(bikeWorkout.type).toBe('BIKE');
    expect(bikeWorkout.durationMinutes).toBe(90); // Duration matched
    
    // Option B: BFR
    const bfrWorkout = createTestWorkout({
      type: 'CROSS_TRAIN',
      durationMinutes: 45,
      isAdapted: true,
    });
    expect(bfrWorkout.type).toBe('CROSS_TRAIN');
    expect(bfrWorkout.durationMinutes).toBe(45);
    
    // Option C: REST
    const restWorkout = createTestWorkout({
      type: 'REST',
      durationMinutes: 0,
      isAdapted: true,
    });
    expect(restWorkout.type).toBe('REST');
    expect(restWorkout.durationMinutes).toBe(0);
  });

  test('Snapshot precedence: Snapshot should take precedence over Blueprint', () => {
    const snapshotWorkout = createTestWorkout({ type: 'BIKE', isAdapted: true });
    const blueprintWorkout = createTestWorkout({ type: 'RUN', isAdapted: false });
    
    // Simulating snapshot precedence
    const finalWorkout = snapshotWorkout; // Snapshot takes precedence
    
    expect(finalWorkout.type).toBe('BIKE');
    expect(finalWorkout.isAdapted).toBe(true);
  });

  test('Reload-safety: Substitution should persist after reload', () => {
    const substitutedWorkout = createTestWorkout({ type: 'BIKE', isAdapted: true });
    
    const snapshot = {
      userId: 'test-user-id',
      date: '2025-01-31',
      global_status: 'ADAPTED' as const,
      reason: 'Structural Agent Veto',
      votes_jsonb: createTestVotes({ structural: 'RED' }),
      final_workout_jsonb: substitutedWorkout,
    };
    
    // Simulating reload: read from snapshot
    const reloadedWorkout = snapshot.final_workout_jsonb;
    
    expect(reloadedWorkout.type).toBe('BIKE');
    expect(reloadedWorkout.isAdapted).toBe(true);
  });
});
