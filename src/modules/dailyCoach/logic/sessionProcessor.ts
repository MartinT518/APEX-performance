import { usePhenotypeStore } from '../../monitor/phenotypeStore';
import { validateHighRevPhysiology } from '../../kill/logic/highRevFilter';
import { detectCadenceLock } from '../../kill/logic/cadenceLock';
import { adaptGarminToSessionStream } from '../../monitor/ingestion/garminAdapter';
import type { GarminClient } from '../../monitor/ingestion/garminClient';
import type { ISessionDataPoint, IFilterDiagnostics } from '@/types/session';
import { logger } from '@/lib/logger';

export interface SessionProcessingResult {
  points: ISessionDataPoint[];
  diagnostics: IFilterDiagnostics;
  cadenceLockDetected?: boolean;
  metadata?: {
    dataSource: 'GARMIN' | 'SIMULATION' | 'NONE';
    activityId?: string;
    activityName?: string;
    timestamp?: string;
    // Allow additional metadata fields for Garmin sync
    [key: string]: unknown;
  };
}

/**
 * Processes session data: fetches from Garmin if needed, validates with High-Rev filter
 */
export async function processSessionData(
  points: ISessionDataPoint[] = [],
  garminClient: GarminClient | null
): Promise<SessionProcessingResult> {
  logger.info(">> Step 3: Raw Data Processing");
  
  let sessionPoints = points;
  let dataSource: 'GARMIN' | 'SIMULATION' | 'NONE' = 'NONE';
  let activityId: string | undefined;
  let activityName: string | undefined;

  // If no points provided, try fetching from Garmin (prioritize live data)
  if (sessionPoints.length === 0 && garminClient) {
    logger.info("Fetching latest session from Garmin...");
    try {
      const activities = await garminClient.getRecentActivities(1);
      if (activities.length > 0) {
        const activity = activities[0];
        const details = await garminClient.getActivityDetails(activity.activityId);
        if (details) {
          const stream = adaptGarminToSessionStream(details);
          sessionPoints = stream.dataPoints;
          dataSource = 'GARMIN';
          activityId = `${activity.activityId}`;
          activityName = activity.activityName;
          logger.info(`✅ Ingested ${sessionPoints.length} points from Garmin: ${activityName}`);
        } else {
          logger.warn("⚠️ Garmin activity details not available");
        }
      } else {
        logger.info("ℹ️ No recent Garmin activities found");
      }
    } catch (e) {
      logger.error("Garmin Fetch Error", e);
    }
  } else if (sessionPoints.length > 0) {
    // Points were provided directly (could be from simulation or manual input)
    dataSource = 'SIMULATION';
    activityName = 'Provided Session';
  }

  if (sessionPoints.length === 0) {
    logger.warn("⚠️ No session data available for processing. Skipping Kill Filter.");
    return { 
      points: [],
      diagnostics: {
        status: 'VALID', 
        validPointCount: 0, 
        originalPointCount: 0,
        flaggedIndices: []
      },
      metadata: { 
        dataSource: 'NONE',
        timestamp: new Date().toISOString()
      }
    };
  }

  const profile = usePhenotypeStore.getState().profile;
  if (!profile) throw new Error("Profile not loaded");

  const integrity = validateHighRevPhysiology(sessionPoints, profile);
  logger.info(`Integrity Check: ${integrity.status} (${integrity.validPointCount}/${integrity.originalPointCount} valid)`);
  
  if (integrity.status === 'SUSPECT') {
    throw new Error("Session Data Rejected: Signal Noise or Artifacts detected.");
  }

  // Check for cadence lock
  const cadenceLockDiagnostics = detectCadenceLock(sessionPoints);
  const cadenceLockDetected = cadenceLockDiagnostics.flaggedIndices.length > 0;
  
  if (cadenceLockDetected) {
    logger.warn(`Cadence Lock detected: ${cadenceLockDiagnostics.flaggedIndices.length} points flagged`);
  }

  // Add cadence lock info to metadata if detected
  const metadata: SessionProcessingResult['metadata'] = {
    dataSource, 
    activityId, 
    activityName, 
    timestamp: new Date().toISOString()
  };
  
  return { 
    points: sessionPoints,
    diagnostics: integrity,
    cadenceLockDetected,
    metadata
  };
}

