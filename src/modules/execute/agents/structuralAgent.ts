import { IAgentVote, IStructuralInput, TonnageTier } from '@/types/agents';

/**
 * Agent A: The Structural Agent (The Chassis)
 * 
 * Goal: Protect mechanical integrity.
 * Rules:
 * - RED: Niggle > 3 (Hard Stop)
 * - AMBER: Days Since Lift > 5 (Cap Intensity)
 * - AMBER/RED: Volume exceeds chassis capacity based on tonnage tier
 */
export const evaluateStructuralHealth = (input: IStructuralInput): IAgentVote => {
  const { niggleScore, daysSinceLastLift, tonnageTier, currentWeeklyVolume } = input;
  const flaggedMetrics = [];

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
      flaggedMetrics
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
          flaggedMetrics
        };
      } else {
        return {
          agentId: 'structural_agent',
          vote: 'AMBER',
          confidence: 0.85,
          reason: `Volume approaching chassis capacity. Current: ${currentWeeklyVolume.toFixed(1)}km/week, Max for ${tonnageTier || 'none'} tier: ${maxWeeklyKM}km/week.`,
          flaggedMetrics
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
      flaggedMetrics
    };
  }

  // 4. GREEN
  return {
    agentId: 'structural_agent',
    vote: 'GREEN',
    confidence: 1.0,
    reason: 'Chassis Integrity Nominal.',
    flaggedMetrics: []
  };
};
