/**
 * Data Normalizer
 * 
 * Converts all activities to canonical units (m/s, Watts, BPM) as specified in the roadmap.
 * Provides source weighting based on data quality (Wrist HR vs. Chest Strap).
 */

/**
 * Canonical Units:
 * - Speed: m/s (meters per second)
 * - Power: Watts
 * - Heart Rate: BPM (beats per minute)
 * - Cadence: spm (steps per minute)
 * - Distance: meters
 */

export interface NormalizedActivityData {
  speed: number | null; // m/s
  power: number | null; // Watts
  heartRate: number | null; // BPM
  cadence: number | null; // spm
  distance: number | null; // meters
  sourceQuality: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Source quality weighting based on HR source
 * Higher quality = more reliable data for analysis
 */
export function getSourceQuality(hrSource: 'WRIST_HR' | 'CHEST_STRAP' | 'UNKNOWN' | null): 'HIGH' | 'MEDIUM' | 'LOW' {
  switch (hrSource) {
    case 'CHEST_STRAP':
      return 'HIGH'; // Chest strap is most accurate
    case 'WRIST_HR':
      return 'MEDIUM'; // Optical wrist HR is less accurate
    case 'UNKNOWN':
    case null:
      return 'LOW'; // Unknown source, lower confidence
    default:
      return 'LOW';
  }
}

/**
 * Converts pace (minutes per km) to speed (m/s)
 * 
 * @param paceMinutesPerKm - Pace in minutes per kilometer (e.g., 5.0 for 5:00/km)
 * @returns Speed in m/s
 */
export function paceToSpeed(paceMinutesPerKm: number | null): number | null {
  if (paceMinutesPerKm === null || paceMinutesPerKm === 0) {
    return null;
  }
  // Convert minutes/km to seconds/km, then to m/s
  const secondsPerKm = paceMinutesPerKm * 60;
  return 1000 / secondsPerKm; // m/s
}

/**
 * Converts pace string (e.g., "5:00/km") to speed (m/s)
 * 
 * @param paceString - Pace string in format "MM:SS/km" or "M:SS/km"
 * @returns Speed in m/s, or null if parsing fails
 */
export function paceStringToSpeed(paceString: string | null | undefined): number | null {
  if (!paceString) return null;
  
  // Parse "5:00/km" format
  const match = paceString.match(/(\d+):(\d+)\/km/);
  if (!match) return null;
  
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const totalSeconds = minutes * 60 + seconds;
  
  return 1000 / totalSeconds; // m/s
}

/**
 * Normalizes power to Watts
 * Power is already typically in Watts from Garmin, but this ensures consistency
 * 
 * @param power - Power value (assumed to be in Watts)
 * @returns Power in Watts
 */
export function normalizePower(power: number | null): number | null {
  // Garmin typically provides power in Watts already
  // If needed, can add conversion logic here (e.g., from kilowatts)
  return power;
}

/**
 * Normalizes heart rate to BPM
 * Heart rate is already in BPM, but this ensures consistency
 * 
 * @param heartRate - Heart rate value (assumed to be in BPM)
 * @returns Heart rate in BPM
 */
export function normalizeHeartRate(heartRate: number | null): number | null {
  // Heart rate is already in BPM
  // Validate range (typically 30-220 BPM for humans)
  if (heartRate === null) return null;
  if (heartRate < 30 || heartRate > 220) {
    return null; // Invalid range
  }
  return heartRate;
}

/**
 * Normalizes cadence to spm (steps per minute)
 * Cadence is already typically in spm, but this ensures consistency
 * 
 * @param cadence - Cadence value (assumed to be in spm)
 * @returns Cadence in spm
 */
export function normalizeCadence(cadence: number | null): number | null {
  // Cadence is already in spm
  // Validate range (typically 120-220 spm for running)
  if (cadence === null) return null;
  if (cadence < 60 || cadence > 250) {
    return null; // Invalid range
  }
  return cadence;
}

/**
 * Normalizes distance to meters
 * 
 * @param distanceKm - Distance in kilometers
 * @returns Distance in meters
 */
export function normalizeDistance(distanceKm: number | null): number | null {
  if (distanceKm === null) return null;
  return distanceKm * 1000; // Convert km to meters
}

/**
 * Normalizes activity data to canonical units
 * 
 * @param rawData - Raw activity data from Garmin or other sources
 * @param hrSource - Heart rate source for quality weighting
 * @returns Normalized activity data
 */
export function normalizeActivityData(
  rawData: {
    pace?: number | string | null; // minutes/km or "MM:SS/km"
    power?: number | null; // Watts
    heartRate?: number | null; // BPM
    cadence?: number | null; // spm
    distanceKm?: number | null; // km
  },
  hrSource: 'WRIST_HR' | 'CHEST_STRAP' | 'UNKNOWN' | null = null
): NormalizedActivityData {
  // Convert pace to speed
  let speed: number | null = null;
  if (typeof rawData.pace === 'number') {
    speed = paceToSpeed(rawData.pace);
  } else if (typeof rawData.pace === 'string') {
    speed = paceStringToSpeed(rawData.pace);
  }
  
  return {
    speed,
    power: normalizePower(rawData.power ?? null),
    heartRate: normalizeHeartRate(rawData.heartRate ?? null),
    cadence: normalizeCadence(rawData.cadence ?? null),
    distance: normalizeDistance(rawData.distanceKm ?? null),
    sourceQuality: getSourceQuality(hrSource)
  };
}
