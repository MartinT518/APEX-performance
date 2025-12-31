/**
 * Z-Score Calculator for Historical Normalization
 * 
 * Calculates Z-scores using rolling windows from historical data.
 * Formula: z = (x - μ) / σ
 * Where:
 * - x = current value
 * - μ = mean of rolling window
 * - σ = standard deviation of rolling window
 */

/**
 * Calculates mean (μ) of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Calculates standard deviation (σ) of an array of numbers
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return 0;
  
  const mean = calculateMean(values);
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}

/**
 * Calculates Z-score for a value given historical data
 * 
 * @param currentValue - Current value to normalize
 * @param historicalValues - Array of historical values for the rolling window
 * @returns Z-score (number of standard deviations from mean)
 */
export function calculateZScore(
  currentValue: number | null,
  historicalValues: number[]
): number | null {
  if (currentValue === null || currentValue === undefined) {
    return null;
  }
  
  if (historicalValues.length === 0) {
    return null; // Cannot calculate Z-score without historical data
  }
  
  // Filter out null/undefined values
  const validValues = historicalValues.filter(v => v !== null && v !== undefined && !isNaN(v));
  
  if (validValues.length < 2) {
    return null; // Need at least 2 values for meaningful standard deviation
  }
  
  const mean = calculateMean(validValues);
  const stdDev = calculateStandardDeviation(validValues);
  
  if (stdDev === 0) {
    return 0; // All values are the same, Z-score is 0
  }
  
  return (currentValue - mean) / stdDev;
}

/**
 * Calculates sleep debt in hours
 * 
 * @param currentSleepSeconds - Current sleep duration in seconds
 * @param historicalSleepSeconds - Array of historical sleep durations (in seconds) for rolling window
 * @returns Sleep debt in hours (negative if sleep surplus)
 */
export function calculateSleepDebt(
  currentSleepSeconds: number | null,
  historicalSleepSeconds: number[]
): number | null {
  if (currentSleepSeconds === null || currentSleepSeconds === undefined) {
    return null;
  }
  
  if (historicalSleepSeconds.length === 0) {
    return null;
  }
  
  // Filter out null/undefined values and convert to hours
  const validSleepHours = historicalSleepSeconds
    .filter(s => s !== null && s !== undefined && !isNaN(s))
    .map(s => s / 3600); // Convert seconds to hours
  
  if (validSleepHours.length === 0) {
    return null;
  }
  
  const averageSleepHours = calculateMean(validSleepHours);
  const currentSleepHours = currentSleepSeconds / 3600;
  
  // Sleep debt = average - current (positive = debt, negative = surplus)
  return averageSleepHours - currentSleepHours;
}

/**
 * Interface for Z-score calculation context
 */
export interface ZScoreContext {
  hrv: {
    current: number | null;
    historical: number[]; // Last 42 days
  };
  sleep: {
    currentSeconds: number | null;
    historicalSeconds: number[]; // Last 42 days
  };
}

/**
 * Calculates Z-scores and sleep debt from context
 */
export function calculateZScoreMetrics(context: ZScoreContext): {
  hrvZScore: number | null;
  sleepDebtHours: number | null;
} {
  const hrvZScore = calculateZScore(context.hrv.current, context.hrv.historical);
  const sleepDebtHours = calculateSleepDebt(context.sleep.currentSeconds, context.sleep.historicalSeconds);
  
  return {
    hrvZScore,
    sleepDebtHours
  };
}
