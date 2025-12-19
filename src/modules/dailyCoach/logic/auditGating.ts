export interface AuditGatingInput {
  niggleScore: number | null;
  strengthTier: string | null;
  lastRunDuration: number;
  fuelingTarget: number | null;
  fuelingCarbsPerHour: number | null;
  fuelingGiDistress: number | null;
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
 * - Strength: Always required (blocking)
 * - Fueling: Required if lastRunDuration > 90 OR fuelingTarget > 90
 *   - Must have both carbs_per_hour AND gi_distress
 * 
 * Returns auditRequired=true if any required input is missing
 */
export function checkAuditGating(input: AuditGatingInput): AuditGatingOutput {
  const { 
    niggleScore, 
    strengthTier, 
    lastRunDuration, 
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
  
  // Check strength (always required)
  if (!strengthTier || strengthTier === 'NONE') {
    missingInputs.push('Strength tier');
    if (!auditType) auditType = 'STRENGTH';
  }
  
  // Check fueling (required if long run or high target)
  const fuelingRequired = lastRunDuration > 90 || (fuelingTarget !== null && fuelingTarget > 90);
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

