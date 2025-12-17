import { IPhenotypeProfile, IPhenotypeConfig } from '@/types/phenotype';
import { supabase } from '@/lib/supabase';
import { mapRowToProfile } from './profileMapper';
import { validateProfileId } from './validation';

/**
 * Updates phenotype configuration in Supabase
 */
export async function updateProfileConfig(
  profile: IPhenotypeProfile,
  updates: Partial<IPhenotypeConfig>
): Promise<IPhenotypeProfile> {
  // Validate profile ID before update
  await validateProfileId(profile.id);

  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id || profile.user_id;

  if (!userId) {
    throw new Error('No authenticated user found');
  }

  // Update in Supabase
  const { data, error } = await supabase
    .from('phenotype_profiles')
    .update({
      max_hr_override: updates.max_hr_override ?? profile.config.max_hr_override,
      threshold_hr_known: updates.threshold_hr_known ?? profile.config.threshold_hr_known ?? null,
      anaerobic_floor_hr: updates.anaerobic_floor_hr ?? profile.config.anaerobic_floor_hr,
      structural_weakness: updates.structural_weakness ?? profile.config.structural_weakness,
      lift_days_required: updates.lift_days_required ?? profile.config.lift_days_required,
      niggle_threshold: updates.niggle_threshold ?? profile.config.niggle_threshold,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Update returned no data');

  return mapRowToProfile(data);
}

/**
 * Toggles high-rev mode in Supabase
 */
export async function toggleHighRevMode(
  profile: IPhenotypeProfile,
  enabled: boolean
): Promise<IPhenotypeProfile> {
  // Validate profile ID before update
  await validateProfileId(profile.id);

  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id || profile.user_id;

  if (!userId) {
    throw new Error('No authenticated user found');
  }

  const { data, error } = await supabase
    .from('phenotype_profiles')
    .update({
      is_high_rev: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Update returned no data');

  return mapRowToProfile(data);
}

