import { supabase } from '@/lib/supabase';
import { calculateEWMA, calculateRollingAverage } from '../../baselineEngine';
import type { BaselineHistory, Baselines } from './baselineCalculator';
import { logger } from '@/lib/logger';

/**
 * Loads baseline metrics from Supabase and reconstructs history/baselines
 */
export async function loadBaselinesFromSupabase(
  userId?: string
): Promise<{ history: BaselineHistory; baselines: Baselines } | null> {
  try {
    // Get current user if not provided
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: session } = await supabase.auth.getSession();
      targetUserId = session?.session?.user?.id;
    }

    if (!targetUserId) {
      logger.warn('No user ID available. Skipping baseline load.');
      return null;
    }

    // Load last 28 days of metrics
    type BaselineMetricsRow = {
      id: string;
      user_id: string;
      date: string;
      hrv: number | null;
      tonnage: number | null;
      fueling_carbs_per_hour: number | null;
      created_at: string;
    };
    
    const { data, error } = await supabase
      .from('baseline_metrics')
      .select('*')
      .eq('user_id', targetUserId)
      .order('date', { ascending: false })
      .limit(28) as { data: BaselineMetricsRow[] | null; error: unknown };

    if (error) throw error;

    if (!data || data.length === 0) {
      return null;
    }

    // Reconstruct history arrays
    const hrvHistory = data
      .map(row => row.hrv)
      .filter((hrv): hrv is number => hrv !== null)
      .reverse();
    
    const tonnageHistory = data
      .slice(0, 7) // Last 7 days
      .map(row => row.tonnage)
      .filter((tonnage): tonnage is number => tonnage !== null)
      .reverse();
    
    const fuelingHistory = data
      .map(row => row.fueling_carbs_per_hour)
      .filter((carbs): carbs is number => carbs !== null)
      .reverse();

    // Recalculate baselines from loaded data
    const hrv7Day = hrvHistory.length > 0 
      ? calculateEWMA(hrvHistory[hrvHistory.length - 1], null, 7)
      : null;
    const hrv28Day = hrvHistory.length > 0
      ? calculateEWMA(hrvHistory[hrvHistory.length - 1], null, 28)
      : null;
    const tonnage7Day = tonnageHistory.length > 0
      ? calculateRollingAverage(tonnageHistory)
      : null;
    const gutTrainingIndex = fuelingHistory.filter(c => c > 60).length;

    return {
      history: {
        hrv: hrvHistory,
        tonnage: tonnageHistory,
        fuelingSessions: fuelingHistory,
      },
      baselines: {
        hrv7Day,
        hrv28Day,
        tonnage7Day,
        gutTrainingIndex,
        confidenceScore: "UNKNOWN", // Will be recalculated separately
      },
    };
  } catch (err) {
    logger.warn('Failed to load baselines from Supabase', err);
    return null;
  }
}

