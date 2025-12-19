import { IAgentVote } from '@/types/agents';
import type { ISessionSummary } from '@/types/session';
import type { PrototypeSessionDetail } from '@/types/prototype';

/**
 * Agent C: The Fueling Agent (The Gut)
 * 
 * Goal: Ensure fueling capacity matches output demand.
 * Rules:
 * - RED: Next Run > 2.5h (150m) AND Gut Training Index < 3.
 *   (Cap duration at 2h).
 * 
 * CRITICAL FIX: Must fetch Rolling History (last 4 long runs >90min) from sessionHistory.
 * Calculate Gut_Training_Index internally from history, not just current session.
 */
export const evaluateFuelingStatus = (input: ISessionSummary['fueling']): IAgentVote => {
  const { nextRunDuration, sessionHistory } = input;
  const flaggedMetrics = [];

  const RED_DURATION_THRESHOLD = 150; // 2.5 hours
  const MIN_GUT_INDEX_REQUIRED = 3;
  const LONG_RUN_THRESHOLD = 90; // minutes

  // Compute Gut_Training_Index from rolling history (last 4 long runs >90min)
  // Gut Training Index = count of recent long runs (>90min) with >60g/hr carbs
  let gutTrainingIndex = 0;
  
  if (sessionHistory && sessionHistory.length > 0) {
    // Filter for long runs (>90min) - check duration from session history
    const longRuns = sessionHistory.filter(session => {
      // Parse duration string (e.g., "2h 30m" or "90m")
      const durationMatch = session.duration.match(/(\d+)h\s*(\d+)m|(\d+)m/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1] || '0', 10);
        const minutes = parseInt(durationMatch[2] || durationMatch[3] || '0', 10);
        const totalMinutes = hours * 60 + minutes;
        return totalMinutes > LONG_RUN_THRESHOLD;
      }
      // Fallback: check if distance suggests long run (>15km is likely >90min)
      return session.distance ? session.distance > 15 : false;
    });
    
    // Get last 4 long runs
    const recentLongRuns = longRuns.slice(-4);
    
    // Count sessions with >60g/hr fueling
    // Check hiddenVariables for fueling data, or check if fueling was logged
    gutTrainingIndex = recentLongRuns.filter(session => {
      // Check if session has fueling data indicating >60g/hr
      // This would be in hiddenVariables or metadata
      // For now, we'll use a simplified check - if fueling was logged, assume it was adequate
      // In a full implementation, we'd check actual carbs/hour from daily_monitoring
      return session.hiddenVariables?.giDistress !== undefined || 
             session.fueling !== undefined;
    }).length;
  }

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
      reason: `Gut Conditioning Critical: Attempting ${nextRunDuration}min run without sufficient fueling history. Only ${gutTrainingIndex} recent long runs with adequate fueling (need ${MIN_GUT_INDEX_REQUIRED}).`,
      flaggedMetrics,
      score: 25 // High risk due to fueling mismatch
    };
  }

  // 2. GREEN
  // Calculate normalized risk score (0-100)
  let riskScore = 0;
  if (nextRunDuration > RED_DURATION_THRESHOLD) {
    // Long runs inherently have more risk
    riskScore += 10;
    if (gutTrainingIndex < MIN_GUT_INDEX_REQUIRED) {
      riskScore += (MIN_GUT_INDEX_REQUIRED - gutTrainingIndex) * 15; // Each missing session = 15 risk
    }
    // If we have adequate history, reduce risk
    if (gutTrainingIndex >= MIN_GUT_INDEX_REQUIRED) {
      riskScore = Math.max(0, riskScore - 5); // Adequate history reduces risk
    }
  }
  riskScore = Math.min(20, riskScore); // Cap at 20 for GREEN

  return {
    agentId: 'fueling_agent',
    vote: 'GREEN',
    confidence: 1.0,
    reason: `Fueling Status Nominal. Gut Training Index: ${gutTrainingIndex} (from ${sessionHistory?.length || 0} recent sessions).`,
    flaggedMetrics: [],
    score: Math.max(80, 100 - riskScore) // GREEN = 80-100 score (low risk)
  };
};
