import type { IWorkout } from '@/types/workout';

export interface AdherenceScore {
  score: number; // 0-100
  reason: string;
  penaltyApplied: boolean;
}

/**
 * Module C: The Smart Adherence Calculator
 */
export class SmartAdherence {
  /**
   * Calculate adherence based on intelligence, not just completion.
   */
  static calculateSmartScore(
    planned: IWorkout,
    actualZone: string,
    isMissed: boolean,
    isValidSubstitution: boolean,
    phaseNumber: number
  ): AdherenceScore {
    // 1. Lazy Miss
    if (isMissed && !isValidSubstitution) {
      return { score: 0, reason: 'Session missed (Lazy Miss).', penaltyApplied: false };
    }

    // 2. Valid Substitution (listening to a Structural Veto)
    if (isValidSubstitution) {
      return { score: 100, reason: 'Valid substitution performed. Strategic compliance rewarded.', penaltyApplied: false };
    }

    // 3. Trash Zone Violation (Running Z3/Z4 in a Z2 phase)
    if (phaseNumber === 1 && (actualZone === 'Z3_TEMPO' || actualZone === 'Z4_THRESHOLD')) {
      return { 
        score: -50, 
        reason: 'Trash Zone Violation: Intensity in Base Phase causes metabolic interference.', 
        penaltyApplied: true 
      };
    }

    // 4. Exact Match or acceptable Z2 adherence
    if (actualZone === planned.primaryZone) {
      return { score: 100, reason: 'Perfect execution match.', penaltyApplied: false };
    }

    // Default: partial credit or neutral
    return { score: 75, reason: 'Session completed with deviations.', penaltyApplied: false };
  }
}
