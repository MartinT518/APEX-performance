export type WorkoutType = 
  | 'RUN' 
  | 'BIKE' 
  | 'SWIM' 
  | 'STRENGTH' 
  | 'REST' 
  | 'CROSS_TRAIN';

export type IntensityZone = 
  | 'Z1_RECOVERY' 
  | 'Z2_ENDURANCE' 
  | 'Z3_TEMPO' 
  | 'Z4_THRESHOLD' 
  | 'Z5_VO2MAX';

export interface IWorkoutStructure {
  warmup?: string; // e.g. "15min Z1"
  mainSet: string; // e.g. "3x10min Z4 w/ 2min rest"
  cooldown?: string; // e.g. "10min Z1"
}

export interface IWorkout {
  id: string;
  date: string; // ISO Date
  type: WorkoutType;
  primaryZone: IntensityZone;
  durationMinutes: number;
  structure: IWorkoutStructure;
  notes?: string;
  constraints?: {
    cadenceTarget?: number; // e.g., >175 spm
    hrTarget?: { min: number; max: number }; // e.g., 175-182 bpm
    fuelingTarget?: number; // e.g., 90g carbs/hr
  };
  explanation?: string; // "Why" text from coach
  isAdapted?: boolean; // true if substituted/modified
}

export interface ISubstitutionResult {
  action: 'EXECUTED_AS_PLANNED' | 'MODIFIED' | 'SKIPPED';
  originalWorkout: IWorkout;
  finalWorkout: IWorkout;
  reasoning: string;
  modifications: string[]; // List of specific changes e.g. ["Downgraded Intensity", "Switched to Bike"]
}

export interface PhaseDefinition {
  phaseNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  maxAllowedZone: IntensityZone;
  maxMonthlyVolume: number; // km/month
  maxWeeklyVolume: number; // km/week (for Phase 3)
  requiresStructuralIntegrity?: number; // Minimum SIS for high volume (Phase 3)
  hrCap?: { min: number; max: number };
}