import { useMonitorStore } from '../../monitor/monitorStore';
import { usePhenotypeStore } from '../../monitor/phenotypeStore';
import { evaluateStructuralHealth } from '../../execute/agents/structuralAgent';
import { evaluateMetabolicState } from '../../execute/agents/metabolicAgent';
import { evaluateFuelingStatus } from '../../execute/agents/fuelingAgent';
import { synthesizeCoachDecision } from '../../review/logic/substitutionMatrix';
import { calculateAerobicDecoupling, calculateTimeInRedZone } from '../../kill/logic/decoupling';
import type { IWorkout, ISubstitutionResult } from '@/types/workout';
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
  if (!profile) throw new Error("Profile missing");

  const votes: IAgentVote[] = [];

  // Agent A: Structural
  const daysSinceLift = monitor.getDaysSinceLastLift(); 
  
  votes.push(evaluateStructuralHealth({
    niggleScore: monitor.todayEntries.niggleScore || 0,
    daysSinceLastLift: daysSinceLift 
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

  // Agent C: Fueling
  votes.push(evaluateFuelingStatus({
    gutTrainingIndex: 2,
    nextRunDuration: todaysWorkout.durationMinutes
  }));

  logger.info("Agent Votes:", votes.map(v => `${v.agentId}=${v.vote}`));

  logger.info(">> Step 6: The Coach Synthesis");
  const decision = synthesizeCoachDecision(votes, todaysWorkout);
  
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

