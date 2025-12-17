/**
 * FR-A1: The Baseline Engine
 * 
 * Logic for calculating rolling statistics and baselines.
 * Uses Exponential Weighted Moving Average (EWMA) for load and HRV.
 */

/**
 * Calculates EWMA (Exponential Weighted Moving Average)
 * Formula: EMA_today = (Value_today * alpha) + (EMA_yesterday * (1 - alpha))
 * Alpha = 2 / (N + 1)
 */
export const calculateEWMA = (
  todayValue: number,
  previousEMA: number | null,
  windowDays: number
): number => {
  // If no history, today's value is the baseline
  if (previousEMA === null || previousEMA === undefined) {
    return todayValue;
  }

  const alpha = 2 / (windowDays + 1);
  return (todayValue * alpha) + (previousEMA * (1 - alpha));
};

/**
 * Calculates standard simple rolling average
 */
export const calculateRollingAverage = (
  values: number[]
): number => {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
};

/**
 * Calculates Acute Chronic Workload Ratio (ACWR) for Tonnage or Load
 */
export const calculateACWR = (
  acuteLoad: number, // 7-day
  chronicLoad: number // 28-day
): number => {
  if (chronicLoad === 0) return 0;
  return acuteLoad / chronicLoad;
};

interface IBaselineUpdateInput {
    currentHRV: number;
    currentTonnage: number;
    prevHRVBaseline: number;
    prevTonnageBaseline: number;
}

export const updateBaselines = (input: IBaselineUpdateInput) => {
    // HRV: 7-day EWMA
    const newHRV = calculateEWMA(input.currentHRV, input.prevHRVBaseline, 7);
    
    // Tonnage: 28-day EWMA (More stability)
    const newTonnage = calculateEWMA(input.currentTonnage, input.prevTonnageBaseline, 28);

    return {
        hrvBaseline: newHRV,
        tonnageBaseline: newTonnage
    };
};
