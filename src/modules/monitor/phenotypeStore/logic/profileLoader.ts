import { IPhenotypeProfile } from '@/types/phenotype';
import { supabase } from '@/lib/supabase';
import { mapRowToProfile } from './profileMapper';
import { DEFAULT_CONFIG } from './constants';

/**
 * Loads phenotype profile from Supabase or creates default if none exists
 */
export async function loadProfileFromSupabase(userId?: string): Promise<IPhenotypeProfile> {
  // Get current user if not provided
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: session } = await supabase.auth.getSession();
    targetUserId = session?.session?.user?.id;
  }

  if (!targetUserId) {
    throw new Error('No user ID available');
  }

  // Fetch from Supabase
  const { data, error } = await supabase
    .from('phenotype_profiles')
    .select('*')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // Create default profile if none exists
    const { data: newProfile, error: insertError } = await supabase
      .from('phenotype_profiles')
      .insert({
        user_id: targetUserId,
        is_high_rev: true,
        max_hr_override: DEFAULT_CONFIG.max_hr_override,
        threshold_hr_known: null,
        anaerobic_floor_hr: DEFAULT_CONFIG.anaerobic_floor_hr,
        structural_weakness: DEFAULT_CONFIG.structural_weakness,
        lift_days_required: DEFAULT_CONFIG.lift_days_required,
        niggle_threshold: DEFAULT_CONFIG.niggle_threshold,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    if (!newProfile) throw new Error('Failed to create profile');

    return mapRowToProfile(newProfile);
  }

  return mapRowToProfile(data);
}

