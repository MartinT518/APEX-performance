export type MeasurementUnit = 'metric' | 'imperial';

export type StructuralWeakness = 
  | 'patellar_tendon' 
  | 'glute_med' 
  | 'achilles' 
  | 'lower_back' 
  | 'plantar_fascia'
  | 'hip_flexor'
  | 'it_band';

export interface IPhenotypeConfig {
  /**
   * Verified Max HR from lab/field test.
   * Overrides age-predicted formulas.
   */
  max_hr_override: number;

  /**
   * Known Lactate Threshold HR.
   */
  threshold_hr_known?: number;

  /**
   * The HR floor for "Anaerobic" work.
   * Alerts below this should be suppressed for High-Rev athletes.
   */
  anaerobic_floor_hr: number;

  /**
   * List of known structural vulnerabilities.
   * Used by Structural Agent to adjust load.
   */
  structural_weakness: StructuralWeakness[];
  
  /**
   * Minimum days required between heavy lift sessions
   * to maintain "Chassis Integrity".
   */
  lift_days_required?: number;

  /**
   * User's subjective pain threshold (0-10) before Veto.
   * Default: 3
   */
  niggle_threshold?: number;
}

export interface IPhenotypeProfile {
  id: string;
  user_id: string;
  
  /**
   * If true, disables standard "Anaerobic" alerts for steady-state HR > 170bpm.
   * Critical for "High-Rev" athletes.
   */
  is_high_rev: boolean;
  
  /**
   * User's age in years. Used to calculate age-predicted max HR (220 - age).
   * If not provided, defaults to standard physiological ceiling.
   */
  age?: number;
  
  config: IPhenotypeConfig;
  
  created_at?: string;
  updated_at?: string;
}
