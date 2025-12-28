import { supabase } from '@/lib/supabase';
import type { TonnageTier } from '../../monitorStore';
import { dbToTonnageTier } from './tierMapper';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';

type DailyMonitoringRow = Database['public']['Tables']['daily_monitoring']['Row'];

export interface TodayMonitoringData {
  niggleScore: number | null;
  strengthSession: {
    performed: boolean;
    tonnageTier?: TonnageTier;
  } | null;
  fuelingLog: {
    carbsPerHour: number;
    giDistress: number;
  } | null;
  hrv: number | null;
  rhr: number | null;
  sleepSeconds: number | null;
  sleepScore: number | null;
  lastAuditTime: number | null;
}

/**
 * Loads today's monitoring data from Supabase
 */
export async function loadTodayMonitoringFromSupabase(
  userId?: string
): Promise<TodayMonitoringData | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get current user if not provided
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: session } = await supabase.auth.getSession();
      targetUserId = session?.session?.user?.id;
    }

    if (!targetUserId) {
      logger.warn('No user ID available. Skipping daily monitoring load.');
      return null;
    }

    // Load today's monitoring entry
    const { data: rawData, error } = await supabase
      .from('daily_monitoring')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('date', today)
      .maybeSingle();

    if (error) throw error;

    if (!rawData) {
      return null;
    }

    const data = rawData as any;

    // Map database tier to TonnageTier
    const tonnageTier = data.strength_tier ? dbToTonnageTier(data.strength_tier) : undefined;

    return {
      niggleScore: data.niggle_score,
      strengthSession: data.strength_session ? {
        performed: true,
        tonnageTier,
      } : null,
      fuelingLog: data.fueling_logged && data.fueling_carbs_per_hour !== null ? {
        carbsPerHour: data.fueling_carbs_per_hour,
        giDistress: data.fueling_gi_distress ?? 0,
      } : null,
      hrv: data.hrv,
      rhr: data.rhr,
      sleepSeconds: data.sleep_seconds,
      sleepScore: data.sleep_score,
      lastAuditTime: data.updated_at ? new Date(data.updated_at).getTime() : null,
    };


  } catch (err) {
    logger.warn('Failed to load daily monitoring from Supabase', err);
    return null;
  }
}
