"use server";

import { DailyCoach } from "@/modules/dailyCoach";
import { IWorkout } from "@/types/workout";
import type { ISessionDataPoint } from "@/types/session";
import { createServerClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { persistSessionLog, sessionResultToLogData } from "@/modules/dailyCoach/logic/persistence";
import { persistAgentVotes } from "@/modules/dailyCoach/logic/votePersistence";
import type { SessionProcessingResult } from "@/modules/dailyCoach/logic/sessionProcessor";
import { usePhenotypeStore } from "@/modules/monitor/phenotypeStore";
import { useMonitorStore } from "@/modules/monitor/monitorStore";
import { syncGarminSessionsToDatabase } from "@/modules/monitor/ingestion/garminSync";
import { syncGarminSessionsToDatabaseMCP } from "@/modules/monitor/ingestion/garminSyncMCP";
import { GarminClient } from "@/modules/monitor/ingestion/garminClient";
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables for server actions
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export async function runCoachAnalysis() {
  logger.info("SERVER ACTION: runCoachAnalysis triggered");
  try {
    // 0. Check if profile exists
    let currentProfile = usePhenotypeStore.getState().profile;
    if (!currentProfile) {
      // Try to load profile
      const phenotypeStore = usePhenotypeStore.getState();
      await phenotypeStore.loadProfile();
      currentProfile = usePhenotypeStore.getState().profile;
      if (!currentProfile) {
        return { success: false, message: "Profile not configured. Please complete settings first." };
      }
    }

    // 1. Initialize Coach (Loads Profile & Garmin)
    await DailyCoach.initialize();

    // 2. Perform Audit
    // We pass -1 or a dummy value because we want DailyCoach to fetch real data
    const auditStatus = await DailyCoach.performDailyAudit(0); 
    
    if (auditStatus === 'AUDIT_PENDING') {
      return { success: false, message: "Audit Required: Please complete daily logs." };
    }

    // 3. Process Session (Fetch latest Garmin automatically if available)
    // Passing empty array triggers automatic Garmin fetch when client is available
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

    // 4. Run Analysis (Use real baseline data if available)
    // Get current baselines from database
    const supabase = createServerClient();
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    
    let currentHRV = 55; // Default fallback
    let currentTonnage = 12000; // Default fallback
    
    if (userId) {
      // Try to get latest baseline metrics
      type BaselineMetrics = { hrv: number | null; tonnage: number | null };
      const result = await supabase
        .from('baseline_metrics')
        .select('hrv, tonnage')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: BaselineMetrics | null; error: unknown };
      
      if (result.data) {
        currentHRV = result.data.hrv ?? currentHRV;
        currentTonnage = result.data.tonnage ? Number(result.data.tonnage) : currentTonnage;
      }
    }
    
    const { simulation, baselines } = await DailyCoach.runAnalysis(currentHRV, currentTonnage);

    // 5. Generate Decision
    // Generate workout based on current phase (not hardcoded)
    const { getCurrentPhase } = await import('@/modules/analyze/blueprintEngine');
    const phase = getCurrentPhase(new Date());
    const workoutProfile = usePhenotypeStore.getState().profile;
    const thresholdHR = workoutProfile?.config.threshold_hr_known || 175;
    
    // Use phase max zone as base (will be further constrained by agents)
    const baseZone = phase.maxAllowedZone;
    
    // Check volume caps (Rule A-1)
    const monitor = useMonitorStore.getState();
    const currentWeeklyVolume = await monitor.calculateCurrentWeeklyVolume();
    const currentMonthlyVolume = currentWeeklyVolume * 4.33; // Approximate
    
    if (currentMonthlyVolume > phase.maxMonthlyVolume) {
      logger.warn(`Volume cap exceeded: ${currentMonthlyVolume.toFixed(1)}km/month > ${phase.maxMonthlyVolume}km/month`);
    }
    
    // Phase 3 special rule: Requires Structural_Integrity_Score > 80 for 160km/week
    if (phase.phaseNumber === 3 && currentWeeklyVolume > phase.maxWeeklyVolume) {
      // TODO: Calculate Structural Integrity Score (SIS)
      // For now, log warning
      logger.warn(`Phase 3 volume check: ${currentWeeklyVolume.toFixed(1)}km/week > ${phase.maxWeeklyVolume}km/week (requires SIS > 80)`);
    }
    
    const mockTodayWorkout: IWorkout = {
        id: 'w_today',
        date: new Date().toISOString().split('T')[0],
        type: 'RUN',
        primaryZone: baseZone, // Use phase constraint instead of hardcoded Z4_THRESHOLD
        durationMinutes: 60,
        structure: { mainSet: baseZone === 'Z2_ENDURANCE' ? "Easy Base Build" : baseZone === 'Z4_THRESHOLD' ? "3x15min Threshold" : "Workout" },
        constraints: {
          cadenceTarget: 175,
          hrTarget: phase.hrCap ? phase.hrCap : { 
            min: thresholdHR - 7, 
            max: thresholdHR + 7 
          },
          fuelingTarget: 60 // Only shown if >90min
        },
        explanation: workoutProfile?.is_high_rev 
          ? phase.phaseNumber === 1 
            ? "Aerobic Base Phase: Building mitochondrial density through Zone 2 volume."
            : "Chassis and Engine are Green. Time to build lactate clearance."
          : "Threshold intervals to build aerobic capacity."
    };

    // Pass real session data and HRV to decision generation
    const decision = await DailyCoach.generateDecision(mockTodayWorkout, {
      sessionPoints: sessionPoints,
      hrvBaseline: baselines.hrvBaseline,
      currentHRV: currentHRV,
      planLimitRedZone: 10
    });

    // Persist session log and agent votes (use already-processed result)
    let sessionId: string | undefined;
    if (processingResult && (sessionPoints.length > 0 || sessionMetadata.dataSource !== 'NONE')) {
      try {
        const sessionLogData = sessionResultToLogData(processingResult, mockTodayWorkout.durationMinutes);
        const sessionResult = await persistSessionLog(sessionLogData);
        
        if (sessionResult.success && sessionResult.sessionId) {
          sessionId = sessionResult.sessionId;
          
          // Persist agent votes
          await persistAgentVotes(sessionId, decision.votes);
        }
      } catch (e) {
        logger.warn("Failed to persist session/votes:", e);
        // Don't fail the whole analysis if persistence fails
      }
    }

    return { 
        success: true, 
        decision: decision, // Already includes votes from dailyCoach
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
      result = await syncGarminSessionsToDatabaseMCP(startDate, endDate, userId);
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
      
      result = await syncGarminSessionsToDatabase(garminClient, startDate, endDate, userId);
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
