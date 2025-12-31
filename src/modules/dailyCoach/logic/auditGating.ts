export interface AuditGatingInput {
  niggleScore: number | null;
  strengthSessionDone: boolean | null;
  strengthTier: string | null;
  lastRunDuration: number;
  daysSinceLastLift?: number; // Optional historical context
  fuelingTarget: number | null;
  fuelingCarbsPerHour: number | null;
  fuelingGiDistress: number | null;
  // Historical context for automatic fueling audit triggers
  hasHistoricalLongRunWithoutFueling?: boolean; // Set to true if history checker found missing fueling
}

export interface AuditGatingOutput {
  auditRequired: boolean;
  missingInputs: string[];
  auditType: 'NIGGLE' | 'STRENGTH' | 'FUELING' | null;
}

/**
 * Pure function that checks if required gatekeeper inputs are present
 * 
 * Rules:
 * - Niggle: Always required (blocking)
 * - Strength: Required if no lift in last 7 days. If lifted recently, it becomes optional.
 * - Fueling: Required if lastRunDuration > 90 OR fuelingTarget > 90
 *   - Must have both carbs_per_hour AND gi_distress
 * 
 * Returns auditRequired=true if any required input is missing
 */
export function checkAuditGating(input: AuditGatingInput): AuditGatingOutput {
  const { 
    niggleScore, 
    strengthSessionDone,
    strengthTier, 
    lastRunDuration, 
    daysSinceLastLift = 999, // Default to a high number if not provided
    fuelingTarget, 
    fuelingCarbsPerHour, 
    fuelingGiDistress 
  } = input;
  
  const missingInputs: string[] = [];
  let auditType: 'NIGGLE' | 'STRENGTH' | 'FUELING' | null = null;
  
  // Check niggle (always required)
  if (niggleScore === null || niggleScore === undefined) {
    missingInputs.push('Niggle score');
    if (!auditType) auditType = 'NIGGLE';
  }
  
  // Check strength
  // Rule: Required if never lifted today AND (daysSinceLastLift >= 7)
  const isStrengthMissing = strengthSessionDone === null || strengthSessionDone === undefined;
  const isStrengthRequired = daysSinceLastLift >= 7;

  if (isStrengthMissing && isStrengthRequired) {
    missingInputs.push('Strength status');
    if (!auditType) auditType = 'STRENGTH';
  }
  
  // Check fueling (required if long run, high target, or historical long run without fueling)
  // Roadmap requirement: "Automatically prompt for Carbs/hr and GI Distress for any activity >90min in history stream"
  const fuelingRequired = lastRunDuration > 90 || 
                         (fuelingTarget !== null && fuelingTarget > 90) ||
                         input.hasHistoricalLongRunWithoutFueling === true;
  if (fuelingRequired) {
    if (fuelingCarbsPerHour === null || fuelingCarbsPerHour === undefined) {
      missingInputs.push('Fueling carbs per hour');
      if (!auditType) auditType = 'FUELING';
    }
    if (fuelingGiDistress === null || fuelingGiDistress === undefined) {
      missingInputs.push('Fueling GI distress');
      if (!auditType) auditType = 'FUELING';
    }
  }
  
  return {
    auditRequired: missingInputs.length > 0,
    missingInputs,
    auditType
  };
}


