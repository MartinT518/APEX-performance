/**
 * ValuationEngine: Mathematical Logic Layer for "Road to 2:30 Valuation"
 * 
 * Implements three core equations:
 * - Equation A: Smart Adherence Score
 * - Equation B: Integrity Ratio (Chassis vs Engine)
 * - Equation C: Blueprint Probability
 */

import type { PrototypeSessionDetail } from '@/types/prototype';
import { getCurrentPhase } from './blueprintEngine';

// ValuationResult interface is defined later in the file near its generator functions.

/**
 * Step 1: Phase-Aware Load Weighting
 * Logic changes based on physiological requirements of the phase.
 */
export function calculatePhaseAwareLoad(tier: string | undefined, phaseNumber: number): number {
  const normTier = tier?.toUpperCase() || 'NONE';
  
  // Phase 1: Aerobic Base (Consistency is Priority)
  if (phaseNumber === 1) {
    if (normTier === 'MAIN' || normTier === 'MOBILITY') return 1250; // 50 * 25
    if (normTier === 'HYPER' || normTier === 'HYPERTROPHY') return 2500; // 100 * 25
    if (normTier === 'STR' || normTier === 'STRENGTH' || normTier === 'POWER') return 3750; // 150 * 25
    if (normTier === 'EXPLOSIVE' || normTier === 'PLYO') return 3750; // 150 * 25
    return 0;
  }
  
  // Phase 2: Power Conversion (Intensity is Priority - Penalize light weights)
  if (phaseNumber === 2) {
    if (normTier === 'MAIN' || normTier === 'MOBILITY') return 500; // 20 * 25
    if (normTier === 'HYPER' || normTier === 'HYPERTROPHY') return 2000; // 80 * 25
    if (normTier === 'STR' || normTier === 'STRENGTH' || normTier === 'POWER') return 3750; // 150 * 25
    if (normTier === 'EXPLOSIVE' || normTier === 'PLYO') return 3750; // 150 * 25
    return 0;
  }
  
  // Phase 3: Peak Performance (RFD and Explosiveness is Priority)
  if (phaseNumber === 3) {
    if (normTier === 'MAIN' || normTier === 'MOBILITY') return 250; // 10 * 25
    if (normTier === 'HYPER' || normTier === 'HYPERTROPHY') return 1250; // 50 * 25
    if (normTier === 'STR' || normTier === 'STRENGTH' || normTier === 'POWER') return 3000; // 120 * 25
    if (normTier === 'EXPLOSIVE' || normTier === 'PLYO') return 5000; // 200 * 25
    return 0;
  }

  // Phase 4: Taper (Maintenance/Rest)
  if (phaseNumber === 4) {
    if (normTier === 'MAIN' || normTier === 'MOBILITY') return 2500; // 100 * 25
    return 1250; // 50 * 25
  }

  return 0;
}

/**
 * Maps strength tier to numeric load value (Legacy/Fallback)
 */
function strengthTierToLoad(tier: string | undefined): number {
  const phase = getCurrentPhase(new Date());
  return calculatePhaseAwareLoad(tier, phase.phaseNumber);
}

/**
 * Calculate effective volume from session
 */
function getEffectiveVolume(session: PrototypeSessionDetail): number {
  // Use distance if available, otherwise estimate from duration
  if (session.distance) {
    return session.distance;
  }
  
  // Rough estimate: 1km per 5 minutes for easy pace
  const durationMatch = session.duration.match(/(\d+)h\s*(\d+)m/);
  if (durationMatch) {
    const hours = parseInt(durationMatch[1] || '0', 10);
    const minutes = parseInt(durationMatch[2] || '0', 10);
    const totalMinutes = hours * 60 + minutes;
    return totalMinutes / 5; // km estimate
  }
  
  return 0;
}

/**
 * Equation A: Smart Adherence Score
 * Formula: Sum(V_eff * I_comp) / Sum(V_plan)
 * 
 * CRITICAL Logic: If user executes a Substitution triggered by a valid Structural Veto,
 * count it as 100% Adherence, not 0%. This rewards smart training (substituting when chassis is compromised).
 * 
 * Logic:
 * - Valid substitutions (type === 'SUB' with Structural RED) = 1.0 compliance (100% adherence)
 * - Invalid substitutions = 0.5 compliance
 * - If skipped without Veto, count as 0
 */
function calculateSmartAdherenceScore(sessions: PrototypeSessionDetail[]): number {
  let totalEffectiveVolume = 0;
  let totalPlannedVolume = 0;

  sessions.forEach(session => {
    const effectiveVolume = getEffectiveVolume(session);
    const plannedVolume = effectiveVolume; // Assume planned = effective for now
    
    let intensityCompliance = 0;
    
    if (session.compliance === 'MISSED' || session.type === 'MISSED') {
      // Missed session or blueprint violation
      intensityCompliance = 0;
    } else if (session.type === 'EXEC') {
      // Executed as planned
      intensityCompliance = 1.0;
    } else if (session.type === 'SUB') {
      // Substituted - check if it was due to valid Structural Veto
      const hasValidVeto = session.agentFeedback?.structural?.includes('RED') || 
                          session.agentFeedback?.structural?.toUpperCase().includes('RED') ||
                          session.compliance === 'SUBSTITUTED';
      
      if (hasValidVeto) {
        // CRITICAL: Valid substitution counts as 100% adherence (1.0 compliance)
        // This rewards smart training decisions
        intensityCompliance = 1.0;
      } else {
        // Invalid substitution counts as 0.5
        intensityCompliance = 0.5;
      }
    } else {
      // Other types (STR, REC, REST) count as planned if not marked MISSED
      intensityCompliance = 1.0;
    }

    totalEffectiveVolume += effectiveVolume * intensityCompliance;
    totalPlannedVolume += plannedVolume;
  });

  if (totalPlannedVolume === 0) {
    return 0;
  }

  return Math.min(100, (totalEffectiveVolume / totalPlannedVolume) * 100);
}

/**
 * Equation B: Integrity Ratio
 * Formula: RollingAvg(Strength_Load) / RollingAvg(Run_Volume)
 * 
 * Goal: Detect if the "Chassis" (Strength) is supporting the "Engine" (Volume)
 * 
 * Implementation: Uses tonnageHistory and volumeHistory with unit normalization.
 * Normalize units: (Tonnage/1000) / (Volume/10)
 * Use rolling averages from last 30 days.
 */
function calculateIntegrityRatio(sessions: PrototypeSessionDetail[], windowDays: number = 30): number {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);

  const recentSessions = sessions.filter(s => {
    // Parse day string to date (approximate)
    const today = new Date();
    const sessionDate = new Date(today);
    
    if (s.day === 'Today') {
      return true;
    } else if (s.day === 'Yesterday') {
      sessionDate.setDate(sessionDate.getDate() - 1);
      return sessionDate >= cutoffDate;
    } else {
      // For other day strings, include all recent sessions
      return true;
    }
  });

  // Collect tonnage history (strength sessions)
  const tonnageHistory: number[] = [];
  const currentDate = new Date();
  const phase = getCurrentPhase(currentDate);

  recentSessions.forEach(session => {
    if (session.type === 'STR') {
      const tier = session.hiddenVariables?.strengthTier;
      let load = calculatePhaseAwareLoad(tier, phase.phaseNumber);
      
      // Fallback: If no tier but duration > 15m, grant baseline "STR" load
      if (load === 0 && session.duration) {
        load = calculatePhaseAwareLoad('STR', phase.phaseNumber); 
      }
      tonnageHistory.push(load);
    }
  });

  // Collect volume history (running sessions)
  const volumeHistory: number[] = [];
  recentSessions.forEach(session => {
    if (session.type === 'EXEC' || session.type === 'SUB') {
      const volume = getEffectiveVolume(session);
      if (volume > 0) {
        volumeHistory.push(volume);
      }
    }
  });

  // Calculate rolling averages (last 30 days, or all available if less)
  const tonnageAvg = tonnageHistory.length > 0
    ? tonnageHistory.reduce((sum, t) => sum + t, 0) / tonnageHistory.length
    : 0;
  
  const volumeAvg = volumeHistory.length > 0
    ? volumeHistory.reduce((sum, v) => sum + v, 0) / volumeHistory.length
    : 0;

  if (volumeAvg === 0) {
    return 0;
  }

  // Normalize units: (Tonnage/1000) / (Volume/10)
  // This prevents 10,000kg vs 100km from being a 100:1 ratio
  const normalizedTonnage = (tonnageAvg > 0 ? tonnageAvg : 0) / 1000;
  const normalizedVolume = volumeAvg / 10;

  return normalizedVolume > 0 ? normalizedTonnage / normalizedVolume : 0;
}

/**
 * Equation C: Blueprint Probability
 * Formula: Base_Prob + (Alpha * (Vol_Banked - Vol_Req)) - (Beta * Risk_Penalty)
 * 
 * Logic:
 * - Decrease probability if Integrity Ratio < 0.8
 * - Base_Prob = initial probability (e.g., 50%)
 * - Alpha = volume coefficient (e.g., 0.5)
 * - Vol_Banked = cumulative effective training volume
 * - Vol_Req = required volume for Sub-2:30 goal
 * - Beta = risk coefficient (e.g., 0.3)
 * - Risk_Penalty = calculated from Integrity Ratio and adherence score
 */
function calculateBlueprintProbability(
  sessions: PrototypeSessionDetail[],
  adherenceScore: number,
  integrityRatio: number
): number {
  // Constants
  const BASE_PROB = 50; // Base probability (50%)
  const ALPHA = 0.5; // Volume coefficient
  const BETA = 0.3; // Risk coefficient
  const IDEAL_INTEGRITY_RATIO = 0.8; // Ideal chassis-to-engine ratio
  const MAX_PROBABILITY = 85; // Cap at 85% - always 15% risk of structural failure

  // Get current phase to determine required volume
  const currentDate = new Date();
  const phase = getCurrentPhase(currentDate);
  
  // Vol_Req ramps up over time based on phase
  // Phase 1: Lower requirement (base building)
  // Phase 2: Moderate requirement
  // Phase 3: High requirement (peak performance)
  // Phase 4: Lower requirement (taper)
  let volReqMultiplier = 1.0;
  if (phase.phaseNumber === 1) {
    volReqMultiplier = 0.6; // 60% of target volume
  } else if (phase.phaseNumber === 2) {
    volReqMultiplier = 0.8; // 80% of target volume
  } else if (phase.phaseNumber === 3) {
    volReqMultiplier = 1.0; // 100% of target volume
  } else if (phase.phaseNumber === 4) {
    volReqMultiplier = 0.5; // 50% of target volume (taper)
  }
  
  // Base required volume for Sub-2:30 (km over training period)
  const BASE_VOL_REQ = 2000;
  const VOL_REQ = BASE_VOL_REQ * volReqMultiplier;

  // Calculate cumulative effective volume
  let volBanked = 0;
  sessions.forEach(session => {
    volBanked += getEffectiveVolume(session);
  });

  // Check if current weekly volume meets phase requirements
  // If user is at 50km/week in Phase 3, probability should tank
  const currentWeeklyVolume = volBanked / (sessions.length > 0 ? Math.max(1, sessions.length / 7) : 1);
  if (phase.phaseNumber === 3 && currentWeeklyVolume < 50) {
    // Phase 3 requires high volume - if below 50km/week, probability drops significantly
    return Math.max(0, Math.round(BASE_PROB - 30)); // Heavy penalty
  }

  // Calculate volume contribution
  const volumeDelta = volBanked - VOL_REQ;
  const volumeContribution = ALPHA * (volumeDelta / VOL_REQ) * 100; // Normalize

  // Calculate risk penalty
  let riskPenalty = 0;
  
  // Penalty for low integrity ratio
  if (integrityRatio < IDEAL_INTEGRITY_RATIO) {
    const integrityDeficit = IDEAL_INTEGRITY_RATIO - integrityRatio;
    riskPenalty += integrityDeficit * 20; // Scale penalty
  }
  
  // Penalty for low adherence
  if (adherenceScore < 80) {
    const adherenceDeficit = 80 - adherenceScore;
    riskPenalty += adherenceDeficit * 0.5; // Scale penalty
  }

  // Calculate final probability
  let probability = BASE_PROB + volumeContribution - (BETA * riskPenalty);
  
  // Clamp to 0-85% (never promise certainty)
  probability = Math.max(0, Math.min(MAX_PROBABILITY, probability));

  return Math.round(probability);
}

/**
 * Determine Coach's Verdict based on adherence score and integrity ratio
 */
function determineCoachVerdict(adherenceScore: number, integrityRatio: number): ValuationResult['coachVerdict'] {
  if (adherenceScore >= 90 && integrityRatio >= 0.8) {
    return 'EXCELLENT';
  } else if (adherenceScore >= 80 && integrityRatio >= 0.7) {
    return 'ON TRACK';
  } else if (adherenceScore < 70 || integrityRatio < 0.6) {
    return 'HIGH RISK';
  } else {
    return 'MODERATE RISK';
  }
}

/**
 * Main Valuation Engine function
 * Calculates all three equations and returns comprehensive result
 */
export interface ValuationResult {
  adherenceScore: number; // 0-100%
  integrityRatio: number; // Ratio value (e.g., 0.8 = ideal)
  blueprintProbability: number; // 0-100%
  coachVerdict: 'ON TRACK' | 'POSITIVE DEVIATION' | 'RISK DETECTED';
  vetoCount: number;
  verdictText: string;
  chassisVerdict: string;
}

/**
 * Generate a dynamic verdict based on campaign adherence and integrity.
 */
export function generateVerdict(adherence: number, integrity: number, vetoes: number): { verdict: ValuationResult['coachVerdict'], text: string, chassis: string } {
  let chassisVerdict = "Chassis is stable.";
  if (integrity < 0.8) chassisVerdict = "Structural Deficit detected.";
  if (integrity < 0.6) chassisVerdict = "CRITICAL: Chassis Compromised.";
  if (integrity > 1.2) chassisVerdict = "Chassis is armored.";

  if (adherence > 90 && integrity > 1.0) {
    return {
      verdict: 'ON TRACK',
      text: "Volume and Structure are balanced. Maintain course.",
      chassis: chassisVerdict
    };
  }
  
  if (adherence < 80 && vetoes > 2) {
    return {
      verdict: 'POSITIVE DEVIATION',
      text: "Volume is low, but chassis is protected. Trust the taper.",
      chassis: chassisVerdict
    };
  }
  
  return {
    verdict: 'RISK DETECTED',
    text: "Discrepancy detected between intent and execution. Review metrics.",
    chassis: chassisVerdict
  };
}

/**
 * Main Valuation Engine function
 * Calculates all three equations and returns comprehensive result
 */
export function calculateValuation(sessions: PrototypeSessionDetail[]): ValuationResult {
  if (sessions.length === 0) {
    return {
      adherenceScore: 0,
      integrityRatio: 0,
      blueprintProbability: 50,
      coachVerdict: 'RISK DETECTED',
      vetoCount: 0,
      verdictText: "No data available for analysis."
    };
  }

  // Count Vetoes (Structural RED triggers)
  const vetoes = sessions.filter(s => 
    s.type === 'SUB' && (
      s.agentFeedback?.structural?.toUpperCase().includes('RED') || 
      s.compliance === 'SUBSTITUTED'
    )
  ).length;

  // Calculate Equation A: Smart Adherence Score
  const adherenceScore = calculateSmartAdherenceScore(sessions);

  // Calculate Equation B: Integrity Ratio
  const integrityRatio = calculateIntegrityRatio(sessions);

  // Calculate Equation C: Blueprint Probability
  const blueprintProbability = calculateBlueprintProbability(
    sessions,
    adherenceScore,
    integrityRatio
  );

  // Determine Coach's Verdict
  const verdictInfo = generateVerdict(adherenceScore, integrityRatio, vetoes);

  return {
    adherenceScore: Math.round(adherenceScore * 10) / 10,
    integrityRatio: Math.round(integrityRatio * 100) / 100,
    blueprintProbability,
    coachVerdict: verdictInfo.verdict,
    vetoCount: vetoes,
    verdictText: verdictInfo.text,
    chassisVerdict: verdictInfo.chassis
  };
}

