import type { IWorkout, IntensityZone } from '@/types/workout';
import { PhaseDefinition } from '@/types/workout';

export interface WeeklyStructure {
  days: Record<number, Partial<IWorkout>>; // 0-6 (Sunday-Saturday)
}

/**
 * Module A: The Prescriptive Scheduler (Weekly Logic)
 * 
 * Enforce the Blueprint as the primary driver.
 */
export class PrescriptiveScheduler {
  /**
   * Hard-schedule the Sunday Long Run and two Structural Anchors (Strength).
   */
  static getWeeklySkeleton(longRunDay: number = 0): Record<number, string> {
    // Default anchors: Sunday Long Run (0), Tuesday/Friday Strength (2, 5)
    return {
      [longRunDay]: 'LONG_RUN',
      2: 'STRENGTH_ANCHOR',
      5: 'STRENGTH_ANCHOR',
    };
  }

  /**
   * Apply Pivot Rule: If a Mandatory session is missed, skip the next high-intensity interval.
   */
  static resolveConflict(
    missedMandatory: boolean, 
    plannedWorkout: IWorkout
  ): Partial<IWorkout> {
    if (!missedMandatory) return plannedWorkout;

    // Rule: Skip high-intensity to prioritize aerobic volume recovery.
    if (['Z4_THRESHOLD', 'Z5_VO2MAX', 'Z3_TEMPO'].includes(plannedWorkout.primaryZone)) {
      return {
        ...plannedWorkout,
        primaryZone: 'Z2_ENDURANCE',
        structure: {
          ...plannedWorkout.structure,
          mainSet: 'Recovery Pivot: Converted from Intensity to Z2 due to missed mandatory anchor.',
        },
        notes: (plannedWorkout.notes || '') + ' [CONFLICT RESOLUTION: PIVOT TO AEROBIC]',
        isAdapted: true
      };
    }

    return plannedWorkout;
  }
}
