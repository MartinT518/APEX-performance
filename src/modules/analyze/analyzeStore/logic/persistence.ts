import { supabase } from '@/lib/supabase';
import type { BaselineMetrics } from './baselineCalculator';

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
      await supabase
        .from('baseline_metrics')
        .upsert({
          user_id: userId,
          date,
          hrv: metrics.hrv ?? null,
          tonnage: metrics.tonnage ?? null,
          fueling_carbs_per_hour: metrics.fuelingCarbs ?? null,
        }, {
          onConflict: 'user_id,date',
        });
    }
  } catch (err) {
    console.warn('Failed to persist baseline metrics to Supabase:', err);
    // Don't throw - this is best-effort persistence
  }
}

