import { usePhenotypeStore } from '../../monitor/phenotypeStore';
import { evaluateStructuralHealth } from '../../execute/agents/structuralAgent';
import { evaluateMetabolicState } from '../../execute/agents/metabolicAgent';
import { evaluateFuelingStatus } from '../../execute/agents/fuelingAgent';
import { executeCoachVeto } from '../../review/logic/coachVetoEngine';
import { getCurrentPhase } from '../../analyze/blueprintEngine';
import { buildSessionSummary } from './sessionSummaryBuilder';
import { persistCoachAuditLog } from '../../review/logic/auditLogPersistence';
import type { IWorkout, ISubstitutionResult, IntensityZone } from '@/types/workout';
import type { IAgentVote, SessionIntegrity } from '@/types/agents';
import type { ISessionDataPoint } from '@/types/session';
import type { PrototypeSessionDetail } from '@/types/prototype';
import { logger } from '@/lib/logger';

// Apex OS Modules
import { PrescriptiveScheduler } from '../../analyze/scheduler';
import { VolumeGovernor } from '../../analyze/volumeEngine';
import { NutritionEngine } from '../../analyze/nutritionEngine';
import { PrehabDatabase } from './prehabDatabase';

export interface DecisionResult extends ISubstitutionResult {
  votes: IAgentVote[];
  integrity?: SessionIntegrity;
}

export interface MetabolicData {
  sessionPoints?: ISessionDataPoint[];
  hrvBaseline?: number;
  currentHRV?: number;
  planLimitRedZone?: number;
  sessionHistory?: PrototypeSessionDetail[];
  rollingTonnage?: number;
  rollingMileage?: number;
  sleepQuality?: number;
}

/**
 * Apex OS Central Orchestrator: Generates the Prescriptive Daily Plan
 */
export async function generateDailyPlan(
  todaysWorkout: IWorkout,
  metabolicData?: MetabolicData,
  integrity?: SessionIntegrity
): Promise<DecisionResult> {
  logger.info(">> Apex OS: Generating Prescriptive Daily Plan");
  
  const profile = usePhenotypeStore.getState().profile;
  if (!profile) throw new Error("Profile missing");

  // 1. Data Integrity Check
  if (integrity && integrity.status === 'REJECTED') {
    throw new Error(`Data Integrity REJECTED: ${integrity.reason}`);
  }

  const currentDate = new Date();
  const phase = getCurrentPhase(currentDate);

  // 2. Strategic Scaling: Volume Governor
  const rollingTonnage = metabolicData?.rollingTonnage || 0;
  const rollingMileage = metabolicData?.rollingMileage || 0;
  const integrityRatio = VolumeGovernor.calculateIntegrityRatio(rollingTonnage, rollingMileage);
  const volumeCap = VolumeGovernor.getVolumeCap(
    todaysWorkout.distanceKm || 12, // fallback
    integrityRatio,
    metabolicData?.sleepQuality || 80
  );

  if (volumeCap.capKm < (todaysWorkout.distanceKm || 12)) {
    logger.warn(`Volume Capped: ${volumeCap.reasoning}`);
    todaysWorkout.distanceKm = volumeCap.capKm;
  }

  // 3. Agent Evaluation
  const sessionSummary = await buildSessionSummary({
    sessionPoints: metabolicData?.sessionPoints || [],
    workout: todaysWorkout,
    metabolicData: {
      hrvBaseline: metabolicData?.hrvBaseline,
      currentHRV: metabolicData?.currentHRV,
      planLimitRedZone: metabolicData?.planLimitRedZone || 10
    },
    sessionHistory: metabolicData?.sessionHistory
  });

  const structuralVote = await evaluateStructuralHealth(sessionSummary.structural);
  const metabolicVote = evaluateMetabolicState(sessionSummary.metabolic);
  const fuelingVote = evaluateFuelingStatus(sessionSummary.fueling);
  const votes = [structuralVote, metabolicVote, fuelingVote];

  // 4. Coach Synthesis & Veto Engine
  let decision = executeCoachVeto(votes, todaysWorkout, phase, integrity?.status);
  
  // 5. Prescriptive Enhancements (Nutrition, Prehab, Fueling)
  // Determine intensity for nutrition calc
  let intensityForNutrition: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' = 'LOW';
  const zone = todaysWorkout.primaryZone;
  if (zone === 'Z4_THRESHOLD' || zone === 'Z5_VO2MAX') intensityForNutrition = 'HIGH';
  if (zone === 'Z3_TEMPO') intensityForNutrition = 'MODERATE';
  // Race check if applicable, otherwise default logic
  if (todaysWorkout.notes?.toLowerCase().includes('race')) intensityForNutrition = 'SEVERE';

  const nutritionPlan = NutritionEngine.calculateNutrition(
    profile, 
    todaysWorkout.durationMinutes || 60, 
    intensityForNutrition
  );

  // Inject Prehab if not already suggested by Agent
  let finalPrehab: string[] = (structuralVote as any).suggestedPrehab || [];
  
  if (finalPrehab.length === 0 && profile.config.structural_weakness && profile.config.structural_weakness.length > 0) {
      // Default to first weakness maintenance
      const weakness = profile.config.structural_weakness[0];
      // Import dynamically or assume imported (I will add import)
      const exercises = PrehabDatabase.getProtocol({ weakness });
      finalPrehab = exercises.map(ex => `${ex.name} (${ex.instructions})`);
  }

  // Update final workout with Apex OS context
  decision.finalWorkout = {
    ...decision.finalWorkout,
    fuelingContext: (metabolicVote as any).suggestedFueling || 'FUELED',
    prehabDrills: finalPrehab,
    nutritionPlan
  };

  // 6. Conflict Resolution (Pivot Rule)
  const missedMandatory = false; // Logic to determine if yest. mandatory was missed
  const structuredPlan = PrescriptiveScheduler.resolveConflict(missedMandatory, decision.finalWorkout);
  decision.finalWorkout = { ...decision.finalWorkout, ...structuredPlan };

  // Add Coach Verdict to reasoning
  if (volumeCap.capKm < (todaysWorkout.distanceKm || 12)) {
    decision.modifications.push(`Volume restricted: ${volumeCap.reasoning}`);
  }

  if (volumeCap.shouldTriggerDoubleDays) {
    decision.modifications.push("ELITE STATUS: Volume mandates Double Day orchestration.");
  }

  return {
    ...decision,
    votes,
    integrity
  };
}

/**
 * Backward compatibility alias
 */
export const generateDecision = generateDailyPlan;

