import { checkAuditGating, type AuditGatingInput } from './auditGating';
import type { GarminClient } from '../../monitor/ingestion/garminClient';
import { logger } from '@/lib/logger';
import { getMostRecentMissingFueling } from './auditHistoryChecker';
import { createServerClient } from '@/lib/supabase';

export type { AuditGatingInput };

export type AuditStatus = 'AUDIT_PENDING' | 'CAUTION' | 'NOMINAL';

/**
 * Performs daily audit: checks if user inputs are required
 * 
 * Now uses pure auditGating function instead of zustand stores.
 * 
 * Enhanced to check history stream for activities >90min without fueling data.
 */
export async function performDailyAudit(
  auditInputs: AuditGatingInput,
  garminClient: GarminClient | null,
  userId?: string
): Promise<AuditStatus> {
  logger.info(">> Step 2: Active User Ingestion");
  
  // Use real Garmin data if available for duration check
  let realDuration = auditInputs.lastRunDuration;
  
  if (garminClient) {
    try {
      // Fetch latest activity to check duration
      const activities = await garminClient.getRecentActivities(1);
      if (activities.length > 0) {
        // durationInSeconds / 60
        realDuration = activities[0].durationInSeconds / 60;
        logger.info(`✅ Fetched Real Run Duration: ${realDuration.toFixed(1)} mins`);
      }
    } catch (e) {
      logger.warn("Failed to fetch recent activity for audit", e);
    }
  }

  // Check history stream for activities >90min without fueling data
  // Roadmap requirement: "Automatically prompt for Carbs/hr and GI Distress for any activity in the history/current stream > 90min"
  let hasHistoricalLongRunWithoutFueling = false;
  if (userId) {
    try {
      const missingFueling = await getMostRecentMissingFueling(userId, 30);
      if (missingFueling) {
        logger.warn(`[FUELING AUDIT REQUIRED] Activity ${missingFueling.sessionId} on ${missingFueling.sessionDate} (${missingFueling.durationMinutes}min) missing fueling data`);
        hasHistoricalLongRunWithoutFueling = true;
      }
    } catch (e) {
      logger.warn("Failed to check history for missing fueling, proceeding with standard audit:", e);
    }
  }

  // Use pure audit gating function with historical context
  const audit = checkAuditGating({
    ...auditInputs,
    lastRunDuration: realDuration,
    hasHistoricalLongRunWithoutFueling
  });
  
  if (audit.auditRequired) {
    logger.warn(`[AUDIT REQUIRED] ${audit.auditType}: Missing inputs: ${audit.missingInputs.join(', ')}`);
    return 'AUDIT_PENDING';
  }
  
  // Check for caution (niggle > 3 but not blocking)
  if (auditInputs.niggleScore !== null && auditInputs.niggleScore > 3) {
    return 'CAUTION';
  }
  
  return 'NOMINAL';
}

