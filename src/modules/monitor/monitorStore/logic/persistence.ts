import { supabase } from '@/lib/supabase';
import type { TonnageTier } from '../monitorStore';
import { tonnageTierToDb } from './tierMapper';
import { logger } from '@/lib/logger';

export interface PersistenceResult {
  success: boolean;
  error?: string;
}

/**
 * Persists niggle score to Supabase
 */
export async function persistNiggleScore(score: number, date: string): Promise<PersistenceResult> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      return { success: false, error: 'No authenticated user' };
    }

    const { error } = await supabase
      .from('daily_monitoring')
      .upsert({
        user_id: userId,
        date,
        niggle_score: score,
      }, {
        onConflict: 'user_id,date',
      });

    if (error) {
      logger.error('Failed to persist niggle score', error);
      return { success: false, error: 'Database error occurred' };
    }

    return { success: true };
  } catch (err) {
    logger.error('Failed to persist niggle score to Supabase', err);
    return { success: false, error: 'An error occurred while saving' };
  }
}

/**
 * Persists strength session to Supabase
 */
export async function persistStrengthSession(
  performed: boolean,
  tier: TonnageTier | undefined,
  date: string
): Promise<PersistenceResult> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      return { success: false, error: 'No authenticated user' };
    }

    const strengthTier = tier ? tonnageTierToDb(tier) : null;

    const { error } = await supabase
      .from('daily_monitoring')
      .upsert({
        user_id: userId,
        date,
        strength_session: performed,
        strength_tier: strengthTier,
      }, {
        onConflict: 'user_id,date',
      });

    if (error) {
      logger.error('Failed to persist strength session', error);
      return { success: false, error: 'Database error occurred' };
    }

    return { success: true };
  } catch (err) {
    logger.error('Failed to persist strength session to Supabase', err);
    return { success: false, error: 'An error occurred while saving' };
  }
}

/**
 * Persists fueling log to Supabase
 */
export async function persistFuelingLog(
  carbsPerHour: number,
  date: string
): Promise<PersistenceResult> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      return { success: false, error: 'No authenticated user' };
    }

    const { error } = await supabase
      .from('daily_monitoring')
      .upsert({
        user_id: userId,
        date,
        fueling_logged: true,
        fueling_carbs_per_hour: carbsPerHour,
      }, {
        onConflict: 'user_id,date',
      });

    if (error) {
      logger.error('Failed to persist fueling log', error);
      return { success: false, error: 'Database error occurred' };
    }

    return { success: true };
  } catch (err) {
    logger.error('Failed to persist fueling log to Supabase', err);
    return { success: false, error: 'An error occurred while saving' };
  }
}

