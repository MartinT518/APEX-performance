/**
 * Durability Calculator
 * 
 * Computes durability proxies from activity data:
 * - decoupling: HR drift (first half vs. second half)
 * - cadence_drift: Cadence decline over time
 * - form_decay: Ground contact time increase (form degradation)
 */

import type { ISessionDataPoint } from '@/types/session';

export interface DurabilityMetrics {
  decoupling: number | null; // HR drift ratio (positive = HR increased in second half)
  cadence_drift: number | null; // Cadence decline ratio (negative = cadence decreased)
  form_decay: number | null; // GCT increase ratio (positive = GCT increased, form degraded)
}

/**
 * Calculates aerobic decoupling (HR drift)
 * 
 * Formula: (second_half_avg_hr / first_half_avg_hr) - 1
 * Positive values indicate HR increased in second half (decoupling)
 * 
 * @param points - Session data points with heart rate
 * @returns Decoupling ratio, or null if insufficient data
 */
export function calculateDecoupling(points: ISessionDataPoint[]): number | null {
  if (!points || points.length < 10) {
    return null; // Need at least 10 points
  }
  
  // Filter points with valid HR
  const validPoints = points.filter(p => p.heartRate !== null && p.heartRate !== undefined);
  if (validPoints.length < 10) {
    return null;
  }
  
  // Split into first and second half
  const midpoint = Math.floor(validPoints.length / 2);
  const firstHalf = validPoints.slice(0, midpoint);
  const secondHalf = validPoints.slice(midpoint);
  
  if (firstHalf.length === 0 || secondHalf.length === 0) {
    return null;
  }
  
  // Calculate average HR for each half
  const firstHalfAvg = firstHalf.reduce((sum, p) => sum + (p.heartRate || 0), 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, p) => sum + (p.heartRate || 0), 0) / secondHalf.length;
  
  if (firstHalfAvg <= 0) {
    return null;
  }
  
  return (secondHalfAvg / firstHalfAvg) - 1;
}

/**
 * Calculates cadence drift (cadence decline over time)
 * 
 * Formula: (final_cadence - initial_cadence) / initial_cadence
 * Negative values indicate cadence decreased (drift)
 * 
 * @param points - Session data points with cadence
 * @returns Cadence drift ratio, or null if insufficient data
 */
export function calculateCadenceDrift(points: ISessionDataPoint[]): number | null {
  if (!points || points.length < 10) {
    return null;
  }
  
  // Filter points with valid cadence
  const validPoints = points.filter(p => p.cadence !== null && p.cadence !== undefined);
  if (validPoints.length < 10) {
    return null;
  }
  
  // Get initial and final cadence (average of first/last 10% of points)
  const initialWindow = Math.max(1, Math.floor(validPoints.length * 0.1));
  const finalWindow = Math.max(1, Math.floor(validPoints.length * 0.1));
  
  const initialPoints = validPoints.slice(0, initialWindow);
  const finalPoints = validPoints.slice(-finalWindow);
  
  const initialCadence = initialPoints.reduce((sum, p) => sum + (p.cadence || 0), 0) / initialPoints.length;
  const finalCadence = finalPoints.reduce((sum, p) => sum + (p.cadence || 0), 0) / finalPoints.length;
  
  if (initialCadence <= 0) {
    return null;
  }
  
  return (finalCadence - initialCadence) / initialCadence;
}

/**
 * Calculates form decay (ground contact time increase)
 * 
 * Formula: (final_gct - initial_gct) / initial_gct
 * Positive values indicate GCT increased (form degraded)
 * 
 * Note: This requires GCT data in session points, which may not always be available.
 * Falls back to metadata if available.
 * 
 * @param points - Session data points (may not have GCT)
 * @param metadata - Session metadata with GCT values
 * @returns Form decay ratio, or null if insufficient data
 */
export function calculateFormDecay(
  points: ISessionDataPoint[],
  metadata?: any
): number | null {
  // Try to get GCT from metadata first (more reliable)
  if (metadata?.groundContactTime) {
    // If we only have a single GCT value, can't calculate decay
    // This would require time-series GCT data
    return null;
  }
  
  // Try to extract from points if they have GCT
  // Note: ISessionDataPoint may not have GCT field, so this is a fallback
  const pointsWithGCT = points.filter((p: any) => p.groundContactTime !== null && p.groundContactTime !== undefined);
  
  if (pointsWithGCT.length < 10) {
    return null;
  }
  
  // Get initial and final GCT (average of first/last 10% of points)
  const initialWindow = Math.max(1, Math.floor(pointsWithGCT.length * 0.1));
  const finalWindow = Math.max(1, Math.floor(pointsWithGCT.length * 0.1));
  
  const initialPoints = pointsWithGCT.slice(0, initialWindow);
  const finalPoints = pointsWithGCT.slice(-finalWindow);
  
  const initialGCT = initialPoints.reduce((sum, p: any) => sum + (p.groundContactTime || 0), 0) / initialPoints.length;
  const finalGCT = finalPoints.reduce((sum, p: any) => sum + (p.groundContactTime || 0), 0) / finalPoints.length;
  
  if (initialGCT <= 0) {
    return null;
  }
  
  return (finalGCT - initialGCT) / initialGCT;
}

/**
 * Calculates all durability metrics from session data
 * 
 * @param points - Session data points
 * @param metadata - Session metadata (optional, for GCT if not in points)
 * @returns Durability metrics object
 */
export function calculateDurabilityMetrics(
  points: ISessionDataPoint[],
  metadata?: any
): DurabilityMetrics {
  return {
    decoupling: calculateDecoupling(points),
    cadence_drift: calculateCadenceDrift(points),
    form_decay: calculateFormDecay(points, metadata)
  };
}

/**
 * Flags sessions with form decay before injury gaps
 * 
 * Roadmap requirement: "System flags historical sessions where form decayed (Durability loss) before an injury gap occurred"
 * 
 * @param durabilityMetrics - Durability metrics for a session
 * @param thresholds - Threshold values for flagging (optional, uses defaults)
 * @returns true if session should be flagged as high risk
 */
export function flagFormDecay(
  durabilityMetrics: DurabilityMetrics,
  thresholds: {
    decoupling?: number; // Default: >0.05 (5% HR increase)
    cadence_drift?: number; // Default: <-0.03 (3% cadence decrease)
    form_decay?: number; // Default: >0.10 (10% GCT increase)
  } = {}
): boolean {
  const decouplingThreshold = thresholds.decoupling ?? 0.05;
  const cadenceDriftThreshold = thresholds.cadence_drift ?? -0.03;
  const formDecayThreshold = thresholds.form_decay ?? 0.10;
  
  // Flag if any metric exceeds threshold
  if (durabilityMetrics.decoupling !== null && durabilityMetrics.decoupling > decouplingThreshold) {
    return true;
  }
  
  if (durabilityMetrics.cadence_drift !== null && durabilityMetrics.cadence_drift < cadenceDriftThreshold) {
    return true;
  }
  
  if (durabilityMetrics.form_decay !== null && durabilityMetrics.form_decay > formDecayThreshold) {
    return true;
  }
  
  return false;
}
