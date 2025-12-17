import { IAgentVote, IMetabolicInput } from '@/types/agents';

/**
 * Agent B: The Metabolic Agent (The Engine)
 * 
 * Goal: Optimize metabolic efficiency and prevent "Garbage Miles".
 * Rules:
 * - RED: Excessive time in Zone 4/5 during Base Block (Intensity Violation).
 * - RED: HRV < Baseline - 15% (Systemic Fatigue detected).
 * - AMBER: Aerobic Decoupling > 5% (Sign of fatigue or dehydration).
 */
export const evaluateMetabolicState = (input: IMetabolicInput): IAgentVote => {
  const { aerobicDecoupling, timeInRedZone, planLimitRedZone, hrvBaseline, currentHRV } = input;
  const flaggedMetrics = [];

  // 1. RED VETO: Intensity Discipline
  if (timeInRedZone > planLimitRedZone) {
    flaggedMetrics.push({
      metric: 'timeInRedZone',
      value: timeInRedZone,
      threshold: planLimitRedZone
    });

    return {
      agentId: 'metabolic_agent',
      vote: 'RED',
      confidence: 0.95,
      reason: 'Intensity Discipline Violation: Red Zone limit exceeded.',
      flaggedMetrics
    };
  }

  // 2. RED VETO: HRV Baseline Check (Systemic Fatigue)
  if (hrvBaseline && currentHRV) {
    const hrvDropPercent = ((hrvBaseline - currentHRV) / hrvBaseline) * 100;
    const HRV_DROP_THRESHOLD = 15; // 15% drop triggers RED

    if (hrvDropPercent >= HRV_DROP_THRESHOLD) {
      flaggedMetrics.push({
        metric: 'hrvDrop',
        value: `${hrvDropPercent.toFixed(1)}%`,
        threshold: `${HRV_DROP_THRESHOLD}%`
      });

      return {
        agentId: 'metabolic_agent',
        vote: 'RED',
        confidence: 0.9,
        reason: `Systemic Fatigue detected: HRV dropped ${hrvDropPercent.toFixed(1)}% below baseline. Intensity removed to allow supercompensation.`,
        flaggedMetrics
      };
    }
  }

  // 3. AMBER VETO: Decoupling (Cardiac Drift)
  const MAX_DECOUPLING = 5.0; // 5%
  
  if (aerobicDecoupling > MAX_DECOUPLING) {
    flaggedMetrics.push({
      metric: 'aerobicDecoupling',
      value: aerobicDecoupling,
      threshold: MAX_DECOUPLING
    });

    return {
      agentId: 'metabolic_agent',
      vote: 'AMBER',
      confidence: 0.85,
      reason: 'Metabolic Efficiency Compromised: Significant cardiac drift detected.',
      flaggedMetrics
    };
  }

  // 4. GREEN
  return {
    agentId: 'metabolic_agent',
    vote: 'GREEN',
    confidence: 1.0,
    reason: 'Metabolic State Nominal.',
    flaggedMetrics: []
  };
};
