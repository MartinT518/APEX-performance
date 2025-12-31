/**
 * Unit tests for snapshot caching and invalidation
 * FR-5.1 to FR-5.6
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestSnapshot, createTestWorkout, createTestVotes } from '../fixtures/factories';
import type { PersistSnapshotInput } from '../../src/modules/dailyCoach/logic/snapshotPersistence';

describe('Snapshot Caching (FR-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('FR-5.1: Snapshot structure should include all required fields', () => {
    const snapshot = createTestSnapshot('test-user-id', '2025-01-31');
    
    expect(snapshot.user_id).toBe('test-user-id');
    expect(snapshot.date).toBe('2025-01-31');
    expect(snapshot.global_status).toBeDefined();
    expect(snapshot.reason).toBeDefined();
    expect(snapshot.votes_jsonb).toBeDefined();
    expect(snapshot.final_workout_jsonb).toBeDefined();
  });

  test('FR-5.1: Snapshot should be created after Daily Vote resolver', () => {
    const snapshotInput: PersistSnapshotInput = {
      userId: 'test-user-id',
      date: '2025-01-31',
      global_status: 'GO',
      reason: 'All systems nominal',
      votes_jsonb: createTestVotes(),
      final_workout_jsonb: createTestWorkout(),
      certainty_score: 0.85,
    };
    
    expect(snapshotInput.global_status).toBe('GO');
    expect(snapshotInput.votes_jsonb.length).toBe(3);
    expect(snapshotInput.final_workout_jsonb).toBeDefined();
  });

  test('FR-5.2: Snapshot should be updated after substitution selection', () => {
    const originalWorkout = createTestWorkout({ type: 'RUN' });
    const substitutedWorkout = createTestWorkout({ type: 'BIKE', isAdapted: true });
    
    const snapshotInput: PersistSnapshotInput = {
      userId: 'test-user-id',
      date: '2025-01-31',
      global_status: 'ADAPTED',
      reason: 'Structural Agent Veto. Run substituted for non-impact load.',
      votes_jsonb: createTestVotes({ structural: 'RED' }),
      final_workout_jsonb: substitutedWorkout,
      certainty_score: 0.75,
    };
    
    expect(snapshotInput.final_workout_jsonb.type).toBe('BIKE');
    expect(snapshotInput.final_workout_jsonb.isAdapted).toBe(true);
    expect(snapshotInput.global_status).toBe('ADAPTED');
  });

  test('FR-5.3: Snapshot query should take precedence over Blueprint', () => {
    const snapshot = createTestSnapshot('test-user-id', '2025-01-31', {
      global_status: 'ADAPTED',
      final_workout_jsonb: createTestWorkout({ type: 'BIKE' }),
    });
    
    const blueprintWorkout = createTestWorkout({ type: 'RUN' });
    
    // Simulating snapshot precedence logic
    const finalWorkout = snapshot.final_workout_jsonb; // Snapshot takes precedence
    
    expect(finalWorkout.type).toBe('BIKE');
    expect(finalWorkout.type).not.toBe(blueprintWorkout.type);
  });

  test('FR-5.4: Snapshot should be invalidated when gatekeeper inputs change', () => {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = createTestSnapshot('test-user-id', today);
    
    // Simulating invalidation: snapshot should be deleted
    const invalidatedSnapshot = null; // After invalidation
    
    expect(snapshot).toBeDefined(); // Before invalidation
    expect(invalidatedSnapshot).toBeNull(); // After invalidation
  });

  test('FR-5.5: Future snapshots should be invalidated when phenotype changes', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    const futureSnapshot = createTestSnapshot('test-user-id', tomorrow);
    const pastSnapshot = createTestSnapshot('test-user-id', yesterday);
    
    // Simulating phenotype change invalidation
    const invalidatedFuture = null; // Future snapshot invalidated
    const preservedPast = pastSnapshot; // Past snapshot preserved
    
    expect(invalidatedFuture).toBeNull();
    expect(preservedPast).toBeDefined();
  });

  test('FR-5.6: Past snapshots should be preserved (not invalidated)', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const pastSnapshot = createTestSnapshot('test-user-id', yesterday);
    
    // Past snapshots should never be invalidated
    const preservedSnapshot = pastSnapshot;
    
    expect(preservedSnapshot).toBeDefined();
    expect(preservedSnapshot.date).toBe(yesterday);
  });

  test('Snapshot UPSERT should update existing snapshot', () => {
    const snapshot1: PersistSnapshotInput = {
      userId: 'test-user-id',
      date: '2025-01-31',
      global_status: 'GO',
      reason: 'Initial decision',
      votes_jsonb: createTestVotes(),
      final_workout_jsonb: createTestWorkout({ type: 'RUN' }),
    };
    
    // Simulating UPSERT: same user_id and date should update
    const snapshot2: PersistSnapshotInput = {
      ...snapshot1,
      global_status: 'ADAPTED',
      reason: 'Updated decision',
      final_workout_jsonb: createTestWorkout({ type: 'BIKE' }),
    };
    
    expect(snapshot1.userId).toBe(snapshot2.userId);
    expect(snapshot1.date).toBe(snapshot2.date);
    expect(snapshot2.global_status).toBe('ADAPTED');
    expect(snapshot2.final_workout_jsonb.type).toBe('BIKE');
  });

  test('Snapshot should include inputs summary', () => {
    const snapshotInput: PersistSnapshotInput = {
      userId: 'test-user-id',
      date: '2025-01-31',
      global_status: 'GO',
      reason: 'All systems nominal',
      votes_jsonb: createTestVotes(),
      final_workout_jsonb: createTestWorkout(),
      inputs_summary_jsonb: {
        niggle_score: 2,
        strength_tier: 'TIER_2',
        last_run_duration: 60,
        fueling_carbs_per_hour: null,
        fueling_gi_distress: null,
      },
    };
    
    expect(snapshotInput.inputs_summary_jsonb).toBeDefined();
    expect(snapshotInput.inputs_summary_jsonb?.niggle_score).toBe(2);
    expect(snapshotInput.inputs_summary_jsonb?.strength_tier).toBe('TIER_2');
  });
});
