import { useMonitorStore } from '../../monitor/monitorStore';
import { usePhenotypeStore } from '../../monitor/phenotypeStore';
import { useAnalyzeStore } from '../../analyze/analyzeStore';
import { evaluateStructuralHealth } from '../../execute/agents/structuralAgent';
import { evaluateMetabolicState } from '../../execute/agents/metabolicAgent';
import { evaluateFuelingStatus } from '../../execute/agents/fuelingAgent';
import { synthesizeCoachDecision } from '../../review/logic/substitutionMatrix';
import { calculateAerobicDecoupling, calculateTimeInRedZone } from '../../kill/logic/decoupling';
import { getCurrentPhase, applyIntensityVeto } from '../../analyze/blueprintEngine';
import type { IWorkout, ISubstitutionResult, IntensityZone } from '@/types/workout';
import type { IAgentVote } from '@/types/agents';
import type { ISessionDataPoint } from '@/types/session';
import { logger } from '@/lib/logger';

export interface DecisionResult extends ISubstitutionResult {
  votes: IAgentVote[];
}

export interface MetabolicData {
  sessionPoints?: ISessionDataPoint[];
  hrvBaseline?: number;
  currentHRV?: number;
  planLimitRedZone?: number;
}

/**
 * Generates coach decision: evaluates agents and synthesizes final decision
 */
export async function generateDecision(
  todaysWorkout: IWorkout,
  metabolicData?: MetabolicData
): Promise<DecisionResult> {
  logger.info(">> Step 5: Agent Evaluation");
  
  const monitor = useMonitorStore.getState();
  const profile = usePhenotypeStore.getState().profile;
  const analyzeStore = useAnalyzeStore.getState();
  if (!profile) throw new Error("Profile missing");

  const votes: IAgentVote[] = [];

  // Get current phase for constraints
  const currentDate = new Date();
  const phase = getCurrentPhase(currentDate);
  logger.info(`Current Phase: ${phase.name} (Phase ${phase.phaseNumber}), Max Zone: ${phase.maxAllowedZone}`);

  // Agent A: Structural - Load tonnage tier and weekly volume
  const daysSinceLift = monitor.getDaysSinceLastLift();
  const lastLiftTier = await monitor.getLastLiftTier();
  const currentWeeklyVolume = await monitor.calculateCurrentWeeklyVolume();
  
  votes.push(evaluateStructuralHealth({
    niggleScore: monitor.todayEntries.niggleScore || 0,
    daysSinceLastLift: daysSinceLift,
    tonnageTier: lastLiftTier,
    currentWeeklyVolume
  }));

  // Agent B: Metabolic - Use real data from session if available
  let aerobicDecoupling = 0;
  let timeInRedZone = 0;
  const planLimitRedZone = metabolicData?.planLimitRedZone || 10;
  
  if (metabolicData?.sessionPoints && metabolicData.sessionPoints.length > 0) {
    // Calculate decoupling from real session data
    aerobicDecoupling = calculateAerobicDecoupling(metabolicData.sessionPoints);
    
    // Calculate time in red zone (using anaerobic floor HR as threshold)
    const thresholdHR = profile.config.anaerobic_floor_hr || 170;
    timeInRedZone = calculateTimeInRedZone(metabolicData.sessionPoints, thresholdHR);
    
    logger.info(`Metabolic metrics: Decoupling=${aerobicDecoupling.toFixed(1)}%, RedZone=${timeInRedZone.toFixed(1)}min`);
  } else {
    // Fallback to defaults if no session data
    aerobicDecoupling = 3.0;
    timeInRedZone = 5;
    logger.info("Using default metabolic values (no session data available)");
  }
  
  votes.push(evaluateMetabolicState({
    aerobicDecoupling,
    timeInRedZone,
    planLimitRedZone,
    hrvBaseline: metabolicData?.hrvBaseline,
    currentHRV: metabolicData?.currentHRV
  }));

  // Agent C: Fueling - Use real gut training index from baselines
  const gutTrainingIndex = analyzeStore.baselines.gutTrainingIndex || 0;
  logger.info(`Gut Training Index: ${gutTrainingIndex} (from baselines)`);
  
  votes.push(evaluateFuelingStatus({
    gutTrainingIndex, // Use real value instead of hardcoded 2
    nextRunDuration: todaysWorkout.durationMinutes
  }));

  logger.info("Agent Votes:", votes.map(v => `${v.agentId}=${v.vote}`));

  logger.info(">> Step 6: The Coach Synthesis");
  let decision = synthesizeCoachDecision(votes, todaysWorkout);
  
  // Step 4 (REVISED): Phase-Aware Synthesis - Apply intensity veto
  const agentSuggestedZone = decision.finalWorkout.primaryZone;
  const phaseLimitedZone = applyIntensityVeto(agentSuggestedZone, currentDate);
  
  if (phaseLimitedZone !== agentSuggestedZone) {
    // Modify intensity to respect phase constraint
    const zoneOrder: IntensityZone[] = ['Z1_RECOVERY', 'Z2_ENDURANCE', 'Z3_TEMPO', 'Z4_THRESHOLD', 'Z5_VO2MAX'];
    const suggestedIndex = zoneOrder.indexOf(agentSuggestedZone);
    const limitedIndex = zoneOrder.indexOf(phaseLimitedZone);
    
    if (limitedIndex < suggestedIndex) {
      decision.finalWorkout = {
        ...decision.finalWorkout,
        primaryZone: phaseLimitedZone,
        structure: {
          ...decision.finalWorkout.structure,
          mainSet: `Modified to ${phaseLimitedZone} (Phase ${phase.phaseNumber} constraint)`
        }
      };
      decision.modifications.push(`Phase Constraint: Downgraded from ${agentSuggestedZone} to ${phaseLimitedZone}`);
      decision.reasoning = `Agent suggested ${agentSuggestedZone}, but Phase ${phase.phaseNumber} caps intensity at ${phaseLimitedZone}. ${decision.reasoning}`;
      if (decision.action === 'EXECUTED_AS_PLANNED') {
        decision.action = 'MODIFIED';
      }
      logger.info(`Phase constraint applied: ${agentSuggestedZone} -> ${phaseLimitedZone}`);
    }
  }
  
  // Rule A-1: Volume Scaling (Phase 3 only, requires SIS > 80)
  // Note: SIS calculation would need to be implemented separately
  // For now, we log the check but don't modify duration
  if (phase.phaseNumber === 3 && currentWeeklyVolume > phase.maxWeeklyVolume) {
    logger.warn(`Phase 3 volume check: ${currentWeeklyVolume.toFixed(1)}km/week > ${phase.maxWeeklyVolume}km/week (requires SIS > 80)`);
    // TODO: Calculate Structural Integrity Score and cap duration if needed
  }
  
  logger.info(`Coach Decision: ${decision.action}`);
  if (decision.modifications.length > 0) {
    logger.info(`Modifications: ${decision.modifications.join(', ')}`);
  }
  
  // Return decision with votes attached for UI display
  return {
    ...decision,
    votes
  };
}

