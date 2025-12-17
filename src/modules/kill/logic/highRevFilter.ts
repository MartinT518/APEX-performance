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

  // Age calculation is approximated here or fetched from profile if added later
  // For now, using a standard "Age Max" proxy of 190 for non-High-Rev filtering
  const STANDARD_PHYSIOLOGICAL_CEILING = 195; 

  points.forEach((point, index) => {
    // 1. Absolute Ceiling Check (e.g. > 240 is likely noise for anyone)
    if (!point.heartRate) {
        return; // Skip missing data
    }

    if (point.heartRate > 240) {
      flaggedIndices.push(index);
      return;
    }

    // 2. High-Rev Logic
    if (point.heartRate > STANDARD_PHYSIOLOGICAL_CEILING) {
      if (!isHighRev) {
        // Normal physiology shouldn't live here for long -> Suspect
        flaggedIndices.push(index);
      } else {
        // High-Rev Phenotype ALLOWS this, but check specific override
        if (point.heartRate > max_hr_override) {
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
