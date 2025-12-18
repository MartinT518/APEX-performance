import { updateBaselines } from '../../analyze/baselineEngine';
import { runMonteCarloSimulation } from '../../analyze/blueprintEngine';
import { useAnalyzeStore } from '../../analyze/analyzeStore';
import { logger } from '@/lib/logger';

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
  currentTonnage: number
): Promise<AnalysisResult> {
  logger.info(">> Step 4: Analysis & Baserunning");
  
  // Mocking previous baselines for simulation
  const prevHRV = 50; 
  const prevTonnage = 10000;
  
  const baselines = updateBaselines({
    currentHRV,
    currentTonnage,
    prevHRVBaseline: prevHRV,
    prevTonnageBaseline: prevTonnage
  });
  
  logger.info(`Baselines Updated: HRV=${baselines.hrvBaseline.toFixed(1)}, Tonnage=${baselines.tonnageBaseline.toFixed(1)}`);

  // Get gut training index from analyzeStore
  const analyzeStore = useAnalyzeStore.getState();
  const gutTrainingIndex = analyzeStore.baselines.gutTrainingIndex || 0;

  // Run Monte Carlo
  const simulation = runMonteCarloSimulation({
    currentLoad: 500, // arbitrary unit
    injuryRiskScore: 0.1,
    goalMetric: 1000,
    daysRemaining: 120
  });
  
  logger.info(`Blueprint Confidence: ${simulation.confidenceScore} (${simulation.successProbability.toFixed(1)}%)`);
  return { 
    baselines: {
      ...baselines,
      gutTrainingIndex
    }, 
    simulation 
  };
}

