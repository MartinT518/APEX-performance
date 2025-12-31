import { updateBaselines } from '../../analyze/baselineEngine';
import { runMonteCarloSimulation } from '../../analyze/blueprintEngine';
import { logger } from '@/lib/logger';
import { analyzeTacticalHistory } from '../../analyze/plannerEngine';
import type { PrototypeSessionDetail } from '@/types/prototype';
import { goalTimeToMetric } from '../../analyze/utils/goalTime';

export interface AnalysisResult {
  baselines: {
    hrvBaseline: number;
    tonnageBaseline: number;
    gutTrainingIndex: number;
  };
  simulation: {
    successProbability: number;
    confidenceScore: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

/**
 * Runs analysis: updates baselines and runs Monte Carlo simulation
 */
export async function runAnalysis(
  currentHRV: number,
  currentTonnage: number,
  history: PrototypeSessionDetail[],
  goalTime: string = '2:30:00' // Default to 2:30:00 if not provided
): Promise<AnalysisResult> {
  logger.info(">> Step 4: Analysis & Baserunning");
  
  // 1. Update Baselines using tactical history if available
  const analysis = analyzeTacticalHistory(history);
  
  const baselines = updateBaselines({
    currentHRV,
    currentTonnage,
    prevHRVBaseline: currentHRV, // Using current as baseline if no previous provided
    prevTonnageBaseline: currentTonnage 
  });
  
  logger.info(`Baselines Updated: HRV=${baselines.hrvBaseline.toFixed(1)}, Tonnage=${baselines.tonnageBaseline.toFixed(1)}`);
  logger.info(`Tactical Context: Weekly Volume=${analysis.avgWeeklyVolume.toFixed(1)}km, Adherence=${analysis.adherenceScore}%`);

  // 2. Run Monte Carlo with dynamic inputs
  // Goal: End of Phase 4 (Oct 31, 2026)
  const targetDate = new Date('2026-10-31');
  const now = new Date();
  const daysRemaining = Math.max(1, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Risk Score derived from Niggle and Volume/Tonnage Balance
  const injuryRiskScore = (analysis.niggleScore / 10) * 0.5 + (analysis.integrityRatio < 0.8 ? 0.3 : 0);

  // Extract history for trajectory
  // P0 Fix: Use proper distance extraction from PrototypeSessionDetail
  // The distance field is already populated from metadata in sessionWithVotesToPrototype
  const historicalVolume = history
    .filter(s => s.type === 'EXEC' || s.type === 'SUB') // Only running/cycling sessions
    .map(s => {
      // Priority 1: Use distance field (already extracted from metadata)
      if (s.distance && s.distance > 0) {
        return s.distance;
      }
      // Priority 2: Use distanceKm alias
      if (s.distanceKm && s.distanceKm > 0) {
        return s.distanceKm;
      }
      // If distance not available, return 0 (will be filtered out)
      return 0;
    })
    .filter(d => d > 0); // Remove zero values to get actual training volume

  // Extract niggle trend from history (last 14 days)
  const niggleTrend = history
    .slice(-14)
    .map(s => s.hiddenVariables?.niggle)
    .filter((n): n is number => n !== undefined && n !== null);

  // Extract days since last lift from history
  // Find most recent strength session
  let daysSinceLastLift: number | undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].type === 'STR') {
      daysSinceLastLift = history.length - 1 - i;
      break;
    }
  }

  const goalMetric = goalTimeToMetric(goalTime);
  
  const simulation = runMonteCarloSimulation({
    currentLoad: analysis.avgWeeklyVolume, 
    injuryRiskScore: Math.min(1.0, injuryRiskScore),
    goalMetric, // Goal time-based metric
    daysRemaining,
    historicalVolume: historicalVolume.length > 0 ? historicalVolume : undefined,
    niggleTrend: niggleTrend.length > 0 ? niggleTrend : undefined,
    daysSinceLastLift
  });
  
  logger.info(`Blueprint Confidence: ${simulation.confidenceScore} (${simulation.successProbability.toFixed(1)}%) - ${daysRemaining} days out`);
  
  return { 
    baselines: {
      ...baselines,
      gutTrainingIndex: baselines.gutTrainingIndex || analysis.integrityRatio // Fallback if index missing
    }, 
    simulation 
  };
}

