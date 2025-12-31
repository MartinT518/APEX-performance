"use server";

import { createServerClient } from "@/lib/supabase";
import { EliteBlueprintGenerator } from "@/modules/analyze/blueprintGenerator";
import { logger } from "@/lib/logger";
import { getCurrentPhase } from "@/modules/analyze/blueprintEngine";

export async function generateEliteWeek(
  goalTime?: string, // Optional - will use profile goal_marathon_time if not provided
  clientAccessToken?: string,
  clientRefreshToken?: string
) {
  try {
    // Create server client with access token if provided
    // createServerClient() will now await setSession() if tokens are provided
    const supabase = await createServerClient(clientAccessToken || undefined);
    
    // Get user session - createServerClient() should have set the session if tokens were provided
    // SECURITY: Never trust client-provided userId - always get from server session
    let userId: string | undefined;
    let session: any = null;
    
    // Try getUser() first - it should work now since createServerClient() awaited setSession()
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      // If getUser() fails, try getSession() as fallback
      logger.warn("getUser() failed, trying getSession():", userError.message);
      const { data: { session: sessionData }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        logger.warn("getSession() also failed:", sessionError.message);
      } else {
        session = sessionData;
        userId = session?.user?.id;
      }
    } else {
      userId = user?.id;
      if (userId) {
        logger.info(`Successfully got user ID from getUser(): ${userId}`);
        // Also get session for later use
        const { data: { session: sessionData } } = await supabase.auth.getSession();
        session = sessionData;
      }
    }
    
    // SECURITY: Never use client-provided userId as fallback
    // If session fails, return error - this ensures RLS policies work correctly
    if (!userId) {
      logger.error("No user ID found - user may not be authenticated.", {
        hasSession: !!session,
        sessionUser: session?.user?.id,
        userError: userError?.message,
        hasAccessToken: !!clientAccessToken
      });
      return { 
        success: false, 
        message: "Not authenticated. Please refresh the page and try again. If the issue persists, please log out and log back in." 
      };
    }
    
    // Note: If getUser() succeeded, Authorization header is set and RLS should work
    // getSession() may return null even when getUser() works - this is acceptable
    // Only verify session mismatch if session actually exists
    if (!session) {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      session = currentSession;
    }
    
    // Only check mismatch if session exists (if it's null, Authorization header should still work)
    if (session && session?.user?.id !== userId) {
      logger.error('Session user ID mismatch', {
        sessionUserId: session?.user?.id,
        expectedUserId: userId
      });
      return {
        success: false,
        message: "Authentication error: Session mismatch. Please log out and log back in."
      };
    }
    
    logger.info(`Authenticated user: ${userId}`);

    // Fetch user phenotype (including goal_marathon_time)
    const { data: profile, error: profileError } = await supabase
      .from('phenotype_profiles')
      .select('max_hr, threshold_hr, weight_kg, goal_marathon_time') // Include goal_marathon_time
      .eq('user_id', userId)
      .maybeSingle();
    
    if (profileError) {
      logger.error('Failed to fetch phenotype profile:', profileError);
      return { success: false, message: `Failed to load profile: ${profileError.message}` };
    }
    
    // Use profile goal_marathon_time if not provided, fallback to default
    const finalGoalTime = goalTime || profile?.goal_marathon_time || '2:30:00';

    // Fetch recent adherence (mock or calc)
    // For now using mock 85% if not calculated real-time
    const recentAdherence = 85; 

    // Determine phase
    const currentPhaseDef = getCurrentPhase(new Date());
    // Map phase name to Enum 'BASE' | 'POWER' | 'SPECIFIC' | 'TAPER'
    let currentPhase: 'BASE' | 'POWER' | 'SPECIFIC' | 'TAPER' = 'BASE';
    if (currentPhaseDef.phaseNumber === 2) currentPhase = 'POWER';
    if (currentPhaseDef.phaseNumber === 3) currentPhase = 'SPECIFIC';
    if (currentPhaseDef.phaseNumber === 4) currentPhase = 'TAPER';

    const blueprint = await EliteBlueprintGenerator.generateWeeklyBlueprint({
      goalTime: finalGoalTime, // Use profile goal_marathon_time
      currentPhase,
      phenotype: {
        maxHR: profile?.max_hr || 190,
        thresholdHR: profile?.threshold_hr || 170,
        weightKg: profile?.weight_kg || 70
      },
      recentAdherence
    });

    return { success: true, blueprint };

  } catch (error: any) {
    logger.error("Elite Blueprint Generation Failed", error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    logger.error("Error details:", {
      message: errorMessage,
      stack: error?.stack,
      name: error?.name
    });
    return { success: false, message: errorMessage };
  }
}
