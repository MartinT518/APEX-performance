import { ISessionDataPoint, IFilterDiagnostics } from '@/types/session';

/**
 * FR-K2: Integrity Checks
 * 
 * Purpose: Detect and flag sensor failures.
 */

// Helper: Calculate Pearson Correlation Coefficient
import { detectCadenceLock } from './cadenceLock';

export { detectCadenceLock };

/**
 * Detects Sensor Dropouts (Sudden plummets).
 * Rule: Delta HR > 40bpm in < 3 sec.
 */
export const detectDropouts = (points: ISessionDataPoint[]): IFilterDiagnostics => {
  const flaggedIndices: number[] = [];
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i-1];
    const curr = points[i];
    const timeDelta = curr.timestamp - prev.timestamp; // assuming seconds
    
    if (timeDelta <= 3 && timeDelta > 0) {
      if (prev.heartRate === undefined || curr.heartRate === undefined) continue;
      const drop = prev.heartRate - curr.heartRate;
      if (drop > 40) {
        flaggedIndices.push(i);
        // Usually implies a recovery period is needed or sensor fell off
        // We might validly flag a few subsequent points too in a real engine
      }
    }
  }

  const hasDropouts = flaggedIndices.length > 0;

  return {
    status: hasDropouts ? 'SUSPECT' : 'VALID',
    reason: hasDropouts ? 'Sudden signal dropouts detected' : undefined,
    flaggedIndices,
    originalPointCount: points.length,
    validPointCount: points.length - flaggedIndices.length
  };
};

/**
 * Detects "Clipping" or Stuck Values.
 * Rule: Value remains exact same for > 120 seconds.
 * Often indicates sensor freeze or loose contact.
 */
export const detectClipping = (points: ISessionDataPoint[]): IFilterDiagnostics => {
  const flaggedIndices: number[] = [];
  const STUCK_THRESHOLD_SECONDS = 120; // 2 minutes
  
  let currentStreak = 0;
  let stuckValue = -1;
  let streakIndices: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i-1];
    const curr = points[i];
    
    // Check if HR is identical
    if (prev.heartRate !== undefined && curr.heartRate !== undefined && prev.heartRate === curr.heartRate) {
        if (currentStreak === 0) {
            stuckValue = prev.heartRate;
            streakIndices.push(i-1);
        }
        currentStreak += (curr.timestamp - prev.timestamp);
        streakIndices.push(i);
    } else {
        // Streak broken
        if (currentStreak > STUCK_THRESHOLD_SECONDS) {
            flaggedIndices.push(...streakIndices);
        }
        currentStreak = 0;
        streakIndices = [];
    }
  }
  
  // Check final segment
  if (currentStreak > STUCK_THRESHOLD_SECONDS) {
      flaggedIndices.push(...streakIndices);
  }

  const hasClipping = flaggedIndices.length > 0;

  return {
    status: hasClipping ? 'SUSPECT' : 'VALID',
    reason: hasClipping ? `Sensor stuck at ${stuckValue}bpm for > ${STUCK_THRESHOLD_SECONDS}s` : undefined,
    flaggedIndices,
    originalPointCount: points.length,
    validPointCount: points.length - flaggedIndices.length
  };
};
