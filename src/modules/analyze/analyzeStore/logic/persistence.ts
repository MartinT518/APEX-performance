import { supabase } from '@/lib/supabase';
import type { BaselineMetrics } from './baselineCalculator';
import { logger } from '@/lib/logger';

/**
 * Persists baseline metrics to Supabase (best effort, doesn't throw)
 */
export async function persistBaselineMetrics(
  metrics: BaselineMetrics,
  date: string
): Promise<void> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (userId) {
      type BaselineMetricsInsert = {
        user_id: string;
        date: string;
        hrv: number | null;
        tonnage: number | null;
        fueling_carbs_per_hour: number | null;
      };
      
      await (supabase
        .from('baseline_metrics')
        .upsert({
          user_id: userId,
          date,
          hrv: metrics.hrv ?? null,
          tonnage: metrics.tonnage ?? null,
          fueling_carbs_per_hour: metrics.fuelingCarbs ?? null,
        } as BaselineMetricsInsert, {
          onConflict: 'user_id,date',
        }) as unknown as Promise<{ error: unknown }>);
    }
  } catch (err) {
    logger.warn('Failed to persist baseline metrics to Supabase', err);
    // Don't throw - this is best-effort persistence
  }
}

