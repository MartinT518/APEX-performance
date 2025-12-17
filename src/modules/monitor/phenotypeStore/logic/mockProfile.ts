import { IPhenotypeProfile } from '@/types/phenotype';
import { DEFAULT_CONFIG } from './constants';

/**
 * Creates a mock profile for development when no user is authenticated
 */
export function createMockProfile(): IPhenotypeProfile {
  return {
    id: 'phoenix_high_rev_01',
    user_id: 'user_01',
    is_high_rev: true,
    config: {
      max_hr_override: 205,
      threshold_hr_known: 179,
      anaerobic_floor_hr: 192,
      structural_weakness: ['patellar_tendon', 'glute_med'],
      lift_days_required: 3,
      niggle_threshold: 3,
    },
  };
}

