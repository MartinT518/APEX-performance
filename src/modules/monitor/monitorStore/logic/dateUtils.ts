/**
 * Gets today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Calculates days since last lift date
 */
export function getDaysSinceLastLift(lastLiftDate: string | null): number {
  if (!lastLiftDate) {
    // If never lifted, return a high number to trigger warnings
    return 999;
  }
  const today = new Date();
  const lastLift = new Date(lastLiftDate);
  const diffTime = today.getTime() - lastLift.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

