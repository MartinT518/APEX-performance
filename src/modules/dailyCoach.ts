import { initializeDailyCoach } from './dailyCoach/logic/initialization';
import { performDailyAudit } from './dailyCoach/logic/audit';
import { processSessionData } from './dailyCoach/logic/sessionProcessor';
import { runAnalysis } from './dailyCoach/logic/analysis';
import { generateDecision } from './dailyCoach/logic/decision';
import type { GarminClient } from './monitor/ingestion/garminClient';
import type { ISessionDataPoint } from '@/types/session';
import type { IWorkout } from '@/types/workout';
import type { IPhenotypeProfile } from '@/types/phenotype';
import type { DecisionResult } from './dailyCoach/logic/decision';
import type { AnalysisResult } from './dailyCoach/logic/analysis';
import type { SessionProcessingResult } from './dailyCoach/logic/sessionProcessor';
import type { AuditStatus } from './dailyCoach/logic/audit';

/**
 * THE DAILY COACH (Process Orchestrator)
 * 
 * Implements the "Technical Process Flow" Steps 1-6 from the FRD.
 */
export class DailyCoach {
  private static garminClient: GarminClient | null = null;
  
  // Step 1: Initialization & Phenotype Load
  static async initialize(): Promise<IPhenotypeProfile | null> {
    const { profile, garminClient } = await initializeDailyCoach();
    this.garminClient = garminClient;
    return profile;
  }

  // Step 2: Active User Ingestion
  static async performDailyAudit(lastRunDuration: number): Promise<AuditStatus> {
    return performDailyAudit(lastRunDuration, this.garminClient);
  }

  // Step 3: Raw Data Processing (The "Kill" Module)
  static async processSessionData(points: ISessionDataPoint[] = []): Promise<SessionProcessingResult> {
    return processSessionData(points, this.garminClient);
  }

  // Step 4: Analysis (Baselines & Blueprint)
  static async runAnalysis(currentHRV: number, currentTonnage: number): Promise<AnalysisResult> {
    return runAnalysis(currentHRV, currentTonnage);
  }

  // Step 5 & 6: Agent Evaluation & Coach Synthesis
  static async generateDecision(
    todaysWorkout: IWorkout,
    metabolicData?: { sessionPoints?: ISessionDataPoint[]; hrvBaseline?: number; currentHRV?: number; planLimitRedZone?: number }
  ): Promise<DecisionResult> {
    return generateDecision(todaysWorkout, metabolicData);
  }
}
