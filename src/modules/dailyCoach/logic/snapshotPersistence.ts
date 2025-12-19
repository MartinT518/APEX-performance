import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { DailyDecisionSnapshot } from '@/types/analysis';
import type { IWorkout } from '@/types/workout';
import type { IAgentVote } from '@/types/agents';

export interface PersistSnapshotInput {
  userId: string;
  date: string;
  global_status: 'GO' | 'ADAPTED' | 'SHUTDOWN';
  reason: string;
  votes: IAgentVote[];
  finalWorkout: IWorkout;
  certaintyScore?: number | null;
  certaintyDelta?: number | null;
  inputsSummary?: {
    niggleScore: number | null;
    strengthTier: string | null;
    lastRunDuration: number;
    fuelingCarbsPerHour: number | null;
    fuelingGiDistress: number | null;
  } | null;
}

export interface PersistSnapshotResult {
  success: boolean;
  snapshotId?: string;
  error?: string;
}

/**
 * Persists daily decision snapshot to database
 */
export async function persistDailySnapshot(input: PersistSnapshotInput): Promise<PersistSnapshotResult> {
  try {
    const supabase = createServerClient();
    
    const { error, data } = await supabase
      .from('daily_decision_snapshot')
      .upsert({
        user_id: input.userId,
        date: input.date,
        global_status: input.global_status,
        reason: input.reason,
        votes_jsonb: input.votes as unknown as import('@/types/database').Json,
        final_workout_jsonb: input.finalWorkout as unknown as import('@/types/database').Json,
        certainty_score: input.certaintyScore ?? null,
        certainty_delta: input.certaintyDelta ?? null,
        inputs_summary_jsonb: input.inputsSummary as unknown as import('@/types/database').Json ?? null
      }, {
        onConflict: 'user_id,date'
      })
      .select('id')
      .single();
    
    if (error) {
      logger.error('Failed to persist daily snapshot', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, snapshotId: data?.id };
  } catch (err) {
    logger.error('Failed to persist daily snapshot', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export interface LoadSnapshotInput {
  userId: string;
  date: string;
}

export interface LoadSnapshotResult {
  success: boolean;
  snapshot?: DailyDecisionSnapshot | null;
  error?: string;
}

/**
 * Loads cached daily decision snapshot from database
 */
export async function loadDailySnapshot(input: LoadSnapshotInput): Promise<LoadSnapshotResult> {
  try {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('daily_decision_snapshot')
      .select('*')
      .eq('user_id', input.userId)
      .eq('date', input.date)
      .maybeSingle();
    
    if (error) {
      logger.error('Failed to load daily snapshot', error);
      return { success: false, error: error.message };
    }
    
    if (!data) {
      return { success: true, snapshot: null };
    }
    
    // Transform database row to DailyDecisionSnapshot
    const snapshot: DailyDecisionSnapshot = {
      id: data.id,
      user_id: data.user_id,
      date: data.date,
      global_status: data.global_status as 'GO' | 'ADAPTED' | 'SHUTDOWN',
      reason: data.reason,
      votes_jsonb: data.votes_jsonb as IAgentVote[],
      final_workout_jsonb: data.final_workout_jsonb as IWorkout,
      certainty_score: data.certainty_score,
      certainty_delta: data.certainty_delta,
      inputs_summary_jsonb: data.inputs_summary_jsonb as DailyDecisionSnapshot['inputs_summary_jsonb'],
      created_at: data.created_at,
      updated_at: data.updated_at
    };
    
    return { success: true, snapshot };
  } catch (err) {
    logger.error('Failed to load daily snapshot', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Invalidates snapshot by deleting it (when inputs change)
 */
export async function invalidateSnapshot(userId: string, date: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerClient();
    
    const { error } = await supabase
      .from('daily_decision_snapshot')
      .delete()
      .eq('user_id', userId)
      .eq('date', date);
    
    if (error) {
      logger.error('Failed to invalidate snapshot', error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    logger.error('Failed to invalidate snapshot', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

