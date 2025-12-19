import { IPhenotypeProfile } from '@/types/phenotype';
import { ISessionDataPoint, IFilterDiagnostics } from '@/types/session';
import { shouldTriggerAnaerobicAlert } from '@/modules/monitor/logic/validation';

/**
 * FR-K1: The High-Rev Filter
 * 
 * Purpose: Differentiate between "Noise" (Sensor Spike) and "Signal" (High-Rev Physiology).
 * 
 * Algorithm:
 * 1. Checks HR against Age Predicted Max.
 * 2. If HR > Age Max, check `is_high_rev` phenotype.
 * 3. If NOT High-Rev -> MARK SUSPECT.
 * 4. If High-Rev -> MARK VALID (up to Max HR Override).
 */
export const validateHighRevPhysiology = (
  points: ISessionDataPoint[],
  profile: IPhenotypeProfile
): IFilterDiagnostics => {
  const flaggedIndices: number[] = [];
  const { max_hr_override } = profile.config;
  const isHighRev = profile.is_high_rev;

  // Calculate age-predicted max HR: 220 - age
  // If age is not provided, use standard physiological ceiling
  let agePredictedMaxHR: number;
  if (profile.age && profile.age > 0) {
    agePredictedMaxHR = 220 - profile.age;
  } else {
    // Default to standard physiological ceiling if age not available
    agePredictedMaxHR = 195;
  }
  
  // For high-rev users, use max_hr_override if set, otherwise use age-predicted max
  // For non-high-rev users, use age-predicted max (or standard ceiling if age not available)
  const physiologicalCeiling = isHighRev && max_hr_override 
    ? max_hr_override 
    : agePredictedMaxHR; 

  points.forEach((point, index) => {
    // 1. Absolute Ceiling Check (e.g. > 240 is likely noise for anyone)
    if (!point.heartRate) {
        return; // Skip missing data
    }

    if (point.heartRate > 240) {
      flaggedIndices.push(index);
      return;
    }

    // 2. High-Rev Logic - Check against age-predicted max or override
    if (point.heartRate > physiologicalCeiling) {
      if (!isHighRev) {
        // Normal physiology shouldn't exceed age-predicted max -> Suspect
        flaggedIndices.push(index);
      } else {
        // High-Rev Phenotype ALLOWS higher HR, but check specific override
        // CRITICAL: Allow HR up to max_hr_override + 5 (e.g., 185bpm for high-rev user)
        // If max_hr_override is set, use it + 5 as absolute ceiling
        // Otherwise, allow up to age-predicted max + 10bpm tolerance
        const highRevCeiling = max_hr_override ? (max_hr_override + 5) : (agePredictedMaxHR + 10);
        if (point.heartRate > highRevCeiling) {
          flaggedIndices.push(index);
        }
      }
    }
  });

  const validCount = points.length - flaggedIndices.length;
  // If > 20% of data is flagged, mark the whole session as SUSPECT
  const isSuspectSession = (flaggedIndices.length / points.length) > 0.2;

  return {
    status: isSuspectSession ? 'SUSPECT' : 'VALID',
    reason: isSuspectSession ? 'Excessive supra-physiological readings' : undefined,
    flaggedIndices,
    originalPointCount: points.length,
    validPointCount: validCount
  };
};
