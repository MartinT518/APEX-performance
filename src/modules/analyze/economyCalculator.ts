/**
 * Economy Calculator
 * 
 * Computes economy proxies from activity data:
 * - speed_per_watt: Running efficiency (higher = more efficient)
 * - stride_length_per_hr: Stride efficiency relative to heart rate
 * - vertical_ratio: Vertical oscillation / stride length (already in data, but calculated here for consistency)
 */

export interface EconomyMetrics {
  speed_per_watt: number | null; // m/s per Watt (higher = more efficient)
  stride_length_per_hr: number | null; // cm per BPM (higher = more efficient)
  vertical_ratio: number | null; // Vertical oscillation / stride length (lower = more efficient)
}

/**
 * Calculates speed per watt (running economy metric)
 * 
 * Higher values indicate better running economy (more speed for same power output)
 * 
 * @param averageSpeed - Average speed in m/s
 * @param averagePower - Average power in Watts
 * @returns Speed per watt (m/s per W), or null if insufficient data
 */
export function calculateSpeedPerWatt(
  averageSpeed: number | null,
  averagePower: number | null
): number | null {
  if (averageSpeed === null || averagePower === null) {
    return null;
  }
  
  if (averagePower <= 0) {
    return null; // Invalid power value
  }
  
  return averageSpeed / averagePower;
}

/**
 * Calculates stride length per heart rate (efficiency metric)
 * 
 * Higher values indicate better efficiency (longer stride for same heart rate)
 * 
 * @param strideLength - Stride length in cm
 * @param averageHR - Average heart rate in BPM
 * @returns Stride length per HR (cm per BPM), or null if insufficient data
 */
export function calculateStrideLengthPerHR(
  strideLength: number | null,
  averageHR: number | null
): number | null {
  if (strideLength === null || averageHR === null) {
    return null;
  }
  
  if (averageHR <= 0) {
    return null; // Invalid HR value
  }
  
  return strideLength / averageHR;
}

/**
 * Calculates vertical ratio (form efficiency metric)
 * 
 * Lower values indicate better form (less vertical oscillation for same stride length)
 * 
 * @param verticalOscillation - Vertical oscillation in cm
 * @param strideLength - Stride length in cm
 * @returns Vertical ratio (%), or null if insufficient data
 */
export function calculateVerticalRatio(
  verticalOscillation: number | null,
  strideLength: number | null
): number | null {
  if (verticalOscillation === null || strideLength === null) {
    return null;
  }
  
  if (strideLength <= 0) {
    return null; // Invalid stride length
  }
  
  return (verticalOscillation / strideLength) * 100; // Convert to percentage
}

/**
 * Calculates all economy metrics from activity data
 * 
 * @param activityData - Activity data with speed, power, stride, HR, vertical oscillation
 * @returns Economy metrics object
 */
export function calculateEconomyMetrics(activityData: {
  averageSpeed?: number | null; // m/s
  averagePower?: number | null; // Watts
  strideLength?: number | null; // cm
  averageHR?: number | null; // BPM
  verticalOscillation?: number | null; // cm
}): EconomyMetrics {
  return {
    speed_per_watt: calculateSpeedPerWatt(activityData.averageSpeed ?? null, activityData.averagePower ?? null),
    stride_length_per_hr: calculateStrideLengthPerHR(activityData.strideLength ?? null, activityData.averageHR ?? null),
    vertical_ratio: calculateVerticalRatio(activityData.verticalOscillation ?? null, activityData.strideLength ?? null)
  };
}

/**
 * Extracts economy metrics from session metadata
 * 
 * @param metadata - Session metadata JSONB from database
 * @returns Economy metrics
 */
export function extractEconomyFromMetadata(metadata: any): EconomyMetrics {
  // Extract values from metadata
  const averageSpeed = metadata?.averageSpeed || metadata?.avgSpeed || null;
  const averagePower = metadata?.averagePower || metadata?.power || null;
  const strideLength = metadata?.strideLength || null;
  const averageHR = metadata?.averageHR || metadata?.avgHR || null;
  const verticalOscillation = metadata?.verticalOscillation || null;
  
  // Convert pace to speed if needed
  let speed: number | null = averageSpeed;
  if (!speed && metadata?.averagePace) {
    // averagePace is in seconds per km
    const paceSeconds = Number(metadata.averagePace);
    if (paceSeconds > 0) {
      speed = 1000 / paceSeconds; // Convert to m/s
    }
  }
  
  return calculateEconomyMetrics({
    averageSpeed: speed,
    averagePower: averagePower ? Number(averagePower) : null,
    strideLength: strideLength ? Number(strideLength) : null,
    averageHR: averageHR ? Number(averageHR) : null,
    verticalOscillation: verticalOscillation ? Number(verticalOscillation) : null
  });
}
