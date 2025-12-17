import { IPhenotypeProfile } from '@/types/phenotype';
import type { Database } from '@/types/database';

type PhenotypeRow = Database['public']['Tables']['phenotype_profiles']['Row'];

/**
 * Maps a database row to IPhenotypeProfile
 */
export function mapRowToProfile(row: PhenotypeRow): IPhenotypeProfile {
  return {
    id: row.id,
    user_id: row.user_id,
    is_high_rev: row.is_high_rev,
    config: {
      max_hr_override: row.max_hr_override,
      threshold_hr_known: row.threshold_hr_known ?? undefined,
      anaerobic_floor_hr: row.anaerobic_floor_hr,
      structural_weakness: row.structural_weakness,
      lift_days_required: row.lift_days_required,
      niggle_threshold: row.niggle_threshold,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

