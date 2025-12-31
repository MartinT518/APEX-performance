/**
 * FR-A2: The Blueprint Engine (Probabilistic)
 * 
 * Generates long-term "Confidence Score" using probabilistic models.
 */

import type { PhaseDefinition, IntensityZone } from '@/types/workout';
import type { TonnageTier } from '@/modules/monitor/monitorStore';
import { goalTimeToMetric, getRequiredWeeklyVolume, formatGoalTimeDisplay } from './utils/goalTime';
import { logger } from '@/lib/logger';

interface IMonteCarloInput {
  currentLoad: number;
  injuryRiskScore: number; // 0-1
  goalMetric: number; // e.g. Target Time or Power
  daysRemaining: number;
  historicalVolume?: number[]; // Real historical volume data
  niggleTrend?: number[]; // Recent niggle scores for injury risk
  daysSinceLastLift?: number; // Strength compliance
}

interface IMonteCarloResult {
  successProbability: number; // 0-100%
  projectedMetrics: number[];
  confidenceScore: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface VolumeCalibrationResult {
  safetyPath: {
    volume: number; // Low volume (e.g., 100km/week)
    intensity: 'high';
    probability: number; // e.g., 12%
  };
  performancePath: {
    volume: number; // High volume (e.g., 140km/week)
    intensity: 'high';
    tonnageRequirement: string; // "2x Power Tier lifts per week"
    probability: number; // e.g., 82%
  };
  recommendation: string; // UI message for user
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
  const { currentLoad, injuryRiskScore, goalMetric, daysRemaining, historicalVolume, niggleTrend, daysSinceLastLift } = input;
  const simulations = 1000;
  let successCount = 0;
  
  // P1 Fix: Provide conservative estimate when insufficient historical data
  // Instead of returning 0%, calculate a conservative baseline estimate
  if (!historicalVolume || historicalVolume.length < 7) {
    logger.warn('Insufficient historical data for Monte Carlo simulation', {
      dataPoints: historicalVolume?.length || 0,
      required: 7
    });
    
    // Calculate conservative estimate based on available data
    const availableDataPoints = historicalVolume?.length || 0;
    const hasAnyData = availableDataPoints > 0;
    
    // Conservative probability calculation for limited data:
    // Base probability factors:
    // 1. Data availability (0-6 days): More data = higher confidence
    // 2. Days remaining: More days = more opportunity (but cap the benefit)
    // 3. Injury risk: Higher risk = lower probability
    // 4. Current load: Having any load is better than none
    
    // Data confidence factor: 0-1 scale based on available data points
    const dataConfidenceFactor = Math.min(1, availableDataPoints / 7); // 0-1 scale
    
    // Days remaining factor: More days is better, but diminishing returns
    // Cap the benefit at 180 days (6 months)
    const daysFactor = Math.min(1, daysRemaining / 180);
    
    // Injury risk penalty: Higher risk reduces probability
    const riskPenalty = Math.min(0.6, injuryRiskScore * 0.6); // Max 60% reduction
    
    // Base probability calculation:
    // - Start with 30% base (conservative but not zero)
    // - Add up to 20% for data availability
    // - Add up to 15% for days remaining
    // - Subtract up to 60% for injury risk
    const baseProbability = 30;
    const dataBonus = dataConfidenceFactor * 20; // Up to 20% for having data
    const daysBonus = daysFactor * 15; // Up to 15% for having time
    const riskReduction = baseProbability * riskPenalty;
    
    const calculatedProbability = baseProbability + dataBonus + daysBonus - riskReduction;
    
    // Ensure minimum probability based on data availability
    // If we have any data, provide at least 10% (shows we're tracking)
    // If no data, provide 5% (very conservative)
    const finalProbability = hasAnyData 
      ? Math.max(10, Math.min(50, calculatedProbability)) // Cap at 50% for limited data
      : Math.max(5, Math.min(30, calculatedProbability)); // Cap at 30% for no data
    
    return {
      successProbability: finalProbability,
      projectedMetrics: [],
      confidenceScore: 'LOW' as const
    };
  }
  
  // Create history for regression using real historical data
  const regressionData = historicalVolume.map((v, i) => [i, v]);
  
  // Calculate Slope (Growth Rate) from real data
  const regression = linearRegression(regressionData);
  const projectedSlope = regression.m;

  // Calculate actual variance from historical data if available
  let historicalVariance = 0.1; // Default 10% variance
  if (historicalVolume && historicalVolume.length > 7) {
    // Calculate coefficient of variation from last 7 data points
    const recent = historicalVolume.slice(-7);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance);
    historicalVariance = mean > 0 ? stdDev / mean : 0.1; // Coefficient of variation
  }

  // Enhanced injury risk model
  let enhancedInjuryRisk = injuryRiskScore;
  
  // Check for load spikes (volume increase >20% week-over-week)
  if (historicalVolume && historicalVolume.length >= 14) {
    const lastWeek = historicalVolume.slice(-7).reduce((a, b) => a + b, 0);
    const prevWeek = historicalVolume.slice(-14, -7).reduce((a, b) => a + b, 0);
    if (prevWeek > 0 && (lastWeek / prevWeek) > 1.2) {
      enhancedInjuryRisk = Math.min(1.0, enhancedInjuryRisk + 0.2); // +20% risk for load spike
    }
  }
  
  // Check niggle trend (increasing pain = higher risk)
  if (niggleTrend && niggleTrend.length >= 3) {
    const recentNiggle = niggleTrend.slice(-3);
    const avgNiggle = recentNiggle.reduce((a, b) => a + b, 0) / recentNiggle.length;
    if (avgNiggle > 4) {
      enhancedInjuryRisk = Math.min(1.0, enhancedInjuryRisk + (avgNiggle - 4) * 0.1); // +10% per point over 4
    }
  }
  
  // Check strength compliance (days since last lift)
  if (daysSinceLastLift !== undefined && daysSinceLastLift > 7) {
    enhancedInjuryRisk = Math.min(1.0, enhancedInjuryRisk + 0.15); // +15% risk if no lift in 7+ days
  }

  for (let i = 0; i < simulations; i++) {
    // Use actual historical variance instead of arbitrary 0.9-1.1
    // Apply normal distribution around 1.0 with historical variance
    const variance = 1.0 + ((Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2) * historicalVariance;
    
    // Enhanced risk event calculation
    const riskEventOccurred = Math.random() < (enhancedInjuryRisk * 0.5); 
    
    let finalValue = currentLoad;
    
    if (riskEventOccurred) {
      // Injury setback: Lose progress (severity based on risk level)
      const setbackSeverity = enhancedInjuryRisk > 0.7 ? 0.4 : 0.6; // More severe if higher risk
      finalValue = currentLoad * setbackSeverity; 
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
  
  // Architectural Constraint: Never promise 100% certainty. 
  // High-Rev athlete always carries structural risk.
  const cappedProbability = Math.min(85, probability);

  let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = "LOW";
  if (cappedProbability > 80) confidence = "HIGH";
  else if (cappedProbability > 50) confidence = "MEDIUM";

  return {
    successProbability: cappedProbability,
    projectedMetrics: [],
    confidenceScore: confidence
  };
};

/**
 * Gets the current training phase based on date
 * Based on TrainingBlueprint.pdf constraints
 */
export function getCurrentPhase(date: Date): PhaseDefinition {
  const dateStr = date.toISOString().split('T')[0];
  
  // Phase 1: Aerobic Base Supremacy (Oct 1, 2025 - Dec 31, 2025)
  if (dateStr >= '2025-10-01' && dateStr <= '2025-12-31') {
    return {
      phaseNumber: 1,
      name: 'Aerobic Base Supremacy',
      startDate: '2025-10-01',
      endDate: '2025-12-31',
      maxAllowedZone: 'Z2_ENDURANCE',
      maxMonthlyVolume: 450, // km/month
      maxWeeklyVolume: 112.5, // ~450/4
      hrCap: { min: 130, max: 145 } // Strict Z2/Base constraint
    };
  }
  
  // Phase 2: Power Conversion & Specific Endurance (Jan 1, 2026 - Apr 30, 2026)
  if (dateStr >= '2026-01-01' && dateStr <= '2026-04-30') {
    return {
      phaseNumber: 2,
      name: 'Power Conversion & Specific Endurance',
      startDate: '2026-01-01',
      endDate: '2026-04-30',
      maxAllowedZone: 'Z4_THRESHOLD',
      maxMonthlyVolume: 480, // km/month
      maxWeeklyVolume: 120, // ~480/4
      hrCap: { min: 146, max: 172 } // Threshold integration allowed
    };
  }
  
  // Phase 3: Final Sharpening & Peak Performance (May 1, 2026 - Aug 31, 2026)
  if (dateStr >= '2026-05-01' && dateStr <= '2026-08-31') {
    return {
      phaseNumber: 3,
      name: 'Final Sharpening & Peak Performance',
      startDate: '2026-05-01',
      endDate: '2026-08-31',
      maxAllowedZone: 'Z5_VO2MAX',
      maxMonthlyVolume: 640, // km/month
      maxWeeklyVolume: 160, // km/week (Rule A-1)
      requiresStructuralIntegrity: 80, // Minimum SIS for high volume
      hrCap: { min: 145, max: 188 } // VO2max sessions allowed
    };
  }
  
  // Phase 4: Execution & Recovery (Sep 1, 2026 - Oct 31, 2026)
  if (dateStr >= '2026-09-01' && dateStr <= '2026-10-31') {
    return {
      phaseNumber: 4,
      name: 'Execution & Recovery',
      startDate: '2026-09-01',
      endDate: '2026-10-31',
      maxAllowedZone: 'Z4_THRESHOLD',
      maxMonthlyVolume: 300, // km/month (Taper)
      maxWeeklyVolume: 75, // ~300/4
      hrCap: { min: 130, max: 168 } // Sharp but controlled
    };
  }
  
  // Default to Phase 1 if before Oct 2025 or after Oct 2026
  return {
    phaseNumber: 1,
    name: 'Aerobic Base Supremacy',
    startDate: '2025-10-01',
    endDate: '2025-12-31',
    maxAllowedZone: 'Z2_ENDURANCE',
    maxMonthlyVolume: 450,
    maxWeeklyVolume: 112.5,
    hrCap: { min: 130, max: 145 }
  };
}

/**
 * FR-R4: Intensity Veto (Anti-Trash Zone Logic)
 * Prevents Zone 3 "Grey Zone" infiltration during Base Phase
 */
export function applyIntensityVeto(
  suggestedZone: IntensityZone,
  currentDate: Date
): IntensityZone {
  const phase = getCurrentPhase(currentDate);
  
  // Anti-Trash Zone: If before Phase 2, cap at Zone 2
  if (currentDate < new Date('2026-01-01')) {
    const zoneOrder: IntensityZone[] = ['Z1_RECOVERY', 'Z2_ENDURANCE', 'Z3_TEMPO', 'Z4_THRESHOLD', 'Z5_VO2MAX'];
    const suggestedIndex = zoneOrder.indexOf(suggestedZone);
    const maxIndex = zoneOrder.indexOf(phase.maxAllowedZone);
    return zoneOrder[Math.min(suggestedIndex, maxIndex)] as IntensityZone;
  }
  
  // For Phase 2+, cap at phase max
  const zoneOrder: IntensityZone[] = ['Z1_RECOVERY', 'Z2_ENDURANCE', 'Z3_TEMPO', 'Z4_THRESHOLD', 'Z5_VO2MAX'];
  const suggestedIndex = zoneOrder.indexOf(suggestedZone);
  const maxIndex = zoneOrder.indexOf(phase.maxAllowedZone);
  return zoneOrder[Math.min(suggestedIndex, maxIndex)] as IntensityZone;
}

/**
 * Step 10 (REVISED): Monte Carlo Volume Calibration
 * Compares Safety Path vs Performance Path for goal time
 */
export function runVolumeCalibrationSimulation(
  currentVolume: number,
  currentTonnageTier: TonnageTier | undefined,
  structuralIntegrityScore: number,
  goalTime: string = '2:30:00' // Default to 2:30:00 if not provided
): VolumeCalibrationResult {
  const goalMetric = goalTimeToMetric(goalTime);
  const requiredVolume = getRequiredWeeklyVolume(goalTime);
  const goalDisplay = formatGoalTimeDisplay(goalTime);
  const safetyVolume = Math.round(requiredVolume * 0.8); // 80% of required volume
  
  // Run two scenarios:
  // 1. Safety Path: Low volume (80% of required), high intensity
  const safetyPath = runMonteCarloSimulation({
    currentLoad: safetyVolume,
    injuryRiskScore: 0.3, // Lower risk with lower volume
    goalMetric,
    daysRemaining: 280
  });
  
  // 2. Performance Path: Full required volume, high intensity, requires Power tier
  const performancePath = runMonteCarloSimulation({
    currentLoad: requiredVolume, // Required volume for goal time
    injuryRiskScore: structuralIntegrityScore < 80 ? 0.7 : 0.3, // High risk if SIS < 80
    goalMetric,
    daysRemaining: 280
  });
  
  const recommendation = currentTonnageTier !== 'power' && currentTonnageTier !== 'strength'
    ? `To hit ${goalDisplay}, your mechanical volume must reach ${requiredVolume}km/week. This requires 2x 'Power' Tier lift sessions per week to protect the chassis.`
    : `Performance path available. Maintain Power/Strength tier to support ${requiredVolume}km/week volume.`;
  
  return {
    safetyPath: {
      volume: safetyVolume,
      intensity: 'high',
      probability: safetyPath.successProbability
    },
    performancePath: {
      volume: requiredVolume,
      intensity: 'high',
      tonnageRequirement: "2x Power Tier lifts per week",
      probability: performancePath.successProbability
    },
    recommendation
  };
}
