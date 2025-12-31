import { usePhenotypeStore } from '../../monitor/phenotypeStore';
import { validateHighRevPhysiology } from '../../kill/logic/highRevFilter';
import { detectCadenceLock } from '../../kill/logic/cadenceLock';
import { detectDropouts, detectClipping } from '../../kill/logic/integrity';
import { adaptGarminToSessionStream } from '../../monitor/ingestion/garminAdapter';
import { evaluateDataIntegrity } from '../../kill/agents/dataIntegrityAgent';
import type { GarminClient } from '../../monitor/ingestion/garminClient';
import type { ISessionDataPoint, IFilterDiagnostics } from '@/types/session';
import type { SessionIntegrity } from '@/types/agents';
import { logger } from '@/lib/logger';

export interface SessionProcessingResult {
  points: ISessionDataPoint[];
  diagnostics: IFilterDiagnostics;
  integrity: SessionIntegrity; // Data Integrity Agent output
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
          
          // Capture summary metrics from Garmin objects
          const distanceMeters = (activity.distance || (details as any).summaryDTO?.distance || 0) as number;
          const avgSpeed = (activity.averageSpeed || (details as any).summaryDTO?.averageSpeed || 0) as number;
          const distanceKm = distanceMeters > 0 ? distanceMeters / 1000 : undefined;
          
          // Calculate pace from avgSpeed (m/s) if available
          let avgPace: string | undefined;
          if (avgSpeed > 0) {
            const paceSeconds = 1000 / avgSpeed;
            const minutes = Math.floor(paceSeconds / 60);
            const seconds = Math.floor(paceSeconds % 60);
            avgPace = `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
          }

          // Capture strength exercises if available
          let protocol: { warmup?: string; main: string[]; cooldown?: string } | undefined;
          const activityType = activity.activityType || '';
          if (activityType.toLowerCase().includes('strength')) {
            const detailObj = details as any;
            const sets = detailObj.summaryDTO?.strengthTrainingDto?.sets || 
                         detailObj.metadataDTO?.strengthTrainingDto?.sets || [];
            
            if (sets.length > 0) {
              const exercises: string[] = [];
              sets.forEach((set: any, idx: number) => {
                const weight = set.weight ? ` @ ${(set.weight / 1000).toFixed(1)}kg` : '';
                const reps = set.reps ? `${set.reps} reps` : 'Active';
                const name = set.exerciseName || `Set ${idx + 1}`;
                exercises.push(`${name}: ${reps}${weight}`);
              });
              protocol = { main: exercises };
            }
          }

          logger.info(`✅ Ingested ${sessionPoints.length} points from Garmin: ${activityName} (${distanceKm?.toFixed(2)}km)`);
          
          // Return with enriched metadata
          return {
            points: sessionPoints,
            diagnostics: { status: 'VALID', validPointCount: sessionPoints.length, originalPointCount: sessionPoints.length, flaggedIndices: [] },
            integrity: { status: 'VALID', confidence: 1.0, reason: 'Live Garmin data', flags: [] },
            metadata: {
              dataSource,
              activityId,
              activityName,
              timestamp: new Date().toISOString(),
              distanceKm,
              avgPace,
              durationMinutes: Math.round(((activity.duration || 0) as number) / 60),
              protocol // Add extracted protocol
            }
          };
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

  // CRITICAL: Data Integrity Agent runs as middleware BEFORE DB insert
  // This prevents bad data from being persisted and triggering false agent votes
  logger.info(">> Data Integrity Agent: Validating session data integrity");
  
  const integrity = evaluateDataIntegrity({
    sessionPoints,
    phenotypeProfile: profile
  });
  
  logger.info(`Data Integrity: ${integrity.status} (confidence: ${(integrity.confidence * 100).toFixed(1)}%)`);
  if (integrity.flags.length > 0) {
    logger.info(`Flags: ${integrity.flags.join(', ')}`);
  }
  
  // If REJECTED, throw error and prevent session persistence
  if (integrity.status === 'REJECTED') {
    const errorMessage = `Data Integrity REJECTED: ${integrity.reason || 'Critical data integrity failure'}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Continue with existing filter chain for diagnostics (but integrity already checked)
  // Integrity Filter Chain - Order is critical:
  // 1. HighRevFilter (phenotype-aware) - FIRST
  // 2. Dropouts detection
  // 3. Clipping detection
  // 4. Cadence lock
    // ARCHITECTURAL PRIORITY: HighRevFilter MUST execute before standard noise filters.
    // This ensures legitimate high-HR physiology (phenotype-aware) isn't killed as noise.
  const highRevDiagnostics = validateHighRevPhysiology(sessionPoints, profile);
  logger.info(`HighRev Filter: ${highRevDiagnostics.status} (${highRevDiagnostics.validPointCount}/${highRevDiagnostics.originalPointCount} valid)`);
  
  // Collect all flagged indices from all checks
  const allFlaggedIndices = new Set<number>(highRevDiagnostics.flaggedIndices);
  
  // 2. Dropouts detection (after HighRevFilter)
  const dropoutDiagnostics = detectDropouts(sessionPoints);
  logger.info(`Dropout Check: ${dropoutDiagnostics.status} (${dropoutDiagnostics.flaggedIndices.length} points flagged)`);
  dropoutDiagnostics.flaggedIndices.forEach(idx => allFlaggedIndices.add(idx));
  
  // 3. Clipping detection
  const clippingDiagnostics = detectClipping(sessionPoints);
  logger.info(`Clipping Check: ${clippingDiagnostics.status} (${clippingDiagnostics.flaggedIndices.length} points flagged)`);
  clippingDiagnostics.flaggedIndices.forEach(idx => allFlaggedIndices.add(idx));
  
  // 4. Cadence lock (with phenotype awareness)
  const cadenceLockDiagnostics = await detectCadenceLock(sessionPoints, profile);
  const cadenceLockDetected = cadenceLockDiagnostics.flaggedIndices.length > 0;
  logger.info(`Cadence Lock Check: ${cadenceLockDiagnostics.status} (${cadenceLockDiagnostics.flaggedIndices.length} points flagged)`);
  cadenceLockDiagnostics.flaggedIndices.forEach(idx => allFlaggedIndices.add(idx));
  
  // Merge all diagnostics into final result
  const finalFlaggedIndices = Array.from(allFlaggedIndices).sort((a, b) => a - b);
  const validPointCount = sessionPoints.length - finalFlaggedIndices.length;
  
  // Determine overall status: reject if > 20% of data is flagged
  const flaggedRatio = finalFlaggedIndices.length / sessionPoints.length;
  const overallStatus: IFilterDiagnostics['status'] = flaggedRatio > 0.2 ? 'SUSPECT' : 'VALID';
  
  // Collect all reasons
  const reasons: string[] = [];
  if (highRevDiagnostics.reason) reasons.push(highRevDiagnostics.reason);
  if (dropoutDiagnostics.reason) reasons.push(dropoutDiagnostics.reason);
  if (clippingDiagnostics.reason) reasons.push(clippingDiagnostics.reason);
  if (cadenceLockDiagnostics.reason) reasons.push(cadenceLockDiagnostics.reason);
  
  const finalDiagnostics: IFilterDiagnostics = {
    status: overallStatus,
    reason: reasons.length > 0 ? reasons.join('; ') : undefined,
    flaggedIndices: finalFlaggedIndices,
    originalPointCount: sessionPoints.length,
    validPointCount
  };
  
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
    diagnostics: finalDiagnostics,
    integrity, // Include integrity result for decision flow
    cadenceLockDetected,
    metadata
  };
}

