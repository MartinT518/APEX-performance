import { IAgentVote, IStructuralInput } from '@/types/agents';

/**
 * Agent A: The Structural Agent (The Chassis)
 * 
 * Goal: Protect mechanical integrity.
 * Rules:
 * - RED: Niggle > 3 (Hard Stop)
 * - AMBER: Days Since Lift > 5 (Cap Intensity)
 */
export const evaluateStructuralHealth = (input: IStructuralInput): IAgentVote => {
  const { niggleScore, daysSinceLastLift } = input;
  const flaggedMetrics = [];

  // 1. RED VETO: Pain
  if (niggleScore > 3) {
    flaggedMetrics.push({
      metric: 'niggleScore',
      value: niggleScore,
      threshold: 3
    });
    
    return {
      agentId: 'structural_agent',
      vote: 'RED',
      confidence: 1.0,
      reason: 'Mechanical Integrity Compromised: Pain detected above threshold.',
      flaggedMetrics
    };
  }

  // 2. AMBER VETO: Strength Maintenance
  // "Structure Before Engine" - If we haven't lifted, we shouldn't run hard.
  const MAX_DAYS_WITHOUT_LIFT = 5;
  
  if (daysSinceLastLift > MAX_DAYS_WITHOUT_LIFT) {
    flaggedMetrics.push({
      metric: 'daysSinceLastLift',
      value: daysSinceLastLift,
      threshold: MAX_DAYS_WITHOUT_LIFT
    });

    return {
      agentId: 'structural_agent',
      vote: 'AMBER',
      confidence: 0.9,
      reason: 'Chassis Weakness Risk: Strength training frequency below maintenance.',
      flaggedMetrics
    };
  }

  // 3. GREEN
  return {
    agentId: 'structural_agent',
    vote: 'GREEN',
    confidence: 1.0,
    reason: 'Chassis Integrity Nominal.',
    flaggedMetrics: []
  };
};
