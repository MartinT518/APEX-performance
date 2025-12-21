import { IAgentVote, TonnageTier } from '@/types/agents';
import type { ISessionSummary } from '@/types/session';
import { getCurrentPhase } from '../../analyze/blueprintEngine';
import { calculatePhaseAwareLoad } from '../../analyze/valuationEngine';
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
  const currentDate = new Date();
  const phase = getCurrentPhase(currentDate);

  try {
    // Get tonnage history from monitor store
    const lastLiftTier = await monitor.getLastLiftTier();
    if (lastLiftTier) {
      const acuteTonnage = calculatePhaseAwareLoad(lastLiftTier, phase.phaseNumber);
      const chronicTonnage = acuteTonnage * 0.8; // Simplified - would use rolling average
      acuteChronicRatio = chronicTonnage > 0 ? acuteTonnage / chronicTonnage : undefined;
    }
  } catch (e) {
    // If calculation fails, continue without ratio
    console.warn('Failed to calculate Acute_Chronic_Ratio:', e);
  }

  // Strength-to-Volume Ratio: Max_Weekly_KM = (Tonnage_Tier * 20) + 60
  const TONNAGE_TIER_MULTIPLIER: Record<TonnageTier | 'none', number> = {
    'explosive': 5,  // 5 * 20 + 60 = 160km/week (Max stability)
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
  let MAX_DAYS_WITHOUT_LIFT = 5;
  
  if (tonnageTier === 'power' || tonnageTier === 'strength' || tonnageTier === 'explosive') {
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
      reason: `Chassis Weakness Risk: Strength training frequency below maintenance. ${MAX_DAYS_WITHOUT_LIFT} days allowed for ${tonnageTier || 'none'} tier.`,
      flaggedMetrics,
      score: 70
    };
  }

  // 4. PHASE-SPECIFIC VETOES (The "Screw Tightening")
  const effectiveLoad = calculatePhaseAwareLoad(tonnageTier, phase.phaseNumber);
  
  // Phase 2: Power Conversion requires Intensity
  if (phase.phaseNumber === 2 && effectiveLoad < 2000) {
    return {
      agentId: 'structural_agent',
      vote: 'AMBER',
      confidence: 0.95,
      reason: `Structural Defecit: Phase 2 Power Conversion REQUIRES high-torque lifting (Strength/Power tier). Maintenance tier is insufficient for tendon stiffening.`,
      flaggedMetrics: [],
      score: 60
    };
  }

  // Phase 3: Peak Performance requires RFD
  if (phase.phaseNumber === 3 && effectiveLoad < 3000) {
    const isRed = currentWeeklyVolume > 100;
    return {
      agentId: 'structural_agent',
      vote: isRed ? 'RED' : 'AMBER',
      confidence: 0.9,
      reason: `Structural Risk: Phase 3 requires Explosive/Plyo training to offset highest mechanical running stress. ${isRed ? 'RED VETO: High volume mandates explosive shielding.' : 'AMBER: Increase lifting intensity.'}`,
      flaggedMetrics: [],
      score: isRed ? 30 : 50
    };
  }

  // 5. GREEN
  // Calculate normalized risk score (0-100)
  let riskScore = 0;
  if (niggleScore > 0) riskScore += niggleScore * 10;
  if (daysSinceLastLift > MAX_DAYS_WITHOUT_LIFT) riskScore += (daysSinceLastLift - MAX_DAYS_WITHOUT_LIFT) * 5;
  
  const maxWeeklyKM = calculateMaxWeeklyVolume(tonnageTier);
  if (currentWeeklyVolume !== undefined && currentWeeklyVolume > maxWeeklyKM) {
    const excessPercent = ((currentWeeklyVolume - maxWeeklyKM) / maxWeeklyKM) * 100;
    riskScore += excessPercent * 0.5;
  }
  
  riskScore = Math.min(100, riskScore);
  
  return {
    agentId: 'structural_agent',
    vote: 'GREEN',
    confidence: 1.0,
    reason: 'Chassis Integrity Nominal.',
    flaggedMetrics: [],
    score: Math.max(80, 100 - riskScore) // GREEN = 80-100 score (low risk)
  };
};
