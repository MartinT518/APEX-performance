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

  const updatedProfile = mapRowToProfile(data);

  // FR-5.5: Invalidate future snapshots when phenotype changes
  // Check if any phenotype-affecting fields changed
  const phenotypeAffectingFields = ['max_hr_override', 'threshold_hr_known', 'anaerobic_floor_hr', 'structural_weakness', 'lift_days_required'];
  const hasPhenotypeChange = phenotypeAffectingFields.some(field => {
    const oldValue = (profile.config as any)[field];
    const newValue = (updatedProfile.config as any)[field];
    return JSON.stringify(oldValue) !== JSON.stringify(newValue);
  });

  if (hasPhenotypeChange) {
    try {
      // Import server action to invalidate future snapshots
      const { invalidateFutureSnapshots } = await import('@/app/actions');
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const refreshToken = session?.refresh_token;
      await invalidateFutureSnapshots(accessToken || undefined, refreshToken || undefined);
      console.log('Invalidated future snapshots due to phenotype change');
    } catch (err) {
      // Log but don't fail the update if invalidation fails
      console.warn('Failed to invalidate future snapshots after phenotype update:', err);
    }
  }

  return updatedProfile;
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

  const updatedProfile = mapRowToProfile(data);

  // FR-5.5: Invalidate future snapshots when High-Rev mode changes
  // High-Rev mode affects HR zone calculations, so future decisions need regeneration
  if (profile.is_high_rev !== enabled) {
    try {
      // Import server action to invalidate future snapshots
      const { invalidateFutureSnapshots } = await import('@/app/actions');
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const refreshToken = session?.refresh_token;
      await invalidateFutureSnapshots(accessToken || undefined, refreshToken || undefined);
      console.log('Invalidated future snapshots due to High-Rev mode change');
    } catch (err) {
      // Log but don't fail the update if invalidation fails
      console.warn('Failed to invalidate future snapshots after High-Rev toggle:', err);
    }
  }

  return updatedProfile;
}

