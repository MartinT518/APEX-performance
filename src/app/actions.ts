"use server";

import { DailyCoach } from "@/modules/dailyCoach";
import { IWorkout } from "@/types/workout";
import type { ISessionDataPoint } from "@/types/session";
import { createServerClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { persistSessionLog, sessionResultToLogData } from "@/modules/dailyCoach/logic/persistence";
import { persistAgentVotes } from "@/modules/dailyCoach/logic/votePersistence";
import type { SessionProcessingResult } from "@/modules/dailyCoach/logic/sessionProcessor";
import { syncGarminSessionsToDatabase } from "@/modules/monitor/ingestion/garminSync";
import { syncGarminSessionsToDatabaseMCP } from "@/modules/monitor/ingestion/garminSyncMCP";
import { GarminClient } from "@/modules/monitor/ingestion/garminClient";
import { performDailyAudit } from "@/modules/dailyCoach/logic/audit";
import { loadDailySnapshot, persistDailySnapshot } from "@/modules/dailyCoach/logic/snapshotPersistence";
import { buildDailySnapshot } from "@/modules/dailyCoach/logic/snapshotBuilder";
import { resolveDailyStatus } from "@/modules/review/logic/statusResolver";
import { mapRowToProfile } from "@/modules/monitor/phenotypeStore/logic/profileMapper";
import { DEFAULT_CONFIG } from "@/modules/monitor/phenotypeStore/logic/constants";
import type { IPhenotypeProfile } from "@/types/phenotype";
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables for server actions
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export async function runCoachAnalysis(providedUserId?: string) {
  logger.info("SERVER ACTION: runCoachAnalysis triggered");
  try {
    const supabase = createServerClient();
    let userId = providedUserId;
    
    if (!userId) {
      const { data: session } = await supabase.auth.getSession();
      userId = session?.session?.user?.id;
    }
    
    if (!userId) {
      return { success: false, message: "Not authenticated. Please log in." };
    }

    const today = new Date().toISOString().split('T')[0];

    // 0. Load profile from DB (no zustand)
    const { data: profileRow, error: profileError } = await supabase
      .from('phenotype_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      logger.error('Failed to load profile', profileError);
      return { success: false, message: "Failed to load profile." };
    }

    if (!profileRow) {
      return { success: false, message: "Profile not configured. Please complete settings first." };
    }

    const currentProfile: IPhenotypeProfile = mapRowToProfile(profileRow);

    // 1. Load daily monitoring from DB
    const { data: dailyMonitoring, error: monitoringError } = await supabase
      .from('daily_monitoring')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (monitoringError) {
      logger.error('Failed to load daily monitoring', monitoringError);
    }

    const niggleScore = dailyMonitoring?.niggle_score ?? null;
    const strengthTier = dailyMonitoring?.strength_tier ?? null;
    const fuelingCarbsPerHour = dailyMonitoring?.fueling_carbs_per_hour ?? null;
    const fuelingGiDistress = dailyMonitoring?.fueling_gi_distress ?? null;

    // 2. Check snapshot cache first
    const snapshotResult = await loadDailySnapshot({ userId, date: today });
    if (snapshotResult.success && snapshotResult.snapshot) {
      const snapshot = snapshotResult.snapshot;
      // Check if inputs have changed (compare inputs_summary)
      const inputsMatch = snapshot.inputs_summary_jsonb && 
        snapshot.inputs_summary_jsonb.niggle_score === niggleScore &&
        snapshot.inputs_summary_jsonb.strength_tier === strengthTier &&
        snapshot.inputs_summary_jsonb.fueling_carbs_per_hour === fuelingCarbsPerHour &&
        snapshot.inputs_summary_jsonb.fueling_gi_distress === fuelingGiDistress;
      
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
            action: snapshot.final_workout_jsonb.isAdapted ? 'MODIFIED' : 'EXECUTED_AS_PLANNED',
            originalWorkout: snapshot.final_workout_jsonb,
            finalWorkout: snapshot.final_workout_jsonb,
            reasoning: snapshot.reason,
            modifications: [],
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

    // 3. Get last run duration for audit check
    const { data: lastSession } = await supabase
      .from('session_logs')
      .select('duration_minutes')
      .eq('user_id', userId)
      .eq('sport_type', 'RUNNING')
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastRunDuration = lastSession?.duration_minutes ?? 0;

    // 4. Perform Audit (using new audit gating)
    const auditInputs = {
      niggleScore,
      strengthTier,
      lastRunDuration,
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

    const auditStatus = await performDailyAudit(auditInputs, garminClient);
    
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
      .maybeSingle();
    
    if (baselineData) {
      currentHRV = baselineData.hrv ?? currentHRV;
      currentTonnage = baselineData.tonnage ? Number(baselineData.tonnage) : currentTonnage;
    }
    
    const { simulation, baselines } = await DailyCoach.runAnalysis(currentHRV, currentTonnage);

    // 7. Generate Decision
    const { getCurrentPhase } = await import('@/modules/analyze/blueprintEngine');
    const phase = getCurrentPhase(new Date());
    const thresholdHR = currentProfile.config.threshold_hr_known || 175;
    
    const baseZone = phase.maxAllowedZone;
    
    // Calculate weekly volume from DB (no zustand)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const { data: weeklySessions } = await supabase
      .from('session_logs')
      .select('duration_minutes')
      .eq('user_id', userId)
      .eq('sport_type', 'RUNNING')
      .gte('session_date', weekStart.toISOString().split('T')[0]);
    
    const currentWeeklyVolume = weeklySessions?.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) ?? 0;
    const currentMonthlyVolume = currentWeeklyVolume * 4.33;
    
    if (currentMonthlyVolume > phase.maxMonthlyVolume) {
      logger.warn(`Volume cap exceeded: ${currentMonthlyVolume.toFixed(1)}km/month > ${phase.maxMonthlyVolume}km/month`);
    }
    
    const mockTodayWorkout: IWorkout = {
        id: 'w_today',
        date: today,
        type: 'RUN',
        primaryZone: baseZone,
        durationMinutes: 60,
        structure: { mainSet: baseZone === 'Z2_ENDURANCE' ? "Easy Base Build" : baseZone === 'Z4_THRESHOLD' ? "3x15min Threshold" : "Workout" },
        constraints: {
          cadenceTarget: 175,
          hrTarget: phase.hrCap ? phase.hrCap : { 
            min: thresholdHR - 7, 
            max: thresholdHR + 7 
          },
          fuelingTarget: 30
        },
        explanation: currentProfile.is_high_rev 
          ? phase.phaseNumber === 1 
            ? "Aerobic Base Phase: Building mitochondrial density through Zone 2 volume."
            : "Chassis and Engine are Green. Time to build lactate clearance."
          : "Threshold intervals to build aerobic capacity."
    };

    // Generate decision
    const decision = await DailyCoach.generateDecision(mockTodayWorkout, {
      sessionPoints: sessionPoints,
      hrvBaseline: baselines.hrvBaseline,
      currentHRV: currentHRV,
      planLimitRedZone: 10
    }, processingResult?.integrity);

    // 8. Resolve status from votes
    const statusResult = resolveDailyStatus({
      votes: decision.votes,
      niggleScore: niggleScore ?? 0
    });

    // 9. Persist session log and agent votes
    let sessionId: string | undefined;
    if (processingResult && (sessionPoints.length > 0 || sessionMetadata.dataSource !== 'NONE')) {
      try {
        const sessionLogData = sessionResultToLogData(processingResult, mockTodayWorkout.durationMinutes);
        const sessionResult = await persistSessionLog(sessionLogData);
        
        if (sessionResult.success && sessionResult.sessionId) {
          sessionId = sessionResult.sessionId;
          await persistAgentVotes(sessionId, decision.votes);
        }
      } catch (e) {
        logger.warn("Failed to persist session/votes:", e);
      }
    }

    // 10. Build and persist snapshot
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
      ...snapshot
    });

    // 11. Return result with status
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
    const supabase = createServerClient();
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    if (!userId) {
      return { success: false, message: "Not authenticated." };
    }

    const today = new Date().toISOString().split('T')[0];

    // Load current snapshot
    const snapshotResult = await loadDailySnapshot({ userId, date: today });
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
    });

    return { success: true, workout: rewrittenWorkout };
  } catch (error: unknown) {
    logger.error("Apply substitution option failed", error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Check if sync is in cooldown period (last sync was less than 5 minutes ago)
 */
async function checkSyncCooldown(userId: string): Promise<{ inCooldown: boolean; lastSyncTime: Date | null; minutesRemaining: number }> {
  const supabase = createServerClient();

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
  userId: string,
  force: boolean = false
): Promise<{ success: boolean; synced?: number; errors?: number; message?: string; inCooldown?: boolean; minutesRemaining?: number }> {
  try {
    if (!userId) {
      logger.warn('No userId provided to syncGarminSessions');
      return {
        success: false,
        message: 'Not authenticated. Please log in and try again.'
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
    try {
      logger.info("Attempting sync with MCP client (token persistence, efficient date-range queries)...");
      result = await syncGarminSessionsToDatabaseMCP(startDate, endDate, userId, force);
      logger.info(`MCP sync result: ${result.synced} synced, ${result.errors} errors`);
    } catch (mcpError) {
      const mcpErrorMsg = mcpError instanceof Error ? mcpError.message : String(mcpError);
      logger.warn(`MCP sync failed: ${mcpErrorMsg}, falling back to npm client`);
      
      // Fallback to npm client if MCP fails
      // Add initial delay before login to avoid immediate rate limiting
      logger.info("Waiting 10 seconds before npm client login to avoid rate limiting...");
      await new Promise(resolve => setTimeout(resolve, 10000));

      let garminClient: GarminClient | null = null;
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
  const supabase = createServerClient();
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  
  // If not authenticated via session, try to get user_id from existing profile
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: profiles } = await supabase.from('phenotype_profiles').select('user_id').limit(1);
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

  const { error } = await supabase
    .from('daily_monitoring')
    .upsert(updates, { onConflict: 'user_id,date' });

  if (error) {
    logger.error('Backfill failed', error);
    return { success: false, error: error.message };
  }

  return { success: true, count: updates.length };
}
