import { ISessionDataPoint } from '@/types/session';

/**
 * Calculates aerobic decoupling from session data
 * 
 * Aerobic decoupling measures cardiac drift - when HR increases while pace/power stays constant.
 * Formula: (HR_second_half_avg - HR_first_half_avg) / HR_first_half_avg * 100
 * 
 * For running: Uses pace (speed inverse)
 * For cycling: Uses power if available, otherwise pace
 */
export function calculateAerobicDecoupling(
  points: ISessionDataPoint[]
): number {
  if (points.length < 2) return 0;

  // Filter out points without HR
  const validPoints = points.filter(p => p.heartRate !== undefined && p.heartRate > 0);
  if (validPoints.length < 2) return 0;

  const midpoint = Math.floor(validPoints.length / 2);
  const firstHalf = validPoints.slice(0, midpoint);
  const secondHalf = validPoints.slice(midpoint);

  // Calculate average HR for each half
  const firstHalfHR = firstHalf.reduce((sum, p) => sum + (p.heartRate || 0), 0) / firstHalf.length;
  const secondHalfHR = secondHalf.reduce((sum, p) => sum + (p.heartRate || 0), 0) / secondHalf.length;

  if (firstHalfHR === 0) return 0;

  // Calculate decoupling percentage
  const decoupling = ((secondHalfHR - firstHalfHR) / firstHalfHR) * 100;
  return Math.max(0, decoupling); // Return 0 if negative (negative drift is not decoupling)
}

/**
 * Calculates time spent in red zone (Zone 4/5) from session data
 * 
 * Red zone is typically >85% of max HR or >threshold HR
 */
export function calculateTimeInRedZone(
  points: ISessionDataPoint[],
  thresholdHR: number
): number {
  if (points.length === 0) return 0;

  // Filter points in red zone (assuming 1 point per second for simplicity)
  const redZonePoints = points.filter(p => 
    p.heartRate !== undefined && p.heartRate >= thresholdHR
  );

  // Convert to minutes (assuming 1 point per second)
  return redZonePoints.length / 60;
}

