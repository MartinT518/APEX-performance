"use server";

import { DailyCoach } from "@/modules/dailyCoach";
import { IWorkout } from "@/types/workout";
import type { ISessionDataPoint } from "@/types/session";
import { createServerClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { persistSessionLog, sessionResultToLogData } from "@/modules/dailyCoach/logic/persistence";
import { persistAgentVotes } from "@/modules/dailyCoach/logic/votePersistence";
import type { SessionProcessingResult } from "@/modules/dailyCoach/logic/sessionProcessor";
import { syncGarminSessionsToDatabase, syncGarminWellnessToDatabase } from "@/modules/monitor/ingestion/garminSync";
import { syncGarminSessionsToDatabaseMCP, syncGarminWellnessToDatabaseMCP } from "@/modules/monitor/ingestion/garminSyncMCP";
import { GarminClient } from "@/modules/monitor/ingestion/garminClient";
import { detectInjuryGaps } from "@/modules/analyze/injuryGapDetector";
import { performDailyAudit } from "@/modules/dailyCoach/logic/audit";
import { loadDailySnapshot, persistDailySnapshot } from "@/modules/dailyCoach/logic/snapshotPersistence";
import { buildDailySnapshot } from "@/modules/dailyCoach/logic/snapshotBuilder";
import { resolveDailyStatus } from "@/modules/review/logic/statusResolver";
import { mapRowToProfile } from "@/modules/monitor/phenotypeStore/logic/profileMapper";
import { loadProfileFromSupabase } from "@/modules/monitor/phenotypeStore/logic/profileLoader";
import { DEFAULT_CONFIG } from "@/modules/monitor/phenotypeStore/logic/constants";
import { calculateTacticalSuggestion } from "@/modules/analyze/plannerEngine";
import type { IPhenotypeProfile } from "@/types/phenotype";
import { loadSessionsWithVotes } from "./history/logic/sessionLoader";
import { sessionWithVotesToPrototype } from "@/types/prototype";
// P1 Fix: Removed dotenv.config() - environment variables should be loaded by runtime (Vercel/Netlify)
// In development, Next.js automatically loads .env.local
// In production, environment variables are set via deployment platform

export async function runCoachAnalysis(
  clientAccessToken?: string,
  clientRefreshToken?: string
) {
  logger.info("SERVER ACTION: runCoachAnalysis triggered");
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
      // This can happen if setSession() didn't work, but Authorization header should still work for RLS
      logger.warn("getUser() failed, trying getSession():", userError.message);
      const { data: { session: sessionData }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData) {
        // If both fail, check if we have cookies - they might still work for RLS
        // Even without a session, the Authorization header (if set) should allow RLS to work
        logger.warn("getSession() also failed - cookies may still work for RLS via Authorization header", {
          sessionError: sessionError?.message,
          hasClientToken: !!clientAccessToken
        });
        // Don't set userId here - we'll return an error below
      } else {
        session = sessionData;
        userId = session?.user?.id;
        if (userId) {
          logger.info(`Got user ID from getSession(): ${userId}`);
        }
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
    
    logger.info(`Authenticated user: ${userId}`);

    const today = new Date().toISOString().split('T')[0];

    // 0. Load profile from DB (auto-creates default if missing)
    // Note: If getUser() succeeded, the Authorization header is set and RLS should work
    // getSession() may return null even when getUser() works (session storage vs header auth)
    // This is acceptable - the Authorization header is sufficient for RLS policies
    // Only log a warning if session is missing, but don't block execution
    if (!session) {
      // Try to get session one more time (non-blocking)
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      session = currentSession;
      
      if (!session) {
        // Session not in storage, but Authorization header should still work for RLS
        // getUser() succeeded, so authentication is valid
        logger.warn('Session not in storage, but getUser() succeeded - Authorization header should work for RLS', {
          userId
        });
      } else if (session?.user?.id !== userId) {
        // Only error if session exists but user ID doesn't match (security issue)
        logger.error('Session user ID mismatch', {
          sessionUserId: session?.user?.id,
          expectedUserId: userId
        });
        return {
          success: false,
          message: "Authentication error: Session mismatch. Please log out and log back in."
        };
      } else {
        logger.info(`Session verified for user ${userId}`);
      }
    }
    
    let currentProfile: IPhenotypeProfile;
    try {
      currentProfile = await loadProfileFromSupabase(userId, supabase);
      logger.info(`Loaded profile for user ${userId}`);
    } catch (profileError: any) {
      logger.error('Failed to load or create profile', {
        error: profileError.message,
        code: profileError.code,
        userId,
        hasSession: !!session
      });
      
      // If RLS error, provide more helpful message
      if (profileError?.message?.includes('row-level security') || profileError?.code === '42501') {
        logger.error('RLS policy violation - session may not be properly set', {
          hasSession: !!currentSession,
          sessionUserId: currentSession?.user?.id,
          expectedUserId: userId,
          error: profileError.message,
          code: profileError.code
        });
        return { 
          success: false, 
          message: `Authentication error: Session not properly set for user ${userId}. Please refresh the page and try again. If the issue persists, please log out and log back in.` 
        };
      }
      return { success: false, message: `Failed to load profile: ${profileError?.message || 'Unknown error'}` };
    }

    // 1. Load daily monitoring from DB
    const { data: dailyMonitoring, error: monitoringError } = await supabase
      .from('daily_monitoring')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle() as any;

    if (monitoringError) {
      logger.error('Failed to load daily monitoring', monitoringError);
    }

    const niggleScore = dailyMonitoring?.niggle_score ?? null;
    const strengthSessionDone = dailyMonitoring?.strength_session ?? null;
    const strengthTier = dailyMonitoring?.strength_tier ?? null;
    const fuelingCarbsPerHour = dailyMonitoring?.fueling_carbs_per_hour ?? null;
    const fuelingGiDistress = dailyMonitoring?.fueling_gi_distress ?? null;
    
    // 2. Check snapshot cache first
    const snapshotResult = await loadDailySnapshot({ 
      userId, 
      date: today,
      clientAccessToken: clientAccessToken || undefined,
      clientRefreshToken: clientRefreshToken || undefined
    });
    if (snapshotResult.success && snapshotResult.snapshot) {
      const snapshot = snapshotResult.snapshot;
      // Check if inputs have changed (compare inputs_summary)
      const inputsMatch = snapshot.inputs_summary_jsonb && 
        (snapshot.inputs_summary_jsonb as any).niggle_score === niggleScore &&
        (snapshot.inputs_summary_jsonb as any).strength_session === strengthSessionDone &&
        (snapshot.inputs_summary_jsonb as any).strength_tier === strengthTier &&
        (snapshot.inputs_summary_jsonb as any).fueling_carbs_per_hour === fuelingCarbsPerHour &&
        (snapshot.inputs_summary_jsonb as any).fueling_gi_distress === fuelingGiDistress;
      
      if (inputsMatch) {
        logger.info("Using cached snapshot");
        // Return cached result
        const statusResult = resolveDailyStatus({
          votes: snapshot.votes_jsonb,
          niggleScore: niggleScore ?? 0
        });
        
        return {
          success: true,
          decision: {
            action: (snapshot.final_workout_jsonb.isAdapted ? 'MODIFIED' : 'EXECUTED_AS_PLANNED') as 'MODIFIED' | 'EXECUTED_AS_PLANNED' | 'SKIPPED',
            originalWorkout: snapshot.final_workout_jsonb,
            finalWorkout: snapshot.final_workout_jsonb,
            reasoning: snapshot.reason,
            modifications: [] as string[],
            votes: snapshot.votes_jsonb,
            global_status: statusResult.global_status,
            reason: statusResult.reason,
            votes_display: statusResult.votes,
            substitutions_suggested: statusResult.substitutions_suggested
          },
          simulation: {
            successProbability: snapshot.certainty_score ?? 0,
            confidenceScore: 'MEDIUM' as const,
            criticalSuccessNote: '*Critical Success: >30g Carbs/hr + None/Minimal GI Distress (Scale 1-3).'
          },
          auditStatus: 'NOMINAL',
          metadata: { dataSource: 'CACHE' }
        };
      }
    }
    
    // 3. Get last lift date and last run duration for audit check
    const { data: lastStrengthSession } = await supabase
      .from('daily_monitoring')
      .select('date')
      .eq('user_id', userId)
      .eq('strength_session', true)
      .order('date', { ascending: false })
      .limit(1)
      .limit(1)
      .maybeSingle() as any;

    const lastLiftDate = lastStrengthSession?.date;
    let daysSinceLastLift = 999;
    if (lastLiftDate) {
      const diff = new Date(today).getTime() - new Date(lastLiftDate).getTime();
      daysSinceLastLift = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    const { data: lastSession } = await supabase
      .from('session_logs')
      .select('duration_minutes')
      .eq('user_id', userId)
      .eq('sport_type', 'RUNNING')
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle() as any;

    const lastRunDuration = lastSession?.duration_minutes ?? 0;

    // 4. Perform Audit (using new audit gating)
    const auditInputs = {
      niggleScore,
      strengthSessionDone,
      strengthTier,
      lastRunDuration,
      daysSinceLastLift,
      fuelingTarget: null, // Will be determined from workout
      fuelingCarbsPerHour,
      fuelingGiDistress
    };

    // Initialize Garmin client for audit (if available)

    let garminClient: GarminClient | null = null;
    try {
      await DailyCoach.initialize();
      // Garmin client is stored in DailyCoach, but we need it for audit
      // For now, pass null - audit will use lastRunDuration from DB
    } catch (e) {
      logger.warn("Failed to initialize Garmin client", e);
    }

    const auditStatus = await performDailyAudit(auditInputs, garminClient, userId);
    
    if (auditStatus === 'AUDIT_PENDING') {
      return { success: false, message: "Audit Required: Please complete daily logs.", auditStatus };
    }

    // 5. Process Session (Fetch latest Garmin automatically if available)
    let processingResult: SessionProcessingResult | null = null;
    let sessionMetadata: { dataSource: string; activityName?: string; timestamp?: string } = { 
        dataSource: 'NONE', 
        activityName: 'N/A' 
    };
    let sessionPoints: ISessionDataPoint[] = [];
    
    try {
        processingResult = await DailyCoach.processSessionData([]);
        if (processingResult.metadata) {
            sessionMetadata = {
                ...processingResult.metadata,
                dataSource: processingResult.metadata.dataSource,
                activityName: processingResult.metadata.activityName || 'N/A',
                timestamp: processingResult.metadata.timestamp
            };
        }
        sessionPoints = processingResult.points || [];
        
        if (sessionMetadata.dataSource === 'GARMIN') {
            logger.info(`✅ Using live Garmin data: ${sessionMetadata.activityName} (${sessionPoints.length} points)`);
        } else if (sessionPoints.length > 0) {
            logger.info(`ℹ️ Using ${sessionPoints.length} provided session points`);
        } else {
            logger.warn("⚠️ No session data available - proceeding without session data");
        }
    } catch (e) {
        logger.warn("Process Session warning:", e);
    }

    // 6. Run Analysis (Use real baseline data from DB)
    let currentHRV = 55; // Default fallback
    let currentTonnage = 12000; // Default fallback
    
    const { data: baselineData } = await supabase
      .from('baseline_metrics')
      .select('hrv, tonnage')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle() as any;
    
    if (baselineData) {
      currentHRV = baselineData.hrv ?? currentHRV;
      currentTonnage = baselineData.tonnage ? Number(baselineData.tonnage) : currentTonnage;
    }

    // LOAD LAST 42 DAYS OF HISTORY FOR TACTICAL ANALYSIS
    // P0 Fix: Increased from 14 to 42 days to ensure sufficient data for Monte Carlo simulation (needs 7+ days)
    const historyStart = new Date();
    historyStart.setDate(historyStart.getDate() - 42);
    const historySessions = await loadSessionsWithVotes(
      userId,
      { start: historyStart.toISOString().split('T')[0], end: today },
      'ALL'
    );
    const prototypeHistory = historySessions.map(s => 
      sessionWithVotesToPrototype(s, s.dailyMonitoring || null)
    );
    
    const goalTime = currentProfile.goal_marathon_time || '2:30:00';
    const { simulation, baselines } = await DailyCoach.runAnalysis(currentHRV, currentTonnage, prototypeHistory, goalTime);

    // 7. Calculate structural data from database for session summary
    // P0 Fix: Calculate these values from database instead of relying on client-side state
    let lastLiftTier: 'maintenance' | 'hypertrophy' | 'strength' | 'power' | 'explosive' | undefined;
    const { data: lastStrengthMonitoring } = await supabase
      .from('daily_monitoring')
      .select('strength_tier')
      .eq('user_id', userId)
      .eq('strength_session', true)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle() as any;
    
    if (lastStrengthMonitoring?.strength_tier) {
      lastLiftTier = lastStrengthMonitoring.strength_tier as 'maintenance' | 'hypertrophy' | 'strength' | 'power' | 'explosive';
    }

    // Calculate current weekly volume from database
    const currentDate = new Date();
    const dayOfWeek = currentDate.getDay();
    const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const weekStart = new Date(currentDate.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const todayStr = today; // Use existing 'today' string variable

    const { data: weeklySessions } = await supabase
      .from('session_logs')
      .select('duration_minutes, metadata')
      .eq('user_id', userId)
      .eq('sport_type', 'RUNNING')
      .gte('session_date', weekStartStr)
      .lte('session_date', todayStr) as any;

    let currentWeeklyVolume = 0;
    if (weeklySessions && weeklySessions.length > 0) {
      const { calculateDistanceFromSession } = await import('@/modules/monitor/utils/volumeCalculator');
      currentWeeklyVolume = weeklySessions.reduce((sum: number, s: any) => {
        return sum + calculateDistanceFromSession(s);
      }, 0);
      currentWeeklyVolume = Math.round(currentWeeklyVolume * 10) / 10; // Round to 1 decimal
    }

    // 8. Generate Daily Suggestion
    const now = new Date();
    const todaysWorkout = calculateTacticalSuggestion(prototypeHistory, now);

    // 9. Generate decision with database-loaded structural data
    const decision = await DailyCoach.generateDecision(todaysWorkout, {
      sessionPoints: sessionPoints,
      hrvBaseline: baselines.hrvBaseline,
      currentHRV: currentHRV,
      planLimitRedZone: 10,
      sessionHistory: prototypeHistory,
      // P0 Fix: Pass database-loaded structural data
      structuralData: {
        niggleScore: niggleScore ?? 0,
        daysSinceLastLift,
        lastLiftTier,
        currentWeeklyVolume
      }
    }, processingResult?.integrity);

    // 8. Load Z-score context for historical normalization (42-day rolling window)
    let zScoreContext: { hrvZScore: number | null; sleepDebtHours: number | null } | undefined;
    try {
      const { loadHistoricalMonitoringForZScore, loadCurrentMonitoringData } = await import('@/modules/review/logic/zScoreDataLoader');
      const { calculateZScoreMetrics } = await import('@/modules/review/logic/zScoreCalculator');
      
      const historicalData = await loadHistoricalMonitoringForZScore(userId, today, 42);
      const currentData = await loadCurrentMonitoringData(userId, today);
      
      if (historicalData.length > 0) {
        const hrvHistorical = historicalData.map(d => d.hrv).filter((h): h is number => h !== null);
        const sleepHistorical = historicalData.map(d => d.sleep_seconds).filter((s): s is number => s !== null);
        
        zScoreContext = calculateZScoreMetrics({
          hrv: {
            current: currentData.hrv,
            historical: hrvHistorical
          },
          sleep: {
            currentSeconds: currentData.sleep_seconds,
            historicalSeconds: sleepHistorical
          }
        });
      }
    } catch (e) {
      logger.warn("Failed to load Z-score context, proceeding without historical normalization:", e);
    }

    // 9. Resolve status from votes (with Z-score context)
    const statusResult = resolveDailyStatus({
      votes: decision.votes,
      niggleScore: niggleScore ?? 0,
      zScoreContext
    });

    // 10. Persist session log and agent votes
    let sessionId: string | undefined;
    if (processingResult && (sessionPoints.length > 0 || sessionMetadata.dataSource !== 'NONE')) {
      try {
        const sessionLogData = sessionResultToLogData(processingResult, todaysWorkout.durationMinutes);
        const sessionResult = await persistSessionLog(sessionLogData);
        
        if (sessionResult.success && sessionResult.sessionId) {
          sessionId = sessionResult.sessionId;
          await persistAgentVotes(sessionId, decision.votes);
        }
      } catch (e) {
        logger.warn("Failed to persist session/votes:", e);
      }
    }

    // 11. Build and persist snapshot
    const snapshot = buildDailySnapshot({
      decision,
      certaintyScore: simulation.successProbability,
      certaintyDelta: null, // Will be calculated on next run
      inputsSummary: {
        niggleScore,
        strengthTier,
        lastRunDuration,
        fuelingCarbsPerHour,
        fuelingGiDistress
      },
      niggleScore: niggleScore ?? 0
    });

    await persistDailySnapshot({
      userId,
      date: today,
      ...snapshot,
      clientAccessToken: clientAccessToken || undefined,
      clientRefreshToken: clientRefreshToken || undefined
    });

    // 12. Return result with status
    return { 
        success: true, 
        decision: {
          ...decision,
          global_status: statusResult.global_status,
          reason: statusResult.reason,
          votes_display: statusResult.votes,
          substitutions_suggested: statusResult.substitutions_suggested
        },
        simulation: {
            successProbability: simulation.successProbability,
            confidenceScore: simulation.confidenceScore,
        },
        auditStatus,
        metadata: sessionMetadata,
        sessionId
    };

  } catch (error: unknown) {
    logger.error("Coach Analysis Failed", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, message: errorMessage };
  }
}

/**
 * Server action to apply substitution option (A/B/C) and rewrite plan in DB
 */
export async function applySubstitutionOption(
  option: 'BIKE' | 'BFR' | 'REST'
): Promise<{ success: boolean; workout?: IWorkout; message?: string }> {
  try {
    const supabase = await createServerClient();
    
    // SECURITY: Get userId from server session - never trust client-provided userId
    let userId: string | undefined;
    let session: any = null;
    
    // Try getUser() first
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      // If getUser() fails, try getSession() as fallback
      logger.warn("getUser() failed in applySubstitutionOption, trying getSession():", userError.message);
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
        const { data: { session: sessionData } } = await supabase.auth.getSession();
        session = sessionData;
      }
    }
    
    // SECURITY: Never use client-provided userId - if session fails, return error
    if (!userId) {
      logger.error("No user ID found in applySubstitutionOption - user may not be authenticated.", {
        hasSession: !!session,
        sessionUser: session?.user?.id,
        userError: userError?.message
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
      logger.error('Session user ID mismatch in applySubstitutionOption', {
        sessionUserId: session?.user?.id,
        expectedUserId: userId
      });
      return {
        success: false,
        message: "Authentication error: Session mismatch. Please log out and log back in."
      };
    }

    const today = new Date().toISOString().split('T')[0];

    // Load current snapshot (no tokens needed - using cookie-based auth)
    const snapshotResult = await loadDailySnapshot({ 
      userId, 
      date: today
    });
    if (!snapshotResult.success || !snapshotResult.snapshot) {
      return { success: false, message: "No daily decision found. Please run analysis first." };
    }

    const snapshot = snapshotResult.snapshot;
    const originalWorkout = snapshot.final_workout_jsonb;

    // Rewrite workout based on option
    let rewrittenWorkout: IWorkout;
    
    if (option === 'BIKE') {
      rewrittenWorkout = {
        ...originalWorkout,
        type: 'BIKE',
        structure: {
          ...originalWorkout.structure,
          mainSet: '60min Indoor Cycling Intervals'
        },
        constraints: {
          ...originalWorkout.constraints,
          cadenceTarget: undefined, // Not applicable to bike
        },
        isAdapted: true,
        explanation: 'Cycling intervals to match HR intensity. Zero impact on chassis.'
      };
    } else if (option === 'BFR') {
      rewrittenWorkout = {
        ...originalWorkout,
        type: 'CROSS_TRAIN',
        durationMinutes: 45,
        structure: {
          mainSet: '45min BFR Walk'
        },
        constraints: {
          ...originalWorkout.constraints,
          cadenceTarget: undefined,
        },
        isAdapted: true,
        explanation: 'Blood Flow Restriction walking. Minimal impact, maintains metabolic stimulus.'
      };
    } else { // REST
      rewrittenWorkout = {
        ...originalWorkout,
        type: 'REST',
        durationMinutes: 0,
        structure: {
          mainSet: 'Complete Rest + Mobility'
        },
        constraints: undefined,
        isAdapted: true,
        explanation: 'System Shutdown: Complete rest required.'
      };
    }

    // Update snapshot with rewritten workout
    // Note: applySubstitutionOption doesn't receive tokens, so we'll rely on cookie-based auth
    await persistDailySnapshot({
      userId,
      date: today,
      global_status: snapshot.global_status,
      reason: snapshot.reason,
      votes_jsonb: snapshot.votes_jsonb,
      final_workout_jsonb: rewrittenWorkout,
      certainty_score: snapshot.certainty_score,
      certainty_delta: snapshot.certainty_delta,
      inputs_summary_jsonb: snapshot.inputs_summary_jsonb
      // No tokens available in applySubstitutionOption - relies on cookie auth
    });

    return { success: true, workout: rewrittenWorkout };
  } catch (error: unknown) {
    logger.error("Apply substitution option failed", error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * FR-3.6 & FR-3.7: Acknowledge Shutdown (Rest Day)
 * 
 * Sets final_workout_jsonb.type = 'REST' and durationMinutes = 0
 * User must acknowledge rest day when system is in SHUTDOWN status
 */
export async function acknowledgeShutdown(): Promise<{ success: boolean; message?: string }> {
  try {
    const supabase = await createServerClient();
    
    // SECURITY: Get userId from server session - never trust client-provided userId
    let userId: string | undefined;
    let session: any = null;
    
    // Try getUser() first
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      // If getUser() fails, try getSession() as fallback
      logger.warn("getUser() failed in acknowledgeShutdown, trying getSession():", userError.message);
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
        const { data: { session: sessionData } } = await supabase.auth.getSession();
        session = sessionData;
      }
    }
    
    // SECURITY: Never use client-provided userId - if session fails, return error
    if (!userId) {
      logger.error("No user ID found in acknowledgeShutdown - user may not be authenticated.", {
        hasSession: !!session,
        sessionUser: session?.user?.id,
        userError: userError?.message
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
      logger.error('Session user ID mismatch in acknowledgeShutdown', {
        sessionUserId: session?.user?.id,
        expectedUserId: userId
      });
      return {
        success: false,
        message: "Authentication error: Session mismatch. Please log out and log back in."
      };
    }

    const today = new Date().toISOString().split('T')[0];

    // Load current snapshot
    const snapshotResult = await loadDailySnapshot({ 
      userId, 
      date: today
    });
    if (!snapshotResult.success || !snapshotResult.snapshot) {
      return { success: false, message: "No daily decision found. Please run analysis first." };
    }

    const snapshot = snapshotResult.snapshot;
    const originalWorkout = snapshot.final_workout_jsonb;

    // Set REST workout (FR-3.7: rest-only, no substitution options)
    const restWorkout: IWorkout = {
      ...originalWorkout,
      type: 'REST',
      durationMinutes: 0,
      structure: {
        mainSet: 'Complete Rest + Mobility'
      },
      constraints: undefined,
      isAdapted: true,
      explanation: 'System Shutdown: Complete rest required. No training stimulus allowed.'
    };

    // Update snapshot with REST workout
    await persistDailySnapshot({
      userId,
      date: today,
      global_status: 'SHUTDOWN',
      reason: snapshot.reason || 'Multiple system failures detected. Complete rest required.',
      votes_jsonb: snapshot.votes_jsonb,
      final_workout_jsonb: restWorkout,
      certainty_score: snapshot.certainty_score,
      certainty_delta: snapshot.certainty_delta,
      inputs_summary_jsonb: snapshot.inputs_summary_jsonb
    });

    return { success: true };
  } catch (error: unknown) {
    logger.error("Acknowledge shutdown failed", error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * FR-5.4: Invalidate Today's Snapshot
 * 
 * Called when gatekeeper inputs change (niggle, strength, fueling)
 * Deletes today's snapshot so it will be regenerated on next dashboard load
 */
export async function invalidateTodaySnapshot(
  clientAccessToken?: string,
  clientRefreshToken?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const supabase = await createServerClient(clientAccessToken || undefined);
    
    // SECURITY: Get userId from server session
    let userId: string | undefined;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    } else {
      userId = user?.id;
    }
    
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Import invalidateSnapshot function
    const { invalidateSnapshot } = await import('@/modules/dailyCoach/logic/snapshotPersistence');
    const result = await invalidateSnapshot(
      userId,
      today,
      clientAccessToken,
      clientRefreshToken
    );
    
    if (result.success) {
      logger.info(`Invalidated snapshot for ${today}`);
    }
    
    return { success: result.success, message: result.error };
  } catch (error: unknown) {
    logger.error("Invalidate snapshot failed", error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * FR-5.5: Invalidate Future Snapshots (Phenotype Change)
 * 
 * Called when phenotype profile changes (max HR, High-Rev mode, etc.)
 * Invalidates all future snapshots (date >= today) so they will be regenerated
 * Past snapshots are preserved (historical record)
 */
export async function invalidateFutureSnapshots(
  clientAccessToken?: string,
  clientRefreshToken?: string
): Promise<{ success: boolean; message?: string; invalidatedCount?: number }> {
  try {
    const supabase = await createServerClient(clientAccessToken || undefined);
    
    // SECURITY: Get userId from server session
    let userId: string | undefined;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    } else {
      userId = user?.id;
    }
    
    if (!userId) {
      return { success: false, message: "Not authenticated" };
    }
    
    // Import invalidateFutureSnapshots function
    const { invalidateFutureSnapshots: invalidateFuture } = await import('@/modules/dailyCoach/logic/snapshotPersistence');
    const result = await invalidateFuture(
      userId,
      clientAccessToken,
      clientRefreshToken
    );
    
    if (result.success) {
      logger.info(`Invalidated ${result.invalidatedCount || 0} future snapshots for user ${userId} (phenotype change)`);
    }
    
    return { 
      success: result.success, 
      message: result.error,
      invalidatedCount: result.invalidatedCount
    };
  } catch (error: unknown) {
    logger.error("Invalidate future snapshots failed", error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Check if sync is in cooldown period (last sync was less than 5 minutes ago)
 */
async function checkSyncCooldown(userId: string): Promise<{ inCooldown: boolean; lastSyncTime: Date | null; minutesRemaining: number }> {
  const supabase = await createServerClient();

  // Get most recent Garmin sync (check session_logs with Garmin source)
  const { data: lastSession, error } = await supabase
    .from('session_logs')
    .select('created_at')
    .eq('user_id', userId)
    .eq('source', 'garmin_health')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !lastSession) {
    return { inCooldown: false, lastSyncTime: null, minutesRemaining: 0 };
  }

  const lastSyncTimeStr = (lastSession as { created_at: string }).created_at;
  if (!lastSyncTimeStr) {
    return { inCooldown: false, lastSyncTime: null, minutesRemaining: 0 };
  }

  const lastSyncTime = new Date(lastSyncTimeStr);
  const now = new Date();
  const minutesSinceSync = (now.getTime() - lastSyncTime.getTime()) / (1000 * 60);
  const cooldownMinutes = 5; // 5 minute cooldown

  if (minutesSinceSync < cooldownMinutes) {
    const minutesRemaining = Math.ceil(cooldownMinutes - minutesSinceSync);
    return { inCooldown: true, lastSyncTime, minutesRemaining };
  }

  return { inCooldown: false, lastSyncTime, minutesRemaining: 0 };
}

/**
 * Server action to sync Garmin sessions to database
 * Uses fragmented sync to avoid rate limiting:
 * - Fetches activities in small batches (5 at a time)
 * - Adds delays between batches and activities
 * - Stops early if rate limited
 * - Enforces 5-minute cooldown between syncs (only for first sync)
 * - Syncs activities within the specified date range
 */
export async function syncGarminSessions(
  startDate: string,
  endDate: string,
  force: boolean = false,
  clientAccessToken?: string,
  clientRefreshToken?: string
): Promise<{ success: boolean; synced?: number; errors?: number; message?: string; inCooldown?: boolean; minutesRemaining?: number }> {
  try {
    // Create server client with access token if provided (for RLS)
    const supabase = await createServerClient(clientAccessToken || undefined);
    
    // SECURITY: Get userId from server session - never trust client-provided userId
    let userId: string | undefined;
    let session: any = null;
    
    // Try getUser() first
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      // If getUser() fails, try getSession() as fallback
      logger.warn("getUser() failed in syncGarminSessions, trying getSession():", userError.message);
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
        logger.info(`Successfully got user ID from getUser() in syncGarminSessions: ${userId}`);
        const { data: { session: sessionData } } = await supabase.auth.getSession();
        session = sessionData;
      }
    }
    
    // SECURITY: Never use client-provided userId - if session fails, return error
    if (!userId) {
      logger.error("No user ID found in syncGarminSessions - user may not be authenticated.", {
        hasSession: !!session,
        sessionUser: session?.user?.id,
        userError: userError?.message,
        hasAccessToken: !!clientAccessToken
      });
      return {
        success: false,
        message: 'Not authenticated. Please refresh the page and try again. If the issue persists, please log out and log back in.'
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
      logger.error('Session user ID mismatch in syncGarminSessions', {
        sessionUserId: session?.user?.id,
        expectedUserId: userId
      });
      return {
        success: false,
        message: "Authentication error: Session mismatch. Please log out and log back in."
      };
    }
    
    logger.info(`Sync request for user: ${userId}`);
    
    // Check cooldown (unless forced)
    if (!force) {
      const cooldown = await checkSyncCooldown(userId);
      if (cooldown.inCooldown) {
        return {
          success: false,
          inCooldown: true,
          minutesRemaining: cooldown.minutesRemaining,
          message: `Sync is in cooldown. Please wait ${cooldown.minutesRemaining} more minute(s) before syncing again.`
        };
      }
    }

    // Reload env to ensure we have latest values
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
    
    const email = process.env.GARMIN_EMAIL;
    const password = process.env.GARMIN_PASSWORD;

    logger.info(`Garmin sync attempt - Email present: ${!!email}, Password present: ${!!password}`);

    if (!email || !password) {
      logger.warn('Garmin credentials missing from environment variables');
      return { 
        success: false, 
        message: "Garmin credentials not configured. Please add GARMIN_EMAIL and GARMIN_PASSWORD to .env.local and restart the dev server." 
      };
    }

    // Try MCP client first (token persistence, efficient queries)
    // Falls back to npm client if MCP fails
    let result;
    let garminClient: GarminClient | null = null;
    try {
      logger.info("Attempting sync with MCP client (token persistence, efficient date-range queries)...");
      result = await syncGarminSessionsToDatabaseMCP(startDate, endDate, userId, force, clientAccessToken, clientRefreshToken);
      logger.info(`MCP sync result: ${result.synced} synced, ${result.errors} errors`);
    } catch (mcpError) {
      const mcpErrorMsg = mcpError instanceof Error ? mcpError.message : String(mcpError);
      logger.warn(`MCP sync failed: ${mcpErrorMsg}, falling back to npm client`);
      
      // Fallback to npm client if MCP fails
      // Add initial delay before login to avoid immediate rate limiting
      logger.info("Waiting 10 seconds before npm client login to avoid rate limiting...");
      await new Promise(resolve => setTimeout(resolve, 10000));

      try {
        garminClient = new GarminClient({ email, password });
        await garminClient.login();
        logger.info("Garmin Client initialized for sync (fallback)");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error("Garmin login failed (fallback)", err);
        
        // Check for rate limiting
        if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('Too Many Requests') || errorMessage.includes('RATE_LIMITED')) {
          return {
            success: false,
            message: "Garmin is rate-limiting requests. Please wait 10-15 minutes before trying again. Cloudflare protection is very aggressive after multiple sync attempts."
          };
        }
        
        return { 
          success: false, 
          message: "Failed to connect to Garmin. Please check your credentials." 
        };
      }
      
      result = await syncGarminSessionsToDatabase(garminClient, startDate, endDate, userId, force);
    }

    // --- WELLNESS SYNC (Run regardless of Activity Sync method) ---
    // Prefer MCP method for wellness sync as it has access to get_hrv_data
    // Fall back to npm client if MCP fails
    try {
        logger.info("Syncing wellness data (HRV/RHR/Sleep) via MCP...");
        const wellnessResult = await syncGarminWellnessToDatabaseMCP(startDate, endDate, userId, clientAccessToken, clientRefreshToken);
        logger.info(`Wellness sync result (MCP): ${wellnessResult.synced} synced, ${wellnessResult.errors} errors`);
        
        // If MCP sync had errors, try fallback with npm client
        if (wellnessResult.errors > 0 && wellnessResult.synced === 0) {
            logger.info("MCP wellness sync had issues, trying fallback with npm client...");
            if (!garminClient) {
                garminClient = new GarminClient({ email, password });
                await garminClient.login();
            }
            if (garminClient) {
                const fallbackResult = await syncGarminWellnessToDatabase(garminClient, startDate, endDate, userId);
                logger.info(`Wellness sync result (fallback): ${fallbackResult.synced} synced, ${fallbackResult.errors} errors`);
            }
        }
    } catch (wErr) {
        logger.warn("MCP wellness sync failed, trying fallback...", wErr);
        // Fallback to npm client method
        try {
            if (!garminClient) {
                garminClient = new GarminClient({ email, password });
                await garminClient.login();
            }
            if (garminClient) {
                const fallbackResult = await syncGarminWellnessToDatabase(garminClient, startDate, endDate, userId);
                logger.info(`Wellness sync result (fallback): ${fallbackResult.synced} synced, ${fallbackResult.errors} errors`);
            }
        } catch (fallbackErr) {
            logger.error("Wellness sync failed (non-blocking)", fallbackErr);
            // Don't fail the whole request if just wellness fails
        }
    }

        
    return {
      success: true,
      synced: result.synced,
      errors: result.errors
    };
  } catch (error: unknown) {
    logger.error("Garmin sync failed", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for rate limiting in outer catch
    if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('Too Many Requests')) {
      return {
        success: false,
        message: "Garmin is rate-limiting requests. Please wait 5-10 minutes and try again. This usually happens after multiple sync attempts."
      };
    }
    
    return { success: false, message: errorMessage };
  }
}

/**
 * Server action to backfill daily monitoring data for historical consistency.
 */
export async function backfillDailyMonitoring() {
  const supabase = await createServerClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    logger.error("Session error:", sessionError);
  }
  
  let userId = session?.user?.id;
  
  // Fallback: Try getUser if getSession didn't work
  if (!userId) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      logger.error("User error:", userError);
    }
    userId = user?.id;
  }
  
  // If not authenticated via session, try to get user_id from existing profile (for dev/testing)
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: profiles } = await supabase.from('phenotype_profiles').select('user_id').limit(1) as any;
    targetUserId = profiles?.[0]?.user_id;
  }

  if (!targetUserId) {
    return { success: false, message: "No user found for backfill." };
  }

  const dates = [];
  const start = new Date('2025-12-01');
  const end = new Date('2025-12-19');
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d).toISOString().split('T')[0]);
  }

  const updates = dates.map(date => {
    let tier: any = 'Mobility'; // Maintenance
    if (date === '2025-12-17') tier = 'Strength'; // Power/Str
    if (date === '2025-12-16') {
      // Check if Explosive exists in DB interface, if not fallback to Power
      tier = 'Power'; // Proxying for backfill if Explosive enum not in DB yet
    }
    
    const dObj = new Date(date);
    const isSunday = dObj.getDay() === 0;

    return {
      user_id: targetUserId,
      date,
      niggle_score: 0,
      strength_session: true,
      strength_tier: tier,
      // Simulate fueling data for Sunday long runs
      fueling_logged: isSunday,
      fueling_carbs_per_hour: isSunday ? (date < '2025-12-10' ? 20 : 45) : 0,
      fueling_gi_distress: isSunday ? (date < '2025-12-10' ? 4 : 1) : 1,
      updated_at: new Date().toISOString()
    };
  });

  const { error } = await (supabase
    .from('daily_monitoring') as any)
    .upsert(updates, { onConflict: 'user_id,date' });

  if (error) {
    logger.error('Backfill failed', error);
    return { success: false, error: error.message };
  }

  return { success: true, count: updates.length };
}

/**
 * Walk-Forward Backtesting Server Action
 * 
 * Tests the system's ability to predict injury gaps.
 * Roadmap requirement: "Accuracy exceeds 'Always Go' baseline by >20%"
 */
export async function runWalkForwardBacktest(
  userId: string,
  startDate: string,
  endDate: string,
  clientAccessToken?: string,
  clientRefreshToken?: string
): Promise<{
  success: boolean;
  results?: Array<{
    date: string;
    systemVeto: boolean;
    actualInjury: boolean;
    correct: boolean;
  }>;
  accuracy?: number;
  baselineAccuracy?: number;
  improvement?: number;
  error?: string;
}> {
  try {
    const supabase = await createServerClient(clientAccessToken || undefined);
    
    // Set session if tokens provided
    if (clientAccessToken && userId) {
      try {
        await supabase.auth.setSession({
          access_token: clientAccessToken,
          refresh_token: clientRefreshToken || '',
        } as { access_token: string; refresh_token: string });
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (sessionError: any) {
        logger.warn('Failed to set session for backtesting:', sessionError?.message);
      }
    }
    
    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || user.id !== userId) {
      return { success: false, error: 'Not authenticated or user mismatch' };
    }
    
    logger.info(`Running walk-forward backtest from ${startDate} to ${endDate} for user ${userId}`);
    
    // Detect all injury gaps in the range
    const injuryGaps = await detectInjuryGaps(userId, startDate, endDate);
    logger.info(`Found ${injuryGaps.length} injury gaps in date range`);
    
    // Get all dates with snapshots
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('daily_decision_snapshot')
      .select('date, global_status')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    
    if (snapshotsError) {
      logger.error('Failed to load snapshots for backtesting:', snapshotsError);
      return { success: false, error: 'Failed to load snapshots' };
    }
    
    if (!snapshots || snapshots.length === 0) {
      logger.warn('No snapshots found for backtesting');
      return {
        success: true,
        results: [],
        accuracy: 0,
        baselineAccuracy: 0,
        improvement: 0
      };
    }
    
    // Helper function to check if injury gap occurred within 7 days
    const checkInjuryInWindow = (date: string): boolean => {
      const checkDate = new Date(date);
      const windowEnd = new Date(checkDate);
      windowEnd.setDate(windowEnd.getDate() + 7);
      
      return injuryGaps.some(gap => {
        const gapStart = new Date(gap.startDate);
        const gapEnd = new Date(gap.endDate);
        return gapStart <= windowEnd && gapEnd >= checkDate;
      });
    };
    
    const results: Array<{
      date: string;
      systemVeto: boolean;
      actualInjury: boolean;
      correct: boolean;
    }> = [];
    
    // For each date, check if system vetoed and if injury occurred
    for (const snapshot of snapshots) {
      const systemVeto = snapshot.global_status === 'SHUTDOWN';
      const actualInjury = checkInjuryInWindow(snapshot.date);
      const correct = systemVeto === actualInjury; // True positive or true negative
      
      results.push({
        date: snapshot.date,
        systemVeto,
        actualInjury,
        correct
      });
    }
    
    // Calculate accuracy
    const correctCount = results.filter(r => r.correct).length;
    const accuracy = results.length > 0 ? (correctCount / results.length) * 100 : 0;
    
    // Calculate "Always Go" baseline (never veto = only correct on non-injury days)
    const nonInjuryDays = results.filter(r => !r.actualInjury).length;
    const baselineAccuracy = results.length > 0 ? (nonInjuryDays / results.length) * 100 : 0;
    
    // Calculate improvement
    const improvement = accuracy - baselineAccuracy;
    
    logger.info(`Backtest Results:`);
    logger.info(`  Total days: ${results.length}`);
    logger.info(`  System accuracy: ${accuracy.toFixed(1)}%`);
    logger.info(`  Baseline (Always Go) accuracy: ${baselineAccuracy.toFixed(1)}%`);
    logger.info(`  Improvement: ${improvement.toFixed(1)}%`);
    logger.info(`  Correct predictions: ${correctCount}/${results.length}`);
    
    // Breakdown by type
    const truePositives = results.filter(r => r.systemVeto && r.actualInjury).length;
    const trueNegatives = results.filter(r => !r.systemVeto && !r.actualInjury).length;
    const falsePositives = results.filter(r => r.systemVeto && !r.actualInjury).length;
    const falseNegatives = results.filter(r => !r.systemVeto && r.actualInjury).length;
    
    logger.info(`  True Positives: ${truePositives}, True Negatives: ${trueNegatives}`);
    logger.info(`  False Positives: ${falsePositives}, False Negatives: ${falseNegatives}`);
    
    return {
      success: true,
      results,
      accuracy,
      baselineAccuracy,
      improvement
    };
  } catch (error: any) {
    logger.error('Walk-forward backtest failed:', error);
    return {
      success: false,
      error: error?.message || 'Backtest failed'
    };
  }
}
