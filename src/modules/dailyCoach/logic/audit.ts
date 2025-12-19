import { checkAuditGating, type AuditGatingInput } from './auditGating';
import type { GarminClient } from '../../monitor/ingestion/garminClient';
import { logger } from '@/lib/logger';

export type { AuditGatingInput };

export type AuditStatus = 'AUDIT_PENDING' | 'CAUTION' | 'NOMINAL';

/**
 * Performs daily audit: checks if user inputs are required
 * 
 * Now uses pure auditGating function instead of zustand stores
 */
export async function performDailyAudit(
  auditInputs: AuditGatingInput,
  garminClient: GarminClient | null
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

  // Use pure audit gating function
  const audit = checkAuditGating({
    ...auditInputs,
    lastRunDuration: realDuration
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

