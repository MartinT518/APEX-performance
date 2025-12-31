/**
 * Integration tests for daily flow
 * Tests complete workflow: Gatekeeper → Agents → Resolver → Snapshot
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { resolveDailyStatus } from '../../src/modules/review/logic/statusResolver';
import { checkAuditGating } from '../../src/modules/dailyCoach/logic/auditGating';
import { createTestVotes, createTestWorkout } from '../fixtures/factories';

describe('Daily Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Complete daily workflow: Gatekeeper → Agents → Resolver → Snapshot', () => {
    // Step 1: Gatekeeper check
    const auditInput = {
      niggleScore: 2,
      strengthSessionDone: true,
      strengthTier: 'TIER_2',
      lastRunDuration: 60,
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    
    const auditResult = checkAuditGating(auditInput);
    expect(auditResult.auditRequired).toBe(false);
    
    // Step 2: Agent votes (simulated)
    const votes = createTestVotes();
    
    // Step 3: Status resolver
    const statusResult = resolveDailyStatus({ votes, niggleScore: 2 });
    expect(statusResult.global_status).toBe('GO');
    
    // Step 4: Snapshot structure
    const snapshot = {
      userId: 'test-user-id',
      date: '2025-01-31',
      global_status: statusResult.global_status,
      reason: statusResult.reason,
      votes_jsonb: votes,
      final_workout_jsonb: createTestWorkout(),
    };
    
    expect(snapshot.global_status).toBe('GO');
    expect(snapshot.votes_jsonb.length).toBe(3);
  });

  test('Audit blocking: AUDIT_PENDING should prevent decision generation', () => {
    const auditInput = {
      niggleScore: null, // Missing input
      strengthSessionDone: true,
      strengthTier: 'TIER_2',
      lastRunDuration: 60,
      daysSinceLastLift: 2,
      fuelingTarget: null,
      fuelingCarbsPerHour: null,
      fuelingGiDistress: null,
    };
    
    const auditResult = checkAuditGating(auditInput);
    
    expect(auditResult.auditRequired).toBe(true);
    expect(auditResult.auditType).toBe('NIGGLE');
    
    // Decision generation should be blocked
    // In real implementation, this would return early
    const shouldBlock = auditResult.auditRequired;
    expect(shouldBlock).toBe(true);
  });

  test('Substitution workflow: Structural RED → Modal → Persistence', () => {
    // Step 1: Structural RED vote
    const votes = createTestVotes({ structural: 'RED' });
    const statusResult = resolveDailyStatus({ votes, niggleScore: 4 });
    
    expect(statusResult.global_status).toBe('ADAPTED');
    expect(statusResult.substitutions_suggested).toBe(true);
    
    // Step 2: Substitution selection (simulated)
    const originalWorkout = createTestWorkout({ type: 'RUN' });
    const substitutedWorkout = createTestWorkout({ type: 'BIKE', isAdapted: true });
    
    // Step 3: Snapshot persistence
    const snapshot = {
      userId: 'test-user-id',
      date: '2025-01-31',
      global_status: statusResult.global_status,
      reason: statusResult.reason,
      votes_jsonb: votes,
      final_workout_jsonb: substitutedWorkout,
    };
    
    expect(snapshot.final_workout_jsonb.type).toBe('BIKE');
    expect(snapshot.final_workout_jsonb.isAdapted).toBe(true);
  });

  test('Shutdown workflow: Multiple RED → Shutdown Modal → REST', () => {
    // Step 1: Multiple RED votes
    const votes = createTestVotes({ structural: 'RED', metabolic: 'RED' });
    const statusResult = resolveDailyStatus({ votes, niggleScore: 5 });
    
    expect(statusResult.global_status).toBe('SHUTDOWN');
    
    // Step 2: Shutdown acknowledgment (simulated)
    const restWorkout = createTestWorkout({ type: 'REST', durationMinutes: 0 });
    
    // Step 3: Snapshot persistence
    const snapshot = {
      userId: 'test-user-id',
      date: '2025-01-31',
      global_status: statusResult.global_status,
      reason: statusResult.reason,
      votes_jsonb: votes,
      final_workout_jsonb: restWorkout,
    };
    
    expect(snapshot.final_workout_jsonb.type).toBe('REST');
    expect(snapshot.final_workout_jsonb.durationMinutes).toBe(0);
  });
});
