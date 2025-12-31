/**
 * Test data factories for creating test objects
 */

import type { IAgentVote } from '../../src/types/agents';
import type { IWorkout } from '../../src/types/workout';

export interface TestUser {
  id: string;
  email: string;
  profile_id: string;
}

export interface TestHealthData {
  user_id: string;
  date: string;
  hrv?: number;
  rhr?: number;
  sleep_seconds?: number;
  niggle_score?: number;
  strength_session?: boolean;
  strength_tier?: string;
  fueling_carbs_per_hour?: number;
  fueling_gi_distress?: number;
}

export interface TestSession {
  id: string;
  user_id: string;
  session_date: string;
  sport_type: string;
  duration_minutes: number;
  metadata?: Record<string, unknown>;
}

export interface TestSnapshot {
  user_id: string;
  date: string;
  global_status: 'GO' | 'ADAPTED' | 'SHUTDOWN';
  reason: string;
  votes_jsonb: IAgentVote[];
  final_workout_jsonb: IWorkout;
  certainty_score?: number;
}

let userIdCounter = 1;
let sessionIdCounter = 1;

export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  const id = `test-user-${userIdCounter++}`;
  return {
    id,
    email: `test${id}@example.com`,
    profile_id: `profile-${id}`,
    ...overrides,
  };
}

export function createTestHealthData(
  userId: string,
  date: string,
  overrides?: Partial<TestHealthData>
): TestHealthData {
  return {
    user_id: userId,
    date,
    hrv: 45,
    rhr: 45,
    sleep_seconds: 28800, // 8 hours
    niggle_score: 2,
    strength_session: true,
    strength_tier: 'TIER_2',
    ...overrides,
  };
}

export function createTestSession(
  userId: string,
  sessionDate: string,
  overrides?: Partial<TestSession>
): TestSession {
  const id = `session-${sessionIdCounter++}`;
  return {
    id,
    user_id: userId,
    session_date: sessionDate,
    sport_type: 'RUNNING',
    duration_minutes: 60,
    metadata: {
      distanceKm: 10,
      avgPace: '5:00',
      avgHR: 150,
    },
    ...overrides,
  };
}

export function createTestVotes(overrides?: {
  structural?: 'GREEN' | 'AMBER' | 'RED';
  metabolic?: 'GREEN' | 'AMBER' | 'RED';
  fueling?: 'GREEN' | 'AMBER' | 'RED';
}): IAgentVote[] {
  return [
    {
      agentId: 'structural_agent',
      vote: overrides?.structural || 'GREEN',
      confidence: 0.9,
      reason: 'Chassis nominal',
      flaggedMetrics: [],
      score: 90,
    },
    {
      agentId: 'metabolic_agent',
      vote: overrides?.metabolic || 'GREEN',
      confidence: 0.9,
      reason: 'Engine nominal',
      flaggedMetrics: [],
      score: 90,
    },
    {
      agentId: 'fueling_agent',
      vote: overrides?.fueling || 'GREEN',
      confidence: 0.9,
      reason: 'Fueling nominal',
      flaggedMetrics: [],
      score: 90,
    },
  ];
}

export function createTestWorkout(overrides?: Partial<IWorkout>): IWorkout {
  return {
    id: 'test-workout-1',
    date: new Date().toISOString().split('T')[0],
    type: 'RUN',
    primaryZone: 'Z4_THRESHOLD',
    durationMinutes: 60,
    structure: {
      mainSet: '3x10min Threshold',
    },
    ...overrides,
  };
}

export function createTestSnapshot(
  userId: string,
  date: string,
  overrides?: Partial<TestSnapshot>
): TestSnapshot {
  return {
    user_id: userId,
    date,
    global_status: 'GO',
    reason: 'All systems nominal',
    votes_jsonb: createTestVotes(),
    final_workout_jsonb: createTestWorkout(),
    certainty_score: 0.85,
    ...overrides,
  };
}
