import type { DecisionResult } from './decision';
import type { DailyDecisionSnapshot } from '@/types/analysis';
import { resolveDailyStatus } from '../../review/logic/statusResolver';
import type { IAgentVote } from '@/types/agents';

export interface SnapshotBuilderInput {
  decision: DecisionResult;
  certaintyScore?: number | null;
  certaintyDelta?: number | null;
  inputsSummary: {
    niggleScore: number | null;
    strengthTier: string | null;
    lastRunDuration: number;
    fuelingCarbsPerHour: number | null;
    fuelingGiDistress: number | null;
  };
  niggleScore: number;
}

/**
 * Builds daily_decision_snapshot from decision result for caching
 * 
 * Includes inputs summary, votes, final workout, certainty metrics
 */
export function buildDailySnapshot(input: SnapshotBuilderInput): Omit<DailyDecisionSnapshot, 'id' | 'user_id' | 'date' | 'created_at' | 'updated_at'> {
  const { decision, certaintyScore, certaintyDelta, inputsSummary, niggleScore } = input;
  
  // Resolve status from votes
  const statusResult = resolveDailyStatus({
    votes: decision.votes,
    niggleScore
  });
  
  return {
    global_status: statusResult.global_status,
    reason: statusResult.reason,
    votes_jsonb: decision.votes as unknown as IAgentVote[],
    final_workout_jsonb: decision.finalWorkout as unknown as import('@/types/workout').IWorkout,
    certainty_score: certaintyScore ?? null,
    certainty_delta: certaintyDelta ?? null,
    inputs_summary_jsonb: {
      niggle_score: inputsSummary.niggleScore,
      strength_tier: inputsSummary.strengthTier,
      last_run_duration: inputsSummary.lastRunDuration,
      fueling_carbs_per_hour: inputsSummary.fuelingCarbsPerHour,
      fueling_gi_distress: inputsSummary.fuelingGiDistress
    }
  };
}

