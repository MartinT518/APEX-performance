import { IPhenotypeProfile } from '@/types/phenotype';

/**
 * Validates if a Heart Rate is plausibly within physiological limits.
 * Default max for humans is roughly 220, but we allow up to 240 for extreme outliers.
 */
export const isValidHeartRate = (hr: number): boolean => {
  return hr > 30 && hr < 240;
};

/**
 * Checks if a user qualifies as a "High-Rev" phenotype based on configuration.
 * A High-Rev athlete typically has a Max HR > 200 OR a Threshold > 175.
 */
export const isHighRevPhenotype = (profile: IPhenotypeProfile): boolean => {
  if (profile.is_high_rev) return true; // Explicit override
  
  const { max_hr_override, threshold_hr_known } = profile.config;
  
  const highMax = max_hr_override > 200;
  const highThreshold = threshold_hr_known ? threshold_hr_known > 175 : false;
  
  return highMax || highThreshold;
};

/**
 * Determines if an incoming HR reading should trigger an "Anaerobic Alert".
 * For High-Rev athletes, we suppress alerts below their Anaerobic Floor (often ~190bpm),
 * whereas standard algorithms might flag anything > 170bpm.
 */
export const shouldTriggerAnaerobicAlert = (
  currentHr: number, 
  profile: IPhenotypeProfile
): boolean => {
  const { anaerobic_floor_hr } = profile.config;
  const isHighRev = isHighRevPhenotype(profile);
  
  // Standard logic: Alert if > 170 (Generic placeholder)
  const STANDARD_ALERT_THRESHOLD = 170;
  
  if (isHighRev) {
    // Only alert if we exceed the athlete's specific floor
    return currentHr > anaerobic_floor_hr;
  }
  
  // Default logic for normal physiology
  return currentHr > STANDARD_ALERT_THRESHOLD;
};
