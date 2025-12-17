"use server";

import { DailyCoach } from "@/modules/dailyCoach";
import { IWorkout } from "@/types/workout";
import type { ISessionDataPoint } from "@/types/session";
import { createServerClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { persistSessionLog, sessionResultToLogData } from "@/modules/dailyCoach/logic/persistence";
import { persistAgentVotes } from "@/modules/dailyCoach/logic/votePersistence";

export async function runCoachAnalysis() {
  logger.info("SERVER ACTION: runCoachAnalysis triggered");
  try {
    // 1. Initialize Coach (Loads Profile & Garmin)
    await DailyCoach.initialize();

    // 2. Perform Audit
    // We pass -1 or a dummy value because we want DailyCoach to fetch real data
    const auditStatus = await DailyCoach.performDailyAudit(0); 
    
    if (auditStatus === 'AUDIT_PENDING') {
      return { success: false, message: "Audit Required: Please complete daily logs." };
    }

    // 3. Process Session (Fetch latest Garmin automatically)
    let sessionMetadata: { dataSource: string; activityName?: string; timestamp?: string } = { 
        dataSource: 'SIMULATION', 
        activityName: 'N/A' 
    };
    let sessionPoints: ISessionDataPoint[] = [];
    
    try {
        const processingResult = await DailyCoach.processSessionData([]);
        if (processingResult.metadata) {
            sessionMetadata = {
                dataSource: processingResult.metadata.dataSource,
                activityName: processingResult.metadata.activityName,
                timestamp: processingResult.metadata.timestamp
            };
        }
        sessionPoints = processingResult.points || [];
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
      const { data: latestMetrics } = await supabase
        .from('baseline_metrics')
        .select('hrv, tonnage')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestMetrics) {
        currentHRV = latestMetrics.hrv ?? currentHRV;
        currentTonnage = latestMetrics.tonnage ? Number(latestMetrics.tonnage) : currentTonnage;
      }
    }
    
    const { simulation, baselines } = await DailyCoach.runAnalysis(currentHRV, currentTonnage);

    // 5. Generate Decision
    // Mocking today's workout for the demo
    const mockTodayWorkout: IWorkout = {
        id: 'w_today',
        date: new Date().toISOString().split('T')[0],
        type: 'RUN',
        primaryZone: 'Z4_THRESHOLD',
        durationMinutes: 60,
        structure: { mainSet: "3x15min Threshold" }
    };

    // Pass real session data and HRV to decision generation
    const decision = await DailyCoach.generateDecision(mockTodayWorkout, {
      sessionPoints: sessionPoints,
      hrvBaseline: baselines.hrvBaseline,
      currentHRV: currentHRV,
      planLimitRedZone: 10
    });

    // Persist session log and agent votes
    let sessionId: string | undefined;
    if (sessionPoints.length > 0 || sessionMetadata.dataSource !== 'SIMULATION') {
      try {
        const processingResult = await DailyCoach.processSessionData(sessionPoints);
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
