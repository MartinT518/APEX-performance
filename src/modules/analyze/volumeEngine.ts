/**
 * Module B: The Dynamic Volume Governor (Chassis scaling)
 * 
 * Volume is a privilege, not a right.
 */
export class VolumeGovernor {
  /**
   * Calculate Integrity Ratio (R): Rolling_Tonnage / Rolling_Mileage
   */
  static calculateIntegrityRatio(rollingTonnage: number, rollingMileage: number): number {
    if (rollingMileage === 0) return 1.0;
    return rollingTonnage / rollingMileage;
  }

  /**
   * Determine Volume Cap based on Integrity Ratio and Sleep.
   */
  static getVolumeCap(
    blueprintTargetKm: number,
    integrityRatio: number,
    sleepQualityPercent: number = 80
  ): { 
    capKm: number; 
    reasoning: string; 
    isEliteScaling: boolean;
    shouldTriggerDoubleDays: boolean;
  } {
    // 1. Elite Scaling: R > 1.2 and Sleep > 85%
    if (integrityRatio > 1.2 && sleepQualityPercent > 85) {
      const eliteCap = 220; // km/week
      const isElite = blueprintTargetKm > 160;
      return {
        capKm: Math.max(blueprintTargetKm, eliteCap),
        reasoning: 'Strong Chassis + Recovery detected. Elite scaling unlocked (up to 220km).',
        isEliteScaling: true,
        shouldTriggerDoubleDays: isElite
      };
    }

    // 2. Chassis Deficit: R < 0.8
    if (integrityRatio < 0.8) {
      const reducedCap = blueprintTargetKm * 0.8;
      return {
        capKm: reducedCap,
        reasoning: 'Chassis Deficit (Low Strength/Tonnage). Volume hard-capped at 80%.',
        isEliteScaling: false,
        shouldTriggerDoubleDays: false
      };
    }

    // 3. Normal Scaling
    return {
      capKm: blueprintTargetKm,
      reasoning: 'Chassis Integrity Nominal.',
      isEliteScaling: false,
      shouldTriggerDoubleDays: false
    };
  }
}
