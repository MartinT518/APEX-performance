import { IPhenotypeProfile } from '@/types/phenotype';
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { mapRowToProfile } from './profileMapper';
import { DEFAULT_CONFIG } from './constants';

/**
 * Loads phenotype profile from Supabase or creates default if none exists
 * @param userId - Optional user ID. If not provided, will try to get from session.
 * @param supabaseClient - Optional Supabase client. If not provided, uses default client-side instance.
 */
export async function loadProfileFromSupabase(
  userId?: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<IPhenotypeProfile> {
  const client = supabaseClient || supabase;
  
  // Get current user if not provided
  let targetUserId = userId;
  if (!targetUserId) {
    // Try getSession() first (works in client-side contexts)
    const { data: { session } } = await client.auth.getSession();
    targetUserId = session?.user?.id;
    
    // Fallback to getUser() if getSession() fails (works in server-side contexts)
    // This handles cases where Authorization header is set but session isn't available
    if (!targetUserId) {
      const { data: { user } } = await client.auth.getUser();
      targetUserId = user?.id;
    }
  }

  if (!targetUserId) {
    throw new Error('No user ID available');
  }

  // Fetch from Supabase
  const { data, error } = await client
    .from('phenotype_profiles')
    .select('*')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // CRITICAL: Before inserting, ensure session is properly set for RLS policies
    // RLS requires auth.uid() to match user_id
    // If Authorization header is set, RLS should work even if getSession() returns null
    // So we'll try the insert - if it fails with RLS error, we'll handle it
    
    // Wait a moment for any setSession() calls to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Try to verify session is available, but don't fail if it's not
    // The Authorization header should make RLS work even without getSession() returning a session
    const { data: { session: currentSession } } = await client.auth.getSession();
    const { data: { user } } = await client.auth.getUser();
    
    // Log for debugging
    if (!currentSession && !user) {
      console.warn('[ProfileLoader] No session or user found, but proceeding with insert - Authorization header should work');
    }
    
    // Create default profile if none exists
    // At this point, session should be set and auth.uid() should work
    const { data: newProfile, error: insertError } = await client
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
        goal_marathon_time: '2:30:00', // Default goal time
      })
      .select()
      .single();

    if (insertError) {
      // Provide more helpful error message for RLS violations
      if (insertError.message?.includes('row-level security') || insertError.code === '42501') {
        throw new Error(
          'Row-level security policy violation. ' +
          'This usually means the session is not properly authenticated. ' +
          'Please refresh the page or log out and log back in.'
        );
      }
      throw insertError;
    }
    if (!newProfile) throw new Error('Failed to create profile');

    return mapRowToProfile(newProfile);
  }

  return mapRowToProfile(data);
}

