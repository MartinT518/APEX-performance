/**
 * Audit History Checker
 * 
 * Checks the history stream for activities >90min that require fueling audit.
 * This implements the roadmap requirement: "Automatically prompt for Carbs/hr and GI Distress 
 * for any activity in the history/current stream > 90min."
 */

import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface MissingFuelingActivity {
  sessionId: string;
  sessionDate: string;
  durationMinutes: number;
  sportType: string;
}

/**
 * Checks history stream for activities >90min without fueling data
 * 
 * @param userId - User ID
 * @param lookbackDays - Number of days to look back (default: 30)
 * @returns Array of activities that need fueling audit
 */
export async function checkHistoryForMissingFueling(
  userId: string,
  lookbackDays: number = 30
): Promise<MissingFuelingActivity[]> {
  try {
    const supabase = await createServerClient();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Query sessions >90min
    const { data: sessions, error } = await supabase
      .from('session_logs')
      .select('id, session_date, duration_minutes, sport_type, metadata')
      .eq('user_id', userId)
      .gte('session_date', startDateStr)
      .lte('session_date', endDateStr)
      .gt('duration_minutes', 90)
      .eq('sport_type', 'RUNNING') // Only check running sessions
      .order('session_date', { ascending: false });
    
    if (error) {
      logger.error('Failed to query history for missing fueling:', error);
      return [];
    }
    
    if (!sessions || sessions.length === 0) {
      return [];
    }
    
    // Check which sessions don't have fueling data in daily_monitoring
    const missingFueling: MissingFuelingActivity[] = [];
    
    for (const session of sessions) {
      const sessionDate = session.session_date;
      
      // Check if fueling was logged for this date
      const { data: monitoring, error: monitoringError } = await supabase
        .from('daily_monitoring')
        .select('fueling_logged, fueling_carbs_per_hour, fueling_gi_distress')
        .eq('user_id', userId)
        .eq('date', sessionDate)
        .maybeSingle();
      
      if (monitoringError) {
        logger.warn(`Failed to check fueling for session ${session.id}:`, monitoringError);
        continue;
      }
      
      // If no monitoring entry, or fueling not logged, or missing carbs/gi_distress
      const needsFueling = !monitoring || 
                           !monitoring.fueling_logged || 
                           monitoring.fueling_carbs_per_hour === null || 
                           monitoring.fueling_gi_distress === null;
      
      if (needsFueling) {
        missingFueling.push({
          sessionId: session.id,
          sessionDate: sessionDate,
          durationMinutes: session.duration_minutes || 0,
          sportType: session.sport_type || 'RUNNING'
        });
      }
    }
    
    return missingFueling;
  } catch (err) {
    logger.error('Error checking history for missing fueling:', err);
    return [];
  }
}

/**
 * Gets the most recent activity >90min that needs fueling audit
 * 
 * @param userId - User ID
 * @param lookbackDays - Number of days to look back (default: 30)
 * @returns Most recent activity needing fueling audit, or null
 */
export async function getMostRecentMissingFueling(
  userId: string,
  lookbackDays: number = 30
): Promise<MissingFuelingActivity | null> {
  const missing = await checkHistoryForMissingFueling(userId, lookbackDays);
  return missing.length > 0 ? missing[0] : null; // Most recent is first (ordered desc)
}
