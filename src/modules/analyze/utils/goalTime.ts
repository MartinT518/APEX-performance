/**
 * Goal Time Utilities
 * 
 * Converts goal marathon time (HH:MM:SS format) to numeric metrics
 * and provides helper functions for goal-based calculations
 */

/**
 * Parses goal time string (HH:MM:SS) to total seconds
 */
export function parseGoalTime(goalTime: string): number {
  const parts = goalTime.split(':').map(Number);
  if (parts.length !== 3) {
    throw new Error(`Invalid goal time format: ${goalTime}. Expected HH:MM:SS`);
  }
  const [hours, minutes, seconds] = parts;
  return (hours * 3600) + (minutes * 60) + seconds;
}

/**
 * Converts goal time to a numeric metric for calculations
 * Uses a scale where 2:30:00 = 150 (arbitrary but consistent)
 */
export function goalTimeToMetric(goalTime: string): number {
  const totalSeconds = parseGoalTime(goalTime);
  const twoThirtySeconds = (2 * 3600) + (30 * 60); // 2:30:00 in seconds
  // Scale: 2:30:00 = 150, linear scaling
  return (twoThirtySeconds / totalSeconds) * 150;
}

/**
 * Gets required weekly volume based on goal time
 * 2:30:00 goal requires ~140km/week
 * 2:20:00 goal requires higher volume
 */
export function getRequiredWeeklyVolume(goalTime: string): number {
  const totalSeconds = parseGoalTime(goalTime);
  const twoThirtySeconds = (2 * 3600) + (30 * 60); // 2:30:00 in seconds (9000 seconds)
  
  // Base: 2:30:00 = 140km/week
  const baseVolume = 140;
  
  // Scale: faster goal = higher volume requirement
  // Linear scaling: 2:20:00 (8400s) needs ~160km/week
  // Ratio: 9000/8400 = 1.071, so 140 * 1.071 ≈ 150km/week
  const ratio = twoThirtySeconds / totalSeconds;
  return Math.round(baseVolume * ratio);
}

/**
 * Formats goal time for display (e.g., "Sub-2:30" or "Sub-2:20")
 */
export function formatGoalTimeDisplay(goalTime: string): string {
  const [hours, minutes] = goalTime.split(':').map(Number);
  return `Sub-${hours}:${minutes.toString().padStart(2, '0')}`;
}
