import { ISessionDataPoint, IFilterDiagnostics } from '@/types/session';

/**
 * FR-K2: Cadence Lock Detection
 * 
 * Logic:
 * IF Correlation(HR, Cadence) > 0.95 for > 5 mins -> Discard HR.
 * 
 * This prevents "Cadence Lock" artifacts where the optical sensor locks onto the
 * physical impact of the foot strike rather than the heart beat.
 */

// Window size for correlation check (e.g., 60 seconds)
const WINDOW_SIZE_SECONDS = 60; 
const CORRELATION_THRESHOLD = 0.95;
// Consecutive windows required to trigger "Lock" state (5 minutes)
const REQUIRED_CONSECUTIVE_MINUTES = 5;

export const detectCadenceLock = (
  stream: ISessionDataPoint[]
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
    
    if (r > CORRELATION_THRESHOLD) {
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
