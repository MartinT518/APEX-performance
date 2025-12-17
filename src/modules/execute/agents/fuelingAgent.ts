import { IAgentVote, IFuelingInput } from '@/types/agents';

/**
 * Agent C: The Fueling Agent (The Gut)
 * 
 * Goal: Ensure fueling capacity matches output demand.
 * Rules:
 * - RED: Next Run > 2.5h (150m) AND Gut Training Index < 3.
 *   (Cap duration at 2h).
 */
export const evaluateFuelingStatus = (input: IFuelingInput): IAgentVote => {
  const { gutTrainingIndex, nextRunDuration } = input;
  const flaggedMetrics = [];

  const RED_DURATION_THRESHOLD = 150; // 2.5 hours
  const MIN_GUT_INDEX_REQUIRED = 3;

  // 1. RED VETO: Critical Fueling Mismatch
  if (nextRunDuration > RED_DURATION_THRESHOLD && gutTrainingIndex < MIN_GUT_INDEX_REQUIRED) {
    flaggedMetrics.push({
      metric: 'gutTrainingIndex',
      value: gutTrainingIndex,
      threshold: MIN_GUT_INDEX_REQUIRED
    });

    return {
      agentId: 'fueling_agent',
      vote: 'RED',
      confidence: 0.9,
      reason: 'Gut Conditioning Critical: Attempting 2.5h+ run without sufficient fueling history.',
      flaggedMetrics
    };
  }

  // 2. GREEN
  return {
    agentId: 'fueling_agent',
    vote: 'GREEN',
    confidence: 1.0,
    reason: 'Fueling Status Nominal.',
    flaggedMetrics: []
  };
};
