import { IAgentVote } from '@/types/agents';
import type { ISessionSummary } from '@/types/session';
import { calculateAerobicDecoupling, calculateTimeInRedZone } from '../../kill/logic/decoupling';
import { usePhenotypeStore } from '../../monitor/phenotypeStore';

/**
 * Agent B: The Metabolic Agent (The Engine)
 * 
 * Goal: Optimize metabolic efficiency and prevent "Garbage Miles".
 * Rules:
 * - RED: Excessive time in Zone 4/5 during Base Block (Intensity Violation).
 * - RED: HRV < Baseline - 15% (Systemic Fatigue detected).
 * - AMBER: Aerobic Decoupling > 5% (Sign of fatigue or dehydration).
 * 
 * CRITICAL: This agent is independent - it computes its own metrics:
 * - aerobicDecoupling from session points
 * - timeInRedZone from session points
 */
export const evaluateMetabolicState = (input: ISessionSummary['metabolic']): IAgentVote => {
  const { sessionPoints, hrvBaseline, currentHRV, planLimitRedZone } = input;
  const flaggedMetrics = [];
  
  // Compute aerobic decoupling internally from session points
  const aerobicDecoupling = sessionPoints.length > 0 
    ? calculateAerobicDecoupling(sessionPoints)
    : 0;
  
  // Compute time in red zone internally from session points
  const profile = usePhenotypeStore.getState().profile;
  const thresholdHR = profile?.config.anaerobic_floor_hr || 170;
  const timeInRedZone = sessionPoints.length > 0
    ? calculateTimeInRedZone(sessionPoints, thresholdHR)
    : 0;

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
      flaggedMetrics,
      score: 10 // High risk due to intensity violation
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
        flaggedMetrics,
        score: 15 // High risk due to systemic fatigue
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
      flaggedMetrics,
      score: 65 // Moderate risk due to decoupling
    };
  }

  // 4. GREEN
  // Calculate normalized risk score (0-100)
  let riskScore = 0;
  if (aerobicDecoupling > 0) riskScore += aerobicDecoupling * 2; // Each % decoupling = 2 risk
  if (timeInRedZone > 0) riskScore += (timeInRedZone / planLimitRedZone) * 20; // Red zone usage adds risk
  if (hrvBaseline && currentHRV) {
    const hrvDropPercent = ((hrvBaseline - currentHRV) / hrvBaseline) * 100;
    if (hrvDropPercent > 0) riskScore += hrvDropPercent * 0.5; // HRV drop adds risk
  }
  riskScore = Math.min(20, riskScore); // Cap at 20 for GREEN
  
  return {
    agentId: 'metabolic_agent',
    vote: 'GREEN',
    confidence: 1.0,
    reason: 'Metabolic State Nominal.',
    flaggedMetrics: [],
    score: Math.max(80, 100 - riskScore) // GREEN = 80-100 score (low risk)
  };
};
