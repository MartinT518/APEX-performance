import { usePhenotypeStore } from '../../monitor/phenotypeStore';
import { evaluateStructuralHealth } from '../../execute/agents/structuralAgent';
import { evaluateMetabolicState } from '../../execute/agents/metabolicAgent';
import { evaluateFuelingStatus } from '../../execute/agents/fuelingAgent';
import { executeCoachVeto } from '../../review/logic/coachVetoEngine';
import { getCurrentPhase, applyIntensityVeto } from '../../analyze/blueprintEngine';
import { buildSessionSummary } from './sessionSummaryBuilder';
import { persistCoachAuditLog } from '../../review/logic/auditLogPersistence';
import type { IWorkout, ISubstitutionResult, IntensityZone } from '@/types/workout';
import type { IAgentVote, SessionIntegrity } from '@/types/agents';
import type { ISessionDataPoint } from '@/types/session';
import type { PrototypeSessionDetail } from '@/types/prototype';
import { logger } from '@/lib/logger';

export interface DecisionResult extends ISubstitutionResult {
  votes: IAgentVote[];
  integrity?: SessionIntegrity; // Data integrity result for audit trail
}

export interface MetabolicData {
  sessionPoints?: ISessionDataPoint[];
  hrvBaseline?: number;
  currentHRV?: number;
  planLimitRedZone?: number;
  sessionHistory?: PrototypeSessionDetail[]; // For fueling agent rolling history
}

/**
 * Generates coach decision: evaluates agents and synthesizes final decision
 * 
 * CRITICAL: Data integrity must be checked BEFORE agents execute.
 * If integrity is REJECTED, agents never run and session is not persisted.
 */
export async function generateDecision(
  todaysWorkout: IWorkout,
  metabolicData?: MetabolicData,
  integrity?: SessionIntegrity
): Promise<DecisionResult> {
  logger.info(">> Step 5: Agent Evaluation");
  
  const profile = usePhenotypeStore.getState().profile;
  if (!profile) throw new Error("Profile missing");

  // CRITICAL: Check data integrity BEFORE calling any micro-agents
  if (integrity) {
    logger.info(`Data Integrity Status: ${integrity.status} (confidence: ${(integrity.confidence * 100).toFixed(1)}%)`);
    
    if (integrity.status === 'REJECTED') {
      // REJECTED status blocks agent execution - return early with error
      logger.error(`Data Integrity REJECTED: ${integrity.reason || 'Critical data integrity failure'}`);
      throw new Error(`Data Integrity REJECTED: ${integrity.reason || 'Cannot proceed with agent evaluation due to data integrity failure'}`);
    }
    
    if (integrity.status === 'SUSPECT') {
      // SUSPECT status: agents can run but with reduced confidence
      logger.warn(`Data Integrity SUSPECT: Agents will run with reduced confidence (${(integrity.confidence * 100).toFixed(1)}%)`);
    }
  }

  // Get current phase for constraints
  const currentDate = new Date();
  const phase = getCurrentPhase(currentDate);
  logger.info(`Current Phase: ${phase.name} (Phase ${phase.phaseNumber}), Max Zone: ${phase.maxAllowedZone}`);

  // Build session summary once - each agent receives only its slice
  logger.info(">> Building Session Summary for independent agent evaluation");
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

  // Call each agent independently with its slice - no shared state or calculations
  logger.info(">> Calling agents independently (no shared state)");
  
  // Agent A: Structural - receives only structural slice
  const structuralVote = await evaluateStructuralHealth(sessionSummary.structural);
  logger.info(`Structural Agent: ${structuralVote.vote} (score: ${structuralVote.score || 'N/A'})`);
  
  // Agent B: Metabolic - receives only metabolic slice, computes its own metrics
  const metabolicVote = evaluateMetabolicState(sessionSummary.metabolic);
  logger.info(`Metabolic Agent: ${metabolicVote.vote} (score: ${metabolicVote.score || 'N/A'})`);
  
  // Agent C: Fueling - receives only fueling slice, computes Gut_Training_Index from history
  const fuelingVote = evaluateFuelingStatus(sessionSummary.fueling);
  logger.info(`Fueling Agent: ${fuelingVote.vote} (score: ${fuelingVote.score || 'N/A'})`);

  const votes: IAgentVote[] = [structuralVote, metabolicVote, fuelingVote];

  logger.info("Agent Votes:", votes.map(v => `${v.agentId}=${v.vote}`));

  logger.info(">> Step 6: The Coach Synthesis (Deterministic Veto Engine)");
  // Use deterministic Coach Veto Engine instead of weighted synthesis
  let decision = executeCoachVeto(
    votes,
    todaysWorkout,
    phase,
    integrity?.status
  );
  
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

  // Persist audit log (best effort - don't block decision)
  try {
    await persistCoachAuditLog({
      sessionId: undefined, // Will be set when session is persisted
      votes,
      decision,
      dataIntegrityStatus: integrity?.status
    });
  } catch (err) {
    logger.warn('Failed to persist audit log (non-blocking)', err);
  }

  // Return decision with votes attached for UI display
  return {
    ...decision,
    votes,
    integrity // Include integrity result for audit trail
  };
}

