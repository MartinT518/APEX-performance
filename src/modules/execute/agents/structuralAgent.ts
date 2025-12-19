import { IAgentVote, TonnageTier } from '@/types/agents';
import type { ISessionSummary } from '@/types/session';
import { useMonitorStore } from '../../monitor/monitorStore';

/**
 * Agent A: The Structural Agent (The Chassis)
 * 
 * Goal: Protect mechanical integrity.
 * Rules:
 * - RED: Niggle > 3 (Hard Stop)
 * - AMBER: Days Since Lift > 5 (Cap Intensity)
 * - AMBER/RED: Volume exceeds chassis capacity based on tonnage tier
 * 
 * CRITICAL: This agent is independent - it computes its own metrics:
 * - cadenceStability from session points
 * - Acute_Chronic_Ratio from Tonnage (not just running volume)
 */
export const evaluateStructuralHealth = async (input: ISessionSummary['structural']): Promise<IAgentVote> => {
  const { niggleScore, daysSinceLastLift, tonnageTier, currentWeeklyVolume, sessionPoints } = input;
  const flaggedMetrics = [];
  
  // Compute cadence stability internally (if session points provided)
  let cadenceStability: number | undefined;
  if (sessionPoints && sessionPoints.length > 0) {
    const cadences = sessionPoints
      .map(p => p.cadence)
      .filter((c): c is number => c !== undefined && c > 0);
    
    if (cadences.length > 0) {
      const meanCadence = cadences.reduce((sum, c) => sum + c, 0) / cadences.length;
      const variance = cadences.reduce((sum, c) => sum + Math.pow(c - meanCadence, 2), 0) / cadences.length;
      const stdDev = Math.sqrt(variance);
      // Stability = 1 - (coefficient of variation), clamped to 0-1
      cadenceStability = Math.max(0, Math.min(1, 1 - (stdDev / meanCadence)));
    }
  }
  
  // Compute Acute_Chronic_Ratio based on Tonnage (from monitorStore)
  // Acute = last 7 days tonnage, Chronic = last 28 days average tonnage
  let acuteChronicRatio: number | undefined;
  const monitor = useMonitorStore.getState();
  try {
    // Get tonnage history from monitor store
    // Note: This requires accessing historical data - for now, we'll use a simplified calculation
    // In a full implementation, we'd fetch from baseline_metrics table
    const lastLiftTier = await monitor.getLastLiftTier();
    if (lastLiftTier) {
      // Simplified: Use tier as proxy for tonnage
      // Power = 4, Strength = 3, Hypertrophy = 2, Maintenance = 1
      const tierMultiplier: Record<TonnageTier, number> = {
        'power': 4,
        'strength': 3,
        'hypertrophy': 2,
        'maintenance': 1
      };
      const acuteTonnage = tierMultiplier[lastLiftTier] * 1000; // Simplified
      const chronicTonnage = acuteTonnage * 0.8; // Simplified - would use rolling average
      acuteChronicRatio = chronicTonnage > 0 ? acuteTonnage / chronicTonnage : undefined;
    }
  } catch (e) {
    // If calculation fails, continue without ratio
    console.warn('Failed to calculate Acute_Chronic_Ratio:', e);
  }

  // Strength-to-Volume Ratio: Max_Weekly_KM = (Tonnage_Tier * 20) + 60
  const TONNAGE_TIER_MULTIPLIER: Record<TonnageTier | 'none', number> = {
    'power': 4,      // 4 * 20 + 60 = 140km/week
    'strength': 3,   // 3 * 20 + 60 = 120km/week
    'hypertrophy': 2, // 2 * 20 + 60 = 100km/week
    'maintenance': 1, // 1 * 20 + 60 = 80km/week
    'none': 0        // 0 * 20 + 60 = 60km/week
  };

  function calculateMaxWeeklyVolume(tier?: TonnageTier): number {
    const tierKey = tier || 'none';
    return (TONNAGE_TIER_MULTIPLIER[tierKey] * 20) + 60;
  }

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
      flaggedMetrics,
      score: 0 // RED = 0 score (maximum risk)
    };
  }

  // 2. Volume Cap Check: Strength-to-Volume Ratio
  if (currentWeeklyVolume !== undefined) {
    const maxWeeklyKM = calculateMaxWeeklyVolume(tonnageTier);
    if (currentWeeklyVolume > maxWeeklyKM) {
      const excess = currentWeeklyVolume - maxWeeklyKM;
      flaggedMetrics.push({
        metric: 'weeklyVolume',
        value: currentWeeklyVolume,
        threshold: maxWeeklyKM
      });

      // RED if significantly over (20%+), AMBER if slightly over
      if (excess > maxWeeklyKM * 0.2) {
        return {
          agentId: 'structural_agent',
          vote: 'RED',
          confidence: 0.95,
          reason: `Volume exceeds chassis capacity by ${excess.toFixed(1)}km/week. Current tier (${tonnageTier || 'none'}) allows max ${maxWeeklyKM}km/week. Increase strength tier to run more.`,
          flaggedMetrics,
          score: 20 // High risk due to volume overload
        };
      } else {
        return {
          agentId: 'structural_agent',
          vote: 'AMBER',
          confidence: 0.85,
          reason: `Volume approaching chassis capacity. Current: ${currentWeeklyVolume.toFixed(1)}km/week, Max for ${tonnageTier || 'none'} tier: ${maxWeeklyKM}km/week.`,
          flaggedMetrics,
          score: 60 // Moderate risk
        };
      }
    }
  }

  // 3. AMBER VETO: Strength Maintenance
  // "Structure Before Engine" - If we haven't lifted, we shouldn't run hard.
  // Adjust threshold based on tonnage tier (armor status)
  let MAX_DAYS_WITHOUT_LIFT = 5;
  
  if (tonnageTier === 'power' || tonnageTier === 'strength') {
    // Heavy lift = "armored" chassis, extend threshold to 7 days
    MAX_DAYS_WITHOUT_LIFT = 7;
  }
  
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
      reason: `Chassis Weakness Risk: Strength training frequency below maintenance. ${tonnageTier === 'power' || tonnageTier === 'strength' ? 'Armored chassis allows 7 days.' : 'Standard threshold is 5 days.'}`,
      flaggedMetrics,
      score: 70 // Moderate risk due to strength deficiency
    };
  }

  // 4. GREEN
  // Calculate normalized risk score (0-100) for AgentVote interface
  let riskScore = 0;
  if (niggleScore > 0) riskScore += niggleScore * 10; // Each niggle point = 10 risk
  if (daysSinceLastLift > 5) riskScore += (daysSinceLastLift - 5) * 5; // Each day over 5 = 5 risk
  if (currentWeeklyVolume !== undefined && tonnageTier) {
    const maxWeeklyKM = calculateMaxWeeklyVolume(tonnageTier);
    if (currentWeeklyVolume > maxWeeklyKM) {
      const excessPercent = ((currentWeeklyVolume - maxWeeklyKM) / maxWeeklyKM) * 100;
      riskScore += excessPercent * 0.5; // Excess volume adds risk
    }
  }
  riskScore = Math.min(100, riskScore); // Cap at 100
  
  return {
    agentId: 'structural_agent',
    vote: 'GREEN',
    confidence: 1.0,
    reason: 'Chassis Integrity Nominal.',
    flaggedMetrics: [],
    score: Math.max(80, 100 - riskScore) // GREEN = 80-100 score (low risk)
  };
};
