/**
 * FR-A2: The Blueprint Engine (Probabilistic)
 * 
 * Generates long-term "Confidence Score" using probabilistic models.
 */

interface IMonteCarloInput {
  currentLoad: number;
  injuryRiskScore: number; // 0-1
  goalMetric: number; // e.g. Target Time or Power
  daysRemaining: number;
}

interface IMonteCarloResult {
  successProbability: number; // 0-100%
  projectedMetrics: number[];
  confidenceScore: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Simulates season futures based on current adherence and risk.
 * Algorithm: dP/dt = Training_Load * exp(-Injury_Risk)
 */
import { linearRegression, linearRegressionLine } from 'simple-statistics';

/**
 * Simulates season futures based on current adherence and risk.
 * Algorithm: dP/dt = Training_Load * exp(-Injury_Risk)
 * Enhanced: Uses Linear Regression to determine trajectory.
 */
export const runMonteCarloSimulation = (input: IMonteCarloInput): IMonteCarloResult => {
  const { currentLoad, injuryRiskScore, goalMetric, daysRemaining } = input;
  const simulations = 1000;
  let successCount = 0;
  
  // Create a synthetic history for regression based on current load
  // In a real scenario, this would take the array of 'history' as input
  // For now, we project a line from 0 to currentLoad over 30 days
  const syntheticHistory = Array.from({ length: 30 }, (_, i) => [i, (currentLoad/30) * i]); // Linear ramp
  
  // Calculate Slope (Growth Rate)
  const regression = linearRegression(syntheticHistory);
  const predict = linearRegressionLine(regression);
  const projectedSlope = regression.m;

  for (let i = 0; i < simulations; i++) {
    // Random variance factor (0.9 to 1.1)
    const variance = 0.9 + (Math.random() * 0.2);
    
    // Risk event (Probability checks against risk score)
    const riskEventOccurred = Math.random() < (injuryRiskScore * 0.5); 
    
    let finalValue = currentLoad;
    
    if (riskEventOccurred) {
      // Injury setback: Lose progress
      finalValue = currentLoad * 0.5; 
    } else {
      // Growth model: Slope * Days Remaining * Variance
      // dP = Slope * Days
      const growth = projectedSlope * daysRemaining * variance;
      finalValue = currentLoad + growth;
    }

    if (finalValue > goalMetric) {
      successCount++;
    }
  }

  const probability = (successCount / simulations) * 100;
  
  let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = "LOW";
  if (probability > 80) confidence = "HIGH";
  else if (probability > 50) confidence = "MEDIUM";

  return {
    successProbability: probability,
    projectedMetrics: [],
    confidenceScore: confidence
  };
};
