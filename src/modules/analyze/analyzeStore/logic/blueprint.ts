import { runMonteCarloSimulation } from '../../blueprintEngine';

/**
 * Recalculates blueprint confidence score using Monte Carlo simulation
 */
export function recalculateBlueprintConfidence(
  currentLoad: number | null,
  goalMetric: number
): string {
  const load = currentLoad || 50; // Default fallback
  
  const result = runMonteCarloSimulation({
    currentLoad: load,
    injuryRiskScore: 0.1, // TODO: Fetch from Structural Agent
    goalMetric,
    daysRemaining: 120 // TODO: Fetch from Date
  });

  return result.confidenceScore;
}

