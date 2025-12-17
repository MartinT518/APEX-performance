import { useMonitorStore } from '../../monitor/monitorStore';
import { checkAuditNecessity } from '../../monitor/logic/auditManager';
import type { GarminClient } from '../../monitor/ingestion/garminClient';
import { logger } from '@/lib/logger';

export type AuditStatus = 'AUDIT_PENDING' | 'CAUTION' | 'NOMINAL';

/**
 * Performs daily audit: checks if user inputs are required
 */
export async function performDailyAudit(
  lastRunDuration: number,
  garminClient: GarminClient | null
): Promise<AuditStatus> {
  logger.info(">> Step 2: Active User Ingestion");
  
  // Use real Garmin data if available for duration check
  let realDuration = lastRunDuration;
  
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

  const audit = checkAuditNecessity(realDuration);
  
  if (audit.requiresAudit) {
    logger.warn(`[AUDIT REQUIRED] ${audit.auditType}: ${audit.message}`);
    return 'AUDIT_PENDING';
  }
  
  const monitor = useMonitorStore.getState();
  if (monitor.todayEntries.niggleScore && monitor.todayEntries.niggleScore > 3) {
    return 'CAUTION';
  }
  
  return 'NOMINAL';
}

