import { ISessionDataPoint, IFilterDiagnostics } from '@/types/session';
import type { IPhenotypeProfile } from '@/types/phenotype';
import { logger } from '@/lib/logger';

/**
 * FR-K2: Cadence Lock Detection
 * 
 * Logic:
 * IF Correlation(HR, Cadence) > 0.95 for > 5 mins -> Discard HR.
 * 
 * This prevents "Cadence Lock" artifacts where the optical sensor locks onto the
 * physical impact of the foot strike rather than the heart beat.
 * 
 * Phenotype Awareness:
 * High-cadence runners (180spm+) often have HR matching cadence naturally.
 * This function distinguishes valid "coupling" from sensor "lock" artifacts.
 */

// Window size for correlation check (e.g., 60 seconds)
const WINDOW_SIZE_SECONDS = 60; 
const CORRELATION_THRESHOLD = 0.95;
// Consecutive windows required to trigger "Lock" state (5 minutes)
const REQUIRED_CONSECUTIVE_MINUTES = 5;
// High-cadence threshold (spm)
const HIGH_CADENCE_THRESHOLD = 175;
// Tolerance for HR-cadence matching in high-cadence runners (bpm)
const HR_CADENCE_TOLERANCE = 5;

export const detectCadenceLock = (
  stream: ISessionDataPoint[],
  profile?: IPhenotypeProfile
): IFilterDiagnostics => {
  const flaggedIndices: number[] = [];
  
  if (stream.length < WINDOW_SIZE_SECONDS) {
    return {
      status: 'VALID',
      flaggedIndices,
      originalPointCount: stream.length,
      validPointCount: stream.length
    };
  }

  // Pre-process: Check if user is a high-cadence runner
  // Calculate average cadence from stream
  const validCadencePoints = stream.filter(p => p.cadence && p.cadence > 0);
  const avgCadence = validCadencePoints.length > 0
    ? validCadencePoints.reduce((sum, p) => sum + (p.cadence || 0), 0) / validCadencePoints.length
    : 0;
  
  const isHighCadenceRunner = avgCadence >= HIGH_CADENCE_THRESHOLD;
  
  if (isHighCadenceRunner) {
    logger.info(`High-cadence runner detected (avg: ${avgCadence.toFixed(1)}spm). Applying phenotype-aware cadence lock detection.`);
  }
  
  // Pre-process: Extract numeric arrays for HR and Cadence
  // We need contiguous data. For now, assume simple 1Hz stream for simplicity.
  
  let lockStreakMinutes = 0;
  let possiblyLockedIndices: number[] = [];

  // Iterate with sliding window (step 1 minute)
  for (let i = 0; i <= stream.length - WINDOW_SIZE_SECONDS; i += 60) {
    const window = stream.slice(i, i + WINDOW_SIZE_SECONDS);
    
    const hrs = window.map(p => p.heartRate || 0);
    const cads = window.map(p => p.cadence || 0);
    
    // Skip if data missing
    if (hrs.some(h => h === 0) || cads.some(c => c === 0)) {
        lockStreakMinutes = 0;
        possiblyLockedIndices = [];
        continue;
    }

    const r = calculatePearsonCorrelation(hrs, cads);
    
    // Phenotype-aware check: For high-cadence runners, check if HR matches cadence
    // If HR is within tolerance of cadence, this might be valid coupling, not lock
    if (r > CORRELATION_THRESHOLD) {
      // Check if this is likely valid coupling vs lock artifact
      const avgHR = hrs.reduce((sum, h) => sum + h, 0) / hrs.length;
      const avgCad = cads.reduce((sum, c) => sum + c, 0) / cads.length;
      const hrCadenceDiff = Math.abs(avgHR - avgCad);
      
      // For high-cadence runners: if HR matches cadence within tolerance, 
      // this is likely valid physiological coupling, not sensor lock
      if (isHighCadenceRunner && hrCadenceDiff <= HR_CADENCE_TOLERANCE) {
        // Valid coupling - don't flag as lock
        // Reset streak since this is not a lock pattern
        if (lockStreakMinutes >= REQUIRED_CONSECUTIVE_MINUTES) {
          // Previous streak was valid, but this window is coupling, so break streak
          // Don't flag previous indices if they were also likely coupling
        }
        lockStreakMinutes = 0;
        possiblyLockedIndices = [];
        continue;
      }
      
      // High correlation AND HR doesn't match cadence (or not high-cadence runner)
      // This is likely a lock artifact
      lockStreakMinutes++;
      // Track indices for this minute
      for(let j=0; j<WINDOW_SIZE_SECONDS; j++) {
        possiblyLockedIndices.push(i + j);
      }
    } else {
      // Streak broken
      if (lockStreakMinutes >= REQUIRED_CONSECUTIVE_MINUTES) {
        // Confirm previous streak
        flaggedIndices.push(...possiblyLockedIndices);
      }
      lockStreakMinutes = 0;
      possiblyLockedIndices = [];
    }
  }

  // Check end of stream
  if (lockStreakMinutes >= REQUIRED_CONSECUTIVE_MINUTES) {
    flaggedIndices.push(...possiblyLockedIndices);
  }
  
  // Deduplicate
  const uniqueFlagged = [...new Set(flaggedIndices)].sort((a,b) => a-b);
  
  const isValid = uniqueFlagged.length / stream.length < 0.5; // If >50% locked, discard whole? Or just those segments.

  return {
    status: isValid ? 'VALID' : 'SUSPECT',
    reason: uniqueFlagged.length > 0 ? `Cadence Lock detected in ${uniqueFlagged.length} points` : undefined,
    flaggedIndices: uniqueFlagged,
    originalPointCount: stream.length,
    validPointCount: stream.length - uniqueFlagged.length
  };
};

/**
 * Calculates Pearson Correlation Coefficient (r)
 */
function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = (n * sumXY) - (sumX * sumY);
  const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));

  if (denominator === 0) return 0;
  return numerator / denominator;
}
