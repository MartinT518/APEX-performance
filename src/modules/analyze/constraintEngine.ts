/**
 * Constraint Engine
 * 
 * Enforces deterministic constraints on training plan generation:
 * - Max ramp rate (volume increase per week)
 * - Intensity spacing (48h between hard sessions)
 * - Phase caps (maximum volume/intensity per phase)
 * 
 * Roadmap requirement: "Generator never prescribes two 'Extreme Load' sessions back-to-back"
 */

import type { IWorkout } from '@/types/workout';
import { getCurrentPhase, type PhaseDefinition } from './blueprintEngine';
import { logger } from '@/lib/logger';

export interface ConstraintViolation {
  type: 'RAMP_RATE' | 'INTENSITY_SPACING' | 'PHASE_CAP' | 'EXTREME_LOAD_BACK_TO_BACK';
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ConstraintCheckResult {
  valid: boolean;
  violations: ConstraintViolation[];
}

/**
 * Calculates ramp rate (volume increase per week)
 * 
 * @param volumeHistory - Array of weekly volumes (km) for last N weeks
 * @returns Ramp rate (percentage increase), or null if insufficient data
 */
export function calculateRampRate(volumeHistory: number[]): number | null {
  if (volumeHistory.length < 2) {
    return null; // Need at least 2 weeks
  }
  
  const lastWeek = volumeHistory[volumeHistory.length - 1];
  const prevWeek = volumeHistory[volumeHistory.length - 2];
  
  if (prevWeek === 0) {
    return null; // Can't calculate from zero
  }
  
  return ((lastWeek - prevWeek) / prevWeek) * 100; // Percentage increase
}

/**
 * Checks if ramp rate exceeds maximum allowed
 * 
 * @param volumeHistory - Array of weekly volumes
 * @param maxRampRatePercent - Maximum allowed ramp rate (default: 10%)
 * @returns true if ramp rate is acceptable
 */
export function checkRampRate(
  volumeHistory: number[],
  maxRampRatePercent: number = 10
): { valid: boolean; rampRate: number | null; message: string } {
  const rampRate = calculateRampRate(volumeHistory);
  
  if (rampRate === null) {
    return { valid: true, rampRate: null, message: 'Insufficient data for ramp rate check' };
  }
  
  if (rampRate > maxRampRatePercent) {
    return {
      valid: false,
      rampRate,
      message: `Ramp rate (${rampRate.toFixed(1)}%) exceeds maximum (${maxRampRatePercent}%)`
    };
  }
  
  return { valid: true, rampRate, message: `Ramp rate (${rampRate.toFixed(1)}%) is acceptable` };
}

/**
 * Checks intensity spacing (48h between hard sessions)
 * 
 * Hard sessions = Z4_THRESHOLD or Z5_VO2MAX
 * 
 * @param workouts - Array of workouts (ordered by date)
 * @param minSpacingHours - Minimum spacing in hours (default: 48)
 * @returns Array of violations
 */
export function checkIntensitySpacing(
  workouts: IWorkout[],
  minSpacingHours: number = 48
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  
  const hardZones = ['Z4_THRESHOLD', 'Z5_VO2MAX'];
  
  for (let i = 0; i < workouts.length - 1; i++) {
    const current = workouts[i];
    const next = workouts[i + 1];
    
    const currentIsHard = hardZones.includes(current.primaryZone);
    const nextIsHard = hardZones.includes(next.primaryZone);
    
    if (currentIsHard && nextIsHard) {
      // Check spacing between hard sessions
      const currentDate = new Date(current.date || new Date());
      const nextDate = new Date(next.date || new Date());
      const hoursDiff = (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < minSpacingHours) {
        violations.push({
          type: 'INTENSITY_SPACING',
          message: `Hard sessions too close: ${hoursDiff.toFixed(1)}h apart (minimum ${minSpacingHours}h required)`,
          severity: 'ERROR'
        });
      }
    }
  }
  
  return violations;
}

/**
 * Checks if two "Extreme Load" sessions are back-to-back
 * 
 * Extreme Load = Long runs (>2h) OR High intensity (Z5_VO2MAX) OR High volume (>25km)
 * 
 * @param workouts - Array of workouts (ordered by date)
 * @returns Array of violations
 */
export function checkExtremeLoadBackToBack(workouts: IWorkout[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  
  const isExtremeLoad = (workout: IWorkout): boolean => {
    // Long duration (>2h = 120min)
    if (workout.durationMinutes && workout.durationMinutes > 120) {
      return true;
    }
    
    // High intensity (Z5_VO2MAX)
    if (workout.primaryZone === 'Z5_VO2MAX') {
      return true;
    }
    
    // High volume (>25km)
    if (workout.distanceKm && workout.distanceKm > 25) {
      return true;
    }
    
    return false;
  };
  
  for (let i = 0; i < workouts.length - 1; i++) {
    const current = workouts[i];
    const next = workouts[i + 1];
    
    if (isExtremeLoad(current) && isExtremeLoad(next)) {
      violations.push({
        type: 'EXTREME_LOAD_BACK_TO_BACK',
        message: 'Two extreme load sessions scheduled back-to-back',
        severity: 'ERROR'
      });
    }
  }
  
  return violations;
}

/**
 * Enforces phase caps (maximum volume/intensity per phase)
 * 
 * @param workouts - Array of workouts
 * @param phase - Current phase definition
 * @returns Array of violations
 */
export function enforcePhaseCaps(
  workouts: IWorkout[],
  phase: PhaseDefinition
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  
  // Calculate total weekly volume
  const weeklyVolume = workouts
    .filter(w => w.type === 'RUN')
    .reduce((sum, w) => sum + (w.distanceKm || 0), 0);
  
  // Check volume cap
  if (weeklyVolume > phase.maxWeeklyVolume) {
    violations.push({
      type: 'PHASE_CAP',
      message: `Weekly volume (${weeklyVolume.toFixed(1)}km) exceeds phase cap (${phase.maxWeeklyVolume}km)`,
      severity: 'ERROR'
    });
  }
  
  // Check intensity zones
  const hasForbiddenZone = workouts.some(w => {
    // Check if workout uses a zone not allowed in current phase
    const allowedZones = ['Z1_RECOVERY', 'Z2_AEROBIC', 'Z3_TEMPO'];
    if (phase.phaseNumber === 1) {
      // Base phase: only Z1, Z2, Z3 allowed
      return !allowedZones.includes(w.primaryZone);
    }
    // Other phases may allow Z4, Z5
    return false;
  });
  
  if (hasForbiddenZone && phase.phaseNumber === 1) {
    violations.push({
      type: 'PHASE_CAP',
      message: 'Workout uses intensity zone not allowed in Base Phase',
      severity: 'ERROR'
    });
  }
  
  return violations;
}

/**
 * Validates a workout plan against all constraints
 * 
 * @param workouts - Array of workouts to validate
 * @param volumeHistory - Historical weekly volumes for ramp rate check
 * @param phase - Current phase (optional, will be determined if not provided)
 * @returns Constraint check result
 */
export function validateConstraints(
  workouts: IWorkout[],
  volumeHistory: number[] = [],
  phase?: PhaseDefinition
): ConstraintCheckResult {
  const violations: ConstraintViolation[] = [];
  
  // Determine phase if not provided
  const currentPhase = phase || getCurrentPhase(new Date());
  
  // Check ramp rate
  if (volumeHistory.length >= 2) {
    const rampCheck = checkRampRate(volumeHistory);
    if (!rampCheck.valid) {
      violations.push({
        type: 'RAMP_RATE',
        message: rampCheck.message,
        severity: 'ERROR'
      });
    }
  }
  
  // Check intensity spacing
  violations.push(...checkIntensitySpacing(workouts));
  
  // Check extreme load back-to-back
  violations.push(...checkExtremeLoadBackToBack(workouts));
  
  // Check phase caps
  violations.push(...enforcePhaseCaps(workouts, currentPhase));
  
  return {
    valid: violations.length === 0,
    violations
  };
}

/**
 * Applies constraints to a workout plan (modifies workouts to satisfy constraints)
 * 
 * @param workouts - Array of workouts (may be modified)
 * @param volumeHistory - Historical weekly volumes
 * @param phase - Current phase
 * @returns Modified workouts and list of modifications made
 */
export function applyConstraints(
  workouts: IWorkout[],
  volumeHistory: number[] = [],
  phase?: PhaseDefinition
): { workouts: IWorkout[]; modifications: string[] } {
  const modifications: string[] = [];
  const currentPhase = phase || getCurrentPhase(new Date());
  
  // Check and fix intensity spacing
  const spacingViolations = checkIntensitySpacing(workouts);
  if (spacingViolations.length > 0) {
    // Downgrade second hard session to Z3
    for (let i = 0; i < workouts.length - 1; i++) {
      const current = workouts[i];
      const next = workouts[i + 1];
      
      if (['Z4_THRESHOLD', 'Z5_VO2MAX'].includes(current.primaryZone) &&
          ['Z4_THRESHOLD', 'Z5_VO2MAX'].includes(next.primaryZone)) {
        const currentDate = new Date(current.date || new Date());
        const nextDate = new Date(next.date || new Date());
        const hoursDiff = (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 48) {
          next.primaryZone = 'Z3_TEMPO';
          modifications.push(`Downgraded workout on ${next.date} from ${next.primaryZone} to Z3_TEMPO (intensity spacing)`);
        }
      }
    }
  }
  
  // Check and fix extreme load back-to-back
  const extremeLoadViolations = checkExtremeLoadBackToBack(workouts);
  if (extremeLoadViolations.length > 0) {
    // Reduce second session load
    for (let i = 0; i < workouts.length - 1; i++) {
      const current = workouts[i];
      const next = workouts[i + 1];
      
      const isCurrentExtreme = (current.durationMinutes && current.durationMinutes > 120) ||
                               current.primaryZone === 'Z5_VO2MAX' ||
                               (current.distanceKm && current.distanceKm > 25);
      
      const isNextExtreme = (next.durationMinutes && next.durationMinutes > 120) ||
                           next.primaryZone === 'Z5_VO2MAX' ||
                           (next.distanceKm && next.distanceKm > 25);
      
      if (isCurrentExtreme && isNextExtreme) {
        // Reduce next session
        if (next.durationMinutes && next.durationMinutes > 120) {
          next.durationMinutes = 90; // Cap at 90min
          modifications.push(`Reduced duration on ${next.date} to 90min (extreme load spacing)`);
        }
        if (next.distanceKm && next.distanceKm > 25) {
          next.distanceKm = 20; // Cap at 20km
          modifications.push(`Reduced distance on ${next.date} to 20km (extreme load spacing)`);
        }
      }
    }
  }
  
  // Check and fix phase caps
  const weeklyVolume = workouts
    .filter(w => w.type === 'RUN')
    .reduce((sum, w) => sum + (w.distanceKm || 0), 0);
  
  if (weeklyVolume > currentPhase.maxWeeklyVolume) {
    // Proportionally reduce all run distances
    const reductionFactor = currentPhase.maxWeeklyVolume / weeklyVolume;
    workouts.forEach(w => {
      if (w.type === 'RUN' && w.distanceKm) {
        w.distanceKm = w.distanceKm * reductionFactor;
      }
    });
    modifications.push(`Reduced weekly volume from ${weeklyVolume.toFixed(1)}km to ${currentPhase.maxWeeklyVolume}km (phase cap)`);
  }
  
  return { workouts, modifications };
}
