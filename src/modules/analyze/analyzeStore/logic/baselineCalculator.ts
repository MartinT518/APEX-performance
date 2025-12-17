import { calculateEWMA, calculateRollingAverage } from '../../baselineEngine';

export interface BaselineMetrics {
  hrv?: number;
  tonnage?: number;
  fuelingCarbs?: number;
}

export interface BaselineHistory {
  hrv: number[];
  tonnage: number[];
  fuelingSessions: number[];
}

export interface Baselines {
  hrv7Day: number | null;
  hrv28Day: number | null;
  tonnage7Day: number | null;
  gutTrainingIndex: number;
  confidenceScore: string;
}

/**
 * Calculates updated baselines from new metrics
 */
export function calculateUpdatedBaselines(
  currentBaselines: Baselines,
  currentHistory: BaselineHistory,
  metrics: BaselineMetrics
): { baselines: Baselines; history: BaselineHistory } {
  const newHistory = { ...currentHistory };
  const newBaselines = { ...currentBaselines };

  // Update HRV
  if (metrics.hrv !== undefined) {
    newHistory.hrv = [...currentHistory.hrv, metrics.hrv].slice(-28); // Keep last 28
    newBaselines.hrv7Day = calculateEWMA(metrics.hrv, currentBaselines.hrv7Day, 7);
    newBaselines.hrv28Day = calculateEWMA(metrics.hrv, currentBaselines.hrv28Day, 28);
  }

  // Update Tonnage
  if (metrics.tonnage !== undefined) {
    newHistory.tonnage = [...currentHistory.tonnage, metrics.tonnage].slice(-7);
    newBaselines.tonnage7Day = calculateRollingAverage(newHistory.tonnage);
  }

  // Update Fueling Index
  if (metrics.fuelingCarbs !== undefined) {
    newHistory.fuelingSessions = [...currentHistory.fuelingSessions, metrics.fuelingCarbs].slice(-28);
    newBaselines.gutTrainingIndex = newHistory.fuelingSessions.filter(c => c > 60).length;
  }

  return { baselines: newBaselines, history: newHistory };
}

