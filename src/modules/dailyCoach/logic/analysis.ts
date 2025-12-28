import { updateBaselines } from '../../analyze/baselineEngine';
import { runMonteCarloSimulation } from '../../analyze/blueprintEngine';
import { logger } from '@/lib/logger';
import { analyzeTacticalHistory } from '../../analyze/plannerEngine';
import type { PrototypeSessionDetail } from '@/types/prototype';

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
  history: PrototypeSessionDetail[]
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
  const historicalVolume = history.map(s => {
    if (s.type === 'EXEC' || s.type === 'SUB') {
      const distMatch = s.duration.match(/(\d+)h\s*(\d+)m/);
      // Rough km estimate if distance missing
      return s.distance || (distMatch ? (parseInt(distMatch[1])*60 + parseInt(distMatch[2]))/5 : 0);
    }
    return 0;
  });

  const simulation = runMonteCarloSimulation({
    currentLoad: analysis.avgWeeklyVolume, 
    injuryRiskScore: Math.min(1.0, injuryRiskScore),
    goalMetric: 140, // Sub-2:30 target volume threshold
    daysRemaining,
    historicalVolume
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

