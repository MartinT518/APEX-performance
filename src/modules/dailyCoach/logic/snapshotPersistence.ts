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
  votes_jsonb: IAgentVote[];
  final_workout_jsonb: IWorkout;
  certainty_score?: number | null;
  certainty_delta?: number | null;
  inputs_summary_jsonb?: {
    niggle_score: number | null;
    strength_tier: string | null;
    last_run_duration: number;
    fueling_carbs_per_hour: number | null;
    fueling_gi_distress: number | null;
  } | null;
  // Optional authentication tokens for RLS
  clientAccessToken?: string;
  clientRefreshToken?: string;
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
    // Pass token to createServerClient - it will set Authorization header
    const supabase = await createServerClient(input.clientAccessToken || undefined);
    
    // Don't call setSession() here - createServerClient already handles it
    // The Authorization header should be sufficient for RLS
    
    const { error, data } = await supabase
      .from('daily_decision_snapshot')
      .upsert({
        user_id: input.userId,
        date: input.date,
        global_status: input.global_status,
        reason: input.reason,
        votes_jsonb: input.votes_jsonb as unknown as import('@/types/database').Json,
        final_workout_jsonb: input.final_workout_jsonb as unknown as import('@/types/database').Json,
        certainty_score: input.certainty_score ?? null,
        certainty_delta: input.certainty_delta ?? null,
        inputs_summary_jsonb: input.inputs_summary_jsonb as unknown as import('@/types/database').Json ?? null
      }, {
        onConflict: 'user_id,date'
      })
      .select('id')
      .single();
    
    if (error) {
      // If RLS error, try setting session explicitly as fallback
      if (error.code === '42501' && input.clientAccessToken && input.userId) {
        logger.warn('RLS error detected, attempting to set session explicitly');
        try {
          await supabase.auth.setSession({
            access_token: input.clientAccessToken,
            refresh_token: input.clientRefreshToken || '',
          } as { access_token: string; refresh_token: string });
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Retry the operation
          const { error: retryError, data: retryData } = await supabase
            .from('daily_decision_snapshot')
            .upsert({
              user_id: input.userId,
              date: input.date,
              global_status: input.global_status,
              reason: input.reason,
              votes_jsonb: input.votes_jsonb as unknown as import('@/types/database').Json,
              final_workout_jsonb: input.final_workout_jsonb as unknown as import('@/types/database').Json,
              certainty_score: input.certainty_score ?? null,
              certainty_delta: input.certainty_delta ?? null,
              inputs_summary_jsonb: input.inputs_summary_jsonb as unknown as import('@/types/database').Json ?? null
            }, {
              onConflict: 'user_id,date'
            })
            .select('id')
            .single();
          
          if (retryError) {
            logger.error('Failed to persist daily snapshot after retry', retryError);
            return { success: false, error: retryError.message };
          }
          
          return { success: true, snapshotId: retryData?.id };
        } catch (sessionError: any) {
          logger.error('Failed to set session in persistDailySnapshot retry:', sessionError?.message);
        }
      }
      
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
  // Optional authentication tokens for RLS
  clientAccessToken?: string;
  clientRefreshToken?: string;
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
    // Pass token to createServerClient - it will set Authorization header
    const supabase = await createServerClient(input.clientAccessToken || undefined);
    
    // Don't call setSession() here - createServerClient already handles it
    // The Authorization header should be sufficient for RLS
    
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
export async function invalidateSnapshot(
  userId: string,
  date: string,
  clientAccessToken?: string,
  clientRefreshToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Pass token to createServerClient - it will set Authorization header
    const supabase = await createServerClient(clientAccessToken || undefined);
    
    // Don't call setSession() here - createServerClient already handles it
    // The Authorization header should be sufficient for RLS
    
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

/**
 * FR-5.5: Invalidates all future snapshots (date >= today) when phenotype changes
 * 
 * Called when phenotype profile is updated (max HR, High-Rev mode, etc.)
 * Past snapshots are preserved (historical record)
 */
export async function invalidateFutureSnapshots(
  userId: string,
  clientAccessToken?: string,
  clientRefreshToken?: string
): Promise<{ success: boolean; error?: string; invalidatedCount?: number }> {
  try {
    // Pass token to createServerClient - it will set Authorization header
    const supabase = await createServerClient(clientAccessToken || undefined);
    
    const today = new Date().toISOString().split('T')[0];
    
    // Delete all snapshots with date >= today (future snapshots only)
    const { error, count } = await supabase
      .from('daily_decision_snapshot')
      .delete()
      .eq('user_id', userId)
      .gte('date', today);
    
    if (error) {
      logger.error('Failed to invalidate future snapshots', error);
      return { success: false, error: error.message };
    }
    
    logger.info(`Invalidated ${count || 0} future snapshots for user ${userId} (phenotype change)`);
    return { success: true, invalidatedCount: count || 0 };
  } catch (err) {
    logger.error('Failed to invalidate future snapshots', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
