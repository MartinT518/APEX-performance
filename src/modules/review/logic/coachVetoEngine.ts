/**
 * Coach Veto Engine (Deterministic Decision Tree)
 * 
 * Purpose: Replace "soft recommendations" with hard, rule-based SubstitutionMatrix.
 * If Structure says RED, the outcome must be Bike/Rest. No negotiation.
 * 
 * CRITICAL: Implements exact decision tree (do NOT use weighted averages):
 * - IF DataIntegrity == REJECTED → Discard Session (No Analysis, no DB insert)
 * - IF Structural.status == RED → MANDATORY SUBSTITUTION (Bike/Rest, no negotiation)
 * - IF Metabolic.status == RED → DOWNGRADE (Zone 1 Recovery)
 * - IF Fueling.status == RED → CAP DURATION (max 2h)
 */

import type { IAgentVote } from '@/types/agents';
import type { IWorkout, ISubstitutionResult, PhaseDefinition } from '@/types/workout';
import { getHighestPriorityRedVote, sortVotesByPriority } from './agentHierarchy';
import substitutionTableData from './substitutionTable.json';
import { logger } from '@/lib/logger';

const SUBSTITUTION_TABLE_VERSION = substitutionTableData.version || '1.0';

type SubstitutionTable = typeof substitutionTableData;

/**
 * Maps phase number to phase name for substitution table lookup
 */
function getPhaseName(phase: PhaseDefinition): string {
  switch (phase.phaseNumber) {
    case 1:
      return 'BASE_PHASE';
    case 2:
      return 'POWER_PHASE';
    case 3:
      return 'SHARPENING_PHASE';
    case 4:
      return 'TAPER_PHASE';
    default:
      return 'BASE_PHASE';
  }
}

/**
 * Gets the veto combination key for table lookup
 * Examples: "structural_RED", "structural_RED_metabolic_RED"
 */
function getVetoCombinationKey(votes: IAgentVote[]): string {
  const redVotes = votes.filter(v => v.vote === 'RED');
  if (redVotes.length === 0) return '';
  
  // Sort by priority to ensure consistent key generation
  const sorted = sortVotesByPriority(redVotes);
  return sorted.map(v => {
    const agentName = v.agentId.replace('_agent', ''); // "structural_agent" -> "structural"
    return `${agentName}_RED`;
  }).join('_');
}

/**
 * Applies substitution from table to workout
 */
function applySubstitution(
  workout: IWorkout,
  substitution: SubstitutionTable['rules'][string][string],
  originalDuration: number
): IWorkout {
  const override = substitution.overrideWorkout || {};
  
  let finalWorkout: IWorkout = {
    ...workout,
    ...override,
    durationMinutes: override.maxDurationMinutes 
      ? Math.min(workout.durationMinutes, override.maxDurationMinutes)
      : (override.matchDuration ? workout.durationMinutes : workout.durationMinutes),
    isAdapted: true,
    explanation: substitution.protocol || workout.explanation
  };
  
  // If type changed to BIKE, update structure
  if (override.type === 'BIKE' && workout.type === 'RUN') {
    finalWorkout.structure = {
      ...finalWorkout.structure,
      mainSet: substitution.protocol || 'Cycling Intervals'
    };
  }
  
  return finalWorkout;
}

/**
 * Execute Coach Veto with deterministic decision tree
 * 
 * CRITICAL: This implements the exact decision tree - no weighted averages.
 * Structural RED always wins (hierarchical enforcement).
 */
export function executeCoachVeto(
  votes: IAgentVote[],
  workout: IWorkout,
  phase: PhaseDefinition,
  dataIntegrityStatus?: 'VALID' | 'SUSPECT' | 'REJECTED'
): ISubstitutionResult {
  logger.info(">> Coach Veto Engine: Executing deterministic decision tree");
  
  // STEP 1: Data Integrity Check (Highest Priority)
  if (dataIntegrityStatus === 'REJECTED') {
    logger.error("Data Integrity REJECTED: Discarding session (no analysis, no DB insert)");
    return {
      action: 'SKIPPED',
      originalWorkout: workout,
      finalWorkout: {
        ...workout,
        type: 'REST',
        durationMinutes: 0,
        structure: { mainSet: 'Session Rejected: Data Integrity Failure' },
        notes: 'Data integrity check failed. Session not analyzed.'
      },
      reasoning: 'Data Integrity REJECTED: Cannot proceed with analysis due to data quality issues.',
      modifications: ['Session Rejected']
    };
  }
  
  // STEP 2: Get highest priority RED vote (Structural RED wins)
  const highestPriorityRed = getHighestPriorityRedVote(votes);
  const redVotes = votes.filter(v => v.vote === 'RED');
  const amberVotes = votes.filter(v => v.vote === 'AMBER');
  
  // STEP 3: Deterministic Decision Tree
  // Multiple REDs = SHUTDOWN
  if (redVotes.length > 1) {
    const vetoKey = getVetoCombinationKey(votes);
    const phaseName = getPhaseName(phase);
    
    // Look for multi-RED rule in table
    const multiRedRule = (substitutionTableData.rules as any)[vetoKey];
    if (multiRedRule && multiRedRule.action === 'SHUTDOWN') {
      logger.warn(`Multiple RED votes detected: ${vetoKey} → SHUTDOWN`);
      return {
        action: 'SKIPPED',
        originalWorkout: workout,
        finalWorkout: {
          ...workout,
          type: 'REST',
          durationMinutes: 0,
          structure: { mainSet: 'Complete Rest + Mobility' },
          notes: 'System Shutdown: Multiple critical flags detected.'
        },
        reasoning: `Multiple Red Flags: ${vetoKey}. System Shutdown initiated for safety.`,
        modifications: ['Complete Rest']
      };
    }
  }
  
  // Single RED = Apply substitution from table
  if (highestPriorityRed) {
    const agentName = highestPriorityRed.agentId.replace('_agent', '');
    const vetoKey = `${agentName}_RED`;
    const phaseName = getPhaseName(phase);
    
    logger.info(`Highest Priority RED: ${vetoKey} (Phase: ${phaseName})`);
    
    // Look up substitution in table
    const rule = (substitutionTableData.rules as any)[vetoKey];
    if (rule && rule[phaseName]) {
      const substitution = rule[phaseName];
      const finalWorkout = applySubstitution(workout, substitution, workout.durationMinutes);
      
      logger.info(`Applied substitution: ${substitution.action} - ${substitution.protocol}`);
      
      return {
        action: 'MODIFIED',
        originalWorkout: workout,
        finalWorkout,
        reasoning: `${highestPriorityRed.reason}. ${substitution.protocol}`,
        modifications: [substitution.protocol || `${substitution.action} applied`],
        ruleVersion: SUBSTITUTION_TABLE_VERSION
      };
    } else {
      // Fallback if table doesn't have entry
      logger.warn(`No substitution rule found for ${vetoKey} in ${phaseName}, using default`);
      return {
        action: 'MODIFIED',
        originalWorkout: workout,
        finalWorkout: workout,
        reasoning: highestPriorityRed.reason,
        modifications: ['Substitution required but rule not found'],
        ruleVersion: SUBSTITUTION_TABLE_VERSION
      };
    }
  }
  
  // AMBER votes: Apply caps and downgrades (but don't change action if no RED)
  if (amberVotes.length > 0) {
    const modifications: string[] = [];
    let finalWorkout = { ...workout };
    
    // Apply AMBER rules in priority order
    const sortedAmbers = sortVotesByPriority(amberVotes);
    sortedAmbers.forEach(vote => {
      if (vote.agentId === 'structural_agent') {
        // AMBER Structural → CAP Intensity (No Z4/Z5)
        if (['Z4_THRESHOLD', 'Z5_VO2MAX'].includes(finalWorkout.primaryZone)) {
          finalWorkout.primaryZone = 'Z3_TEMPO';
          modifications.push('Capped Intensity at Z3 (Strength Deficiency)');
        }
      }
      if (vote.agentId === 'metabolic_agent') {
        // AMBER Metabolic → CAP Duration
        finalWorkout.durationMinutes = Math.min(finalWorkout.durationMinutes, 90);
        modifications.push('Capped Duration at 90min (Decoupling)');
      }
      if (vote.agentId === 'fueling_agent') {
        // AMBER Fueling → CAP Duration
        finalWorkout.durationMinutes = Math.min(finalWorkout.durationMinutes, 90);
        modifications.push('Capped Duration at 90min (Gut Training)');
      }
    });
    
    if (modifications.length > 0) {
      return {
        action: 'MODIFIED',
        originalWorkout: workout,
        finalWorkout,
        reasoning: `Cautionary flags: ${sortedAmbers.map(v => v.reason).join(' | ')}`,
        modifications,
        ruleVersion: SUBSTITUTION_TABLE_VERSION
      };
    }
  }
  
  // All GREEN: Execute as planned
  logger.info("All agents GREEN: Executing as planned");
  return {
    action: 'EXECUTED_AS_PLANNED',
    originalWorkout: workout,
    finalWorkout: workout,
    reasoning: 'All systems nominal.',
    modifications: [],
    ruleVersion: SUBSTITUTION_TABLE_VERSION
  };
}

